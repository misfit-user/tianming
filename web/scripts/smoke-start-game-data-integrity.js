#!/usr/bin/env node
/* eslint-env node */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HEADLESS = path.join(__dirname, 'headless-smoke.js');
const SID = 'sc-tianqi7-1627';
const START_VM_TIMEOUT_MS = 30000;

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
    window.__smokeRealAiDeepReadScenario = typeof aiDeepReadScenario === 'function' ? aiDeepReadScenario : null;
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

// 天启官方地图(43 陆地块)在独立 scenario JSON 内·官方 bundle 为省体积剥离了地图·真游戏运行时另行 fetch 加载。
//   headless 测试 fetch 被桩(不真拉)·故须显式从磁盘读入地图并挂到已注册剧本上——否则地图数据根本不在 sandbox·
//   doActualStart 无图可绑·mapRegions 必 0(那是 harness 缺数据·非开局绑图逻辑之过)。读入后即可真正验证"开局是否正确绑图"。
const TIANQI_MAP_SOURCE = (function () {
  try {
    const p = path.join(ROOT, '..', 'scenarios', '天启七年·九月（官方）.json');
    if (!fs.existsSync(p)) return null;
    const sc = JSON.parse(fs.readFileSync(p, 'utf8'));
    const hasRegions = (m) => m && Array.isArray(m.regions) && m.regions.length >= 40;
    return { map: hasRegions(sc.map) ? sc.map : null, mapData: hasRegions(sc.mapData) ? sc.mapData : null };
  } catch (e) { return null; }
})();

function attachTianqiMap(sandbox) {
  if (!TIANQI_MAP_SOURCE || !TIANQI_MAP_SOURCE.map) return false;
  sandbox.__tianqiMapJSON = JSON.stringify(TIANQI_MAP_SOURCE.map);
  sandbox.__tianqiMapDataJSON = TIANQI_MAP_SOURCE.mapData ? JSON.stringify(TIANQI_MAP_SOURCE.mapData) : sandbox.__tianqiMapJSON;
  return vm.runInContext(`(function(){
    if (typeof findScenarioById !== 'function') return false;
    var sc = findScenarioById('${SID}');
    if (!sc) return false;
    var need = function(m){ return !m || !Array.isArray(m.regions) || m.regions.length < 40; };
    if (need(sc.map)) sc.map = JSON.parse(__tianqiMapJSON);
    if (need(sc.mapData)) sc.mapData = JSON.parse(__tianqiMapDataJSON);
    return Array.isArray(sc.map.regions) && sc.map.regions.length >= 40;
  })()`, sandbox);
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
  attachTianqiMap(sandbox);   // 显式挂入天启地图(bundle 剥离·真游戏 fetch·headless 须补)·方能验开局绑图
  vm.runInContext(`doActualStart('${SID}')`, sandbox, { timeout: START_VM_TIMEOUT_MS });
  await delay(120);
  const state = countState(sandbox);
  expect(state);
  console.log('[smoke-start-game-data-integrity] ' + label + ' PASS ' + JSON.stringify(state));
}

async function runBackgroundPrewarmCase() {
  const sandbox = loadGame();
  attachTianqiMap(sandbox);
  vm.runInContext(`(function(){
    var sc = findScenarioById('${SID}');
    sc.isFullyDetailed = false;
    sc.aiAutoEnrich = true;
    var target = sc.characters && sc.characters[0];
    window.__staleTargetName = target && target.name;
    if (target) { target.location = '旧地'; target._locationNeedAI = true; }
    window.__resolveStartAudit = null;
    window.__startAuditCalled = false;
    window.__lateDeepReadCalled = false;
    callAISmart = function(){
      window.__startAuditCalled = true;
      return new Promise(function(resolve){ window.__resolveStartAudit = resolve; });
    };
    aiDeepReadScenario = async function(){ window.__lateDeepReadCalled = true; };
    aiPlanScenarioForInference = async function(){};
    aiPlanFactionMatrix = async function(){};
    aiPlanFirstTurnEvents = async function(){};
  })()`, sandbox);

  vm.runInContext(`doActualStart('${SID}')`, sandbox, { timeout: START_VM_TIMEOUT_MS });
  assert(sandbox.__entered === true, 'background prewarm blocked enterGame');
  assert(sandbox.GM && sandbox.GM._aiScenarioDigest && sandbox.GM._aiScenarioDigest._fromScenarioText === true,
    'background prewarm did not seed local digest before enterGame');
  await delay(30);
  assert(sandbox.__startAuditCalled === true && typeof sandbox.__resolveStartAudit === 'function',
    'background logic audit did not start asynchronously');

  const targetBefore = sandbox.GM.chars.find((c) => c && c.name === sandbox.__staleTargetName);
  assert(targetBefore && targetBefore.location === '旧地', 'background test target was not initialized');
  sandbox.GM.turn = 2; // 玩家已推进；晚到 T1 结果必须作废
  sandbox.__resolveStartAudit(JSON.stringify({
    locations: [{ name: sandbox.__staleTargetName, location: '晚到新地', reason: 'smoke' }],
    fixes: [], notes: []
  }));
  await delay(30);
  const targetAfter = sandbox.GM.chars.find((c) => c && c.name === sandbox.__staleTargetName);
  assert(targetAfter.location === '旧地', 'stale background audit mutated a later turn');
  assert(sandbox.__lateDeepReadCalled === false, 'stale background pipeline continued after turn changed');
  console.log('[smoke-start-game-data-integrity] background-prewarm-nonblocking-and-stale-safe PASS');
}

async function runDeepReadImmutableConfigCase() {
  const sandbox = loadGame();
  attachTianqiMap(sandbox);
  vm.runInContext(`doActualStart('${SID}')`, sandbox, { timeout: START_VM_TIMEOUT_MS });
  await delay(40);
  vm.runInContext(`(function(){
    var sc = findScenarioById('${SID}');
    sc.isFullyDetailed = false;
    sc.aiAutoEnrich = true;
    GM.turn = 1;
    GM._aiScenarioDigest = { _fromScenarioText: true };
    P.conf.aiDeepReadConcurrency = 1;
    P.ai.key = 'immutable-key';
    P.ai.url = 'http://immutable.local/v1';
    P.ai.model = 'immutable-model';
    window.__immutableDeepReadRequests = [];
    fetch = function(url, opts){
      var body = JSON.parse(opts.body);
      window.__immutableDeepReadRequests.push({
        url: String(url),
        authorization: opts.headers.Authorization,
        model: body.model
      });
      if (window.__immutableDeepReadRequests.length === 1) {
        P.ai.key = 'rotated-key';
        P.ai.url = 'http://rotated.local/v1';
        P.ai.model = 'rotated-model';
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function(){ return Promise.resolve({ choices: [{ message: { content: '{}' } }] }); }
      });
    };
  })()`, sandbox);
  const result = await Promise.race([
    vm.runInContext(`window.__smokeRealAiDeepReadScenario({ background: true, requestTimeoutMs: 2000 })`, sandbox)
      .then(function(){ return 'settled'; }),
    delay(5000).then(function(){ return 'hung'; })
  ]);
  assert(result === 'settled', 'deep-read immutable-config smoke did not settle');
  const requests = sandbox.__immutableDeepReadRequests;
  assert(Array.isArray(requests) && requests.length === 27, 'deep read did not issue the expected 27 requests: ' + (requests && requests.length));
  assert(requests.every((request) => request.authorization === 'Bearer immutable-key'), 'deep read mixed a rotated API key into the same session');
  assert(requests.every((request) => request.url === 'http://immutable.local/v1/chat/completions'), 'deep read mixed a rotated endpoint into the same session');
  assert(requests.every((request) => request.model === 'immutable-model'), 'deep read mixed a rotated model into the same session');
  console.log('[smoke-start-game-data-integrity] deepread-config-is-immutable PASS');
}

async function runDeepReadStaleCallCase() {
  const sandbox = loadGame();
  attachTianqiMap(sandbox);
  vm.runInContext(`doActualStart('${SID}')`, sandbox, { timeout: START_VM_TIMEOUT_MS });
  await delay(40);
  vm.runInContext(`(function(){
    var sc = findScenarioById('${SID}');
    sc.isFullyDetailed = false;
    sc.aiAutoEnrich = true;
    GM.turn = 1;
    GM._aiScenarioDigest = { _fromScenarioText: true };
    P.conf.aiDeepReadConcurrency = 1;
    P.ai.key = 'stale-key';
    P.ai.url = 'http://stale.local/v1';
    P.ai.model = 'stale-model';
    window.__staleDeepReadFetchCalls = 0;
    window.__staleDeepReadSignals = [];
    AbortController = function(){
      var listeners = [];
      this.signal = {
        aborted: false,
        addEventListener: function(type, listener){ if (type === 'abort') listeners.push(listener); },
        removeEventListener: function(type, listener){
          if (type !== 'abort') return;
          listeners = listeners.filter(function(candidate){ return candidate !== listener; });
        }
      };
      this.abort = function(){
        if (this.signal.aborted) return;
        this.signal.aborted = true;
        listeners.slice().forEach(function(listener){ listener(); });
      };
    };
    fetch = function(url, opts){
      window.__staleDeepReadFetchCalls += 1;
      window.__staleDeepReadSignals.push(opts.signal);
      return new Promise(function(resolve, reject){
        function abort(){ var error = new Error('aborted'); error.name = 'AbortError'; reject(error); }
        if (opts.signal && opts.signal.aborted) abort();
        else if (opts.signal) opts.signal.addEventListener('abort', abort);
      });
    };
  })()`, sandbox);

  const pending = vm.runInContext(
    `window.__smokeRealAiDeepReadScenario({ background: true, requestTimeoutMs: 5000 })`,
    sandbox
  );
  for (let i = 0; i < 20 && sandbox.__staleDeepReadFetchCalls === 0; i++) await delay(20);
  assert(sandbox.__staleDeepReadFetchCalls === 1, 'deep-read stale-call smoke did not start exactly one queued request');
  sandbox.P.ai.key = 'replacement-key';
  sandbox.GM.turn = 2;
  const result = await Promise.race([
    pending.then(function(){ return 'settled'; }),
    delay(1500).then(function(){ return 'hung'; })
  ]);
  assert(result === 'settled', 'stale deep-read request was not aborted promptly');
  assert(sandbox.__staleDeepReadSignals[0] && sandbox.__staleDeepReadSignals[0].aborted === true,
    'stale deep-read fetch did not receive an abort signal');
  assert(sandbox.__staleDeepReadFetchCalls === 1, 'stale deep-read worker continued queueing requests or retried after abort');
  console.log('[smoke-start-game-data-integrity] deepread-stale-call-aborts-and-stops-queue PASS');
}

async function runFastStartGateCase() {
  const sandbox = loadGame();
  attachTianqiMap(sandbox);
  vm.runInContext(`
    P.conf.gameMode = 'yanyi';
    // This case isolates the fast-start gate; lazy-loader behavior has its own VM smoke.
    window.TMOfficialScenarioLoader = null;
    window.__openingCeremonyShown = false;
    window.__modelDetectStarted = false;
    _tmShowOpeningCeremony = function(){ window.__openingCeremonyShown = true; };
    detectModelContextSize = function(){
      window.__modelDetectStarted = true;
      return new Promise(function(){});
    };
  `, sandbox);
  const result = await Promise.race([
    sandbox.startGame(SID).then(() => 'returned'),
    delay(100).then(() => 'blocked')
  ]);
  assert(result === 'returned', 'startGame waited for model detection/artificial loading stages');
  assert(sandbox.__modelDetectStarted === true, 'model detection was not launched in background');
  assert(sandbox.__openingCeremonyShown === true, 'fast start did not continue to opening ceremony');
  console.log('[smoke-start-game-data-integrity] fast-start-skips-artificial-and-model-waits PASS');
}

async function runStartRequestRaceCase() {
  const sandbox = loadGame();
  attachTianqiMap(sandbox);
  vm.runInContext(`
    window.__ensureResolvers = [];
    window.__ceremonyTokens = [];
    window.__raceToasts = [];
    window.TMOfficialScenarioLoader = {
      ready: function(){ return Promise.resolve(); },
      isLazy: function(){ return true; },
      ensure: function(){ return new Promise(function(resolve){ window.__ensureResolvers.push(resolve); }); },
      entry: function(){ return { id: '${SID}' }; }
    };
    _tmShowOpeningCeremony = function(sc, sid, token){ window.__ceremonyTokens.push({ sid: sid, token: token }); };
    toast = function(message){ window.__raceToasts.push(String(message)); };
  `, sandbox);

  const first = sandbox.startGame(SID);
  await delay(5);
  assert(sandbox.__ensureResolvers.length === 1, 'first start did not enter lazy load');
  const second = sandbox.startGame(SID);
  await delay(5);
  assert(sandbox.__ensureResolvers.length === 2, 'double start did not reach two independent lazy loads');
  sandbox.__ensureResolvers[1]();
  await second;
  assert(sandbox.__ceremonyTokens.length === 1, 'latest start request did not reach ceremony exactly once');
  sandbox.__ensureResolvers[0]();
  await first;
  assert(sandbox.__ceremonyTokens.length === 1, 'stale start request reached ceremony after a newer request');
  const startErrors = sandbox.__raceToasts.filter((message) => /剧本加载失败|未找到|史实检查失败/.test(message));
  assert(startErrors.length === 0, 'stale start request emitted a user-visible start error: ' + JSON.stringify(startErrors));
  console.log('[smoke-start-game-data-integrity] latest-start-request-wins PASS');
}

async function runLazyLoadFailureUnlockCase() {
  const sandbox = loadGame();
  attachTianqiMap(sandbox);
  vm.runInContext(`
    window.__unlockEnsureCalls = 0;
    window.__unlockHideCalls = 0;
    window.__unlockCeremonies = 0;
    window.__unlockToasts = [];
    var __unlockPage = _$('scn-page');
    __unlockPage.classList = (function(){
      var classes = Object.create(null);
      return {
        add: function(name){ classes[name] = true; },
        remove: function(name){ delete classes[name]; },
        toggle: function(name){ if (classes[name]) delete classes[name]; else classes[name] = true; },
        contains: function(name){ return classes[name] === true; }
      };
    })();
    window.TMOfficialScenarioLoader = {
      ready: function(){ return Promise.resolve(); },
      isLazy: function(){ return true; },
      ensure: function(){
        window.__unlockEnsureCalls += 1;
        return window.__unlockEnsureCalls === 1
          ? Promise.reject(new Error('simulated official scenario timeout'))
          : Promise.resolve(findScenarioById('${SID}'));
      },
      entry: function(){ return { id: '${SID}' }; }
    };
    hideLoading = function(){ window.__unlockHideCalls += 1; };
    toast = function(message){ window.__unlockToasts.push(String(message)); };
    _tmShowOpeningCeremony = function(){ window.__unlockCeremonies += 1; };
  `, sandbox);

  await sandbox.startGame(SID);
  const page = sandbox.document.getElementById('scn-page');
  assert(page && page.classList.contains('show'), 'failed lazy load did not restore the scenario selection page');
  assert(page.style.pointerEvents === '', 'failed lazy load left the scenario page interaction-locked');
  assert(sandbox.__unlockHideCalls >= 1, 'failed lazy load did not hide the loading overlay');
  assert(sandbox.__unlockCeremonies === 0, 'failed lazy load continued into the opening ceremony');
  assert(sandbox.__unlockToasts.some((message) => message.includes('simulated official scenario timeout')),
    'failed lazy load did not explain the timeout');

  await sandbox.startGame(SID);
  assert(sandbox.__unlockEnsureCalls === 2, 'retry did not re-enter official scenario loading');
  assert(sandbox.__unlockCeremonies === 1, 'a retry after load failure remained locked out');
  console.log('[smoke-start-game-data-integrity] lazy-load-failure-unlocks-and-retries PASS');
}

async function runStrictHistoryFastPathCase() {
  const sandbox = loadGame();
  vm.runInContext(`
    P.conf.gameMode = 'strict_hist';
    P.scenarios.push({
      id: 'smoke-custom-history',
      name: 'Custom history smoke',
      era: 'Test era',
      role: 'Test role',
      background: 'Custom scenario',
      opening: 'This deliberately long opening text exceeds fifty characters so strict history mode must audit it before the ceremony is shown to the player.',
      overview: 'Custom scenario overview'
    });
    validateScenario = function(){ return { valid: true, warnings: [] }; };
    window.__historyCalls = 0;
    window.__historyOpeningAtCeremony = '';
    window.__historyToasts = [];
    callAISmart = async function(){
      window.__historyCalls += 1;
      return JSON.stringify({ hasErrors: true, errorCount: 1, errors: ['smoke'], correctedText: 'Corrected historical opening text that remains long enough for the ceremony.' });
    };
    toast = function(message){ window.__historyToasts.push(String(message)); };
    _tmShowOpeningCeremony = function(sc){ window.__historyOpeningAtCeremony = sc.opening; };
  `, sandbox);
  await sandbox.startGame('smoke-custom-history');
  assert(sandbox.__historyCalls === 1, 'strict history fast path skipped the historical audit');
  assert(sandbox.__historyOpeningAtCeremony.startsWith('Corrected historical opening'), 'ceremony used the unreviewed opening text');
  console.log('[smoke-start-game-data-integrity] strict-history-fast-path-preserved PASS');
}

async function runMemorialCandidateOrderingCase() {
  const sandbox = loadGame();
  attachTianqiMap(sandbox);
  vm.runInContext(`(function(){
    var sc = findScenarioById('${SID}');
    (P.scenarios || []).forEach(function(candidate){ if (candidate && candidate.id === '${SID}') candidate.memorials = []; });
    sc.memorials = [];
    window.__scenarioMemorialLengths = (P.scenarios || []).filter(function(candidate){ return candidate && candidate.id === '${SID}'; }).map(function(candidate){ return Array.isArray(candidate.memorials) ? candidate.memorials.length : -1; });
    window.__memorialGenerateCalls = 0;
    window.__candidateSeenByMemorials = false;
    window.__candidatePlanCalls = 0;
    generateMemorials = function(){
      window.__memorialGenerateCalls += 1;
      window.__candidateSeenByMemorials = Array.isArray(GM._candidateEvents) && GM._candidateEvents.length > 0;
    };
    renderMemorials = function(){};
    aiPlanFirstTurnEvents = async function(){
      window.__candidatePlanCalls += 1;
      await Promise.resolve();
      GM._candidateEvents = [{ id: 'opening-smoke', type: 'memorial', presenter: 'Tester', payload: 'Opening event' }];
    };
    aiDeepReadScenario = async function(){};
    aiPlanScenarioForInference = async function(){};
    aiPlanFactionMatrix = async function(){};
  })()`, sandbox);
  vm.runInContext(`doActualStart('${SID}')`, sandbox, { timeout: START_VM_TIMEOUT_MS });
  assert(sandbox.__entered === true, 'candidate planning blocked enterGame');
  assert(sandbox.__memorialGenerateCalls === 0, 'AI memorial generation ran before candidate planning settled');
  sandbox.__memorialsImmediatelyAfterStart = sandbox.GM && sandbox.GM.memorials && sandbox.GM.memorials.length;
  for (let i = 0; i < 10 && sandbox.__memorialGenerateCalls === 0; i++) await delay(50);
  assert(sandbox.__memorialGenerateCalls === 1, 'candidate planning did not trigger exactly one initial memorial generation: ' + JSON.stringify({
    generated: sandbox.__memorialGenerateCalls,
    planned: sandbox.__candidatePlanCalls,
    turn: sandbox.GM && sandbox.GM.turn,
    memorials: sandbox.GM && sandbox.GM.memorials && sandbox.GM.memorials.length,
    firstMemorial: sandbox.GM && sandbox.GM.memorials && sandbox.GM.memorials[0] && {
      from: sandbox.GM.memorials[0].from,
      title: sandbox.GM.memorials[0].title,
      sid: sandbox.GM.memorials[0]._sid
    },
    immediateMemorials: sandbox.__memorialsImmediatelyAfterStart,
    scenarioMemorials: sandbox.__scenarioMemorialLengths,
    prewarm: sandbox.TM && sandbox.TM.startPrewarm
  }));
  assert(sandbox.__candidateSeenByMemorials === true, 'initial memorial generation did not see the candidate event pool');
  console.log('[smoke-start-game-data-integrity] first-turn-candidates-before-memorials PASS');
}

async function runMemorialInteractionGuardCase() {
  const sandbox = loadGame();
  attachTianqiMap(sandbox);
  vm.runInContext(`(function(){
    var sc = findScenarioById('${SID}');
    (P.scenarios || []).forEach(function(candidate){ if (candidate && candidate.id === '${SID}') candidate.memorials = []; });
    sc.memorials = [];
    window.__guardedMemorialGenerateCalls = 0;
    window.__resolveGuardedCandidates = null;
    generateMemorials = function(){ window.__guardedMemorialGenerateCalls += 1; };
    renderMemorials = function(){};
    aiPlanFirstTurnEvents = function(){
      return new Promise(function(resolve){
        window.__resolveGuardedCandidates = function(){
          GM._candidateEvents = [{ id: 'late-opening-smoke', type: 'memorial', presenter: 'Tester', payload: 'Late opening event' }];
          resolve();
        };
      });
    };
    aiDeepReadScenario = async function(){};
    aiPlanScenarioForInference = async function(){};
    aiPlanFactionMatrix = async function(){};
  })()`, sandbox);
  vm.runInContext(`doActualStart('${SID}')`, sandbox, { timeout: START_VM_TIMEOUT_MS });
  for (let i = 0; i < 10 && typeof sandbox.__resolveGuardedCandidates !== 'function'; i++) await delay(20);
  assert(typeof sandbox.__resolveGuardedCandidates === 'function', 'guarded candidate planner did not start');
  assert(sandbox.GM.memorials.length > 0, 'interaction guard needs the opening system memorial set');
  sandbox.GM.memorials[0].content = String(sandbox.GM.memorials[0].content || '') + ' [player body edit]';
  sandbox.__resolveGuardedCandidates();
  await delay(80);
  assert(sandbox.__guardedMemorialGenerateCalls === 0, 'late candidates overwrote memorials after a body-only edit');
  console.log('[smoke-start-game-data-integrity] player-body-edit-blocks-late-initial-memorials PASS');
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
  await runFastStartGateCase();
  await runStartRequestRaceCase();
  await runLazyLoadFailureUnlockCase();
  await runStrictHistoryFastPathCase();
  await runMemorialCandidateOrderingCase();
  await runMemorialInteractionGuardCase();
  await runBackgroundPrewarmCase();
  await runDeepReadImmutableConfigCase();
  await runDeepReadStaleCallCase();
  process.exit(0);
})().catch((e) => {
  console.error('[smoke-start-game-data-integrity] FAIL ' + (e && e.message || e));
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 8).join('\n'));
  process.exit(1);
});
