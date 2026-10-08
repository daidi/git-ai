package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/daidi/git-ai/cli/internal/config"
)

// ModelInfo is a provider model that can be selected by an IDE or setup UI.
type ModelInfo struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name,omitempty"`
}

// ModelCatalog is the stable JSON result returned by config models.
type ModelCatalog struct {
	Provider     string      `json:"provider"`
	CurrentModel string      `json:"current_model,omitempty"`
	Models       []ModelInfo `json:"models"`
	Source       string      `json:"source,omitempty"`
	FetchedAt    time.Time   `json:"fetched_at"`
	Stale        bool        `json:"stale,omitempty"`
}

type modelListResponse struct {
	Data []struct {
		ID               string `json:"id"`
		Name             string `json:"name"`
		DisplayName      string `json:"displayName"`
		DisplayNameSnake string `json:"display_name"`
	} `json:"data"`
	Models []struct {
		Name        string `json:"name"`
		DisplayName string `json:"displayName"`
	} `json:"models"`
}

// ListModels fetches a bounded provider model catalog without sending prompts,
// diffs, or repository data.
func ListModels(ctx context.Context, cfg *config.Config) (ModelCatalog, error) {
	return ListModelsWithOptions(ctx, cfg, ModelListOptions{})
}

func fetchModels(ctx context.Context, cfg *config.Config) (ModelCatalog, error) {
	endpoint, headers := modelEndpoint(cfg)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return ModelCatalog{}, fmt.Errorf("create model list request: %w", err)
	}
	if err := validateProviderURL(req.URL); err != nil {
		return ModelCatalog{}, err
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	resp, err := newProviderHTTPClient().Do(req)
	if err != nil {
		return ModelCatalog{}, classifyTransportError(err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return ModelCatalog{}, classifyHTTPStatus(resp.StatusCode, resp.Header.Get("Retry-After"))
	}
	body, err := readProviderResponse(resp.Body)
	if err != nil {
		return ModelCatalog{}, err
	}
	var payload modelListResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return ModelCatalog{}, &ProviderError{Kind: ErrorInvalidResponse, Message: "provider returned a malformed model list", Err: err}
	}
	if payload.Data == nil && payload.Models == nil {
		return ModelCatalog{}, &ProviderError{Kind: ErrorInvalidResponse, Message: "provider returned no model list"}
	}

	seen := make(map[string]bool)
	models := make([]ModelInfo, 0, len(payload.Data)+len(payload.Models))
	appendModel := func(id, displayName string) {
		id = strings.TrimSpace(strings.TrimPrefix(id, "models/"))
		if id == "" || seen[id] {
			return
		}
		seen[id] = true
		models = append(models, ModelInfo{ID: id, DisplayName: strings.TrimSpace(displayName)})
	}
	for _, model := range payload.Data {
		display := model.DisplayName
		if display == "" {
			display = model.DisplayNameSnake
		}
		if display == "" {
			display = model.Name
		}
		appendModel(model.ID, display)
	}
	for _, model := range payload.Models {
		appendModel(model.Name, model.DisplayName)
	}
	sort.Slice(models, func(i, j int) bool { return models[i].ID < models[j].ID })
	for _, model := range models {
		if !validModelInfo(model) {
			return ModelCatalog{}, &ProviderError{Kind: ErrorInvalidResponse, Message: "provider returned invalid model metadata"}
		}
	}
	return ModelCatalog{Provider: cfg.Provider, CurrentModel: cfg.Model, Models: models}, nil
}

func validModelInfo(model ModelInfo) bool {
	return model.ID != "" && len(model.ID) <= 1024 && len(model.DisplayName) <= 1024 &&
		!strings.ContainsFunc(model.ID+model.DisplayName, unicode.IsControl)
}

func modelEndpoint(cfg *config.Config) (string, map[string]string) {
	headers := map[string]string{"Accept": "application/json"}
	switch cfg.Provider {
	case "anthropic":
		headers["x-api-key"] = cfg.APIKey
		headers["anthropic-version"] = "2023-06-01"
		return providerBaseURL(cfg, "https://api.anthropic.com/v1") + "/models?limit=100", headers
	case "gemini":
		headers["x-goog-api-key"] = cfg.APIKey
		return providerBaseURL(cfg, "https://generativelanguage.googleapis.com/v1beta") + "/models?pageSize=100", headers
	case "ollama":
		base := providerBaseURL(cfg, "http://localhost:11434/v1")
		if !strings.HasSuffix(base, "/v1") {
			base += "/v1"
		}
		return base + "/models", headers
	default:
		headers["Authorization"] = "Bearer " + cfg.APIKey
		return strings.TrimRight(cfg.BaseURL, "/") + "/models", headers
	}
}
