package ai

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"unicode/utf8"

	"github.com/daidi/git-ai/cli/internal/config"
)

func TestPolishRepairsInvalidFormatAndPreservesTrailers(t *testing.T) {
	var attempts atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		var payload ChatRequest
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			t.Errorf("decode request: %v", err)
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		for _, message := range payload.Messages {
			if strings.Contains(message.Content, "Signed-off-by:") {
				t.Errorf("protected trailer was sent to the model: %q", message.Content)
			}
		}

		content := "Here is a commit message:\nfix(cache): avoid duplicate requests"
		if attempts.Add(1) > 1 {
			content = "fix(cache): avoid duplicate requests"
		}
		writer.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(writer).Encode(ChatResponse{Choices: []Choice{{Message: Message{Role: "assistant", Content: content}}}})
	}))
	defer server.Close()

	cfg := config.Defaults()
	cfg.APIKey = "test-key"
	cfg.BaseURL = server.URL
	cfg.Model = "test-model"
	original := "wip\n\nSigned-off-by: Alice <alice@example.com>"

	got, err := PolishWithLogger("diff --git a/cache.go b/cache.go\n+cache()", original, t.TempDir(), cfg, log.New(io.Discard, "", 0))
	if err != nil {
		t.Fatal(err)
	}
	want := "fix(cache): avoid duplicate requests\n\nSigned-off-by: Alice <alice@example.com>"
	if got != want {
		t.Fatalf("PolishWithLogger() = %q, want %q", got, want)
	}
	if gotAttempts := attempts.Load(); gotAttempts != 2 {
		t.Fatalf("attempts = %d, want 2", gotAttempts)
	}
}

func TestTrimDiffPrioritizesSourceAndTestsWithinBudget(t *testing.T) {
	docs := "diff --git a/docs/guide.md b/docs/guide.md\nindex 111..222 100644\n--- a/docs/guide.md\n+++ b/docs/guide.md\n@@ -1 +1,80 @@\n" + strings.Repeat("+Long documentation prose that consumes context.\n", 80)
	lockfile := "diff --git a/package-lock.json b/package-lock.json\nindex 333..444 100644\n--- a/package-lock.json\n+++ b/package-lock.json\n@@ -1 +1,80 @@\n" + strings.Repeat("+LOCK_PAYLOAD_SHOULD_NOT_WIN\n", 80)
	source := "diff --git a/src/session.go b/src/session.go\nindex 555..666 100644\n--- a/src/session.go\n+++ b/src/session.go\n@@ -10,2 +10,5 @@\n-oldCall()\n+func ValidateSession(token string) error {\n+    return verify(token)\n+}\n"
	raw := docs + lockfile + source

	const maxTokens = 200
	got := TrimDiff(raw, maxTokens)
	if len(got) > maxTokens*4 {
		t.Fatalf("trimmed diff length = %d, budget = %d", len(got), maxTokens*4)
	}
	for _, file := range []string{"src/session.go", "docs/guide.md", "package-lock.json"} {
		if !strings.Contains(got, file) {
			t.Errorf("file inventory omitted %s:\n%s", file, got)
		}
	}
	if !strings.Contains(got, "+func ValidateSession") {
		t.Fatalf("high-value source change was omitted:\n%s", got)
	}
	if strings.Contains(got, "LOCK_PAYLOAD_SHOULD_NOT_WIN") {
		t.Fatalf("lockfile payload displaced higher-value context:\n%s", got)
	}
	if strings.Index(got, "src/session.go") > strings.Index(got, "docs/guide.md") {
		t.Fatalf("inventory was not relevance-ranked:\n%s", got)
	}
}

func TestTrimDiffDistributesOneFileBudgetAcrossHunks(t *testing.T) {
	firstHunk := "@@ -1,2 +1,60 @@ func parse()\n" + strings.Repeat("+parse another generated-looking input line\n", 60)
	secondHunk := "@@ -200,2 +260,3 @@ func validate()\n-oldValidation()\n+return ErrExpired\n"
	raw := "diff --git a/internal/token.go b/internal/token.go\nindex 111..222 100644\n--- a/internal/token.go\n+++ b/internal/token.go\n" + firstHunk + secondHunk

	got := TrimDiff(raw, 180)
	if len(got) > 180*4 {
		t.Fatalf("trimmed diff length = %d", len(got))
	}
	for _, excerpt := range []string{"@@ -1,2 +1,60 @@", "@@ -200,2 +260,3 @@", "+return ErrExpired"} {
		if !strings.Contains(got, excerpt) {
			t.Errorf("hunk excerpt %q omitted:\n%s", excerpt, got)
		}
	}
}

func TestTrimDiffKeepsSmallDiffAndStrictlyBoundsFallback(t *testing.T) {
	small := "diff --git a/a.go b/a.go\n+small\n"
	if got := TrimDiff(small, 100); got != small {
		t.Fatalf("small diff changed: %q", got)
	}

	got := TrimDiff(strings.Repeat("变更", 100), 3)
	if len(got) > 12 {
		t.Fatalf("fallback length = %d, want <= 12", len(got))
	}
	if !utf8.ValidString(got) {
		t.Fatalf("fallback split a UTF-8 sequence: %q", got)
	}
}
