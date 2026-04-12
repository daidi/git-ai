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
2. Click "Generate".
3. **Wait...** and watch a spinner.
4. Review, accept, and *finally* commit.

This friction kills your flow state.

## 🚀 The Solution: "Commit First, Think Later"

Git AI flips the script. It operates purely asynchronously.

You simply type your lazy, dirty commit message:
`git commit -m "fix bug"`

And **you are done.** You instantly return to writing code.

Meanwhile, a detached background daemon securely sends your diff to an LLM, processes conventional semantic rules, and silently `--amend`s your local commit in the background to:
`fix(auth): resolve session timeout on mobile devices`

If you habitually type `git commit -am "wip"` and immediately `git push`, Git AI elegantly queues the push, waits for the polish to finish, and executes it perfectly. **Zero broken habits.**

## ✨ Features Tailored for VS Code

Git AI is deeply integrated into your VS Code workspace:

- 🟢 **Live Status Bar:** Instantly see when Git AI is polishing your commit behind the scenes.
- 🌳 **Source Control Menu:** Native actions to undo an AI rewrite, retry a polish, or view daemon logs right from the SCM view.
- ⚙️ **Seamless Configuration:** A rich, native Settings GUI to configure your API keys, prompts, and behaviors without touching JSON.
- 🧠 **Bring Your Own Model:** First-class support for **DeepSeek**, **OpenAI (GPT-4o)**, and local, free, offline models via **Ollama**.

## 🛠️ Quick Start

1. **Install** the extension from the VS Code Marketplace.
2. **Open** any Git repository in VS Code. *The extension will automatically provision the background engine for you.*
3. Open **Settings** (Search for `Git AI`) and securely paste your API key (DeepSeek is highly recommended for speed and cost).
4. Run `git commit -m "your dirty message"` anywhere (VS Code Terminal or SCM panel).
5. Watch the magic happen in the bottom right corner of your editor!

## 🔒 Privacy First

Your code is yours. Git AI communicates *exclusively and directly* with the AI endpoint you configure (e.g., `api.deepseek.com`, or your own `localhost:11434` for Ollama). 
**Zero telemetry. Zero middleman servers.**

---

<p align="center">
  <sub>Built by developers, for developers. This project's own commit history is polished and maintained by <code>Git AI</code> 🤖</sub>
</p>
