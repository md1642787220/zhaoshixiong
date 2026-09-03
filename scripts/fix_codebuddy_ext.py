import json, os, sys
src = os.path.expanduser(r'~\.vscode\extensions\extensions.json')
dst = os.path.expanduser(r'~\.codebuddycn\extensions\extensions.json')
if not os.path.exists(src):
    sys.exit('VS Code extensions.json not found')
with open(src, 'r', encoding='utf-8') as f:
    src_arr = json.load(f)
with open(dst, 'r', encoding='utf-8') as f:
    dst_arr = json.load(f)

# remove old incompatible / duplicate remotes
forbid = {'jeanp413.open-remote-ssh', 'ms-vscode.remote-explorer', 'ms-vscode-remote.remote-ssh', 'ms-vscode-remote.remote-ssh-edit'}
dst_arr = [e for e in dst_arr if e['identifier']['id'] not in forbid]

ids = {'ms-vscode.remote-explorer', 'ms-vscode-remote.remote-ssh', 'ms-vscode-remote.remote-ssh-edit'}
for e in src_arr:
    if e['identifier']['id'] in ids:
        ne = json.loads(json.dumps(e))  # deep copy
        loc = ne['location']
        loc['path'] = loc['path'].replace('/c:/Users/md164/.vscode/extensions', '/c:/Users/md164/.codebuddycn/extensions')
        if 'fsPath' in loc:
            loc['fsPath'] = loc['fsPath'].replace(r'c:\Users\md164\.vscode\extensions', r'c:\Users\md164\.codebuddycn\extensions')
        if 'external' in loc:
            loc['external'] = loc['external'].replace('Users/md164/.vscode/extensions', 'Users/md164/.codebuddycn/extensions')
        ne['relativeLocation'] = ne['relativeLocation'].replace('.vscode', '.codebuddycn')
        dst_arr.append(ne)

with open(dst, 'w', encoding='utf-8') as f:
    json.dump(dst_arr, f, ensure_ascii=False, separators=(',',':'))

print('done')
for e in dst_arr:
    print(e['identifier']['id'], '->', e['relativeLocation'])
