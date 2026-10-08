package ai

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"github.com/daidi/git-ai/cli/internal/config"
	"github.com/daidi/git-ai/cli/internal/state"
)

const modelCacheTTL = 7 * 24 * time.Hour
const maxModelCacheBytes = 2 << 20

// ModelListOptions controls only model discovery, never generation requests.
type ModelListOptions struct {
	Refresh bool
	Offline bool
}

type modelCacheEntry struct {
	Version   int         `json:"version"`
	FetchedAt time.Time   `json:"fetched_at"`
	Models    []ModelInfo `json:"models"`
}

// ListModelsWithOptions uses a fresh catalog for seven days. Transient network
// failures may use an explicitly marked stale catalog; auth and response errors
// never do. Cancellation always wins, including when a cache is available.
func ListModelsWithOptions(ctx context.Context, cfg *config.Config, options ModelListOptions) (ModelCatalog, error) {
	if options.Refresh && options.Offline {
		return ModelCatalog{}, errors.New("--refresh and --offline cannot be combined")
	}
	if err := ctx.Err(); err != nil {
		return ModelCatalog{}, err
	}
	endpoint, _ := modelEndpoint(cfg)
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return ModelCatalog{}, errors.New("configured provider endpoint is invalid")
	}
	if err := validateProviderURL(parsed); err != nil {
		return ModelCatalog{}, err
	}
	path := modelCachePath(cfg, endpoint)
	cached, ok := readModelCache(path)
	stale := ok && time.Since(cached.FetchedAt) >= modelCacheTTL
	if ok && (options.Offline || (!options.Refresh && !stale)) {
		return cachedCatalog(cfg, cached, stale), nil
	}
	if options.Offline {
		return ModelCatalog{}, errors.New("no usable model cache for this provider, endpoint and credential; run config models online first")
	}
	catalog, err := fetchModels(ctx, cfg)
	if ctx.Err() != nil {
		return ModelCatalog{}, ctx.Err()
	}
	if err != nil {
		if ok && canUseStaleModels(err) {
			return cachedCatalog(cfg, cached, true), nil
		}
		return ModelCatalog{}, err
	}
	catalog.Source = "network"
	catalog.FetchedAt = time.Now().UTC()
	// A read-only/full cache directory must not break successful discovery.
	_ = writeModelCache(path, modelCacheEntry{Version: 1, FetchedAt: catalog.FetchedAt, Models: catalog.Models})
	return catalog, nil
}

func cachedCatalog(cfg *config.Config, entry modelCacheEntry, stale bool) ModelCatalog {
	source := "cache"
	if stale {
		source = "stale-cache"
	}
	return ModelCatalog{Provider: cfg.Provider, CurrentModel: cfg.Model, Models: entry.Models, Source: source, FetchedAt: entry.FetchedAt, Stale: stale}
}

func canUseStaleModels(err error) bool {
	var providerErr *ProviderError
	if !errors.As(err, &providerErr) {
		return false
	}
	switch providerErr.Kind {
	case ErrorNetwork, ErrorTimeout, ErrorRateLimit, ErrorProvider:
		return true
	default:
		return false
	}
}

func modelCachePath(cfg *config.Config, endpoint string) string {
	// Do not persist endpoint URLs, credentials, or even the selected model.
	// Distinct accounts and endpoints must never share a catalog accidentally.
	identity, _ := json.Marshal([]string{cfg.Provider, endpoint, cfg.APIKey})
	digest := sha256.Sum256(identity)
	return filepath.Join(state.RuntimeCacheDir(), "models", hex.EncodeToString(digest[:])+".json")
}

func readModelCache(path string) (modelCacheEntry, bool) {
	var entry modelCacheEntry
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() || info.Size() > maxModelCacheBytes {
		return entry, false
	}
	file, err := os.Open(path)
	if err != nil {
		return entry, false
	}
	defer func() { _ = file.Close() }()
	data, err := io.ReadAll(io.LimitReader(file, maxModelCacheBytes+1))
	if err != nil || len(data) > maxModelCacheBytes || json.Unmarshal(data, &entry) != nil {
		return modelCacheEntry{}, false
	}
	if entry.Version != 1 || entry.FetchedAt.IsZero() || entry.FetchedAt.After(time.Now()) || entry.Models == nil {
		return modelCacheEntry{}, false
	}
	for _, model := range entry.Models {
		if !validModelInfo(model) {
			return modelCacheEntry{}, false
		}
	}
	return entry, true
}

func writeModelCache(path string, entry modelCacheEntry) error {
	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	if len(data) > maxModelCacheBytes {
		return errors.New("model catalog exceeds the cache size limit")
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	file, err := os.CreateTemp(dir, ".models-*.tmp")
	if err != nil {
		return err
	}
	defer func() { _ = file.Close(); _ = os.Remove(file.Name()) }()
	if err := file.Chmod(0o600); err != nil {
		return err
	}
	if _, err := file.Write(data); err != nil {
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	return os.Rename(file.Name(), path)
}
