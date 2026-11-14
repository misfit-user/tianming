#!/usr/bin/env node
'use strict';
// smoke-disaster-scenario-relief — 开仓放粮认得剧本写在区划上的灾（11-14）
//
// 天启剧本把陕西大饥荒写在区划上（division.disaster，重度 95，列了受灾子区划），灾害系统的在册天灾 GM.activeDisasters 是空的。
// 原先开仓只认在册天灾：赈陕西被当「无灾空赈」，民心回升减半、流民不复业，民变判定也读不到「在赈」。
// 现在开仓一并给剧本写的灾记「已赈」与回合；同一回合只算一次，过几回合可再赈；只管玩家一方。vm 载入真 GuokuEngine 实跑。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }

const ctx = { console: { log() {}, warn() {}, error() {} }, Math, JSON, String, Number, Array, Object, RegExp, parseInt, parseFloat, isFinite, isNaN, Date: { now: () => 0 } };
ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
ctx.turnsForMonths = function (m) { return m; };
ctx.addEB = function () {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-minxin-ledger.js'), 'utf8'), ctx, { filename: 'tm-minxin-ledger.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-guoku-engine.js'), 'utf8'), ctx, { filename: 'tm-guoku-engine.js' });
const GE = ctx.GuokuEngine;

function famine() {
  return { active: true, type: '大饥荒', severity: 95, affectedSubDivisions: ['延安府', '庆阳府', '榆林卫'] };
}
function world(turn) {
  ctx.GM = {
    turn: turn, activeDisasters: [], guoku: { balance: 2000000 }, minxin: { trueIndex: 50 },
    population: { byLegalStatus: { taoohu: { mouths: 100000 }, huangji: { mouths: 1000000 } } },
    adminHierarchy: {
      player: { divisions: [
        { id: 'p-sx', name: '陕西布政使司', disaster: famine(), children: [{ id: 'd-ya', name: '延安府', minxin: 50, population: 100000 }, { id: 'd-xa', name: '西安府', minxin: 50, population: 100000 }] },
        { id: 'p-sd', name: '山东布政使司', disaster: { active: false, type: '旱', severity: 40 }, children: [{ id: 'd-jn', name: '济南府', minxin: 50, population: 100000 }] }
      ] },
      laterJin: { divisions: [{ id: 'j-1', name: '辽东', disaster: { active: true, type: '雪灾', severity: 60 } }] }
    }
  };
  return ctx.GM;
}
const sx = () => ctx.GM.adminHierarchy.player.divisions[0].disaster;

console.log('smoke-disaster-scenario-relief');

// ① 只有剧本写的灾：开仓算赈到一处，民心全额，流民复业
let G = world(3);
let before = G.minxin.trueIndex;
let r = GE.Actions.openGranary('regional');
ok(r.success && r.relieved === 1, '① 在册天灾为空、剧本写了陕西大饥荒：开仓算赈到 1 处（原先是 0，被当无灾空赈）');
ok(sx()._relieved === true && sx()._reliefTurn === 3, '① 陕西的灾记下「已赈」与回合');
ok(G.minxin.trueIndex - before === 8, '① 民心全额 +8，不再按空赈减半（实为 +' + (G.minxin.trueIndex - before) + '）');
ok(r.resettled === 60000 && G.population.byLegalStatus.taoohu.mouths === 40000, '① 流亡之民复业 6 万（原先无灾不复业）');
ok(!G.adminHierarchy.player.divisions[1].disaster._relieved, '① 已平息（active:false）的灾不算');
ok(!G.adminHierarchy.laterJin.divisions[0].disaster._relieved, '① 别家势力境内的灾不算');

// ② 同一回合再开一次：不重复算；过几回合可再赈
before = G.minxin.trueIndex;
r = GE.Actions.openGranary('regional');
ok(r.relieved === 0 && G.minxin.trueIndex - before === 4, '② 同一回合再开：不重复算赈，按空赈减半（+' + (G.minxin.trueIndex - before) + '）');
G.turn = 7;
r = GE.Actions.openGranary('regional');
ok(r.relieved === 1 && sx()._reliefTurn === 7, '② 过几回合再赈：照算，回合更新');

// ③ 指定地方：按区划名、受灾子区划认；别处不动
world(5);
r = GE.Actions.openGranary('regional', '延安府');
ok(r.relieved === 1 && sx()._relieved === true, '③ 指定延安府：陕西的灾列了延安府，算赈到');
world(5);
r = GE.Actions.openGranary('regional', '陕西');
ok(r.relieved === 1, '③ 指定「陕西」：按去后缀的省名认');
world(5);
r = GE.Actions.openGranary('regional', '两淮');
ok(r.relieved === 0 && !sx()._relieved, '③ 指定两淮：陕西的灾不动');

// ④ 在册天灾照旧，两样一起算
G = world(2);
G.activeDisasters = [{ category: 'drought', region: '河南', startedTurn: 0, duration: 5 }];
r = GE.Actions.openGranary('national');
ok(r.relieved === 2 && G.activeDisasters[0]._relieved === true && sx()._relieved === true, '④ 国赈：在册天灾与剧本写的灾各算一处');

// ⑤ 帑廪不足：都不记
G = world(2);
G.guoku.balance = 10000;
r = GE.Actions.openGranary('national');
ok(r.success === false && !sx()._relieved, '⑤ 帑廪不足：失败，剧本写的灾也不记已赈');

console.log('\n结果: ' + A + ' 通过 / 0 失败');
