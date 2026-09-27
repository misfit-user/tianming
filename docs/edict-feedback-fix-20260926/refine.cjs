'use strict';
const {edit,replace:R}=require('./edit.cjs');
edit('web/tm-corruption-engine.js',s=>{
 const a=s.indexOf('  function applyEdictDelta('),b=s.indexOf('  function syncIndexFromSubDepts(',a);if(a<0||b<a)throw Error('corruption method');
 return s.slice(0,a)+`  function applyEdictDelta(delta, reason) {
    if (typeof delta !== 'number' || !isFinite(delta)) return { ok:false, reason:'invalid-delta' };
    ensureCorruptionModel();
    var c=GM.corruption, before=c.trueIndex, amount=clamp(delta,-10,10), declared=isDeclaredLedger();
    if(declared)syncIndexFromSubDepts('',{record:false,preserveTrend:true});
    Object.keys(c.subDepts||{}).forEach(function(key){var d=c.subDepts[key];if(d&&typeof d.true==='number')d.true=clamp(d.true+amount,0,100);});
    if(declared)syncIndexFromSubDepts(reason||'诏令整饬吏治');
    else {
      // Legacy scenarios use the bridge's byDept account and real regional leaves.
      Object.keys(c.byDept||{}).forEach(function(key){var d=c.byDept[key];if(typeof d==='number')c.byDept[key]=clamp(d+amount,0,100);else if(d&&typeof d.true==='number')d.true=clamp(d.true+amount,0,100);});
      var bridge=global.IntegrationBridge;
      if(bridge&&bridge.getLeafDivisions){bridge.getLeafDivisions(GM.adminHierarchy,'player').forEach(function(div){var n=typeof div.corruption==='number'?div.corruption:div.corruptionLocal;if(typeof n==='number'){div.corruption=clamp(n+amount,0,100);div.corruptionLocal=div.corruption;}});bridge.aggregateRegionsToVariables({strict:true});}
      else syncIndexFromSubDepts(reason||'诏令整饬吏治');
      _recordCorruptionIndexChange(before,c.trueIndex,reason||'诏令整饬吏治');
    }
    return {ok:true,old:before,new:c.trueIndex,delta:c.trueIndex-before};
  }

`.replace(/\n/g,'\r\n')+s.slice(b);
});
edit('web/tm-endturn-agent-write-tools.js',s=>{
 s=R(s,"      if (op === 'push') res = PU.applyPathPush(gm, path, payload);\n      else if (op === 'adjust') res = PU.applyPathDelta(gm, path, payload, reason);\n      else res = PU.applyPathSet(gm, path, payload, reason);",`      if (op !== 'push' && TM.EdictEffects) res=TM.EdictEffects.applyNumeric(gm,path,payload,op==='adjust'?'delta':'set',reason);
      if (!res && op === 'push') res = PU.applyPathPush(gm, path, payload);
      else if (!res && op === 'adjust') res = PU.applyPathDelta(gm, path, payload, reason);
      else if (!res) res = PU.applyPathSet(gm, path, payload, reason);`);return s;
});
