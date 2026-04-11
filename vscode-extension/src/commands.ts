import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { LogViewer } from './logViewer';

/**
 * Manages all git-ai commands callable from the command palette.
 */
export class CommandManager {
    constructor(
        private workspaceRoot: string,
        private logViewer: LogViewer,
    ) {}

    /**
     * Initialize git-ai in the current workspace.
     */
    async init(): Promise<void> {
        const result = await this.runGitAi(['init']);
        if (result.success) {
            vscode.window.showInformationMessage('🎉 git-ai initialized!');
        } else {
            vscode.window.showErrorMessage(`git-ai init failed: ${result.error}`);
        }
    }

    /**
     * Retry AI polishing for the last commit.
     */
    async retry(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            'Re-generate AI commit message for the last commit?',
            'Yes', 'Cancel'
        );
        if (confirm !== 'Yes') { return; }

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'git-ai: Retrying...' },
            async () => {
                const result = await this.runGitAi(['retry']);
                if (result.success) {
                    vscode.window.showInformationMessage('✨ git-ai: Commit message re-generated!');
                } else {
                    vscode.window.showErrorMessage(`git-ai retry failed: ${result.error}`);
                }
            }
        );
    }

    /**
     * Undo AI polishing — restore original message.
     */
    async undo(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            'Restore the original commit message?',
            'Yes', 'Cancel'
        );
        if (confirm !== 'Yes') { return; }

        const result = await this.runGitAi(['undo']);
        if (result.success) {
            vscode.window.showInformationMessage('⏪ git-ai: Original message restored');
        } else {
            vscode.window.showErrorMessage(`git-ai undo failed: ${result.error}`);
        }
    }

    /**
     * Cancel the currently running AI polishing daemon.
     */
    async cancel(): Promise<void> {
        try {
            const statePath = path.join(this.workspaceRoot, '.git', 'git-ai', 'state.json');
            if (!fs.existsSync(statePath)) {
                vscode.window.showWarningMessage('git-ai: No active state found');
                return;
            }

            const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
            if (state.pid && state.current_status === 'polishing') {
                try {
                    process.kill(state.pid, 'SIGTERM');
                } catch {
                    // Process may already be dead.
                }

                // Reset state.
                const resetState = { current_status: 'idle', original_msg: state.original_msg, last_sha: state.last_sha };
                fs.writeFileSync(statePath, JSON.stringify(resetState, null, 2));

                vscode.window.showInformationMessage('🛑 git-ai: Polishing cancelled');
            } else {
                vscode.window.showInformationMessage('git-ai: No polishing in progress');
            }
        } catch (err) {
            vscode.window.showErrorMessage(`git-ai cancel failed: ${err}`);
        }
    }

    /**
     * Force push immediately, bypassing deferred push logic.
     */
    async forcePush(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            'Force push to remote now?',
            'Yes', 'Cancel'
        );
        if (confirm !== 'Yes') { return; }

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'git-ai: Pushing...' },
            async () => {
                // Run git push directly with GIT_AI_INTERNAL to bypass hook.
                const result = await this.runCommand('git', ['push'], {
                    GIT_AI_INTERNAL: 'true',
                });
                if (result.success) {
                    // Clear pending push from state.
                    try {
                        const statePath = path.join(this.workspaceRoot, '.git', 'git-ai', 'state.json');
                        if (fs.existsSync(statePath)) {
                            const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
                            delete state.pending_push;
                            state.current_status = 'idle';
                            fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
                        }
                    } catch { /* ignore */ }

                    vscode.window.showInformationMessage('🚀 git-ai: Push completed!');
                } else {
                    vscode.window.showErrorMessage(`Push failed: ${result.error}`);
                }
            }
        );
    }

    /**
     * Show the git-ai log output channel with the latest daemon log.
     */
    async showLogs(): Promise<void> {
        const logDir = path.join(this.workspaceRoot, '.git', 'git-ai', 'logs');
        this.logViewer.showLatest(logDir);
    }

    /**
     * Open the git-ai configuration file.
     */
    async openConfig(): Promise<void> {
        // Try project config first, then global.
        const projectConfig = path.join(this.workspaceRoot, '.git-ai.json');
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        const globalConfig = path.join(homeDir, '.config', 'git-ai', 'config.json');

        const items: vscode.QuickPickItem[] = [
            { label: '$(file) Project Config', description: '.git-ai.json', detail: projectConfig },
            { label: '$(home) Global Config', description: '~/.config/git-ai/config.json', detail: globalConfig },
        ];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select config file to edit',
        });

        if (selected) {
            const filePath = selected.detail!;
            // Create if doesn't exist.
            if (!fs.existsSync(filePath)) {
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                fs.writeFileSync(filePath, '{\n  \n}\n');
            }
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
        }
    }

    /**
     * Run a git-ai CLI command.
     */
    private runGitAi(args: string[]): Promise<{ success: boolean; output: string; error: string }> {
        const config = vscode.workspace.getConfiguration('git-ai');
        const binary = config.get<string>('binaryPath', 'git-ai');
        return this.runCommand(binary, args);
    }

    /**
     * Run an arbitrary command and capture output.
     */
    private runCommand(
        cmd: string,
        args: string[],
        extraEnv?: Record<string, string>,
    ): Promise<{ success: boolean; output: string; error: string }> {
        return new Promise((resolve) => {
            const env = { ...process.env, ...extraEnv };
            const proc = cp.spawn(cmd, args, {
                cwd: this.workspaceRoot,
                env,
            });

            let stdout = '';
            let stderr = '';

            proc.stdout?.on('data', (data) => { stdout += data.toString(); });
            proc.stderr?.on('data', (data) => { stderr += data.toString(); });

            proc.on('close', (code) => {
                resolve({
                    success: code === 0,
                    output: stdout.trim(),
                    error: stderr.trim(),
                });
            });

            proc.on('error', (err) => {
                resolve({
                    success: false,
                    output: '',
                    error: err.message,
                });
            });
        });
    }
}
