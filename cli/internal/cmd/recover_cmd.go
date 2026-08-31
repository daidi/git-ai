package cmd

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/internal/git"
	"github.com/daidi/git-ai/internal/i18n"
	"github.com/daidi/git-ai/internal/state"
)

var recoverCmd = &cobra.Command{
	Use:   "recover",
	Short: "Recover from a stuck polishing state",
	Long: `Recover from a stuck polishing state by rolling back to the original commit message.

This command is useful when:
- The polishing daemon crashed or was killed
- The process timed out and left a [⏳] prefix in the commit message
- You need to manually clean up a stuck state

It will:
1. Check if there's a polishing state with an original message
2. Remove the [⏳] prefix from the current commit message
3. Reset the state to idle`,
	RunE: func(cmd *cobra.Command, args []string) error {
		gitDir, err := git.GetGitDir()
		if err != nil {
			return fmt.Errorf("not in a git repo: %w", err)
		}

		mgr := state.NewManager(gitDir)
		s, err := mgr.Load()
		if err != nil {
			return fmt.Errorf("load state: %w", err)
		}

		// Check current commit message for [⏳] prefix
		currentMsg, err := git.GetLastCommitMsg()
		if err != nil {
			return fmt.Errorf("get commit message: %w", err)
		}

		hasLoadingPrefix := strings.HasPrefix(currentMsg, "[⏳] ")
		hasPolishingState := s.CurrentStatus == state.StatusPolishing && s.OriginalMsg != ""

		if !hasLoadingPrefix && !hasPolishingState {
			Printf("%s", i18n.Sprintf("recover.nothing_to_recover"))
			return nil
		}

		// Only legacy releases wrote a loading prefix into Git. Remove it from
		// the exact current commit; never apply an old saved message to a newer
		// commit after the branch has moved.
		if hasLoadingPrefix {
			originalMsg := strings.TrimPrefix(currentMsg, "[⏳] ")
			currentSHA, err := git.GetLastCommitSHA()
			if err != nil {
				return err
			}
			if currentSHA == s.LastSHA && s.OriginalMsg != "" {
				originalMsg = s.OriginalMsg
			}
			Printf("%s", i18n.Sprintf("recover.rolling_back"))
			targetRef, err := git.GetHeadRef()
			if err != nil {
				return err
			}
			if _, err := git.RewriteCommitMessageCAS(targetRef, currentSHA, originalMsg); err != nil {
				return fmt.Errorf("restore commit safely: %w", err)
			}
			Printf("%s", i18n.Sprintf("recover.rolled_back", originalMsg))
		}

		// Invalidate the recorded operation before killing its process. A daemon
		// that races with recovery will then fail its operation-id CAS safely.
		if hasPolishingState {
			pid := s.PID
			recovered := false
			_, err := mgr.Update(func(current *state.State) (bool, error) {
				if current.OperationID != s.OperationID {
					return false, nil
				}
				current.CurrentStatus = state.StatusFailed
				current.OperationID = ""
				current.PID = 0
				current.StartedAt = 0
				current.LastError = &state.OperationError{Code: "recovered", Category: "canceled", Message: "The stale polishing operation was stopped. Git and workspace files were left unchanged.", Retryable: true, OccurredAt: time.Now().Unix()}
				recovered = true
				return true, nil
			})
			if err != nil {
				return fmt.Errorf("reset state: %w", err)
			}
			if recovered {
				stopProcess(pid)
			}
		}

		Printf("%s", i18n.Sprintf("recover.success"))
		return nil
	},
}

func init() {
	rootCmd.AddCommand(recoverCmd)
}
