from pathlib import Path
import json,subprocess,hashlib,datetime
w=Path(__file__).parent;r=w.parents[1];target=Path('E:/tianming-wuchang-pages-20260917');snap=w/'.snapshots';snap.mkdir(exist_ok=True)
BASE='3f8065cb9cf09b414cf35dc3deccca59560f733b'
def git(*a):return subprocess.run(['git',*a],cwd=r,capture_output=True)
files=[]
for line in (w/'runtime-deltas.txt').read_text(encoding='utf-8').splitlines():
 if line.startswith('diff --git a/'):
  name=line.split(' b/',1)[1]
  if '/bundled-scenarios/' not in name:files.append(name)
backups=json.loads((w/'merge-base-candidates.json').read_bytes());results=[]
for name in files:
 local=(r/name).read_bytes();remote=(target/name).read_bytes()
 assert local and remote,(name,'empty while another editor writes; stop')
 choices=backups.get(name,[])
 if name in ['web/tm-office-system.js','web/tm-renwu-tuzhi.js','web/phase8-formal-modules.js','web/tm-chaoyi-tinyi.js','web/tm-shizheng-panel.js','web/tm-endturn-apply.js'] and choices:
  basePath=Path(choices[0]['path']);base=basePath.read_bytes();baseLabel=str(basePath)
 else:
  got=git('show',BASE+':'+name);base=got.stdout if got.returncode==0 else b'';baseLabel=BASE
 for side,data in [('main',remote),('base',base),('local',local)]:
  p=snap/side/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
 merged=git('merge-file','-p','--diff3',str(snap/'main'/name),str(snap/'base'/name),str(snap/'local'/name))
 row={'path':name,'base':baseLabel,'localSha256':hashlib.sha256(local).hexdigest(),'mainSha256':hashlib.sha256(remote).hexdigest(),'mergeExit':merged.returncode}
 if merged.returncode==0:
  assert (r/name).read_bytes()==local,'Concurrent edit: '+name
  (target/name).write_bytes(merged.stdout);row['mergedSha256']=hashlib.sha256(merged.stdout).hexdigest()
 else:
  p=snap/'conflicts'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(merged.stdout);row['error']=merged.stderr.decode('utf-8',errors='replace')
 results.append(row);print(name,merged.returncode,flush=True)
 (w/'merge-runtime-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
