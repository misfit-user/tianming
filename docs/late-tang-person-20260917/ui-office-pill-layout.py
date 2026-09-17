from pathlib import Path
import hashlib,json,datetime,os
w=Path(__file__).parent;r=w.parents[1];p=r/'web/tm-renwu-tuzhi.js';raw=p.read_bytes()
old=b'.dh-pills{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;}'
new=b'.dh-pills{display:flex;flex-wrap:wrap;gap:6px;margin:8px 88px 8px 0;}'
assert raw.count(old)==1,'Current component layout changed'
after=raw.replace(old,new,1);backup=w/('ui-pill-layout-before-'+datetime.datetime.now().strftime('%H%M%S')+'.js');backup.write_bytes(raw)
assert p.read_bytes()==raw
with p.open('r+b') as f:f.write(after);f.truncate();f.flush();os.fsync(f.fileno())
assert p.read_bytes()==after
(w/'ui-pill-layout-installed.json').write_text(json.dumps({'file':'web/tm-renwu-tuzhi.js','backup':str(backup),'before':hashlib.sha256(raw).hexdigest(),'after':hashlib.sha256(after).hexdigest(),'reason':'Reserve space for the existing loyalty ring so newly preserved additional offices wrap without overlap.'},indent=2),encoding='utf-8')
print('Additional office badges reserve room for the existing loyalty ring.')
