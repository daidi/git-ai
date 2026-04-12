package cmd

import (
	"fmt"
	"os"
	"strings"

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
			fmt.Fprint(os.Stdout, i18n.Sprintf("recover.nothing_to_recover"))
			return nil
		}

		// Determine the original message
		var originalMsg string
		if hasPolishingState && s.OriginalMsg != "" {
			originalMsg = s.OriginalMsg
		} else if hasLoadingPrefix {
			// Strip the [⏳] prefix
			originalMsg = strings.TrimPrefix(currentMsg, "[⏳] ")
		} else {
			fmt.Fprint(os.Stdout, i18n.Sprintf("recover.nothing_to_recover"))
			return nil
		}

		// Rollback the commit message
		if currentMsg != originalMsg {
			fmt.Fprint(os.Stdout, i18n.Sprintf("recover.rolling_back"))
			if err := git.Amend(originalMsg); err != nil {
				return fmt.Errorf("amend commit: %w", err)
			}
			fmt.Fprintf(os.Stdout, i18n.Sprintf("recover.rolled_back", originalMsg))
		}

		// Reset state
		if hasPolishingState {
			if err := mgr.Reset(); err != nil {
				return fmt.Errorf("reset state: %w", err)
			}
		}

		fmt.Fprint(os.Stdout, i18n.Sprintf("recover.success"))
		return nil
	},
}

func init() {
	rootCmd.AddCommand(recoverCmd)
}
