'use strict';
const {edit,replace:R}=require('./edit.cjs');
edit('web/index.html',s=>R(s,'<script src="tm-edict-efficacy.js"></script>','<script src="tm-edict-efficacy.js"></script>\n<script src="tm-edict-outcomes.js?v=20260926-edict-feedback"></script>\n<script src="tm-edict-effects.js?v=20260926-edict-feedback"></script>'));
edit('web/tm-endturn-prep.js',s=>R(s,"  if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({turn:GM.turn,time:getTSText(GM.turn),edicts:edicts,xinglu:xinglu,memorials:memRes,edictsSource:_edictsSource});","  if (typeof TM !== 'undefined' && TM.EdictOutcomes) TM.EdictOutcomes.collect(GM, edicts, GM.turn);\n  if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({turn:GM.turn,time:getTSText(GM.turn),edicts:edicts,xinglu:xinglu,memorials:memRes,edictsSource:_edictsSource});"));
edit('web/tm-endturn-prompt.js',s=>R(s,'    if(xinglu){',"    if (TM.EdictOutcomes) tp += TM.EdictOutcomes.inputPrompt(GM, edicts, GM.turn);\n    if(xinglu){"));
edit('web/tm-endturn-apply.js',s=>{
 s=R(s,'      if(p1){',"      if(p1){\n        if (TM.EdictEffects) TM.EdictEffects.begin(GM, P, ctx, p1);");
 const a=s.indexOf('        if(p1.resource_changes){'),b=s.indexOf('        if(p1.relation_changes)',a);if(a<0||b<a)throw Error('resource block');
 s=s.slice(0,a)+"        if (TM.EdictEffects) TM.EdictEffects.applyAuxiliary(GM, ctx);\r\n"+s.slice(a,b).replace('if(p1.resource_changes){','if(!TM.EdictEffects && p1.resource_changes){')+s.slice(b);
 s=R(s,'            if (pc.influence_delta) {','            if (TM.EdictEffects && pc.cohesion_delta) TM.EdictEffects.partyNumeric(GM, party, \'cohesion\', Number(pc.cohesion_delta), pc.reason || \'诏令推演\');\n            if (TM.EdictEffects && pc.influence_delta) TM.EdictEffects.partyNumeric(GM, party, \'influence\', Number(pc.influence_delta), pc.reason || \'诏令推演\');\n            if (!TM.EdictEffects && pc.influence_delta) {');
 s=R(s,"if (u.currentEffects && typeof u.currentEffects === 'object') {","if (!u._effectsRouted && u.currentEffects && typeof u.currentEffects === 'object') {");
 s=R(s,"if (u.classesAffected && typeof u.classesAffected === 'object' && GM.classes) {","if (!u._effectsRouted && u.classesAffected && typeof u.classesAffected === 'object' && GM.classes) {");
 s=R(s,"if (infDelta) pObj.influence =", "if (!u._effectsRouted && infDelta) pObj.influence =");
 const start=s.indexOf('        // 1.1: 处理诏令执行反馈'),end=s.indexOf('      }else{',start);if(start<0||end<start)throw Error('feedback block');
 s=s.slice(0,start)+`        // Same-turn execution receipts are derived after all domain writers finish.
        if (TM.EdictOutcomes) {
          var _edictEffects = TM.EdictEffects ? TM.EdictEffects.finish(GM, ctx, p1) : [];
          ctx.record.edictReports = TM.EdictOutcomes.receive(GM, p1, ctx.input.edicts || {}, GM.turn, _edictEffects);
        }
`.replace(/\n/g,'\r\n')+s.slice(end);return s;
});
edit('web/tm-ai-change-pathutils.js',s=>{
 s=R(s,'  function _applyPathDelta(obj, path, delta, reason) {',`  function _applyPathDelta(obj, path, delta, reason) {
    var edictRoute = global.TM && TM.EdictEffects && TM.EdictEffects.route(obj, path, delta, 'delta', reason);
    if (edictRoute) return edictRoute;`);
 return R(s,'  function _applyPathSet(obj, path, value, reason) {',`  function _applyPathSet(obj, path, value, reason) {
    var edictRoute = global.TM && TM.EdictEffects && TM.EdictEffects.route(obj, path, value, 'set', reason);
    if (edictRoute) return edictRoute;`);
});
edit('web/tm-corruption-engine.js',s=>{
 s=R(s,'  function syncIndexFromSubDepts(reason, opts) {',`  // AI edicts change departmental causes; the index is recomputed from those same causes.
  function applyEdictDelta(delta, reason) {
    if (typeof delta !== 'number' || !isFinite(delta)) return { ok:false, reason:'invalid-delta' };
    syncIndexFromSubDepts('', { record:false, preserveTrend:true });
    var c = GM.corruption, before = c.trueIndex, amount = clamp(delta, -10, 10);
    Object.keys(c.subDepts || {}).forEach(function(key) {
      var d = c.subDepts[key]; if (d && typeof d.true === 'number') d.true = clamp(d.true + amount, 0, 100);
    });
    syncIndexFromSubDepts(reason || '诏令整饬吏治');
    return { ok:true, old:before, new:c.trueIndex, delta:c.trueIndex-before };
  }

  function syncIndexFromSubDepts(reason, opts) {`);
 return R(s,'    syncIndexFromSubDepts: syncIndexFromSubDepts,','    syncIndexFromSubDepts: syncIndexFromSubDepts,\n    applyEdictDelta: applyEdictDelta,');
});
edit('web/tm-endturn-ai.js',s=>{
 s=R(s,'      var _sc1dP = (async function() {','      var _runSc1d = async function() {');
 const start=s.indexOf('      var _runSc1d ='),end=s.indexOf('//',s.indexOf('} catch(_sc1dErr)',start));
 const close=s.indexOf('})();',s.indexOf('} catch(_sc1dErr)',start));if(close<0)throw Error('SC1d end');s=s.slice(0,close)+'};'+s.slice(close+5);
 s=R(s,'await Promise.all([_sc1bP, _sc1cP, _sc1dP])','await Promise.all([_sc1bP, _sc1cP])');
 s=R(s,"        var tp1d = '【实录·时政记专项】\\n';",`        var tp1d = '【实录·时政记专项】\\n';
        if (TM.EdictOutcomes) tp1d += TM.EdictOutcomes.narrativeFacts(GM, GM.turn);`);
 const line=s.split(/\r?\n/).find(l=>l.includes("tp1d += '{\"shilu_text\""));if(!line)throw Error('SC1d schema');
 s=R(s,line,`        var _recordSpec1d = TM.Endturn.AI.prompt.recordSpecs(ctx);
        tp1d += JSON.stringify({shilu_text:_recordSpec1d.shilu, szj_title:_recordSpec1d.szjTitle, shizhengji:_recordSpec1d.shizhengji, szj_summary:_recordSpec1d.szjSummary});`);
 s=R(s,"        tp1d += 'SC1结构化账本：' + _packSc1d(_facts1d, 12000) + '\\n\\n';","        tp1d += 'SC1行动与奏报（数值以实际执行回执为准）：' + _packSc1d(_facts1d, 12000) + '\\n\\n';");
 const guard=s.split(/\r?\n/).find(l=>l.includes("var incomplete = new Error('主推演未形成完整结构化结果"));if(!guard)throw Error('main result guard');
 s=R(s,guard,guard+`
       if (TM.EdictOutcomes) {
         var _edictCoverage = TM.EdictOutcomes.coverage(GM, edicts, p1, GM.turn);
         if (_edictCoverage.missing.length) {
           try {
             var _edictRepair = await _callEndturnAI({model:P.ai.model||'gpt-4o',messages:[{role:'system',content:_maybeCacheSys(sysPFor('sc1'))},{role:'user',content:TM.EdictOutcomes.inputPrompt(GM, edicts, GM.turn)+'\\n补齐以下遗漏诏令的判定：'+JSON.stringify(_edictCoverage.missing.map(function(t){return {edictId:t.id,content:t.content};}))+'\\n已有主推演：'+JSON.stringify(p1)+'\\n仅返回遗漏诏令的 edict_feedback 和必须补充的结构化操作。新增操作须带对应 edictId；effectRefs 只引用本次补充的操作。已有变化不得重复输出。缺少执行条件则报告原因。'}],max_tokens:_tok(4000),temperature:0.3},{id:'sc1_edicts',label:'诏令回报补正',expectedKeys:['edict_feedback'],priority:'high',maxRetries:0,repairMaxRetries:0});
             if (_edictRepair && _edictRepair.parse && _edictRepair.parse.parsed) TM.EdictOutcomes.mergeSupplement(p1,_edictRepair.parse.parsed,_edictCoverage.missing.map(function(t){return t.id;}));
           } catch (_edictRepairError) { ctx.meta.warnings.push('部分诏令回报待补正'); }
         }
       }`);
 s=R(s,'      }); // end Sub-call 1 _runSubcall',`      p1 = ctx.results.sc1 || p1;
      await _runSc1d();
      ['shizhengji','zhengwen'].forEach(function(k){if(p1[k])ctx.record[k]=p1[k];});
      ctx.record.shiluText=p1.shilu_text||ctx.record.shiluText;
      ctx.record.szjTitle=p1.szj_title||ctx.record.szjTitle;
      ctx.record.szjSummary=p1.szj_summary||ctx.record.szjSummary;
      }); // end Sub-call 1 _runSubcall`);
 return s;
});
edit('web/tm-endturn-followup.js',s=>R(s,"        var _ps = '';", "        var _ps = TM.EdictOutcomes ? TM.EdictOutcomes.narrativeFacts(GM, GM.turn) : '';"));
edit('web/tm-endturn-validity.js',s=>R(s,'    var warnings = [];',`    var warnings = [];
    if (global.TM && TM.EdictOutcomes && global.GM) {
      var edictCoverage = TM.EdictOutcomes.coverage(GM,ctx.input && ctx.input.edicts || {},sc1 || {},ctx.input && ctx.input.resolutionTurn || (ctx.meta && ctx.meta.transaction && ctx.meta.transaction.turn) || GM.turn);
      if (edictCoverage.missing.length) warnings.push(edictCoverage.missing.length+' 道诏令尚缺执行回报，待补正');
      if (edictCoverage.unmatched.length) warnings.push(edictCoverage.unmatched.length+' 条诏令回报未能精确对应，待核');
    }`));
edit('web/tm-endturn-render.js',s=>{
 s=R(s,'        shizhengji: shizhengji,',`        turn: GM.turn-1,
        edictReports: TM.EdictOutcomes ? TM.EdictOutcomes.forTurn(GM,GM.turn-1) : [],
        shizhengji: shizhengji,`);
 s=R(s,'    edicts: _thisTurnEdicts,  // 保留玩家诏令全文以便史记回顾+下回合 AI 上下文',`    edictReports: TM.EdictOutcomes ? TM.EdictOutcomes.forTurn(GM,GM.turn-1) : [],
    edictAudit: GM._edictEfficacyReport && GM._edictEfficacyReport.turn===GM.turn-1 ? deepClone(GM._edictEfficacyReport) : null,
    edicts: _thisTurnEdicts,  // 保留玩家诏令全文以便史记回顾+下回合 AI 上下文`);return s;
});
edit('web/tm-endturn-shiji-compose.js',s=>{
 s=R(s,'  function _sjcEfficacy() {','  function _sjcEfficacy(report, turn) {');
 s=R(s,'      var ef = GM._edictEfficacyReport;',"      var ef = report || GM._edictEfficacyReport;\n      if (ef && ef.turn !== (turn == null ? GM.turn-1 : turn)) return '';");
 s=R(s,"    var auditHtml = _sjcEfficacy() + _sjcTinyiReview();",`    var edictTurn = o.turn == null ? GM.turn-1 : o.turn;
    var edictReports = o.edictReports || (global.TM && TM.EdictOutcomes ? TM.EdictOutcomes.forTurn(GM,edictTurn) : []);
    var auditHtml = (global.TM && TM.EdictOutcomes ? TM.EdictOutcomes.feedbackHtml(edictReports,edictTurn) : '') + '<div data-edict-audit-turn="'+edictTurn+'"><!--edict-audit:'+edictTurn+':start-->' + _sjcEfficacy(o.edictAudit,edictTurn) + '<!--edict-audit:'+edictTurn+':end--></div>' + _sjcTinyiReview();`);
 s=R(s,'    var ef = GM._edictEfficacyReport;', '    var ef = o.edictAudit || GM._edictEfficacyReport;\n    if (ef && ef.turn !== edictTurn) ef = null;');
 s=R(s,'    var efN = (ef && !ef.skipped && Array.isArray(ef.reports)) ? ef.reports.length : 0;', '    var efN = edictReports.length || ((ef && !ef.skipped && Array.isArray(ef.reports)) ? ef.reports.length : 0);');
 return R(s,'  global._composeShijiHtml = _composeShijiHtml;','  global._composeShijiHtml = _composeShijiHtml;\n  global._renderEdictAudit = _sjcEfficacy;');
});
edit('web/tm-endturn-ai-helpers.js',s=>{
 s=R(s,'async function aiEdictEfficacyAudit(aiResult, edicts) {',`async function aiEdictEfficacyAudit(aiResult, edicts) {
  var _auditG = GM, _auditTurn = GM.turn-1;
  var _auditLease = window.TM && TM.EdictOutcomes ? TM.EdictOutcomes.auditLease(GM,_auditTurn) : null;`);
 const start=s.indexOf('async function aiEdictEfficacyAudit'),tail=s.slice(start);let part=tail;
 part=R(part,'    GM._edictEfficacyReport = {\n      turn: GM.turn - 1,\n      total: edictLines.length,\n      reports:',`    if (GM !== _auditG || (_auditLease && !TM.EdictOutcomes.leaseCurrent(_auditLease))) return;
    var _edictAuditReport = {
      turn: _auditTurn,
      total: edictLines.length,
      reports:`);
 const a=part.indexOf('    var _edictAuditReport =');part=part.slice(0,a)+part.slice(a).replace(/GM\._edictEfficacyReport/g,'_edictAuditReport').replace(/turn: GM.turn - 1/g,'turn: _auditTurn');
 const anchor="      .slice(0, 5);";
 part=R(part,anchor,anchor+`\n    if (_auditLease) TM.EdictOutcomes.publishAudit(_auditLease,_edictAuditReport);\n    else GM._edictEfficacyReport = _edictAuditReport;`);
 s=s.slice(0,start)+part;return s;
});
edit('web/tm-endturn-agent-mode.js',s=>{
 s=R(s,'    try {\n      var inp = (ctx && ctx.input) || {};',`    try {
      if (TM.EdictOutcomes) return TM.EdictOutcomes.collect(gm,ctx && ctx.input && ctx.input.edicts || {},resolutionTurn).length;
      var inp = (ctx && ctx.input) || {};`);
 s=R(s,'    var _edictDossier = \'\';',`    _registerPlayerEdicts(gm, ctx, resolutionTurn);
    var _edictDossier = TM.EdictOutcomes ? TM.EdictOutcomes.inputPrompt(gm,ctx.input.edicts || {},resolutionTurn) : '';`);
 s=R(s,"_edictDossier = _activeEdictsDossier(gm) || '';", "_edictDossier += _activeEdictsDossier(gm) || '';");return s;
});
