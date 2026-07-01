#!/usr/bin/env node
// scripts/smoke-faction-relations.js
//
// Guards the faction diplomacy ledger: scenario endpoints, relation facade,
// and endturn create/dissolve index maintenance.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SID = 'sc-tianqi7-1627';

function fail(msg) {
  throw new Error(msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function loadDesktopOfficialScenario() {
  const dir = path.resolve(ROOT, '..', 'scenarios');
  if (!fs.existsSync(dir)) return null;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const abs = path.join(dir, file);
    try {
      const sc = JSON.parse(fs.readFileSync(abs, 'utf8'));
      if (sc && sc.id === SID) return { scenario: sc, source: abs };
    } catch (_) {}
  }
  return null;
}

function loadBuiltinScenario() {
  const abs = path.join(ROOT, 'scenarios', 'tianqi7-1627.js');
  // 官方剧本重建为「壳+快照」:壳(tianqi7-1627.js)以 window 探测注册 scenario 对象进 P.scenarios;
  // 可玩花名册由运行时快照平铺到 P.characters/factions(sid 标记)。node 下须 shim window 让壳注册、
  // shim addEventListener 供快照注册 tm:p-restored。两者都 require 进来才得到完整 sc + 平铺名册。
  const snap = path.join(ROOT, 'data', 'scenario-supplements', 'tianqi7-official-runtime-snapshot.js');
  const oldP = global.P;
  const oldDocument = global.document;
  const oldWindow = global.window;
  const oldAddEvent = global.addEventListener;
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
    global.window = global;
    global.addEventListener = function () {};
    console.log = function () {};
    delete require.cache[require.resolve(abs)];
    require(abs);
    delete require.cache[require.resolve(snap)];
    require(snap);
    const sc = global.P.scenarios.find((s) => s && s.id === SID);
    assert(sc, 'built-in official scenario missing');
    sc.characters = global.P.characters.filter((x) => x && x.sid === SID);
    sc.factions = global.P.factions.filter((x) => x && x.sid === SID);
    return { scenario: sc, source: abs };
  } finally {
    console.log = oldLog;
    global.P = oldP;
    global.document = oldDocument;
    global.window = oldWindow;
    global.addEventListener = oldAddEvent;
  }
}

function assertScenarioFactionConsistency(loaded) {
  const sc = loaded.scenario;
  const factionNames = new Set((sc.factions || []).map((f) => f && f.name).filter(Boolean));
  assert(factionNames.size >= 12, 'expected official scenario to expose >=12 factions in ' + loaded.source);

  const missingCharFaction = (sc.characters || [])
    .filter((c) => c && c.faction && !factionNames.has(c.faction))
    .map((c) => c.name + ':' + c.faction);
  assert(missingCharFaction.length === 0, 'characters reference missing factions: ' + missingCharFaction.join(', '));

  const badRelations = (sc.factionRelations || [])
    .filter((r) => r && (!factionNames.has(r.from) || !factionNames.has(r.to)))
    .map((r) => r.from + '->' + r.to);
  assert(badRelations.length === 0, 'factionRelations reference missing factions: ' + badRelations.join(', '));

  assert(factionNames.has('科尔沁蒙古'), '科尔沁蒙古 faction card missing in ' + loaded.source);
}

function runFacadeSmoke() {
  const ctx = {
    console,
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
    GM: {
      turn: 7,
      factionRelations: [
        { from: 'A', to: 'B', type: 'hostile', value: -70, desc: 'old war' }
      ],
      factionRelationsMap: {
        'A->B': { value: -5, type: 'legacy-flat' }
      }
    }
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-relations.js'), 'utf8'), ctx, { filename: 'tm-relations.js' });

  assert(typeof ctx.syncFactionRelationsFromList === 'function', 'syncFactionRelationsFromList not exported');
  assert(typeof ctx.setFactionRelation === 'function', 'setFactionRelation not exported');
  assert(typeof ctx.removeFactionRelationsForFaction === 'function', 'removeFactionRelationsForFaction not exported');

  ctx.syncFactionRelationsFromList(ctx.GM.factionRelations);
  assert(!ctx.GM.factionRelationsMap['A->B'], 'flat A->B key was not migrated');
  assert(ctx.GM.factionRelationsMap.A.B.value === -70, 'A->B list value did not seed nested map');
  assert(ctx.GM.factionRelationsMap.B.A.value === -70, 'B->A mirrored map missing');

  ctx.setFactionRelation('A', 'B', { delta: 10, new_type: 'hostile', event: 'envoy exchange' }, { mirror: true });
  assert(ctx.GM.factionRelationsMap.A.B.value === -60, 'setFactionRelation did not update A->B');
  assert(ctx.GM.factionRelationsMap.B.A.value === -60, 'setFactionRelation did not mirror B->A');
  assert(ctx.GM.factionRelations.some((r) => r.from === 'B' && r.to === 'A'), 'reverse list record missing after setFactionRelation');

  ctx.removeFactionRelationsForFaction('B');
  assert(!ctx.GM.factionRelationsMap.B, 'removed faction row still present');
  assert(!ctx.GM.factionRelationsMap.A.B, 'removed faction column still present');
  assert(ctx.GM.factionRelations.every((r) => r.from !== 'B' && r.to !== 'B'), 'removed faction list records still present');
}

function runStaticEndturnChecks() {
  const code = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
  assert(!code.includes('factionRelationsMap[key1]'), 'endturn still writes flat factionRelationsMap[key1]');
  assert(code.includes('setFactionRelation(rs.from, rs.to'), 'faction_relation_shift does not use setFactionRelation');
  assert(code.includes("addToIndex('fac'"), 'faction_create does not update fac index');
  assert(code.includes("removeFromIndex('fac'"), 'faction_dissolve does not remove fac index');
  assert(code.includes('removeFactionRelationsForFaction(fd.name)'), 'faction_dissolve does not prune relation map/list through facade');
}

function main() {
  const desktop = loadDesktopOfficialScenario();
  if (desktop) assertScenarioFactionConsistency(desktop);
  assertScenarioFactionConsistency(loadBuiltinScenario());
  runFacadeSmoke();
  runStaticEndturnChecks();
  console.log('[smoke-faction-relations] pass');
}

try {
  main();
} catch (e) {
  console.error('[smoke-faction-relations] fail: ' + (e && e.message || e));
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 5).join('\n'));
  process.exit(1);
}
