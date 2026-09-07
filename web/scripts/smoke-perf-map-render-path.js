'use strict';
const assert = require('assert/strict'), path = require('path');
const { mapRenderer, officialScenarios, ROOT } = require('./lib-perf-round1');
const at = process.argv.indexOf('--repo'), root = at < 0 ? ROOT : path.resolve(process.argv[at + 1]);
let passed = 0, failed = 0;
function check(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + ': ' + e.stack); } }
function paths(html, layer) { return [...html.matchAll(/<path class="([^"]*)"[^>]* d="([^"]*)"/g)].filter(m => m[1].split(' ').includes(layer)).map(m => m[2]); }
const expected = 'M0.0 0.0 L10.0 0.0 L0.0 10.0 Z';
for (const [geometry, d] of [
  [{ d: 'M 1 2 L 3 4 Z', points: [[99, 99]] }, 'M 1 2 L 3 4 Z'],
  [{ path: 'M 2 3 L 4 5 Z' }, 'M 2 3 L 4 5 Z'],
  [{ points: [[0, 0], [10, 0], [0, 10]] }, expected],
  [{ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }] }, expected],
  [{ polygon: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }] }, expected],
  [{ coords: [0, 0, 10, 0, 0, 10] }, expected],
  [{ points: [] }, ''], [{ points: [{ x: NaN, y: 1 }] }, '']
]) check('geometry ' + Object.keys(geometry)[0] + ' ' + d, () => {
  for (const legacy of [false, true]) {
    const h = mapRenderer(root, [{ id: 'one', name: '中文<城>', ...geometry }], legacy); h.render();
    for (const cls of ['tmf-region-wash', 'tmf-region-halo', 'tmf-region']) assert.deepEqual(paths(h.stage.innerHTML, cls), d ? [d] : []);
    assert.equal(h.work.paths, 1, 'compute once even for empty paths'); assert.equal(h.work.layouts, 1);
    if (d) assert(h.stage.innerHTML.includes('中文&lt;城&gt;'));
    h.render(); assert.equal(h.work.paths, 1, 'unchanged signature skips all geometry work'); assert.equal(h.work.layouts, 1);
  }
});
check('object identity, not duplicate region IDs; repeated same object still drawn twice', () => {
  const a = { id: 'same', d: 'M1 1Z' }, b = { id: 'same', d: 'M2 2Z' };
  const h = mapRenderer(root, [a, b, a]); h.render(); assert.equal(h.work.paths, 2);
  for (const cls of ['tmf-region-wash', 'tmf-region-halo', 'tmf-region']) assert.deepEqual(paths(h.stage.innerHTML, cls), [a.d, b.d, a.d]);
});
check('render-local only: in-place geometry mutation and replacement world with same IDs', () => {
  const a = { id: 'same', points: [[0, 0], [1, 1]] }; const h = mapRenderer(root, [a]); h.render();
  a.points[1][0] = 42; h.invalidate(); h.render(); assert(paths(h.stage.innerHTML, 'tmf-region')[0].includes('42.0'));
  h.c.map = { ...h.c.map, regions: [{ id: 'same', d: 'M77 99Z' }] }; h.invalidate(); h.render();
  assert.deepEqual(paths(h.stage.innerHTML, 'tmf-region'), ['M77 99Z']); assert.equal(h.work.paths, 3);
});
check('throwing geometry aborts render; explicit invalidation allows recovery', () => {
  let broken = true; const a = { id: 'x', get d() { if (broken) throw new Error('geometry-failed'); return 'M1 2Z'; } };
  const h = mapRenderer(root, [a]); assert.throws(() => h.render(), /geometry-failed/);
  assert.equal(h.stage.innerHTML, ''); broken = false; h.invalidate(); h.render(); assert.deepEqual(paths(h.stage.innerHTML, 'tmf-region'), ['M1 2Z']);
});
for (const s of officialScenarios(root)) check('official geometry, full three-layer equivalence: ' + s.name, () => {
  const map = s.data.mapData?.regions?.length ? s.data.mapData : s.data.map;
  assert(map?.regions?.length, 'real official geometry exists');
  const h = mapRenderer(root, map.regions); h.c.map = map; h.render();
  const faces = paths(h.stage.innerHTML, 'tmf-region'); assert(faces.length > 0);
  assert.deepEqual(paths(h.stage.innerHTML, 'tmf-region-wash'), faces); assert.deepEqual(paths(h.stage.innerHTML, 'tmf-region-halo'), faces);
  assert.equal(h.work.paths, new Set(map.regions).size + (map.oceans || []).length);
});
console.log(JSON.stringify({ passed, failed })); process.exitCode = failed ? 1 : 0;
