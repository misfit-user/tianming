#!/usr/bin/env node
// smoke-npc-death-ripple.js
// 验证「NPC 死亡涟漪」:至交哀恸(记忆+忠诚+心绪)/宿敌反应·幂等·按 deathTurn 近1回合·避开历史死者。
// 手法:从 tm-endturn-helpers.js 花括号配平抽**真** _npcDeathRipple()·配桩 GM/AffinityMap/记忆/忠诚 实跑·非重新实现。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } }

const SRC = fs.readFileSync(path.join(ROOT, 'tm-endturn-helpers.js'), 'utf8');

// ── 花括号配平抽真函数 ──
const startIdx = SRC.indexOf('function _npcDeathRipple()');
ok(startIdx >= 0, '定位函数起点');
let i = SRC.indexOf('{', startIdx), depth = 0, endIdx = -1;
for (; i < SRC.length; i++) { const ch = SRC[i]; if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { endIdx = i + 1; break; } } }
ok(endIdx > startIdx, '花括号配平定位函数终点');
const fnSrc = SRC.slice(startIdx, endIdx);

// ── 构造 ctx:真函数 + 桩 ──
function mkCtx(chars, affMap, turn) {
  const ctx = { Math: Math, console: { log() {}, warn() {}, error() {} } };
  ctx.GM = { chars: chars, turn: turn };
  ctx.findCharByName = function (n) { return chars.find(function (c) { return c.name === n; }) || null; };
  ctx.AffinityMap = { getRelations: function (name) { return (affMap[name] || []).slice().sort(function (x, y) { return Math.abs(y.value) - Math.abs(x.value); }); } };
  ctx._loyLog = [];
  ctx.adjustCharacterLoyalty = function (ch, d, r, o) { ch.loyalty = (ch.loyalty == null ? 50 : ch.loyalty) + d; ctx._loyLog.push({ who: ch.name, d: d, src: o && o.source }); return { ok: true }; };
  ctx.NpcMemorySystem = { remember: function (who, ev, emo, imp, sub) { const c = chars.find(function (x) { return x.name === who; }); if (c) { c._memory = c._memory || []; c._memory.push({ event: ev, emotion: emo, importance: imp }); } } };
  vm.createContext(ctx);
  vm.runInContext(fnSrc, ctx, { filename: 'ripple.js' });
  return ctx;
}
function memOf(ctx, name) { const c = ctx.GM.chars.find(function (x) { return x.name === name; }); return (c && c._memory) || []; }

// ① 至交哀恸:记忆(悲·imp≥6)+忠诚-+强tie心绪悲
(function () {
  const chars = [
    { name: '逝者', alive: false, deathTurn: 5 },
    { name: '挚交', alive: true, loyalty: 60 },   // value 70 → imp8/-3/mood悲
    { name: '故旧', alive: true, loyalty: 60 }     // value 30 → imp6/-2/no mood
  ];
  const aff = { '逝者': [{ name: '挚交', value: 70 }, { name: '故旧', value: 30 }] };
  const ctx = mkCtx(chars, aff, 5);
  ctx._npcDeathRipple();
  const m1 = memOf(ctx, '挚交');
  ok(m1.length === 1 && m1[0].emotion === '悲' && m1[0].importance === 8, '① 挚交哀恸记忆 悲/imp8·实=' + JSON.stringify(m1[0]));
  ok(chars[1].loyalty === 57, '① 挚交忠诚-3(痛失挚交)·实=' + chars[1].loyalty);
  ok(chars[1]._mood === '悲', '① 强纽带(≥50)心绪转悲');
  const m2 = memOf(ctx, '故旧');
  ok(m2.length === 1 && m2[0].importance === 6, '① 故旧哀恸记忆 imp6·实=' + (m2[0] || {}).importance);
  ok(chars[2].loyalty === 58, '① 故旧忠诚-2·实=' + chars[2].loyalty);
  ok(chars[2]._mood == null, '① 弱纽带(<50)不强改心绪');
})();

// ② 宿敌反应:强宿敌如释重负(喜)·无忠诚变化
(function () {
  const chars = [{ name: '逝者', alive: false, deathTurn: 5 }, { name: '宿敌', alive: true, loyalty: 50 }];
  const aff = { '逝者': [{ name: '宿敌', value: -70 }] };
  const ctx = mkCtx(chars, aff, 5);
  ctx._npcDeathRipple();
  const m = memOf(ctx, '宿敌');
  ok(m.length === 1 && m[0].emotion === '喜', '② 强宿敌(≤-50)之殁记忆 喜(如释重负)·实=' + (m[0] || {}).emotion);
  ok(chars[1].loyalty === 50 && ctx._loyLog.filter(function (x) { return x.who === '宿敌'; }).length === 0, '② 宿敌反应不动忠诚');
})();

// ③ 历史死者(无 deathTurn / 旧 deathTurn)→不涟漪(避免剧本开局/首上线刷屏)
(function () {
  const chars = [
    { name: '开局历史死者', alive: false },               // 无 deathTurn
    { name: '陈年旧死', alive: false, deathTurn: 1 },      // 旧(turn10·差9>1)
    { name: '亲友', alive: true, loyalty: 50 }
  ];
  const aff = { '开局历史死者': [{ name: '亲友', value: 80 }], '陈年旧死': [{ name: '亲友', value: 80 }] };
  const ctx = mkCtx(chars, aff, 10);
  ctx._npcDeathRipple();
  ok(memOf(ctx, '亲友').length === 0 && chars[2].loyalty === 50, '③ 历史死者/陈年旧死不触发涟漪·亲友无反应');
})();

// ④ 幂等:跑两次只涟漪一次
(function () {
  const chars = [{ name: '逝者', alive: false, deathTurn: 7 }, { name: '友', alive: true, loyalty: 50 }];
  const aff = { '逝者': [{ name: '友', value: 60 }] };
  const ctx = mkCtx(chars, aff, 7);
  ctx._npcDeathRipple();
  ctx._npcDeathRipple();
  ok(memOf(ctx, '友').length === 1, '④ 幂等:两次调用只记一条·实=' + memOf(ctx, '友').length);
  ok(chars[0]._deathReacted === true, '④ 死者标记 _deathReacted');
})();

// ⑤ 兼容 _deathTurn(下划线·AI 死亡路径)
(function () {
  const chars = [{ name: '逝者', alive: false, _deathTurn: 9 }, { name: '友', alive: true, loyalty: 50 }];
  const aff = { '逝者': [{ name: '友', value: 60 }] };
  const ctx = mkCtx(chars, aff, 9);
  ctx._npcDeathRipple();
  ok(memOf(ctx, '友').length === 1, '⑤ _deathTurn(下划线)也识别为新死·实=' + memOf(ctx, '友').length);
})();

// ⑥ 阈值:|value|<25 不反应；死/缺关系人跳过；top8 封顶
(function () {
  const rels = [];
  for (let k = 0; k < 12; k++) rels.push({ name: 'A' + k, value: 90 - k }); // 全≥25·12个
  rels.push({ name: '微', value: 10 });   // <25 滤
  rels.push({ name: '已殁', value: 80 }); // 关系人已死·跳过
  const chars = [{ name: '逝者', alive: false, deathTurn: 3 }, { name: '已殁', alive: false }];
  for (let k = 0; k < 12; k++) chars.push({ name: 'A' + k, alive: true, loyalty: 50 });
  chars.push({ name: '微', alive: true, loyalty: 50 });
  const ctx = mkCtx(chars, { '逝者': rels }, 3);
  ctx._npcDeathRipple();
  const reacted = chars.filter(function (c) { return c.name !== '逝者' && c._memory && c._memory.length; });
  ok(reacted.length === 8, '⑥ top8 封顶·实反应=' + reacted.length);
  ok(memOf(ctx, '微').length === 0, '⑥ |value|<25 不反应');
})();

// ⑦ AffinityMap 缺失→不抛错
(function () {
  let threw = false;
  try {
    const ctx = { Math: Math, GM: { chars: [{ name: '逝者', alive: false, deathTurn: 1 }], turn: 1 } };
    vm.createContext(ctx); vm.runInContext(fnSrc, ctx, { filename: 'r.js' });
    ctx._npcDeathRipple();
  } catch (e) { threw = true; }
  ok(!threw, '⑦ AffinityMap undefined 时静默跳过不抛错');
})();

console.log('[smoke-npc-death-ripple] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);
