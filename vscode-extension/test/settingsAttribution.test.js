const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

// Only the host language is needed to exercise the real settings renderer.
const vscode = { env: { language: 'en' } };
const originalLoad = Module._load;
let SettingsPanel;
let t;
try {
    Module._load = function (request, ...args) {
        if (request === 'vscode') return vscode;
        return originalLoad.call(this, request, ...args);
    };
    ({ SettingsPanel } = require('../out/settingsPanel'));
    ({ t } = require('../out/i18n'));
} finally {
    Module._load = originalLoad;
}

function attributionSelect(html, prefix) {
    const match = html.match(new RegExp(`<select\\s+id="field_${prefix}_commit_attribution"[\\s\\S]*?</select>`));
    assert.ok(match, 'attribution select should be rendered');
    return match[0];
}

test('attribution is off by default and follows CLI schema', () => {
    const panel = Object.create(SettingsPanel.prototype);
    assert.equal(panel.schemaDefaults().commit_attribution, 'off');
    assert.match(attributionSelect(panel.renderGlobalPane({}), 'g'), /value="off" selected/);
    panel.schema = { version: 1, fields: [{ key: 'commit_attribution', type: 'string', default: 'compact', enum: ['off', 'compact'] }], providers: [] };
    assert.equal(panel.schemaDefaults().commit_attribution, 'compact');
    assert.match(attributionSelect(panel.renderGlobalPane({}), 'g'), /value="compact" selected/);
});

test('project attribution supports inheritance and explicit opt-out', () => {
    const panel = Object.create(SettingsPanel.prototype);
    const merged = { ...panel.schemaDefaults(), commit_attribution: 'compact' };
    const inherited = attributionSelect(panel.renderProjectPane({}, merged, true, false), 'p');
    assert.match(inherited, /value="" selected/);
    assert.match(inherited, /data-effective="compact"/);
    const optedOut = attributionSelect(panel.renderProjectPane({ commit_attribution: 'off' }, merged, true, false), 'p');
    assert.match(optedOut, /value="off" selected/);
    assert.match(optedOut, /data-effective="off"/);
});

test('attribution label and disclosure are translated in every supported locale', () => {
    try {
        const englishLabel = t('settings.field.commitAttribution');
        for (const locale of ['ar', 'de', 'es', 'fr', 'id', 'it', 'ja', 'ko', 'ms', 'pt', 'ru', 'th', 'vi', 'zh-CN', 'zh-TW']) {
            vscode.env.language = locale;
            assert.notEqual(t('settings.field.commitAttribution'), englishLabel, locale);
            assert.match(t('settings.hint.commitAttribution'), /off.*compact.*Polished-by/);
            assert.match(t('settings.hint.commitAttribution'), /https:\/\/codegg\.org\/git-ai\//);
        }
    } finally {
        vscode.env.language = 'en';
    }
});
