'use strict';
// Real editor/provider/loop/commit/persistence, disposable profile and controlled HTTP only.
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
module.exports = async function({ win, root, check }) {
  const js = s => win.webContents.executeJavaScript(s, true), failures = [];
  const until = expr => js(`(async()=>{const start=performance.now();while(!(${expr})){if(performance.now()-start>12000)throw Error('autoapply wait: '+${JSON.stringify(expr)});await new Promise(r=>setTimeout(r,20));}return true;})()`);
  async function test(name, fn) { try { await check(name, fn); } catch (e) { failures.push(name+'\n'+e.stack); } }
  await win.loadFile(path.join(root,'web/preview/scenario-editor-reset-preview.html'));
  await until(`document.body.dataset.scenarioEditorResetApp==='ready'`);
  await js(`(()=>{
    window.__autoTest={round:0};window.__autoErrors=[];addEventListener('error',e=>__autoErrors.push(e.message));
    localStorage.setItem('tm_api',JSON.stringify({url:'https://autoapply.invalid/v1',key:'synthetic-only',model:'controlled',temp:.2}));
    localStorage.setItem('tm_aa_microplan','0');
    window.fetch=async function(url,options){
      if(String(url)!=='https://autoapply.invalid/v1/chat/completions')throw Error('test-external-network-denied');
      const p=__autoTest,b=JSON.parse(options.body),names=(b.tools||[]).map(t=>t.function.name);
      const cmd=(name,input)=>({id:name+'-'+p.round,type:'function',function:{name,arguments:JSON.stringify(input)}});
      const native=(...calls)=>new Response(JSON.stringify({choices:[{message:{content:'',tool_calls:calls},finish_reason:'tool_calls'}]}));
      if(names.length===1&&names[0]==='setTitle')return native(cmd('setTitle',{title:'隔离放行回归'}));
      if(names.length===1&&names[0]==='selectMemories')return native(cmd('selectMemories',{names:[]}));
      p.round++;
      if(names.includes('proposePlan')&&!names.includes('applyEdit'))return native(cmd('proposePlan',{summary:'调整国库并补充条目',steps:['国库改为450并添加once条目']}));
      if(names.includes('submitReview')&&!names.includes('applyEdit'))return native(cmd('submitReview',{summary:'已核验',findings:[]}));
      if(p.hold&&p.edited){p.waiting=true;await new Promise((resolve,reject)=>{p.release=resolve;options.signal.addEventListener('abort',()=>{p.cancelled=true;const e=Error('stopped');e.name='AbortError';reject(e);},{once:true});});}
      const edit=cmd('applyEdit',{path:'fiscalConfig.treasury',value:450}),push=cmd('applyPush',{path:'labels',value:{name:'once'}}),done=cmd('finish',{summary:'已完成修改并核验'});
      if(p.mode==='broken-json'&&p.round===1)return new Response('{broken');
      if(p.mode==='broken-sse'&&p.round===1)return new Response('data: '+JSON.stringify({choices:[{index:0,delta:{tool_calls:[{...push,index:0}]}}]})+'\\n\\n');
      if(p.mode==='persistent'&&p.edited)return new Response('{broken');
      if(p.mode==='memory')return native(cmd('saveMemory',{name:'auto-test-memory',type:'feedback',description:'仅隔离回归',body:'合成偏好，请保留详细内容'}),done);
      if(p.mode==='invalid'&&!p.edited){p.edited=true;return native(cmd('applyEdit',{path:'relations',value:[{from:'不存在甲',to:'不存在乙',type:'同僚',strictRefs:true}]}));}
      if(!p.edited){p.edited=true;return native(edit,push);}return native(done);
    };
    document.getElementById('tm-aa-fab').click();
  })()`);
  async function fresh(id,mode='normal',permission='auto',hold=false){
    await js(`(()=>{TM_AuthoringAgentUI.stop();document.getElementById('tm-aa-newchat').click();TM_SCENARIO_EDITOR_RESET_APP.applyImportedScenario({id:${JSON.stringify(id)},name:'隔离放行案卷',labels:[],factions:[],characters:[],adminHierarchy:{},gameSettings:{startYear:1207,daysPerTurn:30},fiscalConfig:{treasury:100},customPrompt:'保留玩家手写'},'隔离放行案卷');__autoTest={round:0,mode:${JSON.stringify(mode)},hold:${hold}};TM_AuthoringAgentUI.permMode(${JSON.stringify(permission)});if(!document.querySelector('#tm-aa-panel.open'))document.getElementById('tm-aa-fab').click();})()`);
  }
  const send=()=>js(`(()=>{const u=TM_AuthoringAgentUI._ui;u.els.req.value='国库改为450并添加once条目，核验完成';u.els.go.click();})()`);
  const settled=()=>until(`!TM_AuthoringAgentUI._ui.running && __autoTest.round>0`);
  const state=()=>js(`(()=>{const u=TM_AuthoringAgentUI._ui;return{live:u.adapter.getScenario(),draft:u.draft,rounds:__autoTest.round,status:u.els.status.textContent,recovery:!!u._recovery,completion:u._completion&&u._completion.status,pending:!!u._pendingPlan,text:u.els.summary.textContent,errors:__autoErrors};})()`);
  const applied=async rounds=>{const r=await state();assert.equal(r.live.fiscalConfig.treasury,450);assert.equal(r.live.labels.length,1);assert.equal(r.draft,null);assert.match(r.status,/已应用到剧本/);assert.equal(r.rounds,rounds);assert.equal(r.live.customPrompt,'保留玩家手写');assert.equal(r.errors.length,0);};
  await test('full permission: approved plan execution commits without a second approval',async()=>{
    await fresh('auto-plan','normal','plan');await send();await settled();const r=await state();assert(r.pending);assert.equal(r.live.fiscalConfig.treasury,100);
    await js(`TM_AuthoringAgentUI.permMode('auto');TM_AuthoringAgentUI._ui.els.apply.click()`);await settled();await applied(3);
    await js(`(async()=>{const card=document.querySelector('.tm-aa-reply.applied');if(!card)throw Error('missing applied summary');card.scrollIntoView({block:'center'});await Promise.all(document.getElementById('tm-aa-panel').getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect.getComputedTiming().iterations)).map(a=>a.finished.catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
    assert.equal(await js(`TM_AuthoringAgentUI._ui.els.perm.textContent`),'放行');
    assert.match(await js(`document.querySelector('.tm-aa-reply.applied').textContent`),/已完成修改并核验/);
    fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT),'autoapply-plan.png'),(await win.webContents.capturePage()).toPNG());
  });
  await test('ordinary full-permission generation auto-commits and supports real undo',async()=>{
    await fresh('auto-normal');await send();await settled();await applied(2);assert.equal(await js(`TM_AuthoringAgentUI.undo()`),true);
    const r=await state();assert.equal(r.live.fiscalConfig.treasury,100);assert.equal(r.live.labels.length,0);
  });
  await test('auto-applied scenario survives production save and reload',async()=>{
    await fresh('auto-persist');await send();await settled();await applied(2);
    const r=await js(`(async()=>{const a=TM_SCENARIO_EDITOR_RESET_APP,p=await a.saveProjectSnapshot('隔离自动提交');await a.loadProjectSnapshot(p.id);return a.state.scenario;})()`);
    assert.equal(r.fiscalConfig.treasury,450);assert.equal(r.labels.length,1);assert.equal(r.customPrompt,'保留玩家手写');
  });
  for(const mode of ['broken-json','broken-sse'])await test(mode+' recovers in the real UI and auto-applies once',async()=>{await fresh('auto-'+mode,mode);await send();await settled();await applied(3);});
  await test('persistent invalid response keeps prior draft and never auto-applies incomplete work',async()=>{
    await fresh('auto-blocked','persistent');await send();await settled();const r=await state();assert.equal(r.rounds,3);assert.equal(r.live.fiscalConfig.treasury,100);assert.equal(r.draft.fiscalConfig.treasury,450);assert.equal(r.draft.labels.length,1);assert(r.recovery);assert.equal(r.completion,'blocked');
  });
  await test('review still requires approval and plan mode remains read-only until approved',async()=>{
    await fresh('auto-review','normal','review');await send();await settled();let r=await state();assert.equal(r.live.fiscalConfig.treasury,100);assert.equal(r.draft.fiscalConfig.treasury,450);
    await js(`TM_AuthoringAgentUI._ui.els.apply.click()`);await applied(2);
    await fresh('only-plan','normal','plan');await send();await settled();r=await state();assert(r.pending);assert.equal(r.live.fiscalConfig.treasury,100);assert.equal(r.draft.fiscalConfig.treasury,100);
  });
  await test('full permission cannot bypass the existing consistency quality gate',async()=>{
    await fresh('auto-invalid','invalid');await send();await settled();const r=await state();assert.equal(r.live.relations,undefined);assert.equal(r.draft.relations.length,1);assert.equal(r.completion,'blocked');assert(r.recovery);assert.equal(r.rounds,4);
  });
  await test('changing auto to review while running prevents automatic commit',async()=>{
    await fresh('auto-revoke','normal','auto',true);await send();await until(`__autoTest.waiting`);await js(`TM_AuthoringAgentUI.permMode('review');__autoTest.release()`);await settled();const r=await state();assert.equal(r.live.fiscalConfig.treasury,100);assert.equal(r.draft.fiscalConfig.treasury,450);
  });
  await test('manual overlapping edit is not overwritten by full-permission completion',async()=>{
    await fresh('auto-conflict','normal','auto',true);await send();await until(`__autoTest.waiting`);await js(`TM_AuthoringAgentUI._ui.adapter.getScenario().fiscalConfig.treasury=777;__autoTest.release()`);await settled();const r=await state();assert.equal(r.live.fiscalConfig.treasury,777);assert.equal(r.live.labels.length,0);assert(r.draft);assert.match(r.status,/冲突/);
  });
  await test('stop cancels in-flight work without applying a prefix',async()=>{
    await fresh('auto-cancel','normal','auto',true);await send();await until(`__autoTest.waiting`);await js(`TM_AuthoringAgentUI.stop()`);await settled();const r=await state();assert.equal(r.live.fiscalConfig.treasury,100);assert(r.draft);assert.equal(r.rounds,2);assert.equal(await js(`__autoTest.cancelled`),true);
  });
  await test('scenario switch cannot auto-apply the old draft into the new scenario',async()=>{
    await fresh('auto-owner','normal','auto',true);await send();await until(`__autoTest.waiting`);await js(`(()=>{const release=__autoTest.release;TM_SCENARIO_EDITOR_RESET_APP.applyImportedScenario({id:'other-world',name:'另一案卷',fiscalConfig:{treasury:888},labels:[]},'另一案卷');release();})()`);await settled();const r=await state();assert.equal(r.live.fiscalConfig.treasury,888);assert.equal(r.live.labels.length,0);assert.match(r.status+' '+r.text,/切换|案卷|重新载入/);
  });
  await test('side-effect-only completed work commits without redundant approval in full permission',async()=>{
    await fresh('auto-memory','memory');await send();await settled();const r=await state();assert.equal(r.live.fiscalConfig.treasury,100);assert.equal(r.draft,null);assert.match(r.status,/已提交.*记忆/);
    assert.equal(await js(`TM.AuthoringAgent.memories.list().find(m=>m.name==='auto-test-memory').body`),'合成偏好，请保留详细内容');
  });
  await test('orchestrated completion uses the same full-permission commit path',async()=>{
    await fresh('auto-orchestrated');await js(`TM_AuthoringAgentUI._ui.els.req.value='调整国库并添加once';TM_AuthoringAgentUI.orchestrate()`);await settled();await applied(3);
  });
  await test('full-permission memory storage failure retains pending work; manual retry commits exactly once',async()=>{
    await fresh('auto-memory-quota','memory');
    const before=await js(`(()=>{window.__realSetItem=Storage.prototype.setItem;const before=localStorage.getItem('tm_aa_memdir');Storage.prototype.setItem=function(key,value){if(key==='tm_aa_memdir')throw Error('controlled-quota');return __realSetItem.call(this,key,value);};return before;})()`);
    await send();await settled();const r=await state(),after=await js(`localStorage.getItem('tm_aa_memdir')`);
    await js(`(()=>{Storage.prototype.setItem=__realSetItem;})()`);
    assert.equal(r.live.fiscalConfig.treasury,100);assert(r.draft);assert.equal(before,after);assert.match(r.status,/失败/);
    assert.equal(await js(`TM_AuthoringAgentUI._ui._pendingSideEffects.length`),1);
    await js(`TM_AuthoringAgentUI._ui.els.apply.click();TM_AuthoringAgentUI._ui.els.apply.click()`);
    assert.equal((await state()).draft,null);assert.equal(await js(`TM.AuthoringAgent.memories.list().filter(m=>m.name==='auto-test-memory').length`),1);
  });
  await test('critics completion uses the same full-permission commit path',async()=>{
    await fresh('auto-critics');await js(`TM_AuthoringAgentUI._ui._criticsArmed=true`);await send();await settled();await applied(4);
  });
  await test('non-overlapping manual edits survive full-permission application',async()=>{
    await fresh('auto-merge','normal','auto',true);await send();await until(`__autoTest.waiting`);await js(`TM_AuthoringAgentUI._ui.adapter.getScenario().customPrompt='并行手工说明';__autoTest.release()`);await settled();const r=await state();assert.equal(r.live.fiscalConfig.treasury,450);assert.equal(r.live.customPrompt,'并行手工说明');assert.equal(r.live.labels.length,1);assert.equal(r.draft,null);
  });
  await test('an unconfirmed editor commit remains a visible failure, not an applied result',async()=>{
    await fresh('auto-commit-fails','normal','auto',true);await send();await until(`__autoTest.waiting`);
    await js(`(()=>{const a=TM_AuthoringAgentUI._ui.adapter;window.__realCommit=a.commit;a.commit=()=>({ok:false});__autoTest.release();})()`);await settled();const r=await state();
    await js(`(()=>{TM_AuthoringAgentUI._ui.adapter.commit=__realCommit;})()`);assert.equal(r.live.fiscalConfig.treasury,100);assert.equal(r.live.labels.length,0);assert(r.draft);assert.match(r.status,/未确认应用成功/);
  });
  fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT),'autoapply.png'),(await win.webContents.capturePage()).toPNG());
  if(failures.length)throw Error(failures.join('\n\n'));
};
