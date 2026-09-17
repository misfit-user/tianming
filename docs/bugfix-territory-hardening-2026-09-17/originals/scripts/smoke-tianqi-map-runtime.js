#!/usr/bin/env node
/* eslint-env node */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..', '..');
const webRoot = path.resolve(__dirname, '..');
const scenarioPath = path.join(repoRoot, 'scenarios', '天启七年·九月（官方）.json');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function runFile(ctx, rel) {
  const code = fs.readFileSync(path.join(webRoot, rel), 'utf8');
  vm.runInContext(code, ctx, { filename: rel });
}

function makeContext(sc) {
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
    isFinite,
    Set,
    Map,
    P: {
      map: clone(sc.map),
      mapData: clone(sc.mapData),
      factions: clone(sc.factions || []),
      adminHierarchy: clone(sc.adminHierarchy || {}),
      mapConfig: clone(sc.mapConfig || {}),
    },
    GM: {
      sid: sc.id,
      turn: 3,
      mapData: null,
      facs: clone(sc.factions || []),
      turnChanges: { variables: [], characters: [], factions: [], parties: [], classes: [], military: [], map: [] },
    },
    deepClone: clone,
    clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
    _dbg() {},
    toast() {},
    recordChange() {},
    refreshMapDisplay() {},
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.global = ctx;
  return vm.createContext(ctx);
}

function main() {
  const sc = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
  assert(sc.map && Array.isArray(sc.map.regions), 'scenario.map.regions missing');
  assert(sc.mapData && Array.isArray(sc.mapData.regions), 'scenario.mapData.regions missing');
  assert(sc.map.regions.length === 43, `expected 43 land regions, got ${sc.map.regions.length}`);
  assert((sc.map.oceans || []).length === 8, `expected 8 ocean regions, got ${(sc.map.oceans || []).length}`);

  const factionIds = new Set((sc.factions || []).map(f => f.id).filter(Boolean));
  const badOwners = sc.map.regions.filter(r => !factionIds.has(r.owner));
  assert(badOwners.length === 0, 'map regions reference missing faction ids: ' + badOwners.map(r => `${r.name}:${r.owner}`).join(', '));

  const missingMutableFields = sc.map.regions.filter(r =>
    !r.owner || !r.currentOwner || !r.initialOwner || !r.ownerKey || !r.currentOwnerKey ||
    !Array.isArray(r.coords) || r.coords.length < 6 ||
    !Array.isArray(r.center) || r.center.length < 2 ||
    r.mutable === false
  );
  assert(missingMutableFields.length === 0, 'regions missing runtime mutable fields: ' + missingMutableFields.map(r => r.name).join(', '));

  const ctx = makeContext(sc);
  runFile(ctx, 'tm-map-system.js');
  runFile(ctx, 'map-integration.js');

  assert(ctx.TMMapRuntime, 'TMMapRuntime missing');
  ctx.TMMapRuntime.bind(ctx.P.map);
  assert(ctx.GM.mapData && ctx.GM.mapData.regions.length === 43, 'GM.mapData did not receive live map');
  assert(ctx.P.map !== ctx.GM.mapData, 'P.map template must not alias live GM.mapData');
  assert(ctx.P.mapData !== ctx.GM.mapData, 'P.mapData template must not alias live GM.mapData');

  const aiContext = ctx.generateMapContextForAI(ctx.P.map, ctx.P);
  assert(/地图总览/.test(aiContext) && /43/.test(aiContext), 'AI map context missing overview');
  assert(/明朝廷/.test(aiContext) && /后金/.test(aiContext), 'AI map context missing core factions');

  const target = ctx.TMMapRuntime.findRegion('ming-28');
  assert(target && target.name.includes('辽东'), 'target region ming-28 missing');
  const oldDevelopment = Number(target.development || 0);
  const oldTroops = Number(target.troops || 0);
  const laterJin = (sc.factions || []).find(f => f.name === '后金');
  assert(laterJin, 'Later Jin faction missing');
  ctx.applyAIMapChanges({
    map_changes: {
      ownership_changes: [{ region_id: 'ming-28', new_owner: '后金', reason: 'smoke test transfer' }],
      development_changes: [{ region_id: 'ming-28', delta: 7, reason: 'smoke test development' }],
      troop_changes: [{ region_id: 'ming-28', delta: 1200, reason: 'smoke test troops' }],
    },
  }, ctx.P.map);

  const changed = ctx.TMMapRuntime.findRegion('ming-28');
  assert(changed.owner === laterJin.id, `owner did not change to Later Jin id: ${changed.owner}`);
  assert(changed.currentOwner === laterJin.id, 'currentOwner did not mirror owner');
  // ownerKey 取新主的稳定 key(tm-map-system.js: region.ownerKey = resolved.key)。后金 faction 的 key 现为生成 id(原语义键 fac-later-jin 已随 faction id 重生成)·改用动态 laterJin.key 而非钉死旧串。
  assert(changed.ownerKey === (laterJin.key || laterJin.id), `ownerKey did not mirror Later Jin key: ${changed.ownerKey} (expect ${laterJin.key || laterJin.id})`);
  assert(changed.development === Math.min(100, oldDevelopment + 7), `development did not change: ${changed.development}`);
  assert(changed.troops === oldTroops + 1200, `troops did not change: ${changed.troops}`);
  const templateTarget = ctx.P.map.regions.find(r => r.id === 'ming-28');
  assert(templateTarget.owner !== laterJin.id && templateTarget.development === oldDevelopment && templateTarget.troops === oldTroops,
    'live map mutation leaked back into scenario template P.map');
  assert(ctx.GM.turnChanges.map.length >= 3, 'map changes were not recorded in GM.turnChanges.map');

  ctx.TMMapRuntime.updateRegion('ming-28', { data: { smokeMutableField: 1 }, prosperity: 66 }, { reason: 'smoke test data patch' });
  assert(changed.data && changed.data.smokeMutableField === 1, 'nested data patch did not apply');
  assert(changed.prosperity === 66, 'region scalar patch did not apply');

  const runtimeContext = ctx.TMMapRuntime.toAIContext();
  assert(runtimeContext && runtimeContext.regions.some(r => r.id === 'ming-28' && r.owner === laterJin.id), 'runtime AI context did not see changed owner');

  console.log('[smoke-tianqi-map-runtime] pass regions=' + sc.map.regions.length +
    ' oceans=' + (sc.map.oceans || []).length +
    ' owners=' + new Set(sc.map.regions.map(r => r.owner)).size +
    ' changes=' + ctx.GM.turnChanges.map.length);
}

try {
  main();
} catch (e) {
  console.error('[smoke-tianqi-map-runtime] fail: ' + (e && e.message || e));
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 6).join('\n'));
  process.exit(1);
}
