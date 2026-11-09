#!/usr/bin/env node
'use strict';
// smoke-corruption-clique-formation — 腐败集团只认剧本给的与真人物结成的（11-10）。
//   原先某部门腐败连高满五年，每月 15% 从不分朝代的名单里抽一个「集团」（晚唐也能抽出和珅一脉），背后没有人。
//   验：长期高腐败、随机数恒为 0 也不凭空生成；剧本给的集团照旧逐月坐大，「历时」从剧本给的年数接着加。

const { createHarness, makeBaseGM, makeBaseP } = require('./smoke-corruption-harness');

let ASSERTS = 0;
function assert(cond, msg) {
  ASSERTS++;
  if (!cond) throw new Error('[assert] ' + msg);
}

const events = [];
const gm = makeBaseGM({ turn: 20 });
const h = createHarness({
  GM: gm,
  P: makeBaseP(),
  random: function() { return 0.0; }   // 原先的掷骰每次都会中
});
h.context.addEB = function(type, text) { events.push(text); };

h.loadMany(['tm-corruption-engine.js', 'tm-corruption-cases.js', 'tm-corruption-extras.js']);

const CE = h.context.CorruptionEngine;
CE.ensureModel();
assert(typeof CE.checkFactionFormation === 'function', 'checkFactionFormation stays callable');
assert(CE.FACTION_TEMPLATES === undefined, 'the cross-dynasty template table is gone');

['central', 'provincial', 'military', 'fiscal', 'judicial', 'imperial'].forEach(function(d) {
  gm.corruption.subDepts[d].true = 90;
});
// 旧档里留下的长期计数也不再起作用
gm._corrDeptLongTerm = { central: 80, provincial: 82, military: 78, fiscal: 75, judicial: 81, imperial: 77 };
gm.corruption.entrenchedFactions = [];
for (let i = 0; i < 24; i++) { gm.turn += 1; CE.checkFactionFormation({ _monthRatio: 1 }); }
assert(gm.corruption.entrenchedFactions.length === 0, 'two years of high corruption with every roll landing: no faceless clique is formed');
assert(!events.some(function(t) { return /盘根错节/.test(t); }), 'no "已成气候" event');

// 剧本给的集团：照旧逐月坐大，历时从剧本给的五年接着加
gm.corruption.entrenchedFactions = [{ name: '阉党', dept: 'imperial', strength: 92, years: 5, formedTurn: 1, status: 'active' }];
gm.corruption.subDepts.imperial.true = 70;
for (let i = 0; i < 12; i++) { gm.turn += 1; CE.checkFactionFormation({ _monthRatio: 1 }); }
const f = gm.corruption.entrenchedFactions[0];
assert(Math.abs(f.years - 6) < 1e-9, 'scenario clique keeps its five years and adds one per twelve months (got ' + f.years + ')');
assert(Math.abs(f.strength - 95.6) < 1e-9, 'scenario clique still strengthens 0.3 a month (got ' + f.strength + ')');
assert(gm.corruption.subDepts.imperial.true > 70, 'its department corruption still creeps up');
assert(gm.corruption.entrenchedFactions.length === 1, 'still only the scenario clique');

console.log('[smoke-corruption-clique-formation] pass assertions=' + ASSERTS);
