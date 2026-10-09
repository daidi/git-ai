import * as vscode from 'vscode';
import { fetchLatestTag, installCliUpdate } from './installer';
import { cliRuntime, CliRuntime, runSettingsCli } from './cliSettings';
import { parseConfig, parseSchema, SettingsProtocolError } from './settingsProtocol';
import { emptyCache, isNewer, shouldFetch, stableVersion, UpdateCache } from './updatePolicy';
import { t } from './i18n';

export interface UpdateResult { key: string; latest?: string }
export function updateMessage(result: UpdateResult, info: CliRuntime): string {
    return result.latest ? t(result.key, info.version || '—', result.latest) : t(result.key);
}

/** One service per extension host. Checks never install or change the selected executable. */
export class CliUpdateService implements vscode.Disposable {
    private checking = false;
    private disposed = false;
    private healthItem?: vscode.StatusBarItem;
    private readonly warned = new Set<string>();
    constructor(private readonly state: vscode.Memento) {}

    async check(info: CliRuntime, manual: boolean): Promise<UpdateResult> {
        if (this.disposed || !vscode.workspace.isTrusted || !info.version) return { key: 'settings.cli.unavailable' };
        if (!stableVersion(info.version)) return { key: 'settings.cli.development' };
        if (this.checking) return { key: 'settings.cli.busy' };
        this.checking = true;
        try {
            const saved = this.state.get<UpdateCache>('git-ai.update.v2');
            let cache = saved && typeof saved.identity === 'string' && typeof saved.latest === 'string' &&
                Number.isFinite(saved.lastSuccess) && Number.isFinite(saved.lastFailure) ? saved : emptyCache();
            if (shouldFetch(cache, info.identity, Date.now(), manual)) {
                if (cache.identity !== info.identity) cache = emptyCache(info.identity);
                try {
                    const latest = (await fetchLatestTag()).replace(/^v/, '');
                    if (!stableVersion(latest)) throw new Error('Invalid release');
                    cache = { ...cache, latest, lastSuccess: Date.now(), lastFailure: 0 };
                } catch { cache = { ...cache, lastFailure: Date.now() }; }
                if (this.disposed || !vscode.workspace.isTrusted) return { key: 'settings.cli.unavailable' };
                await this.state.update('git-ai.update.v2', cache);
            }
            if (cache.lastFailure > 0 && cache.lastFailure >= cache.lastSuccess) return { key: 'settings.cli.checkFailed' };
            return isNewer(info.version, cache.latest)
                ? { key: 'notification.updateAvailable', latest: cache.latest } : { key: 'settings.cli.upToDate' };
        } catch { return { key: 'settings.cli.checkFailed' }; }
        finally { this.checking = false; }
    }

    async checkOnStartup(cwd?: string, manual = false): Promise<void> {
        if (this.disposed || !vscode.workspace.isTrusted) return;
        let info: CliRuntime;
        try { info = await cliRuntime(); } catch { return; }
        try {
            // Mandatory local negotiation precedes optional release queries and cooldowns.
            parseSchema(await runSettingsCli(info.path, ['config', 'schema'], cwd));
        } catch (error) {
            if (this.disposed || !vscode.workspace.isTrusted) return;
            const message = t(error instanceof SettingsProtocolError ? 'settings.cli.incompatible' : 'settings.cli.unavailable');
            this.healthItem ??= vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
            this.healthItem.text = '$(warning) Git AI';
            this.healthItem.tooltip = message;
            this.healthItem.command = 'git-ai.openConfig';
            this.healthItem.show();
            if (!this.warned.has(info.identity)) {
                this.warned.add(info.identity);
                void vscode.window.showWarningMessage(message, t('settings.cli.retry'), t('notification.updateNow')).then(async selection => {
                    if (this.disposed || !vscode.workspace.isTrusted) return;
                    if (selection === t('settings.cli.retry')) {
                        this.warned.delete(info.identity);
                        await this.checkOnStartup(cwd, true);
                    } else if (selection === t('notification.updateNow') && await this.install(info)) {
                        await this.checkOnStartup(cwd);
                    }
                });
            }
            return;
        }
        if (this.disposed || !vscode.workspace.isTrusted) return;
        this.clearHealth();
        if (!manual) {
            try {
                if (parseConfig(await runSettingsCli(info.path, ['config', 'list', '--scope', 'merged', '--json'], cwd)).check_update === false) return;
            } catch { return; }
        }
        const result = await this.check(info, manual);
        if (this.disposed || !vscode.workspace.isTrusted) return;
        if (result.latest) {
            const selection = await vscode.window.showInformationMessage(updateMessage(result, info), t('notification.updateNow'), t('notification.updateDismiss'));
            if (!this.disposed && selection === t('notification.updateNow') && await this.install(info)) await this.checkOnStartup(cwd);
        } else if (manual) void vscode.window.showInformationMessage(updateMessage(result, info));
    }

    async install(info: CliRuntime): Promise<boolean> {
        if (this.disposed || !vscode.workspace.isTrusted) return false;
        // A notification may outlive a binary-path change. Never silently switch
        // a newly selected custom executable to the managed installation.
        const configured = vscode.workspace.getConfiguration('git-ai').get<string>('binaryPath') || 'git-ai';
        if (!info.managed || configured !== 'git-ai') {
            void vscode.window.showWarningMessage(t('settings.cli.customPath'));
            return false;
        }
        try {
            const success = await installCliUpdate();
            if (this.disposed || !vscode.workspace.isTrusted) return false;
            if (success) this.clearHealth();
            return success;
        } catch {
            if (!this.disposed) void vscode.window.showWarningMessage(t('settings.cli.unavailable'));
            return false;
        }
    }
    clearHealth(): void { this.healthItem?.hide(); this.warned.clear(); }
    dispose(): void { this.disposed = true; this.healthItem?.dispose(); this.warned.clear(); }
}
