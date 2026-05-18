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

function assertFactionConsistency(sc) {
  const factionNames = new Set((sc.factions || []).map((f) => f && f.name).filter(Boolean));
  assert(factionNames.has('科尔沁蒙古'), 'official scenario missing 科尔沁蒙古 faction card');

  const missingCharFaction = (sc.characters || [])
    .filter((c) => c && c.faction && !factionNames.has(c.faction))
    .map((c) => c.name + ':' + c.faction);
  assert(missingCharFaction.length === 0, 'characters reference missing factions: ' + missingCharFaction.join(', '));

  const badRelations = (sc.factionRelations || [])
    .filter((r) => r && (!factionNames.has(r.from) || !factionNames.has(r.to)))
    .map((r) => r.from + '->' + r.to);
  assert(badRelations.length === 0, 'factionRelations reference missing factions: ' + badRelations.join(', '));

  const adminByFaction = new Set(Object.values(sc.adminHierarchy || {})
    .map((ah) => ah && ah.factionName)
    .filter(Boolean));
  const missingAdmin = Array.from(factionNames).filter((name) => !adminByFaction.has(name));
  assert(missingAdmin.length === 0, 'factions missing province-level adminHierarchy: ' + missingAdmin.join(', '));
}

function assertHoujinCharacterExpansion(sc) {
  const houjinNames = new Set((sc.characters || [])
    .filter((c) => c && c.faction === '后金')
    .map((c) => c.name)
    .filter(Boolean));

  [
    '莽古尔泰',
    '济尔哈朗',
    '阿济格',
    '多铎',
    '佟养性',
    '李永芳'
  ].forEach((name) => {
    assert(houjinNames.has(name), 'official scenario missing Later Jin expanded character: ' + name);
  });

  assert(houjinNames.size >= 11, 'expected at least 11 Later Jin characters after expansion, got ' + houjinNames.size);
}

function assertTianqiClassPopulationAndCao(sc) {
  const chars = new Map((sc.characters || []).map((c) => [c && c.name, c]));
  ['曹文诏', '曹变蛟'].forEach((name) => {
    const ch = chars.get(name);
    assert(ch, 'official scenario missing expanded Cao character: ' + name);
    assert(ch.faction === '明朝廷', name + ' should belong to 明朝廷');
    assert(ch.portrait && ch.portrait.indexOf('assets/portraits/tianqi7/') === 0, name + ' missing tianqi portrait');
    assert(ch.aiPersonaText && ch.innerThought && ch.bio, name + ' missing detailed persona fields');
  });

  const cwz = chars.get('曹文诏');
  const cbj = chars.get('曹变蛟');
  assert(cwz.valor >= 90 && cwz.military >= 80, '曹文诏 should be elite military talent');
  assert(cbj.valor >= 85 && cbj.military >= 75, '曹变蛟 should be high-potential military talent');

  const suspicious = (sc.classes || [])
    .filter((cls) => cls && (typeof cls.populationShare !== 'number' || cls.populationShare <= 0 || cls.populationShare >= 0.5))
    .map((cls) => cls.name + ':' + cls.populationShare);
  assert(suspicious.length === 0, 'class populationShare should be explicit and below 50%: ' + suspicious.join(', '));

  const missingEstimate = (sc.classes || [])
    .filter((cls) => cls && (!cls.populationEstimate || String(cls.size || '').indexOf('占') < 0))
    .map((cls) => cls.name);
  assert(missingEstimate.length === 0, 'classes missing estimate/share size text: ' + missingEstimate.join(', '));
}

function assertNpcAdminQuality(sc) {
  const ah = sc.adminHierarchy || {};
  Object.keys(ah).forEach((key) => {
    if (key === 'player') return;
    const tree = ah[key] || {};
    const div = (tree.divisions || [])[0] || {};
    assert(div.specialCulture, 'npc admin missing specialCulture: ' + key);
    assert(div.strategicValue, 'npc admin missing strategicValue: ' + key);
    assert(Array.isArray(div.recentDisasters) && div.recentDisasters.length > 0, 'npc admin missing recentDisasters: ' + key);
  });

  const bozhou = ah.bozhouYang && ah.bozhouYang.divisions && ah.bozhouYang.divisions[0];
  assert(bozhou && Array.isArray(bozhou.tradeRoutes) && bozhou.tradeRoutes.length > 0, 'bozhou remnant missing tradeRoutes');
  assert(bozhou && Array.isArray(bozhou.threats) && bozhou.threats.length > 0, 'bozhou remnant missing threats');
  assert(/残|旧|余/.test(bozhou.description || ''), 'bozhou description should be framed as remnant, not formal tusi state');

  const macau = ah.portugueseMacau && ah.portugueseMacau.divisions && ah.portugueseMacau.divisions[0];
  const macauEth = macau && macau.byEthnicity || {};
  assert((macauEth['汉'] || 0) >= 0.65, 'Macau Chinese share should dominate early-17c settlement');
  assert(((macauEth['葡萄牙'] || 0) + (macauEth['土生葡人'] || 0)) <= 0.20, 'Macau Portuguese/Macanese share too high');

  const dutch = ah.dutchFormosa && ah.dutchFormosa.divisions && ah.dutchFormosa.divisions[0];
  const dutchEth = dutch && dutch.byEthnicity || {};
  assert((dutchEth['荷兰'] || 0) <= 0.03, 'Dutch Formosa VOC European share too high');

  const spanish = ah.spanishManila && ah.spanishManila.divisions && ah.spanishManila.divisions[0];
  const spanishEth = spanish && spanish.byEthnicity || {};
  assert((spanishEth['西班牙/拉美士兵'] || 0) <= 0.02, 'Spanish Manila Spaniard/Latin soldier share too high');
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
  assertFactionConsistency(sc);
  assertHoujinCharacterExpansion(sc);
  assertTianqiClassPopulationAndCao(sc);
  assertNpcAdminQuality(sc);
  const ctx = makeContext(sc);

  [
    'tm-guoku-engine.js',
    'tm-neitang-engine.js',
    'tm-economy-engine.js',
    'tm-region-enrich.js',
    'tm-integration-bridge.js',
    'tm-fiscal-engine.js'
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
