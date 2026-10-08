package config

import "testing"

func TestUsageTelemetryGlobalPreferenceSurvivesOlderIDESaves(t *testing.T) {
	t.Setenv(configDirEnv, t.TempDir())
	t.Setenv("GIT_AI_USAGE_TELEMETRY", "")
	t.Setenv("DO_NOT_TRACK", "")
	cfg, err := Load("")
	if err != nil || !cfg.UsageTelemetryEnabled() {
		t.Fatalf("telemetry should default to enabled: %v", err)
	}
	if err := SetGlobal("usage_telemetry", "false"); err != nil {
		t.Fatal(err)
	}
	if err := ReplaceGlobal(&Config{Model: "saved-by-old-ide"}); err != nil {
		t.Fatal(err)
	}
	cfg, err = Load("")
	if err != nil || cfg.UsageTelemetryEnabled() || cfg.Model != "saved-by-old-ide" {
		t.Fatalf("old IDE reset opt-out: %v", err)
	}
	if err := UnsetGlobal("usage_telemetry"); err != nil {
		t.Fatal(err)
	}
	cfg, err = Load("")
	if err != nil || !cfg.UsageTelemetryEnabled() {
		t.Fatalf("explicit unset did not restore default: %v", err)
	}
	if err := SetGlobal("usage_telemetry", "invalid"); err == nil {
		t.Fatal("invalid preference was accepted")
	}
}

func TestRepositoryCannotOverrideUsageOptOut(t *testing.T) {
	repo := configTestRepo(t)
	t.Setenv(configDirEnv, t.TempDir())
	t.Setenv("GIT_AI_USAGE_TELEMETRY", "")
	t.Setenv("DO_NOT_TRACK", "")
	if err := SetGlobal("usage_telemetry", "false"); err != nil {
		t.Fatal(err)
	}
	if err := SetLocal(repo, "usage_telemetry", "true"); err == nil {
		t.Fatal("local telemetry override accepted")
	}
	configGit(t, repo, "config", "--local", "git-ai.usage-telemetry", "true")
	if err := SetLocal(repo, "model", "keep-me"); err != nil {
		t.Fatal(err)
	}
	if err := ReplaceLocal(repo, &Config{UsageTelemetry: boolPtr(true)}); err == nil {
		t.Fatal("local replacement accepted telemetry")
	}
	cfg, err := Load(repo)
	if err != nil || cfg.UsageTelemetryEnabled() || cfg.Model != "keep-me" {
		t.Fatalf("repository changed opt-out or failed replace removed config: %v", err)
	}
}

func TestUsageTelemetryEnvironmentControls(t *testing.T) {
	t.Setenv(configDirEnv, t.TempDir())
	for _, tc := range []struct {
		value, dnt string
		want       bool
	}{
		{"false", "", false}, {"true", "", true}, {"true", "1", false}, {"", "1", false},
	} {
		t.Setenv("GIT_AI_USAGE_TELEMETRY", tc.value)
		t.Setenv("DO_NOT_TRACK", tc.dnt)
		cfg, err := Load("")
		if err != nil || cfg.UsageTelemetryEnabled() != tc.want {
			t.Fatalf("env=%q DNT=%q: %v", tc.value, tc.dnt, err)
		}
	}
}
