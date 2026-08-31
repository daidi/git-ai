// Package hooks implements the post-commit and pre-push hook logic.
package hooks

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
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

// RunPostCommit is called by the post-commit hook. Foreground execution records
// the exact target commit before returning; daemon execution only operates on
// that recorded target and operation id.
func RunPostCommit(isDaemon bool, operationID string) error {
	if os.Getenv("GIT_AI_INTERNAL") == "true" || os.Getenv("GIT_AI_SKIP") == "true" {
		return nil
	}
	if git.IsRebaseOrMergeInProgress() {
		return nil
	}
	if isMerge, err := git.IsMergeCommit(); err == nil && isMerge {
		return nil
	}

	gitDir, err := git.GetGitDir()
	if err != nil {
		return fmt.Errorf("not in a git repo: %w", err)
	}
	mgr := state.NewManager(gitDir)
	if err := mgr.EnsureDir(); err != nil {
		return err
	}
	if isDaemon {
		return runDaemon(mgr, operationID)
	}
	return runForeground(mgr, "", true)
}

// StartRetry starts a fresh safe background operation for the current commit.
func StartRetry() error {
	gitDir, err := git.GetGitDir()
	if err != nil {
		return err
	}
	mgr := state.NewManager(gitDir)
	if err := mgr.EnsureDir(); err != nil {
		return err
	}
	s, err := mgr.Load()
	if err != nil {
		return err
	}
	if s.CurrentStatus == state.StatusPolishing {
		return errors.New("a polishing operation is already running")
	}
	original := ""
	if head, headErr := git.GetLastCommitSHA(); headErr == nil && (head == s.LastSHA || head == s.ResultSHA) {
		original = s.OriginalMsg
	}
	return runForeground(mgr, original, false)
}

func runForeground(mgr *state.Manager, originalOverride string, consumeSkip bool) error {
	if consumeSkip {
		skipped := false
		if _, err := mgr.Update(func(s *state.State) (bool, error) {
			if !s.SkipNext {
				return false, nil
			}
			s.SkipNext = false
			skipped = true
			return true, nil
		}); err != nil {
			return err
		}
		if skipped {
			return nil
		}
	}

	sha, err := git.GetLastCommitSHA()
	if err != nil {
		return err
	}
	targetRef, err := git.GetHeadRef()
	if err != nil {
		return err
	}
	origMsg, err := git.GetCommitMsg(sha)
	if err != nil {
		return err
	}
	if originalOverride != "" {
		origMsg = originalOverride
	}
	operationID, err := newOperationID()
	if err != nil {
		return err
	}

	if _, err := mgr.Update(func(s *state.State) (bool, error) {
		pending := s.PendingPush
		revision := s.Revision
		*s = state.State{
			CurrentStatus: state.StatusPolishing,
			OriginalMsg:   origMsg,
			LastSHA:       sha,
			TargetRef:     targetRef,
			OperationID:   operationID,
			PendingPush:   pending,
			StartedAt:     time.Now().Unix(),
			Revision:      revision,
		}
		return true, nil
	}); err != nil {
		return fmt.Errorf("record polishing operation: %w", err)
	}

	binary, err := daemon.FindBinary()
	if err != nil {
		markOperationFailure(mgr, operationID, state.OperationError{
			Code: "binary_missing", Category: "runtime", Message: "The Git AI background executable could not be started. The commit was left unchanged.", OccurredAt: time.Now().Unix(),
		})
		return err
	}
	pid, err := daemon.StartBackground(binary, []string{"hook", "post-commit", "--daemon", "--operation-id", operationID}, mgr.LogDir())
	if err != nil {
		markOperationFailure(mgr, operationID, state.OperationError{
			Code: "daemon_start_failed", Category: "runtime", Message: "The Git AI background process could not start. The commit was left unchanged.", Retryable: true, OccurredAt: time.Now().Unix(),
		})
		return fmt.Errorf("start daemon: %w", err)
	}
	_, _ = mgr.Update(func(s *state.State) (bool, error) {
		if s.OperationID != operationID || s.CurrentStatus != state.StatusPolishing {
			return false, nil
		}
		s.PID = pid
		return true, nil
	})
	fmt.Print(i18n.Sprintf("hook.forked", pid))
	return nil
}

func runDaemon(mgr *state.Manager, operationID string) error {
	if operationID == "" {
		return errors.New("daemon operation id is required")
	}
	startTime := time.Now()
	logger := log.New(os.Stdout, "[git-ai] ", log.LstdFlags)
	logger.Printf("daemon started operation=%s", operationID)

	snapshot, err := mgr.Update(func(s *state.State) (bool, error) {
		if s.OperationID != operationID || s.CurrentStatus != state.StatusPolishing {
			return false, nil
		}
		s.PID = os.Getpid()
		return true, nil
	})
	if err != nil {
		return err
	}
	if snapshot.OperationID != operationID || snapshot.CurrentStatus != state.StatusPolishing {
		logger.Println("operation superseded before daemon startup")
		return nil
	}

	repoRoot, _ := git.GetRepoRoot()
	cfg, err := config.Load(repoRoot)
	if err != nil {
		markOperationFailure(mgr, operationID, state.OperationError{Code: "config_invalid", Category: "config", Message: "Git AI configuration could not be loaded. The commit was left unchanged.", OccurredAt: time.Now().Unix()})
		return err
	}
	i18n.Init(cfg.UILanguage)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	diff, err := git.GetDiff(snapshot.LastSHA)
	if err != nil {
		logger.Printf("full diff unavailable; falling back to stat")
		diff, err = git.GetDiffStat(snapshot.LastSHA)
		if err != nil {
			markOperationFailure(mgr, operationID, state.OperationError{Code: "diff_unavailable", Category: "git", Message: "The target commit diff could not be read. The commit was left unchanged.", Retryable: true, OccurredAt: time.Now().Unix()})
			return err
		}
	}

	polished, err := ai.PolishWithLoggerContext(ctx, diff, snapshot.OriginalMsg, repoRoot, cfg, logger)
	if err != nil {
		failure := ai.DescribeError(err)
		markOperationFailure(mgr, operationID, state.OperationError{Code: failure.Code, Category: failure.Category, Message: failure.Message, Retryable: failure.Retryable, OccurredAt: time.Now().Unix()})
		logger.Printf("polishing failed category=%s retryable=%t", failure.Category, failure.Retryable)
		notify.Send("Git AI", failure.Message)
		return err
	}

	newSHA, err := applyPolishedMessage(mgr, operationID, polished)
	if err != nil {
		if errors.Is(err, git.ErrRefMoved) {
			failure := state.OperationError{Code: "target_moved", Category: "superseded", Message: "A newer commit or branch change was detected. Git AI left all commits and workspace files unchanged.", OccurredAt: time.Now().Unix()}
			markOperationFailure(mgr, operationID, failure)
			logger.Println("target ref moved; safe no-op")
			return nil
		}
		if errors.Is(err, git.ErrSignedCommit) {
			failure := state.OperationError{Code: "signed_commit", Category: "git", Message: "The commit is signed, so Git AI did not rewrite it or invalidate its signature.", OccurredAt: time.Now().Unix()}
			markOperationFailure(mgr, operationID, failure)
			notify.Send("Git AI", failure.Message)
			return nil
		}
		markOperationFailure(mgr, operationID, state.OperationError{Code: "rewrite_failed", Category: "git", Message: "The polished commit could not be installed. The original commit and workspace were left unchanged.", Retryable: true, OccurredAt: time.Now().Unix()})
		return err
	}

	timeTaken := time.Since(startTime)
	record := telemetry.Record{Repo: repoRoot, Model: cfg.Model, TimeWaitedMs: timeTaken.Milliseconds(), OriginalMsgLen: len(snapshot.OriginalMsg), NewMsgLen: len(polished), EstimatedTimeSavedS: 120}
	if err := telemetry.SaveRecord(record); err != nil {
		logger.Printf("telemetry save skipped: %v", err)
	}
	notify.Send("Git AI", i18n.Sprintf("hook.polished", truncate(polished, 60)))
	handlePendingPush(mgr, logger, newSHA)
	logger.Printf("done target=%s result=%s elapsed=%v", shortSHA(snapshot.LastSHA), shortSHA(newSHA), timeTaken)
	return nil
}

func applyPolishedMessage(mgr *state.Manager, operationID, polished string) (string, error) {
	var newSHA string
	_, err := mgr.Update(func(s *state.State) (bool, error) {
		if s.OperationID != operationID || s.CurrentStatus != state.StatusPolishing {
			return false, nil
		}
		created, rewriteErr := git.RewriteCommitMessageCAS(s.TargetRef, s.LastSHA, polished)
		if rewriteErr != nil {
			return false, rewriteErr
		}
		newSHA = created
		s.CurrentStatus = state.StatusIdle
		s.ResultSHA = created
		s.OperationID = ""
		s.PID = 0
		s.StartedAt = 0
		s.LastError = nil
		return true, nil
	})
	if err != nil {
		return "", err
	}
	if newSHA == "" {
		return "", git.ErrRefMoved
	}
	return newSHA, nil
}

func markOperationFailure(mgr *state.Manager, operationID string, failure state.OperationError) {
	_, _ = mgr.Update(func(s *state.State) (bool, error) {
		if s.OperationID != operationID {
			return false, nil
		}
		s.CurrentStatus = state.StatusFailed
		s.OperationID = ""
		s.PID = 0
		s.StartedAt = 0
		s.LastError = &failure
		return true, nil
	})
}

func handlePendingPush(mgr *state.Manager, logger *log.Logger, resultSHA string) {
	var pending *state.PendingPush
	_, err := mgr.Update(func(s *state.State) (bool, error) {
		if s.ResultSHA != resultSHA || s.CurrentStatus != state.StatusIdle || s.PendingPush == nil {
			return false, nil
		}
		copy := *s.PendingPush
		pending = &copy
		s.CurrentStatus = state.StatusPushing
		return true, nil
	})
	if err != nil || pending == nil {
		return
	}

	if ok, reason := git.CanPushSilently(pending.Remote); !ok {
		markPushFailure(mgr, resultSHA, "push_credentials", reason)
		notify.Send("Git AI", reason)
		return
	}
	refSpecs, err := PendingRefSpecs(pending)
	if err != nil {
		markPushFailure(mgr, resultSHA, "push_not_replayable", "The deferred push could not be replayed safely. Run your original push command again.")
		return
	}
	if err := git.Push(pending.Remote, refSpecs); err != nil {
		logger.Printf("deferred push failed")
		markPushFailure(mgr, resultSHA, "push_failed", "The commit was polished, but the deferred push failed. Your local branch is unchanged; retry the push from the IDE or terminal.")
		notify.Send("Git AI", i18n.Sprintf("hook.push_failed", err))
		return
	}
	_, _ = mgr.Update(func(s *state.State) (bool, error) {
		if s.ResultSHA != resultSHA || s.CurrentStatus != state.StatusPushing {
			return false, nil
		}
		s.CurrentStatus = state.StatusIdle
		s.PendingPush = nil
		s.LastError = nil
		return true, nil
	})
	notify.Send("Git AI", i18n.Sprintf("hook.pushed", pending.Remote))
}

func markPushFailure(mgr *state.Manager, resultSHA, code, message string) {
	_, _ = mgr.Update(func(s *state.State) (bool, error) {
		if s.ResultSHA != resultSHA || s.CurrentStatus != state.StatusPushing {
			return false, nil
		}
		s.CurrentStatus = state.StatusFailed
		s.LastError = &state.OperationError{Code: code, Category: "push", Message: message, Retryable: true, OccurredAt: time.Now().Unix()}
		return true, nil
	})
}

// PendingRefSpecs converts captured pre-push updates to conservative explicit
// refspecs. It never reconstructs force flags or other missing CLI options.
func PendingRefSpecs(pending *state.PendingPush) ([]string, error) {
	if len(pending.Updates) == 0 {
		// Legacy state cannot reliably reconstruct destination refs.
		return nil, errors.New("legacy pending push has no structured ref updates")
	}
	refSpecs := make([]string, 0, len(pending.Updates))
	for _, update := range pending.Updates {
		if update.RemoteRef == "" {
			return nil, errors.New("missing remote ref")
		}
		if isZeroSHA(update.LocalSHA) {
			refSpecs = append(refSpecs, ":"+update.RemoteRef)
			continue
		}
		if update.LocalRef == "" || update.LocalRef == "(delete)" {
			return nil, errors.New("missing local ref")
		}
		refSpecs = append(refSpecs, update.LocalRef+":"+update.RemoteRef)
	}
	return refSpecs, nil
}

func isZeroSHA(sha string) bool { return sha != "" && strings.Trim(sha, "0") == "" }

func newOperationID() (string, error) {
	var bytes [16]byte
	if _, err := rand.Read(bytes[:]); err != nil {
		return "", fmt.Errorf("create operation id: %w", err)
	}
	return hex.EncodeToString(bytes[:]), nil
}

func shortSHA(sha string) string {
	if len(sha) <= 8 {
		return sha
	}
	return sha[:8]
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
