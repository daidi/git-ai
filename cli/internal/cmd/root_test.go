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
