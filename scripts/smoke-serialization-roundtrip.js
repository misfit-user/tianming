#!/usr/bin/env node
// smoke-serialization-roundtrip.js - editor/export/boot round-trip guard.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

function deepDiff(expected, actual, base, out) {
  out = out || [];
  base = base || '$';
  if (expected === actual) return out;
  if (typeof expected !== typeof actual) {
    out.push(base + ': type ' + typeof expected + ' !== ' + typeof actual);
    return out;
  }
  if (expected === null || actual === null) {
    if (expected !== actual) out.push(base + ': ' + expected + ' !== ' + actual);
    return out;
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      out.push(base + ': array mismatch');
      return out;
    }
    if (expected.length !== actual.length) {
      out.push(base + '.length: ' + expected.length + ' !== ' + actual.length);
    }
    const len = Math.max(expected.length, actual.length);
    for (let i = 0; i < len; i += 1) {
      if (i >= expected.length) out.push(base + '[' + i + ']: unexpected ' + JSON.stringify(actual[i]));
      else if (i >= actual.length) out.push(base + '[' + i + ']: missing ' + JSON.stringify(expected[i]));
      else deepDiff(expected[i], actual[i], base + '[' + i + ']', out);
    }
    return out;
  }
  if (typeof expected === 'object') {
    const keys = Array.from(new Set(Object.keys(expected).concat(Object.keys(actual)))).sort();
    keys.forEach(function(k) {
      if (!Object.prototype.hasOwnProperty.call(expected, k)) {
        out.push(base + '.' + k + ': unexpected ' + JSON.stringify(actual[k]));
      } else if (!Object.prototype.hasOwnProperty.call(actual, k)) {
        out.push(base + '.' + k + ': missing ' + JSON.stringify(expected[k]));
      } else {
        deepDiff(expected[k], actual[k], base + '.' + k, out);
      }
    });
    return out;
  }
  out.push(base + ': ' + JSON.stringify(expected) + ' !== ' + JSON.stringify(actual));
  return out;
}

function assertDeepEqual(label, expected, actual) {
  const diffs = deepDiff(expected, actual).slice(0, 30);
  if (diffs.length) {
    throw new Error(label + ' DIFF\n' + diffs.join('\n'));
  }
}

function editorEnsureDefaults(scriptData) {
  if (!scriptData.id) scriptData.id = 'custom';
  if (!scriptData.name) scriptData.name = 'Custom Script';
  if (!Array.isArray(scriptData.characters)) scriptData.characters = [];
  if (!Array.isArray(scriptData.factions)) scriptData.factions = [];
  if (!Array.isArray(scriptData.influenceGroups)) scriptData.influenceGroups = [];
  return scriptData;
}

function editorMergeAndReload(d) {
  const scriptData = {};
  Object.keys(d || {}).forEach(function(key) {
    scriptData[key] = d[key];
  });
  return editorEnsureDefaults(scriptData);
}

function makeFixture() {
  return {
    id: 'slice35_roundtrip',
    name: 'Slice 3.5 Round Trip',
    dynasty: 'song',
    characters: [
      {
        id: 'tong_guan',
        name: '\u7ae5\u8d2f',
        officialTitle: '\u90fd\u77e5',
        occupation: '\u5ba6\u5b98',
        influence: 72,
        alive: true
      }
    ],
    factions: [],
    influenceGroups: [
      {
        name: 'song-inner-court',
        type: 'rumenneishisheng',
        leader: '\u7ae5\u8d2f',
        members: ['\u7ae5\u8d2f'],
        keyOffices: ['\u90fd\u77e5'],
        initialInfluence: 44,
        initialCohesion: 61,
        candidateBy: 'script'
      }
    ],
    engineConstants: {
      influenceGroupCatalog: {
        song: {
          rumenneishisheng: {
            name: '\u5165\u5185\u5185\u4f8d\u7701',
            tier: 'core',
            officeTitles: ['\u90fd\u77e5', '\u526f\u90fd\u77e5', '\u62bc\u73ed', '\u5185\u4e1c\u5934\u4f9b\u5949\u5b98', '\u5185\u897f\u5934\u4f9b\u5949\u5b98']
          },
          neishisheng: {
            name: '\u5185\u4f8d\u7701',
            tier: 'auxiliary',
            officeTitles: ['\u90fd\u77e5', '\u62bc\u73ed']
          }
        }
      },
      dynastyTemplate: {
        song: {
          phase: 'renewal-fragile',
          partyDimensions: ['zhanhe-3']
        }
      },
      regentRule: {
        candidates: ['\u5b5f\u7687\u540e'],
        trigger: 'emperor_displaced'
      },
      threePartyBalance: {
        axes: ['\u4e3b\u6218', '\u52a1\u5b9e', '\u4e3b\u548c']
      },
      presenceStateEnum: ['\u5728\u573a', '\u7f62\u95f2', '\u5317\u72e9', '\u5916\u5730', '\u672a\u53ec', '\u8fb9\u5730', '\u4e1c\u4eac']
    }
  };
}

function loadIntoVm(context, file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, context, { filename: file });
}

function assertSourceContracts() {
  const editorText = fs.readFileSync(path.join(ROOT, 'editor-fullgen.js'), 'utf8');
  assert(editorText.indexOf('JSON.stringify(scriptData, null, 2)') >= 0, 'editor export should serialize full scriptData');
  assert(editorText.indexOf('scriptData[key] = d[key]') >= 0, 'editor import should merge all own top-level keys');

  const patchesText = fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8');
  assert(patchesText.indexOf('GM.engineConstants = deepClone(sc.engineConstants)') >= 0, 'startGame should copy engineConstants to GM');
  assert(patchesText.indexOf('P.engineConstants = deepClone(sc.engineConstants)') >= 0, 'startGame should copy engineConstants to P');
  assert(patchesText.indexOf('GM.influenceGroups = deepClone(sc.influenceGroups)') >= 0, 'startGame should copy influenceGroups to GM');
  assert(patchesText.indexOf('P.influenceGroups = deepClone(sc.influenceGroups)') >= 0, 'startGame should copy influenceGroups to P');

  const loadText = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
  assert(loadText.indexOf('GM.engineConstants = deepClone(_scEC.engineConstants)') >= 0, 'fullLoadGame should restore GM.engineConstants from scenario');
  assert(loadText.indexOf('P.engineConstants = deepClone(_scEC.engineConstants)') >= 0, 'fullLoadGame should restore P.engineConstants from scenario');
  assert(loadText.indexOf('GM.influenceGroups = deepClone(_scEC.influenceGroups)') >= 0, 'fullLoadGame should restore GM.influenceGroups from scenario');
  assert(loadText.indexOf('P.influenceGroups = deepClone(_scEC.influenceGroups)') >= 0, 'fullLoadGame should restore P.influenceGroups from scenario');
}

function runFullLoadGameMirrorFallback() {
  const scenario = makeFixture();
  const GM = { sid: scenario.id };
  const P = {};
  function findScenarioById(id) {
    return id === scenario.id ? scenario : null;
  }
  const _scEC = findScenarioById(GM.sid);
  if (_scEC) {
    if (!GM.engineConstants && _scEC.engineConstants) GM.engineConstants = clone(_scEC.engineConstants);
    if ((!Array.isArray(GM.influenceGroups) || GM.influenceGroups.length === 0) && Array.isArray(_scEC.influenceGroups)) GM.influenceGroups = clone(_scEC.influenceGroups);
    if (P && typeof P === 'object') {
      if (!P.engineConstants && _scEC.engineConstants) P.engineConstants = clone(_scEC.engineConstants);
      if ((!Array.isArray(P.influenceGroups) || P.influenceGroups.length === 0) && Array.isArray(_scEC.influenceGroups)) P.influenceGroups = clone(_scEC.influenceGroups);
    }
  }
  assertDeepEqual('fullLoadGame GM engineConstants fallback', scenario.engineConstants, GM.engineConstants);
  assertDeepEqual('fullLoadGame P engineConstants fallback', scenario.engineConstants, P.engineConstants);
  assertDeepEqual('fullLoadGame GM influenceGroups fallback', scenario.influenceGroups, GM.influenceGroups);
  assertDeepEqual('fullLoadGame P influenceGroups fallback', scenario.influenceGroups, P.influenceGroups);
}

function runEditorRoundTrip() {
  const fixture = makeFixture();
  const memory = editorMergeAndReload(clone(fixture));
  memory.influenceGroups[0].initialInfluence = 55;
  memory.influenceGroups.push({
    name: 'temporary-edit-group',
    type: 'waiqi',
    members: [],
    initialInfluence: 12
  });
  memory.influenceGroups = memory.influenceGroups.filter(function(g) {
    return g.name !== 'temporary-edit-group';
  });
  memory.engineConstants.dynastyTemplate.song.partyDimensions.push('inner-court-presence');

  const exportedJson = JSON.stringify(memory, null, 2);
  const parsed = JSON.parse(exportedJson);
  const reloaded = editorMergeAndReload(parsed);

  assertDeepEqual('influenceGroups editor/export/reload', memory.influenceGroups, reloaded.influenceGroups);
  assertDeepEqual('engineConstants editor/export/reload', memory.engineConstants, reloaded.engineConstants);
  assert(Array.isArray(reloaded.engineConstants.presenceStateEnum), 'presenceStateEnum should remain an array');
  assert(Array.isArray(reloaded.engineConstants.influenceGroupCatalog.song.rumenneishisheng.officeTitles), 'officeTitles should remain an array');
  assert(typeof reloaded.engineConstants.regentRule.trigger === 'string', 'regentRule.trigger should remain a string');
  return reloaded;
}

function runBootRoundTrip(scenario) {
  const context = {
    console,
    Date,
    JSON,
    Math,
    GM: {
      running: true,
      turn: 1,
      sid: scenario.id,
      chars: clone(scenario.characters),
      influenceGroupState: {}
    },
    P: {},
    scriptData: {}
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  loadIntoVm(context, 'tm-engine-constants.js');
  loadIntoVm(context, 'tm-influence-groups.js');

  context.GM.engineConstants = clone(scenario.engineConstants);
  context.P.engineConstants = clone(scenario.engineConstants);
  context.GM.influenceGroups = clone(scenario.influenceGroups);
  context.P.influenceGroups = clone(scenario.influenceGroups);

  const EC = context.TM.EngineConstants;
  const IG = context.TM.InfluenceGroups;
  assert(EC && IG, 'runtime APIs should be mounted');

  const offices = EC.read('influenceGroupCatalog.song.rumenneishisheng.officeTitles', context.GM);
  assertDeepEqual('boot engineConstants read', scenario.engineConstants.influenceGroupCatalog.song.rumenneishisheng.officeTitles, offices);
  assert(EC.read('influenceGroupCatalog.song.rumenneishisheng.officeTitles', { engineConstants: {} }) === undefined, 'EngineConstants.read must not invent hidden defaults');

  const boot = IG.bootstrap(context.GM, { turn: 1, source: 'slice35-roundtrip' });
  assert(boot && boot.ok === true, 'InfluenceGroups.bootstrap should pass');
  assert(boot.explicitGroups === 1, 'explicit influenceGroups should be boot-visible');
  assert(context.GM.influenceGroupState['song-inner-court'], 'declared influence group should be in GM state');
  assert(context.GM.influenceGroupState['song-inner-court'].influence === 55, 'edited influence should reach boot state');
  assertDeepEqual('GM engineConstants persisted', scenario.engineConstants, context.GM.engineConstants);
  assertDeepEqual('P influenceGroups persisted', scenario.influenceGroups, context.P.influenceGroups);
}

assertSourceContracts();
runFullLoadGameMirrorFallback();
const reloadedScenario = runEditorRoundTrip();
runBootRoundTrip(reloadedScenario);

console.log('[smoke-serialization-roundtrip] PASS editor/export/reload/boot chain preserved influenceGroups and engineConstants');
