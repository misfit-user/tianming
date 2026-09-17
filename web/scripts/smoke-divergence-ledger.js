#!/usr/bin/env node
'use strict';
// smoke-divergence-ledger — 刀D·「史实注定死」降级为「史实锚点」+ 分歧账 V1（端到端）
//   机制：史实知识转存 GM.histAnchors(认知背景·不杀人)·_tcAppendDivergence 把「史载已故而本局
//   仍在世」的分歧喂给 AI 时空约束(读锚点·文案中立·以本局为准)。
//   —— 单元(helper 直测) ——
//   ① 魏在世+turn≥3 → 分歧条目出现且含「以本局为准」   ② 魏已死 → 不出该条目
//   ③ 无 histAnchors 老剧本 → 零条目零报错             ④ clauseOnly → 无逐条名单·压成一句(计数中立)
//   ⑤ 官方剧本真源 JSON：rigidHistoryEvents 空 + rh_/罢魏链 无残留 + histAnchors 字段齐(id/histDate/fate)
//   —— 端到端 ——
//   ⑥ 真跑 tm-patches-start.js 的 GM.histAnchors 装载块(合成 sc→GM 断言锚点入册·无键→空)
//   ⑦ 真跑 tm-ai-infra.js 的 _buildTemporalConstraint(full/clause 两接线)·断言分歧段真出现在约束文本
//   ⑧ index.html 三 <script> 标签存在性(tm-patches-start/tm-history-events/tm-ai-infra)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');           // web/
const REPO = path.resolve(ROOT, '..');                // 仓根
let A = 0;
function ok(c, m) { if (!c) throw new Error('assert failed -> ' + m); A++; console.log('  ✓ ' + m); }
function sliceFn(src, marker) {
  const a = src.indexOf(marker); if (a < 0) return null;
  let i = src.indexOf('{', a), d = 0, j = i;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return src.slice(a, j);
}

console.log('smoke-divergence-ledger');

const hist = fs.readFileSync(path.join(ROOT, 'tm-history-events.js'), 'utf8');
const infra = (fs.readFileSync(path.join(ROOT, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8'));
const patches = fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8');

// —— 抽取 _tcAppendDivergence 本体(安家于 tm-history-events.js·史实域) ——
const divSrc = sliceFn(hist, 'function _tcAppendDivergence');
ok(!!divSrc, '_tcAppendDivergence 抽取成功');

// 隔离跑：findCharByName/_rigidFindChar 缺位(typeof 守卫)→回落 GM.chars 线性查·vm 无害
function runDiv(gm, clauseOnly) {
  const lines = [];
  const ctx = { GM: gm };
  vm.createContext(ctx);
  vm.runInContext(divSrc + '\nthis.f = _tcAppendDivergence;', ctx);
  ctx.f(lines, !!clauseOnly);
  return lines;
}

const weiAnchor = { id: 'ha_weizhongxian', name: '魏忠贤', histTurn: 3, histDate: '天启七年十一月', fate: '自缢身亡', kind: 'death' };
const keAnchor  = { id: 'ha_keshi', name: '客氏', histTurn: 4, histDate: '天启七年十一月', fate: '杖毙', kind: 'death' };
const WEI = '魏忠贤';
const YIBEN = '以本局为准';

// ① 魏在世 + turn≥3 → 出条目·含「以本局为准」
var g1 = { turn: 5, histAnchors: [weiAnchor, keAnchor], chars: [{ name: WEI, alive: true }, { name: '客氏', alive: false, dead: true }] };
var L1 = runDiv(g1, false);
ok(L1.some(function (l) { return l.indexOf(WEI) >= 0 && l.indexOf(YIBEN) >= 0; }), '① 魏在世+turn≥3 → 分歧条目出现且含「以本局为准」');
ok(L1.every(function (l) { return l.indexOf('客氏') < 0; }), '① 客氏已死 → 不出其条目(与史实同向)');

// ② 魏已死 → 不出该条目
var g2 = { turn: 5, histAnchors: [weiAnchor], chars: [{ name: WEI, alive: false, dead: true }] };
ok(runDiv(g2, false).every(function (l) { return l.indexOf(WEI) < 0; }), '② 魏已死 → 不出该分歧条目');

// ②b 未到史实原线之回合(turn<histTurn)
ok(runDiv({ turn: 2, histAnchors: [weiAnchor], chars: [{ name: WEI, alive: true }] }, false).length === 0, '②b turn<histTurn → 零条目');
// ②c 查无此人
ok(runDiv({ turn: 5, histAnchors: [weiAnchor], chars: [{ name: '张三', alive: true }] }, false).length === 0, '②c 查无此人 → 零条目');

// ③ 无 histAnchors / histAnchors=[] → 零条目零报错
var okNoThrow = true, L3 = [];
try { L3 = runDiv({ turn: 9, chars: [{ name: WEI, alive: true }] }, false); } catch (e) { okNoThrow = false; }
ok(okNoThrow && L3.length === 0, '③ 无 histAnchors 老剧本 → 零条目零报错');
var okEmpty = true, L3b = [];
try { L3b = runDiv({ turn: 9, histAnchors: [], chars: [] }, false); } catch (e) { okEmpty = false; }
ok(okEmpty && L3b.length === 0, '③b histAnchors=[] → 零条目零报错');

// ④ clauseOnly → 无逐条名单·压成一句·计数中立(单条不出「多名」)
var L4 = runDiv(g1, true);
ok(L4.length === 1, '④ clauseOnly → 只一条(压成一句总纲)');
ok(L4[0].indexOf('· ' + WEI) < 0, '④ clauseOnly → 无逐条姓名名单段(不含「· 魏忠贤」)');
ok(L4[0].indexOf('以本局 GM') >= 0, '④ clauseOnly 总纲仍归「以本局为准/GM」');
// ④b 单条分歧 → 计数中立文案不含「多名」·且报「1 名」
var L4single = runDiv({ turn: 5, histAnchors: [weiAnchor], chars: [{ name: WEI, alive: true }] }, true);
ok(L4single.length === 1 && L4single[0].indexOf('多名') < 0 && L4single[0].indexOf('1 名') >= 0, '④b 单条分歧 → 计数中立(「1 名」·无「多名」失真)');
// ④c cap 8
var many = [], chMany = [];
for (var k = 0; k < 10; k++) { var nm = 'N' + k; many.push({ id: 'a' + k, name: nm, histTurn: 1, histDate: 'X', fate: 'Y', kind: 'death' }); chMany.push({ name: nm, alive: true }); }
ok(runDiv({ turn: 9, histAnchors: many, chars: chMany }, false).length === 1 + 8, '④c cap 8 → 表头 + 最多 8 条');

// ⑤ 官方剧本真源 JSON：注定死 + 罢魏链全无·histAnchors 字段齐
var scRaw = fs.readFileSync(path.join(REPO, 'scenarios', '天启七年·九月（官方）.json'), 'utf8');
var sc = JSON.parse(scRaw);
ok(Array.isArray(sc.rigidHistoryEvents) && sc.rigidHistoryEvents.length === 0, '⑤ 真源 JSON：rigidHistoryEvents 已为空数组');
ok(scRaw.indexOf('rh_weiSuicide') < 0 && scRaw.indexOf('rh_keshiDie') < 0, '⑤ 真源 JSON：rh_weiSuicide / rh_keshiDie 无残留');
ok(scRaw.indexOf('第一环·罢魏') < 0 && scRaw.indexOf('第二环·自缢阜城') < 0, '⑤ 真源 JSON：罢魏→自缢阜城 拉回链两环无残留');
ok(scRaw.indexOf('evt_mp9rsc3kfx6uu') < 0 && scRaw.indexOf('evt_mp9rsc3kpmtyx') < 0, '⑤ 真源 JSON：两环 id 无残留');
ok(Array.isArray(sc.histAnchors) && sc.histAnchors.length === 2, '⑤ 真源 JSON：histAnchors 存在且为 2 条');
ok(sc.histAnchors.every(function (a) { return a && a.kind === 'death' && a.name && a.id && a.histDate && a.fate && typeof a.histTurn === 'number'; }), '⑤ histAnchors 字段齐(id/name/histTurn/histDate/fate/kind)');

// ⑥ e2e·真跑 tm-patches-start.js 的 GM.histAnchors 装载块(合成 sc→GM)
var loaderLine = (patches.match(/GM\.histAnchors\s*=[^\n]*;/) || [])[0];
ok(!!loaderLine, '⑥ tm-patches-start.js 存在 GM.histAnchors 装载语句');
function runLoader(scObj) {
  var ctx = { GM: {}, sc: scObj, deepClone: function (x) { return JSON.parse(JSON.stringify(x)); }, Array: Array };
  vm.createContext(ctx);
  vm.runInContext(loaderLine, ctx);
  return ctx.GM.histAnchors;
}
var loaded = runLoader({ histAnchors: [weiAnchor, keAnchor] });
ok(Array.isArray(loaded) && loaded.length === 2 && loaded[0].id === 'ha_weizhongxian', '⑥ 装载块：sc.histAnchors → GM.histAnchors 单剧本副本(2 条入册)');
ok(loaded[0] !== weiAnchor, '⑥ 装载块：deepClone 副本(非引用原剧本对象)');
ok(Array.isArray(runLoader({})) && runLoader({}).length === 0, '⑥ 装载块：无 histAnchors 键剧本 → 空数组(工坊老剧本无害)');

// ⑦ e2e·真跑 tm-ai-infra.js 的 _buildTemporalConstraint(full/clause 两接线均经守卫调 _tcAppendDivergence)
var infraBlock = infra.slice(infra.indexOf('function _buildTemporalConstraint'), infra.indexOf('/** 时空约束·从议题'));
ok(infraBlock.indexOf('_tcAppendDivergence(lines, true)') >= 0 && infraBlock.indexOf('_tcAppendDivergence(lines, false)') >= 0, '⑦ _buildTemporalConstraint 内 full/clause 两接线均调 _tcAppendDivergence');
function buildConstraint(gm, opts) {
  var ctx = {
    GM: gm, P: { time: { year: 1627 } },
    getTSText: function () { return 'T' + (gm.turn || 1); }
  };
  vm.createContext(ctx);
  // 先注入分歧账本体(tm-history-events.js)·再注入约束族(tm-ai-infra.js)·模拟运行时全局互见
  vm.runInContext(divSrc + '\n' + infraBlock + '\nthis.build = _buildTemporalConstraint;', ctx);
  return ctx.build(null, opts);
}
var gmE2E = { turn: 5, year: 1627, histAnchors: [weiAnchor, keAnchor], chars: [{ name: WEI, alive: true, title: '司礼监秉笔' }, { name: '客氏', alive: false, dead: true }] };
var full = buildConstraint(gmE2E, { clauseOnly: false });
ok(full.indexOf('本局与史实的已知分歧') >= 0, '⑦ full 约束文本含分歧账表头(接线真出条目)');
ok(full.indexOf(WEI) >= 0 && full.indexOf(YIBEN) >= 0, '⑦ full 约束文本含魏忠贤分歧行「以本局为准」');
var clause = buildConstraint(gmE2E, { clauseOnly: true, mentionedNames: [] });
ok(clause.indexOf('本局已偏离史实原线') >= 0, '⑦ clause 约束文本含分歧总纲一句');
ok(clause.indexOf('· ' + WEI) < 0, '⑦ clause 约束文本无逐条姓名名单');

// ⑧ index.html <script> 标签存在性(删标签即红)
var indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
['tm-patches-start.js', 'tm-history-events.js', 'tm-ai-infra-retry.js', 'tm-ai-infra.js'].forEach(function (f) {
  ok(new RegExp('<script src="' + f.replace(/\./g, '\\.') + '\\?v=').test(indexHtml), '⑧ index.html 装载 <script> ' + f);
});

console.log('\n结果: ' + A + ' 通过 / 0 失败');
