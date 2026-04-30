#!/usr/bin/env node
// scripts/official-scenario-smoke.js
//
// Guard the official Tianqi scenario startup chain:
// adminHierarchy -> economy gap fill -> region enrich -> fiscal settlement -> bridge aggregate.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DESKTOP_SCENARIOS = path.resolve(ROOT, '..', 'scenarios');
const BUILTIN_SCENARIO_JS = path.resolve(ROOT, 'scenarios', 'tianqi7-1627.js');
const SID = 'sc-tianqi7-1627';

function fail(msg) {
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

function loadOfficialScenario() {
  if (!process.env.TM_OFFICIAL_SMOKE_SKIP_DESKTOP && fs.existsSync(DESKTOP_SCENARIOS)) {
    const files = fs.readdirSync(DESKTOP_SCENARIOS).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const abs = path.join(DESKTOP_SCENARIOS, file);
      try {
        const data = JSON.parse(fs.readFileSync(abs, 'utf8'));
        if (data && data.id === SID) return { scenario: data, source: abs };
      } catch (_) {}
    }
  }

  if (fs.existsSync(BUILTIN_SCENARIO_JS)) {
    const oldP = global.P;
    const oldDocument = global.document;
    const oldLog = console.log;
    try {
      global.P = {
        scenarios: [],
        scripts: [],
        characters: [],
        factions: [],
        parties: [],
        classes: [],
        variables: [],
        events: [],
        relations: [],
        rules: [],
        worldview: [],
        items: [],
        rigidHistoryEvents: []
      };
      global.document = { readyState: 'complete' };
      console.log = function () {};
      delete require.cache[require.resolve(BUILTIN_SCENARIO_JS)];
      require(BUILTIN_SCENARIO_JS);
      const sc = global.P.scenarios.find((s) => s && s.id === SID);
      if (sc) {
        sc.characters = global.P.characters.filter((x) => x && x.sid === SID);
        sc.factions = global.P.factions.filter((x) => x && x.sid === SID);
        sc.parties = global.P.parties.filter((x) => x && x.sid === SID);
        sc.classes = global.P.classes.filter((x) => x && x.sid === SID);
        sc.variables = global.P.variables.filter((x) => x && x.sid === SID);
        sc.events = global.P.events.filter((x) => x && x.sid === SID);
        sc.relations = global.P.relations.filter((x) => x && x.sid === SID);
        sc.items = global.P.items.filter((x) => x && x.sid === SID);
        sc.rigidHistoryEvents = global.P.rigidHistoryEvents.filter((x) => x && x.sid === SID);
        return { scenario: sc, source: BUILTIN_SCENARIO_JS };
      }
    } finally {
      console.log = oldLog;
      global.P = oldP;
      global.document = oldDocument;
    }
  }

  fail('official scenario not found in desktop JSON or built-in JS: ' + SID);
}

function makeContext(sc) {
  const logs = [];
  const ctx = {
    console: {
      log: (...a) => logs.push(['log', a.join(' ')]),
      warn: (...a) => logs.push(['warn', a.join(' ')]),
      error: (...a) => logs.push(['error', a.join(' ')])
    },
    setTimeout,
    clearTimeout,
    Math,
    Date,
    JSON,
    Object,
    Array,
    Number,
    String,
    Boolean,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    logs
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  ctx.TM = {
    errors: {
      capture(e, tag) { logs.push(['capture', (tag || '') + ':' + (e && e.message || e)]); },
      captureSilent(e, tag) { logs.push(['silent', (tag || '') + ':' + (e && e.message || e)]); }
    }
  };
  ctx.addEB = function () {};
  ctx.toast = function () {};
  ctx._getDaysPerTurn = function () { return 30; };
  ctx.findScenarioById = function (id) { return id === SID ? sc : null; };
  ctx.CurrencyUnit = { getUnit: function () { return { money: 'liang', grain: 'shi', cloth: 'bolt' }; } };

  ctx.P = {
    scenarios: [sc],
    adminHierarchy: clone(sc.adminHierarchy || {}),
    fiscalConfig: clone(sc.fiscalConfig || {}),
    populationConfig: clone(sc.populationConfig || {}),
    military: clone(sc.military || {}),
    map: clone(sc.map || sc.mapData || { enabled: false, regions: [] })
  };
  ctx.GM = {
    sid: SID,
    running: true,
    turn: 1,
    month: sc.startMonth || 9,
    year: sc.startYear || 1627,
    chars: clone(sc.characters || []),
    facs: clone(sc.factions || []),
    officeTree: clone(sc.officeTree || []),
    adminHierarchy: clone(sc.adminHierarchy || {}),
    fiscalConfig: clone(sc.fiscalConfig || {}),
    populationConfig: clone(sc.populationConfig || {}),
    military: clone(sc.military || {}),
    turnChanges: { variables: [] },
    guoku: { balance: 0, money: 0, grain: 0, cloth: 0 },
    neitang: { balance: 0, money: 0, grain: 0, cloth: 0 },
    minxin: { trueIndex: 60, byRegion: {} },
    corruption: { overall: 30 },
    population: {}
  };
  return vm.createContext(ctx);
}

function runFile(ctx, rel) {
  const abs = path.join(ROOT, rel);
  const code = fs.readFileSync(abs, 'utf8');
  vm.runInContext(code, ctx, { filename: rel });
}

function main() {
  const loaded = loadOfficialScenario();
  const sc = loaded.scenario;
  const ctx = makeContext(sc);

  [
    'tm-guoku-engine.js',
    'tm-neitang-engine.js',
    'tm-economy-gap-fill.js',
    'tm-region-enrich.js',
    'tm-integration-bridge.js',
    'tm-fiscal-cascade.js',
    'tm-fiscal-fixed-expense.js'
  ].forEach((rel) => runFile(ctx, rel));

  assert(ctx.IntegrationBridge, 'IntegrationBridge missing');
  assert(ctx.EconomyGapFill, 'EconomyGapFill missing');
  assert(ctx.PhaseB, 'PhaseB missing');
  assert(ctx.CascadeTax, 'CascadeTax missing');
  assert(ctx.FixedExpense, 'FixedExpense missing');

  const top = ctx.IntegrationBridge.getTopLevelDivisions(ctx.GM.adminHierarchy, 'player');
  assert(Array.isArray(top), 'top-level divisions is not array');
  assert(top.length === 17, 'expected 17 official top divisions, got ' + top.length);

  const flat = ctx.IntegrationBridge.flattenDivisions(ctx.GM.adminHierarchy);
  assert(flat.length >= 17, 'flattenDivisions returned too few nodes: ' + flat.length);

  const built = ctx.EconomyGapFill.buildHierarchyFromAdminDepth(sc);
  assert(built && built.byId && Object.keys(built.byId).length >= 17, 'EconomyGapFill hierarchy build failed');

  ctx.IntegrationBridge.init();
  assert(ctx.GM.population && ctx.GM.population.national, 'bridge did not create population.national');
  assert(ctx.GM.fiscal && ctx.GM.fiscal.regions, 'bridge did not create fiscal.regions');
  assert(Object.keys(ctx.GM.fiscal.regions).length >= 17, 'fiscal.regions has too few entries');

  ctx.PhaseB.init(sc);
  assert(ctx.GM.population && ctx.GM.population.travelDocs, 'PhaseB did not create population.travelDocs');

  const cascade = ctx.CascadeTax.collect({ monthRatio: 1 });
  assert(cascade && cascade.ok, 'CascadeTax.collect failed: ' + JSON.stringify(cascade));
  assert(ctx.GM.guoku && ctx.GM.guoku.ledgers && ctx.GM.guoku.ledgers.money, 'CascadeTax did not create guoku money ledger');

  const fixed = ctx.FixedExpense.collect({ monthRatio: 1 });
  assert(fixed && fixed.ok, 'FixedExpense.collect failed: ' + JSON.stringify(fixed));

  ctx.IntegrationBridge.aggregateRegionsToVariables();
  assert(typeof ctx.GM.guoku.turnIncome === 'number', 'guoku.turnIncome missing after settlement');

  console.log('[official-scenario-smoke] pass source=' + path.relative(path.resolve(ROOT, '..'), loaded.source));
  console.log('[official-scenario-smoke] divisions=' + top.length +
    ' fiscalRegions=' + Object.keys(ctx.GM.fiscal.regions).length +
    ' turnIncome=' + Math.round(ctx.GM.guoku.turnIncome || 0) +
    ' turnExpense=' + Math.round(ctx.GM.guoku.turnExpense || 0));
}

try {
  main();
} catch (e) {
  console.error('[official-scenario-smoke] fail: ' + (e && e.message || e));
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 5).join('\n'));
  process.exit(1);
}
