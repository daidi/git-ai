package telemetry

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Record represents a single item in the telemetry log.
type Record struct {
	Timestamp            string `json:"timestamp"`
	Repo                 string `json:"repo"`
	Model                string `json:"model"`
	TimeWaitedMs         int64  `json:"time_waited_ms"`
	OriginalMsgLen       int    `json:"original_msg_len"`
	NewMsgLen            int    `json:"new_msg_len"`
	EstimatedTimeSavedS  int    `json:"estimated_time_saved_s"`
}

// Stats holds the in-memory/serializable representation of all records.
type Stats struct {
	Records []Record `json:"records"`
}

var (
	mutex sync.Mutex
)

// saveDir returns the directory where telemetry is stored.
func saveDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".git-ai")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

// telemetryPath returns the path to the telemetry.json file.
func telemetryPath() (string, error) {
	dir, err := saveDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "telemetry.json"), nil
}

// Load reads all telemetry records from disk.
func Load() (*Stats, error) {
	path, err := telemetryPath()
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &Stats{Records: make([]Record, 0)}, nil
		}
		return nil, err
	}

	var stats Stats
	if len(data) > 0 {
		if err := json.Unmarshal(data, &stats); err != nil {
			return nil, err
		}
	}
	
	if stats.Records == nil {
		stats.Records = make([]Record, 0)
	}

	return &stats, nil
}

// SaveRecord adds a new record thread-safely and writes to disk.
func SaveRecord(r Record) error {
	mutex.Lock()
	defer mutex.Unlock()

	stats, err := Load()
	if err != nil {
		// If corrupted, fallback to clean state instead of crashing daemon
		stats = &Stats{Records: make([]Record, 0)}
	}

	if r.Timestamp == "" {
		r.Timestamp = time.Now().Format(time.RFC3339)
	}
	
	// Assume 2 minutes average time saved per commit logic matching plan
	if r.EstimatedTimeSavedS == 0 {
		r.EstimatedTimeSavedS = 120
	}

	stats.Records = append(stats.Records, r)

	data, err := json.MarshalIndent(stats, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal telemetry: %w", err)
	}

	path, err := telemetryPath()
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0o644)
}
