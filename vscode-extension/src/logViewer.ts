import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { t } from './i18n';

const MAX_LOG_BYTES = 1024 * 1024;

/** Read-only, bounded viewer for the external daemon logs reported by the CLI. */
export class LogViewer implements vscode.Disposable {
    private readonly outputChannel = vscode.window.createOutputChannel('Git AI');
    private tailInterval: NodeJS.Timeout | undefined;
    private currentFile = '';
    private lastSize = -1;
    private lastModified = -1;

    showLatest(logDir: string): void {
        this.outputChannel.show(true);
        try {
            const directory = fs.lstatSync(logDir);
            if (!directory.isDirectory() || directory.isSymbolicLink()) { throw new Error('invalid log directory'); }
            const files = fs.readdirSync(logDir)
                .filter(name => name.endsWith('.log'))
                .map(name => path.join(logDir, name))
                .filter(candidate => {
                    try {
                        const info = fs.lstatSync(candidate);
                        return info.isFile() && !info.isSymbolicLink();
                    } catch { return false; }
                })
                .sort()
                .reverse();
            if (files.length === 0) {
                this.outputChannel.clear();
                this.outputChannel.appendLine(t('logViewer.noLogs'));
                return;
            }
            this.tailFile(files[0]);
        } catch {
            this.outputChannel.clear();
            this.outputChannel.appendLine(t('logViewer.noDir'));
            this.outputChannel.appendLine(t('logViewer.expectedAt', logDir));
        }
    }

    private tailFile(filePath: string): void {
        if (this.tailInterval) { clearInterval(this.tailInterval); }
        this.currentFile = filePath;
        this.lastSize = -1;
        this.lastModified = -1;
        this.readLatestContent();
        this.tailInterval = setInterval(() => this.readLatestContent(), 500);
    }

    private readLatestContent(): void {
        try {
            const stat = fs.lstatSync(this.currentFile);
            if (!stat.isFile() || stat.isSymbolicLink()) { return; }
            if (stat.size === this.lastSize && stat.mtimeMs === this.lastModified) { return; }
            this.lastSize = stat.size;
            this.lastModified = stat.mtimeMs;

            const start = Math.max(0, stat.size - MAX_LOG_BYTES);
            const length = stat.size - start;
            const buffer = Buffer.alloc(length);
            const fd = fs.openSync(this.currentFile, 'r');
            try {
                fs.readSync(fd, buffer, 0, length, start);
            } finally {
                fs.closeSync(fd);
            }

            this.outputChannel.clear();
            this.outputChannel.appendLine(t('logViewer.watching', this.currentFile));
            this.outputChannel.appendLine('─'.repeat(60));
            if (start > 0) { this.outputChannel.appendLine('[older log output truncated]'); }
            this.outputChannel.append(buffer.toString('utf8'));
        } catch {
            // The daemon may rotate a log between stat and read; the next poll retries.
        }
    }

    dispose(): void {
        if (this.tailInterval) { clearInterval(this.tailInterval); }
        this.outputChannel.dispose();
    }
}
