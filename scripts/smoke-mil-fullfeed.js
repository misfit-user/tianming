/*
 * smoke-mil-fullfeed.js — 军队全貌喂 AI 推演(补盲·tm-endturn-ai-context.js 主路径)
 *   原 prompt 只喂「军情警报」=风险军队(粮/气/欠饷/兵变)·健康军队+训练/编制/主帅武智/总兵力全盲。
 *   补:军力概况(总兵/精锐/虚弱/缺帅) + 主力军镇(按兵力·含主帅武智/训练/编制)·让 AI 用将募兵战守有据。
 *   ★注入加在主路径 appendPromptPolicyContext(ai-context)·非 tm-endturn-prompt.js 死 else fallback。
 *   测:从 ai-context 抽真实军力全貌片段 eval·验四态。
 * node scripts/smoke-mil-fullfeed.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

const src = fs.readFileSync(path.join(ROOT, 'tm-endturn-ai-context.js'), 'utf8');

ok(/本朝军力·全貌/.test(src) && /主力军镇/.test(src), 'ai-context 主路径含军力全貌 + 主力军镇');
ok(/military\|\|_c\.valor|military.*intelligence/.test(src.replace(/\n/g, '')), '主力军镇含主帅武智');
ok(/编制/.test(src) && /composition/.test(src), '含编制兵种');
ok(/精锐/.test(src) && /虚弱/.test(src), '含精锐/虚弱概况');

const s1 = src.indexOf('// 本朝军力·全貌(补盲');
const riskIdx = src.indexOf('var riskArmies = GM.armies.filter');
const ei = src.lastIndexOf('if (Array.isArray(GM.armies)', riskIdx);
ok(s1 >= 0 && ei > s1, '可抽取军力全貌片段(主路径·军情警报前)');
const body = src.slice(s1, ei);
let fn;
try { fn = new Function('GM', 'P', 'stateLines', 'findCharByName', body); } catch (e) { ok(false, '片段可编译: ' + e.message); }

if (fn) {
  const chars = { '甲': { military: 80, intelligence: 70, alive: true }, '乙': { military: 60, intelligence: 50, alive: true }, '亡': { military: 55, alive: false } };
  const findC = (n) => chars[n] || null;
  const gmA = { armies: [
    { name: '京营·五军营', faction: '明', soldiers: 60000, training: 75, morale: 65, commander: '甲', composition: [{ type: '步兵', count: 380 }, { type: '骑兵', count: 90 }] },
    { name: '边军', faction: '明', soldiers: 20000, training: 35, morale: 30, commander: '乙' },
    { name: '敌军', faction: '后金', soldiers: 50000, training: 90 }
  ] };
  let slA = [];
  fn(gmA, { playerInfo: { factionName: '明' } }, slA, findC);
  const outA = slA.join('\n');
  ok(/本朝军力·全貌/.test(outA) && /共 2 支/.test(outA), 'Case A:只统本朝(2支·排除敌军)');
  ok(/总兵 80,000/.test(outA), 'Case A:总兵力汇总(千分位)');
  ok(/精锐.*1 支/.test(outA) && /虚弱.*1 支/.test(outA), 'Case A:精锐1(京营训75气65)/虚弱1(边军训35气30)');
  ok(/主力军镇/.test(outA) && /京营·五军营/.test(outA) && /武80智70/.test(outA), 'Case A:主力军镇含最大军+主帅武智');
  ok(/编制步兵\/骑兵/.test(outA), 'Case A:编制兵种');
  ok(/训75/.test(outA) && /气65/.test(outA), 'Case A:训练+士气');

  let slB = [];
  fn(gmA, { playerInfo: { factionName: '楚' } }, slB, findC);
  ok(slB.length === 0, 'Case B:无本朝军队 → 零注入');

  let slC = [];
  fn({ armies: [{ name: '孤军', faction: '明', soldiers: 5000, training: 50, commander: '' }] }, { playerInfo: { factionName: '明' } }, slC, findC);
  ok(/缺帅/.test(slC.join('\n')) && /缺帅\/阵殁 1 支/.test(slC.join('\n')), 'Case C:缺帅 → 概况计缺帅+主力标缺帅');

  let slD = [];
  fn({ armies: [{ name: '残军', faction: '明', soldiers: 3000, training: 50, commander: '亡' }] }, { playerInfo: { factionName: '明' } }, slD, findC);
  ok(/阵殁\/失联/.test(slD.join('\n')), 'Case D:主帅阵殁 → 标阵殁/失联·待补');

  let safe = true; try { let s = []; fn({ armies: [{ name: 'x', faction: '明', soldiers: 1 }] }, undefined, s, findC); } catch (e) { safe = false; }
  ok(safe, 'Case E:P undefined 不抛错(typeof 防护)');
}

const vm = require('vm');
let syn = true; try { new vm.Script(src); } catch (e) { syn = false; }
ok(syn, 'tm-endturn-ai-context.js 语法有效');

console.log('\nsmoke-mil-fullfeed: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
