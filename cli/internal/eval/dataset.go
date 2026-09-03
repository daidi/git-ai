// Package eval provides a deterministic commit-message quality harness for
// maintainers. It never rewrites Git state; live mode only invokes the same AI
// polishing pipeline used by the daemon.
package eval

import (
	"bytes"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/daidi/git-ai/cli/internal/ai"
)

const (
	datasetSchemaVersion = 2
	maxDatasetBytes      = 4 << 20
	maxCaseDiffBytes     = 2 << 20
	maxEvaluationCases   = 500
)

var (
	caseIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)
	commitPattern = regexp.MustCompile(`^[0-9a-f]{7,64}$`)
)

//go:embed testdata/dataset.json testdata/patches/*.patch
var defaultDatasetFiles embed.FS

type Dataset struct {
	SchemaVersion int    `json:"schema_version"`
	Name          string `json:"name"`
	Description   string `json:"description,omitempty"`
	Cases         []Case `json:"cases"`
}

type Source struct {
	Repository string `json:"repository"`
	Commit     string `json:"commit"`
	DiffKind   string `json:"diff_kind"`
}

type Case struct {
	ID                string     `json:"id"`
	Source            Source     `json:"source"`
	OriginalMessage   string     `json:"original_message"`
	ReferenceMessage  string     `json:"reference_message"`
	Format            string     `json:"format"`
	Language          string     `json:"language,omitempty"`
	Explain           bool       `json:"explain,omitempty"`
	MaxDiffTokens     int        `json:"max_diff_tokens"`
	ExpectedTypes     []string   `json:"expected_types,omitempty"`
	RequiredConcepts  [][]string `json:"required_concepts,omitempty"`
	ForbiddenTerms    []string   `json:"forbidden_terms,omitempty"`
	RequiredDiffPaths []string   `json:"required_diff_paths,omitempty"`
	RequiredDiffTerms []string   `json:"required_diff_terms,omitempty"`
	Diff              string     `json:"diff,omitempty"`
	DiffFile          string     `json:"diff_file,omitempty"`
}

type patchReader func(name string) ([]byte, error)

// LoadDefault loads the versioned, embedded real-commit benchmark dataset.
func LoadDefault() (Dataset, error) {
	data, err := defaultDatasetFiles.ReadFile("testdata/dataset.json")
	if err != nil {
		return Dataset{}, err
	}
	return decodeDataset(data, func(name string) ([]byte, error) {
		return defaultDatasetFiles.ReadFile(path.Join("testdata", name))
	})
}

// LoadFile loads a custom dataset and resolves diff_file entries relative to
// the manifest. Symlinks and oversized files are rejected because benchmark
// manifests commonly live in repositories that have not yet been trusted.
func LoadFile(filename string) (Dataset, error) {
	data, err := readBoundedRegularFile(filename, maxDatasetBytes)
	if err != nil {
		return Dataset{}, fmt.Errorf("read evaluation dataset: %w", err)
	}
	base := filepath.Dir(filename)
	return decodeDataset(data, func(name string) ([]byte, error) {
		return readPatchUnderBase(base, name)
	})
}

func decodeDataset(data []byte, readPatch patchReader) (Dataset, error) {
	if len(data) == 0 || len(data) > maxDatasetBytes {
		return Dataset{}, errors.New("evaluation dataset is empty or exceeds the safety limit")
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var dataset Dataset
	if err := decoder.Decode(&dataset); err != nil {
		return Dataset{}, fmt.Errorf("decode evaluation dataset: %w", err)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return Dataset{}, errors.New("evaluation dataset contains trailing JSON data")
	}

	for index := range dataset.Cases {
		item := &dataset.Cases[index]
		if (item.Diff == "") == (item.DiffFile == "") {
			return Dataset{}, fmt.Errorf("case %q must set exactly one of diff or diff_file", item.ID)
		}
		if item.DiffFile != "" {
			clean, err := cleanRelativePatchPath(item.DiffFile)
			if err != nil {
				return Dataset{}, fmt.Errorf("case %q: %w", item.ID, err)
			}
			resolved, err := readPatch(clean)
			if err != nil {
				return Dataset{}, fmt.Errorf("case %q read diff: %w", item.ID, err)
			}
			item.Diff = string(resolved)
		}
	}
	if err := ValidateDataset(dataset); err != nil {
		return Dataset{}, err
	}
	return dataset, nil
}

// ValidateDataset checks schema, provenance, score expectations, and bounded
// resolved diff content. It is also used for programmatically built datasets.
func ValidateDataset(dataset Dataset) error {
	if dataset.SchemaVersion != datasetSchemaVersion {
		return fmt.Errorf("unsupported evaluation dataset schema %d", dataset.SchemaVersion)
	}
	if strings.TrimSpace(dataset.Name) == "" {
		return errors.New("evaluation dataset name is required")
	}
	if len(dataset.Cases) == 0 || len(dataset.Cases) > maxEvaluationCases {
		return fmt.Errorf("evaluation dataset must contain between 1 and %d cases", maxEvaluationCases)
	}

	formats := make(map[string]bool)
	for _, format := range ai.ValidFormats() {
		formats[string(format)] = true
	}
	seen := make(map[string]bool, len(dataset.Cases))
	for _, item := range dataset.Cases {
		if !caseIDPattern.MatchString(item.ID) || seen[item.ID] {
			return fmt.Errorf("case id %q is invalid or duplicated", item.ID)
		}
		seen[item.ID] = true
		if strings.TrimSpace(item.Source.Repository) == "" || !commitPattern.MatchString(item.Source.Commit) {
			return fmt.Errorf("case %q has invalid source provenance", item.ID)
		}
		if item.Source.DiffKind != "full" && item.Source.DiffKind != "excerpt" {
			return fmt.Errorf("case %q diff_kind must be full or excerpt", item.ID)
		}
		if strings.TrimSpace(item.OriginalMessage) == "" || strings.TrimSpace(item.ReferenceMessage) == "" {
			return fmt.Errorf("case %q requires original and reference messages", item.ID)
		}
		if len(item.OriginalMessage) > maxGeneratedMessageBytes || len(item.ReferenceMessage) > maxGeneratedMessageBytes {
			return fmt.Errorf("case %q message exceeds the safety limit", item.ID)
		}
		if !formats[item.Format] {
			return fmt.Errorf("case %q uses unsupported format %q", item.ID, item.Format)
		}
		if len(item.ExpectedTypes) > 0 && item.Format != string(ai.FormatConventional) && item.Format != string(ai.FormatGitmoji) {
			return fmt.Errorf("case %q declares expected_types for a format without commit types", item.ID)
		}
		seenTypes := make(map[string]bool, len(item.ExpectedTypes))
		for _, expectedType := range item.ExpectedTypes {
			if !validConventionalType(expectedType) || seenTypes[expectedType] {
				return fmt.Errorf("case %q has invalid or duplicate expected type %q", item.ID, expectedType)
			}
			seenTypes[expectedType] = true
		}
		if item.MaxDiffTokens < 1 || item.MaxDiffTokens > 100000 {
			return fmt.Errorf("case %q has invalid max_diff_tokens", item.ID)
		}
		if item.Diff == "" || len(item.Diff) > maxCaseDiffBytes {
			return fmt.Errorf("case %q diff is empty or exceeds the safety limit", item.ID)
		}
		for _, group := range item.RequiredConcepts {
			if len(group) == 0 {
				return fmt.Errorf("case %q has an empty required concept group", item.ID)
			}
			for _, term := range group {
				if strings.TrimSpace(term) == "" {
					return fmt.Errorf("case %q has an empty required concept term", item.ID)
				}
			}
		}
		for _, requiredPath := range item.RequiredDiffPaths {
			if requiredPath == "" || !strings.Contains(item.Diff, requiredPath) {
				return fmt.Errorf("case %q required diff path %q is absent from its source diff", item.ID, requiredPath)
			}
		}
		for _, requiredTerm := range item.RequiredDiffTerms {
			if requiredTerm == "" || !strings.Contains(item.Diff, requiredTerm) {
				return fmt.Errorf("case %q required diff term %q is absent from its source diff", item.ID, requiredTerm)
			}
		}
	}
	return nil
}

func validConventionalType(value string) bool {
	switch value {
	case "feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert":
		return true
	default:
		return false
	}
}

func cleanRelativePatchPath(name string) (string, error) {
	name = strings.ReplaceAll(strings.TrimSpace(name), `\`, "/")
	clean := path.Clean(name)
	if clean == "." || path.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, "../") {
		return "", errors.New("diff_file must remain inside the dataset directory")
	}
	return clean, nil
}

func readBoundedRegularFile(filename string, limit int64) ([]byte, error) {
	info, err := os.Lstat(filename)
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() || info.Size() > limit {
		return nil, errors.New("file is not a bounded regular file")
	}
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer func() { _ = file.Close() }()
	data, err := io.ReadAll(io.LimitReader(file, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > limit {
		return nil, errors.New("file exceeds the safety limit")
	}
	return data, nil
}

func readPatchUnderBase(base, name string) ([]byte, error) {
	clean, err := cleanRelativePatchPath(name)
	if err != nil {
		return nil, err
	}
	absoluteBase, err := filepath.Abs(base)
	if err != nil {
		return nil, err
	}
	resolvedBase, err := filepath.EvalSymlinks(absoluteBase)
	if err != nil {
		return nil, err
	}
	candidate := filepath.Join(absoluteBase, filepath.FromSlash(clean))
	resolvedCandidate, err := filepath.EvalSymlinks(candidate)
	if err != nil {
		return nil, err
	}
	relative, err := filepath.Rel(resolvedBase, resolvedCandidate)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return nil, errors.New("diff_file must remain inside the dataset directory")
	}
	return readBoundedRegularFile(candidate, maxCaseDiffBytes)
}

const maxGeneratedMessageBytes = 64 << 10
