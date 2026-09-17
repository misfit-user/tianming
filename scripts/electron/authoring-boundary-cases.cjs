'use strict';
// Real workshop + default agent/provider + IndexedDB, isolated userData and synthetic scenarios.
// Controlled model replies/time ordering only; no replacement editor, agent or bridge.
const assert = require('assert/strict'), path = require('path'), fs = require('fs');
module.exports = async function({ win, root, check }) {
  const js = s => win.webContents.executeJavaScript(s, true), results = [];
  const until = expr => js(`(async()=>{const start=performance.now();while(!(${expr})){if(performance.now()-start>12000)throw Error('boundary wait failed: '+${JSON.stringify(expr)});await new Promise(r=>setTimeout(r,15));}return true;})()`);
  await win.loadFile(path.join(root, 'web/preview/scenario-editor-reset-preview.html'));
  await until(`document.body.dataset.scenarioEditorResetApp==='ready'`);
  await js(`(()=>{
    window.__boundary={round:0,mode:'edit'};
    localStorage.setItem('tm_api',JSON.stringify({url:'https://boundary.invalid/v1',key:'isolated-regression-only',model:'controlled'}));
    window.fetch=async function(url,options){
      if(String(url)!=='https://boundary.invalid/v1/chat/completions')throw Error('external network denied');
      const p=__boundary,b=JSON.parse(options.body),names=(b.tools||[]).map(t=>t.function.name);
      const response=(name,input)=>new Response(JSON.stringify({choices:[{message:{tool_calls:[{id:'boundary-'+p.round,type:'function',function:{name,arguments:JSON.stringify(input)}}]},finish_reason:'tool_calls'}]}),{headers:{'Content-Type':'application/json'}});
      if(names.length===1&&names[0]==='setTitle')return response('setTitle',{title:'隔离回归'});
      p.round++;p.offered=names;
      if(p.mode==='pause'&&p.round===1)return new Promise(resolve=>p.release=()=>resolve(response('applyEdit',{path:'fiscalConfig.treasury',value:450})));
      if(p.mode==='fail')return new Response('controlled error',{status:401});
      if(p.round===1)return response('applyEdit',{path:'fiscalConfig.treasury',value:450});
      if(p.mode==='plan')return response('proposePlan',{steps:['核对后请玩家批准'],summary:'只读计划'});
      if(p.mode==='review')return response('submitReview',{findings:[],summary:'只读完成'});
      return response('finish',{summary:'只修改财政'});
    };
    if(!document.querySelector('#tm-aa-panel.open'))document.getElementById('tm-aa-fab').click();
  })()`);
  async function fresh(id, mode = 'edit') {
    await js(`(()=>{const app=TM_SCENARIO_EDITOR_RESET_APP;document.querySelector('#tm-aa-newchat').click();app.applyImportedScenario({id:${JSON.stringify(id)},name:'同名测试剧本',gameSettings:{startYear:1207,daysPerTurn:30},factions:[],characters:[],fiscalConfig:{treasury:100},customPrompt:'保留手工输入'},'隔离回归');__boundary.mode=${JSON.stringify(mode)};__boundary.round=0;delete __boundary.release;TM_AuthoringAgentUI.permMode('review');})()`);
  }
  const send = () => js(`(()=>{const ui=TM_AuthoringAgentUI._ui;ui.els.req.value='核对并修改国库';ui.els.go.click();})()`);
  const done = () => until(`!TM_AuthoringAgentUI._ui.running && __boundary.round>0`);
  async function test(name, fn) {
    try { await check(name, fn); results.push({ name, status: 'PASS' }); }
    catch (e) { results.push({ name, status: 'FAIL', error: e.stack }); }
  }
  await test('current-project edit preserves ID, original baseline, manual drafts and save/reload target', async () => {
    await fresh('saved-A');
    await js(`(async()=>{const app=TM_SCENARIO_EDITOR_RESET_APP;const p=await app.saveProjectSnapshot('原案卷');__boundary.saved=p.id;__boundary.original=JSON.stringify(app.state.original);app.state.drafts=[{id:'manual-draft',text:'未提交草稿'}];__boundary.drafts=JSON.stringify(app.state.drafts);})()`);
    await send(); await done();
    const r = await js(`(async()=>{const app=TM_SCENARIO_EDITOR_RESET_APP,ui=TM_AuthoringAgentUI._ui;ui.els.apply.click();const applied={id:app.state.currentProjectId,original:JSON.stringify(app.state.original),drafts:JSON.stringify(app.state.drafts),money:app.state.scenario.fiscalConfig.treasury,dirty:app.state.dirty,history:app.state.history[0].type,status:ui.els.status.textContent};const saved=await app.saveProjectSnapshot('仍是原案卷');await app.loadProjectSnapshot(__boundary.saved);return{applied,expectedId:__boundary.saved,expectedOriginal:__boundary.original,expectedDrafts:__boundary.drafts,savedId:saved.id,reloaded:app.state.scenario.fiscalConfig.treasury};})()`);
    assert.equal(r.applied.money, 450, JSON.stringify(r)); assert.equal(r.applied.id, r.expectedId); assert.equal(r.savedId, r.expectedId); assert.equal(r.reloaded, 450);
    assert.equal(r.applied.original, r.expectedOriginal); assert.equal(r.applied.drafts, r.expectedDrafts); assert(r.applied.dirty); assert.equal(r.applied.history, '国师编辑'); assert.match(r.applied.status, /已应用/);
  });
  await test('normal new import remains detached; unsaved same-name scenarios have different file keys', async () => {
    await fresh('same');
    const r = await js(`(async()=>{const app=TM_SCENARIO_EDITOR_RESET_APP,adapter=TM.AuthoringAgent.makeResetEditorAdapter(window);const before=adapter.getFileKey();await app.saveProjectSnapshot('入库');app.applyImportedScenario({id:'same',name:'同名测试剧本',fiscalConfig:{treasury:100}},'重新导入');return{before,after:adapter.getFileKey(),project:app.state.currentProjectId};})()`);
    assert.equal(r.project, null); assert.notEqual(r.before, r.after);
  });
  await test('ordinary edits keep a lease; stale lease and changed revision both reject direct commit', async () => {
    await fresh('lease');
    assert.equal(await js(`typeof TM.AuthoringAgent.makeResetEditorAdapter(window).captureLease`), 'function', 'host/adapter lease protocol must exist');
    const r = await js(`(()=>{const app=TM_SCENARIO_EDITOR_RESET_APP,adapter=TM.AuthoringAgent.makeResetEditorAdapter(window),lease=adapter.captureLease();app.state.scenario.customPrompt='手工改';app.recordExternalEdit('手工编辑','customPrompt');const same=adapter.isLeaseCurrent(lease),unchanged=adapter.isLeaseCurrent(lease,true);let code;try{adapter.commit({name:'不应写入'},lease);}catch(e){code=e.code;}const afterManual=app.state.scenario.customPrompt;app.applyImportedScenario({id:'lease',name:'同名测试剧本',fiscalConfig:{treasury:777}},'新导入');let stale;try{adapter.commit({name:'不应覆盖'},lease);}catch(e){stale=e.code;}return{same,unchanged,code,afterManual,stale,money:app.state.scenario.fiscalConfig.treasury};})()`);
    assert(r.same); assert.equal(r.unchanged, false); assert.equal(r.code, 'editor-document-changed'); assert.equal(r.stale, r.code); assert.equal(r.afterManual, '手工改'); assert.equal(r.money, 777);
  });
  await test('A checkpoint cannot restore into B and remains available after rejected undo/restore', async () => {
    await fresh('checkpoint-A');
    const r = await js(`(async()=>{const app=TM_SCENARIO_EDITOR_RESET_APP,U=TM_AuthoringAgentUI;const cp=U.checkpoint('A检查点');const count=U._ui._checkpoints.length;app.applyImportedScenario({id:'checkpoint-B',name:'同名测试剧本',fiscalConfig:{treasury:777}},'B');const b=await app.saveProjectSnapshot('B');await app.loadProjectSnapshot(b.id);const before=JSON.stringify(app.state.scenario);const undo=U.undo(),restore=U.restore(cp.id);return{undo,restore,count,afterCount:U._ui._checkpoints.length,before,after:JSON.stringify(app.state.scenario)};})()`);
    assert.equal(r.undo, false); assert.equal(r.restore, false); assert.equal(r.afterCount, r.count); assert.equal(r.after, r.before);
  });
  await test('same-document checkpoint restore and undo preserve project association', async () => {
    await fresh('checkpoint-control');
    const r = await js(`(async()=>{const app=TM_SCENARIO_EDITOR_RESET_APP,U=TM_AuthoringAgentUI,adapter=TM.AuthoringAgent.makeResetEditorAdapter(window);const p=await app.saveProjectSnapshot('同案卷');const cp=U.checkpoint('原值');const d=TM.AuthoringAgent.makeDraft(app.state.scenario);d.fiscalConfig.treasury=900;adapter.commit(d);const restored=U.restore(cp.id),first=app.state.scenario.fiscalConfig.treasury;const undone=U.undo();return{restored,undone,first,last:app.state.scenario.fiscalConfig.treasury,id:app.state.currentProjectId,expected:p.id};})()`);
    assert(r.restored); assert(r.undone); assert.equal(r.first, 100); assert.equal(r.last, 900); assert.equal(r.id, r.expected);
  });
  await test('same-field conflict is rejected; unrelated manual edit survives merge', async () => {
    await fresh('manual-control', 'pause'); await send(); await until(`typeof __boundary.release==='function'`);
    await js(`TM_SCENARIO_EDITOR_RESET_APP.state.scenario.customPrompt='保留的玩家新输入';TM_SCENARIO_EDITOR_RESET_APP.recordExternalEdit('手工修改','customPrompt');__boundary.release()`); await done();
    let r = await js(`(()=>{const app=TM_SCENARIO_EDITOR_RESET_APP;TM_AuthoringAgentUI._ui.els.apply.click();return{money:app.state.scenario.fiscalConfig.treasury,prompt:app.state.scenario.customPrompt};})()`);
    assert.equal(r.money, 450); assert.equal(r.prompt, '保留的玩家新输入');
    await fresh('conflict-control', 'pause'); await send(); await until(`typeof __boundary.release==='function'`);
    await js(`TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury=777;TM_SCENARIO_EDITOR_RESET_APP.recordExternalEdit('手工修改','fiscalConfig');__boundary.release()`); await done();
    r = await js(`(()=>{const ui=TM_AuthoringAgentUI._ui;ui.els.apply.click();return{money:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury,status:ui.els.status.textContent};})()`);
    assert.equal(r.money, 777); assert.match(r.status, /冲突/);
  });
  await test('late A model response after actual B load cannot apply, continue or bind a B session', async () => {
    await fresh('running-B'); await js(`(async()=>{const p=await TM_SCENARIO_EDITOR_RESET_APP.saveProjectSnapshot('B');window.__savedB=p.id;})()`);
    await fresh('running-A', 'pause'); await send(); await until(`typeof __boundary.release==='function'`);
    await js(`TM_SCENARIO_EDITOR_RESET_APP.loadProjectSnapshot(__savedB)`); await js(`__boundary.release()`); await done();
    const r = await js(`(()=>{const ui=TM_AuthoringAgentUI._ui,app=TM_SCENARIO_EDITOR_RESET_APP;ui.els.apply.click();const before=__boundary.round;ui.els.req.value='继续原任务';ui.els.go.click();return{rounds:__boundary.round,before,id:app.state.scenario.id,money:app.state.scenario.fiscalConfig.treasury,stale:!!ui._staleResult,draft:ui.draft.fiscalConfig.treasury,status:ui.els.status.textContent,sessions:TM_AuthoringAgentUI.listSessions().filter(s=>s.fileKey==='proj:'+__savedB).length};})()`);
    assert.equal(r.id, 'running-B'); assert.equal(r.money, 100); assert.equal(r.rounds, r.before); assert(r.stale); assert.equal(r.draft, 450); assert.match(r.status, /案卷已切换/); assert.equal(r.sessions, 0);
  });
  await test('new conversation after stale result can edit the current B normally', async () => {
    await js(`document.querySelector('#tm-aa-newchat').click();__boundary.mode='edit';__boundary.round=0`); await send(); await done();
    const r = await js(`(()=>{const app=TM_SCENARIO_EDITOR_RESET_APP;TM_AuthoringAgentUI._ui.els.apply.click();return{id:app.state.scenario.id,money:app.state.scenario.fiscalConfig.treasury};})()`);
    assert.equal(r.id, 'running-B'); assert.equal(r.money, 450);
  });
  await test('completed draft also rejects a same-name reload before Apply', async () => {
    await fresh('completed'); await send(); await done();
    const r = await js(`(()=>{const app=TM_SCENARIO_EDITOR_RESET_APP;app.applyImportedScenario({id:'completed',name:'同名测试剧本',fiscalConfig:{treasury:100}},'新加载');TM_AuthoringAgentUI._ui.els.apply.click();return{money:app.state.scenario.fiscalConfig.treasury,status:TM_AuthoringAgentUI._ui.els.status.textContent};})()`);
    assert.equal(r.money, 100); assert.match(r.status, /案卷已切换/);
  });
  await test('actual question-only UI refuses model writes but permits explicit plan approval', async () => {
    await fresh('plan', 'plan'); await js(`TM_AuthoringAgentUI.permMode('plan')`); await send(); await done();
    let r = await js(`({source:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury,draft:TM_AuthoringAgentUI._ui.draft.fiscalConfig.treasury,plan:TM_AuthoringAgentUI._ui._pendingPlan,button:TM_AuthoringAgentUI._ui.els.apply.textContent})`);
    assert.equal(r.source, 100); assert.equal(r.draft, 100); assert(r.plan); assert.equal(r.button, '批准并执行');
    await js(`__boundary.mode='edit';__boundary.round=0;TM_AuthoringAgentUI._ui.els.apply.click()`); await done();
    r = await js(`({source:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury,draft:TM_AuthoringAgentUI._ui.draft.fiscalConfig.treasury})`);
    assert.equal(r.source, 100); assert.equal(r.draft, 450);
  });
  await test('failed provider leaves source unchanged and next fresh request succeeds', async () => {
    await fresh('failure', 'fail'); await send(); await done();
    assert.equal(await js(`TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury`), 100);
    assert.equal(await js(`!!document.querySelector('.tm-aa-errcard')`), true);
    await js(`document.querySelector('#tm-aa-newchat').click();__boundary.mode='edit';__boundary.round=0`); await send(); await done();
    await js(`TM_AuthoringAgentUI._ui.els.apply.click()`); assert.equal(await js(`TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury`), 450);
  });
  await test('legacy double-encoded draft normalization still reports actual repair/drop counts', async () => {
    await fresh('legacy-normalization'); await send(); await done();
    const r = await js(`(()=>{const ui=TM_AuthoringAgentUI._ui,AA=TM.AuthoringAgent;ui.draft.classes=['{"name":"士绅"}','bad JSON'];TM.__aaUiParts.renderDiff(AA.computeDiff(ui.baseScenario,ui.draft));ui.els.apply.click();return{classes:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.classes,status:ui.els.status.textContent};})()`);
    assert.deepEqual(r.classes, [{ name: '士绅' }]); assert.match(r.status, /已自动修复 1 条/); assert.match(r.status, /丢弃 1 条/);
  });
  await test('finished read-only review with no pending draft does not block a fresh task on B', async () => {
    await fresh('review-A', 'review'); await js(`TM_AuthoringAgentUI.review()`); await done();
    assert.equal(await js(`TM_AuthoringAgentUI._ui.draft`), null);
    await js(`TM_SCENARIO_EDITOR_RESET_APP.applyImportedScenario({id:'review-B',name:'B',factions:[],characters:[],fiscalConfig:{treasury:100}},'B');__boundary.mode='edit';__boundary.round=0`);
    await send(); await done(); await js(`TM_AuthoringAgentUI._ui.els.apply.click()`);
    assert.equal(await js(`TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury`), 450);
  });
  for (const mode of ['orchestrate', 'critics']) await test('question-only permission also gates the ' + mode + ' UI entry', async () => {
    await fresh('permission-' + mode);
    await js(`TM_AuthoringAgentUI.permMode('plan');TM_AuthoringAgentUI._ui.els.req.value='核对并修改国库'`);
    if (mode === 'orchestrate') await js(`TM_AuthoringAgentUI.orchestrate()`);
    else await js(`(()=>{const chip=[...document.querySelectorAll('.emp-chip')].find(b=>b.textContent==='三堂会审');if(!chip)throw Error('critics chip missing');chip.click();TM_AuthoringAgentUI._ui.els.go.click();})()`);
    await until(`!TM_AuthoringAgentUI._ui.running`);
    const r = await js(`({calls:__boundary.round,status:TM_AuthoringAgentUI._ui.els.status.textContent,money:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury})`);
    assert.equal(r.calls, 0); assert.equal(r.money, 100); assert.match(r.status, /问策/);
  });
  fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT), 'authoring-boundaries-results.json'), JSON.stringify({ results, pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length }, null, 2));
  const failed = results.filter(r => r.status === 'FAIL'); if (failed.length) throw Error(failed.map(r => r.name + '\n' + r.error).join('\n'));
};
