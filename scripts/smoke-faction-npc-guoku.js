#!/usr/bin/env node
// scripts/smoke-faction-npc-guoku.js — Phase C5·smoke

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
  ['tm-faction-paradigm.js','tm-faction-index.js','tm-faction-derived-health.js','tm-faction-membership.js',
   'tm-faction-derived-economy.js','tm-faction-derived-cohesion.js','tm-faction-derived-strength.js',
   'tm-faction-npc-memorial.js','tm-faction-npc-edict.js','tm-faction-npc-chaoyi.js',
   'tm-faction-npc-office.js','tm-faction-npc-guoku.js'].forEach(function(f){
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
  var fng = ctx.TM.FactionNpcGuoku;
  assert(typeof fng.generate === 'function', 'generate missing');
  assert(typeof fng._runFiscalCycle === 'function', '_runFiscalCycle missing');

  // 黑账·应触发 crisis
  var fac1 = {
    name: 'X',
    derivedEconomy: { annualTaxIncome: 12000, annualMilitaryCost: 60000 },
    treasury: { money: 1000 }
  };
  var rec = fng._runFiscalCycle(fac1);
  assert(rec.monthlyIncome === 1000, 'monthly income');
  assert(rec.monthlyExpense === 5000, 'monthly expense');
  assert(rec.net === -4000, 'net');
  assert(rec.crisis === true, 'should crisis (treasury would go negative)');
  assert(fac1.treasury.money === 0, 'treasury clamped 0');
  assert(fac1._fiscalDebt > 0, 'debt accumulated');

  // 黑账继续累加
  fng._runFiscalCycle(fac1);
  assert(fac1._fiscalDebt > 3000, 'debt grows');

  // 健康·盈余
  var fac2 = {
    name: 'Y',
    derivedEconomy: { annualTaxIncome: 1200000, annualMilitaryCost: 240000 },
    treasury: { money: 500000 }
  };
  var rec2 = fng._runFiscalCycle(fac2);
  assert(rec2.crisis === false, 'no crisis');
  assert(fac2.treasury.money > 500000, 'treasury grows');

  // 剧本回合跨度：90 天回合应按 3 个月结算，不再固定 1 个月。
  ctx._getDaysPerTurn = function(){ return 90; };
  var fac3 = {
    name: 'Z',
    derivedEconomy: { annualTaxIncome: 12000, annualMilitaryCost: 24000 },
    treasury: { money: 100000 }
  };
  var rec3 = fng._runFiscalCycle(fac3);
  assert(rec3.daysPerTurn === 90, 'daysPerTurn captured');
  assert(rec3.monthRatio === 3, 'monthRatio should be 3 for 90 days');
  assert(rec3.monthlyIncome === 3000, '90-day income should be 3 monthly incomes');
  assert(rec3.monthlyExpense === 6000, '90-day expense should be 3 monthly expenses');

  console.log('[smoke-faction-npc-guoku] unit tests pass·13 assertions');
}

function e2eTianqi() {
  var ctx = buildContext();
  var sc = JSON.parse(fs.readFileSync(path.join(SCN_DIR, '天启七年·九月（官方）.json'), 'utf8'));
  loadScenarioToGM(ctx, sc);

  var ret = ctx.TM.FactionNpcGuoku.generate();
  console.log('[e2e] NPC 财政周期 run:', ret.run);

  console.log('\n[e2e] NPC 财政:');
  ctx.GM.facs.forEach(function(f){
    if (f.name === sc.playerInfo.factionName) return;
    if (Array.isArray(f.npcFiscalLedger) && f.npcFiscalLedger.length > 0) {
      var last = f.npcFiscalLedger[f.npcFiscalLedger.length - 1];
      var crisisTag = last.crisis ? ' ⚠危' : '';
      console.log('  ' + f.name.padEnd(28) + ' 月入' + last.monthlyIncome.toString().padStart(8) + ' 月支' + last.monthlyExpense.toString().padStart(8) + ' net' + (last.net >= 0 ? '+' : '') + last.net.toString().padStart(7) + ' → 库' + last.treasuryAfter + crisisTag);
    }
  });

  // multi-turn·跑 12 个月看会不会累 1 年
  for (var t = 2; t <= 12; t++) { ctx.GM.turn = t; ctx.TM.FactionNpcGuoku.generate(); }
  var hj = ctx.GM.facs.find(function(f){ return f.name === '后金'; });
  console.log('\n[e2e] 后金 12 月后:');
  console.log('  treasury.money: ' + hj.treasury.money);
  console.log('  ledger entries: ' + hj.npcFiscalLedger.length);

  console.log('[e2e] tianqi assertions pass');
}

function main() {
  unitTests();
  e2eTianqi();
  console.log('[smoke-faction-npc-guoku] all pass');
}

try { main(); }
catch (e) {
  console.error('[smoke-faction-npc-guoku] fail:', (e && e.message) || e);
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 6).join('\n'));
  process.exit(1);
}
