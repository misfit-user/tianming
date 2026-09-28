from pathlib import Path
import json,re,subprocess,hashlib,datetime
w=Path(__file__).parent;r=w.parents[1];text=(w/'runtime-deltas.txt').read_text(encoding='utf-8');out=[]
for block in re.split(r'(?=^diff --git )',text,flags=re.M):
 if not block.strip():continue
 lines=block.splitlines();name=lines[0].split(' b/',1)[1]
 if '/bundled-scenarios/' in name:continue
 out.append(lines[0]);add=sum(x.startswith('+')and not x.startswith('+++') for x in lines);drop=sum(x.startswith('-')and not x.startswith('---') for x in lines)
 out.append('ADDED '+str(add)+' REMOVED '+str(drop))
 for line in lines:
  if line.startswith('@@') or (line.startswith('-') and not line.startswith('---')):out.append(line[:500])
 (w/('delta-'+Path(name).name+'.txt')).write_text(block,encoding='utf-8')
(w/'deleted-lines-review.txt').write_text('\n'.join(out),encoding='utf-8')
for p in [r/'scenarios/绍宋·建炎元年八月（官方）.json',r/'scenarios/晚唐·开成五年（官方）.json']:
 s=json.loads(p.read_bytes());print(p.name,hashlib.sha256(p.read_bytes()).hexdigest(),len(s['map']['regions']),len(s['characters']),s.get('nativeStart'),s.get('mapMetadata'),flush=True)
