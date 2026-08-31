package config

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
)

func TestRepositoryConfigUsesGitMetadataNotWorktreeFile(t *testing.T) {
	repo := configTestRepo(t)
	t.Setenv(configDirEnv, filepath.Join(t.TempDir(), "app-config"))
	marker := filepath.Join(repo, "must-not-exist")
	value := "model-$(touch " + marker + ")"
	if err := SetLocal(repo, "model", value); err != nil {
		t.Fatal(err)
	}
	if err := SetLocal(repo, "push_policy", "block"); err != nil {
		t.Fatal(err)
	}
	if err := SetLocal(repo, "api_key", "secret"); err == nil {
		t.Fatal("repository API key was accepted")
	}
	if _, err := os.Stat(ProjectConfigPath(repo)); !os.IsNotExist(err) {
		t.Fatalf("worktree config was created: %v", err)
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Fatalf("config value was interpreted by a shell: %v", err)
	}
	if got := strings.TrimSpace(configGit(t, repo, "config", "--local", "--get", "git-ai.model")); got != value {
		t.Fatalf("git config model = %q", got)
	}
	merged, err := Load(repo)
	if err != nil {
		t.Fatal(err)
	}
	if merged.Model != value || merged.PushPolicy != "block" {
		t.Fatalf("merged config = %#v", merged)
	}
}

func TestGlobalConfigIsPrivateAtomicAndOverrideIsIsolated(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "isolated-config")
	t.Setenv(configDirEnv, dir)
	if err := SetGlobal("api_key", "secret-value"); err != nil {
		t.Fatal(err)
	}
	if err := SetGlobal("model", "test-model"); err != nil {
		t.Fatal(err)
	}
	cfg, err := LoadScope("", ScopeGlobal)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.APIKey != "secret-value" || cfg.Model != "test-model" {
		t.Fatalf("global config = %#v", cfg)
	}
	if runtime.GOOS != "windows" {
		info, err := os.Stat(GlobalConfigPath())
		if err != nil {
			t.Fatal(err)
		}
		if info.Mode().Perm()&0o077 != 0 {
			t.Fatalf("config permissions too broad: %o", info.Mode().Perm())
		}
	}
}

func TestConcurrentGlobalUpdatesDoNotLoseFields(t *testing.T) {
	t.Setenv(configDirEnv, t.TempDir())
	updates := map[string]string{
		"model":          "concurrent-model",
		"language":       "zh-CN",
		"push_policy":    "block",
		"message_format": "plain",
	}
	var wg sync.WaitGroup
	errs := make(chan error, len(updates))
	for key, value := range updates {
		key, value := key, value
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs <- SetGlobal(key, value)
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	cfg, err := LoadScope("", ScopeGlobal)
	if err != nil {
		t.Fatal(err)
	}
	values := Values(cfg)
	for key, want := range updates {
		if got := values[key]; got != want {
			t.Errorf("%s = %q, want %q", key, got, want)
		}
	}
}

func configTestRepo(t *testing.T) string {
	t.Helper()
	repo := t.TempDir()
	configGit(t, repo, "init", "-b", "main")
	return repo
}

func configGit(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return string(out)
}
