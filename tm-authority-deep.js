// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-phase-f4-authority-deep.js — F 阶段 ④：权威民心腐败深化
 *
 * ⚠ 架构分类（2026-04-24 R10 评估）：
 *   文件名以 "phase-" 开头，但**本质是自包含子系统模块**而非 monkey patch。
 *   导出 PhaseF4 = { init, tick, dispatchSecretEdict, ... }，不覆盖现有函数。
 *   未来可改名为 tm-authority-deep.js，当前命名保留以维持加载顺序与 git 历史。
 *   **不需要"归位"到 authority-engines.js**（合并后反而混淆职责）。
 *
 * 补完：
 *  - 14 源余下 hook：brokenPromise/deposeFailure/familyScandal/cabinetization
 *  - 密诏完整流程（派送 → 泄露风险 → 成功/失败分支）
 *  - 结构改革永久后世效果（abolishChancellor 后世 memorial 翻倍）
 *  - 民心 byClass 9 旧分类映射
 *  - 民变干预权重数值化
 *  - 同期多地起义 +5%/地 激励系数
 *  - 改革容忍度接入 decreeParser（唯一 monkey patch 点：_patchDecreeParserWithTolerance）
 *  - 腐败三模式枚举（演义/史实/严格）
 *  - 虚报暴露具体算法
 *  - 诏书巨额支出 AI 预警奏疏
 */
(function(global) {
  'use strict';

  function _turnsForMonthsLocal(months) {
    return (typeof global.turnsForMonths === 'function') ? global.turnsForMonths(months) : months;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  14 源余下 hook 自动检测（填充 AuthorityComplete 中空余 hook）
  // ═══════════════════════════════════════════════════════════════════

  function _detectAdditionalHuangweiEvents(ctx, mr) {
    var G = global.GM;
    if (!G.huangwei) return;
    // brokenPromise：许诺未兑现（detect 方案：官员近3回合内承诺未落地）
    if (!G._huangweiDetect) G._huangweiDetect = { brokenPromiseCheckedTurns: {} };
    var dt = G._huangweiDetect;
    // 承诺：皇帝宣布但未执行
    (G._imperialPromises || []).forEach(function(p) {
      if (p.fulfilled) return;
      // ★2026-07-01 W5·兑现检测(宽松·偏袒玩家避误罚):promote 类若该臣官职较许诺时有变→视为践诺·标 fulfilled 并谢恩记忆
      var _pch = (G.chars || []).filter(function(c){ return c && c.name === p.npc; })[0];
      if (_pch && (p.kind === 'promote' || !p.kind)) {
        // ★codex-fix W5:兑现须是「真升迁」·非任意 title 变化(旧码 title 一变就 fulfilled·致平调/降职/无关任命都被当践诺·玩家借降职逃避食言之罚)。
        //   rankLevel 1=正一品最高·升迁=数值下降。平调(rank同)/降职(rank升)不算;原本无官(snapRank null)后授实职亦算兑现该「加官」诺。
        var _nowTitle = (_pch.officialTitle || _pch.title || '');
        var _nowRank = (typeof _pch.rankLevel === 'number') ? _pch.rankLevel : null;
        var _promoted = (_nowRank != null && p._snapRank != null && _nowRank < p._snapRank);
        var _gotOffice = (p._snapRank == null && _nowRank != null && _nowTitle && _nowTitle !== (p._snapTitle || ''));
        if (_promoted || _gotOffice) {
          p.fulfilled = true;
          if (typeof global.NpcMemorySystem !== 'undefined') { try { global.NpcMemorySystem.remember(p.npc, '陛下践诺·擢臣以职·感佩圣恩', '敬', 6, '天子'); } catch (_e1) {} }
          return;
        }
      }
      if ((ctx.turn - p.promiseTurn) > _turnsForMonthsLocal(3) && !p._brokenFired) {
        p._brokenFired = true;
        // ★2026-07-01 W5·食言:铁证逾期(逾3月)仍未兑现→掉该臣忠诚/加压+入怨恨记忆(每诺仅一次)·再触发皇威 brokenPromise
        if (_pch && !p._npcReneged) {
          p._npcReneged = true;
          if (typeof _pch.loyalty === 'number') _pch.loyalty = Math.max(0, _pch.loyalty - 8);
          if (typeof _pch.stress === 'number') _pch.stress = Math.min(100, _pch.stress + 6);
          _pch._promiseBrokenByPlayer = (_pch._promiseBrokenByPlayer || 0) + 1;
          if (typeof global.NpcMemorySystem !== 'undefined') { try { global.NpcMemorySystem.remember(p.npc, '圣意反复·许而不予（' + (p.detail || '恩赏') + '）·臣心黯然', '怨', 7, '天子'); } catch (_e2) {} }
        }
        if (typeof global.AuthorityComplete !== 'undefined') {
          global.AuthorityComplete.triggerHuangweiEvent('brokenPromise', {});
        }
      }
    });
    // deposeFailure：废立未遂
    if (G._recentDeposeAttempt && !G._recentDeposeAttempt._hwFired) {
      G._recentDeposeAttempt._hwFired = true;
      if (!G._recentDeposeAttempt.succeeded && typeof global.AuthorityComplete !== 'undefined') {
        global.AuthorityComplete.triggerHuangweiEvent('deposeFailure', {});
      }
    }
    // familyScandal：皇室丑闻
    var scandal = (G.chars || []).find(function(c){
      return c.alive !== false && (c.role === 'empress' || c.role === 'consort' || c.role === 'imperial_child') && c._recentScandal && !c._scandalHwFired;
    });
    if (scandal) {
      scandal._scandalHwFired = true;
      if (typeof global.AuthorityComplete !== 'undefined') {
        global.AuthorityComplete.triggerHuangweiEvent('familyScandal', {});
      }
    }
  }

  function _detectAdditionalHuangquanEvents(ctx, mr) {
    var G = global.GM;
    if (!G.huangquan) return;
    // cabinetization：制度化（内阁/军机处等）
    if (!G._cabinetInstitutionEverFired && G.dynamicInstitutions) {
      var cabinetish = G.dynamicInstitutions.some(function(inst) {
        return /内阁|军机|议政/.test(inst.name || '');
      });
      if (cabinetish) {
        G._cabinetInstitutionEverFired = true;
        if (typeof global.AuthorityComplete !== 'undefined') {
          global.AuthorityComplete.triggerHuangquanEvent('cabinetization', {});
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  密诏完整流程
  // ═══════════════════════════════════════════════════════════════════

  function dispatchSecretEdict(targetOfficial, edictType, content) {
    var G = global.GM;
    if (!G._secretEdicts) G._secretEdicts = [];
    var pm = G.huangquan && G.huangquan.powerMinister;
    if (!pm) return { ok: false, reason: '无需密诏' };
    var target = (G.chars || []).find(function(c){return c.name===targetOfficial;});
    if (!target || target.alive === false) return { ok: false, reason: '目标不存在' };
    // 泄露风险：与权臣党羽接近 + 忠诚度低
    var loyalty = target.loyalty || 50;
    var isAlly = (pm.faction || []).indexOf(targetOfficial) >= 0;
    var leakRisk = 0.2;
    if (isAlly) leakRisk = 0.7;
    else if (loyalty < 40) leakRisk = 0.5;
    else if (loyalty > 80) leakRisk = 0.05;
    var leaked = Math.random() < leakRisk;
    var se = {
      id: 'se_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
      target: targetOfficial,
      edictType: edictType,
      content: content,
      turn: G.turn || 0,
      leaked: leaked,
      status: leaked ? 'compromised' : 'delivered'
    };
    G._secretEdicts.push(se);
    if (leaked) {
      // 权臣反扑
      pm.controlLevel = Math.min(1, (pm.controlLevel || 0.3) + 0.1);
      if (typeof global.AuthorityEngines !== 'undefined' && global.AuthorityEngines.adjustHuangquan) {
        global.AuthorityEngines.adjustHuangquan('memorialObjection', -3, '\u5bc6\u8bcf\u6cc4\u9732');
      } else if (typeof G.huangquan === 'object') G.huangquan.index = Math.max(0, G.huangquan.index - 3);
      if (global.addEB) global.addEB('密诏', '密诏泄露，权臣反扑');
    } else {
      // 成功：目标官员可执行密令
      target._secretOrder = edictType;
      pm.controlLevel = Math.max(0, (pm.controlLevel || 0.3) - 0.08);
      if (typeof global.AuthorityEngines !== 'undefined' && global.AuthorityEngines.adjustHuangquan) {
        global.AuthorityEngines.adjustHuangquan('personalRule', 3, '\u5bc6\u8bcf\u89c1\u6548');
      } else if (typeof G.huangquan === 'object') G.huangquan.index = Math.min(100, G.huangquan.index + 3);
      if (global.addEB) global.addEB('密诏', targetOfficial + ' 暗受密诏');
    }
    return { ok: !leaked, secretEdict: se };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  结构改革永久后世效果
  // ═══════════════════════════════════════════════════════════════════

  /** 永久性改革的长效影响注入下一朝 */
  function applyPermanentReformLegacy(reformId) {
    var G = global.GM;
    if (!G._permanentReforms) G._permanentReforms = [];
    var legacy = {
      id: reformId,
      enactedTurn: G.turn || 0,
      enactedDynasty: G.dynasty || '某',
      effects: {}
    };
    if (reformId === 'abolishChancellor') {
      // 废相：后世 memorial 翻倍
      legacy.effects.memorialBurdenMult = 2.0;
      legacy.effects.emperorWorkloadMult = 1.5;
      if (typeof global.AuthorityEngines !== 'undefined' && global.AuthorityEngines.adjustHuangquan) {
        global.AuthorityEngines.adjustHuangquan('structureReform', 10, '\u5e9f\u9664\u5bb0\u76f8');
      } else if (typeof G.huangquan === 'object') G.huangquan.index = Math.min(100, G.huangquan.index + 10);
    } else if (reformId === 'establishJunji') {
      // 立军机处：皇权加强 + 决策加速
      legacy.effects.decisionSpeedMult = 1.5;
      legacy.effects.centralizationBonus = 10;
      if (typeof global.AuthorityEngines !== 'undefined' && global.AuthorityEngines.adjustHuangquan) {
        global.AuthorityEngines.adjustHuangquan('structureReform', 12, '\u8bbe\u7acb\u519b\u673a\u5904');
      } else if (typeof G.huangquan === 'object') G.huangquan.index = Math.min(100, G.huangquan.index + 12);
    } else if (reformId === 'gaituGuiliu') {
      // 改土归流：羁縻减少
      legacy.effects.jimiLoyaltyDecay = 0.01;
    }
    G._permanentReforms.push(legacy);
    if (global.addEB) global.addEB('永制', '永制 ' + reformId + ' 立，后世承受');
    return legacy;
  }

  /** 每回合应用永久改革遗产 */
  function _tickPermanentReforms(ctx, mr) {
    var G = global.GM;
    if (!G._permanentReforms) return;
    G._permanentReforms.forEach(function(legacy) {
      if (legacy.effects.memorialBurdenMult) {
        // 奏疏数量翻倍
        G._memorialBurdenMult = legacy.effects.memorialBurdenMult;
      }
      if (legacy.effects.jimiLoyaltyDecay && G.population && G.population.jimiHoldings) {
        G.population.jimiHoldings.forEach(function(h) {
          h.loyalty = Math.max(0, (h.loyalty || 60) - legacy.effects.jimiLoyaltyDecay * mr);
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  民心 9 旧分类映射（士农工商兵僧胥役豪强流民）
  // ═══════════════════════════════════════════════════════════════════

  var OLD_TO_NEW_CLASS_MAP = {
    'shi':    ['scholar','gentry_mid','gentry_high'],        // 士
    'nong':   ['peasant_self','peasant_tenant'],              // 农
    'gong':   ['craftsman'],                                   // 工
    'shang':  ['merchant'],                                    // 商
    'bing':   [],                                              // 兵（无直接对应，用 military 字段）
    'seng':   ['clergy'],                                      // 僧
    'xu':     [],                                              // 胥（无直接对应）
    'yi':     ['debased'],                                     // 役
    'haoqiang':['landlord','gentry_high'],                     // 豪强
    'liumin': []                                               // 流民（用 fugitives 字段）
  };

  function getMinxinByOldClass(oldClassId) {
    var G = global.GM;
    if (!G.minxin || !G.minxin.byClass) return 60;
    var newCls = OLD_TO_NEW_CLASS_MAP[oldClassId] || [];
    if (newCls.length === 0) return G.minxin.trueIndex || 60;
    var sum = 0, count = 0;
    newCls.forEach(function(c) {
      if (G.minxin.byClass[c] && G.minxin.byClass[c].index !== undefined) {
        sum += G.minxin.byClass[c].index;
        count++;
      }
    });
    return count > 0 ? sum / count : (G.minxin.trueIndex || 60);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  民变干预权重数值化
  // ═══════════════════════════════════════════════════════════════════

  var REVOLT_INTERVENTION_WEIGHTS = {
    investigate: {
      // 派员查访
      successRate: { 1: 0.7, 2: 0.5, 3: 0.3, 4: 0.15, 5: 0.05 },
      cost: 50000,
      duration: 1
    },
    relief: {
      // 赈济（效果最好于 L1-L2 灾荒引起的）
      successRate: { 1: 0.9, 2: 0.75, 3: 0.5, 4: 0.25, 5: 0.1 },
      cost: 200000,
      duration: 1
    },
    pacify: {
      // 招安（效果最好于 L2-L4 有领袖的）
      successRate: { 1: 0.5, 2: 0.7, 3: 0.65, 4: 0.4, 5: 0.15 },
      cost: 100000,
      duration: 2
    },
    suppress: {
      // 弹压（L3+ 有效，L1 反而激化）
      successRate: { 1: 0.3, 2: 0.5, 3: 0.75, 4: 0.6, 5: 0.3 },
      cost: 0,  // 仅费兵
      duration: 3,
      minxinPenalty: -6
    }
  };

  function computeRevoltInterventionOutcome(revoltLevel, action) {
    var w = REVOLT_INTERVENTION_WEIGHTS[action];
    if (!w) return { ok: false };
    var rate = w.successRate[revoltLevel] || 0.3;
    return {
      successProbability: rate,
      cost: w.cost,
      duration: w.duration,
      expectedMinxinDelta: w.minxinPenalty || 0
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  同期多地起义激励系数
  // ═══════════════════════════════════════════════════════════════════

  function _applyMultiRebellionInspiration(ctx, mr) {
    var G = global.GM;
    if (!G.minxin || !G.minxin.revolts) return;
    var ongoing = G.minxin.revolts.filter(function(r){return r.status==='ongoing';});
    if (ongoing.length < 2) return;
    // 每多 1 地 +5% 升级概率
    var inspirationMult = 1 + (ongoing.length - 1) * 0.05;
    ongoing.forEach(function(r) {
      r._multiInspiration = inspirationMult;
      // 加速升级（高概率升级）
      if (r.level < 5 && Math.random() < 0.01 * inspirationMult * mr) {
        r.level++;
        if (global.addEB) global.addEB('民变', '响 ' + ongoing.length + ' 地同起，' + (r.region || '某地') + ' 升一级');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  改革容忍度接入 decreeParser
  // ═══════════════════════════════════════════════════════════════════

  function _patchDecreeParserWithTolerance() {
    if (typeof global.EdictParser === 'undefined' || global.EdictParser._toleranceChecked) return;
    global.EdictParser._toleranceChecked = true;
    var origClassify = global.EdictParser.classify;
    global.EdictParser.classify = function(text, ctx) {
      var result = origClassify.call(global.EdictParser, text, ctx);
      // 注入改革风险判定
      var G = global.GM;
      var mx = G.minxin && G.minxin.trueIndex || 60;
      var reformTolerance = G._reformToleranceMult || 1.0;
      // 若民心低（< 30） + 重大诏令（importance > 0.7）→ 高风险标记
      if (mx < 30 && result.importance > 0.7) {
        result.reformRisk = 'critical';
        result.warning = '民心崩溃在即（' + Math.round(mx) + '），此诏恐激民变';
      } else if (mx < 50 && result.importance > 0.6) {
        result.reformRisk = 'high';
        result.warning = '民心未固，宜缓行';
      } else {
        result.reformRisk = 'normal';
      }
      result.reformToleranceMult = reformTolerance;
      return result;
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  腐败三模式枚举
  // ═══════════════════════════════════════════════════════════════════

  var CORRUPTION_GAMEMODES = {
    strict: {
      name:'严格史实',
      corruptionVisibility: 0.2,    // 玩家看到真值 20%，其余需查
      memorialFlaggingEnabled: false,
      objectionThreshold: 0.5,
      description:'如古代皇帝，需自己察觉弊政'
    },
    'light-history': {
      name:'轻度史实',
      corruptionVisibility: 0.5,
      memorialFlaggingEnabled: false,
      objectionThreshold: 0.4,
      description:'史实还原 + 少量揭示'
    },
    romance: {
      name:'演义模式',
      corruptionVisibility: 1.0,
      memorialFlaggingEnabled: true,    // 奏疏标红贪腐条款
      objectionThreshold: 0.7,
      description:'全透明，AI 标注问题条款'
    }
  };

  function getCurrentCorruptionMode() {
    var G = global.GM;
    var mode = G && G._gameMode || 'light-history';
    return CORRUPTION_GAMEMODES[mode] || CORRUPTION_GAMEMODES['light-history'];
  }

  // ═══════════════════════════════════════════════════════════════════
  //  虚报暴露算法
  // ═══════════════════════════════════════════════════════════════════

  function detectFraudulentReports(ctx) {
    var G = global.GM;
    if (!G.fiscal || !G.fiscal.regions) return;
    var auditStrength = (G.auditSystem && G.auditSystem.strength) || 0.3;
    var mode = getCurrentCorruptionMode();
    Object.keys(G.fiscal.regions).forEach(function(rid) {
      var reg = G.fiscal.regions[rid];
      if (!reg.peasantBurden) return;
      var claimed = reg.peasantBurden.claimed || 0;
      var actual = reg.peasantBurden.actual || claimed;
      var diff = claimed - actual;
      var diffRatio = claimed > 0 ? diff / claimed : 0;
      // 暴露条件：差额 > 15% + 监察强度足够
      var exposeProb = (diffRatio - 0.15) * auditStrength * 2;
      if (diffRatio > 0.15 && Math.random() < exposeProb) {
        // 虚报暴露
        var recovered = Math.floor(diff * 0.5);
        if (G.guoku) G.guoku.money += recovered;
        reg.peasantBurden.claimed = actual;  // 回正
        // 地方官追责
        var gov = (G.chars || []).find(function(c){return c.alive !== false && c.region === rid && c.officialTitle;});
        if (gov && Math.random() < 0.4) {
          gov.alive = false;
          gov._purgedTurn = ctx.turn;
        }
        if (global.addEB) global.addEB('暴露', rid + ' 虚报 ' + diff + '，追回 ' + recovered);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  诏书巨额支出 AI 预警奏疏
  // ═══════════════════════════════════════════════════════════════════

  function checkLumpSumWarning(decreeText, extractedAmount) {
    var G = global.GM;
    if (!G.guoku) return null;
    var annual = G.guoku.annualIncome || 10000000;
    if (!extractedAmount || extractedAmount < annual * 0.1) return null;
    // 生成预警奏疏
    var warning = {
      id: 'lw_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
      drafter: '户部尚书',
      turn: G.turn || 0,
      subject: '劝谏巨额支出',
      content: '陛下此诏所动帑者 ' + Math.round(extractedAmount/10000) + ' 万（年入之 ' + Math.round(extractedAmount/annual*100) + '%），户部国计恐难周全',
      level: extractedAmount > annual * 0.3 ? 'critical' : 'warning',
      status: 'pending'
    };
    if (!G._lumpSumWarnings) G._lumpSumWarnings = [];
    G._lumpSumWarnings.push(warning);
    if (global.addEB) global.addEB('劝谏', '户部劝谏：' + warning.content);
    return warning;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Tick + Init
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    try { _detectAdditionalHuangweiEvents(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF4] hwDetect:') : console.error('[phaseF4] hwDetect:', e); }
    try { _detectAdditionalHuangquanEvents(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF4] hqDetect:') : console.error('[phaseF4] hqDetect:', e); }
    try { _tickPermanentReforms(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF4] permReforms:') : console.error('[phaseF4] permReforms:', e); }
    try { _applyMultiRebellionInspiration(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF4] multiRev:') : console.error('[phaseF4] multiRev:', e); }
    try { detectFraudulentReports(ctx); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF4] fraud:') : console.error('[phaseF4] fraud:', e); }
  }

  function init() {
    _patchDecreeParserWithTolerance();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.PhaseF4 = {
    init: init,
    tick: tick,
    dispatchSecretEdict: dispatchSecretEdict,
    applyPermanentReformLegacy: applyPermanentReformLegacy,
    getMinxinByOldClass: getMinxinByOldClass,
    computeRevoltInterventionOutcome: computeRevoltInterventionOutcome,
    getCurrentCorruptionMode: getCurrentCorruptionMode,
    detectFraudulentReports: detectFraudulentReports,
    checkLumpSumWarning: checkLumpSumWarning,
    OLD_TO_NEW_CLASS_MAP: OLD_TO_NEW_CLASS_MAP,
    REVOLT_INTERVENTION_WEIGHTS: REVOLT_INTERVENTION_WEIGHTS,
    CORRUPTION_GAMEMODES: CORRUPTION_GAMEMODES,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
