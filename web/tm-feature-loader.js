// tm-feature-loader.js — explicit, lifecycle-aware classic-script feature boundaries.
(function (root) {
  'use strict';
  if (!root || !root.document) return;

  root.TM = root.TM || {};

  var MANIFEST_SRC = 'feature-manifest.js?v=20260909-relief';
  var DEFAULT_TIMEOUT_MS = 15000;
  var definitions = Object.create(null);
  var runtime = Object.create(null);
  var scriptLoads = Object.create(null);
  var manifestPromise = null;
  var scriptAttemptId = 0;

  function featureError(code, message, details) {
    var error = new Error(message || code);
    error.code = code;
    error.details = details || {};
    return error;
  }

  function report(error, phase, feature) {
    var payload = {
      code: error && error.code ? error.code : 'feature-error',
      phase: phase || 'unknown',
      feature: feature || '',
      message: error && error.message ? error.message : String(error || 'unknown feature error')
    };
    try {
      if (root.TM && root.TM.Diagnostics && typeof root.TM.Diagnostics.capture === 'function') {
        root.TM.Diagnostics.capture('feature-loader', payload);
      } else if (root.console && typeof root.console.warn === 'function') {
        root.console.warn('[TM.Features]', payload);
      }
    } catch (diagnosticError) {
      if (root.console && typeof root.console.warn === 'function') {
        root.console.warn('[TM.Features] diagnostic failed', diagnosticError);
      }
    }
  }

  function normalizeScripts(value) {
    if (!Array.isArray(value) || !value.length) throw featureError('invalid-feature-definition', 'feature scripts must be a non-empty array');
    return value.map(function (entry) {
      if (typeof entry !== 'string' || !entry.trim()) throw featureError('invalid-feature-script', 'feature script path must be a non-empty string');
      return entry.trim();
    });
  }

  function normalizeDefinition(name, input) {
    if (!name || typeof name !== 'string') throw featureError('invalid-feature-name', 'feature name must be a non-empty string');
    input = input || {};
    return {
      name: name,
      scripts: normalizeScripts(input.scripts),
      dependsOn: Array.isArray(input.dependsOn) ? input.dependsOn.slice() : [],
      platform: input.platform || 'any',
      provides: Array.isArray(input.provides) ? input.provides.slice() : [],
      loadPolicy: input.loadPolicy || 'on-demand',
      sideEffects: input.sideEffects || 'legacy-unknown',
      init: typeof input.init === 'function' ? input.init : null,
      dispose: typeof input.dispose === 'function' ? input.dispose : null,
      timeoutMs: Number.isFinite(Number(input.timeoutMs)) && Number(input.timeoutMs) > 0
        ? Number(input.timeoutMs) : DEFAULT_TIMEOUT_MS
    };
  }

  function stateFor(name) {
    if (!runtime[name]) {
      runtime[name] = {
        state: definitions[name] ? 'defined' : 'unknown',
        promise: null,
        initialized: false,
        retryCount: 0,
        lastError: null,
        generation: 0,
        disposeRequested: false
      };
    }
    return runtime[name];
  }

  function dependencyCycle(graph) {
    var visiting = Object.create(null);
    var visited = Object.create(null);

    function walk(name, trail) {
      if (visiting[name]) {
        var start = trail.indexOf(name);
        return trail.slice(start >= 0 ? start : 0).concat(name);
      }
      if (visited[name] || !graph[name]) return null;
      visiting[name] = true;
      var nextTrail = trail.concat(name);
      var dependencies = Array.isArray(graph[name].dependsOn) ? graph[name].dependsOn : [];
      for (var i = 0; i < dependencies.length; i++) {
        if (!graph[dependencies[i]]) continue;
        var cycle = walk(dependencies[i], nextTrail);
        if (cycle) return cycle;
      }
      visiting[name] = false;
      visited[name] = true;
      return null;
    }

    var names = Object.keys(graph);
    for (var i = 0; i < names.length; i++) {
      var cycle = walk(names[i], []);
      if (cycle) return cycle;
    }
    return null;
  }

  function assertNoDependencyCycle(graph) {
    var cycle = dependencyCycle(graph);
    if (cycle) {
      throw featureError('feature-dependency-cycle', 'feature dependency cycle: ' + cycle.join(' -> '), {
        cycle: cycle
      });
    }
  }

  function graphWith(pending) {
    var graph = Object.create(null);
    Object.keys(definitions).forEach(function (name) { graph[name] = definitions[name]; });
    Object.keys(pending || {}).forEach(function (name) { graph[name] = pending[name]; });
    return graph;
  }

  function define(name, input) {
    if (definitions[name]) throw featureError('duplicate-feature-definition', 'feature is already defined: ' + name, { feature: name });
    var pending = Object.create(null);
    pending[name] = normalizeDefinition(name, input);
    assertNoDependencyCycle(graphWith(pending));
    definitions[name] = pending[name];
    stateFor(name).state = 'defined';
    return definitions[name];
  }

  function registerManifest(manifest) {
    if (!manifest || manifest.version !== 1 || !manifest.features || typeof manifest.features !== 'object') {
      throw featureError('invalid-feature-manifest', 'feature manifest version 1 is required');
    }
    var names = Object.keys(manifest.features);
    var pending = Object.create(null);
    names.forEach(function (name) {
      if (definitions[name]) throw featureError('duplicate-feature-definition', 'feature is already defined: ' + name, { feature: name });
      pending[name] = normalizeDefinition(name, manifest.features[name]);
    });
    assertNoDependencyCycle(graphWith(pending));
    names.forEach(function (name) {
      definitions[name] = pending[name];
      stateFor(name).state = 'defined';
    });
    return names.length;
  }

  function platformKind() {
    try {
      if (root.TM && root.TM.platform && root.TM.platform.kind) return String(root.TM.platform.kind);
      if (root.tianming) return 'electron';
      if (root.Capacitor && typeof root.Capacitor.isNativePlatform === 'function' && root.Capacitor.isNativePlatform()) return 'capacitor';
    } catch (error) {
      report(error, 'platform-detection');
    }
    return 'web';
  }

  function applicable(expected, actual) {
    if (!expected || expected === 'any') return true;
    if (Array.isArray(expected)) return expected.indexOf(actual) >= 0;
    if (expected === 'desktop') return actual === 'electron';
    if (expected === 'touch') return actual === 'capacitor';
    return expected === actual;
  }

  function resolvePath(pathText) {
    var parts = String(pathText || '').split('.');
    var value = root;
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i] || value == null || !Object.prototype.hasOwnProperty.call(value, parts[i])) return undefined;
      value = value[parts[i]];
    }
    return value;
  }

  function verifyProvides(definition) {
    var missing = definition.provides.filter(function (pathText) { return typeof resolvePath(pathText) === 'undefined'; });
    if (missing.length) {
      throw featureError('feature-provider-missing', 'feature did not provide required globals: ' + missing.join(', '), {
        feature: definition.name,
        missing: missing
      });
    }
  }

  function scriptRequiresReload(record) {
    return !!record && (record.state === 'timed-out' || record.state === 'loaded-late' || record.state === 'failed-after-timeout');
  }

  function removeScriptNode(node) {
    if (!node) return;
    try {
      if (typeof node.remove === 'function') node.remove();
      else if (node.parentNode && typeof node.parentNode.removeChild === 'function') node.parentNode.removeChild(node);
    } catch (error) {
      report(error, 'script-remove');
    }
  }

  function reloadRequiredError(src, record) {
    return featureError('feature-reload-required', 'feature script timed out; reload the page before trying again: ' + src, {
      script: src,
      scriptState: record && record.state || 'timed-out',
      attemptId: record && record.attemptId || 0
    });
  }

  function loadScript(src, timeoutMs) {
    var existing = scriptLoads[src];
    if (existing) {
      if (scriptRequiresReload(existing)) return Promise.reject(reloadRequiredError(src, existing));
      return existing.promise;
    }

    var record = {
      state: 'loading',
      node: null,
      promise: null,
      attemptId: ++scriptAttemptId,
      error: null
    };
    scriptLoads[src] = record;
    record.promise = new Promise(function (resolve, reject) {
      var script = root.document.createElement('script');
      record.node = script;
      var settled = false;
      var timer = root.setTimeout(function () {
        if (settled) return;
        settled = true;
        var timeoutError = featureError('feature-script-timeout', 'feature script timed out: ' + src, {
          script: src,
          timeoutMs: timeoutMs,
          attemptId: record.attemptId
        });
        record.state = 'timed-out';
        record.error = timeoutError;
        removeScriptNode(script);
        reject(timeoutError);
      }, timeoutMs);
      script.async = false;
      script.src = src;
      script.dataset.tmFeatureScript = 'true';
      script.onload = function () {
        if (settled) {
          if (record.state === 'timed-out') {
            record.state = 'loaded-late';
            report(featureError('feature-script-loaded-late', 'timed-out feature script executed after its deadline: ' + src, {
              script: src,
              attemptId: record.attemptId
            }), 'script-loaded-late');
          }
          script.onload = null;
          script.onerror = null;
          return;
        }
        settled = true;
        record.state = 'loaded';
        root.clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        resolve({ ok: true, script: src, attemptId: record.attemptId });
      };
      script.onerror = function () {
        if (settled) {
          if (record.state === 'timed-out') record.state = 'failed-after-timeout';
          script.onload = null;
          script.onerror = null;
          return;
        }
        settled = true;
        root.clearTimeout(timer);
        var loadError = featureError('feature-script-load-failed', 'feature script failed to load: ' + src, {
          script: src,
          attemptId: record.attemptId
        });
        record.state = 'failed';
        record.error = loadError;
        delete scriptLoads[src];
        script.onload = null;
        script.onerror = null;
        reject(loadError);
      };
      try {
        (root.document.head || root.document.documentElement).appendChild(script);
      } catch (error) {
        if (settled) return;
        settled = true;
        root.clearTimeout(timer);
        delete scriptLoads[src];
        record.state = 'failed';
        record.error = error;
        script.onload = null;
        script.onerror = null;
        reject(featureError('feature-script-load-failed', 'feature script could not be inserted: ' + src, {
          script: src,
          attemptId: record.attemptId,
          cause: error && error.message || String(error)
        }));
      }
    });
    return record.promise;
  }

  function ensureManifest() {
    if (manifestPromise) return manifestPromise;
    manifestPromise = loadScript(MANIFEST_SRC, DEFAULT_TIMEOUT_MS).then(function () {
      if (!Object.keys(definitions).length) throw featureError('feature-manifest-empty', 'feature manifest registered no features');
      return true;
    }).catch(function (error) {
      manifestPromise = null;
      throw error;
    });
    return manifestPromise;
  }

  function ensureDefined(name) {
    if (definitions[name]) return Promise.resolve(definitions[name]);
    return ensureManifest().then(function () {
      if (!definitions[name]) throw featureError('unknown-feature', 'unknown feature: ' + name, { feature: name });
      return definitions[name];
    });
  }

  function initFailure(error, definition) {
    return featureError('feature-init-failed', 'feature init failed: ' + definition.name, {
      feature: definition.name,
      causeCode: error && error.code || '',
      cause: error && error.message || String(error)
    });
  }

  function initializeFeature(definition, state, generation) {
    if (state.disposeRequested || generation !== state.generation) {
      state.initialized = false;
      state.state = 'disposed';
      return Promise.resolve({ skippedInit: true });
    }
    if (!definition.init) {
      state.initialized = true;
      return Promise.resolve({ initialized: true });
    }
    return Promise.resolve().then(function () {
      return definition.init();
    }).then(function () {
      state.initialized = true;
      return { initialized: true };
    }).catch(function (error) {
      return Promise.resolve().then(function () {
        return definition.dispose ? definition.dispose() : undefined;
      }).then(function () {
        state.initialized = false;
        throw initFailure(error, definition);
      }, function (rollbackError) {
        state.initialized = false;
        throw featureError('feature-init-rollback-failed', 'feature init rollback failed: ' + definition.name, {
          feature: definition.name,
          initError: error && error.message || String(error),
          rollbackError: rollbackError && rollbackError.message || String(rollbackError)
        });
      });
    });
  }

  function runDisposer(definition, state) {
    if (!state.initialized) {
      state.disposeRequested = false;
      state.state = 'disposed';
      return Promise.resolve({ ok: true, feature: definition.name, state: 'disposed', disposed: false });
    }
    return Promise.resolve().then(function () {
      return definition.dispose ? definition.dispose() : undefined;
    }).then(function () {
      state.initialized = false;
      state.disposeRequested = false;
      state.state = 'disposed';
      state.lastError = null;
      return { ok: true, feature: definition.name, state: 'disposed', disposed: true };
    }).catch(function (error) {
      var disposeError = featureError('feature-dispose-failed', 'feature dispose failed: ' + definition.name, {
        feature: definition.name,
        cause: error && error.message || String(error)
      });
      state.disposeRequested = false;
      state.state = 'failed';
      state.lastError = disposeError;
      throw disposeError;
    });
  }

  function loadFeature(name, generation, trail) {
    return ensureDefined(name).then(function (definition) {
      assertNoDependencyCycle(definitions);
      var state = stateFor(name);
      var actualPlatform = platformKind();
      if (!applicable(definition.platform, actualPlatform)) {
        state.state = 'not-applicable';
        return { ok: false, code: 'not-applicable', feature: name, platform: actualPlatform };
      }
      return definition.dependsOn.reduce(function (chain, dependency) {
        return chain.then(function () {
          return ensureInternal(dependency, trail).then(function (result) {
            if (result && result.ok === false && result.code === 'not-applicable') {
              throw featureError('feature-dependency-not-applicable', 'feature dependency is not applicable: ' + dependency, {
                feature: name,
                dependency: dependency
              });
            }
          });
        });
      }, Promise.resolve()).then(function () {
        return definition.scripts.reduce(function (chain, src) {
          return chain.then(function () { return loadScript(src, definition.timeoutMs); });
        }, Promise.resolve());
      }).then(function () {
        verifyProvides(definition);
        return initializeFeature(definition, state, generation);
      }).then(function (initResult) {
        if (initResult && initResult.skippedInit) {
          state.disposeRequested = false;
          state.state = 'disposed';
          return { ok: true, feature: name, state: 'disposed', skippedInit: true };
        }
        if (state.disposeRequested || generation !== state.generation) {
          return runDisposer(definition, state);
        }
        state.state = 'ready';
        state.lastError = null;
        return { ok: true, feature: name, state: 'ready' };
      });
    });
  }

  function ensureInternal(name, trail) {
    trail = Array.isArray(trail) ? trail : [];
    if (trail.indexOf(name) >= 0) {
      var cycle = trail.slice(trail.indexOf(name)).concat(name);
      return Promise.reject(featureError('feature-dependency-cycle', 'feature dependency cycle: ' + cycle.join(' -> '), {
        cycle: cycle
      }));
    }
    var state = stateFor(name);
    if (state.state === 'ready') return Promise.resolve({ ok: true, feature: name, state: 'ready', reused: true });
    if (state.promise) return state.promise;
    if (state.state === 'failed') {
      return Promise.reject(featureError('feature-retry-required', 'feature failed previously; call retry(): ' + name, {
        feature: name,
        retryCount: state.retryCount,
        lastErrorCode: state.lastError && state.lastError.code || ''
      }));
    }
    state.disposeRequested = false;
    state.generation += 1;
    var generation = state.generation;
    state.state = 'loading';
    state.promise = loadFeature(name, generation, trail.concat(name)).catch(function (error) {
      state.state = 'failed';
      state.lastError = error;
      report(error, 'ensure', name);
      throw error;
    }).finally(function () {
      state.promise = null;
    });
    return state.promise;
  }

  function ensure(name) {
    return ensureInternal(name, []);
  }

  function isRetryableFailure(error, options) {
    var code = error && error.code || '';
    if (code === 'feature-script-load-failed') return options.retryLoadError !== false;
    if (code === 'feature-init-failed') return options.retryInitError !== false;
    return false;
  }

  function retry(name) {
    return ensureDefined(name).then(function (definition) {
      var state = stateFor(name);
      if (state.state !== 'failed') return ensure(name);
      var prior = state.lastError;
      var timedOut = definition.scripts.some(function (src) { return scriptRequiresReload(scriptLoads[src]); });
      if (timedOut || prior && (prior.code === 'feature-script-timeout' || prior.code === 'feature-reload-required')) {
        return Promise.reject(reloadRequiredError((prior && prior.details && prior.details.script) || definition.scripts[0],
          scriptLoads[(prior && prior.details && prior.details.script) || definition.scripts[0]]));
      }
      if (!isRetryableFailure(prior, {})) {
        return Promise.reject(featureError('feature-retry-not-allowed', 'feature failure is not safely retryable: ' + name, {
          feature: name,
          lastErrorCode: prior && prior.code || ''
        }));
      }
      if (state.retryCount >= 1) {
        return Promise.reject(featureError('feature-retry-limit', 'feature retry limit reached: ' + name, { feature: name }));
      }
      state.retryCount += 1;
      state.state = 'defined';
      state.lastError = null;
      return ensure(name);
    });
  }

  function ensureRecoverable(name, options) {
    options = options || {};
    return ensure(name).catch(function (error) {
      var state = stateFor(name);
      var prior = error && error.code === 'feature-retry-required' ? state.lastError : error;
      if (prior && (prior.code === 'feature-script-timeout' || prior.code === 'feature-reload-required')) {
        throw reloadRequiredError((prior.details && prior.details.script) || name,
          scriptLoads[prior.details && prior.details.script]);
      }
      if (!isRetryableFailure(prior, options)) throw error;
      return retry(name);
    });
  }

  function preload(name) {
    return ensure(name);
  }

  function dispose(name) {
    return ensureDefined(name).then(function (definition) {
      var state = stateFor(name);
      state.disposeRequested = true;
      if (state.promise) {
        var active = state.promise;
        return active.then(function () {
          if (!state.initialized) {
            state.disposeRequested = false;
            state.state = 'disposed';
            return { ok: true, feature: name, state: 'disposed', disposed: true, skippedInit: true };
          }
          return runDisposer(definition, state);
        }, function (error) {
          state.disposeRequested = false;
          if (error && error.code === 'feature-dispose-failed') throw error;
          return { ok: true, feature: name, state: state.state, disposed: false, loadFailed: true };
        });
      }
      return runDisposer(definition, state);
    });
  }

  function status(name) {
    if (name) {
      var one = stateFor(name);
      return {
        feature: name,
        state: one.state,
        initialized: one.initialized,
        retryCount: one.retryCount,
        disposeRequested: one.disposeRequested,
        errorCode: one.lastError && one.lastError.code || ''
      };
    }
    return Object.keys(runtime).sort().map(function (key) { return status(key); });
  }

  function afterWindowLoad(callback) {
    if (root.document.readyState === 'complete') root.setTimeout(callback, 0);
    else root.addEventListener('load', callback, { once: true });
  }

  function bootOptionalFeatures() {
    afterWindowLoad(function () {
      var search = '';
      try { search = String(root.location && root.location.search || ''); } catch (error) { report(error, 'query-detection'); }
      if (/[?&](?:test|devHarness)=1(?:&|$)/.test(search)) {
        ensureRecoverable('browserTestHarness').catch(function (error) { report(error, 'browser-test-harness', 'browserTestHarness'); });
      }
      if (platformKind() === 'web') {
        var idle = typeof root.requestIdleCallback === 'function'
          ? root.requestIdleCallback
          : function (fn) { return root.setTimeout(fn, 1200); };
        idle(function () {
          ensureRecoverable('onlineUpdate').catch(function (error) { report(error, 'online-update', 'onlineUpdate'); });
        });
      }
    });
  }

  root.TM.Features = {
    define: define,
    registerManifest: registerManifest,
    ensure: ensure,
    ensureRecoverable: ensureRecoverable,
    preload: preload,
    dispose: dispose,
    status: status,
    retry: retry,
    platformKind: platformKind,
    _loadScript: loadScript,
    _manifestSource: MANIFEST_SRC
  };

  bootOptionalFeatures();
})(typeof window !== 'undefined' ? window : globalThis);
