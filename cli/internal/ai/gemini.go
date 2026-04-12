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

type GeminiClient struct {
	baseURL string
	apiKey  string
	model   string
	client  *http.Client
	logger  *log.Logger
}

type geminiRequest struct {
	SystemInstruction *geminiContent      `json:"systemInstruction,omitempty"`
	Contents          []geminiContent     `json:"contents"`
	GenerationConfig  geminiGenerationCfg `json:"generationConfig"`
}

type geminiGenerationCfg struct {
	Temperature float64 `json:"temperature"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiResponse struct {
	Candidates []struct {
		Content geminiContent `json:"content"`
	} `json:"candidates"`
	Error *geminiError `json:"error,omitempty"`
}

type geminiError struct {
	Message string `json:"message"`
	Code    int    `json:"code"`
	Status  string `json:"status"`
}

func (c *GeminiClient) GenerateCompletion(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	reqBody := geminiRequest{
		Contents: []geminiContent{
			{
				Role: "user",
				Parts: []geminiPart{
					{Text: userPrompt},
				},
			},
		},
		GenerationConfig: geminiGenerationCfg{
			Temperature: 0,
		},
	}

	if systemPrompt != "" {
		reqBody.SystemInstruction = &geminiContent{
			Parts: []geminiPart{
				{Text: systemPrompt},
			},
		}
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal gemini request: %w", err)
	}

	// For Gemini, model name belongs in the URL: /models/{model}:generateContent
	model := c.model
	if model == "" {
		model = "gemini-1.5-flash"
	}

	url := fmt.Sprintf("%s/models/%s:generateContent", c.baseURL, model)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("create gemini request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", c.apiKey)

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
		return "", fmt.Errorf("Gemini API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var chatResp geminiResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return "", fmt.Errorf("parse gemini response: %w", err)
	}

	if chatResp.Error != nil {
		return "", fmt.Errorf("%s (code %d/%s)", chatResp.Error.Message, chatResp.Error.Code, chatResp.Error.Status)
	}

	if len(chatResp.Candidates) == 0 {
		return "", fmt.Errorf("no candidates in gemini response")
	}

	if len(chatResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("no parts in gemini candidate content")
	}

	return chatResp.Candidates[0].Content.Parts[0].Text, nil
}
