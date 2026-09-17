'use strict';
const assert = require('assert/strict'), path = require('path');
const { saveBuilder, controlledWorld, officialScenarios, ROOT } = require('./lib-perf-round1');
const at = process.argv.indexOf('--repo'), root = at < 0 ? ROOT : path.resolve(process.argv[at + 1]);
let passed = 0, failed = 0;
function check(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.stack); } }
for (const s of officialScenarios(root)) for (const long of [false, true]) {
  const h = saveBuilder(root), fixture = controlledWorld(s.data, long); h.c.GM = fixture.gm; h.c.P = fixture.p;
  check(s.name + ' long=' + long + ': actual normalizers/serializers idb + project equal legacy preparation', () => {
    const before = JSON.stringify(fixture);
    for (const format of ['idb', 'project']) {
      const expected = h.legacyBuild(format), actual = h.c._buildSaveState({ format, detach: true });
      assert.equal(JSON.stringify(actual), JSON.stringify(expected), 'output contents and key order unchanged');
      const gm = format === 'idb' ? actual.GM : actual.gameState, p = format === 'idb' ? actual.P : actual;
      assert.equal(gm._savedEdictDrafts['edict-pol'], h.drafts['edict-pol'].value);
      assert.equal(gm._savedNpcDecisionDiagnostics.length, 120);
      assert(gm._savedRenli); assert(gm._savedGovernment); assert(gm._savedEventBus); assert(gm._savedEventOpinions);
      assert.equal(gm._chronicleSysState.version, 3); assert.equal(gm._warTruces.truces.example, 900);
      assert.equal(p.conf.memorySynthesisEnabled, false); assert.equal(p.conf._saveSchemaVersion, '1.3.0-ai-upgrade');
      assert.equal(typeof gm.population.national.mouths, 'number');
      assert.equal(JSON.stringify(fixture), before, 'live GM/P unchanged by normalization and drafts');
    }
  });
  check(s.name + ' long=' + long + ': discarded mirrors never cloned on canonical path', () => {
    h.work.clones = 0; h.legacyBuild('idb'); const legacy = h.work.clones;
    h.work.clones = 0; h.c._buildSaveState({ format: 'idb', detach: true });
    assert.equal(legacy - h.work.clones, 23, 'only the 23 discarded preparation mirror clones are removed');
  });
  check(s.name + ' long=' + long + ': actual restore preserves canonical and legacy mirrors', () => {
    const actual = h.c._buildSaveState({ format: 'idb', detach: true }), expected = h.legacyBuild('idb');
    function restore(value) {
      const r = saveBuilder(root); const roundtrip = JSON.parse(JSON.stringify(value)); r.c.GM = roundtrip.GM; r.c.P = roundtrip.P;
      r.c._ensurePDefaults(r.c.P, r.c.GM); r.c._ensureGMDefaults(r.c.GM, r.c.P); r.c._restoreSavedFields();
      return JSON.stringify({ GM: r.c.GM, P: r.c.P });
    }
    assert.equal(restore(actual), restore(expected));
    const old = h.c._prepareGMForSave(structuredClone(fixture.gm), structuredClone(fixture.p));
    assert(old.GM._savedMapData); assert(old.GM._savedFamilies); assert(old.GM._savedAdminHierarchy);
    const restored = JSON.parse(restore(old)); assert.deepEqual(restored.GM.families, old.GM._savedFamilies);
  });
}
check('normalization failure rejects without changing live; subsequent valid world recovers', () => {
  const h = saveBuilder(root), f = controlledWorld(officialScenarios(root)[0].data); h.c.GM = f.gm; h.c.P = f.p;
  h.c.GM.population = { national: { mouths: NaN, households: 10 } }; const before = structuredClone(f);
  assert.throws(() => h.c._buildSaveState({ format: 'idb', detach: true })); assert.deepEqual(f, before);
  delete h.c.GM.population; assert(h.c._buildSaveState({ format: 'idb', detach: true }));
});
console.log(JSON.stringify({ passed, failed })); process.exitCode = failed ? 1 : 0;
