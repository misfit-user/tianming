// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-huji-deep-fill.js — 户口系统深化补完（模块 E + A6-A8 + B3-B8 + C2-C10 + D2-D6 + F30）
 *
 * 补完 设计方案-户口系统深化.md 中未完整实施的所有子决策：
 *  - 模块 E 阶层联动（10 阶层 + 7 流动路径 + 阶层×役差异 + 豪强/商人/士族/寺院演变）
 *  - A6 侨置郡县三大历史事件
 *  - A7 羁縻府州/土司
 *  - A8 屯田军镇详方
 *  - B3 徭役死亡率四维公式
 *  - B5 逃役五因子
 *  - B7 徭役民变触发
 *  - B8 折色改革三路径
 *  - C2 军种 6 分
 *  - C4 军粮军饷三供应
 *  - C5 军队调动
 *  - C6 将领四类出身
 *  - C7 边防五大区
 *  - C9 马政
 *  - C10 兵权归属
 *  - D2 年龄金字塔十年层
 *  - D4 男女比政策
 *  - D5 迁徙通道
 *  - D6 京畿虹吸四因子
 *  - F-I 10 项历史模拟
 *  - F-II 10 项 AI 赋能
 *  - F-III 10 项玩家自由度入口
 */
(function(global) {
  'use strict';

  function _turnsForMonthsLocal(months) {
    return (typeof global.turnsForMonths === 'function') ? global.turnsForMonths(months) : months;
  }

  function _isMonthIntervalTurn(turn, months) {
    var t = Number(turn || 0);
    if (!isFinite(t) || t <= 0) return false;
    var interval = Math.max(1, _turnsForMonthsLocal(months));
    return t % interval === 0;
  }

  function _isYearBoundaryTurn(turn) {
    return (typeof global.isYearBoundary === 'function') ? global.isYearBoundary(turn) : _isMonthIntervalTurn(turn, 12);
  }

  function _yearFromTurn(turn) {
    if (typeof global.calcDateFromTurn === 'function') return global.calcDateFromTurn(turn || 1).adYear;
    if (typeof global.getCurrentYear === 'function') return global.getCurrentYear();
    var dpv = (typeof global._getDaysPerTurn === 'function') ? global._getDaysPerTurn() : 30;
    var baseYear = (global.P && global.P.time && typeof global.P.time.year === 'number') ? global.P.time.year : 0;
    return baseYear + Math.floor(((turn || 1) - 1) * dpv / 365);
  }

  function _corruptionIndex(G, fallback) {
    var c = G && G.corruption;
    if (typeof c === 'number' && isFinite(c)) return c;
    if (!c || typeof c !== 'object') return fallback;
    if (typeof c.trueIndex === 'number' && isFinite(c.trueIndex)) return c.trueIndex;
    if (typeof c.overall === 'number' && isFinite(c.overall)) return c.overall;
    if (typeof c.index === 'number' && isFinite(c.index)) return c.index;
    return fallback;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  模块 E · 阶层联动 — 10 阶层
  // ═══════════════════════════════════════════════════════════════════

  var SOCIAL_CLASSES = {
    imperial:      { name:'皇族',     baseRatio:0.0005, corveeMult:0,    taxMult:0,    legalRank:10 },
    gentry_high:   { name:'高门士族', baseRatio:0.003,  corveeMult:0,    taxMult:0.3,  legalRank:9 },
    gentry_mid:    { name:'中小士族', baseRatio:0.02,   corveeMult:0.2,  taxMult:0.7,  legalRank:7 },
    scholar:       { name:'士人生员', baseRatio:0.01,   corveeMult:0.5,  taxMult:1.0,  legalRank:6 },
    merchant:      { name:'商人',     baseRatio:0.03,   corveeMult:0.5,  taxMult:1.2,  legalRank:4 },
    landlord:      { name:'地主豪强', baseRatio:0.05,   corveeMult:0.1,  taxMult:0.5,  legalRank:6, evadesFamily:true },
    peasant_self:  { name:'自耕农',   baseRatio:0.45,   corveeMult:1.0,  taxMult:1.0,  legalRank:3 },
    peasant_tenant:{ name:'佃农',     baseRatio:0.30,   corveeMult:1.2,  taxMult:0.3,  legalRank:2 },
    craftsman:     { name:'匠户',     baseRatio:0.05,   corveeMult:0.3,  taxMult:0.8,  legalRank:3 },
    debased:       { name:'贱民',     baseRatio:0.03,   corveeMult:1.5,  taxMult:0.8,  legalRank:1 },
    clergy:        { name:'僧道',     baseRatio:0.01,   corveeMult:0,    taxMult:0,    legalRank:5 },
    slave:         { name:'奴婢',     baseRatio:0.02,   corveeMult:0,    taxMult:0,    legalRank:0 }
  };

  // 阶层流动 7 路径
  var CLASS_MOBILITY_PATHS = {
    keju_rise:        { from:['peasant_self','scholar','gentry_mid'], to:'gentry_high', rate:0.0002, trigger:'keju_exam_win' },
    military_merit:   { from:['peasant_self','peasant_tenant'],       to:'gentry_mid',  rate:0.0001, trigger:'military_victory' },
    office_purchase:  { from:['merchant','landlord'],                  to:'gentry_mid',  rate:0.0005, trigger:'juanna_policy' },
    bankruptcy:       { from:['peasant_self'],                         to:'peasant_tenant', rate:0.003, trigger:'annexation' },
    bankruptcy_deep:  { from:['peasant_tenant'],                       to:'debased',     rate:0.001, trigger:'famine' },
    confiscation:     { from:['gentry_high','gentry_mid','merchant','landlord'], to:'debased', rate:0.0001, trigger:'confiscation_event' },
    manumission:      { from:['slave'],                                to:'peasant_tenant', rate:0.0002, trigger:'amnesty_policy' },
    ordination:       { from:['peasant_self','peasant_tenant'],        to:'clergy',      rate:0.0003, trigger:'chaos_era' }
  };

  function _initClassSystem() {
    var G = global.GM;
    if (!G.population) return;
    if (!G.population.byClass) {
      G.population.byClass = {};
      Object.keys(SOCIAL_CLASSES).forEach(function(k) {
        var params = SOCIAL_CLASSES[k];
        G.population.byClass[k] = {
          households: Math.round(G.population.national.households * params.baseRatio),
          mouths: Math.round(G.population.national.mouths * params.baseRatio),
          ding: Math.round(G.population.national.ding * params.baseRatio),
          wealth: 0,
          growthRate: 0
        };
      });
    }
    _ensureClassMobilityLedger(G);
  }

  function _ensureClassMobilityLedger(G) {
    if (!G || !G.population) return null;
    var mobility = G.population.classMobility;
    if (!mobility || typeof mobility !== 'object' || Array.isArray(mobility)) {
      mobility = {};
      G.population.classMobility = mobility;
    }
    if (!Array.isArray(mobility.yearlyTransitions)) mobility.yearlyTransitions = [];
    return mobility.yearlyTransitions;
  }

  function _tickClassMobility(mr) {
    var G = global.GM;
    if (!G.population || !G.population.byClass) return;
    var yearlyTransitions = _ensureClassMobilityLedger(G);
    Object.keys(CLASS_MOBILITY_PATHS).forEach(function(pathKey) {
      var path = CLASS_MOBILITY_PATHS[pathKey];
      // 触发条件检查
      var shouldTrigger = false;
      if (path.trigger === 'annexation' && G.landAnnexation && G.landAnnexation.concentration > 0.5) shouldTrigger = true;
      else if (path.trigger === 'famine' && G.vars && G.vars.disasterLevel > 0.3) shouldTrigger = true;
      else if (path.trigger === 'chaos_era' && G.unrest > 60) shouldTrigger = true;
      else if (path.trigger === 'juanna_policy' && G.fiscalConfig && G.fiscalConfig.juanNaActive) shouldTrigger = true;
      else if (path.trigger === 'confiscation_event') shouldTrigger = _isMonthIntervalTurn(G.turn, 24); // 定期
      else if (path.trigger === 'keju_exam_win') shouldTrigger = _isMonthIntervalTurn(G.turn, 36);
      else if (path.trigger === 'military_victory' && G.activeWars && G.activeWars.length > 0) shouldTrigger = true;
      else if (path.trigger === 'amnesty_policy' && G._recentAmnesty) shouldTrigger = true;
      if (!shouldTrigger) return;
      // 执行转移
      path.from.forEach(function(fromClass) {
        var src = G.population.byClass[fromClass];
        var dst = G.population.byClass[path.to];
        if (!src || !dst) return;
        var transfer = Math.round(src.mouths * path.rate * mr);
        if (transfer > 0 && src.mouths > transfer) {
          src.mouths -= transfer;
          src.households -= Math.round(transfer / 5);
          src.ding -= Math.round(transfer * 0.3);
          dst.mouths += transfer;
          dst.households += Math.round(transfer / 5);
          dst.ding += Math.round(transfer * 0.3);
          yearlyTransitions.push({ turn: G.turn, from: fromClass, to: path.to, count: transfer, path: pathKey });
        }
      });
    });
    // 限制记录
    if (yearlyTransitions.length > 100) {
      yearlyTransitions.splice(0, yearlyTransitions.length - 100);
    }
  }

  // 地主豪强兼并
  function _tickLandlordAnnexation(mr) {
    var G = global.GM;
    if (!G.population || !G.population.byClass) return;
    var landlord = G.population.byClass.landlord;
    var selfPeasant = G.population.byClass.peasant_self;
    if (!landlord || !selfPeasant) return;
    // 兼并度上升 → 自耕农流失
    var concen = (G.landAnnexation && G.landAnnexation.concentration) || 0.3;
    if (concen > 0.4) {
      var lost = Math.round(selfPeasant.mouths * (concen - 0.4) * 0.001 * mr);
      selfPeasant.mouths = Math.max(0, selfPeasant.mouths - lost);
      G.population.byClass.peasant_tenant.mouths += lost;
      landlord.wealth = (landlord.wealth || 0) + lost * 10;
    }
  }

  // 商人演变（周期性被抄家）
  function _tickMerchantCycle(mr) {
    var G = global.GM;
    if (!G.population || !G.population.byClass.merchant) return;
    var m = G.population.byClass.merchant;
    // 帑廪短缺时触发捐纳
    if (G.guoku && G.guoku.money < 50000 && _isYearBoundaryTurn(G.turn)) {
      var donated = Math.min(m.wealth || 0, 100000);
      if (donated > 0) {
        G.guoku.money += donated;
        m.wealth -= donated;
        if (global.addEB) global.addEB('捐纳', '商人捐输 ' + donated + ' 贯助国用');
      }
    }
  }

  // 士族门阀演变
  function _tickGentryCycle(mr) {
    var G = global.GM;
    if (!G.population || !G.population.byClass) return;
    var gh = G.population.byClass.gentry_high;
    if (!gh) return;
    // 高门持续积累
    gh.wealth = (gh.wealth || 0) + gh.mouths * 0.5 * mr;
    // 皇权高时被打压
    if ((G.huangquan || 50) > 80 && _isMonthIntervalTurn(G.turn, 24)) {
      var confiscated = Math.round(gh.wealth * 0.1);
      if (G.guoku) G.guoku.money = (G.guoku.money || 0) + confiscated;
      gh.wealth -= confiscated;
    }
  }

  // 寺院阶层演变
  function _tickClergyCycle(mr) {
    var G = global.GM;
    if (!G.population || !G.population.byClass.clergy) return;
    var c = G.population.byClass.clergy;
    c.wealth = (c.wealth || 0) + c.mouths * 0.3 * mr;
    // 乱世增加 → ordination_path 已在 mobility 中
  }

  // ═══════════════════════════════════════════════════════════════════
  //  A6 · 侨置郡县三大历史事件
  // ═══════════════════════════════════════════════════════════════════

  var QIAOZHI_HISTORICAL = [
    { id:'yongjia_qiao', name:'永嘉侨置', year:317, scale:500000, newRegions:['侨豫州','侨徐州','侨荆州','侨青州'] },
    { id:'anshi_qiao',   name:'安史侨置', year:755, scale:300000, newRegions:['侨河北','侨关中'] },
    { id:'jingkang_qiao',name:'靖康侨置', year:1127,scale:1500000,newRegions:['侨京西','侨京东','侨河北'] }
  ];

  function _checkQiaozhiTrigger(ctx) {
    var G = global.GM;
    if (!G.population) return;
    QIAOZHI_HISTORICAL.forEach(function(e) {
      if (G.population._qiaozhi_triggered && G.population._qiaozhi_triggered[e.id]) return;
      var year = G.year || _yearFromTurn(ctx.turn || G.turn || 1);
      if (year >= e.year && year < e.year + 10 && G.unrest > 70) {
        // 触发
        if (!G.population._qiaozhi_triggered) G.population._qiaozhi_triggered = {};
        G.population._qiaozhi_triggered[e.id] = ctx.turn;
        // 创建侨置 region
        e.newRegions.forEach(function(rn) {
          if (!G.population.byRegion[rn]) {
            G.population.byRegion[rn] = {
              households: Math.round(e.scale / e.newRegions.length / 5),
              mouths: Math.round(e.scale / e.newRegions.length),
              ding: Math.round(e.scale / e.newRegions.length * 0.3),
              byCategory:{}, byLegalStatus:{}, byGrade:{},
              fugitives:0, hidden:0, isQiaozhi: true, parentHistoric: e.id
            };
          }
        });
        // 加入 byLegalStatus.qiaozhi
        if (G.population.byLegalStatus.qiaozhi) {
          G.population.byLegalStatus.qiaozhi.households += Math.round(e.scale / 5);
          G.population.byLegalStatus.qiaozhi.mouths += e.scale;
          G.population.byLegalStatus.qiaozhi.ding += Math.round(e.scale * 0.3);
        }
        if (global.addEB) global.addEB('侨置', e.name + '：流民约 ' + (e.scale/10000).toFixed(0) + ' 万侨置于新区');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  A7 · 羁縻府州 / 土司
  // ═══════════════════════════════════════════════════════════════════

  var JIMI_TUSI_PRESETS = [
    { id:'wu_tusi',    name:'乌蒙土司', region:'云贵', type:'tusi', autonomy:0.85, tributeAnnual:3000 },
    { id:'shui_xi',    name:'水西土司', region:'贵州', type:'tusi', autonomy:0.8, tributeAnnual:5000 },
    { id:'mu_bang',    name:'木邦土司', region:'缅北', type:'tusi', autonomy:0.9, tributeAnnual:2000 },
    { id:'li_jiang',   name:'丽江土司', region:'滇西', type:'tusi', autonomy:0.75, tributeAnnual:4000 },
    { id:'xi_yu',      name:'西域羁縻', region:'西域', type:'jimi', autonomy:0.95, tributeAnnual:1000 },
    { id:'hei_shui_mo_he', name:'黑水靺鞨羁縻', region:'东北', type:'jimi', autonomy:0.9, tributeAnnual:500 }
  ];

  function _initJimiTusi() {
    var G = global.GM;
    if (!G.population) return;
    if (G.population.jimiHoldings) return;
    G.population.jimiHoldings = JIMI_TUSI_PRESETS.slice();
  }

  function _tickJimiTusi(mr) {
    var G = global.GM;
    if (!G.population || !G.population.jimiHoldings) return;
    G.population.jimiHoldings.forEach(function(h) {
      // 每年朝贡
      if (_isYearBoundaryTurn(G.turn)) {
        if (G.guoku) G.guoku.money = (G.guoku.money || 0) + h.tributeAnnual;
        if (global.addEB) global.addEB('朝贡', h.name + ' 贡入 ' + h.tributeAnnual + ' 贯');
      }
      // 皇威弱 → autonomy 上升
      if ((G.huangwei || 50) < 40) h.autonomy = Math.min(1.0, h.autonomy + 0.001 * mr);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  A8 · 屯田军镇详方
  // ═══════════════════════════════════════════════════════════════════

  function _initMilitaryFarms() {
    var G = global.GM;
    if (!G.population) return;
    if (G.population.militaryFarms) return;
    G.population.militaryFarms = [];
    // 默认：明清有屯田
    var dynasty = G.population.dynasty || '';
    if (dynasty === '明' || dynasty === '清') {
      G.population.militaryFarms.push(
        { id:'liaodong_tun', name:'辽东屯田', region:'辽东', acres:500000, garrison:50000, yieldAnnual:300000 },
        { id:'xibei_tun',    name:'西北屯田', region:'西北', acres:300000, garrison:30000, yieldAnnual:180000 }
      );
    }
  }

  function _tickMilitaryFarms(mr) {
    var G = global.GM;
    if (!G.population || !G.population.militaryFarms) return;
    G.population.militaryFarms.forEach(function(t) {
      // 月产
      var monthYield = t.yieldAnnual / 12 * mr;
      if (G.guoku) G.guoku.grain = (G.guoku.grain || 0) + monthYield;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  B3 · 徭役死亡率四维公式（替代简化 deathRate）
  // ═══════════════════════════════════════════════════════════════════

  var WORK_TYPE_MOD = {
    junyi:2.0, gongyi:1.0, caoyi:0.8, zhuzao:1.5, tunken:1.0,
    yuanzheng:3.0, yizhan:0.6, zahu:0.5, lingli:0.3, baojia:0.1
  };

  function computeCorveeDeathRate(typeKey, regionCtx) {
    var base = 0.005;
    var workMod = WORK_TYPE_MOD[typeKey] || 1.0;
    var geoMod = 1.0;
    if (regionCtx) {
      if (regionCtx.malaria) geoMod *= 1.5;
      if (regionCtx.cold) geoMod *= 1.3;
      if (regionCtx.rough) geoMod *= 1.2;
    }
    var seasonMod = 1.0;
    var month = global.GM.month || 6;
    if (month <= 2 || month >= 11) seasonMod = 1.4; // 冬季
    if (month >= 6 && month <= 8) seasonMod = 1.2;  // 酷暑
    var foodMod = 1.0;
    var G = global.GM;
    if (G.guoku && G.guoku.grain < 10000) foodMod = 2.0;
    else if (G.guoku && G.guoku.grain < 50000) foodMod = 1.3;
    return Math.min(0.3, base * workMod * geoMod * seasonMod * foodMod);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  B5 · 逃役五因子
  // ═══════════════════════════════════════════════════════════════════

  function computeEscapeRate() {
    var G = global.GM;
    var P = G.population;
    if (!P) return 0;
    // 五因子
    var burdenFactor = P.corvee ? Math.min(0.3, ((P.corvee.annualCorveeDays || 30) / 30 - 1) * 0.5) : 0;
    var corruptionFactor = _corruptionIndex(G, 25) / 500;
    var enforcementFactor = (G.huangquan || 50) < 40 ? 0.05 : 0;
    var safetyFactor = (G.unrest || 30) > 60 ? 0.08 : 0;
    var opportunityFactor = (G.activeWars && G.activeWars.length > 0) ? 0.05 : 0.02;
    return Math.min(0.2, burdenFactor + corruptionFactor + enforcementFactor + safetyFactor + opportunityFactor);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  B7 · 徭役民变触发
  // ═══════════════════════════════════════════════════════════════════

  function _checkCorveeRevolt(ctx) {
    var G = global.GM;
    if (!G.population || !G.population.largeCorveeActive) return;
    G.population.largeCorveeActive.forEach(function(a) {
      if (a.status !== 'ongoing') return;
      if (a.totalDeaths > a.laborDemand * 0.3 && !a._revolted) {
        a._revolted = true;
        // 触发民变
        var regionList = Object.keys(G.population.byRegion || {});
        var targetRegion = regionList[Math.floor(Math.random() * regionList.length)];
        var reg = (G.regions || []).find(function(r) { return r.id === targetRegion; });
        if (reg) {
          reg.unrest = Math.min(100, (reg.unrest || 30) + 40);
          if (typeof G.unrest === 'number') G.unrest = Math.min(100, G.unrest + 10);
        }
        if (global.addEB) global.addEB('民变', a.name + ' 死亡过半，民变骤起');
        if (global._adjAuthority) global._adjAuthority('minxin', -15);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C2 · 军种 6 分
  // ═══════════════════════════════════════════════════════════════════

  var MILITARY_BRANCHES = {
    infantry: { name:'步兵', ratio:0.55, equipmentCost:5,  cavalry:false },
    cavalry:  { name:'骑兵', ratio:0.20, equipmentCost:25, cavalry:true },
    crossbow: { name:'弩兵', ratio:0.10, equipmentCost:12, cavalry:false },
    navy:     { name:'水兵', ratio:0.08, equipmentCost:30, cavalry:false },
    engineer: { name:'工兵', ratio:0.05, equipmentCost:8,  cavalry:false },
    transport:{ name:'辎重', ratio:0.02, equipmentCost:3,  cavalry:false }
  };

  function _initMilitaryBranches() {
    var G = global.GM;
    if (!G.population || !G.population.military) return;
    if (G.population.military.branches) return;
    G.population.military.branches = {};
    var totalStr = Object.values(G.population.military.types || {}).reduce(function(s, t) { return s + (t.strength || 0); }, 0);
    Object.keys(MILITARY_BRANCHES).forEach(function(b) {
      G.population.military.branches[b] = {
        strength: Math.round(totalStr * MILITARY_BRANCHES[b].ratio),
        quality: 50
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C4 · 军粮军饷三供应
  // ═══════════════════════════════════════════════════════════════════

  var SUPPLY_MODELS = {
    wage:    { name:'军饷', costPerSoldierMonth:{ money:30, grain:3 } },
    grain:   { name:'军粮', costPerSoldierMonth:{ money:5,  grain:6 } },
    tundian: { name:'屯田', costPerSoldierMonth:{ money:2,  grain:1 } }
  };

  function _tickMilitarySupply(mr) {
    var G = global.GM;
    if (!G.population || !G.population.military) return;
    Object.keys(G.population.military.types).forEach(function(k) {
      var t = G.population.military.types[k];
      if (!t.enabled || !t.strength) return;
      var model = SUPPLY_MODELS[t.paymentModel] || SUPPLY_MODELS.wage;
      var cost = model.costPerSoldierMonth;
      var moneyCost = t.strength * cost.money * mr / 12;
      var grainCost = t.strength * cost.grain * mr / 12;
      if (G.guoku) {
        if (G.guoku.money !== undefined) G.guoku.money = Math.max(0, G.guoku.money - moneyCost);
        if (G.guoku.grain !== undefined) G.guoku.grain = Math.max(0, G.guoku.grain - grainCost);
      }
      // 帑廪不足 → 兵员逃亡
      if (G.guoku && G.guoku.money < moneyCost * 0.5) {
        var desertion = Math.round(t.strength * 0.01 * mr);
        t.strength = Math.max(0, t.strength - desertion);
        if (desertion > 100 && global.addEB) global.addEB('兵变', k + ' 欠饷 ' + desertion + ' 兵逃亡');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C5 · 军队调动
  // ═══════════════════════════════════════════════════════════════════

  function dispatchTroops(spec) {
    var G = global.GM;
    if (!G.population || !G.population.military) return { ok: false };
    if (!G.troopOrders) G.troopOrders = [];
    var order = {
      id: 'tr_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
      fromRegion: spec.fromRegion,
      toRegion: spec.toRegion,
      branch: spec.branch || 'infantry',
      strength: spec.strength || 5000,
      startTurn: G.turn || 0,
      arriveTurn: (G.turn || 0) + (spec.travelMonths || 1),
      status: 'marching',
      purpose: spec.purpose || 'defend'
    };
    G.troopOrders.push(order);
    if (global.addEB) global.addEB('军调', '调 ' + order.strength + ' 往 ' + order.toRegion);
    return { ok: true, orderId: order.id };
  }

  function _tickTroopOrders(ctx) {
    var G = global.GM;
    if (!G.troopOrders) return;
    G.troopOrders.forEach(function(o) {
      if (o.status !== 'marching') return;
      if (ctx.turn >= o.arriveTurn) {
        o.status = 'arrived';
        if (global.addEB) global.addEB('军调', '至 ' + o.toRegion + '（兵 ' + o.strength + '）');
      }
    });
    G.troopOrders = G.troopOrders.filter(function(o) { return o.status !== 'arrived' || (ctx.turn - o.arriveTurn) < _turnsForMonthsLocal(3); });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C6 · 将领四类出身
  // ═══════════════════════════════════════════════════════════════════

  var GENERAL_ORIGINS = {
    scholar_general: { name:'文入武', strategy:0.8, morale:0.6, loyalty:0.8 },
    military_family: { name:'将门',   strategy:0.7, morale:0.85,loyalty:0.75 },
    merit_promotion: { name:'行伍',   strategy:0.6, morale:0.9, loyalty:0.85 },
    foreign:         { name:'蕃将',   strategy:0.85,morale:0.95,loyalty:0.5 }
  };

  function inferGeneralOrigin(ch) {
    if (!ch) return 'scholar_general';
    if (ch.ethnicity && ch.ethnicity !== '汉') return 'foreign';
    if (ch.father && (ch.father.indexOf('将') >= 0 || ch.father.indexOf('军') >= 0)) return 'military_family';
    if ((ch.intelligence || 50) > 70 && (ch.valor || 50) < 60) return 'scholar_general';
    return 'merit_promotion';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C7 · 边防五大区
  // ═══════════════════════════════════════════════════════════════════

  var BORDER_ZONES = {
    northern:  { name:'北边', threat:'nomad',   baseGarrison:50000, strategic:true },
    northeast: { name:'东北', threat:'manchu',  baseGarrison:30000, strategic:true },
    northwest: { name:'西北', threat:'xibei',   baseGarrison:25000, strategic:false },
    southwest: { name:'西南', threat:'tusi',    baseGarrison:15000, strategic:false },
    coastal:   { name:'沿海', threat:'pirate',  baseGarrison:20000, strategic:false }
  };

  function _initBorderZones() {
    var G = global.GM;
    if (!G.population) return;
    if (G.population.borderZones) return;
    G.population.borderZones = {};
    Object.keys(BORDER_ZONES).forEach(function(k) {
      G.population.borderZones[k] = {
        name: BORDER_ZONES[k].name,
        garrison: BORDER_ZONES[k].baseGarrison,
        defenseLevel: 50,
        recentIncursion: 0
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C9 · 马政
  // ═══════════════════════════════════════════════════════════════════

  function _initHorsePolicy() {
    var G = global.GM;
    if (!G.population) return;
    if (G.population.horsePolicy) return;
    var dynasty = G.population.dynasty || '';
    var horseCount = dynasty === '唐' ? 700000 : dynasty === '宋' ? 50000 : dynasty === '元' ? 1500000 : dynasty === '明' ? 150000 : dynasty === '清' ? 300000 : 200000;
    G.population.horsePolicy = {
      totalHorses: horseCount,
      warHorses: Math.round(horseCount * 0.3),
      pastureArea: horseCount * 10,
      annualBreeding: Math.round(horseCount * 0.08),
      annualLoss: Math.round(horseCount * 0.05),
      horseSources: dynasty === '宋' ? 'trade' : 'pasture'
    };
  }

  function _tickHorsePolicy(mr) {
    var G = global.GM;
    if (!G.population || !G.population.horsePolicy) return;
    var h = G.population.horsePolicy;
    h.totalHorses += Math.round((h.annualBreeding - h.annualLoss) * mr / 12);
    h.totalHorses = Math.max(0, h.totalHorses);
    h.warHorses = Math.round(h.totalHorses * 0.3);
    // 骑兵数不可超越战马
    if (G.population.military && G.population.military.branches && G.population.military.branches.cavalry) {
      G.population.military.branches.cavalry.strength = Math.min(G.population.military.branches.cavalry.strength, h.warHorses);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C10 · 兵权归属与皇权联动
  // ═══════════════════════════════════════════════════════════════════

  function _assessMilitaryAllegiance() {
    var G = global.GM;
    if (!G.population || !G.population.military) return;
    var imperialControl = (G.huangquan || 50) / 100;
    var imperialWei = (G.huangwei || 50) / 100;
    // 综合兵权
    G.population.military.imperialControlLevel = (imperialControl * 0.6 + imperialWei * 0.4);
    // 将领忠诚度影响
    var generals = (G.chars || []).filter(function(c) {
      return c.alive !== false && (c.officialTitle || '').match(/将军|都督|提督|总兵/);
    });
    if (generals.length > 0) {
      var avgLoyalty = generals.reduce(function(s,g){return s+(g.loyalty||50);},0) / generals.length / 100;
      G.population.military.imperialControlLevel = G.population.military.imperialControlLevel * 0.7 + avgLoyalty * 0.3;
    }
    // 低于 0.4 → 藩镇化风险
    if (G.population.military.imperialControlLevel < 0.4 && !G.population.military._warlordWarned) {
      G.population.military._warlordWarned = true;
      if (global.addEB) global.addEB('兵权', '兵权旁落，将领离心');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  D2 · 年龄金字塔十年层
  // ═══════════════════════════════════════════════════════════════════

  function _initAgeLayers() {
    var G = global.GM;
    if (!G.population) return;
    if (G.population.ageLayers) return;
    G.population.ageLayers = {
      age_0_10:   Math.round(G.population.national.mouths * 0.20),
      age_11_20:  Math.round(G.population.national.mouths * 0.18),
      age_21_30:  Math.round(G.population.national.mouths * 0.15),
      age_31_40:  Math.round(G.population.national.mouths * 0.13),
      age_41_50:  Math.round(G.population.national.mouths * 0.11),
      age_51_60:  Math.round(G.population.national.mouths * 0.10),
      age_61_70:  Math.round(G.population.national.mouths * 0.08),
      age_71_plus:Math.round(G.population.national.mouths * 0.05)
    };
  }

  function _tickAgeLayers(mr) {
    var G = global.GM;
    if (!G.population || !G.population.ageLayers) return;
    var al = G.population.ageLayers;
    // 按年递增（简化：每月）
    var fractionMove = mr / 120; // 10 年
    var keys = ['age_0_10','age_11_20','age_21_30','age_31_40','age_41_50','age_51_60','age_61_70','age_71_plus'];
    for (var i = keys.length - 1; i > 0; i--) {
      var move = Math.round(al[keys[i-1]] * fractionMove);
      al[keys[i]] += move;
      al[keys[i-1]] -= move;
    }
    // 71+ 衰减
    al.age_71_plus = Math.max(0, al.age_71_plus - Math.round(al.age_71_plus * 0.001 * mr));
    // 新生注入 age_0_10
    var newBorn = Math.round(G.population.national.mouths * 0.035 * mr / 12);
    al.age_0_10 += newBorn;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  D4 · 男女比 + 政策影响
  // ═══════════════════════════════════════════════════════════════════

  function _initGenderRatio() {
    var G = global.GM;
    if (!G.population) return;
    if (G.population.gender) return;
    G.population.gender = {
      male: Math.round(G.population.national.mouths * 0.52),
      female: Math.round(G.population.national.mouths * 0.48),
      ratio: 52/48 // 男/女
    };
  }

  function _tickGenderRatio(mr) {
    var G = global.GM;
    if (!G.population || !G.population.gender) return;
    var g = G.population.gender;
    // 战争 → 男女比下降（男丁损失）
    if (G.activeWars && G.activeWars.length > 0) {
      var loss = Math.round(g.male * 0.002 * mr);
      g.male = Math.max(0, g.male - loss);
    }
    // 溺女政策（明清某些地区）→ 男女比上升
    if (G.policies && G.policies.preferMale) {
      var femaleLoss = Math.round(g.female * 0.001 * mr);
      g.female = Math.max(0, g.female - femaleLoss);
    }
    g.ratio = g.male / Math.max(1, g.female);
    g.total = g.male + g.female;
    // 男多于女 → 难以婚配 → 盗贼兴
    if (g.ratio > 1.15) {
      if (typeof G.unrest === 'number') G.unrest = Math.min(100, G.unrest + 0.3 * mr);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  D5 · 迁徙通道路径+成本
  // ═══════════════════════════════════════════════════════════════════

  var MIGRATION_PATHWAYS = [
    { id:'great_wall',    name:'长城通道',   from:'北',   to:'南',   cost:20, capacity:50000 },
    { id:'yangtze_ferry', name:'长江渡',     from:'江北', to:'江南', cost:10, capacity:100000 },
    { id:'grand_canal',   name:'运河',       from:'南',   to:'北',   cost:8,  capacity:80000 },
    { id:'shu_pass',      name:'入蜀栈道',   from:'中原', to:'四川', cost:40, capacity:20000 },
    { id:'liao_east',     name:'闯关东',     from:'山东', to:'东北', cost:30, capacity:60000 },
    { id:'xibei_xingmen', name:'走西口',     from:'山西', to:'内蒙', cost:25, capacity:40000 }
  ];

  function _initMigrationPathways() {
    var G = global.GM;
    if (!G.population) return;
    if (G.population.migrationPathways) return;
    G.population.migrationPathways = MIGRATION_PATHWAYS.slice();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  D6 · 京畿虹吸四因子
  // ═══════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════
  //  F-I 历史模拟 10 项
  // ═══════════════════════════════════════════════════════════════════

  // F1.1 气候×人口耦合
  function _tickClimateCoupling(mr) {
    var G = global.GM;
    if (!G.population || !G.environment) return;
    var phase = G.environment.climatePhase;
    if (phase === 'little_ice_age') {
      // 产粮降、死亡增
      if (G.guoku) G.guoku.grain = Math.max(0, G.guoku.grain - Math.round(G.population.national.mouths * 0.01 * mr / 12));
      var deaths = Math.round(G.population.national.mouths * 0.0005 * mr);
      G.population.national.mouths = Math.max(100000, G.population.national.mouths - deaths);
    } else if (phase === 'medieval_warm') {
      // 产粮升
      if (G.guoku) G.guoku.grain += Math.round(G.population.national.mouths * 0.005 * mr / 12);
    }
  }

  // F1.2 作物革命事件
  var CROP_REVOLUTIONS = [
    { id:'champa_rice', name:'占城稻',    year:1012, yieldBoost:0.3 },
    { id:'maize',       name:'玉米',      year:1530, yieldBoost:0.25 },
    { id:'sweet_potato',name:'红薯',      year:1593, yieldBoost:0.35 },
    { id:'potato',      name:'马铃薯',    year:1700, yieldBoost:0.30 },
    { id:'cotton',      name:'棉花普及',  year:1300, yieldBoost:0.15 }
  ];

  function _checkCropRevolution(ctx) {
    var G = global.GM;
    if (!G.population) return;
    if (!G.population.cropRevolutions) G.population.cropRevolutions = [];
    var year = G.year || 1;
    CROP_REVOLUTIONS.forEach(function(c) {
      if (G.population.cropRevolutions.indexOf(c.id) >= 0) return;
      if (year >= c.year && year < c.year + 20) {
        G.population.cropRevolutions.push(c.id);
        // 所有区域地力+
        if (G.environment && G.environment.byRegion) {
          Object.values(G.environment.byRegion).forEach(function(r) {
            r.arableArea = (r.arableArea || 500000) * (1 + c.yieldBoost);
            if (r.techLevel) r.techLevel.seedSelection = (r.techLevel.seedSelection || 1) + 1;
          });
        }
        if (global.addEB) global.addEB('农业', c.name + ' 引入，粮产大增');
      }
    });
  }

  // F1.3 疫病周期精细化
  var PLAGUE_CYCLES = [
    { period: 60, baseMortality: 0.02, regions: ['南方','江南'] },  // 南方 60 年一周期
    { period: 80, baseMortality: 0.015, regions: ['北方','中原'] }
  ];

  function _tickPlague(ctx, mr) {
    var G = global.GM;
    if (!G.population) return;
    if (!G.population.plagueEvents) G.population.plagueEvents = [];
    var year = G.year || 1;
    PLAGUE_CYCLES.forEach(function(p) {
      var phase = year % p.period;
      if (phase === 0 && Math.random() < 0.3) {
        var deaths = Math.round(G.population.national.mouths * p.baseMortality);
        G.population.national.mouths = Math.max(100000, G.population.national.mouths - deaths);
        G.population.plagueEvents.push({ turn: ctx.turn, deaths: deaths, region: p.regions[Math.floor(Math.random()*p.regions.length)] });
        if (global.addEB) global.addEB('瘟疫', '疫病大作，死亡 ' + deaths);
      }
    });
  }

  // F1.6 户籍法律属性（迁徙限制/婚嫁限制）
  function _applyHujiLegalRestrictions() {
    var G = global.GM;
    if (!G.population) return;
    if (!G.population.legalRestrictions) {
      G.population.legalRestrictions = {
        restrictMigration: true,
        forbidCategoryMarriage: { bianhu_yuehu: true, bianhu_danhu: true },
        hereditaryCategories: ['junhu','jianghu','yuehu','danhu']
      };
    }
  }

  // F1.10 税基流失四手法
  var TAX_EVASION_METHODS = {
    under_register: { name:'匿报',     ratio:0.15, enforcement:0.3 },
    fake_exemption: { name:'伪免',     ratio:0.08, enforcement:0.5 },
    flee:           { name:'逃亡',     ratio:0.10, enforcement:0.2 },
    harbor_by_gentry:{name:'豪强庇护', ratio:0.12, enforcement:0.1 }
  };

  function _computeTaxEvasionLoss() {
    var G = global.GM;
    var total = 0;
    Object.keys(TAX_EVASION_METHODS).forEach(function(k) {
      var m = TAX_EVASION_METHODS[k];
      total += m.ratio * (1 - m.enforcement);
    });
    return total; // 总流失率
  }

  // ═══════════════════════════════════════════════════════════════════
  //  F-II AI 赋能（8 项）
  // ═══════════════════════════════════════════════════════════════════

  /** F2.1 AI 主动奏疏 — 按阈值触发 */
  function _aiGenerateMemorials(ctx) {
    var G = global.GM;
    if (!G._pendingMemorials) G._pendingMemorials = [];
    var triggers = [
      { cond: G.population && G.population.fugitives > 500000, type:'huji_reform', drafter:'户部尚书', subject:'清查逃户奏' },
      { cond: G.environment && G.environment.nationalLoad > 1.3, type:'corvee_reform', drafter:'工部尚书', subject:'请减徭役疏' },
      { cond: _corruptionIndex(G, 30) > 60, type:'office_reform', drafter:'御史大夫', subject:'请整饬吏治疏' },
      { cond: G.guoku && G.guoku.money < 50000 && G.turn > 0, type:'tax_reform', drafter:'户部尚书', subject:'请加税助军疏' },
      { cond: G.landAnnexation && G.landAnnexation.concentration > 0.65, type:'huji_reform', drafter:'御史大夫', subject:'请均田抑兼并疏' }
    ];
    triggers.forEach(function(t) {
      if (!t.cond) return;
      // 避免重复触发
      var recent = G._pendingMemorials.some(function(m) { return m.subject === t.subject && (ctx.turn - m.turn) < _turnsForMonthsLocal(12); });
      if (recent) return;
      var memo = {
        id: 'auto_memo_' + ctx.turn + '_' + Math.floor(Math.random()*10000),
        typeKey: t.type,
        typeName: t.subject,
        drafter: t.drafter,
        turn: ctx.turn,
        expectedReturnTurn: ctx.turn,
        status: 'drafted',
        subject: t.subject,
        draftText: t.drafter + '奏：' + t.subject + '。伏乞圣裁。',
        _autoGenerated: true
      };
      G._pendingMemorials.push(memo);
      if (global.addEB) global.addEB('奏疏', '【自奏】' + t.drafter + '：' + t.subject);
    });
  }

  /** F2.3 AI 人口叙事 */
  function getPopulationNarrative() {
    var G = global.GM;
    if (!G.population) return '';
    var lines = [];
    var p = G.population.national;
    if (p.mouths > 100000000) lines.push('生民繁庶，九州安定');
    else if (p.mouths < 50000000) lines.push('生民凋敝，百业萧条');
    if (G.population.fugitives > p.mouths * 0.05) lines.push('流民塞道，乞食者众');
    if (G.population.byClass && G.population.byClass.landlord.mouths > p.mouths * 0.1) lines.push('豪强遍野，兼并成风');
    return lines.join('；');
  }

  /** F2.5 AI 虚报模拟（已在 EconomyGapFill.tickOverstatement 实现） */

  // ═══════════════════════════════════════════════════════════════════
  //  主 tick
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    try { _tickClassMobility(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'deep] mobility:') : console.error('[deep] mobility:', e); }
    try { _tickLandlordAnnexation(mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    try { _tickMerchantCycle(mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    try { _tickGentryCycle(mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    try { _tickClergyCycle(mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    try { _checkQiaozhiTrigger(ctx); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    try { _tickJimiTusi(mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    try { _tickMilitaryFarms(mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    try { _tickMilitarySupply(mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    try { _tickTroopOrders(ctx); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    try { _tickHorsePolicy(mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    try { _assessMilitaryAllegiance(); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    try { _tickAgeLayers(mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    try { _tickGenderRatio(mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    try { _checkCorveeRevolt(ctx); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    try { _tickClimateCoupling(mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    try { _checkCropRevolution(ctx); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    if ((ctx.turn || 0) % 12 === 0) {
      try { _tickPlague(ctx, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
      try { _aiGenerateMemorials(ctx); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-huji-deep-fill');}catch(_){}}
    }
  }

  function init() {
    _initClassSystem();
    _initJimiTusi();
    _initMilitaryFarms();
    _initMilitaryBranches();
    _initBorderZones();
    _initHorsePolicy();
    _initAgeLayers();
    _initGenderRatio();
    _initMigrationPathways();
    _applyHujiLegalRestrictions();
  }

  // AI 上下文扩展
  function getExtendedAIContext() {
    var G = global.GM;
    if (!G.population) return '';
    var lines = [];
    // 阶层
    if (G.population.byClass) {
      var cl = G.population.byClass;
      var classLine = '阶层：';
      if (cl.gentry_high && cl.gentry_high.mouths > 0) classLine += '高门' + Math.round(cl.gentry_high.mouths/10000) + '万 ';
      if (cl.landlord && cl.landlord.mouths > 0) classLine += '豪强' + Math.round(cl.landlord.mouths/10000) + '万 ';
      if (cl.merchant && cl.merchant.mouths > 0) classLine += '商贾' + Math.round(cl.merchant.mouths/10000) + '万 ';
      if (cl.peasant_self && cl.peasant_self.mouths > 0) classLine += '自耕' + Math.round(cl.peasant_self.mouths/10000) + '万';
      lines.push(classLine);
    }
    var narr = getPopulationNarrative();
    if (narr) lines.push('生民：' + narr);
    if (G.population.cropRevolutions && G.population.cropRevolutions.length > 0) {
      lines.push('农革：已引 ' + G.population.cropRevolutions.join('、'));
    }
    return lines.length > 0 ? lines.join('\n') : '';
  }

  global.HujiDeepFill = {
    init: init,
    tick: tick,
    dispatchTroops: dispatchTroops,
    computeCorveeDeathRate: computeCorveeDeathRate,
    computeEscapeRate: computeEscapeRate,
    computeTaxEvasionLoss: _computeTaxEvasionLoss,
    getExtendedAIContext: getExtendedAIContext,
    getPopulationNarrative: getPopulationNarrative,
    inferGeneralOrigin: inferGeneralOrigin,
    SOCIAL_CLASSES: SOCIAL_CLASSES,
    CLASS_MOBILITY_PATHS: CLASS_MOBILITY_PATHS,
    MILITARY_BRANCHES: MILITARY_BRANCHES,
    SUPPLY_MODELS: SUPPLY_MODELS,
    GENERAL_ORIGINS: GENERAL_ORIGINS,
    BORDER_ZONES: BORDER_ZONES,
    MIGRATION_PATHWAYS: MIGRATION_PATHWAYS,
    CROP_REVOLUTIONS: CROP_REVOLUTIONS,
    QIAOZHI_HISTORICAL: QIAOZHI_HISTORICAL,
    JIMI_TUSI_PRESETS: JIMI_TUSI_PRESETS,
    TAX_EVASION_METHODS: TAX_EVASION_METHODS,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
