// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-economy-engine.js — 经济引擎集合 (Phase 3 F7·2026-05-03·5 文件合 + R10b/c·2026-05-04·吸 §B/§C 纸币+粮价 + R10 fiscal compat·EconomyCore 暴露 formulaEstimateWealth)
 *
 * Status: active · Last Updated: 2026-05-04 (Phase 3 R10b/R10c·吸 tm-tax-atomic §B/§C + Codex R10 fiscal compat)
 *
 * 6 → 1 (其中 tm-economy.js 留独立·因 top-level functions 非 IIFE wrap·不混)
 *
 * 包含 5 IIFE 块·按 dep 顺序 load·variables 各 IIFE 内 isolated·
 *   §A·CurrencyUnit (utility·no deps·原 tm-currency-unit.js·~129 行)
 *   §B·CurrencyEngine (原 tm-currency-engine.js·~790 行·8 大决策·6 币种/本位/铸币/纸币/市场/海外/改革/地域差)
 *        + R10b·吸 PAPER_DATA_25 + _updatePaperStateAtomic + _checkPaperCollapseAtomic (原 tm-tax-atomic §B)
 *        + R10c·吸 _updateGrainPriceAtomic (原 tm-tax-atomic §C·市场供需粮价)
 *   §C·EnvCapacityEngine (原 tm-env-capacity-engine.js·~574 行·8 决策·5 维承载力/9 类疤痕/危机/恢复/技术/政策)
 *   §D·EconomyLinkage (原 tm-economy-linkage.js·~464 行·四子系统联动·剥夺/区域树/分账/下拨/俸禄/贪腐/抄家/事件总线)
 *   §E·EconomyGapFill (原 tm-economy-gap-fill.js·~839 行·12 项补完·购买力/19 税/地域币值/套利/递归/封建/虚报/兼并/借贷/口碑/廷议/强征)
 *        + Codex R10 fiscal compat·formulaEstimateWealth (原 tm-tax-atomic §J·暴露为 global.EconomyCore namespace)
 *
 * 总·~2880 行·5 separate IIFE 块·原 5 file 已 delete + tm-tax-atomic §B/§C/§J 已并入·
 *
 * tm-economy.js (749 行 top-level functions) 不入此 file·留独立 (因为非 IIFE wrap)·
 *
 * 对外 globals (各 IIFE 块 export)·
 *   §A·CurrencyUnit.fmt() / etc.
 *   §B·CurrencyEngine.init / tick / getInflationText / getAIContext / applyReform / issuePaper / abolishPaper / debaseCoin
 *        + PAPER_DATA_25·_updatePaperStateAtomic·_checkPaperCollapseAtomic·_updateGrainPriceAtomic (R10b/c·var-drawers L1204 引用 PAPER_DATA_25)
 *   §C·EnvCapacityEngine.* (5 决策接口)
 *   §D·(linkage 内部 hooks·event-bus 注册)·**createTransferOrder(spec)** (object 签名·与 FiscalEngine.createTransferOrder(from,toRegion,amount) 不冲)
 *   §E·EconomyGapFill·* (12 项补完入口) + global.EconomyCore.formulaEstimateWealth (Codex R10·原 §J)
 *
 * Used by: tm-game-loop·tm-endturn-systems·tm-var-drawers·tm-fiscal-engine (经济基础读取)·smoke-engine-phase0·smoke-influence-groups
 * Test: verify-all 35/35·influence-groups (91 assertions)·class-engine (78)·smoke-engine-phase0 (21)
 */

// ───────────────────────────────────────────
// §A·CurrencyUnit (from tm-currency-unit.js)
// ───────────────────────────────────────────
(function(global) {
  'use strict';

  // ── 朝代默认单位 ──
  var DYNASTY_DEFAULT_UNITS = {
    // 朝代名（匹配 scriptData.dynasty 或 sc.dynasty 子串）
    '秦':    { money:'钱',  grain:'石', cloth:'匹', silverToCoin: 0     }, // 无银本位
    '汉':    { money:'钱',  grain:'石', cloth:'匹', silverToCoin: 0     },
    '魏':    { money:'钱',  grain:'石', cloth:'匹', silverToCoin: 0     },
    '晋':    { money:'钱',  grain:'石', cloth:'匹', silverToCoin: 0     },
    '南北朝':{ money:'钱',  grain:'石', cloth:'匹', silverToCoin: 0     },
    '隋':    { money:'贯',  grain:'石', cloth:'匹', silverToCoin: 1000  },
    '唐':    { money:'贯',  grain:'石', cloth:'匹', silverToCoin: 800   },
    '五代':  { money:'贯',  grain:'石', cloth:'匹', silverToCoin: 900   },
    '宋':    { money:'贯',  grain:'石', cloth:'匹', silverToCoin: 1000  },
    '辽':    { money:'贯',  grain:'石', cloth:'匹', silverToCoin: 1000  },
    '金':    { money:'贯',  grain:'石', cloth:'匹', silverToCoin: 1000  },
    '元':    { money:'贯',  grain:'石', cloth:'匹', silverToCoin: 1000  },
    '明':    { money:'两',  grain:'石', cloth:'匹', silverToCoin: 700   }, // 明中后期
    '清':    { money:'两',  grain:'石', cloth:'匹', silverToCoin: 1000  },
    'default':{ money:'两', grain:'石', cloth:'匹', silverToCoin: 1000  }
  };

  function _inferDynastyKey() {
    var sd = global.scriptData || {};
    var sc = (typeof global.findScenarioById === 'function' && global.GM && global.GM.sid)
      ? global.findScenarioById(global.GM.sid) : null;
    var dyn = (sc && (sc.dynasty || sc.era)) || sd.dynasty || (sd.settings && sd.settings.dynasty) || '';
    dyn = String(dyn);
    // 含"明"但不含"明清更迭"、"南明"等优先判断
    var keys = Object.keys(DYNASTY_DEFAULT_UNITS).filter(function(k){return k!=='default';});
    for (var i = 0; i < keys.length; i++) {
      if (dyn.indexOf(keys[i]) >= 0) return keys[i];
    }
    return 'default';
  }

  function _getEffectiveUnit() {
    var G = global.GM;
    // 优先：scriptData.fiscalConfig.unit（用户在编辑器选的）
    var sd = global.scriptData || {};
    var fc = (sd.fiscalConfig && sd.fiscalConfig.unit) || (global.P && global.P.fiscalConfig && global.P.fiscalConfig.unit) || null;
    // 其次：G.fiscal.unit
    var gfu = G && G.fiscal && G.fiscal.unit;
    // 再次：朝代默认
    var dynKey = _inferDynastyKey();
    var dynUnit = DYNASTY_DEFAULT_UNITS[dynKey] || DYNASTY_DEFAULT_UNITS.default;

    return {
      money: (fc && fc.money) || (gfu && gfu.money) || dynUnit.money,
      grain: (fc && fc.grain) || (gfu && gfu.grain) || dynUnit.grain,
      cloth: (fc && fc.cloth) || (gfu && gfu.cloth) || dynUnit.cloth,
      silverToCoin: (fc && fc.silverToCoin != null ? fc.silverToCoin : null) != null
                    ? fc.silverToCoin
                    : ((gfu && gfu.silverToCoin != null) ? gfu.silverToCoin : dynUnit.silverToCoin),
      dynastyKey: dynKey
    };
  }

  function _fmtNum(v) {
    v = Math.round(v||0);
    var abs = Math.abs(v);
    if (abs >= 1e8) return (v/1e8).toFixed(2) + '亿';
    if (abs >= 10000) return (v/10000).toFixed(1).replace(/\.0$/,'') + '万';
    if (abs >= 1000) return (v/1000).toFixed(1).replace(/\.0$/,'') + 'K';
    return String(v);
  }

  /** 格式化带单位字符串：fmt(1000000, 'money') → "100.0万两" */
  function fmt(value, kind) {
    var u = _getEffectiveUnit();
    var unit = u[kind || 'money'] || '';
    return _fmtNum(value) + unit;
  }

  /** 只取单位名（不带数字） */
  function unitOf(kind) {
    var u = _getEffectiveUnit();
    return u[kind || 'money'] || '';
  }

  /** 获取全局设置对象（只读） */
  function getUnit() {
    return _getEffectiveUnit();
  }

  /** 强制写入 GM.fiscal.unit（运行时改变单位用）——一般走编辑器配置，不用这个 */
  function setUnit(cfg) {
    var G = global.GM;
    if (!G) return;
    if (!G.fiscal) G.fiscal = {};
    if (!G.fiscal.unit) G.fiscal.unit = {};
    if (cfg.money) G.fiscal.unit.money = cfg.money;
    if (cfg.grain) G.fiscal.unit.grain = cfg.grain;
    if (cfg.cloth) G.fiscal.unit.cloth = cfg.cloth;
    if (cfg.silverToCoin != null) G.fiscal.unit.silverToCoin = cfg.silverToCoin;
  }

  global.CurrencyUnit = {
    fmt: fmt,
    unitOf: unitOf,
    getUnit: getUnit,
    setUnit: setUnit,
    DYNASTY_DEFAULT_UNITS: DYNASTY_DEFAULT_UNITS,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : this);

// ───────────────────────────────────────────
// §B·CurrencyEngine (from tm-currency-engine.js)
// ───────────────────────────────────────────
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  数据模型 — 默认值工厂
  // ═══════════════════════════════════════════════════════════════════

  function makeCoinLedger() {
    return {
      enabled: false,
      stock: 0,
      purity: 1.0,
      weightStandard: 1.0,
      debasementLevel: 0,
      mintQuantity: 0,
      mintHistory: [],
      privateMintShare: 0,
      rawReserve: 0,
      hoardingPressure: 0,
      outflowRate: 0,
      purchasingPowerFactor: 1.0
    };
  }

  function makePaperIssuance(spec) {
    spec = spec || {};
    return {
      id: spec.id || ('paper_' + Date.now()),
      name: spec.name || '新纸币',
      dynasty: spec.dynasty || '',
      issueYear: spec.issueYear || 0,
      originalAmount: spec.originalAmount || 1000000,
      currentCirculation: spec.originalAmount || 1000000,
      cumulativeIssued: spec.originalAmount || 1000000,
      reserveBacking: spec.reserveBacking || { silver: 0, copper: 0, grain: 0 },
      reserveRatio: spec.reserveRatio !== undefined ? spec.reserveRatio : 0.3,
      creditLevel: spec.creditLevel !== undefined ? spec.creditLevel : 90,
      inflationCarried: 0,
      state: spec.state || 'issue',
      stateStartTurn: 0,
      exchangeRateVsSilver: spec.exchangeRateVsSilver || 1.0,
      acceptanceByRegion: spec.acceptanceByRegion || {},
      abolishedYear: null
    };
  }

  function makeMarketState() {
    return {
      grainPrice: 100,
      clothPrice: 500,
      saltPrice: 50,
      ironPrice: 80,
      copperRawPrice: 60,
      silverRawPrice: 500,
      silverToCopperRate: 1000,
      paperToSilverRate: 1.0,
      warInflation: 1.0,
      seasonalFactor: 1.0,
      yearFortune: 1.0,
      speculationLevel: 0,
      regionalPrices: {},
      history: [],
      inflation: 0,
      inflationTrend: 0
    };
  }

  function makeMintAgency(spec) {
    spec = spec || {};
    return {
      id: spec.id || ('mint_' + Date.now()),
      name: spec.name || '宝泉局',
      location: spec.location || '',
      type: spec.type || 'central',
      capacity: spec.capacity || 100000,
      staffing: spec.staffing !== undefined ? spec.staffing : 80,
      coinType: spec.coinType || 'copper',
      purityStandard: spec.purityStandard !== undefined ? spec.purityStandard : 1.0,
      costPerUnit: spec.costPerUnit !== undefined ? spec.costPerUnit : 0.7,
      seignioragePerUnit: spec.seignioragePerUnit !== undefined ? spec.seignioragePerUnit : 0.3,
      enabled: spec.enabled !== false
    };
  }

  function makeForeignFlow() {
    return {
      enabled: false,
      annualSilverInflow: 0,
      annualSilverOutflow: 0,
      cumulativeNet: 0,
      sources: { japan: 0, americas: 0, europe: 0 },
      sinks: { opium: 0, imports: 0, tribute: 0 },
      historyByYear: [],
      tradeMode: 'restrictive'
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  朝代默认币种启用 + 本位制
  // ═══════════════════════════════════════════════════════════════════

  var DYNASTY_COIN_DEFAULTS = {
    '先秦': { shell:true, copper:true, gold:false, silver:false, iron:false, paper:false },
    '秦': { copper:true, gold:true, silver:false, iron:false, shell:false, paper:false },
    '汉': { copper:true, gold:true, silver:false, iron:false, shell:false, paper:false },
    '魏晋': { copper:true, gold:true, silver:false, iron:false, shell:false, paper:false },
    '南北朝': { copper:true, gold:true, silver:false, iron:true, shell:false, paper:false },
    '隋': { copper:true, silver:true, gold:true, iron:false, shell:false, paper:false },
    '唐': { copper:true, silver:true, gold:true, iron:false, shell:false, paper:false },
    '五代': { copper:true, silver:true, iron:true, gold:false, shell:false, paper:false },
    '宋': { copper:true, iron:true, silver:true, gold:false, shell:false, paper:true },
    '辽': { copper:true, silver:true, gold:false, iron:false, shell:false, paper:true },
    '金': { copper:true, silver:true, gold:false, iron:false, shell:false, paper:true },
    '元': { silver:true, copper:true, gold:false, iron:false, shell:false, paper:true },
    '明': { silver:true, copper:true, gold:false, iron:false, shell:false, paper:true },
    '清': { silver:true, copper:true, gold:false, iron:false, shell:false, paper:true },
    '民国': { silver:true, copper:true, paper:true, gold:false, iron:false, shell:false }
  };

  function inferDynastyFromScenario(sc) {
    if (!sc) return '唐';
    var name = (sc.name || sc.dynasty || '').toString();
    var keys = Object.keys(DYNASTY_COIN_DEFAULTS);
    for (var i = 0; i < keys.length; i++) {
      if (name.indexOf(keys[i]) >= 0) return keys[i];
    }
    return '唐';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  历史改革预设（精选 15 条）
  // ═══════════════════════════════════════════════════════════════════

  var REFORM_PRESETS = [
    { id:'qin_banliang', name:'秦始皇半两', dynasty:'秦', historicalYear:-221, type:'unify', baseSuccessRate:0.85, historicalOutcome:'success', famousProponent:'秦始皇', description:'统一圆方孔半两，废六国异币，金上币铜下币', effects:{ standardChange:'copper', coinChanges:{ copper:{ purityDelta:0.05 } }, unifyCoinage:true } },
    { id:'han_wuzhu', name:'武帝五铢', dynasty:'西汉', historicalYear:-113, type:'unify', baseSuccessRate:0.85, historicalOutcome:'success', famousProponent:'汉武帝·桑弘羊', description:'上林三官五铢，禁郡国铸，沿用七百年', effects:{ coinChanges:{ copper:{ purityDelta:0.1 } }, banPrivateMint:true } },
    { id:'hanwu_salt_iron', name:'武帝盐铁专营', dynasty:'西汉', historicalYear:-110, type:'system_overhaul', baseSuccessRate:0.80, historicalOutcome:'success', famousProponent:'桑弘羊', description:'盐铁收归大司农', effects:{ monopolyRevenue:0.3 } },
    { id:'wangmang_reforms', name:'王莽六次币改', dynasty:'新莽', historicalYear:7, type:'system_overhaul', baseSuccessRate:0.10, historicalOutcome:'failure', famousProponent:'王莽', description:'宝货十二品 28 种货币，百姓不知所从', effects:{ coinChanges:{ copper:{ purityDelta:-0.3 } }, confusion:true } },
    { id:'tang_kaiyuan', name:'开元通宝', dynasty:'唐', historicalYear:621, type:'unify', baseSuccessRate:0.90, historicalOutcome:'success', famousProponent:'唐高祖', description:'废五铢、立通宝，一两十钱，基准永久', effects:{ coinChanges:{ copper:{ purityDelta:0.08 } }, unifyCoinage:true } },
    { id:'tang_qianyuan', name:'乾元重宝', dynasty:'唐', historicalYear:758, type:'debase', baseSuccessRate:0.30, historicalOutcome:'failure', famousProponent:'唐肃宗', description:'当十、重轮当五十，四年废', effects:{ coinChanges:{ copper:{ purityDelta:-0.2, debasementDelta:0.2 } } } },
    { id:'tang_huichang', name:'会昌毁佛铸钱', dynasty:'唐', historicalYear:845, type:'coin_standard', baseSuccessRate:0.80, historicalOutcome:'success', famousProponent:'唐武宗', description:'毁佛寺铜像铸会昌开元，解钱荒', effects:{ coinStockBoost:{ copper:0.2 }, suppressBuddhism:true } },
    { id:'song_jiaozi_official', name:'交子官办', dynasty:'宋', historicalYear:1023, type:'paper_issue', baseSuccessRate:0.75, historicalOutcome:'success', famousProponent:'宋仁宗', description:'民间交子→官办，世界首官钞', effects:{ issuePaper:{ id:'jiaozi_official', name:'官交子', originalAmount:1250000, reserveRatio:0.36 } } },
    { id:'wanli_yitiaobian', name:'一条鞭法', dynasty:'明', historicalYear:1581, type:'system_overhaul', baseSuccessRate:0.70, historicalOutcome:'success', famousProponent:'张居正', description:'赋役合一，折银征收', effects:{ standardChange:'silver', monetizeTax:true } },
    { id:'ming_baochao', name:'大明宝钞', dynasty:'明', historicalYear:1375, type:'paper_issue', baseSuccessRate:0.40, historicalOutcome:'mixed', famousProponent:'朱元璋', description:'无准备金纯信用，30年失效', effects:{ issuePaper:{ id:'daming_baochao', name:'大明宝钞', originalAmount:5000000, reserveRatio:0 } } },
    { id:'zhongtong_chao', name:'中统元宝交钞', dynasty:'元', historicalYear:1260, type:'paper_issue', baseSuccessRate:0.75, historicalOutcome:'success', famousProponent:'元世祖·耶律楚材', description:'50% 银准备金，初行稳定', effects:{ issuePaper:{ id:'zhongtong', name:'中统交钞', originalAmount:700000, reserveRatio:0.5, exchangeRateVsSilver:0.5 } } },
    { id:'zhizheng_chao', name:'至正交钞', dynasty:'元', historicalYear:1350, type:'debase', baseSuccessRate:0.15, historicalOutcome:'failure', famousProponent:'脱脱', description:'海量发行，十年物价涨千倍', effects:{ paperOverissue:{ targetId:'zhizheng', multiplier:100 } } },
    { id:'ming_open_silver_1567', name:'隆庆开海', dynasty:'明', historicalYear:1567, type:'system_overhaul', baseSuccessRate:0.75, historicalOutcome:'success', famousProponent:'隆庆帝', description:'开放月港，海外白银大量流入', effects:{ tradeMode:'liberal', foreignSilverBoost:true } },
    { id:'qing_baochao', name:'咸丰钞票', dynasty:'清', historicalYear:1853, type:'paper_issue', baseSuccessRate:0.20, historicalOutcome:'failure', famousProponent:'咸丰帝', description:'户部官票+大清宝钞，为太平军筹款', effects:{ issuePaper:{ id:'hubu_guanpiao', name:'户部官票', originalAmount:9600000, reserveRatio:0.05 } } },
    { id:'daqing_abandon_paper', name:'同治废钞', dynasty:'清', historicalYear:1861, type:'abolish_paper', baseSuccessRate:0.85, historicalOutcome:'success', famousProponent:'同治帝', description:'咸丰钞尽废', effects:{ abolishAllPaper:true } }
  ];

  // 纸币历史预设（核心 12 种）——供剧本/改革事件引用
  var PAPER_PRESETS = {
    jiaozi_folk:        { name:'民间交子', dynasty:'北宋', issueYear:1017, originalAmount:1250000, reserveRatio:0.5 },
    jiaozi_official:    { name:'官交子', dynasty:'北宋', issueYear:1023, originalAmount:1250000, reserveRatio:0.36 },
    qianyin:            { name:'钱引', dynasty:'北宋末', issueYear:1105, originalAmount:2000000, reserveRatio:0.1 },
    huizi_east:         { name:'东南会子', dynasty:'南宋', issueYear:1160, originalAmount:65000000, reserveRatio:0.25 },
    jin_jiaochao_dading:{ name:'大定交钞', dynasty:'金', issueYear:1161, originalAmount:3000000, reserveRatio:0.4 },
    jin_zhenyou_baoquan:{ name:'贞祐宝券', dynasty:'金', issueYear:1214, originalAmount:0, reserveRatio:0, state:'overissue' },
    zhongtong:          { name:'中统交钞', dynasty:'元', issueYear:1260, originalAmount:700000, reserveRatio:0.5, exchangeRateVsSilver:0.5 },
    zhiyuan:            { name:'至元宝钞', dynasty:'元', issueYear:1287, originalAmount:2500000, reserveRatio:0.3 },
    zhizheng:           { name:'至正交钞', dynasty:'元末', issueYear:1350, originalAmount:10000000, reserveRatio:0.05 },
    daming_baochao:     { name:'大明宝钞', dynasty:'明', issueYear:1375, originalAmount:5000000, reserveRatio:0 },
    daqing_baochao:     { name:'大清宝钞', dynasty:'清', issueYear:1853, originalAmount:5000000, reserveRatio:0.1 },
    hubu_guanpiao:      { name:'户部官票', dynasty:'清', issueYear:1853, originalAmount:9600000, reserveRatio:0.05 }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  初始化
  // ═══════════════════════════════════════════════════════════════════

  function init(sc) {
    var G = global.GM || {};
    // 已初始化则补全缺失字段（兼容老存档）
    if (G.currency && G.currency._inited) {
      if (!G.currency.market) G.currency.market = makeMarketState();
      if (!G.currency.foreignFlow) G.currency.foreignFlow = makeForeignFlow();
      if (!G.currency.paper) G.currency.paper = { issuances: [], activeIssuances: [] };
      if (!G.currency.mintAgencies) G.currency.mintAgencies = [];
      if (!G.currency.coins) G.currency.coins = {};
      ['gold','silver','copper','iron','shell'].forEach(function(k) {
        if (!G.currency.coins[k]) G.currency.coins[k] = makeCoinLedger();
      });
      if (!Array.isArray(G.currency.reforms)) G.currency.reforms = [];
      if (!Array.isArray(G.currency.events)) G.currency.events = [];
      return;
    }
    var rules = (sc && sc.fiscalConfig && sc.fiscalConfig.currencyRules) || {};
    var dynasty = inferDynastyFromScenario(sc);
    var enabled = rules.enabledCoins || DYNASTY_COIN_DEFAULTS[dynasty] || DYNASTY_COIN_DEFAULTS['唐'];

    G.currency = {
      _inited: true,
      dynasty: dynasty,
      coins: {
        gold:   makeCoinLedger(),
        silver: makeCoinLedger(),
        copper: makeCoinLedger(),
        iron:   makeCoinLedger(),
        shell:  makeCoinLedger()
      },
      paper: { issuances: [], activeIssuances: [] },
      market: makeMarketState(),
      mintAgencies: [],
      foreignFlow: makeForeignFlow(),
      standardTimeline: rules.standardTimeline || [],
      reforms: [],
      currentStandard: rules.initialStandard || _inferStandard(dynasty),
      mintingControl: 0.6,
      events: []
    };

    // 启用币种 + 默认初始化
    ['gold','silver','copper','iron','shell'].forEach(function(k) {
      if (enabled[k]) {
        G.currency.coins[k].enabled = true;
        G.currency.coins[k].stock = _defaultStock(k, dynasty);
        G.currency.coins[k].rawReserve = G.currency.coins[k].stock * 0.1;
        // 典型成色
        if (k === 'silver') G.currency.coins[k].purity = 0.93;
        if (k === 'copper') G.currency.coins[k].purity = 1.0;
      }
    });

    // 纸币启用——按朝代预设
    if (enabled.paper && rules.defaultPresets && rules.defaultPresets.paper) {
      var preset = PAPER_PRESETS[rules.defaultPresets.paper];
      if (preset) {
        var iss = makePaperIssuance(Object.assign({}, preset, { id: rules.defaultPresets.paper }));
        G.currency.paper.issuances.push(iss);
        G.currency.paper.activeIssuances.push(iss.id);
      }
    }

    // 铸币机构——按朝代默认
    if (enabled.copper) {
      G.currency.mintAgencies.push(makeMintAgency({ id:'mint_central_copper', name:'京师宝泉局', type:'central', coinType:'copper', capacity:150000 }));
    }
    if (enabled.silver && (dynasty === '明' || dynasty === '清')) {
      G.currency.mintAgencies.push(makeMintAgency({ id:'mint_central_silver', name:'宝源局', type:'central', coinType:'silver', capacity:50000, purityStandard:0.93 }));
    }

    // 海外银流——仅明清启用
    if (dynasty === '明' || dynasty === '清' || rules.foreignFlowEnabled) {
      G.currency.foreignFlow.enabled = true;
    }

    // 市场初始化粮价（结合年景）
    G.currency.market.yearFortune = 1.0 + (Math.random() - 0.5) * 0.4;
    G.currency.market.grainPrice = 100 * (1 / G.currency.market.yearFortune);
  }

  function _inferStandard(dynasty) {
    if (dynasty === '明' || dynasty === '清' || dynasty === '民国') return 'silver_copper_paper';
    if (dynasty === '宋' || dynasty === '金' || dynasty === '元') return 'copper_paper';
    return 'copper';
  }

  function _defaultStock(coin, dynasty) {
    var base = {
      copper: { '先秦':500000, '秦':5000000, '汉':50000000, '唐':100000000, '宋':1500000000, '元':500000000, '明':800000000, '清':2000000000 },
      silver: { '宋':10000000, '元':20000000, '明':300000000, '清':800000000 },
      gold:   { '秦':100000, '汉':2000000, '唐':3000000, '宋':1000000 },
      iron:   { '宋':50000000 },
      shell:  { '先秦':1000000 }
    };
    if (base[coin] && base[coin][dynasty]) return base[coin][dynasty];
    return 1000000;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅲ 铸币周期
  // ═══════════════════════════════════════════════════════════════════

  function _mintCycle(ctx, mr) {
    var C = global.GM.currency;
    if (!C || !C.mintAgencies) return;
    var totalSeigniorage = 0;
    C.mintAgencies.forEach(function(agency) {
      if (!agency.enabled) return;
      var ledger = C.coins[agency.coinType];
      if (!ledger || !ledger.enabled) return;
      var capacity = agency.capacity * mr;
      var rawNeeded = capacity * agency.costPerUnit;
      if (ledger.rawReserve < rawNeeded * 0.3 || agency.staffing < 30) return;
      var rawUsed = Math.min(ledger.rawReserve, rawNeeded);
      var outputScale = rawUsed / rawNeeded;
      var actualOutput = capacity * outputScale * (agency.staffing / 100);
      // 降级惩罚（输出↑ 但 purity↓）
      if (ledger.debasementLevel > 0) actualOutput *= (1 + ledger.debasementLevel * 0.2);
      ledger.stock += actualOutput;
      ledger.rawReserve -= rawUsed;
      ledger.mintQuantity += actualOutput;
      ledger.mintHistory.push({ turn: ctx.turn, amount: actualOutput, purity: agency.purityStandard, agency: agency.id });
      if (ledger.mintHistory.length > 40) ledger.mintHistory.splice(0, ledger.mintHistory.length - 40);
      totalSeigniorage += actualOutput * agency.seignioragePerUnit;
      agency.staffing = Math.max(0, agency.staffing - 1 * mr);
    });
    // 铸币利润入国库
    if (totalSeigniorage > 0 && global.GM.guoku) {
      var gk = global.GM.guoku;
      // 入库走 money ledger.stock(真权威·g.balance/g.money 皆其镜像)+同步 balance/money
      // 原 bug:gk.ledgers.money 是对象 {stock,...}·对其 += number → 账本被覆写成 "[object Object]N" 字符串·stock 全丢·国库显示错乱(默认铜钱宝泉局每回合产铸币息·活跃路径)
      if (gk.ledgers && gk.ledgers.money && typeof gk.ledgers.money === 'object') {
        var _ml = gk.ledgers.money;
        _ml.stock = (Number(_ml.stock) || 0) + totalSeigniorage;
        gk.balance = _ml.stock;
        gk.money = _ml.stock;
      } else if (typeof gk.money === 'number') {
        gk.money += totalSeigniorage;
      }
      if (gk.sources) gk.sources.mintSeigniorage = (gk.sources.mintSeigniorage || 0) + totalSeigniorage;
    }
  }

  function _updatePrivateMinting(mr) {
    var C = global.GM.currency;
    if (!C) return;
    var gmv = global.GM.vars || {};
    Object.keys(C.coins).forEach(function(k) {
      var l = C.coins[k];
      if (!l.enabled || k === 'paper') return;
      var poverty = (gmv.poverty || 0.3);
      var share = 0.05
        + l.debasementLevel * 0.3
        + (l.hoardingPressure > 0.5 ? 0.2 : 0)
        + (1 - C.mintingControl) * 0.3
        + poverty * 0.1;
      l.privateMintShare = Math.max(0, Math.min(0.9, share));
      // 私铸影响有效 purity
      if (l.privateMintShare > 0.1) {
        var effPurity = l.purity * (1 - l.privateMintShare * 0.4);
        l.purchasingPowerFactor = effPurity / (l.purity || 1);
      } else {
        l.purchasingPowerFactor = 1 - l.debasementLevel * 0.3;
      }
    });
    // mintingControl 自然衰减
    C.mintingControl = Math.max(0, C.mintingControl - 0.02 * mr);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅳ 纸币生命周期
  // ═══════════════════════════════════════════════════════════════════

  function _updatePaperLifecycle(ctx) {
    var C = global.GM.currency;
    if (!C || !C.paper || !C.paper.issuances) return;
    C.paper.issuances.forEach(function(iss) {
      if (iss.state === 'abolish') return;
      // 计算 reserveRatio
      var backing = iss.reserveBacking || {};
      var silverVal = backing.silver || 0;
      var copperVal = (backing.copper || 0) / (C.market.silverToCopperRate || 1000); // 折银两
      var grainVal = (backing.grain || 0) * C.market.grainPrice / (C.market.silverToCopperRate || 1000);
      var reserveValue = silverVal + copperVal + grainVal;
      iss.reserveRatio = iss.currentCirculation > 0 ? reserveValue / iss.currentCirculation : 0;
      // 信用漂移
      var drift = 0;
      if (iss.reserveRatio < 0.05) drift = -8;
      else if (iss.reserveRatio < 0.1) drift = -5;
      else if (iss.reserveRatio < 0.2) drift = -2;
      else if (iss.reserveRatio > 0.4) drift = +1;
      // 累计滥发扣分
      if (iss.originalAmount > 0) {
        drift -= (iss.cumulativeIssued / iss.originalAmount - 1) * 0.3;
      }
      iss.creditLevel = Math.max(0, Math.min(100, iss.creditLevel + drift));
      // 状态转移
      var oldState = iss.state;
      if (iss.reserveRatio < 0.05 || iss.creditLevel < 20) iss.state = 'collapse';
      else if (iss.reserveRatio < 0.1 || iss.creditLevel < 40) iss.state = 'depreciate';
      else if (iss.reserveRatio < 0.2 || iss.creditLevel < 60) iss.state = 'overissue';
      else if (iss.state === 'issue' && ctx.turn - iss.stateStartTurn > 3) iss.state = 'circulate';
      if (iss.state !== oldState) {
        iss.stateStartTurn = ctx.turn;
        _emitEvent('paper_state_change', { paperId: iss.id, from: oldState, to: iss.state, name: iss.name });
        if (iss.state === 'collapse') _emitEvent('paper_collapse', { paperId: iss.id, name: iss.name });
      }
      // 通胀贡献
      iss.inflationCarried = Math.max(0, 1 - iss.reserveRatio) * Math.max(1, iss.currentCirculation / Math.max(1, iss.originalAmount));
    });
  }

  function issuePaper(spec) {
    var C = global.GM.currency;
    if (!C) return null;
    var iss = makePaperIssuance(spec);
    iss.stateStartTurn = global.GM.turn || 0;
    C.paper.issuances.push(iss);
    if (C.paper.activeIssuances.indexOf(iss.id) < 0) C.paper.activeIssuances.push(iss.id);
    _emitEvent('paper_issued', { paperId: iss.id, name: iss.name, amount: iss.originalAmount });
    return iss;
  }

  function abolishPaper(id) {
    var C = global.GM.currency;
    if (!C) return;
    var iss = C.paper.issuances.find(function(p) { return p.id === id; });
    if (!iss) return;
    iss.state = 'abolish';
    iss.abolishedYear = (global.GM.turn || 0);
    iss.currentCirculation = 0;
    C.paper.activeIssuances = C.paper.activeIssuances.filter(function(x) { return x !== id; });
    _emitEvent('paper_abolished', { paperId: id, name: iss.name });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅴ 市场博弈
  // ═══════════════════════════════════════════════════════════════════

  function _updateMarket(ctx, mr) {
    var C = global.GM.currency;
    if (!C) return;
    var m = C.market;
    var G = global.GM;
    // 供需比——简化版
    var pop = (G.vars && G.vars.pop) || 1000000;
    var farmland = (G.vars && G.vars.farmland) || 10000000;
    var disaster = (G.vars && G.vars.disasterLevel) || 0;
    var yieldPerMu = 2;
    var supply = farmland * yieldPerMu * (1 - disaster * 0.5);
    var demand = pop * 4; // 年人均 4 石粮
    var ratio = demand / Math.max(1, supply);
    // 战时/年景
    var wars = (G.activeWars || []).length;
    m.warInflation = 1 + Math.min(1.0, wars * 0.2);
    // 季节（按 month）
    var month = (G.month || 1);
    m.seasonalFactor = (month >= 3 && month <= 5) ? 1.2 : (month >= 9 && month <= 11) ? 0.85 : 1.0;
    // 年景每年更新
    if (month === 1) {
      m.yearFortune = 0.5 + Math.random() * 2.0; // 0.5-2.5
    }
    // 粮价
    var basePrice = 100;
    var elasticity = 1.5;
    m.grainPrice = basePrice * Math.pow(ratio, elasticity) * m.warInflation * m.seasonalFactor / Math.max(0.5, m.yearFortune || 1) * (1 + m.speculationLevel * 0.3);
    m.clothPrice = 500 * m.warInflation * (1 + m.speculationLevel * 0.2);
    m.saltPrice = 50 * m.warInflation;
    m.ironPrice = 80 * (1 + wars * 0.15);
    // 纸币带来的通胀
    var paperInflation = 0;
    (C.paper.issuances || []).forEach(function(iss) {
      if (iss.state === 'circulate' || iss.state === 'overissue' || iss.state === 'depreciate' || iss.state === 'collapse') {
        paperInflation += iss.inflationCarried * 0.1;
      }
    });
    // 铜钱降级通胀
    var coinInflation = (C.coins.copper.debasementLevel || 0) * 0.3;
    // 综合通胀（相对基准 1.0）
    var totalMultiplier = m.warInflation * m.seasonalFactor / Math.max(0.5, m.yearFortune) * (1 + paperInflation) * (1 + coinInflation);
    var prevInflation = m.inflation || 0;
    m.inflation = totalMultiplier - 1;
    m.inflationTrend = m.inflation - prevInflation;
    // 历史保留 24 条
    m.history.push({ turn: ctx.turn, grain: Math.round(m.grainPrice), inflation: +m.inflation.toFixed(3) });
    if (m.history.length > 24) m.history.splice(0, m.history.length - 24);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅲ/Ⅴ 钱荒/钱贱检测
  // ═══════════════════════════════════════════════════════════════════

  function _checkMoneySupply(ctx) {
    var C = global.GM.currency;
    if (!C) return;
    var G = global.GM;
    var pop = (G.vars && G.vars.pop) || 1000000;
    var economicActivity = pop * 2; // 人均年 2 贯活动量
    var copperStock = C.coins.copper.stock * (1 - (C.coins.copper.hoardingPressure || 0));
    var silverStock = C.coins.silver.enabled ? C.coins.silver.stock * (C.market.silverToCopperRate || 1000) : 0;
    var paperEff = 0;
    (C.paper.issuances || []).forEach(function(iss) {
      if (iss.state !== 'abolish' && iss.state !== 'collapse') {
        paperEff += iss.currentCirculation * (iss.creditLevel / 100);
      }
    });
    var moneySupply = copperStock + silverStock + paperEff;
    var ratio = moneySupply / Math.max(1, economicActivity);
    C.market.moneySupplyRatio = ratio;
    if (ratio < 0.6 && !C._qianhuangSignaled) {
      _emitEvent('coin_shortage', { ratio: ratio });
      C._qianhuangSignaled = true;
      if (global._adjAuthority) global._adjAuthority('minxin', -2);
    } else if (ratio > 1.6 && !C._qianjianSignaled) {
      _emitEvent('coin_glut', { ratio: ratio });
      C._qianjianSignaled = true;
    }
    // 冷却
    if (ratio >= 0.7) C._qianhuangSignaled = false;
    if (ratio <= 1.5) C._qianjianSignaled = false;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅵ 海外银流
  // ═══════════════════════════════════════════════════════════════════

  function _updateForeignFlow(ctx, mr) {
    var C = global.GM.currency;
    if (!C || !C.foreignFlow || !C.foreignFlow.enabled) return;
    var ff = C.foreignFlow;
    var G = global.GM;
    var year = (G.year || (G.turn || 0));
    // 按 tradeMode 确定流入流出
    var inflow = 0, outflow = 0;
    if (ff.tradeMode === 'liberal') { inflow = 1200000; outflow = 200000; }
    else if (ff.tradeMode === 'controlled') { inflow = 500000; outflow = 150000; }
    else if (ff.tradeMode === 'restrictive') { inflow = 200000; outflow = 100000; }
    else if (ff.tradeMode === 'banned') { inflow = 50000; outflow = 50000; }
    // 鸦片流出——清末特定
    if (C.dynasty === '清' && (year >= 1820 || G.turn > 200)) {
      outflow += 500000;
      ff.sinks.opium = (ff.sinks.opium || 0) + 500000 * mr;
    }
    ff.annualSilverInflow = inflow * mr / 12; // 月化
    ff.annualSilverOutflow = outflow * mr / 12;
    ff.cumulativeNet += (inflow - outflow) * mr / 12;
    // 白银流入国库/市场
    if (inflow > outflow) {
      C.coins.silver.stock += (inflow - outflow) * mr / 12;
    } else {
      C.coins.silver.stock = Math.max(0, C.coins.silver.stock - (outflow - inflow) * mr / 12);
    }
    // 事件
    if (ff.cumulativeNet < -5000000 && !ff._silverDrainSignaled) {
      _emitEvent('silver_drain', { cumulativeNet: ff.cumulativeNet });
      ff._silverDrainSignaled = true;
    }
    if (ff.cumulativeNet > 5000000 && !ff._silverGlutSignaled) {
      _emitEvent('silver_glut', { cumulativeNet: ff.cumulativeNet });
      ff._silverGlutSignaled = true;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅶ 改革执行
  // ═══════════════════════════════════════════════════════════════════

  function applyReform(id, opts) {
    opts = opts || {};
    var C = global.GM.currency;
    if (!C) return { ok: false, reason: '货币系统未初始化' };
    var preset = REFORM_PRESETS.find(function(r) { return r.id === id; });
    if (!preset) return { ok: false, reason: '未知改革' };
    var successRate = preset.baseSuccessRate;
    // 调整成功率：宰相能力/皇威/财力
    var chancellorInt = opts.chancellorIntelligence || 60;
    successRate += (chancellorInt - 60) / 200;
    var _hwC = (global.GM.huangwei && typeof global.GM.huangwei === 'object') ? (global.GM.huangwei.index || 50) : (global.GM.huangwei || 50);
    successRate += (_hwC - 50) / 500;
    // 国是之制硬通道（2026-07-03）：「改革推行」之制已立且扎根者·币制财政变法成功率上抬（封顶 +0.12）
    try {
      var _GRec = (typeof GlobalRules !== 'undefined' && GlobalRules) || (typeof window !== 'undefined' && window.GlobalRules);
      if (_GRec && typeof _GRec.mod === 'function') successRate += Math.min(0.12, Number(_GRec.mod('reform_success')) || 0);
    } catch (_grecE) {}
    successRate = Math.max(0.05, Math.min(0.95, successRate));
    var success = (opts.forceSuccess !== undefined) ? opts.forceSuccess : (Math.random() < successRate);
    var result = { ok: true, reformId: id, success: success, name: preset.name };
    if (success) {
      var e = preset.effects || {};
      // coin 变化
      if (e.coinChanges) {
        Object.keys(e.coinChanges).forEach(function(coin) {
          var l = C.coins[coin];
          if (!l) return;
          var d = e.coinChanges[coin];
          if (d.purityDelta !== undefined) l.purity = Math.max(0.1, Math.min(1.2, l.purity + d.purityDelta));
          if (d.debasementDelta !== undefined) l.debasementLevel = Math.max(0, Math.min(1, l.debasementLevel + d.debasementDelta));
        });
      }
      // 纸币发行
      if (e.issuePaper) {
        issuePaper(e.issuePaper);
      }
      // 纸币超发
      if (e.paperOverissue) {
        var iss = C.paper.issuances.find(function(p) { return p.id === e.paperOverissue.targetId; });
        if (iss) {
          iss.currentCirculation *= e.paperOverissue.multiplier;
          iss.cumulativeIssued *= e.paperOverissue.multiplier;
        }
      }
      // 废止所有纸币
      if (e.abolishAllPaper) {
        C.paper.issuances.forEach(function(p) { if (p.state !== 'abolish') abolishPaper(p.id); });
      }
      // 本位制变更
      if (e.standardChange) C.currentStandard = e.standardChange;
      // 贸易模式
      if (e.tradeMode && C.foreignFlow) C.foreignFlow.tradeMode = e.tradeMode;
      // 禁私铸
      if (e.banPrivateMint) C.mintingControl = Math.min(1.0, C.mintingControl + 0.3);
      _emitEvent('reform_success', { id: id, name: preset.name });
    } else {
      // 失败：部分负面
      var e2 = preset.effects || {};
      if (e2.coinChanges) {
        Object.keys(e2.coinChanges).forEach(function(coin) {
          var l = C.coins[coin];
          if (!l) return;
          l.debasementLevel = Math.min(1, l.debasementLevel + 0.1);
        });
      }
      _emitEvent('reform_failure', { id: id, name: preset.name });
    }
    C.reforms.push({ id: id, turn: global.GM.turn || 0, success: success });
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  事件发射（供事件系统/通知捕获）
  // ═══════════════════════════════════════════════════════════════════

  function _emitEvent(kind, data) {
    var C = global.GM.currency;
    if (!C) return;
    C.events.push({ kind: kind, turn: global.GM.turn || 0, data: data });
    if (C.events.length > 60) C.events.splice(0, C.events.length - 60);
    // 向全局事件总线/添加编年
    if (typeof global.addEB === 'function') {
      var msg = _formatEventMsg(kind, data);
      if (msg) global.addEB('货币', msg);
    }
    if (global.EconomyEventBus && typeof global.EconomyEventBus.emit === 'function') {
      global.EconomyEventBus.emit('currency.' + kind, data);
    }
  }

  function _formatEventMsg(kind, d) {
    d = d || {};
    switch (kind) {
      case 'coin_shortage': return '钱贵物贱，商贸滞塞，钱荒渐显';
      case 'coin_glut': return '铜钱泛滥，物价攀升';
      case 'paper_state_change': return (d.name||'纸币') + '状态由 ' + d.from + ' 转为 ' + d.to;
      case 'paper_collapse': return (d.name||'纸币') + '信用崩溃，百姓拒用';
      case 'paper_issued': return '新发 ' + (d.name||'纸币') + ' ' + _fmtNum(d.amount||0);
      case 'paper_abolished': return (d.name||'纸币') + '已废止';
      case 'silver_drain': return '白银外流加剧，银贵物贱';
      case 'silver_glut': return '海外银涌入，银贱物贵';
      case 'reform_success': return '货币改革「' + (d.name||'') + '」已成';
      case 'reform_failure': return '货币改革「' + (d.name||'') + '」受挫';
    }
    return null;
  }

  function _fmtNum(v) {
    v = Math.abs(v || 0);
    if (v >= 100000000) return (v/100000000).toFixed(1) + '亿';
    if (v >= 10000) return (v/10000).toFixed(1) + '万';
    return Math.round(v).toLocaleString();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  主 tick
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    if (!global.GM) return;
    if (!global.GM.currency || !global.GM.currency._inited) {
      var sc = (typeof global.findScenarioById === 'function') ? global.findScenarioById(global.GM.sid) : null;
      init(sc);
    }
    var mr = (ctx && typeof ctx.monthRatio === 'number') ? ctx.monthRatio : 1;
    try { _mintCycle(ctx||{}, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'CurrencyEngine] mint:') : console.error('[CurrencyEngine] mint:', e); }
    try { _updatePrivateMinting(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'CurrencyEngine] privateMint:') : console.error('[CurrencyEngine] privateMint:', e); }
    try { _updatePaperLifecycle(ctx||{}); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'CurrencyEngine] paper:') : console.error('[CurrencyEngine] paper:', e); }
    try { _updateMarket(ctx||{}, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'CurrencyEngine] market:') : console.error('[CurrencyEngine] market:', e); }
    try { _checkMoneySupply(ctx||{}); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'CurrencyEngine] moneySupply:') : console.error('[CurrencyEngine] moneySupply:', e); }
    try { _updateForeignFlow(ctx||{}, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'CurrencyEngine] foreign:') : console.error('[CurrencyEngine] foreign:', e); }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  UI/AI 辅助
  // ═══════════════════════════════════════════════════════════════════

  function getInflationText() {
    var C = global.GM && global.GM.currency;
    if (!C || !C.market) return '';
    var inf = C.market.inflation || 0;
    var pct = (inf * 100).toFixed(1);
    var sign = inf >= 0 ? '+' : '';
    return '通胀 ' + sign + pct + '%';
  }

  function getInflationColor() {
    var C = global.GM && global.GM.currency;
    if (!C || !C.market) return 'var(--ink-400)';
    var inf = C.market.inflation || 0;
    if (inf > 0.30) return 'var(--vermillion-400)';
    if (inf > 0.10) return 'var(--amber-400)';
    if (inf > -0.05) return 'var(--gold-400)';
    return 'var(--celadon-400)';
  }

  function getAIContext() {
    var C = global.GM && global.GM.currency;
    if (!C) return '';
    var lines = [];
    lines.push('【货币·市场】');
    lines.push('本位制：' + C.currentStandard + '；朝代：' + C.dynasty);
    if (C.market) {
      lines.push('粮价 ' + Math.round(C.market.grainPrice) + ' 文/石；通胀 ' + ((C.market.inflation||0)*100).toFixed(1) + '%；年景因子 ' + (C.market.yearFortune||1).toFixed(2));
      if (C.market.moneySupplyRatio) lines.push('货币/经济活动比：' + C.market.moneySupplyRatio.toFixed(2) + (C.market.moneySupplyRatio < 0.7 ? '（钱荒）' : C.market.moneySupplyRatio > 1.5 ? '（钱贱）' : ''));
    }
    // 币种状况
    var coinLines = [];
    ['copper','silver','iron','gold'].forEach(function(k) {
      var l = C.coins[k];
      if (!l || !l.enabled) return;
      var label = { copper:'铜', silver:'银', iron:'铁', gold:'金' }[k];
      var s = label + ' 存量 ' + _fmtNum(l.stock) + '，成色 ' + (l.purity*100).toFixed(0) + '%';
      if (l.debasementLevel > 0.1) s += '，降级 ' + (l.debasementLevel*100).toFixed(0) + '%';
      if (l.privateMintShare > 0.1) s += '，私铸 ' + (l.privateMintShare*100).toFixed(0) + '%';
      coinLines.push(s);
    });
    if (coinLines.length) lines.push(coinLines.join('；'));
    // 纸币
    var actives = (C.paper.issuances || []).filter(function(p) { return p.state !== 'abolish'; });
    if (actives.length > 0) {
      var paperLines = actives.slice(0, 3).map(function(p) {
        return p.name + '（' + p.state + '，准备金 ' + (p.reserveRatio*100).toFixed(0) + '%，信用 ' + Math.round(p.creditLevel) + '）';
      });
      lines.push('纸币：' + paperLines.join('；'));
    }
    // 海外银
    if (C.foreignFlow && C.foreignFlow.enabled) {
      lines.push('海外银流：' + (C.foreignFlow.tradeMode || '') + '，累计净流 ' + _fmtNum(C.foreignFlow.cumulativeNet) + ' 两');
    }
    return lines.join('\n');
  }

  function listReforms(filterFn) {
    if (typeof filterFn === 'function') return REFORM_PRESETS.filter(filterFn);
    return REFORM_PRESETS.slice();
  }

  function debaseCoin(coinType, level) {
    var C = global.GM.currency;
    if (!C) return;
    var l = C.coins[coinType];
    if (!l) return;
    l.debasementLevel = Math.max(0, Math.min(1, l.debasementLevel + (level || 0.1)));
    l.purity = Math.max(0.1, l.purity - (level || 0.1) * 0.5);
    _emitEvent('coin_debased', { coin: coinType, debasementLevel: l.debasementLevel });
  }

  function banPrivateMint() {
    var C = global.GM.currency;
    if (!C) return;
    C.mintingControl = Math.min(1.0, C.mintingControl + 0.2);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PAPER_DATA_25 + _updatePaperState + _checkPaperCollapse
  //  (R10b·原 tm-tax-atomic §B·R12 redistribute → CurrencyEngine namespace)
  // ═══════════════════════════════════════════════════════════════════

  var PAPER_DATA_25 = [
    { id:'jiaozi_shu',       name:'交子（蜀）',   dynasty:'宋', startYear:1023, endYear:1107, initialValue:1.0, inflationRate:0.02, state:'trial',       trust:0.8 },
    { id:'qianyin',           name:'钱引',         dynasty:'宋', startYear:1107, endYear:1160, initialValue:1.0, inflationRate:0.04, state:'active',      trust:0.7 },
    { id:'huizi',             name:'会子',         dynasty:'宋', startYear:1160, endYear:1240, initialValue:1.0, inflationRate:0.08, state:'depreciate',  trust:0.5 },
    { id:'guanzi',            name:'关子',         dynasty:'宋', startYear:1238, endYear:1279, initialValue:1.0, inflationRate:0.30, state:'collapse',    trust:0.1 },
    { id:'zhongtong_chao',    name:'中统钞',       dynasty:'元', startYear:1260, endYear:1287, initialValue:1.0, inflationRate:0.03, state:'active',      trust:0.8 },
    { id:'zhiyuan_chao',      name:'至元钞',       dynasty:'元', startYear:1287, endYear:1350, initialValue:1.0, inflationRate:0.05, state:'active',      trust:0.7 },
    { id:'zhizheng_chao',     name:'至正钞',       dynasty:'元', startYear:1350, endYear:1368, initialValue:1.0, inflationRate:0.50, state:'collapse',    trust:0.05 },
    { id:'daming_chao',       name:'大明宝钞',     dynasty:'明', startYear:1375, endYear:1450, initialValue:1.0, inflationRate:0.20, state:'depreciate',  trust:0.2 },
    { id:'jinjinling',        name:'金银引',       dynasty:'宋', startYear:1200, endYear:1250, initialValue:1.0, inflationRate:0.03, state:'trial',       trust:0.75 },
    { id:'yuanbao',           name:'元宝券',       dynasty:'元', startYear:1280, endYear:1340, initialValue:1.0, inflationRate:0.04, state:'active',      trust:0.7 },
    { id:'yinpiao',           name:'银票',         dynasty:'明', startYear:1600, endYear:1850, initialValue:1.0, inflationRate:0.02, state:'private',     trust:0.85 },
    { id:'qianpiao',           name:'钱票',         dynasty:'清', startYear:1770, endYear:1880, initialValue:1.0, inflationRate:0.02, state:'private',     trust:0.8 },
    { id:'huzhao',             name:'户钞',         dynasty:'明', startYear:1450, endYear:1500, initialValue:1.0, inflationRate:0.05, state:'active',      trust:0.6 },
    { id:'baochao_qing',       name:'大清宝钞',     dynasty:'清', startYear:1853, endYear:1861, initialValue:1.0, inflationRate:0.15, state:'trial',       trust:0.4 },
    { id:'hubu_guanpiao',      name:'户部官票',     dynasty:'清', startYear:1853, endYear:1861, initialValue:1.0, inflationRate:0.15, state:'trial',       trust:0.4 },
    { id:'shanxi_piaohao',     name:'山西票号',     dynasty:'清', startYear:1823, endYear:1921, initialValue:1.0, inflationRate:0.01, state:'private',     trust:0.95 },
    { id:'quanyezhang',        name:'钱业庄',       dynasty:'清', startYear:1850, endYear:1900, initialValue:1.0, inflationRate:0.02, state:'private',     trust:0.85 },
    { id:'jiaozi_xue',         name:'交子学',       dynasty:'宋', startYear:1100, endYear:1110, initialValue:1.0, inflationRate:0.05, state:'proposal',    trust:0.7 },
    { id:'qianyin_huai',       name:'钱引·淮',      dynasty:'宋', startYear:1150, endYear:1200, initialValue:1.0, inflationRate:0.04, state:'active',      trust:0.7 },
    { id:'dongnan_huizi',      name:'东南会子',     dynasty:'宋', startYear:1165, endYear:1210, initialValue:1.0, inflationRate:0.06, state:'active',      trust:0.65 },
    { id:'zhongtong_jiao',     name:'中统交钞',     dynasty:'元', startYear:1260, endYear:1280, initialValue:1.0, inflationRate:0.03, state:'active',      trust:0.8 },
    { id:'hongwu_baochao',     name:'洪武宝钞',     dynasty:'明', startYear:1375, endYear:1400, initialValue:1.0, inflationRate:0.10, state:'active',      trust:0.5 },
    { id:'dagong_bao',         name:'大工宝',       dynasty:'清', startYear:1850, endYear:1860, initialValue:1.0, inflationRate:0.20, state:'proposal',    trust:0.3 },
    { id:'yixian_chao',        name:'义县钞',       dynasty:'清', startYear:1861, endYear:1880, initialValue:1.0, inflationRate:0.05, state:'private',     trust:0.5 },
    { id:'yinyuan_piao',       name:'银圆票',       dynasty:'清', startYear:1890, endYear:1911, initialValue:1.0, inflationRate:0.01, state:'active',      trust:0.9 }
  ];

  function _updatePaperStateAtomic(G, mr) {
    if (!G || !G.currency || !G.currency.coins || !G.currency.coins.paper) return;
    var paper = G.currency.coins.paper;
    if (!paper.enabled) return;
    if (!paper.issuedAmount) paper.issuedAmount = 0;
    if (!paper.reserveRatio) paper.reserveRatio = 0.3;
    if (paper.cumulativeInflation === undefined) paper.cumulativeInflation = 0;
    paper.cumulativeInflation += (paper.inflationRate || 0.02) * mr / 12;
    var state = paper.state || 'active';
    if (state === 'proposal' && paper.issuedAmount > 1000000) state = 'trial';
    if (state === 'trial' && paper.cumulativeInflation < 0.1 && paper.issuedAmount > 10000000) state = 'circulate';
    if (state === 'circulate' && paper.issuedAmount > (paper.reserveRatio || 0.3) * 100000000) state = 'overissue';
    if (state === 'overissue' && paper.cumulativeInflation > 0.3) state = 'depreciate';
    if (state === 'depreciate' && paper.cumulativeInflation > 1.0) state = 'collapse';
    if (state === 'collapse' && (G.turn - (paper.collapseTurn || G.turn)) > ((typeof global.turnsForMonths === 'function') ? global.turnsForMonths(12) : 12)) state = 'abolish';
    if (state !== paper.state) {
      paper.state = state;
      if (state === 'collapse') {
        paper.collapseTurn = G.turn;
        _checkPaperCollapseAtomic(G);
      }
      if (global.addEB) global.addEB('纸币', '转入 ' + state + '（累积通胀 ' + (paper.cumulativeInflation*100).toFixed(0) + '%）');
    }
    paper.trust = Math.max(0.05, Math.min(1, 1 - paper.cumulativeInflation * 0.8));
  }

  function _checkPaperCollapseAtomic(G) {
    if (G && G.currency && G.currency.market) {
      G.currency.market.inflation = Math.min(2, (G.currency.market.inflation || 0) + 0.5);
      G.currency.market.moneySupplyRatio = Math.max(0.1, (G.currency.market.moneySupplyRatio || 0.8) * 0.3);
    }
    if (global._adjAuthority) {
      global._adjAuthority('minxin', -12);
      global._adjAuthority('huangwei', -8);
    }
    if (global.addEB) global.addEB('纸币崩溃', '钞法尽废，民不堪命');
    if (typeof global.EventBus !== 'undefined') {
      global.EventBus.emit('currency.paper.collapse', { turn: G.turn });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  _updateGrainPriceAtomic 市场供需 (R10c·原 tm-tax-atomic §C)
  // ═══════════════════════════════════════════════════════════════════

  function _updateGrainPriceAtomic(G, mr) {
    if (!G || !G.currency || !G.currency.market) return;
    var m = G.currency.market;
    var supply = 0;
    if (G.regions) {
      G.regions.forEach(function(r) {
        supply += (r.arableLand || 100000) * (r.grainYieldPerAcre || 0.5);
      });
    }
    if (!supply) supply = 50000000;
    var demand = (G.population && G.population.national && G.population.national.mouths || 50000000) * 180;
    var month = G.month || 1;
    var seasonFactor = month >= 5 && month <= 8 ? 0.85 :
                      month >= 9 && month <= 11 ? 1.1 :
                      1.0;
    var disasterFactor = G.vars && G.vars.disasterLevel > 0.3 ? (1 + G.vars.disasterLevel * 0.5) : 1.0;
    var basePriceByDynasty = { '汉':30, '唐':50, '宋':400, '元':350, '明':500, '清':1200 };
    var basePrice = basePriceByDynasty[G.dynasty] || 100;
    var ratio = demand / Math.max(1, supply);
    var newPrice = basePrice * ratio * seasonFactor * disasterFactor;
    m.grainPrice = (m.grainPrice || basePrice) * 0.9 + newPrice * 0.1;
    m.inflation = (m.grainPrice / basePrice) - 1;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.CurrencyEngine = {
    init: init,
    tick: tick,
    issuePaper: issuePaper,
    abolishPaper: abolishPaper,
    applyReform: applyReform,
    debaseCoin: debaseCoin,
    banPrivateMint: banPrivateMint,
    getInflationText: getInflationText,
    getInflationColor: getInflationColor,
    getAIContext: getAIContext,
    listReforms: listReforms,
    REFORM_PRESETS: REFORM_PRESETS,
    PAPER_PRESETS: PAPER_PRESETS,
    DYNASTY_COIN_DEFAULTS: DYNASTY_COIN_DEFAULTS,
    PAPER_DATA_25: PAPER_DATA_25,
    _updatePaperStateAtomic: _updatePaperStateAtomic,
    _checkPaperCollapseAtomic: _checkPaperCollapseAtomic,
    _updateGrainPriceAtomic: _updateGrainPriceAtomic,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

// ───────────────────────────────────────────
// §C·EnvCapacityEngine (from tm-env-capacity-engine.js)
// ───────────────────────────────────────────
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  生态疤痕种类
  // ═══════════════════════════════════════════════════════════════════

  var SCAR_TYPES = [
    'deforestation','soilErosion','salinization','desertification',
    'waterTableDrop','riverSilting','biodiversityLoss','soilFertilityLoss','urbanSewageOverload'
  ];

  var SCAR_LABELS = {
    deforestation:'森林退化', soilErosion:'水土流失', salinization:'盐碱化',
    desertification:'沙漠化', waterTableDrop:'地下水位下降', riverSilting:'河道淤积',
    biodiversityLoss:'生物多样性损失', soilFertilityLoss:'地力衰退', urbanSewageOverload:'城市排污过载'
  };

  // ═══════════════════════════════════════════════════════════════════
  //  20 环境危机事件
  // ═══════════════════════════════════════════════════════════════════

  var CRISIS_EVENTS = [
    { id:'huanghe_change', name:'黄河改道',       trigger:{ riverSilting:0.7 },       severity:'catastrophic', effect:{ deathRate:0.15, farmlandLoss:0.25, unrest:+30 } },
    { id:'huaihe_flood',   name:'淮河泛滥',       trigger:{ riverSilting:0.5 },       severity:'severe',       effect:{ deathRate:0.08, farmlandLoss:0.15, unrest:+20 } },
    { id:'flood',          name:'大水',           trigger:{ waterTableDrop:0.3 },     severity:'severe',       effect:{ deathRate:0.05, farmlandLoss:0.10, unrest:+15 } },
    { id:'drought',        name:'旱灾',           trigger:{ waterTableDrop:0.5 },     severity:'severe',       effect:{ deathRate:0.06, famine:true, unrest:+15 } },
    { id:'locust',         name:'蝗灾',           trigger:{ biodiversityLoss:0.6 },   severity:'severe',       effect:{ farmlandLoss:0.20, famine:true, unrest:+25 } },
    { id:'plague',         name:'瘟疫',           trigger:{ urbanSewageOverload:0.5 },severity:'catastrophic', effect:{ deathRate:0.20, unrest:+30 } },
    { id:'famine',         name:'饥荒',           trigger:{ soilFertilityLoss:0.5 },  severity:'severe',       effect:{ deathRate:0.10, unrest:+25 } },
    { id:'wildfire',       name:'山火',           trigger:{ deforestation:0.7 },      severity:'moderate',     effect:{ deathRate:0.01, deforestationBoost:0.1 } },
    { id:'dust_storm',     name:'沙尘',           trigger:{ desertification:0.5 },    severity:'moderate',     effect:{ farmlandLoss:0.05, unrest:+5 } },
    { id:'earthquake',     name:'地震',           trigger:null,                        severity:'severe',       effect:{ deathRate:0.03, housingLoss:0.20 }, random:true, probAnnual:0.03 },
    { id:'typhoon',        name:'飓风海啸',       trigger:null,                        severity:'moderate',     effect:{ deathRate:0.02, coastalDamage:true }, random:true, probAnnual:0.05 },
    { id:'mountain_desic', name:'山林尽伐',       trigger:{ deforestation:0.85 },     severity:'moderate',     effect:{ fuelCrisis:true, floodRisk:+0.2 } },
    { id:'well_dry',       name:'井泉尽涸',       trigger:{ waterTableDrop:0.8 },     severity:'severe',       effect:{ waterCrisis:true, migration:true } },
    { id:'salt_tide',      name:'盐碱蚀田',       trigger:{ salinization:0.7 },       severity:'severe',       effect:{ farmlandLoss:0.30 } },
    { id:'desert_invade',  name:'沙侵',           trigger:{ desertification:0.7 },    severity:'moderate',     effect:{ farmlandLoss:0.15, migration:true } },
    { id:'pest_outbreak',  name:'虫害爆发',       trigger:{ biodiversityLoss:0.7 },   severity:'moderate',     effect:{ farmlandLoss:0.10 } },
    { id:'fertility_loss', name:'地力尽',         trigger:{ soilFertilityLoss:0.8 },  severity:'severe',       effect:{ farmlandLoss:0.25, migration:true } },
    { id:'urban_epidemic', name:'都市疫疠',       trigger:{ urbanSewageOverload:0.7 },severity:'severe',       effect:{ deathRate:0.15, urbanUnrest:+20 } },
    { id:'river_burst',    name:'河堤溃决',       trigger:{ riverSilting:0.8 },       severity:'catastrophic', effect:{ deathRate:0.12, farmlandLoss:0.20 } },
    { id:'winter_severe',  name:'严冬',           trigger:null,                        severity:'moderate',     effect:{ deathRate:0.04, fuelStress:+0.3 }, random:true, probAnnual:0.08 }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  技术进步阶梯（5 个技术维度 × 朝代）
  // ═══════════════════════════════════════════════════════════════════

  var TECH_TIERS = {
    agriculture: {
      levels: [
        { era:'先秦', yieldMult:0.8, unlocks:['ox_plow'] },
        { era:'汉',   yieldMult:1.0, unlocks:['iron_tools','dongting_rice'] },
        { era:'唐',   yieldMult:1.3, unlocks:['curved_plow','south_rice'] },
        { era:'宋',   yieldMult:1.6, unlocks:['champa_rice','tea_cultivation'] },
        { era:'明',   yieldMult:1.9, unlocks:['maize','sweet_potato'] },
        { era:'清',   yieldMult:2.2, unlocks:['potato','expanded_maize'] }
      ]
    },
    irrigation: {
      levels: [
        { era:'先秦', capMult:0.7, unlocks:['dujiangyan'] },
        { era:'汉',   capMult:1.0, unlocks:['waterwheel'] },
        { era:'唐',   capMult:1.3, unlocks:['dragon_pump'] },
        { era:'宋',   capMult:1.6, unlocks:['tong_river'] },
        { era:'明',   capMult:1.9, unlocks:['advanced_channels'] },
        { era:'清',   capMult:2.0, unlocks:['qinling_projects'] }
      ]
    },
    fertilizer: {
      levels: [
        { era:'先秦', fertilityDecay:0.05, unlocks:['ash'] },
        { era:'汉',   fertilityDecay:0.04, unlocks:['manure'] },
        { era:'唐',   fertilityDecay:0.03, unlocks:['crop_rotation'] },
        { era:'宋',   fertilityDecay:0.025, unlocks:['green_manure'] },
        { era:'明',   fertilityDecay:0.02, unlocks:['bean_rotation'] },
        { era:'清',   fertilityDecay:0.018, unlocks:['intensive'] }
      ]
    },
    seedSelection: {
      levels: [
        { era:'汉',   yieldMult:1.0 },
        { era:'宋',   yieldMult:1.1 },
        { era:'明',   yieldMult:1.2 },
        { era:'清',   yieldMult:1.25 }
      ]
    },
    toolImprovement: {
      levels: [
        { era:'先秦', labor:1.0 },
        { era:'汉',   labor:0.9 },
        { era:'唐',   labor:0.8 },
        { era:'宋',   labor:0.7 },
        { era:'明',   labor:0.65 },
        { era:'清',   labor:0.6 }
      ]
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  13 类环境政策（古语）
  // ═══════════════════════════════════════════════════════════════════

  var ENV_POLICIES = [
    { id:'feng_shan_mu',  name:'封山育木',    scarReduce:{ deforestation:0.02 },      cost:{ money:50000 } },
    { id:'jin_hu_kui',    name:'禁伐楛',      scarReduce:{ deforestation:0.015 },     cost:{ money:30000 } },
    { id:'yi_he_shui',    name:'疏浚河道',    scarReduce:{ riverSilting:0.03 },       cost:{ money:80000 } },
    { id:'ke_gao',        name:'克膏治田',    scarReduce:{ salinization:0.02 },       cost:{ money:60000 } },
    { id:'tun_tian',      name:'屯田养地',    scarReduce:{ soilFertilityLoss:0.02 },  cost:{ money:40000, grain:20000 } },
    { id:'fan_gu',        name:'反古休耕',    scarReduce:{ soilFertilityLoss:0.03 },  cost:{ money:30000 } },
    { id:'jie_yong',      name:'节用爱民',    scarReduce:{ deforestation:0.01, urbanSewageOverload:0.01 }, cost:{ money:20000 } },
    { id:'zhi_tian_yu',   name:'制田赋',      scarReduce:{ soilErosion:0.015 },       cost:{ money:35000 } },
    { id:'jin_dian_hun',  name:'禁奠琥',      scarReduce:{ biodiversityLoss:0.02 },   cost:{ money:15000 } },
    { id:'shui_li',       name:'兴水利',      scarReduce:{ waterTableDrop:0.02 },     cost:{ money:100000 } },
    { id:'ken_huang',     name:'垦荒（慎）',  effect:{ farmlandBoost:+0.05 },         cost:{ money:40000 }, risk:{ deforestation:+0.01 } },
    { id:'yu_huang',      name:'育皇林',      scarReduce:{ biodiversityLoss:0.01 },   cost:{ money:25000 } },
    { id:'jing_wei',      name:'净渭清畿',    scarReduce:{ urbanSewageOverload:0.03 },cost:{ money:50000 } },
    { id:'migration_relief', name:'迁民减压', scarReduce:{ soilErosion:0.045, deforestation:0.03, urbanSewageOverload:0.02 }, effect:{ migrateShare:0.10, loadRelief:0.10 }, cost:{ money:120000, grain:60000 }, duration:36 },
    { id:'tech_investment', name:'技术投入', scarReduce:{ waterTableDrop:0.012, riverSilting:0.012, soilFertilityLoss:0.008 }, effect:{ techBoost:{ irrigation:0.25, agriculture:0.15, fertilizer:0.12, toolImprovement:0.10 }, carryingBoost:0.03 }, cost:{ money:160000 }, duration:36 },
    { id:'disaster_recovery', name:'灾后恢复', scarReduce:{ soilErosion:0.035, riverSilting:0.025, soilFertilityLoss:0.035, salinization:0.018 }, effect:{ arableRestore:0.08, soilFertilityBoost:0.05, disasterRecovery:0.18 }, cost:{ money:140000, grain:50000 }, duration:30 }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  初始化
  // ═══════════════════════════════════════════════════════════════════

  function init(sc) {
    var G = global.GM;
    if (!G) return;
    if (G.environment && G.environment._inited) {
      if (!G.environment.byRegion) G.environment.byRegion = {};
      if (!G.environment.crisisHistory) G.environment.crisisHistory = [];
      if (!G.environment.historicalScarMap) G.environment.historicalScarMap = [];
      return;
    }

    var config = (sc && sc.environmentConfig) || {};
    var regions = (G.regions || []);

    G.environment = {
      _inited: true,
      nationalCarrying: { farmland: 0, water: 0, fuel: 0, housing: 0, sanitation: 0 },
      nationalLoad: 0.5,
      ecoDebt: 0,
      byRegion: _initRegions(regions, config),
      climatePhase: (config.climateTimeline && config.climateTimeline[0]) || 'normal',
      historicalScarMap: [],
      crisisHistory: [],
      techEra: _inferTechEra(sc),
      activePolicies: [] // 正在推行的政策列表
    };

    _recomputeNationalCarrying();
  }

  function _inferTechEra(sc) {
    if (!sc) return '唐';
    var name = (sc.name || sc.dynasty || '').toString();
    var eras = ['先秦','汉','唐','宋','元','明','清'];
    for (var i = eras.length - 1; i >= 0; i--) {
      if (name.indexOf(eras[i]) >= 0) return eras[i];
    }
    return '唐';
  }

  function _initRegions(regions, config) {
    var out = {};
    regions.forEach(function(r) {
      if (!r || !r.id) return;
      var custom = (config.initialCarrying && config.initialCarrying.byRegion && config.initialCarrying.byRegion[r.id]) || {};
      var customScars = (config.initialScars && config.initialScars.byRegion && config.initialScars.byRegion[r.id]) || {};
      out[r.id] = {
        carrying: {
          farmlandSupport: custom.farmlandSupport || 1000000,
          waterSupport:    custom.waterSupport    || 1500000,
          fuelSupport:     custom.fuelSupport     || 800000,
          housingSupport:  custom.housingSupport  || 1200000,
          sanitationSupport: custom.sanitationSupport || 1000000
        },
        carryingMax: 0,
        ecoScars: _defaultScars(customScars),
        currentLoad: 0.5,
        overloadYears: 0,
        forestArea: custom.forestArea || 500000,
        coalReserve: custom.coalReserve || 0,
        aquiferLevel: custom.aquiferLevel || 1.0,
        riverFlow: custom.riverFlow || 1.0,
        arableArea: custom.arableArea || 500000,
        soilFertility: custom.soilFertility || 0.85,
        techLevel: Object.assign({ agriculture: 1, irrigation: 1, fertilizer: 1, seedSelection: 1, toolImprovement: 1 }, custom.techLevel || {})
      };
      _recomputeRegionCarrying(r.id, out[r.id]);
    });
    return out;
  }

  function _defaultScars(custom) {
    var s = {};
    SCAR_TYPES.forEach(function(t) { s[t] = (custom && custom[t]) || 0; });
    return s;
  }

  function _recomputeRegionCarrying(rid, reg) {
    // 1) 土地支撑
    var G = global.GM;
    var techEra = G.environment ? G.environment.techEra : '唐';
    var yieldMult = _getTechEraMult('agriculture', techEra, 'yieldMult') || 1.0;
    var irrigMult = _getTechEraMult('irrigation', techEra, 'capMult') || 1.0;
    var seedMult = _getTechEraMult('seedSelection', techEra, 'yieldMult') || 1.0;
    var farmland = (reg.arableArea || 500000) * (reg.soilFertility || 0.85) * yieldMult * seedMult * irrigMult
                   - (reg.ecoScars.salinization || 0) * 200000
                   - (reg.ecoScars.soilErosion || 0) * 150000;
    reg.carrying.farmlandSupport = Math.max(100000, farmland);
    // 2) 水
    var water = (reg.aquiferLevel || 1.0) * 1500000 * (reg.riverFlow || 1.0)
                - (reg.ecoScars.waterTableDrop || 0) * 300000
                - (reg.ecoScars.riverSilting || 0) * 200000;
    reg.carrying.waterSupport = Math.max(100000, water);
    // 3) 燃料
    var fuel = (reg.forestArea || 500000) * 1.5 + (reg.coalReserve || 0) * 3
               - (reg.ecoScars.deforestation || 0) * 400000;
    reg.carrying.fuelSupport = Math.max(50000, fuel);
    // 4) 住房
    reg.carrying.housingSupport = (reg.mouths || 1200000) * 1.1; // 简化估算
    // 5) 卫生
    var sani = 1000000 - (reg.ecoScars.urbanSewageOverload || 0) * 500000;
    reg.carrying.sanitationSupport = Math.max(100000, sani);

    reg.carryingMax = Math.min(
      reg.carrying.farmlandSupport,
      reg.carrying.waterSupport,
      reg.carrying.fuelSupport,
      reg.carrying.housingSupport,
      reg.carrying.sanitationSupport
    );

    // 加载比
    var pop = global.GM.population && global.GM.population.byRegion && global.GM.population.byRegion[rid];
    var popCount = pop ? pop.mouths : 1000000;
    reg.currentLoad = popCount / Math.max(1, reg.carryingMax);
  }

  function _getTechEraMult(tech, era, key) {
    var levels = TECH_TIERS[tech] && TECH_TIERS[tech].levels;
    if (!levels) return 1.0;
    var lv = levels.find(function(l) { return l.era === era; });
    if (!lv) lv = levels[levels.length - 1];
    return lv[key] || 1.0;
  }

  function _recomputeNationalCarrying() {
    var E = global.GM.environment;
    if (!E) return;
    var totals = { farmland:0, water:0, fuel:0, housing:0, sanitation:0 };
    var loadSum = 0, n = 0;
    Object.values(E.byRegion).forEach(function(r) {
      totals.farmland += r.carrying.farmlandSupport;
      totals.water += r.carrying.waterSupport;
      totals.fuel += r.carrying.fuelSupport;
      totals.housing += r.carrying.housingSupport;
      totals.sanitation += r.carrying.sanitationSupport;
      loadSum += r.currentLoad;
      n++;
    });
    E.nationalCarrying = totals;
    E.nationalLoad = n > 0 ? loadSum / n : 0.5;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅱ 生态疤痕累积 + Ⅳ 恢复
  // ═══════════════════════════════════════════════════════════════════

  function _tickScarAccumulation(ctx, mr) {
    var E = global.GM.environment;
    if (!E) return;
    var G = global.GM;
    Object.keys(E.byRegion).forEach(function(rid) {
      var reg = E.byRegion[rid];
      var pop = G.population && G.population.byRegion && G.population.byRegion[rid];
      var popCount = pop ? pop.mouths : 500000;
      var load = reg.currentLoad || 0.5;
      // 过载加速疤痕
      var overloadMult = Math.max(1.0, load);
      // 森林退化（按人口烧柴）
      reg.ecoScars.deforestation = Math.min(1, (reg.ecoScars.deforestation || 0) + 0.0005 * overloadMult * mr);
      // 水土流失
      reg.ecoScars.soilErosion = Math.min(1, (reg.ecoScars.soilErosion || 0) + 0.0003 * overloadMult * mr);
      // 地下水下降（人口密度影响）
      reg.ecoScars.waterTableDrop = Math.min(1, (reg.ecoScars.waterTableDrop || 0) + 0.0002 * overloadMult * mr);
      // 河道淤积
      reg.ecoScars.riverSilting = Math.min(1, (reg.ecoScars.riverSilting || 0) + 0.0002 * mr);
      // 地力衰退（按技术）
      var fertDecay = _getTechEraMult('fertilizer', E.techEra, 'fertilityDecay') || 0.03;
      reg.ecoScars.soilFertilityLoss = Math.min(1, (reg.ecoScars.soilFertilityLoss || 0) + fertDecay / 12 * mr);
      reg.soilFertility = Math.max(0.3, reg.soilFertility - fertDecay / 12 * mr);
      // 盐碱化（灌溉过度）
      reg.ecoScars.salinization = Math.min(1, (reg.ecoScars.salinization || 0) + 0.0001 * overloadMult * mr);
      // 沙漠化（干旱+过伐）
      if (reg.ecoScars.deforestation > 0.5) {
        reg.ecoScars.desertification = Math.min(1, (reg.ecoScars.desertification || 0) + 0.0002 * mr);
      }
      // 生物多样性损失
      reg.ecoScars.biodiversityLoss = Math.min(1, (reg.ecoScars.biodiversityLoss || 0) + 0.0001 * mr);
      // 城市排污
      if (popCount > 500000) {
        reg.ecoScars.urbanSewageOverload = Math.min(1, (reg.ecoScars.urbanSewageOverload || 0) + 0.0003 * mr);
      }
      // 过载年数
      if (load > 1.0) reg.overloadYears += mr / 12;
      else reg.overloadYears = Math.max(0, reg.overloadYears - mr / 24); // 恢复慢
      // 政策效果
      (E.activePolicies || []).forEach(function(p) {
        if (p.regionId && p.regionId !== rid && p.regionId !== 'all') return;
        var policy = ENV_POLICIES.find(function(pp) { return pp.id === p.id; });
        if (policy && policy.scarReduce) {
          Object.keys(policy.scarReduce).forEach(function(sk) {
            reg.ecoScars[sk] = Math.max(0, reg.ecoScars[sk] - policy.scarReduce[sk] * mr / 12);
          });
        }
        if (policy && policy.effect && policy.effect.loadRelief) {
          reg.currentLoad = Math.max(0.05, (reg.currentLoad || 0.5) - policy.effect.loadRelief * mr / 24);
        }
      });
      _recomputeRegionCarrying(rid, reg);
    });
    _recomputeNationalCarrying();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅲ 过载多级反馈
  // ═══════════════════════════════════════════════════════════════════

  function _tickOverloadFeedback(ctx, mr) {
    var E = global.GM.environment;
    if (!E) return;
    var G = global.GM;
    Object.keys(E.byRegion).forEach(function(rid) {
      var reg = E.byRegion[rid];
      var load = reg.currentLoad || 0.5;
      if (load < 1.0) return;
      // 级别 1: 1.0-1.2 压力
      // 级别 2: 1.2-1.5 饥荒
      // 级别 3: >1.5 崩溃
      var level = load < 1.2 ? 1 : load < 1.5 ? 2 : 3;
      var pop = G.population && G.population.byRegion && G.population.byRegion[rid];
      if (!pop) return;
      if (level === 1) {
        pop.yearlyDeaths = (pop.yearlyDeaths || 0) + pop.mouths * 0.002 * mr / 12;
        pop.mouths = Math.max(10000, pop.mouths - pop.mouths * 0.002 * mr / 12);
      } else if (level === 2) {
        pop.yearlyDeaths = (pop.yearlyDeaths || 0) + pop.mouths * 0.008 * mr / 12;
        pop.mouths = Math.max(10000, pop.mouths - pop.mouths * 0.008 * mr / 12);
        var region = (G.regions || []).find(function(r) { return r.id === rid; });
        if (region) region.unrest = Math.min(100, (region.unrest || 30) + 3 * mr);
        if (global._adjAuthority) global._adjAuthority('minxin', -0.2 * mr);
      } else {
        pop.yearlyDeaths = (pop.yearlyDeaths || 0) + pop.mouths * 0.02 * mr / 12;
        pop.mouths = Math.max(10000, pop.mouths - pop.mouths * 0.02 * mr / 12);
        var region2 = (G.regions || []).find(function(r) { return r.id === rid; });
        if (region2) { region2.unrest = Math.min(100, (region2.unrest || 30) + 8 * mr); region2.disasterLevel = Math.min(1, (region2.disasterLevel || 0) + 0.05 * mr); }
        if (global._adjAuthority) global._adjAuthority('minxin', -0.5 * mr);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅴ 危机事件触发
  // ═══════════════════════════════════════════════════════════════════

  function _tickCrisisEvents(ctx, mr) {
    var E = global.GM.environment;
    if (!E) return;
    CRISIS_EVENTS.forEach(function(ev) {
      // 触发检测——每月仅一次机会
      if (ev.random) {
        if (Math.random() < (ev.probAnnual || 0.02) * mr / 12) {
          _triggerCrisis(ev);
        }
      } else if (ev.trigger) {
        // 按 scar 触发
        Object.keys(ev.trigger).forEach(function(sk) {
          var threshold = ev.trigger[sk];
          Object.keys(E.byRegion).forEach(function(rid) {
            var reg = E.byRegion[rid];
            if (reg.ecoScars[sk] >= threshold && !reg['_crisis_' + ev.id]) {
              if (Math.random() < 0.02 * mr) {
                _triggerCrisis(ev, rid);
                reg['_crisis_' + ev.id] = ctx.turn || 0;
              }
            }
            // 冷却 5 年后可再触发
      if (reg['_crisis_' + ev.id] && (ctx.turn - reg['_crisis_' + ev.id]) > ((typeof global.turnsForMonths === 'function') ? global.turnsForMonths(60) : 60)) {
              delete reg['_crisis_' + ev.id];
            }
          });
        });
      }
    });
  }

  function _triggerCrisis(ev, rid) {
    var E = global.GM.environment;
    E.crisisHistory.push({ id: ev.id, name: ev.name, turn: global.GM.turn, regionId: rid || 'national', severity: ev.severity });
    if (E.crisisHistory.length > 60) E.crisisHistory.splice(0, E.crisisHistory.length - 60);
    // 效果
    if (ev.effect) {
      var ef = ev.effect;
      if (ef.deathRate) {
        var P = global.GM.population;
        if (P) {
          var target = rid && P.byRegion[rid] ? P.byRegion[rid] : P.national;
          var deaths = Math.round(target.mouths * ef.deathRate);
          target.mouths = Math.max(10000, target.mouths - deaths);
          if (P.national !== target) P.national.mouths = Math.max(10000, P.national.mouths - deaths);
        }
      }
      if (ef.unrest) {
        var G = global.GM;
        if (rid) {
          var reg = (G.regions || []).find(function(r) { return r.id === rid; });
          if (reg) reg.unrest = Math.min(100, (reg.unrest || 30) + ef.unrest);
        } else {
          if (typeof G.unrest === 'number') G.unrest = Math.min(100, G.unrest + ef.unrest / 2);
        }
      }
      if (ef.farmlandLoss) {
        if (rid && E.byRegion[rid]) {
          E.byRegion[rid].arableArea *= (1 - ef.farmlandLoss);
        }
      }
    }
    if (global.addEB) global.addEB('环境', ev.name + (rid ? '（' + rid + '）' : '') + ' · ' + ev.severity);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅶ 玩家环境政策
  // ═══════════════════════════════════════════════════════════════════

  function _envRegionIds(regionId) {
    var E = global.GM && global.GM.environment;
    if (!E || !E.byRegion) return [];
    if (regionId && regionId !== 'all' && E.byRegion[regionId]) return [regionId];
    return Object.keys(E.byRegion);
  }

  function _findEnvReceivingRegion(fromId) {
    var E = global.GM && global.GM.environment;
    if (!E || !E.byRegion) return null;
    var best = null;
    Object.keys(E.byRegion).forEach(function(rid) {
      if (rid === fromId) return;
      var reg = E.byRegion[rid] || {};
      if (!best || (reg.currentLoad || 0.5) < (E.byRegion[best].currentLoad || 0.5)) best = rid;
    });
    return best;
  }

  function _pushEnvPolicyHistory(entry) {
    var E = global.GM && global.GM.environment;
    if (!E) return;
    if (!Array.isArray(E.policyHistory)) E.policyHistory = [];
    E.policyHistory.push(entry);
    if (E.policyHistory.length > 120) E.policyHistory.splice(0, E.policyHistory.length - 120);
  }

  function _applyPolicyImmediateEffect(policy, policyId, regionId) {
    var G = global.GM;
    var E = G && G.environment;
    if (!G || !E || !E.byRegion || !policy) return { regions: [] };
    var effect = policy.effect || {};
    var summary = { regions: [], migrated: 0, techBoosted: 0, restored: 0 };
    _envRegionIds(regionId).forEach(function(rid) {
      var reg = E.byRegion[rid];
      if (!reg) return;
      var row = { regionId: rid };

      if (effect.migrateShare && G.population && G.population.byRegion && G.population.byRegion[rid]) {
        var pop = G.population.byRegion[rid];
        var amount = Math.max(0, Math.round((pop.mouths || 0) * effect.migrateShare));
        var destId = _findEnvReceivingRegion(rid);
        if (amount > 0 && destId && G.population.byRegion[destId]) {
          pop.mouths = Math.max(0, (pop.mouths || 0) - amount);
          pop.households = Math.max(0, Math.round((pop.households || 0) - amount / 5));
          pop.ding = Math.max(0, Math.round((pop.ding || 0) - amount * 0.3));
          pop.yearlyNetMigration = (pop.yearlyNetMigration || 0) - amount;
          var dst = G.population.byRegion[destId];
          dst.mouths = (dst.mouths || 0) + amount;
          dst.households = Math.round((dst.households || 0) + amount / 5);
          dst.ding = Math.round((dst.ding || 0) + amount * 0.3);
          dst.yearlyNetMigration = (dst.yearlyNetMigration || 0) + amount;
          row.migrated = amount;
          row.toRegionId = destId;
          summary.migrated += amount;
        }
      }

      if (policy.scarReduce) {
        row.scarImmediate = {};
        Object.keys(policy.scarReduce).forEach(function(sk) {
          var beforeScar = reg.ecoScars[sk] || 0;
          reg.ecoScars[sk] = Math.max(0, beforeScar - policy.scarReduce[sk] * 0.5);
          row.scarImmediate[sk] = beforeScar - reg.ecoScars[sk];
        });
      }

      if (effect.techBoost) {
        if (!reg.techLevel) reg.techLevel = {};
        Object.keys(effect.techBoost).forEach(function(k) {
          reg.techLevel[k] = (reg.techLevel[k] || 1) + effect.techBoost[k];
          summary.techBoosted += 1;
        });
        row.techBoost = Object.assign({}, effect.techBoost);
      }

      if (effect.carryingBoost) {
        reg.arableArea = (reg.arableArea || 500000) * (1 + effect.carryingBoost);
        reg.forestArea = (reg.forestArea || 500000) * (1 + effect.carryingBoost / 2);
        row.carryingBoost = effect.carryingBoost;
      }

      if (effect.arableRestore) {
        var beforeArable = reg.arableArea || 500000;
        reg.arableArea = beforeArable * (1 + effect.arableRestore);
        row.arableRestored = Math.round(reg.arableArea - beforeArable);
        summary.restored += row.arableRestored;
      }

      if (effect.soilFertilityBoost) {
        reg.soilFertility = Math.min(1.2, (reg.soilFertility || 0.85) + effect.soilFertilityBoost);
        row.soilFertilityBoost = effect.soilFertilityBoost;
      }

      if (effect.disasterRecovery) {
        var mapRegion = (G.regions || []).find(function(r) { return r && r.id === rid; });
        if (mapRegion) {
          mapRegion.disasterLevel = Math.max(0, (mapRegion.disasterLevel || 0) - effect.disasterRecovery);
          mapRegion.unrest = Math.max(0, (mapRegion.unrest || 0) - Math.round(effect.disasterRecovery * 20));
        }
        row.disasterRecovery = effect.disasterRecovery;
      }

      if (effect.loadRelief) {
        reg.currentLoad = Math.max(0.05, (reg.currentLoad || 0.5) - effect.loadRelief);
        row.loadRelief = effect.loadRelief;
      }

      _recomputeRegionCarrying(rid, reg);
      summary.regions.push(row);
    });
    _recomputeNationalCarrying();
    _pushEnvPolicyHistory({
      turn: G.turn || 0,
      policyId: policyId,
      name: policy.name,
      regionId: regionId || 'all',
      immediate: summary,
      cost: Object.assign({}, policy.cost || {})
    });
    return summary;
  }

  function enactPolicy(policyId, regionId) {
    var policy = ENV_POLICIES.find(function(p) { return p.id === policyId; });
    if (!policy) return { ok: false, reason: 'unknown policy' };
    var E = global.GM.environment;
    if (!E) return { ok: false };
    if (!Array.isArray(E.activePolicies)) E.activePolicies = [];
    if (!Array.isArray(E.policyHistory)) E.policyHistory = [];
    // 扣钱
    var cost = policy.cost || {};
    if (cost.money && global.GM.guoku) {
      if ((global.GM.guoku.money || 0) < cost.money) return { ok: false, reason: '帑廪不足' };
      global.GM.guoku.money -= cost.money;
    }
    if (cost.grain && global.GM.guoku) {
      global.GM.guoku.grain = Math.max(0, (global.GM.guoku.grain || 0) - cost.grain);
    }
    var immediate = _applyPolicyImmediateEffect(policy, policyId, regionId || 'all');
    // 加入活跃政策（默认持续 24 回合，重点政策可自定）
    E.activePolicies.push({
      id: policyId, regionId: regionId || 'all',
      name: policy.name,
      startTurn: global.GM.turn || 0, duration: policy.duration || 24,
      cost: Object.assign({}, cost),
      immediate: immediate
    });
    if (global.addEB) global.addEB('环政', '推行 ' + policy.name + (regionId ? '（' + regionId + '）' : '（全国）'));
    return { ok: true, policyId: policyId, name: policy.name, regionId: regionId || 'all', immediate: immediate };
  }

  function _cleanExpiredPolicies(ctx) {
    var E = global.GM.environment;
    if (!E || !E.activePolicies) return;
    E.activePolicies = E.activePolicies.filter(function(p) {
      return (ctx.turn - p.startTurn) < p.duration;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅷ 民心/帑廪/皇威联动
  // ═══════════════════════════════════════════════════════════════════

  function _applyMinxinCoupling(mr) {
    var E = global.GM.environment;
    if (!E) return;
    var G = global.GM;
    // 全国平均疤痕
    var avgScar = 0, n = 0;
    Object.values(E.byRegion).forEach(function(r) {
      SCAR_TYPES.forEach(function(t) { avgScar += r.ecoScars[t] || 0; });
      n += SCAR_TYPES.length;
    });
    avgScar = n > 0 ? avgScar / n : 0;
    // 疤痕高 → 民心降
    if (global._adjAuthority) {
      if (avgScar > 0.5) global._adjAuthority('minxin', -(avgScar - 0.5) * 0.5 * mr);
      else if (avgScar < 0.1) {
        var _mxV = (G.minxin && typeof G.minxin === 'object' ? G.minxin.trueIndex : G.minxin) || 60;
        if (_mxV < 80) global._adjAuthority('minxin', 0.1 * mr);
      }
    }
    // 承载力不足只通过人口、地方不稳和民心反馈，不直接改写皇权。
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AI 上下文
  // ═══════════════════════════════════════════════════════════════════

  function getAIContext() {
    var E = global.GM && global.GM.environment;
    if (!E) return '';
    var lines = ['【环境承载力】'];
    lines.push('全国加载比：' + (E.nationalLoad * 100).toFixed(0) + '% · 气候：' + E.climatePhase);
    // 严重疤痕
    var worstScars = [];
    Object.keys(E.byRegion).forEach(function(rid) {
      var reg = E.byRegion[rid];
      SCAR_TYPES.forEach(function(t) {
        if (reg.ecoScars[t] > 0.5) {
          worstScars.push(rid + ' ' + SCAR_LABELS[t] + ' ' + (reg.ecoScars[t]*100).toFixed(0) + '%');
        }
      });
    });
    if (worstScars.length > 0) lines.push('严重疤痕：' + worstScars.slice(0, 5).join('；'));
    if (E.crisisHistory.length > 0) {
      var recent = E.crisisHistory.filter(function(c) { return (global.GM.turn || 0) - c.turn < ((typeof global.turnsForMonths === 'function') ? global.turnsForMonths(24) : 24); });
      if (recent.length > 0) lines.push('近年危机：' + recent.map(function(c) { return c.name; }).join('、'));
    }
    if (E.activePolicies.length > 0) {
      lines.push('在行环政：' + E.activePolicies.map(function(p) { var pp = ENV_POLICIES.find(function(x){return x.id===p.id;}); return pp ? pp.name : p.id; }).join('、'));
    }
    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  主 tick
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    if (!global.GM || !global.GM.environment) {
      var sc = (typeof global.findScenarioById === 'function') ? global.findScenarioById(global.GM.sid) : null;
      init(sc);
    }
    var mr = ctx.monthRatio || 1;
    try { _tickScarAccumulation(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'env] scars:') : console.error('[env] scars:', e); }
    try { _tickOverloadFeedback(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'env] overload:') : console.error('[env] overload:', e); }
    try { _tickCrisisEvents(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'env] crises:') : console.error('[env] crises:', e); }
    try { _cleanExpiredPolicies(ctx); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-env-capacity-engine');}catch(_){}}
    try { _applyMinxinCoupling(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'env] minxin:') : console.error('[env] minxin:', e); }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.EnvCapacityEngine = {
    init: init,
    tick: tick,
    enactPolicy: enactPolicy,
    getAIContext: getAIContext,
    SCAR_TYPES: SCAR_TYPES,
    SCAR_LABELS: SCAR_LABELS,
    CRISIS_EVENTS: CRISIS_EVENTS,
    TECH_TIERS: TECH_TIERS,
    ENV_POLICIES: ENV_POLICIES,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));

// ───────────────────────────────────────────
// §D·EconomyLinkage (from tm-economy-linkage.js)
// ───────────────────────────────────────────
(function(global) {
  'use strict';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, d) { return (v === undefined || v === null) ? (d || 0) : v; }
  function getMonthRatio() {
    if (typeof _getDaysPerTurn === 'function') return _getDaysPerTurn() / 30;
    return 1;
  }

  // ═════════════════════════════════════════════════════════════
  // 1. 百姓负担层层剥夺模型
  // 设计 §A：peasantActual = nominal × (1 + Σ各级加派)
  // ═════════════════════════════════════════════════════════════

  function ensurePeasantBurden(regionId) {
    if (!GM.fiscal) GM.fiscal = {};
    if (!GM.fiscal.peasantBurden) GM.fiscal.peasantBurden = {};
    if (!GM.fiscal.peasantBurden[regionId]) {
      GM.fiscal.peasantBurden[regionId] = {
        regionId: regionId,
        nominal: 0,
        levyLevels: {
          county:    0,   // 县级加派
          prefecture:0,   // 府级加派
          province:  0,   // 路省级加派
          landlord:  0,   // 豪强吞没
          converter: 0    // 折纳价差
        },
        peasantActual: 0,      // 民间实际负担
        officialReceived: 0,   // 官府实收
        pocketedByLocal: 0,    // 胥吏私肥
        pocketedByLandlord: 0,
        pocketedByConverter: 0
      };
    }
    return GM.fiscal.peasantBurden[regionId];
  }

  function calcPeasantBurden(regionId, nominalTax, mr) {
    mr = mr || 1;
    var b = ensurePeasantBurden(regionId);
    b.nominal = nominalTax;

    // 各级加派率（来自腐败）
    var provincialCorr = safe((GM.corruption && GM.corruption.subDepts.provincial || {}).true, 0);
    var fiscalCorr = safe((GM.corruption && GM.corruption.subDepts.fiscal || {}).true, 0);

    // 层层剥夺率
    var countyLevy     = (provincialCorr / 100) * 0.08 + (GM.fiscal.floatingCollectionRate || 0) * 0.3;
    var prefectureLevy = (provincialCorr / 100) * 0.05;
    var provinceLevy   = (fiscalCorr / 100) * 0.06;
    var landlordCut    = safe((GM.minxin && GM.minxin.byClass && GM.minxin.byClass.haoqiang || {}).size, 0.01) * 4;  // 豪强比例影响
    var converterLoss  = (fiscalCorr / 100) * 0.04;  // 折纳价差

    b.levyLevels.county = countyLevy;
    b.levyLevels.prefecture = prefectureLevy;
    b.levyLevels.province = provinceLevy;
    b.levyLevels.landlord = landlordCut;
    b.levyLevels.converter = converterLoss;

    // 民间实缴 = 名义 × (1 + Σ)
    var totalLevy = countyLevy + prefectureLevy + provinceLevy + landlordCut + converterLoss;
    b.peasantActual = nominalTax * (1 + totalLevy);

    // 官府实收 = 名义 × (1 - 实征漏损)
    var leakage = (provincialCorr + fiscalCorr) / 200 * 0.5;
    b.officialReceived = nominalTax * (1 - leakage);

    // 分配被剥夺部分
    var totalPocket = b.peasantActual - b.officialReceived;
    b.pocketedByLocal = totalPocket * (countyLevy + prefectureLevy + provinceLevy) / Math.max(totalLevy, 0.01) * 0.8;
    b.pocketedByLandlord = totalPocket * landlordCut / Math.max(totalLevy, 0.01);
    b.pocketedByConverter = totalPocket * converterLoss / Math.max(totalLevy, 0.01);

    return b;
  }

  // ═════════════════════════════════════════════════════════════
  // 2. 区域财政树（region.fiscal）
  // ═════════════════════════════════════════════════════════════

  function ensureRegionFiscal(regionId) {
    if (!GM.regions) GM.regions = {};
    if (!GM.regions[regionId]) GM.regions[regionId] = {};
    var r = GM.regions[regionId];
    if (!r.fiscal) r.fiscal = {
      ledgers: {
        money: { stock: 0, lastIn: 0, lastOut: 0 },
        grain: { stock: 0, lastIn: 0, lastOut: 0 }
      },
      allocation: {
        localRetain: 0.3,    // 本级留存比
        upToParent: 0.3,     // 上供父级
        upToCenter: 0.4      // 上供中央（央地系统可覆盖）
      },
      fixed:    [],   // 固定扣项（俸禄/守军/驿站）
      discretionary: 0,  // 地方可自主支出
      imperial: [],   // 央令指派（诏修工程）
      illicit:  0,    // 挪用（入地方官 char）
      parentId: null  // 父级区域
    };
    if (!r.publicTreasury) r.publicTreasury = {
      balance: 0, handoverLog: [], handoverDeficit: 0
    };
    return r;
  }

  function allocateRegionTax(regionId, nominalTax, mr) {
    mr = mr || 1;
    var r = ensureRegionFiscal(regionId);
    var b = calcPeasantBurden(regionId, nominalTax, mr);
    var officialReceived = b.officialReceived;

    var alloc = r.fiscal.allocation;
    var localAmt  = officialReceived * alloc.localRetain;
    var parentAmt = officialReceived * alloc.upToParent;
    var centerAmt = officialReceived * alloc.upToCenter;

    // 本级入账
    r.fiscal.ledgers.money.stock += localAmt;
    r.fiscal.ledgers.money.lastIn = localAmt;

    // 公库也更新
    r.publicTreasury.balance = r.fiscal.ledgers.money.stock;

    // 上供父级
    if (parentAmt > 0 && r.fiscal.parentId) {
      var parent = ensureRegionFiscal(r.fiscal.parentId);
      parent.fiscal.ledgers.money.stock += parentAmt;
    }

    // 上供中央（依皇权可支配性 × 皇威乘数）
    if (centerAmt > 0 && GM.guoku) {
      var h = (GM.huangquan || {}).index || 50;
      var complianceMult = h < 35 ? 0.5 :
                           h < 60 ? 0.85 : 1.0;
      GM.guoku.balance += centerAmt * complianceMult;
    }

    // 记录"挪用流"到 illicit
    r.fiscal.illicit += b.pocketedByLocal * mr;

    return { localAmt: localAmt, parentAmt: parentAmt, centerAmt: centerAmt };
  }

  // ═════════════════════════════════════════════════════════════
  // 3. 下拨生命周期（transferOrder）
  // ═════════════════════════════════════════════════════════════

  function ensureTransferOrderState() {
    if (!GM.transferOrders) GM.transferOrders = [];
  }

  // 玩家诏令 / AI 建议 创建下拨
  function createTransferOrder(spec) {
    ensureTransferOrderState();
    var order = {
      id: 'to_' + GM.turn + '_' + Math.random().toString(36).slice(2, 6),
      fromAccount: spec.fromAccount || 'guoku.money',
      toRegion:    spec.toRegion || null,
      toAccount:   spec.toAccount || 'regional',
      amount:      spec.amount || 0,
      purpose:     spec.purpose || '赈济',
      status:      'pending',
      createTurn:  GM.turn,
      startTurn:   GM.turn + 1,
      expectedEndTurn: GM.turn + ((typeof global.turnsForMonths === 'function') ? global.turnsForMonths(spec.durationMonths || 3) : Math.max(1, Math.floor(spec.durationMonths || 3))),
      deliveredAmount: 0,
      lossRate:    0  // 运输损耗
    };
    GM.transferOrders.push(order);

    // 立即扣源
    if (order.fromAccount === 'guoku.money' && GM.guoku) {
      if (GM.guoku.balance < order.amount) {
        order.status = 'failed';
        order.failReason = '帑廪不足';
        return { success: false, reason: '帑廪不足' };
      }
      GM.guoku.balance -= order.amount;
    } else if (order.fromAccount === 'neitang.money' && GM.neitang) {
      if (GM.neitang.balance < order.amount) {
        order.status = 'failed';
        order.failReason = '内帑不足';
        return { success: false, reason: '内帑不足' };
      }
      GM.neitang.balance -= order.amount;
    }
    return { success: true, order: order };
  }

  function processTransferOrders(mr) {
    ensureTransferOrderState();
    var active = GM.transferOrders.filter(function(o) { return o.status === 'pending' || o.status === 'transit'; });
    active.forEach(function(o) {
      if (GM.turn < o.startTurn) {
        o.status = 'pending';
        return;
      }
      o.status = 'transit';

      // 按期发放（每回合一份）
      var totalTurns = Math.max(1, o.expectedEndTurn - o.startTurn);
      var perTurn = o.amount / totalTurns;
      // 运输损耗（腐败 + 距离）
      var corruptionLoss = safe((GM.corruption && GM.corruption.subDepts.provincial || {}).true, 0) / 100 * 0.15;
      var thisDelivery = perTurn * (1 - corruptionLoss);

      // 交付到目标
      if (o.toRegion) {
        var r = ensureRegionFiscal(o.toRegion);
        r.fiscal.ledgers.money.stock += thisDelivery;
        r.publicTreasury.balance = r.fiscal.ledgers.money.stock;
      }
      o.deliveredAmount += thisDelivery;
      o.lossRate = corruptionLoss;

      if (GM.turn >= o.expectedEndTurn) {
        o.status = 'completed';
        if (typeof addEB === 'function') {
          addEB('朝代', '拨银毕：' + o.purpose + '（' + Math.round(o.deliveredAmount / 10000) + ' 万两）',
            { credibility: 'high' });
        }
      }
    });

    // 清理超老的 completed/failed（保留最近 30）
    var completed = GM.transferOrders.filter(function(o) { return o.status === 'completed' || o.status === 'failed'; });
    if (completed.length > 30) {
      GM.transferOrders = GM.transferOrders.filter(function(o) { return o.status !== 'completed' && o.status !== 'failed'; })
        .concat(completed.slice(-30));
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 4. 俸禄流（财政 → 角色）
  // ═════════════════════════════════════════════════════════════

  function paySalariesToOfficials(mr) {
    var chars = GM.chars || [];
    var totalPaid = 0;
    chars.forEach(function(ch) {
      if (!ch.officialTitle || ch.retired || ch.dead) return;
      if (typeof CharEconEngine === 'undefined') return;
      try {
        var salary = CharEconEngine.Income.salary(ch) * mr;
        if (salary <= 0) return;
        // 从对应账户扣款
        // 中央官 → 帑廪；地方官 → 地方 fiscal；皇室 → 内帑
        var paid = false;
        if (ch.department === 'imperial' && GM.neitang) {
          if (GM.neitang.balance >= salary) {
            GM.neitang.balance -= salary;
            paid = true;
          }
        } else if (ch.currentRegion && GM.regions && GM.regions[ch.currentRegion]) {
          // 地方官从地方留存出
          var r = GM.regions[ch.currentRegion];
          if (r.fiscal && r.fiscal.ledgers.money.stock >= salary) {
            r.fiscal.ledgers.money.stock -= salary;
            r.publicTreasury.balance = r.fiscal.ledgers.money.stock;
            paid = true;
          }
        }
        if (!paid && GM.guoku && GM.guoku.balance >= salary) {
          GM.guoku.balance -= salary;
          paid = true;
        }
        if (paid) {
          CharEconEngine.paySalary(ch, salary);
          totalPaid += salary;
        } else {
          // 欠饷 → 压力 + 腐败倾向
          ch.stress = Math.min(100, (ch.stress || 20) + 2 * mr);
          ch._unpaidMonths = (ch._unpaidMonths || 0) + mr;
          // 欠 3+ 月 → integrity 下降（被迫贪）
          if (ch._unpaidMonths > 3) {
            ch.integrity = Math.max(0, (ch.integrity || 50) - 0.5 * mr);
          }
        }
      } catch(e) {
        console.error('[linkage] paySalary:', ch.name, e);
      }
    });
    if (!GM._linkageStats) GM._linkageStats = {};
    GM._linkageStats.lastSalariesPaid = totalPaid;
  }

  // ═════════════════════════════════════════════════════════════
  // 5. 贪腐流（腐败 → 角色）
  // 在腐败 tick 后，按部门腐败强度推送 illicit 收入到相关角色
  // ═════════════════════════════════════════════════════════════

  function distributeIllicitIncome(mr) {
    if (typeof CharEconEngine === 'undefined') return;
    if (!GM.corruption) return;
    var chars = GM.chars || [];
    chars.forEach(function(ch) {
      if (!ch.officialTitle || ch.retired || ch.dead) return;
      if ((ch.integrity || 50) > 65) return;  // 清官不贪
      try {
        // 从 Income.bribes + Income.embezzle 已在 CharEconEngine 中执行
        // 这里额外添加"地方挪用"流：地方 fiscal.illicit → 地方官
        if (ch.currentRegion && GM.regions && GM.regions[ch.currentRegion]) {
          var r = GM.regions[ch.currentRegion];
          if (r.fiscal && r.fiscal.illicit > 0) {
            var share = r.fiscal.illicit * 0.1 * mr;  // 10% 本月入本官腰包
            if (share > 0) {
              CharEconEngine.addBribeIncome(ch, share, 0.5);
              r.fiscal.illicit -= share;
            }
          }
        }
      } catch(e) {
        console.error('[linkage] illicit:', ch.name, e);
      }
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 6. 抄家触发（从肃贪 / 诛事件）
  // ═════════════════════════════════════════════════════════════

  function triggerConfiscationByName(charName, destination, intensity) {
    var ch = (GM.chars || []).find(function(c) { return c.name === charName; });
    if (!ch) return { success: false, reason: '无此人' };
    if (typeof CharEconEngine === 'undefined') return { success: false, reason: '引擎未就绪' };
    return CharEconEngine.confiscate(ch, {
      destination: destination || 'neitang',
      intensity: intensity !== undefined ? intensity : 0.6,
      includeClan: (intensity || 0) > 0.7
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 7. 事件总线扩展（经济事件）
  // ═════════════════════════════════════════════════════════════

  var EconomyEventBus = {
    _listeners: {},
    on: function(type, handler) {
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(handler);
    },
    emit: function(type, data) {
      (this._listeners[type] || []).forEach(function(h) {
        try { h(data); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'EventBus') : console.error('[EventBus]', type, e); }
      });
    }
  };

  // 预定义事件类型：
  // - qianhuang (钱荒)
  // - confiscation (抄家)
  // - bankruptcy (破产)
  // - reformEnacted (改革颁行)
  // - peasantRevolt (民变)
  // - royalClanBankruptcy (宗室崩溃)

  // ═════════════════════════════════════════════════════════════
  // 8. 主 tick（每回合调用）
  // ═════════════════════════════════════════════════════════════

  function tick(context) {
    var mr = (context && context._monthRatio) || getMonthRatio();
    if (context) context._linkageMonthRatio = mr;

    // 按区域分账（对接财政）
    try {
      // 若有 mapData，按城市/区域分账
      var regions = [];
      if (GM.mapData && GM.mapData.cities) {
        regions = Object.keys(GM.mapData.cities).map(function(id) {
          return { id: id, population: GM.mapData.cities[id].population || 10000 };
        });
      }
      if (regions.length > 0 && GM.guoku) {
        var totalPop = regions.reduce(function(s, r) { return s + r.population; }, 0) || 1;
        var monthlyNominal = (GM.guoku.annualIncome || 1e6) / 12;
        regions.forEach(function(reg) {
          var share = reg.population / totalPop;
          allocateRegionTax(reg.id, monthlyNominal * share, mr);
        });
      }
    } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'linkage] regionAllocation:') : console.error('[linkage] regionAllocation:', e); }

    // 发俸禄
    try { paySalariesToOfficials(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'linkage] salaries:') : console.error('[linkage] salaries:', e); }

    // 贪腐分配
    try { distributeIllicitIncome(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'linkage] illicit:') : console.error('[linkage] illicit:', e); }

    // 下拨单进度
    try { processTransferOrders(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'linkage] transfers:') : console.error('[linkage] transfers:', e); }

    // 民心反馈（基于 peasantBurden 聚合）
    try { applyBurdenToMinxin(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'linkage] burdenMinxin:') : console.error('[linkage] burdenMinxin:', e); }
  }

  // 民心受百姓负担影响
  function applyBurdenToMinxin(mr) {
    if (!GM.minxin || !GM.fiscal || !GM.fiscal.peasantBurden) return;
    var burdens = Object.values(GM.fiscal.peasantBurden);
    if (burdens.length === 0) return;
    // 平均加派率
    var avgLevy = 0;
    burdens.forEach(function(b) {
      var total = (b.levyLevels.county || 0) + (b.levyLevels.prefecture || 0) +
                  (b.levyLevels.province || 0) + (b.levyLevels.landlord || 0) +
                  (b.levyLevels.converter || 0);
      avgLevy += total;
    });
    avgLevy /= burdens.length;

    // 加派 > 0.3 开始显著扣民心
    if (avgLevy > 0.3) {
      var impact = -(avgLevy - 0.3) * 4 * mr;
      GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex + impact);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 导出
  // ═════════════════════════════════════════════════════════════

  global.EconomyLinkage = {
    tick: tick,
    ensurePeasantBurden: ensurePeasantBurden,
    calcPeasantBurden: calcPeasantBurden,
    ensureRegionFiscal: ensureRegionFiscal,
    allocateRegionTax: allocateRegionTax,
    createTransferOrder: createTransferOrder,
    processTransferOrders: processTransferOrders,
    paySalariesToOfficials: paySalariesToOfficials,
    distributeIllicitIncome: distributeIllicitIncome,
    triggerConfiscationByName: triggerConfiscationByName,
    applyBurdenToMinxin: applyBurdenToMinxin,
    EventBus: EconomyEventBus
  };

  // 全局事件总线（其他系统也可用）
  global.EconomyEventBus = EconomyEventBus;

  console.log('[econLinkage] 已加载：层层剥夺+区域财政树+下拨生命周期+俸禄流+贪腐流+抄家触发+事件总线');

})(typeof window !== 'undefined' ? window : this);

// ───────────────────────────────────────────
// §E·EconomyGapFill (from tm-economy-gap-fill.js)
// ───────────────────────────────────────────
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // #2 · 19 种原子税种注册表
  // ═══════════════════════════════════════════════════════════════════

  var ATOMIC_TAX_TYPES = {
    // 田赋类
    land_grain:    { name:'田赋粮', base:'farmland',   unit:'grain', defaultRate:0.10, category:'land' },
    land_money:    { name:'田赋钱', base:'farmland',   unit:'money', defaultRate:0.05, category:'land' },
    // 人口类
    head_tax:      { name:'人头税', base:'population', unit:'money', defaultRate:0.02, category:'head' },
    labor_service: { name:'徭役',   base:'population', unit:'labor', defaultRate:0.05, category:'head' },
    // 专卖类
    salt:          { name:'盐课',   base:'population', unit:'money', defaultRate:0.03, category:'monopoly' },
    iron:          { name:'铁课',   base:'trade',      unit:'money', defaultRate:0.02, category:'monopoly' },
    tea:           { name:'茶课',   base:'trade',      unit:'money', defaultRate:0.015, category:'monopoly' },
    wine:          { name:'酒课',   base:'trade',      unit:'money', defaultRate:0.02, category:'monopoly' },
    // 商税类
    commerce:      { name:'商税',   base:'tradeVolume',unit:'money', defaultRate:0.03, category:'commerce' },
    transit:       { name:'过关税', base:'tradeVolume',unit:'money', defaultRate:0.02, category:'commerce' },
    import_export: { name:'市舶',   base:'tradeVolume',unit:'money', defaultRate:0.05, category:'commerce', dynasties:['宋','元','明','清'] },
    // 政府类
    mint_seigniorage: { name:'铸币利润', base:'mint',  unit:'money', defaultRate:0,    category:'gov' },
    monopoly_profit:  { name:'专卖利润', base:'monopoly',unit:'money',defaultRate:0,    category:'gov' },
    // 特殊
    office_sale:   { name:'捐纳',    base:'event',     unit:'money', defaultRate:0,    category:'special' },
    confiscation:  { name:'抄家',    base:'event',     unit:'money', defaultRate:0,    category:'special' },
    tribute:       { name:'朝贡',    base:'event',     unit:'mixed', defaultRate:0,    category:'special' },
    military_levy: { name:'军粮征发',base:'event',     unit:'grain', defaultRate:0,    category:'special' },
    special_exaction:  { name:'特别加派', base:'farmland', unit:'money',defaultRate:0, category:'special' },
    disaster_levy: { name:'灾害特赋',base:'farmland',  unit:'money', defaultRate:0,    category:'special' }
  };

  /** 按朝代过滤可用税种 */
  function getAvailableTaxTypes(dynasty) {
    var out = [];
    Object.keys(ATOMIC_TAX_TYPES).forEach(function(id) {
      var t = ATOMIC_TAX_TYPES[id];
      if (t.dynasties && t.dynasties.indexOf(dynasty) < 0) return;
      out.push(Object.assign({ id: id }, t));
    });
    return out;
  }

  /** 计算单税种应征额 */
  function calculateTaxRevenue(taxId, regionCtx) {
    var t = ATOMIC_TAX_TYPES[taxId];
    if (!t) return 0;
    var base = 0;
    if (t.base === 'farmland') base = regionCtx.farmland || 1000000;
    else if (t.base === 'population') base = regionCtx.population || 100000;
    else if (t.base === 'trade' || t.base === 'tradeVolume') base = regionCtx.tradeVolume || 50000;
    else if (t.base === 'mint') return (regionCtx.mintSeigniorage || 0);
    else if (t.base === 'monopoly') return (regionCtx.monopolyProfit || 0);
    else return 0;
    return base * (regionCtx.rateOverride || t.defaultRate);
  }

  // ═══════════════════════════════════════════════════════════════════
  // #1 · 购买力系数传播（API 供各引擎调用）
  // ═══════════════════════════════════════════════════════════════════

  /** 返回当前主币的实际购买力系数（1.0 = 正常，<1 = 通胀/成色降级）*/
  function getPurchasingPower(coinType) {
    var C = global.GM && global.GM.currency;
    if (!C) return 1.0;
    coinType = coinType || (C.currentStandard && C.currentStandard.indexOf('silver') >= 0 ? 'silver' : 'copper');
    var l = C.coins[coinType];
    if (!l) return 1.0;
    var base = l.purchasingPowerFactor || 1.0;
    // 叠加通胀因子
    var inflation = (C.market && C.market.inflation) || 0;
    var factor = base / (1 + inflation);
    return Math.max(0.1, Math.min(2.0, factor));
  }

  /** 将名义金额换算为实际购买力 */
  function getRealValue(nominal, coinType) {
    return (nominal || 0) * getPurchasingPower(coinType);
  }

  /** 将实际购买力换算为名义金额（用于俸禄按真实需求发放）*/
  function fromRealValue(real, coinType) {
    var pp = getPurchasingPower(coinType);
    return pp > 0 ? (real / pp) : real;
  }

  function _flattenDivisions(nodes, out) {
    out = out || [];
    if (!Array.isArray(nodes)) return out;
    nodes.forEach(function(node) {
      if (!node || typeof node !== 'object') return;
      out.push(node);
      _flattenDivisions(node.children || node.subs || node.divisions, out);
    });
    return out;
  }

  function _getRegionsArray(source) {
    source = source || {};
    if (global.IntegrationBridge && typeof global.IntegrationBridge.getDivisionArray === 'function') {
      var bridged = global.IntegrationBridge.getDivisionArray(source);
      if (bridged && bridged.length) return bridged;
    }
    if (Array.isArray(source.regions)) return source.regions;
    if (source.regions && typeof source.regions === 'object') return Object.values(source.regions);
    if (source.adminHierarchy && typeof source.adminHierarchy === 'object') {
      var out = [];
      Object.keys(source.adminHierarchy).forEach(function(key) {
        var tree = source.adminHierarchy[key];
        if (Array.isArray(tree)) _flattenDivisions(tree, out);
        else if (tree && Array.isArray(tree.divisions)) _flattenDivisions(tree.divisions, out);
        else if (tree && Array.isArray(tree.children)) _flattenDivisions(tree.children, out);
      });
      return out;
    }
    return [];
  }

  // ═══════════════════════════════════════════════════════════════════
  // #3 · 地域币值每回合动态（纸币接受度）
  // ═══════════════════════════════════════════════════════════════════

  function tickRegionalAcceptance(ctx, mr) {
    var C = global.GM && global.GM.currency;
    if (!C || !C.paper || !C.paper.issuances) return;
    C.paper.issuances.forEach(function(iss) {
      if (iss.state === 'abolish' || iss.state === 'collapse') return;
      var byReg = iss.acceptanceByRegion || (iss.acceptanceByRegion = {});
      // 对每个区域微调
      var regions = _getRegionsArray(global.GM);
      regions.forEach(function(reg) {
        if (!reg || !reg.id) return;
        var a = byReg[reg.id];
        if (a === undefined) a = (reg.id === (global.GM._capital || '京城')) ? 1.0 : 0.7;
        // 纸币状态坏 → 接受度降；准备金高 → 升
        if (iss.state === 'depreciate') a -= 0.02 * mr;
        else if (iss.state === 'overissue') a -= 0.01 * mr;
        else if (iss.reserveRatio > 0.3) a += 0.005 * mr;
        // 距京师远近（用 region.distanceFromCapital 若有）
        if (reg.distanceFromCapital > 2000) a -= 0.002 * mr;
        // unrest/战乱拒用
        if (reg.unrest > 70) a -= 0.01 * mr;
        byReg[reg.id] = Math.max(0, Math.min(1, a));
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // #4 · 地域价差套利（商贸流）
  // ═══════════════════════════════════════════════════════════════════

  function tickTradeArbitrage(ctx, mr) {
    var C = global.GM && global.GM.currency;
    if (!C || !C.market) return;
    var regions = _getRegionsArray(global.GM);
    if (!regions || !Array.isArray(regions) || regions.length < 2) return;
    // 每区生成本地粮价（若无）
    var rp = C.market.regionalPrices || (C.market.regionalPrices = {});
    regions.forEach(function(r) {
      if (!r || !r.id) return;
      if (!rp[r.id]) rp[r.id] = { grain: C.market.grainPrice, cloth: C.market.clothPrice, salt: C.market.saltPrice, iron: C.market.ironPrice, coinPremium: { gold:1.0, silver:1.0, copper:1.0, iron:1.0, paper:1.0 } };
      // 本地价格浮动（年景 × 灾害 × 军需）
      var local = rp[r.id];
      var localFactor = 1.0;
      if (r.disasterLevel > 0.2) localFactor *= (1 + r.disasterLevel * 0.5);
      if (r.unrest > 60) localFactor *= 1.1;
      if (r.warThreat > 0.3) localFactor *= (1 + r.warThreat * 0.3);
      if (r.grainSurplus > 0) localFactor *= 0.9; // 丰产地
      local.grain = C.market.grainPrice * localFactor;
    });
    // 两区套利（简化：价差 > 成本 → 流）
    if (regions.length > 10) return; // 大规模场景简化跳过
    for (var i = 0; i < regions.length; i++) {
      for (var j = i + 1; j < regions.length; j++) {
        var r1 = regions[i], r2 = regions[j];
        if (!rp[r1.id] || !rp[r2.id]) continue;
        var p1 = rp[r1.id].grain, p2 = rp[r2.id].grain;
        var gap = Math.abs(p2 - p1);
        var transportCost = (50 + (r1.distance && r2.distance ? Math.abs(r1.distance - r2.distance) * 0.1 : 20)) * (1 + (r1.banditry || 0));
        if (gap > transportCost * 2) {
          // 商贸自动流动：低价→高价
          var flowFactor = (gap - transportCost) / gap * 0.05 * mr;
          var src = p1 < p2 ? r1 : r2;
          var dst = p1 < p2 ? r2 : r1;
          // 价差缩窄
          rp[src.id].grain = p1 < p2 ? p1 + gap * 0.02 * mr : p2 + gap * 0.02 * mr;
          rp[dst.id].grain = p1 < p2 ? p2 - gap * 0.02 * mr : p1 - gap * 0.02 * mr;
          // 商税入帑廪
          if (global.GM.guoku && global.GM.guoku.money !== undefined) {
            var tax = flowFactor * 100;
            global.GM.guoku.money = (global.GM.guoku.money || 0) + tax;
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // #5 · 四层自适应递归生成
  // ═══════════════════════════════════════════════════════════════════

  function buildHierarchyFromAdminDepth(sc) {
    if (!sc) return null;
    var depth = (sc.adminHierarchy && sc.adminHierarchy.depth) || 3;
    var levelNames = (sc.adminHierarchy && sc.adminHierarchy.levelNames) || ['道','州','县'];
    var regions = _getRegionsArray(sc);
    if (!regions.length && global.GM) regions = _getRegionsArray(global.GM);
    // 建立 id → level 映射
    var byId = {};
    regions.forEach(function(r) { if (r && r.id) byId[r.id] = r; });
    // 递归补 level
    regions.forEach(function(r) {
      if (r.level === undefined) {
        var lv = 0;
        var cur = r;
        while (cur && cur.parentId && byId[cur.parentId]) {
          lv++;
          cur = byId[cur.parentId];
          if (lv > 6) break;
        }
        r.level = lv;
      }
    });
    return { depth: depth, levelNames: levelNames, byId: byId };
  }

  // ═══════════════════════════════════════════════════════════════════
  // #6 · 封建财政 5 类完整实现
  // ═══════════════════════════════════════════════════════════════════

  function _isYearBoundaryTurn(turn) {
    if (typeof global.isYearBoundary === 'function') return global.isYearBoundary(turn);
    var dpv = (typeof global._getDaysPerTurn === 'function') ? global._getDaysPerTurn() : 30;
    if (dpv >= 365) return true;
    turn = Number(turn || 0);
    return turn > 0 && Math.floor(turn * dpv / 365) > Math.floor((turn - 1) * dpv / 365);
  }

  function _yearFromTurn(turn) {
    if (typeof global.calcDateFromTurn === 'function') return global.calcDateFromTurn(turn || 1).adYear;
    if (typeof global.getCurrentYear === 'function') return global.getCurrentYear();
    var dpv = (typeof global._getDaysPerTurn === 'function') ? global._getDaysPerTurn() : 30;
    var baseYear = (global.P && global.P.time && typeof global.P.time.year === 'number') ? global.P.time.year : 0;
    return baseYear + Math.floor(((turn || 1) - 1) * dpv / 365);
  }

  var FEUDAL_TYPES = {
    vassal_prince: {
      name: '诸侯王',
      description: '汉初分封王国，自有军队、财政，可铸钱',
      rules: {
        centralShare: 0.10,     // 上缴中央比例
        canMintCoin: true,
        canRaiseArmy: true,
        autonomyLevel: 0.75,
        inheritable: true,
        reducesBy: 'tuien_ling'  // 推恩令削弱
      },
      tick: function(holding, mr) {
        var annual = (holding.annualRevenue || 100000) * mr / 12;
        // 中央只拿 10%
        if (global.GM.guoku) global.GM.guoku.money = (global.GM.guoku.money || 0) + annual * 0.10;
        // 其余入王府
        holding.vassalWealth = (holding.vassalWealth || 0) + annual * 0.90;
      }
    },
    tusi: {
      name: '土司',
      description: '西南世袭土官，朝贡代税',
      rules: {
        centralShare: 0.05,
        tributeAnnual: true,
        canMintCoin: false,
        canRaiseArmy: true,
        autonomyLevel: 0.85,
        inheritable: true,
        reducesBy: 'gaitu_guiliu'
      },
      tick: function(holding, mr) {
        var tribute = (holding.tributeValue || 20000) * mr / 12;
        if (global.GM.guoku) {
          global.GM.guoku.money = (global.GM.guoku.money || 0) + tribute * 0.3;
          global.GM.guoku.grain = (global.GM.guoku.grain || 0) + tribute * 0.5;
        }
      }
    },
    fan_vassal: {
      name: '外藩',
      description: '朝鲜/越南/琉球等属国，仅朝贡',
      rules: {
        centralShare: 0,
        tributeAnnual: true,
        canMintCoin: true,
        canRaiseArmy: true,
        autonomyLevel: 1.0,
        inheritable: true
      },
      tick: function(holding, mr) {
        // 一年一贡
        if (!_isYearBoundaryTurn(global.GM.turn || 0)) return;
        var tribute = holding.tributeValue || 50000;
        if (global.GM.guoku) global.GM.guoku.money = (global.GM.guoku.money || 0) + tribute;
        if (global.addEB) global.addEB('外藩', (holding.name || '外藩') + ' 来朝进贡 ' + tribute + ' 两');
      }
    },
    religious: {
      name: '寺院庄园',
      description: '佛寺道观免税产业',
      rules: {
        centralShare: 0,
        taxExempt: true,
        canMintCoin: false,
        canRaiseArmy: false,
        autonomyLevel: 0.5,
        inheritable: false,
        reducesBy: 'huichang_miefo' // 会昌灭佛
      },
      tick: function(holding, mr) {
        holding.templeWealth = (holding.templeWealth || 0) + (holding.annualRevenue || 30000) * mr / 12;
        // 过度积累 → 朝廷警觉
        if (holding.templeWealth > 5000000) {
          holding._triggered = true;
        }
      }
    },
    fief: {
      name: '食邑',
      description: '功臣食邑，按户赐予',
      rules: {
        centralShare: 0.80,    // 大部分仍归中央
        taxExempt: false,      // 税依然交，只是税后分一部分给受封者
        canMintCoin: false,
        canRaiseArmy: false,
        autonomyLevel: 0.1,
        inheritable: true
      },
      tick: function(holding, mr) {
        var revenue = (holding.householdCount || 1000) * 2 * mr / 12; // 每户每年 2 两
        if (global.GM.guoku) global.GM.guoku.money = (global.GM.guoku.money || 0) + revenue * 0.8;
        // 受封者所得——记入角色 privateWealth
        if (holding.holderName && global.GM.chars) {
          var ch = global.GM.chars.find(function(c) { return c.name === holding.holderName; });
          if (ch && ch.resources && ch.resources.privateWealth) {
            ch.resources.privateWealth.cash = (ch.resources.privateWealth.cash || 0) + revenue * 0.2;
          }
        }
      }
    }
  };

  function tickFeudalHoldings(ctx, mr) {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.feudalHoldings) return;
    G.fiscal.feudalHoldings.forEach(function(holding) {
      var type = FEUDAL_TYPES[holding.type];
      if (!type || !type.tick) return;
      try { type.tick(holding, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'feudal') : console.error('[feudal]', holding.type, e); }
    });
  }

  function createFeudalHolding(spec) {
    var G = global.GM;
    if (!G.fiscal) G.fiscal = {};
    if (!G.fiscal.feudalHoldings) G.fiscal.feudalHoldings = [];
    var type = FEUDAL_TYPES[spec.type];
    if (!type) return null;
    var holding = Object.assign({
      id: 'feudal_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
      createdAt: G.turn || 0
    }, spec);
    G.fiscal.feudalHoldings.push(holding);
    if (global.addEB) global.addEB('封建', '新封 ' + type.name + '：' + (spec.name || '无名'));
    return holding;
  }

  // ═══════════════════════════════════════════════════════════════════
  // #7 · 虚报差额（revenueClaimed vs revenueActual）
  // ═══════════════════════════════════════════════════════════════════

  function tickOverstatement(ctx, mr) {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.regions) return;
    Object.keys(G.fiscal.regions).forEach(function(rid) {
      var rf = G.fiscal.regions[rid];
      if (!rf) return;
      if (!rf.annualReport) rf.annualReport = { revenueClaimed: 0, revenueActual: 0, collected: 0 };
      if (!rf.annualReport.revenueClaimed) rf.annualReport.revenueClaimed = 0;
      if (!rf.annualReport.revenueActual) rf.annualReport.revenueActual = 0;
      if (typeof rf.overstatement !== 'number') rf.overstatement = 0;
      // 虚报——每回合按 overstatement 虚增已征数字（上报）
      var actual = rf.annualReport.collected || 0;
      var claimed = actual * (1 + rf.overstatement);
      rf.annualReport.revenueActual = actual;
      rf.annualReport.revenueClaimed = claimed;
      // overstatement 动态（官员弱势 → 不敢虚报；官员强势 → 敢虚报）
      var official = rf.governingOfficial && G.chars ? G.chars.find(function(c) { return c.name === rf.governingOfficial; }) : null;
      if (official) {
        var integrity = official.integrity || 60;
        if (integrity > 70) rf.overstatement = Math.max(0, rf.overstatement - 0.005 * mr);
        else if (integrity < 40) rf.overstatement = Math.min(0.3, rf.overstatement + 0.01 * mr);
      }
      // 监察查出 → 重置
      var lastAudit = G.fiscal.auditSystem && G.fiscal.auditSystem.lastAuditedByRegion[rid] || -999;
      if (G.turn - lastAudit < ((typeof global.turnsForMonths === 'function') ? global.turnsForMonths(3) : 3)) rf.overstatement = Math.max(0, rf.overstatement - 0.03);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // #8 · 土地兼并动态事件
  // ═══════════════════════════════════════════════════════════════════

  function tickLandAnnexation(ctx, mr) {
    var G = global.GM;
    if (!G) return;
    if (!G.landAnnexation) {
      G.landAnnexation = { concentration: 0.3, trend: 0, crisisLevel: 0, history: [] };
    }
    var la = G.landAnnexation;
    var pop = (G.vars && G.vars.pop) || 1000000;
    var farmland = (G.vars && G.vars.farmland) || 10000000;
    // 贪官/权贵兼并
    var greedyOfficials = (G.chars || []).filter(function(c) {
      if (c.alive === false) return false;
      if (!c.resources) return false;
      var landVal = c.resources.privateWealth && c.resources.privateWealth.land || 0;
      return landVal > 100000;
    }).length;
    // 兼并率增长
    var growth = greedyOfficials / Math.max(1, (G.chars || []).length) * 0.005 * mr;
    // 政策压制
    if (G.policies && G.policies.landReform) growth -= 0.01 * mr;
    var _hqG = (G.huangquan && typeof G.huangquan === 'object') ? (G.huangquan.index || 50) : (G.huangquan || 50);
    if (_hqG > 70) growth -= 0.005 * mr;
    la.trend = growth;
    la.concentration = Math.max(0.1, Math.min(0.95, la.concentration + growth));
    // 危机等级
    var newCrisis = 0;
    if (la.concentration > 0.75) newCrisis = 3; // 严重
    else if (la.concentration > 0.6) newCrisis = 2; // 显著
    else if (la.concentration > 0.45) newCrisis = 1; // 轻度
    // 状态跃迁 → 事件
    if (newCrisis > la.crisisLevel) {
      _emitLandEvent(newCrisis);
    }
    la.crisisLevel = newCrisis;
    // 影响：兼并高 → 税基缩水、民变风险
    if (la.concentration > 0.6) {
      // 税基缩水：自耕农比例降
      if (G.vars) G.vars.effectiveTaxBase = farmland * (1 - la.concentration * 0.5);
      // 民心降
      if (global._adjAuthority) global._adjAuthority('minxin', -0.2 * mr);
      // 起义风险
      if (typeof G.rebellionRisk === 'number') G.rebellionRisk += la.concentration * 0.3 * mr;
    }
    // 历史
    if (_isYearBoundaryTurn(ctx.turn || G.turn || 0)) {
      la.history.push({ year: G.year || _yearFromTurn(ctx.turn || G.turn || 1), concentration: +la.concentration.toFixed(3) });
      if (la.history.length > 30) la.history.splice(0, la.history.length - 30);
    }
  }

  function _emitLandEvent(level) {
    var msg = level === 3 ? '土地兼并极为严重，大量自耕农沦为佃户流民'
            : level === 2 ? '土地兼并加剧，地方豪强坐大'
            : '土地兼并初显征兆，贫富分化渐深';
    if (global.addEB) global.addEB('土地', msg);
    if (global.EconomyEventBus && typeof global.EconomyEventBus.emit === 'function') {
      global.EconomyEventBus.emit('fiscal.land_annexation', { level: level });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // #9 · 借贷捐输系统
  // ═══════════════════════════════════════════════════════════════════

  function initLendingSystem() {
    var G = global.GM;
    if (!G.fiscal) G.fiscal = {};
    if (!G.fiscal.loans) G.fiscal.loans = { outstanding: [], history: [], totalPrincipal: 0, totalInterestPaid: 0 };
    if (!G.fiscal.donations) G.fiscal.donations = { history: [], totalReceived: 0 };
  }

  /** 发起借贷（向商人/宗室/家族借钱）*/
  function borrowFrom(source, amount, termMonths, interestRate) {
    initLendingSystem();
    var G = global.GM;
    var loan = {
      id: 'loan_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
      source: source || '商人联保',
      principal: amount,
      remaining: amount,
      interestRate: interestRate !== undefined ? interestRate : 0.05, // 月利
      termMonths: termMonths || 12,
      startTurn: G.turn || 0,
      paid: 0,
      defaulted: false
    };
    G.fiscal.loans.outstanding.push(loan);
    G.fiscal.loans.totalPrincipal += amount;
    // 入帑廪
    if (G.guoku) G.guoku.money = (G.guoku.money || 0) + amount;
    if (global.addEB) global.addEB('借贷', '向 ' + loan.source + ' 借 ' + _fmtNum(amount) + ' 贯，月息 ' + (loan.interestRate*100).toFixed(1) + '%');
    return loan;
  }

  /** 接受捐输 */
  function acceptDonation(donor, amount, category) {
    initLendingSystem();
    var G = global.GM;
    var don = {
      id: 'don_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
      donor: donor || '无名',
      amount: amount,
      category: category || 'general',
      turn: G.turn || 0
    };
    G.fiscal.donations.history.push(don);
    G.fiscal.donations.totalReceived += amount;
    if (G.guoku) G.guoku.money = (G.guoku.money || 0) + amount;
    // 捐输者名望增
    if (global.GM.chars) {
      var ch = global.GM.chars.find(function(c) { return c.name === donor; });
      if (ch && typeof global.CharEconEngine !== 'undefined' && global.CharEconEngine.adjustFame) {
        global.CharEconEngine.adjustFame(ch, Math.min(10, amount / 10000), '捐输国库');
      }
    }
    if (global.addEB) global.addEB('捐输', (donor||'义民') + ' 捐 ' + _fmtNum(amount) + ' 贯');
    return don;
  }

  /** 每回合还贷 */
  function tickLoans(ctx, mr) {
    initLendingSystem();
    var G = global.GM;
    var repaid = [];
    G.fiscal.loans.outstanding.forEach(function(loan) {
      if (loan.defaulted) return;
      var monthInterest = loan.remaining * loan.interestRate * mr;
      var elapsedTurns = (G.turn || 0) - loan.startTurn;
      var dpt = (typeof global._getDaysPerTurn === 'function') ? global._getDaysPerTurn() : 30;
      var monthsElapsed = elapsedTurns * dpt / 30;
      var monthsLeft = loan.termMonths - monthsElapsed;
      var principalPay = monthsLeft > 0 ? (loan.remaining / monthsLeft) * mr : loan.remaining;
      var totalPay = monthInterest + principalPay;
      // 帑廪不足 → 违约
      if (!G.guoku || (G.guoku.money || 0) < totalPay) {
        loan.defaulted = true;
        if (global.addEB) global.addEB('借贷', '违约：' + loan.source + ' 借款（尚欠 ' + _fmtNum(loan.remaining) + '）');
        // 触发事件
        if (global.EconomyEventBus && typeof global.EconomyEventBus.emit === 'function') {
          global.EconomyEventBus.emit('fiscal.loan_default', { loan: loan });
        }
        // 违约 → 皇威降
        if (global._adjAuthority) global._adjAuthority('huangwei', -5);
        return;
      }
      G.guoku.money -= totalPay;
      loan.paid += totalPay;
      loan.remaining -= principalPay;
      G.fiscal.loans.totalInterestPaid += monthInterest;
      if (loan.remaining < 0.01) {
        repaid.push(loan.id);
        if (global.addEB) global.addEB('借贷', '已偿：' + loan.source + ' 借款（付息共 ' + _fmtNum(loan.paid - loan.principal) + '）');
      }
    });
    // 移除已还贷
    G.fiscal.loans.outstanding = G.fiscal.loans.outstanding.filter(function(l) { return repaid.indexOf(l.id) < 0 && !l.defaulted; });
  }

  // ═══════════════════════════════════════════════════════════════════
  // #10 · 官员为政口碑累计（char.governance）
  // ═══════════════════════════════════════════════════════════════════

  function ensureGovernance(ch) {
    if (!ch.governance) {
      ch.governance = {
        regionHeld: null,
        tenureStart: null,
        tenureEnd: null,
        publicWorksContrib: 0,
        disasterReliefContrib: 0,
        educationContrib: 0,
        militaryPrepContrib: 0,
        embezzlementTotal: 0,
        reputationLocal: 0.5,
        reputationCentral: 0.5,
        performanceScore: 0
      };
    }
    return ch.governance;
  }

  /** 把一笔支出累计到官员口碑 */
  function attributeExpenditure(ch, expenditureType, amount) {
    if (!ch) return;
    var g = ensureGovernance(ch);
    var typeMap = {
      disaster_relief: 'disasterReliefContrib',
      public_works_water: 'publicWorksContrib',
      public_works_road: 'publicWorksContrib',
      public_works_wall: 'publicWorksContrib',
      education: 'educationContrib',
      military_prep: 'militaryPrepContrib',
      embezzlement: 'embezzlementTotal'
    };
    var key = typeMap[expenditureType];
    if (key) {
      g[key] = (g[key] || 0) + amount;
    }
    // 口碑演化
    if (expenditureType === 'embezzlement') {
      g.reputationLocal = Math.max(0, g.reputationLocal - amount / 200000);
      g.reputationCentral = Math.max(0, g.reputationCentral - amount / 300000);
    } else if (expenditureType === 'disaster_relief' || expenditureType === 'public_works_water') {
      g.reputationLocal = Math.min(1, g.reputationLocal + amount / 300000);
    } else if (expenditureType === 'courtship_capital') {
      g.reputationCentral = Math.min(1, g.reputationCentral + amount / 150000);
    }
    // 绩效综合分
    g.performanceScore = Math.round(
      (g.publicWorksContrib + g.disasterReliefContrib + g.educationContrib + g.militaryPrepContrib) / 10000
      - g.embezzlementTotal / 5000
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // #11 · 廷议 2.0 改革联动
  // ═══════════════════════════════════════════════════════════════════

  /** 将货币或央地改革发起为廷议题目 */
  function submitReformToTinyi(reformType, reformId, description) {
    var G = global.GM;
    if (!G._pendingTinyiTopics) G._pendingTinyiTopics = [];
    var presetName = '';
    if (reformType === 'currency' && global.CurrencyEngine) {
      var p = (global.CurrencyEngine.REFORM_PRESETS || []).find(function(r) { return r.id === reformId; });
      if (p) presetName = p.name;
    } else if (reformType === 'central_local' && global.CentralLocalEngine) {
      var p2 = (global.CentralLocalEngine.REFORM_PRESETS || []).find(function(r) { return r.id === reformId; });
      if (p2) presetName = p2.name;
    }
    var topic = '【' + (reformType === 'currency' ? '货币改革' : '央地改革') + '】' + (presetName || reformId) + (description ? '：' + description : '');
    G._pendingTinyiTopics.push({
      topic: topic,
      from: '财政改革',
      turn: G.turn || 0,
      reformType: reformType,
      reformId: reformId,
      _economyReform: true
    });
    if (global.addEB) global.addEB('廷议', '已付廷议：' + (presetName || reformId));
    if (global.toast) global.toast('改革议案已入廷议待议');
    return true;
  }

  /** 廷议表决完成后的回调（若廷议系统已钩子） */
  function onTinyiDecision(topicItem, decision) {
    if (!topicItem || !topicItem._economyReform) return;
    var approved = decision === 'approve';
    if (topicItem.reformType === 'currency' && global.CurrencyEngine) {
      global.CurrencyEngine.applyReform(topicItem.reformId, { forceSuccess: approved });
    } else if (topicItem.reformType === 'central_local' && global.CentralLocalEngine) {
      global.CentralLocalEngine.applyReform(topicItem.reformId, { forceSuccess: approved });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // #12 · 强征 compliance 惩罚
  // ═══════════════════════════════════════════════════════════════════

  /** 向某区域强征（严厉下拨逆向）*/
  function forceLevy(regionId, amount, reason) {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.regions) return { ok: false };
    var rf = G.fiscal.regions[regionId];
    if (!rf) return { ok: false };
    var region = _getRegionsArray(G).find(function(r) { return r.id === regionId; });
    var realAmount = Math.min(amount, (rf.ledgers.money || 0) + amount * 0.5); // 最多搜刮到本地留存 + 强拿 50%
    rf.ledgers.money = Math.max(0, rf.ledgers.money - realAmount);
    if (G.guoku) G.guoku.money = (G.guoku.money || 0) + realAmount * 0.8; // 20% 损耗
    // 合规率重挫
    rf.compliance = Math.max(0.05, rf.compliance - 0.2);
    // 连续强征计数
    rf._recentForceLevyCount = (rf._recentForceLevyCount || 0) + 1;
    if (rf._recentForceLevyCount >= 2) {
      rf.compliance = Math.max(0.05, rf.compliance - 0.2); // 追加 -0.2
      rf.autonomyLevel = Math.min(1.0, rf.autonomyLevel + 0.15);
    }
    // 区域 unrest 大涨
    if (region) {
      region.unrest = Math.min(100, (region.unrest || 30) + 15);
      region.disasterLevel = Math.min(1, (region.disasterLevel || 0) + 0.05); // 准灾
    }
    // 民心降
    if (global._adjAuthority) global._adjAuthority('minxin', -3);
    if (global.addEB) global.addEB('强征', (regionId||'某地') + ' 强征 ' + _fmtNum(realAmount) + ' 贯' + (reason ? '（' + reason + '）' : ''));
    if (global.EconomyEventBus && typeof global.EconomyEventBus.emit === 'function') {
      global.EconomyEventBus.emit('central_local.force_levy', { regionId: regionId, amount: realAmount, newCompliance: rf.compliance });
    }
    return { ok: true, actualAmount: realAmount, newCompliance: rf.compliance };
  }

  /** 每年重置 recent force levy 计数 */
  function _resetForceLevyCounts() {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.regions) return;
    Object.keys(G.fiscal.regions).forEach(function(rid) {
      G.fiscal.regions[rid]._recentForceLevyCount = 0;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  主 tick（插入 endTurn 经济阶段末尾）
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    try { tickRegionalAcceptance(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'gapfill] regAcc:') : console.error('[gapfill] regAcc:', e); }
    try { tickTradeArbitrage(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'gapfill] arb:') : console.error('[gapfill] arb:', e); }
    try { tickFeudalHoldings(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'gapfill] feudal:') : console.error('[gapfill] feudal:', e); }
    try { tickOverstatement(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'gapfill] overstatement:') : console.error('[gapfill] overstatement:', e); }
    try { tickLandAnnexation(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'gapfill] land:') : console.error('[gapfill] land:', e); }
    try { tickLoans(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'gapfill] loans:') : console.error('[gapfill] loans:', e); }
    // 年度重置
    var isNewYear = _isYearBoundaryTurn(global.GM.turn || 0);
    if (isNewYear) { try { _resetForceLevyCounts(); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-economy-gap-fill');}catch(_){}} }
  }

  function _fmtNum(v) {
    v = Math.abs(v || 0);
    if (v >= 10000) return (v/10000).toFixed(1) + '万';
    return Math.round(v).toLocaleString();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  钩入央地 executeLocalActions 以触发 governance 累计
  // ═══════════════════════════════════════════════════════════════════

  function _patchCentralLocalForGovernance() {
    if (typeof global.CentralLocalEngine === 'undefined') return;
    if (global.CentralLocalEngine._gapfillPatched) return;
    var origExec = global.CentralLocalEngine.executeLocalActions;
    if (typeof origExec !== 'function') return;
    global.CentralLocalEngine.executeLocalActions = function(las) {
      origExec(las);
      // 累计到官员 governance
      (las || []).forEach(function(la) {
        var G = global.GM;
        var rf = G.fiscal && G.fiscal.regions[la.regionId];
        if (!rf) return;
        var officialName = la.proposer || rf.governingOfficial;
        var ch = (G.chars || []).find(function(c) { return c.name === officialName; });
        if (!ch) return;
        ensureGovernance(ch);
        ch.governance.regionHeld = la.regionId;
        if (!ch.governance.tenureStart) ch.governance.tenureStart = G.turn || 0;
        la.actions.forEach(function(act) {
          attributeExpenditure(ch, act.type, act.amount);
        });
      });
    };
    global.CentralLocalEngine._gapfillPatched = true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  钩入 paySalary 以应用购买力系数（实值 vs 名义）
  // ═══════════════════════════════════════════════════════════════════

  function _patchPaySalaryForPurchasingPower() {
    if (typeof global.CharEconEngine === 'undefined') return;
    if (global.CharEconEngine._gapfillPatched) return;
    var orig = global.CharEconEngine.paySalary;
    if (typeof orig !== 'function') return;
    global.CharEconEngine.paySalary = function(ch, nominal) {
      // 实值 = 名义 × 购买力系数
      var pp = getPurchasingPower();
      var real = (nominal || 0) * pp;
      // 记录通胀损失
      if (ch && ch.resources) {
        ch.resources._recentSalaryReal = real;
        ch.resources._recentSalaryNominal = nominal;
        ch.resources._purchasingPowerLoss = (ch.resources._purchasingPowerLoss || 0) + Math.max(0, (nominal - real));
      }
      return orig(ch, nominal);
    };
    global.CharEconEngine._gapfillPatched = true;
  }

  // 初始化阶段自动应用补丁
  function init() {
    _patchCentralLocalForGovernance();
    _patchPaySalaryForPurchasingPower();
    initLendingSystem();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  function formulaEstimateWealth(dynasty, classKey, rank) {
    var basePool = {
      imperial:        { cash: 1000000, land: 200000, treasure: 100000, slaves: 1000 },
      noble:           { cash: 200000,  land: 50000,  treasure: 20000,  slaves: 100 },
      civilOfficial:   { cash: 50000,   land: 10000,  treasure: 5000,   slaves: 20 },
      militaryOfficial:{ cash: 30000,   land: 20000,  treasure: 3000,   slaves: 30 },
      merchant:        { cash: 300000,  land: 5000,   treasure: 30000,  slaves: 10 },
      landlord:        { cash: 20000,   land: 30000,  treasure: 2000,   slaves: 50 },
      clergy:          { cash: 5000,    land: 5000,   treasure: 1000,   slaves: 5 },
      commoner:        { cash: 500,     land: 50,     treasure: 0,      slaves: 0 }
    };
    var base = basePool[classKey] || basePool.commoner;
    var dyn = String(dynasty || '');
    var dm = 1.0;
    if (dyn.indexOf('秦') >= 0 || dyn.indexOf('周') >= 0) dm = 0.5;
    else if (dyn.indexOf('汉') >= 0) dm = 0.6;
    else if (dyn.indexOf('魏') >= 0 || dyn.indexOf('晋') >= 0 || dyn.indexOf('唐') >= 0) dm = 0.8;
    else if (dyn.indexOf('宋') >= 0 || dyn.indexOf('元') >= 0) dm = 1.0;
    else if (dyn.indexOf('明') >= 0) dm = 1.3;
    else if (dyn.indexOf('清') >= 0) dm = 1.8;
    var rankMult = Math.max(0.3, (7 - (rank || 5)) / 4);
    return {
      cash: Math.floor(base.cash * dm * rankMult),
      land: Math.floor(base.land * dm * rankMult),
      treasure: Math.floor(base.treasure * dm * rankMult),
      slaves: Math.floor(base.slaves * rankMult),
      commerce: Math.floor(base.cash * 0.3 * dm * rankMult)
    };
  }

  global.EconomyGapFill = {
    init: init,
    tick: tick,
    // 税种
    ATOMIC_TAX_TYPES: ATOMIC_TAX_TYPES,
    getAvailableTaxTypes: getAvailableTaxTypes,
    calculateTaxRevenue: calculateTaxRevenue,
    // 购买力
    getPurchasingPower: getPurchasingPower,
    getRealValue: getRealValue,
    fromRealValue: fromRealValue,
    formulaEstimateWealth: formulaEstimateWealth,
    // 四层
    buildHierarchyFromAdminDepth: buildHierarchyFromAdminDepth,
    // 封建
    FEUDAL_TYPES: FEUDAL_TYPES,
    createFeudalHolding: createFeudalHolding,
    // 借贷
    borrowFrom: borrowFrom,
    acceptDonation: acceptDonation,
    // 口碑
    ensureGovernance: ensureGovernance,
    attributeExpenditure: attributeExpenditure,
    // 廷议
    submitReformToTinyi: submitReformToTinyi,
    onTinyiDecision: onTinyiDecision,
    // 强征
    forceLevy: forceLevy,
    VERSION: 1
  };

  global.EconomyCore = {
    formulaEstimateWealth: formulaEstimateWealth,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
