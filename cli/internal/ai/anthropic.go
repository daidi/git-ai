package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
)

type AnthropicClient struct {
	baseURL string
	apiKey  string
	model   string
	client  *http.Client
	logger  *log.Logger
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

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	c.logger.Printf("[DEBUG] >>> HTTP POST %s", url)
	c.logger.Printf("[DEBUG] >>> Request Body:\n%s", string(bodyBytes))

	resp, err := c.client.Do(req)
	if err != nil {
		c.logger.Printf("[DEBUG] <<< HTTP Error: %v", err)
		return "", fmt.Errorf("request timeout: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}

	c.logger.Printf("[DEBUG] <<< HTTP %d %s", resp.StatusCode, resp.Status)
	c.logger.Printf("[DEBUG] <<< Response Body:\n%s", string(respBody))

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("anthropic API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var chatResp anthropicResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return "", fmt.Errorf("parse anthropic response: %w", err)
	}

	if chatResp.Error != nil {
		return "", fmt.Errorf("%s", chatResp.Error.Message)
	}

	if len(chatResp.Content) == 0 {
		return "", fmt.Errorf("no content in anthropic response")
	}

	return chatResp.Content[0].Text, nil
}
