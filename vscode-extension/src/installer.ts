import * as vscode from 'vscode';
import * as cp from 'child_process';
import { notifyWarning } from './notifications';

export async function checkAndPromptInstall(): Promise<void> {
    const config = vscode.workspace.getConfiguration('git-ai');
    const binary = config.get<string>('binaryPath', 'git-ai');
    
    return new Promise((resolve) => {
        // Run a simple command to check if the binary exists and is executable
        cp.exec(`${binary} --version`, (err) => {
            if (err && (err as any).code === 127 || err?.message.includes('ENOENT') || err?.message.includes('not found')) {
                promptInstall();
            }
            resolve();
        });
    });
}

function promptInstall() {
    vscode.window.showWarningMessage(
        "git-ai CLI was not found. It is required for this extension to function correctly.",
        "Install via Homebrew",
        "Install via Go",
        "Cancel"
    ).then(selection => {
        if (!selection || selection === "Cancel") {
            notifyWarning("git-ai CLI installation skipped. Some features may not work.");
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
