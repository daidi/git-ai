package hooks

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/daidi/git-ai/internal/config"
	"github.com/daidi/git-ai/internal/git"
	"github.com/daidi/git-ai/internal/i18n"
	"github.com/daidi/git-ai/internal/state"
)

// RunPrePush reads Git's pre-push protocol and blocks only updates that include
// the exact commit currently being polished.
func RunPrePush(remote, remoteURL string) error {
	if os.Getenv("GIT_AI_INTERNAL") == "true" || os.Getenv("GIT_AI_SKIP") == "true" {
		return nil
	}
	updates, err := readPushUpdates()
	if err != nil {
		return err
	}
	if len(updates) == 0 {
		return nil
	}

	gitDir, err := git.GetGitDir()
	if err != nil {
		return fmt.Errorf("not in a git repo: %w", err)
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
		return fmt.Errorf("git-ai blocked the push because polishing is active, but configuration could not be loaded: %w", cfgErr)
	}
	if cfg.PushPolicy == "block" {
		fmt.Print("Git AI is still polishing this commit. The push was not queued; retry it after polishing finishes.\n")
		return errors.New("push blocked while commit message is being polished")
	}

	_, err = mgr.Update(func(s *state.State) (bool, error) {
		if s.CurrentStatus != state.StatusPolishing || !pushContainsTarget(updates, s) {
			return false, nil
		}
		// remoteURL may contain embedded credentials. It is intentionally never
		// persisted; the remote name and structured ref updates are sufficient.
		s.PendingPush = &state.PendingPush{Remote: remote, Updates: updates, Timestamp: time.Now().Unix()}
		return true, nil
	})
	if err != nil {
		return fmt.Errorf("git-ai blocked the push but could not queue it safely: %w", err)
	}
	fmt.Print(i18n.T("prepush.queued"))
	return errors.New("push deferred until commit polishing completes")
}

func readPushUpdates() ([]state.PushUpdate, error) {
	var updates []state.PushUpdate
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
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
		if update.LocalSHA == s.LastSHA || (s.TargetRef != "" && update.LocalRef == s.TargetRef) {
			return true
		}
	}
	return false
}
