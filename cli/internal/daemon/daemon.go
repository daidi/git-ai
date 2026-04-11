// Package daemon provides platform-specific background process spawning.
package daemon

import (
	"fmt"
	"os"
)

// StartBackground spawns the polishing daemon as a fully detached background process.
// The implementation is platform-specific (see daemon_unix.go and daemon_windows.go).
// Returns the child process PID.
func StartBackground(gitAiBinary string, args []string, logDir string) (int, error) {
	return startBackground(gitAiBinary, args, logDir)
}

// FindBinary finds the git-ai binary path.
func FindBinary() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("cannot find git-ai binary: %w", err)
	}
	return exe, nil
}
