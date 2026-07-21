// smoke-wentian-workorder.js — 问天二期·工单化+治理列（2026-07-21·随 wentianFulfillAudit）
//
// 方向三落地：plan/watch 从「给玩家看的一句话」升为一等工单——endturn prompt 单独供奉
// 指标(⚖工单指标·引擎核验勿虚报·AI 确知怎样才算落实)·非规则类连续两回合全中→自动核销
// (停止对账·徽章留档)·规则类常青恒审。方向五治理列：最近核验回合 T 标+久未遵裁撤提示+核销章。
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var failures = [];
function assert(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); }
  else { failures.push(msg); console.log('  FAIL ' + msg); }
}

// 拆分家族契约序：先提及 tm-game-loop.js 再 tm-game-loop-wentian-hardchange.js（lint-smoke-family-order）
var glSrc = fs.readFileSync(path.join(ROOT, 'tm-game-loop.js'), 'utf8');

var sandbox = { console: console };
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.setTimeout = function () { return 0; };
sandbox.clearTimeout = function () {};
sandbox.GM = {
  turn: 5,
  chars: [{ name: '袁崇焕', loyalty: 55, alive: true }],
  armies: [{ name: '关宁军', soldiers: 10000 }],
  _playerDirectives: [],
  _wentianHistory: []
};
sandbox.P = { conf: { wentianFulfillAudit: true } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-game-loop-wentian-hardchange.js'), 'utf8'), sandbox, { filename: 'tm-game-loop-wentian-hardchange.js' });

var GM = sandbox.GM;

var regD = sandbox._wtRegisterWatch([{ path: 'chars[袁崇焕].loyalty', expect: 'gte', value: 80, note: '袁忠诚' }]);
var regR = sandbox._wtRegisterWatch([{ path: 'armies[关宁军].soldiers', expect: 'gte', value: 15000, note: '关宁兵额' }]);
var dirD = { id: 'wo1', content: '安抚袁崇焕', type: 'directive', _watch: regD };
var dirR = { id: 'wo2', content: '保持关宁满编', type: 'rule', _watch: regR };
GM._playerDirectives.push(dirD, dirR);

console.log('① 达标第一回合：streak 记账·未核销');
GM.turn = 6;
GM.chars[0].loyalty = 85;
GM.armies[0].soldiers = 16000;
sandbox._wtRunFulfillAudit();
assert(dirD._lastStatus === 'followed' && dirD._watch._streakOk === 1, 'directive 全中·streak=1');
assert(!dirD._watchClosed, '一回合不核销(须连续两回合)');

console.log('② 连续两回合达标：directive 核销·rule 常青');
GM.turn = 7;
sandbox._wtRunFulfillAudit();
assert(dirD._watchClosed === true, 'directive 连中两回合 → 工单核销');
assert(GM._wentianHistory.some(function (h) { return h.content.indexOf('工单核销·兑现毕') >= 0; }), '核销落问天历史');
assert(dirR._lastStatus === 'followed' && !dirR._watchClosed, 'rule 同样连中 → 常青不核销(恒审)');

console.log('③ 核销后停止对账（徽章留档）');
GM.turn = 8;
GM.chars[0].loyalty = 10;  // 若仍审会翻 ignored
var histLen = GM._wentianHistory.length;
sandbox._wtRunFulfillAudit();
assert(dirD._lastStatus === 'followed', '已核销 → 不再翻账(留档定格)');
assert(dirR._lastStatus === 'followed', 'rule 兵额仍达标 → 继续 followed');

console.log('④ rule 失守 → 常青审计翻账·streak 清零');
GM.turn = 9;
GM.armies[0].soldiers = 8000;
sandbox._wtRunFulfillAudit();
assert(dirR._lastStatus === 'ignored' && dirR._watch._streakOk === 0, 'rule 失守 → ignored·streak 清零(常青价值)');

console.log('⑤ 静态契约：prompt 工单供奉段+治理列 chips');
var promptSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-prompt.js'), 'utf8');
assert((promptSrc.match(/⚖工单指标\(引擎核验·勿虚报\)/g) || []).length === 2, 'endturn prompt 规则/指令两个循环各供奉工单指标');
assert(/_watchClosed/.test(promptSrc), '已核销工单不再供奉');
// 该文件中文按惯例存 \uXXXX 转义·契约锚 ASCII 标识符（glSrc 已按家族序在文件头预读）
assert(/checkChip/.test(glSrc) && /adviceChip/.test(glSrc) && /d\._watchClosed/.test(glSrc) && /_ignoredCount \|\| 0\) >= 3/.test(glSrc), '治理列三件(核销章/裁撤提示/T标)已挂(ASCII锚)');
assert(/statusChip \+ watchChip \+ checkChip \+ adviceChip/.test(glSrc), '四 chip 已并入指令行渲染');

console.log('');
if (failures.length) {
  console.log('FAIL smoke-wentian-workorder: ' + failures.length + ' 处失败');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS smoke-wentian-workorder (工单供奉/两回合核销/规则常青/核销停审/治理列契约)');
