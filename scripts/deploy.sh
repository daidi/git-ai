#!/bin/bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
# git-ai: Create GitHub repo, push, and trigger release
# Run this script once when network connectivity is available.
# ──────────────────────────────────────────────────────────

REPO_NAME="git-ai"
REPO_DESC="🤖 AI-powered Git commit message enhancer — async polish + deferred push"

echo "=== Step 1: Verify gh auth ==="
if ! gh auth status 2>/dev/null; then
    echo "⚠️  gh is not authenticated. Running login..."
    gh auth login -h github.com -p https -w
fi

echo ""
echo "=== Step 2: Create GitHub repository ==="
if gh repo view "daidi/${REPO_NAME}" &>/dev/null; then
    echo "✓ Repository daidi/${REPO_NAME} already exists"
else
    gh repo create "${REPO_NAME}" \
        --public \
        --description "${REPO_DESC}" \
        --homepage "https://github.com/daidi/${REPO_NAME}" \
        --license MIT \
        --source . \
        --push=false
    echo "✅ Created daidi/${REPO_NAME}"
fi

echo ""
echo "=== Step 3: Set remote and push ==="
if git remote get-url origin &>/dev/null; then
    git remote set-url origin "https://github.com/daidi/${REPO_NAME}.git"
else
    git remote add origin "https://github.com/daidi/${REPO_NAME}.git"
fi

git push -u origin main
echo "✅ Pushed main branch"

echo ""
echo "=== Step 4: Push tag and trigger release ==="
git push origin v0.1.0
echo "✅ Pushed tag v0.1.0"
echo ""
echo "The release workflow will now build and publish:"
echo "  - CLI binaries (darwin/linux/windows × amd64/arm64)"
echo "  - VS Code .vsix extension"
echo "  - IntelliJ plugin .zip"
echo "  - Homebrew formula"
echo ""

echo "=== Step 5: Wait for release to complete ==="
echo "Monitor at: https://github.com/daidi/${REPO_NAME}/actions"
echo ""

# Optional: wait and then verify
read -p "Press Enter to check release status (or Ctrl+C to skip)..."
gh run list --repo "daidi/${REPO_NAME}" --limit 3
echo ""
echo "🎉 Done! Install with: brew install daidi/tap/git-ai"
