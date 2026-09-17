'use strict';
module.exports=function inspectLabels(tier){
  tier=tier||'realm';
  const api=TMPhase8FormalBridge.map,map=api.getMapData(),G=TMMapRealmLayout,svg=document.getElementById('tmf-formal-map'),inverse=svg.getScreenCTM().inverse();
  const ownership=new Map(),factions=new Map(),owners=[];
  for(const r of map.regions){const raw=api.ownerKey(r),hint=r.factionName||r.ownerName,lookup=String(raw)+'|'+String(hint);if(!factions.has(lookup))factions.set(lookup,api.findFaction(raw,hint));const f=factions.get(lookup),key=String(f&&(f.stableOwnerKey||f.mapFactionId||f.id)||raw);owners.push(key);if(!ownership.has(key))ownership.set(key,[]);ownership.get(key).push(G.region(r));}
  const administration=new Map();if(tier==='region')for(const item of G.administrativeGroups(map,owners)){if(!administration.has(item.group))administration.set(item.group,[]);administration.get(item.group).push(G.region(item.region));}
  return Array.from(svg.querySelectorAll(tier==='realm'?'.tmf-realm-fit':'.tmf-region-label.tmf-territory-fit')).map(g=>{
    const packs=tier==='realm'?(ownership.get(g.dataset.factionKey)||[]):tier==='region'?(administration.get(g.dataset.labelGroup)||[]):[G.region(map.regions[Number(g.dataset.regionIndex)])].filter(Boolean);
    const text=g.querySelector('text.main'),matrix=text&&text.getScreenCTM();
    const row={name:g.dataset.fullName,tier:g.dataset.labelTier,regions:packs.length,visible:!g.classList.contains('tmf-collide-hidden'),opacity:getComputedStyle(g).opacity,tested:0,outside:0,decorations:g.querySelectorAll('rect,path,circle').length,fontPx:matrix&&parseFloat(getComputedStyle(text).fontSize)*Math.hypot(matrix.a,matrix.b),nominal:Number(g.dataset.fs),transform:g.getAttribute('transform'),vertical:g.querySelectorAll('text.main').length>1,tabindex:g.getAttribute('tabindex')};
    if(row.visible)for(const t of g.querySelectorAll('text.main')){
      const b=t.getBBox(),matrix=inverse.multiply(t.getScreenCTM());for(let x=0;x<=12;x++)for(let y=0;y<=4;y++){const p=new DOMPoint(b.x+b.width*x/12,b.y+b.height*y/4).matrixTransform(matrix);row.tested++;if(!G.contains(packs,p.x,p.y))row.outside++;}
    }
    return row;
  });
};
