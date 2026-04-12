package update

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/mod/semver"
)

type Cache struct {
	LatestVersion string    `json:"latest_version"`
	LastChecked   time.Time `json:"last_checked"`
}

const checkInterval = 24 * time.Hour
const repo = "daidi/git-ai"

func cachePath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "git-ai", "update_cache.json")
}

// BackgroundCheck launches an async check if the cache is expired.
func BackgroundCheck(checkUpdateEnabled bool) {
	if !checkUpdateEnabled {
		return
	}
	go func() {
		defer func() { _ = recover() }() // prevent any panic from crashing the CLI
		path := cachePath()
		var c Cache
		if b, err := os.ReadFile(path); err == nil {
			_ = json.Unmarshal(b, &c)
		}

		if time.Since(c.LastChecked) < checkInterval {
			return
		}
		release, err := FetchLatestRelease()
		if err != nil {
			return
		}

		c.LatestVersion = strings.TrimPrefix(release.TagName, "v")
		c.LastChecked = time.Now()

		_ = os.MkdirAll(filepath.Dir(path), 0755)
		if b, err := json.Marshal(c); err == nil {
			_ = os.WriteFile(path, b, 0644)
		}
	}()
}

// ReleaseMetadata contains GitHub API payload info for releases
type ReleaseMetadata struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

// FetchLatestRelease pulls the latest release from GitHub
func FetchLatestRelease() (*ReleaseMetadata, error) {
	resp, err := http.Get("https://api.github.com/repos/" + repo + "/releases/latest")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github api returned %s", resp.Status)
	}

	var release ReleaseMetadata
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, err
	}
	return &release, nil

}

// CheckUpdate returns a notice string if an update is available.
func CheckUpdate(currentVersion string) string {
	// If dev version, ignore
	if currentVersion == "dev" || strings.Contains(currentVersion, "-") {
		return ""
	}

	path := cachePath()
	var c Cache
	if b, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(b, &c); err == nil {
			latest := strings.TrimPrefix(c.LatestVersion, "v")
			curr := strings.TrimPrefix(currentVersion, "v")

			if latest != "" && semver.Compare("v"+curr, "v"+latest) < 0 {
				return fmt.Sprintf("\033[33m\n✨ Update available for git-ai: v%s \033[0m→\033[1;32m v%s\033[0m\n\033[33mRun 'brew upgrade git-ai' or your package manager to update.\033[0m\n", curr, latest)
			}
		}
	}
	return ""
}
