'use strict';
const assert = require('node:assert/strict'),
  path = require('node:path');
module.exports = async function ({ win, root, check }) {
  const js = (s) =>
    win.webContents
      .executeJavaScript(
        `(async()=>{try{return{ok:true,result:await(${s})};}catch(e){return{ok:false,error:String(e.stack||e)}}})()`,
      )
      .then((r) => {
        if (!r.ok) throw Error(r.error);
        return r.result;
      });
  const wait = (expr) =>
    js(
      `(async()=>{const end=Date.now()+20000;while(!(${expr})){if(Date.now()>end)throw Error('workbench UI timed out: '+TM_AuthoringAgentUI._ui.els.status.textContent);await new Promise(r=>setTimeout(r,20));}})()`,
    );
  await win.loadFile(path.join(root, 'web/preview/scenario-editor-reset-preview.html'));
  await wait(`document.body.dataset.scenarioEditorResetApp==='ready'`);
  const source = require('./native-start-entry-cases.cjs').world();
  await js(
    `(async()=>{const a=TM_SCENARIO_EDITOR_RESET_APP;a.applyImportedScenario(${JSON.stringify(source)},'工作台权限样本');await a.saveProjectSnapshot('工作台权限样本');window.__wbp={before:JSON.stringify(a.state.scenario)};})()`,
  );
  await check('actual registry read-only invocation cannot stage maps or hide its failed write', async () => {
    const rows = await js(
      `(async()=>{const a=TM_SCENARIO_EDITOR_RESET_APP,rows=[];for(const mode of ['planOnly','reviewOnly','qaOnly','explainOnly']){const d=JSON.parse(JSON.stringify(a.state.scenario));const out=await TM.AuthoringAgent.runAuthoringLoop(d,'只读检查地图',{[mode]:true,noMemoryRecall:true,maxIterations:1,caller:async()=>({toolCalls:[{id:'denied',name:'proposeMapOperations',input:{operationId:'must-not-stage',operations:[{type:'renameDisplay',regionId:'rb',name:'不得修改'}]}}]})});rows.push({mode,unchanged:JSON.stringify(a.state.scenario)===__wbp.before,count:(await TM.ProjectAssets.listAssets(a.state.currentProjectId)).length,receipts:out.toolReceipts});}return rows;})()`,
    );
    assert.equal(rows.length, 4);
    for (const r of rows) {
      assert(r.unchanged);
      assert.equal(r.count, 0);
      assert(r.receipts.some((x) => !x.ok));
    }
  });
  await check(
    'map parameter schemas reach the caller, exact retries clear only their own failure, and aliases retain the same draft safeguards',
    async () => {
      const r = await js(
        `(async()=>{const a=TM_SCENARIO_EDITOR_RESET_APP,d=JSON.parse(JSON.stringify(a.state.scenario));let round=0,advertised=false;const out=await TM.AuthoringAgent.runAuthoringLoop(d,'修正 rb 显示名，不把无关成功当成完成',{noMemoryRecall:true,maxIterations:6,caller:async(conv,defs)=>{round++;const spec=defs.find(t=>t.name==='proposeMapOperations');advertised=!!spec?.parameters?.properties?.operations?.items?.properties?.name&&spec.parameters.properties.operations.items.properties.type.enum.includes('renameDisplay');const call=(name,input)=>({toolCalls:[{id:'retry-'+round,name,input}]});if(round===1)return call('proposeMapOperations',{operationId:'recover-target',operations:[{type:'renameDisplay',regionId:'rb',name:''}]});if(round===2)return call('proposeMapOperations',{operationId:'unrelated-success',operations:[{type:'renameDisplay',regionId:'ra',name:'无关候选'}]});if(round===3)return call('finish',{summary:'不能用无关成功遮住失败'});if(round===4)return call('proposeMapOperations',{operationId:'recover-target',operations:[{op:'renameDisplay',regionId:'rb',newName:'乙郡'}]});if(round===5){let proposalId;for(const item of conv.slice().reverse()){const match=JSON.stringify(item).match(/proposalId[^a-z0-9]+(asset-[a-z0-9]+)/);if(match){proposalId=match[1];break;}}if(!proposalId)throw Error('real proposal receipt missing');return call('applyMapOperations',{proposalId});}return call('finish',{summary:'rb 已修复且仅应用此候选'});}});return{advertised,finished:out.finished,completion:out.completion,blockedFinish:out.transcript.some(t=>t.name==='finish'&&t.result?.errorCode==='unresolved-writes'),rb:out.draft.map.regions.find(r=>r.id==='rb').name,ra:out.draft.map.regions.find(r=>r.id==='ra').name,live:JSON.stringify(a.state.scenario)===__wbp.before};})()`,
      );
      assert(r.advertised && r.finished && r.blockedFinish && r.live, JSON.stringify(r));
      assert.equal(r.rb, '乙郡');
      assert.equal(r.ra, '甲城');
      assert.equal(r.completion.unresolved.length, 0);
    },
  );
  await check(
    'scope, source evidence, stale input, invalid artifact and cancellation are enforced by the real service',
    async () => {
      const r =
        await js(`(async()=>{const a=TM_SCENARIO_EDITOR_RESET_APP,svc=TM.Workbench,ctx=svc.capture(),d=JSON.parse(JSON.stringify(a.state.scenario)),codes=[];
      async function refused(fn){try{await fn();return false;}catch(e){codes.push(e.code);return true;}}
      const readonly=await refused(()=>svc.dispatch('proposeMapOperations',{operationId:'read-only',operations:[{type:'renameDisplay',regionId:'rb',name:'no'}]},d,svc.capture({readOnly:true})));
      const evidence=await refused(()=>svc.dispatch('proposeMapOperations',{operationId:'fake-evidence',operations:[{type:'classifyHole',regionId:'rb',component:0,ring:1,classification:'water',sourceRef:'invented-source'}]},d,ctx));
      const p=await svc.dispatch('proposeMapOperations',{operationId:'bounded-proposal',operations:[{type:'renameDisplay',regionId:'rb',name:'乙郡'}]},d,ctx);
      const scope=await refused(()=>svc.dispatch('applyMapOperations',{proposalId:p.proposalId},d,svc.capture({permissions:{allowedCollections:['characters']}})));
      const missing=await refused(()=>svc.dispatch('validateArtifact',{artifactId:'invented-file'},d,ctx));
      const ac=new AbortController(),stopped=svc.capture({signal:ac.signal});ac.abort();const cancel=await refused(()=>svc.dispatch('applyMapOperations',{proposalId:p.proposalId},d,stopped));
      await svc.dispatch('applyMapOperations',{proposalId:p.proposalId},d,ctx);a.state.scenario.customPrompt='新的人工作文';const conflict=await refused(()=>svc.commitDraft(d,{lease:ctx.lease}));delete a.state.scenario.customPrompt;
      const old=svc.capture();await a.loadProjectSnapshot(a.state.currentProjectId);const sameNameReload=await refused(()=>svc.dispatch('inspectProject',{},d,old));
      return{readonly,evidence,scope,missing,cancel,conflict,sameNameReload,codes,unchanged:JSON.stringify(a.state.scenario)===__wbp.before};})()`);
      for (const k of ['readonly', 'evidence', 'scope', 'missing', 'cancel', 'conflict', 'sameNameReload', 'unchanged'])
        assert(r[k], JSON.stringify(r));
    },
  );
  await check('durable region grants and cancellation are enforced at proposal and actual project commit', async () => {
    const r =
      await js(`(async()=>{const a=TM_SCENARIO_EDITOR_RESET_APP,S=TM.ProjectAssets,W=TM.Workbench,pid=a.state.currentProjectId,before=JSON.stringify(a.state.scenario);let t=await S.createTask(pid,{request:'只改 rb',budget:{calls:0},allowedRegionIds:['rb']});t=await S.taskChange(pid,t.taskId,'resume',{authorized:true});
      const denied=await TM.AuthoringAgent.runAuthoringLoop(JSON.parse(before),'不得修改 ra',{workbenchTask:{projectId:pid,taskId:t.taskId,generation:t.generation},noMemoryRecall:true,maxIterations:1,caller:async()=>({toolCalls:[{id:'outside',name:'proposeMapOperations',input:{operationId:'outside-region',operations:[{type:'renameDisplay',regionId:'ra',name:'越界'}]}}]})});
      const scoped=denied.toolReceipts.some(r=>!r.ok&&/地块范围/.test(r.reason));t=await S.taskChange(pid,t.taskId,'resume',{authorized:true});const legacyDraft=JSON.parse(before);const bypass=await TM.AuthoringAgent.runAuthoringLoop(legacyDraft,'不能绕过范围',{workbenchTask:{projectId:pid,taskId:t.taskId,generation:t.generation},noMemoryRecall:true,maxIterations:1,caller:async()=>({toolCalls:[{id:'bypass',name:'applyEdit',input:{path:'map.regions.0.name',value:'越界'}}]})});const legacyDenied=JSON.stringify(legacyDraft)===before&&bypass.toolReceipts.some(r=>!r.ok&&/地块/.test(r.reason));t=await S.taskChange(pid,t.taskId,'resume',{authorized:true});let ctx=W.capture();ctx.task={taskId:t.taskId,generation:t.generation};let draft=JSON.parse(before);let p=await W.dispatch('proposeMapOperations',{operationId:'inside-region',operations:[{type:'renameDisplay',regionId:'rb',name:'乙郡'}]},draft,ctx);await W.dispatch('applyMapOperations',{proposalId:p.proposalId},draft,ctx);await S.taskChange(pid,t.taskId,'cancel');let cancelled=false;try{await W.commitDraft(draft,{lease:ctx.lease});}catch(e){cancelled=e.code==='task-not-running';}
      t=await S.createTask(pid,{request:'取消竞态',budget:{calls:0},allowedRegionIds:['rb']});t=await S.taskChange(pid,t.taskId,'resume',{authorized:true});ctx=W.capture();ctx.task={taskId:t.taskId,generation:t.generation};draft=JSON.parse(before);p=await W.dispatch('proposeMapOperations',{operationId:'commit-race',operations:[{type:'renameDisplay',regionId:'rb',name:'乙郡'}]},draft,ctx);await W.dispatch('applyMapOperations',{proposalId:p.proposalId},draft,ctx);const real=a.commitWorkbenchDraft;a.commitWorkbenchDraft=async function(s,label,lease,guard){await S.taskChange(pid,t.taskId,'cancel');return real(s,label,lease,guard);};let raced=false;try{await W.commitDraft(draft,{lease:ctx.lease});}catch(e){raced=e.code==='task-not-running';}finally{a.commitWorkbenchDraft=real;}return{scoped,legacyDenied,cancelled,raced,unchanged:JSON.stringify(a.state.scenario)===before&&JSON.stringify((await S.getProject(pid)).scenario)===before};})()`);
    for (const k of ['scoped', 'legacyDenied', 'cancelled', 'raced', 'unchanged']) assert(r[k], JSON.stringify(r));
  });
  await js(`(()=>{localStorage.setItem('tm_api',JSON.stringify({url:'https://workbench-test.invalid/v1',key:'synthetic-only',model:'controlled'}));localStorage.setItem('tm_aa_microplan','0');const realFetch=window.fetch;window.fetch=async function(url,options){
    if(String(url)!=='https://workbench-test.invalid/v1/chat/completions')return realFetch.apply(this,arguments);
    const p=__wbp,b=JSON.parse(options.body),names=(b.tools||[]).map(t=>t.function.name),cmd=(name,input)=>({id:name+'-'+p.round,type:'function',function:{name,arguments:JSON.stringify(input)}}),native=(...calls)=>new Response(JSON.stringify({choices:[{message:{content:'',tool_calls:calls},finish_reason:'tool_calls'}]}));
    if(names.length===1&&names[0]==='setTitle')return native(cmd('setTitle',{title:'工作台权限验证'}));
    if(names.length===1&&names[0]==='selectMemories')return native(cmd('selectMemories',{names:[]}));
    p.round++;if(p.round===1)return native(cmd('proposeMapOperations',{operationId:'ui-proposal-'+p.permission,operations:[{type:'renameDisplay',regionId:'rb',name:'乙郡'}]}));
    if(p.round===2){const text=JSON.stringify(b.messages),match=text.match(/proposalId[^a-z0-9]+(asset-[a-z0-9]+)/);if(!match)throw Error('real proposal receipt missing');return native(cmd('applyMapOperations',{proposalId:match[1]}));}
    return native(cmd('finish',{summary:'地图整包已核查完成'}));
  };document.getElementById('tm-aa-fab').click();})()`);
  for (const permission of ['review', 'auto']) {
    await check(
      permission + ' mode uses the existing UI approval contract; durable compound apply and undo are coherent',
      async () => {
        await js(
          `(async()=>{document.getElementById('tm-aa-newchat').click();const a=TM_SCENARIO_EDITOR_RESET_APP;a.applyImportedScenario(${JSON.stringify(source)},'工作台界面样本');await a.saveProjectSnapshot('工作台界面样本');__wbp.round=0;__wbp.permission=${JSON.stringify(permission)};TM_AuthoringAgentUI.permMode(${JSON.stringify(permission)});const ui=TM_AuthoringAgentUI._ui;ui.els.req.value='把 rb 改名乙郡；完成后总结';ui.els.go.click();})()`,
        );
        await wait(`!TM_AuthoringAgentUI._ui.running&&__wbp.round>=3`);
        if (permission === 'review') {
          const staged = await js(
            `({live:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.map.regions.find(r=>r.id==='rb').name,draft:TM_AuthoringAgentUI._ui.draft?.map.regions.find(r=>r.id==='rb').name})`,
          );
          assert.equal(staged.live, '乙城');
          assert.equal(staged.draft, '乙郡');
          await js(`TM_AuthoringAgentUI._ui.els.apply.click()`);
          await wait(`!TM_AuthoringAgentUI._ui.running`);
        }
        const r = await js(
          `(async()=>{const a=TM_SCENARIO_EDITOR_RESET_APP,s=await TM.ProjectAssets.getProject(a.state.currentProjectId);return{live:a.state.scenario.map.regions.find(r=>r.id==='rb').name,saved:s.scenario.map.regions.find(r=>r.id==='rb').name,draft:!!TM_AuthoringAgentUI._ui.draft,status:TM_AuthoringAgentUI._ui.els.status.textContent,validation:TM.AuthoringAgent.validateDraft(TM_AuthoringAgentUI._ui.draft||a.state.scenario)};})()`,
        );
        assert.equal(r.live, '乙郡', JSON.stringify(r));
        assert.equal(r.saved, '乙郡');
        assert(!r.draft);
        assert.equal(await js(`TM_AuthoringAgentUI.undo()`), true);
        const undo = await js(
          `(async()=>{const a=TM_SCENARIO_EDITOR_RESET_APP;await a.saveProjectSnapshot('撤销后的案卷');await a.loadProjectSnapshot(a.state.currentProjectId);return{live:a.state.scenario.map.regions.find(r=>r.id==='rb').name,map:(await TM.Workbench.mapInput(a.state.scenario,TM.Workbench.capture())).map.cells.find(r=>r.id==='rb').name||null};})()`,
        );
        assert.equal(undo.live, '乙城');
        assert.equal(undo.map, null);
      },
    );
  }
};
