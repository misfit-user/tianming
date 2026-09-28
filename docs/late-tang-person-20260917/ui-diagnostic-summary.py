from pathlib import Path
import json
w=Path(__file__).parent
r=json.loads((w/'runtime-full/office-diagnostic.json').read_bytes())
print('PEOPLE',r['people'])
print('SEATS',[p for p in r['seats'] if p['name'] in ['河中节度使','户部尚书','户部侍郎','吏部尚书']])
print('CLAIMS',r['diagnostic']['claims'])
print('SCORE',r['diagnostic']['score'])
root=w.parents[1];s=json.loads((root/'scenarios/晚唐·开成五年（官方）.json').read_bytes())
for d in s['officeTree']:
 for p in d.get('positions',[]):
  if p.get('name') in ['河中节度使','户部尚书','户部侍郎']:print('SOURCE',d['name'],p)
