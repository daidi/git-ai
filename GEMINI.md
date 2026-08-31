# 🤖 Gemini / AI Assistant Guide for git-ai

Welcome to the `git-ai` codebase. This document outlines the overall architecture, core workflows, and foundational design principles of the project. Always adhere to these structural rules when generating code or fixing bugs.

## 🎯 Core Paradigm: Async Commit Polishing
`git-ai` solves the "AI waiting problem" by adopting a **Commit First, Think Later** model.
Developers write a fast, raw commit message (`git commit -m "fix"`). A detached background daemon records that exact commit, communicates with the LLM, creates a replacement commit object, and atomically advances the recorded ref only if it still points to the original SHA. The developer never waits in the terminal, and newer commits or staged work can never be captured accidentally.

## 🏗️ Monorepo Architecture
The application consists of three decoupled components. IDE integrations query the CLI, and the CLI alone owns persistence:

1. **`cli/` (Go 1.26.6+)**
   - **Role:** The core engine. It acts as both the lightweight CLI interface and the background daemon.
   - **Key Logic:** Handles Git hooks (`post-commit`, `pre-push`), daemon detachment, LLM prompt engineering, operation locking, and compare-and-swap Git ref updates.
2. **`idea-plugin/` (Kotlin / IntelliJ Platform SDK V2)**
   - **Role:** Native JetBrains ecosystem integration.
   - **Key Logic:** Polls `git-ai status --json` off the UI thread. Actions and settings delegate to bounded CLI commands; the plugin never writes state or config itself.
3. **`vscode-extension/` (TypeScript)**
   - **Role:** Native VS Code ecosystem integration.
   - **Key Logic:** Polls `git-ai status --json`, integrates into the SCM title menu, and delegates settings/actions to the CLI. Restricted workspaces never execute binaries.

## 🔄 Runtime State & Repository Hygiene
The CLI stores per-worktree runtime state, logs, and AI history metadata under the operating system's user cache directory, keyed by a hash of the canonical worktree Git directory. Global configuration uses the operating system's user config directory. Repository overrides use `.git/config` (`git-ai.*`). New releases do not create Git notes.

**Never create or trust application-owned files in the worktree.** In particular, do not recreate or automatically read `.git-ai.json`, and do not recreate `.git/git-ai/state.json`. Legacy runtime state inside Git metadata may be migrated once, but worktree configuration must be ignored because it can redirect user credentials. New writes belong outside the repository. IDE plugins must use CLI commands rather than read or mutate state/config persistence directly; they may read only a bounded tail of the external log path returned by the CLI.

Runtime states are:
- **`idle`**: No active operations.
- **`polishing`**: The background daemon is currently contacting the LLM. IDEs show a loading state and enable "Cancel" actions.
- **`pushing`**: An automatic background network push is occurring (if `push_policy=queue`).
- **`failed`**: A safe, structured, retryable/non-retryable error was recorded. The original commit and workspace remain unchanged.

## ⚠️ Critical Information & Architectural Gotchas

### 1. IDE Environment Constraints (The "Ghost PATH")
IDEs launched from graphical shells (macOS Dock, Windows Explorer) run in heavily restricted environments without access to the user's full shell `$PATH` (like Brew, Cargo, Go).
- **Rule:** When generating Git hooks or invoking CLI binaries from IDEs, **always use explicit fallback paths**. Relying purely on OS `$PATH` will fail. 

### 2. Daemon Process Isolation
The `post-commit` hook must finish in milliseconds to free the developer's terminal, offloading the heavy work to a detached daemon.
- **Rule:** Cross-platform daemonization (`daemon_unix.go`, `daemon_windows.go`) must ensure the child process is fully orphaned from the terminal (e.g., `Setsid` on macOS/Linux). 
- **Rule:** The daemon *must* inherit the Git repository's actual working directory, otherwise internal `git` commands will fail.
- **Rule:** Never use a blind `git commit --amend`. Create a commit from the recorded tree/parents and use `git update-ref <ref> <new> <expected>` so a moved ref is a safe no-op.

### 3. Network and Model Failure Isolation
- **Rule:** Requests use bounded timeouts and cancellation-aware retries only for transient failures.
- **Rule:** Provider logs and persisted errors must never contain API keys, prompts, diffs, response bodies, or credential-bearing remote URLs.
- **Rule:** A network, authentication, rate-limit, model, malformed-response, or push failure must leave Git and the worktree unchanged and expose an actionable structured error.

### 4. Dynamic Binary Provisioning
We do not bundle the Go CLI binary into the IDE plugin bundles (to avoid gigantic `.vsix`/`.zip` files).
- **Rule:** IDE plugins download the matching architecture binary to `~/.git-ai/bin/`, pin one release tag, verify the published SHA-256 checksum, stage and validate the executable, then replace the old binary recoverably.

### 5. Zero-Friction User Experience
- **Rule:** Developers should not be forced to manually click "Initialize" for every project. Plugins actively monitor repo discovery events (e.g., `StartupActivity` in IntelliJ) and passively prompt to inject hooks if they are missing.

### 6. Strict Code Quality Gates
- **Go Linter:** The Go CLI must strictly pass `golangci-lint run` (e.g., explicitly ignoring `deferred` error returns by wrapping them). Implementations must be validated locally *before* code is submitted.
- **Cross-Platform Compatibility:** Changes to terminal output, paths, or execution must be tested against macOS, Linux, and Windows conventions.

### 6. i18n Coverage Gate
The project supports 14 locales (ar, de, es, fr, id, it, ja, ko, pt, ru, th, vi, zh-CN, zh-TW). Translations must stay in sync at all times across **three sources**:
- **Rule:** Whenever you add, rename, or remove a key in the English base files (`vscode-extension/package.nls.json`, `idea-plugin/src/main/resources/messages/GitAiBundle.properties`, or the `en` block in `docs/script.js`), you **must** add the corresponding translation to **every** locale file/block.
- **Rule:** After any i18n-related change, run `bash scripts/check-i18n-coverage.sh` to verify zero missing keys before considering the task complete.
- **Base files:** `package.nls.json` (VS Code), `GitAiBundle.properties` (IntelliJ), `docs/script.js` `en:{}` block (Landing Page).
- **Locale files:** `package.nls.{locale}.json` (VS Code), `GitAiBundle_{locale}.properties` (IntelliJ), locale blocks in `docs/script.js`.
