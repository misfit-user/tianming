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
  var fits = new WeakMap(), routes = new WeakMap();

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

  return { lonLatOf: lonLatOf, routeDays: routeDays, daysBetween: daysBetween, DEFAULT_DAYS: DEFAULT_DAYS, KM_PER_DAY: KM_PER_DAY };
});
