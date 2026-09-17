#!/usr/bin/env node
'use strict';
// Actual launch/desktop constructors and editor bridge; DOM, storage and IPC are
// isolated adapters. No player data or API requests are used by this regression.
const assert = require('assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm'), acorn = require('acorn');
const root = path.resolve(__dirname, '../..');
const refIndex = process.argv.indexOf('--source-ref');
const sourceRef = refIndex >= 0 ? process.argv[refIndex + 1] : null;
function read(file) {
  if (sourceRef) return require('child_process').execFileSync('git', ['show', sourceRef + ':web/' + file], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  return fs.readFileSync(path.join(root, 'web', file), 'utf8');
}
function parse(source) { return acorn.parse(source, { ecmaVersion: 'latest' }); }
const bridge = read('tm-office-editor.js');
const bridgeNames = ['_tmEditorBridgeClone', '_tmEditorBridgeRows', 'buildScenarioResetEditorSnapshot', 'openScenarioResetEditor'];
const declarations = parse(bridge).body.filter(n => n.type === 'FunctionDeclaration' && bridgeNames.includes(n.id.name));
assert.equal(declarations.length, bridgeNames.length, 'all actual bridge functions found');
const bridgeCode = declarations.map(n => bridge.slice(n.start, n.end)).join('\n');
const launch = read('tm-launch.js'), desktop = read('tm-electron.js');
const webCreate = parse(launch).body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'confirmNewScn');
assert(webCreate, 'actual web constructor found');
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(n => walk(n, visit));
    else if (value && typeof value.type === 'string') walk(value, visit);
  }
}
const desktopCreates = [];
walk(parse(desktop), n => {
  if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier' && n.left.name === 'confirmNewScn') desktopCreates.push(n);
});
assert.equal(desktopCreates.length, 1, 'actual desktop constructor found exactly once');
const configKeys = ['map', 'mapData', 'adminHierarchy', 'officeTree', 'officeConfig', 'government', 'fiscalConfig', 'economyConfig', 'military', 'techTree', 'civicTree', 'variables', 'rules', 'mechanicsConfig'];
const copy = value => JSON.parse(JSON.stringify(value));
function fixture(scenario = { id: 'new', name: '汉末刘备' }) {
  const storage = new Map(), writes = [], notices = [];
  const P = { scenarios: [copy(scenario)], characters: [{ sid: 'ming', name: '明代人物' }], factions: [{ sid: 'ming', name: '大明' }] };
  for (const key of configKeys) P[key] = { oldScenario: 'ming', marker: key };
  P.adminHierarchy = { ming: { factionName: '大明', divisions: [{ name: '浙江布政使司' }] } };
  P.government = { name: '大明', selectionSystem: '科举三年一科' };
  P.officeTree = [{ name: '内阁', positions: [{ name: '首辅', holder: '明代人物' }] }];
  const input = { value: '刘备·入主成都' }, modal = { remove() {} };
  const c = { console: { log() {}, warn() {} }, P, GM: { sid: 'new' }, JSON, Date, Promise,
    SCENARIO_RESET_EDITOR_DRAFT_KEY: 'isolated-draft',
    findScenarioById: id => P.scenarios.find(s => s.id === id), uid: () => 'web-new',
    document: { getElementById: id => id === 'new-scn-name' ? input : modal },
    _$: id => id === 'new-scn-name' ? input : modal,
    localStorage: { setItem: (key, value) => storage.set(key, value) },
    location: { href: '' }, toast: msg => notices.push(msg), saveP() {},
    openEditorHtml() { throw Error('unexpected legacy fallback'); },
    tianming: { saveScenario: async (name, data) => { writes.push({ name, data: copy(data) }); return { success: true }; } }
  };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(bridgeCode, c, { filename: 'actual-tm-office-editor-excerpts.js' });
  return { c, storage, writes, notices };
}
let pass = 0, fail = 0;
async function test(name, fn) {
  try { await fn(); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); }
}
(async () => {
  await test('missing configuration never borrows another scenario from global P', () => {
    const { c } = fixture(), before = JSON.stringify(c.P);
    const out = c.buildScenarioResetEditorSnapshot('new');
    for (const key of configKeys) assert.equal(Object.hasOwn(out, key), false, key + ' must stay absent');
    assert.equal(JSON.stringify(c.P), before);
    assert(!JSON.stringify(out).includes('大明'));
  });
  await test('GM.sid and active display name do not prove ownership of global configuration', () => {
    const { c } = fixture(); c.P._activeScnName = '汉末刘备'; c.GM.sid = 'new';
    assert.equal(c.buildScenarioResetEditorSnapshot('new').government, undefined);
  });
  await test('unscoped configuration is not even read', () => {
    const { c } = fixture();
    for (const key of configKeys) Object.defineProperty(c.P, key, { get() { throw Error('foreign getter ' + key); } });
    assert.equal(c.buildScenarioResetEditorSnapshot('new').name, '汉末刘备');
  });
  await test('explicit empty and null configuration are not replaced by global defaults', () => {
    const own = { id: 'new', name: '空卷', adminHierarchy: {}, officeTree: [], government: null, fiscalConfig: null };
    const { c } = fixture(own), out = c.buildScenarioResetEditorSnapshot('new');
    for (const key of ['adminHierarchy', 'officeTree', 'government', 'fiscalConfig']) assert.deepEqual(copy(out[key]), own[key]);
  });
  await test('scenario-owned Ming and non-Ming data survive unchanged and detached', () => {
    for (const era of ['大明', '汉末']) {
      const own = { id: 'new', name: era, customField: { text: '保留' } };
      for (const key of configKeys) own[key] = { era, nested: [{ value: key }] };
      const { c } = fixture(own), before = JSON.stringify(c.P), out = c.buildScenarioResetEditorSnapshot('new');
      for (const key of configKeys) { assert.deepEqual(copy(out[key]), own[key]); out[key].nested[0].value = 'detached'; }
      assert.equal(JSON.stringify(c.P), before);
      assert.equal(out.customField.text, '保留');
    }
  });
  await test('legacy collections recover only rows with the requested scenario id', () => {
    const { c } = fixture();
    for (const key of ['characters', 'factions', 'events', 'timeline', 'families']) c.P[key] = [{ sid: 'new', name: '本卷' }, { sid: 'ming', name: '他卷' }, { name: '无归属' }, null];
    const out = c.buildScenarioResetEditorSnapshot('new');
    for (const key of ['characters', 'factions', 'events', 'timeline', 'families']) {
      assert.deepEqual(copy(out[key]), [{ sid: 'new', name: '本卷' }]); out[key][0].name = 'changed'; assert.equal(c.P[key][0].name, '本卷');
    }
  });
  await test('explicit empty collections remain empty despite matching legacy rows', () => {
    const { c } = fixture({ id: 'new', name: '空卷', characters: [], factions: [], events: [] });
    c.P.characters = [{ sid: 'new', name: '不应复活' }]; c.P.events = [{ sid: 'new', name: '旧事件' }];
    const out = c.buildScenarioResetEditorSnapshot('new');
    for (const key of ['characters', 'factions', 'events']) assert.deepEqual(copy(out[key]), []);
  });
  await test('categorized legacy events and timeline are preserved rather than converted to empty arrays', () => {
    const own = { id: 'new', name: '旧格式', events: { historical: [{ name: '入蜀' }], random: [] }, timeline: { past: [{ year: 214 }], future: [] } };
    const { c } = fixture(own), out = c.buildScenarioResetEditorSnapshot('new');
    assert.deepEqual(copy(out.events), own.events); assert.deepEqual(copy(out.timeline), own.timeline);
  });
  await test('old persisted scenario is not silently cleaned by dynasty-name heuristics', () => {
    const own = { id: 'new', name: '玩家混合设定', government: { name: '大明' }, officeTree: [{ name: '内阁' }], adminHierarchy: { ming: { divisions: [{ name: '浙江布政使司' }] } } };
    const { c } = fixture(own), out = c.buildScenarioResetEditorSnapshot('new');
    for (const key of ['government', 'officeTree', 'adminHierarchy']) assert.deepEqual(copy(out[key]), own[key]);
  });
  await test('both real official scenarios retain their own configuration and collection shapes', () => {
    const files = fs.readdirSync(path.join(root, 'scenarios')).filter(file => file.endsWith('（官方）.json'));
    assert(files.length >= 2, 'official positive controls must be available');
    for (const file of files) {
      const own = JSON.parse(fs.readFileSync(path.join(root, 'scenarios', file), 'utf8').replace(/^\uFEFF/, ''));
      const { c } = fixture(own), before = JSON.stringify(c.P), out = c.buildScenarioResetEditorSnapshot(own.id);
      assert(out, file + ' snapshot exists');
      for (const key of [...configKeys, 'characters', 'factions', 'events', 'timeline']) if (Object.hasOwn(own, key)) assert.deepEqual(copy(out[key]), own[key], file + ':' + key);
      assert.equal(JSON.stringify(c.P), before, file + ': source preserved');
    }
  });
  await test('web new-scenario entry persists a draft without foreign configuration', () => {
    const { c, storage } = fixture(); vm.runInContext(launch.slice(webCreate.start, webCreate.end), c);
    c.confirmNewScn();
    const payload = JSON.parse(storage.get('isolated-draft'));
    assert.equal(payload.scenario.name, '刘备·入主成都'); assert.equal(payload.scenario.id, 'web-new');
    for (const key of configKeys) assert.equal(Object.hasOwn(payload.scenario, key), false, key);
    assert.deepEqual(payload.original, payload.scenario); assert.equal(payload.drafts.length, 0);
    assert.match(c.location.href, /scnId=web-new$/);
  });
  await test('desktop new-scenario entry remains clean even after GM.sid is set to the new id', async () => {
    const { c, storage, writes } = fixture(); const n = desktopCreates[0];
    vm.runInContext(desktop.slice(n.start, n.end), c); await c.confirmNewScn();
    const payload = JSON.parse(storage.get('isolated-draft'));
    assert.equal(writes.length, 1); assert.equal(writes[0].data.id, payload.scenario.id);
    assert.equal(c.GM.sid, payload.scenario.id); assert.equal(payload.scenario.name, '刘备·入主成都');
    for (const key of configKeys.filter(k => !['map', 'rules'].includes(k))) assert.equal(Object.hasOwn(payload.scenario, key), false, key);
    assert.deepEqual(payload.scenario.map, {}); assert.deepEqual(payload.original, payload.scenario);
  });
  await test('missing scenario neither overwrites the last draft nor navigates', () => {
    const { c, storage, notices } = fixture(); storage.set('isolated-draft', 'previous');
    assert.equal(c.openScenarioResetEditor('missing'), null); assert.equal(storage.get('isolated-draft'), 'previous'); assert.equal(c.location.href, ''); assert.equal(notices.length, 1);
  });
  console.log(JSON.stringify({ pass, fail, skip: 0, waived: 0 }));
  process.exitCode = fail ? 1 : 0;
})().catch(error => { console.error('HARNESS_ERROR ' + error.stack); process.exitCode = 1; });
