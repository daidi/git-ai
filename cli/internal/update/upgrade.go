package update

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"golang.org/x/mod/semver"
)

const (
	maxUpgradeArchiveBytes  int64 = 150 << 20
	maxUpgradeChecksumBytes int64 = 1 << 20
	maxUpgradeBinaryBytes   int64 = 100 << 20
)

type downloadError struct {
	message    string
	retryable  bool
	retryAfter time.Duration
}

func (e *downloadError) Error() string { return e.message }

// PerformUpgrade downloads a checksum-verified release into a same-directory
// staging file, validates it, and replaces the executable without touching a
// working installation on any download or validation failure.
func PerformUpgrade(currentVersion string) error {
	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("determine executable path: %w", err)
	}
	execPath, err = filepath.EvalSymlinks(execPath)
	if err != nil {
		return fmt.Errorf("resolve executable path: %w", err)
	}

	lowerPath := strings.ToLower(execPath)
	if strings.Contains(lowerPath, "homebrew") || strings.Contains(lowerPath, "linuxbrew") || strings.Contains(lowerPath, "cellar") {
		return errors.New("git-ai is installed via Homebrew; run 'brew upgrade git-ai' to update")
	}
	if strings.Contains(lowerPath, "scoop") {
		return errors.New("git-ai is installed via Scoop; run 'scoop update git-ai' to update")
	}
	if currentVersion == "dev" {
		return errors.New("running development version (dev); upgrade aborted")
	}
	curr := strings.TrimPrefix(currentVersion, "v")
	if !semver.IsValid("v" + curr) {
		return fmt.Errorf("current version is invalid: %q", currentVersion)
	}

	fmt.Println("Fetching latest release information...")
	release, err := FetchLatestRelease()
	if err != nil {
		return fmt.Errorf("fetch latest release: %w", err)
	}
	latest := strings.TrimPrefix(release.TagName, "v")
	if semver.Compare("v"+curr, "v"+latest) >= 0 {
		fmt.Printf("git-ai is already up to date (v%s).\n", curr)
		return nil
	}

	extension := "tar.gz"
	binaryName := "git-ai"
	if runtime.GOOS == "windows" {
		extension = "zip"
		binaryName = "git-ai.exe"
	}
	assetName := fmt.Sprintf("git-ai_%s_%s.%s", runtime.GOOS, runtime.GOARCH, extension)
	if !releaseHasAsset(release, assetName) || !releaseHasAsset(release, "checksums.txt") {
		return fmt.Errorf("release v%s does not contain verified assets for %s/%s", latest, runtime.GOOS, runtime.GOARCH)
	}

	fmt.Printf("Upgrading git-ai: v%s -> v%s\n", curr, latest)
	tempDir, err := os.MkdirTemp("", "git-ai-upgrade-*")
	if err != nil {
		return fmt.Errorf("create upgrade directory: %w", err)
	}
	defer func() { _ = os.RemoveAll(tempDir) }()

	baseURL := "https://github.com/daidi/git-ai/releases/download/" + release.TagName
	archivePath := filepath.Join(tempDir, assetName)
	checksumPath := filepath.Join(tempDir, "checksums.txt")
	client := newUpgradeHTTPClient()
	fmt.Printf("Downloading verified release asset %s...\n", assetName)
	if err := downloadFile(client, baseURL+"/"+assetName, archivePath, maxUpgradeArchiveBytes); err != nil {
		return fmt.Errorf("download release archive: %w", err)
	}
	if err := downloadFile(client, baseURL+"/checksums.txt", checksumPath, maxUpgradeChecksumBytes); err != nil {
		return fmt.Errorf("download release checksum: %w", err)
	}
	if err := verifyDownloadedChecksum(archivePath, checksumPath, assetName); err != nil {
		return err
	}

	stat, err := os.Stat(execPath)
	if err != nil {
		return fmt.Errorf("inspect current executable: %w", err)
	}
	stagedPath, err := stageUpgradeBinary(archivePath, extension, binaryName, execPath, stat.Mode().Perm())
	if err != nil {
		return err
	}
	defer func() { _ = os.Remove(stagedPath) }()
	if err := validateUpgradeBinary(stagedPath); err != nil {
		return err
	}
	if err := replaceExecutable(stagedPath, execPath); err != nil {
		return err
	}

	fmt.Println("✨ Update successful!")
	return nil
}

func releaseHasAsset(release *ReleaseMetadata, name string) bool {
	for _, asset := range release.Assets {
		if asset.Name == name {
			return true
		}
	}
	return false
}

func newUpgradeHTTPClient() *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	dialer := &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}
	transport.DialContext = dialer.DialContext
	transport.TLSHandshakeTimeout = 10 * time.Second
	transport.ResponseHeaderTimeout = 30 * time.Second
	return &http.Client{
		Transport: transport,
		Timeout:   90 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 6 {
				return errors.New("too many release download redirects")
			}
			if req.URL.Scheme != "https" {
				return errors.New("refusing a non-HTTPS release redirect")
			}
			return nil
		},
	}
}

func downloadFile(client *http.Client, rawURL, destination string, maxBytes int64) error {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() != "github.com" {
		return errors.New("refusing an untrusted release URL")
	}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		err = downloadFileOnce(client, rawURL, destination, maxBytes)
		if err == nil {
			return nil
		}
		lastErr = err
		var typed *downloadError
		if errors.As(err, &typed) && !typed.retryable {
			break
		}
		if attempt < 2 {
			delay := time.Duration(1<<attempt) * time.Second
			if errors.As(err, &typed) && typed.retryAfter > delay {
				delay = typed.retryAfter
			}
			if delay > 30*time.Second {
				delay = 30 * time.Second
			}
			time.Sleep(delay)
		}
	}
	return fmt.Errorf("download failed after bounded retries: %w", lastErr)
}

func downloadFileOnce(client *http.Client, rawURL, destination string, maxBytes int64) error {
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/octet-stream")
	req.Header.Set("User-Agent", "git-ai-updater")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		retryable := resp.StatusCode == http.StatusRequestTimeout || resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500
		return &downloadError{
			message:   "release server returned " + resp.Status,
			retryable: retryable, retryAfter: parseDownloadRetryAfter(resp.Header.Get("Retry-After")),
		}
	}
	if resp.ContentLength > maxBytes {
		return &downloadError{message: "release asset exceeded the safety limit", retryable: false}
	}

	file, err := os.OpenFile(destination, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	written, copyErr := io.Copy(file, io.LimitReader(resp.Body, maxBytes+1))
	syncErr := file.Sync()
	closeErr := file.Close()
	if copyErr != nil {
		_ = os.Remove(destination)
		return copyErr
	}
	if written > maxBytes {
		_ = os.Remove(destination)
		return &downloadError{message: "release asset exceeded the safety limit", retryable: false}
	}
	if syncErr != nil {
		_ = os.Remove(destination)
		return syncErr
	}
	if closeErr != nil {
		_ = os.Remove(destination)
		return closeErr
	}
	return nil
}

func parseDownloadRetryAfter(value string) time.Duration {
	if seconds, err := strconv.Atoi(strings.TrimSpace(value)); err == nil && seconds >= 0 {
		return time.Duration(seconds) * time.Second
	}
	if when, err := http.ParseTime(value); err == nil {
		return max(time.Until(when), 0)
	}
	return 0
}

func verifyDownloadedChecksum(archivePath, checksumPath, assetName string) error {
	data, err := os.ReadFile(checksumPath)
	if err != nil {
		return fmt.Errorf("read release checksum: %w", err)
	}
	var matches []string
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 2 && strings.TrimPrefix(fields[1], "*") == assetName {
			matches = append(matches, fields[0])
		}
	}
	if len(matches) != 1 || len(matches[0]) != sha256.Size*2 {
		return fmt.Errorf("release checksum list has no unique valid entry for %s", assetName)
	}
	expected, err := hex.DecodeString(matches[0])
	if err != nil {
		return fmt.Errorf("release checksum is invalid: %w", err)
	}
	archive, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	hash := sha256.New()
	_, copyErr := io.Copy(hash, archive)
	closeErr := archive.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}
	if !bytes.Equal(hash.Sum(nil), expected) {
		return errors.New("release checksum verification failed; the existing installation was left unchanged")
	}
	return nil
}

func stageUpgradeBinary(archivePath, extension, binaryName, execPath string, mode os.FileMode) (result string, err error) {
	pattern := ".git-ai-update-*"
	if runtime.GOOS == "windows" {
		pattern += ".exe"
	}
	staged, err := os.CreateTemp(filepath.Dir(execPath), pattern)
	if err != nil {
		return "", fmt.Errorf("create staged executable: %w", err)
	}
	stagedPath := staged.Name()
	defer func() {
		_ = staged.Close()
		if err != nil {
			_ = os.Remove(stagedPath)
		}
	}()

	if extension == "zip" {
		err = extractZipBinary(archivePath, binaryName, staged)
	} else {
		err = extractTarBinary(archivePath, binaryName, staged)
	}
	if err != nil {
		return "", err
	}
	if mode&0o111 == 0 {
		mode |= 0o700
	}
	if err = staged.Chmod(mode); err != nil {
		return "", fmt.Errorf("set staged executable permissions: %w", err)
	}
	if err = staged.Sync(); err != nil {
		return "", fmt.Errorf("sync staged executable: %w", err)
	}
	if err = staged.Close(); err != nil {
		return "", fmt.Errorf("close staged executable: %w", err)
	}
	return stagedPath, nil
}

func extractZipBinary(archivePath, binaryName string, destination io.Writer) error {
	archive, err := zip.OpenReader(archivePath)
	if err != nil {
		return fmt.Errorf("open release zip: %w", err)
	}
	defer func() { _ = archive.Close() }()
	for _, entry := range archive.File {
		if entry.Name != binaryName {
			continue
		}
		if !entry.Mode().IsRegular() || entry.UncompressedSize64 > uint64(maxUpgradeBinaryBytes) {
			return errors.New("release executable entry is invalid")
		}
		reader, err := entry.Open()
		if err != nil {
			return err
		}
		copyErr := copyUpgradeBinary(destination, reader)
		closeErr := reader.Close()
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	}
	return errors.New("release archive did not contain the expected executable")
}

func extractTarBinary(archivePath, binaryName string, destination io.Writer) error {
	file, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer func() { _ = file.Close() }()
	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return fmt.Errorf("open release gzip: %w", err)
	}
	defer func() { _ = gzipReader.Close() }()
	tarReader := tar.NewReader(gzipReader)
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if header.Name != binaryName {
			continue
		}
		if (header.Typeflag != tar.TypeReg && header.Typeflag != byte(0)) || header.Size < 0 || header.Size > maxUpgradeBinaryBytes {
			return errors.New("release executable entry is invalid")
		}
		return copyUpgradeBinary(destination, tarReader)
	}
	return errors.New("release archive did not contain the expected executable")
}

func copyUpgradeBinary(destination io.Writer, source io.Reader) error {
	written, err := io.Copy(destination, io.LimitReader(source, maxUpgradeBinaryBytes+1))
	if err != nil {
		return err
	}
	if written == 0 || written > maxUpgradeBinaryBytes {
		return errors.New("release executable had an invalid size")
	}
	return nil
}

func validateUpgradeBinary(path string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, path, "--version")
	command.Stdout = io.Discard
	command.Stderr = io.Discard
	if err := command.Run(); err != nil {
		return fmt.Errorf("downloaded executable failed validation: %w", err)
	}
	return nil
}

func replaceExecutable(stagedPath, execPath string) error {
	if runtime.GOOS != "windows" {
		if err := os.Rename(stagedPath, execPath); err != nil {
			return fmt.Errorf("replace executable atomically: %w", err)
		}
		return nil
	}

	backup, err := os.CreateTemp(filepath.Dir(execPath), ".git-ai-backup-*.exe")
	if err != nil {
		return fmt.Errorf("create update rollback path: %w", err)
	}
	backupPath := backup.Name()
	if err := backup.Close(); err != nil {
		return err
	}
	if err := os.Remove(backupPath); err != nil {
		return err
	}
	defer func() { _ = os.Remove(backupPath) }()
	if err := os.Rename(execPath, backupPath); err != nil {
		return fmt.Errorf("prepare executable replacement: %w", err)
	}
	if err := os.Rename(stagedPath, execPath); err != nil {
		if rollbackErr := os.Rename(backupPath, execPath); rollbackErr != nil {
			return fmt.Errorf("install new executable: %v (rollback also failed: %w)", err, rollbackErr)
		}
		return fmt.Errorf("install new executable: %w", err)
	}
	_ = os.Remove(backupPath)
	return nil
}
