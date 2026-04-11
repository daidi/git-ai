// Package cmd defines all CLI commands for git-ai.
package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/internal/git"
)

var (
	version string
	verbose bool
	noColor bool

	// gitRoot is resolved once and shared across subcommands.
	gitRoot string
)

// SetVersion sets the build-time version string.
func SetVersion(v string) {
	version = v
}

var rootCmd = &cobra.Command{
	Use:   "git-ai",
	Short: "AI-powered Git commit message enhancer",
	Long: `git-ai automatically polishes your commit messages using AI.
It works asynchronously via post-commit hooks and supports deferred push.`,
	Version: version,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		// Skip git root detection for commands that don't need it.
		if cmd.Name() == "help" || cmd.Name() == "version" {
			return nil
		}
		root, err := git.GetRepoRoot()
		if err != nil {
			return fmt.Errorf("not inside a git repository: %w", err)
		}
		gitRoot = root
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
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "Enable verbose output")
	rootCmd.PersistentFlags().BoolVar(&noColor, "no-color", false, "Disable colored output")
}

// Execute runs the root command.
func Execute() error {
	rootCmd.Version = version
	return rootCmd.Execute()
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
	fmt.Fprintf(os.Stdout, format, args...)
}

// Errorf prints a formatted error message to stderr.
func Errorf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "error: "+format, args...)
}
