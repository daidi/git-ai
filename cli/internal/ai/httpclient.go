package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/daidi/git-ai/cli/internal/config"
)

// Client is the interface for AI providers
type Client interface {
	GenerateCompletion(ctx context.Context, systemPrompt, userPrompt string) (string, error)
}

// OpenAIClient is a simple HTTP client for OpenAI-compatible APIs
type OpenAIClient struct {
	baseURL string
	apiKey  string
	model   string
	client  *http.Client
	logger  *log.Logger
	debug   bool
}

// NewClient creates a new HTTP client for the specified provider
func NewClient(cfg *config.Config, logger *log.Logger) Client {
	if logger == nil {
		logger = log.Default()
	}

	// Create HTTP client with proper timeouts
	client := newProviderHTTPClient()

	switch cfg.Provider {
	case "anthropic":
		url := providerBaseURL(cfg, "https://api.anthropic.com/v1")
		return &AnthropicClient{
			baseURL: url,
			apiKey:  cfg.APIKey,
			model:   cfg.Model,
			client:  client,
			logger:  logger,
			debug:   cfg.IsDebug(),
		}
	case "gemini":
		url := providerBaseURL(cfg, "https://generativelanguage.googleapis.com/v1beta")
		return &GeminiClient{
			baseURL: url,
			apiKey:  cfg.APIKey,
			model:   cfg.Model,
			client:  client,
			logger:  logger,
			debug:   cfg.IsDebug(),
		}
	default:
		url := strings.TrimRight(cfg.BaseURL, "/")
		if cfg.Provider == "ollama" {
			url = providerBaseURL(cfg, "http://localhost:11434/v1")
			if !strings.HasSuffix(url, "/v1") {
				url += "/v1"
			}
		}
		return &OpenAIClient{
			baseURL: url,
			apiKey:  cfg.APIKey,
			model:   cfg.Model,
			client:  client,
			logger:  logger,
			debug:   cfg.IsDebug(),
		}
	}
}

func newProviderHTTPClient() *http.Client {
	return &http.Client{
		Timeout: 60 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			// Provider redirects can forward prompts or credentials to an origin
			// the user did not configure. Require the final endpoint explicitly.
			return &ProviderError{Kind: ErrorModel, Message: "provider redirects are not accepted; configure the final endpoint URL"}
		},
		Transport: &http.Transport{
			DialContext: (&net.Dialer{
				Timeout:   10 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			TLSHandshakeTimeout:   10 * time.Second,
			ResponseHeaderTimeout: 30 * time.Second,
			IdleConnTimeout:       90 * time.Second,
			MaxIdleConns:          10,
			MaxIdleConnsPerHost:   5,
		},
	}
}

// ValidateEndpoint validates an explicitly entered service URL without
// including any part of it in errors. Setup rejects embedded credentials and
// query/fragment components rather than displaying or reusing them.
func ValidateEndpoint(raw string) error {
	endpoint, err := url.Parse(raw)
	if err != nil || endpoint.RawQuery != "" || endpoint.Fragment != "" {
		return &ProviderError{Kind: ErrorModel, Message: "configured provider endpoint is invalid; use a base URL without credentials, query or fragment"}
	}
	return validateProviderURL(endpoint)
}

func validateProviderURL(endpoint *url.URL) error {
	if endpoint == nil || endpoint.Host == "" || endpoint.User != nil {
		return &ProviderError{Kind: ErrorModel, Message: "configured provider endpoint is invalid"}
	}
	if strings.EqualFold(endpoint.Scheme, "https") {
		return nil
	}
	if strings.EqualFold(endpoint.Scheme, "http") && isLoopbackHost(endpoint.Hostname()) {
		return nil
	}
	return &ProviderError{Kind: ErrorModel, Message: "configured provider endpoint must use HTTPS; HTTP is allowed only for localhost"}
}

func isLoopbackHost(host string) bool {
	if strings.EqualFold(host, "localhost") || strings.HasSuffix(strings.ToLower(host), ".localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// The user interfaces historically persisted the DeepSeek default base URL
// even after switching to a native provider. Treat that one incompatible
// inherited value as unset so Anthropic, Gemini, and Ollama use their own
// defaults instead of sending credentials to the wrong endpoint.
func providerBaseURL(cfg *config.Config, fallback string) string {
	url := strings.TrimRight(cfg.BaseURL, "/")
	if url == strings.TrimRight(config.Defaults().BaseURL, "/") && cfg.Provider != "openai" {
		url = ""
	}
	if url == "" {
		return fallback
	}
	return url
}

// ChatRequest represents the OpenAI chat completion request
type ChatRequest struct {
	Model          string    `json:"model"`
	Messages       []Message `json:"messages"`
	Temperature    float64   `json:"temperature"`
	EnableThinking *bool     `json:"enable_thinking,omitempty"` // DashScope: disable reasoning mode for faster responses
}

// Message represents a chat message
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatResponse represents the OpenAI chat completion response
type ChatResponse struct {
	Choices []Choice  `json:"choices"`
	Error   *APIError `json:"error,omitempty"`
}

// Choice represents a response choice
type Choice struct {
	Message Message `json:"message"`
}

// APIError represents an API error response
type APIError struct {
	Message string `json:"message"`
	Type    string `json:"type"`
	Code    string `json:"code"`
}

// GenerateCompletion calls the OpenAI-compatible API
func (c *OpenAIClient) GenerateCompletion(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	// Build request
	disableThinking := false
	reqBody := ChatRequest{
		Model: c.model,
		Messages: []Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		Temperature:    0,
		EnableThinking: &disableThinking, // Disable reasoning mode for qwen3.5-flash (DashScope-specific)
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	// Create HTTP request
	url := strings.TrimRight(c.baseURL, "/") + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	if err := validateProviderURL(req.URL); err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	if c.debug {
		c.logger.Printf("[DEBUG] model request: provider=openai-compatible model=%q payload_bytes=%d", c.model, len(bodyBytes))
	}

	// Send request
	resp, err := c.client.Do(req)
	if err != nil {
		return "", classifyTransportError(err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return "", classifyHTTPStatus(resp.StatusCode, resp.Header.Get("Retry-After"))
	}
	respBody, err := readProviderResponse(resp.Body)
	if err != nil {
		return "", err
	}

	if c.debug {
		c.logger.Printf("[DEBUG] model response: status=%d bytes=%d", resp.StatusCode, len(respBody))
	}

	// Parse response
	var chatResp ChatResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return "", &ProviderError{Kind: ErrorInvalidResponse, Message: "provider returned malformed JSON", Err: err}
	}

	if chatResp.Error != nil {
		return "", &ProviderError{Kind: ErrorModel, Message: "provider returned a model error"}
	}

	if len(chatResp.Choices) == 0 {
		return "", &ProviderError{Kind: ErrorInvalidResponse, Message: "provider returned no completion choices"}
	}

	return chatResp.Choices[0].Message.Content, nil
}
