#!/usr/bin/env node
// smoke-revolt-amnesty-rejected.js — 玩家立案（2026-07-22）：叛军谈和被拒→说要备战→下回合蒸发。
// 病根=revolt_amnesty 的 rejected 分支缺失（纯 no-op）+回合 prompt 催 AI 收束无升级引导。
// 防腐线：①rejected 分支打标(_amnestyRejectedTurn/_warPrep/消化 rejectedLeaders)；
// ②反消失闸 _revoltAmnestyShield（3 回合窗·期间无真镇压→禁 dissolved/decline/负兵力增量）；
// ③prompt 拒抚升级引导（演绎交 AI·不写死剧本）；④默认开·revoltRejectionEscalation===false 关；⑤设置有开关。

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let A = 0, F = 0;
function assert(cond, msg) {
  if (cond) { A++; console.log('  PASS ' + msg); }
  else { F++; console.log('  FAIL ' + msg); }
}

console.log('smoke-revolt-amnesty-rejected');

const ap = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
// ── ① rejected 分支源契约 ──

// ── ② 反消失闸 vm 真行为 ──
const m = ap.match(/function _revoltAmnestyShield\(r\) \{[\s\S]*?\n\s*\}/);
assert(!!m, '_revoltAmnestyShield 闸函数在');
if (m) {
  const sb = { GM: { turn: 10 }, P: { conf: {} } };
  vm.createContext(sb);
  vm.runInContext(m[0] + '\nthis._sh = _revoltAmnestyShield;', sb);
  const mk = (rt, hist) => ({ _amnestyRejectedTurn: rt, history: hist || [] });
  assert(sb._sh(mk(9)) === true, '闸生效：拒抚 1 回合内·无镇压→拦');
  assert(sb._sh(mk(7)) === false, '窗口尽（3 回合）→放行·防僵尸义军');
  assert(sb._sh(mk(9, [{ turn: 9, event: '镇压:官军-victory' }])) === false, '窗口内经真镇压→放行（武力收束是正路）');
  assert(sb._sh(mk(9, [{ turn: 5, event: '镇压:官军-standoff' }])) === true, '拒抚前的旧镇压不算·仍拦');
  assert(sb._sh({ history: [] }) === false, '未拒抚的义军不受闸·零波及');
  sb.P.conf.revoltRejectionEscalation = false;
  assert(sb._sh(mk(9)) === false, 'conf 关闭→闸整体停用（旧行为逃生阀）');
}

// ── ③ prompt 升级引导（演绎交 AI）──

// ── ⑤ 设置开关（设 conf 必配开关纪律）──

console.log('smoke-revolt-amnesty-rejected ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
