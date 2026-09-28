from pathlib import Path
import subprocess,json,hashlib,datetime
w=Path(__file__).parent;r=w.parents[1];results=[]
cmds=[['python','-X','utf8',str(w/'verify-content.py')],['node','web/scripts/smoke-renwu-source-reader.js'],['node','web/scripts/smoke-renwu-multioffice-display.js'],['node','web/scripts/smoke-military-execution-binding.js'],['node','web/scripts/sync-official-scenarios.js','--check'],['node','web/scripts/verify-official-scenario-parity.js'],['git','diff','--check','--','web/tm-renwu-tuzhi.js','web/phase8-formal-modules.js','web/scripts/smoke-renwu-source-reader.js','web/scripts/smoke-military-execution-binding.js']]
for i,cmd in enumerate(cmds):
    with (w/('final-check-'+str(i)+'.log')).open('wb') as log:p=subprocess.run(cmd,cwd=r,stdout=log,stderr=subprocess.STDOUT)
    results.append({'command':cmd,'exitCode':p.returncode,'log':'final-check-'+str(i)+'.log'});print(results[-1],flush=True)
content=json.loads((w/'content-verification.json').read_bytes());electron=json.loads((w/'electron-report.json').read_bytes());full=json.loads((r/'web/dev-tools/arch-guard/ci-u3lzg5/smoke-report.json').read_bytes())
paths=['scenarios/晚唐·开成五年（官方）.json','web/tm-renwu-tuzhi.js','web/phase8-formal-modules.js','web/assets/reference/tang840-characters.json','web/scripts/smoke-renwu-source-reader.js','web/scripts/smoke-military-execution-binding.js']
files=[{'path':p,'sha256':hashlib.sha256((r/p).read_bytes()).hexdigest(),'bytes':(r/p).stat().st_size} for p in paths]
out={'generatedAt':datetime.datetime.now().isoformat(),'scopePassed':content['ok'] and electron['ok'] and all(x['exitCode']==0 for x in results),'contentChecks':len(content['checks']),'electronChecks':len(electron['results']),'checks':results,'content':content['counts'],'files':files,'otherScenarioWarnings':content['warnings'],'fullSuiteInitial':full['summary'],'fullSuiteInitialFailed':[x['name'] for x in full['results'] if not x['pass']],'correctedOutdatedFixture':'smoke-military-execution-binding.js','globalArchitecture':'7 of 13 checks failed in the current shared workspace; logs retained; baselines not relaxed','backup':json.loads((w/'before.json').read_bytes())['_backup'],'noCommitPushRelease':True,'noPlayerSavesTouched':True}
(w/'FINAL-REPORT.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print('FINAL_SCOPE_PASSED',out['scopePassed'],'CONTENT',out['contentChecks'],'ELECTRON',out['electronChecks'],flush=True)
raise SystemExit(0 if out['scopePassed'] else 1)
