import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { notifyInfo } from './notifications';
import { t } from './i18n';

/**
 * Represents the git-ai runtime state from state.json.
 */
export interface GitAiState {
    current_status: 'idle' | 'polishing' | 'pushing';
    original_msg?: string;
    last_sha?: string;
    pending_push?: {
        remote: string;
        ref_specs: string[];
        timestamp: number;
    };
    pid?: number;
}

type StateChangeCallback = (state: GitAiState) => void;

/**
 * Watches .git/git-ai/state.json for changes and emits updates.
 * Uses a combination of fs.watch (when available) and polling as fallback.
 */
export class StateWatcher {
    private statePath: string;
    private watcher: fs.FSWatcher | undefined;
    private pollTimer: NodeJS.Timeout | undefined;
    private lastContent: string = '';
    private callbacks: StateChangeCallback[] = [];
    private currentState: GitAiState = { current_status: 'idle' };

    constructor(private workspaceRoot: string) {
        this.statePath = path.join(workspaceRoot, '.git', 'git-ai', 'state.json');
    }

    /**
     * Register a callback for state changes.
     */
    onStateChange(callback: StateChangeCallback): void {
        this.callbacks.push(callback);
        // Emit current state immediately.
        callback(this.currentState);
    }

    /**
     * Start watching the state file.
     */
    start(): void {
        // Initial read.
        this.readState();

        // Try fs.watch first.
        try {
            const dir = path.dirname(this.statePath);
            if (fs.existsSync(dir)) {
                this.watcher = fs.watch(dir, (eventType, filename) => {
                    if (filename === 'state.json') {
                        this.readState();
                    }
                });
                this.watcher.on('error', () => {
                    // Fall back to polling on error.
                    this.startPolling();
                });
            }
        } catch {
            // fs.watch not available — use polling.
        }

        // Always start polling as a safety net (handles cases where fs.watch misses events).
        this.startPolling();
    }

    /**
     * Stop watching.
     */
    stop(): void {
        this.watcher?.close();
        this.watcher = undefined;
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = undefined;
        }
    }

    /**
     * Get the current state.
     */
    getState(): GitAiState {
        return this.currentState;
    }

    private startPolling(): void {
        const config = vscode.workspace.getConfiguration('git-ai');
        const interval = config.get<number>('pollingInterval', 1000);

        this.pollTimer = setInterval(() => {
            this.readState();
        }, interval);
    }

    private readState(): void {
        try {
            if (!fs.existsSync(this.statePath)) {
                this.emitIfChanged({ current_status: 'idle' });
                return;
            }

            const content = fs.readFileSync(this.statePath, 'utf-8');
            if (content === this.lastContent) {
                return; // No change.
            }
            this.lastContent = content;

            const state: GitAiState = JSON.parse(content);
            this.emitIfChanged(state);
        } catch {
            // File might be locked or malformed — ignore.
        }
    }

    private emitIfChanged(newState: GitAiState): void {
        if (JSON.stringify(newState) === JSON.stringify(this.currentState)) {
            return;
        }

        const prevStatus = this.currentState.current_status;
        this.currentState = newState;

        // Notify all listeners.
        for (const cb of this.callbacks) {
            cb(newState);
        }

        // Show VS Code notifications for important transitions.
        if (prevStatus === 'polishing' && newState.current_status === 'idle') {
            notifyInfo(t('notification.polished'));
        }
        if (prevStatus === 'pushing' && newState.current_status === 'idle') {
            notifyInfo(t('notification.pushCompleted'));
        }
    }
}
