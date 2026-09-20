import json,sys,re
from pathlib import Path
from shapely.geometry import Polygon,shape
from shapely.ops import unary_union
from shapely import make_valid
ROOT=Path(sys.argv[1]);WORK=Path(sys.argv[2]);s=json.loads((WORK/'candidate.json').read_text(encoding='utf-8'))
p=json.loads((WORK/'prepared-parents.json').read_text(encoding='utf-8'));rows=s['map']['regions'];checks=[]
def check(name,ok,detail=None):
    checks.append({'name':name,'passed':bool(ok),'detail':detail})
def polygons(g):
    if g.geom_type=='Polygon':return [g]
    return [p for c in getattr(g,'geoms',[]) for p in polygons(c)]
for parent in p:
    old=shape(parent['geometry']);members=[shape(r['geometry']) for r in rows if r['sourceProvinceId']==parent['id']];joined=unary_union(members)
    gap=old.symmetric_difference(joined).area;overlap=sum(g.area for g in members)-joined.area
    check(parent['id']+'-coverage',gap<1e-5,{'symmetricDifference':gap});check(parent['id']+'-no-internal-overlap',abs(overlap)<1e-5,{'overlap':overlap})
for r in rows:
    g=shape(r['geometry']);check(r['id']+'-valid-nonempty',g.is_valid and not g.is_empty and g.area>0)
    parts=[]
    for piece in re.split('[Mm]',r['path'])[1:]:
        nums=[float(x) for x in re.findall(r'[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',piece)]
        if len(nums)>=6:parts.append(make_valid(Polygon(list(zip(nums[::2],nums[1::2])))))
    pathpoly=Polygon()
    for part in parts:pathpoly=pathpoly.symmetric_difference(part)
    difference=g.symmetric_difference(pathpoly).area
    check(r['id']+'-svg-geometry-equivalent',difference<.0002,{'difference':difference})
report={'passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks,'scope':'Subdivision preserves each inherited parent; pre-existing cross-parent overlaps are not silently rewritten.'}
(WORK/'geometry-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='checks'},ensure_ascii=False));sys.exit(1 if report['failed'] else 0)
