'use strict';
// A rejected performance experiment must not narrow the existing rollback
// contract to JSON-only data or sever graph aliases in before-state evidence.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { fixture } = require('./lib-npc-action-fixture');
const { functionSource } = require('./lib-perf-round1');
function world() {
  const c = fixture(); c.structuredClone = structuredClone;
  vm.runInContext(functionSource(fs.readFileSync(require.resolve('../tm-utils.js'), 'utf8'), 'deepClone'), c, { filename: 'tm-utils.js:deepClone' });
  const shared = { id: 'region', points: [[1, 2], [3, 4]] };
  const map = { regions: [shared], selected: shared, updatedAt: new Date('2026-10-21T00:00:00Z'), index: new Map([['region', shared]]), optional: undefined, zero: -0 };
  map.self = map;
  c.GM.mapData = map; c.GM.map = map; c.GM.marker = { value: 1 };
  c.P.scenarios = [{ id: 'fixture', map }]; c.P.map = map;
  return { c, run: c.TM.AIChange.WriteGuards.runAtomicMutation };
}
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
test('successful work leaves live graph identity intact and before-state independently readable', () => {
  const { c, run } = world(), liveMap = c.GM.mapData; let before;
  assert.equal(run(snapshot => { before = snapshot; c.GM.mapData.regions[0].id = 'changed'; c.GM.marker.value = 2; return { ok: true }; }).ok, true);
  assert.equal(c.GM.mapData, liveMap); assert.equal(c.GM.map, liveMap);
  const oldMap = before.beforeGM.mapData;
  assert.notEqual(oldMap, liveMap); assert.equal(oldMap.regions[0].id, 'region');
  assert.equal(before.beforeGM.map, oldMap); assert.equal(oldMap.self, oldMap);
  assert.equal(oldMap.regions[0], oldMap.selected); assert.equal(oldMap.index.get('region'), oldMap.selected);
  assert.equal(oldMap.updatedAt.toISOString(), '2026-10-21T00:00:00.000Z');
  assert(Object.hasOwn(oldMap, 'optional')); assert.equal(oldMap.optional, undefined); assert(Object.is(oldMap.zero, -0));
  assert.equal(before.beforeP.scenarios[0].map, before.beforeP.map, 'nested alias across large fields must remain an alias');
  oldMap.selected.id = 'snapshot-only'; assert.equal(liveMap.selected.id, 'changed');
});
test('failure restores complex large fields and all ordinary siblings without JSON coercion', () => {
  for (const thrown of [true, false]) {
    const { c, run } = world(), oldG = structuredClone(c.GM), oldP = structuredClone(c.P);
    const result = run(() => {
      c.GM.mapData.regions[0].points[0][0] = 999; c.GM.mapData.updatedAt.setFullYear(2000);
      c.GM.mapData.index.clear(); delete c.GM.map; c.GM.marker.value = 99;
      c.P.scenarios[0].id = 'damaged'; c.P.map = { wrong: true };
      if (thrown) throw Error('injected-handler-failure'); return { ok: false, reason: 'injected-handler-rejection' };
    });
    assert.equal(result.ok, false); assert.equal(result.rolledBack, true);
    assert.deepEqual(c.GM, oldG); assert.deepEqual(c.P, oldP);
    assert.equal(c.GM.map, c.GM.mapData); assert.equal(c.GM.mapData.self, c.GM.mapData);
    assert.equal(c.GM.mapData.index.get('region'), c.GM.mapData.regions[0]);
    assert.equal(c.P.scenarios[0].map, c.P.map);
  }
});
console.log(JSON.stringify({ suite: 'ai-atomic-snapshot-contract', passed }));
