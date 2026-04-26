// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-fiscal-cascade.js — 地方→中央 税收级联自然结算（三账版）
 *
 * 对应方案：
 *   · 设计方案-财政系统.md §5.2 税收公式 + §5.3 三账结构
 *   · 设计方案-央地财政.md §3 qiyun/cunliu 分账 + compliance + logisticsLoss
 *   · 设计方案-经济系统联动总图.md §5 每回合时序
 *
 * 核心原则：
 *   1. **先自然结算、再交 AI 叠加** —— AI 看到的 guoku/neitang/民心/腐败/户口
 *      都是级联结算后的结果（汇总好的数字），减少 AI 阅读量。
 *   2. **税收链**：每顶级 division → 各税种 amount → qiyun/cunliu 分账 →
 *      compliance 扣 → 路途损耗 → 主官挪用（skimmed）→ 最终到 GM.guoku.ledgers.{kind}
 *   3. **三账**：钱(money)/粮(grain)/布(cloth) 各走各的账，不互换
 *   4. **不动现有字段兼容**：既更新 ledgers.X.stock 又同步 GM.guoku.money/grain/cloth 标量
 *
 * 对外 API：
 *   CascadeTax.collect()   —— endTurn 前调用，执行本回合税收级联
 *   CascadeTax.tick(ctx)   —— 同上，供 endTurn hook 用
 *
 * 此模块**不**暴露任何玩家 UI 操作，全部自然结算。
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  默认税种（若 sc.fiscalConfig.taxes 未提供则用这套 fallback）
  // ═══════════════════════════════════════════════════════════════════

  // 默认税率（**年**化标准，按朝代史实调小；运行时按 turnDays/365 缩放）
  // 唐宋元 1 丁年入租：粟二石（约 1.5 两银折色）；明万历岁入约 4000 万两/2 亿口 ≈ 0.2 两/口
  // 综合下默认每丁年税约 0.2 两 + 田赋 0.8 石
  var DEFAULT_TAXES = [
    {
      id: 'land_grain',    name: '田赋（粮）',
      base: 'arableLand',  baseFallback: 'mouths',
      baseFactor: 0.3,     rate: 0.05,            // 亩产 * 30% * 5% ≈ 0.015 石/亩·年（明代田赋折征水平）
      storeAs: 'grain',    sourceTag: 'tianfu',
      annual: true
    },
    {
      id: 'land_silver',   name: '田赋折银',
      base: 'arableLand',  baseFallback: 'mouths',
      baseFactor: 1,       rate: 0.005,           // 每亩 0.005 两/年（条编/金花银）
      storeAs: 'money',    sourceTag: 'tianfu_silver',
      annual: true
    },
    {
      id: 'head_tax',      name: '丁税',
      base: 'ding',        baseFallback: 'mouths',
      baseFactor: 1,       rate: 0.15,            // 每丁 0.15 两/年
      storeAs: 'money',    sourceTag: 'dingshui',
      annual: true
    },
    {
      id: 'corvee_cloth',  name: '庸役折布',
      base: 'ding',        baseFallback: 'mouths',
      baseFactor: 1,       rate: 0.1,             // 每丁 0.1 匹/年
      storeAs: 'cloth',    sourceTag: 'yongBu',
      annual: true
    },
    {
      id: 'commerce',      name: '商税',
      base: 'commerceVolume', baseFallback: 'prosperity',
      baseFactor: 1,       rate: 0.015,           // 商业体量 * 1.5%（实征率·明代商税平均水平）
      storeAs: 'money',    sourceTag: 'shangShui',
      annual: true
    },
    {
      id: 'salt_iron',     name: '盐铁专卖',
      base: 'mouths',      baseFallback: null,
      baseFactor: 0.025,   rate: 0.6,             // 人均盐铁税约 0.015 两/年（明代盐课实征 ~250万两/全国 1.6亿口）
      storeAs: 'money',    sourceTag: 'yanlizhuan',
      annual: true
    }
  ];

  // 默认分账模式（每税种 qiyun/cunliu 比例）—— 可被 sc.fiscalConfig.centralLocalRules 覆盖
  var DEFAULT_ALLOCATION = {
    mode: 'qiyun_cunliu',
    perTax: {
      'land_grain':   { qiyun: 0.6,  cunliu: 0.4 },
      'land_silver':  { qiyun: 0.7,  cunliu: 0.3 },
      'head_tax':     { qiyun: 0.8,  cunliu: 0.2 },
      'corvee_cloth': { qiyun: 0.5,  cunliu: 0.5 },
      'commerce':     { qiyun: 0.5,  cunliu: 0.5 },
      'salt_iron':    { qiyun: 0.9,  cunliu: 0.1 }
    },
    defaultPerTax:    { qiyun: 0.7,  cunliu: 0.3 }
  };

  var DEFAULT_LOGISTICS_LOSS = 0.15;   // 路途损耗 15%

  // 估算全国总人口(给 flat 类型 customTax 按口数比例摊到各 division 用)
  function _estimateNationalMouths(G) {
    if (G && G.population && G.population.national && G.population.national.mouths > 0) {
      return G.population.national.mouths;
    }
    // 兜底·按 adminHierarchy 累加
    var total = 0;
    if (G && G.adminHierarchy) {
      Object.keys(G.adminHierarchy).forEach(function(fkey) {
        var tree = G.adminHierarchy[fkey];
        function _walk(divs) {
          if (!Array.isArray(divs)) return;
          divs.forEach(function(d) {
            if (d && d.populationDetail && d.populationDetail.mouths) total += d.populationDetail.mouths;
            else if (d && d.population) total += d.population;
            if (d && d.children) _walk(d.children);
          });
        }
        _walk(tree && tree.divisions || []);
      });
    }
    return Math.max(50000000, total);  // 至少 5000 万兜底
  }

  // ═══════════════════════════════════════════════════════════════════
  //  工具
  // ═══════════════════════════════════════════════════════════════════

  function _ensureLedger(obj, key, initialStock) {
    if (!obj[key]) obj[key] = {
      stock: initialStock || 0,
      lastTurnIn: 0, lastTurnOut: 0,
      thisTurnIn: 0, thisTurnOut: 0,
      sources: {}, sinks: {},
      history: []
    };
    return obj[key];
  }

  function _addToLedger(ledger, amount, sourceTag) {
    if (amount <= 0) return;
    ledger.stock = (ledger.stock || 0) + amount;
    ledger.thisTurnIn = (ledger.thisTurnIn || 0) + amount;
    if (sourceTag) {
      ledger.sources = ledger.sources || {};
      ledger.sources[sourceTag] = (ledger.sources[sourceTag] || 0) + amount;
    }
  }

  function _ensureRegionFiscal(div) {
    if (!div.fiscal) div.fiscal = {};
    var f = div.fiscal;
    if (!f.ledgers) {
      f.ledgers = {
        money: { stock: 0, thisTurnIn: 0, thisTurnOut: 0 },
        grain: { stock: 0, thisTurnIn: 0, thisTurnOut: 0 },
        cloth: { stock: 0, thisTurnIn: 0, thisTurnOut: 0 }
      };
    }
    if (f.compliance === undefined) f.compliance = 0.85;
    if (f.claimedRevenue === undefined) f.claimedRevenue = 0;
    if (f.actualRevenue === undefined)  f.actualRevenue = 0;
    if (f.remittedToCenter === undefined) f.remittedToCenter = 0;
    if (f.retainedBudget === undefined) f.retainedBudget = 0;
    if (f.skimmingRate === undefined) f.skimmingRate = 0.1;
    if (f.autonomyLevel === undefined) f.autonomyLevel = 0.3;
    // 本回合累计（存给 bridge aggregate 用）
    f._thisTurnRemitMoney = 0;
    f._thisTurnRemitGrain = 0;
    f._thisTurnRemitCloth = 0;
    return f;
  }

  function _ensureRegionPubTreasury(div) {
    if (!div.publicTreasury) {
      div.publicTreasury = {
        money: { stock: 0, quota: 0, used: 0, available: 0, deficit: 0 },
        grain: { stock: 0, quota: 0, used: 0, available: 0, deficit: 0 },
        cloth: { stock: 0, quota: 0, used: 0, available: 0, deficit: 0 },
        currentHead: null, previousHead: null, handoverLog: []
      };
    }
    return div.publicTreasury;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  经济基础项·每个 division 上挂 economyBase + tags
  //  公式（步骤 5 重写收支时用）：
  //    田赋   = ∑ farmland × landTaxRate × compliance
  //    商税   = ∑ commerceVolume × commerceTaxRate × compliance
  //    市舶   = ∑ maritimeTradeVolume × maritimeTaxRate （hasPort）
  //    盐课   = ∑ saltProduction × saltTaxRate （saltRegion）
  //    矿冶   = ∑ mineralProduction × mineralTaxRate （mineralRegion）
  //    渔课   = ∑ fishingProduction × fishingTaxRate （fishingRegion）
  //    战马采办（支出）= 总需求 - ∑ horseProduction （国产抵扣·horseRegion）
  // ═══════════════════════════════════════════════════════════════════

  // 按地形给 默认 亩/户（historical reference: 《万历会计录》各省实田 ÷ 黄册户）
  // 仅作 fallback·剧本应在 division.economyBase.farmland 配置具体值
  function _defaultFarmlandPerHH(terrain) {
    if (!terrain) return 22;  // 未指定·偏保守
    var t = String(terrain);
    if (t.indexOf('平原') >= 0) return 32;     // 北直隶/河南/山东 ~31 亩/户
    if (t.indexOf('盆地') >= 0) return 24;     // 四川盆地 黄册偏低 实际更高
    if (t.indexOf('丘陵') >= 0) return 22;     // 江浙赣 ~22-26
    if (t.indexOf('沿海') >= 0) return 16;     // 闽粤 ~15
    if (t.indexOf('高原') >= 0) return 14;     // 陕北/晋北 ~14
    if (t.indexOf('山地') >= 0 || t.indexOf('山区') >= 0) return 9;   // 川滇黔 ~9
    if (t.indexOf('草原') >= 0 || t.indexOf('游牧') >= 0) return 4;
    if (t.indexOf('荒漠') >= 0 || t.indexOf('戈壁') >= 0) return 2;
    return 22;
  }

  // 道路质量·按地形给默认值（0-100·驿站维护、商旅运输、军调速度）
  function _defaultRoadQuality(terrain) {
    if (!terrain) return 50;
    var t = String(terrain);
    if (t.indexOf('平原') >= 0) return 60;
    if (t.indexOf('沿海') >= 0) return 55;
    if (t.indexOf('盆地') >= 0) return 48;
    if (t.indexOf('丘陵') >= 0) return 42;
    if (t.indexOf('高原') >= 0) return 30;
    if (t.indexOf('山地') >= 0 || t.indexOf('山区') >= 0) return 22;
    if (t.indexOf('草原') >= 0 || t.indexOf('游牧') >= 0) return 35;
    if (t.indexOf('荒漠') >= 0 || t.indexOf('戈壁') >= 0) return 18;
    return 45;
  }

  function _ensureEconomyBase(div) {
    if (!div) return null;
    // 6 个 boolean tags（剧本可设·default 全 false）
    if (!div.tags) div.tags = {};
    var TAG_KEYS = ['hasPort', 'saltRegion', 'mineralRegion', 'horseRegion', 'fishingRegion', 'imperialDomain'];
    TAG_KEYS.forEach(function(k) {
      if (typeof div.tags[k] !== 'boolean') div.tags[k] = false;
    });
    // economyBase 字段·按 division population 算 default
    if (!div.economyBase) div.economyBase = {};
    var eb = div.economyBase;
    var pd = div.populationDetail || (typeof div.population === 'object' ? div.population : null);
    var mouths = (pd && pd.mouths) || (typeof div.population === 'number' ? div.population : 0);
    var households = (pd && pd.households) || Math.floor(mouths / 5);

    // 原 7 字段（farmland 等）
    // 田亩·按地形给系数·避免一刀切「户×30」对山区/沿海/边疆严重膨胀
    if (typeof eb.farmland !== 'number') eb.farmland = households * _defaultFarmlandPerHH(div.terrain);
    if (typeof eb.commerceCoefficient !== 'number') eb.commerceCoefficient = 1.0;
    if (typeof eb.commerceVolume !== 'number') eb.commerceVolume = Math.round(mouths * 0.05 * eb.commerceCoefficient);
    if (typeof eb.maritimeTradeVolume !== 'number') eb.maritimeTradeVolume = div.tags.hasPort ? Math.round(mouths * 0.02) : 0;
    if (typeof eb.saltProduction !== 'number') eb.saltProduction = div.tags.saltRegion ? Math.round(mouths * 0.5) : 0;
    if (typeof eb.mineralProduction !== 'number') eb.mineralProduction = div.tags.mineralRegion ? Math.round(mouths * 0.1) : 0;
    if (typeof eb.horseProduction !== 'number') eb.horseProduction = div.tags.horseRegion ? Math.round(mouths * 0.001) : 0;
    if (typeof eb.fishingProduction !== 'number') eb.fishingProduction = div.tags.fishingRegion ? Math.round(mouths * 0.05) : 0;
    // ★ 新增 4 字段（C-1）
    if (typeof eb.imperialFarmland !== 'number') eb.imperialFarmland = div.tags.imperialDomain ? Math.round(eb.farmland * 0.05) : 0;
    if (!eb.imperialAssets) eb.imperialAssets = {
      zhizao: div.tags.imperialDomain ? 1 : 0,    // 织造局
      kuangchang: div.tags.mineralRegion && div.tags.imperialDomain ? 1 : 0,  // 矿场
      yuyao: div.tags.imperialDomain ? 0 : 0      // 御窑（仅景德镇等少数地·剧本配）
    };
    if (typeof eb.postRelays !== 'number') eb.postRelays = Math.max(2, Math.floor(households / 50000)); // 每 5 万户一驿
    if (typeof eb.kejuQuota !== 'number') eb.kejuQuota = Math.max(20, Math.floor(mouths / 100000)); // 每 10 万人一名解额
    if (!Array.isArray(eb.disasterRecord)) eb.disasterRecord = []; // 当前进行中的灾害·{type, severity, startTurn}

    // ★ 田亩流转·三态字段（兼并/开垦/清丈）
    if (typeof eb.landsAnnexed !== 'number') eb.landsAnnexed = 0;     // 累计被兼并(豪强吞并)
    if (typeof eb.landsReclaimed !== 'number') eb.landsReclaimed = 0; // 累计开垦量
    if (typeof eb.landsSurveyed !== 'number') eb.landsSurveyed = 0;   // 累计清丈回归量
    // ★ 道路质量（0-100·驿站维护/商旅运输/军调速度）
    if (typeof eb.roadQuality !== 'number') eb.roadQuality = _defaultRoadQuality(div.terrain);

    return eb;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  田亩流转结算·兼并 / 开垦 / 清丈（每回合 _cascadeDivision 前调）
  // ═══════════════════════════════════════════════════════════════════
  function _settleLandFlow(div, ctx) {
    if (!div || !div.economyBase) return null;
    var eb = div.economyBase;
    var turnFrac = (ctx && ctx.turnFracOfYear) || (30 / 365); // ~ 0.082 / 月
    var corruption = (typeof div.corruption === 'number') ? div.corruption : (typeof div.corruptionLocal === 'number' ? div.corruptionLocal : 50);
    var minxin = (typeof div.minxin === 'number') ? div.minxin : (typeof div.minxinLocal === 'number' ? div.minxinLocal : 50);
    var ccArable = (div.carryingCapacity && div.carryingCapacity.arable) || 0;
    var historicalCap = (div.carryingCapacity && div.carryingCapacity.historicalCap) || (ccArable * 1.1);
    var carryingLoad = (div.carryingCapacity && div.carryingCapacity.currentLoad) || 0.85;

    var beforeFarmland = eb.farmland || 0;

    // 1. 兼并·豪强吞并·当 corruption > 50 时按梯度损失
    //    年率 = max(0, (corruption - 50) / 100 × 0.04)·corruption=80 → 1.2%/年·corruption=100 → 2%/年
    var annexAnnualRate = Math.max(0, (corruption - 50) / 100) * 0.04;
    var annexLoss = Math.round(beforeFarmland * annexAnnualRate * turnFrac);
    if (annexLoss > 0) {
      eb.farmland = Math.max(0, eb.farmland - annexLoss);
      eb.landsAnnexed += annexLoss;
    }

    // 2. 开垦·若 currentLoad < 0.7 OR 劝农 政策开启·按梯度增加
    //    incentive = 1.0 默认·若 GM.policies.encourageFarming === true 加 ×2.5
    //    年率 = (1 - currentLoad) × 0.015 × incentive·载率 0.5 → 0.75%/年
    //    上限·新 farmland 不超过 historicalCap 或 ccArable × 1.2
    var encourageFarming = (typeof GM !== 'undefined' && GM && GM.policies && GM.policies.encourageFarming) ? true : false;
    var incentive = encourageFarming ? 2.5 : 1.0;
    var loadFactor = Math.max(0, 1 - carryingLoad);
    var reclaimAnnualRate = loadFactor * 0.015 * incentive;
    var reclaimGain = Math.round(beforeFarmland * reclaimAnnualRate * turnFrac);
    var farmlandCap = Math.max(historicalCap, ccArable * 1.2);
    if (reclaimGain > 0 && eb.farmland + reclaimGain <= farmlandCap) {
      eb.farmland += reclaimGain;
      eb.landsReclaimed += reclaimGain;
    } else if (reclaimGain > 0 && eb.farmland < farmlandCap) {
      var capGain = Math.max(0, farmlandCap - eb.farmland);
      eb.farmland += capGain;
      eb.landsReclaimed += capGain;
      reclaimGain = capGain;
    } else {
      reclaimGain = 0;
    }

    // 3. 清丈·诏令触发·div._surveyTrigger 标记·从 landsAnnexed 回归 farmland
    //    回归比例 = 30%~60%·按 minxin 越高吏治越清明回得越多·minxin=50 → 45%
    var surveyRestore = 0;
    if (div._surveyTrigger && eb.landsAnnexed > 0) {
      var restorePct = 0.30 + (Math.max(0, minxin) / 100) * 0.30; // 30%-60%
      surveyRestore = Math.round(eb.landsAnnexed * restorePct);
      eb.farmland += surveyRestore;
      eb.landsAnnexed = Math.max(0, eb.landsAnnexed - surveyRestore);
      eb.landsSurveyed += surveyRestore;
      delete div._surveyTrigger; // 单次触发·下回合需再设
    }

    // 记录本回合流转·供 UI 显示
    div._thisTurnLandFlow = {
      annexed: annexLoss,
      reclaimed: reclaimGain,
      surveyed: surveyRestore,
      net: -annexLoss + reclaimGain + surveyRestore,
      before: beforeFarmland,
      after: eb.farmland
    };

    return div._thisTurnLandFlow;
  }

  function _ensureCharWealth(ch) {
    if (!ch.resources) ch.resources = {};
    if (!ch.resources.privateWealth) ch.resources.privateWealth = {};
    var w = ch.resources.privateWealth;
    // 兼容老字段 cash → money
    if (w.money === undefined && w.cash !== undefined) w.money = w.cash;
    if (w.money === undefined) w.money = 0;
    if (w.grain === undefined) w.grain = 0;
    if (w.cloth === undefined) w.cloth = 0;
    if (w.land === undefined) w.land = 0;
    if (w.treasure === undefined) w.treasure = 0;
    if (w.slaves === undefined) w.slaves = 0;
    if (w.commerce === undefined) w.commerce = 0;
    return w;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  计算单税种 amount
  // ═══════════════════════════════════════════════════════════════════

  function _taxBase(div, tax) {
    // 兼容三种形态：populationDetail 对象（剧本 buildAdminHierarchy）/population 对象/population 数字
    var pd = div.populationDetail;
    var popNum = (typeof div.population === 'number') ? div.population : 0;
    var pop;
    if (pd && typeof pd === 'object' && (pd.mouths || pd.households)) {
      pop = pd; // 优先用 populationDetail
    } else if (div.population && typeof div.population === 'object') {
      pop = div.population;
    } else {
      pop = { mouths: popNum };
    }
    var effectiveMouths = pop.mouths || popNum || 0;
    if (tax.base === 'arableLand') {
      // 优先 economyBase.farmland（剧本主字段·真实田亩）→ environment.arableLand → carryingCapacity.arable
      var arable = (div.economyBase && div.economyBase.farmland)
                 || (div.environment && div.environment.arableLand)
                 || (div.carryingCapacity && div.carryingCapacity.arable)
                 || 0;
      if (arable <= 0 && tax.baseFallback === 'mouths') arable = effectiveMouths * 0.3;
      return arable;
    }
    if (tax.base === 'mouths') return effectiveMouths;
    if (tax.base === 'ding')   return pop.ding   || Math.floor(effectiveMouths * 0.25);
    if (tax.base === 'households') return pop.households || Math.floor(effectiveMouths / 5);
    if (tax.base === 'prosperity') return (div.prosperity || 50);
    if (tax.base === 'commerceVolume') {
      // 商税以经济基础.商业体量为准·缺则用 prosperity * 10000 兜底
      return (div.economyBase && div.economyBase.commerceVolume)
          || (div.prosperity || 50) * 10000;
    }
    return 0;
  }

  function _computeTaxAmount(div, tax, ctx) {
    var base = _taxBase(div, tax);
    if (base <= 0) return 0;
    var factor = tax.baseFactor || 1;
    var rate = tax.rate || 0;
    var amount = base * factor * rate;
    // 按"回合天数/年"缩放。若剧本一回合=30天，则 annual 税额 × (30/365)
    if (tax.annual && ctx && ctx.turnFracOfYear) amount *= ctx.turnFracOfYear;

    // 损耗乘子
    var corrPenalty = Math.min(0.5, ((div.corruption || 0) / 100) * 0.4);
    var disasterPenalty = 0;
    if (div.environment && div.environment.currentLoad > 0.9) disasterPenalty = 0.2;
    if (div.environment && div.environment.ecoScars && Object.keys(div.environment.ecoScars).length > 0) disasterPenalty += 0.1;
    disasterPenalty = Math.min(0.5, disasterPenalty);

    var exemption = 0;
    if (div.regionType === 'jimi' || div.regionType === 'tusi' || div.regionType === 'fanbang') exemption = 0.7;  // 羁縻/土司/藩属 基本免赋
    if (div.regionType === 'imperial_clan') exemption = 0.5;

    var disruption = 0;
    if (div._warZone) disruption = 0.3;
    if (div._revoltActive) disruption = Math.max(disruption, 0.5);

    var autonomy = Math.max(0, Math.min(1, (div.fiscal && div.fiscal.autonomyLevel) || 0));
    var retentionRate = 0.8;

    amount = amount
      * (1 - corrPenalty)
      * (1 - disasterPenalty)
      * (1 - exemption)
      * (1 - disruption)
      * (1 - autonomy * retentionRate);

    return Math.max(0, Math.round(amount));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  分账（qiyun / cunliu / compliance / 路途损耗 / skimmed）
  // ═══════════════════════════════════════════════════════════════════

  function _splitAmount(div, taxId, amount, ctx) {
    var rules = (ctx.centralLocalRules && ctx.centralLocalRules.perTax) || DEFAULT_ALLOCATION.perTax;
    var cfg = rules[taxId] || DEFAULT_ALLOCATION.defaultPerTax;
    var qiyunRatio = cfg.qiyun != null ? cfg.qiyun : 0.7;
    var cunliuRatio = cfg.cunliu != null ? cfg.cunliu : 1 - qiyunRatio;

    var compliance = (div.fiscal && div.fiscal.compliance != null) ? div.fiscal.compliance : 0.85;

    var qiyunGross = amount * qiyunRatio;
    var cunliuAmount = amount * cunliuRatio;

    // compliance 再扣（地方不足额上交）
    var qiyunNet = qiyunGross * compliance;
    var skimmedByLocal = qiyunGross - qiyunNet;   // 地方吞

    // 路途损耗
    var logisticsLoss = (ctx.logisticsLoss != null) ? ctx.logisticsLoss : DEFAULT_LOGISTICS_LOSS;
    var lostInTransit = qiyunNet * logisticsLoss;
    var toCentral = qiyunNet - lostInTransit;

    return {
      toCentral: Math.max(0, Math.round(toCentral)),
      cunliu:    Math.max(0, Math.round(cunliuAmount)),
      skimmed:   Math.max(0, Math.round(skimmedByLocal)),
      lostInTransit: Math.max(0, Math.round(lostInTransit))
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  主入口：遍历所有顶级 division 执行一回合级联征收
  // ═══════════════════════════════════════════════════════════════════

  function collect(opts) {
    var G = global.GM;
    if (!G || !G.adminHierarchy) return { ok: false, reason: 'no adminHierarchy' };
    opts = opts || {};

    // 读剧本配置
    var sc = (typeof global.findScenarioById === 'function' && G.sid)
      ? global.findScenarioById(G.sid)
      : null;
    var fc = (sc && sc.fiscalConfig) || (global.P && global.P.fiscalConfig) || {};
    var taxes = (fc.taxes && fc.taxes.length > 0) ? fc.taxes.slice() : DEFAULT_TAXES.slice();
    var centralLocalRules = (fc.centralLocalRules) || DEFAULT_ALLOCATION;

    // ★ 接入 fc.customTaxes·把 perMu/flat 类型转换成 cascade 内部格式·让辽饷/茶马司/钞关 等真正参与级联
    if (Array.isArray(fc.customTaxes) && fc.customTaxes.length > 0) {
      fc.customTaxes.forEach(function(ct) {
        if (!ct || !ct.id || !ct.formulaType) return;
        var converted = null;
        if (ct.formulaType === 'perMu' && typeof ct.rate === 'number' && ct.rate > 0) {
          // 每亩 N 厘 → base=arableLand · rate=ct.rate · baseFactor=1
          converted = {
            id: ct.id, name: ct.name || ct.id,
            base: 'arableLand', baseFallback: 'mouths',
            baseFactor: 1, rate: ct.rate,
            storeAs: ct.storeAs || 'money',
            sourceTag: ct.sourceTag || ct.id,
            annual: true,
            description: ct.description || ''
          };
        } else if (ct.formulaType === 'flat' && typeof ct.amount === 'number' && ct.amount > 0) {
          // 全国定额·按 division 数均分(简化处理·实际可按贡献度)·每个 division 摊一份
          // 这里采用 baseFactor 方式：以 mouths 为 base·rate 反算让总额接近 ct.amount
          // 简化：直接按 division 数均分·所以用 mouths 为 base·rate 取使全国累计 ≈ amount
          converted = {
            id: ct.id, name: ct.name || ct.id,
            base: 'mouths', baseFallback: null,
            baseFactor: 1,
            rate: ct.amount / Math.max(50000000, _estimateNationalMouths(G)),  // 大约 2 亿口·按比例分摊
            storeAs: ct.storeAs || 'money',
            sourceTag: ct.sourceTag || ct.id,
            annual: true,
            description: ct.description || ''
          };
        } else if (ct.formulaType === 'perDing' && typeof ct.rate === 'number') {
          converted = {
            id: ct.id, name: ct.name || ct.id,
            base: 'ding', baseFallback: 'mouths',
            baseFactor: 1, rate: ct.rate,
            storeAs: ct.storeAs || 'money',
            sourceTag: ct.sourceTag || ct.id,
            annual: true,
            description: ct.description || ''
          };
        }
        if (converted) taxes.push(converted);
      });
    }

    // 确保 GM.guoku.ledgers 三账存在
    if (!G.guoku) G.guoku = {};
    if (!G.guoku.ledgers) G.guoku.ledgers = {};
    var gkMoney = _ensureLedger(G.guoku.ledgers, 'money', G.guoku.money || G.guoku.balance || 0);
    var gkGrain = _ensureLedger(G.guoku.ledgers, 'grain', G.guoku.grain || 0);
    var gkCloth = _ensureLedger(G.guoku.ledgers, 'cloth', G.guoku.cloth || 0);

    // ★ 关键修复·每回合开始重置 thisTurn 计数·避免跨回合累加(BUG 之前 thisTurnIn 永远叠加)
    // sources/sinks 也清空·让 cascade + FixedExpense + monthlySettle 的本回合写入正确累加
    [gkMoney, gkGrain, gkCloth].forEach(function(led) {
      led.lastTurnIn = led.thisTurnIn || 0;
      led.lastTurnOut = led.thisTurnOut || 0;
      led.thisTurnIn = 0;
      led.thisTurnOut = 0;
      led.sources = {};
      led.sinks = {};
    });

    // ★ 子系统旁路写入 reconciliation·若 G.guoku.{money,grain,cloth,balance} 标量上回合被
    // 其他子系统(tm-authority/tm-audit/tm-class-mobility/tm-ethnic-religion/tm-huji-deep-fill/
    // tm-corruption-engine/tm-corruption-p2/tm-corruption-p4/tm-char-economy-engine)
    // 直接修改而未走 ledger·此处吸收 diff 入本回合 thisTurnIn/Out 的『外部调整』槽位·
    // 避免下面 G.guoku.money = gkMoney.stock 行覆盖时 scalar 的修改丢失
    // 注·money 与 balance 是别名(双字段)·取偏离 ledger.stock 较大的那个作为真值·避免重复计入
    function _reconScalar(led, scalarVal, balanceVal) {
      var stock = led.stock || 0;
      var moneyDiff = (scalarVal != null) ? scalarVal - stock : 0;
      var balDiff = (balanceVal != null) ? balanceVal - stock : 0;
      var diff = Math.abs(moneyDiff) >= Math.abs(balDiff) ? moneyDiff : balDiff;
      if (Math.abs(diff) < 0.5) return;
      led.stock = stock + diff;
      if (diff < 0) {
        led.sinks['外部调整'] = (led.sinks['外部调整'] || 0) + (-diff);
        led.thisTurnOut = (led.thisTurnOut || 0) + (-diff);
      } else {
        led.sources['外部调整'] = (led.sources['外部调整'] || 0) + diff;
        led.thisTurnIn = (led.thisTurnIn || 0) + diff;
      }
    }
    _reconScalar(gkMoney, G.guoku.money, G.guoku.balance);
    _reconScalar(gkGrain, G.guoku.grain, null);
    _reconScalar(gkCloth, G.guoku.cloth, null);

    // 本回合累计（存给后续 aggregate 用）
    var totals = {
      central: { money: 0, grain: 0, cloth: 0 },
      localRetain: { money: 0, grain: 0, cloth: 0 },
      skimmed: { money: 0, grain: 0, cloth: 0 },
      lostTransit: { money: 0, grain: 0, cloth: 0 },
      divisionCount: 0
    };

    // 计算本回合相对于"年"的比例（支持不同剧本 per-turn-days）
    var turnDays = (sc && sc.turnDays) || (sc && sc.daysPerTurn) || (fc.daysPerTurn) || 30;  // 默认一回合=30天
    if (typeof global._getDaysPerTurn === 'function') {
      try { var gd = global._getDaysPerTurn(); if (gd) turnDays = gd; } catch(_e){}
    }
    var turnFracOfYear = Math.max(0.01, Math.min(1, turnDays / 365));

    var ctx = {
      centralLocalRules: centralLocalRules,
      logisticsLoss: fc.logisticsLoss != null ? fc.logisticsLoss : DEFAULT_LOGISTICS_LOSS,
      turnDays: turnDays,
      turnFracOfYear: turnFracOfYear
    };

    // 遍历所有势力的所有叶子 divisions（父节点数据由 bridge._reconcileParentToChildren 从子之和算）
    function _walkAndCascade(nodes) {
      (nodes || []).forEach(function(div) {
        if (!div) return;
        var isLeaf = !div.children || div.children.length === 0;
        if (isLeaf) {
          _cascadeDivision(div, taxes, ctx, gkMoney, gkGrain, gkCloth, totals, G);
        } else {
          _walkAndCascade(div.children);
        }
      });
    }
    Object.keys(G.adminHierarchy).forEach(function(fkey) {
      var tree = G.adminHierarchy[fkey];
      _walkAndCascade((tree && tree.divisions) || []);
    });

    // 同步标量字段（兼容老代码读 GM.guoku.money）
    G.guoku.money = gkMoney.stock;
    G.guoku.grain = gkGrain.stock;
    G.guoku.cloth = gkCloth.stock;
    G.guoku.balance = gkMoney.stock;
    // 调试日志：让玩家在 console 确认 turnDays 真按当前回合天数缩放
    if (typeof console !== 'undefined' && console.log) {
      try {
        console.log('[CascadeTax] turn=' + (G.turn||0) + ' turnDays=' + turnDays + ' turnFracOfYear=' + turnFracOfYear.toFixed(3) + ' 上解中央 钱=' + Math.round(totals.central.money) + ' 粮=' + Math.round(totals.central.grain));
      } catch(_lE) {}
    }
    // 本回合变化（而非"月入"——每个剧本回合天数不同）
    G.guoku.turnIncome = totals.central.money;
    G.guoku.turnGrainIncome = totals.central.grain;
    G.guoku.turnClothIncome = totals.central.cloth;
    G.guoku.turnDays = turnDays;
    // 兼容老字段（若一回合 30 天则"月入"="本回合收入"）
    G.guoku.monthlyIncome = Math.round(totals.central.money * (30 / Math.max(1, turnDays)));
    G.guoku.monthlyGrainIncome = Math.round(totals.central.grain * (30 / Math.max(1, turnDays)));
    G.guoku.monthlyClothIncome = Math.round(totals.central.cloth * (30 / Math.max(1, turnDays)));
    // 年入（按本回合年化推算）
    G.guoku.annualIncome = turnFracOfYear > 0 ? Math.round(totals.central.money / turnFracOfYear) : 0;

    // 兼容老 panel 的 g.sources —— 累加三账的 sources 映射到统一科目
    if (!G.guoku.sources) G.guoku.sources = {};
    var tagToLegacy = {
      tianfu:'tianfu', dingshui:'dingshui', yongBu:'qita', shangShui:'shipaiShui', yanlizhuan:'yanlizhuan'
    };
    ['money','grain','cloth'].forEach(function(k){
      var led = G.guoku.ledgers && G.guoku.ledgers[k];
      if (!led || !led.sources) return;
      Object.keys(led.sources).forEach(function(tag){
        var legKey = tagToLegacy[tag] || tag;
        G.guoku.sources[legKey] = (G.guoku.sources[legKey]||0) + led.sources[tag];
      });
    });

    G._lastCascadeSummary = totals;
    G._lastCascadeTurn = G.turn || 0;  // 记录结算回合（给 UI 显示"上次结算于 Tn"）
    // 全局 top-contributors map·UI/帑廪面板可读·结构：{tianfu:{北直隶:88万,...}, yanke:{...}, ...}
    if (totals.contribByCategory) {
      G.guoku._sourceContributors = totals.contribByCategory;
    }

    // ★ cascade 细分推入 GM.turnChanges.variables·让史记『财政』组自动渲染上解中央/地方留存/被贪/路耗
    // 之前这些细分只在 G._lastCascadeSummary 临时对象·tm-endturn-render 反向查·结构松散
    if (G.turnChanges && Array.isArray(G.turnChanges.variables)) {
      var _push = function(name, val, reason) {
        if (val == null || val === 0) return;
        G.turnChanges.variables.push({
          name: name, oldValue: 0, newValue: Math.round(val), delta: Math.round(val),
          reasons: [{ type: 'cascade', amount: Math.round(val), desc: reason }]
        });
      };
      _push('上解中央·钱', totals.central.money, '本回合各区上解中央钱');
      _push('上解中央·粮', totals.central.grain, '本回合各区上解中央粮');
      _push('上解中央·布', totals.central.cloth, '本回合各区上解中央布');
      _push('地方留存·钱', totals.localRetain.money, '州县留存日常用度');
      _push('地方留存·粮', totals.localRetain.grain, '州县留存粮储');
      _push('胥吏私分', totals.skimmed.money, '腐败漏损·州县官吏挪用');
      _push('路途损耗·钱', totals.lostTransit.money, '漕运/陆运损耗');
      _push('路途损耗·粮', totals.lostTransit.grain, '漕运损耗·明季 25-30%');
    }

    return { ok: true, totals: totals };
  }

  /** 取某税种的 top N 贡献区·返回 [{name, amount, pct}] */
  function getTopContributors(category, topN) {
    var G = global.GM;
    if (!G || !G.guoku || !G.guoku._sourceContributors) return [];
    var map = G.guoku._sourceContributors[category] || {};
    var rows = Object.keys(map).map(function(k){ return { name: k, amount: map[k] || 0 }; });
    rows.sort(function(a, b){ return b.amount - a.amount; });
    var total = rows.reduce(function(s, r){ return s + r.amount; }, 0);
    rows.forEach(function(r){ r.pct = total > 0 ? (r.amount / total * 100) : 0; });
    return rows.slice(0, topN || 5);
  }

  /** 触发清丈·设标记后下次 _settleLandFlow 会执行回归（玩家诏令调） */
  function triggerSurvey(divIdOrName) {
    var G = global.GM;
    if (!G || !G.adminHierarchy) return false;
    var found = null;
    Object.keys(G.adminHierarchy).forEach(function(fk) {
      if (found) return;
      var tree = G.adminHierarchy[fk];
      function walk(divs) {
        if (!Array.isArray(divs) || found) return;
        for (var i = 0; i < divs.length; i++) {
          var d = divs[i]; if (!d) continue;
          if (d.id === divIdOrName || d.name === divIdOrName) { found = d; return; }
          if (d.children) walk(d.children);
          if (d.divisions) walk(d.divisions);
        }
      }
      walk((tree && tree.divisions) || []);
    });
    if (!found) return false;
    found._surveyTrigger = true;
    return true;
  }

  function _cascadeDivision(div, taxes, ctx, gkMoney, gkGrain, gkCloth, totals, G) {
    if (!div) return;
    _ensureRegionFiscal(div);
    _ensureRegionPubTreasury(div);
    _ensureEconomyBase(div);
    totals.divisionCount++;

    // ★ per-division ledger 也在每回合开始重置 thisTurnIn / thisTurnOut（之前永远累加 BUG）
    if (div.fiscal && div.fiscal.ledgers) {
      ['money', 'grain', 'cloth'].forEach(function(k) {
        var rfLed = div.fiscal.ledgers[k];
        if (rfLed) {
          rfLed.lastTurnIn = rfLed.thisTurnIn || 0;
          rfLed.lastTurnOut = rfLed.thisTurnOut || 0;
          rfLed.thisTurnIn = 0;
          rfLed.thisTurnOut = 0;
        }
      });
    }

    // 上回合 fiscal 快照·供 UI 显示「本回合 vs 上回合」delta
    if (div.fiscal && (div.fiscal.claimedRevenue || div.fiscal.actualRevenue)) {
      div._lastTurnFiscal = {
        claimedRevenue: div.fiscal.claimedRevenue || 0,
        actualRevenue: div.fiscal.actualRevenue || 0,
        remittedToCenter: div.fiscal.remittedToCenter || 0,
        retainedBudget: div.fiscal.retainedBudget || 0,
        farmland: (div._lastTurnFiscal && div._lastTurnFiscal.farmland) || (div.economyBase && div.economyBase.farmland) || 0
      };
    }

    // 田亩流转结算·兼并/开垦/清丈（在税收前结算·当回合税基为流转后）
    _settleLandFlow(div, ctx);

    var divClaimedTotal = 0;
    var divActualTotal = 0;
    var divRemitTotal = 0;
    var divContribByCategory = {};  // 本回合各税种对中央的贡献

    // 找主官（用于 skimmed 挪用）
    var govName = div.governor || div.currentHead || null;
    var govChar = null;
    if (govName && Array.isArray(G.chars)) govChar = G.chars.find(function(c){return c.name === govName;});

    taxes.forEach(function(tax) {
      var amount = _computeTaxAmount(div, tax, ctx);
      if (amount <= 0) return;

      divClaimedTotal += amount;  // 名义征收（未经损耗）

      var storeAs = tax.storeAs || 'money';
      var split = _splitAmount(div, tax.id, amount, ctx);
      divActualTotal += split.toCentral + split.cunliu;  // 合计实际到账
      divRemitTotal += split.toCentral;

      // 1) 中央帑廪
      var gkLed = (storeAs === 'grain') ? gkGrain : (storeAs === 'cloth') ? gkCloth : gkMoney;
      _addToLedger(gkLed, split.toCentral, tax.sourceTag || tax.id);
      totals.central[storeAs] += split.toCentral;
      totals.lostTransit[storeAs] += split.lostInTransit;

      // 1a) 记录此 division 对该税种的贡献（供 UI top-contributors 展示·中央=Σ(地方)的来源透明）
      var catKey = tax.sourceTag || tax.id;
      divContribByCategory[catKey] = (divContribByCategory[catKey] || 0) + split.toCentral;
      // 全局聚合·为 GuokuEngine.sourcesContributors 提供按税种 → 区划 → 金额 的 map
      if (!totals.contribByCategory) totals.contribByCategory = {};
      if (!totals.contribByCategory[catKey]) totals.contribByCategory[catKey] = {};
      var divName = div.name || div.id || 'unknown';
      totals.contribByCategory[catKey][divName] = (totals.contribByCategory[catKey][divName] || 0) + split.toCentral;

      // 2) 地方留存 → 区划 fiscal ledgers + publicTreasury
      if (div.fiscal.ledgers && div.fiscal.ledgers[storeAs]) {
        var rfLed = div.fiscal.ledgers[storeAs];
        rfLed.stock = (rfLed.stock || 0) + split.cunliu;
        rfLed.thisTurnIn = (rfLed.thisTurnIn || 0) + split.cunliu;
      }
      if (div.publicTreasury && div.publicTreasury[storeAs]) {
        div.publicTreasury[storeAs].stock = (div.publicTreasury[storeAs].stock || 0) + split.cunliu;
        div.publicTreasury[storeAs].available = (div.publicTreasury[storeAs].available || 0) + split.cunliu;
      }
      totals.localRetain[storeAs] += split.cunliu;

      // 3) 贪官污吏挪用（skimmed）—— 按税种形态挪到主官私产
      if (govChar && split.skimmed > 0) {
        var w = _ensureCharWealth(govChar);
        var kShare = 0.5;  // 挪用的一半入主官私产，另一半"消失"（幕僚/胥吏瓜分等）
        var hit = Math.round(split.skimmed * kShare);
        if (storeAs === 'money') w.money = (w.money||0) + hit;
        else if (storeAs === 'grain') w.grain = (w.grain||0) + hit;
        else if (storeAs === 'cloth') w.cloth = (w.cloth||0) + hit;
      }
      totals.skimmed[storeAs] += split.skimmed;
    });

    // 累计到 division.fiscal（供 bridge aggregate 和 AI 观测）
    div.fiscal.claimedRevenue = divClaimedTotal;
    div.fiscal.actualRevenue = divActualTotal;
    div.fiscal.remittedToCenter = divRemitTotal;
    div.fiscal._thisTurnRemitMoney = divRemitTotal;  // bridge 可以用
    div.fiscal.contributionsByCategory = divContribByCategory; // 各税种对中央贡献
  }

  // ═══════════════════════════════════════════════════════════════════
  //  端点导出
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    try { collect(ctx); } catch (e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'CascadeTax.tick') : console.error('[CascadeTax.tick]', e); }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  全国汇总·遍历 adminHierarchy 求和指定 economyBase 字段
  //  field ∈ farmland/commerceVolume/maritimeTradeVolume/saltProduction/
  //         mineralProduction/horseProduction/fishingProduction
  // ═══════════════════════════════════════════════════════════════════
  function sumEconomyBase(field, opts) {
    opts = opts || {};
    var G = global.GM;
    if (!G || !G.adminHierarchy) return 0;
    var factionFilter = opts.faction || null;  // 仅限某 faction 求和
    var requireTag = opts.requireTag || null;  // 仅含某 tag=true 的 division
    var total = 0;
    Object.keys(G.adminHierarchy).forEach(function(fk) {
      if (factionFilter && fk !== factionFilter) return;
      var tree = G.adminHierarchy[fk];
      function walk(divs) {
        if (!Array.isArray(divs)) return;
        divs.forEach(function(d) {
          if (!d) return;
          // 兜底·若无 economyBase 现场 ensure
          if (!d.economyBase) _ensureEconomyBase(d);
          var v = (d.economyBase && d.economyBase[field]) || 0;
          if (requireTag && (!d.tags || !d.tags[requireTag])) v = 0;
          // 受灾削减·若该 division 有 disasterImpact 临时减成
          var diReduce = (d._disasterEconomyReduce && d._disasterEconomyReduce[field]) || 0;
          if (diReduce > 0) v *= Math.max(0, 1 - diReduce);
          total += v;
          if (d.children) walk(d.children);
          if (d.divisions) walk(d.divisions);
        });
      }
      walk((tree && tree.divisions) || []);
    });
    return total;
  }

  /** 单 division 取 economyBase 字段（兜底 ensure） */
  function getDivEconomy(divId, field) {
    var G = global.GM;
    if (!G || !G.adminHierarchy) return 0;
    var found = null;
    Object.keys(G.adminHierarchy).forEach(function(fk) {
      if (found) return;
      var tree = G.adminHierarchy[fk];
      function walk(divs) {
        if (!Array.isArray(divs) || found) return;
        for (var i = 0; i < divs.length; i++) {
          var d = divs[i];
          if (!d) continue;
          if (d.id === divId || d.name === divId) { found = d; return; }
          if (d.children) walk(d.children);
          if (d.divisions) walk(d.divisions);
        }
      }
      walk((tree && tree.divisions) || []);
    });
    if (!found) return 0;
    if (!found.economyBase) _ensureEconomyBase(found);
    return (found.economyBase && found.economyBase[field]) || 0;
  }

  global.CascadeTax = {
    collect: collect,
    tick: tick,
    _ensureEconomyBase: _ensureEconomyBase,
    _settleLandFlow: _settleLandFlow,
    sumEconomyBase: sumEconomyBase,
    getDivEconomy: getDivEconomy,
    getTopContributors: getTopContributors,
    triggerSurvey: triggerSurvey,
    DEFAULT_TAXES: DEFAULT_TAXES,
    DEFAULT_ALLOCATION: DEFAULT_ALLOCATION,
    VERSION: 2
  };

  // 同时挂到 TM.Economy 命名空间（如有）
  if (global.TM) {
    global.TM.Economy = global.TM.Economy || {};
    global.TM.Economy.sum = sumEconomyBase;
    global.TM.Economy.getDiv = getDivEconomy;
    global.TM.Economy.topContributors = getTopContributors;
    global.TM.Economy.triggerSurvey = triggerSurvey;
  }

})(typeof window !== 'undefined' ? window : this);
