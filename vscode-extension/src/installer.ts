import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as https from 'https';
import { notifyInfo, notifyError, notifyWarning } from './notifications';

export function getExecutablePath(binary: string): string {
    if (binary !== 'git-ai') {
        return binary;
    }

    const isWin = os.platform() === 'win32';
    const exeName = isWin ? 'git-ai.exe' : 'git-ai';
    const homeDir = os.homedir();
    
    const commonPaths = [
        path.join(homeDir, '.git-ai', 'bin', exeName),
        `/opt/homebrew/bin/${exeName}`,
        `/usr/local/bin/${exeName}`,
        path.join(homeDir, 'go', 'bin', exeName),
        path.join(homeDir, '.cargo', 'bin', exeName),
        `/usr/bin/${exeName}`
    ];

    for (const p of commonPaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }

    return binary;
}

export async function checkAndPromptInstall(): Promise<void> {
    const config = vscode.workspace.getConfiguration('git-ai');
    let binary = config.get<string>('binaryPath', 'git-ai');
    binary = getExecutablePath(binary);
    
    return new Promise((resolve) => {
        cp.exec(`${binary} --version`, (err) => {
            if (err && ((err as any).code === 127 || err?.message.includes('ENOENT') || err?.message.includes('not found'))) {
                promptInstall();
            }
            resolve();
        });
    });
}

function promptInstall() {
    vscode.window.showWarningMessage(
        "git-ai CLI was not found in PATH or standard directories.",
        "Download & Install (Auto)",
        "Install via Homebrew",
        "Install via Go",
        "Cancel"
    ).then(selection => {
        if (!selection || selection === "Cancel") {
            notifyWarning("git-ai CLI installation skipped. Some features may not work.");
            return;
        }

        if (selection === "Download & Install (Auto)") {
            installCliAuto();
            return;
        }

        const terminal = vscode.window.createTerminal('git-ai Installer');
        terminal.show();
        
        if (selection === "Install via Homebrew") {
            terminal.sendText('brew install daidi/tap/git-ai');
        } else if (selection === "Install via Go") {
            terminal.sendText('go install github.com/daidi/git-ai/cli/cmd/git-ai@latest');
        }
    });
}

async function installCliAuto() {
    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'git-ai: Installing CLI...', cancellable: false },
        async (progress) => {
            try {
                const platform = os.platform();
                const arch = os.arch();
                
                let osStr = 'linux';
                if (platform === 'darwin') osStr = 'darwin';
                if (platform === 'win32') osStr = 'windows';

                let archStr = 'amd64';
                if (arch === 'arm64') archStr = 'arm64';

                const ext = platform === 'win32' ? 'zip' : 'tar.gz';
                const fileName = `git-ai_${osStr}_${archStr}.${ext}`;
                const downloadUrl = `https://github.com/daidi/git-ai/releases/latest/download/${fileName}`;

                const homeDir = os.homedir();
                const binFolder = path.join(homeDir, '.git-ai', 'bin');
                if (!fs.existsSync(binFolder)) {
                    fs.mkdirSync(binFolder, { recursive: true });
                }

                const archivePath = path.join(os.tmpdir(), fileName);
                
                progress.report({ message: `Downloading ${fileName}...` });
                await downloadFile(downloadUrl, archivePath);

                progress.report({ message: 'Extracting...' });
                const exeName = platform === 'win32' ? 'git-ai.exe' : 'git-ai';
                const destExe = path.join(binFolder, exeName);

                if (platform === 'win32') {
                    cp.execSync(`tar -xf "${archivePath}" -C "${binFolder}" ${exeName}`);
                } else {
                    cp.execSync(`tar -xzf "${archivePath}" -C "${binFolder}" ${exeName}`);
                }

                if (platform !== 'win32') {
                    fs.chmodSync(destExe, '755');
                }
                
                fs.unlinkSync(archivePath);
                notifyInfo("✨ git-ai CLI installed successfully!");
            } catch (err: any) {
                notifyError(`Failed to install CLI: ${err.message}`);
            }
        }
    );
}

function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const req = https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download: ${res.statusCode}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
        req.end();
    });
}
