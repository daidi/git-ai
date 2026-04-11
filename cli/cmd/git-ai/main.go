// Package main is the entry point for the git-ai CLI.
package main

import (
	"os"

	"github.com/daidi/git-ai/internal/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		cmd.Errorf("%v\n", err)
		os.Exit(1)
	}
}
