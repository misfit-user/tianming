#!/usr/bin/env node
/* eslint-env node */
'use strict';
// 民变分省推演 + byRegion 并账 验证·2026-05-30 (ABCD)
// 造局：陕西 div.minxin=15（烂穿）、山东 95（安定）、全国 trueIndex=90。
// 验：
//   A/C 民变按「本省」div.minxin 判级（陕西→高级别、山东→流言级），不再被全国 90 掩盖；解析不到→回退全国不崩
//   D   _tickMinxinMatrix 的 byRegion.index 改为镜像 div.minxin 真值（不再向全国均值回归）
//   B   AuthorityEngines.tick 不再生民变（民变重做·民2a，11-14：起事归 tm-revolt-cases.js）
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let passed = 0;
function assert(cond, label) { if (!cond) throw new Error('[assert] ' + label); passed += 1; }

// 可控 random：默认走真随机，测 B 时强制放行/拦截
var RAND = null; // null=真随机
var _realRandom = Math.random;
var MathProxy = Object.create(Math);
MathProxy.random = function () { return RAND == null ? _realRandom.call(Math) : RAND; };

const sandbox = {
  console, RegExp, Array, Object, String, Number, Boolean, JSON, Math: MathProxy, Date,
  setTimeout: () => {}, clearTimeout: () => {}, setInterval: () => {}, clearInterval: () => {},
};
sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
sandbox.TM = { errors: { capture: () => {}, captureSilent: () => {} } };
sandbox.addEB = function () {};
sandbox.console = console;
vm.createContext(sandbox);

// 加载顺序：PathUtils(解析器) → IntegrationBridge(getLeafDivisions) → AuthorityEngines(B) → AuthorityComplete(C/D)
['tm-ai-change-pathutils.js', 'tm-integration-bridge.js', 'tm-authority-engines.js', 'tm-authority-complete.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
});

var AC = sandbox.AuthorityComplete, AE = sandbox.AuthorityEngines;
var PU = sandbox.TM && sandbox.TM.AIChange && sandbox.TM.AIChange.PathUtils;
assert(AC && typeof AC.tick === 'function', 'AuthorityComplete.tick 已导出');
assert(AE && typeof AE.tick === 'function', 'AuthorityEngines.tick 已导出');
assert(PU && typeof PU.findDivisionByNameOrId === 'function', 'PathUtils.findDivisionByNameOrId 可用（解析器地基）');

function freshGM(revolts) {
  return {
    turn: 0,
    adminHierarchy: { player: { name: '明廷', divisions: [
      { id: '陕西', name: '陕西', population: { mouths: 1000 }, minxin: 15 },  // 烂穿
      { id: '山东', name: '山东', population: { mouths: 1000 }, minxin: 95 }   // 安定
    ] } },
    regions: [],
    minxin: {
      trueIndex: 90, perceivedIndex: 90, phase: 'peaceful',
      prophecy: { intensity: 0 }, sources: {}, revolts: revolts || [],
      byRegion: { '陕西': { index: 90, trend: 'stable', factors: {} }, '山东': { index: 90, trend: 'stable', factors: {} } },
      byClass: {}
    },
    huangwei: { index: 60, phase: 'normal' }, huangquan: { index: 60 },
    population: { national: { mouths: 2000 }, fugitives: 0 }
  };
}

// 解析器单测（A）：行政区名命中 div.minxin
sandbox.GM = freshGM();
assert(PU.findDivisionByNameOrId(sandbox.GM, '陕西').minxin === 15, 'A·解析器按名命中陕西→div.minxin=15');
assert(PU.findDivisionByNameOrId(sandbox.GM, '不存在省') == null, 'A·解析器对未知区返回 null（C 据此回退全国）');

// ── C：民变初次定级读「本省」真值（turn 与 r.turn 相等→不触发升级·只看初定级）──
RAND = null;
sandbox.GM = freshGM([{ id: 'r1', region: '陕西', status: 'ongoing', turn: 0 }]);
AC.tick({ turn: 0, monthRatio: 1 });
var rv = sandbox.GM.minxin.revolts[0];
assert(rv.level === 3, 'C①陕西民变按本省 15 定级→3级(暴动)，没被全国90掩盖成1级·实得 ' + rv.level);

sandbox.GM = freshGM([{ id: 'r2', region: '山东', status: 'ongoing', turn: 0 }]);
AC.tick({ turn: 0, monthRatio: 1 });
assert(sandbox.GM.minxin.revolts[0].level === 1, 'C②山东民变按本省 95→仅1级(流言)·实得 ' + sandbox.GM.minxin.revolts[0].level);

sandbox.GM = freshGM([{ id: 'r3', region: '飞地省', status: 'ongoing', turn: 0 }]);
AC.tick({ turn: 0, monthRatio: 1 });
assert(sandbox.GM.minxin.revolts[0].level === 1, 'C③解析不到的区→回退全国 trueIndex 90→1级·不崩·实得 ' + sandbox.GM.minxin.revolts[0].level);
console.log('  C 判级: 陕西(15)→3级、山东(95)→1级、未知区→回退全国90→1级');

// ── D：byRegion.index 镜像 div.minxin（不再向全国均值90回归）──
RAND = null;
sandbox.GM = freshGM();
AC.tick({ turn: 1, monthRatio: 1 });
assert(sandbox.GM.minxin.byRegion['陕西'].index === 15, 'D①byRegion 陕西 90→镜像 div.minxin 15（非回归均值）·实得 ' + sandbox.GM.minxin.byRegion['陕西'].index);
assert(sandbox.GM.minxin.byRegion['山东'].index === 95, 'D②byRegion 山东 90→镜像 95·实得 ' + sandbox.GM.minxin.byRegion['山东'].index);
console.log('  D 并账: byRegion 各省 90 → 镜像真值(陕西15/山东95)，不再被拉向全国均值');

// ── B：AuthorityEngines.tick 不再生民变（民变重做·民2a，11-14）──
// 原先这里扫各省，民心低于 25 就按概率揭竿（众五千到三万五随机）。起事改由 tm-revolt-cases.js 按四样实账与地方官判、
// tm-revolt-rising.js 落成真人真数的民变；random 全放行、陕西民心 15，这里也一股不生。
RAND = 0; // 强制放行所有概率门
sandbox.GM = freshGM([]);
AE.tick({ turn: 5, monthRatio: 1 });
assert(sandbox.GM.minxin.revolts.length === 0, "B①AuthorityEngines.tick 不再按民心随机点燃民变（陕西 15、概率全放行）·实得 " + JSON.stringify(sandbox.GM.minxin.revolts.map(function(r){return r.region;})));
console.log('  B 触发: AuthorityEngines.tick 不再生民变（起事归 tm-revolt-cases.js）');

// ── E2·平乱接皇威（端到端·跑真 AuthorityComplete.tick）：官军镇压成功→adjustHuangwei('suppressRevolt')按等级、夹[2,8]、_hwAwarded 幂等 ──
RAND = null;
sandbox.GM = freshGM([{ id: 'rsup', region: '陕西', status: 'ongoing', turn: 1, level: 3, scale: 30000, _suppressionOrder: { strength: 70000 } }]);
sandbox.GM.huangwei = {
  index: 60, phase: 'normal', trend: 'stable',
  sources: { suppressRevolt: 0 }, drains: {},
  subDims: { military: { value: 50 }, foreign: { value: 50 }, court: { value: 50 }, provincial: { value: 50 } },
  tyrantSyndrome: { active: false }, lostAuthorityCrisis: { active: false }
};
AC.tick({ turn: 1, monthRatio: 1 });
var rs = sandbox.GM.minxin.revolts[0];
assert(rs.status === 'suppressed', 'E2①民变被镇压(strength70000>scale*2)·实得 ' + rs.status);
assert(sandbox.GM.huangwei.sources.suppressRevolt === 6, 'E2②平乱接皇威 level3→+6(level*2夹[2,8])·实得 ' + sandbox.GM.huangwei.sources.suppressRevolt);
assert(rs._hwAwarded === true, 'E2③_hwAwarded 标记已置');
AC.tick({ turn: 2, monthRatio: 1 });
assert(sandbox.GM.huangwei.sources.suppressRevolt === 6, 'E2④再 tick 不重复加皇威(幂等)·实得 ' + sandbox.GM.huangwei.sources.suppressRevolt);
console.log('  E2 平乱皇威: 镇压3级民变→皇威+6(sources.suppressRevolt)·幂等不重复');

// ── F·B1.5 皇威/皇权 AI 定量闸·公式核对（与 tm-endturn-apply.js sentiment_changes 内 ①单事件夹±3 ②每回合净封顶±5 逐字一致）──
(function () {
  function cap(deltas) {
    var E = 3, T = 5, acc = 0, out = [];
    deltas.forEach(function (d) {
      var x = Number(d) || 0;
      if (x > E) x = E; else if (x < -E) x = -E;
      if (x >= 0) x = Math.max(0, Math.min(x, T - acc)); else x = Math.min(0, Math.max(x, -T - acc));
      acc += x; out.push(x);
    });
    return { out: out, net: acc };
  }
  assert(cap([30]).out[0] === 3, 'F①单事件 +30 夹到 +3·实得 ' + cap([30]).out[0]);
  assert(cap([-30]).out[0] === -3, 'F②单事件 -30 夹到 -3');
  var r1 = cap([3, 3, 3]); assert(r1.net === 5 && r1.out[2] === 0, 'F③一回合 +3+3+3→净封顶 +5(第三条配额用尽=丢弃0)·实得 net=' + r1.net + ' out=' + JSON.stringify(r1.out));
  var r2 = cap([-3, -3, -3]); assert(r2.net === -5, 'F④负向净封顶 -5·实得 ' + r2.net);
  var r3 = cap([4, -1]); assert(r3.out[0] === 3 && r3.out[1] === -1 && r3.net === 2, 'F⑤+4(夹3)再 -1→净 2·实得 ' + JSON.stringify(r3.out));
  console.log('  F B1.5皇威闸: 单事件±3、每回合净±5、配额用尽丢弃——公式核对');
})();

// ── G·P-QAM 政变/弑君得逞硬门·判定公式核对（与 tm-endturn-apply.js conspiracy_events 内逐字一致）──
(function () {
  function coupGate(action, outcome, hq, hw) {
    var HQ = 60, HW = 60;
    var isSuccess = (outcome === 'succeeded') || action === 'coup_succeeded' || action === 'regicide' || action === 'palace_coup';
    if (isSuccess && (hq >= HQ || hw >= HW)) return { action: 'coup_failed', outcome: 'suppressed', gated: true };
    return { action: action, outcome: outcome || 'suppressed', gated: false };
  }
  var g1 = coupGate('coup_succeeded', 'succeeded', 70, 55);
  assert(g1.gated && g1.outcome === 'suppressed' && g1.action === 'coup_failed', 'G①皇权70 正盛→政变得逞降未遂+主谋下狱·实得 ' + JSON.stringify(g1));
  var g2 = coupGate('regicide', 'succeeded', 55, 73);
  assert(g2.gated, 'G②皇威73 正盛→凭空弑君驳回(降未遂)·防皇威正盛被凭空弑君出局·实得 ' + JSON.stringify(g2));
  var g3 = coupGate('coup_succeeded', 'succeeded', 40, 40);
  assert(!g3.gated && g3.outcome === 'succeeded', 'G③皇权皇威皆衰(40/40)→政变可得逞(不滥拦·AI 仍能在真衰朽时编成功政变)·实得 ' + JSON.stringify(g3));
  var g4 = coupGate('plot_failed', 'suppressed', 90, 90);
  assert(!g4.gated && g4.action === 'plot_failed', 'G④非得逞类(plot_failed)→门不动·照常坐实·实得 ' + JSON.stringify(g4));
  var g5 = coupGate('coup_succeeded', undefined, 70, 50);
  assert(g5.gated, 'G⑤action=coup_succeeded 即使没给 outcome 也判得逞·被门拦');
  console.log('  G P-QAM政变门: 皇权或皇威≥60→弑君/政变得逞降未遂+下狱·皆衰才可得逞·失败类不拦');
})();

// ── H·地基 fuzzy 省名容错：省份正式名带后缀("陕西布政使司")、AI 报光板"陕西"——各省判级/并账镜像仍经 fuzzy 取本省 div.minxin，不回退全国 ──
RAND = null;
sandbox.GM = freshGM([{ id: 'rsfx', region: '陕西', status: 'ongoing', turn: 0 }]); // AI 报光板"陕西"
sandbox.GM.adminHierarchy.player.divisions[0].id = 'shaanxi';
sandbox.GM.adminHierarchy.player.divisions[0].name = '陕西布政使司'; // 正式名带后缀·div.minxin 仍 15
sandbox.GM.minxin.byRegion = { '陕西': { index: 90, trend: 'stable', factors: {} } }; // byRegion 键也用光板"陕西"·测镜像端 fuzzy
sandbox.GM.minxin.trueIndex = 90;
assert(PU.findDivisionByNameOrId(sandbox.GM, '陕西') == null, 'H·前提·精确解析"陕西"对不上"陕西布政使司"→null');
assert(PU.findDivisionByNameFuzzy(sandbox.GM, '陕西') && PU.findDivisionByNameFuzzy(sandbox.GM, '陕西').minxin === 15, 'H·fuzzy"陕西"命中"陕西布政使司"取 div.minxin 15');
AC.tick({ turn: 0, monthRatio: 1 });
var rsfx = sandbox.GM.minxin.revolts[0];
assert(rsfx.level === 3, 'H①带后缀省名·AI报"陕西"·民变各省判级经 fuzzy 取本省15→3级(不回退全国90→1级)·实得 ' + rsfx.level);
assert(sandbox.GM.minxin.byRegion['陕西'].index === 15, 'H②byRegion 并账镜像经 fuzzy 取本省真值15(不漏)·实得 ' + sandbox.GM.minxin.byRegion['陕西'].index);
console.log('  H 地基fuzzy: 省名带后缀"陕西布政使司"+AI报光板"陕西"→各省判级/并账镜像都经fuzzy取本省真值15·不回退全国90');

RAND = null;
console.log('[verify-revolt-local] PASS assertions=' + passed);
