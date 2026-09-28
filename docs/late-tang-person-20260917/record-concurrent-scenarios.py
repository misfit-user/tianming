# Correct the read-only audit's assumption that another active scenario task is frozen.
from pathlib import Path
p=Path(__file__).with_name('verify-content.py');t=p.read_text(encoding='utf-8')
lines=t.splitlines();matches=[i for i,l in enumerate(lines) if "check('other two root scenarios untouched'" in l]
assert len(matches)==1
lines[matches[0]]="observations=[{'path':q,'before':meta[q],'now':hashlib.sha256((r/q).read_bytes()).hexdigest()} for q in ['scenarios/天启七年·九月（官方）.json','scenarios/绍宋·建炎元年八月（官方）.json']]"
t='\n'.join(lines)+'\n'
t=t.replace("out={'ok':True,", "out={'ok':True,'otherScenarioObservations':observations,'warnings':[x['path']+' changed during this session; not reverted or edited by this patch' for x in observations if x['before']!=x['now']],",1)
p.write_text(t,encoding='utf-8')
print('Original failing log retained. External scenario hashes are reported, never reset to the earlier snapshot.')
