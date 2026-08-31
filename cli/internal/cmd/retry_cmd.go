package cmd

import (
	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/cli/internal/hooks"
	"github.com/daidi/git-ai/cli/internal/i18n"
)

var retryCmd = &cobra.Command{
	Use:   "retry",
	Short: "Retry polishing the current commit safely in the background",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := hooks.StartRetry(); err != nil {
			return err
		}
		Printf("%s", i18n.T("retry.started"))
		return nil
	},
}

func init() { rootCmd.AddCommand(retryCmd) }
