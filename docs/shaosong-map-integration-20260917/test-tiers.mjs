import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||'.'),work=path.join(root,'docs/shaosong-map-integration-20260917/map-stage');
const sc=JSON.parse(fs.readFileSync(path.join(work,'candidate.json'),'utf8'));
const raw=JSON.parse(fs.readFileSync(path.join(root,'docs/shaosong-map-integration-20260917/input-r6-map/shaosong-r6.map-only.json'),'utf8'));
const ctx={console,setTimeout,clearTimeout};ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'web/tm-map-realm-layout.js'),'utf8'),ctx);
const api=ctx.TMMapRealmLayout,groups=api.administrativeGroups(sc.map,sc.map.regions.map(r=>r.currentOwner));
assert.equal(groups.length,566);assert.equal(new Set(groups.map(x=>x.key)).size,101);assert.equal(new Set(groups.map(x=>x.group)).size,104);
assert.equal(new Set(groups.map(x=>x.owner)).size,35);
for(let i=0;i<raw.regions.length;i++){const a=raw.regions[i],b=sc.map.regions[i];assert.equal(a.id,b.id);for(const k of ['geometry','path','points','coords','parentId','circuitId','neighbors'])assert.deepEqual(b[k],a[k],a.id+' '+k);}
const modes={};for(const tier of ['realm','region','prefecture']){const rows=groups.map(x=>({...x,group:tier==='prefecture'?x.region.id:x.group}));const mesh=api.boundaryMesh(rows,tier);modes[tier]={...mesh};delete modes[tier].majorPath;delete modes[tier].minorPath;}
const owners=sc.map.regions.map(r=>r.currentOwner);owners[0]='fac_jin';const moved=api.administrativeGroups(sc.map,owners);assert.notEqual(moved[0].group,groups[0].group);assert.equal(moved[1].group,groups[1].group);
const result={passed:8,failed:0,logicalCells:566,provinceNames:101,initialControlSegments:104,realms:35,geometryPreserved:true,ownerSplitVerified:true,modes};
fs.writeFileSync(path.join(work,'tier-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:8,failed:0,logicalCells:566,provinceNames:101,initialControlSegments:104,realms:35},null,2));
