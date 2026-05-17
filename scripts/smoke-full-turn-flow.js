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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(label, fn, timeoutMs) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = fn();
      if (value) return value;
    } catch (e) {
      last = e;
    }
    await delay(40);
  }
  throw new Error('timeout waiting for ' + label + (last ? ': ' + last.message : ''));
}

function loadHeadlessHelpers() {
  const source = fs.readFileSync(HEADLESS, 'utf8')
    .replace(/^#![^\n]*\n/, '')
    .replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };');
  const factory = new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', source);
  return factory(require, process, __dirname, HEADLESS, { exports: {} }, {});
}

const helpers = loadHeadlessHelpers();

function installNodeExtras(win, flow) {
  win.__flow = flow;
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
    flow.fetchCalls++;
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get() { return ''; } },
      text() { return Promise.resolve('{"ok":true}'); },
      json() {
        return Promise.resolve({
          choices: [{ message: { content: '{"ok":true,"summary":"mock"}' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        });
      }
    });
  };
  win.tianming = {
    writeTurnData() { flow.writeTurnData++; return Promise.resolve({ ok: true }); },
    autoSave() { flow.autoSave++; return Promise.resolve({ ok: true }); },
    saveGame() { return Promise.resolve({ ok: true }); }
  };
}

function loadGame() {
  const flow = {
    logs: [],
    warns: [],
    errors: [],
    loading: [],
    toasts: [],
    turnResults: [],
    fetchCalls: 0,
    writeTurnData: 0,
    autoSave: 0,
    aiCalls: [],
    steps: []
  };
  const env = helpers.makeStubs();
  env.win.console = {
    log: (...a) => flow.logs.push(a.map(String).join(' ')),
    warn: (...a) => flow.warns.push(a.map(String).join(' ')),
    error: (...a) => flow.errors.push(a.map(String).join(' ')),
    info: (...a) => flow.logs.push(a.map(String).join(' ')),
    debug: () => {}
  };
  installNodeExtras(env.win, flow);
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
    window.__flow = window.__flow || {};
    showLoading = function(msg, pct) {
      window.__flow.loading.push({ turn: GM && GM.turn || 0, msg: String(msg || ''), pct: pct || 0 });
    };
    hideLoading = function() {
      window.__flow.loading.push({ turn: GM && GM.turn || 0, msg: 'hide', pct: 0 });
    };
    toast = function(msg) { window.__flow.toasts.push(String(msg || '')); };
    showTurnResult = function(html, idx) {
      window.__flow.turnResults.push({ idx: idx, len: String(html || '').length, head: String(html || '').slice(0, 120) });
    };
    ['renderGameState','renderMemorials','renderQiju','renderJishi','renderBiannian','renderShijiList','renderRenwuList','renderMap'].forEach(function(name) {
      window[name] = function(){};
    });
    generateMemorials = function() {
      if (!GM.memorials) GM.memorials = [];
    };
    var __smokeRealEnterGame = typeof enterGame === 'function' ? enterGame : null;
    enterGame = function(){
      window.__flow.entered = true;
      if (__smokeRealEnterGame) return __smokeRealEnterGame.apply(this, arguments);
    };
    aiDeepReadScenario = async function(){ window.__flow.aiDeepRead = true; };
    aiPlanScenarioForInference = async function(){ window.__flow.aiPlan = true; };
    aiPlanFactionMatrix = async function(){ window.__flow.aiMatrix = true; };
    aiPlanFirstTurnEvents = async function(){ window.__flow.aiFirstTurn = true; };
    if (!P.ai) P.ai = {};
    P.ai.key = 'mock-key';
    P.ai.url = 'http://mock.local/v1/chat/completions';
    P.ai.model = 'mock-model';
    if (!P.conf) P.conf = {};
    P.conf.npcAiPrecision = false;
  `, sandbox);

  sandbox.__flow = flow;
  return sandbox;
}

function installInputNodes(sandbox) {
  vm.runInContext(`
    (function(){
      var prevGet = document.getElementById ? document.getElementById.bind(document) : function(){ return null; };
      function node(value) {
        return {
          value: value || '',
          textContent: '',
          innerHTML: '',
          style: {},
          dataset: {},
          classList: { add:function(){}, remove:function(){}, toggle:function(){ return false; }, contains:function(){ return false; } },
          addEventListener:function(){},
          removeEventListener:function(){},
          remove:function(){},
          focus:function(){},
          blur:function(){},
          querySelector:function(){ return null; },
          querySelectorAll:function(){ return []; },
          getAttribute:function(){ return null; },
          setAttribute:function(){},
          appendChild:function(c){ return c; }
        };
      }
      var nodes = {
        'edict-pol': node('整饬辽饷与边储，命户部核实辽东军饷，严禁层层冒支。'),
        'edict-mil': node('命蓟辽督抚清点边军实额，修缮宁远、锦州诸堡，优先补足火器与粮草。'),
        'edict-dip': node('遣使朝鲜，询边情而厚赐安抚，使其严报建州动向。'),
        'edict-eco': node('准江南漕运诸司暂缓无名加派，令地方具册奏明实收实支。'),
        'edict-oth': node('命内阁汇整灾荒、兵饷、矿税三事，月内再奏。'),
        'xinglu-pub': node('朕意在先稳边储，再察财政浮冒。诸臣可直言利弊，不得以空文塞责。'),
        'btn-end': node('静待时变'),
        'btn-end-turn': node('静待时变')
      };
      document.getElementById = function(id) { return nodes[id] || prevGet(id); };
      window.__flow.inputNodeIds = Object.keys(nodes);
    })();
  `, sandbox, { timeout: 10000 });
}

function installMockAi(sandbox) {
  vm.runInContext(`
    _endTurn_aiInfer = async function(edicts, xinglu, memRes, oldVars, externalCtx) {
      var ctx = externalCtx || { input: {}, results: {}, record: {}, meta: {} };
      ctx.input = ctx.input || {};
      ctx.results = ctx.results || {};
      ctx.record = ctx.record || {};
      ctx.meta = ctx.meta || {};
      var currentCourtDecisions = [];
      try {
        currentCourtDecisions = TM.Endturn.AI.prompt.getCurrentChangchaoDecisions(GM);
      } catch(_) {}
      var currentCourtRecords = (GM._courtRecords || []).filter(function(r) {
        return r && Number(r.targetTurn || r.turn || 0) === Number(GM.turn || 0);
      });
      var nextCourtRecords = (GM._courtRecords || []).filter(function(r) {
        return r && Number(r.targetTurn || r.turn || 0) === Number((GM.turn || 0) + 1);
      });
      window.__flow.aiCalls.push({
        turn: GM.turn,
        edictCategories: Object.keys(edicts || {}).filter(function(k){ return edicts[k]; }),
        xingluLength: String(xinglu || '').length,
        memorials: Array.isArray(memRes) ? memRes.length : 0,
        currentCourtDecisions: currentCourtDecisions.length,
        currentCourtRecords: currentCourtRecords.length,
        nextCourtRecords: nextCourtRecords.length
      });
      var p1 = {
        summary: '模拟主推演：整饬辽饷、清点边军、约束加派。',
        variables: [
          { name: '财政', delta: -1, reason: '核饷与修堡先支后效' },
          { name: '军务', delta: 1, reason: '清军实额使边备稍明' }
        ],
        npc_actions: [
          { name: '袁崇焕', action: '请核边饷', result: '奏请实支实销' },
          { name: '魏忠贤', action: '观望内廷', result: '暂缓正面冲突' }
        ],
        factions: [
          { name: '后金', summary: '窥辽西补防，暂未大举。' }
        ]
      };
      ctx.results.sc1 = p1;
      ctx.record.shizhengji = '天启七年九月，帝命核辽饷、修边堡，朝臣以饷源与边备相争。';
      ctx.record.zhengwen = '户部奉旨核算辽东饷额，蓟辽督抚清点军伍。江南漕运诸司因暂缓加派而议论纷起，朝鲜使事亦被责令详报边情。';
      ctx.record.playerStatus = '御案劳神而政令已下。';
      ctx.record.playerInner = '疑饷弊久积，欲先清册再议大征。';
      ctx.record.turnSummary = '本回合以财政核查和辽东边备为主线。';
      ctx.record.shiluText = '上谕户部核辽饷，命边臣修宁锦诸堡。';
      ctx.record.szjTitle = '核饷修边';
      ctx.record.szjSummary = '朝廷转向清饷与边备整理。';
      ctx.record.personnelChanges = [{ name: '袁崇焕', change: '奉旨清点宁锦边务' }];
      ctx.record.hourenXishuo = '后人多谓此时若饷册早清，辽事或少一重虚耗。';
      ctx.record.suggestions = [{ title: '追核辽饷', detail: '下回合可继续问责虚冒军额。' }];
      GM._turnAiResults = {
        subcall1: p1,
        _mockFullTurnFlow: true,
        shizhengji: ctx.record.shizhengji,
        zhengwen: ctx.record.zhengwen
      };
      if (typeof addEB === 'function') addEB('AI推演', '模拟 AI 完成本回合推演：核饷、修边、察财政。');
      return {
        shizhengji: ctx.record.shizhengji,
        zhengwen: ctx.record.zhengwen,
        playerStatus: ctx.record.playerStatus,
        playerInner: ctx.record.playerInner,
        turnSummary: ctx.record.turnSummary,
        timeRatio: typeof getTimeRatio === 'function' ? getTimeRatio() : 1,
        suggestions: ctx.record.suggestions,
        shiluText: ctx.record.shiluText,
        szjTitle: ctx.record.szjTitle,
        szjSummary: ctx.record.szjSummary,
        personnelChanges: ctx.record.personnelChanges,
        hourenXishuo: ctx.record.hourenXishuo
      };
    };
  `, sandbox, { timeout: 10000 });
}

function simulatePlayerAndNpcTurn(sandbox) {
  vm.runInContext(`
    (function(){
      var playerFaction = P.playerInfo && P.playerInfo.factionName || '明';
      var preferredNames = ['袁崇焕', '孙承宗', '叶向高', '韩爌', '杨鹤', '徐光启', '魏忠贤'];
      var minister = null;
      for (var pi = 0; pi < preferredNames.length && !minister; pi++) {
        minister = (GM.chars || []).find(function(c) { return c && c.alive !== false && c.name === preferredNames[pi]; });
      }
      minister = minister || (GM.chars || []).find(function(c) {
        return c && c.alive !== false
          && (c.faction === playerFaction || c.factionName === playerFaction)
          && c.name !== (P.playerInfo && P.playerInfo.characterName)
          && (c.officialTitle || c.office || c.position || c.department);
      }) || (GM.chars || []).filter(Boolean)[0] || { name: '廷臣' };

      if (!Array.isArray(GM.memorials)) GM.memorials = [];
      GM.memorials.push({
        id: 'flow_memorial_1',
        from: minister.name || '廷臣',
        title: '辽饷浮冒与边储告急',
        type: '财政',
        subtype: '题本',
        content: '臣闻辽饷支给多有虚冒，边储亦不相继，请先核实军额与仓储。',
        status: 'pending',
        turn: GM.turn,
        reply: ''
      });

      if (!Array.isArray(GM._courtRecords)) GM._courtRecords = [];
      var inTurnRecord = {
        turn: GM.turn,
        targetTurn: GM.turn,
        phase: 'in-turn',
        mode: 'changchao',
        topic: '早朝·辽饷与边备',
        decisions: [{ action: 'approve', label: '核辽饷、修边堡', extra: '先清册，后增饷。' }],
        transcript: [
          { role: 'player', speaker: P.playerInfo && P.playerInfo.characterName || '皇帝', text: '先核实辽饷，再议增兵。' },
          { role: 'npc', speaker: minister.name || '廷臣', text: '边储若虚，清册不可缓。' }
        ],
        _v3: true
      };
      GM._courtRecords.push(inTurnRecord);
      GM._lastChangchaoDecisions = inTurnRecord.decisions.slice();
      GM._lastChangchaoDecisionMeta = { turn: inTurnRecord.turn, targetTurn: inTurnRecord.targetTurn, phase: inTurnRecord.phase, mode: inTurnRecord.mode };
      GM._lastChangchaoDecisionsTargetTurn = inTurnRecord.targetTurn;
      if (typeof recordCourtHeld === 'function') recordCourtHeld({ isPostTurn: false, source: 'full-turn-flow' });

      if (typeof _stageMemorialDecision === 'function') {
        _stageMemorialDecision(GM.memorials[GM.memorials.length - 1], 'annotated', '着户部、兵部会核辽饷与边储，十日内具册。');
      }

      if (!Array.isArray(GM.letters)) GM.letters = [];
      GM.letters.push({
        id: 'flow_letter_1',
        from: P.playerInfo && P.playerInfo.characterName || '皇帝',
        to: minister.name || '廷臣',
        content: '卿可密访辽饷实额，勿使浮冒者预闻。',
        sentTurn: GM.turn,
        deliveryTurn: GM.turn + 1,
        replyTurn: GM.turn + 2,
        status: 'traveling',
        urgency: 'urgent',
        letterType: 'personal',
        _replyExpected: true
      });

      if (!Array.isArray(GM.evtLog)) GM.evtLog = [];
      GM.evtLog.push({ turn: GM.turn, type: '玩家操作', text: '早朝议辽饷，御笔下诏核饷修边，并朱批一件奏疏。' });
      GM.evtLog.push({ turn: GM.turn, type: 'NPC自主', text: '袁崇焕请核宁锦兵额，魏忠贤暂观内廷风向。' });
      window.__flow.playerActionSummary = {
        turn: GM.turn,
        minister: minister.name || '廷臣',
        memorials: GM.memorials.length,
        letters: GM.letters.length,
        courtRecords: GM._courtRecords.length
      };
    })();
  `, sandbox, { timeout: 10000 });
}

function simulatePostTurnCourtDecision(sandbox, startingTurn) {
  vm.runInContext(`
    (function(){
      var startTurn = ${startingTurn};
      if (!Array.isArray(GM._courtRecords)) GM._courtRecords = [];
      var postRecord = {
        turn: startTurn,
        targetTurn: startTurn + 1,
        phase: 'post-turn',
        mode: 'changchao',
        topic: '朔朝·次月边饷部署',
        decisions: [{ action: 'decree', label: '次月继续追核辽饷', extra: '朔朝所议归入下一回合。' }],
        transcript: [
          { role: 'player', speaker: P.playerInfo && P.playerInfo.characterName || '皇帝', text: '次月仍以辽饷为先。' },
          { role: 'npc', speaker: '阁臣', text: '谨遵上意，俟册至再议。' }
        ],
        _v3: true
      };
      GM._courtRecords.push(postRecord);
      GM._lastChangchaoDecisions = postRecord.decisions.slice();
      GM._lastChangchaoDecisionMeta = { turn: postRecord.turn, targetTurn: postRecord.targetTurn, phase: postRecord.phase, mode: postRecord.mode };
      GM._lastChangchaoDecisionsTargetTurn = postRecord.targetTurn;
      if (typeof recordCourtHeld === 'function') recordCourtHeld({ isPostTurn: true, source: 'full-turn-flow' });
      if (!Array.isArray(GM.qijuHistory)) GM.qijuHistory = [];
      GM.qijuHistory.unshift({ turn: startTurn, targetTurn: startTurn + 1, phase: 'post-turn', content: '朔朝议次月辽饷部署。' });
      window.__flow.postTurnCourtSummary = { turn: startTurn, targetTurn: startTurn + 1, courtRecords: GM._courtRecords.length };
    })();
  `, sandbox, { timeout: 10000 });
}

function summarize(sandbox) {
  return vm.runInContext(`JSON.stringify((function(){
    var lastRun = (TM.Endturn && TM.Endturn.Pipeline && TM.Endturn.Pipeline.lastRun) ? TM.Endturn.Pipeline.lastRun() : [];
    return {
      turn: GM.turn,
      busy: !!GM.busy,
      endTurnBusy: !!GM._endTurnBusy,
      chars: Array.isArray(GM.chars) ? GM.chars.length : 0,
      factions: Array.isArray(GM.facs) ? GM.facs.length : 0,
      memorials: Array.isArray(GM.memorials) ? GM.memorials.length : 0,
      approvedMemorials: Array.isArray(GM._approvedMemorials) ? GM._approvedMemorials.length : 0,
      letters: Array.isArray(GM.letters) ? GM.letters.length : 0,
      qijuHistory: Array.isArray(GM.qijuHistory) ? GM.qijuHistory.length : 0,
      shijiHistory: Array.isArray(GM.shijiHistory) ? GM.shijiHistory.length : 0,
      lastShijiTurn: GM.shijiHistory && GM.shijiHistory.length ? GM.shijiHistory[GM.shijiHistory.length - 1].turn : null,
      courtMeter: GM._courtMeter || null,
      courtRecords: Array.isArray(GM._courtRecords) ? GM._courtRecords.map(function(r){ return { turn:r.turn, targetTurn:r.targetTurn, phase:r.phase, topic:r.topic }; }) : [],
      pendingShiji: GM._pendingShijiModal ? {
        aiReady: !!GM._pendingShijiModal.aiReady,
        courtDone: GM._pendingShijiModal.courtDone,
        hasPayload: !!GM._pendingShijiModal.payload
      } : null,
      pipeline: lastRun.map(function(x){ return { step:x.step, ok:!!x.ok, ms:Math.round(x.ms || 0), error:x.error ? String(x.error.message || x.error || '') : '' }; }),
      aiCalls: window.__flow.aiCalls,
      turnResults: window.__flow.turnResults,
      playerActionSummary: window.__flow.playerActionSummary,
      postTurnCourtSummary: window.__flow.postTurnCourtSummary,
      loadingTail: window.__flow.loading.slice(-8),
      toasts: window.__flow.toasts.slice(-8),
      errors: window.__flow.errors.slice(-8),
      warns: window.__flow.warns.slice(-8),
      writeTurnData: window.__flow.writeTurnData,
      autoSave: window.__flow.autoSave
    };
  })())`, sandbox, { timeout: 10000 });
}

async function main() {
  const sandbox = loadGame();

  vm.runInContext(`
    _pendingUseMap = true;
    _pendingMapModeSid = '${SID}';
    _pendingMapModeAt = Date.now();
    doActualStart('${SID}');
  `, sandbox, { timeout: 10000 });
  await delay(160);

  assert(sandbox.GM && sandbox.GM.running, 'game should be running after doActualStart');
  assert(Array.isArray(sandbox.GM.chars) && sandbox.GM.chars.length >= 100, 'characters should load');
  assert(Array.isArray(sandbox.GM.facs) && sandbox.GM.facs.length >= 10, 'factions should load');
  assert(sandbox.GM.vars && Object.keys(sandbox.GM.vars).length >= 20, 'core vars should load');

  installInputNodes(sandbox);
  installMockAi(sandbox);
  simulatePlayerAndNpcTurn(sandbox);

  const startTurn = sandbox.GM.turn;
  vm.runInContext(`endTurn();`, sandbox, { timeout: 10000 });
  assert(!sandbox.GM.busy, 'endTurn prompt should not set busy before player chooses post-turn court');

  vm.runInContext(`_postTurnCourtChoose(true);`, sandbox, { timeout: 10000 });
  simulatePostTurnCourtDecision(sandbox, startTurn);

  await waitFor('deferred AI payload', () => {
    const p = sandbox.GM && sandbox.GM._pendingShijiModal;
    return p && p.aiReady && p.payload;
  }, 20000);

  assert(sandbox.GM.turn === startTurn + 1, 'end-turn systems should advance exactly one turn');
  const logBeforeCourtEnd = sandbox.TM.Endturn.Pipeline.lastRun();
  assert(logBeforeCourtEnd.length >= 6, 'pipeline should record six steps');
  assert(logBeforeCourtEnd.every((x) => x.ok), 'all pipeline steps should pass before court close');

  await vm.runInContext(`_onPostTurnCourtEnd();`, sandbox, { timeout: 20000 });
  await waitFor('post-turn court render completion', () => {
    return sandbox.GM && sandbox.GM._pendingShijiModal && sandbox.GM._pendingShijiModal.courtDone === true;
  }, 10000);
  await delay(80);

  const summary = JSON.parse(summarize(sandbox));

  assert(summary.turn === startTurn + 1, 'turn should remain advanced by one after court close');
  assert(summary.busy === false && summary.endTurnBusy === false, 'busy flags should be cleared');
  assert(summary.shijiHistory >= 1, 'shiji history should be written');
  assert(summary.lastShijiTurn === startTurn, 'shiji should record the ended turn');
  assert(summary.turnResults.length >= 1, 'turn result modal should be shown after post-turn court closes');
  assert(summary.aiCalls.length === 1, 'mock AI should run once');
  assert(summary.aiCalls[0].currentCourtDecisions >= 1, 'AI should retain current-turn in-turn court decisions even after Shuochao starts');
  assert(summary.aiCalls[0].currentCourtRecords >= 1, 'AI should see current-turn in-turn court record');
  assert(summary.aiCalls[0].nextCourtRecords >= 1, 'simulation should include next-turn post-turn court record');
  assert(summary.courtMeter && summary.courtMeter.byTurn && summary.courtMeter.byTurn[String(startTurn)] >= 1,
    'in-turn court should count for current turn');
  assert(summary.courtMeter && summary.courtMeter.byTurn && summary.courtMeter.byTurn[String(startTurn + 1)] >= 1,
    'post-turn court should count for next turn');

  console.log('[full-turn-flow] PASS');
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error('[full-turn-flow] FAIL ' + (e && e.message || e));
  if (e && e.stack) console.error(e.stack.split('\n').slice(1, 8).join('\n'));
  process.exit(1);
});
