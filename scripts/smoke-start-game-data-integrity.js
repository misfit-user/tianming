#!/usr/bin/env node
/* eslint-env node */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HEADLESS = path.join(__dirname, 'headless-smoke.js');
const SID = 'sc-tianqi7-1627';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function loadHeadlessHelpers() {
  const source = fs.readFileSync(HEADLESS, 'utf8')
    .replace(/^#![^\n]*\n/, '')
    .replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };');
  const factory = new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', source);
  return factory(require, process, __dirname, HEADLESS, { exports: {} }, {});
}

const helpers = loadHeadlessHelpers();

function installNodeExtras(win) {
  win.location.href = 'http://localhost/index.html';
  win.location.search = '';
  win.document.body.insertAdjacentHTML = function () {};
  win.document.head.insertAdjacentHTML = function () {};
  win.document.documentElement.insertAdjacentHTML = function () {};
  win.AbortController = class {
    constructor() {
      this.signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
    }
    abort() { this.signal.aborted = true; }
  };
  win.fetch = function () {
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get() { return ''; } },
      text() { return Promise.resolve('{"ok":true}'); },
      json() {
        return Promise.resolve({
          choices: [{ message: { content: '{"ok":true,"summary":"mock start prewarm"}' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        });
      }
    });
  };
}

function loadGame() {
  const env = helpers.makeStubs();
  installNodeExtras(env.win);
  const sandbox = vm.createContext(env.win);
  const scripts = helpers.parseIndexHtmlScripts();
  const cutoff = scripts.findIndex((src) => path.basename(src) === 'tm-test-harness.js');
  const loadScripts = cutoff >= 0 ? scripts.slice(0, cutoff) : scripts;

  loadScripts.forEach((src) => {
    const abs = path.join(ROOT, src);
    assert(fs.existsSync(abs), 'script missing: ' + src);
    const code = fs.readFileSync(abs, 'utf8');
    vm.runInContext(code, sandbox, { filename: src, displayErrors: true, timeout: 10000 });
  });

  vm.runInContext(`
    showLoading = function(){};
    hideLoading = function(){};
    toast = function(){};
    generateMemorials = function(){};
    var __smokeRealEnterGame = typeof enterGame === 'function' ? enterGame : null;
    enterGame = function(){
      window.__entered = true;
      if (__smokeRealEnterGame) return __smokeRealEnterGame.apply(this, arguments);
    };
    aiDeepReadScenario = async function(){ window.__aiDeepRead = true; };
    aiPlanScenarioForInference = async function(){ window.__aiPlan = true; };
    aiPlanFactionMatrix = async function(){ window.__aiMatrix = true; };
    aiPlanFirstTurnEvents = async function(){ window.__aiFirstTurn = true; };
    if (!P.ai) P.ai = {};
    P.ai.key = 'mock-key';
    P.ai.url = 'http://mock.local/v1/chat/completions';
    P.ai.model = 'mock-model';
  `, sandbox);

  return sandbox;
}

function countState(sandbox) {
  const gm = sandbox.GM || {};
  const vars = gm.vars && typeof gm.vars === 'object' ? Object.keys(gm.vars).length : 0;
  const mapRegions = gm.mapData && Array.isArray(gm.mapData.regions) ? gm.mapData.regions.length : 0;
  const guoku = gm.guoku || {};
  const neitang = gm.neitang || {};
  const pop = gm.population || {};
  const national = pop.national || {};
  const hukou = gm.hukou || {};
  const corruption = gm.corruption || {};
  const minxin = gm.minxin || {};
  const huangquan = gm.huangquan || {};
  const huangwei = gm.huangwei || {};

  function firstNumber() {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
    return 0;
  }

  return {
    chars: Array.isArray(gm.chars) ? gm.chars.length : 0,
    facs: Array.isArray(gm.facs) ? gm.facs.length : 0,
    vars,
    mapRegions,
    guokuMoney: firstNumber(
      guoku.ledgers && guoku.ledgers.money && guoku.ledgers.money.stock,
      guoku.stockMoney,
      guoku.money,
      guoku.balance
    ),
    neitangMoney: firstNumber(
      neitang.ledgers && neitang.ledgers.money && neitang.ledgers.money.stock,
      neitang.stockMoney,
      neitang.money,
      neitang.balance
    ),
    populationMouths: firstNumber(
      national.mouths,
      national.total,
      hukou.registeredTotal
    ),
    corruptionIndex: firstNumber(corruption.trueIndex, corruption.perceivedIndex, corruption.index, corruption.value),
    minxinIndex: firstNumber(minxin.trueIndex, minxin.perceivedIndex, minxin.index, minxin.value),
    huangquanIndex: firstNumber(huangquan.index, huangquan.trueIndex, huangquan.value),
    huangweiIndex: firstNumber(huangwei.index, huangwei.trueIndex, huangwei.value),
    useAIGeo: !!gm._useAIGeo,
    entered: !!sandbox.__entered,
    aiDeepRead: !!sandbox.__aiDeepRead,
    aiPlan: !!sandbox.__aiPlan,
    aiMatrix: !!sandbox.__aiMatrix,
    aiFirstTurn: !!sandbox.__aiFirstTurn
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCase(label, setup, expect) {
  const sandbox = loadGame();
  setup(sandbox);
  vm.runInContext(`doActualStart('${SID}')`, sandbox, { timeout: 10000 });
  await delay(120);
  const state = countState(sandbox);
  expect(state);
  console.log('[smoke-start-game-data-integrity] ' + label + ' PASS ' + JSON.stringify(state));
}

(async function main() {
  await runCase('stale-map-choice-is-ignored', function (sandbox) {
    sandbox._pendingUseMap = false;
  }, function (state) {
    assert(state.chars >= 100, 'stale choice lost characters: ' + state.chars);
    assert(state.facs >= 10, 'stale choice lost factions: ' + state.facs);
    assert(state.vars >= 20, 'stale choice lost variables: ' + state.vars);
    assert(state.mapRegions >= 40, 'stale choice lost map regions: ' + state.mapRegions);
    assert(state.guokuMoney > 0, 'stale choice did not prime guoku money: ' + state.guokuMoney);
    assert(state.neitangMoney > 0, 'stale choice did not prime neitang money: ' + state.neitangMoney);
    assert(state.populationMouths > 1000000, 'stale choice did not prime population: ' + state.populationMouths);
    assert(state.corruptionIndex > 0, 'stale choice did not prime corruption: ' + state.corruptionIndex);
    assert(state.minxinIndex > 0, 'stale choice did not prime minxin: ' + state.minxinIndex);
    assert(state.huangquanIndex > 0, 'stale choice did not prime huangquan: ' + state.huangquanIndex);
    assert(state.huangweiIndex > 0, 'stale choice did not prime huangwei: ' + state.huangweiIndex);
    assert(state.useAIGeo === false, 'stale choice incorrectly enabled AI geography');
    assert(state.entered, 'stale choice did not enter game');
    assert(state.aiDeepRead && state.aiPlan && state.aiMatrix && state.aiFirstTurn, 'API prewarm branch did not run');
  });

  await runCase('fresh-ai-geography-choice-is-honored', function (sandbox) {
    sandbox._pendingUseMap = false;
    sandbox._pendingMapModeSid = SID;
    sandbox._pendingMapModeAt = Date.now();
  }, function (state) {
    assert(state.chars >= 100, 'AI geography lost characters: ' + state.chars);
    assert(state.facs >= 10, 'AI geography lost factions: ' + state.facs);
    assert(state.vars >= 20, 'AI geography lost variables: ' + state.vars);
    assert(state.guokuMoney > 0, 'AI geography did not prime guoku money: ' + state.guokuMoney);
    assert(state.neitangMoney > 0, 'AI geography did not prime neitang money: ' + state.neitangMoney);
    assert(state.populationMouths > 1000000, 'AI geography did not prime population: ' + state.populationMouths);
    assert(state.corruptionIndex > 0, 'AI geography did not prime corruption: ' + state.corruptionIndex);
    assert(state.minxinIndex > 0, 'AI geography did not prime minxin: ' + state.minxinIndex);
    assert(state.huangquanIndex > 0, 'AI geography did not prime huangquan: ' + state.huangquanIndex);
    assert(state.huangweiIndex > 0, 'AI geography did not prime huangwei: ' + state.huangweiIndex);
    assert(state.useAIGeo === true, 'fresh AI geography choice was not honored');
    assert(state.entered, 'AI geography did not enter game');
    assert(state.aiDeepRead && state.aiPlan && state.aiMatrix && state.aiFirstTurn, 'API prewarm branch did not run');
  });
  process.exit(0);
})().catch((e) => {
  console.error('[smoke-start-game-data-integrity] FAIL ' + (e && e.message || e));
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 8).join('\n'));
  process.exit(1);
});
