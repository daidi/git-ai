package eval

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/daidi/git-ai/cli/internal/ai"
)

type Mode string

const (
	ModeReference Mode = "reference"
	ModeOriginal  Mode = "original"
	ModeLive      Mode = "live"
)

type Generator func(ctx context.Context, item Case) (string, error)

type Metric struct {
	Passed int     `json:"passed"`
	Total  int     `json:"total"`
	Rate   float64 `json:"rate"`
}

type Checks struct {
	FormatValid         bool `json:"format_valid"`
	TrailersApplicable  bool `json:"trailers_applicable"`
	TrailersPreserved   bool `json:"trailers_preserved"`
	TypeApplicable      bool `json:"type_applicable"`
	ExpectedTypeMatched bool `json:"expected_type_matched"`
	SemanticMatched     int  `json:"semantic_matched"`
	SemanticTotal       int  `json:"semantic_total"`
	DiffBudgetValid     bool `json:"diff_budget_valid"`
	DiffContextMatched  int  `json:"diff_context_matched"`
	DiffContextTotal    int  `json:"diff_context_total"`
	PassedChecks        int  `json:"passed_checks"`
	TotalChecks         int  `json:"total_checks"`
}

type CaseResult struct {
	ID         string  `json:"id"`
	Source     Source  `json:"source"`
	Candidate  string  `json:"candidate,omitempty"`
	Error      string  `json:"error,omitempty"`
	DurationMs int64   `json:"duration_ms"`
	Checks     Checks  `json:"checks"`
	Score      float64 `json:"score"`
	Passed     bool    `json:"passed"`
}

type Summary struct {
	Cases           int    `json:"cases"`
	Generation      Metric `json:"generation"`
	Format          Metric `json:"format"`
	Trailers        Metric `json:"trailers"`
	ExpectedType    Metric `json:"expected_type"`
	Semantic        Metric `json:"semantic"`
	DiffBudget      Metric `json:"diff_budget"`
	DiffContext     Metric `json:"diff_context"`
	Overall         Metric `json:"overall"`
	PassingCases    Metric `json:"passing_cases"`
	MedianLatencyMs int64  `json:"median_latency_ms"`
	P95LatencyMs    int64  `json:"p95_latency_ms"`
}

type Report struct {
	Dataset  string       `json:"dataset"`
	Mode     Mode         `json:"mode"`
	Provider string       `json:"provider,omitempty"`
	Model    string       `json:"model,omitempty"`
	Results  []CaseResult `json:"results"`
	Summary  Summary      `json:"summary"`
}

func ParseMode(value string) (Mode, error) {
	mode := Mode(strings.ToLower(strings.TrimSpace(value)))
	switch mode {
	case ModeReference, ModeOriginal, ModeLive:
		return mode, nil
	default:
		return "", fmt.Errorf("unknown evaluation mode %q", value)
	}
}

// Run evaluates reference messages, original hints, or live generated output
// through one scoring path so offline regressions and provider comparisons use
// identical metrics.
func Run(ctx context.Context, dataset Dataset, mode Mode, generator Generator) (Report, error) {
	if err := ValidateDataset(dataset); err != nil {
		return Report{}, err
	}
	if _, err := ParseMode(string(mode)); err != nil {
		return Report{}, err
	}
	if mode == ModeLive && generator == nil {
		return Report{}, errors.New("live evaluation requires a generator")
	}

	report := Report{Dataset: dataset.Name, Mode: mode, Results: make([]CaseResult, 0, len(dataset.Cases))}
	var latencies []int64
	for _, item := range dataset.Cases {
		candidate, duration, generationErr := candidateForCase(ctx, mode, item, generator)
		checks := assessCase(item, candidate)
		result := CaseResult{
			ID: item.ID, Source: item.Source, Candidate: candidate,
			DurationMs: duration.Milliseconds(), Checks: checks,
			Score: percentage(checks.PassedChecks, checks.TotalChecks),
		}
		if generationErr != nil {
			result.Error = generationErr.Error()
		}
		result.Passed = generationErr == nil && checks.PassedChecks == checks.TotalChecks
		report.Results = append(report.Results, result)
		if mode == ModeLive && duration > 0 {
			latencies = append(latencies, duration.Milliseconds())
		}
	}
	report.Summary = summarize(report.Results, latencies)
	return report, nil
}

func candidateForCase(ctx context.Context, mode Mode, item Case, generator Generator) (string, time.Duration, error) {
	switch mode {
	case ModeReference:
		return item.ReferenceMessage, 0, nil
	case ModeOriginal:
		return item.OriginalMessage, 0, nil
	case ModeLive:
		if err := ctx.Err(); err != nil {
			return "", 0, err
		}
		start := time.Now()
		candidate, err := generator(ctx, item)
		return candidate, time.Since(start), err
	default:
		return "", 0, errors.New("unsupported evaluation mode")
	}
}

func assessCase(item Case, candidate string) Checks {
	checks := Checks{}
	content := ai.CommitMessageContent(candidate)
	checks.FormatValid = ai.MatchesMessageFormat(content, ai.Format(item.Format), item.Explain)
	checks.add(checks.FormatValid)

	checks.TrailersApplicable = ai.HasCommitTrailers(item.OriginalMessage)
	if checks.TrailersApplicable {
		checks.TrailersPreserved = ai.PreservesCommitTrailers(candidate, item.OriginalMessage)
		checks.add(checks.TrailersPreserved)
	}

	checks.TypeApplicable = len(item.ExpectedTypes) > 0
	if checks.TypeApplicable {
		candidateType := commitType(content)
		for _, expectedType := range item.ExpectedTypes {
			if candidateType == expectedType {
				checks.ExpectedTypeMatched = true
				break
			}
		}
		checks.add(checks.ExpectedTypeMatched)
	}

	normalized := strings.ToLower(candidate)
	for _, alternatives := range item.RequiredConcepts {
		matched := false
		for _, term := range alternatives {
			if strings.Contains(normalized, strings.ToLower(term)) {
				matched = true
				break
			}
		}
		checks.SemanticTotal++
		if matched {
			checks.SemanticMatched++
		}
		checks.add(matched)
	}
	for _, forbidden := range item.ForbiddenTerms {
		matched := !strings.Contains(normalized, strings.ToLower(forbidden))
		checks.SemanticTotal++
		if matched {
			checks.SemanticMatched++
		}
		checks.add(matched)
	}

	trimmedDiff := ai.TrimDiff(item.Diff, item.MaxDiffTokens)
	checks.DiffBudgetValid = len(trimmedDiff) <= item.MaxDiffTokens*4
	checks.add(checks.DiffBudgetValid)
	for _, requiredPath := range item.RequiredDiffPaths {
		matched := strings.Contains(trimmedDiff, requiredPath)
		checks.DiffContextTotal++
		if matched {
			checks.DiffContextMatched++
		}
		checks.add(matched)
	}
	for _, requiredTerm := range item.RequiredDiffTerms {
		matched := strings.Contains(trimmedDiff, requiredTerm)
		checks.DiffContextTotal++
		if matched {
			checks.DiffContextMatched++
		}
		checks.add(matched)
	}
	return checks
}

func (checks *Checks) add(passed bool) {
	checks.TotalChecks++
	if passed {
		checks.PassedChecks++
	}
}

func commitType(message string) string {
	subject, _, _ := strings.Cut(strings.TrimSpace(message), "\n")
	if prefix, remainder, found := strings.Cut(subject, " "); found && strings.ContainsAny(prefix, "✨🐛📝♻️⚡🔧✅🚀🎨🔥🏗️💥") {
		subject = remainder
	}
	prefix, _, found := strings.Cut(subject, ":")
	if !found {
		return ""
	}
	if index := strings.IndexByte(prefix, '('); index >= 0 {
		prefix = prefix[:index]
	}
	return strings.TrimSuffix(strings.ToLower(strings.TrimSpace(prefix)), "!")
}

func summarize(results []CaseResult, latencies []int64) Summary {
	summary := Summary{Cases: len(results)}
	for _, result := range results {
		summary.Generation.add(result.Error == "")
		summary.Format.add(result.Checks.FormatValid)
		if result.Checks.TrailersApplicable {
			summary.Trailers.add(result.Checks.TrailersPreserved)
		}
		if result.Checks.TypeApplicable {
			summary.ExpectedType.add(result.Checks.ExpectedTypeMatched)
		}
		summary.Semantic.addCounts(result.Checks.SemanticMatched, result.Checks.SemanticTotal)
		summary.DiffBudget.add(result.Checks.DiffBudgetValid)
		summary.DiffContext.addCounts(result.Checks.DiffContextMatched, result.Checks.DiffContextTotal)
		summary.Overall.addCounts(result.Checks.PassedChecks, result.Checks.TotalChecks)
		summary.PassingCases.add(result.Passed)
	}
	for _, metric := range []*Metric{
		&summary.Generation, &summary.Format, &summary.Trailers, &summary.ExpectedType,
		&summary.Semantic, &summary.DiffBudget, &summary.DiffContext, &summary.Overall, &summary.PassingCases,
	} {
		metric.Rate = percentage(metric.Passed, metric.Total)
	}
	if len(latencies) > 0 {
		sort.Slice(latencies, func(left, right int) bool { return latencies[left] < latencies[right] })
		summary.MedianLatencyMs = percentile(latencies, 0.50)
		summary.P95LatencyMs = percentile(latencies, 0.95)
	}
	return summary
}

func (metric *Metric) add(passed bool) {
	metric.Total++
	if passed {
		metric.Passed++
	}
}

func (metric *Metric) addCounts(passed, total int) {
	metric.Passed += passed
	metric.Total += total
}

func percentage(passed, total int) float64 {
	if total == 0 {
		return 0
	}
	return float64(passed) * 100 / float64(total)
}

func percentile(sorted []int64, quantile float64) int64 {
	if len(sorted) == 0 {
		return 0
	}
	if quantile <= 0 {
		return sorted[0]
	}
	if quantile >= 1 {
		return sorted[len(sorted)-1]
	}
	// Nearest-rank percentile: the p95 of five samples is the slowest
	// sample, not the fourth, which keeps small live runs honest.
	index := int(math.Ceil(float64(len(sorted))*quantile)) - 1
	return sorted[index]
}
