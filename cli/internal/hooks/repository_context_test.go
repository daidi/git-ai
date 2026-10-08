package hooks

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/daidi/git-ai/cli/internal/ai"
	"github.com/daidi/git-ai/cli/internal/config"
	gitpkg "github.com/daidi/git-ai/cli/internal/git"
	"github.com/daidi/git-ai/cli/internal/state"
)

func TestDaemonContextRemainsBoundToRecordedCommitAfterBranchMoves(t *testing.T) {
	repo := initPostCommitTestRepo(t)
	t.Chdir(repo)
	t.Setenv("GIT_AI_CONFIG_DIR", t.TempDir())
	t.Setenv("GIT_AI_STATE_DIR", t.TempDir())
	t.Setenv("DO_NOT_TRACK", "1")
	requests := make(chan ai.ChatRequest, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request ai.ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Error(err)
		}
		requests <- request
		_ = json.NewEncoder(w).Encode(ai.ChatResponse{Choices: []ai.Choice{{Message: ai.Message{Content: "fix(auth): handle login timeout"}}}})
	}))
	defer server.Close()
	t.Setenv("GIT_AI_API_KEY", "test-key")
	t.Setenv("GIT_AI_BASE_URL", server.URL)
	t.Setenv("GIT_AI_PROVIDER", "openai")
	t.Setenv("GIT_AI_MODEL", "fixture")
	t.Setenv("GIT_AI_MESSAGE_FORMAT", "conventional")
	t.Setenv("GIT_AI_PROMPT_TEMPLATE", "")
	if err := config.ReplaceGlobal(config.Defaults()); err != nil {
		t.Fatal(err)
	}
	commitPostCommitFixture(t, repo, "base.txt", "base\n", "feat(auth): PRIVATE_HISTORY_SENTINEL")
	postCommitGit(t, repo, "checkout", "-b", "fix/PROJ-123-login")
	commitPostCommitFixture(t, repo, "login.txt", "RECORDED_DIFF_SENTINEL\n", "wip")
	target := strings.TrimSpace(postCommitGit(t, repo, "rev-parse", "HEAD"))
	commitPostCommitFixture(t, repo, "future.txt", "NEWER_DIFF_SENTINEL\n", "feat(future): NEWER_SUBJECT_SENTINEL")
	postCommitGit(t, repo, "checkout", "-b", "feature/OTHER-999-new")
	if err := os.WriteFile(filepath.Join(repo, "staged.txt"), []byte("STAGED_SENTINEL\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	postCommitGit(t, repo, "add", "staged.txt")
	headBefore := postCommitGit(t, repo, "rev-parse", "HEAD")
	indexBefore := postCommitGit(t, repo, "write-tree")
	gitDir, err := gitpkg.GetGitDir()
	if err != nil {
		t.Fatal(err)
	}
	mgr := state.NewManager(gitDir)
	const operationID = "context-snapshot-test"
	if err := mgr.Save(&state.State{
		CurrentStatus: state.StatusPolishing, LastSHA: target, OriginalMsg: "wip",
		TargetRef: "refs/heads/fix/PROJ-123-login", OperationID: operationID,
	}); err != nil {
		t.Fatal(err)
	}
	if err := runDaemon(mgr, operationID, "dev"); err != nil {
		t.Fatal(err)
	}
	select {
	case request := <-requests:
		var prompt strings.Builder
		for _, message := range request.Messages {
			prompt.WriteString(message.Content)
		}
		for _, required := range []string{`"branch":"fix/PROJ-123-login"`, `"common_scopes":["auth"]`, "RECORDED_DIFF_SENTINEL"} {
			if !strings.Contains(prompt.String(), required) {
				t.Errorf("missing recorded context %q", required)
			}
		}
		for _, forbidden := range []string{"PRIVATE_HISTORY_SENTINEL", "NEWER_DIFF_SENTINEL", "NEWER_SUBJECT_SENTINEL", "STAGED_SENTINEL", "OTHER-999"} {
			if strings.Contains(prompt.String(), forbidden) {
				t.Errorf("unrelated data sent: %q", forbidden)
			}
		}
	default:
		t.Fatal("daemon did not request polishing")
	}
	if postCommitGit(t, repo, "rev-parse", "HEAD") != headBefore || postCommitGit(t, repo, "write-tree") != indexBefore {
		t.Fatal("moved ref or staged work changed")
	}
	if postCommitGit(t, repo, "rev-parse", "fix/PROJ-123-login") != headBefore {
		t.Fatal("recorded branch's newer commit was rewritten")
	}
	snapshot, err := mgr.Load()
	if err != nil || snapshot.LastError == nil || snapshot.LastError.Code != "target_moved" {
		t.Fatalf("expected safe no-op for moved ref: %#v, %v", snapshot, err)
	}
}
