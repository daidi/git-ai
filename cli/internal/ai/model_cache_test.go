package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/daidi/git-ai/cli/internal/config"
)

func TestModelCacheFreshRefreshOfflineAndCredentialIsolation(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("GIT_AI_STATE_DIR", dir)
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		_, _ = fmt.Fprint(w, `{"data":[{"id":"example-model"}]}`)
	}))
	defer server.Close()
	cfg := &config.Config{Provider: "openai", BaseURL: server.URL, APIKey: "SECRET_NEVER_PERSIST", Model: "old"}
	catalog, err := ListModels(context.Background(), cfg)
	if err != nil || catalog.Source != "network" {
		t.Fatalf("first fetch: %#v, %v", catalog, err)
	}
	cfg.Model = "new-selection"
	catalog, err = ListModels(context.Background(), cfg)
	if err != nil || catalog.Source != "cache" || catalog.CurrentModel != "new-selection" || calls.Load() != 1 {
		t.Fatalf("cache hit: %#v, %v, calls=%d", catalog, err, calls.Load())
	}
	catalog, err = ListModelsWithOptions(context.Background(), cfg, ModelListOptions{Refresh: true})
	if err != nil || catalog.Source != "network" || calls.Load() != 2 {
		t.Fatalf("refresh: %#v, %v", catalog, err)
	}
	catalog, err = ListModelsWithOptions(context.Background(), cfg, ModelListOptions{Offline: true})
	if err != nil || catalog.Source != "cache" || calls.Load() != 2 {
		t.Fatalf("offline: %#v, %v", catalog, err)
	}
	endpoint, _ := modelEndpoint(cfg)
	path := modelCachePath(cfg, endpoint)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{cfg.APIKey, cfg.BaseURL, "new-selection"} {
		if strings.Contains(string(data), forbidden) || strings.Contains(path, forbidden) {
			t.Fatal("cache persisted configuration/credentials")
		}
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 {
		t.Fatalf("mode = %v", info.Mode())
	}
	for _, mutate := range []func(*config.Config){
		func(c *config.Config) { c.APIKey = "different-account" },
		func(c *config.Config) { c.BaseURL += "/other" },
		func(c *config.Config) { c.Provider = "anthropic" },
	} {
		other := *cfg
		mutate(&other)
		if _, err := ListModelsWithOptions(context.Background(), &other, ModelListOptions{Offline: true}); err == nil {
			t.Fatal("cache crossed a credential/endpoint/provider boundary")
		}
	}
	if calls.Load() != 2 {
		t.Fatal("offline lookup performed network access")
	}
}

func TestModelCacheTransientFallbackButNotAuthOrInvalidResponse(t *testing.T) {
	t.Setenv("GIT_AI_STATE_DIR", t.TempDir())
	var status atomic.Int32
	status.Store(http.StatusOK)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(int(status.Load()))
		_, _ = fmt.Fprint(w, `{"data":[{"id":"model"}]}`)
	}))
	defer server.Close()
	cfg := &config.Config{Provider: "openai", BaseURL: server.URL, APIKey: "secret"}
	endpoint, _ := modelEndpoint(cfg)
	path := modelCachePath(cfg, endpoint)
	entry := modelCacheEntry{Version: 1, FetchedAt: time.Now().Add(-8 * 24 * time.Hour), Models: []ModelInfo{{ID: "old"}}}
	if err := writeModelCache(path, entry); err != nil {
		t.Fatal(err)
	}
	for _, code := range []int{429, 503, 504, 401, 403, 400, 404} {
		status.Store(int32(code))
		catalog, err := ListModels(context.Background(), cfg)
		if code == 429 || code >= 500 {
			if err != nil || !catalog.Stale || catalog.Source != "stale-cache" || catalog.Models[0].ID != "old" {
				t.Fatalf("status %d: %#v, %v", code, catalog, err)
			}
		} else if err == nil {
			t.Fatalf("status %d masked by cache", code)
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := ListModelsWithOptions(ctx, cfg, ModelListOptions{Offline: true}); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancellation: %v", err)
	}
	status.Store(200)
	if catalog, err := ListModels(context.Background(), cfg); err != nil || catalog.Source != "network" || catalog.Stale {
		t.Fatalf("expired refresh: %#v %v", catalog, err)
	}
	server.Close()
	if catalog, err := ListModelsWithOptions(context.Background(), cfg, ModelListOptions{Refresh: true}); err != nil || !catalog.Stale {
		t.Fatalf("offline fallback: %#v %v", catalog, err)
	}
}

func TestModelCacheRejectsCorruptUnsafeAndFutureEntries(t *testing.T) {
	t.Setenv("GIT_AI_STATE_DIR", t.TempDir())
	cfg := &config.Config{Provider: "openai", BaseURL: "https://example.com/v1", APIKey: "secret"}
	endpoint, _ := modelEndpoint(cfg)
	path := modelCachePath(cfg, endpoint)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		t.Fatal(err)
	}
	for _, data := range []string{"not-json", `{}`, strings.Repeat("x", maxModelCacheBytes+1)} {
		if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
			t.Fatal(err)
		}
		if _, err := ListModelsWithOptions(context.Background(), cfg, ModelListOptions{Offline: true}); err == nil {
			t.Fatal("invalid cache accepted")
		}
	}
	future := modelCacheEntry{Version: 1, FetchedAt: time.Now().Add(time.Hour), Models: []ModelInfo{{ID: "future"}}}
	if err := writeModelCache(path, future); err != nil {
		t.Fatal(err)
	}
	if _, ok := readModelCache(path); ok {
		t.Fatal("future cache accepted")
	}
	if _, err := ListModelsWithOptions(context.Background(), cfg, ModelListOptions{Offline: true, Refresh: true}); err == nil {
		t.Fatal("conflicting options accepted")
	}
	if runtime.GOOS != "windows" {
		target := filepath.Join(t.TempDir(), "cache.json")
		data, _ := json.Marshal(modelCacheEntry{Version: 1, FetchedAt: time.Now().Add(-time.Minute), Models: []ModelInfo{{ID: "symlink"}}})
		if err := os.WriteFile(target, data, 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.Remove(path); err != nil {
			t.Fatal(err)
		}
		if err := os.Symlink(target, path); err != nil {
			t.Fatal(err)
		}
		if _, ok := readModelCache(path); ok {
			t.Fatal("symlink cache accepted")
		}
	}
}

func TestModelCacheWriteFailureDoesNotFailDiscovery(t *testing.T) {
	file := filepath.Join(t.TempDir(), "not-a-directory")
	if err := os.WriteFile(file, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GIT_AI_STATE_DIR", file)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = fmt.Fprint(w, `{"data":[{"id":"model"}]}`) }))
	defer server.Close()
	catalog, err := ListModels(context.Background(), &config.Config{Provider: "openai", BaseURL: server.URL})
	if err != nil || catalog.Source != "network" {
		t.Fatalf("write failure broke discovery: %#v %v", catalog, err)
	}
}

func TestModelCacheDoesNotMaskMalformedResponsesOrReplaceGoodCache(t *testing.T) {
	t.Setenv("GIT_AI_STATE_DIR", t.TempDir())
	var response atomic.Value
	response.Store(`{"data":[{"id":"original"}]}`)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = fmt.Fprint(w, response.Load().(string))
	}))
	defer server.Close()
	cfg := &config.Config{Provider: "openai", BaseURL: server.URL}
	if _, err := ListModels(context.Background(), cfg); err != nil {
		t.Fatal(err)
	}
	for _, body := range []string{
		`not-json`, `{}`, `{"data":null}`, `{"data":"wrong-type"}`,
		`{"data":[{"id":"unsafe\u001b[31mmodel"}]}`,
		`{"data":[{"id":"valid","display_name":"unsafe\u0000name"}]}`,
	} {
		response.Store(body)
		_, err := ListModelsWithOptions(context.Background(), cfg, ModelListOptions{Refresh: true})
		var providerErr *ProviderError
		if !errors.As(err, &providerErr) || providerErr.Kind != ErrorInvalidResponse {
			t.Fatalf("invalid response was masked by the cache: %v", err)
		}
		catalog, err := ListModelsWithOptions(context.Background(), cfg, ModelListOptions{Offline: true})
		if err != nil || len(catalog.Models) != 1 || catalog.Models[0].ID != "original" {
			t.Fatalf("invalid response replaced a valid cache: %#v, %v", catalog, err)
		}
	}
}

func TestModelCacheCancellationDuringRefreshDoesNotFallBack(t *testing.T) {
	t.Setenv("GIT_AI_STATE_DIR", t.TempDir())
	started := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		close(started)
		<-r.Context().Done()
	}))
	defer server.Close()
	cfg := &config.Config{Provider: "openai", BaseURL: server.URL}
	endpoint, _ := modelEndpoint(cfg)
	if err := writeModelCache(modelCachePath(cfg, endpoint), modelCacheEntry{
		Version: 1, FetchedAt: time.Now().Add(-time.Hour), Models: []ModelInfo{{ID: "old"}},
	}); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() { <-started; cancel() }()
	if _, err := ListModelsWithOptions(ctx, cfg, ModelListOptions{Refresh: true}); !errors.Is(err, context.Canceled) {
		t.Fatalf("in-flight cancellation used cache: %v", err)
	}
}
