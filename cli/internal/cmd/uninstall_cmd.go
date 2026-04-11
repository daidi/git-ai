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

		hookRemoved := false

		// Check if the current hook is ours.
		content, err := os.ReadFile(hookPath)
		if err == nil {
			// If it contains "git-ai hook", we delete it.
			if string(content) != "" && strings.Contains(string(content), "git-ai hook") {
				if err := os.Remove(hookPath); err != nil {
					return fmt.Errorf("remove %s: %w", hookName, err)
				}
				hookRemoved = true
				Printf("  ✅ Removed %s hook\n", hookName)
			} else {
				Printf("  ℹ️  Skipped %s (not a git-ai hook)\n", hookName)
			}
		} else if !os.IsNotExist(err) {
			return fmt.Errorf("read %s: %w", hookName, err)
		} else {
			// Hook doesn't exist - treat as removed for backup restoration
			hookRemoved = true
		}

		// Restore backup only if the git-ai hook was removed or never existed.
		if _, err := os.Stat(backupPath); err == nil {
			if hookRemoved {
				if err := os.Rename(backupPath, hookPath); err != nil {
					return fmt.Errorf("restore backup %s: %w", hookName, err)
				}
				Printf("  📦 Restored original %s hook from backup\n", hookName)
			} else {
				Printf("  ⚠️  Backup exists but current hook was modified - keeping both\n")
				Printf("     Current: %s\n", hookPath)
				Printf("     Backup:  %s\n", backupPath)
			}
		}
	}

	// Clean up state directory.
	gitAiDir := filepath.Join(gitDir, "git-ai")
	if _, err := os.Stat(gitAiDir); err == nil {
		if err := os.RemoveAll(gitAiDir); err != nil {
			Printf("\n  ⚠️  Warning: could not remove %s: %v\n", gitAiDir, err)
		} else {
			Printf("\n  ✅ Removed state directory\n")
		}
	}

	Printf("\n🎉 git-ai hooks removed.\n")
	Printf("Your .git-ai.json configuration was untouched and safely preserved.\n\n")
	return nil
}
