import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { LogViewer } from './logViewer';
import { notifyInfo, notifyError, notifyWarning } from './notifications';
import { getExecutablePath } from './installer';
import { t } from './i18n';

/**
 * Manages all git-ai commands callable from the command palette.
 */
export class CommandManager {
	/**
	 * Clean stuck loading prefixes from historical commits.
	 */
	async clean(force: boolean = false): Promise<void> {
		const args = ['clean'];
		if (force) {
			args.push('--force');
		}

		await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: t('cmd.clean.progress') },
			async () => {
				const result = await this.runGitAi(args);
				if (result.success) {
					notifyInfo(t('cmd.clean.success', result.output));
				} else {
					if (result.error.includes("ERR_PUSHED_COMMITS")) {
						// Warning: pushed commits detected
						const confirm = await vscode.window.showWarningMessage(
							t('cmd.clean.pushedWarning'),
							t('cmd.clean.forceYes'), t('cmd.clean.cancel')
						);
						if (confirm === t('cmd.clean.forceYes')) {
							// Try again with force
							await this.clean(true);
						}
					} else {
						notifyError(t('cmd.clean.failed', result.error || result.output));
					}
				}
			}
		);
	}

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
            notifyInfo(t('cmd.init.success'));
        } else {
            notifyError(t('cmd.init.failed', result.error));
        }
    }

    /**
     * Uninstall git-ai hooks from the current workspace.
     */
    async uninstall(): Promise<void> {
        const result = await this.runGitAi(['uninstall']);
        if (result.success) {
            notifyInfo(t('cmd.uninstall.success'));
        } else {
            notifyError(t('cmd.uninstall.failed', result.error));
        }
    }

    /**
     * Retry AI polishing for the last commit.
     */
    async retry(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            t('cmd.retry.confirm'),
            t('cmd.retry.yes'), t('cmd.retry.cancel')
        );
        if (confirm !== t('cmd.retry.yes')) { return; }

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: t('cmd.retry.progress') },
            async () => {
                const result = await this.runGitAi(['retry']);
                if (result.success) {
                    notifyInfo(t('cmd.retry.success'));
                } else {
                    notifyError(t('cmd.retry.failed', result.error));
                }
            }
        );
    }

    /**
     * Undo AI polishing — restore original message.
     */
    async undo(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            t('cmd.undo.confirm'),
            t('cmd.undo.yes'), t('cmd.undo.cancel')
        );
        if (confirm !== t('cmd.undo.yes')) { return; }

        const result = await this.runGitAi(['undo']);
        if (result.success) {
            notifyInfo(t('cmd.undo.success'));
        } else {
            notifyError(t('cmd.undo.failed', result.error));
        }
    }

    /**
     * Cancel the currently running AI polishing daemon.
     */
    async cancel(): Promise<void> {
        try {
            const statePath = path.join(this.workspaceRoot, '.git', 'git-ai', 'state.json');
            if (!fs.existsSync(statePath)) {
                notifyWarning(t('cmd.cancel.noState'));
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

                notifyInfo(t('cmd.cancel.success'));
            } else {
                notifyInfo(t('cmd.cancel.noPolishing'));
            }
        } catch (err) {
            notifyError(t('cmd.cancel.failed', String(err)));
        }
    }

    /**
     * Force push immediately, bypassing deferred push logic.
     */
    async forcePush(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            t('cmd.push.confirm'),
            t('cmd.push.yes'), t('cmd.push.cancel')
        );
        if (confirm !== t('cmd.push.yes')) { return; }

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: t('cmd.push.progress') },
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

                    notifyInfo(t('cmd.push.success'));
                } else {
                    notifyError(t('cmd.push.failed', result.error));
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
     * Skip AI polishing for the next commit/push.
     */
    async skipNextCommit(stateWatcher: import('./stateWatcher').StateWatcher): Promise<void> {
        const currentState = stateWatcher.getState();
        const newState = { ...currentState, skip_next: true };
        stateWatcher.saveState(newState);
        notifyInfo(t('cmd.skipNext.success'));
    }

    /**
     * Test the LLM configuration connectivity.
     */
    async testConfig(): Promise<void> {
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: t('cmd.test.progress') },
            async () => {
                const result = await this.runGitAi(['config', 'test']);
                if (result.success) {
                    vscode.window.showInformationMessage(t('cmd.test.success', result.output), { modal: true });
                } else {
                    vscode.window.showErrorMessage(t('cmd.test.failed', result.error, result.output), { modal: true });
                }
            }
        );
    }

    /**
     * Run a git-ai CLI command.
     */
    private runGitAi(args: string[]): Promise<{ success: boolean; output: string; error: string }> {
        const config = vscode.workspace.getConfiguration('git-ai');
        let binary = config.get<string>('binaryPath', 'git-ai');
        binary = getExecutablePath(binary);
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
