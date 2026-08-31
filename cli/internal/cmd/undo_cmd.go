package cmd

import (
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/cli/internal/git"
	"github.com/daidi/git-ai/cli/internal/i18n"
	"github.com/daidi/git-ai/cli/internal/state"
)

var undoCmd = &cobra.Command{
	Use:   "undo",
	Short: "Revert the AI-polished message to the original",
	Long:  "Restores the original commit message that was backed up before AI polishing.",
	RunE:  runUndo,
}

func init() {
	rootCmd.AddCommand(undoCmd)
}

func runUndo(cmd *cobra.Command, args []string) error {
	gitDir, err := git.GetGitDir()
	if err != nil {
		return err
	}

	mgr := state.NewManager(gitDir)

	s, err := mgr.Load()
	if err != nil {
		return err
	}

	if s.CurrentStatus == state.StatusPolishing || s.CurrentStatus == state.StatusPushing {
		return errors.New(i18n.T("err.polishing"))
	}

	if s.OriginalMsg == "" || s.ResultSHA == "" || s.TargetRef == "" {
		return errors.New(i18n.T("err.no_undo"))
	}

	Printf("%s", i18n.Sprintf("undo.restoring", s.OriginalMsg))

	var restoredSHA string
	_, err = mgr.Update(func(current *state.State) (bool, error) {
		if current.ResultSHA != s.ResultSHA || current.TargetRef != s.TargetRef {
			return false, errors.New("commit state changed; refusing to undo a different commit")
		}
		created, rewriteErr := git.RewriteCommitMessageCAS(current.TargetRef, current.ResultSHA, current.OriginalMsg)
		if rewriteErr != nil {
			return false, rewriteErr
		}
		restoredSHA = created
		finalizeUndoState(current, created)
		return true, nil
	})
	if err != nil {
		if restoredSHA != "" {
			matches, matchErr := git.RefMatches(s.TargetRef, restoredSHA)
			if matchErr == nil && matches {
				finalized := false
				_, retryErr := mgr.Update(func(current *state.State) (bool, error) {
					if current.ResultSHA != s.ResultSHA || current.TargetRef != s.TargetRef {
						return false, nil
					}
					finalizeUndoState(current, restoredSHA)
					finalized = true
					return true, nil
				})
				if retryErr == nil && finalized {
					Printf("%s", i18n.T("undo.done"))
					return nil
				}
				if retryErr != nil {
					err = retryErr
				}
			}
			return fmt.Errorf("commit message was restored, but application state could not be saved: %w", err)
		}
		return fmt.Errorf("safe undo failed: %w", err)
	}
	if restoredSHA == "" {
		return errors.New("commit state changed; nothing was rewritten")
	}

	Printf("%s", i18n.T("undo.done"))
	return nil
}

func finalizeUndoState(current *state.State, restoredSHA string) {
	current.CurrentStatus = state.StatusIdle
	current.LastSHA = restoredSHA
	current.ResultSHA = ""
	current.OriginalMsg = ""
	current.PendingPush = nil
	current.LastError = nil
}
