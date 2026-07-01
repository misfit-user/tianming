#!/usr/bin/env node
/* eslint-env node */
'use strict';

const fs = require('fs');
const path = require('path');

const SID = 'sc-tianqi7-1627';
const repoRoot = path.resolve(__dirname, '..', '..');
const webRoot = path.resolve(__dirname, '..');
const scenarioDir = path.join(repoRoot, 'scenarios');
const outPath = path.join(webRoot, 'data', 'scenario-supplements', 'tianqi7-official-runtime-snapshot.js');
const arrayKeys = ['characters', 'factions', 'parties', 'classes', 'variables', 'events', 'relations', 'items', 'rigidHistoryEvents'];

function loadOfficialScenario() {
  const files = fs.readdirSync(scenarioDir).filter((name) => name.endsWith('.json'));
  const matches = [];
  for (const name of files) {
    const full = path.join(scenarioDir, name);
    try {
      const data = JSON.parse(fs.readFileSync(full, 'utf8'));
      if (data && data.id === SID) matches.push({ file: full, name, data });
    } catch (_) {
      // Ignore unrelated user scenario files that are temporarily invalid.
    }
  }
  if (!matches.length) throw new Error(`official scenario ${SID} not found in ${scenarioDir}`);
  // 同 id 多文件（官方版 + 自用测试版）→ 确定性优先「官方」·否则排除 测试/自用/备份 标记·否则首个（修旧版取 readdir 首个之脆弱：测试版排序在前会被误选）
  const isTest = (n) => /测试|自用|test|备份|\.bak/i.test(n);
  return matches.find((m) => /官方/.test(m.name)) || matches.find((m) => !isTest(m.name)) || matches[0];
}

function main() {
  const loaded = loadOfficialScenario();
  const data = loaded.data;
  const scenario = Object.assign({}, data);
  arrayKeys.forEach((key) => { delete scenario[key]; });

  // A3b 激活·人力/徭役/农政层试点种子：陕西布政使司（瘠·旱地·无银市场）→ 运行时 TM.Renli.ensurePilotSeeds
  // 读 P.scenarios[sid].renliPilot·展开种其府叶（西安府等 15 府）。役额按册载丁(=ding)·田源取 economyBase.farmland·
  // 逃亡/役负满意度去重后归 Renli（huji 对已种子让出）。瘠省 laborMarketDepth 0.2=无银市场（一条鞭法行此为毒）。
  scenario.renliPilot = [
    { region: '陕西布政使司', seed: { soilBase: 65, waterworks: 45, doubleCropping: 1.0, laborMarketDepth: 0.2 } }
  ];

  const arrays = {};
  arrayKeys.forEach((key) => {
    arrays[key] = Array.isArray(data[key]) ? data[key] : [];
  });

  const snapshot = {
    version: '2026-05-15-laterjin-liaodong',
    sid: SID,
    sourceFile: path.relative(repoRoot, loaded.file).replace(/\\/g, '/'),
    scenario,
    arrays,
  };

  const js = `/* GENERATED FILE. Run scripts/build-tianqi-runtime-snapshot.js after updating the official Tianqi scenario JSON. */
(function(global) {
  'use strict';

  var SNAPSHOT = ${JSON.stringify(snapshot)};
  var ARRAY_KEYS = ${JSON.stringify(arrayKeys)};
  var attempts = 0;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function ensureP() {
    if (!global.P || !Array.isArray(global.P.scenarios)) return false;
    ARRAY_KEYS.forEach(function(key) {
      if (!Array.isArray(global.P[key])) global.P[key] = [];
    });
    return true;
  }

  function applySnapshot() {
    if (!ensureP()) {
      if (attempts++ < 200) setTimeout(applySnapshot, 50);
      return;
    }
    var existing = global.P.scenarios.some(function(s) { return s && s.id === SNAPSHOT.sid; });
    if (!existing) {
      if (attempts++ < 200) setTimeout(applySnapshot, 50);
      return;
    }

    global.P.scenarios = global.P.scenarios.filter(function(s) { return !s || s.id !== SNAPSHOT.sid; });
    var scenario = clone(SNAPSHOT.scenario);
    scenario.id = SNAPSHOT.sid;
    scenario._version = SNAPSHOT.version;
    scenario._runtimeSnapshot = SNAPSHOT.version;
    global.P.scenarios.push(scenario);

    ARRAY_KEYS.forEach(function(key) {
      var next = clone(SNAPSHOT.arrays[key] || []);
      next.forEach(function(item) {
        if (item && !item.sid) item.sid = SNAPSHOT.sid;
      });
      global.P[key] = global.P[key].filter(function(item) { return !item || item.sid !== SNAPSHOT.sid; });
      Array.prototype.push.apply(global.P[key], next);
    });

    global.TM_TIANQI_OFFICIAL_RUNTIME_SNAPSHOT = {
      version: SNAPSHOT.version,
      sourceFile: SNAPSHOT.sourceFile,
      characters: (SNAPSHOT.arrays.characters || []).length,
      factions: (SNAPSHOT.arrays.factions || []).length
    };

    try {
      if (typeof global.saveP === 'function') global.saveP();
      else if (typeof global.localStorage !== 'undefined') {
        global.localStorage.setItem('tianming_P', JSON.stringify(global.P));
      }
    } catch (_) {}
  }

  global.TM_TIANQI_APPLY_OFFICIAL_RUNTIME_SNAPSHOT = applySnapshot;
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('tm:p-restored', function() {
      attempts = 0;
      applySnapshot();
    });
  }

  applySnapshot();
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
`;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, js, 'utf8');
  console.log(JSON.stringify({
    outPath,
    sourceFile: loaded.file,
    characters: arrays.characters.length,
    factions: arrays.factions.length,
    bytes: fs.statSync(outPath).size,
  }, null, 2));
}

main();
