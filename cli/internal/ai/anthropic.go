package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

type AnthropicClient struct {
	baseURL string
	apiKey  string
	model   string
	client  *http.Client
	logger  *log.Logger
	debug   bool
}

type anthropicRequest struct {
	Model       string             `json:"model"`
	MaxTokens   int                `json:"max_tokens"`
	Temperature float64            `json:"temperature"`
	System      string             `json:"system,omitempty"`
	Messages    []anthropicMessage `json:"messages"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicResponse struct {
	Type    string          `json:"type"`
	Error   *anthropicError `json:"error,omitempty"`
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

type anthropicError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

func (c *AnthropicClient) GenerateCompletion(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	reqBody := anthropicRequest{
		Model:       c.model,
		MaxTokens:   2048,
		Temperature: 0,
		System:      systemPrompt,
		Messages: []anthropicMessage{
			{Role: "user", Content: userPrompt},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal anthropic request: %w", err)
	}

	url := c.baseURL + "/messages"
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("create anthropic request: %w", err)
	}
	if err := validateProviderURL(req.URL); err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	if c.debug {
		c.logger.Printf("[DEBUG] model request: provider=anthropic model=%q payload_bytes=%d", c.model, len(bodyBytes))
	}

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

	var chatResp anthropicResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return "", &ProviderError{Kind: ErrorInvalidResponse, Message: "provider returned malformed JSON", Err: err}
	}

	if chatResp.Error != nil {
		return "", &ProviderError{Kind: ErrorModel, Message: "provider returned a model error"}
	}

	if len(chatResp.Content) == 0 {
		return "", &ProviderError{Kind: ErrorInvalidResponse, Message: "provider returned no content"}
	}

	return chatResp.Content[0].Text, nil
}
