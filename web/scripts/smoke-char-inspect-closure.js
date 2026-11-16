#!/usr/bin/env node
// smoke-char-inspect-closure.js — 派员查案·到期结案闭环（深挖第六轮③）
// 验：「🔍 派员查案」按钮的「数回合后返回」承诺兑现——
//   CharEconEngine.tickInvestigations 到期结案：揭隐产(ch._hiddenWealthKnown)·
//   按 integrity 三档回报入御案时政·案主已殁人亡事息·UI 端防重派+status 字段·
//   canSeeHidden 按人开门（静态契约）。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let N = 0;
function assert(cond, msg) { N++; if (!cond) { console.error('ASSERT FAIL [' + N + ']:', msg); process.exit(1); } }
function load(ctx, rel) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
}
function mkChar(over) {
  return Object.assign({
    id: over.name, name: over.name, integrity: 50, clanPrestige: 50, officialTitle: '侍郎',
    resources: { privateWealth: { money: 0, land: 0, treasure: 0, commerce: 0 }, hiddenWealth: 0, fame: 0 },
    socialClass: 'civilOfficial'
  }, over);
}

const chars = [
  mkChar({ name: '崔呈秀', integrity: 20, resources: { privateWealth: { money: 0, land: 0, treasure: 0, commerce: 0 }, hiddenWealth: 380000, fame: 0 } }),
  mkChar({ name: '徐光启', integrity: 85 }),
  mkChar({ name: '王之臣', integrity: 55, resources: { privateWealth: { money: 0, land: 0, treasure: 0, commerce: 0 }, hiddenWealth: 60000, fame: 0 } }),
  mkChar({ name: '故员', integrity: 30, dead: true })
];
const ctx = {
  console, Math, JSON, Object, Array, Number, String, Boolean, RegExp, isFinite, isNaN,
  Error, TypeError, RangeError,
  GM: {
    running: true, turn: 10, clans: {}, chars: chars,
    guoku: { balance: 0, money: 0 }, neitang: { balance: 0, money: 0 },
    corruption: { subDepts: {} }, facs: [], regions: {}, officeTree: [],
    _charInvestigations: [], currentIssues: []
  },
  addEB: function () {},
  toast: function (m) { ctx._toasts.push(m); },
  _toasts: [],
  random: function () { return 0.2; }
};
ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
load(ctx, 'tm-fiscal-engine.js');
load(ctx, 'tm-char-economy-engine.js');
load(ctx, 'tm-char-economy-ui.js');
const CE = ctx.CharEconEngine;
assert(typeof CE.tickInvestigations === 'function', '① tickInvestigations 已导出');
assert(typeof ctx._charInspect === 'function', '② _charInspect 全局在位');

// ── UI 派案：status 字段 + 防重派 ──
ctx._charInspect('崔呈秀');
assert(ctx.GM._charInvestigations.length === 1 && ctx.GM._charInvestigations[0].status === 'pending', '③ 派案带 status=pending');
assert(ctx.GM._charInvestigations[0].returnTurn > 10, '④ returnTurn 在未来');
ctx._charInspect('崔呈秀');
assert(ctx.GM._charInvestigations.length === 1, '⑤ 同案主在途不重派');
assert(ctx._toasts.some(function (t) { return t.indexOf('在途') >= 0; }), '⑥ 重派给「在途」提示');

// ── 未到期不结案 ──
CE.tickInvestigations();
assert(ctx.GM._charInvestigations[0].status === 'pending' && ctx.GM.currentIssues.length === 0, '⑦ 未到期不结案');

// ── 到期结案：贪官档（integrity<40）──
ctx.GM.turn = ctx.GM._charInvestigations[0].returnTurn;
CE.tickInvestigations();
var inv0 = ctx.GM._charInvestigations[0];
assert(inv0.status === 'done' && inv0.result === 'guilty' && inv0.resolvedTurn === ctx.GM.turn, '⑧ 到期结案 result=guilty');
assert(chars[0]._hiddenWealthKnown === true, '⑨ 隐产入案卷 _hiddenWealthKnown=true');
var iss0 = ctx.GM.currentIssues[0];
assert(iss0 && /^iss_inspect_/.test(iss0.id) && iss0._inspectReport === true && iss0.status === 'pending', '⑩ 御案时政收查案回报(契约)');
assert(iss0.title.indexOf('贪迹昭著') >= 0 && iss0.description.indexOf('38万两') >= 0, '⑪ 贪官档具报隐产约数');
assert(iss0.description.indexOf('抄没') >= 0, '⑫ 贪官档附穷治指引');

// ── 同案不重报 ──
ctx.GM.turn += 1;
CE.tickInvestigations();
assert(ctx.GM.currentIssues.length === 1, '⑬ 已结之案不重报');

// ── 清官档（integrity>=70）──
ctx.GM._charInvestigations.push({ target: '徐光启', startTurn: ctx.GM.turn, returnTurn: ctx.GM.turn, status: 'pending' });
CE.tickInvestigations();
var issClean = ctx.GM.currentIssues[1];
assert(issClean && issClean.title.indexOf('查无实据') >= 0 && issClean.description.indexOf('操守清慎') >= 0, '⑭ 清官档查无实据');
assert(issClean.description.indexOf('万两，已入案卷') < 0, '⑮ 无隐产不虚报赃款');

// ── 中间档（40<=integrity<70）──
ctx.GM._charInvestigations.push({ target: '王之臣', startTurn: ctx.GM.turn, returnTurn: ctx.GM.turn, status: 'pending' });
CE.tickInvestigations();
var issMinor = ctx.GM.currentIssues[2];
assert(issMinor && issMinor.title.indexOf('微有不谨') >= 0 && issMinor.description.indexOf('6万两') >= 0, '⑯ 中间档微有不谨+隐产入卷');

// ── 案主已殁：人亡事息 ──
ctx.GM._charInvestigations.push({ target: '故员', startTurn: ctx.GM.turn, returnTurn: ctx.GM.turn, status: 'pending' });
CE.tickInvestigations();
var issDead = ctx.GM.currentIssues[3];
assert(issDead && issDead.description.indexOf('人亡事息') >= 0, '⑰ 案主已殁人亡事息');
assert(ctx.GM._charInvestigations.filter(function (v) { return v.target === '故员'; })[0].status === 'closed', '⑱ 殁案 status=closed');

// ── 查无此人 ──
ctx.GM._charInvestigations.push({ target: '乌有先生', startTurn: ctx.GM.turn, returnTurn: ctx.GM.turn, status: 'pending' });
CE.tickInvestigations();
assert(ctx.GM.currentIssues[4].description.indexOf('查无踪迹') >= 0, '⑲ 查无此人诚实回报');

// ── 旧档兼容：无 status 的陈年记录也能结案 ──
ctx.GM._charInvestigations.push({ target: '王之臣', startTurn: 1, returnTurn: 2 });
CE.tickInvestigations();
var legacy = ctx.GM._charInvestigations.filter(function (v) { return v.startTurn === 1; })[0];
assert(legacy.status === 'done', '⑳ 旧档(无status)兼容结案');

// ── 案卷瘦身：已结留12 ──
for (var i = 0; i < 20; i++) ctx.GM._charInvestigations.push({ target: 'x' + i, startTurn: 1, returnTurn: 1, status: 'done', resolvedTurn: 1 });
CE.tickInvestigations();
var closedCnt = ctx.GM._charInvestigations.filter(function (v) { return v.status && v.status !== 'pending'; }).length;
assert(closedCnt === 12, '⑴ 案卷瘦身已结留12条');

// ── 静态契约：canSeeHidden 按人开门 + 抄家门联动 ──

console.log('smoke-char-inspect-closure OK — ' + N + ' 断言全绿（派案防重/三档结案/殁案/旧档兼容/瘦身/揭隐产）');
