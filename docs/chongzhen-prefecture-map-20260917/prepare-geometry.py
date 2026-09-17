"""Prepare game-map outlines and geographic reference anchors."""
import json, math, re, sys
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon, Point, MultiPolygon, mapping
from shapely import make_valid
from shapely.ops import unary_union, nearest_points
from PIL import Image, ImageDraw
ROOT=Path(sys.argv[1]); WORK=Path(sys.argv[2]); DOC=ROOT/'docs/chongzhen-prefecture-map-20260917'
parents=json.loads((WORK/'parents.json').read_text(encoding='utf-8'))
original=json.loads((WORK/'original-author-map.json').read_text(encoding='utf-8'))
accounts=json.loads((WORK/'accounts.json').read_text(encoding='utf-8'))
def parts(g):
    if g.geom_type=='Polygon': return [g]
    return [p for item in getattr(g,'geoms',[]) for p in parts(item)]
def polygon_of(r):
    text=r.get('path') or r.get('d') or ''
    rings=[]
    for segment in re.split('[Mm]',text)[1:]:
        assert not re.search('[CcQqAaHhVvSsTt]',segment), 'Unsupported SVG command'
        nums=[float(n) for n in re.findall(r'[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',segment)]
        if len(nums)>=6: rings.append(list(zip(nums[::2],nums[1::2])))
    if not rings: rings=[r['points']]+r.get('extraPolygons',[])
    g=Polygon()
    for ring in rings: g=g.symmetric_difference(make_valid(Polygon(ring)))
    return unary_union(parts(make_valid(g)))
pairs=[]
for r in parents['regions']:
    old=next((v for v in original['divisions'] if v['name']==r['name'] and len(v.get('polygon',[]))==len(r['points'])),None)
    if old: pairs.extend(zip(old['polygon'],r['points']))
a=np.array([x for x,y in pairs]); b=np.array([y for x,y in pairs])
fit=np.linalg.lstsq(np.c_[a,np.ones(len(a))],b,rcond=None)[0]
error=np.linalg.norm(np.c_[a,np.ones(len(a))]@fit-b,axis=1)
assert np.quantile(error,.95)<.2, 'Cannot recover original georeference'
meta=original['meta']; projection=meta['projection']; bbox=meta['sourceBbox']
def project(lon,lat):
    u=projection['offsetX']+(lon-bbox[0])*projection['scale']
    v=projection['offsetY']+(bbox[3]-lat)*projection['scale']
    return (np.array([u,v,1])@fit).tolist()
seats={}
for line in (DOC/'author-seats.tsv').read_text(encoding='utf-8').splitlines():
    if not line.strip() or line.startswith('#'): continue
    key,values=line.split('\t'); seats[key]=[list(map(float,s.split(','))) for s in values.split(';')]
output=[]; warnings=[]
for r in parents['regions']:
    g=polygon_of(r); rows=[n for n in accounts if n['sourceMapId']==r['id']]
    assert len(rows)==len(seats[r['id']]), (r['id'],len(rows),len(seats[r['id']]))
    inner=g.buffer(-.25)
    if inner.is_empty: inner=g
    used=[]; seeds=[]
    for j,(row,ll) in enumerate(zip(rows,seats[r['id']])):
        original_point=Point(project(*ll)); p=original_point
        distance=g.distance(p)
        if not inner.covers(p): p=nearest_points(inner,p)[0]
        # Small UI anchors are distinct; reference coordinates are never overwritten.
        if any(p.distance(old)<.5 for old in used):
            candidates=[]
            for radius in [.8,1.5,2.5,4,7,12]:
                for angle in np.linspace(0,2*math.pi,24,endpoint=False):
                    q=Point(p.x+radius*math.cos(angle),p.y+radius*math.sin(angle))
                    if inner.covers(q) and all(q.distance(old)>.7 for old in used): candidates.append(q)
                if candidates: break
            if candidates: p=min(candidates,key=lambda q:q.distance(original_point))
        used.append(p)
        seed={**row,'lonLat':ll,'referenceXY':[original_point.x,original_point.y],'anchor':[p.x,p.y],'outsideParentDistance':distance,'index':j}
        seeds.append(seed)
        if distance>2: warnings.append({'parent':r['name'],'name':row['name'],'distance':round(distance,2),'reason':'reference point outside inherited provincial outline; operational anchor constrained to parent'})
    output.append({'id':r['id'],'name':r['name'],'geometry':mapping(g),'seeds':seeds})
calibration={'sourceProjection':projection,'sourceBounds':bbox,'affine':fit.tolist(),'matchedVertices':len(pairs),'p95Error':float(np.quantile(error,.95))}
(WORK/'prepared-parents.json').write_text(json.dumps(output,ensure_ascii=False),encoding='utf-8')
(WORK/'calibration.json').write_text(json.dumps(calibration,ensure_ascii=False,indent=2),encoding='utf-8')
(WORK/'reference-conflicts.json').write_text(json.dumps(warnings,ensure_ascii=False,indent=2),encoding='utf-8')
im=Image.new('RGB',(1800,1080),'#ddd8c5'); draw=ImageDraw.Draw(im)
for parent in output:
    from shapely.geometry import shape
    for p in parts(shape(parent['geometry'])):
        draw.polygon([(x*1.5,y*1.5) for x,y in p.exterior.coords],fill='#c9bf9e',outline='#675b41')
        for h in p.interiors: draw.polygon([(x*1.5,y*1.5) for x,y in h.coords],fill='#ddd8c5')
    for seed in parent['seeds']:
        x,y=seed['anchor'];draw.ellipse((x*1.5-2,y*1.5-2,x*1.5+2,y*1.5+2),fill='#a43326')
im.save(WORK/'original-provinces-anchors.png')
print(json.dumps({'parents':len(output),'accounts':sum(len(p['seeds']) for p in output),'calibration':calibration,'conflicts':len(warnings),'severe':sorted(warnings,key=lambda w:w['distance'],reverse=True)[:15]},ensure_ascii=False),flush=True)
