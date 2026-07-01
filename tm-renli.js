/* ============================================================
 * tm-renli.js — 人力 / 徭役 / 农政层（R1 数据底座 + R2 农政 tick + R3 满意度/裂口）
 *
 * 设计案：docs/renli-yaoyi-design-2026-06.md（§〇·五 单一真相源架构 + 附录 R0 契约）
 *
 * 单一真相源铁律（R0 裁定）：
 *   · 丁的家 = adminHierarchy 叶子「人口对象」(populationDetail 优先, 否则 population)——ding 总量真相源。
 *   · 丁「分配」(务农/役/征/免) = 叶子人口对象 alloc —— 农政层独占写者。
 *   · 逃亡/隐丁 写既有叶子字段 fugitives/hiddenCount（喂既有 fleeTaxPenalty 等）；
 *     实际在地丁 present = ding − fugitives。Renli **绝不写 ding 总量**（避开多写者纠缠·甲口径）。
 *   · 满意度只经 TM.ClassEngine.gateSatisfaction 总闸（闸缺则不动·永不直写·防跳楼）。
 *   · GM.renli 只存农政派生 + 役政策 + 近账 + 官报雾，绝无任何丁计数（防第三本账）。
 * ============================================================ */
(function () {
  'use strict';

  // ── 常量 ──────────────────────────────────────────────────────────────
  var ALLOC_KEYS = ['farm', 'corvee', 'draft', 'exempt']; // 务农 / 应役 / 应征 / 优免
  var FORBIDDEN_DING_KEYS = ['ding', 'registeredDing', 'hiddenDing', 'commendedDing',
    'fledDing', 'exemptDing', 'mouths', 'households', 'population', 'alloc']; // 不得入 GM.renli

  var SEED_DEFAULTS = { soilBase: 70, waterworks: 50, doubleCropping: 1.0, laborMarketDepth: 0.2 };

  // R2 农业
  var RHO_STAR = 0.25;   // 精耕基准密度（丁/亩）
  var RHO_MIN = 0.15;    // 粗放下限（低于此弃地抛荒）
  var BASE_YIELD = 1.5;  // 基准亩产（石/亩）
  var STRENGTH_CAP = { light: 0.15, normal: 0.25, heavy: 0.40, extreme: 0.55 }; // R6 诏书用
  // A1 激活·标准常役：役额按册载丁(黄册·黏滞·棘轮 numerator) × 常役系数 × 征发强度乘数（仅已种子地域·诏书未显式设役需时的标准徭役底盘）
  var BASELINE_CORVEE_FRAC = 0.18;                                              // normal 强度下标准常役占册载丁之比（适当征发·留余量至役负线 0.20）
  var STRENGTH_DEMAND_MULT = { light: 0.6, normal: 1.0, heavy: 1.6, extreme: 2.2 }; // 征发强度→役需乘数（诏书/问天设·轻徭⟷过度征发）

  // R3 满意度 / 缺粮 / 裂口
  var SUBSIST = 0.83;     // 民食 = 口 × subsistence（石/口/回合）
  var CORVEE_LINE = 0.20; // 可持续役负线
  var K_ROLE = 80;        // 役负满意度系数
  var K_GRAIN = 60;       // 缺粮满意度系数
  var FLEE_A = 0.15;      // 逃亡·役负项
  var FLEE_B = 0.10;      // 逃亡·缺粮项
  var FLEE_CAP = 0.6;     // 累计逃亡上限（×ding）
  var HIDE_C = 0.05;      // 隐丁·征发项
  var COMMEND_K = 0.08;   // 诡寄·役负项（自耕农投献士绅避役）
  var VARIANT_CAP = 6;    // 地域分账变体每回合 ±上限（ungated·与既有 social-foundation 同范式）
  var SAT_SOURCE = 'renli-corvee-grain';

  // 刀A·物理亏空→既有民变/流寇点火（激活·仅已种子地域·兑现 §5 走查点火基线）
  // 满意度(过闸·±14)是「被平滑的感知·小头」；真牙齿在物理亏空：粮荒缓蚀本府 div.minxin→既有民变机器自然点火，
  //   持续逃亡分流进既有逃户池 taoohu→既有流寇凝聚机器接管。本层只供「物理压力」，点火/定级/镇压/招抚全用既有系统。
  var UNREST_MX_STEP = 4;          // 役政崩坏每回合压低本府 div.minxin 的有界上限（缓蚀·配既有 5%/回合回归稳定器→灾去自复）
  var COLLAPSE_FLEE = 0.20;        // §5 流寇点火·累计逃亡占实在丁阈
  var COLLAPSE_DEFICIT_TURNS = 2;  // §5·连续亏空回合阈（缺粮不结转·deficitTurns 计数）
  var COLLAPSE_SAT = 35;           // §5·农户满意度阈（低于此+逃亡+连续亏空=全崩→流寇点火）
  var TAOOHU_ROUTE_FRAC = 0.5;     // 全崩时「本回合新逃丁」分流入既有逃户池(→流寇)之比

  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d === undefined ? 0 : d); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, num(n))); }

  function _P() {
    if (typeof P !== 'undefined' && P) return P;
    if (typeof window !== 'undefined' && window.P) return window.P;
    if (typeof global !== 'undefined' && global.P) return global.P;
    return null;
  }
  function _classEngine() {
    if (typeof TM !== 'undefined' && TM && TM.ClassEngine) return TM.ClassEngine;
    if (typeof window !== 'undefined' && window.TM && window.TM.ClassEngine) return window.TM.ClassEngine;
    if (typeof global !== 'undefined' && global.TM && global.TM.ClassEngine) return global.TM.ClassEngine;
    return null;
  }

  // ── 叶子枚举 / 人口对象 ────────────────────────────────────────────────
  function leaves(Pp) {
    Pp = Pp || _P();
    if (!Pp || !Pp.adminHierarchy) return [];
    var IB = (typeof IntegrationBridge !== 'undefined' && IntegrationBridge)
      || (typeof window !== 'undefined' && window.IntegrationBridge)
      || (typeof global !== 'undefined' && global.IntegrationBridge) || null;
    if (IB && typeof IB.getLeafDivisions === 'function') {
      try { var r = IB.getLeafDivisions(Pp.adminHierarchy, 'player'); if (r && r.length) return r; } catch (_) {}
    }
    var out = [];
    var fac = Pp.adminHierarchy.player || Pp.adminHierarchy[Object.keys(Pp.adminHierarchy)[0]];
    (function walk(nodes) {
      if (!Array.isArray(nodes)) return;
      nodes.forEach(function (n) {
        if (!n) return;
        var kids = n.children || n.divisions || null;
        if (kids && kids.length) walk(kids); else out.push(n);
      });
    })(fac && fac.divisions);
    return out;
  }

  function regionIdOf(leaf) { return String((leaf && (leaf.id || leaf.name)) || ''); }

  // canonical 人口对象——绝不凭空新造平行账
  function popOf(leaf) {
    if (!leaf) return null;
    if (leaf.populationDetail && typeof leaf.populationDetail === 'object') return leaf.populationDetail;
    if (leaf.population && typeof leaf.population === 'object') return leaf.population;
    return null;
  }

  function presentDing(pd) { return Math.max(0, num(pd.ding, 0) - num(pd.fugitives, 0)); } // 实际在地丁

  // ── R1：ensure / 种子 / 近账 ───────────────────────────────────────────
  function ensureLeafFields(leaf) {
    var pd = popOf(leaf);
    if (!pd) return null;
    if (!pd.alloc || typeof pd.alloc !== 'object') pd.alloc = {};
    ALLOC_KEYS.forEach(function (k) { if (typeof pd.alloc[k] !== 'number') pd.alloc[k] = 0; });
    if (typeof pd.registeredDing !== 'number') pd.registeredDing = num(pd.ding, 0); // 册载丁默认=实在丁
    return pd;
  }

  function ensureRegion(GM, regionId, seed) {
    if (!GM.renli) GM.renli = { byRegion: {}, reported: {} };
    if (!GM.renli.byRegion) GM.renli.byRegion = {};
    if (!GM.renli.reported) GM.renli.reported = {};
    var r = GM.renli.byRegion[regionId];
    if (!r) {
      r = GM.renli.byRegion[regionId] = {
        soil: clamp((seed && seed.soilBase != null) ? seed.soilBase : SEED_DEFAULTS.soilBase, 0, 100),
        cultivatedLand: 0, fallowLand: 0, corveeRate: 0,
        levyPolicy: { strength: 'normal', remitTurns: 0 }, ledger: []
      };
    }
    if (!GM.renli.reported[regionId]) GM.renli.reported[regionId] = { corveeRate: 0, fallowShare: 0 };
    return r;
  }

  function ensureDefaults(GM, Pp) {
    if (!GM) return null;
    Pp = Pp || _P();
    if (!GM.renli) GM.renli = { byRegion: {}, reported: {} };
    leaves(Pp).forEach(function (leaf) { ensureLeafFields(leaf); ensureRegion(GM, regionIdOf(leaf), leaf && leaf.renliSeed); });
    return GM.renli;
  }

  function seedRegion(GM, Pp, regionId, seed) {
    Pp = Pp || _P();
    seed = Object.assign({}, SEED_DEFAULTS, seed || {});
    var ls = leaves(Pp), leaf = null;
    for (var i = 0; i < ls.length; i++) { if (regionIdOf(ls[i]) === String(regionId) || String(ls[i].name || '') === String(regionId)) { leaf = ls[i]; break; } } // 按 id 或 name 配（天启叶 id 可能 div_xxx·name 陕西）
    if (!leaf) return null;
    leaf.renliSeed = seed;
    var pd = ensureLeafFields(leaf);
    if (pd && seed.registeredDing != null) pd.registeredDing = Math.max(0, Math.round(num(seed.registeredDing, pd.ding)));
    if (pd && seed.registeredLand != null) pd.registeredLand = Math.max(0, Math.round(num(seed.registeredLand, 0)));
    var r = ensureRegion(GM, regionIdOf(leaf), seed);                          // byRegion key 用 regionIdOf(叶)·与 tickLeaf 一致（防 id/name 分账）
    r.soil = clamp(seed.soilBase, 0, 100);
    return { leaf: leaf, region: r };
  }

  function ledgerPush(GM, regionId, key, delta, why, src) {
    var r = ensureRegion(GM, String(regionId));
    if (!Array.isArray(r.ledger)) r.ledger = [];
    r.ledger.push({ turn: num(GM.turn, 0), key: String(key || ''), delta: num(delta, 0), why: String(why || ''), src: String(src || 'renli') });
    if (r.ledger.length > 8) r.ledger = r.ledger.slice(-8);
    return r.ledger;
  }

  function getRegion(GM, regionId) {
    return (GM && GM.renli && GM.renli.byRegion) ? GM.renli.byRegion[String(regionId)] : null;
  }

  // 可征丁 = 在地丁 − 优免（优免取 canonical pd.exemptDing·与 tick 一致）
  function levyableDing(leaf) {
    var pd = popOf(leaf); if (!pd) return 0;
    var present = presentDing(pd);
    return Math.max(0, present - Math.min(num(pd.exemptDing, 0), present));
  }

  // 分配不变量：务农+役+征 ≤ 实在丁（不超总丁·逃亡发生于分配之后故用 ding 上界）；优免 ⊆ 务农；各项 ≥0
  function allocValid(leaf) {
    var pd = popOf(leaf); if (!pd || !pd.alloc) return true;
    var a = pd.alloc, ding = num(pd.ding, 0);
    var farm = num(a.farm, 0), corvee = num(a.corvee, 0), draft = num(a.draft, 0), exempt = num(a.exempt, 0);
    if (farm < 0 || corvee < 0 || draft < 0 || exempt < 0) return false;
    if ((farm + corvee + draft) > ding + 1) return false; // 分配不超总丁
    if (exempt > farm + 1) return false;                  // 优免 ⊆ 务农
    return true;
  }

  function assertNoDingInRenli(GM) {
    var bad = [];
    var br = (GM && GM.renli && GM.renli.byRegion) || {};
    Object.keys(br).forEach(function (rid) {
      var r = br[rid] || {};
      FORBIDDEN_DING_KEYS.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(r, k)) bad.push(rid + '.' + k); });
    });
    return bad;
  }

  // ── R3：农户类定位 / 地域分账变体 ──────────────────────────────────────
  function findFarmerClass(GM) {
    var cs = (GM && Array.isArray(GM.classes)) ? GM.classes : [];
    for (var i = 0; i < cs.length; i++) { var c = cs[i]; if (c && /农/.test(String(c.name || c.className || ''))) return c; }
    for (var j = 0; j < cs.length; j++) { var d = cs[j]; if (d && /农|生产/.test(String(d.economicRole || ''))) return d; }
    return null;
  }

  // 地域分账：局部变体满意度（±VARIANT_CAP/回合·ungated·与既有 social-foundation 范式一致）
  function applyRegionalVariant(cls, regionId, delta) {
    if (!cls || !delta) return;
    if (!Array.isArray(cls.regionalVariants)) cls.regionalVariants = [];
    var v = null;
    for (var i = 0; i < cls.regionalVariants.length; i++) { var rv = cls.regionalVariants[i]; if (rv && String(rv.region) === String(regionId)) { v = rv; break; } }
    if (!v) { v = { region: String(regionId), satisfaction: num(cls.satisfaction, 50) }; cls.regionalVariants.push(v); }
    var d = clamp(delta, -VARIANT_CAP, VARIANT_CAP);
    v.satisfaction = clamp(num(v.satisfaction, 50) + d, 0, 100);
  }

  // ── R2/R3：农政 tick ──────────────────────────────────────────────────
  function _qOf(rho) {
    if (rho >= RHO_STAR) return 1.0;
    if (rho >= RHO_MIN) return clamp(0.7 + 3 * (rho - RHO_MIN), 0.7, 1.0);
    return 0.7;
  }
  function _regLandOf(leaf, pd) {
    var rl = num(pd.registeredLand, 0); if (rl > 0) return rl;
    if (leaf.environment && num(leaf.environment.arableLand, 0) > 0) return num(leaf.environment.arableLand, 0);
    if (leaf.economyBase && num(leaf.economyBase.farmland, 0) > 0) return num(leaf.economyBase.farmland, 0); // 真天启府叶田亩在 economyBase.farmland（A3 实探）
    return num(pd.arableLand, 0);
  }

  // 单地域 tick（确定性·闭式·每地 O(1)）。写 alloc + 既有 fugitives/hiddenCount + GM.renli 派生；不动 ding 总量。
  function tickLeaf(GM, leaf) {
    var pd = popOf(leaf); if (!pd) return null;
    ensureLeafFields(leaf);
    var rid = regionIdOf(leaf);
    var seed = leaf.renliSeed || {};
    var r = ensureRegion(GM, rid, seed);

    var ding = Math.max(0, num(pd.ding, 0));                 // 实在丁（真相源·只读）
    var present = presentDing(pd);                            // 在地丁 = ding − 逃亡
    var exempt = Math.min(Math.max(0, num(pd.exemptDing, 0)), present); // 优免（R4 由 gongming 填）
    var leviable = Math.max(0, present - (r.tanding ? 0 : exempt)); // 可征丁（摊丁入亩后优免不再蔽役·役随田走·R8）

    // 劳动力分流（R3.5：役 corvee + 军役 draft 共争同一可征丁池 → 军农争丁）
    var pol = r.levyPolicy || (r.levyPolicy = { strength: 'normal', remitTurns: 0 });
    var lm = clamp(num(seed.laborMarketDepth, SEED_DEFAULTS.laborMarketDepth), 0, 0.95);
    // 役需(丁)：诏书显式设则用之；否则已种子地域取标准常役底盘（册载丁×常役系数×征发强度·A1）·未种子=0
    var _sMult = STRENGTH_DEMAND_MULT[pol.strength] || 1.0;
    var _baselineCorvee = leaf.renliSeed ? Math.round(num(pd.registeredDing, 0) * BASELINE_CORVEE_FRAC * _sMult) : 0;
    var demand = (pol.corveeDemand != null) ? Math.max(0, num(pol.corveeDemand, 0)) : _baselineCorvee;
    var draftDemand = Math.max(0, num(pol.draftDemand, 0));    // 募兵+民夫转运需(丁)·R3.5·campaign/诏书设
    var commuted = Math.round(demand * lm);                    // 募役折银（不抽田丁·军役不折银）
    var wanted = Math.max(0, demand - commuted);
    var remit = num(pol.remitTurns, 0) > 0;
    var draftLevied = remit ? 0 : Math.min(draftDemand, leviable);                       // 军役优先（募兵补边）
    var corveeLevied = remit ? 0 : Math.min(wanted, Math.max(0, leviable - draftLevied)); // 役从可征余抽
    var levied = draftLevied + corveeLevied;                   // 总抽田丁（军农争夺）
    var farm = Math.max(0, present - levied);                  // 务农丁（优免也务农）
    pd.alloc = { farm: farm, corvee: corveeLevied, draft: draftLevied, exempt: exempt };
    var corveeRate = leviable > 0 ? (levied / leviable) : 0;   // 役负率=总抽/可征（含军役加负）

    // 农政层激活条件：仅「已种子(renliSeed)且有地数据」的地域才算粮/饥荒/逃亡/满意度；
    // 其余惰性（只留 alloc·良性）——R3 在 live 游戏对未种子地域零行为变更，待 R4 种子+校准激活。
    var regLand = _regLandOf(leaf, pd);
    if (!leaf.renliSeed || regLand <= 0) {
      r.cultivatedLand = 0; r.fallowLand = 0;
      r.corveeRate = Math.round(corveeRate * 10000) / 10000;
      r.grainOutput = 0; r.foodNeed = 0; r.foodDeficit = 0; r.signal = 0;
      return { regionId: rid, present: present, corveeRate: corveeRate, deficit: 0, signal: 0 };
    }

    // 双边际 + 粮产
    var soil = clamp(num(r.soil, seed.soilBase != null ? seed.soilBase : SEED_DEFAULTS.soilBase), 5, 95);
    var weather = clamp(num(r.weather, 1.0), 0.3, 1.3);
    var dc = num(seed.doubleCropping, SEED_DEFAULTS.doubleCropping);
    var ww = clamp(num(r.waterworks != null ? r.waterworks : seed.waterworks, SEED_DEFAULTS.waterworks), 0, 100);
    var rho = regLand > 0 ? (farm / regLand) : 0;
    var cult, fallow;
    if (regLand <= 0) { cult = 0; fallow = 0; }
    else if (rho >= RHO_MIN) { cult = regLand; fallow = 0; }
    else { cult = Math.round(farm / RHO_MIN); fallow = Math.max(0, regLand - cult); }
    var Q = _qOf(rho);
    var grain = Math.round(cult * BASE_YIELD * (soil / 100) * Q * dc * weather);

    // 缺粮（饥荒·R3）：民食 = 口 × subsistence；不含赋（赋由 cascade）
    var foodNeed = Math.round(num(pd.mouths, 0) * SUBSIST);
    var deficit = Math.max(0, foodNeed - grain);
    var deficitRatio = foodNeed > 0 ? (deficit / foodNeed) : 0;

    // 满意度原始信号（役负 + 缺粮）——交 tick() 过总闸·本函数不写满意度
    var sRole = -K_ROLE * Math.max(0, corveeRate - CORVEE_LINE);
    var sGrain = -K_GRAIN * deficitRatio;
    var signal = sRole + sGrain;

    // 三裂口（R3·写既有叶子字段·不动 ding 总量）：逃亡 + 隐丁（诡寄待 R4 优免归集）
    if (present > 0) {
      var fleeFrac = clamp(FLEE_A * Math.max(0, corveeRate - CORVEE_LINE) + FLEE_B * deficitRatio, 0, 0.5);
      var newFug = Math.round(present * fleeFrac);
      if (newFug > 0) {
        pd.fugitives = Math.min(num(pd.fugitives, 0) + newFug, Math.round(ding * FLEE_CAP)); // 逃亡→既有 fugitives
        ledgerPush(GM, rid, 'fugitives', newFug, '役负/缺粮逃亡', 'renli');
      }
      var hideFrac = clamp(HIDE_C * Math.max(0, corveeRate - CORVEE_LINE), 0, 0.2);
      var newHid = Math.round(present * hideFrac);
      if (newHid > 0) pd.hiddenCount = num(pd.hiddenCount, 0) + newHid; // 隐丁→既有 hiddenCount
      // 诡寄（R4）：役重→自耕农投献士绅避役（留田务农·转入优免不可征）→ commendedDing（下回合 refreshExempt 折叠进 exempt）
      var commendFrac = clamp(COMMEND_K * Math.max(0, corveeRate - CORVEE_LINE), 0, 0.3);
      var newCommend = Math.round(leviable * commendFrac);
      if (newCommend > 0) { pd.commendedDing = Math.min(num(pd.commendedDing, 0) + newCommend, Math.round(ding * 0.5)); ledgerPush(GM, rid, 'commended', newCommend, '役重诡寄投献', 'renli'); }
    }

    // 地力慢变（影响下回合）
    var dSoil = 0;
    if (rho < RHO_STAR) dSoil -= 2;
    if (weather < 0.85) dSoil -= 1;
    if (rho >= RHO_STAR && ww >= 60) dSoil += 1;
    r.soil = clamp(soil + dSoil, 5, 95);

    r.cultivatedLand = cult; r.fallowLand = fallow;
    r.corveeRate = Math.round(corveeRate * 10000) / 10000;
    r.rho = Math.round(rho * 10000) / 10000;
    r.q = Math.round(Q * 10000) / 10000;
    r.grainOutput = grain; r.foodNeed = foodNeed; r.foodDeficit = deficit;
    r.signal = Math.round(signal * 100) / 100;
    if (num(pol.remitTurns, 0) > 0) pol.remitTurns = num(pol.remitTurns, 0) - 1; // 蠲免倒计（R6）
    return { regionId: rid, present: present, corveeRate: corveeRate, deficit: deficit, signal: signal };
  }

  // 全图 tick：逐地域算 → 写局部地域分账变体 → 人口加权聚合过总闸（单地失败隔离）
  function tick(GM, Pp) {
    if (!GM) return;
    Pp = Pp || _P();
    if (!GM.renli) GM.renli = { byRegion: {}, reported: {} };
    var farmers = findFarmerClass(GM);
    var accW = 0, accSig = 0;
    leaves(Pp).forEach(function (leaf) {
      var res; try { res = tickLeaf(GM, leaf); } catch (_) { res = null; }
      if (!res) return;
      if (res.present > 0 && res.signal !== 0) { accW += res.present; accSig += res.signal * res.present; }
      if (farmers && res.signal !== 0) applyRegionalVariant(farmers, res.regionId, res.signal); // 地域分账（局部）
    });
    // 全局 农户：人口加权聚合 → 过 gateSatisfaction 总闸（绝不直写·闸缺则不动→防跳楼）
    if (farmers && accW > 0) {
      var agg = accSig / accW;
      var CE = _classEngine();
      if (agg !== 0 && CE && typeof CE.gateSatisfaction === 'function') {
        try { CE.gateSatisfaction(GM, farmers, agg, { turn: num(GM.turn, 0), source: SAT_SOURCE, reason: '役负/缺粮' }); } catch (_) {}
      }
    }
  }

  // ── R3.5：战争定位毁地（兵燹）──────────────────────────────────────────
  // 把战斗位置匹配到「已种子」前线地域（id/name 双向包含·只认已种子）
  function _seededRegionMatch(GM, Pp, name) {
    if (!name) return null;
    name = String(name);
    var ls = leaves(Pp);
    for (var i = 0; i < ls.length; i++) {
      var leaf = ls[i]; if (!leaf || !leaf.renliSeed) continue;
      var rid = regionIdOf(leaf);
      if (rid && (rid === name || name.indexOf(rid) >= 0 || rid.indexOf(name) >= 0)) return { leaf: leaf, rid: rid };
    }
    return null;
  }

  // 对单地域施加兵燹：平民逃散(→既有 fugitives·不写 ding 总量) + 地力/水利毁损。仅已种子地域。
  function warScar(GM, Pp, regionId, opts) {
    Pp = Pp || _P(); opts = opts || {};
    var ls = leaves(Pp), leaf = opts.leaf || null;
    if (!leaf) { for (var i = 0; i < ls.length; i++) { if (regionIdOf(ls[i]) === String(regionId)) { leaf = ls[i]; break; } } }
    if (!leaf || !leaf.renliSeed) return null; // 仅已种子前线（live 安全）
    var pd = popOf(leaf); if (!pd) return null;
    var seed = leaf.renliSeed || {};
    var r = ensureRegion(GM, String(regionId), seed);
    var ding = Math.max(1, num(pd.ding, 0));
    var present = presentDing(pd);
    var sev = (opts.severity != null) ? clamp(opts.severity, 0, 1) : clamp(num(opts.casualties, 0) / ding, 0, 0.5); // 烈度=伤亡/丁
    if (sev <= 0) return null;
    var flee = Math.round(present * sev * 0.5); // 兵燹驱民
    if (flee > 0) { pd.fugitives = Math.min(num(pd.fugitives, 0) + flee, Math.round(ding * FLEE_CAP)); ledgerPush(GM, String(regionId), 'fugitives', flee, '兵燹驱民', 'war'); }
    var soilHit = Math.round(sev * 30), waterHit = Math.round(sev * 20);
    r.soil = clamp(num(r.soil, seed.soilBase != null ? seed.soilBase : SEED_DEFAULTS.soilBase) - soilHit, 5, 95);
    r.waterworks = clamp(num(r.waterworks != null ? r.waterworks : seed.waterworks, SEED_DEFAULTS.waterworks) - waterHit, 0, 100);
    ledgerPush(GM, String(regionId), 'soil', -soilHit, '兵燹毁地', 'war');
    r._warScarTurn = num(GM.turn, 0);
    return { regionId: String(regionId), flee: flee, soilHit: soilHit, waterHit: waterHit, severity: sev };
  }

  // 战斗结算钩子（tm-military.applyBattleResult 一行调用·全包解析·非前线/未种子=no-op）
  function warScarFromBattle(GM, Pp, br, result) {
    if (!GM) return null;
    Pp = Pp || _P(); br = br || {}; result = result || {};
    var loc = br.location || br.targetCity || br.city || '';
    if (!loc && Array.isArray(result.affectedArmies)) {
      for (var i = 0; i < result.affectedArmies.length; i++) { var s = result.affectedArmies[i]; if (s && (s.location || s.garrison)) { loc = s.location || s.garrison; break; } }
    }
    var m = _seededRegionMatch(GM, Pp, loc);
    if (!m) return null; // 非已种子前线 → no-op
    var cas = 0;
    var list = (result.applied && result.applied.casualties) || result.affectedArmies || [];
    for (var j = 0; j < list.length; j++) { var c = list[j]; cas += Math.max(0, num(c && (c.loss != null ? c.loss : c.casualties), 0)); }
    return warScar(GM, Pp, m.rid, { casualties: cas, leaf: m.leaf });
  }

  // ── R4：优免按地域归集（接 tm-gongming）+ 诡寄折叠 ─────────────────────────
  function _gongming() {
    if (typeof TMGongming !== 'undefined' && TMGongming) return TMGongming;
    if (typeof window !== 'undefined' && window.TMGongming) return window.TMGongming;
    if (typeof global !== 'undefined' && global.TMGongming) return global.TMGongming;
    return null;
  }
  function _charRegionTokens(ch) {
    var bp = String((ch && (ch.birthplace || ch.nativePlace || ch.jiguan)) || '');
    return bp.split(/[·\-—~／/、,，\s（）()]+/).filter(Boolean); // 按·－/、，（）空白拆
  }
  function _charYoumian(GM, ch) {
    var GO = _gongming();
    if (GO && typeof GO.ensureGongming === 'function') { try { return num(GO.ensureGongming(ch, GM).youmian, 0); } catch (_) {} }
    return num(ch && ch.resources && ch.resources.gongming && ch.resources.gongming.youmian, 0);
  }
  // 在世士绅优免额按籍贯归集到已种子地域 → 写 leaf.exemptDing = 士绅优免 + 诡寄(commended)
  function refreshExempt(GM, Pp) {
    if (!GM) return;
    Pp = Pp || _P();
    var ls = leaves(Pp).filter(function (l) { return l && l.renliSeed; }); // 仅已种子（live 安全）
    if (!ls.length) return;
    var gentry = {}; ls.forEach(function (l) { gentry[regionIdOf(l)] = 0; });
    var chars = (GM && Array.isArray(GM.chars)) ? GM.chars : [];
    chars.forEach(function (ch) {
      if (!ch || ch.alive === false) return;
      var ym = _charYoumian(GM, ch); if (ym <= 0) return;
      var toks = _charRegionTokens(ch);
      for (var i = 0; i < ls.length; i++) {
        var rid = regionIdOf(ls[i]);
        var hit = toks.some(function (t) { return t && (rid.indexOf(t) >= 0 || t.indexOf(rid) >= 0); });
        if (hit) { gentry[rid] += ym; break; }
      }
    });
    ls.forEach(function (l) {
      var pd = popOf(l); if (!pd) return;
      var rr = (GM.renli.byRegion && GM.renli.byRegion[regionIdOf(l)]) || {};
      var cap = (typeof rr.exemptCapFactor === 'number') ? rr.exemptCapFactor : 1; // 限制优免（R6 变法）
      pd.exemptDing = Math.max(0, Math.round((gentry[regionIdOf(l)] || 0) * cap + num(pd.commendedDing, 0))); // 士绅优免×限免 + 诡寄
    });
  }
  // A3a 激活·试点种子（数据驱动·中立·无朝代硬编）：读 GM.renliPilot=[{region,seed}|name]·对未种子地域 seedRegion（幂等·不重置已种子地力/棘轮）。无配置→零行为(未激活)。
  function _pilotConfig(GM, Pp) {
    if (GM && Array.isArray(GM.renliPilot) && GM.renliPilot.length) return GM.renliPilot; // GM 优先
    var P2 = Pp || _P();                                                       // 回退读当前剧本模板·绕 scenario→GM 拷贝保真依赖（A3b 必需）
    var sc = (P2 && Array.isArray(P2.scenarios) && GM) ? P2.scenarios.filter(function (s) { return s && s.id === GM.sid; })[0] : null;
    return (sc && Array.isArray(sc.renliPilot) && sc.renliPilot.length) ? sc.renliPilot : null;
  }
  // 找名为 name 的 division（任意层·id 或 name）→ 返回其叶子后代（省→府展开·真天启叶=府级）
  function _leavesUnderDivision(Pp, name) {
    Pp = Pp || _P();
    var ah = Pp && Pp.adminHierarchy; if (!ah) return [];
    var fac = ah.player || ah[Object.keys(ah)[0]];
    var found = null;
    (function find(ns) { if (found || !Array.isArray(ns)) return; ns.forEach(function (n) { if (found || !n) return; if (String(n.id || '') === String(name) || String(n.name || '') === String(name)) { found = n; return; } find(n.children || n.divisions); }); })(fac && fac.divisions);
    if (!found) return [];
    var out = [];
    (function collect(node) { var k = node.children || node.divisions; if (k && k.length) k.forEach(collect); else out.push(node); })(found);
    return out;
  }
  function ensurePilotSeeds(GM, Pp) {
    if (!GM) return;
    Pp = Pp || _P();
    var pilot = _pilotConfig(GM, Pp);
    if (!pilot) return;                                                        // 无试点配置(GM 或剧本)→inert
    var ls = leaves(Pp);
    pilot.forEach(function (entry) {
      if (!entry) return;
      var region = (typeof entry === 'string') ? entry : entry.region;
      if (!region) return;
      var seed = (typeof entry === 'object' && entry.seed) || {};
      // 目标叶子：精确(name/id)命中的叶→那些；否则按上级区名展开其叶子后代（省名「陕西布政使司」→种其 15 府叶）
      var targets = ls.filter(function (l) { return regionIdOf(l) === String(region) || String(l.name || '') === String(region); });
      if (!targets.length) targets = _leavesUnderDivision(Pp, region);
      targets.forEach(function (l) {
        if (l.renliSeed) return;                                               // 已种子则跳过（幂等·保运行时累积 soil/棘轮）
        try { seedRegion(GM, Pp, regionIdOf(l), seed); } catch (_) {}
      });
    });
  }
  // ── 刀A：物理亏空→既有民变/流寇点火 ─────────────────────────────────────
  function _intBridge() {
    if (typeof IntegrationBridge !== 'undefined' && IntegrationBridge) return IntegrationBridge;
    if (typeof window !== 'undefined' && window.IntegrationBridge) return window.IntegrationBridge;
    if (typeof global !== 'undefined' && global.IntegrationBridge) return global.IntegrationBridge;
    return null;
  }
  // GM.adminHierarchy 的玩家叶（= 民变点火/民心稳定器读的同一份·与 Renli 读的 P.adminHierarchy 可能 deepClone 分叉）
  function _gmLeaves(GM) {
    var IB = _intBridge();
    if (IB && typeof IB.getLeafDivisions === 'function' && GM && GM.adminHierarchy) {
      try { var r = IB.getLeafDivisions(GM.adminHierarchy, 'player'); if (r && r.length) return r; } catch (_) {}
    }
    var out = [], ah = GM && GM.adminHierarchy; if (!ah) return out;
    var fac = ah.player || ah[Object.keys(ah)[0]];
    (function walk(ns) { if (!Array.isArray(ns)) return; ns.forEach(function (n) { if (!n) return; var k = n.children || n.divisions; if (k && k.length) walk(k); else out.push(n); }); })(fac && fac.divisions);
    return out;
  }
  // 把 Renli 算出的「役政崩坏」物理压力落到 GM 叶子 div.minxin（真值源·民变读它）。有界·绝不跳楼·无民心字段则不凭空造。
  function _pushRegionMinxin(GM, leaf, delta) {
    if (!GM || !leaf || !delta) return false;
    var id = String(leaf.id || ''), nm = String(leaf.name || '');
    var gls = _gmLeaves(GM), target = null;
    for (var i = 0; i < gls.length; i++) { var g = gls[i]; if (!g) continue; if ((id && String(g.id || '') === id) || (nm && String(g.name || '') === nm)) { target = g; break; } }
    if (!target && nm) { for (var j = 0; j < gls.length; j++) { var g2 = gls[j]; if (!g2) continue; var gnm = String(g2.name || ''); if (gnm && (gnm.indexOf(nm) >= 0 || nm.indexOf(gnm) >= 0)) { target = g2; break; } } }
    if (!target) return false;
    var cur = (typeof target.minxin === 'number') ? target.minxin : ((typeof target.minxinLocal === 'number') ? target.minxinLocal : null);
    if (cur == null) return false;                          // 无民心字段·不凭空造（编辑器/快照应已注 minxin/minxinLocal）
    var next = clamp(Math.round((cur + delta) * 100) / 100, 0, 100);
    target.minxin = next;
    if (target.minxinLocal !== undefined) target.minxinLocal = next;
    if (target.minxinDetails && typeof target.minxinDetails === 'object') target.minxinDetails.trueIndex = next;
    return true;
  }
  function _farmerSatForRegion(farmers, rid) {
    if (!farmers) return 50;
    var vs = farmers.regionalVariants;
    if (Array.isArray(vs)) { for (var i = 0; i < vs.length; i++) { var v = vs[i]; if (v && String(v.region) === String(rid)) return num(v.satisfaction, 50); } }
    return num(farmers.satisfaction, 50);
  }
  // 每回合（农政 tick 之后）：对已种子地域施物理崩坏压力。纯增量·未种子零行为。
  function applyUnrestPressure(GM, Pp) {
    Pp = Pp || _P();
    if (!GM || !GM.renli || !GM.renli.byRegion) return;
    var farmers = findFarmerClass(GM);
    leaves(Pp).forEach(function (leaf) {
      if (!leaf || !leaf.renliSeed) return;                 // 仅已种子（live 安全·未激活省零行为）
      var pd = popOf(leaf); if (!pd) return;
      var rid = regionIdOf(leaf);
      var r = getRegion(GM, rid); if (!r) return;
      var ding = Math.max(0, num(pd.ding, 0));
      var foodNeed = num(r.foodNeed, 0), deficit = num(r.foodDeficit, 0);
      var deficitRatio = foodNeed > 0 ? clamp(deficit / foodNeed, 0, 1) : 0;
      var corveeRate = num(r.corveeRate, 0);
      var fleeRatio = ding > 0 ? clamp(num(pd.fugitives, 0) / ding, 0, 1) : 0;
      // 连续亏空回合（缺粮不结转·派生计数·随 r._warScarTurn 范式存 byRegion·assertNoDingInRenli 不涉）
      r.deficitTurns = (deficit > 0) ? (num(r.deficitTurns, 0) + 1) : 0;
      // ① 民心通道：粮荒/役负/逃亡严重度→有界压低本府 div.minxin（落 GM 叶子=民变真值源）
      var severity = clamp(deficitRatio * 1.0 + Math.max(0, corveeRate - CORVEE_LINE) * 1.5 + fleeRatio * 0.5, 0, 1);
      if (severity > 0.02) {
        var dMin = -clamp(Math.round(severity * UNREST_MX_STEP * 100) / 100, 0, UNREST_MX_STEP);
        if (dMin < 0 && _pushRegionMinxin(GM, leaf, dMin)) ledgerPush(GM, rid, 'minxin', dMin, '役政崩坏·民心缓蚀', 'renli');
      }
      // ② 流寇通道：§5 全崩(逃亡>20% ∧ 连续亏空≥2 ∧ 农户满意度<35)→本回合新逃丁分流进既有逃户池→既有流寇凝聚
      var seen = num(pd._renliFugSeen, num(pd.fugitives, 0));
      var inc = Math.max(0, num(pd.fugitives, 0) - seen);
      pd._renliFugSeen = num(pd.fugitives, 0);              // 更新基线（防 backlog 一次性倾泻·只取每回合增量）
      var sat = _farmerSatForRegion(farmers, rid);
      var inCollapse = (fleeRatio > COLLAPSE_FLEE && num(r.deficitTurns, 0) >= COLLAPSE_DEFICIT_TURNS && sat < COLLAPSE_SAT);
      if (inCollapse && inc > 0) {
        var routed = Math.round(inc * TAOOHU_ROUTE_FRAC);
        if (routed > 0 && GM.population) {
          var bls = GM.population.byLegalStatus || (GM.population.byLegalStatus = {});
          var taoohu = bls.taoohu || (bls.taoohu = { mouths: 0 });
          taoohu.mouths = num(taoohu.mouths, 0) + routed;   // 守恒入既有逃户池（_tickRovingCoalesce 据此聚流寇）
          ledgerPush(GM, rid, 'taoohu', routed, '流亡聚为流寇之资', 'renli');
          r._collapseTurn = num(GM.turn, 0);
        }
      }
    });
  }

  // ── 刀一：天时→粮产直连（灾异/小冰期/国难→ r.weather → tickLeaf 粮产·激活灾害触发粮荒）──
  // 现状 r.weather 仅 smoke 写、live 恒默认 1.0→旱灾/小冰期永不减收成。此处把既有灾情信号填进 r.weather(tick 前)。
  var CLIMATE_W = 0.3;        // carryingCapacity.climate 偏离 1.0 之权重（小冰期慢拖累）
  var DISASTER_W = 1.5;       // RegionStatus 灾异 econPct(负)→收成拖累权重（-0.2 旱灾→weather≈0.7 大旱·合设计§4.3）
  var NAT_DISASTER_W = 0.2;   // 全国 disasterLevel 拖累权重（国难普减）
  function _disasterDragOf(leaf) {
    var fx = (leaf && Array.isArray(leaf.statusEffects)) ? leaf.statusEffects : [];
    var s = 0;
    for (var i = 0; i < fx.length; i++) { var e = fx[i]; if (e && e.kind === 'disaster' && isFinite(Number(e.econPct)) && Number(e.econPct) < 0) s += Number(e.econPct); }
    return s; // ≤0
  }
  function refreshWeather(GM, Pp) {
    Pp = Pp || _P();
    if (!GM || !GM.renli) return;
    var natLevel = (GM.vars && isFinite(Number(GM.vars.disasterLevel))) ? clamp(Number(GM.vars.disasterLevel), 0, 1) : 0;
    var natDrag = -clamp(natLevel * NAT_DISASTER_W, 0, 0.25);
    leaves(Pp).forEach(function (leaf) {
      if (!leaf || !leaf.renliSeed) return;                       // 仅已种子（live 安全·未激活省不动）
      var rid = regionIdOf(leaf), r = getRegion(GM, rid); if (!r) return;
      var cc = leaf.carryingCapacity;
      var climate = (cc && isFinite(Number(cc.climate))) ? Number(cc.climate) : null;
      var climateAdj = (climate != null) ? clamp((climate - 1) * CLIMATE_W, -0.2, 0.1) : 0; // 小冰期(<1)拖累·暖年(>1)微利
      var disasterDrag = clamp(_disasterDragOf(leaf) * DISASTER_W, -0.5, 0);                // 本地灾异(旱/洪/蝗…)
      r.weather = clamp(Math.round((1.0 + climateAdj + disasterDrag + natDrag) * 100) / 100, 0.3, 1.3);
    });
  }

  // 过回合入口：先种子(试点·数据驱动)·再归集优免(含诡寄折叠)·填天时(刀一)·再跑农政 tick·末施崩坏点火压力(刀A)
  function endturnTick(GM, Pp) {
    Pp = Pp || _P();
    try { ensurePilotSeeds(GM, Pp); } catch (_) {}
    try { refreshExempt(GM, Pp); } catch (_) {}
    try { refreshWeather(GM, Pp); } catch (_) {}
    tick(GM, Pp);
    try { applyUnrestPressure(GM, Pp); } catch (_) {}
    try { refreshReported(GM, Pp); } catch (_) {}
    try { spawnReportedChannels(GM, Pp); } catch (_) {}
    try { applyGrainShortfall(GM, Pp); } catch (_) {}
  }

  // ── R6：变法 ops（玩家杠杆 + 党派代价·仅已种子地域·诏书触发见 recognizeEdictReform·R6c）──
  function _reformGate(GM, classMatch, delta, source, reason) {
    var CE = _classEngine(); if (!CE || typeof CE.gateSatisfaction !== 'function') return;
    var cs = (GM && Array.isArray(GM.classes)) ? GM.classes : [];
    for (var i = 0; i < cs.length; i++) {
      var nm = String((cs[i] && (cs[i].name || cs[i].className)) || '');
      if (nm.indexOf(classMatch) >= 0) { try { CE.gateSatisfaction(GM, cs[i], delta, { turn: num(GM.turn, 0), source: source, reason: reason }); } catch (_) {} return; }
    }
  }
  // 施行一项变法（type 支持中英别名）。仅已种子地域；返回结果供邸报/AI 叙述。
  function applyReform(GM, Pp, regionId, type, opts) {
    Pp = Pp || _P(); opts = opts || {};
    var ls = leaves(Pp), leaf = null;
    for (var i = 0; i < ls.length; i++) { if (regionIdOf(ls[i]) === String(regionId)) { leaf = ls[i]; break; } }
    if (!leaf || !leaf.renliSeed) return { ok: false, reason: '未种子地域' };
    var pd = popOf(leaf); if (!pd) return { ok: false, reason: '无人口对象' };
    var rid = regionIdOf(leaf), seed = leaf.renliSeed;
    var r = ensureRegion(GM, rid, seed);
    var out = { ok: true, type: type, region: rid };
    if (type === 'remit' || type === '蠲免') {
      var turns = Math.max(1, Math.round(num(opts.turns, 1)));
      r.levyPolicy.remitTurns = Math.max(num(r.levyPolicy.remitTurns, 0), turns);
      out.remitTurns = r.levyPolicy.remitTurns;
      _reformGate(GM, '农户', 6, 'reform-remit', '蠲免徭役·与民休息');
    } else if (type === 'waterworks' || type === '兴修水利' || type === '河工') {
      var amt = Math.max(0, Math.round(num(opts.amount, 15)));
      out.waterworksBefore = num(r.waterworks != null ? r.waterworks : seed.waterworks, SEED_DEFAULTS.waterworks);
      r.waterworks = clamp(out.waterworksBefore + amt, 0, 100); out.waterworks = r.waterworks;
    } else if (type === 'resettle' || type === '招抚流民') {
      var before = num(pd.fugitives, 0);
      var back = (opts.amount != null) ? Math.round(num(opts.amount, 0)) : Math.round(before * clamp(num(opts.fraction, 0.4), 0, 1));
      pd.fugitives = Math.max(0, before - back);
      out.fugitivesBefore = before; out.fugitivesAfter = pd.fugitives; out.resettled = before - pd.fugitives;
      _reformGate(GM, '农户', 4, 'reform-resettle', '招抚流民·复业');
    } else if (type === 'survey' || type === '清丈' || type === '清丈田亩') {
      var f = clamp(num(opts.recoverFactor, 0.3), 0, 1);
      out.registeredLandBefore = num(pd.registeredLand, 0);
      pd.registeredLand = Math.round(out.registeredLandBefore * (1 + f));     // 丈出隐田入册
      pd.commendedDing = Math.round(num(pd.commendedDing, 0) * (1 - f));      // 诡寄逆转
      out.registeredLand = pd.registeredLand;
      _reformGate(GM, '士', -8, 'reform-survey', '清丈田亩·触士绅');           // 党派代价
    } else if (type === 'reregister' || type === '重修黄册' || type === '大造黄册') {
      out.registeredDingBefore = num(pd.registeredDing, 0);
      pd.registeredDing = num(pd.ding, 0);                                     // 册实归一·棘轮归零
      out.hiddenCleared = num(pd.hiddenCount, 0); pd.hiddenCount = 0;          // 隐丁现形入册
      pd.commendedDing = Math.round(num(pd.commendedDing, 0) * 0.5);          // 诡寄部分现形
      out.registeredDing = pd.registeredDing;
    } else if (type === 'whip' || type === '一条鞭法' || type === '役折银') {
      var orig = clamp(num(seed.laborMarketDepth, SEED_DEFAULTS.laborMarketDepth), 0, 0.95);
      out.suited = orig >= 0.4;                                               // 有银市场才适配
      seed.laborMarketDepth = Math.max(orig, 0.7); r.whip = true; out.laborMarketDepth = seed.laborMarketDepth;
      if (!out.suited) _reformGate(GM, '农户', -10, 'reform-whip-poison', '一条鞭法行于无银之地·逼贱卖'); // 穷省是毒
    } else if (type === 'capExempt' || type === '限制优免' || type === '士绅一体当差') {
      r.exemptCapFactor = clamp(num(opts.factor, 0.5), 0, 1);                 // 优免打折
      out.exemptCapFactor = r.exemptCapFactor;
      _reformGate(GM, '士', -10, 'reform-capexempt', '限制优免·触功名集团');
      try { refreshExempt(GM, Pp); } catch (_) {}                             // 立即重算 exempt
    } else if (type === 'tanding' || type === '摊丁入亩') {
      r.tanding = true; out.tanding = true;                                  // 丁银并入田赋·役随田走·优免不再蔽役（终局变法·丁作为计量被溶解）
      _reformGate(GM, '士', -12, 'reform-tanding', '摊丁入亩·士绅田亩一体当差'); // 最硬·士绅税特权终败
      _reformGate(GM, '农户', 4, 'reform-tanding', '摊丁入亩·役随田走·小民松');
    } else { return { ok: false, reason: '未知变法:' + type }; }
    ledgerPush(GM, rid, 'reform', 0, '变法:' + type, 'reform');
    return out;
  }

  // ── R6c：诏书文本 → 变法识别触发（仅已种子地域·未种子零工作早返回·gated 惰性）─────────
  // 关键词 → 变法 type（长/具体在前·避子串误配）。「一条鞭法」同时也走货币引擎(各管一面·勿都扣满意度)。
  var REFORM_PATTERNS = [
    { type: 'tanding', cn: '摊丁入亩', re: /摊丁入亩|摊丁|地丁合一|丁随地起/ },
    { type: 'capExempt', cn: '限制优免', re: /限制优免|裁革?优免|核?减优免|优免.{0,3}裁|一体当差/ },
    { type: 'whip', cn: '一条鞭法', re: /一条鞭法?|条鞭|赋役折银|役折银|折银代役/ },
    { type: 'reregister', cn: '重修黄册', re: /重修黄册|重造黄册|大造黄册|攒造黄册|编审黄册/ },
    { type: 'survey', cn: '清丈', re: /清丈|丈量田|核实田亩|鱼鳞图?册/ },
    { type: 'resettle', cn: '招抚流民', re: /招抚流民|招抚流亡|招徕流移|安插流民|抚辑流亡/ },
    { type: 'waterworks', cn: '兴修水利', re: /兴修水利|河工|浚河|修(渠|堤|塘|圩)|疏浚|治水/ },
    { type: 'remit', cn: '蠲免', re: /蠲免|蠲赋|蠲除|免徭|免役|减免徭役/ }
  ];
  var REFORM_NATIONAL_RE = /天下|全国|各省|诸省|通行|海内|普行/;          // 不点名地域时·须带此类词大变法才全国推行
  var REFORM_STRUCTURAL = { tanding: 1, capExempt: 1, whip: 1, reregister: 1, survey: 1 }; // 大变法(避一句话血洗全国)
  var REFORM_CN_NUM = { '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
  function _parseRemitTurns(text) {
    var m = String(text).match(/蠲免?[^0-9一两二三四五六七八九十]{0,6}([0-9]+|[一两二三四五六七八九十])\s*(年|载|岁|回合)/);
    if (!m) return 1;
    var n = /^[0-9]+$/.test(m[1]) ? parseInt(m[1], 10) : (REFORM_CN_NUM[m[1]] || 1);
    return Math.max(1, Math.min(20, n));
  }
  // 诏书文本 → 识别变法 → 对目标已种子地域施行。返回 {applied:[...], skipped:[...], scope, types} 或 null。
  function recognizeEdictReform(GM, Pp, text, opts) {
    if (!GM || !text) return null;
    Pp = Pp || _P(); opts = opts || {};
    var seeded = leaves(Pp).filter(function (l) { return l && l.renliSeed; });
    if (!seeded.length) return null;                       // ★ 无已种子地域 → 零工作早返回（live 零风险·不扫文本）
    text = String(text);
    var hits = [];
    for (var i = 0; i < REFORM_PATTERNS.length; i++) { if (REFORM_PATTERNS[i].re.test(text)) hits.push(REFORM_PATTERNS[i]); }
    if (!hits.length) return null;
    var named = seeded.filter(function (l) {               // 文本点名的已种子地域（按 name 优先·避 id 漂移）
      var nm = String(l.name || ''), rid = regionIdOf(l);
      return (nm && text.indexOf(nm) >= 0) || (rid && rid !== nm && text.indexOf(rid) >= 0);
    });
    var isNational = REFORM_NATIONAL_RE.test(text);
    var applied = [], skipped = [];
    for (var h = 0; h < hits.length; h++) {
      var pat = hits[h];
      var targets = named.length ? named : ((REFORM_STRUCTURAL[pat.type] && !isNational) ? [] : seeded);
      if (!targets.length) { skipped.push({ type: pat.type, typeCN: pat.cn, reason: '大变法未指地域' }); continue; }
      var o = {}; if (pat.type === 'remit') o.turns = _parseRemitTurns(text);
      for (var t = 0; t < targets.length; t++) {
        var rid2 = regionIdOf(targets[t]);
        var res; try { res = applyReform(GM, Pp, rid2, pat.type, o); } catch (_) { res = null; }
        if (res && res.ok) {
          applied.push({ type: pat.type, typeCN: pat.cn, region: rid2, regionName: targets[t].name || rid2, result: res,
            label: pat.cn + '·' + (targets[t].name || rid2) + (res.suited === false ? '（行于无银之地·恐成扰）' : '') });
        }
      }
    }
    if (!applied.length && !skipped.length) return null;
    return { applied: applied, skipped: skipped, scope: named.length ? 'region' : (isNational ? 'national' : 'soft-all'), types: hits.map(function (p) { return p.type; }) };
  }

  // ── R5：问天 god-mode 解析器（丁/田/役/农政·镜像阶层/军队三件套·防幽灵属性）──────
  var WT_PREFIX = /^(region|地域|丁口|田|田土|役|役政)$/i; // 强制前缀·避免裸名误伤别的实体
  // field 别名 → {store:leaf|alloc|region|policy, key, kind:int(≥0)/pct(0-100)/weather/str}
  var WT_FIELDS = {
    '册载丁': { store: 'leaf', key: 'registeredDing', kind: 'int' }, 'registeredding': { store: 'leaf', key: 'registeredDing', kind: 'int' },
    '实在丁': { store: 'leaf', key: 'ding', kind: 'int' }, '丁': { store: 'leaf', key: 'ding', kind: 'int' }, 'ding': { store: 'leaf', key: 'ding', kind: 'int' },
    '逃亡': { store: 'leaf', key: 'fugitives', kind: 'int' }, '逃户': { store: 'leaf', key: 'fugitives', kind: 'int' }, 'fugitives': { store: 'leaf', key: 'fugitives', kind: 'int' },
    '隐丁': { store: 'leaf', key: 'hiddenCount', kind: 'int' }, '隐户': { store: 'leaf', key: 'hiddenCount', kind: 'int' }, 'hiddencount': { store: 'leaf', key: 'hiddenCount', kind: 'int' },
    '额田': { store: 'leaf', key: 'registeredLand', kind: 'int' }, 'registeredland': { store: 'leaf', key: 'registeredLand', kind: 'int' },
    '优免': { store: 'leaf', key: 'exemptDing', kind: 'int' }, 'exemptding': { store: 'leaf', key: 'exemptDing', kind: 'int' },
    '务农': { store: 'alloc', key: 'farm', kind: 'int' }, '应役': { store: 'alloc', key: 'corvee', kind: 'int' }, '应征': { store: 'alloc', key: 'draft', kind: 'int' },
    '地力': { store: 'region', key: 'soil', kind: 'pct' }, 'soil': { store: 'region', key: 'soil', kind: 'pct' },
    '水利': { store: 'region', key: 'waterworks', kind: 'pct' }, 'waterworks': { store: 'region', key: 'waterworks', kind: 'pct' },
    '天时': { store: 'region', key: 'weather', kind: 'weather' }, 'weather': { store: 'region', key: 'weather', kind: 'weather' },
    '役需': { store: 'policy', key: 'corveeDemand', kind: 'int' }, '军需': { store: 'policy', key: 'draftDemand', kind: 'int' },
    '征发强度': { store: 'policy', key: 'strength', kind: 'str' }, '蠲免': { store: 'policy', key: 'remitTurns', kind: 'int' }
  };
  function _wtNorm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function _wtScalar(old, op, value, kind) {
    if (kind === 'str') return String(value == null ? '' : value).trim();
    var v = Number(value), o = Number(old) || 0;
    if (op === 'add') return o + (isFinite(v) ? v : 0);
    if (op === 'mul') return o * (isFinite(v) ? v : 1);
    return isFinite(v) ? v : o; // set
  }
  function _wtClampField(val, kind) {
    if (kind === 'str') return val;
    if (kind === 'pct') return clamp(Math.round(num(val)), 0, 100);
    if (kind === 'weather') return clamp(Math.round(num(val) * 100) / 100, 0.3, 1.3);
    return Math.max(0, Math.round(num(val))); // int ≥0
  }
  // 返回 true=已处理（命中并写真对象）·false=非 renli 路径（交派发器继续）
  function wtHardChange(GM, Pp, parts, op, value, afterCb) {
    if (!GM || !Array.isArray(parts) || parts.length < 3) return false;
    if (!WT_PREFIX.test(String(parts[0]))) return false;          // 须前缀·裸名一律不收（防误伤）
    var name = parts[1];
    var rawF = parts.slice(2).join('.');
    var fld = WT_FIELDS[rawF] || WT_FIELDS[_wtNorm(rawF)];
    if (!name || !fld) return false;
    Pp = Pp || _P();
    var ls = leaves(Pp), leaf = null;
    for (var i = 0; i < ls.length; i++) { var rid = regionIdOf(ls[i]); if (rid === String(name) || rid.indexOf(name) >= 0 || String(name).indexOf(rid) >= 0) { leaf = ls[i]; break; } }
    if (!leaf) return false;
    var pd = popOf(leaf); if (!pd) return false;
    ensureLeafFields(leaf);
    var rid2 = regionIdOf(leaf);
    var r = ensureRegion(GM, rid2, leaf.renliSeed);
    var oldVal, newVal, host;
    if (fld.store === 'leaf') host = pd;
    else if (fld.store === 'alloc') { if (!pd.alloc) pd.alloc = {}; host = pd.alloc; }
    else if (fld.store === 'region') host = r;
    else if (fld.store === 'policy') { if (!r.levyPolicy) r.levyPolicy = { strength: 'normal', remitTurns: 0 }; host = r.levyPolicy; }
    else return false;
    oldVal = host[fld.key];
    newVal = _wtClampField(_wtScalar(oldVal, op || 'set', value, fld.kind), fld.kind);
    host[fld.key] = newVal; // 写真对象·非数组字符串幽灵键
    if (typeof afterCb === 'function') { try { afterCb('renli.' + rid2 + '.' + fld.key, oldVal, newVal); } catch (_) {} }
    return true;
  }

  // ── 激活：已种子地域查询（供 huji 逃亡去重·A2a 单一权威）──────────────────
  // 已种子地域键集（含 id 与 name 两形·容 huji byRegion key 的 id/name 歧义）
  function seededRegionKeySet(Pp) {
    Pp = Pp || _P();
    var set = {};
    function addKeys(node) { var id = String(node.id || ''), nm = String(node.name || ''); if (id) set[id] = true; if (nm) set[nm] = true; }
    // 上溯：叶子已种子→计入其 key；某 division「全部叶子后代均已种子」→其 key 亦计入。
    // 因 huji byRegion 按「省」key 而 Renli 种「府」叶——补省级 key 才能令 huji 的 deep-field 省级让出（否则省 key 对不上府 key→不让出→双产）。
    function walk(node) {
      if (!node) return false;
      var k = node.children || node.divisions;
      if (!k || !k.length) { if (node.renliSeed) { addKeys(node); return true; } return false; }
      var all = true;
      for (var j = 0; j < k.length; j++) { if (!walk(k[j])) all = false; }
      if (all) addKeys(node);
      return all;
    }
    var ah = Pp && Pp.adminHierarchy;
    var fac = ah && (ah.player || ah[Object.keys(ah)[0]]);
    (fac && fac.divisions || []).forEach(walk);
    return set;
  }
  // 已种子地域丁占全国丁之比（供 huji 全国汇总逃亡按未种子份额缩减）
  function seededDingShare(Pp) {
    Pp = Pp || _P();
    var ls = leaves(Pp), seeded = 0, total = 0;
    for (var i = 0; i < ls.length; i++) {
      var pd = popOf(ls[i]); if (!pd) continue;
      var d = Math.max(0, num(pd.ding, 0)); total += d;
      if (ls[i].renliSeed) seeded += d;
    }
    return total > 0 ? clamp(seeded / total, 0, 1) : 0;
  }

  // ── 刀D：役政农情喂 AI 上下文（种子省真值摘要·未激活返 null=零注入·朝代中立）─────────
  function _gradeCorvee(rate) {
    if (rate >= 0.40) return '苛'; if (rate >= 0.28) return '重'; if (rate >= 0.18) return '适中'; return '轻';
  }
  function formatForPrompt(GM, opts) {
    opts = opts || {};
    var Pp = _P();
    if (!GM || !GM.renli || !GM.renli.byRegion) return null;
    var ls = leaves(Pp).filter(function (l) { return l && l.renliSeed; });
    if (!ls.length) return null;                                   // 未推行役政→零注入（休眠态 AI 不见）
    var limit = num(opts.limit, 10), rows = [];
    ls.forEach(function (leaf) {
      var pd = popOf(leaf); if (!pd) return;
      var rid = regionIdOf(leaf), r = getRegion(GM, rid); if (!r) return;
      var ding = Math.max(0, num(pd.ding, 0));
      var fleeRatio = ding > 0 ? num(pd.fugitives, 0) / ding : 0;
      var corveeRate = num(r.corveeRate, 0);
      var need = num(r.foodNeed, 0), deficit = num(r.foodDeficit, 0);
      var deficitRatio = need > 0 ? deficit / need : 0;
      var parts = ['役负' + _gradeCorvee(corveeRate) + '(' + Math.round(corveeRate * 100) + '%)'];
      if (need > 0) parts.push(deficit > 0 ? ('缺粮' + Math.round(deficitRatio * 100) + '%') : '粮足');
      if (num(r.fallowLand, 0) > 0) parts.push('抛荒' + Math.round(num(r.fallowLand, 0)) + '亩');
      if (fleeRatio > 0.03) parts.push('逃亡' + Math.round(fleeRatio * 100) + '%');
      var pol = r.levyPolicy || {};
      if (num(pol.remitTurns, 0) > 0) parts.push('蠲免中(余' + num(pol.remitTurns, 0) + '回合)');
      if (r.tanding) parts.push('已摊丁入亩'); else if (r.whip) parts.push('已行役折银');
      var collapse = (fleeRatio > COLLAPSE_FLEE && num(r.deficitTurns, 0) >= COLLAPSE_DEFICIT_TURNS);
      if (collapse) parts.push('★流民载道·濒乱'); else if (num(r.deficitTurns, 0) >= 2) parts.push('连岁歉收');
      rows.push({ txt: '- ' + (leaf.name || rid) + '：' + parts.join('·'),
        sev: (collapse ? 3 : 0) + deficitRatio + fleeRatio + Math.max(0, corveeRate - CORVEE_LINE) });
    });
    if (!rows.length) return null;
    rows.sort(function (a, b) { return b.sev - a.sev; });          // 危情重者在前（限额内优先喂）
    return '役政农情（已推行役政之地·实在地情·门生密报真值）：\n' + rows.slice(0, limit).map(function (x) { return x.txt; }).join('\n');
  }

  // ── 刀C：官报雾（reported 写活·督抚奏报口径·可瞒报）+ 真相对照供 AI/UI ──────────────
  function _charByName(GM, name) {
    if (!name || !GM || !Array.isArray(GM.chars)) return null;
    for (var i = 0; i < GM.chars.length; i++) { var c = GM.chars[i]; if (c && c.alive !== false && String(c.name) === String(name)) return c; }
    return null;
  }
  function _charStress(c) { return c ? num(c.resources && c.resources.stress != null ? c.resources.stress : c.stress, 30) : 30; }
  function _charFame(c) { return c ? num(c.resources && c.resources.fame != null ? c.resources.fame : c.fame, 0) : 0; }
  function _charLoyalty(c) { return c ? num(c.loyalty, 60) : 60; }
  // 区域→主官名（子区继承最近上级 governor·治所/省主官覆盖府县）
  function _governorMap(Pp) {
    Pp = Pp || _P(); var map = {};
    var ah = Pp && Pp.adminHierarchy; if (!ah) return map;
    var fac = ah.player || ah[Object.keys(ah)[0]];
    (function walk(nodes, inherited) {
      if (!Array.isArray(nodes)) return;
      nodes.forEach(function (n) {
        if (!n) return;
        var gov = n.governor || inherited || '';
        var kids = n.children || n.divisions;
        if (kids && kids.length) walk(kids, gov); else map[regionIdOf(n)] = gov;
      });
    })(fac && fac.divisions, '');
    return map;
  }
  // 每回合重算官报口径（督抚按 disposition+危情 粉饰真值·写既有 GM.renli.reported 死桩）。仅已种子地域。
  function refreshReported(GM, Pp) {
    Pp = Pp || _P();
    if (!GM || !GM.renli) return;
    if (!GM.renli.reported) GM.renli.reported = {};
    var ls = leaves(Pp).filter(function (l) { return l && l.renliSeed; });
    if (!ls.length) return;
    var govMap = _governorMap(Pp);
    ls.forEach(function (leaf) {
      var pd = popOf(leaf); if (!pd) return;
      var rid = regionIdOf(leaf), r = getRegion(GM, rid); if (!r) return;
      var ding = Math.max(0, num(pd.ding, 0));
      var fleeRate = ding > 0 ? clamp(num(pd.fugitives, 0) / ding, 0, 1) : 0;
      var corveeRate = num(r.corveeRate, 0);
      var cult = num(r.cultivatedLand, 0), fallow = num(r.fallowLand, 0);
      var fallowShare = (cult + fallow) > 0 ? clamp(fallow / (cult + fallow), 0, 1) : 0;
      var need = num(r.foodNeed, 0), deficitRatio = need > 0 ? clamp(num(r.foodDeficit, 0) / need, 0, 1) : 0;
      var gov = _charByName(GM, govMap[rid]);
      // 瞒报幅度：督抚 stress 高(怕担责)/loyalty 低(不尽职)/fame 高(要脸面)→粉饰；无主官→例行轻度
      var base = gov ? (0.45 * (_charStress(gov) / 100) + 0.35 * (1 - _charLoyalty(gov) / 100) + 0.20 * clamp(_charFame(gov) / 100, 0, 1)) : 0.15;
      var danger = clamp(deficitRatio + Math.max(0, corveeRate - CORVEE_LINE) * 2 + fleeRate, 0, 1); // 坏事越多越想盖
      var conceal = clamp(base * (1 + 0.5 * danger), 0, 0.6);                                        // 封顶 60%·瞒不到天衣无缝
      var keep = 1 - conceal;
      GM.renli.reported[rid] = {
        corveeRate: Math.round(corveeRate * keep * 10000) / 10000,
        fallowShare: Math.round(fallowShare * keep * 10000) / 10000,
        fugitiveRate: Math.round(fleeRate * keep * 10000) / 10000,
        deficitRatio: Math.round(deficitRatio * keep * 10000) / 10000,
        conceal: Math.round(conceal * 1000) / 1000,
        governor: (gov && gov.name) || (govMap[rid] || ''),
        turn: num(GM.turn, 0)
      };
    });
  }
  // 官报 vs 真相（供奏疏读官报、鸿雁/方志读真相、清丈刷真值·UI/后续政道消费）
  function getReportedVsTruth(GM, regionId) {
    if (!GM || !GM.renli) return null;
    var rid = String(regionId);
    var rep = (GM.renli.reported && GM.renli.reported[rid]) || null;
    var r = getRegion(GM, rid);
    if (!r) return rep ? { reported: rep, truth: null } : null;
    var cult = num(r.cultivatedLand, 0), fallow = num(r.fallowLand, 0), need = num(r.foodNeed, 0);
    return { reported: rep, truth: {
      corveeRate: Math.round(num(r.corveeRate, 0) * 10000) / 10000,
      fallowShare: (cult + fallow) > 0 ? Math.round(fallow / (cult + fallow) * 10000) / 10000 : 0,
      deficitRatio: need > 0 ? Math.round(num(r.foodDeficit, 0) / need * 10000) / 10000 : 0
    } };
  }
  // 官报与实情之差喂 AI（只在有粉饰且有坏事可瞒时·高信号·辨欺君）。仅已种子。
  function formatReportedForPrompt(GM, opts) {
    opts = opts || {};
    if (!GM || !GM.renli || !GM.renli.reported) return null;
    var Pp = _P();
    var ls = leaves(Pp).filter(function (l) { return l && l.renliSeed; });
    if (!ls.length) return null;
    var limit = num(opts.limit, 8), rows = [];
    ls.forEach(function (leaf) {
      var rid = regionIdOf(leaf), rep = GM.renli.reported[rid]; if (!rep) return;
      var r = getRegion(GM, rid); if (!r) return;
      var pd = popOf(leaf); var ding = pd ? Math.max(0, num(pd.ding, 0)) : 0;
      var tCorvee = num(r.corveeRate, 0);
      var tFlee = ding > 0 ? num(pd.fugitives, 0) / ding : 0;
      var cult = num(r.cultivatedLand, 0), fallow = num(r.fallowLand, 0);
      var tFallow = (cult + fallow) > 0 ? fallow / (cult + fallow) : 0;
      var conceal = num(rep.conceal, 0);
      var hasBad = (tCorvee > CORVEE_LINE) || (tFlee > 0.05) || (tFallow > 0.05) || (num(r.foodDeficit, 0) > 0);
      if (conceal < 0.12 || !hasBad) return;                       // 无粉饰或无坏事可瞒→不进（省 token）
      rows.push({ sev: conceal + tFlee + Math.max(0, tCorvee - CORVEE_LINE),
        txt: '- ' + (leaf.name || rid) + '：' + (rep.governor ? ('督抚' + rep.governor) : '有司') + '奏报 役负' + Math.round(num(rep.corveeRate, 0) * 100) + '%/抛荒' + Math.round(num(rep.fallowShare, 0) * 100) + '%/逃亡' + Math.round(num(rep.fugitiveRate, 0) * 100) + '%，实为 役负' + Math.round(tCorvee * 100) + '%/抛荒' + Math.round(tFallow * 100) + '%/逃亡' + Math.round(tFlee * 100) + '%（瞒报~' + Math.round(conceal * 100) + '%）' });
    });
    if (!rows.length) return null;
    rows.sort(function (a, b) { return b.sev - a.sev; });
    return '督抚奏报与实情之差（官报口径或经粉饰·凭此辨欺君·读鸿雁/遣巡查见真相）：\n' + rows.slice(0, limit).map(function (x) { return x.txt; }).join('\n');
  }

  // ── 刀C-玩家侧：官报雾浮到界面（奏疏读 reported 粉饰 / 鸿雁门生密报读真相）──────────
  var ZOU_CAP = 12, MI_CAP = 8; // 每回合最多 N 道役政奏报 / 门生密报（按危情取重·防刷屏；dedup 后总数恒≤种子省数）
  function _ensureArr(GM, key) { if (!Array.isArray(GM[key])) GM[key] = []; return GM[key]; }
  // 过回合：种子省有事者→奏疏（官报粉饰口径）；真情严峻且与官报有落差者→门生密报（真值·读私信者更早见螺旋）。皆 dedup 刷新·非堆积。
  function spawnReportedChannels(GM, Pp) {
    Pp = Pp || _P();
    if (!GM || !GM.renli) return;
    var ls = leaves(Pp).filter(function (l) { return l && l.renliSeed; });
    if (!ls.length) return;
    var govMap = _governorMap(Pp);
    var cands = [];
    ls.forEach(function (leaf) {
      var pd = popOf(leaf); if (!pd) return;
      var rid = regionIdOf(leaf), r = getRegion(GM, rid); if (!r) return;
      var ding = Math.max(0, num(pd.ding, 0));
      var fleeRatio = ding > 0 ? num(pd.fugitives, 0) / ding : 0;
      var corveeRate = num(r.corveeRate, 0);
      var deficit = num(r.foodDeficit, 0), need = num(r.foodNeed, 0);
      var deficitRatio = need > 0 ? deficit / need : 0;
      var hasBad = corveeRate > CORVEE_LINE || fleeRatio > 0.05 || deficit > 0 || num(r.fallowLand, 0) > 0;
      if (!hasBad) return;                                          // 太平无事不奏不密报（省界面噪声）
      cands.push({ leaf: leaf, pd: pd, r: r, rid: rid, name: leaf.name || rid, fleeRatio: fleeRatio, corveeRate: corveeRate,
        deficit: deficit, deficitRatio: deficitRatio, sev: deficitRatio + fleeRatio + Math.max(0, corveeRate - CORVEE_LINE) });
    });
    if (!cands.length) return;
    cands.sort(function (a, b) { return b.sev - a.sev; });
    var mems = _ensureArr(GM, 'memorials'), letters = _ensureArr(GM, 'letters');
    cands.slice(0, ZOU_CAP).forEach(function (c) {
      var rep = (GM.renli.reported && GM.renli.reported[c.rid]) || null;
      var govName = (rep && rep.governor) || govMap[c.rid] || '有司';
      var repCorvee = rep ? num(rep.corveeRate, c.corveeRate) : c.corveeRate;
      var repFallow = rep ? num(rep.fallowShare, 0) : 0;
      var repFlee = rep ? num(rep.fugitiveRate, c.fleeRatio) : c.fleeRatio;
      // ① 奏疏（官报·读 reported 粉饰口径）·dedup 刷新
      var zid = 'renli-zou-' + c.rid;
      var zbody = govName + '谨奏：' + c.name + '今岁役政。役负约' + Math.round(repCorvee * 100) + '%'
        + (repFallow > 0.01 ? ('，抛荒约' + Math.round(repFallow * 100) + '%') : '，田畴粗安')
        + (repFlee > 0.03 ? ('，间有流移约' + Math.round(repFlee * 100) + '%') : '，户口尚完') + '。臣已多方抚绥，伏乞圣鉴。';
      var z = mems.find(function (m) { return m && m.id === zid; });
      if (z) { z.content = zbody; z.text = zbody; z.from = govName; z.turn = num(GM.turn, 0); }
      else {
        mems.unshift({ id: zid, title: c.name + '·役政奏报', topic: c.name + '·役政奏报', from: govName, dept: '地方有司',
          type: '民情', subtype: '役政', content: zbody, text: zbody, status: 'pending',
          priority: (c.corveeRate > 0.4 || c.deficitRatio > 0.4) ? 'high' : 'normal', turn: num(GM.turn, 0),
          sourceSystem: 'renli', sourceType: 'renli_reported', linkedRegion: c.rid });
      }
    });
    if (mems.length > 120) GM.memorials = mems.slice(0, 120);
    // ② 鸿雁（真相·门生密报）——仅真情严峻（与官报有落差才值得冒险密报）·top MI_CAP
    var severeList = cands.filter(function (c) {
      var collapse = (c.fleeRatio > COLLAPSE_FLEE && num(c.r.deficitTurns, 0) >= COLLAPSE_DEFICIT_TURNS);
      var rep = (GM.renli.reported && GM.renli.reported[c.rid]) || null;
      var concealGap = rep ? num(rep.conceal, 0) : 0;
      c._collapse = collapse;
      return collapse || c.deficitRatio > 0.3 || (c.corveeRate > 0.4 && concealGap > 0.2);
    }).slice(0, MI_CAP);
    severeList.forEach(function (c) {
      var lid = 'renli-mi-' + c.rid;
      var lbody = '密启者：' + c.name + '实情远非有司奏报所言。役负实约' + Math.round(c.corveeRate * 100) + '%，'
        + (c.deficit > 0 ? ('粮缺约' + Math.round(c.deficitRatio * 100) + '%，') : '')
        + (c.fleeRatio > 0.03 ? ('流亡约' + Math.round(c.fleeRatio * 100) + '%，') : '')
        + (num(c.r.fallowLand, 0) > 0 ? '抛荒已广，' : '')
        + (c._collapse ? '流民载道，恐生大变。' : '民力将竭，宜早为之所。') + '惟乞钧鉴，勿付有司，恐遭壅蔽。';
      var l = letters.find(function (x) { return x && x.id === lid; });
      if (l) { l.content = lbody; l.turn = num(GM.turn, 0); l.playerRead = false; }
      else {
        letters.unshift({ id: lid, from: '门生·' + c.name, title: c.name + '·密启', content: lbody,
          turn: num(GM.turn, 0), playerRead: false, sourceSystem: 'renli', sourceType: 'renli_truth', cipher: 'secret' });
      }
    });
    if (letters.length > 200) GM.letters = letters.slice(0, 200);
  }

  // ── 刀B-深做：粮荒田赋欠征（单写者直扣 guoku.grain·非双算）─────────────────────────
  // 既有「逃亡/隐丁→税基→国库收入」由 huji collectionMultiplier 管(动 money 月入·人没了)；
  // 既有田赋粮入库由 FiscalEngine 按田亩名义征(收成几何不问)。此处补**唯一缺口**：在册之民收成毁→其名义粮赋交不出。
  //   欠征 = 失收之粮(foodDeficit) × 国家田赋份额。单写者(Renli)·只动 guoku.grain(不碰 money/income·与上两路零重叠)·封顶防掏空·门控种子省。
  var GRAIN_TAX_SHARE = 0.12;     // 国家于「失收之粮」中的田赋份额（粮荒欠征系数·owner 激活时可校准）
  var GUOKU_GRAIN_GUARD = 0.20;   // 单回合粮荒欠征总额 ≤ 国库现粮之比（防一灾掏空粮库）
  function _guoku(GM) { return (GM && GM.guoku && typeof GM.guoku === 'object') ? GM.guoku : null; }
  function applyGrainShortfall(GM, Pp) {
    Pp = Pp || _P();
    var gk = _guoku(GM); if (!gk || typeof gk.grain !== 'number') return 0;  // 无帑廪粮账→inert
    var ls = leaves(Pp).filter(function (l) { return l && l.renliSeed; });
    if (!ls.length) return 0;
    var raws = [], rawTotal = 0;
    ls.forEach(function (leaf) {
      var pd = popOf(leaf); if (!pd) return;
      var rid = regionIdOf(leaf), r = getRegion(GM, rid); if (!r) return;
      var deficit = num(r.foodDeficit, 0);
      if (deficit <= 0) { r._grainShortfall = 0; return; }
      var sf = Math.round(deficit * GRAIN_TAX_SHARE);
      if (sf <= 0) { r._grainShortfall = 0; return; }
      raws.push({ rid: rid, r: r, sf: sf }); rawTotal += sf;
    });
    if (rawTotal <= 0) return 0;
    var applied = Math.min(rawTotal, Math.round(num(gk.grain, 0) * GUOKU_GRAIN_GUARD)); // 封顶
    var factor = rawTotal > 0 ? applied / rawTotal : 0, deducted = 0;
    raws.forEach(function (x) {
      var share = Math.round(x.sf * factor);
      x.r._grainShortfall = share; x.r._grainShortfallTurn = num(GM.turn, 0);
      if (share > 0) ledgerPush(GM, x.rid, 'grainShortfall', -share, '粮荒田赋欠征', 'renli');
      deducted += share;
    });
    gk.grain = Math.max(0, num(gk.grain, 0) - deducted);
    return deducted;
  }

  // ── 导出 ──────────────────────────────────────────────────────────────
  var api = {
    ALLOC_KEYS: ALLOC_KEYS, SEED_DEFAULTS: SEED_DEFAULTS,
    RHO_STAR: RHO_STAR, RHO_MIN: RHO_MIN, BASE_YIELD: BASE_YIELD, STRENGTH_CAP: STRENGTH_CAP,
    CORVEE_LINE: CORVEE_LINE, SUBSIST: SUBSIST,
    leaves: leaves, popOf: popOf, presentDing: presentDing,
    ensureLeafFields: ensureLeafFields, ensureRegion: ensureRegion, ensureDefaults: ensureDefaults,
    seedRegion: seedRegion, ledgerPush: ledgerPush, getRegion: getRegion,
    levyableDing: levyableDing, allocValid: allocValid, assertNoDingInRenli: assertNoDingInRenli,
    findFarmerClass: findFarmerClass, applyRegionalVariant: applyRegionalVariant,
    _qOf: _qOf, tickLeaf: tickLeaf, tick: tick,
    warScar: warScar, warScarFromBattle: warScarFromBattle,
    refreshExempt: refreshExempt, endturnTick: endturnTick, ensurePilotSeeds: ensurePilotSeeds,
    applyReform: applyReform, recognizeEdictReform: recognizeEdictReform,
    applyUnrestPressure: applyUnrestPressure, formatForPrompt: formatForPrompt,
    refreshReported: refreshReported, getReportedVsTruth: getReportedVsTruth, formatReportedForPrompt: formatReportedForPrompt,
    spawnReportedChannels: spawnReportedChannels, applyGrainShortfall: applyGrainShortfall,
    refreshWeather: refreshWeather,
    seededRegionKeySet: seededRegionKeySet, seededDingShare: seededDingShare,
    wtHardChange: wtHardChange,
    VERSION: 4.2
  };

  if (typeof window !== 'undefined') { window.TM = window.TM || {}; window.TM.Renli = api; }
  else if (typeof globalThis !== 'undefined') { globalThis.TM = globalThis.TM || {}; globalThis.TM.Renli = api; }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
