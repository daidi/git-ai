package ai

import (
	"errors"
	"strings"
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

func TestFinalizeCommitAttributionPreservesOriginalTrailers(t *testing.T) {
	userTrailers := "Signed-off-by: Alice <alice@example.com>\nCo-authored-by: Bob <bob@example.com>\n continuation\nFixes: #42"
	for _, test := range []struct {
		name, original, mode, want string
	}{
		{"default", "wip", "", "fix: handle timeout"},
		{"off", "wip", "off", "fix: handle timeout"},
		{"compact", "wip", "compact", "fix: handle timeout\n\n" + compactAttributionTrailer},
		{"user trailers", "wip\n\n" + userTrailers, "compact", "fix: handle timeout\n\n" + userTrailers + "\n" + compactAttributionTrailer},
		{"already attributed", "wip\n\n" + compactAttributionTrailer + "\n" + userTrailers, "compact", "fix: handle timeout\n\n" + compactAttributionTrailer + "\n" + userTrailers},
		{"off preserves metadata", "wip\n\n" + compactAttributionTrailer, "off", "fix: handle timeout\n\n" + compactAttributionTrailer},
		{"other tool", "wip\n\nPolished-by: Other", "compact", "fix: handle timeout\n\nPolished-by: Other\n" + compactAttributionTrailer},
		{"CRLF", "wip\r\n\r\nSigned-off-by: Alice\r\n", "compact", "fix: handle timeout\n\nSigned-off-by: Alice\n" + compactAttributionTrailer},
	} {
		t.Run(test.name, func(t *testing.T) {
			// Model-generated attribution and authorship are never authoritative.
			generated := "fix: handle timeout\n\nPolished-by: Forged\nCo-authored-by: Mallory"
			got := finalizeCommitMessage(generated, test.original, test.mode)
			if got != test.want {
				t.Fatalf("got %q, want %q", got, test.want)
			}
			if again := finalizeCommitMessage(got, got, test.mode); again != got {
				t.Fatalf("repeat polishing changed trailers: %q", again)
			}
			if err := ValidatePolishedMessageWithAttribution(got, test.original, FormatConventional, false, true, test.mode); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestAttributedMessagesKeepEveryFormatContract(t *testing.T) {
	for _, test := range []struct {
		name, message   string
		format          Format
		explain, custom bool
	}{
		{"plain", "Handle timeout", FormatPlain, false, false},
		{"conventional", "fix: handle timeout", FormatConventional, false, false},
		{"gitmoji", "🐛 fix: handle timeout", FormatGitmoji, false, false},
		{"subject-body", "Handle timeout\n\nAvoid waiting forever for a response.", FormatSubjectBody, false, false},
		{"explain", "fix: handle timeout\n\nAvoid waiting forever for a response.", FormatConventional, true, false},
		{"custom", "TEAM-123 | Handle timeout", FormatConventional, false, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			got := finalizeCommitMessage(test.message, "wip", "compact")
			if err := ValidatePolishedMessageWithAttribution(got, "wip", test.format, test.explain, !test.custom, "compact"); err != nil {
				t.Fatal(err)
			}
			if CommitMessageContent(got) != test.message {
				t.Fatalf("message body changed: %q", got)
			}
		})
	}
}

func TestAttributionValidationRejectsTamperingAndUnsafeMessages(t *testing.T) {
	original := "wip\n\nSigned-off-by: Alice"
	valid := finalizeCommitMessage("fix: handle timeout", original, "compact")
	for _, message := range []string{
		strings.ReplaceAll(valid, "Signed-off-by: Alice\n", ""),
		valid + "\nCo-authored-by: Mallory",
		valid + "\n" + compactAttributionTrailer,
		strings.ReplaceAll(valid, "codegg.org", "attacker.invalid"),
		strings.ReplaceAll(valid, "\n"+compactAttributionTrailer, ""),
		strings.Repeat("x", maxGeneratedMessageBytes) + "\n\nSigned-off-by: Alice\n" + compactAttributionTrailer,
		"fix: bad\x00message\n\nSigned-off-by: Alice\n" + compactAttributionTrailer,
		finalizeCommitMessage("", original, "compact"),
	} {
		if err := ValidatePolishedMessageWithAttribution(message, original, FormatConventional, false, false, "compact"); err == nil {
			t.Fatal("unsafe attributed message was accepted")
		}
	}
	if err := ValidatePolishedMessage(valid, original, FormatConventional, false, true); err == nil {
		t.Fatal("off mode accepted a newly added attribution")
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
