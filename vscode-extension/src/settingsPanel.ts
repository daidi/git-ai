import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as crypto from 'crypto';
import { isSettingsProtocolMismatch } from './cliCompatibility';
import { notifyError, notifyInfo } from './notifications';
import { t } from './i18n';
import { getExecutableCandidates, getExecutablePath, installCliUpdate } from './installer';

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
    smart_skip?: boolean;
    max_diff_tokens?: number;
    log_level?: string;
    check_update?: boolean;
    explain?: boolean;
    api_key_configured?: boolean;
}

interface SettingsMessage {
    command: 'save' | 'reset' | 'testConfig' | 'load';
    scope?: 'global' | 'project';
    data?: GitAiConfig & { install_hook?: boolean };
}

interface FieldOptions {
    span?: 1 | 2;
    min?: number;
    max?: number;
    configured?: boolean;
    multiline?: boolean;
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
    smart_skip: true,
    max_diff_tokens: 8000,
    log_level: 'info',
    check_update: true,
    explain: false,
    api_key_configured: false,
};

/**
 * Full-screen, theme-native settings workbench.
 *
 * Configuration remains CLI-owned. The webview only edits a bounded snapshot
 * and delegates persistence, hook changes, and connection tests to commands.
 */
export class SettingsPanel {
    private static currentPanel: SettingsPanel | undefined;
    private static compatibilityRepair: Promise<boolean> | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly workspaceRoot: string;
    private readonly extensionUri: vscode.Uri;
    private readonly disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, workspaceRoot: string, extensionUri: vscode.Uri) {
        this.panel = panel;
        this.workspaceRoot = workspaceRoot;
        this.extensionUri = extensionUri;

        this.panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')],
        };
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(
            (message: SettingsMessage) => this.handleMessage(message),
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
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'gitAiSettings',
            t('settings.title'),
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                // Keeping this one small form alive avoids persisting API-key
                // drafts into webview state when the editor tab is hidden.
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')],
            },
        );

        SettingsPanel.currentPanel = new SettingsPanel(panel, workspaceRoot, extensionUri);
    }

    private dispose(): void {
        SettingsPanel.currentPanel = undefined;
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }

    // ── CLI-owned configuration ───────────────────────────

    private async readConfig(scope: 'global' | 'local' | 'merged'): Promise<GitAiConfig> {
        const output = await this.runGitAi(['config', 'list', '--scope', scope, '--json']);
        return JSON.parse(output) as GitAiConfig;
    }

    private async writeConfig(scope: 'global' | 'local', config: GitAiConfig): Promise<void> {
        const clean: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(config)) {
            if (key !== 'api_key_configured' && value !== '' && value !== undefined && value !== null) {
                clean[key] = value;
            }
        }
        const existing = await this.readConfig(scope);
        if (existing.check_update !== undefined && clean.check_update === undefined) {
            clean.check_update = existing.check_update;
        }
        await this.runGitAi(['config', 'replace', '--scope', scope], JSON.stringify(clean));
    }

    // ── Webview messages ──────────────────────────────────

    private async handleMessage(message: SettingsMessage): Promise<void> {
        const scope = message.scope === 'project' ? 'project' : 'global';
        const cliScope = scope === 'project' ? 'local' : 'global';
        const scopeName = scope === 'project' ? t('settings.tab.project') : t('settings.tab.global');
        const action = message.command === 'testConfig' ? 'test' : message.command;
        await this.postActionState(scope, action, true);

        try {
            switch (message.command) {
                case 'load':
                    await this.refresh();
                    break;
                case 'save': {
                    if (!message.data) {
                        return;
                    }
                    const data: Record<string, unknown> = { ...message.data };
                    const installHook = data.install_hook;
                    delete data.install_hook;
                    await this.writeConfig(cliScope, data as GitAiConfig);

                    if (scope === 'project' && typeof installHook === 'boolean') {
                        const installed = await this.isHookInstalled();
                        if (installHook && !installed) {
                            await vscode.commands.executeCommand('git-ai.init');
                        } else if (!installHook && installed) {
                            await vscode.commands.executeCommand('git-ai.uninstall');
                        }
                    }

                    notifyInfo(t('settings.msg.saved', scopeName));
                    await this.refresh();
                    break;
                }
                case 'reset': {
                    const resetLabel = t('settings.btn.reset');
                    const selection = await vscode.window.showWarningMessage(
                        t('settings.confirm.reset', scopeName),
                        { modal: true },
                        resetLabel,
                    );
                    if (selection !== resetLabel) {
                        return;
                    }
                    await this.runGitAi(['config', 'reset', '--scope', cliScope]);
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
        } finally {
            await this.postActionState(scope, action, false);
        }
    }

    private postActionState(scope: string, action: string, active: boolean): Thenable<boolean> {
        return this.panel.webview.postMessage({ command: 'actionState', scope, action, active });
    }

    private async refresh(): Promise<void> {
        const [global, project, mergedConfig, hookState] = await Promise.all([
            this.readConfig('global'),
            this.readConfig('local'),
            this.readConfig('merged'),
            this.isHookInstalled(),
        ]);
        const merged = { ...DEFAULTS, ...mergedConfig };
        this.panel.webview.html = this.getHtml(global, project, merged, hookState);
    }

    private async isHookInstalled(): Promise<boolean> {
        try {
            const status = JSON.parse(await this.runGitAi(['status', '--json'])) as { initialized?: boolean };
            return status.initialized === true;
        } catch {
            return false;
        }
    }

    private async runGitAi(args: string[], input?: string): Promise<string> {
        if (!vscode.workspace.isTrusted) {
            throw new Error('Git AI is disabled in Restricted Mode.');
        }
        const configured = vscode.workspace.getConfiguration('git-ai').get<string>('binaryPath') || 'git-ai';
        for (const binary of getExecutableCandidates(configured)) {
            try {
                return await this.runCommand(binary, args, input);
            } catch (error) {
                if (!isSettingsProtocolMismatch(error)) { throw error; }
            }
        }

        if (configured !== 'git-ai') {
            throw new Error(t('settings.cli.incompatible'));
        }
        SettingsPanel.compatibilityRepair ??= installCliUpdate(false);
        if (!await SettingsPanel.compatibilityRepair) {
            throw new Error(t('settings.cli.incompatible'));
        }

        try {
            return await this.runCommand(getExecutablePath(configured), args, input);
        } catch (error) {
            if (isSettingsProtocolMismatch(error)) {
                throw new Error(t('settings.cli.incompatible'));
            }
            throw error;
        }
    }

    private runCommand(binary: string, args: string[], input?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const child = cp.execFile(
                binary,
                args,
                {
                    cwd: this.workspaceRoot,
                    timeout: 30_000,
                    windowsHide: true,
                    maxBuffer: 5 * 1024 * 1024,
                },
                (error, stdout, stderr) => {
                    if (error) {
                        reject(new Error(stderr.trim() || error.message));
                        return;
                    }
                    resolve(stdout.trim());
                },
            );
            if (input !== undefined) {
                child.stdin?.end(input);
            }
        });
    }

    // ── HTML ──────────────────────────────────────────────

    private getHtml(
        global: GitAiConfig,
        project: GitAiConfig,
        merged: Required<GitAiConfig>,
        hookState: boolean,
    ): string {
        const nonce = crypto.randomBytes(16).toString('base64');
        const resources = vscode.Uri.joinPath(this.extensionUri, 'resources');
        const codiconsUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(resources, 'codicons', 'codicon.css'),
        );
        const styleUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(resources, 'settings.css'));
        const scriptUri = this.panel.webview.asWebviewUri(vscode.Uri.joinPath(resources, 'settings.js'));
        const initialData = this.serializeForHtml({
            apiKeyConfigured: global.api_key_configured === true,
            apiKeyLabel: t('settings.field.apiKey'),
            disabledHint: t('settings.hint.disabledTemplate'),
        });

        return /* html */ `<!DOCTYPE html>
<html lang="${this.escapeAttr(vscode.env.language)}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${this.panel.webview.cspSource}; style-src ${this.panel.webview.cspSource}; script-src 'nonce-${nonce}';">
    <link href="${codiconsUri}" rel="stylesheet">
    <link href="${styleUri}" rel="stylesheet">
    <title>${this.escapeHtml(t('settings.title'))}</title>
</head>
<body>
    <div class="page-shell">
        <header class="page-header">
            <div class="brand-lockup">
                <span class="brand-mark" aria-hidden="true"><i class="codicon codicon-git-commit"></i></span>
                <div>
                    <h1>${this.escapeHtml(t('settings.title'))}</h1>
                    <p class="subtitle">${this.escapeHtml(t('settings.subtitle'))}</p>
                </div>
            </div>
            <div class="scope-tabs" role="tablist" aria-label="${this.escapeAttr(t('settings.title'))}">
                ${this.renderTab('global', 'globe', t('settings.tab.global'), t('settings.badge.shared'), true)}
                ${this.renderTab('project', 'folder', t('settings.tab.project'), t('settings.badge.override'), false)}
            </div>
        </header>

        ${this.renderGlobalPane(global)}
        ${this.renderProjectPane(project, merged, hookState, global.api_key_configured === true)}
    </div>

    <script id="settings-data" type="application/json">${initialData}</script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    private renderTab(scope: string, icon: string, label: string, badge: string, selected: boolean): string {
        return `<button
            class="scope-tab"
            type="button"
            role="tab"
            id="tab-${scope}"
            data-tab="${scope}"
            aria-controls="pane-${scope}"
            aria-selected="${selected}"
            tabindex="${selected ? '0' : '-1'}">
            <i class="codicon codicon-${icon}" aria-hidden="true"></i>
            <span>${this.escapeHtml(label)}</span>
            <span class="tab-badge">${this.escapeHtml(badge)}</span>
        </button>`;
    }

    private renderGlobalPane(global: GitAiConfig): string {
        const provider = global.provider || DEFAULTS.provider;
        const model = global.model || DEFAULTS.model;
        const format = global.message_format || DEFAULTS.message_format;
        const keyConfigured = global.api_key_configured === true;

        return `<main
            id="pane-global"
            class="scope-pane is-active"
            role="tabpanel"
            aria-labelledby="tab-global">
            ${this.renderOverview(provider, model, format, keyConfigured)}
            <form novalidate>
                ${this.renderSection('key', t('settings.section.auth'), `
                    ${this.renderSelect('g', 'provider', t('settings.field.provider'), ['openai', 'ollama', 'anthropic', 'gemini'], DEFAULTS.provider, global.provider, '')}
                    ${this.renderField('g', 'model', t('settings.field.model'), 'text', DEFAULTS.model, global.model, '')}
                    ${this.renderField('g', 'base_url', t('settings.field.baseUrl'), 'url', DEFAULTS.base_url, global.base_url, '', '', { span: 2 })}
                    ${this.renderField('g', 'api_key', t('settings.field.apiKey'), 'password', '', global.api_key, '', t('settings.hint.apiKey'), { span: 2, configured: keyConfigured })}
                `)}

                ${this.renderSection('edit', t('settings.section.format'), `
                    ${this.renderSelect('g', 'message_format', t('settings.field.messageFormat'), ['conventional', 'plain', 'gitmoji', 'subject-body'], DEFAULTS.message_format, global.message_format, '')}
                    ${this.renderSelect('g', 'language', t('settings.field.language'), ['en', 'zh-CN', 'ja', 'ko', 'es', 'fr', 'de'], DEFAULTS.language, global.language, '')}
                    ${this.renderToggle('g', 'smart_skip', t('settings.field.smartSkip'), global.smart_skip ?? DEFAULTS.smart_skip, t('settings.hint.smartSkip'))}
                    ${this.renderToggle('g', 'explain', t('settings.field.explain'), global.explain ?? DEFAULTS.explain, t('settings.hint.explain'))}
                    ${this.renderField('g', 'prompt_template', t('settings.field.promptTemplate'), 'text', '', global.prompt_template, '', t('settings.hint.promptTemplate'), { span: 2, multiline: true })}
                `)}

                ${this.renderSection('git-pull-request', t('settings.section.behavior'), `
                    ${this.renderSelect('g', 'push_policy', t('settings.field.pushPolicy'), ['queue', 'block'], DEFAULTS.push_policy, global.push_policy, '', t('settings.hint.pushPolicy'))}
                    ${this.renderSelect('g', 'log_level', t('settings.field.logLevel'), ['error', 'info', 'debug'], DEFAULTS.log_level, global.log_level, '')}
                    ${this.renderField('g', 'max_diff_tokens', t('settings.field.maxDiffTokens'), 'number', String(DEFAULTS.max_diff_tokens), global.max_diff_tokens?.toString(), '', t('settings.hint.maxDiffTokens'), { min: 1, max: 100000 })}
                    ${this.renderSelect('g', 'ui_language', t('settings.field.uiLanguage'), ['', 'en', 'zh'], '', global.ui_language, '', t('settings.hint.uiLanguage'))}
                `)}

                ${this.renderActionBar('global', t('settings.btn.saveGlobal'))}
            </form>
        </main>`;
    }

    private renderProjectPane(
        project: GitAiConfig,
        merged: Required<GitAiConfig>,
        hookState: boolean,
        keyConfigured: boolean,
    ): string {
        const provider = project.provider || merged.provider;
        const model = project.model || merged.model;
        const format = project.message_format || merged.message_format;

        return `<main
            id="pane-project"
            class="scope-pane"
            role="tabpanel"
            aria-labelledby="tab-project"
            hidden>
            ${this.renderOverview(provider, model, format, keyConfigured)}
            <div class="project-note">
                <i class="codicon codicon-info" aria-hidden="true"></i>
                <span>${this.escapeHtml(t('settings.hint.projectNote'))}</span>
            </div>
            <form novalidate>
                ${this.renderSection('plug', t('settings.field.projectEnabled'), `
                    ${this.renderToggle('p', 'install_hook', t('settings.field.projectEnabled'), hookState, t('settings.hint.projectEnabled'), true)}
                `)}

                ${this.renderSection('key', t('settings.section.auth'), `
                    ${this.renderSelect('p', 'provider', t('settings.field.provider'), ['', 'openai', 'ollama', 'anthropic', 'gemini'], '', project.provider, merged.provider)}
                    ${this.renderField('p', 'model', t('settings.field.model'), 'text', '', project.model, merged.model)}
                    ${this.renderField('p', 'base_url', t('settings.field.baseUrl'), 'url', '', project.base_url, merged.base_url, '', { span: 2 })}
                `)}

                ${this.renderSection('edit', t('settings.section.format'), `
                    ${this.renderSelect('p', 'message_format', t('settings.field.messageFormat'), ['', 'conventional', 'plain', 'gitmoji', 'subject-body'], '', project.message_format, merged.message_format)}
                    ${this.renderSelect('p', 'language', t('settings.field.language'), ['', 'en', 'zh-CN', 'ja', 'ko', 'es', 'fr', 'de'], '', project.language, merged.language)}
                    ${this.renderSelect('p', 'smart_skip', t('settings.field.smartSkip'), ['', 'true', 'false'], '', project.smart_skip?.toString(), String(merged.smart_skip), t('settings.hint.smartSkip'))}
                    ${this.renderSelect('p', 'explain', t('settings.field.explain'), ['', 'true', 'false'], '', project.explain?.toString(), String(merged.explain), t('settings.hint.explain'))}
                    ${this.renderField('p', 'prompt_template', t('settings.field.promptTemplate'), 'text', '', project.prompt_template, merged.prompt_template, t('settings.hint.promptTemplate'), { span: 2, multiline: true })}
                `)}

                ${this.renderSection('git-pull-request', t('settings.section.behavior'), `
                    ${this.renderSelect('p', 'push_policy', t('settings.field.pushPolicy'), ['', 'queue', 'block'], '', project.push_policy, merged.push_policy, t('settings.hint.pushPolicy'))}
                    ${this.renderSelect('p', 'log_level', t('settings.field.logLevel'), ['', 'error', 'info', 'debug'], '', project.log_level, merged.log_level)}
                    ${this.renderField('p', 'max_diff_tokens', t('settings.field.maxDiffTokens'), 'number', '', project.max_diff_tokens?.toString(), String(merged.max_diff_tokens), t('settings.hint.maxDiffTokens'), { min: 1, max: 100000 })}
                    ${this.renderSelect('p', 'ui_language', t('settings.field.uiLanguage'), ['', 'en', 'zh'], '', project.ui_language, merged.ui_language, t('settings.hint.uiLanguage'))}
                `)}

                ${this.renderActionBar('project', t('settings.btn.saveProject'))}
            </form>
        </main>`;
    }

    private renderOverview(
        provider: string,
        model: string,
        format: string,
        keyConfigured: boolean,
    ): string {
        const ready = provider === 'ollama' || keyConfigured;
        const credentialLabel = provider === 'ollama' ? 'Ollama' : t('settings.field.apiKey');
        return `<div class="overview" aria-live="polite">
            <div class="overview-item">
                <span class="overview-label">${this.escapeHtml(t('settings.field.provider'))}</span>
                <strong class="overview-value" data-summary="provider">${this.escapeHtml(provider)}</strong>
            </div>
            <div class="overview-item">
                <span class="overview-label">${this.escapeHtml(t('settings.field.model'))}</span>
                <strong class="overview-value" data-summary="model">${this.escapeHtml(model)}</strong>
            </div>
            <div class="overview-item">
                <span class="overview-label">${this.escapeHtml(t('settings.field.messageFormat'))}</span>
                <strong class="overview-value" data-summary="format">${this.escapeHtml(format)}</strong>
            </div>
            <div class="connection-state ${ready ? 'is-ready' : ''}" title="${this.escapeAttr(t('settings.hint.apiKey'))}">
                <span class="state-dot" aria-hidden="true"></span>
                <span data-summary="credential">${this.escapeHtml(credentialLabel)}</span>
            </div>
        </div>`;
    }

    private renderSection(icon: string, title: string, content: string): string {
        return `<section class="settings-section">
            <header class="section-header">
                <span class="section-icon" aria-hidden="true"><i class="codicon codicon-${icon}"></i></span>
                <h2>${this.escapeHtml(title)}</h2>
            </header>
            <div class="field-grid">${content}</div>
        </section>`;
    }

    private renderActionBar(scope: 'global' | 'project', saveLabel: string): string {
        return `<footer class="action-bar">
            <button class="btn btn-danger" type="button" data-action="reset" data-config-scope="${scope}">
                <i class="codicon codicon-discard" aria-hidden="true"></i>
                ${this.escapeHtml(t('settings.btn.reset'))}
            </button>
            <span class="dirty-indicator" title="${this.escapeAttr(saveLabel)}" aria-hidden="true"></span>
            <span class="action-spacer"></span>
            <button class="btn btn-quiet" type="button" data-action="test" data-config-scope="${scope}">
                <i class="codicon codicon-debug-start" aria-hidden="true"></i>
                ${this.escapeHtml(t('settings.btn.testConfig'))}
            </button>
            <button class="btn btn-primary" type="button" data-action="save" data-config-scope="${scope}" disabled>
                <i class="codicon codicon-check" aria-hidden="true"></i>
                ${this.escapeHtml(saveLabel)}
            </button>
        </footer>`;
    }

    private renderField(
        prefix: string,
        key: string,
        label: string,
        type: string,
        defaultValue: string,
        currentValue: string | undefined,
        inheritedValue: string,
        hint = '',
        options: FieldOptions = {},
    ): string {
        const value = currentValue ?? '';
        const effective = value || inheritedValue || defaultValue;
        const id = `field_${prefix}_${key}`;
        const hintId = `${id}_hint`;
        const spanClass = options.span === 2 ? ' field-span-2' : '';
        const placeholder = options.configured
            ? '••••••••'
            : prefix === 'p' && inheritedValue
                ? inheritedValue
                : defaultValue;
        const describedBy = hint ? ` aria-describedby="${hintId}"` : '';
        const bounds = [
            options.min !== undefined ? ` min="${options.min}"` : '',
            options.max !== undefined ? ` max="${options.max}"` : '',
        ].join('');
        const common = `id="${id}" data-scope="${prefix}" data-key="${key}" data-effective="${this.escapeAttr(effective)}"${describedBy}`;

        let control: string;
        if (options.multiline) {
            control = `<textarea ${common} placeholder="${this.escapeAttr(placeholder)}" spellcheck="false">${this.escapeHtml(value)}</textarea>`;
        } else {
            const secretClass = type === 'password' ? ' class="secret-input"' : '';
            control = `<input type="${type}" ${common}${secretClass}${bounds}
                value="${this.escapeAttr(value)}"
                placeholder="${this.escapeAttr(placeholder)}"
                autocomplete="off"
                spellcheck="false">`;
            if (type === 'password') {
                control = `<div class="control-wrap">${control}
                    <button class="secret-toggle" type="button" data-secret-toggle aria-controls="${id}" aria-label="${this.escapeAttr(label)}">
                        <i class="codicon codicon-eye" aria-hidden="true"></i>
                    </button>
                </div>`;
            }
        }

        return `<div class="field${spanClass}" data-field-key="${key}">
            <div class="field-heading"><label for="${id}">${this.escapeHtml(label)}</label></div>
            ${control}
            ${hint ? `<div class="hint" id="${hintId}">${this.escapeHtml(hint)}</div>` : ''}
            ${prefix === 'p' && inheritedValue && !value ? `<span class="inherited">${this.escapeHtml(t('settings.inherit.label'))}</span>` : ''}
        </div>`;
    }

    private renderSelect(
        prefix: string,
        key: string,
        label: string,
        options: string[],
        defaultValue: string,
        currentValue: string | undefined,
        inheritedValue: string,
        hint = '',
    ): string {
        const value = currentValue ?? (prefix === 'g' ? defaultValue : '');
        const effective = value || inheritedValue || defaultValue;
        const id = `field_${prefix}_${key}`;
        const hintId = `${id}_hint`;
        const optionsHtml = options.map(option => {
            const display = option === ''
                ? inheritedValue
                    ? t('settings.inherit.val', inheritedValue)
                    : t('settings.inherit.empty')
                : option;
            return `<option value="${this.escapeAttr(option)}" ${value === option ? 'selected' : ''}>${this.escapeHtml(display)}</option>`;
        }).join('');

        return `<div class="field" data-field-key="${key}">
            <div class="field-heading"><label for="${id}">${this.escapeHtml(label)}</label></div>
            <select
                id="${id}"
                data-scope="${prefix}"
                data-key="${key}"
                data-effective="${this.escapeAttr(effective)}"
                ${hint ? `aria-describedby="${hintId}"` : ''}>
                ${optionsHtml}
            </select>
            ${hint ? `<div class="hint" id="${hintId}">${this.escapeHtml(hint)}</div>` : ''}
            ${prefix === 'p' && !value && inheritedValue ? `<span class="inherited">${this.escapeHtml(t('settings.inherit.label'))}</span>` : ''}
        </div>`;
    }

    private renderToggle(
        prefix: string,
        key: string,
        label: string,
        checked: boolean,
        hint: string,
        installHook = false,
    ): string {
        const id = `field_${prefix}_${key}`;
        const spanClass = installHook ? ' field-span-2' : '';
        return `<div class="field toggle-field${spanClass}" data-field-key="${key}">
            <div class="toggle-copy">
                <label class="field-label" for="${id}">${this.escapeHtml(label)}</label>
                <div class="hint" id="${id}_hint">${this.escapeHtml(hint)}</div>
            </div>
            <label class="switch" aria-label="${this.escapeAttr(label)}">
                <input
                    id="${id}"
                    type="checkbox"
                    data-scope="${prefix}"
                    data-key="${key}"
                    ${installHook ? '' : 'data-value-type="boolean"'}
                    data-effective="${checked}"
                    aria-describedby="${id}_hint"
                    ${checked ? 'checked' : ''}>
                <span class="switch-track" aria-hidden="true"></span>
            </label>
        </div>`;
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private escapeAttr(value: string): string {
        return this.escapeHtml(value);
    }

    private serializeForHtml(value: unknown): string {
        return (JSON.stringify(value) || '{}')
            .replace(/</g, '\\u003c')
            .replace(/\u2028/g, '\\u2028')
            .replace(/\u2029/g, '\\u2029');
    }
}
