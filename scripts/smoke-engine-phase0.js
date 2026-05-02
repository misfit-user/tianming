#!/usr/bin/env node
// smoke-engine-phase0.js - regression checks for the 6-system phase 0 infra.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const context = {
  console,
  Date,
  JSON,
  Math,
  GM: { turn: 12 },
  P: {},
  scriptData: {}
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

function load(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, context, { filename: file });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

load('tm-engine-constants.js');
load('tm-rel-graph.js');
load('tm-migration.js');

const EC = context.TM.EngineConstants;
const RG = context.TM.RelGraph;
const EM = context.TM.EngineMigration;

assert(EC && RG && EM, 'phase0 APIs must be mounted on TM');
assert(context.EngineConstants === EC, 'EngineConstants global alias missing');
assert(context.RelGraph === RG, 'RelGraph global alias missing');
assert(context.EngineMigration === EM, 'EngineMigration global alias missing');

assert(EC.get('officialRanks', { engineConstants: {} }) === undefined, 'missing constants must not fallback');
const script = { name: 'demo' };
EC.applyTemplate(script, 'ming', { appliedAt: 'test-time' });
assert(script.engineConstants._templateKey === 'ming', 'template key not stamped');
assert(Array.isArray(script.engineConstants.officialRanks), 'officialRanks template missing');
assert(script.engineConstants.militarySystems.length >= 2, 'ming militarySystems template too small');
const ranks = EC.get('officialRanks', script);
ranks.push('SHOULD_NOT_MUTATE');
assert(script.engineConstants.officialRanks.indexOf('SHOULD_NOT_MUTATE') === -1, 'get() must clone values');
assert(EC.requirePaths(['officialRanks', 'officeSubtabs', 'missing.path'], script).missing.length === 1, 'requirePaths missing detection failed');
const customCatalogScript = { engineConstants: { influenceGroupCatalog: { customGroup: { name: 'custom' } } } };
EC.applyTemplate(customCatalogScript, 'ming', { appliedAt: 'custom-time' });
const customCatalogKeys = Object.keys(customCatalogScript.engineConstants.influenceGroupCatalog).sort();
assert(customCatalogKeys.length === 1 && customCatalogKeys[0] === 'customGroup', 'applyTemplate must not inject default influenceGroupCatalog beside explicit custom catalog');
assert(!customCatalogScript.engineConstants.influenceGroupCatalog.eunuch, 'applyTemplate should preserve explicit influenceGroupCatalog ownership');

const root = { relGraph: { edges: [] } };
const ch = { id: 'char-1', name: '张居正', party: '清流' };
const e1 = RG.bindCharToParty(ch, { id: 'donglin', name: '东林党' }, { role: 'leader' }, root);
const e2 = RG.bindCharToParty(ch, { id: 'donglin', name: '东林党' }, { role: 'leader' }, root);
assert(e1.id === e2.id, 'ensureEdge must be idempotent');
assert(root.relGraph.edges.length === 1, 'duplicate typed edge created');
assert(ch.party === '清流', 'legacy display party field must be preserved');
assert(ch.partyRef && ch.partyRef.id === 'donglin', 'partyRef not written');
assert(RG.findEdges({ kind: 'char-party', toId: 'donglin' }, root).length === 1, 'findEdges failed');

let calls = 0;
EM.register(1, 'smoke-v1', function(target) {
  calls += 1;
  target.phase0Touched = (target.phase0Touched || 0) + 1;
});
const save = { gameState: {} };
let r1 = EM.run(save);
let r2 = EM.run(save);
assert(calls === 1, 'migration must run once only');
assert(save.gameState.phase0Touched === 1, 'migration did not touch resolved gameState');
assert(r1.applied.indexOf('smoke-v1') >= 0 && r1.applied.indexOf('phase6-char-refs-memory') >= 0 && r2.applied.length === 0, 'migration applied list incorrect');
assert(save.gameState._engineMigration.version >= 2, 'migration version stamp incorrect');
assert(EM.report(save).pending.length === 0, 'migration report pending mismatch');

console.log('[smoke-engine-phase0] pass assertions=21');
