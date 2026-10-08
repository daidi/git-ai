const test = require('node:test');
const assert = require('node:assert/strict');
const { clientSource } = require('../out/clientSource');

test('editor variants produce fixed source labels', () => {
    for (const [name, expected] of [
        ['Visual Studio Code', 'vscode'], ['Visual Studio Code - Insiders', 'vscode'],
        ['Cursor', 'cursor'], ['Windsurf', 'windsurf'], ['Code - OSS', 'vscode-family'],
        ['/private/custom-editor', 'vscode-family'],
    ]) {
        assert.equal(clientSource(name), expected);
    }
});
