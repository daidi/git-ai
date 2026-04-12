// Package git provides helpers for interacting with the local Git repository.
package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// GetRepoRoot returns the absolute path to the repository root.
func GetRepoRoot() (string, error) {
	out, err := runGit("rev-parse", "--show-toplevel")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

// GetGitDir returns the path to the .git directory.
func GetGitDir() (string, error) {
	out, err := runGit("rev-parse", "--git-dir")
	if err != nil {
		return "", err
	}
	path := strings.TrimSpace(out)
	if !filepath.IsAbs(path) {
		root, err := GetRepoRoot()
		if err != nil {
			return "", err
		}
		path = filepath.Join(root, path)
	}
	return path, nil
}

// GetLastCommitSHA returns the SHA of the last commit (HEAD).
func GetLastCommitSHA() (string, error) {
	out, err := runGit("rev-parse", "HEAD")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

// GetLastCommitMsg returns the commit message of HEAD.
func GetLastCommitMsg() (string, error) {
	out, err := runGit("log", "-1", "--format=%B")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

// GetDiff returns the diff introduced by a given commit SHA.
func GetDiff(sha string) (string, error) {
	ignores := getIgnoreArgs()
	args := []string{"diff", sha + "~1.." + sha}
	if len(ignores) > 0 {
		args = append(args, "--", ".")
		args = append(args, ignores...)
	}

	out, err := runGit(args...)
	if err != nil {
		// Might be the initial commit — fallback to diff against empty tree.
		args = []string{"diff", "--cached", sha}
		if len(ignores) > 0 {
			args = append(args, "--", ".")
			args = append(args, ignores...)
		}
		out, err = runGit(args...)
		if err != nil {
			return "", err
		}
	}
	return out, nil
}

// GetDiffStat returns a summary of changed files for a commit.
func GetDiffStat(sha string) (string, error) {
	ignores := getIgnoreArgs()
	args := []string{"diff", "--stat", sha + "~1.." + sha}
	if len(ignores) > 0 {
		args = append(args, "--", ".")
		args = append(args, ignores...)
	}

	out, err := runGit(args...)
	if err != nil {
		args = []string{"diff", "--stat", "--cached", sha}
		if len(ignores) > 0 {
			args = append(args, "--", ".")
			args = append(args, ignores...)
		}
		out, err = runGit(args...)
		if err != nil {
			return "", err
		}
	}
	return out, nil
}

// getIgnoreArgs returns pathspecs to ignore when generating dicts.
// It includes defaults (-lock.*, *.lock, go.sum...) and parses .git-ai-ignore.
func getIgnoreArgs() []string {
	ignores := []string{
		":(exclude)*-lock.*",
		":(exclude)*.lock",
		":(exclude)go.sum",
	}

	repoRoot, err := GetRepoRoot()
	if err != nil {
		return ignores
	}

	ignoreFile := filepath.Join(repoRoot, ".git-ai-ignore")
	data, err := os.ReadFile(ignoreFile)
	if err == nil {
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line != "" && !strings.HasPrefix(line, "#") {
				ignores = append(ignores, ":(exclude)"+line)
			}
		}
	}
	return ignores
}

// Amend replaces the last commit message. Sets GIT_AI_INTERNAL=true to
// prevent the post-commit hook from re-triggering.
func Amend(msg string) error {
	cmd := exec.Command("git", "commit", "--amend", "-m", msg, "--no-edit", "--allow-empty")
	cmd.Env = append(os.Environ(), "GIT_AI_INTERNAL=true")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// Push pushes to the specified remote. Sets GIT_AI_INTERNAL=true.
func Push(remote string, refSpecs []string) error {
	args := []string{"push", remote}
	// If we have specific refs saved from pre-push, extract the local ref to push.
	for _, spec := range refSpecs {
		parts := strings.Fields(spec)
		if len(parts) >= 1 {
			args = append(args, parts[0])
		}
	}
	// Fallback: if no refSpecs, just push current branch.
	if len(refSpecs) == 0 {
		args = []string{"push", remote}
	}

	cmd := exec.Command("git", args...)
	cmd.Env = append(os.Environ(), "GIT_AI_INTERNAL=true")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// GetCurrentBranch returns the current branch name.
func GetCurrentBranch() (string, error) {
	out, err := runGit("rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

// IsSSHRemote checks whether the remote URL uses SSH.
func IsSSHRemote(remote string) bool {
	url, err := runGit("remote", "get-url", remote)
	if err != nil {
		return false
	}
	url = strings.TrimSpace(url)
	return strings.HasPrefix(url, "git@") || strings.HasPrefix(url, "ssh://")
}

// CanPushSilently checks if background push is possible (SSH agent available).
// Returns (ok, reason).
func CanPushSilently(remote string) (bool, string) {
	if !IsSSHRemote(remote) {
		return true, "" // HTTPS — no issue
	}
	if os.Getenv("SSH_AUTH_SOCK") == "" {
		return false, "SSH agent not detected (SSH_AUTH_SOCK not set). Background push will fail."
	}
	if err := exec.Command("ssh-add", "-l").Run(); err != nil {
		return false, "No SSH keys loaded in agent. Run 'ssh-add' to load your key."
	}
	return true, ""
}

// runGit executes a git command and returns its stdout.
func runGit(args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return string(out), nil
}
