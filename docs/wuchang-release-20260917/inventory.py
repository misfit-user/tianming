from pathlib import Path
import subprocess,hashlib,json,datetime
w=Path(__file__).parent;r=w.parents[1]
def git(*a):return subprocess.run(['git',*a],cwd=r,capture_output=True,check=True).stdout
raw=git('ls-tree','-r','-z','origin/main');rows=[];errors=[]
for entry in raw.split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1);mode,kind,sha=meta.split();name=name.decode('utf-8')
 if kind!=b'blob' or not name.startswith(('web/','scripts/','scenarios/','.github/','hooks/','mobile/','main','preload','package','.gitattributes')):continue
 p=r/name
 if not p.is_file():rows.append({'path':name,'status':'missing-local','main':sha.decode()});continue
 try:data=p.read_bytes()
 except OSError as e:errors.append({'path':name,'error':str(e)});continue
 local=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
 if local!=sha.decode():rows.append({'path':name,'status':'different','main':sha.decode(),'local':local,'bytes':len(data),'mtime':datetime.datetime.fromtimestamp(p.stat().st_mtime).isoformat()})
(w/'main-diff-files.json').write_text(json.dumps({'rows':rows,'readErrors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print('DIFFS',len(rows),'ERRORS',errors);print(json.dumps(rows,ensure_ascii=False))
profiles=json.loads((w/'profiles.json').read_bytes());f=[c for c in profiles if not c['isHistorical']]
text='\n'.join(str(i)+' | '+c['name']+' | '+','.join(c.get('traitIds') or c.get('traits') or [])+' | '+c.get('personality','')+' | '+c.get('personalGoal','') for i,c in enumerate(f))
(w/'fictional-review.txt').write_text(text+'\n',encoding='utf-8')
print('FICTIONAL_REVIEW_READY',len(f))
