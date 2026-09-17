from pathlib import Path
import subprocess,json,datetime
w=Path(__file__).parent;r=w.parents[1]
p=subprocess.run(['python','-X','utf8',str(w/'ui-serial-test-memory.py')],capture_output=True)
assert p.returncode==0,p.stderr.decode('utf-8',errors='replace')
previous=w/'runtime-full/report.json'
(w/'runtime-full/report-before-serial-memory-check.json').write_bytes(previous.read_bytes())
print('Running the native test alone, with no parallel scenario generation.',flush=True)
with (w/'serial-native.log').open('wb') as log:
    p=subprocess.run([str(r/'node_modules/electron/dist/electron.exe'),str(w/'ui-full-scenario-electron.cjs')],cwd=r,stdout=log,stderr=subprocess.STDOUT,timeout=240)
print('NATIVE_PROCESS_EXIT',p.returncode,flush=True)
p=subprocess.run(['python','-X','utf8',str(w/'finalize-verification.py')],cwd=r,timeout=650)
raise SystemExit(p.returncode)
