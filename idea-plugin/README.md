<p align="center">
  <img src="https://raw.githubusercontent.com/daidi/git-ai/main/assets/icon.png" width="120" alt="Git AI logo" />
</p>

<h1 align="center">Git AI: The Zero-Friction Commit Polisher</h1>

<p align="center">
  <strong>Don't wait for your AI. Keep coding while Git AI writes your commit messages in the background.</strong>
</p>

<p align="center">
  <a href="https://github.com/daidi/git-ai">GitHub</a> •
  <a href="https://marketplace.visualstudio.com/items?itemName=daidi.git-ai">VS Code</a> •
  <a href="https://plugins.jetbrains.com/plugin/24227-git-ai">IntelliJ</a>
</p>

## ⚡️ The Problem: AI Tools Break Your Flow

Most AI Git tools force you into a synchronous waiting game:
1. Stage changes.
2. Click "Generate Message".
3. **Wait...** and stare at a loading bar.
4. Review, accept, and *finally* commit.

This friction kills your momentum.

## 🚀 The Solution: "Commit First, Think Later"

Git AI flips the script with pure, asynchronous background processing.

You simply type your fast, messy commit message in the JetBrains Commit Tool Window:
`git commit -m "fix stuff"`

And **you are done.** You instantly return to writing code.

Meanwhile, a detached background daemon securely sends your diff to an LLM, applies conventional commit standards, and silently `--amend`s your commit in the background to:
`fix(ui): resolve layout shift on high-DPI displays`

Even if you click "Commit and Push", Git AI elegantly queues the push, waits for the polish to finish, and safely syncs with your remote. **Zero broken habits.**

## ✨ Features Tailored for JetBrains

Git AI is beautifully integrated into the JetBrains Platform:

- 🟢 **Smart Status Bar Widget:** Real-time feedback at the bottom of your IDE. Know exactly what the daemon is doing without leaving your editor.
- 📺 **Dedicated Git AI Tool Window:** Jump into a beautifully formatted live-streaming log of the background daemon's decision-making process.
- ⚙️ **Native Preferences UI:** Fully integrated into `Settings → Tools → Git AI` with seamless multi-language (English / zh-CN) support.
- 🌳 **Commit Action Toolbar:** One-click actions embedded directly into your Commit window to undo, cancel, or retry AI polishes.

## 🛠️ Quick Start

1. **Install** the plugin from the JetBrains Marketplace.
2. **Open a Project.** If your Git repo lacks the necessary hooks, a friendly balloon will invite you to auto-initialize Git AI in one click. *The plugin will also automatically provision its fast background engine.*
3. Navigate to **`Settings → Tools → Git AI`** to securely supply your API Key (DeepSeek is incredibly fast, or use your local Ollama instance).
4. Do a regular Git Commit.
5. Keep coding. Git AI takes care of the rest.

## 🧠 Supported Providers

- **OpenAI Compatible Models** (`gpt-4o`, `gpt-4-turbo`)
- **DeepSeek** (Default & Highly Recommended)
- **Ollama** (Run open-source models completely locally and offline)

## 🔒 Uncompromising Privacy

Your codebase never passes through our servers. Git AI sends prompts and diffs *exclusively* to the LLM API endpoint you configure in your IDE. 
**Zero data collection. Zero telemetry.**

---

<p align="center">
  <sub>Built by developers, for developers. This project's own commit history is polished and maintained by <code>Git AI</code> 🤖</sub>
</p>
