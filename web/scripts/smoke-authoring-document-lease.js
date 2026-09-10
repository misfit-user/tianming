#!/usr/bin/env node
'use strict';
// Function-level fault injection into actual host implementations. DOM/storage adapters
// are controlled here; the companion Electron gate tests full host and real IndexedDB.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm'), acorn = require('acorn');
const source = fs.readFileSync(path.join(__dirname, '../preview/scenario-editor-reset-app.js'), 'utf8');
const nodes = acorn.parse(source, { ecmaVersion: 'latest' }).body[0].expression.callee.body.body;
const names = ['clone', 'stableString', 'uniqueId', 'beginEditorDocument', 'captureDocumentLease', 'isDocumentLeaseCurrent', 'recordHistory', 'pushHistoryLog', 'resetEditTimeline', 'commitScenarioEdit', 'applyImportedScenario', 'buildProjectSnapshot', 'saveProjectSnapshot', 'loadProjectSnapshot'];
const extracted = nodes.filter(n => n.type === 'FunctionDeclaration' && names.includes(n.id.name) || n.type === 'VariableDeclaration' && n.declarations.some(d => d.id.name === 'editorDocument'));
assert.equal(extracted.filter(n => n.type === 'FunctionDeclaration').length, names.length, 'actual host functions are present');
function fixture() {
  const bodies = new Map(), pending = {}, c = { console, Math, Date, JSON, Promise, Object,
    state: { scenario: { id: 'A', name: '同名', fiscalConfig: { treasury: 100 } }, original: { id: 'A', name: '同名', fiscalConfig: { treasury: 100 } }, projectLibrary: [], modules: [{ id: 'opening', topLevelKeys: ['name'] }], selectedModuleId: 'opening', selectedField: 'name', history: [], undoStack: [], redoStack: [], drafts: [{ text: '草稿保留' }] },
    DATA: {}, AI_REFERENCES_PERSIST_MAX: 20, projectStats: () => ({}), compactProjectMeta: s => ({ id: s.id, name: s.name }),
    putProjectBody: async s => { bodies.set(s.id, JSON.parse(JSON.stringify(s))); if (pending.write) await pending.write; return true; },
    getProjectBody: async id => { if (pending[id]) await pending[id]; return bodies.get(id); },
    healScalarCorruptedMilitary: () => '', firstAgentEditableField: keys => keys[0], isAgentEditableFieldKey: () => true,
    findModule: () => ({ id: 'opening', topLevelKeys: ['name'] }), moduleHomeForField: () => 'opening' };
  for (const k of ['absorbOrphanScenarioKeys', 'ensureModulesPopulated', 'writeStoredDraft', 'writeProjectLibrary', 'renderWorkspaceMeta', 'renderEditHistory', 'renderReleaseNotes', 'renderProjectLibrary', 'renderDiffInspector', 'renderAll', 'setStatus', 'markAgentTouched']) c[k] = () => {};
  vm.createContext(c); vm.runInContext(extracted.map(n => source.slice(n.start, n.end)).join('\n'), c, { filename: 'actual-host-excerpts.js' });
  c.resetEditTimeline(); return { c, bodies, pending };
}
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); } }
(async () => {
  await test('edit preserves project, original, manual drafts; history captures real before/after; detached input', () => {
    const { c } = fixture(); c.state.currentProjectId = 'saved-A'; const before = JSON.stringify(c.state.original), draft = c.clone(c.state.scenario); draft.fiscalConfig.treasury = 450;
    c.commitScenarioEdit(draft, '应用', c.captureDocumentLease()); draft.fiscalConfig.treasury = 999;
    assert.equal(c.state.currentProjectId, 'saved-A'); assert.equal(JSON.stringify(c.state.original), before); assert.equal(c.state.drafts[0].text, '草稿保留');
    assert.equal(c.state.scenario.fiscalConfig.treasury, 450); assert.equal(c.state.undoStack[0].before.fiscalConfig.treasury, 100); assert.equal(c.state.undoStack[0].after.fiscalConfig.treasury, 450); assert(c.state.dirty);
  });
  await test('same-name reimport rejects stale lease without modifying either input', () => {
    const { c } = fixture(), lease = c.captureDocumentLease(), draft = c.clone(c.state.scenario);
    c.applyImportedScenario({ id: 'A', name: '同名', fiscalConfig: { treasury: 777 } }, '另一个加载'); const before = JSON.stringify(c.state.scenario);
    assert.throws(() => c.commitScenarioEdit(draft, '旧草稿', lease), e => e.code === 'editor-document-changed'); assert.equal(JSON.stringify(c.state.scenario), before); assert.equal(c.state.currentProjectId, null);
  });
  await test('ordinary first save retains lease; explicit save-as copy starts another document', async () => {
    const { c } = fixture(), lease = c.captureDocumentLease(); const first = await c.saveProjectSnapshot('A');
    assert(c.isDocumentLeaseCurrent(lease)); assert.equal(c.state.currentProjectId, first.id);
    const second = await c.saveProjectSnapshot('copy', { newCopy: true }); assert.notEqual(first.id, second.id); assert.equal(c.isDocumentLeaseCurrent(lease), false);
  });
  await test('late persisted A snapshot never adopts identity or clears dirty on B', async () => {
    const { c, pending, bodies } = fixture(); let release; pending.write = new Promise(r => { release = r; });
    const save = c.saveProjectSnapshot('A'); c.applyImportedScenario({ id: 'B', name: 'B', fiscalConfig: { treasury: 777 } }, 'B'); const original = JSON.stringify(c.state.original);
    release(); const saved = await save;
    assert.equal(bodies.get(saved.id).scenario.id, 'A'); assert.equal(c.state.scenario.id, 'B'); assert.equal(c.state.currentProjectId, null); assert(c.state.dirty); assert.equal(JSON.stringify(c.state.original), original);
  });
  await test('same-document edit during disk write keeps new dirty state and old comparison baseline', async () => {
    const { c, pending } = fixture(); let release; pending.write = new Promise(r => { release = r; }); const save = c.saveProjectSnapshot('A');
    c.state.scenario.fiscalConfig.treasury = 555; c.recordHistory('手工修改', '财政'); release(); const saved = await save;
    assert.equal(saved.scenario.fiscalConfig.treasury, 100); assert.equal(c.state.scenario.fiscalConfig.treasury, 555); assert(c.state.dirty); assert.equal(c.state.original.fiscalConfig.treasury, 100);
  });
  await test('storage rejection does not report success or change project identity', async () => {
    const { c } = fixture(); c.putProjectBody = async () => { throw Error('controlled-store-failure'); }; const before = JSON.stringify(c.state);
    await assert.rejects(c.saveProjectSnapshot('A'), /controlled-store-failure/); assert.equal(JSON.stringify(c.state), before);
  });
  await test('two loads returning in reverse order honor latest open intent', async () => {
    const { c, bodies, pending } = fixture(); bodies.set('A', { id: 'A', scenario: { name: 'A' } }); bodies.set('B', { id: 'B', scenario: { name: 'B' } }); let release;
    pending.A = new Promise(r => { release = r; }); const first = c.loadProjectSnapshot('A'); await c.loadProjectSnapshot('B'); release(); assert.equal(await first, null);
    assert.equal(c.state.currentProjectId, 'B'); assert.equal(c.state.scenario.name, 'B');
  });
  await test('new import wins over earlier in-flight library load, while missing load preserves current document', async () => {
    const { c, bodies, pending } = fixture(); bodies.set('A', { id: 'A', scenario: { name: 'A' } }); let release; pending.A = new Promise(r => { release = r; });
    const first = c.loadProjectSnapshot('A'); c.applyImportedScenario({ name: 'B' }, 'B'); const lease = c.captureDocumentLease(); release(); assert.equal(await first, null);
    assert.equal(await c.loadProjectSnapshot('missing'), null); assert.equal(c.state.scenario.name, 'B'); assert(c.isDocumentLeaseCurrent(lease));
  });
  console.log(JSON.stringify({ pass, fail, skip: 0, waived: 0 })); process.exitCode = fail ? 1 : 0;
})();
