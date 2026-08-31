package cmd

import (
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/internal/git"
	"github.com/daidi/git-ai/internal/i18n"
	"github.com/daidi/git-ai/internal/state"
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
		current.CurrentStatus = state.StatusIdle
		current.LastSHA = created
		current.ResultSHA = ""
		current.OriginalMsg = ""
		current.PendingPush = nil
		current.LastError = nil
		return true, nil
	})
	if err != nil {
		return fmt.Errorf("safe undo failed: %w", err)
	}
	if restoredSHA == "" {
		return errors.New("commit state changed; nothing was rewritten")
	}

	Printf("%s", i18n.T("undo.done"))
	return nil
}
