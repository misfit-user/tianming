#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const lib = require('./lib-arch-guard');
const featureBuild = require('./build-feature-manifest');

const INDEX = path.join(lib.WEB_ROOT, 'index.html');
const STARTUP = path.join(lib.WEB_ROOT, 'startup-script-phases.json');
const EAGER_REMOVALS = [
  'tm-test-harness.js',
  'tm-update-card.js',
  'tm-desktop-update.js',
  'tm-online-update.js',
  'tm-map-label-geo.js',
  'tm-map-label-collide.js'
];

const failures = [];
function assert(condition, message) { if (!condition) failures.push(message); }

const manifest = featureBuild.loadFeatureManifest();
const featureResult = featureBuild.validateFeatureManifest(manifest);
const eager = lib.parseIndexScripts(INDEX).filter((row) => /\.js$/i.test(row.src || '')).map((row) => row.src);
assert(eager.filter((src) => src === 'tm-feature-loader.js').length === 1, 'index.html must eagerly load exactly one tm-feature-loader.js');
EAGER_REMOVALS.forEach((src) => assert(!eager.includes(src), `${src} must not remain in the eager startup chain`));

const declaredScripts = Object.values(manifest.features).flatMap((feature) => feature.scripts.map(featureBuild.scriptPath));
EAGER_REMOVALS.forEach((src) => assert(declaredScripts.includes(src), `${src} must be owned by a declared feature`));
const RELIEF_SCRIPTS = ['tm-relief-governance.js', 'tm-relief-governance-ui.js'];
assert(featureResult.scriptCount === EAGER_REMOVALS.length + RELIEF_SCRIPTS.length, 'exactly the original six plus the reviewed two relief providers may be deferred');
assert(JSON.stringify((manifest.features.reliefGovernance.scripts || []).map(featureBuild.scriptPath)) === JSON.stringify(RELIEF_SCRIPTS), 'relief feature must own exactly its core and UI providers in order');
RELIEF_SCRIPTS.forEach(src => assert(!eager.includes(src), `${src} must remain outside eager startup`));

const loaderSource = fs.readFileSync(path.join(lib.WEB_ROOT, 'tm-feature-loader.js'), 'utf8');
assert(!/(?:\beval\s*\(|new\s+Function\s*\()/.test(loaderSource), 'feature loader must not execute strings');
assert(!/TM\.__[A-Za-z0-9]+Parts/.test(loaderSource), 'feature loader must not introduce a parts bucket');
assert(/feature-reload-required/.test(loaderSource) && /scriptRequiresReload/.test(loaderSource), 'timed-out scripts must require a document reload instead of duplicate insertion');
assert(/ensureRecoverable/.test(loaderSource), 'feature loader must expose one controlled recovery entry point');
assert(/disposeRequested/.test(loaderSource), 'feature loader must coordinate dispose requests with in-flight loads');
assert(/feature-dependency-cycle/.test(loaderSource), 'feature loader must reject dependency cycles at runtime');

const desktopSource = fs.readFileSync(path.join(lib.WEB_ROOT, 'tm-desktop-update.js'), 'utf8');
assert(/function\s+init\s*\(/.test(desktopSource) && /function\s+dispose\s*\(/.test(desktopSource), 'desktop update must expose an explicit lifecycle');
assert(!/addEventListener\(\s*['"]load['"]\s*,\s*(?:arm|init)/.test(desktopSource), 'desktop update must not self-initialize at module load');

const onlineSource = fs.readFileSync(path.join(lib.WEB_ROOT, 'tm-online-update.js'), 'utf8');
assert(/function\s+init\s*\(/.test(onlineSource) && /function\s+dispose\s*\(/.test(onlineSource), 'online update must expose an explicit lifecycle');
assert(!/addEventListener\(\s*['"]DOMContentLoaded['"]\s*,\s*(?:arm|init)/.test(onlineSource), 'online update must not self-initialize at module load');

const mapSource = fs.readFileSync(path.join(lib.WEB_ROOT, 'phase8-formal-map.js'), 'utf8');
assert(!/var\s+_TMGeo\s*=/.test(mapSource), 'formal map must not capture the optional geometry provider at module load');
assert(/TM\.Features\.ensureRecoverable\(['"]formalMapLabels['"]/.test(mapSource), 'formal map must use controlled feature recovery');
assert(/invalidateMapLabelGeometryCaches/.test(mapSource), 'formal map must invalidate fallback geometry caches after late load');
const renderStart = mapSource.indexOf('function renderFormalMap(){');
const renderEnd = mapSource.indexOf('var map = getMapData();', renderStart);
const renderGate = mapSource.slice(renderStart, renderEnd);
assert(renderGate.indexOf('if (!shell || !stage || !isGameVisible())') < renderGate.indexOf('requestMapLabelFeature();'), 'formal map must request labels only after its visibility gate');

const contentSource = fs.readFileSync(path.join(lib.WEB_ROOT, 'tm-content-manager.js'), 'utf8');
assert(/TM\.Features\.ensureRecoverable\(['"]desktopUpdate['"]/.test(contentSource), 'desktop content manager must use controlled feature recovery');

if (fs.existsSync(STARTUP)) {
  const startup = JSON.parse(fs.readFileSync(STARTUP, 'utf8'));
  assert(startup.version === 2, 'startup manifest must use schema version 2');
  assert(startup.deferredChangesApproved >= 6, 'startup manifest must record at least six approved deferred scripts');
  assert(Array.isArray(startup.features) && startup.features.length >= 4, 'startup manifest must include explicit feature definitions');
}

if (failures.length) {
  failures.forEach((failure) => console.error('[lint-feature-boundaries] ' + failure));
  process.exit(1);
}
console.log(`[lint-feature-boundaries] PASS eager=${eager.length} features=${featureResult.featureCount} deferredScripts=${featureResult.scriptCount}`);
