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
      baseFactor: 0.3,     rate: 0.04,            // 亩产 * 30% * 4% ≈ 0.012 石/亩·年
      storeAs: 'grain',    sourceTag: 'tianfu',
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
      base: 'prosperity',  baseFallback: null,
      baseFactor: 10,      rate: 0.03,            // 繁荣 *10 两 * 3%（省级每年约几千两）
      storeAs: 'money',    sourceTag: 'shangShui',
      annual: true
    },
    {
      id: 'salt_iron',     name: '盐铁专卖',
      base: 'mouths',      baseFallback: null,
      baseFactor: 0.05,    rate: 0.8,             // 人均盐铁税约 0.04 两/年
      storeAs: 'money',    sourceTag: 'yanlizhuan',
      annual: true
    }
  ];

  // 默认分账模式（每税种 qiyun/cunliu 比例）—— 可被 sc.fiscalConfig.centralLocalRules 覆盖
  var DEFAULT_ALLOCATION = {
    mode: 'qiyun_cunliu',
    perTax: {
      'land_grain':   { qiyun: 0.6,  cunliu: 0.4 },
      'head_tax':     { qiyun: 0.8,  cunliu: 0.2 },
      'corvee_cloth': { qiyun: 0.5,  cunliu: 0.5 },
      'commerce':     { qiyun: 0.5,  cunliu: 0.5 },
      'salt_iron':    { qiyun: 0.9,  cunliu: 0.1 }
    },
    defaultPerTax:    { qiyun: 0.7,  cunliu: 0.3 }
  };

  var DEFAULT_LOGISTICS_LOSS = 0.15;   // 路途损耗 15%

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

  function _ensureCharWealth(ch) {
    if (!ch.resources) ch.resources = {};
    if (!ch.resources.privateWealth) ch.resources.privateWealth = {};
    var w = ch.resources.privateWealth;
    // 兼容老字段 cash
    if (w.cash === undefined && w.money !== undefined) w.cash = w.money;
    if (w.cash === undefined) w.cash = 0;
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
    // 兼容：div.population 可能是对象（新）或数字（老/AI 生成）
    var popNum = (typeof div.population === 'number') ? div.population : 0;
    var pop = (div.population && typeof div.population === 'object') ? div.population : { mouths: popNum };
    var effectiveMouths = pop.mouths || popNum || 0;
    if (tax.base === 'arableLand') {
      var arable = (div.environment && div.environment.arableLand) || 0;
      if (arable <= 0 && tax.baseFallback === 'mouths') arable = effectiveMouths * 0.3;
      return arable;
    }
    if (tax.base === 'mouths') return effectiveMouths;
    if (tax.base === 'ding')   return pop.ding   || Math.floor(effectiveMouths * 0.25);
    if (tax.base === 'households') return pop.households || Math.floor(effectiveMouths / 5);
    if (tax.base === 'prosperity') return (div.prosperity || 50);
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
    var taxes = (fc.taxes && fc.taxes.length > 0) ? fc.taxes : DEFAULT_TAXES;
    var centralLocalRules = (fc.centralLocalRules) || DEFAULT_ALLOCATION;

    // 确保 GM.guoku.ledgers 三账存在
    if (!G.guoku) G.guoku = {};
    if (!G.guoku.ledgers) G.guoku.ledgers = {};
    var gkMoney = _ensureLedger(G.guoku.ledgers, 'money', G.guoku.money || G.guoku.balance || 0);
    var gkGrain = _ensureLedger(G.guoku.ledgers, 'grain', G.guoku.grain || 0);
    var gkCloth = _ensureLedger(G.guoku.ledgers, 'cloth', G.guoku.cloth || 0);

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
    return { ok: true, totals: totals };
  }

  function _cascadeDivision(div, taxes, ctx, gkMoney, gkGrain, gkCloth, totals, G) {
    if (!div) return;
    _ensureRegionFiscal(div);
    _ensureRegionPubTreasury(div);
    totals.divisionCount++;

    var divClaimedTotal = 0;
    var divActualTotal = 0;
    var divRemitTotal = 0;

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
        if (storeAs === 'money') w.cash = (w.cash||0) + hit;
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
  }

  // ═══════════════════════════════════════════════════════════════════
  //  端点导出
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    try { collect(ctx); } catch (e) { console.error('[CascadeTax.tick]', e); }
  }

  global.CascadeTax = {
    collect: collect,
    tick: tick,
    DEFAULT_TAXES: DEFAULT_TAXES,
    DEFAULT_ALLOCATION: DEFAULT_ALLOCATION,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : this);
