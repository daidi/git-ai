package daemon

import (
	"runtime"
	"strings"
	"testing"
)

func TestSanitizedEnvPreservesStorageAndTLSResolution(t *testing.T) {
	t.Setenv("XDG_CACHE_HOME", "/tmp/git-ai-test-cache")
	t.Setenv("XDG_CONFIG_HOME", "/tmp/git-ai-test-config")
	t.Setenv("SSL_CERT_FILE", "/tmp/git-ai-test-ca.pem")
	t.Setenv("GIT_AI_STATE_DIR", "/tmp/git-ai-test-state")
	t.Setenv("GIT_ASKPASS", "/tmp/untrusted-askpass")

	values := make(map[string]string)
	for _, entry := range SanitizedEnv() {
		parts := strings.SplitN(entry, "=", 2)
		if len(parts) == 2 {
			values[parts[0]] = parts[1]
		}
	}
	for key, want := range map[string]string{
		"XDG_CACHE_HOME":      "/tmp/git-ai-test-cache",
		"XDG_CONFIG_HOME":     "/tmp/git-ai-test-config",
		"SSL_CERT_FILE":       "/tmp/git-ai-test-ca.pem",
		"GIT_AI_STATE_DIR":    "/tmp/git-ai-test-state",
		"GIT_TERMINAL_PROMPT": "0",
	} {
		if got := values[key]; got != want {
			t.Errorf("%s = %q, want %q", key, got, want)
		}
	}
	if _, exists := values["GIT_ASKPASS"]; exists {
		t.Fatal("IDE askpass helper leaked into detached daemon")
	}
	if runtime.GOOS == "windows" {
		foundPath := false
		for key := range values {
			if strings.EqualFold(key, "PATH") {
				foundPath = true
				break
			}
		}
		if !foundPath {
			t.Fatal("Windows executable search path was dropped from detached daemon")
		}
	}
}

func TestEnvironmentKeyAllowedUsesWindowsSemanticsOnlyWhenRequestedByRuntime(t *testing.T) {
	allowed := map[string]bool{"PATH": true}
	if runtime.GOOS == "windows" {
		if !environmentKeyAllowed("Path", allowed) {
			t.Fatal("Windows environment key matching was case-sensitive")
		}
	} else if environmentKeyAllowed("Path", allowed) {
		t.Fatal("Unix environment key matching unexpectedly became case-insensitive")
	}
}
