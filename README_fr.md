<p align="center">
  <img src="assets/icon.png" width="120" alt="git-ai logo" />
</p>

<h1 align="center">Git AI : Un Polisseur de Commits Asynchrone et Sans Friction</h1>

<p align="center">
  <strong>N'attendez pas l'IA. Continuez à coder pendant que Git AI peaufine vos messages de commit en arrière-plan.</strong>
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
    Français |
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

## ⚡️ Le Problème : Les outils d'IA traditionnels brisent votre flux

La plupart des outils Git IA vous forcent dans un jeu d'attente bloquant : groupez vos fichiers, cliquez sur "Générer", regardez l'icône de chargement, passez en revue, et *enfin* confirmez. Cette friction tue votre concentration.

## 🚀 La Solution : "Commitez d'abord, réfléchissez ensuite"

Git AI renverse ce paradigme avec un véritable traitement asynchrone en arrière-plan.

Tapez simplement :
`git commit -m "fix bug"`

**C'est tout. Vous en avez terminé.** Vous retournez immédiatement à l'écriture de votre code.

Pendant ce temps, un démon d'arrière-plan détaché envoie en toute sécurité votre diff à un service LLM, applique les standards de commits conventionnels et utilise discrètement `--amend` sur votre commit :
`fix(auth): resolve session timeout on mobile devices`

Même si vous avez l'habitude de pusher immédiatement après votre commit, Git AI met sagement votre push dans une file d'attente et l'exécute automatiquement une fois votre message finalisé. **Zéro altération de vos habitudes.**

## 💡 Pourquoi est-ce meilleur ?

| | Outils IA traditionnels | Git AI |
|:---|:---|:---|
| **Workflow** | Générer → Attendre → Relire → Commiter | Commiter → Coder → Polissage en arrière-plan |
| **Latence d'attente** | De 2 à 5s bloquées | **Zéro. Vous gardez la main.** |
| **En cas d'échec IA ?**| Pas de commit | Votre commit est sauvé quoi qu'il arrive |
| **Nouvelles habitudes ?**| Nouveaux boutons, nouveaux raccourcis | Un simple `git commit` |

---

# 👩‍💻 Pour les Utilisateurs

## 🖥️ Intégration IDE Transparente

Ne changez rien. Utilisez Git AI directement depuis votre IDE favori. Nos plugins pour VS Code et JetBrains procurent des notifications, des affichages pertinents des statuts et permettent un réglage depuis les configurations de l'éditeur sans utiliser le terminal.

### Plugin JetBrains IDEA
<p align="center">
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai">
    <img src="https://img.shields.io/badge/JetBrains_Marketplace-Install_Plugin-black?style=for-the-badge&logo=intellijidea&logoColor=white" alt="Install JetBrains Plugin" />
  </a>
</p>

### Extension VS Code
<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai">
    <img src="https://img.shields.io/badge/VS_Code_Marketplace-Install_Extension-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install VS Code Extension" />
  </a>
</p>

## ✨ Fonctionnalités Fondamentales

- 🔄 **Polissage Asynchrone par IA** —— Exécution en mode `post-commit` détaché en arrière-plan
- ⏳ **Affichage du statut en temps réel** —— Ajout du préfixe `[⏳]` devant les logs de Git pour ne pas dupliquer l'automatisation de scripts et plugins externes.
- 🛡️ **Récupération Automatique** —— Un système infaillible permettant une restauration à l'état originel s'il y a des timeouts
- 🚀 **Push différé et mis en file d'attente** —— Permet d'enchaîner l'écriture et l'envoi de fichier.
- 🤖 **Support natif de multiples IA** —— Intégration d'OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Ollama, ainsi que tous les fournisseurs compatibles avec le schéma open-source d'OpenAI.

## 🚀 Démarrage Rapide

```bash
# 1. Initialisez dans votre dépôt (installe les git hooks)
cd your-project
git-ai init

# 2. Configurez votre clé d'API (qu'une seule fois globalement)
git-ai config set api_key sk-votre-clef --global

# 3. Commitez comme d'habitude — l'IA réécrit votre texte discrètement en fond !
git commit -m "fix bug"

# 4. Push — le processus attendra que l'IA finisse de peaufiner puis exécutera la commande.
git push
```
