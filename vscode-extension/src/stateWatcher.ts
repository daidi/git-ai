import * as cp from 'child_process';
import * as vscode from 'vscode';
import { getExecutablePath } from './installer';
import { notifyInfo } from './notifications';
import { t } from './i18n';

export interface OperationError {
    code: string;
    category: string;
    message: string;
    retryable: boolean;
    occurred_at: number;
}

export interface GitAiState {
    current_status: 'idle' | 'polishing' | 'pushing' | 'failed';
    original_msg?: string;
    last_sha?: string;
    result_sha?: string;
    target_ref?: string;
    operation_id?: string;
    pending_push?: {
        remote: string;
        updates?: Array<{
            local_ref: string;
            local_sha: string;
            remote_ref: string;
            remote_sha: string;
        }>;
        timestamp: number;
    };
    last_error?: OperationError;
    pid?: number;
    skip_next?: boolean;
    revision?: number;
    state_path?: string;
    log_dir?: string;
    config_path?: string;
    initialized?: boolean;
}

type StateChangeCallback = (state: GitAiState) => void;

/**
 * Observes state through the CLI. The extension never creates, mutates, or
 * assumes paths for runtime files, which keeps it safe for worktrees, remote
 * workspaces, multi-root layouts, and future storage migrations.
 */
export class StateWatcher {
    private pollTimer: NodeJS.Timeout | undefined;
    private pollInFlight = false;
    private callbacks: StateChangeCallback[] = [];
    private currentState: GitAiState = { current_status: 'idle' };
    private hasLoadedState = false;

    constructor(private readonly workspaceRoot: string) {}

    onStateChange(callback: StateChangeCallback): vscode.Disposable {
        this.callbacks.push(callback);
        callback(this.currentState);
        return new vscode.Disposable(() => {
            const index = this.callbacks.indexOf(callback);
            if (index >= 0) { this.callbacks.splice(index, 1); }
        });
    }

    start(): void {
        if (this.pollTimer) { return; }
        void this.readState();
        const configured = vscode.workspace.getConfiguration('git-ai').get<number>('pollingInterval', 1000);
        const interval = Math.min(60_000, Math.max(500, Number.isFinite(configured) ? configured : 1000));
        this.pollTimer = setInterval(() => { void this.readState(); }, interval);
    }

    stop(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = undefined;
        }
        this.callbacks = [];
    }

    getState(): GitAiState { return this.currentState; }
    getLogDir(): string | undefined { return this.currentState.log_dir; }

    private async readState(): Promise<void> {
        if (this.pollInFlight || !vscode.workspace.isTrusted) { return; }
        this.pollInFlight = true;
        try {
            const config = vscode.workspace.getConfiguration('git-ai');
            const configuredBinary = config.get<string>('binaryPath', 'git-ai');
            const binary = getExecutablePath(configuredBinary);
            const stdout = await execFile(binary, ['status', '--json'], this.workspaceRoot, 5000);
            const state = JSON.parse(stdout) as GitAiState;
            if (!state || typeof state.current_status !== 'string') { return; }
            this.emitIfChanged(state);
        } catch {
            // Installation/update can temporarily make the binary unavailable.
            // Keep the last known state rather than reporting a false success.
        } finally {
            this.pollInFlight = false;
        }
    }

    private emitIfChanged(newState: GitAiState): void {
        if (JSON.stringify(newState) === JSON.stringify(this.currentState)) { return; }
        const previous = this.currentState;
        this.currentState = newState;
        for (const callback of [...this.callbacks]) { callback(newState); }

        if (!this.hasLoadedState) {
            this.hasLoadedState = true;
            return;
        }
        if (newState.result_sha && newState.result_sha !== previous.result_sha) {
            notifyInfo(t('notification.polished'));
        }
        if (previous.current_status === 'pushing' && newState.current_status === 'idle' && !newState.pending_push) {
            notifyInfo(t('notification.pushCompleted'));
        }
        if (newState.current_status === 'failed' && newState.last_error?.occurred_at !== previous.last_error?.occurred_at) {
            this.showFailureNotification(newState.last_error);
        }
    }

    private showFailureNotification(error: OperationError | undefined): void {
        const failure = error ?? {
            code: 'unknown',
            category: 'runtime',
            message: 'Git AI stopped safely; the commit and workspace were left unchanged.',
            retryable: false,
            occurred_at: 0,
        };
        const retry = failure.retryable && failure.category !== 'push' ? t('actions.btn.retry') : undefined;
        const configure = ['authentication', 'model', 'config'].includes(failure.category)
            ? t('actions.btn.config')
            : undefined;
        const terminal = failure.category === 'push' ? t('notification.openTerminal') : undefined;
        const actions = [retry, configure, terminal].filter((value): value is string => Boolean(value));

        void vscode.window.showWarningMessage(failure.message, ...actions).then(selection => {
            if (selection === retry) {
                void vscode.commands.executeCommand('git-ai.retry');
            } else if (selection === configure) {
                void vscode.commands.executeCommand('git-ai.openConfig');
            } else if (selection === terminal) {
                vscode.window.createTerminal({ name: 'Git AI', cwd: this.workspaceRoot }).show();
            }
        });
    }
}

function execFile(binary: string, args: string[], cwd: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
        cp.execFile(binary, args, { cwd, timeout, windowsHide: true }, (error, stdout) => {
            if (error) { reject(error); return; }
            resolve(stdout.trim());
        });
    });
}
