import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

const SELECTED_REPOSITORY_KEY = 'git-ai.selectedRepository';

function gitRoot(folder: vscode.WorkspaceFolder): Promise<string | undefined> {
    return new Promise(resolve => {
        cp.execFile(
            'git',
            ['rev-parse', '--show-toplevel'],
            { cwd: folder.uri.fsPath, timeout: 5_000, windowsHide: true },
            (error, stdout) => resolve(error || !stdout.trim() ? undefined : path.normalize(stdout.trim())),
        );
    });
}

export async function discoverRepositoryRoots(): Promise<string[]> {
    if (!vscode.workspace.isTrusted) return [];
    const folders = vscode.workspace.workspaceFolders ?? [];
    const roots = await Promise.all(folders.map(gitRoot));
    return [...new Set(roots.filter((root): root is string => Boolean(root)))];
}

export function preferredRepositoryRoot(
    roots: string[],
    persisted: string | undefined,
    activeFile: string | undefined,
): string | undefined {
    const saved = persisted && roots.find(root => path.relative(root, persisted) === '');
    if (saved) return saved;
    if (activeFile) {
        const match = roots
            .filter(root => {
                // Git may return forward slashes on Windows, while Uri.fsPath
                // uses backslashes. Relative paths handle both and drive roots.
                const relative = path.relative(root, activeFile);
                return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
            })
            .sort((left, right) => path.resolve(right).length - path.resolve(left).length)[0];
        if (match) return match;
    }
    return roots[0];
}

export async function resolveRepositoryRoot(context: vscode.ExtensionContext): Promise<string | undefined> {
    const roots = await discoverRepositoryRoots();
    const activeFile = vscode.window.activeTextEditor?.document.uri.scheme === 'file'
        ? vscode.window.activeTextEditor.document.uri.fsPath
        : undefined;
    const selected = preferredRepositoryRoot(
        roots,
        context.workspaceState.get<string>(SELECTED_REPOSITORY_KEY),
        activeFile,
    );
    if (selected) await context.workspaceState.update(SELECTED_REPOSITORY_KEY, selected);
    return selected;
}

export async function selectRepository(context: vscode.ExtensionContext): Promise<void> {
    const roots = await discoverRepositoryRoots();
    if (roots.length === 0) return;
    const current = context.workspaceState.get<string>(SELECTED_REPOSITORY_KEY);
    const items = roots.map(root => ({
        label: path.basename(root),
        description: root,
        root,
        picked: root === current,
    }));
    const selected = roots.length === 1 ? items[0] : await vscode.window.showQuickPick(items);
    if (!selected || selected.root === current) return;
    await context.workspaceState.update(SELECTED_REPOSITORY_KEY, selected.root);
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
}
