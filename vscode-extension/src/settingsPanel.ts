import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { notifyInfo } from './notifications';
import { t } from './i18n';

/** Shape of config.json / .git-ai.json. */
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
    max_diff_tokens: 2000,
    log_level: 'info',
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
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode', 'codicons', 'dist')]
        };
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(
            (msg) => this.handleMessage(msg),
            null,
            this.disposables,
        );

        this.refresh();
    }

    static show(extensionUri: vscode.Uri, workspaceRoot: string): void {
        if (SettingsPanel.currentPanel) {
            SettingsPanel.currentPanel.panel.reveal();
            SettingsPanel.currentPanel.refresh();
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

    // ── File I/O ──────────────────────────────────────────

    private globalPath(): string {
        const home = process.env.HOME || process.env.USERPROFILE || '';
        return path.join(home, '.config', 'git-ai', 'config.json');
    }

    private projectPath(): string {
        return path.join(this.workspaceRoot, '.git-ai.json');
    }

    private readConfig(filePath: string): GitAiConfig {
        try {
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
        } catch { /* corrupted file */ }
        return {};
    }

    private writeConfig(filePath: string, cfg: GitAiConfig): void {
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(cfg)) {
            if (v !== '' && v !== 0 && v !== undefined && v !== null) {
                clean[k] = v;
            }
        }
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        
        if (Object.keys(clean).length === 0) {
            if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); }
        } else {
            fs.writeFileSync(filePath, JSON.stringify(clean, null, 2) + '\n');
        }
    }

    // ── Messages ──────────────────────────────────────────

    private handleMessage(msg: { command: string; scope?: string; data?: GitAiConfig }): void {
        const scopeName = msg.scope === 'project' ? t('settings.tab.project') : t('settings.tab.global');
        
        switch (msg.command) {
            case 'load':
                this.refresh();
                break;
            case 'save': {
                const filePath = msg.scope === 'project' ? this.projectPath() : this.globalPath();
                if (msg.data) {
                    const dataObj: any = msg.data;
                    const isInstallHook = dataObj['install_hook'];
                    delete dataObj['install_hook'];
                    this.writeConfig(filePath, dataObj as GitAiConfig);
                    
                    if (msg.scope === 'project' && isInstallHook !== undefined) {
                        const installed = this.isHookInstalled();
                        if (isInstallHook && !installed) {
                            vscode.commands.executeCommand('git-ai.init');
                        } else if (!isInstallHook && installed) {
                            vscode.commands.executeCommand('git-ai.uninstall');
                        }
                    }
                }
                notifyInfo(t('settings.msg.saved', scopeName));
                this.refresh();
                break;
            }
            case 'reset': {
                const filePath = msg.scope === 'project' ? this.projectPath() : this.globalPath();
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                notifyInfo(t('settings.msg.reset', scopeName));
                this.refresh();
                break;
            }
            case 'testConfig': {
                // If they changed fields but didn't save, warn them
                // We'll just run git-ai config test.
                vscode.commands.executeCommand('git-ai.config.test');
                break;
            }
        }
    }

    private refresh(): void {
        const global = this.readConfig(this.globalPath());
        const project = this.readConfig(this.projectPath());
        const merged = { ...DEFAULTS, ...global, ...project };
        
        const hookState = this.isHookInstalled();

        this.panel.webview.html = this.getHtml(global, project, merged, hookState);
    }
    
    private isHookInstalled(): boolean {
        const hookPath = path.join(this.workspaceRoot, '.git', 'hooks', 'post-commit');
        if (!fs.existsSync(hookPath)) { return false; }
        try {
            return fs.readFileSync(hookPath, 'utf-8').includes('git-ai hook post-commit');
        } catch { return false; }
    }

    // ── HTML ──────────────────────────────────────────────

    private getHtml(global: GitAiConfig, project: GitAiConfig, merged: Required<GitAiConfig>, hookState: boolean): string {
        const codiconsUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode', 'codicons', 'dist', 'codicon.css')
        );

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
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
    h1 { font-size: 22px; font-weight: 300; letter-spacing: 0.5px; }
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
<script>
    const i18n = {
        confirmReset: "${t('settings.confirm.reset', '{0}')}"
    };
</script>
</head>
<body>
    <div class="header">
        <i class="codicon codicon-settings-gear header-icon"></i>
        <h1>${t('settings.title')}</h1>
    </div>
    <p class="subtitle">${t('settings.subtitle')}</p>

    <div class="tabs">
        <div class="tab active" onclick="switchTab('global')">
            <i class="codicon codicon-globe"></i>
            ${t('settings.tab.global')}<span class="tab-badge global">${t('settings.badge.shared')}</span>
        </div>
        <div class="tab" onclick="switchTab('project')">
            <i class="codicon codicon-folder"></i>
            ${t('settings.tab.project')}<span class="tab-badge project">${t('settings.badge.override')}</span>
        </div>
    </div>

    <!-- ═══ GLOBAL ═══ -->
    <div id="pane-global" class="scope-pane active">
        <div class="section-title"><i class="codicon codicon-key"></i>${t('settings.section.auth')}</div>
        <div class="divider"></div>
        ${this.renderField('g', 'api_key', t('settings.field.apiKey'), 'password', DEFAULTS.api_key, global.api_key, '', t('settings.hint.apiKey'))}
        ${this.renderSelect('g', 'provider', t('settings.field.provider'), ['openai', 'ollama'], DEFAULTS.provider, global.provider, '')}
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

        <div class="actions">
            <button class="btn btn-primary" onclick="save('global')"><i class="codicon codicon-save"></i> ${t('settings.btn.saveGlobal')}</button>
            <button class="btn" style="border: 1px solid var(--vscode-button-secondaryHoverBackground); background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);" onclick="testConfig('global')"><i class="codicon codicon-zap"></i> ${t('settings.btn.testConfig')}</button>
            <span class="spacer"></span>
            <button class="btn btn-danger" onclick="resetScope('global')">${t('settings.btn.reset')}</button>
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
        ${this.renderField('p', 'api_key', t('settings.field.apiKey'), 'password', '', project.api_key, merged.api_key, '')}
        ${this.renderSelect('p', 'provider', t('settings.field.provider'), ['', 'openai', 'ollama'], '', project.provider, merged.provider)}
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

        <div class="actions">
            <button class="btn btn-primary" onclick="save('project')"><i class="codicon codicon-save"></i> ${t('settings.btn.saveProject')}</button>
            <button class="btn" style="border: 1px solid var(--vscode-button-secondaryHoverBackground); background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);" onclick="testConfig('project')"><i class="codicon codicon-zap"></i> ${t('settings.btn.testConfig')}</button>
            <span class="spacer"></span>
            <button class="btn btn-danger" onclick="resetScope('project')">${t('settings.btn.reset')}</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function switchTab(scope) {
            document.querySelectorAll('.tab').forEach((t, i) => {
                t.classList.toggle('active', (scope === 'global' ? i === 0 : i === 1));
            });
            document.querySelectorAll('.scope-pane').forEach(p => p.classList.remove('active'));
            document.getElementById('pane-' + scope).classList.add('active');
            window.scrollTo(0, 0);
        }

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
                    if (val !== '' && val !== 0 && !Number.isNaN(val)) { data[key] = val; }
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
            const msg = i18n.confirmReset.replace('{0}', scope === 'global' ? 'Global' : 'Project');
            if (!confirm(msg)) return;
            vscode.postMessage({ command: 'reset', scope });
        }
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
            const display = o === '' ? (inheritedVal ? t('settings.inherit.val', inheritedVal) : '(inherit)') : o;
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
}
