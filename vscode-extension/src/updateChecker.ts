import * as vscode from 'vscode';
import * as cp from 'child_process';
import { fetchLatestTag, getExecutablePath, installCliUpdate } from './installer';
import { t } from './i18n';

/**
 * IDE-side update checker that works independently of the CLI.
 * This ensures users on old CLI versions without the status API still get
 * update notifications from the IDE.
 *
 * Called once during extension activation. Respects a 24h cooldown stored
 * in VS Code globalState to avoid spamming the GitHub API.
 */
export async function checkForCliUpdate(context: vscode.ExtensionContext): Promise<void> {
    if (!vscode.workspace.isTrusted) { return; }
    try {
        // Respect 24h cooldown.
        const lastCheck = context.globalState.get<number>('git-ai.lastUpdateCheck', 0);
        const ONE_DAY = 24 * 60 * 60 * 1000;
        if (Date.now() - lastCheck < ONE_DAY) {
            return;
        }

        // 1. Get installed CLI version.
        const currentVersion = await getInstalledCliVersion();
        if (!currentVersion || currentVersion === 'dev' || currentVersion.includes('-')) {
            return; // Dev build or not installed — skip.
        }

        // 2. Fetch latest release from proxy (same endpoint the CLI uses).
        const latestVersion = (await fetchLatestTag()).replace(/^v/, '');
        if (!latestVersion) {
            return;
        }

        // 3. Record check time regardless of result.
        await context.globalState.update('git-ai.lastUpdateCheck', Date.now());

        // 4. Compare versions.
        if (!isNewer(currentVersion, latestVersion)) {
            return; // Already up to date.
        }

        // 5. Show notification.
        const selection = await vscode.window.showInformationMessage(
            t('notification.updateAvailable', currentVersion, latestVersion),
            t('notification.updateNow'),
            t('notification.updateDismiss'),
        );
        if (selection === t('notification.updateNow')) {
            await installCliUpdate();
        }
    } catch {
        // Silently ignore — update checks should never break the extension.
    }
}

/**
 * Run `git-ai --version` and parse out the semver.
 */
function getInstalledCliVersion(): Promise<string | null> {
    return new Promise((resolve) => {
        const config = vscode.workspace.getConfiguration('git-ai');
        let binary = config.get<string>('binaryPath', 'git-ai');
        binary = getExecutablePath(binary);

        cp.execFile(binary, ['--version'], { timeout: 5000, windowsHide: true }, (err, stdout) => {
            if (err) {
                resolve(null);
                return;
            }
            // Output: "✨ Git-AI CLI v1.2.3" (with possible ANSI codes)
            const stripped = stdout.replace(/\x1b\[[0-9;]*m/g, '').trim();
            const match = stripped.match(/v?(\d+\.\d+\.\d+)/);
            resolve(match ? match[1] : null);
        });
    });
}

/**
 * Simple semver comparison: returns true if latest > current.
 */
function isNewer(current: string, latest: string): boolean {
    const c = current.split('.').map(Number);
    const l = latest.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((l[i] || 0) > (c[i] || 0)) return true;
        if ((l[i] || 0) < (c[i] || 0)) return false;
    }
    return false;
}
