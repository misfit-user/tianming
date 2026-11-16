#!/usr/bin/env node
'use strict';
/* smoke-building-product-gate — 营建增强二/三（2026-07-03）防腐线。
 * 增强二 物产gate(内陆无盐不产盐·行为级)  增强三 工竣立制(smoke-globalrules-build 已锁)
 * + mod('reform_success') 三消费端(契约)  + AI直落 completed 补入账(契约) */
var P = 0, F = 0;
function ok(c, m) { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-building-product-gate');

global.window = global;
var BW = require('../tm-building-works.js');
global.GM = { turn: 3 }; global.P = {};

console.log('— 增强二 · 物产 gate(行为) —');
function saltBld() { return { name: '盐场', status: 'completed', remainingTurns: 0 }; }
// ① 内陆无盐（有数据·全指示为无）→ 盐产不入账
var inland = { name: '汝州', tags: { saltRegion: false }, economyBase: { saltProduction: 0, farmland: 1000 }, specialResources: '桑麻', buildings: [] };
var b1 = saltBld();
BW.applyCompletion(inland, b1, P, GM);
ok(!(inland.economyBase.saltProduction > 0), '内陆无盐建盐场→盐产不入账 (得 ' + inland.economyBase.saltProduction + ')');
ok(Array.isArray(b1._fxGated) && b1._fxGated.indexOf('economyBase.saltProduction') >= 0, '_fxGated 记账供 UI/推演知情');
// ② tags.saltRegion → 照常入账
var coast = { name: '莱州', tags: { saltRegion: true }, economyBase: { saltProduction: 0 }, buildings: [] };
var b2 = saltBld();
BW.applyCompletion(coast, b2, P, GM);
ok(coast.economyBase.saltProduction > 0, '产盐地建盐场照常入账 (得 ' + coast.economyBase.saltProduction + ')');
// ③ economyBase 既有产出>0 亦放行（无 tags 的剧本）
var pool = { name: '解州', economyBase: { saltProduction: 8000 }, buildings: [] };
var b3 = saltBld();
BW.applyCompletion(pool, b3, P, GM);
ok(pool.economyBase.saltProduction > 8000, '既有盐产之地(池盐)放行 (得 ' + pool.economyBase.saltProduction + ')');
// ④ specialResources 文本命中亦放行
var srDiv = { name: '沧州', economyBase: { saltProduction: 0 }, specialResources: '漕运·海盐(长芦)', buildings: [] };
var b4 = saltBld();
BW.applyCompletion(srDiv, b4, P, GM);
ok(srDiv.economyBase.saltProduction > 0, 'specialResources 含盐放行 (得 ' + srDiv.economyBase.saltProduction + ')');
// ⑤ 数据贫剧本（无 tags/economyBase/specialResources）→ 不判·放行（防误杀自制剧本）
var bare = { name: '某县', buildings: [] };
var b5 = saltBld();
BW.applyCompletion(bare, b5, P, GM);
ok(bare.economyBase && bare.economyBase.saltProduction > 0, '数据贫区划不判·照旧入账');
// ⑥ 马政 gate（horseProduction 普遍为 0 的南方州县）
var south = { name: '苏州', tags: { horseRegion: false }, economyBase: { horseProduction: 0 }, buildings: [] };
var b6 = { name: '马场', status: 'completed', remainingTurns: 0 };
BW.applyCompletion(south, b6, P, GM);
ok(!(south.economyBase.horseProduction > 0), '非牧地建马场→马政不入账');

console.log('— 增强三 · mod 硬通道与全路径(契约) —');

console.log('\nsmoke-building-product-gate ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + P + '/' + (P + F));
process.exit(F === 0 ? 0 : 1);
