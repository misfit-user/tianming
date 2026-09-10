'use strict';
// Real editor/main/preload/agent/IndexedDB. Model replies and timing are controlled;
// no real account, API, player data or replacement business implementation.
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
module.exports = async function({ win, root, check }) {
  const js = s => win.webContents.executeJavaScript(s, true), results = [];
  const until = expr => js(`(async()=>{const start=performance.now();while(!(${expr})){if(performance.now()-start>12000)throw Error('recovery wait: '+${JSON.stringify(expr)});await new Promise(r=>setTimeout(r,15));}return true;})()`);
  await win.loadFile(path.join(root, 'web/preview/scenario-editor-reset-preview.html'));
  await until(`document.body.dataset.scenarioEditorResetApp==='ready'`);
  await js(`(()=>{
    window.__recoveryTest={mode:'fail',round:0};
    localStorage.setItem('tm_api',JSON.stringify({url:'https://recovery.invalid/v1',key:'isolated-recovery-only',model:'controlled'}));
    window.fetch=async function(url,options){
      if(String(url)!=='https://recovery.invalid/v1/chat/completions')throw Error('test-external-network-denied');
      const p=__recoveryTest,body=JSON.parse(options.body),names=(body.tools||[]).map(t=>t.function.name);
      const tool=(name,input)=>({id:name+'-'+p.round,type:'function',function:{name,arguments:JSON.stringify(input)}});
      const response=(...calls)=>new Response(JSON.stringify({choices:[{message:{tool_calls:calls},finish_reason:'tool_calls'}]}),{headers:{'Content-Type':'application/json'}});
      if(names.length===1&&names[0]==='setTitle')return response(tool('setTitle',{title:'隔离续做回归'}));
      if(names.length===1&&names[0]==='selectMemories')return response(tool('selectMemories',{names:[]}));
      p.round++;
      const finish=tool('finish',{summary:'已处理当前任务'}),edit=tool('applyEdit',{path:'fiscalConfig.treasury',value:450});
      if(p.mode==='fail'){
        if(p.round===1)return response(edit,tool('applyPush',{path:'labels',value:{name:'once'}}),tool('saveMemory',{name:'recovery-'+p.id,description:'隔离偏好',body:'合成回归数据'}));
        return new Response('controlled provider failure',{status:401});
      }
      if(p.mode==='resume'){
        if(p.round===1){p.resumeDraft={money:TM_AuthoringAgentUI._ui.draft.fiscalConfig.treasury,labels:TM_AuthoringAgentUI._ui.draft.labels.length};p.priorToolMessages=body.messages.filter(m=>m.role==='tool').length;return response(tool('applyEdit',{path:'labels.once.text',value:'完成'}));}
        return response(finish);
      }
      if(p.mode==='orchestrate'){
        if(names.includes('proposePlan')){p.plans=(p.plans||0)+1;return response(tool('proposePlan',{steps:['添加条目','补充内容']}));}
        if(JSON.stringify(body.messages).includes('【子任务 1/')){p.first=(p.first||0)+1;return body.messages.some(m=>m.role==='tool')?response(finish):response(tool('applyPush',{path:'labels',value:{name:'once'}}));}
        if(p.broken!==false)return body.messages.some(m=>m.role==='tool')?new Response('controlled subtask error',{status:401}):response(tool('applyEdit',{path:'labels.once.text',value:'半成品'}));
        return response(tool('applyEdit',{path:'labels.once.text',value:'完整'}),finish);
      }
      if(p.mode==='critics'){
        if(names.includes('submitReview')){
          if(body.messages[0].content.includes('【史官】')){p.history=(p.history||0)+1;return response(tool('submitReview',{findings:[],summary:'史官已核对'}));}
          p.balance=(p.balance||0)+1;return p.broken!==false?new Response('controlled reviewer error',{status:401}):response(tool('submitReview',{findings:[],summary:'谏官已核对'}));
        }
        p.author=(p.author||0)+1;return body.messages.some(m=>m.role==='tool')?response(finish):response(tool('applyPush',{path:'labels',value:{name:'once'}}));
      }
      if(p.mode==='memory')return p.round===1?response(tool('saveMemory',{name:'only-'+p.id,description:'隔离偏好',body:'合成回归数据'})):response(finish);
      if(p.mode==='blocked')return p.round===1?response(edit,tool('applyEdit',{path:'labels.missing.text',value:'不能落位'})):response(finish);
      if(p.mode==='regenerate')return p.round===1?response(tool('applyEdit',{path:'fiscalConfig.treasury',value:700}),tool('applyPush',{path:'labels',value:{name:'fresh'}})):response(finish);
      if(p.mode==='cancel'){
        if(p.round===1)return response(edit);
        p.waiting=true;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{p.cancelled=true;const e=new Error('controlled cancel');e.name='AbortError';reject(e);},{once:true}));
      }
      return response(finish);
    };
    if(!document.querySelector('#tm-aa-panel.open'))document.getElementById('tm-aa-fab').click();
  })()`);
  async function fresh(id, mode = 'fail', permission = 'review') {
    await js(`(()=>{document.getElementById('tm-aa-newchat').click();TM_SCENARIO_EDITOR_RESET_APP.applyImportedScenario({id:${JSON.stringify(id)},name:'隔离回归',labels:[],factions:[],characters:[],gameSettings:{startYear:1207,daysPerTurn:30},fiscalConfig:{treasury:100},customPrompt:'原手工输入'},'隔离回归');__recoveryTest={id:${JSON.stringify(id)},mode:${JSON.stringify(mode)},round:0};TM_AuthoringAgentUI.permMode(${JSON.stringify(permission)});})()`);
  }
  const send = () => js(`(()=>{const ui=TM_AuthoringAgentUI._ui;ui.els.req.value='修改国库、补条目并记住偏好，完成后核验';ui.els.go.click();})()`);
  const done = () => until(`!TM_AuthoringAgentUI._ui.running && __recoveryTest.round>0`);
  const error = () => until(`!TM_AuthoringAgentUI._ui.running && !!document.querySelector('.tm-aa-errcard')`);
  async function test(name, fn) { try { await check(name, fn); results.push({ name, status: 'PASS' }); } catch (e) { results.push({ name, status: 'FAIL', error: e.stack }); } }
  await test('failed task retains draft, conversation and staged side effects without committing live data', async () => {
    await fresh('normal-retry'); await js(`(async()=>{const p=await TM_SCENARIO_EDITOR_RESET_APP.saveProjectSnapshot('原案卷');__recoveryTest.project=p.id;})()`); await send(); await error();
    const r = await js(`(()=>{const ui=TM_AuthoringAgentUI._ui;return{draft:ui.draft.fiscalConfig.treasury,source:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury,labels:ui.draft.labels.length,conversation:ui.conversation&&ui.conversation.length,pending:ui._pendingSideEffects.length,memory:TM.AuthoringAgent.memories.list().filter(m=>m.name==='recovery-normal-retry').length,recovery:!!ui._recovery,button:document.querySelector('.ec-retry').textContent};})()`);
    assert.equal(r.draft, 450); assert.equal(r.source, 100); assert.equal(r.labels, 1); assert(r.conversation > 1); assert.equal(r.pending, 1); assert.equal(r.memory, 0); assert(r.recovery); assert.match(r.button, /继续未完成/);
  });
  await test('real retry continues existing progress once; approval commits memory once and keeps original project', async () => {
    await js(`__recoveryTest.mode='resume';__recoveryTest.round=0;window.__completedRecoveryButton=document.querySelector('.ec-retry');__completedRecoveryButton.click();__completedRecoveryButton.click()`); await done();
    const r = await js(`(async()=>{const ui=TM_AuthoringAgentUI._ui,app=TM_SCENARIO_EDITOR_RESET_APP;const pending=ui._pendingSideEffects.length;ui.els.apply.click();const saved=await app.saveProjectSnapshot('原案卷');await app.loadProjectSnapshot(saved.id);return{resume:__recoveryTest.resumeDraft,prior:__recoveryTest.priorToolMessages,rounds:__recoveryTest.round,pending,labels:app.state.scenario.labels,money:app.state.scenario.fiscalConfig.treasury,project:saved.id,expected:__recoveryTest.project,memory:TM.AuthoringAgent.memories.list().filter(m=>m.name==='recovery-normal-retry').length};})()`);
    assert.deepEqual(r.resume, { money: 450, labels: 1 }); assert(r.prior > 0); assert.equal(r.rounds, 2); assert.equal(r.pending, 1); assert.equal(r.labels.length, 1); assert.equal(r.labels[0].text, '完成'); assert.equal(r.money, 450); assert.equal(r.project, r.expected); assert.equal(r.memory, 1);
    await js(`__completedRecoveryButton.click()`); assert.equal(await js(`__recoveryTest.round`), r.rounds);
  });
  await test('unresolved write never triggers automatic application or a completed UI state', async () => {
    await fresh('auto-blocked', 'blocked', 'auto'); await send(); await done();
    const r = await js(`(()=>{const ui=TM_AuthoringAgentUI._ui;return{money:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury,status:ui.els.status.textContent,completion:ui._completion,button:ui.els.apply.textContent,draft:ui.draft&&ui.draft.fiscalConfig.treasury};})()`);
    assert.equal(r.money, 100); assert.equal(r.draft, 450); assert.equal(r.completion.status, 'blocked'); assert.equal(r.completion.unresolved.length, 1); assert.match(r.status, /任务未完成/); assert.match(r.button, /任务未完成/);
  });
  await test('manual partial application needs explicit confirmation and remains labelled incomplete', async () => {
    const first = await js(`(()=>{const ui=TM_AuthoringAgentUI._ui;ui.els.apply.click();return{money:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury,label:ui.els.apply.textContent};})()`);
    assert.equal(first.money, 100); assert.match(first.label, /确认应用部分/);
    const r = await js(`(()=>{const ui=TM_AuthoringAgentUI._ui;ui.els.apply.click();return{money:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury,status:ui.els.status.textContent};})()`);
    assert.equal(r.money, 450); assert.match(r.status, /仍有未完成项/);
  });
  await test('manual edits invalidate direct recovery; confirmed regeneration uses current live input', async () => {
    await fresh('manual-change'); await send(); await error();
    await js(`TM_SCENARIO_EDITOR_RESET_APP.state.scenario.customPrompt='玩家后来输入';TM_SCENARIO_EDITOR_RESET_APP.recordExternalEdit('手工编辑','customPrompt');__recoveryTest.before=__recoveryTest.round;document.querySelector('.ec-retry').click()`);
    let r = await js(`({calls:__recoveryTest.round,before:__recoveryTest.before,status:TM_AuthoringAgentUI._ui.els.status.textContent,prompt:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.customPrompt})`);
    assert.equal(r.calls, r.before); assert.match(r.status, /手工编辑/); assert.equal(r.prompt, '玩家后来输入');
    assert.equal(await js(`!!document.querySelector('.ec-restart')`), true);
    await js(`__recoveryTest.mode='regenerate';__recoveryTest.round=0;document.querySelector('.ec-restart').click()`); assert.equal(await js(`__recoveryTest.round`), 0);
    await js(`document.querySelector('.ec-restart').click()`); await done(); await js(`TM_AuthoringAgentUI._ui.els.apply.click()`);
    r = await js(`({money:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury,prompt:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.customPrompt,labels:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.labels,memory:TM.AuthoringAgent.memories.list().filter(m=>m.name==='recovery-manual-change').length})`);
    assert.equal(r.money, 700); assert.equal(r.prompt, '玩家后来输入'); assert.deepEqual(r.labels, [{ name: 'fresh' }]); assert.equal(r.memory, 0);
  });
  await test('cross-project retry and old error-card handlers cannot act on a newer project/task', async () => {
    await fresh('stale-A'); await send(); await error();
    await js(`window.__oldRecoveryButton=document.querySelector('.ec-retry');__recoveryTest.before=__recoveryTest.round;TM_SCENARIO_EDITOR_RESET_APP.applyImportedScenario({id:'B',name:'B',labels:[],fiscalConfig:{treasury:777}},'B');__oldRecoveryButton.click()`);
    assert.equal(await js(`__recoveryTest.round===__recoveryTest.before && TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury===777`), true);
    await fresh('new-task'); await send(); await error(); const before = await js(`__recoveryTest.round`); await js(`__oldRecoveryButton.click()`);
    assert.equal(await js(`__recoveryTest.round`), before);
  });
  await test('permission changes cannot revive an earlier write task under question-only mode', async () => {
    await fresh('permission-change'); await send(); await error();
    const r = await js(`(()=>{const before=__recoveryTest.round;TM_AuthoringAgentUI.permMode('plan');document.querySelector('.ec-retry').click();return{before,after:__recoveryTest.round,status:TM_AuthoringAgentUI._ui.els.status.textContent,money:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury};})()`);
    assert.equal(r.before, r.after); assert.equal(r.money, 100); assert.match(r.status, /问策/);
  });
  await test('stop preserves completed draft work but only an explicit retry resumes with a new signal', async () => {
    await fresh('cancel', 'cancel'); await send(); await until(`__recoveryTest.waiting===true`); await js(`TM_AuthoringAgentUI._ui.els.go.click()`); await done();
    const r = await js(`({cancelled:__recoveryTest.cancelled,source:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury,draft:TM_AuthoringAgentUI._ui.draft.fiscalConfig.treasury,status:TM_AuthoringAgentUI._ui._completion&&TM_AuthoringAgentUI._ui._completion.status,recovery:!!TM_AuthoringAgentUI._ui._recovery})`);
    assert(r.cancelled); assert.equal(r.source, 100); assert.equal(r.draft, 450); assert.equal(r.status, 'cancelled'); assert(r.recovery);
    await js(`__recoveryTest.mode='finish';__recoveryTest.round=0;document.querySelector('.ec-retry').click()`); await done(); await js(`TM_AuthoringAgentUI._ui.els.apply.click()`);
    assert.equal(await js(`TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury`), 450);
  });
  await test('orchestration UI retries only the interrupted subtask through the real provider', async () => {
    await fresh('orchestrate', 'orchestrate'); await js(`TM_AuthoringAgentUI._ui.els.req.value='分两步修改条目';TM_AuthoringAgentUI.orchestrate()`); await error();
    const before = await js(`({first:__recoveryTest.first,plans:__recoveryTest.plans,labels:TM_AuthoringAgentUI._ui.draft.labels,live:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.labels})`);
    assert.equal(before.plans, 1); assert.equal(before.labels.length, 1); assert.equal(before.labels[0].text, '半成品'); assert.equal(before.live.length, 0);
    await js(`__recoveryTest.broken=false;document.querySelector('.ec-retry').click()`); await done(); await js(`TM_AuthoringAgentUI._ui.els.apply.click()`);
    const r = await js(`({first:__recoveryTest.first,plans:__recoveryTest.plans,labels:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.labels})`);
    assert.equal(r.first, before.first); assert.equal(r.plans, 1); assert.deepEqual(r.labels, [{ name: 'once', text: '完整' }]);
  });
  await test('critic UI resumes the failed reviewer without replaying author or successful reviewer', async () => {
    await fresh('critics', 'critics'); await js(`TM_AuthoringAgentUI._ui._criticsArmed=true`); await send(); await error();
    const before = await js(`({author:__recoveryTest.author,history:__recoveryTest.history,labels:TM_AuthoringAgentUI._ui.draft.labels,live:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.labels})`);
    assert.equal(before.history, 1); assert.equal(before.labels.length, 1); assert.equal(before.live.length, 0);
    await js(`__recoveryTest.broken=false;document.querySelector('.ec-retry').click()`); await done(); await js(`TM_AuthoringAgentUI._ui.els.apply.click()`);
    const r = await js(`({author:__recoveryTest.author,history:__recoveryTest.history,balance:__recoveryTest.balance,labels:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.labels})`);
    assert.equal(r.author, before.author); assert.equal(r.history, before.history); assert.equal(r.balance, 2); assert.deepEqual(r.labels, [{ name: 'once' }]);
  });
  await test('memory-only approval failure leaves live scenario, pending work and memory storage intact', async () => {
    await fresh('memory-only', 'memory', 'auto'); await send(); await done();
    const before = await js(`(()=>{const ui=TM_AuthoringAgentUI._ui;__recoveryTest.source=JSON.stringify(TM_SCENARIO_EDITOR_RESET_APP.state.scenario);return{pending:ui._pendingSideEffects.length,memory:TM.AuthoringAgent.memories.list().filter(m=>m.name==='only-memory-only').length,label:ui.els.apply.textContent,diffs:ui._lastDiffs.length};})()`);
    assert.equal(before.pending, 1); assert.equal(before.memory, 0); assert.equal(before.diffs, 0); assert.match(before.label, /记忆\/技能/);
    const r = await js(`(()=>{const real=Storage.prototype.setItem;try{Storage.prototype.setItem=function(){throw new Error('controlled-quota');};TM_AuthoringAgentUI._ui.els.apply.click();}finally{Storage.prototype.setItem=real;}return{unchanged:JSON.stringify(TM_SCENARIO_EDITOR_RESET_APP.state.scenario)===__recoveryTest.source,pending:TM_AuthoringAgentUI._ui._pendingSideEffects.length,memory:TM.AuthoringAgent.memories.list().filter(m=>m.name==='only-memory-only').length,status:TM_AuthoringAgentUI._ui.els.status.textContent};})()`);
    assert(r.unchanged); assert.equal(r.pending, 1); assert.equal(r.memory, 0); assert.match(r.status, /失败/);
  });
  await test('retrying memory-only approval persists once without committing or normalizing the scenario', async () => {
    const r = await js(`(()=>{const ui=TM_AuthoringAgentUI._ui,real=ui.adapter.commit;let commits=0;try{ui.adapter.commit=function(){commits++;throw Error('must-not-commit-scenario');};ui.els.apply.click();ui.els.apply.click();}finally{ui.adapter.commit=real;}return{commits,unchanged:JSON.stringify(TM_SCENARIO_EDITOR_RESET_APP.state.scenario)===__recoveryTest.source,memory:TM.AuthoringAgent.memories.list().filter(m=>m.name==='only-memory-only').length,pending:ui._pendingSideEffects.length,draft:ui.draft};})()`);
    assert.equal(r.commits, 0); assert(r.unchanged); assert.equal(r.memory, 1); assert.equal(r.pending, 0); assert.equal(r.draft, null);
  });
  fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT), 'authoring-recovery-results.json'), JSON.stringify({ results, pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length }, null, 2));
  const failures = results.filter(r => r.status === 'FAIL'); if (failures.length) throw Error(failures.map(r => r.name + '\n' + r.error).join('\n'));
};
