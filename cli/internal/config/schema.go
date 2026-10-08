package config

// SchemaVersion is incremented only when the machine-readable configuration
// contract changes incompatibly. Additive fields do not require a bump.
const SchemaVersion = 1

// FieldSchema describes one value accepted by git-ai config. IDE integrations
// use this contract instead of duplicating defaults and enum values.
type FieldSchema struct {
	Key         string   `json:"key"`
	Type        string   `json:"type"`
	Default     any      `json:"default,omitempty"`
	Enum        []string `json:"enum,omitempty"`
	Minimum     *int     `json:"minimum,omitempty"`
	Maximum     *int     `json:"maximum,omitempty"`
	Secret      bool     `json:"secret,omitempty"`
	GlobalOnly  bool     `json:"global_only,omitempty"`
	Multiline   bool     `json:"multiline,omitempty"`
	Description string   `json:"description"`
}

// ProviderSchema describes provider behavior needed by setup UIs.
type ProviderSchema struct {
	ID             string `json:"id"`
	Label          string `json:"label"`
	RequiresAPIKey bool   `json:"requires_api_key"`
	DefaultBaseURL string `json:"default_base_url"`
	DefaultModel   string `json:"default_model"`
}

// ConfigSchema is the stable JSON document returned by config schema.
type ConfigSchema struct {
	Version   int              `json:"version"`
	Fields    []FieldSchema    `json:"fields"`
	Providers []ProviderSchema `json:"providers"`
}

func intPointer(value int) *int { return &value }

// Schema returns the authoritative configuration contract.
func Schema() ConfigSchema {
	defaults := Defaults()
	return ConfigSchema{
		Version: SchemaVersion,
		Fields: []FieldSchema{
			{Key: "api_key", Type: "string", Secret: true, GlobalOnly: true, Description: "API key used by the configured provider"},
			{Key: "provider", Type: "string", Default: defaults.Provider, Enum: []string{"openai", "ollama", "anthropic", "gemini"}, Description: "AI provider protocol"},
			{Key: "model", Type: "string", Default: defaults.Model, Description: "Provider model identifier"},
			{Key: "base_url", Type: "string", Default: defaults.BaseURL, Description: "Provider API base URL"},
			{Key: "language", Type: "string", Default: defaults.Language, Description: "Generated commit message language"},
			{Key: "ui_language", Type: "string", Description: "CLI and IDE interface language"},
			{Key: "push_policy", Type: "string", Default: defaults.PushPolicy, Enum: []string{"queue", "block"}, Description: "Behavior when push starts during polishing"},
			{Key: "message_format", Type: "string", Default: defaults.MessageFormat, Enum: []string{"plain", "conventional", "gitmoji", "subject-body"}, Description: "Generated commit message format"},
			{Key: "commit_attribution", Type: "string", Default: defaults.CommitAttribution, Enum: []string{"off", "compact"}, Description: "Optionally append a Polished-by trailer with the Git AI download URL after successful polishing"},
			{Key: "prompt_template", Type: "string", Multiline: true, Description: "Custom Go template for generation prompts"},
			{Key: "smart_skip", Type: "boolean", Default: defaults.SmartSkipEnabled(), Description: "Keep valid new commit messages without calling the model"},
			{Key: "max_diff_tokens", Type: "integer", Default: defaults.MaxDiffTokens, Minimum: intPointer(1), Maximum: intPointer(100_000), Description: "Maximum approximate diff tokens sent to the provider"},
			{Key: "log_level", Type: "string", Default: defaults.LogLevel, Enum: []string{"error", "info", "debug"}, Description: "Diagnostic log verbosity"},
			{Key: "check_update", Type: "boolean", Default: defaults.CheckUpdate != nil && *defaults.CheckUpdate, Description: "Check for new Git AI releases"},
			{Key: "usage_telemetry", Type: "boolean", GlobalOnly: true, Default: defaults.UsageTelemetryEnabled(), Description: "Send a random installation ID, IDE/terminal label, and daily polishing activity; no code, paths, messages, or credentials"},
			{Key: "explain", Type: "boolean", Default: defaults.ExplainEnabled(), Description: "Append a short explanation of why the change was made"},
		},
		Providers: []ProviderSchema{
			{ID: "openai", Label: "OpenAI compatible", RequiresAPIKey: true, DefaultBaseURL: defaults.BaseURL, DefaultModel: defaults.Model},
			{ID: "ollama", Label: "Ollama", RequiresAPIKey: false, DefaultBaseURL: "http://localhost:11434/v1", DefaultModel: "llama3"},
			{ID: "anthropic", Label: "Anthropic", RequiresAPIKey: true, DefaultBaseURL: "https://api.anthropic.com/v1", DefaultModel: "claude-sonnet-4-20250514"},
			{ID: "gemini", Label: "Google Gemini", RequiresAPIKey: true, DefaultBaseURL: "https://generativelanguage.googleapis.com/v1beta", DefaultModel: "gemini-2.5-flash"},
		},
	}
}
