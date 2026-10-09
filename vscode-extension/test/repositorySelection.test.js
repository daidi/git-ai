const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const Module = require('node:module');

// Exercise the production helper with both OS path implementations on every
// host, rather than a copied helper with POSIX-only fixtures.
function loadSelection(paths) {
    const originalLoad = Module._load;
    const id = require.resolve('../out/repositorySelection');
    delete require.cache[id];
    try {
        Module._load = function (request, ...args) {
            if (request === 'vscode') return {};
            if (request === 'path') return paths;
            return originalLoad.call(this, request, ...args);
        };
        return require(id).preferredRepositoryRoot;
    } finally { Module._load = originalLoad; }
}

for (const [name, paths, base] of [['POSIX', path.posix, '/'], ['Windows', path.win32, 'C:\\']]) {
    const select = loadSelection(paths);
    const repo = paths.join(base, 'repo');
    const nested = paths.join(repo, 'nested');
    test(`${name}: keeps persisted selection and selects the deepest active repository`, () => {
        const file = paths.join(nested, 'file.ts');
        assert.equal(select([repo, nested], repo, file), repo);
        assert.equal(select([repo, nested], undefined, file), nested);
        assert.equal(select([base, repo], undefined, paths.join(repo, 'file.ts')), repo);
        assert.equal(select([repo, nested], '/missing', undefined), repo);
    });
    test(`${name}: does not treat a sibling prefix as a containing repository`, () => {
        assert.equal(select([base, repo], undefined, paths.join(base, 'repo-other', 'file.ts')), base);
        assert.equal(select([], undefined, paths.join(repo, 'file.ts')), undefined);
    });
}

test('Windows: Git slash paths, URI backslash paths, casing and different drives', () => {
    const select = loadSelection(path.win32);
    const roots = ['C:/repo', 'C:/repo/nested', 'D:/repo'];
    assert.equal(select(roots, undefined, 'c:\\repo\\nested\\file.ts'), roots[1]);
    assert.equal(select(roots, 'c:\\repo\\nested', undefined), roots[1]);
    assert.equal(select(roots, undefined, 'D:\\repo\\file.ts'), roots[2]);
});
