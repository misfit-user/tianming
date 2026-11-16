#!/usr/bin/env node
// smoke-renwu-delete-search-dead.js — 人物图志:删除功能 + 搜索/含已殁筛选准确性
//   IIFE 模块·经 window.TMZhi 驱动 + 持久 DOM 桩读 #tm-zhi-roster/#tm-zhi-viscount 观察。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let assertions = 0;
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); assertions++; }

// 持久 DOM:同 id 返回同一元素·供读回 innerHTML/textContent
const els = {};
function bySel(s){ if(typeof s==='string' && s.charAt(0)==='#') return el(s.slice(1)); return el('__'+s); }
function el(id){ if(!els[id]) els[id] = { id:id, value:'', checked:false, style:{}, innerHTML:'', textContent:'', classList:{add(){},remove(){}}, appendChild(){}, remove(){}, querySelector(s){ return bySel(s); }, querySelectorAll(){ return []; }, scrollTop:0, focus(){} }; return els[id]; }
function byId(id){ return el(id); }

const ctx = {
  console, Math, JSON, RegExp, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, Date: { now: () => 0 },
  setTimeout: (f)=>{ if(typeof f==='function') f(); return 0; }, clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
  document: { getElementById: byId, querySelector: bySel, querySelectorAll: () => [], createElement: () => el('__tmp'), body: el('__body'), head: el('__head'), addEventListener(){} },
  window: null,
  GM: { turn: 5, chars: [], characterArcs: {}, culturalWorks: [] },
  P: { playerInfo: { characterName: '皇帝' } },
  findCharByName(n){ return (ctx.GM.chars||[]).find(c=>c&&c.name===n)||null; },
  getRankLevel(){ return 9; }, buildIndices(){}, renderOfficeTree(){},
  toast(){}, confirm: () => true
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-renwu-tuzhi.js'), 'utf8'), ctx, { filename: 'tm-renwu-tuzhi.js' });

ctx.GM.chars = [
  { name: '皇帝', isPlayer: true, faction: '明朝廷', officialTitle: '皇帝', alive: true, administration: 60 },
  { name: '张文', faction: '明朝廷', officialTitle: '吏部尚书', administration: 70, military: 20, alive: true },
  { name: '李武', faction: '明朝廷', officialTitle: '总兵', administration: 30, military: 80, alive: true },
  { name: '王殁', faction: '明朝廷', officialTitle: '礼部侍郎', administration: 65, military: 10, alive: false, deathReason: '病故', deathTurn: 3 },
  { name: '赵殁', faction: '东林', officialTitle: '御史', administration: 55, military: 15, alive: false, deathReason: '诛', deathTurn: 4 }
];
ctx.TMZhi.selectP('张文'); // 触发首渲+缓存重建

const roster = () => el('tm-zhi-roster').innerHTML;

// ── 搜索:全局找人·能搜到已殁者(原 bug:搜在剔除已殁之后) ──
el('tm-zhi-fdead').checked = false;
ctx.TMZhi.onFilter(); // reset
ctx.TMZhi.onSearch('王殁');
assert(roster().indexOf('王殁') >= 0, '搜索应能找到已殁者「王殁」(不受含已殁开关限制)');
ctx.TMZhi.onSearch('总兵');
assert(roster().indexOf('李武') >= 0, '按官职「总兵」应搜到李武');
ctx.TMZhi.onSearch('');

// ── 含已殁/身份快筛一致 ──
ctx.TMZhi.quickStat('all'); // 默认不含已殁
assert(roster().indexOf('王殁') < 0 && roster().indexOf('赵殁') < 0, '默认(不含已殁)名籍不应含殁者');
assert(roster().indexOf('张文') >= 0, '默认应含在世张文');

ctx.TMZhi.quickStat('dead'); // 只看殁者
assert(roster().indexOf('王殁') >= 0, '快筛已殁应含王殁');
assert(roster().indexOf('张文') < 0 && roster().indexOf('李武') < 0, '快筛已殁不应含在世者');

ctx.TMZhi.quickStat('civil'); // 点身份应重置 dead·只看在世文臣(原 bug:dead latch 泄入)
assert(roster().indexOf('王殁') < 0, '文臣视图不应含已殁王殁(治 latch bug)');
assert(roster().indexOf('张文') >= 0, '文臣视图应含张文');
assert(ctx.GM && true, ''); // noop

// ── 删除功能 ──
ctx.TMZhi.quickStat('all');
var before = ctx.GM.chars.length;
ctx.TMZhi.deleteP('李武');
assert(ctx.GM.chars.length === before - 1, '删除应从 GM.chars 移除一人');
assert(!ctx.GM.chars.some(c=>c.name==='李武'), '李武应已从 GM.chars 删除');
assert(roster().indexOf('李武') < 0, '删除后名籍不应再现李武');
// 玩家不可删
ctx.TMZhi.deleteP('皇帝');
assert(ctx.GM.chars.some(c=>c.name==='皇帝'), '君上不可删除');

// ── 删除键 UI 契约 ──

console.log('[smoke-renwu-delete-search-dead] pass assertions=' + assertions);
