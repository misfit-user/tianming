#!/usr/bin/env node
// build-scenario-editor-reset-data.js - Build standalone data for the new scenario editor prototype.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  buildScenarioEditorResetInventory,
  loadOfficialScenario,
  RESET_BLUEPRINT_MODULES
} = require('./editor-reset-inventory.js');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'preview', 'scenario-editor-reset-data.js');
const SCENARIO_DIR = path.resolve(ROOT, '..', 'scenarios');
// Sibling official scenarios to widen the blueprint's key universe. The
// inventory function itself stays single-scenario (天启) so existing smokes
// keep their semantics, but the baked blueprint should cover every key both
// shipped scenarios actually use — otherwise loading 绍宋 leaves 21 of its
// top-level keys (engineConstants, _adaptation, chronicleConfig, ...) absent
// from module navigation and only rescued by the runtime orphan absorber.
const COMPANION_SCENARIO_FILES = [
  '绍宋·建炎元年八月（官方）.json'
];

function stableClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function collectScenarioKeyUniverse(primaryScenario) {
  const keys = new Set(Object.keys(primaryScenario || {}));
  COMPANION_SCENARIO_FILES.forEach((name) => {
    const full = path.join(SCENARIO_DIR, name);
    if (!fs.existsSync(full)) return;
    try {
      // 键的全集按运行时形态算（真源不写 mapData，运行时有）。
      const data = require('./official-scenario-source.js').readOfficialScenario(full).data;
      Object.keys(data || {}).forEach((k) => keys.add(k));
    } catch (err) {
      console.warn('[build-scenario-editor-reset-data] failed to widen with ' + name + ': ' + err.message);
    }
  });
  return keys;
}

function widenBlueprint(blueprint, keyUniverse) {
  // Re-derive each module's topLevelKeys from RESET_BLUEPRINT_MODULES,
  // filtering against the wider key universe. This restores any blueprint
  // entries that were dropped because the source scenario didn't ship them.
  const assigned = new Set();
  const widenedModules = RESET_BLUEPRINT_MODULES.map((mod) => {
    const topLevelKeys = mod.topLevelKeys.filter((key) => keyUniverse.has(key));
    topLevelKeys.forEach((key) => assigned.add(key));
    const existing = blueprint.modules.find((m) => m.id === mod.id) || {};
    return Object.assign({}, existing, {
      id: mod.id,
      title: mod.title,
      topLevelKeys,
      topLevelCount: topLevelKeys.length
    });
  });
  const unassignedTopLevelKeys = Array.from(keyUniverse).filter((k) => !assigned.has(k)).sort();
  return Object.assign({}, blueprint, {
    modules: widenedModules,
    assignedTopLevelKeys: Array.from(assigned).sort(),
    unassignedTopLevelKeys,
    keyUniverseSize: keyUniverse.size
  });
}

function buildPayload(options) {
  const loaded = loadOfficialScenario(ROOT);
  const inventory = buildScenarioEditorResetInventory({ root: ROOT });
  const scenario = stableClone(loaded.scenario);
  const keyUniverse = collectScenarioKeyUniverse(scenario);
  const blueprint = widenBlueprint(inventory.blueprint, keyUniverse);
  const sourceRaw = fs.readFileSync(loaded.source);
  const sourceSha256 = options && options.sourceSha256
    ? String(options.sourceSha256)
    : crypto.createHash('sha256').update(sourceRaw).digest('hex');
  return {
    // Deterministic provenance: wall-clock timestamps made an unchanged source
    // dirty on every build and could not prove which source produced the file.
    sourceSha256,
    source: path.relative(path.resolve(ROOT, '..'), loaded.source).replace(/\\/g, '/'),
    summary: inventory.officialScenario,
    blueprint,
    scenario
  };
}

function main() {
  // Compatibility CLI: never refresh just one generated consumer.
  require('./sync-official-scenarios.js').sync({ check: false });
}

if (require.main === module) main();

module.exports = { buildPayload };
