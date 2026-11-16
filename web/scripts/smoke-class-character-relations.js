#!/usr/bin/env node
// smoke-class-character-relations.js - dynamic class <-> character backing network.

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

load('tm-class-character-relations.js');
load('tm-party-class-llm-calibrator.js');

const CCR = sandbox.TM && sandbox.TM.ClassCharacterRelations;
const Cal = sandbox.TM && sandbox.TM.PartyClassLlmCalibrator;
assert(CCR && typeof CCR.run === 'function', 'ClassCharacterRelations.run should exist');
assert(typeof CCR.adjustRelation === 'function', 'ClassCharacterRelations.adjustRelation should exist');
assert(typeof CCR.snapshot === 'function', 'ClassCharacterRelations.snapshot should exist');
assert(Cal && typeof Cal.buildSnapshot === 'function', 'PartyClassLlmCalibrator.buildSnapshot should exist');

const root = {
  turn: 12,
  classes: [
    {
      name: '士绅',
      tags: ['gentry', 'keju', 'office'],
      satisfaction: 58,
      influence: 72,
      demands: '扩大科举取士，保护士林清议',
      representativeNpcs: ['钱谦益'],
      supportingParties: [{ party: '东林党', affinity: 0.8 }]
    },
    {
      name: '军户',
      tags: ['military', 'soldier', 'arrears'],
      satisfaction: 41,
      influence: 63,
      demands: '补发边饷，减轻军户徭役'
    },
    {
      name: '编户农民',
      tags: ['peasant', 'tax', 'corvee', 'land'],
      satisfaction: 36,
      influence: 66,
      demands: '减免加派，清查豪强隐田'
    }
  ],
  parties: [
    { name: '东林党', socialBase: [{ class: '士绅', affinity: 0.8 }], currentAgenda: '整饬科场' },
    { name: '边务党', socialBase: [{ class: '军户', affinity: 0.7 }], currentAgenda: '清理欠饷' }
  ],
  characters: [
    {
      id: 'char-qian',
      name: '钱谦益',
      officialTitle: '礼部侍郎',
      party: '东林党',
      familyTier: 'gentry',
      learning: '进士',
      stance: '清议',
      charisma: 78,
      loyalty: 66,
      ambition: 58
    },
    {
      id: 'char-yuan',
      name: '袁崇焕',
      officialTitle: '蓟辽督师',
      party: '边务党',
      occupation: '武将',
      military: 92,
      valor: 86,
      loyalty: 72,
      ambition: 64,
      stressSources: ['边饷拖欠']
    },
    {
      id: 'char-bi',
      name: '毕自严',
      officialTitle: '户部尚书',
      stance: '清丈减派',
      administration: 84,
      management: 88,
      loyalty: 80,
      ambition: 44
    }
  ],
  _socialPoliticalSignals: {
    items: [
      {
        id: 'sig-tax-bi',
        turn: 12,
        sourceSystem: 'edict',
        kind: 'land-survey',
        tags: ['tax', 'land', 'corvee'],
        affectedClasses: [{ name: '编户农民' }],
        characterName: '毕自严',
        reason: '户部尚书承办清丈与减派'
      }
    ]
  }
};

const result = CCR.run(root, { turn: 12, source: 'smoke-class-character-relations' });
assert(result && result.edges >= 3, 'run should produce multiple dynamic class-character edges');
assert(root.classCharacterRelations && root.classCharacterRelations.edges, 'relation ledger should be written');
assert(Array.isArray(root.classCharacterRelations.history), 'relation history should be written');

function edgeFor(className, characterName) {
  return Object.values(root.classCharacterRelations.edges).find(e => e.className === className && e.characterName === characterName);
}

const qian = edgeFor('士绅', '钱谦益');
assert(qian, 'representative/gentry/party evidence should link Qian to gentry');
assert(qian.characterId === 'char-qian', 'edge should keep character id');
assert(['spokesperson', 'symbol', 'broker', 'patron'].includes(qian.role), 'gentry edge should assign a political role');
assert(qian.affinity > 0.55 && qian.legitimacy > 0.55, 'gentry edge should have meaningful affinity and legitimacy');
assert(qian.evidence.some(x => /representative|科举|party|官职|士绅|gentry/i.test(String(x))), 'edge should keep explainable evidence');

const yuan = edgeFor('军户', '袁崇焕');
assert(yuan, 'military office/ability should dynamically link Yuan to soldier households without representativeNpcs');
assert(yuan.role === 'patron' || yuan.role === 'symbol' || yuan.role === 'spokesperson', 'military edge should infer a useful role');
assert(yuan.mobilization > 0.45, 'military edge should carry mobilization');

const bi = edgeFor('编户农民', '毕自严');
assert(bi, 'social-political signal should link executor character to affected class');
assert(bi.source.indexOf('signal') >= 0 || bi.evidence.some(x => /sig-tax-bi|清丈|减派/.test(String(x))), 'signal evidence should be preserved');
assert(bi.trust > 0.5, 'beneficial executor signal should raise trust');

const beforeCount = Object.keys(root.classCharacterRelations.edges).length;
const repeat = CCR.run(root, { turn: 12, source: 'smoke-repeat' });
assert(Object.keys(root.classCharacterRelations.edges).length === beforeCount, 'same-turn rerun should update, not duplicate edges');
assert(repeat.edges === beforeCount, 'repeat summary should report existing edge count');

CCR.adjustRelation(root, {
  className: '士绅',
  characterName: '钱谦益',
  role: 'spokesperson',
  affinityDelta: -0.2,
  grievanceDelta: 0.35,
  source: 'manual-smoke',
  evidence: '廷议失利后士林迁怒'
}, { turn: 13 });
const angryQian = edgeFor('士绅', '钱谦益');
assert(angryQian.grievance > qian.grievance, 'manual adjustment should update grievance');
assert(angryQian.evidence.some(x => /士林迁怒/.test(String(x))), 'manual adjustment evidence should be retained');

const activeSnap = CCR.snapshot(root, { limit: 10 });
assert(activeSnap && Array.isArray(activeSnap.edges), 'snapshot should expose edges');
assert(activeSnap.history.length <= 10, 'snapshot should honor limit');

const calSnap = Cal.buildSnapshot(root, { source: 'smoke-class-character-snapshot', phase: 'pre-submit' });
assert(calSnap.classCharacterRelations && Array.isArray(calSnap.classCharacterRelations.edges), 'LLM calibration snapshot should include class-character relation edges');
assert(calSnap.classCharacterRelations.edges.some(e => e.className === '士绅' && e.characterName === '钱谦益'), 'LLM snapshot should expose active class-character backing');
const messages = Cal.buildMessages(calSnap);
const promptText = messages.map(m => String(m.content || '')).join('\n');
assert(/class_character_relation_updates/.test(promptText), 'LLM prompt should ask for class-character relation updates');
assert(/spokesperson|patron|broker|suppressor|debtor/.test(promptText), 'LLM prompt should describe dynamic class-character roles');

const llmApplied = Cal.applyResult(root, {
  class_character_relation_updates: [
    {
      className: '士绅',
      characterName: '钱谦益',
      role: 'spokesperson',
      trustDelta: 0.18,
      legitimacyDelta: 0.12,
      source: 'llm',
      evidence: ['廷议中代士林发声']
    }
  ],
  notes: ['class-character edge calibrated']
}, { turn: 14, source: 'llm-class-character-smoke' });
assert(llmApplied.classCharacterRelations === 1, 'LLM class-character relation updates should be applied');
const llmQian = edgeFor('士绅', '钱谦益');
assert(llmQian.trust > angryQian.trust, 'LLM update should change character backing trust');
assert(llmQian.source.indexOf('llm') >= 0, 'LLM update source should be retained');

root.turn = 30;
const decayed = CCR.run(root, { turn: 30, source: 'smoke-decay', skipDiscovery: true });
assert(decayed.expired > 0, 'stale edges should expire when no fresh evidence remains');

console.log('[smoke-class-character-relations] PASS dynamic class-character relations');
