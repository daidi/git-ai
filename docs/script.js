document.addEventListener('DOMContentLoaded', () => {

    const translations = {
        en: {
            nav_features: "Features", hero_badge: "v1.0.1 Released", hero_title: "Commit first,<br>think <span>later.</span>", hero_desc: "Don't wait for AI. Keep coding while Git AI writes your commit messages in the background. <strong>The zero-friction async polisher.</strong>",
            btn_vscode: "Get VS Code Extension", btn_idea: "Get JetBrains Plugin", hero_cli_link: "Terminal maximalist? Get the CLI engine →",
            feat1_title: "Zero Latency", feat1_desc: "Your commit completes in 12ms. The LLM processes everything in an orphaned background daemon.",
            feat2_title: "Real-time Status", feat2_desc: "<code>[⏳]</code> prefix acts as a locking mechanism visible natively in <code>git log</code> to prevent sync issues.",
            feat3_title: "Queue Push", feat3_desc: "Hitting <code>git push</code> while polishing? We queue the network payload and execute it after the amend finishes.",
            feat4_title: "IDE Native", feat4_desc: "No more terminal toggling. Monitor daemon hooks natively through VS Code and IntelliJ IDEA extensions.",
            footer_subtitle: "Async Commit Polisher.", footer_plugins: "Plugins", footer_resources: "Resources", footer_repo: "GitHub Repositories", footer_releases: "Releases",
            term_input: 'git commit -m "fix stuff"', term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] fix stuff</span>', term_line2: '<span class="t-wait">✨ git-ai:</span> Background polishing started (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Polished commit message', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Install Now", btn_github: "View Source", prob_title: "The AI Waiting Problem", prob_desc: "Synchronous CLI tools lock your terminal for 10-30 seconds while the LLM generates a commit message. That's enough friction to break your flow and lose context.", sec_arch: "Architecture", flow_title: "How the Daemon Works", flow_step1_title: "12ms Hook", flow_step1_desc: "Run git commit -m \"fix\". The intercepting post-commit hook finishes instantly.", flow_step2_title: "Daemon Detaches", flow_step2_desc: "A background process orphans itself to the OS, completely freeing your terminal.", flow_step3_title: "Ghost Polishing", flow_step3_desc: "The script fetches the diff, streams to the LLM, and runs git commit --amend silently.", flow_step4_title: "Auto-Queue", flow_step4_desc: "If you run git push early, the payload queues until the amend finishes.", eco_title: "Deep IDE Integration", eco_desc: "Don't want to use the terminal? Native VS Code and IntelliJ IDEA plugins monitor the state file to provide real-time background status, streaming logs, and controls directly where you write code.", sec_support: "Support", faq_title: "Frequently Asked Questions", faq1_q: "Will it mess up my git history?", faq1_a: "No. Git AI uses a strictly matched lock prefix [⏳]. It only ever amends the latest exact commit it was initiated on.", faq2_q: "What if I push while it's still generating?", faq2_a: "By default, the pre-push hook intercepts the network call, puts it in an execution queue, and releases the terminal. The actual network push runs automatically in the background.", faq3_q: "Which LLMs are supported?", faq3_a: "Git AI natively supports the OpenAI, Anthropic, Gemini, and DeepSeek APIs. It also supports locally hosted models like Ollama.", faq4_q: "Do I need the IDE plugin to use it?", faq4_a: "No, the core engine is a standalone Go binary that operates purely via standard Git hooks. It works universally.", cta_title: "Start commiting faster.", cta_desc: "Install the CLI via script or grab an IDE plugin."
        },
        "zh-cn": {
            nav_features: "核心特性", hero_badge: "v1.0.1 最新发布", hero_title: "先提交，<br>后<span>思考。</span>", hero_desc: "告别漫长的同步等待。你只管写代码，让 Git AI 在后台默默为你写好提交信息。<strong>零摩擦的异步润色体验。</strong>",
            btn_vscode: "获取 VS Code 插件", btn_idea: "获取 JetBrains 插件", hero_cli_link: "只用终端？查看 CLI 极客安装包 →",
            feat1_title: "零感延迟", feat1_desc: "提交命令仅需 12 毫秒。复杂的 LLM 请求全部在被彻底隔离的后台守护进程中静默完成。",
            feat2_title: "实时状态可见", feat2_desc: "临时 <code>[⏳]</code> 前缀作为安全锁，在 <code>git log</code> 中直接反馈状态，杜绝代码同步冲突。",
            feat3_title: "自动排队推送", feat3_desc: "在润色未结束时执行 <code>git push</code>？推送会被加入队列，等待润色完成后在云端自动分发。",
            feat4_title: "IDE 原生集成", feat4_desc: "提供原生的 VS Code 和 IntelliJ IDEA 控制面版，免终端即可查看完整状态监控。",
            footer_subtitle: "异步无感的跨生态 Git 提交润色工具。", footer_plugins: "IDE 插件", footer_resources: "相关资源", footer_repo: "GitHub 仓库", footer_releases: "最新发布版本",
            term_input: 'git commit -m "修个bug"', term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] 修个bug</span>', term_line2: '<span class="t-wait">✨ git-ai:</span> 正在后台处理润色 (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> 润色完成', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "痛点", nav_faq: "常见问题", btn_install: "立即安装", btn_github: "查看源码", prob_title: "AI 工具的等待噩梦", prob_desc: "传统的同步 CLI 工具会在 LLM 生成提交信息时锁死你的终端长达 10-30 秒。这足以打断你的心流并丢失上下文。", sec_arch: "架构", flow_title: "后台守护进程如何工作", flow_step1_title: "12毫秒 Hook", flow_step1_desc: "执行 git commit。拦截的 post-commit hook 瞬间完成并退出。", flow_step2_title: "进程脱离", flow_step2_desc: "后台进程将自己作为孤儿进程托管给操作系统，彻底释放你的终端。", flow_step3_title: "幽灵润色", flow_step3_desc: "后台拉取 diff、请求 LLM，并使用 git commit --amend 静默覆盖。", flow_step4_title: "自动排队", flow_step4_desc: "如果你提前执行 git push，推送事件会被加入队列，等待润色完成后自动网络推送。", eco_title: "深入 IDE 原生集成", eco_desc: "不想用终端？VS Code 和 IntelliJ IDEA 原生插件会监控状态文件，直接在代码控制面板提供实时的后台状态、日志流和干预控制。", sec_support: "技术支持", faq_title: "常见问题答疑", faq1_q: "这会弄乱我的 git 历史吗？", faq1_a: "不会。Git AI 使用严格的前缀锁 [⏳] 匹配。它只会 amend 触发时的那一个精确 commit。", faq2_q: "如果我在生成时强制 push 会怎样？", faq2_a: "默认情况下，pre-push hook 会拦截网络请求，将其加入执行队列并释放终端。等待 amend 结束后，它会在后台自动为你 push。", faq3_q: "支持哪些大语言模型？", faq3_a: "原生支持 OpenAI, Anthropic, Gemini, 和 DeepSeek API。同时也支持市面上兼容 OpenAI 格式的本地化部署模型（如 Ollama）。", faq4_q: "我必须安装 IDE 插件吗？", faq4_a: "不是必需的，核心引擎是一个独立的 Go 语言二进制文件，它完全通过标准的 Git hooks 运作。所有代码编辑器都能通用。", cta_title: "马上提升提交效率。", cta_desc: "运行终端脚本，或在插件市场获取。"
        },
        "zh-tw": {
            nav_features: "核心特性", hero_badge: "v1.0.1 最新發布", hero_title: "先提交，<br>後<span>思考。</span>", hero_desc: "告別漫長的同步等待。你只管寫程式，讓 Git AI 在背景默默為你寫好提交訊息。<strong>零摩擦的非同步潤飾體驗。</strong>",
            btn_vscode: "取得 VS Code 外掛", btn_idea: "取得 JetBrains 外掛", hero_cli_link: "只用終端機？查看 CLI 極客安裝包 →",
            feat1_title: "零感延遲", feat1_desc: "提交命令僅需 12 毫秒。複雜的 LLM 請求全部在被徹底隔離的背景背景程序中靜默完成。",
            feat2_title: "實時狀態可見", feat2_desc: "臨時 <code>[⏳]</code> 前綴作為安全鎖，在 <code>git log</code> 中直接反饋狀態，杜絕程式碼同步衝突。",
            feat3_title: "自動排隊推送", feat3_desc: "在潤飾未結束時執行 <code>git push</code>？推送會被加入佇列，等待潤飾完成後在雲端自動分發。",
            feat4_title: "IDE 原生整合", feat4_desc: "提供原生的 VS Code 和 IntelliJ IDEA 控制面板，免終端機即可查看完整狀態監控。",
            footer_subtitle: "非同步無感的跨生態 Git 提交潤飾工具。", footer_plugins: "IDE 外掛", footer_resources: "相關資源", footer_repo: "GitHub 倉庫", footer_releases: "最新發佈版本",
            term_input: 'git commit -m "修個bug"', term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] 修個bug</span>', term_line2: '<span class="t-wait">✨ git-ai:</span> 正在背景處理潤飾 (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> 潤飾完成', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "痛點", nav_faq: "常見問題", btn_install: "立即安裝", btn_github: "檢視原始碼", prob_title: "AI 工具的等待惡夢", prob_desc: "傳統的同步 CLI 工具會在 LLM 產生提交訊息時鎖死你的終端機長達 10-30 秒。這足以打斷你的心流並遺失上下文。", sec_arch: "架構", flow_title: "背景守護程序如何工作", flow_step1_title: "12毫秒 Hook", flow_step1_desc: "執行 git commit。攔截的 post-commit hook 瞬間完成並退出。", flow_step2_title: "程序脫離", flow_step2_desc: "背景程序將自己作為孤兒程序託管給作業系統，徹底釋放你的終端機。", flow_step3_title: "幽靈潤飾", flow_step3_desc: "背景拉取 diff、請求 LLM，並使用 git commit --amend 靜默覆蓋。", flow_step4_title: "自動排隊", flow_step4_desc: "如果你提前執行 git push，推送事件會被加入佇列，等待潤飾完成後自動網路推送。", eco_title: "深入 IDE 原生整合", eco_desc: "不想用終端機？VS Code 和 IntelliJ IDEA 原生外掛會監控狀態檔案，直接在程式碼控制面板提供實時的背景狀態、日誌流和干預控制。", sec_support: "技術支援", faq_title: "常見問題答疑", faq1_q: "這會弄亂我的 git 歷史嗎？", faq1_a: "不會。Git AI 使用嚴格的前綴鎖 [⏳] 匹配。它只會 amend 觸發時的那一個精確 commit。", faq2_q: "如果我在產生時強制 push 會怎樣？", faq2_a: "預設情況下，pre-push hook 會攔截網路請求，將其加入執行佇列並釋放終端機。等待 amend 結束後，它會在背景自動為你 push。", faq3_q: "支援哪些大型語言模型？", faq3_a: "原生支援 OpenAI, Anthropic, Gemini, 和 DeepSeek API。同時也支援市面上相容 OpenAI 格式的在地化部署模型（如 Ollama）。", faq4_q: "我必須安裝 IDE 外掛嗎？", faq4_a: "不是必須的，核心引擎是一個獨立的 Go 語言二進位檔案，它完全透過標準的 Git hooks 運作。所有程式碼編輯器都能通用。", cta_title: "馬上提升提交效率。", cta_desc: "執行終端機腳本，或在外掛市場取得。"
        },
        fr: {
            nav_features: "Caractéristiques", hero_badge: "v1.0.1 Publié", hero_title: "Commettez d'abord,<br>réfléchissez <span>plus tard.</span>", hero_desc: "N'attendez pas l'IA. Continuez à coder pendant que Git AI rédige vos messages de commit en arrière-plan. <strong>Le polisseur asynchrone zéro friction.</strong>",
            btn_vscode: "Obtenir l'extension VS Code", btn_idea: "Obtenir le plugin JetBrains", hero_cli_link: "Maximaliste du terminal ? Obtenez le moteur CLI →",
            feat1_title: "Zéro Latence", feat1_desc: "Votre commit prend 12 ms. Le LLM traite tout dans un démon en arrière-plan orphelin.",
            feat2_title: "Statut en temps réel", feat2_desc: "Le préfixe <code>[⏳]</code> agit comme un mécanisme de verrouillage visible nativement dans <code>git log</code> pour éviter les problèmes de synchronisation.",
            feat3_title: "File d'attente Push", feat3_desc: "Vous tapez <code>git push</code> pendant le polissage ? Nous mettons le réseau en attente et l'exécutons après la modification.",
            feat4_title: "IDE Natif", feat4_desc: "Fini le basculement de terminal. Surveillez les hooks de démon nativement via les extensions VS Code et IntelliJ IDEA.",
            footer_subtitle: "Polisseur de Commit Asynchrone.", footer_plugins: "Plugins", footer_resources: "Ressources", footer_repo: "Dépôts GitHub", footer_releases: "Versions",
            term_input: 'git commit -m "corriger des trucs"', term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] corriger des trucs</span>', term_line2: '<span class="t-wait">✨ git-ai:</span> Polissage en arrière-plan lancé (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Message de commit poli', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Install Now", btn_github: "View Source", prob_title: "The AI Waiting Problem", prob_desc: "Synchronous CLI tools lock your terminal for 10-30 seconds while the LLM generates a commit message. That's enough friction to break your flow and lose context.", sec_arch: "Architecture", flow_title: "How the Daemon Works", flow_step1_title: "12ms Hook", flow_step1_desc: "Run git commit -m \"fix\". The intercepting post-commit hook finishes instantly.", flow_step2_title: "Daemon Detaches", flow_step2_desc: "A background process orphans itself to the OS, completely freeing your terminal.", flow_step3_title: "Ghost Polishing", flow_step3_desc: "The script fetches the diff, streams to the LLM, and runs git commit --amend silently.", flow_step4_title: "Auto-Queue", flow_step4_desc: "If you run git push early, the payload queues until the amend finishes.", eco_title: "Deep IDE Integration", eco_desc: "Don't want to use the terminal? Native VS Code and IntelliJ IDEA plugins monitor the state file to provide real-time background status, streaming logs, and controls directly where you write code.", sec_support: "Support", faq_title: "Frequently Asked Questions", faq1_q: "Will it mess up my git history?", faq1_a: "No. Git AI uses a strictly matched lock prefix [⏳]. It only ever amends the latest exact commit it was initiated on.", faq2_q: "What if I push while it's still generating?", faq2_a: "By default, the pre-push hook intercepts the network call, puts it in an execution queue, and releases the terminal. The actual network push runs automatically in the background.", faq3_q: "Which LLMs are supported?", faq3_a: "Git AI natively supports the OpenAI, Anthropic, Gemini, and DeepSeek APIs. It also supports locally hosted models like Ollama.", faq4_q: "Do I need the IDE plugin to use it?", faq4_a: "No, the core engine is a standalone Go binary that operates purely via standard Git hooks. It works universally.", cta_title: "Start commiting faster.", cta_desc: "Install the CLI via script or grab an IDE plugin."
        },
        it: {
            nav_features: "Funzionalità", hero_badge: "v1.0.1 Rilasciato", hero_title: "Esegui il commit prima,<br>pensa <span>dopo.</span>", hero_desc: "Non aspettare l'IA. Continua a programmare mentre Git AI scrive i tuoi messaggi di commit in background. <strong>Il lucidatore asincrono senza attrito.</strong>",
            btn_vscode: "Ottieni estensione VS Code", btn_idea: "Ottieni plugin JetBrains", hero_cli_link: "Massimalista del terminale? Ottieni il motore CLI →",
            feat1_title: "Latenza Zero", feat1_desc: "Il tuo commit si completa in 12 ms. L'LLM elabora tutto in un demone in background orfano.",
            feat2_title: "Stato in Tempo Reale", feat2_desc: "Il prefisso <code>[⏳]</code> funge da meccanismo di blocco visibile nativamente in <code>git log</code> per prevenire problemi di sincronizzazione.",
            feat3_title: "Coda Push", feat3_desc: "Premi <code>git push</code> durante la lucidatura? Accodiamo il payload di rete e lo eseguiamo dopo il completamento della modifica.",
            feat4_title: "Nativo per IDE", feat4_desc: "Basta passare dal terminale. Monitora gli hook del demone in modo nativo tramite le estensioni VS Code e IntelliJ IDEA.",
            footer_subtitle: "Lucidatore asincrono di commit.", footer_plugins: "Plugin", footer_resources: "Risorse", footer_repo: "Repository GitHub", footer_releases: "Rilasci",
            term_input: 'git commit -m "fix roba"', term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] fix roba</span>', term_line2: '<span class="t-wait">✨ git-ai:</span> Pulizia in background avviata (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Messaggio di commit migliorato', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Install Now", btn_github: "View Source", prob_title: "The AI Waiting Problem", prob_desc: "Synchronous CLI tools lock your terminal for 10-30 seconds while the LLM generates a commit message. That's enough friction to break your flow and lose context.", sec_arch: "Architecture", flow_title: "How the Daemon Works", flow_step1_title: "12ms Hook", flow_step1_desc: "Run git commit -m \"fix\". The intercepting post-commit hook finishes instantly.", flow_step2_title: "Daemon Detaches", flow_step2_desc: "A background process orphans itself to the OS, completely freeing your terminal.", flow_step3_title: "Ghost Polishing", flow_step3_desc: "The script fetches the diff, streams to the LLM, and runs git commit --amend silently.", flow_step4_title: "Auto-Queue", flow_step4_desc: "If you run git push early, the payload queues until the amend finishes.", eco_title: "Deep IDE Integration", eco_desc: "Don't want to use the terminal? Native VS Code and IntelliJ IDEA plugins monitor the state file to provide real-time background status, streaming logs, and controls directly where you write code.", sec_support: "Support", faq_title: "Frequently Asked Questions", faq1_q: "Will it mess up my git history?", faq1_a: "No. Git AI uses a strictly matched lock prefix [⏳]. It only ever amends the latest exact commit it was initiated on.", faq2_q: "What if I push while it's still generating?", faq2_a: "By default, the pre-push hook intercepts the network call, puts it in an execution queue, and releases the terminal. The actual network push runs automatically in the background.", faq3_q: "Which LLMs are supported?", faq3_a: "Git AI natively supports the OpenAI, Anthropic, Gemini, and DeepSeek APIs. It also supports locally hosted models like Ollama.", faq4_q: "Do I need the IDE plugin to use it?", faq4_a: "No, the core engine is a standalone Go binary that operates purely via standard Git hooks. It works universally.", cta_title: "Start commiting faster.", cta_desc: "Install the CLI via script or grab an IDE plugin."
        },
        de: {
            nav_features: "Funktionen", hero_badge: "v1.0.1 Veröffentlicht", hero_title: "Zuerst committen,<br>später <span>denken.</span>", hero_desc: "Warten Sie nicht auf die KI. Coden Sie weiter, während Git AI Ihre Commit-Nachrichten im Hintergrund schreibt. <strong>Der reibungslose asynchrone Polierer.</strong>",
            btn_vscode: "VS Code Erweiterung", btn_idea: "JetBrains Plugin", hero_cli_link: "Terminal-Maximalist? Hol dir die CLI-Engine →",
            feat1_title: "Null Latenz", feat1_desc: "Dein Commit ist in 12 ms abgeschlossen. Das LLM verarbeitet alles in einem verwaisten Hintergrund-Daemon.",
            feat2_title: "Echtzeit-Status", feat2_desc: "Das <code>[⏳]</code>-Präfix fungiert als Sperrmechanismus, der nativ in <code>git log</code> sichtbar ist, um Synchronisierungsprobleme zu vermeiden.",
            feat3_title: "Warteschlangen-Push", feat3_desc: "<code>git push</code> während des Polierens? Wir reihen die Netzwerk-Payload ein und führen sie nach Abschluss des Amends aus.",
            feat4_title: "IDE Nativ", feat4_desc: "Kein Terminal-Wechsel mehr. Überwachen Sie Daemon-Hooks nativ durch VS Code- und IntelliJ IDEA-Erweiterungen.",
            footer_subtitle: "Asynchroner Commit Polierer.", footer_plugins: "Plugins", footer_resources: "Ressourcen", footer_repo: "GitHub Repositories", footer_releases: "Releases",
            term_input: 'git commit -m "zeug fixen"', term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] zeug fixen</span>', term_line2: '<span class="t-wait">✨ git-ai:</span> Hintergrund-Polieren gestartet (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Commit-Nachricht poliert', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Install Now", btn_github: "View Source", prob_title: "The AI Waiting Problem", prob_desc: "Synchronous CLI tools lock your terminal for 10-30 seconds while the LLM generates a commit message. That's enough friction to break your flow and lose context.", sec_arch: "Architecture", flow_title: "How the Daemon Works", flow_step1_title: "12ms Hook", flow_step1_desc: "Run git commit -m \"fix\". The intercepting post-commit hook finishes instantly.", flow_step2_title: "Daemon Detaches", flow_step2_desc: "A background process orphans itself to the OS, completely freeing your terminal.", flow_step3_title: "Ghost Polishing", flow_step3_desc: "The script fetches the diff, streams to the LLM, and runs git commit --amend silently.", flow_step4_title: "Auto-Queue", flow_step4_desc: "If you run git push early, the payload queues until the amend finishes.", eco_title: "Deep IDE Integration", eco_desc: "Don't want to use the terminal? Native VS Code and IntelliJ IDEA plugins monitor the state file to provide real-time background status, streaming logs, and controls directly where you write code.", sec_support: "Support", faq_title: "Frequently Asked Questions", faq1_q: "Will it mess up my git history?", faq1_a: "No. Git AI uses a strictly matched lock prefix [⏳]. It only ever amends the latest exact commit it was initiated on.", faq2_q: "What if I push while it's still generating?", faq2_a: "By default, the pre-push hook intercepts the network call, puts it in an execution queue, and releases the terminal. The actual network push runs automatically in the background.", faq3_q: "Which LLMs are supported?", faq3_a: "Git AI natively supports the OpenAI, Anthropic, Gemini, and DeepSeek APIs. It also supports locally hosted models like Ollama.", faq4_q: "Do I need the IDE plugin to use it?", faq4_a: "No, the core engine is a standalone Go binary that operates purely via standard Git hooks. It works universally.", cta_title: "Start commiting faster.", cta_desc: "Install the CLI via script or grab an IDE plugin."
        },
        es: {
            nav_features: "Características", hero_badge: "v1.0.1 Lanzado", hero_title: "Haz commit primero,<br>piensa <span>después.</span>", hero_desc: "No esperes a la IA. Sigue programando mientras Git AI escribe tus mensajes de commit en segundo plano. <strong>El pulidor asíncrono sin fricción.</strong>",
            btn_vscode: "Obtener extensión VS Code", btn_idea: "Obtener plugin JetBrains", hero_cli_link: "¿Maximalista del terminal? Obtén el motor CLI →",
            feat1_title: "Cero Latencia", feat1_desc: "Tu commit se completa en 12 ms. El LLM procesa todo en un demonio en segundo plano huérfano.",
            feat2_title: "Estado en Tiempo Real", feat2_desc: "El prefijo <code>[⏳]</code> actúa como un mecanismo de bloqueo visible nativamente en <code>git log</code> para evitar problemas de sincronización.",
            feat3_title: "Push en Cola", feat3_desc: "¿Golpeas <code>git push</code> mientras pule? Encolamos la carga de red y la ejecutamos después de que termine la modificación.",
            feat4_title: "Nativo en IDE", feat4_desc: "Se acabó alternar el terminal. Supervisa los hooks del demonio de forma nativa mediante las extensiones de VS Code e IntelliJ IDEA.",
            footer_subtitle: "Pulidor de Commit Asíncrono.", footer_plugins: "Plugins", footer_resources: "Recursos", footer_repo: "Repositorios de GitHub", footer_releases: "Lanzamientos",
            term_input: 'git commit -m "arreglar cosas"', term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] arreglar cosas</span>', term_line2: '<span class="t-wait">✨ git-ai:</span> Pulido en segundo plano iniciado (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Mensaje de commit pulido', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Install Now", btn_github: "View Source", prob_title: "The AI Waiting Problem", prob_desc: "Synchronous CLI tools lock your terminal for 10-30 seconds while the LLM generates a commit message. That's enough friction to break your flow and lose context.", sec_arch: "Architecture", flow_title: "How the Daemon Works", flow_step1_title: "12ms Hook", flow_step1_desc: "Run git commit -m \"fix\". The intercepting post-commit hook finishes instantly.", flow_step2_title: "Daemon Detaches", flow_step2_desc: "A background process orphans itself to the OS, completely freeing your terminal.", flow_step3_title: "Ghost Polishing", flow_step3_desc: "The script fetches the diff, streams to the LLM, and runs git commit --amend silently.", flow_step4_title: "Auto-Queue", flow_step4_desc: "If you run git push early, the payload queues until the amend finishes.", eco_title: "Deep IDE Integration", eco_desc: "Don't want to use the terminal? Native VS Code and IntelliJ IDEA plugins monitor the state file to provide real-time background status, streaming logs, and controls directly where you write code.", sec_support: "Support", faq_title: "Frequently Asked Questions", faq1_q: "Will it mess up my git history?", faq1_a: "No. Git AI uses a strictly matched lock prefix [⏳]. It only ever amends the latest exact commit it was initiated on.", faq2_q: "What if I push while it's still generating?", faq2_a: "By default, the pre-push hook intercepts the network call, puts it in an execution queue, and releases the terminal. The actual network push runs automatically in the background.", faq3_q: "Which LLMs are supported?", faq3_a: "Git AI natively supports the OpenAI, Anthropic, Gemini, and DeepSeek APIs. It also supports locally hosted models like Ollama.", faq4_q: "Do I need the IDE plugin to use it?", faq4_a: "No, the core engine is a standalone Go binary that operates purely via standard Git hooks. It works universally.", cta_title: "Start commiting faster.", cta_desc: "Install the CLI via script or grab an IDE plugin."
        },
        ja: {
            nav_features: "機能", hero_badge: "v1.0.1 リリース", hero_title: "先にコミットし、<br>後で<span>考える。</span>", hero_desc: "AIを待つ必要はありません。Git AIがバックグラウンドでコミットメッセージを作成している間も、コーディングを続けましょう。<strong>ゼロフリクションの非同期ポリッシャー。</strong>",
            btn_vscode: "VS Code拡張機能を取得", btn_idea: "JetBrainsプラグインを取得", hero_cli_link: "ターミナル派ですか？ CLIエンジンを取得 →",
            feat1_title: "ゼロ遅延", feat1_desc: "コミットは12ミリ秒で完了します。LLMは孤児化したバックグラウンドデーモンですべてを処理します。",
            feat2_title: "リアルタイム・ステータス", feat2_desc: "<code>[⏳]</code>プレフィックスは、同期の問題を防ぐために<code>git log</code>でネイティブに表示されるロックメカニズムとして機能します。",
            feat3_title: "キュー・プッシュ", feat3_desc: "ポリッシュ中に<code>git push</code>を押しましたか？ネットワークペイロードをキューに入れ、amendが完了した後に実行します。",
            feat4_title: "IDEネイティブ", feat4_desc: "ターミナルの切り替えはもう必要ありません。VS CodeとIntelliJ IDEA拡張機能を通じてデーモンフックをネイティブに監視します。",
            footer_subtitle: "非同期コミットポリッシャー", footer_plugins: "プラグイン", footer_resources: "リソース", footer_repo: "GitHubリポジトリ", footer_releases: "リリース",
            term_input: 'git commit -m "バグ修正"', term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] バグ修正</span>', term_line2: '<span class="t-wait">✨ git-ai:</span> バックグラウンドでの推敲を開始しました (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> コミットメッセージの推敲が完了しました', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Install Now", btn_github: "View Source", prob_title: "The AI Waiting Problem", prob_desc: "Synchronous CLI tools lock your terminal for 10-30 seconds while the LLM generates a commit message. That's enough friction to break your flow and lose context.", sec_arch: "Architecture", flow_title: "How the Daemon Works", flow_step1_title: "12ms Hook", flow_step1_desc: "Run git commit -m \"fix\". The intercepting post-commit hook finishes instantly.", flow_step2_title: "Daemon Detaches", flow_step2_desc: "A background process orphans itself to the OS, completely freeing your terminal.", flow_step3_title: "Ghost Polishing", flow_step3_desc: "The script fetches the diff, streams to the LLM, and runs git commit --amend silently.", flow_step4_title: "Auto-Queue", flow_step4_desc: "If you run git push early, the payload queues until the amend finishes.", eco_title: "Deep IDE Integration", eco_desc: "Don't want to use the terminal? Native VS Code and IntelliJ IDEA plugins monitor the state file to provide real-time background status, streaming logs, and controls directly where you write code.", sec_support: "Support", faq_title: "Frequently Asked Questions", faq1_q: "Will it mess up my git history?", faq1_a: "No. Git AI uses a strictly matched lock prefix [⏳]. It only ever amends the latest exact commit it was initiated on.", faq2_q: "What if I push while it's still generating?", faq2_a: "By default, the pre-push hook intercepts the network call, puts it in an execution queue, and releases the terminal. The actual network push runs automatically in the background.", faq3_q: "Which LLMs are supported?", faq3_a: "Git AI natively supports the OpenAI, Anthropic, Gemini, and DeepSeek APIs. It also supports locally hosted models like Ollama.", faq4_q: "Do I need the IDE plugin to use it?", faq4_a: "No, the core engine is a standalone Go binary that operates purely via standard Git hooks. It works universally.", cta_title: "Start commiting faster.", cta_desc: "Install the CLI via script or grab an IDE plugin."
        },
        ko: {
            nav_features: "기능", hero_badge: "v1.0.1 출시됨", hero_title: "먼저 커밋하고,<br>나중에 <span>생각하세요.</span>", hero_desc: "AI를 기다리지 마세요. Git AI가 백그라운드에서 커밋 메시지를 작성하는 동안 계속 코딩하세요. <strong>마찰 없는 비동기 폴리셔.</strong>",
            btn_vscode: "VS Code 확장 프로그램 다운로드", btn_idea: "JetBrains 플러그인 다운로드", hero_cli_link: "터미널 매니아신가요? CLI 엔진 받기 →",
            feat1_title: "제로 지연 시간", feat1_desc: "커밋은 12ms 내에 완료됩니다. LLM은 분리된 백그라운드 데몬에서 모든 것을 처리합니다.",
            feat2_title: "실시간 상태", feat2_desc: "<code>[⏳]</code> 접두사는 동기화 문제를 방지하기 위해 <code>git log</code>에 기본적으로 표시되는 잠금 메커니즘 역할을 합니다.",
            feat3_title: "대기열 푸시", feat3_desc: "폴리싱 중에 <code>git push</code>를 누르셨나요? 네트워크 페이로드를 대기열에 넣고 수정이 완료된 후 실행합니다.",
            feat4_title: "IDE 네이티브", feat4_desc: "더 이상 터미널을 전환할 필요가 없습니다. VS Code 및 IntelliJ IDEA 확장을 통해 데몬 훅을 기본적으로 모니터링하세요.",
            footer_subtitle: "비동기 커밋 폴리셔.", footer_plugins: "플러그인", footer_resources: "리소스", footer_repo: "GitHub 저장소", footer_releases: "출시",
            term_input: 'git commit -m "버그 수정"', term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] 버그 수정</span>', term_line2: '<span class="t-wait">✨ git-ai:</span> 백그라운드 폴리싱 시작됨 (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> 커밋 메시지 윤색 완료', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Install Now", btn_github: "View Source", prob_title: "The AI Waiting Problem", prob_desc: "Synchronous CLI tools lock your terminal for 10-30 seconds while the LLM generates a commit message. That's enough friction to break your flow and lose context.", sec_arch: "Architecture", flow_title: "How the Daemon Works", flow_step1_title: "12ms Hook", flow_step1_desc: "Run git commit -m \"fix\". The intercepting post-commit hook finishes instantly.", flow_step2_title: "Daemon Detaches", flow_step2_desc: "A background process orphans itself to the OS, completely freeing your terminal.", flow_step3_title: "Ghost Polishing", flow_step3_desc: "The script fetches the diff, streams to the LLM, and runs git commit --amend silently.", flow_step4_title: "Auto-Queue", flow_step4_desc: "If you run git push early, the payload queues until the amend finishes.", eco_title: "Deep IDE Integration", eco_desc: "Don't want to use the terminal? Native VS Code and IntelliJ IDEA plugins monitor the state file to provide real-time background status, streaming logs, and controls directly where you write code.", sec_support: "Support", faq_title: "Frequently Asked Questions", faq1_q: "Will it mess up my git history?", faq1_a: "No. Git AI uses a strictly matched lock prefix [⏳]. It only ever amends the latest exact commit it was initiated on.", faq2_q: "What if I push while it's still generating?", faq2_a: "By default, the pre-push hook intercepts the network call, puts it in an execution queue, and releases the terminal. The actual network push runs automatically in the background.", faq3_q: "Which LLMs are supported?", faq3_a: "Git AI natively supports the OpenAI, Anthropic, Gemini, and DeepSeek APIs. It also supports locally hosted models like Ollama.", faq4_q: "Do I need the IDE plugin to use it?", faq4_a: "No, the core engine is a standalone Go binary that operates purely via standard Git hooks. It works universally.", cta_title: "Start commiting faster.", cta_desc: "Install the CLI via script or grab an IDE plugin."
        },
        pt: {
            nav_features: "Ressursos", hero_badge: "v1.0.1 Lançado", hero_title: "Faça commit primeiro,<br>pense <span>depois.</span>", hero_desc: "Não espere pela IA. Continue codando enquanto o Git AI escreve suas mensagens de commit em segundo plano. <strong>O polidor assíncrono sem atrito.</strong>",
            btn_vscode: "Obter Extensão VS Code", btn_idea: "Obter Plugin JetBrains", hero_cli_link: "Maximalista de terminal? Obtenha a engine CLI →",
            feat1_title: "Zero Latência", feat1_desc: "Seu commit é concluído em 12ms. O LLM processa tudo num daemon órfão em segundo plano.",
            feat2_title: "Status em Tempo Real", feat2_desc: "O prefixo <code>[⏳]</code> age como um mecanismo de travamento visível nativamente no <code>git log</code> para prevenir problemas de sincronização.",
            feat3_title: "Push em Fila", feat3_desc: "Deu <code>git push</code> durante o polimento? Nós enfileiramos o payload da rede e o executamos depois que a emenda termina.",
            feat4_title: "Nativo da IDE", feat4_desc: "Chega de alternar terminal. Monitore os hooks do daemon nativamente através das extensões do VS Code e IntelliJ IDEA.",
            footer_subtitle: "Polidor Assíncrono de Commit.", footer_plugins: "Plugins", footer_resources: "Recursos", footer_repo: "Repositórios GitHub", footer_releases: "Lançamentos",
            term_input: 'git commit -m "arrumar bug"', term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] arrumar bug</span>', term_line2: '<span class="t-wait">✨ git-ai:</span> Polimento em segundo plano iniciado (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Mensagem de commit refinada', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Install Now", btn_github: "View Source", prob_title: "The AI Waiting Problem", prob_desc: "Synchronous CLI tools lock your terminal for 10-30 seconds while the LLM generates a commit message. That's enough friction to break your flow and lose context.", sec_arch: "Architecture", flow_title: "How the Daemon Works", flow_step1_title: "12ms Hook", flow_step1_desc: "Run git commit -m \"fix\". The intercepting post-commit hook finishes instantly.", flow_step2_title: "Daemon Detaches", flow_step2_desc: "A background process orphans itself to the OS, completely freeing your terminal.", flow_step3_title: "Ghost Polishing", flow_step3_desc: "The script fetches the diff, streams to the LLM, and runs git commit --amend silently.", flow_step4_title: "Auto-Queue", flow_step4_desc: "If you run git push early, the payload queues until the amend finishes.", eco_title: "Deep IDE Integration", eco_desc: "Don't want to use the terminal? Native VS Code and IntelliJ IDEA plugins monitor the state file to provide real-time background status, streaming logs, and controls directly where you write code.", sec_support: "Support", faq_title: "Frequently Asked Questions", faq1_q: "Will it mess up my git history?", faq1_a: "No. Git AI uses a strictly matched lock prefix [⏳]. It only ever amends the latest exact commit it was initiated on.", faq2_q: "What if I push while it's still generating?", faq2_a: "By default, the pre-push hook intercepts the network call, puts it in an execution queue, and releases the terminal. The actual network push runs automatically in the background.", faq3_q: "Which LLMs are supported?", faq3_a: "Git AI natively supports the OpenAI, Anthropic, Gemini, and DeepSeek APIs. It also supports locally hosted models like Ollama.", faq4_q: "Do I need the IDE plugin to use it?", faq4_a: "No, the core engine is a standalone Go binary that operates purely via standard Git hooks. It works universally.", cta_title: "Start commiting faster.", cta_desc: "Install the CLI via script or grab an IDE plugin."
        },
        ru: {
            nav_features: "Функции", hero_badge: "Релиз v1.0.1", hero_title: "Сначала коммить,<br>думай <span>потом.</span>", hero_desc: "Не ждите ИИ. Продолжайте кодить, пока Git AI пишет сообщения для коммитов в фоновом режиме. <strong>Асинхронный полировщик без трения.</strong>",
            btn_vscode: "Скачать для VS Code", btn_idea: "Скачать для JetBrains", hero_cli_link: "Максималист терминала? Скачайте CLI →",
            feat1_title: "Нулевая задержка", feat1_desc: "Ваш коммит занимает 12 мс. LLM обрабатывает всё в изолированном фоновом демоне.",
            feat2_title: "Статус в реальном времени", feat2_desc: "Префикс <code>[⏳]</code> действует как механизм блокировки, видимый в <code>git log</code> для предотвращения конфликтов.",
            feat3_title: "Очередь Push", feat3_desc: "Нажали <code>git push</code> во время полировки? Мы добавим сетевой запрос в очередь и выполним его после завершения amend.",
            feat4_title: "Нативная интеграция IDE", feat4_desc: "Больше никаких переключений в терминал. Отслеживайте работу демона через расширения VS Code и IntelliJ IDEA.",
            footer_subtitle: "Асинхронный полировщик коммитов.", footer_plugins: "Плагины", footer_resources: "Ресурсы", footer_repo: "Репозитории GitHub", footer_releases: "Релизы",
            term_input: 'git commit -m "пофиксить баг"', term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] пофиксить баг</span>', term_line2: '<span class="t-wait">✨ git-ai:</span> Фоновая полировка начата (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Сообщение коммита отполировано', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Install Now", btn_github: "View Source", prob_title: "The AI Waiting Problem", prob_desc: "Synchronous CLI tools lock your terminal for 10-30 seconds while the LLM generates a commit message. That's enough friction to break your flow and lose context.", sec_arch: "Architecture", flow_title: "How the Daemon Works", flow_step1_title: "12ms Hook", flow_step1_desc: "Run git commit -m \"fix\". The intercepting post-commit hook finishes instantly.", flow_step2_title: "Daemon Detaches", flow_step2_desc: "A background process orphans itself to the OS, completely freeing your terminal.", flow_step3_title: "Ghost Polishing", flow_step3_desc: "The script fetches the diff, streams to the LLM, and runs git commit --amend silently.", flow_step4_title: "Auto-Queue", flow_step4_desc: "If you run git push early, the payload queues until the amend finishes.", eco_title: "Deep IDE Integration", eco_desc: "Don't want to use the terminal? Native VS Code and IntelliJ IDEA plugins monitor the state file to provide real-time background status, streaming logs, and controls directly where you write code.", sec_support: "Support", faq_title: "Frequently Asked Questions", faq1_q: "Will it mess up my git history?", faq1_a: "No. Git AI uses a strictly matched lock prefix [⏳]. It only ever amends the latest exact commit it was initiated on.", faq2_q: "What if I push while it's still generating?", faq2_a: "By default, the pre-push hook intercepts the network call, puts it in an execution queue, and releases the terminal. The actual network push runs automatically in the background.", faq3_q: "Which LLMs are supported?", faq3_a: "Git AI natively supports the OpenAI, Anthropic, Gemini, and DeepSeek APIs. It also supports locally hosted models like Ollama.", faq4_q: "Do I need the IDE plugin to use it?", faq4_a: "No, the core engine is a standalone Go binary that operates purely via standard Git hooks. It works universally.", cta_title: "Start commiting faster.", cta_desc: "Install the CLI via script or grab an IDE plugin."
        },
        ar: {
            nav_features: "الميزات", hero_badge: "تم إصدار v1.0.1", hero_title: "قم بالـ Commit أولاً،<br>وفكر <span>لاحقاً.</span>", hero_desc: "لا تنتظر الذكاء الاصطناعي. استمر في البرمجة بينما يكتب Git AI رسائل الإيداع الخاصة بك في الخلفية. <strong>المُحسّن المتزامن الخالي من الاحتكاك.</strong>",
            btn_vscode: "احصل على إضافة VS Code", btn_idea: "احصل على إضافة JetBrains", hero_cli_link: "هل تفضل الـ Terminal فقط؟ احصل على محرك CLI →",
            feat1_title: "بدون تأخير", feat1_desc: "يستغرق الإيداع الخاص بك 12 ميلي ثانية. تقوم نماذج LLM بمعالجة كل شيء في خادم خلفية منفصل.",
            feat2_title: "حالة فورية", feat2_desc: "تعمل البادئة <code>[⏳]</code> كآلية قفل مرئية بشكل أصلي في <code>git log</code> لمنع مشاكل المزامنة.",
            feat3_title: "طابور الـ Push", feat3_desc: "هل تضغط على <code>git push</code> أثناء التحسين؟ نضع حمولة الشبكة في انتظار وننفذها بعد انتهاء التعديل.",
            feat4_title: "تكامل مع IDE", feat4_desc: "لا مزيد من التبديل بين النوافذ. راقب أوامر الخادم بشكل أصلي من خلال إضافات VS Code و IntelliJ IDEA.",
            footer_subtitle: "مُحسّن رسائل الإيداع غير المتزامن.", footer_plugins: "الإضافات", footer_resources: "الموارد", footer_repo: "مستودعات GitHub", footer_releases: "الإصدارات",
            term_input: 'git commit -m "إصلاح خلل"', term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] إصلاح خلل</span>', term_line2: '<span class="t-wait">✨ git-ai:</span> بدأ التحسين في الخلفية (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> تم تحسين رسالة الإيداع', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Install Now", btn_github: "View Source", prob_title: "The AI Waiting Problem", prob_desc: "Synchronous CLI tools lock your terminal for 10-30 seconds while the LLM generates a commit message. That's enough friction to break your flow and lose context.", sec_arch: "Architecture", flow_title: "How the Daemon Works", flow_step1_title: "12ms Hook", flow_step1_desc: "Run git commit -m \"fix\". The intercepting post-commit hook finishes instantly.", flow_step2_title: "Daemon Detaches", flow_step2_desc: "A background process orphans itself to the OS, completely freeing your terminal.", flow_step3_title: "Ghost Polishing", flow_step3_desc: "The script fetches the diff, streams to the LLM, and runs git commit --amend silently.", flow_step4_title: "Auto-Queue", flow_step4_desc: "If you run git push early, the payload queues until the amend finishes.", eco_title: "Deep IDE Integration", eco_desc: "Don't want to use the terminal? Native VS Code and IntelliJ IDEA plugins monitor the state file to provide real-time background status, streaming logs, and controls directly where you write code.", sec_support: "Support", faq_title: "Frequently Asked Questions", faq1_q: "Will it mess up my git history?", faq1_a: "No. Git AI uses a strictly matched lock prefix [⏳]. It only ever amends the latest exact commit it was initiated on.", faq2_q: "What if I push while it's still generating?", faq2_a: "By default, the pre-push hook intercepts the network call, puts it in an execution queue, and releases the terminal. The actual network push runs automatically in the background.", faq3_q: "Which LLMs are supported?", faq3_a: "Git AI natively supports the OpenAI, Anthropic, Gemini, and DeepSeek APIs. It also supports locally hosted models like Ollama.", faq4_q: "Do I need the IDE plugin to use it?", faq4_a: "No, the core engine is a standalone Go binary that operates purely via standard Git hooks. It works universally.", cta_title: "Start commiting faster.", cta_desc: "Install the CLI via script or grab an IDE plugin."
        },
        vi: {
            nav_features: "Tính năng", hero_badge: "Đã phát hành v1.0.1", hero_title: "Commit trước,<br>nghĩ <span>sau.</span>", hero_desc: "Đừng chờ đợi AI. Cứ tiếp tục code trong khi Git AI viết thông điệp commit cho bạn ở chế độ nền. <strong>Công cụ trau chuốt bất đồng bộ không độ trễ.</strong>",
            btn_vscode: "Tải Tiện ích VS Code", btn_idea: "Tải Plugin JetBrains", hero_cli_link: "Fan cuồng của Terminal? Tải ngay CLI engine →",
            feat1_title: "Độ Trễ Bằng 0", feat1_desc: "Commit của bạn hoàn tất trong 12 mili-giây. LLM xử lý mọi việc bằng một daemon độc lập chạy ngầm.",
            feat2_title: "Trạng thái Thời gian thực", feat2_desc: "Tiền tố <code>[⏳]</code> đóng vai trò như một cơ chế khóa hiển thị tự nhiên trong <code>git log</code> để ngăn lỗi đồng bộ.",
            feat3_title: "Hàng đợi Push", feat3_desc: "Bạn gõ <code>git push</code> trong lúc đang AI đang viết? Chúng tôi đưa payload vào hàng đợi và thực thi sau khi lệnh amend kết thúc.",
            feat4_title: "Tích hợp IDE Tự nhiên", feat4_desc: "Không cần chuyển đổi sang terminal nữa. Giám sát các daemon hook trực tiếp thông qua tiện ích mở rộng của VS Code và IntelliJ IDEA.",
            footer_subtitle: "Công cụ trau chuốt commit bất đồng bộ.", footer_plugins: "Tiện ích mở rộng", footer_resources: "Tài nguyên", footer_repo: "Kho lưu trữ GitHub", footer_releases: "Các phiên bản",
            term_input: 'git commit -m "sửa vài lỗi"', term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] sửa vài lỗi</span>', term_line2: '<span class="t-wait">✨ git-ai:</span> Quá trình trau chuốt chạy ngầm bắt đầu (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Đã trau chuốt thông điệp commit', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Install Now", btn_github: "View Source", prob_title: "The AI Waiting Problem", prob_desc: "Synchronous CLI tools lock your terminal for 10-30 seconds while the LLM generates a commit message. That's enough friction to break your flow and lose context.", sec_arch: "Architecture", flow_title: "How the Daemon Works", flow_step1_title: "12ms Hook", flow_step1_desc: "Run git commit -m \"fix\". The intercepting post-commit hook finishes instantly.", flow_step2_title: "Daemon Detaches", flow_step2_desc: "A background process orphans itself to the OS, completely freeing your terminal.", flow_step3_title: "Ghost Polishing", flow_step3_desc: "The script fetches the diff, streams to the LLM, and runs git commit --amend silently.", flow_step4_title: "Auto-Queue", flow_step4_desc: "If you run git push early, the payload queues until the amend finishes.", eco_title: "Deep IDE Integration", eco_desc: "Don't want to use the terminal? Native VS Code and IntelliJ IDEA plugins monitor the state file to provide real-time background status, streaming logs, and controls directly where you write code.", sec_support: "Support", faq_title: "Frequently Asked Questions", faq1_q: "Will it mess up my git history?", faq1_a: "No. Git AI uses a strictly matched lock prefix [⏳]. It only ever amends the latest exact commit it was initiated on.", faq2_q: "What if I push while it's still generating?", faq2_a: "By default, the pre-push hook intercepts the network call, puts it in an execution queue, and releases the terminal. The actual network push runs automatically in the background.", faq3_q: "Which LLMs are supported?", faq3_a: "Git AI natively supports the OpenAI, Anthropic, Gemini, and DeepSeek APIs. It also supports locally hosted models like Ollama.", faq4_q: "Do I need the IDE plugin to use it?", faq4_a: "No, the core engine is a standalone Go binary that operates purely via standard Git hooks. It works universally.", cta_title: "Start commiting faster.", cta_desc: "Install the CLI via script or grab an IDE plugin."
        },
        th: {
            nav_features: "คุณลักษณะ", hero_badge: "ปล่อยเวอร์ชัน v1.0.1", hero_title: "Commit ก่อน,<br>คิดที <span>หลัง.</span>", hero_desc: "ไม่ต้องรอ AI. โค้ดต่อไปในขณะที่ Git AI เขียนข้อความคอมมิตให้คุณในเบื้องหลัง <strong>ตัวช่วยเรียบเรียงแบบอะซิงโครนัสที่ไร้รอยต่อ.</strong>",
            btn_vscode: "รับ VS Code Extension", btn_idea: "รับ JetBrains Plugin", hero_cli_link: "ชอบใช้ Terminal อย่างเดียว? รับ CLI engine →",
            feat1_title: "ไร้ความหน่วง", feat1_desc: "คอมมิตของคุณเสร็จสิ้นโใน 12ms. LLM ประมวลผลทุกอย่างใน daemon เบื้องหลังที่แยกตัวออกไป.",
            feat2_title: "สถานะเรียลไทม์", feat2_desc: "คำนำหน้า <code>[⏳]</code> ทำหน้าที่เป็นตัวล็อกกลไกที่มองเห็นได้ใน <code>git log</code> เพื่อป้องกันปัญหาการซิงค์ข้อมูล.",
            feat3_title: "จัดคิวการพุช", feat3_desc: "พิมพ์ <code>git push</code> ตอนกำลังทำงาน? เราจะจัดคิวเครือข่ายและพุชเมื่อการแก้ไขเสร็จสิ้น.",
            feat4_title: "รองรับ IDE", feat4_desc: "ไม่ต้องสลับหน้าจอ Terminal อีกต่อไป ตรวจสอบสถานะและ hook ของ daemon ผ่าน VS Code และ IntelliJ IDEA ได้โดยตรง.",
            footer_subtitle: "เครื่องมือเรียบเรียงข้อความคอมมิต.", footer_plugins: "ปลั๊กอิน", footer_resources: "ทรัพยากร", footer_repo: "คลังเก็บบน GitHub", footer_releases: "รุ่นที่ปล่อย",
            term_input: 'git commit -m "แก้งานชั่วคราว"', term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] แก้งานชั่วคราว</span>', term_line2: '<span class="t-wait">✨ git-ai:</span> เริ่มกระบวนการขัดเกลาในเบื้องหลัง (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> ขัดเกลาข้อความ commit แล้ว', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Install Now", btn_github: "View Source", prob_title: "The AI Waiting Problem", prob_desc: "Synchronous CLI tools lock your terminal for 10-30 seconds while the LLM generates a commit message. That's enough friction to break your flow and lose context.", sec_arch: "Architecture", flow_title: "How the Daemon Works", flow_step1_title: "12ms Hook", flow_step1_desc: "Run git commit -m \"fix\". The intercepting post-commit hook finishes instantly.", flow_step2_title: "Daemon Detaches", flow_step2_desc: "A background process orphans itself to the OS, completely freeing your terminal.", flow_step3_title: "Ghost Polishing", flow_step3_desc: "The script fetches the diff, streams to the LLM, and runs git commit --amend silently.", flow_step4_title: "Auto-Queue", flow_step4_desc: "If you run git push early, the payload queues until the amend finishes.", eco_title: "Deep IDE Integration", eco_desc: "Don't want to use the terminal? Native VS Code and IntelliJ IDEA plugins monitor the state file to provide real-time background status, streaming logs, and controls directly where you write code.", sec_support: "Support", faq_title: "Frequently Asked Questions", faq1_q: "Will it mess up my git history?", faq1_a: "No. Git AI uses a strictly matched lock prefix [⏳]. It only ever amends the latest exact commit it was initiated on.", faq2_q: "What if I push while it's still generating?", faq2_a: "By default, the pre-push hook intercepts the network call, puts it in an execution queue, and releases the terminal. The actual network push runs automatically in the background.", faq3_q: "Which LLMs are supported?", faq3_a: "Git AI natively supports the OpenAI, Anthropic, Gemini, and DeepSeek APIs. It also supports locally hosted models like Ollama.", faq4_q: "Do I need the IDE plugin to use it?", faq4_a: "No, the core engine is a standalone Go binary that operates purely via standard Git hooks. It works universally.", cta_title: "Start commiting faster.", cta_desc: "Install the CLI via script or grab an IDE plugin."
        },
        id: {
            nav_features: "Fitur", hero_badge: "v1.0.1 Dirilis", hero_title: "Commit dulu,<br>pikirkan <span>nanti.</span>", hero_desc: "Tidak perlu menunggu AI. Teruslah ngoding sementara Git AI menulis pesan commit Anda di latar belakang. <strong>Pemoles asinkron tanpa hambatan.</strong>",
            btn_vscode: "Dapatkan Ekstensi VS Code", btn_idea: "Dapatkan Plugin JetBrains", hero_cli_link: "Pengguna Terminal? Dapatkan CLI engine →",
            feat1_title: "Nol Latensi", feat1_desc: "Commit Anda selesai dalam 12ms. LLM memproses semuanya lewat daemon latar belakang terpisah.",
            feat2_title: "Status Waktu-Nyata", feat2_desc: "Prefiks <code>[⏳]</code> bertindak sebagai mekanisme penguncian yang terlihat secara native di <code>git log</code> untuk mencegah masalah sinkronisasi.",
            feat3_title: "Push Terjadwal", feat3_desc: "Mengetik <code>git push</code> saat sedang dipoles? Kami memasukkan jaringan ke antrean dan menjalankannya setelah amends selesai.",
            feat4_title: "Native pada IDE", feat4_desc: "Tak perlu lagi bolak-balik ke terminal. Pantau hooks dari daemon secara native lewat ekstensi VS Code dan IntelliJ IDEA.",
            footer_subtitle: "Pemoles Commit Asinkron.", footer_plugins: "Plugin", footer_resources: "Resources", footer_repo: "Repositori GitHub", footer_releases: "Rilis",
            term_input: 'git commit -m "perbaiki sesuatu"', term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] perbaiki sesuatu</span>', term_line2: '<span class="t-wait">✨ git-ai:</span> Pemolesan latar belakang sedang berjalan (PID 28312)', term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>', term_line4: '<span class="t-success">✓ git-ai:</span> Pesan commit berhasil dipoles', term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        ,
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Install Now", btn_github: "View Source", prob_title: "The AI Waiting Problem", prob_desc: "Synchronous CLI tools lock your terminal for 10-30 seconds while the LLM generates a commit message. That's enough friction to break your flow and lose context.", sec_arch: "Architecture", flow_title: "How the Daemon Works", flow_step1_title: "12ms Hook", flow_step1_desc: "Run git commit -m \"fix\". The intercepting post-commit hook finishes instantly.", flow_step2_title: "Daemon Detaches", flow_step2_desc: "A background process orphans itself to the OS, completely freeing your terminal.", flow_step3_title: "Ghost Polishing", flow_step3_desc: "The script fetches the diff, streams to the LLM, and runs git commit --amend silently.", flow_step4_title: "Auto-Queue", flow_step4_desc: "If you run git push early, the payload queues until the amend finishes.", eco_title: "Deep IDE Integration", eco_desc: "Don't want to use the terminal? Native VS Code and IntelliJ IDEA plugins monitor the state file to provide real-time background status, streaming logs, and controls directly where you write code.", sec_support: "Support", faq_title: "Frequently Asked Questions", faq1_q: "Will it mess up my git history?", faq1_a: "No. Git AI uses a strictly matched lock prefix [⏳]. It only ever amends the latest exact commit it was initiated on.", faq2_q: "What if I push while it's still generating?", faq2_a: "By default, the pre-push hook intercepts the network call, puts it in an execution queue, and releases the terminal. The actual network push runs automatically in the background.", faq3_q: "Which LLMs are supported?", faq3_a: "Git AI natively supports the OpenAI, Anthropic, Gemini, and DeepSeek APIs. It also supports locally hosted models like Ollama.", faq4_q: "Do I need the IDE plugin to use it?", faq4_a: "No, the core engine is a standalone Go binary that operates purely via standard Git hooks. It works universally.", cta_title: "Start commiting faster.", cta_desc: "Install the CLI via script or grab an IDE plugin."
        }
    };

    // Detect initial language: localStorage > browser navigator > default 'en'
    let currentLang = localStorage.getItem('gitai_lang');
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
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[currentLang] && translations[currentLang][key]) {
                el.innerHTML = translations[currentLang][key];
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
        
        termContent.style.transition = 'opacity 0.2s ease-in-out';

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                // When a step enters the middle 40% of the viewport
                if (entry.isIntersecting) {
                    const stepNum = parseInt(entry.target.getAttribute('data-step'));
                    
                    steps.forEach(s => s.classList.remove('is-active'));
                    entry.target.classList.add('is-active');
                    
                    if (stepNum !== activeStep) {
                        activeStep = stepNum;
                        
                        // Crossfade terminal content
                        termContent.style.opacity = '0';
                        setTimeout(() => {
                            termContent.innerHTML = getStepContent(stepNum);
                            termContent.style.opacity = '1';
                        }, 200);
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
});
