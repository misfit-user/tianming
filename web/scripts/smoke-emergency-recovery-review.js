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
function ctx(){return {input:{edicts:{text:narrative}},meta:{requireTurnReview:true,postTurnMemorySavePromise:Promise.resolve({ok:true,scheduled:true})},record:{shizhengji:narrative,zhengwen:'本期实录正文'},results:{sc1:{shizhengji:narrative}}};}
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
async function finishBackground(c,x,record){
 const txn=x.meta.transaction;txn.committed=true;c.GM._endTurnCommitPending=false;c.GM.busy=false;c.GM.turn++;
 c.GM.shijiHistory=[Object.assign({turn:c.GM.turn-1,html:'原纪事'},record||x.record)];let saves=0;c.requestBackgroundAutosave=async()=>{saves++;return {ok:true,scheduled:true};};
 c.TM.RecoveryReview.afterCommit(x);
 for(let i=0;i<100&&c.TM.RecoveryReview.status().length;i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(c.TM.RecoveryReview.status().length,0,'background review settles independently');return {row:c.GM.shijiHistory[0],saves};
}
function setup(settings={},observeBasis){
 const f=fixture(settings),c=f.c;c.GM=baseGM({_campaignId:'a',_timelineId:'b',_endTurnCommitPending:true,chars:[{id:'a',name:'张甲',mood:'平静',loyalty:50,alive:true}]});
 // Isolated review cases assume an already completed memory producer and persistence boundary.
 // The integration case below loads the actual production background queue.
 c._tmAwaitBackgroundAutosaves=async()=>({ok:true});
 for(const file of ['tm-ai-change-pathutils.js','tm-ai-change-army.js','tm-ai-change-narrative.js','generated/tm-ai-change-applier.bundle.js','tm-social-formation.js','tm-agent-world-editor.js','tm-endturn-agent-write-tools.js','tm-emergency-recovery-review.js']){
  if(file!=='tm-emergency-recovery-review.js'||!observeBasis&&!process.env.TM_REVIEW_SOURCE_OVERRIDE){load(c,file);continue;}
  // Observe private ownership at the real allocation boundary only in this VM.
  // Production exposes no inspector; this hook observes the real freeze boundary.
  c.__reviewBasisProbe=observeBasis;
  const source=fs.readFileSync(process.env.TM_REVIEW_SOURCE_OVERRIDE||path.join(__dirname,'..',file),'utf8'),marker='  function snapshot(g){';
  assert.equal(source.split(marker).length,2,'one production snapshot allocation boundary');
  vm.runInContext(observeBasis?source.replace(marker,marker+'root.__reviewBasisProbe({world:g,session:Array.from(live.values())[0],playerSnapshots:playerSnapshots});'):source,c,{filename:file});
 }
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
  const outer={input:{},meta:{transaction:{committed:false,rolledBack:false},postTurnMemorySavePromise:Promise.resolve({ok:true,scheduled:true})}};const r=await c._endTurn_aiInfer({text:narrative},null,null,{},outer);assert(r.shizhengji);assert.equal(c.GM.chars[0].mood,'平静');assert.equal(c.GM.chars[0].loyalty,64);assert(outer.meta.aiInferMeta.emergencyReview.nonBlocking);assert.equal(c.__reviewBackgroundStarted,true);
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

// 2026-11-06 主写回改逐条落账：一条坏了不再整批回滚、整回合挂起；坏的那条记账后作为待复核事项交给每回合复核补落。
test('a failed main-writeback item no longer rolls back the turn; the review lands its correction without fabricating success',async()=>{
 const f=setup(),c=f.c,x=ctx(),story='张甲忠心转增，沿途忧虑灾民。';try{
  load(c,'tm-ai-result-contract.js');load(c,'tm-endturn-apply-stages.js');x.results.sc1={shizhengji:story,changes:[{path:'unknown.loyalty',value:55}]};
  c.callAI=async prompt=>{const info=JSON.parse(prompt.slice(prompt.indexOf('\n')+1)),p=empty();if(info.case.mode==='routine'&&(info.case.issues||[]).some(i=>i&&i.kind==='unlanded-writeback')){const op=operation('apply_changes',{changes:[{path:'chars.张甲.loyalty',value:55}]});op.evidence[0].quote=story;op.postconditions=[{path:'chars.张甲.loyalty',equals:55}];p.findings=info.case.issues.map((i,index)=>({index,verdict:'corrected',reason:'按原文补落张甲忠诚'}));p.operations=[op];}return reply(prompt,p)};
  x.meta.transaction={committed:false,rolledBack:false};await c.TM.Endturn.AI.apply.stages._applyCore_reconcile(x);assert.equal(c.GM.chars[0].loyalty,50);assert((c.GM._unappliedChanges||[]).some(r=>r&&r.source==='sc1主应用'));assert(!x.meta.deferredMainOutput);c.TM.RecoveryReview.launchRoutine(x);c.TM.RecoveryReview.handoff(x);const result=await finishBackground(c,x);assert.equal(c.GM.chars[0].loyalty,55);assert(result.row.agentReview.verified);
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
test('prepared review retires full worlds before handoff and preserves copied conflict evidence through replanning',async()=>{
 let owner,players,snapshots=0,oldBasis,oldReads;
 const f=setup({},({world,session,playerSnapshots})=>{
  owner=session;players=playerSnapshots;
  if(oldBasis){
   assert.equal(owner.basis,null,'no previous full basis survives into native snapshot allocation');
   assert.equal(owner.reads,null,'superseded read copies retire before snapshot allocation');
   assert.equal(owner.record,null,'superseded record copy retires before snapshot allocation');
   assert.equal(players.has(oldBasis),false,'previous basis no longer owns a hidden P snapshot');
  }
  if(world===f.c.GM)snapshots++;
 }),c=f.c,x=ctx();let calls=0;try{
  c.P.reviewOnly={marker:'original P value'};
  c.callAI=async prompt=>{
   const q=request(prompt);calls++;
   assert(owner.basis&&players.has(owner.basis),'each active plan still owns detached GM and P');
   if(calls===1){
    oldBasis=owner.basis;oldReads=owner.reads;assert.notEqual(oldBasis,c.GM);assert.notEqual(players.get(oldBasis),c.P);
    c.GM.chars[0].loyalty=61;c.P.reviewOnly.marker='live P value';
    assert.equal(oldBasis.chars[0].loyalty,50);assert.equal(players.get(oldBasis).reviewOnly.marker,'original P value');
   }
   if(q.case.phase==='verify')return verified(prompt);
   const p=empty();p.operations=[mood(calls===1?'忧虑':'忧虑且戒备')];
   if(calls>1)assert(prompt.includes('并行推演已更新'));
   return submit(p);
  };
  c.TM.RecoveryReview.start(okay,x.results.sc1,x);
  while(!owner)await new Promise(resolve=>setTimeout(resolve,0));
  const prepared=await owner.pending;assert(prepared.value);
  assert.equal(owner.basis,null,'prepared proposal cannot retain a full world through handoff or save');
  assert.equal(players.has(oldBasis),false);assert.equal(owner.reads,oldReads);
  assert.equal(owner.reads.get('chars.张甲.mood'),'平静');assert.equal(owner.record.zhengwen,x.record.zhengwen);
  c.GM.chars[0].mood='戒备';
  const receipt=await c.TM.RecoveryReview.join(x);
  assert.equal(receipt.calls,3);assert.equal(snapshots,3);assert(receipt.verified);
  assert.equal(c.GM.chars[0].mood,'忧虑且戒备');assert.equal(c.GM.chars[0].loyalty,61);
  assert.equal(owner.basis,null);assert.equal(owner.reads,null);assert.equal(owner.record,null);
  assert.equal(owner.ctx,x);assert.equal(owner.g,c.GM);assert.equal(owner.p,c.P);
 }finally{c.TM.RecoveryReview.cancel(x);f.dispose();}
});
test('failed replacement snapshot leaves no old basis or read owner and cannot commit its superseded proposal',async()=>{
 let owner,players,oldBasis,snapshots=0;
 const f=setup({},({world,session,playerSnapshots})=>{
  owner=session;players=playerSnapshots;
  if(world===f.c.GM&&++snapshots===2){
   assert.equal(owner.basis,null);assert.equal(owner.reads,null);assert.equal(owner.record,null);assert.equal(players.has(oldBasis),false);
   throw Error('fixture replacement snapshot failed');
  }
 }),c=f.c,x=ctx();try{
  c.callAI=async()=>{oldBasis=owner.basis;return submit(empty());};
  c.TM.RecoveryReview.start(okay,x.results.sc1,x);
  while(!owner)await new Promise(resolve=>setTimeout(resolve,0));
  await owner.pending;x.record.shiluText='后续生成的新实录，必须另行核对。';
  await assert.rejects(c.TM.RecoveryReview.join(x),/fixture replacement snapshot failed/);
  assert.equal(owner.basis,null);assert.equal(owner.reads,null);assert.equal(owner.record,null);assert.equal(players.has(oldBasis),false);
  assert.equal(c.GM.chars[0].mood,'平静');assert(!x.meta.emergencyReview?.approved);assert.equal(c.TM.RecoveryReview.status().length,0);
 }finally{c.TM.RecoveryReview.cancel(x);f.dispose();}
});
test('cancellation releases private snapshot owners while late responses retain identity checks and cannot write',async()=>{
 let owner,players,basis;const started=deferred(),release=deferred();
 const f=setup({},p=>{owner=p.session;players=p.playerSnapshots;}),c=f.c,x=ctx();try{
  x.meta.transaction={committed:false,rolledBack:false};
  c.callAI=async()=>{basis=owner.basis;started.resolve();await release.promise;const p=empty();p.operations=[mood('不应写入')];return submit(p);};
  c.TM.RecoveryReview.start(okay,x.results.sc1,x);const joined=c.TM.RecoveryReview.join(x);joined.catch(()=>{});await started.promise;
  assert(basis&&players.has(basis));c.TM.RecoveryReview.cancel(x);
  assert.equal(owner.basis,null);assert.equal(owner.reads,null);assert.equal(owner.record,null);assert.equal(players.has(basis),false);
  assert.equal(owner.ctx,x);assert.equal(owner.ctx.meta.transaction,x.meta.transaction);assert.equal(owner.g,c.GM);assert.equal(owner.p,c.P);
  release.resolve();await assert.rejects(joined,e=>e.code==='AI_ABORTED');assert.equal(c.GM.chars[0].mood,'平静');
 }finally{release.resolve();c.TM.RecoveryReview.cancel(x);f.dispose();}
});
function snapshotFixture(){
 const source=fs.readFileSync(path.join(__dirname,'..','tm-emergency-recovery-review.js'),'utf8'),marker='  function releaseBasis(s){';
 assert.equal(source.split(marker).length,2);
 const c=vm.createContext({});
 vm.runInContext(source.replace(marker,'  root.__snapshot=snapshot;root.__read=read;root.__players=playerSnapshots;\n'+marker),c);
 vm.runInContext('globalThis.__parses=[];const nativeParse=JSON.parse;JSON.parse=function(text){__parses.push(text.length);return nativeParse(text);};',c);
 return c;
}
test('unread GM maps and P scenarios freeze immediately without parsing and each root materializes only once',()=>{
 const c=snapshotFixture();
 vm.runInContext('GM={mapData:{regions:Array.from({length:2000},(_,i)=>({id:"r"+i,points:[i,i+1]}))},small:{value:1}};P={scenarios:[{map:{regions:Array.from({length:2000},(_,i)=>({id:"p"+i}))}}]};basis=__snapshot(GM);',c);
 assert.equal(c.__parses.length,0);assert.deepEqual(Array.from(Object.keys(c.basis)),['mapData','small']);assert.equal(c.__parses.length,0,'enumeration must not parse');
 const player=c.__players.get(c.basis);assert(player);assert.equal(c.__parses.length,0);
 assert.equal(c.basis.small.value,1);assert.equal(c.__parses.length,1);assert.equal(c.basis.small.value,1);assert.equal(c.__parses.length,1);
 vm.runInContext('GM.mapData.regions[0].id="live changed";P.scenarios[0].map.regions[0].id="live P changed";GM.small.value=2;',c);
 assert.equal(c.basis.mapData.regions[0].id,'r0');assert.equal(c.__parses.length,2);assert.equal(c.basis.mapData,c.basis.mapData);assert.equal(c.__parses.length,2);
 assert.equal(player.scenarios[0].map.regions[0].id,'p0');assert.equal(c.__parses.length,3);assert.equal(c.basis.small.value,1);
 const descriptor=Object.getOwnPropertyDescriptor(c.basis,'mapData');assert.equal(typeof descriptor.get,'function');assert.equal(descriptor.set,undefined);assert.equal(descriptor.configurable,false);
 assert.throws(()=>{c.basis.mapData={};},TypeError);assert.equal(c.GM.small.value,2);
});
test('root JSON facts preserve dates, undefined, nonfinite numbers, sparse arrays, aliases and actual toJSON keys',()=>{
 const c=snapshotFixture();
 vm.runInContext('keys=[];shared={value:4};world={date:new Date("2026-10-22T00:00:00Z"),missing:undefined,nan:NaN,infinity:Infinity,sparse:[,undefined,NaN],first:shared,second:shared,custom:{toJSON:function(key){keys.push(key);return {actualKey:key,nested:{toJSON:function(k){keys.push(k);return k;}}};}},omitted:{toJSON:function(key){keys.push(key);return undefined;}}};expected=JSON.stringify(world);expectedKeys=keys.slice();keys.length=0;basis=__snapshot(world);',c);
 assert.equal(c.__parses.length,0);assert.equal('missing' in c.basis,false);assert.equal('omitted' in c.basis,false);
 assert.deepEqual(Array.from(c.keys),Array.from(c.expectedKeys));assert.equal(JSON.stringify(c.basis),c.expected);
 assert.equal(c.basis.date,'2026-10-22T00:00:00.000Z');assert.equal(c.basis.nan,null);assert.deepEqual(Array.from(c.basis.sparse),[null,null,null]);
 assert.notEqual(c.basis.first,c.basis.second);assert.notEqual(c.basis.first,c.shared);assert.equal(c.basis.custom.actualKey,'custom');
});
test('all current roots are captured before any toJSON runs, preserving accessor and key-order semantics',()=>{
 const c=snapshotFixture();
 vm.runInContext('reads=0;world={first:{toJSON:function(key){world.later="new live root";return key;}},later:"captured root"};Object.defineProperty(world,"accessor",{enumerable:true,get:function(){reads++;return {read:reads};}});basis=__snapshot(world);',c);
 assert.equal(c.reads,2);assert.equal(c.basis.later,'captured root');assert.equal(c.world.later,'new live root');assert.equal(c.basis.first,'first');assert.equal(c.basis.accessor.read,2);
});
test('an inherited root toJSON retains the former whole-object copy semantics',()=>{
 const c=snapshotFixture();
 vm.runInContext('hookCalls=0;Object.prototype.toJSON=function(key){hookCalls++;return key===""?{summary:this.value+1}:this;};world={value:4};basis=__snapshot(world);delete Object.prototype.toJSON;',c);
 assert.equal(c.hookCalls,1);assert.equal(c.basis.summary,5);assert.equal(c.__parses.length,1);
});
test('a captured own root toJSON from the original double-read getter sees the complete root object',()=>{
 const c=snapshotFixture();
 vm.runInContext('reads=0;world={value:4};Object.defineProperty(world,"toJSON",{enumerable:true,get:function(){reads++;return reads===1?null:function(){return {summary:this.value};};}});basis=__snapshot(world);',c);
 assert.equal(c.reads,2);assert.equal(c.basis.summary,4);assert.equal(c.basis.value,undefined);assert.equal(c.__parses.length,1);
});
test('unread cycle, BigInt and throwing toJSON fail during freezing without deferred reads',()=>{
 for(const expression of ['(()=>{const v={};v.self=v;return v;})()','1n','({toJSON:function(){throw Error("actual toJSON failure");}})']){
  const c=snapshotFixture();vm.runInContext('world={safe:{value:1},unread:'+expression+'};',c);
  assert.throws(()=>c.__snapshot(c.world),/circular|BigInt|actual toJSON failure/i);assert.equal(c.__parses.length,0);
 }
});
test('real read_state uses frozen unread GM and P roots, then conflict replanning and verified writeback use current facts',async()=>{
 const f=setup(),c=f.c,x=ctx();let calls=0,first=true;try{
  c.GM.mapData={regions:[{id:'r1',value:7}]};c.P.reviewOnly={value:11};
  c.callAI=async prompt=>{const q=request(prompt);calls++;
   if(q.case.phase==='verify')return verified(prompt);
   if(!q.history.length){if(first){c.GM.mapData.regions[0].value=8;c.P.reviewOnly.value=12;}else assert(prompt.includes('并行推演已更新'));
    return JSON.stringify({tools:[{name:'read_state',input:{path:'mapData.regions.r1.value'}},{name:'read_state',input:{path:'P.reviewOnly.value'}}]});}
   const reads=q.history.filter(row=>row.tool==='read_state');assert.equal(reads[0].result.text,first?'7':'8');assert.equal(reads[1].result.text,first?'11':'12');first=false;
   const p=empty();p.operations=[mood('忧虑')];return submit(p);
  };
  c.TM.RecoveryReview.start(okay,x.results.sc1,x);const receipt=await c.TM.RecoveryReview.join(x);
  assert(receipt.verified);assert.equal(calls,5);assert.equal(c.GM.chars[0].mood,'忧虑');assert.equal(c.GM.mapData.regions[0].value,8);assert.equal(c.P.reviewOnly.value,12);
 }finally{f.dispose();}
});
test('switching worlds with unread frozen roots still releases GM/P basis and rejects the late write',async()=>{
 let owner,players,basis;const f=setup({},probe=>{owner=probe.session;players=probe.playerSnapshots;}),c=f.c,x=ctx();try{
  c.GM.mapData={regions:[{id:'old-world'}]};c.P.scenarios=[{id:'old-template'}];
  c.callAI=async()=>{basis=owner.basis;c._tmLoadGen=(c._tmLoadGen||0)+1;const p=empty();p.operations=[mood('不应写入')];return submit(p);};
  c.TM.RecoveryReview.start(okay,x.results.sc1,x);await assert.rejects(c.TM.RecoveryReview.join(x),e=>e.code==='AI_STALE_WORLD');
  assert.equal(owner.basis,null);assert.equal(players.has(basis),false);assert.equal(c.GM.chars[0].mood,'平静');assert.equal(c.TM.RecoveryReview.status().length,0);
 }finally{f.dispose();}
});
async function until(check,label){for(let i=0;i<100;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,2));}throw Error(label);}
async function backgroundBarrierCase(){
 let c,owner,calls=0,bases=0,entered=false;const events=[],gate=deferred();
 const f=setup({},probe=>{if(probe.world===c.GM){owner=probe.session;bases++;events.push('review-basis');}});c=f.c;const x=ctx();x.meta.transaction={committed:false,rolledBack:false};
 c.callAI=async prompt=>{calls++;events.push('model');return reply(prompt,empty());};
 c.TM.RecoveryReview.start(okay,x.results.sc1,x);
 await until(()=>c.TM.RecoveryReview.status().some(row=>row.phase==='prepared'),'initial review must prepare');
 assert.equal(calls,1);assert.equal(bases,1);
 x.record.shiluText='回合结束后才生成的实录，仍须复核。';c.TM.RecoveryReview.handoff(x);
 x.meta.transaction.committed=true;c.GM._endTurnCommitPending=false;c.GM.busy=false;c.GM.turn++;
 c.GM.shijiHistory=[Object.assign({turn:c.GM.turn-1,html:'原纪事'},x.record)];
 c.requestBackgroundAutosave=async()=>{events.push('pending-save-request');return {ok:true,scheduled:true};};
 c._tmAwaitBackgroundAutosaves=()=>{entered=true;events.push('save-barrier');return gate.promise;};
 return {f,c,x,events,gate,abort:()=>owner.controller.abort(Error('background review signal cancelled')),start:()=>c.TM.RecoveryReview.afterCommit(x),entered:()=>entered,calls:()=>calls,bases:()=>bases,background:()=>owner.backgroundPromise,
  dispose(){gate.resolve({ok:true});c.TM.RecoveryReview.cancel(x);f.dispose();}};
}
test('background pending sources are saved before a second frozen basis or model request is allocated',async()=>{
 const t=await backgroundBarrierCase();try{t.start();await until(t.entered,'production review must await its pending canonical save');
  assert.equal(t.bases(),1);assert.equal(t.calls(),1);assert.equal(t.c.GM._endTurnCommitPending,false);assert.equal(t.c.GM.busy,false);
  assert(t.c.GM.shijiHistory[0].agentReview.pendingSources.some(row=>row.text==='回合结束后才生成的实录，仍须复核。'));
  t.c.GM.chars[0].mood='保存期间有了新的实际情况';t.gate.resolve({ok:true});
  await until(()=>t.c.TM.RecoveryReview.status().length===0,'saved review must finish');
  assert.equal(t.calls(),2);assert.equal(t.bases(),2);assert(t.c.GM.shijiHistory[0].agentReview.verified);
  assert(t.events.indexOf('save-barrier')<t.events.lastIndexOf('review-basis'));
 }finally{t.dispose();}
});
for(const change of ['load-generation','world','player-state','turn','api','busy','cancel','signal'])test('background save wait rechecks '+change+' before any new basis or model call',async()=>{
 const t=await backgroundBarrierCase();try{t.start();await until(t.entered,'save barrier must be entered');const old=t.c.GM;
  if(change==='load-generation')t.c._tmLoadGen=(t.c._tmLoadGen||0)+1;
  else if(change==='world')t.c.GM=Object.assign({},old,{chars:[{id:'fresh',name:'新人物',mood:'原状'}],shijiHistory:[]});
  else if(change==='player-state')t.c.P=Object.assign({},t.c.P);
  else if(change==='turn')t.c.GM.turn++;
  else if(change==='api')t.c.P.ai=Object.assign({},t.c.P.ai,{model:'changed-model'});
  else if(change==='busy')t.c.GM.busy=true;
  else if(change==='signal')t.abort();
  else t.c.TM.RecoveryReview.cancel(t.x);
  t.gate.resolve({ok:true});await until(()=>t.c.TM.RecoveryReview.status().length===0,'stale review must retire');await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(t.calls(),1);assert.equal(t.bases(),1);assert.equal(old.chars[0].mood,'平静');assert.equal(old.shijiHistory[0].agentReview.verified,false);assert.equal(t.events.filter(event=>event==='pending-save-request').length,1);
 }finally{t.dispose();}
});
test('a rejected save barrier preserves its original error and does not create a fresh save retry',async()=>{
 const t=await backgroundBarrierCase();try{t.start();await until(t.entered,'save barrier must be entered');t.gate.reject(Error('actual canonical rejection'));
  await until(()=>t.c.TM.RecoveryReview.status().length===0,'rejected barrier must retire review');
  assert.equal(t.calls(),1);assert.equal(t.bases(),1);assert.equal(t.events.filter(event=>event==='pending-save-request').length,1);
  assert(t.c.GM.shijiHistory[0].agentReview.reason.includes('actual canonical rejection'));assert(t.c.GM.shijiHistory[0].agentReview.pendingSources.length);
 }finally{t.dispose();}
});
for(const outcome of ['error','deferred','unavailable','empty-queue'])test('background '+outcome+' preserves pending sources and error without re-planning or leaking a live review',async()=>{
 const t=await backgroundBarrierCase();try{
  if(outcome==='unavailable')delete t.c._tmAwaitBackgroundAutosaves;
  t.start();if(outcome!=='unavailable'){await until(t.entered,'save barrier must be entered');t.gate.resolve(outcome==='error'?{ok:false,error:Error('canonical disk write failed')}:outcome==='empty-queue'?{ok:false,skipped:true,reason:'no-background-save'}:{ok:false,deferred:true,reason:'world-transaction-active'});}
  await until(()=>t.c.TM.RecoveryReview.status().length===0,'failed save wait must clean up');
  const row=t.c.GM.shijiHistory[0].agentReview;assert.equal(row.status,'pending');assert.equal(row.verified,false);assert(row.pendingSources.some(source=>source.text===narrative));
  assert(row.reason.includes(outcome==='error'?'canonical disk write failed':outcome==='deferred'?'world-transaction-active':outcome==='empty-queue'?'no-background-save':'保存入口不可用'));
  assert.equal(t.calls(),1);assert.equal(t.bases(),1);assert.equal(t.x.meta.emergencyReview.approved,false);
  assert.equal(t.events.filter(event=>event==='pending-save-request').length,outcome==='unavailable'?0:1,'save failure must not start a new retry cycle');
 }finally{t.dispose();}
});
for(const reason of ['world-lease-unavailable','different-world-save-pending'])test('unaccepted '+reason+' request cannot be treated as a successful empty save queue',async()=>{
 const t=await backgroundBarrierCase();try{let requests=0;t.c.requestBackgroundAutosave=async()=>{requests++;return {ok:false,skipped:true,reason};};
  t.start();await until(()=>t.c.TM.RecoveryReview.status().length===0,'unscheduled request must stop review');
  assert.equal(requests,1);assert.equal(t.entered(),false);assert.equal(t.calls(),1);assert.equal(t.bases(),1);
  const row=t.c.GM.shijiHistory[0].agentReview;assert.equal(row.status,'pending');assert(row.reason.includes(reason));assert(row.pendingSources.length);
 }finally{t.dispose();}
});
test('actual production background queue commits its detached pending evidence before review resumes',async()=>{
 const t=await backgroundBarrierCase(),c=t.c,disk=deferred(),events=[];let writes=0;try{
  load(c,'tm-post-turn-jobs.js');
  const source=fs.readFileSync(path.join(__dirname,'../tm-save-lifecycle.js'),'utf8');
  const start=source.indexOf('function _tmBackgroundSaveLeaseCurrent('),end=source.indexOf('function _tmNewDesktopAutoSaveSessionToken(',start);assert(start>=0&&end>start);
  vm.runInContext('var _backgroundSavePending=null,_backgroundSaveInFlight=null,_backgroundSaveTimer=null,_backgroundSaveSequence=0,_BACKGROUND_SAVE_MAX_ATTEMPTS=2;\n'+source.slice(start,end),c,{filename:'tm-save-lifecycle.js background queue'});
  c.isWorldTransactionActive=()=>!!c.GM._endTurnCommitPending;c._buildSaveState=()=>{events.push('capture');return JSON.parse(JSON.stringify({GM:c.GM,P:c.P}));};
  c._tmAdoptCommittedWorldSnapshot=()=>{events.push('adopt');return true;};c._tmRequestDeferredDesktopAutoSaveFlush=()=>events.push('desktop-flush-request');
  c._tmReportDesktopAutoSaveBoundaryError=error=>error;
  c.TM_SaveDB={createCanonicalPayload:async state=>({state,json:JSON.stringify(state)}),saveManyAtomic:async(entries,options)=>{
   assert.deepEqual(Array.from(entries,entry=>entry.id),['autosave','slot_0']);assert(options.writeGuard());writes++;events.push('disk-start');
   const review=entries[0].gameState.GM.shijiHistory[0].agentReview;assert(review.verified||review.pendingSources.some(row=>row.text===narrative));
   if(writes===1)await disk.promise;assert(options.writeGuard());events.push('disk-committed');return true;
  }};
  const realCall=c.callAI;c.callAI=async prompt=>{events.push('model');return realCall(prompt);};
  t.start();await until(()=>writes===1,'real queue must reach its atomic dual-slot writer');
  assert.equal(t.bases(),1);assert.equal(t.calls(),1);assert.equal(c.isWorldTransactionActive(),false);assert(c._backgroundSaveInFlight);
  disk.resolve();await until(()=>c.TM.RecoveryReview.status().length===0,'queue receipt must release review');assert.equal((await c._tmAwaitBackgroundAutosaves()).ok,true);
  assert.equal(t.calls(),2);assert.equal(t.bases(),2);assert(events.indexOf('disk-committed')<events.indexOf('model'));assert(c.GM.shijiHistory[0].agentReview.verified);
 }finally{disk.resolve();t.dispose();}
});
function installActualMemorySave(t, memory){
 const c=t.c,{loadFunctions}=require('./lib-save-commit-boundary');let waits=0,writes=0;
 loadFunctions(c,'tm-endturn-render.js',['_endTurn_startPostTurnMemorySave','_endTurn_saveSnapshot']);
 delete t.x.meta.postTurnMemorySavePromise;
 c._awaitPostTurnJobsForSave=()=>{waits++;t.events.push('memory-wait');return memory.promise;};
 c._buildSaveState=()=>JSON.parse(JSON.stringify({GM:c.GM,P:c.P}));
 c._endTurn_stripCommittedDraftsFromSnapshot=()=>{};c._endTurn_stageTurnData=async()=>{};
 c._endTurn_discardStagedTurnData=async()=>{};c._clearPreEndturnMarkerAfterSave=()=>{};c._updateSaveIndex=()=>{};
 c.localStorage={setItem(){}};c.StateSnapshot={save:async()=>({ok:true})};
 c.TM_SaveDB={createCanonicalPayload:async state=>({state,json:JSON.stringify(state)}),saveManyAtomic:async entries=>{
  assert.deepEqual(Array.from(entries,row=>row.id),['autosave','slot_0']);writes++;t.events.push('main-commit');return true;
 }};
 c.requestBackgroundAutosave=async options=>{t.events.push(options.reason);return {ok:true,scheduled:true};};
 return {waits:()=>waits,writes:()=>writes,save:()=>c._endTurn_saveSnapshot(t.x)};
}
test('actual main save stays nonblocking while final review waits for the single memory producer and its queued save',async()=>{
 const t=await backgroundBarrierCase(),memory=deferred();try{
  const p=installActualMemorySave(t,memory);assert.equal(await p.save(),true);assert.equal(p.writes(),1);assert.equal(p.waits(),1);
  const owner=t.x.meta.postTurnMemorySavePromise;
  assert.equal(t.c._endTurn_startPostTurnMemorySave(t.x,()=>true,t.c.GM.turn),owner,'a second consumer must not create a new retry attempt');
  t.start();await until(()=>t.background(),'background consumer must start');await new Promise(r=>setTimeout(r,10));
  assert.equal(t.calls(),1,'an unresolved SC25c must not overlap the next review basis');assert.equal(t.bases(),1);assert.equal(t.entered(),false);
  assert.equal(t.c.GM._endTurnCommitPending,false);assert.equal(t.c.GM.busy,false);
  memory.resolve();await until(t.entered,'completed memory must be queued before review pending save is drained');
  assert.equal(p.waits(),1);assert.equal(t.calls(),1);assert.equal(t.bases(),1);
  assert(t.events.indexOf('post-turn-memory-complete')<t.events.indexOf('turn-review-pending'));
  assert.deepEqual(JSON.parse(JSON.stringify(await owner)),{ok:true,scheduled:true,turn:t.c.GM.turn},'only a compact receipt is retained');
  t.gate.resolve({ok:true});await t.background();assert.equal(t.calls(),2);assert.equal(t.bases(),2);
  assert(t.c.GM.shijiHistory[0].agentReview.verified);
 }finally{memory.resolve();t.dispose();}
});
test('failed original memory producer is deferred once and never retried or called a verified review',async()=>{
 const t=await backgroundBarrierCase(),memory=deferred();try{
  const p=installActualMemorySave(t,memory);let deferrals=0;
  t.c.TM.Endturn.Validity={defer(_ctx,label,error){deferrals++;assert.equal(label,'后台记忆');assert.equal(error.message,'SC25c actual failure');}};
  assert.equal(await p.save(),true);t.start();await until(()=>t.background(),'review consumer must start');memory.reject(Error('SC25c actual failure'));
  await t.background();assert.equal(p.waits(),1);assert.equal(deferrals,1);assert.equal(t.calls(),1);assert.equal(t.bases(),1);assert.equal(t.entered(),false);
  assert(!t.events.includes('post-turn-memory-complete'));assert.equal(t.events.filter(e=>e==='turn-review-pending').length,1,'persist the new failure once, without retrying the failed memory producer');
  const row=t.c.GM.shijiHistory[0].agentReview;assert.equal(row.verified,false);assert.equal(row.status,'pending');assert(row.reason.includes('SC25c actual failure'));assert(row.pendingSources.length);
  assert.equal((await t.x.meta.postTurnMemorySavePromise).ok,false);assert.equal(t.c.TM.RecoveryReview.status().length,0);
 }finally{memory.resolve();t.dispose();}
});
test('an already saved pending receipt cannot bypass the unresolved original memory producer',async()=>{
 const t=await backgroundBarrierCase(),memory=deferred();try{
  const p=installActualMemorySave(t,memory);assert.equal(await p.save(),true);t.gate.resolve({ok:true});t.start();
  await until(()=>t.background(),'background consumer must start');await new Promise(r=>setTimeout(r,10));
  assert.equal(t.calls(),1,'the old implementation starts a second model attempt before SC25c settles');assert.equal(t.bases(),1);
  memory.resolve();await t.background();assert.equal(p.waits(),1);assert.equal(t.calls(),2);assert(t.c.GM.shijiHistory[0].agentReview.verified);
 }finally{memory.resolve();t.dispose();}
});
for(const kind of ['missing','rejected','rejected-queue','queue-failure'])test('memory barrier '+kind+' preserves pending evidence without a second model attempt',async()=>{
 const t=await backgroundBarrierCase(),memory=deferred();try{
  if(kind==='missing')delete t.x.meta.postTurnMemorySavePromise;
  else if(kind==='rejected'){const rejected=deferred();t.x.meta.postTurnMemorySavePromise=rejected.promise;t.start();await until(()=>t.background(),'consumer must start');rejected.reject(Error('producer promise rejected'));}
  else{
   const p=installActualMemorySave(t,memory);memory.resolve();
   if(kind==='rejected-queue')t.c.requestBackgroundAutosave=async()=>({ok:false,reason:'different-world-save-pending'});
   else t.gate.resolve({ok:false,error:Error('canonical save failed')});
   assert.equal(await p.save(),true);
  }
  if(kind!=='rejected')t.start();await until(()=>t.background(),'consumer must be installed');await t.background();
  assert.equal(t.calls(),1);assert.equal(t.bases(),1);assert.equal(t.c.TM.RecoveryReview.status().length,0);
  const row=t.c.GM.shijiHistory[0].agentReview;assert.equal(row.verified,false);assert(row.pendingSources.length);
  assert(row.reason.includes(kind==='missing'?'缺少本回合':kind==='rejected'?'producer promise rejected':kind==='rejected-queue'?'different-world-save-pending':'canonical save failed'));
 }finally{memory.resolve();t.dispose();}
});
for(const change of ['load-generation','world','player-state','turn','api','busy','cancel','signal'])test('waiting on the existing memory producer settles on '+change+' without waiting for its unresolved response',async()=>{
 const t=await backgroundBarrierCase(),memory=deferred();try{
  t.x.meta.postTurnMemorySavePromise=memory.promise;t.start();await until(()=>t.background(),'memory consumer must start');const old=t.c.GM;
  if(change==='load-generation')t.c._tmLoadGen=(t.c._tmLoadGen||0)+1;
  else if(change==='world')t.c.GM=Object.assign({},old,{shijiHistory:[]});
  else if(change==='player-state')t.c.P=Object.assign({},t.c.P);
  else if(change==='turn')t.c.GM.turn++;
  else if(change==='api')t.c.P.ai=Object.assign({},t.c.P.ai,{model:'changed-model'});
  else if(change==='busy')t.c.GM.busy=true;
  else if(change==='signal')t.abort();
  else t.c.TM.RecoveryReview.cancel(t.x);
  // Reuse the production review's existing 500ms validity monitor; no new timer owner.
  let timer;try{await Promise.race([t.background(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('invalidated memory wait did not settle')),1500);})]);}finally{clearTimeout(timer);}
  assert.equal(t.calls(),1);assert.equal(t.bases(),1);assert.equal(t.entered(),false);assert.equal(t.c.TM.RecoveryReview.status().length,0);
  assert.equal(t.events.filter(e=>e==='pending-save-request').length,0);
  memory.resolve({ok:true,scheduled:true});await new Promise(r=>setTimeout(r,5));assert.equal(t.calls(),1,'late completion must not restart the retired review');
 }finally{memory.resolve();t.dispose();}
});
test('actual producer with no required jobs still completes through the existing save boundary',async()=>{
 const t=await backgroundBarrierCase(),memory=deferred();try{
  const p=installActualMemorySave(t,memory);load(t.c,'tm-post-turn-jobs.js');const actualWait=t.c._awaitPostTurnJobsForSave;let waits=0;
  t.c._awaitPostTurnJobsForSave=ids=>{waits++;return actualWait(ids);};assert.equal(await p.save(),true);
  assert.equal((await t.x.meta.postTurnMemorySavePromise).ok,true);t.gate.resolve({ok:true});t.start();await until(()=>t.background(),'consumer must start');await t.background();
  assert.equal(waits,1);assert.equal(t.calls(),2);assert.equal(t.bases(),2);assert(t.c.GM.shijiHistory[0].agentReview.verified);
 }finally{memory.resolve();t.dispose();}
});
test('a memory-producer failure is persisted by the real background queue and can be read back with its original sources',async()=>{
 const t=await backgroundBarrierCase(),c=t.c,memory=deferred(),disk=new Map();try{
  const p=installActualMemorySave(t,memory),memoryWait=c._awaitPostTurnJobsForSave;load(c,'tm-post-turn-jobs.js');c._awaitPostTurnJobsForSave=memoryWait;
  const source=fs.readFileSync(path.join(__dirname,'../tm-save-lifecycle.js'),'utf8');
  const start=source.indexOf('function _tmBackgroundSaveLeaseCurrent('),end=source.indexOf('function _tmNewDesktopAutoSaveSessionToken(',start);assert(start>=0&&end>start);
  vm.runInContext('var _backgroundSavePending=null,_backgroundSaveInFlight=null,_backgroundSaveTimer=null,_backgroundSaveSequence=0,_BACKGROUND_SAVE_MAX_ATTEMPTS=2;\n'+source.slice(start,end),c,{filename:'tm-save-lifecycle.js background queue'});
  c.isWorldTransactionActive=()=>!!c.GM._endTurnCommitPending;c._tmAdoptCommittedWorldSnapshot=()=>true;c._tmRequestDeferredDesktopAutoSaveFlush=()=>{};c._tmReportDesktopAutoSaveBoundaryError=error=>error;
  let writes=0,requests=0;const enqueue=c.requestBackgroundAutosave;c.requestBackgroundAutosave=options=>{requests++;return enqueue(options);};
  c.TM_SaveDB.saveManyAtomic=async(entries,options)=>{assert(!options.writeGuard||options.writeGuard());writes++;for(const entry of entries)disk.set(entry.id,JSON.parse(JSON.stringify(entry.gameState)));return true;};
  assert.equal(await p.save(),true);t.start();await until(()=>t.background(),'consumer must wait on real producer');memory.reject(Error('SC25c persisted failure'));
  await t.background();assert.equal((await c._tmAwaitBackgroundAutosaves()).ok,true);
  assert.equal(requests,1);assert.equal(writes,2,'main commit and one pending-failure commit only');assert.equal(p.waits(),1);assert.equal(t.calls(),1);assert.equal(t.bases(),1);
  for(const id of ['autosave','slot_0']){const row=disk.get(id).GM.shijiHistory[0].agentReview;assert.equal(row.status,'pending');assert.equal(row.verified,false);assert(row.reason.includes('SC25c persisted failure'));assert(row.pendingSources.some(source=>source.text===narrative));}
 }finally{memory.resolve();t.dispose();}
});
run(tests);
