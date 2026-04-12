import * as vscode from 'vscode';

// ── I18N ──────────────────────────────────────────────

const TRANSLATIONS: Record<string, Record<string, string>> = {
    en: {
        // Settings Panel
        'settings.title': 'git-ai Settings',
        'settings.subtitle': 'Configure AI commit message polishing. Project settings override Global.',
        'settings.tab.global': 'Global',
        'settings.tab.project': 'Project',
        'settings.badge.shared': 'shared',
        'settings.badge.override': 'override',
        
        'settings.section.auth': 'Authentication & Provider',
        'settings.section.format': 'Commit Format',
        'settings.section.behavior': 'Push Behavior',
        'settings.section.installation': 'Installation',
        
        'settings.field.apiKey': 'API Key',
        'settings.field.provider': 'Provider',
        'settings.field.baseUrl': 'Base URL',
        'settings.field.model': 'Model',
        'settings.field.messageFormat': 'Message Format',
        'settings.field.language': 'Language',
        'settings.field.promptTemplate': 'Custom Prompt',
        'settings.field.pushPolicy': 'Push Policy',
        'settings.field.maxDiffTokens': 'Max Diff Tokens',
        'settings.field.logLevel': 'Log Level',
        'settings.field.projectEnabled': 'Enable git-ai',
        
        'settings.hint.apiKey': 'Your LLM API key (stored securely in ~/.config/git-ai/config.json)',
        'settings.hint.projectNote': 'Project settings override Global for this repo only. Leave fields empty to inherit.',
        'settings.hint.promptTemplate': 'Override the system prompt (leave empty for default)',
        'settings.hint.pushPolicy': 'queue = auto-push after polish, block = manual push',
        'settings.hint.maxDiffTokens': 'Max tokens for diff context sent to LLM',
        'settings.hint.projectEnabled': 'Install / Uninstall physical webhooks for this repository.',
        
        'settings.inherit.label': '\u2190 Inherited from Global',
        'settings.inherit.val': '(inherit: {0})',
        
        'settings.btn.saveGlobal': 'Save Global',
        'settings.btn.saveProject': 'Save Project',
        'settings.btn.testConfig': 'Test LLM Config',
        'settings.btn.reset': 'Reset',
        'settings.msg.saved': '✅ git-ai: {0} config saved',
        'settings.msg.reset': '🗑️ git-ai: {0} config reset',
        'settings.confirm.reset': 'Reset all {0} settings? This cannot be undone.',
        
        // Status Labels
        'status.polishing': 'AI Polishing...',
        'status.pushing': 'Pushing...',
        'status.pendingPush': 'Push Pending...',
        'status.idle': 'Idle',
        'status.pendingPushRemote': 'Push Pending → {0}',

        // Status Bar
        'statusBar.tooltip.default': 'git-ai status (click for logs)',
        'statusBar.polishing': '$(sparkle) AI Polishing...',
        'statusBar.pushing': '$(cloud-upload) Pushing...',
        'statusBar.pendingPush': '$(clock) Push Pending...',
        'statusBar.idle': '$(check) git-ai',
        'statusBar.tooltip.polishing': 'git-ai: Polishing commit {0}',
        'statusBar.tooltip.pushing': 'git-ai: Pushing to {0}',
        'statusBar.tooltip.pendingPush': 'git-ai: Push pending to {0}',
        'statusBar.tooltip.idle': 'git-ai: Idle',

        // Status Tree
        'tree.category.status': 'Status',
        'tree.category.lastCommit': 'Last Commit',
        'tree.category.originalMsg': 'Original Message',
        'tree.category.pendingPush': 'Pending Push',
        'tree.category.daemon': 'Daemon',
        'tree.pendingPush.queued': '{0} (queued {1})',
        'tree.daemon.pid': 'PID {0}',

        // Actions Webview
        'actions.section.actions': 'Actions',
        'actions.section.tools': 'Tools',
        'actions.btn.retry': 'Retry AI Polish',
        'actions.btn.undo': 'Undo (Restore Original)',
        'actions.btn.cancel': 'Cancel Polishing',
        'actions.btn.forcePush': 'Force Push Now',
        'actions.btn.showLogs': 'Show Logs',
        'actions.btn.config': 'Configuration',
        'actions.btn.reinit': 'Re-initialize',
        'actions.btn.skipNext': 'Skip AI (Next Commit)',

        // Commands
        'cmd.init.success': '🎉 git-ai initialized!',
        'cmd.init.failed': 'git-ai init failed: {0}',
        'cmd.uninstall.success': '🗑️ git-ai hooks uninstalled.',
        'cmd.uninstall.failed': 'git-ai uninstall failed: {0}',
        'cmd.retry.confirm': 'Re-generate AI commit message for the last commit?',
        'cmd.retry.yes': 'Yes',
        'cmd.retry.cancel': 'Cancel',
        'cmd.retry.progress': 'git-ai: Retrying...',
        'cmd.retry.success': '✨ git-ai: Commit message re-generated!',
        'cmd.retry.failed': 'git-ai retry failed: {0}',
        'cmd.undo.confirm': 'Restore the original commit message?',
        'cmd.undo.yes': 'Yes',
        'cmd.undo.cancel': 'Cancel',
        'cmd.undo.success': '⏪ git-ai: Original message restored',
        'cmd.undo.failed': 'git-ai undo failed: {0}',
        'cmd.cancel.noState': 'git-ai: No active state found',
        'cmd.cancel.success': '🛑 git-ai: Polishing cancelled',
        'cmd.cancel.noPolishing': 'git-ai: No polishing in progress',
        'cmd.cancel.failed': 'git-ai cancel failed: {0}',
        'cmd.push.confirm': 'Force push to remote now?',
        'cmd.push.yes': 'Yes',
        'cmd.push.cancel': 'Cancel',
        'cmd.push.progress': 'git-ai: Pushing...',
        'cmd.push.success': '🚀 git-ai: Push completed!',
        'cmd.push.failed': 'Push failed: {0}',
        'cmd.test.progress': 'git-ai: Testing LLM connection...',
        'cmd.test.success': '✅ git-ai: Test successful!\n\n{0}',
        'cmd.test.failed': '❌ git-ai: Test failed:\n\n{0}\n{1}',

        // Notifications (state transitions)
        'notification.polished': '✨ git-ai: Commit message polished!',
        'notification.pushCompleted': '🚀 git-ai: Push completed!',

        // Installer
        'installer.missing': 'git-ai CLI was not found in PATH or standard directories.',
        'installer.download': 'Download & Install (Auto)',
        'installer.homebrew': 'Install via Homebrew',
        'installer.go': 'Install via Go',
        'installer.cancel': 'Cancel',
        'installer.skipped': 'git-ai CLI installation skipped. Some features may not work.',
        'installer.progress': 'git-ai: Installing CLI...',
        'installer.success': '✨ git-ai CLI installed successfully!',
        'installer.failed': 'Failed to install CLI: {0}',
        'installer.prompt': 'git-ai is not initialized for this repository. Enable AI commit polishing?',
        'installer.enable': 'Enable git-ai',
        'installer.notNow': 'Not now',

        // Info labels (webview)
        'info.commit': 'Commit:',
        'info.original': 'Original:',
    },
    'zh-cn': {
        // Settings Panel
        'settings.title': 'git-ai 偏好设置',
        'settings.subtitle': '配置 AI 提交润色行为。项目级设定将覆盖全局设定。',
        'settings.tab.global': '全局',
        'settings.tab.project': '当前项目',
        'settings.badge.shared': '全域共享',
        'settings.badge.override': '项目覆盖',
        
        'settings.section.auth': '鉴权与大模型供应商',
        'settings.section.format': 'Commit 格式化规范',
        'settings.section.behavior': '自动推送行为',
        'settings.section.installation': '安装状态',
        
        'settings.field.apiKey': 'API 密钥 (API Key)',
        'settings.field.provider': '接口通道 (Provider)',
        'settings.field.baseUrl': '服务基址 (Base URL)',
        'settings.field.model': '模型标识 (Model)',
        'settings.field.messageFormat': '消息结构 (Format)',
        'settings.field.language': '生成语言 (Language)',
        'settings.field.promptTemplate': '自定义提示词 (Prompt)',
        'settings.field.pushPolicy': '推送时机 (Push Policy)',
        'settings.field.maxDiffTokens': 'Diff 截断阈值 (Tokens)',
        'settings.field.logLevel': '日志级别 (Log Level)',
        'settings.field.projectEnabled': '启用 git-ai',
        
        'settings.hint.apiKey': '您的大模型身份凭证（安全存储于本地）',
        'settings.hint.projectNote': '项目级设定仅对当前代码库生效。留空将自动继承全局设定。',
        'settings.hint.promptTemplate': '覆盖内置生成指令。留空则使用内置高水平校验规则。',
        'settings.hint.pushPolicy': 'queue: 润色完成后静默自动 Push; block: 阻断 Push 需手动确认',
        'settings.hint.maxDiffTokens': '传输给大模型的最长代码变更 Token 数',
        'settings.hint.projectEnabled': '在当前代码仓库物理安装 / 卸载 Git Hook。',
        
        'settings.inherit.label': '\u2190 继承自全局设定',
        'settings.inherit.val': '(继承: {0})',
        
        'settings.btn.saveGlobal': '保存全局配置',
        'settings.btn.saveProject': '保存项目配置',
        'settings.btn.testConfig': '测试连通性',
        'settings.btn.reset': '重置',
        'settings.msg.saved': '✅ git-ai: {0} 配置已保存',
        'settings.msg.reset': '🗑️ git-ai: {0} 配置已被清空',
        'settings.confirm.reset': '确定要清空并重置所有 {0} 的设置吗？此操作不可撤销。',
        
        // Status Labels
        'status.polishing': 'AI 润色中...',
        'status.pushing': '推送中...',
        'status.pendingPush': '待推送...',
        'status.idle': '空闲',
        'status.pendingPushRemote': '待推送 → {0}',

        // Status Bar
        'statusBar.tooltip.default': 'git-ai 状态（点击查看日志）',
        'statusBar.polishing': '$(sparkle) AI 润色中...',
        'statusBar.pushing': '$(cloud-upload) 推送中...',
        'statusBar.pendingPush': '$(clock) 待推送...',
        'statusBar.idle': '$(check) git-ai',
        'statusBar.tooltip.polishing': 'git-ai: 正在润色 Commit {0}',
        'statusBar.tooltip.pushing': 'git-ai: 正在推送到 {0}',
        'statusBar.tooltip.pendingPush': 'git-ai: 待推送到 {0}',
        'statusBar.tooltip.idle': 'git-ai: 空闲',

        // Status Tree
        'tree.category.status': '状态',
        'tree.category.lastCommit': '最近 Commit',
        'tree.category.originalMsg': '原始消息',
        'tree.category.pendingPush': '待推送',
        'tree.category.daemon': '守护进程',
        'tree.pendingPush.queued': '{0} (排队 {1})',
        'tree.daemon.pid': 'PID {0}',

        // Actions Webview
        'actions.section.actions': '操作',
        'actions.section.tools': '工具',
        'actions.btn.retry': '重试 AI 润色',
        'actions.btn.undo': '撤销（恢复原始消息）',
        'actions.btn.cancel': '终止当前润色',
        'actions.btn.forcePush': '马上推送到远端',
        'actions.btn.showLogs': '查看日志',
        'actions.btn.config': '配置',
        'actions.btn.reinit': '重新初始化',
        'actions.btn.skipNext': '跳过 AI (下一次)',

        // Commands
        'cmd.init.success': '🎉 git-ai 已初始化！',
        'cmd.init.failed': 'git-ai 初始化失败: {0}',
        'cmd.uninstall.success': '🗑️ git-ai Hooks 已卸载。',
        'cmd.uninstall.failed': 'git-ai 卸载失败: {0}',
        'cmd.retry.confirm': '重新生成最后一次 Commit 的 AI 提交语？',
        'cmd.retry.yes': '是',
        'cmd.retry.cancel': '取消',
        'cmd.retry.progress': 'git-ai: 重试中...',
        'cmd.retry.success': '✨ git-ai: Commit Message 已重新生成！',
        'cmd.retry.failed': 'git-ai 重试失败: {0}',
        'cmd.undo.confirm': '恢复原始的 Commit Message？',
        'cmd.undo.yes': '是',
        'cmd.undo.cancel': '取消',
        'cmd.undo.success': '⏪ git-ai: 原始消息已恢复',
        'cmd.undo.failed': 'git-ai 撤销失败: {0}',
        'cmd.cancel.noState': 'git-ai: 未找到活动状态',
        'cmd.cancel.success': '🛑 git-ai: 润色已取消',
        'cmd.cancel.noPolishing': 'git-ai: 当前没有正在进行的润色任务',
        'cmd.cancel.failed': 'git-ai 取消失败: {0}',
        'cmd.push.confirm': '立即强制推送到远端？',
        'cmd.push.yes': '是',
        'cmd.push.cancel': '取消',
        'cmd.push.progress': 'git-ai: 推送中...',
        'cmd.push.success': '🚀 git-ai: 推送完成！',
        'cmd.push.failed': '推送失败: {0}',
        'cmd.test.progress': 'git-ai: 正在测试 LLM 连通性...',
        'cmd.test.success': '✅ git-ai: 测试成功！\n\n{0}',
        'cmd.test.failed': '❌ git-ai: 测试失败：\n\n{0}\n{1}',

        // Notifications
        'notification.polished': '✨ git-ai: Commit Message 已润色！',
        'notification.pushCompleted': '🚀 git-ai: 推送完成！',

        // Installer
        'installer.missing': 'git-ai CLI 未在 PATH 或标准目录中找到。',
        'installer.download': '下载并安装（自动）',
        'installer.homebrew': '通过 Homebrew 安装',
        'installer.go': '通过 Go 安装',
        'installer.cancel': '取消',
        'installer.skipped': 'git-ai CLI 安装已跳过。部分功能可能不可用。',
        'installer.progress': 'git-ai: 正在安装 CLI...',
        'installer.success': '✨ git-ai CLI 安装成功！',
        'installer.failed': 'CLI 安装失败: {0}',
        'installer.prompt': '当前仓库尚未初始化 git-ai。是否启用 AI 提交润色？',
        'installer.enable': '启用 git-ai',
        'installer.notNow': '稍后再说',

        // Info labels (webview)
        'info.commit': 'Commit:',
        'info.original': '原始消息:',
    }
};

function getBaseLang(): string {
    const lang = vscode.env.language.toLowerCase();
    if (lang === 'zh-cn' || lang === 'zh-tw' || lang === 'zh-hk') {
        return 'zh-cn';
    }
    return 'en';
}

/**
 * Translate a key with optional string interpolation.
 * Usage: t('key', arg1, arg2) replaces {0}, {1}, etc.
 */
export function t(key: string, ...args: string[]): string {
    const lang = getBaseLang();
    const dictionary = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    let str = dictionary[key] || TRANSLATIONS['en'][key] || key;
    args.forEach((arg, i) => {
        str = str.replace(`{${i}}`, arg);
    });
    return str;
}
