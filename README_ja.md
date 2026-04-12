<p align="center">
  <img src="assets/icon.png" width="120" alt="git-ai logo" />
</p>

<h1 align="center">Git AI: 摩擦のない非同期コミット・ポリッシャー</h1>

<p align="center">
  <strong>AIを待つ必要はありません。Git AIがバックグラウンドでコミットメッセージを作成している間、コーディングを続けましょう。</strong>
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
    <a href="README_zh-TW.md">繁體中文</a> |
    <a href="README_fr.md">Français</a> |
    <a href="README_it.md">Italiano</a> |
    <a href="README_de.md">Deutsch</a> |
    <a href="README_es.md">Español</a> |
    日本語 |
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

## ⚡️ 問題点: AIツールはあなたの集中を妨げます

ほとんどのAI Gitツールは、ファイルをステージし、「生成」をクリックし、ロードスピナーを待ち、レビューし、*最後に*コミットするという「同期的な待ちゲーム」を強制します。この摩擦があなたの勢いを殺します。

## 🚀 解決策: 「先にコミットし、後で考える」

Git AIは、純粋な非同期バックグラウンド処理でそのプロセスを覆します。

あなたは単にこう入力するだけです：
`git commit -m "バグ修正"`

**これで終わりです。** あなたはすぐにコードを書き続けることができます。

その間、デタッチされたバックグラウンドデーモンが安全にDiffをLLM（AI）に送信し、Conventional Commitsの標準を適用し、バックグラウンドで静かに `--amend` によってコミットを書き換えます：
`fix(auth): resolve session timeout on mobile devices`

もしあなたがコミット後すぐにプッシュする癖があっても大丈夫です。Git AIはプッシュをキューに入れ、AIの推敲が終わるのを待ち、準備ができたら自動的にプッシュします。**あなたの習慣は一切壊れません。**

## 💡 なぜGit AIの方が優れているのか？

| | 従来のAIツール | Git AI |
|:---|:---|:---|
| **ワークフロー** | 生成 → 待つ → レビュー → コミット | コミット → コーディング → バックグラウンドで推敲 |
| **遅延 (レイテンシ)** | 2–5秒のブロッキング待機 | **ゼロ。すぐにコードに戻れます。** |
| **AIがエラーになったら？** | コミットは行われません | 最初のコミットがローカルに安全に保存されます |
| **習慣の変更？** | 新しいボタンやショートカットを学ぶ必要 | 標準の `git commit` |

1. **安全第一：** コードは*即座に*Gitの履歴に入ります。AIサービスがダウンしても、作業のスナップショットは安全に保存されます。
2. **AIエージェントに優しい：** Git logを使用する場合、推敲中は一時的に `[⏳]` プレフィックスが表示されるため、CursorやClaude CodeなどのAIコーディングツールが重複コミットを行うのを防ぎます。
3. **完全に透明な体験：** ターミナル、JetBrains、VS Codeなど、あらゆる環境でバックグラウンドでシームレスに動作します。

---

# 👩‍💻 ユーザー向け

## 🖥️ シームレスなIDE統合

習慣を変える必要はありません。お気に入りのIDE内でGit AIを直接使用しましょう！どちらのプラグインもネイティブな統合を提供し、ステータス表示、ワンクリック・アクション、組み込みの設定パネルを備えています。

### JetBrains IDEA プラグイン

元に戻す、再試行、設定をサポートするネイティブUI。

<p align="center">
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai">
    <img src="https://img.shields.io/badge/JetBrains_Marketplace-Install_Plugin-black?style=for-the-badge&logo=intellijidea&logoColor=white" alt="Install JetBrains Plugin" />
  </a>
</p>

### VS Code 拡張機能

サイドバーとステータスバーによるリアルタイム状態監視。

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai">
    <img src="https://img.shields.io/badge/VS_Code_Marketplace-Install_Extension-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install VS Code Extension" />
  </a>
  <a href="https://open-vsx.org/extension/git-ai-async-commit-polisher/git-ai">
    <img src="https://img.shields.io/badge/Open_VSX-Install_Extension-1C1C1C?style=for-the-badge&logo=vscodium&logoColor=white" alt="Install Open VSX Extension" />
  </a>
</p>

## ✨ コア機能

- 🔄 **非同期 AI 推敲** —— `post-commit` フックによりバックグラウンドでメッセージを改善
- ⏳ **リアルタイムステータス** —— 進行中は `git log` に `[⏳]` を表示。完了後に自動削除
- 🛡️ **自動復旧** —— クラッシュ/ターイムアウト時の自動ロールバック。手動での `git-ai recover` コマンドも完備
- 🚀 **遅延プッシュ** —— AI作動中にプッシュした場合自動キュー待ちし、完了後にサイレントプッシュ
- 🤖 **様々なマルチモデル対応** —— OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Ollama や互換APIに深く対応
- ✂️ **スマート Diff 切り詰め** —— 巨大なDiffでのコンテキスト・オーバーフローを防ぐ3段階トークン切り詰め
- 📐 **Commitlint 統合** —— リポジトリの仕様に従うため、ローカルの `.commitlintrc` を自動読み込み
- 🎩 **強力な自作プロンプト機能** —— Go `text/template` 対応で絶対的なフォーマット制御
- 🧐 **理由付きコミットモード (Explain mode)** —— コミットのメッセージに「なぜ」変更したのかの理由を生成追加 (`git-ai config set explain true`)

## 📦 手動 CLI インストール (ターミナルユーザー向け)

> **注意**: VS Code または JetBrains プラグインを使用している場合、**CLIを手動でインストールしないでください**。プラグインが自動的にCLIのダウンロードと管理を行います。

### Homebrew (macOS/Linux)
```bash
brew install daidi/tap/git-ai
```

## 🚀 クイックスタート

```bash
# 1. あなたのリポジトリで初期化（Gitフックのインストール）
cd your-project
git-ai init

# 2. APIキーの設定 (一度だけでOKのグローバル設定)
git-ai config set api_key sk-your-key --global

# 3. いつも通りコミット — AIがバックグラウンドで推敲！
git commit -m "fix bug"

# 4. プッシュ — 推敲中であれば待機し、完了時に自動プッシュ
git push
```
