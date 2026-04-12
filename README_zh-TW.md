<p align="center">
  <img src="assets/icon.png" width="120" alt="git-ai logo" />
</p>

<h1 align="center">Git AI：零摩擦的異步提交潤色</h1>

<p align="center">
  <strong>告別等待。你只管寫程式，讓 Git AI 在背景默默為你寫好提交訊息。</strong>
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
    <a href="README.md">English</a> |
    <a href="README_zh-CN.md">简体中文</a> |
    繁體中文 |
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

## ⚡️ 痛點：AI 工具正在打破你的心流

絕大多數 AI Git 工具都在強迫你進入一場同步的「等待遊戲」：暫存程式碼，點擊「產生」，盯著讀取條等待，檢視修改，*最後*再點擊提交。這種摩擦感嚴重破壞了開發者的心流。

## 🚀 破局：「先提交，後思考」

Git AI 以純異步、純背景的處理機制徹底顛覆了這個流程。

你只需要像往常一樣敲下：
`git commit -m "修個bug"`

**這就夠了。你可以立刻回去繼續寫你的程式碼。**

在這個瞬間，一個解耦的背景守護進程會安全地將你的 Diff 發送給 LLM，應用規範化語義標準，並在背景默默地使用 `--amend` 將你的提交改寫為：
`fix(auth): resolve session timeout on mobile devices`

即使你習慣於提交後直接 Push，Git AI 也會優雅地攔截並排隊你的 Push 請求，等待潤色完成後自動推送到遠端。**零習慣破壞。**

## 💡 為什麼它體驗更好？

| | 傳統 AI 提交工具 | Git AI |
|:---|:---|:---|
| **工作流** | 產生 → 等待 → 評審 → 提交 | 提交 → 寫程式庫 → 背景潤色 |
| **等待延遲** | 2–5 秒阻塞式等待 | **絕對的零等待。** |
| **若 AI 斷網/當機？**| 提交被迫中斷 | 你的提交已在本地，絕對安全 |
| **需要改變習慣嗎？**| 需要學習新按鈕/新快捷鍵 | 標準的 `git commit` |

---

# 👩‍💻 獻給使用者 (For Users)

## 🖥️ 沉浸式 IDE 體驗

不需要改變任何習慣，直接在你的 IDE 裡使用 Git AI！兩款外掛程式均提供原生整合 —— 狀態展示、一鍵操作、全中文化設定面板。

### JetBrains IDEA 外掛程式
<p align="center">
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai">
    <img src="https://img.shields.io/badge/JetBrains_Marketplace-Install_Plugin-black?style=for-the-badge&logo=intellijidea&logoColor=white" alt="Install JetBrains Plugin" />
  </a>
</p>

### VS Code 擴充功能
<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai">
    <img src="https://img.shields.io/badge/VS_Code_Marketplace-Install_Extension-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install VS Code Extension" />
  </a>
</p>

## ✨ 核心特性

- 🔄 **異步 AI 潤色** —— 透過 `post-commit` 鉤子在背景增強提交訊息
- ⏳ **即時狀態可見** —— `git log` 顯示 `[⏳]` 前綴表示潤色中；成功後自動移除
- 🛡️ **自動恢復機制** —— 崩潰/超時自動回滾；極端情況可用 `git-ai recover` 手動恢復
- 🚀 **延遲推播** —— AI 處理時推播自動排隊，完成後靜默推播
- 🤖 **原生多廠商接入** —— 深度支援 OpenAI、Anthropic Claude、Google Gemini、DeepSeek、Ollama 及相容 API

## 🚀 快速開始

```bash
# 1. 在你的存放庫中初始化（注入背景 Git Hook）
cd your-project
git-ai init

# 2. 配置 API 金鑰（全域生效，僅需一次）
git-ai config set api_key sk-your-key --global

# 3. 像往常一樣提交 —— AI 在背景靜默幹活！
git commit -m "修個bug"

# 4. 推播 —— 潤色中則排隊，完成後自動推播
git push
```
