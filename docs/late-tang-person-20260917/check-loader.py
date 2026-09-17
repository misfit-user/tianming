from pathlib import Path
import subprocess,os
w=Path(__file__).parent;r=w.parents[1];p=w/'electron-cases.cjs';t=p.read_text(encoding='utf-8')
needle=' const js=x=>win.webContents.executeJavaScript(x,true);'
addition="\n await check('tang-production-load-scenario-sees-updated-canonical-data',async()=>{const v=await js(`(async()=>{const x=await tianming.loadScenario('晚唐·开成五年（官方）');if(!x.success)return x;const c=x.data.characters.find(c=>c.name==='郑肃');return {success:true,source:x.source,count:x.data.characters.length,office:c.officialTitle,reference:c.historicalSourceRef};})()`);assert.equal(v.success,true);assert.equal(v.source,'official');assert.equal(v.count,434);assert.equal(v.office,'河中节度使');assert.equal(v.reference,'assets/reference/tang840-characters.json');});"
assert t.count(needle)==1;p.write_text(t.replace(needle,needle+addition),encoding='utf-8')
if (w/'electron-report.json').exists():(w/'electron-visible-report.json').write_bytes((w/'electron-report.json').read_bytes())
env=os.environ.copy();env.pop('ELECTRON_RUN_AS_NODE',None)
with (w/'electron-loader-final.log').open('wb') as out:result=subprocess.run([str(r/'node_modules/electron/dist/electron.exe'),str(w/'electron-main.cjs')],cwd=r,env=env,stdout=out,stderr=subprocess.STDOUT)
print('FINAL_ELECTRON_EXIT',result.returncode)
