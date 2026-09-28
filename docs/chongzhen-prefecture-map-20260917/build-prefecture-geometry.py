"""Partition inherited province polygons into playable prefectures."""
import json, math, sys, time, heapq
from pathlib import Path
from collections import defaultdict
import numpy as np
from shapely import contains_xy, make_valid
from shapely.geometry import shape, mapping, Polygon, Point, LineString
from shapely.ops import polygonize, unary_union, nearest_points
ROOT=Path(sys.argv[1]); WORK=Path(sys.argv[2]); DOC=ROOT/'docs/chongzhen-prefecture-map-20260917'
parents=json.loads((WORK/'prepared-parents.json').read_text(encoding='utf-8'))
cal=json.loads((WORK/'calibration.json').read_text(encoding='utf-8')); affine=np.array(cal['affine'])
def project(pair):
    lon,lat=pair; p=cal['sourceProjection']; b=cal['sourceBounds']
    return np.array([p['offsetX']+(lon-b[0])*p['scale'],p['offsetY']+(b[3]-lat)*p['scale'],1])@affine
ridges=json.loads((DOC/'author-ridges.json').read_text(encoding='utf-8'))
for ridge in ridges: ridge['xy']=[project(p) for p in ridge['points']]
def polys(g):
    if g.geom_type=='Polygon': return [g]
    return [p for child in getattr(g,'geoms',[]) for p in polys(child)]
def clean(g): return unary_union(polys(make_valid(g)))
def smooth(coords,iterations=2):
    if len(coords)<4: return coords
    points=np.array(coords,dtype=float)
    for _ in range(iterations):
        out=[points[0]]
        for a,b in zip(points[:-1],points[1:]): out.extend([a*.75+b*.25,a*.25+b*.75])
        out.append(points[-1]);points=np.array(out)
    return list(LineString(points).simplify(.09,preserve_topology=True).coords)
def partition(parent,seedrows):
    land=shape(parent['geometry']); step=.42
    bx,by,ex,ey=land.bounds
    ox=math.floor((bx-2)/step)*step; oy=math.floor((by-2)/step)*step
    W=math.ceil((ex+2-ox)/step); H=math.ceil((ey+2-oy)/step)
    xx,yy=np.meshgrid(ox+(np.arange(W)+.5)*step,oy+(np.arange(H)+.5)*step)
    inside=contains_xy(land,xx,yy); cost=np.ones((H,W),dtype=float)
    active_ridges=0
    for ridge in ridges:
        line=LineString(ridge['xy'])
        if not line.buffer(8).intersects(land): continue
        active_ridges+=1; dist2=np.full((H,W),1e20)
        for a,b in zip(ridge['xy'][:-1],ridge['xy'][1:]):
            dx,dy=b-a; den=dx*dx+dy*dy
            if den==0: continue
            t=np.clip(((xx-a[0])*dx+(yy-a[1])*dy)/den,0,1)
            dist2=np.minimum(dist2,(xx-a[0]-t*dx)**2+(yy-a[1]-t*dy)**2)
        cost+=ridge['strength']*np.exp(-dist2/(2*ridge['width']**2))
    cost[~inside]=30.0
    dist=np.full(H*W,np.inf); labels=np.zeros(H*W,dtype=np.int32); c=cost.ravel(); queue=[]
    seed_pixels=[]
    for k,s in enumerate(seedrows,1):
        x,y=s['anchor']; col=min(W-1,max(0,int((x-ox)/step))); row=min(H-1,max(0,int((y-oy)/step)))
        candidates=[]
        for radius in range(0,30):
            for rr in range(max(0,row-radius),min(H,row+radius+1)):
                for cc in range(max(0,col-radius),min(W,col+radius+1)):
                    idx=rr*W+cc
                    if inside[rr,cc] and idx not in seed_pixels: candidates.append(((xx[rr,cc]-x)**2+(yy[rr,cc]-y)**2,idx))
            if candidates: break
        if not candidates: raise ValueError('No land pixel for '+s['name'])
        idx=min(candidates)[1]; seed_pixels.append(idx); dist[idx]=0; labels[idx]=k; heapq.heappush(queue,(0.,k,idx))
    directions=[(-1,0,1),(1,0,1),(0,-1,1),(0,1,1),(-1,-1,math.sqrt(2)),(-1,1,math.sqrt(2)),(1,-1,math.sqrt(2)),(1,1,math.sqrt(2))]
    while queue:
        d,k,i=heapq.heappop(queue)
        if d!=dist[i] or k!=labels[i]: continue
        row,col=divmod(i,W)
        for dy,dx,length in directions:
            rr=row+dy; cc=col+dx
            if not (0<=rr<H and 0<=cc<W): continue
            j=rr*W+cc; nd=d+length*(c[i]+c[j])*.5
            if nd<dist[j]-1e-10:
                dist[j]=nd;labels[j]=k;heapq.heappush(queue,(nd,k,j))
    labels=labels.reshape(H,W)
    edges=defaultdict(list)
    def edge(a,b,p,q):
        if a!=b: edges[tuple(sorted((int(a),int(b))))].append((p,q))
    for row in range(H):
        for col in range(W):
            k=labels[row,col]
            if row==0: edge(0,k,(col,0),(col+1,0))
            if col==0: edge(0,k,(0,row),(0,row+1))
            edge(k,labels[row+1,col] if row+1<H else 0,(col,row+1),(col+1,row+1))
            edge(k,labels[row,col+1] if col+1<W else 0,(col+1,row),(col+1,row+1))
    lines=[]; arc_count=0
    for pair,segments in edges.items():
        links=defaultdict(list)
        for i,(p,q) in enumerate(segments):links[p].append((q,i));links[q].append((p,i))
        used=set()
        starts=[p for p,v in links.items() if len(v)!=2]+list(links)
        for first in starts:
            for neighbor,eid in links[first]:
                if eid in used: continue
                path=[first,neighbor];used.add(eid);current=neighbor
                while len(links[current])==2:
                    remaining=[(q,j) for q,j in links[current] if j not in used]
                    if not remaining:break
                    current,j=remaining[0];path.append(current);used.add(j)
                coords=[(ox+x*step,oy+y*step) for x,y in path]
                if 0 not in pair:coords=smooth(coords);arc_count+=1
                lines.append(LineString(coords))
    faces=list(polygonize(unary_union(lines))); groups=defaultdict(list)
    seedpoints=[Point(ox+(i%W+.5)*step,oy+(i//W+.5)*step) for i in seed_pixels]
    for face in faces:
        hits=[i+1 for i,p in enumerate(seedpoints) if face.covers(p)]
        p=face.representative_point();row=min(H-1,max(0,int((p.y-oy)/step)));col=min(W-1,max(0,int((p.x-ox)/step)))
        owner=hits[0] if len(hits)==1 else int(labels[row,col])
        clipped=clean(face.intersection(land))
        if not clipped.is_empty:groups[owner].append(clipped)
    result={i:clean(unary_union(groups[i])) for i in range(1,len(seedrows)+1)}
    for i,g in result.items():
        if g.is_empty:raise ValueError('Empty logical cell '+seedrows[i-1]['name'])
    covered=unary_union(list(result.values())); residual=clean(land.difference(covered))
    for tiny in polys(residual):
        owner=min(result,key=lambda i:result[i].distance(tiny.representative_point()))
        result[owner]=clean(result[owner].union(tiny))
    gap=land.symmetric_difference(unary_union(list(result.values()))).area
    overlap=sum(g.area for g in result.values())-unary_union(list(result.values())).area
    assert gap<1e-5 and abs(overlap)<1e-5,(parent['name'],gap,overlap)
    return result,{'pixels':H*W,'sharedArcs':arc_count,'ridges':active_ridges,'gapArea':gap,'overlapArea':overlap}
output=[];reports=[];started=time.time()
selected=set(sys.argv[3:])
for parent in parents:
    if selected and parent['id'] not in selected:continue
    land=shape(parent['geometry']); seeds=parent['seeds']
    deferred=max(s['outsideParentDistance'] for s in seeds)>15 or parent['id']=='ming-31'
    if deferred:
        point=land.representative_point();entry={'id':parent['id'],'parentId':parent['id'],'name':parent['name'],'accountIds':[s['id'] for s in seeds],'geometry':mapping(land),'center':[point.x,point.y],'coarse':True,'reason':'small-city-scale' if parent['id']=='ming-31' else 'inherited-outline-reference-conflict'}
        output.append(entry);reports.append({'id':parent['id'],'name':parent['name'],'mode':'retained-coarse','accounts':len(seeds),'regions':1,'reason':entry['reason']})
        print(parent['name']+' retained coarse; no fictitious city displacement',flush=True);continue
    # Keep separate source ledgers, but synonymous names at one location share one logical unit.
    merge={'ming-18':{5:0},'ming-19':{6:1}}.get(parent['id'],{})
    keep=[(i,s) for i,s in enumerate(seeds) if i not in merge]
    geoms,details=partition(parent,[s for i,s in keep])
    for j,(oldindex,s) in enumerate(keep,1):
        g=geoms[j];point=g.representative_point();name=s['name']
        if name=='太平府':name=('广西' if parent['id']=='ming-06' else '南直隶')+name
        if name=='建昌府':name='江西建昌府'
        if name=='乌思藏都指挥使司':name='乌思藏本部地域'
        if name=='朵甘思宣慰司':name='朵甘思本部地域'
        accountIds=[s['id']]+[seeds[i]['id'] for i,target in merge.items() if target==oldindex]
        output.append({'id':parent['id']+'-p'+str(oldindex+1).zfill(2),'parentId':parent['id'],'name':name,'originalName':s['name'],'accountIds':accountIds,'geometry':mapping(g),'center':[point.x,point.y],'referenceSeat':s['referenceXY'],'referenceLonLat':s['lonLat'],'referenceOutsideParentDistance':s['outsideParentDistance'],'coarse':False,'precision':'geographic-constraint-inference-not-surveyed-boundary'})
    reports.append({'id':parent['id'],'name':parent['name'],'mode':'subdivided','accounts':len(seeds),'regions':len(keep),**details})
    print(parent['name']+' -> '+str(len(keep))+' units; '+str(round(time.time()-started,1))+'s',flush=True)
(WORK/('geometry-sample.json' if selected else 'prefecture-geometry.json')).write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(WORK/('geometry-sample-report.json' if selected else 'geometry-report.json')).write_text(json.dumps({'regions':len(output),'parents':len(reports),'reports':reports,'elapsedSeconds':time.time()-started},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'regions':len(output),'parents':len(reports),'elapsedSeconds':time.time()-started}),flush=True)
