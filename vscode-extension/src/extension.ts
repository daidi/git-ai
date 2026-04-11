import * as vscode from 'vscode';
import { StateWatcher } from './stateWatcher';
import { StatusBarManager } from './statusBar';
import { CommandManager } from './commands';
import { LogViewer } from './logViewer';
import { StatusTreeProvider } from './statusTree';
import { ActionsWebviewProvider } from './actionsWebview';
import { SettingsPanel } from './settingsPanel';
import { checkAndPromptInstall } from './installer';

let stateWatcher: StateWatcher | undefined;
let statusBar: StatusBarManager | undefined;
let logViewer: LogViewer | undefined;

export function activate(context: vscode.ExtensionContext) {
    // Check if CLI is installed asynchronously
    checkAndPromptInstall();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // Initialize components.
    statusBar = new StatusBarManager();
    logViewer = new LogViewer();
    stateWatcher = new StateWatcher(workspaceRoot);

    // Register tree view for status.
    const statusTreeProvider = new StatusTreeProvider();
    vscode.window.registerTreeDataProvider('git-ai.status', statusTreeProvider);

    // Register webview provider for actions panel.
    const actionsProvider = new ActionsWebviewProvider(context.extensionUri, workspaceRoot);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('git-ai.actions', actionsProvider)
    );

    // Register commands.
    const commands = new CommandManager(workspaceRoot, logViewer);
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
    );

    // Listen for state changes.
    stateWatcher.onStateChange((state) => {
        statusBar!.update(state);
        statusTreeProvider.update(state);
        actionsProvider.updateState(state);
    });

    // Start watching.
    stateWatcher.start();

    context.subscriptions.push(
        statusBar,
        { dispose: () => stateWatcher?.stop() },
    );

    console.log('git-ai extension activated');
}

export function deactivate() {
    stateWatcher?.stop();
    statusBar?.dispose();
    logViewer?.dispose();
}
