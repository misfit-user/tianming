#!/usr/bin/env node
// 文风设置 smoke：默认「照旧」时各处提示词逐字不变；选了别的档，各栏接上指示，实录固定文言，人物说话默认不跟。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const WEB = path.resolve(__dirname, '..');
let checks = 0;
const ok = (v, m) => { assert(v, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a === undefined ? a : JSON.parse(JSON.stringify(a)), b === undefined ? b : JSON.parse(JSON.stringify(b)), m); checks++; };
const read = (f) => fs.readFileSync(path.join(WEB, f), 'utf8');

function sandbox(withWenfeng, conf) {
  const c = { console: { log() {}, warn() {}, error() {} }, TM: {}, saves: 0, toasts: [] };
  c.P = { conf: conf || {} };
  c.saveP = () => { c.saves++; };
  c.toast = (m) => { c.toasts.push(m); };
  c.window = c;
  c.globalThis = c;
  vm.createContext(c);
  if (withWenfeng) vm.runInContext(read('tm-wenfeng.js'), c, { filename: 'tm-wenfeng.js' });
  return c;
}

// ── 1. 默认「照旧」：什么都不加 ──
{
  const c = sandbox(true);
  const W = c.TM.Wenfeng;
  ['shizhengji', 'houren', 'documents', 'fengwen', 'dialogue', 'shilu'].forEach((col) => eq(W.directive(col), '', col + ' 默认不加指示'));
  eq(W.mainBlock(), '', '默认主推演不加总说明');
  ok(!W.active(), '默认不算启用');
  eq(W.level('shilu'), 'wenyan', '实录固定文言');
}

// ── 2. 设总设置、各栏、人物说话 ──
{
  const c = sandbox(true);
  const W = c.TM.Wenfeng;
  W.set('level', 'baihua');
  eq(c.P.conf.wenfeng.level, 'baihua', '总设置存进 P.conf.wenfeng');
  ok(c.saves === 1 && /白话/.test(c.toasts[0]), '改了立即存并提示');
  ok(/时政记·白话/.test(W.directive('shizhengji')) && /优先于上面的叙事风格/.test(W.directive('shizhengji')), '时政记接白话指示，并声明优先');
  eq(W.directive('shilu'), '', '实录不随总设置');
  eq(W.directive('dialogue'), '', '人物说话默认不跟总设置');
  ok(/时政记：白话/.test(W.mainBlock()) && /实录一律文言/.test(W.mainBlock()), '主推演总说明列出各栏并说明实录固定文言');
  W.set('cols.houren', 'wenyan');
  eq(W.level('houren'), 'wenyan', '单栏设置优先于总设置');
  ok(/后人戏说·文言/.test(W.directive('houren')), '后人戏说接文言指示');
  ok(/后人戏说：文言/.test(W.mainBlock()), '总说明里单栏也照实写');
  W.set('cols.houren', 'inherit');
  eq(W.level('houren'), 'baihua', '改回「随总设置」');
  W.set('cols.documents', 'keep');
  eq(W.directive('documents'), '', '单栏选「照旧」就不加');
  W.set('dialogueFollow', true);
  ok(/人物说话·白话/.test(W.directive('dialogue')), '打开开关后人物说话随总设置');
  W.set('cols.shilu', 'baihua');
  eq(W.level('shilu'), 'wenyan', '实录不许单设');
  W.set('level', 'nonsense');
  eq(W.level('shizhengji'), 'keep', '认不出的档当「照旧」');
  ok(/总设置照旧/.test(W.summary()), '提示语写出现状');
}

// ── 3. 史记写法说明（LLM 模式与 Agent 模式共用）：默认逐字不变，选了档就接上 ──
{
  const load = (withWenfeng, conf) => {
    const c = sandbox(withWenfeng, conf);
    vm.runInContext(read('tm-endturn-record-specs.js'), c, { filename: 'tm-endturn-record-specs.js' });
    return c.TM.Endturn.AI.prompt;
  };
  const bare = load(false), dflt = load(true);
  eq(dflt.recordSpecs({}), bare.recordSpecs({}), '默认时政记等写法说明与没有文风模块时逐字相同');
  eq(dflt.hourenSpec({}), bare.hourenSpec({}), '默认后人戏说写法说明逐字相同');
  const bai = load(true, { wenfeng: { level: 'baihua' } });
  ok(bai.recordSpecs({}).shizhengji.endsWith(sandbox(true, { wenfeng: { level: 'baihua' } }).TM.Wenfeng.directive('shizhengji')), '选白话后时政记写法说明末尾接上指示');
  eq(bai.recordSpecs({}).shilu, bare.recordSpecs({}).shilu, '实录写法说明不变');
  const h = bai.hourenSpec({});
  ok(h.indexOf('后人戏说·白话') > 0 && h.indexOf('后人戏说·白话') < h.indexOf('返回纯JSON'), '后人戏说指示接在返回格式之前');
}

// ── 4. 问对、朝议共用的发言提示：默认不变，开了「人物说话也随总设置」才接上 ──
{
  const src = read('tm-utils.js');
  const fn = src.match(/function _aiDialogueWordHint\(category\) \{[\s\S]*?\r?\n\}/)[0];
  const run = (conf) => {
    const c = sandbox(true, conf);
    vm.runInContext(fn, c, { filename: 'tm-utils.js(节选)' });
    return c._aiDialogueWordHint('wd');
  };
  eq(run({}), '（每条发言约 150-300 字）', '默认发言提示逐字不变');
  eq(run({ wenfeng: { level: 'baihua' } }), '（每条发言约 150-300 字）', '只改总设置，人物说话不跟');
  ok(/人物说话·白话/.test(run({ wenfeng: { level: 'baihua', dialogueFollow: true } })), '开了开关，发言提示接上指示');
}

// ── 5. 各处提示词都接上了 ──
{
  const prompt = read('tm-endturn-prompt.js');
  ok(/sysP \+= _narrativeGuide;\r?\n[^\n]*\r?\n\s*try \{ if \(typeof TM !== 'undefined' && TM\.Wenfeng\) sysP \+= TM\.Wenfeng\.mainBlock\(\); \}/.test(prompt), '主推演系统提示词在叙事风格之后接总说明');
  ok(/TM\.Wenfeng\.directive\('fengwen'\)/.test(read('tm-endturn-ai.js')), '风闻字段接指示');
  const mem = read('tm-memorials.js');
  ok(/TM\.Wenfeng\.directive\('documents'\)/.test(mem) && mem.includes("'  ※ 全部使用文言(半文言亦可)·善用四六骈句、对偶排比\\n'"), '奏疏：选了档换成指示，照旧时原句不变');
  ok(/TM\.Wenfeng\.directive\('documents'\)/.test(read('tm-hongyan-office.js')), '回信接指示');
  ok(read('tm-patches.js').includes('TM.Wenfeng.settingsHtml()'), '设置页有文风一节');
  const html = read('index.html');
  ok(html.indexOf('tm-wenfeng.js') > html.indexOf('tm-prompt-composer.js'), 'index.html 在提示词组装器之后装载');
}

// ── 6. 设置页这一节 ──
{
  const c = sandbox(true);
  const W = c.TM.Wenfeng;
  let h = W.settingsHtml();
  ok(/id="s-wenfeng-level"[\s\S]*?<option value="keep" selected>照旧（默认）/.test(h), '默认选中「照旧」');
  eq((h.match(/id="s-wenfeng-(shizhengji|houren|documents|fengwen)"/g) || []).length, 4, '四栏各有下拉框');
  ok(!/id="s-wenfeng-dialogue" checked/.test(h), '人物说话开关默认不勾');
  ok(/实录固定文言/.test(h), '写明实录固定文言');
  W.set('level', 'banwen');
  W.set('cols.fengwen', 'wenyan');
  W.set('dialogueFollow', true);
  h = W.settingsHtml();
  ok(/<option value="banwen" selected>半文半白/.test(h), '总设置回显');
  ok(/id="s-wenfeng-fengwen"[\s\S]*?<option value="wenyan" selected>文言/.test(h), '单栏回显');
  ok(/id="s-wenfeng-dialogue" checked/.test(h), '开关回显');
}

console.log('[smoke-wenfeng] pass assertions=' + checks);
