#!/usr/bin/env python3
"""
Check i18n coverage for the landing page (docs/script.js).
The translations live as a JS object literal with locale blocks like:
    en: { key1: "...", key2: "...", ... },
    "zh-cn": { key1: "...", key2: "...", ... },
"""
import re
import sys
import os

SCRIPT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                           "docs", "script.js")

with open(SCRIPT_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Match both bare identifiers (en:) and quoted strings ("zh-cn":)
locale_pattern = re.compile(
    r'^\s+(?:"([\w-]+)"|([\w]+))\s*:\s*\{(.*?)\}',
    re.MULTILINE | re.DOTALL
)

def extract_keys_from_block(block_text):
    """Extract i18n keys from a JS object literal block."""
    keys = set()
    for m in re.finditer(r'(?:^|,)\s*(\w+)\s*:', block_text):
        key = m.group(1)
        if key in ('span', 'code', 'strong', 'br', 'http', 'https', 'html', 'div', 'p', 'a', 'class'):
            continue
        keys.add(key)
    return keys

# Extract all locale blocks
locale_keys = {}
for m in locale_pattern.finditer(content):
    locale = m.group(1) or m.group(2)  # group(1) = quoted, group(2) = bare
    block = m.group(3)
    locale_keys[locale] = extract_keys_from_block(block)

if 'en' not in locale_keys:
    print("ERROR: Could not find 'en' locale block in script.js")
    sys.exit(1)

en_keys = locale_keys['en']

RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[0;33m'
CYAN = '\033[0;36m'
BOLD = '\033[1m'
NC = '\033[0m'

print(f"\n{BOLD}{CYAN}══════════════════════════════════════════════{NC}")
print(f"{BOLD}{CYAN}  Landing Page — docs/script.js{NC}")
print(f"{BOLD}{CYAN}══════════════════════════════════════════════{NC}")
print(f"  Base (en): {len(en_keys)} keys")
print()

# Expected locales (matching the actual JS key names)
expected_locales = {'en', 'fr', 'it', 'de', 'es', 'ja', 'ko', 'pt', 'ru', 'ar', 'vi', 'th', 'id', 'zh-cn', 'zh-tw'}
found_locales = set(locale_keys.keys())
missing_locales = expected_locales - found_locales
if missing_locales:
    for loc in sorted(missing_locales):
        print(f"  {RED}✗{NC} {BOLD}{loc}{NC} — {RED}ENTIRE LOCALE MISSING{NC}")
    print()

total_missing = 0
total_extra = 0

for locale in sorted(locale_keys.keys()):
    if locale == 'en':
        continue
    loc_keys = locale_keys[locale]
    missing = en_keys - loc_keys
    extra = loc_keys - en_keys

    if not missing and not extra:
        print(f"  {GREEN}✓{NC} {BOLD}{locale}{NC} — fully covered ({len(loc_keys)} keys)")
    else:
        if missing:
            print(f"  {RED}✗{NC} {BOLD}{locale}{NC} — {RED}{len(missing)} missing{NC}:")
            for k in sorted(missing):
                print(f"      {RED}↳ {k}{NC}")
            total_missing += len(missing)
        if extra:
            print(f"  {YELLOW}⚠{NC} {BOLD}{locale}{NC} — {YELLOW}{len(extra)} extra{NC}:")
            for k in sorted(extra):
                print(f"      {YELLOW}↳ {k}{NC}")
            total_extra += len(extra)

print(f"\n{BOLD}{CYAN}══════════════════════════════════════════════{NC}")
print(f"{BOLD}  Summary{NC}")
print(f"{BOLD}{CYAN}══════════════════════════════════════════════{NC}")
if total_missing == 0 and total_extra == 0 and not missing_locales:
    print(f"  {GREEN}🎉 Landing page translations fully in sync!{NC}")
else:
    if missing_locales:
        print(f"  {RED}Missing entire locales: {', '.join(sorted(missing_locales))}{NC}")
    if total_missing > 0:
        print(f"  {RED}Total missing keys: {total_missing}{NC}")
    if total_extra > 0:
        print(f"  {YELLOW}Total extra keys: {total_extra}{NC}")
print()
