from pathlib import Path
import subprocess,json,datetime
w=Path(__file__).parent;r=w.parents[1]
main=(w/'electron-main.cjs').read_text(encoding='utf-8').replace("electron-cases.cjs","ui-component-final-cases.cjs").replace("electron-report.json","ui-component-final-report.json")
(w/'ui-component-final-main.cjs').write_text(main,encoding='utf-8')
cases=(w/'electron-cases.cjs').read_text(encoding='utf-8')
old="await shot('zheng-su-offices.png');"
new="const overlap=await js(`(()=>{const ring=document.querySelector('#tm-zhi-main .dh-loy').getBoundingClientRect();return [...document.querySelectorAll('#tm-zhi-main .dh-pill')].some(e=>{const p=e.getBoundingClientRect();return p.left<ring.right&&p.right>ring.left&&p.top<ring.bottom&&p.bottom>ring.top;});})()`);assert(!overlap,'Office badges overlap the loyalty ring');"+old
assert cases.count(old)==1;cases=cases.replace(old,new,1)
(w/'ui-component-final-cases.cjs').write_text(cases,encoding='utf-8')
with (w/'ui-component-final.log').open('wb') as log:
    p=subprocess.run([str(r/'node_modules/electron/dist/electron.exe'),str(w/'ui-component-final-main.cjs')],cwd=r,stdout=log,stderr=subprocess.STDOUT,timeout=150)
report=json.loads((w/'ui-component-final-report.json').read_bytes())
print('CURRENT_PRODUCTION_COMPONENTS',report['ok'],len(report['results']),report['failures'],flush=True)
assert report['ok'],report['failures']
p=subprocess.run(['python','-X','utf8',str(w/'ui-final-checks.py')],cwd=r,timeout=500)
print('CHECK_RUNNER_EXIT',p.returncode,flush=True)
