package git

import (
	"context"
	"reflect"
	"strings"
	"testing"
)

func TestAncestorSubjectsAreBoundToRecordedCommit(t *testing.T) {
	repo := initTestRepo(t)
	t.Chdir(repo)
	gitTestRun(t, repo, "commit", "--allow-empty", "-m", "feat(auth): original context")
	root := strings.TrimSpace(gitTestRun(t, repo, "rev-parse", "HEAD"))
	gitTestRun(t, repo, "commit", "--allow-empty", "-m", "wip recorded target")
	target := strings.TrimSpace(gitTestRun(t, repo, "rev-parse", "HEAD"))
	gitTestRun(t, repo, "commit", "--allow-empty", "-m", "feat(wrong): newer context")
	gitTestRun(t, repo, "checkout", "-b", "later-branch")
	subjects, err := GetAncestorSubjects(context.Background(), target)
	if err != nil || !reflect.DeepEqual(subjects, []string{"feat(auth): original context"}) {
		t.Fatalf("snapshot history: %q %v", subjects, err)
	}
	subjects, err = GetAncestorSubjects(context.Background(), root)
	if err != nil || len(subjects) != 0 {
		t.Fatalf("root history: %q %v", subjects, err)
	}
	for _, invalid := range []string{"HEAD", "--all", "HEAD~1", strings.Repeat("x", 40)} {
		if _, err := GetAncestorSubjects(context.Background(), invalid); err == nil {
			t.Fatalf("accepted %q", invalid)
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := GetAncestorSubjects(ctx, target); err == nil {
		t.Fatal("ignored cancellation")
	}
}

func TestAncestorSubjectsExcludeMergedSideHistoryAndBoundCount(t *testing.T) {
	repo := initTestRepo(t)
	t.Chdir(repo)
	gitTestRun(t, repo, "commit", "--allow-empty", "-m", "feat(base): root")
	gitTestRun(t, repo, "checkout", "-b", "side")
	gitTestRun(t, repo, "commit", "--allow-empty", "-m", "feat(side): unrelated convention")
	gitTestRun(t, repo, "checkout", "main")
	gitTestRun(t, repo, "commit", "--allow-empty", "-m", "feat(main): mainline")
	gitTestRun(t, repo, "merge", "--no-ff", "side", "-m", "merge side")
	target := strings.TrimSpace(gitTestRun(t, repo, "rev-parse", "HEAD"))
	subjects, err := GetAncestorSubjects(context.Background(), target)
	if err != nil || !reflect.DeepEqual(subjects, []string{"feat(main): mainline", "feat(base): root"}) {
		t.Fatalf("merge history: %q %v", subjects, err)
	}
	for i := 0; i < 25; i++ {
		gitTestRun(t, repo, "commit", "--allow-empty", "-m", "fix(cli): bounded history")
	}
	target = strings.TrimSpace(gitTestRun(t, repo, "rev-parse", "HEAD"))
	subjects, err = GetAncestorSubjects(context.Background(), target)
	if err != nil || len(subjects) != 20 {
		t.Fatalf("history bound: %d %v", len(subjects), err)
	}
}
