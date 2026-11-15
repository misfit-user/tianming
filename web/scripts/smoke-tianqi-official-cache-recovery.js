'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROW_KEYS, materializeScenarioRows } = require('./lib/official-scenario-fixture.js');

const WEB_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(WEB_ROOT, '..');
const SCRIPT = path.join(WEB_ROOT, 'scenarios', 'tianqi7-1627.js');
const SOURCE = path.join(REPO_ROOT, 'scenarios', '天启七年·九月（官方）.json');
const SID = 'sc-tianqi7-1627';

function emptyProject() {
  const project = { scenarios: [{ id: SID, name: 'stale cached official scenario' }] };
  for (const key of ROW_KEYS) project[key] = [{ id: 'stale-' + key, sid: SID }];
  return project;
}

function loadGeneratedScenario() {
  global.P = emptyProject();
  global.window = global;
  global.document = { readyState: 'complete' };
  const oldLog = console.log;
  try {
    console.log = function () {};
    delete require.cache[require.resolve(SCRIPT)];
    require(SCRIPT);
  } finally {
    console.log = oldLog;
  }
  return materializeScenarioRows(global.P, SID);
}

// 内置脚本是补回 mapData 之后的运行时形态，拿同一形态来比。
const source = require('./official-scenario-source.js').readOfficialScenario(SOURCE).data;
const first = loadGeneratedScenario();
assert.deepStrictEqual(first, source, 'generated full scenario must equal the root official JSON');
assert.strictEqual(global.P.scenarios.filter((row) => row && row.id === SID).length, 1, 'stale cached scenario must be replaced');
for (const key of ROW_KEYS) {
  const expected = Array.isArray(source[key]) ? source[key].length : 0;
  const actual = global.P[key].filter((row) => row && row.sid === SID).length;
  assert.strictEqual(actual, expected, key + ' materialization must replace stale rows');
}

// A P restore invalidates the lazy-loader promise in production. Re-executing
// the generated script must therefore recover the same full payload cleanly.
const second = loadGeneratedScenario();
assert.deepStrictEqual(second, source, 'reloaded full scenario must still equal root JSON');
console.log('[smoke] tianqi official cache recovery PASS (root JSON + full script reload)');
