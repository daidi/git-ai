package cmd

import (
	"embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/internal/config"
	"github.com/daidi/git-ai/internal/git"
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

	Printf("🔧 Initializing git-ai in %s\n\n", repoRoot)

	// 1. Check that git-ai is on PATH.
	if _, err := exec.LookPath("git-ai"); err != nil {
		Printf("⚠️  Warning: 'git-ai' not found on PATH.\n")
		Printf("   Hooks will fail unless the binary is accessible.\n\n")
	}

	// 2. Create state directory.
	mgr := state.NewManager(gitDir)
	if err := mgr.EnsureDir(); err != nil {
		return fmt.Errorf("create state dir: %w", err)
	}
	Printf("  ✅ Created %s\n", mgr.StateDir())

	// 3. Initialize state.json.
	if err := mgr.Reset(); err != nil {
		return fmt.Errorf("init state: %w", err)
	}
	Printf("  ✅ Initialized state.json\n")

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
			Printf("  📦 Backed up existing %s → %s.backup\n", hookName, hookName)
		}

		// Write new hook.
		content, err := hookTemplates.ReadFile("hooks/" + hookName)
		if err != nil {
			return fmt.Errorf("read hook template %s: %w", hookName, err)
		}
		if err := os.WriteFile(hookPath, content, 0o755); err != nil {
			return fmt.Errorf("write hook %s: %w", hookName, err)
		}
		Printf("  ✅ Installed %s hook\n", hookName)
	}

	// 5. SSH detection.
	ok, reason := git.CanPushSilently("origin")
	if !ok {
		Printf("\n  ⚠️  %s\n", reason)
		Printf("     Push policy set to 'block' (manual push required).\n")
		Printf("     To enable auto-push, run: ssh-add\n\n")

		// Force push_policy to block in project config.
		projectCfg := config.ProjectConfigPath(repoRoot)
		_ = config.Set(projectCfg, "push_policy", "block")
	}

	// 6. Summary.
	Printf("\n🎉 git-ai initialized!\n\n")
	Printf("Next steps:\n")
	Printf("  1. Set your API key:  git-ai config set api_key <key> --global\n")
	Printf("  2. (Optional) Change model: git-ai config set model <model>\n")
	Printf("  3. (Optional) Change format: git-ai config set message_format gitmoji\n")
	Printf("  4. Commit as usual:   git commit -m \"your message\"\n")
	Printf("\n")

	return nil
}
