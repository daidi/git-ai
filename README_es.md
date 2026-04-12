<p align="center">
  <img src="assets/icon.png" width="120" alt="git-ai logo" />
</p>

<h1 align="center">Git AI: El Mejorador Asíncrono de Commits</h1>

<p align="center">
  <strong>No esperes a la IA. Sigue programando mientras Git AI escribe tus mensajes de commit en segundo plano.</strong>
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
    <a href="README_de.md">Deutsch</a> |
    Español |
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

## ⚡️ El Problema: El cuello de botella de la IA

La mayoría de las herramientas de IA para Git te obligan a entrar en un bucle síncrono: preparas ficheros, pulsas "Generar", ves una rueda de carga, compruebas, y *por fin* commiteas. Un dolor constante al programar rápido.

## 🚀 La Solución: "Commitea primero, piensa después"

Git AI lo hace todo automático, invisible y de fondo.

Simplemente escribes lo normal:
`git commit -m "fix bug"`

**Y eso es todo.** Te pones a escribir de inmediato en tu editor.

A salvo en segundo plano, tu PC enviará el código al LLM, creará un commit elegante usando estándar "Conventional", y sobreescribirá la orden previa. ¡Sin estorbar en la CLI!
`fix(auth): fix session invalidation on mobile`

¿Sueles empujar todo de golpe a Remote? Puedes hacer "git push" también. Git AI bloqueará limpiamente la subida a internet mientras pule, ¡y lo enviará sin tocar botón alguno después!

## 💡 ¿Porqué triunfa?

| | Extensiones Típicas | Git AI |
|:---|:---|:---|
| **Flujo** | IA piensa → Revisar → Subir | Guardar → Trabajar → Pulido Silencioso |
| **Tiempo Perdido** | 2 a 5 segundos bloqueado | **Absolutamente Cero.** |
| **Si la IA se rompe?**| Tu fichero queda colgado | Lo pusheas crudo, sin riesgos |
| **¿Modo de uso?**| Aprender un sistema entero | El `git commit` clásico |

---

# 👩‍💻 Instalación

## 🖥️ IDE Integrado Al Completo

¿Acostumbrado a usar VS Code o IntelliJ? Tienes plugins que muestran en ventanas la evolución con total tranquilidad.

### Plugin JetBrains IDEA
<p align="center">
  <a href="https://plugins.jetbrains.com/plugin/31221-git-ai">
    <img src="https://img.shields.io/badge/JetBrains_Marketplace-Install_Plugin-black?style=for-the-badge&logo=intellijidea&logoColor=white" alt="Install JetBrains Plugin" />
  </a>
</p>

### Plugin VS Code
<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=git-ai-async-commit-polisher.git-ai">
    <img src="https://img.shields.io/badge/VS_Code_Marketplace-Install_Extension-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white" alt="Install VS Code Extension" />
  </a>
</p>

## 🚀 Inicio Inmediato en Terminal

```bash
# 1. Configura el hook del proyecto
cd your-project
git-ai init

# 2. Configura proveedor de IA
git-ai config set api_key sk-your-key --global

# 3. Disfruta!
git commit -m "fix bug"

# 4. Y manda todo
git push
```
