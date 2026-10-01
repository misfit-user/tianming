/* tm-map-route-days.js — 地图邻接路程的只读计算，不写 GM、不碰 DOM。 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.TM = root.TM || {};
    root.TM.MapRouteDays = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var DEFAULT_DAYS = 10, KM_PER_DAY = 100;
  // Legacy administrative consumers still use DEFAULT_DAYS through daysBetween.
  // Person travel uses planRoute below, which never turns missing data into an
  // arrival claim and keeps mode/speed separate from geographic distance.
  var SPEEDS = Object.freeze({ walking: 25, horse: 50, courier: 80, land: 35, boat: 40 });
  var fits = new WeakMap(), routes = new WeakMap(), strictPlans = new WeakMap();

  // 坐标须为两个有限数，不把空值或字符串当坐标。
  function pair(value) {
    return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
  }

  // 中心取值顺序与地图定义一致，不对多边形另算中心。
  function center(region) {
    var xy = region && (region.center || region.centroid || region.referenceSeat);
    return pair(xy) ? xy : null;
  }

  // 按单轴最小二乘拟合；参考点没有跨度时无法反解。
  function fitAxis(refs, axis) {
    var x = 0, y = 0;
    refs.forEach(function (ref) { x += ref.xy[axis]; y += ref.lonLat[axis]; });
    x /= refs.length; y /= refs.length;
    var xx = 0, xy = 0;
    refs.forEach(function (ref) { var dx = ref.xy[axis] - x; xx += dx * dx; xy += dx * (ref.lonLat[axis] - y); });
    return xx > 0 ? [xy / xx, y - xy / xx * x] : null;
  }

  // 每张地图只拟合一次，缓存只存在模块内，不写回地图。
  function referenceFit(map) {
    if (fits.has(map)) return fits.get(map);
    var refs = (map.geographicReferences || []).filter(function (ref) {
      return ref && ref.accepted !== false && pair(ref.lonLat) && pair(ref.xy);
    });
    var lon = refs.length > 1 ? fitAxis(refs, 0) : null;
    var lat = refs.length > 1 ? fitAxis(refs, 1) : null;
    var fit = lon && lat ? { lon: lon, lat: lat } : null;
    fits.set(map, fit);
    return fit;
  }

  // 优先直接地理中心，其次反解等距投影，最后用校准参考点拟合。
  function lonLatOf(map, region) {
    if (!region) return null;
    if (pair(region.geographicCenter)) return region.geographicCenter.slice();
    var xy = center(region);
    if (!map || !xy) return null;
    var p = map.projection || {}, box = p.bbox, offset = p.offset || [0, 0];
    var sx = p.scaleX || p.scale, sy = p.scaleY || p.scale;
    if (p.type === 'equirectangular' && Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) &&
        pair(offset) && Number.isFinite(sx) && sx !== 0 && Number.isFinite(sy) && sy !== 0) {
      return [(xy[0] - offset[0]) / sx + box[0], box[3] - (xy[1] - offset[1]) / sy];
    }
    var fit = referenceFit(map);
    return fit ? [fit.lon[0] * xy[0] + fit.lon[1], fit.lat[0] * xy[1] + fit.lat[1]] : null;
  }

  // 半径 6371 公里的球面大圆距离；夹住舍入误差以免反三角函数越界。
  function distance(a, b) {
    var rad = Math.PI / 180, dlat = (b[1] - a[1]) * rad, dlon = (b[0] - a[0]) * rad;
    var h = Math.sin(dlat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dlon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
  }

  // 按 id 优先、名称或 title 兜底解析邻接项，与改隶模块同口径。
  function findRegion(regions, ref) {
    if (ref == null) return null;
    if (typeof ref === 'object') return regions.indexOf(ref) >= 0 ? ref : findRegion(regions, ref.id || ref.name);
    var key = String(ref);
    return regions.find(function (r) { return String(r.id) === key; }) ||
      regions.find(function (r) { return String(r.name) === key || String(r.title) === key; }) || null;
  }

  function resolveRegion(map, ref) {
    var regions = map && Array.isArray(map.regions) ? map.regions : [];
    if (ref && typeof ref === 'object' && regions.indexOf(ref) >= 0) return { status: 'resolved', region: ref, method: 'object' };
    var key = ref == null ? '' : String(typeof ref === 'object' ? (ref.id || ref.name || ref.title || '') : ref);
    if (!key) return { status: 'unresolved', reason: 'missing_location' };
    var byId = regions.filter(function (r) { return r && String(r.id) === key; });
    if (byId.length === 1) return { status: 'resolved', region: byId[0], method: 'id' };
    if (byId.length > 1) return { status: 'ambiguous', candidates: byId.map(function (r) { return String(r.id); }) };
    var byName = regions.filter(function (r) { return r && (String(r.name || '') === key || String(r.title || '') === key); });
    if (byName.length === 1) return { status: 'resolved', region: byName[0], method: 'name' };
    if (byName.length > 1) return { status: 'ambiguous', candidates: byName.map(function (r) { return String(r.id); }) };
    return { status: 'unresolved', reason: 'unknown_location', sourceText: key };
  }

  function routeVersion(map) {
    var explicit = map && (map.routeVersion || map.travelConditionsVersion || map.locationBindingContract && map.locationBindingContract.revision || map.revision);
    if (explicit != null && String(explicit) !== '0' && String(explicit) !== '') return String(explicit);
    // Older maps have no route revision. Keep their cache safe when an editor
    // or a scenario mutates neighbours/edges in place by deriving a compact,
    // deterministic fingerprint from the route-bearing fields.
    var rows = Array.isArray(map && map.regions) ? map.regions : [], raw = rows.map(function (r) {
      return [r && r.id, Array.isArray(r && r.neighbors) ? r.neighbors : [], Array.isArray(r && r.routeEdges) ? r.routeEdges : []];
    });
    if (Array.isArray(map && map.routeEdges)) raw.push(['@map', map.routeEdges]);
    var text = JSON.stringify(raw), h = 2166136261;
    for (var i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'derived-' + (h >>> 0).toString(16);
  }

  function edgeRows(map, region) {
    var rows = [];
    if (Array.isArray(region && region.routeEdges)) rows = rows.concat(region.routeEdges.map(function (e) { return Object.assign({}, e, { from: e.from || region.id }); }));
    if (Array.isArray(map && map.routeEdges)) rows = rows.concat(map.routeEdges.filter(function (e) { return e && String(e.from || '') === String(region && region.id); }));
    if (!rows.length && Array.isArray(region && region.neighbors)) rows = region.neighbors.map(function (ref) { return { to: ref, mode: 'land', source: 'neighbors' }; });
    return rows;
  }

  function allowedMode(edge, mode) {
    var declared = edge && (edge.mode || edge.transport || edge.kind);
    var modes = Array.isArray(edge && edge.modes) ? edge.modes : declared ? [declared] : ['land'];
    modes = modes.map(function (v) { return String(v).toLowerCase(); });
    if (!mode) return true;
    var wanted = String(mode).toLowerCase();
    if (modes.indexOf(wanted) >= 0) return true;
    return modes.indexOf('land') >= 0 && ['land', 'walking', 'horse', 'courier'].indexOf(wanted) >= 0;
  }

  function planRoute(map, fromRef, toRef, opts) {
    opts = opts || {};
    var fromResolved = resolveRegion(map, fromRef), toResolved = resolveRegion(map, toRef);
    if (fromResolved.status !== 'resolved') return { status: fromResolved.status, reason: fromResolved.reason || 'ambiguous_origin', candidates: fromResolved.candidates || [] };
    if (toResolved.status !== 'resolved') return { status: toResolved.status, reason: toResolved.reason || 'ambiguous_destination', candidates: toResolved.candidates || [] };
    var from = fromResolved.region, to = toResolved.region, mode = opts.mode ? String(opts.mode).toLowerCase() : '';
    var startCoord = lonLatOf(map, from), endCoord = lonLatOf(map, to), version = routeVersion(map);
    if (!startCoord || !endCoord) return { status: 'unresolved', reason: 'coordinate_missing', fromRegionId: String(from.id), toRegionId: String(to.id), routeVersion: version };
    if (String(from.id) === String(to.id)) return { status: 'reachable', fromRegionId: String(from.id), toRegionId: String(to.id), path: [String(from.id)], segments: [], km: 0, days: 0, mode: mode || 'land', estimated: false, quality: 'direct-region', routeVersion: version };
    var cacheKey = [String(from.id), String(to.id), mode || 'default', Number(opts.speedKmPerDay) || '', version].join('|');
    var cache = strictPlans.get(map);
    if (!cache) { cache = new Map(); strictPlans.set(map, cache); }
    if (!opts.fresh && cache.has(cacheKey)) return cache.get(cacheKey);
    var regions = Array.isArray(map.regions) ? map.regions : [], pending = new Set([from]), done = new Set(), best = new Map();
    best.set(String(from.id), { days: 0, km: 0, path: [String(from.id)], segments: [] });
    while (pending.size) {
      var current = null, currentBest = null;
      pending.forEach(function (r) { var candidate = best.get(String(r.id)); if (candidate && (!currentBest || candidate.days < currentBest.days)) { current = r; currentBest = candidate; } });
      if (!current) break;
      pending.delete(current); done.add(String(current.id));
      if (String(current.id) === String(to.id)) break;
      var a = lonLatOf(map, current); if (!a) continue;
      edgeRows(map, current).forEach(function (edge) {
        if (!edge || edge.available === false || !allowedMode(edge, mode)) return;
        var targetRef = edge.to != null ? edge.to : edge.target != null ? edge.target : edge.regionId;
        var targetResolved = resolveRegion(map, targetRef); if (targetResolved.status !== 'resolved') return;
        var next = targetResolved.region, nextId = String(next.id); if (done.has(nextId)) return;
        var b = lonLatOf(map, next); if (!b) return;
        var km = Number(edge.km != null ? edge.km : edge.distanceKm != null ? edge.distanceKm : distance(a, b));
        if (!(km >= 0) || !Number.isFinite(km)) return;
        var edgeMode = mode || String(edge.mode || edge.transport || edge.kind || 'land').toLowerCase();
        var speed = Number(edge.speedKmPerDay || opts.speedKmPerDay || SPEEDS[edgeMode] || SPEEDS.land);
        if (!(speed > 0) || !Number.isFinite(speed)) return;
        var days = Number(edge.days); if (!(days >= 0) || !Number.isFinite(days)) days = km / speed;
        var total = { days: currentBest.days + days, km: currentBest.km + km,
          path: currentBest.path.concat([nextId]),
          segments: currentBest.segments.concat([{ fromRegionId: String(current.id), toRegionId: nextId, km: km, days: days, mode: edgeMode, source: edge.source || 'map-edge' }]) };
        var prior = best.get(nextId); if (!prior || total.days < prior.days) { best.set(nextId, total); pending.add(next); }
      });
    }
    var found = best.get(String(to.id));
    var result = found ? { status: 'reachable', fromRegionId: String(from.id), toRegionId: String(to.id), path: found.path, segments: found.segments,
      km: Math.round(found.km * 100) / 100, days: Math.max(0, Math.round(found.days * 10) / 10), mode: mode || (found.segments[0] && found.segments[0].mode) || 'land', estimated: false,
      quality: (map.geographicReferences && map.geographicReferences.length) || from.geographicCenter || to.geographicCenter ? 'calibrated' : 'region-center', routeVersion: version } :
      { status: 'unreachable', reason: mode ? 'no_supported_route_for_mode' : 'no_supported_route', fromRegionId: String(from.id), toRegionId: String(to.id), routeVersion: version };
    cache.set(cacheKey, result); return result;
  }

  // 沿有坐标的邻接边跑 Dijkstra；不可达地块不进入结果，路程按起点缓存。
  function routeDays(map, fromRegion, opts) {
    if (!map) return new Map();
    var regions = map.regions || [], from = findRegion(regions, fromRegion);
    if (!from) return new Map();
    var key = String(from.id), cache = routes.get(map);
    if (!cache) { cache = new Map(); routes.set(map, cache); }
    if (!(opts && opts.fresh === true) && cache.has(key)) return cache.get(key);
    var pending = new Set([from]), km = new Map([[from, 0]]), done = new Set(), coordinates = new Map();
    regions.forEach(function (r) { coordinates.set(r, lonLatOf(map, r)); });
    while (pending.size) {
      var current = null;
      pending.forEach(function (r) { if (!current || km.get(r) < km.get(current)) current = r; });
      pending.delete(current); done.add(current);
      var a = coordinates.get(current);
      if (!a) continue;
      (Array.isArray(current.neighbors) ? current.neighbors : []).forEach(function (ref) {
        var next = findRegion(regions, ref), b = coordinates.get(next);
        if (!next || done.has(next) || !b) return;
        var total = km.get(current) + distance(a, b);
        if (!km.has(next) || total < km.get(next)) { km.set(next, total); pending.add(next); }
      });
    }
    var result = new Map();
    km.forEach(function (value, region) { result.set(String(region.id), { days: Math.round(value / KM_PER_DAY * 10) / 10, km: value, estimated: false }); });
    cache.set(key, result);
    return result;
  }

  // 缺路程一律返回十日估程，公里数使用同一驿速换算。
  function daysBetween(map, fromRegion, toRegion) {
    var to = findRegion(map && map.regions || [], toRegion);
    return (to && routeDays(map, fromRegion).get(String(to.id))) || { days: DEFAULT_DAYS, km: DEFAULT_DAYS * KM_PER_DAY, estimated: true };
  }

  return { lonLatOf: lonLatOf, routeDays: routeDays, daysBetween: daysBetween, planRoute: planRoute, resolveRegion: resolveRegion,
    routeVersion: routeVersion, SPEEDS: SPEEDS, DEFAULT_DAYS: DEFAULT_DAYS, KM_PER_DAY: KM_PER_DAY };
});
