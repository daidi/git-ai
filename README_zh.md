<p align="center">
  <img src="assets/icon.png" width="120" alt="git-ai logo" />
</p>

<h1 align="center">Git AI - 异步提交润色</h1>

<p align="center">
  <strong>告别等待，让 AI 在后台默默为您润色提交信息。</strong><br/>
  <strong>先提交，后思考 (Commit first, think later)。</strong><br/>
  <sub>AI 驱动的 Git 提交信息增强工具 —— 异步、无感、零负担。</sub>
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
  <a href="README.md">📖 English</a>
</p>

---

你写 `git commit -m "修个bug"`，Git log 立即显示 `[⏳] 修个bug` —— 让你（和 Cursor/Claude Code 等 AI 编程助手）一眼看到它正在被润色。几秒后，它变成了 `fix(auth): resolve session timeout on mobile devices` —— 静默的、后台的、不需要你动任何手指。

**git-ai** 挂接到你现有的 Git 工作流中，利用大语言模型将你的提交信息改写为干净的、符合 [Conventional Commits](https://www.conventionalcommits.org/) 规范的信息。这一切发生在你提交 *之后*，所以你永远不需要等待。临时的 `[⏳]` 前缀在 `git log` 中提供即时视觉反馈，防止 AI 编程助手误判。如果你在润色进行中执行 Push，推送会被排队，润色完成后自动发出。

## 💡 为什么要"先提交"？

大多数 AI Commit 工具让你在提交 *前* 等待。我们采取了完全相反的策略：

| | 传统 AI Commit 工具 | git-ai |
|:---|:---|:---|
| **工作流** | 生成 → 确认 → 提交 | 提交 → 后台润色 |
| **延迟** | 2–5 秒阻塞式等待 | 零。你继续写代码。 |
| **如果 AI 挂了？** | 提交根本不会发生 | 你的提交安全无忧 |
| **需要改习惯吗？** | 学新命令 | `git commit` —— 和以前一样 |

三个核心理由：

1. **即时保护现场** —— 你的代码变更在 `commit` 的一瞬间就进入了 Git 的版本追踪。哪怕 AI 服务宕机、断网，你的代码也是绝对安全的。
2. **不打断心流** —— 没有等待，没有确认弹窗。你 commit 然后继续写下一行代码。消息在幕后被静默润色。
3. **兼容所有习惯** —— 用终端的 `git commit -m`、用 IDE 的提交快捷键、用任何你喜欢的 Git 客户端。git-ai 是隐形的。

---

# 👩‍💻 献给使用者 (For Users)

## 🖥️ 沉浸式 IDE 体验

不需要改变任何习惯，直接在你的 IDE 里使用 Git AI！两款插件均提供原生集成 —— 状态展示、一键操作、全中文化设置面板。

### JetBrains IDEA 插件

原生 UI，支持操作撤销、重试和配置。

<p align="center">
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai">
    <img src="https://img.shields.io/badge/JetBrains_Marketplace-Install_Plugin-black?style=for-the-badge&logo=intellijidea&logoColor=white" alt="Install JetBrains Plugin" />
  </a>
</p>

### VS Code 扩展

支持状态栏与侧边栏的实时更新监听。

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai">
    <img src="https://img.shields.io/badge/VS_Code_Marketplace-Install_Extension-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install VS Code Extension" />
  </a>
  <a href="https://open-vsx.org/extension/git-ai-async-commit-polisher/git-ai">
    <img src="https://img.shields.io/badge/Open_VSX-Install_Extension-1C1C1C?style=for-the-badge&logo=vscodium&logoColor=white" alt="Install Open VSX Extension" />
  </a>
</p>

打开 VS Code，按 `Cmd+Shift+X` 并搜索 **git-ai**，或使用以下命令：

```bash
code --install-extension git-ai-async-commit-polisher.git-ai
```

## ✨ 核心特性

- 🔄 **异步 AI 润色** —— 通过 `post-commit` 钩子在后台增强提交信息
- ⏳ **实时状态可见** —— `git log` 显示 `[⏳]` 前缀表示润色中；成功后自动移除
- 🛡️ **自动恢复机制** —— 崩溃/超时自动回滚；极端情况可用 `git-ai recover` 手动恢复
- 🚀 **延迟推送** —— AI 工作时推送自动排队，完成后静默推送
- 📝 **4 种消息格式** —— `plain`、`conventional`、`gitmoji`、`subject+body`
- 🤖 **多模型供应商** —— OpenAI、DeepSeek、Ollama 及所有兼容 API
- ✂️ **智能 Diff 裁剪** —— 三级 Token 截断，处理超大 Diff 不溢出
- 🔔 **系统通知** —— 润色/推送完成时发送操作系统原生通知
- ⏪ **撤销与重试** —— 随时恢复原始消息或重新生成

## 📦 CLI 手动安装 (如果你只用终端)

> **注意**: 如果你已经安装了 VS Code 或 JetBrains 插件，**请跳过本节，无需任何手动安装**。插件会在后台自动为你下载并管理跨平台的 CLI 核心引擎。

### GitHub Releases (推荐，无需任何依赖)
从 [Releases 页面](https://github.com/daidi/git-ai/releases) 直接下载适用于 macOS、Linux 或 Windows 的最新单文件二进制程序。
由于发布产物较多，首次下载请参考以下对照表：

| 操作系统 | 架构 / 芯片 | 下载文件 |
| :--- | :--- | :--- |
| **Windows** | 64位 (绝大多数) | `git-ai_windows_amd64.zip` |
| **Windows** | ARM (部分轻薄本) | `git-ai_windows_arm64.zip` |
| **macOS** | Apple Silicon (M1/M2/M3) | `git-ai_darwin_arm64.tar.gz` |
| **macOS** | Intel 芯片 | `git-ai_darwin_amd64.tar.gz` |
| **Linux** | 64位 / ARM | 提供 `.deb`, `.rpm` 或直接下载 `.tar.gz` |

> *提示：Windows 用户下载压缩包后，将其中的 `git-ai.exe` 解压并配置到系统的 `Path` 环境变量中即可。*



### 包管理器

```bash
# Homebrew (macOS/Linux)
brew install daidi/tap/git-ai

# Scoop (Windows)
scoop bucket add daidi https://github.com/daidi/scoop-bucket.git
scoop install daidi/git-ai

# Go Install (针对 Go 开发者)
go install github.com/daidi/git-ai/cli/cmd/git-ai@latest
```

## 🚀 快速开始

```bash
# 1. 在你的仓库中初始化（注入后台 Git 钩子）
cd your-project
git-ai init

# 2. 配置 API 密钥（全局生效，仅需一次）
git-ai config set api_key sk-your-key --global

# 3. 像往常一样提交 —— AI 在后台静默干活！
git commit -m "修个bug"
# ✨ git-ai: 正在后台润色 (PID 12345)

# 4. 推送 —— 润色中则排队，完成后自动推送
git push
# ⏳ git-ai: AI 正在润色，推送已排队 —— 完成后将自动推送。

# 5. 随时查看状态
git log -1
# 显示: [⏳] 修个bug (润色中)
# 然后:  fix(auth): resolve session timeout on mobile devices

# 6. 如果润色卡住（极少发生），手动恢复
git-ai recover
# ✅ 恢复完成。
```

就这么简单！你的提交信息现在永远都是干净、精准、符合规范的，无需任何等待。

## ⚙️ 模型与配置

git-ai 支持分层配置系统：**环境变量 → 项目级 (`.git-ai.json`) → 全局级 (`~/.config/git-ai/config.json`) → 默认值**。

> 💡 **强烈建议**：使用 **快速模型**（flash/mini/turbo 系列）。它们成本降低 10 倍、响应时间约 500ms，对于提交信息润色完全够用。绝大多数情况下你不会感到任何延迟。

### 常见模型配置

```bash
# DeepSeek (推荐 — 快速且便宜)
git-ai config set api_key sk-xxx --global
git-ai config set model deepseek-chat --global

# OpenAI (推荐使用 mini 快速模型)
git-ai config set base_url https://api.openai.com/v1 --global
git-ai config set api_key sk-xxx --global
git-ai config set model gpt-4o-mini --global

# 通义千问 (极快，中文友好)
git-ai config set base_url https://dashscope.aliyuncs.com/compatible-mode/v1 --global
git-ai config set api_key sk-xxx --global
git-ai config set model qwen-turbo --global

# Ollama (本地、免费、隐私)
git-ai config set provider ollama --global
git-ai config set model llama3 --global
git-ai config set base_url http://localhost:11434 --global
```

### 更多常用配置

| 命令 | 默认值 | 说明 |
|:---|:---|:---|
| `git-ai config set language zh-CN --global` | `en` | 输出语言（`en`、`zh-CN`、`ja` 等） |
| `git-ai config set push_policy queue --global` | `queue` | `queue`=自动推送, `block`=阻止未完成的推送 |
| `git-ai config set message_format gitmoji --global`| `conventional` | `plain`, `conventional`, `gitmoji`, `subject-body`|

---

# 👨‍💻 献给开发者 (For Developers)

## 🏗️ 架构与工作原理

我们采用 **Monorepo** 架构，将 CLI 后台引擎与不同 IDE 平台的前端插件进行了解耦，并通过共享 `.git/git-ai/state.json` 的无状态文件机制进行通信。

```
git commit -m "修个bug"
        │
        ▼
   [post-commit 钩子]
        │
        ├── 派生后台守护进程（极速脱离终端）
        │    │
        │    ├── 立即标记: git commit --amend -m "[⏳] 修个bug"
        │    ├── 检测 diff 并在协程调用 LLM
        │    ├── 成功时: git commit --amend -m "fix(auth): ..."
        │    ├── 失败时: 回滚到 "修个bug" (无 [⏳])
        │    ├── 若检测到排队推送中 → 自动 push
        │    └── 通知 IDE 插件更新状态 / 发送系统气泡提醒
        │
        └── 同步退出终端拦截 → 你继续写代码
```

- **`cli/` (Go 1.23+)**：处理 `post-commit` / `pre-push` 钩子的绑定、守护进程派发、LLM 逻辑增强重写。
- **`idea-plugin/` (Kotlin)**：利用 JetBrains VFS 机制非阻塞监听 `state.json`，在 UI 侧回显状态。
- **`vscode-extension/` (TS)**：原生 VS Code UI/TreeView，利用 FS Polling 无缝桥接核心引擎。

## 🖥️ 源码编译与测试

针对有定制需要的二次开发者或维护者：

### 编译 CLI 后台引擎

```bash
cd cli
make build
make install
```

### 本地运行与调试 IDE 插件

1. **IntelliJ 插件**：进入 `idea-plugin` 目录执行 `./gradlew runIde`，即可打开包含插件调试沙盒的 IDEA 实例。如果仅需编译打包，可执行 `./gradlew buildPlugin`。
2. **VS Code 扩展**：进入 `vscode-extension` 目录执行 `npm install` 后，按 `F5` 即可在扩展开发宿主环境中启动调试。

## 🚀 项目维护与发版

项目中提供了一个统一的版本跨生态管理脚本，用于在此项目发版时，自动同步修改 CLI、VS Code 和 IntelliJ 的版本号。

1. 请确保当前工作区干净没有未提交的改动。运行跨生态升版脚本：
   ```bash
   ./scripts/bump-version.sh 0.3.0
   ```
2. 脚本会自动更新 `vscode-extension/package.json` 以及 `idea-plugin/gradle.properties` 的配置。
3. 把变更文件进行发版提交并 Push Tag：
   ```bash
   git add vscode-extension/package.json idea-plugin/gradle.properties
   git commit -m "chore(release): bump version to 0.3.0"
   git tag v0.3.0
   git push origin main v0.3.0
   ```

接下来，触发的 Tag 流水线会自动化完成 GoReleaser 对 Homebrew、Scoop 以及 GitHub Releases 的分发工作。

## 📝 开源协议

[MIT](LICENSE)

---

<p align="center">
  <sub>本项目自身的 Git 提交历史由 <code>git-ai</code> 自动润色与维护 🤖</sub>
</p>
