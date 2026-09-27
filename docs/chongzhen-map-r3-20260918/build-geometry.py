"""R3: separate the Guanning corridor and island bases; refine same-owner steppe groups."""
import json,sys,copy,hashlib
from pathlib import Path
import numpy as np
from shapely.geometry import shape,mapping,Point,LineString,Polygon
from shapely.ops import unary_union,transform,nearest_points
from shapely import make_valid
ROOT=Path(sys.argv[1]);WORK=Path(sys.argv[2]);DOC=ROOT/'docs/chongzhen-map-r3-20260918'
s=json.loads((WORK/'source-before.json').read_text(encoding='utf-8'))
prepared=json.loads((WORK/'prepared-parents.json').read_text(encoding='utf-8'))
cal=json.loads((WORK/'calibration.json').read_text(encoding='utf-8'));fit=np.array(cal['affine'])
def project(ll):
    lon,lat=ll;p=cal['sourceProjection'];b=cal['sourceBounds']
    return (np.array([p['offsetX']+(lon-b[0])*p['scale'],p['offsetY']+(b[3]-lat)*p['scale'],1])@fit).tolist()
def pieces(g):
    if g.geom_type=='Polygon':return [g]
    return [p for child in getattr(g,'geoms',[]) for p in pieces(child)]
def clean(g):return unary_union(pieces(make_valid(g)))
rows=[{'id':r['id'],'parentId':r['sourceProvinceId'],'name':r['name'],'accountIds':r['accountingLeafIds'],'geometry':r['geometry'],'center':r['center'],'referenceSeat':r.get('referenceSeat'),'coarse':r.get('coarse',False)} for r in s['map']['regions']]
# Freeze and reuse the existing shared-edge partitioner; no runtime module is rewritten.
part=(ROOT/'docs/chongzhen-map-r2-20260918/build-geometry.py').read_text(encoding='utf-8').split('references=[];by_parent=')[0]
part=part.replace("DOC=ROOT/'docs/chongzhen-map-r2-20260918'","DOC=ROOT/'docs/chongzhen-map-r3-20260918'")
part=part.replace("DOC=ROOT/'docs/chongzhen-map-r2-20260918'","DOC=ROOT/'docs/chongzhen-map-r3-20260918'")
namespace={'__name__':'r3_partition'};exec(compile(part,'frozen-r2-partitioner','exec'),namespace)
partition=namespace['partition'];reports=[];parents={p['id']:p for p in prepared}
physical=json.loads((WORK/'ne_10m_land.geojson').read_text(encoding='utf-8'))
islands=[p for f in physical['features'] for p in pieces(shape(f['geometry'])) if .0002<p.area<.15]
def xy_geometry(g):
    def coordinates(x,y,z=None):
        x=np.asarray(x);y=np.asarray(y);p=cal['sourceProjection'];b=cal['sourceBounds']
        u=p['offsetX']+(x-b[0])*p['scale'];v=p['offsetY']+(b[3]-y)*p['scale']
        return u*fit[0,0]+v*fit[1,0]+fit[2,0],u*fit[0,1]+v*fit[1,1]+fit[2,1]
    return transform(coordinates,g)
selected_islands={}
for name,ll in [('觉华岛',[120.855,40.485]),('皮岛',[124.62,39.55])]:
    pt=Point(ll);g=min(islands,key=lambda p:p.distance(pt));distance=g.distance(pt)
    assert distance<.1,(name,distance)
    selected_islands[name]=xy_geometry(g)
    reports.append({'operation':'physical-island','name':name,'reference':ll,'nearestDistanceDegrees':distance,'centroidLonLat':list(g.centroid.coords)[0],'source':'Natural Earth 10m land 5.1.1; modern coastline approximation, not a 1627 survey'})
# Restore the documented Ming Jinzhou/Songshan corridor, not the whole former Liaodong province.
ming=next(r['owner'] for r in s['map']['regions'] if r['sourceProvinceId']=='ming-28')
jin=next(r['owner'] for r in s['map']['regions'] if r['sourceProvinceId']=='ming-27')
old_corridor=shape(next(r['geometry'] for r in rows if r['id']=='ming-28'))
west_seeds=copy.deepcopy(parents['ming-28']['seeds'][:6])
line=LineString([project(ll) for ll in [[120.73,40.62],[120.92,40.77],[121.00,40.92],[121.10,41.02],[121.14,41.12]]])
existing_land=unary_union([shape(r['geometry']) for r in rows])
correction=clean(line.buffer(1.05,quad_segs=8).intersection(existing_land).difference(old_corridor))
shanhai=Point(project([119.75,40.01])).buffer(.7,quad_segs=8).intersection(existing_land)
corridor=clean(unary_union([old_corridor,correction,shanhai]))
for r in rows:
    if r['id']=='ming-28':continue
    g=shape(r['geometry']);take=g.intersection(corridor.difference(old_corridor))
    if take.area<1e-8:continue
    owner=next(x['owner'] for x in s['map']['regions'] if x['id']==r['id'])
    assert owner in [ming,jin],('Unexpected control correction',r['name'])
    new=clean(g.difference(corridor.difference(old_corridor)));assert not new.is_empty
    r['geometry']=mapping(new);p=new.representative_point();r['center']=[p.x,p.y]
    reports.append({'operation':'corridor-correction','regionId':r['id'],'name':r['name'],'area':take.area,'sameOwner':owner==ming,'basis':'Ming Shi 259: 1627 Ning-Jin defenders retained Jinzhou; drawn corridor boundary is approximate'})
inner=corridor.buffer(-.06)
for seed in west_seeds:
    point=Point(seed['referenceXY'])
    seed['anchor']=list((point if inner.covers(point) else nearest_points(inner,point)[0]).coords)[0]
new_geo,details=partition({'name':'关宁陆上防线','geometry':mapping(corridor)},west_seeds)
rows=[r for r in rows if r['id']!='ming-28']
def add_region(pid,seed,g,index,account_ids=None,name=None):
    seat=Point(seed['referenceXY']);center=seat if g.covers(seat) else g.representative_point()
    row={'id':pid+'-p'+str(index).zfill(2),'parentId':pid,'name':name or seed['name'],'accountIds':account_ids or [seed['id']],'geometry':mapping(g),'center':[center.x,center.y],'referenceSeat':seed['referenceXY'],'coarse':False}
    rows.append(row);return row
for i,seed in enumerate(west_seeds,1):add_region('ming-28',seed,new_geo[i],i)
for index,name in [(7,'觉华岛'),(8,'皮岛')]:
    seed=copy.deepcopy(parents['ming-28']['seeds'][index-1]);g=selected_islands[name]
    # The coarse Korean shore overlaps a small part of physical Pidao; cut only that island footprint.
    for other in rows:
        overlap=shape(other['geometry']).intersection(g).area
        if overlap<1e-8:continue
        assert name=='皮岛' and other['id']=='ming-29-p03' and overlap<.05,'Unexpected island collision'
        other['geometry']=mapping(clean(shape(other['geometry']).difference(g)))
        reports.append({'operation':'physical-island-shore-collision','island':name,'cell':other['id'],'area':overlap,'basis':'Pidao Ming island garrison, not mainland occupation'})
    accounts=None if index==7 else [p['id'] for p in parents['ming-28']['seeds'][7:]]
    add_region('ming-28',seed,g,index,accounts,name)
reports.append({'operation':'guanning-dongjiang-separated','oldCells':1,'newCells':8,'accounts':11,'mainlandAccountsAtPidao':'Iron Mountain/Zhenjiang/Yalu-mouth source ledgers remain distinct under theater container; not mainland annexations',**details})
# Redistribute the two Chahar groups inside their unchanged combined political boundary.
pids=['ming2-34','ming2-36'];selected=[r for r in rows if r['parentId'] in pids]
land=clean(unary_union([shape(r['geometry']) for r in selected]));seeds=[]
for pid in pids:
    for original in parents[pid]['seeds']:
        seed=copy.deepcopy(original);seed['parentId']=pid;p=Point(seed['referenceXY']);interior=land.buffer(-.06)
        seed['anchor']=list((p if interior.covers(p) else nearest_points(interior,p)[0]).coords)[0]
        assert land.distance(p)<1,'Cannot safely locate Chahar point'
        seeds.append(seed)
geoms,detail=partition({'name':'察哈尔与漠南内部','geometry':mapping(land)},seeds)
rows=[r for r in rows if r['parentId'] not in pids]
for i,seed in enumerate(seeds,1):
    display='张家口塞外互市' if seed['name']=='张家口互市' else seed['name']
    add_region(seed['parentId'],seed,geoms[i],seed['index']+1,name=display)
reports.append({'operation':'same-owner-steppe-refinement','oldCells':len(selected),'newCells':len(seeds),'countryUnionPreserved':True,**detail})
# Use actual reference seats for runtime focus when the seat really belongs to that cell.
for r in rows:
    g=shape(r['geometry']);seat=r.get('referenceSeat')
    if seat and g.covers(Point(seat)):r['center']=seat
    elif not g.covers(Point(r['center'])):
        p=g.representative_point();r['center']=[p.x,p.y]
    r['neighbors']=[]
connections=[];gs=[shape(r['geometry']) for r in rows]
for i,g in enumerate(gs):
    for j in range(i):
        other=gs[j]
        if rows[i]['id'] in ['ming-28-p07','ming-28-p08'] or rows[j]['id'] in ['ming-28-p07','ming-28-p08']:continue
        if g.distance(other)>.045:continue
        shared=g.boundary.intersection(other.boundary).length
        if shared<.025 and g.buffer(.025).intersection(other).area<.001:continue
        rows[i]['neighbors'].append(rows[j]['id']);rows[j]['neighbors'].append(rows[i]['id'])
        connections.append({'from':rows[i]['id'],'to':rows[j]['id'],'type':'land','sharedBoundary':shared})
order={p['id']:i for i,p in enumerate(prepared)};rows.sort(key=lambda r:(order[r['parentId']],r['id']))
assert len(rows)==307,(len(rows),'unexpected cell count')
assert sorted(a for r in rows for a in r['accountIds'])==sorted(a for r in s['map']['regions'] for a in r['accountingLeafIds'])
(WORK/'r3-geometry.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(WORK/'geometry-report.json').write_text(json.dumps({'regions':len(rows),'reports':reports,'landConnections':len(connections)},ensure_ascii=False,indent=2),encoding='utf-8')
(WORK/'connections.json').write_text(json.dumps(connections),encoding='utf-8')
print(json.dumps({'regions':len(rows),'reports':reports,'landConnections':len(connections)},ensure_ascii=False),flush=True)
