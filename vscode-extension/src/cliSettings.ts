import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { getExecutablePath } from './installer';
import { isSettingsProtocolMismatch } from './cliCompatibility';
import { SettingsProtocolError } from './settingsProtocol';
import { installedVersion } from './updatePolicy';
import { clientSource } from './clientSource';

export interface CliRuntime { path: string; version?: string; identity: string; managed: boolean }
export function selectedCli(): string {
    return getExecutablePath(vscode.workspace.getConfiguration('git-ai').get<string>('binaryPath') || 'git-ai');
}
export function runSettingsCli(binary: string, args: string[], cwd = os.homedir(), input?: string): Promise<string> {
    if (!vscode.workspace.isTrusted) return Promise.reject(new Error('settings.cli.unavailable'));
    return new Promise((resolve, reject) => {
        const env: NodeJS.ProcessEnv = { ...process.env, GIT_AI_CLIENT: clientSource(vscode.env.appName) };
        // Do not override check_update when reading the user's configuration.
        if (args[0] === '--version') env.GIT_AI_CHECK_UPDATE = 'false';
        const child = cp.execFile(binary, args, { cwd, env, timeout: args[0] === '--version' ? 8_000 : 30_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
            (error, stdout, stderr) => {
                if (!vscode.workspace.isTrusted) { reject(new Error('settings.cli.unavailable')); return; }
                if (error) {
                    reject(isSettingsProtocolMismatch(new Error(stderr)) ? new SettingsProtocolError() : new Error('settings.cli.unavailable'));
                } else resolve(stdout.trim());
            });
        child.stdin?.end(input);
    });
}
export async function cliRuntime(): Promise<CliRuntime> {
    if (!vscode.workspace.isTrusted) throw new Error('settings.cli.unavailable');
    const binary = selectedCli();
    const managed = (vscode.workspace.getConfiguration('git-ai').get<string>('binaryPath') || 'git-ai') === 'git-ai';
    let version: string | undefined;
    try { version = installedVersion(await runSettingsCli(binary, ['--version'])); } catch { /* Show the selected path even if unavailable. */ }
    let modified = 0;
    try { modified = (await fs.promises.stat(binary)).mtimeMs; } catch { /* Missing CLI. */ }
    return { path: binary, version, managed, identity: crypto.createHash('sha256').update(`${binary}|${version}|${modified}`).digest('hex') };
}
