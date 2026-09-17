from pathlib import Path
import json,subprocess,datetime,hashlib,collections
w=Path(__file__).parent;r=w.parents[1]
def git(*a):return subprocess.run(['git',*a],cwd=r,capture_output=True,check=True).stdout
main={}
for row in git('ls-tree','-r','-z','origin/main').split(b'\0'):
 if row:
  meta,name=row.split(b'\t',1);main[name.decode()]=meta.split()[2].decode()
selected=[];out=[]
for name in main:
 p=r/name
 if name.startswith('web/') and p.is_file() and p.suffix in ['.js','.json','.html'] and p.stat().st_size<1500000 and p.stat().st_mtime>=datetime.datetime(2026,9,17).timestamp():
  data=p.read_bytes();h=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
  if h!=main[name]:
   selected.append(name);out.append(git('diff','origin/main','--',name).decode('utf-8'))
(w/'runtime-deltas.txt').write_text('\n'.join(out),encoding='utf-8')
untracked=[x.decode() for x in git('ls-files','--others','--exclude-standard','-z').split(b'\0') if x]
new=[n for n in untracked if n not in main and n.startswith(('web/','scripts/')) and (r/n).is_file() and (r/n).suffix in ['.js','.cjs','.mjs','.json','.html'] and not any(v in n for v in ['backup','originals','test-results','userdata','candidate','.bak','runtime-full','node_modules'])]
(w/'new-runtime-files.json').write_text(json.dumps(new,ensure_ascii=False,indent=2),encoding='utf-8')
print('FRESH_EXISTING',selected);print('NEW_RUNTIME',new)
for p in (r/'scenarios').glob('*（官方）.json'):
 s=json.loads(p.read_bytes());sizes=sorted([(k,len(json.dumps(v,ensure_ascii=False,separators=(',',':')).encode())) for k,v in s.items()],key=lambda x:-x[1])
 print('SOURCE_SIZE',p.name,len(p.read_bytes()),sizes[:8])
