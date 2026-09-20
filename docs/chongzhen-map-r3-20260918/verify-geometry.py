"""Verify the declared R3 geometry changes, not imagined historical boundary precision."""
import json,sys,re,hashlib
from pathlib import Path
from shapely.geometry import shape,Point,Polygon
from shapely.ops import unary_union
from shapely import make_valid
W=Path(sys.argv[1]);s=json.loads((W/'candidate.json').read_text(encoding='utf-8'));old=json.loads((W/'source-before.json').read_text(encoding='utf-8'))
rows=s['map']['regions'];previous=old['map']['regions'];checks=[]
new={r['id']:shape(r['geometry']) for r in rows};prior={r['id']:shape(r['geometry']) for r in previous}
def check(name,ok,detail=None):checks.append({'name':name,'passed':bool(ok),'detail':detail})
for r in rows:
    g=new[r['id']];check(r['id']+'-valid',g.is_valid and not g.is_empty and g.area>0)
    check(r['id']+'-center-inside',g.covers(Point(r['center'])))
    actual=Polygon()
    for segment in re.split('[Mm]',r['path'])[1:]:
        ns=[float(x) for x in re.findall(r'[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',segment)]
        if len(ns)>=6:actual=actual.symmetric_difference(make_valid(Polygon(list(zip(ns[::2],ns[1::2])))))
    difference=g.symmetric_difference(actual).area
    check(r['id']+'-svg-equivalent',difference<.0002,{'difference':difference})
whole=unary_union(list(new.values()));before=unary_union(list(prior.values()))
islands=unary_union([new['ming-28-p07'],new['ming-28-p08']])
check('whole-land-only-adds-declared-islands',whole.symmetric_difference(before.union(islands)).area<1e-5)
oldOverlap=sum(g.area for g in prior.values())-before.area;newOverlap=sum(g.area for g in new.values())-whole.area
check('no-increase-in-inherited-overlap',newOverlap<=oldOverlap+1e-5,{'old':oldOverlap,'new':newOverlap})
byOwner=lambda rs,geos,k:unary_union([geos[r['id']] for r in rs if r['owner']==k])
ming=next(r['owner'] for r in rows if r['sourceProvinceId']=='ming-28');jin=next(r['owner'] for r in rows if r['sourceProvinceId']=='ming-27');korea=next(r['owner'] for r in rows if r['id']=='ming-29-p03')
approved=prior['ming-27-p08'].difference(new['ming-27-p08']);koreanCut=prior['ming-29-p03'].difference(new['ming-29-p03'])
for owner in set(r['owner'] for r in rows):
    a=byOwner(previous,prior,owner);b=byOwner(rows,new,owner)
    expected=a.union(approved).union(islands) if owner==ming else a.difference(approved) if owner==jin else a.difference(koreanCut) if owner==korea else a
    error=b.symmetric_difference(expected).area
    check('country-change-scope-'+owner,error<1e-5,{'difference':error})
check('pidao-korean-shore-correction-only-on-island',koreanCut.difference(islands).area<1e-7 and koreanCut.area<.05)
changedExisting=[]
for r in rows:
    if r['id'] in prior and new[r['id']].symmetric_difference(prior[r['id']]).area>1e-7:changedExisting.append(r['id'])
expectedChanged={'ming-01-p06','ming-27-p08','ming-29-p03'}|{r['id'] for r in previous if r['sourceProvinceId']=='ming2-36'}
check('unchanged-other-existing-shapes',set(changedExisting)<=expectedChanged,changedExisting)
for pid in ['ming2-34','ming2-36']:
    group=next(g for g in s['map']['circuitRegistry'] if g['sourceRegionId']==pid)
    check(pid+'-five-subregions',len(group['memberRegionIds'])==5)
check('guanning-eight-subregions',len([r for r in rows if r['sourceProvinceId']=='ming-28'])==8)
for pid in ['ming-28-p07','ming-28-p08']:
    links=[e for e in json.loads((W/'connections.json').read_text(encoding='utf-8')) if pid in [e['from'],e['to']]]
    check(pid+'-no-land-bridge',len(links)==0)
    check(pid+'-multiple-sea-links',len([e for e in s['map']['roads'] if pid in [e['from'],e['to']] and e['type']=='sea'])>=2)
report={'candidateSha256':hashlib.sha256((W/'candidate.json').read_bytes()).hexdigest(),'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks,'changedExistingGeometries':changedExisting,'addedIslandArea':whole.difference(before).area,'scope':'approved Ning-Jin corridor, physical islands, same-owner Chahar; inherited unrelated outlines unchanged'}
(W/'geometry-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='checks'},ensure_ascii=False))
for c in checks:
    if not c['passed']:print('FAIL',json.dumps(c,ensure_ascii=False))
sys.exit(1 if report['failed'] else 0)
