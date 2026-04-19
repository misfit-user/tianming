/**
 * tm-phase-f6-economy-deep.js — F 阶段 ⑥：财政货币央地深化
 *
 * 补完：
 *  - Ledger 税种×区域分解
 *  - MarketState 盐/铁价
 *  - 纸币 25 条完整预设
 *  - 地域套利商人自动流动
 *  - 监察成本反演（按地位/距离/侦查力）
 *  - 藩镇自立升格（region → feudalHolding）
 *  - 升迁判定 checkPromotion
 *  - 前任亏空继承 handoverLog
 *  - 15 区域特定危机预设
 *  - 技术解锁皇权成本门槛
 *  - 廷议 2.0 TINGYI_TOPIC_NEW_INSTITUTION 集成
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  Ledger 税种×区域分解
  // ═══════════════════════════════════════════════════════════════════

  function addLedgerEntryGranular(G, entry) {
    if (!G.guoku) return;
    if (!G.guoku.history) G.guoku.history = { monthly: [], yearlyArchive: [], granular: { byTaxType: {}, byRegion: {}, byTaxByRegion: {} } };
    var h = G.guoku.history;
    if (!h.granular) h.granular = { byTaxType: {}, byRegion: {}, byTaxByRegion: {} };
    var tax = entry.taxType || 'unknown';
    var region = entry.region || 'central';
    var amount = entry.amount || 0;
    h.granular.byTaxType[tax] = (h.granular.byTaxType[tax] || 0) + amount;
    h.granular.byRegion[region] = (h.granular.byRegion[region] || 0) + amount;
    var key = tax + '::' + region;
    h.granular.byTaxByRegion[key] = (h.granular.byTaxByRegion[key] || 0) + amount;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  盐/铁价 MarketState 补完
  // ═══════════════════════════════════════════════════════════════════

  function extendMarketState(G) {
    if (!G.currency || !G.currency.market) return;
    var m = G.currency.market;
    if (m.saltPrice === undefined) m.saltPrice = 30;    // 铜钱/斤（常态）
    if (m.ironPrice === undefined) m.ironPrice = 20;
    if (m.textilePrice === undefined) m.textilePrice = (m.clothPrice || 50);
    // 按通胀同步
    var inflation = m.inflation || 0;
    m.saltPrice = Math.max(5, m.saltPrice * (1 + inflation * 0.5));
    m.ironPrice = Math.max(3, m.ironPrice * (1 + inflation * 0.3));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  纸币 25 条完整预设
  // ═══════════════════════════════════════════════════════════════════

  var PAPER_PRESETS_25 = [
    { id:'jiaozi_shu',       name:'交子（蜀）',     dynasty:'宋', year:1023, state:'trial' },
    { id:'qianyin',           name:'钱引',           dynasty:'宋', year:1107, state:'active' },
    { id:'huizi',             name:'会子',           dynasty:'宋', year:1160, state:'depreciate' },
    { id:'guanzi',            name:'关子',           dynasty:'宋', year:1238, state:'collapse' },
    { id:'zhongtong_chao',    name:'中统钞',         dynasty:'元', year:1260, state:'active' },
    { id:'zhiyuan_chao',      name:'至元钞',         dynasty:'元', year:1287, state:'active' },
    { id:'zhizheng_chao',     name:'至正钞',         dynasty:'元', year:1350, state:'collapse' },
    { id:'daming_chao',       name:'大明宝钞',       dynasty:'明', year:1375, state:'depreciate' },
    { id:'jinjinling',        name:'金银引',         dynasty:'宋', year:1200, state:'trial' },
    { id:'yuanbao',           name:'元宝券',         dynasty:'元', year:1280, state:'active' },
    { id:'yinpiao',           name:'银票',           dynasty:'明', year:1600, state:'private' },
    { id:'qianpiao',           name:'钱票',           dynasty:'清', year:1770, state:'private' },
    { id:'huzhao',             name:'户钞（户部）',   dynasty:'明', year:1450, state:'active' },
    { id:'baochao_qing',       name:'大清宝钞',       dynasty:'清', year:1853, state:'trial' },
    { id:'hubu_guanpiao',      name:'户部官票',       dynasty:'清', year:1853, state:'trial' },
    { id:'shanxi_piaohao',     name:'山西票号',       dynasty:'清', year:1823, state:'private' },
    { id:'quanyezhang',        name:'钱业庄',         dynasty:'清', year:1850, state:'private' },
    { id:'jiaozixue',          name:'交子学',         dynasty:'宋', year:1100, state:'proposal' },
    { id:'qianyin_huai',       name:'钱引·淮',        dynasty:'宋', year:1150, state:'active' },
    { id:'dongnan_huizi',      name:'东南会子',       dynasty:'宋', year:1165, state:'active' },
    { id:'zhongtong_jiao',     name:'中统交钞',       dynasty:'元', year:1260, state:'active' },
    { id:'hongwu_baochao',     name:'洪武宝钞',       dynasty:'明', year:1375, state:'active' },
    { id:'dagong_bao',         name:'大工宝',         dynasty:'清', year:1850, state:'proposal' },
    { id:'yixian_chao',        name:'义县钞',         dynasty:'清', year:1861, state:'private' },
    { id:'chinese_amer',       name:'银圆票',         dynasty:'清', year:1890, state:'active' }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  地域套利 —— 商人自动流动
  // ═══════════════════════════════════════════════════════════════════

  function _tickMerchantArbitrage(ctx, mr) {
    var G = global.GM;
    if (!G.currency || !G.currency.market || !G.currency.market.acceptanceByRegion) return;
    var accept = G.currency.market.acceptanceByRegion;
    var regions = Object.keys(accept);
    if (regions.length < 2) return;
    // 找最高与最低接受度区
    var sorted = regions.sort(function(a,b){return (accept[b].acceptance||0)-(accept[a].acceptance||0);});
    var high = sorted[0], low = sorted[sorted.length-1];
    var gap = (accept[high].acceptance || 0) - (accept[low].acceptance || 0);
    if (gap < 0.2) return;  // 差距不够触发套利
    // 商人买入 low 区钱 → 高区卖出（降低 high 接受度，提升 low）
    var arbitrageVolume = gap * 10000000 * 0.01 * mr;
    accept[high].acceptance = Math.max(0.3, accept[high].acceptance - gap * 0.02 * mr);
    accept[low].acceptance = Math.min(1, accept[low].acceptance + gap * 0.03 * mr);
    // 商人阶层获利
    if (G.population && G.population.byClass && G.population.byClass.merchant) {
      var merchant = G.population.byClass.merchant;
      if (merchant.wealth !== undefined) merchant.wealth += arbitrageVolume * 0.1;
    }
    if (global.addEB && gap > 0.3) global.addEB('套利', high + '↔' + low + ' 商人往来 ' + Math.floor(arbitrageVolume));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  监察成本反演（按官阶/距离/侦查力）
  // ═══════════════════════════════════════════════════════════════════

  function computeAuditDispatchCost(targetRegion, inspectorRank, distanceKm) {
    var base = 10000;
    var rankMult = { 1: 4.0, 2: 3.0, 3: 2.0, 4: 1.5, 5: 1.0, 6: 0.7, 7: 0.5 };
    var mult = rankMult[inspectorRank || 5] || 1.0;
    // 距离因子
    var distanceMult = 1 + (distanceKm || 500) / 2000;
    // 侦查能力折减（侦查能力越高越费钱）
    var G = global.GM;
    var auditStrength = (G.auditSystem && G.auditSystem.strength) || 0.5;
    var strengthMult = 0.7 + auditStrength * 0.6;  // 强度 0.5 → 1.0, 强度 1 → 1.3
    var total = Math.floor(base * mult * distanceMult * strengthMult);
    return {
      total: total,
      breakdown: {
        base: base,
        rank: rankMult[inspectorRank || 5],
        distance: distanceMult,
        strength: strengthMult
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  藩镇自立升格（region → feudalHolding）
  // ═══════════════════════════════════════════════════════════════════

  function _checkWarlordAutonomyRise(ctx) {
    var G = global.GM;
    if (!G.fiscal || !G.fiscal.regions) return;
    Object.keys(G.fiscal.regions).forEach(function(rid) {
      var reg = G.fiscal.regions[rid];
      if (reg.autonomyLevel > 0.85 && reg.compliance < 0.2 && !reg._elevatedToFeudal) {
        // 升格
        reg._elevatedToFeudal = true;
        if (!G.feudalHoldings) G.feudalHoldings = [];
        var fh = {
          id: 'feudal_' + (G.turn||0) + '_' + rid,
          name: reg.name || rid,
          originalRegionId: rid,
          type: 'warlord',
          ruler: reg.localRulerName || '某节度',
          loyalty: 0.3,
          tribute: { annual: (reg.claimedRevenue || 500000) * 0.3 },
          elevatedTurn: G.turn || 0
        };
        G.feudalHoldings.push(fh);
        if (global.addEB) global.addEB('藩镇', rid + ' 自立为 ' + fh.name + '（独立藩镇）');
        // 皇权皇威损
        if (global._adjAuthority) {
          global._adjAuthority('huangquan', -8);
          global._adjAuthority('huangwei', -10);
        }
        if (typeof global.EventBus !== 'undefined') {
          global.EventBus.emit('central_local.warlord_independent', { regionId: rid, feudalId: fh.id });
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  升迁判定 checkPromotion
  // ═══════════════════════════════════════════════════════════════════

  function checkPromotion(char) {
    var G = global.GM;
    if (!char || char.alive === false) return null;
    // 按 virtueStage + 官阶 + 皇威 + 忠诚 判定
    var virtueMerit = char.virtueMerit || 30;
    var currentRank = char.rank || 5;
    var loyalty = char.loyalty || 50;
    var hw = G.huangwei && G.huangwei.index || 50;
    // 升迁阈值（rank 数字越小越高）
    var thresholds = { 5: 60, 4: 75, 3: 85, 2: 92, 1: 97 };
    var needed = thresholds[currentRank] || 100;
    if (virtueMerit < needed) return { eligible: false, reason: '贤能 ' + virtueMerit + '/' + needed };
    if (loyalty < 40) return { eligible: false, reason: '忠诚不足' };
    if (hw < 30 && currentRank <= 3) return { eligible: false, reason: '皇威衰微，不敢擢升' };
    // 空缺检查（简化：随机 50%）
    if (Math.random() < 0.5) return { eligible: false, reason: '无缺' };
    // 升迁
    var newRank = Math.max(1, currentRank - 1);
    char.rank = newRank;
    char.virtueMerit = Math.max(0, virtueMerit - needed);
    char._promotedTurn = G.turn || 0;
    if (global.addEB) global.addEB('升迁', char.name + ' 升 ' + newRank + ' 品');
    return { eligible: true, promoted: true, newRank: newRank };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  前任亏空继承 handoverLog
  // ═══════════════════════════════════════════════════════════════════

  function recordHandover(regionId, outgoingOfficial, incomingOfficial, deficit) {
    var G = global.GM;
    if (!G.fiscal || !G.fiscal.regions) return;
    var reg = G.fiscal.regions[regionId];
    if (!reg) return;
    if (!reg.handoverLog) reg.handoverLog = [];
    reg.handoverLog.push({
      turn: G.turn || 0,
      outgoing: outgoingOfficial,
      incoming: incomingOfficial,
      deficit: deficit || 0
    });
    // 若有亏空，新官承受（从新官私产扣）
    if (deficit > 0 && incomingOfficial) {
      var incoming = (G.chars || []).find(function(c){return c.name===incomingOfficial;});
      if (incoming && incoming.privateWealth) {
        incoming.privateWealth.cash = (incoming.privateWealth.cash || 0) - deficit;
        if (global.addEB) global.addEB('亏空', incomingOfficial + ' 承 ' + outgoingOfficial + ' 亏空 ' + deficit);
      }
    }
    return reg.handoverLog[reg.handoverLog.length - 1];
  }

  // ═══════════════════════════════════════════════════════════════════
  //  15 区域特定危机预设
  // ═══════════════════════════════════════════════════════════════════

  var REGIONAL_CRISIS_PRESETS = [
    { regionPattern:/华北|河北|京畿/, crisisType:'forest_depletion', name:'华北森林殆尽', triggerYear:1100 },
    { regionPattern:/关中|长安/, crisisType:'salinization', name:'关中盐碱化', triggerYear:1000 },
    { regionPattern:/鄂尔多斯|河套/, crisisType:'desertification', name:'鄂尔多斯沙化', triggerYear:1200 },
    { regionPattern:/江南|苏杭/, crisisType:'urban_sewage', name:'江南污浊', triggerYear:1400 },
    { regionPattern:/川蜀/, crisisType:'soil_erosion', name:'川东水土流失', triggerYear:1500 },
    { regionPattern:/滇|黔|彝/, crisisType:'soil_fertility_loss', name:'云贵瘠薄', triggerYear:1600 },
    { regionPattern:/陇右|河西/, crisisType:'water_table_drop', name:'陇右水涸', triggerYear:900 },
    { regionPattern:/黄河/, crisisType:'river_silting', name:'黄河淤塞', triggerYear:1100 },
    { regionPattern:/闽|粤/, crisisType:'deforestation', name:'闽粤伐尽', triggerYear:1700 },
    { regionPattern:/东北|辽东/, crisisType:'deforestation', name:'东北林渐伐', triggerYear:1800 },
    { regionPattern:/山东|齐鲁/, crisisType:'soil_fertility_loss', name:'山东耗地', triggerYear:1550 },
    { regionPattern:/淮北|徐州/, crisisType:'river_silting', name:'淮北淤患', triggerYear:1200 },
    { regionPattern:/湖广|荆州/, crisisType:'urban_sewage', name:'荆湖汛涝', triggerYear:1400 },
    { regionPattern:/岭南/, crisisType:'plague', name:'岭南瘴疠', triggerYear:800 },
    { regionPattern:/西域|新疆/, crisisType:'desertification', name:'西域沙侵', triggerYear:1600 }
  ];

  function _checkRegionalCrises(ctx) {
    var G = global.GM;
    if (!G.environment || !G.year) return;
    if (!G._regionalCrisisApplied) G._regionalCrisisApplied = {};
    REGIONAL_CRISIS_PRESETS.forEach(function(preset) {
      if (G.year < preset.triggerYear) return;
      // 查匹配 region
      (G.regions || []).forEach(function(r) {
        if (!r.name) return;
        if (!preset.regionPattern.test(r.name)) return;
        var key = r.id + '::' + preset.name;
        if (G._regionalCrisisApplied[key]) return;
        if (Math.random() < 0.05) {
          G._regionalCrisisApplied[key] = true;
          // 应用生态伤
          if (G.environment.byRegion && G.environment.byRegion[r.id]) {
            var reg = G.environment.byRegion[r.id];
            if (reg.ecoScars) reg.ecoScars[preset.crisisType] = (reg.ecoScars[preset.crisisType] || 0) + 0.3;
          }
          if (!G.environment.crisisHistory) G.environment.crisisHistory = [];
          G.environment.crisisHistory.push({
            turn: G.turn || 0,
            id: preset.crisisType,
            name: preset.name,
            region: r.name
          });
          if (global.addEB) global.addEB('生态', preset.name);
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  技术皇权成本门槛
  // ═══════════════════════════════════════════════════════════════════

  function unlockTechnology(techId) {
    var G = global.GM;
    var TECH_COSTS = {
      irrigation:     { huangquan: 3, money: 200000, hwMin: 50 },
      seedSelection:  { huangquan: 2, money: 100000, hwMin: 40 },
      toolImprovement:{ huangquan: 1, money: 50000,  hwMin: 30 },
      fertilizer:     { huangquan: 2, money: 80000,  hwMin: 40 },
      agriculture:    { huangquan: 5, money: 500000, hwMin: 60 }
    };
    var cost = TECH_COSTS[techId];
    if (!cost) return { ok: false, reason: '未知技术' };
    if (G.huangquan && G.huangquan.index < cost.hwMin) return { ok: false, reason: '皇权不足以推行' };
    if (G.guoku && G.guoku.money < cost.money) return { ok: false, reason: '帑廪不足' };
    if (G.guoku) G.guoku.money -= cost.money;
    if (global._adjAuthority) global._adjAuthority('huangquan', -cost.huangquan);
    // 应用技术
    if (G.environment && G.environment.byRegion) {
      Object.values(G.environment.byRegion).forEach(function(r) {
        if (r.techLevel) r.techLevel[techId] = (r.techLevel[techId] || 1) + 1;
      });
    }
    if (global.addEB) global.addEB('技术', '推行 ' + techId);
    return { ok: true, techId: techId };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  廷议 2.0 TINGYI_TOPIC_NEW_INSTITUTION
  // ═══════════════════════════════════════════════════════════════════

  function createTingyiForNewInstitution(spec) {
    var G = global.GM;
    if (!G._tingyiTopics) G._tingyiTopics = [];
    var topic = {
      id: 'ti_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
      type: 'new_institution',
      institution: spec,
      turn: G.turn || 0,
      factions: {
        '户部':  { stance: spec.annualBudget > 100000 ? 'opposed' : 'supportive', reason: spec.annualBudget > 100000 ? '耗帑' : '利国' },
        '兵部':  { stance: /海防|军|兵|防/.test(spec.name || '') ? 'supportive' : 'neutral', reason: '' },
        '清流':  { stance: 'neutral', reason: '待观察' },
        '宦官':  { stance: /内廷|御用/.test(spec.name || '') ? 'supportive' : 'neutral', reason: '' },
        '地方':  { stance: /总督|巡抚|道/.test(spec.name || '') ? 'supportive' : 'neutral', reason: '' }
      },
      votes: { 赞: 0, 反: 0, 中: 0 },
      status: 'pending'
    };
    // 计票
    Object.values(topic.factions).forEach(function(f) {
      if (f.stance === 'supportive') topic.votes.赞++;
      else if (f.stance === 'opposed') topic.votes.反++;
      else topic.votes.中++;
    });
    topic.passed = topic.votes.赞 > topic.votes.反;
    G._tingyiTopics.push(topic);
    if (global.addEB) global.addEB('廷议', spec.name + '：' + (topic.passed ? '通过' : '搁置') + '（赞 ' + topic.votes.赞 + ' 反 ' + topic.votes.反 + '）');
    return topic;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Tick + Init
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    var G = global.GM;
    try { extendMarketState(G); } catch(e) { console.error('[phaseF6] market:', e); }
    try { _tickMerchantArbitrage(ctx, mr); } catch(e) { console.error('[phaseF6] arbitrage:', e); }
    try { _checkWarlordAutonomyRise(ctx); } catch(e) { console.error('[phaseF6] warlord:', e); }
    try { _checkRegionalCrises(ctx); } catch(e) { console.error('[phaseF6] regionalCrisis:', e); }
    // 升迁扫描（年度）
    try {
      if ((G.month || 1) === 1 && G.turn > 0 && G.chars) {
        G.chars.forEach(function(c) {
          if (c.alive !== false && c.rank && c.rank > 1 && Math.random() < 0.05) checkPromotion(c);
        });
      }
    } catch(e) { console.error('[phaseF6] promotion:', e); }
  }

  function init() {
    // 注入纸币预设到 CurrencyEngine
    // CurrencyEngine.PAPER_PRESETS 是对象（按 key 存），不是 Array —— 用对象合并
    if (typeof global.CurrencyEngine !== 'undefined' && global.CurrencyEngine.PAPER_PRESETS) {
      var existing = global.CurrencyEngine.PAPER_PRESETS;
      if (Array.isArray(existing)) {
        // 极少数分支：若运行时被改成 Array
        PAPER_PRESETS_25.forEach(function(p) {
          if (!existing.some(function(x){return x.id === p.id;})) existing.push(p);
        });
      } else if (typeof existing === 'object') {
        // 正常分支：按 key 注入
        PAPER_PRESETS_25.forEach(function(p) {
          var key = p.id || p.key || (p.name || '').replace(/[^a-z0-9_]/gi, '_');
          if (key && !existing[key]) existing[key] = p;
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.PhaseF6 = {
    init: init,
    tick: tick,
    addLedgerEntryGranular: addLedgerEntryGranular,
    extendMarketState: extendMarketState,
    computeAuditDispatchCost: computeAuditDispatchCost,
    checkPromotion: checkPromotion,
    recordHandover: recordHandover,
    unlockTechnology: unlockTechnology,
    createTingyiForNewInstitution: createTingyiForNewInstitution,
    PAPER_PRESETS_25: PAPER_PRESETS_25,
    REGIONAL_CRISIS_PRESETS: REGIONAL_CRISIS_PRESETS,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
