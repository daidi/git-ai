import * as vscode from 'vscode';
import { clientSource } from './clientSource';
import * as cp from 'child_process';
import { LogViewer } from './logViewer';
import { notifyInfo, notifyError, notifyWarning } from './notifications';
import { getExecutablePath } from './installer';
import { t } from './i18n';
import { StateWatcher } from './stateWatcher';

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
        private stateWatcher: StateWatcher,
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
        const result = await this.runGitAi(['cancel']);
        if (result.success) { notifyInfo(result.output || t('cmd.cancel.success')); }
        else { notifyError(t('cmd.cancel.failed', result.error)); }
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
                const result = await this.runGitAi(['push']);
                if (result.success) {
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
        const logDir = this.stateWatcher.getLogDir();
        if (!logDir) { notifyWarning(t('logViewer.noDir')); return; }
        this.logViewer.showLatest(logDir);
    }

    /**
     * Skip AI polishing for the next commit/push.
     */
    async skipNextCommit(): Promise<void> {
        const result = await this.runGitAi(['skip-next']);
        if (result.success) { notifyInfo(t('cmd.skipNext.success')); }
        else { notifyError(result.error); }
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
        if (!vscode.workspace.isTrusted) {
            return Promise.resolve({ success: false, output: '', error: 'Git AI commands are disabled in Restricted Mode.' });
        }
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
            const env = { ...process.env, GIT_AI_CLIENT: clientSource(vscode.env.appName), ...extraEnv };
            const proc = cp.spawn(cmd, args, {
                cwd: this.workspaceRoot,
                env,
                windowsHide: true,
            });

            let stdout = '';
            let stderr = '';
            let outputBytes = 0;
            const maxOutputBytes = 5 * 1024 * 1024;

            const appendOutput = (target: 'stdout' | 'stderr', data: Buffer) => {
                outputBytes += data.length;
                if (outputBytes > maxOutputBytes) {
                    proc.kill();
                    finish({ success: false, output: stdout.trim(), error: 'Command output exceeded the 5 MB safety limit' });
                    return;
                }
                if (target === 'stdout') { stdout += data.toString(); }
                else { stderr += data.toString(); }
            };
            proc.stdout?.on('data', (data: Buffer) => appendOutput('stdout', data));
            proc.stderr?.on('data', (data: Buffer) => appendOutput('stderr', data));

            let settled = false;
            let timer: NodeJS.Timeout | undefined;
            const finish = (result: { success: boolean; output: string; error: string }) => {
                if (settled) { return; }
                settled = true;
                if (timer) { clearTimeout(timer); }
                resolve(result);
            };
            timer = setTimeout(() => {
                proc.kill();
                finish({ success: false, output: stdout.trim(), error: 'Command timed out' });
            }, 60_000);

            proc.on('close', (code) => {
                finish({
                    success: code === 0,
                    output: stdout.trim(),
                    error: stderr.trim(),
                });
            });

            proc.on('error', (err) => {
                finish({
                    success: false,
                    output: '',
                    error: err.message,
                });
            });
        });
    }
}
