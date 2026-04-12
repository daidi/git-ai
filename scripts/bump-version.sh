#!/usr/bin/env bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <version> (e.g., 0.3.0)"
  exit 1
fi

VERSION=$1
# Remove 'v' prefix if user accidentally included it
VERSION="${VERSION#v}"

echo "🚀 Bumping version to $VERSION across all projects..."

# 1. Bump VS Code Extension
if [ -f "vscode-extension/package.json" ]; then
  echo "➡️  Updating VS Code extension..."
  # Use node to reliably replace the version in package.json
  node -e "
    const fs = require('fs');
    const path = 'vscode-extension/package.json';
    let pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
    pkg.version = '$VERSION';
    fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
  "
fi

# 2. Bump IntelliJ Plugin
if [ -f "idea-plugin/gradle.properties" ]; then
  echo "➡️  Updating IntelliJ plugin..."
  # Use sed to replace pluginVersion=...
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' -e "s/^pluginVersion[[:space:]]*=.*/pluginVersion=$VERSION/" idea-plugin/gradle.properties
  else
    sed -i -e "s/^pluginVersion[[:space:]]*=.*/pluginVersion=$VERSION/" idea-plugin/gradle.properties
  fi
fi

# 3. Bump Landing Page
if [ -f "docs/index.html" ] && [ -f "docs/script.js" ]; then
  echo "➡️  Updating Landing Page..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' -E "s/v[0-9]+\.[0-9]+\.[0-9]+/v$VERSION/g" docs/index.html docs/script.js
  else
    sed -i -E "s/v[0-9]+\.[0-9]+\.[0-9]+/v$VERSION/g" docs/index.html docs/script.js
  fi
fi

echo "✅ All version files updated to $VERSION"
echo ""
echo "📦 Committing and tagging release v$VERSION..."

git add vscode-extension/package.json idea-plugin/gradle.properties docs/index.html docs/script.js
GIT_AI_SKIP=true git commit --no-verify -m "chore: bump version to $VERSION"

git tag "v$VERSION"
git push origin main "v$VERSION"

echo ""
echo "🚀 Release triggered successfully!"
echo "👉 Check GitHub Actions progress here: https://github.com/daidi/git-ai/actions"
