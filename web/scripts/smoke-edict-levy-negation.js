#!/usr/bin/env node
'use strict';
// 加派诏令否定门（2026-10-13）
//   案：玩家「取消三饷」「不要向农民加派辽饷」在 1.3.5.3 被执行成加派五成（民心先掉七点，贪腐涨）。
//   根治：否定/废止词表补齐 + 按句判 + 没写成数不猜。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'tm-endturn-edict.js'), 'utf8');
function sliceFn(marker) {
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('missing ' + marker);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) { if (src[i] === '{') depth++; else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1); }
  throw new Error('unterminated ' + marker);
}
const ctx = { GM: { turn: 3 }, console };
vm.createContext(ctx);
vm.runInContext(sliceFn('function extractEdictFiscalActions('), ctx, { filename: 'tm-endturn-edict-slice.js' });

let pass = 0, fail = 0;
function ok(condition, message) {
  if (condition) { pass++; console.log('  PASS - ' + message); }
  else { fail++; console.error('  FAIL - ' + message); }
}
function levy(text) { return ctx.extractEdictFiscalActions(text).filter(a => a.type === 'extraTax'); }

console.log('[smoke-edict-levy-negation]');

const playerText = '朕有旨：取消三饷，不要向农民加派辽饷，清查隐田，限制士绅优免，宗室禄米减半。';
ok(levy(playerText).length === 0, '玩家原文「取消三饷…不要向农民加派辽饷」不再被当成加派');
[
  '取消三饷', '废除辽饷', '撤销剿饷加派', '革除练饷', '全国停征辽饷', '蠲免辽饷', '罢三饷', '停加派',
  '不得加派辽饷', '不许再加派三饷', '严禁地方加派练饷', '勿再加征剿饷', '永不加派', '辽饷永不复征',
  '辽饷一概蠲免', '三饷尽罢', '免去各省加派', '不要加征辽饷'
].forEach(text => ok(levy(text).length === 0, '否定句不算加派：' + text));

const positive = levy('为筹边饷，全国加派辽饷三成');
ok(positive.length === 1 && positive[0].tier === 0.3 && /30%/.test(positive[0].raw), '「全国加派辽饷三成」识别为加派三成');
const unspecified = levy('加派辽饷以济军需');
ok(unspecified.length === 1 && unspecified[0].tier === null && /未写明成数/.test(unspecified[0].raw),
  '没写成数不再按五成猜，tier 留空让户部回奏');
const mixed = levy('蠲免陕西辽饷；加派江南剿饷二成');
ok(mixed.length === 1 && mixed[0].tier === 0.2 && /剿饷/.test(mixed[0].clause), '按句判：前一句蠲免不抵消后一句明写的加派');
const mixed2 = levy('陕西免征三饷。其余各省加派练饷一成。');
ok(mixed2.length === 1 && mixed2[0].tier === 0.1, '按句判：免征句与加派句各算各的');
ok(levy('不得加派辽饷；蠲免剿饷').length === 0, '两句都是否定则不加派');
const full = levy('辽饷尽数加派');
ok(full.length === 1 && full[0].tier === 1, '「尽数加派」=十成');
ok(levy('拨辽饷二十万两解宁远').length === 0, '开支拨付不算加派');

// 2026-10-17 复审（Astra 6）：否定词与动作隔得远、成数从别的子句借来、成数的各种写法
ok(levy('不得向全国所有灾民和贫苦农户加派辽饷二成').length === 0, '长否定：「不得……加派辽饷二成」不算加派（原来隔了 12 个字就被执行成加派两成）');
ok(levy('严禁各府州县以修城为名向小民加派剿饷').length === 0, '长否定：「严禁……加派剿饷」不算加派');
const borrowed = levy('加派辽饷，田赋减至三成');
ok(borrowed.length === 1 && borrowed[0].tier === null, '成数不从别的税种子句借：「加派辽饷，田赋减至三成」里辽饷没写成数');
const trailing = levy('加派辽饷，以二成为度');
ok(trailing.length === 1 && trailing[0].tier === 0.2, '紧跟着只补成数的子句仍算本次加派');
ok(levy('为禁军加派辽饷一成').length === 1, '「禁军」里的「禁」不当否定词');
ok(levy('严禁军士向百姓加派剿饷').length === 0 && levy('严禁地方加派练饷').length === 0, '「严禁军士」「严禁地方」仍是否定');
const eleven = levy('加派辽饷十一成');
ok(eleven.length === 1 && eleven[0].tier === null, '「十一成」超过十成，不再读成一成，留空请明示');
const digits = levy('加派辽饷2成');
ok(digits.length === 1 && digits[0].tier === 0.2, '阿拉伯数字「2成」读作两成');
const pct = levy('加派辽饷百分之二十');
ok(pct.length === 1 && pct[0].tier === 0.2, '「百分之二十」读作两成');
const pct2 = levy('加派剿饷15%');
ok(pct2.length === 1 && pct2[0].tier === 0.15, '「15%」读作一成半');

// 2026-10-17 二次复审（Astra 6）：否定按「命令层」判（与税政同一份 actionMood）；成数只认本次加派；负数、超限、几个成数都不猜
function fnSource(s, marker) { const a = s.indexOf(marker); if (a < 0) return null; let i = s.indexOf('{', a), d = 0; for (; i < s.length; i++) { if (s[i] === '{') d++; else if (s[i] === '}' && --d === 0) return s.slice(a, i + 1).replace(/\s+/g, ''); } return null; }
const policySrc = fs.readFileSync(path.join(__dirname, '..', 'tm-tax-policy.js'), 'utf8');
ok(fnSource(src, 'function actionMood(') && fnSource(src, 'function actionMood(') === fnSource(policySrc, 'function actionMood('), '加派与税政的 actionMood 逐字相同（只差缩进）');
[
  ['严禁：地方官员借口筹集军需向百姓加派辽饷二成', '冒号后的说明仍在禁令里'],
  ['严禁:地方官员借口筹集军需向百姓加派辽饷二成', '半角冒号同上'],
  ['加派辽饷二成，著即停止', '加派之后单独一句「著即停止」是收回'],
  ['加派辽饷二成。著即停止。', '下一句只有「著即停止」也是收回'],
  ['加派辽饷二成之事因灾情严重民力不支应即停止', '同一子句「……之事……停止」是收回'],
  ['严禁私征杂税并加派辽饷二成', '「并」后面没有另起命令，仍在禁令里']
].forEach(([text, why]) => ok(levy(text).length === 0, '不算加派（' + why + '）：' + text));
['不得以筹饷为由，向全国所有灾民和贫苦农户加派辽饷二成', '严禁地方官吏，向百姓加派辽饷二成'].forEach(text => {
  const r = levy(text);
  ok(r.length === 1 && r[0].tier === null && /说不清/.test(r[0].why || ''), '禁令管不管到加派说不清：不执行、交回请旨：' + text);
});
[
  ['严禁贪污军粮，加派辽饷二成', 0.2, '禁的是另一件具体的事'],
  ['严禁贪污军粮并照章加派辽饷二成', 0.2, '「并照章」另起一层'],
  ['严禁地方官员贪污军需并命户部向富户加派辽饷二成', 0.2, '「并命」另起一层'],
  ['不得已加派辽饷二成', 0.2, '「不得已」不是否定'],
  ['不得不加派辽饷二成', 0.2, '「不得不」不是否定'],
  ['加派辽饷二成，不得扰民', 0.2, '加派之后的约束不是收回'],
  ['加派辽饷二成，至秋收后停止', 0.2, '「至秋收后停止」是期限不是收回'],
  ['辽饷事宜，准予加派二成', 0.2, '税名在前一子句、动作在后一子句'],
  ['加派辽饷，以备军需，二成', 0.2, '隔着说明子句补成数'],
  ['辽饷二成，即行加派', 0.2, '成数在紧挨着的前一子句'],
  ['加派辽饷2%', 0.02, '「2%」按明示值，不再抬成 5%'],
  ['加派辽饷2成半', 0.25, '「2成半」']
].forEach(([text, rate, why]) => {
  const r = levy(text);
  ok(r.length === 1 && typeof r[0].tier === 'number' && Math.abs(r[0].tier - rate) < 1e-9, '照办（' + why + '）：' + text + ' → ' + JSON.stringify(r[0] && r[0].tier));
});
[
  ['加派辽饷，官俸按三成支给', /未写明成数/], ['加派辽饷：赈济款项发放三成', /未写明成数/],
  ['加派辽饷-2成', /成数不合/], ['加派辽饷-15%', /成数不合/], ['加派辽饷负二成', /成数不合/], ['加派辽饷零成', /成数不合/], ['加派辽饷101%', /成数不合/],
  ['加派辽饷二成至三成', /几个不同的成数/]
].forEach(([text, re]) => {
  const r = levy(text);
  ok(r.length === 1 && r[0].tier === null && re.test(r[0].raw), '成数不借、不猜：' + text + ' → ' + (r[0] && r[0].raw));
});
// 落效端：tier 留空的一律不征派，户部回奏写明缘由
const prepSrc = fs.readFileSync(path.join(__dirname, '..', 'tm-endturn-prep.js'), 'utf8');
const prepA = prepSrc.indexOf('  // 一次性财政动作'), prepB = prepSrc.indexOf('  // 诏令·外交动词', prepA);
function prep(text) {
  const notes = [], calls = [];
  const c2 = { console, GM: { turn: 3 }, allEdictText: text, _dbg() {}, addEB: (kind, msg) => notes.push(msg), extractEdictFiscalActions: ctx.extractEdictFiscalActions,
    GuokuEngine: { Actions: { extraTax: r => { calls.push(r); return { success: true }; } } } };
  c2.window = c2;
  vm.createContext(c2);
  vm.runInContext(prepSrc.slice(prepA, prepB), c2, { filename: 'tm-endturn-prep-slice.js' });
  return { notes: notes.join('\n'), calls };
}
ok(prepA > 0 && prepB > prepA, '找到 prep 的一次性财政动作段');
const unclearPrep = prep('不得以筹饷为由，向全国所有灾民和贫苦农户加派辽饷二成');
ok(unclearPrep.calls.length === 0 && /说不清/.test(unclearPrep.notes) && /未敢擅行/.test(unclearPrep.notes), '落效端：说不清的不征派，回奏写明缘由');
const norate = prep('加派辽饷以济军需');
ok(norate.calls.length === 0 && /未写明成数/.test(norate.notes), '落效端：没写成数的不征派');
const doPrep = prep('严禁贪污军粮，加派辽饷二成');
ok(doPrep.calls.length === 1 && doPrep.calls[0] === 0.2, '落效端：照办的按二成征派');

// 同句先禁一处、后令一处：被禁的那处不执行，后一处照办（原来整句跳过，后一道加派被静默丢掉）
[['严禁私自加派，户部加派辽饷二成', 0.2], ['不得加派辽饷，加派剿饷二成', 0.2], ['蠲免辽饷，加派剿饷二成', 0.2]].forEach(([text, rate]) => {
  const r = levy(text);
  ok(r.length === 1 && r[0].tier === rate, '同句先禁后令，后一处照办：' + text + ' → ' + JSON.stringify(r[0] && r[0].tier));
});
const conflict = levy('罢三饷，加派辽饷二成');
ok(conflict.length === 1 && conflict[0].tier === null && /抵触/.test(conflict[0].why || ''), '「罢三饷，加派辽饷二成」两相抵触：不执行、交回请旨');

console.log('\n[smoke-edict-levy-negation] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);
