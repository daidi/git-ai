import * as vscode from 'vscode';
import { GitAiState } from './stateWatcher';

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
        items.push(new StatusItem(statusLabel, statusIcon, 'Status'));

        // Last SHA.
        if (this.state.last_sha) {
            items.push(new StatusItem(
                this.state.last_sha.substring(0, 8),
                '$(git-commit)',
                'Last Commit'
            ));
        }

        // Original message.
        if (this.state.original_msg) {
            items.push(new StatusItem(
                this.state.original_msg,
                '$(comment)',
                'Original Message'
            ));
        }

        // Pending push.
        if (this.state.pending_push) {
            const ts = new Date(this.state.pending_push.timestamp * 1000);
            items.push(new StatusItem(
                `${this.state.pending_push.remote} (queued ${ts.toLocaleTimeString()})`,
                '$(cloud-upload)',
                'Pending Push'
            ));
        }

        // Daemon PID.
        if (this.state.pid) {
            items.push(new StatusItem(
                `PID ${this.state.pid}`,
                '$(server-process)',
                'Daemon'
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
            case 'polishing': return 'AI 润色中...';
            case 'pushing': return '推送中...';
            default:
                if (this.state.pending_push) { return '待推送'; }
                return '空闲';
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
