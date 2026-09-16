'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
module.exports = async function ({ win, root, temp, check, controls }) {
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
    `(async()=>{const end=Date.now()+20000;while(document.body.dataset.scenarioEditorResetApp!=='ready'){if(Date.now()>end)throw Error('editor not ready');await new Promise(r=>setTimeout(r,30));}})()`,
  );
  const source = require('./native-start-entry-cases.cjs').world();
  await js(
    `(async()=>{const a=TM_SCENARIO_EDITOR_RESET_APP;a.applyImportedScenario(${JSON.stringify(source)},'通用地图制作样本');await a.saveProjectSnapshot('通用地图制作样本');window.__wb={before:JSON.stringify(a.state.scenario),draft:JSON.parse(JSON.stringify(a.state.scenario)),ctx:TM.Workbench.capture()};})()`,
  );
  await check('explicit embedded map asset ID resolves the same pinned bytes as the default, not a nonexistent database file',async()=>{
    const r=await js(`(async()=>{const s=TM.Workbench,d=__wb.draft,c=__wb.ctx,implicit=await s.mapInput(d,c),explicit=await s.mapInput(d,c,d.nativeStart.mapRef.assetId),project=await s.dispatch('inspectProject',{},d,c);let fake=false;try{await s.mapInput(d,c,'invented-map-asset');}catch(e){fake=e.code==='asset-missing';}return{same:implicit.hash===explicit.hash,id:project.currentMap.assetId,fake};})()`);
    assert(r.same&&r.fake);assert.equal(r.id,source.nativeStart.mapRef.assetId);
  });
  await check(
    'existing Guoshi registry performs real worker geometry proposal and draft binding, without touching live',
    async () => {
      const r = await js(
        `(async()=>{const a=TM.AuthoringAgent;let round=0,proposalId;const out=await a.runAuthoringLoop(__wb.draft,'只修改 rb 的显示名为乙郡，保存候选供审阅',{noMemoryRecall:true,maxIterations:4,caller:async(conv,defs)=>{round++;if(!defs.some(t=>t.name==='proposeMapOperations'))throw Error('workbench tools absent from actual model catalogue');if(round===1)return{toolCalls:[{id:'proposal',name:'proposeMapOperations',input:{mapAssetId:__wb.draft.nativeStart.mapRef.assetId,operationId:'flow-proposal',operations:[{type:'renameDisplay',regionId:'rb',name:'乙郡'}]}}]};if(round===2){const text=JSON.stringify(conv),match=text.match(/proposalId[^a-z0-9]+(asset-[a-z0-9]+)/);if(!match)throw Error('actual proposal receipt missing');proposalId=match[1];return{toolCalls:[{id:'apply',name:'applyMapOperations',input:{proposalId}}]};}return{toolCalls:[{id:'finish',name:'finish',input:{summary:'已完成改名与绑定，等待审阅'}}]};}});__wb.proposalId=proposalId;return{finished:out.finished,summary:out.summary,completion:out.completion,receipts:out.toolReceipts.map(r=>({tool:r.tool,ok:r.ok,changed:r.changed,effect:r.effect})),name:out.draft.map.regions.find(r=>r.id==='rb').name,live:JSON.stringify(TM_SCENARIO_EDITOR_RESET_APP.state.scenario)===__wb.before};})()`,
      );
      assert.equal(r.name, '乙郡', JSON.stringify(r));
      assert(r.live);
      assert(r.receipts.some((x) => x.tool === 'proposeMapOperations' && x.ok && x.effect === 'project-stage'));
      assert(r.receipts.some((x) => x.tool === 'applyMapOperations' && x.ok && x.changed));
      assert(r.finished, JSON.stringify(r));
    },
  );
  await check(
    'approved compound proposal commits through existing editor owner, durable root and fresh validation',
    async () => {
      const r = await js(
        `(async()=>{const result=await TM.Workbench.commitDraft(__wb.draft,{lease:__wb.ctx.lease}),a=TM_SCENARIO_EDITOR_RESET_APP,saved=await TM.ProjectAssets.getProject(a.state.currentProjectId);return{result,name:a.state.scenario.map.regions.find(r=>r.id==='rb').name,saved:saved.scenario.map.regions.find(r=>r.id==='rb').name,revision:saved.workbenchRoot.revision,marker:!!a.state.scenario.authoringWorkbench};})()`,
      );
      assert(r.result.ok);
      assert.equal(r.name, '乙郡');
      assert.equal(r.saved, '乙郡');
      assert.equal(r.revision, 2);
      assert(!r.marker);
    },
  );
  await check(
    'real artifacts produce importable JSON, neutral map, projection, binding, CSV, Markdown and ZIP',
    async () => {
      const r = await js(
        `(async()=>{const a=TM_SCENARIO_EDITOR_RESET_APP,ctx=TM.Workbench.capture(),out=[];for(const format of ['scenario','map','editor-map','binding','csv','markdown','zip']){const r=await TM.Workbench.dispatch('buildArtifact',{format,operationId:'flow-artifact-'+format,profileId:'pb'},a.state.scenario,ctx);const v=await TM.WorkbenchArtifacts.validate(a.state.currentProjectId,r.artifactId);out.push({format,valid:v.ok,bytes:v.byteLength,id:r.artifactId});}__wb.artifacts=out;return out;})()`,
      );
      assert.equal(r.length, 7);
      assert(r.every((x) => x.valid && x.bytes > 20));
    },
  );
  controls.saveDialog = { canceled: false, filePath: path.join(temp, 'verified-workbench.zip') };
  await check(
    'actual restricted export bridge writes selected destination and reads identical ZIP bytes back',
    async () => {
      const r = await js(
        `TM.WorkbenchArtifacts.exportFile(TM_SCENARIO_EDITOR_RESET_APP.state.currentProjectId,__wb.artifacts.find(a=>a.format==='zip').id,{userApproved:true})`,
      );
      assert.equal(r.status, 'saved-and-readback-verified');
      assert(fs.statSync(controls.saveDialog.filePath).size > 1000);
    },
  );
  controls.saveDialog = { canceled: true };
  await check('export cancellation retains the exact prepared file', async () => {
    const r = await js(
      `TM.WorkbenchArtifacts.exportFile(TM_SCENARIO_EDITOR_RESET_APP.state.currentProjectId,__wb.artifacts[0].id,{userApproved:true})`,
    );
    assert(r.cancelled && r.retained);
  });
  await check('workbench opens in the real editor with readable controls and real asset rows', async () => {
    const p = await js(
      `(()=>{const el=document.getElementById('tm-workbench-open'),r=el.getBoundingClientRect();return{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`,
    );
    win.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...p });
    win.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...p });
    await new Promise((r) => setTimeout(r, 300));
    const visible = await js(
      `({open:document.getElementById('tm-workbench-panel').open,rows:document.querySelectorAll('.tm-wb-assets article').length,heading:document.querySelector('.tm-wb h2').textContent})`,
    );
    assert(visible.open && visible.rows >= 8);
    fs.writeFileSync(
      path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT), 'native-workbench-panel.png'),
      (await win.webContents.capturePage()).toPNG(),
    );
  });
  await check('native preview uses hash-pinned production renderer, not synthetic image generation', async () => {
    const r = await js(
      `(async()=>{const a=TM_SCENARIO_EDITOR_RESET_APP,report=await TM.Workbench.sandbox(a.state.scenario,TM.Workbench.capture(),{profileId:'pb',preview:true,fiscalPeriods:0});const png=await TM.WorkbenchArtifacts.build(a.state.currentProjectId,{scenario:a.state.scenario,map:(await TM.Workbench.mapInput(a.state.scenario,TM.Workbench.capture())).map,preview:report.preview,report:{runId:report.runId}},'png',{profileId:'pb',operationId:'flow-native-png'});window.__wb.preview=report.preview;return{renderer:report.preview.renderer,regions:report.preview.hitRegions,bytes:png.byteLength,mode:report.mode};})()`,
    );
    assert.equal(r.renderer, 'phase8-formal-map');
    assert.equal(r.mode, 'isolated-native-no-provider');
    assert(r.regions.includes('rb'));
    assert(r.bytes > 500);
    const pixels=await js(`__wb.preview.pixelSummary`);assert(pixels.sampledColors>256,JSON.stringify(pixels));assert(pixels.nearBlackFraction<0.1,JSON.stringify(pixels));
    const data = await js(`__wb.preview.dataUrl`);
    fs.writeFileSync(
      path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT), 'native-workbench-map.png'),
      Buffer.from(data.split(',')[1], 'base64'),
    );
  });
};
