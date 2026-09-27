'use strict';
const assert = require('assert/strict'), path = require('path'), fs = require('fs'), cp = require('child_process');
// This isolated Node test compares multiple complete worlds. Collect only discarded comparison
// graphs between assertions; preserve every fixture, both formats, and the existing hard deadline.
const collectComparisonGarbage = typeof global.gc === 'function' ? global.gc : function() {};
const { saveBuilder, controlledWorld, officialScenarios, ROOT } = require('./lib-perf-round1');
const at = process.argv.indexOf('--repo'), root = at < 0 ? ROOT : path.resolve(process.argv[at + 1]);
// Compare every character, but never build a multi-gigabyte automatic diff on failure.
function equalComplete(actual, expected, label) {
  if (actual === expected) return;
  let offset = 0; while (offset < actual.length && offset < expected.length && actual[offset] === expected[offset]) offset++;
  throw new Error(label + ' at character ' + offset + '; lengths ' + actual.length + '/' + expected.length + '; actual=' + JSON.stringify(actual.slice(Math.max(0, offset - 80), offset + 160)) + '; expected=' + JSON.stringify(expected.slice(Math.max(0, offset - 80), offset + 160)));
}
const names = ['绍宋·建炎元年八月（官方）.json', '天启七年·九月（官方）.json'];
const caseAt = process.argv.indexOf('--case'), selectedCase = caseAt < 0 ? null : Number(process.argv[caseAt + 1]);
if (selectedCase === null) {
  const deadline = Date.now() + 290000; // Remains inside the existing 300-second outer guard.
  let passed = 0, failed = 0;
  for (let i = 0; i < 5; i++) {
    const child = cp.spawnSync(process.execPath, ['--expose-gc', __filename, '--repo', root, '--case', String(i)], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, timeout: Math.max(1, deadline - Date.now()) });
    process.stdout.write(child.stdout || ''); process.stderr.write(child.stderr || '');
    const result = (child.stdout || '').trim().split(/\r?\n/).filter(line => line.startsWith('{')).map(line => { try { return JSON.parse(line); } catch (_) { return null; } }).filter(Boolean).at(-1);
    if (child.status !== 0 || !result) failed++; if (result) { passed += result.passed; failed += result.failed; }
  }
  assert.equal(passed, 13, 'both full official scenarios, short/long history, both formats, restore and failure checks must all execute');
  console.log(JSON.stringify({ passed, failed, isolatedCases: 5 })); process.exit(failed ? 1 : 0);
}
assert(Number.isInteger(selectedCase) && selectedCase >= 0 && selectedCase < 5);
function scenario(index) { return { name: names[index], data: JSON.parse(fs.readFileSync(path.join(root, 'scenarios', names[index]), 'utf8')) }; }
let passed = 0, failed = 0;
function check(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.stack); } finally { fn = null; collectComparisonGarbage(); } }
for (const s of (selectedCase < 4 ? [scenario(Math.floor(selectedCase / 2))] : [])) for (const long of [selectedCase % 2 === 1]) {
  const h = saveBuilder(root), fixture = controlledWorld(s.data, long); h.c.GM = fixture.gm; h.c.P = fixture.p;
  let savedIdb = null, idbCloneCounts = null;
  check(s.name + ' long=' + long + ': actual normalizers/serializers idb + project equal legacy preparation', () => {
    const before = JSON.stringify(fixture);
    for (const format of ['idb', 'project']) {
      h.work.clones = 0;
      let expectedText = JSON.stringify(h.legacyBuild(format));
      const legacyClones = h.work.clones;
      collectComparisonGarbage();
      h.work.clones = 0;
      const actual = h.c._buildSaveState({ format, detach: true });
      const actualClones = h.work.clones;
      const actualText = JSON.stringify(actual);
      equalComplete(actualText, expectedText, 'output contents and key order unchanged');
      if (format === 'idb') { savedIdb = { actual: actualText, expected: expectedText }; idbCloneCounts = { legacy: legacyClones, current: actualClones }; }
      expectedText = null;
      const gm = format === 'idb' ? actual.GM : actual.gameState, p = format === 'idb' ? actual.P : actual;
      assert.equal(gm._savedEdictDrafts['edict-pol'], h.drafts['edict-pol'].value);
      assert.equal(gm._savedNpcDecisionDiagnostics.length, 120);
      assert(gm._savedRenli); assert(gm._savedGovernment); assert(gm._savedEventBus); assert(gm._savedEventOpinions);
      assert.equal(gm._chronicleSysState.version, 3); assert.equal(gm._warTruces.truces.example, 900);
      assert.equal(p.conf.memorySynthesisEnabled, false); assert.equal(p.conf._saveSchemaVersion, '1.3.0-ai-upgrade');
      assert.equal(typeof gm.population.national.mouths, 'number');
      equalComplete(JSON.stringify(fixture), before, 'live GM/P unchanged by normalization and drafts');
    }
  });
  check(s.name + ' long=' + long + ': discarded mirrors never cloned on canonical path', () => {
    assert(idbCloneCounts, 'both real idb implementations must already have executed');
    assert.equal(idbCloneCounts.legacy - idbCloneCounts.current, 23, 'only the 23 discarded preparation mirror clones are removed');
  });
  check(s.name + ' long=' + long + ': actual restore preserves canonical and legacy mirrors', () => {
    function restore(value) {
      const r = saveBuilder(root); const roundtrip = JSON.parse(typeof value === 'string' ? value : JSON.stringify(value)); r.c.GM = roundtrip.GM; r.c.P = roundtrip.P;
      r.c._ensurePDefaults(r.c.P, r.c.GM); r.c._ensureGMDefaults(r.c.GM, r.c.P); r.c._restoreSavedFields();
      return JSON.stringify({ GM: r.c.GM, P: r.c.P });
    }
    assert(savedIdb, 'complete independent idb outputs must have been captured');
    let restoredExpected = restore(savedIdb.expected);
    savedIdb.expected = null;
    collectComparisonGarbage();
    equalComplete(restore(savedIdb.actual), restoredExpected, 'complete restored states must match');
    savedIdb = null;
    restoredExpected = null; collectComparisonGarbage();
    const old = h.c._prepareGMForSave(structuredClone(fixture.gm), structuredClone(fixture.p));
    assert(old.GM._savedMapData); assert(old.GM._savedFamilies); assert(old.GM._savedAdminHierarchy);
    const restored = JSON.parse(restore(old)); assert.deepEqual(restored.GM.families, old.GM._savedFamilies);
  });
}
if (selectedCase === 4) check('normalization failure rejects without changing live; subsequent valid world recovers', () => {
  const h = saveBuilder(root), f = controlledWorld(scenario(0).data); h.c.GM = f.gm; h.c.P = f.p;
  h.c.GM.population = { national: { mouths: NaN, households: 10 } }; const before = structuredClone(f);
  assert.throws(() => h.c._buildSaveState({ format: 'idb', detach: true })); assert.deepEqual(f, before);
  delete h.c.GM.population; assert(h.c._buildSaveState({ format: 'idb', detach: true }));
});
console.log(JSON.stringify({ passed, failed })); process.exitCode = failed ? 1 : 0;
