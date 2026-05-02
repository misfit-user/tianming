#!/usr/bin/env node
// smoke-office-dynastification.js - phase 4 office dynastification regression gate.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function fakeEl() {
  return {
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    style: { cssText: '' },
    appendChild(c){ return c; },
    removeChild(c){ return c; },
    insertBefore(c){ return c; },
    setAttribute(){},
    getAttribute(){ return null; },
    addEventListener(){},
    removeEventListener(){},
    querySelector(){ return fakeEl(); },
    querySelectorAll(){ return []; },
    children: [],
    childNodes: [],
    firstChild: null,
    parentNode: null,
    innerHTML: '',
    textContent: '',
    value: '',
    dataset: {},
    remove(){}
  };
}

const context = {
  console,
  Date,
  JSON,
  Math,
  RegExp,
  Error,
  Array,
  Object,
  String,
  Number,
  Boolean,
  parseInt,
  parseFloat,
  isFinite,
  isNaN,
  setTimeout(){},
  clearTimeout(){},
  document: {
    getElementById: () => fakeEl(),
    querySelector: () => fakeEl(),
    querySelectorAll: () => [],
    addEventListener(){},
    createElement: () => fakeEl(),
    body: fakeEl(),
    head: fakeEl(),
    readyState: 'complete'
  },
  localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  navigator: { userAgent: 'node' },
  GM: { turn: 1, chars: [], officeTree: [] },
  P: {},
  scriptData: {},
  escHtml: v => String(v == null ? '' : v),
  toast(){},
  SettlementPipeline: { register(){} },
  EndTurnHooks: {
    registered: [],
    register(phase, fn, name) { this.registered.push({ phase, fn, name }); }
  }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

function load(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, context, { filename: file });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEq(actual, expected, msg) {
  assert(actual === expected, msg + ' expected=' + expected + ' actual=' + actual);
}

load('tm-engine-constants.js');
load('tm-office-runtime.js');
load('tm-feudal.js');

const EC = context.TM.EngineConstants;
const OD = context.OfficeDynastification;
assert(EC, 'EngineConstants missing');
assert(OD, 'OfficeDynastification missing');

let assertions = 0;
function check(cond, msg) { assert(cond, msg); assertions++; }
function checkEq(actual, expected, msg) { assertEq(actual, expected, msg); assertions++; }

const han = EC.getTemplate('han');
const tang = EC.getTemplate('tang');
const ming = EC.getTemplate('ming');
const qing = EC.getTemplate('qing');
check(han.officeSubtabs.central.some(x => x.key === 'sangong'), 'han subtabs should expose sangong');
check(tang.officeSubtabs.region.some(x => x.key === 'jiedushi'), 'tang subtabs should expose jiedushi');
check(ming.officeSubtabs.inner.some(x => x.key === 'eunuch'), 'ming subtabs should expose eunuch');
check(qing.officeSubtabs.inner.some(x => x.key === 'grand_council'), 'qing subtabs should expose grand_council');
check(Array.isArray(tang.officeClassifierPatterns) && tang.officeClassifierPatterns.some(x => x.group === 'jiedushi'), 'tang classifier patterns missing');
check(tang.officialRanks.indexOf('\u6b63\u56db\u54c1\u4e0a') >= 0, 'tang split ranks missing');

const owned = {
  engineConstants: {
    officeSubtabs: { central: [{ key:'custom', name:'Custom' }] },
    officeClassifierPatterns: [{ pattern:'^CustomDept$', court:'inner', group:'custom' }],
    officialRanks: ['Custom Rank'],
    concurrentTitleCatalog: [{ id:'custom_title', name:'Custom Title' }],
    inquiryBodyCatalog: { custom: { bodies: [] } },
    influenceGroupCatalog: { customGroup: { name:'Custom Group' } }
  }
};
EC.applyTemplate(owned, 'ming');
checkEq(owned.engineConstants.officeSubtabs.central.length, 1, 'owned officeSubtabs must not be merged into');
checkEq(owned.engineConstants.officeClassifierPatterns.length, 1, 'owned classifier patterns must not be merged into');
checkEq(owned.engineConstants.officialRanks.length, 1, 'owned officialRanks must not be merged into');
checkEq(owned.engineConstants.concurrentTitleCatalog.length, 1, 'owned concurrent titles must not be merged into');
checkEq(Object.keys(owned.engineConstants.inquiryBodyCatalog).length, 1, 'owned inquiry bodies must not be merged into');
checkEq(Object.keys(owned.engineConstants.influenceGroupCatalog).length, 1, 'owned influence groups must not be merged into');

context.GM.engineConstants = {
  officeSubtabs: { central: [{ key:'custom', name:'Custom Central' }], inner: [], region: [] },
  officeClassifierPatterns: [{ pattern:'^CustomDept$', court:'inner', group:'custom' }],
  officialRanks: ['\u4e07\u77f3', '\u4e2d\u4e8c\u5343\u77f3'],
  concurrentTitleCatalog: [{ id:'junji', name:'\u519b\u673a\u5927\u81e3', politicalWeight: 10 }]
};
const customTabs = context._officeGetSubtabs('central');
checkEq(customTabs[1].key, 'custom', 'runtime subtabs should read engineConstants');
const customClass = context._officeClassifyDept({ name:'CustomDept' });
checkEq(customClass.court, 'inner', 'runtime classifier should read engineConstants court');
checkEq(customClass.group, 'custom', 'runtime classifier should read engineConstants group');

context.GM.engineConstants = {};
const legacyClass = context._officeClassifyDept({ name:'\u90fd\u5bdf\u9662' });
checkEq(legacyClass.court, 'central', 'legacy classifier court fallback failed');
checkEq(legacyClass.group, 'taijian', 'legacy classifier group fallback failed');

context.GM.engineConstants = { officialRanks: ['\u4e07\u77f3', '\u4e2d\u4e8c\u5343\u77f3'] };
const ranks = context.getOfficialRanks();
check(ranks.rank_1 && ranks.rank_1.name === '\u4e07\u77f3', 'getOfficialRanks should normalize engine array');

const ranker = { name:'Ranker' };
context.GM.chars = [ranker];
context.GM._indices = { charByName: new Map([['Ranker', ranker]]) };
check(context.assignOfficialRank('Ranker', '\u592a\u5c09', '\u4e07\u77f3') === true, 'assignOfficialRank should accept rank display name');
checkEq(ranker.officialRankName, '\u4e07\u77f3', 'assignOfficialRank should write normalized official rank name');

context.GM = {
  turn: 9,
  engineConstants: { concurrentTitleCatalog: [{ id:'junji', name:'\u519b\u673a\u5927\u81e3', politicalWeight: 10 }] },
  chars: [
    { name:'A', party:'p1', prestige:80, loyalty:70, position:'Governor' },
    { name:'B', party:'p1', prestige:70, loyalty:60, officialTitle:'Minister' },
    { name:'C', party:'p1', prestige:20, loyalty:50 },
    { name:'D', party:'p2', prestige:95, loyalty:50 }
  ],
  partyState: { p1: { recentImpeachLose:1, lastImpeachGrade:'B' }, p2: { recentImpeachLose:0 } },
  officeTree: [
    { name:'RegionDept', positions:[{ name:'Governor', rank:'rank1', holder:'A', bindingHint:'region' }] },
    { name:'MinistryDept', positions:[{ name:'Minister', rank:'rank2', holder:'B', bindingHint:'ministry' }] },
    { name:'OtherDept', positions:[{ name:'Clerk', rank:'rank9', holder:'D' }] }
  ]
};
context.GM._indices = { charByName: new Map(context.GM.chars.map(ch => [ch.name, ch])) };
const dismissal = OD.applyDismissalPressure(context.GM);
checkEq(dismissal.applied, 1, 'dismissal should apply one losing party');
checkEq(dismissal.dismissed, 2, 'grade B dismissal should dismiss two office holders');
checkEq(context.GM.partyState.p1.recentImpeachLose, 0, 'dismissal should consume recentImpeachLose');
checkEq(context.GM.officeTree[0].positions[0].holder, '', 'regional holder should be cleared');
checkEq(context.GM.officeTree[1].positions[0].holder, '', 'ministry holder should be cleared');
check(context.GM.chars[0]._dismissed === true && context.GM.chars[1]._dismissed === true, 'dismissed chars should be marked');
check(context.GM.chars[0].loyalty < 70, 'region binding should reduce loyalty');
check(Array.isArray(context.GM._officeDeptShocks) && context.GM._officeDeptShocks.length === 1, 'ministry binding should create dept shock');
check(Array.isArray(context.GM._officeDismissalLog) && context.GM._officeDismissalLog.length === 2, 'dismissal log should record entries');

check(OD.assignConcurrentTitle('C', 'junji', context.GM) === true, 'assignConcurrentTitle should accept catalog id');
const titleRefs = context.GM.chars[2].officeRef.concurrentTitleRefs;
check(Array.isArray(titleRefs) && titleRefs[0].id === 'junji', 'concurrent title should write officeRef refs');
check(context.GM.chars[2]._concurrentWith === '\u519b\u673a\u5927\u81e3', 'concurrent title should update display helper');

check(context.EndTurnHooks.registered.some(h => h.name === 'office-dynastification-dismissal'), 'end-turn hook should be registered');

console.log('[smoke-office-dynastification] pass assertions=' + assertions);
