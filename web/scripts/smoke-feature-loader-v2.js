#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const featureBuild = require('./build-feature-manifest');

const WEB = path.resolve(__dirname, '..');
const LOADER = fs.readFileSync(path.join(WEB, 'tm-feature-loader.js'), 'utf8');
const MANIFEST = fs.readFileSync(path.join(WEB, 'feature-manifest.js'), 'utf8');

function tick() { return new Promise((resolve) => setImmediate(resolve)); }
async function settle(rounds = 8) { for (let i = 0; i < rounds; i++) await tick(); }

function makeEnvironment(options = {}) {
  const loads = [];
  const scriptNodes = [];
  const loadHandlers = [];
  const idleHandlers = [];
  const lifecycle = { desktopInit: 0, desktopDispose: 0, onlineInit: 0, onlineDispose: 0 };
  const failures = Object.assign({}, options.failures || {});
  const manualScripts = new Set(options.manualScripts || []);
  let context;

  const document = {
    readyState: options.readyState || 'loading',
    createElement(tag) {
      return {
        tagName: String(tag).toUpperCase(),
        dataset: {},
        async: true,
        onload: null,
        onerror: null,
        removed: false,
        remove() { this.removed = true; }
      };
    },
    head: { appendChild: appendScript },
    documentElement: { appendChild: appendScript }
  };

  function clean(src) { return String(src).replace(/[?#].*$/, ''); }
  function appendScript(script) {
    const src = clean(script.src);
    loads.push(src);
    scriptNodes.push(script);
    if (manualScripts.has(src)) return script;
    Promise.resolve().then(() => {
      if (failures[src] > 0) {
        failures[src] -= 1;
        if (script.onerror) script.onerror(new Error('injected load failure'));
        return;
      }
      if (src === 'feature-manifest.js') vm.runInContext(MANIFEST, context, { filename: src });
      else if (src === 'tm-test-harness.js') context.TM.test = { run() {} };
      else if (src === 'tm-update-card.js') context.TMUpdateCard = {};
      else if (src === 'tm-desktop-update.js') {
        context.TMDesktopUpdate = {
          init() { lifecycle.desktopInit += 1; },
          dispose() { lifecycle.desktopDispose += 1; }
        };
      } else if (src === 'tm-online-update.js') {
        context.TM_OnlineUpdate = {
          init() { lifecycle.onlineInit += 1; },
          dispose() { lifecycle.onlineDispose += 1; }
        };
      } else if (src === 'tm-map-label-geo.js') context.TMMapLabelGeo = {};
      else if (src === 'tm-map-realm-layout.js') context.TMMapRealmLayout = {};
      else if (src === 'tm-map-label-collide.js') context.TMMapLabelCollide = {};
      else if (src === 'retry-once.js') context.RetryOnce = {};
      else if (src === 'always-fail.js') {
        if (script.onerror) script.onerror(new Error('always fails'));
        return;
      }
      if (script.onload) script.onload();
    });
    return script;
  }

  const root = {
    console: { warn() {}, log() {}, error() {} },
    Promise,
    Map,
    Object,
    Array,
    Error,
    Number,
    String,
    RegExp,
    Date,
    setTimeout,
    clearTimeout,
    document,
    location: { search: options.search || '' },
    TM: { platform: { kind: options.platform || 'web' } },
    addEventListener(type, fn) { if (type === 'load') loadHandlers.push(fn); },
    requestIdleCallback(fn) { idleHandlers.push(fn); return idleHandlers.length; }
  };
  root.window = root;
  root.globalThis = root;
  context = vm.createContext(root);
  vm.runInContext(LOADER, context, { filename: 'tm-feature-loader.js' });
  return {
    root,
    loads,
    scriptNodes,
    lifecycle,
    completeManual(src, install) {
      const cleanSrc = clean(src);
      const script = scriptNodes.find((row) => clean(row.src) === cleanSrc);
      if (!script) throw new Error('manual script was not inserted: ' + cleanSrc);
      if (typeof install === 'function') install(context);
      if (script.onload) script.onload();
      return script;
    },
    fireLoad() { document.readyState = 'complete'; loadHandlers.splice(0).forEach((fn) => fn()); },
    fireIdle() { idleHandlers.splice(0).forEach((fn) => fn()); }
  };
}

(async function main() {
  const desktop = makeEnvironment({ platform: 'electron' });
  assert.strictEqual(desktop.root.TM.test, undefined, 'normal production startup does not expose TM.test');
  const concurrent = Array.from({ length: 10 }, () => desktop.root.TM.Features.ensure('desktopUpdate'));
  const results = await Promise.all(concurrent);
  assert(results.every((row) => row.ok), 'ten concurrent ensure calls resolve successfully');
  assert.strictEqual(desktop.loads.filter((src) => src === 'feature-manifest.js').length, 1, 'manifest script loads once');
  assert.strictEqual(desktop.loads.filter((src) => src === 'tm-update-card.js').length, 1, 'first feature script loads once');
  assert.strictEqual(desktop.loads.filter((src) => src === 'tm-desktop-update.js').length, 1, 'second feature script loads once');
  assert(desktop.loads.indexOf('tm-update-card.js') < desktop.loads.indexOf('tm-desktop-update.js'), 'classic scripts load in declared sequence');
  assert.strictEqual(desktop.lifecycle.desktopInit, 1, 'feature init executes once');
  await desktop.root.TM.Features.dispose('desktopUpdate');
  await desktop.root.TM.Features.dispose('desktopUpdate');
  assert.strictEqual(desktop.lifecycle.desktopDispose, 1, 'feature dispose is idempotent');
  await desktop.root.TM.Features.ensure('desktopUpdate');
  assert.strictEqual(desktop.lifecycle.desktopInit, 2, 'disposed feature can initialize again without reloading scripts');
  assert.strictEqual(desktop.loads.filter((src) => src === 'tm-desktop-update.js').length, 1, 'reinitialization reuses loaded script');

  const mismatch = await desktop.root.TM.Features.ensure('onlineUpdate');
  assert.strictEqual(mismatch.code, 'not-applicable', 'desktop rejects web-only feature with a structured result');

  desktop.root.TM.Features.define('missingProvider', {
    scripts: ['missing-provider.js'], dependsOn: [], platform: 'any', provides: ['NeverDefined']
  });
  await assert.rejects(desktop.root.TM.Features.ensure('missingProvider'), (error) => error.code === 'feature-provider-missing');

  const retry = makeEnvironment({ platform: 'web', failures: { 'retry-once.js': 1 } });
  retry.root.TM.Features.define('retryOnce', {
    scripts: ['retry-once.js'], dependsOn: [], platform: 'any', provides: ['RetryOnce']
  });
  await assert.rejects(retry.root.TM.Features.ensure('retryOnce'), (error) => error.code === 'feature-script-load-failed');
  await assert.rejects(retry.root.TM.Features.ensure('retryOnce'), (error) => error.code === 'feature-retry-required');
  const retried = await retry.root.TM.Features.retry('retryOnce');
  assert.strictEqual(retried.ok, true, 'one explicit retry can recover a failed feature');
  assert.strictEqual(retry.loads.filter((src) => src === 'retry-once.js').length, 2, 'retry inserts the failed script exactly once more');

  const recoverable = makeEnvironment({ platform: 'web', failures: { 'retry-once.js': 1 } });
  recoverable.root.TM.Features.define('recoverableLoad', {
    scripts: ['retry-once.js'], dependsOn: [], platform: 'any', provides: ['RetryOnce']
  });
  const recovered = await recoverable.root.TM.Features.ensureRecoverable('recoverableLoad');
  assert.strictEqual(recovered.ok, true, 'controlled recovery retries an explicit network load error');
  assert.strictEqual(recoverable.loads.filter((src) => src === 'retry-once.js').length, 2, 'controlled recovery performs at most one second insertion after onerror');

  const initRecovery = makeEnvironment({ platform: 'web' });
  let initAttempts = 0;
  let initRollbacks = 0;
  initRecovery.root.TM.Features.define('recoverableInit', {
    scripts: ['retry-once.js'],
    dependsOn: [],
    platform: 'any',
    provides: ['RetryOnce'],
    init() {
      initAttempts += 1;
      if (initAttempts === 1) throw new Error('injected init failure');
    },
    dispose() { initRollbacks += 1; }
  });
  const initRecovered = await initRecovery.root.TM.Features.ensureRecoverable('recoverableInit');
  assert.strictEqual(initRecovered.ok, true, 'controlled recovery retries init only after rollback');
  assert.strictEqual(initAttempts, 2, 'init retry executes exactly twice');
  assert.strictEqual(initRollbacks, 1, 'failed init performs exactly one rollback before retry');

  retry.root.TM.Features.define('alwaysFail', {
    scripts: ['always-fail.js'], dependsOn: [], platform: 'any', provides: ['Never']
  });
  await assert.rejects(retry.root.TM.Features.ensure('alwaysFail'));
  await assert.rejects(retry.root.TM.Features.retry('alwaysFail'));
  await assert.rejects(retry.root.TM.Features.retry('alwaysFail'), (error) => error.code === 'feature-retry-limit');

  const late = makeEnvironment({ platform: 'web', manualScripts: ['slow-late.js'] });
  let lateInit = 0;
  late.root.TM.Features.define('slowLate', {
    scripts: ['slow-late.js'],
    dependsOn: [],
    platform: 'any',
    provides: ['SlowLate'],
    timeoutMs: 5,
    init() { lateInit += 1; }
  });
  await assert.rejects(late.root.TM.Features.ensure('slowLate'), (error) => error.code === 'feature-script-timeout');
  assert.strictEqual(late.scriptNodes.length, 1, 'timeout inserts only one script node');
  assert.strictEqual(late.scriptNodes[0].removed, true, 'timeout best-effort removes the orphaned script node');
  late.completeManual('slow-late.js', (ctx) => {
    ctx.SlowLate = {};
    ctx.__lateScriptExecutions = (ctx.__lateScriptExecutions || 0) + 1;
  });
  await settle();
  await assert.rejects(late.root.TM.Features.retry('slowLate'), (error) => error.code === 'feature-reload-required');
  await assert.rejects(late.root.TM.Features.ensureRecoverable('slowLate'), (error) => error.code === 'feature-reload-required');
  assert.strictEqual(late.loads.filter((src) => src === 'slow-late.js').length, 1, 'late completion cannot trigger a duplicate same-src insertion');
  assert.strictEqual(late.root.__lateScriptExecutions, 1, 'late classic script executes at most once in the document');
  assert.strictEqual(lateInit, 0, 'late completion does not run feature init after timeout');

  const disposeBeforeInit = makeEnvironment({ platform: 'web', manualScripts: ['dispose-before-init.js'] });
  let skippedInitCalls = 0;
  let skippedDisposeCalls = 0;
  disposeBeforeInit.root.TM.Features.define('disposeBeforeInit', {
    scripts: ['dispose-before-init.js'],
    dependsOn: [],
    platform: 'any',
    provides: ['DisposeBeforeInit'],
    init() { skippedInitCalls += 1; },
    dispose() { skippedDisposeCalls += 1; }
  });
  const pendingBeforeInit = disposeBeforeInit.root.TM.Features.ensure('disposeBeforeInit');
  await settle(2);
  const disposeBeforeInitResult = disposeBeforeInit.root.TM.Features.dispose('disposeBeforeInit');
  disposeBeforeInit.completeManual('dispose-before-init.js', (ctx) => { ctx.DisposeBeforeInit = {}; });
  const beforeInitResults = await Promise.all([pendingBeforeInit, disposeBeforeInitResult]);
  assert.strictEqual(beforeInitResults[0].state, 'disposed', 'load resolves deterministically as disposed when disposal wins before init');
  assert.strictEqual(skippedInitCalls, 0, 'dispose requested during script loading skips init');
  assert.strictEqual(skippedDisposeCalls, 0, 'skipped init does not invoke an unnecessary disposer');
  assert.strictEqual(disposeBeforeInit.root.TM.Features.status('disposeBeforeInit').state, 'disposed', 'in-flight dispose leaves a stable disposed state');

  const disposeDuringInit = makeEnvironment({ platform: 'web' });
  let releaseInit;
  let duringInitCalls = 0;
  let duringDisposeCalls = 0;
  disposeDuringInit.root.TM.Features.define('disposeDuringInit', {
    scripts: ['retry-once.js'],
    dependsOn: [],
    platform: 'any',
    provides: ['RetryOnce'],
    init() {
      duringInitCalls += 1;
      return new Promise((resolve) => { releaseInit = resolve; });
    },
    dispose() { duringDisposeCalls += 1; }
  });
  const pendingDuringInit = disposeDuringInit.root.TM.Features.ensure('disposeDuringInit');
  await settle(4);
  assert.strictEqual(duringInitCalls, 1, 'async init is in flight before disposal');
  const disposeDuringInitResult = disposeDuringInit.root.TM.Features.dispose('disposeDuringInit');
  releaseInit();
  await Promise.all([pendingDuringInit, disposeDuringInitResult]);
  assert.strictEqual(duringDisposeCalls, 1, 'dispose waits for in-flight init and runs the disposer exactly once');
  assert.strictEqual(disposeDuringInit.root.TM.Features.status('disposeDuringInit').state, 'disposed', 'dispose during init cannot later become ready');

  const runtimeCycle = makeEnvironment({ platform: 'web' });
  assert.throws(() => runtimeCycle.root.TM.Features.registerManifest({
    version: 1,
    features: {
      cycleA: { scripts: ['a.js'], dependsOn: ['cycleB'], platform: 'any', provides: ['CycleA'] },
      cycleB: { scripts: ['b.js'], dependsOn: ['cycleA'], platform: 'any', provides: ['CycleB'] }
    }
  }), (error) => error.code === 'feature-dependency-cycle', 'runtime manifest registration rejects a two-node dependency cycle');
  assert.strictEqual(runtimeCycle.root.TM.Features.status('cycleA').state, 'unknown', 'cycle rejection is atomic and installs no partial definitions');

  assert.throws(() => featureBuild.validateFeatureManifest({
    version: 1,
    features: {
      cycleA: { scripts: ['tm-update-card.js'], dependsOn: ['cycleB'], platform: 'any', loadPolicy: 'on-demand', sideEffects: 'none', provides: ['CycleA'] },
      cycleB: { scripts: ['tm-desktop-update.js'], dependsOn: ['cycleC'], platform: 'any', loadPolicy: 'on-demand', sideEffects: 'none', provides: ['CycleB'] },
      cycleC: { scripts: ['tm-online-update.js'], dependsOn: ['cycleA'], platform: 'any', loadPolicy: 'on-demand', sideEffects: 'none', provides: ['CycleC'] }
    }
  }), /feature dependency cycle: cycleA -> cycleB -> cycleC -> cycleA/, 'build-time manifest validation rejects a three-node dependency cycle');

  const normal = makeEnvironment({ platform: 'web' });
  normal.fireLoad();
  await settle();
  assert.strictEqual(normal.root.TM.test, undefined, 'window load without a test query still does not load the harness');
  assert(!normal.loads.includes('tm-online-update.js'), 'web update waits for the idle boundary');
  normal.fireIdle();
  await settle();
  assert(normal.loads.includes('tm-online-update.js'), 'web idle boundary loads online update');
  assert.strictEqual(normal.lifecycle.onlineInit, 1, 'web update lifecycle initializes once');

  const harness = makeEnvironment({ platform: 'web', search: '?devHarness=1' });
  harness.fireLoad();
  await settle();
  assert(harness.root.TM.test && typeof harness.root.TM.test.run === 'function', 'development query loads the browser harness after window load');
  assert.strictEqual(harness.loads.filter((src) => src === 'tm-test-harness.js').length, 1, 'query path loads the harness once');

  const touch = makeEnvironment({ platform: 'capacitor' });
  const mapLabels = await touch.root.TM.Features.ensure('formalMapLabels');
  assert.strictEqual(mapLabels.ok, true, 'platform any feature loads on touch/capacitor');
  assert(touch.root.TMMapLabelGeo && touch.root.TMMapRealmLayout && touch.root.TMMapLabelCollide, 'touch branch receives all three map label providers');
  assert.strictEqual((await touch.root.TM.Features.ensure('desktopUpdate')).code, 'not-applicable', 'touch branch rejects desktop-only feature');

  console.log('[smoke-feature-loader-v2] PASS assertions=51');
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
