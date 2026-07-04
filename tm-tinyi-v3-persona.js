// @ts-nocheck
'use strict';
/* ═══════════════════════════════════════════════════════════════════════
 *  tm-tinyi-v3-persona.js — 廷议 V3·人格立场层（2026-07-04 立项拆分·自 tm-tinyi-v3.js §0.5-§0.995 保序切出）
 *  内容：议题27tag/mentor索引/召集制/hybrid stance dims/mode rule engine/confront链/
 *        6特化动作/裁决反弹hook/clientelism/AI召集推荐/NPC主动发议题
 *  契约：全部顶层全局函数·跨文件调用运行时解析·安装器IIFE皆轮询式(为晚定义目标而生·跨文件安全)
 *  加载序：index.html 中紧挨 tm-tinyi-v3.js 之前——与拆分前执行顺序逐字节等价·勿改
 * ═══════════════════════════════════════════════════════════════════════ */
// ═══════════════════════════════════════════════════════════════════════
//  §0.5·议题 27 tag (v2.6 Slice 2 新加·Slice 6 RULES + Slice 2.5 AI 推荐 用)
// ═══════════════════════════════════════════════════════════════════════
var TINYI_TOPIC_TAGS = [
  // 财政 5
  'finance', 'reward', 'land-tax', 'currency', 'canal-transport',
  // 军事 5
  'military-command', 'border-affairs', 'coastal-defense', 'northern-defense', 'regicide-pursuit',
  // 人事 4 (v2.6 polish·补 impeachment-process·让 impeachment topicType 有专 tag·26→27)
  'personnel', 'official-selection', 'inspection', 'impeachment-process',
  // 法律 3
  'execution', 'penal-harsh', 'law-reform',
  // 礼制 5
  'succession', 'ritual', 'ritual-major', 'etiquette', 'imperial-lecture',
  // 天文 2
  'prophecy', 'calendar',
  // 工程 1
  'river-works',
  // 外交 / 灾赈 2
  'foreign-policy', 'relief'
];

// topicType (v3 已有·impeachment / appointment / other / etc.) → tag 默认映射
var TYPE_TO_TAG = {
  'impeachment':  ['impeachment-process', 'execution', 'inspection'],
  'appointment':  ['personnel', 'official-selection'],
  'war':          ['military-command', 'border-affairs'],
  'succession':   ['succession', 'ritual-major'],
  'reform':       ['law-reform', 'finance'],
  'judgment':     ['execution', 'penal-harsh'],
  'finance':      ['finance', 'land-tax'],
  'relief':       ['relief', 'finance'],
  'ritual':       ['ritual'],
  'other':        []
};

function _ty3_inferTopicTags(topicType, topicText) {
  var tags = {};  // use object as Set (compat)
  // 1·按 topicType 默认 tag
  var typeT = TYPE_TO_TAG[topicType] || [];
  typeT.forEach(function(t) { tags[t] = true; });
  // 2·按 topicText keyword 扩 (v1.4 扩 27 tag)
  var t = String(topicText || '');
  if (/盐|税|赋|关税|榷|商/.test(t))    tags['finance'] = true;
  if (/赏|奖|加封|爵/.test(t))          tags['reward'] = true;
  if (/田|清丈|纳粮/.test(t))           tags['land-tax'] = true;
  if (/钞|银|铜|铸钱|宝泉/.test(t))     tags['currency'] = true;
  if (/漕|船|粮运|海运/.test(t))        tags['canal-transport'] = true;
  if (/兵|将|师|战/.test(t))            tags['military-command'] = true;
  if (/边|九边|塞|关/.test(t))          tags['border-affairs'] = true;
  if (/海防|倭|海寇|水师/.test(t))      tags['coastal-defense'] = true;
  if (/北防|蒙|虏|马匪/.test(t))        tags['northern-defense'] = true;
  if (/诛|斩|赦免|逮/.test(t))          tags['execution'] = true;
  if (/魏珰|阉党|奸|戮/.test(t))        tags['regicide-pursuit'] = true;
  if (/吏|选|铨|官/.test(t))            tags['personnel'] = true;
  if (/选官|廷推|铨选/.test(t))         tags['official-selection'] = true;
  if (/察|按察|巡按/.test(t))           tags['inspection'] = true;
  if (/劾|参|纠|论劾|疏纠/.test(t))     tags['impeachment-process'] = true;  // v2.6 polish·补 impeachment-process
  if (/罪|刑|罚|株/.test(t))            tags['penal-harsh'] = true;
  if (/法|律|典/.test(t))               tags['law-reform'] = true;
  if (/储|嗣|太子/.test(t))             tags['succession'] = true;
  if (/礼|仪|祠|大祀/.test(t))          tags['ritual'] = true;
  if (/朔|历|大礼/.test(t))             tags['ritual-major'] = true;
  if (/拜|揖|趋/.test(t))               tags['etiquette'] = true;
  if (/经筵|讲读|进讲/.test(t))         tags['imperial-lecture'] = true;
  if (/谶|纬|妖言|天象/.test(t))        tags['prophecy'] = true;
  if (/历|时宪|交食|星象/.test(t))      tags['calendar'] = true;
  if (/河|水利|堤|渠|湖|江工/.test(t))  tags['river-works'] = true;
  if (/夷|使|和亲|互市/.test(t))        tags['foreign-policy'] = true;
  if (/灾|疫|旱|涝|蝗|饥/.test(t))      tags['relief'] = true;
  // G2·BB7·恩科 tag·让 tinyi NPC 见 topic 含恩科·走 enke 党友/敌路径
  if (/恩科|特赐|开恩|蒙恩|科赐/.test(t))   tags['enke'] = true;
  if (/反恩科|节恩典|讥滥赏/.test(t))       tags['anti-enke'] = true;
  // G3·武举 tag·让 tinyi NPC 见 topic 含武举 / 武进士 / 边事 → 走 武勋派友/敌路径
  if (/武举|武科|武进士|边事|边镇|武勋/.test(t))     tags['wuju'] = true;
  if (/反武举|罢武人|裁武|节军费/.test(t))            tags['anti-wuju'] = true;
  return Object.keys(tags);
}

// expose (Slice 0.5 expose 块外暴露·跟其他 helper 一致)
if (typeof window !== 'undefined') {
  window.TINYI_TOPIC_TAGS = TINYI_TOPIC_TAGS;
  window._ty3_inferTopicTags = _ty3_inferTopicTags;
}

// ═══════════════════════════════════════════════════════════════════════
//  §0.7·mentor 反向索引 (v2.6 Slice 10a 新加·Slice 2.5 mentor 联动 + Slice 10b clientelism 用)
// ═══════════════════════════════════════════════════════════════════════
function _ty3_buildMentorIndex(chars) {
  var idx = { mentor: {}, mentee: {} };
  if (!Array.isArray(chars)) return idx;
  chars.forEach(function(ch) {
    if (!ch || !ch.name) return;
    if (Array.isArray(ch.mentees) && ch.mentees.length > 0) {
      idx.mentor[ch.name] = ch.mentees.slice();
      ch.mentees.forEach(function(m) {
        if (typeof m === 'string' && m) {
          idx.mentee[m] = ch.name;  // 一 mentee 只一 mentor·后者覆盖前者
        }
      });
    }
  });
  return idx;
}

// 启动 / 剧本加载时调·缓存到 GM._mentorIndex
function _ty3_rebuildMentorIndexFromGM() {
  if (typeof GM === 'undefined' || !GM) return;
  GM._mentorIndex = _ty3_buildMentorIndex(GM.chars || []);
}

if (typeof window !== 'undefined') {
  window._ty3_buildMentorIndex = _ty3_buildMentorIndex;
  window._ty3_rebuildMentorIndexFromGM = _ty3_rebuildMentorIndexFromGM;
}

// 自动 rebuild·剧本加载时 hook (defer 到 document ready·避 GM 未 init)
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  var _ty3_rebuildOnce = function() {
    try {
      if (typeof GM !== 'undefined' && GM && Array.isArray(GM.chars)) {
        if (!GM._mentorIndex) _ty3_rebuildMentorIndexFromGM();
      }
    } catch (_e) {}
  };
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(_ty3_rebuildOnce, 100);
  } else {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(_ty3_rebuildOnce, 100); });
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  §0.8·召集制 helpers (v2.6 Slice 2.5·6 资格 + 5 后果 + 民意度 + 言官离心 + decay)
// ═══════════════════════════════════════════════════════════════════════

// 朝代 + period 民意度 init·v2.9 §5.4.7
var DYNASTY_POPULATION_CONFIDENCE_INIT = {
  '明': 0, '宋': 0, '唐': 0, '元': -10, '清': -5,
  '太祖建国':  +20, '盛世': +10, '中兴': 0, '末世': -20, '危亡': -40
};

// hardcoded 明朝模板 fallback·若 scenario.tinyi.convening 缺
var HARDCODED_MING_CONVENING = {
  requiredCallList: ['首辅', '次辅', '吏部尚书', '户部尚书', '礼部尚书', '兵部尚书', '刑部尚书', '工部尚书', '都察院左都御史'],
  topicSpecificRequired: {},
  topicSpecificForbidden: {},
  maxAttendees: 30,
  minAttendees: 5,
  maxFrequencyPerMonth: 2
};

function _ty3_getConveningConfig(scenario) {
  if (scenario && scenario.tinyi && scenario.tinyi.convening) return scenario.tinyi.convening;
  return HARDCODED_MING_CONVENING;
}

// ─── 2.5.1·6 资格层·3 态 priority cascade (v2.9 §5.4.2) ───

function _cyRankLevelOfSafe(rank) {
  return (typeof _cyRankLevelOf === 'function') ? _cyRankLevelOf(rank) : 8;
}
function _cyGetRankSafe(ch) {
  return (typeof _cyGetRank === 'function') ? _cyGetRank(ch) : (ch && ch.rank);
}

function _ty3_calcEligibilityByRank(ch) {
  var lv = _cyRankLevelOfSafe(_cyGetRankSafe(ch));
  if (lv <= 4)  return { category: '必召', layer: 1 };
  if (lv <= 8)  return { category: '可召', layer: 1 };
  if (lv <= 12) return { category: '可召', layer: 1 };
  if (lv <= 14) return { category: '罕召', layer: 1 };
  return { category: '不召', layer: 1 };
}

function _ty3_calcEligibilityByLocation(ch) {
  // 复用 v2 _isAtCapital
  if (typeof _isAtCapital === 'function' && !_isAtCapital(ch)) {
    return { category: '不召', layer: 2 };
  }
  return null;
}

function _ty3_calcEligibilityByStatus(ch) {
  if (!ch) return { category: '不召', layer: 3 };
  if (ch.alive === false)                    return { category: '不召', layer: 3 };
  if (ch._imprisoned)                         return { category: '不召', layer: 3 };  // v2.6 修·非 _inPrison
  if (ch._exiled)                             return { category: '不召', layer: 3 };
  if (ch._dingyou)                            return { category: '不召', layer: 3 };  // v2.6 新建
  if (ch._sick && (ch.health <= 10))          return { category: '不召', layer: 3 };
  if (ch._retired)                            return { category: '不召', layer: 3 };
  if (ch._fled)                               return { category: '不召', layer: 3 };
  if (ch._missing)                            return { category: '不召', layer: 3 };
  if (ch._captured)                           return { category: '不召', layer: 3 };  // 被俘(北狩/陷虏)·跨朝代通用·人在敌境不召
  return null;
}

function _ty3_calcEligibilityByDynasty(ch, scenario, topic) {
  // 朝代规矩·topicSpecificForbidden (e.g. succession 议 外戚回避)
  if (!scenario || !scenario.tinyi || !scenario.tinyi.convening) return null;
  var conv = scenario.tinyi.convening;
  var forbidden = (conv.topicSpecificForbidden || {})[topic];
  if (Array.isArray(forbidden) && ch) {
    for (var i = 0; i < forbidden.length; i++) {
      var fbTag = forbidden[i];
      if (ch.party === fbTag || (ch.class === 'waixi' && fbTag === '外戚') || (ch.class === 'neimon' && fbTag === '内监')) {
        return { category: '不召', layer: 4 };
      }
    }
  }
  return null;
}

function _ty3_calcEligibilityByPartyTaboo(ch, topic) {
  // 党派回避·议题敏感时同党不入 (本期 stub·留待 Slice 6 RULES 扩)
  return null;
}

function _ty3_calcEligibilityByPrestige(ch) {
  // v1.4 加·composite = (prestige + influence) / 2
  var composite = (((ch && ch.prestige) || 50) + ((ch && ch.influence) || 50)) / 2;
  // 名望影响廷议话语权(设计-角色经济·资源三)·×(1+fame/100)·fame≠prestige 各自独立·clamp 防极端
  var _fameTy = (ch && ch.resources && typeof ch.resources.fame === 'number') ? ch.resources.fame : 0;
  if (_fameTy) composite *= Math.max(0.5, Math.min(1.5, 1 + _fameTy / 100));
  var rankLevel = _cyRankLevelOfSafe(_cyGetRankSafe(ch));
  if (composite >= 90)                       return { category: '必召', layer: 6 };
  if (composite >= 75 && rankLevel <= 8)     return { category: '必召', layer: 6 };
  if (composite >= 80 && rankLevel <= 14)    return { category: '必召', layer: 6 };  // 言官清流
  if (composite <= 30 && rankLevel >= 12)    return { category: '不召', layer: 6 };
  return null;
}

function _ty3_calcEligibility(ch, topic, scenario) {
  var layers = [
    _ty3_calcEligibilityByRank(ch),
    _ty3_calcEligibilityByLocation(ch),
    _ty3_calcEligibilityByStatus(ch),
    _ty3_calcEligibilityByDynasty(ch, scenario, topic),
    _ty3_calcEligibilityByPartyTaboo(ch, topic),
    _ty3_calcEligibilityByPrestige(ch)
  ].filter(Boolean);
  // 3 态 priority cascade (v2.6 措辞修)·不召 cancel·必召 elevate·其他取严
  var bujao = layers.find(function(l) { return l.category === '不召'; });
  if (bujao) return { category: '不召', layer: bujao.layer, eligible: false };
  var bijao = layers.find(function(l) { return l.category === '必召'; });
  if (bijao) return { category: '必召', layer: bijao.layer, eligible: true };
  var order = ['可召', '罕召'];
  var max = '可召';
  layers.forEach(function(l) {
    if (order.indexOf(l.category) > order.indexOf(max)) max = l.category;
  });
  return { category: max, layer: 0, eligible: max !== '罕召' };
}

// ─── 2.5.4·5 后果·_ty3_calcConveningPolitics + 5 v15 helper (v2.9 §5.4.3) ───

function _ty3_v15_countByParty(attendees) {
  var m = new Map();
  attendees.forEach(function(name) {
    var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
    var party = (ch && ch.party) || '中立';
    m.set(party, (m.get(party) || 0) + 1);
  });
  return m;
}

function _ty3_v15_findMissedRequired(attendees, topic, scenario) {
  var conv = _ty3_getConveningConfig(scenario);
  var required = (conv.requiredCallList || []).slice();
  var topicSpecific = (conv.topicSpecificRequired || {})[topic] || [];
  var fullRequired = Array.from(new Set(required.concat(topicSpecific)));
  return fullRequired
    .map(function(role) {
      // 找 attendees 外的·officialTitle 含 role 的 char (rough match)
      var chs = (typeof GM !== 'undefined' && Array.isArray(GM.chars)) ? GM.chars : [];
      return chs.find(function(c) {
        return c && c.alive !== false && !attendees.includes(c.name)
            && c.officialTitle && c.officialTitle.indexOf(role) >= 0;
      });
    })
    .filter(Boolean);
}

function _ty3_v15_addSickLeaveEvent(ch, expireTurn) {
  if (typeof GM === 'undefined') return;
  GM._pendingSickLeaveEvents = GM._pendingSickLeaveEvents || [];
  GM._pendingSickLeaveEvents.push({ name: ch.name, fromTurn: GM.turn || 0, expireTurn: expireTurn });
  ch._sick = true;
}

function _ty3_v15_addResignMemorial(ch, expireTurn) {
  if (typeof GM === 'undefined') return;
  GM._pendingResignMemorials = GM._pendingResignMemorials || [];
  GM._pendingResignMemorials.push({ name: ch.name, fromTurn: GM.turn || 0, expireTurn: expireTurn, reason: '漏召累计 4 次' });
}

function _ty3_v15_pushClearOpinionEvent(opposingParties, triggerTurn) {
  if (typeof GM === 'undefined') return;
  GM._pendingClearOpinionEvents = GM._pendingClearOpinionEvents || [];
  (opposingParties || []).forEach(function(p) {
    GM._pendingClearOpinionEvents.push({
      party: p.name || p, fromTurn: GM.turn || 0, triggerTurn: triggerTurn,
      effect: '该党联名清议·prestige 集体 +2·tension +5'
    });
  });
}

function _ty3_calcConveningPolitics(attendees, proposerParty, topic, scenario) {
  var opposing = (typeof _ty3_getOpposingParties === 'function') ? _ty3_getOpposingParties(proposerParty) : [];

  // crossPartyRatio·v2.7 bug 修·counts.size===1 时 走 oneParty·非 'balanced'
  var counts = _ty3_v15_countByParty(attendees);
  var crossPartyRatio = 0;
  var tilt = 'balanced';
  if (counts.size === 0) {
    tilt = 'balanced';
  } else if (counts.size === 1) {
    tilt = attendees.length >= 8 ? 'fullOneParty' :
           attendees.length >= 5 ? 'oneParty'     : 'balanced';
  } else {
    var values = Array.from(counts.values());
    crossPartyRatio = Math.min.apply(null, values) / Math.max.apply(null, values);
    if (crossPartyRatio > 0.6) tilt = 'balanced';
    else if (crossPartyRatio < 0.2 && attendees.length >= 5) {
      tilt = 'oneParty';
      if (opposing[0]) opposing[0].tension = (opposing[0].tension || 0) + 3;
    }
    if (crossPartyRatio === 0 && attendees.length >= 8) {
      tilt = 'fullOneParty';
    }
  }
  if (attendees.length >= 20) {
    tilt = 'megaCeremony';
    if (typeof CY !== 'undefined' && CY._ty3) CY._ty3._personaDamp = 0.8;
  }

  if (tilt === 'fullOneParty') _ty3_v15_pushClearOpinionEvent(opposing, (GM.turn || 0) + 3);

  // 后果 1·漏召大臣 (prestige 加权·affinity 单值 v2.6 修)
  var missedRequired = _ty3_v15_findMissedRequired(attendees, topic, scenario);
  missedRequired.forEach(function(ch) {
    var mult = ch.prestige >= 80 ? 2.0 : ch.prestige >= 60 ? 1.5 : ch.prestige >= 40 ? 1.0 : 0.5;
    ch.loyalty = Math.max(0, (ch.loyalty || 50) - 3 * mult);
    ch.affinity = Math.max(0, (ch.affinity || 50) - 3 * mult * 0.6);  // number 单值
    ch._missedCallsCount = (ch._missedCallsCount || 0) + 1;
    if (ch._missedCallsCount >= 2) _ty3_v15_addSickLeaveEvent(ch, (GM.turn || 0) + 2);
    if (ch._missedCallsCount >= 4) _ty3_v15_addResignMemorial(ch, (GM.turn || 0) + 3);
  });

  return {
    tilt: tilt,
    crossPartyRatio: crossPartyRatio,
    missedHighRank: missedRequired.map(function(c) { return c.name; }),
    attendeeCount: attendees.length,
    turn: (typeof GM !== 'undefined' ? GM.turn : 0) || 0
  };
}

// ─── 2.5.6/7·民意度 + 言官离心 init + decay (v2.9 §5.4.7/8/9) ───

function _ty3_initConveningCounters(scenario) {
  if (typeof GM === 'undefined') return;
  if (GM._convening_民意度 == null) {
    var dynasty = (scenario && scenario.dynasty) || (GM.scenario && GM.scenario.dynasty) || '明';
    var period = (scenario && (scenario.dynastyPhaseHint || scenario.period)) || '中兴';
    var dynastyInit = DYNASTY_POPULATION_CONFIDENCE_INIT[dynasty] || 0;
    var periodInit = DYNASTY_POPULATION_CONFIDENCE_INIT[period] || 0;
    var customInit = (scenario && scenario.tinyi && scenario.tinyi.populationConfidenceInit) || 0;
    GM._convening_民意度 = Math.max(-100, Math.min(100, dynastyInit + periodInit + customInit));
  }
  if (GM._convening_言官离心 == null) GM._convening_言官离心 = 0;
}

function _ty3_v15_decayConveningCounters() {
  if (typeof GM === 'undefined' || !GM) return;
  // v2.6 polish·decay 调时若 counters 还 null·先 lazy init·避永远 0
  if (GM._convening_民意度 == null || GM._convening_言官离心 == null) {
    try { _ty3_initConveningCounters(GM.scenario); } catch (_) {}
  }
  // v2.6 polish·Round 4·process + 限 _pendingMartyrEvents·此前 push 无人消费·无限累
  if (Array.isArray(GM._pendingMartyrEvents) && GM._pendingMartyrEvents.length > 0) {
    var _now = GM.turn || 0;
    // 1·过期 (>5 turn) 的 martyr event·dispatch 到 EB + NpcMemory + drop
    var _toProcess = GM._pendingMartyrEvents.filter(function(e) { return e && (_now - (e.turn || 0)) >= 1; });
    _toProcess.forEach(function(e) {
      try {
        if (typeof addEB === 'function') addEB('廷议', '〔 ' + e.npc + '·议《' + (e.topic || '').slice(0, 20) + '》失利·愤而上书 〕');
        if (typeof NpcMemorySystem !== 'undefined' && typeof NpcMemorySystem.remember === 'function') {
          NpcMemorySystem.remember(e.npc, '议《' + (e.topic || '').slice(0, 24) + '》裁决违心·愤而以死谏', '恨', 9, '廷议');
        }
      } catch (_emE) {}
    });
    // 2·限 30 entry cap·防超长游戏累积
    GM._pendingMartyrEvents = GM._pendingMartyrEvents.filter(function(e) { return (_now - (e.turn || 0)) < 1; });
    if (GM._pendingMartyrEvents.length > 30) GM._pendingMartyrEvents = GM._pendingMartyrEvents.slice(-30);
  }
  // v2.6 polish·Round 5·process + 限 _pendingTinyiActions (Slice 7.5 action 落地·此前 push 无人消费)
  if (Array.isArray(GM._pendingTinyiActions) && GM._pendingTinyiActions.length > 0) {
    var _nowA = GM.turn || 0;
    // 1·dispatch 1+ turn 之前的 action 到 newslog / EB·标 processed
    var _actEmoji = { flogging: '🔨', strip: '❌', dismiss: '👋', toPart: '📑', reopen: '📜', revoke: '⚰️' };
    var _actLabel = { flogging: '廷杖', strip: '削籍', dismiss: '退殿', toPart: '转部议', reopen: '更议', revoke: '革职' };
    GM._pendingTinyiActions.forEach(function(a) {
      if (a._processed || (_nowA - (a.turn || 0)) < 1) return;
      try {
        var emo = _actEmoji[a.type] || '·';
        var lbl = _actLabel[a.type] || a.type;
        var tgt = (a.payload && (a.payload.target || a.payload.part || a.payload.topic)) || '';
        if (typeof addEB === 'function') addEB('廷议·行动落实', emo + ' ' + lbl + (tgt ? '·' + tgt : ''));
        a._processed = true;
      } catch (_paE) {}
    });
    // 2·清 processed·限 50 entry cap
    GM._pendingTinyiActions = GM._pendingTinyiActions.filter(function(a) { return !a._processed; });
    if (GM._pendingTinyiActions.length > 50) GM._pendingTinyiActions = GM._pendingTinyiActions.slice(-50);
  }
  var monthsPerTurn = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30.4375;
  // 1·民意度 decay·按 dynasty
  if (typeof GM._convening_民意度 === 'number') {
    var dynasty = (GM.scenario && GM.scenario.dynasty) || '明';
    var baseRate = { '明':0.88, '宋':0.94, '唐':0.91, '元':0.85, '清':0.90 }[dynasty] || 0.90;
    GM._convening_民意度 *= Math.pow(baseRate, monthsPerTurn);
    GM._convening_民意度 = Math.max(-100, Math.min(100, GM._convening_民意度));
  }
  // 2·言官离心 decay·5%/月
  if (typeof GM._convening_言官离心 === 'number') {
    GM._convening_言官离心 *= Math.pow(0.95, monthsPerTurn);
    GM._convening_言官离心 = Math.max(0, Math.min(100, GM._convening_言官离心));
  }
  // 3·conveningPolitics 7-turn 后 reset
  if (typeof CY !== 'undefined' && CY._ty3 && CY._ty3.conveningPolitics) {
    var ctP = CY._ty3.conveningPolitics;
    if (ctP.turn != null && (GM.turn - ctP.turn) >= 7) {
      CY._ty3.conveningPolitics = null;
    }
  }
  // 4·pending events 按 expireTurn 清理
  ['_pendingSickLeaveEvents', '_pendingResignMemorials', '_pendingClearOpinionEvents'].forEach(function(key) {
    if (!Array.isArray(GM[key])) return;
    GM[key] = GM[key].filter(function(e) { return !e.expireTurn || e.expireTurn > GM.turn; });
  });
}

// ─── 2.5.6 民意度 5 档·get hint (供 Slice 4 prompt 注入) ───

function _ty3_getPopulationConfidenceTier() {
  if (typeof GM === 'undefined' || GM._convening_民意度 == null) return 'unknown';
  var v = GM._convening_民意度;
  if (v >= 80) return '极公允';
  if (v >= 40) return '公允';
  if (v >= -40) return '兼听';
  if (v >= -80) return '偏私';
  return '独断';
}

// expose 全
if (typeof window !== 'undefined') {
  window._ty3_getConveningConfig = _ty3_getConveningConfig;
  window._ty3_calcEligibility = _ty3_calcEligibility;
  window._ty3_calcConveningPolitics = _ty3_calcConveningPolitics;
  window._ty3_v15_countByParty = _ty3_v15_countByParty;
  window._ty3_v15_findMissedRequired = _ty3_v15_findMissedRequired;
  window._ty3_v15_addSickLeaveEvent = _ty3_v15_addSickLeaveEvent;
  window._ty3_v15_addResignMemorial = _ty3_v15_addResignMemorial;
  window._ty3_v15_pushClearOpinionEvent = _ty3_v15_pushClearOpinionEvent;
  window._ty3_initConveningCounters = _ty3_initConveningCounters;
  window._ty3_v15_decayConveningCounters = _ty3_v15_decayConveningCounters;
  window._ty3_getPopulationConfidenceTier = _ty3_getPopulationConfidenceTier;
}

// v2.6 Slice 9·cumulative + emperor cue·复用 _cc3_* (alias)·retry 直到 _cc3_* load
(function _ty3_aliasCc3Helpers() {
  if (typeof window === 'undefined') return;
  var attempts = 0;
  function tryAlias() {
    if (attempts++ > 30) return;
    var changed = false;
    if (typeof _cc3_cumulativeHint === 'function' && !window._ty3_cumulativeHint) {
      window._ty3_cumulativeHint = _cc3_cumulativeHint;
      changed = true;
    }
    if (typeof _cc3_emperorCueHint === 'function' && !window._ty3_emperorCueHint) {
      window._ty3_emperorCueHint = _cc3_emperorCueHint;
      changed = true;
    }
    if (!window._ty3_cumulativeHint || !window._ty3_emperorCueHint) {
      setTimeout(tryAlias, 200);
    }
  }
  tryAlias();
})();

// ═══════════════════════════════════════════════════════════════════════
//  §0.9·Slice 3·hybrid stance paradigm (v2.6·user 选 C·dims helpers + RULES)
// ═══════════════════════════════════════════════════════════════════════

// 4 helper·v2.8 §5.5.2 ~54 trait BIAS·按 runtime fill-shaosong-traits.js SI naming
var TRAIT_TO_DIMS_BIAS = {
  // personality 36
  brave:        { honor: +0.1, boldness: +0.3 },
  craven:       { boldness: -0.3, cunning: +0.1 },
  calm:         { rationality: +0.2, cunning: +0.1 },
  wrathful:     { boldness: +0.2, honor: +0.1 },
  chaste:       { honor: +0.2, confucianism: +0.2 },
  lustful:      { honor: -0.2 },
  content:      { greed: -0.2 },
  ambitious:    { greed: +0.2, cunning: +0.1 },
  diligent:     { rationality: +0.2 },
  lazy:         { greed: +0.1 },
  honest:       { honor: +0.3, cunning: -0.2 },
  deceitful:    { honor: -0.3, cunning: +0.3 },
  generous:     { compassion: +0.2 },
  greedy:       { greed: +0.3 },
  gregarious:   { cunning: +0.1, loyalty: +0.1 },
  shy:          { cunning: -0.1 },
  humble:       { honor: +0.1, confucianism: +0.1 },
  arrogant:     { boldness: +0.2, honor: -0.1 },
  just:         { honor: +0.3, compassion: +0.1 },
  arbitrary:    { rationality: -0.2, boldness: +0.2 },
  patient:      { rationality: +0.1 },
  impatient:    { boldness: +0.2 },
  temperate:    { greed: -0.2, confucianism: +0.1 },
  gluttonous:   { greed: +0.2 },
  trusting:     { loyalty: +0.2 },
  paranoid:     { cunning: +0.2, loyalty: -0.1 },
  zealous:      { honor: +0.2, boldness: +0.3 },
  cynical:      { compassion: -0.2 },
  forgiving:    { compassion: +0.3 },
  vengeful:     { boldness: +0.2, honor: -0.1 },
  compassionate:{ compassion: +0.3 },
  callous:      { compassion: -0.3 },
  sadistic:     { compassion: -0.4, boldness: +0.2 },
  stubborn:     { boldness: +0.2, rationality: -0.1 },
  fickle:       { cunning: +0.2, loyalty: -0.1 },
  eccentric:    { rationality: -0.1, cunning: +0.1 },
  // lifestyle / role 9
  scholar:           { confucianism: +0.4, rationality: +0.2 },
  theologian:        { confucianism: +0.3 },
  schemer:           { cunning: +0.3, honor: -0.1 },
  diplomat_ls:       { rationality: +0.2, cunning: +0.1 },
  administrator_ls:  { rationality: +0.2 },
  strategist:        { rationality: +0.2, boldness: +0.1 },
  family_first:      { loyalty: +0.2 },
  gallant:           { honor: +0.2, boldness: +0.2 },
  august:            { honor: +0.2, confucianism: +0.1 },
  // commander 7
  aggressive_attacker: { boldness: +0.3 },
  unyielding_defender: { boldness: +0.2, rationality: +0.1 },
  cautious_leader:     { rationality: +0.2, boldness: -0.1 },
  reckless:            { boldness: +0.3, rationality: -0.2 },
  flexible_leader:     { cunning: +0.2 },
  organizer:           { rationality: +0.2 },
  holy_warrior:        { honor: +0.3, boldness: +0.2, confucianism: +0.2 },
  // 健康 / 特殊 2
  scarred:    { boldness: +0.1 },
  depressed:  { boldness: -0.2 }
};

function _ty3_dimsFromTraits(traitIds) {
  var dims = { honor: 0.5, compassion: 0.5, boldness: 0.5, rationality: 0.5,
               greed: 0.5, cunning: 0.5, loyalty: 0.5, confucianism: 0.5 };
  if (!Array.isArray(traitIds)) return dims;
  traitIds.forEach(function(t) {
    var b = TRAIT_TO_DIMS_BIAS[t]; if (!b) return;
    Object.keys(b).forEach(function(k) {
      dims[k] = Math.max(0, Math.min(1, dims[k] + b[k]));
    });
  });
  return dims;
}

// fallback B·keyword regex (v2.9 §5.5.6·~30 keyword)
// v2.6 polish·补 fallback C·若 personality/bio 全空·按 class / officialTitle / faction 派生
// 让 67 chars 无 traitId 且无 bio 时仍有 nontrivial dims·非 0.5 全中
function _ty3_dimsFromKeywords(ch) {
  var text = ((ch && ch.personality) || '') + ((ch && ch.desc) || '') + ((ch && ch.bio) || '') + ((ch && ch.background) || '');
  var dims = { honor: 0.5, compassion: 0.5, boldness: 0.5, rationality: 0.5,
               greed: 0.5, cunning: 0.5, loyalty: 0.5, confucianism: 0.5 };
  // fallback C·按 class·5 class × dims·若 text 空也跑·让 67 无 bio 的 chars 有差异
  if (ch && ch.class) {
    var classBias = {
      kdao:    { honor: +0.25, boldness: +0.2, cunning: -0.15 },    // 言官·正直勇敢
      geechen: { rationality: +0.2, confucianism: +0.2, cunning: +0.1 },  // 阁臣·理性儒臣
      wujiang: { boldness: +0.25, rationality: -0.1, confucianism: -0.15 },  // 武将·勇而不文
      xunqi:   { loyalty: +0.2, greed: -0.1, boldness: -0.1 },      // 勋戚·忠而稳
      waixi:   { loyalty: +0.15, cunning: +0.15, honor: -0.05 }     // 外戚·亲忠而曲
    }[ch.class];
    if (classBias) Object.keys(classBias).forEach(function(k) { dims[k] += classBias[k]; });
  }
  // fallback D·按 officialTitle·首辅 / 御史 / 总督 等加 cue
  if (ch && ch.officialTitle) {
    if (/首辅/.test(ch.officialTitle))      { dims.rationality += 0.1; dims.cunning += 0.1; }
    if (/御史|科道|言官/.test(ch.officialTitle)) { dims.honor += 0.15; dims.boldness += 0.1; }
    if (/总督|总兵|提督/.test(ch.officialTitle)) { dims.boldness += 0.1; dims.confucianism -= 0.05; }
    if (/侍郎|主事|郎中/.test(ch.officialTitle)) { dims.rationality += 0.05; }
  }
  if (!text) {
    // 走 fallback C/D 后 clamp 返
    Object.keys(dims).forEach(function(k) { dims[k] = Math.max(0, Math.min(1, dims[k])); });
    return dims;
  }
  if (/正直|忠贞|清廉|耿介|公正|秉公|刚正/.test(text)) dims.honor += 0.3;
  if (/贪|私|曲|阿|奸/.test(text))                    dims.honor -= 0.3;
  if (/仁慈|爱民|宽厚|怜悯|仁善/.test(text))         dims.compassion += 0.3;
  if (/严苛|苛察|残忍|冷酷|嗜杀/.test(text))         dims.compassion -= 0.3;
  if (/敢|勇|刚|果|胆|无畏/.test(text))               dims.boldness += 0.3;
  if (/谨|怯|畏|柔|惜身/.test(text))                  dims.boldness -= 0.3;
  if (/智|谋|策|权|理|沉稳|审慎/.test(text))          dims.rationality += 0.3;
  if (/愚|憨|直|急躁/.test(text))                     dims.rationality -= 0.2;
  if (/贪|嗜利|奢|纵欲/.test(text))                   dims.greed += 0.3;
  if (/廉|俭|淡泊|寡欲/.test(text))                   dims.greed -= 0.3;
  if (/阴|险|狡|诈|心机/.test(text))                  dims.cunning += 0.3;
  if (/朴|实|讷|纯|诚厚/.test(text))                  dims.cunning -= 0.2;
  if (/忠|顺|敬|誓死/.test(text))                     dims.loyalty += 0.2;
  if (/叛|背|怀异|二心/.test(text))                   dims.loyalty -= 0.3;
  if (/儒|经|学|博|读书/.test(text))                  dims.confucianism += 0.3;
  if (/武|武勇|战|兵略/.test(text))                   dims.confucianism -= 0.1;
  // clamp 0-1
  Object.keys(dims).forEach(function(k) { dims[k] = Math.max(0, Math.min(1, dims[k])); });
  return dims;
}

function _ty3_getDims(ch) {
  if (!ch) return _ty3_dimsFromKeywords(null);
  if (ch.aggregateDims && Object.keys(ch.aggregateDims).some(function(k) { return ch.aggregateDims[k] !== 0 && ch.aggregateDims[k] !== 0.5; }))
    return ch.aggregateDims;
  if (Array.isArray(ch.traitIds) && ch.traitIds.length > 0)
    return _ty3_dimsFromTraits(ch.traitIds);
  return _ty3_dimsFromKeywords(ch);
}

// initial stance·按 RULES·v2.9 §5.5.1 25 条核心 + class 加成
// L4·c·wrapper·调 reformLean modulator·tags 含 reform / restoration 时加权·非 reform topic 透传
function _ty3_initialStanceFromDims(ch, topic, tags) {
  var result = _ty3_initialStanceFromDimsCore(ch, topic, tags);
  return _ty3_applyReformLeanModulator(ch, tags, result);
}

// L4·c·NEW·若 NPC 有 _kjpReformLean (R6 schema·{value, lastTurn})·且 tags 含 reform·调 stance intensity
// 走 tags 非 topic.source·因 topic 实际是 string (tinyi-v3.js:4085 / panel.js:1677 都传 string)
// 不动原 17 return 分支·post-call wrap·防破 v3 25 RULES + smoke 115 case
function _ty3_applyReformLeanModulator(ch, tags, result) {
  if (!result) return result;
  if (!ch || !ch._kjpReformLean) return result;
  var leanObj = ch._kjpReformLean;
  // R6 schema·必 object·旧 plain number 不响应 (R6 _kjpAccumReformLean 已自动升级·防回退)
  if (typeof leanObj !== 'object') return result;
  var t = tags || [];
  // panel.js _kjpClassifyDiffTags 派出 'reform' / 'restoration'·tinyi v3 _ty3_inferTopicTags 同
  var isReform = t.indexOf('reform') >= 0 || t.indexOf('restoration') >= 0;
  if (!isReform) return result;

  var lean = parseInt(leanObj.value, 10) || 0;
  // R6·decay 由 _kjpAccumReformLean 写时算·此处直接读 current value

  if (lean > 30) {
    // 偏 support·原 oppose 翻 neutral·原其他 boost intensity
    if (result.stance === 'oppose') {
      return { stance: 'neutral', intensity: (result.intensity || 0.5) * 0.7, _modulated: true, _modSource: 'reformLean+' };
    }
    return { stance: 'support', intensity: Math.min(1.0, (result.intensity || 0.5) * 1.3), _modulated: true, _modSource: 'reformLean+' };
  }
  if (lean < -30) {
    if (result.stance === 'support') {
      return { stance: 'neutral', intensity: (result.intensity || 0.5) * 0.7, _modulated: true, _modSource: 'reformLean-' };
    }
    return { stance: 'oppose', intensity: Math.min(1.0, (result.intensity || 0.5) * 1.3), _modulated: true, _modSource: 'reformLean-' };
  }
  // -30~+30·噪音区·不改·避免轻微 audience 翻 stance
  return result;
}

function _ty3_initialStanceFromDimsCore(ch, topic, tags) {
  var dims = _ty3_getDims(ch);
  tags = tags || [];
  var tagsSet = {};
  tags.forEach(function(t) { tagsSet[t] = true; });
  var has = function(t) { return tagsSet[t]; };

  // 高 honor·廷议特化 (oppose 倾向)
  if (dims.honor >= 0.7 && has('regicide-pursuit')) return { stance: 'oppose', intensity: 0.9 };
  if (dims.honor >= 0.7 && has('penal-harsh'))      return { stance: 'oppose', intensity: 0.7 };
  // 高 compassion·缓冲
  if (dims.compassion >= 0.7 && has('penal-harsh'))    return { stance: 'oppose', intensity: 0.8 };
  if (dims.compassion >= 0.7 && has('relief'))         return { stance: 'support', intensity: 0.8 };
  // 高 boldness·激进
  if (dims.boldness >= 0.7 && has('regicide-pursuit')) return { stance: 'support', intensity: 0.9 };
  if (dims.boldness >= 0.7 && has('military-command')) return { stance: 'support', intensity: 0.7 };
  // 高 rationality·数据流
  if (dims.rationality >= 0.7 && has('finance'))       return { stance: 'neutral', intensity: 0.5 };
  if (dims.rationality >= 0.7 && has('reward'))        return { stance: 'oppose', intensity: 0.6 };
  // 高 greed·随大流·偏 support reward
  if (dims.greed >= 0.7 && has('reward'))              return { stance: 'support', intensity: 0.7 };
  if (dims.greed >= 0.7 && has('land-tax'))            return { stance: 'oppose', intensity: 0.7 };
  // 高 cunning·灵活 (pivot)
  if (dims.cunning >= 0.7 && has('succession'))        return { stance: 'neutral', intensity: 0.5 };
  // 高 loyalty·主君近·support
  if (dims.loyalty >= 0.8)                             return { stance: 'support', intensity: 0.7 };
  // 高 confucianism·经典派
  if (dims.confucianism >= 0.7 && has('ritual'))       return { stance: 'support', intensity: 0.7 };
  if (dims.confucianism >= 0.7 && has('imperial-lecture')) return { stance: 'support', intensity: 0.8 };
  // class 加成·言官特化 (kdao class)
  if (ch && ch.class === 'kdao' && has('regicide-pursuit')) return { stance: 'support', intensity: 0.9 };
  if (ch && ch.class === 'kdao' && dims.honor >= 0.6)      return { stance: 'support', intensity: 0.7 };
  // class 加成·阉党
  if (ch && ch.party === '阉党' && has('regicide-pursuit')) return { stance: 'oppose', intensity: 0.9 };
  // 中立 / 折中党
  if (ch && ch.party === '中立')                        return { stance: 'neutral', intensity: 0.5 };

  // fallback·按 dims dominant 算
  var honorWeight = dims.honor + dims.compassion;
  var ambitionWeight = dims.greed + dims.cunning;
  if (honorWeight > ambitionWeight + 0.4) return { stance: 'oppose', intensity: 0.6 };
  if (ambitionWeight > honorWeight + 0.4) return { stance: 'support', intensity: 0.6 };
  return { stance: 'neutral', intensity: 0.4 };
}

// 党争归属 → initial 立场先验（通用·非朝代专名·2026-07-03）：
// scan 的党议/民情/运动议题都带 sourceParty/opposingParties——但旧版 initial 全靠性格 8D·
// 「此议由本党所倡还是敌党所倡」对起始立场零影响·党争只活在 LLM 嘴上。
// 规则：本党所倡→倾支持·名列反对方/倡者是本党runtime敌党→倾反对；党纪强度随凝聚升；
// 巨猾低忠者不受党纪拘（全由性格）；死硬性格(强度≥0.9 且相反)可压过党纪——性格与党争真实拉扯。
function _ty3_partyStanceBias(ch, meta) {
  if (!ch || !ch.party || !meta) return null;
  var myParty = ch.party;
  var dims = (typeof _ty3_getDims === 'function') ? _ty3_getDims(ch) : {};
  if ((dims.cunning || 0) >= 0.8 && (dims.loyalty || 0) <= 0.3) return null;
  var coh = (typeof _ty3_partyCohesion === 'function') ? (Number(_ty3_partyCohesion(myParty)) || 50) : 50;
  var discipline = Math.min(0.85, Math.max(0.5, 0.5 + (coh - 30) / 150));
  if (meta.sourceParty && meta.sourceParty === myParty) return { stance: 'support', intensity: discipline };
  var opp = Array.isArray(meta.opposingParties) ? meta.opposingParties : [];
  for (var i = 0; i < opp.length; i += 1) {
    var on = (opp[i] && typeof opp[i] === 'object') ? (opp[i].name || '') : String(opp[i] || '');
    if (on === myParty) return { stance: 'oppose', intensity: discipline };
  }
  if (meta.sourceParty && typeof _ty3_getOpposingParties === 'function') {
    try {
      var foes = _ty3_getOpposingParties(myParty) || [];
      for (var j = 0; j < foes.length; j += 1) {
        var fn = (foes[j] && typeof foes[j] === 'object') ? foes[j].name : foes[j];
        if (fn === meta.sourceParty) return { stance: 'oppose', intensity: Math.max(0.5, discipline - 0.1) };
      }
    } catch (_pbE) {}
  }
  return null;
}

// expose
if (typeof window !== 'undefined') {
  window.TRAIT_TO_DIMS_BIAS = TRAIT_TO_DIMS_BIAS;
  window._ty3_dimsFromTraits = _ty3_dimsFromTraits;
  window._ty3_dimsFromKeywords = _ty3_dimsFromKeywords;
  window._ty3_getDims = _ty3_getDims;
  window._ty3_initialStanceFromDims = _ty3_initialStanceFromDims;
  // L4·c·expose
  window._ty3_initialStanceFromDimsCore = _ty3_initialStanceFromDimsCore;
  window._ty3_applyReformLeanModulator = _ty3_applyReformLeanModulator;
  window._ty3_partyStanceBias = _ty3_partyStanceBias;
}

// ═══════════════════════════════════════════════════════════════════════
//  §0.95·Slice 6·mode rule engine (v2.6·25 RULES + ~54 trait bias + emperor + tone)
// ═══════════════════════════════════════════════════════════════════════

// ─── §5.5.1·25 RULES (8D dims × topic-tag → mode) ───
var TINYI_MODE_RULES = [
  // 高 honor·廷议特化
  { id: 'honor_etiquette',      if: function(d, t)    { return d.honor >= 0.7 && t.includes('etiquette'); },           then: 'rebut',        force: true },
  { id: 'honor_regicide',       if: function(d, t)    { return d.honor >= 0.7 && t.includes('regicide-pursuit'); },    then: 'confront',     force: true },
  // 高 compassion·缓冲
  { id: 'compass_penal_soften', if: function(d, t, c) { return d.compassion >= 0.7 && t.includes('penal-harsh'); },    then: 'soften',       force: true },
  { id: 'compass_rebut_soften', if: function(d, t, c, m) { return d.compassion >= 0.7 && m === 'rebut'; },             then: 'soften' },
  // 高 boldness·激进
  { id: 'bold_regicide',        if: function(d, t)    { return d.boldness >= 0.7 && t.includes('regicide-pursuit'); }, then: 'martyr',       force: true },
  { id: 'bold_soften_rebut',    if: function(d, t, c, m) { return d.boldness >= 0.7 && m === 'soften'; },              then: 'rebut',        force: true },
  // 高 rationality·数据流
  { id: 'rat_finance',          if: function(d, t)    { return d.rationality >= 0.7 && t.includes('finance'); },       then: 'augment' },
  { id: 'rat_military',         if: function(d, t)    { return d.rationality >= 0.7 && t.includes('military-command'); }, then: 'cite_classic' },
  // 高 greed·随大流
  { id: 'greed_reward_second',  if: function(d, t)    { return d.greed >= 0.7 && t.includes('reward'); },              then: 'second' },
  { id: 'greed_partyhigh_second', if: function(d, t, c){ return d.greed >= 0.7 && c && c.party && c.party !== '中立'; }, then: 'second' },
  // 高 cunning·灵活
  { id: 'cun_lead_pivot',       if: function(d, t, c, m) { return d.cunning >= 0.7 && m === 'lead'; },                 then: 'pivot' },
  { id: 'cun_succ_pivot',       if: function(d, t)    { return d.cunning >= 0.7 && t.includes('succession'); },        then: 'pivot',        force: true },
  // 高 loyalty·门生附议 (clientelism 兜底)
  { id: 'loy_mentor_client',    if: function(d, t, c) { return d.loyalty >= 0.8 && c && c._mentorInAttendees; },        then: 'clientelism',  force: true },
  // 高 confucianism·经典派
  { id: 'conf_ritual',          if: function(d, t)    { return d.confucianism >= 0.7 && t.includes('ritual'); },       then: 'cite_classic' },
  { id: 'conf_lecture',         if: function(d, t)    { return d.confucianism >= 0.7 && t.includes('imperial-lecture'); }, then: 'cite_classic', force: true },
  // 低 honor + 高 cunning·阴险
  { id: 'low_honor_cunning',    if: function(d)       { return d.honor <= 0.3 && d.cunning >= 0.6; },                  then: 'soften' },
  // 言官特化
  { id: 'kdao_regicide',        if: function(d, t, c) { return c && c.class === 'kdao' && t.includes('regicide-pursuit'); }, then: 'martyr', force: true },
  { id: 'kdao_honor',           if: function(d, t, c) { return c && c.class === 'kdao' && d.honor >= 0.6; },           then: 'martyr' },
  // 阉党特化
  { id: 'yandang_regicide',     if: function(d, t, c) { return c && c.party === '阉党' && t.includes('regicide-pursuit'); }, then: 'rebut', force: true },
  { id: 'yandang_lead_cite',    if: function(d, t, c, m) { return c && c.party === '阉党' && m === 'lead'; },          then: 'cite_classic' },
  // 内阁阁臣特化
  { id: 'fushou_succ_pivot',    if: function(d, t, c) { return c && c.officialTitle && /首辅|次辅/.test(c.officialTitle) && t.includes('succession'); }, then: 'pivot', force: true },
  { id: 'fushou_rebut_soften',  if: function(d, t, c, m) { return c && c.officialTitle && /首辅/.test(c.officialTitle) && m === 'rebut'; }, then: 'soften' },
  // 中立 / 折中党
  { id: 'neutral_tension_pivot',if: function(d, t, c) { return c && c.party === '中立'; },                              then: 'pivot' },
  { id: 'neutral_confront_soften', if: function(d, t, c, m) { return c && c.party === '中立' && m === 'confront'; },   then: 'soften',       force: true },
  // anti-塌缩 guard (Slice 6 4 项之一·全员同 mode 时换)
  { id: 'anti_sameMode_3plus',  if: function(d, t, c, m, ctx) { return ctx && ctx.sameModeCount >= 3 && m === 'rebut'; }, then: 'augment' }
];

// ─── §5.5.2·~54 trait → mode bias (v2.8 全写·跟 fill-shaosong-traits.js naming) ───
var TRAIT_TO_MODE_BIAS = {
  // personality 36
  brave: { mode: 'confront', weight: 0.4 }, craven: { mode: 'soften', weight: 0.3 },
  calm: { mode: 'cite_classic', weight: 0.3 }, wrathful: { mode: 'confront', weight: 0.4 },
  chaste: { mode: 'cite_classic', weight: 0.3 }, lustful: { mode: 'pivot', weight: 0.2 },
  content: { mode: 'second', weight: 0.3 }, ambitious: { mode: 'lead', weight: 0.4 },
  diligent: { mode: 'augment', weight: 0.3 }, lazy: { mode: 'second', weight: 0.3 },
  honest: { mode: 'martyr', weight: 0.4 }, deceitful: { mode: 'pivot', weight: 0.4 },
  generous: { mode: 'soften', weight: 0.2 }, greedy: { mode: 'second', weight: 0.4 },
  gregarious: { mode: 'clientelism', weight: 0.3 }, shy: { mode: 'pivot', weight: 0.2 },
  humble: { mode: 'soften', weight: 0.3 }, arrogant: { mode: 'rebut', weight: 0.4 },
  just: { mode: 'martyr', weight: 0.5 }, arbitrary: { mode: 'rebut', weight: 0.3 },
  patient: { mode: 'cite_classic', weight: 0.2 }, impatient: { mode: 'confront', weight: 0.3 },
  temperate: { mode: 'cite_classic', weight: 0.2 }, gluttonous: { mode: 'second', weight: 0.2 },
  trusting: { mode: 'second', weight: 0.3 }, paranoid: { mode: 'rebut', weight: 0.4 },
  zealous: { mode: 'martyr', weight: 0.5 }, cynical: { mode: 'soften', weight: 0.2 },
  forgiving: { mode: 'soften', weight: 0.3 }, vengeful: { mode: 'confront', weight: 0.4 },
  compassionate: { mode: 'soften', weight: 0.4 }, callous: { mode: 'rebut', weight: 0.3 },
  sadistic: { mode: 'rebut', weight: 0.4 },
  stubborn: { mode: 'rebut', weight: 0.3 }, fickle: { mode: 'pivot', weight: 0.5 },
  eccentric: { mode: 'pivot', weight: 0.3 },
  // lifestyle / role 9
  scholar: { mode: 'cite_classic', weight: 0.5 }, theologian: { mode: 'cite_classic', weight: 0.4 },
  schemer: { mode: 'pivot', weight: 0.4 }, diplomat_ls: { mode: 'soften', weight: 0.3 },
  administrator_ls: { mode: 'augment', weight: 0.3 }, strategist: { mode: 'augment', weight: 0.3 },
  family_first: { mode: 'clientelism', weight: 0.4 }, gallant: { mode: 'confront', weight: 0.4 },
  august: { mode: 'lead', weight: 0.4 },
  // commander 7
  aggressive_attacker: { mode: 'confront', weight: 0.4 }, unyielding_defender: { mode: 'rebut', weight: 0.3 },
  cautious_leader: { mode: 'soften', weight: 0.3 }, reckless: { mode: 'confront', weight: 0.3 },
  flexible_leader: { mode: 'pivot', weight: 0.3 }, organizer: { mode: 'augment', weight: 0.3 },
  holy_warrior: { mode: 'martyr', weight: 0.5 },
  // 健康 / 特殊 2
  scarred: { mode: 'martyr', weight: 0.2 }, depressed: { mode: 'soften', weight: 0.2 }
};

// ─── §5.5.3·emperor 发言 mode bias (Slice 9 emperor cue +) ───
var EMPEROR_INTENT_BIAS = {
  punish:   { martyr: +0.3 },
  praise:   { second: +0.4 },
  doubt:    { soften: +0.3 },
  arbitrate:{ pivot:  +0.2 },
  dispatch: {}
};

// ─── §5.5.5·tone modulation·5 class × tone hint·prompt 段注入 (Slice 6 DoD #4) ───
function _ty3_buildToneHint(ch) {
  if (!ch) return '';
  var cls = ch.class || '';
  var hint = {
    geechen:  '庄重·官式书面·四字格 / 排比',
    kdao:     '激切·短促·感叹号多·"伏望陛下察焉"',
    wujiang:  '直白·口语化·避典故',
    xunqi:    '谨慎·回避 politically charged·"臣不敢妄议"',
    waixi:    '柔曲·避嫌·"臣外戚·所言难免有亲"'
  }[cls];
  return hint ? '\n  语气提示·' + hint : '';
}

// ─── Main·_ty3_modulateModeByPersona(ch, dims, tags, currentMode, ctx) ───
function _ty3_modulateModeByPersona(ch, dims, topicTags, currentMode, ctx) {
  ctx = ctx || {};
  var tags = topicTags || [];

  // 1·先跑 force RULES (force: true 优先·按 RULES 顺序)
  for (var i = 0; i < TINYI_MODE_RULES.length; i++) {
    var rule = TINYI_MODE_RULES[i];
    if (rule.force && rule.if(dims, tags, ch, currentMode, ctx)) return rule.then;
  }

  // 2·trait bias·按 weight 累加·选 weight max 的 mode
  var scores = {};
  scores[currentMode] = 1.0;  // base
  if (ch && Array.isArray(ch.traitIds)) {
    ch.traitIds.forEach(function(t) {
      var b = TRAIT_TO_MODE_BIAS[t]; if (!b) return;
      scores[b.mode] = (scores[b.mode] || 0) + b.weight;
    });
  }

  // 3·emperor cue bias (Slice 9·_lastEmperorIntent)
  var emperorIntent = (typeof CY !== 'undefined' && CY._ty3 && CY._ty3._lastEmperorIntent) || null;
  if (emperorIntent && EMPEROR_INTENT_BIAS[emperorIntent]) {
    Object.keys(EMPEROR_INTENT_BIAS[emperorIntent]).forEach(function(m) {
      scores[m] = (scores[m] || 0) + EMPEROR_INTENT_BIAS[emperorIntent][m];
    });
  }

  // 4·non-force RULES·hit 加 0.3 weight
  for (var j = 0; j < TINYI_MODE_RULES.length; j++) {
    var r2 = TINYI_MODE_RULES[j];
    if (!r2.force && r2.if(dims, tags, ch, currentMode, ctx)) {
      scores[r2.then] = (scores[r2.then] || 0) + 0.3;
    }
  }

  // 5·anti-塌缩 guard (§5.5.4·4 项)
  // a·同 mode ≥3 → switch
  if (ctx.sameModeCount >= 3) scores[currentMode] = 0;
  // b·confront cooldown
  if (ctx.confrontJustUsed) scores['confront'] = 0;
  // c·martyr 1 议题最多 1 次
  if (ctx.martyrUsedThisTopic) scores['martyr'] = 0;
  // d·全员同 stance ≥4 → 强 oppose 风暴·v2.6 polish·真 mode 层 push pivot/rebut 破单边
  // 若 NPC 跟主流方一致·把其 mode 推 pivot (摇摆显示独立)·避免全员同 stance 鼓掌僵局
  if (ctx.sameStanceCount >= 4 && ctx.npcInDominantCamp) {
    scores['pivot'] = (scores['pivot'] || 0) + 0.5;
    scores['rebut'] = (scores['rebut'] || 0) + 0.3;
    scores['second'] = 0;  // 不许再附议·避免雪上加霜
  }

  // 6·pick mode by max score
  var maxMode = currentMode;
  var maxScore = -1;
  Object.keys(scores).forEach(function(m) {
    if (scores[m] > maxScore) { maxScore = scores[m]; maxMode = m; }
  });
  return maxMode;
}

// expose
if (typeof window !== 'undefined') {
  window.TINYI_MODE_RULES = TINYI_MODE_RULES;
  window.TRAIT_TO_MODE_BIAS = TRAIT_TO_MODE_BIAS;
  window.EMPEROR_INTENT_BIAS = EMPEROR_INTENT_BIAS;
  window._ty3_modulateModeByPersona = _ty3_modulateModeByPersona;
  window._ty3_buildToneHint = _ty3_buildToneHint;
}

// ═══════════════════════════════════════════════════════════════════════
//  §0.97·Slice 7·confront 链 + GM._affinityMap (v2.6·NPC-NPC 对质 + 关系图)
// ═══════════════════════════════════════════════════════════════════════

// ─── §5.4 GM._affinityMap·NPC-NPC nested map·default 50 中立 ───
function _ty3_getAffinity(nameA, nameB) {
  if (typeof GM === 'undefined' || !GM._affinityMap) return 50;
  var row = GM._affinityMap[nameA];
  if (!row) return 50;
  return (row[nameB] != null) ? row[nameB] : 50;
}

function _ty3_addAffinity(nameA, nameB, delta) {
  if (typeof GM === 'undefined' || !nameA || !nameB || nameA === nameB) return;
  GM._affinityMap = GM._affinityMap || {};
  GM._affinityMap[nameA] = GM._affinityMap[nameA] || {};
  GM._affinityMap[nameB] = GM._affinityMap[nameB] || {};
  var cur1 = (GM._affinityMap[nameA][nameB] != null) ? GM._affinityMap[nameA][nameB] : 50;
  var cur2 = (GM._affinityMap[nameB][nameA] != null) ? GM._affinityMap[nameB][nameA] : 50;
  GM._affinityMap[nameA][nameB] = Math.max(0, Math.min(100, cur1 + delta));
  GM._affinityMap[nameB][nameA] = Math.max(0, Math.min(100, cur2 + delta));  // 对称·敌意相互
}

// ─── confront 链 logic·maxRound=2 backforth ───

function _ty3_startConfrontChain(A, B, opts) {
  opts = opts || {};
  if (typeof CY === 'undefined' || !CY._ty3) return;
  CY._ty3._confrontChain = {
    active: true,
    everActive: true,  // v2.6 polish·sticky flag·baselineRecord 用·非 active 仍标"本议曾触发"
    A: A, B: B,
    currentRound: 0,
    maxRound: opts.maxRound || 2,
    unresolved: false,
    allowOneMoreRound: false,
    suspendedAt: null,
    startedAt: (GM && GM.turn) || 0,
    history: []  // [{round, speaker, line, mode}, ...]
  };
  if (typeof CY._ty3 === 'object') CY._ty3.currentPhase = 'confront';  // v2.7 phase update (Slice 4.5 8 处之一)
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 ' + A + ' 与 ' + B + ' 当朝对质 〕', true);
}

function _ty3_advanceConfrontChain(speaker, otherName, line, mode) {
  var chain = CY._ty3 && CY._ty3._confrontChain;
  if (!chain || !chain.active) return null;
  chain.currentRound++;
  chain.history.push({ round: chain.currentRound, speaker: speaker, other: otherName, line: line, mode: mode });
  if (chain.currentRound >= chain.maxRound) {
    _ty3_endConfrontChain('maxRound');
    return 'ended';
  }
  return 'continue';
}

function _ty3_endConfrontChain(reason) {
  var chain = CY._ty3 && CY._ty3._confrontChain;
  if (!chain) return;
  // affinity 双向 -10
  if (chain.A && chain.B) _ty3_addAffinity(chain.A, chain.B, -10);
  chain.active = false;
  chain.endedReason = reason || 'natural';
  if (typeof addCYBubble === 'function' && reason === 'maxRound') {
    addCYBubble('内侍', '〔 二回合已尽·此辩暂止 〕', true);
  }
  if (typeof CY._ty3 === 'object') CY._ty3.currentPhase = 'debate';  // 回 debate
}

function _ty3_truncateConfrontChain() {
  var chain = CY._ty3 && CY._ty3._confrontChain;
  if (!chain) return;
  chain.unresolved = true;
  chain.active = false;
  chain.endedReason = 'truncated';
}

// ─── chain 跨阶段 3 路径 (v2.9 §5.1.7) ───
function _ty3_handleConfrontChainOnPhaseTransition(fromPhase, toPhase) {
  var chain = CY._ty3 && CY._ty3._confrontChain;
  if (!chain || !chain.active) return;
  var remaining = chain.maxRound - chain.currentRound;
  if (remaining <= 0) { _ty3_endConfrontChain('phase-transition-natural'); return; }
  if (toPhase === 'archon' || toPhase === 'draft' || toPhase === 'seal') {
    // truncate·钦定/草诏/用印 阶段强制结束
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '（陛下钦定·诸卿且止辩。）', true);
    _ty3_truncateConfrontChain();
  } else if (toPhase === 'vote') {
    // 保留 + 再 1 round (廷推时)
    chain.allowOneMoreRound = true;
    chain.suspendedAt = 'vote';
  } else {
    // 默认·phase 2 重启 1 round (回 debate 续)
    chain.currentRound = Math.max(0, chain.currentRound - 1);
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '（' + (chain.A || 'X') + ' 公 ' + (chain.B || 'Y') + ' 公复争·容再议一回合。）', true);
  }
}

// ─── 玩家 "助 A / 助 B / 敕停" footer + [/] hotkey ───
function _ty3_renderConfrontFooter() {
  var chain = CY._ty3 && CY._ty3._confrontChain;
  if (!chain || !chain.active) return '';
  return '<div class="ty3-confront-footer" style="padding:0.4rem;border-top:1px solid var(--bdr);text-align:center;">' +
    '<span style="color:#888;margin-right:0.5rem;">对质·' + (chain.A || '') + ' vs ' + (chain.B || '') + ' (R' + chain.currentRound + '/' + chain.maxRound + ')</span>' +
    '<button class="bt bsm" onclick="_ty3_assistConfront(\'A\')" style="margin:0 0.2rem;">[ 助 ' + (chain.A || 'A') + '</button>' +
    '<button class="bt bsm" onclick="_ty3_assistConfront(\'B\')" style="margin:0 0.2rem;">助 ' + (chain.B || 'B') + ' ]</button>' +
    '<button class="bt bsm" onclick="_ty3_endConfrontChain(\'imperial-arbitrate\')" style="margin-left:0.5rem;background:var(--vermillion-300);">⚡ 敕停</button>' +
    '</div>';
}

function _ty3_assistConfront(side) {
  var chain = CY._ty3 && CY._ty3._confrontChain;
  if (!chain || !chain.active) return;
  // assist·该侧 NPC mode=force-rebut·对方 mode=force-soften
  var helper = side === 'A' ? chain.A : chain.B;
  var opponent = side === 'A' ? chain.B : chain.A;
  if (typeof addCYBubble === 'function') {
    addCYBubble('皇帝', '朕助 ' + helper + '·' + opponent + ' 卿且听。', false);
  }
  // 标 force·下次 NPC 发言时·Slice 6 RULES anti-塌缩 guard 看到
  CY._ty3._confrontAssist = { helper: helper, opponent: opponent, turn: (GM && GM.turn) || 0 };
}

// hotkey·[ 助 A·] 助 B·Slice 8.5 集成
function _ty3_handleConfrontHotkey(key) {
  var chain = CY._ty3 && CY._ty3._confrontChain;
  if (!chain || !chain.active) return false;
  if (key === '[') { _ty3_assistConfront('A'); return true; }
  if (key === ']') { _ty3_assistConfront('B'); return true; }
  return false;
}

// expose
if (typeof window !== 'undefined') {
  window._ty3_getAffinity = _ty3_getAffinity;
  window._ty3_addAffinity = _ty3_addAffinity;
  window._ty3_startConfrontChain = _ty3_startConfrontChain;
  window._ty3_advanceConfrontChain = _ty3_advanceConfrontChain;
  window._ty3_endConfrontChain = _ty3_endConfrontChain;
  window._ty3_truncateConfrontChain = _ty3_truncateConfrontChain;
  window._ty3_handleConfrontChainOnPhaseTransition = _ty3_handleConfrontChainOnPhaseTransition;
  window._ty3_renderConfrontFooter = _ty3_renderConfrontFooter;
  window._ty3_assistConfront = _ty3_assistConfront;
  window._ty3_handleConfrontHotkey = _ty3_handleConfrontHotkey;
}

// ═══════════════════════════════════════════════════════════════════════
//  §0.98·Slice 7.5·6 廷议特化动作 + 5 联动 ceremony (v2.6·prison + atmosphere)
// ═══════════════════════════════════════════════════════════════════════
// 6 动作·廷杖 / 削籍 / 摘除 / 转部议 / 更议 / 革职
// 5 ceremony·廷杖 / 削籍 / 摘除 / 革职 / 更议 (转部议 跳 phase 无 ceremony)
// CSS class·.ty3-cer-flog / .strip / .dismiss / .revoke / .reopen·CSS 见 web/index.html (注·实施时按 §5.2.4 加)

function _ty3_runCeremony(cerClass, label, durationMs) {
  if (typeof document === 'undefined') return;
  var mult = (typeof P !== 'undefined' && P.conf && P.conf.tinyiCeremonyDuration) || 1.0;
  var actualMs = Math.round(durationMs * mult);
  var bg = document.createElement('div');
  bg.className = 'ty3-cer-overlay ' + cerClass;
  bg.style.cssText = 'position:fixed;inset:0;z-index:1500;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);color:#fff;font-size:2rem;letter-spacing:0.5rem;animation:ty3-cer-fade ' + (actualMs / 1000) + 's ease-in-out forwards;';
  bg.textContent = label;
  document.body.appendChild(bg);
  setTimeout(function() { if (bg.parentNode) bg.parentNode.removeChild(bg); }, actualMs);
}

// 6 action·调用方传 ch (target) + opts·后处理 (state apply + pendingEvents 入队 + ceremony)
function _ty3_actionFlogging(ch, opts) {
  if (!ch) return;
  ch.loyalty = Math.max(0, (ch.loyalty || 50) - 10);
  ch.prestige = Math.max(0, (ch.prestige || 50) - 5);
  ch.health = Math.max(0, (ch.health || 100) - 8);
  // 廷杖入诏狱可能 +20%·prison 集成 (verified runtime field _imprisoned·非 _inPrison)
  if (Math.random() < 0.20) {
    ch._imprisoned = true;
    ch._imprisonReason = (opts && opts.reason) || '廷杖下诏狱·重伤候勘';
    ch._imprisonedTurn = (GM && GM.turn) || 0;
    if (typeof addEB === 'function') addEB('廷议', '廷杖入诏狱：' + ch.name);
  }
  _ty3_runCeremony('ty3-cer-flog', '🔨 廷杖 ' + ch.name + ' 二十', 5000);
  _ty3_pendingEventPush('flogging', { target: ch.name, prestige: -5, health: -8 });
}

function _ty3_actionStrip(ch, opts) {
  if (!ch) return;
  ch.loyalty = 0;  // 革除·loyalty 归零
  ch.officialTitle = '';
  ch.title = ''; // 同步·否则廷议革除官职后 `officialTitle||title` 回退仍显示原官职
  if (Array.isArray(ch.officialTitles)) ch.officialTitles = [];   // 单一真相源:并清兼职数组·否则派生从 officialTitles 回座(革除不彻底致仍在职)
  ch.concurrentTitle = '';
  if (Array.isArray(ch.concurrentTitles)) ch.concurrentTitles = [];
  if (typeof window !== 'undefined' && window._offSyncHoldersFromChars) { try { window._offSyncHoldersFromChars(); } catch (_offSyncE) {} } // 单一真相源:免官/革职传播到官制树·从 char claims 重建 holder 清本人残留座位·否则反向派生(importSeats/tm-patches)按残留 holder 把官职还原(治「免官后官职还在」·2026-06-13)
  // 从 attendees 移除
  if (typeof CY !== 'undefined' && CY._ty3 && Array.isArray(CY._ty3.attendees)) {
    var idx = CY._ty3.attendees.indexOf(ch.name);
    if (idx >= 0) CY._ty3.attendees.splice(idx, 1);
  }
  // atmosphere 全场 cautious
  if (typeof CY !== 'undefined' && CY._ty3) CY._ty3._atmosphereOverride = 'cautious';
  _ty3_runCeremony('ty3-cer-strip', '❌ 削籍 ' + ch.name, 4000);
  _ty3_pendingEventPush('strip', { target: ch.name });
}

function _ty3_actionDismiss(ch, opts) {
  if (!ch) return;
  ch.favor = Math.max(-100, (ch.favor || 0) - 3);
  if (typeof CY !== 'undefined' && CY._ty3 && Array.isArray(CY._ty3.attendees)) {
    var idx2 = CY._ty3.attendees.indexOf(ch.name);
    if (idx2 >= 0) CY._ty3.attendees.splice(idx2, 1);
  }
  _ty3_runCeremony('ty3-cer-dismiss', '👋 ' + ch.name + ' 退殿', 2000);
  _ty3_pendingEventPush('dismiss', { target: ch.name });
}

function _ty3_actionToPart(topic, partName, opts) {
  // 议题转部·廷议结束·议题 push 到部 pending
  if (typeof GM !== 'undefined') {
    GM._pendingPartTopics = GM._pendingPartTopics || [];
    GM._pendingPartTopics.push({ topic: topic, part: partName, turn: GM.turn });
  }
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 议转 ' + partName + '·议 ' + topic + ' 〕', true);
  _ty3_pendingEventPush('toPart', { topic: topic, part: partName });
  // 无 ceremony·直接 jump phase
}

function _ty3_actionReopen(opts) {
  // 重启本议题·attendees 重发
  if (typeof CY !== 'undefined' && CY._ty3) {
    CY._ty3.reopened = (CY._ty3.reopened || 0) + 1;
  }
  _ty3_runCeremony('ty3-cer-reopen', '📜 敕令更议', 3000);
  _ty3_pendingEventPush('reopen', {});
}

function _ty3_actionRevoke(ch, opts) {
  if (!ch) return;
  // 革职·永久革除官职——非生理死亡!
  // 原 bug:此处误设 ch.alive=false(当"从与会名单移除"的偷懒手段),致被革职者在人物图志显"已殁"=无缘无故死亡。
  // 正解:清官职(同 _ty3_actionStrip 范式)+ 永不叙用标记 + 真从 attendees 数组移除·绝不动 alive。
  ch.loyalty = 0;
  ch.officialTitle = '';
  ch.title = ''; // 同步·否则 `officialTitle||title` 回退仍显原官职
  if (Array.isArray(ch.officialTitles)) ch.officialTitles = [];
  ch.concurrentTitle = '';
  if (Array.isArray(ch.concurrentTitles)) ch.concurrentTitles = [];
  if (typeof window !== 'undefined' && window._offSyncHoldersFromChars) { try { window._offSyncHoldersFromChars(); } catch (_offSyncE) {} } // 单一真相源:免官/革职传播到官制树·从 char claims 重建 holder 清本人残留座位·否则反向派生(importSeats/tm-patches)按残留 holder 把官职还原(治「免官后官职还在」·2026-06-13)
  ch._revoked = { turn: (typeof GM !== 'undefined' && GM.turn) || 0, neverReappoint: true }; // 革职·永不叙用
  if (typeof CY !== 'undefined' && CY._ty3 && Array.isArray(CY._ty3.attendees)) {
    var idx = CY._ty3.attendees.indexOf(ch.name);
    if (idx >= 0) CY._ty3.attendees.splice(idx, 1);
  }
  _ty3_runCeremony('ty3-cer-revoke', '⚰️ 革职 ' + ch.name, 6000);
  _ty3_pendingEventPush('revoke', { target: ch.name });
}

function _ty3_pendingEventPush(type, payload) {
  if (typeof GM === 'undefined') return;
  GM._pendingTinyiActions = GM._pendingTinyiActions || [];
  GM._pendingTinyiActions.push({
    type: type, payload: payload, turn: GM.turn || 0, source: 'tinyi-7.5'
  });
}

// expose
if (typeof window !== 'undefined') {
  window._ty3_runCeremony = _ty3_runCeremony;
  window._ty3_actionFlogging = _ty3_actionFlogging;
  window._ty3_actionStrip = _ty3_actionStrip;
  window._ty3_actionDismiss = _ty3_actionDismiss;
  window._ty3_actionToPart = _ty3_actionToPart;
  window._ty3_actionReopen = _ty3_actionReopen;
  window._ty3_actionRevoke = _ty3_actionRevoke;
  window._ty3_pendingEventPush = _ty3_pendingEventPush;
}

// ═══════════════════════════════════════════════════════════════════════
//  §0.99·Slice 8·裁决反弹·IIFE hook _ty3_phase6_recordSeal (v2.6·v3 三集成共存)
// ═══════════════════════════════════════════════════════════════════════
// hook target·_ty3_phase6_recordSeal (Slice 0.5 已 expose window)
// 时序·phase6 effects (cohesion/prestige/favor·ClassEngine) 已应用·phase7 (N=6 turn) 尚未触发
// 集成·NpcMemorySystem.remember + conveningPolitics tilt 二次 + dims helper + affinity 单值

(function _ty3_installV15ReboundHook() {
  if (typeof window === 'undefined') return;
  var attempts = 0;
  function tryHook() {
    if (attempts++ > 20) return;
    if (typeof window._ty3_phase6_recordSeal !== 'function') {
      setTimeout(tryHook, 200);
      return;
    }
    if (window._ty3_phase6_recordSeal._v15Hooked) return;
    var orig = window._ty3_phase6_recordSeal;
    window._ty3_phase6_recordSeal = function(status, ctx, detail) {
      var seal = orig.apply(this, arguments);  // v3 effects 先跑·全保留
      try {
        _ty3_v15_appendMinorityRebound(seal, ctx, detail);
      } catch (e) {
        try { window.TM && TM.errors && TM.errors.captureSilent(e, 'tinyi-rebound-hook'); } catch (_) {}
      }
      return seal;
    };
    window._ty3_phase6_recordSeal._v15Hooked = true;
  }
  tryHook();
})();

function _ty3_v15_findMinorityNPCs(seal) {
  // 找 minority·若 sealStatus = 'issued' (S/A/B 档)·minority = 反对方·反之 = 支持方
  if (typeof CY === 'undefined' || !CY._ty2 || !CY._ty2.stances) return [];
  var status = (seal && seal.sealStatus) || 'issued';
  var targetStance = (status === 'blocked') ? 'support' : 'oppose';  // blocked 时·支持方是 minority (失败方)
  var minority = [];
  Object.keys(CY._ty2.stances).forEach(function(name) {
    var st = CY._ty2.stances[name];
    if (!st || !st.current) return;
    var s = String(st.current);
    var isOppose = /反对|极力反对|倾向反对/.test(s);
    var isSupport = /支持|极力支持|倾向支持/.test(s);
    if (targetStance === 'oppose' && isOppose) {
      var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
      if (ch) minority.push(ch);
    } else if (targetStance === 'support' && isSupport) {
      var ch2 = (typeof findCharByName === 'function') ? findCharByName(name) : null;
      if (ch2) minority.push(ch2);
    }
  });
  return minority;
}

function _ty3_v15_calcRebound(npc, seal) {
  // base rebound·按 stance 强度 + grade
  var st = CY._ty2.stances[npc.name];
  var intensity = (st && st.confidence) ? (st.confidence / 100) : 0.5;
  var grade = (seal && seal.grade) || 'C';
  var gradeMult = { 'S': 2.0, 'A': 1.5, 'B': 1.0, 'C': 0.7, 'D': 0.3 }[grade] || 1.0;
  return Math.round(3 * intensity * gradeMult);  // 1-6
}

function _ty3_v15_alreadyAppliedToNPC(npc, seal) {
  // v2.6 polish·按 seal.grade 取 v3 phase6 实际已扣的 prestige (非硬编 1)
  // S 档·minority 全员 -prestige 4·A=3·B=2·C=1·D=0 (D 是裁决失败·v3 不扣 minority)
  var grade = (seal && seal.grade) || 'C';
  var gradeDelta = { S: 4, A: 3, B: 2, C: 1, D: 0 }[grade];
  return (gradeDelta != null) ? gradeDelta : 1;
}

function _ty3_v15_appendMinorityRebound(seal, ctx, detail) {
  // 1·minority NPC·affinity 单值 (v2.6 修)·dims helper (Slice 3)
  var minority = _ty3_v15_findMinorityNPCs(seal);
  minority.forEach(function(npc) {
    var baseRebound = _ty3_v15_calcRebound(npc, seal);
    var v3PrestigeDelta = _ty3_v15_alreadyAppliedToNPC(npc, seal);
    var finalRebound = Math.max(0, baseRebound - v3PrestigeDelta * 0.4);  // 折扣·避 2x
    npc.loyalty = Math.max(0, (npc.loyalty || 50) - finalRebound);
    npc.affinity = Math.max(0, (npc.affinity || 50) - finalRebound * 0.6);  // number 单值
    npc._reboundFrom = (npc._reboundFrom || []).concat([{ turn: (GM && GM.turn) || 0, topic: (seal && seal.topic) || '', delta: finalRebound }]);
  });

  // 2·conveningPolitics tilt 二次惩罚
  var multiplier = 1.0;
  var ctP = CY._ty3 && CY._ty3.conveningPolitics;
  if (ctP && ctP.tilt === 'oneParty')     multiplier = 1.3;
  if (ctP && ctP.tilt === 'fullOneParty') multiplier = 1.5;
  if (ctP && ctP.tilt === 'megaCeremony') multiplier = 0.8;
  if (multiplier !== 1.0) {
    minority.forEach(function(npc) { npc.loyalty = Math.max(0, (npc.loyalty || 50) * multiplier); });
  }

  // 3·民意度极低·额外 loyalty -2
  if (typeof GM !== 'undefined' && GM._convening_民意度 <= -50) {
    minority.forEach(function(npc) { npc.loyalty = Math.max(0, (npc.loyalty || 50) - 2); });
  }

  // 4·martyr 触发·dims helper (Slice 3·非裸 n.dims·v2.6 修)
  var martyrCandidates = minority.filter(function(n) {
    var d = (typeof _ty3_getDims === 'function') ? _ty3_getDims(n) : (n.aggregateDims || {});
    return (d.honor || 0) >= 0.7 && (d.boldness || 0) >= 0.7;
  });
  if (martyrCandidates.length > 0) {
    GM._pendingMartyrEvents = GM._pendingMartyrEvents || [];
    martyrCandidates.forEach(function(n) {
      GM._pendingMartyrEvents.push({ npc: n.name, turn: (GM && GM.turn) || 0, reason: 'minority-rebound', topic: (seal && seal.topic) || '' });
    });
  }

  // 5·NpcMemorySystem 集成 (§14.B·v2.1 新)
  if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
    minority.forEach(function(n) {
      var d = (typeof _ty3_getDims === 'function') ? _ty3_getDims(n) : {};
      var emoIntense = (d.honor >= 0.7) ? 8 : (d.honor >= 0.5) ? 6 : 5;
      try {
        NpcMemorySystem.remember(
          n.name,
          '议「' + ((seal && seal.topic) || '') + '」裁决·loyalty -' + Math.round(_ty3_v15_calcRebound(n, seal)),
          '恨',
          emoIntense,
          '廷议'
        );
      } catch (_memE) {}
    });
  }

  // 6·ClassEngine 不重调 (v3 phase6/7 已调过·Slice 8 DoD #8)
  // 7·decay 跨 turn 走 endturn pipeline (tinyi-decay-contract.md·非 hook 内调)
}

if (typeof window !== 'undefined') {
  window._ty3_v15_findMinorityNPCs = _ty3_v15_findMinorityNPCs;
  window._ty3_v15_calcRebound = _ty3_v15_calcRebound;
  window._ty3_v15_appendMinorityRebound = _ty3_v15_appendMinorityRebound;
}

// ═══════════════════════════════════════════════════════════════════════
//  §0.992·Slice 10b·clientelism + dims priority (v2.6·§5.4.10 v2.2 优先级)
// ═══════════════════════════════════════════════════════════════════════
// 决策路径·
// 1. dims.loyalty > 80 + 主君直接表态 → 跟主君 (绝对优先)
// 2. dims.boldness > 0.8 + dims.honor > 0.7 → 独立站位 (拒附议)
// 3. mentor 极支/极反 + NPC dims 同向 → 70% 附议 mentor (clientelism mode)
// 4. mentor 极支/极反 + dims 反向 → 沉默 (mode pivot / soften·不反转 stance)
// 5. 否则·按 dims 自己算 stance

function _ty3_clientelismCheck(ch, mentorStanceCurrent, npcOwnStance) {
  if (!ch || !mentorStanceCurrent || !npcOwnStance) return null;
  var d = (typeof _ty3_getDims === 'function') ? _ty3_getDims(ch) : (ch.aggregateDims || {});

  // 1·dims.loyalty > 80 + 主君表态 (rulerStance) → 跟主君·此处 stub·待 ruler stance 接入
  if (d.loyalty > 0.8 && typeof CY !== 'undefined' && CY._ty3 && CY._ty3._rulerStance) {
    return { mode: 'second', stance: CY._ty3._rulerStance, source: 'loyalty-to-ruler' };
  }

  // 2·dims.boldness > 0.8 + dims.honor > 0.7 → 独立·拒附议
  if (d.boldness > 0.8 && d.honor > 0.7) {
    return { mode: null, stance: npcOwnStance, source: 'independent' };  // null mode = NPC 自决
  }

  var isMentorExtreme = /极力支持|极力反对/.test(mentorStanceCurrent);
  if (!isMentorExtreme) return null;

  var mentorSupports = /支持/.test(mentorStanceCurrent);
  var npcSupports = /支持/.test(npcOwnStance);
  var sameDir = (mentorSupports === npcSupports);

  // 3·mentor 极 + dims 同向 → 70% clientelism
  if (sameDir && Math.random() < 0.7) {
    return { mode: 'clientelism', stance: npcOwnStance, source: 'mentor-same-dir' };
  }

  // 4·mentor 极 + dims 反向 → 沉默 (pivot / soften)
  if (!sameDir) {
    return { mode: Math.random() < 0.5 ? 'pivot' : 'soften', stance: 'neutral', source: 'mentor-cancel' };
  }

  return null;
}

// UI helper·召集 modal 内显 mentor 建议同召
function _ty3_renderMentorSuggestionList(attendees) {
  if (typeof GM === 'undefined' || !GM._mentorIndex) return '';
  var html = '';
  attendees.forEach(function(name) {
    var mentees = GM._mentorIndex.mentor && GM._mentorIndex.mentor[name];
    if (!Array.isArray(mentees) || mentees.length === 0) return;
    var unCalled = mentees.filter(function(m) { return !attendees.includes(m); });
    if (unCalled.length === 0) return;
    html += '<div class="ty3-mentor-row" style="padding:0.3rem 0.5rem;background:rgba(100,100,200,0.05);border-left:2px solid #aaaaff;margin:0.2rem 0;">' +
      '<span style="font-weight:600;">' + name + '</span> → 建议同召·' +
      unCalled.join(' / ') +
      '<button class="bt bsm" onclick="_ty3_addMenteesToAttendees(\'' + name + '\')" style="margin-left:0.5rem;">+ 一并召门生</button>' +
      '</div>';
  });
  return html;
}

function _ty3_addMenteesToAttendees(mentorName) {
  if (typeof GM === 'undefined' || !GM._mentorIndex) return;
  var mentees = GM._mentorIndex.mentor && GM._mentorIndex.mentor[mentorName];
  if (!Array.isArray(mentees)) return;
  if (typeof CY === 'undefined' || !CY._ty3 || !Array.isArray(CY._ty3.attendees)) return;
  mentees.forEach(function(m) {
    if (CY._ty3.attendees.indexOf(m) < 0) {
      CY._ty3.attendees.push(m);
      // 加召的 mentee·不入"漏召"统计
      var ch = (typeof findCharByName === 'function') ? findCharByName(m) : null;
      if (ch) ch._mentorAddedThisCall = true;
    }
  });
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 加召 ' + mentorName + ' 之门生 ' + mentees.length + ' 人 〕', true);
}

if (typeof window !== 'undefined') {
  window._ty3_clientelismCheck = _ty3_clientelismCheck;
  window._ty3_renderMentorSuggestionList = _ty3_renderMentorSuggestionList;
  window._ty3_addMenteesToAttendees = _ty3_addMenteesToAttendees;
}

// ═══════════════════════════════════════════════════════════════════════
//  §0.994·Slice 2.5.2·AI 召集推荐·TAG_TO_RECOMMEND + 4 步 (v2.9 §5.4.5·26 tag)
// ═══════════════════════════════════════════════════════════════════════
var TAG_TO_RECOMMEND = {
  finance:           ['户部尚书', '户部左侍郎', '兵部尚书'],
  reward:            ['吏部尚书', '户部尚书', '都察院'],
  'land-tax':        ['户部尚书', '户部各司', '布政使', '都察院'],
  currency:          ['户部尚书', '工部尚书', '通政使', '宝泉局'],
  'canal-transport': ['户部尚书', '工部尚书', '漕运总督', '巡漕御史'],
  'military-command':['兵部尚书', '兵部左侍郎', '督师', '边帅', '戎政尚书'],
  'border-affairs':  ['兵部尚书', '通政使', '边镇巡抚', '兵部右侍郎'],
  'coastal-defense': ['兵部尚书', '水师提督', '沿海巡抚', '通政使'],
  'northern-defense':['兵部尚书', '督师', '兵备道', '北直巡抚'],
  'regicide-pursuit':['都察院都御史', '刑部尚书', '大理寺卿', '锦衣卫指挥', '北镇抚司'],
  personnel:         ['吏部尚书', '吏部左侍郎', '首辅', '吏部考功郎'],
  'official-selection':['吏部尚书', '都察院', '阁臣', '吏部考功郎'],
  inspection:        ['都察院', '巡按御史', '六科给事中', '通政使'],
  execution:         ['都察院都御史', '刑部尚书', '大理寺卿'],
  'penal-harsh':     ['刑部尚书', '大理寺卿', '都察院'],
  'law-reform':      ['刑部尚书', '大理寺卿', '都察院左都御史', '刑科给事中'],
  succession:        ['首辅', '次辅', '礼部尚书', '宗人府宗令', '太常寺卿'],
  ritual:            ['礼部尚书', '太常寺卿', '钦天监'],
  'ritual-major':    ['礼部尚书', '太常寺卿', '宗人府宗令', '首辅', '翰林学士'],
  etiquette:         ['礼部尚书', '太常寺卿', '通政使'],
  'imperial-lecture':['翰林学士', '礼部尚书', '大学士', '国子监祭酒'],
  prophecy:          ['礼部尚书', '钦天监', '太医院', '翰林学士'],
  calendar:          ['礼部尚书', '钦天监', '翰林学士', '司天监'],
  'river-works':     ['工部尚书', '户部尚书', '河道总督', '都水监'],
  'foreign-policy':  ['礼部尚书', '兵部尚书', '通政使', '理藩院', '会同馆'],
  relief:            ['户部尚书', '工部尚书', '都察院', '巡抚', '布政使']
};

function _ty3_findByRole(roleName) {
  if (typeof GM === 'undefined' || !Array.isArray(GM.chars)) return [];
  return GM.chars.filter(function(c) {
    if (!c || c.alive === false) return false;
    return c.officialTitle && c.officialTitle.indexOf(roleName) >= 0;
  });
}

function _ty3_recommendAttendees(topic, tags, scenario) {
  var recommended = {};  // use as set
  // 第 1 步·必召 (阁臣 + 朝代 requiredCallList)
  var conv = (typeof _ty3_getConveningConfig === 'function') ? _ty3_getConveningConfig(scenario) : { requiredCallList: [] };
  (conv.requiredCallList || []).forEach(function(role) {
    var chs = _ty3_findByRole(role);
    if (chs[0]) recommended[chs[0].name] = true;
  });
  // 第 2 步·按 tag 推荐
  (tags || []).forEach(function(tag) {
    (TAG_TO_RECOMMEND[tag] || []).forEach(function(role) {
      _ty3_findByRole(role).forEach(function(c) { recommended[c.name] = true; });
    });
  });
  // 第 3 步·党派均衡 (各党至少 1 leader)
  if (typeof GM !== 'undefined' && Array.isArray(GM.parties)) {
    GM.parties.forEach(function(p) {
      if (!p || !p.leader) return;
      var inAny = Object.keys(recommended).some(function(n) {
        var c = (typeof findCharByName === 'function') ? findCharByName(n) : null;
        return c && c.party === p.name;
      });
      if (!inAny && p.leader) recommended[p.leader] = true;
    });
  }
  // 第 4 步·prestige 补全到 8+
  var all = (typeof GM !== 'undefined' && Array.isArray(GM.chars)) ? GM.chars.slice() : [];
  all.sort(function(a, b) { return ((b && b.prestige) || 50) - ((a && a.prestige) || 50); });
  for (var i = 0; i < all.length && Object.keys(recommended).length < 8; i++) {
    var c = all[i];
    if (c && c.alive !== false && !recommended[c.name]) recommended[c.name] = true;
  }
  return Object.keys(recommended);
}

// ═══════════════════════════════════════════════════════════════════════
//  §0.995·Slice 2.5.9·NPC 主动发议题·urgency + path push (v2.9 §5.4.12-14)
// ═══════════════════════════════════════════════════════════════════════
function _ty3_calcUrgency(proposer, type) {
  if (!proposer) return 0;
  var urgency = 5;
  var dims = (typeof _ty3_getDims === 'function') ? _ty3_getDims(proposer) : (proposer.aggregateDims || {});
  if (type === 'request_tinyi_yanguan') urgency += 2;
  if (type === 'request_tinyi_party')   urgency += 3;
  if (type === 'request_tinyi_inge')    urgency += 4;
  if ((dims.honor || 0) >= 0.7)         urgency += 1;
  if ((dims.boldness || 0) >= 0.7)      urgency += 1;
  if (proposer.prestige >= 80)          urgency += 1;
  if (proposer.resources && proposer.resources.fame >= 50) urgency += 1;  // 名望卓著者提议更受重视(设计·改革通过率↑)
  if (proposer.loyalty < 30)            urgency -= 2;
  if (typeof GM !== 'undefined' && GM._convening_言官离心 > 30) urgency += 2;
  if (typeof GM !== 'undefined' && GM._convening_民意度 < -50)  urgency += 2;
  if (typeof GM !== 'undefined' && GM._urgentBorderAffairs)     urgency += 3;
  var retry = proposer._tinyiRetry || 0;
  if (retry > 0) urgency += retry;
  return Math.max(0, Math.min(15, urgency));
}

// endturn hook·扫 NPC·按条件 push pending topic
function _ty3_npcProposeTinyiTopicsTick() {
  if (typeof GM === 'undefined' || !Array.isArray(GM.chars)) return;
  GM._pendingTinyiTopics = GM._pendingTinyiTopics || [];
  GM.chars.forEach(function(ch) {
    if (!ch || ch.alive === false || ch.isPlayer) return;
    // 触发条件·言官 / 阁臣 / 党魁·按 class / officialTitle
    var type = null;
    if (ch.class === 'kdao' && GM._convening_言官离心 > 10) type = 'request_tinyi_yanguan';
    else if (ch.officialTitle && /阁臣|大学士|首辅|次辅/.test(ch.officialTitle)) type = 'request_tinyi_inge';
    else if (ch.party && typeof GM !== 'undefined' && Array.isArray(GM.parties)) {
      var p = GM.parties.find(function(x) { return x && x.name === ch.party; });
      if (p && p.leader === ch.name) type = 'request_tinyi_party';
    }
    if (!type) return;
    var urgency = _ty3_calcUrgency(ch, type);
    if (urgency < 4) return;  // 阈值
    var existing = GM._pendingTinyiTopics.some(function(t) { return t.proposer === ch.name && (GM.turn - t.turn) < 3; });
    if (existing) return;
    // 真文本+真meta（2026-07-03·去 stub）：旧版标题是「【X 上书】关于 言路/弹劾·urgency 9」占位——
    // urgency 数字直接写进标题·且无 sourceParty/goal meta·下游的阶层/党争 prompt 注入全拿不到料。
    // 现按上书人身份取真实事由：党魁=本党当前目标·阁臣=御案时政·言官=吏治浊则纠劾/否则开言路。
    var entry = { proposer: ch.name, type: type, urgency: urgency, turn: GM.turn || 0, expiresAt: (GM.turn || 0) + 5 };
    var dedupKey = '';
    if (type === 'request_tinyi_party') {
      var pObj = GM.parties.find(function(x) { return x && x.name === ch.party; });
      var goalE = (pObj && typeof _ty3_partyGoalEntries === 'function') ? (_ty3_partyGoalEntries(pObj) || [])[0] : null;
      var gTxt = goalE ? goalE.text : ((pObj && (pObj.currentAgenda || pObj.shortGoal)) || '本党要务');
      gTxt = String(gTxt).slice(0, 30);
      entry.topic = '【' + ch.name + ' 上书】党议·' + gTxt + '·请付廷议';
      entry.sourceType = 'party_goal';
      entry.party = ch.party;
      entry.sourceParty = ch.party;
      if (goalE) { entry.goalId = goalE.id || ''; entry.goalText = goalE.text; entry.goalKind = goalE.kind; }
      if (pObj && typeof _ty3_normalizePartyNames === 'function') {
        entry.opposingParties = _ty3_normalizePartyNames([pObj.rivalParty, pObj.rival].concat(pObj.enemies || []).concat(pObj.rivals || []));
      }
      dedupKey = ch.party + '·' + gTxt;
    } else if (type === 'request_tinyi_inge') {
      var ci = GM.currentIssues;
      var firstIssue = Array.isArray(ci) ? ci[0] : (ci && typeof ci === 'object' ? ci[Object.keys(ci)[0]] : null);
      var issueTxt = firstIssue ? ((typeof _ty3_topicText === 'function') ? _ty3_topicText(firstIssue, 28) : String(firstIssue).slice(0, 28)) : '';
      entry.topic = '【' + ch.name + ' 上书】阁议·' + (issueTxt || '时政得失') + '·请付廷议';
      dedupKey = issueTxt || '时政得失';
    } else {
      var perceived = (GM.corruption && Number(GM.corruption.perceivedIndex)) || 0;
      entry.topic = '【' + ch.name + ' 上书】' + (perceived >= 50 ? '纠劾·吏治积浊·请肃纲纪' : '言路·请广开言路·纳谏修省');
      dedupKey = perceived >= 50 ? '请肃纲纪' : '广开言路';
    }
    // 主题级去重（治两套去重互不通气：同主题 scan 已出则 NPC 不再重复上书）
    if (dedupKey && typeof _ty3_alreadyHasTopic === 'function' && _ty3_alreadyHasTopic(dedupKey)) return;
    GM._pendingTinyiTopics.push(entry);
    // memorial.type 'request_tinyi'·若 GM.memorials 存
    if (Array.isArray(GM.memorials)) {
      GM.memorials.push({
        type: 'request_tinyi', from: ch.name, urgency: urgency, turn: GM.turn || 0, requestType: type
      });
    }
  });
}

function _ty3_checkExpiredTopics() {
  if (typeof GM === 'undefined' || !Array.isArray(GM._pendingTinyiTopics)) return;
  for (var i = GM._pendingTinyiTopics.length - 1; i >= 0; i--) {
    var t = GM._pendingTinyiTopics[i];
    if (!t.expiresAt || GM.turn < t.expiresAt) continue;
    var proposer = (typeof findCharByName === 'function') ? findCharByName(t.proposer) : null;
    var traits = (proposer && proposer.traitIds) || [];
    if (traits.indexOf('honest') >= 0 || traits.indexOf('just') >= 0 || traits.indexOf('zealous') >= 0) {
      // 直谏 / 秉公 / 狂热·再提
      GM._pendingTinyiTopics.push(Object.assign({}, t, {
        urgency: Math.min(15, (t.urgency || 5) + 2),
        retry: (t.retry || 0) + 1,
        expiresAt: (GM.turn || 0) + 5
      }));
    } else if (traits.indexOf('fickle') >= 0 || traits.indexOf('craven') >= 0 || traits.indexOf('deceitful') >= 0) {
      // 善变 / 怯懦·撤回
      if (proposer) proposer.loyalty = Math.max(0, (proposer.loyalty || 50) - 1);
    } else {
      // 默认·留中
      if (Array.isArray(GM.qijuHistory)) {
        if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({ turn: GM.turn || 0, content: '【NPC 议题留中】' + (t.topic || '') });
      }
    }
    GM._pendingTinyiTopics.splice(i, 1);
  }
}

if (typeof window !== 'undefined') {
  window.TAG_TO_RECOMMEND = TAG_TO_RECOMMEND;
  window._ty3_findByRole = _ty3_findByRole;
  window._ty3_recommendAttendees = _ty3_recommendAttendees;
  window._ty3_calcUrgency = _ty3_calcUrgency;
  window._ty3_npcProposeTinyiTopicsTick = _ty3_npcProposeTinyiTopicsTick;
  window._ty3_checkExpiredTopics = _ty3_checkExpiredTopics;
}

