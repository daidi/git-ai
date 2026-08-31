package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/internal/ai"
	"github.com/daidi/git-ai/internal/config"
	"github.com/daidi/git-ai/internal/i18n"
)

var (
	configGlobal bool
	configScope  string
	configJSON   bool
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage git-ai configuration",
	RunE:  func(cmd *cobra.Command, args []string) error { return cmd.Help() },
}

var configSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Set a configuration value",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		key, value := args[0], args[1]
		var err error
		scope := "repository"
		if configGlobal {
			scope = "global"
			err = config.SetGlobal(key, value)
		} else {
			if GetGitRoot() == "" {
				return errors.New("not inside a Git repository; use --global for user configuration")
			}
			err = config.SetLocal(GetGitRoot(), key, value)
		}
		if err != nil {
			return err
		}
		display := value
		if key == "api_key" {
			display = maskKey(value)
		}
		Printf("%s", i18n.Sprintf("config.set", key, display, scope))
		return nil
	},
}

var configUnsetCmd = &cobra.Command{
	Use:   "unset <key>",
	Short: "Remove a configuration override",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if configGlobal {
			return config.UnsetGlobal(args[0])
		}
		if GetGitRoot() == "" {
			return errors.New("not inside a Git repository")
		}
		return config.UnsetLocal(GetGitRoot(), args[0])
	},
}

var configGetCmd = &cobra.Command{
	Use:   "get <key>",
	Short: "Get a merged configuration value",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load(GetGitRoot())
		if err != nil {
			return err
		}
		val, err := config.Get(cfg, args[0])
		if err != nil {
			return err
		}
		if args[0] == "api_key" {
			val = maskKey(val)
		}
		fmt.Println(val)
		return nil
	},
}

var configListCmd = &cobra.Command{
	Use:   "list",
	Short: "Show configuration values",
	RunE: func(cmd *cobra.Command, args []string) error {
		scope, err := parseScope(configScope)
		if err != nil {
			return err
		}
		cfg, err := config.LoadScope(GetGitRoot(), scope)
		if err != nil {
			return err
		}
		if configJSON {
			return printConfigJSON(cfg)
		}
		printConfig(cfg)
		return nil
	},
}

// config replace is used by IDE integrations so they never write config files
// themselves. Input is one JSON object on stdin.
var configReplaceCmd = &cobra.Command{
	Use:    "replace",
	Short:  "Replace a configuration scope from JSON on stdin",
	Hidden: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		scope, err := parseWritableScope(configScope)
		if err != nil {
			return err
		}
		data, err := io.ReadAll(io.LimitReader(cmd.InOrStdin(), 1<<20))
		if err != nil {
			return err
		}
		cfg, present, err := decodeAndValidateConfig(data)
		if err != nil {
			return err
		}
		if scope == config.ScopeLocal {
			if _, ok := present["api_key"]; ok {
				return errors.New("api_key cannot be stored in repository configuration")
			}
			return config.ReplaceLocal(GetGitRoot(), cfg)
		}

		// An empty password field means "keep the existing key", so opening and
		// saving an IDE settings panel cannot accidentally erase credentials.
		if _, supplied := present["api_key"]; !supplied {
			existing, loadErr := config.LoadScope("", config.ScopeGlobal)
			if loadErr != nil {
				return loadErr
			}
			cfg.APIKey = existing.APIKey
		}
		return config.ReplaceGlobal(cfg)
	},
}

var configResetCmd = &cobra.Command{
	Use:   "reset",
	Short: "Reset a configuration scope",
	RunE: func(cmd *cobra.Command, args []string) error {
		scope, err := parseWritableScope(configScope)
		if err != nil {
			return err
		}
		return config.ResetScope(GetGitRoot(), scope)
	},
}

var configTestCmd = &cobra.Command{
	Use:   "test",
	Short: "Test the LLM configuration",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load(GetGitRoot())
		if err != nil {
			return err
		}
		fmt.Printf("Testing configuration for provider: %s, model: %s...\n", cfg.Provider, cfg.Model)
		ctx, cancel := context.WithTimeout(cmd.Context(), 35*time.Second)
		defer cancel()
		client := ai.NewClient(cfg, nil)
		resp, err := client.GenerateCompletion(ctx, "You are a connectivity test.", "Reply with exactly OK.")
		if err != nil {
			return fmt.Errorf("LLM test failed: %w", err)
		}
		fmt.Printf("LLM test successful! Response: %s\n", strings.TrimSpace(resp))
		return nil
	},
}

func init() {
	configSetCmd.Flags().BoolVar(&configGlobal, "global", false, "Set user configuration")
	configUnsetCmd.Flags().BoolVar(&configGlobal, "global", false, "Unset user configuration")
	configListCmd.Flags().StringVar(&configScope, "scope", "merged", "Scope: merged, global, or local")
	configListCmd.Flags().BoolVar(&configJSON, "json", false, "Print JSON")
	configReplaceCmd.Flags().StringVar(&configScope, "scope", "", "Scope: global or local")
	configResetCmd.Flags().StringVar(&configScope, "scope", "", "Scope: global or local")
	configCmd.AddCommand(configSetCmd, configUnsetCmd, configGetCmd, configListCmd, configReplaceCmd, configResetCmd, configTestCmd)
	rootCmd.AddCommand(configCmd)
}

func parseScope(raw string) (config.Scope, error) {
	switch strings.ToLower(raw) {
	case "", "merged":
		return config.ScopeMerged, nil
	case "global", "user":
		return config.ScopeGlobal, nil
	case "local", "project", "repository":
		return config.ScopeLocal, nil
	default:
		return "", fmt.Errorf("invalid config scope: %s", raw)
	}
}

func parseWritableScope(raw string) (config.Scope, error) {
	scope, err := parseScope(raw)
	if err != nil {
		return "", err
	}
	if scope == config.ScopeMerged {
		return "", errors.New("--scope must be global or local")
	}
	if scope == config.ScopeLocal && GetGitRoot() == "" {
		return "", errors.New("not inside a Git repository")
	}
	return scope, nil
}

func printConfigJSON(cfg *config.Config) error {
	// Never print a secret as part of a normal list operation. IDEs render a
	// blank password field and config replace preserves it when omitted.
	copy := *cfg
	configured := copy.APIKey != ""
	copy.APIKey = ""
	data, err := json.Marshal(copy)
	if err != nil {
		return err
	}
	var values map[string]any
	if err := json.Unmarshal(data, &values); err != nil {
		return err
	}
	values["api_key_configured"] = configured
	out, err := json.Marshal(values)
	if err != nil {
		return err
	}
	fmt.Println(string(out))
	return nil
}

func printConfig(cfg *config.Config) {
	values := config.Values(cfg)
	values["api_key"] = maskKey(cfg.APIKey)
	for _, key := range config.ValidKeys() {
		value, ok := values[key]
		if !ok {
			value = "(not set)"
		}
		Printf("%-16s %s\n", key, value)
	}
}

func decodeAndValidateConfig(data []byte) (*config.Config, map[string]json.RawMessage, error) {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, nil, fmt.Errorf("invalid config JSON: %w", err)
	}
	cfg := &config.Config{}
	keys := make([]string, 0, len(raw))
	for key := range raw {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		known := false
		for _, valid := range config.ValidKeys() {
			if key == valid {
				known = true
				break
			}
		}
		if !known {
			return nil, nil, &config.UnknownKeyError{Key: key}
		}
		var value any
		if err := json.Unmarshal(raw[key], &value); err != nil {
			return nil, nil, err
		}
		var text string
		switch typed := value.(type) {
		case string:
			text = typed
		case bool:
			text = fmt.Sprintf("%t", typed)
		case float64:
			if typed != float64(int(typed)) {
				return nil, nil, fmt.Errorf("%s must be an integer", key)
			}
			text = fmt.Sprintf("%d", int(typed))
		case nil:
			delete(raw, key)
			continue
		default:
			return nil, nil, fmt.Errorf("unsupported value for %s", key)
		}
		if text == "" {
			delete(raw, key)
			continue
		}
		if err := config.SetValue(cfg, key, text); err != nil {
			return nil, nil, err
		}
	}
	return cfg, raw, nil
}

func maskKey(key string) string {
	if key == "" {
		return "(not set)"
	}
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}
