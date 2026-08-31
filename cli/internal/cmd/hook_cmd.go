package cmd

import (
	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/internal/hooks"
)

var (
	hookDaemon      bool
	hookOperationID string
)

var hookCmd = &cobra.Command{
	Use:    "hook",
	Short:  "Internal hook handlers (called by Git hooks)",
	Hidden: true, // Users should not call this directly.
}

var hookPostCommitCmd = &cobra.Command{
	Use:   "post-commit",
	Short: "Handle post-commit hook",
	RunE: func(cmd *cobra.Command, args []string) error {
		return hooks.RunPostCommit(hookDaemon, hookOperationID)
	},
}

var hookPrePushCmd = &cobra.Command{
	Use:   "pre-push [remote] [url]",
	Short: "Handle pre-push hook",
	Args:  cobra.MaximumNArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		remote := "origin"
		remoteURL := ""
		if len(args) >= 1 {
			remote = args[0]
		}
		if len(args) >= 2 {
			remoteURL = args[1]
		}
		return hooks.RunPrePush(remote, remoteURL)
	},
}

func init() {
	hookPostCommitCmd.Flags().BoolVar(&hookDaemon, "daemon", false, "Run in daemon mode (internal)")
	hookPostCommitCmd.Flags().StringVar(&hookOperationID, "operation-id", "", "Recorded operation id (internal)")
	hookCmd.AddCommand(hookPostCommitCmd)
	hookCmd.AddCommand(hookPrePushCmd)
	rootCmd.AddCommand(hookCmd)
}
