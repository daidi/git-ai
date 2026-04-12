// Package state manages the per-repo runtime state stored in .git/git-ai/state.json.
// All operations are protected by a file lock for cross-process safety.
package state

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"syscall"
	"time"

	"github.com/gofrs/flock"
)

const (
	StatusIdle      = "idle"
	StatusPolishing = "polishing"
	StatusPushing   = "pushing"
)

// State represents the runtime state of git-ai for a repository.
type State struct {
	CurrentStatus string       `json:"current_status"`
	OriginalMsg   string       `json:"original_msg,omitempty"`
	LastSHA       string       `json:"last_sha,omitempty"`
	PendingPush   *PendingPush `json:"pending_push,omitempty"`
	PID           int          `json:"pid,omitempty"`
	StartedAt     int64        `json:"started_at,omitempty"` // Unix timestamp when polishing started
	SkipNext      bool         `json:"skip_next,omitempty"`  // Whether to bypass git-ai on next hook trigger
}

// PendingPush holds deferred push details captured from pre-push stdin.
type PendingPush struct {
	Remote    string   `json:"remote"`
	RefSpecs  []string `json:"ref_specs"`
	Timestamp int64    `json:"timestamp"`
}

// Manager handles state file operations with file locking.
type Manager struct {
	stateDir string
	fileLock *flock.Flock
}

// NewManager creates a new state manager for the given git directory.
func NewManager(gitDir string) *Manager {
	dir := filepath.Join(gitDir, "git-ai")
	return &Manager{
		stateDir: dir,
		fileLock: flock.New(filepath.Join(dir, "state.lock")),
	}
}

// StateDir returns the git-ai state directory path.
func (m *Manager) StateDir() string {
	return m.stateDir
}

// LogDir returns the log directory path.
func (m *Manager) LogDir() string {
	return filepath.Join(m.stateDir, "logs")
}

// statePath returns the path to state.json.
func (m *Manager) statePath() string {
	return filepath.Join(m.stateDir, "state.json")
}

// EnsureDir creates the state and log directories if they don't exist.
func (m *Manager) EnsureDir() error {
	if err := os.MkdirAll(m.stateDir, 0o755); err != nil {
		return fmt.Errorf("create state dir: %w", err)
	}
	if err := os.MkdirAll(m.LogDir(), 0o755); err != nil {
		return fmt.Errorf("create log dir: %w", err)
	}
	return nil
}

// Load reads the current state. Returns a default idle state if the file doesn't exist.
func (m *Manager) Load() (*State, error) {
	data, err := os.ReadFile(m.statePath())
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
	return &s, nil
}

// Save writes the state to disk.
func (m *Manager) Save(s *State) error {
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal state: %w", err)
	}
	return os.WriteFile(m.statePath(), data, 0o644)
}

// Lock acquires the file lock with timeout.
func (m *Manager) Lock() error {
	locked, err := m.fileLock.TryLockContext(context.Background(), 100*time.Millisecond)
	if err != nil {
		return fmt.Errorf("acquire lock: %w", err)
	}
	if !locked {
		// Check for stale lock by verifying PID.
		s, _ := m.Load()
		if s != nil && s.PID > 0 && !isProcessAlive(s.PID) {
			// Stale lock — reclaim.
			_ = m.fileLock.Unlock()
			locked, err = m.fileLock.TryLock()
			if err != nil || !locked {
				return fmt.Errorf("failed to reclaim stale lock")
			}
			return nil
		}
		return fmt.Errorf("another git-ai process is running (PID %d)", s.PID)
	}
	return nil
}

// Unlock releases the file lock.
func (m *Manager) Unlock() error {
	return m.fileLock.Unlock()
}

// WithLock executes fn while holding the file lock.
func (m *Manager) WithLock(fn func() error) error {
	if err := m.Lock(); err != nil {
		return err
	}
	defer func() { _ = m.Unlock() }()
	return fn()
}

// Reset sets the state back to idle.
func (m *Manager) Reset() error {
	return m.Save(&State{CurrentStatus: StatusIdle})
}

// CleanZombieState checks for stale polishing state and recovers if needed.
// Returns true if cleanup was performed.
func (m *Manager) CleanZombieState() (bool, error) {
	s, err := m.Load()
	if err != nil {
		return false, err
	}

	// Only clean up if status is polishing.
	if s.CurrentStatus != StatusPolishing {
		return false, nil
	}

	// Check if the process is still alive.
	if s.PID > 0 && isProcessAlive(s.PID) {
		// Check for timeout (60 seconds).
		if s.StartedAt > 0 {
			elapsed := time.Now().Unix() - s.StartedAt
			if elapsed < 60 {
				// Process is alive and not timed out - not a zombie.
				return false, nil
			}
		} else {
			// No timestamp - not a zombie (yet).
			return false, nil
		}
	}

	// This is a zombie state - reset to idle.
	// Note: We can't rollback the commit message here since we don't have git access.
	// The actual rollback should be done by the recover command.
	if err := m.Reset(); err != nil {
		return false, fmt.Errorf("reset zombie state: %w", err)
	}

	return true, nil
}

// isProcessAlive checks whether a process with the given PID is still running.
func isProcessAlive(pid int) bool {
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	err = process.Signal(syscall.Signal(0))
	return err == nil
}
