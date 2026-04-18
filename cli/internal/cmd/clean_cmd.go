package cmd

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/internal/git"
	"github.com/daidi/git-ai/internal/i18n"
)

var forceClean bool

var cleanCmd = &cobra.Command{
	Use:   "clean",
	Short: "Clean up stuck [⏳] loading prefixes from commit history",
	Long:  "Scans recent commits for the loading prefix and removes it by rewriting history if necessary.",
	RunE:  runClean,
}

func init() {
	cleanCmd.Flags().BoolVar(&forceClean, "force", false, "Force clean even if commits are already pushed")
	rootCmd.AddCommand(cleanCmd)
}

func runClean(cmd *cobra.Command, args []string) error {
	_, err := git.GetGitDir()
	if err != nil {
		return fmt.Errorf("not in a git repo: %w", err)
	}

	// 1. Find commits with [⏳]
	logCmd := exec.Command("git", "log", "-n", "50", "--format=%H %s")
	out, err := logCmd.Output()
	if err != nil {
		return fmt.Errorf("failed to get git log: %w", err)
	}

	var targetCommits []string
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, " ", 2)
		if len(parts) != 2 {
			continue
		}
		sha, msg := parts[0], parts[1]
		if strings.Contains(msg, "[⏳]") {
			targetCommits = append(targetCommits, sha)
		}
	}

	if len(targetCommits) == 0 {
		Printf("%s\n", i18n.Sprintf("recover.nothing_to_recover"))
		return nil
	}

	// 2. Check if pushed
	var pushedCommits []string
	for _, sha := range targetCommits {
		branchCmd := exec.Command("git", "branch", "-r", "--contains", sha)
		branchOut, err := branchCmd.Output()
		if err == nil && len(strings.TrimSpace(string(branchOut))) > 0 {
			pushedCommits = append(pushedCommits, sha)
		}
	}

	if len(pushedCommits) > 0 && !forceClean {
		// Output a specific string so the IDE knows to prompt
		return errors.New("ERR_PUSHED_COMMITS: some target commits have already been pushed. Editing them will rewrite history. Use --force to proceed")
	}

	// If the only commit is HEAD, just amend
	headSha, _ := git.GetLastCommitSHA()
	if len(targetCommits) == 1 && targetCommits[0] == headSha {
		msg, _ := git.GetLastCommitMsg()
		newMsg := strings.ReplaceAll(msg, "[⏳] ", "")
		newMsg = strings.ReplaceAll(newMsg, "[⏳]", "")
		if err := git.Amend(newMsg); err != nil {
			return fmt.Errorf("failed to amend commit: %w", err)
		}
		Printf("Cleaned stuck prefix from HEAD.\n")
		return nil
	}

	// 3. Otherwise, use git rebase -i to clean history
	oldestSha := targetCommits[len(targetCommits)-1]

	binaryPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	// Set up environment for rebase
	rebaseCmd := exec.Command("git", "rebase", "-i", oldestSha+"^")
	rebaseCmd.Stdout = os.Stdout
	rebaseCmd.Stderr = os.Stderr
	rebaseCmd.Env = append(os.Environ(),
		"GIT_SEQUENCE_EDITOR="+binaryPath+" internal-sequence-editor",
		"GIT_EDITOR="+binaryPath+" internal-commit-editor",
		"GIT_AI_INTERNAL=true", // Prevent git-ai post-commit hook
	)

	Printf("Rewriting history to clean [⏳] (from %s)...\n", oldestSha[:8])
	if err := rebaseCmd.Run(); err != nil {
		_ = exec.Command("git", "rebase", "--abort").Run()
		return fmt.Errorf("failed to rebase: %w", err)
	}

	Printf("Cleaned stuck prefix from %d commit(s).\n", len(targetCommits))
	return nil
}
