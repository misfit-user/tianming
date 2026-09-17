# The current integration also synchronizes the faction's embedded office mirror.
# Verify the exact three known appointments, not a blanket allowance for faction edits.
from pathlib import Path
w=Path(__file__).parent;p=w/'verify-content.py';t=p.read_text(encoding='utf-8')
a="check('unrelated scenario fields unchanged',all(s[k]==old[k] for k in report['unchangedTopLevel']))"
b="""check('unrelated scenario fields unchanged',all(s[k]==old[k] for k in report['unchangedTopLevel'] if k!='factions'))
expected_factions=json.loads(json.dumps(old['factions']))
seat_ids={'office-2da9bdae1f01':17,'office-e89790fddee5':19,'office-43a6e9e38b0c':20}
for f in expected_factions:
    for dept in f.get('officeTree',[]):
        for position in dept.get('positions',[]):
            if position.get('id') in seat_ids:
                c=cs[seat_ids[position['id']]]
                position.update(holder=c['name'],holderId=c['id'],occupancyStatus='occupied',vacancyCount=0)
check('faction mirror differs only by the three verified appointments',s['factions']==expected_factions)
check('faction office mirror equals named registry',next(f for f in s['factions'] if f['name']=='唐朝廷')['officeTree']==s['officeRegistryByFaction']['唐朝廷'])"""
assert t.count(a)==1
(w/'verify-content-before-mirror.py.txt').write_bytes(p.read_bytes())
p.write_text(t.replace(a,b),encoding='utf-8')
print('Verifier now demands the exact three seat changes in the third office mirror; all other faction data still immutable.')
