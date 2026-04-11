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

## ✨ Features

- 🔄 **Async AI polishing** — commit messages are enhanced in the background via `post-commit` hook
- 🚀 **Deferred push** — pushes are queued if AI is still working, and auto-execute when ready
- 📝 **4 message formats** — `plain`, `conventional`, `gitmoji`, `subject+body`
- 🤖 **Multi-provider** — OpenAI, DeepSeek, Ollama, and any OpenAI-compatible API
- ✂️ **Smart diff trimming** — handles large diffs with three-tier token truncation
- 🔔 **System notifications** — OS-native toast when polish/push finishes
- ⏪ **Undo & retry** — restore original message or re-generate at any time
- 🖥️ **IDE plugins** — first-class VS Code extension and IntelliJ IDEA plugin

## 📦 Install

### GitHub Releases (Recommended)
Download the latest pre-compiled binary for macOS, Linux, or Windows directly from the [GitHub Releases](https://github.com/daidi/git-ai/releases) page.

### Package Managers

```bash
# Homebrew (macOS/Linux)
brew install daidi/tap/git-ai

# Go install
go install github.com/daidi/git-ai/cli/cmd/git-ai@latest

# From source
cd cli && make install
```

## 🚀 Quick Start

```bash
# 1. Initialize in your repo (installs Git hooks)
cd your-project
git-ai init

# 2. Configure your API key (one-time)
git-ai config set api_key sk-your-key --global

# 3. Commit as usual — AI polishes in background
git commit -m "fix bug"
# ✨ git-ai: polishing in background (PID 12345)

# 4. Push — queued if polishing, auto-pushed when ready
git push
# ⏳ git-ai: AI is polishing. Push queued — will auto-push when ready.
```

That's it. Your commit message is now a clean, descriptive, spec-compliant message — and you didn't have to think about it.

## 🏗️ How It Works

```
git commit -m "fix bug"
        │
        ▼
   [post-commit hook]
        │
        ├── Fork background daemon (non-blocking)
        │    │
        │    ├── Read diff + original message
        │    ├── Call LLM (DeepSeek / OpenAI / Ollama)
        │    ├── git commit --amend -m "fix(auth): ..."
        │    ├── If pending_push → auto push
        │    └── Send OS notification 🔔
        │
        └── Exit immediately → you keep coding

git push
        │
        ▼
   [pre-push hook]
        │
        ├── If polishing → queue push, exit 1
        └── If idle → allow push, exit 0
```

## ⚙️ Configuration

git-ai uses a layered config system. Values are resolved in order: **env vars → project → global → defaults**.

### Config Files

| Scope | Path | Description |
|:---|:---|:---|
| Global | `~/.config/git-ai/config.json` | Shared across all repos |
| Project | `<repo>/.git-ai.json` | Per-repo overrides |
| Env vars | `GIT_AI_API_KEY`, `GIT_AI_MODEL`, etc. | Runtime overrides |

### Options

| Key | Default | Description |
|:---|:---|:---|
| `api_key` | — | Your LLM API key |
| `model` | `deepseek-chat` | Model name |
| `base_url` | `https://api.deepseek.com/v1` | API endpoint |
| `provider` | `openai` | `openai` or `ollama` |
| `language` | `en` | Output language (`en`, `zh-CN`, `ja`, `ko`, ...) |
| `push_policy` | `queue` | `queue` = auto-push after polish, `block` = manual |
| `message_format` | `conventional` | `plain`, `conventional`, `gitmoji`, `subject-body` |
| `max_diff_tokens` | `4000` | Max tokens of diff context sent to LLM |

### Message Formats

```bash
# plain
Fix the login timeout bug on mobile

# conventional (default)
fix(auth): resolve login timeout on mobile devices

# gitmoji
🐛 fix(auth): resolve login timeout on mobile devices

# subject-body
Fix login timeout on mobile

The session cookie was not being refreshed when the user
switched between mobile and desktop views.
```

### Provider Examples

```bash
# DeepSeek (default)
git-ai config set api_key sk-xxx --global
git-ai config set model deepseek-chat --global

# OpenAI
git-ai config set base_url https://api.openai.com/v1 --global
git-ai config set model gpt-4o --global

# Ollama (local, no API key needed)
git-ai config set provider ollama
git-ai config set model llama3
git-ai config set base_url http://localhost:11434
```

## 🛠️ CLI Commands

| Command | Description |
|:---|:---|
| `git-ai init` | Install hooks and state directory in current repo |
| `git-ai config set <key> <val>` | Set a config value (`--global` for global) |
| `git-ai config get <key>` | Read a config value (merged) |
| `git-ai config list` | Show full merged configuration |
| `git-ai retry` | Re-generate AI message for the last commit |
| `git-ai undo` | Restore the original pre-AI message |

## 🖥️ IDE Plugins

Both plugins provide native integration — status display, one-click actions, and a Settings UI with i18n support (English + 中文).

### VS Code Extension

<table><tr>
<td width="50%">

- **Status Bar** — real-time polishing / push / idle status
- **Sidebar Panel** — status tree + actions webview
- **Settings UI** — Global + Project config with Codicons
- **i18n** — auto-detects VS Code language (en / zh-CN)
- **Notifications** — toast on polish/push completion

</td>
<td>

[Install from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai)
<br><br>
Open VS Code, press `Cmd+Shift+X` and search for **git-ai** or use the CLI:
`code --install-extension git-ai-async-commit-polisher.git-ai`

</td>
</tr></table>

### IntelliJ IDEA Plugin

<table><tr>
<td width="50%">

- **Status Bar Widget** — live status in the bottom bar
- **Tool Window** — Status + Logs tabs with auto-tailing
- **Native Settings** — `Settings → Tools → git-ai` with i18n
- **VCS Menu** — Retry, Undo, Cancel, Force Push, Config
- **IDE Notifications** — balloon alerts on state changes

</td>
<td>

```bash
cd idea-plugin
./gradlew buildPlugin
# → build/distributions/git-ai-0.1.0.zip
# Settings → Plugins → ⚙️ → Install from Disk...
```

</td>
</tr></table>

> **Note:** Both plugins are UI-only — they observe `state.json` and delegate to the `git-ai` CLI. The CLI must be installed on PATH.

## 🛠️ For Maintainers / Releasing

A unified script is provided to automate version bumping across all ecosystem components (CLI, VS Code, IntelliJ) and prepare for the automated GitHub distribution pipeline.

1. Ensure your working tree is clean. Run the cross-ecosystem bump script:
   ```bash
   ./scripts/bump-version.sh 0.3.0
   ```
2. The script explicitly updates `vscode-extension/package.json` and `idea-plugin/gradle.properties`.
3. Follow the CLI prompt output to commit and push the updated Tag:
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
  <sub>This commit message was optimized by <code>git-ai</code> 🤖</sub>
</p>
