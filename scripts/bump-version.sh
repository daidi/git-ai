#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"
VERSION="${VERSION#v}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]]; then
  echo "Usage: $0 <semver> (for example: 1.2.0)" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

node - "$VERSION" <<'NODE'
const fs = require('fs');
const version = process.argv[2];

function updateJson(path, mutate) {
  const value = JSON.parse(fs.readFileSync(path, 'utf8'));
  mutate(value);
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

updateJson('vscode-extension/package.json', value => { value.version = version; });
updateJson('vscode-extension/package-lock.json', value => {
  value.version = version;
  if (value.packages && value.packages['']) value.packages[''].version = version;
});

const gradlePath = 'idea-plugin/gradle.properties';
const gradle = fs.readFileSync(gradlePath, 'utf8')
  .replace(/^pluginVersion\s*=.*$/m, `pluginVersion=${version}`);
fs.writeFileSync(gradlePath, gradle);

for (const path of ['docs/index.html', 'docs/script.js']) {
  const content = fs.readFileSync(path, 'utf8').replace(/v\d+\.\d+\.\d+/g, `v${version}`);
  fs.writeFileSync(path, content);
}
NODE

echo "Updated version files to $VERSION."
echo "After verification, commit the changes and create both tags:"
echo "  v$VERSION       (GitHub/package release)"
echo "  cli/v$VERSION   (Go module release)"
