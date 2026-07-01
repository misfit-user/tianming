#!/usr/bin/env node
'use strict';
/* smoke-party-class-drift-bidirectional — 党派/阶层「满意度无脑降·影响力无脑升」修复
 * bug:每回合 recordTurnResult + ecology enrichSignalRaw 的 delta 硬编码单向(满意默认负·影响默认正)·
 *      中性回合也判坏·影响力只升不降 → 所有党派阶层单向漂移。
 * 修:①emit sign 三值(纾解+1/压力-1/中性0)·satisfactionDelta 与 party influenceDelta 随之三值双向;
 *    ②ecology 从信号已列明 satisfactionDelta 取极性 _pol·类满意/党派影响按 _pol 双向(纾解→满意升党派退潮·中性→不波及)。 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const sig = fs.readFileSync(path.resolve(ROOT, 'tm-social-political-signals.js'), 'utf8');
const eco = fs.readFileSync(path.resolve(ROOT, 'tm-party-class-ecology.js'), 'utf8');
let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-party-class-drift-bidirectional');

// ── ① emit:sign 三值(中性→0)·不再默认 -1 ──
ok(/taxSign = taxRelief && !taxStress \? 1 : \(taxStress \? -1 : 0\)/.test(sig), '① taxSign 三值(中性→0)');
ok(/milSign = milRelief && !milStress \? 1 : \(milStress \? -1 : 0\)/.test(sig), '① milSign 三值');
ok(/kejuSign = kejuRelief && !kejuStress \? 1 : \(kejuStress \? -1 : 0\)/.test(sig), '① kejuSign 三值');
ok(/var landStress = has\(/.test(sig) && /landSign = landRelief \? 1 : \(landStress \? -1 : 0\)/.test(sig), '① land 加 stress 判定 + landSign 三值');
ok(!/= taxRelief && !taxStress \? 1 : -1/.test(sig) && !/= milRelief && !milStress \? 1 : -1/.test(sig), '① 不再有 "? 1 : -1"(中性判坏)残留');

// ── ① emit:satisfactionDelta / party influenceDelta 三值双向 ──
ok(/satisfactionDelta: taxSign > 0 \? 3 : \(taxSign < 0 \? -4 : 0\)/.test(sig), '① tax satisfactionDelta 三值(中性0)');
ok(/satisfactionDelta: milSign > 0 \? 3 : \(milSign < 0 \? -5 : 0\)/.test(sig), '① mil satisfactionDelta 三值');
ok(/satisfactionDelta: landSign > 0 \? 3 : \(landSign < 0 \? -4 : 0\)/.test(sig), '① land satisfactionDelta 三值');
ok(/influenceDelta: taxSign < 0 \? 1 : \(taxSign > 0 \? -1 : 0\)/.test(sig), '① tax 党派 influenceDelta 双向(纾解→退潮跌·修无脑升)');
ok(/influenceDelta: milSign < 0 \? 1 : \(milSign > 0 \? -1 : 0\)/.test(sig), '① mil 党派 influenceDelta 双向');
ok(/influenceDelta: kejuSign < 0 \? 1 : \(kejuSign > 0 \? -1 : 0\)/.test(sig), '① keju 党派 influenceDelta 双向');
// 旧无条件 influenceDelta: 1 已清(turn-result 三块)
ok((sig.match(/influenceDelta: 1,/g) || []).length <= 1, '① 无条件 "influenceDelta: 1" 基本清除(仅民变等固定grievance可留)·实=' + (sig.match(/influenceDelta: 1,/g) || []).length);

// ── ② ecology:信号极性 _pol + 双向 delta ──
ok(/var _pol = 0;/.test(eco) && /x\.satisfactionDelta/.test(eco), '② ecology 从 affectedClasses 满意度 delta 算信号极性 _pol');
ok(/if \(_pol !== 0\)/.test(eco), '② 中性信号(_pol=0)不波及旁支阶层(不再无脑扣满意)');
ok(/satisfactionDelta: _pol \* _mag/.test(eco), '② ecology 类满意度 = _pol × 幅度(双向:纾解升/民怨降)');
ok(/influenceDelta: _pol < 0 \? \(intensity >= 0\.75 \? 1 : 0\) : -1/.test(eco), '② ecology 类影响力双向(纾解→跌)');
ok(/_pol < 0 \? Math\.max\(1, Math\.round\(intensity \* 2\)\) : \(_pol > 0 \? -Math\.max/.test(eco), '② ecology 党派影响力双向(民怨升/纾解跌/中性0·修无脑升)');
ok(!/influenceDelta: Math\.max\(1, Math\.round\(intensity \* 2\)\),\s*\n\s*cohesionDelta/.test(eco), '② 旧无条件党派 influenceDelta(恒正)已清');
ok(!/satisfactionDelta: -Math\.max\(2, Math\.round\(1 \+ intensity \* 5\)\)/.test(eco), '② 旧无条件类满意度(恒负)已清');

console.log('\nsmoke-party-class-drift-bidirectional ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F ? 1 : 0);
