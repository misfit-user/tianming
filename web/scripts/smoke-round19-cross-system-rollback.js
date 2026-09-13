#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(WEB, name), 'utf8');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.keys(value).forEach((key) => deepFreeze(value[key]));
  return value;
}

function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end <= start) throw new Error('missing source slice: ' + startMarker);
  return source.slice(start, end);
}

function extractFunction(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('missing function: ' + marker);
  let pos = source.indexOf('{', start);
  let depth = 0;
  for (; pos < source.length; pos += 1) {
    if (source[pos] === '{') depth += 1;
    else if (source[pos] === '}' && --depth === 0) return source.slice(start, pos + 1);
  }
  throw new Error('unterminated function: ' + marker);
}

function makeDocument() {
  const body = {
    children: [],
    appendChild(node) {
      node.parentNode = body;
      body.children.push(node);
      return node;
    }
  };
  const energyBar = { id: '_energyBar', innerHTML: 'energy-100' };
  return {
    body,
    documentElement: { dataset: {} },
    addEventListener() {},
    getElementById(id) {
      if (id === '_energyBar') return energyBar;
      return body.children.find((node) => node.id === id) || null;
    },
    createElement(tag) {
      return {
        tagName: String(tag).toUpperCase(),
        id: '',
        className: '',
        innerHTML: '',
        parentNode: null,
        remove() {
          if (!this.parentNode) return;
          const index = this.parentNode.children.indexOf(this);
          if (index >= 0) this.parentNode.children.splice(index, 1);
          this.parentNode = null;
        },
        querySelector() { return null; },
        setAttribute() {}
      };
    }
  };
}

function leaf(id, mouths) {
  return {
    id: id + '-county',
    name: id + '县',
    populationDetail: {
      mouths,
      households: Math.round(mouths / 5),
      ding: Math.round(mouths * 0.3),
      byAge: { child: Math.round(mouths * 0.2), adult: mouths - Math.round(mouths * 0.2) },
      byGender: { male: Math.floor(mouths / 2), female: mouths - Math.floor(mouths / 2) }
    }
  };
}

function worldA() {
  const county = leaf('江南', 1250000);
  return {
    running: true,
    busy: false,
    sid: 'world-a',
    turn: 10,
    _campaignId: 'campaign-a',
    _timelineId: 'timeline-a',
    _energy: 100,
    _energyMax: 100,
    keju: { _pendingProposal: { proposalId: 'before-keyi' } },
    guoku: { money: 1000000, grain: 1000000 },
    minxin: { trueIndex: 60 },
    regions: [{ id: 'jiangnan', name: '江南省', unrest: 30, disasterLevel: 0 }],
    adminHierarchy: {
      player: {
        factionId: 'fac-a',
        factionName: '甲',
        divisions: [{ id: 'jiangnan', name: '江南省', children: [county] }]
      }
    },
    population: {
      national: {
        mouths: county.populationDetail.mouths,
        households: county.populationDetail.households,
        ding: county.populationDetail.ding
      },
      byRegion: { [county.id]: county.populationDetail },
      dynamics: { yearlyLog: [] }
    },
    facs: [
      { id: 'fac-a', name: '甲', aiStrategy: { grudges: ['乙', '丙'], grudgeIds: ['fac-b', 'fac-c'] } },
      { id: 'fac-b', name: '乙', aiStrategy: { grudges: ['甲', '丙'], grudgeIds: ['fac-a', 'fac-c'] } },
      { id: 'fac-c', name: '丙', aiStrategy: { grudges: [], grudgeIds: [] } }
    ],
    activeWars: [{ id: 'war-ab', attacker: '甲', defender: '乙', truceMonths: 12 }],
    treaties: [],
    armies: [{ id: 'army-a', name: '禁军', morale: 60, training: 50, loyalty: 70 }],
    mapData: { regions: [{ id: 'map-a', name: '江南', owner: '甲', development: 40, troops: 10000 }] },
    chars: [
      { id: 'char-1', name: '主考甲', officialTitle: '礼部尚书', faction: '甲', loyalty: 70, intelligence: 80 },
      { id: 'char-2', name: '议臣乙', officialTitle: '都察院御史', faction: '甲', loyalty: 55, intelligence: 65 },
      { id: 'char-3', name: '议臣丙', officialTitle: '吏部侍郎', faction: '甲', loyalty: 60, intelligence: 72 }
    ]
  };
}

function projectA() {
  return deepFreeze({
    dynasty: '南宋',
    playerInfo: { factionId: 'fac-a', factionName: '甲' },
    time: { daysPerTurn: 30 },
    conf: {},
    keju: {},
    ai: { key: 'test-key', url: 'https://example.invalid/v1', model: 'stream-model', stream_sc1: true, temp: 0.3 },
    map: { regions: [{ id: 'template-map-a', development: 9, troops: 88 }] },
    military: { initialTroops: [{ id: 'template-army-a', morale: 9, training: 8, loyalty: 7 }] }
  });
}

function jsonResponse(content) {
  return {
    ok: true,
    status: 200,
    headers: { get() { return 'application/json'; } },
    async json() { return { choices: [{ message: { content } }] }; },
    async text() { return JSON.stringify({ choices: [{ message: { content } }] }); }
  };
}

async function main() {
  const scenarioRegistry = {
    'world-a': deepFreeze({
      id: 'world-a', dynasty: '南宋', name: '世界甲',
      map: { regions: [{ id: 'scenario-map-a', development: 11, troops: 99 }] },
      military: { initialTroops: [{ id: 'scenario-army-a', morale: 11, training: 12, loyalty: 13 }] }
    }),
    'world-b': deepFreeze({
      id: 'world-b', dynasty: '秦汉', name: '世界乙',
      map: { regions: [{ id: 'scenario-map-b', development: 21, troops: 199 }] },
      military: { initialTroops: [{ id: 'scenario-army-b', morale: 21, training: 22, loyalty: 23 }] }
    })
  };
  const scenarioBytes = JSON.stringify(scenarioRegistry);
  const document = makeDocument();
  const desktopWrites = [];
  const errors = [];
  const changes = [];
  const sentBodies = [];
  const registeredSteps = [];
  const math = Object.create(Math);
  math.random = () => 1;

  const context = {
    console,
    Date,
    Math: math,
    JSON,
    Promise,
    Number,
    String,
    Object,
    Array,
    Boolean,
    RegExp,
    Error,
    Set,
    Map,
    AbortController,
    TextDecoder,
    parseInt,
    parseFloat,
    isFinite,
    isNaN,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    crypto: { randomUUID: () => 'round19-combined-uuid' },
    document,
    GM: worldA(),
    P: projectA(),
    scriptData: {},
    TM: { Endturn: { AI: {} }, errors: { capture(error, label) { errors.push({ error, label }); }, captureSilent() {} } },
    SettlementPipeline: { register(...args) { registeredSteps.push(args); } },
    findScenarioById(id) { return scenarioRegistry[id] || null; },
    getLiveMapData() { return context.GM.mapData; },
    random() { return 0.1; },
    _dbg() {},
    recordChange(...args) { changes.push(args); },
    turnsForMonths(months) { return Number(months); },
    uid() { return 'uid-' + (registeredSteps.length + changes.length + 1); },
    addEB() {},
    toast() {},
    confirm() { return true; },
    escHtml(value) { return String(value); },
    clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
    _adjAuthority(key, delta) {
      if (key === 'minxin') context.GM.minxin.trueIndex += delta;
      return { ok: true };
    },
    IntegrationBridge: { getTopLevelDivisions(hierarchy) { return hierarchy.player.divisions; } },
    deepClone: clone,
    _tmStripAiKeyInPlace(value) { return value; },
    _tmStripAiKeyView(value) { return value; },
    _tmLiteSafeConf(value) { return value; },
    _prepareGMForSave(gm, p) { return { GM: gm, P: p }; },
    _tmHasNativeFs() { return true; },
    getTSText(turn) { return 'T' + turn; },
    buildIndices() {},
    renderGameState() {},
    closeTurnResult() {},
    _kjResolveTopic(type, data) {
      return { topicType: type, title: '议·组合回归', threshold: 0.5, callbackName: 'noop', sliceOwner: 'round19', topicData: data };
    },
    _spendEnergy(cost) {
      if (context.GM._energy < cost) return false;
      context.GM._energy -= cost;
      document.getElementById('_energyBar').innerHTML = 'energy-' + context.GM._energy;
      return true;
    },
    _captureEnergySnapshot() {
      return { energy: context.GM._energy, energyBarHtml: document.getElementById('_energyBar').innerHTML };
    },
    _restoreEnergySnapshot(snapshot) {
      context.GM._energy = snapshot.energy;
      document.getElementById('_energyBar').innerHTML = snapshot.energyBarHtml;
      return true;
    },
    getCompressionParams() { return { scale: 3 }; },
    getPromptBudget() { return { contextK: 8, budget: 6144, warn80: 4915, warn95: 5836 }; },
    _getAITier() { return { key: 'test-key', url: 'https://example.invalid/v1', model: 'stream-model', tier: 'primary' }; },
    _buildAIUrlForTier() { return 'https://example.invalid/v1'; },
    _buildAIUrl() { return 'https://example.invalid/v1'; },
    _detectAIProvider() { return 'openai'; },
    async fetch(_url, options) {
      sentBodies.push(JSON.parse(options.body));
      return jsonResponse('{"turn_summary":"ok"}');
    },
    tianming: {
      getAutoSaveSessionToken() { return 'session-a'; },
      async autoSave(payload) {
        desktopWrites.push(clone(payload));
        return { success: true };
      }
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
  };
  context.window = context;
  context.global = context;
  context.globalThis = context;
  context._tmLoadGen = 4;

  vm.createContext(context);
  [
    'tm-world-era.js',
    'tm-economy-engine-currency.js',
    'tm-economy-engine.js',
    'tm-huji-engine.js',
    'tm-ai-infra-retry.js', 'tm-ai-infra.js',
    'tm-endturn-ai-sc1-budget.js',
    'tm-keju-runtime-keyi.js',
    'tm-feudal-warfare.js',
    'tm-faction-diplomacy.js'
  ].forEach((name) => vm.runInContext(read(name), context, { filename: name }));

  const lifecycle = read('tm-save-lifecycle.js');
  const core = read('tm-endturn-core.js');
  const autosaveSlice = extractBetween(lifecycle, 'var _autoSaveInFlight=false;', 'if(_tmHasNativeFs()){');
  const transactionSlice = extractBetween(core, 'function _tmCaptureEndTurnObject(', 'async function _tmFinalizeEndTurnTransaction(');
  const finalizeFn = extractFunction(core, 'async function _tmFinalizeEndTurnTransaction(');
  vm.runInContext(autosaveSlice + '\n' + transactionSlice + '\n' + finalizeFn, context, {
    filename: 'round19-combined-transaction.js'
  });

  context.EnvCapacityEngine.init(context.P);
  const env = context.GM.environment.byRegion.jiangnan;
  env.arableArea = 1000000;
  env.soilFertility = 1;
  env.aquiferLevel = 2 / 3;
  env.riverFlow = 1;
  env.forestArea = 1000000;
  env.coalReserve = 0;
  Object.keys(env.ecoScars).forEach((key) => { env.ecoScars[key] = 0; });
  env.ecoScars.deforestation = 0.5;
  env.carryingMax = 1000000;
  env.physicalLoad = 1.25;
  env.effectiveLoadRelief = 0.1;
  env.currentLoad = 1.15;
  context.GM.environment.activePolicies = [{ id: 'migration_relief', regionId: 'jiangnan', startTurn: 7, duration: 3 }];

  const beforeGM = clone(context.GM);
  const beforeP = clone(context.P);
  const committed = context._buildSaveState({ format: 'idb', detach: true, gm: context.GM, p: context.P });
  assert.strictEqual(context._tmAdoptCommittedWorldSnapshot(committed, {
    turn: context.GM.turn,
    transactionId: 'round19-before',
    takeOwnership: true
  }), true);
  const txn = context._tmCaptureEndTurnTransaction();
  context._tmCapturePreEndTurnCommittedState(txn);
  context.GM.busy = true;
  context.GM._endTurnBusy = true;
  context.GM._endTurnCommitPending = true;

  const a = context.GM.facs[0];
  const b = context.GM.facs[1];
  const diplomacy = context.TM.FactionDiplomacy;
  assert.strictEqual(diplomacy.recordProposals(a, [{
    toFaction: b.name,
    toFactionId: b.id,
    type: 'peace',
    terms: '组合回归媾和'
  }], context.GM.turn).recorded, 1);
  const proposal = b._incomingProposals.find((item) => item.status === 'pending');
  assert(proposal);
  assert.strictEqual(diplomacy.applyResponses(b, [{ proposalId: proposal.id, decision: 'accept' }], context.GM.turn).resolved, 1);
  assert.strictEqual(context.GM.activeWars.length, 0, 'peace removes active war inside the transaction');
  assert.strictEqual(context.WarWeightSystem.hasTruce('甲', '乙'), true, 'peace creates world-owned truce');
  assert.deepStrictEqual(Array.from(a.aiStrategy.grudgeIds), ['fac-c']);

  context.updateMilitary(1);
  context.updateMap(1);
  assert.notStrictEqual(context.GM.armies[0].morale, beforeGM.armies[0].morale, 'runtime army changes in GM');
  assert.notStrictEqual(context.GM.mapData.regions[0].development, beforeGM.mapData.regions[0].development, 'runtime map changes in GM');
  context.EnvCapacityEngine.tick({ turn: context.GM.turn, monthRatio: 1, strict: true });
  assert.strictEqual(context.GM.environment.activePolicies.length, 0, 'expiry turn removes policy before effects');

  const body = {
    model: 'stream-model',
    messages: [
      { role: 'system', content: 'system truth '.repeat(220) },
      { role: 'user', content: '长期世界状态 '.repeat(1100) + '\nSC1_PRE_CONTEXT\n' + '持续法令 '.repeat(900) + '\nFINAL JSON RULE' }
    ],
    temperature: 0.3,
    max_tokens: 2048,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'sc1', strict: true, schema: { type: 'object', properties: { turn_summary: { type: 'string' } }, required: ['turn_summary'] } }
    }
  };
  const finalized = context.TM.Endturn.AI.subcalls.finalizeSc1RequestBody(body, { contextTokens: 8192, completionTokens: 2048 });
  await context.callAIBodyStream(finalized.body, { skipQueue: true, priority: 'critical' });
  assert.strictEqual(sentBodies.length, 1);
  assert.strictEqual(sentBodies[0].max_tokens, finalized.body.max_tokens);
  assert.deepStrictEqual(sentBodies[0].response_format, JSON.parse(JSON.stringify(finalized.body.response_format)));
  assert(finalized.diagnostics.finalTotalTokens <= finalized.diagnostics.contextTokens, 'SC1 physical request stays within final budget');

  const pendingBeforeKeyi = context.GM.keju._pendingProposal;
  context._keyiInferStance = function() { throw new Error('injected keyi init failure'); };
  assert.strictEqual(context.openKeyiSession({ topicType: 'scandal', topicData: { id: 'scandal-a' } }), false);
  assert.strictEqual(context.GM._energy, 100);
  assert.strictEqual(context.GM.keju._pendingProposal, pendingBeforeKeyi);
  assert.strictEqual(context.KEYI_STATE, null);
  assert.strictEqual(document.getElementById('keyi-modal'), null);
  assert(errors.some((entry) => entry.label === '打开科议失败'),
    'Keyi failure must be captured: ' + JSON.stringify(errors.map((entry) => entry.label)));

  const duringTransactionAutoSave = await context._tmRunDesktopAutoSaveTick({ force: true });
  assert.strictEqual(duringTransactionAutoSave.deferred, true, 'desktop autosave defers while the combined turn is active');
  assert.strictEqual(desktopWrites.length, 0, 'no half-settled world is written before rollback');

  context._endTurn_saveSnapshot = async function() { return false; };
  let saveFailed = false;
  try {
    await context._tmFinalizeEndTurnTransaction({ meta: { turnPresentation: {} } }, txn);
  } catch (error) {
    saveFailed = /最终存档失败/.test(error.message);
    assert.strictEqual(context._tmRollbackEndTurnTransaction(txn, error), true);
  }
  assert.strictEqual(saveFailed, true, 'canonical save failure reaches the real finalization boundary');
  const rollbackFlush = await context._tmFlushDeferredDesktopAutoSave('round19-rollback', { immediate: true });

  assert.deepStrictEqual(clone(context.GM.activeWars), beforeGM.activeWars, 'activeWars rolls back');
  assert.deepStrictEqual(context.GM._warTruces || null, beforeGM._warTruces || null, 'truce ledger rolls back');
  assert.deepStrictEqual(clone(context.GM.facs[0].aiStrategy), beforeGM.facs[0].aiStrategy, 'name and ID grudges roll back');
  assert.deepStrictEqual(clone(context.GM.environment.activePolicies), beforeGM.environment.activePolicies, 'environment policy rolls back');
  assert.strictEqual(context.GM.environment.byRegion.jiangnan.currentLoad, beforeGM.environment.byRegion.jiangnan.currentLoad, 'derived environment load rolls back');
  assert.strictEqual(context.GM._energy, beforeGM._energy, 'Keyi energy remains at the pre-turn value');
  assert.strictEqual(context.KEYI_STATE, null, 'Keyi process session remains clear');
  assert.deepStrictEqual(clone(context.GM.mapData), beforeGM.mapData, 'runtime map rolls back');
  assert.deepStrictEqual(clone(context.GM.armies), beforeGM.armies, 'runtime army rolls back');
  assert.deepStrictEqual(clone(context.P), beforeP, 'P remains byte-equivalent');
  assert.strictEqual(JSON.stringify(scenarioRegistry), scenarioBytes, 'scenario registry remains byte-equivalent');
  assert(desktopWrites.length >= 1, 'rollback flush writes a desktop autosave: ' + JSON.stringify(rollbackFlush));
  const desktop = desktopWrites[desktopWrites.length - 1].gameState;
  assert.deepStrictEqual(desktop.activeWars, beforeGM.activeWars, 'desktop autosave contains pre-turn war state');
  assert.deepStrictEqual(desktop._warTruces || null, beforeGM._warTruces || null, 'desktop autosave excludes rolled-back truce');
  assert.deepStrictEqual(desktop.environment.activePolicies, beforeGM.environment.activePolicies, 'desktop autosave contains pre-turn policy state');

  context.P = deepFreeze({
    dynasty: '秦汉',
    playerInfo: { factionId: 'fac-b-world', factionName: '新朝' },
    ai: { key: 'test-key' },
    conf: {},
    map: { regions: [{ id: 'template-map-b', development: 3, troops: 4 }] },
    military: { initialTroops: [{ id: 'template-army-b', morale: 31, training: 32, loyalty: 33 }] }
  });
  context.GM = {
    running: true,
    busy: false,
    sid: 'world-b',
    turn: 1,
    _campaignId: 'campaign-b',
    _timelineId: 'timeline-b',
    activeWars: [],
    facs: [],
    armies: [{ id: 'army-b', name: '新军', morale: 31, training: 32, loyalty: 33 }],
    mapData: { regions: [{ id: 'map-b', name: '关中', owner: '新朝', development: 3, troops: 4 }] },
    environment: { activePolicies: [], byRegion: {} },
    keju: {},
    _energy: 100
  };
  context.WarWeightSystem.reset(context.GM);
  assert.strictEqual(context.WarWeightSystem.hasTruce('甲', '乙'), false, 'World B does not inherit World A truce');
  assert.strictEqual(context.GM.environment.activePolicies.length, 0, 'World B does not inherit policies');
  assert.strictEqual(context.KEYI_STATE, null, 'World B does not inherit Keyi state');
  assert.strictEqual(context.GM.armies[0].morale, 31, 'World B does not inherit army changes');
  assert.strictEqual(context.GM.mapData.regions[0].development, 3, 'World B does not inherit map changes');
  assert.strictEqual(context.CurrencyUnit.unitOf('money'), '钱', 'World B resolves its own dynasty currency');
  assert.strictEqual(JSON.stringify(scenarioRegistry), scenarioBytes, 'both frozen scenario templates remain unchanged');

  console.log('[smoke-round19-cross-system-rollback] PASS assertions=45');
}

main().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
