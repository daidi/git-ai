# Changelog

## 1.4.2

- Aligned VS Code and JetBrains CLI health checks and recovery: selected version/path, retry, manual update check, and explicit installation.
- Reject legacy CLI help output and malformed settings without exposing response contents or overwriting configuration with defaults.
- Check local protocol compatibility even when update checks are disabled; cache successful release checks for 24 hours and failures for 15 minutes, with manual bypass.
- Protect unsaved drafts, prevent concurrent installation/saves, and retain Restricted Mode safeguards.
- Match Windows Git and editor paths correctly when selecting a nested repository; run VS Code tests on Windows, macOS, and Linux.
- Synchronize recovery labels across all 16 UI languages and gate both plugin releases on tests, packaging, and JetBrains compatibility verification.
- Release the CLI and both IDE plugins together as 1.4.2; rebuild the CLI with Go 1.26.9 to address the standard-library vulnerabilities detected by the release scan.

## 1.4.1

- Fixed the JetBrains plugin's deprecated `DynamicBundle` constructor usage while retaining IntelliJ IDEA 2024.1 compatibility.
- Synchronized the release version across the CLI and IDE integrations.

## 1.4.0

- Added optional commit attribution, disabled by default: append a single `Polished-by` trailer with the Git AI download link after successful polishing, while preserving original metadata and undo behavior.
- Added CLI-owned configuration schemas, model discovery, and multi-repository selection in both IDE integrations.
- Improved diff prioritization, generated-message validation, trailer preservation, and static commitlint-rule handling, with an offline evaluation harness.
- Fixed first-time project settings saves when no Git AI configuration section exists.
- Expanded localized settings and documentation to all 15 supported translations.

## 1.3.1

- Fixed the JetBrains settings page appearing blank when Swing had not initialized a card's accessibility context.
- Hardened JetBrains UI DSL comments and added a regression test that constructs the complete settings surface on the event dispatch thread.

## 1.3.0

- Added Smart Skip to keep already-valid, non-repeated commit messages without an unnecessary AI request.
- Redesigned the VS Code and JetBrains settings experiences with clearer hierarchy, richer feedback, and polished interactive states.
- Added automatic CLI compatibility recovery when an IDE plugin finds an older settings protocol.
- Refreshed both Marketplace listings with clearer onboarding, feature discovery, and search-friendly documentation.
- Expanded regression coverage and kept all 14 localized settings experiences in sync.

## 1.2.2

- Fixed IntelliJ signature verification by using temporary certificate and key files outside the checkout.
- Corrected the Marketplace links bundled in the IDE plugin descriptions.

## 1.2.1

- Fixed version reporting for CLI binaries installed with `go install`.
- Fixed the Gradle 9 dependency between IntelliJ plugin signing and signature verification.

## 1.2.0

- Moved runtime state, logs, and user configuration out of project worktrees.
- Made the CLI the sole persistence writer for both IDE integrations.
- Added safe, actionable handling for network, model, daemon, and push failures.
- Hardened CLI installation with pinned releases, size limits, and checksum verification.
- Prevented extension commands and downloads in untrusted workspaces.
- Fixed Codicons packaging and bounded all CLI polling/process output.

## 1.1.5

- Added localized failure notifications and translation coverage tooling.
