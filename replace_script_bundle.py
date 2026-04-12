import os
import re

def inplace_replace(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Apply specific replacements to properties file values (after =)
    def replacer(match):
        key, equals, value = match.group(1), match.group(2), match.group(3)
        if '.config/git-ai' in value or '.git-ai.json' in value or 'git-ai hook' in value:
            # Maybe keep "git-ai" in config paths, but replace standalone.
            # It's safer to just let the path keep lowercase, and manually replace others
            val = value.replace('git-ai CLI', 'Git AI CLI')
            val = val.replace('git-ai ', 'Git AI ')
            val = val.replace(' git-ai', ' Git AI')
            val = val.replace('git-ai:', 'Git AI:')
            val = val.replace('git-ai配置', 'Git AI 配置')
            val = val.replace('启用 git-ai', '启用 Git AI')
            return key + equals + val
            
        return key + equals + value.replace('git-ai', 'Git AI')
        
    content = re.sub(r'(^[^#\n=]+)(=)(.*)$', replacer, content, flags=re.MULTILINE)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

inplace_replace('/Users/dorothy/Work/git-ai/idea-plugin/src/main/resources/messages/GitAiBundle.properties')
inplace_replace('/Users/dorothy/Work/git-ai/idea-plugin/src/main/resources/messages/GitAiBundle_zh_CN.properties')

# LogViewer and Installer changes in vscode-extension
def replace_simple(filepath, old, new):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

replace_simple('/Users/dorothy/Work/git-ai/vscode-extension/src/logViewer.ts', "createOutputChannel('git-ai')", "createOutputChannel('Git AI')")
replace_simple('/Users/dorothy/Work/git-ai/vscode-extension/src/installer.ts', "createTerminal('git-ai Installer')", "createTerminal('Git AI Installer')")

# plugin.xml changes
replace_simple('/Users/dorothy/Work/git-ai/idea-plugin/src/main/resources/META-INF/plugin.xml', 'toolWindowId="git-ai"', 'toolWindowId="Git AI"')
replace_simple('/Users/dorothy/Work/git-ai/idea-plugin/src/main/resources/META-INF/plugin.xml', '<toolWindow\n                id="git-ai"', '<toolWindow\n                id="Git AI"')

print("Bundles and other texts updated.")
