// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-faction-derived-economy.js — 势力派生经济 (Phase B1·2026-05-10)
 *
 * 与 tm-faction-derived-health.js 并列·都依赖 GM._facIndex (Layer 2)。
 * 把 fac.treasury / fac.economy / fac.militaryStrength 这些"硬填"的数值
 * 改造成可推算的 derivedEconomy·让 NPC 数值有 derivation chain·
 * AI 推演读 derived·UI tooltip 显示 source。
 *
 * 公式 (per year·与剧本 salary 字段单位对齐):
 *   militaryStrength      实际军总数 = sum(fac.members.armies[].soldiers)
 *   annualMilitaryCost    年军费 = sum(armies[].salary 各项·剧本默认年薪) ·钱+粮换算成"两"等价
 *   annualTaxIncome       年税入 = territoryCount × paradigm 年系数
 *   netFlow               收支差 = income − cost
 *   fiscalStress          财政压力 0-100 (100 = 最危)·= clamp(deficitRatio + 欠饷比)
 *   economyHealth         经济健 0-100·= 100 − fiscalStress
 *   labels                按 health 阈值 (健/平/弱/危·复用 derivedHealth.thresholds)
 *
 * 注：估算·非精算。tm-economy-engine.js 是 player 的精算引擎·NPC 不需要那精度·
 * 只需要"为什么 NPC 财政这么糟"的 derivation chain。
 */
(function(global) {
  'use strict';

  // 文化 paradigm·delegate 到 tm-faction-paradigm.js (Phase D1·共用 utility)
  // 旧本地版有 culture branch 太宽 bug·后金被错判 central_empire·迁出
  function _detectParadigm(facName, fac) {
    if (global.TM && global.TM.FactionParadigm && global.TM.FactionParadigm.detect) {
      return global.TM.FactionParadigm.detect(facName, fac);
    }
    return 'generic';  // fallback·避免 utility 未加载时崩
  }

  // paradigm → 年税入系数 (单位: 两·1 territory unit per year)
  // 史观参考·晚明 1 省年税 ≈ 600 万两上下 (太仓总年入 800 万两 ÷ 13 省)·此处取保守 50 万/省
  var TAX_COEF = {
    central_empire:    { money: 500000,   grain: 1000000 },  // 1 省/年 (晚明)
    manchu_empire:     { money: 50000,    grain: 200000  },  // 1 旗/年 (耕牧)
    mongol_tribe:      { money: 10000,    grain: 50000   },  // 1 部/年
    tributary_kingdom: { money: 200000,   grain: 400000  },
    european_outpost:  { money: 1500000,  grain: 5000    },  // 1 据点/年·商贸暴利
    maritime_merchant: { money: 800000,   grain: 50000   },
    native_chieftain:  { money: 30000,    grain: 200000  },
    rebellion:         { money: 0,        grain: 0       },  // 掠夺·非税
    military_jiedushi: { money: 200000,   grain: 400000  },
    remnant_dynasty:   { money: 30000,    grain: 100000  },
    generic:           { money: 80000,    grain: 200000  }
  };

  // 年军饷系数 (1 兵/年)·按 paradigm 调·只用于无 salary 数据的 fallback
  var SOLDIER_COST = {
    central_empire:    { money: 18, grain: 6 },   // 18 两 + 6 石/兵/年 (晚明)
    manchu_empire:     { money: 6,  grain: 12 },  // 八旗共有·钱少粮多
    mongol_tribe:      { money: 2,  grain: 6  },  // 自给牧
    tributary_kingdom: { money: 12, grain: 10 },
    european_outpost:  { money: 36, grain: 4  },  // 雇佣兵贵
    maritime_merchant: { money: 30, grain: 6  },
    native_chieftain:  { money: 4,  grain: 8  },
    rebellion:         { money: 0,  grain: 0  },  // 抢
    military_jiedushi: { money: 14, grain: 7  },
    remnant_dynasty:   { money: 6,  grain: 8  },
    generic:           { money: 12, grain: 6  }
  };

  // 粮等价·1 石粮 ≈ 0.5 两 (晚明米价)
  var GRAIN_TO_MONEY = 0.5;

  function _grainToMoney(grain) { return Math.round((grain || 0) * GRAIN_TO_MONEY); }

  function _safeNum(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function _clamp(v, lo, hi) { if (v < lo) return lo; if (v > hi) return hi; return v; }

  function _label(v) {
    // 复用 derivedHealth 的阈值
    var t = (global.TM && global.TM.FactionDerived && global.TM.FactionDerived.DEFAULTS && global.TM.FactionDerived.DEFAULTS.thresholds) || { hao: 70, ping: 50, ruo: 30 };
    var override = global.TM && global.TM.FactionDerived && global.TM.FactionDerived.config && global.TM.FactionDerived.config.thresholds;
    if (override) t = Object.assign({}, t, override);
    if (v >= t.hao) return '健';
    if (v >= t.ping) return '平';
    if (v >= t.ruo) return '弱';
    return '危';
  }

  function _computeOne(fac, entry) {
    if (!fac || !entry) return null;
    var paradigm = _detectParadigm(fac.name, fac);
    var taxCoef = TAX_COEF[paradigm] || TAX_COEF.generic;
    var costCoef = SOLDIER_COST[paradigm] || SOLDIER_COST.generic;

    // 1. militaryStrength·总兵
    var totalSoldiers = _safeNum(entry.metrics && entry.metrics.totalSoldiers);

    // 2. annualMilitaryCost·年军费 (剧本 salary 字段是年薪习惯)
    // 每支 army·若 salary 含 resource='钱'/'粮' → 累加货币值
    // 否则 (如后金"分地·份牛录"·非货币军费) → 按 paradigm 系数估
    var armies = (entry.armies || []);
    var costMoney = 0, costGrain = 0, hasSalaryArmies = 0, nonMonetaryArmies = 0;
    armies.forEach(function(a) {
      var s = Array.isArray(a.salary) ? a.salary : [];
      var aMoney = 0, aGrain = 0, hasMonetary = false;
      s.forEach(function(item){
        if (!item || !item.resource) return;
        var amt = _safeNum(item.amount);
        if (item.resource === '钱') { aMoney += amt; hasMonetary = true; }
        else if (item.resource === '粮食' || item.resource === '粮') { aGrain += amt; hasMonetary = true; }
      });
      if (hasMonetary) {
        costMoney += aMoney;
        costGrain += aGrain;
        hasSalaryArmies++;
      } else {
        // 非货币军饷·按 paradigm 估这支军的 cost
        var n = _safeNum(a.soldiers || a.size);
        costMoney += Math.round(n * costCoef.money);
        costGrain += Math.round(n * costCoef.grain);
        nonMonetaryArmies++;
      }
    });
    var annualMilitaryCost = costMoney + _grainToMoney(costGrain);

    // 3. annualTaxIncome·年税入
    // territoryCount 优先 entry.provinces·次 fac.territory (string|array)·最后 paradigm fallback
    var territoryCount = (entry.provinces && entry.provinces.length) || 0;
    if (territoryCount === 0 && Array.isArray(fac.territory)) territoryCount = fac.territory.length;
    if (territoryCount === 0 && typeof fac.territory === 'string') {
      // 解析"两京十三省"/"X 省"/"X 据点"·matches 数字
      var s = fac.territory;
      var m = s.match(/十([一二三四五六七八九])省|十省|([一二三四五六七八九十])省|(\d+)\s*[省府州]/);
      if (m) {
        var numMap = { 一:1, 二:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9, 十:10 };
        if (m[1]) territoryCount = 10 + (numMap[m[1]] || 0);
        else if (s.indexOf('十省') >= 0) territoryCount = 10;
        else if (m[2]) territoryCount = numMap[m[2]] || 0;
        else if (m[3]) territoryCount = parseInt(m[3], 10);
      }
      // "两京十三省" → 2+13=15·"十三省"+"两京"+"辽东都司" → 大致 15
      if (s.indexOf('两京') >= 0 && territoryCount > 0) territoryCount += 2;
    }
    if (territoryCount === 0) {
      // 按 paradigm fallback default territory count (反映势力规模)
      var DEF_TERR = { central_empire: 13, manchu_empire: 8, mongol_tribe: 5, tributary_kingdom: 8, european_outpost: 1, maritime_merchant: 3, native_chieftain: 3, rebellion: 1, military_jiedushi: 4, remnant_dynasty: 2, generic: 3 };
      territoryCount = DEF_TERR[paradigm] || 3;
    }
    var taxMoney = territoryCount * taxCoef.money;
    var taxGrain = territoryCount * taxCoef.grain;
    var annualTaxIncome = taxMoney + _grainToMoney(taxGrain);

    // 地块治理修正(2026-07-03·断链A)：旧账只数省份个数×系数——民心崩/税基萎缩/腐败横行(归属不变)完全不动收入。
    // 修：势力名下省在 GM.provinceStats 有活账时·按 稳定/财富/腐败/民乱 均值折算系数·夹[0.6,1.15]防爆。
    // 经 npcFiscalLedger 消费·地块恶化→NPC 钱账吃紧→economyHealth→实力·全链贯通。
    var governanceFactor = 1;
    (function () {
      var GMx = (typeof global !== 'undefined' && global.GM) ? global.GM : ((typeof window !== 'undefined' && window.GM) ? window.GM : null);
      var ps = GMx && GMx.provinceStats;
      if (!ps) return;
      var sum = 0, n = 0;
      (entry.provinces || []).forEach(function (p) {
        var st = ps[p];
        if (!st) return;
        var f = 1;
        if (isFinite(Number(st.stability))) f += (Number(st.stability) - 55) / 100 * 0.25;
        if (isFinite(Number(st.wealth))) f += (Number(st.wealth) - 55) / 100 * 0.25;
        if (isFinite(Number(st.corruption))) f -= Math.max(0, Number(st.corruption) - 30) / 100 * 0.20;
        if (isFinite(Number(st.unrest))) f -= Math.max(0, Number(st.unrest) - 30) / 100 * 0.25;
        sum += f; n += 1;
      });
      if (n > 0) governanceFactor = _clamp(sum / n, 0.6, 1.15);
    })();
    if (governanceFactor !== 1) {
      taxMoney = Math.round(taxMoney * governanceFactor);
      taxGrain = Math.round(taxGrain * governanceFactor);
      annualTaxIncome = Math.round(annualTaxIncome * governanceFactor);
    }

    // 4. netFlow·收支差 (年)
    var netFlow = annualTaxIncome - annualMilitaryCost;

    // 5. fiscalStress·0-100 (100 = 最危)
    var arrearsRatio = 0;
    if (entry.metrics && entry.metrics.armyCount > 0) {
      arrearsRatio = (entry.metrics.arrearsArmies || 0) / entry.metrics.armyCount;
    }
    var costRatio = annualTaxIncome > 0 ? annualMilitaryCost / annualTaxIncome : 2.0;
    var deficitPenalty = costRatio > 1 ? Math.min(60, (costRatio - 1) * 30) : 0;  // 1 倍超支 → 30 分·2 倍 → 60 分 cap
    var arrearsPenalty = arrearsRatio * 40;
    var fiscalStress = _clamp(Math.round(deficitPenalty + arrearsPenalty), 0, 100);

    var economyHealth = 100 - fiscalStress;

    return {
      militaryStrength: totalSoldiers,
      annualMilitaryCost: annualMilitaryCost,
      annualMilitaryCostBreakdown: { money: costMoney, grain: costGrain },
      annualTaxIncome: annualTaxIncome,
      annualTaxBreakdown: { money: taxMoney, grain: taxGrain },
      netFlow: netFlow,
      fiscalStress: fiscalStress,
      economyHealth: economyHealth,
      governanceFactor: governanceFactor,
      labels: {
        economyHealth: _label(economyHealth)
      },
      _source: {
        paradigm: paradigm,
        territoryCount: territoryCount,
        armyCount: (entry.metrics && entry.metrics.armyCount) || 0,
        arrearsRatio: Math.round(arrearsRatio * 100) / 100,
        costRatio: Math.round(costRatio * 100) / 100,
        salaryFromArmies: hasSalaryArmies,
        nonMonetaryArmies: nonMonetaryArmies
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
      var de = _computeOne(f, entry);
      if (de) {
        f.derivedEconomy = de;
        out[f.name] = de;
      }
    });
    return out;
  }

  function getFor(facName) {
    if (typeof global.GM === 'undefined') return null;
    if (!Array.isArray(global.GM.facs)) return null;
    var f = global.GM.facs.find(function(x){ return x && x.name === facName; });
    return (f && f.derivedEconomy) || null;
  }

  global.TM = global.TM || {};
  global.TM.FactionDerivedEconomy = {
    compute: compute,
    getFor: getFor,
    _computeOne: _computeOne,
    _detectParadigm: _detectParadigm,
    TAX_COEF: TAX_COEF,
    SOLDIER_COST: SOLDIER_COST
  };
})(typeof window !== 'undefined' ? window : globalThis);
