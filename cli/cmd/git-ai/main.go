// Package main is the entry point for the git-ai CLI.
package main

import (
	"os"

	"github.com/daidi/git-ai/internal/cmd"
)

// version is set at build time via ldflags.
var version = "dev"

func main() {
	cmd.SetVersion(version)
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
