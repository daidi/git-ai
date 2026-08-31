package git

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestRewriteCommitMessageCASPreservesWorkspaceAndIndex(t *testing.T) {
	repo := initTestRepo(t)
	t.Chdir(repo)

	writeTestFile(t, filepath.Join(repo, "tracked.txt"), "committed\n")
	gitTestRun(t, repo, "add", "tracked.txt")
	gitTestRun(t, repo, "commit", "-m", "draft")
	originalSHA := strings.TrimSpace(gitTestRun(t, repo, "rev-parse", "HEAD"))
	originalTree := strings.TrimSpace(gitTestRun(t, repo, "show", "-s", "--format=%T", "HEAD"))

	writeTestFile(t, filepath.Join(repo, "tracked.txt"), "staged\n")
	gitTestRun(t, repo, "add", "tracked.txt")
	writeTestFile(t, filepath.Join(repo, "tracked.txt"), "unstaged\n")

	newSHA, err := RewriteCommitMessageCAS("refs/heads/main", originalSHA, "fix: polished")
	if err != nil {
		t.Fatalf("RewriteCommitMessageCAS() error = %v", err)
	}
	if newSHA == originalSHA {
		t.Fatal("rewrite did not create a new commit")
	}
	if got := strings.TrimSpace(gitTestRun(t, repo, "show", "-s", "--format=%B", "HEAD")); got != "fix: polished" {
		t.Fatalf("message = %q", got)
	}
	if got := strings.TrimSpace(gitTestRun(t, repo, "show", "-s", "--format=%T", "HEAD")); got != originalTree {
		t.Fatalf("tree changed: got %s want %s", got, originalTree)
	}
	if got := gitTestRun(t, repo, "show", "HEAD:tracked.txt"); got != "committed\n" {
		t.Fatalf("rewritten commit captured workspace content: %q", got)
	}
	if got := gitTestRun(t, repo, "show", ":tracked.txt"); got != "staged\n" {
		t.Fatalf("index changed: %q", got)
	}
	data, err := os.ReadFile(filepath.Join(repo, "tracked.txt"))
	if err != nil || string(data) != "unstaged\n" {
		t.Fatalf("worktree changed: data=%q err=%v", data, err)
	}
}

func TestRewriteCommitMessageCASRefMovedIsSafeNoOp(t *testing.T) {
	repo := initTestRepo(t)
	t.Chdir(repo)
	writeTestFile(t, filepath.Join(repo, "one.txt"), "one\n")
	gitTestRun(t, repo, "add", ".")
	gitTestRun(t, repo, "commit", "-m", "one")
	oldSHA := strings.TrimSpace(gitTestRun(t, repo, "rev-parse", "HEAD"))

	writeTestFile(t, filepath.Join(repo, "two.txt"), "two\n")
	gitTestRun(t, repo, "add", ".")
	gitTestRun(t, repo, "commit", "-m", "two")
	newHead := strings.TrimSpace(gitTestRun(t, repo, "rev-parse", "HEAD"))

	_, err := RewriteCommitMessageCAS("refs/heads/main", oldSHA, "wrong target")
	if !errors.Is(err, ErrRefMoved) {
		t.Fatalf("error = %v, want ErrRefMoved", err)
	}
	if got := strings.TrimSpace(gitTestRun(t, repo, "rev-parse", "HEAD")); got != newHead {
		t.Fatalf("HEAD moved: got %s want %s", got, newHead)
	}
}

func TestDetachedHeadRewriteDoesNotFollowANewSymbolicHead(t *testing.T) {
	repo := initTestRepo(t)
	t.Chdir(repo)
	writeTestFile(t, filepath.Join(repo, "one.txt"), "one\n")
	gitTestRun(t, repo, "add", ".")
	gitTestRun(t, repo, "commit", "-m", "one")
	original := strings.TrimSpace(gitTestRun(t, repo, "rev-parse", "HEAD"))
	gitTestRun(t, repo, "switch", "--detach", original)
	targetRef, err := GetHeadRef()
	if err != nil || targetRef != "HEAD" {
		t.Fatalf("detached target ref = %q, %v", targetRef, err)
	}

	gitTestRun(t, repo, "switch", "-c", "other")
	_, err = RewriteCommitMessageCAS(targetRef, original, "must not rewrite other")
	if !errors.Is(err, ErrRefMoved) {
		t.Fatalf("error = %v, want ErrRefMoved", err)
	}
	if got := strings.TrimSpace(gitTestRun(t, repo, "rev-parse", "refs/heads/other")); got != original {
		t.Fatalf("new symbolic branch moved: got %s want %s", got, original)
	}
}

func TestDetachedHeadRewriteUsesNoDeref(t *testing.T) {
	repo := initTestRepo(t)
	t.Chdir(repo)
	writeTestFile(t, filepath.Join(repo, "one.txt"), "one\n")
	gitTestRun(t, repo, "add", ".")
	gitTestRun(t, repo, "commit", "-m", "one")
	original := strings.TrimSpace(gitTestRun(t, repo, "rev-parse", "HEAD"))
	gitTestRun(t, repo, "switch", "--detach", original)

	rewritten, err := RewriteCommitMessageCAS("HEAD", original, "fix: detached")
	if err != nil {
		t.Fatal(err)
	}
	if rewritten == original {
		t.Fatal("detached HEAD was not rewritten")
	}
	if _, err := exec.Command("git", "symbolic-ref", "-q", "HEAD").Output(); err == nil {
		t.Fatal("detached HEAD became symbolic")
	}
}

func TestGetDiffIncludesInitialCommitAndWorktreesHaveDistinctGitDirs(t *testing.T) {
	repo := initTestRepo(t)
	t.Chdir(repo)
	writeTestFile(t, filepath.Join(repo, "initial.txt"), "hello\n")
	gitTestRun(t, repo, "add", ".")
	gitTestRun(t, repo, "commit", "-m", "initial")
	sha := strings.TrimSpace(gitTestRun(t, repo, "rev-parse", "HEAD"))
	diff, err := GetDiff(sha)
	if err != nil || !strings.Contains(diff, "+hello") {
		t.Fatalf("GetDiff(initial) = %q, %v", diff, err)
	}
	mainGitDir, err := GetGitDir()
	if err != nil {
		t.Fatal(err)
	}

	worktree := filepath.Join(t.TempDir(), "linked")
	gitTestRun(t, repo, "worktree", "add", "-b", "linked", worktree)
	if err := os.Chdir(worktree); err != nil {
		t.Fatal(err)
	}
	linkedGitDir, err := GetGitDir()
	if err != nil {
		t.Fatal(err)
	}
	if linkedGitDir == mainGitDir {
		t.Fatalf("linked worktree shared Git dir %q", linkedGitDir)
	}
}

func TestHookPathMustStayInsideRepositoryGitMetadata(t *testing.T) {
	repo := initTestRepo(t)
	t.Chdir(repo)
	defaultHook, err := GetHookPath("post-commit")
	if err != nil {
		t.Fatal(err)
	}
	if safe, err := IsRepositoryScopedHookPath(defaultHook); err != nil || !safe {
		t.Fatalf("default hook path rejected: safe=%t err=%v path=%s", safe, err, defaultHook)
	}

	external := filepath.Join(t.TempDir(), "shared-hooks")
	gitTestRun(t, repo, "config", "--local", "core.hooksPath", external)
	externalHook, err := GetHookPath("pre-push")
	if err != nil {
		t.Fatal(err)
	}
	if safe, err := IsRepositoryScopedHookPath(externalHook); err != nil || safe {
		t.Fatalf("external hook path accepted: safe=%t err=%v path=%s", safe, err, externalHook)
	}

	gitTestRun(t, repo, "config", "--local", "core.hooksPath", ".githooks")
	worktreeHook, err := GetHookPath("post-commit")
	if err != nil {
		t.Fatal(err)
	}
	if safe, err := IsRepositoryScopedHookPath(worktreeHook); err != nil || safe {
		t.Fatalf("worktree hook path accepted: safe=%t err=%v path=%s", safe, err, worktreeHook)
	}

	gitDir, err := GetCommonGitDir()
	if err != nil {
		t.Fatal(err)
	}
	symlinkTarget := filepath.Join(t.TempDir(), "outside")
	if err := os.MkdirAll(symlinkTarget, 0o700); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(gitDir, "linked-hooks")
	if err := os.Symlink(symlinkTarget, link); err != nil {
		if runtime.GOOS == "windows" {
			t.Skipf("symlink unavailable: %v", err)
		}
		t.Fatal(err)
	}
	gitTestRun(t, repo, "config", "--local", "core.hooksPath", filepath.Join(link, "not-created"))
	symlinkHook, err := GetHookPath("pre-push")
	if err != nil {
		t.Fatal(err)
	}
	if safe, err := IsRepositoryScopedHookPath(symlinkHook); err != nil || safe {
		t.Fatalf("symlink-escaping hook path accepted: safe=%t err=%v path=%s", safe, err, symlinkHook)
	}
}

func TestRunGitLimitedRejectsOversizedOutput(t *testing.T) {
	repo := initTestRepo(t)
	t.Chdir(repo)
	writeTestFile(t, filepath.Join(repo, "one.txt"), "one\n")
	gitTestRun(t, repo, "add", ".")
	gitTestRun(t, repo, "commit", "-m", "one")
	if _, err := runGitLimited(4, "rev-parse", "HEAD"); !errors.Is(err, ErrOutputTooLarge) {
		t.Fatalf("runGitLimited error = %v, want ErrOutputTooLarge", err)
	}
}

func initTestRepo(t *testing.T) string {
	t.Helper()
	repo := t.TempDir()
	gitTestRun(t, repo, "init", "-b", "main")
	gitTestRun(t, repo, "config", "user.name", "Git AI Test")
	gitTestRun(t, repo, "config", "user.email", "git-ai@example.invalid")
	gitTestRun(t, repo, "config", "commit.gpgsign", "false")
	return repo
}

func gitTestRun(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return string(out)
}

func writeTestFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}
