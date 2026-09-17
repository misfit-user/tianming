'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB_ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(WEB_ROOT, 'index.html');
const MANIFEST_PATH = path.join(WEB_ROOT, 'bundled-scenarios', 'manifest.js');
const LOADER_PATH = path.join(WEB_ROOT, 'tm-official-scenario-loader.js');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function listedLocalScripts(html) {
  const scripts = [];
  const pattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const clean = match[1].split(/[?#]/, 1)[0];
    if (/^(?:https?:)?\/\//i.test(clean)) continue;
    scripts.push(clean.replace(/^\.\//, ''));
  }
  return scripts;
}

async function runLoaderContract() {
  const state = { appendCount: 0, appendedSources: [] };
  const listeners = Object.create(null);
  const P = { scenarios: [], characters: [] };
  const context = {
    P,
    console,
    Promise,
    setTimeout,
    clearTimeout,
    fetch: undefined,
    addEventListener(type, handler) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    document: {
      createElement(tag) {
        assert.strictEqual(tag, 'script');
        return { src: '', async: false, onload: null, onerror: null };
      },
      head: {
        appendChild(script) {
          state.appendCount += 1;
          state.appendedSources.push(script.src);
          setTimeout(() => {
            const manifest = context.TMOfficialScenarioManifest;
            const entry = manifest.entries.find((candidate) => script.src.startsWith(candidate.scriptUrl));
            if (!entry) {
              script.onerror(new Error('unexpected script URL'));
              return;
            }
            const placeholderIndex = P.scenarios.findIndex((scenario) => scenario.id === entry.id);
            if (placeholderIndex >= 0) P.scenarios.splice(placeholderIndex, 1);
            P.scenarios.push({
              id: entry.id,
              name: `FULL:${entry.name}`,
              characters: [{ id: 'loaded-character' }],
              factions: [],
              regions: []
            });
            script.onload();
          }, 0);
        }
      },
      documentElement: { appendChild() { throw new Error('document.head should be used'); } }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(read(MANIFEST_PATH), context, { filename: MANIFEST_PATH });
  vm.runInContext(read(LOADER_PATH), context, { filename: LOADER_PATH });

  const loader = context.TMOfficialScenarioLoader;
  assert(loader, 'loader should register itself');
  await loader.ready();

  const entries = context.TMOfficialScenarioManifest.entries;
  assert.strictEqual(entries.length, 3, 'manifest should expose all three official scenarios');
  assert.strictEqual(P.scenarios.length, entries.length, 'ready() should register all lightweight placeholders');
  for (const entry of entries) {
    const placeholder = P.scenarios.find((scenario) => scenario.id === entry.id);
    assert(placeholder && placeholder._lazyOfficial === true, `${entry.id} should remain lazy before selection`);
    assert.deepStrictEqual(
      JSON.parse(JSON.stringify(loader.counts(entry.id))),
      JSON.parse(JSON.stringify(entry.counts)),
      `${entry.id} counts should come from manifest metadata`
    );
  }
  assert.strictEqual(state.appendCount, 0, 'metadata registration must not load a full scenario');

  const target = entries[0];
  const first = loader.ensure(target.id);
  const second = loader.ensure(target.id);
  assert.strictEqual(first, second, 'concurrent ensure() calls should share one promise');
  const loaded = await first;
  assert.strictEqual(state.appendCount, 1, 'concurrent ensure() calls should append one script');
  assert.strictEqual(loaded.id, target.id);
  assert.strictEqual(loaded._lazyOfficial, undefined, 'resolved scenario must be the full payload');
  assert.strictEqual(loader.isLazy(target.id), false);
  assert(state.appendedSources[0].includes(`?v=${target.sha256.slice(0, 16)}`), 'loader should cache-bust by manifest hash');

  const again = await loader.ensure(target.id);
  assert.strictEqual(again, loaded, 'already loaded scenario should resolve without another script');
  assert.strictEqual(state.appendCount, 1);
  assert.strictEqual(loader.isLazy(entries[1].id), true, 'unselected official scenario should remain lazy');

  const otherPlaceholder = P.scenarios.find((scenario) => scenario.id === entries[1].id);
  P.scenarios = [
    { id: target.id, name: 'STALE PERSISTED OFFICIAL', characters: [{ id: 'stale' }] },
    otherPlaceholder,
    { id: 'custom-scenario', name: 'Custom' }
  ];
  P.characters = [
    { id: 'stale-official-row', sid: target.id },
    { id: 'custom-row', sid: 'custom-scenario' }
  ];
  for (const handler of listeners['tm:p-restored'] || []) handler({ detail: { source: 'smoke' } });

  assert(loader.isLazy(target.id), 'async P restore should replace persisted official payload with metadata');
  assert(P.scenarios.some((scenario) => scenario.id === 'custom-scenario'), 'restore reconciliation must preserve custom scenarios');
  assert(!P.characters.some((row) => row.sid === target.id), 'restore reconciliation should remove persisted official rows before a game starts');
  assert(P.characters.some((row) => row.sid === 'custom-scenario'), 'restore reconciliation must preserve custom rows');

  const reloaded = await loader.ensure(target.id);
  assert.strictEqual(reloaded.id, target.id);
  assert.strictEqual(state.appendCount, 2, 'restore replacement should invalidate the resolved load promise and reload once');

  context.GM = { running: true, sid: target.id };
  P.scenarios = P.scenarios.filter((scenario) => scenario.id !== target.id);
  P.scenarios.push({ id: target.id, name: 'LATE ACTIVE RESTORE', globalRules: 'persisted' });
  for (const handler of listeners['tm:p-restored'] || []) handler({ detail: { source: 'active-smoke' } });
  const activeScenario = P.scenarios.find((scenario) => scenario.id === target.id);
  assert.strictEqual(activeScenario, reloaded, 'late restore must reattach the package-loaded full scenario for the active game');
  assert.strictEqual(await loader.ensure(target.id), reloaded, 'active ensure must not return an object detached from P.scenarios');
  assert.strictEqual(state.appendCount, 2);

  const deferredEntry = entries[1];
  context.GM.sid = deferredEntry.id;
  P.scenarios = P.scenarios.filter((scenario) => scenario.id !== deferredEntry.id);
  const persistedActive = { id: deferredEntry.id, name: 'ACTIVE PERSISTED FULL', globalRules: 'keep while running' };
  P.scenarios.push(persistedActive);
  for (const handler of listeners['tm:p-restored'] || []) handler({ detail: { source: 'active-persisted-smoke' } });
  assert.strictEqual(
    P.scenarios.find((scenario) => scenario.id === deferredEntry.id),
    persistedActive,
    'active game must never be downgraded to a metadata placeholder'
  );
  context.GM.running = false;
  loader.reconcile();
  assert(loader.isLazy(deferredEntry.id), 'deferred persisted payload should normalize after the active game ends');
}

async function runManifestFetchFallbackContract() {
  const manifest = JSON.parse(read(path.join(WEB_ROOT, 'bundled-scenarios', 'manifest.json')));
  let fetchCalls = 0;
  const context = {
    P: { scenarios: [] },
    console,
    Promise,
    setTimeout,
    clearTimeout,
    addEventListener() {},
    fetch: async function(url) {
      fetchCalls += 1;
      assert.strictEqual(url, 'bundled-scenarios/manifest.json');
      return { ok: true, status: 200, json: async function(){ return manifest; } };
    },
    document: {
      createElement() { return {}; },
      head: { appendChild() { throw new Error('fallback metadata test must not load full scripts'); } },
      documentElement: { appendChild() { throw new Error('fallback metadata test must not load full scripts'); } }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(read(LOADER_PATH), context, { filename: LOADER_PATH });
  assert.strictEqual(context.TMOfficialScenarioLoader.reconcile(), false, 'reconcile must not mark missing manifest metadata ready');
  await context.TMOfficialScenarioLoader.ready();
  assert.strictEqual(fetchCalls, 1, 'missing manifest.js should fall back to manifest.json exactly once');
  assert.strictEqual(context.P.scenarios.length, manifest.entries.length, 'fetch fallback should register all metadata placeholders');
}

async function runStalledManifestRetryContract() {
  const manifest = JSON.parse(read(path.join(WEB_ROOT, 'bundled-scenarios', 'manifest.json')));
  let fetchCalls = 0;
  const context = {
    P: { scenarios: [] },
    console,
    Promise,
    setTimeout,
    clearTimeout,
    AbortController,
    TM_OFFICIAL_SCENARIO_MANIFEST_TIMEOUT_MS: 20,
    TM_OFFICIAL_SCENARIO_LOAD_RETRIES: 1,
    addEventListener() {},
    fetch: function() {
      fetchCalls += 1;
      if (fetchCalls === 1) return new Promise(function(){});
      return Promise.resolve({ ok: true, status: 200, json: async function(){ return manifest; } });
    },
    document: {
      createElement() { return {}; },
      head: { appendChild() { throw new Error('manifest retry test must not load a full script'); } },
      documentElement: { appendChild() { throw new Error('manifest retry test must not load a full script'); } }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(read(LOADER_PATH), context, { filename: LOADER_PATH });
  const result = await Promise.race([
    context.TMOfficialScenarioLoader.ready().then(function(){ return 'ready'; }),
    new Promise(function(resolve){ setTimeout(function(){ resolve('hung'); }, 500); })
  ]);
  assert.strictEqual(result, 'ready', 'stalled manifest fetch did not time out and retry');
  assert.strictEqual(fetchCalls, 2, 'manifest timeout should retry exactly once');
}

async function runStalledScriptRetryContract() {
  const id = 'smoke-stalled-official';
  const state = { appendCount: 0, removedCount: 0 };
  const P = { scenarios: [] };
  const context = {
    P,
    console,
    Promise,
    setTimeout,
    clearTimeout,
    fetch: undefined,
    TM_OFFICIAL_SCENARIO_MANIFEST_TIMEOUT_MS: 20,
    TM_OFFICIAL_SCENARIO_SCRIPT_TIMEOUT_MS: 20,
    TM_OFFICIAL_SCENARIO_LOAD_RETRIES: 1,
    TMOfficialScenarioManifest: {
      entries: [{ id, name: 'Stalled smoke', scriptUrl: 'scenarios/stalled-smoke.js', sha256: 'abcdef0123456789' }]
    },
    addEventListener() {},
    document: {
      createElement() {
        return {
          src: '', async: false, onload: null, onerror: null,
          remove() { state.removedCount += 1; }
        };
      },
      head: {
        appendChild(script) {
          state.appendCount += 1;
          if (state.appendCount === 1) return; // 浏览器请求永久 pending
          setTimeout(function(){
            P.scenarios = P.scenarios.filter(function(sc){ return !sc || sc.id !== id; });
            P.scenarios.push({ id, name: 'FULL:stalled smoke', globalRules: 'loaded on retry' });
            script.onload();
          }, 0);
        }
      },
      documentElement: { appendChild() { throw new Error('document.head should be used'); } }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(read(LOADER_PATH), context, { filename: LOADER_PATH });
  const result = await Promise.race([
    context.TMOfficialScenarioLoader.ensure(id),
    new Promise(function(resolve){ setTimeout(function(){ resolve(null); }, 500); })
  ]);
  assert(result && result.globalRules === 'loaded on retry', 'stalled official script did not time out and retry');
  assert.strictEqual(state.appendCount, 2, 'stalled script should append exactly one retry');
  assert.strictEqual(state.removedCount, 1, 'timed-out script element should be removed before retry');
}

function runIndexBudgetContract() {
  const html = read(INDEX_PATH);
  const scripts = listedLocalScripts(html);
  assert(scripts.includes('bundled-scenarios/manifest.js'), 'index should load official scenario metadata');
  assert(scripts.includes('tm-official-scenario-loader.js'), 'index should load the lazy loader');
  assert(!scripts.includes('scenarios/tianqi7-1627.js'), 'Tianqi full payload must not be initial-blocking');
  assert(!scripts.includes('scenarios/shaosong-jianyan-1127.js'), 'Shaosong full payload must not be initial-blocking');
  assert(
    !html.includes('tianqi7-official-runtime-snapshot.js'),
    'index must not undo lazy loading by injecting the legacy Tianqi snapshot during idle time'
  );

  let initialBytes = 0;
  const missing = [];
  for (const relative of scripts) {
    const file = path.join(WEB_ROOT, ...relative.split('/'));
    if (!fs.existsSync(file)) {
      missing.push(relative);
      continue;
    }
    initialBytes += fs.statSync(file).size;
  }
  assert.deepStrictEqual(missing, [], `index references missing local scripts: ${missing.join(', ')}`);
  const budget = 24 * 1024 * 1024;
  assert(
    initialBytes < budget,
    `initial local script payload ${(initialBytes / 1024 / 1024).toFixed(2)} MiB exceeds ${budget / 1024 / 1024} MiB budget`
  );
  return { initialBytes, scriptCount: scripts.length };
}

(async function main() {
  await runLoaderContract();
  await runManifestFetchFallbackContract();
  await runStalledManifestRetryContract();
  await runStalledScriptRetryContract();
  const budget = runIndexBudgetContract();
  console.log(
    `official scenario lazy-loader smoke: PASS (${budget.scriptCount} initial scripts, ` +
    `${(budget.initialBytes / 1024 / 1024).toFixed(2)} MiB)`
  );
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
