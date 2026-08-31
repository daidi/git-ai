package hooks

import (
	"os"
	"strings"
	"testing"

	"github.com/daidi/git-ai/internal/state"
)

func TestPendingRefSpecsPreservesDestinationsAndDeletion(t *testing.T) {
	pending := &state.PendingPush{Updates: []state.PushUpdate{
		{LocalRef: "refs/heads/main", LocalSHA: strings.Repeat("a", 40), RemoteRef: "refs/heads/main"},
		{LocalRef: "(delete)", LocalSHA: strings.Repeat("0", 40), RemoteRef: "refs/heads/old"},
	}}
	got, err := PendingRefSpecs(pending)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"refs/heads/main:refs/heads/main", ":refs/heads/old"}
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
		if _, err := PendingRefSpecs(pending); err == nil {
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

func TestPushContainsRecordedTarget(t *testing.T) {
	stateSnapshot := &state.State{LastSHA: "abc", TargetRef: "refs/heads/main"}
	if !pushContainsTarget([]state.PushUpdate{{LocalRef: "refs/heads/main", LocalSHA: "new"}}, stateSnapshot) {
		t.Fatal("target branch was not detected")
	}
	if !pushContainsTarget([]state.PushUpdate{{LocalRef: "refs/tags/v1", LocalSHA: "abc"}}, stateSnapshot) {
		t.Fatal("target SHA was not detected")
	}
	if pushContainsTarget([]state.PushUpdate{{LocalRef: "refs/heads/other", LocalSHA: "def"}}, stateSnapshot) {
		t.Fatal("unrelated update was blocked")
	}
}
