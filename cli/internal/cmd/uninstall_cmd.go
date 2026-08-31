package cmd

import (
	"fmt"
	"os"

	"github.com/daidi/git-ai/cli/internal/git"
	"github.com/daidi/git-ai/cli/internal/i18n"
	"github.com/daidi/git-ai/cli/internal/state"
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

	Printf("%s", i18n.Sprintf("uninstall.start", repoRoot))
	mgr := state.NewManager(gitDir)
	if snapshot, loadErr := mgr.Load(); loadErr == nil && snapshot.CurrentStatus == state.StatusPolishing && snapshot.OperationID != "" {
		invalidated := false
		if _, updateErr := mgr.Update(func(current *state.State) (bool, error) {
			if current.OperationID != snapshot.OperationID || current.CurrentStatus != state.StatusPolishing {
				return false, nil
			}
			current.CurrentStatus = state.StatusIdle
			current.OperationID = ""
			current.PID = 0
			current.StartedAt = 0
			current.PendingPush = nil
			current.LastError = nil
			invalidated = true
			return true, nil
		}); updateErr != nil {
			return fmt.Errorf("stop active polishing before uninstall: %w", updateErr)
		}
		if invalidated {
			stopProcess(snapshot.PID)
		}
	}

	for _, hookName := range []string{"post-commit", "pre-push"} {
		hookPath, err := git.GetHookPath(hookName)
		if err != nil {
			return fmt.Errorf("resolve %s hook: %w", hookName, err)
		}
		repositoryScoped, err := git.IsRepositoryScopedHookPath(hookPath)
		if err != nil {
			return fmt.Errorf("validate %s hook path: %w", hookName, err)
		}
		if !repositoryScoped {
			Printf("Skipped %s outside this repository's Git metadata: %s\n", hookName, hookPath)
			continue
		}
		backupPath := hookPath + ".git-ai.backup"
		legacyBackupPath := hookPath + ".backup"

		hookRemoved := false

		// Check if the current hook is ours.
		content, err := os.ReadFile(hookPath)
		if err == nil {
			if isManagedHook(content, hookName) {
				if err := os.Remove(hookPath); err != nil {
					return fmt.Errorf("remove %s: %w", hookName, err)
				}
				hookRemoved = true
				Printf("%s", i18n.Sprintf("uninstall.removed", hookName))
			} else {
				Printf("%s", i18n.Sprintf("uninstall.skipped", hookName))
			}
		} else if !os.IsNotExist(err) {
			return fmt.Errorf("read %s: %w", hookName, err)
		} else {
			// Hook doesn't exist - treat as removed for backup restoration
			hookRemoved = true
		}

		// Restore backup only if the git-ai hook was removed or never existed.
		if _, err := os.Stat(backupPath); os.IsNotExist(err) {
			backupPath = legacyBackupPath
		}
		if _, err := os.Stat(backupPath); err == nil {
			if hookRemoved {
				if err := os.Rename(backupPath, hookPath); err != nil {
					return fmt.Errorf("restore backup %s: %w", hookName, err)
				}
				Printf("%s", i18n.Sprintf("uninstall.restored", hookName))
			} else {
				Printf("%s", i18n.T("uninstall.backup_kept"))
				Printf("%s", i18n.Sprintf("uninstall.current", hookPath))
				Printf("%s", i18n.Sprintf("uninstall.backup", backupPath))
			}
		}
	}

	// Clean up only this repository's external application runtime directory.
	gitAiDir := mgr.StateDir()
	if _, err := os.Stat(gitAiDir); err == nil {
		if err := os.RemoveAll(gitAiDir); err != nil {
			Printf("%s", i18n.Sprintf("uninstall.state_warn", gitAiDir, err))
		} else {
			Printf("%s", i18n.T("uninstall.state_removed"))
		}
	}

	Printf("%s", i18n.T("uninstall.done"))
	Printf("%s", i18n.T("uninstall.config_kept"))
	return nil
}
