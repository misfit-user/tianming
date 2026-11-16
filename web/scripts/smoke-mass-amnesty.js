#!/usr/bin/env node
// smoke-mass-amnesty.js — 恩诏大赦·群体放归（深挖第七轮G）
// 验：「大赦天下」此前是 EDICT_TYPE 有阈值档却一个囚犯放不出(个体赦免刻意排除"天下"·
//     群体通道全库没有)。补 massAmnesty：全域赦语识别(否定门)→在押尽放归田里(谋逆/通敌/
//     已定罪逆党不赦·不复官)→编年+御案时政。flag massAmnestyEnabled 默认关。
//     个体 pardons 契约不受扰(smoke-edict-pardon 另行回归)。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let N = 0;
function assert(c, m) { N++; if (!c) { console.error('ASSERT FAIL [' + N + ']:', m); process.exit(1); } }

function makeCtx(chars, conf) {
  const ctx = { console: { log(){}, warn(){}, error(){} }, Date, JSON, Math, RegExp, Object, Array, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  ctx.GM = { turn: 10, month: 1, officeTree: [], chars: chars, currentIssues: [] };
  ctx.P = { playerInfo: { characterName: '崇祯', factionName: '明朝廷' }, conf: conf || {} };
  ctx._eb = [];
  ctx.addEB = (cat, txt) => { ctx._eb.push({ cat, txt }); };
  ctx.toast = () => {};
  ctx.findCharByName = (name) => (ctx.GM.chars || []).find(c => c && c.name === name) || null;
  ctx.recordCharacterArc = () => {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-edict.js'), 'utf8'), ctx, { filename: 'tm-endturn-edict.js' });
  return ctx;
}
function jailed(name, reason) { return { name, alive: true, faction: '明朝廷', _imprisoned: true, _imprisonedTurn: 6, _imprisonReason: reason || '直言获罪下狱', officialTitle: null, position: '' }; }

// ── 识别：全域赦语+否定门 ──
var c1 = makeCtx([jailed('卢象升')]);
assert(c1.extractEdictActions('大赦天下，与民更始。').massAmnesty != null, '① 大赦天下→massAmnesty 识别');
assert(c1.extractEdictActions('颁恩诏，恩赦海内。').massAmnesty != null, '② 恩赦海内→识别');
assert(c1.extractEdictActions('值此多事之秋，不得妄言大赦天下。').massAmnesty == null, '③ 否定门(不得妄言)不误执行');
assert(c1.extractEdictActions('岂可大赦天下以纵奸宄。').massAmnesty == null, '④ 否定门(岂可)不误执行');
assert(c1.extractEdictActions('赦免卢象升。').massAmnesty == null, '⑤ 个体点名赦免不触发群体档');
assert(c1.extractEdictActions('大赦天下，与民更始。').pardons.length === 0, '⑥ 旧契约保持：大赦不把"天下"当人(个体 pardons=0)');

// ── 应用：flag 默认关 = 不放人 ──
var c2 = makeCtx([jailed('卢象升'), jailed('孙元化')]);
c2.applyEdictActions(c2.extractEdictActions('大赦天下，与民更始。'));
assert(c2.GM.chars[0]._imprisoned === true && c2.GM.chars[1]._imprisoned === true, '⑦ flag 默认关：识别归识别·不真放人');
assert(c2.GM.currentIssues.length === 0, '⑧ flag 关无时政注入');

// ── 应用：开 flag → 群体放归·重罪不赦 ──
var c3 = makeCtx([
  jailed('卢象升'), jailed('孙元化', '铸炮失利下狱'),
  jailed('崔呈秀', '坐谋逆下诏狱'),
  Object.assign(jailed('王之心'), { _conspiracyConvicted: true }),
  { name: '孙传庭', alive: true, faction: '明朝廷' },
  Object.assign(jailed('故囚'), { alive: false })
], { massAmnestyEnabled: true });
c3.applyEdictActions(c3.extractEdictActions('朕承天命，大赦天下，与民更始。'));
var byName = function (ctx, n) { return ctx.GM.chars.find(function (c) { return c.name === n; }); };
assert(byName(c3, '卢象升')._imprisoned === false && byName(c3, '孙元化')._imprisoned === false, '⑨ 在押普囚尽放归');
assert(byName(c3, '卢象升')._releasedTurn === 10 && byName(c3, '卢象升')._recalledTurn === 10, '⑩ 释放/召回戳齐(校验器不复述关押)');
assert(byName(c3, '卢象升').officialTitle == null || byName(c3, '卢象升').officialTitle === '', '⑪ 放归田里不复官(与个体起复有别)');
assert(byName(c3, '崔呈秀')._imprisoned === true, '⑫ 谋逆(缘由含谋逆)不在赦列');
assert(byName(c3, '王之心')._imprisoned === true, '⑬ 已定罪逆党(_conspiracyConvicted)不赦');
assert(byName(c3, '孙传庭')._imprisoned === undefined, '⑭ 未在押者不受扰');
var iss = c3.GM.currentIssues[0];
assert(iss && /^iss_amnesty_/.test(iss.id) && iss._amnesty === true, '⑮ 御案时政收恩诏昭告');
assert(iss.description.indexOf('卢象升') >= 0 && iss.description.indexOf('2人') >= 0, '⑯ 昭告具名+计数(放归2人)');
assert(iss.description.indexOf('崔呈秀') >= 0 && iss.description.indexOf('不在赦列') >= 0, '⑰ 昭告点明重犯不赦');
assert(c3._eb.some(function (e) { return e.cat === '恩诏'; }), '⑱ 编年入「恩诏」条');
assert(byName(c3, '卢象升').careerHistory.some(function (h) { return h.event.indexOf('大赦') >= 0; }), '⑲ 蒙赦入履历');

// ── 空狱：诚实昭告无可赦之囚 ──
var c4 = makeCtx([{ name: '孙传庭', alive: true }], { massAmnestyEnabled: true });
c4.applyEdictActions(c4.extractEdictActions('大赦天下。'));
assert(c4.GM.currentIssues[0] && c4.GM.currentIssues[0].description.indexOf('无可赦之囚') >= 0, '⑳ 狱空诚实昭告');

// ── 静态契约：设置开关在位 ──

console.log('smoke-mass-amnesty OK — ' + N + ' 断言全绿（识别否定门/群放归/重罪不赦/昭告/flag闸）');
