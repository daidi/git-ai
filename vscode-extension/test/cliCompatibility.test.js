const assert = require('node:assert/strict');
const test = require('node:test');
const { isSettingsProtocolMismatch } = require('../out/cliCompatibility');

test('detects settings flags missing from an old CLI', () => {
    assert.equal(isSettingsProtocolMismatch(new Error('error: unknown flag: --scope')), true);
    assert.equal(isSettingsProtocolMismatch(new Error('Error: unknown flag: --json')), true);
});

test('detects settings commands and smart skip missing from an old CLI', () => {
    assert.equal(isSettingsProtocolMismatch(new Error('unknown command "replace" for "git-ai config"')), true);
    assert.equal(isSettingsProtocolMismatch(new Error("unknown command 'reset' for 'git-ai config'")), true);
    assert.equal(isSettingsProtocolMismatch(new Error('unknown config key: smart_skip')), true);
});

test('does not classify unrelated failures as protocol mismatches', () => {
    assert.equal(isSettingsProtocolMismatch(new Error('network request timed out')), false);
    assert.equal(isSettingsProtocolMismatch(new Error('unknown config key: model')), false);
});
