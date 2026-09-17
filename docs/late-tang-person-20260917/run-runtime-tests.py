from pathlib import Path
import subprocess,json,time,os
w=Path(__file__).parent;r=w.parents[1];env=os.environ.copy();env.pop('ELECTRON_RUN_AS_NODE',None)
cmds=[('reader-unit',['node','web/scripts/smoke-renwu-source-reader.js']),('electron',[str(r/'node_modules/electron/dist/electron.exe'),str(w/'electron-main.cjs')]),('all-smokes',['node','web/scripts/ci-smokes.js'])]
results=[]
for label,cmd in cmds:
    begin=time.time()
    with (w/(label+'.log')).open('wb') as log:
        p=subprocess.run(cmd,cwd=r,env=env,stdout=log,stderr=subprocess.STDOUT)
    row={'name':label,'exitCode':p.returncode,'seconds':round(time.time()-begin,2)}
    results.append(row);(w/'runtime-test-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    print(json.dumps(row),flush=True)
print('COMPLETE',flush=True)
