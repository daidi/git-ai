package hooks

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/daidi/git-ai/cli/internal/config"
	"github.com/daidi/git-ai/cli/internal/git"
	"github.com/daidi/git-ai/cli/internal/i18n"
	"github.com/daidi/git-ai/cli/internal/state"
)

// ErrStopPush identifies the only class of error that a managed pre-push hook
// may propagate to Git. All git-ai operational/configuration failures fail open
// so the plugin cannot strand the user's normal push workflow.
var ErrStopPush = errors.New("git-ai deliberately stopped the push")

const (
	maxPushInputBytes = 1 << 20
	maxPushUpdates    = 4096
)

type stopPushError struct{ message string }

func (e *stopPushError) Error() string        { return e.message }
func (e *stopPushError) Is(target error) bool { return target == ErrStopPush }

// RunPrePush reads Git's pre-push protocol and blocks only updates that include
// the exact commit currently being polished.
func RunPrePush(remote, remoteURL string) error {
	if os.Getenv("GIT_AI_INTERNAL") == "true" || os.Getenv("GIT_AI_SKIP") == "true" {
		return nil
	}
	updates, err := readPushUpdates()
	if err != nil {
		fmt.Fprintln(os.Stderr, "git-ai: pre-push input was unavailable; allowing push unchanged")
		return nil
	}
	if len(updates) == 0 {
		return nil
	}

	gitDir, err := git.GetGitDir()
	if err != nil {
		fmt.Fprintln(os.Stderr, "git-ai: repository state was unavailable; allowing push unchanged")
		return nil
	}
	mgr := state.NewManager(gitDir)
	snapshot, err := mgr.Load()
	if err != nil {
		// A state read failure must not unexpectedly break normal Git usage.
		fmt.Fprintln(os.Stderr, "git-ai: state unavailable; allowing push")
		return nil
	}
	if snapshot.CurrentStatus != state.StatusPolishing || !pushContainsTarget(updates, snapshot) {
		return nil
	}

	repoRoot, _ := git.GetRepoRoot()
	cfg, cfgErr := config.Load(repoRoot)
	if cfgErr != nil {
		if cancelPolishForPush(mgr, snapshot, "configuration was unavailable") {
			fmt.Fprintln(os.Stderr, "git-ai: polishing was canceled because configuration was unavailable; allowing the original push")
			return nil
		}
		return &stopPushError{message: "git-ai could not coordinate safely with the active polish; run 'git-ai cancel' and retry the push"}
	}
	if cfg.PushPolicy == "block" {
		fmt.Print("Git AI is still polishing this commit. The push was not queued; retry it after polishing finishes.\n")
		return &stopPushError{message: "push blocked while commit message is being polished"}
	}

	queued := false
	current, err := mgr.Update(func(s *state.State) (bool, error) {
		if s.CurrentStatus != state.StatusPolishing || !pushContainsTarget(updates, s) {
			return false, nil
		}
		// remoteURL may contain embedded credentials. It is intentionally never
		// persisted; the remote name and structured ref updates are sufficient.
		s.PendingPush = &state.PendingPush{
			Remote: remote, Updates: updates, TargetRef: s.TargetRef,
			TargetSHA: s.LastSHA, Timestamp: time.Now().Unix(),
		}
		queued = true
		return true, nil
	})
	if err != nil {
		if cancelPolishForPush(mgr, snapshot, "the deferred push could not be recorded") {
			fmt.Fprintln(os.Stderr, "git-ai: polishing was canceled because the queue was unavailable; allowing the original push")
			return nil
		}
		return &stopPushError{message: "git-ai could not record or cancel the active polish safely; run 'git-ai cancel' and retry the push"}
	}
	if !queued {
		if current != nil && current.CurrentStatus == state.StatusIdle && current.ResultSHA != "" {
			return &stopPushError{message: "polishing finished while the push was being prepared; retry so Git sends the polished commit"}
		}
		return nil
	}
	fmt.Print(i18n.T("prepush.queued"))
	return &stopPushError{message: "push deferred until commit polishing completes"}
}

func readPushUpdates() ([]state.PushUpdate, error) {
	var updates []state.PushUpdate
	totalBytes := 0
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		totalBytes += len(scanner.Bytes()) + 1
		if totalBytes > maxPushInputBytes || len(updates) >= maxPushUpdates {
			return nil, errors.New("pre-push input exceeded the safety limit")
		}
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) != 4 {
			return nil, fmt.Errorf("invalid pre-push input: expected 4 fields")
		}
		updates = append(updates, state.PushUpdate{LocalRef: fields[0], LocalSHA: fields[1], RemoteRef: fields[2], RemoteSHA: fields[3]})
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read pre-push input: %w", err)
	}
	return updates, nil
}

func pushContainsTarget(updates []state.PushUpdate, s *state.State) bool {
	for _, update := range updates {
		if update.LocalSHA == s.LastSHA && update.LocalRef == s.TargetRef {
			return true
		}
	}
	return false
}

func cancelPolishForPush(mgr *state.Manager, snapshot *state.State, reason string) bool {
	canceled := false
	_, err := mgr.Update(func(s *state.State) (bool, error) {
		if s.CurrentStatus != state.StatusPolishing || s.OperationID == "" || s.OperationID != snapshot.OperationID {
			return false, nil
		}
		matches, matchErr := git.RefMatches(s.TargetRef, s.LastSHA)
		if matchErr != nil || !matches {
			return false, nil
		}
		s.CurrentStatus = state.StatusFailed
		s.OperationID = ""
		s.PID = 0
		s.StartedAt = 0
		s.LastError = &state.OperationError{
			Code: "push_fail_open", Category: "runtime",
			Message:   "Polishing was canceled because " + reason + ". The original commit and workspace were left unchanged, and the push was allowed to continue.",
			Retryable: true, OccurredAt: time.Now().Unix(),
		}
		canceled = true
		return true, nil
	})
	return err == nil && canceled
}
