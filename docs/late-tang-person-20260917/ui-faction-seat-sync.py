from pathlib import Path
import json,hashlib,os,datetime,sys
w=Path(__file__).parent;r=w.parents[1];p=r/'scenarios/晚唐·开成五年（官方）.json'
raw=p.read_bytes();s=json.loads(raw);wanted={'office-2da9bdae1f01','office-e89790fddee5','office-43a6e9e38b0c'}
def positions(nodes):
    for d in nodes:
        yield from d.get('positions',[])
        yield from positions(d.get('subs',[]))
canonical={x['id']:x for x in positions(s['officeTree']) if x.get('id') in wanted}
assert set(canonical)==wanted
changes=[]
for fi,f in enumerate(s['factions']):
    for old in positions(f.get('officeTree',[])):
        if old.get('id') not in canonical:continue
        new=canonical[old['id']]
        keys=['holder','holderId','occupancyStatus','vacancyCount','actualHolders','additionalHolders','additionalHolderIds','actualCount','unrecordedCount']
        for k in keys:
            ov=old.get(k);nv=new.get(k)
            if ov==nv:continue
            changes.append({'factionIndex':fi,'faction':f['name'],'officeId':old['id'],'key':k,'before':ov,'after':nv})
            if k in new:old[k]=new[k]
            else:old.pop(k,None)
print('PROPOSED',json.dumps(changes,ensure_ascii=False),flush=True)
if '--apply' not in sys.argv:raise SystemExit(0)
assert changes and len({x['officeId'] for x in changes})==3
# Replace only the exact top-level factions value, preserving all other source bytes.
text=raw.decode('utf-8');decoder=json.JSONDecoder();i=1;found=None
while i<len(text):
    while text[i].isspace() or text[i]==',':i+=1
    if text[i]=='}':break
    key,end=decoder.raw_decode(text,i);i=end
    while text[i].isspace():i+=1
    assert text[i]==':';i+=1
    while text[i].isspace():i+=1
    start=i;value,i=decoder.raw_decode(text,i)
    if key=='factions':found=(start,i);break
assert found
repl=json.dumps(s['factions'],ensure_ascii=False,separators=(',',':'))
updated=(text[:found[0]]+repl+text[found[1]:]).encode('utf-8');decoded=json.loads(updated)
assert decoded==s
backup=w/('tang-before-faction-seat-sync-'+datetime.datetime.now().strftime('%H%M%S')+'.json');backup.write_bytes(raw)
assert p.read_bytes()==raw,'Concurrent source modification; re-read required'
with p.open('r+b') as f:f.write(updated);f.truncate();f.flush();os.fsync(f.fileno())
assert p.read_bytes()==updated
report={'changes':changes,'backup':str(backup),'before':hashlib.sha256(raw).hexdigest(),'after':hashlib.sha256(updated).hexdigest()}
(w/'ui-faction-seat-sync.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('INSTALLED source SHA256',report['after'])
