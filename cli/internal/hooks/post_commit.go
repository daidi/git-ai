// Package hooks implements the post-commit and pre-push hook logic.
package hooks

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/daidi/git-ai/internal/ai"
	"github.com/daidi/git-ai/internal/config"
	"github.com/daidi/git-ai/internal/daemon"
	"github.com/daidi/git-ai/internal/git"
	"github.com/daidi/git-ai/internal/i18n"
	"github.com/daidi/git-ai/internal/notify"
	"github.com/daidi/git-ai/internal/state"
)

// RunPostCommit is called by the post-commit hook.
// If isDaemon is false, it forks a background daemon and exits.
// If isDaemon is true, it runs the actual polishing logic.
func RunPostCommit(isDaemon bool) error {
	// Guard: skip if this is an internal amend or explicitly bypassed.
	if os.Getenv("GIT_AI_INTERNAL") == "true" || os.Getenv("GIT_AI_SKIP") == "true" {
		return nil
	}

	gitDir, err := git.GetGitDir()
	if err != nil {
		return fmt.Errorf("not in a git repo: %w", err)
	}

	mgr := state.NewManager(gitDir)

	if !isDaemon {
		// Check for skip flag
		if s, err := mgr.Load(); err == nil && s.SkipNext {
			s.SkipNext = false
			_ = mgr.Save(s)
			return nil
		}

		// Fork a daemon and exit immediately so the commit doesn't block.
		binary, err := daemon.FindBinary()
		if err != nil {
			return err
		}
		_ = mgr.EnsureDir()

		pid, err := daemon.StartBackground(binary, []string{"hook", "post-commit", "--daemon"}, mgr.LogDir())
		if err != nil {
			return fmt.Errorf("start daemon: %w", err)
		}
		fmt.Print(i18n.Sprintf("hook.forked", pid))
		return nil
	}

	// === Daemon mode: run the polishing logic ===
	startTime := time.Now()
	logger := log.New(os.Stdout, "[git-ai] ", log.LstdFlags)
	logger.Println("daemon started")

	// Load config.
	repoRoot, _ := git.GetRepoRoot()
	cfg, err := config.Load(repoRoot)
	if err != nil {
		logger.Printf("config error: %v", err)
		return err
	}

	// Initialize i18n in daemon process.
	i18n.Init(cfg.UILanguage)

	// Acquire lock.
	if err := mgr.Lock(); err != nil {
		logger.Printf("lock error: %v", err)
		return err
	}
	defer func() { _ = mgr.Unlock() }()

	// Read current commit.
	sha, err := git.GetLastCommitSHA()
	if err != nil {
		return err
	}
	origMsg, err := git.GetLastCommitMsg()
	if err != nil {
		return err
	}

	// Save state: polishing (with original message for rollback).
	s := &state.State{
		CurrentStatus: state.StatusPolishing,
		OriginalMsg:   origMsg,
		LastSHA:       sha,
		PID:           os.Getpid(),
		StartedAt:     time.Now().Unix(),
	}
	if err := mgr.Save(s); err != nil {
		return err
	}

	logger.Printf("polishing commit %s: %q", sha[:8], origMsg)

	// Immediately mark the commit with loading icon for visibility.
	tempMsg := "[⏳] " + origMsg
	if err := git.Amend(tempMsg); err != nil {
		logger.Printf("warning: failed to add loading prefix: %v", err)
		// Not fatal - continue with polishing
	} else {
		logger.Printf("added loading prefix to commit message")
	}

	// Register signal handler to rollback on interruption.
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		logger.Printf("interrupted - rolling back to original message")
		if rollbackErr := git.Amend(origMsg); rollbackErr != nil {
			logger.Printf("rollback error: %v", rollbackErr)
		}
		_ = mgr.Reset()
		os.Exit(1)
	}()

	// Get diff.
	diff, err := git.GetDiff(sha)
	if err != nil {
		logger.Printf("diff error (using stat): %v", err)
		diff, _ = git.GetDiffStat(sha)
	}

	// Call AI.
	polished, err := ai.PolishWithLogger(diff, origMsg, cfg, logger)
	if err != nil {
		logger.Printf("AI error: %v", err)
		notify.Send("Git AI", i18n.Sprintf("hook.ai_failed", err))
		// Rollback: restore original message to avoid leaving [⏳] prefix.
		if rollbackErr := git.Amend(origMsg); rollbackErr != nil {
			logger.Printf("rollback error: %v", rollbackErr)
		} else {
			logger.Printf("rolled back to original message")
		}
		// Reset state so we don't block future operations.
		_ = mgr.Reset()
		return err
	}

	logger.Printf("polished message: %q", polished)

	// Amend the commit with polished message.
	if err := git.Amend(polished); err != nil {
		logger.Printf("amend error: %v", err)
		notify.Send("Git AI", i18n.Sprintf("hook.amend_failed", err))
		// Rollback: restore original message.
		if rollbackErr := git.Amend(origMsg); rollbackErr != nil {
			logger.Printf("rollback error: %v", rollbackErr)
		} else {
			logger.Printf("rolled back to original message")
		}
		_ = mgr.Reset()
		return err
	}

	notify.Send("Git AI", i18n.Sprintf("hook.polished", truncate(polished, 60)))

	// Check for pending push.
	s, _ = mgr.Load()
	if s.PendingPush != nil {
		logger.Printf("executing pending push to %s", s.PendingPush.Remote)

		s.CurrentStatus = state.StatusPushing
		_ = mgr.Save(s)

		if err := git.Push(s.PendingPush.Remote, s.PendingPush.RefSpecs); err != nil {
			logger.Printf("push error: %v", err)
			notify.Send("Git AI", i18n.Sprintf("hook.push_failed", err))
		} else {
			notify.Send("Git AI", i18n.Sprintf("hook.pushed", s.PendingPush.Remote))
		}
	}

	// Reset to idle.
	_ = mgr.Save(&state.State{
		CurrentStatus: state.StatusIdle,
		OriginalMsg:   origMsg,
		LastSHA:       sha,
	})

	logger.Printf("done (elapsed: %v)", time.Since(startTime))
	return nil
}

// truncate shortens a string to max length with ellipsis.
func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
