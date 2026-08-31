package update

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofrs/flock"
	"golang.org/x/mod/semver"

	"github.com/daidi/git-ai/cli/internal/config"
)

type Cache struct {
	LatestVersion string    `json:"latest_version"`
	LastChecked   time.Time `json:"last_checked"`
}

const checkInterval = 24 * time.Hour

func cachePath() string {
	return filepath.Join(filepath.Dir(config.GlobalConfigPath()), "update-cache.json")
}

// BackgroundCheck launches a bounded best-effort update check. Network failure
// never delays or changes the user's Git operation.
func BackgroundCheck(checkUpdateEnabled bool) {
	if !checkUpdateEnabled {
		return
	}
	go func() {
		defer func() { _ = recover() }()
		path := cachePath()
		cache := readCache(path)
		if time.Since(cache.LastChecked) < checkInterval {
			return
		}

		// Record the attempt even if the network is down, preventing every short
		// CLI invocation from starting another request.
		cache.LastChecked = time.Now()
		if release, err := FetchLatestRelease(); err == nil {
			cache.LatestVersion = strings.TrimPrefix(release.TagName, "v")
		}
		_ = saveCache(path, cache)
	}()
}

type ReleaseMetadata struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

func FetchLatestRelease() (*ReleaseMetadata, error) {
	client := &http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("too many release metadata redirects")
			}
			if req.URL.Scheme != "https" {
				return errors.New("refusing non-HTTPS release metadata redirect")
			}
			return nil
		},
	}
	endpoints := []string{
		"https://git-ai.codegg.org/releases/latest",
		"https://api.github.com/repos/daidi/git-ai/releases/latest",
	}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		for _, endpoint := range endpoints {
			release, err := fetchReleaseMetadata(client, endpoint)
			if err == nil {
				return release, nil
			}
			lastErr = err
		}
		if attempt < 2 {
			time.Sleep(time.Duration(1<<attempt) * 250 * time.Millisecond)
		}
	}
	return nil, fmt.Errorf("release metadata unavailable after bounded retries: %w", lastErr)
}

func fetchReleaseMetadata(client *http.Client, endpoint string) (*ReleaseMetadata, error) {
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "git-ai")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("release service returned %s", resp.Status)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, (1<<20)+1))
	if err != nil {
		return nil, err
	}
	if len(data) > 1<<20 {
		return nil, errors.New("release metadata exceeded the safety limit")
	}
	var release ReleaseMetadata
	if err := json.Unmarshal(data, &release); err != nil {
		return nil, err
	}
	if !semver.IsValid(release.TagName) {
		return nil, fmt.Errorf("release service returned invalid version %q", release.TagName)
	}
	return &release, nil
}

func CheckUpdate(currentVersion string) string {
	if currentVersion == "dev" || strings.Contains(currentVersion, "-") {
		return ""
	}
	cache := readCache(cachePath())
	latest := strings.TrimPrefix(cache.LatestVersion, "v")
	current := strings.TrimPrefix(currentVersion, "v")
	if latest != "" && semver.Compare("v"+current, "v"+latest) < 0 {
		return fmt.Sprintf("\033[33m\n✨ Update available for git-ai: v%s \033[0m→\033[1;32m v%s\033[0m\n\033[33mRun 'brew upgrade git-ai' or your package manager to update.\033[0m\n", current, latest)
	}
	return ""
}

func readCache(path string) Cache {
	var cache Cache
	if info, err := os.Stat(path); err != nil || !info.Mode().IsRegular() || info.Size() > 1<<20 {
		return cache
	}
	if data, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(data, &cache)
	}
	return cache
}

func saveCache(path string, cache Cache) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	lockPath := path + ".lock"
	fileLock := flock.New(lockPath)
	if err := fileLock.Lock(); err != nil {
		return err
	}
	defer func() { _ = fileLock.Unlock() }()
	_ = os.Chmod(lockPath, 0o600)

	data, err := json.Marshal(cache)
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".update-*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer func() { _ = tmp.Close(); _ = os.Remove(tmpPath) }()
	if err := tmp.Chmod(0o600); err != nil {
		return err
	}
	if _, err := tmp.Write(append(data, '\n')); err != nil {
		return err
	}
	if err := tmp.Sync(); err != nil {
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpPath, path)
}
