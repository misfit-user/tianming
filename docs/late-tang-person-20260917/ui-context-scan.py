from pathlib import Path
import re
root=Path(__file__).resolve().parents[2]
for p in (root/'web').glob('*.js'):
    if not p.name.startswith(('tm-ai','tm-context','tm-char','tm-game','tm-prompt','tm-endturn','tm-memory','tm-wendui')):continue
    if p.stat().st_size>1500000:continue
    for n,line in enumerate(p.read_text(encoding='utf-8-sig').splitlines(),1):
        if 'historicalSources' in line or 'toAIContext' in line or re.search(r'JSON\.stringify\((?:ch|c|char|npc|person|GM\.chars)[,)]',line):
            print(p.name,n,line[:400])
