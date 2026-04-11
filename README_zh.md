<p align="center">
  <img src="assets/icon.png" width="120" alt="git-ai logo" />
</p>

<h1 align="center">git-ai</h1>

<p align="center">
  <strong>Commit first, think later.</strong><br/>
  <sub>AI 驱动的 Git 提交信息增强工具 —— 异步、无感、零负担。</sub>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://go.dev"><img src="https://img.shields.io/badge/Go-1.23+-00ADD8.svg?logo=go&logoColor=white" alt="Go" /></a>
  <a href="https://github.com/daidi/git-ai/releases"><img src="https://img.shields.io/github/v/release/daidi/git-ai?label=Release&color=8B5CF6" alt="Release" /></a>
  <a href="https://goreportcard.com/report/github.com/daidi/git-ai"><img src="https://goreportcard.com/badge/github.com/daidi/git-ai" alt="Go Report Card" /></a>
  <a href="https://github.com/daidi/git-ai/actions"><img src="https://img.shields.io/github/actions/workflow/status/daidi/git-ai/release.yml?logo=github&label=Build" alt="Build Status" /></a>
  <br/>
  <a href="https://marketplace.visualstudio.com/items?itemName=daidi.git-ai"><img src="https://img.shields.io/visual-studio-marketplace/i/daidi.git-ai?label=VS%20Code&logo=visualstudiocode&color=007ACC" alt="VS Code Installs" /></a>
  <img src="https://img.shields.io/badge/JetBrains-Plugin-blue?logo=intellijidea&logoColor=white&color=000000" alt="JetBrains Plugin" />
  <br/>
  <a href="README.md">📖 English</a>
</p>

---

你写 `git commit -m "修个bug"`，几秒后，它变成了 `fix(auth): resolve session timeout on mobile devices` —— 静默的、后台的、不需要你动任何手指。

**git-ai** 挂接到你现有的 Git 工作流中，利用大语言模型将你的提交信息改写为干净的、符合 [Conventional Commits](https://www.conventionalcommits.org/) 规范的信息。这一切发生在你提交 *之后*，所以你永远不需要等待。如果你在润色进行中执行 Push，推送会被排队，润色完成后自动发出。

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

## ✨ 特性

- 🔄 **异步 AI 润色** —— 通过 `post-commit` 钩子在后台增强提交信息
- 🚀 **延迟推送** —— AI 工作时推送自动排队，完成后静默推送
- 📝 **4 种消息格式** —— `plain`、`conventional`、`gitmoji`、`subject+body`
- 🤖 **多模型供应商** —— OpenAI、DeepSeek、Ollama 及所有 OpenAI 兼容 API
- ✂️ **智能 Diff 裁剪** —— 三级 Token 截断，处理超大 Diff 不溢出
- 🔔 **系统通知** —— 润色/推送完成时发送操作系统原生通知
- ⏪ **撤销与重试** —— 随时恢复原始消息或重新生成
- 🖥️ **IDE 插件** —— 原生 VS Code 扩展和 IntelliJ IDEA 插件

## 📦 安装

### GitHub Releases (推荐)
从 [Releases 页面](https://github.com/daidi/git-ai/releases) 直接下载适用于 macOS、Linux 或 Windows 的最新免安装二进制文件。

### 包管理器

```bash
# Homebrew (macOS/Linux)
brew install daidi/tap/git-ai

# Go install
go install github.com/daidi/git-ai/cli/cmd/git-ai@latest

# 从源码编译
cd cli && make install
```

## 🚀 快速开始

```bash
# 1. 在你的仓库中初始化（安装 Git 钩子）
cd your-project
git-ai init

# 2. 配置 API 密钥（仅需一次）
git-ai config set api_key sk-your-key --global

# 3. 像往常一样提交 —— AI 在后台润色
git commit -m "修个bug"
# ✨ git-ai: 正在后台润色 (PID 12345)

# 4. 推送 —— 润色中则排队，完成后自动推送
git push
# ⏳ git-ai: AI 正在润色，推送已排队 —— 完成后将自动推送。
```

就这样。你的提交信息现在是一条干净、精准、符合规范的消息 —— 而你什么都不需要想。

## 🏗️ 工作原理

```
git commit -m "修个bug"
        │
        ▼
   [post-commit 钩子]
        │
        ├── 派生后台守护进程（非阻塞）
        │    │
        │    ├── 读取 diff + 原始消息
        │    ├── 调用 LLM（DeepSeek / OpenAI / Ollama）
        │    ├── git commit --amend -m "fix(auth): ..."
        │    ├── 若有待推送 → 自动 push
        │    └── 发送系统通知 🔔
        │
        └── 立即退出 → 你继续写代码

git push
        │
        ▼
   [pre-push 钩子]
        │
        ├── 若正在润色 → 排队推送, exit 1
        └── 若空闲 → 放行推送, exit 0
```

## ⚙️ 配置

git-ai 使用分层配置系统。值的解析优先级：**环境变量 → 项目级 → 全局级 → 默认值**。

### 配置文件

| 作用域 | 路径 | 说明 |
|:---|:---|:---|
| 全局 | `~/.config/git-ai/config.json` | 所有仓库共享 |
| 项目 | `<repo>/.git-ai.json` | 当前仓库覆盖 |
| 环境变量 | `GIT_AI_API_KEY`, `GIT_AI_MODEL` 等 | 运行时覆盖 |

### 配置项

| 键 | 默认值 | 说明 |
|:---|:---|:---|
| `api_key` | — | LLM API 密钥 |
| `model` | `deepseek-chat` | 模型名称 |
| `base_url` | `https://api.deepseek.com/v1` | API 端点 |
| `provider` | `openai` | `openai` 或 `ollama` |
| `language` | `en` | 输出语言（`en`、`zh-CN`、`ja`、`ko` 等） |
| `push_policy` | `queue` | `queue` = 自动推送, `block` = 手动推送 |
| `message_format` | `conventional` | `plain`、`conventional`、`gitmoji`、`subject-body` |
| `max_diff_tokens` | `4000` | 发送给 LLM 的最大 Diff Token 数 |

### 消息格式示例

```bash
# plain
Fix the login timeout bug on mobile

# conventional（默认）
fix(auth): resolve login timeout on mobile devices

# gitmoji
🐛 fix(auth): resolve login timeout on mobile devices

# subject-body
Fix login timeout on mobile

The session cookie was not being refreshed when the user
switched between mobile and desktop views.
```

### 模型供应商配置

```bash
# DeepSeek（默认）
git-ai config set api_key sk-xxx --global
git-ai config set model deepseek-chat --global

# OpenAI
git-ai config set base_url https://api.openai.com/v1 --global
git-ai config set model gpt-4o --global

# Ollama（本地部署，无需 API Key）
git-ai config set provider ollama
git-ai config set model llama3
git-ai config set base_url http://localhost:11434
```

## 🛠️ CLI 命令

| 命令 | 说明 |
|:---|:---|
| `git-ai init` | 在当前仓库安装钩子和状态目录 |
| `git-ai config set <key> <val>` | 设置配置值（加 `--global` 为全局） |
| `git-ai config get <key>` | 读取配置值（合并后） |
| `git-ai config list` | 显示完整合并配置 |
| `git-ai retry` | 重新生成上次提交的 AI 消息 |
| `git-ai undo` | 恢复原始提交信息 |

## 🖥️ IDE 插件

两款插件均提供原生集成 —— 状态展示、一键操作、以及支持 i18n（英文 + 中文）的设置界面。

### VS Code 扩展

<table><tr>
<td width="50%">

- **状态栏** —— 实时展示润色 / 推送 / 空闲状态
- **侧边栏** —— 状态树 + 操作 Webview 面板
- **设置界面** —— 全局 + 项目配置，原生 Codicon 图标
- **国际化** —— 自动检测 VS Code 语言（en / zh-CN）
- **通知** —— 润色/推送完成时弹出提示

</td>
<td>

```bash
cd vscode-extension
npm install && npm run compile
# Cmd+Shift+P → "Install Extension from Location..."
```

</td>
</tr></table>

### IntelliJ IDEA 插件

<table><tr>
<td width="50%">

- **状态栏组件** —— 底部实时状态展示
- **工具窗口** —— Status + Logs 双标签，自动跟踪日志
- **原生设置** —— `Settings → Tools → git-ai`，支持中文
- **VCS 菜单** —— 重试、撤销、取消、强制推送、配置
- **IDE 通知** —— 状态切换时气泡提醒

</td>
<td>

```bash
cd idea-plugin
./gradlew buildPlugin
# → build/distributions/git-ai-0.1.0.zip
# Settings → Plugins → ⚙️ → 从磁盘安装...
```

</td>
</tr></table>

> **注意：** 两款插件仅负责 UI 展示 —— 它们观察 `state.json` 并委托给 `git-ai` CLI 执行。CLI 需要安装在系统 PATH 中。

## 📝 开源协议

[MIT](LICENSE)

---

<p align="center">
  <sub>本提交信息由 <code>git-ai</code> 自动优化 🤖</sub>
</p>
