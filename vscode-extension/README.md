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

## 🖥️ Extension Features

- 🟢 **Real-time Status Bar**: See instantly if the Git AI daemon is polishing behind the scenes.
- 🌳 **Action Panel**: Access one-click actions to Undo changes, Retry polishing, or manually force a push.
- ⚙️ **Config UI**: Rich visual settings for managing API Keys, selecting models (DeepSeek, OpenAI, Ollama), and setting up prompts.

## 🚀 Quick Start

1. Install this extension.
2. In your terminal, run `git-ai init` inside your Git repository.
3. Open the VS Code Settings UI (search for `git-ai`) to configure your **API Key** and Provider (e.g., DeepSeek, OpenAI, or a local Ollama model).
4. Run `git commit -m "your dirty message"` in your VS Code terminal or Source Control UI.
5. Watch the magic happen in your status bar! 



## ⚙️ Providers Supported

- **OpenAI Compatible Models** (`gpt-4o`, `gpt-3.5`, etc.)
- **DeepSeek** (Default pre-configured model)
- **Ollama** (Run models totally locally & offline for free)

## 💬 Telemetry & Privacy

The extension strictly communicates with your designated AI endpoints. No data is sent to us. 

---
<p align="center">
  <sub>This project's own commit history is polished and maintained by <code>git-ai</code> 🤖</sub>
</p>
