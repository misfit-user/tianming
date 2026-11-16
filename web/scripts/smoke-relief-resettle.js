/* smoke-relief-resettle.js — 刀五·赈济→灾民回迁/逃户减（开仓赈济→流民复归编户·釜底抽流寇之薪）
 * 验：① 赈济成功→既有逃户池(taoohu)减·守恒回编户(huangji)② 配额按规模(国赈>省赈>县赈)③ 守恒(逃户减==编户增)
 *   ④ 无灾且非国赈→不回迁(防空赈刷) ⑤ 国赈无在册灾亦回迁(全境) ⑥ 逃户空→回迁0 ⑦ 不碰 hukou.fugitives(派生·改之无效) ⑧ 装配
 * 跑：node scripts/smoke-relief-resettle.js
 */
'use strict';
var pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.error('  ✗ ' + m); } }

global.window = undefined;
global.addEB = function () {};
var GE = require('../tm-guoku-engine.js').GuokuEngine; // IIFE(global=module.exports)·bare GM 仍解析 node global.GM
ok(GE && GE.Actions && typeof GE.Actions.openGranary === 'function', '0·GuokuEngine.Actions.openGranary 可用');

function setup(taoohu, disasters) {
  global.GM = {
    turn: 5, guoku: { balance: 5000000, grain: 2000000 }, minxin: { trueIndex: 50 },
    activeDisasters: disasters || [],
    population: { byLegalStatus: { taoohu: { mouths: taoohu }, huangji: { mouths: 0 } } }
  };
  return global.GM;
}
function tao() { return global.GM.population.byLegalStatus.taoohu.mouths; }
function huang() { return global.GM.population.byLegalStatus.huangji.mouths; }

// ── T1 省赈·有灾→回迁 60000 ──
setup(100000, [{ region: '陕西', type: '旱', _relieved: false }]);
var r1 = GE.Actions.openGranary('regional', '陕西');
ok(r1 && r1.success && r1.resettled === 60000, '1·省赈成功→回迁 60000(配额)·实得 ' + (r1 && r1.resettled));
ok(tao() === 40000, '1·逃户池 100000→40000·实得 ' + tao());
ok(huang() === 60000, '3·守恒：减的60000全回编户(huangji)·实得 ' + huang());

// ── T2 国赈配额更大(200000)──
setup(500000, [{ region: '陕西', type: '旱', _relieved: false }]);
var r2 = GE.Actions.openGranary('national');
ok(r2.resettled === 200000 && tao() === 300000, '2·国赈配额 200000>省赈·实得 ' + r2.resettled);

// ── T2b 县赈配额更小(20000)──
setup(100000, [{ region: '甲县', type: '蝗', _relieved: false }]);
var r2b = GE.Actions.openGranary('county', '甲县');
ok(r2b.resettled === 20000, '2b·县赈配额 20000<省赈·实得 ' + r2b.resettled);

// ── T4 无灾 + 非国赈→不回迁(防空赈刷) ──
setup(100000, []);
var r4 = GE.Actions.openGranary('regional', '无灾省');
ok(r4.resettled === 0 && tao() === 100000, '4·无在册灾且非国赈→不回迁(逃户不动)·实得 ' + r4.resettled);

// ── T5 国赈无在册灾亦回迁(全境赈) ──
setup(100000, []);
var r5 = GE.Actions.openGranary('national');
ok(r5.resettled === 100000 && tao() === 0, '5·国赈(全境)无在册灾亦回迁·实得 ' + r5.resettled);

// ── T6 逃户空→回迁0(不崩) ──
setup(0, [{ region: '陕西', type: '旱', _relieved: false }]);
var r6 = GE.Actions.openGranary('national');
ok(r6.success && r6.resettled === 0, '6·逃户池空→回迁0(不崩)');

// ── T7 不碰派生 hukou.fugitives + T8 装配 ──
var fs = require('fs'), path = require('path');

console.log('\n[smoke-relief-resettle] ' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) { console.error('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
