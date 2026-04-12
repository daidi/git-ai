<p align="center">
  <img src="assets/icon.png" width="120" alt="git-ai logo" />
</p>

<h1 align="center">Git AI: 제로 마찰 비동기 커밋 메시지 윤색</h1>

<p align="center">
  <strong>AI를 기다리지 마세요. 백그라운드에서 Git AI가 커밋 메시지를 작성하는 동안 계속 코딩하세요.</strong>
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
    <a href="README_ja.md">日本語</a> |
    한국어 |
    <a href="README_pt.md">Português</a> |
    <a href="README_ru.md">Русский</a> |
    <a href="README_ar.md">العربية</a> |
    <a href="README_vi.md">Tiếng Việt</a> |
    <a href="README_th.md">ไทย</a> |
    <a href="README_id.md">Bahasa Indonesia</a>
  </h4>
</p>

---

## ⚡️ 문제점: AI 도구가 개발 흐름을 깨뜨립니다

대부분의 AI Git 도구는 동기식 대기 게임을 강요합니다. 파일을 스테이징하고, "생성"을 클릭하고, 로딩 표시를 기다리고, 검토하고, *마지막으로* 커밋합니다. 이러한 마찰은 엄청난 지연을 초래합니다.

## 🚀 해결책: "먼저 커밋하고, 나중에 생각하세요"

Git AI는 순수한 비동기식 백그라운드 처리로 이 프로세스를 완전히 뒤집습니다.

간단하게 입력하면 끝납니다:
`git commit -m "버그 수정"`

**이것으로 끝입니다.** 개발자는 즉시 코드 작성으로 돌아갈 수 있습니다.

그동안 백그라운드의 숨겨진 데몬이 안전하게 Diff를 LLM으로 전송하고, Conventional Commits 표준을 적용하여 백그라운드에서 조용히 커밋을 `--amend` 합니다:
`fix(auth): resolve session timeout on mobile devices`

만약 당신이 커밋 후 즉시 푸시하는 습관이 있더라도 걱정하지 마세요. Git AI는 푸시를 대기열에 담아두고 AI 윤색이 끝날 때까지 기다린 후 준비가 되면 자동으로 푸시합니다. **습관을 전혀 바꿀 필요가 없습니다.**

## 💡 왜 Git AI가 더 나은가요?

| | 전통적인 AI 도구 | Git AI |
|:---|:---|:---|
| **워크플로우** | 생성 → 대기 → 검토 → 커밋 | 커밋 → 코딩 → 백그라운드에서 윤색 |
| **대기 지연** | 2–5초 동안 대기 | **대기시간 0. 바로 코딩하세요.** |
| **AI가 실패하면?** | 커밋이 아예 සිදු되지 않음 | 안전하게 커밋됨 |
| **습관 변경?** | 새 버튼이나 단축키를 배워야 함 | 표준 `git commit` 그대로 사용 |

---

# 👩‍💻 사용자를 위해

## 🖥️ 원활한 IDE 환경 통합

습관을 바꿀 필요가 없습니다. 좋아하는 IDE 내에서 Git AI를 직접 사용하세요! 두 플러그인 모두 네이티브 통합, 상태 표시, 원클릭 작업, 내장 설정 패널을 제공합니다.

### JetBrains IDEA 플러그인
<p align="center">
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai">
    <img src="https://img.shields.io/badge/JetBrains_Marketplace-Install_Plugin-black?style=for-the-badge&logo=intellijidea&logoColor=white" alt="Install JetBrains Plugin" />
  </a>
</p>

### VS Code 확장 프로그램
<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai">
    <img src="https://img.shields.io/badge/VS_Code_Marketplace-Install_Extension-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install VS Code Extension" />
  </a>
</p>

## ✨ 핵심 기능

- 🔄 **비동기 AI 윤색** —— `post-commit` 훅을 통해 백그라운드에서 커밋 메시지를 향상시킵니다.
- ⏳ **실시간 상태 표시** —— 진행 중인 상태에서는 `git log`에 `[⏳]` 접두사가 표시되며 완료 시 자동 제거됩니다.
- 🛡️ **자동 복구** —— 오류/시간 초과 시 자동으로 롤백되며 예외 상황에 대비하여 `git-ai recover` 명령이 마련되어 있습니다.
- 🚀 **지연 푸시** —— AI가 아직 작업 중일 경우 푸시를 보류하고 준비가 완료되면 백그라운드에서 자동 푸시를 수행합니다.
- 🤖 **다중 제공자 지원** —— OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Ollama 지원.

## 🚀 빠른 시작 가이드

```bash
# 1. 저장소에서 초기화 (Git 후크 설치)
cd your-project
git-ai init

# 2. API 키 설정 (전역 환경에 한 번만)
git-ai config set api_key sk-your-key --global

# 3. 평소처럼 커밋하세요 - 백그라운드에서 자동으로 AI가 수정합니다!
git commit -m "버그 수정"

# 4. 푸시 - 윤색 중인 경우 대기열에 쌓이고 완료 시 자동 푸시
git push
```
