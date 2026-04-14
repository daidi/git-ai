document.addEventListener('DOMContentLoaded', () => {

    const translations = {
        en: {
            nav_features: "Features", hero_badge: "v1.0.1 Released", hero_title: "Write code.<br>Not <span>commits.</span>", hero_desc: "Don't wait for AI. Keep coding while Git AI writes your commit messages in the background. <strong>The zero-friction async polisher.</strong>",
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
            nav_features: "核心特性", hero_badge: "v1.0.1 最新发布", hero_title: "只写代码，<br>不写<span>提交。</span>", hero_desc: "告别漫长的同步等待。你只管写代码，让 Git AI 在后台默默为你写好提交信息。<strong>零摩擦的异步润色体验。</strong>",
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
            nav_features: "核心特性", hero_badge: "v1.0.1 最新發布", hero_title: "只寫程式碼，<br>不寫<span>提交。</span>", hero_desc: "告別漫長的同步等待。你只管寫程式，讓 Git AI 在背景默默為你寫好提交訊息。<strong>零摩擦的非同步潤飾體驗。</strong>",
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
            nav_problem: "Problème", nav_faq: "FAQ", btn_install: "Installer maintenant", btn_github: "Voir le code source", prob_title: "Le problème d'attente de l'IA", prob_desc: "Les outils CLI synchrones bloquent votre terminal 10 à 30 secondes pendant que le LLM génère un message de commit. C'est suffisant pour briser votre flow et perdre le contexte.", sec_arch: "Architecture", flow_title: "Comment fonctionne le démon", flow_step1_title: "Hook 12ms", flow_step1_desc: "Lancez git commit -m \"fix\". Le hook post-commit intercepteur se termine instantanément.", flow_step2_title: "Démon détaché", flow_step2_desc: "Un processus en arrière-plan s'orphanise vers l'OS, libérant complètement votre terminal.", flow_step3_title: "Polissage fantôme", flow_step3_desc: "Le script récupère le diff, envoie en streaming au LLM et exécute git commit --amend silencieusement.", flow_step4_title: "File automatique", flow_step4_desc: "Si vous lancez git push tôt, le payload est mis en file jusqu'à la fin du amend.", eco_title: "Intégration IDE native", eco_desc: "Vous ne voulez pas utiliser le terminal ? Les plugins natifs VS Code et IntelliJ IDEA surveillent le fichier d'état pour fournir un statut en temps réel, des journaux en streaming et des contrôles directement là où vous codez.", sec_support: "Support", faq_title: "Questions fréquemment posées", faq1_q: "Cela va-t-il perturber mon historique git ?", faq1_a: "Non. Git AI utilise un préfixe de verrou strictement correspondant [⏳]. Il ne modifie que le dernier commit exact sur lequel il a été initié.", faq2_q: "Que se passe-t-il si je push pendant la génération ?", faq2_a: "Par défaut, le hook pre-push intercepte l'appel réseau, le place dans une file d'exécution et libère le terminal. Le push réseau réel s'exécute automatiquement en arrière-plan.", faq3_q: "Quels LLMs sont supportés ?", faq3_a: "Git AI supporte nativement les APIs OpenAI, Anthropic, Gemini et DeepSeek. Il supporte également les modèles hébergés localement comme Ollama.", faq4_q: "Ai-je besoin du plugin IDE pour l'utiliser ?", faq4_a: "Non, le moteur principal est un binaire Go autonome qui fonctionne uniquement via les hooks Git standard. Il fonctionne universellement.", cta_title: "Commencez à committer plus vite.", cta_desc: "Installez le CLI via script ou obtenez un plugin IDE."
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
            nav_problem: "Problema", nav_faq: "FAQ", btn_install: "Installa ora", btn_github: "Visualizza sorgente", prob_title: "Il problema dell'attesa dell'IA", prob_desc: "Gli strumenti CLI sincroni bloccano il terminale per 10-30 secondi mentre l'LLM genera un messaggio di commit. È sufficiente a interrompere il tuo flusso e perdere il contesto.", sec_arch: "Architettura", flow_title: "Come funziona il daemon", flow_step1_title: "Hook 12ms", flow_step1_desc: "Esegui git commit -m \"fix\". Il hook post-commit intercettante termina istantaneamente.", flow_step2_title: "Daemon distaccato", flow_step2_desc: "Un processo in background si orfanizza verso l'OS, liberando completamente il terminale.", flow_step3_title: "Lucidatura fantasma", flow_step3_desc: "Lo script recupera il diff, trasmette all'LLM e esegue git commit --amend silenziosamente.", flow_step4_title: "Coda automatica", flow_step4_desc: "Se esegui git push in anticipo, il payload viene messo in coda fino al completamento dell'amend.", eco_title: "Integrazione IDE nativa", eco_desc: "Non vuoi usare il terminale? I plugin nativi di VS Code e IntelliJ IDEA monitorano il file di stato per fornire stato in tempo reale, log in streaming e controlli direttamente dove scrivi il codice.", sec_support: "Supporto", faq_title: "Domande frequenti", faq1_q: "Rovinerà la mia cronologia git?", faq1_a: "No. Git AI usa un prefisso di blocco strettamente abbinato [⏳]. Modifica solo l'ultimo commit esatto su cui è stato avviato.", faq2_q: "Cosa succede se faccio push mentre sta ancora generando?", faq2_a: "Per impostazione predefinita, il hook pre-push intercetta la chiamata di rete, la mette in una coda di esecuzione e libera il terminale. Il push di rete effettivo viene eseguito automaticamente in background.", faq3_q: "Quali LLM sono supportati?", faq3_a: "Git AI supporta nativamente le API OpenAI, Anthropic, Gemini e DeepSeek. Supporta anche modelli ospitati localmente come Ollama.", faq4_q: "Ho bisogno del plugin IDE per usarlo?", faq4_a: "No, il motore principale è un binario Go autonomo che opera esclusivamente tramite hook Git standard. Funziona universalmente.", cta_title: "Inizia a fare commit più velocemente.", cta_desc: "Installa il CLI tramite script o scarica un plugin IDE."
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
            nav_problem: "Problem", nav_faq: "FAQ", btn_install: "Jetzt installieren", btn_github: "Quellcode ansehen", prob_title: "Das KI-Warteproblem", prob_desc: "Synchrone CLI-Tools sperren dein Terminal für 10-30 Sekunden, während das LLM eine Commit-Nachricht generiert. Das reicht, um deinen Flow zu unterbrechen und den Kontext zu verlieren.", sec_arch: "Architektur", flow_title: "So funktioniert der Daemon", flow_step1_title: "12ms Hook", flow_step1_desc: "Führe git commit -m \"fix\" aus. Der abfangende Post-Commit-Hook wird sofort beendet.", flow_step2_title: "Daemon trennt sich", flow_step2_desc: "Ein Hintergrundprozess verwaist sich im OS und gibt dein Terminal vollständig frei.", flow_step3_title: "Geistpolieren", flow_step3_desc: "Das Skript holt den Diff, streamt zum LLM und führt git commit --amend lautlos aus.", flow_step4_title: "Auto-Warteschlange", flow_step4_desc: "Wenn du git push frühzeitig ausführst, wird der Payload eingereiht, bis das Amend abgeschlossen ist.", eco_title: "Tiefe IDE-Integration", eco_desc: "Kein Terminal nötig? Native VS Code- und IntelliJ IDEA-Plugins überwachen die State-Datei und liefern Echtzeit-Status, Streaming-Logs und Steuerungen genau dort, wo du codest.", sec_support: "Support", faq_title: "Häufig gestellte Fragen", faq1_q: "Wird es meine Git-Historie durcheinanderbringen?", faq1_a: "Nein. Git AI verwendet ein streng abgeglichenes Sperr-Präfix [⏳]. Es ändert immer nur den letzten genauen Commit, auf dem es initiiert wurde.", faq2_q: "Was passiert, wenn ich pushe, während es noch generiert?", faq2_a: "Standardmäßig fängt der Pre-Push-Hook den Netzwerkaufruf ab, legt ihn in eine Ausführungswarteschlange und gibt das Terminal frei. Der eigentliche Netzwerk-Push wird automatisch im Hintergrund ausgeführt.", faq3_q: "Welche LLMs werden unterstützt?", faq3_a: "Git AI unterstützt nativ die OpenAI-, Anthropic-, Gemini- und DeepSeek-APIs. Es unterstützt auch lokal gehostete Modelle wie Ollama.", faq4_q: "Brauche ich das IDE-Plugin dafür?", faq4_a: "Nein, die Kernengine ist eine eigenständige Go-Binärdatei, die ausschließlich über Standard-Git-Hooks arbeitet. Sie funktioniert universell.", cta_title: "Fang an, schneller zu committen.", cta_desc: "Installiere die CLI per Skript oder hol dir ein IDE-Plugin."
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
            nav_problem: "Problema", nav_faq: "FAQ", btn_install: "Instalar ahora", btn_github: "Ver código fuente", prob_title: "El problema de la espera con IA", prob_desc: "Las herramientas CLI síncronas bloquean tu terminal durante 10-30 segundos mientras el LLM genera un mensaje de commit. Es suficiente fricción para romper tu flujo y perder el contexto.", sec_arch: "Arquitectura", flow_title: "Cómo funciona el demonio", flow_step1_title: "Hook de 12ms", flow_step1_desc: "Ejecuta git commit -m \"fix\". El hook post-commit interceptor termina al instante.", flow_step2_title: "Demonio desvinculado", flow_step2_desc: "Un proceso en segundo plano se convierte en huérfano del SO, liberando completamente tu terminal.", flow_step3_title: "Pulido fantasma", flow_step3_desc: "El script obtiene el diff, transmite al LLM y ejecuta git commit --amend silenciosamente.", flow_step4_title: "Cola automática", flow_step4_desc: "Si ejecutas git push antes de tiempo, el payload se pone en cola hasta que el amend finalice.", eco_title: "Integración profunda con IDE", eco_desc: "¿No quieres usar el terminal? Los plugins nativos de VS Code e IntelliJ IDEA supervisan el archivo de estado para proporcionarte estado en tiempo real, registros en streaming y controles directamente donde escribes código.", sec_support: "Soporte", faq_title: "Preguntas frecuentes", faq1_q: "¿Alterará mi historial de git?", faq1_a: "No. Git AI usa un prefijo de bloqueo estrictamente emparejado [⏳]. Solo enmienda el último commit exacto en el que fue iniciado.", faq2_q: "¿Qué pasa si hago push mientras aún está generando?", faq2_a: "Por defecto, el hook pre-push intercepta la llamada de red, la coloca en una cola de ejecución y libera el terminal. El push de red real se ejecuta automáticamente en segundo plano.", faq3_q: "¿Qué LLMs son compatibles?", faq3_a: "Git AI soporta nativamente las APIs de OpenAI, Anthropic, Gemini y DeepSeek. También soporta modelos alojados localmente como Ollama.", faq4_q: "¿Necesito el plugin IDE para usarlo?", faq4_a: "No, el motor principal es un binario Go independiente que opera únicamente a través de hooks Git estándar. Funciona universalmente.", cta_title: "Empieza a hacer commits más rápido.", cta_desc: "Instala la CLI mediante script u obtén un plugin IDE."
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
            nav_problem: "課題", nav_faq: "よくある質問", btn_install: "今すぐインストール", btn_github: "ソースを見る", prob_title: "AI待ち時間の問題", prob_desc: "同期CLIツールはLLMがコミットメッセージを生成する間、ターミナルを10〜30秒ロックします。それはフローを中断してコンテキストを失うのに十分な摩擦です。", sec_arch: "アーキテクチャ", flow_title: "デーモンの仕組み", flow_step1_title: "12msフック", flow_step1_desc: "git commit -m \"fix\"を実行します。インターセプトするpost-commitフックが即座に完了します。", flow_step2_title: "デーモンが切り離される", flow_step2_desc: "バックグラウンドプロセスがOSに対して孤児化し、ターミナルを完全に解放します。", flow_step3_title: "ゴーストポリッシング", flow_step3_desc: "スクリプトはdiffを取得し、LLMにストリーミングして、git commit --amendをサイレントに実行します。", flow_step4_title: "自動キュー", flow_step4_desc: "早めにgit pushを実行した場合、amendが完了するまでペイロードがキューに入ります。", eco_title: "深いIDE統合", eco_desc: "ターミナルを使いたくない？ネイティブのVS CodeとIntelliJ IEDEプラグインがステートファイルを監視し、コードを書く場所でリアルタイムのバックグラウンドステータス、ストリーミングログ、コントロールを提供します。", sec_support: "サポート", faq_title: "よくある質問", faq1_q: "gitの履歴が壊れますか？", faq1_a: "いいえ。Git AIは厳密に一致するロックプレフィックス[⏳]を使用します。開始された最後の正確なコミットのみを修正します。", faq2_q: "まだ生成中にpushしたらどうなりますか？", faq2_a: "デフォルトでは、pre-pushフックがネットワーク呼び出しをインターセプトし、実行キューに入れてターミナルを解放します。実際のネットワークプッシュはバックグラウンドで自動的に実行されます。", faq3_q: "どのLLMがサポートされていますか？", faq3_a: "Git AIはOpenAI、Anthropic、Gemini、DeepSeek APIをネイティブにサポートしています。Ollamaのようなローカルホストモデルもサポートしています。", faq4_q: "IDEプラグインが必要ですか？", faq4_a: "いいえ、コアエンジンは標準のGitフックのみで動作するスタンドアロンのGoバイナリです。あらゆる環境で動作します。", cta_title: "より速くコミットを始めましょう。", cta_desc: "スクリプトでCLIをインストールするか、IDEプラグインを入手してください。"
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
            nav_problem: "문제", nav_faq: "자주 묻는 질문", btn_install: "지금 설치", btn_github: "소스 보기", prob_title: "AI 대기 문제", prob_desc: "동기 CLI 도구는 LLM이 커밋 메시지를 생성하는 동안 10-30초 동안 터미널을 잠급니다. 그것은 흐름을 끊고 컨텍스트를 잃기에 충분한 마찰입니다.", sec_arch: "아키텍처", flow_title: "데몬 작동 방식", flow_step1_title: "12ms 훅", flow_step1_desc: "git commit -m \"fix\"를 실행합니다. 인터셉트하는 post-commit 훅이 즉시 완료됩니다.", flow_step2_title: "데몬 분리", flow_step2_desc: "백그라운드 프로세스가 OS에 고아화되어 터미널을 완전히 해방합니다.", flow_step3_title: "고스트 폴리싱", flow_step3_desc: "스크립트가 diff를 가져오고, LLM으로 스트리밍하고, git commit --amend를 조용히 실행합니다.", flow_step4_title: "자동 대기열", flow_step4_desc: "일찍 git push를 실행하면 amend가 완료될 때까지 페이로드가 대기열에 들어갑니다.", eco_title: "심층 IDE 통합", eco_desc: "터미널을 사용하고 싶지 않으신가요? 네이티브 VS Code 및 IntelliJ IDEA 플러그인이 상태 파일을 모니터링하여 코드를 작성하는 곳에서 직접 실시간 백그라운드 상태, 스트리밍 로그 및 제어를 제공합니다.", sec_support: "지원", faq_title: "자주 묻는 질문", faq1_q: "git 기록이 엉망이 될까요?", faq1_a: "아니요. Git AI는 엄격하게 매칭된 잠금 접두사 [⏳]를 사용합니다. 시작된 최신 정확한 커밋만 수정합니다.", faq2_q: "아직 생성 중에 push하면 어떻게 되나요?", faq2_a: "기본적으로 pre-push 훅이 네트워크 호출을 인터셉트하고, 실행 대기열에 넣고, 터미널을 해제합니다. 실제 네트워크 푸시는 백그라운드에서 자동으로 실행됩니다.", faq3_q: "어떤 LLM이 지원되나요?", faq3_a: "Git AI는 OpenAI, Anthropic, Gemini 및 DeepSeek API를 기본적으로 지원합니다. Ollama와 같은 로컬 호스팅 모델도 지원합니다.", faq4_q: "사용하려면 IDE 플러그인이 필요한가요?", faq4_a: "아니요, 코어 엔진은 표준 Git 훅을 통해서만 작동하는 독립형 Go 바이너리입니다. 모든 환경에서 작동합니다.", cta_title: "더 빠르게 커밋을 시작하세요.", cta_desc: "스크립트로 CLI를 설치하거나 IDE 플러그인을 받으세요."
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
            nav_problem: "Problema", nav_faq: "FAQ", btn_install: "Instalar agora", btn_github: "Ver código-fonte", prob_title: "O Problema de Espera da IA", prob_desc: "Ferramentas CLI síncronas bloqueiam seu terminal por 10-30 segundos enquanto o LLM gera uma mensagem de commit. É fricção suficiente para quebrar seu fluxo e perder o contexto.", sec_arch: "Arquitetura", flow_title: "Como o Daemon Funciona", flow_step1_title: "Hook de 12ms", flow_step1_desc: "Execute git commit -m \"fix\". O hook post-commit interceptador termina instantaneamente.", flow_step2_title: "Daemon se Desanexa", flow_step2_desc: "Um processo em segundo plano se torna órfão para o SO, liberando completamente seu terminal.", flow_step3_title: "Polimento Fantasma", flow_step3_desc: "O script busca o diff, transmite para o LLM e executa git commit --amend silenciosamente.", flow_step4_title: "Fila Automática", flow_step4_desc: "Se você executar git push cedo, o payload fica na fila até o amend terminar.", eco_title: "Integração Profunda com IDE", eco_desc: "Não quer usar o terminal? Os plugins nativos do VS Code e IntelliJ IDEA monitoram o arquivo de estado para fornecer status em tempo real, logs em streaming e controles diretamente onde você escreve código.", sec_support: "Suporte", faq_title: "Perguntas Frequentes", faq1_q: "Isso vai bagunçar meu histórico git?", faq1_a: "Não. O Git AI usa um prefixo de bloqueio estritamente correspondente [⏳]. Ele apenas emenda o último commit exato em que foi iniciado.", faq2_q: "E se eu fizer push enquanto ainda está gerando?", faq2_a: "Por padrão, o hook pre-push intercepta a chamada de rede, coloca na fila de execução e libera o terminal. O push de rede real é executado automaticamente em segundo plano.", faq3_q: "Quais LLMs são suportados?", faq3_a: "O Git AI suporta nativamente as APIs OpenAI, Anthropic, Gemini e DeepSeek. Também suporta modelos hospedados localmente como Ollama.", faq4_q: "Preciso do plugin IDE para usá-lo?", faq4_a: "Não, o motor principal é um binário Go independente que opera puramente via hooks Git padrão. Funciona universalmente.", cta_title: "Comece a commitar mais rápido.", cta_desc: "Instale o CLI via script ou obtenha um plugin IDE."
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
            nav_problem: "Проблема", nav_faq: "FAQ", btn_install: "Установить сейчас", btn_github: "Просмотр исходного кода", prob_title: "Проблема ожидания ИИ", prob_desc: "Синхронные CLI-инструменты блокируют ваш терминал на 10-30 секунд, пока LLM генерирует сообщение коммита. Этого достаточно для прерывания потока и потери контекста.", sec_arch: "Архитектура", flow_title: "Как работает демон", flow_step1_title: "Хук 12мс", flow_step1_desc: "Выполните git commit -m \"fix\". Перехватывающий post-commit хук завершается мгновенно.", flow_step2_title: "Демон отсоединяется", flow_step2_desc: "Фоновый процесс становится сиротой для ОС, полностью освобождая терминал.", flow_step3_title: "Призрачная полировка", flow_step3_desc: "Скрипт получает diff, передаёт в LLM и выполняет git commit --amend в тишине.", flow_step4_title: "Авто-очередь", flow_step4_desc: "Если вы запустите git push заранее, полезная нагрузка встаёт в очередь до завершения amend.", eco_title: "Глубокая интеграция с IDE", eco_desc: "Не хотите использовать терминал? Нативные плагины VS Code и IntelliJ IDEA следят за файлом состояния, предоставляя статус в реальном времени, потоковые логи и элементы управления прямо там, где вы пишете код.", sec_support: "Поддержка", faq_title: "Часто задаваемые вопросы", faq1_q: "Это испортит мою историю git?", faq1_a: "Нет. Git AI использует строго согласованный префикс блокировки [⏳]. Он всегда изменяет только тот точный последний коммит, на котором был инициирован.", faq2_q: "Что если я делаю push пока идёт генерация?", faq2_a: "По умолчанию, хук pre-push перехватывает сетевой вызов, помещает его в очередь выполнения и освобождает терминал. Фактический сетевой push выполняется автоматически в фоновом режиме.", faq3_q: "Какие LLM поддерживаются?", faq3_a: "Git AI нативно поддерживает API OpenAI, Anthropic, Gemini и DeepSeek. Также поддерживаются локально размещённые модели, такие как Ollama.", faq4_q: "Мне нужен плагин IDE для работы?", faq4_a: "Нет, основной движок — это автономный бинарный файл Go, работающий исключительно через стандартные хуки Git. Работает универсально.", cta_title: "Начните коммитить быстрее.", cta_desc: "Установите CLI через скрипт или получите плагин IDE."
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
            nav_problem: "المشكلة", nav_faq: "الأسئلة الشائعة", btn_install: "تثبيت الآن", btn_github: "عرض الكود المصدري", prob_title: "مشكلة الانتظار مع الذكاء الاصطناعي", prob_desc: "تقوم أدوات CLI المتزامنة بتجميد المحطة الطرفية لمدة 10-30 ثانية بينما يقوم LLM بإنشاء رسالة إيداع. هذا يكفي لكسر تدفق عملك وفقدان السياق.", sec_arch: "البنية التقنية", flow_title: "كيف يعمل الخادم الخلفي", flow_step1_title: "Hook بـ 12ms", flow_step1_desc: "قم بتنفيذ git commit -m \"fix\". يكتمل hook ما بعد الإيداع فورًا.", flow_step2_title: "انفصال الخادم", flow_step2_desc: "تتيتم عملية خلفية للنظام، وتحرر المحطة الطرفية بالكامل.", flow_step3_title: "التحسين الخفي", flow_step3_desc: "يجلب البرنامج الـ diff، ويرسله إلى LLM، وينفذ git commit --amend بصمت.", flow_step4_title: "الطابور التلقائي", flow_step4_desc: "إذا قمت بتشغيل git push مبكرًا، يُضاف الحمل إلى الطابور حتى يكتمل الـ amend.", eco_title: "تكامل عميق مع IDE", eco_desc: "لا تريد استخدام المحطة الطرفية؟ تراقب الإضافات الأصلية لـ VS Code وIntelliJ IDEA ملف الحالة لتوفير حالة خلفية فورية وسجلات مباشرة وعناصر تحكم مباشرة حيث تكتب الكود.", sec_support: "الدعم", faq_title: "الأسئلة الشائعة", faq1_q: "هل سيفسد تاريخ git الخاص بي؟", faq1_a: "لا. يستخدم Git AI بادئة قفل مطابقة بدقة [⏳]. لا يعدّل سوى آخر commit تم البدء عليه.", faq2_q: "ماذا لو قمت بالـ push أثناء التوليد؟", faq2_a: "افتراضيًا، يقوم hook ما قبل الـ push باعتراض الطلب الشبكي، ويضعه في طابور تنفيذ، ويحرر المحطة الطرفية. يتم تنفيذ الـ push الفعلي تلقائيًا في الخلفية.", faq3_q: "ما نماذج LLM المدعومة؟", faq3_a: "يدعم Git AI نواتج API من OpenAI وAnthropic وGemini وDeepSeek. كما يدعم النماذج المستضافة محليًا مثل Ollama.", faq4_q: "هل أحتاج إلى إضافة IDE لاستخدامه؟", faq4_a: "لا، المحرك الأساسي هو ملف ثنائي مستقل بلغة Go يعمل فقط عبر هوكات Git القياسية. يعمل بشكل عالمي.", cta_title: "ابدأ بالـ commit بشكل أسرع.", cta_desc: "ثبّت CLI عبر سكريبت أو احصل على إضافة IDE."
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
            nav_problem: "Vấn đề", nav_faq: "Câu hỏi thường gặp", btn_install: "Cài đặt ngay", btn_github: "Xem mã nguồn", prob_title: "Vấn đề chờ đợi AI", prob_desc: "Các công cụ CLI đồng bộ khóa terminal của bạn từ 10-30 giây trong khi LLM tạo thông điệp commit. Đây là đủ ma sát để làm gián đoạn luồng làm việc và mất ngữ cảnh.", sec_arch: "Kiến trúc", flow_title: "Cách daemon hoạt động", flow_step1_title: "Hook 12ms", flow_step1_desc: "Chạy git commit -m \"fix\". Hook post-commit chặn lệnh và hoàn thành ngay lập tức.", flow_step2_title: "Daemon tách rời", flow_step2_desc: "Một tiến trình nền tự mồ côi hóa vào OS, giải phóng hoàn toàn terminal của bạn.", flow_step3_title: "Trau chuốt bóng tối", flow_step3_desc: "Script lấy diff, truyền phát đến LLM và chạy git commit --amend một cách lặng lẽ.", flow_step4_title: "Hàng đợi tự động", flow_step4_desc: "Nếu bạn chạy git push sớm, payload sẽ vào hàng đợi cho đến khi amend hoàn thành.", eco_title: "Tích hợp IDE sâu sắc", eco_desc: "Không muốn dùng terminal? Plugin gốc của VS Code và IntelliJ IDEA theo dõi file trạng thái để cung cấp trạng thái nền theo thời gian thực, nhật ký trực tiếp và các điều khiển ngay tại nơi bạn viết code.", sec_support: "Hỗ trợ", faq_title: "Câu hỏi thường gặp", faq1_q: "Nó có làm hỏng lịch sử git của tôi không?", faq1_a: "Không. Git AI sử dụng tiền tố khóa khớp nghiêm ngặt [⏳]. Nó chỉ amend commit chính xác mới nhất mà nó được khởi tạo trên đó.", faq2_q: "Nếu tôi push trong khi đang tạo thì sao?", faq2_a: "Theo mặc định, hook pre-push chặn lời gọi mạng, đưa vào hàng đợi thực thi và giải phóng terminal. Push mạng thực tế sẽ chạy tự động trong nền.", faq3_q: "Những LLM nào được hỗ trợ?", faq3_a: "Git AI hỗ trợ gốc các API OpenAI, Anthropic, Gemini và DeepSeek. Nó cũng hỗ trợ các mô hình được lưu trữ cục bộ như Ollama.", faq4_q: "Tôi có cần plugin IDE để sử dụng không?", faq4_a: "Không, engine cốt lõi là một file nhị phân Go độc lập hoạt động hoàn toàn qua các hook Git tiêu chuẩn. Nó hoạt động phổ quát.", cta_title: "Bắt đầu commit nhanh hơn.", cta_desc: "Cài đặt CLI qua script hoặc lấy plugin IDE."
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
            nav_problem: "ปัญหา", nav_faq: "คำถามที่พบบ่อย", btn_install: "ติดตั้งทันที", btn_github: "ดูซอร์สโค้ด", prob_title: "ปัญหาการรอ AI", prob_desc: "เครื่องมือ CLI แบบซิงโครนัสจะล็อค Terminal ของคุณเป็นเวลา 10-30 วินาทีขณะที่ LLM กำลังสร้างข้อความ commit นั่นเพียงพอที่จะทำลายกระแสการทำงานและเสียบริบทของคุณ", sec_arch: "สถาปัตยกรรม", flow_title: "วิธีการทำงานของ Daemon", flow_step1_title: "Hook 12ms", flow_step1_desc: "รัน git commit -m \"fix\" hook post-commit ที่ดักจับคำสั่งเสร็จสิ้นทันที", flow_step2_title: "Daemon แยกตัวออก", flow_step2_desc: "กระบวนการเบื้องหลังกลายเป็นลูกกำพร้าของ OS ปล่อย Terminal ของคุณได้อย่างสมบูรณ์", flow_step3_title: "การขัดเกลาแบบล่องหน", flow_step3_desc: "สคริปต์ดึง diff ส่งสตรีมไปยัง LLM และรัน git commit --amend อย่างเงียบ ๆ", flow_step4_title: "คิวอัตโนมัติ", flow_step4_desc: "ถ้าคุณรัน git push ก่อน payload จะถูกจัดคิวจนกว่า amend จะเสร็จสิ้น", eco_title: "การรวมเข้ากับ IDE อย่างลึกซึ้ง", eco_desc: "ไม่อยากใช้ Terminal? ปลั๊กอิน VS Code และ IntelliJ IDEA แบบเนทีฟจะตรวจสอบไฟล์สถานะเพื่อให้สถานะเบื้องหลังแบบเรียลไทม์ สตรีมมิ่งล็อก และตัวควบคุมโดยตรงที่คุณเขียนโค้ด", sec_support: "การสนับสนุน", faq_title: "คำถามที่พบบ่อย", faq1_q: "มันจะทำให้ประวัติ git ของฉันยุ่งเหยิงไหม?", faq1_a: "ไม่ Git AI ใช้คำนำหน้าการล็อคที่จับคู่อย่างเข้มงวด [⏳] มันจะแก้ไขเฉพาะ commit ล่าสุดที่มันเริ่มต้นเท่านั้น", faq2_q: "ถ้าฉัน push ในขณะที่กำลังสร้างอยู่?", faq2_a: "โดยค่าเริ่มต้น hook pre-push จะดักจับการเรียกเครือข่าย วางไว้ในคิวการดำเนินการ และปล่อย Terminal การ push เครือข่ายจริงจะรันโดยอัตโนมัติในเบื้องหลัง", faq3_q: "รองรับ LLM อะไรบ้าง?", faq3_a: "Git AI รองรับ API ของ OpenAI, Anthropic, Gemini และ DeepSeek โดยตรง นอกจากนี้ยังรองรับโมเดลที่โฮสต์ในเครื่องเช่น Ollama", faq4_q: "ฉันต้องการปลั๊กอิน IDE เพื่อใช้งานไหม?", faq4_a: "ไม่ Engine หลักเป็นไฟล์ไบนารี Go แบบสแตนด์อโลนที่ทำงานผ่าน Git hooks มาตรฐานเท่านั้น ทำงานได้ทุกที่", cta_title: "เริ่ม commit ได้เร็วขึ้นวันนี้", cta_desc: "ติดตั้ง CLI ผ่านสคริปต์ หรือรับปลั๊กอิน IDE"
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
            nav_problem: "Masalah", nav_faq: "FAQ", btn_install: "Pasang Sekarang", btn_github: "Lihat Kode Sumber", prob_title: "Masalah Menunggu AI", prob_desc: "Perkakas CLI sinkron mengunci terminal Anda selama 10-30 detik saat LLM menghasilkan pesan commit. Itu sudah cukup untuk memutus alur kerja dan kehilangan konteks.", sec_arch: "Arsitektur", flow_title: "Cara Daemon Bekerja", flow_step1_title: "Hook 12ms", flow_step1_desc: "Jalankan git commit -m \"fix\". Hook post-commit yang mencegat selesai secara instan.", flow_step2_title: "Daemon Terpisah", flow_step2_desc: "Proses latar belakang menjatirkan diri ke OS, membebaskan terminal sepenuhnya.", flow_step3_title: "Pemolesan Hantu", flow_step3_desc: "Skrip mengambil diff, mengalirkan ke LLM, dan menjalankan git commit --amend secara senyap.", flow_step4_title: "Antrian Otomatis", flow_step4_desc: "Jika Anda menjalankan git push lebih awal, payload dimasukkan ke antrian hingga amend selesai.", eco_title: "Integrasi IDE yang Mendalam", eco_desc: "Tidak mau pakai terminal? Plugin native VS Code dan IntelliJ IDEA memantau file status untuk memberikan status latar belakang real-time, log streaming, dan kontrol langsung di tempat Anda menulis kode.", sec_support: "Dukungan", faq_title: "Pertanyaan yang Sering Diajukan", faq1_q: "Apakah ini akan merusak riwayat git saya?", faq1_a: "Tidak. Git AI menggunakan prefiks kunci yang cocok secara ketat [⏳]. Ini hanya mengamend commit terbaru yang tepat yang diinisiasi.", faq2_q: "Bagaimana jika saya push saat masih menghasilkan?", faq2_a: "Secara default, hook pre-push mencegat panggilan jaringan, memasukkannya ke antrean eksekusi, dan membebaskan terminal. Push jaringan yang sebenarnya berjalan otomatis di latar belakang.", faq3_q: "LLM mana yang didukung?", faq3_a: "Git AI mendukung secara native API OpenAI, Anthropic, Gemini, dan DeepSeek. Ini juga mendukung model yang dihosting secara lokal seperti Ollama.", faq4_q: "Apakah saya perlu plugin IDE untuk menggunakannya?", faq4_a: "Tidak, mesin inti adalah biner Go mandiri yang beroperasi murni melalui hook Git standar. Bekerja secara universal.", cta_title: "Mulai commit lebih cepat.", cta_desc: "Pasang CLI melalui skrip atau ambil plugin IDE."
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
