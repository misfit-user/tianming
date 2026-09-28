from pathlib import Path
import datetime,hashlib,json,os,subprocess
w=Path(__file__).parent;r=w.parents[1];changes=[]
def edit(rel,old,new):
    p=r/rel;before=p.read_bytes();t=before.decode('utf-8');nl='\r\n' if '\r\n' in t else '\n'
    old=old.replace('\n',nl);new=new.replace('\n',nl);assert t.count(old)==1,rel+' changed'
    after=t.replace(old,new,1).encode('utf-8');candidate=w/('ui-unknown-candidate-'+p.name);candidate.write_bytes(after)
    checked=subprocess.run(['node','--check',str(candidate)],capture_output=True,text=True);assert checked.returncode==0,checked.stderr
    changes.append((rel,p,before,after))
edit('web/tm-patches-start.js',"            // 职位空缺 → 从角色的title/officialTitle中寻找匹配\n            var posName = pos.name || '';", "            // 未考定不是空缺，不能用人物描述猜出一个在任者。\n            if (pos.occupancyStatus === 'unrecorded') return;\n            // 职位空缺 → 从角色的title/officialTitle中寻找匹配\n            var posName = pos.name || '';")
edit('web/tm-office-system.js','      if (slots[si].fill.length >= slots[si].cap) continue;\n      var s = _offTitleSlotScore(claims[ci].title, slots[si].dept, slots[si].posName, false);','      if (slots[si].fill.length >= slots[si].cap) continue;\n      // Authored unknown holders are not vacancies for fuzzy auto-appointment.\n      if (slots[si].pos.occupancyStatus === \'unrecorded\') continue;\n      var s = _offTitleSlotScore(claims[ci].title, slots[si].dept, slots[si].posName, false);')
backup=w/('ui-unknown-before-'+datetime.datetime.now().strftime('%H%M%S'));backup.mkdir()
for rel,p,before,after in changes:assert p.read_bytes()==before,'Concurrent modification: '+rel
report=[]
for rel,p,before,after in changes:
    (backup/p.name).write_bytes(before)
    assert p.read_bytes()==before,'Concurrent modification: '+rel
    with p.open('r+b') as f:f.write(after);f.truncate();f.flush();os.fsync(f.fileno())
    assert p.read_bytes()==after
    report.append({'file':rel,'before':hashlib.sha256(before).hexdigest(),'after':hashlib.sha256(after).hexdigest()})
(w/'ui-unknown-installed.json').write_text(json.dumps({'backup':str(backup),'files':report},indent=2),encoding='utf-8')
print('Protected explicitly unknown office holders at startup and subsequent derivation.')
