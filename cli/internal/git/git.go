// Package git provides helpers for interacting with the local Git repository.
package git

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// ErrRefMoved means the target reference no longer points at the commit that
// git-ai was asked to rewrite. Callers must treat this as a safe no-op.
var ErrRefMoved = errors.New("target Git reference moved")

// ErrSignedCommit means rewriting would invalidate an existing signature.
var ErrSignedCommit = errors.New("signed commits are not rewritten automatically")

// GetRepoRoot returns the absolute path to the repository root.
func GetRepoRoot() (string, error) {
	out, err := runGit("rev-parse", "--show-toplevel")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

// GetGitDir returns the absolute Git directory for the current worktree. Linked
// worktrees must not share runtime state because each has an independent HEAD.
func GetGitDir() (string, error) {
	out, err := runGit("rev-parse", "--absolute-git-dir")
	if err != nil {
		return "", err
	}
	return filepath.Clean(strings.TrimSpace(out)), nil
}

// GetHookPath resolves a hook through Git so core.hooksPath and worktrees are
// handled correctly.
func GetHookPath(name string) (string, error) {
	out, err := runGit("rev-parse", "--path-format=absolute", "--git-path", "hooks/"+name)
	if err != nil {
		return "", err
	}
	return filepath.Clean(strings.TrimSpace(out)), nil
}

// GetHeadRef returns the symbolic branch ref or HEAD for detached checkouts.
func GetHeadRef() (string, error) {
	out, err := runGit("symbolic-ref", "-q", "HEAD")
	if err == nil {
		return strings.TrimSpace(out), nil
	}
	if _, headErr := GetLastCommitSHA(); headErr != nil {
		return "", headErr
	}
	return "HEAD", nil
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

// GetCommitMsg returns the full message for one commit.
func GetCommitMsg(sha string) (string, error) {
	out, err := runGit("show", "-s", "--format=%B", sha)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

// GetDiff returns the diff introduced by a given commit SHA.
func GetDiff(sha string) (string, error) {
	ignores := getIgnoreArgs()
	args := []string{"show", "--format=", "--no-ext-diff", "--root", sha}
	if len(ignores) > 0 {
		args = append(args, "--", ".")
		args = append(args, ignores...)
	}
	return runGit(args...)
}

// GetDiffStat returns a summary of changed files for a commit.
func GetDiffStat(sha string) (string, error) {
	ignores := getIgnoreArgs()
	args := []string{"show", "--format=", "--stat", "--root", sha}
	if len(ignores) > 0 {
		args = append(args, "--", ".")
		args = append(args, ignores...)
	}

	return runGit(args...)
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

// RewriteCommitMessageCAS creates a replacement commit object from the target
// commit and advances targetRef only if it still equals expectedSHA. It never
// reads from or changes the index/worktree, so staged or unstaged user changes
// cannot leak into the rewritten commit.
func RewriteCommitMessageCAS(targetRef, expectedSHA, msg string) (string, error) {
	if targetRef == "" {
		return "", errors.New("target ref is empty")
	}
	current, err := runGit("rev-parse", targetRef)
	if err != nil || strings.TrimSpace(current) != expectedSHA {
		return "", ErrRefMoved
	}

	raw, err := runGit("cat-file", "-p", expectedSHA)
	if err != nil {
		return "", fmt.Errorf("read target commit: %w", err)
	}
	for _, line := range strings.Split(raw, "\n") {
		if line == "" {
			break
		}
		if strings.HasPrefix(line, "gpgsig ") {
			return "", ErrSignedCommit
		}
	}

	meta, err := runGit("show", "-s", "--format=%T%x00%P%x00%an%x00%ae%x00%aI%x00%cn%x00%ce", expectedSHA)
	if err != nil {
		return "", fmt.Errorf("read commit metadata: %w", err)
	}
	parts := strings.Split(strings.TrimSuffix(meta, "\n"), "\x00")
	if len(parts) != 7 {
		return "", errors.New("unexpected commit metadata")
	}
	args := []string{"commit-tree", parts[0]}
	for _, parent := range strings.Fields(parts[1]) {
		args = append(args, "-p", parent)
	}
	args = append(args, "-F", "-")
	cmd := exec.Command("git", args...)
	cmd.Stdin = strings.NewReader(msg)
	cmd.Env = append(os.Environ(),
		"GIT_AI_INTERNAL=true",
		"GIT_AUTHOR_NAME="+parts[2],
		"GIT_AUTHOR_EMAIL="+parts[3],
		"GIT_AUTHOR_DATE="+parts[4],
		"GIT_COMMITTER_NAME="+parts[5],
		"GIT_COMMITTER_EMAIL="+parts[6],
	)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	created, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("create replacement commit: %s: %w", strings.TrimSpace(stderr.String()), err)
	}
	newSHA := strings.TrimSpace(string(created))
	update := exec.Command("git", "update-ref", "-m", "git-ai: polish commit message", targetRef, newSHA, expectedSHA)
	update.Env = append(os.Environ(), "GIT_AI_INTERNAL=true")
	if output, err := update.CombinedOutput(); err != nil {
		if current, readErr := runGit("rev-parse", targetRef); readErr == nil && strings.TrimSpace(current) != expectedSHA {
			return "", ErrRefMoved
		}
		return "", fmt.Errorf("advance target ref: %s: %w", strings.TrimSpace(string(output)), err)
	}
	return newSHA, nil
}

// AddNotes adds or overwrites git notes for a specific commit.
func AddNotes(sha string, noteMsg string) error {
	cmd := exec.Command("git", "notes", "--ref=git-ai", "add", "-f", "-m", noteMsg, sha)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// Push pushes to the specified remote. Sets GIT_AI_INTERNAL=true.
// Stderr is captured and included in the returned error for classification.
func Push(remote string, refSpecs []string) error {
	args := []string{"push", remote}
	args = append(args, refSpecs...)
	// Fallback: if no refSpecs, just push current branch.
	if len(refSpecs) == 0 {
		args = []string{"push", remote}
	}

	cmd := exec.Command("git", args...)
	cmd.Env = append(os.Environ(), "GIT_AI_INTERNAL=true", "GIT_TERMINAL_PROMPT=0")
	var stderr bytes.Buffer
	cmd.Stdout = os.Stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if s := strings.TrimSpace(stderr.String()); s != "" {
			return fmt.Errorf("%w: %s", err, s)
		}
		return err
	}
	return nil
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

// CanPushSilently checks if background push is possible without
// interactive prompts. Returns (ok, reason).
func CanPushSilently(remote string) (bool, string) {
	if IsSSHRemote(remote) {
		if os.Getenv("SSH_AUTH_SOCK") == "" {
			return false, "SSH agent not detected (SSH_AUTH_SOCK not set). Background push will fail."
		}
		if err := exec.Command("ssh-add", "-l").Run(); err != nil {
			return false, "No SSH keys loaded in agent. Run 'ssh-add' to load your key."
		}
		return true, ""
	}

	// HTTPS: check that a credential helper is configured so Git won't
	// try to prompt for a username/password (which fails in a daemon).
	out, err := runGit("config", "--get", "credential.helper")
	if err != nil || strings.TrimSpace(out) == "" {
		return false, "No Git credential helper configured. Background push requires saved credentials."
	}
	return true, ""
}

// CredentialHelperHint returns the platform-appropriate command to set up a credential helper.
func CredentialHelperHint() string {
	switch runtime.GOOS {
	case "darwin":
		return "git config --global credential.helper osxkeychain"
	case "linux":
		return "git config --global credential.helper store"
	default:
		return "git config --global credential.helper manager"
	}
}

// IsMergeCommit checks if HEAD is a merge commit (has more than one parent).
func IsMergeCommit() (bool, error) {
	out, err := runGit("show", "-s", "--format=%P", "HEAD")
	if err != nil {
		return false, err
	}
	return strings.Contains(strings.TrimSpace(out), " "), nil
}

// IsRebaseOrMergeInProgress checks if a rebase, merge, cherry-pick, revert, or bisect is in progress.
func IsRebaseOrMergeInProgress() bool {
	gitDir, err := GetGitDir()
	if err != nil {
		return false
	}
	paths := []string{
		"rebase-merge",
		"rebase-apply",
		"CHERRY_PICK_HEAD",
		"REVERT_HEAD",
		"BISECT_LOG",
		"MERGE_HEAD",
	}
	for _, p := range paths {
		if _, err := os.Stat(filepath.Join(gitDir, p)); err == nil {
			return true
		}
	}
	return false
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
