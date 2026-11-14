#!/usr/bin/env node
/* eslint-env node */
// smoke-c4-ai-wiring.js — ①·C4 接进游戏循环（2026-06-16）实跑断言
//   Part A：抽真 appendPromptPolicyContext → GM.rovingRebels 喂出【流寇警报】+ roving_actions 提示（喂 LLM）。
//   Part B：抽 tm-endturn-apply 真 roving_actions 消费器行 → eval 派发到真 PhaseF3.suppress/pacify（剿斩首/抚归籍）。
'use strict';

const fs = require('fs'), path = require('path'), vm = require('vm');
const WEB = path.join(__dirname, '..');
require(path.join(WEB, 'tm-engine-constants.js'));
require(path.join(WEB, 'tm-class-mobility.js'));
const PF3 = global.PhaseF3;

let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ ' + m); } }
function sliceFn(s, marker) { const a = s.indexOf(marker); let j = s.indexOf('{', a), d = 0; for (; j < s.length; j++) { const c = s[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return s.slice(a, j); }

console.log('smoke-c4-ai-wiring — ① C4 接进游戏循环');

// ── Part A：流寇警报喂 LLM ──
const ctxSrc = fs.readFileSync(path.join(WEB, 'tm-endturn-ai-context.js'), 'utf8');
const fnSrc = sliceFn(ctxSrc, 'function appendPromptPolicyContext(');
function buildPrompt(GM) {
  const ctx = { Math: Math, Number: Number, String: String, Array: Array, isFinite: isFinite, console: console, Object: Object, JSON: JSON, global: {}, window: {}, TM: {} };
  vm.createContext(ctx);
  vm.runInContext('function _capture(){};function _slice(v,n){return String(v==null?"":v).slice(0,n||120);}\n' + fnSrc + '\nthis.go=appendPromptPolicyContext;', ctx);
  return ctx.go('', { GM: GM });
}
const gmP = { turn: 5, classes: [{ name: '自耕农', satisfaction: 20, influence: 10, _radicalFrac: 0.7 }],
  rovingRebels: [{ name: '流寇', strength: 82000, regions: ['陕西', '山西'], disbanded: false },
                 { name: '散贼', strength: 0, disbanded: true }] };
const out = buildPrompt(gmP);
ok(/【流寇警报】/.test(out), '流寇警报块喂 LLM');
ok(/众82000/.test(out), '流寇兵力入 prompt (众82000)');
ok(/陕西/.test(out) && /山西/.test(out), '流窜省份入 prompt (陕西/山西)');
ok(/roving_actions/.test(out) && /suppress/.test(out) && /pacify/.test(out), 'prompt 告知可出 roving_actions 剿/抚');
ok(!/散贼/.test(out), '已瓦解流寇(disbanded)不喂 LLM');
const gmEmpty = { turn: 5, classes: [{ name: '自耕农', satisfaction: 60, influence: 10 }], rovingRebels: [] };
ok(!/【流寇警报】/.test(buildPrompt(gmEmpty)), '无流寇→不出警报块');

// ── Part B：apply 真消费器派发到 PhaseF3 ──
const applySrc = fs.readFileSync(path.join(WEB, 'tm-endturn-apply.js'), 'utf8');
const consumerLine = applySrc.split(/\r?\n/).filter(function (l) { return /p1\.roving_actions && Array\.isArray/.test(l); })[0];
ok(!!consumerLine, '抽到 apply 真 roving_actions 消费器行');
function runConsumer(GM, p1) {
  global.GM = GM;
  // eval 真消费器行（p1/PhaseF3 注入·余靠 global）
  const fn = new Function('p1', 'PhaseF3', 'addEB', 'Number', 'Array', consumerLine);
  fn(p1, global.PhaseF3, function () {}, Number, Array);
}
// 造一股流寇：民2c 起全国逃户池不再凝成流寇，这里放一股旧档里已有的（剿抚照旧认它，民2d 换新制）
function mkRebelGM() {
  const GM = { turn: 5, classes: [{ name: '自耕农', _radicalFrac: 0.7, revoltState: { phase: 'uprising' } }],
    population: { byClass: { peasant_self: { mouths: 5000000 } }, byLegalStatus: { taoohu: { mouths: 336000 } } },
    fiscal: { treasury: 2000000 },
    rovingRebels: [{ id: 'roving_3_0', name: '流寇', strength: 64000, regions: ['陕西'], _bornTurn: 3, _peakStrength: 64000, _lastGrewTurn: 3, disbanded: false }] };
  global.GM = GM;
  return GM;
}
// 剿
const gS = mkRebelGM(); const s0 = gS.rovingRebels[0].strength; const t0 = gS.fiscal.treasury;
runConsumer(gS, { roving_actions: [{ action: 'suppress', force: 20000 }] });
ok(gS.rovingRebels[0] && gS.rovingRebels[0].strength < s0, 'AI roving_actions:suppress→真剿(流寇兵力降 ' + s0 + '→' + gS.rovingRebels[0].strength + ')');
ok(gS.fiscal.treasury < t0, '剿耗军饷扣国库 (' + t0 + '→' + gS.fiscal.treasury + ')');
// 抚（中文 action 亦认）
const gP = mkRebelGM(); const p0 = gP.rovingRebels[0].strength;
runConsumer(gP, { roving_actions: [{ action: '招抚' }] });
ok((gP.rovingRebels || []).length === 0, 'AI roving_actions:招抚→真抚(流寇消编)');
ok((gP.population.byLegalStatus.huangji && gP.population.byLegalStatus.huangji.mouths) > 0, '招抚守恒回编户 (huangji=' + (gP.population.byLegalStatus.huangji || {}).mouths + ')');
// 脏数据安全
const gBad = mkRebelGM();
runConsumer(gBad, { roving_actions: [null, { action: '' }, { foo: 1 }] });
ok(gBad.rovingRebels[0].strength === p0 || gBad.rovingRebels[0].strength > 0, '脏 roving_actions 安全(无 action 不动)');

// 源契约
ok(/【流寇警报】/.test(ctxSrc) && /roving_actions/.test(applySrc) && /roving_actions/.test(fs.readFileSync(path.join(WEB, 'tm-ai-schema.js'), 'utf8')), '源契约·prompt+schema+apply 三处接通');

console.log('\n[smoke-c4-ai-wiring] ' + (F ? 'FAIL' : 'PASS') + ' — ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
