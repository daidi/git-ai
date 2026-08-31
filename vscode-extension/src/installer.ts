import * as cp from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import * as vscode from 'vscode';
import { notifyError, notifyInfo, notifyWarning } from './notifications';
import { t } from './i18n';

const MAX_ARCHIVE_BYTES = 150 * 1024 * 1024;
const MAX_METADATA_BYTES = 1024 * 1024;
const MAX_BINARY_BYTES = 100 * 1024 * 1024;

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
                    downloadBuffer(`${baseUrl}/${fileName}`, MAX_ARCHIVE_BYTES),
                    downloadBuffer(`${baseUrl}/checksums.txt`, MAX_METADATA_BYTES),
                ]);
                verifyChecksum(fileName, archive, checksumFile.toString('utf8'));

                const archivePath = path.join(tempDir, fileName);
                fs.writeFileSync(archivePath, archive, { mode: 0o600 });
                const exeName = os.platform() === 'win32' ? 'git-ai.exe' : 'git-ai';
                const extracted = path.join(tempDir, exeName);
                await extractExecutable(archivePath, extension, exeName, extracted);
                if (os.platform() !== 'win32') { fs.chmodSync(extracted, 0o755); }
                await execFile(extracted, ['--version'], undefined, 5000);

                const binFolder = path.join(os.homedir(), '.git-ai', 'bin');
                fs.mkdirSync(binFolder, { recursive: true, mode: 0o700 });
                const destination = path.join(binFolder, exeName);
                const stagingDir = fs.mkdtempSync(path.join(binFolder, '.git-ai-stage-'));
                const staged = path.join(stagingDir, exeName);
                try {
                    fs.copyFileSync(extracted, staged);
                    if (os.platform() !== 'win32') { fs.chmodSync(staged, 0o755); }
                    await execFile(staged, ['--version'], undefined, 5000);
                    try {
                        fs.renameSync(staged, destination);
                    } catch {
                        // Preserve a working installation if Windows cannot
                        // replace an existing executable atomically.
                        const backup = path.join(stagingDir, `${exeName}.previous`);
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
                    fs.rmSync(stagingDir, { recursive: true, force: true });
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
    const matches = checksums.split(/\r?\n/)
        .map(line => line.trim().split(/\s+/))
        .filter(parts => parts.length >= 2 && parts[1].replace(/^\*/, '') === fileName);
    if (matches.length !== 1) { throw new Error(`Release checksum is not unique for ${fileName}`); }
    const expected = matches[0][0];
    if (!/^[0-9a-fA-F]{64}$/.test(expected)) { throw new Error('Release checksum has an invalid format'); }
    const actual = crypto.createHash('sha256').update(contents).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))) {
        throw new Error('Downloaded archive checksum did not match the release checksum');
    }
}

export async function fetchLatestTag(): Promise<string> {
	let lastError: unknown;
	for (const endpoint of [
		'https://git-ai.codegg.org/releases/latest',
		'https://api.github.com/repos/daidi/git-ai/releases/latest',
	]) {
		try {
			const metadata = await downloadBuffer(endpoint, MAX_METADATA_BYTES);
			const tag: unknown = JSON.parse(metadata.toString('utf8')).tag_name;
			if (typeof tag !== 'string' || !/^v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(tag)) {
				throw new Error('Release service returned an invalid version');
			}
			return tag;
		} catch (error) {
			lastError = error;
		}
	}
	throw new Error(`Unable to resolve the latest release: ${errorMessage(lastError)}`);
}

class DownloadError extends Error {
	constructor(message: string, readonly retryable: boolean) { super(message); }
}

async function downloadBuffer(url: string, maxBytes: number): Promise<Buffer> {
	let lastError: unknown;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			return await downloadBufferOnce(url, 0, maxBytes);
		} catch (error) {
			lastError = error;
			if (error instanceof DownloadError && !error.retryable) { throw error; }
			if (attempt < 2) { await delay(500 * (2 ** attempt)); }
		}
	}
	throw new Error(`Download failed after 3 attempts: ${errorMessage(lastError)}`);
}

function downloadBufferOnce(url: string, redirects: number, maxBytes: number): Promise<Buffer> {
	if (redirects > 5) { return Promise.reject(new Error('Too many download redirects')); }
	return new Promise((resolve, reject) => {
		let finished = false;
		const complete = (value: Buffer) => {
			if (finished) { return; }
			finished = true;
			clearTimeout(deadline);
			resolve(value);
		};
		const fail = (error: Error) => {
			if (finished) { return; }
			finished = true;
			clearTimeout(deadline);
			reject(error);
		};
		const request = https.get(url, {
			timeout: 15_000,
			headers: { 'User-Agent': 'git-ai-vscode', Accept: 'application/vnd.github+json' },
		}, response => {
			if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode)) {
				const location = response.headers.location;
				response.resume();
				if (!location) { fail(new DownloadError('Download redirect had no location', false)); return; }
				const next = new URL(location, url);
				if (next.protocol !== 'https:') { fail(new DownloadError('Refusing a non-HTTPS download redirect', false)); return; }
				clearTimeout(deadline);
				downloadBufferOnce(next.toString(), redirects + 1, maxBytes).then(complete, fail);
				return;
			}
			if (response.statusCode !== 200) {
				response.resume();
				const status = response.statusCode ?? 0;
				const retryable = status === 408 || status === 429 || status >= 500;
				fail(new DownloadError(t('installer.downloadFailed', String(status)), retryable));
				return;
			}
            const declaredLength = Number(response.headers['content-length'] ?? 0);
            if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
                response.resume();
                fail(new DownloadError('Download exceeded the safety limit', false));
                return;
            }
            const chunks: Buffer[] = [];
            let size = 0;
            response.on('data', (chunk: Buffer) => {
                size += chunk.length;
				if (size > maxBytes) {
					request.destroy(new DownloadError('Download exceeded the safety limit', false));
					return;
				}
				chunks.push(chunk);
			});
			response.on('end', () => complete(Buffer.concat(chunks)));
			response.on('error', fail);
		});
		const deadline = setTimeout(() => request.destroy(new Error('Download exceeded the 60 second time limit')), 60_000);
		request.on('timeout', () => request.destroy(new Error('Download timed out')));
		request.on('error', fail);
	});
}

async function extractExecutable(archivePath: string, extension: string, entryName: string, destination: string): Promise<void> {
    const listArgs = extension === 'zip' ? ['-tf', archivePath] : ['-tzf', archivePath];
    const entries = (await execFile('tar', listArgs, undefined, 10_000))
        .split(/\r?\n/)
        .filter(entry => entry === entryName);
    if (entries.length !== 1) { throw new Error(`Downloaded archive must contain exactly one ${entryName} entry`); }

    const extractArgs = extension === 'zip'
        ? ['-xOf', archivePath, entryName]
        : ['-xOzf', archivePath, entryName];
    const child = cp.spawn('tar', extractArgs, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    let extractedBytes = 0;
    const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            extractedBytes += chunk.length;
            if (extractedBytes > MAX_BINARY_BYTES) {
                callback(new Error('Extracted executable exceeded the safety limit'));
                return;
            }
            callback(null, chunk);
        },
    });
    const exited = new Promise<void>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', code => code === 0 ? resolve() : reject(new Error('Unable to extract the verified executable')));
    });
    try {
        await Promise.all([
            pipeline(child.stdout, limiter, fs.createWriteStream(destination, { flags: 'wx', mode: 0o600 })),
            exited,
        ]);
        if (extractedBytes === 0) { throw new Error('Extracted executable was empty'); }
    } catch (error) {
        child.kill();
        try { fs.unlinkSync(destination); } catch { /* no partial file */ }
        throw error;
    }
}

function delay(milliseconds: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error ?? 'unknown error');
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
        cp.execFile(binary, args, { cwd, timeout, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }, (error, stdout) => {
            if (error) { reject(error); return; }
            resolve(stdout);
        });
    });
}
