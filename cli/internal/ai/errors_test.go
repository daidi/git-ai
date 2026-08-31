package ai

import (
	"bytes"
	"context"
	"errors"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/daidi/git-ai/internal/config"
)

func TestDescribeErrorReturnsSafeActionableCategories(t *testing.T) {
	tests := []struct {
		status    int
		category  string
		retryable bool
	}{
		{http.StatusUnauthorized, "authentication", false},
		{http.StatusTooManyRequests, "rate_limit", true},
		{http.StatusBadGateway, "provider", true},
		{http.StatusBadRequest, "model", false},
	}
	for _, test := range tests {
		err := classifyHTTPStatus(test.status, "2")
		failure := DescribeError(err)
		if failure.Category != test.category || failure.Retryable != test.retryable {
			t.Errorf("status %d => %#v", test.status, failure)
		}
		if strings.Contains(failure.Message, "secret-provider-body") {
			t.Fatal("failure exposed provider response")
		}
	}
	if got := retryAfter(classifyHTTPStatus(http.StatusTooManyRequests, "2")); got != 2*time.Second {
		t.Fatalf("Retry-After = %v", got)
	}
	if failure := DescribeError(context.DeadlineExceeded); failure.Category != "timeout" || !failure.Retryable {
		t.Fatalf("deadline failure = %#v", failure)
	}
	if IsRetryable(context.Canceled) {
		t.Fatal("cancellation should not be retried")
	}
}

func TestModelDebugLogsNeverContainPromptsCredentialsOrResponses(t *testing.T) {
	const promptSecret = "PROMPT-SECRET-123"
	const responseSecret = "RESPONSE-SECRET-456"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer api-secret" {
			t.Errorf("authorization = %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"` + responseSecret + `"}}]}`))
	}))
	defer server.Close()

	var output bytes.Buffer
	logger := log.New(&output, "", 0)
	cfg := config.Defaults()
	cfg.APIKey = "api-secret"
	cfg.BaseURL = server.URL
	cfg.Model = "test-model"
	cfg.LogLevel = "debug"
	result, err := NewClient(cfg, logger).GenerateCompletion(context.Background(), promptSecret, promptSecret)
	if err != nil || result != responseSecret {
		t.Fatalf("GenerateCompletion() = %q, %v", result, err)
	}
	logs := output.String()
	for _, secret := range []string{promptSecret, responseSecret, "api-secret"} {
		if strings.Contains(logs, secret) {
			t.Fatalf("debug log exposed %q: %s", secret, logs)
		}
	}
}

func TestMalformedProviderResponseIsRetryableInvalidResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("not-json"))
	}))
	defer server.Close()
	cfg := config.Defaults()
	cfg.APIKey = "test"
	cfg.BaseURL = server.URL
	_, err := NewClient(cfg, nil).GenerateCompletion(context.Background(), "system", "user")
	var providerErr *ProviderError
	if !errors.As(err, &providerErr) || providerErr.Kind != ErrorInvalidResponse || !IsRetryable(err) {
		t.Fatalf("error = %#v", err)
	}
}
