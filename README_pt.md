<p align="center">
  <img src="assets/icon.png" width="120" alt="git-ai logo" />
</p>

<h1 align="center">Git AI: Melhorador de Commit Assíncrono</h1>

<p align="center">
  <strong>Não espere pela IA. Continue codando enquanto o Git AI escreve suas mensagens de commit de fundo.</strong>
</p>

<p align="center">
  <a href="http://codegg.org/git-ai/"><img src="https://img.shields.io/badge/Website-codegg.org-10b981?style=flat&logo=googlechrome&logoColor=white" alt="Official Website" /></a>
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
    <a href="README_ko.md">한국어</a> |
    Português |
    <a href="README_ru.md">Русский</a> |
    <a href="README_ar.md">العربية</a> |
    <a href="README_vi.md">Tiếng Việt</a> |
    <a href="README_th.md">ไทย</a> |
    <a href="README_id.md">Bahasa Indonesia</a>
  </h4>
</p>

---

## ⚡️ O Problema: Inteligência Artificial te bloqueia

Maior parte das ferramentas Git AI fazem você parar de codificar: você pausa, gera texto na IA e espera o carregamento para finalmente dar commit. E você perde muita linha de código assim.

## 🚀 A Solução: "Commita logo, Pensa depois"

Se libere pelo processo assíncrono. Faça um commit cego rápido de duas palavras:
`git commit -m "fix bug"`

E volte ao código imediatamente! Atrás dos panos o nosso daemon mandará seu diff gigantesco pro LLM e irá reescrever lindamente no histórico local usando `--amend` para ser:
`fix(auth): fix session for apple`

## 💡 Por que é fenomenal?

| | Outros | NÓS (Git AI) |
|:---|:---|:---|
| **Fluxo** | Esperar LLM girar a roda | A roda da IA voa pelas costas |
| **Perca de tempo** | Até uma vida (5s) | **Zero (0s)** |
| **Resiliência**| Perde o commit no crash de rede | Salvo |

## 📦 Uso

Basta colocar em seu projeto o init. O Git AI fará tudo através do gancho post-commit com as engines do OpenAI ou Ollama, configuráveis em nosso plugin Jetbrains e VS Code Marketplace! 
```bash
git-ai init
git-ai config set api_key sua-chave-poderosa --global
```
