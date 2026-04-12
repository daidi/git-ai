import * as vscode from 'vscode';
import { GitAiState } from './stateWatcher';
import { t } from './i18n';

/**
 * Tree data provider for the git-ai status view in the sidebar.
 */
export class StatusTreeProvider implements vscode.TreeDataProvider<StatusItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<StatusItem | undefined | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private state: GitAiState = { current_status: 'idle' };

    update(state: GitAiState): void {
        this.state = state;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: StatusItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: StatusItem): StatusItem[] {
        if (element) { return []; }

        const items: StatusItem[] = [];

        // Status indicator.
        const statusIcon = this.getStatusIcon();
        const statusLabel = this.getStatusLabel();
        items.push(new StatusItem(statusLabel, statusIcon, t('tree.category.status')));

        // Last SHA.
        if (this.state.last_sha) {
            items.push(new StatusItem(
                this.state.last_sha.substring(0, 8),
                '$(git-commit)',
                t('tree.category.lastCommit')
            ));
        }

        // Original message.
        if (this.state.original_msg) {
            items.push(new StatusItem(
                this.state.original_msg,
                '$(comment)',
                t('tree.category.originalMsg')
            ));
        }

        // Pending push.
        if (this.state.pending_push) {
            const ts = new Date(this.state.pending_push.timestamp * 1000);
            items.push(new StatusItem(
                t('tree.pendingPush.queued', this.state.pending_push.remote, ts.toLocaleTimeString()),
                '$(cloud-upload)',
                t('tree.category.pendingPush')
            ));
        }

        // Daemon PID.
        if (this.state.pid) {
            items.push(new StatusItem(
                t('tree.daemon.pid', String(this.state.pid)),
                '$(server-process)',
                t('tree.category.daemon')
            ));
        }

        return items;
    }

    private getStatusIcon(): string {
        switch (this.state.current_status) {
            case 'polishing': return '$(loading~spin)';
            case 'pushing': return '$(cloud-upload)';
            default: return '$(check)';
        }
    }

    private getStatusLabel(): string {
        switch (this.state.current_status) {
            case 'polishing': return t('status.polishing');
            case 'pushing': return t('status.pushing');
            default:
                if (this.state.pending_push) { return t('status.pendingPush'); }
                return t('status.idle');
        }
    }
}

class StatusItem extends vscode.TreeItem {
    constructor(
        public readonly value: string,
        public readonly icon: string,
        public readonly category: string,
    ) {
        super(`${category}: ${value}`, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(icon.replace('$(', '').replace(')', '').replace('~spin', ''));
        this.description = value;
        this.label = category;
        this.tooltip = `${category}: ${value}`;
    }
}
