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
    skip_next?: boolean;
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
            this.checkForUpdatesInLog();
        }
        if (prevStatus === 'pushing' && newState.current_status === 'idle') {
            notifyInfo(t('notification.pushCompleted'));
        }
    }

    /**
     * Scan the latest daemon.log for an update notice safely without HTTP overhead.
     */
    private checkForUpdatesInLog(): void {
        try {
            const logDir = path.join(this.workspaceRoot, '.git', 'git-ai', 'logs');
            if (!fs.existsSync(logDir)) return;

            const files = fs.readdirSync(logDir)
                .filter(f => f.endsWith('.log'))
                .sort()
                .reverse();
            
            if (files.length === 0) return;

            const latestLog = path.join(logDir, files[0]);
            let content = fs.readFileSync(latestLog, 'utf-8');
            
            // Strip ANSI codes
            content = content.replace(/\x1b\[[0-9;]*m/g, '');

            const updateMatch = content.match(/Update available for git-ai: (v[\d\.]+) → (v[\d\.]+)/);
            if (updateMatch) {
                const current = updateMatch[1];
                const latest = updateMatch[2];
                
                vscode.window.showInformationMessage(
                    t('notification.updateAvailable', current, latest),
                    t('notification.updateNow'),
                    t('notification.updateDismiss')
                ).then(async selection => {
                    if (selection === t('notification.updateNow')) {
                        // Dynamically import to avoid circular dependencies if any
                        const { installCliUpdate } = await import('./installer');
                        await installCliUpdate();
                    }
                });
            }
        } catch {
            // Ignore fs errors
        }
    }

    /**
     * Update and save the state to state.json.
     */
    saveState(newState: GitAiState): void {
        try {
            const dir = path.dirname(this.statePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.statePath, JSON.stringify(newState, null, 2), 'utf-8');
            this.emitIfChanged(newState);
        } catch {
            // Ignore write errors.
        }
    }
}
