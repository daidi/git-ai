<p align="center">
  <img src="https://raw.githubusercontent.com/daidi/git-ai/main/assets/icon.png" width="120" alt="git-ai logo" />
</p>

<h1 align="center">Git AI - Async Commit Polisher</h1>

<p align="center">
  <strong>Never wait for AI. Polish your commits in the background while you code.</strong>
</p>

You write `git commit -m "fix bug"`. Seconds later, it becomes `fix(auth): resolve session timeout on mobile devices` — silently, in the background, without you lifting a finger.

## 💡 Why "Commit First"?

Most AI commit tools make you *wait* before committing. We take the opposite approach: your code goes instantly into your Git history, and the LLM safely rewrites your commit message in the background. If you push early, the push is queued and executes silently after polishing.

No confirmation modals. No wait times. No broken habits.

## 🖥️ Plugin Features

- 🟢 **Status Bar Widget**: See instantly if the Git AI background daemon is active right at the bottom of IntelliJ.
- 🛠 **Tool Window & Logs**: Jump into the Git AI tool window to view live streaming logs of the daemon's internal process and decision-making.
- ⚙️ **Native Preferences**: fully integrated into `Settings → Tools → Git AI` with seamless multi-language (en/zh-CN) layouts.
- 🔄 **Commit Window Integration**: Provides top-level VCS menu actions for undoing and retrying commits.

## 🚀 Quick Start

1. Install the plugin from the JetBrains Marketplace.
2. Open a project. A balloon notification will invite you to "Initialize Git AI" if your Git repo lacks the required hooks.
3. Go to `Settings → Tools → Git AI` to set your **API Key** and Provider (Default is DeepSeek, supports OpenAI and local Ollama natively).
4. Do a regular Git Commit.
5. Keep coding. Git AI will silently polish your original commit into a Conventional semantic message.

> **Important**: This plugin provides a rich IDE frontend. Underneath, it seamlessly observes the [git-ai Core CLI Engine](https://github.com/daidi/git-ai). Make sure the `git-ai` CLI is installed and in your PATH!

## ⚙️ Provider Setup

- **OpenAI Models**
- **DeepSeek** (highly recommended)
- **Ollama** (completely local & private)

## 💬 Privacy & Code Security

All code diffs and prompts are sent exclusively to the API endpoints you manually configure. This plugin collects absolutely zero telemetry.

---
<p align="center">
  <sub>This project's own commit history is polished and maintained by <code>git-ai</code> 🤖</sub>
</p>
