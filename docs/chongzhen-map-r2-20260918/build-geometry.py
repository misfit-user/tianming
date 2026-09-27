"""R2: county-reference refinement and same-polity Liaodong redivision."""
import json, sys, time, copy, hashlib
from pathlib import Path
import numpy as np
from shapely.geometry import shape, mapping, Point, LineString
from shapely.ops import unary_union
from shapely import make_valid
ROOT=Path(sys.argv[1]); WORK=Path(sys.argv[2]); DOC=ROOT/'docs/chongzhen-map-r2-20260918'
source=json.loads((WORK/'source-before.json').read_text(encoding='utf-8'))
prepared=json.loads((WORK/'prepared-parents.json').read_text(encoding='utf-8'))
# Reuse the frozen shared-boundary kernel, not a new dependency or an installed runtime.
kernel=(ROOT/'docs/chongzhen-prefecture-map-20260917/build-prefecture-geometry.py').read_text(encoding='utf-8').split('output=[];reports=[];started=time.time()')[0]
kernel=kernel.replace("DOC=ROOT/'docs/chongzhen-prefecture-map-20260917'","DOC=ROOT/'docs/chongzhen-map-r2-20260918'")
a=kernel.index('    seed_pixels=[]'); b=kernel.index('    directions=',a)
seed_code='''    seed_pixels=[]; seed_owners=[]
    for k,s in enumerate(seedrows,1):
        for x,y in [s['anchor']]+s.get('extraAnchors',[]):
            col=min(W-1,max(0,int((x-ox)/step))); row=min(H-1,max(0,int((y-oy)/step)))
            candidates=[]
            for radius in range(8):
                for rr in range(max(0,row-radius),min(H,row+radius+1)):
                    for cc in range(max(0,col-radius),min(W,col+radius+1)):
                        idx=rr*W+cc
                        if inside[rr,cc] and idx not in seed_pixels: candidates.append(((xx[rr,cc]-x)**2+(yy[rr,cc]-y)**2,idx))
                if candidates: break
            if not candidates: raise ValueError('No available land pixel for '+s['name'])
            idx=min(candidates)[1]; seed_pixels.append(idx); seed_owners.append(k)
            dist[idx]=0; labels[idx]=k; heapq.heappush(queue,(0.,k,idx))
'''
kernel=kernel[:a]+seed_code+kernel[b:]
kernel=kernel.replace('hits=[i+1 for i,p in enumerate(seedpoints) if face.covers(p)]','hits=list(set(seed_owners[i] for i,p in enumerate(seedpoints) if face.covers(p)))')
namespace={'__name__':'geometry_kernel'};exec(compile(kernel,'frozen-refinement-kernel','exec'),namespace)
partition=namespace['partition'];project=namespace['project'];polys=namespace['polys'];clean=namespace['clean']
references=[];by_parent={p['id']:copy.deepcopy(p) for p in prepared}
for line in (DOC/'county-references.tsv').read_text(encoding='utf-8').splitlines():
    if not line.strip() or line.startswith('#'):continue
    parent,name,raw,ref=line.split('|');p=by_parent[parent];seed=next(s for s in p['seeds'] if s['name']==name)
    for item in raw.split(';'):
        place,lon,lat=item.split(',');xy=project([float(lon),float(lat)]).tolist();g=shape(p['geometry'])
        accepted=g.buffer(-.08).covers(Point(xy))
        record={'parentId':parent,'accountId':seed['id'],'parentName':p['name'],'name':place,'logicalName':name,'lonLat':[float(lon),float(lat)],'xy':xy,'accepted':accepted,'source':ref}
        references.append(record)
        if accepted:seed.setdefault('extraAnchors',[]).append(xy)
# Same polity only: fix administrative areas whose towns lay in a sibling polygon.
jin_ids=['ming-22','ming2-29','ming-27'];old_by_id={r['id']:r for r in source['map']['regions']}
jin_rows=[r for r in source['map']['regions'] if r['sourceProvinceId'] in jin_ids]
assert len(set(r['owner'] for r in jin_rows))==1
jin_land=clean(unary_union([shape(r['geometry']) for r in jin_rows]));jin_seeds=[]
for pid in jin_ids:
    for seed in by_parent[pid]['seeds']:
        s=copy.deepcopy(seed);s['originalParentId']=pid;xy=s['referenceXY']
        if jin_land.buffer(-.08).covers(Point(xy)):s['anchor']=xy
        else:s['anchor']=list(namespace['nearest_points'](jin_land.buffer(-.08),Point(xy))[0].coords)[0]
        jin_seeds.append(s)
# Northern extent is inherited from the scenario, not asserted to be a surveyed 1627 frontier.
for s in jin_seeds:
    if s['name']=='建州三卫':
        s['extraAnchors']=[project(p).tolist() for p in [[130,45.5],[131,47],[132,49.5]] if jin_land.buffer(-.1).covers(Point(project(p)))]
output=[];reports=[];started=time.time();updated_parents=set(r['parentId'] for r in references if r['accepted'])
def row_from_seed(parent,seed,geom,old=None):
    point=geom.representative_point();record=copy.deepcopy(old) if old else {}
    record.update({'id':old['id'] if old else parent+'-p'+str(seed['index']+1).zfill(2),'parentId':parent,'name':old['name'] if old else seed['name'],'accountIds':old.get('accountIds',[seed['id']]) if old else [seed['id']],'geometry':mapping(geom),'center':[point.x,point.y],'referenceSeat':seed['referenceXY'],'referenceLonLat':seed['lonLat'],'coarse':False,'precision':'county-references-and-generalized-relief-not-surveyed-boundary'})
    return record
prior=json.loads((WORK/'prefecture-geometry.json').read_text(encoding='utf-8'))
for p in prepared:
    pid=p['id']
    if pid in jin_ids:continue
    oldrows=[r for r in prior if r['parentId']==pid]
    if pid not in updated_parents or any(r['coarse'] for r in oldrows):output.extend(copy.deepcopy(oldrows));continue
    seeds=by_parent[pid]['seeds'];assert len(oldrows)==len(seeds)
    geoms,details=partition(by_parent[pid],seeds)
    for k,seed in enumerate(seeds,1):
        old=next(r for r in oldrows if seed['id'] in r['accountIds']);output.append(row_from_seed(pid,seed,geoms[k],old))
    reports.append({'parentId':pid,'name':p['name'],'cells':len(seeds),**details});print(p['name']+' refined',flush=True)
geoms,details=partition({'name':'后金内部地域','geometry':mapping(jin_land)},jin_seeds)
for k,seed in enumerate(jin_seeds,1):
    old=next((r for r in prior if not r['coarse'] and seed['id'] in r['accountIds']),None)
    output.append(row_from_seed(seed['originalParentId'],seed,geoms[k],old))
reports.append({'parentId':'jin-internal','cells':len(jin_seeds),'oldCells':len(jin_rows),'countryUnionPreserved':True,**details})
# Reorder by original parent registry, then stable leaf id.
order={p['id']:i for i,p in enumerate(prepared)};output.sort(key=lambda r:(order[r['parentId']],r['id']))
assert len(output)==296,(len(output),'unexpected logical cell count')
assert set(x for r in output for x in r['accountIds'])==set(x for r in prior for x in r['accountIds'])
(WORK/'r2-geometry.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(WORK/'county-reference-report.json').write_text(json.dumps(references,ensure_ascii=False,indent=2),encoding='utf-8')
(WORK/'r2-geometry-report.json').write_text(json.dumps({'regions':len(output),'reports':reports,'references':len(references),'acceptedReferences':sum(r['accepted'] for r in references),'elapsedSeconds':time.time()-started},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'regions':len(output),'refinedParents':len(reports),'seconds':time.time()-started}),flush=True)
