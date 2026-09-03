<p align="center">
  <img src="https://raw.githubusercontent.com/daidi/git-ai/main/assets/icon.png" width="112" alt="Git AI — asynchronous AI commit message generator for VS Code" />
</p>

<h1 align="center">Git AI for VS Code</h1>

<p align="center">
  <strong>The asynchronous AI commit message generator that never interrupts your flow.</strong>
  <br />
  Commit now. Keep coding. Let Git AI polish the message in the background.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai"><img src="https://vsmarketplacebadges.dev/version-short/git-ai-async-commit-polisher.git-ai.svg?style=flat-square&color=007ACC" alt="Git AI version on the Visual Studio Marketplace" /></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai"><img src="https://vsmarketplacebadges.dev/installs-short/git-ai-async-commit-polisher.git-ai.svg?style=flat-square&color=2563EB" alt="Git AI installs from the Visual Studio Marketplace" /></a>
  <a href="https://open-vsx.org/extension/git-ai-async-commit-polisher/git-ai"><img src="https://img.shields.io/open-vsx/v/git-ai-async-commit-polisher/git-ai?style=flat-square&label=Open%20VSX&color=1C1C1C" alt="Git AI version on Open VSX" /></a>
  <a href="https://github.com/daidi/git-ai/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-64748B?style=flat-square" alt="MIT license" /></a>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai"><strong>Install for VS Code</strong></a>
  &nbsp;·&nbsp;
  <a href="https://open-vsx.org/extension/git-ai-async-commit-polisher/git-ai">Install from Open VSX</a>
  &nbsp;·&nbsp;
  <a href="https://codegg.org/git-ai/">Website</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/daidi/git-ai">GitHub</a>
</p>

---

Git AI is an **AI-powered Git commit message generator for VS Code**. It turns rough drafts into clear Conventional Commits, Gitmoji commits, plain messages, or subject-and-body commits—**after** your commit has already completed.

```text
$ git commit -m "fix auth"

  You keep coding  ────────────────►  Git AI works in the background

  "fix auth"       ────────────────►  "fix(auth): handle expired mobile sessions"
```

There is no generation dialog to wait for and no new commit command to learn. Use the VS Code Source Control view, the integrated terminal, or your existing Git client exactly as you do today.

## Why Git AI feels different

Most AI commit tools make generation part of the critical path. Git AI moves it out of your way.

| | Typical AI commit generator | Git AI |
|:--|:--|:--|
| **Workflow** | Generate → wait → review → commit | Commit → continue coding → polish in background |
| **Terminal / IDE** | Blocked while the model responds | Available immediately |
| **If the model fails** | The commit may never happen | Your original commit remains intact |
| **Push right away** | Requires manual coordination | Can queue the exact push until polishing finishes |
| **New habit required** | Usually | No—keep using standard Git |

> **Commit first, think later.** Your code is snapshotted immediately; AI improves the message asynchronously.

## A complete Git AI workspace inside VS Code

| Native experience | What it gives you |
|:--|:--|
| **Activity Bar control center** | Live status, common actions, local productivity stats, and repository health at a glance |
| **Status Bar** | See `polishing`, `pushing`, `failed`, and `idle` states without leaving your editor |
| **AI History** | Review polished commits, original drafts, model names, and generation latency |
| **Visual configuration** | Manage global defaults and per-repository overrides without editing JSON |
| **One-click recovery** | Retry, undo, cancel, push, skip the next commit, or clean a stale marker |
| **Managed engine** | Installs and updates the matching Git AI CLI with published SHA-256 verification |
| **Localized UI** | Native interface translations across 16 languages, including Malay |

You can also access Git AI actions directly from the **Source Control title menu** and the **Command Palette**.

## Get started in under a minute

### 1. Install the extension

Install from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai), [Open VSX](https://open-vsx.org/extension/git-ai-async-commit-polisher/git-ai), or run:

```bash
code --install-extension git-ai-async-commit-polisher.git-ai
```

### 2. Open a trusted Git repository

Git AI detects the repository, offers to install its verified background engine if needed, and asks once before enabling the composable Git hooks. In VS Code Restricted Mode, binary execution, downloads, and hook changes remain disabled.

### 3. Connect your model

Open the Command Palette and run **Git AI: Open Configuration**. Choose a provider, model, output format, and language, then test the connection.

Cloud providers require your own API key. Ollama can run locally without one.

### 4. Commit normally

```bash
git commit -m "update checkout"
```

That is the entire workflow. The extension shows progress while the detached engine produces a better message in the background.

## Providers, models, and commit styles

Bring the model that fits your privacy, quality, and cost requirements.

| Provider | Support |
|:--|:--|
| **OpenAI-compatible APIs** | OpenAI, DeepSeek, Qwen, and compatible endpoints |
| **Anthropic** | Native Claude API support |
| **Google** | Native Gemini API support |
| **Ollama** | Local and offline-capable model execution |

Available message formats:

- **Conventional Commits** — `fix(auth): refresh expired sessions`
- **Gitmoji** — `🐛 fix(auth): refresh expired sessions`
- **Plain** — concise natural-language subjects
- **Subject + body** — a short subject followed by the what and why

You can also choose the output language, enable an explanation of *why* the change was made, set a diff limit, and provide a custom prompt template.

## Safe by design

Git AI is built around one rule: **AI must never put your repository at risk.**

1. The hook records the exact commit SHA and branch ref, then exits immediately.
2. A detached process sends the recorded diff and your draft message to the model provider you configured.
3. Git AI creates a replacement commit from the recorded tree and parents—it does not read staged or newer work into that commit.
4. The branch moves only through an atomic compare-and-swap update. If the branch has moved, Git AI performs a safe no-op.
5. Network, authentication, rate-limit, or model failures leave the original commit and workspace unchanged.

This is not a blind `git commit --amend` running behind your back.

## Privacy without a relay server

- **Your diff goes directly to your configured model endpoint.** Git AI does not proxy prompts through a Git AI server.
- **No analytics are uploaded.** AI history and productivity estimates stay on your machine.
- **Local mode is available.** Pair Git AI with Ollama to keep model inference on your computer.
- **Credentials stay out of the repository.** User API keys live in the operating system's private application-config directory.
- **Runtime data stays out of the worktree.** State, logs, and AI history live in the operating system's user-cache directory; repository overrides use `.git/config`.

Release checks and managed CLI downloads may contact the Git AI release service or GitHub. Downloaded binaries are verified against the published SHA-256 checksum before installation.

## Push without racing the AI

The default `queue` policy handles the common “commit, then push immediately” habit:

```text
git commit  →  polishing starts
git push    →  exact ref update is queued
polish done →  queued push is replayed safely
```

Prefer manual control? Switch the push policy to `block`; Git AI will ask you to push again after polishing completes.

## Requirements

- VS Code **1.85 or later**, or a compatible Open VSX editor
- A Git repository in a trusted workspace
- macOS, Linux, or Windows on a supported release architecture
- An API key for cloud providers, or a local Ollama installation

The extension manages the Git AI CLI for normal installations. You do not need to install it separately.

## Frequently asked questions

<details>
<summary><strong>Does Git AI change my files, index, or staged work?</strong></summary>
<br />
No. Polishing creates a replacement from the exact recorded commit tree and parents. Staged, unstaged, and newer changes are not captured.
</details>

<details>
<summary><strong>Can I review or reverse an AI-generated commit message?</strong></summary>
<br />
Yes. Open the Git AI sidebar or Source Control menu to inspect AI history, restore the original message, retry generation, or cancel active work.
</details>

<details>
<summary><strong>Does it work with commits made outside the VS Code UI?</strong></summary>
<br />
Yes. Once the repository hooks are enabled, commits from the integrated terminal and other Git clients use the same asynchronous workflow.
</details>

<details>
<summary><strong>What happens when the provider is unavailable?</strong></summary>
<br />
Git AI records a safe, actionable failure and leaves the original commit untouched. Fix the provider setting or network issue, then choose <strong>Retry AI Polish</strong>.
</details>

<details>
<summary><strong>Can teams use different models or formats per repository?</strong></summary>
<br />
Yes. Global settings provide your defaults; repository settings stored in <code>.git/config</code> can override provider, model, language, format, prompt, and behavior without adding files to the project.
</details>

---

<p align="center">
  <strong>Better commit history. Zero waiting.</strong>
  <br />
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai">Install Git AI for VS Code</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/daidi/git-ai/issues">Report an issue</a>
  &nbsp;·&nbsp;
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai">Using a JetBrains IDE?</a>
</p>
