#!/usr/bin/env node
// smoke-corruption-no-dice-backlash.js - corruption "backlash" is no longer rolled by code (11-09).
// The four rolls (entrenched clique attacks the upright, secret police turns on the court, harsh-official purge,
// party-feud purge) named no one and moved huangquan/huangwei/minxin by dice. Even with every die landing,
// a corruption tick must not produce them; such acts belong to real people on the roster.
'use strict';

const { createHarness, makeBaseGM, makeBaseP } = require('./smoke-corruption-harness');

let ASSERTS = 0;
function assert(cond, msg) {
  ASSERTS++;
  if (!cond) throw new Error('[assert] ' + msg);
}

const events = [];
const gm = makeBaseGM({
  turn: 120,
  huangquan: { index: 62 },
  huangwei: { index: 66 },
  minxin: { trueIndex: 64 },
  chars: [{ name: '杨涟', alive: true, integrity: 90 }, { name: '左光斗', alive: true, integrity: 85 }],
  mapData: { cities: { beijing: {} }, state: { showCorruption: true }, polygons: {} }
});
const h = createHarness({
  GM: gm,
  P: makeBaseP(),
  random: function() { return 0; }   // every former roll would land
});
h.context.addEB = function(type, text) { events.push({ type, text }); };

h.load('tm-corruption-engine.js');
h.load('tm-corruption-cases.js');
h.load('tm-corruption-extras.js');

const CE = h.context.CorruptionEngine;
assert(CE && typeof CE.checkBacklash === 'function', 'checkBacklash stays callable');

CE.initFromDynasty('明', 'decline', {
  corruption: {
    trueIndex: 80,
    subDepts: { central: { true: 88 }, provincial: { true: 73 }, military: { true: 61 }, fiscal: { true: 77 }, judicial: { true: 69 }, imperial: { true: 72 } },
    supervision: { level: 33 }
  }
});
const c = gm.corruption;
c.entrenchedFactions = [{ id: 'yandang', name: '阉党', dept: 'imperial', strength: 95, status: 'active', formedTurn: 1 }];
c.supervision.institutions = (c.supervision.institutions || []).concat([{ name: '东厂', corruption: 90 }, { name: '锦衣卫', corruption: 85 }]);
c.countermeasures = Object.assign(c.countermeasures || {}, { harshPunishment: 0.9, factionFeud: 0.9 });
gm._corrBacklashCounters = { harshAccum: 100, factionFeudAccum: 100, secretPoliceAccum: 100, purgeHistory: 0 };

const before = JSON.stringify({ hq: gm.huangquan.index, hw: gm.huangwei.index, mx: gm.minxin.trueIndex, retired: gm.chars.map(x => !!x.retired), clique: c.entrenchedFactions[0].strength });
for (let i = 0; i < 24; i++) {
  gm.turn += 1;
  CE.checkBacklash({ _monthRatio: 1 });
}
const after = JSON.stringify({ hq: gm.huangquan.index, hw: gm.huangwei.index, mx: gm.minxin.trueIndex, retired: gm.chars.map(x => !!x.retired), clique: c.entrenchedFactions[0].strength });
assert(after === before, 'no authority, minxin, retirement or clique change from dice: ' + before + ' -> ' + after);
assert(!events.some(e => /攻讦朝中正直|厂卫欺君|来俊臣|党祸|挂冠/.test(e.text)), 'no faceless backlash events: ' + events.map(e => e.text).join('|'));
assert(!(c.history && Array.isArray(c.history.backlash) && c.history.backlash.length), 'no backlash rows recorded');

// The full tick still runs (it calls checkBacklash among its phases).
CE.tick({ _monthRatio: 1 });
assert(!events.some(e => /攻讦朝中正直|厂卫欺君|来俊臣|党祸|挂冠/.test(e.text)), 'tick does not raise them either');

console.log('[smoke-corruption-no-dice-backlash] pass assertions=' + ASSERTS);
