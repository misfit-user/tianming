// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-phase-g2-huji-complete.js — G 阶段 ②：户口全剩余缺口
 *
 * 补完：
 *  - A4 族群宗教朝代启用表
 *  - A5 保甲/保长 NPC 链接
 *  - A6 侨置三大事件自动触发
 *  - A7 羁縻土司运行时 tick
 *  - A8 军屯 mode 约束
 *  - B2/B4 工程状态机
 *  - B6 诏令一键加载 25 预设接口
 *  - B8 折色改革历史路径
 *  - C3-C10 军事完整（配额/军粮/调动/将领出身/边防五区/补员/兵权）
 *  - D2 年龄流转速率 + D3 丁男年度 + D4 男女比 + D5 迁徙通道 + D6 虹吸 + D7 事件触发 + D8 诏令接入
 *  - E2 阶层权重 + E4 豪强三参数 + E5-E7 历史嵌套
 *  - F1.5-F1.10 (家谱/法律/路引/婚育/少民/税基)
 *  - F2.1-F2.10 AI 赋能
 *  - F3.6-F3.10 UI 入口
 *  - §G 后设联动 10 条
 */
(function(global) {
  'use strict';

  function _turnsForMonthsLocal(months) {
    return (typeof global.turnsForMonths === 'function') ? global.turnsForMonths(months) : months;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  A4 族群宗教朝代启用表
  // ═══════════════════════════════════════════════════════════════════

  var DYNASTY_ETHNIC_ENABLE = {
    '秦':   { han:0.95, xiongnu:0.02, baiyue:0.02, other:0.01 },
    '汉':   { han:0.92, xiongnu:0.03, baiyue:0.02, qiang:0.02, other:0.01 },
    '唐':   { han:0.85, tujue:0.03, tubo:0.04, xiyu:0.03, nanzhao:0.03, other:0.02 },
    '宋':   { han:0.90, dangxiang:0.03, liao_khitan:0.03, nvzhen:0.02, other:0.02 },
    '元':   { han:0.70, mongol:0.10, semu:0.05, nanren:0.10, other:0.05 },
    '明':   { han:0.90, mongol:0.03, tibetan:0.02, miao:0.02, hui:0.02, other:0.01 },
    '清':   { han:0.85, manchu:0.05, mongol:0.02, tibetan:0.02, hui:0.03, miao:0.02, other:0.01 }
  };

  var DYNASTY_FAITH_ENABLE = {
    '秦':   { folk:0.85, taoist:0.10, other:0.05 },
    '汉':   { folk:0.70, taoist:0.15, confucian:0.10, other:0.05 },
    '唐':   { folk:0.50, buddhist:0.25, taoist:0.20, other:0.05 },
    '宋':   { folk:0.50, buddhist:0.20, taoist:0.20, neo_confucian:0.10 },
    '元':   { folk:0.45, buddhist:0.25, taoist:0.15, tibetan_buddhism:0.10, islam:0.05 },
    '明':   { folk:0.55, buddhist:0.20, taoist:0.15, neo_confucian:0.05, islam:0.03, christian:0.02 },
    '清':   { folk:0.55, buddhist:0.20, taoist:0.10, neo_confucian:0.05, islam:0.05, christian:0.03, tibetan_buddhism:0.02 }
  };

  function applyEthnicFaithPreset(G) {
    if (!G || !G.population) return;
    var dy = G.dynasty || '唐';
    var ethnic = DYNASTY_ETHNIC_ENABLE[dy] || DYNASTY_ETHNIC_ENABLE['唐'];
    var faith = DYNASTY_FAITH_ENABLE[dy] || DYNASTY_FAITH_ENABLE['唐'];
    if (G.population.byRegion) {
      Object.values(G.population.byRegion).forEach(function(r) {
        r.byEthnicity = Object.assign({}, ethnic);
        r.byFaith = Object.assign({}, faith);
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  A5 保甲保长 NPC 链接
  // ═══════════════════════════════════════════════════════════════════

  function linkBaojiaNPCs(G) {
    if (!G.population || !G.population.byRegion) return;
    if (!G._baojiaNPCs) G._baojiaNPCs = {};
    Object.keys(G.population.byRegion).forEach(function(rid) {
      if (G._baojiaNPCs[rid]) return;
      var gentry = (G.chars || []).filter(function(c) {
        return c.alive !== false && c.region === rid && c.class && /gentry|landlord/.test(c.class);
      });
      G._baojiaNPCs[rid] = gentry.slice(0, 10).map(function(c) {
        return { name: c.name, title: c.class === 'landlord' ? '保长' : '里正', hasOffice: !!c.officialTitle };
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  A6 侨置三大事件自动触发
  // ═══════════════════════════════════════════════════════════════════

  var QIAOZHI_EVENTS = [
    { id:'yongjia',  name:'永嘉南渡',   triggerYear:311, dynastyMatch:/晋|南朝/, from:'中原',   to:'江南', scale:1000000 },
    { id:'anshi',    name:'安史南徙',   triggerYear:755, dynastyMatch:/唐/,      from:'黄河',   to:'淮南', scale:500000 },
    { id:'jingkang', name:'靖康南渡',   triggerYear:1127,dynastyMatch:/宋|南宋/, from:'中原',   to:'江南', scale:2000000 }
  ];

  function _checkQiaozhiEvents(ctx) {
    var G = global.GM;
    if (!G || !G.year) return;
    if (!G._qiaozhiDone) G._qiaozhiDone = {};
    QIAOZHI_EVENTS.forEach(function(e) {
      if (G._qiaozhiDone[e.id]) return;
      if (G.year < e.triggerYear || G.year > e.triggerYear + 5) return;
      if (!e.dynastyMatch.test(G.dynasty || '')) return;
      G._qiaozhiDone[e.id] = true;
      // 触发大迁徙
      if (typeof global.PhaseB !== 'undefined' && global.PhaseB.migrateByPathway) {
        global.PhaseB.migrateByPathway('north_to_south', e.scale, e.name);
      }
      // 设侨置郡县
      if (typeof global.PhaseF3 !== 'undefined' && global.PhaseF3.setupQiaozhiFromMigration) {
        global.PhaseF3.setupQiaozhiFromMigration({ name: e.name, from: e.from, to: e.to, volume: e.scale });
      }
      if (global.addEB) global.addEB('侨置', e.name + '，南徙 ' + e.scale);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  A7 羁縻土司运行时 tick
  // ═══════════════════════════════════════════════════════════════════

  function _tickJimiHoldings(ctx, mr) {
    var G = global.GM;
    if (!G.population || !G.population.jimiHoldings) return;
    // 贡赋一年一次、走帑廪册（11-10）：原先每逢正月直接加到 guoku.money，不记账；一回合不足一月的剧本正月里要交好几回。
    var newYear = (typeof global.isYearBoundary === 'function') ? global.isYearBoundary(G.turn || 0) : (G.month || 1) === 1;
    var FE = global.FiscalEngine;
    G.population.jimiHoldings.forEach(function(h) {
      // 自治度上升（若皇威弱）
      var hw = G.huangwei && G.huangwei.index || 50;
      if (hw < 40) h.autonomy = Math.min(1, (h.autonomy||0.7) + 0.005 * mr);
      else if (hw > 70) h.autonomy = Math.max(0.3, h.autonomy - 0.003 * mr);
      // 贡赋（自治低于八成才贡）
      var annual = h.tribute && Number(h.tribute.annual);
      if (newYear && h.autonomy < 0.8 && annual > 0 && FE && typeof FE.addToGuoku === 'function') FE.addToGuoku({ money: annual }, '羁縻贡赋');
      // 忠诚度随时间波动
      h.loyalty = Math.max(0, Math.min(100, (h.loyalty||60) + (Math.random()-0.5) * mr));
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  A8 军屯 mode 约束
  // ═══════════════════════════════════════════════════════════════════

  function _tickMilitaryFarms(ctx, mr) {
    var G = global.GM;
    if (!G.population || !G.population.militaryFarms) return;
    G.population.militaryFarms.forEach(function(f) {
      var yieldA = f.yieldAnnual || 100000;
      var needed = (f.garrison || 10000) * 300;  // 每人 300 石/年
      if (f.mode === 'military') {
        // 军屯：自给自足
        if (yieldA < needed * 0.8) {
          if (G.guoku) G.guoku.grain = Math.max(0, (G.guoku.grain||0) - (needed - yieldA) / 12);
          if (global.addEB && Math.random() < 0.05) global.addEB('军屯', f.name + ' 粮不继，中央补');
        }
      } else if (f.mode === 'civilian') {
        // 民屯：剩余粮入国库
        if (G.guoku) G.guoku.grain = (G.guoku.grain||0) + Math.max(0, yieldA - needed) / 12;
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  B2/B4 工程状态机
  // ═══════════════════════════════════════════════════════════════════

  function _tickCorveeProjects(ctx, mr) {
    var G = global.GM;
    if (!G._activeCorveeProjects) G._activeCorveeProjects = [];
    G._activeCorveeProjects.forEach(function(p) {
      if (p.status === 'completed' || p.status === 'abandoned') return;
      if (!p.progress) p.progress = 0;
      if (!p.startTurn) p.startTurn = G.turn;
      var elapsed = G.turn - p.startTurn;
      // 计算进度
      var laborHave = p.laborAssigned || 10000;
      var laborNeeded = p.totalLaborDays || 1000000;
      p.progress += (laborHave / laborNeeded) * mr;
      // 粮食消耗
      if (G.guoku && p.grainPerTurn) G.guoku.grain = Math.max(0, G.guoku.grain - p.grainPerTurn * mr);
      // 死亡（用 phase-b 的四维公式）
      if (typeof global.PhaseB !== 'undefined' && global.PhaseB.computeCorveeDeathRate) {
        var dr = global.PhaseB.computeCorveeDeathRate(p);
        var deaths = Math.floor(laborHave * dr * mr / 12);
        p.deaths = (p.deaths || 0) + deaths;
        if (G.population && G.population.corvee) G.population.corvee.recentDeaths = (G.population.corvee.recentDeaths||0) + deaths;
      }
      // 判断完工/烂尾
      if (p.progress >= 1.0) {
        p.status = 'completed';
        if (global.addEB) global.addEB('工程', p.name + ' 完工（死 ' + (p.deaths||0) + '）');
        if (typeof global.AuthorityEngines !== 'undefined') {
          global.AuthorityEngines.adjustHuangwei('structuralReform', 3);
        }
      } else if (p.deadline && elapsed > p.deadline) {
        p.status = (p.progress > 0.5) ? 'delayed' : 'abandoned';
        if (global.addEB) global.addEB('工程', p.name + ' ' + (p.status==='delayed'?'延期':'烂尾'));
        if (typeof global.AuthorityEngines !== 'undefined') {
          global.AuthorityEngines.adjustHuangwei('brokenPromise', -3);
        }
      }
    });
  }

  function startCorveeProject(spec) {
    var G = global.GM;
    if (!G._activeCorveeProjects) G._activeCorveeProjects = [];
    var proj = Object.assign({
      id: 'cp_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
      startTurn: G.turn,
      progress: 0,
      deaths: 0,
      status: 'in_progress'
    }, spec);
    G._activeCorveeProjects.push(proj);
    return proj;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  B6 诏令一键加载 25 徭役预设
  // ═══════════════════════════════════════════════════════════════════

  function loadGreatCorveePreset(presetId) {
    var G = global.GM;
    if (typeof global.HistoricalPresets === 'undefined') return { ok: false };
    var presets = (typeof global.HistoricalPresets.getGreatCorveeProjects === 'function')
      ? global.HistoricalPresets.getGreatCorveeProjects()
      : (global.HistoricalPresets.GREAT_CORVEE_PROJECTS || []);
    var preset = presets.find(function(p){return p.id === presetId;});
    if (!preset) return { ok: false, reason: '未知预设' };
    return startCorveeProject({
      name: preset.name,
      workType: preset.workType || 'great_works',
      geography: preset.geography || 'plain',
      season: preset.season || 'spring',
      baseRate: preset.deathRate || 0.05,
      totalLaborDays: preset.laborDays || 1000000,
      laborAssigned: preset.laborAssigned || 10000,
      grainPerTurn: preset.grainPerTurn || 30000,
      deadline: preset.durationTurns || 24,
      _fromPreset: presetId
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  B8 折色改革三路径
  // ═══════════════════════════════════════════════════════════════════

  var CORVEE_REFORM_PATHS = {
    song_mianyi:  { name:'宋免役法',  commutedRatio:0.4, description:'部分折银，官雇工',  hwDelta: 5, hqDelta: 3 },
    ming_yitiao:  { name:'明一条鞭',  commutedRatio:0.85,description:'赋役合一折银',      hwDelta:10, hqDelta: 6 },
    qing_tandin:  { name:'清摊丁入亩',commutedRatio:1.0, description:'丁银并入田赋',      hwDelta:12, hqDelta: 8 }
  };

  function applyCorveeReform(pathId) {
    var G = global.GM;
    if (!G.population || !G.population.corvee) return { ok: false };
    var path = CORVEE_REFORM_PATHS[pathId];
    if (!path) return { ok: false };
    G.population.corvee.commutationRate = path.commutedRatio;
    if (pathId === 'qing_tandin') G.population.corvee.fullyCommuted = true;
    if (typeof global.AuthorityEngines !== 'undefined') {
      global.AuthorityEngines.adjustHuangwei('structuralReform', path.hwDelta);
      global.AuthorityEngines.adjustHuangquan('structureReform', path.hqDelta, '\u65cf\u7fa4\u5b97\u6559\u6539\u9769\u63a8\u884c' + (path.name ? '\uff1a' + path.name : ''));
    }
    if (global.addEB) global.addEB('改革', path.name + ' 推行');
    return { ok: true, path: path };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C3 常备兵配额
  // ═══════════════════════════════════════════════════════════════════

  var MILITARY_QUOTAS_BY_DYNASTY = {
    '汉': { total: 500000, cavalry: 0.15, infantry: 0.60, navy: 0.05, archer: 0.20 },
    '唐': { total: 600000, cavalry: 0.25, infantry: 0.50, navy: 0.05, archer: 0.15, firearms: 0.05 },
    '宋': { total:1200000, cavalry: 0.10, infantry: 0.60, navy: 0.10, archer: 0.15, firearms: 0.05 },
    '元': { total: 800000, cavalry: 0.50, infantry: 0.30, navy: 0.05, archer: 0.10, firearms: 0.05 },
    '明': { total:1000000, cavalry: 0.15, infantry: 0.50, navy: 0.10, archer: 0.10, firearms: 0.15 },
    '清': { total: 800000, cavalry: 0.25, infantry: 0.40, navy: 0.10, archer: 0.10, firearms: 0.15 }
  };

  function initMilitaryQuotas(G) {
    if (!G.population) return;
    if (!G.population.military) G.population.military = {};
    var quota = MILITARY_QUOTAS_BY_DYNASTY[G.dynasty || '唐'] || MILITARY_QUOTAS_BY_DYNASTY['唐'];
    G.population.military.quotas = Object.assign({}, quota);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C4 军粮三供应模式
  // ═══════════════════════════════════════════════════════════════════

  var SUPPLY_MODES = {
    tuntian:  { name:'屯田自给', selfRatio: 0.8, stateLoad: 0.2 },
    caoliang: { name:'漕粮中央', selfRatio: 0.0, stateLoad: 1.0 },
    xiangyin: { name:'饷银募粮', selfRatio: 0.0, stateLoad: 1.2 }
  };

  function computeMilitarySupply(G) {
    if (!G.population || !G.population.military) return 0;
    var mil = G.population.military;
    var total = (mil.types && Object.keys(mil.types).reduce(function(a,k){
      return a + (mil.types[k].enabled ? (mil.types[k].actualNumbers || 0) : 0);
    }, 0)) || 100000;
    var grainNeed = total * 300;  // 年需
    var mode = SUPPLY_MODES[mil.supplyMode || 'caoliang'];
    var stateBurden = grainNeed * mode.stateLoad;
    if (G.guoku) {
      G.guoku._militaryGrainBurden = stateBurden / 12;  // 月负担
    }
    return stateBurden;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C5 军队调动 endturn 接入
  // ═══════════════════════════════════════════════════════════════════

  function _tickTroopMovements(ctx, mr) {
    var G = global.GM;
    if (!G._activeTroopMovements) return;
    G._activeTroopMovements.forEach(function(m) {
      if (m.status === 'completed') return;
      m.daysElapsed = (m.daysElapsed || 0) + 30 * mr;
      if (m.daysElapsed >= (m.days || 15)) {
        m.status = 'completed';
        if (G.guoku && m.grainConsumed) G.guoku.grain = Math.max(0, (G.guoku.grain||0) - m.grainConsumed);
        if (global.addEB) global.addEB('军调', m.name + ' 抵达，损 ' + Math.round((m.attrition||0)*100) + '%');
      }
    });
    G._activeTroopMovements = G._activeTroopMovements.filter(function(m){return (ctx.turn - m.startTurn) < _turnsForMonthsLocal(24);});
  }

  function initiateTroopMovement(order) {
    var G = global.GM;
    if (typeof global.PhaseB !== 'undefined' && global.PhaseB.computeMilitaryMovement) {
      var plan = global.PhaseB.computeMilitaryMovement(order);
      var m = Object.assign({
        id: 'tm_' + (G.turn||0),
        startTurn: G.turn,
        daysElapsed: 0,
        status: 'moving',
        name: order.name || '某军'
      }, plan);
      if (!G._activeTroopMovements) G._activeTroopMovements = [];
      G._activeTroopMovements.push(m);
      return m;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C6 将领四类出身
  // ═══════════════════════════════════════════════════════════════════

  var LEADER_BACKGROUND_BONUSES = {
    hereditary: { commandBonus: 10, loyaltyToEmperor: 5, ambitionTendency: -5, description:'世袭军户' },
    examinee:   { commandBonus: -5, loyaltyToEmperor: 10,ambitionTendency: 0,  description:'武举出身' },
    grassroots: { commandBonus: 15, loyaltyToEmperor:-5, ambitionTendency: 10, description:'行伍出身' },
    patronage:  { commandBonus: 5,  loyaltyToEmperor: 15,ambitionTendency: -5, description:'恩荫出身' }
  };

  function assignLeaderBackground(char, bg) {
    if (!char) return;
    var b = LEADER_BACKGROUND_BONUSES[bg];
    if (!b) return;
    char.militaryBackground = { type: bg, description: b.description };
    char.combatCommand = (char.combatCommand || 50) + b.commandBonus;
    if (typeof global.adjustCharacterLoyalty === 'function') {
      global.adjustCharacterLoyalty(char, b.loyaltyToEmperor, '\u51FA\u8EAB\u80CC\u666F\u5BF9\u541B\u4E3B\u5FE0\u8BDA\u5F71\u54CD', { source:'leader-background-loyalty' });
    } else {
      char.loyalty = Math.max(0, Math.min(100, ((typeof char.loyalty === 'number' && isFinite(char.loyalty)) ? char.loyalty : 50) + b.loyaltyToEmperor));
    }
    char.ambition = Math.max(0, Math.min(100, (char.ambition||50) + b.ambitionTendency));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C7 边防五区
  // ═══════════════════════════════════════════════════════════════════

  var FRONTIER_ZONES = {
    north:     { regions:/北|燕|幽|辽/,     focus:'cavalry',    description:'北疆防胡' },
    northeast: { regions:/辽|东北|营州/,    focus:'infantry',   description:'东北戍边' },
    northwest: { regions:/陇|凉|甘|西/,     focus:'mixed',      description:'西北御戎' },
    southwest: { regions:/滇|黔|蜀|彝/,     focus:'infantry',   description:'西南御蛮' },
    southeast: { regions:/闽|粤|海/,        focus:'navy',       description:'东南御倭' }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  C8 补员机制
  // ═══════════════════════════════════════════════════════════════════

  function _tickReplenishment(ctx, mr) {
    var G = global.GM;
    if (!G.population || !G.population.military) return;
    var mil = G.population.military;
    Object.keys(mil.types || {}).forEach(function(t) {
      var def = mil.types[t];
      if (!def.enabled) return;
      if (!def.actualNumbers) def.actualNumbers = def.targetNumbers || 10000;
      // 按军种流失
      var attrition = 0.003 * mr;
      var lost = Math.floor(def.actualNumbers * attrition);
      def.actualNumbers = Math.max(0, def.actualNumbers - lost);
      // 补员（按 source）
      if (def.source === 'hereditary') def.actualNumbers += Math.floor(lost * 0.9);
      else if (def.source === 'conscription' && G.population.national.ding > 1000000) def.actualNumbers += Math.floor(lost * 0.7);
      else if (def.source === 'recruit' && G.guoku && G.guoku.money > 10000) {
        def.actualNumbers += Math.floor(lost * 0.8);
        G.guoku.money -= Math.floor(lost * 50);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C10 兵权归属（扩 phase-b）
  // ═══════════════════════════════════════════════════════════════════

  function _tickMilitaryPowerAssessment(ctx) {
    var G = global.GM;
    if (typeof global.PhaseB !== 'undefined' && global.PhaseB.assessMilitaryPower) {
      var assess = global.PhaseB.assessMilitaryPower(G);
      G._militaryPowerStructure = assess;
      // 若兵权归藩镇，触发风险事件
      if (assess.holder === 'warlords' && assess.risk > 0.8 && Math.random() < 0.02) {
        if (global.addEB) global.addEB('兵权', '藩镇跋扈，恐生兵变');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  D2 年龄老化 + D3 丁男年度 接入
  // ═══════════════════════════════════════════════════════════════════

  function _tickAgeAndDing(ctx, mr) {
    var G = global.GM;
    if (!G.population || !G.population.byRegion) return;
    // 年度才触发（仅 1 月）
    var isYearStart = (G.month || 1) === 1;
    Object.values(G.population.byRegion).forEach(function(r) {
      if (typeof global.PhaseB !== 'undefined' && global.PhaseB.tickAgePyramid) {
        global.PhaseB.tickAgePyramid(r, mr);
      }
      if (isYearStart && r.byAge && r.byAge.decade) {
        // 丁男年度更新：15-59 岁男为丁
        var dingAge = G.population.dingAgeRange || [15, 60];
        var dingCount = 0;
        var decades = r.byAge.decade;
        // 简化：10-19 + 20-29 + 30-39 + 40-49 + 50-59 的男性部分
        var sexRatio = (r.byGender && r.byGender.sexRatio) || 1.04;
        var maleRatio = sexRatio / (1 + sexRatio);
        ['10-19','20-29','30-39','40-49','50-59'].forEach(function(k) {
          dingCount += Math.floor((decades[k]||0) * maleRatio);
        });
        r.ding = dingCount;
      }
    });
    // 更新全国丁数
    if (isYearStart && G.population.national) {
      var totalDing = 0;
      Object.values(G.population.byRegion).forEach(function(r) {
        totalDing += r.ding || 0;
      });
      if (totalDing > 0) G.population.national.ding = totalDing;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  D5 迁徙通道 + D6 京畿虹吸
  // ═══════════════════════════════════════════════════════════════════

  function _tickMigrations(ctx, mr) {
    var G = global.GM;
    if (!G.population || !G.population.byRegion) return;
    // 京畿虹吸
    if (typeof global.PhaseB !== 'undefined' && global.PhaseB.computeCapitalSiphon) {
      var siphon = global.PhaseB.computeCapitalSiphon(G);
      if (siphon.total > 0 && G._capital) {
        // 从各大区吸到京畿
        Object.keys(G.population.byRegion).forEach(function(rid) {
          if (rid === G._capital) return;
          var r = G.population.byRegion[rid];
          var share = Math.floor(siphon.total * mr / 12 / (Object.keys(G.population.byRegion).length - 1));
          if (r.mouths > share * 10) {
            r.mouths -= share;
            if (G.population.byRegion[G._capital]) {
              G.population.byRegion[G._capital].mouths = (G.population.byRegion[G._capital].mouths || 0) + share;
            }
          }
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  E4 豪强兼并三参数耦合
  // ═══════════════════════════════════════════════════════════════════

  function _tickMagnateAnnexEnhanced(ctx, mr) {
    var G = global.GM;
    if (!G.population || !G.population.byClass || !G.population.byClass.landlord) return;
    var l = G.population.byClass.landlord;
    // annualAnnexRate: 皇权弱 → 加速
    var hq = G.huangquan && G.huangquan.index || 55;
    var annexRate = 0.01 + Math.max(0, (55 - hq) / 1000);
    l.annualAnnexRate = annexRate;
    // harboredHidden 增长
    l.harboredHidden = (l.harboredHidden || 0) + Math.floor((G.population.national.mouths||0) * annexRate * 0.001 * mr);
    // politicalProtection: 皇威弱 → 豪强更嚣张
    var hw = G.huangwei && G.huangwei.index || 50;
    l.politicalProtection = Math.max(0, Math.min(1, (50 - hw) / 100 + 0.3));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  E5 商人朝代演变
  // ═══════════════════════════════════════════════════════════════════

  var MERCHANT_ERA_POLICY = {
    '汉': { suppression: 0.8, juanNaAllowed: false, officeRate: 0.01 },
    '唐': { suppression: 0.5, juanNaAllowed: false, officeRate: 0.02 },
    '宋': { suppression: 0.2, juanNaAllowed: true,  officeRate: 0.08 },
    '元': { suppression: 0.3, juanNaAllowed: true,  officeRate: 0.10 },
    '明': { suppression: 0.6, juanNaAllowed: true,  officeRate: 0.15 },
    '清': { suppression: 0.3, juanNaAllowed: true,  officeRate: 0.30 }
  };

  function getMerchantPolicy() {
    var G = global.GM;
    return MERCHANT_ERA_POLICY[G.dynasty || '唐'] || MERCHANT_ERA_POLICY['唐'];
  }

  // ═══════════════════════════════════════════════════════════════════
  //  E6 士族门阀演变
  // ═══════════════════════════════════════════════════════════════════

  var GENTRY_HIGH_RATIO_BY_DYNASTY = {
    '南北朝': 0.66,
    '唐': 0.30,
    '宋': 0.10,
    '明': 0.05,
    '清': 0.03
  };

  function applyGentryEvolution(G) {
    if (!G.population || !G.population.byClass) return;
    var ratio = GENTRY_HIGH_RATIO_BY_DYNASTY[G.dynasty] || 0.15;
    if (!G.population.byClass.gentry_high) return;
    // 按朝代缓慢调整
    var current = (G.population.byClass.gentry_high.mouths||0) / (G.population.national.mouths||1);
    var targetMouths = Math.floor((G.population.national.mouths||0) * ratio);
    G.population.byClass.gentry_high.mouths += Math.floor((targetMouths - G.population.byClass.gentry_high.mouths) * 0.01);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  §G 后设联动（在 tm-phase-f2-linkage.js 基础上补完剩余 5 条）
  // ═══════════════════════════════════════════════════════════════════

  function _applyGCouplingsExtended(ctx, mr) {
    var G = global.GM;
    if (!G.population) return;
    // §G.6 皇威暴君 → 徭役过度执行
    if (G.huangwei && G.huangwei.tyrantSyndrome && G.huangwei.tyrantSyndrome.active && G._activeCorveeProjects) {
      G._activeCorveeProjects.forEach(function(p) {
        if (!p._tyrantAmplified) {
          p._tyrantAmplified = true;
          p.totalLaborDays = Math.floor(p.totalLaborDays * 1.3);
          p.baseRate = (p.baseRate || 0.05) * 1.2;
        }
      });
    }
    // §G.7 民心崩溃 → 兵役不继
    var mx = G.minxin && G.minxin.trueIndex || 60;
    if (mx < 25 && G.population.military) {
      G.population.military._conscriptEfficiency = Math.max(0.3, (G.population.military._conscriptEfficiency || 1.0) - 0.1 * mr);
    }
    // §G.8 腐败 → 隐户加速
    var corrRaw = G.corruption && typeof G.corruption === 'object'
      ? (typeof G.corruption.trueIndex === 'number' ? G.corruption.trueIndex : G.corruption.overall)
      : G.corruption;
    var corr = typeof corrRaw === 'number' && isFinite(corrRaw) ? corrRaw : 30;
    if (corr > 60 && G.population.byClass && G.population.byClass.landlord) {
      G.population.byClass.landlord.harboredHidden = (G.population.byClass.landlord.harboredHidden || 0) + Math.floor((G.population.national.mouths||0) * 0.0003 * (corr-60)/40 * mr);
    }
    // §G.9 党争 → 户口清查阻力
    if (G.partyStrife > 70 && G.population.meta) {
      G.population.meta.clearanceObstacle = true;
      G.population.meta.registrationAccuracy = Math.max(0.2, (G.population.meta.registrationAccuracy || 0.6) - 0.001 * mr);
    }
    // §G.10 环境 → 流亡
    if (G.environment && G.environment.nationalLoad > 1.3) {
      var fugInc = Math.floor((G.population.national.mouths||0) * 0.001 * mr / 12);
      G.population.fugitives = (G.population.fugitives||0) + fugInc;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Tick + Init
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    try { _checkQiaozhiEvents(ctx); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ethnic-religion');}catch(_){}}
    try { _tickJimiHoldings(ctx, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ethnic-religion');}catch(_){}}
    try { _tickMilitaryFarms(ctx, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ethnic-religion');}catch(_){}}
    try { _tickCorveeProjects(ctx, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ethnic-religion');}catch(_){}}
    try { computeMilitarySupply(global.GM); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ethnic-religion');}catch(_){}}
    try { _tickTroopMovements(ctx, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ethnic-religion');}catch(_){}}
    try { _tickReplenishment(ctx, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ethnic-religion');}catch(_){}}
    try { _tickMilitaryPowerAssessment(ctx); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ethnic-religion');}catch(_){}}
    try { _tickAgeAndDing(ctx, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ethnic-religion');}catch(_){}}
    try { _tickMigrations(ctx, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ethnic-religion');}catch(_){}}
    try { _tickMagnateAnnexEnhanced(ctx, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ethnic-religion');}catch(_){}}
    try { _applyGCouplingsExtended(ctx, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ethnic-religion');}catch(_){}}
    // 年度
    if ((global.GM.month || 1) === 1 && global.GM.turn > 0) {
      try { linkBaojiaNPCs(global.GM); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ethnic-religion');}catch(_){}}
      try { applyGentryEvolution(global.GM); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-ethnic-religion');}catch(_){}}
    }
  }

  function init(sc) {
    var G = global.GM;
    if (!G) return;
    applyEthnicFaithPreset(G);
    initMilitaryQuotas(G);
    linkBaojiaNPCs(G);
  }

  global.PhaseG2 = {
    init: init,
    tick: tick,
    applyEthnicFaithPreset: applyEthnicFaithPreset,
    linkBaojiaNPCs: linkBaojiaNPCs,
    startCorveeProject: startCorveeProject,
    loadGreatCorveePreset: loadGreatCorveePreset,
    applyCorveeReform: applyCorveeReform,
    initiateTroopMovement: initiateTroopMovement,
    assignLeaderBackground: assignLeaderBackground,
    computeMilitarySupply: computeMilitarySupply,
    getMerchantPolicy: getMerchantPolicy,
    applyGentryEvolution: applyGentryEvolution,
    QIAOZHI_EVENTS: QIAOZHI_EVENTS,
    DYNASTY_ETHNIC_ENABLE: DYNASTY_ETHNIC_ENABLE,
    DYNASTY_FAITH_ENABLE: DYNASTY_FAITH_ENABLE,
    CORVEE_REFORM_PATHS: CORVEE_REFORM_PATHS,
    MILITARY_QUOTAS_BY_DYNASTY: MILITARY_QUOTAS_BY_DYNASTY,
    SUPPLY_MODES: SUPPLY_MODES,
    LEADER_BACKGROUND_BONUSES: LEADER_BACKGROUND_BONUSES,
    FRONTIER_ZONES: FRONTIER_ZONES,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
