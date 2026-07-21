// smoke-wentian-fulfill-audit.js — 问天·兑现对账（刀A·2026-07-21·flag 默认 OFF）
//
// 病灶：问天 rule/directive 入库时承诺「每回合回报执行状况」·但既有回报=推演 AI 自报作业
// (directive_compliance)·没有任何确定性核查——AI 说「已遵」而在档数字没动·玩家无从得知。
// 修法：submit 可附 watch 指标(path+expect[+value])·注册时快照基线·回合末 _wtRunFulfillAudit
// 按在档真值确定性对账·盖进既有 _lastStatus 徽章(⚖︎对账前缀)·状态变化时入问天历史。
// P.conf.wentianFulfillAudit === true 才启用(默认 OFF·设置→性能)。
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

var sandbox = { console: console };
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.setTimeout = function () { return 0; };
sandbox.clearTimeout = function () {};
sandbox.GM = {
  turn: 5,
  chars: [{ name: '袁崇焕', loyalty: 55, alive: true }],
  armies: [{ name: '关宁军', soldiers: 10000, morale: 50 }],
  _playerDirectives: [],
  _wentianHistory: []
};
sandbox.P = { conf: { wentianFulfillAudit: true } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-game-loop-wentian-hardchange.js'), 'utf8'), sandbox, { filename: 'tm-game-loop-wentian-hardchange.js' });

var GM = sandbox.GM;

console.log('① 只读取值 _wtReadHardChangeValue（七类 resolver 复用·绝不创建）');
var rv = sandbox._wtReadHardChangeValue('chars[袁崇焕].loyalty');
assert(rv.ok === true && rv.value === 55, '人物路径读到真值 55');
rv = sandbox._wtReadHardChangeValue('armies[关宁军].soldiers');
assert(rv.ok === true && rv.value === 10000, '军队路径读到真值 10000');
rv = sandbox._wtReadHardChangeValue('chars[幽灵人].loyalty');
assert(rv.ok === false, '不在档人物 → ok:false（不创建幽灵键）');
rv = sandbox._wtReadHardChangeValue('GM.guoku');
assert(rv.ok === false, '不存在的 generic 字段 → ok:false');
assert(!('guoku' in GM), '读操作没有创建 guoku 幽灵键');

console.log('② watch 注册：可读的入账·读不到的丢弃·全不可读→null');
var reg = sandbox._wtRegisterWatch([
  { path: 'chars[袁崇焕].loyalty', expect: 'gte', value: 80, note: '袁崇焕忠诚' },
  { path: 'armies[关宁军].soldiers', expect: 'increase' },
  { path: 'chars[幽灵人].loyalty', expect: 'increase' }
]);
assert(reg && reg.items.length === 2, '3 条指标 → 幽灵路径丢弃 → 2 条入账');
assert(reg.baseline['chars[袁崇焕].loyalty'] === 55 && reg.baseline['armies[关宁军].soldiers'] === 10000, '基线快照 55/10000');
assert(reg.registeredTurn === 5, '注册回合=5');
assert(sandbox._wtRegisterWatch([{ path: 'chars[幽灵人].loyalty', expect: 'increase' }]) === null, '全不可读 → null（诚实：不做假对账）');
assert(sandbox._wtRegisterWatch([{ path: 'chars[袁崇焕].loyalty', expect: '不合法' }]) === null, '非法 expect → 不入账');

var dir = { id: 'd1', content: '整顿关宁军·安抚袁崇焕', type: 'rule', _watch: reg };
GM._playerDirectives.push(dir);

console.log('③ 注册当回合不对账（推演还没跑）');
sandbox._wtRunFulfillAudit();
assert(dir._lastStatus === undefined, '当回合不盖状态');
assert(GM._wentianHistory.length === 0, '当回合不落史行');

console.log('④ 次回合对账：1/2 中 → partial·⚖︎对账前缀·落史');
GM.turn = 6;
GM.chars[0].loyalty = 85;   // gte 80 达标
sandbox._wtRunFulfillAudit();
assert(dir._lastStatus === 'partial', '1/2 → partial');
assert(String(dir._lastReason || '').indexOf('⚖︎对账 1/2') === 0, '_lastReason 带「⚖︎对账 1/2」前缀（可与 AI 自报区分）');
assert(GM._wentianHistory.length === 1 && GM._wentianHistory[0].content.indexOf('部分兑现') >= 0, '状态首判 → 落史「部分兑现」');

console.log('⑤ 同回合幂等（多 pass 结算只审一次）');
sandbox._wtRunFulfillAudit();
assert(GM._wentianHistory.length === 1, '同回合重跑不重复落史');

console.log('⑥ 再次回合全中 → followed·状态变化落史');
GM.turn = 7;
GM.armies[0].soldiers = 12000;  // increase 达标（基线 10000）
sandbox._wtRunFulfillAudit();
assert(dir._lastStatus === 'followed', '2/2 → followed（账本可纠 AI 自报）');
assert(GM._wentianHistory.length === 2 && GM._wentianHistory[1].content.indexOf('已兑现') >= 0, '状态变化 → 落史「已兑现」');

console.log('⑦ 状态未变不刷屏');
GM.turn = 8;
sandbox._wtRunFulfillAudit();
assert(GM._wentianHistory.length === 2, '连续 followed → 不重复落史');

console.log('⑧ 判定算子逐一验证');
var J = sandbox._wtJudgeWatchItem;
assert(J({ expect: 'decrease' }, 50, true, 40).met === true, 'decrease 50→40 met');
assert(J({ expect: 'decrease' }, 50, true, 60).met === false, 'decrease 50→60 未met');
assert(J({ expect: 'lte', value: 30 }, 50, true, 25).met === true, 'lte 25≤30 met');
assert(J({ expect: 'eq', value: '京师' }, '辽东', true, '京师').met === true, 'eq 字符串相等 met');
assert(J({ expect: 'change' }, '辽东', true, '辽东').met === false, 'change 未变 未met');
assert(J({ expect: 'increase' }, 10, false, null).met === false, '读不到现值 → 未met');

console.log('⑨ flag OFF → 零行为');
sandbox.P.conf.wentianFulfillAudit = false;
GM.turn = 9;
GM.chars[0].loyalty = 1;  // 若审会翻 ignored
sandbox._wtRunFulfillAudit();
assert(dir._lastStatus === 'followed' && GM._wentianHistory.length === 2, 'flag 关 → 不审不落史（默认 OFF 零行为）');

console.log('');
if (failures.length) {
  console.log('FAIL smoke-wentian-fulfill-audit: ' + failures.length + ' 处失败');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS smoke-wentian-fulfill-audit (确定性兑现对账·基线快照/幂等/状态变化落史/flag门)');
