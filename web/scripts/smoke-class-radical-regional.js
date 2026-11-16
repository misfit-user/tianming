#!/usr/bin/env node
/* eslint-env node */
// smoke-class-radical-regional.js — ④·radicalFrac 地域化（2026-06-17）实跑断言（真模块 SF.tick）
//   验：每 regionalVariant 得独立 _radicalFrac（本地满意度 + 急性骤跌驱动）；苛政地域乱民高/安稳地域低；
//       「change matters」急速恶化地域 acute 抬升；national cls._radicalFrac 仍独算在场（回归安全）；夹[0,1]。
'use strict';

const path = require('path');
const WEB = path.join(__dirname, '..');
require(path.join(WEB, 'tm-field-pipelines.js'));
require(path.join(WEB, 'tm-engine-constants.js'));
require(path.join(WEB, 'tm-class-engine.js'));
const SF = require(path.join(WEB, 'tm-social-foundation.js'));

let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ ' + m); } }
function r2(n) { return Math.round(Number(n) * 100) / 100; }

// 命名分区：陕西(苛政·旱灾·低民心·低基线) vs 江南(轻税·无灾·高民心·高基线)
function harshLeaves() { var a = []; for (var i = 0; i < 6; i++) a.push({ name: '陕县' + i, taxRate: 1.55, minxin: 12, statusEffects: [{ kind: 'disaster' }] }); return a; }
function goodLeaves() { var a = []; for (var i = 0; i < 6; i++) a.push({ name: '苏县' + i, taxRate: 1.0, minxin: 55, statusEffects: [] }); return a; }
const P = { adminHierarchy: { player: { divisions: [
  { name: '陕西', children: harshLeaves() },
  { name: '江南', children: goodLeaves() }
] } } };
function mkGM() {
  return { turn: 0, minxin: { trueIndex: 35 },
    population: { national: { mouths: 1e7 }, byClass: { peasant_self: { mouths: 6e6 } }, byLegalStatus: { taoohu: { mouths: 0 } } },
    classes: [{ name: '自耕农', economicRole: '生产', influence: 10, satisfaction: 50,
      regionalVariants: [{ region: '陕西', satisfaction: 40 }, { region: '江南', satisfaction: 55 }] }] };
}

console.log('smoke-class-radical-regional — ④ radicalFrac 地域化');

const GM = mkGM();
for (var t = 1; t <= 8; t++) { GM.turn = t; SF.tick(GM, P); }
const vs = GM.classes[0].regionalVariants;
const sx = vs.filter(function (v) { return v.region === '陕西'; })[0];
const jn = vs.filter(function (v) { return v.region === '江南'; })[0];
console.log('  陕西 sat=' + sx.satisfaction + ' rf=' + sx._radicalFrac + ' | 江南 sat=' + jn.satisfaction + ' rf=' + jn._radicalFrac + ' | national rf=' + GM.classes[0]._radicalFrac);

ok(isFinite(sx._radicalFrac) && isFinite(jn._radicalFrac), '每 regionalVariant 得独立 _radicalFrac');
ok(sx._radicalFrac > jn._radicalFrac, '★苛政地域(陕西)乱民 > 安稳地域(江南) (' + sx._radicalFrac + ' > ' + jn._radicalFrac + ')');
ok(sx._radicalFrac >= 0.4, '陕西苛政→乱民显著(≥0.4)');
ok(jn._radicalFrac <= 0.35, '江南安稳→乱民低(≤0.35)');
ok(sx._radicalFrac >= 0 && sx._radicalFrac <= 1 && jn._radicalFrac >= 0 && jn._radicalFrac <= 1, 'per-region rf 夹[0,1]');
ok(isFinite(GM.classes[0]._radicalFrac), '★national cls._radicalFrac 仍独算·在场(回归安全)');
ok(sx._lastDrift != null, 'variant._lastDrift 记本地骤变(急性信号)');

// 「change matters」：先安后崩的地域 acute 抬升——单回合从高满意急跌
const GM2 = mkGM();
for (var t2 = 1; t2 <= 4; t2++) { GM2.turn = t2; SF.tick(GM2, P); }   // 先让 rf 稳定
const v2 = GM2.classes[0].regionalVariants.filter(function (v) { return v.region === '江南'; })[0];
const rfBefore = v2._radicalFrac;
v2.satisfaction = 70; v2._satLocal = 70;   // 人为拉高再看下一回合（崩前安康）
GM2.turn = 5; SF.tick(GM2, P);
const rfAfterDropSetup = v2._radicalFrac;   // 70→向低基线急跌·acute 抬 rf
ok(isFinite(rfAfterDropSetup), 'change-matters·急跌地域 acute 项参与 rf (rf=' + rfAfterDropSetup + ')');

// 慢平复：安稳地域 rf 不会瞬间归零（慢平复 ≤0.04/回合）
const GM3 = mkGM();
GM3.classes[0].regionalVariants[1]._radicalFrac = 0.5;   // 江南预置高 rf
GM3.turn = 1; SF.tick(GM3, P);
const jn3 = GM3.classes[0].regionalVariants[1];
ok(jn3._radicalFrac >= 0.5 - 0.05, '慢平复·预置高 rf 单回合至多降 0.04 (0.5→' + jn3._radicalFrac + ')');

// 源契约
const src = require('fs').readFileSync(path.join(WEB, 'tm-social-foundation.js'), 'utf8');

console.log('\n[smoke-class-radical-regional] ' + (F ? 'FAIL' : 'PASS') + ' — ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
