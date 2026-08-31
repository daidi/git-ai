document.addEventListener('DOMContentLoaded', () => {

    const translations = {
        en: {
            seo_title: "Git AI - Async Background Commit Polisher", seo_desc: "Git AI is a zero-friction async Git commit polisher. Write code, fire git commit, and let the ghost daemon rewrite your messages using AI in the background. Supports OpenAI, Anthropic, Gemini, DeepSeek, and Ollama.",
            nav_features: "Features", hero_badge: "v1.2.2 Released", hero_title: "Commit first,<br>think <span>later.</span>", hero_desc: "Don't wait for AI. Keep coding while Git AI writes your commit messages in the background. <strong>The zero-friction async polisher.</strong>",
            btn_vscode: "Get VS Code Extension", btn_idea: "Get JetBrains Plugin", hero_cli_link: "Terminal maximalist? Get the CLI engine →",
            feat1_title: "Zero Latency", feat1_desc: "Your commit completes in 12ms. The LLM processes everything in an orphaned background daemon.",
            feat2_title: "Real-time Status", feat2_desc: "The CLI keeps operation status in the OS app-data directory; IDEs query it without adding files to your repository.",
            feat3_title: "Queue Push", feat3_desc: "Pushing during polishing? Git AI queues the exact ref update and only replays it when doing so is provably safe.",
            feat4_title: "IDE Native", feat4_desc: "No more terminal toggling. Monitor daemon hooks natively through VS Code and IntelliJ IDEA extensions.",
            footer_subtitle: "Async Commit Polisher.", footer_plugins: "Plugins", footer_resources: "Resources", footer_repo: "GitHub Repositories", footer_releases: "Releases",
            term_input: 'git commit -m "fix stuff"', term_line1: "<span class=\"t-dim\">[main 4f1a2b3] fix stuff</span>", term_line2: '<span class="t-wait">✨ git-ai:</span> Background polishing started (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Polished commit message', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Install Git AI Free", btn_github: "View Source", prob_title: "The AI Waiting Problem", prob_desc: "Synchronous CLI tools (like aicommits) and deep agents (Copilot) are great if you want to micromanage your commits. But they force you to wait 10-30 seconds to generate and review. Git AI is built for flow-state developers: it stays entirely out of your way and polishes asynchronously.", sec_arch: "Architecture", flow_title: "How the Daemon Works", flow_step1_title: "12ms Hook", flow_step1_desc: "Run git commit -m \"fix\". The intercepting post-commit hook finishes instantly.", flow_step2_title: "Daemon Detaches", flow_step2_desc: "A background process orphans itself to the OS, completely freeing your terminal.", flow_step3_title: "Ghost Polishing", flow_step3_desc: "The daemon asks the LLM, builds a replacement from the recorded commit, and atomically advances the ref only if it has not moved.", flow_step4_title: "Auto-Queue", flow_step4_desc: "If you push early, the exact ref updates are queued until the safe replacement finishes.", eco_title: "Deep IDE Integration", eco_desc: "Native VS Code and IntelliJ IDEA plugins query the CLI for external app state, logs, and safe controls without creating project files.", sec_support: "Support", faq_title: "Frequently Asked Questions", faq1_q: "Will it mess up my git history?", faq1_a: "No. Git AI records the exact commit SHA and ref, then uses an atomic compare-and-swap update. If the ref moved or any step fails, Git and workspace files stay unchanged.", faq2_q: "What if I push while it's still generating?", faq2_a: "By default, the pre-push hook queues the exact ref updates while polishing. If replay cannot be proven safe or credentials are unavailable, Git AI stops and asks you to retry manually.", faq3_q: "Which LLMs are supported?", faq3_a: "Git AI natively supports the OpenAI, Anthropic, Gemini, and DeepSeek APIs. It also supports locally hosted models like Ollama.", faq4_q: "Do I need the IDE plugin to use it?", faq4_a: "No, the core engine is a standalone Go binary that operates purely via standard Git hooks. It works universally.", cta_title: "Start commiting faster.", cta_desc: "Install the CLI via script or grab an IDE plugin.", feat_dash_title: "Personal Productivity Dashboard", feat_dash_desc: "Track your time saved and AI-polished commit counts. A native dashboard inside your IDE gives you tangible insight into how much repetitive work the daemon has eliminated.", feat_hist_title: "AI Commit History", feat_hist_desc: "Never lose the 'Original Draft' intent. The interactive timeline highlights which commits were ghost-authored by AI, revealing the exact models, generation latency, and your original rough thoughts."
        },
        "zh-cn": {
            seo_title: "Git AI - 异步后台 Commit 润色工具", seo_desc: "Git AI 是零摩擦的异步 Git 提交信息润色器。你只管写代码，执行 git commit，后台幽灵守护进程会用 AI 自动润色你的提交信息。支持 OpenAI、Anthropic、Gemini、DeepSeek 和 Ollama。",
            nav_features: "核心特性", hero_badge: "v1.2.2 最新发布", hero_title: "先提交，<br>后<span>思考。</span>", hero_desc: "告别漫长的同步等待。你只管写代码，让 Git AI 在后台默默为你写好提交信息。<strong>零摩擦的异步润色体验。</strong>",
            btn_vscode: "获取 VS Code 插件", btn_idea: "获取 JetBrains 插件", hero_cli_link: "只用终端？查看 CLI 极客安装包 →",
            feat1_title: "零感延迟", feat1_desc: "提交命令仅需 12 毫秒。复杂的 LLM 请求全部在被彻底隔离的后台守护进程中静默完成。",
            feat2_title: "实时状态可见", feat2_desc: "CLI 将运行状态保存在操作系统的应用数据目录中；IDE 只通过 CLI 查询，不会向仓库添加文件。",
            feat3_title: "自动排队推送", feat3_desc: "润色时执行 <code>git push</code>？Git AI 会记录精确的引用更新，并且只在能够证明安全时重放。",
            feat4_title: "IDE 原生集成", feat4_desc: "提供原生的 VS Code 和 IntelliJ IDEA 控制面版，免终端即可查看完整状态监控。",
            footer_subtitle: "异步无感的跨生态 Git 提交润色工具。", footer_plugins: "IDE 插件", footer_resources: "相关资源", footer_repo: "GitHub 仓库", footer_releases: "最新发布版本",
            term_input: 'git commit -m "修个bug"', term_line1: "<span class=\"t-dim\">[main 4f1a2b3] 修个bug</span>", term_line2: '<span class="t-wait">✨ git-ai:</span> 正在后台处理润色 (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> 润色完成', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "痛点", nav_faq: "常见问题", btn_install: "免费获取 Git AI", btn_github: "查看源码", prob_title: "AI 工具的等待噩梦", prob_desc: "传统的同步 CLI 工具（如 aicommits）和重度 Agent（如 Copilot）只适合想要微操提交的人。它们会迫使你等待 10-30 秒生成与审查。Git AI 是专为追求心流状态的开发者打造的：纯异步流，彻底解放你的时间。", sec_arch: "架构", flow_title: "后台守护进程如何工作", flow_step1_title: "12毫秒 Hook", flow_step1_desc: "执行 git commit。拦截的 post-commit hook 瞬间完成并退出。", flow_step2_title: "进程脱离", flow_step2_desc: "后台进程将自己作为孤儿进程托管给操作系统，彻底释放你的终端。", flow_step3_title: "幽灵润色", flow_step3_desc: "后台请求 LLM，基于记录的提交构造替代提交；仅当引用没有移动时，才通过原子操作更新。", flow_step4_title: "自动排队", flow_step4_desc: "如果提前 push，精确的引用更新会排队，直到安全替换完成。", eco_title: "深入 IDE 原生集成", eco_desc: "VS Code 和 IntelliJ IDEA 原生插件通过 CLI 查询外置的应用状态、日志和安全控制，不会创建项目文件。", sec_support: "技术支持", faq_title: "常见问题答疑", faq1_q: "这会弄乱我的 git 历史吗？", faq1_a: "不会。Git AI 记录精确的提交 SHA 和引用，并用原子比较交换更新。引用已移动或任一步骤失败时，Git 与工作区文件都保持不变。", faq2_q: "如果我在生成时强制 push 会怎样？", faq2_a: "默认情况下，pre-push hook 会在润色期间排队精确的引用更新。如果无法证明重放安全，或凭据不可用，Git AI 会停止并请你手动重试。", faq3_q: "支持哪些大语言模型？", faq3_a: "原生支持 OpenAI, Anthropic, Gemini, 和 DeepSeek API。同时也支持市面上兼容 OpenAI 格式的本地化部署模型（如 Ollama）。", faq4_q: "我必须安装 IDE 插件吗？", faq4_a: "不是必需的，核心引擎是一个独立的 Go 语言二进制文件，它完全通过标准的 Git hooks 运作。所有代码编辑器都能通用。", cta_title: "马上提升提交效率。", cta_desc: "运行终端脚本，或在插件市场获取。", feat_dash_title: "个人提效看板", feat_dash_desc: "直观统计你依靠异步架构节省的总时间和生成的提交数量。IDE 内置的遥测看板让你确切感知后台守护进程为你消灭了多少繁杂工作。", feat_hist_title: "AI 提交历史追溯", feat_hist_desc: "再也不会丢失你原本的草稿意图。互动时间线精准留存每一次影子生成的模型版本、耗时以及你的原始思路。"
        },
        "zh-tw": {
            seo_title: "Git AI - 非同步背景 Commit 潤飾工具", seo_desc: "Git AI 是零摩擦的非同步 Git 提交訊息潤飾器。你只管寫程式，執行 git commit，背景幽靈守護行程會用 AI 自動潤飾你的提交訊息。支援 OpenAI、Anthropic、Gemini、DeepSeek 和 Ollama。",
            nav_features: "核心特性", hero_badge: "v1.2.2 最新發布", hero_title: "先提交，<br>後<span>思考。</span>", hero_desc: "告別漫長的同步等待。你只管寫程式，讓 Git AI 在背景默默為你寫好提交訊息。<strong>零摩擦的非同步潤飾體驗。</strong>",
            btn_vscode: "取得 VS Code 外掛", btn_idea: "取得 JetBrains 外掛", hero_cli_link: "只用終端機？查看 CLI 極客安裝包 →",
            feat1_title: "零感延遲", feat1_desc: "提交命令僅需 12 毫秒。複雜的 LLM 請求全部在被徹底隔離的背景背景程序中靜默完成。",
            feat2_title: "實時狀態可見", feat2_desc: "CLI 將執行狀態保存在作業系統的應用程式資料目錄；IDE 僅透過 CLI 查詢，不會在儲存庫新增檔案。",
            feat3_title: "自動排隊推送", feat3_desc: "潤飾時執行 <code>git push</code>？Git AI 會記錄精確的參照更新，且只在能證明安全時重放。",
            feat4_title: "IDE 原生整合", feat4_desc: "提供原生的 VS Code 和 IntelliJ IDEA 控制面板，免終端機即可查看完整狀態監控。",
            footer_subtitle: "非同步無感的跨生態 Git 提交潤飾工具。", footer_plugins: "IDE 外掛", footer_resources: "相關資源", footer_repo: "GitHub 倉庫", footer_releases: "最新發佈版本",
            term_input: 'git commit -m "修個bug"', term_line1: "<span class=\"t-dim\">[main 4f1a2b3] 修個bug</span>", term_line2: '<span class="t-wait">✨ git-ai:</span> 正在背景處理潤飾 (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> 潤飾完成', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "痛點", nav_faq: "常見問題", btn_install: "免費取得 Git AI", btn_github: "檢視原始碼", prob_title: "AI 工具的等待惡夢", prob_desc: "傳統的同步 CLI 工具（如 aicommits）和重度 Agent（如 Copilot）只適合想要微操提交的人。它們會迫使你等待 10-30 秒產生與審查。Git AI 是專為追求心流狀態的開發者打造的：純非同步流，徹底解放你的時間。", sec_arch: "架構", flow_title: "背景守護程序如何工作", flow_step1_title: "12毫秒 Hook", flow_step1_desc: "執行 git commit。攔截的 post-commit hook 瞬間完成並退出。", flow_step2_title: "程序脫離", flow_step2_desc: "背景程序將自己作為孤兒程序託管給作業系統，徹底釋放你的終端機。", flow_step3_title: "幽靈潤飾", flow_step3_desc: "背景程序請求 LLM，依記錄的提交建立替代提交；只有參照未移動時才以原子操作更新。", flow_step4_title: "自動排隊", flow_step4_desc: "若提前 push，精確的參照更新會排入佇列，直到安全替換完成。", eco_title: "深入 IDE 原生整合", eco_desc: "VS Code 與 IntelliJ IDEA 原生外掛透過 CLI 查詢外置的應用程式狀態、日誌與安全控制，不會建立專案檔案。", sec_support: "技術支援", faq_title: "常見問題答疑", faq1_q: "這會弄亂我的 git 歷史嗎？", faq1_a: "不會。Git AI 記錄精確的提交 SHA 與參照，並以原子比較交換更新。參照已移動或任何步驟失敗時，Git 與工作區檔案都保持不變。", faq2_q: "如果我在產生時強制 push 會怎樣？", faq2_a: "預設情況下，pre-push hook 會在潤飾期間排隊精確的參照更新。若無法證明重放安全或憑證不可用，Git AI 會停止並請你手動重試。", faq3_q: "支援哪些大型語言模型？", faq3_a: "原生支援 OpenAI, Anthropic, Gemini, 和 DeepSeek API。同時也支援市面上相容 OpenAI 格式的在地化部署模型（如 Ollama）。", faq4_q: "我必須安裝 IDE 外掛嗎？", faq4_a: "不是必須的，核心引擎是一個獨立的 Go 語言二進位檔案，它完全透過標準的 Git hooks 運作。所有程式碼編輯器都能通用。", cta_title: "馬上提升提交效率。", cta_desc: "執行終端機腳本，或在外掛市場取得。", feat_dash_title: "個人提效看板", feat_dash_desc: "直觀統計你依靠非同步架構節省的總時間和產生的提交數量。IDE 內建的遙測看板讓你確切感知背景守護程式為你消滅了多少繁雜工作。", feat_hist_title: "AI 提交歷史追溯", feat_hist_desc: "再也不會遺失你原本的草稿意圖。互動時間線精準留存每一次影子產生的模型版本、耗時以及你的原始思路。"
        },
        fr: {
            seo_title: "Git AI - Polisseur de Commits Asynchrone en Arrière-plan", seo_desc: "Git AI est un polisseur de commits Git asynchrone sans friction. Écrivez du code, lancez git commit, et laissez le daemon fantôme réécrire vos messages en arrière-plan avec l'IA. Compatible OpenAI, Anthropic, Gemini, DeepSeek et Ollama.",
            nav_features: "Caractéristiques", hero_badge: "v1.2.2 Publié", hero_title: "Commettez d'abord,<br>réfléchissez <span>plus tard.</span>", hero_desc: "N'attendez pas l'IA. Continuez à coder pendant que Git AI rédige vos messages de commit en arrière-plan. <strong>Le polisseur asynchrone zéro friction.</strong>",
            btn_vscode: "Obtenir l'extension VS Code", btn_idea: "Obtenir le plugin JetBrains", hero_cli_link: "Maximaliste du terminal ? Obtenez le moteur CLI →",
            feat1_title: "Zéro Latence", feat1_desc: "Votre commit prend 12 ms. Le LLM traite tout dans un démon en arrière-plan orphelin.",
            feat2_title: "Statut en temps réel", feat2_desc: "Le CLI conserve l’état dans le dossier de données de l’application du système ; les IDE le consultent sans ajouter de fichier au dépôt.",
            feat3_title: "File d'attente Push", feat3_desc: "Un <code>git push</code> pendant le polissage ? Git AI met en file la mise à jour exacte de la référence et ne la rejoue que si cela est prouvé sûr.",
            feat4_title: "IDE Natif", feat4_desc: "Fini le basculement de terminal. Surveillez les hooks de démon nativement via les extensions VS Code et IntelliJ IDEA.",
            footer_subtitle: "Polisseur de Commit Asynchrone.", footer_plugins: "Plugins", footer_resources: "Ressources", footer_repo: "Dépôts GitHub", footer_releases: "Versions",
            term_input: 'git commit -m "corriger des trucs"', term_line1: "<span class=\"t-dim\">[main 4f1a2b3] corriger des trucs</span>", term_line2: '<span class="t-wait">✨ git-ai:</span> Polissage en arrière-plan lancé (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Message de commit poli', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problème", nav_faq: "FAQ", btn_install: "Installer maintenant", btn_github: "Voir le code source", prob_title: "Le problème d'attente de l'IA", prob_desc: "Les outils CLI synchrones bloquent votre terminal 10 à 30 secondes pendant que le LLM génère un message de commit. C'est suffisant pour briser votre flow et perdre le contexte.", sec_arch: "Architecture", flow_title: "Comment fonctionne le démon", flow_step1_title: "Hook 12ms", flow_step1_desc: "Lancez git commit -m \"fix\". Le hook post-commit intercepteur se termine instantanément.", flow_step2_title: "Démon détaché", flow_step2_desc: "Un processus en arrière-plan s'orphanise vers l'OS, libérant complètement votre terminal.", flow_step3_title: "Polissage fantôme", flow_step3_desc: "Le démon interroge le LLM, construit un remplacement depuis le commit enregistré et avance atomiquement la référence seulement si elle n’a pas bougé.", flow_step4_title: "File automatique", flow_step4_desc: "Si vous poussez trop tôt, les mises à jour exactes des références attendent la fin du remplacement sûr.", eco_title: "Intégration IDE native", eco_desc: "Les plugins VS Code et IntelliJ IDEA interrogent le CLI pour obtenir l’état externe, les journaux et des contrôles sûrs, sans créer de fichiers de projet.", sec_support: "Support", faq_title: "Questions fréquemment posées", faq1_q: "Cela va-t-il perturber mon historique git ?", faq1_a: "Non. Git AI enregistre le SHA et la référence exacts, puis effectue une mise à jour atomique par comparaison-échange. Si la référence a bougé ou qu’une étape échoue, Git et les fichiers de travail restent inchangés.", faq2_q: "Que se passe-t-il si je push pendant la génération ?", faq2_a: "Par défaut, le hook pre-push met en file les mises à jour exactes des références pendant le polissage. Si leur rejeu ne peut être prouvé sûr ou si les identifiants manquent, Git AI s’arrête et demande un nouvel essai manuel.", faq3_q: "Quels LLMs sont supportés ?", faq3_a: "Git AI supporte nativement les APIs OpenAI, Anthropic, Gemini et DeepSeek. Il supporte également les modèles hébergés localement comme Ollama.", faq4_q: "Ai-je besoin du plugin IDE pour l'utiliser ?", faq4_a: "Non, le moteur principal est un binaire Go autonome qui fonctionne uniquement via les hooks Git standard. Il fonctionne universellement.", cta_title: "Commencez à committer plus vite.", cta_desc: "Installez le CLI via script ou obtenez un plugin IDE.", feat_dash_title: "Tableau de Bord de Productivité Personnel", feat_dash_desc: "Suivez votre temps gagné et le nombre de commits polis par l'IA. Un tableau de bord natif dans votre IDE vous donne un aperçu concret du travail répétitif que le démon a éliminé.", feat_hist_title: "Historique des Commits IA", feat_hist_desc: "Ne perdez jamais l'intention de votre 'Brouillon Original'. La chronologie interactive met en évidence quels commits ont été coécrits par l'IA, révélant les modèles exacts, la latence de génération et vos pensées initiales."
        },
        it: {
            seo_title: "Git AI - Lucidatore di Commit Asincrono in Background", seo_desc: "Git AI è un lucidatore di commit Git asincrono senza attrito. Scrivi codice, esegui git commit, e lascia che il daemon fantasma riscriva i tuoi messaggi in background con l'IA. Supporta OpenAI, Anthropic, Gemini, DeepSeek e Ollama.",
            nav_features: "Funzionalità", hero_badge: "v1.2.2 Rilasciato", hero_title: "Esegui il commit prima,<br>pensa <span>dopo.</span>", hero_desc: "Non aspettare l'IA. Continua a programmare mentre Git AI scrive i tuoi messaggi di commit in background. <strong>Il lucidatore asincrono senza attrito.</strong>",
            btn_vscode: "Ottieni estensione VS Code", btn_idea: "Ottieni plugin JetBrains", hero_cli_link: "Massimalista del terminale? Ottieni il motore CLI →",
            feat1_title: "Latenza Zero", feat1_desc: "Il tuo commit si completa in 12 ms. L'LLM elabora tutto in un demone in background orfano.",
            feat2_title: "Stato in Tempo Reale", feat2_desc: "La CLI conserva lo stato nella directory dati dell’app del sistema; gli IDE lo interrogano senza aggiungere file al repository.",
            feat3_title: "Coda Push", feat3_desc: "Esegui <code>git push</code> durante la rifinitura? Git AI accoda l’aggiornamento esatto del riferimento e lo ripete solo se è dimostrabilmente sicuro.",
            feat4_title: "Nativo per IDE", feat4_desc: "Basta passare dal terminale. Monitora gli hook del demone in modo nativo tramite le estensioni VS Code e IntelliJ IDEA.",
            footer_subtitle: "Lucidatore asincrono di commit.", footer_plugins: "Plugin", footer_resources: "Risorse", footer_repo: "Repository GitHub", footer_releases: "Rilasci",
            term_input: 'git commit -m "fix roba"', term_line1: "<span class=\"t-dim\">[main 4f1a2b3] fix roba</span>", term_line2: '<span class="t-wait">✨ git-ai:</span> Pulizia in background avviata (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Messaggio di commit migliorato', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problema", nav_faq: "FAQ", btn_install: "Installa ora", btn_github: "Visualizza sorgente", prob_title: "Il problema dell'attesa dell'IA", prob_desc: "Gli strumenti CLI sincroni bloccano il terminale per 10-30 secondi mentre l'LLM genera un messaggio di commit. È sufficiente a interrompere il tuo flusso e perdere il contesto.", sec_arch: "Architettura", flow_title: "Come funziona il daemon", flow_step1_title: "Hook 12ms", flow_step1_desc: "Esegui git commit -m \"fix\". Il hook post-commit intercettante termina istantaneamente.", flow_step2_title: "Daemon distaccato", flow_step2_desc: "Un processo in background si orfanizza verso l'OS, liberando completamente il terminale.", flow_step3_title: "Lucidatura fantasma", flow_step3_desc: "Il daemon interroga l’LLM, crea un sostituto dal commit registrato e avanza atomicamente il riferimento solo se non è cambiato.", flow_step4_title: "Coda automatica", flow_step4_desc: "Se esegui push in anticipo, gli aggiornamenti esatti dei riferimenti restano in coda fino al completamento della sostituzione sicura.", eco_title: "Integrazione IDE nativa", eco_desc: "I plugin nativi per VS Code e IntelliJ IDEA interrogano la CLI per stato esterno, log e controlli sicuri, senza creare file di progetto.", sec_support: "Supporto", faq_title: "Domande frequenti", faq1_q: "Rovinerà la mia cronologia git?", faq1_a: "No. Git AI registra SHA e riferimento esatti e usa un aggiornamento atomico compare-and-swap. Se il riferimento è cambiato o un passaggio fallisce, Git e i file di lavoro restano invariati.", faq2_q: "Cosa succede se faccio push mentre sta ancora generando?", faq2_a: "Per impostazione predefinita, il hook pre-push accoda gli aggiornamenti esatti dei riferimenti durante la rifinitura. Se la ripetizione non è dimostrabilmente sicura o mancano le credenziali, Git AI si ferma e chiede di riprovare manualmente.", faq3_q: "Quali LLM sono supportati?", faq3_a: "Git AI supporta nativamente le API OpenAI, Anthropic, Gemini e DeepSeek. Supporta anche modelli ospitati localmente come Ollama.", faq4_q: "Ho bisogno del plugin IDE per usarlo?", faq4_a: "No, il motore principale è un binario Go autonomo che opera esclusivamente tramite hook Git standard. Funziona universalmente.", cta_title: "Inizia a fare commit più velocemente.", cta_desc: "Installa il CLI tramite script o scarica un plugin IDE.", feat_dash_title: "Dashboard di Produttività Personale", feat_dash_desc: "Tieni traccia del tempo risparmiato e del numero di commit perfezionati dall'IA. Una dashboard nativa nel tuo IDE ti offre una visione tangibile di quanto lavoro ripetitivo il demone ha eliminato.", feat_hist_title: "Cronologia dei Commit IA", feat_hist_desc: "Non perdere mai l'intento della tua 'Bozza Originale'. La sequenza temporale interattiva evidenzia quali commit sono stati co-scritti dall'IA, rivelando i modelli esatti, la latenza di generazione e i tuoi pensieri grezzi."
        },
        de: {
            seo_title: "Git AI - Asynchroner Hintergrund-Commit-Polierer", seo_desc: "Git AI ist ein reibungsloser asynchroner Git-Commit-Polierer. Schreiben Sie Code, führen Sie git commit aus, und lassen Sie den Ghost-Daemon Ihre Nachrichten im Hintergrund mit KI umschreiben. Unterstützt OpenAI, Anthropic, Gemini, DeepSeek und Ollama.",
            nav_features: "Funktionen", hero_badge: "v1.2.2 Veröffentlicht", hero_title: "Zuerst committen,<br>später <span>denken.</span>", hero_desc: "Warten Sie nicht auf die KI. Coden Sie weiter, während Git AI Ihre Commit-Nachrichten im Hintergrund schreibt. <strong>Der reibungslose asynchrone Polierer.</strong>",
            btn_vscode: "VS Code Erweiterung", btn_idea: "JetBrains Plugin", hero_cli_link: "Terminal-Maximalist? Hol dir die CLI-Engine →",
            feat1_title: "Null Latenz", feat1_desc: "Dein Commit ist in 12 ms abgeschlossen. Das LLM verarbeitet alles in einem verwaisten Hintergrund-Daemon.",
            feat2_title: "Echtzeit-Status", feat2_desc: "Die CLI speichert den Status im App-Datenverzeichnis des Betriebssystems; IDEs fragen ihn ab, ohne Dateien zum Repository hinzuzufügen.",
            feat3_title: "Warteschlangen-Push", feat3_desc: "<code>git push</code> während der Überarbeitung? Git AI stellt die exakte Ref-Aktualisierung zurück und spielt sie nur ab, wenn dies nachweislich sicher ist.",
            feat4_title: "IDE Nativ", feat4_desc: "Kein Terminal-Wechsel mehr. Überwachen Sie Daemon-Hooks nativ durch VS Code- und IntelliJ IDEA-Erweiterungen.",
            footer_subtitle: "Asynchroner Commit Polierer.", footer_plugins: "Plugins", footer_resources: "Ressourcen", footer_repo: "GitHub Repositories", footer_releases: "Releases",
            term_input: 'git commit -m "zeug fixen"', term_line1: "<span class=\"t-dim\">[main 4f1a2b3] zeug reparieren</span>", term_line2: '<span class="t-wait">✨ git-ai:</span> Hintergrund-Polieren gestartet (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Commit-Nachricht poliert', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Jetzt installieren", btn_github: "Quellcode ansehen", prob_title: "Das KI-Warteproblem", prob_desc: "Synchrone CLI-Tools sperren dein Terminal für 10-30 Sekunden, während das LLM eine Commit-Nachricht generiert. Das reicht, um deinen Flow zu unterbrechen und den Kontext zu verlieren.", sec_arch: "Architektur", flow_title: "So funktioniert der Daemon", flow_step1_title: "12ms Hook", flow_step1_desc: "Führe git commit -m \"fix\" aus. Der abfangende Post-Commit-Hook wird sofort beendet.", flow_step2_title: "Daemon trennt sich", flow_step2_desc: "Ein Hintergrundprozess verwaist sich im OS und gibt dein Terminal vollständig frei.", flow_step3_title: "Geistpolieren", flow_step3_desc: "Der Daemon fragt das LLM ab, erstellt aus dem aufgezeichneten Commit einen Ersatz und setzt den Ref nur atomar weiter, wenn er unverändert ist.", flow_step4_title: "Auto-Warteschlange", flow_step4_desc: "Bei einem frühen Push warten die exakten Ref-Aktualisierungen, bis der sichere Ersatz abgeschlossen ist.", eco_title: "Tiefe IDE-Integration", eco_desc: "Native Plugins für VS Code und IntelliJ IDEA fragen externen App-Status, Logs und sichere Steuerungen über die CLI ab, ohne Projektdateien anzulegen.", sec_support: "Support", faq_title: "Häufig gestellte Fragen", faq1_q: "Wird das meinen git-Verlauf durcheinander bringen?", faq1_a: "Nein. Git AI zeichnet den exakten Commit-SHA und Ref auf und aktualisiert atomar per Compare-and-Swap. Wurde der Ref verschoben oder schlägt ein Schritt fehl, bleiben Git und Arbeitsdateien unverändert.", faq2_q: "Was, wenn ich pushe, während noch generiert wird?", faq2_a: "Standardmäßig stellt der pre-push-Hook während der Überarbeitung die exakten Ref-Aktualisierungen zurück. Ist eine sichere Wiederholung nicht beweisbar oder fehlen Anmeldedaten, stoppt Git AI und fordert zum manuellen Wiederholen auf.", faq3_q: "Welche LLMs werden unterstützt?", faq3_a: "Git AI unterstützt nativ die APIs von OpenAI, Anthropic, Gemini und DeepSeek. Es unterstützt auch lokal gehostete Modelle wie Ollama.", faq4_q: "Brauche ich das IDE-Plugin, um es zu nutzen?", faq4_a: "Nein, die Kern-Engine ist ein eigenständiges Go-Binary, das rein über Standard-Git-Hooks arbeitet. Es funktioniert universell.", cta_title: "Fange an, schneller zu committen.", cta_desc: "Installiere die CLI per Skript oder hol dir ein IDE-Plugin.", feat_dash_title: "Persönliches Produktivitäts-Dashboard", feat_dash_desc: "Verfolgen Sie Ihre gesparte Zeit und die Anzahl der KI-polierten Commits. Ein natives Dashboard in Ihrer IDE gibt Ihnen einen greifbaren Einblick, wie viel repetitive Arbeit der Daemon eliminiert hat.", feat_hist_title: "KI-Commit-Verlauf", feat_hist_desc: "Verlieren Sie nie die Absicht Ihres 'Originalentwurfs'. Die interaktive Zeitleiste hebt hervor, welche Commits von der KI mitverfasst wurden, und zeigt die genauen Modelle, die Generierungslatenz und Ihre ursprünglichen Gedanken."
        },
        es: {
            seo_title: "Git AI - Pulidor de Commits Asíncrono en Segundo Plano", seo_desc: "Git AI es un pulidor de commits Git asíncrono sin fricción. Escribe código, ejecuta git commit, y deja que el demonio fantasma reescriba tus mensajes en segundo plano con IA. Compatible con OpenAI, Anthropic, Gemini, DeepSeek y Ollama.",
            nav_features: "Características", hero_badge: "v1.2.2 Lanzado", hero_title: "Haz commit primero,<br>piensa <span>después.</span>", hero_desc: "No esperes a la IA. Sigue codificando mientras Git AI escribe tus mensajes de commit de fondo. <strong>El pulidor asíncrono sin fricción.</strong>",
            btn_vscode: "Obtener extensión de VS Code", btn_idea: "Obtener plugin de JetBrains", hero_cli_link: "¿Maximalista de la terminal? Obtén el motor CLI →",
            feat1_title: "Cero latencia", feat1_desc: "Tu commit se completa en 12 ms. El LLM procesa todo en un demonio en segundo plano huérfano.",
            feat2_title: "Estado en tiempo real", feat2_desc: "La CLI guarda el estado en el directorio de datos de la aplicación del sistema; los IDE lo consultan sin añadir archivos al repositorio.",
            feat3_title: "Push en cola", feat3_desc: "¿Ejecutas <code>git push</code> durante el pulido? Git AI pone en cola la actualización exacta de la referencia y solo la reproduce cuando es demostrablemente seguro.",
            feat4_title: "Nativo de IDE", feat4_desc: "No más cambios de terminal. Monitorea los hooks del demonio de manera nativa a través de las extensiones de VS Code e IntelliJ IDEA.",
            footer_subtitle: "Pulidor asíncrono de commits.", footer_plugins: "Plugins", footer_resources: "Recursos", footer_repo: "Repositorios de GitHub", footer_releases: "Lanzamientos",
            term_input: 'git commit -m "arreglar cosas"', term_line1: "<span class=\"t-dim\">[main 4f1a2b3] arreglar cosas</span>", term_line2: '<span class="t-wait">✨ git-ai:</span> Pulido en segundo plano iniciado (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Mensaje de commit pulido', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>',
            nav_problem: "Problema", nav_faq: "FAQ", btn_install: "Instalar ahora", btn_github: "Ver código fuente", prob_title: "El problema de la espera con IA", prob_desc: "Las herramientas CLI síncronas bloquean tu terminal durante 10-30 segundos mientras el LLM genera un mensaje de commit. Es suficiente fricción para romper tu flujo y perder el contexto.", sec_arch: "Arquitectura", flow_title: "Cómo funciona el demonio", flow_step1_title: "Hook de 12ms", flow_step1_desc: "Ejecuta git commit -m \"fix\". El hook post-commit interceptador termina al instante.", flow_step2_title: "Demonio desvinculado", flow_step2_desc: "Un proceso en segundo plano se convierte en huérfano del SO, liberando completamente tu terminal.", flow_step3_title: "Pulido fantasma", flow_step3_desc: "El daemon consulta al LLM, crea un reemplazo desde el commit registrado y avanza la referencia de forma atómica solo si no se ha movido.", flow_step4_title: "Cola automática", flow_step4_desc: "Si haces push antes, las actualizaciones exactas de referencias esperan hasta que termine el reemplazo seguro.", eco_title: "Integración profunda con IDE", eco_desc: "Los plugins nativos de VS Code e IntelliJ IDEA consultan a la CLI el estado externo, los registros y controles seguros sin crear archivos de proyecto.", sec_support: "Soporte", faq_title: "Preguntas frecuentes", faq1_q: "¿Alterará mi historial de git?", faq1_a: "No. Git AI registra el SHA y la referencia exactos y usa una actualización atómica de comparación e intercambio. Si la referencia se movió o falla algún paso, Git y los archivos de trabajo quedan intactos.", faq2_q: "¿Qué pasa si hago push mientras aún está generando?", faq2_a: "De forma predeterminada, el hook pre-push pone en cola las actualizaciones exactas de referencias durante el pulido. Si no puede demostrarse que la repetición es segura o faltan credenciales, Git AI se detiene y pide reintentarlo manualmente.", faq3_q: "¿Qué LLMs son compatibles?", faq3_a: "Git AI soporta nativamente las APIs de OpenAI, Anthropic, Gemini y DeepSeek. También soporta modelos alojados localmente como Ollama.", faq4_q: "¿Necesito el plugin IDE para usarlo?", faq4_a: "No, el motor principal es un binario Go independiente que opera únicamente a través de hooks Git estándar. Funciona universalmente.", cta_title: "Empieza a hacer commits más rápido.", cta_desc: "Instala la CLI mediante script u obtén un plugin IDE.", feat_dash_title: "Panel de Productividad Personal", feat_dash_desc: "Rastrea el tiempo ahorrado y la cantidad de commits pulidos por IA. Un panel nativo dentro de tu IDE te brinda una visión tangible de cuánto trabajo repetitivo ha eliminado el demonio.", feat_hist_title: "Historial de Commits con IA", feat_hist_desc: "Nunca pierdas la intención de tu 'Borrador Original'. La línea de tiempo interactiva destaca qué commits fueron coescritos por la IA, revelando los modelos exactos, la latencia de generación y tus pensamientos crudos originales."

        },
        ja: {
            seo_title: "Git AI - 非同期バックグラウンドコミットポリッシャー", seo_desc: "Git AIはゼロフリクションの非同期Gitコミットポリッシャーです。コードを書いてgit commitを実行するだけで、ゴーストデーモンがバックグラウンドでAIを使ってメッセージを書き換えます。OpenAI、Anthropic、Gemini、DeepSeek、Ollamaに対応。",
            nav_features: "機能", hero_badge: "v1.2.2 リリース", hero_title: "先にコミットし、<br>後で<span>考える。</span>", hero_desc: "AIを待つ必要はありません。Git AIがバックグラウンドでコミットメッセージを作成している間も、コーディングを続けましょう。<strong>ゼロフリクションの非同期ポリッシャー。</strong>",
            btn_vscode: "VS Code拡張機能を取得", btn_idea: "JetBrainsプラグインを取得", hero_cli_link: "ターミナル派ですか？ CLIエンジンを取得 →",
            feat1_title: "ゼロ遅延", feat1_desc: "コミットは12ミリ秒で完了します。LLMは孤児化したバックグラウンドデーモンですべてを処理します。",
            feat2_title: "リアルタイム・ステータス", feat2_desc: "CLI は実行状態を OS のアプリデータディレクトリに保存し、IDE はリポジトリへファイルを追加せずに照会します。",
            feat3_title: "キュー・プッシュ", feat3_desc: "処理中に <code>git push</code> しても、Git AI は正確な参照更新をキューに入れ、安全と証明できる場合だけ再実行します。",
            feat4_title: "IDEネイティブ", feat4_desc: "ターミナルの切り替えはもう必要ありません。VS CodeとIntelliJ IDEA拡張機能を通じてデーモンフックをネイティブに監視します。",
            footer_subtitle: "非同期コミットポリッシャー", footer_plugins: "プラグイン", footer_resources: "リソース", footer_repo: "GitHubリポジトリ", footer_releases: "リリース",
            term_input: 'git commit -m "バグ修正"', term_line1: "<span class=\"t-dim\">[main 4f1a2b3] 不具合を修正</span>", term_line2: '<span class="t-wait">✨ git-ai:</span> バックグラウンドでの推敲を開始しました (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> コミットメッセージの推敲が完了しました', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "課題", nav_faq: "よくある質問", btn_install: "今すぐインストール", btn_github: "ソースを見る", prob_title: "AI待ち時間の問題", prob_desc: "同期CLIツールはLLMがコミットメッセージを生成する間、ターミナルを10〜30秒ロックします。それはフローを中断してコンテキストを失うのに十分な摩擦です。", sec_arch: "アーキテクチャ", flow_title: "デーモンの仕組み", flow_step1_title: "12msフック", flow_step1_desc: "git commit -m \"fix\"を実行します。インターセプトするpost-commitフックが即座に完了します。", flow_step2_title: "デーモンが切り離される", flow_step2_desc: "バックグラウンドプロセスがOSに対して孤児化し、ターミナルを完全に解放します。", flow_step3_title: "ゴーストポリッシング", flow_step3_desc: "デーモンは LLM に問い合わせ、記録したコミットから代替コミットを作り、参照が動いていない場合だけ原子的に更新します。", flow_step4_title: "自動キュー", flow_step4_desc: "先に push した場合、正確な参照更新は安全な置換が完了するまでキューで待機します。", eco_title: "深いIDE統合", eco_desc: "VS Code と IntelliJ IDEA のネイティブプラグインは、プロジェクトファイルを作らずに CLI から外部状態、ログ、安全な操作を取得します。", sec_support: "サポート", faq_title: "よくある質問", faq1_q: "gitの履歴が壊れますか？", faq1_a: "いいえ。Git AI は正確なコミット SHA と参照を記録し、原子的な compare-and-swap 更新を使います。参照が動いた場合や処理に失敗した場合、Git と作業ツリーのファイルは変更されません。", faq2_q: "まだ生成中にpushしたらどうなりますか？", faq2_a: "既定では、pre-push hook が処理中の正確な参照更新をキューに入れます。安全な再実行を証明できない場合や資格情報がない場合、Git AI は停止して手動再試行を案内します。", faq3_q: "どのLLMがサポートされていますか？", faq3_a: "Git AIはOpenAI、Anthropic、Gemini、DeepSeek APIをネイティブにサポートしています。Ollamaのようなローカルホストモデルもサポートしています。", faq4_q: "IDEプラグインが必要ですか？", faq4_a: "いいえ、コアエンジンは標準のGitフックのみで動作するスタンドアロンのGoバイナリです。あらゆる環境で動作します。", cta_title: "より速くコミットを始めましょう。", cta_desc: "スクリプトでCLIをインストールするか、IDEプラグインを入手してください。", feat_dash_title: "個人用生産性ダッシュボード", feat_dash_desc: "節約した時間とAIが推敲したコミット数を追跡します。IDE内のネイティブなダッシュボードで、バックグラウンドデーモンがどれだけの反復作業を排除したかを具体的に把握できます。", feat_hist_title: "AIコミット履歴", feat_hist_desc: "「元の下書き」の意図を失うことはもうありません。インタラクティブなタイムラインは、AIによって作成されたコミットを強調し、正確なモデル、生成遅延、および元の思考を明確にします。"
        },
        ko: {
            seo_title: "Git AI - 비동기 백그라운드 커밋 폴리셔", seo_desc: "Git AI는 마찰 없는 비동기 Git 커밋 폴리셔입니다. 코드를 작성하고 git commit을 실행하면 고스트 데몬이 백그라운드에서 AI로 메시지를 다시 작성합니다. OpenAI, Anthropic, Gemini, DeepSeek, Ollama를 지원합니다.",
            nav_features: "기능", hero_badge: "v1.2.2 출시됨", hero_title: "먼저 커밋하고,<br>나중에 <span>생각하세요.</span>", hero_desc: "AI를 기다리지 마세요. Git AI가 백그라운드에서 커밋 메시지를 작성하는 동안 계속 코딩하세요. <strong>마찰 없는 비동기 폴리셔.</strong>",
            btn_vscode: "VS Code 확장 프로그램 다운로드", btn_idea: "JetBrains 플러그인 다운로드", hero_cli_link: "터미널 매니아신가요? CLI 엔진 받기 →",
            feat1_title: "제로 지연 시간", feat1_desc: "커밋은 12ms 내에 완료됩니다. LLM은 분리된 백그라운드 데몬에서 모든 것을 처리합니다.",
            feat2_title: "실시간 상태", feat2_desc: "CLI는 실행 상태를 OS 앱 데이터 디렉터리에 저장하며, IDE는 저장소에 파일을 추가하지 않고 이를 조회합니다.",
            feat3_title: "대기열 푸시", feat3_desc: "다듬는 중 <code>git push</code>를 실행하면 Git AI가 정확한 참조 업데이트를 대기열에 넣고 안전함이 입증될 때만 재실행합니다.",
            feat4_title: "IDE 네이티브", feat4_desc: "더 이상 터미널을 전환할 필요가 없습니다. VS Code 및 IntelliJ IDEA 확장을 통해 데몬 훅을 기본적으로 모니터링하세요.",
            footer_subtitle: "비동기 커밋 폴리셔.", footer_plugins: "플러그인", footer_resources: "리소스", footer_repo: "GitHub 저장소", footer_releases: "출시",
            term_input: 'git commit -m "버그 수정"', term_line1: "<span class=\"t-dim\">[main 4f1a2b3] 버그 수정</span>", term_line2: '<span class="t-wait">✨ git-ai:</span> 백그라운드 폴리싱 시작됨 (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> 커밋 메시지 윤색 완료', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "문제", nav_faq: "자주 묻는 질문", btn_install: "지금 설치", btn_github: "소스 보기", prob_title: "AI 대기 문제", prob_desc: "동기 CLI 도구는 LLM이 커밋 메시지를 생성하는 동안 10-30초 동안 터미널을 잠급니다. 그것은 흐름을 끊고 컨텍스트를 잃기에 충분한 마찰입니다.", sec_arch: "아키텍처", flow_title: "데몬 작동 방식", flow_step1_title: "12ms 훅", flow_step1_desc: "git commit -m \"fix\"를 실행합니다. 인터셉트하는 post-commit 훅이 즉시 완료됩니다.", flow_step2_title: "데몬 분리", flow_step2_desc: "백그라운드 프로세스가 OS에 고아화되어 터미널을 완전히 해방합니다.", flow_step3_title: "고스트 폴리싱", flow_step3_desc: "데몬은 LLM에 요청하고 기록된 커밋으로 대체 커밋을 만든 뒤, 참조가 이동하지 않은 경우에만 원자적으로 갱신합니다.", flow_step4_title: "자동 대기열", flow_step4_desc: "먼저 push하면 정확한 참조 업데이트가 안전한 교체가 끝날 때까지 대기열에서 기다립니다.", eco_title: "심층 IDE 통합", eco_desc: "VS Code와 IntelliJ IDEA 네이티브 플러그인은 프로젝트 파일을 만들지 않고 CLI에서 외부 상태, 로그, 안전한 제어를 조회합니다.", sec_support: "지원", faq_title: "자주 묻는 질문", faq1_q: "git 기록이 엉망이 될까요?", faq1_a: "아니요. Git AI는 정확한 커밋 SHA와 참조를 기록하고 원자적 compare-and-swap 갱신을 사용합니다. 참조가 이동했거나 단계가 실패하면 Git과 작업 공간 파일은 그대로 유지됩니다.", faq2_q: "아직 생성 중에 push하면 어떻게 되나요?", faq2_a: "기본적으로 pre-push hook은 다듬는 동안 정확한 참조 업데이트를 대기열에 넣습니다. 안전한 재실행을 입증할 수 없거나 자격 증명이 없으면 Git AI가 중지하고 수동 재시도를 안내합니다.", faq3_q: "어떤 LLM이 지원되나요?", faq3_a: "Git AI는 OpenAI, Anthropic, Gemini 및 DeepSeek API를 기본적으로 지원합니다. Ollama와 같은 로컬 호스팅 모델도 지원합니다.", faq4_q: "사용하려면 IDE 플러그인이 필요한가요?", faq4_a: "아니요, 코어 엔진은 표준 Git 훅을 통해서만 작동하는 독립형 Go 바이너리입니다. 모든 환경에서 작동합니다.", cta_title: "더 빠르게 커밋을 시작하세요.", cta_desc: "스크립트로 CLI를 설치하거나 IDE 플러그인을 받으세요.", feat_dash_title: "개인 생산성 대시보드", feat_dash_desc: "절약된 시간과 AI가 윤색한 커밋 수를 추적하세요. IDE 내의 네이티브 대시보드는 백그라운드 데몬이 얼마나 많은 반복 작업을 제거했는지 구체적인 통찰력을 제공합니다.", feat_hist_title: "AI 커밋 기록", feat_hist_desc: "'원본 초안'의 의도를 절대 잃지 마세요. 대화형 타임라인은 AI가 작성한 커밋을 강조하여 정확한 모델, 생성 지연 시간, 초기 생각의 흐름을 보여줍니다."
        },
        pt: {
            seo_title: "Git AI - Polidor de Commits Assíncrono em Segundo Plano", seo_desc: "Git AI é um polidor de commits Git assíncrono sem atrito. Escreva código, execute git commit, e deixe o daemon fantasma reescrever suas mensagens em segundo plano com IA. Suporta OpenAI, Anthropic, Gemini, DeepSeek e Ollama.",
            nav_features: "Ressursos", hero_badge: "v1.2.2 Lançado", hero_title: "Faça commit primeiro,<br>pense <span>depois.</span>", hero_desc: "Não espere pela IA. Continue codando enquanto o Git AI escreve suas mensagens de commit em segundo plano. <strong>O polidor assíncrono sem atrito.</strong>",
            btn_vscode: "Obter Extensão VS Code", btn_idea: "Obter Plugin JetBrains", hero_cli_link: "Maximalista de terminal? Obtenha a engine CLI →",
            feat1_title: "Zero Latência", feat1_desc: "Seu commit é concluído em 12ms. O LLM processa tudo num daemon órfão em segundo plano.",
            feat2_title: "Status em Tempo Real", feat2_desc: "A CLI guarda o estado no diretório de dados do aplicativo do sistema; as IDEs o consultam sem adicionar arquivos ao repositório.",
            feat3_title: "Push em Fila", feat3_desc: "Executou <code>git push</code> durante o polimento? O Git AI enfileira a atualização exata da referência e só a reproduz quando isso é comprovadamente seguro.",
            feat4_title: "Nativo da IDE", feat4_desc: "Chega de alternar terminal. Monitore os hooks do daemon nativamente através das extensões do VS Code e IntelliJ IDEA.",
            footer_subtitle: "Polidor Assíncrono de Commit.", footer_plugins: "Plugins", footer_resources: "Recursos", footer_repo: "Repositórios GitHub", footer_releases: "Lançamentos",
            term_input: 'git commit -m "arrumar bug"', term_line1: "<span class=\"t-dim\">[main 4f1a2b3] corrigir coisas</span>", term_line2: '<span class="t-wait">✨ git-ai:</span> Polimento em segundo plano iniciado (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Mensagem de commit refinada', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problema", nav_faq: "FAQ", btn_install: "Instalar agora", btn_github: "Ver código-fonte", prob_title: "O Problema de Espera da IA", prob_desc: "Ferramentas CLI síncronas bloqueiam seu terminal por 10-30 segundos enquanto o LLM gera uma mensagem de commit. É fricção suficiente para quebrar seu fluxo e perder o contexto.", sec_arch: "Arquitetura", flow_title: "Como o Daemon Funciona", flow_step1_title: "Hook de 12ms", flow_step1_desc: "Execute git commit -m \"fix\". O hook post-commit interceptador termina instantaneamente.", flow_step2_title: "Daemon se Desanexa", flow_step2_desc: "Um processo em segundo plano se torna órfão para o SO, liberando completamente seu terminal.", flow_step3_title: "Polimento Fantasma", flow_step3_desc: "O daemon consulta o LLM, cria uma substituição a partir do commit registrado e avança a referência atomicamente apenas se ela não tiver mudado.", flow_step4_title: "Fila Automática", flow_step4_desc: "Se você fizer push antes, as atualizações exatas das referências aguardam até a substituição segura terminar.", eco_title: "Integração Profunda com IDE", eco_desc: "Os plugins nativos do VS Code e IntelliJ IDEA consultam a CLI para obter estado externo, logs e controles seguros, sem criar arquivos de projeto.", sec_support: "Suporte", faq_title: "Perguntas Frequentes", faq1_q: "Isso vai bagunçar meu histórico git?", faq1_a: "Não. O Git AI registra o SHA e a referência exatos e usa uma atualização atômica compare-and-swap. Se a referência mudou ou alguma etapa falhou, o Git e os arquivos de trabalho permanecem intactos.", faq2_q: "E se eu fizer push enquanto ainda está gerando?", faq2_a: "Por padrão, o hook pre-push enfileira as atualizações exatas de referências durante o polimento. Se não for possível provar uma repetição segura ou faltarem credenciais, o Git AI para e pede uma nova tentativa manual.", faq3_q: "Quais LLMs são suportados?", faq3_a: "O Git AI suporta nativamente as APIs OpenAI, Anthropic, Gemini e DeepSeek. Também suporta modelos hospedados localmente como Ollama.", faq4_q: "Preciso do plugin IDE para usá-lo?", faq4_a: "Não, o motor principal é um binário Go independente que opera puramente via hooks Git padrão. Funciona universalmente.", cta_title: "Comece a commitar mais rápido.", cta_desc: "Instale o CLI via script ou obtenha um plugin IDE.", feat_dash_title: "Dashboard de Produtividade Pessoal", feat_dash_desc: "Acompanhe seu tempo economizado e a contagem de commits refinados pela IA. Um dashboard nativo dentro da sua IDE fornece uma visão tangível de quanto trabalho repetitivo o daemon eliminou.", feat_hist_title: "Histórico de Commits com IA", feat_hist_desc: "Nunca perca o rascunho original. A linha do tempo interativa destaca quais commits foram gerados pela IA, revelando os modelos exatos, a latência de geração e sua intenção original."
        },
        ru: {
            seo_title: "Git AI - Асинхронный Фоновый Полировщик Коммитов", seo_desc: "Git AI — это асинхронный полировщик коммитов Git без трения. Пишите код, выполняйте git commit, и пусть фоновый демон перепишет ваши сообщения с помощью ИИ. Поддерживает OpenAI, Anthropic, Gemini, DeepSeek и Ollama.",
            nav_features: "Функции", hero_badge: "Релиз v1.2.2", hero_title: "Сначала коммить,<br>думай <span>потом.</span>", hero_desc: "Не ждите ИИ. Продолжайте кодить, пока Git AI пишет сообщения для коммитов в фоновом режиме. <strong>Асинхронный полировщик без трения.</strong>",
            btn_vscode: "Скачать для VS Code", btn_idea: "Скачать для JetBrains", hero_cli_link: "Максималист терминала? Скачайте CLI →",
            feat1_title: "Нулевая задержка", feat1_desc: "Ваш коммит занимает 12 мс. LLM обрабатывает всё в изолированном фоновом демоне.",
            feat2_title: "Статус в реальном времени", feat2_desc: "CLI хранит состояние в системном каталоге данных приложения; IDE запрашивают его, не добавляя файлы в репозиторий.",
            feat3_title: "Очередь Push", feat3_desc: "Запускаете <code>git push</code> во время обработки? Git AI ставит точное обновление ссылки в очередь и повторяет его, только если безопасность доказана.",
            feat4_title: "Нативная интеграция IDE", feat4_desc: "Больше никаких переключений в терминал. Отслеживайте работу демона через расширения VS Code и IntelliJ IDEA.",
            footer_subtitle: "Асинхронный полировщик коммитов.", footer_plugins: "Плагины", footer_resources: "Ресурсы", footer_repo: "Репозитории GitHub", footer_releases: "Релизы",
            term_input: 'git commit -m "пофиксить баг"', term_line1: "<span class=\"t-dim\">[main 4f1a2b3] исправить ошибку</span>", term_line2: '<span class="t-wait">✨ git-ai:</span> Фоновая полировка начата (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Сообщение коммита отполировано', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Проблема", nav_faq: "FAQ", btn_install: "Установить сейчас", btn_github: "Просмотр исходного кода", prob_title: "Проблема ожидания ИИ", prob_desc: "Синхронные CLI-инструменты блокируют ваш терминал на 10-30 секунд, пока LLM генерирует сообщение коммита. Этого достаточно для прерывания потока и потери контекста.", sec_arch: "Архитектура", flow_title: "Как работает демон", flow_step1_title: "Хук 12мс", flow_step1_desc: "Выполните git commit -m \"fix\". Перехватывающий post-commit хук завершается мгновенно.", flow_step2_title: "Демон отсоединяется", flow_step2_desc: "Фоновый процесс становится сиротой для ОС, полностью освобождая терминал.", flow_step3_title: "Призрачная полировка", flow_step3_desc: "Демон обращается к LLM, создаёт замену из записанного коммита и атомарно обновляет ссылку, только если она не изменилась.", flow_step4_title: "Авто-очередь", flow_step4_desc: "При раннем push точные обновления ссылок ждут завершения безопасной замены.", eco_title: "Глубокая интеграция с IDE", eco_desc: "Нативные плагины VS Code и IntelliJ IDEA запрашивают через CLI внешнее состояние, журналы и безопасные команды, не создавая файлы проекта.", sec_support: "Поддержка", faq_title: "Часто задаваемые вопросы", faq1_q: "Это испортит мою историю git?", faq1_a: "Нет. Git AI записывает точные SHA коммита и ссылку, затем использует атомарное compare-and-swap обновление. Если ссылка сдвинулась или шаг завершился ошибкой, Git и файлы рабочей области не меняются.", faq2_q: "Что если я делаю push пока идёт генерация?", faq2_a: "По умолчанию hook pre-push ставит точные обновления ссылок в очередь на время обработки. Если безопасный повтор нельзя доказать или нет учётных данных, Git AI останавливается и просит повторить вручную.", faq3_q: "Какие LLM поддерживаются?", faq3_a: "Git AI нативно поддерживает API OpenAI, Anthropic, Gemini и DeepSeek. Также поддерживаются локально размещённые модели, такие как Ollama.", faq4_q: "Мне нужен плагин IDE для работы?", faq4_a: "Нет, основной движок — это автономный бинарный файл Go, работающий исключительно через стандартные хуки Git. Работает универсально.", cta_title: "Начните коммитить быстрее.", cta_desc: "Установите CLI через скрипт или получите плагин IDE.", feat_dash_title: "Панель продуктивности", feat_dash_desc: "Отслеживайте сэкономленное время и количество отполированных ИИ коммитов. Встроенная в IDE панель мониторинга дает наглядное представление о том, сколько рутинной работы устранил демон.", feat_hist_title: "История коммитов ИИ", feat_hist_desc: "Никогда не теряйте изначальный смысл черновика. Интерактивная временная шкала выделяет коммиты, созданные ИИ, показывая точные модели, время генерации и ваши первоначальные мысли."
        },
        ar: {
            seo_title: "Git AI - مُحسّن Commit غير متزامن في الخلفية", seo_desc: "Git AI هو مُحسّن رسائل Git commit غير متزامن وخالٍ من الاحتكاك. اكتب كودك، نفّذ git commit، واترك الشبح الخلفي يعيد كتابة رسائلك بالذكاء الاصطناعي. يدعم OpenAI وAnthropic وGemini وDeepSeek وOllama.",
            nav_features: "الميزات", hero_badge: "تم إصدار v1.2.2", hero_title: "قم بالـ Commit أولاً،<br>وفكر <span>لاحقاً.</span>", hero_desc: "لا تنتظر الذكاء الاصطناعي. استمر في البرمجة بينما يكتب Git AI رسائل الإيداع الخاصة بك في الخلفية. <strong>المُحسّن المتزامن الخالي من الاحتكاك.</strong>",
            btn_vscode: "احصل على إضافة VS Code", btn_idea: "احصل على إضافة JetBrains", hero_cli_link: "هل تفضل الـ Terminal فقط؟ احصل على محرك CLI →",
            feat1_title: "بدون تأخير", feat1_desc: "يستغرق الإيداع الخاص بك 12 ميلي ثانية. تقوم نماذج LLM بمعالجة كل شيء في خادم خلفية منفصل.",
            feat2_title: "حالة فورية", feat2_desc: "تحفظ أداة CLI حالة التشغيل في مجلد بيانات التطبيق التابع للنظام، وتستعلم عنها بيئات IDE دون إضافة ملفات إلى المستودع.",
            feat3_title: "طابور الـ Push", feat3_desc: "هل تنفذ <code>git push</code> أثناء التحسين؟ يضع Git AI تحديث المرجع الدقيق في الطابور ولا يعيده إلا عندما تكون السلامة مثبتة.",
            feat4_title: "تكامل مع IDE", feat4_desc: "لا مزيد من التبديل بين النوافذ. راقب أوامر الخادم بشكل أصلي من خلال إضافات VS Code و IntelliJ IDEA.",
            footer_subtitle: "مُحسّن رسائل الإيداع غير المتزامن.", footer_plugins: "الإضافات", footer_resources: "الموارد", footer_repo: "مستودعات GitHub", footer_releases: "الإصدارات",
            term_input: 'git commit -m "إصلاح خلل"', term_line1: "<span class=\"t-dim\">[main 4f1a2b3] إصلاح خلل</span>", term_line2: '<span class="t-wait">✨ git-ai:</span> بدأ التحسين في الخلفية (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> تم تحسين رسالة الإيداع', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "المشكلة", nav_faq: "الأسئلة الشائعة", btn_install: "تثبيت الآن", btn_github: "عرض الكود المصدري", prob_title: "مشكلة الانتظار مع الذكاء الاصطناعي", prob_desc: "تقوم أدوات CLI المتزامنة بتجميد المحطة الطرفية لمدة 10-30 ثانية بينما يقوم LLM بإنشاء رسالة إيداع. هذا يكفي لكسر تدفق عملك وفقدان السياق.", sec_arch: "البنية التقنية", flow_title: "كيف يعمل الخادم الخلفي", flow_step1_title: "Hook بـ 12ms", flow_step1_desc: "قم بتنفيذ git commit -m \"fix\". يكتمل hook ما بعد الإيداع فورًا.", flow_step2_title: "انفصال الخادم", flow_step2_desc: "تتيتم عملية خلفية للنظام، وتحرر المحطة الطرفية بالكامل.", flow_step3_title: "التحسين الخفي", flow_step3_desc: "يطلب الخادم الخلفي من LLM، ويبني بديلاً من الإيداع المسجل، ثم يحدّث المرجع ذرياً فقط إذا لم يتحرك.", flow_step4_title: "الطابور التلقائي", flow_step4_desc: "إذا نفذت push مبكراً، تنتظر تحديثات المراجع الدقيقة حتى يكتمل الاستبدال الآمن.", eco_title: "تكامل عميق مع IDE", eco_desc: "تستعلم إضافات VS Code وIntelliJ IDEA الأصلية من CLI عن الحالة الخارجية والسجلات وعناصر التحكم الآمنة من دون إنشاء ملفات مشروع.", sec_support: "الدعم", faq_title: "الأسئلة الشائعة", faq1_q: "هل سيفسد تاريخ git الخاص بي؟", faq1_a: "لا. يسجل Git AI معرّف SHA والمرجع بدقة ويستخدم تحديث مقارنة وتبديل ذرياً. إذا تحرك المرجع أو فشلت أي خطوة، تبقى ملفات Git ومساحة العمل دون تغيير.", faq2_q: "ماذا لو قمت بالـ push أثناء التوليد؟", faq2_a: "افتراضياً، يضع hook ما قبل الدفع تحديثات المراجع الدقيقة في الطابور أثناء التحسين. إذا تعذر إثبات أمان الإعادة أو لم تتوفر بيانات الاعتماد، يتوقف Git AI ويطلب إعادة المحاولة يدوياً.", faq3_q: "ما نماذج LLM المدعومة؟", faq3_a: "يدعم Git AI نواتج API من OpenAI وAnthropic وGemini وDeepSeek. كما يدعم النماذج المستضافة محليًا مثل Ollama.", faq4_q: "هل أحتاج إلى إضافة IDE لاستخدامه؟", faq4_a: "لا، المحرك الأساسي هو ملف ثنائي مستقل بلغة Go يعمل فقط عبر هوكات Git القياسية. يعمل بشكل عالمي.", cta_title: "ابدأ بالـ commit بشكل أسرع.", cta_desc: "ثبّت CLI عبر سكريبت أو احصل على إضافة IDE.", feat_dash_title: "لوحة إنتاجية شخصية", feat_dash_desc: "تتبع الوقت الذي وفرته وعدد رسائل الإيداع المحسنة بواسطة الذكاء الاصطناعي. تمنحك لوحة القيادة المدمجة في IDE الخاص بك رؤية ملموسة لمقدار العمل المتكرر الذي قام الخادم بالقضاء عليه.", feat_hist_title: "تاريخ إيداعات الذكاء الاصطناعي", feat_hist_desc: "لن تفقد أبدًا القصد من 'المسودة الأصلية'. تبرز الخريطة الزمنية التفاعلية الإيداعات التي تمت كتابتها عن طريق الذكاء الاصطناعي، وتكشف عن النماذج الدقيقة ووقت التوليد وأفكارك الأولية."
        },
        vi: {
            seo_title: "Git AI - Công cụ Trau chuốt Commit Bất đồng bộ", seo_desc: "Git AI là công cụ trau chuốt commit Git bất đồng bộ không ma sát. Viết code, chạy git commit, và để daemon ma viết lại thông điệp của bạn ở nền bằng AI. Hỗ trợ OpenAI, Anthropic, Gemini, DeepSeek và Ollama.",
            nav_features: "Tính năng", hero_badge: "Đã phát hành v1.2.2", hero_title: "Commit trước,<br>nghĩ <span>sau.</span>", hero_desc: "Đừng chờ đợi AI. Cứ tiếp tục code trong khi Git AI viết thông điệp commit cho bạn ở chế độ nền. <strong>Công cụ trau chuốt bất đồng bộ không độ trễ.</strong>",
            btn_vscode: "Tải Tiện ích VS Code", btn_idea: "Tải Plugin JetBrains", hero_cli_link: "Fan cuồng của Terminal? Tải ngay CLI engine →",
            feat1_title: "Độ Trễ Bằng 0", feat1_desc: "Commit của bạn hoàn tất trong 12 mili-giây. LLM xử lý mọi việc bằng một daemon độc lập chạy ngầm.",
            feat2_title: "Trạng thái Thời gian thực", feat2_desc: "CLI lưu trạng thái hoạt động trong thư mục dữ liệu ứng dụng của hệ điều hành; IDE truy vấn trạng thái mà không thêm tệp vào kho mã.",
            feat3_title: "Hàng đợi Push", feat3_desc: "Chạy <code>git push</code> khi đang trau chuốt? Git AI xếp đúng bản cập nhật tham chiếu vào hàng đợi và chỉ phát lại khi chứng minh được là an toàn.",
            feat4_title: "Tích hợp IDE Tự nhiên", feat4_desc: "Không cần chuyển đổi sang terminal nữa. Giám sát các daemon hook trực tiếp thông qua tiện ích mở rộng của VS Code và IntelliJ IDEA.",
            footer_subtitle: "Công cụ trau chuốt commit bất đồng bộ.", footer_plugins: "Tiện ích mở rộng", footer_resources: "Tài nguyên", footer_repo: "Kho lưu trữ GitHub", footer_releases: "Các phiên bản",
            term_input: 'git commit -m "sửa vài lỗi"', term_line1: "<span class=\"t-dim\">[main 4f1a2b3] sửa vài lỗi</span>", term_line2: '<span class="t-wait">✨ git-ai:</span> Quá trình trau chuốt chạy ngầm bắt đầu (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Đã trau chuốt thông điệp commit', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Vấn đề", nav_faq: "Câu hỏi thường gặp", btn_install: "Cài đặt ngay", btn_github: "Xem mã nguồn", prob_title: "Vấn đề chờ đợi AI", prob_desc: "Các công cụ CLI đồng bộ khóa terminal của bạn từ 10-30 giây trong khi LLM tạo thông điệp commit. Đây là đủ ma sát để làm gián đoạn luồng làm việc và mất ngữ cảnh.", sec_arch: "Kiến trúc", flow_title: "Cách daemon hoạt động", flow_step1_title: "Hook 12ms", flow_step1_desc: "Chạy git commit -m \"fix\". Hook post-commit chặn lệnh và hoàn thành ngay lập tức.", flow_step2_title: "Daemon tách rời", flow_step2_desc: "Một tiến trình nền tự mồ côi hóa vào OS, giải phóng hoàn toàn terminal của bạn.", flow_step3_title: "Trau chuốt bóng tối", flow_step3_desc: "Daemon gọi LLM, tạo commit thay thế từ commit đã ghi nhận và chỉ cập nhật tham chiếu theo cách nguyên tử nếu nó chưa di chuyển.", flow_step4_title: "Hàng đợi tự động", flow_step4_desc: "Nếu push sớm, các cập nhật tham chiếu chính xác sẽ chờ đến khi thay thế an toàn hoàn tất.", eco_title: "Tích hợp IDE sâu sắc", eco_desc: "Plugin gốc của VS Code và IntelliJ IDEA truy vấn CLI để lấy trạng thái bên ngoài, nhật ký và điều khiển an toàn mà không tạo tệp dự án.", sec_support: "Hỗ trợ", faq_title: "Câu hỏi thường gặp", faq1_q: "Nó có làm hỏng lịch sử git của tôi không?", faq1_a: "Không. Git AI ghi lại chính xác SHA commit và tham chiếu, rồi dùng cập nhật compare-and-swap nguyên tử. Nếu tham chiếu đã di chuyển hoặc bước nào thất bại, Git và các tệp trong vùng làm việc vẫn nguyên vẹn.", faq2_q: "Nếu tôi push trong khi đang tạo thì sao?", faq2_a: "Theo mặc định, hook pre-push xếp các cập nhật tham chiếu chính xác vào hàng đợi trong lúc trau chuốt. Nếu không thể chứng minh phát lại an toàn hoặc thiếu thông tin xác thực, Git AI dừng và yêu cầu thử lại thủ công.", faq3_q: "Những LLM nào được hỗ trợ?", faq3_a: "Git AI hỗ trợ gốc các API OpenAI, Anthropic, Gemini và DeepSeek. Nó cũng hỗ trợ các mô hình được lưu trữ cục bộ như Ollama.", faq4_q: "Tôi có cần plugin IDE để sử dụng không?", faq4_a: "Không, engine cốt lõi là một file nhị phân Go độc lập hoạt động hoàn toàn qua các hook Git tiêu chuẩn. Nó hoạt động phổ quát.", cta_title: "Bắt đầu commit nhanh hơn.", cta_desc: "Cài đặt CLI qua script hoặc lấy plugin IDE.", feat_dash_title: "Bảng Điều Khiển Năng Suất", feat_dash_desc: "Theo dõi thời gian tiết kiệm và số lần trau chuốt commit bằng AI. Bảng điều khiển tích hợp trong IDE cho thấy chính xác bạn đã loại bỏ được bao nhiêu công việc lặp đi lặp lại nhờ có daemon nền.", feat_hist_title: "Lịch Sử Lệnh AI", feat_hist_desc: "Không bao giờ để mất ý tưởng bản nháp ban đầu. Dòng thời gian tương tác làm nổi bật những commit nào được AI viết, hiển thị các mô hình chính xác, độ trễ sinh ra và những suy nghĩ thô sơ ban đầu của bạn."
        },
        th: {
            seo_title: "Git AI - ตัวขัดเกลา Commit แบบอะซิงโครนัสในเบื้องหลัง", seo_desc: "Git AI คือตัวขัดเกลาข้อความ commit Git แบบอะซิงโครนัสที่ไร้แรงเสียดทาน เขียนโค้ด รัน git commit แล้วปล่อยให้ daemon ผีเขียนข้อความของคุณใหม่ด้วย AI ในเบื้องหลัง รองรับ OpenAI, Anthropic, Gemini, DeepSeek และ Ollama",
            nav_features: "คุณลักษณะ", hero_badge: "ปล่อยเวอร์ชัน v1.2.2", hero_title: "Commit ก่อน,<br>คิดที <span>หลัง.</span>", hero_desc: "ไม่ต้องรอ AI. โค้ดต่อไปในขณะที่ Git AI เขียนข้อความคอมมิตให้คุณในเบื้องหลัง <strong>ตัวช่วยเรียบเรียงแบบอะซิงโครนัสที่ไร้รอยต่อ.</strong>",
            btn_vscode: "รับ VS Code Extension", btn_idea: "รับ JetBrains Plugin", hero_cli_link: "ชอบใช้ Terminal อย่างเดียว? รับ CLI engine →",
            feat1_title: "ไร้ความหน่วง", feat1_desc: "คอมมิตของคุณเสร็จสิ้นโใน 12ms. LLM ประมวลผลทุกอย่างใน daemon เบื้องหลังที่แยกตัวออกไป.",
            feat2_title: "สถานะเรียลไทม์", feat2_desc: "CLI เก็บสถานะการทำงานไว้ในไดเรกทอรีข้อมูลแอปของระบบ และ IDE จะสอบถามสถานะโดยไม่เพิ่มไฟล์ลงใน repository",
            feat3_title: "จัดคิวการพุช", feat3_desc: "รัน <code>git push</code> ระหว่างขัดเกลาใช่ไหม Git AI จะเข้าคิวการอัปเดต ref ที่แน่นอน และทำซ้ำเฉพาะเมื่อพิสูจน์ได้ว่าปลอดภัย",
            feat4_title: "รองรับ IDE", feat4_desc: "ไม่ต้องสลับหน้าจอ Terminal อีกต่อไป ตรวจสอบสถานะและ hook ของ daemon ผ่าน VS Code และ IntelliJ IDEA ได้โดยตรง.",
            footer_subtitle: "เครื่องมือเรียบเรียงข้อความคอมมิต.", footer_plugins: "ปลั๊กอิน", footer_resources: "ทรัพยากร", footer_repo: "คลังเก็บบน GitHub", footer_releases: "รุ่นที่ปล่อย",
            term_input: 'git commit -m "แก้งานชั่วคราว"', term_line1: "<span class=\"t-dim\">[main 4f1a2b3] แก้งานชั่วคราว</span>", term_line2: '<span class="t-wait">✨ git-ai:</span> เริ่มกระบวนการขัดเกลาในเบื้องหลัง (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> ขัดเกลาข้อความ commit แล้ว', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "ปัญหา", nav_faq: "คำถามที่พบบ่อย", btn_install: "ติดตั้งทันที", btn_github: "ดูซอร์สโค้ด", prob_title: "ปัญหาการรอ AI", prob_desc: "เครื่องมือ CLI แบบซิงโครนัสจะล็อค Terminal ของคุณเป็นเวลา 10-30 วินาทีขณะที่ LLM กำลังสร้างข้อความ commit นั่นเพียงพอที่จะทำลายกระแสการทำงานและเสียบริบทของคุณ", sec_arch: "สถาปัตยกรรม", flow_title: "วิธีการทำงานของ Daemon", flow_step1_title: "Hook 12ms", flow_step1_desc: "รัน git commit -m \"fix\" hook post-commit ที่ดักจับคำสั่งเสร็จสิ้นทันที", flow_step2_title: "Daemon แยกตัวออก", flow_step2_desc: "กระบวนการเบื้องหลังกลายเป็นลูกกำพร้าของ OS ปล่อย Terminal ของคุณได้อย่างสมบูรณ์", flow_step3_title: "การขัดเกลาแบบล่องหน", flow_step3_desc: "Daemon เรียก LLM สร้าง commit ทดแทนจาก commit ที่บันทึกไว้ และอัปเดต ref แบบอะตอมเฉพาะเมื่อ ref ยังไม่เปลี่ยน", flow_step4_title: "คิวอัตโนมัติ", flow_step4_desc: "หาก push ก่อน การอัปเดต ref ที่แน่นอนจะรอในคิวจนกว่าการแทนที่อย่างปลอดภัยจะเสร็จ", eco_title: "การรวมเข้ากับ IDE อย่างลึกซึ้ง", eco_desc: "ปลั๊กอิน VS Code และ IntelliJ IDEA แบบเนทีฟสอบถาม CLI สำหรับสถานะภายนอก ล็อก และตัวควบคุมที่ปลอดภัย โดยไม่สร้างไฟล์โครงการ", sec_support: "การสนับสนุน", faq_title: "คำถามที่พบบ่อย", faq1_q: "มันจะทำให้ประวัติ git ของฉันยุ่งเหยิงไหม?", faq1_a: "ไม่ Git AI บันทึก SHA ของ commit และ ref ที่แน่นอน แล้วใช้อัปเดตแบบ compare-and-swap อะตอม หาก ref เคลื่อนหรือขั้นตอนใดล้มเหลว Git และไฟล์ใน workspace จะไม่เปลี่ยน", faq2_q: "ถ้าฉัน push ในขณะที่กำลังสร้างอยู่?", faq2_a: "โดยค่าเริ่มต้น hook pre-push จะเข้าคิวการอัปเดต ref ที่แน่นอนระหว่างขัดเกลา หากพิสูจน์การทำซ้ำอย่างปลอดภัยไม่ได้หรือไม่มีข้อมูลรับรอง Git AI จะหยุดและขอให้ลองใหม่ด้วยตนเอง", faq3_q: "รองรับ LLM อะไรบ้าง?", faq3_a: "Git AI รองรับ API ของ OpenAI, Anthropic, Gemini และ DeepSeek โดยตรง นอกจากนี้ยังรองรับโมเดลที่โฮสต์ในเครื่องเช่น Ollama", faq4_q: "ฉันต้องการปลั๊กอิน IDE เพื่อใช้งานไหม?", faq4_a: "ไม่ Engine หลักเป็นไฟล์ไบนารี Go แบบสแตนด์อโลนที่ทำงานผ่าน Git hooks มาตรฐานเท่านั้น ทำงานได้ทุกที่", cta_title: "เริ่ม commit ได้เร็วขึ้นวันนี้", cta_desc: "ติดตั้ง CLI ผ่านสคริปต์ หรือรับปลั๊กอิน IDE", feat_dash_title: "แดชบอร์ดความสามารถส่วนตัว", feat_dash_desc: "ติดตามเวลาที่คุณประหยัดไปและจำนวน commit ที่ขัดเกลาโดย AI แดชบอร์ดในตัว IDE ของคุณให้ข้อมูลเชิงลึกที่จับต้องได้เกี่ยวกับจำนวนงานซ้ำซากที่ daemon ได้ขจัดไป", feat_hist_title: "ประวัติ Commit จาก AI", feat_hist_desc: "ไม่พลาดความตั้งใจในฉบับร่างของคุณ ไทม์ไลน์เชิงโต้ตอบจะไฮไลต์ commit ที่เข้าร่วมเขียนด้วย AI พร้อมทั้งเปิดเผยโมเดล เวลาสร้างการตอบสนอง และความคิดดั้งเดิมของคุณ"
        },
        id: {
            seo_title: "Git AI - Pemoles Commit Asinkron di Latar Belakang", seo_desc: "Git AI adalah pemoles commit Git asinkron tanpa hambatan. Tulis kode, jalankan git commit, dan biarkan daemon hantu menulis ulang pesan Anda di latar belakang menggunakan AI. Mendukung OpenAI, Anthropic, Gemini, DeepSeek, dan Ollama.",
            nav_features: "Fitur", hero_badge: "v1.2.2 Dirilis", hero_title: "Commit dulu,<br>pikirkan <span>nanti.</span>", hero_desc: "Tidak perlu menunggu AI. Teruslah ngoding sementara Git AI menulis pesan commit Anda di latar belakang. <strong>Pemoles asinkron tanpa hambatan.</strong>",
            btn_vscode: "Dapatkan Ekstensi VS Code", btn_idea: "Dapatkan Plugin JetBrains", hero_cli_link: "Pengguna Terminal? Dapatkan CLI engine →",
            feat1_title: "Nol Latensi", feat1_desc: "Commit Anda selesai dalam 12ms. LLM memproses semuanya lewat daemon latar belakang terpisah.",
            feat2_title: "Status Waktu-Nyata", feat2_desc: "CLI menyimpan status operasi di direktori data aplikasi sistem; IDE menanyakannya tanpa menambahkan file ke repositori.",
            feat3_title: "Push Terjadwal", feat3_desc: "Menjalankan <code>git push</code> saat pemolesan? Git AI mengantrekan pembaruan ref yang tepat dan hanya memutarnya kembali jika terbukti aman.",
            feat4_title: "Native pada IDE", feat4_desc: "Tak perlu lagi bolak-balik ke terminal. Pantau hooks dari daemon secara native lewat ekstensi VS Code dan IntelliJ IDEA.",
            footer_subtitle: "Pemoles Commit Asinkron.", footer_plugins: "Plugin", footer_resources: "Resources", footer_repo: "Repositori GitHub", footer_releases: "Rilis",
            term_input: 'git commit -m "perbaiki sesuatu"', term_line1: "<span class=\"t-dim\">[main 4f1a2b3] perbaiki sesuatu</span>", term_line2: '<span class="t-wait">✨ git-ai:</span> Pemolesan latar belakang sedang berjalan (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Pesan commit berhasil dipoles', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Masalah", nav_faq: "FAQ", btn_install: "Pasang Sekarang", btn_github: "Lihat Kode Sumber", prob_title: "Masalah Menunggu AI", prob_desc: "Perkakas CLI sinkron mengunci terminal Anda selama 10-30 detik saat LLM menghasilkan pesan commit. Itu sudah cukup untuk memutus alur kerja dan kehilangan konteks.", sec_arch: "Arsitektur", flow_title: "Cara Daemon Bekerja", flow_step1_title: "Hook 12ms", flow_step1_desc: "Jalankan git commit -m \"fix\". Hook post-commit yang mencegat selesai secara instan.", flow_step2_title: "Daemon Terpisah", flow_step2_desc: "Proses latar belakang menjatirkan diri ke OS, membebaskan terminal sepenuhnya.", flow_step3_title: "Pemolesan Hantu", flow_step3_desc: "Daemon meminta LLM, membuat pengganti dari commit yang direkam, lalu memajukan ref secara atomik hanya jika belum bergerak.", flow_step4_title: "Antrian Otomatis", flow_step4_desc: "Jika push lebih awal, pembaruan ref yang tepat menunggu hingga penggantian aman selesai.", eco_title: "Integrasi IDE yang Mendalam", eco_desc: "Plugin native VS Code dan IntelliJ IDEA menanyakan CLI untuk status aplikasi eksternal, log, dan kontrol aman tanpa membuat file proyek.", sec_support: "Dukungan", faq_title: "Pertanyaan yang Sering Diajukan", faq1_q: "Apakah ini akan merusak riwayat git saya?", faq1_a: "Tidak. Git AI merekam SHA commit dan ref yang tepat, lalu memakai pembaruan compare-and-swap atomik. Jika ref bergerak atau langkah apa pun gagal, Git dan file ruang kerja tetap tidak berubah.", faq2_q: "Bagaimana jika saya push saat masih menghasilkan?", faq2_a: "Secara default, hook pre-push mengantrekan pembaruan ref yang tepat selama pemolesan. Jika pemutaran ulang yang aman tidak dapat dibuktikan atau kredensial tidak tersedia, Git AI berhenti dan meminta percobaan ulang manual.", faq3_q: "LLM mana yang didukung?", faq3_a: "Git AI mendukung secara native API OpenAI, Anthropic, Gemini, dan DeepSeek. Ini juga mendukung model yang dihosting secara lokal seperti Ollama.", faq4_q: "Apakah saya perlu plugin IDE untuk menggunakannya?", faq4_a: "Tidak, mesin inti adalah biner Go mandiri yang beroperasi murni melalui hook Git standar. Bekerja secara universal.", cta_title: "Mulai commit lebih cepat.", cta_desc: "Pasang CLI melalui skrip atau ambil plugin IDE.", feat_dash_title: "Dasbor Produktivitas Personal", feat_dash_desc: "Lacak waktu yang Anda hemat dan jumlah commit yang dipoles oleh AI. Dasbor bawaan di dalam IDE Anda memberikan gambaran nyata tentang seberapa banyak pekerjaan berulang yang telah dihilangkan oleh daemon.", feat_hist_title: "Riwayat Commit AI", feat_hist_desc: "Jangan pernah kehilangan niat di 'Draf Asli' Anda. Garis waktu interaktif menyoroti commit mana yang ditulis dengan AI, mengungkap model persis yang dipakai, waktu latensi pembuatan, dan draf pemikiran awal Anda."
        }
    };

    // Detect initial language: URL query > localStorage > browser navigator > default 'en'
    const urlParams = new URLSearchParams(window.location.search);
    let currentLang = urlParams.get('lang') || localStorage.getItem('gitai_lang');
    if (!currentLang) {
        currentLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
        if (currentLang.startsWith('zh')) {
            currentLang = currentLang.includes('tw') || currentLang.includes('hk') ? 'zh-tw' : 'zh-cn';
        } else {
            currentLang = currentLang.split('-')[0];
        }
        if (!translations[currentLang]) currentLang = 'en';
    }

    function updateLanguage() {
        document.documentElement.lang = currentLang;
        
        const langData = translations[currentLang] || translations['en'];
        
        // Update document title and SEO description dynamically
        if (langData.seo_title) {
            document.title = langData.seo_title;
        }
        if (langData.seo_desc) {
            const metaDesc = document.getElementById('meta-description');
            if (metaDesc) metaDesc.setAttribute('content', langData.seo_desc);
        }

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (langData[key]) {
                el.innerHTML = langData[key];
            }
        });

        const activeOption = document.querySelector(`.lang-option[data-val="${currentLang}"]`);
        if (activeOption) {
            document.getElementById('lang-selected-text').innerHTML = activeOption.innerHTML;
            document.querySelectorAll('.lang-option').forEach(opt => opt.classList.remove('active'));
            activeOption.classList.add('active');
        }
    }

    // Custom Dropdown Logic
    const langDropdown = document.getElementById('lang-dropdown');
    const langTrigger = document.getElementById('lang-trigger');
    const langOptions = document.querySelectorAll('.lang-option');

    if (langTrigger && langDropdown) {
        langTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            langDropdown.classList.toggle('open');
        });

        document.addEventListener('click', () => {
            langDropdown.classList.remove('open');
        });

        langOptions.forEach(opt => {
            opt.addEventListener('click', (e) => {
                currentLang = e.target.getAttribute('data-val');
                localStorage.setItem('gitai_lang', currentLang);
                updateLanguage();
                langDropdown.classList.remove('open');
            });
        });
    }

    // Initial load
    updateLanguage();



    // Visionary Scroll Story Interaction
    const steps = document.querySelectorAll('.story-step');
    const termContent = document.getElementById('term-content');

    // Defines the terminal content for each step (simulating the background states)
    const getStepContent = (stepIndex) => {
        const langStr = translations[currentLang] || translations['en'];
        switch(stepIndex) {
            case 1:
                return `
                    <div class="t-line visible"><span class="t-prompt">➜</span> <span class="t-primary">${langStr.term_input}</span></div>
                    <div class="t-line visible">${langStr.term_line1}</div>
                    <div class="t-line visible">${langStr.term_line3}</div>
                `;
            case 2:
                return `
                    <div class="t-line visible"><span class="t-prompt">➜</span> <span class="t-primary">${langStr.term_input}</span></div>
                    <div class="t-line visible">${langStr.term_line1}</div>
                    <div class="t-line visible">${langStr.term_line3}</div>
                    <br>
                    <div class="t-line visible"><span class="t-dim">git-ai hook intercepted (12ms)...</span></div>
                    <div class="t-line visible"><span class="t-success">✦ Daemon detached [PID 48291]. Terminal session restored.</span></div>
                    <div class="t-line visible"><span class="t-prompt">➜</span> <span class="cursor"></span></div>
                `;
            case 3:
                return `
                    <div class="t-line visible"><span class="t-prompt">➜</span> <span class="t-primary">${langStr.term_input}</span></div>
                    <div class="t-line visible">${langStr.term_line1}</div>
                    <div class="t-line visible">${langStr.term_line3}</div>
                    <br>
                    <div class="t-line visible"><span class="t-dim">git-ai hook intercepted (12ms)...</span></div>
                    <div class="t-line visible"><span class="t-success">✦ Daemon detached [PID 48291]. Terminal session restored.</span></div>
                    <div class="t-line visible"><span class="t-prompt">➜</span> <span class="cursor"></span></div>
                    <br>
                    <div class="t-line visible" style="color:var(--text-muted); font-size:0.75rem;">--- BACKGROUND PROCESS [48291] ---</div>
                    <div class="t-line visible">${langStr.term_line2}</div>
                    <div class="t-line visible"><span class="t-wait">⚙ Streaming to LLM...</span></div>
                `;
            case 4:
                return `
                    <div class="t-line visible"><span class="t-prompt">➜</span> <span class="t-primary">${langStr.term_input}</span></div>
                    <div class="t-line visible">${langStr.term_line1}</div>
                    <div class="t-line visible">${langStr.term_line3}</div>
                    <br>
                    <div class="t-line visible"><span class="t-dim">git-ai hook intercepted (12ms)...</span></div>
                    <div class="t-line visible"><span class="t-success">✦ Daemon detached [PID 48291]. Terminal session restored.</span></div>
                    <div class="t-line visible"><span class="t-prompt">➜</span> <span class="cursor"></span></div>
                    <br>
                    <div class="t-line visible" style="color:var(--text-muted); font-size:0.75rem;">--- BACKGROUND PROCESS [48291] ---</div>
                    <div class="t-line visible">${langStr.term_line4}</div>
                    <div class="t-line visible">${langStr.term_line5}</div>
                    <div class="t-line visible"><span class="t-success">✓ Executing queued network push: git push origin master</span></div>
                `;
            default:
                return `<div class="t-line visible"><span class="t-prompt">➜</span> <span class="t-dim">Waiting for scroll trigger...</span><span class="cursor"></span></div>`;
        }
    };

    if (termContent && steps.length > 0) {
        let activeStep = 0;
        let currentRenderId = 0;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // When a step enters the middle 40% of the viewport
                if (entry.isIntersecting) {
                    const stepNum = parseInt(entry.target.getAttribute('data-step'));
                    
                    steps.forEach(s => s.classList.remove('is-active'));
                    entry.target.classList.add('is-active');
                    
                    if (stepNum !== activeStep) {
                        const isForward = stepNum > activeStep;
                        activeStep = stepNum;
                        currentRenderId++;
                        const renderId = currentRenderId;
                        
                        termContent.style.opacity = '1';
                        
                        const rawHtml = getStepContent(stepNum).replace(/class="t-line visible"/g, 'class="t-line"');
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = rawHtml;
                        const newLines = Array.from(tempDiv.querySelectorAll('.t-line'));
                        
                        const currentLinesCount = termContent.querySelectorAll('.t-line').length;
                        termContent.innerHTML = '';
                        
                        newLines.forEach((line, index) => {
                            if (!isForward || index < currentLinesCount) {
                                line.classList.add('visible');
                            }
                            termContent.appendChild(line);
                        });
                        
                        if (isForward) {
                            let delay = 0;
                            newLines.forEach((line, index) => {
                                if (index >= currentLinesCount) {
                                    setTimeout(() => {
                                        if (currentRenderId === renderId) {
                                            line.classList.add('visible');
                                            termContent.scrollTop = termContent.scrollHeight;
                                        }
                                    }, delay);
                                    delay += 200;
                                }
                            });
                        } else {
                            termContent.scrollTop = termContent.scrollHeight;
                        }
                    }
                }
            });
        }, {
            root: null,
            rootMargin: "-30% 0px -30% 0px",
            threshold: 0.1
        });

        // Initialize first step as active immediately on load if visible
        steps.forEach(step => observer.observe(step));
    }

    // OS Selector Logic
    const osSelector = document.querySelector('.os-selector-wrap');
    const updateInstallCmd = (os) => {
        const cmdEl = document.getElementById('install-cmd');
        if (!cmdEl) return;
        if (os === 'win') {
            cmdEl.innerText = 'iwr https://raw.githubusercontent.com/daidi/git-ai/main/install.ps1 -useb | iex';
        } else {
            cmdEl.innerText = 'curl -fsSL https://raw.githubusercontent.com/daidi/git-ai/main/install.sh | bash';
        }
    };

    if (osSelector) {
        // Simple OS detection to set initial state
        const isWin = navigator.platform.toLowerCase().indexOf('win') > -1;
        
        const osBtns = osSelector.querySelectorAll('.os-btn');
        osBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                osBtns.forEach(b => b.classList.remove('active'));
                const target = e.target;
                target.classList.add('active');
                updateInstallCmd(target.getAttribute('data-os'));
            });
            
            // Trigger auto-select if Windows is detected
            if (isWin && btn.getAttribute('data-os') === 'win') {
                btn.click();
            }
        });
    }

    // Global Stagger Observer for aesthetic animations
    const staggerObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            }
        });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('.stagger-group').forEach(group => {
        staggerObserver.observe(group);
    });
});

