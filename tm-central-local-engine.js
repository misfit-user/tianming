// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-central-local-engine.js — 央地财政分层引擎
 *
 * 子系统三·央地财政（对应 设计方案-央地财政.md）
 *
 * 八决策：
 *  Ⅰ. 四层自适应（按 sc.adminHierarchy.depth）
 *  Ⅱ. 三种分账（tang_three/qiyun_cunliu/custom）
 *  Ⅲ. 税种 × 区域粒度
 *  Ⅳ. 地方实际仿真（14 支出类效果）
 *  Ⅴ. 双向下拨（强征/援助）
 *  Ⅵ. 五类封建财政（诸侯王/土司/外藩/寺院/食邑）
 *  Ⅶ. 央地博弈（compliance/autonomy/warlordism）
 *  Ⅷ. 监察系统（有成本）
 *
 * 对外 API：
 *  CentralLocalEngine.init(sc)
 *  CentralLocalEngine.tick(ctx)                 每回合
 *  CentralLocalEngine.applyAllocation(regionId, allocSpec)
 *  CentralLocalEngine.issueLocalAction(regionId, action) 地方官决策
 *  CentralLocalEngine.dispatchCensor(spec)      派遣御史
 *  CentralLocalEngine.applyReform(id, opts)     历史改革
 *  CentralLocalEngine.getComplianceReport()     获取 compliance 报告
 *  CentralLocalEngine.getAIContext()
 */
(function(global) {
  'use strict';

  function _turnsForMonthsLocal(months) {
    return (typeof global.turnsForMonths === 'function') ? global.turnsForMonths(months) : months;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  预设：央地分账模式
  // ═══════════════════════════════════════════════════════════════════

  var ALLOCATION_PRESETS = {
    qin_junxian:        { name:'秦郡县直辖', mode:'tang_three', ratios:{ toCentral:1.0, toSelf:0, toLevelUp:0, toLevelDown:0 } },
    han_tuien:          { name:'汉武推恩令后', mode:'tang_three', ratios:{ toCentral:0.85, toSelf:0.10, toLevelUp:0, toLevelDown:0.05 } },
    tang_zu_yong_diao:  { name:'唐前期租庸调', mode:'tang_three', ratios:{ toCentral:1.0, toSelf:0, toLevelUp:0, toLevelDown:0 } },
    tang_liushi:        { name:'唐后期三分法', mode:'tang_three', ratios:{ toCentral:0.333, toSelf:0.334, toLevelUp:0, toLevelDown:0.333 } },
    song_zhuanyun:      { name:'宋转运制', mode:'tang_three', ratios:{ toCentral:0.70, toSelf:0.10, toLevelUp:0.10, toLevelDown:0.10 } },
    ming_qiyun_cunliu:  { name:'明起运存留', mode:'qiyun_cunliu', perTax:{
                          'land_grain':{qiyun:0.6,cunliu:0.4},
                          'head_tax':  {qiyun:0.8,cunliu:0.2},
                          'salt':      {qiyun:0.9,cunliu:0.1},
                          'commerce':  {qiyun:0.5,cunliu:0.5}
                        }},
    qing_dingliu:       { name:'清存留定额', mode:'qiyun_cunliu', perTax:{
                          'land_grain':{qiyun:0.65,cunliu:0.35},
                          'head_tax':  {qiyun:0.85,cunliu:0.15},
                          'salt':      {qiyun:0.95,cunliu:0.05},
                          'commerce':  {qiyun:0.4,cunliu:0.6}
                        }},
    fanzhen_geju:       { name:'藩镇割据', mode:'tang_three', ratios:{ toCentral:0.15, toSelf:0.70, toLevelUp:0, toLevelDown:0.15 } },
    wanqing_fenshi:     { name:'清末分税', mode:'tang_three', ratios:{ toCentral:0.35, toSelf:0.55, toLevelUp:0.05, toLevelDown:0.05 } }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  14 项地方支出类型 → 效果映射
  // ═══════════════════════════════════════════════════════════════════

  var EXPENDITURE_EFFECTS = {
    disaster_relief: function(region, amount) {
      region.disasterLevel = Math.max(0, (region.disasterLevel || 0) - amount / 10000 * 0.15);
      region.unrest = Math.max(0, (region.unrest || 30) - amount / 10000 * 2);
      return { 民心: +Math.min(3, amount / 20000) };
    },
    public_works_water: function(region, amount) {
      region.farmland = (region.farmland || 1000000) * (1 + amount / 100000 * 0.01);
      region.logisticsLoss = Math.max(0.02, (region.logisticsLoss || 0.15) - amount / 100000 * 0.005);
      return { 农田: +(amount / 100000 * 0.01).toFixed(3) };
    },
    public_works_road: function(region, amount) {
      region.commerceVolume = (region.commerceVolume || 0) + amount / 50000;
      return { 商贸: +(amount / 50000).toFixed(2) };
    },
    public_works_wall: function(region, amount) {
      region.garrison = (region.garrison || 1000) + amount / 500;
      region.defense = Math.min(100, (region.defense || 50) + amount / 50000);
      return { 城防: +(amount / 50000).toFixed(1) };
    },
    education: function(region, amount) {
      region.educationLevel = Math.min(100, (region.educationLevel || 30) + amount / 20000);
      return { 教化: +(amount / 20000).toFixed(1) };
    },
    military_prep: function(region, amount) {
      region.troopsQuality = Math.min(100, (region.troopsQuality || 40) + amount / 30000);
      return { 军备: +(amount / 30000).toFixed(1) };
    },
    post_stations: function(region, amount) {
      region.logisticsLoss = Math.max(0.02, (region.logisticsLoss || 0.15) - amount / 80000 * 0.005);
      return { 驿传: +(amount / 80000 * 0.005).toFixed(3) };
    },
    ritual_sacrifice: function(region, amount) {
      region.legitimacy = Math.min(100, (region.legitimacy || 50) + amount / 40000);
      if (global._adjAuthority) global._adjAuthority('minxin', Math.min(1, amount / 100000));
      return { 礼制: +(amount / 40000).toFixed(1) };
    },
    charity_local: function(region, amount) {
      region.gentryFavor = Math.min(100, (region.gentryFavor || 50) + amount / 30000);
      return { 乡绅: +(amount / 30000).toFixed(1) };
    },
    embezzlement: function(region, amount, opts) {
      opts = opts || {};
      var official = opts.official;
      if (official && global.CharEconEngine && typeof global.CharEconEngine.addBribeIncome === 'function') {
        global.CharEconEngine.addBribeIncome(official, amount, 0.7);
      }
      return { 挪用: amount, 隐蔽: opts.concealed ? '是' : '否' };
    },
    courtship_capital: function(region, amount, opts) {
      if (opts && opts.official && typeof opts.official.reputationCentral === 'number') {
        opts.official.reputationCentral += amount / 20000;
      }
      return { 交好中央: +(amount / 20000).toFixed(1) };
    },
    supernatural_disaster_relief: function(region, amount) {
      region.unrest = Math.max(0, (region.unrest || 30) - amount / 30000 * 1);
      if (amount > 20000 && (region.disasterLevel || 0) > 0.3) {
        // 花大钱做法事但无实效 → 民心反降
        if (global._adjAuthority) global._adjAuthority('minxin', -0.5);
      }
      return { 法事: amount };
    },
    local_amnesty: function(region, amount) {
      region.unrest = Math.max(0, (region.unrest || 30) - 3);
      region.ruleOfLaw = Math.max(0, (region.ruleOfLaw || 60) - 2);
      return { 大赦: true };
    },
    grain_price_stabilization: function(region, amount) {
      if (global.GM.currency && global.GM.currency.market) {
        global.GM.currency.market.grainPrice *= Math.max(0.85, 1 - amount / 200000);
      }
      region.marketTrust = Math.min(100, (region.marketTrust || 50) + amount / 50000);
      return { 平粜: +(amount / 50000).toFixed(1) };
    }
  };

  var EXPENDITURE_LABELS = {
    disaster_relief: '救荒赈灾',
    public_works_water: '水利工程',
    public_works_road: '道路修缮',
    public_works_wall: '城墙修筑',
    education: '兴办学校',
    military_prep: '军备整顿',
    post_stations: '驿传修建',
    ritual_sacrifice: '祭祀典礼',
    charity_local: '赈济乡民',
    embezzlement: '挪用贪墨',
    courtship_capital: '交好中央',
    supernatural_disaster_relief: '祈禳法事',
    local_amnesty: '地方大赦',
    grain_price_stabilization: '平粜稳价'
  };

  // ═══════════════════════════════════════════════════════════════════
  //  央地改革预设（8 条）
  // ═══════════════════════════════════════════════════════════════════

  var REFORM_PRESETS = [
    { id:'tuien_ling', name:'推恩令', dynasty:'汉武', baseSuccessRate:0.80, description:'诸侯王分封诸子，削弱地方',
      effects:{ autonomyDelta:-0.2, complianceDelta:+0.15, feudalDivide:true } },
    { id:'liangshuifa_liushi', name:'两税法留使', dynasty:'唐德宗', baseSuccessRate:0.70, description:'三分法制度化',
      effects:{ preset:'tang_liushi' } },
    { id:'yuanfeng_gaizhi', name:'元丰改制', dynasty:'宋神宗', baseSuccessRate:0.65, description:'三司归户部',
      effects:{ centralizeFinance:true, complianceDelta:+0.1 } },
    { id:'yitiao_bian_fiscal', name:'一条鞭法', dynasty:'明张居正', baseSuccessRate:0.70, description:'起运存留合并折银',
      effects:{ preset:'ming_qiyun_cunliu', monetizeTax:true } },
    { id:'yongzheng_fansi', name:'雍正设藩司', dynasty:'清', baseSuccessRate:0.85, description:'布政使专司财政',
      effects:{ auditBoost:+0.15, complianceDelta:+0.2 } },
    { id:'gaitu_guiliu', name:'改土归流', dynasty:'明清', baseSuccessRate:0.50, description:'西南土司改流官',
      effects:{ convertFeudal:true, complianceDelta:+0.2, unrestDelta:+5 } },
    { id:'xue_fan_gradual', name:'削藩（渐进）', dynasty:'通用', baseSuccessRate:0.55, description:'逐步削减藩镇自治',
      effects:{ autonomyDelta:-0.15, complianceDelta:+0.1 } },
    { id:'che_fan_military', name:'撤藩（武力）', dynasty:'通用', baseSuccessRate:0.30, description:'武力废除封建领地',
      effects:{ autonomyDelta:-0.5, militaryCost:0.3, rebellionRisk:0.5 } }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  区域 fiscal 结构默认值
  // ═══════════════════════════════════════════════════════════════════

  function makeRegionFiscal(regionId, opts) {
    opts = opts || {};
    return {
      regionId: regionId,
      parentId: opts.parentId || null,
      level: opts.level || 0,
      ledgers: { money: 0, grain: 0, cloth: 0 },
      allocation: opts.allocation || {
        mode: 'qiyun_cunliu',
        perTax: { 'land_grain':{qiyun:0.6,cunliu:0.4}, 'head_tax':{qiyun:0.8,cunliu:0.2}, 'salt':{qiyun:0.9,cunliu:0.1}, 'commerce':{qiyun:0.5,cunliu:0.5} }
      },
      compliance: 0.85,
      skimmingRate: 0.05,
      overstatement: 0.08,
      autonomyLevel: 0.2,
      expenditures: { fixed: [], discretionary: [], imperial: [], illicit: [], downstream: [] },
      annualReport: { collected: 0, remitted: 0, spentFixed: 0, spentDiscretionary: 0, skimmed: 0 },
      governingOfficial: opts.governingOfficial || null,
      history: []
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  初始化
  // ═══════════════════════════════════════════════════════════════════

  function init(sc) {
    var G = global.GM;
    if (!G) return;
    if (!G.fiscal) G.fiscal = {};
    if (G.fiscal._centralLocalInited) {
      // 补全老存档缺失字段
      if (!G.fiscal.regions) G.fiscal.regions = {};
      if (!G.fiscal.auditSystem) G.fiscal.auditSystem = { annualBudget:50000, activeCensors:[], standingPositions:[], ongoingInspections:[], coverageRatio:0.3, lastAuditedByRegion:{} };
      if (!G.fiscal.feudalHoldings) G.fiscal.feudalHoldings = [];
      return;
    }

    var rules = (sc && sc.fiscalConfig && sc.fiscalConfig.centralLocalRules) || {};
    var presetId = rules.preset || _inferPresetFromScenario(sc);
    var defaultAlloc = ALLOCATION_PRESETS[presetId] || ALLOCATION_PRESETS.ming_qiyun_cunliu;

    // 确保 G.fiscal.regions 存在
    if (!G.fiscal.regions) G.fiscal.regions = {};

    // 尝试从 GM.regions / sc.regions 构建层级
    var regionsList = [];
    if (G.regions && Array.isArray(G.regions)) regionsList = G.regions;
    else if (sc && sc.regions && Array.isArray(sc.regions)) regionsList = sc.regions;

    regionsList.forEach(function(reg) {
      if (!reg || !reg.id) return;
      if (!G.fiscal.regions[reg.id]) {
        G.fiscal.regions[reg.id] = makeRegionFiscal(reg.id, {
          parentId: reg.parentId,
          level: reg.level || 0,
          allocation: _resolveAllocation(defaultAlloc, reg, rules)
        });
      }
    });

    // 监察系统
    G.fiscal.auditSystem = G.fiscal.auditSystem || {
      annualBudget: 50000,
      activeCensors: [],
      standingPositions: [],
      ongoingInspections: [],
      coverageRatio: 0.3,
      lastAuditedByRegion: {}
    };

    // 封建领地（五类）
    G.fiscal.feudalHoldings = G.fiscal.feudalHoldings || [];

    G.fiscal._centralLocalInited = true;
    G.fiscal._currentPreset = presetId;
  }

  function _inferPresetFromScenario(sc) {
    if (!sc) return 'ming_qiyun_cunliu';
    var name = (sc.name || sc.dynasty || '').toString();
    if (name.indexOf('秦') >= 0) return 'qin_junxian';
    if (name.indexOf('汉') >= 0) return 'han_tuien';
    if (name.indexOf('唐') >= 0 && (name.indexOf('末') >= 0 || name.indexOf('安史') >= 0 || name.indexOf('藩镇') >= 0)) return 'tang_liushi';
    if (name.indexOf('唐') >= 0) return 'tang_zu_yong_diao';
    if (name.indexOf('宋') >= 0) return 'song_zhuanyun';
    if (name.indexOf('明') >= 0) return 'ming_qiyun_cunliu';
    if (name.indexOf('清末') >= 0) return 'wanqing_fenshi';
    if (name.indexOf('清') >= 0) return 'qing_dingliu';
    return 'ming_qiyun_cunliu';
  }

  function _resolveAllocation(preset, region, rules) {
    // 先取 regionOverride
    var override = rules && rules.regionOverrides && rules.regionOverrides[region.id];
    if (override) {
      var alloc = Object.assign({}, preset);
      if (override.perTax) alloc.perTax = Object.assign({}, alloc.perTax || {}, override.perTax);
      if (override.ratios) alloc.ratios = Object.assign({}, alloc.ratios || {}, override.ratios);
      if (override.autonomy !== undefined) alloc.autonomy = override.autonomy;
      return alloc;
    }
    return JSON.parse(JSON.stringify(preset));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  分账执行
  // ═══════════════════════════════════════════════════════════════════

  function splitTax(regionId, taxType, amount) {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.regions) return null;
    var rf = G.fiscal.regions[regionId];
    if (!rf) return null;

    var splits = { toCentral: 0, toSelf: 0, toLevelUp: 0, toLevelDown: 0, skimmed: 0 };
    var alloc = rf.allocation;

    if (alloc.mode === 'qiyun_cunliu') {
      var cfg = (alloc.perTax && alloc.perTax[taxType]) || { qiyun:0.7, cunliu:0.3 };
      splits.toCentral = amount * cfg.qiyun;
      splits.toSelf = amount * cfg.cunliu;
    } else if (alloc.mode === 'tang_three') {
      var r = alloc.ratios || {};
      splits.toCentral = amount * (r.toCentral || 0);
      splits.toSelf = amount * (r.toSelf || 0);
      splits.toLevelUp = amount * (r.toLevelUp || 0);
      splits.toLevelDown = amount * (r.toLevelDown || 0);
    }

    // compliance 扣款：合规率决定实际上缴比例
    var realCompliance = Math.max(0.1, Math.min(1.0, rf.compliance));
    var toCentralActual = splits.toCentral * realCompliance;
    splits.skimmed = (splits.toCentral - toCentralActual) + amount * rf.skimmingRate;
    splits.toCentral = toCentralActual;
    splits.toSelf = Math.max(0, splits.toSelf - amount * rf.skimmingRate);

    // 累计到本区账（按税种单位入对应 ledger）
    rf.annualReport.collected += amount;
    rf.annualReport.remitted += splits.toCentral;
    rf.annualReport.skimmed += splits.skimmed;
    // 根据 taxType 决定入 money/grain/cloth
    var ledgerKey = 'money';
    if (taxType === 'land_grain' || taxType === 'military_levy') ledgerKey = 'grain';
    else if (taxType === 'cloth_levy') ledgerKey = 'cloth';
    rf.ledgers[ledgerKey] = (rf.ledgers[ledgerKey] || 0) + splits.toSelf;

    // 合规率报告（用于调试/UI）
    rf._lastSplit = { taxType: taxType, amount: amount, at: G.turn, splits: splits };

    // 分发到父级/中央/子级（留待调用方或由 EconomyLinkage 处理）
    return splits;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AI 生成 localActions（简化版）
  // ═══════════════════════════════════════════════════════════════════

  function generateLocalActions(ctx) {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.regions) return [];
    var actions = [];
    Object.keys(G.fiscal.regions).forEach(function(rid) {
      var rf = G.fiscal.regions[rid];
      var region = _findRegion(rid) || {};
      var budget = rf.ledgers.money;
      if (budget < 1000) return;

      // 估算本地情势
      var disasterLv = region.disasterLevel || 0;
      var unrest = region.unrest || 30;
      var warThreat = region.warThreat || 0;
      var scale = 0.03; // 默认 3% 本地留存
      if (disasterLv > 0.3 || unrest > 70) scale = 0.25;
      else if (warThreat > 0.3) scale = 0.15;
      var totalSpend = budget * scale;
      if (totalSpend < 100) return;

      var localActions = { regionId: rid, proposer: rf.governingOfficial || '地方官', turn: ctx.turn, actions: [] };

      // 灾害优先救荒
      if (disasterLv > 0.3) {
        var a1 = Math.min(totalSpend * 0.6, budget);
        localActions.actions.push({ type: 'disaster_relief', amount: a1, reason: '本地灾情紧急' });
        totalSpend -= a1;
        budget -= a1;
      }
      // 不安定→法事/大赦/教化
      if (unrest > 60 && totalSpend > 0) {
        var a2 = Math.min(totalSpend * 0.4, budget);
        localActions.actions.push({ type: 'supernatural_disaster_relief', amount: a2, reason: '安抚民心' });
        totalSpend -= a2;
        budget -= a2;
      }
      // 战争威胁→军备
      if (warThreat > 0.3 && totalSpend > 0) {
        var a3 = Math.min(totalSpend * 0.5, budget);
        localActions.actions.push({ type: 'military_prep', amount: a3, reason: '戍边备战' });
        totalSpend -= a3;
        budget -= a3;
      }
      // 太平丰年→基础建设
      if (disasterLv < 0.1 && unrest < 40 && totalSpend > 0) {
        var a4 = Math.min(totalSpend * 0.5, budget);
        var pickType = Math.random();
        var bType = pickType < 0.33 ? 'public_works_water' : (pickType < 0.66 ? 'education' : 'ritual_sacrifice');
        localActions.actions.push({ type: bType, amount: a4, reason: '太平积善' });
        totalSpend -= a4;
        budget -= a4;
      }
      // 贪官→挪用
      var official = rf.governingOfficial && G.chars ? G.chars.find(function(c) { return c.name === rf.governingOfficial; }) : null;
      if (official && (official.integrity || 60) < 40 && budget > 2000) {
        var a5 = Math.min(budget * 0.05, 5000);
        localActions.actions.push({ type: 'embezzlement', amount: a5, reason: '中饱私囊', official: official.name, concealed: true });
        budget -= a5;
      }

      if (localActions.actions.length > 0) actions.push(localActions);
    });
    return actions;
  }

  function executeLocalActions(localActionsList) {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.regions) return;
    localActionsList.forEach(function(la) {
      var rf = G.fiscal.regions[la.regionId];
      if (!rf) return;
      var region = _findRegion(la.regionId) || {};
      la.actions.forEach(function(act) {
        var effectFn = EXPENDITURE_EFFECTS[act.type];
        if (!effectFn) return;
        if (rf.ledgers.money < act.amount) act.amount = rf.ledgers.money;
        rf.ledgers.money -= act.amount;
        var opts = {};
        if (act.official) {
          opts.official = G.chars && G.chars.find(function(c) { return c.name === act.official; });
        }
        if (act.concealed) opts.concealed = true;
        var effect = effectFn(region, act.amount, opts);
        act.effect = effect;
        // 分类累计到 expenditures
        if (act.type === 'embezzlement') {
          rf.expenditures.illicit.push(act);
          rf.annualReport.skimmed += act.amount;
        } else if (act.type === 'courtship_capital') {
          rf.expenditures.imperial.push(act);
        } else {
          rf.expenditures.discretionary.push(act);
          rf.annualReport.spentDiscretionary += act.amount;
        }
      });
      // 限制历史
      ['discretionary','illicit','imperial','fixed','downstream'].forEach(function(k) {
        if (rf.expenditures[k].length > 40) rf.expenditures[k].splice(0, rf.expenditures[k].length - 40);
      });
    });
  }

  function _findRegion(id) {
    var G = global.GM;
    if (G.regions && Array.isArray(G.regions)) {
      return G.regions.find(function(r) { return r.id === id || r.name === id; });
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅶ 央地博弈：compliance 动态
  // ═══════════════════════════════════════════════════════════════════

  function _updateCompliance(ctx, mr) {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.regions) return;
    Object.keys(G.fiscal.regions).forEach(function(rid) {
      var rf = G.fiscal.regions[rid];
      var region = _findRegion(rid) || {};
      var delta = 0;
      // 下降因子
      var centralPressure = G.taxPressure ? G.taxPressure / 200 : 0; // 0-0.5
      delta -= centralPressure * 0.02 * mr;
      delta -= rf.autonomyLevel * 0.01 * mr;
      if (region.unrest > 60) delta -= 0.01 * mr;
      // 官员忠诚
      var official = rf.governingOfficial && G.chars ? G.chars.find(function(c) { return c.name === rf.governingOfficial; }) : null;
      if (official) {
        if ((official.loyalty || 50) < 40) delta -= 0.015 * mr;
        else if ((official.loyalty || 50) > 70) delta += 0.005 * mr;
      }
      // 监察覆盖
      var auditLast = G.fiscal.auditSystem.lastAuditedByRegion[rid] || -999;
      if (ctx.turn - auditLast < _turnsForMonthsLocal(6)) delta += 0.01 * mr;
      // 皇威
      var _hwVal = (G.huangwei && typeof G.huangwei === 'object') ? (G.huangwei.index || 50) : (G.huangwei || 50);
      if (_hwVal > 70) delta += 0.005 * mr;
      else if (_hwVal < 30) delta -= 0.01 * mr;

      rf.compliance = Math.max(0.05, Math.min(1.0, rf.compliance + delta));

      // autonomyLevel 对应反向演化
      if (rf.compliance < 0.5) rf.autonomyLevel = Math.min(1.0, rf.autonomyLevel + 0.01 * mr);
      else if (rf.compliance > 0.8) rf.autonomyLevel = Math.max(0, rf.autonomyLevel - 0.005 * mr);

      // 事件触发
      _checkComplianceEvents(rid, rf, region);
    });
  }

  function _checkComplianceEvents(rid, rf, region) {
    var G = global.GM;
    var signals = rf._signals || (rf._signals = {});
    // 抗命
    if (rf.compliance < 0.5 && !signals.defiance) {
      signals.defiance = true;
      _emitEvent('region_defiance', { regionId: rid, compliance: rf.compliance });
    }
    if (rf.compliance > 0.6) signals.defiance = false;
    // 藩镇坐大
    if (rf.compliance < 0.3 && rf.autonomyLevel > 0.7 && !signals.warlord) {
      signals.warlord = true;
      _emitEvent('frontier_warlord', { regionId: rid, autonomyLevel: rf.autonomyLevel });
    }
    if (rf.compliance > 0.4) signals.warlord = false;
    // 自立
    if (rf.compliance < 0.1 && rf.autonomyLevel > 0.85 && !signals.selfDeclare) {
      signals.selfDeclare = true;
      _emitEvent('self_declaration', { regionId: rid });
      // 升格为封建领地（示意）
      G.fiscal.feudalHoldings.push({
        id: 'feudal_' + rid + '_' + (G.turn || 0),
        regionId: rid,
        type: 'autonomous_warlord',
        declaredAt: G.turn || 0,
        lord: rf.governingOfficial
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  监察系统
  // ═══════════════════════════════════════════════════════════════════

  function dispatchCensor(spec) {
    var G = global.GM;
    if (!G || !G.fiscal) return { ok: false };
    var aud = G.fiscal.auditSystem;
    spec = spec || {};
    var cost = spec.cost || 3000;
    if (G.guoku && G.guoku.money !== undefined && G.guoku.money < cost) return { ok: false, reason: '帑廪不足' };
    var censor = {
      id: 'insp_' + (G.turn || 0) + '_' + Math.floor(Math.random() * 10000),
      inspector: spec.inspector || '御史',
      target: spec.targetRegion,
      startTurn: G.turn || 0,
      expectedEnd: (G.turn || 0) + (spec.duration || 2),
      cost: cost,
      type: spec.type || 'touring',
      findings: []
    };
    aud.ongoingInspections.push(censor);
    if (G.guoku && G.guoku.money !== undefined) G.guoku.money -= cost;
    return { ok: true, censorId: censor.id };
  }

  function _processInspections(ctx) {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.auditSystem) return;
    var aud = G.fiscal.auditSystem;
    var completed = [];
    aud.ongoingInspections.forEach(function(ins) {
      if (ctx.turn >= ins.expectedEnd) {
        _completeInspection(ins);
        completed.push(ins.id);
      }
    });
    aud.ongoingInspections = aud.ongoingInspections.filter(function(ins) { return completed.indexOf(ins.id) < 0; });
    // 更新覆盖率
    var totalRegions = Object.keys(G.fiscal.regions).length || 1;
    var recentAudited = 0;
    Object.keys(aud.lastAuditedByRegion).forEach(function(rid) {
      if (ctx.turn - aud.lastAuditedByRegion[rid] < _turnsForMonthsLocal(12)) recentAudited++;
    });
    aud.coverageRatio = recentAudited / totalRegions;
  }

  function _completeInspection(ins) {
    var G = global.GM;
    var rf = G.fiscal.regions[ins.target];
    if (!rf) return;
    var findings = [];
    // 合规性 check
    if (rf.annualReport.skimmed > rf.annualReport.collected * 0.15) {
      findings.push({ type: 'large_skim', amount: rf.annualReport.skimmed });
      rf.compliance = Math.min(1.0, rf.compliance + 0.1);
    }
    // 私挪
    var recentIllicit = (rf.expenditures.illicit || []).filter(function(a) { return (G.turn - (a.turn||G.turn)) < _turnsForMonthsLocal(6); });
    if (recentIllicit.length > 0) {
      findings.push({ type: 'embezzlement', count: recentIllicit.length, total: recentIllicit.reduce(function(s,a){return s+a.amount;},0) });
      // 触发查办事件
      _emitEvent('embezzlement_exposed', { regionId: ins.target, findings: findings });
    }
    ins.findings = findings;
    G.fiscal.auditSystem.lastAuditedByRegion[ins.target] = G.turn;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  改革执行
  // ═══════════════════════════════════════════════════════════════════

  function applyReform(id, opts) {
    opts = opts || {};
    var G = global.GM;
    if (!G || !G.fiscal) return { ok: false };
    var preset = REFORM_PRESETS.find(function(r) { return r.id === id; });
    if (!preset) return { ok: false, reason: '未知改革' };
    var successRate = preset.baseSuccessRate;
    // 修正
    if (opts.chancellorIntelligence) successRate += (opts.chancellorIntelligence - 60) / 200;
    var _hw3 = (G.huangwei && typeof G.huangwei === 'object') ? (G.huangwei.index || 50) : (G.huangwei || 50);
    successRate += (_hw3 - 50) / 400;
    // 国是之制硬通道（2026-07-03·mod('reform_success') 首批真消费者）：
    // 「改革推行」之制已立且扎根者·央地变法成功率随之上抬（封顶 +0.12·随扎根度打折·suppressed 不计）
    try {
      var _GRcl = (typeof GlobalRules !== 'undefined' && GlobalRules) || (typeof window !== 'undefined' && window.GlobalRules);
      if (_GRcl && typeof _GRcl.mod === 'function') successRate += Math.min(0.12, Number(_GRcl.mod('reform_success')) || 0);
    } catch (_grclE) {}
    successRate = Math.max(0.1, Math.min(0.95, successRate));
    var success = (opts.forceSuccess !== undefined) ? opts.forceSuccess : (Math.random() < successRate);
    var result = { ok: true, reformId: id, success: success, name: preset.name };
    if (success) {
      var e = preset.effects || {};
      if (e.preset) {
        // 切换所有 regions 的 allocation 到指定 preset
        var target = ALLOCATION_PRESETS[e.preset];
        if (target) {
          Object.keys(G.fiscal.regions).forEach(function(rid) {
            G.fiscal.regions[rid].allocation = JSON.parse(JSON.stringify(target));
          });
          G.fiscal._currentPreset = e.preset;
        }
      }
      if (e.autonomyDelta !== undefined) {
        Object.keys(G.fiscal.regions).forEach(function(rid) {
          G.fiscal.regions[rid].autonomyLevel = Math.max(0, Math.min(1, G.fiscal.regions[rid].autonomyLevel + e.autonomyDelta));
        });
      }
      if (e.complianceDelta !== undefined) {
        Object.keys(G.fiscal.regions).forEach(function(rid) {
          G.fiscal.regions[rid].compliance = Math.max(0.1, Math.min(1, G.fiscal.regions[rid].compliance + e.complianceDelta));
        });
      }
      if (e.auditBoost && G.fiscal.auditSystem) {
        G.fiscal.auditSystem.annualBudget *= (1 + e.auditBoost);
      }
      _emitEvent('central_local_reform_success', { id: id, name: preset.name });
    } else {
      var e2 = preset.effects || {};
      if (e2.rebellionRisk && Math.random() < e2.rebellionRisk) {
        _emitEvent('reform_rebellion', { id: id, name: preset.name });
        // 增加 unrest
        if (typeof G.unrest === 'number') G.unrest = Math.min(100, G.unrest + 15);
      }
      _emitEvent('central_local_reform_failure', { id: id, name: preset.name });
    }
    if (!G.fiscal.reformHistory) G.fiscal.reformHistory = [];
    G.fiscal.reformHistory.push({ id: id, turn: G.turn || 0, success: success });
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  年度报告重置（用于每年初清账）
  // ═══════════════════════════════════════════════════════════════════

  function _maybeResetAnnualReport(ctx) {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.regions) return;
    // 年度归档按剧本 daysPerTurn 判断，避免日制/季制仍按 12 回合触发。
    var fallbackDpv = (typeof global._getDaysPerTurn === 'function') ? global._getDaysPerTurn() : 30;
    var fallbackTurn = Number(G.turn || 0);
    var isNewYear = (typeof global.isYearBoundary === 'function')
      ? global.isYearBoundary(G.turn)
      : (fallbackTurn > 0 && Math.floor((fallbackTurn * fallbackDpv) / 365) > Math.floor(((fallbackTurn - 1) * fallbackDpv) / 365));
    if (!isNewYear) return;
    var reportYear = (typeof global.calcDateFromTurn === 'function')
      ? global.calcDateFromTurn(G.turn || 1).adYear
      : ((typeof global.getCurrentYear === 'function') ? global.getCurrentYear() : ((G.year || 0) + Math.floor(Math.max(0, fallbackTurn - 1) * fallbackDpv / 365)));
    Object.keys(G.fiscal.regions).forEach(function(rid) {
      var rf = G.fiscal.regions[rid];
      if (rf.annualReport.collected > 0) {
        rf.history.push({
          year: G.year || reportYear,
          report: Object.assign({}, rf.annualReport)
        });
        if (rf.history.length > 20) rf.history.splice(0, rf.history.length - 20);
      }
      rf.annualReport = { collected: 0, remitted: 0, spentFixed: 0, spentDiscretionary: 0, skimmed: 0 };
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  事件发射
  // ═══════════════════════════════════════════════════════════════════

  function _emitEvent(kind, data) {
    var msg = _formatEventMsg(kind, data);
    if (msg && typeof global.addEB === 'function') global.addEB('央地', msg);
    if (global.EconomyEventBus && typeof global.EconomyEventBus.emit === 'function') {
      global.EconomyEventBus.emit('central_local.' + kind, data);
    }
  }

  function _formatEventMsg(kind, d) {
    d = d || {};
    switch (kind) {
      case 'region_defiance': return (d.regionId||'某地') + ' 抗命，实际上缴锐减（合规率 ' + (d.compliance*100).toFixed(0) + '%）';
      case 'frontier_warlord': return (d.regionId||'某地') + ' 坐大成藩镇，中央号令难至';
      case 'self_declaration': return (d.regionId||'某地') + ' 实质自立，脱离朝廷管辖';
      case 'embezzlement_exposed': return (d.regionId||'某地') + ' 查出贪墨案 ' + ((d.findings||[]).length) + ' 件';
      case 'central_local_reform_success': return '央地改革「' + (d.name||'') + '」已成';
      case 'central_local_reform_failure': return '央地改革「' + (d.name||'') + '」受挫';
      case 'reform_rebellion': return '改革「' + (d.name||'') + '」激起兵变';
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  主 tick
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    var G = global.GM;
    if (!G) return;
    if (!G.fiscal || !G.fiscal._centralLocalInited) {
      var sc = (typeof global.findScenarioById === 'function') ? global.findScenarioById(G.sid) : null;
      init(sc);
    }
    var mr = (typeof ctx.monthRatio === 'number') ? ctx.monthRatio : 1;
    try { _updateCompliance(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'CentralLocal] compliance:') : console.error('[CentralLocal] compliance:', e); }
    try {
      var las = generateLocalActions(ctx);
      executeLocalActions(las);
      ctx.localActions = las; // 供渲染/AI 观察
    } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'CentralLocal] localActions:') : console.error('[CentralLocal] localActions:', e); }
    try { _processInspections(ctx); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'CentralLocal] inspections:') : console.error('[CentralLocal] inspections:', e); }
    try { _maybeResetAnnualReport(ctx); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'CentralLocal] annualReport:') : console.error('[CentralLocal] annualReport:', e); }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  辅助 API
  // ═══════════════════════════════════════════════════════════════════

  function getComplianceReport() {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.regions) return [];
    return Object.keys(G.fiscal.regions).map(function(rid) {
      var rf = G.fiscal.regions[rid];
      return {
        regionId: rid,
        compliance: rf.compliance,
        autonomyLevel: rf.autonomyLevel,
        skimmingRate: rf.skimmingRate,
        remittedThisYear: rf.annualReport.remitted,
        skimmedThisYear: rf.annualReport.skimmed
      };
    });
  }

  function getAIContext() {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.regions) return '';
    var lines = ['【央地财政】'];
    lines.push('当前分账预设：' + (G.fiscal._currentPreset || 'ming_qiyun_cunliu'));
    var reports = getComplianceReport();
    var problematic = reports.filter(function(r) { return r.compliance < 0.6 || r.autonomyLevel > 0.6; });
    if (problematic.length > 0) {
      lines.push('合规危险区域：' + problematic.slice(0, 5).map(function(r) {
        return r.regionId + '(合规' + (r.compliance*100).toFixed(0) + '%';
        + '/自治' + (r.autonomyLevel*100).toFixed(0) + '%)';
      }).join('、'));
    }
    var auditCoverage = G.fiscal.auditSystem && G.fiscal.auditSystem.coverageRatio;
    if (auditCoverage !== undefined) lines.push('监察覆盖率：' + (auditCoverage*100).toFixed(0) + '%');
    if (G.fiscal.feudalHoldings && G.fiscal.feudalHoldings.length > 0) {
      lines.push('已有自立藩镇 ' + G.fiscal.feudalHoldings.length + ' 处');
    }
    return lines.join('\n');
  }

  function applyAllocationPreset(presetId) {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.regions) return false;
    var preset = ALLOCATION_PRESETS[presetId];
    if (!preset) return false;
    Object.keys(G.fiscal.regions).forEach(function(rid) {
      G.fiscal.regions[rid].allocation = JSON.parse(JSON.stringify(preset));
    });
    G.fiscal._currentPreset = presetId;
    return true;
  }

  function setRegionAllocation(regionId, allocSpec) {
    var G = global.GM;
    if (!G || !G.fiscal || !G.fiscal.regions) return false;
    var rf = G.fiscal.regions[regionId];
    if (!rf) return false;
    rf.allocation = Object.assign({}, rf.allocation, allocSpec);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.CentralLocalEngine = {
    init: init,
    tick: tick,
    splitTax: splitTax,
    generateLocalActions: generateLocalActions,
    executeLocalActions: executeLocalActions,
    dispatchCensor: dispatchCensor,
    applyReform: applyReform,
    applyAllocationPreset: applyAllocationPreset,
    setRegionAllocation: setRegionAllocation,
    getComplianceReport: getComplianceReport,
    getAIContext: getAIContext,
    ALLOCATION_PRESETS: ALLOCATION_PRESETS,
    REFORM_PRESETS: REFORM_PRESETS,
    EXPENDITURE_EFFECTS: EXPENDITURE_EFFECTS,
    EXPENDITURE_LABELS: EXPENDITURE_LABELS,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
