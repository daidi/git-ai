package cmd

import (
	"embed"
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/internal/config"
	"github.com/daidi/git-ai/internal/git"
	"github.com/daidi/git-ai/internal/i18n"
	"github.com/daidi/git-ai/internal/state"
)

//go:embed hooks/*
var hookTemplates embed.FS

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize git-ai in the current repository",
	Long:  "Sets up hooks, state directory, and detects SSH configuration.",
	RunE:  runInit,
}

func init() {
	rootCmd.AddCommand(initCmd)
}

func runInit(cmd *cobra.Command, args []string) error {
	repoRoot := GetGitRoot()
	gitDir, err := git.GetGitDir()
	if err != nil {
		return fmt.Errorf("find .git dir: %w", err)
	}

	Printf(i18n.Sprintf("init.start", repoRoot))

	// 2. Create state directory.
	mgr := state.NewManager(gitDir)
	if err := mgr.EnsureDir(); err != nil {
		return fmt.Errorf("create state dir: %w", err)
	}
	Printf(i18n.Sprintf("init.created_state", mgr.StateDir()))

	// 3. Initialize state.json.
	if err := mgr.Reset(); err != nil {
		return fmt.Errorf("init state: %w", err)
	}
	Printf(i18n.T("init.state_json"))

	// 4. Install hooks.
	hooksDir := filepath.Join(gitDir, "hooks")
	if err := os.MkdirAll(hooksDir, 0o755); err != nil {
		return fmt.Errorf("create hooks dir: %w", err)
	}

	for _, hookName := range []string{"post-commit", "pre-push"} {
		hookPath := filepath.Join(hooksDir, hookName)

		// Backup existing hook.
		if _, err := os.Stat(hookPath); err == nil {
			backupPath := hookPath + ".backup"
			if err := os.Rename(hookPath, backupPath); err != nil {
				return fmt.Errorf("backup %s: %w", hookName, err)
			}
			Printf(i18n.Sprintf("init.backed_up", hookName, hookName))
		}

		// Write new hook.
		content, err := hookTemplates.ReadFile("hooks/" + hookName)
		if err != nil {
			return fmt.Errorf("read hook template %s: %w", hookName, err)
		}
		if err := os.WriteFile(hookPath, content, 0o755); err != nil {
			return fmt.Errorf("write hook %s: %w", hookName, err)
		}
		Printf(i18n.Sprintf("init.installed", hookName))
	}

	// 5. SSH detection.
	ok, reason := git.CanPushSilently("origin")
	if !ok {
		Printf(i18n.Sprintf("init.ssh_warn", reason))
		Printf(i18n.T("init.ssh_block"))
		Printf(i18n.T("init.ssh_hint"))

		// Force push_policy to block in project config.
		projectCfg := config.ProjectConfigPath(repoRoot)
		_ = config.Set(projectCfg, "push_policy", "block")
	}

	// 6. Summary.
	Printf(i18n.T("init.done"))
	Printf(i18n.T("init.next"))
	Printf(i18n.T("init.step1"))
	Printf(i18n.T("init.step2"))
	Printf(i18n.T("init.step3"))
	Printf(i18n.T("init.step4"))
	Printf("\n")

	return nil
}
