'use strict';const {edit,replace:R}=require('./edit.cjs');
edit('web/tm-ai-change-pathutils.js',s=>R(s,'      if (result && result.ok) {\n        count++;',"      if (global.TM && TM.EdictEffects) TM.EdictEffects.recordApplied(obj,ch,result);\n      if (result && result.ok) {\n        count++;"));
edit('web/modules/ai-change-applier/core.js',s=>{
 s=R(s,'        entry.executionStatus = executionStatus;',`        entry.executionStatus = executionStatus;
        if (global.TM && TM.EdictEffects) TM.EdictEffects.recordApplied(G,fa,{ok:true,old:typeof cur==='number'?cur:undefined,new:immediateTarget?_readFiscalStock(fiscalStockTarget||immediateTarget,resource):undefined,shortfall:shortfall,executionStatus:executionStatus},fa.target+'.'+resource);`);
 return R(s,'      if (result && result.ok) {\n        anyPathCount++;', '      if (global.TM && TM.EdictEffects) TM.EdictEffects.recordApplied(G,apc,result);\n      if (result && result.ok) {\n        anyPathCount++;');
});
edit('web/tm-endturn-apply.js',s=>{
 s=R(s,"TM.EdictEffects.partyNumeric(GM, party, 'cohesion', Number(pc.cohesion_delta), pc.reason || '诏令推演');","TM.EdictEffects.partyNumeric(GM, party, 'cohesion', Number(pc.cohesion_delta), pc.reason || '诏令推演', pc);");
 s=R(s,"TM.EdictEffects.partyNumeric(GM, party, 'influence', Number(pc.influence_delta), pc.reason || '诏令推演');","TM.EdictEffects.partyNumeric(GM, party, 'influence', Number(pc.influence_delta), pc.reason || '诏令推演', pc);");
 return R(s,'            if (_classWrite && _classWrite.ok) {',`            if (_classWrite && _classWrite.ok) {
              if (TM.EdictEffects) ['satisfaction','influence'].forEach(function(k){TM.EdictEffects.recordApplied(GM,cc,{ok:true,old:_classWrite.before[k],new:_classWrite.after[k]},'classes.'+(cls.id||cls.name)+'.'+k);});`);
});
