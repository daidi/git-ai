package main

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	evaluation "github.com/daidi/git-ai/cli/internal/eval"
)

func TestRunReferenceBenchmarkAsJSON(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	code := run([]string{"--mode", "reference", "--fail-under", "100", "--json"}, &stdout, &stderr)
	if code != 0 {
		t.Fatalf("run() = %d, stderr = %q", code, stderr.String())
	}

	var report evaluation.Report
	if err := json.Unmarshal(stdout.Bytes(), &report); err != nil {
		t.Fatal(err)
	}
	if report.Dataset != "git-ai-real-commits-v2" || report.Summary.Overall.Rate != 100 {
		t.Fatalf("report = %#v", report.Summary)
	}
}

func TestRunReturnsFailureWhenBaselineMissesThreshold(t *testing.T) {
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	code := run([]string{"--mode", "original", "--fail-under", "100"}, &stdout, &stderr)
	if code != 1 {
		t.Fatalf("run() = %d, want 1", code)
	}
	if !strings.Contains(stdout.String(), "Overall:") || !strings.Contains(stderr.String(), "below required") {
		t.Fatalf("stdout = %q, stderr = %q", stdout.String(), stderr.String())
	}
}

func TestRunRejectsInvalidArguments(t *testing.T) {
	for _, test := range []struct {
		name string
		args []string
		want string
	}{
		{name: "mode", args: []string{"--mode", "guess"}, want: "unknown evaluation mode"},
		{name: "nan threshold", args: []string{"--fail-under", "NaN"}, want: "between 0 and 100"},
		{name: "positional", args: []string{"extra"}, want: "unexpected positional arguments"},
	} {
		t.Run(test.name, func(t *testing.T) {
			var stdout bytes.Buffer
			var stderr bytes.Buffer
			if code := run(test.args, &stdout, &stderr); code != 2 {
				t.Fatalf("run() = %d, want 2", code)
			}
			if !strings.Contains(stderr.String(), test.want) {
				t.Fatalf("stderr = %q", stderr.String())
			}
		})
	}
}
