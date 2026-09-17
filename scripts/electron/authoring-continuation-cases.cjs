'use strict';
// Production editor/provider/agent/preload; synthetic scenario and controlled relay only.
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
module.exports = async function({ win, root, check }) {
  const js = s => win.webContents.executeJavaScript(s, true), results = [], dir = path.dirname(process.env.TM_BRIDGE_TEST_REPORT);
  const until = expr => js(`(async()=>{const start=performance.now();while(!(${expr})){if(performance.now()-start>20000)throw Error('continuation wait: '+${JSON.stringify(expr)});await new Promise(r=>setTimeout(r,20));}return true;})()`);
  async function click(expr) {
    win.focus(); win.webContents.focus();
    const p = await js(`(async()=>{const e=${expr};if(!e)throw Error('missing test control');e.scrollIntoView({block:'center'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=e.getBoundingClientRect(),x=Math.round(b.x+b.width/2),y=Math.round(b.y+b.height/2);if(!e.contains(document.elementFromPoint(x,y)))throw Error('control not hit-testable');return{x,y};})()`);
    win.webContents.sendInputEvent({ type: 'mouseMove', ...p }); win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...p }); win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...p });
    await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  }
  async function test(name, fn) { try { await check(name, fn); results.push({ name, status: 'PASS' }); } catch (e) { results.push({ name, status: 'FAIL', error: e.stack }); } }
  await require('./scenario-origin-cases.cjs')({ win, js, until, click, test });
  await win.loadFile(path.join(root, 'web/preview/scenario-editor-reset-preview.html'));
  await until(`document.body.dataset.scenarioEditorResetApp==='ready'`);
  await js(`(()=>{
    window.__relayTest={round:0,mode:'empty'};
    window.__relayErrors=[];addEventListener('error',e=>__relayErrors.push(e.message));
    localStorage.setItem('tm_api',JSON.stringify({url:'https://relay.invalid/v1',key:'isolated-regression-only',model:'controlled',temp:.2}));
    window.fetch=async function(url,options){
      if(String(url)!=='https://relay.invalid/v1/chat/completions')throw Error('test-external-network-denied');
      const p=__relayTest,b=JSON.parse(options.body),names=(b.tools||[]).map(t=>t.function.name);
      const cmd=(name,input)=>({id:name+'-'+p.round,name,input});
      const response=m=>new Response(JSON.stringify({choices:[{message:m,finish_reason:'stop'}]}),{headers:{'Content-Type':'application/json'}});
      const native=(...calls)=>response({tool_calls:calls.map(c=>({id:c.id,type:'function',function:{name:c.name,arguments:JSON.stringify(c.input)}}))});
      if(names.length===1&&names[0]==='setTitle')return native(cmd('setTitle',{title:'隔离续做回归'}));
      if(names.length===1&&names[0]==='selectMemories')return native(cmd('selectMemories',{names:[]}));
      p.round++;p.native=(p.native||0)+(b.tools?1:0);p.compat=(p.compat||0)+(b.tools?0:1);
      const done=cmd('finish',{summary:'所需条目已补齐并核验'}),edit=cmd('applyEdit',{path:'fiscalConfig.treasury',value:450});
      if(p.mode==='reasoning-json'||p.mode==='reasoning-sse'){
        const previous=b.messages.filter(m=>m.role==='assistant');
        const valid=previous.every(m=>m.reasoning_content===p.sent[m.tool_calls[0].id]);
        p.checkedTurns=(p.checkedTurns||0)+previous.length;
        if(!b.tools||!valid){p.protocolMismatch=true;return new Response('Missing reasoning_content in assistant message',{status:400});}
        const calls=p.round===1?[edit,cmd('applyPush',{path:'labels',value:{name:'once'}})]:[cmd('applyEdit',{path:'labels.once.text',value:'思考续轮已完成'}),done];
        const thought='SYNTHETIC_OPAQUE_THOUGHT_'+p.round+'😀';p.sent=p.sent||{};p.sent[calls[0].id]=thought;
        const m={content:'',reasoning_content:thought,tool_calls:calls.map(c=>({id:c.id,type:'function',function:{name:c.name,arguments:JSON.stringify(c.input)}}))};
        if(p.mode==='reasoning-json')return response(m);
        const events=[{choices:[{index:0,delta:{reasoning_content:thought.slice(0,12)}}]},
          {choices:[{index:0,delta:{reasoning_content:thought.slice(12),tool_calls:m.tool_calls.map((c,index)=>({...c,index}))},finish_reason:'tool_calls'}]}];
        return new Response(events.map(e=>'data: '+JSON.stringify(e)+'\\n\\n').join('')+'data: [DONE]\\n\\n',{headers:{'Content-Type':'text/event-stream'}});
      }
      if(p.mode==='reasoning-only')return response({content:null,reasoning_content:'SYNTHETIC_OPAQUE_THOUGHT_'+JSON.stringify({tool_calls:[edit]})});
      if(p.mode==='empty'){
        if(p.round===1)return native(edit,cmd('applyPush',{path:'labels',value:{name:'once'}}));
        return response({content:'接下来我会继续处理剩下的内容。'});
      }
      if(p.mode==='resume'){
        p.seenDraft={money:TM_AuthoringAgentUI._ui.draft.fiscalConfig.treasury,labels:TM_AuthoringAgentUI._ui.draft.labels.length};
        if(b.tools)return response({content:'继续处理'});
        return response({content:JSON.stringify({tool_calls:[cmd('applyEdit',{path:'labels.once.text',value:'已补齐'}),done]})});
      }
      if(p.mode==='after-apply'){
        if(b.tools)return response({content:'继续补充未完成内容。'});
        p.current=TM_AuthoringAgentUI._ui.draft.fiscalConfig.treasury;
        return response({content:JSON.stringify({tool_calls:[cmd('applyEdit',{path:'labels.once.text',value:'应用后续做'}),done]})});
      }
      if(p.mode==='disconnect'){
        if(p.round===1)return native(edit);
        throw new TypeError('Failed to fetch');
      }
      if(p.mode==='cancel'){
        if(b.tools)return response({content:'准备继续'});
        p.waiting=true;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{p.cancelled=true;const e=Error('cancelled');e.name='AbortError';reject(e);},{once:true}));
      }
      return native(done);
    };
  })()`);
  if (!await js(`!!document.querySelector('#tm-aa-panel.open')`)) await click(`document.getElementById('tm-aa-fab')`);
  async function fresh(id, mode = 'empty') {
    await click(`document.getElementById('tm-aa-newchat')`);
    await js(`(()=>{TM_SCENARIO_EDITOR_RESET_APP.applyImportedScenario({id:${JSON.stringify(id)},name:'隔离合成案卷',labels:[],factions:[],characters:[],adminHierarchy:{},gameSettings:{startYear:1207,daysPerTurn:30},fiscalConfig:{treasury:100},customPrompt:'玩家手工输入'},'隔离合成案卷');__relayTest={round:0,mode:${JSON.stringify(mode)}};TM_AuthoringAgentUI.permMode('review');})()`);
  }
  const send = async () => { await js(`TM_AuthoringAgentUI._ui.els.req.value='修改国库并添加 once 条目，补充其 text'`); await click(`TM_AuthoringAgentUI._ui.els.go`); };
  const settled = () => until(`!TM_AuthoringAgentUI._ui.running && __relayTest.round>0`);
  await test('empty administrative hierarchy is usable in both views; invalid rows are preserved and identified', async () => {
    await fresh('admin-empty');
    const r = await js(`(()=>{const app=TM_SCENARIO_EDITOR_RESET_APP,out=[];for(const view of ['list','tree']){app.state._adminView=view;app.state.scenario.adminHierarchy={};app.revealModule('adminMap');out.push(document.getElementById('module-detail').textContent);}app.state.scenario.adminHierarchy={bad:null,valid:{factionName:'合成势力',divisions:[]}};const before=JSON.stringify(app.state.scenario);app.revealModule('adminMap');return{out,html:document.getElementById('module-detail').textContent,unchanged:JSON.stringify(app.state.scenario)===before,errors:__relayErrors};})()`);
    assert(r.out.every(s => /暂无行政区划/.test(s))); assert.match(r.html, /合成势力/); assert.match(r.html, /格式无效/); assert(r.unchanged); assert.equal(r.errors.length, 0);
  });
  await test('no-tool response stops within budget and preserves staged work without applying it', async () => {
    await fresh('empty-response'); await send(); await settled();
    const r = await js(`(()=>{const ui=TM_AuthoringAgentUI._ui;return{rounds:__relayTest.round,native:__relayTest.native,compat:__relayTest.compat,draft:ui.draft.fiscalConfig.treasury,live:ui.adapter.getScenario().fiscalConfig.treasury,recovery:!!ui._recovery,status:ui._completion.status,text:ui.els.summary.textContent};})()`);
    assert.equal(r.rounds, 4); assert.equal(r.native, 2); assert.equal(r.compat, 2); assert.equal(r.draft, 450); assert.equal(r.live, 100); assert(r.recovery); assert.equal(r.status, 'blocked'); assert.match(r.text, /工具.*兼容尝试已用尽/);
  });
  await test('both recovery actions have readable opaque colors, spacing and keyboard focus in dark and light themes', async () => {
    const samples = [];
    for (const theme of ['dark', 'light']) {
      await js(`(async()=>{const panel=document.getElementById('tm-aa-panel');panel.dataset.theme=${JSON.stringify(theme)};await Promise.all(panel.getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect.getComputedTiming().iterations)).map(a=>a.finished.catch(()=>{})));})()`);
      const r = await js(`(()=>{document.getElementById('tm-aa-panel').dataset.theme=${JSON.stringify(theme)};const ui=TM_AuthoringAgentUI._ui;return Array.from(ui.els.summary.querySelectorAll('.ec-retry,.ec-restart')).map(e=>{e.focus();const s=getComputedStyle(e),b=e.getBoundingClientRect();return{label:e.textContent,color:s.color,background:s.backgroundColor,height:b.height,padding:s.paddingLeft,outline:s.outlineStyle};});})()`);
      assert.equal(r.length, 2);
      const luminance = value => { const rgb = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
      for (const row of r) { assert(!/rgba.*0\)$|transparent/.test(row.background)); const a=luminance(row.color),b=luminance(row.background); assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5, JSON.stringify(row)); assert(row.height >= 36); assert(parseFloat(row.padding) >= 10); }
      assert.equal(await js(`(()=>{for(const b of TM_AuthoringAgentUI._ui.els.summary.querySelectorAll('.ec-retry,.ec-restart'))for(let e=b;e;e=e.parentElement)if(Number(getComputedStyle(e).opacity)<.99)return false;return true;})()`), true, 'active recovery controls are not faded by an ancestor');
      samples.push({ theme, controls: r });
      await js(`TM_AuthoringAgentUI._ui.els.summary.scrollIntoView({block:'center'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      fs.writeFileSync(path.join(dir, 'recovery-' + theme + '.png'), (await win.webContents.capturePage()).toPNG());
    }
    // Actual Tab navigation, not just a synthetic focus() assertion.
    const beforeFocus = await js(`({documentFocused:document.hasFocus(),active:document.activeElement&&document.activeElement.className})`);
    win.focus(); win.webContents.focus();
    await js(`TM_AuthoringAgentUI._ui.els.summary.querySelector('.ec-retry').focus()`);
    await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    assert.equal(await js(`document.hasFocus() && document.activeElement.classList.contains('ec-retry')`), true, 'Tab fixture owns keyboard focus before dispatch');
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' });
    await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    fs.writeFileSync(path.join(dir, 'recovery-keyboard.json'), JSON.stringify({beforeFocus,after:await js(`({documentFocused:document.hasFocus(),active:document.activeElement.className,outline:getComputedStyle(document.activeElement).outlineStyle})`)}, null, 2));
    assert.equal(await js(`document.activeElement.classList.contains('ec-restart') && getComputedStyle(document.activeElement).outlineStyle!=='none'`), true);
    fs.writeFileSync(path.join(dir, 'recovery-colors.json'), JSON.stringify(samples, null, 2));
  });
  await test('mouse retry resumes JSON mode without duplicating the earlier append; approval survives real reload', async () => {
    await js(`__relayTest={round:0,mode:'resume'}`); await click(`TM_AuthoringAgentUI._ui.els.summary.querySelector('.ec-retry')`); await settled();
    assert.equal(await js(`__relayTest.round===1 && __relayTest.compat===1 && __relayTest.seenDraft.labels===1 && __relayTest.seenDraft.money===450`), true);
    await click(`TM_AuthoringAgentUI._ui.els.apply`);
    await until(`TM_AuthoringAgentUI._ui.adapter.getScenario().fiscalConfig.treasury===450`);
    const r = await js(`(async()=>{const app=TM_SCENARIO_EDITOR_RESET_APP,p=await app.saveProjectSnapshot('合成续做案卷');await app.loadProjectSnapshot(p.id);return{money:app.state.scenario.fiscalConfig.treasury,labels:app.state.scenario.labels,prompt:app.state.scenario.customPrompt};})()`);
    assert.equal(r.money, 450); assert.deepEqual(r.labels, [{ name: 'once', text: '已补齐' }]); assert.equal(r.prompt, '玩家手工输入');
  });
  await test('after explicitly applying partial work, a new message edits the committed draft without replaying append', async () => {
    await fresh('partial-followup'); await send(); await settled();
    await click(`TM_AuthoringAgentUI._ui.els.apply`); assert.equal(await js(`TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury`), 100);
    await click(`TM_AuthoringAgentUI._ui.els.apply`); assert.equal(await js(`TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury`), 450);
    await js(`__relayTest={round:0,mode:'after-apply'}`); await send(); await settled(); await click(`TM_AuthoringAgentUI._ui.els.apply`);
    const r = await js(`({labels:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.labels,money:__relayTest.current,rounds:__relayTest.round})`);
    assert.equal(r.rounds, 2); assert.equal(r.money, 450); assert.deepEqual(r.labels, [{ name: 'once', text: '应用后续做' }]);
  });
  await test('connection failure is bounded and shown distinctly from a no-tool response', async () => {
    await fresh('connection', 'disconnect'); await send(); await settled();
    const r = await js(`(()=>{const ui=TM_AuthoringAgentUI._ui;return{rounds:__relayTest.round,text:ui.els.summary.textContent,draft:ui.draft.fiscalConfig.treasury,live:ui.adapter.getScenario().fiscalConfig.treasury};})()`);
    assert.equal(r.rounds, 5); assert.match(r.text, /已尝试 4 次/); assert.match(r.text, /完整 API 响应/); assert.equal(r.draft, 450); assert.equal(r.live, 100);
  });
  await test('cancelling the compatibility request stops it without a late write or automatic retry', async () => {
    await fresh('cancel', 'cancel'); await send(); await until(`__relayTest.waiting===true`); await click(`TM_AuthoringAgentUI._ui.els.go`); await settled();
    assert.equal(await js(`__relayTest.cancelled && __relayTest.round===2 && TM_AuthoringAgentUI._ui._completion.status==='cancelled' && TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury===100`), true);
  });
  for (const mode of ['reasoning-json', 'reasoning-sse']) await test(mode + ' real editor sends preserved thinking context and applies both steps only after approval', async () => {
    await fresh(mode, mode); await send(); await settled();
    const r = await js(`(()=>{const ui=TM_AuthoringAgentUI._ui;return{rounds:__relayTest.round,compat:__relayTest.compat,checked:__relayTest.checkedTurns,mismatch:!!__relayTest.protocolMismatch,status:ui._completion.status,live:ui.adapter.getScenario().fiscalConfig.treasury,draft:ui.draft.fiscalConfig.treasury,labels:ui.draft.labels,visible:document.getElementById('tm-aa-panel').textContent};})()`);
    assert.equal(r.rounds, 2); assert.equal(r.compat, 0); assert.equal(r.checked, 1); assert.equal(r.mismatch, false); assert.equal(r.status, 'completed');
    assert.equal(r.live, 100); assert.equal(r.draft, 450); assert.deepEqual(r.labels, [{ name: 'once', text: '思考续轮已完成' }]); assert(!r.visible.includes('SYNTHETIC_OPAQUE_THOUGHT'));
    await click(`TM_AuthoringAgentUI._ui.els.apply`);
    const saved = await js(`(async()=>{const app=TM_SCENARIO_EDITOR_RESET_APP,p=await app.saveProjectSnapshot('思考续轮隔离存档');await app.loadProjectSnapshot(p.id);return{money:app.state.scenario.fiscalConfig.treasury,labels:app.state.scenario.labels,prompt:app.state.scenario.customPrompt};})()`);
    assert.equal(saved.money, 450); assert.deepEqual(saved.labels, r.labels); assert.equal(saved.prompt, '玩家手工输入');
  });
  await test('thinking-only responses show bounded specific diagnostics without executing hidden tool-shaped text', async () => {
    await fresh('thinking-only', 'reasoning-only'); await send(); await settled();
    const r = await js(`(()=>{const ui=TM_AuthoringAgentUI._ui;return{rounds:__relayTest.round,status:ui._completion.status,summary:ui.els.summary.textContent,live:ui.adapter.getScenario().fiscalConfig.treasury,draft:ui.draft.fiscalConfig.treasury};})()`);
    assert.equal(r.rounds, 3); assert.equal(r.status, 'blocked'); assert.equal(r.live, 100); assert.equal(r.draft, 100);
    assert.match(r.summary, /只返回了思考内容/); assert.match(r.summary, /正文 0 字/); assert(!r.summary.includes('SYNTHETIC_OPAQUE_THOUGHT'));
  });
  await require('./authoring-response-recovery-cases.cjs')({ win, js, until, click, test });
  fs.writeFileSync(path.join(dir, 'authoring-continuation-results.json'), JSON.stringify({ results, pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length }, null, 2));
  const failures = results.filter(r => r.status === 'FAIL'); if (failures.length) throw Error(failures.map(r => r.name + '\n' + r.error).join('\n'));
};
