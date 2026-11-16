// @ts-check
// ============================================================
// tm-revolt-band.js — 民变的军与账（民变重做·民2d-1 起事立军；11-15「收口」改成只管这股的军与人数账）
//
// 同志 11-15：「民变是治理的一部分」——不设专用面板、专用按钮，不另起机制。剿、抚、赈都从诏令进，推演判，代码记账
//   （docs/guanben-roleplay-20260930/minbian.md「新的样子」）。本模块只管民变自己特有的那几样：
//   - 起事即立一支军（同志 11-14 定）：民变案落地的每一股（tm-revolt-rising.js，source 'revolt-cases'）在军册（GM.armies）里
//     有一支「某某部」，归「民变」（还不是势力；攻下城成势在下一刀），驻它盘踞的那一州。能打仗的人＝这股人数 × 本州丁口比
//     （丁/口；丁口数不全取全国的），其余照旧式流民军（tm-revolt-entity.js）：士气 55、训练 35、补给 45、乌合。首领领兵——真人。
//   - 打：官军与这股交战跟别的仗一样，由推演报战果（battleResult，这一方的势力写「民变」），战果写口照记伤亡、溃散、
//     首领下场（tm-military.js applyBattleResult；战果认民变的军在 tm-battle-contract.js）。
//   - 了结：这股的军打没了、溃散了；或推演说剿平（revolt_suppress、补录「镇压」）、受抚（revolt_amnesty、补录「招抚」）、
//     自散（revolt_transform dissolved）。首领去向取推演给的（战果里的 commanderFate、剿平时的 leaderFate），没给当脱身。
//     剿平的接皇威（平乱，与旧平乱同一条规矩）。
//   - 人数落账：这股军里少了的能战之人记死（本州口数、丁数减），随之少的老弱妇孺记逃散（挪进本州逃户），都从本州「从乱」里扣；
//     了结时剩下的人——剿平的、溃散的、自散的进本州逃户，受抚的、赈散的回籍——也从「从乱」里扣。
//   - 推演要看得到：每回合提示词里列各股实情（promptBlock：首领、人数、在哪州、本州主官、这股的军、附近的官军）。
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
    morale: 55, training: 35, supply: 45,   // 旧式流民军同值（tm-revolt-entity.js）
    collapseBelow: 0.05,                // 〔初值〕不论什么缘故，这股能打的剩不到最多时的这个比重，这股就散了
    promptMax: 12,                      // 提示词里最多列几股（人多的在前）
    nearbyMax: 3,                       // 每股列几支附近的官军
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
    G.armies.push(a);   // arch-ok 民变案每股一支军（民2d-1）·形状照旧式流民军（tm-revolt-entity.js）
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

  // ── 了结了的善后（剿平的、军打没了的、旧五级梯自散的、受抚的、赈散的都走这里，一股只走一次）──
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

  // ── 推演判这股了结（revolt_suppress / revolt_amnesty / revolt_transform 按编号；一致性补录 record_revolt_events 按首领、州）──
  // 哪一股：给了编号只认编号（不是民变案的编号——旧账 GM._activeRevolts 的——不归这里）；否则认首领；再认它说的那一州；
  //   只说到省的，在那一省各股里挑人多的。返回 { handled:false } 由调用方照旧办。
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
    var leaves = R.realmLeaves(G), byId = {};
    leaves.forEach(function (L) { byId[str(L.node.id)] = L; });
    function leafFor(r) { return byId[str(r.divisionId)] || leafOf(G, r, leaves); }
    var stat = { turn: turn, armies: 0, broken: 0, settled: 0, rebelsMoved: 0 };
    // 0. 民2d-1 剿令挂的仗，旧档里没结的撤掉（收口后剿的胜负由推演判）
    if (Array.isArray(G.activeBattles)) {
      for (var i = G.activeBattles.length - 1; i >= 0; i--) {
        var bt = G.activeBattles[i];
        if (bt && bt.source === LEGACY_BATTLE_SOURCE) G.activeBattles.splice(i, 1);
      }
    }
    var revs = arr(G.minxin && G.minxin.revolts).filter(isBand);
    // 1. 别处了结的（推演判的、旧五级梯自散、赈散）先善后
    revs.forEach(function (r) { if (r.status !== 'ongoing' && settle(G, r, leafFor(r))) stat.settled++; });
    // 2. 在的：立军、对账；军打没了、溃散了、能打的几乎没了，这股了结
    revs.forEach(function (r) {
      if (r.status !== 'ongoing') return;
      retireOrder(G, r);
      var L = leafFor(r);
      var a = ensureArmy(G, r, L, leaves);
      if (a) stat.armies++;
      syncBand(G, r, L, a);
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
    if (store) store.suppressTick = turn;
    return stat;
  }

  TM.RevoltBand = {
    CFG: CFG, SOURCE: SOURCE,
    tick: tick, ensureArmy: ensureArmy, bandArmy: bandArmy, settle: settle,
    findBand: findBand, conclude: conclude, promptBlock: promptBlock
  };
})(typeof window !== 'undefined' ? window : globalThis);
