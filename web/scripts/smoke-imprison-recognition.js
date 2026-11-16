#!/usr/bin/env node
// smoke-imprison-recognition.js — 下狱识别强化:诏狱等假阴性补全 + 否定否决 + 否定不误杀 + 单一真源 + 确定性 reason
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('  ✗ ' + msg); } }

const ctx = {
  console: { log() {}, warn() {}, info() {}, error() {} },
  Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp, isFinite, isNaN, parseInt, parseFloat,
  setTimeout: () => 0, clearTimeout: () => {}, Error
};
ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['tm-ai-change-pathutils.js', 'tm-ai-change-army.js', 'tm-ai-change-narrative.js', 'generated/tm-ai-change-applier.bundle.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
ctx.GM = { turn: 8, chars: [], facs: [{ name: '明朝廷' }], officeTree: [], _turnReport: [], publicTreasury: {} };
ctx.P = { playerInfo: { factionName: '明朝廷' } };

const isImp = ctx._tmReasonIsImprison;
assert(typeof isImp === 'function', 'applier 应导出 _tmReasonIsImprison');
assert(ctx._TM_IMPRISON_RE && typeof ctx._TM_IMPRISON_RE.test === 'function', 'applier 应导出 _TM_IMPRISON_RE 单一真源');

// ── A. 应判入狱(含原先漏判的「诏狱」族 + 新增术语) ──
console.log('===== A·真入狱(含诏狱假阴性修复) =====');
[
  '下诏狱待勘', '命锦衣卫将其下诏狱', '入诏狱', '锦衣卫拿问', '削籍逮治', '收监大牢',
  '囚禁三月', '槛车押京问罪', '锁拿入京', '械系赴京', '下镇抚司狱', '打入大牢', '关进死牢',
  '下狱待决', '逮捕归案', '羁押在京', '收押刑部', '系狱论罪'
].forEach(r => assert(isImp(r) === true, '应判入狱: "' + r + '"'));

// ── B. 否定否决·实为「未入狱」(假阳性修复) ──
console.log('===== B·否定否决(免于/幸免/未予…) =====');
[
  '免于下狱', '幸免诏狱', '得免逮捕', '未予逮捕', '不予拘押',
  '避免下狱', '以免下狱', '险些下狱', '差点入狱'
].forEach(r => assert(isImp(r) === false, '否定应不判入狱: "' + r + '"'));

// ── C. 否定不可误杀·这些确实入狱(含"免/不"但非避免义) ──
console.log('===== C·否定不误杀(免官下狱/不法下狱仍入狱) =====');
[
  '免官下狱', '免死下狱', '不法下狱', '贪墨下狱论罪', '革职拿问', '罢免后下诏狱'
].forEach(r => assert(isImp(r) === true, '应仍判入狱(否定不误杀): "' + r + '"'));

// ── D. 非入狱原因·不误判(原 false-positive 仍守住) ──
console.log('===== D·非入狱不误判(押解/拘谨/签押…) =====');
[
  '押解粮饷不力', '因拘谨保守', '签押有误', '拘泥旧礼', '押韵不工', '正常考核降职', '致仕归田'
].forEach(r => assert(isImp(r) === false, '不应判入狱: "' + r + '"'));

// ── E. onDismissal 端到端·诏狱真入库 + 否定不入库 ──
console.log('===== E·onDismissal 端到端 =====');
function addChar(name) { const ch = { name, position: '兵部尚书', loyalty: 60, alive: true, faction: '明朝廷', resources: {} }; ctx.GM.chars.push(ch); return ch; }
let c1 = addChar('张诏'); ctx.onDismissal('张诏', '命锦衣卫将张诏下诏狱待勘');
assert(c1._imprisoned === true, 'onDismissal「下诏狱」应设 _imprisoned(原漏判)');
assert(/诏狱/.test(c1._imprisonReason || ''), 'onDismissal 应留 _imprisonReason 含关键词');
let c2 = addChar('李免'); ctx.onDismissal('李免', '幸免诏狱·仅夺俸');
assert(!c2._imprisoned, 'onDismissal「幸免诏狱」不应设 _imprisoned');

// ── F. 单一真源·migration 运行时用导出正则(防漂移) + 确定性 reason 含关键词 ──
console.log('===== F·单一真源 + 确定性 reason =====');
// 确定性 reason 必含关键词(否则 migration 清洗器会误放)
assert(ctx._TM_IMPRISON_RE.test('廷杖下诏狱·重伤候勘'), '廷杖入狱 reason 应被单一真源识别(防 migration 误清)');
assert(ctx._TM_IMPRISON_RE.test('谋逆事发·下诏狱待勘'), '谋反下狱 reason 应被单一真源识别(防 migration 误清)');

console.log('');
console.log('[smoke-imprison-recognition] ' + pass + ' passed / ' + fail + ' failed');
if (fail > 0) process.exit(1);
