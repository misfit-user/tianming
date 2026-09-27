'use strict';const {edit,replace:R}=require('./edit.cjs');
edit('web/tm-edict-oversight.js',s=>{
 s=R(s,'  function applyOversight(GM, active, parsed) {','  function applyOversight(GM, active, parsed, options) {');
 s=R(s,'    if (!GM || !parsed) return { applied: false };\n    var turn = GM.turn || 0;', '    if (!GM || !parsed) return { applied: false };\n    var turn = options && options.resolutionTurn != null ? options.resolutionTurn : GM.turn || 0;');
 s=R(s,'      // 更新跨回合生命周期(真评估·替时间猜)',"      // Preserve the primary settlement receipt; oversight is a supplementary assessment.\n      if (!(TM.EdictOutcomes && Array.isArray(entry.outcomes) && entry.outcomes.some(function(x){return x.turn===turn;}))) {\n      // 更新跨回合生命周期(真评估·替时间猜)");
 s=R(s,"      if (r.sabotageBy && (r.status === 'stalled' || r.status === 'sabotaged')) sabotaged++;", "      }\n      if (r.sabotageBy && (r.status === 'stalled' || r.status === 'sabotaged')) sabotaged++;");
 s=R(s,'    GM._edictEfficacyReport = rep;',"    if (TM.EdictOutcomes && global.GM===GM) TM.EdictOutcomes.publishAudit(TM.EdictOutcomes.auditLease(GM,turn),rep);\n    else GM._edictEfficacyReport = rep;");
 s=R(s,'    var res = applyOversight(GM, active, parsed);','    var res = applyOversight(GM, active, parsed, opts);');
 return s;
});
edit('web/tm-endturn-pipeline-steps.js',s=>{
 s=R(s,"            var _runEdictAudit = function(){", "            var _edictResolutionTurn = _gmEO ? _gmEO.turn-1 : 0;\n            var _runEdictAudit = function(){");
 return R(s,'window.TM.EdictOversight.run(_gmEO);','window.TM.EdictOversight.run(_gmEO,{resolutionTurn:_edictResolutionTurn});');
});
