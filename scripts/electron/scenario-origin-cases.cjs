'use strict';
// The real homepage bridge, desktop create IPC, and destination editor. Only
// synthetic scenario data is seeded, in the gate's existing temporary userData.
const assert = require('assert/strict');
module.exports = async function({ win, js, until, click, test }) {
  await until(`typeof buildScenarioResetEditorSnapshot==='function' && typeof confirmNewScn==='function' && window.tianming && P && Array.isArray(P.scenarios)`);
  await test('real homepage bridge does not borrow global Ming configuration', async () => {
    const r = await js(`(()=>{
      P.government={name:'隔离他卷大明'};P.officeTree=[{name:'隔离他卷内阁'}];P.adminHierarchy={ming:{factionName:'隔离他卷大明',divisions:[{name:'隔离浙江布政使司'}]}};
      const a={id:'origin-blank',name:'空卷'},b={id:'origin-own',name:'汉末',government:{name:'益州牧府'},officeTree:[],adminHierarchy:{},events:{historical:[{name:'入蜀'}]},timeline:{past:[{year:214}]}};
      P.scenarios.push(a,b);const before=JSON.stringify(P.scenarios),blank=buildScenarioResetEditorSnapshot(a.id),own=buildScenarioResetEditorSnapshot(b.id);
      return{blank,own,unchanged:before===JSON.stringify(P.scenarios)};
    })()`);
    for (const key of ['government','officeTree','adminHierarchy']) assert.equal(Object.hasOwn(r.blank,key),false,key);
    assert.deepEqual(r.own.government,{name:'益州牧府'}); assert.deepEqual(r.own.events,{historical:[{name:'入蜀'}]});
    assert.deepEqual(r.own.timeline,{past:[{year:214}]}); assert(r.unchanged);
  });
  await test('desktop create click saves a clean scenario and opens the real editor without inherited offices', async () => {
    await js(`createNewScn();document.getElementById('new-scn-name').value='隔离新建·刘备214';`);
    let timeout;
    const loaded = new Promise((resolve,reject)=>{timeout=setTimeout(()=>reject(Error('new-scenario navigation timeout')),20000);win.webContents.once('did-finish-load',resolve);});
    try { await click(`document.querySelector('#new-scn-modal .bt.bp')`); await loaded; }
    finally { clearTimeout(timeout); }
    await until(`document.body.dataset.scenarioEditorResetApp==='ready'`);
    const r = await js(`(async()=>{const s=TM_SCENARIO_EDITOR_RESET_APP.state.scenario;return{scenario:JSON.parse(JSON.stringify(s)),saved:await tianming.loadScenario('隔离新建·刘备214')};})()`);
    assert.equal(r.scenario.name,'隔离新建·刘备214');
    for(const key of ['government','officeTree','adminHierarchy']) assert.equal(Object.hasOwn(r.scenario,key),false,key);
    assert.equal(r.saved.success,true); assert.equal(r.saved.data.name,'隔离新建·刘备214');
    assert(!JSON.stringify(r).includes('隔离他卷'));
  });
  await test('empty government/admin views render and modern blank starter remains era-neutral', async () => {
    await js(`window.__originErrors=[];addEventListener('error',e=>__originErrors.push(e.message));`);
    for(const id of ['courtInstitutions','adminMap']) {
      await click(`Array.from(document.querySelectorAll('[data-module-id="${id}"]')).find(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0)`);
      await until(`TM_SCENARIO_EDITOR_RESET_APP.state.selectedModuleId===${JSON.stringify(id)}`);
    }
    const r=await js(`(()=>{const s=TM_SCENARIO_EDITOR_RESET_APP.startNewScenario('blank');return{scenario:s,errors:__originErrors};})()`);
    assert.deepEqual(r.errors,[]); assert.deepEqual(r.scenario.officeTree,[]); assert.deepEqual(r.scenario.adminHierarchy,[]);
    assert(!JSON.stringify(r.scenario).includes('隔离他卷')); assert(!JSON.stringify(r.scenario).includes('布政使司'));
  });
};
