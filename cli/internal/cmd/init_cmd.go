package cmd

import (
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/cli/internal/config"
	"github.com/daidi/git-ai/cli/internal/git"
	"github.com/daidi/git-ai/cli/internal/i18n"
	"github.com/daidi/git-ai/cli/internal/state"
)

//go:embed hooks/*
var hookTemplates embed.FS

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize git-ai in the current repository",
	Long:  "Sets up composable Git hooks and private runtime state outside the repository.",
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

	Printf("%s", i18n.Sprintf("init.start", repoRoot))

	type hookTarget struct {
		name string
		path string
	}
	targets := make([]hookTarget, 0, 2)
	for _, hookName := range []string{"post-commit", "pre-push"} {
		hookPath, resolveErr := git.GetHookPath(hookName)
		if resolveErr != nil {
			return fmt.Errorf("resolve %s hook: %w", hookName, resolveErr)
		}
		repositoryScoped, scopeErr := git.IsRepositoryScopedHookPath(hookPath)
		if scopeErr != nil {
			return fmt.Errorf("validate %s hook path: %w", hookName, scopeErr)
		}
		if !repositoryScoped {
			return fmt.Errorf("refusing to modify %s outside this repository's Git metadata: %s", hookName, hookPath)
		}
		targets = append(targets, hookTarget{name: hookName, path: hookPath})
	}

	// Runtime state belongs to the application cache, never the worktree.
	mgr := state.NewManager(gitDir)
	if err := mgr.EnsureDir(); err != nil {
		return fmt.Errorf("create state dir: %w", err)
	}
	Printf("%s", i18n.Sprintf("init.created_state", mgr.StateDir()))

	// Initialize the external state snapshot.
	if err := mgr.Reset(); err != nil {
		return fmt.Errorf("init state: %w", err)
	}
	Printf("%s", i18n.T("init.state_json"))

	// Install hook dispatchers without discarding existing user hooks.
	for _, target := range targets {
		backedUp, err := installHook(target.name, target.path)
		if err != nil {
			return err
		}
		if backedUp {
			Printf("%s", i18n.Sprintf("init.backed_up", target.name, target.name))
		}
		Printf("%s", i18n.Sprintf("init.installed", target.name))
	}

	// 5. Push authentication detection.
	ok, reason := git.CanPushSilently("origin")
	if !ok {
		Printf("%s", i18n.Sprintf("init.ssh_warn", reason))
		Printf("%s", i18n.T("init.ssh_block"))
		if git.IsSSHRemote("origin") {
			Printf("%s", i18n.T("init.ssh_hint"))
		} else {
			Printf("%s", i18n.Sprintf("init.https_hint", git.CredentialHelperHint()))
		}

		// Store the repository override in .git/config, never in the worktree.
		_ = config.SetLocal(repoRoot, "push_policy", "block")
	}

	// 6. Summary.
	Printf("%s", i18n.T("init.done"))
	Printf("%s", i18n.T("init.next"))
	Printf("%s", i18n.T("init.step1"))
	Printf("%s", i18n.T("init.step2"))
	Printf("%s", i18n.T("init.step3"))
	Printf("%s", i18n.T("init.step4"))
	Printf("\n")

	return nil
}

func installHook(hookName, hookPath string) (bool, error) {
	if err := os.MkdirAll(filepath.Dir(hookPath), 0o755); err != nil {
		return false, fmt.Errorf("create hooks dir: %w", err)
	}
	content, err := hookTemplates.ReadFile("hooks/" + hookName)
	if err != nil {
		return false, fmt.Errorf("read hook template %s: %w", hookName, err)
	}

	backupPath := hookPath + ".git-ai.backup"
	legacyBackup := hookPath + ".backup"
	current, readErr := os.ReadFile(hookPath)
	isOurs := readErr == nil && isManagedHook(current, hookName)
	if readErr != nil && !os.IsNotExist(readErr) {
		return false, fmt.Errorf("read %s hook: %w", hookName, readErr)
	}

	// Migrate the backup name used by <= 1.1.4 without overwriting anything.
	if isOurs {
		if _, err := os.Stat(backupPath); os.IsNotExist(err) {
			if _, legacyErr := os.Stat(legacyBackup); legacyErr == nil {
				if err := os.Rename(legacyBackup, backupPath); err != nil {
					return false, fmt.Errorf("migrate %s hook backup: %w", hookName, err)
				}
			}
		}
		return false, writeHookAtomic(hookPath, content)
	}

	backedUp := false
	if readErr == nil {
		if _, err := os.Stat(backupPath); err == nil {
			return false, fmt.Errorf("refusing to replace %s hook: both a user hook and %s already exist", hookName, backupPath)
		} else if !os.IsNotExist(err) {
			return false, err
		}
		if err := os.Rename(hookPath, backupPath); err != nil {
			return false, fmt.Errorf("backup %s hook: %w", hookName, err)
		}
		backedUp = true
	}
	if err := writeHookAtomic(hookPath, content); err != nil {
		if backedUp {
			_ = os.Rename(backupPath, hookPath)
		}
		return false, fmt.Errorf("write %s hook: %w", hookName, err)
	}
	return backedUp, nil
}

func isManagedHook(content []byte, hookName string) bool {
	normalized := strings.ReplaceAll(string(content), "\r\n", "\n")
	newMarker := "# git-ai managed hook: " + hookName + "\n"
	legacyMarker := "# git-ai " + hookName + " hook\n# Installed by `git-ai init`. Do not edit"
	return strings.Contains(normalized, newMarker) || strings.Contains(normalized, legacyMarker)
}

func writeHookAtomic(path string, content []byte) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".git-ai-hook-*")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer func() { _ = tmp.Close(); _ = os.Remove(tmpPath) }()
	if err := tmp.Chmod(0o755); err != nil {
		return err
	}
	if _, err := tmp.Write(content); err != nil {
		return err
	}
	if err := tmp.Sync(); err != nil {
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpPath, path)
}
