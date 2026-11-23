/* tm-army-march.js — 逐块行军（11-23 同志定乙：地块编号做根，行军按地块一块一块走）
 *
 * 军令只记一本账：GM.marchOrders。玩家移防、军令回执、势力事件（都经 MarchSystem.createMarchOrder）、
 * AI 在 army_changes 里写的去处（tm-ai-change-army.js）都在这里立令；每回合按日数沿路走，
 * 走满一程就落到下一块地上（编号写进绑定，驻地文字写成那块的名字），走完全程即抵达。
 * 路线与人物赶路同一套路程（TM.MapRouteDays.planRoute：按地块中心连线量公里）。
 * 快慢（同志定乙）：日行一舍，三十里约 17 公里（《左传》「退三舍」，杜预注「一舍，三十里」）；
 *   骑兵占九成以上的骑军加倍，带炮与攻城器械的减半；冬季、五万以上大军照 MarchSystem 配置减速。
 * 先前三套行军各走各的：按目的地走的那套不看远近固定 600 里，一两回合必到；军令移防那套的旧令
 * 到期时又把军设回当初的去处。有地块的剧本今后只走这里；没有地块的剧本照旧。
 */
(function (global) {
  'use strict';
  var KM_PER_DAY = 17;
  // 同志定的倍数，不读剧本的 marchConfig.baseSpeeds：那是旧公式「每月走几块地」的数（晚唐写 3/5/2），不是倍数
  var RATIO = { infantry: 1, cavalry: 2, siege: 0.5 };
  var MOUNTED = /骑|马甲|铁鹞|拐子马|铁浮屠|cavalry/i;
  var HEAVY = /炮|攻城|床弩|siege/i;

  function mapOf(game) { return game && (game.mapData || game.map); }
  function locs() { return global.TMMapLocations; }
  function routes() { return global.TM && global.TM.MapRouteDays; }
  function turnDays() { return typeof global.getTurnDays === 'function' ? global.getTurnDays() : 30; }
  function note(text) { if (typeof global.addEB === 'function') global.addEB('行军', text); }

  // 有地块、有路程才逐块走
  function usable(game) {
    var L = locs(), R = routes();
    return !!(L && R && typeof L.enabled === 'function' && L.enabled(mapOf(game)) &&
      typeof L.moveArmy === 'function' && typeof R.planRoute === 'function');
  }
  function regionRow(game, id) {
    var rows = (mapOf(game) || {}).regions || [];
    for (var i = 0; i < rows.length; i++) if (rows[i] && String(rows[i].id) === String(id)) return rows[i];
    return null;
  }
  function nameOf(game, id) { var r = regionRow(game, id); return r ? String(r.name || id) : String(id || ''); }
  function sameArmy(order, army) {
    return !!(order && army && ((army.id && order.armyId === army.id) || order.armyName === army.name || order.armyId === army.name));
  }
  function armyOf(order, game) { return ((game && game.armies) || []).find(function (a) { return sameArmy(order, a); }) || null; }
  function activeOrder(army, game) {
    game = game || global.GM;
    return ((game && game.marchOrders) || []).find(function (o) { return o && o.status === 'marching' && sameArmy(o, army); }) || null;
  }
  function hereOf(army, game) {
    var b = locs().read(army, 'army', game);
    return b && b.regionId ? String(b.regionId) : '';
  }
  function season() {
    var B = global.BattleEngine;
    return B && typeof B._getSeason === 'function' ? B._getSeason() : '';
  }

  // 这支军一日走多少公里：带炮与攻城器械的按辎重，骑兵占九成以上的按骑军，其余按步军
  function pace(army) {
    var cfg = global.MarchSystem && typeof global.MarchSystem._getConfig === 'function' ? global.MarchSystem._getConfig() : {};
    var total = 0, mounted = 0, heavy = false;
    (Array.isArray(army && army.composition) ? army.composition : []).forEach(function (c) {
      var n = Math.max(0, Number(c && c.count) || 0);
      var label = String((c && (c.type || c.name)) || '') + ' ' + String((c && c.unitTypeId) || '');
      total += n;
      if (MOUNTED.test(label)) mounted += n;
      if (n > 0 && HEAVY.test(label)) heavy = true;
    });
    var kind = heavy ? 'siege' : (total > 0 && mounted / total >= 0.9 ? 'cavalry' : 'infantry');
    var km = KM_PER_DAY * RATIO[kind], why = [];
    if (season() === '冬') { km *= Number(cfg.winterPenalty) || 0.7; why.push('冬季'); }
    if ((Number(army && army.soldiers) || 0) > (Number(cfg.largeSizeThreshold) || 50000)) { km *= Number(cfg.largeSizePenalty) || 0.8; why.push('大军'); }
    return { kmPerDay: Math.round(km * 10) / 10, kind: kind, why: why };
  }

  // 去处落到哪一块：认出唯一一块就是它；认出几处（片区、两可）取离此军路程最近的一处
  function targetOf(army, to, game, fromId) {
    var L = locs(), map = mapOf(game), text = String(to == null ? '' : to).trim();
    if (!text) return '';
    var out = L.resolveText(text, map, army, 'army', game);
    if (out.regionId) return String(out.regionId);
    var ids = (out.candidateRegionIds || []).slice();
    if (!ids.length) ids = L.placeRegionIds(text, game);
    if (ids.length <= 1) return ids.length ? String(ids[0]) : '';
    var best = '', bestKm = Infinity;
    ids.forEach(function (id) {
      var p = routes().planRoute(map, fromId, id, { mode: 'land' });
      var km = p && p.status === 'reachable' ? p.km : Infinity;
      if (km < bestKm) { bestKm = km; best = String(id); }
    });
    return best || String(ids[0]);
  }

  // 一块地的四邻（编号）：neighbors 与 routeEdges 都认，记编号的、记地名的都换成编号
  function neighborsOf(game, id) {
    var r = regionRow(game, id), map = mapOf(game);
    if (!r) return [];
    var refs = (Array.isArray(r.neighbors) ? r.neighbors : []).concat((Array.isArray(r.routeEdges) ? r.routeEdges : []).map(function (e) { return e && (e.to != null ? e.to : e.target); }));
    return refs.map(function (ref) { var x = routes().resolveRegion(map, ref); return x.status === 'resolved' ? String(x.region.id) : ''; }).filter(Boolean);
  }

  // 驻地写的是不是本块或四邻（就地改驻，当回合落）；写到更远处的改走行军（11-23 同志定：只有本块或四邻算就地改驻）。
  // 认不出的、此军不知在哪的交回写口原规矩处理
  function nearby(army, to, game) {
    game = game || global.GM;
    if (!usable(game)) return true;
    var from = hereOf(army, game);
    if (!from) return true;
    var toId = targetOf(army, to, game, from);
    return !toId || toId === from || neighborsOf(game, from).indexOf(toId) >= 0;
  }

  function fail(reason) { return { ok: false, reason: reason }; }

  // 定路线：从此军现在所在的地块到去处，经哪几块、多少公里、约几日几回合（只算不写）
  function plan(army, to, game, opts) {
    game = game || global.GM; opts = opts || {};
    if (!army) return fail('查无此军');
    if (!usable(game)) return fail('此剧本舆图没有地块，不逐块行军');
    if (army.dispersed === true) return fail('此军散驻各地，不能整军调动');
    var from = opts.fromRegionId ? String(opts.fromRegionId) : hereOf(army, game);
    if (!from) return fail('此军驻在哪块地认不出，未能成行');
    var toId = targetOf(army, to, game, from);
    if (!toId) return fail('去处「' + to + '」在舆图上认不出是哪块地');
    var toName = nameOf(game, toId);
    if (toId === from) return { ok: false, here: true, reason: '此军已驻' + toName, fromRegionId: from, toRegionId: toId, toName: toName };
    var route = routes().planRoute(mapOf(game), from, toId, { mode: 'land' });
    if (!route || route.status !== 'reachable' || !Array.isArray(route.segments) || !route.segments.length) return fail('无路可达' + toName);
    var p = pace(army), days = route.km / Math.max(p.kmPerDay, 0.1);
    return { ok: true, fromRegionId: from, toRegionId: toId, toName: toName, route: route, pace: p,
      days: days, turns: Math.max(1, Math.ceil(days / turnDays())) };
  }

  // 把一道令的路线换成新算的（立令、被挪动后重走都用）
  function layRoute(order, p, game) {
    var names = p.route.path.map(function (id) { return nameOf(game, id); });
    order.fromRegionId = p.fromRegionId; order.toRegionId = p.toRegionId; order.toName = p.toName;
    order.regionPath = p.route.path.map(String); order.path = names;
    order.routeDescription = '经' + names.join('→');
    order.segments = p.route.segments.map(function (s) { return { toRegionId: String(s.toRegionId), km: Math.round(Number(s.km) * 10) / 10 }; });
    order.seg = 0; order.segKm = 0; order.km = Math.round(p.route.km);
    order.kmPerDay = p.pace.kmPerDay; order.pace = p.pace.kind;
    return names;
  }

  // 立一道行军令：同一支军原有在途的令作废，从现在所在重走。返回 { ok, order } 或 { ok:false, reason, here }
  function start(army, to, opts) {
    opts = opts || {};
    var game = opts.game || global.GM;
    var p = plan(army, to, game, opts);
    if (!p.ok) return p;
    var old = activeOrder(army, game);
    if (old) old.status = 'superseded';
    game.marchOrders = (Array.isArray(game.marchOrders) ? game.marchOrders : []).filter(function (o) { return o && o.status === 'marching'; });
    var order = { id: typeof global.uid === 'function' ? global.uid() : 'march-' + Date.now(), armyId: army.id || army.name, armyName: army.name || '',
      to: String(to), status: 'marching', source: opts.source || '', startTurn: game.turn || 0, progress: 0, daysMarched: 0 };
    var names = layRoute(order, p, game);
    order.from = names[0];
    order.totalDays = Math.ceil(p.days); order.totalTurns = p.turns; order.eta = order.startTurn + p.turns;
    game.marchOrders.push(order);
    army.destination = p.toName; army.destinationRegionId = p.toRegionId; army.state = 'marching';
    army._remainingDistance = 0; army.marchDaysLeft = 0;
    if (opts.quiet !== true) {
      note((army.name || '某军') + '自' + names[0] + '开拔，往' + p.toName + '，' + order.routeDescription +
        '，约' + order.totalDays + '日（' + order.totalTurns + '回合）' + (p.pace.why.length ? '；' + p.pace.why.join('、') + '行迟' : ''));
    }
    return { ok: true, order: order };
  }

  function stopMarch(army) {
    army.destination = ''; delete army.destinationRegionId;
    if (army.state === 'marching') army.state = 'garrison';
    army._remainingDistance = 0; army.marchDaysLeft = 0;
  }

  function arrive(order, army, game) {
    order.status = 'arrived';
    stopMarch(army);
    army._arrivedTurn = game.turn || 0;
    // 远行之后粮秣不继（照军令移防抵达的旧规：走得越久越缺）
    army.supplyRatio = Math.max(0.3, 1.0 - (order.daysMarched / 1000) * 0.3);
    note((army.name || '某军') + '已抵达' + order.toName + '。');
  }

  // 旧档与旧路子留下的在途军：从现在所在按地块重走；去处认不出、无路可达的作罢，记一笔
  function adoptLegacy(game) {
    var give = function (army, to, source) {
      var r = start(army, to, { game: game, source: source, quiet: true });
      if (!r.ok) {
        if (!r.here) note((army.name || '某军') + '调往「' + to + '」未成：' + r.reason + '，仍驻原地。');
        stopMarch(army);
      }
    };
    (game.marchOrders || []).slice().forEach(function (o) {
      if (!o || o.status !== 'marching' || Array.isArray(o.regionPath)) return;
      var army = armyOf(o, game);
      o.status = 'superseded';
      if (army) give(army, o.to, o.source || 'legacy-order');
    });
    (game.armies || []).forEach(function (a) {
      if (!a || a.destroyed || a.disbanded || !String(a.destination || '').trim() || activeOrder(a, game)) return;
      give(a, a.destination, 'legacy-destination');
    });
    game.marchOrders = (game.marchOrders || []).filter(function (o) { return o && o.status === 'marching'; });
  }

  function kmLeft(order) {
    var left = 0;
    for (var i = order.seg; i < order.segments.length; i++) left += order.segments[i].km;
    return Math.max(0, left - order.segKm);
  }

  // 每回合沿路走：按日数折成公里，走满一程就落到下一块；走完全程即抵达
  function advance(game, days) {
    game = game || global.GM;
    if (!game || !usable(game)) return [];
    days = Number(days) > 0 ? Number(days) : turnDays();
    adoptLegacy(game);
    var moved = [];
    (game.marchOrders || []).slice().forEach(function (order) {
      if (!order || order.status !== 'marching' || !Array.isArray(order.regionPath)) return;
      var army = armyOf(order, game);
      if (!army || army.destroyed || army.disbanded || !(Number(army.soldiers) > 0)) { order.status = 'cancelled'; return; }
      // 这支军被别处挪动过（战败退走、就地改驻），从现在所在重定路线
      var here = hereOf(army, game);
      if (here && here !== String(order.regionPath[order.seg])) {
        var again = plan(army, order.toRegionId, game, { fromRegionId: here });
        if (again.here) { arrive(order, army, game); return; }
        if (!again.ok) {
          order.status = 'cancelled'; stopMarch(army);
          note((army.name || '某军') + '往' + order.toName + '的行军作罢：' + again.reason + '。');
          return;
        }
        layRoute(order, again, game);
      }
      var p = pace(army);
      order.kmPerDay = p.kmPerDay; order.pace = p.kind;
      var budget = p.kmPerDay * days, passed = [];
      while (budget > 1e-6 && order.seg < order.segments.length) {
        var s = order.segments[order.seg], need = Math.max(0, s.km - order.segKm);
        if (budget < need) { order.segKm += budget; budget = 0; break; }
        budget -= need; order.segKm = 0; order.seg += 1;
        locs().moveArmy(army, game, s.toRegionId);
        army.destinationRegionId = order.toRegionId;
        passed.push(nameOf(game, s.toRegionId));
      }
      order.progress = (order.progress || 0) + 1;
      order.daysMarched = (order.daysMarched || 0) + (days - budget / Math.max(p.kmPerDay, 0.1));
      if (order.seg >= order.segments.length) {
        arrive(order, army, game);
        moved.push({ army: army.name, passed: passed, arrived: true });
        return;
      }
      var left = kmLeft(order) / Math.max(p.kmPerDay, 0.1), turnsLeft = Math.max(1, Math.ceil(left / days));
      order.totalDays = Math.ceil(order.daysMarched + left);
      order.totalTurns = order.progress + turnsLeft;
      order.eta = (game.turn || 0) + turnsLeft;
      if (passed.length) note((army.name || '某军') + '经' + passed.join('、') + '，往' + order.toName + '尚余约' + Math.ceil(left) + '日。');
      moved.push({ army: army.name, passed: passed, arrived: false });
    });
    game.marchOrders = (game.marchOrders || []).filter(function (o) { return o && o.status === 'marching'; });
    // 旧的按目的地行军（tm-feudal-warfare.js）在有地块的剧本里不再动手，它留下的行军简报清掉，免得提示词里重复
    game._marchReport = '';
    return moved;
  }

  // 主推演提示词【行军状况】：每支在途军往哪、现在哪块、还要经哪几块、约几日到
  var PROMPT_CAP = 40;
  function promptText(game) {
    game = game || global.GM;
    if (!usable(game)) return '';
    var orders = ((game && game.marchOrders) || []).filter(function (o) { return o && o.status === 'marching' && Array.isArray(o.regionPath); });
    if (!orders.length) return '';
    var days = turnDays();
    var lines = ['【行军状况】逐块行军：日行一舍（约 17 公里），骑军加倍，带炮械的减半，冬季与五万以上大军更迟；每回合 ' + days + ' 日'];
    orders.slice(0, PROMPT_CAP).forEach(function (o) {
      var rest = o.regionPath.slice(o.seg + 1).map(function (id) { return nameOf(game, id); });
      var left = Math.ceil(kmLeft(o) / Math.max(Number(o.kmPerDay) || KM_PER_DAY, 0.1));
      lines.push('  ' + (o.armyName || '某军') + '：往' + o.toName + '，现在' + nameOf(game, o.regionPath[o.seg]) +
        (rest.length > 1 ? '，余经' + rest.slice(0, -1).join('、') : '') +
        '，约 ' + left + ' 日（' + Math.max(1, Math.ceil(left / days)) + ' 回合）到');
    });
    if (orders.length > PROMPT_CAP) lines.push('  （另有 ' + (orders.length - PROMPT_CAP) + ' 支在途，从略）');
    return lines.join('\n');
  }

  global.TM = global.TM || {};
  global.TM.ArmyMarch = { usable: usable, plan: plan, start: start, advance: advance, pace: pace, activeOrder: activeOrder,
    nearby: nearby, promptText: promptText, KM_PER_DAY: KM_PER_DAY };

  // 排在 MarchSystem（33）之前：先把旧令换成逐块行军，余下没地块的旧令仍由它推进
  if (global.SettlementPipeline && typeof global.SettlementPipeline.register === 'function') {
    global.SettlementPipeline.register('regionMarch', '逐块行军', function (ctx) { advance(global.GM, ctx && ctx.days); }, 32, 'perturn');
  }
})(typeof window !== 'undefined' ? window : globalThis);
