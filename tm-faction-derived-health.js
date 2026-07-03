// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-faction-derived-health.js — 势力派生健康度 (Layer 3·2026-05-10)
 *
 * 把势力的孤立 stat (strength/legitimacy/morale/stability) 接入下属人物/军队的真实状态。
 * 4 个派生量·写到 GM.facs[i].derivedHealth·依赖 GM._facIndex (Layer 2)。
 *
 * 公式 (0-100·越高越好):
 *   courtCohesion       朝堂凝聚 = 100 − partyImbalance×50 − clamp(50−avgLoyalty)/2
 *                       含义：党争失衡 + 朝臣忠诚低 → 凝聚差
 *   militaryControl     军权集中 = 100 − privatizedRatio×100
 *                       含义：将领家丁化越重·中央军权越散
 *   personnelHealth     人事健康 = avgLoyalty − 5×arrearsArmies
 *                       含义：忠诚度均值减去欠饷军惩罚 (拖欠饷银直接侵蚀人心)
 *   militaryStability   兵权稳健 = 100 − avgMutinyRisk − (arrearsRatio×50)
 *                       含义：兵变风险均值 + 欠饷军比例·两个直接的边军塌陷信号
 *   overall             综合 = 4 项算术平均
 *
 * 阈值标签:
 *   >=70 健 / 50-69 平 / 30-49 弱 / <30 危
 */
(function(global) {
  'use strict';

  // [Slice M·2026-05-10] 阈值 + 公式系数参数化·剧本/AI/UI 可 override
  // 默认值与 Slice L 后的体感校准·明末 1627 期望 overall 30-45·乱世应入 弱/危
  var DEFAULTS = {
    thresholds: { hao: 70, ping: 50, ruo: 30 },  // 健/平/弱/危 边界
    coeffs: {
      partyImbalanceWeight: 50,        // courtCohesion: 党争失衡 0-1 → 0-50 扣分
      loyaltyDeficitDivisor: 2,        // courtCohesion: 忠诚不足 / 2
      arrearsArmiesPerUnitPenalty: 5,  // personnelHealth: 每支欠饷军 -5
      arrearsRatioWeight: 50           // militaryStability: 欠饷比 0-1 → 0-50 扣分
    },
    fallbacks: {
      noChars: 50,    // 无朝臣时 courtCohesion + personnelHealth
      noArmies: 50    // 无军队时 militaryControl + militaryStability
    }
  };

  function _config() {
    // 优先 P.derivedHealthConfig·其次 TM.FactionDerived.config·否则默认
    var p = (typeof global.P !== 'undefined' && global.P && global.P.derivedHealthConfig) || null;
    var t = (global.TM && global.TM.FactionDerived && global.TM.FactionDerived.config) || null;
    var override = p || t;
    if (!override) return DEFAULTS;
    return {
      thresholds: Object.assign({}, DEFAULTS.thresholds, override.thresholds || {}),
      coeffs: Object.assign({}, DEFAULTS.coeffs, override.coeffs || {}),
      fallbacks: Object.assign({}, DEFAULTS.fallbacks, override.fallbacks || {})
    };
  }

  function _clamp(v, lo, hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }

  function _label(v, cfg) {
    cfg = cfg || _config();
    var t = cfg.thresholds;
    if (v >= t.hao) return '健';
    if (v >= t.ping) return '平';
    if (v >= t.ruo) return '弱';
    return '危';
  }

  // Phase E1·paradigm 反向: 游牧/满洲·controlLevel 高 = 汗亲集权 (好)·非私兵化
  // central_empire / military_jiedushi: 高 controlLevel = 私兵化 (将领家丁)·mc = 100 - priv×100 (传统公式)
  // manchu_empire / mongol_tribe / native_chieftain / rebellion / remnant_dynasty:
  //     高 controlLevel = 集权 (汗亲领旗·土司直辖·首领直统)·mc = priv×100 (反向)
  // tributary_kingdom / european_outpost / maritime_merchant: 中性·mc = 50 + (priv-0.5)×40 (温和)
  var PARADIGM_MC_INVERTED = {
    central_empire: false,
    military_jiedushi: false,
    manchu_empire: true,
    mongol_tribe: true,
    native_chieftain: true,
    rebellion: true,
    remnant_dynasty: true,
    tributary_kingdom: 'neutral',
    european_outpost: 'neutral',
    maritime_merchant: 'neutral',
    generic: false  // 默认按中央帝国 paradigm
  };

  function _militaryControlByParadigm(privatizedRatio, paradigm) {
    var p = PARADIGM_MC_INVERTED[paradigm];
    if (p === true) {
      return _clamp(Math.round((privatizedRatio || 0) * 100), 0, 100);
    }
    if (p === 'neutral') {
      return _clamp(Math.round(50 + ((privatizedRatio || 0) - 0.5) * 20), 0, 100);
    }
    return _clamp(Math.round(100 - (privatizedRatio || 0) * 100), 0, 100);
  }

  function _computeOne(metrics, fac) {
    if (!metrics) return null;
    var cfg = _config();
    var c = cfg.coeffs;
    var fb = cfg.fallbacks;

    var hasChars = (metrics.charCount || 0) > 0;
    var hasArmies = (metrics.armyCount || 0) > 0;

    // paradigm·若 fac.name + utility 可达·按 paradigm 调 mc
    var paradigm = 'generic';
    if (fac && fac.name && global.TM && global.TM.FactionParadigm && global.TM.FactionParadigm.detect) {
      paradigm = global.TM.FactionParadigm.detect(fac.name, fac);
    }

    // courtCohesion: 党争失衡 × 系数 + 忠诚不足惩罚
    var partyPenalty = (metrics.partyImbalance || 0) * c.partyImbalanceWeight;
    var loyaltyDeficit = hasChars
      ? Math.max(0, 50 - (metrics.avgLoyalty || 0)) / c.loyaltyDeficitDivisor
      : 0;
    var courtCohesion = hasChars
      ? _clamp(Math.round(100 - partyPenalty - loyaltyDeficit), 0, 100)
      : fb.noChars;

    // militaryControl: paradigm-aware (E1)
    var militaryControl = hasArmies
      ? _militaryControlByParadigm(metrics.privatizedRatio || 0, paradigm)
      : fb.noArmies;

    // personnelHealth: avgLoyalty − 系数×欠饷军数·无朝臣 → fallback
    var personnelHealth = hasChars
      ? _clamp(Math.round((metrics.avgLoyalty || 0) - c.arrearsArmiesPerUnitPenalty * (metrics.arrearsArmies || 0)), 0, 100)
      : fb.noChars;

    // militaryStability: 100 − avgMutinyRisk − 欠饷比×系数·无军队 → fallback
    var militaryStability;
    if (hasArmies) {
      var arrearsRatio = (metrics.arrearsArmies || 0) / metrics.armyCount;
      militaryStability = _clamp(Math.round(100 - (metrics.avgMutinyRisk || 0) - arrearsRatio * c.arrearsRatioWeight), 0, 100);
    } else {
      militaryStability = fb.noArmies;
    }

    // territorialControl(2026-07-03·断链B)：4指标原对地块全盲——失土动荡/民变四起不动健康度。
    // FactionIndex rebuild 产 metrics.territoryStress(省均动荡·0-100 高=糟)·有账才入第五指标·无账维持四指标均值(老存档零回归)。
    var territorialControl = (typeof metrics.territoryStress === 'number')
      ? _clamp(Math.round(100 - metrics.territoryStress), 0, 100)
      : null;
    var _comps = [courtCohesion, militaryControl, personnelHealth, militaryStability];
    if (territorialControl !== null) _comps.push(territorialControl);
    var _sum = 0;
    for (var _ci = 0; _ci < _comps.length; _ci += 1) _sum += _comps[_ci];
    var overall = Math.round(_sum / _comps.length);

    return {
      courtCohesion: courtCohesion,
      militaryControl: militaryControl,
      personnelHealth: personnelHealth,
      militaryStability: militaryStability,
      territorialControl: territorialControl,
      overall: overall,
      labels: {
        courtCohesion: _label(courtCohesion, cfg),
        militaryControl: _label(militaryControl, cfg),
        personnelHealth: _label(personnelHealth, cfg),
        militaryStability: _label(militaryStability, cfg),
        territorialControl: territorialControl !== null ? _label(territorialControl, cfg) : '未记',
        overall: _label(overall, cfg)
      },
      // 来源指标·便于 UI tooltip / 调试
      _source: {
        partyImbalance: metrics.partyImbalance || 0,
        avgLoyalty: metrics.avgLoyalty || 0,
        privatizedRatio: metrics.privatizedRatio || 0,
        avgMutinyRisk: metrics.avgMutinyRisk || 0,
        arrearsArmies: metrics.arrearsArmies || 0,
        armyCount: metrics.armyCount || 0,
        territoryStress: (typeof metrics.territoryStress === 'number') ? metrics.territoryStress : null
      }
    };
  }

  function compute() {
    if (typeof global.GM === 'undefined') return null;
    var GM = global.GM;
    if (!Array.isArray(GM.facs) || !GM._facIndex) return null;

    var out = {};
    GM.facs.forEach(function(f) {
      if (!f || !f.name) return;
      var entry = GM._facIndex[f.name];
      if (!entry) return;
      var dh = _computeOne(entry.metrics, f);  // E1·传 fac 让 paradigm-aware
      if (dh) {
        f.derivedHealth = dh;
        out[f.name] = dh;
      }
    });
    return out;
  }

  function getFor(facName) {
    if (typeof global.GM === 'undefined') return null;
    if (!Array.isArray(global.GM.facs)) return null;
    var f = global.GM.facs.find(function(x){ return x && x.name === facName; });
    return (f && f.derivedHealth) || null;
  }

  global.TM = global.TM || {};
  global.TM.FactionDerived = {
    compute: compute,
    getFor: getFor,
    _computeOne: _computeOne,   // 导出便于 smoke 测纯函数
    DEFAULTS: DEFAULTS,         // Slice M·公开默认值
    config: null,               // override·设为 {thresholds, coeffs, fallbacks}
    _label: _label              // 暴露 label fn (含 cfg 参数)
  };
})(typeof window !== 'undefined' ? window : globalThis);
