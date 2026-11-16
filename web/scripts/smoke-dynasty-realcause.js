#!/usr/bin/env node
// smoke-dynasty-realcause.js — D2 真亡因（深挖第七轮A）
// 验：民变改朝 dynasty_change 信号带真亡因(region/level/levelName/leader·
//     tm-authority-complete 写)→ _consumeDynastyEndSignal 消费端据实成文
//     (不再写死套话)+透传字段 → 太史公 prompt 组装带亡省/举义者/乱级(_fgDetail)。
//     旧档无字段信号回落通稿不塌。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let N = 0;
function assert(c, m) { N++; if (!c) { console.error('ASSERT FAIL [' + N + ']:', m); process.exit(1); } }

const ctx = { console: console, Date: Date, JSON: JSON, Math: Math, String: String, Number: Number, Array: Array, Object: Object, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite };
ctx.window = ctx; ctx.globalThis = ctx; ctx.global = ctx;
ctx.localStorage = { getItem: function(){return null;}, setItem: function(){}, removeItem: function(){} };
ctx.SettlementPipeline = { register: function () {} };
ctx.addEB = function () {};
ctx.getTSText = function () { return ''; };
ctx.escHtml = function (s) { return String(s == null ? '' : s); };
ctx.findCharByName = function () { return null; };
ctx.GM = { running: true, turn: 30, chars: [], cities: [], vars: {}, deptTasks: [], currentIssues: [] };
ctx.P = { conf: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-helpers.js'), 'utf8'), ctx, { filename: 'tm-endturn-helpers.js' });
assert(typeof ctx._consumeDynastyEndSignal === 'function', '① _consumeDynastyEndSignal 在位');

// ── 新信号(带真亡因)→ 据实成文+透传 ──
ctx.GM._gameOver = { type: 'dynasty_change', revolt: 'r1', turn: 30, region: '陕西', level: 5, levelName: '改朝', leader: '王嘉胤' };
var r = ctx._consumeDynastyEndSignal();
assert(r && r._dynastyEnd === true && r._signal === 'dynasty_change', '② 消费返回终局对象');
assert(r.description.indexOf('陕西') >= 0, '③ 败因文案带亡省(事起陕西)');
assert(r.description.indexOf('王嘉胤') >= 0, '④ 败因文案带举义者具名');
assert(r.region === '陕西' && r.levelName === '改朝' && r.leader === '王嘉胤', '⑤ 真亡因字段透传(供太史公)');

// ── 旧档信号(无字段)回落通稿不塌 ──
ctx.GM._gameOver = { type: 'dynasty_change', revolt: 'r2', turn: 30 };
var r2 = ctx._consumeDynastyEndSignal();
assert(r2 && r2.description.indexOf('义军') >= 0 && r2.description.indexOf('问鼎中原') >= 0, '⑥ 旧信号回落通稿');
assert(r2.region === '' && r2.leader === '', '⑦ 旧信号字段为空不 undefined');

// ── 消费即标 _shown 防重 ──
var r3 = ctx._consumeDynastyEndSignal();
assert(r3 === null, '⑧ 已消费信号不重弹');

// ── 静态契约：信号写入端带真亡因 + 太史公 _fgDetail 组装 ──

console.log('smoke-dynasty-realcause OK — ' + N + ' 断言全绿（真亡因入信号/文案/太史公·旧档回落）');
