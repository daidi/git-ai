package ai

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestCommitlintConfigReadsStaticJSONWithoutExecutingProjectCode(t *testing.T) {
	repo := t.TempDir()
	config := `{"extends":["local-code"],"rules":{"type-enum":[2,"always",["fix"]]}}`
	if err := os.WriteFile(filepath.Join(repo, ".commitlintrc.json"), []byte(config), 0o600); err != nil {
		t.Fatal(err)
	}
	marker := filepath.Join(repo, "must-not-run")
	javascript := fmt.Sprintf("require('fs').writeFileSync(%q, 'executed')", marker)
	if err := os.WriteFile(filepath.Join(repo, "commitlint.config.js"), []byte(javascript), 0o600); err != nil {
		t.Fatal(err)
	}

	got := GetCommitlintConfig(repo)
	if !strings.Contains(got, `"type-enum"`) || strings.Contains(got, "extends") {
		t.Fatalf("static rules = %q", got)
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Fatalf("repository code was executed: %v", err)
	}
}

func TestCommitlintConfigReadsPackageJSONAndRejectsSymlinks(t *testing.T) {
	repo := t.TempDir()
	packageJSON := `{"name":"demo","commitlint":{"rules":{"subject-empty":[2,"never"]}}}`
	if err := os.WriteFile(filepath.Join(repo, "package.json"), []byte(packageJSON), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := GetCommitlintConfig(repo); !strings.Contains(got, `"subject-empty"`) {
		t.Fatalf("package rules = %q", got)
	}

	if runtime.GOOS == "windows" {
		return
	}
	external := filepath.Join(t.TempDir(), "external.json")
	if err := os.WriteFile(external, []byte(`{"rules":{"leaked":[2]}}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(external, filepath.Join(repo, ".commitlintrc.json")); err != nil {
		t.Fatal(err)
	}
	if got := GetCommitlintConfig(repo); strings.Contains(got, "leaked") {
		t.Fatalf("followed repository symlink: %q", got)
	}
}
