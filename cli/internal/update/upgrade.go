package update

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"golang.org/x/mod/semver"
)

// PerformUpgrade fetches the latest release, checks for an upgrade, extracts the new binary, and replaces the current executable.
func PerformUpgrade(currentVersion string) error {
	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("unable to determine executable path: %w", err)
	}
	execPath, err = filepath.EvalSymlinks(execPath)
	if err != nil {
		return err
	}

	// Protect package manager installations
	lowerPath := strings.ToLower(execPath)
	if strings.Contains(lowerPath, "homebrew") || strings.Contains(lowerPath, "linuxbrew") || strings.Contains(lowerPath, "cellar") {
		return fmt.Errorf("git-ai is installed via Homebrew. Please run 'brew upgrade git-ai' to update")
	}
	if strings.Contains(lowerPath, "scoop") {
		return fmt.Errorf("git-ai is installed via Scoop. Please run 'scoop update git-ai' to update")
	}

	if currentVersion == "dev" {
		return fmt.Errorf("running development version (dev). Upgrade aborted")
	}

	fmt.Printf("Fetching latest release information...\n")
	release, err := FetchLatestRelease()
	if err != nil {
		return fmt.Errorf("failed to fetch latest release: %w", err)
	}

	latest := strings.TrimPrefix(release.TagName, "v")
	curr := strings.TrimPrefix(currentVersion, "v")

	if semver.Compare("v"+curr, "v"+latest) >= 0 {
		fmt.Printf("git-ai is already up to date (v%s).\n", curr)
		return nil
	}

	fmt.Printf("Upgrading git-ai: v%s -> v%s\n", curr, latest)

	// Determine asset name
	ext := ".tar.gz"
	if runtime.GOOS == "windows" {
		ext = ".zip"
	}
	expectedAssetPrefix := fmt.Sprintf("git-ai_%s_%s", runtime.GOOS, runtime.GOARCH)

	var downloadURL string
	for _, asset := range release.Assets {
		if strings.HasPrefix(asset.Name, expectedAssetPrefix) && strings.HasSuffix(asset.Name, ext) {
			downloadURL = asset.BrowserDownloadURL
			break
		}
	}

	if downloadURL == "" {
		return fmt.Errorf("no suitable asset found for %s/%s in release v%s", runtime.GOOS, runtime.GOARCH, latest)
	}

	fmt.Printf("Downloading %s...\n", downloadURL)
	resp, err := http.Get(downloadURL)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed with HTTP %d", resp.StatusCode)
	}

	var newBinData []byte
	if ext == ".zip" {
		// zip format needs random access, read all into memory
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
		if err != nil {
			return err
		}
		for _, f := range zr.File {
			if f.Name == "git-ai.exe" || f.Name == "git-ai" {
				rc, err := f.Open()
				if err != nil {
					return err
				}
				newBinData, err = io.ReadAll(rc)
				_ = rc.Close()
				if err != nil {
					return err
				}
				break
			}
		}
	} else {
		// tar.gz
		gr, err := gzip.NewReader(resp.Body)
		if err != nil {
			return err
		}
		defer func() { _ = gr.Close() }()
		tr := tar.NewReader(gr)
		for {
			hdr, err := tr.Next()
			if err == io.EOF {
				break
			}
			if err != nil {
				return err
			}
			if hdr.Name == "git-ai" || hdr.Name == "git-ai.exe" {
				newBinData, err = io.ReadAll(tr)
				if err != nil {
					return err
				}
				break
			}
		}
	}

	if len(newBinData) == 0 {
		return fmt.Errorf("could not find executable inside archive")
	}

	// Make atomic swap
	tempFile := execPath + ".new"
	bakFile := execPath + ".bak"

	// 1. Write to temp file with same permissions
	stat, err := os.Stat(execPath)
	if err != nil {
		return err
	}
	if err := os.WriteFile(tempFile, newBinData, stat.Mode()); err != nil {
		return fmt.Errorf("failed to write temporal binary: %w", err)
	}

	// 2. Rename current to bak
	_ = os.Remove(bakFile) // ensure no old bak file
	if err := os.Rename(execPath, bakFile); err != nil {
		_ = os.Remove(tempFile)
		return fmt.Errorf("failed to swap binary (permission denied? run with root/admin?): %w", err)
	}

	// 3. Rename new to current
	if err := os.Rename(tempFile, execPath); err != nil {
		// rollback
		_ = os.Rename(bakFile, execPath)
		return fmt.Errorf("failed to install new binary: %w", err)
	}

	// 4. Try removing bak file (may fail on Windows if it's the currently running executable)
	_ = os.Remove(bakFile)

	fmt.Printf("✨ Update successful!\n")
	return nil
}
