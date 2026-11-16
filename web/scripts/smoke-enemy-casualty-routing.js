#!/usr/bin/env node
// scripts/smoke-enemy-casualty-routing.js
//
// 验证「敌军折损落不到真军 → 杀不完」修复（2026-06-14）。
//
// 根因：AI 常以「代善 / 代善部」指代敌军，而剧本军名是「后金·两红旗(代善领)」。
//   旧解析器 _findArmyForAIChange 只做 名精确 + 名模糊(长度差≤4 护栏)，
//   「代善」对不上长军名 → army not found → soldiers_delta 被丢弃、battleResult 折损落空，
//   真实 soldiers 纹丝不动 → 玩家每回合看到折几千却永远杀不完。
//
// 修复：名匹配全败后，按军队当前主帅姓名精确等值兜底（两条 AI 写军队路都补上）：
//   [A] army_changes / soldiers_delta → applyAIArmyChange → _findArmyForAIChange 主帅兜底
//   [B] battleResult → MilitarySystems._findArmy 委托共享解析器
//
// 范围：行为 + swap-test（证明旧逻辑会丢、新逻辑能命中）+ 不误伤护栏。

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let pass = 0;
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); pass++; }
function runFile(ctx, file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
}

function buildContext() {
  const ctx = {
    console: { log() {}, warn() {}, info() {}, error() {}, debug() {} },
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, isNaN, parseInt, parseFloat, Promise, Symbol, Map, Set,
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    Error, TypeError, RangeError
  };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  ctx.addEB = () => {};
  ctx.uid = () => 'battle_test_1';
  ctx.SettlementPipeline = { register: () => {} };   // tm-military.js 载入期注册结算阶段·测试只需 stub
  ctx.TM = ctx.TM || {};
  ctx.TM.errors = { capture: () => {} };
  ctx.P = { playerInfo: { factionName: '大明朝廷' } };
  // 镜像剧本天启七年的真实军队字段（name / faction / commander / soldiers）
  ctx.GM = {
    turn: 5,
    chars: [
      { name: '代善', alive: true, faction: '后金' },
      { name: '皇太极', alive: true, faction: '后金' }
    ],
    facs: [
      { name: '大明朝廷', isPlayer: true },
      { name: '后金' }
    ],
    armies: [
      { name: '后金·两黄旗(汗亲领)', faction: '后金', commander: '皇太极', soldiers: 30000, morale: 92 },
      { name: '后金·两红旗(代善领)', faction: '后金', commander: '代善', soldiers: 28000, morale: 88 },
      { name: '后金·两白旗(多尔衮兄弟·摄)', faction: '后金', commander: '杜度·多铎·多尔衮(阿巴泰摄)', soldiers: 26000, morale: 85 },
      { name: '关宁军主力', faction: '大明朝廷', commander: '赵率教', soldiers: 80000, morale: 70 }
    ],
    _turnReport: [], _turnChanges: []
  };
  vm.createContext(ctx);
  return ctx;
}

function findArmy(ctx, name) { return ctx.GM.armies.find(a => a.name === name); }

function main() {
  const ctx = buildContext();
  runFile(ctx, 'tm-ai-change-pathutils.js');
  runFile(ctx, 'tm-ai-change-army.js');
  runFile(ctx, 'tm-military.js');

  const Army = ctx.TM.AIChange.Army;
  const Mil = ctx.TM.MilitarySystems || ctx.MilitarySystems;
  assert(Army && typeof Army.applyAIArmyChange === 'function', 'AIChange.Army.applyAIArmyChange 应存在');
  assert(Army && typeof Army.findArmyForAIChange === 'function', 'findArmyForAIChange 应导出');
  assert(Mil && typeof Mil.applyBattleResult === 'function', 'MilitarySystems.applyBattleResult 应存在');

  const lianghong = () => findArmy(ctx, '后金·两红旗(代善领)');

  // ── swap-test：复现旧逻辑（名精确 + 名模糊·无主帅兜底）对「代善部」必然落空 ──
  function legacyFind(G, name) {
    const norm = s => String(s || '').trim().replace(/[\s,，、。？！；：·・\-—_]/g, '').toLowerCase();
    const key = norm(name); if (!key) return null;
    const exact = G.armies.find(a => a && (norm(a.name) === key || norm(a.id) === key));
    if (exact) return exact;
    return G.armies.find(a => {
      const ak = norm(a && a.name);
      return ak && key && (ak.indexOf(key) >= 0 || key.indexOf(ak) >= 0) && Math.abs(ak.length - key.length) <= 4;
    }) || null;
  }
  assert(legacyFind(ctx.GM, '代善部') === null, 'swap-test：旧逻辑「代善部」必落空（这正是 bug 来源）');
  assert(legacyFind(ctx.GM, '代善') === null, 'swap-test：旧逻辑「代善」也落空');
  // 新逻辑命中
  assert(Army.findArmyForAIChange(ctx.GM, '代善部') === lianghong(), '新逻辑：「代善部」按主帅反查命中两红旗');
  assert(Army.findArmyForAIChange(ctx.GM, '代善') === lianghong(), '新逻辑：「代善」按主帅反查命中两红旗');

  // ── [A] army_changes / soldiers_delta 路：折损真落到 soldiers ──
  const s0 = lianghong().soldiers;            // 28000
  Army.applyAIArmyChange({ name: '后金·两红旗(代善领)', soldiers_delta: -1000, reason: '宁锦交锋' }, { source: 'test' });
  assert(lianghong().soldiers === s0 - 1000, '[A] 精确军名仍正常减员 28000→27000');

  Army.applyAIArmyChange({ name: '代善部', soldiers_delta: -3000, reason: '锦州城下折损' }, { source: 'test' });
  assert(lianghong().soldiers === s0 - 4000, '[A] 「代善部」主帅兜底减员 27000→24000');

  Army.applyAIArmyChange({ name: '代善', soldiers_delta: -2000, reason: '再战' }, { source: 'test' });
  assert(lianghong().soldiers === s0 - 6000, '[A] 「代善」主帅兜底减员 24000→22000');

  // 含糊军名但单独给了主帅字段 → 走 commander 反查
  Army.applyAIArmyChange({ name: '后金一部', commander: '代善', soldiers_delta: -2000, reason: '含糊名+主帅' }, { source: 'test' });
  assert(lianghong().soldiers === s0 - 8000, '[A] 含糊名+commander 字段 → 主帅反查减员 22000→20000');

  // ── [B] battleResult 路：defenderArmy 用「代善」也能命中并减员 ──
  const sB0 = lianghong().soldiers;           // 20000
  const r = Mil.applyBattleResult({
    winnerFactionId: '大明朝廷', loserFactionId: '后金',
    defenderArmy: '代善', casualties: { defender: 5000 }
  }, ctx.GM);
  assert(r && r.ok, '[B] battleResult 应结算成功');
  assert(lianghong().soldiers === sB0 - 5000, '[B] battleResult「代善」委托解析命中两红旗减员 20000→15000');

  // ── 不误伤护栏 ──
  // 1) 查无此军：不创建、不乱减
  const before = ctx.GM.armies.map(a => a.soldiers).join(',');
  const miss = Army.applyAIArmyChange({ name: '查无此军', soldiers_delta: -9999, reason: '幽灵' }, { source: 'test' });
  assert(miss && miss.ok === false, '护栏：查无此军 → ok:false（不创建·delta<0）');
  assert(ctx.GM.armies.map(a => a.soldiers).join(',') === before, '护栏：查无此军不动任何军兵力');

  // 2) 主帅不存在：不误伤
  assert(Army.findArmyForAIChange(ctx.GM, '岳飞') === null, '护栏：不存在的主帅名 → 不命中任何军');

  // 3) 多主帅军：单一子帅名（精确等值失败）不误命中——保守边界（需精确军名或完整主帅串）
  assert(Army.findArmyForAIChange(ctx.GM, '多铎') === null, '保守边界：多主帅军不被单个子帅名「多铎」误命中');

  // 4) 友军主帅照样能按名反查（机制对敌我一致·只是玩家少用）
  assert(Army.findArmyForAIChange(ctx.GM, '赵率教') === findArmy(ctx, '关宁军主力'), '主帅反查对友军同样生效');

  // 5) 皇太极 → 两黄旗（不串到两红旗）
  assert(Army.findArmyForAIChange(ctx.GM, '皇太极') === findArmy(ctx, '后金·两黄旗(汗亲领)'), '主帅反查精确：皇太极→两黄旗·不串两红旗');

  // ── [D] prompt 源契约：option 1 硬约束在位（防被静默改掉·治 AI 纯叙事不吐结构化的情况）──

  console.log(`smoke-enemy-casualty-routing: ${pass} assertions PASS`);
}

try { main(); }
catch (e) { console.error(String(e && e.message || e)); process.exit(1); }
