#!/usr/bin/env node
// scripts/smoke-ceming-profile-schema.js
// Guards ceming/local historical profile characters against thin legacy schemas.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

const sandbox = {
  console,
  window: {},
  global: {},
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  localStorage: (function(){
    const store = {};
    return {
      getItem: (k) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      }
    };
  })(),
  P: {
    conf: { gameMode: 'yanyi' },
    ai: null,
    time: { year: 1628 }
  },
  GM: {
    year: 1628,
    turn: 1,
    chars: [],
    _indices: { charByName: new Map() }
  }
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.findCharByName = function(name) {
  return (sandbox.GM.chars || []).find((c) => c && c.name === name) || null;
};

vm.createContext(sandbox);

const runtimeFiles = ['tm-char-historical-profiles.js'].concat(
  fs.readdirSync(ROOT)
    .filter((f) => /^tm-char-historical-wave-\d+\.js$/.test(f))
    .sort()
).concat(['tm-ceming.js']);

runtimeFiles.forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
});

let pass = 0;
let fail = 0;

function expect(label, condition) {
  if (condition) {
    console.log('  PASS ' + label);
    pass++;
  } else {
    console.log('  FAIL ' + label);
    fail++;
  }
}

function numberField(obj, key) {
  return typeof obj[key] === 'number' && Number.isFinite(obj[key]);
}

async function main() {
  const profiles = sandbox.HISTORICAL_CHAR_PROFILES;
  const wang = sandbox.createCharFromProfile('wangshouren');

  expect('profile waves loaded', Object.keys(profiles).length >= 500);
  expect('createCharFromProfile marks historical', wang && wang.isHistorical === true);
  expect('createCharFromProfile copies birth/death years', wang && wang.birthYear === 1472 && wang.deathYear === 1529);
  expect('createCharFromProfile keeps bio text', wang && typeof wang.bio === 'string' && wang.bio.length > 20);
  expect('createCharFromProfile exposes intelligence', wang && wang.intelligence === profiles.wangshouren.abilities.intelligence);
  expect('createCharFromProfile exposes administration from governance', wang && wang.administration === profiles.wangshouren.abilities.governance);
  expect('createCharFromProfile exposes valor from military', wang && wang.valor === profiles.wangshouren.abilities.military);
  expect('createCharFromProfile exposes military top-level', wang && wang.military === profiles.wangshouren.abilities.military);
  expect('createCharFromProfile exposes management from finance', wang && wang.management === profiles.wangshouren.abilities.finance);
  expect('createCharFromProfile exposes wuchang object', wang && wang.wuchang && numberField(wang.wuchang, 'zhi'));

  sandbox.GM.chars = [];
  sandbox.GM._indices = { charByName: new Map() };
  sandbox.P.ai = null;
  sandbox.P.conf.gameMode = 'yanyi';
  sandbox.GM.year = 1628;

  const pastRes = await sandbox.TM.ceming.summonByProfile('zhugeLiang');
  const pastChar = pastRes && pastRes.char;
  expect('ceming local fallback returns a new char', pastRes && pastRes.existed === false && pastChar);
  expect('past cross-time status is preserved without API', pastChar && pastChar.timelineStatus === 'past_visitor');
  expect('past cross-time displacement is true', pastChar && pastChar.displacement === true);
  expect('past cross-time knowledge is unreliable', pastChar && pastChar.knowledgeReliability === 'unreliable_crosstime');
  expect('past cross-time bio records anomaly', pastChar && typeof pastChar.bio === 'string' && pastChar.bio.indexOf('时空裂痕') >= 0);
  expect('ceming local fallback has modern ability fields', pastChar && numberField(pastChar, 'intelligence') && numberField(pastChar, 'administration') && numberField(pastChar, 'valor') && numberField(pastChar, 'military') && numberField(pastChar, 'management'));
  expect('ceming local fallback updates char index', pastChar && sandbox.GM._indices.charByName.get(pastChar.name) === pastChar);

  sandbox.GM.chars = [];
  sandbox.GM._indices = { charByName: new Map() };
  const futureRes = await sandbox.TM.ceming.summonByProfile('linZexu');
  const futureChar = futureRes && futureRes.char;
  expect('future cross-time status is preserved without API', futureChar && futureChar.timelineStatus === 'future_visitor');
  expect('future cross-time mood is future confusion', futureChar && futureChar.timelineMood === 'confused_future');

  console.log('\n[smoke-ceming-profile-schema] ' + pass + ' passed / ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
