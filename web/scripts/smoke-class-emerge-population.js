#!/usr/bin/env node
/* eslint-env node */
// smoke-class-emerge-population.js — 现生阶层人口格子保障（§7.2.②·2026-06-16）
// 验：ensureClassPopulationCell ①关键词命中既有格子→绑之复用 ②全新名→按 size 播种专属格子
//     ③幂等 ④无人口模型不抛只固化键 ⑤显式 populationKeys 优先；现生落地点调用 + 导出契约。
'use strict';

const fs = require('fs');
const path = require('path');
const WEB = path.join(__dirname, '..');
require(path.join(WEB, 'tm-engine-constants.js'));
require(path.join(WEB, 'tm-class-engine.js'));
const CE = global.TM.ClassEngine;

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  PASS', msg); }
  else { failed += 1; console.error('  FAIL', msg); }
}
ok(CE && typeof CE.ensureClassPopulationCell === 'function', '导出 ensureClassPopulationCell');

// ── A. 关键词命中 + 既有格子 → 绑既有，不建新、不改 mouths ──
const gmA = { turn: 10, population: { national: { mouths: 1000000 }, byClass: { merchant: { mouths: 50000 } } } };
const clsA = { name: '海商行会', size: '约3%', economicRole: '工商' };
CE.ensureClassPopulationCell(clsA, gmA);
ok(Array.isArray(clsA.populationKeys) && clsA.populationKeys.indexOf('merchant') >= 0, 'A·关键词命中→populationKeys 含 merchant');
ok(gmA.population.byClass.merchant.mouths === 50000 && !gmA.population.byClass.merchant._emergedCell, 'A·复用既有格子·mouths 不改·非新建');
ok(Object.keys(gmA.population.byClass).length === 1, 'A·不建多余格子');

// ── B. 全新名（无关键词、无格子）→ 建专属格子按 size 播种 ──
const gmB = { turn: 12, population: { national: { mouths: 2000000 }, byClass: { peasant_self: { mouths: 1500000 } } } };
const clsB = { name: '矿徒', size: '约2%', economicRole: '其他' };
const kB = CE.ensureClassPopulationCell(clsB, gmB);
ok(clsB.populationKeys && clsB.populationKeys.length > 0, 'B·全新阶层固化 populationKeys (' + (clsB.populationKeys || []).join(',') + ')');
ok(kB && gmB.population.byClass[kB] && gmB.population.byClass[kB].mouths > 0, 'B·建专属格子·mouths>0 (key=' + kB + ' got ' + ((gmB.population.byClass[kB] || {}).mouths) + ')');
ok(gmB.population.byClass[kB]._emergedCell === true, 'B·标记 _emergedCell');
ok(Math.abs(gmB.population.byClass[kB].mouths - 40000) <= 1, 'B·按 size 2%×200万≈40000 (got ' + ((gmB.population.byClass[kB] || {}).mouths) + ')');

// ── C. 幂等（再调不重建、不改 mouths）──
const beforeC = gmB.population.byClass[kB].mouths;
CE.ensureClassPopulationCell(clsB, gmB);
ok(gmB.population.byClass[kB].mouths === beforeC && Object.keys(gmB.population.byClass).length === 2, 'C·幂等·不重建不改 mouths');

// ── D. 无人口模型 → 不抛·只固化键·返回 null ──
const gmD = { turn: 5 };
const clsD = { name: '盐枭', size: '约1%' };
let threwD = false, kD;
try { kD = CE.ensureClassPopulationCell(clsD, gmD); } catch (e) { threwD = true; }
ok(!threwD, 'D·无人口模型不抛');
ok(clsD.populationKeys && clsD.populationKeys.length > 0 && kD === null, 'D·仍固化 populationKeys·返回 null');

// ── E. 显式 populationKeys 优先 → 复用其格子 ──
const gmE = { turn: 5, population: { national: { mouths: 100000 }, byClass: { custom_key: { mouths: 999 } } } };
const clsE = { name: '某新阶层', populationKeys: ['custom_key'], size: '约5%' };
const kE = CE.ensureClassPopulationCell(clsE, gmE);
ok(kE === 'custom_key' && gmE.population.byClass.custom_key.mouths === 999, 'E·显式 populationKeys 优先·复用其格子·mouths 不改');

// ── 源契约：现生落地点调用 + 导出 ──
const applySrc = fs.readFileSync(path.join(WEB, 'tm-endturn-apply.js'), 'utf8');
ok(applySrc.indexOf('TM.SocialFormation.apply(GM, p1') >= 0, '现生阶层经统一登记写口');
const pendingClass = {name:'未核计新阶层',populationKeys:['new_pending'],_populationPending:true,size:'约5%'};
const pendingWorld = {turn:3,population:{national:{mouths:1000},byClass:{old:{mouths:1000}}}};
CE.ensureClassPopulationCell(pendingClass,pendingWorld);
ok(pendingWorld.population.byClass.new_pending.mouths===0, '未核计新阶层不凭估计造人口');
ok(Object.values(pendingWorld.population.byClass).reduce((sum,bucket)=>sum+bucket.mouths,0)===1000, '新分类登记后保持人口守恒');

console.log('\n[smoke-class-emerge-population] ' + (failed ? 'FAIL' : 'PASS') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
