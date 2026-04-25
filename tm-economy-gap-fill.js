// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-economy-gap-fill.js — 经济系统补完模块
 *
 * 补完 12 项设计文档中的缺失部分：
 *
 * 【部分实施 → 补全】
 *  1. 购买力系数传播（CurrencyEngine.purchasingPowerFactor 真正乘入账目）
 *  2. 19 种原子税种（替代 8 聚合源）
 *  3. 地域币值每回合动态（acceptanceByRegion）
 *  4. 地域价差套利（商贸流）
 *  5. 四层自适应递归（sc.adminHierarchy.depth）
 *  6. 封建财政 5 类（诸侯王/土司/外藩/寺院/食邑）
 *  7. 虚报差额（revenueClaimed vs revenueActual）
 *
 * 【未实施遗漏 → 新增】
 *  8. 土地兼并动态事件
 *  9. 借贷捐输系统
 *  10. 官员为政口碑 char.governance 累计
 *  11. 廷议 2.0 改革联动
 *  12. 强征 compliance 惩罚
 */
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
      var regions = (global.GM.regions || []);
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
    var regions = global.GM.regions;
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
    var regions = sc.regions || (global.GM && global.GM.regions) || [];
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
        if ((global.GM.month || 1) !== 1 || (global.GM.turn % 12 !== 0 && global.GM.turn > 0)) return;
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
      if (G.turn - lastAudit < 3) rf.overstatement = Math.max(0, rf.overstatement - 0.03);
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
    if (ctx.turn % 12 === 0) {
      la.history.push({ year: G.year || Math.floor(ctx.turn/12), concentration: +la.concentration.toFixed(3) });
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
      var monthsElapsed = (G.turn || 0) - loan.startTurn;
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
    var region = (G.regions || []).find(function(r) { return r.id === regionId; });
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
    var isNewYear = (global.GM.month === 1) || (global.GM.turn && global.GM.turn % 12 === 0);
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

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
