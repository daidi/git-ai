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
	debug   bool
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

	if c.debug {
		c.logger.Printf("[DEBUG] model request: provider=gemini model=%q payload_bytes=%d", model, len(bodyBytes))
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return "", classifyTransportError(err)
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}

	if c.debug {
		c.logger.Printf("[DEBUG] model response: status=%d bytes=%d", resp.StatusCode, len(respBody))
	}

	if resp.StatusCode != http.StatusOK {
		return "", classifyHTTPStatus(resp.StatusCode, resp.Header.Get("Retry-After"))
	}

	var chatResp geminiResponse
	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return "", &ProviderError{Kind: ErrorInvalidResponse, Message: "provider returned malformed JSON", Err: err}
	}

	if chatResp.Error != nil {
		return "", &ProviderError{Kind: ErrorModel, Message: "provider returned a model error"}
	}

	if len(chatResp.Candidates) == 0 {
		return "", &ProviderError{Kind: ErrorInvalidResponse, Message: "provider returned no candidates"}
	}

	if len(chatResp.Candidates[0].Content.Parts) == 0 {
		return "", &ProviderError{Kind: ErrorInvalidResponse, Message: "provider returned an empty candidate"}
	}

	return chatResp.Candidates[0].Content.Parts[0].Text, nil
}
