// Stage narrow runtime changes beside backups; do not modify installed files here.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||'.'), work=path.join(root,'docs/shaosong-map-integration-20260917/map-stage');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'), plans=[];
function transform(name,fn){const file=path.join(root,'web',name),before=fs.readFileSync(file),text=before.toString('utf8');let after=fn(text);
 assert.notEqual(after,text,'No runtime change: '+name);const b=path.join(work,'runtime-before',name),a=path.join(work,'runtime-after',name);
 fs.mkdirSync(path.dirname(b),{recursive:true});fs.mkdirSync(path.dirname(a),{recursive:true});
 fs.writeFileSync(b,before);fs.writeFileSync(a,after);plans.push({name,before:hash(before),after:hash(after)});}
function one(text,from,to){assert.equal(text.split(from).length,2,'Patch context missing or ambiguous: '+from.slice(0,80));return text.replace(from,to);}
transform('tm-fiscal-engine.js',text=>one(text,
 '        add(byId[binding] || byId[r.mapRegionId] || byId[r.id] || byMapId[binding] || byMapId[r.mapRegionId] || byMapId[r.id] || named(r.name));',
 `        if (map.sourceBudgetModel === 'source-partition-v1' && Array.isArray(r.accountingLeafIds)) {
          r.accountingLeafIds.forEach(function(id) { add(byId[id]); });
        } else add(byId[binding] || byId[r.mapRegionId] || byId[r.id] || byMapId[binding] || byMapId[r.mapRegionId] || byMapId[r.id] || named(r.name));`));
transform('phase8-formal-map-dossier.js',text=>one(text,
 'var hint = a.regionHint || a.regionId;',
 'var hint = a.garrisonRegionId || a.regionId || a.regionHint;'));
transform('tm-faction-membership.js',text=>{
 text=one(text,'      write(rec.division,false);',`      write(rec.division,false);
      // A logical cell can retain multiple original accounts. Transfer the whole cell atomically.
      if (rec.division && rec.division.mapAccounting && rec.division.mapAccounting.schema === 'source-partition-v1') {
        function transferAccounts(n) {
          if (!n) return; write(n,false);
          [n.id,n.name].filter(Boolean).forEach(function(k) {
            table[k]=newName;
            if (g.provinceStats && g.provinceStats[k]) write(g.provinceStats[k],false);
          });
          (n.children || []).forEach(transferAccounts);
        }
        transferAccounts(rec.division);
        var hierarchy=g.adminHierarchy, sourceSlot=null;
        function findSlot(parent,key,rootKey) {
          (parent[key] || []).forEach(function(n) {
            if (n===rec.division) sourceSlot={parent:parent,key:key,rootKey:rootKey};
            else ['children','divisions'].forEach(function(k) {
              if(Array.isArray(n[k]))findSlot(n,k,rootKey);
            });
          });
        }
        Object.keys(hierarchy).forEach(function(k) {
          if(hierarchy[k] && Array.isArray(hierarchy[k].divisions))findSlot(hierarchy[k],'divisions',k);
        });
        var player=g.playerInfo || {}, targetKey=newId || '__unassigned_map_accounts';
        if ((player.factionId===newId || player.factionName===newName) && hierarchy.player) targetKey='player';
        if (sourceSlot && sourceSlot.rootKey!==targetKey) {
          remember(sourceSlot.parent);
          sourceSlot.parent[sourceSlot.key]=sourceSlot.parent[sourceSlot.key].filter(function(n){return n!==rec.division;});
          remember(hierarchy);
          if (!hierarchy[targetKey]) hierarchy[targetKey]={factionId:newId,divisions:[]};
          var destination=hierarchy[targetKey], targetContainer=destination.divisions && destination.divisions[0];
          if (targetContainer && Array.isArray(targetContainer.children)) {
            remember(targetContainer); targetContainer.children=targetContainer.children.concat([rec.division]);
          } else {
            remember(destination); destination.divisions=(destination.divisions || []).concat([rec.division]);
          }
        }
      }`);
 text=one(text,'[r.id,r.name,r.adminBinding,r.mapRegionId].filter(Boolean).forEach(function(k) {',
 '[r.id,r.name,r.adminBinding,r.mapRegionId].concat(r.accountingLeafIds || [], r.accountingLeafNames || []).filter(Boolean).forEach(function(k) {');
 return text;
});
transform('tm-faction-derived-economy.js',text=>{
 text=one(text,'    var taxMoney = territoryCount * taxCoef.money;',
 `    var accountingMap = global.GM && (global.GM.mapData || global.GM.map);
    var sourcePartition = accountingMap && accountingMap.sourceBudgetModel === 'source-partition-v1';
    if (sourcePartition) {
      territoryCount = (accountingMap.regions || []).reduce(function(total,r) {
        var owner=r.currentOwner || r.owner || r.factionId;
        return total + ((owner===fac.id || owner===fac.name) ? Math.max(0,Number(r.data && r.data.legacyFiscalWeight)||0) : 0);
      },0);
    }
    var taxMoney = territoryCount * taxCoef.money;`);
 text=one(text,'        sum += f; n += 1;',
 `        var accountWeight=1;
        if (sourcePartition) {
          var cell=(accountingMap.regions || []).find(function(r){return r.id===p || r.name===p;});
          if (cell) accountWeight=Math.max(0,Number(cell.data && cell.data.legacyFiscalWeight)||0);
        }
        sum += f*accountWeight; n += accountWeight;`);
 return text;
});
fs.writeFileSync(path.join(work,'runtime-plan.json'),JSON.stringify(plans,null,2));
console.log(JSON.stringify({staged:true,installed:false,files:plans},null,2));
