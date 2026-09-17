#!/usr/bin/env node
'use strict';
// Actual editor/agent modules in a headless DOM shell; native rendering tested separately.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../..'), at = process.argv.indexOf('--source-ref'), ref = at < 0 ? null : process.argv[at + 1];
const fixture = require('../../scripts/fixtures/workshop-hierarchy.json');
const copy = x => JSON.parse(JSON.stringify(x));
function setup(scenario = fixture) {
  const element = () => ({ dataset: {}, children: [], style: {}, classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, appendChild(e) { this.children.push(e); }, removeChild(e) { this.children.splice(this.children.indexOf(e), 1); } });
  const store = new Map(), c = { console, Date, JSON, Math, Map, Set, WeakMap, Promise, URL, URLSearchParams,
    setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    location: { href: 'https://fixture.invalid/preview/', search: '', hash: '' },
    localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    document: { readyState: 'loading', addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: element, body: element() }
  };
  c.window = c; c.addEventListener = () => {}; vm.createContext(c);
  for (const file of ['preview/scenario-editor-reset-app.js', 'editor-authoring-agent-provider.js', 'editor-authoring-agent.js']) {
    const src = ref ? cp.execFileSync('git', ['show', ref + ':web/' + file], { cwd: root, encoding: 'utf8', maxBuffer: 8e6 }) : fs.readFileSync(path.join(root, 'web', file), 'utf8');
    vm.runInContext(src, c, { filename: file });
  }
  const app = c.TM_SCENARIO_EDITOR_RESET_APP, state = app.state;
  state.scenario = copy(scenario); state.original = copy(scenario); state.historyCheckpoint = copy(scenario);
  state.selectedModuleId = 'courtInstitutions'; state._officeView = 'tree'; state._adminView = 'tree';
  return { app, state, aa: c.TM.AuthoringAgent, store };
}
let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); } }
test('canonical third-level department and positions are real chart nodes', () => {
  const { app } = setup(), html = app.renderOfficeFolio();
  for (const name of ['尚书台', '选曹', '选曹郎']) assert(html.includes('<b>' + name + '</b>'), name);
  assert(html.includes('data-oc-id="0.subs.0.subs.0.positions.0"'));
});
test('positive control canonical top-level names remain displayed and input unchanged', () => {
  const { app, state } = setup(); const before = JSON.stringify(state.scenario);
  assert(app.renderOfficeFolio().includes('<b>中枢</b>')); assert.equal(JSON.stringify(state.scenario), before);
});
test('positive control pre-existing add-position path still targets its canonical parent', () => {
  const { app, state } = setup(); app.addOfficePositionRow('0.subs.0');
  assert.equal(state.scenario.officeTree[0].subs[0].positions.length, 2); assert.equal(state.scenario.officeTree[0].positions.length, 1);
});
test('legacy children recursively display departments and rank/holder leaves without mutation', () => {
  const { app, state } = setup(), before = JSON.stringify(state.scenario), html = app.renderOfficeFolio();
  assert(html.includes('<b>旧式属署</b>') && html.includes('<b>属署主官</b>'));
  assert.equal(JSON.stringify(state.scenario), before);
});
test('list and chart both preserve nested legacy seats', () => {
  const { app, state } = setup(); state._officeView = 'list'; const html = app.renderOfficeFolio();
  assert(html.includes('value="属署主官"') && html.includes('data-office-path="1.children.1.children.0"'));
});
test('structured position properties cannot become object-object editable strings', () => {
  const { app, state } = setup(); const html = app.renderOfficeFolio();
  assert(!html.includes('[object Object]')); app.saveOfficeField('0.positions.0', 'powers', 'bad');
  assert.deepEqual(copy(state.scenario.officeTree[0].positions[0].powers), { supervise: true });
});
test('create a grandchild department and a position at that exact source path', () => {
  const { app, state } = setup(); app.addOfficeSubdepartment('0.subs.0'); app.addOfficePositionRow('0.subs.0.subs.1');
  assert.equal(state.scenario.officeTree[0].subs[0].subs[1].positions.length, 1);
  assert.equal(state.scenario.officeTree[0].positions.length, 1);
});
test('legacy position edit retains field name and sibling object', () => {
  const { app, state } = setup(); state._officeNodeId = '1.children.0'; const html = app.renderOfficeFolio();
  assert(html.includes('data-office-field="level"')); app.saveOfficeField('1.children.0', 'level', '四品');
  assert.equal(state.scenario.officeTree[1].children[0].level, '四品');
  assert.equal(state.scenario.officeTree[1].children[1].children[0].level, '七品');
});
test('empty office document exposes creation without a fabricated default', () => {
  const { app, state } = setup({ name: '空案卷' }); assert(app.renderOfficeFolio().includes('data-editor-command="office-add-root"'));
  assert(!('officeTree' in state.scenario));
});
test('canonical and old admin nesting visible on first chart render', () => {
  const { app, state } = setup(), before = JSON.stringify(state.scenario), html = app.renderAdminFolio();
  assert(html.includes('<b>甲郡</b>') && html.includes('<b>同名县</b>') && html.includes('<b>乙县</b>'));
  assert(html.includes('data-oc-parent="0.children.0" data-oc-child="0.children.0.children.1"'));
  assert.equal(JSON.stringify(state.scenario), before);
});
test('duplicate or absent IDs use distinct full source paths', () => {
  const { app, state } = setup(); state._adminDivPath = '0.children.0.children.1'; app.renderAdminFolio();
  app.saveGenField('adminDiv', 0, 'minxinLocal', '72');
  const ds = state.scenario.adminHierarchy['测试势力'].divisions[0].children[0].children;
  assert.equal(ds[0].minxinLocal, 58); assert.equal(ds[1].minxinLocal, 72);
});
test('new admin grandchild persists under selected parent, not first root', () => {
  const { app, state } = setup(); app.renderAdminFolio(); app.addAdminDivision('0.children.0.children.1');
  const d = state.scenario.adminHierarchy['测试势力'].divisions[0].children[0].children;
  assert.equal(d[1].children.length, 1); assert.equal(d[0].children.length, 0);
});
test('empty admin tree can be created for an existing faction, with no inherited default', () => {
  const { app, state } = setup({ name: '空案卷', factions: [{ name: '自创势力' }] });
  assert(app.renderAdminFolio().includes('data-editor-command="admin-add-faction"'));
  app.addAdminFaction('自创势力'); app.addAdminDivision(null); app.addAdminDivision('0');
  assert.equal(state.scenario.adminHierarchy['自创势力'].divisions[0].children.length, 1); assert.deepEqual(Object.keys(state.scenario.adminHierarchy), ['自创势力']);
});
test('explicit legacy admin repair retains economics/population and has undo history', () => {
  const { app, state } = setup(), before = copy(state.scenario); const r = app.normalizeLegacyAdminChildren();
  assert(r.ok && r.changed === 2);
  assert.equal(state.scenario.adminHierarchy['测试势力'].divisions[1].children[0].children[0].minxinLocal, 67);
  assert.deepEqual(copy(state.scenario.adminHierarchy['测试势力'].divisions[0]), before.adminHierarchy['测试势力'].divisions[0]);
  assert.deepEqual(copy(state.undoStack[0].before), before);
});
test('conflicting dual admin child arrays fail atomically without guessing', () => {
  const { app, state } = setup(); const d = state.scenario.adminHierarchy['测试势力'].divisions[1]; d.children = [{ name: 'different' }];
  const before = JSON.stringify(state.scenario); const r = app.normalizeLegacyAdminChildren(); assert.equal(r.ok, false); assert.equal(JSON.stringify(state.scenario), before);
});
test('agent division template and prompt match real runtime children/populationDetail', () => {
  const { aa } = setup(), r = aa.dispatchTool({}, 'describeSchema', { kind: 'division' });
  assert(Array.isArray(r.template.children) && r.template.populationDetail && !('divisions' in r.template));
  assert(aa.buildSchemaGuide().includes('只有势力根用 divisions'));
});
test('agent catches canonical deep population inconsistency instead of skipping children', () => {
  const { aa } = setup(); const d = copy(fixture); d.adminHierarchy['测试势力'].divisions[0].populationDetail.mouths = 1;
  const r = aa.validateDraft(d, 'admin-population'); assert.equal(r.ok, false); assert(r.results['admin-population'].details.comparisons > 0);
});
test('invalid admin roots and nullable office entries do not crash or rewrite data', () => {
  const { app, state } = setup({ officeTree: [null, { name: 'valid', positions: [null], subs: [] }], adminHierarchy: { bad: null } });
  const before = JSON.stringify(state.scenario); app.renderOfficeFolio(); app.renderAdminFolio(); assert.equal(JSON.stringify(state.scenario), before);
});
console.log(JSON.stringify({ source: ref || 'working-tree', pass, fail, skip: 0, waived: 0 })); process.exitCode = fail ? 1 : 0;
