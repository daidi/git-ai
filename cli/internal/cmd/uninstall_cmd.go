package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/daidi/git-ai/internal/git"
	"github.com/spf13/cobra"
)

var uninstallCmd = &cobra.Command{
	Use:   "uninstall",
	Short: "Uninstall git-ai from the current repository",
	Long:  "Removes git-ai hooks and restores backups if they exist.",
	RunE:  runUninstall,
}

func init() {
	rootCmd.AddCommand(uninstallCmd)
}

func runUninstall(cmd *cobra.Command, args []string) error {
	repoRoot := GetGitRoot()
	gitDir, err := git.GetGitDir()
	if err != nil {
		return fmt.Errorf("find .git dir: %w", err)
	}

	Printf("🗑️  Uninstalling git-ai from %s\n\n", repoRoot)

	hooksDir := filepath.Join(gitDir, "hooks")

	for _, hookName := range []string{"post-commit", "pre-push"} {
		hookPath := filepath.Join(hooksDir, hookName)
		backupPath := hookPath + ".backup"

		// Check if the current hook is ours.
		content, err := os.ReadFile(hookPath)
		if err == nil {
			// If it contains "git-ai hook", we delete it.
			if string(content) != "" && strings.Contains(string(content), "git-ai hook") {
				_ = os.Remove(hookPath)
				Printf("  ✅ Removed %s hook\n", hookName)
			} else {
				Printf("  ℹ️ Skipped %s (not a git-ai hook)\n", hookName)
			}
		}

		// Restore backup if exists.
		if _, err := os.Stat(backupPath); err == nil {
			if err := os.Rename(backupPath, hookPath); err != nil {
				return fmt.Errorf("restore backup %s: %w", hookName, err)
			}
			Printf("  📦 Restored original %s hook from backup\n", hookName)
		}
	}

	Printf("\n🎉 git-ai hooks removed.\n")
	Printf("Your .git-ai.json configuration was untouched and safely preserved.\n\n")
	return nil
}
