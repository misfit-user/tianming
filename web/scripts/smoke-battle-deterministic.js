#!/usr/bin/env node
'use strict';
// smoke-battle-deterministic — BattleEngine 确定性战果 opt-in(二梯·接通死引擎)
// 死代码:BattleEngine.resolve(确定性兵力对撞)从不被调(无人写 activeBattles)·战果全凭 AI 自由裁量
// 默认 ON(2026-07-05 翻默认·owner 定)·P.conf/battleConfig.deterministicCasualties===false 才关·AI 漏报/离谱伤亡→引擎确定性核算·正常伤亡不干预
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }

const ctx = { console: { log() {}, warn() {}, error() {} }, Math, JSON, String, Number, Array, Object, RegExp, parseInt, parseFloat, isFinite, isNaN, Date: { now: () => 0 } };
ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
ctx.SettlementPipeline = { register: function () {} }; // 载入期依赖 stub
ctx.TM = {};
vm.createContext(ctx);
// 先载 tm-utils.js(createSubRng/uid/_rngState 真源·确定性核算依赖)·再载 tm-military.js
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-utils.js'), 'utf8'), ctx, { filename: 'tm-utils.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-military.js'), 'utf8'), ctx, { filename: 'tm-military.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-battle-contract.js'), 'utf8'), ctx, { filename: 'tm-battle-contract.js' });
const MS = ctx.MilitarySystems;

console.log('smoke-battle-deterministic');
ok(MS && typeof MS.applyBattleResult === 'function', '① MilitarySystems.applyBattleResult 可达');

function freshGM() {
  ctx.GM = { turn: 5, chars: [], armies: [
    { name: '关宁军', faction: '明朝廷', soldiers: 50000, morale: 60, loyalty: 60, cohesion: 70, commander: '袁崇焕' },
    { name: '八旗', faction: '后金', soldiers: 60000, morale: 70, loyalty: 70, cohesion: 75, commander: '皇太极' }
  ] };
}
const atk = () => ctx.GM.armies[0];
const def = () => ctx.GM.armies[1];
function brAbsurd() { return { battleId: 'deterministic-fixture', winner: '后金', loser: '明朝廷', attacker: '关宁军', defender: '八旗', terrain: 'plains', casualties: { attacker: 999999, defender: 200 } }; }

// ── ② 默认 ON(2026-07-05 翻默认):无 flag → 引擎接管离谱伤亡 ──
freshGM(); ctx.P = { conf: {}, battleConfig: {} };
let br2 = brAbsurd();
MS.applyBattleResult(br2, ctx.GM);
ok(atk().soldiers > 0 && atk().soldiers < 50000, '② 默认ON:无 flag 即引擎接管→关宁军损失合理(>0 且 <5万·实存 ' + atk().soldiers + ')');
ok(br2._deterministicCasualties === true, '② 默认ON:br 标记 _deterministicCasualties');
// ── ②b 显式 false → 关(尊重 opt-out·离谱伤亡照旧应用) ──
freshGM(); ctx.P = { conf: { deterministicCasualties: false }, battleConfig: {} };
MS.applyBattleResult(brAbsurd(), ctx.GM);
ok(atk().soldiers === 0, '②b 显式关(===false):离谱伤亡 999999 照旧应用→关宁军削到 0(尊重 opt-out)');

// ── ③ ON:离谱伤亡 → BattleEngine 确定性替代(损失合理) ──
freshGM(); ctx.P = { conf: { deterministicCasualties: true }, battleConfig: {} };
let br = brAbsurd();
MS.applyBattleResult(br, ctx.GM);
ok(atk().soldiers > 0 && atk().soldiers < 50000, '③ ON:离谱伤亡被引擎替代→关宁军损失合理(>0 且 <5万·实存 ' + atk().soldiers + ')');
ok(br._deterministicCasualties === true, '③ ON:br 标记 _deterministicCasualties(留痕)');

// ── ④ ★确定性可复现:同战同种子 → 同战损 ──
freshGM(); ctx.P = { conf: { deterministicCasualties: true }, battleConfig: {} };
MS.applyBattleResult(brAbsurd(), ctx.GM); let loss1 = 50000 - atk().soldiers;
freshGM();
MS.applyBattleResult(brAbsurd(), ctx.GM); let loss2 = 50000 - atk().soldiers;
ok(loss1 === loss2 && loss1 > 0, '④ ★确定性:同战同种子→同战损(loss1===loss2=' + loss1 + ')');

// ── ⑤ ON:双方 0 伤亡(AI 漏报) → 确定性核算非 0 ──
freshGM(); ctx.P = { conf: { deterministicCasualties: true }, battleConfig: {} };
let br0 = { winner: '后金', loser: '明朝廷', attacker: '关宁军', defender: '八旗', terrain: 'plains', casualties: { attacker: 0, defender: 0 } };
MS.applyBattleResult(br0, ctx.GM);
ok(atk().soldiers < 50000 || def().soldiers < 60000, '⑤ ON:双方 0 伤亡(漏报)→确定性核算非 0');
ok(br0._deterministicCasualties === true, '⑤ ON:both-zero 触发替代');

// ── ⑥ ON:合理伤亡 → 不覆盖(AI 主导保留) ──
freshGM(); ctx.P = { conf: { deterministicCasualties: true }, battleConfig: {} };
let brOk = { winner: '后金', loser: '明朝廷', attacker: '关宁军', defender: '八旗', terrain: 'plains', casualties: { attacker: 3000, defender: 8000 } };
MS.applyBattleResult(brOk, ctx.GM);
ok(atk().soldiers === 47000, '⑥ ON:合理伤亡 3000 不被覆盖→50000-3000=47000(AI 主导保留·实 ' + atk().soldiers + ')');
ok(def().soldiers === 52000, '⑥ ON:守方合理 8000 保留→60000-8000=52000');
ok(!brOk._deterministicCasualties, '⑥ ON:合理数不标记替代(不干预)');

// ── ⑦ 显式关(===false):双方 0 伤亡照旧 → 兵力不变(尊重 opt-out) ──
freshGM(); ctx.P = { conf: { deterministicCasualties: false }, battleConfig: {} };
let br0b = { winner: '后金', loser: '明朝廷', attacker: '关宁军', defender: '八旗', casualties: { attacker: 0, defender: 0 } };
MS.applyBattleResult(br0b, ctx.GM);
ok(atk().soldiers === 50000 && def().soldiers === 60000, '⑦ 显式关(===false):双方 0 伤亡照旧→兵力不变(尊重 opt-out·关时整块跳过)');

// ── ⑧ battleConfig 入口同样启用 ──
freshGM(); ctx.P = { conf: {}, battleConfig: { deterministicCasualties: true } };
let brc = brAbsurd();
MS.applyBattleResult(brc, ctx.GM);
ok(brc._deterministicCasualties === true, '⑧ battleConfig.deterministicCasualties 同样启用 opt-in');

// ── ⑨ 源契约 ──
const mil = fs.readFileSync(path.join(ROOT, 'tm-military.js'), 'utf8');
ok(/!cfg\.enabled && !\(context && context\.forceCompute\)/.test(mil), '⑨ resolve 加 forceCompute 旁路(不需全引擎 enabled)');
ok(/deterministicCasualties === false[\s\S]{0,400}BattleEngine\.resolve/.test(mil), '⑨ applyBattleResult 默认ON块(===false才关)接 BattleEngine.resolve');
const pat = (fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8'));
ok(pat.indexOf('确定性战果（默认开）') >= 0 && pat.indexOf('deterministicCasualties') >= 0 && /id="s-det-cas"/.test(pat), '⑨ 设置开关「确定性战果（默认开）」已加(checkbox 接 _togglePConf)');

console.log('\n结果: ' + A + ' 通过 / 0 失败');
