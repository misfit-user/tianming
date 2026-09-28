from pathlib import Path
import json,subprocess,hashlib,datetime,collections
w=Path(__file__).parent;r=w.parents[1]
def git(*args):return subprocess.run(['git',*args],cwd=r,capture_output=True,check=True).stdout
p=r/'scenarios/晚唐·开成五年（官方）.json';s=json.loads(p.read_bytes());cs=s['characters']
fields=['id','name','age','isHistorical','isPlayer','officialTitle','traits','traitIds','personality','behaviorMode','personalGoal','description','bio','historicalFacts','learning','skills','redLines','coreMotivations','benevolence','integrity','intelligence','administration','management','military','diplomacy','wuchang','wuchangOverride']
profiles=[{k:c[k] for k in fields if k in c} for c in cs]
(w/'profiles.json').write_text(json.dumps(profiles,ensure_ascii=False,indent=2),encoding='utf-8')
(w/'historical-profiles.ndjson').write_text('\n'.join(json.dumps(c,ensure_ascii=False) for c in profiles if c['isHistorical'])+'\n',encoding='utf-8')
(w/'fictional-profiles.ndjson').write_text('\n'.join(json.dumps(c,ensure_ascii=False) for c in profiles if not c['isHistorical'])+'\n',encoding='utf-8')
print('PEOPLE',len(cs),'HISTORICAL',sum(c['isHistorical'] for c in cs),'FIVE_FIELDS',collections.Counter(k for c in cs for k in ['wuchang','wuchangOverride'] if c.get(k)))
print('EXISTING',[(c['name'],c.get('wuchang'),c.get('wuchangOverride')) for c in cs if c.get('wuchang') or c.get('wuchangOverride')])
print('ROOT_SHA',hashlib.sha256(p.read_bytes()).hexdigest())
print('RELEASE_DOCS',[x.name for x in (r/'docs').iterdir() if any(v in x.name.lower() for v in ['release','deploy','ship','publish'])])
print('MAIN_BASE',git('merge-base','HEAD','origin/main').decode().strip())
print('ROOT_DIRS',[x.name for x in r.iterdir() if x.is_dir() and x.name not in ['.git','node_modules']])
status=git('status','--porcelain=v1','-z','-uall');(w/'status-before.txt').write_bytes(status.replace(b'\0',b'\n'))
main=json.loads(git('ls-tree','-r','--full-tree','origin/main','--name-only').decode().encode() or b'[]') if False else git('ls-tree','-r','--name-only','origin/main').decode().splitlines()
local_changes=[]
for name in main:
    if not name.startswith(('web/','scripts/','scenarios/','.github/')) and name not in ['package.json','package-lock.json']:continue
    file=r/name
    if not file.exists():local_changes.append([name,'missing-local']);continue
    if file.is_file() and git('hash-object',str(file)).decode().strip()!=git('rev-parse','origin/main:'+name).decode().strip():local_changes.append([name,'different'])
(w/'main-diff-files.json').write_text(json.dumps(local_changes,ensure_ascii=False,indent=2),encoding='utf-8')
print('MAIN_DIFF_COUNT',len(local_changes));print('MAIN_DIFF',json.dumps(local_changes,ensure_ascii=False))
