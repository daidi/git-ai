import os
import re

def inplace_replace(filepath, mapping):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in mapping:
        content = content.replace(old, new)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# vscode-extension/src/i18n.ts
i18n_path = '/Users/dorothy/Work/git-ai/vscode-extension/src/i18n.ts'
with open(i18n_path, 'r', encoding='utf-8') as f:
    i18n_content = f.read()

# Instead of blindly replacing all "git-ai", we selectively replace where it is standalone text.
# We'll use regex for values in the mappings.
def replace_in_values(content):
    def replacer(match):
        # We only want to replace git-ai with Git AI in the values
        key, quote_start, value, quote_end = match.group(1), match.group(2), match.group(3), match.group(4)
        
        # Don't translate config path
        if '.config/git-ai/' in value or ' ~/.config/git-ai' in value or '.git-ai.json' in value or 'git-ai CLI' in value or 'git-ai hook' in value:
            # Maybe keep some but replace standalone git-ai?
            val = value.replace('git-ai CLI', 'Git AI CLI')
            val = val.replace('git-ai ', 'Git AI ')
            val = val.replace(' git-ai', ' Git AI')
            val = val.replace('git-ai:', 'Git AI:')
            val = val.replace('git-ai配置', 'Git AI 配置')
            val = val.replace('git-ai配置', 'Git AI 配置')
            val = val.replace('git-ai被', 'Git AI 被')
            val = val.replace('git-ai初始化', 'Git AI 初始化')
            val = val.replace('git-ai设置', 'Git AI 设置')
            val = val.replace('启用 git-ai', '启用 Git AI')
            return key + quote_start + val + quote_end
            
        value = value.replace('git-ai', 'Git AI')
        return key + quote_start + value + quote_end
    
    # regex to match dictionary items: 'key': 'value',
    content = re.sub(r"('[^']+'\s*:\s*)(['\"])(.*?)(['\"])", replacer, content)
    return content

i18n_content = replace_in_values(i18n_content)

# Specific fixes for i18n
i18n_content = i18n_content.replace('~/.config/Git AI', '~/.config/git-ai')

with open(i18n_path, 'w', encoding='utf-8') as f:
    f.write(i18n_content)

# Replace in package.nls.json
import json

def update_nls(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    for k, v in data.items():
        data[k] = v.replace('git-ai', 'Git AI')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

update_nls('/Users/dorothy/Work/git-ai/vscode-extension/package.nls.json')
update_nls('/Users/dorothy/Work/git-ai/vscode-extension/package.nls.zh-cn.json')

# package.json
inplace_replace('/Users/dorothy/Work/git-ai/vscode-extension/package.json', [
    ('"description": "Zap icon for git-ai"', '"description": "Zap icon for Git AI"')
])

# idea-plugin/src/main/resources/META-INF/plugin.xml
inplace_replace('/Users/dorothy/Work/git-ai/idea-plugin/src/main/resources/META-INF/plugin.xml', [
    ('text="Initialize git-ai"', 'text="Initialize Git AI"'),
    ('description="Set up git-ai hooks', 'description="Set up Git AI hooks'),
    ('description="Open git-ai configuration', 'description="Open Git AI configuration')
])

print("Replacements done for basic files.")
