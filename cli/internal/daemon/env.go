package daemon

import (
	"os"
	"runtime"
	"strings"

	"github.com/daidi/git-ai/cli/internal/clientinfo"
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
		"TMP":     true,
		"TEMP":    true,
		"TERM":    true,
		// Keep cache/config resolution identical between the foreground hook and
		// detached daemon. Dropping these would make Linux users with custom XDG
		// directories write/read different state files.
		"XDG_CACHE_HOME":  true,
		"XDG_CONFIG_HOME": true,
		"XDG_DATA_HOME":   true,

		// Windows process/config/credential discovery.
		"USERPROFILE":  true,
		"HOMEDRIVE":    true,
		"HOMEPATH":     true,
		"APPDATA":      true,
		"LOCALAPPDATA": true,
		"PROGRAMDATA":  true,
		"SystemRoot":   true,
		"COMSPEC":      true,
		"PATHEXT":      true,

		// Locale
		"LANG":         true,
		"DO_NOT_TRACK": true,

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

		// Custom trust stores are common behind corporate TLS proxies.
		"SSL_CERT_FILE": true,
		"SSL_CERT_DIR":  true,

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
		if key == "GIT_AI_CLIENT" || (runtime.GOOS == "windows" && strings.EqualFold(key, "GIT_AI_CLIENT")) {
			continue // Replaced below with a normalized label.
		}

		if environmentKeyAllowed(key, allowedExact) {
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
	env = append(env, "GIT_AI_CLIENT="+clientinfo.Detect())

	return env
}

func environmentKeyAllowed(key string, allowed map[string]bool) bool {
	if allowed[key] {
		return true
	}
	// Windows environment-variable names are case-insensitive and commonly
	// expose the executable search path as "Path" rather than "PATH".
	if runtime.GOOS == "windows" {
		for candidate := range allowed {
			if strings.EqualFold(candidate, key) {
				return true
			}
		}
	}
	return false
}
