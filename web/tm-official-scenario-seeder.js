// tm-official-scenario-seeder.js
// Desktop hot-update helper: seed bundled official scenario JSON files into the
// app scenario directory when an installed build is missing them.
(function(global){
  'use strict';

  var OFFICIAL = [
    { filename: '天启七年·九月（官方）' },
    { filename: '绍宋·建炎元年八月（官方）' },
    { filename: '晚唐·开成五年（官方）' }
  ];
  var BUNDLE_URL = 'tm-official-scenario-bundle.js?v=20260916-release1350';
  var ensurePromise = null;
  var bundlePromise = null;

  function isDesktopScenarioApiReady(){
    return !!(global.tianming &&
      global.tianming.isDesktop &&
      typeof global.tianming.listScenarios === 'function' &&
      typeof global.tianming.saveScenario === 'function');
  }

  function scenarioNameSet(files){
    var set = Object.create(null);
    (files || []).forEach(function(file){
      if (file && file.name) set[String(file.name)] = true;
    });
    return set;
  }

  function cloneData(data){
    if (typeof global.structuredClone === 'function') {
      try { return global.structuredClone(data); } catch (e) {}
    }
    return JSON.parse(JSON.stringify(data));
  }

  function loadBundle(){
    if (Array.isArray(global.TMOfficialScenarioBundle)) return Promise.resolve(global.TMOfficialScenarioBundle);
    if (bundlePromise) return bundlePromise;
    bundlePromise = new Promise(function(resolve, reject){
      var script = document.createElement('script');
      script.src = BUNDLE_URL;
      script.async = true;
      script.onload = function(){
        var bundle = global.TMOfficialScenarioBundle;
        if (Array.isArray(bundle)) resolve(bundle);
        else reject(new Error('official scenario bundle missing'));
      };
      script.onerror = function(){ reject(new Error('failed to load official scenario bundle')); };
      (document.head || document.documentElement).appendChild(script);
    });
    return bundlePromise;
  }

  async function ensureOfficialScenarios(){
    if (ensurePromise) return ensurePromise;
    ensurePromise = (async function(){
      if (!isDesktopScenarioApiReady()) return { skipped: true, reason: 'desktop scenario api unavailable' };

      var listed = await global.tianming.listScenarios();
      if (!listed || !listed.success) return { skipped: true, reason: (listed && listed.error) || 'list failed' };

      var existing = scenarioNameSet(listed.files || []);
      var missing = OFFICIAL.filter(function(item){ return !existing[item.filename]; });
      if (!missing.length) return { saved: [], missing: [] };

      var bundle = await loadBundle();
      var saved = [];
      for (var i = 0; i < missing.length; i++) {
        var target = missing[i];
        var found = bundle.find(function(item){ return item && item.filename === target.filename && item.data; });
        if (!found) {
          console.warn('[official-scenario-seeder] bundled scenario not found:', target.filename);
          continue;
        }
        var result = await global.tianming.saveScenario(target.filename, cloneData(found.data));
        if (result && result.success) saved.push(target.filename);
        else console.warn('[official-scenario-seeder] save failed:', target.filename, result && result.error);
      }
      if (saved.length) console.info('[official-scenario-seeder] saved official scenarios:', saved.join(', '));
      return { saved: saved, missing: missing.map(function(item){ return item.filename; }) };
    })().catch(function(error){
      ensurePromise = null;
      console.warn('[official-scenario-seeder] ensure failed:', error && error.message || error);
      return { skipped: true, error: error && error.message || String(error) };
    });
    return ensurePromise;
  }

  global.TMOfficialScenarioSeeder = {
    ensure: ensureOfficialScenarios
  };
})(window);
