import * as vscode from 'vscode';
import { GitAiState } from './stateWatcher';
import { t } from './i18n';

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
        this.statusBarItem.tooltip = t('statusBar.tooltip.default');
        this.update({ current_status: 'idle' });
        this.statusBarItem.show();
    }

    /**
     * Update the status bar based on the current state.
     */
    update(state: GitAiState): void {
        switch (state.current_status) {
            case 'polishing':
                this.statusBarItem.text = t('statusBar.polishing');
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.warningBackground'
                );
                this.statusBarItem.tooltip = t('statusBar.tooltip.polishing', state.last_sha?.substring(0, 8) ?? '');
                break;

            case 'pushing':
                this.statusBarItem.text = t('statusBar.pushing');
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.warningBackground'
                );
                this.statusBarItem.tooltip = t('statusBar.tooltip.pushing', state.pending_push?.remote ?? 'origin');
                break;

            case 'idle':
            default:
                if (state.pending_push) {
                    this.statusBarItem.text = t('statusBar.pendingPush');
                    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                        'statusBarItem.warningBackground'
                    );
                    this.statusBarItem.tooltip = t('statusBar.tooltip.pendingPush', state.pending_push.remote);
                } else {
                    this.statusBarItem.text = t('statusBar.idle');
                    this.statusBarItem.backgroundColor = undefined;
                    this.statusBarItem.tooltip = t('statusBar.tooltip.idle');
                }
                break;
        }
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
