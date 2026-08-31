// Package cmd defines all CLI commands for git-ai.
package cmd

import (
	"errors"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/cli/internal/config"
	"github.com/daidi/git-ai/cli/internal/git"
	"github.com/daidi/git-ai/cli/internal/i18n"
	"github.com/daidi/git-ai/cli/internal/state"
	"github.com/daidi/git-ai/cli/internal/update"
)

var (
	version = "dev"
	verbose bool
	noColor bool

	// gitRoot is resolved once and shared across subcommands.
	gitRoot          string
	showUpdateNotice bool
)

type exitCodeError struct {
	code int
	err  error
}

func (e *exitCodeError) Error() string { return e.err.Error() }
func (e *exitCodeError) Unwrap() error { return e.err }
func (e *exitCodeError) ExitCode() int { return e.code }

func withExitCode(err error, code int) error {
	if err == nil {
		return nil
	}
	return &exitCodeError{code: code, err: err}
}

var rootCmd = &cobra.Command{
	Use:   "git-ai",
	Short: "AI-powered Git commit message enhancer",
	Long: "\033[1;36m✨ Git AI - Async Commit Polisher\033[0m\n\n" +
		`Never wait for AI. Polish your commits in the background while you code.
Git AI automatically enhances your commit messages using LLMs.
It works asynchronously via post-commit hooks and supports deferred push.`,

	Version: version,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		isHook := hasCommandAncestor(cmd, "hook")
		isStatus := cmd.Name() == "status"
		showUpdateNotice = !isHook && !isStatus

		// Config commands may run outside a repository, but when invoked inside one
		// they still need the repository root for local overrides. Discover it on a
		// best-effort basis instead of marking the whole command tree as git-free.
		skipGit := cmd.Name() == "help" || cmd.Name() == "version" || cmd.Name() == "git-ai" || cmd.Name() == "update"
		isConfig := false
		for c := cmd; c != nil; c = c.Parent() {
			if c.Name() == "config" {
				isConfig = true
				break
			}
		}

		// Initialize i18n as early as possible.
		// Try to load config for ui_language; if unavailable, i18n auto-detects from env.
		var uiLang string
		if isConfig {
			if root, err := git.GetRepoRoot(); err == nil {
				gitRoot = root
			}
			cfg, _ := config.Load(gitRoot)
			if cfg != nil {
				uiLang = cfg.UILanguage
			}
		} else if !skipGit {
			root, err := git.GetRepoRoot()
			if err != nil {
				return fmt.Errorf("not inside a git repository: %w", err)
			}
			gitRoot = root

			// Clean up zombie polishing states on startup.
			gitDir, _ := git.GetGitDir()
			if gitDir != "" {
				mgr := state.NewManager(gitDir)
				if cleaned, _ := mgr.CleanZombieState(); cleaned && verbose {
					fmt.Fprintln(os.Stderr, "cleaned up stale polishing state")
				}
			}

			cfg, _ := config.Load(gitRoot)
			if cfg != nil {
				uiLang = cfg.UILanguage
				enabled := true
				if cfg.CheckUpdate != nil {
					enabled = *cfg.CheckUpdate
				}
				if showUpdateNotice {
					update.BackgroundCheck(enabled)
				}
			}
		} else {
			// Even without a repo, try global config for ui_language.
			if globalCfg, err := config.LoadFile(config.GlobalConfigPath()); err == nil && globalCfg != nil {
				uiLang = globalCfg.UILanguage
			}
		}
		i18n.Init(uiLang)

		return nil
	},
	// Root command with no subcommand prints usage.
	RunE: func(cmd *cobra.Command, args []string) error {
		return cmd.Help()
	},
	SilenceErrors: true,
	SilenceUsage:  true,
}

func init() {
	rootCmd.SetVersionTemplate("\033[1;36m✨ Git-AI CLI v{{.Version}}\033[0m\n")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose output")
	rootCmd.PersistentFlags().BoolVar(&noColor, "no-color", false, "Disable colored output")
}

// PostExecuteUpdateCheck checks if an update is available and prints a notice to stderr if so.
func PostExecuteUpdateCheck() {
	if !showUpdateNotice {
		return
	}
	cfg, err := config.Load(gitRoot)
	if err == nil && cfg.CheckUpdate != nil && !*cfg.CheckUpdate {
		return
	}
	if msg := update.CheckUpdate(version); msg != "" {
		fmt.Fprint(os.Stderr, msg)
	}
}

// Execute runs the root command.
func Execute() error {
	rootCmd.Version = version
	return rootCmd.Execute()
}

// ExitCode preserves the normal CLI exit code while allowing hidden hook
// commands to communicate a deliberate Git decision separately from an
// application failure. Hook dispatchers fail open for every other error.
func ExitCode(err error) int {
	var coded interface{ ExitCode() int }
	if errors.As(err, &coded) && coded.ExitCode() > 0 {
		return coded.ExitCode()
	}
	return 1
}

func hasCommandAncestor(cmd *cobra.Command, name string) bool {
	for current := cmd; current != nil; current = current.Parent() {
		if current.Name() == name {
			return true
		}
	}
	return false
}

// GetGitRoot returns the resolved git repository root.
func GetGitRoot() string {
	return gitRoot
}

// IsVerbose returns whether verbose mode is enabled.
func IsVerbose() bool {
	return verbose
}

// Printf prints a formatted message to stdout unless suppressed.
func Printf(format string, args ...any) {
	_, _ = fmt.Fprintf(os.Stdout, format, args...)
}

// Errorf prints a formatted error message to stderr.
func Errorf(format string, args ...any) {
	_, _ = fmt.Fprintf(os.Stderr, "error: "+format, args...)
}
