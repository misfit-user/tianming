#!/usr/bin/env node
'use strict';
/* smoke-reported-spread — 失真层S3b-S7铺面契约：
 * S3b 舆图(mood民心good/office浊度bad/owner-tip同键)+纲纪满意度三处同键·
 * S4 顶栏户口national.*全bad+方志户口志hover收严/役政志翻转·
 * S5 军额soldiers据奏(military分部门+统帅handler)·
 * S6 揭真三通道(核饷hexiang/查案audit/密报mishu)·
 * S7 奏疏AI据奏口径(税压bad/危机省据奏过滤/口径指令)。 */
const fs = require('fs'), path = require('path');
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-reported-spread');

// ── S3b 舆图 ──
// 签注（tip）在通志一期 S3 迁入 phase8-formal-map-dossier.js
// ── S3b 纲纪 ──

// ── S5 军额 ──

// ── 行为抽验：军额 handler 点因子端到端(引擎真跑) ──
global.window = global;
global.GM = { sid: 's', turn: 3, corruption: { trueIndex: 50, subDepts: { military: { true: 80 } } } };
global.P = { conf: { gameMode: 'strict_hist', reportedViewEnabled: true } };
const RV = require('../tm-reported-view.js');
const loyal = RV.value('army', 'soldiers.京营', 60000, { direction: 'good', dept: 'military', handler: { loyalty: 90 } });
const traitor = RV.value('army', 'soldiers.京营', 60000, { direction: 'good', dept: 'military', handler: { loyalty: 20 } });
ok(loyal.shown >= 60000 && traitor.shown > loyal.shown, '行为① 名员虚增·离心将领吃饷狠于直臣(' + loyal.shown + '<' + traitor.shown + ')');
RV.reveal('army', 'soldiers.京营', 'hexiang');
ok(RV.value('army', 'soldiers.京营', 60000, { direction: 'good', dept: 'military' }).shown === 60000, '行为② 核饷揭后显实额');

console.log('\nsmoke-reported-spread ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
