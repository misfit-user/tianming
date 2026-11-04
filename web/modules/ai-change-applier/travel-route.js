// 走在路上：人物在最小地块之间一块块过去。只动所在地，抵达和就任在 core 的到期那一回合。
// onMoved(G, ch)：人换了一块之后，由 core 同步各处镜像。
export function createTravelRoute(global, onMoved) {
  'use strict';

  // 粗区（「陕西」）取路程最近的一块，路上朝它走，到了也落在这一块
  function _travelRegionOf(G, map, route, text, from) {
    var ids = global.TMMapLocations.placeRegionIds(text, G);
    if (ids.length === 1) return ids[0];
    if (!ids.length || !from) return '';
    var row = route.routeDays(map, from), best = '', bestKm = Infinity;
    ids.forEach(function(id) { var r = row.get(String(id)); if (r && r.km < bestKm) { best = id; bestKm = r.km; } });
    return best;
  }

  // 从粗区动身（开局写「江淮」的人）：从区内离目的地最近的一块起步
  function _travelStartOf(G, map, route, ids, toText) {
    if (ids.length === 1) return ids[0];
    var toIds = ids.length ? global.TMMapLocations.placeRegionIds(toText, G) : [];
    if (!toIds.length) return '';
    var row = route.routeDays(map, toIds[0]), best = '', bestKm = Infinity;
    ids.forEach(function(id) { var r = row.get(String(id)); if (r && r.km < bestKm) { best = id; bestKm = r.km; } });
    return best;
  }

  // 走在路上：按走过的比例落到路上那一块，人物在最小地块之间一块块过去。
  // 只动所在地，抵达和就任照旧在到期那一回合。两头落不到地块、或地图上走不通（隔海）的不走这一步，到期直接抵达。
  function _advanceTravelAlongRoute(G, ch, daysPassed, daysLeft) {
    try {
      var locs = global.TMMapLocations, route = global.TM && global.TM.MapRouteDays, map = G.mapData || G.map;
      if (!locs || !locs.placeRegionIds || !route || !route.planRoute || !map) return;
      if (!ch._travelFrom) ch._travelFrom = ch.location || '';
      var ids = locs.placeRegionIds(ch._travelFrom, G);
      var from = _travelStartOf(G, map, route, ids, ch._travelTo);
      if (!from) return;
      var to = _travelRegionOf(G, map, route, ch._travelTo, from);
      if (!to || to === from) return;
      var plan = route.planRoute(map, from, to, { mode: 'land' });
      if (!plan || plan.status !== 'reachable' || !Array.isArray(plan.segments) || !plan.segments.length) return;
      var sig = from + '|' + to + '|' + (ch._travelStartTurn == null ? '' : ch._travelStartTurn);
      var leg = (ch._travelLeg && ch._travelLeg.sig === sig) ? ch._travelLeg : { sig: sig, doneDays: 0, km: 0 };
      leg.doneDays += daysPassed;
      // 走过的路不退回去：别的逻辑把剩余天数改大时，人不往回走
      leg.km = Math.max(leg.km, plan.km * leg.doneDays / (leg.doneDays + Math.max(0, daysLeft)));
      ch._travelLeg = leg;
      var walked = 0, at = from;
      for (var i = 0; i < plan.segments.length - 1; i++) {   // 终点要等到期才到
        walked += Number(plan.segments[i].km) || 0;
        if (walked > leg.km) break;
        at = plan.segments[i].toRegionId;
      }
      var here = locs.placeRegionIds(ch.location, G);
      if (here.length === 1 && String(here[0]) === String(at)) return;   // 还在这一块：留着原来细到宫室的写法
      var row = route.resolveRegion(map, at);
      if (!row || row.status !== 'resolved') return;
      ch.location = row.region.name || String(at);
      locs.sync(ch, 'character', G);
      onMoved(G, ch);
    } catch (e) {
      (window.TM && TM.errors && TM.errors.captureSilent) && TM.errors.captureSilent(e, 'travelTick] along route');
    }
  }

  return { advance: _advanceTravelAlongRoute };
}
