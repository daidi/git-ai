// Package state manages per-repository runtime state outside the Git worktree.
//
// Runtime files live in the operating system's user cache directory and are
// keyed by the canonical Git directory. This keeps application-owned files out
// of repositories while still allowing the CLI and IDE integrations to share
// state. The CLI is the only writer; all writes are locked and atomic.
package state

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
	"unicode/utf8"

	"github.com/gofrs/flock"
)

const (
	StatusIdle      = "idle"
	StatusPolishing = "polishing"
	StatusPushing   = "pushing"
	StatusFailed    = "failed"
)

const (
	maxStateFileBytes      = 2 << 20
	maxHistoryRecords      = 500
	maxHistoryMessageBytes = 8 << 10
	maxHistoryFileBytes    = 8 << 20
	maxLegacyLogBytes      = 8 << 20
)

const stateDirEnv = "GIT_AI_STATE_DIR"

// OperationError is a safe, structured description of the last failed
// operation. Message must never contain API keys, prompts, diffs, or raw HTTP
// response bodies.
type OperationError struct {
	Code       string `json:"code"`
	Category   string `json:"category"`
	Message    string `json:"message"`
	Retryable  bool   `json:"retryable"`
	OccurredAt int64  `json:"occurred_at"`
}

// State represents the runtime state of git-ai for a repository.
type State struct {
	CurrentStatus string          `json:"current_status"`
	OriginalMsg   string          `json:"original_msg,omitempty"`
	LastSHA       string          `json:"last_sha,omitempty"`
	ResultSHA     string          `json:"result_sha,omitempty"`
	TargetRef     string          `json:"target_ref,omitempty"`
	OperationID   string          `json:"operation_id,omitempty"`
	PendingPush   *PendingPush    `json:"pending_push,omitempty"`
	LastError     *OperationError `json:"last_error,omitempty"`
	PID           int             `json:"pid,omitempty"`
	StartedAt     int64           `json:"started_at,omitempty"`
	SkipNext      bool            `json:"skip_next,omitempty"`
	Revision      uint64          `json:"revision"`
}

// PendingPush holds a deferred, non-interactive push request captured from the
// Git pre-push protocol.
type PendingPush struct {
	Remote    string       `json:"remote"`
	Updates   []PushUpdate `json:"updates,omitempty"`
	TargetRef string       `json:"target_ref,omitempty"`
	TargetSHA string       `json:"target_sha,omitempty"`
	ResultSHA string       `json:"result_sha,omitempty"`
	// RefSpecs is retained only for reading state created by versions <= 1.1.4.
	RefSpecs  []string `json:"ref_specs,omitempty"`
	Timestamp int64    `json:"timestamp"`
}

// PushUpdate is one line from Git's pre-push stdin protocol.
type PushUpdate struct {
	LocalRef  string `json:"local_ref"`
	LocalSHA  string `json:"local_sha"`
	RemoteRef string `json:"remote_ref"`
	RemoteSHA string `json:"remote_sha"`
}

// HistoryRecord is local application metadata for one polished commit. It is
// kept alongside runtime state, never in Git notes or the worktree.
type HistoryRecord struct {
	SHA                 string `json:"sha"`
	Model               string `json:"model"`
	GenerationTimeMs    int64  `json:"generation_time_ms"`
	OriginalMessage     string `json:"original_message"`
	EstimatedTimeSavedS int    `json:"estimated_time_saved_s"`
	Timestamp           int64  `json:"timestamp"`
}

type History struct {
	Records []HistoryRecord `json:"records"`
}

// Manager handles state file operations for one repository.
type Manager struct {
	stateDir  string
	legacyDir string
	fileLock  *flock.Flock
	mutex     sync.Mutex
}

// NewManager creates a manager keyed by the canonical Git directory.
func NewManager(gitDir string) *Manager {
	canonical := canonicalPath(gitDir)
	sum := sha256.Sum256([]byte(canonical))
	repoKey := hex.EncodeToString(sum[:12])
	dir := filepath.Join(runtimeBaseDir(), "repositories", repoKey)
	return &Manager{
		stateDir:  dir,
		legacyDir: filepath.Join(gitDir, "git-ai"),
		fileLock:  flock.New(filepath.Join(dir, "state.lock")),
	}
}

func canonicalPath(path string) string {
	if abs, err := filepath.Abs(path); err == nil {
		path = abs
	}
	if evaluated, err := filepath.EvalSymlinks(path); err == nil {
		path = evaluated
	}
	return filepath.Clean(path)
}

func runtimeBaseDir() string {
	if override := os.Getenv(stateDirEnv); override != "" {
		return override
	}
	if dir, err := os.UserCacheDir(); err == nil && dir != "" {
		return filepath.Join(dir, "git-ai")
	}
	if dir, err := os.UserConfigDir(); err == nil && dir != "" {
		return filepath.Join(dir, "git-ai", "runtime")
	}
	return filepath.Join(os.TempDir(), fmt.Sprintf("git-ai-%d", os.Getuid()))
}

// StateDir returns the external runtime directory path.
func (m *Manager) StateDir() string { return m.stateDir }

// StatePath returns the external state file path.
func (m *Manager) StatePath() string { return filepath.Join(m.stateDir, "state.json") }

// LogDir returns the external daemon log directory path.
func (m *Manager) LogDir() string { return filepath.Join(m.stateDir, "logs") }

// HistoryPath returns the external per-repository history file.
func (m *Manager) HistoryPath() string { return filepath.Join(m.stateDir, "history.json") }

// EnsureDir creates private runtime directories and migrates application-owned
// state left in .git/git-ai by older releases.
func (m *Manager) EnsureDir() error {
	if err := os.MkdirAll(m.stateDir, 0o700); err != nil {
		return fmt.Errorf("create state dir: %w", err)
	}
	if err := os.Chmod(m.stateDir, 0o700); err != nil && !errors.Is(err, os.ErrPermission) {
		return fmt.Errorf("secure state dir: %w", err)
	}
	if err := os.MkdirAll(m.LogDir(), 0o700); err != nil {
		return fmt.Errorf("create log dir: %w", err)
	}
	if err := os.Chmod(m.LogDir(), 0o700); err != nil && !errors.Is(err, os.ErrPermission) {
		return fmt.Errorf("secure log dir: %w", err)
	}
	return m.migrateLegacyState()
}

// Load reads a complete atomic snapshot. A missing file is idle state.
func (m *Manager) Load() (*State, error) { return m.loadUnlocked() }

func (m *Manager) loadUnlocked() (*State, error) {
	data, err := readRegularFile(m.StatePath(), maxStateFileBytes)
	if err != nil {
		if os.IsNotExist(err) {
			return &State{CurrentStatus: StatusIdle}, nil
		}
		return nil, fmt.Errorf("read state: %w", err)
	}
	var s State
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, fmt.Errorf("parse state: %w", err)
	}
	if s.CurrentStatus == "" {
		s.CurrentStatus = StatusIdle
	}
	return &s, nil
}

// Save replaces the state under the cross-process lock.
func (m *Manager) Save(s *State) error {
	return m.WithLock(func() error {
		current, err := m.loadUnlocked()
		if err != nil {
			return err
		}
		s.Revision = current.Revision + 1
		return m.saveUnlocked(s)
	})
}

// LoadHistory reads external commit metadata without creating repository files.
func (m *Manager) LoadHistory() (*History, error) { return m.loadHistoryUnlocked() }

func (m *Manager) loadHistoryUnlocked() (*History, error) {
	data, err := readRegularFile(m.HistoryPath(), maxHistoryFileBytes)
	if err != nil {
		if os.IsNotExist(err) {
			return &History{Records: make([]HistoryRecord, 0)}, nil
		}
		return nil, err
	}
	var history History
	if err := json.Unmarshal(data, &history); err != nil {
		return nil, fmt.Errorf("parse history: %w", err)
	}
	if history.Records == nil {
		history.Records = make([]HistoryRecord, 0)
	}
	return &history, nil
}

// AppendHistory records a bounded local history entry under the state lock.
func (m *Manager) AppendHistory(record HistoryRecord) error {
	return m.WithLock(func() error {
		if err := m.EnsureDir(); err != nil {
			return err
		}
		history, err := m.loadHistoryUnlocked()
		if err != nil {
			return err
		}
		record.OriginalMessage = clipHistoryText(record.OriginalMessage)
		if record.Timestamp == 0 {
			record.Timestamp = time.Now().Unix()
		}
		if record.EstimatedTimeSavedS == 0 {
			record.EstimatedTimeSavedS = 120
		}
		filtered := history.Records[:0]
		for _, existing := range history.Records {
			if existing.SHA != record.SHA {
				filtered = append(filtered, existing)
			}
		}
		history.Records = append(filtered, record)
		if len(history.Records) > maxHistoryRecords {
			history.Records = history.Records[len(history.Records)-maxHistoryRecords:]
		}
		data, err := json.MarshalIndent(history, "", "  ")
		if err != nil {
			return err
		}
		return writeAtomic(m.HistoryPath(), append(data, '\n'), 0o600)
	})
}

func clipHistoryText(value string) string {
	value = strings.ToValidUTF8(value, "�")
	if len(value) <= maxHistoryMessageBytes {
		return value
	}
	value = value[:maxHistoryMessageBytes]
	for !utf8.ValidString(value) {
		value = value[:len(value)-1]
	}
	return value + "…"
}

// Update performs a locked read-modify-write transaction. Returning changed=false
// leaves the file untouched and is useful for operation-id compare-and-swap.
func (m *Manager) Update(fn func(*State) (changed bool, err error)) (*State, error) {
	var result *State
	err := m.WithLock(func() error {
		current, err := m.loadUnlocked()
		if err != nil {
			return err
		}
		changed, err := fn(current)
		if err != nil {
			return err
		}
		if changed {
			current.Revision++
			if err := m.saveUnlocked(current); err != nil {
				return err
			}
		}
		copy := *current
		result = &copy
		return nil
	})
	return result, err
}

func (m *Manager) saveUnlocked(s *State) error {
	if err := m.EnsureDir(); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal state: %w", err)
	}
	data = append(data, '\n')
	if int64(len(data)) > maxStateFileBytes {
		return errors.New("application state exceeded the safety limit")
	}
	return writeAtomic(m.StatePath(), data, 0o600)
}

func writeAtomic(path string, data []byte, mode os.FileMode) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".state-*.tmp")
	if err != nil {
		return fmt.Errorf("create temporary state: %w", err)
	}
	tmpPath := tmp.Name()
	defer func() {
		_ = tmp.Close()
		_ = os.Remove(tmpPath)
	}()
	if err := tmp.Chmod(mode); err != nil {
		return fmt.Errorf("secure temporary state: %w", err)
	}
	if _, err := tmp.Write(data); err != nil {
		return fmt.Errorf("write temporary state: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		return fmt.Errorf("sync temporary state: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close temporary state: %w", err)
	}
	if err := os.Rename(tmpPath, path); err != nil {
		return fmt.Errorf("replace state: %w", err)
	}
	return nil
}

// Lock acquires the short-lived state transaction lock.
func (m *Manager) Lock() error {
	m.mutex.Lock()
	if err := os.MkdirAll(m.stateDir, 0o700); err != nil {
		m.mutex.Unlock()
		return fmt.Errorf("create lock dir: %w", err)
	}
	locked, err := m.fileLock.TryLockContext(context.Background(), 2*time.Second)
	if err != nil {
		m.mutex.Unlock()
		return fmt.Errorf("acquire lock: %w", err)
	}
	if !locked {
		m.mutex.Unlock()
		return errors.New("timed out waiting for git-ai state lock")
	}
	return nil
}

func (m *Manager) Unlock() error {
	err := m.fileLock.Unlock()
	m.mutex.Unlock()
	return err
}

func (m *Manager) WithLock(fn func() error) error {
	if err := m.Lock(); err != nil {
		return err
	}
	defer func() { _ = m.Unlock() }()
	return fn()
}

// Reset sets state to idle while preserving the last operation details useful
// for undo/history.
func (m *Manager) Reset() error {
	_, err := m.Update(func(s *State) (bool, error) {
		s.CurrentStatus = StatusIdle
		s.OperationID = ""
		s.TargetRef = ""
		s.PID = 0
		s.StartedAt = 0
		s.PendingPush = nil
		s.LastError = nil
		return true, nil
	})
	return err
}

// CleanZombieState converts stale polishing state into a retryable failure. It
// never rewrites a commit or worktree.
func (m *Manager) CleanZombieState() (bool, error) {
	cleaned := false
	_, err := m.Update(func(s *State) (bool, error) {
		if s.CurrentStatus != StatusPolishing {
			return false, nil
		}
		if s.PID > 0 && isProcessAlive(s.PID) {
			return false, nil
		}
		// The foreground hook records state before the child PID is available.
		// Give that handoff (and a recently exited process) a grace period.
		if s.StartedAt > 0 && time.Now().Unix()-s.StartedAt < 120 {
			return false, nil
		}
		cleaned = true
		s.CurrentStatus = StatusFailed
		s.OperationID = ""
		s.PID = 0
		s.LastError = &OperationError{
			Code:       "daemon_stopped",
			Category:   "runtime",
			Message:    "The background polisher stopped before completing. The commit was left unchanged.",
			Retryable:  true,
			OccurredAt: time.Now().Unix(),
		}
		return true, nil
	})
	return cleaned, err
}

func (m *Manager) migrateLegacyState() error {
	if canonicalPath(m.legacyDir) == canonicalPath(m.stateDir) {
		return nil
	}
	legacyInfo, err := os.Lstat(m.legacyDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if !legacyInfo.IsDir() || legacyInfo.Mode()&os.ModeSymlink != 0 {
		return nil
	}
	legacyState := filepath.Join(m.legacyDir, "state.json")
	if _, destinationErr := os.Stat(m.StatePath()); os.IsNotExist(destinationErr) {
		if data, readErr := readRegularFile(legacyState, maxStateFileBytes); readErr == nil {
			var legacy State
			if json.Unmarshal(data, &legacy) == nil {
				if writeErr := writeAtomic(m.StatePath(), data, 0o600); writeErr != nil {
					return fmt.Errorf("migrate legacy state: %w", writeErr)
				}
				_ = os.Remove(legacyState)
			}
		}
	} else if destinationErr == nil {
		// A newer external snapshot wins. Remove only a valid regular legacy
		// state file so an unexpected symlink or user file is never touched.
		if _, readErr := readRegularFile(legacyState, maxStateFileBytes); readErr == nil {
			_ = os.Remove(legacyState)
		}
	}

	legacyLogs := filepath.Join(m.legacyDir, "logs")
	entries, err := os.ReadDir(legacyLogs)
	if err == nil {
		for _, entry := range entries {
			if entry.IsDir() || entry.Type()&os.ModeSymlink != 0 {
				continue
			}
			src := filepath.Join(legacyLogs, entry.Name())
			dst := filepath.Join(m.LogDir(), entry.Name())
			if _, statErr := os.Stat(dst); statErr == nil {
				continue
			}
			data, readErr := readRegularFile(src, maxLegacyLogBytes)
			if readErr != nil {
				continue
			}
			if writeErr := writeAtomic(dst, data, 0o600); writeErr != nil {
				return fmt.Errorf("migrate legacy log %s: %w", entry.Name(), writeErr)
			}
			_ = os.Remove(src)
		}
	}

	// Remove only files/directories owned by git-ai. Never recursively delete a
	// broad or unresolved path.
	_ = os.Remove(filepath.Join(m.legacyDir, "state.lock"))
	_ = os.Remove(legacyLogs)
	_ = os.Remove(m.legacyDir)
	return nil
}

func readRegularFile(path string, maxBytes int64) ([]byte, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
		return nil, errors.New("application data path is not a regular file")
	}
	if info.Size() > maxBytes {
		return nil, errors.New("application data file exceeded the safety limit")
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer func() { _ = file.Close() }()
	openedInfo, err := file.Stat()
	if err != nil || !openedInfo.Mode().IsRegular() || !os.SameFile(info, openedInfo) {
		return nil, errors.New("application data file changed while opening")
	}
	data, err := io.ReadAll(io.LimitReader(file, maxBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > maxBytes {
		return nil, errors.New("application data file exceeded the safety limit")
	}
	return data, nil
}

func isProcessAlive(pid int) bool {
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	return process.Signal(syscall.Signal(0)) == nil
}
