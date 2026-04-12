package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"time"

	"github.com/daidi/git-ai/internal/config"
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
}

// NewClient creates a new HTTP client for the specified provider
func NewClient(cfg *config.Config, logger *log.Logger) Client {
	if logger == nil {
		logger = log.Default()
	}

	// Create HTTP client with proper timeouts
	client := &http.Client{
		Timeout: 60 * time.Second,
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

	switch cfg.Provider {
	case "anthropic":
		url := cfg.BaseURL
		if url == "" {
			url = "https://api.anthropic.com/v1"
		}
		return &AnthropicClient{
			baseURL: url,
			apiKey:  cfg.APIKey,
			model:   cfg.Model,
			client:  client,
			logger:  logger,
		}
	case "gemini":
		url := cfg.BaseURL
		if url == "" {
			url = "https://generativelanguage.googleapis.com/v1beta"
		}
		return &GeminiClient{
			baseURL: url,
			apiKey:  cfg.APIKey,
			model:   cfg.Model,
			client:  client,
			logger:  logger,
		}
	default:
		return &OpenAIClient{
			baseURL: cfg.BaseURL,
			apiKey:  cfg.APIKey,
			model:   cfg.Model,
			client:  client,
			logger:  logger,
		}
	}
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
	url := c.baseURL + "/chat/completions"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	// Log request in debug mode
	c.logger.Printf("[DEBUG] >>> HTTP POST %s", url)
	c.logger.Printf("[DEBUG] >>> Request Body:\n%s", string(bodyBytes))

	// Send request
	resp, err := c.client.Do(req)
	if err != nil {
		c.logger.Printf("[DEBUG] <<< HTTP Error: %v", err)
		return "", fmt.Errorf("request timeout: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}

	c.logger.Printf("[DEBUG] <<< HTTP %d %s", resp.StatusCode, resp.Status)
	c.logger.Printf("[DEBUG] <<< Response Body:\n%s", string(respBody))

	// Check HTTP status
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API returned unexpected status code: %d: %s", resp.StatusCode, string(respBody))
	}

	// Parse response
	var chatResp ChatResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return "", fmt.Errorf("parse response: %w", err)
	}

	if chatResp.Error != nil {
		return "", fmt.Errorf("%s", chatResp.Error.Message)
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}

	return chatResp.Choices[0].Message.Content, nil
}
