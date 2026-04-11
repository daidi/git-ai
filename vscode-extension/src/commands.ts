import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { LogViewer } from './logViewer';
import { notifyInfo, notifyError, notifyWarning } from './notifications';

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
            notifyInfo('🎉 git-ai initialized!');
        } else {
            notifyError(`git-ai init failed: ${result.error}`);
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
                    notifyInfo('✨ git-ai: Commit message re-generated!');
                } else {
                    notifyError(`git-ai retry failed: ${result.error}`);
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
            notifyInfo('⏪ git-ai: Original message restored');
        } else {
            notifyError(`git-ai undo failed: ${result.error}`);
        }
    }

    /**
     * Cancel the currently running AI polishing daemon.
     */
    async cancel(): Promise<void> {
        try {
            const statePath = path.join(this.workspaceRoot, '.git', 'git-ai', 'state.json');
            if (!fs.existsSync(statePath)) {
                notifyWarning('git-ai: No active state found');
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

                notifyInfo('🛑 git-ai: Polishing cancelled');
            } else {
                notifyInfo('git-ai: No polishing in progress');
            }
        } catch (err) {
            notifyError(`git-ai cancel failed: ${err}`);
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

                    notifyInfo('🚀 git-ai: Push completed!');
                } else {
                    notifyError(`Push failed: ${result.error}`);
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
