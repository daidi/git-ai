import * as cp from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { notifyError, notifyInfo, notifyWarning } from './notifications';
import { t } from './i18n';

export function getExecutablePath(binary: string): string {
    if (binary !== 'git-ai') { return binary; }
    const exeName = os.platform() === 'win32' ? 'git-ai.exe' : 'git-ai';
    const homeDir = os.homedir();
    const commonPaths = [
        path.join(homeDir, '.git-ai', 'bin', exeName),
        `/opt/homebrew/bin/${exeName}`,
        `/usr/local/bin/${exeName}`,
        path.join(homeDir, 'go', 'bin', exeName),
        path.join(homeDir, '.cargo', 'bin', exeName),
        `/usr/bin/${exeName}`,
    ];
    return commonPaths.find(candidate => fs.existsSync(candidate)) ?? binary;
}

export async function checkAndPromptInstall(): Promise<void> {
    if (!vscode.workspace.isTrusted) { return; }
    const configured = vscode.workspace.getConfiguration('git-ai').get<string>('binaryPath', 'git-ai');
    const binary = getExecutablePath(configured);
    try {
        await execFile(binary, ['--version'], undefined, 5000);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('ENOENT') || message.includes('not found')) { promptInstall(); }
    }
}

function promptInstall(): void {
    const isMac = os.platform() === 'darwin';
    const options = [t('installer.download'), ...(isMac ? [t('installer.homebrew')] : []), t('installer.go'), t('installer.cancel')];
    void vscode.window.showWarningMessage(t('installer.missing'), ...options).then(selection => {
        if (!selection || selection === t('installer.cancel')) { notifyWarning(t('installer.skipped')); return; }
        if (selection === t('installer.download')) { void installCliAuto(); return; }
        const terminal = vscode.window.createTerminal(t('installer.terminal'));
        terminal.show();
        if (selection === t('installer.homebrew')) { terminal.sendText('brew install daidi/tap/git-ai'); }
        else if (selection === t('installer.go')) { terminal.sendText('go install github.com/daidi/git-ai/cli/cmd/git-ai@latest'); }
    });
}

async function installCliAuto(): Promise<void> {
    if (!vscode.workspace.isTrusted) {
        notifyWarning('Trust this workspace before installing or updating Git AI.');
        return;
    }
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: t('installer.progress'), cancellable: false },
        async progress => {
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-ai-install-'));
            try {
                const platformMap: Record<string, string> = { darwin: 'darwin', linux: 'linux', win32: 'windows' };
                const archMap: Record<string, string> = { x64: 'amd64', arm64: 'arm64' };
                const osName = platformMap[os.platform()];
                const archName = archMap[os.arch()];
                if (!osName || !archName) { throw new Error(`Unsupported platform: ${os.platform()}/${os.arch()}`); }
                const extension = os.platform() === 'win32' ? 'zip' : 'tar.gz';
                const fileName = `git-ai_${osName}_${archName}.${extension}`;
                const tag = await fetchLatestTag();
                const baseUrl = `https://github.com/daidi/git-ai/releases/download/${encodeURIComponent(tag)}`;

                progress.report({ message: t('installer.downloading', fileName) });
                const [archive, checksumFile] = await Promise.all([
                    downloadBuffer(`${baseUrl}/${fileName}`),
                    downloadBuffer(`${baseUrl}/checksums.txt`),
                ]);
                verifyChecksum(fileName, archive, checksumFile.toString('utf8'));

                const archivePath = path.join(tempDir, fileName);
                fs.writeFileSync(archivePath, archive, { mode: 0o600 });
                const exeName = os.platform() === 'win32' ? 'git-ai.exe' : 'git-ai';
                cp.execFileSync('tar', extension === 'zip'
                    ? ['-xf', archivePath, '-C', tempDir, exeName]
                    : ['-xzf', archivePath, '-C', tempDir, exeName],
                { windowsHide: true, stdio: 'ignore' });

                const extracted = path.join(tempDir, exeName);
                if (!fs.existsSync(extracted)) { throw new Error('Downloaded archive did not contain the Git AI executable'); }
                if (os.platform() !== 'win32') { fs.chmodSync(extracted, 0o755); }
                await execFile(extracted, ['--version'], undefined, 5000);

                const binFolder = path.join(os.homedir(), '.git-ai', 'bin');
                fs.mkdirSync(binFolder, { recursive: true, mode: 0o700 });
                const destination = path.join(binFolder, exeName);
                const staged = `${destination}.new-${process.pid}`;
                fs.copyFileSync(extracted, staged);
                if (os.platform() !== 'win32') { fs.chmodSync(staged, 0o755); }
                try {
                    try {
                        fs.renameSync(staged, destination);
                    } catch {
                        // Preserve a working installation if Windows cannot
                        // replace an existing executable atomically.
                        const backup = `${destination}.backup-${process.pid}`;
                        if (!fs.existsSync(destination)) { throw new Error('Unable to install the downloaded CLI'); }
                        fs.renameSync(destination, backup);
                        try {
                            fs.renameSync(staged, destination);
                            fs.unlinkSync(backup);
                        } catch (error) {
                            if (!fs.existsSync(destination) && fs.existsSync(backup)) { fs.renameSync(backup, destination); }
                            throw error;
                        }
                    }
                } finally {
                    if (fs.existsSync(staged)) { fs.unlinkSync(staged); }
                }
                notifyInfo(t('installer.success'));
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                notifyError(t('installer.failed', message));
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        },
    );
}

export async function installCliUpdate(): Promise<void> { await installCliAuto(); }

function verifyChecksum(fileName: string, contents: Buffer, checksums: string): void {
    const expected = checksums.split(/\r?\n/)
        .map(line => line.trim().split(/\s+/))
        .find(parts => parts.length >= 2 && parts[1].replace(/^\*/, '') === fileName)?.[0];
    if (!expected) { throw new Error(`Release checksum is missing for ${fileName}`); }
    if (!/^[0-9a-fA-F]{64}$/.test(expected)) { throw new Error('Release checksum has an invalid format'); }
    const actual = crypto.createHash('sha256').update(contents).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))) {
        throw new Error('Downloaded archive checksum did not match the release checksum');
    }
}

async function fetchLatestTag(): Promise<string> {
    const metadata = await downloadBuffer('https://git-ai.codegg.org/releases/latest');
    let tag: unknown;
    try {
        tag = JSON.parse(metadata.toString('utf8')).tag_name;
    } catch {
        throw new Error('Release service returned invalid metadata');
    }
    if (typeof tag !== 'string' || !/^v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(tag)) {
        throw new Error('Release service returned an invalid version');
    }
    return tag;
}

function downloadBuffer(url: string, redirects = 0): Promise<Buffer> {
    if (redirects > 5) { return Promise.reject(new Error('Too many download redirects')); }
    return new Promise((resolve, reject) => {
        const request = https.get(url, { timeout: 15_000 }, response => {
            if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode)) {
                const location = response.headers.location;
                response.resume();
                if (!location) { reject(new Error('Download redirect had no location')); return; }
                const next = new URL(location, url);
                if (next.protocol !== 'https:') { reject(new Error('Refusing a non-HTTPS download redirect')); return; }
                downloadBuffer(next.toString(), redirects + 1).then(resolve, reject);
                return;
            }
            if (response.statusCode !== 200) {
                response.resume();
                reject(new Error(t('installer.downloadFailed', String(response.statusCode))));
                return;
            }
            const chunks: Buffer[] = [];
            let size = 0;
            response.on('data', (chunk: Buffer) => {
                size += chunk.length;
                if (size > 100 * 1024 * 1024) {
                    request.destroy(new Error('Download exceeded the 100 MB safety limit'));
                    return;
                }
                chunks.push(chunk);
            });
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        });
        request.on('timeout', () => request.destroy(new Error('Download timed out')));
        request.on('error', reject);
    });
}

export async function autoInitialize(workspaceRoot: string): Promise<void> {
    if (!vscode.workspace.isTrusted) { return; }
    try {
        const configured = vscode.workspace.getConfiguration('git-ai').get<string>('binaryPath', 'git-ai');
        const binary = getExecutablePath(configured);
        const status = JSON.parse(await execFile(binary, ['status', '--json'], workspaceRoot, 5000)) as { initialized?: boolean };
        const installed = status.initialized === true;
        if (installed) { return; }
        const confirm = await vscode.window.showInformationMessage(t('installer.prompt'), t('installer.enable'), t('installer.notNow'));
        if (confirm === t('installer.enable')) { await vscode.commands.executeCommand('git-ai.init'); }
    } catch {
        // Not a Git repository or Git is unavailable.
    }
}

function execFile(binary: string, args: string[], cwd?: string, timeout = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
        cp.execFile(binary, args, { cwd, timeout, windowsHide: true }, (error, stdout) => {
            if (error) { reject(error); return; }
            resolve(stdout);
        });
    });
}
