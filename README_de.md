<p align="center">
  <img src="assets/icon.png" width="120" alt="git-ai logo" />
</p>

<h1 align="center">Git AI: Der Reibungslose Asynchrone Commit-Optimierer</h1>

<p align="center">
  <strong>Warten Sie nicht mehr auf die KI. Programmieren Sie weiter, während Git AI Ihre Commit-Nachrichten im Hintergrund schreibt.</strong>
</p>

<p align="center">
  <a href="http://codegg.org/git-ai/"><img src="https://img.shields.io/badge/Website-codegg.org-10b981?style=flat&logo=googlechrome&logoColor=white" alt="Official Website" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://go.dev"><img src="https://img.shields.io/badge/Go-1.23+-00ADD8.svg?logo=go&logoColor=white" alt="Go" /></a>
  <a href="https://github.com/daidi/git-ai/releases"><img src="https://img.shields.io/github/v/release/daidi/git-ai?label=Release&color=8B5CF6" alt="Release" /></a>
  <br/>
  <h4>
    <a href="README.md">English</a> |
    <a href="README_zh-CN.md">简体中文</a> |
    <a href="README_zh-TW.md">繁體中文</a> |
    <a href="README_fr.md">Français</a> |
    <a href="README_it.md">Italiano</a> |
    Deutsch |
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

## ⚡️ Das Problem: Traditionelle KI blockiert Ihren Flow

Die meisten KI-Git-Tools zwingen Sie in ein Warten: Dateien stagen, "Generieren" klicken, warten, bewerten, *dann* commiten. Dies stört Ihren Arbeitsrhythmus.

## 🚀 Die Lösung: "Erst committen, später nachdenken"

Git AI ändert das komplett durch asynchrones Arbeiten im Hintergrund.

Tippen Sie einfach:
`git commit -m "fix bug"`

**Das ist alles. Sie können direkt weiterarbeiten.**

Währenddessen analysiert ein unsichtbarer Hintergrund-Daemon Ihren Diff, verarbeitet ihn durch eine KI, nutzt Semantic Commits und korrigiert Ihren Commit leise mit `--amend`:
`fix(auth): session timeout on mobile`

Wenn Sie danach wie immer sofort auf "Push" drücken, parkt Git AI den Befehl clever in einer Warteschlange und drückt den Commit sicher in Ihr Repository, sobald die KI fertig ist. **Keine Änderung an Ihrer Gewohnheit nötig.**

## 💡 Wie funktioniert das?

| | Traditionelle KI-Tools | Git AI |
|:---|:---|:---|
| **Workflow** | Warten → Generieren → Commiten | Commiten → Code schreiben → Hintergrund KI |
| **Wartezeit** | 2–5s blockierend | **Keine. Sie coden weiter.** |
| **KI stürzt ab?**| Kein Commit möglich | Ihr Commit ist absolut sicher |
| **Umlernen?**| Neue Oberfläche erlernen | Alles bleibt beim alten `git commit` |

---

# 👩‍💻 Installation und Features

## 🖥️ Nahtlose IDE Integration

Ändern Sie Ihre Gewohnheiten nicht. Nutzen Sie Git AI einfach direkt in Ihrer Lieblings-IDE per Plugin.

### JetBrains IDEA
<p align="center">
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai">
    <img src="https://img.shields.io/badge/JetBrains_Marketplace-Install_Plugin-black?style=for-the-badge&logo=intellijidea&logoColor=white" alt="Install JetBrains Plugin" />
  </a>
</p>

### VS Code Plugin
<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai">
    <img src="https://img.shields.io/badge/VS_Code_Marketplace-Install_Extension-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install VS Code Extension" />
  </a>
</p>

## ✨ Highlights

- 🔄 **Asynchrone Optimierung** —— Keine Ladebalken via `post-commit` Hook
- ⏳ **Status in Echtzeit sichtbar** —— Im `git log` ist sofort `[⏳]` vor dem Arbeitstitel
- 🛡️ **Fail-Safe** —— Abstürze oder Timeouts sichern stets das Original ab
- 🚀 **Sicheres Push** —— Wenn die KI läuft, werden spätere "Push"-Befehle nicht mehr überschrieben, sondern warten intelligent
- 🤖 **Viele Provider** —— OpenAI, DeepSeek, Claude, Ollama

## 🚀 Direkt starten

```bash
# 1. Installieren und an Git hängen
cd your-project
git-ai init

# 2. Einmalig Ihren OpenAI Token einfügen
git-ai config set api_key sk-your-key --global

# 3. Ganz normal speichern
git commit -m "fix bug"

# 4. Pushen (auch das klappt ohne Probleme währen KI arbeitet)
git push
```
