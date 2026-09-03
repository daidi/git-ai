package eval

import (
	"encoding/json"
	"fmt"
	"io"
	"text/tabwriter"
)

func WriteJSON(writer io.Writer, report Report) error {
	encoder := json.NewEncoder(writer)
	encoder.SetIndent("", "  ")
	return encoder.Encode(report)
}

func WriteText(writer io.Writer, report Report) error {
	if _, err := fmt.Fprintf(writer, "Dataset: %s\nMode: %s\n", report.Dataset, report.Mode); err != nil {
		return err
	}
	if report.Provider != "" || report.Model != "" {
		if _, err := fmt.Fprintf(writer, "Provider: %s\nModel: %s\n", report.Provider, report.Model); err != nil {
			return err
		}
	}
	if _, err := fmt.Fprintln(writer); err != nil {
		return err
	}
	table := tabwriter.NewWriter(writer, 0, 4, 2, ' ', 0)
	if _, err := fmt.Fprintln(table, "CASE\tFORMAT\tTRAILERS\tTYPE\tSEMANTIC\tDIFF\tSCORE\tLATENCY"); err != nil {
		return err
	}
	for _, result := range report.Results {
		trailers := "-"
		if result.Checks.TrailersApplicable {
			trailers = mark(result.Checks.TrailersPreserved)
		}
		expectedType := "-"
		if result.Checks.TypeApplicable {
			expectedType = mark(result.Checks.ExpectedTypeMatched)
		}
		diff := fmt.Sprintf("%s %d/%d", mark(result.Checks.DiffBudgetValid), result.Checks.DiffContextMatched, result.Checks.DiffContextTotal)
		latency := "-"
		if result.DurationMs > 0 {
			latency = fmt.Sprintf("%dms", result.DurationMs)
		}
		if _, err := fmt.Fprintf(table, "%s\t%s\t%s\t%s\t%d/%d\t%s\t%.1f%%\t%s\n",
			result.ID, mark(result.Checks.FormatValid), trailers, expectedType,
			result.Checks.SemanticMatched, result.Checks.SemanticTotal, diff, result.Score, latency); err != nil {
			return err
		}
		if result.Error != "" {
			if _, err := fmt.Fprintf(table, "  error: %s\n", result.Error); err != nil {
				return err
			}
		}
	}
	if err := table.Flush(); err != nil {
		return err
	}

	summary := report.Summary
	_, err := fmt.Fprintf(writer,
		"\nOverall: %.1f%% (%d/%d checks), passing cases: %.1f%% (%d/%d)\n"+
			"Format %.1f%% · Trailers %.1f%% · Type %.1f%% · Semantics %.1f%% · Diff budget %.1f%% · Diff context %.1f%%\n",
		summary.Overall.Rate, summary.Overall.Passed, summary.Overall.Total,
		summary.PassingCases.Rate, summary.PassingCases.Passed, summary.PassingCases.Total,
		summary.Format.Rate, summary.Trailers.Rate, summary.ExpectedType.Rate,
		summary.Semantic.Rate, summary.DiffBudget.Rate, summary.DiffContext.Rate,
	)
	if err != nil {
		return err
	}
	if report.Mode == ModeLive {
		_, err = fmt.Fprintf(writer, "Generation %.1f%% · p50 %dms · p95 %dms\n",
			summary.Generation.Rate, summary.MedianLatencyMs, summary.P95LatencyMs)
	}
	return err
}

func mark(value bool) string {
	if value {
		return "ok"
	}
	return "fail"
}
