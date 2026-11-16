#!/usr/bin/env node
// smoke-class-minxin-bridge.js - class satisfaction/unrest syncs into the minxin class/regional ledger.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

const sandbox = {
  console,
  Math, Date, JSON, RegExp, Error,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  window: {},
  scriptData: {},
  P: {}
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

load('tm-class-minxin-bridge.js');
load('tm-class-engine.js');
load('tm-social-political-signals.js');
load('tm-party-class-llm-calibrator.js');

const Bridge = sandbox.TM && sandbox.TM.ClassMinxinBridge;
const ClassEngine = sandbox.TM && sandbox.TM.ClassEngine;
const SPS = sandbox.TM && sandbox.TM.SocialPoliticalSignals;
const Calibrator = sandbox.TM && sandbox.TM.PartyClassLlmCalibrator;
assert(Bridge && typeof Bridge.syncByClass === 'function', 'TM.ClassMinxinBridge.syncByClass should exist');
assert(typeof Bridge.applyClassPressure === 'function', 'TM.ClassMinxinBridge.applyClassPressure should exist');
assert(typeof Bridge.formatForPrompt === 'function', 'TM.ClassMinxinBridge.formatForPrompt should exist');
assert(typeof Bridge.audit === 'function', 'TM.ClassMinxinBridge.audit should exist for stage-gate diagnostics');
assert(typeof Bridge.spawnCourtIssues === 'function', 'TM.ClassMinxinBridge.spawnCourtIssues should exist');
assert(typeof Bridge.spawnUprisingCandidates === 'function', 'TM.ClassMinxinBridge.spawnUprisingCandidates should exist');
assert(typeof Bridge.maintain === 'function', 'TM.ClassMinxinBridge.maintain should exist');
assert(ClassEngine && typeof ClassEngine.applyClassChange === 'function', 'TM.ClassEngine.applyClassChange should exist');
assert(SPS && typeof SPS.record === 'function', 'TM.SocialPoliticalSignals.record should exist');
assert(Calibrator && typeof Calibrator.applyResult === 'function', 'TM.PartyClassLlmCalibrator.applyResult should exist');

const root = {
  turn: 61,
  minxin: {
    trueIndex: 66,
    perceivedIndex: 72,
    byClass: {
      tenants: { index: 70, perceived: 74 }
    },
    sources: {}
  },
  adminHierarchy: {
    player: {
      divisions: [{
        name: 'Huai River Circuit',
        children: [
          { name: 'Canal North', minxin: 58, population: { mouths: 100000 }, children: [] },
          { name: 'Canal South', minxin: 62, population: { mouths: 100000 }, children: [] }
        ]
      }]
    }
  },
  classes: [{
    name: 'Canal Tenants',
    key: 'tenants',
    satisfaction: 38,
    influence: 61,
    demands: 'reduce emergency levy',
    regionalVariants: [{ region: 'Canal North', weight: 1 }],
    unrestLevels: { grievance: 30, petition: 36, strike: 70, revolt: 82 },
    _populationShare: 0.24
  }]
};
sandbox.GM = root;

const synced = Bridge.syncByClass(root, { turn: 61, source: 'smoke' });
assert(root.minxin.byClass.tenants.true === 38, 'byClass true should mirror class satisfaction');
assert(root.minxin.byClass.tenants.index === 38, 'legacy index should mirror true value for current UI');
assert(synced.divergences.length === 1, 'sync should report old minxin/class divergence');

const applied = Bridge.applyClassPressure(root, {
  turn: 61,
  sourceSystem: 'smoke',
  sourceId: 'sig-tenant-tax-1',
  className: 'Canal Tenants',
  satisfactionDelta: -10,
  regionWeights: [{ region: 'Canal North', weight: 1 }],
  linkedIssue: 'issue-levy',
  reason: 'heavy levy pressure'
});

assert(applied.appliedRegions.length === 1, 'regional class pressure should hit matching leaf');
assert(root.adminHierarchy.player.divisions[0].children[0].minxin < 58, 'local leaf minxin should fall');
assert(root.adminHierarchy.player.divisions[0].children[1].minxin === 62, 'unmatched leaf minxin should remain unchanged');
assert(root._classMinxinBridgeLedger.length === 1, 'bridge should record one ledger entry');

Bridge.applyClassPressure(root, {
  turn: 61,
  sourceSystem: 'smoke',
  sourceId: 'sig-tenant-tax-1',
  className: 'Canal Tenants',
  satisfactionDelta: -10,
  regionWeights: [{ region: 'Canal North', weight: 1 }],
  reason: 'duplicate'
});
assert(root._classMinxinBridgeLedger.length === 1, 'duplicate source should not double count');

const noRegionRoot = {
  turn: 61,
  minxin: { trueIndex: 66, perceivedIndex: 72, byClass: {}, sources: {} },
  adminHierarchy: root.adminHierarchy,
  classes: [{ name: 'Urban Artisans', key: 'artisan', satisfaction: 52, regionalVariants: [] }]
};
const beforeNoRegion = noRegionRoot.adminHierarchy.player.divisions[0].children[0].minxin;
const noRegion = Bridge.applyClassPressure(noRegionRoot, {
  turn: 61,
  sourceSystem: 'smoke',
  sourceId: 'sig-artisan-1',
  className: 'Urban Artisans',
  satisfactionDelta: -9,
  reason: 'no regional evidence'
});
assert(noRegion.appliedRegions.length === 0, 'class pressure without region evidence should not hit local leaves');
assert(noRegionRoot.adminHierarchy.player.divisions[0].children[0].minxin === beforeNoRegion, 'no-region pressure should leave local minxin unchanged');

const prompt = Bridge.formatForPrompt(root, { limit: 5 });
assert(/Class Minxin Bridge/.test(prompt), 'prompt section should exist');
assert(/Canal Tenants/.test(prompt) && /Canal North/.test(prompt), 'prompt should include class and region evidence');

const engineRoot = {
  turn: 62,
  minxin: { trueIndex: 64, perceivedIndex: 70, byClass: {}, sources: {} },
  population: { national: { mouths: 200000 }, byClass: {} },
  adminHierarchy: {
    player: {
      divisions: [{
        name: 'Engine Circuit',
        children: [
          { name: 'Engine North', minxin: 55, population: { mouths: 120000 }, children: [] },
          { name: 'Engine South', minxin: 66, population: { mouths: 80000 }, children: [] }
        ]
      }]
    }
  },
  classes: [{
    name: 'Engine Tenants',
    key: 'engine_tenants',
    satisfaction: 50,
    influence: 60,
    demands: 'reduce tenant levy',
    regionalVariants: [{ region: 'Engine North', weight: 1 }],
    unrestLevels: { grievance: 60, petition: 70, strike: 80, revolt: 90 },
    _populationShare: 0.2
  }]
};
sandbox.GM = engineRoot;
const engineBefore = engineRoot.adminHierarchy.player.divisions[0].children[0].minxin;
const change = ClassEngine.applyClassChange(engineRoot, engineRoot.classes[0], {
  name: 'Engine Tenants',
  satisfaction_delta: -8,
  influence_delta: 0,
  new_demands: 'reduce tenant levy',
  linkedIssue: 'issue-engine-levy',
  reason: 'tax and corvee pressure'
}, { turn: 62, source: 'smoke-class-engine' });
assert(change && change.ok, 'ClassEngine.applyClassChange should apply');
assert(engineRoot.minxin.byClass.engine_tenants && engineRoot.minxin.byClass.engine_tenants.true === engineRoot.classes[0].satisfaction, 'ClassEngine class change should sync minxin.byClass');
assert(engineRoot.adminHierarchy.player.divisions[0].children[0].minxin < engineBefore, 'ClassEngine class change should bridge regional pressure into local minxin');
assert(Array.isArray(engineRoot._classMinxinBridgeLedger) && engineRoot._classMinxinBridgeLedger.some(x => x && x.sourceSystem === 'smoke-class-engine'), 'ClassEngine class change should write bridge ledger');

const ledgerCount = engineRoot._classMinxinBridgeLedger.length;
ClassEngine.finalizeTurn(engineRoot, { class_changes: [{ name: 'Engine Tenants' }] }, { turn: 62, source: 'smoke-finalize' });
assert(engineRoot._classMinxinBridgeLedger.length === ledgerCount, 'ClassEngine finalize should sync byClass without duplicating pressure ledger');
assert(engineRoot.minxin.byClass.engine_tenants.lastSyncTurn === 62, 'ClassEngine finalize should keep byClass synced');

const signalRoot = {
  turn: 63,
  minxin: { trueIndex: 63, perceivedIndex: 68, byClass: {}, sources: {} },
  adminHierarchy: {
    player: {
      divisions: [{
        name: 'Signal Circuit',
        children: [
          { name: 'Signal North', minxin: 59, population: { mouths: 90000 }, children: [] },
          { name: 'Signal South', minxin: 65, population: { mouths: 110000 }, children: [] }
        ]
      }]
    }
  },
  classes: [{
    name: 'Signal Tenants',
    key: 'signal_tenants',
    tags: ['tenant', 'peasant', 'rural', 'tax'],
    satisfaction: 56,
    influence: 55,
    demands: 'stable rent',
    regionalVariants: [{ region: 'Signal North', weight: 1 }],
    unrestLevels: { grievance: 62, petition: 72, strike: 82, revolt: 92 },
    _populationShare: 0.18
  }]
};
sandbox.GM = signalRoot;
const signalBefore = signalRoot.adminHierarchy.player.divisions[0].children[0].minxin;
SPS.record(signalRoot, {
  sourceSystem: 'fiscal',
  kind: 'tax-pressure',
  turn: 63,
  tags: ['tax', 'tenant'],
  linkedIssue: 'issue-signal-tax',
  reason: 'tax pressure on signal tenants',
  affectedClasses: [{
    name: 'Signal Tenants',
    satisfactionDelta: -6,
    unrestDelta: { grievance: -4, petition: -3 },
    demand: 'reduce signal tax'
  }]
});
SPS.applyPending(signalRoot, { turn: 63, source: 'smoke-signal-bridge' });
assert(signalRoot.minxin.byClass.signal_tenants && signalRoot.minxin.byClass.signal_tenants.true === signalRoot.classes[0].satisfaction, 'SocialPoliticalSignals class impact should sync minxin.byClass');
assert(signalRoot.adminHierarchy.player.divisions[0].children[0].minxin < signalBefore, 'SocialPoliticalSignals class impact should bridge into regional minxin');
assert(signalRoot._classMinxinBridgeLedger.some(x => x && x.sourceSystem === 'fiscal'), 'SocialPoliticalSignals class impact should write bridge ledger with signal source');

const localScanRoot = {
  turn: 64,
  minxin: { trueIndex: 60, perceivedIndex: 65, byClass: {}, sources: {} },
  _socialPoliticalSignals: { items: [], seq: 0, stats: {} },
  adminHierarchy: {
    player: {
      divisions: [{
        name: 'Low Mood Circuit',
        children: [
          { name: 'Low Mood County', minxin: 24, population: { mouths: 100000 }, children: [] }
        ]
      }]
    }
  },
  classes: [{
    name: 'Low Mood Farmers',
    key: 'low_mood_farmers',
    tags: ['peasant', 'farmer', 'rural', 'local', 'revolt'],
    satisfaction: 48,
    regionalVariants: [{ region: 'Low Mood County', weight: 1 }],
    unrestLevels: { grievance: 55, petition: 65, strike: 78, revolt: 88 }
  }]
};
sandbox.GM = localScanRoot;
const scanned = SPS.scanRuntimePressures(localScanRoot, { turn: 64, source: 'smoke-local-minxin-scan' });
assert(scanned.kinds.indexOf('local-revolt-risk') >= 0, 'runtime pressure scan should read low adminHierarchy leaf minxin');
SPS.applyPending(localScanRoot, { turn: 64, source: 'smoke-local-minxin-apply' });
const localLedger = localScanRoot._classMinxinBridgeLedger || [];
assert(!localLedger.some(x => x && x.sourceSystem === 'local' && x.appliedRegions && x.appliedRegions.length), 'local-revolt-risk should not feed back into local minxin again');

const calibratorRoot = {
  turn: 65,
  minxin: { trueIndex: 55, perceivedIndex: 63, byClass: {}, sources: {} },
  adminHierarchy: {
    player: {
      divisions: [{
        name: 'Market Circuit',
        children: [
          { name: 'Market Ward', minxin: 48, population: { mouths: 90000 }, children: [] }
        ]
      }]
    }
  },
  classes: [{
    name: 'Market Guilds',
    key: 'market_guilds',
    satisfaction: 42,
    influence: 76,
    demands: 'ease guild levy',
    regionalVariants: [{ region: 'Market Ward', weight: 1 }],
    unrestLevels: { grievance: 62, petition: 70, strike: 82, revolt: 88 },
    _populationShare: 0.22
  }],
  parties: [{ name: 'Market Relief', influence: 54 }]
};
Calibrator.applyResult(calibratorRoot, {
  class_updates: [{
    className: 'Market Guilds',
    satisfactionDelta: -9,
    demands: ['ease guild levy and remit arrears'],
    unrestDelta: { grievance: 6, petition: 4 },
    linkedIssue: 'issue-guild-levy',
    reason: 'player reply made guild levy harsher'
  }]
}, { turn: 65, source: 'smoke-llm-calibration' });
assert(calibratorRoot.minxin.byClass.market_guilds.true === calibratorRoot.classes[0].satisfaction, 'LLM class update should sync class-minxin byClass');
assert(calibratorRoot._classMinxinBridgeLedger.some(x => x && x.sourceSystem === 'smoke-llm-calibration'), 'LLM class update should write class-minxin bridge ledger');
assert(calibratorRoot.adminHierarchy.player.divisions[0].children[0].minxin < 48, 'LLM class update should apply regional class pressure when class has regionalVariants');

const maintenance = Bridge.maintain(calibratorRoot, { turn: 65, source: 'smoke-maintain' });
assert(maintenance && maintenance.audit && maintenance.audit.ok, 'bridge maintain should run healthy audit');
assert(calibratorRoot._classMinxinBridgeAudit && calibratorRoot._classMinxinBridgeAudit.ok, 'bridge audit snapshot should be stored on root');
assert(calibratorRoot._pendingTinyiTopics.some(t => t && t.from === 'class-minxin-bridge' && t.sourceType === 'class_pressure' && t.sourceClass === 'Market Guilds'), 'class-minxin pressure should enter pending tinyi topics');
assert(calibratorRoot.minxin.uprisingCandidates.some(c => c && c.className === 'Market Guilds' && c.region === 'Market Ward'), 'class-minxin pressure should create uprising candidate instead of direct revolt');
assert(!calibratorRoot.minxin.revolts || !calibratorRoot.minxin.revolts.some(r => r && r.className === 'Market Guilds'), 'class-minxin bridge should not directly create minxin revolts');

const rightRailSource = fs.readFileSync(path.join(ROOT, 'phase8-formal-rightrail.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'phase8-formal-rightrail-social.js'), 'utf8');
const classHeadMatch = rightRailSource.match(/function rightSocialClassHead[\s\S]*?function rightSocialClassDetail/);
const classDetailMatch = rightRailSource.match(/function rightSocialClassDetail[\s\S]*?function renderRightClassPanel/);
assert(classDetailMatch && /rightClassMinxinBridgeRows/.test(classDetailMatch[0]) && /minxin\.byClass/.test(rightRailSource), 'right rail class detail should show class-minxin bridge rows');
assert(classHeadMatch && !/rightClassMinxinBridgeRows/.test(classHeadMatch[0]), 'right rail class cards should keep class-minxin bridge out of the main card');
// 紧凑行契约(2026-07-11·玩家反馈行14)：列表卡无条形图/逐卡提示·保点行进详情·全档只在 flyout
assert(classHeadMatch && !/rightArmyBar/.test(classHeadMatch[0]) && !/tmrp-detail-hint/.test(classHeadMatch[0]), 'class list card stays compact (no bars, no per-card hint)');
assert(classHeadMatch && /outline-select/.test(classHeadMatch[0]), 'compact class card keeps click-to-expand wiring');

console.log('[smoke-class-minxin-bridge] PASS class-minxin bridge');
