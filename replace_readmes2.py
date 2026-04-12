import re

# Update README_zh.md
with open('/Users/dorothy/Work/git-ai/README_zh.md', 'r', encoding='utf-8') as f:
    zh_content = f.read()

zh_content = zh_content.replace('<h1 align="center">Git AI - Async Commit Polisher</h1>', '<h1 align="center">Git AI - 异步提交润色</h1>')
zh_content = zh_content.replace('<strong>Never wait for AI. Polish your commits in the background while you code.</strong><br/>', '<strong>告别等待，让 AI 在后台默默为您润色提交信息。</strong><br/>')
zh_content = zh_content.replace('<strong>Commit first, think later.</strong><br/>', '<strong>先提交，后思考 (Commit first, think later)。</strong><br/>')

with open('/Users/dorothy/Work/git-ai/README_zh.md', 'w', encoding='utf-8') as f:
    f.write(zh_content)


# Update README.md
with open('/Users/dorothy/Work/git-ai/README.md', 'r', encoding='utf-8') as f:
    en_content = f.read()

en_content = en_content.replace('<h1 align="center">git-ai</h1>', '<h1 align="center">Git AI - Async Commit Polisher</h1>')

with open('/Users/dorothy/Work/git-ai/README.md', 'w', encoding='utf-8') as f:
    f.write(en_content)

print("Updated README headers.")
