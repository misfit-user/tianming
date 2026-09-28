from pathlib import Path
import json,datetime
w=Path(__file__).parent;r=w.parents[1]
files=[]
for line in (w/'runtime-deltas.txt').read_text(encoding='utf-8').splitlines():
 if line.startswith('diff --git a/'):
  name=line.split(' b/',1)[1]
  if '/bundled-scenarios/' not in name:files.append(name)
folders=[r/'web']
folders += [x for x in (r/'web').glob('.bak-*') if x.is_dir()]
folders += [r/'.bak-tang-completion-20260917-173435/web',r/'docs/bugfix-territory-hardening-2026-09-17/originals']
result={}
for name in files:
 found=[]
 for folder in folders:
  for x in folder.glob(Path(name).name+'*'):
   if x.is_file() and x!=r/name and x.stat().st_mtime>=datetime.datetime(2026,9,17).timestamp():
    found.append({'path':str(x),'mtime':datetime.datetime.fromtimestamp(x.stat().st_mtime).isoformat()})
 result[name]=sorted(found,key=lambda x:x['mtime'])
(w/'merge-base-candidates.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
for k,v in result.items():print(k,json.dumps(v[:5],ensure_ascii=False),flush=True)
