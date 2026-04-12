package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/internal/update"
)

var updateCmd = &cobra.Command{
	Use:   "update",
	Short: "Update git-ai to the latest version",
	Long:  `Downloads the latest release from GitHub and replaces the current executable in-place.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := update.PerformUpgrade(version); err != nil {
			return fmt.Errorf("update failed: %w", err)
		}
		return nil
	},
}

func init() {
	rootCmd.AddCommand(updateCmd)
}
