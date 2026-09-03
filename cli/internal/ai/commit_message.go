package ai

import (
	"strings"
	"unicode"
)

const maxGeneratedMessageBytes = 64 << 10

// splitCommitTrailers separates a trailing Git-style trailer block from the
// human-written subject/body. Keeping this logic local avoids handing
// authorship, sign-off, review, or issue metadata to the model to rewrite.
func splitCommitTrailers(message string) (content, trailers string) {
	normalized := strings.TrimSpace(strings.ReplaceAll(message, "\r\n", "\n"))
	if normalized == "" {
		return "", ""
	}

	lines := strings.Split(normalized, "\n")
	start := len(lines)
	foundTrailer := false
	for index := len(lines) - 1; index >= 0; index-- {
		line := lines[index]
		switch {
		case isTrailerLine(line):
			foundTrailer = true
			start = index
		case strings.HasPrefix(line, " ") || strings.HasPrefix(line, "\t"):
			// A continuation is included only if a trailer header is found
			// before it while scanning backward. Moving start at the header
			// naturally includes valid following continuations but excludes an
			// indented body line that happens to precede the trailer block.
		case strings.TrimSpace(line) == "":
			index = -1
		default:
			index = -1
		}
	}

	// A one-line conventional subject such as "fix: handle timeout" is not a
	// trailer block. There must be non-trailer content before the footer.
	if !foundTrailer || start <= 0 || start >= len(lines) {
		return normalized, ""
	}

	contentEnd := start
	for contentEnd > 0 && strings.TrimSpace(lines[contentEnd-1]) == "" {
		contentEnd--
	}
	content = strings.TrimSpace(strings.Join(lines[:contentEnd], "\n"))
	if content == "" {
		return normalized, ""
	}
	return content, strings.TrimSpace(strings.Join(lines[start:], "\n"))
}

func isTrailerLine(line string) bool {
	if line == "" || strings.HasPrefix(line, " ") || strings.HasPrefix(line, "\t") {
		return false
	}
	separator := strings.IndexAny(line, ":=")
	if separator <= 0 {
		return false
	}
	token := line[:separator]
	if token != strings.TrimSpace(token) {
		return false
	}
	hasLetterOrDigit := false
	for _, char := range token {
		switch {
		case unicode.IsLetter(char) || unicode.IsDigit(char):
			hasLetterOrDigit = true
		case char == '-', char == '_', char == '.', char == ' ':
		default:
			return false
		}
	}
	return hasLetterOrDigit
}

// restoreCommitTrailers makes the original trailer block authoritative. Any
// trailer-like footer emitted by the model is discarded, then the exact
// original footer is restored once.
func restoreCommitTrailers(generated, original string) string {
	generatedContent, _ := splitCommitTrailers(generated)
	_, originalTrailers := splitCommitTrailers(original)
	if originalTrailers == "" {
		return strings.TrimSpace(generatedContent)
	}
	return strings.TrimSpace(generatedContent) + "\n\n" + originalTrailers
}

// CommitMessageContent returns the subject/body without its trailing metadata
// block. It is exposed for the maintainer evaluation harness so formatting and
// trailer preservation can be scored independently.
func CommitMessageContent(message string) string {
	content, _ := splitCommitTrailers(message)
	return content
}

// PreservesCommitTrailers reports whether candidate retains exactly the
// trailer block from original, including order and continuation lines.
func PreservesCommitTrailers(candidate, original string) bool {
	_, candidateTrailers := splitCommitTrailers(candidate)
	_, originalTrailers := splitCommitTrailers(original)
	return candidateTrailers == originalTrailers
}

// HasCommitTrailers reports whether a message ends with a Git-style metadata
// block. Evaluation uses this to avoid treating trailer-free cases as positive
// preservation samples.
func HasCommitTrailers(message string) bool {
	_, trailers := splitCommitTrailers(message)
	return trailers != ""
}
