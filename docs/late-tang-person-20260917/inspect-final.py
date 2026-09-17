from pathlib import Path
import json,re,hashlib
w=Path(__file__).parent;r=w.parents[1]
s=json.loads((r/'scenarios/晚唐·开成五年（官方）.json').read_bytes());cs=s['characters']
print('POSITIONS',[(c['name'],c.get('officialTitle'),c.get('factionId')) for c in cs if c['isHistorical']])
print('FACTIONS',[(f.get('id'),f.get('name')) for f in s['factions']][:8])
for file,pat in [('web/tm-renwu-tuzhi.js',r'var TABS|function tabOverview|function _zhiOfficeTitles|function _zhiOfficePills'),('web/tm-char-full-schema.js',r'function ensureFullFields|function toAIContext'),('web/tm-office-system.js',r'window\._off|function _offNormalizeTitleName'),('web/index.html',r'tm-renwu-tuzhi.js|tm-office-system.js')]:
 p=r/file;lines=p.read_text(encoding='utf-8-sig').splitlines();print('FILE',file,'HASH',hashlib.sha256(p.read_bytes()).hexdigest())
 for i,line in enumerate(lines):
  if re.search(pat,line): print('LINES',i+1,'\n'.join(lines[i:i+14]))
print('ARCH_SCRIPTS',[p.name for p in (r/'web/scripts').glob('smoke-*office*')])
print('FISCAL_OWNERS')
for d in s['officeTree']:
 for p in d.get('positions',[]):
  if any(x in p.get('name','') for x in ['度支','户部','河中','盐铁']) and p.get('holder'):print(d['name'],p['name'],p['holder'])
