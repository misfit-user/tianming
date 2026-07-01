/* ============================================================
 * tm-building-works.js — 建筑工役引擎（2026-06-12）
 *
 * 修复建筑系统三处断头（设计案 web/docs/region-panel-buildings-fields-design-2026-06.md §2）：
 *   ① 工期 tick：division.buildings[].remainingTurns 此前落库后无人递减——在建永远在建；
 *   ② 效果入账：judgedEffects 纯文本不入账——建了等于没建；
 *   ③ 维护费：无任何维护开销。
 *
 * 账路范式（铁律=改源头叶子，杜绝直写聚合值）：
 *   - 经济效果统一「存量模型」：完工一次性写 economyBase 叶子（farmland/commerceVolume/盐矿渔马…），
 *     cascade 的 taxBase() 每回合读 economyBase 计税 → 等效持续流量收入，零侵入、无累积漂移。
 *   - 城防：写 division.fortLevel（围城结算 tm-endturn-apply 读链已接此层）。
 *   - 民心：完工小赏摊到该区划叶子 minxin（封顶 ±2/座），回合末 aggregate 自然聚合。
 *   - 吏治：行政类建筑微降 corruptionLocal（computeTaxAmount 的 corrPenalty + aggregate 都读它）。
 *   - 维护费走「地方留用」：扣 division.publicTreasury.money（地方的业地方养），连欠 3 回合
 *     降为 neglected（叙事接手），非玄幻惩罚。
 *   - appliedDelta 记每笔实际写入量 → 拆毁(destroy)可逆回退。
 *
 * 效果来源优先级：剧本模板 buildingTypes[i].effects（编辑器面，作者准账）
 *   > 实例 effectsStructured（AI 核定·二期接 schema）
 *   > DEFAULT_FX 推断表（名称关键词→白名单效果·比例增量适配大小剧本）。
 * ============================================================ */
(function () {
  'use strict';

  // 完工效果只许落这些账（白名单·apply 硬门——名单外路径静默丢弃并记日志）
  var WHITELIST = {
    'economyBase.farmland': 1,
    'economyBase.commerceVolume': 1,
    'economyBase.commerceCoefficient': 1,
    'economyBase.maritimeTradeVolume': 1,
    'economyBase.saltProduction': 1,
    'economyBase.mineralProduction': 1,
    'economyBase.fishingProduction': 1,
    'economyBase.horseProduction': 1,
    'economyBase.postRelays': 1,
    'economyBase.roadQuality': 1,
    'economyBase.kejuQuota': 1,
    'fortLevel': 1,
    'coastalDefense': 1,
    'militaryRecruits': 1,
    'defenseBonus': 1,
    'officialSupply': 1
  };

  // 名称关键词 → 默认效果（pct=按现值比例·base=现值为零时的起步量·abs=绝对增量·均为「每级」）
  var DEFAULT_FX = [
    [/盐/, { pct: { 'economyBase.saltProduction': 0.08 }, base: { 'economyBase.saltProduction': 50000 }, label: '盐课 +8%/级' }],
    [/矿|冶|铁厂/, { pct: { 'economyBase.mineralProduction': 0.08 }, base: { 'economyBase.mineralProduction': 20000 }, label: '矿课 +8%/级' }],
    [/渔/, { pct: { 'economyBase.fishingProduction': 0.08 }, base: { 'economyBase.fishingProduction': 10000 }, label: '渔课 +8%/级' }],
    [/马场|马政|牧场/, { pct: { 'economyBase.horseProduction': 0.1 }, base: { 'economyBase.horseProduction': 500 }, label: '马政 +10%/级' }],
    [/垦|屯田|圩田|梯田|水利|灌|渠|堰|陂/, { pct: { 'economyBase.farmland': 0.03 }, base: { 'economyBase.farmland': 30000 }, label: '田亩 +3%/级' }],
    [/市舶|港|码头|船厂/, { pct: { 'economyBase.commerceVolume': 0.06, 'economyBase.maritimeTradeVolume': 0.1 }, base: { 'economyBase.commerceVolume': 20000, 'economyBase.maritimeTradeVolume': 5000 }, label: '商贸 +6% 海贸 +10%/级' }],
    [/钞关|税关|榷场|互市/, { pct: { 'economyBase.commerceVolume': 0.04 }, base: { 'economyBase.commerceVolume': 15000 }, label: '商贸 +4%/级' }],
    [/织造|工坊|窑|作坊/, { pct: { 'economyBase.commerceVolume': 0.05 }, base: { 'economyBase.commerceVolume': 15000 }, label: '商贸 +5%/级' }],
    [/驿/, { abs: { 'economyBase.postRelays': 5, 'economyBase.roadQuality': 3 }, label: '驿站 +5 道路 +3/级' }],
    [/道路|官道|驰道|桥/, { abs: { 'economyBase.roadQuality': 6 }, label: '道路 +6/级' }],
    [/水寨|船坞|水城|海防|靖海|海塘|水军|战船|舰队/, { abs: { coastalDefense: 1 }, label: '海防 +1 档/级' }],  // P1-A3·海防建筑放城防前·「水寨」先匹配海防不被「寨」截胡
    [/城|墙|关隘|堡|寨|垒|敌台|炮台/, { abs: { fortLevel: 1 }, label: '城防 +1 档/级' }],
    [/卫所|军府|营房|武库|校场/, { abs: { militaryRecruits: 3000 }, label: '募兵上限 +3000/级' }],
    [/书院|文庙|学宫|庠|县学|府学|国子|贡院/, { abs: { 'economyBase.kejuQuota': 2, officialSupply: 1 }, minxin: 1, label: '解额 +2/级 · 育官 +1/级 · 士民心悦' }],  // A4·书院育官→officialSupply 补地方官缺
    [/仓|廪|常平/, { minxin: 1, label: '赈备安民 · 民心 +1' }],
    [/烽|燧|哨|墩|戍|巡检/, { abs: { defenseBonus: 1 }, label: '边防戍守 +1 档/级' }]  // A4·烽燧/巡检→defenseBonus 降边警(原纯叙事·现真入账)
  ];

  // 类别兜底（名称无一命中时按 category）
  var CATEGORY_FX = {
    economic: { pct: { 'economyBase.commerceVolume': 0.03 }, base: { 'economyBase.commerceVolume': 10000 }, label: '商贸 +3%/级' },
    military: { abs: { militaryRecruits: 2000 }, label: '募兵上限 +2000/级' },
    cultural: { abs: { 'economyBase.kejuQuota': 1 }, minxin: 1, label: '解额 +1/级 · 文教渐兴' },
    administrative: { corruption: -2, minxin: 1, label: '吏治 -2 · 政声稍起' },
    religious: { minxin: 1, label: '安顿人心 · 民心 +1' },
    infrastructure: { abs: { 'economyBase.roadQuality': 4 }, label: '道路 +4/级' }
  };

  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }

  // Cost-driven yield boost: preset/inferred buildings have fixed per-level effects that ignore
  // actual spend -- a 5,000,000-tael mine yielded the same as a 50,000 one. Scale the absolute
  // economic-yield floor by how far costActual exceeds the type baseCost (capped 12x). Economic
  // yield paths only; fort/keju/recruits/minxin stay tiered, not money-scaled.
  var _ECON_YIELD = {
    'economyBase.saltProduction': 1, 'economyBase.mineralProduction': 1, 'economyBase.fishingProduction': 1,
    'economyBase.commerceVolume': 1, 'economyBase.maritimeTradeVolume': 1, 'economyBase.farmland': 1, 'economyBase.horseProduction': 1
  };
  function _costReturnBoost(bld, typeDef) {
    var actual = num(bld && bld.costActual, 0);
    var base = num(typeDef && typeDef.baseCost, 0);
    if (actual <= 0 || base <= 0) return 1;
    return Math.max(1, Math.min(24, actual / base)); // cap widened to 24x: big preset builds return more (custom_build uses the AI yardstick, not this)
  }

  function typeDefFor(name, P) {
    var types = (P && P.buildingSystem && P.buildingSystem.buildingTypes) || [];
    if (!name) return null;
    return types.find(function (t) { return t && t.name === name; }) || null;
  }

  // S3 费效封顶：AI 自拟 effectsStructured 以费用为度——十两银修不出雄关。
  // 费用档（costActual·两）→ 比例效果上限与重器门槛；越界削到顶、白名单外弃。
  function fxCostCaps(cost) {
    cost = num(cost, 0);
    if (cost >= 100000) return { pct: 0.25, keju: 3, fortOk: true };
    if (cost >= 20000) return { pct: 0.15, keju: 2, fortOk: true };
    if (cost >= 5000) return { pct: 0.08, keju: 2, fortOk: true };
    if (cost >= 500) return { pct: 0.03, keju: 1, fortOk: false };
    return { pct: 0.01, keju: 0, fortOk: false };
  }
  function sanitizeStructuredFx(raw, cost) {
    if (!raw || typeof raw !== 'object') return null;
    cost = num(cost, 0);
    var caps = fxCostCaps(cost);
    var out = {};
    var dropped = [];
    if (raw.pct && typeof raw.pct === 'object') {
      Object.keys(raw.pct).forEach(function (k) {
        if (!WHITELIST[k]) { dropped.push(k); return; }
        var v = num(raw.pct[k], 0); if (!v) return;
        if (!out.pct) out.pct = {};
        out.pct[k] = Math.max(-caps.pct, Math.min(caps.pct, v));
      });
    }
    if (raw.abs && typeof raw.abs === 'object') {
      Object.keys(raw.abs).forEach(function (k) {
        if (!WHITELIST[k]) { dropped.push(k); return; }
        var v = num(raw.abs[k], 0); if (!v) return;
        var cap;
        if (k === 'fortLevel') { if (!caps.fortOk) { dropped.push(k + '(费不及城防之度)'); return; } cap = 1; }
        else if (k === 'militaryRecruits') cap = Math.max(200, Math.round(cost / 4));
        else if (k === 'economyBase.kejuQuota') { if (caps.keju <= 0) { dropped.push(k + '(费不及学额之度)'); return; } cap = caps.keju; }
        else if (k === 'economyBase.roadQuality' || k === 'economyBase.postRelays') cap = Math.max(1, Math.min(10, Math.round(cost / 1500)));
        else if (k === 'economyBase.commerceCoefficient') cap = 0.05;
        else if (k === 'economyBase.horseProduction') cap = Math.max(50, Math.round(cost / 20));
        else if (k === 'defenseBonus') cap = Math.max(1, Math.min(6, Math.round(cost / 3000)));        // A4·边防工事档·小费小防(每档≈2000驻军之防·tickBorderRisk 消费)
        else if (k === 'officialSupply') { if (caps.keju <= 0) { dropped.push(k + '(费不及育官之度)'); return; } cap = caps.keju; }  // A4·育官同学额之度·tickOfficeVacancy 消费
        else cap = Math.max(100, Math.round(cost * 8)); // 大数账目（田亩/商贸/盐矿渔）兜底：费效挂钩
        if (!out.abs) out.abs = {};
        out.abs[k] = Math.max(-cap, Math.min(cap, v));
      });
    }
    if (raw.minxin != null) out.minxin = num(raw.minxin, 0);
    if (raw.corruption != null) out.corruption = num(raw.corruption, 0);
    if (raw.upkeepPerTurn != null) out.upkeepPerTurn = Math.max(0, num(raw.upkeepPerTurn, 0));
    if (raw.label) out.label = String(raw.label);
    // S2·制度性建筑：talentSource 透传为合法 effectsStructured 字段（不写区划叶，路由至 TalentBuildingBridge；年毕业数费效封顶在 bridge）
    if (raw.talentSource && typeof raw.talentSource === 'object') out.talentSource = raw.talentSource;
    if (dropped.length) { try { console.warn('[building-works] 自拟效果越界已削/弃:', dropped.join('、')); } catch (_) {} }
    return (out.pct || out.abs || out.minxin || out.corruption || out.upkeepPerTurn != null || out.label || out.talentSource) ? out : null;
  }

  // 解析一座建筑的「每级效果」。返回 { pct, base, abs, minxin, corruption, label }
  function resolveEffects(bld, typeDef) {
    if (typeDef && typeDef.effects && typeof typeDef.effects === 'object') return typeDef.effects; // 编辑器面准账（最高优先）
    if (bld && bld.effectsStructured && typeof bld.effectsStructured === 'object') {
      // AI 核定账（S3）——白名单+费效封顶后才认
      var sane = sanitizeStructuredFx(bld.effectsStructured, num(bld.costActual, num(typeDef && typeDef.baseCost, 0)));
      if (sane) return sane;
    }
    var name = String((bld && bld.name) || (typeDef && typeDef.name) || '');
    for (var i = 0; i < DEFAULT_FX.length; i += 1) {
      if (DEFAULT_FX[i][0].test(name)) return DEFAULT_FX[i][1];
    }
    var cat = (typeDef && typeDef.category) || (bld && bld.category) || '';
    return CATEGORY_FX[cat] || null;
  }

  // 效果 → 人话徽签（册页营造志显示）
  function fxLabels(bld, typeDef) {
    var fx = resolveEffects(bld, typeDef);
    var out = [];
    if (fx && fx.label) out.push(fx.label);
    else if (fx) {
      var NAMES = { 'economyBase.farmland': '田亩', 'economyBase.commerceVolume': '商贸', 'economyBase.commerceCoefficient': '商系数', 'economyBase.maritimeTradeVolume': '海贸', 'economyBase.saltProduction': '盐课', 'economyBase.mineralProduction': '矿课', 'economyBase.fishingProduction': '渔课', 'economyBase.horseProduction': '马政', 'economyBase.postRelays': '驿站', 'economyBase.roadQuality': '道路', 'economyBase.kejuQuota': '解额', fortLevel: '城防档', coastalDefense: '海防档', militaryRecruits: '募兵上限', defenseBonus: '边防档', officialSupply: '育官' };
      Object.keys(fx.pct || {}).forEach(function (k) { out.push((NAMES[k] || k) + ' +' + Math.round(fx.pct[k] * 100) + '%/级'); });
      Object.keys(fx.abs || {}).forEach(function (k) { out.push((NAMES[k] || k) + ' +' + fx.abs[k] + '/级'); });
      if (fx.minxin) out.push('民心 +' + fx.minxin);
      if (fx.corruption) out.push('吏治 ' + fx.corruption);
    }
    var up = upkeepFor(bld, typeDef);
    if (up > 0) out.push('维护 ' + up + ' 两/回合');
    return out;
  }

  // S6·维护费分档：军工/城防/水利贵养(3%)·文教/仓廪/宗教廉养(1.2%)·余 2%。跨朝代通用词(军/城/水利/书院/仓·非朝代专名)。
  function _upkeepRateFor(bld, typeDef) {
    var cat = (typeDef && typeDef.category) || (bld && bld.category) || '';
    var name = String((bld && bld.name) || (typeDef && typeDef.name) || '');
    if (cat === 'military' || /军|武|火药|甲坊|弩|战船|水寨|城|墙|关|隘|堡|垒|敌台|炮台|船坞/.test(name)) return 0.03;  // 军工/城防贵养
    if (/水利|河渠|渠|堰|陂|圩|闸|港|码头|漕/.test(name)) return 0.03;                                                  // 水利贵养
    if (cat === 'cultural' || cat === 'religious' || /书院|学宫|文庙|府学|县学|国子|贡院|仓|廪|常平|义仓|庙|祠/.test(name)) return 0.012;  // 文教/仓廪/宗教廉养
    return 0.02;
  }

  function upkeepFor(bld, typeDef) {
    var fx = resolveEffects(bld, typeDef);
    if (fx && fx.upkeepPerTurn != null) return Math.max(0, Math.round(num(fx.upkeepPerTurn)));
    var cost = num(bld && bld.costActual, num(typeDef && typeDef.baseCost, 0));
    if (cost <= 0) return 0;
    return Math.max(10, Math.round(cost * _upkeepRateFor(bld, typeDef))); // S6·按类分档(原一刀切 2%)
  }

  // S7·营造可观测账：一座建筑的「真贡献」（实入账 appliedDelta·非 per-level 规则）+ 维护 + 工成之利 + 半损态。
  //   实入账=完工真写进叶子的增量(经费效封顶/造价放大后的实值)·让玩家看见每座建筑究竟为本地添了什么。
  var _LEDGER_NAMES = {
    'economyBase.farmland': '田亩', 'economyBase.commerceVolume': '商贸', 'economyBase.commerceCoefficient': '商系数',
    'economyBase.maritimeTradeVolume': '海贸', 'economyBase.saltProduction': '盐课', 'economyBase.mineralProduction': '矿课',
    'economyBase.fishingProduction': '渔课', 'economyBase.horseProduction': '马政', 'economyBase.postRelays': '驿站',
    'economyBase.roadQuality': '道路', 'economyBase.kejuQuota': '解额', fortLevel: '城防档', coastalDefense: '海防档',
    militaryRecruits: '募兵上限', defenseBonus: '边防档', officialSupply: '育官'
  };
  function _fmtLedgerAmt(v) { return (Math.abs(v) >= 10000) ? (Math.round(v / 1000) / 10 + '万') : String(v); }
  function buildingLedger(bld, typeDef) {
    var applied = (bld && bld.appliedDelta) || {};
    var lines = [];
    Object.keys(applied).forEach(function (k) {
      if (k === '_minxin') { if (num(applied[k])) lines.push('民心 ' + (applied[k] > 0 ? '+' : '') + num(applied[k])); return; }
      if (k === '_corruption') { if (num(applied[k])) lines.push('吏治 ' + (applied[k] > 0 ? '+' : '') + num(applied[k])); return; }
      var v = num(applied[k]); if (!v) return;
      lines.push((_LEDGER_NAMES[k] || k) + ' ' + (v > 0 ? '+' : '') + _fmtLedgerAmt(v));
    });
    var cost = num(bld && bld.costActual, num(typeDef && typeDef.baseCost, 0));
    var flow = Math.round(buildingFlowPct(cost) * Math.max(1, num(bld && bld.level, 1)) * 1000) / 10;  // 工成之利 岁入 %/回合(1 位小数)
    return {
      applied: lines,                                   // 实入账(真为本地所添·已入账)
      upkeep: upkeepFor(bld, typeDef),                  // 养护 两/回合(S6 分档)
      flowPct: flow > 0 ? flow : 0,                     // 工成之利·岁入 +X%/回合
      damaged: !!(bld && (bld.status === 'damaged' || bld._damageReverted)),
      status: (bld && bld.status) || 'completed'
    };
  }

  function getPath(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i += 1) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function addPath(div, path, delta) {
    var parts = path.split('.');
    var cur = div;
    for (var i = 0; i < parts.length - 1; i += 1) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    var leaf = parts[parts.length - 1];
    cur[leaf] = num(cur[leaf], 0) + delta;
    return cur[leaf];
  }

  // 摊民心到该区划叶子（封顶 |cap|）——叶子是 aggregate 的源头
  function spreadMinxin(div, delta, cap) {
    var d = Math.max(-Math.abs(cap), Math.min(Math.abs(cap), delta));
    if (!d) return;
    (function walk(node) {
      if (!node) return;
      var kids = node.children || node.divisions;
      if (!kids || !kids.length) {
        node.minxin = Math.max(0, Math.min(100, num(node.minxin, 60) + d));
        return;
      }
      kids.forEach(walk);
    })(div);
  }

  // 完工入账：白名单路径写叶子，记 appliedDelta（拆毁可逆）。幂等：appliedTurn 已存在则跳过。
  function applyCompletion(div, bld, P, GM) {
    if (!div || !bld) return false;
    if (bld.appliedTurn != null) return false;
    var _typeDef = typeDefFor(bld.name, P);
    var fx = resolveEffects(bld, _typeDef);
    bld.appliedTurn = (GM && GM.turn) || 0;
    if (!fx) return false; // 纯叙事建筑（烽燧等）：完工但不入账，AI prompt 可见其名
    // Boost only fixed-source effects (preset/inferred); AI custom_build already went through
    // fxCostCaps (cost-scaled), so do not double-scale it.
    var _fromStructured = !!(bld && bld.effectsStructured && !(_typeDef && _typeDef.effects));
    var _costBoost = _fromStructured ? 1 : _costReturnBoost(bld, _typeDef);
    var applied = {};
    var dropped = [];
    function addEntry(path, delta) {
      if (!WHITELIST[path]) { dropped.push(path); return; }
      if (!delta) return;
      addPath(div, path, delta);
      applied[path] = num(applied[path], 0) + delta;
    }
    Object.keys(fx.abs || {}).forEach(function (k) {
      var v = num(fx.abs[k]);
      if (_ECON_YIELD[k]) v = Math.round(v * _costBoost);
      addEntry(k, v);
    });
    Object.keys(fx.pct || {}).forEach(function (k) {
      var current = num(getPath(div, k), 0);
      var delta = Math.round(current * num(fx.pct[k]));
      var floor = num(fx.base && fx.base[k], 0);
      if (_ECON_YIELD[k]) floor = Math.round(floor * _costBoost);
      addEntry(k, Math.max(delta, floor));
    });
    if (fx.corruption) {
      var corrDelta = Math.max(-3, Math.min(3, num(fx.corruption)));
      if (div.corruptionLocal != null) div.corruptionLocal = Math.max(0, num(div.corruptionLocal) + corrDelta);
      if (div.corruption != null) div.corruption = Math.max(0, num(div.corruption) + corrDelta);
      if (div.corruptionLocal == null && div.corruption == null) div.corruptionLocal = Math.max(0, 50 + corrDelta);
      applied._corruption = corrDelta;
    }
    if (fx.minxin) {
      spreadMinxin(div, num(fx.minxin), 2);
      applied._minxin = Math.max(-2, Math.min(2, num(fx.minxin)));
    }
    bld.appliedDelta = applied;
    if (dropped.length) {
      try { console.warn('[building-works] 白名单外效果已丢弃:', bld.name, dropped.join(',')); } catch (_) {}
    }
    // S7 近账：完工入账写 _fieldLedger（因果签「近账」消费·FieldPipes 可缺位）
    try {
      var FP = (typeof TM !== 'undefined' && TM.FieldPipes) || (typeof window !== 'undefined' && window.TM && window.TM.FieldPipes);
      if (FP && typeof FP.ledgerPush === 'function') {
        if (applied._minxin) FP.ledgerPush(div, 'minxin', applied._minxin, '「' + bld.name + '」工成', GM);
        if (applied._corruption) FP.ledgerPush(div, 'corruption', applied._corruption, '「' + bld.name + '」工成', GM);
        if (applied.fortLevel) FP.ledgerPush(div, 'fort', applied.fortLevel, '「' + bld.name + '」工成', GM);
        if (applied.militaryRecruits) FP.ledgerPush(div, 'recruits', applied.militaryRecruits, '「' + bld.name + '」工成', GM);
      }
    } catch (_) {}
    // building politics: works-budget graft + corvee resentment (flag P.conf.useRegionMagnate)
    if (typeof _buildingPolitics === 'function') {
      try { _buildingPolitics(div, bld, P, GM); } catch (_bpE) {}
    }
    // S2·制度性建筑：完工注入人才范式渗透引擎（含 talentSource 才路由；flag talentCohortEnabled 默认关 → no-op）
    try {
      var _TBB = (typeof TM !== 'undefined' && TM.TalentBuildingBridge) || (typeof window !== 'undefined' && window.TM && window.TM.TalentBuildingBridge);
      if (_TBB && typeof _TBB.onComplete === 'function') _TBB.onComplete(div, bld, _typeDef, P, GM);
    } catch (_tbbE) {}
    return true;
  }

  // 拆毁回退（destroy 路径调用）：按 appliedDelta 逐笔反向 + 撤工成之利状态
  function revertBuilding(div, bld) {
    if (div && bld) revokeBuildingStatus(div, bld, (typeof window !== 'undefined' && window.GM) || null);
    // S2·制度性建筑：拆毁撤回人才源（须在 appliedDelta 守卫前——纯制度性建筑无 appliedDelta 也要撤源；可逆/幂等在 bridge）
    try {
      var _TBB2 = (typeof TM !== 'undefined' && TM.TalentBuildingBridge) || (typeof window !== 'undefined' && window.TM && window.TM.TalentBuildingBridge);
      var _gmR = (typeof window !== 'undefined' && window.GM) || (typeof GM !== 'undefined' ? GM : null);
      if (_TBB2 && typeof _TBB2.onRevert === 'function') _TBB2.onRevert(div, bld, _gmR);
    } catch (_tbbRE) {}
    if (!div || !bld || !bld.appliedDelta) return false;
    var applied = bld.appliedDelta;
    Object.keys(applied).forEach(function (k) {
      if (k === '_minxin') { spreadMinxin(div, -applied[k], 2); return; }
      if (k === '_corruption') {
        if (div.corruptionLocal != null) div.corruptionLocal = Math.max(0, num(div.corruptionLocal) - applied[k]);
        if (div.corruption != null) div.corruption = Math.max(0, num(div.corruption) - applied[k]);
        return;
      }
      addPath(div, k, -applied[k]);
    });
    delete bld.appliedDelta;
    delete bld.appliedTurn;
    return true;
  }

  // ── S6·生命周期深化：灾损（半损·效用减半）+ 修缮（半费复完）。──
  //   半损：按 appliedDelta 逐路径 revert 一半（民心/吏治不半损·一次性摊不好半 revert）·存 _damageReverted·
  //         appliedDelta 同步减为当前实应用值（故 destroy 的 revertBuilding 仍正确）。修缮：re-apply 那一半。
  function damageBuilding(div, bld) {
    if (!div || !bld || bld._damageReverted) return false;          // 已损·不重复
    var applied = bld.appliedDelta;
    if (!applied) { bld.status = 'damaged'; return true; }          // 纯叙事建筑·无存量·仅改态
    var reverted = {};
    Object.keys(applied).forEach(function (k) {
      if (k === '_minxin' || k === '_corruption') return;          // 一次性摊·跳过半损
      var half = Math.round(num(applied[k]) / 2);
      if (!half) return;
      addPath(div, k, -half);                                       // 叶上撤一半
      reverted[k] = half;
      applied[k] = num(applied[k]) - half;                          // appliedDelta 反映当前实应用
    });
    bld._damageReverted = reverted;
    bld.status = 'damaged';
    return true;
  }
  function repairBuilding(div, bld) {
    if (!div || !bld || !bld._damageReverted) { if (bld && bld.status === 'damaged') bld.status = 'completed'; return false; }
    var rev = bld._damageReverted;
    Object.keys(rev).forEach(function (k) {
      addPath(div, k, rev[k]);                                      // 叶上复那一半
      if (bld.appliedDelta) bld.appliedDelta[k] = num(bld.appliedDelta[k]) + rev[k];
    });
    delete bld._damageReverted;
    bld.status = 'completed';
    return true;
  }
  // 本回合该叶是否遭灾（读 B4 写的 economyBase.disasterRecord·返回最重档 0/1/2/3）
  function _freshDisasterSeverity(div, turn) {
    var eb0 = div && div.economyBase;
    var dr = eb0 && eb0.disasterRecord;
    if (!Array.isArray(dr) || !dr.length) return 0;
    var sev = 0;
    for (var i = 0; i < dr.length; i++) {
      var r = dr[i];
      if (!r || num(r.startTurn) !== num(turn)) continue;
      var s = (r.severity === '重' || r.severity === 'severe' || r.severity === 3) ? 3
            : (r.severity === '中' || r.severity === 'moderate' || r.severity === 2) ? 2 : 1;
      if (s > sev) sev = s;
    }
    return sev;
  }
  function _disasterDamageRoll(sev) {
    var p = sev >= 3 ? 0.4 : sev >= 2 ? 0.18 : 0.05;               // 重 40%·中 18%·轻 5%
    var rnd;
    try { rnd = Math.random(); } catch (_) { rnd = 1; }
    return rnd < p;
  }

  function eb(cat, text) {
    try { if (typeof window !== 'undefined' && typeof window.addEB === 'function') window.addEB(cat, text); } catch (_) {}
  }

  // ── 建筑×状态系统（2026-06-12·加强建筑作用）：完工投「工成之利」流量小加成（地方经济乘子·
  //    与 oneShot 税基存量是两层账），失修撤、修缮复用复挂、拆毁撤。模块缺位安全。──
  function statusApi() {
    try { return (typeof TM !== 'undefined' && TM.RegionStatus) || (typeof window !== 'undefined' && window.TM && window.TM.RegionStatus) || null; } catch (_) { return null; }
  }
  function buildingFlowPct(cost) {
    cost = num(cost, 0);
    if (cost < 1000) return 0; // 小役不成势
    return Math.min(0.03, Math.max(0.005, cost / 2000000));
  }
  function grantBuildingStatus(div, bld, P, GM) {
    var RS = statusApi();
    if (!RS) return;
    var cost = num(bld.costActual, num((typeDefFor(bld.name, P) || {}).baseCost, 0));
    var pct = buildingFlowPct(cost) * Math.max(1, num(bld.level, 1));
    if (pct <= 0) return;
    try {
      RS.add(div, {
        kind: 'building', name: '「' + bld.name + '」之利',
        desc: '工成而百业随兴——地方岁入随之而长',
        econPct: Math.min(0.06, pct), source: 'building:' + bld.name
      }, GM);
    } catch (_) {}
  }
  function revokeBuildingStatus(div, bld, GM) {
    var RS = statusApi();
    if (!RS) return;
    try { RS.remove(div, '「' + bld.name + '」之利', 'building:' + bld.name, GM); } catch (_) {}
  }

  // 每回合确定性步（挂 endTurn 收尾、final aggregate 之前·恰一次）：
  // 在建递减→完工入账；完好扣维护；连欠 3 回合失修（效果存量不动·由叙事与玩家整修接手）。
  function tick(GM, P) {
    if (!GM || !P || !P.adminHierarchy) return { completed: 0, building: 0, neglected: 0, upkeepPaid: 0, damaged: 0, repaired: 0 };
    var stat = { completed: 0, building: 0, neglected: 0, upkeepPaid: 0, damaged: 0, repaired: 0 };
    var _hazardOn = !(P.conf && P.conf.buildingHazardEnabled === false);   // S6·灾损·默认开·显式 false 可关
    Object.keys(P.adminHierarchy).forEach(function (fk) {
      var fh = P.adminHierarchy[fk];
      if (!fh || !fh.divisions) return;
      (function walk(ds) {
        ds.forEach(function (div) {
          if (!div) return;
          if (Array.isArray(div.buildings) && div.buildings.length) {
            var money = div.publicTreasury && div.publicTreasury.money;
            var _freshSev = _hazardOn ? _freshDisasterSeverity(div, GM && GM.turn) : 0;   // S6·本回合该叶灾情(0/1/2/3·读 disasterRecord)
            div.buildings.forEach(function (bld) {
              if (!bld) return;
              if (bld.status === 'building') {
                bld.remainingTurns = Math.max(0, num(bld.remainingTurns, 1) - 1);
                if (bld.remainingTurns <= 0) {
                  bld.status = 'completed';
                  var booked = applyCompletion(div, bld, P, GM);
                  var labels = fxLabels(bld, typeDefFor(bld.name, P));
                  bld.effectSummary = booked && labels.length ? labels.join('；') : (bld.effectSummary || '');
                  grantBuildingStatus(div, bld, P, GM); // 工成之利（流量小加成·状态系统）
                  stat.completed += 1;
                  eb('建设', div.name + '的「' + bld.name + '」工成' + (booked && labels.length ? '——' + labels[0] : ''));
                } else {
                  stat.building += 1;
                }
                return;
              }
              // S6·灾损：完工建筑遇本回合灾异·按烈度概率半损（效用减半·待修缮）
              if (bld.status === 'completed' && _freshSev > 0 && _disasterDamageRoll(_freshSev)) {
                damageBuilding(div, bld);
                revokeBuildingStatus(div, bld, GM);                 // 半损 → 工成之利撤
                stat.damaged += 1;
                eb('建设', div.name + '的「' + bld.name + '」遭' + (_freshSev >= 3 ? '大灾' : '灾') + '·半损（效用减半，待修缮）');
                return;                                            // 本回合不再走常维护
              }
              // S6·修缮：半损建筑·地方库银可支半费(造价 30%)则葺治复完
              if (bld.status === 'damaged') {
                var _rcost = Math.max(20, Math.round(num(bld.costActual, num((typeDefFor(bld.name, P) || {}).baseCost, 0)) * 0.3));
                if (money && num(money.stock) >= _rcost) {
                  money.stock = num(money.stock) - _rcost;
                  if (money.available != null) money.available = Math.max(0, num(money.available) - _rcost);
                  stat.upkeepPaid += _rcost;
                  repairBuilding(div, bld);
                  grantBuildingStatus(div, bld, P, GM);            // 复完 → 之利复挂
                  stat.repaired += 1;
                  eb('建设', div.name + '的「' + bld.name + '」葺治复完（费 ' + _rcost + ' 两）');
                }
                return;                                            // 半损态不走常维护(库银不继则续损待修)
              }
              if (bld.status === 'completed' || bld.status === 'neglected') {
                var up = upkeepFor(bld, typeDefFor(bld.name, P));
                if (up <= 0) return;
                if (money && num(money.stock) >= up) {
                  money.stock = num(money.stock) - up;
                  if (money.available != null) money.available = Math.max(0, num(money.available) - up);
                  stat.upkeepPaid += up;
                  if (bld.status === 'neglected') {
                    bld.status = 'completed'; bld.arrears = 0;
                    grantBuildingStatus(div, bld, P, GM); // 修缮复用 → 之利复挂
                    eb('建设', div.name + '的「' + bld.name + '」修缮复用');
                  }
                  else bld.arrears = 0;
                } else {
                  bld.arrears = num(bld.arrears, 0) + 1;
                  if (bld.arrears >= 3 && bld.status !== 'neglected') {
                    bld.status = 'neglected';
                    stat.neglected += 1;
                    revokeBuildingStatus(div, bld, GM); // 失修 → 之利撤
                    eb('建设', div.name + '库银匮乏，「' + bld.name + '」年久失修');
                  }
                }
              }
            });
          }
          var kids = div.children || div.divisions;
          if (kids && kids.length) walk(kids);
        });
      })(fh.divisions);
    });
    return stat;
  }

  var api = {
    WHITELIST: WHITELIST,
    typeDefFor: typeDefFor,
    sanitizeStructuredFx: sanitizeStructuredFx,
    resolveEffects: resolveEffects,
    fxLabels: fxLabels,
    upkeepFor: upkeepFor,
    applyCompletion: applyCompletion,
    revertBuilding: revertBuilding,
    damageBuilding: damageBuilding,            // S6·灾损(半损·效用减半)
    repairBuilding: repairBuilding,            // S6·修缮(复完)
    buildingLedger: buildingLedger,            // S7·营造可观测账(实入账+维护+工成之利)
    tick: tick
  };

  if (typeof window !== 'undefined') {
    window.TM = window.TM || {};
    window.TM.BuildingWorks = api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
