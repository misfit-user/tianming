// smoke-wentian-undo.js — 问天·直改当回合撤销（刀B·2026-07-21·flag 默认 OFF）
//
// 病灶：问天 hardChange 即时生效·无后悔药——AI 裁定看走眼/玩家点快了·只能反向再改一笔。
// 修法：确认现场 flag 开时每笔 apply 武装 _wtBeginUndoCapture 捕获窗·经 _wtAfterHardChange
// 快照 before 值(顺修军队主帅分支原传 '' 的假 old)·当回合内 _wtUndoHardChange 逆序回滚——
// replay 走同一 _wtApplyHardChange·别名(size/strength)/镜像/UI 刷新随之复原。
// 过回合不可撤(推演已消化)·天意 allowCreate 造物不给快照·P.conf.wentianUndo===true 才启用。
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

var toasts = [];
var sandbox = { console: console };
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.setTimeout = function () { return 0; };
sandbox.clearTimeout = function () {};
sandbox.toast = function (m) { toasts.push(String(m || '')); };
sandbox.GM = {
  turn: 3,
  chars: [{ name: '袁崇焕', loyalty: 55, alive: true }],
  armies: [{ name: '关宁军', soldiers: 10000, size: 10000, strength: 10000, morale: 50, commander: '满桂' }],
  _playerDirectives: [],
  _wentianHistory: []
};
sandbox.P = { conf: { wentianUndo: true } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-game-loop-wentian-hardchange.js'), 'utf8'), sandbox, { filename: 'tm-game-loop-wentian-hardchange.js' });

var GM = sandbox.GM;

console.log('① 捕获窗：每笔 apply 恰捕一笔·old 为落笔前真值');
sandbox._wtBeginUndoCapture();
var ok1 = sandbox._wtApplyHardChange('chars[袁崇焕].loyalty', 'set', 100);
var cap1 = sandbox._wtEndUndoCapture();
assert(ok1 === true && GM.chars[0].loyalty === 100, '直改生效 loyalty 55→100');
assert(cap1.length === 1 && cap1[0].old === 55, '捕获 old=55');

sandbox._wtBeginUndoCapture();
var ok2 = sandbox._wtApplyHardChange('armies[关宁军].soldiers', 'add', 5000);
var cap2 = sandbox._wtEndUndoCapture();
assert(ok2 === true && GM.armies[0].soldiers === 15000, '军队 add 生效 10000→15000');
assert(GM.armies[0].size === 15000 && GM.armies[0].strength === 15000, '别名 size/strength 同步 15000');
assert(cap2.length === 1 && cap2[0].old === 10000, '捕获 old=10000');

console.log('② 主帅分支真 old（原传 \'\' 的假 old 已修）');
sandbox._wtBeginUndoCapture();
var ok3 = sandbox._wtApplyHardChange('armies[关宁军].commander', 'set', '祖大寿');
var cap3 = sandbox._wtEndUndoCapture();
assert(ok3 === true && GM.armies[0].commander === '祖大寿', '主帅直改生效 满桂→祖大寿');
assert(cap3.length === 1 && cap3[0].old === '满桂', '主帅捕获真 old=满桂（非空串）');

console.log('③ 未武装时零捕获（捕获窗只在确认现场存在）');
var ok4 = sandbox._wtApplyHardChange('chars[袁崇焕].loyalty', 'set', 90);
assert(ok4 === true && sandbox._wtEndUndoCapture().length === 0, '未 begin → 不捕获');
GM.chars[0].loyalty = 100;  // 复位到①后状态

console.log('④ 一键回滚：逆序 replay·别名/镜像随之复原');
var dir = {
  id: 'u1', content: '直改批', type: 'correction',
  _undoSnapshot: { turn: 3, changes: [
    { reqPath: 'chars[袁崇焕].loyalty', old: 55 },
    { reqPath: 'armies[关宁军].soldiers', old: 10000 },
    { reqPath: 'armies[关宁军].commander', old: '满桂' }
  ] }
};
GM._playerDirectives.push(dir);
sandbox._wtUndoHardChange('u1');
assert(GM.chars[0].loyalty === 55, 'loyalty 回滚 100→55');
assert(GM.armies[0].soldiers === 10000 && GM.armies[0].size === 10000 && GM.armies[0].strength === 10000, '兵力+别名整体回滚 10000');
assert(GM.armies[0].commander === '满桂', '主帅回滚 祖大寿→满桂');
assert(dir._undone === true, '_undone 竖旗');
assert(GM._wentianHistory.length === 1 && GM._wentianHistory[0].content.indexOf('已撤销直改 3/3') >= 0, '落史「已撤销直改 3/3」');
assert(String(dir._lastReason || '').indexOf('玩家已撤销') === 0, '_lastReason=玩家已撤销');

console.log('⑤ 双重撤销拒绝');
GM.chars[0].loyalty = 77;
sandbox._wtUndoHardChange('u1');
assert(GM.chars[0].loyalty === 77 && GM._wentianHistory.length === 1, '已撤过 → no-op');

console.log('⑥ 过回合拒绝（推演已消化·不可再撤）');
var dir2 = { id: 'u2', content: '过期批', _undoSnapshot: { turn: 3, changes: [{ reqPath: 'chars[袁崇焕].loyalty', old: 55 }] } };
GM._playerDirectives.push(dir2);
GM.turn = 4;
toasts.length = 0;
sandbox._wtUndoHardChange('u2');
assert(GM.chars[0].loyalty === 77 && !dir2._undone, '跨回合 → 不回滚');
assert(toasts.some(function (t) { return t.indexOf('已过回合') >= 0; }), '提示「已过回合·不可撤销」');

console.log('⑦ flag OFF → 零行为');
sandbox.P.conf.wentianUndo = false;
GM.turn = 3;
sandbox._wtUndoHardChange('u2');
assert(GM.chars[0].loyalty === 77 && !dir2._undone, 'flag 关 → 撤销入口死（默认 OFF 零行为）');

console.log('');
if (failures.length) {
  console.log('FAIL smoke-wentian-undo: ' + failures.length + ' 处失败');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS smoke-wentian-undo (捕获窗/真old/逆序回滚/别名复原/回合闸/flag门)');
