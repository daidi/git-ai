package cmd

import (
	"os/exec"
	"strings"
	"testing"

	"github.com/daidi/git-ai/cli/internal/git"
	"github.com/daidi/git-ai/cli/internal/state"
)

func TestAttributionConfigJSONContract(t *testing.T) {
	for _, mode := range []string{"off", "compact"} {
		cfg, _, err := decodeAndValidateConfig([]byte(`{"commit_attribution":"` + mode + `"}`))
		if err != nil || cfg.CommitAttribution != mode {
			t.Fatalf("mode %s: cfg=%v err=%v", mode, cfg, err)
		}
	}
	if _, _, err := decodeAndValidateConfig([]byte(`{"commit_attribution":"custom"}`)); err == nil {
		t.Fatal("unsupported attribution mode accepted")
	}
}

func TestUndoRestoresMessageBeforeAttribution(t *testing.T) {
	repo := t.TempDir()
	t.Chdir(repo)
	t.Setenv("GIT_AI_STATE_DIR", t.TempDir())
	t.Setenv("GIT_AI_INTERNAL", "true")
	runGit := func(args ...string) string {
		t.Helper()
		out, err := exec.Command("git", args...).CombinedOutput()
		if err != nil {
			t.Fatalf("git %v: %v\n%s", args, err, out)
		}
		return strings.TrimSpace(string(out))
	}
	runGit("init", "-b", "main")
	runGit("config", "user.name", "Git AI Test")
	runGit("config", "user.email", "test@example.invalid")
	runGit("config", "commit.gpgsign", "false")
	original := "wip\n\nSigned-off-by: Alice <alice@example.com>"
	runGit("commit", "--allow-empty", "-m", original)
	originalSHA := runGit("rev-parse", "HEAD")
	originalTree := runGit("rev-parse", "HEAD^{tree}")
	polished := "fix: handle timeout\n\nSigned-off-by: Alice <alice@example.com>\nPolished-by: Git AI <https://codegg.org/git-ai/>"
	resultSHA, err := git.RewriteCommitMessageCAS("refs/heads/main", originalSHA, polished)
	if err != nil {
		t.Fatal(err)
	}
	gitDir, err := git.GetGitDir()
	if err != nil {
		t.Fatal(err)
	}
	mgr := state.NewManager(gitDir)
	if err := mgr.Save(&state.State{CurrentStatus: state.StatusIdle, OriginalMsg: original, LastSHA: originalSHA, ResultSHA: resultSHA, TargetRef: "refs/heads/main"}); err != nil {
		t.Fatal(err)
	}
	if err := runUndo(nil, nil); err != nil {
		t.Fatal(err)
	}
	if message := runGit("show", "-s", "--format=%B", "HEAD"); message != original {
		t.Fatalf("undo message = %q, want %q", message, original)
	}
	if tree := runGit("rev-parse", "HEAD^{tree}"); tree != originalTree {
		t.Fatal("undo changed the committed tree")
	}
	snapshot, err := mgr.Load()
	if err != nil || snapshot.ResultSHA != "" || snapshot.OriginalMsg != "" {
		t.Fatalf("undo state = %#v, err = %v", snapshot, err)
	}
}
