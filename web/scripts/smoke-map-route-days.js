#!/usr/bin/env node
// 路程纯数据 smoke：不启动游戏，三部地图依次读取并释放。
'use strict';
const assert = require('node:assert/strict'), fs = require('fs'), path = require('path');
const route = require('../tm-map-route-days');
const started = Date.now();

// 独立计算参考点的球面残差，输出公里均方根。
function km(a, b) {
  const rad = Math.PI / 180, x = (b[1] - a[1]) * rad, y = (b[0] - a[0]) * rad;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(y / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
}

const cases = [
  ['天启七年·九月（官方）.json', [['顺天府', [116.4, 39.9]], ['应天府', [118.8, 32.1]], ['杭州府', [120.2, 30.3]]], [0, 1, 8, 15]],
  ['晚唐·开成五年（官方）.json', [['京兆府·长安', [108.94, 34.27]], ['河南府·洛阳', [112.45, 34.68]], ['杭州', [120.17, 30.25]]], [0, 1, 3, 7]],
  ['绍宋·建炎元年八月（官方）.json', [['开封府', [114.3, 34.8]], ['杭州', [120.16, 30.25]], ['河南府', [112.45, 34.68]]], [0, 1, 7, 13]]
];
for (const [file, samples, trip] of cases) {
  const map = JSON.parse(fs.readFileSync(path.join(__dirname, '../bundled-scenarios', file))).map;
  const regions = samples.map(([name, expected]) => {
    const region = map.regions.find(r => r.name === name); assert(region, name);
    const actual = route.lonLatOf(map, region); assert(actual, name + ' 坐标');
    expected.forEach((value, i) => assert(Math.abs(actual[i] - value) < 0.5, name + ' 坐标误差'));
    if (map.projection) {
      const projected = route.lonLatOf(map, { center: region.center });
      expected.forEach((value, i) => assert(Math.abs(projected[i] - value) < 0.5, name + ' 投影反解误差'));
    }
    console.log('[coordinate] ' + file.slice(0, 2) + ' ' + name + ' ' + JSON.stringify(actual)); return region;
  });
  const first = route.routeDays(map, regions[trip[0]]), target = route.daysBetween(map, regions[trip[0]], regions[trip[1]]);
  assert(target.days >= trip[2] && target.days <= trip[3]); assert.equal(target.estimated, false);
  const strict = route.planRoute(map, regions[trip[0]].id, regions[trip[1]].id, { mode: 'walking' });
  assert.equal(strict.status, 'reachable'); assert(strict.path.length >= 2 && strict.km > 0 && strict.days > 0 && strict.segments.length > 0);
  assert.equal(first.get(regions[trip[0]].id).days, 0);
  assert.equal(route.routeDays(map, regions[trip[0]]), first);
  const fresh = route.routeDays(map, regions[trip[0]], { fresh: true });
  assert.notEqual(first, fresh); assert.deepEqual(fresh, first); assert.equal(route.routeDays(map, regions[trip[0]]), fresh);
  console.log('[route] ' + samples[trip[0]][0] + ' → ' + samples[trip[1]][0] + ' ' + JSON.stringify(target));
  if (map.geographicReferences) {
    const refs = map.geographicReferences.filter(r => r.accepted !== false && r.lonLat && r.xy);
    const rms = Math.sqrt(refs.reduce((sum, ref) => sum + km(route.lonLatOf(map, { center: ref.xy }), ref.lonLat) ** 2, 0) / refs.length);
    console.log('[tianqi-fit] points=' + refs.length + ' rmsKm=' + rms.toFixed(6));
    assert(rms < 1, '天启参考点拟合残差小于一公里');
  }
}

// 缺坐标边、孤立地块、名称邻接和无坐标起点分别核验。
const a = { id: 'a', name: '甲', geographicCenter: [110, 35], neighbors: ['乙', 'missing'] };
const b = { id: 'b', name: '乙', geographicCenter: [111, 35], neighbors: ['c'] };
const c = { id: 'c', center: [1, 2], neighbors: [] }, d = { id: 'd', geographicCenter: [112, 35] };
const fixture = { regions: [a, b, c, d] }, before = JSON.stringify(fixture);
const distances = route.routeDays(fixture, a);
assert(distances.has('b')); assert(!distances.has('c')); assert(!distances.has('d'));
assert.deepEqual(route.daysBetween(fixture, a, c), { days: 10, km: 1000, estimated: true });
assert.deepEqual(route.daysBetween(fixture, a, 'unknown'), { days: 10, km: 1000, estimated: true });
assert.equal(route.routeDays(fixture, c).get('c').days, 0);
assert.equal(route.lonLatOf({}, { geographicCenter: [NaN, 3] }), null);
assert.equal(route.lonLatOf({}, { geographicCenter: ['110', 35] }), null);
assert.equal(JSON.stringify(fixture), before, '路程计算没有写地图');
console.log('[smoke-map-route-days] PASS 9 coordinates / 3 legacy+strict routes / fit / unreachable / cache / read-only');
console.log('[timing] total=' + ((Date.now() - started) / 1000).toFixed(3) + 's');
