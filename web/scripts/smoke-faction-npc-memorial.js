#!/usr/bin/env node
// scripts/smoke-faction-npc-memorial.js — Phase C1·smoke
// 2026-05-10·验证 NPC memorial 生成/批决/副作用

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const SCN_DIR = path.resolve(ROOT, '..', 'scenarios');

function fail(msg) { throw new Error(msg); }
function assert(cond, msg) { if (!cond) fail(msg); }

function buildContext() {
  var ctx = { console: { log: function(){}, warn: function(){} },
    Math: Math, Date: Date, JSON: JSON, Object: Object, Array: Array,
    Number: Number, String: String, Boolean: Boolean, RegExp: RegExp,
    isFinite: isFinite, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, Set: Set };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-faction-paradigm.js'), 'utf8'), ctx, { filename: 'tm-faction-paradigm.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-faction-personality.js'), 'utf8'), ctx, { filename: 'tm-faction-personality.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-faction-index.js'), 'utf8'), ctx, { filename: 'tm-faction-index.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-faction-derived-health.js'), 'utf8'), ctx, { filename: 'tm-faction-derived-health.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-faction-membership.js'), 'utf8'), ctx, { filename: 'tm-faction-membership.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-faction-derived-economy.js'), 'utf8'), ctx, { filename: 'tm-faction-derived-economy.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-faction-derived-cohesion.js'), 'utf8'), ctx, { filename: 'tm-faction-derived-cohesion.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-faction-derived-strength.js'), 'utf8'), ctx, { filename: 'tm-faction-derived-strength.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-faction-npc-memorial.js'), 'utf8'), ctx, { filename: 'tm-faction-npc-memorial.js' });
  return ctx;
}

function loadScenarioToGM(ctx, sc) {
  ctx.GM = {
    turn: 1,
    facs: (sc.factions || []).map(function(f){ return Object.assign({}, f); }),
    chars: (sc.characters || []).map(function(c){ return Object.assign({}, c, { alive: c.alive !== false }); }),
    armies: (sc.military && sc.military.initialTroops || []).map(function(a){ return Object.assign({}, a); }),
    parties: (sc.parties || []).map(function(p){ return Object.assign({}, p); }),
    factionRelations: sc.factionRelations || [],
    _provinceToFaction: {}, provinceStats: {}
  };
  ctx.P = { playerInfo: sc.playerInfo || {} };
  ctx.getFactionProvinces = function(n) {
    var f = ctx.GM.facs.find(function(x){ return x.name === n; });
    if (!f) return [];
    if (Array.isArray(f.territories)) return f.territories.slice();
    if (typeof f.territory === 'string') return [f.territory];
    if (Array.isArray(f.territory)) return f.territory.slice();
    return [];
  };
  ctx.TM.FactionMembership.migrateArmyOwnerToFaction();
  ctx.TM.FactionMembership.migrateCharsAddFactionId();
  ctx.TM.FactionMembership.migrateProvinceOwnership();
  ctx.TM.FactionIndex.rebuild();
  ctx.TM.FactionDerived.compute();
  ctx.TM.FactionDerivedEconomy.compute();
  ctx.TM.FactionDerivedCohesion.compute();
  ctx.TM.FactionDerivedStrength.compute();
}

function unitTests() {
  var ctx = buildContext();
  var fnm = ctx.TM.FactionNpcMemorial;
  assert(typeof fnm.generate === 'function', 'generate missing');
  assert(typeof fnm.resolve === 'function', 'resolve missing');
  assert(typeof fnm.getFor === 'function', 'getFor missing');

  // _classifyChar
  assert(fnm._classifyChar({ position: '皇帝' }) === 'ruler', 'ruler classify');
  assert(fnm._classifyChar({ position: '兵部尚书' }) === 'court', 'court classify');
  assert(fnm._classifyChar({ position: '总兵' }) === 'general', 'general classify');
  assert(fnm._classifyChar({ position: '亲王' }) === 'clan', 'clan classify');

  // _pickType returns valid type
  var t = fnm._pickType('court', { derivedHealth: { courtCohesion: 50 } });
  assert(['军务','政务','民生','经济','人事','密奏'].indexOf(t) >= 0, 'pickType returns valid·got ' + t);

  // _genContent returns string
  var c = fnm._genContent('政务', { name: '某臣', loyalty: 60 }, {});
  assert(typeof c === 'string' && c.length > 10, 'genContent string·got ' + c);

  // _rulerDecide
  var ruler = { name: 'R', party: '阉党' };
  var char = { name: 'C', party: '阉党', loyalty: 80 };
  var dec = fnm._rulerDecide(ruler, { type: '政务', turn: 1 }, char, { derivedHealth: {}, derivedEconomy: {} });
  assert(['approved','rejected','annotated','referred'].indexOf(dec.status) >= 0, 'decide returns valid status·got ' + dec.status);
  assert(typeof dec.loyaltyDelta === 'number', 'has loyaltyDelta');
  assert(typeof dec.ruling === 'string', 'has ruling');

  console.log('[smoke-faction-npc-memorial] unit tests pass·11 assertions');
}

function e2eTianqi() {
  const {official,documentLoop}=require('./lib-political-official-fixture'),ctx=official('天启');
  const originalCash=ctx.GM.facs.map(f=>f.treasury&&f.treasury.money),originalLoyalty=ctx.GM.chars.map(c=>c.loyalty);
  const {actor,target,org,plan,candidate,receipt}=documentLoop(ctx,'memorial');
  assert(plan.status==='done'&&candidate.status==='done','real request, response, document and feedback reach completion');
  assert(plan.steps.length===1,'one actual document delivery');
  assert(org.npcMemorials[0].planId===plan.id&&org.npcMemorials[0].sourceActionId===receipt.actionId,'faction view links canonical dialogue');
  assert(actor._memory.some(m=>(m.sourceRefs||[]).some(r=>r.planId===plan.id)),'sender retains its experience');
  assert(target._memory.some(m=>(m.sourceRefs||[]).some(r=>r.planId===plan.id)),'recipient retains its experience');
  assert(JSON.stringify(originalCash)===JSON.stringify(ctx.GM.facs.map(f=>f.treasury&&f.treasury.money)),'document is not a direct money change');
  assert(JSON.stringify(originalLoyalty)===JSON.stringify(ctx.GM.chars.map(c=>c.loyalty)),'no template loyalty reward');
  assert(ctx.GM.memorials.length===0,'NPC document to another NPC does not route into the player inbox');
  const count=ctx.GM._npcPlans.length;ctx.GM.turn++;ctx.TM.FactionNpcMemorial.generate();assert(ctx.GM._npcPlans.some(p=>p.id===plan.id),'closed history is retained after the next generation');
  console.log('[e2e] official memorial dialogue '+plan.id+' complete; models=0');
}

function main() {
  unitTests();
  e2eTianqi();
  console.log('[smoke-faction-npc-memorial] all pass');
}

try { main(); }
catch (e) {
  console.error('[smoke-faction-npc-memorial] fail:', (e && e.message) || e);
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 6).join('\n'));
  process.exit(1);
}
