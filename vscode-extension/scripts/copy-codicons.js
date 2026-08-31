'use strict';

const fs = require('fs');
const path = require('path');

const extensionRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(extensionRoot, 'node_modules', '@vscode', 'codicons', 'dist');
const destinationDir = path.join(extensionRoot, 'resources', 'codicons');

fs.mkdirSync(destinationDir, { recursive: true });
for (const file of ['codicon.css', 'codicon.ttf']) {
    const source = path.join(sourceDir, file);
    if (!fs.existsSync(source)) {
        throw new Error(`Missing Codicon build dependency: ${source}`);
    }
    fs.copyFileSync(source, path.join(destinationDir, file));
}
