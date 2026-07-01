/* tm-armory.js — 军备/武库库存(军事系统装备绑定 · Slice 1 数据层)
 * 国家级军备库存挂 GM.guoku.armory(帑廪之下·与库藏银粮布并列的「军备库」)·复用账本概念(stock + 本回合进出 + 累计)。
 * 五类军备按兵种消耗:甲胄(全军)/兵刃(步骑近战)/弓弩(弓弩手)/火器(铳炮)/战马(骑兵)。接 Phase0 units[] 的 arm/sub。
 * 募兵从武库支取(tm-ai-change-army·Slice 2)·空了则新军装备简陋(品质/士气挫)。产出走军器局(每回合)+采买(治理·Slice 5)。
 * 朝代中立(CLAUDE.md 红线):类目名通用·不锁单朝。纯增量·无消费方时不改任何现有行为(Slice 1 仅建库不接收支)。
 */
(function () {
  'use strict';

  /* 五类军备(朝代中立·label=显示名·desc=说明) */
  var CATS = [
    { key: '甲胄', label: '甲胄', desc: '护身之甲', icon: '甲' },
    { key: '兵刃', label: '兵刃', desc: '刀枪近战', icon: '刃' },
    { key: '弓弩', label: '弓弩', desc: '弓与弩', icon: '弓' },
    { key: '火器', label: '火器', desc: '铳炮火器', icon: '铳' },
    { key: '战马', label: '战马', desc: '骑乘战马', icon: '马' }
  ];
  var CAT_KEYS = CATS.map(function (c) { return c.key; });

  function num(v, d) { v = Number(v); return isFinite(v) ? v : (d || 0); }

  /* 账本(复用 fiscal-engine 的 ledger 形状·此处独立轻量实现·不依赖 FiscalEngine) */
  function ensureLedger(root, key) {
    if (!root[key] || typeof root[key] !== 'object') root[key] = {};
    var l = root[key];
    l.stock = num(l.stock, 0);
    l.thisTurnIn = num(l.thisTurnIn, 0);
    l.thisTurnOut = num(l.thisTurnOut, 0);
    l.lastTurnIn = num(l.lastTurnIn, 0);
    l.lastTurnOut = num(l.lastTurnOut, 0);
    return l;
  }

  /* 确保 GM.guoku.armory 五类账本就位(幂等·永不崩) */
  function ensure(GM) {
    if (!GM || typeof GM !== 'object') return null;
    if (!GM.guoku || typeof GM.guoku !== 'object') GM.guoku = {};
    if (!GM.guoku.armory || typeof GM.guoku.armory !== 'object') GM.guoku.armory = {};
    var A = GM.guoku.armory;
    CAT_KEYS.forEach(function (k) { ensureLedger(A, k); });
    return A;
  }

  function stock(GM, cat) { var A = ensure(GM); return A && A[cat] ? num(A[cat].stock, 0) : 0; }
  function allStock(GM) { var A = ensure(GM), o = {}; if (A) CAT_KEYS.forEach(function (k) { o[k] = num(A[k].stock, 0); }); return o; }

  /* 入账(产出/采买/调拨→武库) */
  function add(GM, amounts, tag) {
    var A = ensure(GM); if (!A) return { added: {} }; amounts = amounts || {};
    var added = {};
    CAT_KEYS.forEach(function (k) {
      var amt = num(amounts[k], 0); if (amt <= 0) return;
      var l = A[k]; l.stock = num(l.stock, 0) + amt; l.thisTurnIn = num(l.thisTurnIn, 0) + amt; added[k] = amt;
    });
    return { added: added };
  }

  /* 支取(募兵/补给→扣武库)·库存不继则尽扣记缺(shortfall)·调用方按缺口降装备/士气 */
  function spend(GM, amounts, tag) {
    var A = ensure(GM); if (!A) return { deducted: {}, shortfall: {}, anyShort: false }; amounts = amounts || {};
    var ded = {}, sh = {}, anyShort = false;
    CAT_KEYS.forEach(function (k) {
      var need = num(amounts[k], 0); if (need <= 0) return;
      var l = A[k], have = num(l.stock, 0), take = Math.min(have, need);
      l.stock = have - take; l.thisTurnOut = num(l.thisTurnOut, 0) + take; ded[k] = take;
      if (need > take + 1e-6) { sh[k] = need - take; anyShort = true; }
    });
    return { deducted: ded, shortfall: sh, anyShort: anyShort };
  }

  /* 回合翻转:本回合进出→last·清本回合(供 UI 显「本回合产/耗」) */
  function rollTurn(GM) {
    var A = ensure(GM); if (!A) return;
    CAT_KEYS.forEach(function (k) {
      var l = A[k]; l.lastTurnIn = num(l.thisTurnIn, 0); l.lastTurnOut = num(l.thisTurnOut, 0);
      l.thisTurnIn = 0; l.thisTurnOut = 0;
    });
  }

  /* 兵种(units[].sub/arm)→每卒军备需求(接 Phase0 识别瀑布产物) */
  var NEED = {
    spear: { 甲胄: 0.7, 兵刃: 1 }, sword: { 甲胄: 0.7, 兵刃: 1 }, halberd: { 甲胄: 0.8, 兵刃: 1 },
    bow: { 甲胄: 0.5, 弓弩: 1 }, crossbow: { 甲胄: 0.5, 弓弩: 1 },
    musket: { 甲胄: 0.5, 火器: 1 }, cannon: { 甲胄: 0.4, 火器: 1 },
    horse: { 甲胄: 1, 兵刃: 1, 战马: 1 }, shock: { 甲胄: 1.1, 兵刃: 1, 战马: 1 }, heavy: { 甲胄: 1.6, 兵刃: 1, 战马: 1 },
    guard: { 甲胄: 1.2, 兵刃: 1 }
  };
  var NEED_BY_ARM = { step: { 甲胄: 0.6, 兵刃: 1 }, bow: { 甲胄: 0.5, 弓弩: 1 }, cav: { 甲胄: 1, 兵刃: 1, 战马: 1 }, art: { 甲胄: 0.4, 火器: 1 }, guard: { 甲胄: 1.2, 兵刃: 1 } };
  var NEED_DEFAULT = { 甲胄: 0.6, 兵刃: 1 };

  function needPerSoldier(sub, arm) { return NEED[sub] || NEED_BY_ARM[arm] || NEED_DEFAULT; }

  /* units[](或队列) → 军备需求总量(units 各含 sub/arm/men) */
  function needForUnits(units) {
    var need = {};
    (units || []).forEach(function (u) {
      if (!u) return;
      var per = needPerSoldier(u.sub, u.arm), men = num(u.men != null ? u.men : u.soldiers, 0);
      for (var k in per) if (per.hasOwnProperty(k)) need[k] = num(need[k], 0) + per[k] * men;
    });
    for (var k2 in need) if (need.hasOwnProperty(k2)) need[k2] = Math.round(need[k2]);
    return need;
  }
  /* 一兵种 N 卒 → 需求(募兵单兵种便捷) */
  function needForTroops(sub, arm, men) {
    var per = needPerSoldier(sub, arm), need = {}, m = num(men, 0);
    for (var k in per) if (per.hasOwnProperty(k)) need[k] = Math.round(per[k] * m);
    return need;
  }

  /* 军器局每回合基础产能(试玩调·Slice 2 接工部经费 scale) */
  var PRODUCE_BASE = { 甲胄: 1200, 兵刃: 1500, 弓弩: 600, 火器: 400, 战马: 300 };
  function produce(GM, scale) {
    scale = num(scale, 1); var amt = {};
    CAT_KEYS.forEach(function (k) { amt[k] = Math.round(num(PRODUCE_BASE[k], 0) * scale); });
    add(GM, amt, '军器局');
    return amt;
  }

  /* 装备充裕度(0~1):一军 units[] 需求 vs 当前库存·供 UI 显缺口 / Slice4 喂品质 */
  function supplyRatio(GM, units) {
    var need = needForUnits(units), have = allStock(GM), worst = 1, any = false;
    for (var k in need) if (need.hasOwnProperty(k) && need[k] > 0) {
      any = true; var r = num(have[k], 0) / need[k]; if (r < worst) worst = r;
    }
    return any ? Math.max(0, Math.min(1, worst)) : 1;
  }

  /* ═══════════ 原料库(铁/硝石/皮革/木)· Slice 2 ═══════════
   * 军工建筑(Slice 3-4)消耗原料造军备。原料挂地块矿冶/牧/林产出(与地块字段结合)·每回合汇入。
   * GM.guoku.materials.{铁,硝石,皮革,木} 同账本形状。 */
  var MAT_CATS = [
    { key: '铁', label: '铁', desc: '甲胄/兵刃/弓弩之本', icon: '铁' },
    { key: '硝石', label: '硝石', desc: '火药火器之本', icon: '硝' },
    { key: '皮革', label: '皮革', desc: '甲胄/靴具/弓筋', icon: '革' },
    { key: '木', label: '木', desc: '弓胎/箭杆/枪杆/车械', icon: '木' }
  ];
  var MAT_KEYS = MAT_CATS.map(function (c) { return c.key; });

  function ensureMaterials(GM) {
    if (!GM || typeof GM !== 'object') return null;
    if (!GM.guoku || typeof GM.guoku !== 'object') GM.guoku = {};
    if (!GM.guoku.materials || typeof GM.guoku.materials !== 'object') GM.guoku.materials = {};
    var M = GM.guoku.materials;
    MAT_KEYS.forEach(function (k) { ensureLedger(M, k); });
    return M;
  }
  function matStock(GM, k) { var M = ensureMaterials(GM); return M && M[k] ? num(M[k].stock, 0) : 0; }
  function matAllStock(GM) { var M = ensureMaterials(GM), o = {}; if (M) MAT_KEYS.forEach(function (k) { o[k] = num(M[k].stock, 0); }); return o; }
  function matAdd(GM, amounts, tag) {
    var M = ensureMaterials(GM); if (!M) return { added: {} }; amounts = amounts || {};
    var added = {};
    MAT_KEYS.forEach(function (k) { var amt = num(amounts[k], 0); if (amt <= 0) return; var l = M[k]; l.stock = num(l.stock, 0) + amt; l.thisTurnIn = num(l.thisTurnIn, 0) + amt; added[k] = amt; });
    return { added: added };
  }
  function matSpend(GM, amounts, tag) {
    var M = ensureMaterials(GM); if (!M) return { deducted: {}, shortfall: {}, anyShort: false }; amounts = amounts || {};
    var ded = {}, sh = {}, anyShort = false;
    MAT_KEYS.forEach(function (k) {
      var need = num(amounts[k], 0); if (need <= 0) return;
      var l = M[k], have = num(l.stock, 0), take = Math.min(have, need);
      l.stock = have - take; l.thisTurnOut = num(l.thisTurnOut, 0) + take; ded[k] = take;
      if (need > take + 1e-6) { sh[k] = need - take; anyShort = true; }
    });
    return { deducted: ded, shortfall: sh, anyShort: anyShort };
  }
  function matRollTurn(GM) { var M = ensureMaterials(GM); if (!M) return; MAT_KEYS.forEach(function (k) { var l = M[k]; l.lastTurnIn = num(l.thisTurnIn, 0); l.lastTurnOut = num(l.thisTurnOut, 0); l.thisTurnIn = 0; l.thisTurnOut = 0; }); }

  /* 一区划 → 原料产出(挂地块 economyBase + tags·矿区产铁硝·牧区产皮·农林产木·试玩调·后可升为显式 economyBase 字段) */
  /* 系数标定到「全国每回合数万」级(与装备需求同量级·才有稀缺·锚:全国矿产~2600万两/马政~110万匹/田~11.6亿亩·均试玩调) */
  function regionMaterialOutput(region) {
    if (!region) return {};
    var eb = region.economyBase || region.econ || {};
    var mineral = num(eb.mineralProduction, 0), horse = num(eb.horseProduction, 0), farm = num(eb.farmland, 0);
    return {
      铁: Math.round(mineral * 0.0015),                       // 矿课→铁(主料·全国~39000/回合)
      硝石: Math.round(mineral * 0.0003),                     // 矿课→硝石(火器专·全国~7900/回合)
      皮革: Math.round(horse * 0.01 + farm * 0.000005),       // 牧区马政+耕牛(全国~17000/回合)
      木: Math.round(farm * 0.00002)                          // 农林田亩折算(全国~23000/回合)
    };
  }
  function _walkDiv(d, out) { if (!d) return; out.push(d); if (Array.isArray(d.children)) d.children.forEach(function (c) { _walkDiv(c, out); }); }
  function _allRegions(GM) {
    var out = [];
    try {
      if (GM && GM.adminHierarchy) for (var f in GM.adminHierarchy) { var divs = GM.adminHierarchy[f] && GM.adminHierarchy[f].divisions; if (Array.isArray(divs)) divs.forEach(function (d) { _walkDiv(d, out); }); }
      if (!out.length && GM && Array.isArray(GM.regions)) GM.regions.forEach(function (r) { out.push(r); });
    } catch (e) {}
    return out;
  }
  /* 汇集区划原料产出 → 入原料库(每回合·regions 不传则取全部·Slice4 传玩家辖区) */
  function collectMaterials(GM, regions) {
    var rs = regions || _allRegions(GM), total = {};
    (rs || []).forEach(function (r) { var o = regionMaterialOutput(r); for (var k in o) if (o.hasOwnProperty(k)) total[k] = num(total[k], 0) + o[k]; });
    matAdd(GM, total, '矿冶');
    return total;
  }

  /* ═══════════ 剧本初值 / 默认 seed / AI 摘要(五通道集成) ═══════════ */
  var ARMORY_DEFAULT = { 甲胄: 40000, 兵刃: 50000, 弓弩: 15000, 火器: 10000, 战马: 12000 };   // 开局国库军备储(试玩调)
  var MATERIALS_DEFAULT = { 铁: 80000, 硝石: 12000, 皮革: 20000, 木: 30000 };
  /* 逐类装初值:剧本有则用·缺类回退默认(部分设定不致其余类落0) */
  function _seedStocks(ledgers, src, def, keys) {
    src = src || {};
    keys.forEach(function (k) { var v = (src[k] != null && isFinite(+src[k])) ? +src[k] : def[k]; ensureLedger(ledgers, k); ledgers[k].stock = Math.max(0, Math.round(v || 0)); });
  }
  /* 按现有军队规模派生起始武库(全军装备需求 × 备用比例·代表"在库余械")·不依赖剧本数据管线·空军返null */
  function _armyDerivedArmory(GM) {
    var armies = (GM && GM.armies) || []; if (!armies.length) return null;
    var total = {}, any = false;
    armies.forEach(function (a) {
      if (!a) return;
      var units = (typeof window !== 'undefined' && window.TMArmyUnits) ? window.TMArmyUnits.ensureArmyUnits(a) : (a.units || []);
      var n = needForUnits(units);
      for (var k in n) if (n.hasOwnProperty(k)) { total[k] = num(total[k], 0) + n[k]; any = true; }
    });
    if (!any) return null;
    var RESERVE = 0.35;   // 武库储=全军装备×35%(余械备用·非全军重装一遍)
    var def = {}; CAT_KEYS.forEach(function (k) { def[k] = total[k] ? Math.round(total[k] * RESERVE) : ARMORY_DEFAULT[k]; });
    return def;
  }
  /* 开局装初值·优先级:剧本显式 > 按军队派生 > 平默认(逐类)·一次性(_armorySeeded 守·防读档重置玩家库存) */
  function seedFromScenario(GM, scGuoku) {
    var A = ensure(GM), M = ensureMaterials(GM); if (!A) return false;
    if (GM.guoku._armorySeeded) return false;
    scGuoku = scGuoku || {};
    var armoryDef = scGuoku.armory ? null : _armyDerivedArmory(GM);   // 剧本无显式→按现有军队派生(天启大军→大武库)
    _seedStocks(A, scGuoku.armory, armoryDef || ARMORY_DEFAULT, CAT_KEYS);
    _seedStocks(M, scGuoku.materials, MATERIALS_DEFAULT, MAT_KEYS);
    GM.guoku._armorySeeded = true;
    return true;
  }
  /* AI 推演 / 问天可读的紧凑摘要 */
  function summaryForAI(GM) { return { 军备库: allStock(GM), 原料库: matAllStock(GM) }; }

  /* AI 推演可读的「军备研判」:逐类 储备 vs 全军装备总需求 → 充裕比 + 紧缺研判。
   * 原始库存数字(allStock)之上的「可行动情报」:让推演知军备虚实(火器紧缺→不宜倚火器决胜/敌可乘),
   * 而非只见数字。纯函数读 GM 不改(read-only·永不崩·空军队/空 GM 皆安全)。 */
  function readinessForAI(GM) {
    var armies = (GM && GM.armies) || [];
    var demand = {};
    armies.forEach(function (a) {
      if (!a) return;
      var units = (typeof window !== 'undefined' && window.TMArmyUnits && window.TMArmyUnits.ensureArmyUnits) ? window.TMArmyUnits.ensureArmyUnits(a) : (a.units || []);
      var n = needForUnits(units);
      for (var k in n) if (n.hasOwnProperty(k)) demand[k] = num(demand[k], 0) + num(n[k], 0);
    });
    var have = allStock(GM) || {}, by = {}, worst = null;
    CAT_KEYS.forEach(function (k) {
      var d = num(demand[k], 0), s = num(have[k], 0);
      var ratio = d > 0 ? Math.round((s / d) * 100) / 100 : null;
      var level = (ratio === null) ? '不需' : (ratio >= 1 ? '充盈' : (ratio >= 0.5 ? '够用' : (ratio >= 0.2 ? '偏紧' : '紧缺')));
      by[k] = { stock: s, demand: d, ratio: ratio, level: level };
      if (ratio !== null && (worst === null || ratio < worst.ratio)) worst = { cat: k, ratio: ratio, level: level };
    });
    var note = worst ? (worst.ratio < 0.5 ? (worst.cat + '紧缺·储备仅及全军需求' + Math.round(worst.ratio * 100) + '%') : '军备储备尚足') : '无在役军队';
    return { byCategory: by, worst: worst, note: note };
  }

  /* ═══════════ 军工建筑产能(S3:每回合消耗原料产军备·新流量模型·非一次性) ═══════════
   * 一座军工建筑每回合按 profile 产军备:{produce:{军备类:量/级}, consume:{原料类:量/级}}(每级·每回合)。
   * 来源优先级:AI 核定(building.effectsStructured.armoryProfile)> 名称关键词默认 > 无(非军工建筑)。
   * 朝代中立:关键词望文生义·命名开放(玩家自拟营建任意名·AI 判产出类型)。 */
  var BUILD_PROFILES = [
    [/火药|火器局|铳炮局|神机|硝磺/, { produce: { 火器: 800 }, consume: { 硝石: 600, 铁: 400 }, label: '火器 800/级·耗硝石铁' }],
    [/弓弩|弓箭|箭矢|弦/, { produce: { 弓弩: 1200 }, consume: { 木: 800, 皮革: 400, 铁: 300 }, label: '弓弩 1200/级·耗木皮铁' }],
    [/甲胄|铠甲|盔甲|甲坊|皮甲/, { produce: { 甲胄: 1500 }, consume: { 铁: 1200, 皮革: 600 }, label: '甲胄 1500/级·耗铁皮' }],
    [/军器|兵仗|铁工|冶铁|锻造|械|刀枪|兵器/, { produce: { 兵刃: 2000, 甲胄: 800 }, consume: { 铁: 2200, 木: 500 }, label: '兵刃2000甲胄800/级·耗铁木' }]
    /* 战马不在此·走马政(各省 horseProduction)·马场/牧场建筑经现有 DEFAULT_FX 提 horseProduction 间接增产战马 */
  ];
  /* 一座建筑 → 每回合军工产能 profile(null=非军工建筑)·AI核定优先·否则关键词 */
  function buildingArmoryProfile(b) {
    if (!b) return null;
    var es = b.effectsStructured || b.effects || {};
    if (es.armoryProfile && (es.armoryProfile.produce || es.armoryProfile.consume))   // ★AI 核定的产能档(自拟营建判原料/产出/产出类型)
      return { produce: es.armoryProfile.produce || {}, consume: es.armoryProfile.consume || {}, label: es.armoryProfile.label || '军工(核定)', src: 'ai' };
    var name = String(b.name || b['名称'] || '');
    for (var i = 0; i < BUILD_PROFILES.length; i++) if (BUILD_PROFILES[i][0].test(name)) {
      var p = BUILD_PROFILES[i][1]; return { produce: p.produce, consume: p.consume, label: p.label, src: 'keyword' };
    }
    return null;
  }
  function isArmoryWorks(b) { return !!buildingArmoryProfile(b); }

  /* 各区划在役建筑(status==='completed'·过滤无 status 者视为在役) */
  function _allBuildings(GM) {
    var out = [];
    _allRegions(GM).forEach(function (r) { if (r && Array.isArray(r.buildings)) r.buildings.forEach(function (b) { out.push(b); }); });
    return out;
  }
  /* 原料充足度(0~1):一组消耗 vs 当前原料库·取最缺类比例 */
  function _matAvailability(GM, want) {
    var have = matAllStock(GM), ratio = 1, any = false;
    for (var k in want) if (want.hasOwnProperty(k) && want[k] > 0) { any = true; var r = num(have[k], 0) / want[k]; if (r < ratio) ratio = r; }
    return any ? Math.max(0, Math.min(1, ratio)) : 1;
  }
  /* 玩家势力名 + 玩家辖区(原料/产能只算玩家territory·非传则取玩家辖区·兜底全区划) */
  function playerFactionOf(GM) {
    var P = (typeof window !== 'undefined' && window.P) || (typeof global !== 'undefined' && global.P) || null;
    return (P && P.playerInfo && P.playerInfo.factionName) || (GM && GM.playerFaction) || null;
  }
  function playerRegions(GM) {
    var pf = playerFactionOf(GM);
    if (GM && GM.adminHierarchy) {
      var keys = ['player']; if (pf) keys.push(pf);   // 玩家辖区常以 'player' key·或 faction 名
      for (var i = 0; i < keys.length; i++) {
        var node = GM.adminHierarchy[keys[i]];
        if (node && Array.isArray(node.divisions) && node.divisions.length) { var out = []; node.divisions.forEach(function (d) { _walkDiv(d, out); }); if (out.length) return out; }
      }
    }
    return _allRegions(GM);   // 兜底:key 不匹配→全区划(不回归)
  }
  /* 军工效率 = 工部主官效率 ×(1−腐败截留)·无主官 0.9 基线·腐败最多削 40% */
  function _armoryEfficiency(GM) {
    var eff = 0.9;
    if (GM && Array.isArray(GM.chars)) for (var i = 0; i < GM.chars.length; i++) {
      var c = GM.chars[i];
      if (c && !c.dead && /工部尚书/.test(String(c.officialTitle || c.title || ''))) {
        var intel = num(c.intelligence != null ? c.intelligence : c['智力'], 55);
        eff = 0.82 + Math.max(0, Math.min(100, intel)) / 100 * 0.36; break;   // 0.82~1.18
      }
    }
    var corr = num(GM && GM.corruption && (GM.corruption.trueIndex != null ? GM.corruption.trueIndex : GM.corruption.index), 0);
    var skim = Math.max(0, Math.min(0.4, corr / 100 * 0.4));
    return Math.max(0.2, eff * (1 - skim));
  }
  var _ARMORY_SILVER = { 甲胄: 0.4, 兵刃: 0.15, 弓弩: 0.25, 火器: 0.8 };   // 工料匠饷·银/件(战马走马政不计此)

  /* 每回合军工生产:在役军工建筑按 profile×level 耗原料产军备(原料不足按比例减产)+ 战马走马政(Σ各省 horseProduction)。
   * opts.efficiency 未传则按 工部主官×腐败 计·opts.regions 未传取玩家辖区·军工经费(银)从国库扣(不继记欠·材料才是硬约束)。 */
  function runArmoryProduction(GM, opts) {
    opts = opts || {}; ensure(GM); ensureMaterials(GM);
    var report = { works: 0, produced: {}, consumed: {} };
    var eff = opts.efficiency != null ? num(opts.efficiency, 1) : _armoryEfficiency(GM);
    var regions = opts.regions || playerRegions(GM);
    var buildings = opts.buildings || _allBuildings(GM);
    buildings.forEach(function (b) {
      if (!b || (b.status && b.status !== 'completed')) return;
      var prof = buildingArmoryProfile(b); if (!prof) return;
      var level = Math.max(1, Math.round(num(b.level, 1)));
      var wantC = {}, wantP = {}, ck, pk;
      for (ck in prof.consume) wantC[ck] = num(prof.consume[ck], 0) * level;
      for (pk in prof.produce) wantP[pk] = num(prof.produce[pk], 0) * level;
      var scale = _matAvailability(GM, wantC) * eff;
      if (scale <= 0) return;
      var rc = {}; for (ck in wantC) rc[ck] = Math.round(wantC[ck] * scale);
      matSpend(GM, rc, '军工·' + (b.name || ''));
      var rp = {}; for (pk in wantP) rp[pk] = Math.round(wantP[pk] * scale);
      add(GM, rp, '军工·' + (b.name || ''));
      report.works++;
      for (var c2 in rc) report.consumed[c2] = num(report.consumed[c2], 0) + rc[c2];
      for (var p2 in rp) report.produced[p2] = num(report.produced[p2], 0) + rp[p2];
    });
    /* 战马走马政:Σ玩家辖区 horseProduction(匹/年)×折率 → 战马入库(马场建筑经 horseProduction 间接增产) */
    var horseTotal = 0;
    regions.forEach(function (r) { horseTotal += num((r && (r.economyBase || r.econ) || {}).horseProduction, 0); });
    var horseOut = Math.round(horseTotal * num(opts.horseRate, 0.004) * eff);
    if (horseOut > 0) { add(GM, { 战马: horseOut }, '马政'); report.produced['战马'] = num(report.produced['战马'], 0) + horseOut; }
    /* 军工经费(银·工料匠饷)·从国库扣·不继记欠(不阻产·材料才是硬约束·战马不计) */
    var silverCost = 0;
    for (var pk2 in report.produced) silverCost += num(report.produced[pk2], 0) * num(_ARMORY_SILVER[pk2], 0);
    silverCost = Math.round(silverCost);
    report.silverCost = silverCost; report.efficiency = +eff.toFixed(3);
    if (silverCost > 0 && !opts.noSilver) {
      var FE = (typeof window !== 'undefined' && window.FiscalEngine) || (typeof global !== 'undefined' && global.FiscalEngine);
      if (FE && typeof FE.spendFromGuoku === 'function') { try { var sp = FE.spendFromGuoku({ money: silverCost }, '军工经费'); report.silverDeficit = (sp && sp.deducted && sp.deducted.money && sp.deducted.money.deficit) || 0; } catch (e) {} }
    }
    return report;
  }
  /* 整回合军工/原料循环:翻转(上回合 this→last)→地块产原料→军工生产。供过回合一步调。 */
  function runTurn(GM, opts) {
    opts = opts || {};
    rollTurn(GM); matRollTurn(GM);
    var regions = opts.regions || playerRegions(GM);   // 原料/产能只算玩家辖区
    collectMaterials(GM, regions);
    return runArmoryProduction(GM, Object.assign({ regions: regions }, opts));
  }

  /* 募兵从武库支取:按新增兵卒的兵种算装备需求→扣武库·返缺口严重度(供调用方降装备/挫士气)。
   * army.soldiers 为增后总兵·addedTroops 为增量→按比例取新卒需求。无 units 派生时按兵力估。 */
  function consumeForRecruit(GM, army, addedTroops) {
    ensure(GM);
    addedTroops = Math.max(0, Math.round(num(addedTroops, 0)));
    if (!army || addedTroops <= 0) return null;
    var units = (typeof window !== 'undefined' && window.TMArmyUnits && window.TMArmyUnits.ensureArmyUnits) ? window.TMArmyUnits.ensureArmyUnits(army) : (army.units || []);
    var fullNeed = needForUnits(units);
    var totalMen = num(army.soldiers || army.strength, 0) || addedTroops;
    var frac = totalMen > 0 ? Math.min(1, addedTroops / totalMen) : 1;
    var need = {}, hasNeed = false;
    for (var k in fullNeed) if (fullNeed.hasOwnProperty(k) && fullNeed[k] > 0) { need[k] = Math.round(fullNeed[k] * frac); hasNeed = true; }
    if (!hasNeed) { need = { 甲胄: Math.round(addedTroops * 0.6), 兵刃: addedTroops }; }   // 无 units→按兵力估(甲胄+兵刃)
    var sp = spend(GM, need, '募兵·' + (army.name || ''));
    var needSum = 0, shortSum = 0, n, s;
    for (n in need) needSum += need[n];
    for (s in sp.shortfall) shortSum += sp.shortfall[s];
    var shortRatio = needSum > 0 ? Math.max(0, Math.min(1, shortSum / needSum)) : 0;
    return {
      need: need, deducted: sp.deducted, shortfall: sp.shortfall, anyShort: sp.anyShort, shortRatio: shortRatio,
      condition: shortRatio > 0.5 ? '严重不足' : shortRatio > 0.2 ? '简陋' : (shortRatio > 0 ? '不足' : null),
      moralePenalty: shortRatio > 0 ? Math.round(6 + shortRatio * 12) : 0   // 缺装备→新军士气挫 6~18
    };
  }

  /* 会战缴获(双向):胜方从败方参战部队损失兵卒的装备缴获一部(余损毁·缴获率0.3)。
   * 玩家胜→入武库;玩家败→己方败军装备折损(equipmentCondition 降·缴获被敌得不入我库)。非玩家战→无效。 */
  function _findArmyById(GM, id) {
    var arr = (GM && GM.armies) || [];
    for (var i = 0; i < arr.length; i++) if (arr[i] && (arr[i].id === id || arr[i].armyId === id)) return arr[i];
    return null;
  }
  function _degradeCondition(c) {
    c = String(c || '');
    if (/严重不足/.test(c)) return '严重不足';
    if (/简陋|不足/.test(c)) return '严重不足';
    if (/优良|精良/.test(c)) return '一般';
    return '简陋';
  }
  function battleSpoils(GM, br, playerFaction) {
    if (!br || !Array.isArray(br.affectedArmies) || !br.affectedArmies.length) return null;
    ensure(GM);
    var pf = playerFaction || playerFactionOf(GM);
    var winner = br.winnerFactionId || br.winner || null;
    if (!winner || !pf) return null;
    var playerWon = String(winner) === String(pf);
    var RATE = 0.3, captured = {}, anyCap = false, playerLost = false;
    br.affectedArmies.forEach(function (aa) {
      var army = _findArmyById(GM, aa.armyId);
      var fac = aa.faction || (army && army.faction) || '';
      if (String(fac) === String(winner)) return;        // 胜方不缴自己
      var loss = num(aa.loss, 0); if (loss <= 0) return;  // 败方损失兵卒的装备→可缴
      var units = army ? ((typeof window !== 'undefined' && window.TMArmyUnits && window.TMArmyUnits.ensureArmyUnits) ? window.TMArmyUnits.ensureArmyUnits(army) : army.units) : null;
      var per;
      if (units && units.length) { var men = 0; units.forEach(function (u) { men += num(u.men || u.soldiers, 0); }); var fn = needForUnits(units); per = {}; for (var k in fn) per[k] = men > 0 ? fn[k] / men : 0; }
      else per = { 甲胄: 0.6, 兵刃: 1 };
      for (var c in per) { var cap = Math.round(per[c] * loss * RATE); if (cap > 0) { captured[c] = num(captured[c], 0) + cap; anyCap = true; } }
      if (String(fac) === String(pf)) playerLost = true;
    });
    if (playerWon && anyCap) add(GM, captured, '会战缴获');
    if (!playerWon && playerLost) br.affectedArmies.forEach(function (aa) {   // 玩家败→败军装备折损
      var army = _findArmyById(GM, aa.armyId);
      if (army && String(army.faction) === String(pf) && num(aa.loss, 0) > 0) army.equipmentCondition = _degradeCondition(army.equipmentCondition);
    });
    return { playerWon: playerWon, captured: captured, anyCaptured: anyCap, playerLost: playerLost };
  }

  /* 采买(治理·应急外购)·银→军备/原料·市价>自产(溢价·火器/战马尤贵)·国库不继按可负担缩量。
   * 渠道受限(火器须开海通贡·马须茶马互市)由 AI 核定把关·此处只做银→货转换。opts.unitPrice 可覆盖市价。 */
  var PROCURE_PRICE = { 甲胄: 1.5, 兵刃: 0.8, 弓弩: 1.2, 火器: 4, 战马: 12, 铁: 1, 硝石: 2.5, 皮革: 1.2, 木: 0.6 };
  function procure(GM, category, quantity, opts) {
    opts = opts || {}; ensure(GM); ensureMaterials(GM);
    quantity = Math.max(0, Math.round(num(quantity, 0)));
    var isArmory = CAT_KEYS.indexOf(category) >= 0, isMat = MAT_KEYS.indexOf(category) >= 0;
    if ((!isArmory && !isMat) || quantity <= 0) return null;
    var price = num(opts.unitPrice, PROCURE_PRICE[category] || (isMat ? 0.5 : 1.5));
    var cost = Math.round(quantity * price);
    var avail = (GM.guoku && (GM.guoku.money != null ? GM.guoku.money : GM.guoku.balance));
    var afford = 1;
    if (cost > 0 && avail != null && Number(avail) < cost) afford = Math.max(0, Number(avail) / cost);
    var realQty = Math.round(quantity * afford), realCost = Math.round(cost * afford);
    if (realQty <= 0) return { category: category, realQty: 0, cost: 0, requested: quantity, afford: afford, blocked: true };
    var FE = (typeof window !== 'undefined' && window.FiscalEngine) || (typeof global !== 'undefined' && global.FiscalEngine);
    if (realCost > 0 && FE && typeof FE.spendFromGuoku === 'function') { try { FE.spendFromGuoku({ money: realCost }, '采买·' + category); } catch (e) {} }
    var o = {}; o[category] = realQty;
    if (isArmory) add(GM, o, '采买'); else matAdd(GM, o, '采买');
    return { category: category, realQty: realQty, cost: realCost, requested: quantity, afford: afford };
  }

  var API = {
    CATS: CATS, CAT_KEYS: CAT_KEYS, NEED: NEED, PRODUCE_BASE: PRODUCE_BASE,
    ARMORY_DEFAULT: ARMORY_DEFAULT, MATERIALS_DEFAULT: MATERIALS_DEFAULT, seedFromScenario: seedFromScenario, summaryForAI: summaryForAI, readinessForAI: readinessForAI,
    BUILD_PROFILES: BUILD_PROFILES, buildingArmoryProfile: buildingArmoryProfile, isArmoryWorks: isArmoryWorks,
    runArmoryProduction: runArmoryProduction, runTurn: runTurn, consumeForRecruit: consumeForRecruit, battleSpoils: battleSpoils,
    playerRegions: playerRegions, playerFactionOf: playerFactionOf, procure: procure, PROCURE_PRICE: PROCURE_PRICE,
    ensure: ensure, stock: stock, allStock: allStock, add: add, spend: spend, rollTurn: rollTurn,
    needPerSoldier: needPerSoldier, needForUnits: needForUnits, needForTroops: needForTroops,
    produce: produce, supplyRatio: supplyRatio,
    MAT_CATS: MAT_CATS, MAT_KEYS: MAT_KEYS, ensureMaterials: ensureMaterials, matStock: matStock, matAllStock: matAllStock,
    matAdd: matAdd, matSpend: matSpend, matRollTurn: matRollTurn, regionMaterialOutput: regionMaterialOutput, collectMaterials: collectMaterials
  };
  if (typeof window !== 'undefined') window.TMArmory = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
