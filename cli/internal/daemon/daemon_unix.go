//go:build !windows

package daemon

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"
	"time"
)

// startBackground on Unix uses Setsid to detach the child from the terminal session.
func startBackground(gitAiBinary string, args []string, logDir string) (int, error) {
	// Create log file.
	logFile := filepath.Join(logDir, fmt.Sprintf("%d.log", time.Now().Unix()))
	f, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return 0, fmt.Errorf("open log file: %w", err)
	}

	wd, _ := os.Getwd()

	// Spawn detached process.
	attr := &os.ProcAttr{
		Dir: wd,
		Env: SanitizedEnv(),
		Files: []*os.File{
			os.Stdin, // stdin  — not used but required
			f,        // stdout → log file
			f,        // stderr → log file
		},
		Sys: &syscall.SysProcAttr{
			Setsid: true, // Create new session — fully detach from terminal.
		},
	}

	fullArgs := append([]string{gitAiBinary}, args...)
	proc, err := os.StartProcess(gitAiBinary, fullArgs, attr)
	if err != nil {
		_ = f.Close()
		return 0, fmt.Errorf("start daemon: %w", err)
	}

	pid := proc.Pid
	// Release the process — we don't wait for it.
	_ = proc.Release()
	_ = f.Close()

	return pid, nil
}
