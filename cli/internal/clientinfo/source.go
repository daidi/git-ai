// Package clientinfo reduces local IDE hints to a fixed, non-identifying label.
package clientinfo

import (
	"os"
	"strings"
)

// Normalize accepts only public product labels, never paths or arbitrary values.
func Normalize(value string) string {
	switch value {
	case "cli", "vscode", "cursor", "windsurf", "vscode-family", "intellij", "pycharm", "webstorm", "goland", "phpstorm", "rider", "clion", "datagrip", "rubymine", "android-studio", "jetbrains":
		return value
	default:
		return "unknown"
	}
}

// Detect must run before daemon environment sanitization. Only its enum result
// is forwarded; IDE paths and IPC/askpass variables must remain in the parent.
func Detect() string { return detect(os.Getenv) }

func detect(getenv func(string) string) string {
	if explicit := getenv("GIT_AI_CLIENT"); explicit != "" {
		return Normalize(explicit)
	}
	for _, key := range []string{"VSCODE_GIT_ASKPASS_MAIN", "GIT_ASKPASS"} {
		hint := strings.ToLower(strings.ReplaceAll(getenv(key), "\\", "/"))
		for _, product := range []struct{ marker, label string }{
			{"cursor", "cursor"}, {"windsurf", "windsurf"},
			{"visual studio code", "vscode"}, {"microsoft vs code", "vscode"},
			{"pycharm", "pycharm"}, {"webstorm", "webstorm"}, {"goland", "goland"},
			{"phpstorm", "phpstorm"}, {"rider", "rider"}, {"clion", "clion"},
			{"datagrip", "datagrip"}, {"rubymine", "rubymine"}, {"android studio", "android-studio"},
			{"intellijidea", "intellij"}, {"intellij idea", "intellij"},
		} {
			if productPath(hint, product.marker) {
				return product.label
			}
		}
		if strings.Contains(hint, "jetbrains") || strings.Contains(hint, "intellij-git-askpass") {
			return "jetbrains"
		}
	}
	if strings.Contains(strings.ToLower(getenv("TERMINAL_EMULATOR")), "jetbrains") {
		return "jetbrains"
	}
	if getenv("VSCODE_GIT_ASKPASS_MAIN") != "" || getenv("VSCODE_GIT_IPC_HANDLE") != "" || getenv("VSCODE_PID") != "" || getenv("TERM_PROGRAM") == "vscode" {
		return "vscode-family" // These variables are also used by VS Code forks.
	}
	switch strings.ToLower(getenv("TERM_PROGRAM")) {
	case "apple_terminal", "iterm.app", "wezterm", "alacritty", "ghostty":
		return "cli"
	}
	if getenv("WT_SESSION") != "" {
		return "cli"
	}
	return "unknown"
}

func productPath(path, product string) bool {
	parts := strings.Split(path, "/")
	for index, part := range parts {
		if !strings.HasPrefix(part, product) {
			continue
		}
		if strings.HasSuffix(part, ".app") {
			return true
		}
		if index > 0 && parts[index-1] == "jetbrains" {
			return true
		}
		if part == product && index+1 < len(parts) && parts[index+1] == "resources" {
			return true
		}
	}
	return false
}
