//go:build windows

package daemon

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
)

// DETACHED_PROCESS creation flag for Windows.
const _DETACHED_PROCESS = 0x00000008

// startBackground on Windows uses CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS
// to spawn a background process without a console window.
func startBackground(gitAiBinary string, args []string, logDir string) (int, error) {
	logFile := filepath.Join(logDir, fmt.Sprintf("%d.log", time.Now().UnixNano()))
	f, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return 0, fmt.Errorf("open log file: %w", err)
	}
	defer func() { _ = f.Close() }()

	wd, err := os.Getwd()
	if err != nil {
		return 0, fmt.Errorf("resolve repository working directory: %w", err)
	}
	cmd := exec.Command(gitAiBinary, args...)
	cmd.Dir = wd
	cmd.Env = SanitizedEnv()
	cmd.Stdout = f
	cmd.Stderr = f
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP | _DETACHED_PROCESS,
	}

	if err := cmd.Start(); err != nil {
		return 0, fmt.Errorf("start daemon: %w", err)
	}

	pid := cmd.Process.Pid
	// Release — we don't wait for it.
	_ = cmd.Process.Release()

	return pid, nil
}
