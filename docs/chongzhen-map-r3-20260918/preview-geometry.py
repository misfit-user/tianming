import json,sys
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from shapely.geometry import shape,box
W=Path(sys.argv[1]);s=json.loads((W/'candidate.json').read_text(encoding='utf-8'));rows=s['map']['regions']
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',17)
fontSmall=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',12)
def polygons(g):
    if g.geom_type=='Polygon':return [g]
    return [p for c in getattr(g,'geoms',[]) for p in polygons(c)]
for name,bounds in [('liaodong-proof',(745,260,845,330)),('steppe-proof',(560,245,830,340))]:
    x0,y0,x1,y1=bounds;scale=1600/(x1-x0);im=Image.new('RGB',(1600,round((y1-y0)*scale)),'#bed3d0');d=ImageDraw.Draw(im)
    for r in rows:
        g=shape(r['geometry']).intersection(box(*bounds))
        for p in polygons(g):
            if p.is_empty:continue
            pts=[((x-x0)*scale,(y-y0)*scale) for x,y in p.exterior.coords]
            d.polygon(pts,fill=r.get('color') or '#d6c397',outline='#504836',width=1)
            for h in p.interiors:d.polygon([((x-x0)*scale,(y-y0)*scale) for x,y in h.coords],fill='#bed3d0')
    for r in rows:
        x,y=r['center'];px=(x-x0)*scale;py=(y-y0)*scale
        if 5<px<1590 and 10<py<im.height-20:d.text((px,py),r['name'],font=fontSmall if len(r['name'])>5 else font,fill='#302b20',anchor='mm')
    d.rectangle((0,0,1000,29),fill='#222222');d.text((8,3),'R3 几何审查图（非游戏截图）：控制边界与海岛位置',font=font,fill='white');im.save(W/(name+'.png'))
print('Geometry previews rendered')
