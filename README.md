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
  <h4>
    English |
    <a href="README_zh-CN.md">简体中文</a> |
    <a href="README_zh-TW.md">繁體中文</a> |
    <a href="README_fr.md">Français</a> |
    <a href="README_it.md">Italiano</a> |
    <a href="README_de.md">Deutsch</a> |
    <a href="README_es.md">Español</a> |
    <a href="README_ja.md">日本語</a> |
    <a href="README_ko.md">한국어</a> |
    <a href="README_pt.md">Português</a> |
    <a href="README_ru.md">Русский</a> |
    <a href="README_ar.md">العربية</a> |
    <a href="README_vi.md">Tiếng Việt</a> |
    <a href="README_th.md">ไทย</a> |
    <a href="README_id.md">Bahasa Indonesia</a>
  </h4>
</p>

---

## ⚡️ The Problem: AI Tools Break Your Flow

Most AI Git tools force you into a synchronous waiting game: stage your files, click "Generate", watch a loading spinner, review, and *finally* commit. This friction kills your momentum.

## 🚀 The Solution: "Commit First, Think Later"

Git AI flips the script with pure, asynchronous background processing.

You simply type:
`git commit -m "fix bug"`

And **you are done**. You instantly return to writing code.

Meanwhile, a detached background daemon securely sends your diff to an LLM, builds a replacement from the exact recorded commit, and atomically advances the branch only if it has not moved:
`fix(auth): resolve session timeout on mobile devices`

If you habitually push immediately, Git AI elegantly queues the push, waits for the polish to finish, and auto-pushes when ready. **Zero broken habits.**

## 💡 Why It's Better

| Feature | Traditional AI Tools (aicommits, Copilot) | Git AI |
|:---|:---|:---|
| **Best For** | Those who want to manually review/edit AI messages | Developers prioritizing "Flow State" and zero waiting |
| **Workflow** | Generate → wait → review → commit | Commit → code → polish in background |
| **Latency** | 2–5s blocking wait | **Zero. You keep coding.** |
| **If AI fails?** | No commit happens | Your commit is safe regardless |
| **Habit change?** | New buttons/commands to learn | Standard `git commit` |

1. **Safety First:** Your code enters Git's history *immediately*. Even if the AI service goes down, your work is safely snapshotted.
2. **Agent-Friendly:** Git history and workspace files stay unchanged while polishing; CLI and IDE status surfaces report progress without temporary commits.
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
- ⏳ **Real-time status** — CLI and IDE integrations query external application state without placing files in the project
- 🛡️ **Safe recovery** — network/model crashes leave the original commit untouched and expose retry/configuration actions
- 🚀 **Deferred push** — pushes are queued if AI is still working, and auto-execute when ready
- 📝 **4 message formats** — `plain`, `conventional`, `gitmoji`, `subject+body`
- 🤖 **Multi-provider native support** — Deep integration with OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Ollama, and compatible APIs
- ✂️ **Smart diff trimming** — handles large diffs with three-tier token truncation
- 📐 **Safe commitlint integration** — Reads static JSON rules without executing repository scripts or installing dependencies
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



### Universal Installer Script (macOS/Linux)

The quickest way to install is via our terminal script:

```bash
curl -fsSL https://raw.githubusercontent.com/daidi/git-ai/main/install.sh | bash
```

### Windows (PowerShell)

For Windows users, open PowerShell and run:

```powershell
iwr https://raw.githubusercontent.com/daidi/git-ai/main/install.ps1 -useb | iex
```

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
git-ai status
# While polishing, Git still shows the original commit message.
# On success, the recorded ref is atomically advanced to the polished commit.

# 6. If the network/model is unavailable, the original commit is untouched
git-ai retry
# Retries safely in the background when you are ready.
```

That's it. Your commit message is now a clean, descriptive, spec-compliant message — and you didn't have to think about it.

## ⚙️ Models & Configuration

git-ai uses a layered config system. Values are resolved in order: **environment variables → repository (`git-ai.*` entries in `.git/config`) → user config in the OS application-config directory → defaults**. API keys are user-level only. Legacy `.git-ai.json` worktree files are ignored: trusting repository-distributed model endpoints could expose a user-level credential. Re-enter any old project overrides with `git-ai config set ... --local`, then delete the legacy file yourself.

Runtime state, logs, and AI commit-history metadata are kept outside repositories in the OS user-cache directory. Apart from the explicitly installed Git hooks and `.git/config` overrides, Git AI leaves the project and working tree untouched; new releases never create Git notes.

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

We use a **Monorepo** architecture that decouples the headless CLI agent from the IDE plugins. The CLI is the sole persistence owner; plugins query `git-ai status --json` and delegate actions/configuration back to the CLI.

```
git commit -m "fix bug"
        │
        ▼
   [post-commit hook]
        │
        ├── Record exact SHA/ref + fork daemon (non-blocking)
        │    │
        │    ├── Keep Git/index/worktree unchanged while the LLM runs
        │    ├── Retry bounded transient network/provider failures
        │    ├── Create replacement from recorded tree + parents
        │    ├── Atomically update ref only if it still equals the recorded SHA
        │    ├── On failure/moved ref: safe no-op + actionable error
        │    ├── If pending_push → auto push
        │    └── Persist external app state / notify IDE and OS 🔔
        │
        └── Exit immediately → you keep coding
```

- **`cli/` (Go 1.26.6+)**: The core engine daemonizing processes, invoking LLMs, and safely replacing recorded commit refs.
- **`idea-plugin/` (Kotlin)**: JetBrains native integration polling the CLI off the UI thread.
- **`vscode-extension/` (TS)**: Trusted-workspace UI integration polling the CLI and delegating all writes.

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
   ./scripts/bump-version.sh 1.2.0
   ```
2. The script updates both extension manifests/lockfiles and the localized landing-page version badges. It does not commit or push.
3. After all release checks pass, commit and push `main`, then create both the product tag and the Go submodule tag:
   ```bash
   git add -A
   GIT_AI_INTERNAL=true git commit -m "chore: bump version to 1.2.0"
   git push origin HEAD:main
   git tag v1.2.0
   git tag cli/v1.2.0
   git push origin v1.2.0 cli/v1.2.0
   ```

GoReleaser will automatically trigger via GitHub Actions to package and distribute to Homebrew, Scoop, and GitHub Releases seamlessly.

## 📝 License

[MIT](LICENSE)

---

<p align="center">
  <sub>This project's own commit history is polished and maintained by <code>git-ai</code> 🤖</sub>
</p>
