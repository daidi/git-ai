document.addEventListener('DOMContentLoaded', () => {

    const translations = {
        en: {
            nav_features: "Features",
            hero_badge: "v0.2.3 Released",
            hero_title: "Commit first,<br>think <span>later.</span>",
            hero_desc: "An async background daemon that intercepts your raw commits, passes them to LLMs, and silently amends your history. <strong>Never wait in the terminal.</strong>",
            copy_feedback: "Copied",
            hero_docs_btn: "Documentation →",
            feat1_title: "Zero Latency",
            feat1_desc: "Your commit completes in 12ms. The LLM processes everything in an orphaned background daemon.",
            feat2_title: "Real-time Status",
            feat2_desc: "<code>[⏳]</code> prefix acts as a locking mechanism visible natively in <code>git log</code> to prevent sync issues.",
            feat3_title: "Queue Push",
            feat3_desc: "Hitting <code>git push</code> while polishing? We queue the network payload and execute it after the amend finishes.",
            feat4_title: "IDE Native",
            feat4_desc: "No more terminal toggling. Monitor daemon hooks natively through VS Code and IntelliJ IDEA extensions.",
            footer_subtitle: "Async Commit Polisher.",
            footer_plugins: "Plugins",
            footer_resources: "Resources",
            footer_repo: "GitHub Repositories",
            footer_releases: "Releases",
            
            term_input: 'git commit -m "fix stuff"',
            term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] fix stuff</span>',
            term_line2: '<span class="t-wait">✨ git-ai:</span> Background polishing started (PID 28312)',
            term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>',
            term_line4: '<span class="t-success">✓ git-ai:</span> Polished commit message',
            term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        },
        zh: {
            nav_features: "核心特性",
            hero_badge: "v0.2.3 最新发布",
            hero_title: "先提交，<br>后<span>思考。</span>",
            hero_desc: "基于 post-commit 挂钩的异步守护进程，自动拦截原始提交并交由大语言模型润色，在后台静默重写历史。<strong>再也不用在终端里傻等。</strong>",
            copy_feedback: "已复制",
            hero_docs_btn: "查阅文档 →",
            feat1_title: "零感延迟",
            feat1_desc: "提交仅需 12 毫秒。复杂的 LLM 请求全部在被彻底隔离的后台守护进程中静默完成。",
            feat2_title: "实时状态可见",
            feat2_desc: "临时 <code>[⏳]</code> 前缀作为安全锁，在 <code>git log</code> 中直接反馈状态，杜绝代码同步冲突。",
            feat3_title: "自动排队推送",
            feat3_desc: "如果在润色还没结束时执行了 <code>git push</code>，推送会被加入队列，等待润色完成后后台静默发出。",
            feat4_title: "IDE 原生集成",
            feat4_desc: "提供原生的 VS Code 和 IntelliJ IDEA 插件查看后台状态和工作流，彻底告别频繁切终端的操作。",
            footer_subtitle: "异步无感的跨生态 Git 提交润色工具。",
            footer_plugins: "IDE 插件",
            footer_resources: "相关资源",
            footer_repo: "GitHub 仓库",
            footer_releases: "最新发布版本",
            
            term_input: 'git commit -m "修个bug"',
            term_line1: '<span class="t-dim">[main 4f1a2b3] [⏳] 修个bug</span>',
            term_line2: '<span class="t-wait">✨ git-ai:</span> 正在后台处理润色 (PID 28312)',
            term_line3: '<span class="t-dim">1 file changed, 12 insertions(+)</span>',
            term_line4: '<span class="t-success">✓ git-ai:</span> 润色完成',
            term_line5: '<span class="t-cmd">fix(auth): resolve session timeout on mobile devices</span>'
        }
    };

    // Detect initial language: localStorage > browser navigator > default 'en'
    let currentLang = localStorage.getItem('gitai_lang');
    if (!currentLang) {
        currentLang = (navigator.language || navigator.userLanguage || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
    }
    function updateLanguage() {
        document.documentElement.lang = currentLang;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (translations[currentLang][key]) {
                el.innerHTML = translations[currentLang][key];
            }
        });
    }

    // Toggle button handler
    const langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
        langBtn.addEventListener('click', () => {
            currentLang = currentLang === 'en' ? 'zh' : 'en';
            localStorage.setItem('gitai_lang', currentLang);
            updateLanguage();
        });
    }

    // Initial load
    updateLanguage();

    // Copy to clipboard functionality
    const copyBtn = document.querySelector('.copy-btn');
    const cmdText = document.querySelector('.cmd-text').innerText;
    const feedback = document.querySelector('.copy-feedback');

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(cmdText).then(() => {
                feedback.classList.add('show');
                setTimeout(() => {
                    feedback.classList.remove('show');
                }, 2000);
            });
        });
    }

    // Terminal Typing Effect
    const termBody = document.getElementById('term-typing');
    
    function getSequence() {
        const langStr = translations[currentLang];
        return [
            { type: 'input', text: langStr.term_input, delay: 800 },
            { type: 'line', html: langStr.term_line1, delay: 400 },
            { type: 'line', html: langStr.term_line2, delay: 200 },
            { type: 'line', html: langStr.term_line3, delay: 1000 },
            { type: 'clear_status', delay: 500 },
            { type: 'line', html: langStr.term_line4, delay: 200 },
            { type: 'line', html: langStr.term_line5, delay: 3000 }
        ];
    }

    async function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function typeText(element, text, speed = 50) {
        for (let i = 0; i < text.length; i++) {
            element.textContent += text.charAt(i);
            await sleep(speed + Math.random() * 50); // random variation for realism
        }
    }

    async function runTerminal() {
        while (true) {
            termBody.innerHTML = '';
            
            // Add initial prompt
            const lineEl = document.createElement('div');
            lineEl.className = 't-line';
            lineEl.innerHTML = '<span class="t-prompt">$</span><span class="t-cmd cursor-container"></span><span class="cursor"></span>';
            termBody.appendChild(lineEl);
            
            const typingArea = lineEl.querySelector('.cursor-container');
            
            for (let step of getSequence()) {
                if (step.type === 'input') {
                    await sleep(step.delay);
                    await typeText(typingArea, step.text);
                    // Remove cursor
                    lineEl.querySelector('.cursor').style.display = 'none';
                } else if (step.type === 'line') {
                    await sleep(step.delay);
                    const newLine = document.createElement('div');
                    newLine.className = 't-line';
                    newLine.innerHTML = step.html;
                    termBody.appendChild(newLine);
                } else if (step.type === 'clear_status') {
                    await sleep(step.delay);
                    // In a real terminal, we might rewrite lines, here we'll just simulate the final state clearly
                    // Let's add a visual separator 
                    const sep = document.createElement('div');
                    sep.className = 't-line';
                    sep.innerHTML = '<br>';
                    termBody.appendChild(sep);
                }
            }
            
            // Wait before restarting
            await sleep(2000);
        }
    }

    runTerminal();
});
