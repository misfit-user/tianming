#!/usr/bin/env node
// smoke-conspiracy-brewing-feed.js — 阴谋引擎「暗流酝酿」接入图志「逆案录」
//   病灶(修前):阴谋引擎(tm-conspiracy.js)每回合确定性推演 _activePlots(密谋值/败露/招募/多回合酝酿)·
//   knownPlots() 已 export 但全库零渲染器·玩家只在逆案录看「事后」下狱伏诛·看不到多回合「山雨欲来」。
//   修=renderNian 上方加「暗流酝酿」段·读 knownPlots(回落 _activePlots.filter(_knownToPlayer))·
//   只显 exposure≥55 已露形者(隐秘阴谋不剧透=天然确定性门)·镜像 _kindCN/_heatCN。
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
  GM: { turn: 6, chars: [], characterArcs: {}, culturalWorks: [] },
  P: { playerInfo: { characterName: '皇帝' } },
  findCharByName(n2){ return (ctx.GM.chars||[]).find(c=>c&&c.name===n2)||null; },
  getRankLevel(){ return 9; }, buildIndices(){}, renderOfficeTree(){},
  toast(){}, confirm: () => true
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-renwu-tuzhi.js'), 'utf8'), ctx, { filename: 'tm-renwu-tuzhi.js' });

ctx.GM.chars = [
  { name: '皇帝', isPlayer: true, faction: '明朝廷', officialTitle: '皇帝', alive: true },
  { name: '魏忠贤', faction: '阉党', officialTitle: '司礼监', alive: true },
  { name: '客氏', faction: '阉党', officialTitle: '奉圣夫人', alive: true },
  { name: '张皇后', faction: '后宫', officialTitle: '皇后', alive: true },
  { name: '崔呈秀', faction: '阉党', officialTitle: '兵部尚书', alive: true }
];
// 已露形阴谋(应显) + 将发阴谋(应显·★) + 隐秘阴谋(_knownToPlayer=false·应滤) + 已了结逆案(_conspiracies·仍显于逆案录)
ctx.GM._activePlots = [
  { ringleader: '魏忠贤', kind: 'coup', target: '皇帝', conspirators: ['崔呈秀'], momentum: 80, stage: 'brewing', exposure: 60, _knownToPlayer: true },
  { ringleader: '客氏', kind: 'palace_coup', target: '张皇后', conspirators: [], momentum: 110, stage: 'ripe', exposure: 90, _knownToPlayer: true },
  { ringleader: '某隐者', kind: 'regicide', target: '皇帝', conspirators: [], momentum: 30, stage: 'brewing', exposure: 20, _knownToPlayer: false }
];
ctx.GM._conspiracies = [
  { turn: 3, instigator: '某逆', action: 'coup_failed', outcome: 'suppressed', conspirators: [] }
];

ctx.TMZhi.selectP('魏忠贤');
ctx.TMZhi.setView('nian');   // 触发 renderNian
const main = () => el('tm-zhi-main').innerHTML;
const folio = () => el('tm-zhi-folio').innerHTML;

// ── 暗流酝酿段出现·渲染已露形阴谋 ──
assert(/暗 流 酝 酿/.test(main()), '① 逆案录含「暗流酝酿」段');
assert(main().indexOf('魏忠贤') >= 0 && main().indexOf('图谋社稷') >= 0, '② 显主谋魏忠贤 + coup→「图谋社稷」');
assert(main().indexOf('皇帝') >= 0, '③ 显指向对象');
assert(/酝酿已深/.test(main()), '④ momentum80→「酝酿已深」热度(≥70)');
assert(main().indexOf('崔呈秀') >= 0, '⑤ 显同谋从党');
assert(main().indexOf('客氏') >= 0 && main().indexOf('宫变') >= 0 && /将发/.test(main()), '⑥ ripe 阴谋:客氏+palace_coup→宫变+将发');

// ── 隐秘阴谋(_knownToPlayer=false)滤除·不剧透 ──
assert(main().indexOf('某隐者') < 0, '⑦ 隐秘阴谋(未露形)已滤·不剧透');

// ── 逆案录(事后史录)仍显 ──
assert(main().indexOf('某逆') >= 0, '⑧ 逆案录事后史录仍并显(某逆)');

// ── 折页提要带酝酿计数 ──
assert(/暗流已露形而未发/.test(folio()), '⑨ 折页逆案提要含暗流计数');

// ── 无已露形阴谋则段不显(不塌) ──
ctx.GM._activePlots = [{ ringleader: '隐君', kind: 'coup', momentum: 20, stage: 'brewing', _knownToPlayer: false }];
ctx.TMZhi.setView('nian');
assert(main().indexOf('暗 流 酝 酿') < 0, '⑩ 无已露形阴谋则暗流段不显(不塌)');

// ── 静态契约 ──

console.log('[smoke-conspiracy-brewing-feed] pass assertions=' + n);
