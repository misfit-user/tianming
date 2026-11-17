#!/usr/bin/env node
// scripts/smoke-ai-change-applier-baseline.js
//
// BASELINE smoke·锁 generated/tm-ai-change-applier.bundle.js 当前对外暴露的 17 函数 + 8 全局快捷·
// 拆分前后必须保持·exports 数量 / 名称 / 签名 / 关键行为 一致。
//
// 拆分路线 (Slice 1-3) 之前·此 smoke 必须 PASS·
// 拆分完成后·此 smoke 仍必须 PASS·任何 export 漂移都会被 catch。
//
// 范围·
//   [A] structural: AIChangeApplier 上 17 函数 + 8 globals 都存在·VERSION === 1
//   [B] signature: 每函数 .length arity 锁定
//   [C] behavior:  pure helper / 不依赖 GM 的 helper 调一遍·不崩
//   [D] heavy-API: 给最小 GM mock·调 applyAITurnChanges/onAppointment/onDismissal·不崩

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function runFile(ctx, file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
}

// ── 17 public functions in AIChangeApplier export ──
const PUBLIC_FUNCS = [
  'applyAITurnChanges',
  'applyAIArmyChange',
  'onAppointment',
  'onDismissal',
  'onTransfer',
  'registerInstitution',
  'abolishInstitution',
  'reclassifyRegion',
  'resolveBinding',
  'ensurePublicTreasury',
  'applyPathDelta',
  'applyPathSet',
  'preflightAIWriteBack',
  'generateTurnReport',
  'renderTurnReport',
  'buildFullAIContext',
  'advanceCharTravelByDays'
];

// ── 8 global shortcuts ──
const GLOBAL_SHORTCUTS = [
  'applyAITurnChanges',
  'applyAIArmyChange',
  'onAppointment',
  'onDismissal',
  '_resolveBinding',
  'renderTurnReport',
  'buildFullAIContext',
  'advanceCharTravelByDays'
];

// ── Function arities (locked·拆分后必须仍是这个 arity·实际参数个数·非 default) ──
// 用 fn.length 检查·只数到第一个 default-arg / rest 之前的参数。
const FUNC_ARITIES = {
  applyAITurnChanges: 1,
  applyAIArmyChange: 2,
  onAppointment: 3,
  onDismissal: 3,   // 刀C·返工issue4(2026-07-19)·新增第3形参 aiOutput(死亡管线收口来源判据·仅 AI-apply 通道传入·既有二参调用向后兼容 undefined)
  onTransfer: 4,
  registerInstitution: 1,
  abolishInstitution: 2,
  reclassifyRegion: 3,
  resolveBinding: 1,
  ensurePublicTreasury: 1,
  applyPathDelta: 4,
  applyPathSet: 4,
  preflightAIWriteBack: 2,
  generateTurnReport: 1,
  renderTurnReport: 1,
  buildFullAIContext: 0,
  advanceCharTravelByDays: 1
};

function buildContext() {
  const ctx = {
    console: { log() {}, warn() {}, info() {}, error() {}, debug() {} },
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, isNaN, parseInt, parseFloat, Promise, Symbol, Map, Set,
    setTimeout: (fn) => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    Error, TypeError, RangeError
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;

  // 最小 GM 模拟·只满足 applier 的字段读
  ctx.GM = {
    turn: 5,
    chars: [
      { name: '张三', position: '兵部尚书', loyalty: 60, alive: true, faction: '明朝廷', _resources: {} },
      { name: '李四', position: '户部主事', loyalty: 70, alive: true, faction: '明朝廷', _resources: {} }
    ],
    facs: [{ name: '明朝廷', isPlayer: true, treasury: { money: 1000 } }],
    parties: [],
    classes: [],
    armies: [{ name: '神龙军', commander: '张三', size: 5000, quality: 'normal' }],
    items: [],
    regions: [],
    officeTree: { 中央: {} },
    guoku: { money: 50000, grain: 30000 },
    neitang: { money: 20000, balance: 20000, ledgers: { stock: { money: 20000 } } },
    publicTreasury: {},
    _turnReport: [],
    _achievements: [],
    _turnChanges: [],
    _institutionCounter: 0,
    vars: { huangquan: 70, huangwei: 60, minxin: 50 },
    population: { registered: 100000, actual: 120000 },
    capital: { name: '北京', regionId: 'beijing' }
  };
  ctx.P = { playerInfo: { factionName: '明朝廷' }, conf: {}, time: { year: 1627 } };
  // applier 调的几个外部辅助·stub
  ctx.escHtml = (s) => String(s || '');
  ctx.getTSText = (t) => 'T' + t;
  ctx.adjustCharacterLoyalty = (ch, d, reason, opts) => {
    ch.loyalty = Math.max(0, Math.min(100, (ch.loyalty || 50) + d));
    return { ok: true, newValue: ch.loyalty };
  };
  ctx.setCharacterLoyalty = (ch, v, reason, opts) => { ch.loyalty = v; return { ok: true, newValue: v }; };
  ctx.invalidateCharIndex = () => {};
  ctx.TM = ctx.TM || {};
  ctx.TM.errors = { capture: () => {} };

  vm.createContext(ctx);
  return ctx;
}

function main() {
  const ctx = buildContext();
  // 2026-05-21·Slice 1+2+3·加载顺序·pathutils → army → narrative → applier
  runFile(ctx, 'tm-ai-change-pathutils.js');
  runFile(ctx, 'tm-ai-change-army.js');
  runFile(ctx, 'tm-ai-change-narrative.js');
  runFile(ctx, 'generated/tm-ai-change-applier.bundle.js');

  // [A] structural ─────
  assert(ctx.AIChangeApplier, 'global.AIChangeApplier missing');
  assert(typeof ctx.AIChangeApplier === 'object', 'AIChangeApplier should be object');
  assert(ctx.AIChangeApplier.VERSION === 1, 'AIChangeApplier.VERSION should be 1');

  let missingExports = [];
  PUBLIC_FUNCS.forEach(name => {
    if (typeof ctx.AIChangeApplier[name] !== 'function') missingExports.push(name);
  });
  assert(missingExports.length === 0,
    `AIChangeApplier missing public functions: ${missingExports.join(',')}`);

  let missingGlobals = [];
  GLOBAL_SHORTCUTS.forEach(name => {
    if (typeof ctx[name] !== 'function') missingGlobals.push(name);
  });
  assert(missingGlobals.length === 0,
    `global shortcuts missing: ${missingGlobals.join(',')}`);

  // [B] signature ─────
  let arityMismatches = [];
  Object.keys(FUNC_ARITIES).forEach(name => {
    const expected = FUNC_ARITIES[name];
    const actual = ctx.AIChangeApplier[name].length;
    if (actual !== expected) arityMismatches.push(`${name}: expected ${expected}, got ${actual}`);
  });
  assert(arityMismatches.length === 0,
    `function arity mismatches: ${arityMismatches.join(' | ')}`);

  // [C] pure-helper smoke (path utils + entity lookup directly via globals)
  // applyPathSet / applyPathDelta — write into GM
  // 下划线开头是运行时内部字段，强写回契约必须拒绝；普通自定义数值 path 仍可写。
  ctx.GM._smokeTestNum = 100;
  const blockedInternal = ctx.AIChangeApplier.applyPathSet(ctx.GM, '_smokeTestNum', 80, 'smoke-test');
  assert(blockedInternal && blockedInternal.ok === false && ctx.GM._smokeTestNum === 100,
    'applyPathSet should reject an underscore-prefixed internal path');

  ctx.GM.smokeTestNum = 100;
  ctx.AIChangeApplier.applyPathSet(ctx.GM, 'smokeTestNum', 80, 'smoke-test');
  assert(ctx.GM.smokeTestNum === 80, `applyPathSet should write 80·got ${ctx.GM.smokeTestNum}`);

  ctx.AIChangeApplier.applyPathDelta(ctx.GM, 'smokeTestNum', -10, 'smoke-test');
  assert(ctx.GM.smokeTestNum === 70, `applyPathDelta -10 should result in 70·got ${ctx.GM.smokeTestNum}`);

  // 用 core var path·测 normalize 路径
  ctx.GM.huangquan = { index: 70 };
  ctx.AIChangeApplier.applyPathSet(ctx.GM, 'huangquan.index', 75, 'smoke-test');
  assert(ctx.GM.huangquan.index === 75, `applyPathSet(huangquan.index)=75 should work·got ${ctx.GM.huangquan.index}`);

  // [D] safe behavior smoke (轻量·不依赖完整 GM 结构)
  // — heavy applyAITurnChanges/onAppointment 等 method 依赖 GM 全状态·已被别的
  //   的 endturn smoke / smoke-faction-npc-* 覆盖·这里不重复·避免 mock 漂移。
  //   只跑 pure helper + 不写状态的查询类。

  // applyPathPush — 不在 export 里·但 applyPathSet 已覆盖
  // resolveBinding — 不依赖 GM·只解析 binding 描述符
  let binding;
  try {
    binding = ctx.AIChangeApplier.resolveBinding({ type: 'central_treasury' });
  } catch (e) {
    throw new Error(`resolveBinding({type:central_treasury}) crashed: ${e.message}`);
  }

  // ensurePublicTreasury — 给一个干净 entity·确保它能 init publicTreasury 结构
  const ent = {};
  try {
    ctx.AIChangeApplier.ensurePublicTreasury(ent);
  } catch (e) {
    throw new Error(`ensurePublicTreasury({}) crashed: ${e.message}`);
  }
  assert(ent.publicTreasury, 'ensurePublicTreasury should init publicTreasury on entity');

  console.log('[smoke-ai-change-applier-baseline] all assertions pass');
  console.log('  exports: ' + PUBLIC_FUNCS.length + ' funcs locked');
  console.log('  globals: ' + GLOBAL_SHORTCUTS.length + ' shortcuts locked');
  console.log('  arities: ' + Object.keys(FUNC_ARITIES).length + ' functions arity locked');
  console.log('  behavior: blocked internal path + applyPathSet/Delta (custom + core var path) + resolveBinding + ensurePublicTreasury');
}

try { main(); } catch (e) {
  console.error('[smoke-ai-change-applier-baseline] FAIL:', e && e.message || e);
  process.exit(1);
}
