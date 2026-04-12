import re

def replace_git_ai_in_readme(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # We want to replace standalone git-ai with Git AI in READMEs.
    # We should NOT replace:
    # - The command: `git-ai`
    # - github urls: github.com/daidi/git-ai
    # - Codeblocks if they refer to the executable or package name
    # Let's perform some safe regex replacements:
    # # git-ai -> # Git AI
    # git-ai hook -> Git AI hook
    # git-ai plugin -> Git AI plugin
    # Git-AI -> Git AI
    
    content = content.replace('# git-ai', '# Git AI')
    content = content.replace('**git-ai**', '**Git AI**')
    content = content.replace(' git-ai ', ' Git AI ')
    content = content.replace('Git-AI', 'Git AI')
    content = content.replace('git-ai extension', 'Git AI extension')
    content = content.replace('git-ai plugin', 'Git AI plugin')
    content = content.replace('git-ai settings', 'Git AI settings')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

replace_git_ai_in_readme('/Users/dorothy/Work/git-ai/idea-plugin/README.md')
replace_git_ai_in_readme('/Users/dorothy/Work/git-ai/vscode-extension/README.md')
