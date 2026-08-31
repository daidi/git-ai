#!/usr/bin/env bash
# Git AI Installation Script
# https://github.com/daidi/git-ai
set -euo pipefail

REPO="daidi/git-ai"
STAGED_DEST=""

fail() {
    echo "Error: $*" >&2
    exit 1
}

for required_command in curl mktemp install head; do
    command -v "$required_command" >/dev/null 2>&1 || fail "Required command '$required_command' was not found."
done

OS="$(uname -s)"
case "$OS" in
    Linux*) OS_NAME="linux"; EXT="tar.gz" ;;
    Darwin*) OS_NAME="darwin"; EXT="tar.gz" ;;
    MINGW*|MSYS*|CYGWIN*) OS_NAME="windows"; EXT="zip" ;;
    *) fail "Unsupported OS: $OS" ;;
esac

ARCH="$(uname -m)"
case "$ARCH" in
    x86_64|amd64) ARCH_NAME="amd64" ;;
    aarch64|arm64) ARCH_NAME="arm64" ;;
    *) fail "Unsupported architecture: $ARCH" ;;
esac

if [ "$OS_NAME" = "windows" ]; then
    INSTALL_DIR="$HOME/bin"
    SUDO_CMD=""
elif [ -w "/usr/local/bin" ]; then
    INSTALL_DIR="/usr/local/bin"
    SUDO_CMD=""
elif command -v sudo >/dev/null 2>&1; then
    INSTALL_DIR="/usr/local/bin"
    SUDO_CMD="sudo"
else
    INSTALL_DIR="$HOME/.local/bin"
    SUDO_CMD=""
fi

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/git-ai-install.XXXXXX")"
cleanup() {
    if [ -n "$STAGED_DEST" ]; then
        if [ -n "$SUDO_CMD" ]; then
            sudo rm -f -- "$STAGED_DEST" 2>/dev/null || true
        else
            rm -f -- "$STAGED_DEST" 2>/dev/null || true
        fi
    fi
    rm -rf -- "$TMP_DIR"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

CURL_ARGS=(
    --fail
    --location
    --silent
    --show-error
    --proto '=https'
    --proto-redir '=https'
    --connect-timeout 10
    --max-time 300
    --retry 3
    --retry-delay 1
)

echo "Fetching latest version of git-ai..."
if ! RELEASE_JSON="$(curl "${CURL_ARGS[@]}" --max-time 30 \
    --max-filesize 1048576 \
    -H "Accept: application/vnd.github+json" \
    -H "User-Agent: git-ai-installer" \
    "https://api.github.com/repos/${REPO}/releases/latest")"; then
    fail "Could not query GitHub Releases. Check your network and try again; no installed files were changed."
fi

LATEST_VERSION_TAG="$(printf '%s\n' "$RELEASE_JSON" | sed -nE 's/.*"tag_name"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' | head -n 1)"
if ! printf '%s' "$LATEST_VERSION_TAG" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$'; then
    fail "GitHub returned an invalid release version. No installed files were changed."
fi

echo "Latest release: $LATEST_VERSION_TAG"

FILENAME="git-ai_${OS_NAME}_${ARCH_NAME}.${EXT}"
BASE_URL="https://github.com/${REPO}/releases/download/${LATEST_VERSION_TAG}"
ARCHIVE_PATH="${TMP_DIR}/${FILENAME}"
CHECKSUM_PATH="${TMP_DIR}/checksums.txt"

echo "Downloading ${BASE_URL}/${FILENAME}..."
if ! curl "${CURL_ARGS[@]}" --max-filesize 157286400 -o "$ARCHIVE_PATH" "${BASE_URL}/${FILENAME}"; then
    fail "The release archive could not be downloaded. Check your network or platform; no installed files were changed."
fi
if ! curl "${CURL_ARGS[@]}" --max-filesize 1048576 -o "$CHECKSUM_PATH" "${BASE_URL}/checksums.txt"; then
    fail "The release checksum could not be downloaded. No installed files were changed."
fi

CHECKSUM_MATCHES="$(awk -v filename="$FILENAME" '$2 == filename || $2 == "*" filename { print $1 }' "$CHECKSUM_PATH")"
CHECKSUM_COUNT="$(printf '%s\n' "$CHECKSUM_MATCHES" | awk 'NF { count++ } END { print count + 0 }')"
EXPECTED_CHECKSUM="$(printf '%s\n' "$CHECKSUM_MATCHES" | awk 'NF { print; exit }')"
if [ "$CHECKSUM_COUNT" -ne 1 ]; then
    fail "The release checksum list does not contain exactly one entry for $FILENAME."
fi
if ! printf '%s' "$EXPECTED_CHECKSUM" | grep -Eq '^[0-9a-fA-F]{64}$'; then
    fail "The release checksum list does not contain a valid entry for $FILENAME."
fi
if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL_CHECKSUM="$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
    ACTUAL_CHECKSUM="$(shasum -a 256 "$ARCHIVE_PATH" | awk '{print $1}')"
else
    fail "Neither sha256sum nor shasum is available; refusing to install an unverified archive."
fi
if [ "$(printf '%s' "$ACTUAL_CHECKSUM" | tr '[:upper:]' '[:lower:]')" != "$(printf '%s' "$EXPECTED_CHECKSUM" | tr '[:upper:]' '[:lower:]')" ]; then
    fail "Checksum verification failed. The existing installation was left unchanged."
fi

EXTRACT_DIR="${TMP_DIR}/extracted"
mkdir -p "$EXTRACT_DIR"
echo "Checksum verified. Extracting..."
if [ "$EXT" = "zip" ]; then
    command -v unzip >/dev/null 2>&1 || fail "Required command 'unzip' was not found."
    BIN_FILE="${EXTRACT_DIR}/git-ai.exe"
    DEST_FILE="${INSTALL_DIR}/git-ai.exe"
    ENTRY_COUNT="$(unzip -Z1 "$ARCHIVE_PATH" | awk '$0 == "git-ai.exe" { count++ } END { print count + 0 }')"
    [ "$ENTRY_COUNT" -eq 1 ] || fail "The verified archive did not contain exactly one git-ai.exe entry."
    if ! unzip -p "$ARCHIVE_PATH" git-ai.exe | head -c 105906176 > "$BIN_FILE"; then
        fail "The verified executable could not be extracted safely."
    fi
else
    command -v tar >/dev/null 2>&1 || fail "Required command 'tar' was not found."
    BIN_FILE="${EXTRACT_DIR}/git-ai"
    DEST_FILE="${INSTALL_DIR}/git-ai"
    ENTRY_COUNT="$(tar -tzf "$ARCHIVE_PATH" | awk '$0 == "git-ai" { count++ } END { print count + 0 }')"
    [ "$ENTRY_COUNT" -eq 1 ] || fail "The verified archive did not contain exactly one git-ai entry."
    if ! tar -xOzf "$ARCHIVE_PATH" git-ai | head -c 105906176 > "$BIN_FILE"; then
        fail "The verified executable could not be extracted safely."
    fi
fi

[ -f "$BIN_FILE" ] && [ ! -L "$BIN_FILE" ] && [ -s "$BIN_FILE" ] || fail "The verified archive did not contain the expected executable."
BIN_SIZE="$(wc -c < "$BIN_FILE" | tr -d '[:space:]')"
[ "$BIN_SIZE" -le 104857600 ] || fail "The executable in the verified archive exceeded the safety limit."
chmod 755 "$BIN_FILE"
"$BIN_FILE" --version >/dev/null 2>&1 || fail "The downloaded executable failed validation. The existing installation was left unchanged."

if [ -n "$SUDO_CMD" ]; then
    echo "Installing to $INSTALL_DIR (sudo may request your password)..."
    sudo mkdir -p "$INSTALL_DIR"
    STAGED_DEST="$(sudo mktemp "${INSTALL_DIR}/.git-ai.install.XXXXXX")"
    sudo install -m 755 "$BIN_FILE" "$STAGED_DEST"
    sudo mv -f -- "$STAGED_DEST" "$DEST_FILE"
else
    mkdir -p "$INSTALL_DIR"
    echo "Installing to $INSTALL_DIR..."
    STAGED_DEST="$(mktemp "${INSTALL_DIR}/.git-ai.install.XXXXXX")"
    install -m 755 "$BIN_FILE" "$STAGED_DEST"
    mv -f -- "$STAGED_DEST" "$DEST_FILE"
fi
STAGED_DEST=""

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo "Warning: $INSTALL_DIR is not in your PATH."
    echo "Add it to your shell profile: export PATH=\"$INSTALL_DIR:\$PATH\""
fi

echo
echo "✅ Git AI successfully installed and checksum-verified."
echo "Run 'git-ai --version' to verify the installation."
echo "Then 'cd' into your repository and run 'git-ai init' to get started."
