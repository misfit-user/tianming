from pathlib import Path
import hashlib,json,datetime,subprocess,os
root=Path(__file__).resolve().parents[2]
work=Path(__file__).parent
patches=[]
def stage(rel, replacements):
    p=root/rel; before=p.read_bytes(); text=before.decode('utf-8'); nl='\r\n' if b'\r\n' in before else '\n'
    for old,new in replacements:
        old=old.replace('\n',nl);new=new.replace('\n',nl)
        if text.count(old)!=1: raise RuntimeError('Target changed; re-read required: '+rel+' / '+old[:70])
        text=text.replace(old,new,1)
    candidate=work/('ui-dedupe-candidate-'+p.name)
    after=text.encode('utf-8');candidate.write_bytes(after)
    checked=subprocess.run(['node','--check',str(candidate)],capture_output=True,text=True)
    if checked.returncode: raise RuntimeError(checked.stderr)
    patches.append((p,before,after))
dedupe='''  var titles = _offUniqueTitles(arr);
  if (!opts || !opts.displayOnly) return titles;
  // Display only: composite titles and separately registered seats must not repeat.
  // Exact components, not substring matching: 检校礼部尚书 is not 礼部尚书.
  var seen = Object.create(null), out = [];
  titles.forEach(function(t) {
    var parts = /[（(]/.test(t) ? [t] : t.split(/[·、，,；;]/).map(function(x){ return x.trim(); }).filter(Boolean);
    var fresh = parts.filter(function(x){ return !seen[x]; });
    if (!fresh.length) return;
    out.push(fresh.length === parts.length ? t : fresh.join('、'));
    parts.forEach(function(x){ seen[x] = true; });
  });
  return out;'''
stage('web/tm-office-system.js',[
 ('function _offGetCharOfficeTitles(ch) {','function _offGetCharOfficeTitles(ch, opts) {'),
 ('  return _offUniqueTitles(arr);\n}\n\n// 显示用',dedupe+'\n}\n\n// 显示用'),
 ('  var titles = _offGetCharOfficeTitles(ch);\n  if (!titles.length) return (opts.fallback', '  var titles = _offGetCharOfficeTitles(ch, { displayOnly: true });\n  if (!titles.length) return (opts.fallback')
])
stage('web/tm-renwu-tuzhi.js',[
 ("var a=_offGetCharOfficeTitles(c);if(a&&a.length)return a;", "var a=_offGetCharOfficeTitles(c,{displayOnly:true});if(a&&a.length)return a;")
])
# Compare every file again before the first write; do not overwrite concurrent edits.
for p,before,after in patches:
    if p.read_bytes()!=before: raise RuntimeError('Concurrent modification: '+str(p))
backup=root/('.bak-tang-ui-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir(exist_ok=False)
report=[]
for p,before,after in patches:
    rel=p.relative_to(root); target=backup/rel;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(before)
    tmp=p.with_name(p.name+'.tang-ui-tmp');tmp.write_bytes(after)
    if p.read_bytes()!=before: raise RuntimeError('Concurrent modification during install: '+str(p))
    try:
        os.replace(tmp,p)
    except PermissionError:
        # Windows may deny delete-sharing while allowing authorized writes.
        if p.read_bytes()!=before: raise RuntimeError("Concurrent edit before fallback")
        with p.open("r+b") as handle:
            handle.write(after);handle.truncate();handle.flush();os.fsync(handle.fileno())
        if p.read_bytes()!=after: raise RuntimeError("Write verification failed")
        tmp.unlink(missing_ok=True)
    report.append({'file':str(rel),'before':hashlib.sha256(before).hexdigest(),'after':hashlib.sha256(p.read_bytes()).hexdigest()})
(work/'ui-dedupe-installed.json').write_text(json.dumps({'backup':str(backup),'files':report},indent=2),encoding='utf-8')
print('INSTALLED',len(report),'files; backup',backup)
