#!/usr/bin/env node
'use strict';
// smoke-huangwei-writeport-collection — 皇威/皇权直写收口回归(2026-07-04)
//   背景:adjustHuangwei/adjustHuangquan 写口(按源封顶+sources/drains台账+phase迁移)早已存在·
//   但 corruption/guoku/neitang/keju-runtime/tinyi/event-bus/office-reform/prophecy 主路一直直写绕账。
//   本 smoke 三验:①源契约=各户主路已接口(直写只剩「沙箱回退」else支) ②真跑=公开API走口后台账真记账
//   ③封顶=同源反复加分被 SOURCE_CAP 拦住(收口的全部意义)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

console.log('smoke-huangwei-writeport-collection');

// ── ① 源契约:主路已接口 ──
const PORT_RE = /AuthorityEngines\s*&&\s*(?:global\.)?AuthorityEngines\.adjustHuang(wei|quan)|AuthorityEngines\s*!==\s*'undefined'\s*&&\s*AuthorityEngines\.adjustHuang(wei|quan)/;
[
  ['tm-corruption-engine.js', 2],  // 11-09 删掷骰反噬，连带其中四处走口；剩逐月侵蚀中枢、圣德两处
  ['tm-guoku-engine.js', 8],
  ['tm-neitang-engine.js', 7],
  ['tm-event-bus.js', 2],
].forEach(([f, minPorts]) => {
  const src = read(f);
  const n = (src.match(/adjustHuang(wei|quan)\(/g) || []).length;
  ok(n >= minPorts, f + ' 走口调用 ≥' + minPorts + '(实际 ' + n + ')');
});
ok(/adjustHuangwei\('memorialObjection'/.test(read('tm-office-reform.js')), 'office-reform 改制代价走口');
ok(/adjustHuangwei\('courtScandal', -8/.test(read('tm-prophecy.js')), 'prophecy 顶撞受挫走口');
ok(/adjustHuangwei\(delta > 0 \? 'culturalAchievement'/.test(read('tm-keju-runtime.js')), 'keju-runtime 帮手接真引擎(注释终于名副其实)');
ok(/adjustHuangwei\('privateDecision', 1/.test(read('tm-tinyi-v3.js')), 'tinyi 私决御前走口');

// ── ② 真跑:neitang 公开 API 走口·台账真记账 ──
const ctx = { console: console, Math: Math, JSON: JSON, Date: Date, setTimeout: function(){}, localStorage: { getItem: function(){return null;}, setItem: function(){} } };
ctx.global = ctx; ctx.globalThis = ctx; ctx.window = ctx; // window 自引用——裸 {} mock 会把 IIFE 全局绑定劫走(smoke-h-school 之鉴)
vm.createContext(ctx);
ctx.GM = {
  turn: 10, sid: 'test',
  huangwei: null, huangquan: null, minxin: null,
  neitang: null, guoku: null,
};
vm.runInContext(read('tm-authority-engines.js'), ctx, { filename: 'tm-authority-engines.js' });
vm.runInContext(read('tm-neitang-engine.js'), ctx, { filename: 'tm-neitang-engine.js' });
ok(ctx.AuthorityEngines && typeof ctx.AuthorityEngines.adjustHuangwei === 'function', '沙箱:写口就绪');
ok(ctx.NeitangEngine && ctx.NeitangEngine.Actions && typeof ctx.NeitangEngine.Actions.holdCeremony === 'function', '沙箱:NeitangEngine.Actions 就绪');

// 初始化皇威结构(引擎自建)
ctx.AuthorityEngines.adjustHuangwei('grandCeremony', 0.0001, 'warmup'); // 触发 _ensureHuangwei
const hw0 = ctx.GM.huangwei;
ok(hw0 && typeof hw0.index === 'number' && hw0.sources && hw0.drains, '皇威结构由引擎自建(index+sources+drains)');
const idx0 = hw0.index;

ctx.GM.neitang = null; // 让引擎自建
vm.runInContext("NeitangEngine.Actions.holdCeremony('middle')", ctx); // 大典 +8 → grandCeremony
ok(ctx.GM.huangwei.index > idx0, '大典走口:index 上升(' + idx0.toFixed(2) + '→' + ctx.GM.huangwei.index.toFixed(2) + ')');
ok((ctx.GM.huangwei.sources.grandCeremony || 0) >= 8, '大典走口:sources.grandCeremony 台账记到 ' + ctx.GM.huangwei.sources.grandCeremony.toFixed(2));

// ── ③ 封顶:同源刷分被 SOURCE_CAP(grandCeremony=10) 拦死 ──
// 每轮补足内帑·排除「钱不够办不成大典」的假封顶·让 10 连大典真踩源闸
for (var i = 0; i < 10; i++) {
  vm.runInContext("GM.neitang.balance = 10000000; NeitangEngine.Actions.holdCeremony('middle')", ctx);
}
ok(Math.abs(ctx.GM.huangwei.sources.grandCeremony - 10) < 1e-9, '同源刷大典:累计精确封顶 10(实际 ' + ctx.GM.huangwei.sources.grandCeremony.toFixed(2) + ')——直写时代无此闸');

console.log('[smoke-huangwei-writeport-collection] PASS ' + A + ' assertions');
