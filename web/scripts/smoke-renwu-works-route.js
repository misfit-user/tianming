#!/usr/bin/env node
// smoke-renwu-works-route.js — 人物图志「阅其遗著」死按钮修复回归
//   病灶(修前):TMZhi.act('works') 只有 wendui/letter/office/mind 四分支·works 掉入
//   「入口待接」空 toast·而「文事」tab(TABS ['works','文事'])+ tabWorks 渲染器 + adaptWorks
//   数据适配器同文件早已就绪——按钮承诺翻看逝者著述却永不路由。
//   修复=act 加一行 works 分支(state.tab='works';renderMain())·此 smoke 经 window.TMZhi 真驱动验路由。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let assertions = 0;
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); assertions++; }

// 持久 DOM 桩(同 smoke-renwu-delete-search-dead):同 id 返回同一元素·供读回 innerHTML
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
  { name: '王殁', faction: '明朝廷', officialTitle: '礼部侍郎', administration: 65, military: 10, alive: false, deathReason: '殉国', deathTurn: 3 },
  { name: '李素', faction: '明朝廷', officialTitle: '主事', administration: 40, military: 10, alive: false, deathReason: '病故', deathTurn: 4 }
];
// 逝者「王殁」有一篇传世著述·「李素」无著述
ctx.GM.culturalWorks = [
  { author: '王殁', title: '甲申殉国录', genre: '纪', turn: 2, quality: 8, mood: '悲慨', isPreserved: true }
];

const main = () => el('tm-zhi-main').innerHTML;

// ── 选中逝者「王殁」·默认 tab=overview ──
ctx.TMZhi.selectP('王殁');
assert(main().indexOf('王殁') >= 0, '① selectP 后主面板渲染出「王殁」档案');
assert(main().indexOf('著 述 文 事') < 0, '② 默认(overview) tab 不显文事段(证下步是路由所致)');

// ── 核心:act('works') 应路由到文事 tab·渲出逝者著述(修前掉入空 toast·tab 不变) ──
ctx.TMZhi.act('works');
assert(main().indexOf('著 述 文 事') >= 0, '③ act(\'works\') 路由到文事 tab(修前空 toast·此段永不出现)');
assert(main().indexOf('甲申殉国录') >= 0, '④ 文事 tab 渲出逝者遗著《甲申殉国录》');
assert(main().indexOf('★') >= 0, '⑤ 传世遗著标★(isPreserved)');

// ── 无著述者:act('works') 路由后诚实空态·非报错/非空 toast ──
ctx.TMZhi.selectP('李素');
ctx.TMZhi.act('works');
assert(main().indexOf('此人未有著述传世') >= 0, '⑥ 无遗著者路由到文事 tab 显诚实空态');

// ── 静态契约守卫:三处消费端俱在(按钮路由 + tab 定义 + 分派) ──

console.log('[smoke-renwu-works-route] pass assertions=' + assertions);
