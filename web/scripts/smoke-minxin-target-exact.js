#!/usr/bin/env node
'use strict';
// smoke-minxin-target-exact — 民心账点名到州：点名正好是某一州的编号或名字，只认那一州（11-14）
//
// 民心账按「包含」模糊认地名（双向）。天启各府的编号（div_pref_ming_01_03）含着全省共用的地图编号（ming-01），
// 点一个府会认中全省各府，每府还吃整笔：户籍治理的「军户清查」信号每条点北直隶八府，十一府各吃八倍，
// 第二回合顺天府一回合跌 13（照原意约 1.7）。修后点名对得上某州就只认那一州，对不上任何一州才模糊认。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }

const ctx = { console: { log() {}, warn() {}, error() {} }, Math, JSON, String, Number, Array, Object, RegExp, parseInt, parseFloat, isFinite, isNaN, Date: { now: () => 0 } };
ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-minxin-ledger.js'), 'utf8'), ctx, { filename: 'tm-minxin-ledger.js' });
const ML = ctx.TM.MinxinLedger;

function pref(id, name, map) { return { id: id, name: name, mapRegionId: map, regionId: map, minxin: 50, population: 100000 }; }
function world() {
  return { turn: 3, minxin: { trueIndex: 50, perceivedIndex: 50, byRegion: {}, byClass: {}, sources: {}, revolts: [] },
    adminHierarchy: { player: { divisions: [
      { id: 'p-bz', name: '北直隶', children: [pref('div_pref_ming_01_01', '顺天府', 'ming-01'), pref('div_pref_ming_01_02', '保定府', 'ming-01'), pref('div_pref_ming_01_03', '宣府镇', 'ming-01')] },
      { id: 'p-sx', name: '陕西布政使司', children: [pref('div_pref_ming_11_01', '西安府', 'ming-11')] }
    ] } } };
}
const leafOf = (G, name) => G.adminHierarchy.player.divisions.flatMap((p) => p.children).find((d) => d.name === name);
const near = (a, b) => Math.abs(a - b) < 0.011;

console.log('smoke-minxin-target-exact');
let G = world();
ML.recordAndApply(G, { sourceSystem: 'huji-governance-loop', kind: 'commitment-progress-military_register', deltaTrue: -0.4,
  targetRegions: [{ region: 'div_pref_ming_01_01', weight: 1 }, { region: 'div_pref_ming_01_02', weight: 1 }] });
ok(near(leafOf(G, '顺天府').minxin, 49.8) && near(leafOf(G, '保定府').minxin, 49.8), '点名顺天、保定两府：各吃一半（−0.2），不是各吃整笔（实为 ' + leafOf(G, '顺天府').minxin + '、' + leafOf(G, '保定府').minxin + '）');
ok(leafOf(G, '宣府镇').minxin === 50, '没点名的宣府镇不动（原先编号含 ming-01，被一起扣）');
ok(leafOf(G, '西安府').minxin === 50, '别省不动');

G = world();
ML.recordAndApply(G, { sourceSystem: 'test', kind: 'test', deltaTrue: -0.3, targetRegions: [{ region: '顺天' }] });
ok(near(leafOf(G, '顺天府').minxin, 49.7) && leafOf(G, '保定府').minxin === 50, '点名对不上任何一州（「顺天」）：照旧按包含模糊认到顺天府');

G = world();
ML.recordAndApply(G, { sourceSystem: 'test', kind: 'test', deltaTrue: -0.3, targetRegions: [{ region: 'ming-01' }] });
ok(['顺天府', '保定府', '宣府镇'].every((n) => near(leafOf(G, n).minxin, 49.7)) && leafOf(G, '西安府').minxin === 50, '点名全省共用的地图编号 ming-01：北直隶三府都认，陕西不认');

G = world();
ML.recordAndApply(G, { sourceSystem: 'test', kind: 'test', deltaTrue: -0.3, targetRegions: [{ region: 'div_pref_ming_01_03', exact: true }] });
ok(near(leafOf(G, '宣府镇').minxin, 49.7) && leafOf(G, '顺天府').minxin === 50, '调用方自己标了 exact 的照旧');

console.log('\n结果: ' + A + ' 通过 / 0 失败');
