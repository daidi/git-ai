package telemetry

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestUsageDisabledDoesNotCreateIdentifier(t *testing.T) {
	for _, doNotTrack := range []string{"", "1"} {
		t.Run("DO_NOT_TRACK="+doNotTrack, func(t *testing.T) {
			dir := filepath.Join(t.TempDir(), "config")
			t.Setenv("GIT_AI_CONFIG_DIR", dir)
			t.Setenv("DO_NOT_TRACK", doNotTrack)
			StartUsage(context.Background(), doNotTrack == "1")()
			if _, err := os.Stat(dir); !os.IsNotExist(err) {
				t.Fatalf("disabled telemetry touched disk: %v", err)
			}
		})
	}
}

func TestUsageConcurrentDedupAndUTCDateRollover(t *testing.T) {
	var calls atomic.Int32
	var receivedID string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		var event map[string]string
		if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
			t.Error(err)
		}
		if len(event) != 3 || event["source"] != "cli" || event["event"] != "polish_started" || len(event["installation_id"]) != 32 {
			t.Errorf("unexpected payload fields: %#v", event)
		}
		if receivedID != "" && receivedID != event["installation_id"] {
			t.Error("identifier changed across days")
		}
		receivedID = event["installation_id"]
		if r.Method != http.MethodPost || r.Header.Get("Content-Type") != "application/json" {
			t.Error("unexpected request format")
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()
	path := filepath.Join(t.TempDir(), "config with spaces", "usage.json")
	now := time.Date(2026, 10, 8, 23, 59, 0, 0, time.UTC)
	var wg sync.WaitGroup
	for range 12 {
		wg.Go(func() {
			ctx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			if err := reportUsage(ctx, newUsageClient(), server.URL, path, "cli", now); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	if calls.Load() != 1 {
		t.Fatalf("concurrent reports = %d, want 1", calls.Load())
	}
	if err := reportUsage(context.Background(), newUsageClient(), server.URL, path, "cli", now.In(time.FixedZone("CST", 8*3600))); err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 1 {
		t.Fatal("local timezone triggered duplicate")
	}
	if err := reportUsage(context.Background(), newUsageClient(), server.URL, path, "cli", now.Add(2*time.Minute)); err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 2 {
		t.Fatal("new UTC day did not report")
	}
	if runtime.GOOS != "windows" {
		info, err := os.Stat(path)
		if err != nil || info.Mode().Perm()&0o077 != 0 {
			t.Fatalf("usage state permissions are not private: %v", err)
		}
	}
}

func TestUsageFailureRetriesHourlyWithoutChangingID(t *testing.T) {
	var calls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls++
		if calls == 1 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()
	path := filepath.Join(t.TempDir(), "usage.json")
	now := time.Date(2026, 10, 8, 10, 0, 0, 0, time.UTC)
	if err := reportUsage(context.Background(), newUsageClient(), server.URL, path, "cli", now); err == nil {
		t.Fatal("503 marked as success")
	}
	before, err := readUsageState(path)
	if err != nil || before.Sources["cli"].LastSentDay != "" {
		t.Fatalf("failed attempt marked as sent: %v", err)
	}
	for _, elapsed := range []time.Duration{30 * time.Minute, time.Hour, 2 * time.Hour} {
		if err := reportUsage(context.Background(), newUsageClient(), server.URL, path, "cli", now.Add(elapsed)); err != nil {
			t.Fatal(err)
		}
	}
	if calls != 2 {
		t.Fatalf("requests = %d, want failed attempt plus one retry", calls)
	}
	after, err := readUsageState(path)
	if err != nil || after.InstallationID != before.InstallationID || after.Sources["cli"].LastSentDay != "2026-10-08" {
		t.Fatalf("invalid state after retry: %v", err)
	}
}

func TestUsageBoundedAndDoesNotFollowRedirects(t *testing.T) {
	t.Run("timeout", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
			_, _ = io.Copy(io.Discard, r.Body)
			<-r.Context().Done()
		}))
		defer server.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()
		start := time.Now()
		err := reportUsage(ctx, newUsageClient(), server.URL, filepath.Join(t.TempDir(), "usage.json"), "cli", time.Now())
		if err == nil || time.Since(start) > time.Second {
			t.Fatalf("request was not bounded: %v", err)
		}
	})
	t.Run("redirect", func(t *testing.T) {
		var leaked atomic.Bool
		target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			leaked.Store(true)
			w.WriteHeader(http.StatusNoContent)
		}))
		defer target.Close()
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, target.URL, http.StatusTemporaryRedirect)
		}))
		defer server.Close()
		err := reportUsage(context.Background(), newUsageClient(), server.URL, filepath.Join(t.TempDir(), "usage.json"), "cli", time.Now())
		if err == nil || leaked.Load() {
			t.Fatal("installation identifier followed a redirect")
		}
	})
}

func TestUsageCorruptStateIsPreserved(t *testing.T) {
	path := filepath.Join(t.TempDir(), "usage.json")
	for _, data := range []string{`{broken`, `{"installation_id":"invalid"}`, string(make([]byte, 4097))} {
		if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := reportUsage(context.Background(), newUsageClient(), "http://unused.invalid", path, "cli", time.Now()); err == nil {
			t.Fatal("invalid state was accepted")
		}
		got, err := os.ReadFile(path)
		if err != nil || string(got) != data {
			t.Fatal("corrupt state was replaced")
		}
	}
}

func TestUsageSameInstallationCanReportEachIDEOncePerDay(t *testing.T) {
	var events []map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var event map[string]string
		if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
			t.Error(err)
		}
		events = append(events, event)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()
	path := filepath.Join(t.TempDir(), "usage.json")
	now := time.Now()
	for _, source := range []string{"vscode", "cursor", "vscode", "cursor"} {
		if err := reportUsage(context.Background(), newUsageClient(), server.URL, path, source, now); err != nil {
			t.Fatal(err)
		}
	}
	if len(events) != 2 || events[0]["installation_id"] != events[1]["installation_id"] {
		t.Fatalf("expected two IDE events sharing one ID: %#v", events)
	}
	if events[0]["source"] != "vscode" || events[1]["source"] != "cursor" {
		t.Fatal("IDE sources were not recorded")
	}
}
