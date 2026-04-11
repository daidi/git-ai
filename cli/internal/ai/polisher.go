package ai

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/daidi/git-ai/internal/config"
)

// Polish generates an AI-polished commit message for the given diff and original message.
func Polish(diff, originalMsg string, cfg *config.Config) (string, error) {
	llm, err := NewLLM(cfg)
	if err != nil {
		return "", fmt.Errorf("create LLM: %w", err)
	}

	// Trim the diff to stay within token budget.
	trimmedDiff := TrimDiff(diff, cfg.MaxDiffTokens)

	// Build prompts.
	format := Format(cfg.MessageFormat)
	sysProm := SystemPrompt(format, cfg.Language)
	if cfg.PromptTemplate != "" {
		// Custom template overrides the default system prompt.
		sysProm = cfg.PromptTemplate
	}
	userProm := UserPrompt(originalMsg, trimmedDiff)

	// Retry with exponential backoff.
	var result string
	delays := []time.Duration{1 * time.Second, 2 * time.Second, 4 * time.Second}
	var lastErr error

	for attempt := 0; attempt <= len(delays); attempt++ {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		result, lastErr = GenerateMessage(ctx, llm, sysProm, userProm)
		cancel()

		if lastErr == nil {
			break
		}

		if attempt < len(delays) {
			time.Sleep(delays[attempt])
		}
	}

	if lastErr != nil {
		return "", fmt.Errorf("AI polishing failed after %d attempts: %w", len(delays)+1, lastErr)
	}

	// Clean up the response — remove markdown fences, leading/trailing whitespace.
	result = cleanResponse(result)

	return result, nil
}

// TrimDiff implements 3-tier diff trimming to stay within the token budget.
func TrimDiff(rawDiff string, maxTokens int) string {
	if maxTokens <= 0 {
		maxTokens = 4000
	}

	estimatedTokens := len(rawDiff) / 4
	if estimatedTokens <= maxTokens {
		return rawDiff // Tier 1: Full diff.
	}

	// Tier 2: Truncated — keep headers + first N lines per hunk.
	truncated := truncateDiff(rawDiff, 20)
	if len(truncated)/4 <= maxTokens {
		return truncated
	}

	// Tier 3: File-list only.
	return extractFileList(rawDiff)
}

// truncateDiff keeps diff headers and the first maxLines lines per file hunk.
func truncateDiff(rawDiff string, maxLines int) string {
	var result strings.Builder
	lines := strings.Split(rawDiff, "\n")
	linesInHunk := 0
	inHunk := false
	truncated := false

	for _, line := range lines {
		if strings.HasPrefix(line, "diff --git") ||
			strings.HasPrefix(line, "---") ||
			strings.HasPrefix(line, "+++") ||
			strings.HasPrefix(line, "index ") {
			// Always keep diff headers.
			if truncated {
				result.WriteString("  ... (truncated)\n")
				truncated = false
			}
			result.WriteString(line)
			result.WriteString("\n")
			inHunk = false
			linesInHunk = 0
			continue
		}

		if strings.HasPrefix(line, "@@") {
			if truncated {
				result.WriteString("  ... (truncated)\n")
				truncated = false
			}
			result.WriteString(line)
			result.WriteString("\n")
			inHunk = true
			linesInHunk = 0
			continue
		}

		if inHunk {
			linesInHunk++
			if linesInHunk <= maxLines {
				result.WriteString(line)
				result.WriteString("\n")
			} else {
				truncated = true
			}
		}
	}
	if truncated {
		result.WriteString("  ... (truncated)\n")
	}

	return result.String()
}

// extractFileList extracts just the file names and change stats from a diff.
func extractFileList(rawDiff string) string {
	var result strings.Builder
	result.WriteString("Changed files:\n")

	lines := strings.Split(rawDiff, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "diff --git") {
			parts := strings.Fields(line)
			if len(parts) >= 4 {
				file := strings.TrimPrefix(parts[3], "b/")
				result.WriteString("  ")
				result.WriteString(file)
				result.WriteString("\n")
			}
		}
	}

	return result.String()
}

// cleanResponse removes common LLM artifacts from the response.
func cleanResponse(s string) string {
	s = strings.TrimSpace(s)
	// Remove markdown code fences.
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	s = strings.TrimSpace(s)
	// Remove quotes.
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		s = s[1 : len(s)-1]
	}
	return s
}
