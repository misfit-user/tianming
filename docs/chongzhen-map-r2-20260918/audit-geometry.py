import json,sys,math
from pathlib import Path
from shapely.geometry import shape,Point,mapping
from shapely.ops import unary_union
from shapely.strtree import STRtree
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(sys.argv[1]);W=Path(sys.argv[2]);s=json.loads((W/'source-before.json').read_text(encoding='utf-8'))
rows=json.loads((W/'r2-geometry.json').read_text(encoding='utf-8'));old=s['map']['regions'];geoms=[shape(r['geometry']) for r in rows];idx={r['id']:r for r in old};checks=[]
def check(n,v,d=None):checks.append({'name':n,'passed':bool(v),'detail':d})
parents={r['sourceProvinceId']:r['owner'] for r in old}
for fid in set(parents.values()):
    a=unary_union([shape(r['geometry']) for r in old if r['owner']==fid]);b=unary_union([g for r,g in zip(rows,geoms) if parents[r['parentId']]==fid])
    check('country-union-'+fid,a.symmetric_difference(b).area<1e-5,{'difference':a.symmetric_difference(b).area})
for r,g in zip(rows,geoms):
    check('valid-'+r['id'],g.is_valid and not g.is_empty and g.area>0)
    check('label-inside-'+r['id'],g.covers(Point(r['center'])))
for pid in set(parents)-{'ming-22','ming2-29','ming-27'}:
    a=unary_union([shape(r['geometry']) for r in old if r['sourceProvinceId']==pid]);b=unary_union([g for r,g in zip(rows,geoms) if r['parentId']==pid]);check('province-union-'+pid,a.symmetric_difference(b).area<1e-5)
# Recompute reciprocal borders; inherited seam tolerance is not used within new provinces.
tree=STRtree(geoms);links=[];sets=[set() for r in rows];overlaps=[]
for i,g in enumerate(geoms):
    for j in map(int,tree.query(g.buffer(.13))):
        if j<=i:continue
        h=geoms[j];shared=g.boundary.intersection(h.boundary).length;overlap=g.intersection(h).area
        if overlap>1e-6:overlaps.append({'a':rows[i]['id'],'b':rows[j]['id'],'area':overlap})
        near=g.distance(h)<.13 and g.boundary.intersection(h.buffer(.13)).length>.4
        if shared>.025 or (near and rows[i]['parentId']!=rows[j]['parentId']):
            sets[i].add(rows[j]['id']);sets[j].add(rows[i]['id']);links.append({'a':rows[i]['id'],'b':rows[j]['id'],'sharedLength':shared,'type':'land'})
for i,r in enumerate(rows):r['neighbors']=sorted(sets[i])
old_geoms=[shape(r['geometry']) for r in old];old_overlap=sum(g.area for g in old_geoms)-unary_union(old_geoms).area;new_overlap=sum(g.area for g in geoms)-unary_union(geoms).area
check('no-increased-global-overlap',new_overlap<=old_overlap+1e-5,{'old':old_overlap,'new':new_overlap})
refrows=json.loads((W/'county-reference-report.json').read_text(encoding='utf-8'));by_account={a:(r,g) for r,g in zip(rows,geoms) for a in r['accountIds']}
for ref in refrows:
    if ref['accepted']:
        r,g=by_account[ref['accountId']];check('county-'+ref['accountId']+'-'+ref['name'],g.buffer(.55).covers(Point(ref['xy'])),{'region':r['name'],'distance':g.distance(Point(ref['xy']))})
changed=[r['id'] for r,g in zip(rows,geoms) if r['id'] not in idx or g.symmetric_difference(shape(idx[r['id']]['geometry'])).area>1e-5]
report={'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks,'regions':len(rows),'changedOrNewRegions':len(changed),'changedIds':changed,'landConnections':len(links),'coarse':sum(r['coarse'] for r in rows),'inheritedOverlaps':overlaps}
(W/'r2-geometry.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(W/'geometry-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',15)
colors=['#c6c7a3','#d3c49c','#aebfa5','#bfc7b7','#b9b8a0','#d0b49a']
def polygons(g):return [g] if g.geom_type=='Polygon' else list(g.geoms)
for file,box in [('r2-central-preview.png',(595,282,801,466)),('r2-liaodong-preview.png',(763,200,993,336))]:
    x0,y0,x1,y1=box;width=1600;scale=width/(x1-x0);im=Image.new('RGB',(width,round((y1-y0)*scale)),'#e6e9df');d=ImageDraw.Draw(im)
    def xy(p):return ((p[0]-x0)*scale,(p[1]-y0)*scale)
    for i,(r,g) in enumerate(zip(rows,geoms)):
        for p in polygons(g):
            d.polygon([xy(q) for q in p.exterior.coords],fill=colors[i%len(colors)],outline='#5d6550')
            for h in p.interiors:d.polygon([xy(q) for q in h.coords],fill='#e6e9df')
        cx,cy=r['center']
        if x0<cx<x1 and y0<cy<y1:d.text(xy((cx,cy)),r['name'],font=font,anchor='mm',fill='#242a20',stroke_width=1,stroke_fill='#e6e9df')
    im.save(W/file)
print(json.dumps({k:v for k,v in report.items() if k not in ['checks','changedIds','inheritedOverlaps']},ensure_ascii=False));print('FAILURES',json.dumps([c for c in checks if not c['passed']],ensure_ascii=False))
sys.exit(1 if report['failed'] else 0)
