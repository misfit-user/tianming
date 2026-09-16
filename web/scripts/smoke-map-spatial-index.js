'use strict';
const assert = require('node:assert/strict'),
  G = require('../tm-map-workbench.js');
function referenceLength(a, b, t) {
  let result = 0;
  const cross = (x, y, z) => (y[0] - x[0]) * (z[1] - x[1]) - (y[1] - x[1]) * (z[0] - x[0]);
  for (const p of G.polys(a))
    for (const ring of p)
      for (let i = 1; i < ring.length; i++) {
        const x = ring[i - 1],
          y = ring[i],
          len = Math.hypot(y[0] - x[0], y[1] - x[1]);
        if (!len) continue;
        for (const q of G.polys(b))
          for (const other of q)
            for (let j = 1; j < other.length; j++) {
              const u = other[j - 1],
                v = other[j];
              if (
                Math.min(x[0], y[0]) > Math.max(u[0], v[0]) + t ||
                Math.max(x[0], y[0]) + t < Math.min(u[0], v[0]) ||
                Math.min(x[1], y[1]) > Math.max(u[1], v[1]) + t ||
                Math.max(x[1], y[1]) + t < Math.min(u[1], v[1])
              )
                continue;
              if (Math.abs(cross(x, y, u)) > t * len || Math.abs(cross(x, y, v)) > t * len) continue;
              const ax = (y[0] - x[0]) / len,
                ay = (y[1] - x[1]) / len,
                du = (u[0] - x[0]) * ax + (u[1] - x[1]) * ay,
                dv = (v[0] - x[0]) * ax + (v[1] - x[1]) * ay;
              result += Math.max(0, Math.min(len, Math.max(du, dv)) - Math.max(0, Math.min(du, dv)));
            }
      }
  return result;
}
for (const count of [2, 13, 64, 257]) {
  const boundary = Array.from({ length: count + 1 }, (_, i) => [
    5 + (i === 0 || i === count ? 0 : Math.sin(i) * 0.3),
    i,
  ]);
  const a = { type: 'Polygon', coordinates: [[[0, 0], ...boundary, [0, count], [0, 0]]] },
    b = { type: 'Polygon', coordinates: [[boundary[0], [10, 0], [10, count], ...boundary.slice().reverse()]] };
  const map = {
      id: 'index-' + count,
      version: '1',
      coordinateSystemId: 'game-pixel',
      cells: [
        { id: 'a', geometry: a },
        { id: 'b', geometry: b },
      ],
    },
    before = JSON.stringify(map),
    r = G.inspect(map);
  assert(r.ok);
  assert.equal(r.points, a.coordinates[0].length + b.coordinates[0].length);
  assert.equal(r.adjacency.length, 1);
  assert.equal(r.adjacency[0].length, referenceLength(a, b, r.parameters.coordinateTolerance));
  assert.equal(JSON.stringify(map), before);
  assert.equal(r.parameters.maxComparisons, 2000000);
}
console.log('PASS indexed shared boundaries equal ordered exhaustive segment comparisons at all tested tree depths');
const rect = (x, y) => ({
  type: 'Polygon',
  coordinates: [
    [
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
      [x, y],
    ],
  ],
});
const sparse = {
  id: 'sparse',
  version: '1',
  coordinateSystemId: 'game-pixel',
  cells: Array.from({ length: 120 }, (_, i) => ({ id: 'cell-' + i, geometry: rect(i * 3, 0) })),
};
const r = G.inspect(sparse);
assert(r.ok);
assert.equal(r.isolated.length, 120);
assert.equal(r.adjacency.length, 0);
assert.equal(r.points, 600);
console.log('PASS disjoint regions retain all vertices and never become routes');
