# Merge scratch copies by content, then retain original line endings for every unchanged line.
from pathlib import Path
import json,subprocess,difflib
w=Path(__file__).parent;r=w.parents[1]
target=Path('E:/tianming-wuchang-pages-20260917');snap=w/'.snapshots'
rows=json.loads((w/'merge-runtime-report.json').read_bytes());out=[]
def normalized(data):return data.replace(b'\r\n',b'\n')
for row in rows:
 if not row['mergeExit']:continue
 name=row['path'];parts={side:(snap/side/name).read_bytes() for side in ['main','base','local']}
 for side,data in parts.items():
  p=snap/('normalized-'+side)/name
  p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(normalized(data))
 run=subprocess.run(['git','merge-file','-p','--diff3',str(snap/'normalized-main'/name),str(snap/'normalized-base'/name),str(snap/'normalized-local'/name)],cwd=r,capture_output=True)
 status={'path':name,'conflicts':run.returncode}
 if run.returncode==0:
  merged=run.stdout.splitlines(keepends=True);restored={}
  for side in ['main','local']:
   original=parts[side].splitlines(keepends=True);canon=[normalized(x) for x in original]
   for tag,a,b,c,d in difflib.SequenceMatcher(None,canon,merged,autojunk=False).get_opcodes():
    if tag=='equal':
     for i,j in zip(range(a,b),range(c,d)):restored.setdefault(j,original[i])
  nl=b'\r\n' if parts['main'].count(b'\r\n')>len(parts['main'].splitlines())/2 else b'\n'
  output=b''.join(restored.get(i,line[:-1]+nl if line.endswith(b'\n') else line) for i,line in enumerate(merged))
  (target/name).write_bytes(output)
 else:
  p=snap/'semantic-conflicts'/name
  p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(run.stdout)
 out.append(status);print(status,flush=True)
(w/'semantic-merge-report.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
