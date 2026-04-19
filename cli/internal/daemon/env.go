package daemon

import (
	"os"
	"strings"
)

// SanitizedEnv returns a minimal environment suitable for the detached daemon.
//
// It uses an allowlist approach: only variables essential for the daemon's
// operation are kept. Everything else — especially IDE-injected variables
// like GIT_ASKPASS, VSCODE_GIT_*, GIT_CONFIG_COUNT/KEY/VALUE, ELECTRON_* —
// is silently dropped.
//
// This ensures that system-level credential helpers (e.g., osxkeychain on
// macOS, credential-manager on Windows) work correctly without interference
// from IDE-specific IPC sockets or askpass scripts that are invalid in a
// fully detached (Setsid / DETACHED_PROCESS) daemon context.
func SanitizedEnv() []string {
	// Exact variable names to keep.
	allowedExact := map[string]bool{
		// Core POSIX
		"HOME":    true,
		"USER":    true,
		"LOGNAME": true,
		"PATH":    true,
		"SHELL":   true,
		"TMPDIR":  true,
		"TERM":    true,

		// Locale
		"LANG": true,

		// SSH agent — needed for SSH-based remotes.
		"SSH_AUTH_SOCK": true,

		// Proxy — needed for LLM API calls behind corporate proxies.
		"HTTP_PROXY":  true,
		"HTTPS_PROXY": true,
		"NO_PROXY":    true,
		"ALL_PROXY":   true,
		"http_proxy":  true,
		"https_proxy": true,
		"no_proxy":    true,
		"all_proxy":   true,

		// macOS Security framework — required for Keychain access.
		"SECURITYSESSIONID": true,
	}

	// Variable prefixes to keep.
	allowedPrefixes := []string{
		"LC_",     // Locale categories (LC_ALL, LC_CTYPE, ...)
		"GIT_AI_", // Our own config overrides
		"XPC_",    // macOS XPC services (Keychain, Security)
		"__CF_",   // CoreFoundation preferences
	}

	var env []string
	for _, e := range os.Environ() {
		key := e
		if idx := strings.IndexByte(e, '='); idx >= 0 {
			key = e[:idx]
		}

		if allowedExact[key] {
			env = append(env, e)
			continue
		}

		kept := false
		for _, prefix := range allowedPrefixes {
			if strings.HasPrefix(key, prefix) {
				kept = true
				break
			}
		}
		if kept {
			env = append(env, e)
		}
	}

	// Prevent Git from prompting on a non-existent terminal.
	env = append(env, "GIT_TERMINAL_PROMPT=0")

	return env
}
