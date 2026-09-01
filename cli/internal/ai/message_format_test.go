package ai

import "testing"

func TestMatchesMessageFormat(t *testing.T) {
	tests := []struct {
		name    string
		message string
		format  Format
		explain bool
		want    bool
	}{
		{name: "plain", message: "Add resilient cache loading", format: FormatPlain, want: true},
		{name: "plain rejects conventional", message: "feat: add cache", format: FormatPlain, want: false},
		{name: "plain rejects body without explain", message: "Add cache\n\nAvoid repeated requests.", format: FormatPlain, want: false},
		{name: "plain explanation", message: "Add cache\n\nAvoid repeated requests.", format: FormatPlain, explain: true, want: true},
		{name: "conventional", message: "feat(cache): add resilient loading", format: FormatConventional, want: true},
		{name: "conventional breaking", message: "feat(api)!: remove legacy endpoint", format: FormatConventional, want: true},
		{name: "conventional body", message: "fix: avoid duplicate requests\n\nKeep one in-flight request per key.", format: FormatConventional, want: true},
		{name: "conventional repeated separator missing", message: "fix: avoid duplicate requests\nKeep one request.", format: FormatConventional, want: false},
		{name: "conventional period", message: "fix: avoid duplicate requests.", format: FormatConventional, want: false},
		{name: "conventional wrong type", message: "feature: add cache", format: FormatConventional, want: false},
		{name: "conventional explanation required", message: "fix: avoid duplicate requests", format: FormatConventional, explain: true, want: false},
		{name: "gitmoji", message: "✨ feat(cache): add resilient loading", format: FormatGitmoji, want: true},
		{name: "gitmoji variation selector", message: "⚡️ perf(cache): reuse parsed entries", format: FormatGitmoji, want: true},
		{name: "gitmoji missing emoji", message: "feat(cache): add resilient loading", format: FormatGitmoji, want: false},
		{name: "subject body", message: "Improve cache loading\n\nReuse parsed entries to reduce repeated work.", format: FormatSubjectBody, want: true},
		{name: "subject body missing body", message: "Improve cache loading", format: FormatSubjectBody, want: false},
		{name: "subject body missing separator", message: "Improve cache loading\nReuse parsed entries.", format: FormatSubjectBody, want: false},
		{name: "unknown", message: "fix: valid", format: Format("custom"), want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := MatchesMessageFormat(test.message, test.format, test.explain); got != test.want {
				t.Fatalf("MatchesMessageFormat(%q, %q, %t) = %t, want %t", test.message, test.format, test.explain, got, test.want)
			}
		})
	}
}

func TestMatchesMessageFormatCountsCharactersNotBytes(t *testing.T) {
	message := "修复缓存加载时的重复请求"
	if !MatchesMessageFormat(message, FormatPlain, false) {
		t.Fatalf("multibyte plain message was rejected: %q", message)
	}
}
