#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const lib = require('./lib-arch-guard');
const featureBuild = require('./build-feature-manifest');

const INDEX = path.join(lib.WEB_ROOT, 'index.html');
const PROVIDERS = path.join(lib.REPORT_DIR, 'global-providers.json');
const OUTPUT = path.join(lib.WEB_ROOT, 'startup-script-phases.json');
const CHECK = process.argv.includes('--check');
const featureManifest = featureBuild.loadFeatureManifest();
featureBuild.validateFeatureManifest(featureManifest);

if (!fs.existsSync(PROVIDERS)) {
  throw new Error('global provider report missing; run node web/scripts/lint-global-providers.js first');
}

const report = JSON.parse(fs.readFileSync(PROVIDERS, 'utf8'));
const parsed = lib.parseIndexScripts(INDEX)
  .filter((row) => /\.js$/i.test(row.src || ''));
const providedByScript = new Map();
(report.definitions || []).forEach((definition) => {
  (definition.definitions || []).forEach((row) => {
    if (!providedByScript.has(row.src)) providedByScript.set(row.src, new Set());
    providedByScript.get(row.src).add(definition.name);
  });
});
const consumedByScript = new Map();
(report.earlyReads || []).forEach((row) => {
  if (!consumedByScript.has(row.src)) consumedByScript.set(row.src, new Set());
  consumedByScript.get(row.src).add(row.name);
});

const dataModelIndex = parsed.findIndex((row) => row.src === 'tm-data-model.js');
const worldIndex = parsed.findIndex((row) => row.src === 'tm-launch.js');
const optionalIndex = parsed.findIndex((row) => row.src === 'tm-content-manager.js');
if (dataModelIndex < 0 || worldIndex < 0 || optionalIndex < 0) throw new Error('startup phase boundary script missing');

function phaseFor(index) {
  if (index < dataModelIndex) return 'menu';
  if (index < worldIndex) return 'core';
  if (index < optionalIndex) return 'world';
  return 'optional';
}

const scripts = parsed.map((row, index) => ({
  script: row.src,
  order: index,
  phase: phaseFor(index),
  loadPolicy: 'eager-ordered',
  platform: 'any',
  sideEffects: 'legacy-unknown',
  provides: Array.from(providedByScript.get(row.src) || []).sort(),
  consumes: Array.from(consumedByScript.get(row.src) || []).sort(),
  dependsOn: [],
  mustLoadBefore: [],
  mustLoadAfter: [],
  lazySafe: false,
  reason: 'Legacy eager script: document order remains observable, but adjacency is not represented as a dependency. Explicit split contracts remain owned by lint-split-contracts.js.'
}));

const features = Object.keys(featureManifest.features).sort().map((name) => {
  const feature = featureManifest.features[name];
  return {
    feature: name,
    scripts: feature.scripts.map(featureBuild.scriptPath),
    loadPolicy: feature.loadPolicy,
    platform: feature.platform,
    sideEffects: feature.sideEffects,
    dependsOn: feature.dependsOn.slice(),
    provides: feature.provides.slice()
  };
});
const deferredScriptCount = features.reduce((count, feature) => count + feature.scripts.length, 0);

const manifest = {
  version: 2,
  source: 'index.html',
  generatedBy: 'web/scripts/build-startup-phase-manifest.js',
  scriptCount: scripts.length,
  phaseCounts: scripts.reduce((out, row) => {
    out[row.phase] = (out[row.phase] || 0) + 1;
    return out;
  }, {}),
  deferredChangesApproved: deferredScriptCount,
  auditConclusion: 'Feature Loader V2 owns ' + deferredScriptCount + ' explicitly declared deferred scripts. The original six remain deferred; relief providers load only for the issue panel or active saved cases. Eager classic scripts retain document order; adjacency is not a dependency.',
  scripts,
  features
};
const text = JSON.stringify(manifest, null, 2) + '\n';

if (CHECK) {
  const actual = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : '';
  if (actual !== text) {
    console.error('[startup-phase-manifest] stale: ' + lib.rel(OUTPUT));
    process.exit(1);
  }
  console.log('[startup-phase-manifest] PASS scripts=' + scripts.length + ' deferred=' + deferredScriptCount + ' phases=' + JSON.stringify(manifest.phaseCounts));
} else {
  fs.writeFileSync(OUTPUT, text, 'utf8');
  console.log('[startup-phase-manifest] wrote ' + lib.rel(OUTPUT) + ' scripts=' + scripts.length + ' deferred=' + deferredScriptCount);
}
