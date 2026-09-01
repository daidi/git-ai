# Changelog

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
