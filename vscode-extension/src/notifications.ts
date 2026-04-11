import * as vscode from 'vscode';

export type NotificationMode = "sound" | "silentToast" | "silentStatus";

export function getNotificationMode(): NotificationMode {
    const config = vscode.workspace.getConfiguration("git-ai");
    return config.get<NotificationMode>("notificationMode", "sound");
}

export function notifyInfo(message: string, timeoutMs = 4000): void {
    const mode = getNotificationMode();
    switch (mode) {
        case "silentStatus":
            vscode.window.setStatusBarMessage(message, timeoutMs);
            break;
        case "silentToast":
            void vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: message },
                async () => {
                    await new Promise(resolve => setTimeout(resolve, timeoutMs));
                }
            );
            break;
        default:
            void vscode.window.showInformationMessage(message);
    }
}

export function notifyError(message: string, timeoutMs = 6000): void {
    const mode = getNotificationMode();
    if (mode === "silentStatus") {
        vscode.window.setStatusBarMessage(`⚠ ${message}`, timeoutMs);
        console.error(message);
        return;
    }
    void vscode.window.showErrorMessage(message);
}

export function notifyWarning(message: string, timeoutMs = 5000): void {
    const mode = getNotificationMode();
    if (mode === "silentStatus") {
        vscode.window.setStatusBarMessage(`⚠ ${message}`, timeoutMs);
        console.warn(message);
        return;
    }
    void vscode.window.showWarningMessage(message);
}
