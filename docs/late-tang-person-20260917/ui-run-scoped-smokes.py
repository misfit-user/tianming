from pathlib import Path
import subprocess,json,time
w=Path(__file__).parent;r=w.parents[1];results=[]
for term in ['office','renwu','rank']:
    cmd=['node','web/scripts/run-smokes.js','--grep',term]
    begin=time.monotonic();p=subprocess.run(cmd,cwd=r,capture_output=True,timeout=360)
    log=w/('ui-smokes-'+term+'.log');log.write_bytes(p.stdout+b'\n'+p.stderr)
    results.append({'command':cmd,'code':p.returncode,'seconds':round(time.monotonic()-begin,2),'log':log.name})
    (w/'ui-scoped-smokes.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(results[-1],ensure_ascii=False),flush=True)
print('DONE',all(x['code']==0 for x in results))
