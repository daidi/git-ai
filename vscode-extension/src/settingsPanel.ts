import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as crypto from 'crypto';
import { notifyError, notifyInfo } from './notifications';
import { t } from './i18n';
import { getExecutablePath } from './installer';

/** Shape returned by `git-ai config list --json`. */
interface GitAiConfig {
    api_key?: string;
    model?: string;
    base_url?: string;
    provider?: string;
    language?: string;
    ui_language?: string;
    push_policy?: string;
    message_format?: string;
    prompt_template?: string;
    max_diff_tokens?: number;
    log_level?: string;
    check_update?: boolean;
    explain?: boolean;
    api_key_configured?: boolean;
}

const DEFAULTS: Required<GitAiConfig> = {
    api_key: '',
    model: 'deepseek-chat',
    base_url: 'https://api.deepseek.com/v1',
    provider: 'openai',
    language: 'en',
    ui_language: '',
    push_policy: 'queue',
    message_format: 'conventional',
    prompt_template: '',
    max_diff_tokens: 8000,
    log_level: 'info',
    check_update: true,
    explain: false,
    api_key_configured: false,
};

/**
 * Full-screen webview panel for editing git-ai configuration.
 * Professional native VS Code settings layout with i18n and Codicons.
 */
export class SettingsPanel {
    private static currentPanel: SettingsPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly workspaceRoot: string;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, workspaceRoot: string, extensionUri: vscode.Uri) {
        this.panel = panel;
        this.workspaceRoot = workspaceRoot;
        this.extensionUri = extensionUri;

        this.panel.webview.options = { 
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources', 'codicons')]
        };
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(
            (msg) => this.handleMessage(msg),
            null,
            this.disposables,
        );

        void this.refresh().catch(error => notifyError(error instanceof Error ? error.message : String(error)));
    }

    static show(extensionUri: vscode.Uri, workspaceRoot: string): void {
        if (!vscode.workspace.isTrusted) {
            notifyError('Git AI settings are disabled in Restricted Mode.');
            return;
        }
        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel.panel.reveal();
            void SettingsPanel.currentPanel.refresh();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'gitAiSettings',
            t('settings.title'),
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true },
        );

        SettingsPanel.currentPanel = new SettingsPanel(panel, workspaceRoot, extensionUri);
    }

    private dispose(): void {
        SettingsPanel.currentPanel = undefined;
        for (const d of this.disposables) { d.dispose(); }
    }

    // ── CLI-owned configuration ───────────────────────────

    private async readConfig(scope: 'global' | 'local' | 'merged'): Promise<GitAiConfig> {
        const output = await this.runGitAi(['config', 'list', '--scope', scope, '--json']);
        return JSON.parse(output) as GitAiConfig;
    }

    private async writeConfig(scope: 'global' | 'local', cfg: GitAiConfig): Promise<void> {
        const clean: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(cfg)) {
            if (key !== 'api_key_configured' && value !== '' && value !== undefined && value !== null) { clean[key] = value; }
        }
        const existing = await this.readConfig(scope);
        if (existing.check_update !== undefined && clean.check_update === undefined) {
            clean.check_update = existing.check_update;
        }
        await this.runGitAi(['config', 'replace', '--scope', scope], JSON.stringify(clean));
    }

    // ── Messages ──────────────────────────────────────────

    private async handleMessage(msg: { command: string; scope?: string; data?: GitAiConfig }): Promise<void> {
        const scopeName = msg.scope === 'project' ? t('settings.tab.project') : t('settings.tab.global');
        try {
            switch (msg.command) {
                case 'load':
                    await this.refresh();
                    break;
                case 'save': {
                    if (msg.data) {
                        const dataObj: Record<string, unknown> = { ...msg.data };
                        const isInstallHook = dataObj.install_hook;
                        delete dataObj.install_hook;
                        const scope = msg.scope === 'project' ? 'local' : 'global';
                        await this.writeConfig(scope, dataObj as GitAiConfig);
                        if (msg.scope === 'project' && typeof isInstallHook === 'boolean') {
                            const installed = await this.isHookInstalled();
                            if (isInstallHook && !installed) { await vscode.commands.executeCommand('git-ai.init'); }
                            else if (!isInstallHook && installed) { await vscode.commands.executeCommand('git-ai.uninstall'); }
                        }
                    }
                    notifyInfo(t('settings.msg.saved', scopeName));
                    await this.refresh();
                    break;
                }
                case 'reset': {
                    const scope = msg.scope === 'project' ? 'local' : 'global';
                    await this.runGitAi(['config', 'reset', '--scope', scope]);
                    notifyInfo(t('settings.msg.reset', scopeName));
                    await this.refresh();
                    break;
                }
                case 'testConfig':
                    await vscode.commands.executeCommand('git-ai.config.test');
                    break;
            }
        } catch (error) {
            notifyError(error instanceof Error ? error.message : String(error));
        }
    }

    private async refresh(): Promise<void> {
        const [global, project, mergedConfig, hookState] = await Promise.all([
            this.readConfig('global'), this.readConfig('local'), this.readConfig('merged'), this.isHookInstalled(),
        ]);
        const merged = { ...DEFAULTS, ...mergedConfig };
        this.panel.webview.html = this.getHtml(global, project, merged, hookState);
    }
    
    private async isHookInstalled(): Promise<boolean> {
        try {
            const status = JSON.parse(await this.runGitAi(['status', '--json'])) as { initialized?: boolean };
            return status.initialized === true;
        } catch { return false; }
    }

    private runGitAi(args: string[], input?: string): Promise<string> {
        if (!vscode.workspace.isTrusted) { return Promise.reject(new Error('Git AI is disabled in Restricted Mode.')); }
        const configured = vscode.workspace.getConfiguration('git-ai').get<string>('binaryPath', 'git-ai');
        return this.runCommand(getExecutablePath(configured), args, input);
    }

    private runCommand(binary: string, args: string[], input?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const child = cp.execFile(binary, args, { cwd: this.workspaceRoot, timeout: 30_000, windowsHide: true }, (error, stdout, stderr) => {
                if (error) { reject(new Error(stderr.trim() || error.message)); return; }
                resolve(stdout.trim());
            });
            if (input !== undefined) { child.stdin?.end(input); }
        });
    }

    // ── HTML ──────────────────────────────────────────────

    private getHtml(global: GitAiConfig, project: GitAiConfig, merged: Required<GitAiConfig>, hookState: boolean): string {
        const nonce = crypto.randomBytes(16).toString('base64');
        const codiconsUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'resources', 'codicons', 'codicon.css')
        );

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${this.panel.webview.cspSource}; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<link href="${codiconsUri}" rel="stylesheet" />
<style>
    :root {
        --animation-fast: 0.15s ease-in-out;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
        padding: 32px 40px;
        max-width: 800px;
        margin: 0 auto;
    }
    
    .header {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
    }
    .header-icon {
        font-size: 24px;
        margin-right: 12px;
        color: var(--vscode-textLink-foreground);
    }
    .subtitle { color: var(--vscode-descriptionForeground); font-size: 13px; margin-bottom: 28px; line-height: 1.5; }

    /* Modern Tab bar */
    .tabs { 
        display: flex; gap: 0; 
        border-bottom: 1px solid var(--vscode-panel-border); 
        margin-bottom: 28px; 
    }
    .tab {
        padding: 10px 24px; font-size: 13px; font-weight: 500; cursor: pointer;
        border: 1px solid transparent; border-bottom: none; border-radius: 4px 4px 0 0;
        color: var(--vscode-descriptionForeground);
        background: transparent; transition: all var(--animation-fast);
        display: flex; align-items: center; gap: 8px;
    }
    .tab:hover { color: var(--vscode-foreground); }
    .tab.active {
        color: var(--vscode-foreground);
        border-color: var(--vscode-panel-border);
        border-bottom-color: var(--vscode-editor-background);
        margin-bottom: -1px;
    }
    .tab-badge {
        display: inline-flex; padding: 2px 6px; border-radius: 10px; font-size: 10px; line-height: 1;
        font-weight: 600; text-transform: uppercase;
    }
    .tab-badge.global { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .tab-badge.project { background: var(--vscode-terminal-ansiYellow); color: var(--vscode-editor-background); }

    .scope-pane { display: none; margin-bottom: 40px; }
    .scope-pane.active { display: block; animation: fade-in var(--animation-fast); }
    @keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

    /* Field Layout */
    .section-title {
        display: flex; align-items: center; gap: 8px;
        font-size: 16px; font-weight: 300; margin: 32px 0 16px;
        color: var(--vscode-foreground);
    }
    .section-title .codicon {
        color: var(--vscode-textLink-foreground);
    }
    .divider {
        height: 1px; background: var(--vscode-panel-border);
        margin: 0 0 16px; width: 100%;
    }

    .field { margin-bottom: 24px; display: grid; gap: 6px; }
    .field label {
        font-size: 13px; font-weight: 600; color: var(--vscode-foreground);
    }
    .field .hint {
        font-size: 12px; color: var(--vscode-descriptionForeground); line-height: 1.4;
    }
    .field .inherited {
        font-size: 12px; color: var(--vscode-textLink-foreground); margin-top: 4px;
    }
    
    .toggle-switch-field {
        display: flex; align-items: center; justify-content: space-between; max-width: 480px; margin-bottom: 24px;
    }
    .toggle-switch-field label { font-size: 13px; font-weight: 600; cursor: pointer; }
    .toggle-switch-field .hint { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 2px; }

    input[type="text"], input[type="password"], input[type="number"], select {
        width: 100%; max-width: 480px; padding: 6px 10px; font-size: 13px; font-family: inherit;
        border: 1px solid var(--vscode-input-border);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border-radius: 2px; outline: none; transition: border var(--animation-fast);
    }
    input:focus, select:focus { 
        border-color: var(--vscode-focusBorder);
    }
    input::placeholder { color: var(--vscode-input-placeholderForeground); font-style: italic; }
    select { cursor: pointer; }

    /* Actions Bottom Bar */
    .actions { 
        position: sticky; bottom: 0; background: var(--vscode-editor-background);
        display: flex; gap: 12px; padding: 16px 0; 
        border-top: 1px solid var(--vscode-panel-border); z-index: 10;
        margin-top: 32px;
    }
    .btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 14px; font-size: 13px; border: none; border-radius: 2px; cursor: pointer;
        font-family: inherit; font-weight: 500; transition: background var(--animation-fast);
    }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
    .btn-danger { background: transparent; color: var(--vscode-errorForeground); border: 1px solid var(--vscode-errorForeground); }
    .btn-danger:hover { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-foreground); }
    .spacer { flex: 1; }

    .project-note {
        padding: 12px 16px; background: var(--vscode-textBlockQuote-background);
        border-left: 4px solid var(--vscode-textLink-foreground);
        font-size: 13px; color: var(--vscode-foreground); margin-bottom: 24px;
        display: flex; align-items: flex-start; gap: 8px;
    }
</style>
<script nonce="${nonce}">
    const i18n = ${this.serializeForScript({
        confirmReset: t('settings.confirm.reset', '{0}'),
        disabledHint: t('settings.hint.disabledTemplate'),
        globalTab: t('settings.tab.global'),
        projectTab: t('settings.tab.project'),
    })};
</script>
</head>
<body>
    <div class="header">
        <i class="codicon codicon-settings-gear header-icon"></i>
        <h1>${t('settings.title')}</h1>
    </div>
    <p class="subtitle">${t('settings.subtitle')}</p>

    <div class="tabs">
        <div class="tab active" data-tab="global">
            <i class="codicon codicon-globe"></i>
            ${t('settings.tab.global')}<span class="tab-badge global">${t('settings.badge.shared')}</span>
        </div>
        <div class="tab" data-tab="project">
            <i class="codicon codicon-folder"></i>
            ${t('settings.tab.project')}<span class="tab-badge project">${t('settings.badge.override')}</span>
        </div>
    </div>

    <!-- ═══ GLOBAL ═══ -->
    <div id="pane-global" class="scope-pane active">
        <div class="section-title"><i class="codicon codicon-key"></i>${t('settings.section.auth')}</div>
        <div class="divider"></div>
        ${this.renderField('g', 'api_key', t('settings.field.apiKey'), 'password', DEFAULTS.api_key, global.api_key, '', t('settings.hint.apiKey'))}
        ${this.renderSelect('g', 'provider', t('settings.field.provider'), ['openai', 'ollama', 'anthropic', 'gemini'], DEFAULTS.provider, global.provider, '')}
        ${this.renderField('g', 'base_url', t('settings.field.baseUrl'), 'text', DEFAULTS.base_url, global.base_url, '')}
        ${this.renderField('g', 'model', t('settings.field.model'), 'text', DEFAULTS.model, global.model, '')}

        <div class="section-title"><i class="codicon codicon-edit"></i>${t('settings.section.format')}</div>
        <div class="divider"></div>
        ${this.renderSelect('g', 'message_format', t('settings.field.messageFormat'), ['conventional', 'plain', 'gitmoji', 'subject-body'], DEFAULTS.message_format, global.message_format, '')}
        ${this.renderSelect('g', 'language', t('settings.field.language'), ['en', 'zh-CN', 'ja', 'ko', 'es', 'fr', 'de'], DEFAULTS.language, global.language, '')}
        ${this.renderField('g', 'prompt_template', t('settings.field.promptTemplate'), 'text', '', global.prompt_template, '', t('settings.hint.promptTemplate'))}

        <div class="section-title"><i class="codicon codicon-rocket"></i>${t('settings.section.behavior')}</div>
        <div class="divider"></div>
        ${this.renderSelect('g', 'push_policy', t('settings.field.pushPolicy'), ['queue', 'block'], DEFAULTS.push_policy, global.push_policy, '', t('settings.hint.pushPolicy'))}
        ${this.renderField('g', 'max_diff_tokens', t('settings.field.maxDiffTokens'), 'number', String(DEFAULTS.max_diff_tokens), global.max_diff_tokens !== undefined ? String(global.max_diff_tokens) : '', '', t('settings.hint.maxDiffTokens'))}
        ${this.renderSelect('g', 'log_level', t('settings.field.logLevel'), ['error', 'info', 'debug'], DEFAULTS.log_level, global.log_level, '')}
        ${this.renderSelect('g', 'ui_language', t('settings.field.uiLanguage'), ['', 'en', 'zh'], '', global.ui_language, '', t('settings.hint.uiLanguage'))}
        ${this.renderSelect('g', 'explain', t('settings.field.explain'), ['true', 'false'], String(DEFAULTS.explain), global.explain !== undefined ? String(global.explain) : '', '', t('settings.hint.explain'))}

        <div class="actions">
            <button class="btn btn-primary" data-action="save" data-config-scope="global"><i class="codicon codicon-save"></i> ${t('settings.btn.saveGlobal')}</button>
            <button class="btn" style="border: 1px solid var(--vscode-button-secondaryHoverBackground); background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);" data-action="test" data-config-scope="global"><i class="codicon codicon-zap"></i> ${t('settings.btn.testConfig')}</button>
            <span class="spacer"></span>
            <button class="btn btn-danger" data-action="reset" data-config-scope="global">${t('settings.btn.reset')}</button>
        </div>
    </div>

    <!-- ═══ PROJECT ═══ -->
    <div id="pane-project" class="scope-pane">
        <div class="project-note">
            <i class="codicon codicon-info" style="color: var(--vscode-textLink-foreground); font-size: 16px; line-height: 1.2;"></i>
            <span>${t('settings.hint.projectNote')}</span>
        </div>
        
        <div class="section-title"><i class="codicon codicon-plug"></i>${t('settings.section.installation')}</div>
        <div class="divider"></div>
        ${this.renderCheckbox('p', 'install_hook', t('settings.field.projectEnabled'), hookState)}

        <div class="section-title"><i class="codicon codicon-key"></i>${t('settings.section.auth')}</div>
        <div class="divider"></div>
        ${this.renderSelect('p', 'provider', t('settings.field.provider'), ['', 'openai', 'ollama', 'anthropic', 'gemini'], '', project.provider, merged.provider)}
        ${this.renderField('p', 'base_url', t('settings.field.baseUrl'), 'text', '', project.base_url, merged.base_url)}
        ${this.renderField('p', 'model', t('settings.field.model'), 'text', '', project.model, merged.model)}

        <div class="section-title"><i class="codicon codicon-edit"></i>${t('settings.section.format')}</div>
        <div class="divider"></div>
        ${this.renderSelect('p', 'message_format', t('settings.field.messageFormat'), ['', 'conventional', 'plain', 'gitmoji', 'subject-body'], '', project.message_format, merged.message_format)}
        ${this.renderSelect('p', 'language', t('settings.field.language'), ['', 'en', 'zh-CN', 'ja', 'ko', 'es', 'fr', 'de'], '', project.language, merged.language)}
        ${this.renderField('p', 'prompt_template', t('settings.field.promptTemplate'), 'text', '', project.prompt_template, merged.prompt_template)}

        <div class="section-title"><i class="codicon codicon-rocket"></i>${t('settings.section.behavior')}</div>
        <div class="divider"></div>
        ${this.renderSelect('p', 'push_policy', t('settings.field.pushPolicy'), ['', 'queue', 'block'], '', project.push_policy, merged.push_policy)}
        ${this.renderField('p', 'max_diff_tokens', t('settings.field.maxDiffTokens'), 'number', '', project.max_diff_tokens !== undefined ? String(project.max_diff_tokens) : '', String(merged.max_diff_tokens))}
        ${this.renderSelect('p', 'log_level', t('settings.field.logLevel'), ['', 'error', 'info', 'debug'], '', project.log_level, merged.log_level)}
        ${this.renderSelect('p', 'ui_language', t('settings.field.uiLanguage'), ['', 'en', 'zh'], '', project.ui_language, merged.ui_language)}
        ${this.renderSelect('p', 'explain', t('settings.field.explain'), ['', 'true', 'false'], '', project.explain !== undefined ? String(project.explain) : '', String(merged.explain))}

        <div class="actions">
            <button class="btn btn-primary" data-action="save" data-config-scope="project"><i class="codicon codicon-save"></i> ${t('settings.btn.saveProject')}</button>
            <button class="btn" style="border: 1px solid var(--vscode-button-secondaryHoverBackground); background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);" data-action="test" data-config-scope="project"><i class="codicon codicon-zap"></i> ${t('settings.btn.testConfig')}</button>
            <span class="spacer"></span>
            <button class="btn btn-danger" data-action="reset" data-config-scope="project">${t('settings.btn.reset')}</button>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();

        function switchTab(scope) {
            document.querySelectorAll('.tab').forEach((t, i) => {
                t.classList.toggle('active', (scope === 'global' ? i === 0 : i === 1));
            });
            document.querySelectorAll('.scope-pane').forEach(p => p.classList.remove('active'));
            document.getElementById('pane-' + scope).classList.add('active');
            window.scrollTo(0, 0);
        }

        function updateDisables() {
            ['g', 'p'].forEach(prefix => {
                const pt = document.querySelector('[data-scope="' + prefix + '"][data-key="prompt_template"]');
                const mf = document.querySelector('[data-scope="' + prefix + '"][data-key="message_format"]');
                const ex = document.querySelector('[data-scope="' + prefix + '"][data-key="explain"]');
                
                if (pt && mf && ex) {
                    const hasTemplate = pt.value.trim().length > 0;
                    mf.disabled = hasTemplate;
                    ex.disabled = hasTemplate;
                    
                    if (hasTemplate) {
                        mf.title = i18n.disabledHint;
                        ex.title = i18n.disabledHint;
                        mf.style.opacity = '0.5';
                        ex.style.opacity = '0.5';
                    } else {
                        mf.title = '';
                        ex.title = '';
                        mf.style.opacity = '1';
                        ex.style.opacity = '1';
                    }
                }
            });
        }

        document.querySelectorAll('[data-key="prompt_template"]').forEach(el => {
            el.addEventListener('input', updateDisables);
        });
        // Run once on load
        setTimeout(updateDisables, 0);

        function gatherFields(prefix) {
            const data = {};
            document.querySelectorAll('[data-scope="' + prefix + '"]').forEach(el => {
                const key = el.dataset.key;
                if (el.type === 'checkbox') {
                    if (key === 'install_hook') {
                        data[key] = el.checked;
                    }
                } else {
                    let val = el.value.trim();
                    if (el.type === 'number' && val !== '') { val = parseInt(val, 10); }
                    if (val === 'true') { data[key] = true; }
                    else if (val === 'false') { data[key] = false; }
                    else if (val !== '' && val !== 0 && !Number.isNaN(val)) { data[key] = val; }
                }
            });
            return data;
        }

        function save(scope) {
            const prefix = scope === 'global' ? 'g' : 'p';
            vscode.postMessage({ command: 'save', scope, data: gatherFields(prefix) });
        }

        function testConfig(scope) {
            vscode.postMessage({ command: 'testConfig', scope });
        }

        function resetScope(scope) {
            const msg = i18n.confirmReset.replace('{0}', scope === 'global' ? i18n.globalTab : i18n.projectTab);
            if (!confirm(msg)) return;
            vscode.postMessage({ command: 'reset', scope });
        }

        document.addEventListener('click', function(event) {
            const target = event.target && event.target.closest ? event.target.closest('[data-tab], [data-action]') : null;
            if (!target) return;
            const tab = target.getAttribute('data-tab');
            if (tab) { switchTab(tab); return; }
            const action = target.getAttribute('data-action');
            const scope = target.getAttribute('data-config-scope');
            if (!action || !scope) return;
            if (action === 'save') save(scope);
            if (action === 'test') testConfig(scope);
            if (action === 'reset') resetScope(scope);
        });
    </script>
</body>
</html>`;
    }

    private renderField(
        prefix: string, key: string, label: string, type: string,
        defaultVal: string, currentVal: string | undefined, inheritedVal: string,
        hint: string = '',
    ): string {
        const val = currentVal ?? '';
        const placeholder = prefix === 'p' && inheritedVal
            ? `\u2190 ${type === 'password' ? '\u2022\u2022\u2022\u2022' : inheritedVal}`
            : (defaultVal || '');

        return `<div class="field">
            <label>${label}</label>
            ${hint ? `<div class="hint">${hint}</div>` : ''}
            <input type="${type}" data-scope="${prefix}" data-key="${key}"
                   value="${this.escapeAttr(String(val))}" placeholder="${this.escapeAttr(placeholder)}" />
            ${prefix === 'p' && inheritedVal && !val ? `<div class="inherited">${t('settings.inherit.label')}</div>` : ''}
        </div>`;
    }

    private renderSelect(
        prefix: string, key: string, label: string, options: string[],
        defaultVal: string, currentVal: string | undefined, inheritedVal: string,
        hint: string = '',
    ): string {
        const val = currentVal ?? '';
        const optionsHtml = options.map(o => {
            const display = o === '' ? (inheritedVal ? t('settings.inherit.val', inheritedVal) : t('settings.inherit.empty')) : o;
            return `<option value="${this.escapeAttr(o)}" ${val === o ? 'selected' : ''}>${this.escapeAttr(display)}</option>`;
        }).join('');

        return `<div class="field">
            <label>${label}</label>
            ${hint ? `<div class="hint">${hint}</div>` : ''}
            <select data-scope="${prefix}" data-key="${key}">${optionsHtml}</select>
            ${prefix === 'p' && !val && inheritedVal ? `<div class="inherited">${t('settings.inherit.label')}</div>` : ''}
        </div>`;
    }

    private renderCheckbox(
        prefix: string, key: string, label: string, currentVal: boolean
    ): string {
        return `<div class="toggle-switch-field">
            <div>
                <label for="${prefix}_${key}">${label}</label>
                <div class="hint">${t('settings.hint.projectEnabled')}</div>
            </div>
            <input type="checkbox" id="${prefix}_${key}" data-scope="${prefix}" data-key="${key}" ${currentVal ? 'checked' : ''} />
        </div>`;
    }

    private escapeAttr(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    private serializeForScript(value: unknown): string {
        return JSON.stringify(value)
            .replace(/</g, '\\u003c')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029');
    }
}
