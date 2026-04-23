// Package hooks implements the post-commit and pre-push hook logic.
package hooks

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/daidi/git-ai/internal/ai"
	"github.com/daidi/git-ai/internal/config"
	"github.com/daidi/git-ai/internal/daemon"
	"github.com/daidi/git-ai/internal/git"
	"github.com/daidi/git-ai/internal/i18n"
	"github.com/daidi/git-ai/internal/notify"
	"github.com/daidi/git-ai/internal/state"
	"github.com/daidi/git-ai/internal/telemetry"
)

// RunPostCommit is called by the post-commit hook.
// If isDaemon is false, it forks a background daemon and exits.
// If isDaemon is true, it runs the actual polishing logic.
func RunPostCommit(isDaemon bool) error {
	// Guard: skip if this is an internal amend or explicitly bypassed.
	if os.Getenv("GIT_AI_INTERNAL") == "true" || os.Getenv("GIT_AI_SKIP") == "true" {
		return nil
	}

	// Guard: skip if we are in the middle of a rebase, merge, or other special state.
	// We don't want to asynchronously amend commits while Git is manipulating history.
	if git.IsRebaseOrMergeInProgress() {
		return nil
	}

	// Guard: skip if this commit is a merge commit (has multiple parents).
	if isMerge, err := git.IsMergeCommit(); err == nil && isMerge {
		return nil
	}

	gitDir, err := git.GetGitDir()
	if err != nil {
		return fmt.Errorf("not in a git repo: %w", err)
	}

	mgr := state.NewManager(gitDir)

	if !isDaemon {
		return runForeground(mgr)
	}

	return runDaemon(mgr)
}

func runForeground(mgr *state.Manager) error {
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

func runDaemon(mgr *state.Manager) error {
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
	if err := savePolishingState(mgr, sha, origMsg); err != nil {
		return err
	}
	logger.Printf("polishing commit %s: %q", sha[:8], origMsg)

	setupInterruptHandler(logger, mgr, origMsg)
	markLoadingPrefix(logger, origMsg)

	// Call AI.
	polished, err := polishCommit(mgr, logger, cfg, sha, origMsg, repoRoot)
	if err != nil {
		return err
	}

	// Amend the commit with polished message.
	if err := applyPolishedMessage(mgr, logger, origMsg, polished, cfg, startTime, repoRoot); err != nil {
		return err
	}

	pushErr := handlePendingPush(mgr, logger)

	// Reset to idle, preserving any push error for IDE display.
	_ = mgr.Save(&state.State{
		CurrentStatus: state.StatusIdle,
		OriginalMsg:   origMsg,
		LastSHA:       sha,
		LastError:     pushErr,
	})

	logger.Printf("done (elapsed: %v)", time.Since(startTime))
	return nil
}

func savePolishingState(mgr *state.Manager, sha, origMsg string) error {
	s := &state.State{
		CurrentStatus: state.StatusPolishing,
		OriginalMsg:   origMsg,
		LastSHA:       sha,
		PID:           os.Getpid(),
		StartedAt:     time.Now().Unix(),
	}
	return mgr.Save(s)
}

func setupInterruptHandler(logger *log.Logger, mgr *state.Manager, origMsg string) {
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
}

func markLoadingPrefix(logger *log.Logger, origMsg string) {
	// Immediately mark the commit with loading icon for visibility.
	tempMsg := "[⏳] " + origMsg
	if err := git.Amend(tempMsg); err != nil {
		logger.Printf("warning: failed to add loading prefix: %v", err)
		// Not fatal - continue with polishing
	} else {
		logger.Printf("added loading prefix to commit message")
	}
}

func polishCommit(mgr *state.Manager, logger *log.Logger, cfg *config.Config, sha, origMsg, repoRoot string) (string, error) {
	// Get diff.
	diff, err := git.GetDiff(sha)
	if err != nil {
		logger.Printf("diff error (using stat): %v", err)
		diff, _ = git.GetDiffStat(sha)
	}

	polished, err := ai.PolishWithLogger(diff, origMsg, repoRoot, cfg, logger)
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
		return "", err
	}

	return polished, nil
}

func applyPolishedMessage(mgr *state.Manager, logger *log.Logger, origMsg, polished string, cfg *config.Config, startTime time.Time, repoRoot string) error {
	logger.Printf("polished message: %q", polished)

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

	// Calculate telemetry metrics
	timeTaken := time.Since(startTime)

	// Add JSON git note
	noteJSON := fmt.Sprintf(`{"model":%q, "generation_time_ms":%d, "original_message":%q, "estimated_time_saved_s":120}`,
		cfg.Model, timeTaken.Milliseconds(), origMsg)

	// We need HEAD's new SHA to add the note, since Amend changed it
	newSha, _ := git.GetLastCommitSHA()
	if newSha != "" {
		if err := git.AddNotes(newSha, noteJSON); err != nil {
			logger.Printf("warning: failed to add git note: %v", err)
		} else {
			logger.Printf("added git note with telemetry")
		}
	}

	record := telemetry.Record{
		Repo:                repoRoot,
		Model:               cfg.Model,
		TimeWaitedMs:        timeTaken.Milliseconds(),
		OriginalMsgLen:      len(origMsg),
		NewMsgLen:           len(polished),
		EstimatedTimeSavedS: 120,
	}
	if err := telemetry.SaveRecord(record); err != nil {
		logger.Printf("warning: failed to save telemetry: %v", err)
	}

	notify.Send("Git AI", i18n.Sprintf("hook.polished", truncate(polished, 60)))
	return nil
}

func handlePendingPush(mgr *state.Manager, logger *log.Logger) *state.ErrorInfo {
	// Check for pending push.
	s, _ := mgr.Load()
	if s.PendingPush == nil {
		return nil
	}

	logger.Printf("executing pending push to %s", s.PendingPush.Remote)

	// Pre-check: can we push without interactive prompts?
	if ok, reason := git.CanPushSilently(s.PendingPush.Remote); !ok {
		logger.Printf("skipping background push: %s", reason)
		errInfo := &state.ErrorInfo{
			Code:    "push_no_credentials",
			Message: reason,
			FixHint: git.CredentialHelperHint(),
		}
		notify.Send("Git AI", reason)
		return errInfo
	}

	s.CurrentStatus = state.StatusPushing
	_ = mgr.Save(s)

	if err := git.Push(s.PendingPush.Remote, s.PendingPush.RefSpecs); err != nil {
		logger.Printf("push error: %v", err)
		errInfo := classifyPushError(err, s.PendingPush.Remote)
		notify.Send("Git AI", errInfo.Message)
		return errInfo
	}

	notify.Send("Git AI", i18n.Sprintf("hook.pushed", s.PendingPush.Remote))
	return nil
}

// classifyPushError analyzes a push error and returns a user-friendly ErrorInfo
// with actionable fix hints for IDE plugins to display.
func classifyPushError(err error, remote string) *state.ErrorInfo {
	errStr := err.Error()
	if strings.Contains(errStr, "terminal prompts disabled") ||
		strings.Contains(errStr, "could not read Username") ||
		strings.Contains(errStr, "could not read Password") ||
		strings.Contains(errStr, "Authentication failed") {
		if git.IsSSHRemote(remote) {
			return &state.ErrorInfo{
				Code:    "push_ssh_auth",
				Message: i18n.T("push_err.ssh_auth"),
				FixHint: "ssh-add",
			}
		}
		return &state.ErrorInfo{
			Code:    "push_https_auth",
			Message: i18n.T("push_err.https_auth"),
			FixHint: credentialFixHint(),
		}
	}
	return &state.ErrorInfo{
		Code:    "push_failed",
		Message: fmt.Sprintf(i18n.T("push_err.generic"), err),
	}
}

// credentialFixHint returns a platform-specific command to fix HTTPS credentials.
func credentialFixHint() string {
	return git.CredentialHelperHint() + " && git push"
}

// truncate shortens a string to max length with ellipsis.
func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
