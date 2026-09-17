from pathlib import Path
import subprocess,time,json
w=Path(__file__).parent;r=Path('E:/tianming-wuchang-pages-20260917')
commands=[['node','web/scripts/sync-official-scenarios.js'],['node','web/scripts/lint-arch-all.js'],['node','web/scripts/ci-smokes.js']]
results=[]
for i,c in enumerate(commands):
 start=time.time()
 with (w/('baseline-'+str(i)+'.log')).open('wb') as out:
  p=subprocess.run(c,cwd=r,stdout=out,stderr=subprocess.STDOUT)
 row={'command':c,'exitCode':p.returncode,'seconds':round(time.time()-start,2)}
 results.append(row);print(json.dumps(row),flush=True)
 (w/'baseline-gates.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print('BASELINE_DONE',flush=True)
