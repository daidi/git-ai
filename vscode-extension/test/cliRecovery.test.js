const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const messages = require('../src/cliMessages.json');
const schema = JSON.stringify({ version: 1, fields: [{ key: 'provider', type: 'string', default: 'openai' }],
    providers: [{ id: 'openai', label: 'OpenAI', requires_api_key: true, default_base_url: 'https://example.invalid/v1', default_model: 'demo' }] });
let output = schema, calls = [], fetches = 0, installs = 0, failFetch = false, pendingFetch, customPath;
const info = { path: '/managed/git-ai', version: '1.3.1', identity: 'cli-1', managed: true };
const notices = [];
const item = { text: '', show() { this.visible = true; }, hide() { this.visible = false; }, dispose() { this.visible = false; } };
const vscode = {
    env: { language: 'en' }, workspace: { isTrusted: true, getConfiguration: () => ({ get: (key, fallback) => key === 'binaryPath' ? customPath : fallback }) },
    Uri: { joinPath: (...parts) => parts.join('/') }, StatusBarAlignment: { Left: 1 },
    window: { createStatusBarItem: () => item,
        showWarningMessage: async (...args) => { notices.push(args); },
        showInformationMessage: async (...args) => { notices.push(args); },
        showErrorMessage: async (...args) => { notices.push(args); } },
};
const cli = { cliRuntime: async () => info, selectedCli: () => info.path,
    runSettingsCli: async (_binary, args) => {
        assert.equal(vscode.workspace.isTrusted, true);
        calls.push(args);
        if (args[1] === 'schema') return output;
        if (args[1] === 'models') return '{"provider":"openai","models":[]}';
        if (args[0] === 'status') return '{"initialized":true}';
        return '{"check_update":false}';
    } };
const installer = { fetchLatestTag: async () => { fetches++; if (failFetch) throw Error('private response'); return pendingFetch || 'v1.4.2'; },
    installCliUpdate: async () => { installs++; return true; } };
const originalLoad = Module._load;
let CliUpdateService, SettingsPanel;
try {
    Module._load = function (request, ...args) {
        if (request === 'vscode') return vscode;
        if (request === './cliSettings') return cli;
        if (request === './installer') return installer;
        return originalLoad.call(this, request, ...args);
    };
    ({ CliUpdateService } = require('../out/cliUpdateService'));
    ({ SettingsPanel } = require('../out/settingsPanel'));
} finally { Module._load = originalLoad; }
function service() {
    const data = new Map([['git-ai.lastUpdateCheck', Date.now()]]);
    return new CliUpdateService({ get: k => data.get(k), update: async (k, v) => { data.set(k, v); } });
}
function reset() { output = schema; calls = []; fetches = 0; installs = 0; failFetch = false; pendingFetch = undefined; customPath = undefined; notices.length = 0; vscode.workspace.isTrusted = true; }
function panel(updates) {
    const view = { html: '', cspSource: 'vscode-resource:', asWebviewUri: String, onDidReceiveMessage: () => {}, postMessage: async () => true };
    const p = new SettingsPanel({ webview: view, onDidDispose: () => {} }, '/workspace', '/extension', updates);
    return p;
}
async function settle(p) { for (let i = 0; i < 20 && p.busy; i++) await new Promise(setImmediate); assert.equal(p.busy, false); }

test('mandatory protocol checks bypass legacy cooldown and never auto-install', async () => {
    reset(); output = 'Manage git-ai configuration'; const updates = service();
    await updates.checkOnStartup('/workspace');
    assert.equal(calls[0][1], 'schema'); assert.equal(fetches, 0); assert.equal(installs, 0);
    assert.equal(item.visible, true); assert.equal(notices.length, 1);
    await updates.checkOnStartup('/workspace'); assert.equal(notices.length, 1);
    output = schema; await updates.checkOnStartup('/workspace');
    assert.equal(item.visible, false); assert.equal(fetches, 0); // check_update=false
    updates.dispose();
});
test('release failure is visible, backed off, and manually retryable', async () => {
    reset(); const updates = service(); failFetch = true;
    assert.equal((await updates.check(info, false)).key, 'settings.cli.checkFailed');
    await updates.check(info, false); assert.equal(fetches, 1);
    failFetch = false;
    assert.equal((await updates.check(info, true)).latest, '1.4.2'); assert.equal(fetches, 2);
    await updates.check(info, false); assert.equal(fetches, 2);
    updates.dispose();
});
test('concurrent release queries are single-flight and disposed services do not publish results', async () => {
    reset(); const updates = service(); let finish;
    pendingFetch = new Promise(resolve => { finish = resolve; });
    const first = updates.check(info, true);
    assert.equal((await updates.check(info, true)).key, 'settings.cli.busy');
    updates.dispose(); finish('v1.4.2');
    assert.equal((await first).key, 'settings.cli.unavailable'); assert.equal(fetches, 1);
});
test('Restricted Mode and custom paths cannot trigger managed installation', async () => {
    reset(); const updates = service(); vscode.workspace.isTrusted = false;
    await updates.checkOnStartup(); await updates.check(info, true); await updates.install(info);
    assert.equal(calls.length, 0); assert.equal(fetches, 0); assert.equal(installs, 0);
    vscode.workspace.isTrusted = true;
    assert.equal(await updates.install({ ...info, managed: false }), false); assert.equal(installs, 0);
    customPath = '/newly-selected/custom-cli';
    assert.equal(await updates.install(info), false); assert.equal(installs, 0);
    updates.dispose();
});
test('failed settings render recovery controls without writable defaults, then retry recovers', async () => {
    reset(); output = 'Manage git-ai configuration'; const updates = service(); const p = panel(updates); await settle(p);
    assert.equal(p.configLoaded, false); assert.match(p.panel.webview.html, /data-cli-action="cliRetry"/);
    assert.doesNotMatch(p.panel.webview.html, /<form/);
    await p.handleMessage({ command: 'save', data: { model: 'lost-default' } });
    assert.equal(calls.some(args => args[1] === 'replace'), false); assert.equal(installs, 0);
    output = schema; await p.handleMessage({ command: 'cliRetry' });
    assert.equal(p.configLoaded, true); assert.match(p.panel.webview.html, /<form/);
    p.dispose(); updates.dispose();
});
test('dirty drafts prevent retries and upgrades; changed protocol blocks writes', async () => {
    reset(); const updates = service(); const p = panel(updates); await settle(p);
    await p.handleMessage({ command: 'draftState', dirty: true });
    const before = calls.length;
    await p.handleMessage({ command: 'cliRetry' }); await p.handleMessage({ command: 'cliUpdate' });
    assert.equal(calls.length, before); assert.equal(installs, 0);
    output = '"secret-token"'; await p.handleMessage({ command: 'save', data: { model: 'demo' } });
    assert.equal(calls.some(args => args[1] === 'replace'), false); assert.equal(p.configLoaded, false);
    assert.doesNotMatch(JSON.stringify(notices), /secret-token/);
    p.dispose(); updates.dispose();
});
test('disposed settings ignore late results and Restricted Mode prevents manual actions', async () => {
    reset(); const updates = service(); const p = panel(updates); p.dispose(); await new Promise(setImmediate);
    assert.equal(p.configLoaded, false);
    const before = calls.length;
    await p.handleMessage({ command: 'cliUpdate' }); assert.equal(calls.length, before); assert.equal(installs, 0);
    updates.dispose();
});
test('explicit installation reloads settings and failed recovery never writes defaults', async () => {
    reset(); const updates = service(); const p = panel(updates); await settle(p);
    output = 'legacy help';
    await p.handleMessage({ command: 'cliUpdate' });
    assert.equal(installs, 1); assert.equal(p.configLoaded, false);
    await p.handleMessage({ command: 'reset' });
    assert.equal(calls.some(args => args[1] === 'reset'), false);
    output = schema;
    await p.handleMessage({ command: 'cliUpdate' });
    assert.equal(installs, 2); assert.equal(p.configLoaded, true);
    p.dispose(); updates.dispose();
});
test('CLI recovery labels cover all 16 locales and preserve placeholder sets', () => {
    assert.equal(Object.keys(messages).length, 16);
    for (const [locale, dictionary] of Object.entries(messages)) {
        assert.deepEqual(Object.keys(dictionary).sort(), Object.keys(messages.en).sort(), locale);
        for (const [key, value] of Object.entries(dictionary)) {
            assert.deepEqual((value.match(/\{\d+\}/g) || []).sort(), (messages.en[key].match(/\{\d+\}/g) || []).sort(), `${locale}:${key}`);
        }
    }
});
