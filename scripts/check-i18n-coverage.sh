#!/usr/bin/env bash
# ============================================================
# check-i18n-coverage.sh
# Compares base (English) locale files against every translated
# locale file for both VSCode and IntelliJ plugins.
# Reports: missing keys, extra keys (in translation but not base).
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VSCODE_DIR="$REPO_ROOT/vscode-extension"
IDEA_MSG_DIR="$REPO_ROOT/idea-plugin/src/main/resources/messages"

total_missing=0
total_extra=0

# ── VS Code (JSON) ──────────────────────────────────────────
echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  VS Code Extension — package.nls.*.json${NC}"
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════${NC}"

VSCODE_BASE="$VSCODE_DIR/package.nls.json"
base_keys_vscode=$(python3 -c "
import json, sys
with open('$VSCODE_BASE') as f:
    data = json.load(f)
for k in sorted(data.keys()):
    print(k)
")

for nls_file in "$VSCODE_DIR"/package.nls.*.json; do
    # skip the base file itself
    [ "$nls_file" = "$VSCODE_BASE" ] && continue

    locale=$(basename "$nls_file" | sed 's/package\.nls\.\(.*\)\.json/\1/')
    trans_keys=$(python3 -c "
import json
with open('$nls_file') as f:
    data = json.load(f)
for k in sorted(data.keys()):
    print(k)
")

    missing=$(comm -23 <(echo "$base_keys_vscode") <(echo "$trans_keys"))
    extra=$(comm -13 <(echo "$base_keys_vscode") <(echo "$trans_keys"))

    missing_count=$(echo "$missing" | grep -c . || true)
    extra_count=$(echo "$extra" | grep -c . || true)

    if [ "$missing_count" -eq 0 ] && [ "$extra_count" -eq 0 ]; then
        echo -e "  ${GREEN}✓${NC} ${BOLD}$locale${NC} — fully covered"
    else
        if [ "$missing_count" -gt 0 ]; then
            echo -e "  ${RED}✗${NC} ${BOLD}$locale${NC} — ${RED}$missing_count missing${NC}:"
            echo "$missing" | while IFS= read -r key; do
                [ -z "$key" ] && continue
                echo -e "      ${RED}↳ $key${NC}"
            done
            total_missing=$((total_missing + missing_count))
        fi
        if [ "$extra_count" -gt 0 ]; then
            echo -e "  ${YELLOW}⚠${NC} ${BOLD}$locale${NC} — ${YELLOW}$extra_count extra (in translation but not base)${NC}:"
            echo "$extra" | while IFS= read -r key; do
                [ -z "$key" ] && continue
                echo -e "      ${YELLOW}↳ $key${NC}"
            done
            total_extra=$((total_extra + extra_count))
        fi
    fi
done

# ── IntelliJ (properties) ───────────────────────────────────
echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  IntelliJ Plugin — GitAiBundle*.properties${NC}"
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════${NC}"

IDEA_BASE="$IDEA_MSG_DIR/GitAiBundle.properties"

# Extract keys from a .properties file (skip comments and blanks, handle multi-line)
extract_props_keys() {
    python3 -c "
import re, sys
keys = []
with open('$1', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or line.startswith('!'):
            continue
        m = re.match(r'^([a-zA-Z0-9_.\\\\-]+)\s*=', line)
        if m:
            keys.append(m.group(1))
for k in sorted(set(keys)):
    print(k)
"
}

base_keys_idea=$(extract_props_keys "$IDEA_BASE")

for props_file in "$IDEA_MSG_DIR"/GitAiBundle_*.properties; do
    locale=$(basename "$props_file" | sed 's/GitAiBundle_\(.*\)\.properties/\1/')
    trans_keys=$(extract_props_keys "$props_file")

    missing=$(comm -23 <(echo "$base_keys_idea") <(echo "$trans_keys"))
    extra=$(comm -13 <(echo "$base_keys_idea") <(echo "$trans_keys"))

    missing_count=$(echo "$missing" | grep -c . || true)
    extra_count=$(echo "$extra" | grep -c . || true)

    if [ "$missing_count" -eq 0 ] && [ "$extra_count" -eq 0 ]; then
        echo -e "  ${GREEN}✓${NC} ${BOLD}$locale${NC} — fully covered"
    else
        if [ "$missing_count" -gt 0 ]; then
            echo -e "  ${RED}✗${NC} ${BOLD}$locale${NC} — ${RED}$missing_count missing${NC}:"
            echo "$missing" | while IFS= read -r key; do
                [ -z "$key" ] && continue
                echo -e "      ${RED}↳ $key${NC}"
            done
            total_missing=$((total_missing + missing_count))
        fi
        if [ "$extra_count" -gt 0 ]; then
            echo -e "  ${YELLOW}⚠${NC} ${BOLD}$locale${NC} — ${YELLOW}$extra_count extra (in translation but not base)${NC}:"
            echo "$extra" | while IFS= read -r key; do
                [ -z "$key" ] && continue
                echo -e "      ${YELLOW}↳ $key${NC}"
            done
            total_extra=$((total_extra + extra_count))
        fi
    fi
done

# ── Landing Page (docs/script.js) ───────────────────────────
DOCS_I18N_SCRIPT="$REPO_ROOT/scripts/check-docs-i18n.py"
if [ -f "$DOCS_I18N_SCRIPT" ]; then
    docs_output=$(python3 "$DOCS_I18N_SCRIPT" 2>&1)
    echo "$docs_output"
    # Count missing from docs output
    docs_missing=$(echo "$docs_output" | grep -c '↳' || true)
    docs_locale_missing=$(echo "$docs_output" | grep -c 'ENTIRE LOCALE MISSING' || true)
    total_missing=$((total_missing + docs_missing + docs_locale_missing))
fi

# ── Summary ─────────────────────────────────────────────────
echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Summary${NC}"
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════${NC}"
if [ "$total_missing" -eq 0 ] && [ "$total_extra" -eq 0 ]; then
    echo -e "  ${GREEN}🎉 All translations are fully in sync!${NC}"
else
    [ "$total_missing" -gt 0 ] && echo -e "  ${RED}Total missing keys: $total_missing${NC}"
    [ "$total_extra" -gt 0 ] && echo -e "  ${YELLOW}Total extra keys:   $total_extra${NC}"
fi
echo ""
