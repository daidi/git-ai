<p align="center">
  <img src="https://raw.githubusercontent.com/daidi/git-ai/main/assets/icon.png" width="112" alt="Git AI — asynchronous AI commit message generator for JetBrains IDEs" />
</p>

<h1 align="center">Git AI for JetBrains IDEs</h1>

<p align="center">
  <strong>Production-grade commit messages, generated after you commit—not before.</strong>
  <br />
  Stay in flow while Git AI polishes your Git history in the background.
</p>

<p align="center">
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai"><img src="https://img.shields.io/jetbrains/plugin/v/31221-git-ai?style=flat-square&label=JetBrains&color=000000" alt="Git AI version on the JetBrains Marketplace" /></a>
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai"><img src="https://img.shields.io/jetbrains/plugin/d/31221-git-ai?style=flat-square&label=downloads&color=7C3AED" alt="Git AI downloads from the JetBrains Marketplace" /></a>
  <img src="https://img.shields.io/badge/JetBrains-2024.1%2B-0EA5E9?style=flat-square" alt="Compatible with JetBrains IDEs 2024.1 and later" />
  <a href="https://github.com/daidi/git-ai/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-64748B?style=flat-square" alt="MIT license" /></a>
</p>

<p align="center">
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai"><strong>Install from JetBrains Marketplace</strong></a>
  &nbsp;·&nbsp;
  <a href="https://codegg.org/git-ai/">Website</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/daidi/git-ai">GitHub</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/daidi/git-ai/issues">Support</a>
</p>

---

Git AI is an **AI-powered Git commit message generator for IntelliJ IDEA and compatible JetBrains IDEs**. It rewrites quick draft messages into clean Conventional Commits, Gitmoji commits, plain messages, or structured subject-and-body commits—completely asynchronously.

```text
Commit Tool Window

  "fix ui"          ── commit now ──►  your work is safely in Git
                                              │
                                              └── AI polishes in background
                                                      ↓
                              "fix(ui): prevent layout shift on HiDPI displays"
```

No modal generator. No loading screen between you and your next edit. Commit from the JetBrains UI or terminal, then keep working.

## Commit first. Think later.

Traditional AI commit tools make you wait for a model before Git records your work. Git AI reverses the sequence:

| | Typical AI commit generator | Git AI |
|:--|:--|:--|
| **Workflow** | Generate → wait → review → commit | Commit → keep working → polish in background |
| **IDE availability** | Interrupted by generation UI | Ready for your next task immediately |
| **If AI is unavailable** | The commit may never happen | Your original commit stays exactly where it is |
| **Commit and Push** | Timing is your problem | The exact push can wait safely for polishing |
| **Learning curve** | New action or command | Your existing JetBrains Git workflow |

> Git AI improves commit messages without turning commit creation into an AI conversation.

## A first-class JetBrains experience

| Native integration | What it gives you |
|:--|:--|
| **Git AI Tool Window** | Dedicated Status, AI History, Productivity, and Logs tabs |
| **Status Bar widget** | Live `polishing`, `pushing`, `failed`, pending-push, and `idle` feedback |
| **VCS and Commit actions** | Retry, undo, cancel, push, skip the next commit, clean stale markers, or open settings |
| **Native Settings page** | Global configuration plus project-level overrides under **Tools → Git AI** |
| **Repository discovery** | Detects Git projects and offers one-click hook initialization |
| **Managed engine** | Downloads and updates the matching CLI with published SHA-256 verification |
| **Localized interface** | Native translations across 16 languages, including Malay |

The plugin delegates Git operations and persistence to the Git AI engine, keeping the IDE responsive and the integration consistent with the CLI and VS Code extension.

## Get started in under a minute

### 1. Install the plugin

Open **Settings / Preferences → Plugins → Marketplace**, search for **Git AI – Async Commit Polisher**, and select **Install**.

Or visit the [JetBrains Marketplace listing](https://plugins.jetbrains.com/plugin/31221-git-ai).

### 2. Open a Git project

If the Git AI engine is missing, the plugin offers to download the correct release for your operating system. When the project is not initialized, approve the one-time prompt to enable Git AI's composable hooks.

### 3. Connect your model

Go to **Settings / Preferences → Tools → Git AI**. Choose a provider, model, output format, and language, then use **Test LLM Configuration** before saving.

Cloud providers require your own API key. Ollama can run locally without one.

### 4. Commit as usual

Use the JetBrains Commit Tool Window, **Commit and Push**, the built-in terminal, or another Git client:

```bash
git commit -m "handle payment error"
```

Return to your code immediately. The Status Bar and Git AI Tool Window show what happens next.

## Everything you need, without leaving the IDE

### Status and control

See the active commit, original draft, queued remote, and daemon state. Recovery actions are available directly from the Tool Window and VCS menus:

- **Retry AI Polish** — generate a fresh message for the recorded commit
- **Undo AI Polish** — restore the original draft
- **Cancel Polishing** — stop active model work without changing Git
- **Force Push Now** — explicitly resume a deferred push
- **Skip AI** — leave the next commit untouched
- **Clean Stuck Commits** — recover old loading markers with a pushed-history warning

### AI history

Browse recent commits and inspect local AI metadata such as the original message, selected model, generation latency, and estimated time saved.

### Productivity view

See a local 30-day summary of polished commits and estimated time saved. These statistics remain on your machine.

### Live diagnostic logs

Inspect a bounded tail of the external Git AI log from inside the IDE. Sensitive values, prompt bodies, diffs, provider responses, and credential-bearing remote URLs are not written to Git AI logs.

## Providers, models, and commit styles

Use the model that matches your team's quality, latency, privacy, and budget requirements.

| Provider | Support |
|:--|:--|
| **OpenAI-compatible APIs** | OpenAI, DeepSeek, Qwen, and compatible endpoints |
| **Anthropic** | Native Claude API support |
| **Google** | Native Gemini API support |
| **Ollama** | Local and offline-capable model execution |

Available message formats:

- **Conventional Commits** — `feat(api): add cursor pagination`
- **Gitmoji** — `✨ feat(api): add cursor pagination`
- **Plain** — concise natural-language subjects
- **Subject + body** — a short subject followed by the what and why

Advanced controls include output language, custom prompt templates, diff-size limits, queue/block push policies, and an optional explanation of *why* the change was made.

## Git-safe architecture

Git AI is designed so a slow or unreliable model cannot damage your repository.

1. After Git finishes the commit, the hook records its exact SHA and target ref.
2. The hook starts a detached process and returns immediately, leaving the IDE free.
3. The engine sends the recorded diff and draft message to your configured model.
4. It creates a replacement commit from the recorded tree and parents—never from the current index or worktree.
5. It advances the ref only if it still points to the recorded SHA, using an atomic compare-and-swap update.
6. If the ref moved or any step fails, Git AI stops safely and leaves the original commit and workspace unchanged.

This is not a blind background `git commit --amend`.

## Privacy and local ownership

- **No Git AI relay server.** Diffs and draft messages go directly to the model endpoint you configure.
- **No uploaded analytics.** AI history and productivity data are local application metadata.
- **Local inference is supported.** Use Ollama when you do not want code sent to a cloud model.
- **Credentials stay out of projects.** API keys are stored in the operating system's private application-config directory.
- **No application-owned worktree files.** Runtime state, logs, and history live in the user-cache directory; project overrides live in `.git/config`.
- **Verified engine delivery.** Managed downloads are pinned to a release and checked against its published SHA-256 checksum.

Release checks and managed downloads may contact the Git AI release service or GitHub.

## Commit and Push, safely coordinated

With the default `queue` policy, Git AI understands the way JetBrains users work:

```text
Commit and Push
      │
      ├── commit completes immediately
      ├── AI polishing runs in the background
      └── recorded push proceeds when the exact replacement is ready
```

If a safe replay cannot be proven, Git AI stops and exposes an actionable recovery path. Choose the `block` policy if you prefer to push manually after polishing.

## Compatibility

- JetBrains IDEs **2024.1 or later** with bundled Git support
- IntelliJ IDEA and compatible IntelliJ Platform IDEs such as WebStorm, PyCharm, GoLand, PhpStorm, CLion, DataGrip, and RubyMine
- macOS, Linux, or Windows on a supported release architecture
- A Git repository
- An API key for cloud providers, or a local Ollama installation

The plugin manages the Git AI CLI for normal installations; a separate manual CLI setup is not required.

## Frequently asked questions

<details>
<summary><strong>Does Git AI block the Commit Tool Window?</strong></summary>
<br />
No. Git completes first. The post-commit hook launches detached work and returns, so the IDE is available immediately.
</details>

<details>
<summary><strong>Can it capture newer staged or unstaged changes by accident?</strong></summary>
<br />
No. The replacement is built from the exact recorded commit tree and parents. Newer index and worktree state are never used.
</details>

<details>
<summary><strong>What if I make another commit before polishing finishes?</strong></summary>
<br />
The recorded ref no longer matches the expected SHA, so the atomic update becomes a safe no-op. Git AI never rewrites a different commit.
</details>

<details>
<summary><strong>Can I restore my original commit message?</strong></summary>
<br />
Yes. Choose <strong>Undo AI Polish</strong> from the Git AI Tool Window or VCS actions. You can also retry generation or cancel active work.
</details>

<details>
<summary><strong>Do I need to install or update the CLI myself?</strong></summary>
<br />
Normally, no. The plugin can provision the matching release and notify you when an update is available. Every managed binary is validated before replacement.
</details>

<details>
<summary><strong>Where are project settings stored?</strong></summary>
<br />
Global settings live in the operating system's application-config directory. Project overrides use Git's local config, <code>.git/config</code>; Git AI does not add configuration or runtime files to the worktree.
</details>

---

<p align="center">
  <strong>Write code. Make the commit. Let Git AI refine the history.</strong>
  <br />
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai">Install Git AI for JetBrains IDEs</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/daidi/git-ai/issues">Report an issue</a>
  &nbsp;·&nbsp;
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai">Using VS Code?</a>
</p>
