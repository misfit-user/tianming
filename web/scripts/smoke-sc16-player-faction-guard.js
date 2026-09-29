#!/usr/bin/env node
// Regression smoke: SC16 faction simulation must never make the player faction act autonomously.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const ctx = {
  console: { log() {}, warn() {} },
  Math,
  Date,
  JSON,
  Object,
  Array,
  Number,
  String,
  Boolean,
  RegExp,
  isFinite,
  parseInt,
  parseFloat,
  isNaN,
  Set,
  Promise
};
ctx.window = ctx;
ctx.global = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

// 第十九拆：followup 顶层 helper+ns 导出迁 tm-endturn-followup-helpers.js·须在 origin 之前载入同一 context(填 bucket+ns 导出)
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-followup-helpers.js'), 'utf8'), ctx, {
  filename: 'tm-endturn-followup-helpers.js'
});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-followup.js'), 'utf8'), ctx, {
  filename: 'tm-endturn-followup.js'
});

const followup = ctx.TM && ctx.TM.Endturn && ctx.TM.Endturn.AI && ctx.TM.Endturn.AI.followup;
assert(followup, 'followup export missing');
assert(typeof followup._resolvePlayerFactionNameForAi === 'function', 'SC16 player faction resolver missing');
assert(typeof followup._isPlayerFactionForAi === 'function', 'SC16 player faction predicate missing');
assert(typeof followup._filterSc16PlayerOutputs === 'function', 'SC16 output filter missing');

const G = {
  playerFaction: 'MingCourt',
  facs: [
    { name: 'MingCourt' },
    { name: 'LaterJin' }
  ],
  chars: []
};
assert(followup._resolvePlayerFactionNameForAi(G, { playerInfo: {} }) === 'MingCourt', 'resolver must fall back to GM.playerFaction');
assert(followup._isPlayerFactionForAi({ name: 'MingCourt' }, 'MingCourt'), 'predicate must match the resolved player faction name');
assert(!followup._isPlayerFactionForAi({ name: 'LaterJin' }, 'MingCourt'), 'predicate must leave NPC factions alone');

let p16 = {
  faction_actions: [
    { faction: 'MingCourt', action: 'player should not auto-act' },
    { faction: 'LaterJin', action: 'npc can act' }
  ],
  diplomatic_shifts: [
    { from: 'MingCourt', to: 'LaterJin', new_relation: 'hostile' },
    { from: 'LaterJin', to: 'MingCourt', new_relation: 'hostile' }
  ]
};
p16 = followup._filterSc16PlayerOutputs(p16, 'MingCourt');
assert(p16.faction_actions.length === 1 && p16.faction_actions[0].faction === 'LaterJin', 'filter must remove player faction actions');
assert(p16.diplomatic_shifts.length === 1 && p16.diplomatic_shifts[0].from === 'LaterJin', 'filter must remove player-origin diplomacy but keep NPC-to-player diplomacy');
assert(p16._playerFactionGuard && p16._playerFactionGuard.removedFactionActions === 1, 'filter should report removed player actions');
assert(p16._playerFactionGuard.removedDiplomaticShifts === 1, 'filter should report removed player diplomacy');

const src = fs.readFileSync(path.join(ROOT, 'tm-endturn-followup.js'), 'utf8');
const c=require('./lib-political-action-fixture').politicalFixture();c.a.isPlayer=true;c.GM.playerInfo={characterId:'a',factionId:'fa'};c.fa.isPlayer=true;
c.fa.officeTree[0].positions.push({id:'other-official',name:'本国另一官员',holderId:'l',powers:{diplomacy:true}});
const B=c.TM.PoliticalActions,ids=B.strategicCandidates({faction_actions:[{factionId:'fa',action:'评估与乙国交涉',targetId:'fb'}]},'sc16-player-country');
assert(ids.length===1&&c.GM._npcPlans.find(p=>p.id===ids[0]).actorId==='l','player country can route an optional suggestion to another actual official');
assert(!c.GM._npcPlans.some(p=>p.actorId==='a')&&!c.a._lastNpcExecution,'the actual player is never assigned consent or a command by NPC planning');
assert(!(c.GM.treaties||[]).length,'a strategic suggestion has not made a political result');

console.log('[smoke-sc16-player-faction-guard] all assertions pass');
