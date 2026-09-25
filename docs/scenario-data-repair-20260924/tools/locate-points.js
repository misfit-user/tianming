// 把经纬度落到绍宋地图的地块上：给出每个点所在的地块名（地图投影见 map.projection，等距圆柱）。
// 外藩没有户数，只能按史志所列郡县计权时，用它判断各郡县治所落在哪一块。
// 用法：node tools/locate-points.js <剧本 json> <点表 json>     点表：[[名, 纬度, 经度], ...]
// 也可在数据模块里 require：locate(scenario, points) → [{ name, lat, lon, region, owner }]
'use strict';
const fs = require('fs');

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inGeometry(x, y, geometry) {
  const polys = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  return polys.some((rings) => inRing(x, y, rings[0]) && !rings.slice(1).some((h) => inRing(x, y, h)));
}

function locate(scenario, points) {
  const proj = scenario.map.projection;
  const [lonMin, , , latMax] = proj.bbox;
  return points.map(([name, lat, lon]) => {
    const x = (lon - lonMin) * proj.scaleX + proj.offset[0];
    const y = (latMax - lat) * proj.scaleY + proj.offset[1];
    const hit = scenario.map.regions.find((r) => r.geometry && inGeometry(x, y, r.geometry));
    return { name, lat, lon, region: hit ? hit.name : null, owner: hit ? hit.owner : null };
  });
}

if (require.main === module) {
  const scenario = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const points = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  locate(scenario, points).forEach((p) => console.log([p.name, p.lat, p.lon, p.region || '（不在任何地块）', p.owner || ''].join('\t')));
}

module.exports = { locate };
