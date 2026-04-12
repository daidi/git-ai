package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/internal/ai"
	"github.com/daidi/git-ai/internal/config"
	"github.com/daidi/git-ai/internal/git"
	"github.com/daidi/git-ai/internal/i18n"
	"github.com/daidi/git-ai/internal/notify"
	"github.com/daidi/git-ai/internal/state"
)

var retryCmd = &cobra.Command{
	Use:   "retry",
	Short: "Re-generate the AI commit message for the latest commit",
	Long:  "Calls the AI again to generate a fresh commit message and amends the last commit.",
	RunE:  runRetry,
}

func init() {
	rootCmd.AddCommand(retryCmd)
}

func runRetry(cmd *cobra.Command, args []string) error {
	gitDir, err := git.GetGitDir()
	if err != nil {
		return err
	}

	mgr := state.NewManager(gitDir)
	repoRoot := GetGitRoot()
	cfg, err := config.Load(repoRoot)
	if err != nil {
		return err
	}

	// Ensure we're not polishing.
	s, err := mgr.Load()
	if err != nil {
		return err
	}
	if s.CurrentStatus == state.StatusPolishing {
		return fmt.Errorf(i18n.T("err.polishing"))
	}

	// Get current commit info.
	sha, err := git.GetLastCommitSHA()
	if err != nil {
		return err
	}
	origMsg, err := git.GetLastCommitMsg()
	if err != nil {
		return err
	}

	// Use the original user message if available, otherwise use current.
	userMsg := origMsg
	if s.OriginalMsg != "" {
		userMsg = s.OriginalMsg
	}

	Printf(i18n.Sprintf("retry.start", sha[:8]))

	// Get diff.
	diff, err := git.GetDiff(sha)
	if err != nil {
		diff, _ = git.GetDiffStat(sha)
	}

	// Call AI.
	polished, err := ai.Polish(diff, userMsg, cfg)
	if err != nil {
		return fmt.Errorf("AI error: %w", err)
	}

	// Amend.
	if err := git.Amend(polished); err != nil {
		return fmt.Errorf("amend failed: %w", err)
	}

	// Update state.
	_ = mgr.Save(&state.State{
		CurrentStatus: state.StatusIdle,
		OriginalMsg:   userMsg,
		LastSHA:       sha,
		PID:           os.Getpid(),
	})

	Printf(i18n.Sprintf("retry.done", polished))
	notify.Send("Git AI", i18n.Sprintf("retry.notify", polished))
	return nil
}
