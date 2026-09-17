from pathlib import Path
import re
root=Path(__file__).resolve().parents[2]
for p in (root/'web').glob('*.js'):
    if p.stat().st_size>1200000:continue
    for i,line in enumerate(p.read_text(encoding='utf-8-sig').splitlines(),1):
        if re.search(r'\.holder\s*=(?!=)|holder\s*:\s*(?:ch|c|name|char)',line):
            print(p.name,i,line.strip()[:300])
