from pathlib import Path
import json,hashlib
w=Path(__file__).parent;r=w.parents[1];meta=json.loads((w/'before.json').read_bytes())
p=r/'scenarios/晚唐·开成五年（官方）.json';old=json.loads((Path(meta['_backup'])/'scenarios/晚唐·开成五年（官方）.json').read_bytes());s=json.loads(p.read_bytes())
archive=json.loads((r/'web/assets/reference/tang840-characters.json').read_bytes());checks=[]
def check(name,value):
    assert value,name
    checks.append(name)
cs=s['characters'];check('434 identical stable IDs, names and order',[(c['id'],c['name']) for c in cs]==[(c['id'],c['name']) for c in old['characters']] and len(cs)==434)
check('81 historical and 353 fictional',sum(c['isHistorical'] for c in cs)==81 and sum(c['isFictional'] for c in cs)==353)
check('79 people with 93 quotations, 2 explicitly pending',len(archive['characters'])==81 and sum(bool(c['quotes']) for c in archive['characters'].values())==79 and sum(len(c['quotes']) for c in archive['characters'].values())==93 and sum(c['status']=='original-pending' for c in archive['characters'].values())==2)
check('References bind every historical character by ID',all(c['historicalSourceKey']==c['id'] and c['id'] in archive['characters'] for c in cs if c['isHistorical']))
check('Fictional characters contain no invented ancient citations',all(not c['historicalSources'] for c in cs if c['isFictional']))
fields=['appearance','ethnicity','faith','familyMembers','skills','type','historicalSources','career','dialogues']
check('All people have the agreed applicable fields',all(all(k in c for k in fields) for c in cs))
protected=['id','name','age','alive','portrait','resources','relations','loyalty','ambition','intelligence','military','administration','management','valor','charisma','diplomacy','health','stress','traitIds','partyIds']
check('Portraits, identities, wealth, relations and game values preserved',all(a.get(k)==b.get(k) for a,b in zip(old['characters'],cs) for k in protected))
check('Player memory and agency preserved',cs[0]['_memory']==old['characters'][0]['_memory'] and all(k not in cs[0] for k in ['personality','personalGoal','innerThought','stance']))
check('Unrelated map, setting and other top-level scenario values preserved',all(s[k]==old[k] for k in old if k not in ['characters','officeTree','officeRegistryByFaction','factions']))
def walk(nodes):
    for d in nodes:
        yield from d.get('positions',[])
        yield from walk(d.get('subs',[]))
expected={'office-2da9bdae1f01':'char-c4e575644b83','office-e89790fddee5':'char-984049d9c161','office-43a6e9e38b0c':'char-a9816a4d9603'}
mirrors=[s['officeTree'],s['officeRegistryByFaction']['唐朝廷'],next(f['officeTree'] for f in s['factions'] if f['name']=='唐朝廷')]
check('Three corrected posts agree in all three runtime data sources',all(all(any(p.get('id')==pid and p.get('holderId')==cid and p.get('occupancyStatus')=='occupied' for p in walk(tree)) for pid,cid in expected.items()) for tree in mirrors))
base=json.loads(json.dumps(old['factions'],ensure_ascii=False));new=json.loads(json.dumps(s['factions'],ensure_ascii=False))
for fs in [base,new]:
    for f in fs:
        for pos in walk(f.get('officeTree',[])):
            if pos.get('id') in expected:
                for k in ['holder','holderId','occupancyStatus']:pos.pop(k,None)
check('Faction data unchanged except the nine justified seat fields',base==new)
check('Honorary titles do not create substantive office claims',all(not any(h in c.get('officialTitles',[]) for h in c.get('honoraryTitles',[])) for c in cs))
check('Canonical JSON roundtrip',json.loads(json.dumps(s,ensure_ascii=False))==s)
manifest=json.loads((r/'web/bundled-scenarios/manifest.json').read_bytes());entry=next(e for e in manifest['entries'] if e['id']==s['id'])
sha=hashlib.sha256(p.read_bytes()).hexdigest();check('Official manifest references installed source bytes',entry['sourceSha256']==sha)
observations=[{'file':key,'before':meta[key],'now':hashlib.sha256((r/key).read_bytes()).hexdigest()} for key in meta if key.startswith('scenarios/') and '晚唐' not in key]
report={'ok':True,'sourceSha256':sha,'checks':checks,'otherScenarioObservations':observations,'note':'Concurrent Shaosong changes are recorded, not reverted. This report does not assert whole-project release readiness.'}
(w/'ui-final-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
