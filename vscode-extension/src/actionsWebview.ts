import * as vscode from 'vscode';
import { GitAiState } from './stateWatcher';

/**
 * Webview provider for the git-ai actions panel in the sidebar.
 * Provides buttons for common operations and displays config visually.
 */
export class ActionsWebviewProvider implements vscode.WebviewViewProvider {
    private webviewView: vscode.WebviewView | undefined;
    private state: GitAiState = { current_status: 'idle' };

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly workspaceRoot: string,
    ) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): void {
        this.webviewView = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
        };

        webviewView.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case 'init':
                    vscode.commands.executeCommand('git-ai.init');
                    break;
                case 'retry':
                    vscode.commands.executeCommand('git-ai.retry');
                    break;
                case 'undo':
                    vscode.commands.executeCommand('git-ai.undo');
                    break;
                case 'cancel':
                    vscode.commands.executeCommand('git-ai.cancel');
                    break;
                case 'forcePush':
                    vscode.commands.executeCommand('git-ai.forcePush');
                    break;
                case 'showLogs':
                    vscode.commands.executeCommand('git-ai.showLogs');
                    break;
                case 'openConfig':
                    vscode.commands.executeCommand('git-ai.openConfig');
                    break;
            }
        });

        this.renderHtml();
    }

    /**
     * Update the webview with the latest state.
     */
    updateState(state: GitAiState): void {
        this.state = state;
        this.renderHtml();
    }

    private renderHtml(): void {
        if (!this.webviewView) { return; }
        this.webviewView.webview.html = this.getHtml();
    }

    private getHtml(): string {
        const s = this.state;
        const isPolishing = s.current_status === 'polishing';
        const isPushing = s.current_status === 'pushing';
        const hasPending = !!s.pending_push;
        const isIdle = s.current_status === 'idle' && !hasPending;

        let statusHtml: string;
        if (isPolishing) {
            statusHtml = `<div class="status polishing">
                <span class="status-icon">✨</span>
                <span>AI 润色中...</span>
            </div>`;
        } else if (isPushing) {
            statusHtml = `<div class="status pushing">
                <span class="status-icon">🚀</span>
                <span>推送中...</span>
            </div>`;
        } else if (hasPending) {
            statusHtml = `<div class="status pending">
                <span class="status-icon">⏳</span>
                <span>待推送 → ${s.pending_push!.remote}</span>
            </div>`;
        } else {
            statusHtml = `<div class="status idle">
                <span class="status-icon">✅</span>
                <span>空闲</span>
            </div>`;
        }

        let infoHtml = '';
        if (s.last_sha) {
            infoHtml += `<div class="info-row"><span class="label">Commit:</span> <code>${s.last_sha.substring(0, 8)}</code></div>`;
        }
        if (s.original_msg) {
            infoHtml += `<div class="info-row"><span class="label">Original:</span> <span class="msg">${this.escapeHtml(s.original_msg)}</span></div>`;
        }

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
        color: var(--vscode-foreground);
        padding: 12px;
    }
    .status {
        display: flex; align-items: center; gap: 8px;
        padding: 10px 12px; border-radius: 6px; margin-bottom: 12px;
        font-weight: 600; font-size: 13px;
    }
    .status-icon { font-size: 16px; }
    .status.polishing { background: var(--vscode-inputValidation-warningBackground); border: 1px solid var(--vscode-inputValidation-warningBorder); }
    .status.pushing   { background: var(--vscode-inputValidation-infoBackground); border: 1px solid var(--vscode-inputValidation-infoBorder); }
    .status.pending   { background: var(--vscode-inputValidation-warningBackground); border: 1px solid var(--vscode-inputValidation-warningBorder); }
    .status.idle       { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); }

    .info-row {
        padding: 4px 0; font-size: 12px;
        color: var(--vscode-descriptionForeground);
        display: flex; gap: 6px; align-items: baseline;
    }
    .info-row .label { font-weight: 600; white-space: nowrap; }
    .info-row code {
        background: var(--vscode-textCodeBlock-background);
        padding: 1px 4px; border-radius: 3px; font-size: 11px;
    }
    .info-row .msg {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px;
    }

    .section-title {
        font-size: 11px; font-weight: 600; text-transform: uppercase;
        color: var(--vscode-descriptionForeground);
        margin: 14px 0 8px; letter-spacing: 0.5px;
    }

    .btn-grid { display: flex; flex-direction: column; gap: 6px; }
    button {
        display: flex; align-items: center; justify-content: center; gap: 6px;
        width: 100%; padding: 7px 12px; border: none; border-radius: 4px;
        font-size: 12px; font-family: inherit; cursor: pointer;
        background: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        transition: background 0.15s;
    }
    button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.primary {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
    }
    button.primary:hover { background: var(--vscode-button-hoverBackground); }
    button.danger {
        background: var(--vscode-inputValidation-errorBackground);
        color: var(--vscode-errorForeground);
    }

    .divider { height: 1px; background: var(--vscode-panel-border); margin: 12px 0; }
</style>
</head>
<body>
    ${statusHtml}
    ${infoHtml ? `<div class="info-section">${infoHtml}</div>` : ''}

    <div class="section-title">Actions</div>
    <div class="btn-grid">
        <button class="primary" onclick="send('retry')" ${isPolishing || isPushing ? 'disabled' : ''}>
            🔄 Retry AI Polish
        </button>
        <button onclick="send('undo')" ${isPolishing || isPushing ? 'disabled' : ''}>
            ⏪ Undo (Restore Original)
        </button>
        <button class="danger" onclick="send('cancel')" ${!isPolishing ? 'disabled' : ''}>
            🛑 Cancel Polishing
        </button>
        <button onclick="send('forcePush')" ${isPushing ? 'disabled' : ''}>
            🚀 Force Push Now
        </button>
    </div>

    <div class="divider"></div>

    <div class="section-title">Tools</div>
    <div class="btn-grid">
        <button onclick="send('showLogs')">📋 Show Logs</button>
        <button onclick="send('openConfig')">⚙️ Configuration</button>
        <button onclick="send('init')">🔧 Re-initialize</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        function send(cmd) { vscode.postMessage({ command: cmd }); }
    </script>
</body>
</html>`;
    }

    private escapeHtml(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}
