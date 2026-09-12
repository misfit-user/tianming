#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
execFileSync(process.execPath, [path.join(__dirname, 'build-startup-phase-manifest.js'), '--check'], {
  cwd: path.resolve(ROOT, '..'),
  stdio: 'pipe'
});
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'startup-script-phases.json'), 'utf8'));
const scriptNames = Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)(?:[?#][^"']*)?["'][^>]*>/gi))
  .map((match) => match[1].replace(/^\.\//, ''));

assert.strictEqual(manifest.scriptCount, scriptNames.length, 'startup manifest should cover every external JavaScript loaded by index.html');
assert.deepStrictEqual(manifest.scripts.map((row) => row.script), scriptNames, 'startup manifest order should match index.html exactly');
assert.strictEqual(manifest.version, 2, 'startup manifest should use the explicit feature-boundary schema');
assert.strictEqual(manifest.deferredChangesApproved, 8, 'the original six and two explicit relief providers form the complete deferred set');
assert.strictEqual(manifest.scriptCount, 414, '411 retained scripts plus the three model-discovery/thinking modules form the complete eager set');
for (const name of ['tm-ai-request-options.js', 'tm-api-models.js', 'tm-api-settings.js']) {
  assert.strictEqual(scriptNames.filter((src) => src === name).length, 1, name + ' is loaded exactly once');
}
assert(scriptNames.indexOf('tm-api-models.js') < scriptNames.indexOf('tm-api-settings.js'), 'model discovery loads before its settings controls');
assert(scriptNames.indexOf('tm-api-settings.js') < scriptNames.indexOf('tm-patches.js'), 'settings controls load before the settings renderer');
assert.strictEqual(scriptNames.filter((name) => name === 'tm-ai-infra-retry.js').length, 1, 'retry helpers load exactly once');
assert.strictEqual(scriptNames.indexOf('tm-ai-infra-retry.js') + 1, scriptNames.indexOf('tm-ai-infra.js'), 'retry helpers directly precede their consumer');
assert(scriptNames.indexOf('tm-ai-request-options.js') < scriptNames.indexOf('tm-ai-infra.js'), 'thinking policy loads before its transport consumers');
assert.strictEqual(scriptNames.filter((name) => name === 'tm-building-orders.js').length, 1, 'the building-order owner must be loaded exactly once');
assert(scriptNames.indexOf('tm-building-orders.js') > scriptNames.indexOf('tm-custom-build-agent.js'), 'the order owner follows its actual construction provider');
assert(manifest.scripts.every((row) => row.lazySafe === false && row.loadPolicy === 'eager-ordered'), 'retained classic scripts should remain explicitly eager');
assert(manifest.scripts.every((row) => Array.isArray(row.provides) && Array.isArray(row.consumes)), 'manifest should expose machine-readable provider and immediate-consumer inventories');
assert(manifest.scripts.every((row) => row.mustLoadBefore.length === 0 && row.mustLoadAfter.length === 0), 'adjacent scripts must not be emitted as fake dependencies');
assert(Array.isArray(manifest.features) && manifest.features.length === 5, 'startup manifest exposes the original four and the relief pilot feature');
assert.strictEqual(manifest.features.reduce((count, row) => count + row.scripts.length, 0), 8, 'feature definitions own exactly eight deferred scripts');
assert(!scriptNames.includes('tm-relief-governance.js') && !scriptNames.includes('tm-relief-governance-ui.js'), 'relief must not add work to the eager startup chain');

const sandbox = { console, Date, Math, JSON, performance, Promise, window: {} };
sandbox.window.window = sandbox.window;
sandbox.window.globalThis = sandbox.window;
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'tm-perf.js'), 'utf8'), sandbox.window, { filename: 'tm-perf.js' });
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'tm-startup-phases.js'), 'utf8'), sandbox.window, { filename: 'tm-startup-phases.js' });
['core', 'world', 'optional'].forEach((phase) => sandbox.window.TMStartupPhases.transition(phase));
sandbox.window.TMStartupPhases.finish();
['menu', 'core', 'world', 'optional'].forEach((phase) => {
  assert(sandbox.window.TM.perf.reportByName(`startup.phase.${phase}`).count === 1, `startup ${phase} phase should close one measured span`);
});

console.log('smoke-startup-phase-observability ok scripts=' + manifest.scriptCount);
