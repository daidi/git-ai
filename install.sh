#!/usr/bin/env bash
# Git AI Installation Script
# https://github.com/daidi/git-ai
set -e

# Repository information
REPO="daidi/git-ai"

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     OS_NAME="linux"; EXT="tar.gz";;
    Darwin*)    OS_NAME="darwin"; EXT="tar.gz";;
    MINGW*|MSYS*|CYGWIN*) OS_NAME="windows"; EXT="zip";;
    *)          echo "Unsupported OS: ${OS}"; exit 1;;
esac

# Detect Architecture
ARCH="$(uname -m)"
case "${ARCH}" in
    x86_64|amd64) ARCH_NAME="amd64";;
    aarch64|arm64) ARCH_NAME="arm64";;
    *)          echo "Unsupported architecture: ${ARCH}"; exit 1;;
esac

# Determine installation directory
if [ "$OS_NAME" = "windows" ]; then
    INSTALL_DIR="$HOME/bin"
    SUDO_CMD=""
    mkdir -p "$INSTALL_DIR"
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        echo "Warning: $INSTALL_DIR is not in your PATH."
        echo "Please add it to your ~/.bashrc or ~/.profile:"
        echo "export PATH=\"\$HOME/bin:\$PATH\""
    fi
elif [ -w "/usr/local/bin" ]; then
    INSTALL_DIR="/usr/local/bin"
    SUDO_CMD=""
elif command -v sudo >/dev/null 2>&1; then
    INSTALL_DIR="/usr/local/bin"
    SUDO_CMD="sudo"
else
    INSTALL_DIR="$HOME/.local/bin"
    SUDO_CMD=""
    mkdir -p "$INSTALL_DIR"
    if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
        echo "Warning: $INSTALL_DIR is not in your PATH."
        echo "Please add it to your ~/.bashrc, ~/.zshrc, or ~/.profile:"
        echo "export PATH=\"\$HOME/.local/bin:\$PATH\""
    fi
fi

# Fetch the latest version
echo "Fetching latest version of git-ai..."
LATEST_VERSION_TAG=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | head -n 1 | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_VERSION_TAG" ]; then
    echo "Error: Failed to fetch the latest version."
    exit 1
fi

echo "Latest release: ${LATEST_VERSION_TAG}"

FILENAME="git-ai_${OS_NAME}_${ARCH_NAME}.${EXT}"
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_VERSION_TAG}/${FILENAME}"
TMP_DIR=$(mktemp -d)

# Cleanup trap
trap "rm -rf '${TMP_DIR}'" EXIT

echo "Downloading ${DOWNLOAD_URL}..."
if curl -# -f -L -o "${TMP_DIR}/${FILENAME}" "${DOWNLOAD_URL}"; then
    echo "Extracting..."
    if [ "${EXT}" = "zip" ]; then
        unzip -q -o "${TMP_DIR}/${FILENAME}" -d "${TMP_DIR}"
        BIN_FILE="${TMP_DIR}/git-ai.exe"
        DEST_FILE="${INSTALL_DIR}/git-ai.exe"
    else
        tar -xzf "${TMP_DIR}/${FILENAME}" -C "${TMP_DIR}"
        BIN_FILE="${TMP_DIR}/git-ai"
        DEST_FILE="${INSTALL_DIR}/git-ai"
    fi

    echo "Installing to ${INSTALL_DIR}..."
    if [ -n "$SUDO_CMD" ]; then
        echo "You may be prompted for your password to install to ${INSTALL_DIR}."
    fi
    $SUDO_CMD install -m 755 "${BIN_FILE}" "${DEST_FILE}"
    
    echo ""
    echo "✅ Git AI successfully installed!"
    echo "Run 'git-ai --version' to verify the installation."
    echo "Then 'cd' into your repository and run 'git-ai init' to get started."
else
    echo "Error: Failed to download Git AI. The release might not be available for your platform (${OS_NAME}_${ARCH_NAME})."
    exit 1
fi
