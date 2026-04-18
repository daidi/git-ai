package cmd

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"

	"github.com/spf13/cobra"
)

type commitLog struct {
	SHA     string          `json:"sha"`
	Message string          `json:"message"`
	AINote  json.RawMessage `json:"ai_note,omitempty"` // The JSON metadata stored in refs/notes/git-ai
}

var logCmd = &cobra.Command{
	Use:   "log",
	Short: "Show git log with AI metadata attached",
	RunE: func(cmd *cobra.Command, args []string) error {
		// Get last 50 commits
		shasOut, err := exec.Command("git", "log", "-n", "50", "--format=%H").Output()
		if err != nil {
			return err
		}

		shas := strings.Split(strings.TrimSpace(string(shasOut)), "\n")
		var logs []commitLog

		for _, sha := range shas {
			if sha == "" {
				continue
			}

			// Get the message (subject + body)
			msgOut, err := exec.Command("git", "show", "-s", "--format=%B", sha).Output()
			if err != nil {
				continue
			}

			cLog := commitLog{
				SHA:     sha,
				Message: strings.TrimSpace(string(msgOut)),
			}

			// Try to get the git-ai note attached to this commit
			noteOut, err := exec.Command("git", "notes", "--ref=git-ai", "show", sha).Output()
			if err == nil && len(noteOut) > 0 {
				noteStr := strings.TrimSpace(string(noteOut))
				if json.Valid([]byte(noteStr)) {
					cLog.AINote = json.RawMessage(noteStr)
				}
			}

			logs = append(logs, cLog)
		}

		// Output result as JSON array
		out, err := json.MarshalIndent(logs, "", "  ")
		if err != nil {
			return err
		}

		fmt.Println(string(out))
		return nil
	},
}

func init() {
	rootCmd.AddCommand(logCmd)
}
