// 晚唐地图修复与三部官方地图只读扫描。无游戏 VM、无联网、无派生 bundle 写入。
// node docs/scenario-data-repair-20260924/patches/tang-map.js [--report <文件>] [--write]
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const G = require('../../../web/tm-map-workbench.js');
const clip = require('../../../web/libs/polygon-clipping-0.15.7.min.js');
const DATA = require('../data/tang-map.js');
const REPO = path.resolve(__dirname, '../../..');
const FILE = path.join(REPO, 'scenarios/晚唐·开成五年（官方）.json');
const clone = x => JSON.parse(JSON.stringify(x));
const shape = coordinates => ({ type: 'MultiPolygon', coordinates });
const area = p => G.area(shape(p));
const pair = (a, b) => [a, b].sort().join('|');
const hash = x => crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const round = n => Number(n.toFixed(6));
const boxGap = (a, b) => Math.hypot(Math.max(a[0] - b[2], b[0] - a[2], 0), Math.max(a[1] - b[3], b[1] - a[3], 0));
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const flatPoints = coords => typeof coords[0] === 'number' ? Array.from({ length: coords.length / 2 }, (_, i) => coords.slice(i * 2, i * 2 + 2)) : coords.map(p => Array.isArray(p) ? p : [p.x, p.y]);
function indexGeometry(r) {
  return { r, box: G.bbox(r.geometry), polys: G.polys(r.geometry), segments: G.polys(r.geometry).flat(1).flatMap(ring => ring.slice(1).map((p, i) => [ring[i], p])) };
}

// 同生产 workbench 的线段投影口径；bbox 提前排除，无全图多边形布尔并集。
function sharedLength(a, b, tolerance = DATA.topology.coordinateTolerance) {
  if (boxGap(a.box, b.box) > tolerance) return 0;
  let result = 0;
  for (const [p, q] of a.segments) {
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
    if (!len) continue;
    for (const [u, v] of b.segments) {
      if (Math.min(p[0], q[0]) > Math.max(u[0], v[0]) + tolerance || Math.max(p[0], q[0]) + tolerance < Math.min(u[0], v[0]) ||
          Math.min(p[1], q[1]) > Math.max(u[1], v[1]) + tolerance || Math.max(p[1], q[1]) + tolerance < Math.min(u[1], v[1])) continue;
      if (Math.abs(cross(p, q, u)) > tolerance * len || Math.abs(cross(p, q, v)) > tolerance * len) continue;
      const du = ((u[0] - p[0]) * dx + (u[1] - p[1]) * dy) / len;
      const dv = ((v[0] - p[0]) * dx + (v[1] - p[1]) * dy) / len;
      result += Math.max(0, Math.min(len, Math.max(du, dv)) - Math.max(0, Math.min(du, dv)));
    }
  }
  return result;
}
function landEdges(regions) {
  const rows = regions.map(indexGeometry), edges = new Map();
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const length = sharedLength(rows[i], rows[j]);
    if (length > DATA.topology.minSharedLength) edges.set(pair(rows[i].r.id, rows[j].r.id), length);
  }
  return edges;
}
function haversine(a, b) {
  const rad = Math.PI / 180, dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const n = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(n)));
}
function setGeometry(r, polys) {
  const points = polys[0][0];
  r.coords = points.flat();
  r.points = clone(points);
  r.polygon = points.map(p => ({ x: p[0], y: p[1] }));
  r.holes = clone(polys[0].slice(1));
  r.extraPolygons = polys.slice(1).map(p => clone(p[0]));
  r.extraPolygonHoles = polys.slice(1).map(p => clone(p.slice(1)));
  r.geometry = polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : shape(polys);
  r.path = polys.flat(1).map(ring => 'M' + ring.map(p => p.join(' ')).join(' L') + ' Z').join(' ');
  r.d = r.path;
  // 此剧本的 center/centroid 是 geographicCenter 的投影及其副本，不是面积质心。
  assert.deepStrictEqual(r.centroid, { x: r.center[0], y: r.center[1] });
}
function leaves(s) {
  const out = [];
  function walk(nodes, tree) { for (const n of nodes || []) { if (n.children && n.children.length) walk(n.children, tree); else out.push({ ...n, tree }); } }
  for (const [key, tree] of Object.entries(s.adminHierarchy)) walk(tree.divisions, key);
  return out;
}
function apply(s) {
  assert(JSON.stringify(s.map) === JSON.stringify(s.mapData), 'map/mapData 改前不同，拒绝写入');
  const m = s.map, byId = new Map(m.regions.map(r => [r.id, r]));
  const touched = new Set([...DATA.transfers.flatMap(t => [t.from, t.to]), ...DATA.promote]);
  assert.strictEqual(Object.keys(DATA.geometryHashes).length, touched.size, '缺几何前置指纹');
  for (const id of touched) assert.strictEqual(hash(byId.get(id).geometry), DATA.geometryHashes[id], id + ' 几何已变化，拒绝按旧序号改写');
  const original = new Map([...touched].map(id => [id, clone(byId.get(id))]));
  const retained = DATA.unresolved.map(t => ({ ...t, polygon: clone(G.polys(byId.get(t.from).geometry)[t.part]) }));
  const beforeEdges = landEdges(m.regions);
  const water = m.roads.filter(r => r.type === 'water');
  const oldRoads = new Map(m.roads.map(r => [pair(r.from, r.to), r]));
  assert.strictEqual(beforeEdges.size, DATA.topology.originalLandEdges);
  assert.strictEqual(water.length, DATA.topology.originalWaterEdges);
  assert.deepStrictEqual([...beforeEdges.keys()].sort(), m.roads.filter(r => r.type === 'land').map(r => pair(r.from, r.to)).sort(), '推导的陆路不符合既有口径');
  const originalNeighbors = new Set(m.regions.flatMap(r => r.neighbors.map(n => pair(r.id, n))));
  assert.deepStrictEqual([...originalNeighbors].sort(), [...oldRoads.keys()].sort(), '改前道路与邻接不一致');
  const adminBefore = hash(s.adminHierarchy), nonMapBefore = hash(Object.fromEntries(Object.entries(s).filter(([k]) => !['map', 'mapData'].includes(k))));
  const transfers = [];
  const numericalHoles = [];
  const removed = new Map();
  for (const t of DATA.transfers) {
    const p = G.polys(original.get(t.from).geometry)[t.part];
    assert(p, '不存在的分面 ' + t.from + '/' + t.part);
    const receiver = byId.get(t.to), before = G.polys(receiver.geometry);
    const overlap = area(clip.intersection([p], before));
    assert(overlap < 0.001, t.from + '→' + t.to + ' 已大面积重叠，不是沿海缺口');
    assert(sharedLength(indexGeometry({ geometry: shape([p]) }), indexGeometry(receiver)) > 0.01, '接收州未贴这片海岸');
    // 原内洞逐一保护。六位/五位坐标的舍入差在合并后会产生极细新洞，描边会画成假州界。
    const merged = clip.union(before, [p]);
    const protectedHoles = [...before, p].flatMap(poly => poly.slice(1));
    for (const h of protectedHoles) assert(area([[h]]) > DATA.numericalHoleAreaLimit, '原有微小内洞须先人工核查');
    for (const poly of merged) for (let i = poly.length - 1; i >= 1; i--) {
      const h = poly[i], size = area([[h]]);
      if (size >= DATA.numericalHoleAreaLimit) continue;
      assert(protectedHoles.every(old => area(clip.intersection([[h]], [[old]])) < 0.00000001), '微缝涉及原有内洞');
      numericalHoles.push({ receiver: t.to, area: size });
      poly.splice(i, 1);
    }
    assert(numericalHoles.reduce((n, h) => n + h.area, 0) < DATA.maxNumericalFillArea, '新增微缝面积超出修复预算');
    merged.sort((a, b) => area([b]) - area([a]));
    setGeometry(receiver, merged);
    if (!removed.has(t.from)) removed.set(t.from, new Set());
    removed.get(t.from).add(t.part);
    transfers.push({ ...t, area: round(area([p])), overlap: round(overlap), bbox: G.bbox(shape([p])) });
  }
  for (const [id, parts] of removed) setGeometry(byId.get(id), G.polys(original.get(id).geometry).filter((p, i) => !parts.has(i)));
  for (const t of retained) assert(G.polys(byId.get(t.from).geometry).some(p => hash(p) === hash(t.polygon)), t.from + '/' + t.part + ' 待核原片必须逐字保留');
  const promoted = [];
  for (const id of DATA.promote) {
    const r = byId.get(id), ps = G.polys(r.geometry), best = ps.reduce((a, p, i) => area([p]) > area([ps[a]]) ? i : a, 0);
    assert(G.contains(shape([ps[best]]), r.center), id + ' 原治所不在目标主体内');
    if (best) setGeometry(r, [ps[best], ...ps.filter((p, i) => i !== best)]);
    promoted.push({ id, name: r.name, beforeMainArea: round(area([G.polys(original.get(id).geometry)[0]])), afterMainArea: round(area([G.polys(r.geometry)[0]])) });
  }
  // 逐改动组核对并集差仅为已记录的数值微缝；不对全图做昂贵大并集。
  const groups = [];
  for (const id of touched) {
    const connected = groups.filter(g => g.has(id) || DATA.transfers.some(t => (t.from === id && g.has(t.to)) || (t.to === id && g.has(t.from))));
    const group = new Set([id, ...connected.flatMap(g => [...g])]);
    for (const g of connected) groups.splice(groups.indexOf(g), 1);
    groups.push(group);
  }
  for (const group of groups) {
    const before = clip.union(...[...group].map(id => G.polys(original.get(id).geometry)));
    const after = clip.union(...[...group].map(id => G.polys(byId.get(id).geometry)));
    const numericalBudget = numericalHoles.filter(h => group.has(h.receiver)).reduce((n, h) => n + h.area, 0);
    assert(area(clip.xor(before, after)) < numericalBudget + 0.000001, '陆地并集改变超出已记录微缝：' + [...group].join('、'));
  }
  const afterEdges = landEdges(m.regions), deleted = [...beforeEdges.keys()].filter(k => !afterEdges.has(k)), added = [...afterEdges.keys()].filter(k => !beforeEdges.has(k));
  assert([...deleted, ...added].every(k => k.split('|').some(id => touched.has(id))), '改动波及无关邻接');
  const valid = new Set([...afterEdges.keys(), ...water.map(r => pair(r.from, r.to))]);
  const changedNeighbors = [];
  for (const r of m.regions) {
    const next = [...valid].filter(k => k.split('|').includes(r.id)).map(k => k.split('|').find(id => id !== r.id)).sort();
    if (JSON.stringify(r.neighbors.slice().sort()) !== JSON.stringify(next)) { changedNeighbors.push({ id: r.id, before: r.neighbors, after: next }); r.neighbors = next; }
  }
  m.roads = m.roads.filter(r => valid.has(pair(r.from, r.to)));
  for (const key of added.sort()) {
    const [from, to] = key.split('|'), distanceKm = Number(haversine(byId.get(from).geographicCenter, byId.get(to).geographicCenter).toFixed(3));
    m.roads.push({ id: 'land-' + from + '--' + to, from, to, type: 'land', distance: distanceKm / 100, distanceKm, hasPostRoad: false });
  }
  assert.strictEqual(hash(s.adminHierarchy), adminBefore);
  assert.strictEqual(hash(Object.fromEntries(Object.entries(s).filter(([k]) => !['map', 'mapData'].includes(k)))), nonMapBefore);
  for (const id of touched) {
    const before = original.get(id), r = byId.get(id);
    for (const k of ['data', 'owner', 'adminBinding', 'mapRegionId', 'parentId', 'center', 'centroid', 'geographicCenter']) assert.deepStrictEqual(r[k], before[k], id + '/' + k);
  }
  for (const r of m.regions) for (const n of r.neighbors) assert(byId.get(n).neighbors.includes(r.id), '邻接不是双向');
  assert.deepStrictEqual(m.roads.filter(r => r.type === 'water'), water);
  // edges / adjacencyGraph 是空的运行时占位，不烘入生产构建后的图或自造契约字段。
  assert.deepStrictEqual(m.edges, {}); assert.deepStrictEqual(m.adjacencyGraph, {});
  s.mapData = clone(m);
  assert(JSON.stringify(s.map) === JSON.stringify(s.mapData));
  return { transfers, promoted, numericalHoles, changedNeighbors, deleted, added, touched: [...touched], beforeLand: beforeEdges.size, afterLand: afterEdges.size, water: water.length };
}

function projection(m) {
  if (m.projection) {
    const p = m.projection;
    return xy => [p.bbox[0] + (xy[0] - p.offset[0]) / (p.scaleX || p.scale), p.bbox[3] - (xy[1] - p.offset[1]) / (p.scaleY || p.scale)];
  }
  // 天启没有 projection，利用自带 geographicReferences 的经纬度/xy 配对解线性投影。
  const refs = m.geographicReferences.filter(r => r.lonLat && r.xy);
  function fit(dim) {
    const x = refs.reduce((n, r) => n + r.xy[dim], 0) / refs.length, y = refs.reduce((n, r) => n + r.lonLat[dim], 0) / refs.length;
    const slope = refs.reduce((n, r) => n + (r.xy[dim] - x) * (r.lonLat[dim] - y), 0) / refs.reduce((n, r) => n + (r.xy[dim] - x) ** 2, 0);
    return [slope, y - slope * x];
  }
  const x = fit(0), y = fit(1), convert = xy => [xy[0] * x[0] + x[1], xy[1] * y[0] + y[1]];
  assert(refs.every(r => haversine(convert(r.xy), r.lonLat) < 0.01), '天启参考坐标不再满足同一投影');
  return convert;
}
function boundsLL(p, toLL) { return G.bbox(shape([p.map(r => r.map(toLL))])); }
function gapKm(a, b) {
  const ax = Math.max(a[0], Math.min(b[0], a[2])), bx = Math.max(b[0], Math.min(a[0], b[2]));
  const ay = Math.max(a[1], Math.min(b[1], a[3])), by = Math.max(b[1], Math.min(a[1], b[3]));
  return haversine([ax, ay], [bx, by]);
}
function pointDistance(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], n = dx * dx + dy * dy;
  const t = n ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / n)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function seatDistance(polys, seat, toLL) {
  if (G.contains(shape(polys), seat)) return 0;
  const ll = toLL(seat), sx = 111.195 * Math.cos(ll[1] * Math.PI / 180), sy = 111.195;
  const projected = p => { const v = toLL(p); return [(v[0] - ll[0]) * sx, (v[1] - ll[1]) * sy]; };
  let best = Infinity;
  for (const p of polys) for (const ring of p) for (let i = 1; i < ring.length; i++) best = Math.min(best, pointDistance([0, 0], projected(ring[i - 1]), projected(ring[i])));
  return best;
}
function audit(s, name) {
  const m = s.map, toLL = projection(m), rows = m.regions.map(r => {
    const ps = G.polys(r.geometry), boxes = ps.map(p => boundsLL(p, toLL)), main = flatPoints(r.coords);
    const mainArea = area([[main]]), largest = ps.reduce((a, p, i) => area([p]) > area([ps[a]]) ? i : a, 0);
    return { r, ps, boxes, main, mainArea, largest };
  });
  const byId = new Map(rows.map(r => [r.r.id, r])), bindings = leaves(s), leafById = new Map(bindings.map(l => [l.id, l]));
  const result = { name, regions: rows.length, components: rows.reduce((n, r) => n + r.ps.length, 0), mainOutliers: [], remoteParts: [], ownerOutliers: [], seatOutliers: [], impossibleLand: [], declaredWater: [], asymmetric: [], missingNeighbors: [], adminLeaves: bindings.length, unboundLeaves: [], unmatchedRegions: [], seatCoverage: 0 };
  const roads = new Map((m.roads || []).map(r => [pair(r.from, r.to), r]));
  for (const row of rows) {
    const { r, ps, boxes, main, largest } = row, seat = r.referenceSeat || r.center;
    const otherSeat = ps.findIndex(p => G.contains(shape([p]), seat));
    const mainGap = seatDistance([[main]], seat, toLL), largeArea = area([ps[largest]]);
    if (row.mainArea < largeArea * DATA.thresholds.smallMainRatio && mainGap > 0.01 && otherSeat >= 0)
      result.mainOutliers.push({ id: r.id, name: r.name, ratio: round(row.mainArea / largeArea), seatGapKm: round(mainGap), largest });
    for (let p = 0; p < ps.length; p++) if (p !== largest) {
      const km = gapKm(boxes[p], boxes[largest]);
      if (km > DATA.thresholds.remotePartKm) result.remoteParts.push({ id: r.id, name: r.name, part: p, km: round(km), bounds: boxes[p].map(round) });
    }
    const sameOwner = rows.filter(o => o !== row && o.r.owner === r.owner);
    if (sameOwner.length) {
      const km = Math.min(...sameOwner.flatMap(o => boxes.flatMap(b => o.boxes.map(c => gapKm(b, c)))));
      if (km > DATA.thresholds.isolatedOwnerKm) result.ownerOutliers.push({ id: r.id, name: r.name, km: round(km) });
    }
    const bound = leafById.has(r.adminBinding) || (r.accountingLeafIds || []).some(id => leafById.has(id)) || bindings.some(l => l.mapRegionId === r.id || (l.mappedRegions || []).includes(r.id));
    if (!bound) result.unmatchedRegions.push({ id: r.id, name: r.name });
    if (bound && seat) {
      result.seatCoverage++;
      const km = seatDistance(ps, seat, toLL);
      if (km > DATA.thresholds.seatGapKm) result.seatOutliers.push({ id: r.id, name: r.name, km: round(km) });
    }
    for (const id of r.neighbors || []) {
      const other = byId.get(id);
      if (!other) { result.missingNeighbors.push([r.id, id]); continue; }
      if (!(other.r.neighbors || []).includes(r.id)) result.asymmetric.push([r.id, id]);
      if (r.id > id) continue;
      const km = Math.min(...boxes.flatMap(b => other.boxes.map(c => gapKm(b, c))));
      const bodyKm = gapKm(boxes[largest], other.boxes[other.largest]);
      if (km <= DATA.thresholds.impossibleLandKm && bodyKm <= DATA.thresholds.remotePartKm) continue;
      const road = roads.get(pair(r.id, id)), item = { from: r.id, fromName: r.name, to: id, toName: other.r.name, km: round(km), bodyKm: round(bodyKm), type: road && road.type || 'implicit-land' };
      (/^(water|sea|ferry)$/.test(item.type) ? result.declaredWater : result.impossibleLand).push(item);
    }
  }
  result.unboundLeaves = bindings.filter(l => !byId.has(l.mapRegionId || l.id) && !(l.mappedRegions || []).some(id => byId.has(id))).map(l => ({ id: l.id, name: l.name, mapRegionId: l.mapRegionId }));
  result.suspectRegions = [...new Set([...result.mainOutliers, ...result.remoteParts, ...result.ownerOutliers, ...result.seatOutliers].map(x => x.id))].length;
  return result;
}
function report(r, scans, after) {
  const list = xs => xs.join('、') || '无';
  const table = (header, rows) => [header, '|' + header.split('|').slice(1, -1).map(() => ' --- ').join('|') + '|', ...rows];
  const lines = ['# 晚唐·地图错位修复与三部排查', '',
    '第十五刀；真源基线 bedc3208，原版 ffb2db25 可整体重建。只修改晚唐 map/mapData；天启、绍宋只读。报告由 patches/tang-map.js --report 生成。', '',
    '## 修复结果与福州缺口', '',
    '搬回 ' + r.transfers.length + ' 个归属明确的多边形；' + r.promoted.length + ' 块以主体为主面；改动 ' + r.touched.length + ' 块几何、' + r.changedNeighbors.length + ' 块邻接。陆路 ' + r.beforeLand + '→' + r.afterLand + ' 条，渡运 ' + r.water + ' 条原样保留。', '',
    '吕宋误面范围 119.142167–119.719582°E、25.904556–26.124306°N；原面净面积 96.287830 地图平方像素，和福州仅重叠 0.000013，属于沿海缺口而非覆盖层。布尔并回福州，原内洞 17.885523 平方像素保留；不把洞当陆地填掉。吕宋主面改为 120.335419–121.058004°E、17.508695–18.652916°N 的原附属面。', '',
    '截图复核发现合并新生的数值细缝会画成假边界。本刀清理 ' + r.numericalHoles.length + ' 个小于 0.0001 px² 的新洞，合计 ' + round(r.numericalHoles.reduce((n, h) => n + h.area, 0)) + ' px²（上限 0.001）；原图最小真实内洞为 0.765232 px²，并逐一断言微缝不侵入原洞。各改动组并集差须不超过该组记录的微缝面积加 0.000001 px²，不拓宽邻接容差。', '',
    ...table('| 原地块 | 原分面序号 | 归还 | 净面积 px² | 与接收面交叠 px² | 判断 |', r.transfers.map(t => '| ' + t.from + ' | ' + t.part + ' | ' + t.to + ' | ' + t.area + ' | ' + t.overlap + ' | ' + t.reason + ' |')), '',
    ...table('| 地块 | 改前主面面积 px² | 改后主面面积 px² |', r.promoted.map(p => '| ' + p.name + '（' + p.id + '） | ' + p.beforeMainArea + ' | ' + p.afterMainArea + ' |')), '',
    '## 消费方与字段处理', '',
    ...table('| 消费方 | 实际口径及处理 |', [
      '| phase8-formal-map.js:362–457、1600–1635 | 正式 SVG 优先 d/path，填色与点击均对应复合 path（evenodd）；回落时才取 points/polygon/coords 和 extraPolygons。同步全部几何副本与洞。 |',
      '| tm-map-realm-layout.js:120–140、anchor | 标签/势力布局读取 path 或全套多边形，面积含附属面减内洞；缓存按对象/path 签名重建。旧主面取点、旧 Canvas 命中路径只看主面，故另将 7 块主体提到 coords/points。 |',
      '| tm-map-system.js:245–252、301–314、2670–2740 | center 优先，centroid 由 center 派生；晚唐全 575 块 center 与 geographicCenter、localityLayer 的州治锚点对应，不是面积质心。原治所已在真实主体内，因此保持三种中心与城市定位，不把标记移到海湾几何中心。 |',
      '| tm-map-system.js:2251–2304、2313–2420；tm-military.js:1473–1495 | neighbors 生成有向运行时 adjacencyGraph，roads 提供类型/距离，MarchSystem 和补给实际读图寻路。本刀重算双向邻接并同步删除/新增陆路；空 edges/adjacencyGraph 仍由开局生成。 |',
      '| tm-endturn-helpers.js:2203–2237；phase8-formal-map-dossier.js:1353、1533 | mechanicsConfig.tradeRoutes 按 from/to、volume/risk 结算，不读多边形；地方 tradeRoutes 是图志/AI 文本。本刀不改海贸量或文本路线，不能把陆路修正声称为贸易引擎重算。 |',
      '| map.runtimeContract；tm-start-world / tm-patches-start | 晚唐只有 map 内运行契约，顶层无 mapRuntimeContract；内容说明运行态与 AI 读写接口，无几何 hash/count，不新增字段。map/mapData 改前逐字相等才允许处理，改后仍逐字相等。 |',
      '| adminHierarchy / adminBinding / mapRegionId / map.circuitRegistry | 晚唐 575 行政叶子与 575 地块按 id 一一对应；保持 id、所属树、道登记、地方账和人口。搬的是误归属的几何碎片，不合并行政叶子，也不按碎片面积重分人口钱粮。 |'
    ]), '',
    '## 邻接口径与变化', '',
    '共享边线段投影采用坐标容差 0.00001 px、最短共享长度 0.0001 px；修前推导结果与已有 1478 条 land 道路逐对完全一致，并验证 neighbors = 全部道路双向集合。9 条 water 是既有显式渡运，不能按不接壤删除。重算只允许涉及改动几何的边发生变化；新陆路距离沿原格式以原州治经纬度 haversine（地球半径 6371 km）计算，distanceKm 保留三位，distance=km/100。', '',
    '删除：' + list(r.deleted.map(x => x.replace('|', ' ↔ '))) + '。', '',
    '新增：' + list(r.added.map(x => x.replace('|', ' ↔ '))) + '。', '',
    ...table('| 地块 | 改前 neighbors | 改后 neighbors |', r.changedNeighbors.map(n => '| ' + n.id + ' | ' + list(n.before) + ' | ' + list(n.after) + ' |')), '',
    '## 扫描方法与边界', '',
    '- 逐块解析全部 geometry 分面及内洞，同时单独读取 coords，不能把 geometry[0] 自动视作主面：绍宋大部分 geometry 顺序与 coords 不同。',
    '- 主面候选：coords 面积不足最大实体面的 10%，治所/参考点距主面大于 0.01 km，却在另一分面内。远片候选：任一分面与该块最大面的经纬度包围盒间距超过 150 km。',
    '- 同势力候选：全部分面与任一同势力其他地块的最小包围盒间距超过 400 km（单地块势力无比较对象）。行政治所候选：绑定行政叶子的参考点距该块全部实体面超过 100 km。',
    '- 邻接候选：全部分面包围盒间距超过 20 km，或两块最大主体的间距超过 150 km（识别依赖远片接边的伪陆路）；逐对检查对称、缺 id。显式 water/sea/ferry 单列。包围盒距离是保守筛选，不等于精确岸间距离。',
    '- 晚唐与绍宋按原 projection 反投影；天启用自带 geographicReferences 配对拟合，全部参考点残差须小于 0.01 km。距离以球面公式估计。',
    '- 治所核查只覆盖数据已有 referenceSeat/center 与绑定叶子的对应，不冒充独立考证了全部古城遗址坐标。海外群岛、河洲、同势力飞地可触发阈值，候选不等于史实错误。', '',
    ...table('| 剧本 | 地块/分面 | 主面候选 | 远片（面/地块） | 同势力孤离 | 治所候选/覆盖 | 几何候选去重 | 不可能陆邻 | 明示水路远邻 | 非对称/缺 id |', scans.map(a => '| ' + a.name + ' | ' + a.regions + '/' + a.components + ' | ' + a.mainOutliers.length + ' | ' + a.remoteParts.length + '/' + new Set(a.remoteParts.map(x => x.id)).size + ' | ' + a.ownerOutliers.length + ' | ' + a.seatOutliers.length + '/' + a.seatCoverage + ' | ' + a.suspectRegions + ' | ' + a.impossibleLand.length + ' | ' + a.declaredWater.length + ' | ' + a.asymmetric.length + '/' + a.missingNeighbors.length + ' |')), '',
    '### 各部候选明细（修前）', ''];
  for (const a of scans) lines.push('#### ' + a.name, '',
    '行政叶子 ' + a.adminLeaves + '；找不到地图绑定的叶子 ' + a.unboundLeaves.length + '；无叶子绑定地块 ' + a.unmatchedRegions.length + '。', '',
    ...table('| 主面候选 | 面积比 | 治所距主面 km |', a.mainOutliers.map(x => '| ' + x.name + '（' + x.id + '） | ' + x.ratio + ' | ' + x.seatGapKm + ' |')), '',
    ...table('| 远离主体的分面 | 序号 | 保守间距 km | 经度/纬度 bbox |', a.remoteParts.map(x => '| ' + x.name + '（' + x.id + '） | ' + x.part + ' | ' + x.km + ' | ' + x.bounds.join(', ') + ' |')), '',
    ...table('| 同势力孤离 | 间距 km |', a.ownerOutliers.map(x => '| ' + x.name + '（' + x.id + '） | ' + x.km + ' |')), '',
    ...table('| 治所离开全部面 | 间距 km |', a.seatOutliers.map(x => '| ' + x.name + '（' + x.id + '） | ' + x.km + ' |')), '',
    ...table('| 远邻 | 全部分面/最大主体间距 km | 原道路类型 | 判断 |', [...a.impossibleLand, ...a.declaredWater].map(x => '| ' + x.fromName + '（' + x.from + '） ↔ ' + x.toName + '（' + x.to + '） | ' + x.km + '/' + x.bodyKm + ' | ' + x.type + ' | ' + (/^(water|sea|ferry)$/.test(x.type) ? '明示水路，保留' : x.km <= DATA.thresholds.impossibleLandKm ? '依赖远片接边，待核' : '待核陆邻') + ' |')), '',
    a.unboundLeaves.length ? '未直接绑定叶子：' + a.unboundLeaves.map(x => x.name + '→' + x.mapRegionId).join('；') + '。天启这些记录属既有非领土账，不能自动另造地块。' : '行政叶子直接绑定齐全。', '');
  lines.push('## 晚唐修后与待核', '',
    '修后主面候选 ' + after.mainOutliers.length + '，远片候选 ' + after.remoteParts.length + ' 面/' + new Set(after.remoteParts.map(x => x.id)).size + ' 块，不可能陆邻 ' + after.impossibleLand.length + '，非对称/缺 id ' + after.asymmetric.length + '/' + after.missingNeighbors.length + '。', '',
    ...DATA.unresolved.map(x => '- ' + x.from + ' 原分面 ' + x.part + '：' + x.reason + ' 候选接收州：' + list(x.candidates) + '；保留几何及由该碎片形成的旧连接，并明确不称为全部错位已清零。'),
    '- 绍宋、天启阈值候选只报告，未改其真源。天启宗谷小主面、钏路远岛和建州三卫相关陆邻，以及绍宋长春州远片，需按各自编译规则和史地依据再核；没有凭距离把群岛一律裁掉。',
    '- 原十片按原粗图中唯一共享边的在地行政块与原治所地理位置归还；委任状F新增的占不劳原分面1另依属县、四至及河口地望归恩州（见下文），不按边长多数判州。不是重绘精确唐代县界；新罗海岸沿用现有州块口径。',
    '- 补丁验证了改动组修前修后陆地并集、内洞保留及非地图数据 hash；既有中心/地方账不动。全图历史边界准确性与旧存档迁移不在此报告的完成声明内。', '',
    '## 复现', '',
    '```text', 'node docs/scenario-data-repair-20260924/patches/tang-map.js --report docs/scenario-data-repair-20260924/reports/tang-map.md --write',
    'node docs/scenario-data-repair-20260924/patches/rebuild-tang.js', '```', '',
    '直接补丁只能用于匹配修前指纹的输入；再次修复请整体重建。报告与真源均无时间戳随机数。收尾定向验证与截图记录见本报告末尾的验收记录。');
  return lines.join('\n') + '\n\n' + (DATA.fragmentReview || '') + '\n' + (DATA.acceptance || '') + '\n' + (DATA.fragmentAcceptance || '');
}
function main() {
  const args = process.argv.slice(2), raw = fs.readFileSync(FILE, 'utf8'), s = JSON.parse(raw);
  assert(JSON.stringify(s) + '\n' === raw, '剧本不是标准 JSON.stringify 输出，拒绝改写');
  assert(JSON.stringify(s.map) === JSON.stringify(s.mapData), 'map/mapData 改前不同');
  const scans = [];
  for (const [label, prefix] of [['天启', '天启'], ['绍宋', '绍宋']]) {
    const name = fs.readdirSync(path.join(REPO, 'scenarios')).find(n => n.startsWith(prefix) && n.endsWith('（官方）.json'));
    scans.push(audit(JSON.parse(fs.readFileSync(path.join(REPO, 'scenarios', name), 'utf8')), label));
  }
  scans.push(audit(s, '晚唐'));
  const result = apply(s), after = audit(s, '晚唐修后'), i = args.indexOf('--report');
  if (i >= 0) { assert(args[i + 1] && !args[i + 1].startsWith('--'), '--report 缺文件'); fs.writeFileSync(args[i + 1], report(result, scans, after)); }
  console.log(JSON.stringify({ moved: result.transfers.length, promoted: result.promoted.length, geometry: result.touched.length, neighbors: result.changedNeighbors.length, land: result.afterLand, scans: scans.map(a => ({ name: a.name, regions: a.regions, suspects: a.suspectRegions, remoteParts: a.remoteParts.length, main: a.mainOutliers.length, land: a.impossibleLand.length })) }));
  if (args.includes('--write')) { fs.writeFileSync(FILE, JSON.stringify(s) + '\n'); console.log('已写入 ' + path.relative(REPO, FILE)); }
}
module.exports = { apply, audit, report, landEdges, sharedLength, indexGeometry, flatPoints, leaves, haversine, hash, G, clip, shape, area, pair, boxGap, DATA };
if (require.main === module) main();
