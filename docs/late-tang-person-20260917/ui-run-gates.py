from pathlib import Path
import subprocess,json,time,hashlib
w=Path(__file__).parent;r=w.parents[1]
commands=[['node','web/scripts/lint-arch-all.js'],['node','web/scripts/run-smokes.js','--grep','office|renwu|rank'],['node','web/scripts/sync-official-scenarios.js','--check'],['node','web/scripts/verify-official-scenario-parity.js']]
results=[]
for i,cmd in enumerate(commands):
    began=time.monotonic();p=subprocess.run(cmd,cwd=r,capture_output=True,timeout=480)
    log=w/('ui-gate-'+str(i)+'.log');log.write_bytes(p.stdout+b'\n'+p.stderr)
    results.append({'command':cmd,'code':p.returncode,'seconds':round(time.monotonic()-began,2),'log':log.name})
    (w/'ui-gate-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(results[-1],ensure_ascii=False),flush=True)
print('ALL_DONE',all(x['code']==0 for x in results))
