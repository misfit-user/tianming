'use strict';
// Real production renderer/main/preload, public official scenario, detached local
// save files and controlled HTTP responses. DOM clicks below are integration
// tests; --relief-inspect separately records actual trusted mouse input.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
module.exports=async function({win,temp,check,mode}){
  const js=async s=>{
    const r=await win.webContents.executeJavaScript(`(async()=>{try{return {ok:true,value:await (${s})};}catch(e){return {ok:false,error:String(e.stack||e)};}})()`,true);
    if(!r.ok)throw new Error(r.error);return r.value;
  };
  const small=process.env.TM_RELIEF_SMALL_FIXTURE==='1';
  const sid=small?'relief-ui-fixture':process.env.TM_RELIEF_SCENARIO || 'sc-jianyan1-1127-shaosong';
  async function dismissGuides(){
    await js(`(async()=>{await new Promise(r=>setTimeout(r,700));
      const guide=document.getElementById('tm-firstturn-guide');if(guide)Array.from(guide.querySelectorAll('button')).find(b=>b.textContent==='开始临朝')?.click();
      TM_Changelog.markRead();TM_Changelog.close();
      Array.from(document.querySelectorAll('button')).filter(b=>b.textContent.trim()==='知道了').forEach(b=>b.click());
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true;
    })()`);
  }
  await check(small?'relief-controlled-small-world-and-real-providers':'relief-official-new-game-and-real-providers',async()=>{
    const result=await js(`(async()=>{
      if(P.ai&&P.ai.key)throw Error('unexpected-player-credential');
      ${small?`GM={sid:'relief-ui-fixture',turn:1,running:false,_campaignId:'isolated-relief-ui',_timelineId:'isolated-relief-ui-t',
        guoku:{money:100000,balance:100000},neitang:{money:30000,balance:30000},regions:[{id:'r1',name:'河东',minxin:50,population:10000}],
        fiscal:{regions:{r1:{ledgers:{money:20000},ledgerAudit:{}}}},chars:[{id:'c1',name:'王明',officialTitle:'承办甲',ability:80},{id:'c2',name:'王明',officialTitle:'承办乙',ability:40}],
        currentIssues:[],_edictTracker:[],transferOrders:[],facs:[],classes:[],minxin:{trueIndex:50,perceivedIndex:50}};`
        :`await TMOfficialScenarioLoader.ensure(${JSON.stringify(sid)});P.conf.fixedSeed='relief-regression';doActualStart(${JSON.stringify(sid)});await _tmAwaitLoadBarrier();`}
      await TM_Changelog.getUnreadCount();TM_Changelog.markRead();
      const initiallyLoaded=!!TM.ReliefGovernance;
      openShizhengTasks();await TM.Features.ensureRecoverable('reliefGovernance');
      window.__reliefTest={before:GM.guoku.money,requests:0,sid:GM.sid};
      const rs=TM.ReliefGovernance.regions(GM),cs=GM.chars.filter(c=>c.id&&!c.dead&&c.alive!==false&&!c.retired);
      __reliefTest.region=rs[0]?.id;__reliefTest.officer=cs[0]?.id;
      return {sid:GM.sid,regions:rs.length,officers:cs.length,enabled:TM.ReliefGovernance.enabled(GM),initiallyLoaded,
        providers:[typeof FiscalEngine.commitReliefPayment,typeof TM.MinxinLedger.recordAndApply,typeof TM.EdictOversight.run,typeof fullLoadGame]};
    })()`);
    assert.equal(result.sid,sid);assert(result.regions>0&&result.officers>0);assert.equal(result.enabled,false);assert.equal(result.initiallyLoaded,false);assert.deepEqual(result.providers,Array(4).fill('function'));
  });
  await dismissGuides();
  await js(`(()=>{openShizhengTasks();return true;})()`);win.show();
  await check('relief-entry-is-not-covered-by-onboarding-or-changelog',async()=>{
    const result=await js(`(()=>{const b=document.querySelector('[data-relief-action=toggle]'),r=b.getBoundingClientRect(),t=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {hit:t===b||b.contains(t),top:t?.id||t?.className};})()`);
    assert.equal(result.hit,true,JSON.stringify(result));
  });
  if(mode==='relief-inspect'){
    win.setTitle('天命 · 赈务试点隔离鼠标测试');
    await js(`(()=>{window.__reliefMouse=[];document.addEventListener('click',e=>{if(!e.isTrusted)return;const label=e.target.closest('button')?.textContent||e.target.tagName;setTimeout(()=>{__reliefMouse.push({at:performance.now(),label,cases:TM.ReliefGovernance.active(GM).map(i=>{const v=TM.ReliefGovernance.view(GM,i.id);return{id:i.id,status:v.status,funded:v.funded,disbursed:v.disbursed,assignee:v.assigneeName};})});},0);},true);return true;})()`);
    console.log('RELIEF_MOUSE_READY '+sid);
    let last=[];
    const observe=setInterval(async()=>{try{last=await js('window.__reliefMouse||[]');fs.writeFileSync(path.join(temp,'relief-mouse.json'),JSON.stringify(last,null,2));}catch(_){}},1500);
    await new Promise(resolve=>win.on('closed',resolve));clearInterval(observe);
    console.log('RELIEF_MOUSE_EVENTS '+JSON.stringify(last));return;
  }
  await check('relief-real-list-toggle-and-form-cancel',async()=>{
    const r=await js(`(()=>{document.querySelector('[data-relief-action=toggle]').click();document.querySelector('[data-relief-action=create]').click();const f=document.querySelector('[data-relief-form]');const before=GM.currentIssues.length;Array.from(f.querySelectorAll('button')).find(b=>b.textContent==='暂不立案').click();return {enabled:TM.ReliefGovernance.enabled(GM),cancelled:!document.querySelector('[data-relief-form]'),unchanged:before===GM.currentIssues.length};})()`);
    assert.deepEqual(r,{enabled:true,cancelled:true,unchanged:true});
  });
  await check('relief-freeform-create-real-buttons-no-premature-debit',async()=>{
    const r=await js(`(()=>{document.querySelector('[data-relief-action=create]').click();const f=document.querySelector('[data-relief-form]');f.elements.regionId.value=__reliefTest.region;f.elements.assigneeId.value=__reliefTest.officer;f.elements.amount.value='100';f.elements.deadlineDays.value='60';f.elements.edictText.value='赈济灾民，先核户再发银。保留自由旨意 😀 <script>不是代码</script>';f.requestSubmit();const i=TM.ReliefGovernance.active(GM).slice(-1)[0];__reliefTest.id=i?.id;return {created:!!i,budget:i?.relief.budget,money:GM.guoku.money,detail:!!document.querySelector('[data-relief-detail]'),unsafe:!!document.querySelector('[data-relief-detail] script')};})()`);
    assert.equal(r.created,true);assert.equal(r.budget,100);assert.equal(r.money,await js('__reliefTest.before'));assert.equal(r.detail,true);assert.equal(r.unsafe,false);
  });
  await check('relief-real-funding-button-and-canonical-ledger',async()=>{
    const r=await js(`(()=>{document.querySelector('[data-relief-action=fund]').click();const v=TM.ReliefGovernance.view(GM,__reliefTest.id);return {funded:v.funded,disbursed:v.disbursed,balance:GM.guoku.balance,money:GM.guoku.money,stock:GM.guoku.ledgers.money.stock,before:__reliefTest.before};})()`);
    assert.equal(r.funded,100);assert.equal(r.disbursed,0);assert.equal(r.money,r.before-100);assert.equal(r.money,r.balance);assert.equal(r.money,r.stock);
  });
  await check('relief-real-system-turn-advances-days-without-legacy-double-delivery',async()=>{
    const r=await js(`(async()=>{closeShizhengTasks();const id=__reliefTest.id,old=GM.turn;await _endTurn_updateSystems(getTimeRatio(),'受控回归：核对赈务，未调用主推演 API。');const v=TM.ReliefGovernance.view(GM,id);__reliefTest.afterSystems=GM.guoku.money;return {before:old,after:GM.turn,days:v.elapsedDays,expected:_getDaysPerTurn(),disbursed:v.disbursed,funded:v.funded};})()`);
    assert.equal(r.after,r.before+1);assert.equal(r.days,r.expected);assert.equal(r.disbursed,0);assert.equal(r.funded,100);
  });
  await check('relief-real-AI-transport-and-guarded-partial-outcome',async()=>{
    const r=await js(`(async()=>{
      P.ai={key:'isolated-relief-fixture',url:'https://relief.invalid/v1',model:'gpt-4o'};
      window.__reliefFetchOriginal=window.fetch;window.fetch=async function(url,opts){
        if(!String(url).startsWith('https://relief.invalid/'))throw Error('test-external-network-denied');
        __reliefTest.requests++;const a=TM.EdictOversight.activeEdicts(GM).find(a=>a.relief?.issueId===__reliefTest.id);
        const content=JSON.stringify({reports:[{oid:a.oid,relief:{caseId:a.relief.issueId,revision:a.relief.revision,action:'disburse',amount:40,minxinDelta:0,reason:'已核清一批灾户，先行发放，余户仍待核实。',officialReport:'首批赈银已发，余项待核。',nextAdvice:'可以核对呈报或改派接办。'}}]});
        return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content}}]}),{headers:{'Content-Type':'application/json'}});
      };
      const outcome=await TM.EdictOversight.run(GM);const v=TM.ReliefGovernance.view(GM,__reliefTest.id);return {ok:outcome.ok,requests:__reliefTest.requests,disbursed:v.disbursed,remaining:v.remaining,money:GM.guoku.money,before:__reliefTest.afterSystems};
    })()`);
    assert.equal(r.ok,true);assert.equal(r.requests,1);assert.equal(r.disbursed,40);assert.equal(r.remaining,60);assert.equal(r.money,r.before);
  });
  await check('relief-detached-idb-and-project-save-contain-case-and-receipts',async()=>{
    const r=await js(`(()=>{function graph(){const seen=new WeakMap();let seq=0;return JSON.stringify({GM,P},function(k,v){if(v&&typeof v==='object'){if(seen.has(v))return {$ref:seen.get(v)};seen.set(v,seq++);}return typeof v==='function'?String(v):v;});}const before=graph(),g=GM,p=P;const a=_buildSaveState({format:'idb',detach:true}),b=_buildSaveState({format:'project',detach:true});const id=__reliefTest.id;const extract=x=>({case:x.currentIssues.find(i=>i.id===id).relief,orders:x.transferOrders.filter(o=>o.reliefCaseId===id)});const expected=JSON.stringify(extract(GM));__reliefTest.save=b;return {idb:JSON.stringify(extract(a.GM))===expected,project:JSON.stringify(extract(b.gameState))===expected,live:g===GM&&p===P&&before===graph()};})()`);
    assert.deepEqual(r,{idb:true,project:true,live:true});
  });
  await check('relief-real-IPC-save-load-and-full-world-recovery',async()=>{
    const r=await js(`(async()=>{const name='赈务隔离回归',id=__reliefTest.id,payload=__reliefTest.save;const s=await tianming.saveProject(name,payload);if(!s.success)throw Error(s.error||'save failed');const l=await tianming.loadProject(name);if(!l.success)throw Error(l.error||'load failed');await fullLoadGame(l.data);await _tmAwaitLoadBarrier();const v=TM.ReliefGovernance.view(GM,id);return {funded:v.funded,disbursed:v.disbursed,remaining:v.remaining,enabled:TM.ReliefGovernance.enabled(GM),forked:GM._timelineId!==payload.gameState._timelineId};})()`);
    assert.deepEqual(r,{funded:100,disbursed:40,remaining:60,enabled:true,forked:true});
  });
  await check('relief-recovered-real-cancel-refunds-only-the-unspent-balance',async()=>{
    const r=await js(`(()=>{const before=GM.guoku.money;_openShizhengDetail(__reliefTest.id);document.querySelector('[data-relief-action=cancel]').click();const v=TM.ReliefGovernance.view(GM,__reliefTest.id);return{status:v.status,refunded:v.refunded,disbursed:v.disbursed,increase:GM.guoku.money-before};})()`);
    assert.deepEqual(r,{status:'cancelled',refunded:60,disbursed:40,increase:60});
  });
  await dismissGuides();
  await js(`(async()=>{await _tmAwaitBackgroundAutosaves();_openShizhengDetail(__reliefTest.id);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
  await check('relief-visible-detail-and-bounded-history',async()=>{
    const r=await js(`(()=>{const box=document.querySelector('[data-relief-detail]'),b=box.getBoundingClientRect(),s=getComputedStyle(box),t=document.elementFromPoint(b.x+20,b.y+20);return{width:b.width,height:b.height,display:s.display,text:box.textContent,lazy:!box.querySelector('details').dataset.built,hit:t===box||box.contains(t)};})()`);
    assert(r.width>0&&r.height>0&&r.display!=='none');assert.equal(r.hit,true);assert(r.text.includes('已撤止'));assert.equal(r.lazy,true);
  });
  fs.writeFileSync(path.join(temp,'relief-final.png'),(await win.webContents.capturePage()).toPNG());
  console.log('RELIEF_ELECTRON_SCENARIO '+sid);
};
