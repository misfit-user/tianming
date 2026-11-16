#!/usr/bin/env node
// smoke-npc-defeat-retire-ripple.js
// 验证「战败涟漪」(败将羞愤/盟友忧/政敌借机参劾)+「致仕涟漪」(门生失怙离情·gentle)。
// 手法:花括号配平抽 tm-endturn-helpers.js 真 _npcDefeatRipple/_npcRetireRipple 实跑·非重新实现。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } }

const SRC = fs.readFileSync(path.join(ROOT, 'tm-endturn-helpers.js'), 'utf8');

// ── 花括号配平抽真函数 ──
function extractFn(name) {
  const s = SRC.indexOf('function ' + name + '()');
  let i = SRC.indexOf('{', s), depth = 0, e = -1;
  for (; i < SRC.length; i++) { const ch = SRC[i]; if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { e = i + 1; break; } } }
  return SRC.slice(s, e);
}
const defeatSrc = extractFn('_npcDefeatRipple');
const retireSrc = extractFn('_npcRetireRipple');

function mkCtx(chars, affMap, turn, fnSrc) {
  const ctx = { Math: Math };
  ctx.GM = { chars: chars, turn: turn };
  ctx.findCharByName = function (n) { return chars.find(function (c) { return c.name === n; }) || null; };
  ctx.AffinityMap = { getRelations: function (name) { return (affMap[name] || []).slice().sort(function (x, y) { return Math.abs(y.value) - Math.abs(x.value); }); } };
  ctx.adjustCharacterLoyalty = function (ch, d, r, o) { ch.loyalty = (ch.loyalty == null ? 50 : ch.loyalty) + d; return { ok: true }; };
  ctx._faceLog = [];
  ctx.FaceSystem = { loseFace: function (ch, amt, r) { ch._face = (ch._face == null ? 100 : ch._face) - amt; ctx._faceLog.push(ch.name); } };
  ctx.NpcMemorySystem = { remember: function (who, ev, emo, imp) { const c = chars.find(function (x) { return x.name === who; }); if (c) { c._memory = c._memory || []; c._memory.push({ event: ev, emotion: emo, importance: imp }); } } };
  vm.createContext(ctx);
  vm.runInContext(fnSrc, ctx, { filename: 'fn.js' });
  return ctx;
}
function memOf(ctx, name) { const c = ctx.GM.chars.find(function (x) { return x.name === name; }); return (c && c._memory) || []; }

// ════════ 战败涟漪 ════════
// ① 败将自身羞愤 + 盟友忧 + 政敌借机参劾
(function () {
  const chars = [
    { name: '败将', alive: true, _defeatTurn: 5, _defeatReason: 'defeat', loyalty: 60, stress: 0, _face: 100 },
    { name: '同袍', alive: true },   // value 60 → 忧
    { name: '政敌', alive: true }    // value -70 → 喜·参劾
  ];
  const aff = { '败将': [{ name: '同袍', value: 60 }, { name: '政敌', value: -70 }] };
  const ctx = mkCtx(chars, aff, 5, defeatSrc);
  ctx._npcDefeatRipple();
  ok(chars[0].stress === 12 && chars[0].loyalty === 56 && chars[0]._face === 88, '① 败将自身 stress+12/loyalty-4/掉面子12·实=' + chars[0].stress + '/' + chars[0].loyalty + '/' + chars[0]._face);
  const ms = memOf(ctx, '败将');
  ok(ms.length === 1 && ms[0].emotion === '惧' && ms[0].importance === 8, '① 败将自责记忆 惧/imp8');
  ok(chars[0]._mood === '惧', '① 败将心绪转惧');
  ok(memOf(ctx, '同袍')[0].emotion === '忧', '① 同袍为之忧');
  const me = memOf(ctx, '政敌')[0];
  ok(me.emotion === '喜' && me.event.indexOf('借机参劾') >= 0, '② 政敌借机参劾·强敌则喜·实=' + JSON.stringify(me));
})();

// ③ 战败:存量旧败(差>1)不触发 + 幂等 + 阵亡(alive false)跳过
(function () {
  const chars = [{ name: '旧败', alive: true, _defeatTurn: 1, loyalty: 50, stress: 0 }, { name: '友', alive: true }];
  const ctx = mkCtx(chars, { '旧败': [{ name: '友', value: 60 }] }, 20, defeatSrc);
  ctx._npcDefeatRipple();
  ok(chars[0].stress === 0 && memOf(ctx, '友').length === 0, '③ 存量旧败(差>1回合)不触发');
})();
(function () {
  const chars = [{ name: '甲', alive: true, _defeatTurn: 7, loyalty: 50, stress: 0 }];
  const ctx = mkCtx(chars, {}, 7, defeatSrc);
  ctx._npcDefeatRipple(); ctx._npcDefeatRipple();
  ok(chars[0].stress === 12 && chars[0]._defeatReacted === true, '③ 战败幂等:两调一次 + _defeatReacted');
})();
(function () {
  const chars = [{ name: '阵亡者', alive: false, _defeatTurn: 3, stress: 0 }];
  const ctx = mkCtx(chars, {}, 3, defeatSrc);
  ctx._npcDefeatRipple();
  ok(chars[0].stress === 0, '③ 阵亡(alive=false)不走战败涟漪(归死亡涟漪)');
})();

// ════════ 致仕涟漪 ════════
// ④ 门生失怙离情(哀)·gentle 不挫忠诚 + 政敌 muted
(function () {
  const chars = [
    { name: '元老', alive: true, _retired: true, _retireTurn: 5 },
    { name: '门生', alive: true, loyalty: 60, stress: 0 },  // value 65 → 哀·不挫忠诚
    { name: '夙敌', alive: true }                            // value -60 → 平·少一掣肘
  ];
  const aff = { '元老': [{ name: '门生', value: 65 }, { name: '夙敌', value: -60 }] };
  const ctx = mkCtx(chars, aff, 5, retireSrc);
  ctx._npcRetireRipple();
  const m = memOf(ctx, '门生');
  ok(m.length === 1 && m[0].emotion === '哀' && m[0].event.indexOf('失一奥援') >= 0, '④ 门生失怙离情 哀·实=' + JSON.stringify(m[0]));
  ok(chars[1].loyalty === 60 && chars[1].stress === 0, '④ 致仕 gentle:门生忠诚/压力不变(荣退非失势)');
  const me = memOf(ctx, '夙敌')[0];
  ok(me.emotion === '平' && me.event.indexOf('少一掣肘') >= 0, '④ 政敌 muted relief·少一掣肘·平');
})();

// ⑤ 致仕:_retiredTurn(有d)变体也识别 + 存量退隐不触发 + 幂等
(function () {
  const chars = [{ name: '老臣', alive: true, _retired: true, _retiredTurn: 9 }, { name: '故吏', alive: true }];
  const ctx = mkCtx(chars, { '老臣': [{ name: '故吏', value: 70 }] }, 9, retireSrc);
  ctx._npcRetireRipple();
  ok(memOf(ctx, '故吏').length === 1 && memOf(ctx, '故吏')[0].emotion === '哀', '⑤ _retiredTurn(有d)变体识别');
})();
(function () {
  const chars = [{ name: '早退', alive: true, _retired: true, _retireTurn: 1 }, { name: '旧识', alive: true }];
  const ctx = mkCtx(chars, { '早退': [{ name: '旧识', value: 70 }] }, 30, retireSrc);
  ctx._npcRetireRipple();
  ok(memOf(ctx, '旧识').length === 0, '⑤ 存量退隐者(差>1)不触发');
})();
(function () {
  const chars = [{ name: '甲', alive: true, _retired: true, _retireTurn: 4 }, { name: '生', alive: true }];
  const ctx = mkCtx(chars, { '甲': [{ name: '生', value: 60 }] }, 4, retireSrc);
  ctx._npcRetireRipple(); ctx._npcRetireRipple();
  ok(memOf(ctx, '生').length === 1 && chars[0]._retireReacted === true, '⑤ 致仕幂等:两调一记 + _retireReacted');
})();

console.log('[smoke-npc-defeat-retire-ripple] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);
