#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),acorn=require('acorn');
const WEB=path.resolve(__dirname,'..');let checks=0;const ok=(v,m)=>{assert(v,m);checks++;};
const read=f=>fs.readFileSync(path.join(WEB,f),'utf8');
function find(ast,pred){let out;function walk(n){if(!n||typeof n!=='object'||out)return;if(pred(n)){out=n;return;}Object.keys(n).forEach(k=>{const v=n[k];if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);});}walk(ast);assert(out,'production AST entry');return out;}
function world(){
 const c={console,Math,Date,JSON,Object,Array,String,Number,WeakMap,Map,Set,Promise,parseInt,parseFloat,isFinite,TM:{},GM:{turn:4,_edictTracker:[],vars:{'堤工进度':{value:10,min:0,max:100}},chars:[],edicts:[],_turnReport:[],_subcallTimings:{},_turnAiResults:{}},P:{ai:{model:'offline'},conf:{},playerInfo:{}},showLoading(){},_dbg(){},_checkTruncated(){},getTSText:t=>'T'+t,_tok:x=>x,_effectiveOutCap:7000,_modelTemp:.6,_modelFamily:'openai',_shiluMin:150,_shiluMax:300,_szjMin:200,_szjMax:400,sysPFor:()=>'',_maybeCacheSys:x=>x,fetch(){throw Error('Network prohibited');}};
 c.window=c;c.globalThis=c;vm.createContext(c);['tm-edict-efficacy.js','tm-edict-outcomes.js','tm-edict-effects.js','tm-ai-change-pathutils.js','tm-endturn-record-specs.js','tm-endturn-apply-stages.js'].forEach(f=>vm.runInContext(read(f),c,{filename:f}));return c;
}
(async()=>{
 const c=world(),G=c.GM,O=c.TM.EdictOutcomes,E=c.TM.EdictEffects;
 c.edicts={political:'督修河堤，受阻须如实具报。'};const id=O.collect(G,c.edicts,4)[0].id;c.xinglu='';
 G.vars['堤工进度'].max=17;
 c.p1={turn_summary:'有司奉令督修。',resource_changes:{'堤工进度':100},edict_feedback:[{edictId:id,status:'partial',feedback:'首段完成，余段因雨停工。',effectRefs:['resource_changes.堤工进度']}]};
 c.ctx={input:{edicts:c.edicts},results:{sc1:c.p1},apply:{},record:{},meta:{warnings:[]}};
 G._recentNarrative=[{turn:4,shizhengji:'写回前的临时底稿'}];
 const source=read('tm-endturn-ai.js'),ast=acorn.parse(source,{ecmaVersion:'latest'}),decl=find(ast,n=>n.type==='VariableDeclarator'&&n.id&&n.id.name==='_runSc1d');
 const textHelper=find(ast,n=>n.type==='FunctionDeclaration'&&n.id&&n.id.name==='_sc1Txt');vm.runInContext(source.slice(textHelper.start,textHelper.end),c);
 vm.runInContext('var _runSc1d='+source.slice(decl.init.start,decl.init.end)+';',c);
 const events=[];let prompt='';c.afterSc1=async ctx=>{events.push('settlement');E.begin(G,c.P,ctx,c.p1);E.applyAuxiliary(G,ctx);O.receive(G,c.p1,c.edicts,4,E.finish(G,ctx,c.p1));};
 c._callEndturnAI=async body=>{events.push('narrative');prompt=body.messages[1].content;return {data:{},raw:'{}',parse:{parsed:{shilu_text:'上命督修河堤，首段告竣。',shizhengji:'【朝政】有司奉命督修，首段完成，余段因雨停工，俟晴续办。',szj_title:'首段堤工告竣',szj_summary:'堤工有进，风雨未息。'}}};};
 c._attachSc1RecordFallback=()=>{throw Error('unexpected narrative fallback');};
 const callback=find(ast,n=>n.type==='IfStatement'&&source.slice(n.test.start,n.test.end)==='typeof afterSc1 === "function"');
 const after=source.indexOf('      await _runSc1d();',callback.end);ok(after>callback.end,'actual source schedules narration after main writeback callback');
 const ending=source.indexOf('      }); // end Sub-call 1 _runSubcall',after);assert(ending>after);
 await vm.runInContext('(async()=>{'+source.slice(callback.start,callback.end)+source.slice(callback.end,ending)+'})()',c);
 ok(events.join(',')==='settlement,narrative','actual callback and actual SC1d run in settlement-first order');
 ok(G.vars['堤工进度'].value===17,'narration cannot apply another numeric change');
 ok(prompt.includes('"before":10')&&prompt.includes('"after":17'),'SC1d receives actual before and after values');
 ok(prompt.includes('首段完成，余段因雨停工'),'SC1d sees the actual execution process');
 ok(prompt.includes('以干支系日')&&prompt.includes('记事不评论'),'SC1d retains annals role');
 ok(prompt.includes('执行过程')&&prompt.includes('遗留隐患')&&prompt.includes('信息源'),'SC1d retains political process and sources');
 ok(prompt.includes('不向玩家直接揭露未知真相'),'narration preserves information asymmetry');
 ok(c.ctx.record.shiluText==='上命督修河堤，首段告竣。','final record receives post-settlement annals');
 ok(c.ctx.record.shizhengji.includes('俟晴续办'),'final record receives post-settlement political narrative');
 ok(G._recentNarrative[0].shizhengji===c.ctx.record.shizhengji,'next turn memory receives the same final narrative');
 const houren=c.TM.Endturn.AI.prompt.hourenSpec({});ok(houren.includes('完整生活进程')&&houren.includes('具体动作')&&houren.includes('对话')&&houren.includes('日常片段'),'posterity prose retains scenes and daily life');
 ok(read('tm-endturn-followup.js').includes('TM.EdictOutcomes.narrativeFacts(GM, GM.turn)'),'posterity facts receive same execution receipts');
 // Agent mode uses the same variable sink and associates its real tool receipts.
 const a=world(),A=a.TM.EdictOutcomes,aid=A.collect(a.GM,{political:'督修河堤。'},4)[0].id;
 vm.runInContext(read('tm-endturn-agent-write-tools.js'),a,{filename:'tm-endturn-agent-write-tools.js'});const WT=a.TM.Endturn.AgentWriteTools,ctx={GM:a.GM,input:{resolutionTurn:4}};
 const input={edictId:aid,effectId:'progress',path:'vars.堤工进度.value',delta:5,reason:'首段工程推进'};
 let r=WT.handleSync('adjust_field',input,ctx);ok(r.ok&&a.GM.vars['堤工进度'].value===15,'agent numeric tool applies actual custom variable');
 r=WT.handleSync('adjust_field',input,ctx);ok(r.ok&&!r.changed&&a.GM.vars['堤工进度'].value===15,'agent retry is idempotent');
 r=WT.handleSync('report_edict',{edictId:aid,status:'partial',feedback:'首段完工，余段续办。',assignee:'有司'},ctx);ok(r.ok&&!r.changed,'report tool records feedback without pretending to execute a new world effect');
 const row=A.forTurn(a.GM,4)[0];ok(row.effects[0].before===10&&row.effects[0].after===15,'agent feedback retains measured tool result');ok(row.feedback==='首段完工，余段续办。','agent execution reply is attached to correct edict');
 r=WT.handleSync('adjust_field',Object.assign({},input,{edictId:'missing'}),ctx);ok(!r.ok&&a.GM.vars['堤工进度'].value===15,'unknown agent edict cannot mutate state');
 console.log('[smoke-edict-narrative-link] PASS '+checks+' assertions');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
