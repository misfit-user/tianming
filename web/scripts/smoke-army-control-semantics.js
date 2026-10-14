// smoke-army-control-semantics.js — 军队「掌控」与「私兵度」互为 100 补数（2026-10-14）
// 病：control（掌控·高=国家兵）与 controlLevel（私兵度·高=将领家丁）被当成同一个数写：问天「加强京营掌控」把私兵度一起抬高，
//     AI 新建军两边都默认 60（私兵度 60 正好踩在「私兵化」线上）。bot 10-07 在群里实测报出。
// 验：问天直改 掌控/私兵度 两侧反向；AI 改军 control/controlLevel/两种 delta 都反向；新建军默认 60/40；别名表。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n  ' + (e && e.stack || e)); } }

// ── A·问天直改（切 tm-game-loop(-wentian-hardchange) 的 helper 块，与 smoke-wentian-hardchange 同法）──
function wentianContext() {
  const src = fs.readFileSync(path.join(ROOT, 'tm-game-loop.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'tm-game-loop-wentian-hardchange.js'), 'utf8');
  const start = src.indexOf('function _wtNormalizeHardChangePath');
  const end = src.indexOf('function _wtReviseFromPending');
  assert(start >= 0 && end > start, 'hard-change helper block missing');
  const context = {
    console,
    GM: { armies: [{ name: '京营', soldiers: 30000, controlLevel: 60 }, { name: '关宁军', soldiers: 40000, control: 70, controlLevel: 30 }], chars: [], allCharacters: [], _listeners: { varChange: [] } },
    P: {},
    renderLeftPanel() {}, renderGameState() {}, renderGuokuPanel() {}, renderNeitangPanel() {}, renderRenwu() {}, addEB() {},
    setTimeout, clearTimeout, requestIdleCallback(fn) { return setTimeout(fn, 0); }, cancelIdleCallback(id) { clearTimeout(id); }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(src.slice(start, end), context, { filename: 'wentian-hardchange-block.js' });
  return context;
}

test('别名：掌控/控制/军纪 → control；私兵/私兵度/私兵化/私兵程度/controlLevel → controlLevel', () => {
  const c = wentianContext();
  for (const w of ['掌控', '控制', '军纪', 'control']) assert.strictEqual(c._wtCanonicalArmyHardChangeField(w), 'control', w);
  for (const w of ['私兵', '私兵度', '私兵化', '私兵程度', 'controlLevel']) assert.strictEqual(c._wtCanonicalArmyHardChangeField(w), 'controlLevel', w);
});

test('问天「armies.京营.掌控 set 90」：掌控 90、私兵度 10（原来私兵度跟着变 90）', () => {
  const c = wentianContext();
  assert.strictEqual(c._wtApplyHardChange('armies.京营.掌控', 'set', 90), true);
  assert.strictEqual(c.GM.armies[0].control, 90);
  assert.strictEqual(c.GM.armies[0].controlLevel, 10);
});

test('问天「armies.关宁军.私兵度 set 75」：私兵度 75、掌控 25；超界夹到 0..100', () => {
  const c = wentianContext();
  assert.strictEqual(c._wtApplyHardChange('armies.关宁军.私兵度', 'set', 75), true);
  assert.strictEqual(c.GM.armies[1].controlLevel, 75);
  assert.strictEqual(c.GM.armies[1].control, 25);
  assert.strictEqual(c._wtApplyHardChange('armies.关宁军.掌控', 'add', 500), true);
  assert.strictEqual(c.GM.armies[1].control, 100);
  assert.strictEqual(c.GM.armies[1].controlLevel, 0);
});

// ── B·AI 改军（tm-ai-change-pathutils → tm-ai-change-army，与 smoke-ai-change-applier-baseline 同序）──
function aiContext() {
  const ctx = {
    console, setTimeout, clearTimeout, Date, Math, JSON,
    GM: { turn: 3, armies: [{ name: '京营', soldiers: 30000, controlLevel: 60, faction: '明朝廷' }], chars: [], allCharacters: [], facs: [{ name: '明朝廷', id: 'ming' }], playerInfo: { factionName: '明朝廷' }, _turnReport: [] },
    P: {},
    addEB() {}, toast() {}, deepClone(v) { return JSON.parse(JSON.stringify(v)); }, invalidateCharIndex() {},
    adjustCharacterLoyalty(ch, d) { ch.loyalty = (ch.loyalty || 50) + d; return { ok: true }; },
    setCharacterLoyalty(ch, v) { ch.loyalty = v; return { ok: true }; },
    TM: { errors: { capture() {}, captureSilent() {} }, FactionIndex: { rebuild() {} } }
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['tm-ai-change-pathutils.js', 'tm-ai-change-army.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  assert(ctx.TM.AIChange && ctx.TM.AIChange.Army && typeof ctx.TM.AIChange.Army.applyAIArmyChange === 'function', 'TM.AIChange.Army.applyAIArmyChange missing');
  return ctx;
}

test('AI 改军 control=90 → 掌控 90、私兵度 10；controlLevel=80 → 私兵度 80、掌控 20', () => {
  const ctx = aiContext();
  const A = ctx.TM.AIChange.Army;
  let r = A.applyAIArmyChange({ armyName: '京营', control: 90, reason: '整饬京营' }, {});
  assert(r.ok, JSON.stringify(r));
  assert.strictEqual(ctx.GM.armies[0].control, 90);
  assert.strictEqual(ctx.GM.armies[0].controlLevel, 10);
  r = A.applyAIArmyChange({ armyName: '京营', controlLevel: 80, reason: '家丁坐大' }, {});
  assert(r.ok, JSON.stringify(r));
  assert.strictEqual(ctx.GM.armies[0].controlLevel, 80);
  assert.strictEqual(ctx.GM.armies[0].control, 20);
});

test('AI 改军 control_delta=+30 与 controlLevel_delta=+15 方向相反；旧档只有 controlLevel 时先折成掌控', () => {
  const ctx = aiContext();
  const A = ctx.TM.AIChange.Army;
  // 旧档：只有 controlLevel 60 → 掌控视为 40
  let r = A.applyAIArmyChange({ armyName: '京营', control_delta: 30, reason: '收兵权' }, {});
  assert(r.ok, JSON.stringify(r));
  assert.strictEqual(ctx.GM.armies[0].control, 70);
  assert.strictEqual(ctx.GM.armies[0].controlLevel, 30);
  r = A.applyAIArmyChange({ armyName: '京营', controlLevel_delta: 15, reason: '将领私募' }, {});
  assert(r.ok, JSON.stringify(r));
  assert.strictEqual(ctx.GM.armies[0].controlLevel, 45);
  assert.strictEqual(ctx.GM.armies[0].control, 55);
});

test('AI 新建军：给 control 80 → 私兵度 20；什么都不给 → 掌控 60 / 私兵度 40（原来两边都 60）', () => {
  const ctx = aiContext();
  const A = ctx.TM.AIChange.Army;
  let r = A.applyAIArmyChange({ armyName: '御前亲军', action: 'create', soldiers: 5000, control: 80, faction: '明朝廷', location: '京师', reason: '编练亲军' }, {});
  assert(r.ok && r.created, JSON.stringify(r));
  const a1 = ctx.GM.armies.find(a => a.name === '御前亲军');
  assert.strictEqual(a1.control, 80);
  assert.strictEqual(a1.controlLevel, 20);
  r = A.applyAIArmyChange({ armyName: '新练营', action: 'create', soldiers: 3000, faction: '明朝廷', location: '京师', reason: '编练' }, {});
  assert(r.ok && r.created, JSON.stringify(r));
  const a2 = ctx.GM.armies.find(a => a.name === '新练营');
  assert.strictEqual(a2.control, 60);
  assert.strictEqual(a2.controlLevel, 40);
});

console.log(`${passed} passed / ${failed} failed`);
process.exit(failed ? 1 : 0);
