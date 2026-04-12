package ai

import "fmt"

// Format represents a commit message format.
type Format string

const (
	FormatPlain        Format = "plain"
	FormatConventional Format = "conventional"
	FormatGitmoji      Format = "gitmoji"
	FormatSubjectBody  Format = "subject-body"
)

// SystemPrompt returns the format-specific system prompt for the LLM.
func SystemPrompt(format Format, language string, explain bool, commitlintConfig string) string {
	langInstruction := fmt.Sprintf("Write the commit message in %s.", languageName(language))

	var base string

	switch format {
	case FormatPlain:
		lineRule := "- Keep it on a single line."
		if explain {
			lineRule = "- Maximum 72 characters for the first line."
		}
		base = fmt.Sprintf(`You are a Git commit message expert. Rewrite the given commit message to be clear, concise, and descriptive.

Rules:
- Output ONLY the commit message, nothing else.
%s
- Do not use any prefix like "feat:", "fix:", etc.
- Do not use emoji.
- Use imperative mood (e.g., "Add feature" not "Added feature").
%s`, lineRule, langInstruction)

	case FormatConventional:
		base = fmt.Sprintf(`You are a Git commit message expert following the Conventional Commits specification.

Rules:
- Output ONLY the commit message, nothing else.
- Format: <type>(<scope>): <description>
- Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Scope is optional but recommended.
- Description must use imperative mood.
- Description must be lowercase (except proper nouns).
- No period at the end.
- Maximum 72 characters for the first line.
%s`, langInstruction)

	case FormatGitmoji:
		base = fmt.Sprintf(`You are a Git commit message expert using the Gitmoji + Conventional Commits format.

Rules:
- Output ONLY the commit message, nothing else.
- Format: <emoji> <type>(<scope>): <description>
- Start with ONE appropriate gitmoji emoji.
- Common mappings: ✨=feat, 🐛=fix, 📝=docs, ♻️=refactor, ⚡️=perf, 🔧=chore, ✅=test, 🚀=deploy, 🎨=style, 🔥=remove, 🏗️=build, 💥=breaking
- Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- Scope is optional but recommended.
- Description must use imperative mood.
- No period at the end.
- Maximum 72 characters for the first line (excluding emoji).
%s`, langInstruction)

	case FormatSubjectBody:
		base = fmt.Sprintf(`You are a Git commit message expert using the subject+body format.

Rules:
- Output the commit message in two parts separated by a blank line.
- Line 1: Subject line — concise summary, imperative mood, max 50 characters.
- Line 2: Empty line.
- Lines 3+: Body — explain WHAT changed and WHY (not HOW). Wrap at 72 characters.
- The body should be 2-4 sentences providing meaningful context from the diff.
- Do NOT output anything other than the commit message.
%s`, langInstruction)

	default:
		// Fallback to conventional.
		base = SystemPrompt(FormatConventional, language, false, "")
	}

	if explain {
		base += "\n\nIMPORTANT: You MUST append a short paragraph at the end of the message explaining 'WHY' these changes were made and what problem they solve."
	}

	if commitlintConfig != "" {
		base += fmt.Sprintf("\n\nThis project uses commitlint. You MUST ensure the generated commit respects the following JSON configuration rules:\n```json\n%s\n```", commitlintConfig)
	}

	return base
}

// UserPrompt builds the user prompt with the original message and diff.
func UserPrompt(originalMsg, diff string) string {
	return fmt.Sprintf(`User's original commit message (might be meaningless / just a hint): "%s"

Diff:
%s`, originalMsg, diff)
}

// languageName maps language codes to natural names for the LLM.
func languageName(code string) string {
	switch code {
	case "zh-CN", "zh":
		return "Chinese (Simplified)"
	case "zh-TW":
		return "Chinese (Traditional)"
	case "ja":
		return "Japanese"
	case "ko":
		return "Korean"
	case "es":
		return "Spanish"
	case "fr":
		return "French"
	case "de":
		return "German"
	case "pt":
		return "Portuguese"
	case "ru":
		return "Russian"
	default:
		return "English"
	}
}

// ValidFormats returns all valid message format names.
func ValidFormats() []Format {
	return []Format{FormatPlain, FormatConventional, FormatGitmoji, FormatSubjectBody}
}
