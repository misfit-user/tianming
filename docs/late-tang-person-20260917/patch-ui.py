# User-authorized local UI patch, with exact-match edits and before/after hashes.
from pathlib import Path
import hashlib,json,os,sys
w=Path(__file__).parent;r=w.parents[1];changes=[]
def edit(name,fn):
    path=r/name;old=path.read_bytes();text=old.decode('utf-8');new=fn(text).encode('utf-8')
    assert old!=new,name+' unchanged'
    changes.append((name,path,old,new))
def once(text,old,new):
    assert text.count(old)==1,('Nonunique/missing edit',old[:130],text.count(old))
    return text.replace(old,new,1)
def zhi(t):
    nl='\r\n' if '\r\n' in t else '\n'
    code=(w/'source-reader.js.txt').read_text(encoding='utf-8').replace('\r\n','\n').replace('\n',nl)
    t=once(t,'function _zhiOfficeTitles(c){',code+nl+'function _zhiOfficeTitles(c){')
    t=once(t,"['works','文事'],['pov','视角']];","['works','文事'],['pov','视角'],['sources','史料与校勘']];")
    t=once(t,"case 'works':return tabWorks(p);","case 'works':return tabWorks(p);"+nl+"    case 'sources':return tabSources(p);")
    t=once(t,"+_zhiOfficePills(p)+'</div>'","+_zhiOfficePills(p)+_zhiHonoraryPills(p)+'</div>'")
    t=once(t,'  state.sel=p.name;'+nl+'  var tabs=',"  state.sel=p.name;"+nl+"  if(state.tab==='sources')_zhiLoadReference(p);"+nl+'  var tabs=')
    return t
def formal(t):
    old='    var raw = tmfRenwuArray(p && (p.sourceNotes || p.sources || p.historicalSources || p.notes || p.commentary));'
    new="    var raw = []; ['sourceNotes','sources','historicalSources','notes','commentary'].some(function(key){ var a=tmfRenwuArray(p&&p[key]); if(!a.length)return false; raw=a; return true; });"
    return once(t,old,new)
edit('web/tm-renwu-tuzhi.js',zhi)
edit('web/phase8-formal-modules.js',formal)
report=[]
for name,path,old,new in changes:
    report.append({'path':name,'before':hashlib.sha256(old).hexdigest(),'after':hashlib.sha256(new).hexdigest()})
    if '--apply' in sys.argv:
        dest=w/'ui-before'/name;dest.parent.mkdir(parents=True,exist_ok=True)
        if dest.exists(): assert dest.read_bytes()==old,'UI backup differs; stop'
        dest.write_bytes(old)
for name,path,old,new in changes:
    if '--apply' in sys.argv:
        assert path.read_bytes()==old,'Concurrent UI change: '+name
        temp=path.with_name(path.name+'.tang-edit.tmp');temp.write_bytes(new)
        assert path.read_bytes()==old,'Concurrent UI change: '+name
        try: os.replace(temp,path)
        except PermissionError:
            assert path.read_bytes()==old,'Concurrent UI change'
            with path.open('r+b') as stream:
                stream.write(new);stream.truncate();stream.flush();os.fsync(stream.fileno())
        assert path.read_bytes()==new,'UI write verification failed'
(w/'ui-report.json').write_text(json.dumps({'applied':'--apply' in sys.argv,'changes':report},indent=2),encoding='utf-8')
print(json.dumps({'applied':'--apply' in sys.argv,'changes':report}))
