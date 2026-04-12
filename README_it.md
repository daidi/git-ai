<p align="center">
  <img src="assets/icon.png" width="120" alt="git-ai logo" />
</p>

<h1 align="center">Git AI: Analizzatore e Miglioratore di Commit</h1>

<p align="center">
  <strong>Non aspettare più l'intelligenza artificiale. Scrivi codice ed usa Git AI per perfezionare le tue estensioni di messaggi in background.</strong>
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
    Italiano |
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

## ⚡️ Il Problema: I tool rallentano il flow!

Gran parte dei vari Plugin rallentano lo stack. Devi fermarti e attendere interazione API prima di chiudere il tuo invio. Perdi secondi.

## 🚀 La Soluzione: "Commit, e pensaci poi"

Git AI intercetta il tutto e fa un reset dei tuoi paradigmi. Nessuna attesa in finestra grafica.

Basta un:
`git commit -m "fix bug"`

**Nessuna barra di caricamento.** Scrivi e vai.

A parte e con priorità ridotta, un task va via API a mandare il tutto al sistema cloud e trasforma il testo semplice con `--amend` in questo:
`fix(auth): solve bug per le cache`

## 💡 Rispetto ad altri

| | Tool Ordinarii | Git AI |
|:---|:---|:---|
| **Esecuzione** | Scrivi → Generi → Applichi | Normalissimo Commit |
| **Latenze perse** | 2, 3 o 5 secondi bloccati | **Meno di 0s** |
| **Nessuna Rete?**| Errore Bloccante | Il codice è salvato comunque |

---

# 👩‍💻 Installazioni

## 🖥️ IDE in Nativo

### JetBrains IDEA & Famiglia
<p align="center">
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai">
    <img src="https://img.shields.io/badge/JetBrains_Marketplace-Install_Plugin-black?style=for-the-badge&logo=intellijidea&logoColor=white" alt="Install JetBrains Plugin" />
  </a>
</p>

### Versioni VS Code
<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai">
    <img src="https://img.shields.io/badge/VS_Code_Marketplace-Install_Extension-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install VS Code Extension" />
  </a>
</p>

## ✨ Specifiche del motore

- 🔄 **Lavoro da gancio hook asincrono** —— Utilizza il workflow nativo del terminale, per una sicurezza assoluta e garantita
- 🛡️ **Recovery Infallibile** —— Se va giù OpenAI il codice lo hai già conservato!
- 🤖 **Modelli Cloud ed Offline** —— Usa Claude, GPT, DeepSeek oppure il tool serverizzato Ollama!

## 🚀 Parti Immediatamente Subito

```bash
# 1. Start del protocollo
cd your-project
git-ai init

# 2. Definisci API KEY cloud globale
git-ai config set api_key sk-tua-key --global

# 3. Lavora e Commit!
git commit -m "fixato bug app"
```
