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
	"sync"
	"syscall"
	"time"

	"github.com/gofrs/flock"
)

const (
	StatusIdle      = "idle"
	StatusPolishing = "polishing"
	StatusPushing   = "pushing"
	StatusFailed    = "failed"
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
	Remote  string       `json:"remote"`
	Updates []PushUpdate `json:"updates,omitempty"`
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
	data, err := os.ReadFile(m.StatePath())
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
	legacyState := filepath.Join(m.legacyDir, "state.json")
	if _, err := os.Stat(m.StatePath()); os.IsNotExist(err) {
		if data, readErr := os.ReadFile(legacyState); readErr == nil {
			if writeErr := writeAtomic(m.StatePath(), data, 0o600); writeErr != nil {
				return fmt.Errorf("migrate legacy state: %w", writeErr)
			}
		}
	}

	legacyLogs := filepath.Join(m.legacyDir, "logs")
	entries, err := os.ReadDir(legacyLogs)
	if err == nil {
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			src := filepath.Join(legacyLogs, entry.Name())
			dst := filepath.Join(m.LogDir(), entry.Name())
			if _, statErr := os.Stat(dst); statErr == nil {
				continue
			}
			if renameErr := os.Rename(src, dst); renameErr != nil {
				if copyErr := copyFile(src, dst); copyErr != nil {
					return fmt.Errorf("migrate legacy log %s: %w", entry.Name(), copyErr)
				}
				_ = os.Remove(src)
			}
		}
	}

	// Remove only files/directories owned by git-ai. Never recursively delete a
	// broad or unresolved path.
	_ = os.Remove(legacyState)
	_ = os.Remove(filepath.Join(m.legacyDir, "state.lock"))
	_ = os.Remove(legacyLogs)
	_ = os.Remove(m.legacyDir)
	return nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer func() { _ = in.Close() }()
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		_ = out.Close()
		_ = os.Remove(dst)
		return err
	}
	return out.Close()
}

func isProcessAlive(pid int) bool {
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	return process.Signal(syscall.Signal(0)) == nil
}
