// Pure, deterministic scenario-map projection. No scenario or live-game writes.
(function(root,factory) {
  'use strict';
  var node=typeof module==='object' && module.exports;
  var api=factory(node?require('./libs/polygon-clipping-0.15.7.min.js'):root.polygonClipping);
  if(node)module.exports=api;
  else {root.TM=root.TM || {};root.TM.MapEditor=root.TM.MapEditor || {};root.TM.MapEditor.scenarioGeometry=api;}
})(typeof globalThis!=='undefined'?globalThis:this,function(clip) {
  'use strict';
  var clone=function(v) {return JSON.parse(JSON.stringify(v));};
  var levels={realm:'country',region:'province',prefecture:'prefecture'};
  function fail(message) {throw new Error(message);}
  function area(r) {var n=0;for(var i=0,j=r.length-1;i<r.length;j=i++)n+=r[j][0]*r[i][1]-r[i][0]*r[j][1];return Math.abs(n/2);}
  function closed(r) {
    if(!Array.isArray(r) || r.length<3)fail('地图轮廓缺少有效顶点');
    var out=r.map(function(p) {if(!Array.isArray(p)||p.length<2||!Number.isFinite(p[0])||!Number.isFinite(p[1]))fail('地图轮廓包含无效坐标');return [p[0],p[1]];});
    if(out[0][0]!==out[out.length-1][0] || out[0][1]!==out[out.length-1][1])out.push(out[0].slice());
    if(!area(out))fail('地图轮廓面积为零');return out;
  }
  function polygons(region) {
    var g=region.geometry,parts;
    if(g && g.type==='MultiPolygon')parts=g.coordinates;
    else if(g && g.type==='Polygon')parts=[g.coordinates];
    else {
      var outer=region.polygon || region.points;
      if(!outer && Array.isArray(region.coords)){outer=[];for(var i=0;i<region.coords.length;i+=2)outer.push([region.coords[i],region.coords[i+1]]);}
      parts=[[outer].concat(region.holes || [])].concat((region.extraPolygons || []).map(function(r,i) {return [r].concat((region.extraPolygonHoles || [])[i] || []);}));
    }
    if(!Array.isArray(parts)||!parts.length)fail('地块没有轮廓：'+region.id);
    return parts.map(function(p) {if(!Array.isArray(p)||!p.length)fail('地块几何为空');return p.map(closed);});
  }
  function nativeGeometry(parts) {
    var all=clone(parts).sort(function(a,b) {return area(b[0])-area(a[0]);});
    function open(r) {var p=r.slice();if(p.length>1&&p[0][0]===p[p.length-1][0]&&p[0][1]===p[p.length-1][1])p.pop();return p;}
    return {polygon:open(all[0][0]),holes:all[0].slice(1).map(open),extraPolygons:all.slice(1).map(function(p) {return open(p[0]);}),extraPolygonHoles:all.slice(1).map(function(p) {return p.slice(1).map(open);})};
  }
  function owner(r) {return String(r.currentOwnerKey || r.ownerKey || r.controllerKey || r.stableFactionId || r.factionId || r.owner || 'unowned');}
  function regionId(circuit,faction) {return 'province:'+encodeURIComponent(circuit)+':'+encodeURIComponent(faction);}
  function realmId(faction) {return 'realm:'+encodeURIComponent(faction);}
  function merge(members) {
    if(!clip || typeof clip.union!=='function')fail('多边形合并组件未加载');
    var input=members.map(polygons),result=input.length===1?input[0]:clip.union.apply(null,input);
    if(!result.length)fail('地图聚合产生空轮廓');return nativeGeometry(result);
  }
  function graph(divisions,leaves) {
    var owners=new Map();divisions.forEach(function(d) {(d.sourceRegionIds || [d.id]).forEach(function(id) {owners.set(id,d.id);});});
    var adjacent=new Map(divisions.map(function(d) {return [d.id,new Set()];}));
    leaves.forEach(function(d) {var a=owners.get(d.id);(d.neighbors || []).forEach(function(id) {var b=owners.get(id);if(a&&b&&a!==b){adjacent.get(a).add(b);adjacent.get(b).add(a);}});});
    divisions.forEach(function(d) {d.neighbors=Array.from(adjacent.get(d.id)).sort();});
  }
  function aggregate(leaves,circuits,factions,previous) {
    var byCircuit=new Map(circuits.map(function(c) {return [c.id,c];})),groups=new Map(),realms=new Map();
    var old=new Map((previous || []).map(function(d) {return [d.id,d];}));
    leaves.forEach(function(d) {
      var circuit=byCircuit.get(d.sourceCircuitId);if(!circuit)fail('地块缺少真实省道分组：'+d.name);
      var key=regionId(circuit.id,d.factionId),rkey=realmId(d.factionId);
      if(!groups.has(key))groups.set(key,{id:key,circuit:circuit,owner:d.factionId,members:[]});
      if(!realms.has(rkey))realms.set(rkey,{id:rkey,owner:d.factionId,members:[]});
      groups.get(key).members.push(d);realms.get(rkey).members.push(d);d.parentId=key;
    });
    var region=Array.from(groups.values()).map(function(g) {
      return Object.assign({description:g.circuit.note || '',terrain:'平原'},old.get(g.id) || {},{id:g.id,logicalRegionId:g.id,name:old.has(g.id)?old.get(g.id).name:g.circuit.name,level:'province',
        parentId:realmId(g.owner),sourceParentId:g.circuit.id,sourceCircuitId:g.circuit.id,sourceRegionIds:g.members.map(function(d) {return d.id;}),
        factionId:g.owner,layerRole:'region'},merge(g.members));
    });
    var realm=Array.from(realms.values()).map(function(g) {
      var f=factions.find(function(row) {return row.id===g.owner;});
      return Object.assign({terrain:'平原'},old.get(g.id) || {},{id:g.id,logicalRegionId:g.id,name:old.has(g.id)?old.get(g.id).name:(f?f.name:g.owner),level:'country',parentId:'',
        sourceRegionIds:g.members.map(function(d) {return d.id;}),factionId:g.owner,layerRole:'realm'},merge(g.members));
    });
    graph(region,leaves);graph(realm,leaves);return {region:region,realm:realm};
  }
  function compile(scenario,provenance) {
    var map=scenario.map || scenario.mapData;if(!map || !Array.isArray(map.regions) || !map.regions.length)fail('剧本没有可用地图');
    var seen=new Set(),factions=[],factionById=new Map(),rawFactions=map.factions || {};
    function faction(id,r) {
      if(factionById.has(id))return;
      var f=Array.isArray(rawFactions)?rawFactions.find(function(row) {return row.id===id || row.key===id;}):rawFactions[id];
      var value={id:id,name:f&&f.name || r.factionName || r.ownerName || id,color:f&&f.color || r.factionColor || r.color || '#888888'};
      factions.push(value);factionById.set(id,value);
    }
    var rawCircuits=Array.isArray(map.circuitRegistry)?map.circuitRegistry:[],membership=new Map();
    var circuits=rawCircuits.map(function(c) {
      var id=String(c.id || c.key || '');if(!id || !c.name)fail('省道分组缺少 ID 或名称');
      (c.memberRegionIds || []).forEach(function(rid) {if(membership.has(rid)&&membership.get(rid)!==id)fail('地块有多个省道分组：'+rid);membership.set(rid,id);});
      return {id:id,name:c.name,note:c.note || ''};
    });
    var circuitIds=new Set(circuits.map(function(c) {return c.id;}));
    var leaves=map.regions.map(function(r) {
      if(!r || typeof r.id!=='string' || !r.id || seen.has(r.id))fail('地图地块 ID 缺失或重复');seen.add(r.id);
      var fid=owner(r),cid=r.circuitId || r.parentId || membership.get(r.id);
      if(!circuitIds.has(cid))fail('无法确认地块所属省道：'+r.name);faction(fid,r);
      var data=r.data || {};
      return Object.assign({id:r.id,logicalRegionId:r.id,name:r.name || r.id,level:'prefecture',layerRole:'prefecture',factionId:fid,
        sourceRegionIds:[r.id],sourceParentId:r.parentId || cid,sourceCircuitId:cid,sourceMapRegionId:r.id,
        terrain:r.terrain || data.terrain || '平原',description:data.description || '',officialPosition:data.officialPosition || '',
        prosperity:Number.isFinite(r.prosperity)?r.prosperity:50,neighbors:(r.neighbors || []).slice()},nativeGeometry(polygons(r)));
    });
    graph(leaves,leaves);
    var parents=aggregate(leaves,circuits,factions),labels={realm:'天下',region:'省道',prefecture:'府州'};
    return {schemaVersion:'tm-map-editor-library/1',source:Object.assign({id:scenario.id,name:scenario.name,dynasty:scenario.dynasty || '',era:scenario.era || '',mapId:map.id || ''},provenance),
      base:{title:map.name || scenario.name,bitmapWidth:map.width || 1280,bitmapHeight:map.height || 800,factions:factions},
      circuits:circuits,labels:labels,layers:{realm:parents.realm,region:parents.region,prefecture:leaves}};
  }
  function materialize(bundle,tier,dynasty) {
    if(!bundle || bundle.schemaVersion!=='tm-map-editor-library/1' || !bundle.source || !bundle.layers)fail('地图资产格式不匹配');
    if(['all','realm','region','prefecture'].indexOf(tier)<0)fail('地图层级无效');
    var names=tier==='all'?['realm','region','prefecture']:[tier],divisions=[];
    names.forEach(function(name) {if(!Array.isArray(bundle.layers[name])||!bundle.layers[name].length)fail('源地图没有'+name+'层');divisions=divisions.concat(clone(bundle.layers[name]));});
    if(tier!=='all')divisions.forEach(function(d) {d.parentId='';});
    var counts={};names.forEach(function(name) {counts[name]=bundle.layers[name].length;});
    return Object.assign(clone(bundle.base),{version:1,dynasty:dynasty || bundle.source.dynasty,era:bundle.source.era || '',
      title:bundle.base.title+' · '+(tier==='all'?'三级地图':bundle.labels[tier]),bitmapUrl:'',divisions:divisions,
      meta:{scenarioMap:{version:1,source:clone(bundle.source),tier:tier,levels:names,defaultLevel:levels[tier==='all'?'prefecture':tier],counts:counts,circuits:clone(bundle.circuits)}}});
  }
  function rebuild(map) {
    var meta=map.meta && map.meta.scenarioMap;if(!meta || meta.tier!=='all')return map;
    var leaves=map.divisions.filter(function(d) {return d.layerRole==='prefecture';}),parents=aggregate(leaves,meta.circuits,map.factions,map.divisions);
    map.divisions=parents.realm.concat(parents.region,leaves);meta.counts={realm:parents.realm.length,region:parents.region.length,prefecture:leaves.length};return map;
  }
  return {compile:compile,materialize:materialize,rebuild:rebuild,polygons:polygons,nativeGeometry:nativeGeometry,levels:levels};
});
