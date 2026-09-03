package ai

import (
	"errors"
	"testing"
)

func TestSplitCommitTrailers(t *testing.T) {
	message := "draft subject\n\nExplain the change.\n\nSigned-off-by: Alice <alice@example.com>\nCo-authored-by: Bob <bob@example.com>\n continuation"
	content, trailers := splitCommitTrailers(message)
	if content != "draft subject\n\nExplain the change." {
		t.Fatalf("content = %q", content)
	}
	wantTrailers := "Signed-off-by: Alice <alice@example.com>\nCo-authored-by: Bob <bob@example.com>\n continuation"
	if trailers != wantTrailers {
		t.Fatalf("trailers = %q, want %q", trailers, wantTrailers)
	}

	content, trailers = splitCommitTrailers("subject\n\n indented body\nSigned-off-by: Alice <alice@example.com>")
	if content != "subject\n\n indented body" || trailers != "Signed-off-by: Alice <alice@example.com>" {
		t.Fatalf("indented body split = (%q, %q)", content, trailers)
	}
}

func TestSplitCommitTrailersHandlesConventionalFooterAndNotSubject(t *testing.T) {
	message := "feat(api)!: remove legacy endpoint\n\nBREAKING CHANGE: clients must use v2"
	content, trailers := splitCommitTrailers(message)
	if content != "feat(api)!: remove legacy endpoint" || trailers != "BREAKING CHANGE: clients must use v2" {
		t.Fatalf("split = (%q, %q)", content, trailers)
	}

	content, trailers = splitCommitTrailers("fix(cache): avoid duplicate requests")
	if content != "fix(cache): avoid duplicate requests" || trailers != "" {
		t.Fatalf("one-line subject was treated as a trailer: (%q, %q)", content, trailers)
	}
}

func TestRestoreCommitTrailersMakesOriginalFooterAuthoritative(t *testing.T) {
	original := "wip\n\nSigned-off-by: Alice <alice@example.com>\nFixes: #42"
	generated := "fix(cache): avoid duplicate requests\n\nCo-authored-by: Mallory <mallory@example.com>"
	want := "fix(cache): avoid duplicate requests\n\nSigned-off-by: Alice <alice@example.com>\nFixes: #42"
	if got := restoreCommitTrailers(generated, original); got != want {
		t.Fatalf("restoreCommitTrailers() = %q, want %q", got, want)
	}
}

func TestValidatePolishedMessageChecksFormatAndOriginalTrailers(t *testing.T) {
	original := "wip\n\nSigned-off-by: Alice <alice@example.com>"
	valid := "fix(cache): avoid duplicate requests\n\nSigned-off-by: Alice <alice@example.com>"
	if err := ValidatePolishedMessage(valid, original, FormatConventional, false, true); err != nil {
		t.Fatalf("valid message rejected: %v", err)
	}

	tests := []string{
		"not conventional\n\nSigned-off-by: Alice <alice@example.com>",
		"fix(cache): avoid duplicate requests",
		"fix(cache): avoid duplicate requests\n\nSigned-off-by: Mallory <mallory@example.com>",
	}
	for _, message := range tests {
		err := ValidatePolishedMessage(message, original, FormatConventional, false, true)
		var providerErr *ProviderError
		if !errors.As(err, &providerErr) || providerErr.Kind != ErrorInvalidResponse {
			t.Fatalf("message %q error = %#v", message, err)
		}
	}

	custom := "TEAM-123 | release cache safely\n\nSigned-off-by: Alice <alice@example.com>"
	if err := ValidatePolishedMessage(custom, original, FormatConventional, false, false); err != nil {
		t.Fatalf("custom-format message rejected: %v", err)
	}
}
