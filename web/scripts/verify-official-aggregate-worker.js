'use strict';
// Run one aggregate consumer per process to bound memory, then compare full data.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const mode = process.argv[2];
assert(['seeder','preview'].includes(mode), 'aggregate mode required');
const files = {seeder:'web/tm-official-scenario-bundle.js',preview:'web/preview/official-scenarios-bundle.js'};
const context = {};context.window=context;context.globalThis=context;vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, files[mode]), 'utf8'), context, {timeout:90000});
const entries = require('./sync-official-scenarios.js').ENTRIES;
let checks = 0;
for (const entry of entries) {
  const expected = JSON.parse(fs.readFileSync(path.join(root, 'scenarios', entry.filename), 'utf8'));
  const actual = mode === 'seeder'
    ? context.TMOfficialScenarioBundle.find(x => x.filename === entry.filename.replace(/\.json$/, '')).data
    : context.TM_OFFICIAL_SCENARIOS[entry.key];
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), entry.key + ' all fields/values/order preserved');checks++;
  if (actual.map && actual.mapData) {
    assert.notEqual(actual.map, actual.mapData, entry.key + ' maps remain independent');checks++;
    if (actual.map.regions && actual.mapData.regions && actual.map.regions.length) {
      assert.notEqual(actual.map.regions[0], actual.mapData.regions[0], 'nested mutable regions independent');checks++;
    }
  }
}
console.log(JSON.stringify({mode,ok:true,checks}));
