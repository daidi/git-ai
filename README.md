<p align="center">
  <img src="assets/icon.png" width="120" alt="git-ai logo" />
</p>

<h1 align="center">git-ai</h1>

<p align="center">
  <strong>Commit first, think later.</strong><br/>
  <sub>AI-powered Git commit messages — async, invisible, zero-friction.</sub>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://go.dev"><img src="https://img.shields.io/badge/Go-1.23+-00ADD8.svg?logo=go&logoColor=white" alt="Go" /></a>
  <a href="https://github.com/daidi/git-ai/releases"><img src="https://img.shields.io/github/v/release/daidi/git-ai?label=Release&color=8B5CF6" alt="Release" /></a>
  <a href="https://goreportcard.com/report/github.com/daidi/git-ai"><img src="https://goreportcard.com/badge/github.com/daidi/git-ai" alt="Go Report Card" /></a>
  <a href="https://github.com/daidi/git-ai/actions"><img src="https://img.shields.io/github/actions/workflow/status/daidi/git-ai/release.yml?logo=github&label=Build" alt="Build Status" /></a>
  <br/>
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai"><img src="https://img.shields.io/visual-studio-marketplace/i/git-ai-async-commit-polisher.git-ai?label=VS%20Code&logo=visualstudiocode&color=007ACC" alt="VS Code Installs" /></a>
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai"><img src="https://img.shields.io/badge/JetBrains-Plugin-blue?logo=intellijidea&logoColor=white&color=000000" alt="JetBrains Plugin" /></a>
  <br/>
  <a href="README_zh.md">📖 中文文档</a>
</p>

---

You write `git commit -m "fix bug"`. Seconds later, it becomes `fix(auth): resolve session timeout on mobile devices` — silently, in the background, without you lifting a finger.

**git-ai** hooks into your normal Git workflow and uses LLMs to rewrite your commit messages into clean, [Conventional Commits](https://www.conventionalcommits.org/)-style messages. It does this *after* you commit, so you're never waiting. If you push while polishing is in progress, the push is queued and fires automatically when ready.

## 💡 Why "Commit First"?

Most AI commit tools make you *wait* before committing. We take the opposite approach:

| | Traditional AI Commit Tools | git-ai |
|:---|:---|:---|
| **Workflow** | Generate → review → commit | Commit → polish in background |
| **Latency** | 2–5s blocking wait | Zero. You keep coding. |
| **If AI fails?** | No commit happens | Your commit is safe regardless |
| **Habit change?** | New commands to learn | `git commit` — same as always |

Three reasons this is better:

1. **Instant snapshot** — Your code enters Git's version history *immediately*. Even if the AI service goes down, your work is safe.
2. **Zero friction** — No waiting, no confirmation dialogs. You commit and move on. The message gets polished behind the scenes.
3. **No new habits** — Use `git commit -m` from terminal, your IDE's commit UI, or any Git client you already love. git-ai is invisible.

---

# 👩‍💻 For Users

## 🖥️ Seamless IDE Experience

Don't change a single habit. Use Git AI directly inside your favorite IDE! Both plugins provide native integration — status display, one-click actions, and built-in cross-platform settings panels.

### JetBrains IDEA Plugin

Native UI with support for undo, retry, and settings.

<p align="center">
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai">
    <img src="https://img.shields.io/badge/JetBrains_Marketplace-Install_Plugin-black?style=for-the-badge&logo=intellijidea&logoColor=white" alt="Install JetBrains Plugin" />
  </a>
</p>

### VS Code Extension

Real-time state monitoring via sidebar and status bar.

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai">
    <img src="https://img.shields.io/badge/VS_Code_Marketplace-Install_Extension-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install VS Code Extension" />
  </a>
</p>

Open VS Code, press `Cmd+Shift+X` and search for **git-ai**, or run the following command:

```bash
code --install-extension git-ai-async-commit-polisher.git-ai
```

## ✨ Core Features

- 🔄 **Async AI polishing** — commit messages are enhanced in the background via `post-commit` hook
- 🚀 **Deferred push** — pushes are queued if AI is still working, and auto-execute when ready
- 📝 **4 message formats** — `plain`, `conventional`, `gitmoji`, `subject+body`
- 🤖 **Multi-provider** — OpenAI, DeepSeek, Ollama, and any OpenAI-compatible API
- ✂️ **Smart diff trimming** — handles large diffs with three-tier token truncation
- 🔔 **System notifications** — OS-native toast when polish/push finishes
- ⏪ **Undo & retry** — restore original message or re-generate at any time

## 📦 Core Engine Install (CLI)

### GitHub Releases (Recommended)
Download the latest pre-compiled binary for macOS, Linux, or Windows directly from the [GitHub Releases](https://github.com/daidi/git-ai/releases) page.

### Package Managers

```bash
# Homebrew (macOS/Linux)
brew install daidi/tap/git-ai

# Go Install (For Go developers)
go install github.com/daidi/git-ai/cli/cmd/git-ai@latest
```

## 🚀 Quick Start

```bash
# 1. Initialize in your repo (installs Git hooks)
cd your-project
git-ai init

# 2. Configure your API key (one-time global setup)
git-ai config set api_key sk-your-key --global

# 3. Commit as usual — AI polishes in background!
git commit -m "fix bug"
# ✨ git-ai: polishing in background (PID 12345)

# 4. Push — queued if polishing, auto-pushed when ready
git push
# ⏳ git-ai: AI is polishing. Push queued — will auto-push when ready.
```

That's it. Your commit message is now a clean, descriptive, spec-compliant message — and you didn't have to think about it.

## ⚙️ Models & Configuration

git-ai uses a layered config system. Values are resolved in order: **env vars → project (`.git-ai.json`) → global (`~/.config/git-ai/config.json`) → defaults**.

### Popular Provider Configurations

```bash
# DeepSeek (Recommended & Default)
git-ai config set api_key sk-xxx --global
git-ai config set model deepseek-chat --global

# OpenAI (Or any OpenAI-compatible endpoint)
git-ai config set base_url https://api.openai.com/v1 --global
git-ai config set model gpt-4o --global

# Ollama (Local and free)
git-ai config set provider ollama --global
git-ai config set model llama3 --global
git-ai config set base_url http://localhost:11434 --global
```

### More Options

| Command | Default | Description |
|:---|:---|:---|
| `git-ai config set language zh-CN --global` | `en` | Output language (`en`, `zh-CN`, `ja`, etc.) |
| `git-ai config set push_policy queue --global` | `queue` | `queue`=auto-push, `block`=prevent push until polished |
| `git-ai config set message_format gitmoji --global`| `conventional` | `plain`, `conventional`, `gitmoji`, `subject-body`|

---

# 👨‍💻 For Developers & Maintainers

## 🏗️ Architecture & How It Works

We use a **Monorepo** architecture that decouples the headless CLI agent from the IDE plugins. They communicate via a stateless `.git/git-ai/state.json` file.

```
git commit -m "fix bug"
        │
        ▼
   [post-commit hook]
        │
        ├── Fork background daemon (non-blocking)
        │    │
        │    ├── Read diff + Call LLM
        │    ├── git commit --amend -m "fix(auth): ..."
        │    ├── If pending_push → auto push
        │    └── Update IDE state / OS UI notification 🔔
        │
        └── Exit immediately → you keep coding
```

- **`cli/` (Go 1.23+)**: The core engine daemonizing processes, invoking LLMs, and amending Git commits.
- **`idea-plugin/` (Kotlin)**: JetBrains native integration watching `state.json` with VFS.
- **`vscode-extension/` (TS)**: Webview / tree-view plugin that tracks state through FS-polling. 

## 🖥️ Local Build & Testing

For contributors looking to modify and customize:

### Compiling the CLI
```bash
cd cli
make build
make install
```

### Developing the IDE plugins
1. **IntelliJ Plugin**: Under `/idea-plugin`, run `./gradlew runIde` to launch a sandboxed IDE instance containing the plugin. Run `./gradlew buildPlugin` to package it.
2. **VS Code Extension**: Under `/vscode-extension`, run `npm install`, then press `F5` to open the Extension Development Host.

## 🚀 Releasing

A unified script is provided to automate version bumping across all ecosystem components (CLI, VS Code, IntelliJ) and prepare for the automated GitHub distribution pipeline.

1. Ensure your working tree is clean. Run the cross-ecosystem bump script:
   ```bash
   ./scripts/bump-version.sh 0.3.0
   ```
2. The script explicitly updates `vscode-extension/package.json` and `idea-plugin/gradle.properties`.
3. Follow the output to commit and push the release Tag:
   ```bash
   git add vscode-extension/package.json idea-plugin/gradle.properties
   git commit -m "chore(release): bump version to 0.3.0"
   git tag v0.3.0
   git push origin main v0.3.0
   ```

GoReleaser will automatically trigger via GitHub Actions to package and distribute to Homebrew, Scoop, and GitHub Releases seamlessly.

## 📝 License

[MIT](LICENSE)

---

<p align="center">
  <sub>This project's own commit history is polished and maintained by <code>git-ai</code> 🤖</sub>
</p>
