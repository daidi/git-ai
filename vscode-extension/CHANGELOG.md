# Changelog

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
