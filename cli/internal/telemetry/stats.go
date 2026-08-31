package telemetry

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gofrs/flock"

	"github.com/daidi/git-ai/cli/internal/config"
)

const (
	maxRecords            = 1_000
	maxTelemetryFileBytes = 16 << 20
)

// Record represents a single item in the local telemetry log.
type Record struct {
	Timestamp           string `json:"timestamp"`
	Repo                string `json:"repo"`
	Model               string `json:"model"`
	TimeWaitedMs        int64  `json:"time_waited_ms"`
	OriginalMsgLen      int    `json:"original_msg_len"`
	NewMsgLen           int    `json:"new_msg_len"`
	EstimatedTimeSavedS int    `json:"estimated_time_saved_s"`
}

type Stats struct {
	Records []Record `json:"records"`
}

var mutex sync.Mutex

func telemetryPath() string {
	return filepath.Join(filepath.Dir(config.GlobalConfigPath()), "telemetry.json")
}

func legacyTelemetryPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".git-ai", "telemetry.json")
}

// Load reads an atomic telemetry snapshot from the OS application directory.
func Load() (*Stats, error) {
	path := telemetryPath()
	if info, statErr := os.Stat(path); statErr == nil && (!info.Mode().IsRegular() || info.Size() > maxTelemetryFileBytes) {
		return nil, fmt.Errorf("telemetry file exceeded the safety limit")
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) && os.Getenv("GIT_AI_CONFIG_DIR") == "" {
		// Preserve statistics from releases <= 1.1.4. The next SaveRecord writes
		// them to the OS-native application directory.
		legacyPath := legacyTelemetryPath()
		if info, statErr := os.Stat(legacyPath); statErr == nil && (!info.Mode().IsRegular() || info.Size() > maxTelemetryFileBytes) {
			return nil, fmt.Errorf("legacy telemetry file exceeded the safety limit")
		}
		data, err = os.ReadFile(legacyPath)
	}
	if err != nil {
		if os.IsNotExist(err) {
			return &Stats{Records: make([]Record, 0)}, nil
		}
		return nil, err
	}
	var stats Stats
	if len(data) > 0 {
		if err := json.Unmarshal(data, &stats); err != nil {
			return nil, fmt.Errorf("parse telemetry: %w", err)
		}
	}
	if stats.Records == nil {
		stats.Records = make([]Record, 0)
	}
	if len(stats.Records) > maxRecords {
		stats.Records = stats.Records[len(stats.Records)-maxRecords:]
	}
	return &stats, nil
}

// SaveRecord serializes writers across threads and detached CLI processes.
func SaveRecord(record Record) error {
	mutex.Lock()
	defer mutex.Unlock()

	path := telemetryPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	lockPath := path + ".lock"
	fileLock := flock.New(lockPath)
	if err := fileLock.Lock(); err != nil {
		return err
	}
	defer func() { _ = fileLock.Unlock() }()
	_ = os.Chmod(lockPath, 0o600)

	stats, err := Load()
	if err != nil {
		// Never destroy a corrupt or partially user-recovered telemetry file.
		return err
	}
	if record.Timestamp == "" {
		record.Timestamp = time.Now().Format(time.RFC3339)
	}
	if record.EstimatedTimeSavedS == 0 {
		record.EstimatedTimeSavedS = 120
	}
	stats.Records = append(stats.Records, record)
	if len(stats.Records) > maxRecords {
		stats.Records = stats.Records[len(stats.Records)-maxRecords:]
	}

	data, err := json.MarshalIndent(stats, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal telemetry: %w", err)
	}
	data = append(data, '\n')
	return writeAtomic(path, data)
}

func writeAtomic(path string, data []byte) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".telemetry-*.tmp")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer func() { _ = tmp.Close(); _ = os.Remove(tmpPath) }()
	if err := tmp.Chmod(0o600); err != nil {
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		return err
	}
	if err := tmp.Sync(); err != nil {
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpPath, path)
}
