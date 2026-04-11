import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/** Shape of config.json / .git-ai.json. */
interface GitAiConfig {
    api_key?: string;
    model?: string;
    base_url?: string;
    provider?: string;
    language?: string;
    push_policy?: string;
    message_format?: string;
    prompt_template?: string;
    max_diff_tokens?: number;
}

const DEFAULTS: Required<GitAiConfig> = {
    api_key: '',
    model: 'deepseek-chat',
    base_url: 'https://api.deepseek.com/v1',
    provider: 'openai',
    language: 'en',
    push_policy: 'queue',
    message_format: 'conventional',
    prompt_template: '',
    max_diff_tokens: 4000,
};

/**
 * Full-screen webview panel for editing git-ai configuration.
 * Supports switching between Global and Project scope with live inheritance preview.
 */
export class SettingsPanel {
    private static currentPanel: SettingsPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly workspaceRoot: string;
    private disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, workspaceRoot: string) {
        this.panel = panel;
        this.workspaceRoot = workspaceRoot;

        this.panel.webview.options = { enableScripts: true };
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
            'git-ai Settings',
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true },
        );

        SettingsPanel.currentPanel = new SettingsPanel(panel, workspaceRoot);
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
        // Strip empty strings and zero values so they don't override lower layers.
        const clean: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(cfg)) {
            if (v !== '' && v !== 0 && v !== undefined && v !== null) {
                clean[k] = v;
            }
        }
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(clean, null, 2) + '\n');
    }

    // ── Messages ──────────────────────────────────────────

    private handleMessage(msg: { command: string; scope?: string; data?: GitAiConfig }): void {
        switch (msg.command) {
            case 'load':
                this.refresh();
                break;
            case 'save': {
                const filePath = msg.scope === 'project' ? this.projectPath() : this.globalPath();
                if (msg.data) {
                    this.writeConfig(filePath, msg.data);
                }
                vscode.window.showInformationMessage(
                    `✅ git-ai: ${msg.scope === 'project' ? 'Project' : 'Global'} config saved`,
                );
                this.refresh();
                break;
            }
            case 'reset': {
                const filePath = msg.scope === 'project' ? this.projectPath() : this.globalPath();
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                vscode.window.showInformationMessage(
                    `🗑️ git-ai: ${msg.scope === 'project' ? 'Project' : 'Global'} config reset`,
                );
                this.refresh();
                break;
            }
        }
    }

    private refresh(): void {
        const global = this.readConfig(this.globalPath());
        const project = this.readConfig(this.projectPath());
        const merged = { ...DEFAULTS, ...global, ...project };

        this.panel.webview.html = this.getHtml(global, project, merged);
    }

    // ── HTML ──────────────────────────────────────────────

    private getHtml(global: GitAiConfig, project: GitAiConfig, merged: Required<GitAiConfig>): string {
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
        padding: 24px 32px;
        max-width: 680px;
    }
    h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
    .subtitle { color: var(--vscode-descriptionForeground); font-size: 13px; margin-bottom: 20px; }

    /* Tab bar */
    .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--vscode-panel-border); margin-bottom: 20px; }
    .tab {
        padding: 8px 20px; font-size: 13px; font-weight: 500; cursor: pointer;
        border: 1px solid transparent; border-bottom: none; border-radius: 4px 4px 0 0;
        color: var(--vscode-descriptionForeground);
        background: transparent; transition: all 0.15s;
    }
    .tab:hover { color: var(--vscode-foreground); }
    .tab.active {
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
        border-color: var(--vscode-panel-border);
        position: relative; top: 1px;
    }
    .tab-badge {
        display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 10px;
        margin-left: 6px; vertical-align: middle;
    }
    .tab-badge.global { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .tab-badge.project { background: var(--vscode-inputValidation-warningBackground); color: var(--vscode-inputValidation-warningForeground); }

    .scope-pane { display: none; }
    .scope-pane.active { display: block; }

    /* Form */
    .field { margin-bottom: 16px; }
    .field label {
        display: block; font-size: 12px; font-weight: 600; margin-bottom: 4px;
        color: var(--vscode-foreground);
    }
    .field .hint {
        font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 4px;
    }
    .field .inherited {
        font-size: 11px; color: var(--vscode-textLink-foreground); margin-top: 2px;
        font-style: italic;
    }
    input, select {
        width: 100%; padding: 6px 10px; font-size: 13px; font-family: inherit;
        border: 1px solid var(--vscode-input-border);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border-radius: 4px; outline: none;
    }
    input:focus, select:focus { border-color: var(--vscode-focusBorder); }
    input::placeholder { color: var(--vscode-input-placeholderForeground); }
    select { cursor: pointer; }

    .actions { display: flex; gap: 8px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--vscode-panel-border); }
    .btn {
        padding: 8px 20px; font-size: 13px; border: none; border-radius: 4px; cursor: pointer;
        font-family: inherit; font-weight: 500;
    }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .btn-danger { background: transparent; color: var(--vscode-errorForeground); border: 1px solid var(--vscode-errorForeground); }
    .btn-danger:hover { background: var(--vscode-inputValidation-errorBackground); }
    .spacer { flex: 1; }

    .section-title {
        font-size: 13px; font-weight: 600; margin: 20px 0 12px;
        padding-bottom: 6px; border-bottom: 1px solid var(--vscode-panel-border);
    }
</style>
</head>
<body>
    <h1>⚙️ git-ai Settings</h1>
    <p class="subtitle">Configure AI commit message polishing. Project settings override Global.</p>

    <div class="tabs">
        <div class="tab active" onclick="switchTab('global')">
            🌍 Global<span class="tab-badge global">shared</span>
        </div>
        <div class="tab" onclick="switchTab('project')">
            📁 Project<span class="tab-badge project">override</span>
        </div>
    </div>

    <!-- ═══ GLOBAL ═══ -->
    <div id="pane-global" class="scope-pane active">
        <div class="section-title">🔑 Provider</div>
        ${this.renderField('g', 'api_key', 'API Key', 'password', DEFAULTS.api_key, global.api_key, '', 'Your LLM API key (stored in ~/.config/git-ai/config.json)')}
        ${this.renderSelect('g', 'provider', 'Provider', ['openai', 'ollama'], DEFAULTS.provider, global.provider, '')}
        ${this.renderField('g', 'base_url', 'Base URL', 'text', DEFAULTS.base_url, global.base_url, '', 'API endpoint URL')}
        ${this.renderField('g', 'model', 'Model', 'text', DEFAULTS.model, global.model, '', 'LLM model name')}

        <div class="section-title">📝 Commit Format</div>
        ${this.renderSelect('g', 'message_format', 'Message Format', ['conventional', 'plain', 'gitmoji', 'subject-body'], DEFAULTS.message_format, global.message_format, '')}
        ${this.renderSelect('g', 'language', 'Language', ['en', 'zh-CN', 'ja', 'ko', 'es', 'fr', 'de'], DEFAULTS.language, global.language, '')}
        ${this.renderField('g', 'prompt_template', 'Custom Prompt', 'text', '', global.prompt_template, '', 'Override the system prompt (leave empty for default)')}

        <div class="section-title">🚀 Push Behavior</div>
        ${this.renderSelect('g', 'push_policy', 'Push Policy', ['queue', 'block'], DEFAULTS.push_policy, global.push_policy, '', 'queue = auto-push after polish, block = manual push')}
        ${this.renderField('g', 'max_diff_tokens', 'Max Diff Tokens', 'number', String(DEFAULTS.max_diff_tokens), global.max_diff_tokens !== undefined ? String(global.max_diff_tokens) : '', '', 'Max tokens for diff context sent to LLM')}

        <div class="actions">
            <button class="btn btn-primary" onclick="save('global')">💾 Save Global</button>
            <span class="spacer"></span>
            <button class="btn btn-danger" onclick="resetScope('global')">Reset</button>
        </div>
    </div>

    <!-- ═══ PROJECT ═══ -->
    <div id="pane-project" class="scope-pane">
        <p class="hint" style="margin-bottom:16px">
            Project settings override Global for this repo only. Leave fields empty to inherit from Global.
        </p>

        <div class="section-title">🔑 Provider</div>
        ${this.renderField('p', 'api_key', 'API Key', 'password', '', project.api_key, merged.api_key, 'Override API key for this repo')}
        ${this.renderSelect('p', 'provider', 'Provider', ['', 'openai', 'ollama'], '', project.provider, merged.provider)}
        ${this.renderField('p', 'base_url', 'Base URL', 'text', '', project.base_url, merged.base_url)}
        ${this.renderField('p', 'model', 'Model', 'text', '', project.model, merged.model)}

        <div class="section-title">📝 Commit Format</div>
        ${this.renderSelect('p', 'message_format', 'Message Format', ['', 'conventional', 'plain', 'gitmoji', 'subject-body'], '', project.message_format, merged.message_format)}
        ${this.renderSelect('p', 'language', 'Language', ['', 'en', 'zh-CN', 'ja', 'ko', 'es', 'fr', 'de'], '', project.language, merged.language)}
        ${this.renderField('p', 'prompt_template', 'Custom Prompt', 'text', '', project.prompt_template, merged.prompt_template)}

        <div class="section-title">🚀 Push Behavior</div>
        ${this.renderSelect('p', 'push_policy', 'Push Policy', ['', 'queue', 'block'], '', project.push_policy, merged.push_policy)}
        ${this.renderField('p', 'max_diff_tokens', 'Max Diff Tokens', 'number', '', project.max_diff_tokens !== undefined ? String(project.max_diff_tokens) : '', String(merged.max_diff_tokens))}

        <div class="actions">
            <button class="btn btn-primary" onclick="save('project')">💾 Save Project</button>
            <span class="spacer"></span>
            <button class="btn btn-danger" onclick="resetScope('project')">Reset</button>
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
        }

        function gatherFields(prefix) {
            const data = {};
            document.querySelectorAll('[data-scope="' + prefix + '"]').forEach(el => {
                const key = el.dataset.key;
                let val = el.value;
                if (el.type === 'number' && val !== '') { val = parseInt(val, 10); }
                if (val !== '' && val !== 0) { data[key] = val; }
            });
            return data;
        }

        function save(scope) {
            const prefix = scope === 'global' ? 'g' : 'p';
            vscode.postMessage({ command: 'save', scope, data: gatherFields(prefix) });
        }

        function resetScope(scope) {
            if (!confirm('Reset all ' + scope + ' settings? This cannot be undone.')) return;
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
            ? `inherited: ${type === 'password' ? '••••' : inheritedVal}`
            : (defaultVal || '');

        return `<div class="field">
            <label>${label}</label>
            ${hint ? `<div class="hint">${hint}</div>` : ''}
            <input type="${type}" data-scope="${prefix}" data-key="${key}"
                   value="${this.escapeAttr(val)}" placeholder="${this.escapeAttr(placeholder)}" />
            ${prefix === 'p' && inheritedVal && !val ? `<div class="inherited">← inherited from Global</div>` : ''}
        </div>`;
    }

    private renderSelect(
        prefix: string, key: string, label: string, options: string[],
        defaultVal: string, currentVal: string | undefined, inheritedVal: string,
        hint: string = '',
    ): string {
        const val = currentVal ?? '';
        const optionsHtml = options.map(o => {
            const display = o === '' ? (inheritedVal ? `(inherit: ${inheritedVal})` : '(inherit)') : o;
            return `<option value="${o}" ${val === o ? 'selected' : ''}>${display}</option>`;
        }).join('');

        return `<div class="field">
            <label>${label}</label>
            ${hint ? `<div class="hint">${hint}</div>` : ''}
            <select data-scope="${prefix}" data-key="${key}">${optionsHtml}</select>
            ${prefix === 'p' && !val && inheritedVal ? `<div class="inherited">← inherited from Global</div>` : ''}
        </div>`;
    }

    private escapeAttr(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}
