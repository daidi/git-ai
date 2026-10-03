package hooks

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/daidi/git-ai/cli/internal/config"
	gitpkg "github.com/daidi/git-ai/cli/internal/git"
	"github.com/daidi/git-ai/cli/internal/state"
)

func TestRunPostCommitKeepsValidMessageWithoutStartingOperation(t *testing.T) {
	repo := initPostCommitTestRepo(t)
	t.Chdir(repo)
	t.Setenv("GIT_AI_CONFIG_DIR", filepath.Join(t.TempDir(), "config"))
	t.Setenv("GIT_AI_STATE_DIR", filepath.Join(t.TempDir(), "state"))
	t.Setenv("GIT_AI_INTERNAL", "")
	t.Setenv("GIT_AI_SKIP", "")
	commitPostCommitFixture(t, repo, "one.txt", "one\n", "feat: add fixture")
	if err := config.SetLocal(repo, "commit_attribution", "compact"); err != nil {
		t.Fatal(err)
	}
	wantSHA := strings.TrimSpace(postCommitGit(t, repo, "rev-parse", "HEAD"))

	if err := RunPostCommit(false, ""); err != nil {
		t.Fatal(err)
	}
	if got := strings.TrimSpace(postCommitGit(t, repo, "rev-parse", "HEAD")); got != wantSHA {
		t.Fatalf("smart skip rewrote HEAD: got %s want %s", got, wantSHA)
	}
	if got := strings.TrimSpace(postCommitGit(t, repo, "show", "-s", "--format=%B", "HEAD")); got != "feat: add fixture" {
		t.Fatalf("smart skip changed message: %q", got)
	}
	gitDir, err := gitpkg.GetGitDir()
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := state.NewManager(gitDir).Load()
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.CurrentStatus != state.StatusIdle || snapshot.OperationID != "" {
		t.Fatalf("smart skip started an operation: %#v", snapshot)
	}
}

func TestSmartSkipRequiresValidMessageDifferentFromParent(t *testing.T) {
	repo := initPostCommitTestRepo(t)
	t.Chdir(repo)
	t.Setenv("GIT_AI_CONFIG_DIR", filepath.Join(t.TempDir(), "config"))

	commitPostCommitFixture(t, repo, "one.txt", "one\n", "feat: add first fixture")
	rootSHA := postCommitGit(t, repo, "rev-parse", "HEAD")
	if !shouldSmartSkipPolish(strings.TrimSpace(rootSHA), "feat: add first fixture") {
		t.Fatal("valid root commit was not kept")
	}

	commitPostCommitFixture(t, repo, "two.txt", "two\n", "feat: add first fixture")
	repeatedSHA := strings.TrimSpace(postCommitGit(t, repo, "rev-parse", "HEAD"))
	if shouldSmartSkipPolish(repeatedSHA, "feat: add first fixture") {
		t.Fatal("message repeated from the parent was kept")
	}

	commitPostCommitFixture(t, repo, "three.txt", "three\n", "fix: add third fixture")
	validSHA := strings.TrimSpace(postCommitGit(t, repo, "rev-parse", "HEAD"))
	if !shouldSmartSkipPolish(validSHA, "fix: add third fixture") {
		t.Fatal("new valid message was not kept")
	}

	commitPostCommitFixture(t, repo, "four.txt", "four\n", "wip")
	invalidSHA := strings.TrimSpace(postCommitGit(t, repo, "rev-parse", "HEAD"))
	if shouldSmartSkipPolish(invalidSHA, "wip") {
		t.Fatal("invalid message bypassed polishing")
	}
}

func TestSmartSkipCanBeDisabledAndDoesNotGuessCustomPromptFormat(t *testing.T) {
	repo := initPostCommitTestRepo(t)
	t.Chdir(repo)
	t.Setenv("GIT_AI_CONFIG_DIR", filepath.Join(t.TempDir(), "config"))
	commitPostCommitFixture(t, repo, "one.txt", "one\n", "feat: add fixture")
	sha := strings.TrimSpace(postCommitGit(t, repo, "rev-parse", "HEAD"))

	if err := config.SetLocal(repo, "smart_skip", "false"); err != nil {
		t.Fatal(err)
	}
	if shouldSmartSkipPolish(sha, "feat: add fixture") {
		t.Fatal("disabled smart skip kept a message")
	}

	if err := config.SetLocal(repo, "smart_skip", "true"); err != nil {
		t.Fatal(err)
	}
	if err := config.SetLocal(repo, "prompt_template", "Use the team's private format"); err != nil {
		t.Fatal(err)
	}
	if shouldSmartSkipPolish(sha, "feat: add fixture") {
		t.Fatal("custom prompt format was guessed")
	}
}

func TestSmartSkipIgnoresAttributionWhenCheckingFormatAndRepetition(t *testing.T) {
	repo := initPostCommitTestRepo(t)
	t.Chdir(repo)
	t.Setenv("GIT_AI_CONFIG_DIR", t.TempDir())
	if err := config.SetLocal(repo, "message_format", "plain"); err != nil {
		t.Fatal(err)
	}
	message := "Add fixture\n\nPolished-by: Git AI <https://codegg.org/git-ai/>"
	commitPostCommitFixture(t, repo, "one.txt", "one\n", message)
	sha := strings.TrimSpace(postCommitGit(t, repo, "rev-parse", "HEAD"))
	if !shouldSmartSkipPolish(sha, message) {
		t.Fatal("attribution invalidated a plain message")
	}
	commitPostCommitFixture(t, repo, "two.txt", "two\n", "Add fixture")
	sha = strings.TrimSpace(postCommitGit(t, repo, "rev-parse", "HEAD"))
	if shouldSmartSkipPolish(sha, "Add fixture") {
		t.Fatal("removing attribution hid a repeated message")
	}
}

func TestRunPostCommitAlwaysSkipsAutosquashMessages(t *testing.T) {
	for _, message := range []string{
		"fixup! feat: add fixture",
		"squash! feat: add fixture",
		"amend! feat: add fixture",
	} {
		t.Run(strings.Fields(message)[0], func(t *testing.T) {
			repo := initPostCommitTestRepo(t)
			t.Chdir(repo)
			t.Setenv("GIT_AI_CONFIG_DIR", filepath.Join(t.TempDir(), "config"))
			t.Setenv("GIT_AI_STATE_DIR", filepath.Join(t.TempDir(), "state"))
			t.Setenv("GIT_AI_INTERNAL", "")
			t.Setenv("GIT_AI_SKIP", "")
			if err := config.SetLocal(repo, "smart_skip", "false"); err != nil {
				t.Fatal(err)
			}
			commitPostCommitFixture(t, repo, "fixture.txt", "fixture\n", message)
			wantSHA := strings.TrimSpace(postCommitGit(t, repo, "rev-parse", "HEAD"))

			if err := RunPostCommit(false, ""); err != nil {
				t.Fatal(err)
			}
			if got := strings.TrimSpace(postCommitGit(t, repo, "rev-parse", "HEAD")); got != wantSHA {
				t.Fatalf("autosquash commit changed: got %s want %s", got, wantSHA)
			}

			gitDir, err := gitpkg.GetGitDir()
			if err != nil {
				t.Fatal(err)
			}
			snapshot, err := state.NewManager(gitDir).Load()
			if err != nil {
				t.Fatal(err)
			}
			if snapshot.CurrentStatus != state.StatusIdle || snapshot.OperationID != "" {
				t.Fatalf("autosquash commit started an operation: %#v", snapshot)
			}
		})
	}
}

func TestAutosquashMessageDetectionUsesTheSubjectPrefix(t *testing.T) {
	for _, message := range []string{
		"fixup! target\n\nbody",
		"squash! target\r\n\r\nbody",
		"amend! target",
	} {
		if !isAutosquashCommitMessage(message) {
			t.Errorf("autosquash message not detected: %q", message)
		}
	}
	for _, message := range []string{"fixup target", "Fixup! target", "prefix fixup! target", "fixup!"} {
		if isAutosquashCommitMessage(message) {
			t.Errorf("ordinary message treated as autosquash: %q", message)
		}
	}
}

func initPostCommitTestRepo(t *testing.T) string {
	t.Helper()
	repo := t.TempDir()
	postCommitGit(t, repo, "init", "-b", "main")
	postCommitGit(t, repo, "config", "user.name", "Git AI Test")
	postCommitGit(t, repo, "config", "user.email", "git-ai@example.invalid")
	postCommitGit(t, repo, "config", "commit.gpgsign", "false")
	return repo
}

func commitPostCommitFixture(t *testing.T, repo, name, content, message string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(repo, name), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	postCommitGit(t, repo, "add", name)
	postCommitGit(t, repo, "commit", "-m", message)
}

func postCommitGit(t *testing.T, repo string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = repo
	cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return string(out)
}
