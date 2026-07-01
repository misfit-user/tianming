#!/usr/bin/env node
'use strict';
/* smoke-turn-inference-call-optim — 回合推演「逐调用优化」结构守卫(累积·每 cut 加断言)
 * 用户「直接改默认·真机验」授权下·各 cut 改默认行为(降频/门控/lane)·此处守代码契约不回退·
 * LLM 质量无退化由 owner 真机逐个验证。 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-turn-inference-call-optim');

// ── Cut 1:reflect 自省降频(每回合→每 N·默认 3) ──
const ptj = fs.readFileSync(path.resolve(ROOT, 'tm-post-turn-jobs.js'), 'utf8');
ok(/reflectIntervalTurns/.test(ptj) && /var _reflectItv =/.test(ptj), 'Cut1 引入 _reflectItv(读 P.conf.reflectIntervalTurns)');
ok(/\?\s*Number\(P\.conf\.reflectIntervalTurns\)\s*:\s*3/.test(ptj), 'Cut1 默认间隔 3 回合');
ok(/if \(jobTurn % _reflectItv === 0\) jobs\.push\(\{ id: 'reflect'/.test(ptj), "Cut1 reflect push 被 jobTurn%_reflectItv 门控");
// 回归:l2(每5)/l3(每30) 门控不动
ok(/if \(jobTurn % 5 === 0\) jobs\.push\(\{ id: 'l2_ai'/.test(ptj), 'Cut1 回归:l2_ai 仍每 5 回合');
ok(/if \(jobTurn % 30 === 0\) jobs\.push\(\{ id: 'l3_condense'/.test(ptj), 'Cut1 回归:l3_condense 仍每 30 回合');
// 逻辑自验:间隔 3 时 turn 0/3/6 跑·1/2/4/5 跳
(function () {
  var itv = 3, fire = [];
  for (var t = 0; t <= 6; t++) if (t % itv === 0) fire.push(t);
  ok(fire.join(',') === '0,3,6', 'Cut1 间隔3:turn 0/3/6 触发·其余跳(实=' + fire.join(',') + ')');
})();

// ── Cut 2:hist_check 空诏令跳过(玩家无诏令→无史实偏离可查→省背景调用·确定性安全) ──
const core = fs.readFileSync(path.resolve(ROOT, 'tm-endturn-core.js'), 'utf8');
ok(/var _hasEdictForHist = !!\(_edictSnapshot &&/.test(core), 'Cut2 hist_check 按诏令字段算 _hasEdictForHist');
ok(/if \(!_hasEdictForHist\) return;/.test(core), 'Cut2 无诏令→提前 return 跳过 hist_check LLM');
// 契约:守卫在 callAISmart 之前(跳过才省调用)
ok(core.indexOf('if (!_hasEdictForHist) return;') < core.indexOf('你是历史顾问'), 'Cut2 空诏令守卫在建 prompt/发 LLM 之前');

// ── Cut 3(B):sc_audit 无可审数据跳过(关键路径·空审=提速·确定性安全) ──
const fu = fs.readFileSync(path.resolve(ROOT, 'tm-endturn-followup.js'), 'utf8');
ok(/var _auditInputN =/.test(fu), 'Cut3B sc_audit 计 _auditInputN(跨源可审数据量)');
ok(/faction_events/.test(fu) && /_tres\.subcall16 &&/.test(fu) && /_tres\.subcall18 &&/.test(fu), 'Cut3B 计入 sc1(faction/fiscal/army)+sc16/17/18');
ok(/if \(_auditInputN === 0\) \{[\s\S]{0,120}?return;/.test(fu), 'Cut3B 无可审数据→提前 return 跳过审核 LLM');
ok(fu.indexOf('if (_auditInputN === 0)') < fu.indexOf('id: \'sc_audit\', label'), 'Cut3B 空审守卫在 _callFollowupAI(sc_audit) 之前');
// 逻辑自验:空 → 跳;有 faction_events → 审
(function () {
  function inputN(t) {
    var s = t.subcall1 || {};
    return (Array.isArray(s.faction_events) ? s.faction_events.length : 0)
      + (Array.isArray(s.army_changes) ? s.army_changes.length : 0)
      + (t.subcall16 && typeof t.subcall16 === 'object' ? Object.keys(t.subcall16).length : 0);
  }
  ok(inputN({}) === 0 && inputN({ subcall1: { faction_events: [], army_changes: [] } }) === 0, 'Cut3B 全空→0(跳过)');
  ok(inputN({ subcall1: { faction_events: [{ x: 1 }] } }) === 1, 'Cut3B 有 faction_events→>0(审核)');
  ok(inputN({ subcall16: { faction_priorities: [] } }) === 1, 'Cut3B sc16 有键(即便空数组)→>0(保守不误跳)');
})();

console.log('\nsmoke-turn-inference-call-optim ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F ? 1 : 0);
