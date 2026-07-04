// @ts-check
/* ═══════════════════════════════════════════════════════════════════════
 *  tm-tinyi-v3-edict-personnel.js — 廷议§9草诏拟旨+§10廷推人事（2026-07-04 立项拆分二切·自 tm-tinyi-v3.js 保序切出）
 *  内容：阶段5草诏官选择modal/prestige+favor反馈/阶段3廷推(钦定/廷推/暂阙)/phase6朝代结算
 *  装载期块4处(installDraftHook/window暴露/escAttr回退/installDChainHook)=尾切随行·执行序与拆分前逐字节等价
 *  加载序：index.html 中 tm-tinyi-v3.js 之后、tm-tinyi-v3-parties.js 之前——勿改
 * ═══════════════════════════════════════════════════════════════════════ */
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
  // S 档不在此早退：phase6_open 自有 S 分支(跳过用印弹窗·直接 resolveSeal 落账+气泡)——
  // 早退曾令 S 档整链断头：无 sealedEdict/编年/阶层销单·v2 兜底记错党错档(2026-07-04 审查定罪)
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
  if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record(entry);
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

