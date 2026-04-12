package cmd

import (
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

	if s.CurrentStatus == state.StatusPolishing {
		return fmt.Errorf(i18n.T("err.polishing"))
	}

	if s.OriginalMsg == "" {
		return fmt.Errorf(i18n.T("err.no_undo"))
	}

	Printf(i18n.Sprintf("undo.restoring", s.OriginalMsg))

	if err := git.Amend(s.OriginalMsg); err != nil {
		return fmt.Errorf("amend failed: %w", err)
	}

	// Clear the backup.
	_ = mgr.Save(&state.State{
		CurrentStatus: state.StatusIdle,
		LastSHA:       s.LastSHA,
	})

	Printf(i18n.T("undo.done"))
	return nil
}
