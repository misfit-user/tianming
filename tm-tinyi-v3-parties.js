// @ts-nocheck
'use strict';
/* ═══════════════════════════════════════════════════════════════════════
 *  tm-tinyi-v3-parties.js — 廷议 V3·新党派系统（2026-07-04 立项拆分·自 tm-tinyi-v3.js §12 保序切出）
 *  内容：党派分裂/私下结社/弹劾结党/消亡·历史修正版·+endturn hooks 安装器
 *  加载序：index.html 中紧挨 tm-tinyi-v3.js 之后——与拆分前执行顺序逐字节等价·勿改
 * ═══════════════════════════════════════════════════════════════════════ */
// ═══════════════════════════════════════════════════════════════════════
//  §12·新党派系统(分裂 / 私下结社 / 弹劾结党 / 消亡) — 波 3·历史修正版
// ═══════════════════════════════════════════════════════════════════════
// 史实约束：中国古代结党是罪名(结党营私)·非自愿身份·无人公开宣称。
// 党派之名常由敌人/史官追加·而非当事人自称。
// 接现有 GM.parties[] 动态层。新党诞生三种现实路径：
//   1·分裂        — 旧党 cohesion<20 持续 3 回合 → 拆为 2 个新党
//                   (后人/敌人将分裂者另立别名·status='分化')
//   2·私下结社    — 某官 prestige>80 + favor>70 + 当前党 cohesion<30
//                   → 私下结社·status='隐党'·非公开·无明确宣称
//   3·弹劾结党    — 玩家在廷议中准奏「X 等结党」之议
//                   → 该群被定性为新党·status='被劾'·成员名声受损
// 消亡：cohesion<10 + influence<5 + members<3 → 自然消亡

function _ty3_partySpawn(opts) {
  opts = opts || {};
  if (!opts.name) return null;
  if (!Array.isArray(GM.parties)) GM.parties = [];
  if (GM.parties.some(function(p) { return p && p.name === opts.name; })) {
    if (typeof toast === 'function') toast(opts.name + ' 已在党册');
    return null;
  }
  var founders = Array.isArray(opts.founders) ? opts.founders.slice() : [];
  var newParty = {
    name: opts.name,
    leader: opts.leaderName || founders[0] || '',
    faction: opts.faction || (GM.player && GM.player.faction) || '',
    crossFaction: false,
    influence: opts.initialInfluence || 8,
    cohesion: opts.initialCohesion || 75,
    satisfaction: 70,
    status: opts.status || 'active',
    memberCount: founders.length || 1,
    ideology: opts.ideology || '',
    members: founders.join(','),
    policyStance: opts.policyStances || [],
    enemies: [],
    allies: [],
    foundYear: GM.year || 0,
    foundTurn: GM.turn || 0,
    splinterFrom: opts.parentParty || null,
    history: 'Founded in ' + (GM.year || '?') + ': ' + (opts.reason || 'political realignment'),
    desc: opts.desc || ('New party: ' + (opts.reason || '')),
    currentAgenda: opts.agenda || '稳固党势'
  };
  ['impeachmentVerdictGrade','impeachmentConsequenceLadder','impeachmentTopic','impeachmentAccuser','impeachmentCharges','impeachmentBody'].forEach(function(k) {
    if (opts[k] !== undefined) newParty[k] = opts[k];
  });
  GM.parties.push(newParty);
  if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
  if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
    turn: GM.turn || 1,
    date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
    type: '党祸·新党生',
    text: '新党「' + newParty.name + '」结成' + (newParty.leader ? '，以' + newParty.leader + '为魁' : '') + '。' + (opts.reason || ''),
    tags: ['党派', '新党', newParty.name],
    partyName: newParty.name,
    parentParty: opts.parentParty || ''
  });
  if (typeof toast === 'function') toast('★ 新党派·' + newParty.name);
  founders.forEach(function(nm) {
    var ch = (typeof findCharByName === 'function') ? findCharByName(nm) : null;
    if (ch) {
      ch._previousParty = ch.party || '';
      ch.party = newParty.name;
    }
  });
  return newParty;
}

function _ty3_partyDispose(partyName, reason) {
  if (!Array.isArray(GM.parties)) return false;
  var idx = GM.parties.findIndex(function(p) { return p && p.name === partyName; });
  if (idx < 0) return false;
  var p = GM.parties[idx];
  p.status = '湮灭';
  p.disposedTurn = GM.turn;
  p.disposedReason = reason || '式微无继';
  (GM.chars || []).forEach(function(c) { if (c && c.party === partyName) c.party = ''; });
  if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
  if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
    turn: GM.turn || 1,
    date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
    type: '党祸·党亡',
    text: partyName + ' dissolved: ' + (reason || 'dissolved'),
    tags: ['党派', '党灭', partyName],
    partyName: partyName
  });
  return true;
}

function _ty3_phase12_onAccusationApproved(topic, accusedNames, accuser, topicMeta) {
  accusedNames = Array.isArray(accusedNames) ? accusedNames.filter(Boolean) : (accusedNames ? [accusedNames] : []);
  if (accusedNames.length === 0) return null;
  var verdictGrade = (topicMeta && topicMeta.verdictGrade) || 'B';
  var verdictLadder = (topicMeta && Array.isArray(topicMeta.consequenceLadder)) ? topicMeta.consequenceLadder.slice() : _ty3_impeachmentConsequenceLadder(verdictGrade);
  var sanctionByGrade = { S: 12, A: 10, B: 8, C: 6, D: 4 };
  var sanction = sanctionByGrade[verdictGrade] || sanctionByGrade.C;
  var sourceParty = '';
  for (var i = 0; i < accusedNames.length; i++) {
    var ch0 = (typeof findCharByName === 'function') ? findCharByName(accusedNames[i]) : null;
    if (ch0 && ch0.party) { sourceParty = ch0.party; break; }
  }
  if (sourceParty && GM.partyState && GM.partyState[sourceParty]) {
    var ps = GM.partyState[sourceParty];
    ps.recentImpeachLose = (ps.recentImpeachLose || 0) + 1;
    // 罢官压力档位断链修：officeApplyDismissalPressure 读这三个 grade 字段定罢黜档位·
    // 此前全项目无写者→恒退化 C 档·S/A 档重罚从不触发
    ps.lastImpeachGrade = verdictGrade;
    ps.recentImpeachGrade = verdictGrade;
    ps.lastVerdictGrade = verdictGrade;
    ps.cohesion = Math.max(0, (parseInt(ps.cohesion, 10) || 50) - Math.max(1, Math.round(sanction / 2)));
    ps.influence = Math.max(0, (parseInt(ps.influence, 10) || 30) - Math.max(1, Math.round(sanction / 3)));
    _ty3_bumpPartyReputation(ps, -sanction / 2);
  }
  var base = sourceParty ? (sourceParty + ' Trial Faction') : 'Impeached Faction';
  var newName = base;
  var idx = 1;
  if (!Array.isArray(GM.parties)) GM.parties = [];
  while (GM.parties.some(function(p) { return p && p.name === newName; })) { newName = base + ' ' + idx; idx++; }
  var leaderName = accusedNames[0];
  var p = _ty3_partySpawn({
    name: newName,
    leaderName: leaderName,
    founders: accusedNames,
    parentParty: sourceParty || null,
    initialInfluence: Math.max(6, 18 - Math.round(sanction / 2)),
    initialCohesion: Math.max(30, 72 - sanction),
    ideology: 'impeachment defense faction',
    reason: 'impeachment approved, grade ' + verdictGrade,
    agenda: 'defend accused officials',
    status: 'under_inquiry',
    impeachmentVerdictGrade: verdictGrade,
    impeachmentConsequenceLadder: verdictLadder,
    impeachmentTopic: topic,
    impeachmentAccuser: accuser || 'unknown',
    impeachmentCharges: topicMeta && Array.isArray(topicMeta.charges) ? topicMeta.charges.slice() : [],
    impeachmentBody: topicMeta && topicMeta.inquiryBody ? topicMeta.inquiryBody.name : ''
  });
  if (p) {
    p.status = '被劾';
    p.accusedBy = accuser || '言官';
    p.accusedTurn = GM.turn;
    p.verdictGrade = verdictGrade;
    p.consequenceLadder = verdictLadder;
    p.impeachmentTopicType = topicMeta && topicMeta.topicType ? topicMeta.topicType : 'impeachment';
    accusedNames.forEach(function(nm) {
      var ch = (typeof findCharByName === 'function') ? findCharByName(nm) : null;
      if (ch) {
        ch.prestige = Math.max(0, (ch.prestige || 50) - sanction);
        ch.stress = Math.min(100, (ch.stress || 0) + Math.max(12, sanction + 8));
        if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
          // v2.6 polish·emo '恨' (非 'politics' 无效值)·event 古文 (非 English)·跟其他 remember 调一致
          NpcMemorySystem.remember(nm, '准奏弹劾·议《' + ((topic || '').slice(0, 24)) + '》·定罪 -' + sanction + ' 名望', '恨', 8, accuser || '言官');
        }
      }
    });
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 准奏弹劾·定性新党：' + newName + ' 〕', true);
    if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
    if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
      turn: GM.turn || 1,
      date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
      type: 'impeachment-party',
      text: (accuser || 'unknown') + ' accused ' + accusedNames.join(', ') + '; ' + newName + ' formed under inquiry.',
      tags: ['party', 'impeachment', 'accusation', newName],
      partyName: newName,
      accuser: accuser,
      accused: accusedNames.slice()
    });
    // v7.1·F4c·D1·言官清议触发·内 try/catch·flag gate 在 _kjSpawnYanguanQingyi
    try {
      if (sourceParty && typeof _kjSpawnYanguanQingyi === 'function') {
        var qDetail = '准奏弹劾·' + (accuser || '言官') + ' 参 ' + accusedNames.join('、') + '·定罪 ' + verdictGrade;
        _kjSpawnYanguanQingyi(sourceParty, leaderName, qDetail);
      }
    } catch (_kjE) {
      try { window.TM && TM.errors && TM.errors.captureSilent(_kjE, 'kj-yanguan-qingyi-on-impeach'); } catch (__) {}
    }
  }
  return p;
}

function _ty3_uniquePartyName(base) {
  base = String(base || '\u65B0\u515A');
  if (!Array.isArray(GM.parties)) GM.parties = [];
  var name = base;
  var idx = 1;
  while (GM.parties.some(function(p) { return p && p.name === name; })) {
    name = base + idx;
    idx += 1;
  }
  return name;
}

function _ty3_removeFoundersFromParty(party, founders) {
  if (!party || !Array.isArray(founders) || founders.length === 0) return;
  var names = {};
  founders.forEach(function(nm) { if (nm) names[nm] = true; });
  if (typeof party.members === 'string') {
    var kept = party.members.split(/[,\u3001\uFF0C\s]+/).map(function(nm) { return (nm || '').trim(); }).filter(function(nm) {
      return nm && !names[nm];
    });
    party.members = kept.join(',');
  }
  party.memberCount = Math.max(0, (parseInt(party.memberCount, 10) || _ty3_getPartyMembers(party.name).length || 0) - founders.length);
}

function _ty3_partyEvolutionTick() {
  if (!Array.isArray(GM.parties) || GM.parties.length === 0) {
    try {
      if (typeof TM !== 'undefined' && TM.PartyGoals && typeof TM.PartyGoals.evolveDynamicRelations === 'function') {
        TM.PartyGoals.evolveDynamicRelations(GM, { turn: GM.turn || 0, source: 'tinyi-party-evolution' });
      }
    } catch (_pcrEmptyE) {
      try { window.TM && TM.errors && TM.errors.captureSilent(_pcrEmptyE, 'tinyi-party-class-relation-evolution-empty'); } catch (_) {}
    }
    return;
  }
  if (!GM._partyEvolutionState) GM._partyEvolutionState = {};
  var state = GM._partyEvolutionState;
  GM.parties.forEach(function(p) {
    if (!p || !p.name || p.status === '湮灭') return;
    var coh = parseInt(p.cohesion, 10) || 50;
    var infl = parseInt(p.influence, 10) || 50;
    var members = _ty3_getPartyMembers(p.name);
    state[p.name] = state[p.name] || { lowCohStreak: 0 };
    if (coh < 10 && infl < 5 && members.length < 3) {
      _ty3_partyDispose(p.name, '式微·凝聚瓦解·影响湮没');
      return;
    }
    if (coh < 20) {
      state[p.name].lowCohStreak = (state[p.name].lowCohStreak || 0) + 1;
    } else if (state[p.name]) {
      state[p.name].lowCohStreak = 0;
    }
    if (coh < 30 && !state[p.name].privateSocietySpawned) {
      var privateLeader = members.slice().sort(function(a, b) {
        return ((b.prestige || 0) + (b.favor || 0)) - ((a.prestige || 0) + (a.favor || 0));
      }).find(function(c) { return c && (c.prestige || 0) >= 80 && (c.favor || 0) >= 70; });
      if (privateLeader) {
        var hiddenName = _ty3_uniquePartyName(privateLeader.name + '\u79C1\u793E');
        var hidden = _ty3_partySpawn({
          name: hiddenName,
          leaderName: privateLeader.name,
          founders: [privateLeader.name],
          parentParty: p.name,
          initialInfluence: Math.max(4, Math.round(infl * 0.18)),
          initialCohesion: 62,
          ideology: '\u79C1\u4E0B\u7ED3\u793E',
          reason: '\u4E3B\u5B98\u671B\u91CD\u800C\u515A\u5185\u79BB\u5FC3',
          agenda: '\u6697\u8054\u540C\u9053',
          status: '\u9690\u515A'
        });
        if (hidden) {
          hidden.hidden = true;
          hidden.publicKnown = false;
          hidden.sourceParty = p.name;
          state[p.name].privateSocietySpawned = true;
          p.cohesion = Math.max(0, coh - 2);
          _ty3_removeFoundersFromParty(p, [privateLeader.name]);
        }
      }
    }
    if ((state[p.name].lowCohStreak || 0) >= 3 && !state[p.name].splitSpawned && members.length >= 4) {
      var founders = members.slice().sort(function(a, b) {
        return ((b.ambition || 0) + (b.prestige || 0)) - ((a.ambition || 0) + (a.prestige || 0));
      }).slice(0, Math.max(2, Math.min(3, Math.floor(members.length / 2)))).map(function(c) { return c.name; }).filter(Boolean);
      if (founders.length > 0) {
        var splinterName = _ty3_uniquePartyName(p.name + '\u522B\u515A');
        var splinter = _ty3_partySpawn({
          name: splinterName,
          leaderName: founders[0],
          founders: founders,
          parentParty: p.name,
          initialInfluence: Math.max(6, Math.round(infl * 0.32)),
          initialCohesion: 56,
          ideology: '\u5206\u515A\u81EA\u7ACB',
          reason: '\u4E45\u4E0D\u76F8\u5408\u800C\u5206\u5316',
          agenda: '\u91CD\u7ACB\u95E8\u6237',
          status: '\u5206\u5316'
        });
        if (splinter) {
          state[p.name].splitSpawned = true;
          state[p.name].lowCohStreak = 0;
          p.influence = Math.max(0, infl - Math.max(3, Math.round(infl * 0.2)));
          p.cohesion = Math.max(0, coh - 4);
          _ty3_removeFoundersFromParty(p, founders);
        }
      }
    }
  });
  try {
    if (typeof TM !== 'undefined' && TM.PartyGoals && typeof TM.PartyGoals.evolveDynamicRelations === 'function') {
      TM.PartyGoals.evolveDynamicRelations(GM, { turn: GM.turn || 0, source: 'tinyi-party-evolution' });
    }
  } catch (_pcrE) {
    try { window.TM && TM.errors && TM.errors.captureSilent(_pcrE, 'tinyi-party-class-relation-evolution'); } catch (_) {}
  }
}

function _ty3_phase3b_openSpawnDialog() {
  if (typeof toast === 'function') toast('史制无君上册党之例·请改走弹劾结党路径');
}
function _ty3_phase3b_doSpawn() { _ty3_phase3b_openSpawnDialog(); }

if (typeof window !== 'undefined') {
  // v2.6 Slice 0.5·expose _ty3_phase6_recordSeal·Slice 8 hook 必需 (verified 八轮 audit·v3 漏暴露此函数)
  window._ty3_phase6_recordSeal = _ty3_phase6_recordSeal;
  window._ty3_phase3_open = _ty3_phase3_open;
  window._ty3_phase3_qinDing = _ty3_phase3_qinDing;
  window._ty3_phase3_doPublicVote = _ty3_phase3_doPublicVote;
  window._ty3_phase3_skip = _ty3_phase3_skip;
  window._ty3_phase3_isPersonnelTopic = _ty3_phase3_isPersonnelTopic;
  window._ty3_phase3_buildCandidates = _ty3_phase3_buildCandidates;
  window._ty3_collectOfficeHolderNames = _ty3_collectOfficeHolderNames;
  window._ty3_phase6_open = _ty3_phase6_open;
  window._ty3_policySanctionByGrade = _ty3_policySanctionByGrade;
  window._ty3_getTinyiFollowUpDelay = _ty3_getTinyiFollowUpDelay;
  window._ty3_recordTinyiDraft = _ty3_recordTinyiDraft;
  window._ty3_phase6_resolveSeal = _ty3_phase6_resolveSeal;
  window._ty3_enqueueTinyiFollowUp = _ty3_enqueueTinyiFollowUp;
  window._ty3_tickChronicleTracks = _ty3_tickChronicleTracks;
  window.terminateChronicleTrack = function(id, reason) {
    if (typeof ChronicleTracker === 'undefined' || !ChronicleTracker.terminate) return false;
    var ok = ChronicleTracker.terminate(id, 'player', reason || '帝意中辍');
    if (ok && typeof toast === 'function') toast('〔已中辍〕长期工程已废止·后果已应用');
    else if (!ok && typeof toast === 'function') toast('〔不可中辍〕该项不可终结·或已结案');
    return ok;
  };
  window.listTerminableTracks = function() {
    if (!Array.isArray(GM._chronicleTracks)) return [];
    return GM._chronicleTracks.filter(function(t) { return t && t.status === 'active' && t.terminable !== false; }).map(function(t) {
      return { id: t.id, title: t.title, progress: t.progress, short: t.shortTermBalance, long: t.longTermBalance, termCost: t.terminationCost && t.terminationCost.narrative };
    });
  };
  window._ty3_phase6_offerVerdictNote = _ty3_phase6_offerVerdictNote;
  window._ty3_phase6_skipVerdictNote = _ty3_phase6_skipVerdictNote;
  window._ty3_phase6_saveVerdictNote = _ty3_phase6_saveVerdictNote;
  window._ty3_phase6_doSeal = _ty3_phase6_doSeal;
  window._ty3_reissueTopic = _ty3_reissueTopic;
  window._ty3_applyAIReissueTopics = _ty3_applyAIReissueTopics;
  window._ty3_phase3b_openSpawnDialog = _ty3_phase3b_openSpawnDialog;
  window._ty3_phase3b_doSpawn = _ty3_phase3b_doSpawn;
  window._ty3_phase12_onAccusationApproved = _ty3_phase12_onAccusationApproved;
  window._ty3_buildAccusationMemorialStructured = _ty3_buildAccusationMemorialStructured;
  window._ty3_partySpawn = _ty3_partySpawn;
  window._ty3_partyDispose = _ty3_partyDispose;
  window._ty3_partyEvolutionTick = _ty3_partyEvolutionTick;
}
var _TY3_REVIEW_DELAY = 3; // default review delay in turns
// Stage 7 review covers formal player decisions recorded in edict trackers.
// Held topics, departmental tasks, and pending re-debate queues are excluded.
function _ty3_isReviewableEdict(e) {
  if (!e) return false;
  var sources = ['tinyi2', 'ty3', 'changchao', 'changchao_decree', 'yuqian2'];
  if (sources.indexOf(e.source) >= 0) return true;
  if (/廷议|常朝|御前/.test(e.category || '')) return true;
  return false;
}

function _ty3_phase7_reviewFollowUp(entry) {
  if (!entry) return null;
  var grade = entry.grade || 'C';
  var sourceParty = entry.sourceParty || '';
  var opposers = _ty3_normalizePartyNames(entry.opposingParties || []);
  var outcome = entry.sealStatus === 'blocked' ? 'blocked' : (grade === 'S' || grade === 'A') ? 'fulfilled' : (grade === 'D' ? 'contested' : 'partial');
  var source = sourceParty ? _ty3_getPartyStateWritable(sourceParty) : null;
  if (source) {
    if (!Array.isArray(source.policyFollowUpHistory)) source.policyFollowUpHistory = [];
    source.policyFollowUpHistory.push({ turn: GM.turn || 0, topic: entry.topic || '', grade: grade, outcome: outcome });
    if (outcome === 'fulfilled' || outcome === 'partial') source.recentPolicyWin = (source.recentPolicyWin || 0) + (outcome === 'fulfilled' ? 1 : 0.5);
    else source.recentPolicyLose = (source.recentPolicyLose || 0) + 1;
  }
  opposers.forEach(function(pn) {
    var ps = _ty3_getPartyStateWritable(pn);
    if (!ps) return;
    if (!Array.isArray(ps.policyFollowUpHistory)) ps.policyFollowUpHistory = [];
    ps.policyFollowUpHistory.push({ turn: GM.turn || 0, topic: entry.topic || '', grade: grade, outcome: outcome, role: 'opposition' });
    if (outcome === 'fulfilled') ps.recentPolicyLose = (ps.recentPolicyLose || 0) + 1;
    else if (outcome === 'blocked' || outcome === 'contested') ps.recentPolicyWin = (ps.recentPolicyWin || 0) + 0.5;
  });
  try {
    if (typeof TM !== 'undefined' && TM.ClassEngine && typeof TM.ClassEngine.applyPartyOutcomeToClasses === 'function') {
      TM.ClassEngine.applyPartyOutcomeToClasses(GM, {
        outcome: outcome,
        grade: grade,
        sourceParty: sourceParty,
        opposingParties: opposers,
        sealStatus: entry.sealStatus || '',
        sourceType: entry.sourceType || '',
        sourceClass: entry.sourceClass || entry.className || '',
        className: entry.className || entry.sourceClass || '',
        demandText: entry.demandText || '',
        relationEvidence: entry.relationEvidence || []
      }, { turn: GM.turn || 0, source: 'tinyi-stage7-follow-up' });
    }
  } catch (_pcFollowE) {
    try { window.TM && TM.errors && TM.errors.captureSilent(_pcFollowE, 'tinyi-stage7-party-class'); } catch (_) {}
  }
  if (typeof GM.partyStrife === 'number') {
    var delta = outcome === 'fulfilled' ? -1 : outcome === 'partial' ? 1 : 2;
    GM.partyStrife = Math.max(0, Math.min(100, GM.partyStrife + delta));
  }
  if (GM.corruption && typeof GM.corruption === 'object') {
    if (!Array.isArray(GM.corruption.history)) GM.corruption.history = [];
    GM.corruption.history.push({ turn: GM.turn || 0, type: 'tinyi_follow_up', topic: entry.topic || '', grade: grade, outcome: outcome });
  }
  try {
    _ty3_syncChaoyiChronicleTrack({
      trackId: entry.topicId,
      topic: entry.topic,
      proposerParty: sourceParty,
      opposingParties: opposers,
      grade: grade,
      decisionMode: entry.decisionMode || '',
      turn: entry.turn || GM.turn || 0,
      currentStage: '\u5DF2\u590D\u8BC4',
      progress: 100,
      summary: 'follow-up ' + outcome,
      narrative: 'follow-up ' + outcome + ' · ' + (entry.topic || ''),
      recentReviewOutcome: outcome,
      recentReviewTurn: GM.turn || 0,
      recentReviewGrade: grade,
      shortTermBalance: outcome,
      longTermBalance: entry.topic || '',
      sealStatus: entry.sealStatus || '',
      priority: outcome === 'blocked' ? 'high' : 'medium'
    });
  } catch (_chaoyiTrackReviewE) {
    try { window.TM && TM.errors && TM.errors.captureSilent(_chaoyiTrackReviewE, 'tinyi-chaoyi-track-review'); } catch (_) {}
  }
  _ty3_pushChronicle('Follow-up', 'Court policy follow-up: ' + (entry.topic || '') + ' -> ' + outcome + '.', {
    topicId: entry.topicId,
    topic: entry.topic || '',
    grade: grade,
    outcome: outcome,
    sourceParty: sourceParty,
    opposingParties: opposers
  });
  if (!Array.isArray(GM._turnReport)) GM._turnReport = [];
  GM._turnReport.push({ type: 'tinyi_follow_up', turn: GM.turn || 0, topic: entry.topic || '', topicId: entry.topicId, outcome: outcome, grade: grade, sourceParty: sourceParty });
  return { topicId: entry.topicId, topic: entry.topic || '', grade: grade, outcome: outcome, sourceParty: sourceParty, reviewedTurn: GM.turn || 0 };
}
function _ty3_phase7_runFollowUpQueue() {
  if (!GM.tinyi || !Array.isArray(GM.tinyi.followUpQueue)) return [];
  var now = GM.turn || 0;
  var remaining = [];
  var summaries = [];
  GM.tinyi.followUpQueue.forEach(function(entry) {
    if (!entry || (entry.dueTurn || 0) > now) {
      if (entry) remaining.push(entry);
      return;
    }
    var summary = _ty3_phase7_reviewFollowUp(entry);
    if (summary) summaries.push(summary);
  });
  GM.tinyi.followUpQueue = remaining;
  if (summaries.length) {
    if (!Array.isArray(GM._ty3_pendingReviewForPrompt)) GM._ty3_pendingReviewForPrompt = [];
    summaries.forEach(function(s){ GM._ty3_pendingReviewForPrompt.push(s); });
  }
  return summaries;
}

function _ty3_phase7_runReview() {
  _ty3_phase7_runFollowUpQueue();
  if (!Array.isArray(GM._edictTracker)) return;
  var matured = GM._edictTracker.filter(function(e) {
    if (!e || e._ty3Reviewed) return false;
    if (!_ty3_isReviewableEdict(e)) return false;
    return ((e.turn||0) + _TY3_REVIEW_DELAY) <= (GM.turn||0);
  });
  if (matured.length === 0) return;
// 准备 prompt 注入队列(供 AI 推演读取·非数值修改)
  if (!Array.isArray(GM._ty3_pendingReviewForPrompt)) GM._ty3_pendingReviewForPrompt = [];
  matured.forEach(function(edict) {
    var summary = _ty3_phase7_reviewOne(edict);
    edict._ty3Reviewed = true;
    edict._ty3ReviewedAt = GM.turn;
    if (summary) GM._ty3_pendingReviewForPrompt.push(summary);
  });
}

// Review mature policy outcomes and record prompt/report summaries.
function _ty3_phase7_reviewOne(edict) {
  if (!edict) return null;
  var pct = Number(edict.progressPercent != null ? edict.progressPercent : edict.progress) || 0;
  var proposerParty = edict.proposerParty || edict.party || '';
  var fb = edict.feedback || '';
  var isBackfire = /backfire|反噬|失控|恶化|失败/.test(String(fb)) || edict.status === 'backfire';
  var outcome;
  if (isBackfire) outcome = 'backfire';
  else if (pct >= 80) outcome = 'fulfilled';
  else if (pct >= 40) outcome = 'partial';
  else outcome = 'unfulfilled';
  var partyObj = proposerParty ? _ty3_getPartyObj(proposerParty) : null;
  var leader = proposerParty ? _ty3_getPartyLeader(proposerParty) : null;
  var assigneeCh = edict.assignee ? ((typeof findCharByName === 'function') ? findCharByName(edict.assignee) : null) : null;
  var venueType = '';
  if (edict.source === 'tinyi2' || edict.source === 'ty3' || /廷议|tinyi/i.test(edict.category || '')) venueType = '\u5ef7\u8bae';
  else if (edict.source === 'yuqian2' || /御前|yuqian/i.test(edict.category || '')) venueType = '\u5fa1\u524d';
  else if (edict.source === 'changchao' || edict.source === 'changchao_decree' || /常朝|decree/i.test(edict.category || '')) venueType = (edict.source === 'changchao_decree') ? '\u4eb2\u8bcf' : '\u5e38\u671d';
  var label = { fulfilled: '\u5145\u5206\u843d\u5b9e', partial: '\u90e8\u5206\u843d\u5b9e', unfulfilled: '\u672a\u843d\u5b9e', backfire: '\u53cd\u6548\u679c' }[outcome] || outcome;
  var histLabel = { fulfilled: '\u51c6\u594f\u679c\u9a8c', partial: '\u884c\u800c\u672a\u5c3d', unfulfilled: '\u5949\u884c\u4e0d\u529b', backfire: '\u9002\u5f97\u5176\u53cd' }[outcome] || label;
  if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
  var histTags = [venueType || '\u8bcf\u547d', '\u8ffd\u8d23\u56de\u54cd', label];
  if (proposerParty) histTags.push(proposerParty);
  var chronType = venueType ? (venueType + '\u8ffd\u8d23') : '\u8bcf\u547d\u8ffd\u8d23';
  var venueLabel = venueType || '\u8bcf\u547d';
  var topicText = String(edict.title || edict.topic || edict.content || '').replace(/\s+/g, ' ').slice(0, 40);
  var partyLabel = proposerParty ? (proposerParty + '\u4e3b\u4e4b') : '\u671d\u8bba\u5171\u8bae';
  var chronText = '\u524d' + venueLabel + '\u300a' + topicText + '\u300b\u00b7' + partyLabel + '\u00b7\u4e09\u56de\u5408\u540e' + histLabel;
  if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
    turn: GM.turn || 1,
    date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
    type: chronType,
    text: chronText,
    tags: histTags,
    edictId: edict.id,
    outcome: outcome,
    venueType: venueType,
    relatedParty: proposerParty || '',
    relatedChars: [leader && leader.name, assigneeCh && assigneeCh.name].filter(Boolean)
  });
  if (!GM._turnReport) GM._turnReport = [];
  GM._turnReport.push({
    type: 'tinyi_review',
    turn: GM.turn || 0,
    edictContent: (edict.content || '').slice(0, 80),
    edictId: edict.id,
    outcome: outcome,
    label: label,
    histLabel: histLabel,
    venueType: venueType,
    proposerParty: proposerParty || '',
    leaderName: leader ? leader.name : '',
    assigneeName: assigneeCh ? assigneeCh.name : '',
    delayTurns: (GM.turn || 0) - (edict.turn || 0)
  });
  try {
    if (assigneeCh && typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      var _emoMap = { fulfilled: '\u559c', partial: '\u5e73', unfulfilled: '\u5fe7', backfire: '\u6068' };
      var _wtMap = { fulfilled: 6, partial: 5, unfulfilled: 5, backfire: 8 };
      NpcMemorySystem.remember(assigneeCh.name, '\u8bae\u300a' + topicText + '\u300b' + histLabel, _emoMap[outcome] || '\u5e73', _wtMap[outcome] || 5, venueLabel);
    }
  } catch (_) {}
  return {
    edictId: edict.id,
    content: edict.content || '',
    venueType: venueType,
    proposerParty: proposerParty || '',
    leaderName: leader ? leader.name : '',
    assigneeName: assigneeCh ? assigneeCh.name : '',
    outcome: outcome,
    label: label,
    histLabel: histLabel,
    turn: edict.turn,
    reviewedTurn: GM.turn,
    delayTurns: (GM.turn || 0) - (edict.turn || 0)
  };
}
function _ty3_phase14_recordChaoyiSummary(decision, opts) {
  opts = opts || {};
  if (!Array.isArray(GM.recentChaoyi)) GM.recentChaoyi = [];
  var topic = (CY._ty2 && CY._ty2.topic) || (CY._ty3 && CY._ty3.topic) || '';
  if (!topic) return;
  var proposerParty = (CY._ty3 && CY._ty3.proposerParty) || opts.proposerParty || '';
  var decisionMode = (decision && decision.mode) || opts.decisionMode || '';
  var grade = CY._ty3_archonGrade || (CY._ty3 && CY._ty3.archonGrade) || opts.grade || '';
  var counts = (typeof _ty2_countStances === 'function') ? _ty2_countStances() : null;
  var meta = (CY._ty3 && CY._ty3.meta) || (typeof window !== 'undefined' && window._ty3_publicMeta) || {};
  var originalGist = meta.proposerReason || meta.memorialContent || (meta.from || '') || '';
  if (originalGist.length > 100) originalGist = originalGist.slice(0, 100) + '...';
  var keyMoments = [];
  try {
    var allSpeeches = (CY._ty2 && CY._ty2._allSpeeches) || [];
    if (allSpeeches.length > 0) {
      var byName = {};
      allSpeeches.forEach(function(s) { byName[s.name] = s; });
      keyMoments = Object.values(byName).slice(0, 6).map(function(s) { return { name: s.name, stance: s.stance, gist: String(s.line || '').slice(0, 50) }; });
    }
  } catch (_kmE) {}
  var playerInterjects = [];
  try {
    playerInterjects = (CY._ty3 && Array.isArray(CY._ty3.playerInterjects)) ? CY._ty3.playerInterjects.slice(-3) : [];
  } catch (_piE) {}
  var item = {
    turn: GM.turn || 0,
    year: GM.year || 0,
    topic: topic,
    decision: decision || (CY._ty2 && CY._ty2.decision) || null,
    mode: decisionMode,
    chaoyiTrackId: (CY._ty3 && CY._ty3.chaoyiTrackId) || (CY._ty2 && CY._ty2.chaoyiTrackId) || opts.chaoyiTrackId || _ty3_buildChaoyiTrackId(topic, proposerParty, grade, decisionMode, GM.turn || 0),
    counts: counts,
    proposer: (CY._ty3 && CY._ty3.proposer) || meta.proposer || '',
    proposerParty: proposerParty || meta.proposerParty || '',
    originalGist: originalGist,
    keyMoments: keyMoments,
    playerInterjects: playerInterjects,
    playerVerdictNote: CY._ty3 && CY._ty3._playerVerdictNote || '',
    sealStatus: CY._ty3 && CY._ty3.sealStatus || '',
    sealedEdict: CY._ty3 && CY._ty3.sealedEdict || null,
    meta: meta
  };
  try {
    _ty3_syncChaoyiChronicleTrack({
      trackId: item.chaoyiTrackId,
      topic: topic,
      proposerParty: item.proposerParty,
      opposingParties: Array.isArray(opts.opposingParties) ? opts.opposingParties : [],
      grade: grade,
      decisionMode: decisionMode,
      turn: item.turn,
      currentStage: '\u8BB0\u5F55',
      progress: 55,
      summary: originalGist || topic,
      narrative: [topic, originalGist, item.sealStatus || ''].filter(Boolean).join(' \u00B7 '),
      shortTermBalance: item.playerVerdictNote || '',
      longTermBalance: originalGist || topic,
      sealStatus: item.sealStatus || '',
      priority: item.sealStatus === 'blocked' ? 'high' : 'medium',
      sourceParty: item.proposerParty,
      stakeholders: [item.proposerParty].concat(_ty3_normalizePartyNames(opts.opposingParties || [])),
      hidden: false
    });
  } catch (_chaoyiTrackSummaryE) {
    try { window.TM && TM.errors && TM.errors.captureSilent(_chaoyiTrackSummaryE, 'tinyi-chaoyi-track-summary'); } catch (_) {}
  }
  GM.recentChaoyi.unshift(item);
  if (GM.recentChaoyi.length > 8) GM.recentChaoyi.length = 8;
  if (CY._ty3 && typeof CY._ty3 === 'object') CY._ty3.chaoyiTrackId = item.chaoyiTrackId;
  if (CY._ty2 && typeof CY._ty2 === 'object') CY._ty2.chaoyiTrackId = item.chaoyiTrackId;
  if (GM.recentChaoyi[0]) GM.recentChaoyi[0].chaoyiTrackId = item.chaoyiTrackId;
  if (typeof addEB === 'function') addEB('廷议', '议毕纪要·' + topic);
  // v2.6 polish·auto-collect baseline snapshot 到 localStorage·user 跑 game 即累积·无需手填 actual 字段
  try {
    if (typeof _ty3_baselineRecord === 'function' && typeof localStorage !== 'undefined') {
      var snap = _ty3_baselineRecord('auto-' + (GM.turn || 0) + '-' + topic.slice(0, 12));
      if (snap) {
        var key = 'ty3_baselines';
        var arr = [];
        try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_pe) {}
        if (!Array.isArray(arr)) arr = [];
        arr.push(snap);
        if (arr.length > 50) arr = arr.slice(-50);  // 限 50·避撑爆 localStorage
        // v2.6 polish·Round 5·QuotaExceededError guard·若 localStorage 满·尝试缩到 10 + 再写
        try { localStorage.setItem(key, JSON.stringify(arr)); }
        catch (_quotaE) {
          try { localStorage.setItem(key, JSON.stringify(arr.slice(-10))); }
          catch (_quotaE2) { console.warn('[baseline] localStorage 满·snapshot 丢弃·调 _ty3_baselineClearAll() reset'); }
        }
      }
    }
  } catch (_blE) {}
  return item;
}

function _ty3_buildChaoyiTrackId(topic, proposerParty, grade, decisionMode, turn) {
  return JSON.stringify(['chaoyi', turn || (GM.turn || 0), String(topic || ''), String(proposerParty || ''), String(grade || ''), String(decisionMode || '')]);
}

function _ty3_syncChaoyiChronicleTrack(payload) {
  if (typeof ChronicleTracker === 'undefined' || !payload) return null;
  var trackId = payload.trackId || _ty3_buildChaoyiTrackId(payload.topic || '', payload.proposerParty || '', payload.grade || '', payload.decisionMode || '', payload.turn || GM.turn || 0);
  if (!trackId) return null;
  var stakeholders = Array.isArray(payload.stakeholders) ? payload.stakeholders.slice(0, 8) : [];
  ChronicleTracker.upsert({
    type: 'tingyi_pending',     // v2.6 Slice 11\u00B7\u6539 tingyi (\u5EF7\u8BAE)\u00B7\u975E chaoyi (\u671D\u8BAE\u00B7\u8BED\u4E49\u9519)\u00B7user "\u5EF7\u8BAE\u5F85\u843D\u5B9E\u5361\u7F3A" \u771F\u539F\u56E0
    category: '\u5EF7\u8BAE\u5F85\u843D\u5B9E',     // \u5EF7\u8BAE\u5F85\u843D\u5B9E
    sourceType: 'tingyi_pending',
    sourceId: trackId,
    title: String(payload.topic || '').slice(0, 60) || '\u5EF7\u8BAE',
    actor: payload.actor || '',
    stakeholders: stakeholders,
    currentStage: payload.currentStage || '\u8BB0\u5F55',
    progress: payload.progress != null ? payload.progress : 50,
    narrative: String(payload.narrative || payload.summary || '').slice(0, 160),
    startTurn: payload.turn || GM.turn || 0,
    expectedEndTurn: payload.expectedEndTurn || null,
    hidden: !!payload.hidden,
    priority: payload.priority || 'medium',
    status: payload.status || 'active',
    sourceParty: payload.proposerParty || payload.sourceParty || '',
    opposingParties: _ty3_normalizePartyNames(payload.opposingParties || []),
    sealStatus: payload.sealStatus || '',
    shortTermBalance: payload.shortTermBalance || '',
    longTermBalance: payload.longTermBalance || '',
    recentReviewOutcome: payload.recentReviewOutcome || '',
    recentReviewTurn: payload.recentReviewTurn || null,
    recentReviewGrade: payload.recentReviewGrade || ''
  });
  return trackId;
}
function _ty3_pickProposer(criteria) {
  criteria = criteria || {};
  var chars = (GM.chars || []).filter(function(c) { return c && c.alive !== false && !c.isPlayer; });
  if (criteria.party) chars = chars.filter(function(c) { return c.party === criteria.party; });
  if (criteria.titleRegex) chars = chars.filter(function(c) { return criteria.titleRegex.test(c.officialTitle || c.title || ''); });
  chars.sort(function(a, b) { return (b.prestige || 0) - (a.prestige || 0); });
  if (chars.length > 0) return chars[0];
  if (criteria.fallbackTitle) {
    var re = new RegExp(criteria.fallbackTitle);
    var fb = (GM.chars || []).filter(function(c) {
      if (!c || c.alive === false || c.isPlayer) return false;
      return re.test(c.officialTitle || c.title || '');
    });
    fb.sort(function(a, b) { return (b.prestige || 0) - (a.prestige || 0); });
    if (fb.length > 0) return fb[0];
  }
  return null;
}

function _ty3_attachProposer(topicObj, ch, reason) {
  if (!topicObj || !ch) return topicObj;
  topicObj.proposer = ch.name;
  topicObj.proposerTitle = ch.officialTitle || ch.title || '';
  topicObj.proposerParty = ch.party || '';
  topicObj.proposerInfluence = (typeof _ty3_partyInfluence === 'function' && ch.party) ? _ty3_partyInfluence(ch.party) : 0;
  if (reason) topicObj.proposerReason = reason;
  return topicObj;
}

function _ty3_alreadyHasTopic(keyword) {
  if (!keyword) return false;
  var list = [];
  if (Array.isArray(GM._pendingTinyiTopics)) list = list.concat(GM._pendingTinyiTopics);
  if (Array.isArray(GM._ccHeldItems)) list = list.concat(GM._ccHeldItems);
  return list.some(function(t) {
    if (!t) return false;
    var raw = String(t.topic || '');
    var display = String(t.topicDisplay || t.displayTopic || '');
    return raw.indexOf(keyword) >= 0 || display.indexOf(keyword) >= 0;
  });
}

function _ty3_localizeCourtTopicText(value) {
  var text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  [
    [/pay\s+arrears\s+and\s+stabilize\s+garrisons/ig, '清偿欠饷并安定驻军'],
    [/pay\s+military\s+wage\s+arrears/ig, '清偿军饷拖欠'],
    [/military\s+wage\s+arrears/ig, '军饷拖欠'],
    [/pay\s+border\s+wage\s+arrears/ig, '清偿边军欠饷'],
    [/pay\s+wage\s+arrears/ig, '清偿欠饷'],
    [/wage\s+arrears/ig, '欠饷'],
    [/press\s+for\s+wage\s+arrears\s+settlement/ig, '催办欠饷清偿'],
    [/keep\s+military\s+pay\s+current/ig, '确保军饷按期发放'],
    [/defend\s+wage\s+settlement/ig, '维护军饷清偿'],
    [/relieve\s+tax\s+and\s+arrear\s+pressure/ig, '缓解税负与积欠'],
    [/defend\s+turn-result\s+tax\s+relief/ig, '维护减税纾困'],
    [/respond\s+to\s+turn-result\s+tax\s+pressure/ig, '应对税负压力'],
    [/defend\s+arrear\s+collection/ig, '维护追征积欠'],
    [/defend\s+levy\s+collection\s+and\s+arrears/ig, '维护征派与追欠'],
    [/defend\s+emergency\s+levy/ig, '维护紧急征派'],
    [/defend\s+emergency\s+grain\s+levy/ig, '维护紧急征粮'],
    [/curb\s+donation-for-office\s+appointments/ig, '遏制捐纳授官'],
    [/defend\s+office\s+appointment\s+interests/ig, '维护任官利益'],
    [/survive\s+purge\s+and\s+protect\s+office\s+network/ig, '避祸清党并保全官场网络'],
    [/consolidate\s+appointment\s+network/ig, '巩固任官网络'],
    [/defend\s+accused\s+officials/ig, '维护被劾官员'],
    [/claim\s+credit\s+for\s+exam\s+access/ig, '争取科举入场之功'],
    [/push\s+exam\s+admission\s+review/ig, '推动科举录取复核'],
    [/press\s+unresolved\s+demand/ig, '推动未决诉求'],
    [/force\s+concession/ig, '迫使让步'],
    [/survive\s+local\s+extraction/ig, '求免地方盘剥'],
    [/block\s+rival\s+agenda/ig, '阻挠敌党议程'],
    [/maintain\s+social\s+base/ig, '维持社会根基'],
    [/combine\s+votes/ig, '联合票势'],
    [/survive\s+internal\s+fracture/ig, '避免内部分裂'],
    [/rival\s+agenda/ig, '敌党议程'],
    [/tax\s+pressure/ig, '税负压力'],
    [/military\s+arrears/ig, '军饷拖欠'],
    [/turn-result/ig, '回合推演'],
    [/court\s+issue\s+outcome/ig, '廷议结果']
  ].forEach(function(pair) {
    text = text.replace(pair[0], pair[1]);
  });
  text = text
    .replace(/\s*-\s*/g, ' · ')
    .replace(/\s*;\s*/g, '；')
    .replace(/\s*,\s*/g, '，')
    .replace(/\s*:\s*/g, '：')
    .replace(/([·：；，。、！？])\s+/g, '$1')
    .replace(/\s+([·：；，。、！？])/g, '$1')
    .replace(/([一-龥])\s+([一-龥])/g, '$1$2')
    .replace(/\bpay\b/ig, '给付')
    .replace(/\barrears\b/ig, '积欠')
    .replace(/\blevy\b/ig, '征派')
    .replace(/\bdefend\b/ig, '维护')
    .replace(/\bpress\b/ig, '催办')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

function _ty3_topicDisplayText(raw, maxLen) {
  var value = raw;
  if (raw && typeof raw === 'object') {
    value = raw.topicDisplay || raw.displayTopic || raw.displayTitle || raw.topic || raw.title || raw.name || raw.text || raw.content || raw.summary || raw.desc || raw.agenda || raw.goal || raw.objective || raw.demand || '';
  }
  var text = _ty3_localizeCourtTopicText(value);
  if (maxLen && text.length > maxLen) return text.slice(0, maxLen);
  return text;
}

function _ty3_topicText(raw, maxLen) {
  var value = raw;
  if (raw && typeof raw === 'object') value = raw.topic || raw.title || raw.name || raw.text || raw.content || raw.summary || raw.desc || raw.agenda || raw.goal || raw.objective || raw.demand || '';
  var text = String(value || '').replace(/\s+/g, ' ').trim();
  var max = maxLen || 34;
  return text.length > max ? text.slice(0, max) : text;
}

function _ty3_toTinyiArray(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.slice();
  if (value && typeof value === 'object') {
    if (Array.isArray(value.items)) return value.items.slice();
    if (Array.isArray(value.list)) return value.list.slice();
    if (Array.isArray(value.goals)) return value.goals.slice();
  }
  return [value];
}

function _ty3_getScenarioClasses() {
  if (typeof GM !== 'undefined' && GM && Array.isArray(GM.classes)) return GM.classes;
  if (typeof GM !== 'undefined' && GM && Array.isArray(GM.socialClasses)) return GM.socialClasses;
  if (typeof GM !== 'undefined' && GM && GM.scriptData && Array.isArray(GM.scriptData.classes)) return GM.scriptData.classes;
  if (typeof GM !== 'undefined' && GM && GM.scriptData && Array.isArray(GM.scriptData.socialClasses)) return GM.scriptData.socialClasses;
  if (typeof P !== 'undefined' && P && Array.isArray(P.classes)) return P.classes;
  if (typeof P !== 'undefined' && P && Array.isArray(P.socialClasses)) return P.socialClasses;
  if (typeof scriptData !== 'undefined' && scriptData && Array.isArray(scriptData.classes)) return scriptData.classes;
  if (typeof scriptData !== 'undefined' && scriptData && Array.isArray(scriptData.socialClasses)) return scriptData.socialClasses;
  return [];
}

function _ty3_numberOr(value, fallback) {
  var n = Number(value);
  return isNaN(n) ? fallback : n;
}

function _ty3_partyGoalEntries(p) {
  if (!p) return [];
  if (typeof TM !== 'undefined' && TM.PartyGoals && typeof TM.PartyGoals.getActiveGoals === 'function') {
    try {
      return TM.PartyGoals.getActiveGoals(GM, p, { turn: GM.turn || 0, source: 'tinyi-party-goal-scan' }).map(function(goal) {
        return {
          id: goal.id || '',
          kind: goal.kind || 'currentAgenda',
          text: goal.text || '',
          raw: goal,
          priority: goal.priority || 0,
          expiresTurn: goal.expiresTurn || 0,
          linkedClasses: Array.isArray(goal.linkedClasses) ? goal.linkedClasses.slice() : [],
          sourceClass: goal.sourceClass || '',
          relationEvidence: Array.isArray(goal.relationEvidence) ? goal.relationEvidence.map(_ty3_clone) : []
        };
      }).filter(function(goal) { return !!goal.text; });
    } catch (_pgE) {
      try { window.TM && TM.errors && TM.errors.captureSilent(_pgE, 'tinyi-party-goal-entries'); } catch (_) {}
    }
  }
  var fields = [
    { key: 'currentAgenda', kind: 'currentAgenda' },
    { key: 'shortGoal', kind: 'shortGoal' }
  ];
  var seen = {};
  var out = [];
  fields.forEach(function(field) {
    _ty3_toTinyiArray(p[field.key]).forEach(function(item) {
      var text = _ty3_topicText(item, 42);
      var sig = text.toLowerCase();
      if (!text || seen[sig]) return;
      seen[sig] = true;
      out.push({ kind: field.kind, text: text, raw: item, sourceClass: '', relationEvidence: [] });
    });
  });
  return out;
}

function _ty3_textIncludesGoal(topicText, goalText) {
  var topic = String(topicText || '').toLowerCase();
  var goal = String(goalText || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!topic || !goal) return false;
  if (topic.indexOf(goal) >= 0) return true;
  var words = goal.split(/\s+/).filter(function(w) { return w && w.length > 1; });
  return words.length >= 2 && words.every(function(w) { return topic.indexOf(w) >= 0; });
}

function _ty3_uniquePushName(list, name) {
  name = String(name || '').trim();
  if (!name || list.indexOf(name) >= 0) return;
  list.push(name);
}

function _ty3_uniquePushEvidence(list, evidence) {
  if (!evidence) return;
  var item = _ty3_clone(evidence);
  var sig = JSON.stringify(item || {});
  if (!list.some(function(existing) { return JSON.stringify(existing || {}) === sig; })) list.push(item);
}

function _ty3_currentScenarioId() {
  var s = (typeof GM !== 'undefined' && GM && (GM.scenario || GM.scriptData)) || (typeof P !== 'undefined' && P && P.scenario) || {};
  return String((typeof GM !== 'undefined' && GM && (GM.scenarioId || GM.sid)) || s.id || s.sid || s.name || '');
}

function _ty3_topicOrigin(sourceType, sourceId, sourceName) {
  return {
    scenarioId: _ty3_currentScenarioId(),
    sourceType: sourceType || '',
    sourceId: sourceId || '',
    sourceName: sourceName || ''
  };
}

function _ty3_relationEvidenceFor(partyName, classNames) {
  var out = [];
  var names = _ty3_toTinyiArray(classNames).map(function(v) { return String(v || '').trim(); }).filter(Boolean);
  try {
    if (typeof TM !== 'undefined' && TM.PartyGoals && typeof TM.PartyGoals.buildScenarioRelationIndex === 'function') {
      TM.PartyGoals.buildScenarioRelationIndex(GM, { turn: GM.turn || 0, source: 'tinyi-relation-evidence' });
    }
  } catch (_relBuildE) {
    try { window.TM && TM.errors && TM.errors.captureSilent(_relBuildE, 'tinyi-relation-evidence-build'); } catch (_) {}
  }
  var index = (typeof GM !== 'undefined' && GM && GM._partyGoalRelationIndex) || {};
  _ty3_toTinyiArray(index.evidence).forEach(function(e) {
    if (!e) return;
    if (partyName && e.partyName !== partyName) return;
    if (names.length && names.indexOf(e.className) < 0) return;
    _ty3_uniquePushEvidence(out, e);
  });
  if (out.length === 0 && partyName && names.length) {
    var party = _ty3_getPartyObj(partyName);
    _ty3_toTinyiArray(party && (party.socialBase || party.social_base || party.baseClasses)).forEach(function(entry) {
      var className = typeof entry === 'string' ? entry : (entry && (entry.class || entry.className || entry.name));
      className = String(className || '').trim();
      if (className && names.indexOf(className) >= 0) {
        _ty3_uniquePushEvidence(out, { className: className, partyName: partyName, source: 'party-socialBase', detail: className });
      }
    });
    _ty3_getScenarioClasses().forEach(function(cls) {
      var className = cls && (cls.name || cls.className);
      className = String(className || '').trim();
      if (!className || names.indexOf(className) < 0) return;
      _ty3_toTinyiArray(cls.supportingParties || cls.supporting_parties).forEach(function(entry) {
        if (_ty3_partyNameFromSupportEntry(entry) === partyName) {
          _ty3_uniquePushEvidence(out, { className: className, partyName: partyName, source: 'class-supportingParties', detail: partyName });
        }
      });
    });
  }
  return out;
}

function _ty3_partyNameFromSupportEntry(entry) {
  if (typeof entry === 'string') return entry.trim();
  if (!entry || typeof entry !== 'object') return '';
  return String(entry.party || entry.partyName || entry.name || entry.target || entry.class || '').trim();
}

function _ty3_supportingClassNamesForParty(partyName, partyObj) {
  var out = [];
  var pName = String(partyName || '').trim();
  _ty3_toTinyiArray((partyObj && (partyObj.socialBase || partyObj.social_base || partyObj.baseClasses)) || []).forEach(function(entry) {
    if (typeof entry === 'string') {
      _ty3_uniquePushName(out, entry);
      return;
    }
    if (!entry || typeof entry !== 'object') return;
    var affinity = entry.affinity == null ? 0 : Number(entry.affinity);
    if (!isNaN(affinity) && affinity < 0) return;
    _ty3_uniquePushName(out, entry.class || entry.className || entry.name);
  });
  _ty3_getScenarioClasses().forEach(function(cls) {
    if (!cls) return;
    _ty3_toTinyiArray(cls.supportingParties || cls.supporting_parties).forEach(function(entry) {
      var pn = _ty3_partyNameFromSupportEntry(entry);
      if (pn && pn === pName) _ty3_uniquePushName(out, cls.name || cls.className);
    });
  });
  return out;
}

function _ty3_supportingPartyNamesForClass(cls) {
  var out = [];
  _ty3_toTinyiArray(cls && (cls.supportingParties || cls.supporting_parties)).forEach(function(entry) {
    _ty3_uniquePushName(out, _ty3_partyNameFromSupportEntry(entry));
  });
  return out;
}

function _ty3_classDemandText(cls) {
  if (!cls) return '';
  var sources = [cls.demands, cls.currentDemand, cls.currentAgenda, cls.shortGoal];
  for (var i = 0; i < sources.length; i++) {
    var arr = _ty3_toTinyiArray(sources[i]);
    for (var j = 0; j < arr.length; j++) {
      var text = _ty3_topicText(arr[j], 42);
      if (text) return text;
    }
  }
  return '';
}

function _ty3_classPressureEntry(cls) {
  if (!cls) return null;
  var demandText = _ty3_classDemandText(cls);
  if (!demandText) return null;
  var levels = cls.unrestLevels || {};
  var sat = _ty3_numberOr(cls.satisfaction, 50);
  var grievance = _ty3_numberOr(levels.grievance, 60);
  var petition = _ty3_numberOr(levels.petition, 70);
  var strike = _ty3_numberOr(levels.strike, 80);
  var revolt = _ty3_numberOr(levels.revolt, 90);
  var pressure = sat <= 45 || grievance <= 45 || petition <= 45 || strike <= 35 || revolt <= 35;
  if (!pressure) return null;
  return {
    demandText: demandText,
    satisfaction: sat,
    unrestLevels: { grievance: grievance, petition: petition, strike: strike, revolt: revolt }
  };
}

function _ty3_pickClassProposer(cls) {
  if (!cls) return null;
  var refs = _ty3_toTinyiArray(cls.leaders).concat(_ty3_toTinyiArray(cls.representativeNpcs));
  for (var i = 0; i < refs.length; i++) {
    var ref = refs[i];
    var name = typeof ref === 'string' ? ref : (ref && ref.name);
    var ch = name && (typeof findCharByName === 'function') ? findCharByName(name) : null;
    if (ch && ch.alive !== false) return ch;
    if (ref && typeof ref === 'object' && ref.name && ref.alive !== false) return ref;
  }
  return _ty3_pickProposer({ fallbackTitle: '\u6237\u90e8|\u6c11\u653f|\u5fa1\u53f2|\u90fd\u5bdf|minister|censor' });
}

function _ty3_isInactivePartyStatus(status) {
  var s = String(status || '').trim();
  return !!s && /dissolved|disbanded|dead|inactive|\u6e6e\u706d|\u5df2\u89e3\u6563|\u89e3\u6563|\u8986\u706d|\u706d\u4ea1|\u6d88\u4ea1|\u5e9f\u6b62/i.test(s);
}

function _ty3_recordPartyGoalOutcome(meta, status, ctx, seal) {
  meta = meta || {};
  if (meta.sourceType !== 'party_goal' && meta.from !== 'ty3-spawn-party-goal') return null;
  var partyName = meta.party || meta.proposerParty || (ctx && ctx.opts && ctx.opts.proposerParty) || (seal && seal.sourceParty) || '';
  if (typeof TM !== 'undefined' && TM.PartyGoals && typeof TM.PartyGoals.resolveGoal === 'function') {
    try {
      var resolved = TM.PartyGoals.resolveGoal(GM, partyName, meta.goalId || meta.goalText || meta.topic, {
        source: 'tinyi-party-goal',
        sealStatus: status,
        outcome: status === 'blocked' ? 'blocked' : 'issued',
        grade: (seal && seal.grade) || (ctx && ctx.grade) || '',
        topic: (seal && seal.topic) || meta.topic || '',
        goalText: meta.goalText || '',
        goalKind: meta.goalKind || '',
        chaoyiTrackId: (seal && seal.chaoyiTrackId) || (ctx && ctx.opts && ctx.opts.chaoyiTrackId) || ''
      }, { turn: GM.turn || 0, source: 'tinyi-party-goal' });
      if (resolved && resolved.historyEntry) return resolved.historyEntry;
    } catch (_pgResolveE) {
      try { window.TM && TM.errors && TM.errors.captureSilent(_pgResolveE, 'tinyi-party-goal-resolve'); } catch (_) {}
    }
  }
  var p = _ty3_getPartyObj(partyName);
  if (!p) return null;
  if (!Array.isArray(p.agenda_history)) p.agenda_history = [];
  var outcome = status === 'blocked' ? 'blocked' : (status === 'reissued' ? 'reissued' : 'issued');
  var entry = {
    turn: GM.turn || 0,
    source: 'tinyi-party-goal',
    topic: (seal && seal.topic) || meta.topic || '',
    party: p.name || partyName,
    goalText: meta.goalText || meta.goal || _ty3_topicText(meta, 42),
    goalKind: meta.goalKind || '',
    sealStatus: status,
    outcome: outcome,
    grade: (seal && seal.grade) || (ctx && ctx.grade) || '',
    chaoyiTrackId: (seal && seal.chaoyiTrackId) || (ctx && ctx.opts && ctx.opts.chaoyiTrackId) || ''
  };
  p.agenda_history.push(entry);
  if (p.agenda_history.length > 20) p.agenda_history = p.agenda_history.slice(-20);
  p.lastTinyiGoalOutcome = Object.assign({}, entry);
  p._lastGoalTinyiOutcomeTurn = entry.turn;
  return entry;
}

function _ty3_pushPendingTinyiTopic(topicObj, keyword, spawned) {
  if (!topicObj || !topicObj.topic) return false;
  if (_ty3_alreadyHasTopic(keyword || topicObj.topic)) return false;
  topicObj.topicDisplay = _ty3_topicDisplayText(topicObj);
  if (topicObj.goalText && !topicObj.goalTextDisplay) topicObj.goalTextDisplay = _ty3_localizeCourtTopicText(topicObj.goalText);
  if (topicObj.demandText && !topicObj.demandTextDisplay) topicObj.demandTextDisplay = _ty3_localizeCourtTopicText(topicObj.demandText);
  // 议题保鲜（2026-07-03）：scan 议题此前不设 expiresAt→永不过期·池只进不出。
  // 统一给 10 回合寿限（到期走 _ty3_checkExpiredTopics 留中/再提），池封顶 24 淘最老。
  if (!topicObj.expiresAt) topicObj.expiresAt = (GM.turn || 0) + 10;
  GM._pendingTinyiTopics.push(topicObj);
  if (GM._pendingTinyiTopics.length > 24) GM._pendingTinyiTopics = GM._pendingTinyiTopics.slice(-24);
  if (Array.isArray(spawned)) spawned.push(topicObj.topicDisplay || topicObj.topic);
  return true;
}

// 薄分支冷却（2026-07-03）：调停党争/民心低迷/国帑亏空这类「条件持续成立」的议题·
// 被玩家消费出池后下回合即再刷——补 per-key 冷却（成功入池才盖戳）。
function _ty3_spawnCooldownReady(key, turns) {
  if (!GM._ty3_spawnCooldowns) GM._ty3_spawnCooldowns = {};
  var last = parseInt(GM._ty3_spawnCooldowns[key], 10) || 0;
  var now = GM.turn || 0;
  return !last || (now - last) >= (turns || 4);
}
function _ty3_spawnCooldownStamp(key) {
  if (!GM._ty3_spawnCooldowns) GM._ty3_spawnCooldowns = {};
  GM._ty3_spawnCooldowns[key] = GM.turn || 0;
}

function _ty3_phase15_scanAndSpawnTopics() {
  if (!Array.isArray(GM._pendingTinyiTopics)) GM._pendingTinyiTopics = [];
  var spawned = [];
  try {
    if (typeof TM !== 'undefined' && TM.PartyGoals && typeof TM.PartyGoals.deriveFromClassDemands === 'function') {
      TM.PartyGoals.deriveFromClassDemands(GM, { turn: GM.turn || 0, source: 'tinyi-phase15-class-demand' });
    }
  } catch (_pgDeriveE) {
    try { window.TM && TM.errors && TM.errors.captureSilent(_pgDeriveE, 'tinyi-phase15-class-demand'); } catch (_) {}
  }
  if (typeof GM.partyStrife === 'number' && GM.partyStrife >= 70 && _ty3_spawnCooldownReady('party-strife', 4)) {
    var prop1 = _ty3_pickProposer({ fallbackTitle: '\u5FA1\u53F2|\u90FD\u5BDF|\u8A00\u5B98|censor' });
    var t1 = { topic: '\u8C03\u505C\u515A\u4E89\u00B7\u6050\u751F\u5927\u53D8', from: 'ty3-spawn-party-strife', turn: GM.turn, severity: GM.partyStrife };
    _ty3_attachProposer(t1, prop1, '\u515A\u4E89\u5DF2\u70BD\u00B7\u9700\u5148\u8BAE\u7EA6\u675F');
    if (_ty3_pushPendingTinyiTopic(t1, '\u8C03\u505C\u515A\u4E89', spawned)) _ty3_spawnCooldownStamp('party-strife');
  }
  _ty3_getParties().forEach(function(p) {
    if (!p || _ty3_isInactivePartyStatus(p.status)) return;
    var coh = parseInt(p.cohesion, 10) || 50;
    var leader = (typeof _ty3_getPartyLeader === 'function') ? _ty3_getPartyLeader(p.name) : null;
    if (coh < 10) {
      var t2 = { topic: p.name + '\u5206\u5316\u00B7\u8BAE\u5B9A\u5584\u540E', from: 'ty3-spawn-party-collapse', turn: GM.turn, party: p.name, cohesion: coh };
      if (leader) _ty3_attachProposer(t2, leader, '\u515A\u5185\u51DD\u805A\u5DF2\u8FD1\u6E83\u6563');
      _ty3_pushPendingTinyiTopic(t2, p.name + '\u5206\u5316', spawned);
    }
    var disputes = Array.isArray(p.focal_disputes) ? p.focal_disputes : (Array.isArray(p.focalDisputes) ? p.focalDisputes : []);
    if (disputes.length > 0) {
      var disputeText = _ty3_topicText(disputes[0], 28);
      if (disputeText) {
        var t5 = { topic: '\u6E05\u8BAE\u00B7' + disputeText + '\u00B7\u4E24\u9020\u4E0D\u4E0B', from: 'ty3-spawn-party-focal-dispute', turn: GM.turn, party: p.name };
        if (leader) _ty3_attachProposer(t5, leader, '\u515A\u5185\u70ED\u8BAE\u5DF2\u5165\u671D\u5802');
        _ty3_pushPendingTinyiTopic(t5, disputeText, spawned);
      }
    }
    var goalEntries = _ty3_partyGoalEntries(p);
    if (goalEntries.length > 0) {
      var goalEntry = goalEntries[0];
      var goalTurn = GM.turn || 0;
      var lastGoalTurn = parseInt(p._lastGoalTinyiTurn, 10) || 0;
      if (!lastGoalTurn || goalTurn - lastGoalTurn >= 3) {
        var opponents = _ty3_normalizePartyNames([p.rivalParty, p.rival].concat(p.enemies || []).concat(p.rivals || []));
        var supportingClasses = _ty3_supportingClassNamesForParty(p.name, p);
        (goalEntry.linkedClasses || []).forEach(function(className) { _ty3_uniquePushName(supportingClasses, className); });
        var relationEvidence = _ty3_relationEvidenceFor(p.name, supportingClasses);
        (goalEntry.relationEvidence || []).forEach(function(e) { _ty3_uniquePushEvidence(relationEvidence, e); });
        var tGoal = {
          topic: '\u515A\u8BAE\u00B7' + p.name + '\u00B7' + goalEntry.text + '\u00B7\u8BF7\u4ED8\u5EF7\u8BAE',
          from: 'ty3-spawn-party-goal',
          sourceType: 'party_goal',
          turn: GM.turn,
          party: p.name,
          goalId: goalEntry.id || '',
          goalText: goalEntry.text,
          goalKind: goalEntry.kind,
          goalPriority: goalEntry.priority || 0,
          expiresTurn: goalEntry.expiresTurn || 0,
          sourceClass: goalEntry.sourceClass || '',
          origin: _ty3_topicOrigin('party_goal', goalEntry.id || (p.name + ':' + goalEntry.text), p.name),
          relationEvidence: relationEvidence,
          supportingClasses: supportingClasses,
          opposingParties: opponents
        };
        if (leader) _ty3_attachProposer(tGoal, leader, '\u672C\u515A\u8FD1\u671F\u76EE\u6807\u5DF2\u9700\u4ED8\u5EF7\u8BAE\u5B9A\u8BAE');
        if (_ty3_pushPendingTinyiTopic(tGoal, p.name + '\u00B7' + goalEntry.text, spawned)) p._lastGoalTinyiTurn = goalTurn;
      }
    }
  });
  _ty3_getScenarioClasses().forEach(function(cls) {
    if (!cls) return;
    var pressure = _ty3_classPressureEntry(cls);
    if (!pressure) return;
    var classTurn = GM.turn || 0;
    var lastClassTurn = parseInt(cls._lastPressureTinyiTurn, 10) || 0;
    if (lastClassTurn && classTurn - lastClassTurn < 3) return;
    var className = cls.name || cls.className || '';
    var classSupportingParties = _ty3_supportingPartyNamesForClass(cls);
    var t4 = {
      topic: '\u6C11\u60C5\u00B7' + className + '\u00B7' + pressure.demandText + '\u00B7\u8BF7\u4ED8\u5EF7\u8BAE',
      from: 'ty3-spawn-class-pressure',
      sourceType: 'class_pressure',
      turn: GM.turn,
      className: className,
      sourceClass: className,
      demandText: pressure.demandText,
      satisfaction: pressure.satisfaction,
      unrestLevels: pressure.unrestLevels,
      origin: _ty3_topicOrigin('class_pressure', className, className),
      relationEvidence: _ty3_relationEvidenceFor('', [className]),
      supportingParties: classSupportingParties
    };
    _ty3_attachProposer(t4, _ty3_pickClassProposer(cls), '\u9636\u5C42\u8BC9\u6C42\u4E0E\u6C11\u60C5\u538B\u529B\u5DF2\u4E0A\u8FBE');
    if (_ty3_pushPendingTinyiTopic(t4, className + '\u00B7' + pressure.demandText, spawned)) cls._lastPressureTinyiTurn = classTurn;
  });
  // \u653F\u6CBB\u8FD0\u52A8\u4ED8\u5EF7\u8BAE\uFF08V3\u5F0F\u00B7SocialFoundation \u00A7\u4E09E \u6D88\u8D39\u7AEF\u00B72026-07-03\uFF09\uFF1A\u6210\u52BF/\u9F0E\u6CB8\u4E4B\u8FD0\u52A8\u9876\u4E0A\u671D\u5802\u2014\u2014
  // \u5E26\u5168\u5957\u9636\u5C42 meta\uFF08\u53D1\u8A00\u6CE8\u5165/\u7ACB\u573A\u5148\u9A8C/\u843D\u8D26\u90FD\u5403\u5F97\u5230\uFF09\u00B7per-\u8FD0\u52A8 3 \u56DE\u5408\u51B7\u5374
  if (Array.isArray(GM._politicalMovements)) {
    GM._politicalMovements.forEach(function(mv) {
      if (!mv || !(Number(mv.support) >= 40)) return;
      var mvTurn = GM.turn || 0;
      var lastMvTurn = parseInt(mv._lastTinyiTurn, 10) || 0;
      if (lastMvTurn && mvTurn - lastMvTurn < 3) return;
      var mvCls = _ty3_getScenarioClasses().find(function(c) { return c && (c.name === mv.className || c.className === mv.className); });
      var tM = {
        topic: '\u6C11\u60C5\u6C79\u6C79\u00B7' + mv.className + '\u00B7' + mv.label + '\u00B7\u8BF7\u4ED8\u5EF7\u8BAE',
        from: 'ty3-spawn-movement',
        sourceType: 'movement',
        turn: GM.turn,
        className: mv.className,
        sourceClass: mv.className,
        demandText: mv.label,
        movementKey: mv.key,
        movementSupport: mv.support,
        movementPhase: mv.phase,
        origin: _ty3_topicOrigin('movement', mv.key, mv.className),
        relationEvidence: _ty3_relationEvidenceFor('', [mv.className]),
        supportingParties: mvCls ? _ty3_supportingPartyNamesForClass(mvCls) : []
      };
      _ty3_attachProposer(tM, mvCls ? _ty3_pickClassProposer(mvCls) : _ty3_pickProposer({ fallbackTitle: '\u5FA1\u53F2|\u90FD\u5BDF|\u8A00\u5B98|censor' }), '\u6C11\u95F4\u8FD0\u52A8\u5DF2' + (mv.phase || '\u6210\u52BF') + '\u00B7\u6050\u917F\u4E8B\u7AEF');
      if (_ty3_pushPendingTinyiTopic(tM, mv.className + '\u00B7' + mv.label, spawned)) mv._lastTinyiTurn = mvTurn;
    });
  }
  var minXin = (typeof GM.minxin === 'number') ? GM.minxin :
    (GM.minxin && (typeof GM.minxin.trueIndex === 'number' ? GM.minxin.trueIndex : GM.minxin.value));
  if (typeof minXin === 'number' && minXin <= 30 && _ty3_spawnCooldownReady('popular-unrest', 4)) {
    var prop3 = _ty3_pickProposer({ fallbackTitle: '\u6237\u90E8|\u6C11\u653F|censor' });
    var t3 = { topic: '\u6C11\u5FC3\u4F4E\u8FF7\u00B7\u8BAE\u8D48\u6D4E\u4E0E\u5B89\u629A', from: 'ty3-spawn-popular-unrest', turn: GM.turn, minxin: minXin };
    _ty3_attachProposer(t3, prop3, '\u5730\u65B9\u544A\u6025\u00B7\u5B98\u6C11\u76F8\u7591');
    if (_ty3_pushPendingTinyiTopic(t3, '\u6C11\u5FC3\u4F4E\u8FF7', spawned)) _ty3_spawnCooldownStamp('popular-unrest');
  }
  var fiscal = GM.fiscal || GM.economy;
  var deficit = false;
  if (fiscal && typeof fiscal.deficitRatio === 'number' && fiscal.deficitRatio >= 0.3) deficit = true;
  if (GM.tanglian && typeof GM.tanglian.silver === 'number' && GM.tanglian.silver < 0) deficit = true;
  if (deficit && _ty3_spawnCooldownReady('fiscal-deficit', 4)) {
    var prop6 = _ty3_pickProposer({ fallbackTitle: '\u6237\u90E8|\u8D22\u653F|censor' });
    var t6 = { topic: '\u56FD\u5E11\u4E8F\u7A7A\u00B7\u8BAE\u589E\u6536\u8282\u7528', from: 'ty3-spawn-fiscal', turn: GM.turn };
    _ty3_attachProposer(t6, prop6, '\u56FD\u5E11\u627F\u538B\u5DF2\u9AD8');
    if (_ty3_pushPendingTinyiTopic(t6, '\u56FD\u5E11\u4E8F\u7A7A', spawned)) _ty3_spawnCooldownStamp('fiscal-deficit');
  }
  var censorTarget = (GM.chars || []).filter(function(c) {
    if (!c || c.alive === false || c.isPlayer) return false;
    if ((c.prestige || 0) < 80) return false;
    if (!c.party) return true;
    var po = _ty3_getPartyObj(c.party);
    return po && (parseInt(po.cohesion, 10) || 50) < 30;
  }).sort(function(a, b) { return (b.prestige || 0) - (a.prestige || 0); })[0];
  if (censorTarget) {
    var prop7 = _ty3_pickProposer({ titleRegex: /\u5FA1\u53F2|\u90FD\u5BDF|\u8A00\u5B98|censor/i });
    var topic7 = '\u5F39\u52BE\u00B7' + censorTarget.name + '\u00B7\u6050\u6709\u7ED3\u515A\u4E4B\u5ACC';
    var meta7 = null;
    try {
      if (typeof _ty3_buildImpeachmentTopicMeta === 'function') {
        meta7 = _ty3_buildImpeachmentTopicMeta(prop7 ? prop7.name : '', prop7, censorTarget, topic7);
      }
    } catch (_meta7E) {}
    var t7 = { topic: topic7, from: 'ty3-spawn-censor-impeach-party', turn: GM.turn, accused: censorTarget.name, accusedParty: censorTarget.party || '', meta: meta7 || null };
    if (meta7 && typeof _ty3_buildAccusationMemorialStructured === 'function') {
      try { t7.memorial = _ty3_buildAccusationMemorialStructured(meta7.accuser || (prop7 && prop7.name) || '', prop7, censorTarget, meta7); } catch (_mem7E) {}
    }
    _ty3_attachProposer(t7, prop7 || censorTarget, '\u58F0\u671B\u8FC7\u9AD8\u800C\u515A\u52BF\u5931\u8861');
    _ty3_pushPendingTinyiTopic(t7, censorTarget.name + '\u00B7\u6050\u6709\u7ED3\u515A', spawned);
  }
  var issueList = Array.isArray(GM.currentIssues) ? GM.currentIssues.slice() : [];
  if (GM.currentIssues && !Array.isArray(GM.currentIssues) && typeof GM.currentIssues === 'object') {
    Object.keys(GM.currentIssues).forEach(function(k) { issueList.push(GM.currentIssues[k]); });
  }
  var issue = issueList.map(function(x) { return _ty3_topicText(x, 32); }).find(function(txt) {
    return /\u707E|\u8FB9|\u9977|\u76D0|\u6F15|\u7586|\u6C34|\u65F1|\u4E71|war|border|disaster|flood|drought|tax|grain|treasury|reform|uprising|bandit/i.test(txt);
  });
  if (issue) {
    var prop8 = _ty3_pickProposer({ fallbackTitle: '\u5185\u9601|\u519B\u673A|\u6237\u90E8|\u5175\u90E8|minister' });
    var t8 = { topic: '\u5FA1\u6848\u65F6\u653F\u00B7' + issue + '\u00B7\u8BF7\u4ED8\u5EF7\u8BAE', from: 'ty3-spawn-current-issue', turn: GM.turn };
    _ty3_attachProposer(t8, prop8, '\u65F6\u653F\u538B\u529B\u5DF2\u4E0A\u8FBE');
    _ty3_pushPendingTinyiTopic(t8, issue, spawned);
  }
  var evt = (GM.evtLog || []).map(function(x) { return _ty3_topicText(x, 30); }).find(function(txt) {
    return /\u707E|\u8FB9|\u9965|\u75AB|\u4E71|\u8B66|flood|drought|plague|border|bandit|riot|disaster/i.test(txt);
  });
  if (evt) {
    var isBorder = /\u8FB9|\u8B66|border/i.test(evt);
    var t9 = { topic: (isBorder ? '\u8FB9\u62A5\u5165\u95FB\u00B7' : '\u707E\u5F02\u5165\u95FB\u00B7') + evt + '\u00B7\u8BF7\u8BAE\u5E94\u5BF9', from: 'ty3-spawn-event-log', turn: GM.turn };
    _ty3_attachProposer(t9, _ty3_pickProposer({ fallbackTitle: '\u5175\u90E8|\u6237\u90E8|\u5DE1\u629A|minister' }), '\u63A8\u6F14\u4E8B\u4EF6\u5165\u95FB');
    _ty3_pushPendingTinyiTopic(t9, evt, spawned);
  }
  return spawned;
}

function _ty3_tickChronicleTracks() {
  if (typeof ChronicleTracker === 'undefined') return;
  if (!Array.isArray(GM._chronicleTracks)) return;
  GM._chronicleTracks.forEach(function(t) {
    if (!t || t.status !== 'active') return;
    if (t.sourceType !== 'changchao') return;
    try {
      if (typeof ChronicleTracker.applyPerTurnEffect === 'function') {
        var perTurnNarr = ChronicleTracker.applyPerTurnEffect(t);
        if (perTurnNarr) {
          if (!Array.isArray(GM._chronicleTickNarratives)) GM._chronicleTickNarratives = [];
          GM._chronicleTickNarratives.push({ turn: GM.turn, trackId: t.id, title: t.title, short: t.shortTermBalance, long: t.longTermBalance, narrative: perTurnNarr });
          if (GM._chronicleTickNarratives.length > 30) GM._chronicleTickNarratives = GM._chronicleTickNarratives.slice(-30);
        }
      }
    } catch (_pteE) {}
    var startTurn = t.startTurn || GM.turn;
    var expectedEnd = t.expectedEndTurn || (startTurn + ((typeof turnsForMonths === 'function') ? turnsForMonths(12) : 12));
    var totalTurns = Math.max(1, expectedEnd - startTurn);
    var elapsed = (GM.turn || startTurn) - startTurn;
    var naturalProgress = Math.min(99, Math.round(elapsed / totalTurns * 90) + 5);
    if (naturalProgress > (t.progress || 0)) {
      var newStage = t.currentStage;
      if (naturalProgress >= 80 && t.currentStage !== '\u9A8C\u6536\u5F85\u590D' && t.currentStage !== 'completed') newStage = '\u9A8C\u6536\u5F85\u590D';
      else if (naturalProgress >= 50 && (t.currentStage === 'started' || t.currentStage === '\u9881\u8BCF\u8D77\u624B' || !t.currentStage)) newStage = '\u63A8\u884C\u5DF2\u534A';
      else if (naturalProgress >= 20 && !t.currentStage) newStage = '\u6267\u884C\u4E2D';
      else if (!t.currentStage) newStage = '\u9881\u8BCF\u8D77\u624B';
      ChronicleTracker.update(t.id, { progress: naturalProgress, currentStage: newStage, stageNote: newStage !== t.currentStage ? 'turn ' + GM.turn + ' natural progress' : '' });
      if (naturalProgress >= 95 && !t._verifyPrompted) {
        t._verifyPrompted = true;
        if (!Array.isArray(GM._pendingTinyiTopics)) GM._pendingTinyiTopics = [];
        var verifyTopic = '\u8BAE\u590D\u00B7' + String(t.title || t.sourceId || t.id || '\u5E38\u671D\u4E8B').slice(0, 32) + '\u00B7\u5C06\u7AE3\u00B7\u9A8C\u6536\u8BAE\u5904';
        var verifyItem = { topic: verifyTopic, from: 'ty3-spawn-changchao-verify', turn: GM.turn, trackId: t.id, sourceType: 'changchao' };
        _ty3_pushPendingTinyiTopic(verifyItem, String(t.id || verifyTopic), []);
        try {
          if (typeof addEB === 'function') addEB('\u7F16\u5E74', '\u3010\u53EF\u8BAE\u9A8C\u6536\u3011' + verifyTopic);
        } catch (_verifyEbE) {}
      }
      if (naturalProgress >= 99 && t.progress < 100) {
        try { ChronicleTracker.complete(t.id, 'completed'); } catch (_compE) {}
      }
    }
  });
}
(function _ty3_installEndTurnHooks() {
  if (typeof window === 'undefined') return;
  var attempts = 0;
  function tryRegister() {
    if (attempts++ > 30) return;
    if (typeof window.EndTurnHooks === 'undefined' || typeof window.EndTurnHooks.register !== 'function') {
      setTimeout(tryRegister, 200);
      return;
    }
    if (window._ty3_endTurnHooksRegistered) return;
// before·扫描 spawn 议 + 追责回响(放 before·让 AI 推演读得到)
    EndTurnHooks.register('before', function() {
      try { _ty3_phase15_scanAndSpawnTopics(); } catch(e){ try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tinyi-v3路spawn');}catch(_){} }
      try { _ty3_phase7_runReview(); } catch(e){ try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tinyi-v3路review');}catch(_){} }
    }, 'ty3路before-prep');
    // after·党派演化 + 威权阶梯 + 廷议长期工程进度推进
    EndTurnHooks.register('after', function() {
      try { _ty3_partyEvolutionTick(); } catch(e){ try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tinyi-v3路evolution');}catch(_){} }
      try { if (window.TM && TM.InfluenceGroups && typeof TM.InfluenceGroups.evolutionTick === 'function') TM.InfluenceGroups.evolutionTick(GM, { turn: GM.turn, source: 'ty3-after-evolution' }); } catch(e){ try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tinyi-v3路influence-evolution');}catch(_){} }
      try { _ty3_tickRegaliaStreaks(); } catch(e){ try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tinyi-v3路streaks');}catch(_){} }
      try { _ty3_tickChronicleTracks(); } catch(e){ try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tinyi-v3路tracks');}catch(_){} }
      // Clear prompt queue after AI has read it.
      GM._ty3_pendingReviewForPrompt = [];
    }, 'ty3路after-evolution');
    window._ty3_endTurnHooksRegistered = true;
  }
  tryRegister();
})();

// Expose wave 4 APIs.
if (typeof window !== 'undefined') {
  window._ty3_phase7_runReview = _ty3_phase7_runReview;
  window._ty3_phase7_runFollowUpQueue = _ty3_phase7_runFollowUpQueue;
  window._ty3_phase14_recordChaoyiSummary = _ty3_phase14_recordChaoyiSummary;
  window._ty3_phase15_scanAndSpawnTopics = _ty3_phase15_scanAndSpawnTopics;
}
