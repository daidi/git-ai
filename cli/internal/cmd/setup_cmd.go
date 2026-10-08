package cmd

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"golang.org/x/term"

	"github.com/daidi/git-ai/cli/internal/ai"
	"github.com/daidi/git-ai/cli/internal/config"
	"github.com/daidi/git-ai/cli/internal/i18n"
)

var setupCmd = &cobra.Command{
	Use:   "setup",
	Short: "Interactively configure a provider, credentials, model and message style",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		input, ok := cmd.InOrStdin().(*os.File)
		output, outputOK := cmd.OutOrStdout().(*os.File)
		if !ok || !outputOK || !term.IsTerminal(int(input.Fd())) || !term.IsTerminal(int(output.Fd())) {
			return errors.New(i18n.T("setup.terminal_required"))
		}
		ui := &terminalSetupUI{input: input, output: output}
		err := runSetupWizard(cmd.Context(), ui, setupServices{
			models: ai.ListModels,
			test:   testSetupConnection,
		})
		if errors.Is(err, io.EOF) || errors.Is(err, context.Canceled) {
			ui.Print(i18n.T("setup.canceled"))
			return nil
		}
		return err
	},
}

func init() { rootCmd.AddCommand(setupCmd) }

type setupUI interface {
	Read(prompt string, secret bool) (string, error)
	Print(message string)
}

type terminalSetupUI struct{ input, output *os.File }

func (u *terminalSetupUI) Print(message string) { _, _ = fmt.Fprintln(u.output, message) }

func (u *terminalSetupUI) Read(prompt string, secret bool) (value string, err error) {
	// Only prompts use raw mode. It is restored on EOF/Ctrl-C/errors and before
	// any network request, so interrupting a request cannot leave echo disabled.
	fd := int(u.input.Fd())
	previous, err := term.MakeRaw(fd)
	if err != nil {
		return "", errors.New(i18n.T("setup.terminal_required"))
	}
	defer func() {
		if restoreErr := term.Restore(fd, previous); restoreErr != nil && err == nil {
			err = errors.New(i18n.T("setup.restore_failed"))
		}
	}()
	terminal := term.NewTerminal(struct {
		io.Reader
		io.Writer
	}{u.input, u.output}, prompt)
	if secret {
		return terminal.ReadPassword(prompt)
	}
	return terminal.ReadLine()
}

type setupServices struct {
	models func(context.Context, *config.Config) (ai.ModelCatalog, error)
	test   func(context.Context, *config.Config) error
}

func runSetupWizard(ctx context.Context, ui setupUI, services setupServices) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	// Do not read repository overrides or environment credentials. A changed
	// endpoint must never silently inherit the key for the previous service.
	stored, err := config.LoadScope("", config.ScopeGlobal)
	if err != nil {
		return err
	}
	cfg := config.Defaults()
	for key, value := range config.Values(stored) {
		if err := config.SetValue(cfg, key, value); err != nil {
			return err
		}
	}
	ui.Print(i18n.T("setup.intro"))
	providers := config.Schema().Providers
	for _, provider := range providers {
		ui.Print(fmt.Sprintf("  %s — %s", provider.ID, provider.Label))
	}
	providerID, err := setupRead(ui, "setup.provider", cfg.Provider, false)
	if err != nil {
		return err
	}
	var provider *config.ProviderSchema
	for i := range providers {
		if providers[i].ID == providerID {
			provider = &providers[i]
			break
		}
	}
	if provider == nil {
		return errors.New(i18n.T("setup.invalid_provider"))
	}
	oldProvider, oldEndpoint := cfg.Provider, cfg.BaseURL
	if providerID != cfg.Provider {
		cfg.BaseURL = provider.DefaultBaseURL
	}
	if providerID != cfg.Provider || stored.Model == "" {
		cfg.Model = provider.DefaultModel
	}
	cfg.Provider = providerID
	if ai.ValidateEndpoint(cfg.BaseURL) != nil || (cfg.Provider != "openai" && cfg.BaseURL == config.Defaults().BaseURL) {
		// Never display an old credential-bearing/malformed URL as a default.
		cfg.BaseURL = provider.DefaultBaseURL
	}
	cfg.BaseURL, err = setupRead(ui, "setup.endpoint", cfg.BaseURL, false)
	if err != nil {
		return err
	}
	if err := ai.ValidateEndpoint(cfg.BaseURL); err != nil {
		return err
	}
	if cfg.Provider != oldProvider || strings.TrimRight(cfg.BaseURL, "/") != strings.TrimRight(oldEndpoint, "/") {
		cfg.APIKey = ""
	}
	if provider.RequiresAPIKey {
		key := "setup.key"
		if cfg.APIKey != "" {
			key = "setup.keep_key"
		}
		value, readErr := setupRead(ui, key, "", true)
		if readErr != nil {
			return readErr
		}
		if value != "" {
			cfg.APIKey = value
		}
		if cfg.APIKey == "" {
			return errors.New(i18n.T("setup.key_required"))
		}
	} else {
		cfg.APIKey = ""
	}
	if err := config.Validate(cfg); err != nil {
		return err
	}

	discover, err := setupConfirm(ui, "setup.discover", true)
	if err != nil {
		return err
	}
	var models []ai.ModelInfo
	if discover {
		requestCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
		catalog, listErr := services.models(requestCtx, cfg)
		cancel()
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if listErr != nil {
			ui.Print(i18n.T("setup.models_unavailable"))
		} else {
			models = catalog.Models
			if len(models) > 30 {
				models = models[:30]
			}
			if catalog.Stale {
				ui.Print(i18n.T("setup.models_stale"))
			}
			for i, model := range models {
				ui.Print(fmt.Sprintf("  %d. %q", i+1, model.ID))
			}
		}
	}
	model, err := setupRead(ui, "setup.model", cfg.Model, false)
	if err != nil {
		return err
	}
	if index, parseErr := strconv.Atoi(model); parseErr == nil && index >= 1 && index <= len(models) {
		model = models[index-1].ID
	}
	cfg.Model = model
	cfg.MessageFormat, err = setupRead(ui, "setup.format", cfg.MessageFormat, false)
	if err != nil {
		return err
	}
	cfg.Language, err = setupRead(ui, "setup.language", cfg.Language, false)
	if err != nil {
		return err
	}
	if err := config.Validate(cfg); err != nil {
		return err
	}
	ui.Print(i18n.Sprintf("setup.summary", cfg.Provider, cfg.BaseURL, cfg.Model, cfg.MessageFormat, cfg.Language))
	if cfg.PromptTemplate != "" {
		ui.Print(i18n.T("setup.custom_template"))
	}
	check, err := setupConfirm(ui, "setup.test", true)
	if err != nil {
		return err
	}
	if check {
		requestCtx, cancel := context.WithTimeout(ctx, 35*time.Second)
		err := services.test(requestCtx, cfg)
		cancel()
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if err != nil {
			// Never echo response bodies, arbitrary provider errors, or secrets.
			return errors.New(i18n.T("setup.test_failed"))
		}
		ui.Print(i18n.T("setup.test_ok"))
	}
	save, err := setupConfirm(ui, "setup.save", false)
	if err != nil {
		return err
	}
	if !save {
		return io.EOF
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := config.SetGlobalValues(map[string]string{
		"provider": cfg.Provider, "base_url": cfg.BaseURL, "api_key": cfg.APIKey,
		"model": cfg.Model, "message_format": cfg.MessageFormat, "language": cfg.Language,
	}); err != nil {
		return err
	}
	ui.Print(i18n.T("setup.saved"))
	return nil
}

func setupRead(ui setupUI, key, fallback string, secret bool) (string, error) {
	prompt := i18n.T(key)
	if fallback != "" {
		prompt += fmt.Sprintf(" [%q]", fallback)
	}
	value, err := ui.Read(prompt+": ", secret)
	if err != nil {
		return "", err
	}
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback, nil
	}
	return value, nil
}

func setupConfirm(ui setupUI, key string, defaultYes bool) (bool, error) {
	for {
		fallback := "n"
		if defaultYes {
			fallback = "y"
		}
		value, err := setupRead(ui, key, fallback, false)
		if err != nil {
			return false, err
		}
		switch strings.ToLower(value) {
		case "y", "yes", "是":
			return true, nil
		case "n", "no", "否":
			return false, nil
		default:
			ui.Print(i18n.T("setup.yes_no"))
		}
	}
}

func testSetupConnection(ctx context.Context, cfg *config.Config) error {
	response, err := ai.NewClient(cfg, log.New(io.Discard, "", 0)).GenerateCompletion(ctx, "You are a connectivity test.", "Reply with exactly OK.")
	if err != nil {
		return err
	}
	if strings.TrimSpace(response) == "" {
		return errors.New("empty test response")
	}
	return nil
}
