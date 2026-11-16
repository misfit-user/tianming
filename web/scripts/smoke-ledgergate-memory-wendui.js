#!/usr/bin/env node
// smoke-ledgergate-memory-wendui.js
// 2026-07-16·落库契约硬化刀③：NPC 记忆/问对落账过闸(全绕过 memory-writegate·写门只护 SC1 信封)。
//   三写口各补「实体存在性+死人闸+数值钳制+不落账候选留痕」三件套(守住行为·只加闸)：
//   ① _applyMwList (tm-endturn-followup-helpers.js)·记忆回写 ch._memory:幻影/死者提前拦截·留痕(镜像 remember 内闸)。
//   ② _wd_extractCommitments (tm-wendui.js)·承诺直写 GM._npcCommitments:死者不收承诺·willingness 钳 [0,1]。
//   ③ sendWendui (tm-wendui.js)·忠诚/压力/亲信直写:死人闸门控三处直写(源契约)。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) { passed++; console.log('  ok - ' + msg); } else { failed++; console.error('  ✗ ' + msg); } }

// ═══════════════════════════════════════════════════════════════════════
//  ①  _applyMwList·记忆口实体+死人闸+留痕
// ═══════════════════════════════════════════════════════════════════════
console.log('===== ①·_applyMwList 记忆口过闸 =====');
(function () {
  const warns = [];
  const remembered = [];
  const sandbox = {
    console: { log() {}, warn(...a) { warns.push(a); }, info() {}, error() {} },
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp, isFinite, isNaN, parseInt, parseFloat
  };
  sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
  sandbox._dbg = () => {};
  sandbox.GM = { turn: 5, chars: [
    { name: '孙传庭', alive: true },
    { name: '死督', alive: false }
  ] };
  sandbox.findCharByName = (name) => (sandbox.GM.chars || []).find(c => c && c.name === name) || null;
  // stub remember·记录实收(真件 tm-mechanics-memory.js·此处只验本口是否把幻影/死者挡在 remember 之外)
  sandbox.NpcMemorySystem = { remember: function (name) { remembered.push(name); } };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-followup-helpers.js'), 'utf8'), sandbox, { filename: 'tm-endturn-followup-helpers.js' });
  const _applyMwList = sandbox.TM.__etFollowupParts._applyMwList;
  assert(typeof _applyMwList === 'function', 'A0 _applyMwList 可取到');

  const n = _applyMwList([
    { char: '孙传庭', event: '奉诏督师陕西' },   // 活人·应写
    { char: '王二麻子', event: '凭空之人受赏' },  // 幻影·不写+留痕
    { char: '死督', event: '死者获新记忆' }        // 死者·不写+留痕
  ], {});
  assert(remembered.indexOf('孙传庭') >= 0, 'A1 活人记忆照常落账(remember 被调)');
  assert(remembered.indexOf('王二麻子') < 0, 'A2 ★幻影人物不建记忆(未达 remember)');
  assert(remembered.indexOf('死督') < 0, 'A3 ★死者不建记忆(未达 remember)');
  assert(n === 1, 'A4 计数只含真落账(错计已修·幻影/死者不再 n++·得 ' + n + ')');
  const skipWarn = warns.find(a => String(a[0]).indexOf('幻影/死者不建记忆') >= 0);
  assert(!!skipWarn, 'A5 ★不落账候选留痕(console.warn 通道)');
  const skipList = skipWarn && skipWarn[1];
  assert(Array.isArray(skipList) && skipList.some(s => s.char === '王二麻子') && skipList.some(s => s.char === '死督'), 'A6 留痕含幻影+死者+原句摘录');

  // covered 不含幻影/死者(续写去重语义只属真录入者)
  const covered = {};
  _applyMwList([{ char: '王二麻子', event: 'x' }, { char: '孙传庭', event: 'y' }], covered);
  assert(!covered['王二麻子'] && covered['孙传庭'] === 1, 'A7 covered 只置真录入者(幻影不占续写去重名额)');
})();

// ═══════════════════════════════════════════════════════════════════════
//  ②  _wd_extractCommitments·承诺口死人闸 + willingness 钳制
// ═══════════════════════════════════════════════════════════════════════
console.log('===== ②·_wd_extractCommitments 承诺口过闸 =====');
function makeWenduiCtx(aiJson) {
  const warns = [];
  const remembered = [];
  const sandbox = {
    console: { log() {}, warn(...a) { warns.push(a); }, info() {}, error() {} },
    setTimeout: () => 0, clearTimeout: () => {}, requestAnimationFrame: () => 0,
    Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, parseInt, parseFloat, isFinite, isNaN, Promise
  };
  sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
  sandbox.document = { createElement() { return { className: '', innerHTML: '', style: {}, appendChild() {}, children: [] }; }, getElementById() { return null; } };
  sandbox._$ = () => null;
  sandbox.escHtml = (s) => String(s == null ? '' : s);
  sandbox.toast = () => {};
  sandbox.uid = () => 'cmt_test_' + Math.random().toString(36).slice(2, 6);
  sandbox.getTSText = () => '';
  sandbox.addEB = () => {};
  sandbox.callAI = async () => aiJson;
  sandbox.callAIMessagesStream = async () => '';
  sandbox.extractJSON = (raw) => { try { return JSON.parse(raw); } catch (_) { return null; } };
  sandbox.findCharByName = (name) => (sandbox.GM.chars || []).find(c => c && c.name === name) || null;
  sandbox.NpcMemorySystem = { remember: (name) => remembered.push(name), getImpression: () => 0 };
  sandbox.TM = { errors: { capture() {}, captureSilent() {} }, Qiju: { recordEntry() {} }, Gossip: { _distort: (s) => s } };
  sandbox._warns = warns; sandbox._remembered = remembered;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-wendui.js'), 'utf8'), sandbox, { filename: 'tm-wendui.js' });
  return sandbox;
}
function jishiPair(name, turn) {
  return [{ char: name, turn: turn, mode: 'formal', playerSaid: '卿去查户部亏空', npcSaid: '臣领旨即办' }];
}

(async function () {
  // 活人·合法承诺照常落账 + willingness 越界被钳
  {
    const sb = makeWenduiCtx(JSON.stringify({ commitments: [{ task: '彻查户部亏空', category: 'query', deadline: 4, willingness: 5 }], relays: [] }));
    sb.P = { ai: { key: 'k' }, playerInfo: { characterName: '天子' } };
    sb.GM = { turn: 7, chars: [{ name: '毕自严', alive: true, loyalty: 60 }], jishiRecords: jishiPair('毕自严', 7), _npcCommitments: {} };
    await sb._wd_extractCommitments('毕自严');
    const list = (sb.GM._npcCommitments['毕自严'] || []);
    assert(list.length === 1 && list[0].task === '彻查户部亏空', 'B1 活人合法承诺照常落账');
    assert(list[0].willingness === 1, 'B2 ★willingness 越界(5)被钳至 [0,1] 上界 1');
    assert(list[0].deadline === 4, 'B3 deadline 既有钳制(1-10)保留');
  }
  // 死者·不收新承诺 + 留痕
  {
    const sb = makeWenduiCtx(JSON.stringify({ commitments: [{ task: '死者受命办差', category: 'query', deadline: 3, willingness: 0.8 }], relays: [] }));
    sb.P = { ai: { key: 'k' }, playerInfo: { characterName: '天子' } };
    sb.GM = { turn: 7, chars: [{ name: '亡臣', alive: false, dead: true, loyalty: 50 }], jishiRecords: jishiPair('亡臣', 7), _npcCommitments: {} };
    await sb._wd_extractCommitments('亡臣');
    assert(!sb.GM._npcCommitments['亡臣'] || sb.GM._npcCommitments['亡臣'].length === 0, 'B4 ★死者不收新承诺(GM._npcCommitments 未落账)');
    assert(sb._warns.some(a => String(a[0]).indexOf('死者不收新承诺') >= 0), 'B5 ★死者承诺不落账留痕(console.warn)');
    assert(sb._remembered.indexOf('亡臣') < 0, 'B6 死者亦不写承诺记忆');
  }
  // 查无此人·早退(实体存在性·由既有 findCharByName+!ch return 保证)
  {
    const sb = makeWenduiCtx(JSON.stringify({ commitments: [{ task: 'x', willingness: 0.5 }], relays: [] }));
    sb.P = { ai: { key: 'k' }, playerInfo: { characterName: '天子' } };
    sb.GM = { turn: 7, chars: [{ name: '毕自严', alive: true }], jishiRecords: jishiPair('查无此人', 7), _npcCommitments: {} };
    await sb._wd_extractCommitments('查无此人');
    assert(!sb.GM._npcCommitments['查无此人'], 'B7 查无此人→不落账(实体存在性既有 return 保证)');
  }
  // await 晚到：跨回合 / 换档 / 目标死亡均必须拒绝，不得把旧会话结果写入新世界。
  {
    const sb = makeWenduiCtx('');
    sb.P = { ai: { key: 'k' }, playerInfo: { characterName: '天子' } };
    sb.GM = { sid: 's1', turn: 7, chars: [{ name: '毕自严', alive: true, loyalty: 60 }], jishiRecords: jishiPair('毕自严', 7), _npcCommitments: {} };
    let release;
    sb.callAI = () => new Promise(resolve => { release = resolve; });
    const pending = sb._wd_extractCommitments('毕自严');
    await Promise.resolve();
    sb.GM.turn = 8;
    release(JSON.stringify({ commitments: [{ task: '晚到旧旨', willingness: 1 }], relays: [] }));
    await pending;
    assert(!sb.GM._npcCommitments['毕自严'], 'B8 ★跨回合晚到承诺拒绝落账');
    assert(sb._warns.some(a => String(a[0]).indexOf('晚到结果已拒绝') >= 0), 'B9 跨回合拒绝留痕');
  }
  {
    const sb = makeWenduiCtx('');
    sb.P = { ai: { key: 'k' }, playerInfo: { characterName: '天子' } };
    const oldGM = { sid: 's1', turn: 7, chars: [{ name: '毕自严', alive: true }], jishiRecords: jishiPair('毕自严', 7), _npcCommitments: {} };
    sb.GM = oldGM;
    let release;
    sb.callAI = () => new Promise(resolve => { release = resolve; });
    const pending = sb._wd_extractCommitments('毕自严');
    await Promise.resolve();
    sb.GM = { sid: 's2', turn: 7, chars: [{ name: '毕自严', alive: true }], jishiRecords: [], _npcCommitments: {} };
    release(JSON.stringify({ commitments: [{ task: '跨档旧旨', willingness: 1 }], relays: [] }));
    await pending;
    assert(!oldGM._npcCommitments['毕自严'] && !sb.GM._npcCommitments['毕自严'], 'B10 ★跨档晚到承诺不写旧 GM 也不污染新 GM');
  }
  {
    const sb = makeWenduiCtx('');
    sb.P = { ai: { key: 'k' }, playerInfo: { characterName: '天子' } };
    const target = { name: '毕自严', alive: true };
    sb.GM = { sid: 's1', turn: 7, chars: [target], jishiRecords: jishiPair('毕自严', 7), _npcCommitments: {} };
    let release;
    sb.callAI = () => new Promise(resolve => { release = resolve; });
    const pending = sb._wd_extractCommitments('毕自严');
    await Promise.resolve();
    target.alive = false; target.dead = true;
    release(JSON.stringify({ commitments: [{ task: '死后晚到旨', willingness: 1 }], relays: [] }));
    await pending;
    assert(!sb.GM._npcCommitments['毕自严'], 'B11 ★目标 await 期间死亡则晚到结果拒绝');
  }

  // ═════════════════════════════════════════════════════════════════════
  //  ③  sendWendui·死人闸源契约(async DOM 大函数·验守卫接线)
  // ═════════════════════════════════════════════════════════════════════
  console.log('===== ③·sendWendui 死人闸源契约 =====');

  console.log('');
  console.log('[smoke-ledgergate-memory-wendui] ' + passed + ' passed / ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})();
