import * as vscode from 'vscode';
import { StateWatcher } from './stateWatcher';
import { StatusBarManager } from './statusBar';
import { CommandManager } from './commands';
import { LogViewer } from './logViewer';
import { StatusTreeProvider } from './statusTree';
import { ActionsWebviewProvider } from './actionsWebview';
import { HistoryTreeProvider } from './historyTree';
import { SettingsPanel } from './settingsPanel';
import { checkAndPromptInstall, autoInitialize } from './installer';
import { checkForCliUpdate } from './updateChecker';

let stateWatcher: StateWatcher | undefined;
let statusBar: StatusBarManager | undefined;
let logViewer: LogViewer | undefined;

export function activate(context: vscode.ExtensionContext) {
    if (vscode.workspace.isTrusted) {
        // Executable discovery, downloads, and Git hook changes are disabled in
        // Restricted Mode. The user must explicitly trust the workspace first.
        void checkAndPromptInstall();
        void checkForCliUpdate(context);
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    if (vscode.workspace.isTrusted) { void autoInitialize(workspaceRoot); }
    context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => {
        void checkAndPromptInstall();
        void checkForCliUpdate(context);
        void autoInitialize(workspaceRoot);
    }));

    // Initialize components.
    statusBar = new StatusBarManager();
    logViewer = new LogViewer();
    stateWatcher = new StateWatcher(workspaceRoot);

    // Register tree view for status.
    const statusTreeProvider = new StatusTreeProvider();
    context.subscriptions.push(vscode.window.registerTreeDataProvider('git-ai.status', statusTreeProvider));

    // Register tree view for AI History.
    const historyTreeProvider = new HistoryTreeProvider(workspaceRoot);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('git-ai.history', historyTreeProvider));

    // Register webview provider for actions panel.
    const actionsProvider = new ActionsWebviewProvider(context.extensionUri, workspaceRoot);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('git-ai.actions', actionsProvider)
    );

    // Register commands.
    const commands = new CommandManager(workspaceRoot, logViewer, stateWatcher);
    context.subscriptions.push(
        vscode.commands.registerCommand('git-ai.init', () => commands.init()),
        vscode.commands.registerCommand('git-ai.retry', () => commands.retry()),
        vscode.commands.registerCommand('git-ai.undo', () => commands.undo()),
        vscode.commands.registerCommand('git-ai.cancel', () => commands.cancel()),
        vscode.commands.registerCommand('git-ai.forcePush', () => commands.forcePush()),
        vscode.commands.registerCommand('git-ai.showLogs', () => commands.showLogs()),
        vscode.commands.registerCommand('git-ai.openConfig', () => {
            SettingsPanel.show(context.extensionUri, workspaceRoot);
        }),
        vscode.commands.registerCommand('git-ai.uninstall', () => commands.uninstall()),
        vscode.commands.registerCommand('git-ai.config.test', () => commands.testConfig()),
        vscode.commands.registerCommand('git-ai.skipNextCommit', () => commands.skipNextCommit()),
        vscode.commands.registerCommand('git-ai.clean', () => commands.clean()),
    );

    let isPolishing = false;
    const stateSubscription = stateWatcher.onStateChange((state) => {
        statusBar!.update(state);
        statusTreeProvider.update(state);
        actionsProvider.updateState(state);

        // Refresh history tree after a polish or push completes
        if (isPolishing && state.current_status === 'idle') {
            historyTreeProvider.refresh();
        }
        isPolishing = state.current_status === 'polishing';
    });

    // Start watching.
    stateWatcher.start();

    context.subscriptions.push(
        statusBar,
        logViewer,
        stateSubscription,
        { dispose: () => stateWatcher?.stop() },
    );

    console.log('git-ai extension activated');
}

export function deactivate() {
    stateWatcher?.stop();
    statusBar?.dispose();
    logViewer?.dispose();
}
