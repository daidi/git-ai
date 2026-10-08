package clientinfo

import "testing"

func TestDetectIDEAndTerminalSources(t *testing.T) {
	for _, tc := range []struct {
		name string
		env  map[string]string
		want string
	}{
		{"explicit", map[string]string{"GIT_AI_CLIENT": "pycharm", "VSCODE_PID": "123"}, "pycharm"},
		{"invalid explicit", map[string]string{"GIT_AI_CLIENT": "/private/path"}, "unknown"},
		{"vscode mac", map[string]string{"VSCODE_GIT_ASKPASS_MAIN": "/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/git/dist/askpass-main.js"}, "vscode"},
		{"cursor windows", map[string]string{"VSCODE_GIT_ASKPASS_MAIN": `C:\Users\dev\AppData\Local\Programs\cursor\resources\app\extensions\git\dist\askpass-main.js`}, "cursor"},
		{"windsurf mac", map[string]string{"GIT_ASKPASS": "/Applications/Windsurf.app/Contents/Resources/app/extensions/git/dist/askpass.sh"}, "windsurf"},
		{"pycharm cache", map[string]string{"GIT_ASKPASS": "/Users/dev/Library/Caches/JetBrains/PyCharm2026.1/tmp/intellij-git-askpass.sh"}, "pycharm"},
		{"webstorm windows", map[string]string{"GIT_ASKPASS": `C:\Users\dev\AppData\Local\JetBrains\WebStorm2026.1\tmp\intellij-git-askpass.bat`}, "webstorm"},
		{"idea linux", map[string]string{"GIT_ASKPASS": "/home/dev/.cache/JetBrains/IntelliJIdea2026.1/tmp/intellij-git-askpass.sh"}, "intellij"},
		{"generic jetbrains", map[string]string{"TERMINAL_EMULATOR": "JetBrains-JediTerm"}, "jetbrains"},
		{"generic vscode", map[string]string{"TERM_PROGRAM": "vscode"}, "vscode-family"},
		{"iterm", map[string]string{"TERM_PROGRAM": "iTerm.app"}, "cli"},
		{"windows terminal", map[string]string{"WT_SESSION": "private-session"}, "cli"},
		{"headless unknown", map[string]string{}, "unknown"},
		{"username is not a product", map[string]string{"GIT_ASKPASS": "/home/cursor/custom-askpass.sh"}, "unknown"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := detect(func(key string) string { return tc.env[key] }); got != tc.want {
				t.Fatalf("got %q, want %q", got, tc.want)
			}
		})
	}
}
