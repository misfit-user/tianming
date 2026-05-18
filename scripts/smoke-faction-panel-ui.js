#!/usr/bin/env node
// scripts/smoke-faction-panel-ui.js
// Guards the runtime faction panel shell and styling hooks.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'tm-three-systems-ui.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(src.includes('function openForcesRelationsPanel(selectedFacName)'), 'faction panel should accept selected faction name');
assert(src.includes('frp-shell'), 'faction panel shell missing');
assert(src.includes('frp-grid'), 'faction panel two-column grid missing');
assert(src.includes('frp-relation-board'), 'faction relation board missing');
assert(src.includes('global.viewFac = function(facName)'), 'viewFac should open selected faction panel');
assert(css.includes('.frp-shell'), 'faction panel CSS shell missing');
assert(css.includes('.frp-card'), 'faction card CSS missing');
assert(css.includes('.frp-relation-cell'), 'relation cell CSS missing');

let captured = null;
const ctx = {
  console,
  Math,
  Date,
  JSON,
  Object,
  Array,
  Number,
  String,
  Boolean,
  RegExp,
  isFinite,
  alert(msg) { throw new Error('unexpected alert: ' + msg); },
  prompt() { return null; },
  toast() {},
  openGenericModal(title, html) { captured = { title, html }; },
  GM: {
    turn: 3,
    facs: [
      { name:'明朝廷', leader:'朱由检', color:'#b89a53', strength:42, derivedStrength:{ value:42, label:'弱' }, derivedHealth:{ overall:42, militaryStability:31, labels:{ overall:'弱' } }, derivedEconomy:{ economyHealth:44, fiscalStress:56, annualTaxIncome:1000000, annualMilitaryCost:2200000 }, derivedCohesion:{ overall:55 }, lifePhase:'strained', isPlayer:true },
      { name:'后金', leader:'皇太极', color:'#7eb8a7', strength:90, derivedStrength:{ value:90, label:'健' }, derivedHealth:{ overall:90, militaryStability:88, labels:{ overall:'健' } }, derivedEconomy:{ economyHealth:86, fiscalStress:14, annualTaxIncome:600000, annualMilitaryCost:300000 }, derivedCohesion:{ overall:84 }, lifePhase:'consolidating' }
    ],
    _facIndex: {
      '明朝廷': { metrics:{ charCount:3, armyCount:1, totalSoldiers:120000, arrearsArmies:1, avgMutinyRisk:38, avgLoyalty:62, privatizedRatio:0.33 }, chars:[{ name:'袁崇焕', officialTitle:'蓟辽督师' }], armies:[{ name:'关宁军', soldiers:120000, garrison:'宁远', mutinyRisk:40 }] },
      '后金': { metrics:{ charCount:2, armyCount:1, totalSoldiers:80000, arrearsArmies:0, avgMutinyRisk:10, avgLoyalty:85, privatizedRatio:0 }, chars:[{ name:'皇太极', officialTitle:'汗' }], armies:[{ name:'两黄旗', soldiers:80000, garrison:'沈阳' }] }
    },
    factionRelations: [{ from:'明朝廷', to:'后金', type:'war', value:-90, desc:'辽东交兵' }],
    _factionMilitaryLog: [{ turn:2, faction:'后金', target:'明朝廷', action:'整兵辽阳', outcome:'边防紧张' }]
  },
  P: { playerInfo: { factionName:'明朝廷' } },
  TM: {}
};
ctx.GM.facs[1].npcMilitaryActions = [{ turn:3, action:'military_order', army:'BlueBanner', reason:'Frontier drill', effect:{ commanderFrom:'OldGeneral', commanderTo:'NewGeneral', trainingDelta:6, moraleDelta:4 } }];
ctx.GM.facs[1].npcDiplomacyActions = [{ turn:3, action:'diplomacy', to:'MingEnvoy', reason:'Probe peace terms', effect:{ relationFrom:-70, relationTo:-55 } }];
ctx.GM.facs[1].npcProvincePolicies = [{ turn:3, action:'province_policy', province:'Liaoyang', reason:'Move grain levy', effect:{ ownerFrom:'OldOwner', ownerTo:'NewOwner', revenueDelta:1200 } }];
ctx.GM.facs[1].npcFiscalActions = [{ turn:3, action:'fiscal_policy', resource:'money', amount:120000, reason:'War levy', effect:{ before:100000, after:220000 } }];
ctx.GM.facs[1].npcIntrigueActions = [{ turn:3, intrigue:'spread_rumor', targetFaction:'MingCourt', pressure:3, reason:'Covert rumor' }];
ctx.GM.facs[1].npcRebellionPolicies = [{ turn:3, policy:'incite', targetFaction:'MingBorder', support:2, reason:'Border rebels' }];
const longRationale = 'Debug rationale ' + 'rationale-detail '.repeat(24) + 'FULL_RATIONALE_SENTINEL';
const longLedgerDetail = { to:'MingCourt', reason:'Debug ledger row ' + 'ledger-detail '.repeat(22) + 'FULL_LEDGER_SENTINEL' };
const longQiju = 'Debug precision news ' + 'precision-news-detail '.repeat(18) + 'FULL_QIJU_SENTINEL';
ctx.GM.facs[1]._npcLlmActionLedger = [{ turn:3, type:'diplomacy', status:'applied', source:'native', detail:longLedgerDetail }];
ctx.GM.facs[1]._lastLlmRationale = { turn:3, text:longRationale };
ctx.GM.facs[1]._lastLlmApplySummary = { turn:3, attemptedActions:3, appliedActions:2, skippedActions:1, mergedActions:0 };
ctx.GM._sc16FactionDirectives = { turn:3, source:'sc16', byFaction:{} };
ctx.GM._sc16FactionDirectives.byFaction[ctx.GM.facs[1].name] = {
  turn:3,
  source:'sc16',
  hasDirectContent:true,
  directives:[{ strategic_intent:'Debug sc16 directive', must_follow:'Debug must follow' }],
  actions:[{ faction:ctx.GM.facs[1].name, target:'MingCourt', action:'Debug action' }],
  diplomacy:[{ from:ctx.GM.facs[1].name, to:'MingCourt', new_relation:'tense' }]
};
ctx.GM.qijuHistory = [{ turn:3, _source:'npc-bridge', _facName:ctx.GM.facs[1].name, content:longQiju }];
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.TM.FactionActionEngine = {
  scoreFactionCandidate() { return { score: 88, reasons: ['sc16-directive','hotspot'] }; },
  formatActionContractForPrompt() { return 'ACTION_CONTRACT\n- diplomacy: required=targetFaction,relationDelta'; }
};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename:'tm-three-systems-ui.js' });
ctx.openForcesRelationsPanel('后金');
assert(captured && captured.title === '势力天平', 'panel did not open expected modal');
assert(captured.html.includes('frp-shell') && captured.html.includes('后金') && captured.html.includes('关系棋盘'), 'rendered modal missing core content');

assert(captured.html.includes('BlueBanner') && captured.html.includes('Probe peace terms') && captured.html.includes('Liaoyang') && captured.html.includes('War levy')
  && captured.html.includes('Covert rumor') && captured.html.includes('Border rebels'),
  'faction detail panel should surface expanded NPC LLM action trajectories');

ctx._tsInspectNpcInternal(ctx.GM.facs[1].name);
assert(captured && captured.html.includes('BlueBanner') && captured.html.includes('Probe peace terms') && captured.html.includes('Liaoyang') && captured.html.includes('War levy')
  && captured.html.includes('Covert rumor') && captured.html.includes('Border rebels'),
  'NPC internal inspection panel should surface expanded NPC LLM action trajectories');
assert(typeof ctx._tsInspectFactionAiDebug === 'function', 'faction AI debug panel should be exported');
ctx._tsInspectFactionAiDebug(ctx.GM.facs[1].name);
assert(captured && captured.html.includes('势力 AI 调试') && captured.html.includes('Debug sc16 directive') && captured.html.includes('Debug ledger row') && captured.html.includes('Debug precision news'),
  'faction AI debug panel should surface sc16 directive, ledger and precision news');
assert(captured && captured.html.includes('FULL_RATIONALE_SENTINEL') && captured.html.includes('FULL_LEDGER_SENTINEL') && captured.html.includes('FULL_QIJU_SENTINEL'),
  'faction AI debug panel should keep full long LLM text available instead of clipping it away');
assert(captured && captured.html.includes('tm-ai-fulltext'),
  'faction AI debug panel should render long LLM text in expandable full-text blocks');

assert(captured && captured.html.includes('候选评分') && captured.html.includes('上次执行汇总') && captured.html.includes('ACTION_CONTRACT'),
  'faction AI debug panel should surface ranking, apply summary and action contract');

console.log('[smoke-faction-panel-ui] pass');
