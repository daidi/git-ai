// Package git provides helpers for interacting with the local Git repository.
package git

import (
	"bytes"
	"errors"
	"fmt"
	"io"
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

// ErrOutputTooLarge prevents a pathological commit or repository file from
// consuming unbounded daemon memory.
var ErrOutputTooLarge = errors.New("git output exceeded the safety limit")

const (
	maxCommitMessageBytes = 64 << 10
	maxDiffBytes          = 8 << 20
	maxDiffStatBytes      = 1 << 20
	maxCommitObjectBytes  = 2 << 20
	maxIgnoreFileBytes    = 64 << 10
)

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

// GetCommonGitDir returns the shared Git metadata directory. Linked worktrees
// have distinct actual Git directories but intentionally share hooks here.
func GetCommonGitDir() (string, error) {
	out, err := runGit("rev-parse", "--path-format=absolute", "--git-common-dir")
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

// IsRepositoryScopedHookPath rejects global/shared core.hooksPath locations and
// hook directories inside the worktree. Installing there would make one
// project's plugin affect unrelated repositories or modify user-owned files.
func IsRepositoryScopedHookPath(hookPath string) (bool, error) {
	commonDir, err := GetCommonGitDir()
	if err != nil {
		return false, err
	}
	base := canonicalDirectory(commonDir)
	targetDir := canonicalDirectory(filepath.Dir(hookPath))
	relative, err := filepath.Rel(base, targetDir)
	if err != nil {
		return false, err
	}
	return relative == "." || (relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))), nil
}

func canonicalDirectory(path string) string {
	if absolute, err := filepath.Abs(path); err == nil {
		path = absolute
	}
	path = filepath.Clean(path)

	// EvalSymlinks requires the full path to exist. Resolve the nearest
	// existing ancestor so a custom hooks path cannot escape through a symlink
	// and then append a not-yet-created child directory.
	current := path
	var missing []string
	for {
		if evaluated, err := filepath.EvalSymlinks(current); err == nil {
			parts := append([]string{evaluated}, reverseStrings(missing)...)
			return filepath.Clean(filepath.Join(parts...))
		}
		parent := filepath.Dir(current)
		if parent == current {
			break
		}
		missing = append(missing, filepath.Base(current))
		current = parent
	}
	return path
}

func reverseStrings(values []string) []string {
	result := make([]string, len(values))
	for index := range values {
		result[len(values)-1-index] = values[index]
	}
	return result
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

// RefMatches reports whether a ref still resolves to the expected object.
func RefMatches(ref, expectedSHA string) (bool, error) {
	if ref == "" || expectedSHA == "" {
		return false, nil
	}
	current, err := runGit("rev-parse", "--verify", ref)
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(current) == expectedSHA, nil
}

// GetLastCommitMsg returns the commit message of HEAD.
func GetLastCommitMsg() (string, error) {
	out, err := runGitLimited(maxCommitMessageBytes, "log", "-1", "--format=%B")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

// GetCommitMsg returns the full message for one commit.
func GetCommitMsg(sha string) (string, error) {
	out, err := runGitLimited(maxCommitMessageBytes, "show", "-s", "--format=%B", sha)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

// GetLegacyAINote reads only the bounded, read-only notes created by old
// releases. New versions never write Git notes.
func GetLegacyAINote(sha string) (string, error) {
	return runGitLimited(64<<10, "notes", "--ref=git-ai", "show", sha)
}

// GetRecentCommitSHAs returns a bounded list used by IDE history views.
func GetRecentCommitSHAs(limit int) (string, error) {
	if limit < 1 || limit > 500 {
		return "", errors.New("invalid commit history limit")
	}
	return runGitLimited(128<<10, "log", "-n", fmt.Sprintf("%d", limit), "--format=%H")
}

// GetDiff returns the diff introduced by a given commit SHA.
func GetDiff(sha string) (string, error) {
	ignores := getIgnoreArgs()
	args := []string{"show", "--format=", "--no-ext-diff", "--root", sha}
	if len(ignores) > 0 {
		args = append(args, "--", ".")
		args = append(args, ignores...)
	}
	return runGitLimited(maxDiffBytes, args...)
}

// GetDiffStat returns a summary of changed files for a commit.
func GetDiffStat(sha string) (string, error) {
	ignores := getIgnoreArgs()
	args := []string{"show", "--format=", "--stat", "--root", sha}
	if len(ignores) > 0 {
		args = append(args, "--", ".")
		args = append(args, ignores...)
	}

	return runGitLimited(maxDiffStatBytes, args...)
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
	info, statErr := os.Lstat(ignoreFile)
	if statErr == nil && info.Mode().IsRegular() && info.Size() <= maxIgnoreFileBytes {
		data, err := os.ReadFile(ignoreFile)
		if err != nil {
			return ignores
		}
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
	// "HEAD" is recorded only for a detached checkout. If it has since become
	// symbolic (even to a branch at the same SHA), following it would rewrite a
	// different ref than the one the operation started on.
	if targetRef == "HEAD" {
		if err := exec.Command("git", "symbolic-ref", "-q", "HEAD").Run(); err == nil {
			return "", ErrRefMoved
		}
	}
	matches, err := RefMatches(targetRef, expectedSHA)
	if err != nil || !matches {
		return "", ErrRefMoved
	}

	raw, err := runGitLimited(maxCommitObjectBytes, "cat-file", "-p", expectedSHA)
	if err != nil {
		return "", fmt.Errorf("read target commit: %w", err)
	}
	for _, line := range strings.Split(raw, "\n") {
		if line == "" {
			break
		}
		if strings.HasPrefix(line, "gpgsig ") || strings.HasPrefix(line, "gpgsig-sha256 ") {
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
	updateArgs := []string{"update-ref"}
	if targetRef == "HEAD" {
		updateArgs = append(updateArgs, "--no-deref")
	}
	updateArgs = append(updateArgs, "-m", "git-ai: polish commit message", targetRef, newSHA, expectedSHA)
	update := exec.Command("git", updateArgs...)
	update.Env = append(os.Environ(), "GIT_AI_INTERNAL=true")
	if output, err := update.CombinedOutput(); err != nil {
		if current, readErr := runGit("rev-parse", targetRef); readErr == nil && strings.TrimSpace(current) != expectedSHA {
			return "", ErrRefMoved
		}
		return "", fmt.Errorf("advance target ref: %s: %w", strings.TrimSpace(string(output)), err)
	}
	return newSHA, nil
}

// Push pushes to the specified remote. Sets GIT_AI_INTERNAL=true.
// Stderr is captured and included in the returned error for classification.
func Push(remote string, refSpecs []string) error {
	args := []string{"push", "--", remote}
	args = append(args, refSpecs...)
	// Fallback: if no refSpecs, just push current branch.
	if len(refSpecs) == 0 {
		args = []string{"push", "--", remote}
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

func runGitLimited(maxBytes int64, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", err
	}
	if err := cmd.Start(); err != nil {
		return "", err
	}
	data, readErr := io.ReadAll(io.LimitReader(stdout, maxBytes+1))
	if readErr != nil {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		return "", readErr
	}
	if int64(len(data)) > maxBytes {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
		return "", ErrOutputTooLarge
	}
	if err := cmd.Wait(); err != nil {
		return "", err
	}
	return string(data), nil
}
