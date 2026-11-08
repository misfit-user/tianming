'use strict';
// Run one aggregate consumer per process to bound memory, then compare full data.
//   builtin — the three builtins on a page without P: TMOfficialScenarioBuiltins registry (desktop seeder/tests)
//   game    — the three builtins on a page with P.scenarios: in-game registration, no extra reference kept
//   preview — builtins + web/preview/official-scenarios-bundle.js adapter: TM_OFFICIAL_SCENARIOS by key
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const { ENTRIES, loadBuiltins } = require('./lib-official-builtins.js');
const mode = process.argv[2];
assert(['builtin', 'game', 'preview'].includes(mode), 'aggregate mode required');
const context = loadBuiltins({ seed: mode === 'game' ? { P: { scenarios: [] } } : null, timeout: 90000 });
if (mode === 'preview') {
  vm.runInContext(fs.readFileSync(path.join(root, 'web/preview/official-scenarios-bundle.js'), 'utf8'), context, { timeout: 90000 });
}
let checks = 0;
if (mode === 'game') {
  assert.equal(context.TMOfficialScenarioBuiltins, undefined, 'in-game registration must not keep a registry reference');checks++;
  assert.equal(context.P.scenarios.length, ENTRIES.length, 'every builtin registers into P.scenarios');checks++;
}
for (const entry of ENTRIES) {
  const expected = JSON.parse(fs.readFileSync(path.join(root, 'scenarios', entry.filename), 'utf8'));
  const actual = mode === 'builtin' ? context.TMOfficialScenarioBuiltins[entry.id]
    : mode === 'game' ? context.P.scenarios.find((scenario) => scenario && scenario.id === entry.id)
    : context.TM_OFFICIAL_SCENARIOS[entry.key];
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), entry.key + ' all fields/values/order preserved');checks++;
  if (actual.map && actual.mapData) {
    assert.notEqual(actual.map, actual.mapData, entry.key + ' maps remain independent');checks++;
    if (actual.map.regions && actual.mapData.regions && actual.map.regions.length) {
      assert.notEqual(actual.map.regions[0], actual.mapData.regions[0], 'nested mutable regions independent');checks++;
    }
  }
}
console.log(JSON.stringify({ mode, ok: true, checks }));
