package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/daidi/git-ai/internal/git"
	"github.com/daidi/git-ai/internal/i18n"
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

	Printf(i18n.Sprintf("uninstall.start", repoRoot))

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
				Printf(i18n.Sprintf("uninstall.removed", hookName))
			} else {
				Printf(i18n.Sprintf("uninstall.skipped", hookName))
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
				Printf(i18n.Sprintf("uninstall.restored", hookName))
			} else {
				Printf(i18n.T("uninstall.backup_kept"))
				Printf(i18n.Sprintf("uninstall.current", hookPath))
				Printf(i18n.Sprintf("uninstall.backup", backupPath))
			}
		}
	}

	// Clean up state directory.
	gitAiDir := filepath.Join(gitDir, "git-ai")
	if _, err := os.Stat(gitAiDir); err == nil {
		if err := os.RemoveAll(gitAiDir); err != nil {
			Printf(i18n.Sprintf("uninstall.state_warn", gitAiDir, err))
		} else {
			Printf(i18n.T("uninstall.state_removed"))
		}
	}

	Printf(i18n.T("uninstall.done"))
	Printf(i18n.T("uninstall.config_kept"))
	return nil
}
