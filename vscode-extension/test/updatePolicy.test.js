const assert = require('node:assert/strict');
const test = require('node:test');
const { emptyCache, shouldFetch, isNewer, installedVersion, stableVersion, SUCCESS_TTL_MS, FAILURE_BACKOFF_MS } = require('../out/updatePolicy');
const now = 1800000000000, identity = '/managed/git-ai|1.4.1|100';
test('successful results cache 24 hours but remain displayable and manually refreshable', () => {
    const cache = { ...emptyCache(identity), lastSuccess: now, latest: '1.4.2' };
    assert.equal(shouldFetch(cache, identity, now + 1, false), false);
    assert.equal(shouldFetch(cache, identity, now + SUCCESS_TTL_MS, false), true);
    assert.equal(shouldFetch(cache, identity, now + 1, true), true);
    assert.equal(isNewer('1.4.1', cache.latest), true);
});
test('failure backoff is 15 minutes even with a prior success; manual checks bypass it', () => {
    for (const lastSuccess of [0, now - 100]) {
        const cache = { ...emptyCache(identity), lastSuccess, lastFailure: now, latest: '1.4.2' };
        assert.equal(shouldFetch(cache, identity, now + 1, false), false);
        assert.equal(shouldFetch(cache, identity, now + FAILURE_BACKOFF_MS, false), true);
        assert.equal(shouldFetch(cache, identity, now + 1, true), true);
    }
});
test('new CLI, legacy cache, invalid latest and clock rollback trigger a fresh check', () => {
    const cache = { ...emptyCache(identity), lastSuccess: now, latest: '1.4.2' };
    assert.equal(shouldFetch(cache, 'different-cli', now + 1, false), true);
    assert.equal(shouldFetch(emptyCache(), identity, now, false), true);
    assert.equal(shouldFetch(cache, identity, now - 1, false), true);
    assert.equal(shouldFetch({ ...cache, latest: 'garbage' }, identity, now + 1, false), true);
    assert.equal(shouldFetch({ ...cache, lastFailure: now + 100 }, identity, now, false), true);
});
test('version comes from CLI identity line, not appended update notice', () => {
    assert.equal(installedVersion('\x1b[1;36m✨ Git-AI CLI v1.3.1\x1b[0m\nUpdate available: v9.0.0'), '1.3.1');
    assert.equal(installedVersion('✨ Git-AI CLI vdev\nUpdate available: v9.0.0'), 'dev');
    assert.equal(installedVersion('Git-AI CLI v1.5.0-beta.1'), '1.5.0-beta.1');
    assert.equal(installedVersion('Some other tool v1.4.1'), undefined);
});
test('stable versions compare numerically; prerelease and development builds are not downgraded', () => {
    assert.equal(isNewer('1.9.9', 'v1.10.0'), true);
    for (const [current, latest] of [['1.4.1', '1.4.1'], ['2.0.0', '1.99.99'], ['dev', '1.4.1'], ['1.5.0-beta', '1.4.1'], ['1.4.1', '1.5.0-beta']]) {
        assert.equal(isNewer(current, latest), false);
    }
    assert.equal(stableVersion('99999999999999.0.0'), undefined);
});
