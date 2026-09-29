#!/usr/bin/env node
// scripts/smoke-faction-npc-edict.js — Phase C2·smoke
// 2026-05-10·验证 NPC edict 生成 + 副作用 + 决策树

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
  ['tm-faction-paradigm.js','tm-faction-personality.js','tm-faction-index.js','tm-faction-derived-health.js','tm-faction-membership.js',
   'tm-faction-derived-economy.js','tm-faction-derived-cohesion.js','tm-faction-derived-strength.js',
   'tm-faction-npc-memorial.js','tm-faction-npc-edict.js'].forEach(function(f){
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  });
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
  var fne = ctx.TM.FactionNpcEdict;
  assert(typeof fne.generate === 'function', 'generate missing');
  assert(typeof fne.getFor === 'function', 'getFor missing');

  // 决策树测试
  var fac1 = { derivedEconomy: { fiscalStress: 70 }, derivedHealth: {}, derivedCohesion: {} };
  var t1 = fne._decideType(fac1);
  assert(t1 === '催征' || t1 === '减俸', '财政危 → 催征/减俸·got ' + t1);

  var fac2 = { derivedEconomy: { fiscalStress: 0 }, derivedHealth: { militaryStability: 25 }, derivedCohesion: {} };
  var t2 = fne._decideType(fac2);
  assert(t2 === '补饷' || t2 === '整军', '军权弱 → 补饷/整军·got ' + t2);

  var fac3 = { derivedEconomy: { fiscalStress: 0 }, derivedHealth: { militaryStability: 80, courtCohesion: 30 }, derivedCohesion: {} };
  var t3 = fne._decideType(fac3);
  assert(t3 === '安抚' || t3 === '罢党争', '朝堂裂 → 安抚/罢党争·got ' + t3);

  // 模板存在
  ['催征','减俸','补饷','整军','安抚','罢党争','怀柔','赏赐','巡抚','经略'].forEach(function(t){
    assert(fne._templates[t], 'template ' + t + ' missing');
    assert(typeof fne._templates[t].content === 'string', t + ' content string');
    assert(fne._templates[t].effects, t + ' effects');
  });

  console.log('[smoke-faction-npc-edict] unit tests pass·15 assertions');
}

function e2eTianqi() {
  const {official,documentLoop}=require('./lib-political-official-fixture'),ctx=official('天启');
  const originalCash=ctx.GM.facs.map(f=>f.treasury&&f.treasury.money),originalLoyalty=ctx.GM.chars.map(c=>c.loyalty);
  const {actor,target,org,plan,candidate,receipt}=documentLoop(ctx,'edict');
  assert(plan.status==='done'&&candidate.status==='done','real request, response, document and feedback reach completion');
  assert(plan.steps.length===1,'one actual document delivery');
  assert(org.npcEdicts[0].planId===plan.id&&org.npcEdicts[0].sourceActionId===receipt.actionId,'faction view links canonical dialogue');
  assert(actor._memory.some(m=>(m.sourceRefs||[]).some(r=>r.planId===plan.id)),'sender retains its experience');
  assert(target._memory.some(m=>(m.sourceRefs||[]).some(r=>r.planId===plan.id)),'recipient retains its experience');
  assert(JSON.stringify(originalCash)===JSON.stringify(ctx.GM.facs.map(f=>f.treasury&&f.treasury.money)),'document is not a direct money change');
  assert(JSON.stringify(originalLoyalty)===JSON.stringify(ctx.GM.chars.map(c=>c.loyalty)),'no template loyalty reward');
  assert(ctx.GM.memorials.length===0,'NPC document to another NPC does not route into the player inbox');
  const count=ctx.GM._npcPlans.length;ctx.GM.turn++;ctx.TM.FactionNpcEdict.generate();assert(ctx.GM._npcPlans.some(p=>p.id===plan.id),'closed history is retained after the next generation');
  console.log('[e2e] official edict dialogue '+plan.id+' complete; models=0');
}

function main() {
  unitTests();
  e2eTianqi();
  console.log('[smoke-faction-npc-edict] all pass');
}

try { main(); }
catch (e) {
  console.error('[smoke-faction-npc-edict] fail:', (e && e.message) || e);
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 6).join('\n'));
  process.exit(1);
}
