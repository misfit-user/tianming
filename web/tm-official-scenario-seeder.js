// tm-official-scenario-seeder.js
// Desktop hot-update helper: seed the official scenario JSON files into the
// app scenario directory when an installed build is missing them.
// 数据来自 web/scenarios/*.js 三个内建脚本（经 tm-official-scenario-loader 按需装载，和玩家开卷走同一条路），
// 不再另带一份 90MB 的 seeder 主包；只装缺的那几个。
(function(global){
  'use strict';

  var OFFICIAL = [
    { filename: '天启七年·九月（官方）', id: 'sc-tianqi7-1627' },
    { filename: '绍宋·建炎元年八月（官方）', id: 'sc-jianyan1-1127-shaosong' },
    { filename: '晚唐·开成五年（官方）', id: 'sc-tang840-840' }
  ];
  var ensurePromise = null;

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

  function officialLoader(){
    var loader = global.TMOfficialScenarioLoader;
    if (!loader || typeof loader.ensure !== 'function') throw new Error('official scenario loader unavailable');
    return loader;
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

      var loader = officialLoader();
      var saved = [];
      for (var i = 0; i < missing.length; i++) {
        var target = missing[i];
        // 装不上就整个失败（和从前主包装不上一样），下次调用会重试；已经落盘的不受影响。
        var scenario = await loader.ensure(target.id);
        if (!scenario || scenario.id !== target.id || scenario._lazyOfficial === true) {
          console.warn('[official-scenario-seeder] official scenario not loaded:', target.filename);
          continue;
        }
        var result = await global.tianming.saveScenario(target.filename, cloneData(scenario));
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
    ensure: ensureOfficialScenarios,
    official: OFFICIAL.map(function(item){ return { filename: item.filename, id: item.id }; })
  };
})(window);
