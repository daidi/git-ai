import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Output channel for viewing git-ai daemon logs.
 */
export class LogViewer implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private tailInterval: NodeJS.Timeout | undefined;
    private lastReadPosition: number = 0;
    private currentFile: string = '';

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('git-ai');
    }

    /**
     * Show the latest log file from the log directory.
     */
    showLatest(logDir: string): void {
        this.outputChannel.show(true);

        if (!fs.existsSync(logDir)) {
            this.outputChannel.appendLine('[git-ai] No logs directory found.');
            this.outputChannel.appendLine(`[git-ai] Expected at: ${logDir}`);
            return;
        }

        // Find the latest log file.
        const files = fs.readdirSync(logDir)
            .filter(f => f.endsWith('.log'))
            .sort()
            .reverse();

        if (files.length === 0) {
            this.outputChannel.appendLine('[git-ai] No log files found.');
            return;
        }

        const latestLog = path.join(logDir, files[0]);
        this.tailFile(latestLog);
    }

    /**
     * Start tailing a log file, appending new content as it appears.
     */
    private tailFile(filePath: string): void {
        // Stop previous tail.
        if (this.tailInterval) {
            clearInterval(this.tailInterval);
        }

        this.currentFile = filePath;
        this.lastReadPosition = 0;

        this.outputChannel.clear();
        this.outputChannel.appendLine(`[git-ai] Watching: ${filePath}`);
        this.outputChannel.appendLine('─'.repeat(60));

        // Initial read.
        this.readNewContent();

        // Poll for new content every 500ms.
        this.tailInterval = setInterval(() => {
            this.readNewContent();
        }, 500);
    }

    private readNewContent(): void {
        try {
            if (!fs.existsSync(this.currentFile)) { return; }

            const stat = fs.statSync(this.currentFile);
            if (stat.size <= this.lastReadPosition) { return; }

            const fd = fs.openSync(this.currentFile, 'r');
            const buffer = Buffer.alloc(stat.size - this.lastReadPosition);
            fs.readSync(fd, buffer, 0, buffer.length, this.lastReadPosition);
            fs.closeSync(fd);

            this.lastReadPosition = stat.size;
            this.outputChannel.append(buffer.toString('utf-8'));
        } catch {
            // File might be locked.
        }
    }

    dispose(): void {
        if (this.tailInterval) {
            clearInterval(this.tailInterval);
        }
        this.outputChannel.dispose();
    }
}
