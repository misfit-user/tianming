from pathlib import Path
import subprocess,hashlib,json
w=Path(__file__).parent;r=w.parents[1];p=r/'web/scripts/smoke-military-execution-binding.js';old=p.read_bytes()
a="ok(e.stages[2].note==='空缺','unknown fiscal incumbent remains vacant');".encode('utf-8')
b="ok(e.stages[2].officer==='杜悰'&&e.stages[2].note!=='空缺','documented Tang fiscal incumbent Du Cong resolves: '+JSON.stringify(e.stages[2]));".encode('utf-8')
assert old.count(a)==1
(w/'smoke-military-execution-binding.before.js.txt').write_bytes(old)
new=old.replace(a,b);assert p.read_bytes()==old;p.write_bytes(new)
(w/'office-fixture-report.json').write_text(json.dumps({'reason':'20260917历史校订已据本传补入杜悰；末尾独立的真空缺负例保留','before':hashlib.sha256(old).hexdigest(),'after':hashlib.sha256(new).hexdigest()},ensure_ascii=False,indent=2),encoding='utf-8')
with (w/'office-fixture-final.log').open('wb') as log:result=subprocess.run(['node',str(p)],cwd=r,stdout=log,stderr=subprocess.STDOUT)
print('OFFICE_FIXTURE_EXIT',result.returncode)
