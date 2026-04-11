# git-ai

> 🤖 AI-powered Git commit message enhancer — async polish + deferred push.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.23+-00ADD8.svg)](https://go.dev)

`git-ai` automatically rewrites your commit messages using AI. It runs in the background (async), so your workflow is never blocked. If you push while polishing is in progress, the push is queued and auto-executed when ready.

## ✨ Features

- **Async AI polishing** — commit messages are enhanced in the background
- **Deferred push** — pushes are queued if AI is still working
- **4 message formats** — plain, conventional, gitmoji, subject+body
- **Multi-provider** — OpenAI, DeepSeek, Ollama, and any OpenAI-compatible API
- **Smart diff trimming** — handles large diffs without token overflow
- **System notifications** — toast notifications for polish/push completion
- **Undo & retry** — restore original message or re-generate

## 📦 Install

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
# 1. Initialize in your repo
cd your-project
git-ai init

# 2. Set your API key (one-time)
git-ai config set api_key sk-your-key --global

# 3. Commit as usual — AI polishes in background
git commit -m "fix bug"
# ✨ git-ai: polishing in background (PID 12345)

# 4. Push — queued if polishing, auto-pushed when ready
git push
# ⏳ git-ai: AI is polishing. Push queued — will auto-push when ready.
```

## ⚙️ Configuration

### Config Locations
| Level | Path | Purpose |
|:---|:---|:---|
| Global | `~/.config/git-ai/config.json` | Default settings |
| Project | `<repo>/.git-ai.json` | Per-project overrides |
| Env vars | `GIT_AI_API_KEY`, `GIT_AI_MODEL`, etc. | Runtime overrides |

### Config Keys
| Key | Default | Options |
|:---|:---|:---|
| `api_key` | — | Your LLM API key |
| `model` | `deepseek-chat` | Any model name |
| `base_url` | `https://api.deepseek.com/v1` | API endpoint |
| `provider` | `openai` | `openai`, `ollama` |
| `language` | `en` | `en`, `zh-CN`, `ja`, `ko`, etc. |
| `push_policy` | `queue` | `queue` (auto-push) or `block` (manual) |
| `message_format` | `conventional` | `plain`, `conventional`, `gitmoji`, `subject-body` |
| `max_diff_tokens` | `4000` | Max tokens for diff context |

### Message Format Examples

```bash
# Plain
Fix the login timeout bug on mobile

# Conventional (default)
fix(auth): resolve login timeout on mobile devices

# Gitmoji
🐛 fix(auth): resolve login timeout on mobile devices

# Subject+Body
Fix login timeout on mobile

The session cookie was not being refreshed when the user
switched between mobile and desktop views.
```

### Provider Examples

```bash
# DeepSeek (default)
git-ai config set base_url https://api.deepseek.com/v1 --global
git-ai config set model deepseek-chat --global

# Ollama (local)
git-ai config set provider ollama
git-ai config set model llama3
git-ai config set base_url http://localhost:11434

# OpenAI
git-ai config set base_url https://api.openai.com/v1 --global
git-ai config set model gpt-4o --global
```

## 🛠️ Commands

| Command | Description |
|:---|:---|
| `git-ai init` | Initialize hooks and state in current repo |
| `git-ai config set <key> <value>` | Set a config value (`--global` for global) |
| `git-ai config get <key>` | Get a config value |
| `git-ai config list` | Show merged config |
| `git-ai retry` | Re-generate AI message for last commit |
| `git-ai undo` | Restore original pre-AI message |

## 🏗️ How It Works

```
git commit -m "fix bug"
        │
        ▼
   [post-commit hook]
        │
        ├─ Fork background daemon
        │   │
        │   ├─ Read diff + original message
        │   ├─ Call LLM (DeepSeek/Ollama/OpenAI)
        │   ├─ git commit --amend -m "fix(auth): ..."
        │   ├─ Check pending_push → auto push if queued
        │   └─ Send notification 🔔
        │
        └─ Exit immediately (non-blocking)

git push
        │
        ▼
   [pre-push hook]
        │
        ├─ If polishing → queue push, exit 1
        └─ If idle → allow push, exit 0
```

## 🖥️ IDE Extensions

### VS Code Extension

The VS Code extension provides a seamless IDE experience:

- **Status Bar** — Shows `✨ AI 润色中...` / `⏳ 待推送...` / `✓ git-ai` in real-time
- **Sidebar Panel** — Activity bar with status tree view and actions webview
- **Action Buttons** — Retry, Undo, Cancel, Force Push directly from the UI
- **Log Viewer** — Real-time daemon log tailing in the output channel
- **Config Editor** — Quick pick between project/global config files
- **Notifications** — VS Code notifications on polish/push completion

```bash
cd vscode-extension
npm install && npm run compile
# Install: Cmd+Shift+P → "Developer: Install Extension from Location..."
```

### IntelliJ IDEA Plugin

The IntelliJ plugin integrates with the IDE's native UI:

- **Status Bar Widget** — Live polishing/push status in the bottom bar
- **Tool Window** — Two tabs: Status (with action buttons) and Logs (auto-tailing)
- **VCS Menu Actions** — Retry, Undo, Cancel, Force Push, Init, Open Config
- **VFS-Based Watching** — Uses IntelliJ's Virtual File System for instant state updates
- **IDE Notifications** — Balloon notifications on state transitions

```bash
cd idea-plugin
./gradlew buildPlugin
# Output: build/distributions/git-ai-0.1.0.zip
```

> **Note:** Both extensions require the `git-ai` CLI to be installed on PATH. They contain no business logic — they only observe `state.json` and delegate to the CLI.

## 📝 License

MIT

---

<p align="center">
  <sub>Optimized by <code>git-ai</code> 🤖</sub>
</p>
