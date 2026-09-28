# Only relocate our own hash-verified UI staging files; no user saves or other sessions.
from pathlib import Path
import json,hashlib
w=Path(__file__).parent;r=w.parents[1]
report=json.loads((w/'ui-report.json').read_bytes());out=[]
for item in report['changes']:
    target=r/item['path'];p=target.with_name(target.name+'.tang-edit.tmp')
    if not p.exists():continue
    assert hashlib.sha256(p.read_bytes()).hexdigest()==item['after'],'Unrecognized staging bytes: '+str(p)
    dest=w/'ui-before'/(p.name+'.retained')
    assert not dest.exists(),'Destination already exists'
    p.rename(dest);out.append({'from':str(p),'to':str(dest)})
(w/'staging-cleanup.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print('Relocated own staging files:',len(out))
