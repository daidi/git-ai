// Package hooks implements the post-commit and pre-push hook logic.
package hooks

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/daidi/git-ai/internal/ai"
	"github.com/daidi/git-ai/internal/config"
	"github.com/daidi/git-ai/internal/daemon"
	"github.com/daidi/git-ai/internal/git"
	"github.com/daidi/git-ai/internal/notify"
	"github.com/daidi/git-ai/internal/state"
)

// RunPostCommit is called by the post-commit hook.
// If isDaemon is false, it forks a background daemon and exits.
// If isDaemon is true, it runs the actual polishing logic.
func RunPostCommit(isDaemon bool) error {
	// Guard: skip if this is an internal amend.
	if os.Getenv("GIT_AI_INTERNAL") == "true" {
		return nil
	}

	gitDir, err := git.GetGitDir()
	if err != nil {
		return fmt.Errorf("not in a git repo: %w", err)
	}

	mgr := state.NewManager(gitDir)

	if !isDaemon {
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
		fmt.Printf("✨ git-ai: polishing in background (PID %d)\n", pid)
		return nil
	}

	// === Daemon mode: run the polishing logic ===
	logger := log.New(os.Stdout, "[git-ai] ", log.LstdFlags)
	logger.Println("daemon started")

	// Load config.
	repoRoot, _ := git.GetRepoRoot()
	cfg, err := config.Load(repoRoot)
	if err != nil {
		logger.Printf("config error: %v", err)
		return err
	}

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

	// Save state: polishing.
	s := &state.State{
		CurrentStatus: state.StatusPolishing,
		OriginalMsg:   origMsg,
		LastSHA:       sha,
		PID:           os.Getpid(),
	}
	if err := mgr.Save(s); err != nil {
		return err
	}

	logger.Printf("polishing commit %s: %q", sha[:8], origMsg)

	// Get diff.
	diff, err := git.GetDiff(sha)
	if err != nil {
		logger.Printf("diff error (using stat): %v", err)
		diff, _ = git.GetDiffStat(sha)
	}

	// Call AI.
	polished, err := ai.Polish(diff, origMsg, cfg)
	if err != nil {
		logger.Printf("AI error: %v", err)
		notify.Send("⚠️ git-ai", fmt.Sprintf("AI polishing failed: %v", err))
		// Reset state so we don't block future operations.
		_ = mgr.Reset()
		return err
	}

	logger.Printf("polished message: %q", polished)

	// Amend the commit.
	if err := git.Amend(polished); err != nil {
		logger.Printf("amend error: %v", err)
		notify.Send("⚠️ git-ai", fmt.Sprintf("Amend failed: %v", err))
		_ = mgr.Reset()
		return err
	}

	notify.Send("✨ git-ai", fmt.Sprintf("Commit polished: %s", truncate(polished, 60)))

	// Check for pending push.
	s, _ = mgr.Load()
	if s.PendingPush != nil {
		logger.Printf("executing pending push to %s", s.PendingPush.Remote)

		s.CurrentStatus = state.StatusPushing
		_ = mgr.Save(s)

		if err := git.Push(s.PendingPush.Remote, s.PendingPush.RefSpecs); err != nil {
			logger.Printf("push error: %v", err)
			notify.Send("❌ git-ai", fmt.Sprintf("Push failed: %v", err))
		} else {
			notify.Send("🚀 git-ai", fmt.Sprintf("Pushed to %s", s.PendingPush.Remote))
		}
	}

	// Reset to idle.
	_ = mgr.Save(&state.State{
		CurrentStatus: state.StatusIdle,
		OriginalMsg:   origMsg,
		LastSHA:       sha,
	})

	logger.Printf("done (elapsed: %v)", time.Since(time.Now()))
	return nil
}

// truncate shortens a string to max length with ellipsis.
func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
