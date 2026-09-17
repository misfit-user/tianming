'use strict';
const assert = require('node:assert/strict'),
  path = require('node:path');
module.exports = async function ({ win, root, check, mode }) {
  const js = (s) =>
    win.webContents
      .executeJavaScript(
        `(async()=>{try{return{ok:true,result:await(${s})};}catch(e){return{ok:false,error:String(e.stack||e)}}})()`,
      )
      .then((r) => {
        if (!r.ok) throw Error(r.error);
        return r.result;
      });
  await win.loadFile(path.join(root, 'web/preview/scenario-editor-reset-preview.html'));
  await js(
    `(async()=>{const end=Date.now()+30000;while(document.body.dataset.scenarioEditorResetApp!=='ready'){if(Date.now()>end)throw Error('editor not ready');await new Promise(r=>setTimeout(r,30));}})()`,
  );
  if (mode === 'native-start-workbench-restart') {
    await check(
      'project root and verified bytes survive a new Electron process in the existing editor library',
      async () => {
        const r = await js(
          `(async()=>{const id=localStorage.getItem('test-workbench-project'),assetId=localStorage.getItem('test-workbench-asset');await TM_SCENARIO_EDITOR_RESET_APP.loadProjectSnapshot(id);const a=await TM.ProjectAssets.getAsset(id,assetId);return{project:TM_SCENARIO_EDITOR_RESET_APP.state.currentProjectId,revision:TM_SCENARIO_EDITOR_RESET_APP.state.workbenchRoot.revision,name:TM_SCENARIO_EDITOR_RESET_APP.state.scenario.name,text:TM.ProjectAssets.decode(a.bytes),tasks:(await TM.ProjectAssets.listTasks(id)).map(t=>({status:t.status,calls:t.used.calls}))};})()`,
        );
        assert(r.project && r.revision >= 2);
        assert.equal(r.text, '真实字节，不是伪路径');
        assert.equal(r.tasks[0].status, 'cancelled');
        assert.equal(r.tasks[0].calls, 1);
      },
    );
    return;
  }
  await check('normal editor save/load uses the single canonical project body and stable revision', async () => {
    const r = await js(
      `(async()=>{const a=TM_SCENARIO_EDITOR_RESET_APP;a.applyImportedScenario({id:'wb-world',name:'资产事务隔离样本',characters:[],factions:[],map:{regions:[]}},'隔离样本');const first=await a.saveProjectSnapshot('资产事务隔离样本');await a.loadProjectSnapshot(first.id);const id=a.state.currentProjectId;a.commitScenarioEdit(Object.assign({},a.state.scenario,{name:'已编辑的隔离案卷'}),'更名',a.captureDocumentLease());const second=await a.saveProjectSnapshot('已编辑的隔离案卷');localStorage.setItem('test-workbench-project',id);return{id1:first.id,id2:second.id,r1:first.workbenchRoot.revision,r2:second.workbenchRoot.revision,name:(await TM.ProjectAssets.getProject(id)).scenario.name};})()`,
    );
    assert.equal(r.id1, r.id2);
    assert.equal(r.r1, 1);
    assert.equal(r.r2, 2);
    assert.equal(r.name, '已编辑的隔离案卷');
  });
  await check(
    'immutable asset readback, operation retries and project isolation are real IDB transactions',
    async () => {
      const r = await js(
        `(async()=>{const s=TM.ProjectAssets,id=localStorage.getItem('test-workbench-project'),meta={kind:'source',mediaType:'text/plain',license:'synthetic-test'},a=await s.putAsset(id,'真实字节，不是伪路径',meta,{operationId:'asset-op'}),b=await s.putAsset(id,'真实字节，不是伪路径',meta,{operationId:'asset-op'});const aid=a.artifacts[0].assetId;localStorage.setItem('test-workbench-asset',aid);let mismatch=false,cross=false;try{await s.putAsset(id,'不同字节',meta,{operationId:'asset-op'});}catch(e){mismatch=e.code==='operation-id-reused';}try{await s.getAsset('other-project',aid);}catch(e){cross=e.code==='asset-missing';}return{replayed:b.replayed,mismatch,cross,text:s.decode((await s.getAsset(id,aid)).bytes),count:(await s.listAssets(id)).length};})()`,
      );
      assert(r.replayed && r.mismatch && r.cross);
      assert.equal(r.text, '真实字节，不是伪路径');
      assert.equal(r.count, 1);
    },
  );
  await check(
    'root CAS rejects stale saves, actual IDB abort preserves root and prepared orphan evidence',
    async () => {
      const r = await js(
        `(async()=>{const s=TM.ProjectAssets,id=localStorage.getItem('test-workbench-project'),before=await s.getProject(id),after=JSON.parse(JSON.stringify(before));after.scenario.name='不能提交';let stale=false,aborted=false;try{await s.saveProject(after,{expected:{revision:0,worldHash:null}});}catch(e){stale=e.code==='project-conflict';}try{await s.saveProject(after,{expected:before.workbenchRoot,fault:'before-commit'});}catch(e){aborted=true;}return{stale,aborted,unchanged:JSON.stringify(await s.getProject(id))===JSON.stringify(before),prepared:(await s.journal(id)).prepared.length};})()`,
      );
      assert(r.stale && r.aborted && r.unchanged);
      assert(r.prepared > 0);
    },
  );
  await check('durable call reservation is before dispatch; cancellation rejects late candidate writes', async () => {
    const r = await js(
      `(async()=>{const s=TM.ProjectAssets,id=localStorage.getItem('test-workbench-project');let t=await s.createTask(id,{budget:{calls:1,inputBytes:100,artifactBytes:1000,concurrency:1}});t=await s.taskChange(id,t.taskId,'resume',{authorized:true});await s.reserveCall(id,t.taskId,'controlled-call',10,{taskGeneration:t.generation});let replay=false,late=false;try{await s.reserveCall(id,t.taskId,'controlled-call',10,{taskGeneration:t.generation});}catch(e){replay=e.code==='call-already-dispatched';}await s.taskChange(id,t.taskId,'cancel');try{await s.putAsset(id,'late',{kind:'report',mediaType:'text/plain'},{taskId:t.taskId,taskGeneration:t.generation});}catch(e){late=e.code==='task-not-running';}return{replay,late,calls:(await s.listTasks(id))[0].used.calls};})()`,
    );
    assert(r.replay && r.late);
    assert.equal(r.calls, 1);
  });
};
