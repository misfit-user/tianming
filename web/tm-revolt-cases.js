// @ts-check
// ============================================================
// tm-revolt-cases.js — 民变立案与起事判定（民变重做·民1，同志 11-14 定）
//
// 依据 docs/guanben-roleplay-20260930/minbian.md 定案第 2 条：
//   州民心跌破 35 才立「苗头」案（民心只当门槛，不再拿它加权）；苗头每月起事的机会由四样实账相加，各有封顶——
//   饥荒 ≤0.40、赋役 ≤0.30、流民 ≤0.20、邻州已起事 ≤0.10；再乘地方官：贪酷 ×1.5、庸常 ×1、清能且在赈 ×0.5、缺官 ×1.2。
// 本片只判、只记：掷中记「当起」，不生民变（起事落地在民2）；不改提示词、不出事件、不动别的账。
// 挂在过回合 GM.turn++ 之后、AuthorityComplete.tick 之后（tm-endturn-systems.js 6.145），读这回合更新过的民心、户口。
// 存 GM.revoltCases（随 GM 整份入档）。不写 GM._revoltPrecursors：那是 AI 写的起义前兆，会回灌主推演提示词。
// 只管玩家一方的区划（GM.adminHierarchy.player）；别家势力境内的民变不在本片。
// ============================================================
(function (global) {
  'use strict';
  var TM = global.TM = global.TM || {};

  // 带〔初值〕的都待天启陕西十回合校准，同志看过校准表再定
  var CFG = {
    openBelow: 35,                 // 州民心跌破即立案（定案）
    closeAbove: 45,                // 〔初值〕民心回升过此……
    closeTurns: 3,                 // 〔初值〕……并稳住这么多回合，结案
    caps: { famine: 0.40, levy: 0.30, refugee: 0.20, neighbor: 0.10 },   // 定案：四样各自封顶
    officialMult: { cruel: 1.5, ordinary: 1, upright: 0.5, vacant: 1.2 }, // 定案：贪酷、庸常、清能且在赈、缺官
    floor: 0,                      // 〔待校准〕四项相加后先扣的门槛（0＝照定案原样相加）：压力不够大的地方基本不起
    scale: 1,                      // 〔待校准〕每月机会的总系数：每月机会＝max(0, 四项和−门槛) × 地方官 × 总系数
    monthlyMax: 0.95,
    famineWeights: { load: 0.35, disaster: 0.5, grain: 0.15 },   // 〔初值〕饥荒三项的分量
    levyWeights: { skim: 0.4, surcharge: 0.3, corvee: 0.3 },      // 〔初值〕赋役三项的分量
    refugeeWeights: { fugitive: 0.6, roving: 0.4 },               // 〔初值〕流民两项的分量
    reliefTurns: 3,                // 〔初值〕赈后几回合内算「在赈」
    followerRate: 0.3,             // 〔初值〕裹挟规模＝本州逃户的三成（民2 起事落地时用）
    keepClosedTurns: 24,           // 结了的案留多少回合
    historyMax: 12                 // 每案留几回合的掷骰记录
  };

  function arr(v) { return Array.isArray(v) ? v : []; }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function str(v) { return v == null ? '' : String(v); }
  function round3(v) { return Math.round(v * 1000) / 1000; }

  // 地名去掉府、州、卫、镇、布政使司这类后缀，用来对灾情名单、流寇所在（「榆林卫」「榆林镇」都认作榆林）
  function baseName(name) {
    var s = str(name).replace(/[（(].*$/, '').trim();
    var b = s.replace(/(承宣布政使司|布政使司|都指挥使司|宣慰使司|宣慰司|安抚司|长官司|直隶州|直隶厅|府|州|县|卫|所|镇|司|厅|路|军|监)$/, '');
    return b.length >= 2 ? b : s;
  }

  // 可复现的掷骰：同一局、同一回合、同一州，结果相同（读档重放、校准重跑都一样）
  function seededRoll(seed) {
    var h = 2166136261;
    seed = str(seed);
    for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    var t = (h >>> 0) + 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function ensureStore(G) {
    if (!G.revoltCases || typeof G.revoltCases !== 'object' || !Array.isArray(G.revoltCases.cases)) {
      G.revoltCases = { v: 1, cases: [], lastTick: null, grainBase: null };
    }
    return G.revoltCases;
  }

  // 玩家一方的区划叶子，带上级链（叶子在前，省在末）
  function realmLeaves(G) {
    var ah = G && G.adminHierarchy && G.adminHierarchy.player;
    var tops = arr(ah && (ah.divisions || ah.children));
    var out = [];
    function walk(node, chain) {
      if (!node || typeof node !== 'object') return;
      var kids = arr(node.children || node.divisions || node.subs);
      var here = [node].concat(chain);
      if (!kids.length) { out.push({ node: node, chain: here }); return; }
      kids.forEach(function (k) { walk(k, here); });
    }
    tops.forEach(function (t) { walk(t, []); });
    return out;
  }

  function findChar(G, ref) {
    if (ref == null || ref === '') return null;
    var list = arr(G.chars);
    for (var i = 0; i < list.length; i++) { var c = list[i]; if (c && (c.id === ref || c.name === ref)) return c; }
    return null;
  }

  // ── 饥荒 ≤0.40：承载负荷过 1、当地有灾而无赈、粮价 ──
  function grainPrice(G) { return num(G.currency && G.currency.market && G.currency.market.grainPrice, null); }

  function disasterOf(G, leaf, chain, turn) {
    var hit = null, leafBase = baseName(leaf.name);
    // 剧本写在区划上的灾情：叶子自己的，或上级的；上级的若列了受灾子区划，要点到本州
    for (var i = 0; i < chain.length && !hit; i++) {
      var d = chain[i] && chain[i].disaster;
      if (!d || typeof d !== 'object' || d.active === false) continue;
      var list = arr(d.affectedSubDivisions);
      if (i > 0 && list.length && !list.some(function (n) { return baseName(n) === leafBase; })) continue;
      hit = { severity: num(d.severity, 60), name: str(d.type || d.name || '灾'), src: str(chain[i].name), relieved: false };
    }
    // 灾害系统的在册天灾（开仓放粮在这张表上记「已赈」）
    var names = {};
    chain.forEach(function (n) { if (n) { names[str(n.id)] = 1; names[str(n.name)] = 1; names[baseName(n.name)] = 1; } });
    arr(G.activeDisasters).forEach(function (d) {
      if (!d || !(names[str(d.region)] || names[baseName(d.region)])) return;
      var sev = num(d.severity, num(d.level, 1) * 20);
      var relieved = !!d._relieved && turn - num(d._reliefTurn, -99) <= CFG.reliefTurns;
      if (!hit || sev > hit.severity) hit = { severity: sev, name: str(d.type || d.name || '灾'), src: '在册天灾', relieved: relieved };
      else if (relieved) hit.relieved = true;
    });
    return hit;
  }

  function famine(G, L, store, turn) {
    var leaf = L.node, chain = L.chain, w = CFG.famineWeights;
    var load = num(leaf.carryingCapacity && leaf.carryingCapacity.currentLoad, null), loadSrc = load == null ? '' : '本州';
    if (load == null) {
      var env = G.environment && G.environment.byRegion;
      for (var i = 1; i < chain.length && load == null; i++) {
        var e = env && chain[i] && env[chain[i].id];
        if (e && isFinite(Number(e.currentLoad))) { load = Number(e.currentLoad); loadSrc = '借' + str(chain[i].name); }
      }
    }
    var a = load == null ? 0 : clamp((load - 1) / 0.5, 0, 1);
    var dis = disasterOf(G, leaf, chain, turn);
    var b = dis ? clamp(dis.severity / 100, 0, 1) * (dis.relieved ? 0.3 : 1) : 0;
    var price = grainPrice(G), base = num(store && store.grainBase, null);
    var c = price != null && base ? clamp((price / base - 1) / 1, 0, 1) : 0;
    return {
      score: CFG.caps.famine * clamp(w.load * a + w.disaster * b + w.grain * c, 0, 1),
      load: load, loadSrc: loadSrc, disaster: dis ? dis.name + (dis.severity != null ? dis.severity : '') + (dis.src ? '（' + dis.src + '）' : '') : '',
      relieved: !!(dis && dis.relieved), grainRatio: price != null && base ? round3(price / base) : null
    };
  }

  // ── 赋役 ≤0.30：实征对名义（官吏浮收）、加派、徭役 ──
  function surchargeOf(G) {
    var g = G.guoku || {}, meta = g._customTaxMeta || {}, perMu = 0, names = [];
    Object.keys(meta).forEach(function (k) {
      var m = meta[k];
      if (!m || !(/加派|辽饷|剿饷|练饷/.test(str(m.name)) || /^(liaoxiang|jiaoxiang|lianxiang)$/.test(k))) return;
      perMu += num(m.effectiveRate, num(m.nominalRate, 0));
      names.push(str(m.name || k));
    });
    var et = g.emergency && g.emergency.extraTax;
    var extra = et && et.active ? num(et.rate, 0) : 0;
    if (extra) names.push('临时加派' + Math.round(extra * 100) + '%');
    return { score: clamp(perMu / 0.025 + extra / 0.5, 0, 1), names: names };
  }

  function levy(G, L) {
    var leaf = L.node, chain = L.chain, w = CFG.levyWeights;
    var f = leaf.fiscal, fSrc = '本州';
    if (!f || !isFinite(Number(f.skimmingRate))) {
      f = null;
      var regs = G.fiscal && G.fiscal.regions;
      for (var i = 1; i < chain.length && !f; i++) { if (regs && chain[i] && regs[chain[i].id]) { f = regs[chain[i].id]; fSrc = '借' + str(chain[i].name); } }
    }
    var skim = f ? clamp((num(f.skimmingRate, 0) + num(f.overstatement, 0)) / 0.4, 0, 1) : 0;
    var sur = surchargeOf(G);
    var rl = G.renli && G.renli.byRegion && G.renli.byRegion[leaf.id];
    var corvee = rl && rl.corveeRate != null && isFinite(Number(rl.corveeRate)) ? clamp((Number(rl.corveeRate) - 0.1) / 0.2, 0, 1) : 0;
    var remit = !!(rl && rl.levyPolicy && num(rl.levyPolicy.remitTurns, 0) > 0);
    if (remit) corvee *= 0.3;
    return {
      score: CFG.caps.levy * clamp(w.skim * skim + w.surcharge * sur.score + w.corvee * corvee, 0, 1),
      skim: f ? round3(num(f.skimmingRate, 0) + num(f.overstatement, 0)) : null, fiscalSrc: f ? fSrc : '',
      surcharge: sur.names.join('、'), corveeRate: rl && rl.corveeRate != null ? round3(Number(rl.corveeRate)) : null, remit: remit
    };
  }

  // ── 流民 ≤0.20：本州逃户、落在本州的流寇；同时定裹挟的规模 ──
  // 流寇在哪：起义一类势力自写的地盘（「陕西延安府·榆林·米脂·府谷」），和流寇池 GM.rovingRebels 落了地的
  function rebelPlaces(G) {
    var texts = [];
    arr(G.facs).forEach(function (f) {
      if (!f || f.alive === false || f.destroyed) return;
      if (!(f.isRevolt || /起义|民变|流寇|义军|饥民/.test(str(f.type) + str(f.name)))) return;
      texts.push(str(f.territory) + '·' + str(f.name));
    });
    arr(G.rovingRebels).forEach(function (r) { if (r) texts.push(str(r.region || r.location || r.place)); });
    return texts.join('｜');
  }

  function refugee(G, L, rebelText) {
    var leaf = L.node, w = CFG.refugeeWeights, pd = leaf.populationDetail || {};
    var mouths = num(pd.mouths, num(leaf.population, 0));
    var fug = Math.max(0, num(pd.fugitives, 0));
    var rate = mouths > 0 ? fug / mouths : 0;
    var b = baseName(leaf.name);
    var roving = b.length >= 2 && rebelText.indexOf(b) >= 0;
    return {
      score: CFG.caps.refugee * clamp(w.fugitive * clamp(rate / 0.10, 0, 1) + w.roving * (roving ? 1 : 0), 0, 1),
      fugitives: fug, fugitiveRate: round3(rate), roving: roving, followers: Math.round(fug * CFG.followerRate)
    };
  }

  // ── 邻州已起事 ≤0.10：同一上级的州，与地图上相邻的省（折半） ──
  function neighborsOf(G, L, leaves) {
    var parent = L.chain[1] || null, prov = L.chain[L.chain.length - 1] || null;
    var adj = {}, graph = G.mapData && G.mapData.adjacencyGraph;
    arr(prov && graph ? graph[prov.mapRegionId] : null).forEach(function (e) { var t = e && (e.target || e.id || e); if (t) adj[str(t)] = 1; });
    var siblings = [], adjacent = [];
    leaves.forEach(function (o) {
      if (o.node === L.node) return;
      if (parent && o.chain[1] === parent) siblings.push(o.node.id);
      else {
        var op = o.chain[o.chain.length - 1];
        if (op && op !== prov && adj[str(op.mapRegionId)]) adjacent.push(o.node.id);
      }
    });
    return { siblings: siblings, adjacent: adjacent };
  }

  function neighbor(nb, risen) {
    var n1 = nb.siblings.filter(function (id) { return risen[id]; }).length;
    var n2 = nb.adjacent.filter(function (id) { return risen[id]; }).length;
    return { score: CFG.caps.neighbor * clamp((n1 + 0.5 * n2) / 2, 0, 1), sameProvince: n1, adjacentProvince: n2 };
  }

  // ── 地方官：本州主官，没有就往上找（天启的府州多不设主官，陕西各府落到巡抚）；按 TM.Person 同一份性情判 ──
  // 一级区划上的主官，依次认：
  //   1. 官制树上这一职的在任者（与通志页同一读口 TM.CircuitGovernance、TM.OfficeHolderState）；
  //   2. 区划上记的主官名字（任免改的是它）；
  //   3. governorId（剧本与旧档迁移写的，换人时不跟着改，只在人死时清），只在没有名字时认。
  // 有人在岗、档里却没这个人（天启山东、山西等省只写了巡抚名字）作庸常；明说出缺、人已死、新官赴任未到算缺官。
  function travelling(ch) { return !!(ch && ch._travelTo && num(ch._travelRemainingDays, 0) > 0); }
  function seated(ch, post) {
    if (ch.alive === false || ch.dead === true) return { vacant: true, post: post, why: '人已不在' };
    if (travelling(ch)) return { vacant: true, post: post, why: '新官赴任未到' };
    return { ch: ch, post: post };
  }
  function holderAt(G, n) {
    var CG = TM.CircuitGovernance, HS = TM.OfficeHolderState;
    if (CG && typeof CG.resolveGovernorPosition === 'function' && HS && typeof HS.read === 'function') {
      var b = null;
      try { b = CG.resolveGovernorPosition(G, n); } catch (_) { b = null; }
      if (b && b.position) {
        var occ = HS.read(G, b.position), post = str(b.position.name);
        if (!occ.occupied) return occ.vacantByRule ? null : { vacant: true, post: post, why: '出缺' };   // 按制不除：这一级不设人，往上找
        if (occ.primary) return seated(occ.primary, post);
        return { unknown: str(occ.label), post: post };
      }
    }
    var post2 = str(n.officialPosition || n.name), name = str(n.governor).trim();
    if (name) {
      var c = findChar(G, name);
      return c ? seated(c, post2) : { unknown: name, post: post2 };
    }
    var byId = findChar(G, n.governorId);
    return byId ? seated(byId, post2) : null;
  }

  function official(G, L, inRelief) {
    var hit = null;
    for (var i = 0; i < L.chain.length && !hit; i++) { if (L.chain[i]) hit = holderAt(G, L.chain[i]); }
    var M = CFG.officialMult;
    if (!hit || hit.vacant) return { kind: 'vacant', label: '缺官' + (hit && hit.why && hit.why !== '出缺' ? '（' + hit.why + '）' : ''), mult: M.vacant, name: '', post: hit ? hit.post : '' };
    if (!hit.ch) return { kind: 'ordinary', label: '庸常（档里无此人）', mult: M.ordinary, name: hit.unknown, post: hit.post };
    var ch = hit.ch, post = hit.post;
    var d = TM.Person && typeof TM.Person.disposition === 'function' ? TM.Person.disposition(ch) : null;
    var kind = 'ordinary', label = '庸常';
    if (d) {
      var cruel = (d.integrity < 40 && (d.greed > 0 || d.compassion < 0)) || (d.greed >= 50 && d.compassion < 0);
      var upright = d.integrity >= 65 && d.compassion >= 0 && d.honor >= 0;
      if (cruel) { kind = 'cruel'; label = '贪酷'; }
      else if (upright && inRelief) { kind = 'upright'; label = '清能且在赈'; }
      else if (upright) label = '清能（不在赈，作庸常）';
    }
    return { kind: kind, label: label, mult: M[kind], name: str(ch.name), post: post, integrity: d ? d.integrity : null };
  }

  function monthsOf(ctx) {
    var m = num(ctx && (ctx.monthRatio != null ? ctx.monthRatio : ctx._monthRatio), null);
    if (m == null && typeof global._getDaysPerTurn === 'function') m = num(global._getDaysPerTurn(), 30) / 30;
    return m == null || m <= 0 ? 1 : m;
  }

  // 一州本回合的判定（纯算，不改档）：四项、地方官、每月与本回合的机会、裹挟规模
  function judge(G, L, opts) {
    opts = opts || {};
    var turn = num(G.turn, 0), store = opts.store || G.revoltCases || null;
    var fa = famine(G, L, store, turn);
    var lv = levy(G, L);
    var rf = refugee(G, L, opts.rebelText != null ? opts.rebelText : rebelPlaces(G));
    var nbList = opts.neighbors || neighborsOf(G, L, opts.leaves || realmLeaves(G));
    var nb = neighbor(nbList, opts.risen || {});
    var of = official(G, L, fa.relieved);
    var sum = fa.score + lv.score + rf.score + nb.score;
    var monthly = clamp(Math.max(0, sum - CFG.floor) * of.mult * CFG.scale, 0, CFG.monthlyMax);
    var months = opts.months != null ? opts.months : monthsOf(opts.ctx);
    var perTurn = 1 - Math.pow(1 - monthly, months);
    return {
      famine: fa, levy: lv, refugee: rf, neighbor: nb, official: of,
      sum: round3(sum), monthly: round3(monthly), perTurn: round3(perTurn), followers: rf.followers
    };
  }

  function openCase(store, L, turn, mx) {
    var prov = L.chain[L.chain.length - 1];
    var c = {
      id: 'rc-' + str(L.node.id) + '-t' + turn,
      divisionId: L.node.id, name: str(L.node.name), province: prov && prov !== L.node ? str(prov.name) : '',
      openedTurn: turn, openedMinxin: round3(mx), status: 'brewing', calmTurns: 0,
      risenTurn: null, closedTurn: null, last: null, history: []
    };
    store.cases.push(c);
    return c;
  }

  // 每回合一次：立案、结案、起事判定（民1 掷中只记「当起」）
  function tick(G, ctx) {
    if (!G) return null;
    var turn = num(G.turn, 0);
    var store = ensureStore(G);
    if (store.lastTick === turn) return store;   // 同一回合只判一次：重跑、读档都不重掷
    if (store.grainBase == null) store.grainBase = grainPrice(G);
    var leaves = realmLeaves(G), byDiv = {}, leafById = {};
    leaves.forEach(function (L) { leafById[L.node.id] = L; });
    store.cases.forEach(function (c) { if (c.status !== 'closed') byDiv[c.divisionId] = c; });
    // 1. 立案、结案（民心只当门槛）
    leaves.forEach(function (L) {
      var mx = num(L.node.minxin, null);
      if (mx == null) return;
      var c = byDiv[L.node.id];
      if (!c && mx < CFG.openBelow) { byDiv[L.node.id] = openCase(store, L, turn, mx); return; }
      if (!c || c.status !== 'brewing') return;
      if (mx > CFG.closeAbove) c.calmTurns = (c.calmTurns || 0) + 1; else c.calmTurns = 0;
      if (c.calmTurns >= CFG.closeTurns) { c.status = 'closed'; c.closedTurn = turn; }
    });
    // 2. 起事判定：邻州只认上回合以前已起的，同回合各州互不影响（与遍历先后无关）
    var risen = {};
    store.cases.forEach(function (c) { if (c.status === 'risen') risen[c.divisionId] = 1; });
    var rebelText = rebelPlaces(G), months = monthsOf(ctx), seedBase = str(G._campaignId || G.sid || '');
    store.cases.forEach(function (c) {
      if (c.status !== 'brewing') return;
      var L = leafById[c.divisionId];
      if (!L) return;   // 区划不在了（易主、改隶）：留案不判
      var J = judge(G, L, { store: store, rebelText: rebelText, leaves: leaves, risen: risen, months: months });
      var roll = round3(seededRoll(seedBase + '|' + turn + '|' + c.divisionId));
      var rise = roll < J.perTurn;
      c.last = { turn: turn, minxin: round3(num(L.node.minxin, 0)), j: J, roll: roll, rise: rise };
      c.history.push({ t: turn, p: J.perTurn, roll: roll, rise: rise });
      if (c.history.length > CFG.historyMax) c.history.splice(0, c.history.length - CFG.historyMax);
      if (rise) { c.status = 'risen'; c.risenTurn = turn; c.followers = J.followers; c.dryRun = true; }
    });
    // 3. 结了的案只留一阵
    store.cases = store.cases.filter(function (c) { return c.status !== 'closed' || turn - num(c.closedTurn, turn) <= CFG.keepClosedTurns; });
    store.lastTick = turn;
    return store;
  }

  // 校准表、调试用：每案一行
  function summary(G) {
    var store = G && G.revoltCases;
    return arr(store && store.cases).map(function (c) {
      var j = c.last && c.last.j;
      return {
        name: c.name, province: c.province, status: c.status, opened: c.openedTurn, risen: c.risenTurn,
        famine: j ? round3(j.famine.score) : null, levy: j ? round3(j.levy.score) : null, refugee: j ? round3(j.refugee.score) : null,
        neighbor: j ? round3(j.neighbor.score) : null, official: j ? j.official.label + (j.official.name ? '·' + j.official.name : '') : '',
        monthly: j ? j.monthly : null, perTurn: j ? j.perTurn : null, roll: c.last ? c.last.roll : null
      };
    });
  }

  TM.RevoltCases = {
    CFG: CFG, tick: tick, judge: judge, summary: summary,
    realmLeaves: realmLeaves, neighborsOf: neighborsOf, baseName: baseName, seededRoll: seededRoll, ensureStore: ensureStore
  };
})(typeof window !== 'undefined' ? window : globalThis);
