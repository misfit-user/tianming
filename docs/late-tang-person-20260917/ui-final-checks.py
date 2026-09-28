from pathlib import Path
import subprocess,json,time
w=Path(__file__).parent;r=w.parents[1]
commands=[['node','--check','web/tm-office-system.js'],['node','--check','web/tm-patches-start.js'],['node','--check','web/tm-renwu-tuzhi.js'],['node','--check','web/phase8-formal-modules.js'],['node',str(w/'ui-dedupe-test.mjs')],['node','web/scripts/smoke-renwu-multioffice-display.js'],['node','web/scripts/smoke-renwu-source-reader.js'],['node','web/scripts/sync-official-scenarios.js','--check'],['node','web/scripts/verify-official-scenario-parity.js'],['git','diff','--check','--','web/tm-office-system.js','web/tm-patches-start.js','web/tm-renwu-tuzhi.js','web/phase8-formal-modules.js']]
results=[]
for i,cmd in enumerate(commands):
    start=time.monotonic();p=subprocess.run(cmd,cwd=r,capture_output=True,timeout=240)
    logfile=w/('ui-final-check-'+str(i)+'.log');logfile.write_bytes(p.stdout+b'\n'+p.stderr)
    result={'command':cmd,'exitCode':p.returncode,'seconds':round(time.monotonic()-start,2),'log':logfile.name};results.append(result)
    (w/'ui-final-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False),flush=True)
print('ALL_PASS',all(x['exitCode']==0 for x in results))
