package state

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestManagerKeepsRuntimeOutsideRepositoryAndUpdatesAtomically(t *testing.T) {
	runtimeRoot := filepath.Join(t.TempDir(), "application-cache")
	t.Setenv(stateDirEnv, runtimeRoot)
	gitDir := filepath.Join(t.TempDir(), ".git")
	if err := os.MkdirAll(gitDir, 0o700); err != nil {
		t.Fatal(err)
	}
	mgr := NewManager(gitDir)
	if strings.HasPrefix(mgr.StatePath(), gitDir+string(os.PathSeparator)) {
		t.Fatalf("state path leaked into repository: %s", mgr.StatePath())
	}
	if err := mgr.Save(&State{CurrentStatus: StatusIdle}); err != nil {
		t.Fatal(err)
	}

	const writers = 20
	var wg sync.WaitGroup
	errs := make(chan error, writers)
	for i := 0; i < writers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := mgr.Update(func(s *State) (bool, error) {
				s.PID++
				return true, nil
			})
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	state, err := mgr.Load()
	if err != nil {
		t.Fatal(err)
	}
	if state.PID != writers {
		t.Fatalf("lost concurrent update: got %d want %d", state.PID, writers)
	}
	if info, err := os.Stat(mgr.StatePath()); err != nil {
		t.Fatal(err)
	} else if runtime.GOOS != "windows" && info.Mode().Perm()&0o077 != 0 {
		t.Fatalf("state permissions are too broad: %o", info.Mode().Perm())
	}
}

func TestManagerMigratesLegacyApplicationState(t *testing.T) {
	t.Setenv(stateDirEnv, filepath.Join(t.TempDir(), "application-cache"))
	gitDir := filepath.Join(t.TempDir(), ".git")
	legacyDir := filepath.Join(gitDir, "git-ai")
	legacyLogs := filepath.Join(legacyDir, "logs")
	if err := os.MkdirAll(legacyLogs, 0o700); err != nil {
		t.Fatal(err)
	}
	legacy := State{CurrentStatus: StatusFailed, OriginalMsg: "draft"}
	data, _ := json.Marshal(legacy)
	if err := os.WriteFile(filepath.Join(legacyDir, "state.json"), data, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(legacyLogs, "old.log"), []byte("safe metadata"), 0o600); err != nil {
		t.Fatal(err)
	}

	mgr := NewManager(gitDir)
	if err := mgr.EnsureDir(); err != nil {
		t.Fatal(err)
	}
	got, err := mgr.Load()
	if err != nil {
		t.Fatal(err)
	}
	if got.CurrentStatus != StatusFailed || got.OriginalMsg != "draft" {
		t.Fatalf("migrated state = %#v", got)
	}
	if _, err := os.Stat(filepath.Join(mgr.LogDir(), "old.log")); err != nil {
		t.Fatalf("legacy log was not migrated: %v", err)
	}
	if _, err := os.Stat(legacyDir); !os.IsNotExist(err) {
		t.Fatalf("legacy repository state remains: %v", err)
	}
}

func TestManagerDoesNotFollowLegacyStateSymlinks(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symlink permissions vary on Windows")
	}
	t.Setenv(stateDirEnv, filepath.Join(t.TempDir(), "application-cache"))
	gitDir := filepath.Join(t.TempDir(), ".git")
	if err := os.MkdirAll(gitDir, 0o700); err != nil {
		t.Fatal(err)
	}
	targetDir := t.TempDir()
	target := filepath.Join(targetDir, "state.json")
	if err := os.WriteFile(target, []byte(`{"current_status":"failed","original_msg":"external"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	legacyDir := filepath.Join(gitDir, "git-ai")
	if err := os.Symlink(targetDir, legacyDir); err != nil {
		t.Skipf("symlink unavailable: %v", err)
	}

	mgr := NewManager(gitDir)
	if err := mgr.EnsureDir(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(mgr.StatePath()); !os.IsNotExist(err) {
		t.Fatalf("symlinked legacy state was migrated: %v", err)
	}
	if _, err := os.Lstat(legacyDir); err != nil {
		t.Fatalf("legacy symlink was modified: %v", err)
	}
}

func TestCleanZombieStateHonorsDaemonHandoffGrace(t *testing.T) {
	t.Setenv(stateDirEnv, t.TempDir())
	mgr := NewManager(filepath.Join(t.TempDir(), ".git"))
	if err := mgr.Save(&State{CurrentStatus: StatusPolishing, OperationID: "new", StartedAt: time.Now().Unix()}); err != nil {
		t.Fatal(err)
	}
	if cleaned, err := mgr.CleanZombieState(); err != nil || cleaned {
		t.Fatalf("recent PID-less handoff cleaned=%t err=%v", cleaned, err)
	}
	if _, err := mgr.Update(func(s *State) (bool, error) {
		s.StartedAt = time.Now().Add(-3 * time.Minute).Unix()
		s.PID = 999_999_999
		return true, nil
	}); err != nil {
		t.Fatal(err)
	}
	if cleaned, err := mgr.CleanZombieState(); err != nil || !cleaned {
		t.Fatalf("stale daemon cleaned=%t err=%v", cleaned, err)
	}
	got, _ := mgr.Load()
	if got.CurrentStatus != StatusFailed || got.LastError == nil || !got.LastError.Retryable {
		t.Fatalf("zombie state = %#v", got)
	}
}

func TestHistoryIsExternalPrivateAndBounded(t *testing.T) {
	runtimeRoot := filepath.Join(t.TempDir(), "application-cache")
	t.Setenv(stateDirEnv, runtimeRoot)
	gitDir := filepath.Join(t.TempDir(), ".git")
	if err := os.MkdirAll(gitDir, 0o700); err != nil {
		t.Fatal(err)
	}
	mgr := NewManager(gitDir)
	if err := mgr.EnsureDir(); err != nil {
		t.Fatal(err)
	}
	seed := History{Records: make([]HistoryRecord, 0, maxHistoryRecords+3)}
	for i := 0; i < maxHistoryRecords+3; i++ {
		seed.Records = append(seed.Records, HistoryRecord{SHA: fmt.Sprintf("sha-%d", i), OriginalMessage: "draft"})
	}
	seedData, err := json.Marshal(seed)
	if err != nil {
		t.Fatal(err)
	}
	if err := writeAtomic(mgr.HistoryPath(), seedData, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := mgr.AppendHistory(HistoryRecord{
		SHA: "latest", Model: "test-model", OriginalMessage: strings.Repeat("draft", 2000),
	}); err != nil {
		t.Fatal(err)
	}
	history, err := mgr.LoadHistory()
	if err != nil {
		t.Fatal(err)
	}
	if len(history.Records) != maxHistoryRecords {
		t.Fatalf("history records = %d, want %d", len(history.Records), maxHistoryRecords)
	}
	if len(history.Records[len(history.Records)-1].OriginalMessage) > maxHistoryMessageBytes+len("…") {
		t.Fatal("history message was not bounded")
	}
	if strings.HasPrefix(mgr.HistoryPath(), gitDir+string(os.PathSeparator)) {
		t.Fatalf("history path leaked into repository: %s", mgr.HistoryPath())
	}
	info, err := os.Stat(mgr.HistoryPath())
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm()&0o077 != 0 {
		t.Fatalf("history permissions are too broad: %o", info.Mode().Perm())
	}
}

func TestStateWriterRefusesAnUnreadableOversizedSnapshot(t *testing.T) {
	t.Setenv(stateDirEnv, t.TempDir())
	mgr := NewManager(filepath.Join(t.TempDir(), ".git"))
	if err := mgr.EnsureDir(); err != nil {
		t.Fatal(err)
	}
	oversized := &State{CurrentStatus: StatusPolishing, OriginalMsg: strings.Repeat("x", maxStateFileBytes)}
	if err := mgr.Save(oversized); err == nil {
		t.Fatal("oversized state was written")
	}
	if _, err := os.Stat(mgr.StatePath()); !os.IsNotExist(err) {
		t.Fatalf("oversized state left a file behind: %v", err)
	}
}
