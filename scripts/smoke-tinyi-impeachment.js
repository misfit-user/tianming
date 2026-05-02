#!/usr/bin/env node
// scripts/smoke-tinyi-impeachment.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let ASSERTS = 0;

function assert(cond, msg) {
  ASSERTS++;
  if (!cond) throw new Error('[assert] ' + msg);
}

function assertEq(actual, expected, msg) {
  assert(actual === expected, msg + ' expected=' + expected + ' actual=' + actual);
}

function assertOneOf(actual, list, msg) {
  ASSERTS++;
  if (list.indexOf(actual) < 0) throw new Error('[assert] ' + msg + ' actual=' + actual + ' expectedOneOf=' + JSON.stringify(list));
}

function fakeEl() {
  return { classList:{add(){},remove(){},toggle(){},contains(){return false}}, style:{cssText:''}, appendChild(c){return c}, removeChild(c){return c}, insertBefore(c){return c}, setAttribute(){}, getAttribute(){return null}, addEventListener(){}, removeEventListener(){}, querySelector(){return fakeEl()}, querySelectorAll(){return[]}, children:[], childNodes:[], firstChild:null, parentNode:null, innerHTML:'', textContent:'', value:'', dataset:{} };
}

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Math, Date, JSON, RegExp, Error, Promise,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  document: { getElementById:()=>fakeEl(), querySelector:()=>fakeEl(), querySelectorAll:()=>[], addEventListener(){}, createElement:()=>fakeEl(), body:fakeEl(), head:fakeEl(), readyState:'complete' },
  window: {}, localStorage: {getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  navigator: {userAgent:'node'}, performance: {now:()=>Date.now()},
  fetch:()=>Promise.reject(new Error('no fetch')),
  alert:()=>{}, confirm:()=>true, prompt:()=>null,
  HTMLElement:function(){}, Event:function(){}, requestAnimationFrame:cb=>setTimeout(cb,16)
};
sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
sandbox.addEventListener = ()=>{}; sandbox.removeEventListener = ()=>{};
vm.createContext(sandbox);

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const re = /<script[^>]+src="([^"]+\.js)/g;
let m;
while ((m = re.exec(html))) {
  const fp = path.join(ROOT, m[1].split('?')[0]);
  if (!fs.existsSync(fp)) continue;
  try { vm.runInContext(fs.readFileSync(fp, 'utf8'), sandbox, { filename: m[1] }); } catch(e) {}
}
try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'scenarios/tianqi7-1627.js'), 'utf8'), sandbox); } catch(e) {}

setTimeout(() => {
  try {
    const GM = sandbox.GM = {
      running: true, turn: 12, busy: false,
      vars: {}, rels: {}, evtLog: [], officeChanges: [], qijuHistory: [],
      facs: [{ name: '朝廷', influence: 68 }],
      parties: [
        { name: '清议党', influence: 68, cohesion: 82, allies: ['直言社'], enemies: ['被劾党'] },
        { name: '直言社', influence: 41, cohesion: 76, allies: ['清议党'], enemies: [] },
        { name: '被劾党', influence: 74, cohesion: 36, allies: [], enemies: ['清议党'] }
      ],
      partyState: {
        '清议党': { name: '清议党', influence: 68, cohesion: 82, recentImpeachWin: 1, recentImpeachLose: 0 },
        '直言社': { name: '直言社', influence: 41, cohesion: 76, recentImpeachWin: 0, recentImpeachLose: 0 },
        '被劾党': { name: '被劾党', influence: 74, cohesion: 36, recentImpeachWin: 0, recentImpeachLose: 2 }
      },
      corruption: {
        perceivedIndex: 74,
        sources: {
          officeSelling: 80,
          nepotism: 72,
          lumpSumSpending: 58,
          emergencyLevy: 47,
          military: 55
        },
        subDepts: {
          judicial: { true: 69, perceived: 60, trend: 'rising' },
          central: { true: 44, perceived: 39, trend: 'stable' },
          provincial: { true: 51, perceived: 46, trend: 'rising' }
        }
      },
      chars: [
        { name: '言官甲', officialTitle: '都察院给事中', party: '清议党', prestige: 78, favor: 64, ambition: 51 },
        { name: '被劾乙', officialTitle: '都察院巡按', party: '被劾党', prestige: 88, favor: 73, ambition: 76, stress: 11 },
        { name: '直言丙', officialTitle: '御史', party: '直言社', prestige: 69, favor: 58, ambition: 49 },
        { name: '闲散丁', officialTitle: '', party: '清议党', prestige: 92, favor: 40, ambition: 30 }
      ],
      officeTree: [
        { name: '都察院', positions: [
          { name: '给事中', holder: '言官甲' },
          { name: '巡按', holder: '被劾乙' },
          { name: '御史', holder: '直言丙' }
        ] }
      ],
      _pendingTinyiTopics: [],
      _chronicleTracks: []
    };
    sandbox.findCharByName = name => (GM.chars || []).find(c => c && c.name === name) || null;
    sandbox.NpcMemorySystem = { remember(){} };
    sandbox.P = { scenario: { dynastyType: 'ming', startYear: 1628 } };
    sandbox.sc = { dynastyType: 'ming' };
    assertEq(sandbox.EngineConstants.read('tinyiFollowUpDelay', { engineConstants: {} }), undefined, 'missing tinyiFollowUpDelay should read undefined');
    sandbox.scriptData = { engineConstants: sandbox.EngineConstants.getTemplate('generic') };

    const catalog = sandbox.EngineConstants.read('inquiryBodyCatalog');
    assert(catalog && typeof catalog === 'object', 'inquiryBodyCatalog should exist');
    assert(Array.isArray(catalog.ming.bodies), 'ming inquiry catalog should expose bodies');
    assertEq(sandbox.EngineConstants.read('tinyiFollowUpDelay'), 6, 'generic template should seed tinyiFollowUpDelay');
    assert(sandbox.EngineConstants.read('tinyiPolicySanctionByGrade').S === 16, 'generic template should seed policy sanction table');
    const summaryGM = sandbox.GM;
    const summaryCY = sandbox.CY || (sandbox.CY = {});
    const savedGM = {
      running: summaryGM.running,
      turn: summaryGM.turn,
      busy: summaryGM.busy,
      huangwei: summaryGM.huangwei,
      huangquan: summaryGM.huangquan,
      vars: summaryGM.vars,
      rels: summaryGM.rels,
      evtLog: summaryGM.evtLog,
      officeChanges: summaryGM.officeChanges,
      qijuHistory: summaryGM.qijuHistory,
      recentChaoyi: summaryGM.recentChaoyi,
      _chronicleTracks: summaryGM._chronicleTracks,
      tinyi: summaryGM.tinyi
    };
    const savedCY = {
      _ty2: summaryCY._ty2,
      _ty3: summaryCY._ty3
    };
    Object.assign(summaryGM, {
      running: true, turn: 12, busy: false,
      huangwei: { index: 60 },
      huangquan: { index: 60 },
      vars: {},
      rels: {}, evtLog: [], officeChanges: [], qijuHistory: [],
      recentChaoyi: [],
      _chronicleTracks: [],
      tinyi: { followUpQueue: [] }
    });
    summaryCY._ty2 = {
      topic: 'policy-summary',
      decision: { mode: 'majority' },
      stances: { 'minister-a': { current: '\u652F\u6301' } },
      _allSpeeches: [{ name: 'minister-a', stance: 'support', line: 'ok' }],
      _playerInterjects: [{ round: 1, text: 'player note' }],
      attendees: ['minister-a']
    };
    summaryCY._ty3 = {
      topic: 'policy-summary',
      proposerParty: 'order-party',
      playerInterjects: [{ round: 1, text: 'player note' }],
      sealStatus: 'issued'
    };
    const summaryInfo = sandbox._ty3_settleArchonGrade({ mode: 'majority' }, {
      topic: 'policy-summary',
      proposerParty: 'order-party',
      opposingParties: ['reform-league'],
      decisionMode: 'majority'
    });
    assertEq(summaryInfo.grade, 'B', 'summary hook sandbox should settle to B');
    assert(summaryGM.recentChaoyi.length > 0, 'settleArchonGrade should auto-record recentChaoyi');
    assert(summaryGM.recentChaoyi[0].chaoyiTrackId, 'settleArchonGrade should attach a chaoyi track id');
    assert((summaryGM._chronicleTracks || []).some(t => t && t.sourceType === 'chaoyi_pending'), 'settleArchonGrade should auto-upsert chaoyi_pending track');
    Object.assign(summaryGM, savedGM);
    summaryCY._ty2 = savedCY._ty2;
    summaryCY._ty3 = savedCY._ty3;
    assert(catalog.ming.bodies.some(b => b.name === '都察院'), 'ming catalog should contain 都察院');

    const accuser = sandbox.findCharByName('言官甲');
    const accused = sandbox.findCharByName('被劾乙');
    const meta = sandbox._ty3_buildImpeachmentTopicMeta(accuser.name, accuser, accused, '弹劾·被劾乙名望素著·恐有结党之嫌');
    assert(meta, 'impeachment meta should be built');
    assertEq(meta.kind, 'impeachment', 'meta kind should be impeachment');
    assertEq(meta.topicType, 'impeachment', 'meta topicType should be impeachment');
    assertEq(meta.accused, '被劾乙', 'meta accused should be preserved');
    assertEq(meta.accuser, '言官甲', 'meta accuser should be preserved');
    assertEq(meta.partyState.name, '被劾党', 'partyState should come from GM.partyState');
    assertEq(meta.partyState.cohesion, 36, 'partyState cohesion should be read from GM.partyState');
    assert(meta.inquiryBody && meta.inquiryBody.name, 'meta should include inquiry body');
    assertEq(meta.inquiryBody.name, '都察院', 'ming inquiry body should prefer 都察院 for judicial target');
    assert(Array.isArray(meta.charges), 'charges should be an array');
    assert(meta.charges.length >= 3, 'charges should contain at least three items');
    meta.charges.forEach(ch => {
      assert(ch && typeof ch === 'object', 'each charge should be an object');
      assert(typeof ch.name === 'string' && ch.name.length > 0, 'charge name should exist');
      assert(typeof ch.severity === 'number' && ch.severity > 0, 'charge severity should be numeric');
      assert(typeof ch.evidenceSource === 'string' && ch.evidenceSource.length > 0, 'charge evidenceSource should exist');
    });
    assertOneOf(meta.verdictGrade, ['S', 'A', 'B', 'C', 'D'], 'verdictGrade should be S/A/B/C/D');
    assert(Array.isArray(meta.consequenceLadder), 'consequence ladder should be an array');
    assert(meta.consequenceLadder.length >= 2, 'consequence ladder should not be empty');
    assert(Array.isArray(meta.supportingParties), 'supporting parties should be an array');
    assert(meta.supportingParties.some(p => typeof p.cohesionDelta === 'number'), 'supporting parties should keep cohesionDelta compatibility');
    assert(meta.supportingParties.some(p => p.name === '清议党'), 'supporting parties should include the accuser party');
    assert(meta.supportingParties.some(p => p.name === '被劾党'), 'supporting parties should include the accused party entry');
    assert(sandbox._ty3_phase3_isPersonnelTopic(meta.topic, meta), 'impeachment should route through phase 3 personnel handling');
    const byParty = sandbox._ty3_phase3_buildCandidates(meta.topic, meta);
    const candidateNames = Object.values(byParty).flatMap(info => (info.candidates || []).map(c => c.name));
    assert(candidateNames.indexOf('被劾乙') < 0, 'phase 3 impeachment candidates should exclude the accused');
    assert(candidateNames.indexOf('闲散丁') < 0, 'phase 3 impeachment candidates should be limited to current office holders');
    assert(candidateNames.indexOf('言官甲') >= 0 || candidateNames.indexOf('直言丙') >= 0, 'phase 3 impeachment candidates should include eligible office holders');

    const mem = sandbox._ty3_buildAccusationMemorialStructured(accuser.name, accuser, accused, meta);
    assert(mem, 'structured memorial should be built');
    assertEq(mem.topicType, 'impeachment', 'memorial topicType should be impeachment');
    assertEq(mem.kind, 'impeachment', 'memorial kind should be impeachment');
    assertEq(mem.accused, '被劾乙', 'memorial accused should match');
    assertEq(mem.accuser, '言官甲', 'memorial accuser should match');
    assert(Array.isArray(mem.charges), 'memorial charges should be an array');
    assert(mem.charges.length === meta.charges.length, 'memorial should carry the same number of charges');
    assertOneOf(mem.verdictGrade, ['S', 'A', 'B', 'C', 'D'], 'memorial verdict grade should be valid');
    assert(Array.isArray(mem.consequenceLadder), 'memorial consequence ladder should be an array');
    assert(mem.content.indexOf('都察院') >= 0, 'memorial content should mention inquiry body');
    assert(mem.content.indexOf(mem.verdictGrade) >= 0, 'memorial content should mention verdict grade');
    assert(mem.content.indexOf(meta.charges[0].name) >= 0, 'memorial content should include a charge');
    assert(mem.partyState && mem.partyState.name === '被劾党', 'memorial should snapshot partyState');
    const beforeLose = GM.partyState['被劾党'].recentImpeachLose;
    const beforeCohesion = GM.partyState['被劾党'].cohesion;
    const beforeInfluence = GM.partyState['被劾党'].influence;
    const spawned = sandbox._ty3_phase12_onAccusationApproved(meta.topic, [accused.name], accuser.name, meta);
    assert(spawned, 'approved impeachment should spawn a named accused party');
    assertEq(spawned.verdictGrade, meta.verdictGrade, 'spawned party should preserve verdict grade');
    assert(Array.isArray(spawned.consequenceLadder), 'spawned party should preserve consequence ladder');
    assertEq(GM.partyState['被劾党'].recentImpeachLose, beforeLose + 1, 'approved impeachment should increment recentImpeachLose');
    assert(GM.partyState['被劾党'].cohesion < beforeCohesion, 'approved impeachment should reduce partyState cohesion');
    assert(GM.partyState['被劾党'].influence < beforeInfluence, 'approved impeachment should reduce partyState influence');

    sandbox.CY = sandbox.CY || {};
    const sourceParty = accuser.party;
    const blockerParty = meta.partyState.name;
    sandbox.CY._ty3 = { topic: 'policy-alpha', meta: {}, proposerParty: sourceParty };
    sandbox.CY._ty2 = { topic: 'policy-alpha', _publicMeta: { proposerParty: sourceParty } };
    GM.recentChaoyi = [{}];
    const draft = sandbox._ty3_recordTinyiDraft({ mode: 'majority' }, 'A', accuser.name, sourceParty, 'smoke');
    assert(draft && typeof draft === 'object', 'stage 5 should return a draftEdict object');
    assertEq(draft.grade, 'A', 'draftEdict should preserve grade');
    assertEq(draft.drafter, accuser.name, 'draftEdict should preserve drafter');
    assertEq(draft.drafterParty, sourceParty, 'draftEdict should preserve drafter party');
    assertEq(draft.draftTurn, GM.turn, 'draftEdict should preserve draft turn');
    assertEq(draft.dynasty, 'ming', 'ming draft should preserve dynasty nuance');
    assertEq(sandbox.CY._ty3.meta.draftEdict, draft, 'draftEdict should attach to topic meta');
    assertEq(sandbox.CY._ty3._draftedEdict, draft.body, 'draft text should be available to recentChaoyi');
    assertEq(GM.recentChaoyi[0].draftEdict, draft, 'draftEdict should patch latest recentChaoyi');

    const beforeSourceLosePolicy = GM.partyState[sourceParty].recentPolicyLose || 0;
    const beforeBlockerWinPolicy = GM.partyState[blockerParty].recentPolicyWin || 0;
    const blockedSeal = sandbox._ty3_phase6_resolveSeal(false, {
      decision: { mode: 'majority' },
      grade: 'A',
      opts: { proposerParty: sourceParty, opposingParties: [blockerParty] },
      topic: 'policy-alpha',
      draftEdict: draft,
      hostile: { partyName: blockerParty, officePos: 'seal-office', holdProb: 1 },
      roll: 0
    });
    assertEq(blockedSeal.sealStatus, 'blocked', 'stage 6 ming hostile path should block');
    assertEq(sandbox.CY._ty3.sealStatus, 'blocked', 'blocked sealStatus should attach to CY._ty3');
    assertEq(sandbox.CY._ty3.meta.sealStatus, 'blocked', 'blocked sealStatus should attach to topic meta');
    assert(GM.partyState[sourceParty].recentPolicyLose > beforeSourceLosePolicy, 'blocked seal should add recentPolicyLose to source party');
    assert(GM.partyState[blockerParty].recentPolicyWin > beforeBlockerWinPolicy, 'blocked seal should add recentPolicyWin to blocker party');
    assert((GM._ccHeldItems || []).some(x => x && x.blockedBy === blockerParty), 'blocked seal should enter held items');
    assert((GM._chronicle || []).some(x => x && x.sealStatus === 'blocked'), 'blocked seal should write chronicle');
    assert(sandbox._ty3_reissueTopic('policy-alpha'), 'blocked seal should be reissuable from held items');
    assertEq(sandbox.CY._ty3.isReissue, true, 'reissue should mark current topic as reissue');
    assertEq(sandbox.CY._ty3.reissuedCount, 1, 'first reissue should increment reissuedCount');
    GM._chronicleTracks = [];
    GM.tinyi = { followUpQueue: [] };

    sandbox.P = { scenario: { dynastyType: 'qing', startYear: 1723 } };
    sandbox.CY._ty3 = { topic: 'policy-qing-direct', meta: {}, proposerParty: sourceParty };
    sandbox.CY._ty2 = { topic: 'policy-qing-direct', _publicMeta: { proposerParty: sourceParty } };
    const qingDraft = sandbox._ty3_recordTinyiDraft({ mode: 'override' }, 'B', accuser.name, sourceParty, 'smoke-qing');
    const beforeQueue = ((GM.tinyi && GM.tinyi.followUpQueue) || []).length;
    const beforeSourceWinPolicy = GM.partyState[sourceParty].recentPolicyWin || 0;
    const beforeOppLosePolicy = GM.partyState[blockerParty].recentPolicyLose || 0;
    const issuedSeal = sandbox._ty3_phase6_resolveSeal(false, {
      decision: { mode: 'override' },
      grade: 'B',
      opts: { proposerParty: sourceParty, opposingParties: [blockerParty] },
      topic: 'policy-qing-direct',
      draftEdict: qingDraft,
      hostile: null
    });
    assertEq(issuedSeal.sealStatus, 'issued', 'stage 6 qing direct path should issue');
    assert(issuedSeal.body && issuedSeal.body === qingDraft.body, 'issued seal should preserve draft body');
    assertEq(sandbox.CY._ty3._sealedEdict, qingDraft.body, 'issued seal should expose sealed edict text');
    assert(GM.partyState[sourceParty].recentPolicyWin > beforeSourceWinPolicy, 'issued seal should add recentPolicyWin to source party');
    assert(GM.partyState[blockerParty].recentPolicyLose > beforeOppLosePolicy, 'issued seal should add recentPolicyLose to opposing party');
    assert(GM.tinyi && GM.tinyi.followUpQueue.length === beforeQueue + 1, 'issued seal should enqueue follow-up');
    const queued = GM.tinyi.followUpQueue[GM.tinyi.followUpQueue.length - 1];
    assertEq(queued.dueTurn, GM.turn + 6, 'follow-up due turn should use engineConstants delay');
    assert(issuedSeal.followUp && issuedSeal.followUp.topicId, 'issued seal should carry a persistent follow-up topicId');
    assertEq(queued.topicId, issuedSeal.followUp.topicId, 'follow-up queue topicId should stay stable');
    const queuedTrack = (GM._chronicleTracks || []).find(t => t && t.sourceType === 'chaoyi_pending');
    assert(queuedTrack, 'issued seal should seed a chaoyi_pending track');
    assertEq(queuedTrack.sourceId, queued.topicId, 'chaoyi track id should match follow-up topicId');
    assertEq(sandbox.CY._ty3.followUpTurn, queued.dueTurn, 'followUpTurn should attach to topic state');
    assert((GM._chronicle || []).some(x => x && x.sealStatus === 'issued'), 'issued seal should write chronicle');

    queued.dueTurn = GM.turn;
    const beforeFollowQueue = GM.tinyi.followUpQueue.length;
    const beforeFollowHistory = ((GM.partyState[sourceParty] || {}).policyFollowUpHistory || []).length;
    const followSummaries = sandbox._ty3_phase7_runFollowUpQueue();
    assert(followSummaries.length >= 1, 'stage 7 should review due follow-up');
    assertEq(followSummaries[0].topicId, queued.topicId, 'follow-up review should preserve the same topicId');
    assert(GM.tinyi.followUpQueue.length === beforeFollowQueue - 1, 'stage 7 should dequeue reviewed follow-up');
    assert(((GM.partyState[sourceParty] || {}).policyFollowUpHistory || []).length > beforeFollowHistory, 'stage 7 should write partyState follow-up history');
    assert((GM.corruption.history || []).some(x => x && x.type === 'tinyi_follow_up'), 'stage 7 should write corruption history');
    assert((GM._chronicle || []).some(x => x && x.topicId === queued.topicId), 'stage 7 should write follow-up chronicle');
    assert((GM._ty3_pendingReviewForPrompt || []).some(x => x && x.topicId === queued.topicId), 'stage 7 should queue prompt summary');
    const reviewedTrack = (GM._chronicleTracks || []).find(t => t && t.sourceType === 'chaoyi_pending');
    assert(reviewedTrack, 'stage 7 should keep the chaoyi track alive');
    assertEq(reviewedTrack.recentReviewOutcome, followSummaries[0].outcome, 'stage 7 should write review outcome back to chaoyi track');
    assertEq(reviewedTrack.recentReviewTurn, GM.turn, 'stage 7 should write review turn back to chaoyi track');
    assertEq(reviewedTrack.progress, 100, 'stage 7 should mark the chaoyi track as reviewed');

    GM.parties = [
      { name: 'split-party', influence: 54, cohesion: 15, status: 'active', members: 'split-a,split-b,split-c,split-d' },
      { name: 'secret-party', influence: 61, cohesion: 25, status: 'active', members: 'secret-leader' },
      { name: 'extra-party', influence: 36, cohesion: 55, status: 'active', members: 'extra-a,extra-b' }
    ];
    GM.chars = [
      { name: 'split-a', party: 'split-party', prestige: 44, favor: 41, ambition: 45, alive: true },
      { name: 'split-b', party: 'split-party', prestige: 42, favor: 43, ambition: 48, alive: true },
      { name: 'split-c', party: 'split-party', prestige: 40, favor: 39, ambition: 40, alive: true },
      { name: 'split-d', party: 'split-party', prestige: 38, favor: 37, ambition: 42, alive: true },
      { name: 'secret-leader', party: 'secret-party', prestige: 92, favor: 84, ambition: 78, alive: true },
      { name: 'censor-target', party: '', prestige: 90, favor: 58, ambition: 66, alive: true, officialTitle: '都察院左都御史' },
      { name: 'focal-lead', party: 'extra-party', prestige: 88, favor: 62, ambition: 73, alive: true, officialTitle: '御史' }
    ];
    GM._partyEvolutionState = {};
    sandbox._ty3_partyEvolutionTick();
    sandbox._ty3_partyEvolutionTick();
    sandbox._ty3_partyEvolutionTick();
    const splinterParty = GM.parties.find(p => p && p.splinterFrom === 'split-party' && p.status === '分化');
    assert(splinterParty, 'party evolution should spawn a split party after low cohesion streak');
    assertEq(splinterParty.leader, 'split-b', 'split party should inherit the strongest founder as leader');
    assert(GM.chars.filter(c => c && c.name.indexOf('split-') === 0).some(c => c.party === splinterParty.name), 'split founders should move into the new split party');
    const secretSociety = GM.parties.find(p => p && p.splinterFrom === 'secret-party' && p.status === '隐党');
    assert(secretSociety, 'party evolution should spawn a hidden society when a strong leader remains inside a weak party');
    assertEq(secretSociety.leader, 'secret-leader', 'hidden society should use the prestigious leader');
    assert(secretSociety.hidden === true && secretSociety.publicKnown === false, 'hidden society should stay concealed');

    GM._pendingTinyiTopics = [];
    GM._ccHeldItems = [];
    GM.partyStrife = 78;
    GM.minxin = { value: 22 };
    GM.fiscal = { deficitRatio: 0.42 };
    GM.tanglian = { silver: -3 };
    GM.currentIssues = { flood: '灾情告急', border: '边境急报' };
    GM.evtLog = ['边关告急', '灾异频仍'];
    GM.parties = [
      { name: 'split-party', influence: 54, cohesion: 15, status: 'active', focal_disputes: ['科举改制'] },
      { name: 'secret-party', influence: 61, cohesion: 25, status: 'active', focalDisputes: ['盐税分派'] },
      { name: 'collapse-party', influence: 49, cohesion: 8, status: 'active' },
      { name: 'extra-party', influence: 36, cohesion: 55, status: 'active' }
    ];
    GM.chars = [
      { name: 'censor-target', party: '', prestige: 90, favor: 58, ambition: 66, alive: true, officialTitle: '都察院左都御史' },
      { name: 'focal-lead', party: 'extra-party', prestige: 88, favor: 62, ambition: 73, alive: true, officialTitle: '御史' },
      { name: 'party-watcher', party: 'secret-party', prestige: 76, favor: 66, ambition: 52, alive: true }
    ];
    const spawnedTopics = sandbox._ty3_phase15_scanAndSpawnTopics();
    assert(spawnedTopics.some(t => /调停党争/.test(t)), 'topic spawn should cover party strife in Chinese');
    assert(spawnedTopics.some(t => /collapse-party/.test(t) || /分化/.test(t)), 'topic spawn should cover low-cohesion party collapse');
    assert(spawnedTopics.some(t => /清议/.test(t)), 'topic spawn should cover focal disputes');
    assert(spawnedTopics.some(t => /民心低迷/.test(t)), 'topic spawn should cover popular unrest');
    assert(spawnedTopics.some(t => /国帑亏空/.test(t)), 'topic spawn should cover fiscal deficit');
    assert(spawnedTopics.some(t => /弹劾/.test(t)), 'topic spawn should cover censor impeachment party');
    assert(spawnedTopics.some(t => /御案时政/.test(t)), 'topic spawn should cover current issues');
    assert(spawnedTopics.some(t => /边报入闻|灾异入闻/.test(t)), 'topic spawn should cover evtLog natural events');
    assert(!spawnedTopics.some(t => /Party strife|Popular sentiment|Treasury deficit/.test(t)), 'topic spawn should not leak English fallback text');
    assert(GM._pendingTinyiTopics.some(t => t && /弹劾/.test(t.topic || '')), 'pending topics should include the censor impeachment topic');

    GM._pendingTinyiTopics = [];
    GM._chronicleTracks = [
      { id: 'cc-track', sourceType: 'changchao', status: 'active', title: '河工整饬', startTurn: 1, expectedEndTurn: 11, progress: 90, currentStage: 'started' },
      { id: 'meta-track', sourceType: 'chaoyi_pending', status: 'active', title: '旧廷议', startTurn: 1, expectedEndTurn: 11, progress: 95, currentStage: '\u8BB0\u5F55' }
    ];
    GM.turn = 11;
    sandbox._ty3_tickChronicleTracks();
    const ccTrack = GM._chronicleTracks.find(t => t && t.id === 'cc-track');
    const metaTrack = GM._chronicleTracks.find(t => t && t.id === 'meta-track');
    assertEq(ccTrack.currentStage, '验收待复', 'changchao track should advance into Chinese verify stage');
    assert(ccTrack._verifyPrompted, 'changchao track should prompt a 95% verification topic');
    assert(GM._pendingTinyiTopics.some(t => t && t.trackId === 'cc-track' && /议复/.test(t.topic || '')), 'changchao track should spawn a verification topic');
    assert(!metaTrack._verifyPrompted, 'chaoyi_pending tracks should stay metadata-only and not spawn verification');
    assert(!GM._pendingTinyiTopics.some(t => t && t.trackId === 'meta-track'), 'metadata-only tracks should not spawn verification topics');

    const reviewMemories = [];
    sandbox.NpcMemorySystem = {
      remember(name, text, emo, wt, source) {
        reviewMemories.push({ name, text, emo, wt, source });
      }
    };
    GM._chronicle = [];
    GM._turnReport = [];
    GM.turn = 18;
    const reviewAssignee = { name: 'review-assignee', party: 'extra-party', prestige: 55, favor: 50, alive: true };
    GM.chars.push(reviewAssignee);
    const debateReview = sandbox._ty3_phase7_reviewOne({
      id: 'edict-debate',
      source: 'tinyi2',
      category: '廷议',
      content: '廷议条陈',
      title: '廷议条陈',
      assignee: 'review-assignee',
      proposerParty: 'extra-party',
      progressPercent: 90,
      turn: 14
    });
    const audienceReview = sandbox._ty3_phase7_reviewOne({
      id: 'edict-audience',
      source: 'yuqian2',
      category: '御前',
      content: '御前奏对',
      title: '御前奏对',
      assignee: 'review-assignee',
      proposerParty: 'extra-party',
      progressPercent: 55,
      turn: 15
    });
    const morningReview = sandbox._ty3_phase7_reviewOne({
      id: 'edict-morning',
      source: 'changchao',
      category: '常朝',
      content: '常朝所奏',
      title: '常朝所奏',
      assignee: 'review-assignee',
      proposerParty: 'extra-party',
      progressPercent: 20,
      turn: 16
    });
    const decreeReview = sandbox._ty3_phase7_reviewOne({
      id: 'edict-decree',
      source: 'changchao_decree',
      category: '亲诏',
      content: '亲诏处分',
      title: '亲诏处分',
      assignee: 'review-assignee',
      proposerParty: 'extra-party',
      feedback: 'backfire',
      turn: 17
    });
    assertEq(debateReview.venueType, '廷议', 'tinyi review should use Chinese venue type');
    assertEq(audienceReview.venueType, '御前', 'yuqian review should use Chinese venue type');
    assertEq(morningReview.venueType, '常朝', 'changchao review should use Chinese venue type');
    assertEq(decreeReview.venueType, '亲诏', 'decree review should use Chinese venue type');
    assertEq(debateReview.label, '充分落实', 'fulfilled outcome should use Chinese label');
    assertEq(audienceReview.label, '部分落实', 'partial outcome should use Chinese label');
    assertEq(morningReview.label, '未落实', 'unfulfilled outcome should use Chinese label');
    assertEq(decreeReview.label, '反效果', 'backfire outcome should use Chinese label');
    assertEq(debateReview.histLabel, '准奏果验', 'fulfilled history label should use Chinese text');
    assertEq(audienceReview.histLabel, '行而未尽', 'partial history label should use Chinese text');
    assertEq(morningReview.histLabel, '奉行不力', 'unfulfilled history label should use Chinese text');
    assertEq(decreeReview.histLabel, '适得其反', 'backfire history label should use Chinese text');
    assert((GM._chronicle || []).some(x => x && x.type === '廷议追责' && /准奏果验/.test(x.text || '')), 'chronicle should record Chinese review text');
    assert((GM._chronicle || []).some(x => x && x.type === '亲诏追责' && /适得其反/.test(x.text || '')), 'decree chronicle should use Chinese review type');
    assert(reviewMemories.some(m => m.emo === '喜' && m.source === '廷议'), 'fulfilled review should store happy memory');
    assert(reviewMemories.some(m => m.emo === '平' && m.source === '御前'), 'partial review should store neutral memory');
    assert(reviewMemories.some(m => m.emo === '忧' && m.source === '常朝'), 'unfulfilled review should store worried memory');
    assert(reviewMemories.some(m => m.emo === '恨' && m.source === '亲诏'), 'backfire review should store hostile memory');

    console.log('[smoke-tinyi-impeachment] pass assertions=' + ASSERTS);
    process.exit(0);
  } catch (e) {
    console.error('SIM ERROR:', e.message, '\n', e.stack);
    process.exit(1);
  }
}, 250);
