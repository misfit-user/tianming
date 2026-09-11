'use strict';
// Real production BrowserWindow/preload, fixture data, real mouse/keyboard events.
// No live player data, relay, mocked bridge or claims about external model behavior.
const assert = require('assert/strict'), path = require('path');
module.exports = async function({ win, root, check }) {
  const fixture = require('../fixtures/workshop-hierarchy.json');
  const js = s => win.webContents.executeJavaScript(s, true);
  const ready = () => js(`(async()=>{const end=Date.now()+10000;while(document.body.dataset.scenarioEditorResetApp!=='ready'){if(Date.now()>end)throw Error('editor not ready');await new Promise(r=>setTimeout(r,20));}return true;})()`);
  async function click(selector) {
    win.focus(); win.webContents.focus();
    const p = await js(`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing control '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=e.getBoundingClientRect(),x=Math.round(b.x+b.width/2),y=Math.round(b.y+b.height/2);if(!e.contains(document.elementFromPoint(x,y)))throw Error('not hit-testable '+${JSON.stringify(selector)});return{x,y};})()`);
    for (const type of ['mouseDown', 'mouseUp']) win.webContents.sendInputEvent({ type, button: 'left', clickCount: 1, ...p });
    await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  }
  async function type(selector, value) {
    await click(selector);
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: ['control'] });
    await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    assert.equal(await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return document.activeElement===e&&e.selectionStart===0&&e.selectionEnd===e.value.length;})()`), true, 'keyboard select-all settled before text insertion');
    await win.webContents.insertText(value);
  }
  await win.loadFile(path.join(root, 'web/preview/scenario-editor-reset-preview.html')); await ready();
  await check('production-workshop-bridge-and-source-reading', async () => {
    assert.equal(await js(`typeof require==='undefined'&&tianming.isDesktop===true`), true);
    const r = await js(`TM.AuthoringAgent.dispatchTool({},'listSource',{filter:'office'})`); assert(r.ok && r.files.length > 0);
  });
  await js(`TM_SCENARIO_EDITOR_RESET_APP.applyImportedScenario(${JSON.stringify(fixture)},'隔离层级回归'); TM_SCENARIO_EDITOR_RESET_APP.revealModule('courtInstitutions');`);
  await click('[data-editor-command="office-view"][data-office-view="tree"]');
  await check('office-chart-has-departments-subdepartments-and-seats', async () => {
    const observed = await js(`(()=>{const a=TM_SCENARIO_EDITOR_RESET_APP;return {view:a.state._officeView,module:a.state.selectedModuleId,count:document.querySelectorAll('[data-oc-kind="office"].oc-node:not(.oc-root)').length,expected:a.officeTreeEntries(a.state.scenario.officeTree).length,leaf:!!document.querySelector('[data-oc-id="0.subs.0.subs.0.positions.0"]')};})()`);
    assert.equal(observed.count, observed.expected, JSON.stringify(observed)); assert(observed.leaf, JSON.stringify(observed));
  });
  await click('[data-editor-command="orgchart-fit"][data-oc-kind="office"]');
  await click('[data-editor-command="orgchart-pick"][data-oc-id="0.subs.0"]');
  await type('input[data-office-path="0.subs.0"][data-office-field="name"]', '尚书台实改');
  await click('[data-editor-command="office-add-sub"][data-office-node="0.subs.0"]');
  await check('editing-name-does-not-swallow-add-subdepartment-click', async () => {
    const d = await js(`TM_SCENARIO_EDITOR_RESET_APP.state.scenario.officeTree[0].subs[0]`);
    assert.equal(d.name, '尚书台实改'); assert.equal(d.subs.length, 2);
  });
  await type('input[data-office-path="0.subs.0.subs.1"][data-office-field="name"]', '新建考功署');
  await click('[data-editor-command="office-add-pos"][data-office-node="0.subs.0.subs.1"]');
  await type('input[data-office-path="0.subs.0.subs.1.positions.0"][data-office-field="name"]', '考功主官');
  await click('[data-editor-command="office-view"][data-office-view="tree"]');
  await check('new-nested-seat-written-to-selected-department', async () => {
    const d = await js(`TM_SCENARIO_EDITOR_RESET_APP.state.scenario.officeTree[0].subs[0].subs[1]`);
    assert.equal(d.name, '新建考功署'); assert.equal(d.positions[0].name, '考功主官');
  });
  await js(`TM_SCENARIO_EDITOR_RESET_APP.revealModule('adminMap')`);
  await click('[data-editor-command="admin-view"][data-admin-view="tree"]');
  await check('admin-legacy-and-canonical-children-visible-without-auto-rewrite', async () => {
    assert.equal(await js(`!!document.querySelector('[data-oc-kind="admin"][data-oc-id="0.children.0.children.1"]')&&!!document.querySelector('[data-oc-kind="admin"][data-oc-id="1.divisions.0.divisions.0"]')&&!!TM_SCENARIO_EDITOR_RESET_APP.state.scenario.adminHierarchy['测试势力'].divisions[1].divisions`), true);
  });
  await click('[data-editor-command="orgchart-fit"][data-oc-kind="admin"]');
  await click('[data-editor-command="orgchart-pick"][data-oc-kind="admin"][data-oc-id="0.children.0.children.1"]');
  await type('input[data-gen-kind="adminDiv"][data-gen-field="name"]', '第二县实改');
  await click('[data-editor-command="admin-add-child"]');
  await check('duplicate-name-id-branch-edited-and-child-created-once', async () => {
    const ds = await js(`TM_SCENARIO_EDITOR_RESET_APP.state.scenario.adminHierarchy['测试势力'].divisions[0].children[0].children`);
    assert.equal(ds[0].name, '同名县'); assert.equal(ds[1].name, '第二县实改'); assert.equal(ds[1].children.length, 1); assert.equal(ds[0].minxinLocal, 58);
  });
  await click('[data-editor-command="admin-collapse-all"]');
  await check('collapse-all-affects-chart-without-losing-data', async () => assert.equal(await js(`document.querySelectorAll('.oc-node[data-oc-kind="admin"]').length`), 2));
  await click('[data-editor-command="admin-expand-all"]');
  await check('expand-all-restores-deep-nodes', async () => assert.equal(await js(`!!document.querySelector('.oc-node[data-oc-id="0.children.0.children.1.children.0"]')`), true));
  await click('[data-editor-command="admin-normalize-children"]');
  await check('explicit-legacy-repair-keeps-original-metrics', async () => assert.equal(await js(`TM_SCENARIO_EDITOR_RESET_APP.state.scenario.adminHierarchy['测试势力'].divisions[1].children[0].children[0].minxinLocal`), 67));
  const saved = await js(`(async()=>{const a=TM_SCENARIO_EDITOR_RESET_APP,s=await a.saveProjectSnapshot('层级回归读回',{newCopy:true});return{id:s.id,scenario:JSON.stringify(a.state.scenario)};})()`);
  await win.reload(); await ready();
  await js(`TM_SCENARIO_EDITOR_RESET_APP.loadProjectSnapshot(${JSON.stringify(saved.id)})`);
  await check('real-IndexedDB-reload-preserves-hierarchy-and-all-other-fields', async () => assert.equal(await js(`JSON.stringify(TM_SCENARIO_EDITOR_RESET_APP.state.scenario)`), saved.scenario));
};
