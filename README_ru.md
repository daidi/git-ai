<p align="center">
  <img src="assets/icon.png" width="120" alt="git-ai logo" />
</p>

<h1 align="center">Git AI: Асинхронный полировщик коммитов без ожиданий</h1>

<p align="center">
  <strong>Не жди ИИ. Пиши код, пока Git AI составляет сообщения обломком.</strong>
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
    <a href="README_pt.md">Português</a> |
    Русский |
    <a href="README_ar.md">العربية</a> |
    <a href="README_vi.md">Tiếng Việt</a> |
    <a href="README_th.md">ไทย</a> |
    <a href="README_id.md">Bahasa Indonesia</a>
  </h4>
</p>

---

## ⚡️ Проблема: Нейросети убивают скорость

Вы наверно устали пользоваться расширениями для коммитов, которые заставляют тратить по 5 секунд за каждым push'ом? Жмем кнопку... Ждём ответа сервера... И только потом коммит.

## 🚀 Решение: "Сначала закоммить — потом думай"

Git AI меняет правила игры. 

Просто набираешь:
`git commit -m "фикс"`

**Готово! Иди писать код дальше!**

В фоне, не мешая вашему терминалу, наша легкая система выцепляет диффы, кидает их через API к LLM и за кадром совершает `--amend`:
`fix(auth): fixed stupid bug with tokens`

## 💡 В чем плюсы?

| | Обычный AI | Git AI |
|:---|:---|:---|
| **Ход** | Генерация → Ждун → Коммит | Коммит → Пишем Мегакод → Готово |
| **Ожидание** | Сидишь 5 секунд | **Ни доли секунды.** |
| **Фатал**| Сервера OpenAI легли = без коммита | ИИ просто умрет в фоне, твой коммит цел |

## 📦 Быстрый Старт

IDE расширения есть в магазинах Jetbrains (Git AI) и VS Code Marketplace! Заходи, ставь, конфигурируй API ключ прямо через графический UI и наслаждайся нулевыми задержками разработки.
