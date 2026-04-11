package cmd

import (
	"fmt"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/internal/config"
)

var configGlobal bool

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage git-ai configuration",
	RunE: func(cmd *cobra.Command, args []string) error {
		return cmd.Help()
	},
}

var configSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Set a configuration value",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		key, value := args[0], args[1]

		var path string
		if configGlobal {
			path = config.GlobalConfigPath()
		} else {
			path = config.ProjectConfigPath(GetGitRoot())
		}

		if err := config.Set(path, key, value); err != nil {
			return err
		}

		scope := "project"
		if configGlobal {
			scope = "global"
		}
		Printf("✅ Set %s = %s (%s)\n", key, value, scope)
		return nil
	},
}

var configGetCmd = &cobra.Command{
	Use:   "get <key>",
	Short: "Get a configuration value (merged from all sources)",
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
		fmt.Println(val)
		return nil
	},
}

var configListCmd = &cobra.Command{
	Use:   "list",
	Short: "Show all configuration values (merged)",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.Load(GetGitRoot())
		if err != nil {
			return err
		}

		Printf("%-16s %s\n", "api_key", maskKey(cfg.APIKey))
		Printf("%-16s %s\n", "model", cfg.Model)
		Printf("%-16s %s\n", "base_url", cfg.BaseURL)
		Printf("%-16s %s\n", "provider", cfg.Provider)
		Printf("%-16s %s\n", "language", cfg.Language)
		Printf("%-16s %s\n", "push_policy", cfg.PushPolicy)
		Printf("%-16s %s\n", "message_format", cfg.MessageFormat)
		if cfg.PromptTemplate != "" {
			Printf("%-16s %s\n", "prompt_template", "(custom)")
		}
		Printf("%-16s %d\n", "max_diff_tokens", cfg.MaxDiffTokens)
		return nil
	},
}

func init() {
	configSetCmd.Flags().BoolVar(&configGlobal, "global", false, "Set in global config (~/.config/git-ai/config.json)")
	configCmd.AddCommand(configSetCmd)
	configCmd.AddCommand(configGetCmd)
	configCmd.AddCommand(configListCmd)
	rootCmd.AddCommand(configCmd)
}

// maskKey masks an API key for display, showing only first 4 and last 4 characters.
func maskKey(key string) string {
	if key == "" {
		return "(not set)"
	}
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}
