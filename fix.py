import re

with open('server.ts', 'r') as f:
    content = f.read()

# find where we need to close the string
target = "// Real-time Event Emitter for Live Video Broadcast Updates (SSE & status sync)"
idx = content.find(target)
if idx != -1:
    content = content[:idx] + "`;\n\n" + content[idx:]
    with open('server.ts', 'w') as f:
        f.write(content)
    print("Fixed!")
else:
    print("Not found!")
