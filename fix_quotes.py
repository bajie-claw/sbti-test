#!/usr/bin/env python3
import re

with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    # Only process lines that start with (whitespace then) desc: "
    stripped = line.lstrip()
    if not stripped.startswith('desc:'):
        new_lines.append(line)
        continue
    
    # Find the pattern desc: " - opening delimiter
    pattern = 'desc: "'
    idx = line.find(pattern)
    if idx == -1:
        new_lines.append(line)
        continue
    
    content_start = idx + len(pattern)
    
    # Find the CLOSING " - it's the last " on the line
    last_quote = line.rfind('"')
    
    # Make sure last_quote is valid
    if last_quote <= content_start:
        new_lines.append(line)
        continue
    
    # Build new line: prefix + ` + inner + ` + suffix
    new_line = line[:content_start] + '`' + line[content_start:last_quote] + '`' + line[last_quote+1:]
    new_lines.append(new_line)

with open('index.html', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Done")
