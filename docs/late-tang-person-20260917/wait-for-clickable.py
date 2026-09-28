from pathlib import Path
import subprocess,os
w=Path(__file__).parent;r=w.parents[1];p=w/'electron-cases.cjs';t=p.read_text(encoding='utf-8')
a=t.index('  const hit=await js(');b=t.index("assert.equal(hit,true,'source tab must be reachable');",a)
replacement="  const hit=await js(`(async()=>{for(let i=0;i<25;i++){const b=Array.from(document.querySelectorAll('#tm-zhi-main .tab')).find(x=>x.textContent==='史料与校勘');if(!b)return false;b.scrollIntoView({block:'nearest',inline:'nearest'});await new Promise(r=>setTimeout(r,80));const v=b.getBoundingClientRect(),top=document.elementFromPoint(v.x+v.width/2,v.y+v.height/2);if((top===b||b.contains(top))&&v.width>0&&v.height>0){b.click();return true;}}return false;})()`);"
p.write_text(t[:a]+replacement+t[b:],encoding='utf-8')
(w/'electron-before-click-wait.json').write_bytes((w/'electron-report.json').read_bytes())
env=os.environ.copy();env.pop('ELECTRON_RUN_AS_NODE',None)
with (w/'electron-final.log').open('wb') as log:result=subprocess.run([str(r/'node_modules/electron/dist/electron.exe'),str(w/'electron-main.cjs')],cwd=r,env=env,stdout=log,stderr=subprocess.STDOUT)
print('ELECTRON_FINAL_EXIT',result.returncode)
raise SystemExit(result.returncode)
