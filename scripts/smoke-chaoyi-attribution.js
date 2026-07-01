#!/usr/bin/env node
// scripts/smoke-chaoyi-attribution.js — 常朝表态「张冠李戴」修复 smoke
// bug:A(吕颐浩)上奏·B(张浚)附议时却说"臣附 C(汪伯彦)之议"(把原奏人之言安到他人头上)。
// 根因:second/rebut/soften/confront 模板的 X 一律替换成 state.lastSpeaker(前一位)·而非按立场选参照人。
// 修:_cc3_analyzeDebate 产 refSame(同立场锚)/refOpp(异己锚)/presenterName(均优先主奏人)·
//     _cc3_buildModeInstruction 按 mode 选:second→refSame·rebut/soften/confront→refOpp·并加「引名务确」防误引。
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'tm-chaoyi-changchao.js'), 'utf8');

function mkEl() {
  return { style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {}, removeChild() {}, remove() {}, querySelector() { return mkEl(); }, querySelectorAll() { return []; },
    addEventListener() {}, setAttribute() {}, getAttribute() { return null; }, innerHTML: '', textContent: '', value: '' };
}
function makeSandbox() {
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Math, Date, Promise, JSON, Array, Object, String, Number, Boolean, Error, RegExp,
    document: { getElementById: () => mkEl(), querySelector: () => mkEl(), querySelectorAll: () => [], createElement: mkEl, addEventListener() {}, head: { appendChild() {} }, body: { appendChild() {}, removeChild() {} } },
    localStorage: { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; }, removeItem(k) { delete this._s[k]; } },
    AbortController: function () { this.signal = {}; this.abort = function () {}; },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    GM: {
      turn: 5, vars: { '皇威': { value: 55 }, '皇权': { value: 60 } },
      chars: [
        { name: '吕颐浩', officialTitle: '户部尚书', faction: '中立', loyalty: 75, alive: true },
        { name: '张浚', officialTitle: '侍御史', faction: '中立', loyalty: 80, alive: true },
        { name: '汪伯彦', officialTitle: '尚书左仆射', faction: '主和', loyalty: 60, alive: true },
        { name: '秦桧', officialTitle: '御史中丞', faction: '主和', loyalty: 50, alive: true }
      ],
      currentIssues: [], armies: [], evtLog: [], officeTree: [], _ccHeldItems: [], _pendingTinyiTopics: [], _courtRecords: []
    },
    P: { scenario: { startYear: 1127, chaoyi: {} }, ai: { key: 'mock', url: 'mock' } },
    findCharByName: null, _isAtCapital: () => true, _isPlayerFactionChar: () => true, _isSameLocation: () => true,
    _cyGetRank: () => '正三品', callAI: async () => '[]', extractJSON: () => null,
    _aiDialogueTok: () => 500, _aiDialogueWordHint: () => '约 50-120 字', _cc2_buildAgendaPrompt: () => 'mock',
    NpcMemorySystem: undefined, OpinionSystem: undefined, AffinityMap: undefined,
    addCYBubble: () => {}, openChaoyi: () => {}, closeChaoyi: () => {},
    CY: { open: false, mode: 'changchao', _cc2: { queue: [], decisions: [], attendees: [] } },
    toast: () => {}, getTSText: () => 'T0', TM: { errors: { captureSilent: () => {}, capture: () => {} } }
  };
  sandbox.window = sandbox; sandbox.global = sandbox;
  sandbox.findCharByName = function (name) { return sandbox.GM.chars.find(c => c && c.name === name); };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'tm-chaoyi-changchao.js' });
  try { vm.runInContext('_cc3_overrideMockWithGM()', sandbox); } catch (_) {}
  return sandbox;
}

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ FAIL: ' + m); } }

console.log('\n[smoke-chaoyi-attribution] 常朝表态张冠李戴修复\n');
const sb = makeSandbox();
const gmCh = { name: '张浚', faction: '中立' };
const MR = m => ({ mode: m, modifiers: {} });   // modeResult 含 modifiers(buildModeInstruction 读 .cite/.force/.source)

// ── T1·_cc3_buildModeInstruction 按 mode 选正确参照人(核心修复·合成 state 直测 X 替换) ──
console.log('  T1·buildModeInstruction X→按 mode 选参照人');
{
  // 张浚支持吕颐浩之奏·前一位发言者是汪伯彦(lastSpeaker)·refSame=主奏人吕颐浩·refOpp=秦桧
  const state = { lastSpeaker: '汪伯彦', refSame: '吕颐浩', refOpp: '秦桧', presenterName: '吕颐浩', myStance: 'support' };
  const pSecond = sb._cc3_buildModeInstruction(MR('second'), 'default', state, gmCh);
  ok(/臣附 吕颐浩 之议/.test(pSecond), 'T1 second(附议)→X=refSame(吕颐浩·主奏人)·"臣附 吕颐浩 之议"');
  ok(!/臣附 汪伯彦 之议/.test(pSecond), 'T1 second→绝不用前一位(汪伯彦)·根治张冠李戴');
  ok(/【引名务确】[\s\S]*主奏为「吕颐浩」[\s\S]*附议[\s\S]*「吕颐浩」/.test(pSecond), 'T1 second→加「引名务确」明示附议对象');

  const pRebut = sb._cc3_buildModeInstruction(MR('rebut'), 'default', state, gmCh);
  ok(/秦桧/.test(pRebut) && !/未当[\s\S]*汪伯彦/.test(pRebut), 'T1 rebut(驳斥)→X=refOpp(秦桧·异己)·非前一位');
  ok(/【引名务确】[\s\S]*驳斥[\s\S]*「秦桧」/.test(pRebut), 'T1 rebut→引名务确指向驳斥对象秦桧');

  const pSoften = sb._cc3_buildModeInstruction(MR('soften'), 'default', state, gmCh);
  ok(/秦桧/.test(pSoften), 'T1 soften(缓和)→X=refOpp(秦桧)');
}

// ── T2·非点名类 mode 沿用 lastSpeaker(不改旧行为) + refSame 缺失优雅回退 ──
console.log('\n  T2·回退行为');
{
  const state = { lastSpeaker: '汪伯彦', refSame: '吕颐浩', refOpp: '秦桧', presenterName: '吕颐浩' };
  const pAug = sb._cc3_buildModeInstruction(MR('augment'), 'default', state, gmCh);
  ok(!/引名务确/.test(pAug), 'T2 augment(补充·非点名类)→不加引名务确(不改旧行为)');
  const stateNoRef = { lastSpeaker: '汪伯彦', presenterName: '吕颐浩' };   // 无 refSame(极端/旧存档)
  const pFallback = sb._cc3_buildModeInstruction(MR('second'), 'default', stateNoRef, gmCh);
  ok(/臣附 汪伯彦 之议/.test(pFallback), 'T2 second 无refSame→优雅回退 lastSpeaker(不劣于旧行为·不崩)');
  ok(typeof sb._cc3_buildModeInstruction(MR('second'), 'default', null, gmCh) === 'string', 'T2 state=null→不崩返字符串');
}

// ── T3·_cc3_analyzeDebate 产 presenterName / refSame / refOpp ──
console.log('\n  T3·analyzeDebate 参照锚计算');
{
  // item.target=秦桧 → 秦桧 myStance=oppose(确定性·_cc3_computeStanceFromChar 对被针对者返 oppose)
  const item = { presenter: '吕颐浩', dept: '户部', title: '请预储粮料', detail: '行在骤增数万官吏军士,粮料月费七万石', target: '秦桧',
    selfReact: [{ name: '张浚', stance: 'support', line: '臣以为宜预储', _aiGen: true }] };
  const stQin = sb._cc3_analyzeDebate(item, '秦桧', sb.findCharByName('秦桧'));
  ok(stQin.presenterName === '吕颐浩', 'T3 presenterName=主奏人吕颐浩');
  ok(stQin.myStance === 'oppose', 'T3 被针对者秦桧 myStance=oppose(确定性)');
  ok(stQin.refOpp === '吕颐浩', 'T3 我反对本议→驳斥锚 refOpp=主奏人(吕颐浩)·非前一位张浚');
  ok(!!stQin.refSame, 'T3 refSame 非空(有值可填·不留 X)');

  // speaker===presenter → presenter 不自我引用(_presUsable=false)·refSame/refOpp 回退 prior/last
  const item2 = { presenter: '吕颐浩', title: 't', detail: 'd', selfReact: [{ name: '张浚', stance: 'oppose', line: 'x', _aiGen: true }] };
  const stSelf = sb._cc3_analyzeDebate(item2, '吕颐浩', sb.findCharByName('吕颐浩'));
  ok(stSelf.presenterName === '吕颐浩', 'T3 主奏人本人发言:presenterName 仍记录');
  ok(stSelf.refSame !== '吕颐浩' && stSelf.refOpp !== '吕颐浩', 'T3 主奏人不自我引用(refSame/refOpp≠自己)');

  // 无 prior 早返回也带字段(不留 undefined)
  const stEmpty = sb._cc3_analyzeDebate({ presenter: '吕颐浩', title: 't', detail: 'd' }, '张浚', sb.findCharByName('张浚'));
  ok(stEmpty.presenterName === '吕颐浩' && 'refSame' in stEmpty && 'refOpp' in stEmpty, 'T3 无prior早返回:presenterName/refSame/refOpp 字段齐(不 undefined)');
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
