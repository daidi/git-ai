// Package main is the entry point for the git-ai CLI.
package main

import (
	"os"

	"github.com/daidi/git-ai/internal/cmd"
)

func main() {
	err := cmd.Execute()
	cmd.PostExecuteUpdateCheck()
	
	if err != nil {
		cmd.Errorf("%v\n", err)
		os.Exit(1)
	}
}
