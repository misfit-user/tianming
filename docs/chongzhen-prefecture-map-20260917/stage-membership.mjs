// Prepare province-group adapters without changing the installed runtime.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]),file=path.join(root,'web/tm-faction-membership.js');
const before=fs.readFileSync(file),hash=b=>crypto.createHash('sha256').update(b).digest('hex');let text=before.toString('utf8');
function one(a,b){if(text.includes('\r\n')){a=a.replace(/\r?\n/g,'\r\n');b=b.replace(/\r?\n/g,'\r\n');}assert.equal(text.split(a).length,2,a.slice(0,80));text=text.replace(a,b);}
one('    var table=g._provinceToFaction || {}, map=g.mapData || g.map, index=new Map(), seen=new Set(), out=[];',`    var table=g._provinceToFaction || {}, map=g.mapData || g.map, index=new Map(), seen=new Set(), out=[];
    // Only province-migrated maps use authoritative cell enumeration.
    if (map && Array.isArray(map.provinceMigration)) {
      var counts=new Map();(map.regions||[]).forEach(function(r){counts.set(r.name,(counts.get(r.name)||0)+1);});
      return (map.regions||[]).filter(function(r){
        var owner=r.currentOwner || r.owner || r.factionId, f=_findFacById(owner)||_findFac(owner);
        return (f ? f.name : owner)===name;
      }).map(function(r){return counts.get(r.name)>1?r.id:r.name;});
    }`);
one("    var plans=[],seen=new Map(),facs=Array.isArray(g.facs)?g.facs:[];",`    var plans=[],seen=new Map(),facs=Array.isArray(g.facs)?g.facs:[];
    var migratedMap=g.mapData||g.map;
    if(migratedMap && Array.isArray(migratedMap.provinceMigration)) {
      var cells=migratedMap.regions||[],registry=migratedMap.circuitRegistry||[];
      changes=changes.flatMap(function(row){
        if(!row || typeof row!=='object' || Array.isArray(row))return [row];
        var ref=String(row.regionRef);
        if(cells.some(function(r){return String(r.id)===ref || r.name===ref;}))return [row];
        var groups=migratedMap.provinceMigration.filter(function(p){
          var circuit=registry.find(function(c){return c.sourceRegionId===p.id;});
          return p.id===ref || p.name===ref || p.adminId===ref || circuit && (circuit.id===ref || circuit.key===ref);
        });
        if(groups.length>1)throw new Error('省道引用不唯一：'+ref);
        if(!groups.length)return [row];
        if(!groups[0].memberRegionIds.length)throw new Error('省道没有可操作地块：'+ref);
        return groups[0].memberRegionIds.map(function(id){return Object.assign({},row,{regionRef:id});});
      });
    }`);
one("          sourceSlot.parent[sourceSlot.key]=sourceSlot.parent[sourceSlot.key].filter(function(n){return n!==rec.division;});",`          sourceSlot.parent[sourceSlot.key]=sourceSlot.parent[sourceSlot.key].filter(function(n){return n!==rec.division;});
          var provinceMap=rec.map, retiredParent=sourceSlot.parent;
          if(provinceMap && Array.isArray(provinceMap.provinceMigration) && sourceSlot.key==='children' && !retiredParent.children.length && provinceMap.provinceMigration.some(function(p){return p.adminId===retiredParent.id;})) {
            var sourceBucket=hierarchy[sourceSlot.rootKey];
            if(sourceBucket && (sourceBucket.divisions||[]).indexOf(retiredParent)>=0) {
              remember(sourceBucket);sourceBucket.divisions=sourceBucket.divisions.filter(function(n){return n!==retiredParent;});
              remember(g);
              if(!g._mapRetiredProvinceContainers)g._mapRetiredProvinceContainers={}; // arch-ok territory transaction archives an empty aggregate, not an account
              remember(g._mapRetiredProvinceContainers);
              g._mapRetiredProvinceContainers[retiredParent.id]={node:retiredParent,rootKey:sourceSlot.rootKey};
            }
          }`);
one("          var destination=hierarchy[targetKey], targetContainer=destination.divisions && destination.divisions[0];",`          var destination=hierarchy[targetKey], targetContainer=destination.divisions && destination.divisions[0];
          var provinceSource=rec.region && rec.region.sourceProvinceId;
          var provinceEntry=rec.map && (rec.map.provinceMigration||[]).find(function(p){return p.id===provinceSource;});
          if(provinceEntry) {
            var liveContainer=(destination.divisions||[]).find(function(n){return n.id===provinceEntry.adminId;});
            var retired=g._mapRetiredProvinceContainers && g._mapRetiredProvinceContainers[provinceEntry.adminId];
            if(!liveContainer && retired && retired.rootKey===targetKey) {
              remember(destination);destination.divisions=(destination.divisions||[]).concat([retired.node]);
              remember(g._mapRetiredProvinceContainers);delete g._mapRetiredProvinceContainers[provinceEntry.adminId];liveContainer=retired.node;
            }
            if(liveContainer)targetContainer=liveContainer;
          }`);
one("        if ((player.factionId===newId || player.factionName===newName) && hierarchy.player) targetKey='player';",`        if ((player.factionId===newId || player.factionName===newName) && hierarchy.player) targetKey='player';
        if (targetKey!=='player' && rec.map && Array.isArray(rec.map.provinceMigration)) {
          var existingRoots=Object.keys(hierarchy).filter(function(k){var v=hierarchy[k];return k!=='player' && v && (k===newId || v.factionId===newId || v.factionName===newName);});
          if(existingRoots.length===1)targetKey=existingRoots[0];
        }`);
one("          if (targetContainer && Array.isArray(targetContainer.children)) {",`          if (targetContainer && Array.isArray(targetContainer.children) && !(rec.map && rec.map.provinceMigration && targetContainer.mapAccounting)) {`);
one("    remember(g.turnChanges);if(g.turnChanges)remember(g.turnChanges.map);",`    remember(g.turnChanges);if(g.turnChanges)remember(g.turnChanges.map);
    if (migratedMap && migratedMap.sourceBudgetModel==='source-partition-v1') {
      // A batch rollback must include every container touched by its per-cell transfers.
      remember(g.adminHierarchy);var treeSeen=new Set();
      function rememberTree(n){if(!n || treeSeen.has(n))return;treeSeen.add(n);remember(n);['children','divisions'].forEach(function(k){if(Array.isArray(n[k])){remember(n[k]);n[k].forEach(rememberTree);}});}
      Object.keys(g.adminHierarchy||{}).forEach(function(k){rememberTree(g.adminHierarchy[k]);});
      remember(g._mapRetiredProvinceContainers);Object.keys(g._mapRetiredProvinceContainers||{}).forEach(function(k){rememberTree(g._mapRetiredProvinceContainers[k].node);});
    }`);

for(const dir of ['runtime-before','runtime-after'])fs.mkdirSync(path.join(work,dir),{recursive:true});
const old=path.join(work,'runtime-before/tm-faction-membership.js');if(fs.existsSync(old))assert.equal(hash(fs.readFileSync(old)),hash(before));else fs.writeFileSync(old,before);
fs.writeFileSync(path.join(work,'runtime-after/tm-faction-membership.js'),text);
fs.writeFileSync(path.join(work,'membership-plan.json'),JSON.stringify({file:'web/tm-faction-membership.js',before:hash(before),after:hash(text),scope:'maps with provinceMigration only'},null,2));console.log('Province membership adapter staged.');
