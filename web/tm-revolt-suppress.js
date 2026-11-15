// @ts-check
// ============================================================
// tm-revolt-suppress.js — 发兵剿民变（民变重做·民2d-1，同志 11-14：「战斗记得走游戏内已有的军事系统，不要重复造轮子」）
//
// 依据 docs/guanben-roleplay-20260930/minbian.md「新的样子」与同志 11-14 定的三问：
//   - 起事即立一支军：民变案落地的每一股（tm-revolt-rising.js，source 'revolt-cases'）在军册（GM.armies）里有一支「某某部」，
//     归「民变」（不立势力，成势在民4），驻它盘踞的那一州。能打仗的人＝这股人数 × 本州丁口比（丁/口；丁口数不全取全国的），
//     其余照旧式流民军（tm-revolt-entity.js）：士气 55、训练 35、补给 45、乌合。首领领兵——真人，问对、记忆同一份人格。
//   - 谁下令剿：玩家（顶栏民变、民变干预，选一支军「发兵剿」）与主推演（一致性补录说「镇压」→ 派离得最近的一支官军，
//     AI 点了军名的用它点的）。
//   - 怎么打：官军不在那一州的走行军系统（MarchSystem.orderMarch：查归属、军令回执、路途日数）；到了那一州，
//     挂一场仗进 GM.activeBattles，下一次过回合由战斗引擎结算（BattleEngine.resolveAllBattles：兵力、士气、训练、乌合、
//     主将、补给、地形算强弱；伤亡、士气落到两军；御驾亲征开着照旧交玩家指挥）。
//     本模块只读战果、定这股散不散：大胜即散；小胜而这股能打的剩不到起事以来最多时的三成也散〔初值〕；
//     僵持接着打（下次过回合再结算一场）；败北这道剿令作罢（官军留在原地，可再令）。
//   - 散了：这股了结（status 'suppressed'），首领按战果定擒、杀、逃（可复现的掷骰〔初值〕），平乱接皇威（与旧平乱同一条规矩）。
//   - 人数落账：这股军里少了的能战之人记死（本州口数、丁数减），随之少的老弱妇孺记逃散（挪进本州逃户），都从本州「从乱」里扣；
//     这股了结时剩下的人——剿散的、自散的进本州逃户，受抚的、赈散的回籍——也从「从乱」里扣
//     （民2a～2c 漏了这一步：散了的人一直挂在从乱里，不纳粮）。
// 抚（朝廷下旨招抚）在民2d-2；旧档折算、删掉旧的五级梯与「调兵数够即平」在民2d-3。旧式民变（不是民变案落地的）照旧，不归这里。
// 挂在过回合 6.1455（tm-endturn-systems.js：民变案判定之后、游击连带之前）。
// ============================================================
(function (global) {
  'use strict';
  var TM = global.TM = global.TM || {};

  var CFG = {
    soldierRateFallback: 0.25,          // 〔初值〕丁口数都不全时，这股人里能打仗的比重
    soldierRateMin: 0.05, soldierRateMax: 0.6,
    morale: 55, training: 35, supply: 45,   // 旧式流民军同值（tm-revolt-entity.js）
    breakBelow: 0.3,                    // 〔初值〕小胜后这股能打的剩不到最多时的这个比重，散
    collapseBelow: 0.05,                // 〔初值〕不论什么缘故，这股能打的剩不到最多时的这个比重，散
    leaderFate: {                       // 〔初值〕这股散时首领：擒、杀，余下是逃
      decisive: { captured: 0.35, killed: 0.25 },
      other: { captured: 0.2, killed: 0.15 }
    },
    lapseTurns: 6,                      // 〔初值〕候军中回报这么多回合还没动身，剿令作罢
    faction: '民变'
  };
  var SOURCE = 'revolt.band';            // 军册上这类军的来源
  var BATTLE_SOURCE = 'revolt-suppress';  // 挂进 GM.activeBattles 的仗的来源
  var RANK_TAG = { '-1': '在途', '0': '本州', '1': '本省', '2': '他处', '3': '驻地不明' };
  var END_TEXT = {
    defeated: '进剿败北，剿令作罢', withdrawn: '已离开，剿令作罢', lapsed: '久候不动，剿令作罢',
    refused: '军中未奉剿令', 'army-gone': '已不在册，剿令作罢'
  };

  function arr(v) { return Array.isArray(v) ? v : []; }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function str(v) { return v == null ? '' : String(v); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function RC() { return TM.RevoltCases || null; }
  function esc(s) {
    return str(s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; });
  }
  function eb(cat, text) {
    if (typeof global.addEB !== 'function') return;
    try { global.addEB(cat, text, { credibility: 'high' }); } catch (_) {}
  }

  function isBand(r) { return !!(r && r.source === 'revolt-cases'); }
  function active(s) { return !!(s && s.status && s.status !== 'done'); }
  function gone(a) { return !a || a.destroyed === true || a.disbanded === true || a.state === 'disbanded'; }
  function soldiersOf(a) { return Math.max(0, num(a && (a.soldiers != null ? a.soldiers : a.strength), 0)); }

  function findRevolt(G, id) {
    return arr(G && G.minxin && G.minxin.revolts).filter(function (r) { return r && r.id === id; })[0] || null;
  }
  function findChar(G, id, name) {
    var list = arr(G.chars), i;
    if (id != null && id !== '') for (i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    if (name) for (i = 0; i < list.length; i++) if (list[i] && list[i].name === name) return list[i];
    return null;
  }
  function findArmy(G, ref) {
    if (ref == null || ref === '') return null;
    var list = arr(G.armies), i;
    for (i = 0; i < list.length; i++) if (list[i] && list[i].id === ref) return list[i];
    for (i = 0; i < list.length; i++) if (list[i] && list[i].name === ref) return list[i];
    return null;
  }
  function leafOf(G, r, leaves) {
    var R = RC();
    if (!R || !r) return null;
    leaves = leaves || R.realmLeaves(G);
    for (var i = 0; i < leaves.length; i++) if (str(leaves[i].node.id) === str(r.divisionId)) return leaves[i];
    return r.region ? R.placeLeaf(G, r.region, leaves) : null;
  }
  function place(r) { return (r.province ? str(r.province) + '·' : '') + str(r.region || '某地'); }

  // ── 归属：玩家一方的军（与行军系统 orderMarch 同一个认法：势力编号、名字都认）──
  function facKey(G, ref) {
    var key = str(ref);
    var f = arr(G.facs).filter(function (x) { return x && (str(x.id) === key || str(x.name) === key); })[0];
    return f ? str(f.id || f.name) : key;
  }
  function playerFaction(G) {
    var MS = global.MilitarySystems, pf = '';
    if (MS && typeof MS.battlePlayerFaction === 'function') { try { pf = str(MS.battlePlayerFaction(G)); } catch (_) { pf = ''; } }
    if (!pf) {
      var pi = (global.P && global.P.playerInfo) || G.playerInfo || {};
      pf = str((G.startContext && G.startContext.playerFactionId) || G.playerFactionId || pi.factionId || pi.factionName || G.playerFactionName || G.playerFaction || '');
    }
    if (!pf) arr(G.chars).some(function (c) { if (c && c.isPlayer) { pf = str(c.factionId || c.faction); return true; } return false; });
    return pf ? facKey(G, pf) : '';
  }
  function isPlayerArmy(G, a, pf) {
    if (pf == null) pf = playerFaction(G);
    var af = a && (a.factionId || a.faction);
    return !!(pf && af && facKey(G, af) === pf);
  }
  // 在途：行军系统的行军令（MarchSystem），或主推演调兵那套「军队行军」写着的去向（tm-feudal-warfare.js，按 army.destination 走）
  function isMarching(G, a) {
    if (a.state === 'marching') return true;
    if (a.destination && str(a.destination) !== str(a.location || a.garrison)) return true;
    return arr(G.marchOrders).some(function (o) { return o && o.status === 'marching' && (o.armyId === a.id || o.armyName === a.name); });
  }
  // 地图寻路认不认得这两头：开了地图的剧本拿地图节点找路（天启是省一级的 43 块），军驻地写的是「榆林」这类地名，
  //   对不上就一律「无路可达」——这不是路不通，是认不出地名
  function mapCantPlace(G, from, to) {
    var Pp = global.P, graph = G.mapData && G.mapData.adjacencyGraph;
    return !!(Pp && Pp.map && Pp.map.enabled && graph && (!graph[from] || !graph[to]));
  }
  function marchOrderOf(G, a) {
    return arr(G.marchOrders).filter(function (o) { return o && o.status === 'marching' && (o.armyId === a.id || o.armyName === a.name); })[0] || null;
  }
  function battleOn() {
    var BE = global.BattleEngine;
    if (!BE || typeof BE.resolveAllBattles !== 'function') return false;
    try { return !BE._getConfig || BE._getConfig().enabled !== false; } catch (_) { return false; }
  }

  // ── 这股的军 ──
  function bandArmy(G, r) {
    var id = r.band && r.band.armyId, list = arr(G.armies);
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (a && a._revoltBand && (a.id === id || a.sourceRevoltId === r.id)) return a;
    }
    return null;
  }

  // 本州能打仗的比重：丁/口；本州不全取玩家一方各州合计；再不全取〔初值〕
  function soldierRate(G, L, leaves) {
    function rate(pd) { var d = num(pd && pd.ding, 0), m = num(pd && pd.mouths, 0); return d > 0 && m > 0 ? d / m : null; }
    var x = rate(L && L.node.populationDetail);
    if (x == null) {
      var d = 0, m = 0, R = RC();
      arr(leaves || (R ? R.realmLeaves(G) : [])).forEach(function (L2) {
        var pd = L2.node.populationDetail || {};
        if (num(pd.ding, 0) > 0 && num(pd.mouths, 0) > 0) { d += num(pd.ding, 0); m += num(pd.mouths, 0); }
      });
      x = d > 0 && m > 0 ? d / m : CFG.soldierRateFallback;
    }
    return clamp(x, CFG.soldierRateMin, CFG.soldierRateMax);
  }

  function setSoldiers(a, n) {
    a.soldiers = n; a.size = n; a.strength = n;
    a.composition = [{ type: '流民军', count: n }];
  }

  function armyName(G, r) {
    var base = (str(r.leaderName) || '民变') + '部', taken = {};
    arr(G.armies).forEach(function (a) { if (a && a.name) taken[a.name] = 1; });
    if (!taken[base]) return base;
    var alt = str(r.region) + base;
    return taken[alt] ? alt + '（' + str(r.id).slice(-6) + '）' : alt;
  }

  // 起事即立一支军（同志 11-14 定）：民变落地时调（tm-revolt-rising.js land），过回合再补一遍（旧档、落地时本模块缺席）
  function ensureArmy(G, r, L, leaves) {
    if (!G || !isBand(r) || r.status !== 'ongoing') return null;
    var a = bandArmy(G, r);
    if (a) return a;          // 打散了的军不复立：这股在 tick 里了结
    L = L || leafOf(G, r, leaves);
    var rate = soldierRate(G, L, leaves);
    var n = Math.max(1, Math.round(Math.max(0, num(r.followers, num(r.scale, 0))) * rate));
    var leader = findChar(G, r.leaderId, r.leaderName);
    var where = str(r.region) || (L ? str(L.node.name) : '');
    var turn = num(G.turn, 0);
    if (!Array.isArray(G.armies)) G.armies = [];
    a = {
      id: 'army_band_' + str(r.id), name: armyName(G, r), faction: CFG.faction,
      branch: '流民军', type: '流民军', armyType: '流民军',
      soldiers: n, size: n, strength: n,
      morale: CFG.morale, supply: CFG.supply, training: CFG.training, loyalty: 80, control: 70, controlLevel: 70,
      location: where, garrison: where,
      commander: leader ? str(leader.name) : str(r.leaderName),
      equipment: [], quality: '乌合', composition: [{ type: '流民军', count: n }],
      state: 'field', source: SOURCE, sourceRevoltId: r.id, divisionId: r.divisionId, _revoltBand: true, _createdTurn: turn
    };
    if (leader && leader.id != null) a.commanderId = leader.id;
    G.armies.push(a);   // arch-ok 民变案每股一支军（民2d-1）·形状照旧式流民军（tm-revolt-entity.js）
    r.band = {
      armyId: a.id, rate: Math.round(rate * 1000) / 1000, peak: n, last: n,
      followersAt: Math.max(0, Math.round(num(r.followers, 0))), dead: 0, scattered: 0, createdTurn: turn
    };
    return a;
  }

  // ── 军与人对账：军里少了的能战之人记死，随之少的老弱记逃散，都从本州「从乱」里扣 ──
  // 军只在交战里减；别处给它加的兵不认（人数按户口算，不取叙事报的数），拉回这股人数折的兵数。
  // 这股驻在它那一州（游击不挪州；流窜在民4），别处把它挪走的拉回来。
  function syncBand(G, r, L, a) {
    var b = r.band;
    if (!b) return null;
    var out = { lost: 0, dead: 0, scattered: 0 };
    var followers = Math.max(0, Math.round(num(r.followers, num(r.scale, 0))));
    var now = gone(a) ? 0 : soldiersOf(a), last = Math.max(0, num(b.last, now));
    if (now < last && last > 0) {
      var lostF = Math.min(followers, Math.round(followers * (last - now) / last));
      var dead = Math.min(lostF, last - now), scattered = lostF - dead;
      var pd = L && L.node.populationDetail;
      if (pd) {
        pd.rebels = Math.max(0, num(pd.rebels, 0) - lostF);
        if (scattered > 0) pd.fugitives = Math.max(0, num(pd.fugitives, 0)) + scattered;
        if (dead > 0) {
          pd.mouths = Math.max(0, num(pd.mouths, 0) - dead);
          if (num(pd.ding, 0) > 0) pd.ding = Math.max(0, num(pd.ding, 0) - dead);
        }
      }
      followers -= lostF;
      r.followers = followers; r.scale = followers;
      b.dead = num(b.dead, 0) + dead; b.scattered = num(b.scattered, 0) + scattered;
      out = { lost: last - now, dead: dead, scattered: scattered };
    } else if (!gone(a)) {
      var want = followers !== num(b.followersAt, followers) || now > last
        ? Math.max(1, Math.round(followers * num(b.rate, CFG.soldierRateFallback))) : now;
      if (want !== now) { setSoldiers(a, want); now = want; }
    }
    if (!gone(a) && r.region && (a.location !== r.region || a.garrison !== r.region)) {
      a.location = str(r.region); a.garrison = str(r.region); a.state = 'field'; a.destination = '';
    }
    b.last = now; b.followersAt = followers;
    if (now > num(b.peak, 0)) b.peak = now;
    return out;
  }

  // ── 这股散了：首领擒、杀、逃；平乱接皇威 ──
  function fateOf(G, r, decisive) {
    var p = decisive ? CFG.leaderFate.decisive : CFG.leaderFate.other;
    var R = RC();
    var x = R ? R.seededRoll(str(G._campaignId || G.sid || '') + '|' + num(G.turn, 0) + '|' + str(r.id) + '|fate') : 1;
    return x < p.captured ? 'captured' : (x < p.captured + p.killed ? 'killed' : 'escaped');
  }

  function remember(ch, text) {
    var NM = global.NpcMemorySystem;
    if (!ch || !NM || typeof NM.addMemory !== 'function') return;
    try { NM.addMemory(ch.name, text, 9, 'career'); } catch (_) {}
  }

  function applyFate(G, r, fate, by) {
    var ch = findChar(G, r.leaderId, r.leaderName);
    if (!ch || ch.alive === false || ch.dead === true) return 'gone';
    var turn = num(G.turn, 0), who = str(by) || '官军', where = str(r.region) || '某地';
    if (fate === 'killed') {
      var why = '聚众作乱于' + where + '，为' + who + '所斩';
      if (typeof global.applyOneDeath === 'function') {
        try { global.applyOneDeath({ name: ch.name, characterId: ch.id, reason: why }); } catch (_) {}
      }
      if (ch.alive !== false && ch.dead !== true) { ch.alive = false; ch.dead = true; ch.deathTurn = turn; ch.deathReason = why; }
      return 'killed';
    }
    if (fate === 'captured') {
      ch._imprisoned = true; ch._imprisonedTurn = turn;
      ch._imprisonReason = '聚众作乱于' + where + '，为' + who + '所擒，下狱候勘';
      remember(ch, '聚众起事于' + where + '，为' + who + '所破，被擒下狱');
      return 'captured';
    }
    remember(ch, '聚众起事于' + where + '，为' + who + '所破，脱身潜逃');
    return 'escaped';
  }

  function huangwei(r) {
    if (r._hwAwarded) return 0;
    var AE = global.AuthorityEngines;
    if (!AE || typeof AE.adjustHuangwei !== 'function') return 0;
    try {
      var res = AE.adjustHuangwei('suppressRevolt', Math.max(2, Math.min(8, num(r.level, 1) * 2)), str(r.region || '某地') + ' 平乱');
      r._hwAwarded = true;
      return num(res && res.delta, 0);
    } catch (_) { return 0; }
  }

  var FATE_TEXT = { captured: '，首领{n}被擒', killed: '，首领{n}伏诛', escaped: '，首领{n}脱身潜逃', gone: '' };

  function breakBand(G, r, L, how) {
    how = how || {};
    var turn = num(G.turn, 0);
    r.status = 'suppressed'; r._suppressed = true;
    r.endedTurn = turn; r.suppressedTurn = turn; r.endedBy = how.endedBy || 'suppress';
    var fate = applyFate(G, r, fateOf(G, r, how.verdict === '大胜'), how.by);
    r.leaderFate = fate;
    huangwei(r);
    var s = r.suppress;
    if (active(s)) { s.status = 'done'; s.end = 'broken'; s.endedTurn = turn; s.battleId = null; }
    var left = Math.max(0, Math.round(num(r.followers, 0)));
    eb('民变', '【' + place(r) + '】' + (str(how.by) || '官军') + '剿破' + (str(r.leaderName) || '民变') + '一股' +
      FATE_TEXT[fate].replace('{n}', str(r.leaderName)) + (left ? '，余众约 ' + left + ' 人四散' : ''));
    return fate;
  }

  // ── 了结了的善后（剿破的、旧五级梯自散的、受抚的、赈散的都走这里，一股只走一次）──
  //   剩下的人从本州「从乱」里扣：受抚、赈散的回籍，其余进本州逃户；军从军册撤掉，没结的仗一并撤；首领不再挂着这股。
  function settle(G, r, L) {
    if (!isBand(r) || r.status === 'ongoing' || r.settled) return null;
    var turn = num(G.turn, 0);
    var home = r.status === 'pacified' || r.status === 'appeased' || r.endedBy === 'relief';
    var n = Math.max(0, Math.round(num(r.followers, num(r.scale, 0))));
    var pd = L && L.node.populationDetail;
    if (pd && n > 0) {
      pd.rebels = Math.max(0, num(pd.rebels, 0) - n);
      if (!home) pd.fugitives = Math.max(0, num(pd.fugitives, 0)) + n;
    }
    var a = bandArmy(G, r);
    if (a && Array.isArray(G.armies)) { var ai = G.armies.indexOf(a); if (ai >= 0) G.armies.splice(ai, 1); }
    dropBattles(G, function (b) { return b.revoltId === r.id; });
    var s = r.suppress;
    if (active(s)) { s.status = 'done'; s.end = 'band-ended'; s.endedTurn = turn; s.battleId = null; }
    var ch = findChar(G, r.leaderId, r.leaderName);
    if (ch && ch._revoltLeaderOf === r.id) delete ch._revoltLeaderOf;
    arr(r.lieutenantIds).forEach(function (id) { var x = findChar(G, id, null); if (x && x._revoltLieutenantOf === r.id) delete x._revoltLieutenantOf; });
    r.settled = { turn: turn, n: n, to: home ? 'registered' : 'fugitives' };
    return r.settled;
  }

  function dropBattles(G, pick) {
    if (!Array.isArray(G.activeBattles)) return;
    for (var i = G.activeBattles.length - 1; i >= 0; i--) {
      var b = G.activeBattles[i];
      if (b && b.source === BATTLE_SOURCE && pick(b)) G.activeBattles.splice(i, 1);
    }
  }

  // 州里「从乱」比在的各股人数多（散了没善后、出了档的旧股），多出的挪进本州逃户——从乱只有民变落地在写（tm-revolt-rising.js）
  function reconcileRebels(G, leaves) {
    var live = {};
    arr(G.minxin && G.minxin.revolts).forEach(function (r) {
      if (!isBand(r) || r.status !== 'ongoing') return;
      var k = str(r.divisionId);
      live[k] = (live[k] || 0) + Math.max(0, Math.round(num(r.followers, 0)));
    });
    var moved = 0;
    leaves.forEach(function (L) {
      var pd = L.node.populationDetail;
      if (!pd) return;
      var have = Math.max(0, num(pd.rebels, 0)), want = live[str(L.node.id)] || 0;
      if (have <= want) return;
      pd.rebels = want;
      pd.fugitives = Math.max(0, num(pd.fugitives, 0)) + (have - want);
      moved += have - want;
    });
    return moved;
  }

  // ── 剿令 ──
  function endOrder(G, r, why) {
    var s = r.suppress;
    if (!active(s)) return;
    s.status = 'done'; s.end = why; s.endedTurn = num(G.turn, 0);
    if (s.battleId) { var id = s.battleId; dropBattles(G, function (b) { return b.id === id; }); }
    s.battleId = null;
    if (END_TEXT[why]) eb('民变', '【' + place(r) + '】' + str(s.armyName) + END_TEXT[why]);
  }

  function terrainOf(G, L) {
    var t = L.node.terrain;
    if (!t && G.provinceStats && G.provinceStats[L.node.name]) t = G.provinceStats[L.node.name].terrain;
    var MS = global.MilitarySystems;
    return MS && typeof MS.battleTerrainKey === 'function' ? MS.battleTerrainKey(t) : 'plains';
  }

  // 官军在那一州：挂一场仗，下次过回合由战斗引擎结算
  function engage(G, r, L, a, band) {
    var s = r.suppress, turn = num(G.turn, 0);
    if (!Array.isArray(G.activeBattles)) G.activeBattles = [];
    if (s.battleId && G.activeBattles.some(function (b) { return b && b.id === s.battleId; })) return null;
    var id = 'sup-' + str(r.id) + '-t' + turn + '-' + (arr(s.battles).length + 1);
    var battle = {
      id: id, battleId: id, turn: turn,
      attackerArmy: a.name, attackerArmyId: a.id, attackerFaction: a.faction,
      defenderArmy: band.name, defenderArmyId: band.id, defenderFaction: band.faction,
      location: str(L.node.name), terrain: terrainOf(G, L), fortLevel: 0,
      phase: 'engaged', source: BATTLE_SOURCE, revoltId: r.id, affectedArmies: []
    };
    G.activeBattles.push(battle);   // arch-ok 剿一股民变挂一场仗（民2d-1），过回合由战斗引擎结算
    s.battleId = id; s.status = 'engaged';
    if (s.engagedTurn == null) s.engagedTurn = turn;
    return battle;
  }

  function resultOf(G, id) {
    var hit = null;
    arr(G._turnBattleResults).concat(arr(G.battleHistory)).some(function (x) {
      if (x && str(x.battleId) === str(id)) { hit = x; return true; }
      return false;
    });
    return hit;
  }

  // 战果按官军一方说：战斗引擎给的是攻方的胜负；御驾亲征交玩家打的，按胜方是谁折
  function verdictOf(res, band) {
    var v = str(res.verdict);
    if (v === '大胜' || v === '小胜' || v === '僵持' || v === '败北') return v;
    var w = str(res.winnerFactionId || res.winnerFaction || res.winner);
    if (w === '僵持') return '僵持';
    if (w && (w === str(band.faction) || w === str(band.name))) return '败北';
    return '小胜';
  }
  function lossesOf(res) {
    var a = num(res.attackerLoss, NaN), d = num(res.defenderLoss, NaN);
    if (!isFinite(a) && res.casualties) { a = num(res.casualties.attacker, 0); d = num(res.casualties.defender, 0); }
    return { army: isFinite(a) ? a : 0, band: isFinite(d) ? d : 0 };
  }

  // 每回合走一步：读上一场的战果，定散不散；官军在那一州就再挂一场，在路上就等，走开了、久候不动就作罢
  function stepOrder(G, r, L, band, leaves) {
    var s = r.suppress;
    if (!active(s)) return;
    var turn = num(G.turn, 0);
    var a = findArmy(G, s.armyId);
    if (gone(a) || soldiersOf(a) <= 0 || !isPlayerArmy(G, a)) { endOrder(G, r, 'army-gone'); return; }
    if (s.battleId) {
      var res = resultOf(G, s.battleId);
      if (res) {
        var v = verdictOf(res, band), loss = lossesOf(res);
        var left = gone(band) ? 0 : soldiersOf(band), peak = num(r.band && r.band.peak, left);
        s.battles.push({ turn: num(res.turn, turn), verdict: v, armyLoss: loss.army, bandLoss: loss.band, left: left, ratio: res.adjustedRatio != null ? res.adjustedRatio : null });
        s.battleId = null;
        eb('民变', '【' + place(r) + '】' + str(a.name) + '与' + str(band.name) + '交战：' + v + '，官军损 ' + loss.army + '，' + str(band.name) + '损 ' + loss.band + '（余 ' + left + '）');
        if (v === '大胜' || (v === '小胜' && left < peak * CFG.breakBelow) || left <= 0) {
          breakBand(G, r, L, { verdict: v, by: a.name, endedBy: 'suppress' });
          return;
        }
        if (v === '败北') { endOrder(G, r, 'defeated'); return; }
      } else {
        var pend = arr(G.activeBattles).filter(function (b) { return b && b.id === s.battleId; })[0];
        if (pend) { s.status = pend.phase === 'awaiting-command' ? 'awaiting-command' : 'engaged'; return; }
        s.battleId = null;   // 仗没了又没战果（读档丢了、结算没跑）：下面重挂
      }
    }
    var R = RC();
    var at = R.placeLeaf(G, str(a.location || a.garrison), leaves), moving = isMarching(G, a);
    if (!moving && at === L) { engage(G, r, L, a, band); return; }
    if (moving && str(a.destination) === str(L.node.name)) { s.status = 'marching'; return; }
    if (s.status === 'awaiting') {
      var co = arr(G.commandOrders).filter(function (o) { return o && o.id === s.commandOrderId; })[0];
      if (co && co.status === 'refused') { endOrder(G, r, 'refused'); return; }
      if (turn - num(s.orderedTurn, turn) > CFG.lapseTurns) endOrder(G, r, 'lapsed');
      return;
    }
    endOrder(G, r, 'withdrawn');
  }

  // 发兵剿：玩家选的、推演派的都走这里。返回 { ok, status, text } 或 { ok:false, reason }
  function order(G, revoltId, armyRef, opts) {
    opts = opts || {};
    var R = RC();
    if (!G || !R) return { ok: false, reason: '民变模块缺席' };
    var r = findRevolt(G, revoltId);
    if (!r || r.status !== 'ongoing') return { ok: false, reason: '这股已了结' };
    if (!isBand(r)) return { ok: false, reason: '旧式民变照旧调兵数镇压' };
    if (!battleOn()) return { ok: false, reason: '本剧本未开战斗结算' };
    var leaves = R.realmLeaves(G), L = leafOf(G, r, leaves);
    if (!L) return { ok: false, reason: '这股所在之州已不在本朝' };
    var band = ensureArmy(G, r, L, leaves);
    if (!band || gone(band)) return { ok: false, reason: '这股已散' };
    var a = findArmy(G, armyRef);
    if (gone(a) || a._revoltBand) return { ok: false, reason: '查无此军' };
    if (soldiersOf(a) <= 0) return { ok: false, reason: a.name + '已无兵' };
    if (!isPlayerArmy(G, a)) return { ok: false, reason: '非我王师·不受节制' };
    var busy = arr(G.minxin.revolts).filter(function (x) { return x && x !== r && active(x.suppress) && (x.suppress.armyId === a.id || x.suppress.armyId === a.name); })[0];
    if (busy) return { ok: false, reason: a.name + '正在剿' + str(busy.region) };
    if (active(r.suppress) && (r.suppress.armyId === a.id || r.suppress.armyId === a.name)) return { ok: false, reason: a.name + '已在进剿' };
    var turn = num(G.turn, 0), target = str(L.node.name);
    var s = {
      armyId: a.id != null ? a.id : a.name, armyName: str(a.name), commander: str(a.commander), by: str(opts.by || 'player'),
      reason: str(opts.reason).slice(0, 60), orderedTurn: turn, target: target, from: str(a.location || a.garrison), status: '', battles: []
    };
    var at = R.placeLeaf(G, s.from, leaves);
    if (isMarching(G, a)) {
      if (str(a.destination) !== target) return { ok: false, reason: '此军已在途中·未可再令' };
      s.status = 'marching';
    } else if (at === L) {
      s.status = 'engaged';
    } else {
      var MS = global.MarchSystem;
      if (!MS || typeof MS.orderMarch !== 'function') return { ok: false, reason: '行军系统缺席' };
      var res = MS.orderMarch(a.id != null ? a.id : a.name, target);
      var CA = TM.CommandAuthority;
      if (res && !res.ok && /无路可达/.test(str(res.reason)) && mapCantPlace(G, s.from, target)) {
        // 地图寻路认不出两头的地名（不是路不通）：改走主推演调兵那套「军队行军」——写去向，过回合按 army.destination 走到
        //   （tm-feudal-warfare.js，与主推演 army_changes 调兵同一条路）。走军令回执的军照回执的路数发令候复，去向由军中回报落
        if (CA && typeof CA.enabled === 'function' && CA.enabled(a) && typeof CA.requestMarch === 'function') {
          res = CA.requestMarch(a, target) || res;
          s.via = 'receipt';
        } else {
          a.destination = target; a._remainingDistance = 0;
          if (global.TMMapLocations && typeof global.TMMapLocations.sync === 'function') { try { global.TMMapLocations.sync(a, 'army', G); } catch (_) {} }
          eb('行军', str(a.name) + '接令调往' + target);
          res = { ok: true };
          s.via = 'destination';
        }
      }
      if (!res || !res.ok) return { ok: false, reason: (res && res.reason) || '军令未能成行' };
      s.status = res.pending ? 'awaiting' : 'marching';
      if (res.orderId) s.commandOrderId = res.orderId;
      if (res.order && res.order.id) s.marchOrderId = res.order.id;
    }
    if (active(r.suppress)) endOrder(G, r, 'superseded');
    r.suppress = s;
    if (s.status === 'engaged') engage(G, r, L, a, band);
    var text = '调' + s.armyName + (s.commander ? '（' + s.commander + '）' : '') + '剿' + (str(r.leaderName) || '民变') + '一股' +
      (s.status === 'engaged' ? '，就地进剿' : (s.status === 'awaiting' ? '，候军中回报' : '，自' + (s.from || '驻地') + '开拔'));
    eb('民变', '【' + place(r) + '】' + text);
    return { ok: true, status: s.status, text: text, revoltId: r.id };
  }

  // 能调去剿这股的玩家一方各军：在途来此的、本州、本省、他处、驻地不明（落不到州也落不到地图地块，如「全国卫所军·总览」），
  //   各档按兵多寡。驻地先按州认（placeLeaf），认不出再看地图上的落点（TMMapLocations 绑的地块）与本州所属地块是不是同一块
  function candidates(G, r, leaves) {
    var R = RC();
    if (!G || !R || !r) return [];
    leaves = leaves || R.realmLeaves(G);
    var L = leafOf(G, r, leaves);
    if (!L) return [];
    var prov = L.chain[L.chain.length - 1], provBase = prov && prov !== L.node ? R.baseName(prov.name) : '';
    var pf = playerFaction(G), busy = {}, RR = TM.RevoltRising, out = [];
    arr(G.minxin && G.minxin.revolts).forEach(function (x) { if (x && x !== r && active(x.suppress)) busy[str(x.suppress.armyId)] = 1; });
    arr(G.armies).forEach(function (a) {
      if (!a || gone(a) || a._revoltBand || soldiersOf(a) <= 0 || !isPlayerArmy(G, a, pf)) return;
      if (busy[str(a.id != null ? a.id : a.name)]) return;
      var loc = str(a.location || a.garrison), rank;
      if (isMarching(G, a)) {
        if (str(a.destination) !== str(L.node.name)) return;
        rank = -1;
      } else {
        var at = loc ? R.placeLeaf(G, loc, leaves) : null;
        var mapId = str(a.garrisonRegionId || a.mapRegionId || a.regionId);
        if (at === L) rank = 0;
        else if (at) rank = at.chain[at.chain.length - 1] === prov ? 1 : 2;
        else if (provBase && RR && RR.provinceHit(loc, provBase)) rank = 1;
        else if (mapId && L.node.mapRegionId) rank = mapId === str(L.node.mapRegionId) ? 1 : 2;
        else rank = 3;
      }
      out.push({
        army: a, rank: rank, at: loc,
        label: '〔' + RANK_TAG[String(rank)] + '〕' + str(a.name) + ' ' + soldiersOf(a) + '兵' + (a.commander ? '·帅' + str(a.commander) : '') + (loc ? '·驻' + loc : '')
      });
    });
    out.sort(function (x, y) { return (x.rank - y.rank) || (soldiersOf(y.army) - soldiersOf(x.army)); });
    return out;
  }

  // 主推演说「镇压」（一致性补录 record_revolt_events）：落到民变案的一股就派兵去剿，不直接判平。
  //   哪一股：AI 给了首领名认首领；否则认它说的那一州；只说到省的，在那省各股里挑还没人剿的、人多的。
  //   派哪支：AI 点了军名、是能调的玩家一方的军就用它；否则在途来此的、本州的、本省的里挑最先一支；本省无兵不剿。
  //   返回 handled:false（不是民变案的民变、本剧本没开战斗结算）由调用方照旧办。
  function fromAI(G, decl) {
    decl = decl || {};
    var R = RC();
    if (!G || !R || !battleOn()) return { handled: false };
    var bands = arr(G.minxin && G.minxin.revolts).filter(function (r) { return r && r.status === 'ongoing' && isBand(r); });
    if (!bands.length) return { handled: false };
    var leaves = R.realmLeaves(G), pick = null, who = str(decl.leader).trim();
    if (who) pick = bands.filter(function (r) { return r.leaderName === who; })[0] || null;
    if (!pick) {
      // 它说的那一州有股就是那州的；那州没有（或只说到省）就在那一省各股里挑
      var L = R.placeLeaf(G, decl.region, leaves), pool = [];
      if (L) pool = bands.filter(function (r) { return str(r.divisionId) === str(L.node.id); });
      if (!pool.length) {
        var RR = TM.RevoltRising, provNode = L ? L.chain[L.chain.length - 1] : null;
        if (provNode === (L && L.node)) provNode = null;
        pool = bands.filter(function (r) {
          var LL = leafOf(G, r, leaves), p = LL && LL.chain[LL.chain.length - 1];
          if (!p || p === LL.node) return false;
          if (L) return p === provNode;
          return !!(RR && RR.provinceHit(str(decl.region), R.baseName(p.name)));
        });
      }
      pool.sort(function (x, y) {
        var ax = active(x.suppress) ? 1 : 0, ay = active(y.suppress) ? 1 : 0;
        return (ax - ay) || (num(y.followers, 0) - num(x.followers, 0));
      });
      pick = pool[0] || null;
    }
    if (!pick) return { handled: false };
    if (active(pick.suppress)) return { handled: true, ok: true, already: true, revoltId: pick.id };
    var cands = candidates(G, pick, leaves), named = str(decl.army).trim(), c = null;
    if (named) c = cands.filter(function (x) { return x.army.name === named || str(x.army.id) === named; })[0] || null;
    if (!c) c = cands.filter(function (x) { return x.rank <= 1; })[0] || null;
    if (!c) {
      eb('民变', '【' + place(pick) + '】剿议未行：本省无官军可调');
      return { handled: true, ok: false, reason: '本省无官军可调', revoltId: pick.id };
    }
    var res = order(G, pick.id, c.army.id != null ? c.army.id : c.army.name, { by: str(decl.by || 'ai'), reason: decl.reason });
    return Object.assign({ handled: true, revoltId: pick.id }, res);
  }

  // ── 面板用 ──
  var END_SHORT = { broken: '剿破此股', defeated: '进剿败北', withdrawn: '已撤，剿令作罢', lapsed: '久候不动，剿令作罢', refused: '未奉剿令', 'army-gone': '不在册，剿令作罢' };
  function statusText(G, r) {
    var s = r && r.suppress;
    if (!s || !s.status) return '';
    var who = str(s.armyName) + (s.commander ? '（' + s.commander + '）' : '');
    var last = arr(s.battles).slice(-1)[0], lastTxt = last ? '；上一仗' + last.verdict : '';
    if (s.status === 'marching') {
      var a = findArmy(G, s.armyId), mo = a ? marchOrderOf(G, a) : null;
      var eta = mo ? Math.max(1, num(mo.eta, 0) - num(G.turn, 0)) : null;
      return who + '赴' + s.target + '进剿' + (eta != null ? '，约 ' + eta + ' 回合到' : '') + lastTxt;
    }
    if (s.status === 'awaiting') return '已调' + who + '进剿，候军中回报';
    if (s.status === 'engaged') return who + '在' + s.target + '进剿' + (s.battleId ? '，过回合接战' : '') + lastTxt;
    if (s.status === 'awaiting-command') return who + '与之对阵，候御驾亲征指挥';
    if (s.status === 'done' && num(G.turn, 0) - num(s.endedTurn, 0) <= 2 && END_SHORT[s.end]) return who + END_SHORT[s.end];
    return '';
  }

  // 一股民变的剿令小件：进剿中的写状态；没在剿的给一个选军框和「发兵剿」钮
  //   opts.idPrefix：选军框编号前缀；opts.after：点钮后接着跑的一句（各面板自己的重绘）
  function panelHtml(G, r, opts) {
    opts = opts || {};
    if (!G || !isBand(r) || r.status !== 'ongoing') return '';
    var html = '', st = statusText(G, r);
    if (st) html += ' <span style="color:var(--amber-400);">' + esc(st) + '</span>';
    if (active(r.suppress)) return html;
    if (!battleOn()) return html + ' <span style="color:var(--txt-d);">本剧本未开战斗结算</span>';
    var cands = candidates(G, r);
    if (!cands.length) return html + ' <span style="color:var(--txt-d);">无可调之军</span>';
    var sid = str(opts.idPrefix || '_revSup_') + str(r.id).replace(/[^\w-]/g, '_');
    html += ' <select id="' + esc(sid) + '" style="font-size:inherit;padding:1px 4px;max-width:16rem;">';
    cands.slice(0, 16).forEach(function (c) {
      html += '<option value="' + esc(c.army.id != null ? c.army.id : c.army.name) + '">' + esc(c.label) + '</option>';
    });
    html += '</select>';
    html += ' <button class="btn" style="font-size:inherit;padding:2px 6px;" onclick="TM.RevoltSuppress.orderFromUI(\'' +
      esc(str(r.id).replace(/['\\]/g, '')) + '\',\'' + esc(sid) + '\');' + str(opts.after) + '">发兵剿</button>';
    return html;
  }

  function orderFromUI(revoltId, selectId) {
    var doc = global.document, el = doc && doc.getElementById ? doc.getElementById(selectId) : null;
    var res = order(global.GM, revoltId, el ? el.value : '', { by: 'player' });
    if (typeof global.toast === 'function') global.toast(res.ok ? res.text : (res.reason || '军令未成'));
    return res;
  }

  // 每回合一次（回合推进之后、民变案判定之后、游击连带之前）
  function tick(G, ctx) {
    var R = RC();
    if (!G || !R) return null;
    var turn = num(G.turn, 0);
    var store = typeof R.ensureStore === 'function' ? R.ensureStore(G) : null;
    if (store && store.suppressTick === turn) return null;   // 同一回合只走一次：重跑、读档不重扣
    var leaves = R.realmLeaves(G), byId = {};
    leaves.forEach(function (L) { byId[str(L.node.id)] = L; });
    function leafFor(r) { return byId[str(r.divisionId)] || leafOf(G, r, leaves); }
    var stat = { turn: turn, armies: 0, battles: 0, broken: 0, settled: 0, rebelsMoved: 0 };
    var revs = arr(G.minxin && G.minxin.revolts).filter(isBand);
    // 1. 别处了结的（旧五级梯自散、受抚、赈散、一致性补录判平）先善后
    revs.forEach(function (r) { if (r.status !== 'ongoing' && settle(G, r, leafFor(r))) stat.settled++; });
    // 2. 在的：立军、对账、走剿令
    revs.forEach(function (r) {
      if (r.status !== 'ongoing') return;
      var L = leafFor(r);
      var a = ensureArmy(G, r, L, leaves);
      if (!a) return;
      stat.armies++;
      syncBand(G, r, L, a);
      var n0 = r.suppress ? arr(r.suppress.battles).length : 0;
      if (L) stepOrder(G, r, L, a, leaves);
      if (r.suppress && arr(r.suppress.battles).length > n0) stat.battles++;
      // 不论什么缘故能打的几乎没了（推演给的战果打光的、别处减的）：散
      var peak = num(r.band && r.band.peak, 0);
      if (r.status === 'ongoing' && (gone(a) || soldiersOf(a) <= peak * CFG.collapseBelow)) {
        breakBand(G, r, L, { verdict: '小胜', by: '官军', endedBy: 'collapse' });
      }
      if (r.status !== 'ongoing') { stat.broken++; if (settle(G, r, L)) stat.settled++; }
    });
    // 3. 「从乱」对账
    stat.rebelsMoved = reconcileRebels(G, leaves);
    if (store) store.suppressTick = turn;
    return stat;
  }

  TM.RevoltSuppress = {
    CFG: CFG, SOURCE: SOURCE, BATTLE_SOURCE: BATTLE_SOURCE,
    tick: tick, ensureArmy: ensureArmy, bandArmy: bandArmy, order: order, fromAI: fromAI, candidates: candidates,
    settle: settle, statusText: statusText, panelHtml: panelHtml, orderFromUI: orderFromUI
  };
})(typeof window !== 'undefined' ? window : globalThis);
