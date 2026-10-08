package cmd

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/cli/internal/ai"
	"github.com/daidi/git-ai/cli/internal/config"
)

type scriptedSetupUI struct {
	answers []string
	next    int
	secrets int
	output  strings.Builder
}

func (s *scriptedSetupUI) Read(prompt string, secret bool) (string, error) {
	s.Print(prompt)
	if secret {
		s.secrets++
	}
	if s.next == len(s.answers) {
		return "", io.EOF
	}
	value := s.answers[s.next]
	s.next++
	return value, nil
}

func (s *scriptedSetupUI) Print(message string) { s.output.WriteString(message + "\n") }

func setupFixture(t *testing.T) *config.Config {
	t.Helper()
	t.Setenv("GIT_AI_CONFIG_DIR", filepath.Join(t.TempDir(), "config"))
	t.Setenv("GIT_AI_STATE_DIR", t.TempDir())
	t.Setenv("GIT_AI_API_KEY", "environment-secret-not-to-import")
	t.Setenv("GIT_AI_BASE_URL", "https://untrusted-environment.example/v1")
	cfg := config.Defaults()
	cfg.APIKey = "old-secret"
	cfg.PromptTemplate = "retain my template"
	cfg.PushPolicy = "block"
	if err := config.ReplaceGlobal(cfg); err != nil {
		t.Fatal(err)
	}
	return cfg
}

func successfulSetupServices(t *testing.T) setupServices {
	t.Helper()
	return setupServices{
		models: func(_ context.Context, cfg *config.Config) (ai.ModelCatalog, error) {
			if cfg.BaseURL != config.Defaults().BaseURL {
				t.Errorf("environment/repository endpoint inherited: %q", cfg.BaseURL)
			}
			return ai.ModelCatalog{Models: []ai.ModelInfo{{ID: "first-model"}, {ID: "second-model"}}}, nil
		},
		test: func(_ context.Context, _ *config.Config) error { return nil },
	}
}

func TestSetupSavesOnlyConfirmedFieldsWithoutEchoingSecrets(t *testing.T) {
	before := setupFixture(t)
	ui := &scriptedSetupUI{answers: []string{"", "", "new-secret", "y", "2", "gitmoji", "zh-CN", "y", "y"}}
	services := successfulSetupServices(t)
	services.test = func(ctx context.Context, cfg *config.Config) error {
		if _, ok := ctx.Deadline(); !ok {
			t.Fatal("connection test is unbounded")
		}
		if cfg.Model != "second-model" || cfg.APIKey != "new-secret" {
			t.Fatal("test did not use draft configuration")
		}
		// Simulate an unrelated IDE setting saved while the wizard is open.
		return config.SetGlobal("log_level", "debug")
	}
	if err := runSetupWizard(context.Background(), ui, services); err != nil {
		t.Fatal(err)
	}
	after, err := config.LoadScope("", config.ScopeGlobal)
	if err != nil {
		t.Fatal(err)
	}
	if after.APIKey != "new-secret" || after.Model != "second-model" || after.MessageFormat != "gitmoji" || after.Language != "zh-CN" {
		t.Fatal("confirmed settings not saved")
	}
	if after.PromptTemplate != before.PromptTemplate || after.PushPolicy != before.PushPolicy || after.LogLevel != "debug" {
		t.Fatal("unrelated/concurrent settings overwritten")
	}
	if ui.secrets != 1 {
		t.Fatalf("hidden prompts: %d", ui.secrets)
	}
	for _, secret := range []string{"old-secret", "new-secret", "environment-secret-not-to-import"} {
		if strings.Contains(ui.output.String(), secret) {
			t.Fatal("secret echoed")
		}
	}
}

func TestSetupCancellationAtEveryPromptLeavesConfigurationUnchanged(t *testing.T) {
	answers := []string{"", "", "new-secret", "y", "2", "", "", "y", "y"}
	for cut := 0; cut < len(answers); cut++ {
		t.Run(string(rune('A'+cut)), func(t *testing.T) {
			setupFixture(t)
			before, err := os.ReadFile(config.GlobalConfigPath())
			if err != nil {
				t.Fatal(err)
			}
			ui := &scriptedSetupUI{answers: answers[:cut]}
			if err := runSetupWizard(context.Background(), ui, successfulSetupServices(t)); !errors.Is(err, io.EOF) {
				t.Fatalf("cancel: %v", err)
			}
			after, err := os.ReadFile(config.GlobalConfigPath())
			if err != nil || !bytes.Equal(before, after) {
				t.Fatal("cancellation modified config")
			}
		})
	}
}

func TestSetupRejectsFailedTestAndMasksProviderError(t *testing.T) {
	setupFixture(t)
	before, _ := os.ReadFile(config.GlobalConfigPath())
	ui := &scriptedSetupUI{answers: []string{"", "", "new-secret", "y", "2", "", "", "y", "y"}}
	services := successfulSetupServices(t)
	services.test = func(context.Context, *config.Config) error {
		return errors.New("API response containing new-secret and private content")
	}
	err := runSetupWizard(context.Background(), ui, services)
	if err == nil || strings.Contains(err.Error()+ui.output.String(), "new-secret") {
		t.Fatal("failed test ignored or sensitive provider error exposed")
	}
	after, _ := os.ReadFile(config.GlobalConfigPath())
	if !bytes.Equal(before, after) {
		t.Fatal("failed test saved config")
	}
}

func TestSetupNeverReusesCredentialsForDifferentEndpointOrProvider(t *testing.T) {
	for _, answers := range [][]string{
		{"", "https://different.example/v1", ""},
		{"anthropic", "", ""},
		{"", "https://user:secret@different.example/v1"},
		{"", "http://remote.example/v1"},
	} {
		setupFixture(t)
		before, _ := os.ReadFile(config.GlobalConfigPath())
		ui := &scriptedSetupUI{answers: answers}
		services := setupServices{models: func(context.Context, *config.Config) (ai.ModelCatalog, error) {
			t.Fatal("credentials could have been sent to a different endpoint")
			return ai.ModelCatalog{}, nil
		}}
		if err := runSetupWizard(context.Background(), ui, services); err == nil {
			t.Fatal("unsafe endpoint/key combination accepted")
		}
		after, _ := os.ReadFile(config.GlobalConfigPath())
		if !bytes.Equal(before, after) {
			t.Fatal("failed endpoint selection saved config")
		}
	}
}

func TestSetupOllamaAndManualModelWorkWithoutNetwork(t *testing.T) {
	setupFixture(t)
	ui := &scriptedSetupUI{answers: []string{"ollama", "", "n", "local-model", "plain", "en", "n", "y"}}
	if err := runSetupWizard(context.Background(), ui, setupServices{}); err != nil {
		t.Fatal(err)
	}
	after, _ := config.LoadScope("", config.ScopeGlobal)
	if after.Provider != "ollama" || after.APIKey != "" || after.Model != "local-model" || after.BaseURL != "http://localhost:11434/v1" {
		t.Fatal("local provider config incorrect")
	}
	if ui.secrets != 0 {
		t.Fatal("Ollama requested a credential")
	}
}

func TestSetupPartialProviderConfigurationUsesMatchingDefaults(t *testing.T) {
	t.Setenv("GIT_AI_CONFIG_DIR", t.TempDir())
	if err := config.ReplaceGlobal(&config.Config{Provider: "anthropic", APIKey: "existing-key"}); err != nil {
		t.Fatal(err)
	}
	// The missing endpoint is corrected to Anthropic, so a fresh credential is
	// required even though the stored provider itself did not change.
	ui := &scriptedSetupUI{answers: []string{"", "", "new-key", "n", "", "", "", "n", "y"}}
	if err := runSetupWizard(context.Background(), ui, setupServices{}); err != nil {
		t.Fatal(err)
	}
	got, err := config.LoadScope("", config.ScopeGlobal)
	if err != nil {
		t.Fatal(err)
	}
	for _, provider := range config.Schema().Providers {
		if provider.ID == "anthropic" && (got.Model != provider.DefaultModel || got.BaseURL != provider.DefaultBaseURL) {
			t.Fatal("partial provider configuration inherited another provider's defaults")
		}
	}
}

func TestSetupManualFallbackAndExistingKeyPreservation(t *testing.T) {
	setupFixture(t)
	ui := &scriptedSetupUI{answers: []string{"", "", "", "y", "custom-model", "", "", "y", "y"}}
	services := setupServices{
		models: func(context.Context, *config.Config) (ai.ModelCatalog, error) {
			return ai.ModelCatalog{}, errors.New("secret-response")
		},
		test: func(_ context.Context, cfg *config.Config) error {
			if cfg.APIKey != "old-secret" || cfg.Model != "custom-model" {
				t.Fatal("manual fallback lost model/key")
			}
			return nil
		},
	}
	if err := runSetupWizard(context.Background(), ui, services); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(ui.output.String(), "secret-response") {
		t.Fatal("model error body exposed")
	}
}

func TestSetupFirstRunCancellationAndNonTerminalDoNotCreateConfig(t *testing.T) {
	t.Setenv("GIT_AI_CONFIG_DIR", filepath.Join(t.TempDir(), "missing"))
	if err := runSetupWizard(context.Background(), &scriptedSetupUI{}, setupServices{}); !errors.Is(err, io.EOF) {
		t.Fatalf("first run cancel: %v", err)
	}
	command := &cobra.Command{}
	command.SetIn(strings.NewReader("do-not-consume-this-secret"))
	command.SetOut(io.Discard)
	if err := setupCmd.RunE(command, nil); err == nil {
		t.Fatal("non-terminal setup accepted")
	}
	if _, err := os.Stat(config.GlobalConfigPath()); !os.IsNotExist(err) {
		t.Fatal("cancellation/non-terminal created config")
	}
}

func TestModelDiscoveryAndSetupDoNotTriggerUpdateNetwork(t *testing.T) {
	t.Setenv("GIT_AI_CONFIG_DIR", t.TempDir())
	t.Setenv("GIT_AI_STATE_DIR", t.TempDir())
	t.Chdir(t.TempDir())
	for _, command := range []*cobra.Command{setupCmd, configModelsCmd} {
		if err := rootCmd.PersistentPreRunE(command, nil); err != nil {
			t.Fatal(err)
		}
		if showUpdateNotice {
			t.Fatalf("%s would trigger unrelated update request", command.Name())
		}
	}
}
