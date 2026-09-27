'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
const generated={shizhengji:'本期朝政原文。',zhengwen:'主推演政文。',shilu_text:'是月，诏赈灾民，令有司核实支出。',szj_title:'开仓赈民安里社，按籍核帑肃官箴',szj_summary:'赈济与核账并行。',turn_summary:'颁行赈济诏令。',player_status:'君上正在听政。',player_inner:'愿民少受困苦。',personnel_changes:[{name:'甲臣',change:'授任'}]};
const mapping={shizhengji:'shizhengji',shiluText:'shilu_text',szjTitle:'szj_title',szjSummary:'szj_summary',turnSummary:'turn_summary',playerStatus:'player_status',playerInner:'player_inner'};
function fixture(){
 const c={console:{log(){},warn(){}},GM:{turn:4,shijiHistory:[]},P:{ai:{key:'fixture'},conf:{}},TM:{},getTimeRatio:()=>1,showLoading(){}};
 c.window=c;c.globalThis=c;vm.createContext(c);
 for(const name of ['tm-ai-result-contract.js','tm-endturn-validity.js','tm-endturn-record.js','tm-endturn-ai-infer.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,name),'utf8'),c,{filename:name});
 return c;
}
let checks=0;function equal(a,b,label){assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),label);checks++;}
(async()=>{
 for(const lateFailure of [false,true]){
  const c=fixture(),ai=c.TM.Endturn.AI,external={input:{},meta:{}};
  ai.prompt={build:async()=>{}};ai.subcalls={setupInfra(){},async runMain(ctx,after){ctx.results.sc1=structuredClone(generated);ctx.results.sc1d={...structuredClone(generated),basis_refs:['edict:relief']};await after();}};
  ai.apply={writeBack:async()=>{throw Object.assign(Error('unknown optional policy'),{mainWriteback:true});}};
  ai.followup={run:async ctx=>{ctx.record.hourenXishuo='后人戏说原文。';ctx.record.zhengwen='后续成文。';ctx.record.suggestions=['宜核销赈款'];if(lateFailure)throw Error('optional followup failure');}};
  const out=await c._endTurn_aiInfer({},[],[],{},external);
  for(const [record,raw]of Object.entries(mapping))equal(out[record],generated[raw],record+' survives real inference '+lateFailure);
  equal(out.hourenXishuo,'后人戏说原文。','late supplementary output survives');equal(out.zhengwen,'后续成文。','latest prose survives');
  equal(out.personnelChanges,generated.personnel_changes,'personnel payload survives');equal(out.suggestions,['宜核销赈款'],'suggestions survive');
  equal(out.basis_refs,['edict:relief'],'original lineage survives finalize');
  equal(external.record.szjTitle,out.szjTitle,'pipeline receives title');equal(external.record.shiluText,out.shiluText,'pipeline receives annals');
  external.results.aiResult=out;const args=c.TM.Endturn.Validity.renderArgs(external);equal(args[12],out.shiluText,'render positional annals');equal(args[13],out.szjTitle,'render positional title');
  equal(args[17].basis_refs,out.basis_refs,'render keeps evidence lineage');
  c.GM.turn=5;c.TM.Endturn.Validity.minimalPresentation(external);
  const saved=JSON.parse(JSON.stringify(c.GM)).shijiHistory[0];
  for(const [history,record]of Object.entries({shilu:'shiluText',szjTitle:'szjTitle',szjSummary:'szjSummary',turnSummary:'turnSummary',playerStatus:'playerStatus',playerInner:'playerInner',houren:'hourenXishuo'}))equal(saved[history],out[record],history+' survives fallback history serialization');
  equal(saved.personnel,out.personnelChanges,'history personnel');equal(saved.suggestions,out.suggestions,'history suggestions');equal(saved.basis_refs,out.basis_refs,'history lineage');
  assert(saved.html.includes(out.shiluText)&&saved.html.includes(out.szjTitle)&&saved.html.includes(out.hourenXishuo));checks++;
  c.TM.Endturn.Validity.minimalPresentation(external);equal(c.GM.shijiHistory.length,1,'fallback does not duplicate history');
 }
 {
  const c=fixture(),ctx={results:{sc1:{shizhengji:generated.shizhengji},sc1d:{shilu_text:{paragraphs:['原实录甲','原实录乙']},szj_title:'史官原题'},aiResult:{shizhengji:generated.shizhengji,shiluText:'',szjTitle:''}},record:{},input:{}};
  c.TM.Endturn.Validity.preserveNarrative(ctx);equal(ctx.record.shiluText,'原实录甲\n原实录乙','safe structured source text is preserved');equal(ctx.record.szjTitle,'史官原题','SC1d remains independently recoverable');
  ctx.results.aiResult.shiluText='已有修订实录';c.TM.Endturn.Validity.preserveNarrative(ctx);equal(ctx.record.shiluText,'已有修订实录','finalized text takes priority');
  ctx.results.sc2={houren_xishuo:'已完成后人戏说，尚未组装',suggestions:['核实']};c.TM.Endturn.Validity.preserveNarrative(ctx);equal(ctx.record.hourenXishuo,ctx.results.sc2.houren_xishuo,'SC2 output survives pre-assembly failure');equal(ctx.record.suggestions,['核实'],'SC2 suggestions survive pre-assembly failure');
 }
 console.log('[smoke-endturn-narrative-preservation] PASS '+checks+' assertions');
})().catch(e=>{console.error(e);process.exitCode=1;});
