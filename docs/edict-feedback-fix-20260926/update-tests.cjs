'use strict';
const {edit,replace:R}=require('./edit.cjs');
edit('web/scripts/smoke-agent-mode-s8.js',s=>{s=R(s,"const explicitNewTools=['form_party','emerge_class','create_office'];","const explicitNewTools=['form_party','emerge_class','create_office','report_edict'];");return R(s,"actualTools.length===20&&new Set(actualTools).size===20",'actualTools.length===21&&new Set(actualTools).size===21').replace('当前3个正式创建工具','当前3个正式创建工具与诏令回报工具');});
edit('web/scripts/smoke-endturn-narrative.js',s=>R(s,"  assert(src.indexOf(token) >= 0, 'szj 体例·\"' + token + '\"');","  assert((src + fs.readFileSync(path.join(ROOT, 'tm-endturn-record-specs.js'), 'utf8')).indexOf(token) >= 0, 'szj 体例·\"' + token + '\"');"));
edit('web/scripts/verify-all.js',s=>R(s,"  { name: 'edict-efficacy', file: 'smoke-edict-efficacy.js', estSec: 3, expectExit: 0 },",`  { name: 'edict-efficacy', file: 'smoke-edict-efficacy.js', estSec: 3, expectExit: 0 },
  { name: 'edict-outcomes', file: 'smoke-edict-outcomes.js', estSec: 2, expectExit: 0 },
  { name: 'edict-data-writeback', file: 'smoke-edict-data-writeback.js', estSec: 50, expectExit: 0 },
  { name: 'edict-narrative-link', file: 'smoke-edict-narrative-link.js', estSec: 2, expectExit: 0 },`));
edit('web/tm-endturn-apply-stages.js',s=>R(s,'  ns.stages._applyPostValidateAssemble = function(ctx, _st) {',`  ns.stages.refreshNarrative = function(ctx,p1) {
    ['shizhengji','zhengwen'].forEach(function(k){if(p1[k])ctx.record[k]=p1[k];});
    ctx.record.shiluText=p1.shilu_text||ctx.record.shiluText;
    ctx.record.szjTitle=p1.szj_title||ctx.record.szjTitle;
    ctx.record.szjSummary=p1.szj_summary||ctx.record.szjSummary;
    var latest=(GM._recentNarrative||[]).find(function(r){return r.turn===GM.turn;});
    if(latest){latest.shizhengji=String(ctx.record.shizhengji||'').slice(0,2600);latest.shilu=String(ctx.record.shiluText||'').slice(0,1300);latest.summary=String(ctx.record.szjSummary||'').slice(0,200);}
  };

  ns.stages._applyPostValidateAssemble = function(ctx, _st) {`));
edit('web/tm-endturn-ai.js',s=>R(s,'      ctx.record.szjSummary=p1.szj_summary||ctx.record.szjSummary;','      ctx.record.szjSummary=p1.szj_summary||ctx.record.szjSummary;\n      if (TM.Endturn.AI.apply.stages.refreshNarrative) TM.Endturn.AI.apply.stages.refreshNarrative(ctx,p1);'));
