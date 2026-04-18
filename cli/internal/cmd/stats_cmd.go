package cmd

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/daidi/git-ai/internal/telemetry"
	"github.com/spf13/cobra"
)

var statsJSON bool

var statsCmd = &cobra.Command{
	Use:   "stats",
	Short: "Show git-ai productivity telemetry and stats",
	RunE: func(cmd *cobra.Command, args []string) error {
		stats, err := telemetry.Load()
		if err != nil {
			return fmt.Errorf("failed to load telemetry: %w", err)
		}

		if statsJSON {
			data, err := json.MarshalIndent(stats, "", "  ")
			if err != nil {
				return err
			}
			fmt.Println(string(data))
			return nil
		}

		if len(stats.Records) == 0 {
			fmt.Println("No git-ai telemetry data found yet.")
			return nil
		}

		var totalCommits int
		var totalTimeSavedS int
		var totalTimeWaitedMs int64
		models := make(map[string]int)

		t30DaysAgo := time.Now().Add(-30 * 24 * time.Hour)

		for _, r := range stats.Records {
			t, err := time.Parse(time.RFC3339, r.Timestamp)
			if err != nil {
				continue
			}
			if t.After(t30DaysAgo) {
				totalCommits++
				totalTimeSavedS += r.EstimatedTimeSavedS
				totalTimeWaitedMs += r.TimeWaitedMs
				models[r.Model]++
			}
		}

		var bestModel string
		maxCount := 0
		for m, c := range models {
			if c > maxCount {
				bestModel = m
				maxCount = c
			}
		}

		hoursSaved := float64(totalTimeSavedS) / 3600.0

		avgWaitMs := int64(0)
		if totalCommits > 0 {
			avgWaitMs = totalTimeWaitedMs / int64(totalCommits)
		}

		// Print human readable stats
		fmt.Printf("📊 Git-AI Productivity Stats (Last 30 Days)\n")
		fmt.Printf("------------------------------------------\n")
		fmt.Printf("Total Commits Polished: %d\n", totalCommits)
		fmt.Printf("Estimated Time Saved:   %.1f hours\n", hoursSaved)
		fmt.Printf("Average Time Waited:    %v\n", time.Duration(avgWaitMs)*time.Millisecond)
		if bestModel != "" {
			fmt.Printf("Most Used Model:        %s (%d uses)\n", bestModel, maxCount)
		}

		return nil
	},
}

func init() {
	statsCmd.Flags().BoolVar(&statsJSON, "json", false, "Output telemetry in JSON format")
	rootCmd.AddCommand(statsCmd)
}
