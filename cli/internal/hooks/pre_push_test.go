package hooks

import (
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/daidi/git-ai/cli/internal/state"
)

func TestStopPushErrorHasDedicatedIdentity(t *testing.T) {
	err := &stopPushError{message: "deferred"}
	if !errors.Is(err, ErrStopPush) || err.Error() != "deferred" {
		t.Fatalf("stop error = %#v", err)
	}
}

func TestPendingRefSpecsPreservesDestinationsAndDeletion(t *testing.T) {
	original := strings.Repeat("a", 40)
	replacement := strings.Repeat("b", 40)
	pending := &state.PendingPush{TargetRef: "refs/heads/main", TargetSHA: original, Updates: []state.PushUpdate{
		{LocalRef: "refs/heads/main", LocalSHA: original, RemoteRef: "refs/heads/main"},
		{LocalRef: "refs/tags/snapshot", LocalSHA: original, RemoteRef: "refs/tags/snapshot"},
		{LocalRef: "(delete)", LocalSHA: strings.Repeat("0", 40), RemoteRef: "refs/heads/old"},
	}}
	got, err := PendingRefSpecs(pending, replacement)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{
		replacement + ":refs/heads/main",
		original + ":refs/tags/snapshot",
		":refs/heads/old",
	}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("refspecs = %#v", got)
	}
}

func TestPendingRefSpecsRejectsLegacyOrIncompleteState(t *testing.T) {
	for _, pending := range []*state.PendingPush{
		{RefSpecs: []string{"main"}},
		{Updates: []state.PushUpdate{{LocalRef: "refs/heads/main", LocalSHA: "abc"}}},
		{Updates: []state.PushUpdate{{LocalSHA: "abc", RemoteRef: "refs/heads/main"}}},
	} {
		if _, err := PendingRefSpecs(pending, ""); err == nil {
			t.Fatalf("PendingRefSpecs(%#v) succeeded", pending)
		}
	}
}

func TestReadPushUpdatesRejectsMalformedInput(t *testing.T) {
	original := os.Stdin
	file, err := os.CreateTemp(t.TempDir(), "pre-push-input")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.Stdin = original; _ = file.Close() })
	if _, err := file.WriteString("only three fields\n"); err != nil {
		t.Fatal(err)
	}
	if _, err := file.Seek(0, 0); err != nil {
		t.Fatal(err)
	}
	os.Stdin = file
	if _, err := readPushUpdates(); err == nil {
		t.Fatal("malformed pre-push input was accepted")
	}
}

func TestReadPushUpdatesRejectsOversizedInput(t *testing.T) {
	original := os.Stdin
	file, err := os.CreateTemp(t.TempDir(), "pre-push-input")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.Stdin = original; _ = file.Close() })
	if _, err := file.WriteString(strings.Repeat("a", maxPushInputBytes+1) + " b c d\n"); err != nil {
		t.Fatal(err)
	}
	if _, err := file.Seek(0, 0); err != nil {
		t.Fatal(err)
	}
	os.Stdin = file
	if _, err := readPushUpdates(); err == nil {
		t.Fatal("oversized pre-push input was accepted")
	}
}

func TestPushContainsRecordedTarget(t *testing.T) {
	stateSnapshot := &state.State{LastSHA: "abc", TargetRef: "refs/heads/main"}
	if !pushContainsTarget([]state.PushUpdate{{LocalRef: "refs/heads/main", LocalSHA: "abc"}}, stateSnapshot) {
		t.Fatal("exact target update was not detected")
	}
	if pushContainsTarget([]state.PushUpdate{{LocalRef: "refs/heads/main", LocalSHA: "new"}}, stateSnapshot) {
		t.Fatal("moved target branch was blocked")
	}
	if pushContainsTarget([]state.PushUpdate{{LocalRef: "refs/tags/v1", LocalSHA: "abc"}}, stateSnapshot) {
		t.Fatal("unrelated tag was blocked")
	}
	if pushContainsTarget([]state.PushUpdate{{LocalRef: "refs/heads/other", LocalSHA: "def"}}, stateSnapshot) {
		t.Fatal("unrelated update was blocked")
	}
}

func TestPendingPushMustBelongToCompletedPolish(t *testing.T) {
	if pendingPushReady(nil, "result") {
		t.Fatal("nil pending push was ready")
	}
	if pendingPushReady(&state.PendingPush{TargetSHA: "old"}, "result") {
		t.Fatal("stale pending push was replayed by an unrelated polish")
	}
	if !pendingPushReady(&state.PendingPush{ResultSHA: "result"}, "result") {
		t.Fatal("matching completed pending push was not ready")
	}
}
