'use strict';
// Actual editor HTML, AuthoringAgent adapter and IndexedDB persistence in the
// existing real Electron gate. No AI/network stub, mouse claim or live userData.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), crypto = require('crypto');
module.exports = async function({ win, root, check }) {
  const file = process.env.TM_AUTHORING_REGION_FIXTURE;
  const synthetic = { id: 'authoring-path-fixture', name: '地区编辑隔离回归', gameSettings: { startYear: 1207, daysPerTurn: 30 },
    playerInfo: { factionName: '楚' }, factions: [{ id: 'f-1', name: '楚' }], characters: [],
    map: { regions: [{ id: 'r-a', name: '雅州' }] }, adminHierarchy: { 楚: { divisions: [{ id: 'r-a', name: '雅州', minxinLocal: 58, economyBase: { farmland: 112 } }] } } };
  const raw = file ? fs.readFileSync(file, 'utf8') : JSON.stringify(synthetic);
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const js = source => win.webContents.executeJavaScript(source, true);
  const ready = () => js(`(async()=>{const start=performance.now();while(document.body.dataset.scenarioEditorResetApp!=='ready'){if(performance.now()-start>10000)throw Error('editor IndexedDB initialization did not finish');await new Promise(r=>setTimeout(r,20));}return true;})()`);
  await win.loadFile(path.join(root, 'web/preview/scenario-editor-reset-preview.html'));
  await ready();
  await check('actual-editor-page-and-bridge', async () => {
    assert.equal(await js(`document.body.dataset.scenarioEditorResetApp==='ready' && !!TM.AuthoringAgent && !!TM_SCENARIO_EDITOR_RESET_APP && tianming.isDesktop===true && typeof require==='undefined'`), true);
  });
  await js(`window.__regionInput=JSON.parse(${JSON.stringify(raw)});(()=>{
    const app=TM_SCENARIO_EDITOR_RESET_APP, AA=TM.AuthoringAgent;
    const original=JSON.stringify(__regionInput); app.applyImportedScenario(AA.makeDraft(__regionInput),'隔离地区回归');
    const faction=Object.keys(app.state.scenario.adminHierarchy).find(k=>Array.isArray(app.state.scenario.adminHierarchy[k].divisions)&&app.state.scenario.adminHierarchy[k].divisions.length);
    const rows=app.state.scenario.adminHierarchy[faction].divisions;
    const row=rows.find(d=>d.name==='雅州')||rows[0];
    window.__regionProbe={original,faction,id:row.id,name:row.name,collection:'adminHierarchy.'+faction+'.divisions',draft:AA.makeDraft(app.state.scenario)};
    return true;
  })()`);
  await check('nested-search-and-real-ID-readback', async () => assert.equal(await js(`(()=>{
    const t=__regionProbe,AA=TM.AuthoringAgent;
    const found=AA.dispatchTool(t.draft,'searchEntities',{collection:t.collection,query:t.id});
    return found.ok&&found.count===1&&found.matches[0].id===t.id&&AA.dispatchTool(t.draft,'getField',{path:found.matches[0].path+'.name'}).value===t.name;
  })()`), true));
  await check('missing-region-error-has-no-partial-write', async () => assert.equal(await js(`(()=>{
    const t=__regionProbe,AA=TM.AuthoringAgent,before=JSON.stringify(t.draft);
    const p=t.collection+'.回归专用不存在地区.minxinLocal';
    const result=AA.dispatchTool(t.draft,'applyEdit',{path:p,value:77});
    const read=AA.dispatchTool(t.draft,'getField',{path:p});
    return result.ok===false&&read.ok===false&&JSON.stringify(t.draft)===before&&Object.keys(t.draft.adminHierarchy[t.faction].divisions).every(k=>/^\\d+$/.test(k));
  })()`), true));
  await check('actual-adapter-commits-valid-region-economy-and-minxin', async () => assert.equal(await js(`(()=>{
    const t=__regionProbe,AA=TM.AuthoringAgent,p=t.collection+'.'+t.id;
    const result=AA.dispatchTool(t.draft,'multiEdit',{edits:[{path:p+'.minxinLocal',value:77},{path:p+'.economyBase.farmland',value:123.5},{path:p+'.economyBase.pathRegression.value',value:1.25}]});
    if(!result.ok)return false;
    const hostBefore=JSON.stringify(TM_SCENARIO_EDITOR_RESET_APP.state.scenario);
    if(hostBefore!==t.original)return false;
    const adapter=AA.makeResetEditorAdapter(window); if(!adapter.commit(t.draft).ok)return false;
    const row=TM_SCENARIO_EDITOR_RESET_APP.state.scenario.adminHierarchy[t.faction].divisions.find(d=>d.id===t.id);
    return row.minxinLocal===77&&row.economyBase.farmland===123.5&&row.economyBase.pathRegression.value===1.25;
  })()`), true));
  const saved = await js(`(async()=>{
    const app=TM_SCENARIO_EDITOR_RESET_APP,t=__regionProbe;
    const snapshot=await app.saveProjectSnapshot('隔离地区路径回归',{newCopy:true});
    return {id:snapshot.id,faction:t.faction,regionId:t.id};
  })()`);
  // A reload discards all JS objects/caches. Success must come from real local
  // persistence, not from reusing the in-memory draft or a mocked save result.
  await new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(Error('editor reload timed out')), 10000);
    const done = () => { clearTimeout(deadline); resolve(); };
    win.webContents.once('did-finish-load', done);
    win.webContents.reload();
  });
  await ready();
  await check('saved-region-state-survives-actual-editor-reload', async () => assert.equal(await js(`(async()=>{
    const saved=${JSON.stringify(saved)}, app=TM_SCENARIO_EDITOR_RESET_APP;
    const snapshot=await app.loadProjectSnapshot(saved.id);if(!snapshot)return false;
    const row=app.state.scenario.adminHierarchy[saved.faction].divisions.find(d=>d.id===saved.regionId);
    return row.minxinLocal===77&&row.economyBase.farmland===123.5&&row.economyBase.pathRegression.value===1.25;
  })()`), true));
  await check('legacy-editor-entry-loads-the-same-production-tools', async () => {
    await win.loadFile(path.join(root, 'web/editor.html'));
    assert.equal(await js(`typeof TM.AuthoringAgent.dispatchTool==='function'&&TM.AuthoringAgent.dispatchTool({adminHierarchy:{楚:{divisions:[{id:'a',name:'雅州'}]}}},'searchEntities',{collection:'adminHierarchy.楚.divisions',query:'雅州'}).count===1`), true);
  });
  await check('original-fixture-is-unchanged', () => {
    if (file) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), hash);
  });
};
