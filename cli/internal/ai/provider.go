// Package ai provides LLM-powered commit message polishing.
package ai

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"time"

	"github.com/tmc/langchaingo/llms"
	"github.com/tmc/langchaingo/llms/ollama"
	"github.com/tmc/langchaingo/llms/openai"

	"github.com/daidi/git-ai/internal/config"
)

// debugDoer wraps an HTTP Doer to log request and response bodies.
type debugDoer struct {
	inner  openaiDoer
	logger *log.Logger
}

// openaiDoer matches the langchaingo openai internal Doer interface.
type openaiDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

func (d *debugDoer) Do(req *http.Request) (*http.Response, error) {
	// Log request
	if req.Body != nil {
		bodyBytes, err := io.ReadAll(req.Body)
		if err == nil {
			d.logger.Printf("[DEBUG] >>> HTTP %s %s", req.Method, req.URL.String())
			d.logger.Printf("[DEBUG] >>> Request Body:\n%s", string(bodyBytes))
			req.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		}
	}

	resp, err := d.inner.Do(req)
	if err != nil {
		d.logger.Printf("[DEBUG] <<< HTTP Error: %v", err)
		return resp, err
	}

	// Log response body (read + re-buffer so the caller still gets it)
	if resp.Body != nil {
		respBytes, readErr := io.ReadAll(resp.Body)
		if readErr == nil {
			d.logger.Printf("[DEBUG] <<< HTTP %d %s", resp.StatusCode, resp.Status)
			d.logger.Printf("[DEBUG] <<< Response Body:\n%s", string(respBytes))
			resp.Body = io.NopCloser(bytes.NewBuffer(respBytes))
		}
	}

	return resp, nil
}

// NewLLM creates a langchaingo LLM instance based on the provider config.
// The "openai" provider works with any OpenAI-compatible API (DeepSeek, OpenRouter, etc.).
func NewLLM(cfg *config.Config) (llms.Model, error) {
	return NewLLMWithLogger(cfg, nil)
}

// NewLLMWithLogger creates a langchaingo LLM instance. When debug is enabled
// and a logger is provided, all HTTP request/response bodies are logged.
func NewLLMWithLogger(cfg *config.Config, logger *log.Logger) (llms.Model, error) {
	switch cfg.Provider {
	case "ollama":
		opts := []ollama.Option{
			ollama.WithModel(cfg.Model),
		}
		if cfg.BaseURL != "" {
			opts = append(opts, ollama.WithServerURL(cfg.BaseURL))
		}
		return ollama.New(opts...)

	case "openai":
		opts := []openai.Option{
			openai.WithModel(cfg.Model),
		}
		if cfg.APIKey != "" {
			opts = append(opts, openai.WithToken(cfg.APIKey))
		}
		if cfg.BaseURL != "" {
			opts = append(opts, openai.WithBaseURL(cfg.BaseURL))
		}
		// Inject debug HTTP client when debug mode is enabled.
		// Use a custom client with reasonable timeouts to avoid hanging.
		httpClient := &http.Client{
			Timeout: 60 * time.Second, // Overall request timeout
			Transport: &http.Transport{
				DialContext: (&net.Dialer{
					Timeout:   10 * time.Second, // Connection timeout
					KeepAlive: 30 * time.Second,
				}).DialContext,
				TLSHandshakeTimeout:   10 * time.Second,
				ResponseHeaderTimeout: 30 * time.Second,
				IdleConnTimeout:       90 * time.Second,
			},
		}
		if cfg.IsDebug() && logger != nil {
			opts = append(opts, openai.WithHTTPClient(&debugDoer{
				inner:  httpClient,
				logger: logger,
			}))
		} else {
			// Also use the same client in non-debug mode for consistency
			opts = append(opts, openai.WithHTTPClient(httpClient))
		}
		return openai.New(opts...)

	default:
		return nil, fmt.Errorf("unsupported provider: %s (supported: openai, ollama)", cfg.Provider)
	}
}

// GenerateMessage calls the LLM to generate a polished commit message.
func GenerateMessage(ctx context.Context, llm llms.Model, systemPrompt, userPrompt string) (string, error) {
	content := []llms.MessageContent{
		{
			Role: llms.ChatMessageTypeSystem,
			Parts: []llms.ContentPart{
				llms.TextContent{Text: systemPrompt},
			},
		},
		{
			Role: llms.ChatMessageTypeHuman,
			Parts: []llms.ContentPart{
				llms.TextContent{Text: userPrompt},
			},
		},
	}

	resp, err := llm.GenerateContent(ctx, content)
	if err != nil {
		return "", fmt.Errorf("LLM generation failed: %w", err)
	}

	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("LLM returned empty response")
	}

	return resp.Choices[0].Content, nil
}
