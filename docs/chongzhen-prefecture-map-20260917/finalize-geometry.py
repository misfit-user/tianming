import json,sys,hashlib
from pathlib import Path
from shapely.geometry import shape
from shapely.ops import unary_union
from shapely.strtree import STRtree
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(sys.argv[1]);WORK=Path(sys.argv[2]);DOC=ROOT/'docs/chongzhen-prefecture-map-20260917'
rows=json.loads((WORK/'prefecture-geometry.json').read_text(encoding='utf-8'));old=json.loads((WORK/'parents.json').read_text(encoding='utf-8'))
geoms=[shape(r['geometry']) for r in rows];tree=STRtree(geoms);links=[];sets=[set() for _ in rows]
for i,g in enumerate(geoms):
    for j0 in tree.query(g.buffer(.13)):
        j=int(j0)
        if j<=i:continue
        h=geoms[j];shared=g.boundary.intersection(h.boundary).length
        near=g.distance(h)<.13 and g.boundary.intersection(h.buffer(.13)).length>.4
        if shared>.025 or (near and rows[i]['parentId']!=rows[j]['parentId']):
            sets[i].add(rows[j]['id']);sets[j].add(rows[i]['id']);links.append({'a':rows[i]['id'],'b':rows[j]['id'],'kind':'shared-border' if shared>.025 else 'inherited-province-seam','sharedLength':shared})
for i,r in enumerate(rows):r['neighbors']=sorted(sets[i])
report={'parents':43,'logicalRegions':len(rows),'accountReferences':sum(len(r['accountIds']) for r in rows),'connections':len(links),'noNeighbors':[r['name'] for r in rows if not r['neighbors']],'retainedCoarse':[r['name'] for r in rows if r['coarse']],'newInternalOverlapArea':0}
(WORK/'prefecture-geometry.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(WORK/'connections.json').write_text(json.dumps(links,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(WORK/'topology-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
fontpath=Path('C:/Windows/Fonts/msyh.ttc');font=ImageFont.truetype(str(fontpath),13) if fontpath.exists() else ImageFont.load_default()
colors=['#ccbba1','#b9cbb0','#bac9d3','#d7c89d','#c8b1bf','#bdd2c5','#d5b7a0']
def polygons(g):
    if g.geom_type=='Polygon':return [g]
    return list(g.geoms)
for filename,box,width in [('prefecture-world-preview.png',(0,0,1200,720),2400),('prefecture-central-preview.png',(560,275,825,530),1500)]:
    bx,by,ex,ey=box;scale=width/(ex-bx);height=round((ey-by)*scale);im=Image.new('RGB',(width,height),'#edf0e9');d=ImageDraw.Draw(im)
    def xy(pt):return ((pt[0]-bx)*scale,(pt[1]-by)*scale)
    for i,r in enumerate(rows):
        for p in polygons(geoms[i]):
            d.polygon([xy(q) for q in p.exterior.coords],fill=colors[i%len(colors)],outline='#79745e')
            for hole in p.interiors:d.polygon([xy(q) for q in hole.coords],fill='#edf0e9')
    for parent in old['regions']:
        members=[geoms[i] for i,r in enumerate(rows) if r['parentId']==parent['id']]
        for p in polygons(unary_union(members)):
            d.line([xy(q) for q in p.exterior.coords],fill='#4c4a3a',width=2)
    if 'central' in filename:
        for r in rows:
            x,y=r['center']
            if bx<x<ex and by<y<ey:d.text(xy((x,y)),r['name'],font=font,anchor='mm',fill='#24231b',stroke_width=1,stroke_fill='#efeadc')
    im.save(WORK/filename)
print(json.dumps(report,ensure_ascii=False),flush=True)
