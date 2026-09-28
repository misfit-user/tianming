from pathlib import Path
import hashlib,json,datetime,os,subprocess
w=Path(__file__).parent;r=w.parents[1];p=r/'web/tm-office-system.js'
raw=p.read_bytes();old=b'if (opts.concurrent && currentMain && currentMain !== title) {';new=b'if (opts.concurrent && currentMain) {'
assert raw.count(old)==1,'Source changed; re-read before patching'
after=raw.replace(old,new,1);backup=w/('ui-import-before-'+datetime.datetime.now().strftime('%H%M%S')+'.js');backup.write_bytes(raw)
candidate=w/'ui-import-candidate.js';candidate.write_bytes(after)
a=subprocess.run(['node','--check',str(candidate)],capture_output=True,text=True);assert a.returncode==0,a.stderr
assert p.read_bytes()==raw,'Concurrent modification'
with p.open('r+b') as f:f.write(after);f.truncate();f.flush();os.fsync(f.fileno())
assert p.read_bytes()==after
(w/'ui-import-installed.json').write_text(json.dumps({'file':'web/tm-office-system.js','backup':str(backup),'before':hashlib.sha256(raw).hexdigest(),'after':hashlib.sha256(after).hexdigest(),'reason':'Importing an already held main office concurrently must not erase legitimate additional posts.'},indent=2),encoding='utf-8')
print('Concurrent main-office reimport now preserves existing additional posts; replacement appointments unchanged.')
