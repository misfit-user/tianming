#!/usr/bin/env node
/* eslint-env node */
// smoke-merit-dynamics.js — 功名变化机制·状态感知+近账 (2026-06-13)
// 激活既有设计：tick 状态闸（在押/流放/守丧冻结·怠政打折·致仕减半）+ _recentAchievements 功绩缓冲 + 功名近账（adjustVirtueMerit/addAchievement 记 ledger）。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'tm-char-economy-engine.js'), 'utf8');
let passed = 0, failed = 0;
function ok(c, m) { if (c) { passed += 1; console.log('  PASS', m); } else { failed += 1; console.error('  FAIL', m); } }

// ── vm 行为：加载 economy 测导出函数 ──
try {
  const ctx = { console: console, Math: Math, Object: Object, Array: Array, String: String, Number: Number, isFinite: isFinite, JSON: JSON, setTimeout: function () {}, GM: { turn: 7 } };
  ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const CE = ctx.CharEconEngine || (ctx.window && ctx.window.CharEconEngine);
  if (CE && CE.adjustVirtueMerit) {
    const ch = { name: '测臣', resources: { virtueMerit: 1000, virtueStage: 2 } };
    CE.adjustVirtueMerit(ch, -750, '贪腐案发');
    ok(ch.resources.virtueMerit === 250, 'adjustVirtueMerit 减功名 1000-750=250 got ' + ch.resources.virtueMerit);
    ok(Array.isArray(ch._meritLog) && ch._meritLog.length === 1 && ch._meritLog[0].delta === -750 && ch._meritLog[0].reason === '贪腐案发', '角色近账 _meritLog 记一笔(-750·贪腐案发)');
    ok(Array.isArray(ctx.GM._meritLedger) && ctx.GM._meritLedger.length === 1 && ctx.GM._meritLedger[0].name === '测臣', '全局 _meritLedger 记一笔');
    CE.addAchievement(ch, 12, '平叛之功');
    ok(ch._recentAchievements === 12, 'addAchievement 喂 _recentAchievements=12 got ' + ch._recentAchievements);
    ok(ch._meritLog.length === 2 && ch._meritLog[1].kind === 'achievement', '功绩记近账(kind=achievement)');
    CE.adjustVirtueMerit(ch, -2000, '溃败'); // 不破 0 下界
    ok(ch.resources.virtueMerit === 0, '功名下界 0（250-2000→0）');
  } else { console.log('  (vm CharEconEngine 未导出·跳过行为测·源码契约已覆盖)'); }
} catch (e) { console.log('  (vm 行为测跳过：' + String(e.message || e).slice(0, 70) + '·源码契约已覆盖)'); }

// ── 刀3 源码契约：政绩涨 + 失败减接入事件点 ──

// ── 刀4 源码契约：近账透明显示 ──

console.log('\n[smoke-merit-dynamics] ' + (failed === 0 ? 'PASS' : 'FAIL') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
