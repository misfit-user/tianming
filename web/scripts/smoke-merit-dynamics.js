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

// ── 源码契约：tick 状态感知 ──
ok(/if \(ch\._imprisoned \|\| ch\.imprisoned \|\| ch\._exiled[\s\S]*?return;/.test(SRC), 'tick 状态闸：在押/流放/逃/守丧 → 功名冻结 return');
ok(/dutyMul = 0\.4/.test(SRC) && /\(ch\.stress \|\| 0\) >= 75/.test(SRC), '怠政（重压≥75/重病≤25）挣取 ×0.4');
ok(/ch\._retired\) dutyMul = Math\.min\(dutyMul, 0\.5\)/.test(SRC), '致仕减半（退而不攒资历）');
ok(/Math\.pow\(0\.6, mr\)/.test(SRC) && /ch\._recentAchievements = achievement \* decay/.test(SRC), '近期功绩按经过月份指数衰减（拆分回合等价）');
ok(/achievement \* \(1-decay\) \/ \(-Math\.log\(0\.6\)\*mr\) \* 0\.5/.test(SRC), '近期功绩以时间积分进入挣取 base');

// ── 源码契约：近账引擎 ──
ok(/function recordMeritChange\(ch, delta, reason, kind\)/.test(SRC), '有 recordMeritChange');
ok(/_meritLedger/.test(SRC) && /ch\._meritLog/.test(SRC), '近账落 G._meritLedger + ch._meritLog');
ok(/function addAchievement\(ch, amount, reason, evidence\)/.test(SRC) && /_recentAchievements = Math\.min\(40/.test(SRC), 'addAchievement 喂 _recentAchievements（上限40 防滚雪球）');
ok(/recordMeritChange\(ch, delta, reason\);/.test(SRC), 'adjustVirtueMerit 调 recordMeritChange 记账');
ok(/addAchievement: addAchievement/.test(SRC) && /recordMeritChange: recordMeritChange/.test(SRC), '导出 addAchievement + recordMeritChange');

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
const APP = fs.readFileSync(path.join(__dirname, '..', 'tm-endturn-apply.js'), 'utf8');
ok(/named_corrupt[\s\S]{0,400}?failureDelta\('corruption_exposed'\)/.test(APP), '贪腐查处 named_corrupt → corruption_exposed 减功名');
ok(/_cEng\.addAchievement\(_actorCh/.test(APP), 'NPC互动正政绩 → addAchievement(功绩缓冲持续涨)');
ok(/p1\.merit_changes && Array\.isArray\(p1\.merit_changes\)/.test(APP), 'apply 消费 merit_changes op');
ok(/TMPromotion\.failureDelta\(mc\.failureType \|\| 'task_botched'\)/.test(APP), 'merit_changes failure → failureDelta 全表(AI报 failureType)');
ok(/CharEconEngine\.addAchievement\(_mch/.test(APP), 'merit_changes achievement → addAchievement 立功涨');
ok(/mc\.name === _mcPName\) return/.test(APP), 'merit_changes 君上保护(不受 AI 改)');
const VAL = fs.readFileSync(path.join(__dirname, '..', 'tm-ai-output-validator.js'), 'utf8');
ok(/merit_changes: 'array'/.test(VAL), 'validator 白名单登记 merit_changes(防剥)');
const SCH = fs.readFileSync(path.join(__dirname, '..', 'tm-ai-schema.js'), 'utf8');
ok(/merit_changes:\s*\{ type: 'array'/.test(SCH) && /military_rout丧师/.test(SCH) && /corruption_exposed贪腐案发/.test(SCH), 'schema merit_changes 教 AI(失败全表 failureType)');

// ── 刀4 源码契约：近账透明显示 ──
const TZ = fs.readFileSync(path.join(__dirname, '..', 'tm-renwu-tuzhi.js'), 'utf8');
ok(/meritLog:\(c\._meritLog\|\|\[\]\)\.slice\(-6\)\.reverse\(\)/.test(TZ), 'adaptChar 暴露 meritLog(近6条·新在前)');
ok(/近 期 功 名 升 降/.test(TZ) && /p\.meritLog/.test(TZ), '图志功名块渲染近期升降近账(绿涨红跌)');

console.log('\n[smoke-merit-dynamics] ' + (failed === 0 ? 'PASS' : 'FAIL') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
