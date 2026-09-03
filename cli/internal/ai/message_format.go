package ai

import (
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

var conventionalSubjectPattern = regexp.MustCompile(
	`^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^()\r\n]+\))?!?: (.+)$`,
)

// MatchesMessageFormat reports whether a commit message follows the selected
// built-in output structure closely enough to keep it without an LLM call.
// Semantic requirements such as imperative mood cannot be verified reliably
// across all supported languages, so this deliberately checks only objective
// structure and length rules.
func MatchesMessageFormat(message string, format Format, explain bool) bool {
	lines := messageLines(message)
	if len(lines) == 0 || lines[0] == "" {
		return false
	}

	switch format {
	case FormatPlain:
		return validPlainMessage(lines, explain)
	case FormatConventional:
		return validConventionalMessage(lines, explain)
	case FormatGitmoji:
		return validGitmojiMessage(lines, explain)
	case FormatSubjectBody:
		return validSubjectBodyMessage(lines)
	default:
		return false
	}
}

// ValidatePolishedMessage verifies the final message before a replacement
// commit can be created. Built-in prompts have an objective output contract;
// custom prompts retain their intentionally user-defined structure. In both
// cases, the original trailer block must remain unchanged.
func ValidatePolishedMessage(message, original string, format Format, explain, enforceFormat bool) error {
	if strings.TrimSpace(message) == "" {
		return &ProviderError{Kind: ErrorInvalidResponse, Message: "provider returned an empty completion"}
	}
	if len(message) > maxGeneratedMessageBytes {
		return &ProviderError{Kind: ErrorInvalidResponse, Message: "provider returned an oversized completion"}
	}
	if strings.ContainsRune(message, '\x00') {
		return &ProviderError{Kind: ErrorInvalidResponse, Message: "provider returned an invalid completion"}
	}

	content, trailers := splitCommitTrailers(message)
	_, originalTrailers := splitCommitTrailers(original)
	if trailers != originalTrailers {
		return &ProviderError{Kind: ErrorInvalidResponse, Message: "generated commit trailers did not match the original message"}
	}
	if enforceFormat && !MatchesMessageFormat(content, format, explain) {
		return &ProviderError{Kind: ErrorInvalidResponse, Message: "provider completion did not match the configured commit message format"}
	}
	return nil
}

func messageLines(message string) []string {
	normalized := strings.TrimSpace(strings.ReplaceAll(message, "\r\n", "\n"))
	if normalized == "" {
		return nil
	}
	return strings.Split(normalized, "\n")
}

func validPlainMessage(lines []string, explain bool) bool {
	subject := lines[0]
	if utf8.RuneCountInString(subject) > 72 || conventionalSubjectPattern.MatchString(subject) {
		return false
	}
	if prefix, _, found := strings.Cut(subject, " "); found && isEmojiToken(prefix) {
		return false
	}
	if !explain {
		return len(lines) == 1
	}
	return validOptionalBody(lines, true)
}

func validConventionalMessage(lines []string, explain bool) bool {
	if !validConventionalSubject(lines[0]) {
		return false
	}
	return validOptionalBody(lines, explain)
}

func validConventionalSubject(subject string) bool {
	if utf8.RuneCountInString(subject) > 72 {
		return false
	}
	matches := conventionalSubjectPattern.FindStringSubmatch(subject)
	if len(matches) == 0 {
		return false
	}
	description := strings.TrimSpace(matches[len(matches)-1])
	return description != "" && !strings.HasSuffix(description, ".")
}

func validGitmojiMessage(lines []string, explain bool) bool {
	prefix, subject, found := strings.Cut(lines[0], " ")
	if !found || !isEmojiToken(prefix) || !validConventionalSubject(subject) {
		return false
	}
	// The 72-character limit excludes the emoji prefix for this format.
	return validOptionalBody(lines, explain)
}

func isEmojiToken(token string) bool {
	if token == "" {
		return false
	}
	hasSymbol := false
	for _, r := range token {
		switch {
		case unicode.Is(unicode.So, r):
			hasSymbol = true
		case r == '\u200d' || r == '\ufe0f' || unicode.Is(unicode.Sk, r):
			// Allow zero-width joiners, variation selectors, and skin tones as
			// parts of one emoji token.
		default:
			return false
		}
	}
	return hasSymbol
}

func validOptionalBody(lines []string, requireBody bool) bool {
	if len(lines) == 1 {
		return !requireBody
	}
	return lines[1] == "" && hasNonEmptyLine(lines[2:])
}

func validSubjectBodyMessage(lines []string) bool {
	if utf8.RuneCountInString(lines[0]) > 50 || len(lines) < 3 || lines[1] != "" || !hasNonEmptyLine(lines[2:]) {
		return false
	}
	for _, line := range lines[2:] {
		if utf8.RuneCountInString(line) > 72 {
			return false
		}
	}
	return true
}

func hasNonEmptyLine(lines []string) bool {
	for _, line := range lines {
		if strings.TrimSpace(line) != "" {
			return true
		}
	}
	return false
}
