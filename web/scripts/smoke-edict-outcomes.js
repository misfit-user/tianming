#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),acorn=require('acorn');
const WEB=path.resolve(__dirname,'..');let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},ok=(v,m)=>{assert(v,m);checks++;},clone=v=>JSON.parse(JSON.stringify(v));
function load(c,f){vm.runInContext(fs.readFileSync(path.join(WEB,f),'utf8'),c,{filename:f});}
function fixture(){
 const c={console:{log(){},warn(){},error(){}},Math,Date,JSON,Promise,Array,Number,Object,String,WeakMap,Map,Set,parseInt,parseFloat,isFinite,setTimeout(){},clearTimeout(){},escHtml:s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),P:{ai:{key:'offline'},conf:{},playerInfo:{}},GM:{turn:4,sid:'offline',vars:{'水利进度':{value:20,min:0,max:100,unit:'%'}},chars:[],facs:[],parties:[],classes:[],edicts:[],letters:[],_edictTracker:[],shijiHistory:[],_turnReport:[],turnChanges:{variables:[],characters:[],factions:[],parties:[],classes:[],military:[]}},TM:{},CORE_METRIC_LABELS:{},getTSText:t=>'T'+t,AccountingSystem:{getLedger:()=>({items:[]})},document:{querySelectorAll:()=>[]},fetch(){throw Error('Network prohibited');},_dbg(){},addEB(){}};
 c.window=c;c.globalThis=c;vm.createContext(c);
 for(const f of ['tm-edict-efficacy.js','tm-edict-outcomes.js','tm-edict-effects.js','tm-ai-change-pathutils.js','tm-endturn-validity.js','tm-endturn-shiji-compose.js'])load(c,f);
 return c;
}
function register(c,text='令有司核实堤工进度。'){const input={decree:text};c.GM.edicts=[{id:'published',turn:4,status:'promulgated',text}];c.TM.EdictOutcomes.collect(c.GM,input,4);return input;}
function report(c,input,extra={}){return {edict_feedback:[Object.assign({edictId:'published',status:'executing',feedback:'已派员查勘，俟下月复奏。',progressPercent:0},extra)]};}
function render(c,turn=4){return c._composeShijiHtml({turn,shiluText:'上命核查。',shizhengji:'【朝政】有司奉诏查勘。',oldVars:{},personnelChanges:[]});}
(async()=>{
 {
  const c=fixture(),i=register(c),O=c.TM.EdictOutcomes;
  eq(c.GM._edictTracker.length,1,'whole decree registered');eq(c.GM._edictTracker[0].id,'published','published id preserved');
  O.collect(c.GM,i,4);eq(c.GM._edictTracker.length,1,'retry registration does not duplicate');
  O.collect(c.GM,{political:'令有司核实堤工进度，禁止加派。'},4);eq(c.GM._edictTracker.length,2,'similar first ten characters remain distinct');
  eq(O.match(c.GM,{edictId:'wrong',content:i.decree},4),null,'wrong explicit ID never falls back by content');
  eq(O.match(c.GM,{content:i.decree},4).id,'published','exact unique legacy content still works');
  O.receive(c.GM,{edict_feedback:[{edictId:'wrong',feedback:'无关命令已完成',status:'completed'}]},i,4,[]);
  eq(c.GM._edictTracker[0].status,'pending','wrong feedback does not complete first pending');
  ok(O.forTurn(c.GM,4)[0].unmatched.length===1,'unmatched response preserved for review');
  for(const out of [{},{edict_feedback:[]},{edict_feedback:[{edictId:'wrong',feedback:'错误'}]}])eq(O.coverage(c.GM,i,out,4).missing.length,2,'missing coverage includes every active edict');
  const ctx={input:{edicts:i},results:{sc1:{turn_summary:'本月有司具报。',shizhengji:'本月有司奉诏查勘，并按例具报。'},aiResult:{shizhengji:'本月有司奉诏查勘，并按例具报。',zhengwen:'有司奉诏查勘。'}},meta:{transaction:{turn:4}},record:{}};
  const before=JSON.stringify(c.GM);const validity=O.coverage(c.GM,i,ctx.results.sc1,4);eq(JSON.stringify(c.GM),before,'coverage check is read only');ok(validity.missing.length,'coverage reports missing');
  ok(c.TM.Endturn.Validity.validateBeforeCommit(ctx).warnings.some(s=>s.includes('诏令')),'commit review exposes missing edict feedback');
  O.receive(c.GM,report(c,i),i,4,[]);eq(O.forTurn(c.GM,4)[0].progressPercent,0,'explicit zero progress preserved');ok(render(c).includes('已派员查勘'),'new executing feedback visible immediately');
  c.GM._edictEfficacyReport={turn:3,total:1,reports:[{content:'旧报告标记',status:'executed'}]};ok(!render(c).includes('旧报告标记'),'prior turn audit never leaks');
  c.GM.shijiHistory.push({turn:4,edictReports:clone(O.forTurn(c.GM,4)),html:render(c)});const saved=clone(c.GM);c.GM=saved;ok(c.GM.shijiHistory[0].html.includes('已派员查勘'),'serialized history retains current feedback');
 }
 {
  const c=fixture(),i=register(c),E=c.TM.EdictEffects,O=c.TM.EdictOutcomes,ctx={input:{edicts:i},apply:{}};
  let p=report(c,i,{effectRefs:['resource_changes.水利进度']});p.resource_changes={'水利进度':12};
  p.edict_lifecycle_update=[{edictId:'published',currentEffects:{'水利进度':12}}];
  E.begin(c.GM,c.P,ctx,p);E.applyAuxiliary(c.GM,ctx);const actual=E.finish(c.GM,ctx,p);O.receive(c.GM,p,i,4,actual);
  eq(c.GM.vars['水利进度'].value,32,'lifecycle and primary resource effect settles once');eq(actual.length,1,'one actual receipt');eq(actual[0].before,20,'actual before recorded');eq(actual[0].after,32,'actual after recorded');
  const again=report(c,i,{effectRefs:['resource_changes.水利进度']});again.resource_changes={'水利进度':12};E.begin(c.GM,c.P,ctx,again);E.applyAuxiliary(c.GM,ctx);E.finish(c.GM,ctx,again);eq(c.GM.vars['水利进度'].value,32,'same-turn retry does not apply twice');
  c.GM.turn=5;E.begin(c.GM,c.P,ctx,Object.assign(report(c,i),{resource_changes:{'水利进度':12}}));E.applyAuxiliary(c.GM,ctx);E.finish(c.GM,ctx,{});eq(c.GM.vars['水利进度'].value,44,'next turn can apply a new effect');
  const bounded=E.applyNumeric(c.GM,'水利进度',200,'delta','继续施工');eq(bounded.new,100,'scenario variable bound respected');eq(bounded.delta,56,'receipt uses actual bounded delta');
  eq(E.applyNumeric(c.GM,'vars.不存在.value',3,'delta','未知').ok,false,'unknown variable cannot become ghost data');
  c.GM.vars['水利进度'].derived=true;eq(E.applyNumeric(c.GM,'水利进度',-10,'delta','改变').ok,false,'derived variable requires underlying causes');
 }
 {
  const c=fixture(),i=register(c),E=c.TM.EdictEffects,ctx={input:{edicts:i},apply:{}};
  c.GM._edictTracker[0]._letterIds=['on-road'];c.GM.letters=[{id:'on-road',status:'traveling'}];
  const p=report(c,i,{status:'completed',effectRefs:['changes[0]']});p.changes=[{path:'vars.水利进度.value',delta:10,edictId:'published'}];
  E.begin(c.GM,c.P,ctx,p);eq(p.changes.length,0,'in-transit edict cannot execute numeric operation');E.applyAuxiliary(c.GM,ctx);c.TM.EdictOutcomes.receive(c.GM,p,i,4,E.finish(c.GM,ctx,p));
  eq(c.GM.vars['水利进度'].value,20,'undelivered order leaves state intact');eq(c.GM._edictTracker[0].status,'pending_delivery','in-transit status enforced');ok(render(c).includes('信使尚在途中'),'delivery blocker visible');
 }
 {
  const c=fixture(),O=c.TM.EdictOutcomes,base={changes:[{path:'x',delta:1}]};
  O.mergeSupplement(base,{changes:[{path:'y',delta:2,edictId:'missing'},{path:'z',delta:3,edictId:'other'}],edict_feedback:[{edictId:'missing',feedback:'已办理',effectRefs:['changes[0]']},{edictId:'other',feedback:'越界'}]},['missing']);
  eq(base.changes.length,2,'repair adds only missing edict operations');eq(base.edict_feedback.length,1,'repair scoped to missing ids');eq(base.edict_feedback[0].effectRefs[0],'changes[1]','supplement reference index rebased');
 }
 {
  const c=fixture(),i=register(c),O=c.TM.EdictOutcomes;O.receive(c.GM,report(c,i),i,4,[]);c.GM.turn=5;
  c.GM.shijiHistory=[{turn:4,html:render(c)}];const lease=O.auditLease(c.GM,4);
  c.GM.turn=6;c.GM._edictEfficacyReport={turn:5,reports:[{content:'第五回报告'}]};
  ok(O.publishAudit(lease,{total:1,reports:[{content:'第四回迟到回听',status:'partial'}],overallEfficacy:50}),'late same-world audit accepted');
  eq(c.GM._edictEfficacyReport.turn,5,'late audit cannot replace newer live report');ok(c.GM.shijiHistory[0].html.includes('第四回迟到回听'),'late audit patches matching historical HTML');ok(c.GM.shijiHistory[0].html.includes('已派员查勘'),'late audit preserves main execution feedback');
  const once=c.GM.shijiHistory[0].html;O.publishAudit(lease,{total:1,reports:[{content:'第四回迟到回听',status:'partial'}],overallEfficacy:50});eq(c.GM.shijiHistory[0].html,once,'duplicate audit does not duplicate HTML');
  c._tmLoadGen=1;eq(O.publishAudit(lease,{reports:[{content:'跨档污染'}]}),false,'loaded-world generation rejects stale audit');ok(!c.GM.shijiHistory[0].html.includes('跨档污染'),'stale result cannot enter archive');
 }
 // Exercise the actual asynchronous audit function, with a deferred offline response.
 {
  const c=fixture(),O=c.TM.EdictOutcomes,E=c.TM.EdictEffects,U=c.TM.AIChange.PathUtils;
  const input={political:'修堤第一段。',economic:'修堤第二段。'},orders=O.collect(c.GM,input,4),ctx={input:{edicts:input},results:{},apply:{}};
  const p={changes:[{path:'vars.水利进度.value',delta:2},{delta:3,path:'vars.水利进度.value'}],edict_feedback:orders.map((o,i)=>({edictId:o.id,status:'partial',feedback:'本段已有进展。',effectRefs:['changes['+i+']']}))};
  E.begin(c.GM,c.P,ctx,p);eq(p.changes.length,2,'different edicts keep their separate operations on the same field');U.applyDeclaredPathChanges(c.GM,p.changes,[],[]);const r=E.finish(c.GM,ctx,p);
  eq(r[0].before,20,'first operation owns its actual starting value');eq(r[0].after,22,'first operation receipt excludes the second effect');eq(r[1].before,22,'second operation starts after first');eq(r[1].after,25,'second operation owns its own result');ok(r.every(x=>x.perOperation&&!x.shared),'per-operation receipts are not whole-batch guesses');
  const retry={changes:[{delta:3,path:'vars.水利进度.value'},{delta:2,path:'vars.水利进度.value'}],edict_feedback:[{edictId:orders[1].id,feedback:'第二段',effectRefs:['changes[0]']},{edictId:orders[0].id,feedback:'第一段',effectRefs:['changes[1]']}]};E.begin(c.GM,c.P,ctx,retry);eq(retry.changes.length,0,'array and object key reordering does not defeat retry deduplication');E.finish(c.GM,ctx,retry);
 }
 {
  const c=fixture(),input=register(c),E=c.TM.EdictEffects,U=c.TM.AIChange.PathUtils;c.GM.vars['地方新指标']={value:10,min:0,max:50};
  const ctx={input:{edicts:input},results:{},apply:{}},p={changes:[{path:'vars.水利进度.value',delta:2,edictId:'published'},{path:'vars.地方新指标.value',delta:3,edictId:'published'}]};ctx.results.sc1=p;
  E.begin(c.GM,c.P,ctx,p);U.applyDeclaredPathChanges(c.GM,p.changes.slice(0,1),[],[]);const partial=E.fail(c.GM,ctx);
  eq(partial[0].status,'applied','partial failure preserves confirmed first write');eq(partial[1].status,'unverified','unexecuted second write is not called successful');eq(ctx.results.sc1.changes.length,2,'original intent retained for repair');
  E.begin(c.GM,c.P,ctx,ctx.results.sc1);U.applyDeclaredPathChanges(c.GM,ctx.results.sc1.changes,[],[]);E.finish(c.GM,ctx,ctx.results.sc1);eq(c.GM.vars['水利进度'].value,22,'repair does not repeat successful portion');eq(c.GM.vars['地方新指标'].value,13,'repair can still apply previously unexecuted portion');
 }
 {
  const c=fixture(),O=c.TM.EdictOutcomes,E=c.TM.EdictEffects,U=c.TM.AIChange.PathUtils,input={political:'甲段修堤。',economic:'乙段修堤。'},orders=O.collect(c.GM,input,4),ctx={input:{edicts:input},results:{},apply:{}};
  function apply(p){E.begin(c.GM,c.P,ctx,p);U.applyDeclaredPathChanges(c.GM,p.changes,[],[]);E.finish(c.GM,ctx,p);}
  apply({changes:[{path:'vars.水利进度.value',delta:2}],edict_feedback:[{edictId:orders[0].id,feedback:'甲段进展',effectRefs:['changes[0]']}]});
  const cached={changes:[{path:'vars.水利进度.value',delta:2},{path:'vars.水利进度.value',delta:3}],edict_feedback:[{edictId:orders[0].id,feedback:'甲段进展',effectRefs:['changes[0]']},{edictId:orders[1].id,feedback:'乙段进展',effectRefs:['changes[1]']}]};
  apply(cached);eq(c.GM.vars['水利进度'].value,25,'one replay and one new operation settles only new operation');eq(cached.changes.length,1,'already applied row removed from cached response');
  apply(cached);eq(c.GM.vars['水利进度'].value,25,'reusing the filtered response preserves original operation references');
 }
 {
  const c=fixture(),i=register(c),O=c.TM.EdictOutcomes;O.receive(c.GM,report(c,i),i,4,[]);c.GM.turn=5;c.GM.shijiHistory=[{turn:4,html:render(c)}];
  const source=fs.readFileSync(path.join(WEB,'tm-endturn-ai-helpers.js'),'utf8'),ast=acorn.parse(source,{ecmaVersion:'latest'}),node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='aiEdictEfficacyAudit');ok(node,'actual audit entry found');vm.runInContext(source.slice(node.start,node.end),c);
  let resolve;c.callAISmart=()=>new Promise(r=>resolve=r);const p=c.aiEdictEfficacyAudit({shizhengji:'有司奉命查勘。'},i);ok(resolve,'offline audit is in flight');c.GM.turn=6;
  resolve(JSON.stringify({reports:[{content:'真实异步回听',status:'partial'}],overallEfficacy:50}));await p;
  eq(c.GM._edictEfficacyReport.turn,4,'async function retains original resolution turn');ok(c.GM.shijiHistory[0].html.includes('真实异步回听'),'actual async completion updates original archived section');
  const followup=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='buildEdictEfficacyFollowUp');vm.runInContext(source.slice(followup.start,followup.end),c);ok(c.buildEdictEfficacyFollowUp().includes('上回合御批回听'),'next turn reads the committed report through its real helper');
 }
 console.log('[smoke-edict-outcomes] PASS '+checks+' assertions');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
