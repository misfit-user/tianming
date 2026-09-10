'use strict';
// Actual editor/provider/IPC/game initialization; synthetic requests and official
// scenario clones only. No real model, account, player save or FPS claim.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto');
module.exports=async function({win,root,check}){
 const js=s=>win.webContents.executeJavaScript(s,true),observations=[];
 const until=expr=>js(`(async()=>{const t=Date.now();while(!(${expr})){if(Date.now()-t>20000)throw Error('efficiency wait');await new Promise(r=>setTimeout(r,20));}return true;})()`);
 await win.loadFile(path.join(root,'web/preview/scenario-editor-reset-preview.html'));await until(`document.body.dataset.scenarioEditorResetApp==='ready'`);
 await check('real editor stops repeated reads, keeps draft and shows actual request statistics',async()=>{
  await js(`(()=>{TM_SCENARIO_EDITOR_RESET_APP.applyImportedScenario({id:'spin',name:'原',labels:[],fiscalConfig:{treasury:100}},'隔离测试');localStorage.setItem('tm_api',JSON.stringify({url:'https://efficiency.invalid',key:'synthetic-only',model:'controlled'}));window.__eff={calls:0,tools:[]};window.fetch=async function(u,o){if(String(u).indexOf('https://efficiency.invalid')!==0)throw Error('network denied');const b=JSON.parse(o.body),names=(b.tools||[]).map(t=>t.function.name);const response=(name,input)=>new Response(JSON.stringify({choices:[{message:{tool_calls:[{id:'f',type:'function',function:{name,arguments:JSON.stringify(input)}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:10,completion_tokens:2,total_tokens:12}}));if(names.length===1&&names[0]==='setTitle')return response('setTitle',{title:'隔离核对'});if(names.length===1&&names[0]==='selectMemories')return response('selectMemories',{names:[]});__eff.calls++;__eff.tools.push(names.length);return response('getField',{path:'name'});};document.getElementById('tm-aa-fab').click();TM_AuthoringAgentUI.permMode('review');const ui=TM_AuthoringAgentUI._ui;ui.els.req.value='修改名称';ui.els.go.click();})()`);
  await until(`!TM_AuthoringAgentUI._ui.running&&__eff.calls>0`);
  const r=await js(`(()=>{const ui=TM_AuthoringAgentUI._ui;TM_AuthoringAgentUI.showUsage();return{calls:__eff.calls,tools:__eff.tools[0],status:ui.els.status.textContent,source:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.name,draft:ui.draft.name,metrics:ui._lastRunMeta.metrics,usage:document.querySelector('.tm-aa-request-metrics')?.textContent};})()`);
  assert(r.calls<20);assert(r.tools<24);assert.equal(r.source,'原');assert.equal(r.draft,'原');assert.equal(r.metrics.httpRequests,r.calls);assert.equal(r.metrics.inputTokens,r.calls*10);assert.match(r.usage,/服务商已报告/);observations.push({kind:'controlled-spin',...r,status:undefined,usage:undefined});
 });
 await check('real manual compression retains long user instructions across repeated compression',async()=>{
  const r=await js(`(async()=>{const aa=TM.AuthoringAgent,raw='保留设定'.repeat(600)+'末段硬约束：不删除任何人物。';window.fetch=async()=>new Response(JSON.stringify({choices:[{message:{tool_calls:[{id:'s',function:{name:'submitSummary',arguments:JSON.stringify({summary:'已核查部分字段，仍须遵守全部用户约束。'.repeat(20)})}}]},finish_reason:'tool_calls'}]}));let conv=[{role:'user',text:raw,userInstruction:raw},...Array.from({length:8},()=>({role:'assistant',text:'进度'}))];for(let i=0;i<2;i++){const r=await aa.compactConversation(conv,{name:'原'},{keepTail:2});if(!r.ok||!r.conversation[0].text.includes(raw))return false;conv=r.conversation.concat(Array.from({length:4},()=>({role:'assistant',text:'后续'})));}return true;})()`);assert(r);
 });
 const sid=process.env.TM_RELIEF_SCENARIO || 'sc-tianqi7-1627';
 const files=fs.readdirSync(path.join(root,'scenarios')).filter(f=>f.endsWith('（官方）.json')&&JSON.parse(fs.readFileSync(path.join(root,'scenarios',f),'utf8')).id===sid);
 assert.equal(files.length,1,'one official fixture per isolated runtime');
 for(const file of files){const raw=fs.readFileSync(path.join(root,'scenarios',file),'utf8'),input=JSON.parse(raw);let edited;
  await check('official authoring tasks preserve input, accepted paths and real persistence: '+input.id,async()=>{
   await js(`(()=>{document.getElementById('tm-aa-newchat').click();const aa=TM.AuthoringAgent,app=TM_SCENARIO_EDITOR_RESET_APP;app.applyImportedScenario(${raw},'官方隔离样本');window.__official={before:JSON.stringify(app.state.scenario),draft:aa.makeDraft(app.state.scenario)};})()`);
   const result=await js(`(async()=>{
    const aa=TM.AuthoringAgent,t=__official,d=t.draft;
    const edits=[{path:'guoku.initialMoney',value:900123},{path:'neitang.initialMoney',value:123987}];
    const contract=aa.dispatchTool(d,'fieldContract',{field:'officeTree'}),sources=contract.runtimeSources||[];
    const own=sources.find(s=>s.faction && (s.faction===d.playerInfo.factionName||s.factionId===d.playerInfo.factionId));
    const office=own?own.path+'[0].desc':(d.government?.nodes?.length?'government.nodes[0].desc':'officeTree[0].desc');edits.push({path:office,value:'隔离官制职责验收'});
    const variables=Array.isArray(d.variables)?d.variables:d.variables.base,vp=Array.isArray(d.variables)?'variables':'variables.base',mx=variables.findIndex(v=>v.name==='民心');
    if(mx>=0)edits.push({path:vp+'['+mx+'].'+(variables[mx].value!==undefined?'value':'initial'),value:77});
    const calls=[{id:'e',name:'multiEdit',input:{edits}}];if(mx<0)calls.push({id:'p',name:'applyPush',input:{path:vp,value:{name:'民心',initial:77,min:0,max:100}}});calls.push({id:'f',name:'finish',input:{summary:'已修改指定路径'}});
    const r=await aa.runAuthoringLoop(d,'按验收修改财政、民心、官制并保留其余内容',{noMemoryRecall:true,conventions:'',toolPacks:false,blockingChecks:[],caller:async()=>({toolCalls:calls})});if(!r.finished)throw Error(r.stopReason);
    const diffs=aa.computeDiff(TM_SCENARIO_EDITOR_RESET_APP.state.scenario,d);if(JSON.stringify(TM_SCENARIO_EDITOR_RESET_APP.state.scenario)!==t.before)throw Error('live mutated');
    if(!aa.makeResetEditorAdapter(window).commit(d).ok)throw Error('commit rejected');const p=await TM_SCENARIO_EDITOR_RESET_APP.saveProjectSnapshot('隔离官方验收');await TM_SCENARIO_EDITOR_RESET_APP.loadProjectSnapshot(p.id);
    const saved=TM_SCENARIO_EDITOR_RESET_APP.state.scenario;return{draft:saved,paths:diffs.map(x=>x.path),fingerprint:await TM.AgentKernel.fingerprintScenario(saved)};
   })()`);
   edited=result.draft;assert.equal(edited.guoku.initialMoney,900123);assert.equal(edited.neitang.initialMoney,123987);assert.equal(edited.characters.length,input.characters.length);assert(result.paths.every(p=>/^(guoku|neitang|officeTree|government|variables|factions)/.test(p)));assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'scenarios',file))).digest('hex'),crypto.createHash('sha256').update(raw).digest('hex'));observations.push({kind:'official-accepted-task',id:input.id,paths:result.paths,fingerprint:result.fingerprint});
  });
  await check('actual game consumes edited fiscal initials and preserves canonical ledgers: '+input.id,async()=>{
   await js(`localStorage.removeItem('tm_api')`); // 只清本测试刚写入的合成配置，游戏开局不得继承测试key。
   await win.loadFile(path.join(root,'web/index.html'));
   const r=await js(`(async()=>{
    if(P.ai?.key)throw Error('unexpected key');const sc=${JSON.stringify(edited)},before=JSON.stringify(sc),expected=JSON.parse(before);
    EconomyGapFill.buildHierarchyFromAdminDepth(expected);P.scenarios=P.scenarios.filter(s=>s.id!==sc.id);P.scenarios.push(sc);P.conf.fixedSeed='authoring-acceptance';const initial={};
    for(const [engine,key] of [[GuokuEngine,'guoku'],[NeitangEngine,'neitang']]){const old=engine.initFromDynasty;engine.initFromDynasty=function(...a){const r=old.apply(this,a),g=GM[key];initial[key]={balance:g.balance,money:g.money,stock:g.ledgers.money.stock};return r;};}
    const pin=_tmStartPinMinxinFromVars;window._tmStartPinMinxinFromVars=function(sc){const r=pin(sc),values=[];function walk(nodes){for(const n of nodes||[]){const kids=n.children||n.divisions||n.subRegions||[];if(kids.length)walk(kids);else values.push(n.minxinLocal);}}walk(P.adminHierarchy.player.divisions);initial.minxinLeaves=[...new Set(values)];return r;};
    doActualStart(sc.id);await _tmAwaitLoadBarrier();return{sid:GM.sid,initial,sourceUnchanged:before===JSON.stringify(sc),sourceMatchesDeclaredInitialization:JSON.stringify(expected)===JSON.stringify(sc),canonical:['guoku','neitang'].every(k=>GM[k].balance===GM[k].money&&GM[k].money===GM[k].ledgers.money.stock),officeDescription:GM.officeTree?.[0]?.desc,minxin:GM.minxin?.trueIndex};
   })()`);
   console.log('AUTHORING_RUNTIME_OBSERVATION '+JSON.stringify(r));
   assert.equal(r.sid,input.id);assert(r.sourceMatchesDeclaredInitialization,'only the existing level initialization may change runtime input; saved editor source remains separate');assert(r.canonical);assert.deepEqual(r.initial.guoku,{balance:900123,money:900123,stock:900123});assert.deepEqual(r.initial.neitang,{balance:123987,money:123987,stock:123987});observations.push({kind:'actual-game-consumer',...r});
   assert.equal(r.officeDescription,'隔离官制职责验收');assert.deepEqual(r.initial.minxinLeaves,[77]);assert(Number.isFinite(r.minxin)&&r.minxin>=0&&r.minxin<=100);
   await win.loadFile(path.join(root,'web/preview/scenario-editor-reset-preview.html'));await until(`document.body.dataset.scenarioEditorResetApp==='ready'`);
  });
 }
 await check('quick-test report is bound to exact frozen input, stale or legacy reports remain historical',async()=>{
  const r=await js(`(async()=>{const aa=TM.AuthoringAgent,sc={id:'same',name:'甲'},fp=await TM.AgentKernel.fingerprintScenario(sc);async function put(report){return new Promise((resolve,reject)=>{const q=indexedDB.open('tm-scenario-editor-reset-projects',1);q.onsuccess=()=>{const db=q.result,tx=db.transaction('projectBodies','readwrite');tx.objectStore('projectBodies').put({id:'quickTestReport:latest',quickTest:report});tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});}await put({createdAt:'isolated',sourceFingerprint:fp});const same=await aa.dispatchTool(sc,'readQuickTestReport',{});sc.name='乙';const changed=await aa.dispatchTool(sc,'readQuickTestReport',{});await put({createdAt:'legacy'});const legacy=await aa.dispatchTool(sc,'readQuickTestReport',{});return same.matchesCurrentDraft===true&&changed.matchesCurrentDraft===false&&legacy.matchesCurrentDraft===false;})()`);assert(r);
 });
 fs.writeFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT),'authoring-task-acceptance.json'),JSON.stringify({observations,scope:'controlled responses and actual editor/game consumers; no model-quality or frame-rate claim'},null,2));
};
