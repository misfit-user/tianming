// @ts-check
// ============================================================
// tm-revolt-rising.js — 民变起事落地（民变重做·民2a，同志 11-14「按你推荐，该修的修，该干的干」）
//
// 依据 docs/guanben-roleplay-20260930/minbian.md 定案第 4 条（首领从哪来）与「新的样子」二（游击）：
//   案掷中（tm-revolt-cases.js）即起一股真民变，写进 GM.minxin.revolts（面板、顶栏、民心不宁、上下文照旧读）。
//   - 首领是真人。先在档里挑：起义一类势力的人，与不在任的草莽（盐枭、教首、驿卒、边卒、流民头目……）；
//     所在点到本州的优先，其次同省（「陕北」这类省简称加方位也算）；年满十六、活着、不在任、不领兵、没领着别的民变。
//     在任官员、将领不当民变首领（他们造反是兵变、割据，另一条路）。
//     挑不到按出身新生（TM.Roster.createChar）：卫所边镇作边兵，有灾作饥民，盐区作盐枭，其余作佃农；
//     特质按出身配，名字按种子掷（同局可复现），不调 AI。人格由 TM.Person 按特质读，与问对同一份。
//   - 人数出自户口：本州逃户的三成（没有逃户取口数千分之一），从逃户挪进「从乱」（populationDetail.rebels），口数不变。
//   - 样子先是游击：定级 2（聚啸）。实体三件套（tm-revolt-entity.js）、起旗号与每回合动作（tm-revolt-inference.js）、
//     事件总线「民变升级」都只认三级以上，游击的民变不会被套上写死兵数的流民军。占城、成势在民4。
// 本模块不判起不起（那是 tm-revolt-cases.js），只把已判定起事的案落成人和数。
// ============================================================
(function (global) {
  'use strict';
  var TM = global.TM = global.TM || {};

  var CFG = {
    minLeaderAge: 16,
    followerFloorRate: 0.001,   // 〔初值〕本州没有逃户时，从口数里取千分之一
    guerrillaLevel: 2           // 聚啸：啸聚山林、流寇往来，不占城
  };

  function arr(v) { return Array.isArray(v) ? v : []; }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function str(v) { return v == null ? '' : String(v); }
  function RC() { return TM.RevoltCases || null; }
  function baseName(n) { var R = RC(); return R ? R.baseName(n) : str(n); }
  function roll(seed) { var R = RC(); return R ? R.seededRoll(seed) : 0.5; }

  // ── 首领：在档的草莽 ──
  var REBEL_FACTION = /起义|民变|流寇|义军|饥民/;
  var GRASSROOTS = /盐|枭|教首|教门|香头|驿卒|军卒|边卒|逃卒|流民|饥民|豪强|贩|铁匠|落第|草寇|盗|魁首|头目|游骑|绿林/;
  var DIRECTIONS = '东南西北';

  function rebelFactionNames(G) {
    var out = {};
    arr(G.facs).forEach(function (f) {
      if (!f || f.alive === false || f.destroyed) return;
      if (f.isRevolt || REBEL_FACTION.test(str(f.type) + str(f.name))) { out[str(f.name)] = 1; if (f.id != null) out[str(f.id)] = 1; }
    });
    return out;
  }

  function leadingRevolt(G, ch) {
    var mx = G.minxin;
    return arr(mx && mx.revolts).some(function (r) {
      return r && r.status === 'ongoing' && (r.leaderId === ch.id || (r.leaderName && r.leaderName === ch.name));
    });
  }

  function inOffice(G, ch) {
    var HS = TM.OfficeHolderState;
    if (HS && typeof HS.assignments === 'function') {
      try { if (HS.assignments(G, ch).length) return true; } catch (_) {}
    }
    return arr(G.armies).some(function (a) {
      return a && a.destroyed !== true && (a.commanderId === ch.id || (a.commander && a.commander === ch.name));
    });
  }

  // 所在点到哪：3＝本州，1＝同省（省名，或省简称加方位，如「陕北」）；0＝不沾边
  function placeScore(loc, L) {
    loc = str(loc);
    if (!loc) return 0;
    var leafBase = baseName(L.node.name);
    if (leafBase.length >= 2 && loc.indexOf(leafBase) >= 0) return 3;
    var prov = L.chain[L.chain.length - 1];
    var provBase = prov && prov !== L.node ? baseName(prov.name) : '';
    if (provBase.length >= 2) {
      if (loc.indexOf(provBase) >= 0) return 1;
      var abbr = provBase.charAt(0);
      for (var i = 0; i < DIRECTIONS.length; i++) if (loc.indexOf(abbr + DIRECTIONS.charAt(i)) >= 0) return 1;
    }
    return 0;
  }

  function pickLeader(G, L, seed) {
    var rebels = rebelFactionNames(G), best = [], bestScore = 0;
    var playerId = G.playerInfo && G.playerInfo.characterId;
    arr(G.chars).forEach(function (ch) {
      if (!ch || ch.alive === false || ch.dead === true || ch.isPlayer || (playerId && ch.id === playerId)) return;
      if (num(ch.age, 30) < CFG.minLeaderAge) return;
      var fac = str(ch.faction || ch.factionId);
      var rebel = !!rebels[fac];
      if (!rebel && !GRASSROOTS.test(str(ch.officialTitle || ch.title) + str(ch.origin) + str(ch.background))) return;
      if (/宗室|皇子|王爷|亲王|郡王|公主|后妃|皇后/.test(str(ch.title) + str(ch.officialTitle) + str(ch.class))) return;
      var s = placeScore(ch.location || ch.loc || ch.region, L);
      if (!s) return;
      if (!rebel) s -= 0.5;                       // 同等所在，起义一类势力的人先
      if (leadingRevolt(G, ch) || inOffice(G, ch)) return;
      if (s > bestScore) { bestScore = s; best = [ch]; } else if (s === bestScore) best.push(ch);
    });
    if (!best.length) return null;
    best.sort(function (a, b) { return str(a.id) < str(b.id) ? -1 : 1; });
    return best[Math.floor(roll(seed + '|pick') * best.length) % best.length];
  }

  // ── 首领：挑不到按出身新生 ──
  var SURNAMES = '王李张刘高马贺罗白郝杨赵孙周吴郭何田胡朱韩冯任党惠拓呼雷米';
  var GIVEN = ['大成', '二虎', '三才', '应元', '守义', '天保', '有才', '国柱', '世英', '进忠', '起龙', '得胜', '登相',
    '光恩', '应祥', '朝宗', '大海', '自强', '汉儿', '黑虎', '一鸣', '加官', '成栋', '可贵', '老回', '双喜', '金山', '满仓'];
  var ORIGINS = {
    border: { label: '边兵', title: '欠饷边卒·民变首领', traits: ['brave', 'wrathful'] },
    famine: { label: '饥民', title: '饥民魁首', traits: ['wrathful', 'gregarious'] },
    salt: { label: '盐枭', title: '私盐贩·民变首领', traits: ['greedy', 'brave', 'deceitful'] },
    tenant: { label: '佃农', title: '抗租佃户·民变首领', traits: ['stubborn', 'brave'] }
  };

  function originOf(L, J) {
    var nm = str(L.node.name);
    if (/(卫|所|镇|堡|关)$/.test(nm)) return 'border';
    if (J && J.famine && J.famine.disaster) return 'famine';
    var tags = (L.node.tags || {}), eb = L.node.economyBase || {};
    if ((tags.saltRegion || num(eb.saltProduction, 0) > 0) && J && J.levy && J.levy.score >= 0.15) return 'salt';
    return 'tenant';
  }

  function freshName(G, seed) {
    var taken = {};
    arr(G.chars).forEach(function (c) { if (c && c.name) taken[c.name] = 1; });
    for (var i = 0; i < 40; i++) {
      var a = roll(seed + '|sn' + i), b = roll(seed + '|gn' + i);
      var nm = SURNAMES.charAt(Math.floor(a * SURNAMES.length)) + GIVEN[Math.floor(b * GIVEN.length)];
      if (!taken[nm]) return nm;
    }
    return '无名氏' + str(seed).replace(/\D/g, '').slice(-4);
  }

  function bornLeader(G, L, J, seed, turn) {
    var R = TM.Roster;
    if (!R || typeof R.createChar !== 'function') return null;
    var o = ORIGINS[originOf(L, J)];
    var age = 22 + Math.floor(roll(seed + '|age') * 24);
    var data = {
      name: freshName(G, seed), age: age, gender: '男', alive: true,
      location: str(L.node.name), title: o.title, officialTitle: '', faction: '',
      origin: o.label, traitIds: o.traits.slice(), loyalty: 0, stance: '反对',
      integrity: 40 + Math.floor(roll(seed + '|lian') * 30),
      _spawnedFromRevolt: { divisionId: L.node.id, turn: turn, origin: o.label }
    };
    return R.createChar(data, { world: G, authoritative: true });
  }

  // ── 人数：从逃户里拨 ──
  function draw(L, J) {
    var pd = L.node.populationDetail = L.node.populationDetail || {};
    var fug = Math.max(0, num(pd.fugitives, 0));
    var mouths = num(pd.mouths, num(L.node.population, 0));
    var n = Math.min(fug, Math.round(num(J && J.followers, 0)));
    var from = 'fugitives';
    if (!(n > 0)) { n = Math.max(0, Math.round(mouths * CFG.followerFloorRate)); from = 'mouths'; }
    if (from === 'fugitives') pd.fugitives = fug - n;
    pd.rebels = Math.max(0, num(pd.rebels, 0)) + n;
    return { n: n, from: from };
  }

  function causeText(J) {
    var bits = [];
    if (J && J.famine && J.famine.score >= 0.1) bits.push(J.famine.disaster ? '饥荒（' + str(J.famine.disaster).replace(/（.*$/, '') + '）' : '饥荒');
    if (J && J.levy && J.levy.score >= 0.1) bits.push('赋役重');
    if (J && J.refugee && J.refugee.roving) bits.push('流寇在境');
    else if (J && J.refugee && J.refugee.score >= 0.08) bits.push('逃户多');
    if (J && J.official && J.official.kind === 'cruel') bits.push('官贪酷');
    return bits.join('、') || '民不聊生';
  }

  // 把一件已判定起事的案落成一股民变；返回民变（失败抛错，调用方留案下回合再落）
  function land(G, c, L, J, opts) {
    opts = opts || {};
    var turn = num(G.turn, 0);
    var seed = str(G._campaignId || G.sid || '') + '|' + turn + '|' + str(L.node.id) + '|leader';
    var leader = pickLeader(G, L, seed), born = false;
    if (!leader) { leader = bornLeader(G, L, J, seed, turn); born = true; }
    if (!leader) throw new Error('首领挑不到也造不出：' + str(L.node.name));
    var got = draw(L, J);
    var mx = G.minxin = G.minxin || {};
    if (!Array.isArray(mx.revolts)) mx.revolts = [];
    var revolt = {
      id: 'rv-' + str(L.node.id) + '-t' + turn,
      turn: turn, region: str(L.node.name), divisionId: L.node.id, province: str(c.province),
      status: 'ongoing', level: CFG.guerrillaLevel, form: 'guerrilla',
      scale: got.n, followers: got.n, followersFrom: got.from,
      leaderId: leader.id, leaderName: str(leader.name), leaderBorn: born,
      caseId: c.id, cause: causeText(J), source: 'revolt-cases'
    };
    mx.revolts.push(revolt);
    leader._revoltLeaderOf = revolt.id;
    if (born || !leader.location) leader.location = str(L.node.name);
    c.revoltId = revolt.id;
    c.leaderId = leader.id;
    c.followers = got.n;
    if (typeof global.addEB === 'function') {
      try {
        global.addEB('民变', '【' + (c.province ? c.province + '·' : '') + revolt.region + '】' + revolt.leaderName +
          '聚众约 ' + got.n + ' 人起事，啸聚山林（' + revolt.cause + '）', { credibility: 'high' });
      } catch (_) {}
    }
    return revolt;
  }

  TM.RevoltRising = { CFG: CFG, land: land, pickLeader: pickLeader, placeScore: placeScore, originOf: originOf };
})(typeof window !== 'undefined' ? window : globalThis);
