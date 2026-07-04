// @ts-check
/* ═══════════════════════════════════════════════════════════════════════
 *  tm-economy-engine-currency.js — 货币子系统（2026-07-04 立项拆分·自 tm-economy-engine.js 保序切出）
 *  内容：§A CurrencyUnit(货币单位) + §B CurrencyEngine(铸币/通胀/钱法)——两只完整独立 IIFE
 *  装载期执行 = 两只 IIFE 自执行(与拆分前同序·保序切割)
 *  加载序：index.html 中紧挨 tm-economy-engine.js 之前——勿改
 * ═══════════════════════════════════════════════════════════════════════ */
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
