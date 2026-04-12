package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"os/exec"
	"time"
)

// GetCommitlintConfig runs npx commitlint --print-config to extract local repository rules.
// Returns the JSON string containing only the "rules" to save prompt space, or empty string on failure.
func GetCommitlintConfig(repoRoot string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "npx", "commitlint", "--print-config")
	cmd.Dir = repoRoot

	var out bytes.Buffer
	cmd.Stdout = &out

	// Silently fail if npx/commitlint is missing or user has no local config
	if err := cmd.Run(); err != nil {
		return ""
	}

	// Try to parse the config to only extract the "rules" sub-object to save context window.
	var config map[string]interface{}
	if err := json.Unmarshal(out.Bytes(), &config); err != nil {
		return ""
	}

	rules, ok := config["rules"]
	if !ok {
		return ""
	}

	// Re-marshal just the rules part
	compactConfig, err := json.Marshal(map[string]interface{}{"rules": rules})
	if err != nil {
		return ""
	}

	result := string(compactConfig)
	// Truncate to avoid overloading prompts if the config is unreasonably large
	if len(result) > 2000 {
		return result[:2000] + `... (truncated)`
	}

	return result
}
