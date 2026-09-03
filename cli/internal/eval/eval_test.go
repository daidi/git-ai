package eval

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
)

func TestDefaultReferenceDatasetPassesEveryCheck(t *testing.T) {
	dataset, err := LoadDefault()
	if err != nil {
		t.Fatal(err)
	}
	if len(dataset.Cases) != 10 {
		t.Fatalf("cases = %d, want 10", len(dataset.Cases))
	}

	report, err := Run(context.Background(), dataset, ModeReference, nil)
	if err != nil {
		t.Fatal(err)
	}
	if report.Summary.Overall.Rate != 100 || report.Summary.PassingCases.Passed != len(dataset.Cases) {
		t.Fatalf("reference summary = %#v", report.Summary)
	}
	if report.Summary.Trailers.Total != 1 || report.Summary.Trailers.Passed != 1 {
		t.Fatalf("trailer metric = %#v", report.Summary.Trailers)
	}
	for _, result := range report.Results {
		if result.Source.Commit == "" || result.Checks.DiffContextMatched != result.Checks.DiffContextTotal {
			t.Errorf("case result = %#v", result)
		}
	}
}

func TestDefaultDatasetCoversFormatsLanguagesAndDiffShapes(t *testing.T) {
	dataset, err := LoadDefault()
	if err != nil {
		t.Fatal(err)
	}
	formats := make(map[string]bool)
	hasSimplifiedChinese := false
	hasRename := false
	hasBinary := false
	for _, item := range dataset.Cases {
		formats[item.Format] = true
		hasSimplifiedChinese = hasSimplifiedChinese || item.Language == "zh-CN"
		hasRename = hasRename || strings.Contains(item.Diff, "rename to ")
		hasBinary = hasBinary || strings.Contains(item.Diff, "Binary files ")
	}
	for _, format := range []string{"plain", "conventional", "gitmoji", "subject-body"} {
		if !formats[format] {
			t.Errorf("default dataset does not cover %s", format)
		}
	}
	if !hasSimplifiedChinese || !hasRename || !hasBinary {
		t.Fatalf("coverage: zh-CN=%t rename=%t binary=%t", hasSimplifiedChinese, hasRename, hasBinary)
	}
}

func TestOriginalModeProvidesARealBaseline(t *testing.T) {
	dataset, err := LoadDefault()
	if err != nil {
		t.Fatal(err)
	}
	report, err := Run(context.Background(), dataset, ModeOriginal, nil)
	if err != nil {
		t.Fatal(err)
	}
	if report.Summary.Overall.Rate >= 75 || report.Summary.PassingCases.Passed != 0 {
		t.Fatalf("original hints unexpectedly passed the benchmark: %#v", report.Summary)
	}
	if report.Summary.DiffBudget.Rate != 100 || report.Summary.DiffContext.Rate != 100 {
		t.Fatalf("deterministic diff checks regressed: %#v", report.Summary)
	}
}

func TestLiveModeContinuesAfterGenerationFailure(t *testing.T) {
	dataset, err := LoadDefault()
	if err != nil {
		t.Fatal(err)
	}
	failedID := dataset.Cases[1].ID
	report, err := Run(context.Background(), dataset, ModeLive, func(_ context.Context, item Case) (string, error) {
		if item.ID == failedID {
			return "", errors.New("model unavailable")
		}
		return item.ReferenceMessage, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(report.Results) != len(dataset.Cases) || report.Summary.Generation.Passed != len(dataset.Cases)-1 {
		t.Fatalf("live summary = %#v", report.Summary)
	}
	if report.Results[1].Error != "model unavailable" || report.Results[1].Passed {
		t.Fatalf("failed result = %#v", report.Results[1])
	}
}

func TestEquivalentLivePhrasingIsNotOverfitToReferenceMessages(t *testing.T) {
	dataset, err := LoadDefault()
	if err != nil {
		t.Fatal(err)
	}
	dataset.Cases = dataset.Cases[:5]
	candidates := map[string]string{
		"windows-permission-tests":      "fix(test): skip permission checks on Windows\n\nSigned-off-by: Git AI Eval <eval@example.invalid>",
		"vscode-template-interpolation": "fix(ui): correct template literal syntax in actions webview",
		"github-actions-node24":         "ci(workflows): force Node.js 24 for JavaScript actions",
		"vscode-restore-save-state":     "feat(stateWatcher): add saveState method to persist state",
		"idea-settings-rendering-mixed": "fix(settings): add missing comment hints for API key and smart skip",
	}
	report, err := Run(context.Background(), dataset, ModeLive, func(_ context.Context, item Case) (string, error) {
		return candidates[item.ID], nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if report.Summary.Semantic.Rate != 100 {
		t.Fatalf("equivalent wording failed semantics: %#v", report.Summary.Semantic)
	}
	if report.Summary.ExpectedType.Passed != 4 || report.Summary.ExpectedType.Total != 5 {
		t.Fatalf("type metric = %#v", report.Summary.ExpectedType)
	}
	if report.Summary.PassingCases.Passed != 4 {
		t.Fatalf("passing cases = %#v", report.Summary.PassingCases)
	}
}

func TestLiveModeDoesNotStartGeneratorsAfterCancellation(t *testing.T) {
	dataset, err := LoadDefault()
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	var calls atomic.Int32
	report, err := Run(ctx, dataset, ModeLive, func(_ context.Context, _ Case) (string, error) {
		calls.Add(1)
		return "", nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 0 || report.Summary.Generation.Passed != 0 {
		t.Fatalf("canceled evaluation started %d generators: %#v", calls.Load(), report.Summary.Generation)
	}
	for _, result := range report.Results {
		if result.Error != context.Canceled.Error() {
			t.Fatalf("canceled result = %#v", result)
		}
	}
}

func TestDatasetLoaderRejectsUnknownFieldsAndEscapingPatchPaths(t *testing.T) {
	dir := t.TempDir()
	unknown := `{"schema_version":2,"name":"bad","unexpected":true,"cases":[]}`
	unknownPath := filepath.Join(dir, "unknown.json")
	if err := os.WriteFile(unknownPath, []byte(unknown), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadFile(unknownPath); err == nil || !strings.Contains(err.Error(), "unknown field") {
		t.Fatalf("unknown field error = %v", err)
	}

	escaping := `{
  "schema_version": 2,
  "name": "bad",
  "cases": [{
    "id": "escape", "source": {"repository": "repo", "commit": "abcdef0", "diff_kind": "full"},
    "original_message": "wip", "reference_message": "fix: valid", "format": "conventional",
    "max_diff_tokens": 10, "diff_file": "../outside.patch"
  }]
}`
	escapingPath := filepath.Join(dir, "escaping.json")
	if err := os.WriteFile(escapingPath, []byte(escaping), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadFile(escapingPath); err == nil || !strings.Contains(err.Error(), "inside the dataset directory") {
		t.Fatalf("escaping path error = %v", err)
	}
}

func TestDatasetLoaderRejectsSymlinkedPatchDirectoryEscape(t *testing.T) {
	dir := t.TempDir()
	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "outside.patch"), []byte("diff --git a/a b/a\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(dir, "linked")); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}

	manifest := `{
  "schema_version": 2,
  "name": "bad",
  "cases": [{
    "id": "escape", "source": {"repository": "repo", "commit": "abcdef0", "diff_kind": "full"},
    "original_message": "wip", "reference_message": "fix: valid", "format": "conventional",
    "max_diff_tokens": 10, "diff_file": "linked/outside.patch"
  }]
}`
	manifestPath := filepath.Join(dir, "dataset.json")
	if err := os.WriteFile(manifestPath, []byte(manifest), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadFile(manifestPath); err == nil || !strings.Contains(err.Error(), "inside the dataset directory") {
		t.Fatalf("symlink escape error = %v", err)
	}
}

func TestReportWritersProduceStableHumanAndJSONOutput(t *testing.T) {
	dataset, err := LoadDefault()
	if err != nil {
		t.Fatal(err)
	}
	report, err := Run(context.Background(), dataset, ModeReference, nil)
	if err != nil {
		t.Fatal(err)
	}
	report.Provider = "test-provider"
	report.Model = "test-model"

	var human bytes.Buffer
	if err := WriteText(&human, report); err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{"git-ai-real-commits-v2", "test-provider", "test-model", "windows-permission-tests", "Overall: 100.0%"} {
		if !strings.Contains(human.String(), expected) {
			t.Errorf("text report omitted %q:\n%s", expected, human.String())
		}
	}

	var machine bytes.Buffer
	if err := WriteJSON(&machine, report); err != nil {
		t.Fatal(err)
	}
	var decoded Report
	if err := json.Unmarshal(machine.Bytes(), &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.Summary.Overall.Rate != 100 || decoded.Dataset != report.Dataset || decoded.Model != report.Model {
		t.Fatalf("JSON report = %#v", decoded.Summary)
	}
}

func TestParseModeRejectsUnknownMode(t *testing.T) {
	if mode, err := ParseMode(" LIVE "); err != nil || mode != ModeLive {
		t.Fatalf("ParseMode(LIVE) = %q, %v", mode, err)
	}
	if _, err := ParseMode("guess"); err == nil {
		t.Fatal("unknown mode was accepted")
	}
}

func TestPercentileUsesNearestRankForSmallLiveRuns(t *testing.T) {
	samples := []int64{10, 20, 30, 40, 100}
	if got := percentile(samples, 0.50); got != 30 {
		t.Fatalf("p50 = %d, want 30", got)
	}
	if got := percentile(samples, 0.95); got != 100 {
		t.Fatalf("p95 = %d, want 100", got)
	}
}
