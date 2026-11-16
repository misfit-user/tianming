#!/usr/bin/env node
// smoke-npc-disgrace-ripple.js
// 验证「下狱/流放涟漪」:党羽株连之忧(惧+压力+忠诚)/政敌弹冠相庆·幂等·按 _imprisonedTurn/_exileTurn 近1回合。
// 手法:从 tm-endturn-helpers.js 花括号配平抽**真** _npcDisgraceRipple()·配桩实跑·非重新实现。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } }

const SRC = fs.readFileSync(path.join(ROOT, 'tm-endturn-helpers.js'), 'utf8');

// ── 花括号配平抽真函数 ──
const startIdx = SRC.indexOf('function _npcDisgraceRipple()');
let i = SRC.indexOf('{', startIdx), depth = 0, endIdx = -1;
for (; i < SRC.length; i++) { const ch = SRC[i]; if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { endIdx = i + 1; break; } } }
ok(endIdx > startIdx, '花括号配平定位函数体');
const fnSrc = SRC.slice(startIdx, endIdx);

function mkCtx(chars, affMap, turn) {
  const ctx = { Math: Math };
  ctx.GM = { chars: chars, turn: turn };
  ctx.findCharByName = function (n) { return chars.find(function (c) { return c.name === n; }) || null; };
  ctx.AffinityMap = { getRelations: function (name) { return (affMap[name] || []).slice().sort(function (x, y) { return Math.abs(y.value) - Math.abs(x.value); }); } };
  ctx.adjustCharacterLoyalty = function (ch, d, r, o) { ch.loyalty = (ch.loyalty == null ? 50 : ch.loyalty) + d; return { ok: true }; };
  ctx.NpcMemorySystem = { remember: function (who, ev, emo, imp) { const c = chars.find(function (x) { return x.name === who; }); if (c) { c._memory = c._memory || []; c._memory.push({ event: ev, emotion: emo, importance: imp }); } } };
  vm.createContext(ctx);
  vm.runInContext(fnSrc, ctx, { filename: 'disgrace.js' });
  return ctx;
}
function memOf(ctx, name) { const c = ctx.GM.chars.find(function (x) { return x.name === name; }); return (c && c._memory) || []; }

// ① 下狱:党羽株连之忧(惧+压力+忠诚-)
(function () {
  const chars = [
    { name: '权臣', alive: true, _imprisoned: true, _imprisonedTurn: 5 },
    { name: '心腹', alive: true, loyalty: 60, stress: 0 },  // value 70 → imp8/stress+10/-3
    { name: '门生', alive: true, loyalty: 60, stress: 0 }   // value 30 → imp6/stress+6/-2
  ];
  const aff = { '权臣': [{ name: '心腹', value: 70 }, { name: '门生', value: 30 }] };
  const ctx = mkCtx(chars, aff, 5);
  ctx._npcDisgraceRipple();
  const m1 = memOf(ctx, '心腹');
  ok(m1.length === 1 && m1[0].emotion === '惧' && m1[0].importance === 8, '① 心腹株连之忧 惧/imp8·实=' + JSON.stringify(m1[0]));
  ok(chars[1].stress === 10 && chars[1].loyalty === 57, '① 心腹 stress+10/忠诚-3·实=' + chars[1].stress + '/' + chars[1].loyalty);
  ok(memOf(ctx, '门生')[0].importance === 6 && chars[2].stress === 6 && chars[2].loyalty === 58, '① 门生 imp6/stress+6/忠诚-2');
  ok(m1[0].event.indexOf('系狱') >= 0, '① 记忆文案含「系狱」');
})();

// ② 下狱:政敌弹冠相庆(强敌则喜)·不动忠诚/压力
(function () {
  const chars = [{ name: '权臣', alive: true, _imprisoned: true, _imprisonedTurn: 5 }, { name: '政敌', alive: true, loyalty: 50, stress: 0 }];
  const aff = { '权臣': [{ name: '政敌', value: -70 }] };
  const ctx = mkCtx(chars, aff, 5);
  ctx._npcDisgraceRipple();
  const m = memOf(ctx, '政敌');
  ok(m.length === 1 && m[0].emotion === '喜' && m[0].event.indexOf('去一劲敌') >= 0, '② 政敌弹冠相庆 喜/去一劲敌·实=' + JSON.stringify(m[0]));
  ok(chars[1].loyalty === 50 && chars[1].stress === 0, '② 政敌反应不动忠诚/压力');
})();

// ③ 流放:用 _exileTurn 标记·党羽人人自危
(function () {
  const chars = [{ name: '直臣', alive: true, _exiled: true, _exileTurn: 8 }, { name: '同道', alive: true, loyalty: 60, stress: 0 }];
  const aff = { '直臣': [{ name: '同道', value: 65 }] };
  const ctx = mkCtx(chars, aff, 8);
  ctx._npcDisgraceRipple();
  const m = memOf(ctx, '同道');
  ok(m.length === 1 && m[0].emotion === '惧' && m[0].event.indexOf('谪戍') >= 0, '③ 流放(_exileTurn)党羽 惧/人人自危·实=' + JSON.stringify(m[0]));
})();

// ④ 存量在押者(旧 _imprisonedTurn)→不涟漪(避首上线刷屏)
(function () {
  const chars = [{ name: '陈年在押', alive: true, _imprisoned: true, _imprisonedTurn: 2 }, { name: '旧党', alive: true, loyalty: 50, stress: 0 }];
  const aff = { '陈年在押': [{ name: '旧党', value: 80 }] };
  const ctx = mkCtx(chars, aff, 20); // turn20 - imprisonedTurn2 = 18 > 1
  ctx._npcDisgraceRipple();
  ok(memOf(ctx, '旧党').length === 0 && chars[1].stress === 0, '④ 存量在押者不触发涟漪(差>1回合)');
})();

// ⑤ 幂等:两次只一次
(function () {
  const chars = [{ name: '甲', alive: true, _imprisoned: true, _imprisonedTurn: 7 }, { name: '党', alive: true, loyalty: 50, stress: 0 }];
  const aff = { '甲': [{ name: '党', value: 60 }] };
  const ctx = mkCtx(chars, aff, 7);
  ctx._npcDisgraceRipple();
  ctx._npcDisgraceRipple();
  ok(memOf(ctx, '党').length === 1 && chars[0]._imprisonReacted === true, '⑤ 幂等:两调一记 + _imprisonReacted 标记');
})();

// ⑥ 阈值 + top8 + 死/缺关系人跳过
(function () {
  const rels = [];
  const chars = [{ name: '巨头', alive: true, _imprisoned: true, _imprisonedTurn: 3 }];
  for (let k = 0; k < 12; k++) { rels.push({ name: 'B' + k, value: 90 - k }); chars.push({ name: 'B' + k, alive: true, loyalty: 50, stress: 0 }); }
  rels.push({ name: '微', value: 12 }); chars.push({ name: '微', alive: true, loyalty: 50, stress: 0 });
  const ctx = mkCtx(chars, { '巨头': rels }, 3);
  ctx._npcDisgraceRipple();
  const reacted = chars.filter(function (c) { return c._memory && c._memory.length; });
  ok(reacted.length === 8, '⑥ top8 封顶·实=' + reacted.length);
  ok(memOf(ctx, '微').length === 0, '⑥ |value|<25 不反应');
})();

// ⑦ AffinityMap 缺失 / 致仕(非下狱流放)→不反应·不抛错
(function () {
  let threw = false;
  try {
    const chars = [{ name: '退隐', alive: true, _retired: true }, { name: '友', alive: true, loyalty: 50 }];
    const ctx = mkCtx(chars, { '退隐': [{ name: '友', value: 80 }] }, 1);
    ctx._npcDisgraceRipple();
    ok(memOf(ctx, '友').length === 0, '⑦ 致仕(非下狱/流放)不触发涟漪');
  } catch (e) { threw = true; }
  ok(!threw, '⑦ 不抛错');
})();

console.log('[smoke-npc-disgrace-ripple] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);
