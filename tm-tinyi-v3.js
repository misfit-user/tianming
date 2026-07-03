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
 *  Domain: 廷议 / 弹劾 (七阶段流程)
 *  Refactor notes:
 *    Phase 3·rename → tm-tinyi.js (active 唯一)
 *    Phase 5·namespace TM.Tinyi
 *  见 web/docs/architecture-map.md §1 行 2
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
  var cssHref = 'tm-tinyi-v3.css?v=20260527-ststmem-light';
  link.id = 'ty3-css';
  link.rel = 'stylesheet';
  link.href = cssHref;
  link.setAttribute('data-css-base', cssHref);
  link.setAttribute('data-css-fallback', 'https://cdn.jsdelivr.net/gh/misfit-user/tianming@main/tm-tinyi-v3.css?v=20260527-ststmem-light');
  link.onload = function() {
    if (typeof window !== 'undefined' && window.TM_CSS_LOADED) window.TM_CSS_LOADED(link);
  };
  link.onerror = function() {
    if (typeof window !== 'undefined' && window.TM_CSS_RETRY) window.TM_CSS_RETRY(link);
  };
  document.head.appendChild(link);
})();

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
        GM.qijuHistory.push({ turn: GM.turn || 0, content: '【NPC 议题留中】' + (t.topic || '') });
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

// ═══════════════════════════════════════════════════════════════════════
//  §0.996·Slice 4.5·玩家发言 paradigm·_ty3_onPlayerSpeak + 8 phase handler (v2.9 §5.1)
// ═══════════════════════════════════════════════════════════════════════
// 替换 v3 浮按钮 (SLICE_4_5_DELETE)·改底部 input + 按 currentPhase 分发到 8 handler
// + 13 keyword regex + 11 intent map + 6+4 priority 抢答 (复用常朝)

// ─── §5.1.4·13 keyword regex (常朝 5 + 廷议 8) ───
function _ty3_parseDetailKeyword(text) {
  if (!text) return null;
  var t = String(text).replace(/[。·，。，！？\s]/g, '');
  // 常朝继承 5
  if (/^准奏$|^准$|^可$|准了|可办|从之|奏可/.test(t))   return 'approve';
  if (/^驳$|^驳奏$|不准|不可|否|不行|不允/.test(t))     return 'reject';
  if (/留中|从长计议|容朕|缓议|且听/.test(t))           return 'hold';
  if (/下廷议|集议|付廷议/.test(t))                     return 'escalate';
  if (/部议|发部|交部/.test(t))                         return 'toPart';
  // 廷议特化 8
  if (/敕停|且止|休再争|止争/.test(t))                  return 'haltConfront';
  if (/钦点|朕意定/.test(t))                            return 'imperialPick';
  if (/仗下|廷杖|杖之/.test(t))                         return 'flogging';
  if (/削籍|革其官|革其籍/.test(t))                     return 'strip';
  if (/摘除|退殿|出殿/.test(t))                         return 'dismiss';
  if (/转(户|兵|礼|工|吏|刑)部/.test(t))                return 'toPartSpecific';
  if (/更议|重议|再议之/.test(t))                       return 'reopen';
  if (/革职|罢职|罢其官/.test(t))                       return 'revoke';
  return null;
}

// ─── §5.1.5·11 intent map (常朝 8 + 廷议 3) ───
function _ty3_parseDetailIntent(text) {
  if (!text) return 'neutral';
  var t = String(text).replace(/[。·，。，！？\s]/g, '');
  // 常朝 8
  if (/严办|严惩|严办|斩|诛/.test(t))                    return 'punish';
  if (/[!！]{2,}/.test(t) || /必须|即办|速行|不容/.test(t)) return 'aggressive';
  if (/民苦|忧|痛|哀|怜|惜民|百姓苦/.test(t))           return 'sympathetic';
  if (/善|嘉许|勤勉|可嘉|有功|忠勇|赏之/.test(t))       return 'praise';
  if (/恐有|未必|疑|或非|姑妄|存疑|不可不察/.test(t))   return 'doubt';
  if (/两全|折中|分发|分批|可缓|商榷|或可/.test(t))     return 'mediate';
  if (/何如|如何|可乎|几何|详言|细言|奈何/.test(t))     return 'inquire';
  if (/让.*起对|让.*党首言之|卿且退下|另有要事/.test(t)) return 'v3-legacy';
  // 廷议特化 3
  if (/朕亲断|且止|二位且止|朕意已决/.test(t))          return 'arbitrate';
  if (/退下|入殿|召|起对|休奏/.test(t))                 return 'dispatch';
  if (/鸣鞭|退朝|跪安|殿仪/.test(t))                    return 'ceremonial';
  return 'neutral';
}

// ─── §5.1.6·抢答队列·6 priority + 4 廷议加成 ───
function _ty3_pickPlayerSpeakRespondents(playerText, intent) {
  if (typeof CY === 'undefined' || !CY._ty3 || !Array.isArray(CY._ty3.attendees)) return [];
  var attendees = CY._ty3.attendees.slice();
  var picked = [];
  var seen = {};
  function add(name, priority, reason) {
    if (!name || seen[name]) return;
    seen[name] = true;
    picked.push({ name: name, priority: priority, reason: reason });
  }
  // 0·代词识别·refsLastSpeaker
  if (/你说|讲来|续言|说说|继续/.test(playerText) && CY._ty3._lastSpeaker) {
    add(CY._ty3._lastSpeaker, 0, '代词');
  }
  // 1·点名识别
  attendees.forEach(function(n) { if (playerText.indexOf(n) >= 0) add(n, 1, '点名'); });
  // 2·intent 特殊抢答
  if (intent === 'punish') {
    // 被批者·从 picked (priority 1) 已含·加言官响应
    attendees.forEach(function(n) {
      var ch = (typeof findCharByName === 'function') ? findCharByName(n) : null;
      if (ch && ch.class === 'kdao') add(n, 2, '言官·punish 响应');
    });
  }
  if (intent === 'mediate' || intent === 'doubt') {
    // 首辅出来调和
    attendees.forEach(function(n) {
      var ch = (typeof findCharByName === 'function') ? findCharByName(n) : null;
      if (ch && ch.officialTitle && /首辅/.test(ch.officialTitle)) add(n, 2, '首辅·调和');
    });
  }
  // 3·主奏者
  if (CY._ty3.proposer) add(CY._ty3.proposer, 3, '主奏者');
  // 6·confront 链中·助 X·force-rebut / force-soften
  var chain = CY._ty3._confrontChain;
  if (chain && chain.active) {
    var assist = CY._ty3._confrontAssist;
    if (assist) {
      add(assist.helper, 6, 'confront-助');
      add(assist.opponent, 6, 'confront-对');
    } else {
      add(chain.A, 6, 'confront-A');
      add(chain.B, 6, 'confront-B');
    }
  }
  // 7·arbitrate intent·confront 链立即结束·跳 phase 5
  if (intent === 'arbitrate' && chain && chain.active && typeof _ty3_endConfrontChain === 'function') {
    _ty3_endConfrontChain('imperial-arbitrate');
  }
  // 8·dispatch intent·召集 / 摘除
  if (intent === 'dispatch') {
    // pattern·"召 X 入殿" → attendees += X·"X 退下" → attendees -= X
    var summonMatch = playerText.match(/召\s*([一-龥]{2,4})\s*入殿/);
    if (summonMatch) {
      var sumName = summonMatch[1];
      if (CY._ty3.attendees.indexOf(sumName) < 0) CY._ty3.attendees.push(sumName);
      add(sumName, 8, 'dispatch-召');
    }
    var dismissMatch = playerText.match(/([一-龥]{2,4})\s*退下/);
    if (dismissMatch) {
      var dimName = dismissMatch[1];
      var idx = CY._ty3.attendees.indexOf(dimName);
      if (idx >= 0) CY._ty3.attendees.splice(idx, 1);
      // favor-3
      var ch = (typeof findCharByName === 'function') ? findCharByName(dimName) : null;
      if (ch) ch.favor = Math.max(-100, (ch.favor || 0) - 3);
    }
  }
  // 9·mentee 抢答·punish X·v2.9 §5.1.6 #9·lazy guard mentor index
  if (intent === 'punish' && typeof GM !== 'undefined' && GM._mentorIndex) {
    attendees.forEach(function(n) {
      if (playerText.indexOf(n) < 0) return;
      var mentees = GM._mentorIndex.mentor && GM._mentorIndex.mentor[n];
      if (!Array.isArray(mentees)) return;
      mentees.forEach(function(m) {
        if (!attendees.includes(m)) return;
        var mch = (typeof findCharByName === 'function') ? findCharByName(m) : null;
        if (!mch) return;
        var d = (typeof _ty3_getDims === 'function') ? _ty3_getDims(mch) : (mch.aggregateDims || {});
        // honor>=0.5 护师 (force rebut)·<0.5 背师 (force second)
        var honor = (d.honor != null) ? d.honor : 0.5;
        add(m, 9, honor >= 0.5 ? 'mentee-护师' : 'mentee-背师');
      });
    });
  }
  // 4·debate / selfReact 已有立场者
  Object.keys(CY._ty2 && CY._ty2.stances || {}).forEach(function(n) {
    var s = CY._ty2.stances[n];
    if (s && s.current && s.current !== 'neutral') add(n, 4, 'debate-立场');
  });
  // 5·闲人兜底·首辅 + 言官头领
  attendees.forEach(function(n) {
    var ch = (typeof findCharByName === 'function') ? findCharByName(n) : null;
    if (ch && ch.officialTitle && /首辅/.test(ch.officialTitle)) add(n, 5, '首辅·兜底');
    if (ch && ch.class === 'kdao') add(n, 5, '言官·兜底');
  });
  // 限 5 NPC 并发抢答 (v2.3 LLM cost cap·DoD #10)
  picked.sort(function(a, b) { return a.priority - b.priority; });
  return picked.slice(0, 5);
}

// ─── §5.1.3·_ty3_onPlayerSpeak 主入口·按 phase 分发 ───
async function _ty3_onPlayerSpeak(text) {
  if (!text || !text.trim()) return;
  var trimmed = text.trim();
  if (typeof addCYBubble === 'function') addCYBubble('皇帝', trimmed, false);

  if (CY._ty3 && CY._ty3.done) {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '（朝会已散·陛下回乾清宫。）', true);
    return;
  }

  var keyword = _ty3_parseDetailKeyword(trimmed);
  var intent = _ty3_parseDetailIntent(trimmed);

  // 按 currentPhase 分发 8 handler (v2.6 Slice 4.5)
  var phase = (CY._ty3 && CY._ty3.currentPhase) || 'debate';
  switch (phase) {
    case 'preAudit':  return _ty3_onSpeakPreAudit(trimmed, keyword, intent);
    case 'seating':   return _ty3_onSpeakSeating(trimmed, keyword, intent);
    case 'debate':    return _ty3_onSpeakDebate(trimmed, keyword, intent);
    case 'confront':  return _ty3_onSpeakConfront(trimmed, keyword, intent);
    case 'vote':      return _ty3_onSpeakVote(trimmed, keyword, intent);
    case 'archon':    return _ty3_onSpeakArchon(trimmed, keyword, intent);
    case 'draft':     return _ty3_onSpeakDraft(trimmed, keyword, intent);
    case 'seal':      return _ty3_onSpeakSeal(trimmed, keyword, intent);
    default:          return _ty3_onSpeakDebate(trimmed, keyword, intent);
  }
}

// ─── 8 phase handler ───
function _ty3_onSpeakPreAudit(text, keyword) {
  // 识别 "留中/私决/下议/明发"
  if (/留中/.test(text)) { if (typeof toast === 'function') toast('议题留中'); return; }
  if (/私决/.test(text)) { if (typeof toast === 'function') toast('私决处置'); return; }
  if (/下议|集议/.test(text)) { if (typeof toast === 'function') toast('五人闭门'); return; }
  if (/明发|廷议/.test(text)) { if (typeof toast === 'function') toast('明发廷议'); return; }
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '（请明示·留中/私决/下议/明发）', true);
}

function _ty3_onSpeakSeating(text, keyword) {
  if (/开议/.test(text) && typeof _ty3_phase1_startDebate === 'function') { _ty3_phase1_startDebate(); return; }
  if (/改班/.test(text)) { if (typeof toast === 'function') toast('三班调整'); return; }
  // 摘 X 出殿
  var mDismiss = text.match(/摘\s*([一-龥]{2,4})\s*出殿/);
  if (mDismiss) {
    var ch = (typeof findCharByName === 'function') ? findCharByName(mDismiss[1]) : null;
    if (ch && typeof _ty3_actionDismiss === 'function') _ty3_actionDismiss(ch);
    return;
  }
  // 其他·跳进辩议
  if (typeof _ty3_phase1_startDebate === 'function') _ty3_phase1_startDebate();
}

async function _ty3_onSpeakDebate(text, keyword, intent) {
  // 核心 phase·跑 keyword/intent/代词/点名/抢答
  // 若 keyword 命中 6 廷议 action·调对应 _ty3_action*
  if (keyword === 'flogging' || keyword === 'strip' || keyword === 'dismiss' || keyword === 'revoke') {
    // 找 target
    var m = text.match(/(?:仗下|廷杖|削籍|摘除|革职)\s*([一-龥]{2,4})/);
    if (m) {
      var ch = (typeof findCharByName === 'function') ? findCharByName(m[1]) : null;
      if (ch) {
        if (keyword === 'flogging' && typeof _ty3_actionFlogging === 'function') _ty3_actionFlogging(ch);
        else if (keyword === 'strip' && typeof _ty3_actionStrip === 'function') _ty3_actionStrip(ch);
        else if (keyword === 'dismiss' && typeof _ty3_actionDismiss === 'function') _ty3_actionDismiss(ch);
        else if (keyword === 'revoke' && typeof _ty3_actionRevoke === 'function') _ty3_actionRevoke(ch);
      }
    }
    return;
  }
  if (keyword === 'reopen' && typeof _ty3_actionReopen === 'function') { _ty3_actionReopen(); return; }
  // 写入 emperor cue·Slice 9 _lastEmperorIntent
  if (CY._ty3) CY._ty3._lastEmperorIntent = intent;
  // 触发抢答·5 NPC 并发·_pickPlayerSpeakRespondents
  var respondents = _ty3_pickPlayerSpeakRespondents(text, intent);
  if (typeof addCYBubble === 'function' && respondents.length > 0) {
    addCYBubble('内侍', '〔 ' + respondents.length + ' 员将抢答 〕', true);
  }
  // 真 LLM 抢答·调 _ty2_genOneSpeech 并发·留 v2 path (避免我重写流式 LLM)
  for (var i = 0; i < respondents.length; i++) {
    var r = respondents[i];
    if (typeof _ty3_safeGenSpeech === 'function') {
      try { await _ty3_safeGenSpeech(r.name, (CY._ty2 && CY._ty2.roundNum) || 1, []); } catch (_e) {}
    }
  }
}

function _ty3_onSpeakConfront(text, keyword, intent) {
  // 助 A / 助 B / 敕停
  var chain = CY._ty3 && CY._ty3._confrontChain;
  if (!chain) { _ty3_onSpeakDebate(text, keyword, intent); return; }
  if (intent === 'arbitrate' || /敕停|且止/.test(text)) {
    if (typeof _ty3_endConfrontChain === 'function') _ty3_endConfrontChain('player-arbitrate');
    return;
  }
  if (text.indexOf('助') >= 0 && text.indexOf(chain.A) >= 0 && typeof _ty3_assistConfront === 'function') {
    _ty3_assistConfront('A'); return;
  }
  if (text.indexOf('助') >= 0 && text.indexOf(chain.B) >= 0 && typeof _ty3_assistConfront === 'function') {
    _ty3_assistConfront('B'); return;
  }
  // fallback·走 debate
  return _ty3_onSpeakDebate(text, keyword, intent);
}

function _ty3_onSpeakVote(text, keyword) {
  // 钦定 X / 钦点 / 暂阙
  if (keyword === 'imperialPick') {
    var m = text.match(/(?:钦点|钦定)\s*([一-龥]{2,4})/);
    if (m && typeof _ty3_phase3_qinDing === 'function') {
      _ty3_phase3_qinDing(m[1], '钦定');
      return;
    }
  }
  if (/暂阙|空缺/.test(text) && typeof _ty3_phase3_skip === 'function') {
    _ty3_phase3_skip(); return;
  }
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '（请明示·钦点 X / 暂阙）', true);
}

function _ty3_onSpeakArchon(text, keyword) {
  // 识别 S/A/B/C/D 或自由档位
  var gradeMatch = text.match(/[SABCD]/i);
  if (gradeMatch && typeof _ty3_dgPick === 'function') {
    _ty3_dgPick(gradeMatch[0].toUpperCase()); return;
  }
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '（请明示·S / A / B / C / D 档）', true);
}

function _ty3_onSpeakDraft(text, keyword) {
  // 翰林 / 钦点 X / 自拟
  if (/翰林/.test(text) && typeof _ty3_phase5_pickFree === 'function') { _ty3_phase5_pickFree(); return; }
  var m = text.match(/(?:钦点|拟)\s*([一-龥]{2,4})/);
  if (m && typeof _ty3_phase5_pick === 'function') { _ty3_phase5_pick(m[1]); return; }
  if (/自拟|跳过/.test(text) && typeof _ty3_phase5_skip === 'function') { _ty3_phase5_skip(); return; }
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '（请明示·翰林 / 钦点 X / 自拟）', true);
}

function _ty3_onSpeakSeal(text, keyword) {
  if (/用印|准/.test(text) && typeof _ty3_phase6_doSeal === 'function') { _ty3_phase6_doSeal(false); return; }
  if (/强行/.test(text) && typeof _ty3_phase6_doSeal === 'function') { _ty3_phase6_doSeal(true); return; }
  if (/退还|留中/.test(text)) {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 诏命暂缓·议题留中 〕', true);
    return;
  }
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '（请明示·用印 / 强行 / 退还）', true);
}

// expose
if (typeof window !== 'undefined') {
  window._ty3_parseDetailKeyword = _ty3_parseDetailKeyword;
  window._ty3_parseDetailIntent = _ty3_parseDetailIntent;
  window._ty3_pickPlayerSpeakRespondents = _ty3_pickPlayerSpeakRespondents;
  window._ty3_onPlayerSpeak = _ty3_onPlayerSpeak;
  window._ty3_onSpeakPreAudit = _ty3_onSpeakPreAudit;
  window._ty3_onSpeakSeating = _ty3_onSpeakSeating;
  window._ty3_onSpeakDebate = _ty3_onSpeakDebate;
  window._ty3_onSpeakConfront = _ty3_onSpeakConfront;
  window._ty3_onSpeakVote = _ty3_onSpeakVote;
  window._ty3_onSpeakArchon = _ty3_onSpeakArchon;
  window._ty3_onSpeakDraft = _ty3_onSpeakDraft;
  window._ty3_onSpeakSeal = _ty3_onSpeakSeal;
}

// ═══════════════════════════════════════════════════════════════════════
//  §0.997·Slice 7.5/2.5.3/8.5·UI 收口·footer / modal / ceremony CSS / hotkey (v2.9 §5.2/5.4)
// ═══════════════════════════════════════════════════════════════════════

// ─── Slice 7.5·action footer 6 button (廷议 debate phase 显) ───
function _ty3_renderActionFooter() {
  if (typeof CY === 'undefined' || !CY._ty3 || CY._ty3.currentPhase !== 'debate') return '';
  return '<div class="ty3-action-footer" style="padding:0.4rem;border-top:1px dashed var(--bdr);text-align:center;font-size:0.78rem;">' +
    '<span style="color:#888;margin-right:0.5rem;">廷议特化·</span>' +
    '<button class="bt bsm" onclick="_ty3_promptAction(\'flogging\')" title="廷杖 X·loyalty -10·入诏狱可能 20%">🔨 仗下</button> ' +
    '<button class="bt bsm" onclick="_ty3_promptAction(\'strip\')" title="削籍 X·loyalty 归零">❌ 削籍</button> ' +
    '<button class="bt bsm" onclick="_ty3_promptAction(\'dismiss\')" title="摘除 X·favor -3">👋 摘除</button> ' +
    '<button class="bt bsm" onclick="_ty3_promptAction(\'toPart\')" title="转部议·廷议结束">📜 转部议</button> ' +
    '<button class="bt bsm" onclick="_ty3_promptAction(\'reopen\')" title="敕令更议·重启本议题">🔄 更议</button> ' +
    '<button class="bt bsm" onclick="_ty3_promptAction(\'revoke\')" title="革职·永久革除">⚰️ 革职</button>' +
    '</div>';
}

function _ty3_promptAction(actionType) {
  if (typeof CY === 'undefined' || !CY._ty3) return;
  // simple prompt·待 Slice 8.5 modal UI 替换
  var labels = {
    flogging: '仗下', strip: '削籍', dismiss: '摘除', toPart: '转部议', reopen: '更议', revoke: '革职'
  };
  if (actionType === 'reopen') { if (typeof _ty3_actionReopen === 'function') _ty3_actionReopen(); return; }
  if (actionType === 'toPart') {
    var partName = prompt('转哪部·(户/兵/礼/工/吏/刑)');
    if (partName && typeof _ty3_actionToPart === 'function') _ty3_actionToPart(CY._ty3.topic || '', partName + '部');
    return;
  }
  var target = prompt('目标 NPC 名·');
  if (!target) return;
  var ch = (typeof findCharByName === 'function') ? findCharByName(target) : null;
  if (!ch) { if (typeof toast === 'function') toast('未找到·' + target); return; }
  // 二次确认:仗下/削籍/革职 不可逆·防打错名误毁(可能是史实)官员·确认框显已解析到的真实姓名(与输入不符可察觉)
  var _danger = { flogging:'仗下（廷杖·或下诏狱）', strip:'削籍（夺官身·loyalty 归零）', revoke:'革职（永久革除·不复叙用）' };
  if (_danger[actionType] && typeof confirm === 'function' && !confirm('廷议处置：对【' + (ch.name || target) + '】行「' + _danger[actionType] + '」？\n此举不可撤销。')) return;
  if (actionType === 'flogging' && typeof _ty3_actionFlogging === 'function') _ty3_actionFlogging(ch);
  else if (actionType === 'strip' && typeof _ty3_actionStrip === 'function') _ty3_actionStrip(ch);
  else if (actionType === 'dismiss' && typeof _ty3_actionDismiss === 'function') _ty3_actionDismiss(ch);
  else if (actionType === 'revoke' && typeof _ty3_actionRevoke === 'function') _ty3_actionRevoke(ch);
}

// ─── Slice 2.5.3·召集 modal·简化版 (3 视图·standard / by-tag / custom) ───
function _ty3_openConveningModal(topic, tags, scenario, callback) {
  if (typeof document === 'undefined') return;
  var recommended = (typeof _ty3_recommendAttendees === 'function')
    ? _ty3_recommendAttendees(topic, tags, scenario) : [];
  var bg = document.createElement('div');
  bg.id = 'ty3-convening-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1310;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="max-width:680px;background:var(--color-surface);border:1px solid var(--gold);border-radius:6px;padding:1.2rem;">';
  html += '<div style="font-size:1.1rem;color:var(--gold);margin-bottom:0.6rem;font-weight:600;">⚖ 召集廷议·议题·' + (topic || '').slice(0, 40) + '</div>';
  // 3 视图 tab
  html += '<div style="border-bottom:1px solid var(--bdr);margin-bottom:0.6rem;">' +
    '<button class="bt bsm" id="ty3-cv-tab-std" onclick="_ty3_cvSwitchView(\'standard\')" style="border-bottom:2px solid var(--gold);">⚖️ 标准九卿</button> ' +
    '<button class="bt bsm" id="ty3-cv-tab-tag" onclick="_ty3_cvSwitchView(\'tag\')">📊 按 tag 推荐</button> ' +
    '<button class="bt bsm" id="ty3-cv-tab-cus" onclick="_ty3_cvSwitchView(\'custom\')">✏️ 自由组合</button>' +
    '</div>';
  // attendees 显示
  html += '<div id="ty3-cv-list" style="max-height:280px;overflow-y:auto;padding:0.4rem;background:rgba(0,0,0,0.2);border-radius:4px;">';
  recommended.forEach(function(n) {
    var ch = (typeof findCharByName === 'function') ? findCharByName(n) : null;
    var elig = (typeof _ty3_calcEligibility === 'function') ? _ty3_calcEligibility(ch, topic, scenario) : { category: '可召' };
    var color = { '必召':'var(--gold)', '可召':'#ddd', '罕召':'#888', '不召':'#666' }[elig.category] || '#ddd';
    html += '<div style="padding:0.2rem 0.4rem;color:' + color + ';">' +
      '<span style="display:inline-block;width:80px;">' + escHtml(n) + '</span>' +
      '<span style="color:#888;font-size:0.75rem;">' + (ch && ch.officialTitle || '') + '·' + elig.category + '</span>' +
      '</div>';
  });
  html += '</div>';
  // mentor 联动 suggestion (v2.6 Slice 10b)
  if (typeof _ty3_renderMentorSuggestionList === 'function') {
    var sug = _ty3_renderMentorSuggestionList(recommended);
    if (sug) html += '<div style="margin-top:0.6rem;">' + sug + '</div>';
  }
  // 民意度 / 言官离心 显示
  if (typeof GM !== 'undefined') {
    var pop = GM._convening_民意度 != null ? Math.round(GM._convening_民意度) : 0;
    var yan = GM._convening_言官离心 != null ? Math.round(GM._convening_言官离心) : 0;
    var tier = (typeof _ty3_getPopulationConfidenceTier === 'function') ? _ty3_getPopulationConfidenceTier() : '兼听';
    html += '<div style="margin-top:0.6rem;font-size:0.78rem;color:#aaa;">民意度·' + pop + ' (' + tier + ')·言官离心·' + yan + '</div>';
  }
  // footer
  html += '<div style="margin-top:1rem;text-align:right;">';
  html += '<button class="bt bp" onclick="_ty3_cvConfirm()">📜 召集 → 明发</button> ';
  html += '<button class="bt bsm" onclick="_ty3_cvCancel()">取消</button>';
  html += '</div>';
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
  CY._ty3._conveningModal = { topic: topic, tags: tags, scenario: scenario, recommended: recommended, callback: callback };
}

function _ty3_cvSwitchView(view) {
  // simple·切 tab 高亮·真实视图切换 stub (留 user UX feedback)
  ['std', 'tag', 'cus'].forEach(function(v) {
    var b = document.getElementById('ty3-cv-tab-' + v);
    if (b) b.style.borderBottom = (v === view.slice(0, 3)) ? '2px solid var(--gold)' : 'none';
  });
}

function _ty3_cvConfirm() {
  var modal = CY._ty3 && CY._ty3._conveningModal;
  if (!modal) return;
  var attendees = modal.recommended;
  // calc 5 后果·conveningPolitics
  if (typeof _ty3_calcConveningPolitics === 'function') {
    CY._ty3.conveningPolitics = _ty3_calcConveningPolitics(attendees, '', modal.topic, modal.scenario);
  }
  CY._ty3.attendees = attendees;
  if (modal.callback) modal.callback(attendees);
  _ty3_cvCancel();  // close modal
}

function _ty3_cvCancel() {
  var bg = document.getElementById('ty3-convening-bg');
  if (bg && bg.parentNode) bg.parentNode.removeChild(bg);
  if (CY && CY._ty3) CY._ty3._conveningModal = null;
}

// ─── Slice 8.5·三班双轨 view (V hotkey 切 stance / class) ───
function _ty3_toggleBenchView() {
  if (typeof CY === 'undefined' || !CY._ty3) return;
  CY._ty3._benchView = (CY._ty3._benchView === 'class') ? 'stance' : 'class';
  if (typeof addCYBubble === 'function') {
    addCYBubble('内侍', '〔 三班视图切·' + (CY._ty3._benchView === 'class' ? '按 class' : '按 stance') + ' 〕', true);
  }
  // v2.6 polish·Round 4·真应 data-view·CSS 选 `.ty3-st-bench[data-view]`·非 toast-only
  try {
    var nodes = document.querySelectorAll('.ty3-st-bench');
    for (var i = 0; i < nodes.length; i++) nodes[i].setAttribute('data-view', CY._ty3._benchView);
  } catch (_dvE) {}
  if (typeof _ty2_render === 'function') _ty2_render();
}

// ─── 9+1 hotkey listener (V/T/[/] / Esc / Ctrl+Enter / H / M / 1-9) ───
function _ty3_installHotkeyListener() {
  if (typeof document === 'undefined') return;
  if (document._ty3HotkeyInstalled) return;
  document.addEventListener('keydown', function(e) {
    if (typeof CY === 'undefined' || !CY._ty3 || !CY.open) return;
    // 跳过 input / textarea focus
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'V' || e.key === 'v') { _ty3_toggleBenchView(); e.preventDefault(); return; }
    if (e.key === 'T' || e.key === 't') { _ty3_openStanceMatrix(); e.preventDefault(); return; }
    if (e.key === '[' || e.key === ']') {
      if (typeof _ty3_handleConfrontHotkey === 'function') {
        if (_ty3_handleConfrontHotkey(e.key)) e.preventDefault();
      }
      return;
    }
    if (e.key === 'H' || e.key === 'h') { _ty3_openStanceHistory(); e.preventDefault(); return; }
    if (e.key === 'M' || e.key === 'm') { _ty3_openConveningQuick(); e.preventDefault(); return; }
    if (e.ctrlKey && e.key === 'Enter') { _ty3_forceDecide(); e.preventDefault(); return; }
    if (e.key >= '1' && e.key <= '9' && CY._ty3.currentPhase === 'vote') {
      // 廷推时·选第 N 候选
      var idx = parseInt(e.key, 10) - 1;
      if (typeof _ty3_phase3VoteIndex === 'function') _ty3_phase3VoteIndex(idx);
    }
  });
  document._ty3HotkeyInstalled = true;
}

// v2.6 Slice 8.5 polish·4 modal 真实 UI (T/H/M/Ctrl+Enter hotkey 落地)·非 toast stub
// 关法·内 ✕ 按钮 / Esc / click backdrop (非 inner) 关
function _ty3_closeQuickModal(id) {
  var bg = document.getElementById(id);
  if (bg && bg.parentNode) bg.parentNode.removeChild(bg);
}

// 全局 quick modal Esc + backdrop click 监听·一次装·关任何 ty3-quick-* modal
function _ty3_installQuickModalCloseListeners() {
  if (typeof document === 'undefined' || document._ty3QuickClosersInstalled) return;
  document._ty3QuickClosersInstalled = true;
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
      ['ty3-quick-matrix-bg','ty3-quick-history-bg','ty3-quick-force-bg'].forEach(_ty3_closeQuickModal);
    }
  });
  document.addEventListener('click', function(e) {
    var t = e.target;
    if (!t || !t.id) return;
    if (t.id === 'ty3-quick-matrix-bg' || t.id === 'ty3-quick-history-bg' || t.id === 'ty3-quick-force-bg') {
      _ty3_closeQuickModal(t.id);
    }
  });
}

function _ty3_openStanceMatrix() {
  if (typeof document === 'undefined' || typeof CY === 'undefined' || !CY._ty3) return;
  _ty3_closeQuickModal('ty3-quick-matrix-bg');
  var attendees = (CY._ty3.attendees || []).slice();
  if (!attendees.length) { if (typeof toast === 'function') toast('暂无与议者·无可看立场'); return; }
  var stances = (CY._ty2 && CY._ty2.stances) || {};
  var esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s||'');};
  var dimsLabel = { honor:'义', compassion:'仁', boldness:'勇', rationality:'智', greed:'欲', cunning:'谲', loyalty:'忠', confucianism:'儒' };
  var dimKeys = ['honor','compassion','boldness','rationality','greed','cunning','loyalty','confucianism'];
  var stanceCh = { support:'支', oppose:'反', neutral:'中', '极力支持':'极支', '极力反对':'极反', '倾向支持':'倾支', '倾向反对':'倾反', '中立':'中' };
  function dimColor(v) {
    if (v == null) return '#444';
    if (v >= 0.7) return 'var(--vermillion-400,#c33)';
    if (v >= 0.55) return 'var(--gold-600,#b80)';
    if (v >= 0.45) return '#888';
    if (v >= 0.3) return 'var(--indigo-400,#88c)';
    return 'var(--celadon-400,#6c9)';
  }
  var bg = document.createElement('div');
  bg.id = 'ty3-quick-matrix-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1320;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="max-width:920px;max-height:82vh;overflow-y:auto;background:var(--color-surface);border:1px solid var(--gold);border-radius:6px;padding:1.2rem;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem;">';
  html += '<span style="font-size:1.05rem;color:var(--gold);font-weight:600;">▦ 立场矩阵·' + attendees.length + ' 员 × 8 dims + initial/current</span>';
  html += '<button class="bt bsm" onclick="_ty3_closeQuickModal(\'ty3-quick-matrix-bg\')">✕</button>';
  html += '</div>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:0.78rem;">';
  html += '<thead><tr style="border-bottom:1px solid var(--bdr);color:#aaa;"><th style="text-align:left;padding:0.25rem;">人物</th>';
  dimKeys.forEach(function(k){ html += '<th style="padding:0.25rem;width:36px;">' + dimsLabel[k] + '</th>'; });
  html += '<th style="padding:0.25rem;">initial</th><th style="padding:0.25rem;">current</th><th style="padding:0.25rem;">mode</th></tr></thead><tbody>';
  attendees.forEach(function(name) {
    var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
    var d = (typeof _ty3_getDims === 'function') ? _ty3_getDims(ch) : {};
    var st = stances[name] || {};
    var ini = stanceCh[st.initial] || (st.initial || '?');
    var cur = stanceCh[st.current] || (st.current || '?');
    var changed = (st.initial && st.current && st.initial !== st.current);
    html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">';
    html += '<td style="padding:0.25rem;color:#ddd;">' + esc(name) + '<span style="color:#666;font-size:0.7rem;"> ' + (ch && ch.class || '') + '</span></td>';
    dimKeys.forEach(function(k){
      var v = d[k];
      var vTxt = (v != null) ? Math.round(v * 100) : '–';
      html += '<td style="padding:0.25rem;text-align:center;color:' + dimColor(v) + ';">' + vTxt + '</td>';
    });
    html += '<td style="padding:0.25rem;text-align:center;color:#888;">' + esc(ini) + '</td>';
    html += '<td style="padding:0.25rem;text-align:center;color:' + (changed ? 'var(--gold)' : '#aaa') + ';font-weight:' + (changed ? '600' : '400') + ';">' + esc(cur) + (changed ? ' *' : '') + '</td>';
    html += '<td style="padding:0.25rem;text-align:center;color:#aaa;font-size:0.72rem;">' + esc((st.source || '').replace('dims-initial','锚').replace('llm-adjusted','调')) + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  html += '<div style="margin-top:0.6rem;font-size:0.72rem;color:#888;">数值 0-100·红 ≥70·金 55-70·灰 45-55·蓝 30-45·青 <30·"*" 表 current 跟 initial 不同</div>';
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _ty3_openStanceHistory() {
  if (typeof document === 'undefined' || typeof CY === 'undefined' || !CY._ty3) return;
  _ty3_closeQuickModal('ty3-quick-history-bg');
  var attendees = (CY._ty3.attendees || []).slice();
  if (!attendees.length) { if (typeof toast === 'function') toast('暂无与议者·无历史可看'); return; }
  var stances = (CY._ty2 && CY._ty2.stances) || {};
  var esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s||'');};
  var stanceCh = { support:'支', oppose:'反', neutral:'中', '极力支持':'极支', '极力反对':'极反', '倾向支持':'倾支', '倾向反对':'倾反', '中立':'中' };
  var stanceColor = { support:'var(--celadon-400,#6c9)', oppose:'var(--vermillion-400,#c33)', neutral:'#888' };
  function chipColor(s) {
    if (!s) return '#666';
    if (/支持/.test(s)) return stanceColor.support;
    if (/反对/.test(s)) return stanceColor.oppose;
    return stanceColor.neutral;
  }
  var bg = document.createElement('div');
  bg.id = 'ty3-quick-history-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1320;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="max-width:760px;max-height:82vh;overflow-y:auto;background:var(--color-surface);border:1px solid var(--gold);border-radius:6px;padding:1.2rem;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem;">';
  html += '<span style="font-size:1.05rem;color:var(--gold);font-weight:600;">⌛ 立场历史档案·' + attendees.length + ' 员</span>';
  html += '<button class="bt bsm" onclick="_ty3_closeQuickModal(\'ty3-quick-history-bg\')">✕</button>';
  html += '</div>';
  var emptyCount = 0;
  attendees.forEach(function(name) {
    var st = stances[name] || {};
    var hist = Array.isArray(st.history) ? st.history : [];
    if (!hist.length) { emptyCount++; return; }
    html += '<div style="padding:0.4rem 0.5rem;margin:0.3rem 0;background:rgba(0,0,0,0.18);border-left:3px solid ' + chipColor(st.current) + ';border-radius:3px;">';
    html += '<div style="font-weight:600;color:#ddd;">' + esc(name);
    html += '<span style="color:#888;font-size:0.72rem;font-weight:400;"> initial·' + esc(stanceCh[st.initial] || st.initial || '?') + '</span>';
    html += '<span style="float:right;color:' + chipColor(st.current) + ';font-size:0.78rem;">current·' + esc(stanceCh[st.current] || st.current || '?') + '</span>';
    html += '</div>';
    html += '<div style="margin-top:0.3rem;display:flex;flex-wrap:wrap;gap:0.3rem;">';
    hist.forEach(function(h, i) {
      var col = chipColor(h.stance);
      html += '<span title="' + esc(h.reason || '') + '" style="padding:0.15rem 0.5rem;background:' + col + ';color:#fff;border-radius:10px;font-size:0.7rem;">R' + (h.round || (i+1)) + '·' + esc(stanceCh[h.stance] || h.stance || '?') + '</span>';
    });
    html += '</div>';
    if (st.source) html += '<div style="margin-top:0.2rem;font-size:0.7rem;color:#888;">source·' + esc(st.source) + '</div>';
    html += '</div>';
  });
  if (emptyCount === attendees.length) {
    html += '<div style="padding:0.6rem;color:#888;text-align:center;">尚无 round 发言·history 空</div>';
  } else if (emptyCount > 0) {
    html += '<div style="margin-top:0.4rem;font-size:0.72rem;color:#666;">· 另 ' + emptyCount + ' 员尚未发言·history 空 ·</div>';
  }
  html += '</div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _ty3_openConveningQuick() {
  if (typeof CY === 'undefined' || !CY._ty3) return;
  if (typeof _ty3_openConveningModal !== 'function') { if (typeof toast === 'function') toast('召集 modal 未加载'); return; }
  var topic = CY._ty3.topic || (CY._ty2 && CY._ty2.topic) || '';
  if (!topic) { if (typeof toast === 'function') toast('暂无议题·无可召集'); return; }
  var scn = (typeof getScenarioOrLegacy === 'function') ? getScenarioOrLegacy() : null;
  var tags = (typeof _ty3_inferTopicTags === 'function')
    ? _ty3_inferTopicTags((CY._ty3.meta && CY._ty3.meta.topicType) || (CY._ty2 && CY._ty2.topicType), topic) : [];
  _ty3_openConveningModal(topic, tags, scn, function(attendees) {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 召集快捷·' + (attendees || []).length + ' 员 〕', true);
    if (typeof _ty2_render === 'function') _ty2_render();
  });
}

function _ty3_forceDecide() {
  if (typeof CY === 'undefined' || !CY._ty3) return;
  if (typeof document === 'undefined') return;
  _ty3_closeQuickModal('ty3-quick-force-bg');
  var phase = CY._ty3.currentPhase || 'unknown';
  var esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s||'');};
  // phase 已到 archon/draft/seal·toast 提示不可重复·debate/confront/seating/preAudit·跳到 archon settle
  if (phase === 'archon' || phase === 'draft' || phase === 'seal') {
    if (typeof toast === 'function') toast('当前已 ' + phase + ' 阶段·无可再跳');
    return;
  }
  var bg = document.createElement('div');
  bg.id = 'ty3-quick-force-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1320;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';
  var html = '<div style="max-width:480px;background:var(--color-surface);border:1px solid var(--vermillion-400,#c33);border-radius:6px;padding:1.2rem;">';
  html += '<div style="font-size:1.05rem;color:var(--vermillion-400,#c33);margin-bottom:0.6rem;font-weight:600;">⚡ 强制裁决·跳剩余阶段</div>';
  html += '<div style="color:#ccc;font-size:0.82rem;margin-bottom:0.6rem;">当前阶段·' + esc(phase) + '<br>选裁决·按选项跳到 archon (钦定档位) + 后续 draft/seal·</div>';
  html += '<div style="display:flex;flex-direction:column;gap:0.3rem;">';
  html += '<button class="bt bp" onclick="_ty3_forceDecideApply(\'approve\')" style="text-align:left;">✓ 准奏·按多数派裁决</button>';
  html += '<button class="bt bsm" onclick="_ty3_forceDecideApply(\'reject\')" style="text-align:left;">✗ 驳奏·按少数 / 反对派裁决</button>';
  html += '<button class="bt bsm" onclick="_ty3_forceDecideApply(\'hold\')" style="text-align:left;">⌛ 留中·议而不决·档位降一级</button>';
  html += '</div>';
  html += '<div style="margin-top:0.8rem;text-align:right;">';
  html += '<button class="bt bsm" onclick="_ty3_closeQuickModal(\'ty3-quick-force-bg\')">取消</button>';
  html += '</div></div>';
  bg.innerHTML = html;
  document.body.appendChild(bg);
}

function _ty3_forceDecideApply(decision) {
  _ty3_closeQuickModal('ty3-quick-force-bg');
  if (typeof CY === 'undefined' || !CY._ty3) return;
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 ⚡ 强制裁决·' + decision + '·跳剩余阶段 〕', true);
  // 通用·调 _ty3_settleArchonGrade·decision 传 'approve'/'reject'/'hold'
  if (typeof _ty3_settleArchonGrade === 'function') {
    try { _ty3_settleArchonGrade(decision, { forced: true, fromHotkey: true }); }
    catch (e) { try { window.TM && TM.errors && TM.errors.captureSilent(e, 'tinyi-force-decide'); } catch(_) {} }
  }
}

// v2.6 polish·hotkey 1-9 真分发到候选名·非 toast stub
function _ty3_phase3VoteIndex(idx) {
  if (typeof CY === 'undefined' || !CY._ty3) return;
  var list = CY._ty3._phase3Candidates;
  if (!Array.isArray(list) || idx >= list.length || idx < 0) {
    if (typeof toast === 'function') toast('候选 #' + (idx+1) + ' 不存在 (共 ' + (list ? list.length : 0) + ' 人)');
    return;
  }
  var c = list[idx];
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 钦点 #' + (idx+1) + '·' + c.name + ' 〕', true);
  if (typeof _ty3_phase3_qinDing === 'function') _ty3_phase3_qinDing(c.name, c.party);
}

// v2.6 Slice 0·baseline 自动 record helper·user game UI 跑后 console 调·snapshot to JSON
function _ty3_baselineRecord(caseId) {
  if (typeof CY === 'undefined' || !CY._ty3 || !CY._ty2) {
    console.warn('[baseline] CY._ty3 / CY._ty2 not ready·廷议未开');
    return null;
  }
  var stances = CY._ty2.stances || {};
  var modeDist = {};
  var stanceDist = { 极支: 0, 支: 0, 中: 0, 反: 0, 极反: 0 };
  var extreme = 0, total = 0;
  var allSpeeches = (CY._ty2 && CY._ty2._allSpeeches) || [];
  allSpeeches.forEach(function(sp) {
    if (sp.mode) modeDist[sp.mode] = (modeDist[sp.mode] || 0) + 1;
  });
  Object.keys(stances).forEach(function(n) {
    var st = stances[n];
    if (!st || !st.current) return;
    total++;
    var s = String(st.current);
    if (/极力支持/.test(s)) { stanceDist['极支']++; extreme++; }
    else if (/极力反对/.test(s)) { stanceDist['极反']++; extreme++; }
    else if (/支持/.test(s)) stanceDist['支']++;
    else if (/反对/.test(s)) stanceDist['反']++;
    else stanceDist['中']++;
  });
  var snapshot = {
    caseId: caseId || ('case-' + Date.now()),
    topic: CY._ty3.topic || '',
    topicType: (CY._ty3.meta && CY._ty3.meta.topicType) || '',
    promptTokens: null,  // user 从 LLM call inspector 估
    modeDistribution: modeDist,
    stanceDistribution: stanceDist,
    extremeRatio: total > 0 ? Math.round(extreme / total * 100) / 100 : 0,
    confrontTriggered: !!(CY._ty3._confrontChain && CY._ty3._confrontChain.everActive),
    clientelismTriggered: Object.keys(modeDist).indexOf('clientelism') >= 0 ? (modeDist['clientelism'] || 0) : 0,
    martyrUsed: modeDist['martyr'] || 0,
    v3PostProcess: !!(typeof GM !== 'undefined' && GM._chronicleTracks && GM._chronicleTracks.length > 0)
  };
  console.log('[baseline] case ' + snapshot.caseId + '·snapshot ready·拷贝到 _baseline-tinyi-before-prompts.json actual 字段·');
  console.log(JSON.stringify(snapshot, null, 2));
  return snapshot;
}

// v2.6 polish·dump 全 localStorage baseline·一键拷给 user
function _ty3_baselineDumpAll() {
  if (typeof localStorage === 'undefined') {
    console.warn('[baseline] localStorage 不可用');
    return [];
  }
  var arr = [];
  try { arr = JSON.parse(localStorage.getItem('ty3_baselines') || '[]'); } catch (e) {}
  console.log('[baseline] 共 ' + arr.length + ' 条 auto-collected snapshot·拷下方 JSON 到 _baseline-tinyi-before-prompts.json _autoSnapshots 段');
  console.log(JSON.stringify(arr, null, 2));
  return arr;
}

function _ty3_baselineClearAll() {
  if (typeof localStorage !== 'undefined') { try { localStorage.removeItem('ty3_baselines'); } catch (_) {} }
  console.log('[baseline] localStorage cleared');
}

// ─── Slice 8.5·5 ceremony CSS·写入 document.head ───
function _ty3_installCeremonyCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ty3-ceremony-style')) return;
  var st = document.createElement('style');
  st.id = 'ty3-ceremony-style';
  st.textContent = [
    '@keyframes ty3-cer-fade { 0% { opacity: 0; } 10% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }',
    '.ty3-cer-overlay { animation: ty3-cer-fade 1s ease-in-out forwards; }',
    '.ty3-cer-openrtn { background: rgba(80,30,30,0.85)!important; color: gold!important; }',  // 鸣鞭三响·暗红
    '.ty3-cer-archon { background: linear-gradient(180deg,#5a4a2a,#3a2a1a)!important; color: gold!important; }',  // 钦定 gold-screen
    '.ty3-cer-draft { background: rgba(20,20,40,0.85)!important; color: #ddc!important; }',
    '.ty3-cer-seal { background: rgba(140,20,30,0.88)!important; color: #fff!important; }',  // 朱砂
    '.ty3-cer-pursue { background: rgba(60,40,30,0.85)!important; color: #fdd!important; }',
    '.ty3-cer-flog { background: rgba(160,20,20,0.9)!important; color: #fff!important; animation: ty3-cer-fade 0.3s steps(3,end) 5 !important; }',  // 锤击 + 红 flash
    '.ty3-cer-strip { background: rgba(0,0,0,0.95)!important; color: gold!important; font-size: 3rem!important; }',  // 黑屏 + 大字
    '.ty3-cer-dismiss { background: rgba(60,60,60,0.75)!important; color: #ccc!important; }',
    '.ty3-cer-revoke { background: rgba(0,0,0,0.95)!important; color: var(--vermillion-blood,#c33)!important; font-size: 3rem!important; }',
    '.ty3-cer-reopen { background: rgba(40,60,80,0.85)!important; color: gold!important; }',
    // v2.6 Slice 8.5·用印 2 sub-flow modal polish (v3 已有 modal·此处加 CSS)
    '@keyframes ty3-seal-stamp { 0% { transform: scale(2) rotate(-15deg); opacity: 0; } 50% { transform: scale(1.2) rotate(0); opacity: 0.95; } 100% { transform: scale(1) rotate(0); opacity: 1; } }',
    '.ty3-seal-modal-container { animation: ty3-cer-fade 0.3s ease-out forwards; }',
    '.ty3-seal-stamp { animation: ty3-seal-stamp 1.2s ease-out forwards; display:inline-block; font-size: 4rem; color: #c33; text-shadow: 0 0 8px rgba(200,50,30,0.6); }',
    '.ty3-seal-blocked { color: #a52; text-shadow: 0 0 4px rgba(140,40,20,0.5); }',
    '.ty3-seal-forced { color: #e44; text-shadow: 0 0 12px rgba(255,80,60,0.7); animation: ty3-seal-stamp 1.0s ease-out forwards, ty3-seal-shake 0.15s steps(2,end) 4 1.5s; }',
    '@keyframes ty3-seal-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }',
    // 立场板放大版 N×9 矩阵 (T hotkey 触发·留 user UX 完整·此 CSS 占位)
    '.ty3-stance-matrix { display:grid; grid-template-columns: repeat(9, 1fr); gap: 0.3rem; padding: 1rem; max-height: 70vh; overflow-y: auto; background: var(--color-surface); border: 1px solid var(--gold); border-radius: 6px; }',
    '.ty3-stance-matrix-cell { padding: 0.4rem; text-align: center; font-size: 0.78rem; border-radius: 3px; }',
    // 三班双轨 view·V hotkey 切·CSS 弱化
    // v2.6 polish·Round 4·选 `.ty3-st-bench` 真 DOM class (非 `.ty3-bench`)·_toggleBenchView 调 setAttribute
    '.ty3-st-bench[data-view="class"] .ty3-bench-stance-color { display: none; }',
    '.ty3-st-bench[data-view="stance"] .ty3-bench-class-tag { opacity: 0.5; }',
    // confront 红虚线·Slice 7/8.5 联动
    '.ty3-confront-line { border: 2px dashed var(--vermillion-400, #c33); margin: 0.5rem 0; padding: 0.3rem; border-radius: 4px; background: rgba(200,50,50,0.05); }',
    // 10 mode 视觉一眼区分·气泡左侧 icon
    '.cy-bubble[data-mode="lead"]::before { content: "▶ "; color: #888; }',
    '.cy-bubble[data-mode="second"]::before { content: "⊕ "; color: var(--celadon-400, #6c9); }',
    '.cy-bubble[data-mode="rebut"]::before { content: "← "; color: var(--vermillion-400, #c44); }',
    '.cy-bubble[data-mode="soften"]::before { content: "～ "; color: gold; }',
    '.cy-bubble[data-mode="pivot"]::before { content: "⇌ "; color: var(--indigo-400, #88c); }',
    '.cy-bubble[data-mode="augment"]::before { content: "➕ "; color: var(--celadon-300, #ae8); }',
    '.cy-bubble[data-mode="confront"]::before { content: "❗ "; color: var(--vermillion-600, #a22); }',
    '.cy-bubble[data-mode="cite_classic"]::before { content: "📜 "; color: var(--gold-600, #b80); }',
    '.cy-bubble[data-mode="clientelism"]::before { content: "🎓 "; color: var(--indigo-600, #66a); }',
    '.cy-bubble[data-mode="martyr"]::before { content: "❗ "; color: #d22; }',
    '.cy-bubble[data-mode="martyr"] { border: 2px solid var(--vermillion-700, #911) !important; font-size: 1.05rem !important; }'
  ].join('\n');
  document.head.appendChild(st);
}

// 自动 install·hotkey + ceremony CSS + quick modal Esc/backdrop closer
if (typeof document !== 'undefined') {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(function() { _ty3_installHotkeyListener(); _ty3_installCeremonyCss(); _ty3_installQuickModalCloseListeners(); }, 200);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() { _ty3_installHotkeyListener(); _ty3_installCeremonyCss(); _ty3_installQuickModalCloseListeners(); }, 200);
    });
  }
}

// expose
if (typeof window !== 'undefined') {
  window._ty3_renderActionFooter = _ty3_renderActionFooter;
  window._ty3_promptAction = _ty3_promptAction;
  window._ty3_openConveningModal = _ty3_openConveningModal;
  window._ty3_cvSwitchView = _ty3_cvSwitchView;
  window._ty3_cvConfirm = _ty3_cvConfirm;
  window._ty3_cvCancel = _ty3_cvCancel;
  window._ty3_toggleBenchView = _ty3_toggleBenchView;
  window._ty3_installHotkeyListener = _ty3_installHotkeyListener;
  window._ty3_installCeremonyCss = _ty3_installCeremonyCss;
  // v2.6 Slice 8.5 polish·4 modal 真 UI + baseline helper
  window._ty3_openStanceMatrix = _ty3_openStanceMatrix;
  window._ty3_openStanceHistory = _ty3_openStanceHistory;
  window._ty3_openConveningQuick = _ty3_openConveningQuick;
  window._ty3_forceDecide = _ty3_forceDecide;
  window._ty3_forceDecideApply = _ty3_forceDecideApply;
  window._ty3_closeQuickModal = _ty3_closeQuickModal;
  window._ty3_baselineRecord = _ty3_baselineRecord;
  window._ty3_installQuickModalCloseListeners = _ty3_installQuickModalCloseListeners;
  window._ty3_baselineDumpAll = _ty3_baselineDumpAll;
  window._ty3_baselineClearAll = _ty3_baselineClearAll;
}

// ═══════════════════════════════════════════════════════════════════════
//  §1·党派访问层
// ═══════════════════════════════════════════════════════════════════════
// 设计原则：
//   - GM.parties[] 已在 tm-patches.js L1435 初始化(从 P.parties 按 sid 过滤)
//   - 推演阶段 tm-endturn-ai-infer.js 已支持 party_splinter / party_disband
//   - v3 不另设动态层·直接读 GM.parties·写也写到 GM.parties
//   - 运行时党派增删改全经此处·便于 §6 用印阻挠 / §7 追责 hook

function _ty3_getParties() {
  if (typeof GM !== 'undefined' && GM && Array.isArray(GM.parties)) return GM.parties;
  if (typeof GM !== 'undefined' && GM && GM.scriptData && Array.isArray(GM.scriptData.parties)) return GM.scriptData.parties;
  if (typeof P !== 'undefined' && P && Array.isArray(P.parties)) return P.parties;
  if (typeof scriptData !== 'undefined' && scriptData && Array.isArray(scriptData.parties)) return scriptData.parties;
  if (typeof GM !== 'undefined' && GM && GM.partyState && typeof GM.partyState === 'object') {
    return Object.keys(GM.partyState).map(function(name) {
      var row = GM.partyState[name];
      if (row && typeof row === 'object') {
        if (!row.name) row.name = name;
        return row;
      }
      return { name: name };
    });
  }
  return [];
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

// 清誉账（reputationBalance）：此前全项目只初始化为 0 无任何写者·却一直被喂进 prompt/UI 当「清名/恶名」。
// 写者=廷议政策胜负/弹劾定罪；消费=弹劾判级(清流难扳)+公推票权；每回合 _updatePartyState 侧向 0 缓归。
function _ty3_bumpPartyReputation(ps, delta) {
  if (!ps || typeof ps !== 'object') return;
  var d = Math.max(-4, Math.min(4, Number(delta) || 0));
  if (!d) return;
  var cur = Number(ps.reputationBalance) || 0;
  ps.reputationBalance = Math.max(-60, Math.min(60, Math.round((cur + d) * 100) / 100));
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
    _ty3_bumpPartyReputation(source, (sourceWin - sourceLose) * 0.8);
    _ty3_syncPartyStateMirror(sourceParty);
  }
  if (blockerParty) opposers = _ty3_normalizePartyNames([blockerParty].concat(opposers));
  opposers.forEach(function(pn) {
    if (!pn || pn === sourceParty) return;
    var ps = _ty3_getPartyStateWritable(pn);
    if (!ps) return;
    ps.recentPolicyWin = Math.round((ps.recentPolicyWin + oppWin) * 100) / 100;
    ps.recentPolicyLose = Math.round((ps.recentPolicyLose + oppLose) * 100) / 100;
    _ty3_bumpPartyReputation(ps, (oppWin - oppLose) * 0.8);
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

function _ty3_impeachmentVerdictGrade(charges, partyMetrics, inquiryBody, accusedCh) {
  var score = inquiryBody && inquiryBody.weight ? inquiryBody.weight : 0;
  (charges || []).forEach(function(ch) { score += Math.max(1, parseInt(ch.severity, 10) || 1); });
  if (partyMetrics) {
    if (typeof partyMetrics.influence === 'number') score += Math.max(0, Math.round((partyMetrics.influence - 40) / 20));
    if (typeof partyMetrics.cohesion === 'number') score += Math.max(0, Math.round((60 - partyMetrics.cohesion) / 10));
  }
  // 名望防弹劾(设计-角色经济·资源三)：高名望者清誉难扳·名声已坏则更易定罪·fame≠prestige
  var _fameIm = (accusedCh && accusedCh.resources && typeof accusedCh.resources.fame === 'number') ? accusedCh.resources.fame : 0;
  if (_fameIm) score -= Math.round(_fameIm / 25);   // fame +100→-4 难成案 · -100→+4 易成案
  // 党清誉防弹劾：清流之党难扳·恶名之党易罪（reputationBalance∈[-60,60] → ∓2.4 分）
  var _repIm = (partyMetrics && partyMetrics.state && typeof partyMetrics.state.reputationBalance === 'number') ? partyMetrics.state.reputationBalance : 0;
  if (_repIm) score -= Math.round(_repIm / 25);
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
  var verdictGrade = _ty3_impeachmentVerdictGrade(charges, partyMetrics, inquiryBody, accusedCh);
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
  // G3·BB2·文官弹劾武进士 → record for 兵谏 counter
  // 自然 trigger·accused 是 武进士 (_origin=='wuju') 且 accuser 非 武进士·counter +1
  if (accusedCh._origin === 'wuju' && (!accuserCh || accuserCh._origin !== 'wuju')) {
    if (typeof window !== 'undefined' && typeof window._kjG3RecordWenguanImpeachment === 'function') {
      try { window._kjG3RecordWenguanImpeachment(); } catch(_) {}
    }
  }
  var meta = topicMeta && typeof topicMeta === 'object' ? topicMeta : _ty3_buildImpeachmentTopicMeta(accuserName, accuserCh, accusedCh, topicMeta);
  var accuserTitle = (accuserCh && (accuserCh.officialTitle || accuserCh.title)) || 'censorate';
  var accuserNameText = accuserCh ? accuserCh.name : (accuserName || 'unknown');
  var charges = Array.isArray(meta.charges) ? meta.charges.slice() : [];
  var inquiryBody = meta.inquiryBody || _ty3_pickInquiryBody(meta.dynasty || 'default', accusedCh);
  var verdictGrade = meta.verdictGrade || _ty3_impeachmentVerdictGrade(charges, _ty3_partyMetrics(accusedCh.party || ''), inquiryBody, accusedCh);
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
  var goals = _ty3_partyGoalEntries(p);
  for (var g = 0; g < goals.length; g++) {
    if (_ty3_textIncludesGoal(t, goals[g].text)) return 'support';
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


// ═══════════════════════════════════════════════════════════════════════
//  §3·阶段 0·议前预审(留中 / 私决 / 下议 / 明发)
// ═══════════════════════════════════════════════════════════════════════
// 接 GM._pendingTinyiTopics·让玩家选择四种处置方式·避免直接进廷议无回旋

function _ty3_open(seedTopic) {
  // Entry point: show controls, then open pre-audit. (v2.6 Slice 4.5·删浮按钮·改 _cyShowInputRow 永显底部 input)
  if (typeof _cyShowInputRow === 'function') _cyShowInputRow(true);
  // v2.6 polish·Round 3·剧本切后 GM.chars 已变·mentor index 必须刷·避 stale 数据 (e.g. 切到绍宋仍读天启 mentor)
  try {
    if (typeof GM !== 'undefined' && Array.isArray(GM.chars)) {
      var sig = GM.chars.length + ':' + (GM.chars[0] && GM.chars[0].name || '');
      if (GM._mentorIndexSig !== sig && typeof _ty3_rebuildMentorIndexFromGM === 'function') {
        _ty3_rebuildMentorIndexFromGM();
        GM._mentorIndexSig = sig;
      }
    }
  } catch (_mE) {}
  // v2.6 polish·Round 3·convening 民意度 / 言官离心 init·此前 fn 存在但无人调·全 dynamics silently dead
  try {
    if (typeof _ty3_initConveningCounters === 'function') {
      var _scn = (typeof getScenarioOrLegacy === 'function') ? getScenarioOrLegacy() : (typeof GM !== 'undefined' && GM.scenario);
      _ty3_initConveningCounters(_scn);
    }
  } catch (_cE) {}
  _ty3_openPreAudit(seedTopic);
}

function _ty3_openPreAudit(seedTopic) {
  // v2.6 Slice 4.5 currentPhase update·六轮 audit hard #1
  if (typeof CY !== 'undefined' && CY._ty3) CY._ty3.currentPhase = 'preAudit';
  var bg = document.createElement('div');
  bg.id = 'ty3-preaudit-bg';
  bg.style.cssText = 'position:fixed;inset:0;z-index:1300;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;';

  var pending = (GM._pendingTinyiTopics || []).slice();
  var topicSeed = seedTopic || (pending.length > 0 ? pending[0] : null);
  var topicText = '';
  var topicMeta = null;
  if (topicSeed) {
    topicText = _ty3_topicDisplayText(topicSeed);
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
      var t = _ty3_topicDisplayText(p, 50);
      var prop = (typeof p === 'object' && p.proposer) ? ' · 主奏 ' + p.proposer : '';
      html += '<option value="' + i + '">' + escHtml(t + prop) + '</option>';
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
    + '<div class="ty3-pa-opt-cost">完整七阶段</div>'
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

  // Topic handling note. (v2.6 polish·真声明 inp·非 bare 引用·避 ReferenceError)
  var inp = document.getElementById('ty3-pa-topic');
  if (inp) inp.oninput = _ty3_schedulePaUpdateForecast;

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
  var t = _ty3_topicDisplayText(item);
  var inp = document.getElementById('ty3-pa-topic');
  if (inp) inp.value = t;
  CY._ty3_paMeta = (typeof item === 'object') ? item : null;
  _ty3_paUpdateForecast();
  _ty3_paUpdateProposer(CY._ty3_paMeta);
}

var _ty3PaForecastTimer = 0;
function _ty3_schedulePaUpdateForecast(delay) {
  if (_ty3PaForecastTimer) clearTimeout(_ty3PaForecastTimer);
  _ty3PaForecastTimer = setTimeout(function() {
    _ty3PaForecastTimer = 0;
    _ty3_paUpdateForecast();
  }, delay == null ? 140 : delay);
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
  if (typeof item === 'string') return _ty3_localizeCourtTopicText(item);
  if (typeof item.topic === 'string') return _ty3_topicDisplayText(item);
  if (item.topic && typeof item.topic === 'object') return _ty3_topicDisplayText(item.topic);
  return _ty3_localizeCourtTopicText(item.title || '');
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
  _ty3_adjustHuangquan(-1, '\u8bae\u524d\u7559\u4e2d\u524a\u5f31\u7687\u6743', 'tinyi-held-item');
  // Proposer prestige penalty when metadata is present.
  if (meta && meta.proposer) {
    var ch = (typeof findCharByName === 'function') ? findCharByName(meta.proposer) : null;
    if (ch) ch.prestige = Math.max(0, (ch.prestige||50) - 2);
  }
  if (typeof toast === 'function') toast(topic.slice(0,16) + ' 留中');
  if (typeof addEB === 'function') addEB('议前', '留中·' + topic);
  // v2.6 Slice 4.5·删浮按钮·_cyShowInputRow 由 closeChaoyi 处理
  if (typeof closeChaoyi === 'function') closeChaoyi();
}

function _ty3_paDoPrivate(topic, meta) {
  // 私决：转御前·携带议题
  if (typeof addEB === 'function') addEB('议前', '私决御前·' + topic);
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
  if (typeof addEB === 'function') addEB('议前', '小议·' + topic);
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
  if (typeof addEB === 'function') addEB('议前', '公议·' + topic);
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
  // v2.6 Slice 4.5·删浮按钮·_cyShowInputRow 由 closeChaoyi 处理
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

function _ty3_adjustHuangquan(delta, reason, source) {
  if (typeof AuthorityEngines !== 'undefined' && AuthorityEngines.adjustHuangquan) {
    return AuthorityEngines.adjustHuangquan(source || 'tinyi-v3', delta, reason || '\u5ef7\u8bae\u7275\u52a8\u7687\u6743');
  }
  if (GM.huangquan && typeof GM.huangquan.index === 'number') {
    GM.huangquan.index = Math.max(0, Math.min(100, GM.huangquan.index + delta));
    return { ok: true };
  }
  if (GM.vars && GM.vars['\u7687\u6743'] && typeof GM.vars['\u7687\u6743'].value === 'number') {
    GM.vars['\u7687\u6743'].value = Math.max(0, Math.min(100, GM.vars['\u7687\u6743'].value + delta));
    return { ok: true };
  }
  return { ok: false };
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
    _ty3_adjustHuangquan(-8, '\u786c\u63a8\u8bcf\u4ee4\u6298\u635f\u7687\u6743', 'tinyi-force-choice');
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
  // v2.6 Slice 4.5 currentPhase update
  if (typeof CY !== 'undefined' && CY._ty3) CY._ty3.currentPhase = 'archon';
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
          // 与众议方向同步：按加权票（人头为体·党势为衡）·无权重字段回退人头
          var _wS = (typeof counts.supportW === 'number') ? counts.supportW : counts.support;
          var _wO = (typeof counts.opposeW === 'number') ? counts.opposeW : counts.oppose;
          var wasApproved = false;
          if (mode === 'majority') wasApproved = _wS >= _wO;
          else if (mode === 'override') wasApproved = _wS < _wO;
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
        // v2.6 Slice 0·v3 gate flag·默认 v3 ON (useTinyiV3 != false)·user 主动设 false 才 fallback v2
        var v3On = !(window.P && window.P.conf && window.P.conf.useTinyiV3 === false);
        if (v3On) {
          if (typeof CY !== 'undefined') CY.mode = mode;
          _ty3_open();
          return;
        }
        // fallback·走 v2 (orig)·v2 path 已加 ChronicleTracker + ClassEngine + partyStrife 集成 (Slice 0.0b)
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
  // v2.6 Slice 4.5·5 浮按钮 expose 已删·改 _ty3_onPlayerSpeak 主分发
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
  // v2.6 Slice 4.5 currentPhase update
  if (typeof CY !== 'undefined' && CY._ty3) CY._ty3.currentPhase = 'seating';
  var proposerName = (meta && meta.proposer) || '';
  var proposerCh = proposerName ? (typeof findCharByName === 'function' ? findCharByName(proposerName) : null) : null;
  var proposerParty = proposerCh && proposerCh.party ? proposerCh.party : '';

  function _ty3_isEligibleOfficial(c) {
    if (!c || c.alive === false || c.isPlayer) return false;
    if (c._imprisoned || c._exiled || c._retired || c._fled || c._mourning || c._captured) return false;
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
  // v2.6 Slice 4.5·删浮按钮·_cyShowInputRow 由 closeChaoyi 处理
  if (typeof closeChaoyi === 'function') closeChaoyi();
}

function _ty3_phase1_startDebate() {
  var bg = document.getElementById('ty3-seating-bg');
  if (bg) bg.remove();
  if (!CY._ty3) return;
  var publicMeta = _ty3_clone(CY._ty3.meta || {});
  publicMeta.proposer = publicMeta.proposer || CY._ty3.proposer || '';
  publicMeta.proposerParty = publicMeta.proposerParty || CY._ty3.proposerParty || '';
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
    _publicMeta: publicMeta,
    _economyReform: publicMeta._economyReform,
    _reformType: publicMeta.reformType,
    _reformId: publicMeta.reformId
  };
  // v2.6 polish·init stance·**必含 source: 'init'** + history·防 Slice 3 hybrid 锁 silently 失效 (源 undefined 时 source === 'dims-initial' 假)
  CY._ty3.attendees.forEach(function(n) { CY._ty2.stances[n] = { current: 'neutral', initial: 'neutral', locked: false, confidence: 0, source: 'init', history: [] }; });
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
  // v2.6 Slice 4.5 currentPhase update
  CY._ty3.currentPhase = 'debate';
  var body = (typeof _$ === 'function') ? _$('cy-body') : document.getElementById('cy-body');
  if (body) body.innerHTML = '';
  var topicEl = (typeof _$ === 'function') ? _$('cy-topic') : document.getElementById('cy-topic');
  if (topicEl) { topicEl.style.display = 'block'; topicEl.innerHTML = '🏛 廷议·' + escHtml(CY._ty3.topic); }

  if (typeof addCYBubble === 'function') {
    addCYBubble('内侍', '〔 三班已立·同 ' + CY._ty3.bench.left.length + '·中 ' + CY._ty3.bench.center.length + '·反 ' + CY._ty3.bench.right.length + ' 〕', true);
    addCYBubble('皇帝', '议：' + CY._ty3.topic, false);
  }

  CY._abortChaoyi = false;
  CY._pendingPlayerLine = null;
  CY._ty3_pendingSummon = null;
  if (typeof _cyShowInputRow === 'function') _cyShowInputRow(true);
  if (typeof _ty2_render === 'function') _ty2_render();

  // v2.6 Slice 3·hybrid stance·Round 1 前算所有 attendees initial stance (dims 锚定·不可变)
  try {
    if (typeof _ty3_initialStanceFromDims === 'function' && CY._ty3.attendees && CY._ty2.stances) {
      var tags = (typeof _ty3_inferTopicTags === 'function')
        ? _ty3_inferTopicTags((CY._ty3.meta && CY._ty3.meta.topicType) || (CY._ty2 && CY._ty2.topicType), CY._ty3.topic)
        : [];
      var _initMeta = (CY._ty3 && CY._ty3.meta) || ((typeof _ty3_currentTinyiMeta === 'function') ? _ty3_currentTinyiMeta() : null);
      CY._ty3.attendees.forEach(function(name) {
        var ch = (typeof findCharByName === 'function') ? findCharByName(name) : null;
        if (!ch) return;
        var st = CY._ty2.stances[name] || (CY._ty2.stances[name] = {});
        var init = _ty3_initialStanceFromDims(ch, CY._ty3.topic, tags);
        // 党争先验（2026-07-03）：本党所倡倾支持·敌党所倡倾反对——除非性格死硬(≥0.9)顶牛
        var bias = (typeof _ty3_partyStanceBias === 'function') ? _ty3_partyStanceBias(ch, _initMeta) : null;
        if (bias && !(init.intensity >= 0.9 && init.stance !== 'neutral' && init.stance !== bias.stance)) {
          st.initial = bias.stance;
          st.current = st.current || bias.stance;
          st.confidence = (st.confidence != null) ? st.confidence : Math.round(bias.intensity * 100);
          st.source = 'party-initial';
        } else {
          st.initial = init.stance;      // 锁·不可变
          st.current = st.current || init.stance;
          st.confidence = (st.confidence != null) ? st.confidence : Math.round(init.intensity * 100);
          st.source = 'dims-initial';
        }
        st.history = st.history || [];
      });
    }
  } catch (_initStE) {
    try { window.TM && TM.errors && TM.errors.captureSilent(_initStE, 'tinyi-initial-stance'); } catch (_) {}
  }

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
      var _stE = CY._ty2.stances[name];
      // v2.6 Slice 3·hybrid·initial 锁 (dims-initial 时不 overwrite)·current 可变
      _stE.current = r.stance;
      if (r.confidence != null) _stE.confidence = r.confidence;
      _stE.history = _stE.history || [];
      _stE.history.push({ round: roundNum, stance: r.stance, reason: r.reason || '', t: Date.now() });
      if (_stE.source === 'dims-initial' && r.stance !== _stE.initial) {
        _stE.source = 'llm-adjusted';
      }
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
  // v2.6 Slice 4.5·改调 _ty3_onPlayerSpeak·按 currentPhase 8 handler 分发
  if (typeof _ty3_onPlayerSpeak === 'function') {
    try { await _ty3_onPlayerSpeak(line); } catch (_e) {
      try { window.TM && TM.errors && TM.errors.captureSilent(_e, 'tinyi-onPlayerSpeak'); } catch (_) {}
    }
  } else if (typeof _ty2_playerTriggeredResponse === 'function') {
    try { await _ty2_playerTriggeredResponse(line); } catch (_) {}
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

async function _ty3_phase2_finalize(prevSpeeches) {
  var _wasAborted = !!CY._abortChaoyi;
  CY._abortChaoyi = false;
  // 立场迁移判定接入活路径（2026-07-03）：v2 的被说服判定(含党争格局/性格顽固趋附·LLM 判谁被说动)
  // 此前只挂在 v2 startDebate——v3 活路径立场全靠发言者自报·无人被人说服。轮末补判·判毕再收束。
  if (!_wasAborted && prevSpeeches && prevSpeeches.length >= 2 && typeof _ty2_judgeStanceShifts === 'function') {
    try { await _ty2_judgeStanceShifts(prevSpeeches); } catch (_jsE) {
      try { window.TM && TM.errors && TM.errors.captureSilent(_jsE, 'ty3-stance-shift'); } catch (_) {}
    }
  }
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
  // v2.6 Slice 4.5 currentPhase update
  if (typeof CY !== 'undefined' && CY._ty3) CY._ty3.currentPhase = 'draft';
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
  // v2.6 Slice 4.5 currentPhase update
  if (typeof CY !== 'undefined' && CY._ty3) CY._ty3.currentPhase = 'vote';
  var byParty = _ty3_phase3_buildCandidates(targetOffice, meta);
  var entries = Object.entries(byParty);
  // v2.6 polish·flatten 候选·让 hotkey 1-9 真能按序拾取 (_ty3_phase3VoteIndex)
  if (typeof CY !== 'undefined' && CY._ty3) {
    var flat = [];
    entries.forEach(function(pair) {
      var pName = pair[0];
      (pair[1].candidates || []).forEach(function(c) { flat.push({ name: c.name, party: pName }); });
    });
    CY._ty3._phase3Candidates = flat;
  }
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
  _ty3_adjustHuangquan(hqDelta, contested ? '\u94a6\u70b9\u4eba\u9009\u906d\u5f3a\u515a\u63a3\u8098' : '\u94a6\u70b9\u4eba\u9009\u7275\u52a8\u5ef7\u8bae', 'tinyi-qinding');
  if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, 3, '\u94A6\u70B9\u4EBA\u9009', { source:'tinyi-v3-qinding' });
  else ch.loyalty = Math.min(100, ((typeof ch.loyalty === 'number' && isFinite(ch.loyalty)) ? ch.loyalty : 50) + 3);
  ch.favor = Math.min(100, (ch.favor || 0) + 5);
  ch.prestige = Math.min(100, (ch.prestige || 50) + 2);
  if (contested) {
    var bp = _ty3_getPartyObj(biggestParty);
    if (bp) bp.cohesion = Math.max(0, (parseInt(bp.cohesion, 10) || 50) - 3);
  }
  if (typeof addCYBubble === 'function') addCYBubble('皇帝', '钦点 ' + name + (contested ? '·' + biggestParty + ' 凝聚 -3' : ''), false);
  if (typeof addEB === 'function') addEB('廷推', '任命·' + name + ((CY._ty2 && CY._ty2.topic) ? '·' + CY._ty2.topic : ''));
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
      // 公推票权 = 党势 + 候选名望 + 党清誉（清流之党所荐更易见用）
      var _pvRep = (GM.partyState && GM.partyState[info.party.name] && typeof GM.partyState[info.party.name].reputationBalance === 'number') ? GM.partyState[info.party.name].reputationBalance : 0;
      var weight = Math.max(5, (info.party.influence || 50) + (c.prestige || 50) * 0.5 + _pvRep * 0.5);
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
    if (typeof adjustCharacterLoyalty === 'function') adjustCharacterLoyalty(ch, 5, '\u5EAD\u63A8\u6240\u5B9A', { source:'tinyi-v3-public-vote' });
    else ch.loyalty = Math.min(100, ((typeof ch.loyalty === 'number' && isFinite(ch.loyalty)) ? ch.loyalty : 50) + 5);
    ch.prestige = Math.min(100, (ch.prestige || 50) + 1);
  }
  if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 廷推所定：' + winner.name + ' 〕', true);
  if (typeof addEB === 'function') addEB('荐贤', '廷推所定：' + winner.name + ((CY._ty2 && CY._ty2.topic) ? '·' + CY._ty2.topic : ''));
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
    decisionMode: entry.decisionMode || '',
    sourceType: entry.sourceType || '',
    sourceClass: entry.sourceClass || entry.className || '',
    className: entry.className || entry.sourceClass || '',
    demandText: entry.demandText || '',
    relationEvidence: Array.isArray(entry.relationEvidence) ? entry.relationEvidence.map(_ty3_clone) : []
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

function _ty3_recordSocialPoliticalSignal(seal, meta, ctx) {
  try {
    if (typeof TM === 'undefined' || !TM.SocialPoliticalSignals || typeof TM.SocialPoliticalSignals.record !== 'function') return null;
    if (typeof GM === 'undefined' || !GM || !seal) return null;
    var parties = [];
    function addParty(name, role) {
      name = String(name || '').trim();
      if (!name) return;
      if (parties.some(function(x) { return x.name === name; })) return;
      parties.push({
        name: name,
        reason: role + ' in court outcome ' + (seal.sealStatus || seal.status || '')
      });
    }
    addParty(seal.sourceParty, 'source party');
    (Array.isArray(seal.opposingParties) ? seal.opposingParties : []).forEach(function(name) { addParty(name, 'opposing party'); });
    addParty(seal.blockerParty, 'blocking party');
    var classes = [];
    var className = seal.sourceClass || seal.className || (meta && (meta.sourceClass || meta.className)) || '';
    if (className) {
      classes.push({
        name: className,
        reason: seal.demandText || 'court issue outcome'
      });
    }
    var recordedSignal = TM.SocialPoliticalSignals.record(GM, {
      sourceSystem: 'court',
      kind: 'tinyi-stage6-' + (seal.sealStatus || seal.status || 'outcome'),
      tags: ['court', 'tinyi', 'party', 'class', seal.sealStatus || seal.status || ''],
      intensity: seal.sealStatus === 'blocked' ? 0.75 : 0.62,
      confidence: 0.9,
      linkedIssue: seal.chaoyiTrackId || seal.topic || '',
      reason: '廷议结果：' + (seal.topic || '') + ' / ' + (seal.sealStatus || seal.status || ''),
      affectedClasses: classes,
      affectedParties: parties,
      evidence: [
        'tinyi-stage6-social-signal',
        seal.grade || '',
        (ctx && ctx.decision && ctx.decision.mode) || '',
        seal.demandText || ''
      ]
    });
    try {
      if (TM.MinxinPressureActions && typeof TM.MinxinPressureActions.recordPlayerResponse === 'function') {
        TM.MinxinPressureActions.recordPlayerResponse(GM, {
          channel: 'tinyi',
          decision: seal.sealStatus || seal.status || '',
          linkedIssue: (meta && (meta.linkedIssue || meta.sourceId || meta.id)) || seal.linkedIssue || seal.chaoyiTrackId || '',
          actor: seal.sourceParty || '',
          topic: seal.topic || '',
          text: [seal.topic, seal.demandText, seal.body, seal.grade].filter(Boolean).join(' ')
        }, {
          turn: GM.turn || 0,
          source: 'tinyi-stage6-minxin-pressure-response'
        });
      }
    } catch (_mpaE) {
      try { window.TM && TM.errors && TM.errors.captureSilent(_mpaE, 'tinyi-stage6-minxin-pressure-response'); } catch (_) {}
    }
    return recordedSignal;
  } catch (_spsE) {
    try { window.TM && TM.errors && TM.errors.captureSilent(_spsE, 'tinyi-stage6-social-signal'); } catch (_) {}
    return null;
  }
}

function _ty3_recordCourtOutcomeRecord(seal, meta, ctx) {
  try {
    if (typeof GM === 'undefined' || !GM || !seal) return null;
    if (!Array.isArray(GM._courtRecords)) GM._courtRecords = [];
    var item = {
      id: seal.id || ('court_' + Date.now() + '_' + Math.floor(Math.random() * 100000)),
      turn: GM.turn || 0,
      source: 'tinyi-stage6',
      topic: seal.topic || '',
      status: seal.sealStatus || seal.status || '',
      sealStatus: seal.sealStatus || seal.status || '',
      grade: seal.grade || '',
      sourceParty: seal.sourceParty || (meta && (meta.sourceParty || meta.party)) || '',
      party: seal.sourceParty || (meta && (meta.sourceParty || meta.party)) || '',
      opposingParties: Array.isArray(seal.opposingParties) ? seal.opposingParties.slice() : [],
      blockerParty: seal.blockerParty || '',
      sourceClass: seal.sourceClass || seal.className || (meta && (meta.sourceClass || meta.className)) || '',
      className: seal.className || seal.sourceClass || (meta && (meta.className || meta.sourceClass)) || '',
      demandText: seal.demandText || (meta && meta.demandText) || '',
      sourceType: seal.sourceType || (meta && meta.sourceType) || '',
      issueId: seal.chaoyiTrackId || (meta && (meta.issueId || meta.id)) || '',
      chaoyiTrackId: seal.chaoyiTrackId || '',
      decisionMode: (ctx && ctx.decision && ctx.decision.mode) || ctx && ctx.decisionMode || '',
      at: Date.now()
    };
    GM._courtRecords.push(item);
    if (GM._courtRecords.length > 80) GM._courtRecords = GM._courtRecords.slice(-80);
    return item;
  } catch (_recordCourtE) {
    try { window.TM && TM.errors && TM.errors.captureSilent(_recordCourtE, 'tinyi-stage6-court-record'); } catch (_) {}
    return null;
  }
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
    chaoyiTrackId: chaoyiTrackId,
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
    if (!sourceParty && meta.party) {
      sourceParty = meta.party;
      seal.sourceParty = sourceParty;
    }
    seal.sourceType = meta.sourceType || meta.from || '';
    seal.sourceClass = meta.sourceClass || meta.className || '';
    seal.className = meta.className || seal.sourceClass || '';
    seal.demandText = meta.demandText || '';
    seal.origin = meta.origin ? _ty3_clone(meta.origin) : null;
    seal.relationEvidence = Array.isArray(meta.relationEvidence) ? meta.relationEvidence.map(_ty3_clone) : [];
    meta.sealStatus = status;
    meta.sealedEdict = seal;
  }
  if (Array.isArray(GM.recentChaoyi) && GM.recentChaoyi[0]) {
    GM.recentChaoyi[0].sealStatus = status;
    GM.recentChaoyi[0].sealedEdict = seal.body;
  }
  var goalOutcome = _ty3_recordPartyGoalOutcome(meta, status, ctx, seal);
  if (goalOutcome) seal.goalOutcome = goalOutcome;
  _ty3_recordSocialPoliticalSignal(seal, meta, ctx);
  _ty3_recordCourtOutcomeRecord(seal, meta, ctx);
  try {
    if (typeof window !== 'undefined' && window.AuthorityComplete && typeof window.AuthorityComplete.handleCrisisSurfaceResponse === 'function') {
      window.AuthorityComplete.handleCrisisSurfaceResponse({
        channel: 'tinyi',
        text: [topic, status, body, seal.demandText, meta && meta.demandText, ctx.decision && (ctx.decision.text || ctx.decision.reason || ctx.decision.mode)].filter(Boolean).join(' '),
        decision: status,
        topic: topic,
        target: sourceParty,
        targetName: sourceParty,
        crisisAction: seal.crisisAction || (meta && (meta.crisisAction || meta.authorityCrisisAction)) || null
      }, {
        turn: GM.turn || 0,
        source: 'tinyi-stage6-crisis-surface'
      });
    }
  } catch (_crisisSurfaceE) {
    try { window.TM && TM.errors && TM.errors.captureSilent(_crisisSurfaceE, 'tinyi-stage6-crisis-surface'); } catch (_) {}
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
          blockerParty: seal.blockerParty,
          sourceType: seal.sourceType || '',
          sourceClass: seal.sourceClass || '',
          className: seal.className || seal.sourceClass || '',
          demandText: seal.demandText || '',
          origin: seal.origin || null,
          relationEvidence: seal.relationEvidence || []
        }, { turn: GM.turn || 0, source: 'tinyi-stage6-blocked' });
        // 销单：v2 decide 侧挂起的粗账落账意向（双写收口·退朝兜底不再补落）
        if (CY._ty3) { CY._ty3._classOutcomeApplied = true; CY._ty3._classOutcomePending = null; }
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
          opposingParties: opposingParties,
          sourceType: seal.sourceType || '',
          sourceClass: seal.sourceClass || '',
          className: seal.className || seal.sourceClass || '',
          demandText: seal.demandText || '',
          origin: seal.origin || null,
          relationEvidence: seal.relationEvidence || []
        }, { turn: GM.turn || 0, source: 'tinyi-stage6-issued' });
        // 销单：v2 decide 侧挂起的粗账落账意向（双写收口·退朝兜底不再补落）
        if (CY._ty3) { CY._ty3._classOutcomeApplied = true; CY._ty3._classOutcomePending = null; }
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
      decisionMode: (ctx.decision && ctx.decision.mode) || ctx.decisionMode || '',
      sourceType: seal.sourceType || '',
      sourceClass: seal.sourceClass || '',
      className: seal.className || seal.sourceClass || '',
      demandText: seal.demandText || '',
      relationEvidence: seal.relationEvidence || []
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
    _ty3_adjustHuangquan(-5, '\u5f3a\u884c\u63a8\u8fdb\u53d7\u515a\u6d3e\u963b\u6ede', 'tinyi-hostile-forced');
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
  // v2.6 Slice 4.5 currentPhase update
  if (typeof CY !== 'undefined' && CY._ty3) CY._ty3.currentPhase = 'seal';
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
    // 国是之制硬通道（2026-07-03）：变法类议题·「改革推行」之制已成风者·反对党留中不发更难
    try {
      var _grIsReform = ((CY._ty3 && CY._ty3.meta && CY._ty3.meta.topicType) || (CY._ty2 && CY._ty2.topicType)) === 'reform';
      var _GRty = (typeof GlobalRules !== 'undefined' && GlobalRules) || (typeof window !== 'undefined' && window.GlobalRules);
      if (_grIsReform && _GRty && typeof _GRty.mod === 'function') {
        prob = Math.max(0, prob - Math.min(0.25, Number(_GRty.mod('reform_success')) || 0));
      }
    } catch (_grtyE) {}
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
    if (typeof addEB === 'function') addEB('用印', '用印受阻·阻于' + (seal.blockerParty || '反对党派'));
    return;
  }
  if (force && hostile) {
    var ph0 = _ty3_getPartyObj(hostile.partyName);
    if (ph0) ph0.cohesion = Math.min(100, (parseInt(ph0.cohesion, 10) || 50) + 3);
    var siOld = (typeof GM.partyStrife === 'number') ? GM.partyStrife : 50;
    if (typeof GM.partyStrife === 'number') GM.partyStrife = Math.min(100, GM.partyStrife + 4);
    _ty3_adjustHuangquan(-5, '\u5f3a\u884c\u7528\u5370\u53d7\u515a\u6d3e\u963b\u6ede', 'tinyi-force-seal');
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 强行用印·阻于 ' + hostile.partyName + '·皇威 -5·' + _ty3_strifeChange(siOld, GM.partyStrife) + ' 〕', true);
    if (typeof addEB === 'function') addEB('用印', '强行用印·阻于' + hostile.partyName + '·' + _ty3_strifeChange(siOld, GM.partyStrife));
  } else {
    if (typeof addCYBubble === 'function') addCYBubble('内侍', '〔 诏命用印颁行 〕', true);
    if (typeof addEB === 'function') addEB('用印', '诏命用印·颁行');
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
  html += '<textarea id="ty3-vd-input" placeholder="如：议虽如此·然朕意只在江南三省试行·北方暂缓……" style="width:100%;min-height:90px;padding:10px 12px;background:rgba(255,255,255,0.5);border:1px solid rgba(140,118,84,0.5);border-radius:2px;font-family:STKaiti,KaiTi,serif;font-size:0.92rem;color:#14090b;line-height:1.7;resize:vertical;"></textarea>';
  html += '<div style="font-size:0.74rem;color:#6d5a3e;line-height:1.6;margin:0.7rem 0 1.1rem;">此栏可选填·若朕之裁决与廷议原议有所偏离(只采一部·或换一角度·或意在他事)·写下二三句·让史官与百官会其圣意。</div>';
  html += '<div style="display:flex;gap:12px;justify-content:flex-end;">';
  html += '<button onclick="_ty3_phase6_skipVerdictNote()" style="padding:7px 18px;background:transparent;border:1px solid #8c7654;color:#6d5a3e;border-radius:2px;font-size:0.82rem;cursor:pointer;">暂不补述</button>';
  html += '<button onclick="_ty3_phase6_saveVerdictNote()" style="padding:7px 22px;background:#7a1f1a;border:1px solid #5a1510;color:#f3e7c8;border-radius:2px;font-size:0.82rem;cursor:pointer;">朱笔录之</button>';
  html += '</div>';
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
