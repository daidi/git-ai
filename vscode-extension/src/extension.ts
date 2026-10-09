import * as vscode from 'vscode';
import { StateWatcher } from './stateWatcher';
import { StatusBarManager } from './statusBar';
import { CommandManager } from './commands';
import { LogViewer } from './logViewer';
import { StatusTreeProvider } from './statusTree';
import { ActionsWebviewProvider } from './actionsWebview';
import { HistoryTreeProvider } from './historyTree';
import { SettingsPanel } from './settingsPanel';
import { autoInitialize } from './installer';
import { CliUpdateService } from './cliUpdateService';
import { resolveRepositoryRoot, selectRepository } from './repositorySelection';
import { clientSource } from './clientSource';

let stateWatcher: StateWatcher | undefined;
let statusBar: StatusBarManager | undefined;
let logViewer: LogViewer | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // A fixed label lets hooks in newly created integrated terminals identify
    // editor forks without forwarding installation paths or IPC variables.
    const setTerminalSource = () => {
        context.environmentVariableCollection.persistent = false;
        context.environmentVariableCollection.replace('GIT_AI_CLIENT', clientSource(vscode.env.appName));
    };
    if (vscode.workspace.isTrusted) { setTerminalSource(); }
    context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(setTerminalSource));
    const updates = new CliUpdateService(context.globalState);
    context.subscriptions.push(updates);

    context.subscriptions.push(vscode.commands.registerCommand('git-ai.selectRepository', () => selectRepository(context)));

    const workspaceRoot = await resolveRepositoryRoot(context);
    if (vscode.workspace.isTrusted) void updates.checkOnStartup(workspaceRoot);
    if (!workspaceRoot) {
        return;
    }
    if (vscode.workspace.isTrusted) { void autoInitialize(workspaceRoot); }
    context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => {
        void updates.checkOnStartup(workspaceRoot);
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
            SettingsPanel.show(context.extensionUri, workspaceRoot, updates);
        }),
        vscode.commands.registerCommand('git-ai.uninstall', () => commands.uninstall()),
        vscode.commands.registerCommand('git-ai.config.test', () => commands.testConfig()),
        vscode.commands.registerCommand('git-ai.skipNextCommit', () => commands.skipNextCommit()),
        vscode.commands.registerCommand('git-ai.clean', () => commands.clean()),
    );

    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => {
        void resolveRepositoryRoot(context).then(root => {
            if (root !== workspaceRoot) void vscode.commands.executeCommand('workbench.action.reloadWindow');
        });
    }));

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
