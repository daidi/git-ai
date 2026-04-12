# 🤖 Gemini / AI Assistant Guide for git-ai

Welcome to the `git-ai` codebase. This document outlines the overall architecture, core workflows, and foundational design principles of the project. Always adhere to these structural rules when generating code or fixing bugs.

## 🎯 Core Paradigm: Async Commit Polishing
`git-ai` solves the "AI waiting problem" by adopting a **Commit First, Think Later** model.
Developers write a fast, raw commit message (`git commit -m "fix"`). A detached background daemon intercepts the Git hooks, communicates with the LLM to polish the message, and silently `--amend`s the commit. The developer never waits in the terminal.

## 🏗️ Monorepo Architecture
The application consists of three decoupled components communicating entirely via a local state file (`.git/git-ai/state.json`):

1. **`cli/` (Go 1.23+)**
   - **Role:** The core engine. It acts as both the lightweight CLI interface and the background daemon.
   - **Key Logic:** Handles Git hooks (`post-commit`, `pre-push`), daemon detachment, LLM prompt engineering, and Git `--amend` logic.
2. **`idea-plugin/` (Kotlin / IntelliJ Platform SDK V2)**
   - **Role:** Native JetBrains ecosystem integration.
   - **Key Logic:** Uses Virtual File System (VFS) listeners to monitor `state.json`. Injects actions into the Commit Window toolbar and provides a native Tool Window for streaming logs.
3. **`vscode-extension/` (TypeScript)**
   - **Role:** Native VS Code ecosystem integration.
   - **Key Logic:** Uses standard FS polling for state changes. Integrates into the SCM (Source Control) title menu and provides custom Settings webviews.

## 🔄 State Machine (`state.json`)
The CLI and IDE plugins share zero memory or open sockets. They are entirely stateless and communicate solely through the state file.
- **`idle`**: No active operations.
- **`polishing`**: The background daemon is currently contacting the LLM. IDEs show a loading state and enable "Cancel" actions.
- **`pushing`**: An automatic background network push is occurring (if `push_policy=queue`).

## ⚠️ Critical Information & Architectural Gotchas

### 1. IDE Environment Constraints (The "Ghost PATH")
IDEs launched from graphical shells (macOS Dock, Windows Explorer) run in heavily restricted environments without access to the user's full shell `$PATH` (like Brew, Cargo, Go).
- **Rule:** When generating Git hooks or invoking CLI binaries from IDEs, **always use explicit fallback paths**. Relying purely on OS `$PATH` will fail. 

### 2. Daemon Process Isolation
The `post-commit` hook must finish in milliseconds to free the developer's terminal, offloading the heavy work to a detached daemon.
- **Rule:** Cross-platform daemonization (`daemon_unix.go`, `daemon_windows.go`) must ensure the child process is fully orphaned from the terminal (e.g., `Setsid` on macOS/Linux). 
- **Rule:** The daemon *must* inherit the Git repository's actual working directory, otherwise internal `git` commands will fail.

### 3. Dynamic Binary Provisioning
We do not bundle the Go CLI binary into the IDE plugin bundles (to avoid gigantic `.vsix`/`.zip` files).
- **Rule:** IDE plugins implement an HTTP auto-downloader that pulls the matching architecture binary from GitHub Releases to `~/.git-ai/bin/`. Code changes to the plugins must maintain this standalone nature.

### 4. Zero-Friction User Experience
- **Rule:** Developers should not be forced to manually click "Initialize" for every project. Plugins actively monitor repo discovery events (e.g., `StartupActivity` in IntelliJ) and passively prompt to inject hooks if they are missing.

### 5. Strict Code Quality Gates
- **Go Linter:** The Go CLI must strictly pass `golangci-lint run` (e.g., explicitly ignoring `deferred` error returns by wrapping them). Implementations must be validated locally *before* code is submitted.
- **Cross-Platform Compatibility:** Changes to terminal output, paths, or execution must be tested against macOS, Linux, and Windows conventions.
