package telemetry

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/gofrs/flock"

	"github.com/daidi/git-ai/cli/internal/clientinfo"
	"github.com/daidi/git-ai/cli/internal/config"
)

const usageEndpoint = "https://git-ai.codegg.org/v1/usage"
const usageTimeout = 2 * time.Second
const maxUsageStateBytes = 8192

var usageVersionPattern = regexp.MustCompile(`^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$`)

type usageState struct {
	InstallationID string                      `json:"installation_id"`
	Sources        map[string]usageSourceState `json:"sources"`
}

type usageSourceState struct {
	LastSentDay        string    `json:"last_sent_day,omitempty"`
	LastSentVersion    string    `json:"last_sent_version,omitempty"`
	LastAttempt        time.Time `json:"last_attempt,omitempty"`
	LastAttemptVersion string    `json:"last_attempt_version,omitempty"`
}

// StartUsage reports one daily activity asynchronously from the polishing
// daemon. The returned function joins the bounded request before daemon exit;
// neither errors nor response bodies are logged or affect the Git operation.
func StartUsage(ctx context.Context, enabled bool, cliVersion string) func() {
	if !enabled || os.Getenv("DO_NOT_TRACK") == "1" || ctx.Err() != nil {
		return func() {}
	}
	ctx, cancel := context.WithTimeout(ctx, usageTimeout)
	done := make(chan struct{})
	go func() {
		defer close(done)
		defer cancel()
		path := filepath.Join(filepath.Dir(config.GlobalConfigPath()), "usage.json")
		_ = reportUsage(ctx, newUsageClient(), usageEndpoint, path, clientinfo.Detect(), cliVersion, time.Now())
	}()
	return func() { <-done }
}

func newUsageClient() *http.Client {
	return &http.Client{
		Timeout: usageTimeout,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return errors.New("usage redirects are not allowed")
		},
	}
}

func normalizeUsageVersion(version string) string {
	version = strings.TrimPrefix(strings.TrimSpace(version), "v")
	if version == "dev" || version == "(devel)" {
		return "dev"
	}
	if len(version) <= 64 && usageVersionPattern.MatchString(version) {
		return version
	}
	return "unknown"
}

func reportUsage(ctx context.Context, client *http.Client, endpoint, path, source, cliVersion string, now time.Time) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	lock := flock.New(path + ".lock")
	locked, err := lock.TryLockContext(ctx, 25*time.Millisecond)
	if err != nil || !locked {
		return err
	}
	defer func() { _ = lock.Unlock() }()
	_ = os.Chmod(path+".lock", 0o600)

	state, err := readUsageState(path)
	if err != nil {
		return err // Do not reset a damaged identifier and inflate install counts.
	}
	day := now.UTC().Format(time.DateOnly)
	source = clientinfo.Normalize(source)
	cliVersion = normalizeUsageVersion(cliVersion)
	if state.Sources == nil {
		state.Sources = make(map[string]usageSourceState)
	}
	activity := state.Sources[source]
	if activity.LastSentDay == day && activity.LastSentVersion == cliVersion {
		return nil
	}
	// Failed/offline attempts may retry on a later polish, at most hourly.
	if activity.LastAttemptVersion == cliVersion && activity.LastAttempt.UTC().Format(time.DateOnly) == day && now.Sub(activity.LastAttempt) < time.Hour {
		return nil
	}
	activity.LastAttempt = now.UTC()
	activity.LastAttemptVersion = cliVersion
	state.Sources[source] = activity
	if err := saveUsageState(path, state); err != nil {
		return err
	}
	// Explicit allowlist: never serialize local productivity records or config.
	body, err := json.Marshal(struct {
		InstallationID string `json:"installation_id"`
		Event          string `json:"event"`
		Source         string `json:"source"`
		CLIVersion     string `json:"cli_version"`
	}{state.InstallationID, "polish_started", source, cliVersion})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "git-ai-usage")
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("usage service returned status %d", resp.StatusCode)
	}
	activity.LastSentDay = day
	activity.LastSentVersion = cliVersion
	state.Sources[source] = activity
	return saveUsageState(path, state)
}

func readUsageState(path string) (usageState, error) {
	var state usageState
	info, err := os.Lstat(path)
	if os.IsNotExist(err) {
		id := make([]byte, 16)
		if _, err := rand.Read(id); err != nil {
			return state, err
		}
		state.InstallationID = hex.EncodeToString(id)
		return state, nil
	}
	if err != nil {
		return state, err
	}
	if !info.Mode().IsRegular() || info.Size() > maxUsageStateBytes {
		return state, errors.New("invalid usage state file")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return state, err
	}
	if err := json.Unmarshal(data, &state); err != nil {
		return state, err
	}
	id, err := hex.DecodeString(state.InstallationID)
	if err != nil || len(id) != 16 || state.InstallationID != hex.EncodeToString(id) {
		return state, errors.New("invalid usage installation id")
	}
	return state, nil
}

func saveUsageState(path string, state usageState) error {
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	return writeAtomic(path, append(data, '\n'))
}
