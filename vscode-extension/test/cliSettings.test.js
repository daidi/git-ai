const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const vscode = { workspace: { isTrusted: true }, env: { appName: 'Visual Studio Code' } };
const originalLoad = Module._load;
let runSettingsCli;
try {
    Module._load = function (request, ...args) {
        if (request === 'vscode') return vscode;
        if (request === './installer') return { getExecutablePath: value => value };
        return originalLoad.call(this, request, ...args);
    };
    ({ runSettingsCli } = require('../out/cliSettings'));
} finally { Module._load = originalLoad; }

test('bounded CLI execution uses stdin and does not force optional update preferences', async () => {
    const output = await runSettingsCli(process.execPath, ['-e',
        'process.stdin.on("data", chunk => process.stdout.write(chunk))'], undefined, '{"model":"demo"}');
    assert.equal(output, '{"model":"demo"}');
    const actual = await runSettingsCli(process.execPath, ['-e',
        'process.stdout.write(JSON.stringify({update:process.env.GIT_AI_CHECK_UPDATE, client:process.env.GIT_AI_CLIENT}))']);
    assert.deepEqual(JSON.parse(actual), { ...(process.env.GIT_AI_CHECK_UPDATE === undefined ? {} : { update: process.env.GIT_AI_CHECK_UPDATE }), client: 'vscode' });
});

test('subprocess errors never expose credentials or response bodies', async () => {
    await assert.rejects(runSettingsCli(process.execPath, ['-e',
        'process.stderr.write("private-token response-body"); process.exit(1)']),
    error => error.message === 'settings.cli.unavailable');
    await assert.rejects(runSettingsCli(process.execPath, ['-e',
        'process.stderr.write("unknown command \\\"schema\\\" for \\\"git-ai config\\\" private-token"); process.exit(1)']),
    error => error.message === 'settings.cli.incompatible');
});

test('Restricted Mode refuses execution before starting a binary', async () => {
    vscode.workspace.isTrusted = false;
    try {
        await assert.rejects(runSettingsCli('/nonexistent/cli', ['config', 'schema']),
            error => error.message === 'settings.cli.unavailable');
    } finally { vscode.workspace.isTrusted = true; }
});
