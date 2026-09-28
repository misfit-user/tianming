from pathlib import Path
import re
root=Path(__file__).resolve().parents[2]
for p in (root/'web').glob('*.js'):
    if p.stat().st_size>1000000 or not p.name.startswith('tm-'):continue
    text=p.read_text(encoding='utf-8-sig')
    if not ('holder' in text and 'officialTitle' in text):continue
    lines=text.splitlines();hits=[]
    for n,line in enumerate(lines):
        if re.search(r'(?:officialTitle|titleParts|charTitle|_title).*indexOf|(?:indexOf|includes)\(.*(?:title|\.name)|function.*(?:Init|init).*Office',line):hits.append(n)
    for n in hits:
        print(p.name,n+1,'\n'.join(lines[max(0,n-2):n+3])[:950])
