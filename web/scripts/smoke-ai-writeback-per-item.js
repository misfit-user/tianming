#!/usr/bin/env node
// smoke-ai-writeback-per-item.js
// 2026-11-06·主回合写回逐条落账（_commitMode:'per-item'）。
//   案由：现行 LLM 模式主写回原为整批原子——一条预检不过、一条处理失败、或一条叙事对不上，
//   整批改动全部撤回，叙事照常提交，世界一点没变（玩家多次反映「过回合失败」）。
//   修法：主写回与二审补录改逐条落账：预检点名的坏条目单条剔掉记账，处理时失败或抛错的条目
//   只记这一条，其余照常落地；只有世界形状被写坏才整批恢复。其它调用方仍是整批原子。
//   顺带：央地引擎事件簿写区划名字，不写内部编号（div_mp3yvbbrj19ga → 乌思藏都指挥使司）。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let passed = 0, failed = 0;
function ok(cond, msg) { if (cond) { passed++; console.log('  ok - ' + msg); } else { failed++; console.error('  ✗ ' + msg); } }

function baseGM() {
  return {
    turn: 9,
    chars: [{ id: 'c1', name: '甲', alive: true, loyalty: 50 }, { id: 'c2', name: '乙', alive: true, loyalty: 50 }],
    facs: [], parties: [], classes: [], armies: [], activeProjects: [],
    activeWars: [], activeDisasters: [], activeEdicts: [], omens: [], religions: [],
    minxin: { trueIndex: 50, revolts: [] }, corruption: { trueIndex: 20 },
    guoku: { money: 1000 }, neitang: { money: 500 },
    adminHierarchy: {}, _turnReport: [], turnChanges: { variables: [], characters: [] },
    memorials: [], currentIssues: [],
    custom: { score: 40 }
  };
}

function makeContext() {
  const quiet = { log() {}, warn() {}, info() {}, error() {} };
  const ctx = {
    console: quiet,
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp,
    isFinite, isNaN, parseInt, parseFloat, Promise, Symbol, Map, Set, WeakMap, WeakSet,
    setTimeout: () => 0, clearTimeout() {}, Error, TypeError, RangeError,
    TM: { errors: { capture() {}, captureSilent() {} } },
    P: {}, GM: baseGM(),
    addEB() {}, recordAIDiagnostic() {},
    renderTopBarVars() {}, syncArmiesToMap() {}, renderMap() {}, syncMilitarySources() {}
  };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ['tm-ai-change-pathutils.js', 'tm-ai-change-army.js', 'tm-ai-change-narrative.js', 'generated/tm-ai-change-applier.bundle.js']
    .forEach((file) => vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file }));
  // 关系落地口：「甲」那条故意抛错，模拟某个 handler 的代码缺陷（11-06 杨鹤印象即此类）
  ctx._relations = [];
  ctx.applyNpcInteraction = function (actor, target, type) {
    if (actor === '甲') throw new Error('模拟处理缺陷');
    ctx._relations.push(actor + '→' + target + ':' + type);
  };
  return ctx;
}

function batch(extra) {
  return Object.assign({
    changes: [
      { path: 'custom.score', delta: 5, reason: '好条目' },
      { path: 'custom.score', delta: '7', reason: '字符串数值，必被拒' }
    ],
    relations: [
      { actor: '甲', target: '乙', type: 'praise' },
      { actor: '乙', target: '甲', type: 'praise' }
    ]
  }, extra || {});
}

console.log('===== 默认仍是整批原子（其它调用方行为不变） =====');
(function () {
  const ctx = makeContext();
  let res, err = null;
  try { res = ctx.applyAITurnChanges(batch()); } catch (e) { err = e; }
  ok(!err && res && res.ok === false && res.rolledBack === true, '默认模式：有坏条目就整批拒绝并恢复');
  ok(ctx.GM.custom.score === 40, '默认模式：好条目也不落（原样）');
})();

console.log('===== 逐条落账：坏的剔掉，好的照落 =====');
(function () {
  const ctx = makeContext();
  const res = ctx.applyAITurnChanges(batch({ _commitMode: 'per-item' }));
  ok(res && res.ok === true && res.partial === true, '逐条模式：返回 ok 且标 partial');
  ok(ctx.GM.custom.score === 45, '好的路径改动落地（40→' + ctx.GM.custom.score + '）');
  ok(ctx._relations.length === 1 && ctx._relations[0] === '乙→甲:praise', '同字段里没出错的那条照常落地');
  const fails = (res && res.applied && res.applied.failed) || [];
  ok(fails.some((f) => f.code === 'handler-exception' && f.field === 'relations' && f.index === 0 && /模拟处理缺陷/.test(f.reason)), '抛错的那条只记这一条（handler-exception，带字段与下标）');
  ok(fails.some((f) => /custom\.score|delta|数/.test(JSON.stringify(f))), '被拒的路径改动记进失败清单');
})();

console.log('===== 逐条落账 + 严格预检：点名的坏条目先剔掉 =====');
(function () {
  const ctx = makeContext();
  const strict = {
    _strictValidation: true,
    _commitMode: 'per-item',
    changes: [{ path: 'custom.score', delta: 3, reason: '好条目' }],
    char_updates: [
      { name: '无此人', updates: { loyalty: 60 } },
      { name: '乙', updates: { loyalty: 55 } }
    ]
  };
  const atomic = ctx.applyAITurnChanges(Object.assign({}, strict, { _commitMode: undefined }));
  ok(atomic && atomic.ok === false && atomic.preflightRejected === true && ctx.GM.custom.score === 40, '对照：整批模式下预检一条不过整批拒');
  const res = ctx.applyAITurnChanges(strict);
  const fails = (res && res.applied && res.applied.failed) || [];
  ok(res && res.ok === true, '逐条模式：预检剔掉坏条目后照常写回');
  ok(ctx.GM.custom.score === 43, '同批好的路径改动落地（40→' + ctx.GM.custom.score + '）');
  ok(ctx.GM.chars[1].loyalty === 55, '同字段里引用正确的那条落地（乙 忠诚 50→' + ctx.GM.chars[1].loyalty + '）');
  ok(fails.some((f) => f.droppedBy === 'strict-preflight' && f.field === 'char_updates' && f.index === 0), '剔掉的条目记账：droppedBy strict-preflight，字段与原下标');
})();

console.log('===== 世界形状被写坏仍整批恢复 =====');
(function () {
  const ctx = makeContext();
  ctx.applyNpcInteraction = function () { ctx.GM.chars = { broken: true }; };
  const res = ctx.applyAITurnChanges(batch({ _commitMode: 'per-item', changes: [{ path: 'custom.score', delta: 5 }], relations: [{ actor: '乙', target: '甲', type: 'praise' }] }));
  ok(res && res.ok === false && res.rolledBack === true, '逐条模式下 chars 被改成非数组：整批恢复');
  ok(Array.isArray(ctx.GM.chars) && ctx.GM.custom.score === 40, '恢复后世界原样');
})();

console.log('===== 回合主写回预检：perItem 时剔除而不是判整回合失败 =====');
(async function () {
  const ctx = makeContext();
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-apply-stages.js'), 'utf8'), ctx, { filename: 'tm-endturn-apply-stages.js' });
  const stage = ctx.TM.Endturn.AI.apply._validateAndRepairMainWriteback;
  ok(typeof stage === 'function', '主写回预检阶段已导出');
  const p1 = { shizhengji: '叙事', char_updates: [{ name: '无此人', updates: { loyalty: 60 } }, { name: '乙', updates: { loyalty: 58 } }] };
  let thrown = null;
  try { await stage(JSON.parse(JSON.stringify(p1)), { source: 'smoke', id: 'sc1' }); } catch (e) { thrown = e; }
  ok(thrown && thrown.code === 'ai-writeback-preflight-failed', '对照：不带 perItem 仍整回合判预检失败');
  const out = await stage(JSON.parse(JSON.stringify(p1)), { source: 'smoke', id: 'sc1', perItem: true });
  ok(out && out.ok === true && out.output.char_updates.length === 1 && out.output.char_updates[0].name === '乙', 'perItem：坏条目剔掉，好条目留下');
  ok(out.dropped && out.dropped.length === 1 && out.dropped[0].field === 'char_updates' && out.dropped[0].index === 0, 'perItem：剔掉的条目随结果交回，供记账');

  const src = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply-stages.js'), 'utf8');
  ok(/_validateAndRepairMainWriteback\(p1, \{[^}]*perItem:true \}\)/.test(src), '回合主写回调用预检时声明 perItem');
  ok(/_mainWritebackBatch1 = \{\s*_strictValidation: true,\s*_commitMode: 'per-item',/.test(src), '回合主写回批次标 per-item');
  ok(/if \(!_applyRes1 \|\| _applyRes1\.ok !== true\) \{/.test(src), '主写回只在整批被拒时中止，不因单条失败抛错');
  ok(/var _applyRes2 = applyAITurnChanges\(\{\s*_commitMode: 'per-item',/.test(src), '二审补录同样逐条落账');

  console.log('===== 央地事件写区划名字 =====');
  const msgs = [];
  // 已过头一回（开局原样的只记不报，见 smoke-warlord-direct-rule）；用直辖的府，羁縻之地不报这些
  const game = { turn: 3, fiscal: { _centralLocalInited: true, auditSystem: { lastAuditedByRegion: {} }, regions: { div_x: { compliance: 0.2, autonomyLevel: 0.9, _signals: { seen: true } } } },
    adminHierarchy: { player: { divisions: [{ id: 'div_top', name: '陕西', children: [{ id: 'div_x', name: '延安府' }] }] } } };
  const cl = { GM: game, P: {}, console: { log() {}, warn() {}, error() {}, info() {} }, Math, JSON, Date, addEB: (t, m) => msgs.push(t + '：' + m) };
  cl.window = cl; cl.global = cl; cl.globalThis = cl;
  vm.createContext(cl);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-central-local-engine.js'), 'utf8'), cl, { filename: 'tm-central-local-engine.js' });
  try { cl.CentralLocalEngine.tick({ turn: 3 }); } catch (_) {}
  const evts = msgs.filter((m) => /^央地/.test(m));
  ok(evts.length > 0 && evts.every((m) => m.indexOf('延安府') >= 0 && m.indexOf('div_x') < 0), '抗命/藩镇事件写区划名字（' + evts.join(' / ') + '）');
  // 人物记忆里的「央地财政」一段（getMemoryContext 的天下大势）同样写名字：区划、分账预设都不写内部编号；
  // 羁縻之地（乌思藏这类，征收低是常态）不列进合规危险区域
  game.fiscal.regions.div_w = { compliance: 0.15, autonomyLevel: 0.9, _signals: { seen: true } };
  game.adminHierarchy.player.divisions.push({ id: 'div_w', name: '乌思藏都指挥使司', regionType: 'jimi' });
  const clCtx = cl.CentralLocalEngine.getAIContext();
  ok(clCtx.indexOf('合规危险区域：延安府(合规') >= 0 && clCtx.indexOf('乌思藏') < 0 && clCtx.indexOf('div_') < 0 && clCtx.indexOf('当前分账预设：明起运存留') >= 0, '人物记忆的央地财政写区划名、预设名，羁縻之地不列（' + clCtx.replace(/\n/g, ' / ') + '）');

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
