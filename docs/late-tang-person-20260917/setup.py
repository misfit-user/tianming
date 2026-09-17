from pathlib import Path
import json,hashlib,subprocess,datetime
root=Path(__file__).resolve().parents[2]
work=Path(__file__).parent
backup=root/('.bak-tang-completion-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
backup.mkdir()
names=['web/tm-office-system.js','web/tm-renwu-tuzhi.js','web/phase8-formal-modules.js','web/tm-char-full-schema.js','web/index.html','scenarios/晚唐·开成五年（官方）.json','scenarios/天启七年·九月（官方）.json','scenarios/绍宋·建炎元年八月（官方）.json']
names+=['web/scenarios/'+n for n in ['tang840-840.js','tianqi7-1627.js','shaosong-jianyan-1127.js']]
names+=['web/tm-official-scenario-bundle.js','web/preview/official-scenarios-bundle.js','web/preview/scenario-editor-reset-data.js','web/bundled-scenarios/manifest.json','web/bundled-scenarios/manifest.js']
state={}
for n in names:
    p=root/n
    if not p.exists(): continue
    data=p.read_bytes(); state[n]=hashlib.sha256(data).hexdigest()
    dest=backup/n;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
state['_backup']=str(backup)
state['_root']=str(root)
(work/'before.json').write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
status=subprocess.run(['git','status','--porcelain=v1','-uno'],cwd=root,capture_output=True)
(work/'git-status-before.txt').write_bytes(status.stdout)
print('BACKUP',backup,'FILES',len(names),'VERIFIED',all(hashlib.sha256((root/n).read_bytes()).hexdigest()==h for n,h in state.items() if not n.startswith('_')))
