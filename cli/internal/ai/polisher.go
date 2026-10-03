package ai

import (
	"context"
	"errors"
	"fmt"
	"log"
	"path"
	"sort"
	"strconv"
	"strings"
	"text/template"
	"time"
	"unicode/utf8"

	"github.com/daidi/git-ai/cli/internal/config"
)

// Polish generates an AI-polished commit message for the given diff and original message.
func Polish(diff, originalMsg, repoRoot string, cfg *config.Config) (string, error) {
	return PolishWithLoggerContext(context.Background(), diff, originalMsg, repoRoot, cfg, log.Default())
}

// PolishWithLogger is like Polish but accepts a custom logger for daemon-mode output.
func PolishWithLogger(diff, originalMsg, repoRoot string, cfg *config.Config, logger *log.Logger) (string, error) {
	return PolishWithLoggerContext(context.Background(), diff, originalMsg, repoRoot, cfg, logger)
}

// PolishWithLoggerContext performs polishing with cancellation-aware retries.
func PolishWithLoggerContext(ctx context.Context, diff, originalMsg, repoRoot string, cfg *config.Config, logger *log.Logger) (string, error) {
	if cfg.Provider != "ollama" && cfg.APIKey == "" {
		return "", &ProviderError{Kind: ErrorAuthentication, Message: "provider API key is not configured"}
	}
	// Use direct HTTP client instead of langchaingo for better control
	client := NewClient(cfg, logger)

	// Trim the diff to stay within token budget.
	trimmedDiff := TrimDiff(diff, cfg.MaxDiffTokens)

	// Extract local commitlint rules if they exist.
	commitlintConfig := GetCommitlintConfig(repoRoot)
	if commitlintConfig != "" {
		logger.Printf("found local commitlint rules (length: %d chars)", len(commitlintConfig))
	}

	// Build prompts.
	format := Format(cfg.MessageFormat)
	var sysProm, userProm string
	promptOriginal, _ := splitCommitTrailers(originalMsg)
	usesCustomPrompt := false

	if strings.TrimSpace(cfg.PromptTemplate) != "" {
		tmpl, err := template.New("prompt").Parse(cfg.PromptTemplate)
		if err != nil {
			logger.Printf("failed to parse prompt_template: %v, falling back to default", err)
		} else {
			ctx := struct {
				Hint     string
				Diff     string
				Language string
			}{
				Hint:     promptOriginal,
				Diff:     trimmedDiff,
				Language: cfg.Language,
			}

			var buf strings.Builder
			if err := tmpl.Execute(&buf, ctx); err != nil {
				logger.Printf("failed to execute prompt_template: %v, falling back to default", err)
			} else {
				rendered := buf.String()
				usesCustomPrompt = true
				if strings.Contains(cfg.PromptTemplate, "{{.Diff}}") {
					sysProm = "You are a Git commit message expert."
					userProm = rendered
				} else {
					sysProm = rendered
					userProm = UserPrompt(promptOriginal, trimmedDiff)
				}
				goto PromptsReady
			}
		}
	}

	sysProm = SystemPrompt(format, cfg.Language, cfg.ExplainEnabled(), commitlintConfig)
	userProm = UserPrompt(promptOriginal, trimmedDiff)

PromptsReady:

	logger.Printf("prompt: system=%d chars, user=%d chars (diff≈%d tokens)",
		len(sysProm), len(userProm), len(trimmedDiff)/4)

	// Retry transient failures with bounded, cancellation-aware backoff.
	const maxAttempts = 3
	var result string
	delays := []time.Duration{1 * time.Second, 2 * time.Second}
	var lastErr error
	requestUserProm := userProm

	for attempt := 0; attempt < maxAttempts; attempt++ {
		if attempt > 0 {
			delay := delays[attempt-1]
			if isInvalidResponse(lastErr) {
				delay = 0
			}
			if providerDelay := retryAfter(lastErr); providerDelay > delay {
				delay = providerDelay
			}
			if delay > 30*time.Second {
				delay = 30 * time.Second
			}
			logger.Printf("retry %d/%d after %v", attempt+1, maxAttempts, delay)
			timer := time.NewTimer(delay)
			select {
			case <-ctx.Done():
				timer.Stop()
				return "", ctx.Err()
			case <-timer.C:
			}
		}

		requestCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		result, lastErr = client.GenerateCompletion(requestCtx, sysProm, requestUserProm)
		cancel()

		if lastErr == nil {
			result = cleanResponse(result)
			result = finalizeCommitMessage(result, originalMsg, cfg.CommitAttribution)
			lastErr = ValidatePolishedMessageWithAttribution(result, originalMsg, format, cfg.ExplainEnabled(), !usesCustomPrompt, cfg.CommitAttribution)
			if lastErr == nil {
				break
			}
			requestUserProm = userProm + "\n\nThe previous response was rejected because it did not match the required commit-message contract. Return only a valid commit message in the requested format."
		}

		failure := DescribeError(lastErr)
		logger.Printf("attempt %d failed: category=%s retryable=%t", attempt+1, failure.Category, failure.Retryable)

		if !IsRetryable(lastErr) {
			return "", fmt.Errorf("AI polishing failed: %w", lastErr)
		}
	}

	if lastErr != nil {
		return "", fmt.Errorf("AI polishing failed after %d attempts: %w", maxAttempts, lastErr)
	}

	if cfg.IsDebug() {
		logger.Printf("[DEBUG] model response accepted: characters=%d", len(result))
	}

	return result, nil
}

func isInvalidResponse(err error) bool {
	var providerErr *ProviderError
	return errors.As(err, &providerErr) && providerErr.Kind == ErrorInvalidResponse
}

type rankedDiffFile struct {
	path    string
	content string
	order   int
	weight  int
}

const (
	minFileExcerptBytes = 512
	minHunkExcerptBytes = 192
)

// TrimDiff keeps a complete diff when possible. Oversized diffs become a
// bounded file inventory plus excerpts whose budgets favor source, tests, and
// configuration over docs, generated files, lockfiles, and binary assets.
func TrimDiff(rawDiff string, maxTokens int) string {
	if maxTokens <= 0 {
		maxTokens = 8000
	}
	maxInt := int(^uint(0) >> 1)
	if maxTokens > maxInt/4 {
		maxTokens = maxInt / 4
	}
	budget := maxTokens * 4

	if len(rawDiff) <= budget {
		return rawDiff
	}

	files := parseDiffFiles(rawDiff)
	if len(files) == 0 {
		return truncateToByteBudget(rawDiff, budget)
	}
	sort.SliceStable(files, func(left, right int) bool {
		if files[left].weight == files[right].weight {
			return files[left].order < files[right].order
		}
		return files[left].weight > files[right].weight
	})

	inventoryBudget := budget / 5
	if inventoryBudget < 256 {
		inventoryBudget = min(256, budget)
	}
	if inventoryBudget > 4096 {
		inventoryBudget = 4096
	}

	var result strings.Builder
	result.WriteString(buildDiffInventory(files, inventoryBudget))
	heading := "\nSelected diff excerpts:\n"
	if result.Len()+len(heading) >= budget {
		return truncateToByteBudget(result.String(), budget)
	}
	result.WriteString(heading)

	remainingWeight := 0
	for _, file := range files {
		remainingWeight += file.weight
	}
	excerptCount := 0
	for _, file := range files {
		available := budget - result.Len()
		if available <= 1 || remainingWeight <= 0 {
			break
		}
		separator := ""
		if result.Len() > 0 {
			separator = "\n"
		}
		available -= len(separator)
		if available <= 0 {
			break
		}
		share := available * file.weight / remainingWeight
		remainingWeight -= file.weight
		if remainingWeight == 0 {
			share = available
		}
		if share < minFileExcerptBytes && available >= minFileExcerptBytes {
			// A ranked source excerpt is more useful than tiny fragments from
			// every changed file. Short files consume only their actual size,
			// leaving room for the next ranked file.
			share = minFileExcerptBytes
		}
		if excerptCount > 0 && available < minHunkExcerptBytes {
			break
		}
		if share <= 0 {
			continue
		}
		excerpt := compactFileDiff(file, share)
		if excerpt == "" {
			continue
		}
		result.WriteString(separator)
		result.WriteString(excerpt)
		excerptCount++
	}

	return truncateToByteBudget(result.String(), budget)
}

func parseDiffFiles(rawDiff string) []rankedDiffFile {
	var files []rankedDiffFile
	var current strings.Builder
	flush := func() {
		if current.Len() == 0 {
			return
		}
		content := current.String()
		filePath := extractDiffPath(content)
		files = append(files, rankedDiffFile{
			path:    filePath,
			content: content,
			order:   len(files),
			weight:  diffFileWeight(filePath, content),
		})
		current.Reset()
	}

	for _, line := range strings.Split(strings.ReplaceAll(rawDiff, "\r\n", "\n"), "\n") {
		if strings.HasPrefix(line, "diff --git ") {
			flush()
		}
		if current.Len() > 0 || strings.HasPrefix(line, "diff --git ") {
			current.WriteString(line)
			current.WriteByte('\n')
		}
	}
	flush()
	return files
}

func extractDiffPath(content string) string {
	lines := strings.Split(content, "\n")
	for _, prefix := range []string{"rename to ", "copy to ", "+++ ", "--- "} {
		for _, line := range lines {
			if strings.HasPrefix(line, "@@") {
				break
			}
			if !strings.HasPrefix(line, prefix) {
				continue
			}
			candidate := decodeDiffPath(strings.TrimPrefix(line, prefix))
			if candidate != "" && candidate != "/dev/null" {
				return candidate
			}
		}
	}
	if len(lines) > 0 && strings.HasPrefix(lines[0], "diff --git ") {
		header := strings.TrimPrefix(lines[0], "diff --git ")
		if index := strings.LastIndex(header, `"b/`); index >= 0 {
			if candidate := decodeDiffPath(header[index:]); candidate != "" {
				return candidate
			}
		}
		if index := strings.LastIndex(header, " b/"); index >= 0 {
			return strings.TrimSpace(strings.TrimPrefix(header[index+1:], "b/"))
		}
		fields := strings.Fields(header)
		if len(fields) > 0 {
			return decodeDiffPath(fields[len(fields)-1])
		}
	}
	return "unknown"
}

func decodeDiffPath(value string) string {
	value = strings.TrimSpace(value)
	if index := strings.IndexByte(value, '\t'); index >= 0 {
		value = value[:index]
	}
	if strings.HasPrefix(value, `"`) {
		if decoded, err := strconv.Unquote(value); err == nil {
			value = decoded
		}
	}
	value = strings.TrimSpace(value)
	value = strings.TrimPrefix(value, "a/")
	value = strings.TrimPrefix(value, "b/")
	return strings.Map(func(char rune) rune {
		if char < ' ' || char == 0x7f {
			return '\ufffd'
		}
		return char
	}, value)
}

func diffFileWeight(filePath, content string) int {
	normalized := strings.ToLower(strings.ReplaceAll(filePath, `\`, "/"))
	base := path.Base(normalized)
	extension := path.Ext(base)

	if strings.Contains(content, "GIT binary patch") || strings.Contains(content, "Binary files ") ||
		isLowValueDiffPath(normalized, base) {
		return 1
	}
	if isTestDiffPath(normalized, base) {
		return 5
	}
	if strings.Contains(normalized, "/docs/") || strings.HasPrefix(normalized, "docs/") ||
		extension == ".md" || extension == ".mdx" || extension == ".rst" || extension == ".txt" {
		return 2
	}
	if isSourceExtension(extension) || strings.Contains(normalized, "/migrations/") {
		return 5
	}
	if isConfigurationDiffPath(normalized, base, extension) {
		return 4
	}
	return 3
}

func isLowValueDiffPath(filePath, base string) bool {
	for _, lockfile := range []string{
		"package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb",
		"cargo.lock", "composer.lock", "gemfile.lock", "poetry.lock", "go.sum",
	} {
		if base == lockfile {
			return true
		}
	}
	for _, segment := range []string{"/vendor/", "/node_modules/", "/dist/", "/build/", "/coverage/", "/generated/", "/__snapshots__/"} {
		if strings.Contains("/"+filePath, segment) {
			return true
		}
	}
	for _, suffix := range []string{
		".min.js", ".min.css", ".map", ".snap", ".gen.go", "_generated.go",
		".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".woff", ".woff2",
	} {
		if strings.HasSuffix(base, suffix) {
			return true
		}
	}
	return strings.Contains(base, ".generated.")
}

func isTestDiffPath(filePath, base string) bool {
	for _, segment := range []string{"/test/", "/tests/", "/__tests__/", "/spec/", "/specs/"} {
		if strings.Contains("/"+filePath, segment) {
			return true
		}
	}
	for _, suffix := range []string{"_test.go", "_test.py", ".test.js", ".test.ts", ".test.jsx", ".test.tsx", ".spec.js", ".spec.ts", ".spec.jsx", ".spec.tsx"} {
		if strings.HasSuffix(base, suffix) {
			return true
		}
	}
	return false
}

func isSourceExtension(extension string) bool {
	switch extension {
	case ".c", ".cc", ".cpp", ".cs", ".css", ".dart", ".ex", ".exs", ".go", ".h", ".hpp",
		".html", ".java", ".js", ".jsx", ".kt", ".kts", ".lua", ".php", ".py", ".rb",
		".rs", ".scala", ".scss", ".sh", ".sql", ".swift", ".ts", ".tsx", ".vue", ".zig":
		return true
	default:
		return false
	}
}

func isConfigurationDiffPath(filePath, base, extension string) bool {
	if strings.HasPrefix(filePath, ".github/workflows/") {
		return true
	}
	switch base {
	case "dockerfile", "makefile", "justfile", "go.mod", "package.json", "pyproject.toml", "build.gradle", "settings.gradle":
		return true
	}
	switch extension {
	case ".json", ".toml", ".yaml", ".yml":
		return true
	default:
		return false
	}
}

func buildDiffInventory(files []rankedDiffFile, budget int) string {
	if budget <= 0 {
		return ""
	}
	var result strings.Builder
	result.WriteString("Changed files (ranked by relevance):\n")
	if result.Len() >= budget {
		return truncateToByteBudget(result.String(), budget)
	}
	for index, file := range files {
		line := "- " + file.path + "\n"
		if result.Len()+len(line) > budget {
			remainder := fmt.Sprintf("- ... %d more files\n", len(files)-index)
			if result.Len()+len(remainder) <= budget {
				result.WriteString(remainder)
			}
			break
		}
		result.WriteString(line)
	}
	return strings.TrimRight(result.String(), "\n")
}

func compactFileDiff(file rankedDiffFile, budget int) string {
	content := file.content
	content = strings.TrimRight(content, "\n")
	if budget <= 0 {
		return ""
	}
	if len(content) <= budget {
		return content
	}

	metadata, hunks := splitDiffHunks(content)
	metadataText := strings.Join(metadata, "\n")
	if len(hunks) == 0 {
		return truncateToByteBudget(metadataText, budget)
	}
	if len(metadataText)+minHunkExcerptBytes > budget {
		// The inventory already contains the full path. Avoid spending a tiny
		// excerpt's entire budget on four long, repetitive patch header lines.
		metadataText = "File: " + file.path
	}

	var result strings.Builder
	if metadataText != "" {
		result.WriteString(truncateToByteBudget(metadataText, budget))
	}
	if result.Len() >= budget {
		return truncateToByteBudget(result.String(), budget)
	}

	remainingWeight := 0
	for _, hunk := range hunks {
		remainingWeight += diffHunkWeight(hunk)
	}
	excerptCount := 0
	for _, hunk := range hunks {
		separator := "\n"
		available := budget - result.Len() - len(separator)
		if available <= 0 || remainingWeight <= 0 {
			break
		}
		weight := diffHunkWeight(hunk)
		share := available * weight / remainingWeight
		remainingWeight -= weight
		if remainingWeight == 0 {
			share = available
		}
		if share < minHunkExcerptBytes && available >= minHunkExcerptBytes {
			share = minHunkExcerptBytes
		}
		if excerptCount > 0 && available < minHunkExcerptBytes/2 {
			break
		}
		if share <= 0 {
			continue
		}
		excerpt := compactDiffHunk(hunk, share)
		if excerpt == "" {
			continue
		}
		result.WriteString(separator)
		result.WriteString(excerpt)
		excerptCount++
	}
	return truncateToByteBudget(result.String(), budget)
}

func splitDiffHunks(content string) (metadata []string, hunks [][]string) {
	var current []string
	for _, line := range strings.Split(content, "\n") {
		if strings.HasPrefix(line, "@@") {
			if len(current) > 0 {
				hunks = append(hunks, current)
			}
			current = []string{line}
			continue
		}
		if current != nil {
			current = append(current, line)
		} else if isUsefulDiffMetadata(line) {
			metadata = append(metadata, line)
		}
	}
	if len(current) > 0 {
		hunks = append(hunks, current)
	}
	return metadata, hunks
}

func isUsefulDiffMetadata(line string) bool {
	for _, prefix := range []string{
		"diff --git ", "index ", "--- ", "+++ ", "new file mode ", "deleted file mode ",
		"old mode ", "new mode ", "similarity index ", "dissimilarity index ", "rename from ",
		"rename to ", "copy from ", "copy to ", "Binary files ", "Submodule ", "GIT binary patch",
	} {
		if strings.HasPrefix(line, prefix) {
			return true
		}
	}
	return false
}

func diffHunkWeight(hunk []string) int {
	weight := 1
	for _, line := range hunk[1:] {
		if isChangedDiffLine(line) && weight < 9 {
			weight++
		}
	}
	return weight
}

func compactDiffHunk(hunk []string, budget int) string {
	full := strings.Join(hunk, "\n")
	if len(full) <= budget {
		return full
	}
	essential := make([]string, 0, len(hunk))
	if len(hunk) > 0 {
		essential = append(essential, hunk[0])
	}
	for _, line := range hunk[1:] {
		if strings.HasPrefix(line, "+") {
			essential = append(essential, line)
		}
	}
	for _, line := range hunk[1:] {
		if strings.HasPrefix(line, "-") {
			essential = append(essential, line)
		}
	}
	return truncateToByteBudget(strings.Join(essential, "\n"), budget)
}

func isChangedDiffLine(line string) bool {
	return strings.HasPrefix(line, "+") || strings.HasPrefix(line, "-")
}

func truncateToByteBudget(value string, budget int) string {
	if budget <= 0 {
		return ""
	}
	if len(value) <= budget {
		return value
	}
	const marker = "\n... (truncated)"
	if budget <= len(marker) {
		end := budget
		for end > 0 && end < len(value) && !utf8.RuneStart(value[end]) {
			end--
		}
		return value[:end]
	}
	end := budget - len(marker)
	for end > 0 && end < len(value) && !utf8.RuneStart(value[end]) {
		end--
	}
	prefix := strings.TrimRight(value[:end], " \t\r\n")
	return prefix + marker
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
