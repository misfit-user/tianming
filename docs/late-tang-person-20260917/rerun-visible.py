from pathlib import Path
import subprocess,json,os,time
w=Path(__file__).parent;r=w.parents[1]
subprocess.run(['python','-X','utf8',str(w/'polish-reader.py')],cwd=r,check=True)
p=w/'electron-cases.cjs';t=p.read_text(encoding='utf-8')
a=" const shot=async n=>fs.writeFileSync(path.join(__dirname,n),(await win.webContents.capturePage()).toPNG());"
b=" const shot=async n=>{await js(`(async()=>{const p=document.getElementById('tm-zhi-overlay');if(p)await Promise.all(p.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished));await new Promise(r=>setTimeout(r,450));})()`);fs.writeFileSync(path.join(__dirname,n),(await win.webContents.capturePage()).toPNG());};"
assert t.count(a)==1;p.write_text(t.replace(a,b),encoding='utf-8')
old=w/'electron-report.json'
if old.exists():(w/'electron-first-report.json').write_bytes(old.read_bytes())
env=os.environ.copy();env.pop('ELECTRON_RUN_AS_NODE',None);results=[]
cmds=[['node','--check','web/tm-renwu-tuzhi.js'],['node','web/scripts/smoke-renwu-source-reader.js'],['node','web/scripts/smoke-renwu-multioffice-display.js'],[str(r/'node_modules/electron/dist/electron.exe'),str(w/'electron-main.cjs')]]
for i,cmd in enumerate(cmds):
    start=time.time()
    with (w/('visible-final-'+str(i)+'.log')).open('wb') as f:p=subprocess.run(cmd,cwd=r,env=env,stdout=f,stderr=subprocess.STDOUT)
    results.append({'command':cmd,'exitCode':p.returncode,'seconds':round(time.time()-start,2)});print(results[-1],flush=True)
(w/'visible-final-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
