#!/usr/bin/env node
// smoke-dedup-keys-pruning.js — 单调去重键映射封顶（深挖第七轮F·长局健康）
// 验：两个增速最快的只增不裁映射按龄清——
//   _partyClassActionSchedulerMemoryKeys(~159键/回合·值改存回合号·旧档true补戳·48回合窗)
//   _classMinxinBridgeKeys(~80键/回合·pressureKey尾段恒回合号·按尾数字精确清·异形键保留)。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let N = 0;
function assert(c, m) { N++; if (!c) { console.error('ASSERT FAIL [' + N + ']:', m); process.exit(1); } }
function sliceFn(s, marker) { const a = s.indexOf(marker); let j = s.indexOf('{', a), d = 0; for (; j < s.length; j++) { const c = s[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return s.slice(a, j); }

const schedSrc = fs.readFileSync(path.join(ROOT, 'tm-party-class-action-scheduler.js'), 'utf8');
const bridgeSrc = fs.readFileSync(path.join(ROOT, 'tm-class-minxin-bridge.js'), 'utf8');

// ── scheduler·_pruneSeenKeys 行为 ──
const ctx1 = { Number: Number, Math: Math, console: console };
ctx1.window = ctx1; ctx1.globalThis = ctx1;
vm.createContext(ctx1);
vm.runInContext(sliceFn(schedSrc, 'function _pruneSeenKeys(') + '\nthis.prune=_pruneSeenKeys;', ctx1);
const seen = { 'signal|s1|class|甲': true, 'signal|s2|class|乙': 40, 'signal|s3|class|丙': 90, 'signal|s4|class|丁': 52 };
ctx1.prune(seen, 100);
assert(seen['signal|s1|class|甲'] === 100, '① 旧档 true 值补戳当前回合(从今起龄不误删)');
assert(!('signal|s2|class|乙' in seen), '② 逾48回合(40<52)按龄清除');
assert(seen['signal|s3|class|丙'] === 90 && seen['signal|s4|class|丁'] === 52, '③ 窗内键保留(90/52≥52)');
assert(seen._prunedAtTurn === 100, '④ 每回合首写清一趟标记');
seen['signal|s5|class|戊'] = 10;
ctx1.prune(seen, 100);
assert(seen['signal|s5|class|戊'] === 10, '⑤ 同回合重入不重清(摊薄成本)');
ctx1.prune(seen, 101);
assert(!('signal|s5|class|戊' in seen), '⑥ 次回合清扫补上');

// ── bridge·_pruneBridgeKeys 行为 ──
const ctx2 = { Number: Number, Math: Math, console: console };
ctx2.window = ctx2; ctx2.globalThis = ctx2;
vm.createContext(ctx2);
vm.runInContext(sliceFn(bridgeSrc, 'function _pruneBridgeKeys(') + '\nthis.prune=_pruneBridgeKeys;', ctx2);
const root = { turn: 100, _classMinxinBridgeKeys: {
  'sigsys|e1|class:shi|40': true,     // 逾窗(40<52)→清
  'sigsys|e2|class:nong|90': true,    // 窗内→留
  'sigsys|e3|class:gong|100': true,   // 本回合→留
  'legacy|weird|noturn': true          // 尾段非数字异形键→保留不动
} };
ctx2.prune(root);
assert(!('sigsys|e1|class:shi|40' in root._classMinxinBridgeKeys), '⑦ 尾嵌回合逾48清除');
assert(root._classMinxinBridgeKeys['sigsys|e2|class:nong|90'] === true, '⑧ 窗内键保留');
assert(root._classMinxinBridgeKeys['legacy|weird|noturn'] === true, '⑨ 异形键(尾非数字)保留不误删');
assert(root._classMinxinBridgeKeys._prunedAtTurn === 100, '⑩ 回合清扫标记');

console.log('smoke-dedup-keys-pruning OK — ' + N + ' 断言全绿（按龄清/旧档补戳/异形保留/每回合一趟）');
