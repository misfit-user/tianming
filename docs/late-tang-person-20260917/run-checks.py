from pathlib import Path
import subprocess,json,time,sys
w=Path(__file__).parent;r=w.parents[1]
commands=[['python','-X','utf8',str(w/'verify-content.py')],['node','--check','web/tm-renwu-tuzhi.js'],['node','--check','web/phase8-formal-modules.js'],['node','web/scripts/smoke-renwu-multioffice-display.js'],['node','web/scripts/sync-official-scenarios.js'],['node','web/scripts/sync-official-scenarios.js','--check'],['node','web/scripts/verify-official-scenario-parity.js'],['node','web/scripts/lint-arch-all.js']]
results=[]
for i,cmd in enumerate(commands):
    start=time.time();log=w/('check-'+str(i)+'.log')
    with log.open('wb') as out:
        p=subprocess.run(cmd,cwd=r,stdout=out,stderr=subprocess.STDOUT)
    row={'command':cmd,'exitCode':p.returncode,'seconds':round(time.time()-start,2),'log':log.name};results.append(row)
    print(json.dumps(row,ensure_ascii=False),flush=True)
    (w/'check-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print('COMPLETE',sum(x['exitCode']==0 for x in results),'/',len(results),flush=True)
sys.exit(0 if all(x['exitCode']==0 for x in results) else 1)
