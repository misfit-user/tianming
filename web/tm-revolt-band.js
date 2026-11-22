// @ts-check
// ============================================================
// tm-revolt-band.js — 民变的军与账（民变重做·民2d-1 起事立军；11-15「收口」改成只管这股的军与人数账）
//
// 同志 11-15：「民变是治理的一部分」——不设专用面板、专用按钮，不另起机制。剿、抚、赈都从诏令进，推演判，代码记账
//   （docs/guanben-roleplay-20260930/minbian.md「新的样子」）。本模块只管民变自己特有的那几样：
//   - 起事即立一支军（同志 11-14 定）：民变案落地的每一股（tm-revolt-rising.js，source 'revolt-cases'）在军册（GM.armies）里
//     有一支「某某部」，归「民变」（还不是势力；攻下城才成势，见下），驻它盘踞的那一州。能打仗的人＝这股人数 × 本州丁口比
//     （丁/口；丁口数不全取全国的），其余照旧式流民军：士气 55、训练 35、补给 45、乌合。首领领兵——真人。
//   - 打：官军与这股交战跟别的仗一样，由推演报战果（battleResult，这一方的势力写「民变」），战果写口照记伤亡、溃散、
//     首领下场（tm-military.js applyBattleResult；战果认民变的军在 tm-battle-contract.js）。
//   - 了结：这股的军打没了、溃散了；或推演说剿平（revolt_suppress、补录「镇压」）、受抚（revolt_amnesty、补录「招抚」）、
//     自散（revolt_transform dissolved）。首领去向取推演给的（战果里的 commanderFate、剿平时的 leaderFate），没给当脱身。
//     剿平的接皇威（平乱，与旧平乱同一条规矩）。
//   - 人数落账：这股军里少了的能战之人记死（本州口数、丁数减），随之少的老弱妇孺记逃散（挪进本州逃户），都从本州「从乱」里扣；
//     了结时剩下的人——剿平的、溃散的、自散的进本州逃户，受抚的、赈散的回籍——也从「从乱」里扣。
//   - 推演要看得到：每回合提示词里列各股实情（promptBlock：首领、人数、在哪州、本州主官、这股的军、附近的官军）。
//   - 成势（11-18）：这股的军打赢、占了城，当即立成真势力（establish）——名号、领袖、军、城、宣战、从乱的人，见该段注释。
//   - 删旧（11-21，同志「按你推荐来」）：旧的五级梯、实体三件套、起旗号与每回合动作、旧账 GM._activeRevolts、流寇池整个删了。
//     旧档里的那些读档后第一次过回合折一次（convertLegacy）；民变表「只留最近 30 条已了结的」从五级梯挪到这里（善后之后）；
//     「民心回升就有 5% 自散」不留——这股了结只认推演判的和军打没了。谋叛的在任官员、将帅、宗室据州自立（secede）与成势共用立势力那几步（standUp）。
// 民2d-1 原先的剿令（玩家选军「发兵剿」、推演说镇压就派最近一支、行军、挂仗、战斗引擎结算、读战果定散不散、首领去向掷骰）
//   在 11-15 收口时拆掉：剿的胜负跟别的仗一样由推演判（同志定「甲」）。
// 挂在过回合 6.1455（tm-endturn-systems.js：民变案判定之后、游击连带之前）。
// ============================================================
(function (global) {
  'use strict';
  var TM = global.TM = global.TM || {};

  var CFG = {
    soldierRateFallback: 0.25,          // 〔初值〕丁口数都不全时，这股人里能打仗的比重
    soldierRateMin: 0.05, soldierRateMax: 0.6,
    morale: 55, training: 35, supply: 45,   // 旧式流民军同值（旧三件套 tm-revolt-entity.js，11-21 删）
    collapseBelow: 0.05,                // 〔初值〕不论什么缘故，这股能打的剩不到最多时的这个比重，这股就散了
    promptMax: 12,                      // 提示词里最多列几股（人多的在前）
    nearbyMax: 3,                       // 每股列几支附近的官军
    keepEnded: 30,                      // 民变表里已了结的只留最近这么多条（原在五级梯里，11-21 挪来）
    faction: '民变'
  };
  var SOURCE = 'revolt.band';            // 军册上这类军的来源
  var LEGACY_BATTLE_SOURCE = 'revolt-suppress';   // 民2d-1 剿令挂的仗（收口后不再挂；旧档里没结的撤掉）

  function arr(v) { return Array.isArray(v) ? v : []; }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function str(v) { return v == null ? '' : String(v); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function RC() { return TM.RevoltCases || null; }
  function eb(cat, text) {
    if (typeof global.addEB !== 'function') return;
    try { global.addEB(cat, text, { credibility: 'high' }); } catch (_) {}
  }

  function isBand(r) { return !!(r && r.source === 'revolt-cases'); }
  function gone(a) { return !a || a.destroyed === true || a.disbanded === true || a.state === 'disbanded'; }
  function routed(a) { return !!(a && (a.routed === true || a.state === 'routed')); }
  function soldiersOf(a) { return Math.max(0, num(a && (a.soldiers != null ? a.soldiers : a.strength), 0)); }

  function ongoingBands(G) {
    return arr(G && G.minxin && G.minxin.revolts).filter(function (r) { return r && r.status === 'ongoing' && isBand(r); });
  }
  function findChar(G, id, name) {
    var list = arr(G.chars), i;
    if (id != null && id !== '') for (i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    if (name) for (i = 0; i < list.length; i++) if (list[i] && list[i].name === name) return list[i];
    return null;
  }
  function leafOf(G, r, leaves) {
    var R = RC();
    if (!R || !r) return null;
    leaves = leaves || R.realmLeaves(G);
    for (var i = 0; i < leaves.length; i++) if (str(leaves[i].node.id) === str(r.divisionId)) return leaves[i];
    return r.region ? R.placeLeaf(G, r.region, leaves) : null;
  }
  function provinceOf(L) { var p = L && L.chain[L.chain.length - 1]; return p && p !== L.node ? p : null; }
  function place(r) { return (r.province ? str(r.province) + '·' : '') + str(r.region || '某地'); }

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

  // 起事即立一支军（同志 11-14 定）：民变落地时调（tm-revolt-rising.js land），过回合再补一遍（落地时本模块缺席的旧档）。
  //   立过的（r.band 在）不复立：军打没了、被撤了，这股在 tick 里了结
  function ensureArmy(G, r, L, leaves) {
    if (!G || !isBand(r) || r.status !== 'ongoing') return null;
    var a = bandArmy(G, r);
    if (a || r.band) return a;
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
    G.armies.push(a);   // arch-ok 民变案每股一支军（民2d-1）·形状照旧式流民军
    r.band = {
      armyId: a.id, rate: Math.round(rate * 1000) / 1000, peak: n, last: n,
      followersAt: Math.max(0, Math.round(num(r.followers, 0))), dead: 0, scattered: 0, createdTurn: turn
    };
    return a;
  }

  // ── 军与人对账：军里少了的能战之人记死，随之少的老弱记逃散，都从本州「从乱」里扣 ──
  // 军只在交战里减；别处给它加的兵不认（人数按户口算，不取叙事报的数），拉回这股人数折的兵数。
  // 这股驻在它那一州（游击不挪州），别处把它挪走的拉回来。
  function syncBand(G, r, L, a) {
    var b = r.band;
    if (!b) return null;
    var out = { lost: 0, dead: 0, scattered: 0 };
    var followers = Math.max(0, Math.round(num(r.followers, num(r.scale, 0))));
    var now = gone(a) ? 0 : soldiersOf(a), last = Math.max(0, num(b.last, now));
    if (now < last && last > 0) {
      // 军整个从军册没了（不是打没的，说不清怎么没的）：人都记逃散，不记死
      var lostF = Math.min(followers, Math.round(followers * (last - now) / last));
      var dead = a ? Math.min(lostF, last - now) : 0, scattered = lostF - dead;
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
    if (!gone(a) && !routed(a) && r.region && (a.location !== r.region || a.garrison !== r.region)) {
      a.location = str(r.region); a.garrison = str(r.region); a.state = 'field'; a.destination = '';
    }
    b.last = now; b.followersAt = followers;
    if (now > num(b.peak, 0)) b.peak = now;
    return out;
  }

  // ── 首领去向：推演给的（战果的 commanderFate、剿平时的 leaderFate），没给当脱身 ──
  function fateWord(v) {
    var s = str(v).trim();
    if (!s) return '';
    if (/captur|surrender|擒|俘|获|降|下狱/i.test(s)) return 'captured';
    if (/kill|dead|die|斩|杀|诛|死|殁/i.test(s)) return 'killed';
    return 'escaped';
  }
  // 推演报的仗在回合推进之前落账（主推演），或推进之后（军事子调用排在回合后），本模块在推进之后跑：
  //   上一回合号到本回合号之间落的，都算「这一回合的仗」
  function recent(G, t) { t = num(t, -99); var now = num(G.turn, 0); return t >= now - 1 && t <= now; }
  // 这一回合战果写口落在首领身上的下场（tm-military.js applyBattleResult：_battleFate / _battleFateTurn，阵亡的 alive=false）
  function battleFate(G, r) {
    var ch = findChar(G, r.leaderId, r.leaderName);
    if (!ch) return '';
    if (ch.alive === false || ch.dead === true) return 'killed';
    if (!recent(G, ch._battleFateTurn)) return '';
    return fateWord(ch._battleFate);
  }

  function remember(ch, text) {
    var NM = global.NpcMemorySystem;
    if (!ch || !NM || typeof NM.addMemory !== 'function') return;
    try { NM.addMemory(ch.name, text, 9, 'career'); } catch (_) {}
  }

  function applyFate(G, r, fate, by) {
    var ch = findChar(G, r.leaderId, r.leaderName);
    if (!ch) return 'gone';
    var turn = num(G.turn, 0), who = str(by) || '官军', where = str(r.region) || '某地';
    if (fate === 'killed') {
      var why = '聚众作乱于' + where + '，为' + who + '所斩';
      if (ch.alive !== false && ch.dead !== true && typeof global.applyOneDeath === 'function') {
        try { global.applyOneDeath({ name: ch.name, characterId: ch.id, reason: why }); } catch (_) {}
      }
      // 阵亡的（战果写口只落 alive=false）与 applyOneDeath 缺席的都补齐
      if (ch.dead !== true) { ch.alive = false; ch.dead = true; if (ch.deathTurn == null) ch.deathTurn = turn; if (!ch.deathReason) ch.deathReason = why; }
      return 'killed';
    }
    if (ch.alive === false || ch.dead === true) return 'gone';
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

  // 民2d-1 的剿令（r.suppress）收口后不再走：旧档里还挂着的作罢
  function retireOrder(G, r) {
    var s = r.suppress;
    if (!s || !s.status || s.status === 'done') return;
    s.status = 'done'; s.end = 'retired'; s.endedTurn = num(G.turn, 0); s.battleId = null;
  }

  var FATE_TEXT = { captured: '，首领{n}被擒', killed: '，首领{n}伏诛', escaped: '，首领{n}脱身潜逃', gone: '' };

  // 这股了结（推演判的、军打没了的都走这里）。how.status：suppressed 剿平 / appeased 受抚 / dispersed 自散
  function end(G, r, how) {
    how = how || {};
    var turn = num(G.turn, 0), kind = how.status === 'appeased' || how.status === 'dispersed' ? how.status : 'suppressed';
    var name = str(r.leaderName) || '民变', ch = findChar(G, r.leaderId, r.leaderName), where = str(r.region) || '某地';
    r.status = kind; r.endedTurn = turn; r.endedBy = str(how.endedBy) || kind;
    var fate = '', text;
    var left = Math.max(0, Math.round(num(r.followers, 0)));
    if (kind === 'suppressed') {
      r._suppressed = true; r.suppressedTurn = turn;
      fate = applyFate(G, r, how.fate || 'escaped', how.by);
      huangwei(r);
      text = (str(how.by) || '官军') + '剿平' + name + '一股' + FATE_TEXT[fate].replace('{n}', name) + (left ? '，余众约 ' + left + ' 人四散' : '');
    } else if (kind === 'appeased') {
      fate = ch && ch.alive !== false && ch.dead !== true ? 'appeased' : 'gone';
      if (fate === 'appeased') {
        remember(ch, '聚众起事于' + where + '，受朝廷招抚');
        ch._revoltAppeasedTurn = turn;   // 受过抚的，日后起事不由代码再挑他当首领（复叛由推演点名，见 RevoltRising.pickLeader）
      }
      text = name + '一股受抚' + (left ? '，众约 ' + left + ' 人各归原籍' : '');
    } else {
      fate = ch && ch.alive !== false && ch.dead !== true ? 'escaped' : 'gone';
      if (fate === 'escaped') remember(ch, '聚众起事于' + where + '，其众自散，脱身潜逃');
      text = name + '一股自行溃散' + (left ? '，众约 ' + left + ' 人四散' : '');
    }
    r.leaderFate = fate;
    retireOrder(G, r);
    eb('民变', '【' + place(r) + '】' + text);
    return fate;
  }

  // ── 了结了的善后（剿平的、军打没了的、受抚的、自散的都走这里，一股只走一次）──
  //   剩下的人从本州「从乱」里扣：受抚、赈散的回籍，其余进本州逃户；军从军册撤掉；首领不再挂着这股。
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
    retireOrder(G, r);
    var ch = findChar(G, r.leaderId, r.leaderName);
    if (ch && ch._revoltLeaderOf === r.id) delete ch._revoltLeaderOf;
    arr(r.lieutenantIds).forEach(function (id) { var x = findChar(G, id, null); if (x && x._revoltLieutenantOf === r.id) delete x._revoltLieutenantOf; });
    r.settled = { turn: turn, n: n, to: home ? 'registered' : 'fugitives' };
    return r.settled;
  }

  // 州里「从乱」比在的各股人数多（散了没善后、出了档的旧股），多出的挪进本州逃户——从乱只有民变落地在写（tm-revolt-rising.js）
  function reconcileRebels(G, leaves) {
    var live = {};
    ongoingBands(G).forEach(function (r) {
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

  // ── 成势：这股的军打赢、占了城，当即立成真势力（同志 11-15「攻下一座城就算成势」；11-18 定的几样见 minbian.md「成势」）──
  //   战果写口（tm-battle-contract.js）不替民变落城，只在那一仗的记录上写明哪几支民变的军占了哪几城（bandOccupied）。
  //   这里据此：名号取推演在「建政」（revolt_transform toFaction）里起的，没起用首领的名字；首领当领袖（首领死了、下狱了挑在世的骨干）；
  //   势力立进势力册（FactionMembership.createFaction，与主推演 faction_create 同一个写口）；军改归它；城走易主写口；
  //   朝廷以「平叛讨逆」宣战，城原属别家的也与那家开战；从乱的人随城归新势力——打下的城不在本州，随军挪进那州。
  //   这股了结，记「成势」。此后就是普通势力：攻城、进兵、打到京师都走通用战争，攻下京师走破京裁决（tm-capital-fall.js）。
  var CHENGSHI = { courtCB: 'rebellion', otherCB: 'border', economy: 15, relation: -80 };

  // 这一回合（上一回合号到本回合号之间）的战报里，这股的军打赢、占了城的
  function tookCities(G, a) {
    if (!a || gone(a) || routed(a)) return null;
    var id = str(a.id), cityIds = [], battleIds = [];
    arr(G.battleHistory).forEach(function (row) {
      var occ = row && row.bandOccupied;
      if (!occ || !recent(G, row.turn) || arr(occ.armyIds).map(str).indexOf(id) < 0) return;
      arr(occ.cityIds).forEach(function (c) { if (cityIds.indexOf(str(c)) < 0) cityIds.push(str(c)); });
      battleIds.push(str(row.battleId));
    });
    return cityIds.length ? { cityIds: cityIds, battleIds: battleIds } : null;
  }
  function usable(ch) { return !!(ch && ch.alive !== false && ch.dead !== true && !ch._imprisoned); }
  function newLeader(G, r) {
    var ch = findChar(G, r.leaderId, r.leaderName);
    if (usable(ch)) return ch;
    var ids = arr(r.lieutenantIds);
    for (var i = 0; i < ids.length; i++) { var x = findChar(G, ids[i], null); if (usable(x)) return x; }
    return null;
  }
  function findFaction(G, name) { return arr(G.facs).filter(function (f) { return f && f.name === name; })[0] || null; }
  // 推演本回合先用 faction_create 立了同名的空壳（没兵没地）就认它，免得一股立出两个势力
  function shellFaction(G, f, turn) {
    if (!f || f.isPlayer || num(f._createdTurn, -99) < turn - 1) return false;
    if (arr(G.armies).some(function (x) { return x && !gone(x) && (x.faction === f.name || (f.id != null && str(x.factionId) === str(f.id))); })) return false;
    var FM = TM.FactionMembership;
    return !(FM && typeof FM.getProvinces === 'function' && FM.getProvinces(f.name).length);
  }
  function establishName(G, r, leader) {
    var turn = num(G.turn, 0), hint = r._factionNameHint ? str(r._factionNameHint.name).trim() : '';
    var base = str(r.leaderName) || (leader ? str(leader.name) : '') || (str(r.region) + '民变');
    var names = [hint, base, base + '部众', str(r.region) + base].filter(Boolean);
    for (var i = 0; i < names.length; i++) {
      var f = findFaction(G, names[i]);
      if (!f) return { name: names[i] };
      if (shellFaction(G, f, turn)) return { name: names[i], adopt: f };
    }
    return { name: base + '·' + str(r.id).slice(-4) };
  }
  function captureErr(e, where) {
    try { if (TM.errors && typeof TM.errors.captureSilent === 'function') TM.errors.captureSilent(e, where); } catch (_) { /* 记错本身失败：只是少一条错误记录 */ }
  }

  // 推演在「建政」里给这股起的名号：只记下，这股的军攻下城时用（同志 11-15「攻下一座城就算成势」：没占城不立）
  function nameHint(G, revoltId, name) {
    var r = G ? findBand(G, { revoltId: revoltId }) : null;
    name = str(name).trim();
    if (!r || !name) return { handled: false };
    r._factionNameHint = { name: name.slice(0, 20), turn: num(G.turn, 0) };
    return { handled: true, revoltId: r.id };
  }

  // ── 起事立成一方势力的那几步（成势与谋叛据州自立共用，11-21 从成势里抽出）──
  //   立进势力册（FactionMembership.createFaction，与主推演 faction_create 同一个写口；推演同回合先立的空壳就认它）、领袖入籍；
  //   军改归；人入籍；城走易主写口；朝廷以「平叛讨逆」宣战，城原属别家的也与那家开战。
  //   spec：joinTo 已有的势力（同一仗几股一起打赢的，后面的并进先成势的那家：不另立）；否则 name、adopt、type、leader、territory、
  //         strength、militaryStrength、events、extra、why（立势力的缘由）。cities（regionInfo 列）、armies、members、reason、declare（宣不宣战）
  function standUp(G, spec) {
    var FM = TM.FactionMembership, fac = spec.joinTo || null, reason = str(spec.reason) || '起事立势力';
    if (!fac && spec.adopt) {
      fac = spec.adopt;
      Object.keys(spec.extra || {}).forEach(function (k) { fac[k] = spec.extra[k]; });
      fac.historicalEvents = arr(fac.historicalEvents).concat(arr(spec.events));
      var leader = spec.leader;
      if (leader && !fac.leader) {
        var NV = TM.AIChange && TM.AIChange.Narrative;
        if (NV && typeof NV.setFactionLeader === 'function') NV.setFactionLeader(fac, leader.id || leader.name, G, reason);
        else { fac.leader = leader.name; if (leader.id != null) fac.leaderId = leader.id; }   // 领袖写口缺席（裸跑）时
        FM.assignChar(leader, fac.name, { reason: reason + '·领袖入籍', targetFactionId: fac.id });
      }
    } else if (!fac) {
      var made = FM.createFaction({
        name: spec.name, type: spec.type, leader: spec.leader, territory: spec.territory,
        strength: spec.strength, militaryStrength: spec.militaryStrength, economy: CHENGSHI.economy,
        attitude: '敌对', playerRelation: CHENGSHI.relation,
        reason: spec.why, historicalEvents: spec.events, extra: spec.extra
      }, { reason: reason });
      if (!made.ok) return { fail: str(made.reason) || 'create' };
      fac = made.faction;
    }
    var out = { faction: fac, wars: [], losers: [] };
    arr(spec.armies).forEach(function (a) { if (a) FM.assignArmy(a, fac.name, { reason: reason, targetFactionId: fac.id }); });
    arr(spec.members).forEach(function (x) {
      if (usable(x) && x.faction !== fac.name) FM.assignChar(x, fac.name, { reason: reason, targetFactionId: fac.id });
    });
    // 城走易主写口（城原属谁先记下，好宣战）。城的主人以地块、区划为准；旧的城表 GM.cities 是兼容期的另一份，没有成员写口，这里不另写
    var cities = arr(spec.cities);
    cities.forEach(function (c) { if (c.owner && c.owner !== fac.name && out.losers.indexOf(c.owner) < 0) out.losers.push(c.owner); });
    try {
      FM.applyProvinceTransfers(cities.filter(function (c) { return c.owner !== fac.name; })
        .map(function (c) { return { regionRef: c.id, newOwner: str(fac.id != null ? fac.id : fac.name), reason: reason }; }), { reason: reason });
    } catch (e) { captureErr(e, 'RevoltBand.standUp.transfer'); out.transferError = str(e && e.message || e).slice(0, 120); }
    // 宣战：朝廷讨逆；失城的别家也开战
    var CB = global.CasusBelliSystem, pf = playerFactionName(G);
    if (spec.declare && CB && typeof CB.declareWar === 'function') {
      [pf].concat(out.losers).forEach(function (foe) {
        if (!foe || foe === fac.name || out.wars.indexOf(foe) >= 0) return;
        try { var res = CB.declareWar(foe, fac.name, foe === pf ? CHENGSHI.courtCB : CHENGSHI.otherCB); if (res && res.success) out.wars.push(foe); }
        catch (e) { captureErr(e, 'RevoltBand.standUp.war'); }
      });
    }
    return out;
  }
  function writersReady(FM) {
    return !!(FM && typeof FM.createFaction === 'function' && typeof FM.regionInfo === 'function' && typeof FM.applyProvinceTransfers === 'function'
      && typeof FM.assignArmy === 'function' && typeof FM.assignChar === 'function');
  }

  function establish(G, r, L, a, took) {
    var FM = TM.FactionMembership, turn = num(G.turn, 0);
    if (!writersReady(FM)) return null;
    // 1. 认城：认得出的才算；一座都认不出，城没处落，不成势
    var cities = [];
    took.cityIds.forEach(function (ref) {
      var info = FM.regionInfo(ref);
      if (info && !cities.some(function (c) { return c.id === info.id; })) cities.push(info);
    });
    if (!cities.length) { r._chengshiMiss = { turn: turn, cityIds: took.cityIds.slice() }; return null; }
    var cityNames = cities.map(function (c) { return c.name; }).join('、');
    // 同一仗里几股一起打赢的：先成势的那股立了势力，后面的并进去（城已归它）
    var joined = cities.map(function (c) { return findFaction(G, c.owner); })
      .filter(function (f) { return f && f._fromRevolt && f._fromRevolt !== r.id && num(f._createdTurn, -99) >= turn - 1; })[0] || null;
    // 2. 立势力、军改归、首领骨干入籍、城易主、朝廷讨逆（standUp）
    var leader = newLeader(G, r);
    var members = arr([findChar(G, r.leaderId, r.leaderName)]).concat(arr(r.lieutenantIds).map(function (id) { return findChar(G, id, null); })).filter(Boolean);
    var spec = { cities: cities, armies: [a], members: members, reason: '民变成势', declare: !joined };
    if (joined) spec.joinTo = joined;
    else {
      var pick = establishName(G, r, leader);
      spec.name = pick.name; spec.adopt = pick.adopt || null; spec.type = '义军'; spec.leader = leader; spec.territory = cityNames;
      spec.strength = clamp(Math.round(soldiersOf(a) / 500), 5, 60); spec.militaryStrength = soldiersOf(a);
      spec.why = place(r) + '民变攻下' + cityNames + '，立号' + pick.name;
      spec.events = [{ turn: num(r.turn, turn), event: '起事', impact: str(r.cause).slice(0, 40) }, { turn: turn, event: '成势', impact: '攻下' + cityNames }];
      spec.extra = { capital: cities[0].name, capitalName: cities[0].name, _fromRevolt: r.id, _fromRevoltCase: str(r.caseId) };
    }
    var up = standUp(G, spec);
    if (!up || up.fail) { r._chengshiMiss = { turn: turn, reason: up ? up.fail : 'standUp' }; return null; }
    var fac = up.faction, wars = up.wars;
    if (up.transferError) r._chengshiTransferError = up.transferError;
    // 3. 军不再是民变的军，驻打下的城；首领、骨干不再挂着这股
    delete a._revoltBand;
    a.source = 'revolt.established'; a.location = cities[0].name; a.garrison = cities[0].name; a.destination = '';
    members.forEach(function (x) {
      if (x._revoltLeaderOf === r.id) delete x._revoltLeaderOf;
      if (x._revoltLieutenantOf === r.id) delete x._revoltLieutenantOf;
    });
    // 4. 从乱的人随城归新势力：本州打下了，人就在那州里（不再算从乱）；打下的是别州，随军挪进那州
    var n = Math.max(0, Math.round(num(r.followers, 0))), fighters = Math.min(n, soldiersOf(a));
    var pdFrom = L && L.node.populationDetail, ownTaken = !!(L && cities.some(function (c) { return c.division === L.node; }));
    var dest = !ownTaken && cities[0].division ? cities[0].division.populationDetail : null, moved = 0;
    if (pdFrom) pdFrom.rebels = Math.max(0, num(pdFrom.rebels, 0) - n);
    if (pdFrom && dest && n > 0) {
      moved = Math.min(n, Math.max(0, num(pdFrom.mouths, 0)));
      pdFrom.mouths = num(pdFrom.mouths, 0) - moved; dest.mouths = num(dest.mouths, 0) + moved;
      var d = Math.min(fighters, Math.max(0, num(pdFrom.ding, 0)));
      if (d > 0) { pdFrom.ding = num(pdFrom.ding, 0) - d; dest.ding = num(dest.ding, 0) + d; }
    }
    // 5. 这股了结：成势
    r.status = 'established'; r.endedTurn = turn; r.endedBy = 'establish';
    r.establishedFaction = fac.name; r.establishedFactionId = fac.id != null ? fac.id : fac.name;
    r.leaderFate = leader ? 'established' : 'gone';
    r.settled = { turn: turn, n: n, to: 'faction', faction: fac.name, moved: moved };
    retireOrder(G, r);
    if (leader) remember(leader, '聚众起事于' + (str(r.region) || '某地') + '，攻下' + cityNames + '，' + (joined ? '归「' + fac.name + '」' : '立号「' + fac.name + '」'));
    eb('民变', '【' + place(r) + '】' + (str(r.leaderName) || '民变') + '一股攻下' + cityNames + '，'
      + (joined ? '并入「' + fac.name + '」' : '立号「' + fac.name + '」，成一方势力' + (leader ? '，' + str(leader.name) + '为首' : ''))
      + (n ? '，众约 ' + n + ' 人随附' : ''));
    return { faction: fac, cities: cities, joined: !!joined, wars: wars, moved: moved };
  }

  // ── 据州自立（谋叛聚众的在任官员、将帅、宗室；同志 11-21 删旧第 3 问「甲」，tm-conspiracy.js 调）──
  //   在他所在的那一州立一方势力，与成势同一套（standUp）：州随他走（易主写口），他领的玩家一方的军随他走，朝廷以「平叛讨逆」宣战；
  //   他在朝廷这边的官职出缺（PostTransfer.cascadeVacate，与罢官、下狱同一个口子）。名号用他的名字。
  //   不立、交调用方记事泄出奔的：所在落不到本朝州县；在京——京城那一州归谁由破京判（tm-capital-fall.js），谋叛不能当场破京。
  function secede(G, who, opts) {
    opts = opts || {};
    var R = RC(), FM = TM.FactionMembership, turn = num(G && G.turn, 0);
    if (!G || !R || !writersReady(FM)) return { ok: false, why: '写口缺席' };
    if (!usable(who)) return { ok: false, why: '人不在' };
    var L = opts.leaf || R.placeLeaf(G, str(opts.place || who.location), R.realmLeaves(G));
    var city = L ? FM.regionInfo(L.node.id) : null;
    if (!city) return { ok: false, why: '所在落不到本朝州县' };
    var CF = TM.CapitalFall, cap = null;
    try { cap = CF && typeof CF.capitalInfo === 'function' ? CF.capitalInfo(G) : null; } catch (e) { captureErr(e, 'RevoltBand.secede.capital'); }
    if (cap && (cap.id === city.id || (cap.division && cap.division === city.division))) return { ok: false, why: '在京' };
    var pf = playerFactionName(G);
    var armies = arr(G.armies).filter(function (a) {
      if (!a || gone(a) || a._revoltBand) return false;
      var his = str(a.commander) === str(who.name) || (who.id != null && a.commanderId != null && str(a.commanderId) === str(who.id));
      return his && factionName(G, a.faction || a.factionId) === pf;
    });
    var soldiers = armies.reduce(function (s, a) { return s + soldiersOf(a); }, 0);
    var PT = global.PostTransfer;
    if (PT && typeof PT.cascadeVacate === 'function') { try { PT.cascadeVacate(who.name); } catch (e) { captureErr(e, 'RevoltBand.secede.vacate'); } }
    var name = '', tries = [str(who.name), str(who.name) + '部众', str(city.name) + str(who.name)];
    for (var i = 0; i < tries.length && !name; i++) if (!findFaction(G, tries[i])) name = tries[i];
    if (!name) name = str(who.name) + '·' + turn;
    var cause = str(opts.cause).trim().slice(0, 40);
    var up = standUp(G, {
      name: name, type: '割据', leader: who, territory: city.name, cities: [city], armies: armies, members: [who],
      strength: clamp(Math.round(soldiers / 500), 5, 60), militaryStrength: soldiers,
      why: str(who.name) + '据' + city.name + '自立' + (cause ? '（' + cause + '）' : ''),
      events: [{ turn: turn, event: '据州自立', impact: cause || ('据' + city.name) }],
      extra: { capital: city.name, capitalName: city.name, _secededTurn: turn, _secededFrom: pf, _secededBy: str(opts.by) },
      reason: '据州自立', declare: true
    });
    if (!up || up.fail) return { ok: false, why: '立势力不成：' + str(up ? up.fail : 'standUp') };
    var fac = up.faction;
    remember(who, '据' + city.name + '自立，号「' + fac.name + '」');
    eb('叛乱', '【' + city.name + '】' + str(who.name) + '据州自立，号「' + fac.name + '」'
      + (soldiers ? '，所部约 ' + soldiers + ' 人随之' : '') + (up.wars.indexOf(pf) >= 0 ? '；朝廷以平叛讨逆宣战' : ''));
    return { ok: true, faction: fac, city: city, armies: armies.length, soldiers: soldiers, wars: up.wars, transferError: up.transferError || '' };
  }

  // ── 旧档折算（删旧，同志 11-21「按你推荐来」）──
  //   旧的那一套（五级梯、实体三件套、起旗号与每回合动作、旧账 GM._activeRevolts、流寇池）11-21 整个删了；
  //   旧档读进来，第一次过回合时折一次（同一局只折一次，记在民变案的账上）：
  //   - 还在的旧式民变（民变表里不是民变案落地的）、旧账里没结局的：按它记的地方、首领名走民变案「推演点名起事」那个口子
  //     （TM.RevoltCases.riseFromAI，与主推演 class_revolt、一致性补录同一个）——落到本朝一州的折成一股新民变：首领先在档里找、
  //     找不到用这名字按出身新生，人数按本州户口算（不取旧的写死规模），军由本模块立；该州已有一股的就是那一股。
  //     落不到州的、首领是官员将帅宗室的、民族边疆宗室起事的，结掉，不生东西（兵变割据由推演照通用的 faction_create 写）。
  //   - 旧三件套立的义军势力、旧账「建政」立的没有真地盘的义军势力：没占城不算势力（同志 11-18 第 5 问），势力除档
  //     （TM.Factions.removeFaction：成员退籍、它的军撤掉、战事与占据清掉），首领照上面折成一股。剧本自带的起义一类势力不动。
  //   - 有名有姓的先折（他那一州归他领），没首领的旧式民变后折；有名有姓的那一州已有一股，他并进去当骨干（11-22 干跑查出：
  //     原先并进去的人闲着，又被挑去别州另领一股）。
  //   - 旧账挂在战事表里的（带 revoltId）撤掉；旧演绎层开的招抚谈判先作罢、问对里的使节求见撤掉，再除旧义军势力
  //     （除档按势力删谈判，管不到使节求见那一条，11-22 干跑查出）。
  //   - 流寇池撤掉，人「散归逃户」：旧代码凝流寇只扣全国逃户那个数，各州账上的逃户没动；全国逃户每回合户口同步按各州逃户重算
  //     （tm-huji-runtime-bridge.js），这些人本就还在各州逃户里，不再往全国数上加（加了是同步前多算一遍，11-22 干跑查出）。
  //   - 民变表里旧式的都撤掉（在的已折，了结的是旧账）：此后表里只有民变案的各股。
  function legacyLeaderName(r) {
    var idy = r && r._identity;
    return str((idy && idy.leaderName) || (r && (r._entityLeaderName || r.leaderName || r.leader))).trim();
  }
  // 有名有姓的首领那一州已有一股：他并进去当骨干（同 land 记骨干的办法），不再闲着被挑去别州另领一股
  function joinAsLieutenant(G, revoltId, name) {
    var r = ongoingBands(G).filter(function (x) { return x.id === revoltId; })[0];
    var ch = null;
    arr(G.chars).forEach(function (x) { if (!ch && x && x.name === name && x.alive !== false && x.dead !== true) ch = x; });
    if (!r || !ch || r.leaderId === ch.id || r.leaderName === ch.name) return false;
    var ids = arr(r.lieutenantIds);
    if (ids.indexOf(ch.id) >= 0) return false;
    r.lieutenantIds = ids.concat([ch.id]);
    r.lieutenantNames = arr(r.lieutenantNames).concat([str(ch.name)]);
    ch._revoltLieutenantOf = r.id;
    ch.location = str(r.region);   // 他那一伙本在这一州（同州才并）
    return true;
  }
  function convertLegacy(G) {
    var R = RC(), store = R && typeof R.ensureStore === 'function' ? R.ensureStore(G) : null;
    if (!G || !R || !store || store.legacyConverted != null) return null;
    var turn = num(G.turn, 0), mx = G.minxin = G.minxin || {};
    var out = { turn: turn, landed: 0, merged: 0, ended: 0, factions: 0, wars: 0, talks: 0, roving: 0, items: [] };
    var revs = arr(mx.revolts), ledger = arr(G._activeRevolts), done = {}, items = [], failed = 0;
    // 0. 旧演绎层的招抚谈判先作罢、使节求见撤掉（下面除旧义军势力时按势力删谈判，管不到问对里那条使节求见）
    var N = TM.Negotiation, lapsed = {};
    arr(G._negotiations).forEach(function (ng) {
      if (!ng || ng.status !== 'open' || ng.topic !== 'pacify') return;
      if (N && typeof N.resolve === 'function' && N.resolve(ng.id, 'lapsed')) { out.talks++; lapsed[ng.id] = 1; }
    });
    if (out.talks && typeof global._wdCleansePendingAudiences === 'function' && global.GM === G) {
      try { global._wdCleansePendingAudiences(function (q) { return !(q && q._negotiationId && lapsed[q._negotiationId]); }); }
      catch (e) { captureErr(e, 'RevoltBand.legacy.audiences'); }
    }
    // 1. 旧义军势力：旧三件套的（_revoltEntity）；旧账「建政」立的（带 _fromRevolt、不带成势记的 _fromRevoltCase）且没有真地盘的
    var RR = TM.RevoltRising, landed = RR && typeof RR.landedFactions === 'function' ? RR.landedFactions(G) : {}, Fx = TM.Factions;
    arr(G.facs).slice().forEach(function (f) {
      if (!f || f.isPlayer) return;
      var trio = !!f._revoltEntity;
      var fromLedger = !trio && f._fromRevolt != null && !Object.prototype.hasOwnProperty.call(f, '_fromRevoltCase') && !landed[str(f.name)];
      if (!trio && !fromLedger) return;
      // 除档不成的这一家留着，这一局不记「已折」，下回合再折（别的已折干净，再走一遍不重复）
      if (!Fx || typeof Fx.removeFaction !== 'function') { failed++; return; }
      var src = trio ? revs.filter(function (r) { return r && r.id === f.sourceRevoltId; })[0] : ledger.filter(function (r) { return r && r.id === f._fromRevolt; })[0];
      var who = trio ? legacyLeaderName(src) : str(f.leader).trim();
      var res = null;
      try {
        res = Fx.removeFaction(f.id != null ? f.id : f.name, {
          world: G, reason: '旧档折算·没占城不算势力', terminateWars: true, removeDiplomacy: true, clearTreaties: true,
          clearTruces: true, releaseOccupations: true, removeArmies: true
        });
      } catch (e) { captureErr(e, 'RevoltBand.legacy.removeFaction'); res = null; }
      if (!res || res.ok !== true) { failed++; return; }
      out.factions++;
      if (src) done[str(src.id)] = 1;
      items.push({ from: trio ? 'trio' : 'ledger-faction', id: str(src ? src.id : f.id), oldFaction: str(f.name), leaderName: who || str(f.leader),
        region: src ? str(src.region || arr(src.territoryControl)[0]) : str(f.territory), cause: src && src.cause, decl: trio ? null : src });
    });
    // 2. 还在的旧式民变
    revs.forEach(function (r) {
      if (!r || isBand(r) || r.status !== 'ongoing' || done[str(r.id)]) return;
      done[str(r.id)] = 1;
      items.push({ from: 'revolt', id: str(r.id), leaderName: legacyLeaderName(r), region: str(r.region), cause: r.cause });
    });
    // 3. 旧账里没结局的
    ledger.forEach(function (r) {
      if (!r || r.outcome || done[str(r.id)]) return;
      done[str(r.id)] = 1;
      items.push({ from: 'ledger', id: str(r.id), leaderName: str(r.leaderName), region: str(r.region || arr(r.territoryControl)[0]), decl: r });
    });
    // 4. 逐条走点名起事：有名有姓的先折（他那一州归他领），没首领的旧式民变后折（该州已有一股就并进去）
    var named = items.filter(function (it) { return !!it.leaderName; }), toIds = {};
    named.concat(items.filter(function (it) { return !it.leaderName; })).forEach(function (it) {
      var d = it.decl || {}, res = null;
      if (it.region) {
        try {
          res = R.riseFromAI(G, {
            by: 'legacy', region: it.region, leaderName: it.leaderName, secondaryLeaders: d.secondaryLeaders,
            className: d.class, ideology: d.ideology, organizationType: d.organizationType, religiousSect: d.religiousSect,
            slogan: d.slogan, demands: d.demands, historicalArchetype: d.historicalArchetype,
            reason: str(it.cause || d.slogan).trim() || '旧乱未平'
          });
        } catch (e) { captureErr(e, 'RevoltBand.legacy.rise'); res = null; }
      }
      var row = { from: it.from, id: it.id, region: it.region, leader: it.leaderName };
      if (it.oldFaction) row.oldFaction = it.oldFaction;
      if (res && res.landed) { out.landed++; row.to = res.revoltId; }
      else if (res && res.already) {
        out.merged++; row.to = res.revoltId; row.merged = true;
        if (it.leaderName && joinAsLieutenant(G, res.revoltId, it.leaderName)) row.joined = true;
      }
      else { out.ended++; row.why = res ? str(res.why) : '没记地方'; }
      if (row.to) toIds[row.to] = 1;
      out.items.push(row);
    });
    // 5. 旧账挂在战事表里的、旧账本身、流寇池
    if (Array.isArray(G.activeWars)) {
      var warsBefore = G.activeWars.length;
      G.activeWars = G.activeWars.filter(function (w) { return !(w && w.revoltId != null && w.revoltId !== ''); });   // arch-ok 旧档折算：撤旧账挂的战事（11-21 删旧）
      out.wars = warsBefore - G.activeWars.length;
    }
    if (Object.prototype.hasOwnProperty.call(G, '_activeRevolts')) delete G._activeRevolts;   // arch-ok 旧档折算：旧账撤掉（11-21 删旧）
    // 流寇池撤掉即散归逃户：这些人本就还在各州逃户里（全国逃户每回合按各州重算），只记个数进总账，不往全国数上加
    arr(G.rovingRebels).forEach(function (x) { if (x && !x.disbanded) out.roving += Math.max(0, Math.round(num(x.strength, 0))); });
    if (Object.prototype.hasOwnProperty.call(G, 'rovingRebels')) delete G.rovingRebels;   // arch-ok 旧档折算：流寇池撤掉（11-21 删旧）
    // 6. 民变表只留民变案的各股
    mx.revolts = arr(mx.revolts).filter(isBand);   // arch-ok 旧档折算：旧式民变撤出民变表（11-21 删旧）
    if (!failed) store.legacyConverted = turn;
    out.failed = failed;
    out.items = out.items.slice(0, 40);
    store.legacy = out;
    // 总账按「旧报几起、并作几股」说（11-22 干跑：天启旧局 33 起并作 15 股，原先写「32 股」与民变表对不上）
    var reports = out.landed + out.merged + out.ended, bandsNow = Object.keys(toIds).length, parts = [];
    if (bandsNow) parts.push('并作 ' + bandsNow + ' 股，有首有众、落到州县');
    if (out.ended) parts.push(out.ended + ' 起查无实据、销案');
    if (out.factions) parts.push('没有城池的旧义军 ' + out.factions + ' 家不再算势力，退为民变');
    if (out.roving) parts.push('流寇约 ' + out.roving + ' 众散归逃户');
    if (parts.length) eb('民变', '核实各地旧报民变' + (reports ? ' ' + reports + ' 起' : '') + '：' + parts.join('；'));
    return out;
  }

  // 民变表里已了结的只留最近 CFG.keepEnded 条（善后过的），进行中的一律留着（原在五级梯里，11-21 挪来）
  function pruneEnded(G) {
    var mx = G.minxin;
    if (!mx || !Array.isArray(mx.revolts)) return 0;
    var ended = mx.revolts.filter(function (r) { return r && r.status !== 'ongoing' && (!isBand(r) || r.settled); });
    if (ended.length <= CFG.keepEnded) return 0;
    var drop = ended.slice(0, ended.length - CFG.keepEnded);
    mx.revolts = mx.revolts.filter(function (r) { return r && drop.indexOf(r) < 0; });   // arch-ok 民变表只留最近的已了结（原五级梯那段）
    return drop.length;
  }

  // ── 推演判这股了结（revolt_suppress / revolt_amnesty / revolt_transform 按编号；一致性补录 record_revolt_events 按首领、州）──
  // 哪一股：给了编号只认编号；否则认首领；再认它说的那一州；
  //   只说到省的，在那一省各股里挑人多的。返回 { handled:false } 由调用方记一笔写回落空。
  function findBand(G, decl) {
    decl = decl || {};
    var bands = ongoingBands(G);
    if (!bands.length) return null;
    var id = str(decl.revoltId).trim();
    if (id) return bands.filter(function (r) { return r.id === id; })[0] || null;
    var who = str(decl.leader).trim();
    if (who) { var byName = bands.filter(function (r) { return r.leaderName === who; })[0]; if (byName) return byName; }
    var R = RC();
    if (!R || !str(decl.region).trim()) return null;
    var leaves = R.realmLeaves(G), L = R.placeLeaf(G, decl.region, leaves), pool = [];
    if (L) pool = bands.filter(function (r) { return str(r.divisionId) === str(L.node.id); });
    if (!pool.length) {
      var RR = TM.RevoltRising, provNode = L ? provinceOf(L) : null;
      pool = bands.filter(function (r) {
        var p = provinceOf(leafOf(G, r, leaves));
        if (!p) return false;
        if (L) return p === provNode;
        return !!(RR && RR.provinceHit(str(decl.region), R.baseName(p.name)));
      });
    }
    pool.sort(function (x, y) { return num(y.followers, 0) - num(x.followers, 0); });
    return pool[0] || null;
  }

  // decl：{ revoltId?, leader?, region?, status: 'suppressed'|'appeased'|'dispersed', leaderFate?, by?, reason? }
  function conclude(G, decl) {
    decl = decl || {};
    var r = G ? findBand(G, decl) : null;
    if (!r) return { handled: false };
    var fate = end(G, r, { status: decl.status, fate: fateWord(decl.leaderFate) || 'escaped', by: decl.by, endedBy: str(decl.endedBy) || 'ai' });
    return { handled: true, ok: true, revoltId: r.id, leaderName: str(r.leaderName), leaderFate: fate };
  }

  // ── 给推演看的各股实情（tm-endturn-ai.js 主推演提示词，「进行中的起义」旁）──
  function playerFactionName(G) {
    var MS = global.MilitarySystems;
    if (MS && typeof MS.battlePlayerFaction === 'function') { try { return str(MS.battlePlayerFaction(G)); } catch (_) { return ''; } }
    var pi = (global.P && global.P.playerInfo) || {};
    return str(pi.factionName || pi.factionId);
  }
  function factionName(G, ref) {
    var MS = global.MilitarySystems;
    if (MS && typeof MS.battleFactionName === 'function') { try { return str(MS.battleFactionName(ref, G)); } catch (_) { return str(ref); } }
    return str(ref);
  }
  // 附近的官军：玩家一方、驻在本州的、本省的（驻地按州认，认不出再按省名认），人多的在前
  function nearbyArmies(G, r, L, leaves, pf) {
    var R = RC(), RR = TM.RevoltRising, prov = provinceOf(L), provBase = prov && R ? R.baseName(prov.name) : '', out = [];
    if (!R || !pf) return out;
    arr(G.armies).forEach(function (a) {
      if (!a || a._revoltBand || gone(a) || soldiersOf(a) <= 0 || factionName(G, a.faction || a.factionId) !== pf) return;
      var loc = str(a.location || a.garrison), at = loc ? R.placeLeaf(G, loc, leaves) : null, rank = -1;
      if (at && at === L) rank = 0;
      else if (at && prov && provinceOf(at) === prov) rank = 1;
      else if (!at && provBase && RR && RR.provinceHit(loc, provBase)) rank = 1;
      if (rank >= 0) out.push({ a: a, rank: rank, loc: loc });
    });
    out.sort(function (x, y) { return (x.rank - y.rank) || (soldiersOf(y.a) - soldiersOf(x.a)); });
    return out.slice(0, CFG.nearbyMax);
  }
  function officialText(G, L) {
    var R = RC();
    if (!R || typeof R.official !== 'function' || !L) return '';
    var o = null;
    try { o = R.official(G, L, false); } catch (_) { o = null; }
    if (!o) return '';
    if (o.kind === 'vacant') return (o.post ? o.post : '本州主官') + '出缺';
    return (o.post ? o.post : '') + (o.name || '（档里无此人）');
  }

  function promptBlock(G) {
    var bands = ongoingBands(G);
    if (!bands.length) return '';
    var R = RC(), leaves = R ? R.realmLeaves(G) : [], pf = playerFactionName(G);
    bands = bands.slice().sort(function (x, y) { return num(y.followers, 0) - num(x.followers, 0); });
    var lines = ['', '', '【各地民变——民变案起事的各股（剿、抚、赈怎么落、成不成，按朝廷诏令与各方行事由你推演；人数按户口记账，不取叙事报的数）】'];
    bands.slice(0, CFG.promptMax).forEach(function (r) {
      var L = leafOf(G, r, leaves), a = bandArmy(G, r), ch = findChar(G, r.leaderId, r.leaderName);
      var s = '  [id=' + str(r.id) + '] ' + (str(r.leaderName) || '无名') + '·' + place(r) + '·起于第' + num(r.turn, 0) + '回合·众约 ' + Math.round(num(r.followers, 0)) + ' 人';
      if (a && !gone(a)) s += '，能战 ' + soldiersOf(a) + '（军「' + str(a.name) + '」，势力「' + CFG.faction + '」，士气 ' + Math.round(num(a.morale, 0)) + '）';
      if (arr(r.lieutenantNames).length) s += '·骨干：' + r.lieutenantNames.slice(0, 3).join('、');
      if (ch && (ch._imprisoned || ch.alive === false)) s += '·首领已' + (ch.alive === false ? '死' : '被擒');
      if (r.cause) s += '·起因：' + str(r.cause).slice(0, 30);
      if (r.slogan) s += '·号「' + str(r.slogan).slice(0, 20) + '」';
      var off = officialText(G, L);
      if (off) s += '·本州主官：' + off;
      var near = nearbyArmies(G, r, L, leaves, pf);
      s += '·附近官军：' + (near.length ? near.map(function (x) {
        return str(x.a.name) + ' ' + soldiersOf(x.a) + (x.a.commander ? '（帅' + str(x.a.commander) + '）' : '') + '驻' + (x.loc || '?') + (x.rank === 0 ? '·本州' : '·本省');
      }).join('；') : '本州本省无');
      lines.push(s);
    });
    if (bands.length > CFG.promptMax) lines.push('  ……另有 ' + (bands.length - CFG.promptMax) + ' 股人少的未列');
    lines.push('  ※ 官军与某股交战，照常写进 battleResult：这一方的势力填「' + CFG.faction + '」，军填上面的军名；伤亡、溃散（state:"routed"）、首领下场（commanderFate）照实写。');
    lines.push('  ※ 某股的军打赢并占了城（battleResult 照常写 occupiedCityIds），这股就立成一方势力：名号写在 revolt_transform（revoltId 填上面的 id，transformType:"toFaction"，newFactionName），不写就用首领的名字；不必另写 faction_create。成了势力以后与别的势力一样。');
    lines.push('  ※ 某股被剿平写 revolt_suppress（revoltId 填上面的 id，outcome:"victory"，leaderFate 写首领下场 captured被擒/killed伏诛/escaped脱身）；受抚写 revolt_amnesty（outcome:"accepted"；授首领什么官走 office_changes，赏银走 fiscal_adjustments）；自行溃散写 revolt_transform（transformType:"dissolved"）。没平、没抚、没散的不写，这股照旧在。');
    return lines.join('\n') + '\n';
  }

  // 一场仗里打破这股的是哪支军（本回合战果写口记的那一场，取对面那一方的军名）
  function breakerOf(G, a) {
    var id = a && a._battleResultBattleId;
    if (!id || !recent(G, a._battleResultTurn)) return '';
    var row = arr(G.battleHistory).filter(function (x) { return x && str(x.battleId) === str(id); }).slice(-1)[0];
    var foe = row && arr(row.affectedArmies).filter(function (e) { return e && str(e.armyId) !== str(a.id) && factionName(G, e.faction) !== CFG.faction; })[0];
    return foe ? str(foe.name || foe.armyId) : '';
  }

  // 每回合一次（回合推进之后、民变案判定之后、游击连带之前）
  function tick(G, ctx) {
    var R = RC();
    if (!G || !R) return null;
    var turn = num(G.turn, 0);
    var store = typeof R.ensureStore === 'function' ? R.ensureStore(G) : null;
    if (store && store.suppressTick === turn) return null;   // 同一回合只走一次：重跑、读档不重扣
    var stat = { turn: turn, armies: 0, broken: 0, settled: 0, rebelsMoved: 0, established: 0, pruned: 0, legacy: null };
    // 旧档折算（11-21 删旧）：读档后第一次过回合折一次；先折，折出来的各股下面照常立军、对账
    try { stat.legacy = convertLegacy(G); } catch (e) { captureErr(e, 'RevoltBand.convertLegacy'); }
    var leaves = R.realmLeaves(G), byId = {};
    leaves.forEach(function (L) { byId[str(L.node.id)] = L; });
    function leafFor(r) { return byId[str(r.divisionId)] || leafOf(G, r, leaves); }
    // 0. 民2d-1 剿令挂的仗，旧档里没结的撤掉（收口后剿的胜负由推演判）
    if (Array.isArray(G.activeBattles)) {
      for (var i = G.activeBattles.length - 1; i >= 0; i--) {
        var bt = G.activeBattles[i];
        if (bt && bt.source === LEGACY_BATTLE_SOURCE) G.activeBattles.splice(i, 1);
      }
    }
    var revs = arr(G.minxin && G.minxin.revolts).filter(isBand);
    // 1. 别处了结的（推演判的剿平、受抚、自散）先善后
    revs.forEach(function (r) { if (r.status !== 'ongoing' && settle(G, r, leafFor(r))) stat.settled++; });
    // 2. 在的：立军、对账；这回合打赢占了城的立成势力；军打没了、溃散了、能打的几乎没了，这股了结
    revs.forEach(function (r) {
      if (r.status !== 'ongoing') return;
      retireOrder(G, r);
      var L = leafFor(r);
      var a = ensureArmy(G, r, L, leaves);
      if (a) stat.armies++;
      syncBand(G, r, L, a);
      var took = tookCities(G, a);
      if (took && establish(G, r, L, a, took)) { stat.established++; return; }
      var peak = num(r.band && r.band.peak, 0);
      // 有一仗打破的（推演报的战果里这股的军溃散、打没了）算剿平，首领去向取战果的；查不到是哪一仗的（军被别处减没了、撤了）按自散
      if (r.band && (gone(a) || routed(a) || soldiersOf(a) <= peak * CFG.collapseBelow)) {
        var by = breakerOf(G, a);
        if (by) end(G, r, { status: 'suppressed', fate: battleFate(G, r) || 'escaped', by: by, endedBy: 'battle' });
        else end(G, r, { status: 'dispersed', endedBy: 'collapse' });
      }
      if (r.status !== 'ongoing') { stat.broken++; if (settle(G, r, L)) stat.settled++; }
    });
    // 3. 「从乱」对账
    stat.rebelsMoved = reconcileRebels(G, leaves);
    // 4. 民变表里已了结的只留最近的（善后过的）
    stat.pruned = pruneEnded(G);
    if (store) store.suppressTick = turn;
    return stat;
  }

  TM.RevoltBand = {
    CFG: CFG, SOURCE: SOURCE,
    tick: tick, ensureArmy: ensureArmy, bandArmy: bandArmy, settle: settle,
    findBand: findBand, conclude: conclude, promptBlock: promptBlock,
    nameHint: nameHint, establish: establish,
    standUp: standUp, secede: secede, convertLegacy: convertLegacy, pruneEnded: pruneEnded
  };
})(typeof window !== 'undefined' ? window : globalThis);
