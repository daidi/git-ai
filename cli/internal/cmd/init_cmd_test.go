package cmd

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestInstallHookPreservesUserHookThatInvokesGitAI(t *testing.T) {
	dir := t.TempDir()
	hookPath := filepath.Join(dir, "post-commit")
	userHook := []byte("#!/bin/sh\ngit-ai hook post-commit\necho user-hook\n")
	if err := os.WriteFile(hookPath, userHook, 0o755); err != nil {
		t.Fatal(err)
	}

	backedUp, err := installHook("post-commit", hookPath)
	if err != nil {
		t.Fatal(err)
	}
	if !backedUp {
		t.Fatal("user hook was mistaken for a managed hook")
	}
	backup, err := os.ReadFile(hookPath + ".git-ai.backup")
	if err != nil {
		t.Fatal(err)
	}
	if string(backup) != string(userHook) {
		t.Fatalf("backup = %q, want %q", backup, userHook)
	}

	backedUp, err = installHook("post-commit", hookPath)
	if err != nil || backedUp {
		t.Fatalf("managed hook reinstall = backedUp %t, error %v", backedUp, err)
	}
}

func TestManagedHookDetectionSupportsLegacyHeaderOnly(t *testing.T) {
	legacy := []byte("#!/bin/sh\n# git-ai pre-push hook\n# Installed by `git-ai init`. Do not edit — re-run `git-ai init` to reinstall.\ngit-ai hook pre-push\n")
	if !isManagedHook(legacy, "pre-push") {
		t.Fatal("legacy managed hook was not recognized")
	}
	user := []byte("#!/bin/sh\n# user wrapper\ngit-ai hook pre-push\n")
	if isManagedHook(user, "pre-push") {
		t.Fatal("user hook invocation was claimed as managed")
	}
}

func TestRunInitRejectsWorktreeHooksBeforeWritingAnything(t *testing.T) {
	repo := t.TempDir()
	run := func(args ...string) {
		command := exec.Command("git", args...)
		command.Dir = repo
		if output, err := command.CombinedOutput(); err != nil {
			t.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, output)
		}
	}
	run("init", "-b", "main")
	run("config", "--local", "core.hooksPath", ".githooks")
	t.Chdir(repo)
	runtimeRoot := filepath.Join(t.TempDir(), "application-cache")
	t.Setenv("GIT_AI_STATE_DIR", runtimeRoot)
	previousRoot := gitRoot
	gitRoot = repo
	t.Cleanup(func() { gitRoot = previousRoot })

	if err := runInit(nil, nil); err == nil || !strings.Contains(err.Error(), "outside this repository's Git metadata") {
		t.Fatalf("runInit error = %v", err)
	}
	if _, err := os.Stat(filepath.Join(repo, ".githooks")); !os.IsNotExist(err) {
		t.Fatalf("worktree hook directory was created: %v", err)
	}
	if _, err := os.Stat(runtimeRoot); !os.IsNotExist(err) {
		t.Fatalf("external state was created before hook preflight completed: %v", err)
	}
}
