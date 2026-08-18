// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// 7.5: Web Worker — 重计算分离
// 仅包含纯计算函数（不依赖DOM/GM/P）
// 主线程通过 postMessage 传入数据快照，Worker计算后返回结果
// ============================================================

self.onmessage = function(e) {
  var task = e.data;
  if (!task || !task.type) return;

  try {
    if (task.type === 'provinceEconomy') {
      // 省份经济批量计算
      var result = _calcProvinceEconomyBatch(task.provinces, task.config, task.timeRatio);
      self.postMessage({type: 'provinceEconomy', result: result, requestId: task.requestId});
    }
    else if (task.type === 'battleSimulation') {
      // 战斗模拟
      var result = _calcBattleResult(task.attacker, task.defender, task.context);
      self.postMessage({type: 'battleSimulation', result: result, requestId: task.requestId});
    }
  } catch(err) {
    self.postMessage({type: 'error', error: err.message, requestId: task.requestId});
  }
};

function _finiteNumberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

// 省份经济批量计算（纯函数，不依赖GM）
function _calcProvinceEconomyBatch(provinces, config, timeRatio) {
  var results = {};
  var monthScale = timeRatio * 12;
  Object.keys(provinces).forEach(function(name) {
    var p = provinces[name];
    var pop = _finiteNumberOr(p.population, 10000);
    var prosperity = _finiteNumberOr(p.prosperity, 50);
    var corruption = _finiteNumberOr(p.corruption, 0);
    var taxRate = _finiteNumberOr(p.taxRate, 0.1);

    // 基础税收
    var baseTax = pop * taxRate * (prosperity / 100) * monthScale;
    // 腐败损耗
    var corruptionLoss = baseTax * (corruption / 100) * 0.5;
    var netTax = Math.round(baseTax - corruptionLoss);

    // 人口增长
    var growthRate = (prosperity > 60 ? 0.002 : prosperity > 30 ? 0.001 : -0.001) * monthScale;
    var newPop = Math.round(pop * (1 + growthRate));

    results[name] = {
      taxRevenue: netTax,
      population: newPop,
      prosperityDelta: 0 // 由AI决定
    };
  });
  return results;
}

// 战斗结算（纯函数）
function _calcBattleResult(attacker, defender, context) {
  var atkStr = _finiteNumberOr(attacker.soldiers, 0) * _finiteNumberOr(attacker.morale, 50) / 50 * _finiteNumberOr(attacker.training, 50) / 50;
  var defStr = _finiteNumberOr(defender.soldiers, 0) * _finiteNumberOr(defender.morale, 50) / 50 * _finiteNumberOr(defender.training, 50) / 50;
  var ratio = atkStr / Math.max(defStr, 1);
  var verdict = ratio >= 1.5 ? 'decisive_victory' : ratio >= 1.0 ? 'victory' : ratio >= 0.7 ? 'stalemate' : 'defeat';
  return {
    ratio: Math.round(ratio * 100) / 100,
    verdict: verdict,
    attackerLoss: Math.round(attacker.soldiers * (verdict === 'defeat' ? 0.3 : 0.15)),
    defenderLoss: Math.round(defender.soldiers * (verdict === 'decisive_victory' ? 0.4 : 0.2))
  };
}
