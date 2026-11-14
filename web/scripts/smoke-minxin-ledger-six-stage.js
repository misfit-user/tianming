#!/usr/bin/env node
// smoke-minxin-ledger-six-stage.js - unified minxin ledger, matrix, perception, uprising, integrations, UI hooks.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

function load(name, sandbox) {
  const file = path.join(ROOT, name);
  assert(fs.existsSync(file), name + ' should exist');
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: name });
}

const sandbox = {
  console,
  Math, Date, JSON, RegExp, Error,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  setTimeout: fn => { if (typeof fn === 'function') fn(); return 1; },
  clearTimeout() {},
  addEB() {}
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.TM = { errors: { capture() {}, captureSilent() {} } };
sandbox.IntegrationBridge = {
  getLeafDivisions(adminHierarchy) {
    const out = [];
    function walk(nodes) {
      (Array.isArray(nodes) ? nodes : []).forEach(node => {
        if (!node || typeof node !== 'object') return;
        const kids = node.children || node.divisions || node.subs || [];
        if (kids.length) walk(kids);
        else out.push(node);
      });
    }
    Object.keys(adminHierarchy || {}).forEach(k => walk((adminHierarchy[k] || {}).divisions || []));
    return out;
  },
  aggregateRegionsToVariables() {}
};
sandbox.GM = {
  turn: 33,
  classes: [
    { id: 'farmers', name: 'Farmers', satisfaction: 36, influence: 70, size: '70%', regionalVariants: [{ region: 'Canal Ward', satisfaction: 32 }] },
    { id: 'scholars', name: 'Scholars', satisfaction: 58, influence: 55, size: '8%' }
  ],
  corruption: { trueIndex: 72, perceivedIndex: 48 },
  minxin: { trueIndex: 50, perceivedIndex: 58, byRegion: {}, byClass: {}, sources: {}, uprisingCandidates: [] },
  adminHierarchy: {
    player: {
      divisions: [
        { id: 'canal', name: 'Canal Ward', minxin: 45, minxinLocal: 45, population: 10000, minxinDetails: { trueIndex: 45 } },
        { id: 'mountain', name: 'Mountain County', minxin: 22, minxinLocal: 22, population: 5000, minxinDetails: { trueIndex: 22 } }
      ]
    }
  },
  _pendingTinyiTopics: []
};

vm.createContext(sandbox);
load('tm-minxin-ledger.js', sandbox);

const ML = sandbox.TM.MinxinLedger;
assert(ML && typeof ML.recordAndApply === 'function', 'TM.MinxinLedger.recordAndApply should exist');
assert(typeof ML.rebuildMatrix === 'function', 'TM.MinxinLedger.rebuildMatrix should exist');
assert(typeof ML.updatePerception === 'function', 'TM.MinxinLedger.updatePerception should exist');
assert(typeof ML.advanceUprisingChain === 'function', 'TM.MinxinLedger.advanceUprisingChain should exist');
assert(typeof ML.diagnosticsText === 'function', 'TM.MinxinLedger.diagnosticsText should exist');

const result = ML.recordAndApply(sandbox.GM, {
  sourceSystem: 'fiscal',
  kind: 'taxation',
  targetRegions: ['Canal Ward'],
  targetClasses: ['Farmers'],
  deltaTrue: -4,
  intensity: 0.8,
  confidence: 0.9,
  reason: 'emergency levy hit Canal Ward Farmers',
  linkedIssue: 'issue-levy'
}, { turn: 33, source: 'smoke-six-stage' });

assert(result && result.applied, 'recordAndApply should apply signal');
assert(sandbox.GM._minxinLedger.items.length === 1, 'ledger should store one signal');
assert(sandbox.GM._minxinLedger.items[0].applied === true, 'ledger row should be marked applied');
const canal = sandbox.GM.adminHierarchy.player.divisions[0];
const mountain = sandbox.GM.adminHierarchy.player.divisions[1];
assert(canal.minxin === 41 && canal.minxinDetails.trueIndex === 41, 'regional true minxin should be written back to division');
assert(mountain.minxin === 22, 'unaffected region should not move');
assert(sandbox.GM.minxin.sources.taxation === -4, 'source accumulator should record taxation delta');

ML.maintain(sandbox.GM, { turn: 33, source: 'smoke-maintain' });
assert(sandbox.GM.minxin.matrix, 'matrix should exist');
assert(sandbox.GM.minxin.matrix.canal && sandbox.GM.minxin.matrix.canal.farmers, 'matrix should include explicit region/class pair');
assert(sandbox.GM.minxin.matrix.canal.scholars, 'matrix should infer missing class pair dynamically');
assert(sandbox.GM.minxin.byClass.farmers && sandbox.GM.minxin.byClass.farmers.true < 50, 'byClass aggregate should reflect farmer pressure');
assert(sandbox.GM.minxin.byRegion.canal && sandbox.GM.minxin.byRegion.canal.true === 41, 'byRegion should mirror true division value');
assert(sandbox.GM.minxin.perceivedIndex > sandbox.GM.minxin.trueIndex, 'corruption should bias perceived minxin above truth');
assert(sandbox.GM.minxin.visibilityTier !== 'accurate', 'visibility tier should show imperfect court view');
assert((sandbox.GM.minxin.uprisingChain || []).some(x => x.region === 'Mountain County' && x.level >= 1), 'low local minxin should create an uprising chain entry');

load('tm-class-minxin-bridge.js', sandbox);
assert(sandbox.TM.ClassMinxinBridge && typeof sandbox.TM.ClassMinxinBridge.applyClassPressure === 'function', 'class-minxin bridge should load');
sandbox.TM.ClassMinxinBridge.applyClassPressure(sandbox.GM, {
  turn: 33,
  sourceSystem: 'social-political-signal',
  sourceId: 'sig-class-pressure',
  className: 'Farmers',
  satisfactionDelta: -10,
  regionWeights: [{ region: 'Canal Ward', weight: 1 }],
  linkedIssue: 'issue-levy',
  reason: 'class pressure should feed minxin ledger'
});
assert(sandbox.GM._minxinLedger.items.some(x => x.kind === 'class-pressure' && /class pressure should feed/.test(x.reason)), 'class bridge should record into unified minxin ledger');
assert(sandbox.GM.minxin.matrix.canal.farmers.lastReason && /class pressure should feed/.test(sandbox.GM.minxin.matrix.canal.farmers.lastReason), 'matrix should retain latest class pressure reason');

const diag = ML.diagnosticsText(sandbox.GM, { limit: 8 });
assert(/Minxin Ledger Diagnostics/.test(diag), 'diagnostics should identify minxin ledger');
assert(/emergency levy hit Canal Ward Farmers/.test(diag), 'diagnostics should include ledger reason');
assert(/Mountain County/.test(diag) && /uprisingChain/.test(diag), 'diagnostics should include uprising chain');
assert(/issue-levy/.test(ML.formatForPrompt(sandbox.GM, { limit: 8 })), 'prompt formatter should include linked issue');

const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert(index.indexOf('tm-minxin-ledger.js') > 0, 'index should load tm-minxin-ledger.js');
assert(index.indexOf('tm-minxin-ledger.js') < index.indexOf('tm-class-minxin-bridge.js'), 'minxin ledger should load before class-minxin bridge');
assert(index.indexOf('tm-minxin-ledger.js') < index.indexOf('tm-authority-engines.js'), 'minxin ledger should load before authority engines');

const authSource = fs.readFileSync(path.join(ROOT, 'tm-authority-engines.js'), 'utf8');
assert(/TM\.MinxinLedger\.recordAndApply/.test(authSource), 'AuthorityEngines.adjustMinxin should route through MinxinLedger');

const railSource = fs.readFileSync(path.join(ROOT, 'phase8-formal-rightrail.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'phase8-formal-rightrail-social.js'), 'utf8');
assert(/Minxin Ledger/.test(railSource), 'right rail debug panel should expose Minxin Ledger');

const topbarSource = fs.readFileSync(path.join(ROOT, 'tm-topbar-vars.js'), 'utf8');
assert(/_renderMinxinLedgerCauses/.test(topbarSource), 'topbar minxin panel should render ledger causes');

// 精确认州：exact 行只扣编号/名字完全相同的那个州；按「包含」认会把名字里含「杞县」的州一起扣。
// 精确点名配不上（那州已不在治下）不转去扣全国。
const exactGM = {
  turn: 5,
  minxin: { trueIndex: 40, perceivedIndex: 40, byRegion: {}, byClass: {}, sources: {}, uprisingCandidates: [] },
  adminHierarchy: { player: { divisions: [
    { id: 'qi', name: '杞县', minxin: 40, population: 100 },
    { id: 'qibei', name: '杞县北', minxin: 40, population: 100 },
    { id: 'chenliu', name: '陈留县', minxin: 40, population: 100 }
  ] } }
};
const exactLeaves = exactGM.adminHierarchy.player.divisions;
ML.recordAndApply(exactGM, { sourceSystem: 'smoke', kind: 'exact-check', deltaTrue: -0.5, reason: 'exact by name',
  targetRegions: [{ region: '杞县', weight: 1, deltaTrue: -2, exact: true }] }, { turn: 5, source: 'smoke-exact' });
assert(exactLeaves[0].minxin === 38, 'exact row should hit the named county in full: ' + exactLeaves[0].minxin);
assert(exactLeaves[1].minxin === 40 && exactLeaves[2].minxin === 40, 'exact row must not hit a county whose name merely contains the target');
ML.recordAndApply(exactGM, { sourceSystem: 'smoke', kind: 'exact-check', deltaTrue: -0.5, reason: 'exact by id',
  targetRegions: [{ region: 'chenliu', weight: 1, deltaTrue: -1, exact: true }] }, { turn: 5, source: 'smoke-exact' });
assert(exactLeaves[2].minxin === 39 && exactLeaves[0].minxin === 38 && exactLeaves[1].minxin === 40, 'exact row should also match by id');
ML.recordAndApply(exactGM, { sourceSystem: 'smoke', kind: 'exact-check', deltaTrue: -0.5, reason: 'exact miss',
  targetRegions: [{ region: 'nowhere', weight: 1, deltaTrue: -2, exact: true }] }, { turn: 5, source: 'smoke-exact' });
assert(exactLeaves[0].minxin === 38 && exactLeaves[1].minxin === 40 && exactLeaves[2].minxin === 39, 'unmatched exact row must not fall back to a national hit');

// 民变不宁只扰本省：每股民变给所在省各州 −0.15×月数；认不出省的交给账本按原地名去配；不再按全国扣。
load('tm-authority-complete.js', sandbox);
assert(sandbox.AuthorityComplete && typeof sandbox.AuthorityComplete.tickMinxinSources === 'function', 'AuthorityComplete.tickMinxinSources should be exported');
const securityCalls = [];
sandbox.AuthorityEngines = { adjustMinxin(source, delta, reason, opts) { securityCalls.push({ source, delta, reason, opts }); } };
sandbox.IntegrationBridge.getTopLevelDivisions = (ah) => (ah && ah.player && ah.player.divisions) || [];
const shaanxiNode = { id: 'shaanxi', name: '陕西布政使司', children: [
  { id: 'xian', name: '西安府', minxin: 30, population: 1000 },
  { id: 'yanan', name: '延安府', minxin: 20, population: 500 }
] };
sandbox.TM.AIChange = { PathUtils: { findDivisionByNameFuzzy: (G, key) => (key === '陕西' ? shaanxiNode : null) } };
sandbox.GM = {
  turn: 6, chars: [],
  minxin: { trueIndex: 30, perceivedIndex: 30, byRegion: {}, byClass: {}, sources: {}, uprisingCandidates: [],
    revolts: [
      { id: 'r1', region: '延安府', status: 'ongoing' },
      { id: 'r2', region: '陕西', status: 'ongoing' },
      { id: 'r3', region: '某处', status: 'ongoing' },
      { id: 'r4', region: '西安府', status: 'suppressed' },
      { id: 'r5', region: 'unknown', status: 'ongoing' },
      { id: 'r6', region: '', status: 'ongoing' }
    ] },
  adminHierarchy: { player: { divisions: [
    shaanxiNode,
    { id: 'henan', name: '河南布政使司', children: [{ id: 'kaifeng', name: '开封府', minxin: 40, population: 2000 }] }
  ] } }
};
sandbox.AuthorityComplete.tickMinxinSources({ turn: 6 }, 1);
const xian = shaanxiNode.children[0], yanan = shaanxiNode.children[1];
const kaifeng = sandbox.GM.adminHierarchy.player.divisions[1].children[0];
assert(xian.minxin === 29.7 && yanan.minxin === 19.7, 'two revolts in Shaanxi should cost each Shaanxi prefecture 0.3: ' + xian.minxin + '/' + yanan.minxin);
assert(kaifeng.minxin === 40, 'a province without revolts must not move: ' + kaifeng.minxin);
const securitySignal = sandbox.GM._minxinLedger.items.find(x => x.kind === 'security');
assert(securitySignal && /陕西布政使司民变不宁（2股）/.test(securitySignal.reason), 'province security signal should name the province and count');
assert(securitySignal.deltaTrue === -0.13 && sandbox.GM.minxin.sources.security === -0.13, 'source accumulator should record the national equivalent (-0.3 x 1500/3500): ' + securitySignal.deltaTrue);
const legacySecurity = securityCalls.filter(c => c.source === 'security');
assert(legacySecurity.length === 1 && legacySecurity[0].delta === -0.15 && legacySecurity[0].opts && legacySecurity[0].opts.targetRegions[0].region === '某处',
  'only the unplaceable revolt should go through the old entry, carrying its own place name (placeless ones cost nothing): ' + JSON.stringify(legacySecurity));

// 民变须有地方：没指明地方的阶层候选升到三级也只留作酝酿的链，不生 unknown 民变；有地方的照旧生。
const placeGM = {
  turn: 9,
  minxin: { trueIndex: 50, perceivedIndex: 50, byRegion: {}, byClass: {}, sources: {}, revolts: [],
    uprisingCandidates: [
      { id: 'c-general', region: '', className: 'Farmers', level: 3, momentum: 80, cause: 'national levy' },
      { id: 'c-mountain', region: 'Mountain County', className: 'Farmers', level: 3, momentum: 80, cause: 'local levy' }
    ] },
  adminHierarchy: { player: { divisions: [{ id: 'mountain', name: 'Mountain County', minxin: 50, population: 100 }] } }
};
ML.advanceUprisingChain(placeGM, { turn: 9 });
const placeChains = placeGM.minxin.uprisingChain || [];
assert(placeChains.some(c => c.region === '' && c.className === 'Farmers' && c.level >= 3), 'placeless class pressure should still brew as a chain');
assert(placeChains.some(c => c.region === 'Mountain County' && c.level >= 3), 'placed class pressure brews as a chain too');
// 民变重做·民2a（11-14）：链只记民情酝酿，不再直接生民变——起事由 tm-revolt-cases.js 判、tm-revolt-rising.js 落成真人真数
const placeRevolts = (placeGM.minxin.revolts || []).filter(r => r && r.status === 'ongoing');
assert(placeRevolts.length === 0, 'chains no longer spawn revolts by themselves: ' + JSON.stringify(placeRevolts.map(r => r.region)));

// 同一阶层同一地方只认一条链：阶层桥每回合按回合号重出候选，旧写法每回合另立新链、各生一股民变。
// 旧候选（早于上一回合）不再推链，压力消了链就消退。
const stableGM = {
  turn: 12,
  minxin: { trueIndex: 50, perceivedIndex: 50, byRegion: {}, byClass: {}, sources: {}, revolts: [],
    uprisingCandidates: [
      { id: 'mxuc-11-farmers-mountaincounty', turn: 11, region: 'Mountain County', className: 'Farmers', level: 3, momentum: 80 },
      { id: 'mxuc-12-farmers-mountaincounty', turn: 12, region: 'Mountain County', className: 'Farmers', level: 3, momentum: 80 },
      { id: 'mxuc-3-farmers-rivercounty', turn: 3, region: 'River County', className: 'Farmers', level: 3, momentum: 80 }
    ] },
  adminHierarchy: { player: { divisions: [
    { id: 'mountain', name: 'Mountain County', minxin: 50, population: 100 },
    { id: 'river', name: 'River County', minxin: 50, population: 100 }
  ] } }
};
ML.advanceUprisingChain(stableGM, { turn: 12 });
const farmerChains = stableGM.minxin.uprisingChain.filter(c => c.className === 'Farmers');
assert(farmerChains.length === 1 && farmerChains[0].region === 'Mountain County', 'one chain per class and place; a stale candidate must not open one: ' + JSON.stringify(farmerChains.map(c => c.id)));
const ongoingOf = (G) => (G.minxin.revolts || []).filter(r => r && r.status === 'ongoing');
assert(ongoingOf(stableGM).length === 0, 'chains raise no revolt (民2a): ' + ongoingOf(stableGM).length);
stableGM.turn = 13;
stableGM.minxin.uprisingCandidates.push({ id: 'mxuc-13-farmers-mountaincounty', turn: 13, region: 'Mountain County', className: 'Farmers', level: 3, momentum: 80 });
ML.advanceUprisingChain(stableGM, { turn: 13 });
assert(ongoingOf(stableGM).length === 0 && stableGM.minxin.uprisingChain.filter(c => c.className === 'Farmers').length === 1, 'a fresh candidate next turn refreshes the same chain, still no revolt: ' + ongoingOf(stableGM).length);

// 进行中的民变不被挤出列表：只清已结束的（留最近 30 条）。旧写法 slice(-30) 会把最早起事、仍在进行的几股挤掉，
// 实体层随后按覆灭清掉它们的势力和军队。
assert(typeof sandbox.AuthorityComplete.tickRevoltUpgrade === 'function', 'AuthorityComplete.tickRevoltUpgrade should be exported');
const listRevolts = [];
for (let i = 1; i <= 5; i++) listRevolts.push({ id: 'o' + i, region: 'Mountain County', status: 'ongoing', level: 3, scale: 30000, turn: 50 });
for (let i = 1; i <= 31; i++) listRevolts.push({ id: 'e' + i, region: 'Mountain County', status: 'suppressed', level: 3, scale: 30000, turn: 40 });
sandbox.GM = { turn: 50, minxin: { trueIndex: 10, perceivedIndex: 10, byRegion: {}, byClass: {}, sources: {}, uprisingCandidates: [], revolts: listRevolts },
  adminHierarchy: { player: { divisions: [{ id: 'mountain', name: 'Mountain County', minxin: 10, population: 100 }] } } };
sandbox.AuthorityComplete.tickRevoltUpgrade({ turn: 50 }, 1);
const keptIds = sandbox.GM.minxin.revolts.map(r => r.id);
assert(['o1', 'o2', 'o3', 'o4', 'o5'].every(id => keptIds.indexOf(id) >= 0), 'every ongoing revolt must stay in the list: ' + keptIds.slice(0, 8).join(','));
assert(keptIds.indexOf('e1') < 0 && keptIds.length === 35, 'only finished revolts are trimmed to the latest 30: ' + keptIds.length);

// 民变链封顶八十条，但已生过民变的链（进行中，或剿平后还在冷却里）一条不挤，挤只挤酝酿中的。
// 旧写法 slice(-80) 按先后挤掉最早立的链；挤掉的链下回合原地重立、冷却记录丢了，剿平的民变次回合就复起。
const capGM = { turn: 18, minxin: { trueIndex: 50, perceivedIndex: 50, byClass: {}, sources: {}, revolts: [], uprisingCandidates: [],
  byRegion: { ash: { true: 20, regionName: 'Ash County' }, bell: { true: 20, regionName: 'Bell County' } } } };
ML.advanceUprisingChain(capGM, { turn: 18 });
assert(ongoingOf(capGM).length === 0, 'chains raise no revolt (民2a): ' + ongoingOf(capGM).length);
// 旧档里链生过的民变还在：灰县那股已剿平、链在复燃冷却里；钟县那股还在进行（挂在链号下）。这两条链封顶时照旧不挤。
const ashChain = capGM.minxin.uprisingChain.find(c => c.region === 'Ash County'), bellChain = capGM.minxin.uprisingChain.find(c => c.region === 'Bell County');
ashChain._lastSpawnTurn = 18;
capGM.minxin.revolts.push({ id: 'old-ash', region: 'Ash County', status: 'suppressed', level: 3, scale: 30000, turn: 18, sourceChainId: ashChain.id });
capGM.minxin.revolts.push({ id: 'old-bell', region: 'Bell County', status: 'ongoing', level: 3, scale: 30000, turn: 18, sourceChainId: bellChain.id });
for (let i = 1; i <= 90; i++) capGM.minxin.byRegion['c' + i] = { true: 30, regionName: 'County ' + i }; // 另有九十州民心偏低、尚未起事
capGM.turn = 20;
ML.advanceUprisingChain(capGM, { turn: 20 });
const capChains = capGM.minxin.uprisingChain;
assert(capChains.length === 80, 'the chain list should still be capped at 80: ' + capChains.length);
assert(capChains.some(c => c.region === 'Ash County') && capChains.some(c => c.region === 'Bell County'),
  'chains that already raised a revolt (ongoing, or suppressed and cooling down) must not be trimmed: ' + capChains.slice(0, 3).map(c => c.region).join(','));
capGM.turn = 21;
ML.advanceUprisingChain(capGM, { turn: 21 });
const ashAgain = ongoingOf(capGM).filter(r => r.region === 'Ash County').length;
assert(ashAgain === 0, 'a suppressed revolt must not rise again inside its cooldown just because the chain list is full: ' + ashAgain);
assert(ongoingOf(capGM).filter(r => r.region === 'Bell County').length === 1, 'the ongoing revolt in Bell County stays single');

// 地名落成州名：阶层候选的地方是区划编号时，链和民变都记州名，事件里不露编号；
// 旧档里同一处、同一阶层已有一股（挂在旧链号下、地方记的是编号），过继过来，不另起一股。
const placeIdGM = {
  turn: 30,
  minxin: { trueIndex: 50, perceivedIndex: 50, byRegion: {}, byClass: {}, sources: {},
    revolts: [{ id: 'revolt-old', region: 'river', className: 'Weavers', level: 3, scale: 30000, status: 'ongoing', turn: 20, sourceChainId: 'mxchain-mxuc-20-weavers-river' }],
    uprisingCandidates: [
      { id: 'mxuc-30-farmers-mountain', turn: 30, region: 'mountain', className: 'Farmers', level: 3, momentum: 80 },
      { id: 'mxuc-30-weavers-river', turn: 30, region: 'river', className: 'Weavers', level: 3, momentum: 80 }
    ] },
  adminHierarchy: { player: { divisions: [
    { id: 'mountain', name: 'Mountain County', minxin: 50, population: 100 },
    { id: 'river', name: 'River County', minxin: 50, population: 100 }
  ] } }
};
ML.advanceUprisingChain(placeIdGM, { turn: 30 });
const farmerChain = placeIdGM.minxin.uprisingChain.find(c => c.className === 'Farmers');
assert(farmerChain && farmerChain.region === 'Mountain County', 'a candidate placed by division id should chain under the county name: ' + (farmerChain && farmerChain.region));
const placeIdRevolts = ongoingOf(placeIdGM);
assert(placeIdRevolts.length === 1 && placeIdRevolts[0].id === 'revolt-old',
  'no new revolt from chains (民2a); the old one in the save stays for the 民2d conversion: ' + JSON.stringify(placeIdRevolts.map(r => r.id + '@' + r.region)));

// 民变重做前止血（同志 11-08 定）：起事最高到暴动；五级梯冻住——不按民心掷骰往上爬、不扣皇权皇威、不兵临京师；
// 「同起升一级」也停。天启实测：第一回合陕西就有起义、改朝，第八回合起爬到改朝剑指京师。
const startGM = { turn: 40, minxin: { trueIndex: 50, perceivedIndex: 50, byClass: {}, sources: {}, revolts: [], uprisingCandidates: [],
  byRegion: { zeta: { true: 5, regionName: 'Zeta County' } } } };
ML.advanceUprisingChain(startGM, { turn: 40 });
const zetaChain = startGM.minxin.uprisingChain.find(c => c.region === 'Zeta County');
assert(zetaChain && zetaChain.level === 5 && ongoingOf(startGM).length === 0, 'local minxin 5 makes a level-5 chain but no revolt (民2a; 起事归 tm-revolt-cases.js): ' + JSON.stringify(zetaChain && zetaChain.level));

const ladderCalls = [];
sandbox.AuthorityEngines.adjustHuangquan = (src, d) => ladderCalls.push('huangquan ' + d);
sandbox.AuthorityEngines.adjustHuangwei = (src, d) => ladderCalls.push('huangwei ' + d);
const realRandom = Math.random;
Math.random = () => 0; // 掷骰必中：旧写法这里一定往上爬
try {
  const climber = { id: 'climb', region: 'Mountain County', status: 'ongoing', level: 4, scale: 200000, turn: 1 };
  const fresh = { id: 'fresh', region: 'Mountain County', status: 'ongoing', turn: 60 };
  sandbox.GM = { turn: 60, minxin: { trueIndex: 0, perceivedIndex: 0, byRegion: {}, byClass: {}, sources: {}, uprisingCandidates: [], revolts: [climber, fresh] },
    adminHierarchy: { player: { divisions: [{ id: 'mountain', name: 'Mountain County', minxin: 0, population: 100 }] } } };
  sandbox.AuthorityComplete.tickRevoltUpgrade({ turn: 60 }, 1);
  assert(climber.level === 4 && !climber._breachMarch && ladderCalls.length === 0,
    'frozen ladder: no climb, no huangquan/huangwei hit, no march on the capital: ' + JSON.stringify({ level: climber.level, march: climber._breachMarch, calls: ladderCalls }));
  assert(fresh.level === 3 && fresh.scale === 30000, 'a revolt without a level should start no higher than a riot even at local minxin 0: ' + JSON.stringify({ level: fresh.level, scale: fresh.scale }));
  assert(sandbox.AuthorityComplete.REVOLT_LADDER_FROZEN === true, 'the freeze is exported for the other ladder path');

  load('tm-authority-deep.js', sandbox);
  const ra = { id: 'ra', region: 'Mountain County', status: 'ongoing', level: 3 };
  const rb = { id: 'rb', region: 'River County', status: 'ongoing', level: 3 };
  sandbox.GM = { turn: 61, minxin: { revolts: [ra, rb] } };
  sandbox.PhaseF4.applyMultiRebellionInspiration({ turn: 61 }, 1);
  assert(ra.level === 3 && rb.level === 3 && ra._multiInspiration > 1, 'multi-revolt inspiration should no longer bump levels while frozen: ' + ra.level + '/' + rb.level);
} finally {
  Math.random = realRandom;
}

// 「司法公正」不再按「操守低于 35 的官员人数」另扣一遍（11-08）：腐败引擎已按刑部腐败度扣「司法不公·民有冤抑」，
// 两处说的是同一件事（官吏贪墨所以冤狱多），天启各约 −1/月、合计约 −2/月全国扣。
const judicialCalls = [];
sandbox.AuthorityEngines.adjustMinxin = (source, delta, reason) => { judicialCalls.push({ source, delta, reason }); };
sandbox.GM = { turn: 70, minxin: { trueIndex: 50, perceivedIndex: 50, byRegion: {}, byClass: {}, sources: {}, uprisingCandidates: [], revolts: [] },
  chars: Array.from({ length: 10 }, (_, i) => ({ name: 'official' + i, alive: true, officialTitle: 'clerk', integrity: 20 })),
  adminHierarchy: { player: { divisions: [{ id: 'mountain', name: 'Mountain County', minxin: 50, population: 100 }] } } };
sandbox.AuthorityComplete.tickMinxinSources({ turn: 70 }, 1);
assert(!judicialCalls.some(c => c.source === 'judicialFairness'),
  'judicial fairness is left to the corruption engine; ten low-integrity officials must not cost minxin a second time: ' + JSON.stringify(judicialCalls.filter(c => c.source === 'judicialFairness')));

console.log('[smoke-minxin-ledger-six-stage] PASS unified minxin six-stage implementation');
