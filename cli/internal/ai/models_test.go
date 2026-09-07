package ai

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/daidi/git-ai/cli/internal/config"
)

func TestListModelsProviderFormats(t *testing.T) {
	tests := []struct {
		provider string
		body     string
		want     []string
	}{
		{provider: "openai", body: `{"data":[{"id":"z-model"},{"id":"a-model"}]}`, want: []string{"a-model", "z-model"}},
		{provider: "anthropic", body: `{"data":[{"id":"claude-test","display_name":"Claude Test"}]}`, want: []string{"claude-test"}},
		{provider: "gemini", body: `{"models":[{"name":"models/gemini-test","displayName":"Gemini Test"}]}`, want: []string{"gemini-test"}},
		{provider: "ollama", body: `{"data":[{"id":"qwen:test"}]}`, want: []string{"qwen:test"}},
	}
	for _, test := range tests {
		t.Run(test.provider, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if test.provider == "openai" && r.Header.Get("Authorization") != "Bearer secret" {
					t.Errorf("authorization header = %q", r.Header.Get("Authorization"))
				}
				if test.provider == "anthropic" && r.Header.Get("x-api-key") != "secret" {
					t.Errorf("x-api-key header = %q", r.Header.Get("x-api-key"))
				}
				if test.provider == "gemini" && r.Header.Get("x-goog-api-key") != "secret" {
					t.Errorf("x-goog-api-key header = %q", r.Header.Get("x-goog-api-key"))
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = fmt.Fprint(w, test.body)
			}))
			defer server.Close()
			baseURL := server.URL
			if test.provider == "ollama" {
				baseURL += "/v1"
			}
			catalog, err := ListModels(context.Background(), &config.Config{Provider: test.provider, BaseURL: baseURL, APIKey: "secret", Model: "current"})
			if err != nil {
				t.Fatal(err)
			}
			if len(catalog.Models) != len(test.want) {
				t.Fatalf("models = %#v", catalog.Models)
			}
			for i, want := range test.want {
				if catalog.Models[i].ID != want {
					t.Errorf("models[%d] = %q, want %q", i, catalog.Models[i].ID, want)
				}
			}
		})
	}
}
