<p align="center">
  <img src="assets/icon.png" width="120" alt="git-ai logo" />
</p>

<h1 align="center">Git AI: The Zero-Friction Commit Polisher</h1>

<p align="center">
  <strong>Don't wait for AI. Keep coding while Git AI writes your commit messages in the background.</strong>
</p>

<p align="center">
  <a href="http://codegg.org/git-ai/"><img src="https://img.shields.io/badge/Website-codegg.org-10b981?style=flat&logo=googlechrome&logoColor=white" alt="Official Website" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://go.dev"><img src="https://img.shields.io/badge/Go-1.23+-00ADD8.svg?logo=go&logoColor=white" alt="Go" /></a>
  <a href="https://github.com/daidi/git-ai/releases"><img src="https://img.shields.io/github/v/release/daidi/git-ai?label=Release&color=8B5CF6" alt="Release" /></a>
  <a href="https://goreportcard.com/report/github.com/daidi/git-ai/cli"><img src="https://goreportcard.com/badge/github.com/daidi/git-ai/cli" alt="Go Report Card" /></a>
  <a href="https://github.com/daidi/git-ai/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/daidi/git-ai/ci.yml?branch=main&logo=github&label=Build" alt="Build Status" /></a>
  <br/>
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai"><img src="https://vsmarketplacebadges.dev/installs-short/git-ai-async-commit-polisher.git-ai.svg?style=flat&color=007ACC&label=VS%20Code&logo=visualstudiocode" alt="VS Code Installs" /></a>
  <a href="https://open-vsx.org/extension/git-ai-async-commit-polisher/git-ai"><img src="https://img.shields.io/open-vsx/dt/git-ai-async-commit-polisher/git-ai?style=flat&color=1C1C1C&label=Open%20VSX&logo=vscodium&logoColor=white" alt="Open VSX Installs" /></a>
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai"><img src="https://img.shields.io/badge/JetBrains-Plugin-blue?logo=intellijidea&logoColor=white&color=000000" alt="JetBrains Plugin" /></a>
  <br/>
  <a href="README_zh.md">📖 中文文档</a>
</p>

---

## ⚡️ The Problem: AI Tools Break Your Flow

Most AI Git tools force you into a synchronous waiting game: stage your files, click "Generate", watch a loading spinner, review, and *finally* commit. This friction kills your momentum.

## 🚀 The Solution: "Commit First, Think Later"

Git AI flips the script with pure, asynchronous background processing.

You simply type:
`git commit -m "fix bug"`

And **you are done**. You instantly return to writing code.

Meanwhile, a detached background daemon securely sends your diff to an LLM, applies conventional commit standards, and silently `--amend`s your commit to:
`fix(auth): resolve session timeout on mobile devices`

If you habitually push immediately, Git AI elegantly queues the push, waits for the polish to finish, and auto-pushes when ready. **Zero broken habits.**

## 💡 Why It's Better

| | Traditional AI Tools | Git AI |
|:---|:---|:---|
| **Workflow** | Generate → wait → review → commit | Commit → code → polish in background |
| **Latency** | 2–5s blocking wait | **Zero. You keep coding.** |
| **If AI fails?** | No commit happens | Your commit is safe regardless |
| **Habit change?** | New buttons/commands to learn | Standard `git commit` |

1. **Safety First:** Your code enters Git's history *immediately*. Even if the AI service goes down, your work is safely snapshotted.
2. **Agent-Friendly:** Git log instantly shows an `[⏳]` prefix while polishing, preventing AI coding agents (like Cursor/Claude Code) from making duplicate commits.
3. **Completely Invisible:** Use the terminal, JetBrains, VS Code, or any Git client. Git AI just works in the background.

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
  <a href="https://open-vsx.org/extension/git-ai-async-commit-polisher/git-ai">
    <img src="https://img.shields.io/badge/Open_VSX-Install_Extension-1C1C1C?style=for-the-badge&logo=vscodium&logoColor=white" alt="Install Open VSX Extension" />
  </a>
</p>

Open VS Code, press `Cmd+Shift+X` and search for **git-ai**, or run the following command:

```bash
code --install-extension git-ai-async-commit-polisher.git-ai
```

## ✨ Core Features

- 🔄 **Async AI polishing** — commit messages are enhanced in the background via `post-commit` hook
- ⏳ **Real-time status** — `[⏳]` prefix in `git log` shows polishing in progress; auto-removed on success
- 🛡️ **Auto-recovery** — crashes/timeouts auto-rollback; manual `git-ai recover` for edge cases
- 🚀 **Deferred push** — pushes are queued if AI is still working, and auto-execute when ready
- 📝 **4 message formats** — `plain`, `conventional`, `gitmoji`, `subject+body`
- 🤖 **Multi-provider native support** — Deep integration with OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Ollama, and compatible APIs
- ✂️ **Smart diff trimming** — handles large diffs with three-tier token truncation
- 📐 **Commitlint integration** — Automatically reads your local `.commitlintrc` to strictly adhere to repository guidelines
- 🎩 **Prompt templates** — Go `text/template` support (`{{.Diff}}`, `{{.Hint}}`) for ultimate control
- 🧐 **Explain mode** — Optionally generate a short paragraph explaining the *why* of the commit (`git-ai config set explain true`)
- 🔔 **System notifications** — OS-native toast when polish/push finishes
- ⏪ **Undo & retry** — restore original message or re-generate at any time

## 📦 Manual CLI Installation (For Terminal-Only Users)

> **Note**: If you are using the VS Code or JetBrains plugin, **do not manually install the CLI**. The plugins handle downloading and managing the CLI for you completely behind the scenes.

### GitHub Releases (Recommended)
Download the latest pre-compiled binary for macOS, Linux, or Windows directly from the [GitHub Releases](https://github.com/daidi/git-ai/releases) page.
Since there are many files published, please refer to the table below if downloading manually:

| OS | Architecture / Chip | File to Download |
| :--- | :--- | :--- |
| **Windows** | 64-bit (Most common) | `git-ai_windows_amd64.zip` |
| **Windows** | ARM | `git-ai_windows_arm64.zip` |
| **macOS** | Apple Silicon (M1/M2/M3) | `git-ai_darwin_arm64.tar.gz` |
| **macOS** | Intel | `git-ai_darwin_amd64.tar.gz` |
| **Linux** | 64-bit / ARM | We provide `.deb`, `.rpm`, or `.tar.gz` |

> *Tip: For Windows users, extract `git-ai.exe` from the zip file and add it to your system's `Path` environment variable.*



### Package Managers

```bash
# Homebrew (macOS/Linux)
brew install daidi/tap/git-ai

# Scoop (Windows)
scoop bucket add daidi https://github.com/daidi/scoop-bucket.git
scoop install daidi/git-ai

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

# 5. Check status anytime
git log -1
# Shows: [⏳] fix bug (while polishing)
# Then:  fix(auth): resolve session timeout on mobile devices

# 6. If polishing gets stuck (rare), recover manually
git-ai recover
# ✅ Recovery complete.
```

That's it. Your commit message is now a clean, descriptive, spec-compliant message — and you didn't have to think about it.

## ⚙️ Models & Configuration

git-ai uses a layered config system. Values are resolved in order: **env vars → project (`.git-ai.json`) → global (`~/.config/git-ai/config.json`) → defaults**.

> 💡 **Tip**: Use **fast models** (flash/mini/turbo variants) for commit messages. They're 10x cheaper, respond in ~500ms, and work perfectly for this task. Most users won't experience any noticeable delay.

### Popular Provider Configurations

```bash
# DeepSeek (Recommended — fast & cheap)
git-ai config set api_key sk-xxx --global
git-ai config set model deepseek-chat --global

# OpenAI (Fast mini model recommended)
git-ai config set base_url https://api.openai.com/v1 --global
git-ai config set api_key sk-xxx --global
git-ai config set model gpt-4o-mini --global

# Qwen (Extremely fast, Chinese-friendly)
git-ai config set base_url https://dashscope.aliyuncs.com/compatible-mode/v1 --global
git-ai config set api_key sk-xxx --global
git-ai config set model qwen-turbo --global

# Anthropic Claude
git-ai config set provider anthropic --global
git-ai config set api_key sk-ant-xxx --global
git-ai config set model claude-3-5-sonnet-20240620 --global

# Google Gemini
git-ai config set provider gemini --global
git-ai config set api_key AIzaSy-xxx --global
git-ai config set model gemini-1.5-flash --global

# Ollama (Local, free, private)
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
| `git-ai config set explain true --global` | `false` | Append a paragraph explaining the *why* of the commit |

> **All of these configurations (and more) are fully accessible and editable via the native settings UI in both the VS Code and JetBrains IDEA plugins.**

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
        │    ├── Immediately mark: git commit --amend -m "[⏳] fix bug"
        │    ├── Read diff + Call LLM
        │    ├── On success: git commit --amend -m "fix(auth): ..."
        │    ├── On failure: rollback to "fix bug" (no [⏳])
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
