#!/usr/bin/env node
// smoke-npc-plans-feed.js — NPC 前瞻计划(_npcPlans)接入「朝野动态」图谋前瞻段
//   病灶(修前):recordPlan 写 GM._npcPlans(结党/构陷跨回合谋划)+跨存档持久化·但全库零消费端
//   (marchOrders 同类·算了存了没人看)。修=tm-renwu-tuzhi 朝野动态视图(renderDongtai)加「图谋前瞻」段·
//   读单一真源 TM.NPC.ActionLedger.ensurePlans·只显 active(未竟)计划·复用 _dtVerb/_dtTone 词汇配色。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let n = 0;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); n++; }

const els = {};
function bySel(s){ if(typeof s==='string' && s.charAt(0)==='#') return el(s.slice(1)); return el('__'+s); }
function el(id){ if(!els[id]) els[id] = { id:id, value:'', checked:false, style:{}, innerHTML:'', textContent:'', classList:{add(){},remove(){}}, appendChild(){}, remove(){}, querySelector(s){ return bySel(s); }, querySelectorAll(){ return []; }, scrollTop:0, focus(){} }; return els[id]; }
function byId(id){ return el(id); }

const ctx = {
  console, Math, JSON, RegExp, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, Date: { now: () => 0 },
  setTimeout: (f)=>{ if(typeof f==='function') f(); return 0; }, clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){},
  document: { getElementById: byId, querySelector: bySel, querySelectorAll: () => [], createElement: () => el('__tmp'), body: el('__body'), head: el('__head'), addEventListener(){} },
  window: null,
  GM: { turn: 12, chars: [], characterArcs: {}, culturalWorks: [] },
  P: { playerInfo: { characterName: '皇帝' } },
  findCharByName(n2){ return (ctx.GM.chars||[]).find(c=>c&&c.name===n2)||null; },
  getRankLevel(){ return 9; }, buildIndices(){}, renderOfficeTree(){},
  toast(){}, confirm: () => true
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
// 先载 ledger 模块(TM.NPC.ActionLedger.ensurePlans 单一真源)·再载图志
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-npc-action-ledger.js'), 'utf8'), ctx, { filename: 'tm-npc-action-ledger.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-renwu-tuzhi.js'), 'utf8'), ctx, { filename: 'tm-renwu-tuzhi.js' });

assert(ctx.TM && ctx.TM.NPC && ctx.TM.NPC.ActionLedger, 'ledger 模块加载');

ctx.GM.chars = [
  { name: '皇帝', isPlayer: true, faction: '明朝廷', officialTitle: '皇帝', alive: true, administration: 60 },
  { name: '钱谦益', faction: '东林', officialTitle: '礼部侍郎', administration: 70, alive: true },
  { name: '温体仁', faction: '阉党', officialTitle: '礼部尚书', administration: 65, alive: true },
  { name: '周延儒', faction: '东林', officialTitle: '大学士', administration: 68, alive: true }
];
// 一桩 active 图谋(应显) + 一桩 done(应滤) + 一桩 blocked(应滤)
ctx.GM._npcPlans = [
  { id: 'p1', actor: '钱谦益', type: 'form_clique', target: '温体仁', intent: '联络东林诸君，共抗阉党', stage: 'plotting', status: 'active', createdTurn: 9, updatedTurn: 12, progress: 2 },
  { id: 'p2', actor: '周延儒', type: 'conspire', target: '温体仁', intent: '这条已了结不该再现', stage: 'ready', status: 'done', createdTurn: 5, progress: 5 },
  { id: 'p3', actor: '亡者', type: 'impeach', target: '温体仁', intent: '预检不过的废案', status: 'active', createdTurn: 10, preflight: { ok: false, errors: ['dead_actor'] } }
];

ctx.TMZhi.selectP('钱谦益');
ctx.TMZhi.setView('dongtai');   // 触发 renderDongtai
const main = () => el('tm-zhi-main').innerHTML;
const folio = () => el('tm-zhi-folio').innerHTML;

// ── 图谋前瞻段出现·渲染 active 计划 ──
assert(/图 谋 前 瞻/.test(main()), '① 朝野动态含「图谋前瞻」段');
assert(main().indexOf('钱谦益') >= 0 && main().indexOf('正谋') >= 0, '② 显谋主「钱谦益」+「正谋」前瞻语气');
assert(main().indexOf('结党') >= 0, '③ form_clique→「结党」(复用 _dtVerb 词汇)');
assert(main().indexOf('温体仁') >= 0, '④ 显图谋对象「温体仁」');
assert(main().indexOf('联络东林诸君') >= 0, '⑤ 显谋划内容(intent)');
assert(/已3回合/.test(main()), '⑥ 显谋划历时(now12-created9=3回合)');

// ── 过滤:done/blocked 计划不显(只显未竟 active) ──
assert(main().indexOf('这条已了结不该再现') < 0, '⑦ done 计划已滤(不再现)');
assert(main().indexOf('预检不过的废案') < 0 && main().indexOf('亡者') < 0, '⑧ blocked/preflight-fail 计划已滤');

// ── 折页提要带图谋计数 ──
assert(/图谋在酿/.test(folio()), '⑨ 折页动态提要含图谋计数');

// ── 无 active 计划时不塌(空段返空串) ──
ctx.GM._npcPlans = [];
ctx.TMZhi.setView('dongtai');
assert(main().indexOf('图 谋 前 瞻') < 0, '⑩ 无 active 图谋则前瞻段不显(不塌)');

// ── 静态契约:消费端接线在 ──

console.log('[smoke-npc-plans-feed] pass assertions=' + n);
