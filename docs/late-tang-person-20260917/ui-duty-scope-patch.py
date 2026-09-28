from pathlib import Path
import json,hashlib,datetime,os,subprocess
w=Path(__file__).parent;r=w.parents[1];p=r/'web/tm-office-system.js'
before=p.read_bytes();t=before.decode('utf-8');nl='\r\n' if '\r\n' in t else '\n'
def once(old,new):
    global t
    old=old.replace('\n',nl);new=new.replace('\n',nl)
    assert t.count(old)==1,'Current source changed; inspect before editing'
    t=t.replace(old,new,1)
once('  if (!ct || !np) return 0;\n  var sc = 0;', '''  if (!ct || !np) return 0;
  // A duty or honorary designation is not a substantive office with a similar name.
  // Preserve exact authored seats, including explicitly modeled duty positions.
  if (ct !== np && ct !== nd + np && /^(?:检校|追赠|赠|加衔|(?:权)?判.+事$)/.test(ct)) return 0;
  var sc = 0;''')
once('var fresh = parts.filter(function(x){ return !seen[x]; });', "var fresh = parts.filter(function(x){ return !seen[x.replace(/^兼(?:任)?/, '')]; });")
once('parts.forEach(function(x){ seen[x] = true; });', "parts.forEach(function(x){ seen[x.replace(/^兼(?:任)?/, '')] = true; });")
after=t.encode('utf-8');candidate=w/'ui-duty-candidate.js';candidate.write_bytes(after)
check=subprocess.run(['node','--check',str(candidate)],capture_output=True,text=True);assert check.returncode==0,check.stderr
backup=w/('ui-duty-before-'+datetime.datetime.now().strftime('%H%M%S')+'.js');backup.write_bytes(before)
assert p.read_bytes()==before,'Concurrent edit detected'
with p.open('r+b') as stream:stream.write(after);stream.truncate();stream.flush();os.fsync(stream.fileno())
assert p.read_bytes()==after,'Read-back mismatch'
(w/'ui-duty-installed.json').write_text(json.dumps({'file':'web/tm-office-system.js','backup':str(backup),'before':hashlib.sha256(before).hexdigest(),'after':hashlib.sha256(after).hexdigest()},indent=2),encoding='utf-8')
print('Installed bounded duty/title matching correction; original bytes backed up.')
