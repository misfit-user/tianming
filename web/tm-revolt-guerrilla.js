// @ts-check
// ============================================================
// tm-revolt-guerrilla.js — 民变游击的连带（民变重做·民2c，同志 11-14「推，然后下一刀」）
//
// 依据 docs/guanben-roleplay-20260930/minbian.md「新的样子」二（游击：啸聚山林、流寇往来，不占城）。
// 民变案落地的民变（tm-revolt-rising.js，source 'revolt-cases'）在它所在的那一州，每回合落这几样真账：
//   - 地块写「某股盘踞」：本州地块状态（TM.RegionStatus，风云）记「王二一股盘踞」，方志页头那枚签上看得到众数与连带；
//   - 本州征收打折：同一条状态的经济折，算税时读它（tm-fiscal-engine.js computeTaxAmount 的地块状态乘子）；
//     折多少按这股人数占本州口数：占到 5% 记满，折 5%～25%〔初值〕（地块状态单条封顶 25%）；
//   - 驿路阻断：GM._routeDisruptions 记一条「某州驿路」不通，带州编号——书信、奏疏两头有一头在本州的，
//     截获率照现有规矩加（tm-hongyan-office.js _ltIsRouteBlocked 认州：人物所在地落到这一州就算）；
//   - 户口逃散：本州在籍的人每月有一批弃家逃散，挪进本州逃户（populationDetail.fugitives），口数不变；
//   - 本州民心：民心账本记一笔「某股盘踞」（治安）。邻州民心照旧走「民变不宁」（tm-authority-complete.js：本省各州每股每月 −0.15）。
//   这股了结（剿平、瓦解、受抚）或不在了：下一回合状态撤掉、驿路记「复通」。
// 流寇池并进游击：全国逃户池不再凝成流寇（tm-class-mobility.js 那一段删了），流寇只从各州起事来（民1 判、民2a 落地）；
//   旧档里已有的流寇照旧每月溃散一成回逃户，剿抚照旧，民2d 一并折算。
// 本模块不判起不起、不判剿抚（tm-revolt-cases.js；民2d），只管已起的游击每回合的连带。
// ============================================================
(function (global) {
  'use strict';
  var TM = global.TM = global.TM || {};

  var CFG = {
    saturate: 0.05,                    // 〔初值〕这股人数占本州口数到此，连带记满
    cutMin: 0.05, cutMax: 0.25,        // 〔初值〕本州征收折（地块状态单条封顶 25%）
    minxinMin: 0.2, minxinMax: 1.0,    // 〔初值〕本州民心每月扣
    fleeRate: 0.1,                     // 〔初值〕每月逃散的人＝这股人数 × 此
    fleeCap: 0.01,                     // 〔初值〕每月逃散不超过本州在籍口数的这个比重
    keepResolvedTurns: 6               // 复通的驿路记录留几回合
  };
  var SOURCE = 'revolt-hold';           // 地块状态、驿路阻断上记的来源

  function arr(v) { return Array.isArray(v) ? v : []; }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function str(v) { return v == null ? '' : String(v); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function round2(v) { return Math.round(v * 100) / 100; }
  function round4(v) { return Math.round(v * 10000) / 10000; }

  function monthsOf(ctx) {
    var m = num(ctx && (ctx.monthRatio != null ? ctx.monthRatio : ctx._monthRatio), null);
    if (m == null && typeof global._getDaysPerTurn === 'function') m = num(global._getDaysPerTurn(), 30) / 30;
    return m == null || m <= 0 ? 1 : m;
  }

  // 各州正在盘踞的游击：民变案落地的、还在的（占城、成势在民4，另有连带）
  function bandsByLeaf(G) {
    var out = {};
    arr(G.minxin && G.minxin.revolts).forEach(function (r) {
      if (!r || r.status !== 'ongoing' || r.source !== 'revolt-cases' || r.divisionId == null) return;
      if (r.form && r.form !== 'guerrilla') return;
      var k = str(r.divisionId);
      (out[k] = out[k] || []).push(r);
    });
    return out;
  }

  function mouthsOf(leaf) {
    var pd = leaf.populationDetail || {};
    var p = leaf.population;
    return Math.max(0, num(pd.mouths, num(p && typeof p === 'object' ? p.mouths : p, 0)));
  }

  // 这几股在本州的分量：人数占口数，到 CFG.saturate 记满
  function weightOf(followers, mouths) {
    return mouths > 0 ? clamp(followers / mouths / CFG.saturate, 0, 1) : 1;
  }

  function holdName(bands) {
    return (str(bands[0].leaderName) || '民变') + (bands.length > 1 ? '等' + bands.length + '股' : '一股') + '盘踞';
  }

  // ── 地块状态「某股盘踞」：同名的只改数（免得每回合在地块近账里记一次「立」），换了人就撤旧立新 ──
  function setHold(G, leaf, bands, followers, cut) {
    var RS = TM.RegionStatus;
    if (!RS || typeof RS.add !== 'function') return null;
    var name = holdName(bands);
    var desc = '众约 ' + followers + '，啸聚山林，不占城；本州征收少收约 ' + Math.round(cut * 100) + '%，驿路不通，户口逃散';
    var cur = arr(leaf.statusEffects).filter(function (e) { return e && e.source === SOURCE; });
    var same = cur.length === 1 && cur[0].name === name ? cur[0] : null;
    if (same) {
      same.econPct = round4(-cut);
      same.desc = desc;
      same.expiresTurn = num(G.turn, 0) + 2;
      return same;
    }
    cur.forEach(function (e) { RS.remove(leaf, e.id, SOURCE, G); });
    return RS.add(leaf, { id: 'hold-' + str(leaf.id), kind: 'event', name: name, desc: desc, econPct: -cut, minxinPerTurn: 0, durationTurns: 2, source: SOURCE }, G);
  }

  function clearHold(G, leaf) {
    var cur = arr(leaf.statusEffects).filter(function (e) { return e && e.source === SOURCE; });
    if (!cur.length) return false;
    var RS = TM.RegionStatus;
    if (RS && typeof RS.remove === 'function') cur.forEach(function (e) { RS.remove(leaf, e.id, SOURCE, G); });
    else leaf.statusEffects = arr(leaf.statusEffects).filter(function (e) { return !(e && e.source === SOURCE); });
    return true;
  }

  // ── 驿路阻断：一州一条，带州编号 ──
  function openRoute(G, leaf, bands, turn) {
    var list = G._routeDisruptions = arr(G._routeDisruptions);
    var reason = holdName(bands) + '，驿路不通';
    var ids = bands.map(function (r) { return r.id; });
    var d = list.filter(function (x) { return x && x.source === SOURCE && str(x.divisionId) === str(leaf.id) && !x.resolved; })[0];
    if (d) { d.reason = reason; d.revoltIds = ids; return null; }
    var name = str(leaf.name);
    d = {
      id: 'rd-' + str(leaf.id) + '-t' + turn, route: name + '驿路', from: name, to: name, reason: reason,
      resolved: false, turn: turn, source: SOURCE, divisionId: leaf.id, revoltIds: ids
    };
    list.push(d);
    if (typeof global.addEB === 'function') { try { global.addEB('传书', '⚠ 驿路阻断：' + d.route + '（' + reason + '）'); } catch (_) {} }
    return d;
  }

  // 这股了结或不在了：驿路复通；复通的留几回合再清
  function closeRoutes(G, live, turn) {
    var n = 0;
    arr(G._routeDisruptions).forEach(function (d) {
      if (!d || d.source !== SOURCE || d.resolved || live[str(d.divisionId)]) return;
      d.resolved = true; d.status = 'resolved'; d.resolvedTurn = turn; n++;
      if (typeof global.addEB === 'function') { try { global.addEB('传书', '驿路复通：' + d.route); } catch (_) {} }
    });
    if (Array.isArray(G._routeDisruptions)) {
      G._routeDisruptions = G._routeDisruptions.filter(function (d) {
        return !(d && d.source === SOURCE && d.resolved && turn - num(d.resolvedTurn, turn) > CFG.keepResolvedTurns);
      });
    }
    return n;
  }

  // ── 户口逃散：本州在籍的人弃家逃散，挪进本州逃户；口数不变（逃户、从乱、隐户都还记在本州口数里）──
  function scatter(leaf, followers, months) {
    var pd = leaf.populationDetail;
    if (!pd || typeof pd !== 'object') return 0;
    var settled = Math.max(0, mouthsOf(leaf) - Math.max(0, num(pd.fugitives, 0)) - Math.max(0, num(pd.rebels, 0)) - Math.max(0, num(pd.hiddenCount, 0)));
    var n = Math.round(Math.min(followers * CFG.fleeRate * months, settled * CFG.fleeCap * months));
    if (!(n > 0)) return 0;
    pd.fugitives = Math.max(0, num(pd.fugitives, 0)) + n;
    return n;
  }

  // ── 本州民心：民心账本记一笔（治安），精确点这一州；账本「来源累计」记折成全国的量（与「民变不宁」同一规矩）──
  function minxinHit(G, rows, months, totalMouths) {
    var ML = TM.MinxinLedger;
    if (!ML || typeof ML.recordAndApply !== 'function' || !rows.length) return;
    var wrote = false;
    rows.forEach(function (x) {
      var per = round2(-(CFG.minxinMin + (CFG.minxinMax - CFG.minxinMin) * x.w) * months);
      if (!per) return;
      var eq = round2(per * (totalMouths > 0 ? x.mouths / totalMouths : 1)) || -0.01;   // 账本按两位小数记，再小就被抹成零、整笔不落
      var res = ML.recordAndApply(G, {
        sourceSystem: 'revolt-guerrilla', kind: 'security', deltaTrue: eq,
        targetRegions: [{ region: x.leaf.id != null ? x.leaf.id : x.leaf.name, weight: 1, deltaTrue: per, exact: true }],
        intensity: Math.min(1, Math.abs(per) / 20), confidence: 0.9, reason: x.name
      }, { source: 'revolt-guerrilla', turn: G.turn, deferFinalize: true });
      var aff = res && res.result && res.result.affectedRegions;
      x.minxin = aff && aff.length ? num(aff[0].delta, 0) : 0;
      wrote = true;
    });
    if (wrote && typeof ML.finalizeBatch === 'function') ML.finalizeBatch(G, { source: 'revolt-guerrilla' });
  }

  // 每回合一次（回合推进之后、民变案判定之后）
  function tick(G, ctx) {
    var RC = TM.RevoltCases;
    if (!G || !RC || typeof RC.realmLeaves !== 'function') return null;
    var turn = num(G.turn, 0);
    var store = typeof RC.ensureStore === 'function' ? RC.ensureStore(G) : null;
    if (store && store.guerrillaTick === turn) return null;   // 同一回合只落一次：重跑、读档不重扣
    var months = monthsOf(ctx);
    var leaves = RC.realmLeaves(G), byLeaf = bandsByLeaf(G), live = {}, rows = [], totalMouths = 0;
    leaves.forEach(function (L) { totalMouths += mouthsOf(L.node); });
    leaves.forEach(function (L) {
      var leaf = L.node, bands = byLeaf[str(leaf.id)];
      if (!bands || !bands.length) { clearHold(G, leaf); return; }
      live[str(leaf.id)] = 1;
      var followers = bands.reduce(function (s, r) { return s + Math.max(0, Math.round(num(r.followers, num(r.scale, 0)))); }, 0);
      var mouths = mouthsOf(leaf), w = weightOf(followers, mouths);
      var cut = round4(CFG.cutMin + (CFG.cutMax - CFG.cutMin) * w);
      setHold(G, leaf, bands, followers, cut);
      openRoute(G, leaf, bands, turn);
      var fled = scatter(leaf, followers, months);
      rows.push({ leaf: leaf, bands: bands, name: holdName(bands), w: w, mouths: mouths, cut: cut, fled: fled, followers: followers, minxin: 0 });
    });
    minxinHit(G, rows, months, totalMouths);
    // 每股记下这回合落了什么（案卷、面板、日后奏报读它）
    rows.forEach(function (x) {
      x.bands.forEach(function (r) {
        var share = x.followers > 0 ? Math.max(0, num(r.followers, 0)) / x.followers : 1 / x.bands.length;
        var mine = Math.round(x.fled * share);
        var prev = r.guerrilla && typeof r.guerrilla === 'object' ? r.guerrilla : {};
        r.guerrilla = { turn: turn, cut: x.cut, fled: mine, fledTotal: num(prev.fledTotal, 0) + mine, minxin: x.minxin };
      });
    });
    var closed = closeRoutes(G, live, turn);
    if (store) store.guerrillaTick = turn;
    return { turn: turn, holds: rows.length, routesClosed: closed };
  }

  TM.RevoltGuerrilla = { CFG: CFG, SOURCE: SOURCE, tick: tick, bandsByLeaf: bandsByLeaf, weightOf: weightOf };
})(typeof window !== 'undefined' ? window : globalThis);
