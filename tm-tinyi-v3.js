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
//  【立项拆分 2026-07-04】§0.5-§0.995 → tm-tinyi-v3-persona.js（载于本文件之前）
//  §12 新党派系统 → tm-tinyi-v3-parties.js（载于本文件之后）·保序切割·全局函数跨文件解析
// ═══════════════════════════════════════════════════════════════════════
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
  // 皇威 +1（收口走写口·未注册源走 _default 封顶）
  if (typeof AuthorityEngines !== 'undefined' && AuthorityEngines.adjustHuangwei) AuthorityEngines.adjustHuangwei('privateDecision', 1, '私决御前·乾纲独断');
  else if (GM.huangwei && typeof GM.huangwei.index === 'number') GM.huangwei.index = Math.min(100, GM.huangwei.index + 1); // 沙箱回退
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
//  【立项拆分二切 2026-07-04】§9草诏拟旨+§10廷推人事(原§2980-末)
//  → tm-tinyi-v3-edict-personnel.js（载于本文件之后、-parties之前）·保序切割
// ═══════════════════════════════════════════════════════════════════════
