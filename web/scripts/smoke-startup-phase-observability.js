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
assert.strictEqual(manifest.deferredChangesApproved, 9, 'the original six, two relief providers and pure realm layout form the complete deferred set');
const nativeModules=['tm-start-contracts.js','libs/polygon-clipping-0.15.7.min.js','tm-map-workbench.js','tm-map-workbench-client.js','tm-start-compiler.js','tm-start-world.js','tm-native-fiscal-adapter.js','tm-native-scope.js','tm-native-fiscal-ui.js','tm-start-preparation-document.js','tm-start-preparation.js','tm-start-commit.js','tm-start-selector.js','tm-save-world-validation.js'];
const fiscalModules=['tm-char-economy-ledger.js','tm-fiscal-statements.js','tm-public-treasury.js','tm-military-arrears.js','tm-command-authority.js'];
const recoveryModules=['tm-memory-adaptive.js','tm-memory-long-term.js','tm-memory-hybrid.js','tm-memory-mode-bridge.js','tm-endturn-reliability.js','tm-endturn-response-recovery.js','tm-endturn-recovery-vault.js','tm-endturn-save-reconcile.js'];
recoveryModules.forEach(name=>assert.strictEqual(scriptNames.filter(src=>src===name).length,1,name+' loads once'));
const outputContractModules=['tm-ai-result-contract.js'];
outputContractModules.forEach(name=>assert.strictEqual(scriptNames.filter(src=>src===name).length,1,name+' loads once'));
assert(scriptNames.indexOf('tm-ai-result-contract.js')<scriptNames.indexOf('tm-world.js'),'output contract precedes world context and inference consumers');
const visualAdapters=['tm-shanhe-runtime.js'];
const requestControls=['tm-call-retry-policy.js','tm-call-budget-settings.js'];
const enactedOrderModules=['tm-imperial-orders.js','tm-personal-memory-recall.js','tm-live-context.js','tm-tax-policy.js'];
requestControls.concat(enactedOrderModules).forEach(name=>assert.strictEqual(scriptNames.filter(src=>src===name).length,1,name+' loads exactly once'));
assert(scriptNames.indexOf('tm-call-retry-policy.js')<scriptNames.indexOf('tm-ai-infra-retry.js'),'retry settings are resolved before transport');
assert(scriptNames.indexOf('tm-call-budget-settings.js')<scriptNames.indexOf('tm-patches.js'),'budget controls precede the settings owner');
visualAdapters.forEach(name=>assert.strictEqual(scriptNames.filter(src=>src===name).length,1,name+' loads once'));
assert.strictEqual(manifest.scriptCount,417+nativeModules.length+fiscalModules.length+recoveryModules.length+outputContractModules.length+visualAdapters.length+requestControls.length+enactedOrderModules.length,'retain every prior script and every explicitly registered runtime addition');
fiscalModules.forEach(name=>assert.strictEqual(scriptNames.filter(src=>src===name).length,1,name+' loads once'));
assert(scriptNames.indexOf('tm-fiscal-statements.js')<scriptNames.indexOf('tm-fiscal-engine.js'),'shared statements precede the fiscal engine');
assert(scriptNames.indexOf('tm-public-treasury.js')<scriptNames.indexOf('tm-military-arrears.js'),'public treasury precedes army liabilities');
nativeModules.forEach(name=>assert.strictEqual(scriptNames.filter(src=>src===name).length,1,name+' loads once'));
assert(!scriptNames.includes('tm-start-preparation-runtime.js'),'the opaque initializer must not run in the live game window');
assert(scriptNames.indexOf('tm-start-contracts.js')<scriptNames.indexOf('tm-start-compiler.js'),'native contracts precede their compiler');
assert(scriptNames.indexOf('tm-start-compiler.js')<scriptNames.indexOf('tm-start-selector.js'),'native compiler precedes the chooser');
assert.strictEqual(scriptNames.indexOf('tm-save-world-validation.js')+1,scriptNames.indexOf('tm-save-lifecycle.js'),'the preserved save-validation family stays adjacent');
assert.strictEqual(scriptNames.indexOf('tm-military.js')+1,scriptNames.indexOf('tm-battle-contract.js'),'shared battle contract immediately follows its canonical writer');
assert.strictEqual(scriptNames.filter(name=>name==='tm-battle-contract.js').length,1,'battle contract loads exactly once');
assert.strictEqual(scriptNames.filter((name) => name === 'tm-office-creation.js').length, 1, 'office creation loads exactly once');
assert(scriptNames.indexOf('tm-office-creation.js') < scriptNames.indexOf('tm-office-reform.js'), 'creation contract precedes its structural writer');
assert(scriptNames.indexOf('tm-office-creation.js') < scriptNames.indexOf('tm-edict-parser.js'), 'creation contract precedes natural-language edict dispatch');
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
assert.strictEqual(manifest.features.reduce((count, row) => count + row.scripts.length, 0), 9, 'feature definitions own exactly nine declared deferred scripts');
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
