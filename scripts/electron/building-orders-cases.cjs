'use strict';
// Ordinary LLM protocol: real UI -> collection -> real transport/JSON parser ->
// full production writeBack. Provider responses are controlled, not model-quality evidence.
const assert=require('assert/strict');
module.exports=async function({win,check}){
  const js=async code=>{const r=await win.webContents.executeJavaScript(`(async()=>{try{return {ok:true,value:await (${code})};}catch(e){return {ok:false,error:String(e.stack||e),detail:JSON.stringify({code:e.code,unapplied:GM._unappliedChanges,last:GM._turnReport&&GM._turnReport.slice(-2)})};}})()`,true);if(!r.ok)throw Error(r.error+' '+r.detail);return r.value;};
  await check('building-orders-production-owner-loaded',async()=>assert.equal(await js(`typeof TM.BuildingOrders.collect==='function' && typeof TM.Endturn.AI.apply.writeBack==='function'`),true));
  async function prepare(){
    await js(`(async()=>{
      TMPhase8FormalBridge.drafts.closeDeskOverlay();TMPhase8FormalBridge.clearEdictDrafts();
      const d={id:'ordinary-region',name:'测试府',buildings:[],economyBase:{commerceVolume:10000},publicTreasury:{money:{stock:100000}}};
      P.ai={key:'controlled-orders-only',url:'https://orders.invalid/v1',model:'gpt-4o',temp:0.2};P.conf=P.conf||{};P.buildingSystem={buildingTypes:[{name:'回执试验书院',category:'cultural',baseCost:5000,buildTime:3,effects:{abs:{'economyBase.commerceVolume':1000}}}]};P.adminHierarchy={player:{divisions:[d]}};
      GM={turn:2,_campaignId:'ordinary-campaign',_timelineId:'ordinary-'+Date.now(),vars:{},chars:[],facs:[],memorials:[],armies:[],guoku:{money:100000,balance:100000},adminHierarchy:P.adminHierarchy};
      window.__orderProbe={requests:[],mode:'approve',div:d};
      _dfBuildModal('测试府');document.querySelector('#_dfBuildModal .tmjz-item').click();
      TMPhase8FormalBridge.drafts.openZhaoPreviewPanel();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      document.querySelector('.tm-desk-overlay .edict-sug-adopt').click();document.querySelectorAll('#_edictAdoptMenu button')[3].click();
      __orderProbe.input=_endTurn_collectInput();TMPhase8FormalBridge.drafts.closeDeskOverlay();
      window.fetch=async function(url,init){
        if(String(url)!=='https://orders.invalid/v1/chat/completions')throw Error('test-external-network-denied');
        const body=JSON.parse(init.body),text=body.messages.map(x=>x.content).join('\\n');
        __orderProbe.requests.push(body);
        if(__orderProbe.mode==='polish')return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'敕于测试府兴建回执试验书院，令有司核办工料、据实兴役。'}}]}),{headers:{'Content-Type':'application/json'}});
        const hit=/"requestId":"(build-[a-zA-Z0-9-]+)"/.exec(text);if(!hit)throw Error('request-lost-building-identity');
        const decision={requestId:hit[1],decision:__orderProbe.mode==='reject'?'reject':'approve',region:'模型重写错的地区',reason:'根据原诏书核办'};
        const output={turn_summary:'核办营造',shizhengji:__orderProbe.mode==='approve'?'国库拨银5000两，回执试验书院已兴工。':'有司具报营造核办结果。',events:[],changes:[],building_decisions:__orderProbe.mode==='missing'?[]:[decision]};
        if(__orderProbe.mode==='bad-core')output.char_updates=[{name:'本测试不存在的人',alive:false}];
        return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]}),{headers:{'Content-Type':'application/json'}});
      };
    })()`);
  }
  async function ordinary(mode){return js(`(async()=>{
    __orderProbe.mode=${JSON.stringify(mode)};
    const ctx={input:__orderProbe.input,prompt:{sc:null},results:{},record:{},apply:{applied:{}},meta:{},followup:{}};
    TM.Endturn.AI.subcalls.setupInfra(ctx);
    const body={model:P.ai.model,messages:[{role:'system',content:'按原诏书核办营造。'},{role:'user',content:(ctx.input.edicts.economic||'')+(ctx.input.edicts.decree||'')+'\\n\\n=== 输出格式强约束 (FINAL RULE·不可违反) ===\\n'+TM.BuildingOrders.prompt(GM,ctx.input.buildingOrders,false)}],temperature:0.2,max_tokens:1500,stream:false};
    const final=TM.Endturn.AI.subcalls.finalizeSc1RequestBody(body,{completionTokens:1500});
    const response=await ctx.subcalls._callEndturnAI(final.body,{id:'sc1',label:'普通营造受控回归',expectedKeys:['building_decisions'],maxRetries:0,repair:false});
    ctx.results.sc1=response.parse.parsed;await TM.Endturn.AI.apply.writeBack(ctx);__orderProbe.ctx=ctx;
    return {calls:__orderProbe.requests.length,mode:TM.Endturn.ModeContract.selectedMode(P),money:GM.guoku.money,stock:GM.guoku.ledgers&&GM.guoku.ledgers.money.stock,buildings:__orderProbe.div.buildings.map(b=>({name:b.name,remaining:b.remainingTurns,orderId:b._buildingOrderId})),order:TM.BuildingOrders.list(GM)[0],shadow:(GM.activeProjects||[]).length};
  })()`);}
  await check('building-ordinary-ui-transport-parser-full-writeback-creates-real-project',async()=>{
    await prepare();const r=await ordinary('approve');assert.equal(r.mode,'llm');assert.equal(r.calls,1);assert.equal(r.money,95000);assert.equal(r.stock,95000);assert.equal(r.buildings.length,1);assert.equal(r.buildings[0].remaining,3);assert.equal(r.buildings[0].orderId,r.order.id);assert.equal(r.order.receipt.committed,true);assert.equal(r.shadow,0);
  });
  await check('building-ordinary-full-writeback-replay-is-idempotent-and-completion-applies-real-effect',async()=>{
    const r=await js(`(async()=>{await TM.Endturn.AI.apply.writeBack(__orderProbe.ctx);const money=GM.guoku.money;for(let i=0;i<3;i++)TM.BuildingWorks.tick(GM,P);return {money,count:__orderProbe.div.buildings.length,status:__orderProbe.div.buildings[0].status,commerce:__orderProbe.div.economyBase.commerceVolume};})()`);
    assert.equal(r.money,95000);assert.equal(r.count,1);assert.equal(r.status,'completed');assert.equal(r.commerce,11000);
  });
  await check('building-ordinary-missing-result-keeps-money-and-surfaces-unresolved-not-shadow-project',async()=>{
    await prepare();const r=await ordinary('missing');assert.equal(r.buildings.length,0);assert.equal(r.money,100000);assert.equal(r.shadow,0);assert.equal(r.order.status,'unresolved');assert(r.order.receipt.reason.includes('未开工'));
  });
  await check('building-ordinary-rejection-does-not-force-construction',async()=>{
    await prepare();const r=await ordinary('reject');assert.equal(r.buildings.length,0);assert.equal(r.money,100000);assert.equal(r.order.status,'rejected');
  });
  await check('building-main-applier-rejection-rolls-back-the-preliminary-payment-and-project',async()=>{
    await prepare();await assert.rejects(()=>ordinary('bad-core'));
    const r=await js(`(()=>({money:GM.guoku.money,buildings:P.adminHierarchy.player.divisions[0].buildings.length,order:TM.BuildingOrders.list(GM)[0].status,committed:TM.BuildingOrders.list(GM)[0].receipt&&TM.BuildingOrders.list(GM)[0].receipt.committed}))()`);
    assert.equal(r.money,100000);assert.equal(r.buildings,0);assert.equal(r.order,'submitted');assert(!r.committed);
    const recovered=await ordinary('approve');assert.equal(recovered.money,95000);assert.equal(recovered.buildings.length,1);
  });
  await check('building-real-polish-promulgation-preserves-binding-without-machine-marker-in-prose',async()=>{
    await prepare();
    const r=await js(`(async()=>{__orderProbe.mode='polish';TMPhase8FormalBridge.drafts.openZhaoPreviewPanel();await _polishEdicts();const ta=document.getElementById('edict-polished-text');if(!ta||!ta.value.includes('回执试验书院'))throw Error('polish-content-missing');const before=GM.guoku.money;_applyPolishedEdict('replace');const e=GM.edicts.find(x=>x.status==='promulgated');__orderProbe.input=_endTurn_collectInput();return{text:e.text,refs:e.buildingOrderRefs,batch:__orderProbe.input.buildingOrders.ids,unchanged:GM.guoku.money===before&&__orderProbe.div.buildings.length===0};})()`);
    assert(!r.text.includes('build-'));assert.equal(r.refs.length,1);assert.equal(r.batch[0],r.refs[0]);assert(r.unchanged);
    const applied=await ordinary('approve');assert.equal(applied.money,95000);assert.equal(applied.buildings[0].orderId,r.refs[0]);
  });
};
