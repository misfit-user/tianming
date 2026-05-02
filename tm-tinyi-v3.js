// @ts-nocheck
'use strict';

/* ═══════════════════════════════════════════════════════════════════════
 *  tm-tinyi-v3.js — 廷议 V3·七阶段重构（波 1）
 *
 *  阶段：
 *    [波 1] §3  阶段 0 议前预审   (留中 / 私决 / 下议 / 明发)
 *    [波 2] §-  阶段 1 起议站班   (三班布局 + 潮汐条)
 *    [波 2] §-  阶段 2 分轮辩议   (主奏 / 同党附议 / 敌党驳议 / 中立权衡)
 *    [波 3] §-  阶段 3 廷推       (人事议题·钦定 / 廷推 / 暂阙)
 *    [波 1] §4  阶段 4 钦定档位   (S/A/B/C/D 流程级特权)
 *    [波 2] §-  阶段 5 草诏拟旨   (选官 + prestige/favor 反馈)
 *    [波 3] §-  阶段 6 用印颁行   (朝代差异化 + 党派阻挠)
 *    [波 4] §-  阶段 7 追责回响   (N 回合后强制复盘)
 *
 *  跨阶段：
 *    [波 1] §1  党派访问层   (GM.parties 动态层封装·剧本 + 运行时合并)
 *    [波 1] §2  实时插言     (5 选项浮层·任意时刻打断 AI 流式输出)
 *    [波 1] §5  威权阶梯     (GM.unlockedRegalia[] 永久解锁)
 *    [波 1] §6  入口路由     (_cy_pickMode 'tinyi' → _ty3_open)
 *
 *  数据契约：
 *    GM.parties[]              — 运行时党派(剧本初始化时从 P.parties copy)
 *    GM.unlockedRegalia[]      — 永久威权特权清单·跨场廷议保留
 *    GM._ccHeldItems[]         — 留中册(议前预审「留中」写入·已存在)
 *    GM._pendingTinyiTopics[]  — 待议册(已存在·议前预审「明发」从此读取)
 *    CY._ty3                   — 廷议会话状态(替代 CY._ty2 的 v3 子集)
 *    CY._ty3_archonGrade       — 当前档位(S/A/B/C/D)
 *
 *  入口：_ty3_open(seedTopic)
 *    seedTopic 可来自 GM._pendingTinyiTopics·或玩家手动新议题
 * ═══════════════════════════════════════════════════════════════════════ */

// ─── CSS 自动加载（一次性） ───
(function _ty3_loadCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ty3-css')) return;
  var link = document.createElement('link');
  link.id = 'ty3-css';
  link.rel = 'stylesheet';
  link.href = 'tm-tinyi-v3.css?v=20260426y';
  document.head.appendChild(link);
})();

// ═══════════════════════════════════════════════════════════════════════
//  §1·党派访问层
// ═══════════════════════════════════════════════════════════════════════
// 设计原则：
//   - GM.parties[] 已在 tm-patches.js L1435 初始化(从 P.parties 按 sid 过滤)
//   - 推演阶段 tm-endturn-ai-infer.js 已支持 party_splinter / party_disband
//   - v3 不另设动态层·直接读 GM.parties·写也写到 GM.parties
//   - 运行时党派增删改全经此处·便于 §6 用印阻挠 / §7 追责 hook

function _ty3_getParties() {
  return Array.isArray(GM.parties) ? GM.parties : [];
}

function _ty3_getPartyObj(name) {
  if (!name) return null;
  return _ty3_getParties().find(function(p){ return p && p.name === name; }) || null;
}

function _ty3_getOpposingParties(partyName) {
  var p = _ty3_getPartyObj(partyName);
  if (!p || !Array.isArray(p.enemies)) return [];
  var ret = [];
  p.enemies.forEach(function(en) {
    var po = _ty3_getPartyObj(en);
    if (po) ret.push(po);
  });
  return ret;
}

function _ty3_getAlliedParties(partyName) {
  var p = _ty3_getPartyObj(partyName);
  if (!p || !Array.isArray(p.allies)) return [];
  var ret = [];
  p.allies.forEach(function(al) {
    var po = _ty3_getPartyObj(al);
    if (po) ret.push(po);
  });
  return ret;
}

// Party members from GM.chars plus party.members fallback.
function _ty3_getPartyMembers(partyName) {
  if (!partyName) return [];
  var byName = {};
  // 先从 GM.chars 抓所有 ch.party === partyName
  (GM.chars||[]).forEach(function(c) {
    if (c && c.party === partyName && c.alive !== false) byName[c.name] = c;
  });
  // Also parse party.members when a scenario stores members as a delimited string.
  var p = _ty3_getPartyObj(partyName);
  if (p && typeof p.members === 'string') {
    p.members.split(/[·、,，\s]+/).forEach(function(nm) {
      nm = (nm||'').trim();
      if (!nm || byName[nm]) return;
      var ch = (typeof findCharByName === 'function') ? findCharByName(nm) : null;
      if (ch && ch.alive !== false) byName[nm] = ch;
    });
  }
  return Object.values(byName);
}

// Party leader lookup.
function _ty3_getPartyLeader(partyName) {
  var p = _ty3_getPartyObj(partyName);
  if (!p) return null;
  var nm = p.leader || (p.leadership && p.leadership.chief) || '';
  if (!nm) return null;
  return (typeof findCharByName === 'function') ? findCharByName(nm) : null;
}

// Party influence, 0-100 with default 50.
function _ty3_partyInfluence(partyName) {
  var p = _ty3_getPartyObj(partyName);
  if (!p) return 0;
  return parseInt(p.influence, 10) || 50;
}

function _ty3_readEngineConstant(path, fallback) {
  try {
    if (typeof TM !== 'undefined' && TM && TM.EngineConstants && typeof TM.EngineConstants.read === 'function') {
      var v = TM.EngineConstants.read(path);
      return v === undefined ? fallback : v;
    }
    if (typeof EngineConstants !== 'undefined' && EngineConstants && typeof EngineConstants.read === 'function') {
      var v2 = EngineConstants.read(path);
      return v2 === undefined ? fallback : v2;
    }
  } catch(_){}
  return fallback;
}

function _ty3_clone(v) {
  if (v === undefined || v === null) return v;
  try { return JSON.parse(JSON.stringify(v)); } catch(_) { return v; }
}

function _ty3_getInquiryBodyCatalog() {
  var catalog = _ty3_readEngineConstant('inquiryBodyCatalog', null);
  return catalog && typeof catalog === 'object' ? catalog : {};
}

function _ty3_policySanctionByGrade(grade) {
  var table = _ty3_readEngineConstant('tinyiPolicySanctionByGrade', null);
  if (!table || typeof table !== 'object') table = { S: 16, A: 12, B: 9, C: 6, D: 3 };
  return table[grade] || table.C || 6;
}

function _ty3_getPartyStateWritable(partyName) {
  if (!partyName) return null;
  if (!GM.partyState || typeof GM.partyState !== 'object') GM.partyState = {};
  if (!GM.partyState[partyName] || typeof GM.partyState[partyName] !== 'object') {
    var po = _ty3_getPartyObj(partyName);
    GM.partyState[partyName] = {
      name: partyName,
      influence: po && typeof po.influence === 'number' ? po.influence : _ty3_partyInfluence(partyName),
      cohesion: po && typeof po.cohesion === 'number' ? po.cohesion : _ty3_partyCohesion(partyName),
      recentPolicyWin: 0,
      recentPolicyLose: 0
    };
  }
  var ps = GM.partyState[partyName];
  if (typeof ps.recentPolicyWin !== 'number') ps.recentPolicyWin = Number(ps.recentPolicyWin) || 0;
  if (typeof ps.recentPolicyLose !== 'number') ps.recentPolicyLose = Number(ps.recentPolicyLose) || 0;
  return ps;
}

function _ty3_syncPartyStateMirror(partyName) {
  var ps = partyName && GM.partyState && GM.partyState[partyName];
  var po = _ty3_getPartyObj(partyName);
  if (!ps || !po) return;
  if (typeof ps.influence === 'number') po.influence = Math.max(0, Math.min(100, ps.influence));
  if (typeof ps.cohesion === 'number') po.cohesion = Math.max(0, Math.min(100, ps.cohesion));
  if (typeof ps.satisfaction === 'number') po.satisfaction = Math.max(0, Math.min(100, ps.satisfaction));
}

function _ty3_normalizePartyNames(list) {
  if (!list) return [];
  if (typeof list === 'string') list = [list];
  if (!Array.isArray(list)) return [];
  var seen = {};
  var out = [];
  list.forEach(function(item) {
    var name = typeof item === 'string' ? item : (item && item.name);
    if (!name || seen[name]) return;
    seen[name] = true;
    out.push(name);
  });
  return out;
}

function _ty3_applyPolicyPartyResult(sourceParty, opposingParties, grade, mode, blockerParty) {
  var sanction = _ty3_policySanctionByGrade(grade);
  var source = sourceParty ? _ty3_getPartyStateWritable(sourceParty) : null;
  var opposers = _ty3_normalizePartyNames(opposingParties);
  var sourceWin = 0;
  var sourceLose = 0;
  var oppWin = 0;
  var oppLose = 0;

  if (mode === 'issued' || mode === 'grade_win') {
    sourceWin = sanction / (mode === 'grade_win' ? 8 : 4);
    oppLose = sanction / (mode === 'grade_win' ? 16 : 8);
  } else if (mode === 'blocked') {
    sourceLose = sanction / 4;
    oppWin = sanction / 4;
  } else if (mode === 'grade_loss') {
    sourceLose = sanction / 8;
    oppWin = sanction / 16;
  }

  if (source) {
    source.recentPolicyWin = Math.round((source.recentPolicyWin + sourceWin) * 100) / 100;
    source.recentPolicyLose = Math.round((source.recentPolicyLose + sourceLose) * 100) / 100;
    _ty3_syncPartyStateMirror(sourceParty);
  }
  if (blockerParty) opposers = _ty3_normalizePartyNames([blockerParty].concat(opposers));
  opposers.forEach(function(pn) {
    if (!pn || pn === sourceParty) return;
    var ps = _ty3_getPartyStateWritable(pn);
    if (!ps) return;
    ps.recentPolicyWin = Math.round((ps.recentPolicyWin + oppWin) * 100) / 100;
    ps.recentPolicyLose = Math.round((ps.recentPolicyLose + oppLose) * 100) / 100;
    _ty3_syncPartyStateMirror(pn);
  });
  return { sourceWin: sourceWin, sourceLose: sourceLose, opposingWin: oppWin, opposingLose: oppLose };
}

function _ty3_getPartyStateSnapshot(partyName) {
  if (!partyName || !GM.partyState || typeof GM.partyState !== 'object') return null;
  var ps = GM.partyState[partyName];
  return ps && typeof ps === 'object' ? ps : null;
}

function _ty3_partyMetrics(partyName) {
  var ps = _ty3_getPartyStateSnapshot(partyName);
  return {
    state: ps,
    influence: ps && typeof ps.influence === 'number' ? ps.influence : _ty3_partyInfluence(partyName),
    cohesion: ps && typeof ps.cohesion === 'number' ? ps.cohesion : _ty3_partyCohesion(partyName)
  };
}

function _ty3_pickInquiryBody(dynasty, accusedCh) {
  var catalog = _ty3_getInquiryBodyCatalog();
  var bucket = (dynasty && catalog[dynasty]) || catalog.default || {};
  var bodies = Array.isArray(bucket.bodies) ? bucket.bodies : (Array.isArray(bucket) ? bucket : []);
  var hay = ((accusedCh && (accusedCh.officialTitle || accusedCh.title)) || '') + ' ' + ((accusedCh && accusedCh.party) || '');
  var picked = bodies[0] || { id: 'censorate', name: 'censorate', dept: 'judicial', role: 'review', weight: 5, keywords: ['censorate'] };
  for (var i = 0; i < bodies.length; i++) {
    var body = bodies[i] || {};
    var keys = Array.isArray(body.keywords) ? body.keywords : [];
    if (keys.some(function(k){ return k && hay.indexOf(k) >= 0; })) {
      picked = body;
      break;
    }
  }
  return {
    id: picked.id || 'censorate',
    name: picked.name || 'censorate',
    dept: picked.dept || 'judicial',
    role: picked.role || 'review',
    weight: typeof picked.weight === 'number' ? picked.weight : 3,
    keywords: Array.isArray(picked.keywords) ? picked.keywords.slice() : []
  };
}

function _ty3_buildImpeachmentCharges(accusedCh, partyMetrics, topicText) {
  var charges = [];
  var seen = {};
  function add(name, severity, evidenceSource) {
    if (!name || seen[name]) return;
    seen[name] = true;
    charges.push({ name: name, severity: severity, evidenceSource: evidenceSource });
  }

  var source = (GM.corruption && GM.corruption.sources) || {};
  var perceived = GM.corruption && typeof GM.corruption.perceivedIndex === 'number' ? GM.corruption.perceivedIndex : 0;
  var targetParty = accusedCh && accusedCh.party ? accusedCh.party : '';
  var partyState = partyMetrics && partyMetrics.state ? partyMetrics.state : _ty3_getPartyStateSnapshot(targetParty);
  var title = ((accusedCh && (accusedCh.officialTitle || accusedCh.title)) || '') + ' ' + (topicText || '');

  if ((source.officeSelling || 0) >= 45 || (source.nepotism || 0) >= 40 || perceived >= 65) {
    add('\u5356\u5b98\u9b3b\u7235', 4, 'GM.corruption.sources.officeSelling/nepotism');
  }
  if ((source.lumpSumSpending || 0) >= 40 || (source.emergencyLevy || 0) >= 40) {
    add('侵蚀钱粮', 3, 'GM.corruption.sources.lumpSumSpending/emergencyLevy');
  }
  if ((source.military || 0) >= 45 || /military|army|兵|军/.test(title)) {
    add('\u519b\u653f\u5931\u5bdf', 3, 'GM.corruption.sources.military');
  }
  if ((partyState && (partyState.cohesion || 0) < 45) || targetParty) {
    add('朋党勾连', 3, 'GM.partyState[' + targetParty + '].cohesion');
  }
  if ((accusedCh && ((accusedCh.favor || 0) >= 70 || (accusedCh.ambition || 0) >= 70)) || perceived >= 50) {
    add('\u5f87\u79c1\u690d\u515a', 2, 'character.favor/ambition');
  }
  if (charges.length < 3) {
    add('\u5931\u5bdf\u5931\u5f53', 2, 'GM.corruption.perceivedIndex');
  }
  if (charges.length < 3 && targetParty) {
    add('\u95e8\u751f\u6545\u540f\u7275\u8fde', 2, 'GM.partyState[' + targetParty + '].influence');
  }
  return charges.slice(0, 4);
}

function _ty3_impeachmentVerdictGrade(charges, partyMetrics, inquiryBody) {
  var score = inquiryBody && inquiryBody.weight ? inquiryBody.weight : 0;
  (charges || []).forEach(function(ch) { score += Math.max(1, parseInt(ch.severity, 10) || 1); });
  if (partyMetrics) {
    if (typeof partyMetrics.influence === 'number') score += Math.max(0, Math.round((partyMetrics.influence - 40) / 20));
    if (typeof partyMetrics.cohesion === 'number') score += Math.max(0, Math.round((60 - partyMetrics.cohesion) / 10));
  }
  if (score >= 15) return 'S';
  if (score >= 12) return 'A';
  if (score >= 9) return 'B';
  if (score >= 6) return 'C';
  return 'D';
}

function _ty3_impeachmentConsequenceLadder(grade) {
  var ladder = {
    S: ['\u7acb\u6848', '\u505c\u804c', '\u524a\u7c4d', '\u6284\u6ca1'],
    A: ['\u7acb\u6848', '\u505c\u4ff8', '\u5916\u653e'],
    B: ['review', 'hold', 'suspend'],
    C: ['记过', '申饬'],
    D: ['\u9a73\u56de', '\u5b58\u67e5']
  };
  return ladder[grade] ? ladder[grade].slice() : ladder.C.slice();
}

function _ty3_buildSupportingParties(accuserCh, accusedCh, partyMetrics) {
  var out = [];
  var accuserParty = accuserCh && accuserCh.party ? accuserCh.party : '';
  var accusedParty = accusedCh && accusedCh.party ? accusedCh.party : '';
  if (accuserParty) {
    out.push({ name: accuserParty, stance: 'support', cohesionDelta: 2, influenceDelta: 1, reason: 'accuser' });
    _ty3_getAlliedParties(accuserParty).slice(0, 2).forEach(function(p) {
      out.push({ name: p.name, stance: 'support', cohesionDelta: 1, influenceDelta: 0, reason: '\u540c\u76df' });
    });
  }
  if (accusedParty) {
    out.push({ name: accusedParty, stance: 'oppose', cohesionDelta: -2, influenceDelta: -1, reason: 'accused' });
  }
  if (partyMetrics && partyMetrics.state && partyMetrics.state.name && out.length === 0) {
    out.push({ name: partyMetrics.state.name, stance: 'oppose', cohesionDelta: -1, influenceDelta: -1, reason: '党内承压' });
  }
  return out;
}

function _ty3_buildImpeachmentTopicMeta(accuserName, accuserCh, accusedCh, topicText) {
  var dynasty = 'default';
  try {
    if (typeof _ty3_phase6_resolveDynasty === 'function') dynasty = _ty3_phase6_resolveDynasty() || 'default';
  } catch(_){}
  var partyName = accusedCh && accusedCh.party ? accusedCh.party : '';
  var partyMetrics = _ty3_partyMetrics(partyName);
  var inquiryBody = _ty3_pickInquiryBody(dynasty, accusedCh);
  var charges = _ty3_buildImpeachmentCharges(accusedCh, partyMetrics, topicText);
  var verdictGrade = _ty3_impeachmentVerdictGrade(charges, partyMetrics, inquiryBody);
  var consequenceLadder = _ty3_impeachmentConsequenceLadder(verdictGrade);
  var supportingParties = _ty3_buildSupportingParties(accuserCh, accusedCh, partyMetrics);
  return {
    topic: topicText || ('\u5f39\u52be\u00b7' + (accusedCh && accusedCh.name ? accusedCh.name : '\u672a\u77e5')),
    kind: 'impeachment',
    topicType: 'impeachment',
    dynasty: dynasty,
    inquiryBody: inquiryBody,
    accused: accusedCh && accusedCh.name ? accusedCh.name : '',
    accuser: accuserName || '',
    charges: charges,
    verdictGrade: verdictGrade,
    consequenceLadder: consequenceLadder,
    supportingParties: supportingParties,
    partyState: partyMetrics.state ? {
      name: partyMetrics.state.name || partyName,
      influence: partyMetrics.state.influence,
      cohesion: partyMetrics.state.cohesion,
      recentImpeachWin: partyMetrics.state.recentImpeachWin || 0,
      recentImpeachLose: partyMetrics.state.recentImpeachLose || 0
    } : {
      name: partyName,
      influence: partyMetrics.influence,
      cohesion: partyMetrics.cohesion,
      recentImpeachWin: 0,
      recentImpeachLose: 0
    },
    from: 'impeachment-' + (inquiryBody.name || 'censorate') + '-preaudit',
    memorialKey: accusedCh && accusedCh.name ? ('impeach_' + accusedCh.name) : 'impeach_unknown'
  };
}

function _ty3_buildAccusationMemorialStructured(accuserName, accuserCh, accusedCh, topicMeta) {
  if (!accusedCh || !accusedCh.name) return null;
  var meta = topicMeta && typeof topicMeta === 'object' ? topicMeta : _ty3_buildImpeachmentTopicMeta(accuserName, accuserCh, accusedCh, topicMeta);
  var accuserTitle = (accuserCh && (accuserCh.officialTitle || accuserCh.title)) || 'censorate';
  var accuserNameText = accuserCh ? accuserCh.name : (accuserName || 'unknown');
  var charges = Array.isArray(meta.charges) ? meta.charges.slice() : [];
  var inquiryBody = meta.inquiryBody || _ty3_pickInquiryBody(meta.dynasty || 'default', accusedCh);
  var verdictGrade = meta.verdictGrade || _ty3_impeachmentVerdictGrade(charges, _ty3_partyMetrics(accusedCh.party || ''), inquiryBody);
  var consequenceLadder = Array.isArray(meta.consequenceLadder) ? meta.consequenceLadder.slice() : _ty3_impeachmentConsequenceLadder(verdictGrade);
  var content = '';
  content += '\u81e3' + accuserNameText + '\u6020\u6162\u5230\u8FBE\uFF0C\u8BF7\u4E0A\u8FBE\u5F39\u52BE\u3002\n';
  content += '\u4F0F\u5BDF' + (accusedCh.officialTitle || accusedCh.title || '') + accusedCh.name + '\uFF0C';
  content += '\u7D20\u8457\u58F0\u671B\uFF0C\u800C\u5F80\u6765\u884C\u672A\u80FD\u5F97\u5F53\uFF0C\u5176\u4E8B\u6709\u4E0D\u53EF\u4E0D\u8BE6\u8003\u8005\u3002\n';
  content += '\u5F84\u5F55\u4E66\u9662\uFF1A' + (inquiryBody.name || 'censorate') + '\u3002\u5B9A\u7B49\uFF1A' + verdictGrade + '\u3002\n';
  content += '\u8BC1\u72B6\u5982\u4E0B\uFF1A\n';
  charges.forEach(function(ch, i) {
    content += '\u5176' + (i + 1) + '\u3001' + ch.name + '\uFF0C\u4E25\u91CD\u4E3A' + (ch.severity || 1);
    if (ch.evidenceSource) content += '\uFF0C\u8BC1\u636E\u4E3A' + ch.evidenceSource;
    content += '\u3002\n';
  });
  content += '\u6240\u8BAE\u540E\u679C\uFF1A\n';
  consequenceLadder.forEach(function(step, i) {
    content += '\u5176' + (i + 1) + '\u3001' + step + '\u3002\n';
  });

  return {
    id: 'accu_' + (typeof uid === 'function' ? uid() : Date.now()) + '_' + Math.random().toString(36).slice(2,6),
    from: accuserName,
    title: accuserTitle,
    type: '\u4EBA\u4E8B',
    subtype: '密揭',
    content: content,
    status: 'drafted',
    turn: GM.turn,
    reply: '',
    reliability: 'medium',
    bias: 'factional',
    priority: 'urgent',
    isAccusation: true,
    accusationType: 'clique',
    topicType: meta.topicType || 'impeachment',
    kind: meta.kind || 'impeachment',
    accused: accusedCh.name,
    accuser: accuserName,
    inquiryBody: inquiryBody,
    charges: charges,
    verdictGrade: verdictGrade,
    consequenceLadder: consequenceLadder,
    supportingParties: Array.isArray(meta.supportingParties) ? meta.supportingParties.slice() : [],
    partyState: meta.partyState || _ty3_partyMetrics(accusedCh.party || '').state,
    memorialKey: meta.memorialKey || ('impeach_' + accusedCh.name),
    _ty3Generated: true
  };
}

// Party cohesion, 0-100 with default 50.
function _ty3_partyCohesion(partyName) {
  var p = _ty3_getPartyObj(partyName);
  if (!p) return 0;
  return parseInt(p.cohesion, 10) || 50;
}

// Party strife display helpers. partyStrife is a state value, not a numeric score only.
function _ty3_strifeLabel(value) {
  var v = (typeof value === 'number') ? value :
          (typeof GM.partyStrife === 'number' ? GM.partyStrife : 50);
  if (v <= 20) return { state: '\u671d\u5802\u6e05\u660e', flavor: '\u6d77\u664f\u6cb3\u6e05\u00b7\u767e\u5b98\u540c\u5fc3', tier: 'pristine' };
  if (v <= 40) return { state: '\u671d\u5c40\u7a33\u5065', flavor: '\u671d\u7ec5\u7a0d\u632f\u00b7\u5c0f\u6709\u9f83\u9f89', tier: 'stable' };
  if (v <= 60) return { state: '\u515a\u4e89\u5bfb\u5e38', flavor: '\u671d\u5802\u5206\u6b67\u00b7\u6216\u6709\u76f8\u8bbc', tier: 'normal' };
  if (v <= 80) return { state: '\u515a\u4e89\u6fc0\u70c8', flavor: '\u515a\u4e89\u5df2\u70bd\u00b7\u76f8\u4f3a\u653b\u8ba6', tier: 'fierce' };
  return { state: '\u515a\u7978\u6ed4\u5929', flavor: '\u515a\u7978\u5df2\u6210\u00b7\u52bf\u540c\u6c34\u706b', tier: 'catastrophic' };
}
function _ty3_strifeDelta(delta) {
  if (!delta || delta === 0) return '';
  var d = Math.abs(delta);
  if (delta > 0) {
    if (d >= 10) return '\u515a\u7978\u5927\u4f5c';
    if (d >= 6) return '\u671d\u4e89\u9aa4\u70c8';
    if (d >= 3) return '\u671d\u5802\u6108\u88c2';
    return '\u7a0d\u6dfb\u4e89\u7aef';
  } else {
    if (d >= 10) return '\u671d\u4e89\u5927\u7f13';
    if (d >= 6) return '\u671d\u5802\u6e10\u548c';
    if (d >= 3) return '\u7a0d\u5f97\u5b81\u606f';
    return '\u671d\u5c40\u5fae\u5b9a';
  }
}

function _ty3_strifeChange(oldVal, newVal) {
  var oldL = _ty3_strifeLabel(oldVal);
  var newL = _ty3_strifeLabel(newVal);
  var deltaText = _ty3_strifeDelta(newVal - oldVal);
  if (oldL.tier !== newL.tier) {
    return deltaText + '\u00b7\u671d\u5c40\u5df2\u8f6c\u4e3a\u300c' + newL.state + '\u300d';
  }
  return deltaText;
}
function _ty3_partyStanceOnTopic(partyName, topicText, topicType) {
  var p = _ty3_getPartyObj(partyName);
  if (!p) return 'neutral';
  var t = (topicText || '').toLowerCase();
  var stances = (p.policyStance || []).map(function(s){return (s||'').toLowerCase();});
  // focal_disputes[].topic hit means the party has a stance.
  var disputes = (p.focal_disputes || []);
  for (var i = 0; i < disputes.length; i++) {
    if (disputes[i] && disputes[i].topic && t.indexOf(disputes[i].topic.toLowerCase()) >= 0) {
      return disputes[i].stake === 'support' ? 'support' : 'oppose';
    }
  }
  // policyStance 关键字软匹配
  for (var j = 0; j < stances.length; j++) {
    var sw = stances[j];
    if (!sw) continue;
    if (t.indexOf(sw) >= 0) return 'support';
    // Topic handling note.
    var negMatch = sw.match(/^反(.+)/);
    if (negMatch && t.indexOf(negMatch[1]) >= 0) return 'oppose';
  }
  return 'neutral';
}

// ═══════════════════════════════════════════════════════════════════════
//  §2·实时插言机制(5 选项浮层·跨阶段贯穿)
// ═══════════════════════════════════════════════════════════════════════
// 设计：在 chaoyi 弹窗右下角浮一枚「朕意」按钮·点击开 5 选项面板。
// 复用 v2 已有的 CY._abortChaoyi + CY._pendingPlayerLine 机制：
//   - 点「训示」 → CY._pendingPlayerLine = playerText·下一轮 AI 看到玩家话语
//   - 点「让 X 起对」 → 将 X 名字推入 _ty3_pendingPlayerSummon·下一发言者改为 X
//   - 点「另有要事」 → CY._abortChaoyi = true·中止全部循环
//   - 点「卿且退下」 → 当前发言者 favor-3·CY._abortChaoyi 当人后切下一位
//   - 点「请 Y 党党首论之」 → 党魁名推入 summon·并把议题转给该党首立场表态
var _ty3_interjectMounted = false;

function _ty3_mountInterjectButton() {
  if (_ty3_interjectMounted) return;
  if (typeof document === 'undefined') return;
  var btn = document.getElementById('ty3-interject-btn');
  if (btn) { _ty3_interjectMounted = true; return; }
  btn = document.createElement('div');
  btn.id = 'ty3-interject-btn';
  btn.title = '朕欲发言·任意时刻可打断';
  btn.innerHTML = '<span class="ty3-ij-icon">📜</span><span class="ty3-ij-text">朕意</span>';
  btn.onclick = _ty3_openInterjectPanel;
  btn.style.display = 'none';
  document.body.appendChild(btn);
  _ty3_interjectMounted = true;
}

// Show during _ty3_open and hide when Chaoyi closes.
function _ty3_showInterjectButton() {
  _ty3_mountInterjectButton();
  var btn = document.getElementById('ty3-interject-btn');
  if (btn) btn.style.display = '';
}

function _ty3_hideInterjectButton() {
  var btn = document.getElementById('ty3-interject-btn');
  if (btn) btn.style.display = 'none';
  var pn = document.getElementById('ty3-interject-panel');
  if (pn) pn.remove();
}

function _ty3_openInterjectPanel() {
  var existing = document.getElementById('ty3-interject-panel');
  if (existing) { existing.remove(); return; }
  var pn = document.createElement('div');
  pn.id = 'ty3-interject-panel';
  pn.innerHTML =
    '<div class="ty3-ij-title">〔 朕 欲 发 言 〕</div>'
    + '<div class="ty3-ij-row" onclick="_ty3_doInterjectTrain()">📜 朕来训示<span class="ty3-ij-hint">直接键入·注入流式生成</span></div>'
    + '<div class="ty3-ij-row" onclick="_ty3_doInterjectSummon()">👁 朕欲让某人起对<span class="ty3-ij-hint">指定一员立刻发言</span></div>'
    + '<div class="ty3-ij-row" onclick="_ty3_doInterjectPartyLeader()">🪄 朕请某党党首论之<span class="ty3-ij-hint">让某党党首立刻表态</span></div>'
    + '<div class="ty3-ij-row" onclick="_ty3_doInterjectSilence()">🔇 卿且退下<span class="ty3-ij-hint">让正在说话者闭嘴·favor-3</span></div>'
    + '<div class="ty3-ij-row" onclick="_ty3_doInterjectAbort()">⚡ 朕另有要事<span class="ty3-ij-hint">中止本场廷议·议题留中</span></div>'
    + '<div class="ty3-ij-foot"><button onclick="this.closest(\'div\').remove();">退下</button></div>';
  document.body.appendChild(pn);
}

function _ty3_doInterjectTrain() {
  var pn = document.getElementById('ty3-interject-panel'); if (pn) pn.remove();
  var q = (typeof prompt === 'function') ? prompt('陛下欲训示何言？') : '';
  if (!q || !q.trim()) return;
  q = q.trim();
  // Reuse the v2 pending-player-line mechanism; the next AI speaker can see it.
  if (typeof CY !== 'undefined') CY._pendingPlayerLine = q;
  // 立刻气泡显示
  if (typeof addCYBubble === 'function') addCYBubble('皇帝', q, false);
  if (typeof toast === 'function') toast('朕意已注·下一发言者将据此回应');
}

function _ty3_doInterjectSummon() {
  var pn = document.getElementById('ty3-interject-panel'); if (pn) pn.remove();
  // List present speakers who can respond.
  var pool = [];
  if (CY._ty2 && Array.isArray(CY._ty2.attendees)) pool = CY._ty2.attendees.slice();
  else if (CY._ty3 && Array.isArray(CY._ty3.attendees)) pool = CY._ty3.attendees.slice();
  if (pool.length === 0) { if (typeof toast === 'function') toast('当前无在议名册'); return; }
  var name = (typeof prompt === 'function') ? prompt('指定何人起对？\n在议名册：' + pool.join('、')) : '';
  if (!name || !name.trim()) return;
  name = name.trim();
  if (pool.indexOf(name) < 0) {
    if (typeof toast === 'function') toast(name + ' 不在殿中');
    return;
  }
  CY._ty3_pendingSummon = name;
  if (typeof addCYBubble === 'function') addCYBubble('皇帝', '——着' + name + '起对。', false);
  if (typeof toast === 'function') toast('召 ' + name + ' 起对');
}

function _ty3_doInterjectPartyLeader() {
  var pn = document.getElementById('ty3-interject-panel'); if (pn) pn.remove();
  var parties = _ty3_getParties();
  if (parties.length === 0) { if (typeof toast === 'function') toast('当前无党派可召'); return; }
  var names = parties.map(function(p){ return p.name + '(' + (p.leader||'?') + ')'; }).join(', ');
  var pn1 = (typeof prompt === 'function') ? prompt('Party? ' + names) : '';
  if (!pn1 || !pn1.trim()) return;
  pn1 = pn1.trim();
  var leader = _ty3_getPartyLeader(pn1);
  if (!leader) { if (typeof toast === 'function') toast('党魁未在场：' + pn1); return; }
  CY._ty3_pendingSummon = leader.name;
  if (typeof addCYBubble === 'function') addCYBubble('皇帝', '令' + leader.name + '为' + pn1 + '发言。', false);
  if (typeof toast === 'function') toast('召党魁 ' + leader.name);
}

function _ty3_doInterjectSilence() {
  var pn = document.getElementById('ty3-interject-panel'); if (pn) pn.remove();
  // Interrupt current AI output and penalize the current speaker.
  if (typeof CY !== 'undefined') {
    if (CY.abortCtrl && typeof CY.abortCtrl.abort === 'function') {
      try { CY.abortCtrl.abort(); } catch(_){}
    }
    // Find the current speaker from the latest cy-bubble.
    var lastSpeaker = '';
    try {
      var bubbles = document.querySelectorAll('#cy-body .cy-bubble');
      if (bubbles.length > 0) {
        var last = bubbles[bubbles.length - 1];
        var head = last.parentElement && last.parentElement.querySelector('div');
        if (head) lastSpeaker = (head.textContent||'').trim();
      }
    } catch(_){}
    if (lastSpeaker) {
      var ch = (typeof findCharByName === 'function') ? findCharByName(lastSpeaker) : null;
      if (ch) {
        ch.favor = Math.max(-100, (ch.favor||0) - 3);
        // 该党 cohesion-1(公开下脸)
        if (ch.party) {
          var pp = _ty3_getPartyObj(ch.party);
          if (pp) pp.cohesion = Math.max(0, ((parseInt(pp.cohesion,10)||50) - 1));
        }
        if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 ' + lastSpeaker + ' 缄口·朕命之 〕', true);
      }
    }
    if (typeof addCYBubble === 'function') addCYBubble('皇帝', '——卿且退下。', false);
  }
  if (typeof toast === 'function') toast('当前发言者 favor-3');
}

function _ty3_doInterjectAbort() {
  var pn = document.getElementById('ty3-interject-panel'); if (pn) pn.remove();
  if (typeof CY !== 'undefined') CY._abortChaoyi = true;
  // 议题留中
  var topic = '';
  if (CY._ty2 && CY._ty2.topic) topic = CY._ty2.topic;
  else if (CY._ty3 && CY._ty3.topic) topic = CY._ty3.topic;
  if (topic) {
    if (!GM._ccHeldItems) GM._ccHeldItems = [];
    GM._ccHeldItems.push({ topic: topic, from: '廷议中止', turn: GM.turn });
    if (typeof addCYBubble === 'function') addCYBubble('皇帝', '朕另有要事·此事留中。', false);
  }
  if (typeof toast === 'function') toast('廷议中止·议题入留中册');
}

// ═══════════════════════════════════════════════════════════════════════
//  §3·阶段 0·议前预审(留中 / 私决 / 下议 / 明发)
// ═══════════════════════════════════════════════════════════════════════
// 接 GM._pendingTinyiTopics·让玩家选择四种处置方式·避免直接进廷议无回旋

function _ty3_open(seedTopic) {
  // Entry point: show controls, then open pre-audit.
  _ty3_showInterjectButton();
  _ty3_openPreAudit(seedTopic);
}

function _ty3_openPreAudit(seedTopic) {
  var bg = document.createElement('div');
  bg.id = 'ty3-preaudit-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';

  var pending = (GM._pendingTinyiTopics || []).slice();
  var topicSeed = seedTopic || (pending.length > 0 ? pending[0] : null);
  var topicText = '';
  var topicMeta = null;
  if (topicSeed) {
    topicText = (typeof topicSeed === 'string') ? topicSeed : (topicSeed.topic || '');
    if (typeof topicSeed === 'object') topicMeta = topicSeed;
  }

  var html = '<div class="ty3-pa-modal">';
  html += '<div class="ty3-pa-title">〔 议 前 预 审 〕</div>';
  html += '<div class="ty3-pa-sub">陛下决断之前·先察议题之轻重缓急·从容择处</div>';

  // Topic handling note.
  html += '<div class="ty3-pa-section"><div class="ty3-pa-label">议  题</div>';
  html += '<input id="ty3-pa-topic" placeholder="如：弹劾魏忠贤、北伐契丹、立嫡长为太子……" value="' + (topicText ? escHtml(topicText) : '') + '">';
  if (pending.length > 0) {
    html += '<select id="ty3-pa-pick" onchange="_ty3_paPickPending(this)">';
    html += '<option value="">— 从待议册选 —</option>';
    pending.forEach(function(p, i) {
      var t = (typeof p === 'string') ? p : (p.topic || '');
      var prop = (typeof p === 'object' && p.proposer) ? ' - ' + p.proposer : '';
      html += '<option value="' + i + '">' + escHtml(t.slice(0, 50) + prop) + '</option>';
    });
    html += '</select>';
  }
  if (Array.isArray(GM._ccHeldItems) && GM._ccHeldItems.length > 0) {
    html += '<div class="ty3-pa-held-list" style="margin-top:0.5rem;">';
    html += '<div class="ty3-pa-label">\u7559\u4e2d\u518c</div>';
    GM._ccHeldItems.slice(0, 5).forEach(function(it, i) {
      if (!it || it.finalBlocked) return;
      var ht = _ty3_heldTopicText(it);
      var count = parseInt(it.reissuedCount, 10) || 0;
      html += '<div class="ty3-pa-held-row" style="display:flex;gap:0.45rem;align-items:center;justify-content:space-between;margin:0.25rem 0;">';
      html += '<span>' + escHtml(ht.slice(0, 46)) + (count ? ' \u00b7 \u590d\u8bae' + count : '') + '</span>';
      html += '<button class="bt bsm" onclick="_ty3_reissueTopic(' + i + ')">\u518d\u8bae</button>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';

  // Proposer banner when the topic carries proposer metadata.
  html += '<div id="ty3-pa-proposer" class="ty3-pa-proposer" style="display:none;"></div>';

  // Impeachment topic: show the source memorial when available.
  if (topicMeta && topicMeta.isAccusation && topicMeta.memorialContent) {
    html += '<div class="ty3-pa-section ty3-pa-memo">';
    html += '<div class="ty3-pa-memo-head">奏者：' + escHtml(topicMeta.accuser || '') + ' · 体裁：密揭</div>';
    html += '<div class="ty3-pa-memo-body">' + escHtml(topicMeta.memorialContent).replace(/\n/g, '<br>') + '</div>';
    html += '</div>';
  }

  // Party stance forecast.
  html += '<div class="ty3-pa-section ty3-pa-forecast" id="ty3-pa-forecast"></div>';

  // Four handling choices.
  html += '<div class="ty3-pa-section"><div class="ty3-pa-label">\u965b\u4e0b\u4f55\u5982\u88c1\u5904</div>';
  html += '<div class="ty3-pa-options">';

  html += '<div class="ty3-pa-opt ty3-pa-hold" onclick="_ty3_paChoose(\'hold\')">'
    + '<div class="ty3-pa-opt-name">📥 留 中</div>'
    + '<div class="ty3-pa-opt-cost">皇权 -1</div>'
    + '<div class="ty3-pa-opt-desc">搁置一回合·奏者 prestige-2·世人议怠政</div>'
    + '</div>';

  html += '<div class="ty3-pa-opt ty3-pa-private" onclick="_ty3_paChoose(\'private\')">'
    + '<div class="ty3-pa-opt-name">🤐 私 决</div>'
    + '<div class="ty3-pa-opt-cost">皇威 +1</div>'
    + '<div class="ty3-pa-opt-desc">走御前奏对·与心腹密议·不公开</div>'
    + '</div>';

  html += '<div class="ty3-pa-opt ty3-pa-small" onclick="_ty3_paChoose(\'small\')">'
    + '<div class="ty3-pa-opt-name">🤝 下议·五人闭门</div>'
    + '<div class="ty3-pa-opt-cost">朝堂渐和</div>'
    + '<div class="ty3-pa-opt-desc">召三品以上 5 员·小范围议事</div>'
    + '</div>';

  html += '<div class="ty3-pa-opt ty3-pa-public" onclick="_ty3_paChoose(\'public\')">'
    + '<div class="ty3-pa-opt-name">📜 明 发·廷议</div>'
    + '<div class="ty3-pa-opt-cost">完整七阶段/div>'
    + '<div class="ty3-pa-opt-desc">召三品以上百官·四轮辩议·公开裁决</div>'
    + '</div>';

  html += '</div></div>';

  // 修·历史现实：古代无人公开结党·结党是罪名而非身份·删除"册立"按钮
  // 推演若发现 X 名望日盛·spawn 的是「弹劾结党」议题(见 §15)·
  // 玩家在该议题上准奏 → 自动触发党派 spawn(status='被劾')

  // 鍙栨秷
  html += '<div class="ty3-pa-foot">';
  html += '<button class="bt" onclick="_ty3_paCancel()">罢·改日再议</button>';
  html += '</div>';
  html += '</div>';

  bg.innerHTML = html;
  document.body.appendChild(bg);
  _ty3_paUpdateForecast();
  _ty3_paUpdateProposer(topicMeta);

  // Topic handling note.
  if (inp) inp.oninput = _ty3_paUpdateForecast;

  // 鏆傚瓨 meta
  CY._ty3_paMeta = topicMeta;
}

// Render proposer banner from topic metadata.
function _ty3_paUpdateProposer(meta) {
  var box = document.getElementById('ty3-pa-proposer');
  if (!box) return;
  if (!meta || !meta.proposer) {
    box.style.display = 'none';
    box.innerHTML = '';
    return;
  }
  var inflTxt = (typeof meta.proposerInfluence === 'number' && meta.proposerInfluence > 0)
    ? ' · 影响 ' + meta.proposerInfluence : '';
  var partyTxt = meta.proposerParty ? '<span class="ty3-pa-prop-party">' + escHtml(meta.proposerParty) + '</span>' : '<span class="ty3-pa-prop-noparty">无党</span>';
  var html = '<div class="ty3-pa-prop-head">主 奏</div>';
  html += '<div class="ty3-pa-prop-line">';
  html += '<span class="ty3-pa-prop-name">' + escHtml(meta.proposer) + '</span>';
  if (meta.proposerTitle) html += '<span class="ty3-pa-prop-title">' + escHtml(meta.proposerTitle) + '</span>';
  html += partyTxt;
  if (inflTxt) html += '<span class="ty3-pa-prop-infl">' + escHtml(inflTxt) + '</span>';
  html += '</div>';
  if (meta.proposerReason) {
    html += '<div class="ty3-pa-prop-reason">' + escHtml(meta.proposerReason) + '</div>';
  }
  if (meta.from) {
    html += '<div class="ty3-pa-prop-from">' + escHtml(meta.from) + '</div>';
  }
  box.style.display = 'block';
  box.innerHTML = html;
}

function _ty3_paPickPending(sel) {
  if (!sel) return;
  var i = parseInt(sel.value, 10);
  var pending = GM._pendingTinyiTopics || [];
  if (isNaN(i) || !pending[i]) return;
  var item = pending[i];
  var t = (typeof item === 'string') ? item : (item.topic || '');
  var inp = document.getElementById('ty3-pa-topic');
  if (inp) inp.value = t;
  CY._ty3_paMeta = (typeof item === 'object') ? item : null;
  _ty3_paUpdateForecast();
  _ty3_paUpdateProposer(CY._ty3_paMeta);
}

function _ty3_paUpdateForecast() {
  var fc = document.getElementById('ty3-pa-forecast');
  if (!fc) return;
  var inp = document.getElementById('ty3-pa-topic');
  var topic = (inp && inp.value || '').trim();
  if (!topic) { fc.innerHTML = '<div class="ty3-pa-forecast-empty">输入议题以预估党派形势</div>'; return; }

  // 计算各党立场预估
  var parties = _ty3_getParties();
  // fallback: GM.parties 为空时·按势力 GM.facs 估算(仅做粗略立场分布)
  if (parties.length === 0) {
    var facs = (GM.facs || []).filter(function(f){ return f && f.name; });
    if (facs.length === 0) {
      fc.innerHTML = '<div class="ty3-pa-forecast-empty">朝中无党无派·议题以人主奏 — 廷议将以人立论</div>';
      return;
    }
    // Simple fallback: use party names as stance hints.
    var html0 = '<div class="ty3-pa-forecast-title">朝中势力(无党派记录·展示势力以备参)</div>';
    html0 += '<div class="ty3-pa-faction-list">';
    facs.slice(0, 6).forEach(function(f){ html0 += '<span style="color:var(--ty3-ink-mid,#4a3520);">' + escHtml(f.name) + '</span>'; });
    html0 += '</div>';
    html0 += '<div class="ty3-pa-forecast-tip" style="font-style:italic;">议题立场以个人 prestige+党派偏好综合·廷议中会逐一表态</div>';
    fc.innerHTML = html0;
    return;
  }
  var support = [], oppose = [], neutral = [];
  parties.forEach(function(p) {
    var s = _ty3_partyStanceOnTopic(p.name, topic);
    var entry = { name: p.name, infl: _ty3_partyInfluence(p.name) };
    if (s === 'support') support.push(entry);
    else if (s === 'oppose') oppose.push(entry);
    else neutral.push(entry);
  });
  var supSum = support.reduce(function(a,b){return a + b.infl;}, 0);
  var oppSum = oppose.reduce(function(a,b){return a + b.infl;}, 0);
  var nSum = neutral.reduce(function(a,b){return a + b.infl;}, 0);
  var total = supSum + oppSum + nSum;
  var ratio = total > 0 ? Math.round((supSum - oppSum) / total * 100) : 0;

  var html = '<div class="ty3-pa-forecast-title">党派形势预估</div>';
  html += '<div class="ty3-pa-forecast-bar">';
  if (total > 0) {
    var supPct = Math.round(supSum / total * 100);
    var oppPct = Math.round(oppSum / total * 100);
    var nPct = 100 - supPct - oppPct;
    html += '<div class="ty3-pa-bar-sup" style="width:' + supPct + '%">' + (supPct >= 8 ? '支 ' + supPct + '%' : '') + '</div>';
    html += '<div class="ty3-pa-bar-n" style="width:' + nPct + '%">' + (nPct >= 8 ? '中 ' + nPct + '%' : '') + '</div>';
    html += '<div class="ty3-pa-bar-opp" style="width:' + oppPct + '%">' + (oppPct >= 8 ? '反 ' + oppPct + '%' : '') + '</div>';
  }
  html += '</div>';
  html += '<div class="ty3-pa-forecast-tip">' + (ratio > 20 ? '★ 议题占优·明发可能直冲 A 档以上' : ratio < -20 ? '⚠ 反对势众·明发恐危诏激变(D 档)' : '势均力敌·结果难料') + '</div>';

  // 列各阵营党派
  var listHtml = '';
  if (support.length > 0) {
    listHtml += '<span class="ty3-pa-faction-sup">\u652f\uff1a' + support.map(function(e){return e.name + '(' + e.infl + ')';}).join('\u00b7') + '</span>';
  }
  if (oppose.length > 0) {
    listHtml += '<span class="ty3-pa-faction-opp">\u53cd\uff1a' + oppose.map(function(e){return e.name + '(' + e.infl + ')';}).join('\u00b7') + '</span>';
  }
  if (listHtml) html += '<div class="ty3-pa-faction-list">' + listHtml + '</div>';
  fc.innerHTML = html;
}

function _ty3_paChoose(mode) {
  var inp = document.getElementById('ty3-pa-topic');
  var topic = (inp && inp.value || '').trim();
  if (!topic) { if (typeof toast === 'function') toast('请输入议题'); return; }
  var meta = CY._ty3_paMeta || null;

  // Close dialog.
  var bg = document.getElementById('ty3-preaudit-bg');
  if (bg) bg.remove();

  // Remove from pending topics when this came from the queue.
  if (meta && GM._pendingTinyiTopics) {
    GM._pendingTinyiTopics = GM._pendingTinyiTopics.filter(function(x){ return x !== meta; });
  }

  // Four handling branches.
  if (mode === 'hold') return _ty3_paDoHold(topic, meta);
  if (mode === 'private') return _ty3_paDoPrivate(topic, meta);
  if (mode === 'small') return _ty3_paDoSmall(topic, meta);
  if (mode === 'public') return _ty3_paDoPublic(topic, meta);
}

function _ty3_reissueLimit() {
  var v = _ty3_readEngineConstant('influenceGroupReissueLimit', undefined);
  var n = parseInt(v, 10);
  return isNaN(n) ? 3 : Math.max(1, n);
}

function _ty3_heldTopicText(item) {
  if (!item) return '';
  if (typeof item === 'string') return item;
  if (typeof item.topic === 'string') return item.topic;
  if (item.topic && typeof item.topic === 'object') return item.topic.topic || item.topic.title || '';
  return item.title || '';
}

function _ty3_findHeldItemIndex(topicOrIndex) {
  if (!Array.isArray(GM._ccHeldItems)) return -1;
  if (typeof topicOrIndex === 'number') return GM._ccHeldItems[topicOrIndex] ? topicOrIndex : -1;
  var topic = _ty3_heldTopicText({ topic: topicOrIndex });
  for (var i = 0; i < GM._ccHeldItems.length; i += 1) {
    var item = GM._ccHeldItems[i];
    if (!item || item.finalBlocked) continue;
    if (_ty3_heldTopicText(item) === topic) return i;
  }
  return -1;
}

function _ty3_makeHeldItem(topic, from, extra) {
  extra = extra || {};
  var cy3 = (typeof CY !== 'undefined' && CY && CY._ty3) || {};
  var cy2 = (typeof CY !== 'undefined' && CY && CY._ty2) || {};
  var item = {
    topic: _ty3_heldTopicText({ topic: topic }) || topic || '',
    from: from || extra.from || 'held',
    turn: GM.turn || 0,
    blockedBy: extra.blockedBy || '',
    sourceParty: extra.sourceParty || cy3.proposerParty || '',
    opposingParties: _ty3_normalizePartyNames(extra.opposingParties || []),
    decision: _ty3_clone(extra.decision || cy2.decision || {}),
    opts: _ty3_clone(extra.opts || {}),
    meta: _ty3_clone(extra.meta || cy3.meta || cy2._publicMeta || null),
    draftEdict: _ty3_clone(extra.draftEdict || cy3.draftEdict || null),
    grade: extra.grade || CY._ty3_archonGrade || '',
    attendees: _ty3_clone(extra.attendees || cy3.attendees || cy2.attendees || []),
    bench: _ty3_clone(extra.bench || cy3.bench || cy2.bench || null),
    tide: _ty3_clone(extra.tide || cy3.tide || cy2.tide || null),
    stances: _ty3_clone(extra.stances || cy3.stances || cy2.stances || {}),
    chaoyiTrackId: extra.chaoyiTrackId || cy3.chaoyiTrackId || cy2.chaoyiTrackId || '',
    reissuedCount: parseInt(extra.reissuedCount, 10) || 0,
    finalBlocked: !!extra.finalBlocked
  };
  return item;
}

function _ty3_markHeldFinalBlocked(item, reason) {
  item = item || {};
  item.finalBlocked = true;
  item.finalBlockedTurn = GM.turn || 0;
  item.finalBlockedReason = reason || 'reissue-limit';
  if (!Array.isArray(GM._ccFinalBlockedItems)) GM._ccFinalBlockedItems = [];
  GM._ccFinalBlockedItems.push(_ty3_clone(item));
  _ty3_pushChronicle('\u8bae\u9898\u6c38\u5f03', '\u8bae\u9898\u300a' + _ty3_heldTopicText(item) + '\u300b\u4e09\u8bae\u4e0d\u51b3\u00b7\u6c38\u5f03\u7559\u4e2d', {
    topic: _ty3_heldTopicText(item),
    sealStatus: 'final_blocked',
    reissuedCount: item.reissuedCount || 0
  });
  return item;
}

function _ty3_reissueTopic(topicOrIndex, opts) {
  opts = opts || {};
  if (!Array.isArray(GM._ccHeldItems)) return false;
  var idx = _ty3_findHeldItemIndex(topicOrIndex);
  if (idx < 0) return false;
  var heldItem = GM._ccHeldItems.splice(idx, 1)[0];
  var limit = _ty3_reissueLimit();
  var oldCount = parseInt(heldItem.reissuedCount, 10) || 0;
  if (oldCount >= limit) {
    _ty3_markHeldFinalBlocked(heldItem, 'reissue-limit-before-open');
    return false;
  }
  var nextCount = oldCount + 1;
  var topic = _ty3_heldTopicText(heldItem);
  CY._ty3 = {
    topic: topic,
    meta: _ty3_clone(heldItem.meta || {}),
    proposerParty: heldItem.sourceParty || '',
    proposer: heldItem.proposer || '',
    attendees: _ty3_clone(heldItem.attendees || []),
    bench: _ty3_clone(heldItem.bench || { left: [], center: [], right: [] }),
    tide: _ty3_clone(heldItem.tide || { left: 33, center: 34, right: 33 }),
    stances: _ty3_clone(heldItem.stances || {}),
    draftEdict: _ty3_clone(heldItem.draftEdict || null),
    isReissue: true,
    previousSealStatus: 'blocked',
    reissuedFromTurn: heldItem.turn || 0,
    reissuedCount: nextCount,
    blockedBy: heldItem.blockedBy || '',
    reissueReason: opts.reason || heldItem.reissueReason || '',
    chaoyiTrackId: heldItem.chaoyiTrackId || ''
  };
  CY._ty2 = CY._ty2 || {};
  CY._ty2.topic = topic;
  CY._ty2.stances = _ty3_clone(heldItem.stances || {});
  CY._ty2.attendees = _ty3_clone(heldItem.attendees || []);
  CY._ty2._publicMeta = _ty3_clone(heldItem.meta || {});
  var reissueOpts = _ty3_clone(heldItem.opts || {});
  reissueOpts.topic = topic;
  reissueOpts.proposerParty = heldItem.sourceParty || reissueOpts.proposerParty || '';
  reissueOpts.opposingParties = _ty3_normalizePartyNames(heldItem.opposingParties || reissueOpts.opposingParties || []);
  reissueOpts.reissuedCount = nextCount;
  reissueOpts.isReissue = true;
  if (heldItem.chaoyiTrackId) reissueOpts.chaoyiTrackId = heldItem.chaoyiTrackId;
  if (opts.reason) reissueOpts.reissueReason = opts.reason;
  _ty3_pushChronicle('\u518d\u8bae', '\u8bae\u9898\u300a' + topic + '\u300b\u8d77\u590d\u518d\u8bae\u00b7\u539f\u963b\u6320\u8005\uff1a' + (heldItem.blockedBy || '\u53cd\u5bf9\u65b9'), {
    topic: topic,
    reissuedFromTurn: heldItem.turn || 0,
    reissuedCount: nextCount,
    blockedBy: heldItem.blockedBy || ''
  });
  if (opts.deferOpen) {
    if (!Array.isArray(GM._pendingTinyiTopics)) GM._pendingTinyiTopics = [];
    GM._pendingTinyiTopics.push({
      topic: topic,
      isReissue: true,
      reissuePayload: _ty3_clone(CY._ty3),
      reissuedCount: nextCount,
      source: opts.source || 'ai'
    });
    return true;
  }
  var settleFn = (typeof window !== 'undefined' && typeof window._ty3_settleArchonGrade === 'function') ? window._ty3_settleArchonGrade : _ty3_settleArchonGrade;
  settleFn({ mode: 'reissue', decision: heldItem.decision || {} }, reissueOpts);
  return true;
}

function _ty3_applyAIReissueTopics(list, opts) {
  var out = [];
  if (!Array.isArray(list)) return out;
  list.forEach(function(item) {
    if (!item || !item.topic) return;
    var ok = _ty3_reissueTopic(item.topic, {
      source: (opts && opts.source) || 'ai',
      reason: item.reason || '',
      deferOpen: !!(opts && opts.deferOpen)
    });
    out.push({ topic: item.topic, ok: !!ok, reason: item.reason || '' });
  });
  if (out.length) GM._ty3_aiReissueResults = out;
  return out;
}

function _ty3_paDoHold(topic, meta) {
  // Held topics and non-edict queues are not reviewed by this policy reviewer.
  if (!GM._ccHeldItems) GM._ccHeldItems = [];
  GM._ccHeldItems.push(_ty3_makeHeldItem(topic, '\u8bae\u524d\u7559\u4e2d', { meta: meta || null }));
  // 皇权 -1
  if (GM.huangquan && typeof GM.huangquan.index === 'number') GM.huangquan.index = Math.max(0, GM.huangquan.index - 1);
  else if (GM.vars && GM.vars['皇权'] && typeof GM.vars['皇权'].value === 'number') GM.vars['皇权'].value = Math.max(0, GM.vars['皇权'].value - 1);
  // Proposer prestige penalty when metadata is present.
  if (meta && meta.proposer) {
    var ch = (typeof findCharByName === 'function') ? findCharByName(meta.proposer) : null;
    if (ch) ch.prestige = Math.max(0, (ch.prestige||50) - 2);
  }
  if (typeof toast === 'function') toast(topic.slice(0,16) + ' 留中');
  if (typeof addEB === 'function') addEB('tinyi-preaudit', 'held: ' + topic);
  _ty3_hideInterjectButton();
  if (typeof closeChaoyi === 'function') closeChaoyi();
}

function _ty3_paDoPrivate(topic, meta) {
  // 私决：转御前·携带议题
  if (typeof addEB === 'function') addEB('tinyi-preaudit', 'private: ' + topic);
  // 皇威 +1
  if (GM.huangwei && typeof GM.huangwei.index === 'number') GM.huangwei.index = Math.min(100, GM.huangwei.index + 1);
  else if (GM.vars && GM.vars['皇威'] && typeof GM.vars['皇威'].value === 'number') GM.vars['皇威'].value = Math.min(100, GM.vars['皇威'].value + 1);
  // Topic handling note.
  window._yq2_seedTopic = topic;
  if (typeof _yq2_openSetup === 'function') {
    _yq2_openSetup();
    // Auto-fill topic.
    setTimeout(function() {
      var yqInp = document.getElementById('yq2-topic');
      if (yqInp && !yqInp.value) yqInp.value = topic;
    }, 50);
  } else if (typeof toast === 'function') toast('御前模块未就绪');
}

function _ty3_paDoSmall(topic, meta) {
  // Private debate: call _ty2_openSetup with at most 5 participants.
  if (typeof addEB === 'function') addEB('tinyi-preaudit', 'small: ' + topic);
  // Party strife bookkeeping for Tinyi state and UI summaries.
  var _oldStrife = (typeof GM.partyStrife === 'number') ? GM.partyStrife : 50;
  if (typeof GM.partyStrife === 'number') GM.partyStrife = Math.max(0, GM.partyStrife - 3);
  // 注入预填
  window._ty3_smallTopic = topic;
  window._ty3_smallMeta = meta;
  if (typeof _ty2_openSetup === 'function') {
    _ty2_openSetup();
    setTimeout(function() {
      var tIn = document.getElementById('ty2-topic');
      if (tIn) tIn.value = topic;
      // Limit to 5 participants and uncheck extras.
      var att = document.querySelectorAll('.ty2-attendee:checked');
      if (att.length > 5) {
        for (var i = 5; i < att.length; i++) att[i].checked = false;
      }
      if (typeof toast === 'function') toast('已限至 5 人小议·' + _ty3_strifeChange(_oldStrife, GM.partyStrife));
    }, 80);
  }
}

function _ty3_paDoPublic(topic, meta) {
  // Public debate: phase 2+ goes directly to v3 standing debate.
  if (typeof addEB === 'function') addEB('tinyi-preaudit', 'public: ' + topic);
  window._ty3_publicTopic = topic;
  window._ty3_publicMeta = meta;
  // 阶段 1·起议站班(波 2)
  if (typeof _ty3_phase1_openSeating === 'function') {
    _ty3_phase1_openSeating(topic, meta);
  } else if (typeof _ty2_openSetup === 'function') {
    // Fallback to v2 setup if phase 2 functions are unavailable.
    _ty2_openSetup();
    setTimeout(function() {
      var tIn = document.getElementById('ty2-topic');
      if (tIn) tIn.value = topic;
    }, 80);
  }
}

function _ty3_paCancel() {
  var bg = document.getElementById('ty3-preaudit-bg');
  if (bg) bg.remove();
  CY._ty3_paMeta = null;
  _ty3_hideInterjectButton();
  if (typeof closeChaoyi === 'function') closeChaoyi();
}

// ═══════════════════════════════════════════════════════════════════════
//  §4·阶段 4·钦定档位重做(S/A/B/C/D 流程级特权)
// ═══════════════════════════════════════════════════════════════════════
// 接入点：override v2 _ty2_decide 末尾·或在 _ty2_finalEnd 之前调用
// 档位规则(读 huangwei.index + huangquan.index 或 vars 兼容路径)：
//   双 70+        → S 圣旨煌煌    跳过用印 + 草诏自由 + 反对党 cohesion-10
//   单 70+        → A 凛然奉旨    草诏快通 + 反对党党首 prestige-5
//   双 50-70      → B 勉强尊行    完整流程·中性
//   双 30-50      → C 众议汹汹    诏令打折·主奏党 cohesion-8
//   <30 或双<50   → D 危诏激变    硬推/妥协 二选

function _ty3_readHuangwei() {
  if (GM.huangwei && typeof GM.huangwei.index === 'number') return GM.huangwei.index;
  if (GM.vars && GM.vars['皇威'] && typeof GM.vars['皇威'].value === 'number') return GM.vars['皇威'].value;
  return 50;
}

function _ty3_readHuangquan() {
  if (GM.huangquan && typeof GM.huangquan.index === 'number') return GM.huangquan.index;
  if (GM.vars && GM.vars['皇权'] && typeof GM.vars['皇权'].value === 'number') return GM.vars['皇权'].value;
  return 50;
}

function _ty3_computeArchonGrade() {
  var hw = _ty3_readHuangwei();
  var hq = _ty3_readHuangquan();
  var min = Math.min(hw, hq);
  var max = Math.max(hw, hq);
  if (hw >= 70 && hq >= 70) return { grade: 'S', label: '圣旨煌煌', hw: hw, hq: hq };
  if (max >= 70) return { grade: 'A', label: '凛然奉旨', hw: hw, hq: hq };
  if (min >= 50) return { grade: 'B', label: '勉强尊行', hw: hw, hq: hq };
  if (min >= 30) return { grade: 'C', label: '众议汹汹', hw: hw, hq: hq };
  return { grade: 'D', label: '危诏激变', hw: hw, hq: hq };
}

// Apply grade effects to party cohesion, leader prestige, and proposer party.
function _ty3_applyArchonGrade(grade, opts) {
  // opts = { proposerParty, opposingParties[], decisionMode, topic }
  if (!opts) opts = {};
  var notes = [];
  var proposerParty = opts.proposerParty || '';
  var opposingNames = opts.opposingParties || [];
  if (typeof opposingNames === 'string') opposingNames = [opposingNames];

  // 鍚勬。鏁堟灉
  if (grade === 'S') {
    notes.push('圣旨煌煌·跳过用印 + 草诏自由');
    _ty3_applyPolicyPartyResult(proposerParty, opposingNames, grade, 'grade_win');
    // Opposition party cohesion -10.
    opposingNames.forEach(function(pn) {
      var p = _ty3_getPartyObj(pn);
      if (p) { p.cohesion = Math.max(0, (parseInt(p.cohesion,10)||50) - 10); notes.push(pn + ' 凝聚力 -10'); }
    });
    // Proposer party cohesion +3.
    if (proposerParty) {
      var pp = _ty3_getPartyObj(proposerParty);
      if (pp) { pp.cohesion = Math.min(100, (parseInt(pp.cohesion,10)||50) + 3); }
    }
  } else if (grade === 'A') {
    notes.push('凛然奉旨·草诏快通');
    // Opposition leader prestige -5.
    opposingNames.forEach(function(pn) {
      var leader = _ty3_getPartyLeader(pn);
      if (leader) { leader.prestige = Math.max(0, (leader.prestige||50) - 5); notes.push(leader.name + ' 鍚嶆湜 -5'); }
    });
    // Proposer leader favor +10.
    if (proposerParty) {
      var pl = _ty3_getPartyLeader(proposerParty);
      if (pl) { pl.favor = Math.min(100, (pl.favor||0) + 10); }
    }
  } else if (grade === 'B') {
    notes.push('勉强尊行·走完整流程');
  } else if (grade === 'C') {
    notes.push('众议汹汹·诏令折损 50% 落实');
    // Proposer party cohesion -8.
    if (proposerParty) {
      var pp2 = _ty3_getPartyObj(proposerParty);
      if (pp2) { pp2.cohesion = Math.max(0, (parseInt(pp2.cohesion,10)||50) - 8); notes.push(proposerParty + ' 凝聚力 -8'); }
    }
  } else if (grade === 'D') {
    notes.push('危诏激变·诏令被阻');
    _ty3_applyPolicyPartyResult(proposerParty, opposingNames, grade, 'grade_loss');
    // Do not apply D-grade effects immediately; wait for the player choice.
  }

  // Party strife bookkeeping for Tinyi state and UI summaries.
  var strifeDelta = { S: -2, A: -1, B: 0, C: 3, D: 6 }[grade] || 0;
  if (strifeDelta !== 0 && typeof GM.partyStrife === 'number') {
    var _strifeOld = GM.partyStrife;
    GM.partyStrife = Math.max(0, Math.min(100, GM.partyStrife + strifeDelta));
    var _strifeText = _ty3_strifeChange(_strifeOld, GM.partyStrife);
    if (_strifeText) notes.push(_strifeText);
  }

  return notes;
}

// D grade choice handling.
function _ty3_dGradeChoice(callback) {
  var bg = document.createElement('div');
  bg.id = 'ty3-dgrade-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1310;background:rgba(60,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  var html = '<div class="ty3-dg-modal">';
  html += '<div class="ty3-dg-title">⚠ 危 诏 激 变</div>';
  html += '<div class="ty3-dg-sub">皇威皇权双低·百官跪谏·诏令几近被阻。陛下何以处之？</div>';
  html += '<div class="ty3-dg-options">';
  html += '<div class="ty3-dg-opt ty3-dg-force" onclick="_ty3_dgPick(\'force\')">'
    + '<div class="ty3-dg-opt-name">⚔ 硬 推</div>'
    + '<div class="ty3-dg-opt-cost">皇权 -8 · 朝堂愈裂</div>'
    + '<div class="ty3-dg-opt-desc">独断推行·百官记恨·或生反复</div></div>';
  html += '<div class="ty3-dg-opt ty3-dg-yield" onclick="_ty3_dgPick(\'yield\')">'
    + '<div class="ty3-dg-opt-name">🤝 妥 协</div>'
    + '<div class="ty3-dg-opt-cost">议题留中·待再议</div>'
    + '<div class="ty3-dg-opt-desc">退一步·诏令重拟·保全颜面</div></div>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
  CY._ty3_dgCallback = callback;
}

function _ty3_dgPick(choice) {
  var bg = document.getElementById('ty3-dgrade-bg');
  if (bg) bg.remove();
  if (choice === 'force') {
    if (GM.huangquan && typeof GM.huangquan.index === 'number') GM.huangquan.index = Math.max(0, GM.huangquan.index - 8);
    else if (GM.vars && GM.vars['皇权']) GM.vars['皇权'].value = Math.max(0, (GM.vars['皇权'].value || 50) - 8);
    var _oldS = (typeof GM.partyStrife === 'number') ? GM.partyStrife : 50;
    if (typeof GM.partyStrife === 'number') GM.partyStrife = Math.min(100, GM.partyStrife + 5);
    if (typeof toast === 'function') toast('硬推·皇权-8·' + _ty3_strifeChange(_oldS, GM.partyStrife));
  } else if (choice === 'yield') {
    var topic = (CY._ty2 && CY._ty2.topic) || (CY._ty3 && CY._ty3.topic) || '';
    if (topic) {
      if (!GM._ccHeldItems) GM._ccHeldItems = [];
      GM._ccHeldItems.push({ topic: topic, from: '危诏妥协', turn: GM.turn });
    }
    if (typeof toast === 'function') toast('妥协·议题入留中册');
  }
  var cb = CY._ty3_dgCallback;
  CY._ty3_dgCallback = null;
  if (typeof cb === 'function') cb(choice);
}

function _ty3_settleArchonGrade(decision, opts) {
  var info = _ty3_computeArchonGrade();
  var notes = _ty3_applyArchonGrade(info.grade, opts || {});
  CY._ty3_archonGrade = info.grade;
  if (typeof addCYBubble === 'function') {
    addCYBubble('内侍', '〔 钦定档位·' + info.grade + '·' + info.label + '·皇威 ' + info.hw + '·皇权 ' + info.hq + ' 〕', true);
    notes.forEach(function(n){ addCYBubble('内侍', '· ' + n, true); });
  }
  if (info.grade === 'D') {
    _ty3_dGradeChoice(function(/*choice*/) {
      _ty3_checkRegaliaUnlocks(info, opts);
    });
  } else {
    _ty3_checkRegaliaUnlocks(info, opts);
  }
  try {
    _ty3_phase14_recordChaoyiSummary(decision, opts || {});
  } catch (_summaryE) {
    try { window.TM && TM.errors && TM.errors.captureSilent(_summaryE, 'tinyi-record-chaoyi-summary'); } catch (_) {}
  }
  return info;
}
// ═══════════════════════════════════════════════════════════════════════
//  §5·威权阶梯永久解锁(GM.unlockedRegalia[])
// ═══════════════════════════════════════════════════════════════════════
// 设计：
//   - GM.unlockedRegalia[] 持久化·跨场廷议保留(失去高位也保留)
//   - 累计巅峰条件触发解锁·解锁后玩家可在廷议/平时使用对应特权
//   - 这是「正反馈循环 A·威权阶梯」的实现

var _ty3_REGALIA_DEFS = [
  { id: 'jin_kou_yu_yan', name: 'Golden Edict', cond: 'sCount>=5', desc: 'After 5 S-grade court debates, player speech gains +10 persuasion.', counter: 'sGradeCount' },
  { id: 'na_jian_ming_jun', name: 'Listening Ruler', cond: 'dResolved>=3', desc: 'After resolving 3 D-grade debates, unlocks one extra continuation option.', counter: 'dResolvedCount' },
  { id: 'tian_wei_hao_dang', name: 'High Majesty', cond: 'hwHigh>=5', desc: 'Majesty remains high for 5 turns; party cohesion pressure increases.', counter: 'hwHighStreak' },
  { id: 'qian_gang_du_yun', name: 'Sole Authority', cond: 'hqHigh>=5', desc: 'Authority remains high for 5 turns; pre-audit gains an extra confidential route.', counter: 'hqHighStreak' }
];

function _ty3_initRegaliaCounters() {
  if (!GM._regaliaCounters) GM._regaliaCounters = { sGradeCount: 0, dResolvedCount: 0, hwHighStreak: 0, hqHighStreak: 0 };
  if (!GM.unlockedRegalia) GM.unlockedRegalia = [];
}

function _ty3_isRegaliaUnlocked(id) {
  if (!GM.unlockedRegalia) return false;
  return GM.unlockedRegalia.indexOf(id) >= 0;
}

function _ty3_checkRegaliaUnlocks(info, opts) {
  _ty3_initRegaliaCounters();
  var cnt = GM._regaliaCounters;
  if (info && info.grade === 'S') cnt.sGradeCount = (cnt.sGradeCount || 0) + 1;
  if (info && info.grade === 'D') cnt.dResolvedCount = (cnt.dResolvedCount || 0) + 1;
  var newlyUnlocked = [];
  _ty3_REGALIA_DEFS.forEach(function(def) {
    if (_ty3_isRegaliaUnlocked(def.id)) return;
    var eligible = false;
    if (def.cond === 'sCount>=5') eligible = (cnt.sGradeCount || 0) >= 5;
    else if (def.cond === 'dResolved>=3') eligible = (cnt.dResolvedCount || 0) >= 3;
    else if (def.cond === 'hwHigh>=5') eligible = (cnt.hwHighStreak || 0) >= 5;
    else if (def.cond === 'hqHigh>=5') eligible = (cnt.hqHighStreak || 0) >= 5;
    if (eligible) {
      GM.unlockedRegalia.push(def.id);
      newlyUnlocked.push(def);
    }
  });
  newlyUnlocked.forEach(function(def) {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '★ 永业解锁·【' + def.name + '】 ' + def.desc, true);
    if (typeof toast === 'function') toast('★ 解锁·' + def.name);
    if (typeof addEB === 'function') addEB('威权阶梯', '永业解锁：' + def.name + '——' + def.desc);
  });
}

function _ty3_tickRegaliaStreaks() {
  _ty3_initRegaliaCounters();
  var hw = _ty3_readHuangwei();
  var hq = _ty3_readHuangquan();
  var cnt = GM._regaliaCounters;
  cnt.hwHighStreak = (hw >= 80) ? (cnt.hwHighStreak || 0) + 1 : 0;
  cnt.hqHighStreak = (hq >= 80) ? (cnt.hqHighStreak || 0) + 1 : 0;
  _ty3_checkRegaliaUnlocks(null, null);
}

function _ty3_renderRegaliaList() {
  _ty3_initRegaliaCounters();
  var cnt = GM._regaliaCounters || {};
  var html = '<div class="ty3-rg-list">';
  html += '<div class="ty3-rg-title">威 权 阶 梯·永业解锁</div>';
  _ty3_REGALIA_DEFS.forEach(function(def) {
    var u = _ty3_isRegaliaUnlocked(def.id);
    var prog = '';
    if (def.counter && cnt[def.counter] != null) {
      var need = (def.cond === 'sCount>=5') ? 5 : (def.cond === 'dResolved>=3') ? 3 : 5;
      prog = ' (' + Math.min(cnt[def.counter], need) + '/' + need + ')';
    }
    html += '<div class="ty3-rg-item ' + (u ? 'unlocked' : 'locked') + '">';
    html += '<div class="ty3-rg-icon">' + (u ? 'U' : 'L') + '</div>';
    html += '<div class="ty3-rg-info">';
    html += '<div class="ty3-rg-name">' + def.name + (u ? '' : prog) + '</div>';
    html += '<div class="ty3-rg-desc">' + def.desc + '</div>';
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}
(function _ty3_installSettleHook() {
  if (typeof window === 'undefined') return;
  var attempts = 0;
  function tryHook() {
    if (attempts++ > 20) return;
    if (typeof window._ty2_decide !== 'function') {
      setTimeout(tryHook, 200);
      return;
    }
    if (window._ty2_decide._ty3Hooked) return;
    var orig = window._ty2_decide;
    window._ty2_decide = async function(mode) {
      try {
        await orig.call(this, mode);
      } catch (e) {
        try { window.TM && TM.errors && TM.errors.captureSilent(e, 'tm-tinyi-v3'); } catch (_) {}
      }
      if (mode === 'defer') return;

      try {
        var meta = (window._ty3_publicMeta) || (CY._ty3 && CY._ty3.meta);
        if (meta && meta.isAccusation && meta.accusationType === 'clique' && meta.accused) {
          var counts = (typeof _ty2_countStances === 'function') ? _ty2_countStances() : { support: 0, oppose: 0 };
          var wasApproved = false;
          if (mode === 'majority') wasApproved = counts.support >= counts.oppose;
          else if (mode === 'override') wasApproved = counts.support < counts.oppose;
          else if (mode === 'mediation') wasApproved = false;

          var accuMemo = null;
          if (meta.memorialId && Array.isArray(GM._pendingMemorials)) {
            accuMemo = GM._pendingMemorials.find(function(m) { return m && m.id === meta.memorialId; });
          }

          if (wasApproved) {
            var accusedList = Array.isArray(meta.accused) ? meta.accused.slice() : [meta.accused];
            try {
              var firstCh = (typeof findCharByName === 'function') ? findCharByName(accusedList[0]) : null;
              if (firstCh && firstCh.party) {
                var origP = _ty3_getPartyObj(firstCh.party);
                if (origP && (parseInt(origP.cohesion, 10) || 50) < 30) {
                  _ty3_getPartyMembers(firstCh.party).slice(0, 3).forEach(function(m) {
                    if (m.name !== accusedList[0] && accusedList.indexOf(m.name) < 0) accusedList.push(m.name);
                  });
                }
              }
            } catch (_) {}
            _ty3_phase12_onAccusationApproved(meta.topic || (CY._ty2 && CY._ty2.topic), accusedList, meta.accuser, meta);
            if (accuMemo) { accuMemo.status = 'approved'; accuMemo.reply = 'accusation approved'; }
          } else {
            if (meta.accuser) {
              var accCh = (typeof findCharByName === 'function') ? findCharByName(meta.accuser) : null;
              if (accCh) {
                accCh.prestige = Math.max(0, (accCh.prestige || 50) - 5);
                if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 弹章驳回·' + meta.accuser + ' 名声受损 〕', true);
              }
            }
            var accCh2 = (typeof findCharByName === 'function') ? findCharByName(meta.accused) : null;
            if (accCh2) accCh2.prestige = Math.min(100, (accCh2.prestige || 50) + 3);
            if (accuMemo) { accuMemo.status = 'rejected'; accuMemo.reply = 'accusation rejected'; }
          }
        }
      } catch (_e) {
        try { window.TM && TM.errors && TM.errors.captureSilent(_e, 'tm-tinyi-v3-accusation-hook'); } catch (__) {}
      }

      var proposerParty = '';
      if (CY._ty2 && CY._ty2._publicMeta && CY._ty2._publicMeta.proposer) {
        var ch1 = (typeof findCharByName === 'function') ? findCharByName(CY._ty2._publicMeta.proposer) : null;
        if (ch1 && ch1.party) proposerParty = ch1.party;
      }
      if (!proposerParty && window._ty3_publicMeta && window._ty3_publicMeta.proposerParty) {
        proposerParty = window._ty3_publicMeta.proposerParty;
      }
      if (!proposerParty && CY._ty2 && Array.isArray(CY._ty2.attendees) && CY._ty2.attendees.length > 0) {
        var maxP = -1;
        CY._ty2.attendees.forEach(function(nm) {
          var c = (typeof findCharByName === 'function') ? findCharByName(nm) : null;
          if (c && c.party && (c.prestige || 50) > maxP) { maxP = c.prestige || 50; proposerParty = c.party; }
        });
      }

      var opposingParties = [];
      if (proposerParty) {
        var enemies = _ty3_getOpposingParties(proposerParty);
        opposingParties = enemies.map(function(e) { return e.name; });
      }
      _ty3_settleArchonGrade(
        { mode: mode, decision: (CY._ty2 || {}).decision },
        {
          proposerParty: proposerParty,
          opposingParties: opposingParties,
          decisionMode: mode,
          topic: (CY._ty2 || {}).topic
        }
      );
    };
    window._ty2_decide._ty3Hooked = true;
  }
  tryHook();
})();
(function _ty3_overrideTinyiRoute() {
  if (typeof window === 'undefined') return;
  var attempts = 0;
  function tryOverride() {
    if (attempts++ > 20) return;
    if (typeof window._cy_pickMode !== 'function') {
      setTimeout(tryOverride, 200);
      return;
    }
    if (window._cy_pickMode._ty3Override) return;
    var orig = window._cy_pickMode;
    window._cy_pickMode = function(mode) {
      if (mode === 'tinyi') {
        if (typeof CY !== 'undefined') CY.mode = mode;
        _ty3_open();
        return;
      }
      return orig.apply(this, arguments);
    };
    window._cy_pickMode._ty3Override = true;
  }
  tryOverride();
})();

// Expose Tinyi v3 APIs on window.
if (typeof window !== 'undefined') {
  window._ty3_open = _ty3_open;
  window._ty3_openPreAudit = _ty3_openPreAudit;
  window._ty3_paPickPending = _ty3_paPickPending;
  window._ty3_paUpdateProposer = _ty3_paUpdateProposer;
  window._ty3_paChoose = _ty3_paChoose;
  window._ty3_paCancel = _ty3_paCancel;
  window._ty3_paUpdateForecast = _ty3_paUpdateForecast;
  window._ty3_doInterjectTrain = _ty3_doInterjectTrain;
  window._ty3_doInterjectSummon = _ty3_doInterjectSummon;
  window._ty3_doInterjectPartyLeader = _ty3_doInterjectPartyLeader;
  window._ty3_doInterjectSilence = _ty3_doInterjectSilence;
  window._ty3_doInterjectAbort = _ty3_doInterjectAbort;
  window._ty3_dgPick = _ty3_dgPick;
  window._ty3_settleArchonGrade = _ty3_settleArchonGrade;
  window._ty3_computeArchonGrade = _ty3_computeArchonGrade;
  window._ty3_tickRegaliaStreaks = _ty3_tickRegaliaStreaks;
  window._ty3_renderRegaliaList = _ty3_renderRegaliaList;
  window._ty3_isRegaliaUnlocked = _ty3_isRegaliaUnlocked;
  window._ty3_getPartyObj = _ty3_getPartyObj;
  window._ty3_getPartyMembers = _ty3_getPartyMembers;
  window._ty3_getPartyLeader = _ty3_getPartyLeader;
  window._ty3_partyStanceOnTopic = _ty3_partyStanceOnTopic;
  // Party strife bookkeeping for Tinyi state and UI summaries.
  window._ty3_strifeLabel = _ty3_strifeLabel;
  window._ty3_strifeDelta = _ty3_strifeDelta;
  window._ty3_strifeChange = _ty3_strifeChange;
}

// R118 鍛藉悕绌洪棿娉ㄥ唽(鑻ユ湁)
try {
  if (typeof TM !== 'undefined' && TM.register) {
    TM.register('TinyiV3', {
      open: _ty3_open,
      computeGrade: _ty3_computeArchonGrade,
      settle: _ty3_settleArchonGrade,
      tickStreaks: _ty3_tickRegaliaStreaks,
      isUnlocked: _ty3_isRegaliaUnlocked,
      regaliaList: _ty3_renderRegaliaList,
      getPartyObj: _ty3_getPartyObj,
      getPartyMembers: _ty3_getPartyMembers,
      strifeLabel: _ty3_strifeLabel,
      strifeDelta: _ty3_strifeDelta,
      strifeChange: _ty3_strifeChange
    });
  }
} catch(_) {}

// ═══════════════════════════════════════════════════════════════════════
//  §7·阶段 1·起议站班(三班布局 + 潮汐条) — 波 2
// ═══════════════════════════════════════════════════════════════════════
// 接 §3 议前预审「明发」分支·按党派立场+党魁/盟敌关系自动分三班·
// 显示左班(支持/同盟方) / 右班(反对方) / 中班(中立·分化) + 潮汐条·
// 玩家点「开议」进入 §8 分轮辩议

function _ty3_phase1_openSeating(topic, meta) {
  if (!topic) return;
  var proposerName = (meta && meta.proposer) || '';
  var proposerCh = proposerName ? (typeof findCharByName === 'function' ? findCharByName(proposerName) : null) : null;
  var proposerParty = proposerCh && proposerCh.party ? proposerCh.party : '';

  function _ty3_isEligibleOfficial(c) {
    if (!c || c.alive === false || c.isPlayer) return false;
    if (c._imprisoned || c._exiled || c._retired || c._fled || c._mourning) return false;
    if (c._sick && (c.health || 50) <= 20) return false;
    var rawTitle = c.officialTitle || c.title || '';
    if (!rawTitle) return false;
    if (typeof _ty3_isHaremTitle === 'function' && _ty3_isHaremTitle(rawTitle)) return false;
    if (typeof _isAtCapital === 'function' && !_isAtCapital(c)) return false;
    if (typeof _isPlayerFactionChar === 'function' && !_isPlayerFactionChar(c)) return false;
    return true;
  }

  function _ty3_rankOf(c) {
    if (typeof getRankLevel === 'function' && typeof _cyGetRank === 'function') return getRankLevel(_cyGetRank(c));
    return 99;
  }

  var attendees = (GM.chars || []).filter(function(c) { return _ty3_isEligibleOfficial(c) && _ty3_rankOf(c) <= 12; });
  if (attendees.length < 5) attendees = (GM.chars || []).filter(function(c) { return _ty3_isEligibleOfficial(c) && _ty3_rankOf(c) <= 14; });
  if (attendees.length === 0) {
    if (typeof toast === 'function') toast('无合宜廷臣可用');
    var bg0 = document.getElementById('ty3-preaudit-bg');
    if (bg0) bg0.remove();
    if (typeof closeChaoyi === 'function') closeChaoyi();
    return;
  }

  if (!proposerName) {
    proposerCh = attendees.slice().sort(function(a, b) { return (b.prestige || 50) - (a.prestige || 50); })[0];
    proposerName = proposerCh ? proposerCh.name : '';
    proposerParty = proposerCh && proposerCh.party ? proposerCh.party : '';
  }

  var alliesPN = [];
  var enemiesPN = [];
  if (proposerParty) {
    var proposerPartyObj = _ty3_getPartyObj(proposerParty) || {};
    alliesPN = [proposerParty].concat(proposerPartyObj.allies || []);
    enemiesPN = proposerPartyObj.enemies || [];
  }

  var bench = { left: [], center: [], right: [] };
  attendees.forEach(function(c) {
    var partyName = c.party || '';
    var sideByParty = '';
    if (partyName) {
      if (alliesPN.indexOf(partyName) >= 0) sideByParty = 'left';
      else if (enemiesPN.indexOf(partyName) >= 0) sideByParty = 'right';
    }
    if (!sideByParty && partyName) {
      var stance = _ty3_partyStanceOnTopic(partyName, topic);
      if (stance === 'support') sideByParty = 'left';
      else if (stance === 'oppose') sideByParty = 'right';
    }
    if (!sideByParty) sideByParty = 'center';
    bench[sideByParty].push({ name: c.name, party: partyName, prestige: c.prestige || 50, ch: c });
  });

  var leftSum = 0, rightSum = 0, centerSum = 0;
  bench.left.forEach(function(x) { leftSum += x.party ? _ty3_partyInfluence(x.party) : 30; });
  bench.right.forEach(function(x) { rightSum += x.party ? _ty3_partyInfluence(x.party) : 30; });
  bench.center.forEach(function(x) { centerSum += x.party ? _ty3_partyInfluence(x.party) : 30; });
  var totalSum = leftSum + rightSum + centerSum;
  var leftPct = totalSum > 0 ? Math.round(leftSum / totalSum * 100) : 0;
  var rightPct = totalSum > 0 ? Math.round(rightSum / totalSum * 100) : 0;
  var centerPct = totalSum > 0 ? Math.max(0, 100 - leftPct - rightPct) : 0;

  var bg = document.createElement('div');
  bg.id = 'ty3-seating-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  var html = '<div class="ty3-st-modal">';
  html += '<div class="ty3-st-title">〔 起 议 站 班 〕</div>';
  html += '<div class="ty3-st-topic">议  题：' + escHtml(topic) + '</div>';
  if (proposerName) html += '<div class="ty3-st-proposer">主奏者：' + escHtml(proposerName) + (proposerParty ? '（' + escHtml(proposerParty) + '·影响力 ' + _ty3_partyInfluence(proposerParty) + '）' : '') + '</div>';
  html += '<div class="ty3-st-tide">';
  html += '<div class="ty3-st-tide-label">朝堂潮汐</div>';
  html += '<div class="ty3-st-tide-bar">';
  if (totalSum > 0) {
    html += '<div class="ty3-st-tide-l" style="width:' + leftPct + '%">' + (leftPct >= 8 ? '同 ' + leftPct + '%' : '') + '</div>';
    html += '<div class="ty3-st-tide-c" style="width:' + centerPct + '%">' + (centerPct >= 8 ? '中 ' + centerPct + '%' : '') + '</div>';
    html += '<div class="ty3-st-tide-r" style="width:' + rightPct + '%">' + (rightPct >= 8 ? '反 ' + rightPct + '%' : '') + '</div>';
  }
  html += '</div></div>';

  // 三班布局
  html += '<div class="ty3-st-benches">';
  html += _ty3_renderBench('left', '左班·同' + (proposerParty?'·'+proposerParty+'+盟':''), bench.left, leftSum);
  html += _ty3_renderBench('center', '中班·中立', bench.center, centerSum);
  html += _ty3_renderBench('right', '右班·异', bench.right, rightSum);
  html += '</div>';

  html += '<div class="ty3-st-foot">';
  html += '<button class="bt bp" onclick="_ty3_phase1_startDebate()">⚔ 开 议</button>';
  html += '<button class="bt" onclick="_ty3_phase1_cancel()">罢·改日再议</button>';
  html += '</div>';
  html += '</div>';

  bg.innerHTML = html;
  document.body.appendChild(bg);

  if (typeof CY !== 'undefined') {
    CY._ty3 = {
      topic: topic,
      meta: meta,
      proposer: proposerName,
      proposerParty: proposerParty,
      attendees: attendees.map(function(c) { return c.name; }),
      bench: bench,
      tide: { left: leftPct, center: centerPct, right: rightPct },
      stances: {},
      currentRound: 0
    };
    attendees.forEach(function(c) { CY._ty3.stances[c.name] = { current: 'neutral', confidence: 0 }; });
  }
}

function _ty3_renderBench(side, label, items, sumInfl) {
  var html = '<div class="ty3-st-bench ty3-st-bench-' + side + '">';
  html += '<div class="ty3-st-bench-head">' + escHtml(label) + '<span class="ty3-st-bench-count">' + items.length + ' officials, influence ' + sumInfl + '</span></div>';
  if (items.length === 0) {
    html += '<div class="ty3-st-bench-empty">（无人）</div>';
  } else {
    var byParty = {};
    items.forEach(function(it) {
      var key = it.party || 'No Party';
      if (!byParty[key]) byParty[key] = [];
      byParty[key].push(it);
    });
    Object.keys(byParty).forEach(function(pn) {
      html += '<div class="ty3-st-party">';
      html += '<div class="ty3-st-party-head">' + escHtml(pn) + '<span>' + byParty[pn].length + '</span></div>';
      html += '<div class="ty3-st-party-mems">';
      byParty[pn].forEach(function(it) { html += '<span class="ty3-st-mem">' + escHtml(it.name) + '</span>'; });
      html += '</div></div>';
    });
  }
  html += '</div>';
  return html;
}

function _ty3_phase1_cancel() {
  var bg = document.getElementById('ty3-seating-bg');
  if (bg) bg.remove();
  if (typeof CY !== 'undefined') CY._ty3 = null;
  _ty3_hideInterjectButton();
  if (typeof closeChaoyi === 'function') closeChaoyi();
}

function _ty3_phase1_startDebate() {
  var bg = document.getElementById('ty3-seating-bg');
  if (bg) bg.remove();
  if (!CY._ty3) return;
  CY._ty2 = {
    topic: CY._ty3.topic,
    topicType: (CY._ty3.meta && CY._ty3.meta.topicType) || 'other',
    topicCustom: '',
    attendees: CY._ty3.attendees.slice(),
    stances: {},
    stanceHistory: [],
    roundNum: 0,
    currentPhase: 'opening',
    decision: null,
    _publicMeta: { proposer: CY._ty3.proposer, proposerParty: CY._ty3.proposerParty },
    _economyReform: CY._ty3.meta && CY._ty3.meta._economyReform,
    _reformType: CY._ty3.meta && CY._ty3.meta.reformType,
    _reformId: CY._ty3.meta && CY._ty3.meta.reformId
  };
  CY._ty3.attendees.forEach(function(n) { CY._ty2.stances[n] = { current: 'neutral', initial: 'neutral', locked: false, confidence: 0 }; });
  CY.phase = 'tinyi3';
  if (typeof showChaoyiSetup === 'function' && !document.getElementById('cy-body')) {
    showChaoyiSetup();
    setTimeout(function() { _ty3_phase2_run(); }, 50);
  } else {
    _ty3_phase2_run();
  }
}
var TY3_HAREM_TITLE_RE = /(皇后|贵妃|淑妃|德妃|贤妃|妃|嫔|才人|选侍|淑人|常在|答应|宫人|乳母|奉圣夫人|国夫人|郡夫人|县君|乡君|公主|郡主|县主|太后|太妃|王妃)/;
function _ty3_isHaremTitle(title) {
  if (!title) return false;
  return TY3_HAREM_TITLE_RE.test(String(title));
}

/** Render/update the Tinyi speech progress bar. */
function _ty3_progRender(done, total, label) {
  var body = (typeof _$ === 'function') ? _$('cy-body') : document.getElementById('cy-body');
  if (!body) return;
  var pct = total > 0 ? Math.round(done / total * 100) : 0;
  var prog = document.getElementById('ty3-prog');
  var html = ''
    + '<div style="color:var(--gold-400);font-size:0.7rem;margin-bottom:3px;">'
    + escHtml(label || 'Progress') + ' - ' + done + ' / ' + total
    + '</div>'
    + '<div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">'
    + '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,var(--celadon-400),var(--gold-400));transition:width 0.3s ease;"></div>'
    + '</div>';
  if (!prog) {
    prog = document.createElement('div');
    prog.id = 'ty3-prog';
    prog.style.cssText = 'position:sticky;top:42px;z-index:9;background:var(--color-elevated);border:1px solid var(--color-border-subtle);border-radius:var(--radius-sm);padding:6px 10px;margin-bottom:6px;';
    var board = document.getElementById('ty2-stance-board');
    if (board && board.parentNode) board.parentNode.insertBefore(prog, board.nextSibling);
    else if (body.firstChild) body.insertBefore(prog, body.firstChild);
    else body.appendChild(prog);
  }
  prog.innerHTML = html;
}function _ty3_progClear() {
  var prog = document.getElementById('ty3-prog');
  if (prog && prog.parentNode) prog.parentNode.removeChild(prog);
}

/** 兜底选人：当三班分坐选不出人时（议题无主奏党/全员中立等）·按 prestige 取核心廷臣
 *  避免出现"4 轮 0 人发言→直接结束"的尴尬 */
function _ty3_pickFallbackSpeakers(excludeNames, n) {
  if (!CY._ty3 || !Array.isArray(CY._ty3.attendees)) return [];
  var ex = (excludeNames||[]).slice();
  var pool = CY._ty3.attendees
    .map(function(nm){ return (typeof findCharByName === 'function') ? findCharByName(nm) : null; })
    .filter(function(c){ return c && c.alive !== false && ex.indexOf(c.name) < 0; })
    .sort(function(a,b){ return (b.prestige||50) - (a.prestige||50); });
  return pool.slice(0, n||5).map(function(c){ return c.name; });
}

async function _ty3_phase2_run() {
  if (!CY._ty3 || !CY._ty2) return;
  var body = (typeof _$ === 'function') ? _$('cy-body') : document.getElementById('cy-body');
  if (body) body.innerHTML = '';
  var topicEl = (typeof _$ === 'function') ? _$('cy-topic') : document.getElementById('cy-topic');
  if (topicEl) { topicEl.style.display = 'block'; topicEl.innerHTML = '🏛 廷议·' + escHtml(CY._ty3.topic); }

  if (typeof addCYBubble === 'function') {
    addCYBubble('内侍', '〔 三班已立·同 ' + CY._ty3.bench.left.length + '·中 ' + CY._ty3.bench.center.length + '·反 ition ' + CY._ty3.bench.right.length + '.', true);
    addCYBubble('皇帝', '议：' + CY._ty3.topic, false);
  }

  CY._abortChaoyi = false;
  CY._pendingPlayerLine = null;
  CY._ty3_pendingSummon = null;
  if (typeof _cyShowInputRow === 'function') _cyShowInputRow(true);
  if (typeof _ty2_render === 'function') _ty2_render();

  var prevSpeeches = [];
  var alliedSpeakers = _ty3_pickAlliedSpeakers();
  var enemySpeakers = _ty3_pickEnemySpeakers();
  var arbiterSpeakers = _ty3_pickArbiterSpeakers();
  var benchSpeakerCount = (CY._ty3.proposer ? 1 : 0) + alliedSpeakers.length + enemySpeakers.length + arbiterSpeakers.length;
  var fallbackSpeakers = [];
  if (benchSpeakerCount < 3) {
    var used = [].concat(CY._ty3.proposer ? [CY._ty3.proposer] : [], alliedSpeakers, enemySpeakers, arbiterSpeakers);
    fallbackSpeakers = _ty3_pickFallbackSpeakers(used, Math.max(5, 8 - benchSpeakerCount));
    if (fallbackSpeakers.length > 0 && typeof addCYBubble === 'function') addCYBubble('内侍', '〔 兜底补员：' + fallbackSpeakers.length, true);
  }

  var totalSpeakers = benchSpeakerCount + fallbackSpeakers.length;
  var doneSpeakers = 0;
  _ty3_progRender(doneSpeakers, totalSpeakers, '群臣讨论中');

  async function _runOneSpeaker(name, roundNum) {
    if (!name) return;
    if (await _ty3_handlePlayerInterject(prevSpeeches)) { /* player interjected */ }
    var nm = CY._ty3_pendingSummon || name;
    CY._ty3_pendingSummon = null;
    var r = await _ty3_safeGenSpeech(nm, roundNum, prevSpeeches);
    if (r) prevSpeeches.push({ name: nm, stance: r.stance, line: r.line });
    doneSpeakers++;
    _ty3_progRender(doneSpeakers, totalSpeakers, '群臣讨论中');
  }

  CY._ty2.roundNum = 1;
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 第一轮·主奏起议 〕', true);
  if (CY._ty3.proposer && typeof _ty2_genOneSpeech === 'function') await _runOneSpeaker(CY._ty3.proposer, 1);
  if (CY._abortChaoyi) { _ty3_progClear(); return _ty3_phase2_finalize(prevSpeeches); }

  CY._ty2.roundNum = 2;
  if (typeof _ty2_render === 'function') _ty2_render();
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 第二轮·同党附议 〕', true);
  for (var i = 0; i < alliedSpeakers.length; i++) {
    if (CY._abortChaoyi) break;
    await _runOneSpeaker(alliedSpeakers[i], 2);
  }
  if (CY._abortChaoyi) { _ty3_progClear(); return _ty3_phase2_finalize(prevSpeeches); }

  CY._ty2.roundNum = 3;
  if (typeof _ty2_render === 'function') _ty2_render();
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 第三轮·敌党驳议 〕', true);
  for (var j = 0; j < enemySpeakers.length; j++) {
    if (CY._abortChaoyi) break;
    await _runOneSpeaker(enemySpeakers[j], 3);
  }
  if (CY._abortChaoyi) { _ty3_progClear(); return _ty3_phase2_finalize(prevSpeeches); }

  CY._ty2.roundNum = 4;
  if (typeof _ty2_render === 'function') _ty2_render();
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 第四轮·中立权衡 〕', true);
  for (var k = 0; k < arbiterSpeakers.length; k++) {
    if (CY._abortChaoyi) break;
    await _runOneSpeaker(arbiterSpeakers[k], 4);
  }

  if (fallbackSpeakers.length > 0 && !CY._abortChaoyi) {
    CY._ty2.roundNum = 5;
    if (typeof _ty2_render === 'function') _ty2_render();
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 兜底轮·核心廷臣循资陈议 〕', true);
    for (var m = 0; m < fallbackSpeakers.length; m++) {
      if (CY._abortChaoyi) break;
      await _runOneSpeaker(fallbackSpeakers[m], 5);
    }
  }

  _ty3_progClear();
  return _ty3_phase2_finalize(prevSpeeches);
}
async function _ty3_safeGenSpeech(name, roundNum, prevSpeeches) {
  if (!name) return null;
  if (typeof _ty2_genOneSpeech !== 'function') return null;
  try {
    var r = await _ty2_genOneSpeech(name, roundNum, prevSpeeches);
    if (r && r.stance && CY._ty2 && CY._ty2.stances && CY._ty2.stances[name]) {
      CY._ty2.stances[name].current = r.stance;
      if (r.confidence != null) CY._ty2.stances[name].confidence = r.confidence;
    }
    if (typeof _ty2_render === 'function') _ty2_render();
    return r;
  } catch(e) {
    try { window.TM && TM.errors && TM.errors.captureSilent(e, 'tm-tinyi-v3'); } catch(_) {}
    return null;
  }
}

async function _ty3_handlePlayerInterject(prevSpeeches) {
  if (!CY || !CY._pendingPlayerLine) return false;
  var line = CY._pendingPlayerLine;
  CY._pendingPlayerLine = null;
  if (typeof _ty2_playerTriggeredResponse === 'function') {
    try { await _ty2_playerTriggeredResponse(line); } catch(_){}
  }
  return true;
}

function _ty3_pickAlliedSpeakers() {
  if (!CY._ty3) return [];
  var bench = CY._ty3.bench || { left:[] };
  // 去掉主奏者
  var pool = bench.left.filter(function(x){ return x.name !== CY._ty3.proposer; });
  // 按 cohesion 决定附议人数(最多 3 人)
  var coh = CY._ty3.proposerParty ? _ty3_partyCohesion(CY._ty3.proposerParty) : 50;
  var n = coh >= 70 ? 3 : coh >= 50 ? 2 : 1;
  // 优先党魁 + 高 prestige
  pool.sort(function(a, b) {
    var aLeader = (a.party && _ty3_getPartyObj(a.party)?.leader === a.name) ? 1 : 0;
    var bLeader = (b.party && _ty3_getPartyObj(b.party)?.leader === b.name) ? 1 : 0;
    if (aLeader !== bLeader) return bLeader - aLeader;
    return (b.prestige||0) - (a.prestige||0);
  });
  return pool.slice(0, n).map(function(x){return x.name;});
}

function _ty3_pickEnemySpeakers() {
  if (!CY._ty3) return [];
  var bench = CY._ty3.bench || { right:[] };
  // 取右班·优先党魁 + 高 prestige
  var pool = bench.right.slice();
  pool.sort(function(a, b) {
    var aLeader = (a.party && _ty3_getPartyObj(a.party)?.leader === a.name) ? 1 : 0;
    var bLeader = (b.party && _ty3_getPartyObj(b.party)?.leader === b.name) ? 1 : 0;
    if (aLeader !== bLeader) return bLeader - aLeader;
    return (b.prestige||0) - (a.prestige||0);
  });
  // loyalty<60 者也加入(强反对)
  var lowLoyal = (GM.chars||[]).filter(function(c){
    if (c.alive===false || c.isPlayer) return false;
    if ((c.loyalty||50) >= 60) return false;
    if (CY._ty3.attendees.indexOf(c.name) < 0) return false;
    if (pool.some(function(x){return x.name===c.name;})) return false;
    return true;
  });
  pool = pool.slice(0, 2);
  if (lowLoyal.length > 0) pool.push({ name: lowLoyal[0].name, party: lowLoyal[0].party, prestige: lowLoyal[0].prestige });
  return pool.slice(0, 3).map(function(x){return x.name;});
}

function _ty3_pickArbiterSpeakers() {
  if (!CY._ty3) return [];
  var bench = CY._ty3.bench || { center:[] };
  // 中班党魁 + 任意 prestige>=70 老臣
  var byParty = {};
  bench.center.forEach(function(x) {
    if (x.party && !byParty[x.party]) byParty[x.party] = x;
  });
  var arbs = Object.values(byParty);
  // 加 prestige>=70 老臣(任意班次)
  var senior = (GM.chars||[]).filter(function(c){
    if (!c || c.alive===false || c.isPlayer) return false;
    if (CY._ty3.attendees.indexOf(c.name) < 0) return false;
    if ((c.prestige||50) < 70) return false;
    if (arbs.some(function(x){return x.name===c.name;})) return false;
    return true;
  }).sort(function(a,b){return (b.prestige||0)-(a.prestige||0);}).slice(0, 1);
  arbs = arbs.concat(senior.map(function(c){return { name: c.name, party: c.party, prestige: c.prestige };}));
  return arbs.slice(0, 3).map(function(x){return x.name;});
}

/** 判断是否分歧严重：支持与反对都 ≥ 25%（两端拉锯）·或 待定 ≥ 40%（说明发言不充分） */
function _ty3_isControversial() {
  if (!CY._ty2 || !CY._ty2.stances) return false;
  var st = CY._ty2.stances;
  var counts = { support:0, oppose:0, neutral:0, mediate:0, pending:0 };
  Object.keys(st).forEach(function(n) {
    var s = st[n].current || '待定';
    if (s === '待定') counts.pending++;
    else if (/支持/.test(s)) counts.support++;
    else if (/反对/.test(s)) counts.oppose++;
    else if (s === '折中' || s === '另提议') counts.mediate++;
    else counts.neutral++;
  });
  var total = counts.support + counts.oppose + counts.neutral + counts.mediate + counts.pending;
  if (total === 0) return false;
  // 待定 >= 40% 说明发言不充分·应再议
  if (counts.pending / total >= 0.4) return true;
  var spoken = total - counts.pending;
  if (spoken === 0) return false;
  // 两端都 >= 25%·拉锯分歧
  return (counts.support / spoken >= 0.25) && (counts.oppose / spoken >= 0.25);
}

/** 玩家点"再议一轮"·从 attendees 中取尚未发言或 prestige 高的 5 人再发一轮 */
async function _ty3_continueDebate() {
  if (!CY._ty3 || !CY._ty2) return;
  var btn = document.getElementById('ty3-continue-btn');
  if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
  var st = CY._ty2.stances || {};
  // 优先 still 待定者·其次 prestige 高者
  var pending = (CY._ty3.attendees||[]).filter(function(n){ return st[n] && st[n].current === '待定'; });
  var prevSpeeches = [];
  CY._ty2.roundNum = (CY._ty2.roundNum||4) + 1;
  if (typeof _ty2_render === 'function') _ty2_render();
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 续 议 ' + (CY._ty2.roundNum - 4) + ' 轮 〕', true);
  var pickList = pending.length > 0
    ? pending.slice(0, 5)
    : _ty3_pickFallbackSpeakers([], 5);
  var total = pickList.length;
  var done = 0;
  if (total > 0) _ty3_progRender(done, total, '续议中');
  for (var i = 0; i < pickList.length; i++) {
    if (CY._abortChaoyi) break;
    var nm = pickList[i];
    var r = await _ty3_safeGenSpeech(nm, CY._ty2.roundNum, prevSpeeches);
    if (r) prevSpeeches.push({ name: nm, stance: r.stance, line: r.line });
    done++;
    _ty3_progRender(done, total, '续议中');
  }
  _ty3_progClear();
  // 续议毕·再次走 finalize·若仍分歧·按钮再现
  return _ty3_phase2_finalize(prevSpeeches);
}

/** 在 cy-body 插入"再议一轮"按钮（仅分歧严重时）*/
function _ty3_renderContinueBtn() {
  var body = (typeof _$ === 'function') ? _$('cy-body') : document.getElementById('cy-body');
  if (!body) return;
  // 已有按钮则先移除
  var old = document.getElementById('ty3-continue-btn');
  if (old && old.parentNode) old.parentNode.removeChild(old);
  var div = document.createElement('div');
  div.id = 'ty3-continue-btn';
  div.style.cssText = 'text-align:center;margin:12px 0;padding:8px;background:rgba(255,200,80,0.06);border:1px dashed var(--gold-400);border-radius:6px;';
  div.innerHTML = ''
    + '<div style="font-size:0.7rem;color:var(--ink-200);margin-bottom:6px;">百官立场分歧·或仍多人未陈奏</div>'
    + '<button class="bt bp" onclick="_ty3_continueDebate()" style="margin-right:8px;">⚔ 再 议 一 轮</button>'
    + '<button class="bt" onclick="(function(){var el=document.getElementById(\'ty3-continue-btn\');if(el&&el.parentNode)el.parentNode.removeChild(el);if(typeof _ty2_enterDecide===\'function\')_ty2_enterDecide();_ty3_checkConsensusEvent();})()">径取圣裁</button>';
  body.appendChild(div);
}

function _ty3_phase2_finalize(prevSpeeches) {
  CY._abortChaoyi = false;
  // 修复 2·人事议题先进廷推·再进决议
  var topic = (CY._ty3 && CY._ty3.topic) || (CY._ty2 && CY._ty2.topic) || '';
  var meta = (CY._ty3 && CY._ty3.meta) || null;
  if (typeof _ty3_phase3_isPersonnelTopic === 'function' && _ty3_phase3_isPersonnelTopic(topic, meta)) {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 议毕·进廷推候选 〕', true);
    setTimeout(function() {
      _ty3_phase3_open(topic, function(result) {
        // 廷推结果记入 CY._ty2.decision·让后续 settle 可访问
        if (result && CY._ty2) {
          CY._ty2._tuijianResult = result;
        }
        // 进决议
        if (typeof _ty2_enterDecide === 'function') {
          if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 廷推毕·请陛下圣裁 〕', true);
          _ty2_enterDecide();
        }
        _ty3_checkConsensusEvent();
      });
    }, 400);
    return;
  }
  // 非人事议题·分歧严重时先给"再议一轮"·否则直接进决议
  if (_ty3_isControversial()) {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 廷议未决·百官分歧·陛下可命再议或径裁 〕', true);
    _ty3_renderContinueBtn();
    return;
  }
  if (typeof _ty2_enterDecide === 'function') {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 议毕·请陛下圣裁 〕', true);
    _ty2_enterDecide();
  }
  _ty3_checkConsensusEvent();
}

// 共识检测：若第二轮同党附议 + 第三轮敌党中过半被说服(立场转 mediate 或 support)·触发"和衷共济"
function _ty3_checkConsensusEvent() {
  if (!CY._ty2 || !CY._ty2.stances) return;
  var counts = (typeof _ty2_countStances === 'function') ? _ty2_countStances() : null;
  if (!counts) return;
  var total = counts.support + counts.oppose + counts.neutral + counts.mediate;
  if (total === 0) return;
  if ((counts.support + counts.mediate) / total >= 0.7) {
    // 70%+ 倾向支持·触发和衷共济·朝堂渐和(党争-5)
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '★ 朝野同心·百官多附议·此为「和衷共济」之兆。', true);
    var _hsOld = (typeof GM.partyStrife === 'number') ? GM.partyStrife : 50;
    if (typeof GM.partyStrife === 'number') GM.partyStrife = Math.max(0, GM.partyStrife - 5);
    var _hsText = _ty3_strifeChange(_hsOld, GM.partyStrife);
    if (typeof toast === 'function') toast('和衷共济·' + _hsText);
    if (typeof addEB === 'function') addEB('廷议', '朝野同心·和衷共济·' + _hsText);
    // 主奏党 cohesion +3
    if (CY._ty3 && CY._ty3.proposerParty) {
      var pp = _ty3_getPartyObj(CY._ty3.proposerParty);
      if (pp) pp.cohesion = Math.min(100, (parseInt(pp.cohesion,10)||50) + 3);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  §9·阶段 5·草诏拟旨(选官 modal + prestige+favor 反馈) — 波 2
// ═══════════════════════════════════════════════════════════════════════
// 接 §4 档位应用之后(在 _ty3_settleArchonGrade 完成后)·
// 决议非「留待再议」时弹出草诏官选择 modal·
// 一般档位按 prestige 筛选·S 档可越级钦点

function _ty3_phase5_openDraftPicker(decision, archonGrade, opts) {
  if (!opts) opts = {};
  if (!decision || decision.mode === 'defer') return; // 留待再议无草诏
  var topic = (CY._ty2 && CY._ty2.topic) || '';
  if (!topic) return;
  var attendees = (CY._ty2 && CY._ty2.attendees) || [];

  // 候选池
  var allChars = (GM.chars||[]).filter(function(c){
    if (!c || c.alive===false || c.isPlayer) return false;
    return true;
  });

  // 一般规则：在场 + prestige>=50·允许中书科/翰林背景
  var normalCandidates = allChars.filter(function(c) {
    if (attendees.indexOf(c.name) < 0) return false;
    if ((c.prestige||50) < 50) return false;
    return true;
  });
  // 按惯例：中书/翰林/学士官职优先
  var conventional = normalCandidates.filter(function(c) {
    var t = c.officialTitle || c.title || '';
    return /中书|翰林|学士|侍读|侍讲|起居/.test(t);
  });
  // 主奏方
  var proposerParty = (opts.proposerParty || (CY._ty3 && CY._ty3.proposerParty) || '');
  var proposerSide = normalCandidates.filter(function(c){ return c.party === proposerParty && c.party; });

  // S 档专属：全任意官员(不限品级·不限 prestige)
  var isS = (archonGrade === 'S');
  var sFreeCandidates = isS ? allChars.slice() : [];

  var bg = document.createElement('div');
  bg.id = 'ty3-draft-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1310;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  var html = '<div class="ty3-dr-modal">';
  html += '<div class="ty3-dr-title">〔 草 诏 拟 旨 〕</div>';
  html += '<div class="ty3-dr-sub">议题「' + escHtml(topic) + '」议毕·钦点草诏官</div>';

  // 按惯例
  if (conventional.length > 0) {
    html += '<div class="ty3-dr-section"><div class="ty3-dr-sec-label">按惯例·中书翰林</div>';
    html += '<div class="ty3-dr-cands">';
    conventional.slice(0, 4).forEach(function(c) {
      html += '<div class="ty3-dr-cand" onclick="_ty3_phase5_pick(\'' + escAttr(c.name) + '\', \'conventional\')">';
      html += '<span class="ty3-dr-cand-name">' + escHtml(c.name) + '</span>';
      html += '<span class="ty3-dr-cand-meta">' + escHtml(c.officialTitle||c.title||'') + ' · 名望 ' + (c.prestige||50) + (c.party ? ' · ' + escHtml(c.party) : '') + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // 主奏方
  if (proposerSide.length > 0) {
    html += '<div class="ty3-dr-section"><div class="ty3-dr-sec-label">主奏方·' + escHtml(proposerParty) + '</div>';
    html += '<div class="ty3-dr-cands">';
    proposerSide.slice(0, 3).forEach(function(c) {
      html += '<div class="ty3-dr-cand" onclick="_ty3_phase5_pick(\'' + escAttr(c.name) + '\', \'proposer\')">';
      html += '<span class="ty3-dr-cand-name">' + escHtml(c.name) + '</span>';
      html += '<span class="ty3-dr-cand-meta">' + escHtml(c.officialTitle||c.title||'') + ' · 名望 ' + (c.prestige||50) + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // S 档·任意官员
  if (isS) {
    html += '<div class="ty3-dr-section ty3-dr-s-priv"><div class="ty3-dr-sec-label">★ S 档特权·钦点任意官员</div>';
    html += '<input id="ty3-dr-free-name" placeholder="键入任意在朝官员之名……" class="ty3-dr-free-input">';
    html += '<button class="bt bp ty3-dr-free-btn" onclick="_ty3_phase5_pickFree()">钦 定</button>';
    html += '</div>';
  }

  html += '<div class="ty3-dr-foot">';
  html += '<button class="bt" onclick="_ty3_phase5_skip()">免·循文牍流程</button>';
  html += '</div>';
  html += '</div>';

  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _ty3_buildDraftEdictBody(decision, grade, drafterName, dynasty) {
  var topic = (CY._ty2 && CY._ty2.topic) || (CY._ty3 && CY._ty3.topic) || '';
  var mode = decision && decision.mode ? decision.mode : 'unknown';
  var dyn = dynasty || (typeof _ty3_phase6_resolveDynasty === 'function' ? _ty3_phase6_resolveDynasty() : 'default');
  return [
    'Draft decree',
    'Topic: ' + topic,
    'Grade: ' + (grade || 'C'),
    'Mode: ' + mode,
    'Dynasty: ' + dyn,
    drafterName ? ('Drafter: ' + drafterName) : ''
  ].filter(Boolean).join('\n');
}

function _ty3_recordTinyiDraft(decision, grade, drafterName, drafterParty, source) {
  if (!CY._ty3) CY._ty3 = {};
  var dynasty = typeof _ty3_phase6_resolveDynasty === 'function' ? _ty3_phase6_resolveDynasty() : 'default';
  var draft = {
    id: 'draft_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
    topic: (CY._ty2 && CY._ty2.topic) || (CY._ty3 && CY._ty3.topic) || '',
    decision: decision || null,
    grade: grade || 'C',
    drafter: drafterName || '',
    drafterParty: drafterParty || '',
    source: source || '',
    dynasty: dynasty,
    draftTurn: GM.turn || 0,
    body: _ty3_buildDraftEdictBody(decision || {}, grade || 'C', drafterName || '', dynasty)
  };
  CY._ty3.draftEdict = draft;
  CY._ty3._draftEdict = draft;
  CY._ty3._draftedEdict = draft.body;
  if (CY._ty3.meta && typeof CY._ty3.meta === 'object') CY._ty3.meta.draftEdict = draft;
  if (CY._ty2 && typeof CY._ty2 === 'object') CY._ty2.draftEdict = draft;
  if (Array.isArray(GM.recentChaoyi) && GM.recentChaoyi[0]) GM.recentChaoyi[0].draftEdict = draft;
  return draft;
}

function _ty3_phase5_pick(name, source) {
  var bg = document.getElementById('ty3-draft-bg');
  if (bg) bg.remove();
  if (!name) return;
  var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
  if (!ch) { if (typeof toast === 'function') toast('查无此人'); return; }
  // 应用奖励
  ch.prestige = Math.min(100, (ch.prestige||50) + 3);
  ch.favor = Math.min(100, (ch.favor||0) + 5);
  if (ch.party) {
    var pp = _ty3_getPartyObj(ch.party);
    if (pp) pp.cohesion = Math.min(100, (parseInt(pp.cohesion,10)||50) + 3);
  }
  if (typeof addCYBubble === 'function') {
    var src = (source==='conventional') ? '惯例' : (source==='proposer') ? '主奏方' : (source==='s_free') ? 'S档钦定' : '钦定';
    addCYBubble('皇帝', '——着' + name + '草诏。（' + src + '·名望+3·恩眷+5）', false);
  }
  if (typeof toast === 'function') toast(name + ' 草诏·名望+3 恩眷+5');
  if (typeof addEB === 'function') addEB('草诏', name + ' 草诏 · ' + ((CY._ty2&&CY._ty2.topic)||''));
  // NPC 记忆
  try {
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      NpcMemorySystem.remember(name, '陛下钦点臣草诏「' + ((CY._ty2&&CY._ty2.topic)||'').slice(0,20) + '」·荣宠所至', '喜', 6);
    }
  } catch(_){}
  // 修复 1·链到下一阶段(用印)
  _ty3_advanceToSeal();
}

function _ty3_phase5_pickFree() {
  var inp = document.getElementById('ty3-dr-free-name');
  var name = inp && inp.value && inp.value.trim();
  if (!name) { if (typeof toast === 'function') toast('请输入官员之名'); return; }
  var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
  if (!ch || ch.alive === false) { if (typeof toast === 'function') toast('查无此人或已殁'); return; }
  _ty3_phase5_pick(name, 's_free');
}

function _ty3_phase5_skip() {
  var bg = document.getElementById('ty3-draft-bg');
  if (bg) bg.remove();
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '（陛下不点·诏命循文牍流程·中书科自办。）', true);
  // 修复 1·链到下一阶段(用印)
  _ty3_advanceToSeal();
}

// 修复 1·阶段链推进器·草诏完毕 → 用印颁行
function _ty3_advanceToSeal() {
  var ctx = CY._ty3_settleCtx;
  if (!ctx || !ctx.grade) return;
  // S 档 跳过用印
  if (ctx.grade === 'S') {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '★ S 档·圣旨煌煌·跳过用印阶段·诏命直颁。', true);
    CY._ty3_settleCtx = null;
    return;
  }
  // D 档·用户须先选硬推/妥协·若 force 则用印·yield 则不用印
  if (ctx.grade === 'D' && ctx.dChoice !== 'force') {
    CY._ty3_settleCtx = null;
    return;
  }
  setTimeout(function() {
    _ty3_phase6_open(ctx.decision, ctx.grade, ctx.opts);
    // 用印完成后清 context(seal 是终态·不再链)
    CY._ty3_settleCtx = null;
  }, 200);
}

// 修复 1·钩入 _ty3_settleArchonGrade·只触发草诏 picker(由 picker 链向用印)
(function _ty3_installDraftHook() {
  if (typeof window === 'undefined') return;
  var attempts = 0;
  function tryHook() {
    if (attempts++ > 20) return;
    if (typeof window._ty3_settleArchonGrade !== 'function') {
      setTimeout(tryHook, 200);
      return;
    }
    if (window._ty3_settleArchonGrade._draftHooked) return;
    var orig = window._ty3_settleArchonGrade;
    window._ty3_settleArchonGrade = function(decision, opts) {
      var info = orig.apply(this, arguments);
      // 暂存 context 给 _ty3_advanceToSeal 用
      if (info && info.grade && decision && decision.mode !== 'defer') {
        CY._ty3_settleCtx = { grade: info.grade, decision: decision, opts: opts };
      }
      // D 档：等用户选 force/yield 后由 _ty3_dgPick 触发链
      // 非 D 档：进草诏 picker(picker 完成后链向用印)
      // S 档：跳草诏(直接进 _ty3_advanceToSeal)
      if (info && info.grade && decision && decision.mode !== 'defer') {
        if (info.grade === 'D') {
          // 等待 _ty3_dgPick 触发(下面 §11 的 force 路径会调 advanceToSeal)
        } else if (info.grade === 'S') {
          // S 档·草诏 picker 仍开(玩家可越级钦点亲信)·picker 完后跳用印
          setTimeout(function(){ _ty3_phase5_openDraftPicker(decision, info.grade, opts); }, 250);
        } else {
          setTimeout(function(){ _ty3_phase5_openDraftPicker(decision, info.grade, opts); }, 250);
        }
      }
      return info;
    };
    window._ty3_settleArchonGrade._draftHooked = true;
  }
  tryHook();
})();

// 暴露波 2 API
if (typeof window !== 'undefined') {
  window._ty3_phase1_openSeating = _ty3_phase1_openSeating;
  window._ty3_phase1_startDebate = _ty3_phase1_startDebate;
  window._ty3_phase1_cancel = _ty3_phase1_cancel;
  window._ty3_phase2_run = _ty3_phase2_run;
  window._ty3_phase5_openDraftPicker = _ty3_phase5_openDraftPicker;
  window._ty3_phase5_pick = _ty3_phase5_pick;
  window._ty3_phase5_pickFree = _ty3_phase5_pickFree;
  window._ty3_phase5_skip = _ty3_phase5_skip;
  // 续议按钮 / 兜底选人 / 进度条·供 onclick 与续议链路调用
  window._ty3_continueDebate = _ty3_continueDebate;
  window._ty3_pickFallbackSpeakers = _ty3_pickFallbackSpeakers;
  window._ty3_progRender = _ty3_progRender;
  window._ty3_progClear = _ty3_progClear;
  window._ty3_isControversial = _ty3_isControversial;
  window._ty3_isHaremTitle = _ty3_isHaremTitle;
  window._ty2_enterDecide = window._ty2_enterDecide || _ty2_enterDecide; // 续议中"径取圣裁"按钮 onclick 用
  window._ty3_checkConsensusEvent = window._ty3_checkConsensusEvent || _ty3_checkConsensusEvent;
}

// escAttr 兜底(若全局无)
if (typeof escAttr !== 'function') {
  window.escAttr = function(s) { return (s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;'); };
}

// ═══════════════════════════════════════════════════════════════════════
//  §10·阶段 3·廷推(人事议题·钦定 / 廷推 / 暂阙) — 波 3
// ═══════════════════════════════════════════════════════════════════════
// 人事议题(meta.topicType==='appointment' 或 议题文本含「任命/罢免/起复/廷推」)
// 在阶段 4 钦定档位之前进入·让玩家选取候选并决定方式
// 候选生成：各党派从 members + officePositions 中推举 prestige 最高且未殁者
// 钦定 = 玩家自选(huangquan-1 顺势·-3 违逆 influence 大党)
// 廷推 = 按 influence 加权抽签(党争 -3·被推者 loyalty+5)
// 暂阙 = 不补·该位空缺 N 回合

function _ty3_phase3_isPersonnelTopic(topic, meta) {
  if (meta && (meta.kind === 'impeachment' || meta.topicType === 'impeachment' || meta.isAccusation)) return true;
  if (meta && (meta.topicType === 'appointment' || meta.isPersonnel)) return true;
  if (!topic) return false;
  return /任命|补任|荐贤|廷推|铨选|官职|人事|调任|升迁|罢免|弹劾|结党/.test(String(topic));
}

function _ty3_impeachmentAccusedNames(meta) {
  if (!meta) return [];
  if (Array.isArray(meta.accused)) return meta.accused.filter(Boolean);
  if (meta.accused) return [meta.accused];
  return [];
}

function _ty3_collectOfficeHolderNames() {
  var byName = {};
  function add(nm) { if (nm) byName[nm] = true; }
  function walk(nodes) {
    if (!Array.isArray(nodes)) return;
    nodes.forEach(function(n) {
      (n.positions || []).forEach(function(pos) {
        if (!pos) return;
        add(pos.holder);
        (pos.actualHolders || []).forEach(function(ah) { add(typeof ah === 'string' ? ah : (ah && ah.name)); });
      });
      if (n.subs) walk(n.subs);
      if (n.children) walk(n.children);
    });
  }
  walk(GM.officeTree || []);
  if (Object.keys(byName).length === 0) {
    (GM.chars || []).forEach(function(c) {
      if (!c || c.alive === false || c.isPlayer) return;
      if (c.officialTitle || c.title) add(c.name);
    });
  }
  return Object.keys(byName);
}

function _ty3_phase3_buildCandidates(targetOffice, meta) {
  var byParty = {};
  var isImpeachment = !!(meta && (meta.kind === 'impeachment' || meta.topicType === 'impeachment' || meta.isAccusation));
  var accusedNames = _ty3_impeachmentAccusedNames(meta);
  var officeHolderAllow = isImpeachment ? _ty3_collectOfficeHolderNames() : null;
  var parties = _ty3_getParties();
  parties.forEach(function(p) {
    if (!p || !p.name) return;
    var leader = _ty3_getPartyLeader(p.name);
    var members = _ty3_getPartyMembers(p.name).filter(function(c) {
      if (!c || c.alive === false || c.isPlayer) return false;
      if (accusedNames.indexOf(c.name) >= 0) return false;
      if (officeHolderAllow && officeHolderAllow.indexOf(c.name) < 0) return false;
      return true;
    });
    members.sort(function(a, b) { return (b.prestige || 50) - (a.prestige || 50); });
    var top = members.slice(0, 2);
    if (top.length > 0) {
      byParty[p.name] = {
        party: p,
        candidates: top.map(function(c) {
          return {
            name: c.name,
            ch: c,
            prestige: c.prestige || 50,
            officialTitle: c.officialTitle || c.title || '',
            isLeader: leader && leader.name === c.name
          };
        })
      };
    }
  });

  var neutralPool = (GM.chars || []).filter(function(c) {
    if (!c || c.alive === false || c.isPlayer) return false;
    if (c.party) return false;
    if (accusedNames.indexOf(c.name) >= 0) return false;
    if (officeHolderAllow && officeHolderAllow.indexOf(c.name) < 0) return false;
    if ((c.prestige || 50) < 65) return false;
    return true;
  }).sort(function(a, b) { return (b.prestige || 50) - (a.prestige || 50); }).slice(0, 3);
  if (neutralPool.length > 0) {
    byParty.__neutral__ = {
      party: { name: '中立·无党', influence: 30, cohesion: 50 },
      candidates: neutralPool.map(function(c) { return { name: c.name, ch: c, prestige: c.prestige || 50, officialTitle: c.officialTitle || c.title || '', isLeader: false }; })
    };
  }
  return byParty;
}

function _ty3_phase3_open(targetOffice, callback, meta) {
  var byParty = _ty3_phase3_buildCandidates(targetOffice, meta);
  var entries = Object.entries(byParty);
  if (entries.length === 0) {
    if (typeof toast === 'function') toast('无可廷推候选');
    if (typeof callback === 'function') callback(null);
    return;
  }
  var bg = document.createElement('div');
  bg.id = 'ty3-tuijian-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1310;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  var html = '<div class="ty3-tj-modal">';
  html += '<div class="ty3-tj-title">〔 廷 推 候 选 〕</div>';
  if (targetOffice) html += '<div class="ty3-tj-target">拟补：' + escHtml(targetOffice) + '</div>';
  if (meta && (meta.kind === 'impeachment' || meta.topicType === 'impeachment')) html += '<div class="ty3-tj-target">弹劾后续追责·罪状：oose a replacement office holder.</div>';
  html += '<div class="ty3-tj-cands">';
  entries.forEach(function(pair) {
    var pName = pair[0];
    var info = pair[1];
    var p = info.party || {};
    var label = (pName === '__neutral__') ? '中立·无党' : pName;
    html += '<div class="ty3-tj-party-block">';
    html += '<div class="ty3-tj-party-head">' + escHtml(label);
    if (pName !== '__neutral__') html += '<span class="ty3-tj-party-meta">影响 ' + (p.influence || 50) + '·凝聚 ' + (p.cohesion || 50) + '</span>';
    html += '</div>';
    info.candidates.forEach(function(c) {
      var winRate = _ty3_phase3_estimateWinRate(p.influence || 50, c.prestige);
      html += '<div class="ty3-tj-cand" onclick="_ty3_phase3_qinDing(\'' + escAttr(c.name) + '\',\'' + escAttr(pName) + '\')">';
      html += '<div class="ty3-tj-cand-name">' + escHtml(c.name) + (c.isLeader ? ' *' : '') + '</div>';
      html += '<div class="ty3-tj-cand-meta">' + escHtml(c.officialTitle || '无衔') + '·名望 ' + c.prestige + '·胜率 ' + winRate + '%</div>';
      html += '</div>';
    });
    html += '</div>';
  });
  html += '</div>';
  html += '<div class="ty3-tj-foot">';
  html += '<button class="bt bp" onclick="_ty3_phase3_doPublicVote()">⚖ 让百官公推</button>';
  html += '<button class="bt" onclick="_ty3_phase3_skip()">📜 暂 阙·此位空缺</button>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
  CY._ty3_phase3_callback = callback;
  CY._ty3_phase3_byParty = byParty;
}

function _ty3_phase3_estimateWinRate(influence, prestige) {
  var raw = (influence || 50) * 0.6 + (prestige || 50) * 0.4;
  return Math.round(raw);
}

function _ty3_phase3_qinDing(name, partyKey) {
  var bg = document.getElementById('ty3-tuijian-bg');
  if (bg) bg.remove();
  if (!name) return;
  var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
  if (!ch) return;
  var biggestParty = '';
  var biggestInfl = 0;
  _ty3_getParties().forEach(function(p) {
    var infl = parseInt(p.influence, 10) || 0;
    if (infl > biggestInfl) { biggestInfl = infl; biggestParty = p.name; }
  });
  var pickedParty = ch.party || '';
  var contested = (biggestParty && biggestParty !== pickedParty && biggestInfl >= 60);
  var hqDelta = contested ? -3 : -1;
  if (GM.huangquan && typeof GM.huangquan.index === 'number') GM.huangquan.index = Math.max(0, GM.huangquan.index + hqDelta);
  else if (GM.vars && GM.vars['皇权']) GM.vars['皇权'].value = Math.max(0, (GM.vars['皇权'].value || 50) + hqDelta);
  ch.loyalty = Math.min(100, (ch.loyalty || 50) + 3);
  ch.favor = Math.min(100, (ch.favor || 0) + 5);
  ch.prestige = Math.min(100, (ch.prestige || 50) + 2);
  if (contested) {
    var bp = _ty3_getPartyObj(biggestParty);
    if (bp) bp.cohesion = Math.max(0, (parseInt(bp.cohesion, 10) || 50) - 3);
  }
  if (typeof addCYBubble === 'function') addCYBubble('皇帝', '钦点 ' + name + (contested ? '; ' + biggestParty + ' cohesion -3.' : '.'), false);
  if (typeof addEB === 'function') addEB('Recommendation', 'Appointed ' + name + ((CY._ty2 && CY._ty2.topic) ? ' / ' + CY._ty2.topic : ''));
  var cb = CY._ty3_phase3_callback;
  CY._ty3_phase3_callback = null;
  if (typeof cb === 'function') cb({ winner: name, mode: 'qinding', contested: contested });
}

function _ty3_phase3_doPublicVote() {
  var bg = document.getElementById('ty3-tuijian-bg');
  if (bg) bg.remove();
  var pool = [];
  Object.values(CY._ty3_phase3_byParty || {}).forEach(function(info) {
    info.candidates.forEach(function(c) {
      var weight = (info.party.influence || 50) + (c.prestige || 50) * 0.5;
      pool.push({ name: c.name, party: info.party.name, weight: weight });
    });
  });
  if (pool.length === 0) {
    if (typeof toast === 'function') toast('无候选可公推');
    return;
  }
  var total = pool.reduce(function(sum, item) { return sum + item.weight; }, 0);
  var roll = Math.random() * total;
  var winner = pool[0];
  for (var i = 0; i < pool.length; i++) {
    roll -= pool[i].weight;
    if (roll <= 0) { winner = pool[i]; break; }
  }
  var ch = (typeof findCharByName === 'function') ? findCharByName(winner.name) : null;
  if (ch) {
    ch.loyalty = Math.min(100, (ch.loyalty || 50) + 5);
    ch.prestige = Math.min(100, (ch.prestige || 50) + 1);
  }
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 廷推所定：' + winner.name + ' 〕', true);
  if (typeof addEB === 'function') addEB('Recommendation', 'Public recommendation selected ' + winner.name + ((CY._ty2 && CY._ty2.topic) ? ' / ' + CY._ty2.topic : ''));
  var cb = CY._ty3_phase3_callback;
  CY._ty3_phase3_callback = null;
  if (typeof cb === 'function') cb({ winner: winner.name, mode: 'public', party: winner.party });
}

function _ty3_phase3_skip() {
  var bg = document.getElementById('ty3-tuijian-bg');
  if (bg) bg.remove();
  var cb = CY._ty3_phase3_callback;
  CY._ty3_phase3_callback = null;
  if (typeof cb === 'function') cb(null);
}
function _ty3_phase6_resolveDynasty() {
  var sc = (typeof P !== 'undefined' && P.scenario) || P || {};
  if (sc.dynastyType) return sc.dynastyType;
  var year = parseInt(sc.startYear, 10) || 1628;
  if (year < 907) return 'tang';
  if (year < 1279) return 'song';
  if (year < 1644) return 'ming';
  return 'qing';
}

function _ty3_currentTinyiTopic() {
  return (CY._ty2 && CY._ty2.topic) || (CY._ty3 && CY._ty3.topic) || '';
}

function _ty3_currentTinyiMeta() {
  if (CY._ty3 && CY._ty3.meta && typeof CY._ty3.meta === 'object') return CY._ty3.meta;
  if (CY._ty2 && CY._ty2._publicMeta && typeof CY._ty2._publicMeta === 'object') return CY._ty2._publicMeta;
  if (typeof window !== 'undefined' && window._ty3_publicMeta && typeof window._ty3_publicMeta === 'object') return window._ty3_publicMeta;
  return null;
}

function _ty3_phase6_context(decision, grade, opts, hostile) {
  return {
    decision: decision || {},
    grade: grade || CY._ty3_archonGrade || 'C',
    opts: opts || {},
    hostile: hostile || null,
    topic: _ty3_currentTinyiTopic(),
    draftEdict: CY._ty3 && CY._ty3._draftEdict,
    isReissue: !!((opts && opts.isReissue) || (CY._ty3 && CY._ty3.isReissue)),
    reissuedCount: parseInt((opts && opts.reissuedCount) || (CY._ty3 && CY._ty3.reissuedCount) || 0, 10) || 0
  };
}

function _ty3_phase6_influenceGroupSealBonus(conf) {
  var groups = (typeof GM !== 'undefined' && GM && GM.influenceGroupState) || {};
  var catalog = null;
  try {
    catalog = (window.TM && TM.InfluenceGroups && typeof TM.InfluenceGroups.getCatalog === 'function') ? TM.InfluenceGroups.getCatalog(GM) : null;
  } catch (_) {}
  var eunuchOffices = (catalog && catalog.eunuch && Array.isArray(catalog.eunuch.keyOffices)) ? catalog.eunuch.keyOffices : [];
  var bonus = 0;
  Object.keys(groups).forEach(function(name) {
    var grp = groups[name];
    if (!grp || grp.type !== 'eunuch') return;
    if ((Number(grp.influence) || 0) < 60) return;
    var offices = Array.isArray(grp.keyOffices) ? grp.keyOffices : [];
    var hasSealOffice = offices.some(function(o) {
      var text = String(o || '');
      if (!eunuchOffices.length) return !!text;
      return eunuchOffices.some(function(k) { return k && text.indexOf(String(k)) >= 0; });
    });
    if (!hasSealOffice) return;
    bonus += Number(conf && conf.eunuchSealBonus) || 0.15;
  });
  return bonus;
}

function _ty3_phase6_adjustBlockProb(prob, partyName, dynasty, hasOfficeControl) {
  var conf = _ty3_readEngineConstant('tinyiSealBlock', {}) || {};
  var cohesion = _ty3_partyCohesion(partyName);
  var adjusted = (typeof prob === 'number' ? prob : 0) + ((cohesion - 50) / 200);
  adjusted += hasOfficeControl ? (Number(conf.officeControlBonus) || 0.16) : 0;
  adjusted += _ty3_phase6_influenceGroupSealBonus(conf);
  adjusted += Number(conf.base) || 0;
  if (dynasty === 'ming') adjusted *= Number(conf.mingMultiplier) || 1.15;
  if (dynasty === 'qing') adjusted *= Number(conf.qingMultiplier) || 0.25;
  return Math.max(0, Math.min(0.95, adjusted));
}

function _ty3_pushChronicle(type, text, extra) {
  if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
  var entry = {
    turn: GM.turn || 1,
    date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
    type: type,
    text: text,
    tags: ['\u5ef7\u8bae', type]
  };
  Object.keys(extra || {}).forEach(function(k){ entry[k] = extra[k]; });
  GM._chronicle.push(entry);
  return entry;
}

function _ty3_getTinyiFollowUpDelay() {
  var v = _ty3_readEngineConstant('tinyiFollowUpDelay', undefined);
  var n = parseInt(v, 10);
  return isNaN(n) ? 6 : Math.max(1, n);
}

function _ty3_enqueueTinyiFollowUp(entry) {
  if (!GM.tinyi || typeof GM.tinyi !== 'object') GM.tinyi = {};
  if (!Array.isArray(GM.tinyi.followUpQueue)) GM.tinyi.followUpQueue = [];
  var delay = _ty3_getTinyiFollowUpDelay();
  var topicId = entry.topicId || ('ty3_' + (GM.turn || 0) + '_' + (GM.tinyi.followUpQueue.length + 1));
  var queued = {
    topicId: topicId,
    topic: entry.topic || _ty3_currentTinyiTopic(),
    dueTurn: entry.dueTurn || ((GM.turn || 0) + delay),
    turn: GM.turn || 0,
    grade: entry.grade || CY._ty3_archonGrade || 'C',
    sealStatus: entry.sealStatus || 'issued',
    sourceParty: entry.sourceParty || '',
    opposingParties: _ty3_normalizePartyNames(entry.opposingParties || []),
    blockerParty: entry.blockerParty || '',
    draftEdict: entry.draftEdict || null,
    decisionMode: entry.decisionMode || ''
  };
  GM.tinyi.followUpQueue.push(queued);
  if (CY._ty3) CY._ty3.followUpTurn = queued.dueTurn;
  if (CY._ty2) CY._ty2.followUpTurn = queued.dueTurn;
  var meta = _ty3_currentTinyiMeta();
  if (meta && typeof meta === 'object') meta.followUpTurn = queued.dueTurn;
  if (Array.isArray(GM.recentChaoyi) && GM.recentChaoyi[0]) GM.recentChaoyi[0].followUpTurn = queued.dueTurn;
  try {
    _ty3_syncChaoyiChronicleTrack({
      trackId: queued.topicId,
      topic: queued.topic,
      proposerParty: queued.sourceParty,
      opposingParties: queued.opposingParties,
      grade: queued.grade,
      decisionMode: queued.decisionMode,
      turn: queued.turn,
      expectedEndTurn: queued.dueTurn,
      currentStage: '\u5F85\u590D\u8BC4',
      progress: 45,
      summary: queued.sealStatus === 'blocked' ? '\u88AB\u963B\u64CE\u7684\u671D\u8BAE\u5F85\u590D\u8BC4' : '\u5DF2\u5165\u6743\u5E76\u7B49\u5F85\u590D\u8BC4',
      narrative: (queued.draftEdict && queued.draftEdict.body) ? String(queued.draftEdict.body).slice(0, 120) : '',
      shortTermBalance: queued.sealStatus || '',
      longTermBalance: queued.draftEdict && queued.draftEdict.body ? String(queued.draftEdict.body).slice(0, 120) : '',
      sealStatus: queued.sealStatus,
      priority: queued.sealStatus === 'blocked' ? 'high' : 'medium'
    });
  } catch (_chaoyiTrackE) {
    try { window.TM && TM.errors && TM.errors.captureSilent(_chaoyiTrackE, 'tinyi-chaoyi-track-queue'); } catch (_) {}
  }
  return queued;
}

function _ty3_phase6_recordSeal(status, ctx, detail) {
  ctx = ctx || {};
  detail = detail || {};
  var grade = ctx.grade || CY._ty3_archonGrade || 'C';
  var topic = (ctx.opts && ctx.opts.topic) || (CY._ty2 && CY._ty2.topic) || (CY._ty3 && CY._ty3.topic) || '';
  var sourceParty = (ctx.opts && ctx.opts.proposerParty) || (CY._ty3 && CY._ty3.proposerParty) || '';
  var opposingParties = (ctx.opts && Array.isArray(ctx.opts.opposingParties)) ? ctx.opts.opposingParties.slice() : [];
  var draft = (CY._ty3 && CY._ty3.draftEdict) || null;
  var body = draft && draft.body ? draft.body : _ty3_buildDraftEdictBody(ctx.decision || {}, grade, '', _ty3_phase6_resolveDynasty());
  var chaoyiTrackId = (CY._ty3 && CY._ty3.chaoyiTrackId) || (ctx.opts && ctx.opts.chaoyiTrackId) || _ty3_buildChaoyiTrackId(topic, sourceParty, grade, (ctx.decision && ctx.decision.mode) || ctx.decisionMode || '', GM.turn || 0);
  var seal = {
    id: 'seal_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
    topic: topic,
    grade: grade,
    sealStatus: status,
    status: status,
    body: status === 'blocked' ? '' : body,
    sealTurn: GM.turn || 0,
    sourceParty: sourceParty,
    opposingParties: opposingParties.slice(),
    blockerParty: detail.blockerParty || '',
    forced: !!detail.forced
  };
  var reissuedCount = parseInt(ctx.reissuedCount || (CY._ty3 && CY._ty3.reissuedCount) || 0, 10) || 0;
  seal.isReissue = !!(ctx.isReissue || (CY._ty3 && CY._ty3.isReissue));
  seal.reissuedCount = reissuedCount;
  CY._ty3._sealStatus = status;
  CY._ty3.sealStatus = status;
  CY._ty3.sealedEdict = seal;
  CY._ty3._sealedEdict = seal.body;
  if (CY._ty2) {
    CY._ty2.sealStatus = status;
    CY._ty2.sealedEdict = seal;
  }
  var meta = _ty3_currentTinyiMeta();
  if (meta && typeof meta === 'object') {
    meta.sealStatus = status;
    meta.sealedEdict = seal;
  }
  if (Array.isArray(GM.recentChaoyi) && GM.recentChaoyi[0]) {
    GM.recentChaoyi[0].sealStatus = status;
    GM.recentChaoyi[0].sealedEdict = seal.body;
  }

  if (status === 'blocked') {
    _ty3_applyPolicyPartyResult(sourceParty, opposingParties, grade, 'blocked', seal.blockerParty);
    try {
      if (typeof TM !== 'undefined' && TM.ClassEngine && typeof TM.ClassEngine.applyPartyOutcomeToClasses === 'function') {
        TM.ClassEngine.applyPartyOutcomeToClasses(GM, {
          sealStatus: 'blocked',
          outcome: 'blocked',
          grade: grade,
          sourceParty: sourceParty,
          opposingParties: opposingParties,
          blockerParty: seal.blockerParty
        }, { turn: GM.turn || 0, source: 'tinyi-stage6-blocked' });
      }
    } catch (_pcBlockedE) {
      try { window.TM && TM.errors && TM.errors.captureSilent(_pcBlockedE, 'tinyi-stage6-party-class-blocked'); } catch (_) {}
    }
    if (topic) {
      if (!GM._ccHeldItems) GM._ccHeldItems = [];
      var held = _ty3_makeHeldItem(topic, 'seal-blocked', {
        blockedBy: seal.blockerParty,
        sourceParty: sourceParty,
        opposingParties: opposingParties,
        decision: ctx.decision || {},
        opts: ctx.opts || {},
        meta: meta || null,
        draftEdict: draft,
        grade: grade,
        chaoyiTrackId: chaoyiTrackId,
        reissuedCount: reissuedCount
      });
      if (reissuedCount >= _ty3_reissueLimit()) {
        seal.finalBlocked = true;
        _ty3_markHeldFinalBlocked(held, 'reissue-limit-after-block');
      } else {
        GM._ccHeldItems.push(held);
      }
    }
    _ty3_pushChronicle('Blocked', 'Court topic blocked: ' + topic + ' by ' + (seal.blockerParty || 'opposition') + '.', {
      topic: topic,
      grade: grade,
      sealStatus: status,
      sourceParty: sourceParty,
      blockerParty: seal.blockerParty
    });
  } else {
    _ty3_applyPolicyPartyResult(sourceParty, opposingParties, grade, 'issued');
    try {
      if (typeof TM !== 'undefined' && TM.ClassEngine && typeof TM.ClassEngine.applyPartyOutcomeToClasses === 'function') {
        TM.ClassEngine.applyPartyOutcomeToClasses(GM, {
          sealStatus: status,
          outcome: 'issued',
          grade: grade,
          sourceParty: sourceParty,
          opposingParties: opposingParties
        }, { turn: GM.turn || 0, source: 'tinyi-stage6-issued' });
      }
    } catch (_pcIssuedE) {
      try { window.TM && TM.errors && TM.errors.captureSilent(_pcIssuedE, 'tinyi-stage6-party-class-issued'); } catch (_) {}
    }
    _ty3_pushChronicle(status === 'reissued' ? 'Reissued' : 'Issued', 'Court topic issued: ' + topic + '.', {
      topic: topic,
      grade: grade,
      sealStatus: status,
      reissuedCount: reissuedCount,
      sourceParty: sourceParty,
      opposingParties: opposingParties
    });
    seal.followUp = _ty3_enqueueTinyiFollowUp({
      topicId: chaoyiTrackId,
      topic: topic,
      grade: grade,
      sealStatus: status,
      sourceParty: sourceParty,
      opposingParties: opposingParties,
      draftEdict: draft,
      decisionMode: (ctx.decision && ctx.decision.mode) || ctx.decisionMode || ''
    });
  }
  return seal;
}
function _ty3_phase6_resolveSeal(force, ctx) {
  ctx = ctx || CY._ty3_seal_ctx || {};
  var hostile = ctx.hostile || null;
  var grade = ctx.grade || CY._ty3_archonGrade || 'C';
  var status = 'issued';
  var detail = { forced: false };
  if (force && hostile) {
    detail.forced = true;
    detail.blockerParty = hostile.partyName || '';
    if (GM.huangquan && typeof GM.huangquan.index === 'number') GM.huangquan.index = Math.max(0, GM.huangquan.index - 5);
    else if (GM.vars && GM.vars['皇权']) GM.vars['皇权'].value = Math.max(0, (GM.vars['皇权'].value||50) - 5);
  } else if (hostile) {
    var roll = (typeof ctx.roll === 'number') ? ctx.roll : Math.random();
    if (roll < (hostile.holdProb || 0)) {
      status = 'blocked';
      detail.blockerParty = hostile.partyName || '';
    }
  }
  if (status === 'issued' && (ctx.isReissue || (CY._ty3 && CY._ty3.isReissue))) status = 'reissued';
  ctx.grade = grade;
  return _ty3_phase6_recordSeal(status, ctx, detail);
}

function _ty3_phase6_open(decision, archonGrade, opts) {
  if (!decision || decision.mode === 'defer') return;
  if (archonGrade === 'S') {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '★ S 档·圣旨煌煌·跳过用印阶段·诏命直颁。', true);
    _ty3_phase6_resolveSeal(false, _ty3_phase6_context(decision, archonGrade, opts, null));
    return;
  }
  var dynasty = _ty3_phase6_resolveDynasty();
  var hostile = _ty3_phase6_findHostileSealHolder(decision, opts);
  CY._ty3_seal_ctx = _ty3_phase6_context(decision, archonGrade, opts, hostile);
  var bg = document.createElement('div');
  bg.id = 'ty3-seal-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1310;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  var dynastyLabel = { tang: '唐', song: '宋', ming: '明', qing: '清' }[dynasty] || '古';
  var flowDesc = '';
  if (dynasty === 'tang' || dynasty === 'song') flowDesc = '政事堂副署 → 玉玺';
  else if (dynasty === 'ming') flowDesc = '内阁票拟 → 司礼监批红 → 玉玺';
  else if (dynasty === 'qing') flowDesc = '军机处直递 → 朱批';
  else flowDesc = 'Standard seal procedure.';

  var html = '<div class="ty3-sl-modal">';
  html += '<div class="ty3-sl-title">〔 用 印 颁 行·' + dynastyLabel + '制 〕</div>';
  html += '<div class="ty3-sl-flow">' + escHtml(flowDesc) + '</div>';
  if (hostile) {
    var prob = Math.round(hostile.holdProb * 100);
    html += '<div class="ty3-sl-warn">';
    html += '<b>' + escHtml(hostile.partyName) + '</b> controls <b>' + escHtml(hostile.officePos) + '</b> with influence ' + hostile.influence + '.';
    html += '<br>有 ' + prob + '% 概率「留中不发」 — ';
    html += '<button class="bt bsm" onclick="_ty3_phase6_doSeal(true)">⚔ 强行用印（皇权-5）</button>';
    html += ' <button class="bt bsm" onclick="_ty3_phase6_doSeal(false)">🎲 听天由命</button>';
    html += '</div>';
    CY._ty3_seal_hostile = hostile;
  } else {
    html += '<div class="ty3-sl-ok">无党派阻挠·诏命可顺利用印颁行</div>';
    html += '<div class="ty3-sl-foot"><button class="bt bp" onclick="_ty3_phase6_doSeal(false)">📜 用 印</button></div>';
    CY._ty3_seal_hostile = null;
  }
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _ty3_phase6_findHostileSealHolder(decision, opts) {
  var dynasty = _ty3_phase6_resolveDynasty();
  var sealKeywords = [];
  if (dynasty === 'tang' || dynasty === 'song') sealKeywords = ['中书', '门下', '尚书', '枢密', 'chancellery', 'secretariat'];
  else if (dynasty === 'ming') sealKeywords = ['内阁', '司礼监', '六科', 'cabinet', 'seal'];
  else if (dynasty === 'qing') sealKeywords = ['军机', '内阁', 'grand council', 'seal'];
  else sealKeywords = ['印', '玺', 'seal', 'draft'];

  var proposerParty = (opts && opts.proposerParty) || '';
  var enemyParties = proposerParty ? _ty3_getOpposingParties(proposerParty) : _ty3_getParties().filter(function(p) { return _ty3_partyInfluence(p.name) >= 50; });
  var best = null;
  enemyParties.forEach(function(p) {
    var infl = _ty3_partyInfluence(p.name);
    if (infl < 50) return;
    var positions = p.officePositions || [];
    var matched = '';
    for (var i = 0; i < positions.length; i++) {
      var pos = String(positions[i] || '').toLowerCase();
      for (var j = 0; j < sealKeywords.length; j++) {
        if (pos.indexOf(String(sealKeywords[j]).toLowerCase()) >= 0) {
          matched = positions[i];
          break;
        }
      }
      if (matched) break;
    }
    if (!matched) return;
    var prob = Math.max(0, Math.min(0.95, (infl - 50) / 50));
    prob = _ty3_phase6_adjustBlockProb(prob, p.name, dynasty, !!matched);
    if (!best || prob > best.holdProb) best = { partyName: p.name, influence: infl, officePos: matched, holdProb: prob };
  });
  return best;
}
function _ty3_phase6_doSeal(force) {
  var bg = document.getElementById('ty3-seal-bg');
  if (bg) bg.remove();
  var hostile = CY._ty3_seal_hostile;
  CY._ty3_seal_hostile = null;
  var ctx = CY._ty3_seal_ctx || {};
  if (!ctx.hostile) ctx.hostile = hostile;
  CY._ty3_seal_ctx = null;
  var seal = _ty3_phase6_resolveSeal(force, ctx);
  if (seal && seal.sealStatus === 'blocked') {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 诏命留中·阻挠者：' + (seal.blockerParty || '反对方') + ' 〕', true);
    if (typeof addEB === 'function') addEB('Seal', 'Blocked by ' + (seal.blockerParty || 'opposition'));
    return;
  }
  if (force && hostile) {
    var ph0 = _ty3_getPartyObj(hostile.partyName);
    if (ph0) ph0.cohesion = Math.min(100, (parseInt(ph0.cohesion, 10) || 50) + 3);
    var siOld = (typeof GM.partyStrife === 'number') ? GM.partyStrife : 50;
    if (typeof GM.partyStrife === 'number') GM.partyStrife = Math.min(100, GM.partyStrife + 4);
    if (GM.huangquan && typeof GM.huangquan.index === 'number') GM.huangquan.index = Math.max(0, GM.huangquan.index - 5);
    else if (GM.vars && GM.vars['皇权']) GM.vars['皇权'].value = Math.max(0, (GM.vars['皇权'].value || 50) - 5);
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 强行用印·阻于 ' + hostile.partyName + '·皇威 -5·' +  + _ty3_strifeChange(siOld, GM.partyStrife), true);
    if (typeof addEB === 'function') addEB('Seal', 'Forced seal against ' + hostile.partyName + '; ' + _ty3_strifeChange(siOld, GM.partyStrife));
  } else {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 诏命用印颁行 〕', true);
    if (typeof addEB === 'function') addEB('Seal', 'Decree issued');
  }
  setTimeout(function() { _ty3_phase6_offerVerdictNote(); }, 250);
}

function _ty3_phase6_offerVerdictNote() {
  if (!CY._ty3) return;
  var bg = document.createElement('div');
  bg.id = 'ty3-verdict-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1320;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;';
  var html = '<div class="ty3-vd-modal" style="background:linear-gradient(180deg,#ead7b3,#dcc591);border:1px solid #8c7654;border-radius:4px;padding:1.6rem 1.8rem;max-width:540px;width:90%;color:#2a1a10;font-family:STSong,SimSun,serif;box-shadow:0 12px 40px rgba(0,0,0,0.7);">';
  html += '<div style="font-family:STKaiti,KaiTi,serif;font-size:1.25rem;letter-spacing:0.4em;padding-left:0.4em;text-align:center;margin-bottom:0.5rem;color:#14090b;">〔 圣 意 补 述 〕</div>';
  html += '<div style="text-align:center;font-size:0.78rem;color:#6d5a3e;letter-spacing:0.2em;padding-left:0.2em;margin-bottom:1.2rem;">诏书已颁·然圣心未尽·若有它意·亲笔记之</div>';
  html += '<textarea id="ty3-vd-input" placeholder="Optional verdict note" style="width:100%;min-height:90px;padding:10px 12px;background:rgba(255,255,255,0.5);border:1px solid rgba(140,118,84,0.5);border-radius:2px;font-family:STKaiti,KaiTi,serif;font-size:0.92rem;color:#14090b;line-height:1.7;resize:vertical;"></textarea>';
  html += '此栏可选填·若朕之裁决与廷议原议有所偏离(只采一部·或换一角度·或意在他事)·写下二三句·让史官与百官会其圣意。';
  html += '<button onclick="_ty3_phase6_skipVerdictNote()" style="padding:7px 18px;background:transparent;border:1px solid #8c7654;color:#6d5a3e;border-radius:2px;font-size:0.82rem;cursor:pointer;">Skip</button>';
  html += '<textarea id="ty3-vd-input" placeholder="如：议虽如此·然朕意只在江南三省试行·北方暂缓……" style="width:100%;min-height:90px;padding:10px 12px;background:rgba(255,255,255,0.5);border:1px solid rgba(140,118,84,0.5);border-radius:2px;font-family:STKaiti,KaiTi,serif;font-size:0.92rem;color:#14090b;line-height:1.7;resize:vertical;"></textarea>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
  setTimeout(function() { var ta = document.getElementById('ty3-vd-input'); if (ta) ta.focus(); }, 100);
}

function _ty3_phase6_skipVerdictNote() {
  var bg = document.getElementById('ty3-verdict-bg');
  if (bg) bg.remove();
}

function _ty3_phase6_saveVerdictNote() {
  var ta = document.getElementById('ty3-vd-input');
  var txt = (ta && ta.value || '').trim();
  if (txt) {
    if (!CY._ty3) CY._ty3 = {};
    CY._ty3._playerVerdictNote = txt.slice(0, 240);
    if (Array.isArray(GM.recentChaoyi) && GM.recentChaoyi[0]) GM.recentChaoyi[0].playerVerdictNote = CY._ty3._playerVerdictNote;
    if (typeof addEB === 'function') addEB('圣意', '朱批: ' + txt.slice(0, 24));
  }
  var bg = document.getElementById('ty3-verdict-bg');
  if (bg) bg.remove();
}
(function _ty3_installDChainHook() {
  if (typeof window === 'undefined') return;
  var attempts = 0;
  function tryHook() {
    if (attempts++ > 30) return;
    if (typeof window._ty3_dgPick !== 'function') {
      setTimeout(tryHook, 200);
      return;
    }
    if (window._ty3_dgPick._chainHooked) return;
    var orig = window._ty3_dgPick;
    window._ty3_dgPick = function(choice) {
      orig.apply(this, arguments);
      if (CY._ty3_settleCtx) CY._ty3_settleCtx.dChoice = choice;
      if (choice === 'force') {
        // D + 硬推 → 仍走草诏 picker → 用印
        var ctx = CY._ty3_settleCtx;
        if (ctx) setTimeout(function(){ _ty3_phase5_openDraftPicker(ctx.decision, 'D', ctx.opts); }, 300);
      } else if (choice === 'yield') {
        // D grade choice handling.
      }
    };
    window._ty3_dgPick._chainHooked = true;
  }
  tryHook();
})();

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
  GM._chronicle.push({
    turn: GM.turn || 1,
    date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
    type: '党祸·新党生',
    text: 'New party formed: ' + newParty.name + (newParty.leader ? ' led by ' + newParty.leader : '') + '. ' + (opts.reason || ''),
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
  GM._chronicle.push({
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
    ps.cohesion = Math.max(0, (parseInt(ps.cohesion, 10) || 50) - Math.max(1, Math.round(sanction / 2)));
    ps.influence = Math.max(0, (parseInt(ps.influence, 10) || 30) - Math.max(1, Math.round(sanction / 3)));
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
          NpcMemorySystem.remember(nm, 'Impeachment approved: ' + (topic || ''), 'politics', 8);
        }
      }
    });
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 准奏弹劾·定性新党：' + newName + ' 〕', true);
    if (!Array.isArray(GM._chronicle)) GM._chronicle = [];
    GM._chronicle.push({
      turn: GM.turn || 1,
      date: GM._gameDate || (typeof getTSText === 'function' ? getTSText(GM.turn) : ''),
      type: 'impeachment-party',
      text: (accuser || 'unknown') + ' accused ' + accusedNames.join(', ') + '; ' + newName + ' formed under inquiry.',
      tags: ['party', 'impeachment', 'accusation', newName],
      partyName: newName,
      accuser: accuser,
      accused: accusedNames.slice()
    });
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
  if (!Array.isArray(GM.parties) || GM.parties.length === 0) return;
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
}

function _ty3_phase3b_openSpawnDialog() {
  if (typeof toast === 'function') toast('史制无君上册党之例·请改走弹劾结党路径');
}
function _ty3_phase3b_doSpawn() { _ty3_phase3b_openSpawnDialog(); }

if (typeof window !== 'undefined') {
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
        sealStatus: entry.sealStatus || ''
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
  GM._chronicle.push({
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
  if (typeof addEB === 'function') addEB('Court Debate', 'Recorded summary: ' + topic);
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
    type: 'chaoyi_pending',
    category: '\u671D\u8BAE\u5F85\u843D\u5B9E',
    sourceType: 'chaoyi_pending',
    sourceId: trackId,
    title: String(payload.topic || '').slice(0, 60) || '\u671D\u8BAE',
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
  return list.some(function(t) { return t && String(t.topic || '').indexOf(keyword) >= 0; });
}

function _ty3_topicText(raw, maxLen) {
  var value = raw;
  if (raw && typeof raw === 'object') value = raw.topic || raw.title || raw.name || raw.text || raw.content || raw.summary || raw.desc || '';
  var text = String(value || '').replace(/\s+/g, ' ').trim();
  var max = maxLen || 34;
  return text.length > max ? text.slice(0, max) : text;
}

function _ty3_pushPendingTinyiTopic(topicObj, keyword, spawned) {
  if (!topicObj || !topicObj.topic) return false;
  if (_ty3_alreadyHasTopic(keyword || topicObj.topic)) return false;
  GM._pendingTinyiTopics.push(topicObj);
  if (Array.isArray(spawned)) spawned.push(topicObj.topic);
  return true;
}

function _ty3_phase15_scanAndSpawnTopics() {
  if (!Array.isArray(GM._pendingTinyiTopics)) GM._pendingTinyiTopics = [];
  var spawned = [];
  if (typeof GM.partyStrife === 'number' && GM.partyStrife >= 70) {
    var prop1 = _ty3_pickProposer({ fallbackTitle: '\u5FA1\u53F2|\u90FD\u5BDF|\u8A00\u5B98|censor' });
    var t1 = { topic: '\u8C03\u505C\u515A\u4E89\u00B7\u6050\u751F\u5927\u53D8', from: 'ty3-spawn-party-strife', turn: GM.turn, severity: GM.partyStrife };
    _ty3_attachProposer(t1, prop1, '\u515A\u4E89\u5DF2\u70BD\u00B7\u9700\u5148\u8BAE\u7EA6\u675F');
    _ty3_pushPendingTinyiTopic(t1, '\u8C03\u505C\u515A\u4E89', spawned);
  }
  (GM.parties || []).forEach(function(p) {
    if (!p || p.status === '湮灭') return;
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
  });
  var minXin = (typeof GM.minxin === 'number') ? GM.minxin : (GM.minxin && GM.minxin.value);
  if (typeof minXin === 'number' && minXin <= 30) {
    var prop3 = _ty3_pickProposer({ fallbackTitle: '\u6237\u90E8|\u6C11\u653F|censor' });
    var t3 = { topic: '\u6C11\u5FC3\u4F4E\u8FF7\u00B7\u8BAE\u8D48\u6D4E\u4E0E\u5B89\u629A', from: 'ty3-spawn-popular-unrest', turn: GM.turn, minxin: minXin };
    _ty3_attachProposer(t3, prop3, '\u5730\u65B9\u544A\u6025\u00B7\u5B98\u6C11\u76F8\u7591');
    _ty3_pushPendingTinyiTopic(t3, '\u6C11\u5FC3\u4F4E\u8FF7', spawned);
  }
  var fiscal = GM.fiscal || GM.economy;
  var deficit = false;
  if (fiscal && typeof fiscal.deficitRatio === 'number' && fiscal.deficitRatio >= 0.3) deficit = true;
  if (GM.tanglian && typeof GM.tanglian.silver === 'number' && GM.tanglian.silver < 0) deficit = true;
  if (deficit) {
    var prop6 = _ty3_pickProposer({ fallbackTitle: '\u6237\u90E8|\u8D22\u653F|censor' });
    var t6 = { topic: '\u56FD\u5E11\u4E8F\u7A7A\u00B7\u8BAE\u589E\u6536\u8282\u7528', from: 'ty3-spawn-fiscal', turn: GM.turn };
    _ty3_attachProposer(t6, prop6, '\u56FD\u5E11\u627F\u538B\u5DF2\u9AD8');
    _ty3_pushPendingTinyiTopic(t6, '\u56FD\u5E11\u4E8F\u7A7A', spawned);
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
    var expectedEnd = t.expectedEndTurn || (startTurn + 12);
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
