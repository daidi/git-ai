package update

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestVerifyDownloadedChecksumRequiresOneExactMatch(t *testing.T) {
	dir := t.TempDir()
	archive := filepath.Join(dir, "git-ai_linux_amd64.tar.gz")
	contents := []byte("verified archive")
	if err := os.WriteFile(archive, contents, 0o600); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(contents)
	checksums := filepath.Join(dir, "checksums.txt")
	line := fmt.Sprintf("%x  %s\n", sum, filepath.Base(archive))
	if err := os.WriteFile(checksums, []byte(line), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := verifyDownloadedChecksum(archive, checksums, filepath.Base(archive)); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(checksums, []byte(line+line), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := verifyDownloadedChecksum(archive, checksums, filepath.Base(archive)); err == nil {
		t.Fatal("duplicate checksum entries were accepted")
	}
	if err := os.WriteFile(checksums, []byte(strings.Repeat("0", 64)+"  "+filepath.Base(archive)+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := verifyDownloadedChecksum(archive, checksums, filepath.Base(archive)); err == nil {
		t.Fatal("incorrect checksum was accepted")
	}
}

func TestStageUpgradeBinaryExtractsOnlyRegularExpectedEntry(t *testing.T) {
	dir := t.TempDir()
	archive := filepath.Join(dir, "release.tar.gz")
	writeTarGzip(t, archive, &tar.Header{Name: "git-ai", Mode: 0o755, Size: 6, Typeflag: tar.TypeReg}, []byte("binary"))
	execPath := filepath.Join(dir, "current")
	staged, err := stageUpgradeBinary(archive, "tar.gz", "git-ai", execPath, 0o755)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Remove(staged) })
	if data, err := os.ReadFile(staged); err != nil || string(data) != "binary" {
		t.Fatalf("staged binary = %q, %v", data, err)
	}

	symlinkArchive := filepath.Join(dir, "symlink.tar.gz")
	writeTarGzip(t, symlinkArchive, &tar.Header{Name: "git-ai", Linkname: "elsewhere", Typeflag: tar.TypeSymlink}, nil)
	if _, err := stageUpgradeBinary(symlinkArchive, "tar.gz", "git-ai", execPath, 0o755); err == nil {
		t.Fatal("symlink executable entry was accepted")
	}
}

func TestExtractZipBinaryRequiresExactName(t *testing.T) {
	dir := t.TempDir()
	archive := filepath.Join(dir, "release.zip")
	file, err := os.Create(archive)
	if err != nil {
		t.Fatal(err)
	}
	writer := zip.NewWriter(file)
	entry, err := writer.Create("nested/git-ai.exe")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = entry.Write([]byte("wrong"))
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	var output bytes.Buffer
	if err := extractZipBinary(archive, "git-ai.exe", &output); err == nil {
		t.Fatal("nested executable entry was accepted")
	}
}

func TestDownloadRejectsNonGitHubOrNonHTTPSURL(t *testing.T) {
	client := newUpgradeHTTPClient()
	for _, rawURL := range []string{"http://github.com/release", "https://example.com/release"} {
		if err := downloadFile(client, rawURL, filepath.Join(t.TempDir(), "asset"), 1024); err == nil {
			t.Fatalf("untrusted URL %q was accepted", rawURL)
		}
	}
}

func writeTarGzip(t *testing.T, path string, header *tar.Header, content []byte) {
	t.Helper()
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	gzipWriter := gzip.NewWriter(file)
	tarWriter := tar.NewWriter(gzipWriter)
	if err := tarWriter.WriteHeader(header); err != nil {
		t.Fatal(err)
	}
	if len(content) > 0 {
		if _, err := tarWriter.Write(content); err != nil {
			t.Fatal(err)
		}
	}
	if err := tarWriter.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gzipWriter.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
}
