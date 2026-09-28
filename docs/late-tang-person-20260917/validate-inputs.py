from pathlib import Path
import json,hashlib
w=Path(__file__).parent;r=w.parents[1]
rows=[json.loads(line) for p in sorted(w.glob('history-*.ndjson')) for line in p.read_text(encoding='utf-8').splitlines() if line.strip()]
s=json.loads((r/'scenarios/晚唐·开成五年（官方）.json').read_bytes()); cs=s['characters']
groups=json.loads((w/'skills-groups.json').read_bytes()); indexes=[i for g in groups for i in g['indexes']]
assert len(rows)==81 and len({v[1] for v in rows})==81
assert len(indexes)==len(set(indexes))==353
assert set(indexes)|{x[0] for x in rows}==set(range(434))
for i,cid,name,fields,quotes,notes in rows:
    assert (cs[i]['id'],cs[i]['name'],cs[i]['isHistorical'])==(cid,name,True),(i,name)
assert all(not cs[i]['isHistorical'] for i in indexes)
print('INPUT_MATCH',len(rows),len(indexes),'QUOTED',sum(bool(x[4]) for x in rows))
print('RECORDS_SHA',hashlib.sha256(json.dumps(rows,ensure_ascii=True,separators=(',',':')).encode()).hexdigest())
print('BEFORE',json.loads((w/'before.json').read_bytes())['_backup'])
def walk(v,p=''):
    if isinstance(v,dict):
        yield p,v
        for k,x in v.items(): yield from walk(x,p+'/'+str(k))
    elif isinstance(v,list):
        for i,x in enumerate(v): yield from walk(x,p+'/'+str(i))
for p,x in walk(s['officeTree']):
    if x.get('name') in ['户部尚书','户部侍郎','度支使','河中节度使','礼部尚书'] or x.get('holder') in ['郑肃','崔龟从','杜悰']:
        print('POSITION',p,{k:x.get(k) for k in ['id','name','holder','holderId','occupancyStatus']})
print('REGIONS',[(x.get('id'),x.get('name')) for x in s['map']['regions'] if x.get('name')=='河中府'])
