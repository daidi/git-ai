// Package config manages layered configuration for git-ai.
// Priority: environment -> repository-local Git config -> user config -> defaults.
package config

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/gofrs/flock"
)

const configDirEnv = "GIT_AI_CONFIG_DIR"

const maxConfigFileBytes int64 = 1 << 20

// Scope identifies a persisted configuration layer.
type Scope string

const (
	ScopeGlobal Scope = "global"
	ScopeLocal  Scope = "local"
	ScopeMerged Scope = "merged"
)

// Config holds all git-ai configuration values.
type Config struct {
	APIKey         string `json:"api_key,omitempty"`
	Model          string `json:"model,omitempty"`
	BaseURL        string `json:"base_url,omitempty"`
	Provider       string `json:"provider,omitempty"`
	Language       string `json:"language,omitempty"`
	UILanguage     string `json:"ui_language,omitempty"`
	PushPolicy     string `json:"push_policy,omitempty"`
	MessageFormat  string `json:"message_format,omitempty"`
	PromptTemplate string `json:"prompt_template,omitempty"`
	SmartSkip      *bool  `json:"smart_skip,omitempty"`
	MaxDiffTokens  int    `json:"max_diff_tokens,omitempty"`
	LogLevel       string `json:"log_level,omitempty"`
	CheckUpdate    *bool  `json:"check_update,omitempty"`
	Explain        *bool  `json:"explain,omitempty"`
}

func boolPtr(value bool) *bool { return &value }

// IsDebug returns true when safe diagnostic logging is enabled.
func (c *Config) IsDebug() bool { return c.LogLevel == "debug" }

// ExplainEnabled resolves the optional explain setting.
func (c *Config) ExplainEnabled() bool { return c.Explain != nil && *c.Explain }

// SmartSkipEnabled resolves whether valid, non-repeated messages should bypass
// AI polishing. Load always applies a default, while raw config scopes may
// intentionally leave this unset so they can inherit another layer.
func (c *Config) SmartSkipEnabled() bool { return c.SmartSkip != nil && *c.SmartSkip }

// Defaults returns a Config with default values.
func Defaults() *Config {
	return &Config{
		Model:         "deepseek-chat",
		BaseURL:       "https://api.deepseek.com/v1",
		Provider:      "openai",
		Language:      "en",
		PushPolicy:    "queue",
		MessageFormat: "conventional",
		SmartSkip:     boolPtr(true),
		MaxDiffTokens: 8000,
		LogLevel:      "info",
		CheckUpdate:   boolPtr(true),
		Explain:       boolPtr(false),
	}
}

// GlobalConfigPath returns the OS-native per-user application config path.
func GlobalConfigPath() string {
	if override := os.Getenv(configDirEnv); override != "" {
		return filepath.Join(override, "config.json")
	}
	if dir, err := os.UserConfigDir(); err == nil && dir != "" {
		return filepath.Join(dir, "git-ai", "config.json")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "git-ai", "config.json")
}

// LegacyGlobalConfigPath is the path used by releases <= 1.1.4.
func LegacyGlobalConfigPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "git-ai", "config.json")
}

// ProjectConfigPath returns the path used by legacy releases. It is exposed for
// diagnostics/tests only: current versions never read, create, or modify this
// worktree file. Trusting it could let a cloned repository redirect a user's
// global API key to an attacker-controlled endpoint.
func ProjectConfigPath(repoRoot string) string { return filepath.Join(repoRoot, ".git-ai.json") }

// Load resolves all configuration layers.
func Load(repoRoot string) (*Config, error) {
	cfg := Defaults()

	global, err := LoadScope(repoRoot, ScopeGlobal)
	if err != nil {
		return nil, err
	}
	mergeConfig(cfg, global)

	local, err := LoadScope(repoRoot, ScopeLocal)
	if err != nil {
		return nil, err
	}
	mergeConfig(cfg, local)
	applyEnvOverrides(cfg)
	return cfg, nil
}

// LoadScope reads a raw persisted layer, or the fully merged view.
func LoadScope(repoRoot string, scope Scope) (*Config, error) {
	switch scope {
	case ScopeMerged:
		return Load(repoRoot)
	case ScopeGlobal:
		path := GlobalConfigPath()
		cfg, err := LoadFile(path)
		if err == nil {
			return cfg, nil
		}
		if !os.IsNotExist(err) {
			return nil, fmt.Errorf("read global config: %w", err)
		}
		// Test/portable installations that explicitly override the config
		// directory must not unexpectedly inherit credentials from the account's
		// real legacy path.
		if os.Getenv(configDirEnv) != "" {
			return &Config{}, nil
		}
		legacy := LegacyGlobalConfigPath()
		if canonicalPath(legacy) != canonicalPath(path) {
			cfg, legacyErr := LoadFile(legacy)
			if legacyErr == nil {
				return cfg, nil
			}
			if !os.IsNotExist(legacyErr) {
				return nil, fmt.Errorf("read legacy global config: %w", legacyErr)
			}
		}
		return &Config{}, nil
	case ScopeLocal:
		if repoRoot == "" {
			return &Config{}, nil
		}
		return loadLocal(repoRoot)
	default:
		return nil, fmt.Errorf("unknown config scope: %s", scope)
	}
}

// Save writes a JSON config atomically with private permissions.
func Save(cfg *Config, path string) error {
	if err := Validate(cfg); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return writeAtomic(path, data)
}

// LoadFile reads a config from one JSON file without merging.
func LoadFile(path string) (*Config, error) {
	if info, err := os.Stat(path); err != nil {
		return nil, err
	} else if !info.Mode().IsRegular() || info.Size() > maxConfigFileBytes {
		return nil, errors.New("configuration file is not a bounded regular file")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	if err := Validate(&cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// SetGlobal atomically changes one user-level value.
func SetGlobal(key, value string) error {
	return updateGlobal(func(cfg *Config) error { return SetValue(cfg, key, value) })
}

// UnsetGlobal removes one user-level value.
func UnsetGlobal(key string) error {
	return updateGlobal(func(cfg *Config) error { return UnsetValue(cfg, key) })
}

// ReplaceGlobal atomically replaces the complete user layer.
func ReplaceGlobal(cfg *Config) error {
	return withGlobalLock(func(path string) error { return Save(cfg, path) })
}

func updateGlobal(change func(*Config) error) error {
	return withGlobalLock(func(path string) error {
		cfg, err := LoadScope("", ScopeGlobal)
		if err != nil {
			return err
		}
		if err := change(cfg); err != nil {
			return err
		}
		return Save(cfg, path)
	})
}

func withGlobalLock(fn func(path string) error) error {
	path := GlobalConfigPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	lockPath := path + ".lock"
	lock := flock.New(lockPath)
	if err := lock.Lock(); err != nil {
		return err
	}
	defer func() { _ = lock.Unlock() }()
	_ = os.Chmod(lockPath, 0o600)
	return fn(path)
}

// SetLocal stores one repository override in .git/config, not the worktree.
func SetLocal(repoRoot, key, value string) error {
	if repoRoot == "" {
		return errors.New("not inside a Git repository")
	}
	if key == "api_key" {
		return errors.New("api_key is user-level only; use --global so secrets are never stored in a repository")
	}
	probe := &Config{}
	if err := SetValue(probe, key, value); err != nil {
		return err
	}
	name, ok := gitConfigNames[key]
	if !ok {
		return &UnknownKeyError{Key: key}
	}
	return runGitConfig(repoRoot, "--replace-all", "git-ai."+name, value)
}

// UnsetLocal removes one repository override.
func UnsetLocal(repoRoot, key string) error {
	name, ok := gitConfigNames[key]
	if !ok {
		return &UnknownKeyError{Key: key}
	}
	err := runGitConfig(repoRoot, "--unset-all", "git-ai."+name)
	if isGitConfigMissing(err) {
		return nil
	}
	return err
}

// ReplaceLocal replaces the git-ai section in .git/config.
func ReplaceLocal(repoRoot string, cfg *Config) error {
	if repoRoot == "" {
		return errors.New("not inside a Git repository")
	}
	if err := runGitConfig(repoRoot, "--remove-section", "git-ai"); err != nil && !isGitConfigMissing(err) {
		return err
	}
	values := Values(cfg)
	delete(values, "api_key")
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		if err := SetLocal(repoRoot, key, values[key]); err != nil {
			return err
		}
	}
	return nil
}

// ResetScope clears a persisted layer.
func ResetScope(repoRoot string, scope Scope) error {
	switch scope {
	case ScopeGlobal:
		return withGlobalLock(func(path string) error {
			if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
				return err
			}
			return nil
		})
	case ScopeLocal:
		err := runGitConfig(repoRoot, "--remove-section", "git-ai")
		if isGitConfigMissing(err) {
			return nil
		}
		return err
	default:
		return fmt.Errorf("cannot reset scope %s", scope)
	}
}

// SetValue parses and assigns one config value.
func SetValue(cfg *Config, key, value string) error {
	if strings.ContainsRune(value, '\x00') {
		return fmt.Errorf("invalid %s: NUL bytes are not allowed", key)
	}
	switch key {
	case "api_key":
		if err := checkValueLength(key, value, 16<<10); err != nil {
			return err
		}
		cfg.APIKey = value
	case "model":
		if err := checkValueLength(key, value, 1024); err != nil {
			return err
		}
		cfg.Model = value
	case "base_url":
		if err := checkValueLength(key, value, 4096); err != nil {
			return err
		}
		cfg.BaseURL = value
	case "provider":
		if !oneOf(value, "openai", "ollama", "anthropic", "gemini") {
			return fmt.Errorf("invalid provider: %s", value)
		}
		cfg.Provider = value
	case "language":
		if err := checkValueLength(key, value, 128); err != nil {
			return err
		}
		cfg.Language = value
	case "ui_language":
		if err := checkValueLength(key, value, 128); err != nil {
			return err
		}
		cfg.UILanguage = value
	case "push_policy":
		if !oneOf(value, "queue", "block") {
			return fmt.Errorf("invalid push_policy: %s", value)
		}
		cfg.PushPolicy = value
	case "message_format":
		if !oneOf(value, "plain", "conventional", "gitmoji", "subject-body") {
			return fmt.Errorf("invalid message_format: %s", value)
		}
		cfg.MessageFormat = value
	case "prompt_template":
		if err := checkValueLength(key, value, 64<<10); err != nil {
			return err
		}
		cfg.PromptTemplate = value
	case "smart_skip":
		v, err := strconv.ParseBool(value)
		if err != nil {
			return fmt.Errorf("invalid smart_skip value: %s", value)
		}
		cfg.SmartSkip = boolPtr(v)
	case "log_level":
		if !oneOf(value, "error", "info", "debug") {
			return fmt.Errorf("invalid log_level: %s", value)
		}
		cfg.LogLevel = value
	case "max_diff_tokens":
		v, err := strconv.Atoi(value)
		if err != nil || v <= 0 || v > 100_000 {
			return fmt.Errorf("invalid max_diff_tokens value: %s", value)
		}
		cfg.MaxDiffTokens = v
	case "check_update":
		v, err := strconv.ParseBool(value)
		if err != nil {
			return fmt.Errorf("invalid check_update value: %s", value)
		}
		cfg.CheckUpdate = boolPtr(v)
	case "explain":
		v, err := strconv.ParseBool(value)
		if err != nil {
			return fmt.Errorf("invalid explain value: %s", value)
		}
		cfg.Explain = boolPtr(v)
	default:
		return &UnknownKeyError{Key: key}
	}
	return nil
}

func checkValueLength(key, value string, maximum int) error {
	if len(value) > maximum {
		return fmt.Errorf("%s exceeds the %d-byte safety limit", key, maximum)
	}
	return nil
}

// Validate applies the same bounds and enum checks to configuration decoded
// directly from disk as to values set through the CLI.
func Validate(cfg *Config) error {
	for key, value := range Values(cfg) {
		if err := SetValue(&Config{}, key, value); err != nil {
			return err
		}
	}
	return nil
}

// UnsetValue clears one field.
func UnsetValue(cfg *Config, key string) error {
	switch key {
	case "api_key":
		cfg.APIKey = ""
	case "model":
		cfg.Model = ""
	case "base_url":
		cfg.BaseURL = ""
	case "provider":
		cfg.Provider = ""
	case "language":
		cfg.Language = ""
	case "ui_language":
		cfg.UILanguage = ""
	case "push_policy":
		cfg.PushPolicy = ""
	case "message_format":
		cfg.MessageFormat = ""
	case "prompt_template":
		cfg.PromptTemplate = ""
	case "smart_skip":
		cfg.SmartSkip = nil
	case "max_diff_tokens":
		cfg.MaxDiffTokens = 0
	case "log_level":
		cfg.LogLevel = ""
	case "check_update":
		cfg.CheckUpdate = nil
	case "explain":
		cfg.Explain = nil
	default:
		return &UnknownKeyError{Key: key}
	}
	return nil
}

// Get reads a single key.
func Get(cfg *Config, key string) (string, error) {
	values := Values(cfg)
	if value, ok := values[key]; ok {
		return value, nil
	}
	for _, valid := range ValidKeys() {
		if key == valid {
			return "", nil
		}
	}
	return "", &UnknownKeyError{Key: key}
}

// Values returns fields present in cfg as CLI strings.
func Values(cfg *Config) map[string]string {
	values := make(map[string]string)
	if cfg.APIKey != "" {
		values["api_key"] = cfg.APIKey
	}
	if cfg.Model != "" {
		values["model"] = cfg.Model
	}
	if cfg.BaseURL != "" {
		values["base_url"] = cfg.BaseURL
	}
	if cfg.Provider != "" {
		values["provider"] = cfg.Provider
	}
	if cfg.Language != "" {
		values["language"] = cfg.Language
	}
	if cfg.UILanguage != "" {
		values["ui_language"] = cfg.UILanguage
	}
	if cfg.PushPolicy != "" {
		values["push_policy"] = cfg.PushPolicy
	}
	if cfg.MessageFormat != "" {
		values["message_format"] = cfg.MessageFormat
	}
	if cfg.PromptTemplate != "" {
		values["prompt_template"] = cfg.PromptTemplate
	}
	if cfg.SmartSkip != nil {
		values["smart_skip"] = strconv.FormatBool(*cfg.SmartSkip)
	}
	if cfg.MaxDiffTokens > 0 {
		values["max_diff_tokens"] = strconv.Itoa(cfg.MaxDiffTokens)
	}
	if cfg.LogLevel != "" {
		values["log_level"] = cfg.LogLevel
	}
	if cfg.CheckUpdate != nil {
		values["check_update"] = strconv.FormatBool(*cfg.CheckUpdate)
	}
	if cfg.Explain != nil {
		values["explain"] = strconv.FormatBool(*cfg.Explain)
	}
	return values
}

func ValidKeys() []string {
	return []string{
		"api_key", "model", "base_url", "provider", "language", "ui_language",
		"push_policy", "message_format", "prompt_template", "smart_skip", "max_diff_tokens",
		"log_level", "check_update", "explain",
	}
}

type UnknownKeyError struct{ Key string }

func (e *UnknownKeyError) Error() string { return "unknown config key: " + e.Key }

func mergeConfig(dst, src *Config) {
	if src == nil {
		return
	}
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
	if src.UILanguage != "" {
		dst.UILanguage = src.UILanguage
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
	if src.SmartSkip != nil {
		dst.SmartSkip = boolPtr(*src.SmartSkip)
	}
	if src.MaxDiffTokens > 0 {
		dst.MaxDiffTokens = src.MaxDiffTokens
	}
	if src.LogLevel != "" {
		dst.LogLevel = src.LogLevel
	}
	if src.CheckUpdate != nil {
		dst.CheckUpdate = boolPtr(*src.CheckUpdate)
	}
	if src.Explain != nil {
		dst.Explain = boolPtr(*src.Explain)
	}
}

func applyEnvOverrides(cfg *Config) {
	env := map[string]string{
		"api_key": "GIT_AI_API_KEY", "model": "GIT_AI_MODEL",
		"base_url": "GIT_AI_BASE_URL", "provider": "GIT_AI_PROVIDER",
		"language": "GIT_AI_LANGUAGE", "ui_language": "GIT_AI_UI_LANGUAGE",
		"push_policy": "GIT_AI_PUSH_POLICY", "message_format": "GIT_AI_MESSAGE_FORMAT",
		"prompt_template": "GIT_AI_PROMPT_TEMPLATE", "log_level": "GIT_AI_LOG_LEVEL",
		"smart_skip":      "GIT_AI_SMART_SKIP",
		"max_diff_tokens": "GIT_AI_MAX_DIFF_TOKENS", "check_update": "GIT_AI_CHECK_UPDATE",
		"explain": "GIT_AI_EXPLAIN",
	}
	for key, name := range env {
		if value, ok := os.LookupEnv(name); ok && value != "" {
			_ = SetValue(cfg, key, value)
		}
	}
}

var gitConfigNames = map[string]string{
	"api_key": "api-key", "model": "model", "base_url": "base-url",
	"provider": "provider", "language": "language", "ui_language": "ui-language",
	"push_policy": "push-policy", "message_format": "message-format",
	"prompt_template": "prompt-template", "max_diff_tokens": "max-diff-tokens",
	"smart_skip": "smart-skip",
	"log_level":  "log-level", "check_update": "check-update", "explain": "explain",
}

var configKeysByGitName = func() map[string]string {
	result := make(map[string]string, len(gitConfigNames))
	for key, name := range gitConfigNames {
		result[name] = key
	}
	return result
}()

func loadLocal(repoRoot string) (*Config, error) {
	cmd := exec.Command("git", "-C", repoRoot, "config", "--local", "--list", "--null")
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("read local Git config: %w", err)
	}
	cfg := &Config{}
	for _, entry := range bytes.Split(out, []byte{0}) {
		parts := bytes.SplitN(entry, []byte{'\n'}, 2)
		if len(parts) != 2 {
			continue
		}
		name := strings.ToLower(string(parts[0]))
		if !strings.HasPrefix(name, "git-ai.") {
			continue
		}
		key, ok := configKeysByGitName[strings.TrimPrefix(name, "git-ai.")]
		if !ok || key == "api_key" {
			continue
		}
		if err := SetValue(cfg, key, string(parts[1])); err != nil {
			return nil, fmt.Errorf("invalid local Git config %s: %w", name, err)
		}
	}
	return cfg, nil
}

type gitConfigError struct {
	output string
	err    error
}

func (e *gitConfigError) Error() string {
	return fmt.Sprintf("git config failed: %s", strings.TrimSpace(e.output))
}
func (e *gitConfigError) Unwrap() error { return e.err }

func runGitConfig(repoRoot string, args ...string) error {
	base := []string{"-C", repoRoot, "config", "--local"}
	cmd := exec.Command("git", append(base, args...)...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return &gitConfigError{output: string(out), err: err}
	}
	return nil
}

func isGitConfigMissing(err error) bool {
	if err == nil {
		return false
	}
	var exitErr *exec.ExitError
	return errors.As(err, &exitErr) && (exitErr.ExitCode() == 1 || exitErr.ExitCode() == 5)
}

func writeAtomic(path string, data []byte) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".config-*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer func() { _ = tmp.Close(); _ = os.Remove(tmpPath) }()
	if err := tmp.Chmod(0o600); err != nil {
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		return err
	}
	if err := tmp.Sync(); err != nil {
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpPath, path)
}

func canonicalPath(path string) string {
	if abs, err := filepath.Abs(path); err == nil {
		path = abs
	}
	return filepath.Clean(path)
}

func oneOf(value string, allowed ...string) bool {
	for _, candidate := range allowed {
		if value == candidate {
			return true
		}
	}
	return false
}
