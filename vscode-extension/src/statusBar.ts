import * as vscode from 'vscode';
import { GitAiState } from './stateWatcher';

/**
 * Manages the status bar item that shows git-ai state.
 */
export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'git-ai.showLogs';
        this.statusBarItem.tooltip = 'git-ai status (click for logs)';
        this.update({ current_status: 'idle' });
        this.statusBarItem.show();
    }

    /**
     * Update the status bar based on the current state.
     */
    update(state: GitAiState): void {
        switch (state.current_status) {
            case 'polishing':
                this.statusBarItem.text = '$(sparkle) AI 润色中...';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.warningBackground'
                );
                this.statusBarItem.tooltip = `git-ai: Polishing commit ${state.last_sha?.substring(0, 8) ?? ''}`;
                break;

            case 'pushing':
                this.statusBarItem.text = '$(cloud-upload) 推送中...';
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.warningBackground'
                );
                this.statusBarItem.tooltip = `git-ai: Pushing to ${state.pending_push?.remote ?? 'origin'}`;
                break;

            case 'idle':
            default:
                if (state.pending_push) {
                    this.statusBarItem.text = '$(clock) 待推送...';
                    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                        'statusBarItem.warningBackground'
                    );
                    this.statusBarItem.tooltip = `git-ai: Push pending to ${state.pending_push.remote}`;
                } else {
                    this.statusBarItem.text = '$(check) git-ai';
                    this.statusBarItem.backgroundColor = undefined;
                    this.statusBarItem.tooltip = 'git-ai: Idle';
                }
                break;
        }
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
