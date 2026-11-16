#!/usr/bin/env node
/* eslint-env node */
// smoke-class-radical-revolt.js — C1：radicalFrac 驱动起义态机（2026-06-16）
// 验：refreshClassPhase 让乱民比例作起义独立触发（≥0.6 起义/≥0.4 酝酿）；
//     无 _radicalFrac 的阶层退回旧 satisfaction 阈值行为（rf=0·零影响·回归安全）。
'use strict';

const path = require('path');
const WEB = path.join(__dirname, '..');
require(path.join(WEB, 'tm-engine-constants.js'));
require(path.join(WEB, 'tm-class-engine.js'));
const CE = global.TM.ClassEngine;

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  PASS', msg); }
  else { failed += 1; console.error('  FAIL', msg); }
}
function phaseOf(cls, turn) {
  const r = CE.refreshClassPhase({ turn: turn || 5 }, cls);
  return { phase: r.phase, note: (cls.revoltState || {}).note };
}

// ── 1. 高乱民(0.7) + 满意度尚可(60·未到旧阈) → 起义（乱民独立触发）──
const r1 = phaseOf({ name: '农户', satisfaction: 60, _radicalFrac: 0.7 });
ok(r1.phase === 'uprising' && r1.note === '乱民鼎沸', '高乱民0.7→起义·即便满意60 (got ' + r1.phase + '/' + r1.note + ')');

// ── 2. 中乱民(0.45) + 满意60 → 酝酿 ──
const r2 = phaseOf({ name: '农户', satisfaction: 60, _radicalFrac: 0.45 });
ok(r2.phase === 'brewing' && r2.note === '民情汹汹', '中乱民0.45→酝酿 (got ' + r2.phase + '/' + r2.note + ')');

// ── 3. 低乱民(0.1) + 满意60 → 平静 ──
const r3 = phaseOf({ name: '农户', satisfaction: 60, _radicalFrac: 0.1 });
ok(r3.phase === 'calm', '低乱民0.1+满意60→平静 (got ' + r3.phase + ')');

// ── 4. 回归：无 _radicalFrac → 退回旧 satisfaction 阈值（rf=0 零影响）──
ok(phaseOf({ name: '农户', satisfaction: 25 }).phase === 'uprising', '回归·无乱民·满意25→起义(旧sat阈≤30)');
ok(phaseOf({ name: '农户', satisfaction: 40 }).phase === 'brewing', '回归·无乱民·满意40→酝酿(旧sat阈≤45)');
ok(phaseOf({ name: '农户', satisfaction: 60 }).phase === 'calm', '回归·无乱民·满意60→平静(旧行为·乱民0影响)');

// ── 5. 边界：rf 恰 0.6 → 起义；0.4 → 酝酿；0.39 满意60 → 平静 ──
ok(phaseOf({ name: '农户', satisfaction: 70, _radicalFrac: 0.6 }).phase === 'uprising', '边界·rf=0.6→起义');
ok(phaseOf({ name: '农户', satisfaction: 70, _radicalFrac: 0.4 }).phase === 'brewing', '边界·rf=0.4→酝酿');
ok(phaseOf({ name: '农户', satisfaction: 70, _radicalFrac: 0.39 }).phase === 'calm', '边界·rf=0.39+满意70→平静');

// ── 6. 源契约 ──

console.log('\n[smoke-class-radical-revolt] ' + (failed ? 'FAIL' : 'PASS') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
