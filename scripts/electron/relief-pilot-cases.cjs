'use strict';
// Real official games, production renderer/main/preload; UI events here are
// automated integration tests, not a claim of a completed manual mouse session.
const assert=require('assert/strict'),fs=require('fs'),path=require('path');
module.exports=async function({win,temp,check,mode}){
  const js=async s=>{const r=await win.webContents.executeJavaScript(`(async()=>{try{return {ok:true,value:await (${s})};}catch(e){return {ok:false,error:String(e.stack||e)};}})()`,true);if(!r.ok)throw Error(r.error);return r.value;};
  const sid=process.env.TM_RELIEF_SCENARIO || 'sc-jianyan1-1127-shaosong';
  async function guides(){await js(`(async()=>{await new Promise(r=>setTimeout(r,700));const g=document.getElementById('tm-firstturn-guide');if(g)Array.from(g.querySelectorAll('button')).find(b=>b.textContent==='开始临朝')?.click();TM_Changelog.markRead();TM_Changelog.close();Array.from(document.querySelectorAll('button')).filter(b=>b.textContent.trim()==='知道了').forEach(b=>b.click());await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true;})()`);}
  await check('relief-official-world-and-lazy-read-only-providers',async()=>{
    const r=await js(`(async()=>{if(P.ai&&P.ai.key)throw Error('unexpected-player-key');await TMOfficialScenarioLoader.ensure(${JSON.stringify(sid)});P.conf.fixedSeed='relief-channels';doActualStart(${JSON.stringify(sid)});await _tmAwaitLoadBarrier();const lazy=!TM.ReliefGovernance,ensure=TM.Features.ensureRecoverable;let requests=0;TM.Features.ensureRecoverable=function(name){if(name==='reliefGovernance')requests++;return ensure.apply(this,arguments);};try{openShizhengTasks();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}finally{TM.Features.ensureRecoverable=ensure;}const autoLoaded=!!TM.ReliefGovernance;await TM.Features.ensureRecoverable('reliefGovernance');window.__reliefTest={text:'赈济灾民，先核灾户、据实具奏，不得以奉旨充作办成。 😀 <script>非代码</script>'};return {sid:GM.sid,lazy,requests,autoLoaded,write:typeof TM.ReliefGovernance.create,payment:typeof FiscalEngine.commitReliefPayment};})()`);
    assert.equal(r.sid,sid);assert.equal(r.lazy,true);assert.equal(r.requests,0);assert.equal(r.autoLoaded,false);assert.equal(r.write,'undefined');assert.equal(r.payment,'undefined');
  });
  await guides();await js('(()=>{openShizhengTasks();return true;})()');win.show();
  await check('relief-register-is-absent-even-with-preloaded-providers',async()=>{
    const r=await js(`(()=>{const p=document.getElementById('shizheng-tasks-overlay');return {exists:!!p,retired:p.querySelectorAll('[data-relief-register],[data-relief-channel],[data-relief-form]').length,text:p.textContent};})()`);
    assert.equal(r.exists,true);assert.equal(r.retired,0);assert(!r.text.includes('履行单'));
  });
  if(mode==='relief-inspect'){win.setTitle('天命 · 原渠道履行单隔离测试');console.log('RELIEF_MOUSE_READY '+sid);await new Promise(r=>win.on('closed',r));return;}
  await check('relief-navigation-opens-the-actual-edict-screen-without-submitting',async()=>{
    const r=await js(`(async()=>{const n=GM._edictTracker.length;closeShizhengTasks();openZhao();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const input=document.querySelector('#tm-action-edict-overlay #edict-eco');input.value=__reliefTest.text;input.dispatchEvent(new Event('input',{bubbles:true}));return{input:!!input,same:n===GM._edictTracker.length};})()`);
    assert.deepEqual(r,{input:true,same:true});
    console.log('RELIEF_DRAFT_AFTER_INPUT '+JSON.stringify(await js(`(()=>({fields:Array.from(document.querySelectorAll('#edict-eco')).map(e=>({value:e.value,connected:e.isConnected,overlay:!!e.closest('.tm-desk-overlay')})),drafts:TM_PHASE8_FORMAL.edictDrafts}))()`)));
  });
  await check('relief-closing-draft-and-viewing-register-preserves-draft-and-world',async()=>{
    const r=await js(`(()=>{TMPhase8FormalBridge.drafts.closeDeskOverlay();function graph(){const seen=new WeakMap();let seq=0;return JSON.stringify({GM,P},function(k,v){if(v&&typeof v==='object'){if(seen.has(v))return {$ref:seen.get(v)};seen.set(v,seq++);}return typeof v==='function'?String(v):v;});}__reliefTest.graph=graph;const before=graph();openShizhengTasks();const unchanged=before===graph();closeShizhengTasks();openZhao();return{unchanged,draft:document.querySelector('#tm-action-edict-overlay #edict-eco').value};})()`);
    console.log('RELIEF_DRAFT_AFTER_REOPEN '+JSON.stringify(r));
    assert.equal(r.unchanged,true);assert.equal(r.draft,await js('__reliefTest.text'));
  });
  await check('relief-original-turn-collection-not-viewing-register-creates-the-edict',async()=>{
    const r=await js(`(()=>{const input=_endTurn_collectInput();const e=GM._edictTracker.find(x=>x.content===__reliefTest.text);if(!e)throw Error('missing-original-edict');__reliefTest.edictId=e.id;TMPhase8FormalBridge.drafts.closeDeskOverlay();const before=__reliefTest.graph();openShizhengTasks();const result=TM.ReliefGovernance.list(GM,{reliefOnly:false});return{input:input.edicts.economic,exists:result.entries.some(x=>x.sourceId===e.id),unchanged:before===__reliefTest.graph()};})()`);
    assert.equal(r.input,await js('__reliefTest.text'));assert.equal(r.exists,true);assert.equal(r.unchanged,true);
  });
  await check('populated-relief-sources-do-not-recreate-the-removed-UI',async()=>{
    const r=await js(`(()=>{const before=__reliefTest.graph();openShizhengTasks();const p=document.getElementById('shizheng-tasks-overlay');return {same:before===__reliefTest.graph(),retired:document.querySelectorAll('[data-relief-register],[data-relief-channel]').length,text:p.textContent,source:GM._edictTracker.find(e=>e.id===__reliefTest.edictId)?.content};})()`);
    assert.equal(r.same,true);assert.equal(r.retired,0);assert(!r.text.includes('履行单'));assert.equal(r.source,await js('__reliefTest.text'));
  });
  await check('relief-real-memorial-approval-keeps-stage-and-commit-timing',async()=>{
    const r=await js(`(()=>{const ch=GM.chars.find(c=>c.alive!==false&&!c.isPlayer&&c.name);const m={id:'isolated-channel-memo',from:ch.name,content:'请核河东灾户后赈济',type:'常务',turn:GM.turn,status:'pending',reply:''};GM.memorials.push(m);__reliefTest.memoId=m.id;_stageMemorialDecision(m,'approved','先核实，不许虚报');let e=TM.ReliefGovernance.list(GM).entries.find(x=>x.sourceId===m.id);const pending=e.status;_commitMemorialDecisions();e=TM.ReliefGovernance.list(GM).entries.find(x=>x.sourceId===m.id);return{pending,after:e.status,reply:e.reply};})()`);
    assert(r.pending.includes('待过回合提交'));assert(r.after.includes('已提交，非已办成'));assert.equal(r.reply,'先核实，不许虚报');
  });
  await check('relief-existing-AI-transport-updates-only-original-feedback',async()=>{
    const r=await js(`(async()=>{P.ai={key:'isolated-channel-fixture',url:'https://relief.invalid/v1',model:'gpt-4o'};const original=window.fetch;let calls=0;const before=JSON.stringify({money:GM.guoku,orders:GM.transferOrders,minxin:GM.minxin});window.fetch=async(url)=>{if(!String(url).startsWith('https://relief.invalid/'))throw Error('test-external-network-denied');calls++;const a=TM.EdictOversight.activeEdicts(GM).find(a=>a._entry.id===__reliefTest.edictId);const content=JSON.stringify({reports:[{oid:a.oid,status:'partial',executionLevel:20,reason:'核户仍在进行，尚不能证明赈银到户。',nextAdvice:'请循鸿雁问讯承办进展。'}]});return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content}}]}),{headers:{'Content-Type':'application/json'}});};try{const out=await TM.EdictOversight.run(GM);const e=TM.ReliefGovernance.list(GM).entries.find(e=>e.sourceId===__reliefTest.edictId);return{ok:out.ok,calls,progress:e.progress,unchanged:before===JSON.stringify({money:GM.guoku,orders:GM.transferOrders,minxin:GM.minxin})};}finally{window.fetch=original;P.ai.key='';}})()`);
    assert.deepEqual(r,{ok:true,calls:1,progress:20,unchanged:true});
  });
  await check('relief-idb-project-detached-snapshots-preserve-original-documents',async()=>{
    const r=await js(`(()=>{const before=__reliefTest.graph();const a=_buildSaveState({format:'idb',detach:true}),b=_buildSaveState({format:'project',detach:true});const pick=g=>JSON.stringify({edict:g._edictTracker.find(e=>e.id===__reliefTest.edictId),memo:g.memorials.find(m=>m.id===__reliefTest.memoId)});__reliefTest.save=b;return{idb:pick(a.GM)===pick(GM),project:pick(b.gameState)===pick(GM),live:before===__reliefTest.graph()};})()`);
    assert.deepEqual(r,{idb:true,project:true,live:true});
  });
  await check('relief-real-IPC-save-load-restores-source-records-not-a-second-case',async()=>{
    const r=await js(`(async()=>{closeShizhengTasks();const before=GM._timelineId,s=await tianming.saveProject('原渠道履行单隔离回归',__reliefTest.save);if(!s.success)throw Error(s.error);const l=await tianming.loadProject('原渠道履行单隔离回归');if(!l.success)throw Error(l.error);await fullLoadGame(l.data);await _tmAwaitLoadBarrier();const data=TM.ReliefGovernance.list(GM);return{edict:data.entries.some(e=>e.sourceId===__reliefTest.edictId),memo:data.entries.some(e=>e.sourceId===__reliefTest.memoId),fork:GM._timelineId!==before,standalone:GM.currentIssues.some(i=>i.relief)};})()`);
    assert.deepEqual(r,{edict:true,memo:true,fork:true,standalone:false});
  });
  await guides();await js('(()=>{openShizhengTasks();return true;})()');
  await check('world-switch-still-invalidates-old-source-handles-without-recreating-a-card',async()=>{
    const r=await js(`(()=>{const old=GM,entry=TM.ReliefGovernance.list(GM).entries[0];GM=Object.assign({},old,{_timelineId:'isolated-other-world'});const result=TM.ReliefGovernance.resolve(GM,entry);openShizhengTasks();const retired=!!document.querySelector('[data-relief-register]');GM=old;return {ok:result.ok,retired};})()`);
    assert.deepEqual(r,{ok:false,retired:false});
  });
  await js('(async()=>{openShizhengTasks();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true;})()');
  await check('original-issue-panel-remains-usable-without-the-extra-card',async()=>{
    const r=await js(`(()=>{const p=document.getElementById('shizheng-tasks-overlay'),b=p.querySelector('button'),rect=b.getBoundingClientRect(),t=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);return {retired:!!p.querySelector('[data-relief-register]'),width:rect.width,hit:t===b||b.contains(t)};})()`);
    assert.equal(r.retired,false);assert(r.width>0);assert.equal(r.hit,true);
  });
  fs.writeFileSync(path.join(temp,'relief-final.png'),(await win.webContents.capturePage()).toPNG());
  console.log('RELIEF_ELECTRON_SCENARIO '+sid);
};
