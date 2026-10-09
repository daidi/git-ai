const assert = require('node:assert/strict');
const test = require('node:test');
const { parseSchema, parseConfig, parseModels, SettingsProtocolError } = require('../out/settingsProtocol');
const schema = { version: 1, fields: [{ key: 'provider', type: 'string', default: 'openai', enum: ['openai'] }],
    providers: [{ id: 'openai', label: 'OpenAI compatible', requires_api_key: true, default_base_url: 'https://example.invalid/v1', default_model: 'demo' }] };

test('old CLI help and non-object JSON are rejected without response data in errors', () => {
    for (const output of ['Manage git-ai configuration\nUsage:\n git-ai config [flags]', '', 'null', '[]', '42', 'true', '"secret-token"', '<html>error</html>', '{bad', JSON.stringify(schema) + '\nUpdate available']) {
        for (const parse of [parseSchema, parseConfig, parseModels]) {
            assert.throws(() => parse(output), e => e instanceof SettingsProtocolError && e.message === 'settings.cli.incompatible');
        }
    }
});
test('schema requires supported version, typed fields and complete providers', () => {
    assert.deepEqual(parseSchema(JSON.stringify(schema)), schema);
    const invalid = [{}, { ...schema, version: 2 }, { ...schema, version: '1' }, { ...schema, fields: [null] },
        { ...schema, fields: [{ key: 'provider', type: 'boolean', default: 'openai' }] },
        { ...schema, providers: [{ ...schema.providers[0], requires_api_key: 'true' }] },
        { ...schema, providers: [{ ...schema.providers[0], default_model: null }] }];
    for (const value of invalid) assert.throws(() => parseSchema(JSON.stringify(value)), SettingsProtocolError);
});
test('config accepts empty layers and additive metadata, rejects type coercion', () => {
    assert.deepEqual(parseConfig('{}'), {});
    assert.equal(parseConfig('{"model":"demo","api_key_configured":true,"usage_telemetry":false}').api_key_configured, true);
    for (const value of [{ model: {} }, { smart_skip: 'false' }, { api_key_configured: [] }, { max_diff_tokens: 1.5 }, { max_diff_tokens: 2147483648 }]) {
        assert.throws(() => parseConfig(JSON.stringify(value)), SettingsProtocolError);
    }
});
test('model catalog accepts cache metadata and rejects malformed entries', () => {
    assert.deepEqual(parseModels('{"provider":"openai","models":[],"source":"cache"}').models, []);
    for (const value of [{}, { provider: 'openai', models: null }, { provider: 'openai', models: [null] }, { provider: 'openai', models: [{ id: 42 }] }]) {
        assert.throws(() => parseModels(JSON.stringify(value)), SettingsProtocolError);
    }
});
