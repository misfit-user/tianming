'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),{createRequire}=require('module');
const {fixture,load,run}=require('./lib-emergency-recovery');
const {baseGM}=require('./lib-player-error-regression');
const tests=[],test=(name,fn)=>tests.push({name,fn});
const narrative='诏令已从内帑支银二百两赈济灾民。张甲奉诏赴任，沿途忧虑灾民。';
const okay={ok:true,applied:{failed:[],reviewRequired:[]}};
const checks={validators:'逐条核对了所有检验器提示',edict_execution:'核对原诏令及实际执行回执',state_consistency:'核对账目、人员与世界状态',uncovered:'检查了检验器之外的叙事遗漏'};
const empty=()=>({checks:{...checks},findings:[],operations:[],record:{},reason:'复核完成'});
const submit=p=>JSON.stringify({tools:[{name:'submit',input:p}]});
function request(prompt){return JSON.parse(prompt.slice(prompt.indexOf('\n')+1));}
function verified(prompt){const task=request(prompt);return JSON.stringify({tools:[{name:'finish_review',input:{approved:true,reason:'逐笔对照完整生成原文和真实读回，修改正确',outcomes:task.case.corrections.map(c=>({id:c.id,verdict:c.effect==='already_satisfied'?'already_satisfied':'correct',reason:'预期效果与实际前后值一致'}))}}]});}
function reply(prompt,plan){return request(prompt).case.phase==='verify'?verified(prompt):submit(plan);}
const operation=(tool,input)=>({tool,input,reason:'补齐本期事实与实际状态',evidence:[{source:'original',quote:narrative}],postconditions:tool==='set_field'?[{path:input.path,equals:input.value}]:tool==='adjust_treasury'?[{path:(input.account||'guoku')+'.'+(input.currency||'money'),delta:input.delta}]:tool==='retry_main'?[{path:'chars.张甲.loyalty',equals:55}]:[]});
const mood=value=>operation('set_field',{path:'chars.张甲.mood',value});
function ctx(){return {input:{edicts:{text:narrative}},meta:{requireTurnReview:true},record:{shizhengji:narrative,zhengwen:'本期实录正文'},results:{sc1:{shizhengji:narrative}}};}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function finishBackground(c,x,record){
 const txn=x.meta.transaction;txn.committed=true;c.GM._endTurnCommitPending=false;c.GM.busy=false;c.GM.turn++;
 c.GM.shijiHistory=[Object.assign({turn:c.GM.turn-1,html:'原纪事'},record||x.record)];let saves=0;c.requestBackgroundAutosave=async()=>{saves++;return {ok:true,scheduled:true};};
 c.TM.RecoveryReview.afterCommit(x);
 for(let i=0;i<100&&c.TM.RecoveryReview.status().length;i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(c.TM.RecoveryReview.status().length,0,'background review settles independently');return {row:c.GM.shijiHistory[0],saves};
}
function setup(settings={}){
 const f=fixture(settings),c=f.c;c.GM=baseGM({_campaignId:'a',_timelineId:'b',_endTurnCommitPending:true,chars:[{id:'a',name:'张甲',mood:'平静',loyalty:50,alive:true}]});
 for(const file of ['tm-ai-change-pathutils.js','tm-ai-change-army.js','tm-ai-change-narrative.js','generated/tm-ai-change-applier.bundle.js','tm-social-formation.js','tm-agent-world-editor.js','tm-endturn-agent-write-tools.js','tm-emergency-recovery-review.js'])load(c,file);
 return f;
}
async function review(f,plan,result=okay){const c=f.c,x=ctx();c.callAI=async prompt=>reply(prompt,plan);c.TM.RecoveryReview.start(result,x.results.sc1,x);return {receipt:await c.TM.RecoveryReview.join(x),ctx:x};}
test('mandatory review runs even with zero warnings and emergency mode off, in one model call',async()=>{const f=setup({mode:'off',maxTokens:48000});try{const {receipt}=await review(f,empty());assert.equal(receipt.calls,1);assert.equal(receipt.approved,true);assert.equal(receipt.changed,false);assert.equal(f.c.GM.turn,9);assert.equal(f.c.TM.RecoveryReview.status().length,0);}finally{f.dispose();}});

test('review can create a missing party through the same world editor and verify real persistence',async()=>{
 const f=setup(),c=f.c,x=ctx();try{
  const story='本期依照玩家天意正式成立经世党，推行经世济民之议。';x.results.sc1.shizhengji=story;x.record.shizhengji=story;c.GM.parties=[];
  const p=empty();p.operations=[{tool:'edit_world',input:{path:'parties',operation:'append',value:{name:'经世党',ideology:'经世济民'}},reason:'补齐原文已明确成立的新党派',evidence:[{source:'original',quote:story}],postconditions:[{path:'parties',contains:{name:'经世党'}}]}];
  c.callAI=async prompt=>reply(prompt,p);c.TM.RecoveryReview.start(okay,x.results.sc1,x);const receipt=await c.TM.RecoveryReview.join(x);
  assert(receipt.verified&&receipt.changed);assert.equal(c.GM.parties.length,1);assert.equal(JSON.parse(JSON.stringify(c.GM)).parties[0].name,'经世党');assert(receipt.actualWrites.some(g=>g.changes.some(w=>w.path.startsWith('parties'))));
 }finally{f.dispose();}
});

test('a full 93417-token review is not blocked by the old 48000-token emergency budget',async()=>{
 const f=setup({maxTokens:48000}),c=f.c,x=ctx();try{
  const story=narrative+'长篇原文。'.repeat(18000)+'原文末尾仍须送审。';x.record.shizhengji=story;x.results.sc1.shizhengji=story;
  c.estimateTokens=()=>93417-6144;let calls=0;
  c.callAI=async prompt=>{calls++;assert(request(prompt).case.sources.some(row=>row.text===story));return reply(prompt,empty());};
  c.TM.RecoveryReview.start(okay,x.results.sc1,x);const result=await c.TM.RecoveryReview.join(x);
  assert(result.approved&&result.sourceCoverage.complete);assert.equal(calls,1);assert.equal(c.P.conf.emergencyRecovery.maxTokens,48000);
 }finally{f.dispose();}
});

test('an explicit fixed-review token budget is enforced before any model call',async()=>{
 const f=setup({reviewMaxTokens:48000}),c=f.c;try{c.estimateTokens=()=>93417-6144;let calls=0;c.callAI=async()=>calls++;
  const x=ctx();c.TM.RecoveryReview.start(okay,x.results.sc1,x);await assert.rejects(c.TM.RecoveryReview.join(x),e=>e.code==='REVIEW_BUDGET'&&/93417/.test(e.message)&&/48000/.test(e.message));assert.equal(calls,0);
 }finally{f.dispose();}
});
test('heuristic false positives are adjudicated without fabricating wars or payments',async()=>{const f=setup();try{const p=empty();p.findings=[{index:0,verdict:'false_positive',reason:'北上是人物出行，不是开战'}];const before=f.c.GM.guoku.money;await review(f,p,{ok:true,applied:{failed:[],reviewRequired:[{validator:'war',detail:{keyword:'北上'}}]}});assert.equal(f.c.GM.activeWars.length,0);assert.equal(f.c.GM.guoku.money,before);}finally{f.dispose();}});
test('review planning overlaps other work and commits only at join, preserving unrelated follow-up edits',async()=>{
 const f=setup(),c=f.c,x=ctx(),started=deferred(),release=deferred();try{
  const p=empty();p.operations=[mood('忧虑')];c.callAI=async prompt=>{started.resolve();await release.promise;return reply(prompt,p)};
  c.TM.RecoveryReview.start(okay,x.results.sc1,x);await started.promise;
  c.GM.chars[0].loyalty=61;assert.equal(c.GM.chars[0].mood,'平静');release.resolve();
  await c.TM.RecoveryReview.join(x);assert.equal(c.GM.chars[0].mood,'忧虑');assert.equal(c.GM.chars[0].loyalty,61);
 }finally{release.resolve();c.TM.RecoveryReview.cancel(x);f.dispose();}
});
test('a conflicting follow-up value forces another Agent check within the same budget',async()=>{
 const f=setup(),c=f.c,x=ctx(),started=deferred(),release=deferred();let calls=0;try{
  c.callAI=async prompt=>{calls++;const p=empty();if(calls===1){started.resolve();await release.promise;p.operations=[mood('忧虑')];}else{assert(prompt.includes('并行推演已更新'));p.operations=[mood('忧虑且戒备')];}return reply(prompt,p)};
  c.TM.RecoveryReview.start(okay,x.results.sc1,x);await started.promise;c.GM.chars[0].mood='戒备';release.resolve();
  const r=await c.TM.RecoveryReview.join(x);assert.equal(r.calls,3);assert.equal(c.GM.chars[0].mood,'忧虑且戒备');
 }finally{release.resolve();c.TM.RecoveryReview.cancel(x);f.dispose();}
});
test('failed second write rolls back the first correction and cannot claim review success',async()=>{const f=setup({maxCalls:1}),c=f.c;try{const p=empty();p.operations=[mood('忧虑'),operation('set_field',{path:'GM.turn',value:10})];await assert.rejects(review(f,p),e=>e.code==='REVIEW_BUDGET');assert.equal(c.GM.chars[0].mood,'平静');assert.equal(c.GM.turn,9);assert.equal(c.GM._agentWriteLog,undefined);}finally{f.dispose();}});
test('made-up evidence and uncovered diagnostics cannot be submitted',async()=>{const f=setup({maxCalls:1}),c=f.c;try{const p=empty();p.operations=[mood('忧虑')];p.operations[0].evidence[0].quote='这是根本不存在的证据';await assert.rejects(review(f,p),e=>e.code==='REVIEW_BUDGET');assert.equal(c.GM.chars[0].mood,'平静');const f2=setup({maxCalls:1});try{await assert.rejects(review(f2,empty(),{ok:true,applied:{failed:[],reviewRequired:[{validator:'fiscal'}]}}),e=>e.code==='REVIEW_BUDGET');}finally{f2.dispose();}}finally{f.dispose();}});
test('game switching discards a pending proposal',async()=>{const f=setup(),c=f.c,x=ctx();try{c.callAI=async prompt=>{c._tmLoadGen=(c._tmLoadGen||0)+1;const p=empty();p.operations=[mood('忧虑')];return reply(prompt,p)};c.TM.RecoveryReview.start(okay,x.results.sc1,x);await assert.rejects(c.TM.RecoveryReview.join(x),e=>e.code==='AI_STALE_WORLD');assert.equal(c.GM.chars[0].mood,'平静');}finally{f.dispose();}});
test('cancelling removes live review ownership and rejects late writes',async()=>{const f=setup(),c=f.c,x=ctx(),started=deferred(),release=deferred();try{c.callAI=async prompt=>{started.resolve();await release.promise;const p=empty();p.operations=[mood('忧虑')];return reply(prompt,p)};c.TM.RecoveryReview.start(okay,x.results.sc1,x);const joined=c.TM.RecoveryReview.join(x);await started.promise;c.TM.RecoveryReview.cancel(x);assert.equal(c.TM.RecoveryReview.status().length,0);release.resolve();await assert.rejects(joined,e=>e.code==='AI_ABORTED');assert.equal(c.GM.chars[0].mood,'平静');}finally{release.resolve();f.dispose();}});
test('main write failure can be repaired and replayed through the real atomic applier',async()=>{
 const f=setup(),c=f.c,x=ctx();try{
  const bad={_strictValidation:true,_deferNarrativeRepairs:true,changes:[{path:'unknown.loyalty',value:55}]};const rejected=c.applyAITurnChanges(bad);assert(!rejected.ok);
  c.callAI=async prompt=>{const p=empty();p.operations=[operation('retry_main',{edits:[{path:'changes.0.path',value:'chars.张甲.loyalty'}]})];return reply(prompt,p)};
  const r=await c.TM.RecoveryReview.repairMain(rejected,bad,x.results.sc1,x);assert(r.result.ok);assert.equal(c.GM.chars[0].loyalty,55);assert.equal(x.results.sc1.changes[0].path,'chars.张甲.loyalty');
 }finally{f.dispose();}
});
test('fiscal narrative hints reach the Agent without guessing a debit from the public treasury',()=>{
 const f=setup(),c=f.c;try{const before=[c.GM.guoku.money,c.GM.neitang.money];const r=c.applyAITurnChanges({_strictValidation:true,_deferNarrativeRepairs:true,narrative});assert(r.ok);assert(r.applied.reviewRequired.some(r=>r.validator==='_fiscalValidatorLog'));assert.deepEqual([c.GM.guoku.money,c.GM.neitang.money],before);assert(!c.GM.guoku.extraExpense?.length);}finally{f.dispose();}
});
function finance(){
 const file=path.join(__dirname,'smoke-fiscal-ai-posting.js'),src=fs.readFileSync(file,'utf8').replace(/^#!.*\n/,'');
 const {fixture}=new Function('require','__dirname',src.slice(0,src.indexOf("run('real central-local"))+'\nreturn {fixture};')(createRequire(file),__dirname);
 const c=fixture();Object.assign(c,{AbortController,WeakMap});c.GM._endTurnCommitPending=true;c.P.ai={key:'fixture-only',url:'https://fixture.invalid',model:'test'};c.P.conf={emergencyRecovery:{maxTokens:120000}};
 for(const file of ['tm-agent-kernel.js','tm-emergency-recovery-core.js','tm-emergency-recovery-adapters.js','tm-endturn-agent-write-tools.js','tm-emergency-recovery-review.js'])load(c,file);
 return {c,dispose(){}};
}
test('Agent repairs an edict with neither account debited, posting only the declared palace account',async()=>{
 const f=finance(),c=f.c,x=ctx();c.FiscalEngine.addToNeitang({money:1000},'test funding');const before=c.GM.guoku.money,palace=c.GM.neitang.money;
 const p=empty();p.operations=[operation('adjust_treasury',{account:'neitang',currency:'money',delta:-200})];
 await review(f,p);assert.equal(c.GM.neitang.money,palace-200);assert.equal(c.GM.neitang.ledgers.money.stock,palace-200);assert.equal(c.GM.neitang.balance,palace-200);assert.equal(c.GM.guoku.money,before);
 c.GM=JSON.parse(JSON.stringify(c.GM));c._syncFiscalScalars(c.GM);assert.equal(c.GM.neitang.money,palace-200);
});
test('Agent can post a missed public payment through the same fiscal owner',async()=>{const f=finance(),c=f.c,before=c.GM.guoku.money,palace=c.GM.neitang.money;const p=empty();p.operations=[operation('adjust_treasury',{account:'guoku',currency:'money',delta:-200})];await review(f,p);assert.equal(c.GM.guoku.money,before-200);assert.equal(c.GM.guoku.ledgers.money.stock,before-200);assert.equal(c.GM.neitang.money,palace);});
test('a failed palace debit cannot switch to the wealthy public treasury or leave partial edits',async()=>{const f=finance(),c=f.c;c.P.conf.emergencyRecovery.maxCalls=1;const before=[c.GM.guoku.money,c.GM.neitang.money];const p=empty();p.operations=[operation('adjust_treasury',{account:'neitang',delta:-200})];await assert.rejects(review(f,p),e=>e.code==='REVIEW_BUDGET');assert.deepEqual([c.GM.guoku.money,c.GM.neitang.money],before);});
test('production main stage starts review on an ordinary successful write even without warnings',async()=>{const f=setup(),c=f.c,x=ctx();try{load(c,'tm-ai-result-contract.js');load(c,'tm-endturn-apply-stages.js');x.results.sc1={shizhengji:'张甲本期奉职如常。'};c.callAI=async prompt=>reply(prompt,empty());await c.TM.Endturn.AI.apply.stages._applyCore_reconcile(x);assert.equal(c.TM.RecoveryReview.status().length,0);c.TM.RecoveryReview.launch(x);assert.equal(c.TM.RecoveryReview.status().length,1);await c.TM.RecoveryReview.join(x);assert(x.meta.emergencyReview.approved);}finally{f.dispose();}});
test('production infer returns before review finishes, then corrects and saves in the background',async()=>{
 const f=setup(),c=f.c;try{
  load(c,'tm-ai-result-contract.js');load(c,'tm-endturn-apply-stages.js');load(c,'tm-endturn-ai-infer.js');c.getTimeRatio=()=>1;c.showLoading=()=>{};
  const started=deferred(),release=deferred();let followed=false;const story='张甲奉诏赴任，沿途忧虑灾民。';
  c.callAI=async prompt=>{started.resolve();await release.promise;const p=empty();p.operations=[mood('忧虑')];p.operations[0].evidence[0].quote=story;return reply(prompt,p)};
  Object.assign(c.TM.Endturn.AI,{prompt:{build:async()=>{}},subcalls:{setupInfra:()=>{},runMain:async(x,callback)=>{x.results.sc1={shizhengji:story};x.record.shizhengji=story;x.record.zhengwen='正常正文';await callback();}},followup:{run:async x=>{await started.promise;followed=true;c.GM.chars[0].loyalty=64;x.followup.startBackground=()=>{assert(!x.meta.emergencyReview.verified);c.__reviewBackgroundStarted=true;};}},record:{finalize:x=>{assert(followed);assert(x.meta.emergencyReview.nonBlocking);return x.record;}}});
  c.TM.Endturn.AI.apply.writeBack=x=>c.TM.Endturn.AI.apply.stages._applyCore_reconcile(x);
  const outer={input:{},meta:{transaction:{committed:false,rolledBack:false}}};const r=await c._endTurn_aiInfer({text:narrative},null,null,{},outer);assert(r.shizhengji);assert.equal(c.GM.chars[0].mood,'平静');assert.equal(c.GM.chars[0].loyalty,64);assert(outer.meta.aiInferMeta.emergencyReview.nonBlocking);assert.equal(c.__reviewBackgroundStarted,true);
  release.resolve();const result=await finishBackground(c,outer,r);assert.equal(c.GM.chars[0].mood,'忧虑');assert(result.row.agentReview.verified);assert(result.saves>0);
 }finally{f.dispose();}
});

test('full Agent mode returns its main result immediately and later updates the saved narrative',async()=>{const f=setup(),c=f.c;try{const x=ctx(),out={shizhengji:narrative,zhengwen:'原正文'};x.meta.transaction={committed:false,rolledBack:false};c.callAI=async prompt=>{const p=empty();p.record={zhengwen:'已核查并补充的新正文'};return reply(prompt,p)};const r=c.TM.RecoveryReview.reviewAgentResult(x,out);assert.equal(r.zhengwen,'原正文');assert(x.meta.emergencyReview.nonBlocking);const result=await finishBackground(c,x,out);assert.equal(result.row.zhengwen,'已核查并补充的新正文');assert(result.row.html.includes('已核查并补充的新正文'));assert(result.row.agentReview.verified);}finally{f.dispose();}});
test('exhausted background review preserves the committed turn and its original evidence',async()=>{
 const f=setup({reviewMaxTokens:1}),c=f.c,x=ctx();try{x.meta.transaction={committed:false,rolledBack:false};let calls=0;c.callAI=async()=>calls++;
 c.TM.RecoveryReview.start(okay,x.results.sc1,x);c.TM.RecoveryReview.handoff(x);const result=await finishBackground(c,x);
 assert.equal(calls,0);assert.equal(c.GM.turn,10);assert.equal(result.row.agentReview.status,'pending');assert(result.row.agentReview.pendingSources.some(r=>r.text===narrative));assert(result.saves>0);
 }finally{f.dispose();}
});
test('starting another turn cancels a late background proposal before it can write',async()=>{
 const f=setup(),c=f.c,x=ctx(),gate=deferred(),started=deferred();try{x.meta.transaction={committed:false,rolledBack:false};
 c.callAI=async()=>{started.resolve();await gate.promise;const p=empty();p.operations=[mood('不应写入')];return submit(p);};
 c.TM.RecoveryReview.start(okay,x.results.sc1,x);c.TM.RecoveryReview.handoff(x);await started.promise;const pending=finishBackground(c,x);
 await new Promise(resolve=>setTimeout(resolve,10));c.TM.RecoveryReview.pauseForNextTurn();c.GM._endTurnCommitPending=true;gate.resolve();await pending;
 await new Promise(resolve=>setTimeout(resolve,10));assert.equal(c.GM.chars[0].mood,'平静');assert.equal(c.GM.shijiHistory[0].agentReview.status,'pending');
 }finally{f.dispose();}
});
test('review absence or failure is advisory once the main result exists',()=>{const f=setup(),c=f.c;try{load(c,'tm-endturn-validity.js');const x=ctx();x.meta.requireTurnReview=true;let r=c.TM.Endturn.Validity.validateBeforeCommit(x);assert(r.ok);assert(r.warnings.some(s=>s.includes('复核')));x.meta.emergencyReview={status:'pending',reason:'REVIEW_BUDGET'};assert(c.TM.Endturn.Validity.validateBeforeCommit(x).ok);}finally{f.dispose();}});

test('a rejected atomic write is retained for background repair without fabricating success',async()=>{
 const f=setup(),c=f.c,x=ctx(),story='张甲忠心转增，沿途忧虑灾民。';try{
  load(c,'tm-ai-result-contract.js');load(c,'tm-endturn-apply-stages.js');x.results.sc1={shizhengji:story,changes:[{path:'unknown.loyalty',value:55}]};
  c.callAI=async prompt=>{const info=JSON.parse(prompt.slice(prompt.indexOf('\n')+1)),p=empty();if(info.case.mode==='main-repair'){const op=operation('retry_main',{edits:[{path:'changes.0.path',value:'chars.张甲.loyalty'}]});op.evidence[0].quote=story;p.operations=[op];}return reply(prompt,p)};
  x.meta.transaction={committed:false,rolledBack:false};await assert.rejects(c.TM.Endturn.AI.apply.stages._applyCore_reconcile(x),e=>e.code==='ai-writeback-atomic-failed');assert.equal(c.GM.chars[0].loyalty,50);assert(x.meta.deferredMainOutput);c.TM.RecoveryReview.launchRoutine(x);c.TM.RecoveryReview.handoff(x);const result=await finishBackground(c,x);assert.equal(c.GM.chars[0].loyalty,55);assert(result.row.agentReview.verified);
 }finally{f.dispose();}
});
test('complete long annals, political chronicle and other generated results are actually sent, without prefix clipping',async()=>{
 const f=setup({maxTokens:240000}),c=f.c,x=ctx();try{
  const chronicle='时政记原文。'.repeat(2600)+'时政记尾部：必须核查此项。',annals='实录原文。'.repeat(2800)+'实录尾部：内帑支出尚未落账。';
  x.record.shizhengji=chronicle;x.record.shiluText=annals;x.results.sc1={shizhengji:chronicle,shilu_text:annals};x.results.sc16={fiscalFinding:'财赋专项完整结果：仍有待付事项。'};
  c.callAI=async prompt=>{const rows=request(prompt).case.sources;assert(rows.some(r=>r.text===chronicle));assert(rows.some(r=>r.text===annals));assert(rows.some(r=>r.text.includes('财赋专项完整结果：仍有待付事项。')));return reply(prompt,empty());};
  c.TM.RecoveryReview.start(okay,x.results.sc1,x);const r=await c.TM.RecoveryReview.join(x);assert(r.sourceCoverage.complete);assert.equal(r.sourceCoverage.required,r.sourceCoverage.read);
 }finally{f.dispose();}
});
test('late annals and new inference results force review even when the initial proposal made no changes',async()=>{
 const f=setup(),c=f.c,x=ctx(),started=deferred();let calls=0;try{
  c.callAI=async prompt=>{calls++;const q=request(prompt).case;if(calls===1)started.resolve();else{assert.equal(q.phase,'final');assert(q.sources.some(r=>r.text==='实录迟至此时生成：张甲已赴任。'));assert(q.sources.some(r=>r.text.includes('新增军务推演结果')));}return reply(prompt,empty());};
  c.TM.RecoveryReview.start(okay,x.results.sc1,x);await started.promise;x.record.shiluText='实录迟至此时生成：张甲已赴任。';x.results.sc17={report:'新增军务推演结果'};
  const r=await c.TM.RecoveryReview.join(x);assert.equal(calls,2);assert(r.sourceCoverage.complete);
 }finally{f.dispose();}
});
test('an ok/verified tool receipt cannot hide a no-op or wrong actual value',async()=>{
 for(const bad of ['no-op','wrong-value']){const f=setup({maxCalls:1}),c=f.c;try{
  const p=empty();p.operations=[mood('忧虑')];const real=c.TM.Endturn.AgentWriteTools.handleSync;
  c.TM.Endturn.AgentWriteTools.handleSync=(name,input,context)=>{if(name!=='set_field')return real(name,input,context);if(bad==='wrong-value')c.GM.chars[0].mood='暴怒';return {ok:true,changed:true,verified:true,result:{old:'平静',new:'忧虑'}};};
  await assert.rejects(review(f,p),e=>e.code==='REVIEW_BUDGET');assert.equal(c.GM.chars[0].mood,'平静');
 }finally{f.dispose();}}
});
test('Agent receives real before/after data and can correct a semantically wrong first modification',async()=>{
 const f=setup(),c=f.c,x=ctx(),story='张甲解明误会，心境释然。';let scans=0;try{
  x.record.shizhengji=story;x.results.sc1={shizhengji:story};
  c.callAI=async prompt=>{
   const q=request(prompt).case;scans++;
   if(q.phase==='verify'){
    assert(q.sources.some(r=>r.text===story));const latest=q.corrections.at(-1);assert(latest.observations.some(r=>r.path==='chars.张甲.mood'&&r.after===c.GM.chars[0].mood));
    if(q.corrections.length===2)return verified(prompt);
    assert.equal(latest.observations[0].before,'平静');assert.equal(latest.observations[0].after,'忧虑');
    const p=empty();p.operations=[mood('释然')];p.operations[0].evidence[0].quote=story;return submit(p);
   }
   const p=empty();p.operations=[mood('忧虑')];p.operations[0].evidence[0].quote=story;return submit(p);
  };
  c.TM.RecoveryReview.start(okay,x.results.sc1,x);const r=await c.TM.RecoveryReview.join(x);assert.equal(scans,3);assert.equal(c.GM.chars[0].mood,'释然');assert.equal(r.corrections.length,2);assert(r.verification.verified);assert.equal(r.verification.outcomes.length,2);
 }finally{f.dispose();}
});
test('successful writes without remaining verification budget do not receive a completion receipt',async()=>{
 const f=setup({maxCalls:1}),c=f.c,x=ctx();try{const p=empty();p.operations=[mood('忧虑')];c.callAI=async()=>submit(p);c.TM.RecoveryReview.start(okay,x.results.sc1,x);await assert.rejects(c.TM.RecoveryReview.join(x),e=>e.code==='REVIEW_BUDGET');assert(!x.meta.emergencyReview?.approved);assert.equal(c.GM._endTurnCommitPending,true);load(c,'tm-endturn-validity.js');assert(c.TM.Endturn.Validity.validateBeforeCommit(x).ok);}finally{f.dispose();}
});
test('every actual correction must be covered by the second Agent verdict',async()=>{
 const f=setup({maxCalls:2}),c=f.c,x=ctx();try{const p=empty();p.operations=[mood('忧虑')];c.callAI=async prompt=>request(prompt).case.phase==='verify'?JSON.stringify({tools:[{name:'finish_review',input:{approved:true,reason:'口头宣称成功',outcomes:[]}}]}):submit(p);c.TM.RecoveryReview.start(okay,x.results.sc1,x);await assert.rejects(c.TM.RecoveryReview.join(x),e=>e.code==='REVIEW_BUDGET');assert(!x.meta.emergencyReview?.approved);}finally{f.dispose();}
});
test('a field overwritten while the verifying model responds cannot be approved',async()=>{
 const f=setup({maxCalls:2}),c=f.c,x=ctx();try{const p=empty();p.operations=[mood('忧虑')];c.callAI=async prompt=>{if(request(prompt).case.phase==='verify'){c.GM.chars[0].mood='被异步覆盖';return verified(prompt);}return submit(p);};c.TM.RecoveryReview.start(okay,x.results.sc1,x);await assert.rejects(c.TM.RecoveryReview.join(x),e=>e.code==='REVIEW_BUDGET');assert(!x.meta.emergencyReview?.approved);}finally{f.dispose();}
});
test('corrected annals are read back and propagated while the original generated text remains evidence',async()=>{
 const f=setup(),c=f.c,x=ctx();try{
  const old='实录原文：赈银尚在审核。',next='实录修正：赈银仍待审核，尚未拨付。';x.record.shiluText=old;x.results.sc1.shilu_text=old;x.results.sc1d={shilu_text:old};
  c.callAI=async prompt=>{const q=request(prompt).case;if(q.phase==='verify'){assert(q.sources.some(r=>r.text===old));const fix=q.corrections.find(r=>r.record&&r.path==='shiluText');assert.equal(fix.before,old);assert.equal(fix.after,next);assert.equal(c.GM.neitang.money,500);return verified(prompt);}const p=empty();p.record={shiluText:next};return submit(p);};
  c.TM.RecoveryReview.start(okay,x.results.sc1,x);const r=await c.TM.RecoveryReview.join(x);assert.equal(x.record.shiluText,next);assert.equal(x.results.sc1.shilu_text,next);assert.equal(x.results.sc1d.shilu_text,next);assert(r.verified);
 }finally{f.dispose();}
});

test('post-write evidence exposes unintended changes rather than trusting the tool self-report',async()=>{
 const f=setup(),c=f.c,x=ctx();let writes=0,sawUnexpected=false;try{
  const real=c.TM.Endturn.AgentWriteTools.handleSync;c.TM.Endturn.AgentWriteTools.handleSync=(name,input,context)=>{const r=real(name,input,context);if(++writes===1)c.GM.chars[0].loyalty=0;return r;};
  c.callAI=async prompt=>{
   const q=request(prompt).case;if(q.phase==='verify'){
    const post=JSON.parse(q.sources.find(r=>r.id==='post-write').text);
    if(q.corrections.length===1){assert(post.actualWrites[0].changes.some(r=>r.root==='GM'&&r.path==='chars.0.loyalty'&&r.before===50&&r.after===0));sawUnexpected=true;const p=empty();p.operations=[operation('set_field',{path:'chars.张甲.loyalty',value:50})];p.operations[0].evidence=[{source:'post-write',quote:'"path":"chars.0.loyalty","before":50,"after":0'}];return submit(p);}
    return verified(prompt);
   }const p=empty();p.operations=[mood('忧虑')];return submit(p);
  };
  c.TM.RecoveryReview.start(okay,x.results.sc1,x);const r=await c.TM.RecoveryReview.join(x);assert(sawUnexpected);assert.equal(c.GM.chars[0].loyalty,50);assert.equal(c.GM.chars[0].mood,'忧虑');assert(r.actualWrites.length===2);assert(r.verified);
 }finally{f.dispose();}
});


test('a later distinct inference source is reviewed even when its text duplicates an earlier source',async()=>{const f=setup(),c=f.c,x=ctx(),started=deferred();let n=0;try{x.results.sc16={text:'同样的生成结论'};c.callAI=async prompt=>{n++;if(n===1)started.resolve();else{const rows=request(prompt).case.sources;assert(rows.some(r=>r.text.includes('同样的生成结论')&&(r.aliases||[]).includes('final:result:sc17')));}return reply(prompt,empty());};c.TM.RecoveryReview.start(okay,x.results.sc1,x);await started.promise;x.results.sc17={text:'同样的生成结论'};await c.TM.RecoveryReview.join(x);assert.equal(n,2);}finally{f.dispose();}});

test('state evidence read during planning remains available unchanged during after-write verification',async()=>{const f=setup(),c=f.c,x=ctx();let stateId;try{c.callAI=async prompt=>{const q=request(prompt);if(q.case.phase==='verify'){const row=q.case.sources.find(r=>r.id===stateId||(r.aliases||[]).includes(stateId));assert(row);assert(row.text.includes('"mood":"平静"'));assert.equal(c.GM.chars[0].mood,'忧虑');return verified(prompt);}if(!q.history.length)return JSON.stringify({tools:[{name:'read_state',input:{path:'chars.张甲'}}]});stateId=q.history.find(r=>r.tool==='read_state').result.id;const p=empty();p.operations=[mood('忧虑')];p.operations[0].evidence.push({source:stateId,quote:'"mood":"平静"'});return submit(p);};c.TM.RecoveryReview.start(okay,x.results.sc1,x);const r=await c.TM.RecoveryReview.join(x);assert(r.verified);assert.equal(r.calls,3);}finally{f.dispose();}});
run(tests);
