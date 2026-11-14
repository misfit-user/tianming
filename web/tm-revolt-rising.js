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
// 民2b（11-14）：AI 宣布的起义并进案（TM.RevoltCases.riseFromAI）也走这里落地——首领、骨干按 AI 给的名字先在档里找，
//   找不到用这个名字按出身新生（出身照 AI 说的：教门、兵变、盐枭、饥民、佃农）；人数照样从户口拨，不取 AI 报的兵数；
//   口号、诉求、教派这些原话当文字留在民变上。
// 本模块不判起不起（那是 tm-revolt-cases.js），只把已判定起事的案落成人和数。
// ============================================================
(function (global) {
  'use strict';
  var TM = global.TM = global.TM || {};

  var CFG = {
    minLeaderAge: 16,
    followerFloorRate: 0.001,   // 〔初值〕本州没有逃户时，从口数里取千分之一
    guerrillaLevel: 2,          // 聚啸：啸聚山林、流寇往来，不占城
    maxLieutenants: 3           // AI 点名的骨干最多认几个（民2b）
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
  var ROYAL = /宗室|皇子|王爷|亲王|郡王|公主|后妃|皇后/;
  var DIRECTIONS = '东南西北';
  // 省的通行简称，加方位算同省（「陕北」「豫东」「闽南」）。只认这张表：省名头一个字不当简称——
  // 「江南」不是江西，「山东」不是山西，「广西」不是广东（民2b 改；民2a 拿头一个字当简称）
  var PROVINCE_ABBR = {
    '陕西': ['陕'], '山西': ['晋'], '河南': ['豫'], '山东': ['鲁'], '四川': ['川'], '湖广': ['湖'],
    '江西': ['赣'], '福建': ['闽'], '广东': ['粤'], '广西': ['桂'], '云南': ['滇'], '贵州': ['黔'], '浙江': ['浙']
  };

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

  // 在任（官制树上有职）或领着兵。领的是起义一路自己的兵不算（天启王嘉胤领着「陕北饥民(将起)·主力」，他就是那一路的头领；民2b 改）
  function inOffice(G, ch, rebels) {
    var HS = TM.OfficeHolderState;
    if (HS && typeof HS.assignments === 'function') {
      try { if (HS.assignments(G, ch).length) return true; } catch (_) {}
    }
    rebels = rebels || rebelFactionNames(G);
    return arr(G.armies).some(function (a) {
      if (!a || a.destroyed === true || !(a.commanderId === ch.id || (a.commander && a.commander === ch.name))) return false;
      return !(rebels[str(a.faction)] || rebels[str(a.factionId)]);
    });
  }

  // 一段地名在哪儿说到了这个省（省名去掉布政使司这类后缀，或通行简称加方位）；没说到返回 -1
  function provinceAt(loc, provBase) {
    loc = str(loc);
    if (!loc || str(provBase).length < 2) return -1;
    var at = loc.indexOf(provBase);
    var ab = PROVINCE_ABBR[provBase] || [];
    for (var i = 0; i < ab.length; i++) {
      for (var j = 0; j < DIRECTIONS.length; j++) {
        var k = loc.indexOf(ab[i] + DIRECTIONS.charAt(j));
        if (k >= 0 && (at < 0 || k < at)) at = k;
      }
    }
    return at;
  }
  function provinceHit(loc, provBase) { return provinceAt(loc, provBase) >= 0; }

  // 所在点到哪：3＝本州，1＝同省（省名，或省简称加方位，如「陕北」）；0＝不沾边
  function placeScore(loc, L) {
    loc = str(loc);
    if (!loc) return 0;
    var leafBase = baseName(L.node.name);
    if (leafBase.length >= 2 && loc.indexOf(leafBase) >= 0) return 3;
    var prov = L.chain[L.chain.length - 1];
    return prov && prov !== L.node && provinceHit(loc, baseName(prov.name)) ? 1 : 0;
  }

  function isPlayerChar(G, ch) {
    var pi = G.playerInfo || {};
    return !!(ch.isPlayer || (pi.characterId && ch.id === pi.characterId) || (pi.characterName && ch.name === pi.characterName));
  }

  function pickLeader(G, L, seed) {
    var rebels = rebelFactionNames(G), best = [], bestScore = 0;
    arr(G.chars).forEach(function (ch) {
      if (!ch || ch.alive === false || ch.dead === true || isPlayerChar(G, ch)) return;
      if (num(ch.age, 30) < CFG.minLeaderAge) return;
      var fac = str(ch.faction || ch.factionId);
      var rebel = !!rebels[fac];
      if (!rebel && !GRASSROOTS.test(str(ch.officialTitle || ch.title) + str(ch.origin) + str(ch.background))) return;
      if (ROYAL.test(str(ch.title) + str(ch.officialTitle) + str(ch.class))) return;
      var s = placeScore(ch.location || ch.loc || ch.region, L);
      if (!s) return;
      if (!rebel) s -= 0.5;                       // 同等所在，起义一类势力的人先
      if (leadingRevolt(G, ch) || inOffice(G, ch, rebels)) return;
      if (s > bestScore) { bestScore = s; best = [ch]; } else if (s === bestScore) best.push(ch);
    });
    if (!best.length) return null;
    best.sort(function (a, b) { return str(a.id) < str(b.id) ? -1 : 1; });
    return best[Math.floor(roll(seed + '|pick') * best.length) % best.length];
  }

  // AI 点名的人（民2b）：档里没有 → null（用这个名字新生）；有且能当首领 → { ch }；
  // 已领着一股民变 → { ch, leading }（就是那一股）；当不了 → { why, otherPath }。
  // otherPath：在任官员、领兵的将帅、宗室、玩家本人——他们起事是兵变、割据，另一条路，不并进民变案。
  function namedLeader(G, name) {
    name = str(name).trim();
    if (!name) return null;
    var hit = null, dead = null, rebels = rebelFactionNames(G), myFac = str(G.playerInfo && G.playerInfo.factionName);
    arr(G.chars).forEach(function (ch) {
      if (!ch || ch.name !== name) return;
      if (ch.alive === false || ch.dead === true) { dead = dead || ch; return; }
      hit = hit || ch;
    });
    if (!hit) return dead ? { why: '已故' } : null;
    if (isPlayerChar(G, hit)) return { why: '是玩家本人', otherPath: true };
    if (ROYAL.test(str(hit.title) + str(hit.officialTitle) + str(hit.class))) return { why: '宗室', otherPath: true };
    if (inOffice(G, hit, rebels)) return { why: '在任或领兵', otherPath: true };
    var fac = str(hit.faction || hit.factionId);
    if (fac && fac !== myFac && !rebels[fac]) return { why: '是' + fac + '的人', otherPath: true };
    if (leadingRevolt(G, hit)) return { ch: hit, leading: true };
    if (num(hit.age, 30) < CFG.minLeaderAge) return { why: '年幼' };
    return { ch: hit };
  }

  // ── 首领：挑不到按出身新生 ──
  var SURNAMES = '王李张刘高马贺罗白郝杨赵孙周吴郭何田胡朱韩冯任党惠拓呼雷米';
  var GIVEN = ['大成', '二虎', '三才', '应元', '守义', '天保', '有才', '国柱', '世英', '进忠', '起龙', '得胜', '登相',
    '光恩', '应祥', '朝宗', '大海', '自强', '汉儿', '黑虎', '一鸣', '加官', '成栋', '可贵', '老回', '双喜', '金山', '满仓'];
  var ORIGINS = {
    border: { label: '边兵', title: '欠饷边卒·民变首领', traits: ['brave', 'wrathful'] },
    famine: { label: '饥民', title: '饥民魁首', traits: ['wrathful', 'gregarious'] },
    salt: { label: '盐枭', title: '私盐贩·民变首领', traits: ['greedy', 'brave', 'deceitful'] },
    tenant: { label: '佃农', title: '抗租佃户·民变首领', traits: ['stubborn', 'brave'] },
    sect: { label: '教首', title: '教门首领·民变首领', traits: ['zealous', 'gregarious'] }   // 只给 AI 说是教门起事的（民2b）
  };

  function originOf(L, J) {
    var nm = str(L.node.name);
    if (/(卫|所|镇|堡|关)$/.test(nm)) return 'border';
    if (J && J.famine && J.famine.disaster) return 'famine';
    var tags = (L.node.tags || {}), eb = L.node.economyBase || {};
    if ((tags.saltRegion || num(eb.saltProduction, 0) > 0) && J && J.levy && J.levy.score >= 0.15) return 'salt';
    return 'tenant';
  }

  // AI 宣布的起义照它说的出身配（教门、兵变、盐枭、饥民、佃农）；说不出的返回空，照本州实账配（民2b）
  function originFromDecl(d) {
    if (!d) return '';
    if (d.ideology === 'religious' || d.organizationType === 'secretSociety' || str(d.religiousSect).trim()) return 'sect';
    if (d.organizationType === 'militaryMutiny') return 'border';
    var t = str(d.className);
    if (/教|香会|白莲|弥勒/.test(t)) return 'sect';
    if (/盐/.test(t)) return 'salt';
    if (/军|兵|卒|戍/.test(t)) return 'border';
    if (/饥|流民|灾民|难民/.test(t)) return 'famine';
    if (/佃|农|雇工/.test(t)) return 'tenant';
    return '';
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

  // how：name（AI 给的名字，民2b）、origin（出身键）、role（'lieutenant' 作骨干）、by（谁宣布的）
  function bornLeader(G, L, J, seed, turn, how) {
    how = how || {};
    var R = TM.Roster;
    if (!R || typeof R.createChar !== 'function') return null;
    var o = ORIGINS[how.origin && ORIGINS[how.origin] ? how.origin : originOf(L, J)];
    var age = 22 + Math.floor(roll(seed + '|age') * 24);
    var spawned = { divisionId: L.node.id, turn: turn, origin: o.label };
    if (how.role) spawned.role = how.role;
    if (how.by) spawned.by = how.by;
    var data = {
      name: str(how.name).trim() || freshName(G, seed), age: age, gender: '男', alive: true,
      location: str(L.node.name), title: how.role === 'lieutenant' ? o.label + '·民变骨干' : o.title, officialTitle: '', faction: '',
      origin: o.label, traitIds: o.traits.slice(), loyalty: 0, stance: '反对',
      integrity: 40 + Math.floor(roll(seed + '|lian') * 30),
      _spawnedFromRevolt: spawned
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

  // AI 原话里留下的字（口号、诉求、教派……）：只当文字留在民变上，不当数
  var AI_TEXT_KEYS = ['className', 'slogan', 'ideology', 'organizationType', 'religiousSect', 'historicalArchetype'];

  // 把一件已判定起事的案落成一股民变；返回民变（失败抛错，调用方留案下回合再落）
  // opts（民2b，AI 宣布的起义并进案时给）：by（class_revolt／reconcile）、leaderName、lieutenants（名字）、origin（出身键）、cause、ai（原话里的字）
  function land(G, c, L, J, opts) {
    opts = opts || {};
    var turn = num(G.turn, 0);
    var seed = str(G._campaignId || G.sid || '') + '|' + turn + '|' + str(L.node.id) + '|leader';
    var leader = null, born = false, note = '';
    // AI 点名的首领：档里有、当得了就是他；档里没有就用这个名字按出身新生；当不了照常挑
    if (str(opts.leaderName).trim()) {
      var nl = namedLeader(G, opts.leaderName);
      if (!nl) { leader = bornLeader(G, L, J, seed, turn, { name: opts.leaderName, origin: opts.origin, by: opts.by }); born = !!leader; }
      else if (nl.ch && !nl.leading) leader = nl.ch;
      else note = 'AI 点名' + str(opts.leaderName).trim() + '为首，' + (nl.why || '已领着别的民变') + '，改由档里挑';
    }
    if (!leader) leader = pickLeader(G, L, seed);
    if (!leader) { leader = bornLeader(G, L, J, seed, turn, { origin: opts.origin, by: opts.by }); born = !!leader; }
    if (!leader) throw new Error('首领挑不到也造不出：' + str(L.node.name));
    // AI 点名的骨干：同一个办法，当不了的不要
    var lts = [];
    arr(opts.lieutenants).slice(0, CFG.maxLieutenants).forEach(function (nm, i) {
      nm = str(nm).trim();
      if (!nm || nm === str(leader.name) || lts.some(function (x) { return x.name === nm; })) return;
      var r = namedLeader(G, nm), ch = null;
      if (!r) ch = bornLeader(G, L, J, seed + '|lt' + i, turn, { name: nm, origin: opts.origin, role: 'lieutenant', by: opts.by });
      else if (r.ch && !r.leading) ch = r.ch;
      if (ch) lts.push(ch);
    });
    var got = draw(L, J);
    var mx = G.minxin = G.minxin || {};
    if (!Array.isArray(mx.revolts)) mx.revolts = [];
    var revolt = {
      id: 'rv-' + str(L.node.id) + '-t' + turn,
      turn: turn, region: str(L.node.name), divisionId: L.node.id, province: str(c.province),
      status: 'ongoing', level: CFG.guerrillaLevel, form: 'guerrilla',
      scale: got.n, followers: got.n, followersFrom: got.from,
      leaderId: leader.id, leaderName: str(leader.name), leaderBorn: born,
      caseId: c.id, cause: str(opts.cause).trim() ? str(opts.cause).trim().slice(0, 40) : causeText(J), source: 'revolt-cases'
    };
    if (opts.by) {
      revolt.declaredBy = str(opts.by);
      var ai = opts.ai || {};
      AI_TEXT_KEYS.forEach(function (k) { if (str(ai[k]).trim()) revolt[k] = str(ai[k]).trim().slice(0, 60); });
      if (Array.isArray(ai.demands) && ai.demands.length) revolt.demands = ai.demands.slice(0, 5).map(function (x) { return str(x).slice(0, 40); });
    }
    if (lts.length) {
      revolt.lieutenantIds = lts.map(function (x) { return x.id; });
      revolt.lieutenantNames = lts.map(function (x) { return str(x.name); });
    }
    if (note) { revolt.leaderNote = note; c.leaderNote = note; }
    mx.revolts.push(revolt);
    leader._revoltLeaderOf = revolt.id;
    if (born || !leader.location) leader.location = str(L.node.name);
    lts.forEach(function (x) { x._revoltLieutenantOf = revolt.id; if (!x.location) x.location = str(L.node.name); });
    c.revoltId = revolt.id;
    c.leaderId = leader.id;
    c.followers = got.n;
    if (typeof global.addEB === 'function') {
      try {
        global.addEB('民变', '【' + (c.province ? c.province + '·' : '') + revolt.region + '】' + revolt.leaderName +
          '聚众约 ' + got.n + ' 人起事' + (revolt.slogan ? '，号「' + revolt.slogan + '」' : '') + '，啸聚山林（' + revolt.cause + '）', { credibility: 'high' });
      } catch (_) {}
    }
    return revolt;
  }

  TM.RevoltRising = {
    CFG: CFG, land: land, pickLeader: pickLeader, placeScore: placeScore, provinceAt: provinceAt, provinceHit: provinceHit,
    originOf: originOf, originFromDecl: originFromDecl, namedLeader: namedLeader
  };
})(typeof window !== 'undefined' ? window : globalThis);
