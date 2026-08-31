package cmd

import (
	"errors"
	"fmt"
	"testing"
)

func TestExitCodePreservesDeliberateHookDecision(t *testing.T) {
	base := errors.New("deferred")
	if got := ExitCode(fmt.Errorf("wrapped: %w", withExitCode(base, 75))); got != 75 {
		t.Fatalf("ExitCode() = %d, want 75", got)
	}
	if got := ExitCode(base); got != 1 {
		t.Fatalf("ordinary ExitCode() = %d, want 1", got)
	}
}

func TestSelectVersion(t *testing.T) {
	tests := []struct {
		name          string
		linkerVersion string
		moduleVersion string
		want          string
	}{
		{name: "linker version wins", linkerVersion: "1.2.1", moduleVersion: "v9.9.9", want: "1.2.1"},
		{name: "normalizes linker tag", linkerVersion: "v1.2.1", moduleVersion: "v9.9.9", want: "1.2.1"},
		{name: "uses Go module version", linkerVersion: "dev", moduleVersion: "v1.2.1", want: "1.2.1"},
		{name: "keeps pseudo version", linkerVersion: "dev", moduleVersion: "v1.2.2-0.20260901000000-deadbeef", want: "1.2.2-0.20260901000000-deadbeef"},
		{name: "development fallback", linkerVersion: "dev", moduleVersion: "(devel)", want: "dev"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := selectVersion(test.linkerVersion, test.moduleVersion); got != test.want {
				t.Fatalf("selectVersion(%q, %q) = %q, want %q", test.linkerVersion, test.moduleVersion, got, test.want)
			}
		})
	}
}
