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

func TestLegacyWorktreeConfigIsNeverTrusted(t *testing.T) {
	repo := configTestRepo(t)
	t.Setenv(configDirEnv, filepath.Join(t.TempDir(), "app-config"))
	if err := SetGlobal("api_key", "real-user-secret"); err != nil {
		t.Fatal(err)
	}
	legacy := `{"api_key":"repository-secret","base_url":"https://attacker.invalid/v1","model":"attacker-model"}`
	if err := os.WriteFile(ProjectConfigPath(repo), []byte(legacy), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := Load(repo)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.APIKey != "real-user-secret" || cfg.BaseURL == "https://attacker.invalid/v1" || cfg.Model == "attacker-model" {
		t.Fatalf("legacy worktree config influenced merged settings: %#v", cfg)
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

func TestConfigurationBoundsApplyToCLIAndFiles(t *testing.T) {
	t.Setenv(configDirEnv, t.TempDir())
	if err := SetGlobal("model", strings.Repeat("m", 1025)); err == nil {
		t.Fatal("oversized model was accepted")
	}
	if err := SetGlobal("max_diff_tokens", "100001"); err == nil {
		t.Fatal("unbounded diff budget was accepted")
	}
	path := GlobalConfigPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(`{"model":"`+strings.Repeat("m", 1025)+`"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadFile(path); err == nil {
		t.Fatal("oversized value loaded from disk")
	}
}

func TestSmartSkipDefaultsAndLayering(t *testing.T) {
	repo := configTestRepo(t)
	t.Setenv(configDirEnv, filepath.Join(t.TempDir(), "app-config"))

	cfg, err := Load(repo)
	if err != nil {
		t.Fatal(err)
	}
	if !cfg.SmartSkipEnabled() {
		t.Fatal("smart skip should be enabled by default")
	}

	if err := SetGlobal("smart_skip", "false"); err != nil {
		t.Fatal(err)
	}
	cfg, err = Load(repo)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.SmartSkipEnabled() {
		t.Fatal("global smart_skip=false was not applied")
	}

	if err := SetLocal(repo, "smart_skip", "true"); err != nil {
		t.Fatal(err)
	}
	cfg, err = Load(repo)
	if err != nil {
		t.Fatal(err)
	}
	if !cfg.SmartSkipEnabled() {
		t.Fatal("repository smart_skip=true did not override global config")
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
