const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

// The helper is intentionally pure so selection behavior can be covered
// without launching an Extension Host.
function preferredRepositoryRoot(roots, persisted, activeFile) {
    if (persisted && roots.includes(persisted)) return persisted;
    if (activeFile) {
        const match = roots
            .filter(root => activeFile === root || activeFile.startsWith(root + path.sep))
            .sort((left, right) => right.length - left.length)[0];
        if (match) return match;
    }
    return roots[0];
}

test('keeps a valid persisted repository selection', () => {
    assert.equal(preferredRepositoryRoot(['/repo/a', '/repo/b'], '/repo/b', '/repo/a/file.ts'), '/repo/b');
});

test('uses the deepest repository containing the active file', () => {
    assert.equal(preferredRepositoryRoot(['/repo', '/repo/nested'], undefined, '/repo/nested/file.ts'), '/repo/nested');
});

test('falls back to the first repository', () => {
    assert.equal(preferredRepositoryRoot(['/repo/a', '/repo/b'], '/missing', undefined), '/repo/a');
});
