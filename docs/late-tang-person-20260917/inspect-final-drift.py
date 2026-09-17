from pathlib import Path
import json,hashlib,datetime
w=Path(__file__).parent;r=w.parents[1];m=json.loads((w/'before.json').read_bytes());q='scenarios/晚唐·开成五年（官方）.json'
a=json.loads((Path(m['_backup'])/q).read_bytes());raw=(r/q).read_bytes();b=json.loads(raw);report=json.loads((w/'content-report.json').read_bytes())
drift=[k for k in report['unchangedTopLevel'] if a[k]!=b[k]]
print('CURRENT_SHA',hashlib.sha256(raw).hexdigest(),'PREVIOUS_VERIFIED_SHA',report['sourceAfter'],'MTIME',datetime.datetime.fromtimestamp((r/q).stat().st_mtime).isoformat())
print('UNRELATED_CHANGED_KEYS',drift)
for k in drift:
 print('CHANGE',k,'BEFORE',str(a[k])[:900],'NOW',str(b[k])[:900])
expected={x['id']:set(x['fields']) for x in report['changed']};unplanned=[]
for x,y in zip(a['characters'],b['characters']):
 for k in set(x)|set(y):
  if k not in expected[y['id']] and x.get(k)!=y.get(k):unplanned.append([y['name'],k,str(x.get(k))[:120],str(y.get(k))[:120]])
print('UNPLANNED_CHARACTER_CHANGES',unplanned)
(w/'concurrent-tang-drift.json').write_text(json.dumps({'sha':hashlib.sha256(raw).hexdigest(),'previousVerifiedSha':report['sourceAfter'],'unrelatedKeys':drift,'unplannedCharacterChanges':unplanned},ensure_ascii=False,indent=2),encoding='utf-8')
