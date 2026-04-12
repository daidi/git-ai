package hooks

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/daidi/git-ai/internal/git"
	"github.com/daidi/git-ai/internal/i18n"
	"github.com/daidi/git-ai/internal/state"
)

// RunPrePush is called by the pre-push hook.
// It reads the pre-push stdin protocol and decides whether to queue or allow the push.
// Arguments: remote name, remote URL (passed by Git).
func RunPrePush(remote string) error {
	// Guard: skip if this is an internal push.
	if os.Getenv("GIT_AI_INTERNAL") == "true" {
		return nil
	}

	gitDir, err := git.GetGitDir()
	if err != nil {
		return fmt.Errorf("not in a git repo: %w", err)
	}

	mgr := state.NewManager(gitDir)

	// Read the full stdin from the pre-push protocol.
	// Format: <local ref> SP <local sha> SP <remote ref> SP <remote sha> LF
	var refSpecs []string
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			refSpecs = append(refSpecs, line)
		}
	}

	// Load current state.
	s, err := mgr.Load()
	if err != nil {
		// If we can't read state, allow the push to proceed.
		return nil
	}

	if s.CurrentStatus == state.StatusPolishing {
		// AI is still working — queue the push.
		s.PendingPush = &state.PendingPush{
			Remote:    remote,
			RefSpecs:  refSpecs,
			Timestamp: time.Now().Unix(),
		}
		if err := mgr.Save(s); err != nil {
			fmt.Fprintf(os.Stderr, i18n.Sprintf("prepush.save_warn", err))
			// Still block the push to avoid pushing stale commit.
		}

		fmt.Print(i18n.T("prepush.queued"))
		// Exit 1 to block the synchronous push.
		os.Exit(1)
	}

	// Status is idle or pushing — allow push through.
	return nil
}
