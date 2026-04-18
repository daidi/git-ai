import * as vscode from 'vscode';
import * as cp from 'child_process';
import { t } from './i18n';

interface AINote {
    model?: string;
    generation_time_ms?: number;
    original_message?: string;
    estimated_time_saved_s?: number;
}

interface CommitLog {
    sha: string;
    message: string;
    ai_note?: AINote;
}

export class HistoryTreeProvider implements vscode.TreeDataProvider<CommitItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CommitItem | undefined | null | void> = new vscode.EventEmitter<CommitItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CommitItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private workspaceRoot: string) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CommitItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CommitItem): Thenable<CommitItem[]> {
        if (element) {
            return Promise.resolve([]); // No children
        }

        if (!this.workspaceRoot) {
            return Promise.resolve([]);
        }

        return new Promise((resolve) => {
            const config = vscode.workspace.getConfiguration('git-ai');
            const binaryPath = config.get<string>('binaryPath') || 'git-ai';

            cp.execFile(binaryPath, ['log'], { cwd: this.workspaceRoot }, (error, stdout) => {
                if (error) {
                    resolve([new CommitItem("Error loading history", "", false)]);
                    return;
                }

                try {
                    const logs: CommitLog[] = JSON.parse(stdout);
                    if (!logs || logs.length === 0) {
                        resolve([new CommitItem("No recent history", "", false)]);
                        return;
                    }

                    const items = logs.map(log => {
                        const hasAI = !!log.ai_note;
                        
                        // Extract first line
                        let shortMsg = log.message.split('\n')[0];
                        if (shortMsg.length > 50) shortMsg = shortMsg.substring(0, 50) + '...';

                        return new CommitItem(shortMsg, log.sha, hasAI, log.ai_note, log.message);
                    });

                    resolve(items);
                } catch (e) {
                    resolve([new CommitItem("Failed to parse history", "", false)]);
                }
            });
        });
    }
}

export class CommitItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly sha: string,
        public readonly hasAI: boolean,
        public readonly aiNote?: AINote,
        public readonly fullMessage?: string,
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        
        if (sha) {
            this.description = sha.substring(0, 7);
        }

        this.iconPath = hasAI 
            ? new vscode.ThemeIcon("sparkle", new vscode.ThemeColor("terminal.ansiYellow"))
            : new vscode.ThemeIcon("git-commit");

        this.tooltip = this.getTooltip();
    }

    private getTooltip(): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;

        if (this.hasAI && this.aiNote) {
            md.appendMarkdown(`**AI Authorship Note** $(hubot)\n\n`);
            md.appendMarkdown(`---\n\n`);
            md.appendMarkdown(`- **Model**: \`${this.aiNote.model || 'Unknown'}\`\n`);
            if (this.aiNote.generation_time_ms) {
                md.appendMarkdown(`- **Latency**: \`${this.aiNote.generation_time_ms}ms\`\n`);
            }
            if (this.aiNote.estimated_time_saved_s) {
                md.appendMarkdown(`- **Time Saved**: \`${this.aiNote.estimated_time_saved_s}s\`\n`);
            }
            if (this.aiNote.original_message) {
                md.appendMarkdown(`- **Original Draft**:\n`);
                md.appendCodeblock(this.aiNote.original_message, 'text');
            }
            md.appendMarkdown(`\n---\n\n`);
        }

        if (this.fullMessage) {
            md.appendMarkdown(`**Commit Message:**\n\n`);
            md.appendCodeblock(this.fullMessage, 'text');
        }

        return md;
    }
}
