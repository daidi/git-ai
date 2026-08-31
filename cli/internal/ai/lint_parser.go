package ai

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
)

const (
	maxCommitlintFileBytes  = 1 << 20
	maxCommitlintRulesBytes = 8 << 10
)

// GetCommitlintConfig reads only static JSON configuration. It intentionally
// never invokes npx/Node or loads JavaScript from the repository: polishing a
// commit must not install dependencies, execute project code, or mutate the
// user's workspace. Extends and executable configuration are ignored.
func GetCommitlintConfig(repoRoot string) string {
	if repoRoot == "" {
		return ""
	}
	candidates := []struct {
		name        string
		fromPackage bool
	}{
		{name: ".commitlintrc.json"},
		{name: ".commitlintrc"},
		{name: "commitlint.config.json"},
		{name: "package.json", fromPackage: true},
	}
	for _, candidate := range candidates {
		data, ok := readStaticConfig(filepath.Join(repoRoot, candidate.name))
		if !ok {
			continue
		}
		var document map[string]json.RawMessage
		if err := json.Unmarshal(data, &document); err != nil {
			continue
		}
		if candidate.fromPackage {
			var nested map[string]json.RawMessage
			if err := json.Unmarshal(document["commitlint"], &nested); err != nil {
				continue
			}
			document = nested
		}
		rules, exists := document["rules"]
		if !exists || !json.Valid(rules) {
			continue
		}
		var object map[string]json.RawMessage
		if err := json.Unmarshal(rules, &object); err != nil || object == nil {
			continue
		}
		compact, err := json.Marshal(map[string]json.RawMessage{"rules": rules})
		if err == nil && len(compact) <= maxCommitlintRulesBytes {
			return string(compact)
		}
	}
	return ""
}

func readStaticConfig(path string) ([]byte, bool) {
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() || info.Size() > maxCommitlintFileBytes {
		return nil, false
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, false
	}
	defer func() { _ = file.Close() }()
	data, err := io.ReadAll(io.LimitReader(file, maxCommitlintFileBytes+1))
	return data, err == nil && len(data) <= maxCommitlintFileBytes
}
