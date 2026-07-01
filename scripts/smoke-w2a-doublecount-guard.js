/*
 * smoke-w2a-doublecount-guard.js — W2a 双算硬护栏（会战已结算的势力·AI 重复负扣实力被硬拦）
 *   ★测真代码：headless 加载整个 app → 调真导出函数 TM.Endturn.AI.apply.guardBattleStrengthDelta(G,facName,sd)
 *   （非仿真）+ 源契约验 applier 集成。tm-endturn-apply.js faction_changes applier 用它·返 0 即硬拦。
 * node scripts/smoke-w2a-doublecount-guard.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const HEADLESS = path.join(__dirname, 'headless-smoke.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

// ════════ 一·源契约：护栏抽函数 + applier 集成（ASCII 锚点·faction 段中文为 \u 转义） ════════
const src = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
ok(/function _tmGuardBattleStrengthDelta\(G, facName, sd\)/.test(src), '护栏谓词已抽为可测函数 _tmGuardBattleStrengthDelta');
ok(/ns\.guardBattleStrengthDelta = _tmGuardBattleStrengthDelta/.test(src), '导出 ns.guardBattleStrengthDelta 供单测真代码');
ok(/_dt = \(G\.turn\|\|0\) - \(b && b\.turn \|\| 0\)[\s\S]{0,80}_dt >= 0 && _dt <= 1/.test(src), '容 1 拍 turn 匹配（覆盖 GM.turn++ 边界）');
ok(/_battleSettledFactions/.test(src) && /b\.strengthDelta\|\|0\) < 0/.test(src), '读 _battleSettledFactions·仅 reactor 负扣记录触发');
ok(/_sdG = _tmGuardBattleStrengthDelta\(GM, fc\.name, _sd\)/.test(src), 'applier 调用护栏谓词');
const gi = src.indexOf('_sdG = _tmGuardBattleStrengthDelta');
const ai = src.indexOf('fac.strength = clamp(oldS + _sd', gi);
ok(gi > 0 && ai > gi, '护栏在写 fac.strength 之前（拦得住）');

// ════════ 二·真代码：headless 加载 app → 调真导出函数 ════════
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();
const env = helpers.makeStubs();
const sandbox = vm.createContext(env.win);
const scripts = helpers.parseIndexHtmlScripts();
const cutoff = scripts.findIndex((s) => path.basename(s) === 'tm-test-harness.js');
(cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((s) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), sandbox, { filename: s, timeout: 20000 }); } catch (e) {} });

ok(vm.runInContext('!!(TM&&TM.Endturn&&TM.Endturn.AI&&TM.Endturn.AI.apply&&typeof TM.Endturn.AI.apply.guardBattleStrengthDelta==="function")', sandbox), 'boot 后真函数 TM.Endturn.AI.apply.guardBattleStrengthDelta 可调');

function realGuard(G, fac, sd) { sandbox.__G = G; sandbox.__fac = fac; sandbox.__sd = sd; return vm.runInContext('TM.Endturn.AI.apply.guardBattleStrengthDelta(__G,__fac,__sd)', sandbox); }
function settled(f, t, d) { return { faction: f, turn: t, strengthDelta: d }; }

// (a) 本回合已结算 + AI 再负扣 → 真函数返 0（硬拦）
ok(realGuard({ turn: 5, _battleSettledFactions: [settled('明朝廷', 5, -5)] }, '明朝廷', -8) === 0, '真码：本回合已结算·AI 负扣 -8 → 返 0（硬拦·防双算）');
// (b) 已结算 + AI 正向（增）→ 放行（原样返回）
ok(realGuard({ turn: 5, _battleSettledFactions: [settled('明朝廷', 5, -5)] }, '明朝廷', 6) === 6, '真码：已结算·AI 正向 +6 → 返 6（只拦重复扣·不拦增）');
// (c) 紧邻上一回合结算(turn++ 边界:结算 turn5·应用 turn6) + AI 负扣 → 仍返 0（容 1 拍）
ok(realGuard({ turn: 6, _battleSettledFactions: [settled('明朝廷', 5, -5)] }, '明朝廷', -7) === 0, '真码：紧邻上回合结算(差1拍)·AI 负扣 → 返 0（覆盖 turn++ 边界·主推演 post-turn 才应用）');
// (d) 两回合前结算(差 2 拍) + AI 负扣 → 放行（不跨回合误拦·允许新衰落）
ok(realGuard({ turn: 6, _battleSettledFactions: [settled('明朝廷', 4, -5)] }, '明朝廷', -7) === -7, '真码：两回合前结算(差2拍)·AI 负扣 → 返 -7（不跨回合误拦）');
// (e) 未结算势力 + AI 负扣 → 正常返回（不误伤）
ok(realGuard({ turn: 5, _battleSettledFactions: [settled('明朝廷', 5, -5)] }, '后金', -4) === -4, '真码：未结算势力·AI 负扣 → 返 -4（不误伤）');
// (f) 无 _battleSettledFactions（flag 关）→ 原样返回（零回归）
ok(realGuard({ turn: 5 }, '明朝廷', -8) === -8, '真码：无结算账本(flag 关) → 返 -8（零回归）');
// (g) reactor 记录为正(不应发生) → 不触发（条件要求 reactor delta<0）
ok(realGuard({ turn: 5, _battleSettledFactions: [settled('明朝廷', 5, 5)] }, '明朝廷', -8) === -8, '真码：reactor 记录非负 → 不触发 → 返 -8（条件严谨）');

console.log('\nsmoke-w2a-doublecount-guard: PASS ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);   // 强制退出：headless 加载的 app 有残留定时器会挂住事件循环
