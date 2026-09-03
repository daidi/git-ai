// git-ai-eval is a maintainer tool for repeatable commit-message quality
// measurements. It is intentionally separate from the end-user git-ai CLI.
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"math"
	"os"
	"path/filepath"
	"time"

	"github.com/daidi/git-ai/cli/internal/ai"
	"github.com/daidi/git-ai/cli/internal/config"
	evaluation "github.com/daidi/git-ai/cli/internal/eval"
)

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr io.Writer) int {
	flags := flag.NewFlagSet("git-ai-eval", flag.ContinueOnError)
	flags.SetOutput(stderr)
	datasetPath := flags.String("dataset", "", "custom dataset manifest (default: embedded real commits)")
	modeValue := flags.String("mode", string(evaluation.ModeReference), "candidate source: reference, original, or live")
	jsonOutput := flags.Bool("json", false, "write the complete report as JSON")
	failUnder := flags.Float64("fail-under", 0, "exit non-zero when overall score is below this percentage")
	timeout := flags.Duration("timeout", 10*time.Minute, "overall live-evaluation timeout")
	repoRoot := flags.String("repo-root", ".", "repository used for model configuration and commitlint context")
	if err := flags.Parse(args); err != nil {
		return 2
	}
	if flags.NArg() != 0 {
		_, _ = fmt.Fprintln(stderr, "error: unexpected positional arguments")
		return 2
	}
	if math.IsNaN(*failUnder) || math.IsInf(*failUnder, 0) || *failUnder < 0 || *failUnder > 100 {
		_, _ = fmt.Fprintln(stderr, "error: --fail-under must be between 0 and 100")
		return 2
	}
	if *timeout <= 0 {
		_, _ = fmt.Fprintln(stderr, "error: --timeout must be positive")
		return 2
	}

	mode, err := evaluation.ParseMode(*modeValue)
	if err != nil {
		_, _ = fmt.Fprintf(stderr, "error: %v\n", err)
		return 2
	}
	dataset, err := loadDataset(*datasetPath)
	if err != nil {
		_, _ = fmt.Fprintf(stderr, "error: %v\n", err)
		return 1
	}

	root, err := filepath.Abs(*repoRoot)
	if err != nil {
		_, _ = fmt.Fprintf(stderr, "error: resolve repository root: %v\n", err)
		return 1
	}
	var generator evaluation.Generator
	var providerName, modelName string
	if mode == evaluation.ModeLive {
		cfg, loadErr := config.Load(root)
		if loadErr != nil {
			_, _ = fmt.Fprintf(stderr, "error: load model configuration: %v\n", loadErr)
			return 1
		}
		logger := log.New(stderr, "[eval] ", log.LstdFlags)
		providerName = cfg.Provider
		modelName = cfg.Model
		generator = func(ctx context.Context, item evaluation.Case) (string, error) {
			caseConfig := *cfg
			caseConfig.MessageFormat = item.Format
			caseConfig.MaxDiffTokens = item.MaxDiffTokens
			if item.Language != "" {
				caseConfig.Language = item.Language
			}
			explain := item.Explain
			caseConfig.Explain = &explain
			return ai.PolishWithLoggerContext(ctx, item.Diff, item.OriginalMessage, root, &caseConfig, logger)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()
	report, err := evaluation.Run(ctx, dataset, mode, generator)
	if err != nil {
		_, _ = fmt.Fprintf(stderr, "error: run evaluation: %v\n", err)
		return 1
	}
	report.Provider = providerName
	report.Model = modelName
	if *jsonOutput {
		err = evaluation.WriteJSON(stdout, report)
	} else {
		err = evaluation.WriteText(stdout, report)
	}
	if err != nil {
		_, _ = fmt.Fprintf(stderr, "error: write report: %v\n", err)
		return 1
	}
	if report.Summary.Generation.Passed != report.Summary.Generation.Total {
		return 1
	}
	if report.Summary.Overall.Rate+1e-9 < *failUnder {
		_, _ = fmt.Fprintf(stderr, "score %.1f%% is below required %.1f%%\n", report.Summary.Overall.Rate, *failUnder)
		return 1
	}
	return 0
}

func loadDataset(filename string) (evaluation.Dataset, error) {
	if filename == "" {
		return evaluation.LoadDefault()
	}
	return evaluation.LoadFile(filename)
}
