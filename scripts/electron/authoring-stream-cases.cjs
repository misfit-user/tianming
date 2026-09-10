'use strict';
// Real editor UI + default AuthoringAgent caller/provider + real draft commit and IndexedDB.
// Only the remote model response is controlled; no replacement agent/adapter/bridge.
const assert = require('assert/strict'), path = require('path'), fs = require('fs');
module.exports = async function({ win, root, check }) {
  const js = s => win.webContents.executeJavaScript(s, true);
  const until = expression => js(`(async()=>{const start=performance.now();while(!(${expression})){if(performance.now()-start>20000)throw Error('authoring UI wait exceeded: '+${JSON.stringify(expression)});await new Promise(r=>setTimeout(r,20));}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return true;})()`);
  const ready = () => until(`document.body.dataset.scenarioEditorResetApp==='ready'`);
  const hittable = expr => until(`(()=>{const b=${expr};if(!b)return false;for(let e=b;e;e=e.parentElement){const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)<0.99)return false;}const r=b.getBoundingClientRect();return r.width>0&&r.height>0&&b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()`);
  await win.loadFile(path.join(root, 'web/preview/scenario-editor-reset-preview.html')); await ready();
  await js(`(()=>{
    const input={id:'stream-fixture',name:'流式回归原剧本',gameSettings:{startYear:1207,daysPerTurn:30},factions:[],characters:[],fiscalConfig:{treasury:3000000}};
    input.auditFields=Object.fromEntries(Array.from({length:37},(_,i)=>['f'+(i+1),i]));
    window.__aaStream={original:JSON.stringify(input),round:0,mode:'long',cancelled:0,bodies:[]};
    TM_SCENARIO_EDITOR_RESET_APP.applyImportedScenario(input,'隔离流式回归');
    localStorage.setItem('tm_api',JSON.stringify({url:'https://authoring.invalid/v1',key:'isolated-stream-regression-only',model:'controlled',temp:0.2}));
    window.fetch=async function(url,options){
      if(String(url)!=='https://authoring.invalid/v1/chat/completions')throw Error('test-external-network-denied');
      const p=__aaStream,body=JSON.parse(options.body),toolNames=(body.tools||[]).map(t=>t.function.name);
      if(toolNames.length===1&&toolNames[0]==='setTitle'){p.titleCalls=(p.titleCalls||0)+1;return new Response(JSON.stringify({choices:[{message:{tool_calls:[{id:'title',type:'function',function:{name:'setTitle',arguments:JSON.stringify({title:'隔离国师回归'})}}]},finish_reason:'tool_calls'}]}),{headers:{'Content-Type':'application/json'}});}
      p.bodies.push({toolNames,hasToolResult:body.messages.some(m=>m.role==='tool')});p.round++;
      const tool=(name,input)=>({index:0,id:'call-'+p.round,type:'function',function:{name,arguments:JSON.stringify(input)}});
      const event=d=>'data: '+JSON.stringify(d)+'\\n\\n';
      const finish=tool('finish',{summary:'已完成国库设定修改，并核对剧本字段。'});
      const edit=tool('multiEdit',{edits:[{path:'name',value:'流式国师修改结果'},{path:'fiscalConfig.treasury',value:p.mode==='recover'?4500000:4000000}]});
      const selected=p.mode==='long'?(p.round<38?tool('getField',{path:'auditFields.f'+p.round}):(p.round===38?edit:finish)):(p.round===1?edit:finish);
      let raw=event({choices:[{index:0,delta:{tool_calls:[selected]}}]})+event({choices:[{index:0,delta:{},finish_reason:'tool_calls'}]})+'data: [DONE]\\n\\n';
      if(p.mode==='broken')raw=event({choices:[{delta:{tool_calls:[edit]}}]})+'data: {invalid PRIVATE-RESPONSE}\\n\\ndata: [DONE]\\n\\n';
      if(p.mode==='cancel')return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(event({choices:[{delta:{tool_calls:[edit]}}]})));},cancel(){p.cancelled++;}}),{headers:{'Content-Type':'text/event-stream'}});
      if(p.mode==='long'&&p.round<39)return new Response(JSON.stringify({choices:[{message:{content:'核查字段',tool_calls:[selected]},finish_reason:'tool_calls'}]}),{headers:{'Content-Type':'application/json'}});
      const bytes=new TextEncoder().encode(raw);let at=0;
      return new Response(new ReadableStream({pull(c){if(at>=bytes.length)return c.close();c.enqueue(bytes.slice(at,at+7));at+=7;}}),{headers:{'Content-Type':'application/json'}}); // 故意误标，按真实正文识别。
    };
    if(!document.getElementById('tm-aa-panel')||!document.getElementById('tm-aa-panel').classList.contains('open'))document.getElementById('tm-aa-fab').click();TM_AuthoringAgentUI.permMode('review');
  })()`);
  await check('authoring-stream-real-editor-and-default-provider', async () => {
    assert.equal(await js(`!!TM.AuthoringAgent.callWithTools && TM_AuthoringAgentUI._ui.els.panel.classList.contains('open') && tianming.isDesktop===true && typeof require==='undefined'`), true);
  });
  async function send(text) {
    await js(`(()=>{const ui=TM_AuthoringAgentUI._ui;ui.els.req.value=${JSON.stringify(text)};ui.els.req.dispatchEvent(new Event('input',{bubbles:true}));ui.els.go.click();})()`);
  }
  await send('请批量把剧本名称和国库设定修改为测试值，并完成核验。');
  await until(`!TM_AuthoringAgentUI._ui.running && (!!TM_AuthoringAgentUI._ui._lastDiffs || !!document.querySelector('.tm-aa-errcard'))`);
  await check('authoring-stream-round39-finish-shows-real-diff-and-apply-button', async () => {
    const r = await js(`(()=>{const ui=TM_AuthoringAgentUI._ui;return {round:__aaStream.round,error:!!document.querySelector('.tm-aa-errcard'),status:ui.els.status.textContent,diffs:ui._lastDiffs&&ui._lastDiffs.map(d=>d.path),applyVisible:ui.els.actions.style.display!=='none',hasPairedToolResults:__aaStream.bodies.slice(1).every(b=>b.hasToolResult),source:JSON.stringify(TM_SCENARIO_EDITOR_RESET_APP.state.scenario),original:__aaStream.original};})()`);
    assert.equal(r.round, 39, JSON.stringify(r)); assert.equal(r.error, false); assert(r.status.includes('完成')); assert(r.diffs.includes('name') && r.diffs.includes('fiscalConfig.treasury')); assert(r.applyVisible && r.hasPairedToolResults); assert.equal(r.source, r.original);
  });
  await until(`TM_AuthoringAgentUI._ui.els.summary.textContent.includes('并核对剧本字段。')`);
  await hittable('TM_AuthoringAgentUI._ui.els.apply');
  fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT), 'authoring-final-diff.png'), (await win.webContents.capturePage()).toPNG());
  await check('authoring-stream-real-apply-commits-selected-changes-not-before-approval', async () => {
    assert.equal(await js(`(()=>{const ui=TM_AuthoringAgentUI._ui;ui.els.apply.click();const s=TM_SCENARIO_EDITOR_RESET_APP.state.scenario;return s.name==='流式国师修改结果' && s.fiscalConfig.treasury===4000000 && ui.els.status.textContent.includes('已应用到剧本');})()`), true);
  });
  const snapshot = await js(`TM_SCENARIO_EDITOR_RESET_APP.saveProjectSnapshot('流式国师隔离回归',{newCopy:true}).then(s=>({id:s.id}))`);
  await win.loadFile(path.join(root, 'web/preview/scenario-editor-reset-preview.html')); await ready();
  await check('authoring-stream-applied-result-survives-real-editor-reload', async () => {
    assert.equal(await js(`TM_SCENARIO_EDITOR_RESET_APP.loadProjectSnapshot(${JSON.stringify(snapshot.id)}).then(()=>{const s=TM_SCENARIO_EDITOR_RESET_APP.state.scenario;return s.name==='流式国师修改结果'&&s.fiscalConfig.treasury===4000000;})`), true);
  });
  // A fresh default-provider run in the reloaded editor: malformed tail must not
  // execute its complete-looking first edit; the real retry button then recovers.
  await js(`(()=>{
    window.__aaStream={round:0,mode:'broken',cancelled:0,before:JSON.stringify(TM_SCENARIO_EDITOR_RESET_APP.state.scenario)};
    window.fetch=async function(url,options){
      if(String(url)!=='https://authoring.invalid/v1/chat/completions')throw Error('test-external-network-denied');
      const p=__aaStream,body=JSON.parse(options.body),names=(body.tools||[]).map(t=>t.function.name);
      if(names.length===1&&names[0]==='setTitle'){p.titleCalls=(p.titleCalls||0)+1;return new Response(JSON.stringify({choices:[{message:{tool_calls:[{id:'title',type:'function',function:{name:'setTitle',arguments:JSON.stringify({title:'隔离重试'})}}]},finish_reason:'tool_calls'}]}),{headers:{'Content-Type':'application/json'}});}
      p.round++;
      const tool=(name,input)=>({index:0,id:'call-retry-'+p.round,type:'function',function:{name,arguments:JSON.stringify(input)}});
      const selected=p.round===1?tool('applyEdit',{path:'fiscalConfig.treasury',value:p.mode==='cancel'?4700000:4500000}):tool('finish',{summary:'重试已完整修改国库。'});
      const event=d=>'data: '+JSON.stringify(d)+'\\n\\n';
      let raw=event({choices:[{delta:{tool_calls:[selected]}}]});
      if(p.mode==='broken')raw+='data: {invalid PRIVATE-RESPONSE}\\n\\n';
      else raw+=event({choices:[{delta:{},finish_reason:'tool_calls'}]});
      if(p.mode==='cancel')return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(raw));},cancel(){p.cancelled++;}}));
      return new Response(raw+'data: [DONE]\\n\\n',{headers:{'Content-Type':'text/event-stream'}});
    };
    if(!document.getElementById('tm-aa-panel')||!document.getElementById('tm-aa-panel').classList.contains('open'))document.getElementById('tm-aa-fab').click();TM_AuthoringAgentUI.permMode('review');
  })()`);
  await send('请批量修改剧本名称并将国库存银改成450万，再核验。'); await until(`!TM_AuthoringAgentUI._ui.running && !!document.querySelector('.tm-aa-errcard')`);
  await check('authoring-stream-bad-tail-rejects-all-tools-and-shows-safe-retry', async () => {
    const r = await js(`({count:__aaStream.round,message:document.querySelector('.tm-aa-errcard').textContent,source:JSON.stringify(TM_SCENARIO_EDITOR_RESET_APP.state.scenario),before:__aaStream.before,draft:TM_AuthoringAgentUI._ui.draft.fiscalConfig.treasury})`);
    assert.equal(r.count, 1); assert.equal(r.source, r.before); assert.equal(r.draft, 4000000); assert(r.message.includes('重试')); assert(!r.message.includes('PRIVATE-RESPONSE'));
  });
  await hittable(`document.querySelector('.tm-aa-errcard .ec-retry')`);
  fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT), 'authoring-error-recovery.png'), (await win.webContents.capturePage()).toPNG());
  await js(`__aaStream.mode='recover';__aaStream.round=0;document.querySelector('.tm-aa-errcard .ec-retry').click()`); await until(`!TM_AuthoringAgentUI._ui.running && TM_AuthoringAgentUI._ui.els.actions.style.display!=='none'`);
  await check('authoring-stream-real-retry-finishes-and-applies-to-current-scenario', async () => {
    const r = await js(`(()=>{const ui=TM_AuthoringAgentUI._ui;ui.els.apply.click();return {count:__aaStream.round,money:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.fiscalConfig.treasury,status:ui.els.status.textContent};})()`);
    assert.equal(r.count, 2); assert.equal(r.money, 4500000); assert(r.status.includes('已应用到剧本'));
  });
  await js(`__aaStream.mode='cancel';__aaStream.round=0;__aaStream.before=JSON.stringify(TM_SCENARIO_EDITOR_RESET_APP.state.scenario)`);
  await send('请继续批量修改，但本次将停止。'); await until(`__aaStream.round===1 && TM_AuthoringAgentUI._ui.running`); await js(`TM_AuthoringAgentUI._ui.els.go.click()`); await until(`!TM_AuthoringAgentUI._ui.running`);
  await check('authoring-stream-real-stop-cancels-body-and-does-not-apply-prefix', async () => {
    assert.equal(await js(`__aaStream.cancelled===1 && __aaStream.round===1 && TM_AuthoringAgentUI._ui.draft.fiscalConfig.treasury===4500000 && JSON.stringify(TM_SCENARIO_EDITOR_RESET_APP.state.scenario)===__aaStream.before`), true);
  });
};
