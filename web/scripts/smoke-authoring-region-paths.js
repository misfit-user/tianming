#!/usr/bin/env node
'use strict';
// Same behavioral invariants against the actual worktree or --ref Git source.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const refIndex = process.argv.indexOf('--ref');
const ref = refIndex < 0 ? null : process.argv[refIndex + 1];
const files = ['editor-authoring-agent-provider.js', 'editor-authoring-agent.js'];
const sandbox = { console, setTimeout, clearTimeout, AbortController, URL };
sandbox.global = sandbox;
vm.createContext(sandbox);
for (const file of files) {
  const text = ref ? cp.execFileSync('git', ['show', ref + ':web/' + file], { cwd: root, encoding: 'utf8', maxBuffer: 4e6 }) : fs.readFileSync(path.join(root, 'web', file), 'utf8');
  vm.runInContext(text, sandbox, { filename: file });
}
const AA = sandbox.TM.AuthoringAgent;
const roundtrip = x => JSON.parse(JSON.stringify(x));
function fixture() {
  return { name: '隔离路径回归', map: { regions: [{ id: 'r-a', name: '雅州' }, { id: 'r-b', name: '同名州' }, { id: 'r-c', name: '同名州' }] },
    adminHierarchy: { 楚: { divisions: [{ id: 'r-a', name: '雅州', minxinLocal: 58, economyBase: { farmland: 112 }, children: [{ id: 'r-child', name: '附县', minxinLocal: 41 }] }, { id: 'r-b', name: '同名州', minxinLocal: 20 }, { id: 'r-c', name: '同名州', minxinLocal: 80 }] } },
    characters: [{ id: 'c-1', name: '甲', loyalty: 50 }], factions: [{ id: 'f-1', name: '楚' }] };
}
const divs = 'adminHierarchy.楚.divisions';
const tests = [];
function test(name, body) { tests.push({ name, body }); }
function call(draft, tool, input) { return AA.dispatchTool(draft, tool, input); }
function unchanged(draft, operation) {
  const before = roundtrip(draft), keys = Reflect.ownKeys(draft.adminHierarchy.楚.divisions);
  const result = operation();
  assert.equal(result.ok, false, 'operation must report failure');
  assert.deepEqual(roundtrip(draft), before, 'no partial serialized writes');
  assert.deepEqual(Reflect.ownKeys(draft.adminHierarchy.楚.divisions), keys, 'no phantom array properties');
  return result;
}
test('nested map search returns a readable concrete path and ID', () => {
  const d = fixture(), r = call(d, 'searchEntities', { collection: 'map.regions', query: '雅州' });
  assert.equal(r.ok, true); assert.equal(r.count, 1); assert.equal(r.matches[0].id, 'r-a');
  assert.equal(call(d, 'getField', { path: r.matches[0].path + '.name' }).value, '雅州');
});
test('nested faction administrative search and write/read persistence', () => {
  const d = fixture(), r = call(d, 'searchEntities', { collection: divs, query: '雅州' });
  assert.equal(r.ok, true); assert.equal(r.count, 1);
  const p = r.matches[0].path + '.minxinLocal';
  assert.equal(call(d, 'applyEdit', { path: p, value: 77 }).ok, true);
  assert.equal(call(roundtrip(d), 'getField', { path: p }).value, 77);
  assert.equal(d.map.regions[0].minxinLocal, undefined, 'map presentation is not the administrative ledger');
});
test('nested children collection supports explicit stable parent ID', () => {
  const d = fixture(), r = call(d, 'searchEntities', { collection: divs + '.r-a.children', query: 'r-child' });
  assert.equal(r.ok, true); assert.equal(r.matches[0].name, '附县');
});
test('virtual region collection roundtrips through its reported collection name', () => {
  const d = fixture(), first = call(d, 'searchEntities', { collection: 'regions', query: '雅州' });
  assert.equal(first.ok, true);
  assert.equal(call(d, 'searchEntities', { collection: first.collection, query: '雅州' }).count, 1);
});
test('legacy mapData-only alias returns its real path without creating map', () => {
  const d = fixture(); d.mapData = d.map; delete d.map;
  const r = call(d, 'searchEntities', { collection: 'regions', query: '雅州' });
  assert.equal(r.ok, true); assert.equal(r.collection, 'mapData.regions');
  assert.equal(call(d, 'getField', { path: r.matches[0].path + '.id' }).value, 'r-a');
  assert.equal(d.map, undefined);
});
test('top-level character searches remain compatible and bounded', () => {
  const d = fixture(); d.characters = Array.from({ length: 65 }, (_, i) => ({ id: 'c-' + i, name: '人' + i }));
  const r = call(d, 'searchEntities', { collection: 'characters', query: '' });
  assert.equal(r.ok, true); assert.equal(r.count, 65); assert.equal(r.matches.length, 40);
});
test('global search returned bracket paths still read and write the real row', () => {
  const d = fixture(), r = call(d, 'globalSearch', { query: '附县' });
  const hit = r.hits.find(h => h.path.startsWith('adminHierarchy.'));
  assert(hit); const p = hit.path.replace(/\.name$/, '.minxinLocal');
  assert.equal(call(d, 'applyEdit', { path: p, value: 73 }).ok, true);
  assert.equal(call(roundtrip(d), 'getField', { path: p }).value, 73);
});
// Keep each failure case independent so baseline evidence includes every defect.
for (const [label, suffix] of [['intermediate', '.不存在.minxinLocal'], ['terminal', '.不存在'], ['array length', '.length'], ['negative index', '.-1'], ['out of bounds', '[999].minxinLocal']]) {
  test('reject ' + label + ' array write without mutation', () => {
    const d = fixture(); unchanged(d, () => call(d, 'applyEdit', { path: divs + suffix, value: 77 }));
  });
}
test('failed append through a missing named region is not falsely successful', () => {
  const d = fixture(); unchanged(d, () => call(d, 'applyPush', { path: divs + '.不存在.children', value: { id: 'new', name: '新县' } }));
});
test('failed read and batch read accurately report a missing leaf', () => {
  const d = fixture(), p = divs + '.r-a.noSuchField';
  assert.equal(call(d, 'getField', { path: p }).ok, false);
  assert.equal(call(d, 'getFields', { paths: [p] }).values[0].found, false);
});
test('duplicate names cannot silently select the first region', () => {
  const d = fixture(), p = divs + '.同名州.minxinLocal';
  assert.equal(call(d, 'getField', { path: p }).ok, false);
  unchanged(d, () => call(d, 'applyEdit', { path: p, value: 77 }));
});
test('explicit unique ID updates only the requested duplicate-name region', () => {
  const d = fixture(); assert.equal(AA.applyEdit(d, divs + '.r-c.minxinLocal', 77).ok, true);
  assert.equal(d.adminHierarchy.楚.divisions[1].minxinLocal, 20);
  assert.equal(d.adminHierarchy.楚.divisions[2].minxinLocal, 77);
});
test('ID takes precedence over an unrelated name that happens to equal it', () => {
  const d = fixture(); d.adminHierarchy.楚.divisions[0].name = 'r-c';
  assert.equal(AA.applyEdit(d, divs + '.r-c.minxinLocal', 77).ok, true);
  assert.equal(d.adminHierarchy.楚.divisions[0].minxinLocal, 58);
  assert.equal(d.adminHierarchy.楚.divisions[2].minxinLocal, 77);
});
test('duplicate IDs are rejected without choosing an arbitrary row', () => {
  const d = fixture(); d.adminHierarchy.楚.divisions[2].id = 'r-b';
  unchanged(d, () => AA.applyEdit(d, divs + '.r-b.minxinLocal', 77));
});
test('new object fields under a valid named entity are created and persist', () => {
  const d = fixture(), p = divs + '.r-a.economyBase.newMetric.value';
  assert.equal(AA.applyEdit(d, p, 1.25).ok, true);
  assert.equal(call(roundtrip(d), 'getField', { path: p }).value, 1.25);
  assert.equal(d.adminHierarchy.楚.divisions[0].economyBase.farmland, 112);
});
test('missing object chain remains supported without partial invalid bracket scaffolding', () => {
  const d = fixture(); assert.equal(AA.applyEdit(d, 'worldSettings.religion', '儒').ok, true);
  unchanged(d, () => AA.applyEdit(d, 'newConfig.rows[0].name', '无效'));
});
test('explicit append can create a child collection under the actual selected ID', () => {
  const d = fixture(), p = divs + '.r-c.children';
  assert.equal(AA.applyPush(d, p, { id: 'child', name: '新县' }).ok, true);
  assert.equal(call(roundtrip(d), 'getField', { path: p + '[0].name' }).value, '新县');
});
test('remove keeps legitimate ID/index operations but rejects missing and ambiguous names', () => {
  const d = fixture(); unchanged(d, () => AA.applyRemove(d, divs + '.不存在'));
  unchanged(d, () => AA.applyRemove(d, divs + '.同名州'));
  assert.equal(AA.applyRemove(d, divs + '.r-c').ok, true);
  assert.equal(d.adminHierarchy.楚.divisions.length, 2);
});
test('atomic multi-edit rollback includes a later unresolved named entity', () => {
  const d = fixture(); unchanged(d, () => call(d, 'multiEdit', { edits: [{ path: divs + '.r-a.minxinLocal', value: 77 }, { path: divs + '.不存在.minxinLocal', value: 90 }] }));
});
test('unsafe or prototype paths remain rejected even with force', () => {
  const d = fixture(); for (const p of ['__proto__.polluted', 'constructor.prototype.polluted', divs + '.constructor.polluted']) {
    assert.equal(AA.applyEdit(d, p, true, { force: true }).ok, false);
    assert.equal(AA.applyPush(d, p, {}, { force: true }).ok, false);
  }
  assert.equal({}.polluted, undefined);
});
test('detached draft edits do not touch caller-owned scenario data', () => {
  const source = fixture(), d = AA.makeDraft(source), before = roundtrip(source);
  assert.equal(AA.applyEdit(d, divs + '.r-a.minxinLocal', 88).ok, true);
  assert.deepEqual(source, before);
});
test('stable ID still selects the intended region after reordering', () => {
  const d = fixture(); d.adminHierarchy.楚.divisions.reverse();
  assert.equal(AA.applyEdit(d, divs + '.r-c.minxinLocal', 0).ok, true);
  assert.equal(d.adminHierarchy.楚.divisions[0].id, 'r-c');
  assert.equal(d.adminHierarchy.楚.divisions[0].minxinLocal, 0);
  assert.equal(d.adminHierarchy.楚.divisions.find(r => r.id === 'r-b').minxinLocal, 20);
});
test('zero, false, null and readable array length are not mistaken for missing values', () => {
  const d = fixture(); Object.assign(d.adminHierarchy.楚.divisions[0], { count: 0, enabled: false, desc: null });
  const p = divs + '.r-a';
  const r = call(d, 'getFields', { paths: [p + '.count', p + '.enabled', p + '.desc', divs + '.length'] });
  assert(r.values.every(v => v.found));
  assert.equal(call(d, 'getField', { path: divs + '.length' }).value, 3);
});
test('copy from missing field already fails and remains non-mutating', () => {
  const d = fixture(); unchanged(d, () => call(d, 'copyField', { from: divs + '.r-a.absent', to: 'overview' }));
});
test('nested bracket indices including Chinese object keys remain supported', () => {
  const d = fixture(); d.区域矩阵 = [[{ name: '甲', minxinLocal: 12 }]];
  assert.equal(AA.applyEdit(d, '区域矩阵[0][0].minxinLocal', 13).ok, true);
  assert.equal(call(roundtrip(d), 'getField', { path: '区域矩阵[0][0].minxinLocal' }).value, 13);
});
test('separate drafts with reused IDs never share lookup state', () => {
  const a = fixture(), b = fixture(); b.adminHierarchy.楚.divisions[0].minxinLocal = 3;
  assert.equal(AA.applyEdit(a, divs + '.r-a.minxinLocal', 77).ok, true);
  assert.equal(call(b, 'getField', { path: divs + '.r-a.minxinLocal' }).value, 3);
});
test('filtered bulk update accepts the same nested collection as search', () => {
  const d = fixture();
  const r = call(d, 'bulkUpdate', { collection: divs, where: { id: 'r-c' }, field: 'minxinLocal', op: 'set', value: 77 });
  assert.equal(r.ok, true); assert.equal(r.changed, 1);
  assert.equal(call(roundtrip(d), 'getField', { path: divs + '.r-c.minxinLocal' }).value, 77);
  assert.equal(d.adminHierarchy.楚.divisions[1].minxinLocal, 20);
});
test('numeric aggregate reads the same nested administrative values', () => {
  const r = call(fixture(), 'statsAggregate', { collection: divs, metrics: ['minxinLocal'] });
  assert.equal(r.ok, true); assert.equal(r.stats['(全部)'].count, 3);
  assert.equal(r.stats['(全部)'].metrics.minxinLocal.sum, 158);
});
test('append preserves an existing array without reassigning its read-only owner property', () => {
  const d = { items: [] }, original = d.items; Object.freeze(d);
  assert.equal(AA.applyPush(d, 'items', { name: '追加项' }).ok, true);
  assert.equal(d.items, original); assert.equal(d.items.length, 1);
});
let pass = 0, fail = 0;
(async function () {
  for (const t of tests) try { await t.body(); pass++; console.log('PASS ' + t.name); } catch (e) { fail++; console.error('FAIL ' + t.name + ': ' + e.message); }
  console.log(JSON.stringify({ source: ref || 'worktree', pass, fail, total: tests.length, scope: 'actual public authoring tools; no network or player data' }));
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
