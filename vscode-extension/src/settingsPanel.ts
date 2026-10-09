import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { notifyError, notifyInfo } from './notifications';
import { t } from './i18n';
import { cliRuntime, CliRuntime, runSettingsCli, selectedCli } from './cliSettings';
import { CliUpdateService, updateMessage } from './cliUpdateService';
import { parseConfig, parseSchema, parseModels, SettingsProtocolError } from './settingsProtocol';
import type { GitAiConfig, ConfigSchema, ConfigFieldSchema } from './settingsProtocol';

interface SettingsMessage {
    command: 'save' | 'reset' | 'testConfig' | 'load' | 'cliRetry' | 'cliCheck' | 'cliUpdate' | 'draftState' | 'ready';
    dirty?: boolean;
    scope?: 'global' | 'project';
    data?: GitAiConfig & { install_hook?: boolean };
}

interface FieldOptions {
    span?: 1 | 2;
    min?: number;
    max?: number;
    configured?: boolean;
    multiline?: boolean;
    suggestions?: boolean;
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
    commit_attribution: 'off',
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
    private readonly panel: vscode.WebviewPanel;
    private readonly workspaceRoot: string;
    private readonly extensionUri: vscode.Uri;
    private readonly disposables: vscode.Disposable[] = [];
    private schema: ConfigSchema | undefined;
    private configLoaded = false;
    private disposed = false;
    private generation = 0;
    private busy = false;
    private dirty = false;
    private runtime?: CliRuntime;
    private health = t('settings.loading');
    private updateStatus = '';

    private constructor(panel: vscode.WebviewPanel, workspaceRoot: string, extensionUri: vscode.Uri, private readonly updates: CliUpdateService) {
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

        void this.refresh();
    }

    static show(extensionUri: vscode.Uri, workspaceRoot: string, updates: CliUpdateService): void {
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

        SettingsPanel.currentPanel = new SettingsPanel(panel, workspaceRoot, extensionUri, updates);
    }

    private dispose(): void {
        this.disposed = true;
        this.generation++;
        SettingsPanel.currentPanel = undefined;
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }

    // ── CLI-owned configuration ───────────────────────────

    private async readConfig(scope: 'global' | 'local' | 'merged'): Promise<GitAiConfig> {
        const output = await this.runGitAi(['config', 'list', '--scope', scope, '--json']);
        return parseConfig(output);
    }

    private async readSchema(): Promise<ConfigSchema> {
        return parseSchema(await this.runGitAi(['config', 'schema']));
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
        if (this.disposed || !message || !vscode.workspace.isTrusted) return;
        if (message.command === 'draftState') { this.dirty = message.dirty === true; return; }
        if (message.command === 'ready') {
            await this.postCliState();
            if (this.configLoaded) void this.refreshModels(this.generation);
            return;
        }
        if (this.busy) return;
        if (['load', 'cliRetry', 'cliCheck', 'cliUpdate'].includes(message.command)) {
            await this.handleCliAction(message.command);
            return;
        }
        if (!['save', 'reset', 'testConfig'].includes(message.command)) return;
        if (!this.configLoaded) { notifyError(t('settings.cli.unavailable')); return; }
        if (message.command === 'testConfig' && this.dirty) { notifyError(t('settings.test.unsaved')); return; }
        this.busy = true;
        const scope = message.scope === 'project' ? 'project' : 'global';
        const cliScope = scope === 'project' ? 'local' : 'global';
        const scopeName = scope === 'project' ? t('settings.tab.project') : t('settings.tab.global');
        const action = message.command === 'testConfig' ? 'test' : message.command;
        await this.postActionState(scope, action, true);

        try {
            // Re-negotiate immediately before writes in case the CLI was replaced.
            await this.readSchema();
            switch (message.command) {
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
            if (this.disposed) return;
            if (error instanceof SettingsProtocolError) {
                this.configLoaded = false;
                this.health = t('settings.cli.incompatible');
                await this.postCliState();
            }
            notifyError(t(error instanceof SettingsProtocolError ? 'settings.cli.incompatible' : 'settings.cli.unavailable'));
        } finally {
            this.busy = false;
            await this.postActionState(scope, action, false);
            await this.postCliState();
        }
    }

    private postActionState(scope: string, action: string, active: boolean): Thenable<boolean> {
        if (this.disposed) return Promise.resolve(false);
        return this.panel.webview.postMessage({ command: 'actionState', scope, action, active });
    }

    private async refresh(): Promise<void> {
        if (this.disposed || !vscode.workspace.isTrusted) return;
        const generation = ++this.generation;
        this.busy = true;
        this.configLoaded = false;
        this.health = t('settings.loading');
        this.updateStatus = '';
        this.panel.webview.html = this.getHtml({}, {}, DEFAULTS, false);
        try {
            this.runtime = await cliRuntime();
            const schema = await this.readSchema();
            const [global, project, mergedConfig, hookState] = await Promise.all([
                this.readConfig('global'),
                this.readConfig('local'),
                this.readConfig('merged'),
                this.isHookInstalled(),
            ]);
            if (this.disposed || generation !== this.generation) return;
            this.schema = schema;
            this.configLoaded = true;
            this.health = t('settings.cli.compatible', String(schema.version));
            this.updates.clearHealth();
            const merged = { ...this.schemaDefaults(), ...mergedConfig };
            this.panel.webview.html = this.getHtml(global, project, merged, hookState);
        } catch (error) {
            if (this.disposed || generation !== this.generation) return;
            this.health = t(error instanceof SettingsProtocolError ? 'settings.cli.incompatible' : 'settings.cli.unavailable');
            this.panel.webview.html = this.getHtml({}, {}, DEFAULTS, false);
        } finally {
            if (!this.disposed && generation === this.generation) {
                this.busy = false;
                await this.postCliState();
            }
        }
    }

    private async refreshModels(generation: number): Promise<void> {
        try {
            const catalog = parseModels(await this.runGitAi(['config', 'models', '--json']));
            if (this.disposed || generation !== this.generation) return;
            await this.panel.webview.postMessage({ command: 'modelCatalog', catalog });
        } catch {
            // Discovery is optional: users can always type a custom model ID.
        }
    }

    private fieldSchema(key: string): ConfigFieldSchema | undefined {
        return this.schema?.fields.find(field => field.key === key);
    }

    private enumValues(key: string, fallback: string[]): string[] {
        return this.fieldSchema(key)?.enum ?? fallback;
    }

    private schemaDefaults(): Required<GitAiConfig> {
        const defaults = { ...DEFAULTS };
        for (const field of this.schema?.fields ?? []) {
            if (field.default !== undefined && field.key in defaults) {
                (defaults as unknown as Record<string, unknown>)[field.key] = field.default;
            }
        }
        return defaults;
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
        if (this.disposed) throw new Error('settings.cli.unavailable');
        return runSettingsCli(this.runtime?.path || selectedCli(), args, this.workspaceRoot, input);
    }

    private async handleCliAction(command: string): Promise<void> {
        if (command !== 'cliCheck' && this.dirty) { notifyError(t('settings.test.unsaved')); return; }
        if (command === 'load' || command === 'cliRetry') { await this.refresh(); return; }
        this.busy = true;
        this.updateStatus = t('settings.loading');
        await this.postCliState();
        try {
            const info = await cliRuntime();
            if (this.disposed) return;
            if (command === 'cliCheck') {
                this.updateStatus = updateMessage(await this.updates.check(info, true), info);
            } else if (command === 'cliUpdate') {
                if (await this.updates.install(info)) { await this.refresh(); return; }
                this.updateStatus = t(info.managed ? 'settings.cli.unavailable' : 'settings.cli.customPath');
            }
        } catch { this.updateStatus = t('settings.cli.checkFailed'); }
        finally { this.busy = false; await this.postCliState(); }
    }

    private postCliState(): Thenable<boolean> {
        if (this.disposed) return Promise.resolve(false);
        return this.panel.webview.postMessage({ command: 'cliState', busy: this.busy,
            loaded: this.configLoaded, health: this.health, updateStatus: this.updateStatus });
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
            loaded: this.configLoaded,
            busy: this.busy,
            unsavedHint: t('settings.test.unsaved'),
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
                <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" focusable="false"><path d="M6.8 2.75H18.3a3.35 3.35 0 0 1 3.35 3.35v.35a.45.45 0 0 1-.45.45H8a1.9 1.9 0 0 0-1.9 1.9v6.4A1.9 1.9 0 0 0 8 17.1h4.9a.8.8 0 0 1 .57.24l3.1 3.12a.45.45 0 0 1-.32.77H6.8A4.8 4.8 0 0 1 2 16.43V7.55a4.8 4.8 0 0 1 4.8-4.8Z"/><path d="M11.55 10.3h8.8A1.65 1.65 0 0 1 22 11.95v5.75a3.53 3.53 0 0 1-3.53 3.53h-.17a.45.45 0 0 1-.45-.45v-3.42a.8.8 0 0 0-.24-.57l-2.86-2.86a.65.65 0 0 0-.92 0l-.14.14a.65.65 0 0 1-.46.19h-1.68A1.45 1.45 0 0 1 10.1 12.8v-1.05a1.45 1.45 0 0 1 1.45-1.45Z"/></svg></span>
                <div>
                    <h1>${this.escapeHtml(t('settings.title'))}</h1>
                    <p class="subtitle">${this.escapeHtml(t('settings.subtitle'))}</p>
                </div>
            </div>
            <section class="cli-health" aria-live="polite">
                <p>${this.escapeHtml(t('settings.cli.details', this.runtime?.version || '—', this.runtime?.path || '—'))}</p>
                <p id="cli-health">${this.escapeHtml(this.health)}</p>
                <p id="cli-update-status">${this.escapeHtml(this.updateStatus)}</p>
                <div class="cli-actions">
                    <button class="btn btn-quiet" type="button" data-cli-action="cliRetry">${this.escapeHtml(t('settings.cli.retry'))}</button>
                    <button class="btn btn-quiet" type="button" data-cli-action="cliCheck">${this.escapeHtml(t('settings.cli.check'))}</button>
                    <button class="btn btn-primary" type="button" data-cli-action="cliUpdate">${this.escapeHtml(t('notification.updateNow'))}</button>
                </div>
            </section>
            <div class="scope-tabs" role="tablist" aria-label="${this.escapeAttr(t('settings.title'))}">
                ${this.renderTab('global', 'globe', t('settings.tab.global'), t('settings.badge.shared'), true)}
                ${this.renderTab('project', 'folder', t('settings.tab.project'), t('settings.badge.override'), false)}
            </div>
        </header>

        ${this.configLoaded ? this.renderGlobalPane(global) : ''}
        ${this.configLoaded ? this.renderProjectPane(project, merged, hookState, global.api_key_configured === true) : ''}
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
        const defaults = this.schemaDefaults();
        const provider = global.provider || defaults.provider;
        const model = global.model || defaults.model;
        const format = global.message_format || defaults.message_format;
        const keyConfigured = global.api_key_configured === true;

        return `<main
            id="pane-global"
            class="scope-pane is-active"
            role="tabpanel"
            aria-labelledby="tab-global">
            ${this.renderOverview(provider, model, format, keyConfigured)}
            <form novalidate>
                ${this.renderSection('key', t('settings.section.auth'), `
                    ${this.renderSelect('g', 'provider', t('settings.field.provider'), this.enumValues('provider', ['openai', 'ollama', 'anthropic', 'gemini']), defaults.provider, global.provider, '')}
                    ${this.renderField('g', 'model', t('settings.field.model'), 'text', defaults.model, global.model, '', '', { suggestions: true })}
                    ${this.renderField('g', 'base_url', t('settings.field.baseUrl'), 'url', defaults.base_url, global.base_url, '', '', { span: 2 })}
                    ${this.renderField('g', 'api_key', t('settings.field.apiKey'), 'password', '', global.api_key, '', t('settings.hint.apiKey'), { span: 2, configured: keyConfigured })}
                `)}

                ${this.renderSection('edit', t('settings.section.format'), `
                    ${this.renderSelect('g', 'message_format', t('settings.field.messageFormat'), this.enumValues('message_format', ['conventional', 'plain', 'gitmoji', 'subject-body']), defaults.message_format, global.message_format, '')}
                    ${this.renderSelect('g', 'commit_attribution', t('settings.field.commitAttribution'), this.enumValues('commit_attribution', ['off', 'compact']), defaults.commit_attribution, global.commit_attribution, '', t('settings.hint.commitAttribution'))}
                    ${this.renderSelect('g', 'language', t('settings.field.language'), ['en', 'zh-CN', 'ja', 'ko', 'es', 'fr', 'de', 'ms'], DEFAULTS.language, global.language, '')}
                    ${this.renderToggle('g', 'smart_skip', t('settings.field.smartSkip'), global.smart_skip ?? defaults.smart_skip, t('settings.hint.smartSkip'))}
                    ${this.renderToggle('g', 'explain', t('settings.field.explain'), global.explain ?? defaults.explain, t('settings.hint.explain'))}
                    ${this.renderField('g', 'prompt_template', t('settings.field.promptTemplate'), 'text', '', global.prompt_template, '', t('settings.hint.promptTemplate'), { span: 2, multiline: true })}
                `)}

                ${this.renderSection('git-pull-request', t('settings.section.behavior'), `
                    ${this.renderSelect('g', 'push_policy', t('settings.field.pushPolicy'), this.enumValues('push_policy', ['queue', 'block']), defaults.push_policy, global.push_policy, '', t('settings.hint.pushPolicy'))}
                    ${this.renderSelect('g', 'log_level', t('settings.field.logLevel'), this.enumValues('log_level', ['error', 'info', 'debug']), defaults.log_level, global.log_level, '')}
                    ${this.renderField('g', 'max_diff_tokens', t('settings.field.maxDiffTokens'), 'number', String(defaults.max_diff_tokens), global.max_diff_tokens?.toString(), '', t('settings.hint.maxDiffTokens'), { min: this.fieldSchema('max_diff_tokens')?.minimum ?? 1, max: this.fieldSchema('max_diff_tokens')?.maximum ?? 100000 })}
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
                    ${this.renderSelect('p', 'provider', t('settings.field.provider'), ['', ...this.enumValues('provider', ['openai', 'ollama', 'anthropic', 'gemini'])], '', project.provider, merged.provider)}
                    ${this.renderField('p', 'model', t('settings.field.model'), 'text', '', project.model, merged.model, '', { suggestions: true })}
                    ${this.renderField('p', 'base_url', t('settings.field.baseUrl'), 'url', '', project.base_url, merged.base_url, '', { span: 2 })}
                `)}

                ${this.renderSection('edit', t('settings.section.format'), `
                    ${this.renderSelect('p', 'message_format', t('settings.field.messageFormat'), ['', ...this.enumValues('message_format', ['conventional', 'plain', 'gitmoji', 'subject-body'])], '', project.message_format, merged.message_format)}
                    ${this.renderSelect('p', 'commit_attribution', t('settings.field.commitAttribution'), ['', ...this.enumValues('commit_attribution', ['off', 'compact'])], '', project.commit_attribution, merged.commit_attribution, t('settings.hint.commitAttribution'))}
                    ${this.renderSelect('p', 'language', t('settings.field.language'), ['', 'en', 'zh-CN', 'ja', 'ko', 'es', 'fr', 'de', 'ms'], '', project.language, merged.language)}
                    ${this.renderSelect('p', 'smart_skip', t('settings.field.smartSkip'), ['', 'true', 'false'], '', project.smart_skip?.toString(), String(merged.smart_skip), t('settings.hint.smartSkip'))}
                    ${this.renderSelect('p', 'explain', t('settings.field.explain'), ['', 'true', 'false'], '', project.explain?.toString(), String(merged.explain), t('settings.hint.explain'))}
                    ${this.renderField('p', 'prompt_template', t('settings.field.promptTemplate'), 'text', '', project.prompt_template, merged.prompt_template, t('settings.hint.promptTemplate'), { span: 2, multiline: true })}
                `)}

                ${this.renderSection('git-pull-request', t('settings.section.behavior'), `
                    ${this.renderSelect('p', 'push_policy', t('settings.field.pushPolicy'), ['', ...this.enumValues('push_policy', ['queue', 'block'])], '', project.push_policy, merged.push_policy, t('settings.hint.pushPolicy'))}
                    ${this.renderSelect('p', 'log_level', t('settings.field.logLevel'), ['', ...this.enumValues('log_level', ['error', 'info', 'debug'])], '', project.log_level, merged.log_level)}
                    ${this.renderField('p', 'max_diff_tokens', t('settings.field.maxDiffTokens'), 'number', '', project.max_diff_tokens?.toString(), String(merged.max_diff_tokens), t('settings.hint.maxDiffTokens'), { min: this.fieldSchema('max_diff_tokens')?.minimum ?? 1, max: this.fieldSchema('max_diff_tokens')?.maximum ?? 100000 })}
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
            const listId = options.suggestions ? `model-options-${prefix}` : '';
            control = `<input type="${type}" ${common}${secretClass}${bounds}${listId ? ` list="${listId}"` : ''}
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
            if (listId) {
                control += `<datalist id="${listId}" data-model-options></datalist>`;
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
