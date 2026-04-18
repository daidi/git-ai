package cmd

import (
	"bytes"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

var internalSequenceEditorCmd = &cobra.Command{
	Use:    "internal-sequence-editor <file>",
	Hidden: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		if len(args) < 1 {
			return fmt.Errorf("missing file argument")
		}
		file := args[0]
		data, err := os.ReadFile(file)
		if err != nil {
			return err
		}

		lines := strings.Split(string(data), "\n")
		var out bytes.Buffer
		for _, line := range lines {
			if strings.HasPrefix(line, "pick ") && strings.Contains(line, "[⏳]") {
				out.WriteString(strings.Replace(line, "pick ", "reword ", 1))
				out.WriteString("\n")
			} else {
				out.WriteString(line)
				out.WriteString("\n")
			}
		}

		return os.WriteFile(file, []byte(strings.TrimSuffix(out.String(), "\n")), 0644)
	},
}

var internalCommitEditorCmd = &cobra.Command{
	Use:    "internal-commit-editor <file>",
	Hidden: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		if len(args) < 1 {
			return fmt.Errorf("missing file argument")
		}
		file := args[0]
		data, err := os.ReadFile(file)
		if err != nil {
			return err
		}

		msg := string(data)
		msg = strings.ReplaceAll(msg, "[⏳] ", "")
		msg = strings.ReplaceAll(msg, "[⏳]", "")

		return os.WriteFile(file, []byte(msg), 0644)
	},
}

func init() {
	rootCmd.AddCommand(internalSequenceEditorCmd)
	rootCmd.AddCommand(internalCommitEditorCmd)
}
