'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const web=path.resolve(__dirname,'..');
const {functionSource}=require('./lib-perf-round1');
const dossier=fs.readFileSync(path.join(web,'phase8-formal-map-dossier.js'),'utf8');
const cards=['bkYeCard','bkYingzao'].map(n=>functionSource(dossier,n)).join('\n');
const sources=['tm-fiscal-engine.js','tm-building-works.js','tm-custom-build-agent.js','tm-building-orders.js','tm-endturn-agent-write-tools.js'].map(f=>[f,fs.readFileSync(path.join(web,f),'utf8')]);
function fixture(){
  const div={id:'region-1',name:'测试府',buildings:[],economyBase:{commerceVolume:10000},publicTreasury:{money:{stock:100000}}};
  const P={conf:{},ai:{},adminHierarchy:{player:{divisions:[div]}}},GM={turn:2,_campaignId:'campaign',_timelineId:'timeline',guoku:{money:100000,balance:100000},_edictSuggestions:[],_edictTracker:[]};
  const c={P,GM,console,Date,Math,Map,Set,WeakMap,crypto:require('crypto').webcrypto,TM:{},addEB(){}};c.window=c;vm.createContext(c);
  sources.forEach(([f,s])=>vm.runInContext(s,c,{filename:f}));
  const BO=c.TM.BuildingOrders;
  const req={name:'崇文馆',category:'cultural',description:'召集学士修订典籍'},ap={costActual:5000,timeActual:3,effectsStructured:{abs:{'economyBase.commerceVolume':1000}},judgedEffects:'藏书育才'};
  const pr=BO.propose(GM,P,'测试府',req,ap,'于测试府兴造崇文馆，造价五千两。');assert(pr.ok);
  GM._edictSuggestions.push({source:'工程',from:'测试府',content:pr.content,buildingOrderId:pr.id,used:false});
  const edicts={economic:pr.content},batch=BO.collect(GM,P,edicts);
  return{c,P,GM,div,BO,req,ap,pr,edicts,batch,order:BO.list(GM)[0],decision(extra={}){return Object.assign({requestId:pr.id,decision:'approve',reason:'有司准行'},extra);},apply(output){return BO.apply(GM,P,batch,output,false);}};
}
let pass=0,fail=0;async function test(name,fn){try{await fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+'\n'+e.stack);}}
(async()=>{
  await test('proposal and collection do not spend or create; authoritative metadata is detached',()=>{
    const f=fixture();assert.equal(f.GM.guoku.money,100000);assert.equal(f.div.buildings.length,0);f.ap.costActual=9;f.req.name='edited';
    assert.equal(f.order.appraisal.costActual,5000);assert.equal(f.order.req.name,'崇文馆');assert(f.BO.prompt(f.GM,f.batch,false).includes(f.pr.id));
  });
  await test('known ID approves without asking model to reproduce region/name/amount; real fiscal ledger and ticking building',()=>{
    const f=fixture(),r=f.apply({building_decisions:[f.decision()]})[0];assert(r.ok&&r.receipt.committed);assert.equal(f.div.buildings.length,1);
    assert.equal(f.GM.guoku.money,95000);assert.equal(f.GM.guoku.money,f.GM.guoku.balance);assert.equal(f.GM.guoku.money,f.GM.guoku.ledgers.money.stock);
    assert.equal(f.div.buildings[0]._buildingOrderId,f.pr.id);assert.equal(f.div.buildings[0].remainingTurns,3);
    for(let i=0;i<3;i++){f.c.TM.BuildingWorks.tick(f.GM,f.P);f.GM.turn++;}
    assert.equal(f.div.buildings[0].status,'completed');assert.equal(f.div.economyBase.commerceVolume,11000);
  });
  await test('legacy structured building_changes normalizes to the same owner once',()=>{
    const f=fixture(),p1={building_changes:[{action:'custom_build',territory:'测试府',type:'崇文馆',costActual:5000,timeActual:3}]};
    assert.equal(f.BO.missing(f.GM,f.P,f.batch,p1).length,0);assert(f.apply(p1)[0].ok);assert.equal(p1.building_changes.length,0);assert.equal(f.GM.guoku.money,95000);
  });
  await test('new ID can survive an AI-miswritten region name',()=>{
    const f=fixture();assert(f.apply({building_decisions:[f.decision({region:'模型写错的地区'})]})[0].ok);assert.equal(f.div.buildings.length,1);
  });
  await test('region rename and tree reorder resolve stable ID, not stale name or array index',()=>{
    const f=fixture();f.div.name='新府名';f.P.adminHierarchy.player.divisions.unshift({id:'other',name:'另府',buildings:[]});
    assert(f.apply({building_decisions:[f.decision()]})[0].ok);assert.equal(f.div.buildings[0].name,'崇文馆');assert.equal(f.P.adminHierarchy.player.divisions[0].buildings.length,0);
  });
  await test('unknown/duplicate region identity never guesses or spends',()=>{
    for(const ambiguous of [false,true]){const f=fixture();if(ambiguous)f.P.adminHierarchy.player.divisions.push({id:'region-1',name:'另一府'});else f.P.adminHierarchy.player.divisions=[];
      assert(!f.apply({building_decisions:[f.decision()]})[0].ok);assert.equal(f.GM.guoku.money,100000);assert.equal(f.div.buildings.length,0);}
  });
  await test('legacy region without ID uses complete semantic path, survives reorder',()=>{
    const f=fixture();delete f.div.id;f.GM._buildingOrders=[];const p=f.BO.propose(f.GM,f.P,'测试府',f.req,f.ap,'营造崇文馆');assert(p.ok);
    const b=f.BO.collect(f.GM,f.P,{economic:p.content});f.P.adminHierarchy.player.divisions.unshift({name:'另一府'});
    assert(f.BO.apply(f.GM,f.P,b,{building_decisions:[{requestId:p.id,decision:'approve'}]},false)[0].ok);assert.equal(f.div.buildings.length,1);
  });
  await test('duplicate-name proposal cannot bind the first region arbitrarily',()=>{
    const f=fixture();f.P.adminHierarchy.player.divisions.push({id:'region-2',name:'测试府'});
    assert.equal(f.BO.propose(f.GM,f.P,'测试府',f.req,f.ap,'新案').ok,false);assert.equal(f.BO.list(f.GM).length,1);
  });
  for(const value of ['defer','reject'])await test(value+' has explicit disposition without spending or constructing',()=>{
    const f=fixture(),r=f.apply({building_decisions:[f.decision({decision:value})]})[0];assert(r.ok);assert(!r.receipt.committed);assert.equal(f.GM.guoku.money,100000);assert.equal(f.div.buildings.length,0);
    f.BO.finish(f.GM,f.P,f.batch,false);assert.equal(f.order.status,value==='defer'?'deferred':'rejected');
  });
  await test('missing/invalid/conflicting dispositions become visible unresolved receipts, not automatic approvals',()=>{
    for(const kind of ['missing','bad','duplicate']){const f=fixture(),rows=kind==='missing'?[]:kind==='bad'?[f.decision({decision:'maybe'})]:[f.decision(),f.decision({decision:'reject'})];
      const r=f.apply({building_decisions:rows})[0];assert(!r.ok);assert.equal(f.order.status,'unresolved');assert.equal(f.div.buildings.length,0);assert.equal(f.GM.guoku.money,100000);assert(f.GM._turnReport.some(x=>x.type==='building_receipt'));}
  });
  await test('unappraised custom work needs real cost and time; cannot default to free instant construction',()=>{
    const f=fixture();f.order.appraisal=null;assert(!f.apply({building_decisions:[f.decision()]})[0].ok);
    assert(f.apply({building_decisions:[f.decision({costActual:5000,timeActual:2})]})[0].ok);assert.equal(f.div.buildings[0].remainingTurns,2);
  });
  await test('invalid expense or period cannot create a project',()=>{
    for(const patch of [{costActual:-1},{costActual:NaN},{timeActual:'bad'}]){const f=fixture();assert(!f.apply({building_decisions:[f.decision(patch)]})[0].ok);assert.equal(f.GM.guoku.money,100000);assert.equal(f.div.buildings.length,0);}
  });
  await test('same response, repeated application and duplicate re-adoption never charge twice',()=>{
    const f=fixture();const p={building_decisions:[f.decision()]};f.apply(p);f.apply(p);assert.equal(f.GM.guoku.money,95000);assert.equal(f.div.buildings.length,1);
    const batch=f.BO.collect(f.GM,f.P,f.edicts);assert.equal(f.BO.missing(f.GM,f.P,batch,{}).length,0);const r=f.BO.apply(f.GM,f.P,batch,{},false)[0];assert(r.ok&&!r.changed);assert.equal(f.GM.guoku.money,95000);
  });
  await test('an unrelated existing same-name building is not claimed as a successful receipt',()=>{
    const f=fixture();f.div.buildings.push({name:'崇文馆',status:'building'});assert(!f.apply({building_decisions:[f.decision()]})[0].ok);assert.equal(f.GM.guoku.money,100000);assert.equal(f.div.buildings.length,1);
  });
  for(const fault of ['throw','false','after-payment','after-building'])await test('transaction '+fault+' restores both treasury and construction state; retry succeeds',()=>{
    const f=fixture(),before=JSON.stringify(f.GM.guoku),original=f.c.FiscalEngine.spendFromGuoku;
    if(fault==='throw')f.c.FiscalEngine.spendFromGuoku=()=>{throw Error('injected');};
    if(fault==='false')f.c.FiscalEngine.spendFromGuoku=()=>({ok:false,reason:'injected'});
    if(fault==='after-payment')f.c.FiscalEngine.spendFromGuoku=(...args)=>{original(...args);throw Error('injected after debit');};
    if(fault==='after-building')f.batch.fault=()=>{throw Error('injected after building');};
    assert(!f.apply({building_decisions:[f.decision()]})[0].ok);assert.equal(JSON.stringify(f.GM.guoku),before);assert.equal(f.div.buildings.length,0);assert(!f.GM._pendingCustomBuilds);
    f.c.FiscalEngine.spendFromGuoku=original;delete f.batch.fault;assert(f.apply({building_decisions:[f.decision()]})[0].ok);assert.equal(f.GM.guoku.money,95000);assert.equal(f.div.buildings.length,1);
  });
  await test('log failure after commitment is not reported as rolled back',()=>{
    const f=fixture();f.c.addEB=()=>{throw Error('log-only');};const r=f.apply({building_decisions:[f.decision()]})[0];assert(r.ok);assert.equal(f.GM.guoku.money,95000);assert.equal(f.div.buildings.length,1);
  });
  await test('original partial-funding policy remains explicit',()=>{
    const f=fixture();f.GM.guoku.money=f.GM.guoku.balance=1000;const r=f.apply({building_decisions:[f.decision()]})[0];assert(r.ok);assert.equal(r.receipt.spent.money,1000);assert.equal(r.receipt.spent.deficit,4000);
  });
  await test('draft deletion, edited draft, and keep-as-manuscript cannot silently issue a construction order',()=>{
    const f=fixture();assert.equal(f.BO.collect(f.GM,f.P,{}).ids.length,0);
    assert.throws(()=>f.BO.collect(f.GM,f.P,{economic:f.pr.content.replace('五千','三千')}),/正文已改/);
    f.GM.edicts=[{turn:2,status:'draft',text:'润色正文',buildingOrderRefs:[f.pr.id],buildingBindingText:'润色正文'}];assert.equal(f.BO.collect(f.GM,f.P,{decree:'润色正文'}).ids.length,0);
  });
  await test('polish retains exact submitted references; changed output/input/world rejects stale hidden metadata',()=>{
    const f=fixture(),binding=f.BO.capturePolish(f.GM,f.P,f.pr.content);binding.text='敕于测试府建崇文馆。';
    assert.equal(f.BO.polishedRefs(f.GM,binding,binding.text,f.pr.content).refs[0],f.pr.id);
    assert(f.BO.polishedRefs(f.GM,binding,'罢建。',f.pr.content).errors.length);assert(f.BO.polishedRefs(f.GM,binding,binding.text,'').errors.length);
    f.GM._timelineId='fork';assert(f.BO.polishedRefs(f.GM,binding,binding.text,f.pr.content).errors.length);
  });
  await test('promulgated polished decree collects references even when prose has no marker',()=>{
    const f=fixture();f.GM.edicts=[{turn:2,status:'promulgated',text:'敕建崇文馆。',buildingOrderRefs:[f.pr.id],buildingBindingText:'敕建崇文馆。'}];
    const batch=f.BO.collect(f.GM,f.P,{decree:'敕建崇文馆。'});assert.equal(batch.ids[0],f.pr.id);assert(f.BO.apply(f.GM,f.P,batch,{building_decisions:[f.decision()]},false)[0].ok);
  });
  for(const change of ['GM','P','timeline','generation','turn'])await test('late '+change+' response cannot change the current world',()=>{
    const f=fixture();let g=f.GM,p=f.P;if(change==='GM')g=JSON.parse(JSON.stringify(g));if(change==='P')p=JSON.parse(JSON.stringify(p));
    if(change==='timeline')g._timelineId='new';if(change==='generation')f.c._tmLoadGen=1;if(change==='turn')g.turn++;
    const r=f.BO.apply(g,p,f.batch,{building_decisions:[f.decision()]},false)[0];assert(!r.ok);assert.equal(g.guoku.money,100000);assert.equal(f.div.buildings.length,0);
  });
  await test('unissued foreign request ID is not an authority to build',()=>{
    const f=fixture(),r=f.BO.execute(f.GM,f.P,f.batch,f.decision({requestId:'build-foreign'}),false);assert(!r.ok);assert.equal(f.div.buildings.length,0);
  });
  await test('save/load and timeline fork re-collect the decree; committed receipt remains idempotent',()=>{
    const f=fixture();f.apply({building_decisions:[f.decision()]});const g=JSON.parse(JSON.stringify(f.GM)),p=JSON.parse(JSON.stringify(f.P));g._timelineId='loaded-fork';
    const b=f.BO.collect(g,p,f.edicts),r=f.BO.apply(g,p,b,{},false)[0];assert(r.ok&&!r.changed);assert.equal(g.guoku.money,95000);assert.equal(p.adminHierarchy.player.divisions[0].buildings.length,1);
  });
  await test('explicit duplicate payment/project deltas are removed; unrelated state remains',()=>{
    const f=fixture(),p={fiscal_adjustments:[{requestId:f.pr.id,amount:5000},{amount:900,reason:'正常俸饷'}],project_updates:[{requestId:f.pr.id,name:'崇文馆'}]};
    f.BO.protectOutput(f.GM,f.P,f.batch,p);assert.equal(p.fiscal_adjustments.length,1);assert.equal(p.fiscal_adjustments[0].amount,900);assert.equal(p.project_updates.length,0);
    assert(f.BO.manages(f.GM,'崇文馆','测试府',f.batch));assert(!f.BO.manages(f.GM,'别的项目','测试府',f.batch));
  });
  await test('real Agent tool consumes same collected request and accounts for engine-first turn increment',async()=>{
    const f=fixture();f.GM.turn++;const ctx={GM:f.GM,input:{buildingOrders:f.batch,_agentModeSelected:true}};
    let r=await f.c.TM.Endturn.AgentWriteTools.handle('building_project',f.decision(),ctx);assert(r.ok);assert.equal(f.GM.guoku.money,95000);
    r=await f.c.TM.Endturn.AgentWriteTools.handle('building_project',f.decision(),ctx);assert(r.ok&&!r.changed);assert.equal(f.div.buildings.length,1);
  });
  await test('main-applier failure rolls back preliminary order, even after P/GM tree clones were restored',()=>{
    const f=fixture(),tx=f.BO.begin(f.GM,f.P,f.batch);f.apply({building_decisions:[f.decision()]});assert.equal(f.GM.guoku.money,95000);
    assert(!f.GM._turnReport);f.P.adminHierarchy=JSON.parse(JSON.stringify(f.P.adminHierarchy));f.GM.adminHierarchy=JSON.parse(JSON.stringify(f.P.adminHierarchy));
    tx.rollback();assert.equal(f.GM.guoku.money,100000);assert.equal(f.P.adminHierarchy.player.divisions[0].buildings.length,0);assert.equal(f.GM.adminHierarchy.player.divisions[0].buildings.length,0);assert.equal(f.BO.list(f.GM)[0].status,'submitted');
    const tx2=f.BO.begin(f.GM,f.P,f.batch);tx2.rollback();
  });
  await test('same-world concurrent preliminary write is rejected and release permits retry',()=>{
    const f=fixture(),tx=f.BO.begin(f.GM,f.P,f.batch);assert.throws(()=>f.BO.begin(f.GM,f.P,f.batch),/并发/);tx.rollback();const second=f.BO.begin(f.GM,f.P,f.batch);second.commit();
  });
  await test('consistency gate accepts real receipts, rejects forged receipts and false success narrative',()=>{
    const f=fixture();assert(!f.BO.verifyReceipts(f.GM,f.P,[{requestId:f.pr.id,committed:true}],''));
    let r=f.apply({building_decisions:[]})[0];assert(f.BO.verifyReceipts(f.GM,f.P,[r.receipt],'崇文馆待核办'));assert(!f.BO.verifyReceipts(f.GM,f.P,[r.receipt],'崇文馆已开工'));
    r=f.apply({building_decisions:[f.decision()]})[0];assert(f.BO.verifyReceipts(f.GM,f.P,[r.receipt],'崇文馆已开工'));assert(!f.BO.verifyReceipts(f.GM,f.P,[{...r.receipt,buildingName:'伪造'}],''));
  });
  await test('unresolved receipt appears in the actual existing yingzao dossier, not as a completed building',()=>{
    const f=fixture();f.apply({building_decisions:[]});Object.assign(f.c,{esc:String,attr:String,firstValue:(...xs)=>xs.find(x=>x!=null&&x!==''),hasDisplayValue:x=>x!=null&&x!=='',compactText:String});vm.runInContext(cards,f.c);
    const html=f.c.bkYingzao({name:'测试府'},{liveDivision:f.div});assert(html.includes('崇文馆')&&html.includes('未 开 工')&&html.includes('未给出有效裁定'));assert(!html.includes('工 役 中'));
  });
  await test('corrupt/duplicate order identities are retained and rejected, not replaced or guessed',()=>{
    const f=fixture(),bad={preserve:'old data'};f.GM._buildingOrders=bad;assert(!f.BO.propose(f.GM,f.P,'测试府',f.req,f.ap,'text').ok);assert.equal(f.GM._buildingOrders,bad);
    f.GM._buildingOrders=[f.order,JSON.parse(JSON.stringify(f.order))];assert.throws(()=>f.BO.collect(f.GM,f.P,f.edicts),/不属于/);assert.equal(f.GM._buildingOrders.length,2);
  });
  console.log(JSON.stringify({pass,fail,skip:0,waived:0}));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
