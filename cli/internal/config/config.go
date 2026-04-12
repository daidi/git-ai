// Package config manages layered configuration for git-ai.
// Priority: env vars → project (.git-ai.json) → global (~/.config/git-ai/config.json) → defaults.
package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Config holds all git-ai configuration values.
type Config struct {
	APIKey         string `json:"api_key,omitempty"`
	Model          string `json:"model,omitempty"`
	BaseURL        string `json:"base_url,omitempty"`
	Provider       string `json:"provider,omitempty"`
	Language       string `json:"language,omitempty"`
	PushPolicy     string `json:"push_policy,omitempty"`
	MessageFormat  string `json:"message_format,omitempty"`
	PromptTemplate string `json:"prompt_template,omitempty"`
	MaxDiffTokens  int    `json:"max_diff_tokens,omitempty"`
	CheckUpdate    *bool  `json:"check_update,omitempty"`
}

// Defaults returns a Config with default values.
func Defaults() *Config {
	tru := true
	return &Config{
		Model:         "deepseek-chat",
		BaseURL:       "https://api.deepseek.com/v1",
		Provider:      "openai",
		Language:      "en",
		PushPolicy:    "queue",
		MessageFormat: "conventional",
		MaxDiffTokens: 2000,
		CheckUpdate:   &tru,
	}
}

// GlobalConfigPath returns the path to the global config file.
func GlobalConfigPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "git-ai", "config.json")
}

// ProjectConfigPath returns the path to the project-level config file.
func ProjectConfigPath(repoRoot string) string {
	return filepath.Join(repoRoot, ".git-ai.json")
}

// Load reads and merges configuration from all layers.
func Load(repoRoot string) (*Config, error) {
	cfg := Defaults()

	// Layer 1: Global config
	if data, err := os.ReadFile(GlobalConfigPath()); err == nil {
		var global Config
		if err := json.Unmarshal(data, &global); err == nil {
			mergeConfig(cfg, &global)
		}
	}

	// Layer 2: Project config
	if repoRoot != "" {
		if data, err := os.ReadFile(ProjectConfigPath(repoRoot)); err == nil {
			var project Config
			if err := json.Unmarshal(data, &project); err == nil {
				mergeConfig(cfg, &project)
			}
		}
	}

	// Layer 3: Environment variable overrides
	applyEnvOverrides(cfg)

	return cfg, nil
}

// Save writes a config to the specified path. Creates parent dirs as needed.
func Save(cfg *Config, path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

// LoadFile reads a config from a single file without merging.
func LoadFile(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// Set writes a single key-value pair to a config file, creating the file if needed.
func Set(path, key, value string) error {
	cfg := &Config{}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, cfg)
	}

	switch key {
	case "api_key":
		cfg.APIKey = value
	case "model":
		cfg.Model = value
	case "base_url":
		cfg.BaseURL = value
	case "provider":
		cfg.Provider = value
	case "language":
		cfg.Language = value
	case "push_policy":
		cfg.PushPolicy = value
	case "message_format":
		cfg.MessageFormat = value
	case "prompt_template":
		cfg.PromptTemplate = value
	case "check_update":
		b := value == "true"
		cfg.CheckUpdate = &b
	default:
		return &UnknownKeyError{Key: key}
	}

	return Save(cfg, path)
}

// Get reads a single key from the merged config.
func Get(cfg *Config, key string) (string, error) {
	switch key {
	case "api_key":
		return cfg.APIKey, nil
	case "model":
		return cfg.Model, nil
	case "base_url":
		return cfg.BaseURL, nil
	case "provider":
		return cfg.Provider, nil
	case "language":
		return cfg.Language, nil
	case "push_policy":
		return cfg.PushPolicy, nil
	case "message_format":
		return cfg.MessageFormat, nil
	case "prompt_template":
		return cfg.PromptTemplate, nil
	case "check_update":
		if cfg.CheckUpdate != nil && *cfg.CheckUpdate {
			return "true", nil
		}
		return "false", nil
	default:
		return "", &UnknownKeyError{Key: key}
	}
}

// ValidKeys returns all valid configuration key names.
func ValidKeys() []string {
	return []string{
		"api_key", "model", "base_url", "provider",
		"language", "push_policy", "message_format", "prompt_template", "check_update",
	}
}

// UnknownKeyError is returned when an invalid config key is used.
type UnknownKeyError struct {
	Key string
}

func (e *UnknownKeyError) Error() string {
	return "unknown config key: " + e.Key
}

// mergeConfig applies non-zero fields from src into dst.
func mergeConfig(dst, src *Config) {
	if src.APIKey != "" {
		dst.APIKey = src.APIKey
	}
	if src.Model != "" {
		dst.Model = src.Model
	}
	if src.BaseURL != "" {
		dst.BaseURL = src.BaseURL
	}
	if src.Provider != "" {
		dst.Provider = src.Provider
	}
	if src.Language != "" {
		dst.Language = src.Language
	}
	if src.PushPolicy != "" {
		dst.PushPolicy = src.PushPolicy
	}
	if src.MessageFormat != "" {
		dst.MessageFormat = src.MessageFormat
	}
	if src.PromptTemplate != "" {
		dst.PromptTemplate = src.PromptTemplate
	}
	if src.MaxDiffTokens > 0 {
		dst.MaxDiffTokens = src.MaxDiffTokens
	}
	if src.CheckUpdate != nil {
		dst.CheckUpdate = src.CheckUpdate
	}
}

// applyEnvOverrides applies environment variable overrides to the config.
func applyEnvOverrides(cfg *Config) {
	if v := os.Getenv("GIT_AI_API_KEY"); v != "" {
		cfg.APIKey = v
	}
	if v := os.Getenv("GIT_AI_MODEL"); v != "" {
		cfg.Model = v
	}
	if v := os.Getenv("GIT_AI_BASE_URL"); v != "" {
		cfg.BaseURL = v
	}
	if v := os.Getenv("GIT_AI_PROVIDER"); v != "" {
		cfg.Provider = v
	}
	if v := os.Getenv("GIT_AI_LANGUAGE"); v != "" {
		cfg.Language = v
	}
}
