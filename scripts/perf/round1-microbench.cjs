'use strict';
// Module-level observations, not Electron frame-rate claims. Alternating A/B order.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto'), os = require('os'), assert = require('assert/strict');
const { ROOT, storage, mapRenderer, saveBuilder, controlledWorld, officialScenarios } = require('../../web/scripts/lib-perf-round1');
const args = process.argv.slice(2), arg = (n, d) => args.includes(n) ? args[args.indexOf(n) + 1] : d;
const baseline = path.resolve(arg('--baseline', '../tianming-perf-baseline')), repeats = Number(arg('--repeats', 9));
assert(Number.isInteger(repeats) && repeats >= 3);
const output = path.resolve(arg('--out', 'web/dev-tools/perf-round1/microbench.json'));
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const identity = root => ({ head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceHashes: Object.fromEntries(['web/tm-storage.js', 'web/phase8-formal-map.js', 'web/tm-save-lifecycle.js'].map(f => [f, sha(fs.readFileSync(path.join(root, f)))])) });
const report = { kind: 'node-module-microbench', node: process.version, platform: process.platform, cpu: os.cpus()[0].model,
  logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem(), startedAt: new Date().toISOString(), baseline: identity(baseline), candidate: identity(ROOT),
  repeats, warmupsPerVariant: 2, gcControlled: false, scope: 'actual functions; controlled DOM/providers for map only; actual save normalizers/serializers; no layout/paint/network measurement', samples: [] };
function summary(raw) { const a = [...raw].sort((x, y) => x - y); return { p50: a[Math.floor(a.length * .5)], p95: a[Math.min(a.length - 1, Math.ceil(a.length * .95) - 1)], min: a[0], max: a[a.length - 1] }; }
async function pair(name, run, meta) {
  const row = { name, ...meta, before: [], after: [] };
  for (let i = -2; i < repeats; i++) for (const side of (i % 2 ? ['after', 'before'] : ['before', 'after'])) {
    const r = await run(side); if (i >= 0) row[side].push(r);
  }
  row.summary = Object.fromEntries(['before', 'after'].map(side => [side, summary(row[side].map(x => x.ms))]));
  report.samples.push(row); console.log(name, JSON.stringify(row.summary));
}
(async () => {
  for (const scenario of officialScenarios()) {
    const map = scenario.data.mapData?.regions?.length ? scenario.data.mapData : scenario.data.map;
    const maps = { before: mapRenderer(baseline, map.regions), after: mapRenderer(ROOT, map.regions) };
    for (const h of Object.values(maps)) h.c.map = map;
    maps.before.render(); maps.after.render(); assert.equal(maps.after.stage.innerHTML, maps.before.stage.innerHTML);
    await pair('map/' + scenario.data.id, side => {
      const h = maps[side]; h.invalidate(); h.work.paths = 0; const t = performance.now(); h.render();
      return { ms: performance.now() - t, pathCalls: h.work.paths };
    }, { regions: map.regions.length, oceans: (map.oceans || []).length, pointRegions: map.regions.filter(r => !r.d && !r.path).length,
      inputHash: sha(JSON.stringify(map)), outputHash: sha(maps.before.stage.innerHTML), svgBytes: Buffer.byteLength(maps.before.stage.innerHTML) });
    for (const long of [false, true]) {
      const fixture = controlledWorld(scenario.data, long), saves = { before: saveBuilder(baseline), after: saveBuilder(ROOT) };
      for (const h of Object.values(saves)) { h.c.GM = fixture.gm; h.c.P = fixture.p; }
      const before = saves.before.c._buildSaveState({ format: 'idb', detach: true }), after = saves.after.c._buildSaveState({ format: 'idb', detach: true });
      assert.equal(JSON.stringify(after), JSON.stringify(before));
      const sample = { scenario: scenario.data.id, long, inputBytes: Buffer.byteLength(JSON.stringify(fixture)), outputBytes: Buffer.byteLength(JSON.stringify(before)), outputHash: sha(JSON.stringify(before)) };
      await pair('snapshot/' + scenario.data.id + '/long=' + long, side => {
        const h = saves[side]; h.work.clones = 0; h.work.cloneMs = 0;
        const t = performance.now(); h.c._buildSaveState({ format: 'idb', detach: true });
        return { ms: performance.now() - t, cloneCalls: h.work.clones, cloneMs: h.work.cloneMs };
      }, sample);
      if (!long) continue;
      for (const gzip of [true, false]) {
        const stores = { before: storage(baseline), after: storage(ROOT) };
        for (const h of Object.values(stores)) h.c.SaveCompression.supported = gzip;
        await pair('canonical/' + scenario.data.id + '/gzip=' + gzip, async side => {
          const h = stores[side]; h.work.encodes = 0; h.work.encodedBytes = 0; h.work.encodeMs = []; h.work.spans = {};
          const t = performance.now(), p = await h.c.TM_SaveDB.createCanonicalPayload(before, { timelineId: 'tml_perf' });
          const ms = performance.now() - t;
          assert.equal(p.checksum, sample.outputHash); assert.equal(p.jsonByteLength, sample.outputBytes);
          return { ms, encodes: h.work.encodes, encodedBytes: h.work.encodedBytes, encodeMs: h.work.encodeMs.reduce((a, b) => a + b, 0), spans: h.work.spans, compressedBytes: p.compressedByteLength };
        }, { ...sample, gzip, asyncCompressionIsWallTimeNotBlockingTime: true });
      }
    }
  }
  report.complete = true; fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log('PERF_REPORT ' + output);
})().catch(error => { report.error = error.stack; fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2)); console.error(error); process.exitCode = 1; });
