// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-env-recovery-fill.js — 环境恢复政策 + §9 联动补完
 *
 * 实施 设计方案-环境承载力.md 缺失部分：
 *  - Ⅳ 生态恢复（显式 RECOVERY_POLICIES）
 *  - §9 全部联动（民心/帑廪/皇权/腐败双向）
 *  - 气候 × 人口 modifier 实际应用
 *  - 技术解锁与推行机制
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  显式恢复政策（10 类）
  // ═══════════════════════════════════════════════════════════════════

  var RECOVERY_POLICIES = {
    reforest:       { name:'植林',       target:'deforestation',        rate:0.008, cost:{ money:80000 } },
    soil_terrace:   { name:'梯田水保',   target:'soilErosion',          rate:0.006, cost:{ money:60000 } },
    leach_salt:     { name:'引水压盐',   target:'salinization',         rate:0.005, cost:{ money:70000 } },
    green_belt:     { name:'固沙绿带',   target:'desertification',      rate:0.004, cost:{ money:90000 } },
    well_deepen:    { name:'深井复水',   target:'waterTableDrop',       rate:0.005, cost:{ money:50000 } },
    dredge:         { name:'大浚河道',   target:'riverSilting',         rate:0.010, cost:{ money:120000 } },
    reserve_park:   { name:'设围场保物种',target:'biodiversityLoss',    rate:0.003, cost:{ money:40000 } },
    fallow_rotate:  { name:'休耕养地',   target:'soilFertilityLoss',    rate:0.008, cost:{ money:30000, grain:30000 } },
    sewage_clean:   { name:'清污浚沟',   target:'urbanSewageOverload',  rate:0.007, cost:{ money:60000 } },
    disaster_relief_eco:{ name:'救荒复原', target:'multi',              rate:0.003, cost:{ money:100000 } }
  };

  function enactRecovery(policyId, regionId) {
    var policy = RECOVERY_POLICIES[policyId];
    if (!policy) return { ok: false, reason: '未知恢复政策' };
    var E = global.GM.environment;
    if (!E) return { ok: false, reason: '环境未初始化' };
    var cost = policy.cost || {};
    if (cost.money && global.GM.guoku && (global.GM.guoku.money || 0) < cost.money) return { ok: false, reason: '帑廪不足' };
    if (cost.grain && global.GM.guoku && (global.GM.guoku.grain || 0) < cost.grain) return { ok: false, reason: '粮库不足' };
    // 国库支出走 FiscalEngine 真账(2026-07-04 收口)
    if ((cost.money || cost.grain) && global.FiscalEngine && global.FiscalEngine.spendFromGuoku) {
      global.FiscalEngine.spendFromGuoku({ money: cost.money || 0, grain: cost.grain || 0 }, '生态复育');
    }
    if (!E.activeRecoveries) E.activeRecoveries = [];
    E.activeRecoveries.push({
      policyId: policyId,
      regionId: regionId || 'all',
      startTurn: global.GM.turn || 0,
      duration: 36 // 3 年
    });
    if (global.addEB) global.addEB('环政', '推行 ' + policy.name + (regionId ? '（' + regionId + '）' : '（全国）'));
    return { ok: true };
  }

  function _tickRecoveries(mr) {
    var E = global.GM.environment;
    if (!E || !E.activeRecoveries) return;
    E.activeRecoveries.forEach(function(rec) {
      var policy = RECOVERY_POLICIES[rec.policyId];
      if (!policy) return;
      Object.keys(E.byRegion).forEach(function(rid) {
        if (rec.regionId !== 'all' && rec.regionId !== rid) return;
        var reg = E.byRegion[rid];
        if (policy.target === 'multi') {
          // 一次恢复所有疤痕
          ['deforestation','soilErosion','waterTableDrop','riverSilting','soilFertilityLoss'].forEach(function(t) {
            reg.ecoScars[t] = Math.max(0, (reg.ecoScars[t] || 0) - policy.rate * 0.3 * mr);
          });
        } else {
          reg.ecoScars[policy.target] = Math.max(0, (reg.ecoScars[policy.target] || 0) - policy.rate * mr);
        }
      });
    });
    // 过期清理
    E.activeRecoveries = E.activeRecoveries.filter(function(r) {
      return ((global.GM.turn || 0) - r.startTurn) < r.duration;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  §9 全联动 — 民心/帑廪/皇权/腐败
  // ═══════════════════════════════════════════════════════════════════

  function _applyFullCoupling(mr) {
    var G = global.GM;
    var E = G.environment;
    if (!E) return;
    // 9.1 疤痕→民心（已在 env 引擎有基础，此处精细化）
    var avgScar = _computeAvgScar(E);
    if (global._adjAuthority) {
      if (avgScar > 0.6) global._adjAuthority('minxin', -(avgScar - 0.6) * 1.5 * mr);
      else if (avgScar < 0.2) {
        var _mxV2 = (G.minxin && typeof G.minxin === 'object' ? G.minxin.trueIndex : G.minxin) || 60;
        if (_mxV2 < 80) global._adjAuthority('minxin', 0.2 * mr);
      }
    }
    // 9.2 承载力 × 民心段位
    if (global._adjAuthority && E.nationalLoad > 1.2) {
      var penalty = (E.nationalLoad - 1.2) * 3;
      global._adjAuthority('minxin', -penalty * mr);
    }
    // 9.3 环保政策 × 帑廪代价（已在 enactPolicy 实现）
    // 9.4 环保政策 × 皇权可行度（推政策需一定皇权）
    var activePolicies = (E.activePolicies || []).length + (E.activeRecoveries || []).length;
    if (activePolicies > 3 && global._adjAuthority) {
      global._adjAuthority('huangquan', -0.1 * mr, '\u73af\u653f\u4e8b\u52a1\u8fc7\u591a\u7275\u5236\u4e2d\u67a2', { source:'environment-active-policies' });
    }
    // 9.5 腐败对环政效率的折损
    var corr = G.corruption && typeof G.corruption === 'object'
      ? (typeof G.corruption.trueIndex === 'number' ? G.corruption.trueIndex : G.corruption.overall)
      : G.corruption;
    if (typeof corr !== 'number' || !isFinite(corr)) corr = 30;
    if (corr > 50 && E.activePolicies) {
      // 腐败高 → 实际疤痕减速减半
      E._corruptionEcoLoss = (corr - 50) / 100;
    } else {
      E._corruptionEcoLoss = 0;
    }
  }

  function _computeAvgScar(E) {
    var total = 0, n = 0;
    Object.values(E.byRegion || {}).forEach(function(r) {
      Object.values(r.ecoScars || {}).forEach(function(v) { total += v; n++; });
    });
    return n > 0 ? total / n : 0;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  气候 × 人口 实际 modifier
  // ═══════════════════════════════════════════════════════════════════

  function applyClimateMultiplier() {
    var G = global.GM;
    var E = G.environment;
    if (!E) return 1.0;
    if (E.climatePhase === 'little_ice_age') return 0.75;
    if (E.climatePhase === 'medieval_warm') return 1.15;
    return 1.0;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  技术推行机制
  // ═══════════════════════════════════════════════════════════════════

  var TECH_DECREE_PATTERNS = [
    { re:/兴.*水利|修.*渠|浚.*河/, tech:'irrigation', boost:1 },
    { re:/推广.*稻|引进.*种|改.*种/, tech:'seedSelection', boost:1 },
    { re:/改.*犁|铁.*具|农.*具/, tech:'toolImprovement', boost:1 },
    { re:/堆肥|施.*粪|养.*地/, tech:'fertilizer', boost:1 },
    { re:/推广.*玉米|推广.*红薯|推广.*马铃薯/, tech:'agriculture', boost:2 }
  ];

  function parseTechDecree(text) {
    var E = global.GM.environment;
    if (!E) return { ok: false };
    var matched = TECH_DECREE_PATTERNS.find(function(p) { return p.re.test(text); });
    if (!matched) return { ok: false };
    // 升级全国技术
    Object.values(E.byRegion).forEach(function(r) {
      if (r.techLevel) r.techLevel[matched.tech] = (r.techLevel[matched.tech] || 1) + matched.boost;
    });
    if (global.addEB) global.addEB('技术', '技术 ' + matched.tech + ' 提升');
    return { ok: true, tech: matched.tech };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  tick + init
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    try { _tickRecoveries(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'envRec] recoveries:') : console.error('[envRec] recoveries:', e); }
    try { _applyFullCoupling(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'envRec] coupling:') : console.error('[envRec] coupling:', e); }
  }

  function init() {
    // 无需专门 init
  }

  global.EnvRecoveryFill = {
    init: init,
    tick: tick,
    enactRecovery: enactRecovery,
    parseTechDecree: parseTechDecree,
    applyClimateMultiplier: applyClimateMultiplier,
    RECOVERY_POLICIES: RECOVERY_POLICIES,
    TECH_DECREE_PATTERNS: TECH_DECREE_PATTERNS,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
