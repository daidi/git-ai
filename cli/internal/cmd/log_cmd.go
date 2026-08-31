package cmd

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	"github.com/daidi/git-ai/cli/internal/git"
	"github.com/daidi/git-ai/cli/internal/state"
)

type commitLog struct {
	SHA     string          `json:"sha"`
	Message string          `json:"message"`
	AINote  json.RawMessage `json:"ai_note,omitempty"` // External history, with read-only legacy-note fallback.
}

var logCmd = &cobra.Command{
	Use:   "log",
	Short: "Show git log with AI metadata attached",
	RunE: func(cmd *cobra.Command, args []string) error {
		historyBySHA := make(map[string]state.HistoryRecord)
		if gitDir, gitErr := git.GetGitDir(); gitErr == nil {
			if history, historyErr := state.NewManager(gitDir).LoadHistory(); historyErr == nil {
				for _, record := range history.Records {
					historyBySHA[record.SHA] = record
				}
			}
		}
		// Get last 50 commits
		shasOut, err := git.GetRecentCommitSHAs(50)
		if err != nil {
			return err
		}

		shas := strings.Split(strings.TrimSpace(shasOut), "\n")
		var logs []commitLog

		for _, sha := range shas {
			if sha == "" {
				continue
			}

			// Get the message (subject + body)
			message, err := git.GetCommitMsg(sha)
			if err != nil {
				continue
			}

			cLog := commitLog{
				SHA:     sha,
				Message: message,
			}

			if record, ok := historyBySHA[sha]; ok {
				if encoded, marshalErr := json.Marshal(record); marshalErr == nil {
					cLog.AINote = json.RawMessage(encoded)
				}
			} else {
				// Read legacy notes created by releases <= 1.1.5, but never write
				// new repository metadata.
				noteOut, noteErr := git.GetLegacyAINote(sha)
				if noteErr == nil && noteOut != "" {
					noteStr := strings.TrimSpace(noteOut)
					if json.Valid([]byte(noteStr)) {
						cLog.AINote = json.RawMessage(noteStr)
					}
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
