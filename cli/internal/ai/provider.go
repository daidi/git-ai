// Package ai provides LLM-powered commit message polishing.
package ai

import (
	"context"
	"fmt"

	"github.com/tmc/langchaingo/llms"
	"github.com/tmc/langchaingo/llms/ollama"
	"github.com/tmc/langchaingo/llms/openai"

	"github.com/daidi/git-ai/internal/config"
)

// NewLLM creates a langchaingo LLM instance based on the provider config.
// The "openai" provider works with any OpenAI-compatible API (DeepSeek, OpenRouter, etc.).
func NewLLM(cfg *config.Config) (llms.Model, error) {
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
