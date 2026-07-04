// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-keju-enke-player-initiative.js — Phase G·G2·step 0a·Path B + Path C
 *
 * v3.1·user feedback·"C·主动应与诏令系统结合"·
 *   - Path A (被动) — G1 spawn → keyi 投票·已存
 *   - Path B (半主动) — 礼部 wendui·复用 L4 cedui mode·此文件实施
 *   - Path C (主动) — 诏令系统集成·EDICT_TYPES 第 13 类·此文件实施 parser + suggestion
 *
 * red line·
 *   - flag gate·P.conf.useNewKejuG2=false 全 no-op
 *   - 不发 modal (除非 user 主动 trigger)·不发邸报
 *   - 3 路径全挂代价·零工具型零代价 fire (复 feedback_tool_vs_system_costs)
 *
 * Public API·
 *   _kjG2ParseEnkeFromEdictText(text)             — 单段文本·若含 enke keyword → 返 enke action·否则 null
 *   _kjG2ScanCtxInputEdictsForEnke(edicts)        — 扫整 edicts obj (political/military/diplomatic/economic) · 返 enke actions[]
 *   _kjG2OnEnkeApprovedViaEdict(action)            — applyEdictActions 后 hook·路由 enke action 到 exam runner (step a stub)
 *   _kjG2GetEnkeEdictTemplate(subtype, detail)     — 6 template (5 自然 trigger + "无故强发")
 *   _kjG2OnNaturalTriggerEnqueueDeskSuggestion(subtype, detail) — 5 自然 trigger SET 字段时·push suggestion
 *   _kjG2OpenLibuEnkeWendui()                      — Path B 入口·礼部 wendui·复用 L4 cedui
 *   _kjG2HandleLibuWenduiOutcome(libuLeader, result) — Path B 结果分发 (support/oppose/caveat)
 *   _kjG2PickLibuLeader()                          — 朝代-aware regex·主考 pick·复用 step a
 *   _kjG2NumToCn(n)                                — 阿拉伯数字 → 汉字 (template 用)
 *
 * 依赖·
 *   - GM (mutate _edictSuggestions / _enkeLibuWenduiLastYear / _pendingEnkeFromEdict)
 *   - P.conf.useNewKejuG2 (gate)
 *   - P.scenario.era (朝代 regex)
 *   - findCharByName (global)
 *   - _kjpOpenWendui (L4 cedui mode·已 ship·若不存在·path B 退化为 toast)
 *   - 不调 LLM (templates 是 pre-written)
 *
 * 不依赖 (step a 才会 wire)·
 *   - _kjG2OnEnkeApproved (step a)·此处先存到 GM._pendingEnkeFromEdict 队列·step a 启动后消费
 */
(function() {
  'use strict';

  function _isG2Enabled() {
    if (typeof P === 'undefined' || !P || !P.conf) return false;
    return P.conf.useNewKejuG2 !== false; // 默认开·2026-06-14·恩科解锁
  }

  function _getCurYear() {
    if (typeof GM === 'undefined' || !GM) return 0;
    return GM.year || (typeof P !== 'undefined' && P && P.time && P.time.year) || 0;
  }

  // ─── 朝代-aware regex (step a 复用·此处先放) ───

  var CHIEF_EXAMINER_TITLE_REGEX = {
    tang:    /礼部侍郎|知贡举|尚书省/,
    song:    /权知贡举|翰林学士|礼部尚书|知制诰/,
    yuan:    /礼部尚书|翰林国史院|集贤院/,
    ming:    /内阁大学士|大学士|礼部尚书|礼部侍郎|翰林学士/,
    qing:    /内阁大学士|大学士|礼部尚书|礼部侍郎|军机大臣/,
    default: /礼部|大学士|翰林|知贡举/
  };

  function _kjG2GetChiefExaminerRegex() {
    if (typeof P === 'undefined' || !P || !P.scenario) return CHIEF_EXAMINER_TITLE_REGEX.default;
    var era = String(P.scenario.era || '').toLowerCase();
    if (/唐|tang/i.test(era)) return CHIEF_EXAMINER_TITLE_REGEX.tang;
    if (/宋|song/i.test(era)) return CHIEF_EXAMINER_TITLE_REGEX.song;
    if (/元|yuan/i.test(era)) return CHIEF_EXAMINER_TITLE_REGEX.yuan;
    if (/明|ming/i.test(era)) return CHIEF_EXAMINER_TITLE_REGEX.ming;
    if (/清|qing/i.test(era)) return CHIEF_EXAMINER_TITLE_REGEX.qing;
    return CHIEF_EXAMINER_TITLE_REGEX.default;
  }

  function _kjG2PickLibuLeader() {
    if (typeof GM === 'undefined' || !GM || !Array.isArray(GM.chars)) return null;
    var rx = _kjG2GetChiefExaminerRegex();
    var cands = GM.chars.filter(function(c) {
      if (!c || c.alive === false || c._retired) return false;
      var t = c.officialTitle || c.title || '';
      return rx.test(t);
    });
    if (!cands.length) {
      cands = GM.chars.filter(function(c) {
        if (!c || c.alive === false || c._retired) return false;
        return (c.prestige || 0) >= 60;
      });
    }
    if (!cands.length) return null;
    cands.sort(function(a, b) { return (b.prestige || 0) - (a.prestige || 0); });
    return cands[0];
  }

  // ─── 阿拉伯数字 → 汉字 (template 用) ───

  function _kjG2NumToCn(n) {
    var DIGITS = ['零','一','二','三','四','五','六','七','八','九'];
    var UNITS  = ['','十','百','千'];
    n = parseInt(n, 10);
    if (isNaN(n) || n < 0) return String(n);
    if (n === 0) return '零';
    if (n < 10) return DIGITS[n];
    if (n < 20) return '十' + (n % 10 ? DIGITS[n % 10] : '');
    if (n < 100) return DIGITS[Math.floor(n / 10)] + '十' + (n % 10 ? DIGITS[n % 10] : '');
    if (n === 100) return '一百';
    // 简单实现·100-999
    if (n < 1000) {
      var h = Math.floor(n / 100);
      var rest = n % 100;
      var s = DIGITS[h] + '百';
      if (rest === 0) return s;
      if (rest < 10) return s + '零' + DIGITS[rest];
      s += DIGITS[Math.floor(rest / 10)] + '十';
      if (rest % 10) s += DIGITS[rest % 10];
      return s;
    }
    // 1000+·1735 → 一七三五 (年号简写)
    return String(n).split('').map(function(d) { return DIGITS[parseInt(d, 10)] || d; }).join('');
  }

  // ─── 5 自然 trigger + "无故强发" template ───

  function _kjG2GetEnkeEdictTemplate(subtype, detail) {
    detail = detail || {};
    var TEMPLATES = {
      'reign-change': {
        label: '登基恩科',
        path:  '登基恩科',
        body:  '朕初膺天命·登基改元·士林翘首·特开恩科一次·以广圣德·凡天下举子·均得与试。礼部尚书主之·限本年内开科。钦此。'
      },
      'birthday': {
        label: '圣寿' + _kjG2NumToCn(detail.age || 60) + '恩科',
        path:  '寿诞恩科',
        body:  '朕躬康健·恭逢圣寿' + _kjG2NumToCn(detail.age || 60) + '·士林同庆·特开恩科一次·以光天恩·凡天下举子·均得与试。礼部尚书主之·限本年内开科。钦此。'
      },
      'wedding': {
        label: '大婚恩科',
        path:  '大婚恩科',
        body:  '朕大婚之喜·普天同庆·特开恩科一次·士子同沾恩荣·限本年内开科。钦此。'
      },
      'platform-disaster': {
        label: '平乱恩科',
        path:  '平乱恩科',
        body:  '朕赖天地祖宗保佑·' + (detail.disasterType || '逆乱') + '已平·四海归心·特开恩科一次·以慰士民·凡天下举子均得与试。钦此。'
      },
      'auspice': {
        label: '瑞祥恩科',
        path:  '瑞祥恩科',
        body:  '朕仰承天庇·' + (detail.portentDesc || '瑞应') + '现·实为吉兆·特开恩科一次·以应天瑞·士林同庆。钦此。'
      },
      '_player_edict': {
        label: '⚠ 无故强发恩科',
        path:  '无故强发',
        body:  '朕意已决·开恩科一次·礼部速办·勿议。钦此。'   // 短促·清议必讥
      }
    };
    return TEMPLATES[subtype] || TEMPLATES['_player_edict'];
  }

  // BB12·清过期 enke suggestion (用 _enkeExpireYear)
  function _kjG2PruneExpiredEnkeSuggestions() {
    if (typeof GM === 'undefined' || !GM || !Array.isArray(GM._edictSuggestions)) return 0;
    var curY = _getCurYear();
    var before = GM._edictSuggestions.length;
    GM._edictSuggestions = GM._edictSuggestions.filter(function(s) {
      // 只清 enke 自家 suggestion (有 _enkeExpireYear)·别人不动
      if (!s || !s._enkeExpireYear) return true;
      return s._enkeExpireYear >= curY;
    });
    return before - GM._edictSuggestions.length;
  }

  // BB5·init/resume·nuke _kjG2EnkeWenduiContext (transient·不应跨 save/load 持久化)
  function _kjG2NukeStaleEnkeWenduiContext() {
    if (typeof window === 'undefined') return;
    if (!window._kjG2EnkeWenduiContext) return;
    // 若 wendui modal 不在 DOM·context 是 stale·清
    if (typeof document !== 'undefined') {
      try {
        if (!document.getElementById('wendui-modal')) {
          window._kjG2EnkeWenduiContext = null;
        }
      } catch(_) {
        window._kjG2EnkeWenduiContext = null;
      }
    } else {
      // node env·无 DOM·init 时直清 (load 后必清)
      window._kjG2EnkeWenduiContext = null;
    }
  }

  // ─── desk template suggestion (5 自然 trigger 时 push) ───

  function _kjG2OnNaturalTriggerEnqueueDeskSuggestion(subtype, detail) {
    if (!_isG2Enabled()) return;
    if (typeof GM === 'undefined' || !GM) return;
    if (!GM._edictSuggestions) GM._edictSuggestions = [];
    var curY = _getCurYear();
    var curTurn = (GM.turn || 1);
    // BB12·先 prune 过期 suggestion (内部清·避 desk 满屏)
    _kjG2PruneExpiredEnkeSuggestions();
    // 幂等·同 subtype + 同年 已 push·不重 enqueue (用 _enkeSubtype + turn guard)
    var existing = GM._edictSuggestions.find(function(s) {
      return s && s._enkeSubtype === subtype && s._enkeEnqueuedYear === curY;
    });
    if (existing) return;
    var template = _kjG2GetEnkeEdictTemplate(subtype, detail);
    // C1 fix·schema 匹配 _renderEdictSuggestions·{source, from, topic, content, turn, used}
    GM._edictSuggestions.push({
      source:           subtype === '_player_edict' ? '恩科·⚠强发' : '恩科·建议',
      from:             '礼部',
      topic:            template.label,
      content:          template.body,
      turn:             curTurn,
      used:             false,
      // G2 supplemental (render 不读·内部 dup detect / state 用)
      _enkeSubtype:     subtype,
      _enkeBadge:       '🎓',
      _enkeHistoryPath: template.path,
      _enkeSeverity:    subtype === '_player_edict' ? 'warning' : 'normal',
      _enkeExpireYear:  curY + 2,
      _enkeEnqueuedYear: curY
    });
  }

  // ─── enke edict parser ───

  function _kjG2ParseEnkeFromEdictText(text) {
    if (!text || typeof text !== 'string') return null;
    // 强 keyword·必须含至少一个
    if (!/特赐|恩科|开恩|科赐|钦取|恩荣|蒙恩/.test(text)) {
      // 弱 keyword (开科 / 取士) 单独不够·必须伴 "恩" 字 (避撞 education_culture)
      if (!/(开科|取士)/.test(text)) return null;
      if (!/恩|圣/.test(text)) return null;
    }
    // F6·negative gate·扫时政记时 AI 可能写"议罢恩科/未开/搁置/礼部驳"·这种语境 skip
    // 诏书路径 user 自己写诏书·一般不会包含"罢/驳"·扫时政记才需要此 gate
    if (/议罢恩科|未开恩科|罢恩科|停恩科|搁置恩科|驳恩科|不准开恩科|反对开恩科|拒开恩科|缓开恩科|寝议/.test(text)) {
      return null;
    }
    // subtype 推断·按顺序匹配 (先具体后通用)
    var subtype = '_player_edict';
    if (/登基|改元|初膺天命|新君/.test(text)) subtype = 'reign-change';
    else if (/圣寿|寿诞|万寿|寿辰/.test(text)) subtype = 'birthday';
    else if (/大婚|册立后|大典之喜/.test(text)) subtype = 'wedding';
    else if (/平|乱|逆/.test(text) && /已平|定|靖/.test(text)) subtype = 'platform-disaster';
    else if (/瑞|祥|甘露|麒麟|凤凰|降甘/.test(text)) subtype = 'auspice';
    var PATH_LABELS = {
      'reign-change':    '登基恩科',
      'birthday':        '寿诞恩科',
      'wedding':         '大婚恩科',
      'platform-disaster':'平乱恩科',
      'auspice':         '瑞祥恩科',
      '_player_edict':   '无故强发'
    };
    return {
      type:        'enke',
      category:    'enke',
      subtype:     subtype,
      text:        text,
      historyPath: PATH_LABELS[subtype],
      year:        _getCurYear()
    };
  }

  function _kjG2ScanCtxInputEdictsForEnke(edicts) {
    if (!edicts) return [];
    // edicts 可能是 string·也可能是 obj {political, military, ...}
    var out = [];
    if (typeof edicts === 'string') {
      var a = _kjG2ParseEnkeFromEdictText(edicts);
      if (a) out.push(a);
    } else if (typeof edicts === 'object') {
      // F1·加 'other'·御案"其他"栏的恩科诏书也要扫
      var keys = ['political', 'military', 'diplomatic', 'economic', 'other'];
      for (var i = 0; i < keys.length; i++) {
        var t = edicts[keys[i]];
        if (t && typeof t === 'string') {
          var a2 = _kjG2ParseEnkeFromEdictText(t);
          if (a2) {
            a2._sourceCategory = keys[i];
            out.push(a2);
          }
        }
      }
      // 也支持 array (兼容 ctx.input.edicts 数组形式)
      if (Array.isArray(edicts)) {
        edicts.forEach(function(e) {
          var t2 = (typeof e === 'string') ? e : (e && e.text);
          if (!t2) return;
          var a3 = _kjG2ParseEnkeFromEdictText(t2);
          if (a3) out.push(a3);
        });
      }
    }
    return out;
  }

  // ─── applyEdictActions hook·路由 enke action 到 exam runner ───

  function _kjG2OnEnkeApprovedViaEdict(action) {
    if (!_isG2Enabled()) return;
    if (!action || action.type !== 'enke') return;
    // step a 才 ship `_kjG2OnEnkeApproved` 真 runner·此处先存到 pending queue
    if (typeof GM === 'undefined' || !GM) return;
    if (!GM._pendingEnkeFromEdict) GM._pendingEnkeFromEdict = [];
    // 幂等·同 subtype + 同年 已 push 过·不重
    var dupKey = action.subtype + ':' + action.year;
    var existing = GM._pendingEnkeFromEdict.find(function(p) { return p._dupKey === dupKey; });
    if (existing) return;
    GM._pendingEnkeFromEdict.push({
      examType:    'enke',
      subtype:     action.subtype,
      historyPath: action.historyPath,
      year:        action.year,
      initiative:  'edict',
      edictText:   action.text,
      sourceCategory: action._sourceCategory || '',
      _dupKey:     dupKey,
      _enqueuedAt: _getCurYear()
    });
    // 若 step a 已 ship·路由
    if (typeof window !== 'undefined' && typeof window._kjG2OnEnkeApproved === 'function') {
      try {
        window._kjG2OnEnkeApproved(action.subtype, {
          examType:    'enke',
          subtype:     action.subtype,
          reason:      '陛下下诏·' + action.historyPath,
          initiative:  'edict',
          edictRef:    action,
          detail: {
            _forceCensorialQuestions: action.subtype === '_player_edict',
            _affinityHalved:          action.subtype === '_player_edict'
          }
        });
        // 已路由·移出 pending
        var idx = GM._pendingEnkeFromEdict.findIndex(function(p) { return p._dupKey === dupKey; });
        if (idx >= 0) GM._pendingEnkeFromEdict.splice(idx, 1);
      } catch(e) {
        try { console.warn('[G2.step0a] _kjG2OnEnkeApproved 调用失败', e); } catch(_) {}
      }
    }
  }

  // ─── Path B·礼部 wendui ───

  function _kjG2OpenLibuEnkeWendui() {
    if (!_isG2Enabled()) {
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('恩科系统未开 (G2 flag off)');
      }
      return false;
    }
    var thisYear = _getCurYear();
    if (GM._enkeLibuWenduiLastYear === thisYear) {
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('本年已问过礼部·明岁再议');
      }
      return false;
    }
    var libuLeader = _kjG2PickLibuLeader();
    if (!libuLeader) {
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('朝中无主礼部之人·恩科不可议');
      }
      return false;
    }
    GM._enkeLibuWenduiLastYear = thisYear;
    // C2 fix·真函数 openWenduiModal(name, mode='cedui', prefillStr)·set context globals + 让 wendui close hook 路由 G2
    if (typeof window === 'undefined' || typeof window.openWenduiModal !== 'function') {
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('问对系统未 ship·恩科议·可于御案下诏');
      }
      return false;
    }
    // set G2 context global·closeWenduiModal 内会检·若 active 路由 _kjG2OnEnkeWenduiClose
    var ec = (GM._enkeAbuseCounter && GM._enkeAbuseCounter.enkeCount) || 0;
    window._kjG2EnkeWenduiContext = {
      libuLeaderName: libuLeader.name,
      year:           thisYear,
      enkeAbuseCount: ec,
      openedAtTurn:   (GM.turn || 1)
    };
    var prefillStr = '【陛下密召】今岁可开恩科否·朕欲闻卿之见。' +
      (ec >= 3 ? ' (本朝已开 ' + ec + ' 次·士林或讥)' : '');
    try {
      window.openWenduiModal(libuLeader.name, 'cedui', prefillStr);
      return true;
    } catch(e) {
      try { console.warn('[G2.step0a] openWenduiModal 失败', e); } catch(_) {}
      window._kjG2EnkeWenduiContext = null;
      return false;
    }
  }

  // wendui close hook·closeWenduiModal 调·读 G2 context + 派生 stance
  function _kjG2OnEnkeWenduiClose(npcName) {
    if (typeof GM === 'undefined' || !GM) return;
    var ctx = (typeof window !== 'undefined') ? window._kjG2EnkeWenduiContext : null;
    if (!ctx) return false;   // 非 G2 enke wendui·不处理 (L4 cedui hook 走)
    if (ctx.libuLeaderName !== npcName) return false;   // 不匹配·不处理
    var libuLeader = (typeof findCharByName === 'function') ? findCharByName(npcName) : null;
    if (!libuLeader) {
      window._kjG2EnkeWenduiContext = null;
      return false;
    }
    // 派生 stance·复用 _kejuQueryLibuStance paradigm (loyalty + affinity·若已 ship)·否则简单 loyalty 判
    var stance = _kjG2DeriveLibuStanceFromChar(libuLeader, ctx);
    _kjG2HandleLibuWenduiOutcome(libuLeader, { stance: stance, reason: '' });
    window._kjG2EnkeWenduiContext = null;
    return true;
  }

  function _kjG2DeriveLibuStanceFromChar(libuLeader, ctx) {
    if (!libuLeader) return 'caveat';
    var loy = (libuLeader.loyalty != null) ? libuLeader.loyalty : 50;
    var aff = (libuLeader._enkeAffinity != null) ? libuLeader._enkeAffinity : 0;
    var ec = (ctx && ctx.enkeAbuseCount) || 0;
    // 滥开 ≥3·礼部倾向反对 (基准 -20)·≥5 强反对 -40
    var penalty = ec >= 5 ? -40 : (ec >= 3 ? -20 : 0);
    var combined = loy + aff + penalty;
    if (combined >= 70) return 'support';
    if (combined <= 30) return 'oppose';
    return 'caveat';
  }

  function _kjG2HandleLibuWenduiOutcome(libuLeader, result) {
    if (!libuLeader || !result) return;
    if (result.stance === 'support') {
      // 礼部背书·spawn G1 entry·走 path B 汇合
      if (typeof window !== 'undefined' && typeof window._kjSpawnSpecialExam === 'function') {
        window._kjSpawnSpecialExam('enke', '礼部 (' + libuLeader.name + ') 议·' + (result.reason || '可开'), {
          subtype:        'libu-backed',
          libuLeader:     libuLeader.name,
          _playerInitiated: true
        });
      }
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('🎓 礼部背书·恩科入议');
      }
    } else if (result.stance === 'oppose') {
      // 礼部反·affinity -10
      if (libuLeader._enkeAffinity == null) libuLeader._enkeAffinity = 0;
      libuLeader._enkeAffinity -= 10;
      // chronicle (push 到 GM._chronicle·跟 L7 paradigm 一致)
      if (typeof GM !== 'undefined' && GM && Array.isArray(GM._chronicle)) {
        if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
          turn: GM.turn || 1,
          type: 'enke_libu_oppose',
          text: _getCurYear() + '年·礼部 ' + libuLeader.name + ' 劝阻开恩科·affinity -10',
          tags: ['科举', '恩科', '礼部', '劝阻']
        });
      }
      // 提示·user 可走 path C (诏令强发)
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('礼部劝阻·可于御案下诏强发 (代价 重)');
      }
    } else {
      // caveat·条件性·spawn 时 attach caveat
      if (typeof window !== 'undefined' && typeof window._kjSpawnSpecialExam === 'function') {
        window._kjSpawnSpecialExam('enke', '礼部 (' + libuLeader.name + ') 议·' + (result.reason || '需慎'), {
          subtype:    'libu-caveat',
          libuLeader: libuLeader.name,
          caveat:     result.reason || '',
          _playerInitiated: true
        });
      }
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('礼部 ⚖ 略有保留·恩科入议·但有条件');
      }
    }
  }

  // ─── expose ───
  if (typeof window !== 'undefined') {
    window._kjG2ParseEnkeFromEdictText           = _kjG2ParseEnkeFromEdictText;
    window._kjG2ScanCtxInputEdictsForEnke        = _kjG2ScanCtxInputEdictsForEnke;
    window._kjG2OnEnkeApprovedViaEdict           = _kjG2OnEnkeApprovedViaEdict;
    window._kjG2GetEnkeEdictTemplate             = _kjG2GetEnkeEdictTemplate;
    window._kjG2OnNaturalTriggerEnqueueDeskSuggestion = _kjG2OnNaturalTriggerEnqueueDeskSuggestion;
    window._kjG2PruneExpiredEnkeSuggestions      = _kjG2PruneExpiredEnkeSuggestions;
    window._kjG2NukeStaleEnkeWenduiContext       = _kjG2NukeStaleEnkeWenduiContext;
    window._kjG2OpenLibuEnkeWendui               = _kjG2OpenLibuEnkeWendui;
    window._kjG2OnEnkeWenduiClose                = _kjG2OnEnkeWenduiClose;
    window._kjG2HandleLibuWenduiOutcome          = _kjG2HandleLibuWenduiOutcome;
    window._kjG2DeriveLibuStanceFromChar         = _kjG2DeriveLibuStanceFromChar;
    window._kjG2PickLibuLeader                   = _kjG2PickLibuLeader;
    window._kjG2NumToCn                          = _kjG2NumToCn;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      _kjG2ParseEnkeFromEdictText:           _kjG2ParseEnkeFromEdictText,
      _kjG2ScanCtxInputEdictsForEnke:        _kjG2ScanCtxInputEdictsForEnke,
      _kjG2OnEnkeApprovedViaEdict:           _kjG2OnEnkeApprovedViaEdict,
      _kjG2GetEnkeEdictTemplate:             _kjG2GetEnkeEdictTemplate,
      _kjG2OnNaturalTriggerEnqueueDeskSuggestion: _kjG2OnNaturalTriggerEnqueueDeskSuggestion,
      _kjG2PruneExpiredEnkeSuggestions:      _kjG2PruneExpiredEnkeSuggestions,
      _kjG2NukeStaleEnkeWenduiContext:       _kjG2NukeStaleEnkeWenduiContext,
      _kjG2OpenLibuEnkeWendui:               _kjG2OpenLibuEnkeWendui,
      _kjG2OnEnkeWenduiClose:                _kjG2OnEnkeWenduiClose,
      _kjG2HandleLibuWenduiOutcome:          _kjG2HandleLibuWenduiOutcome,
      _kjG2DeriveLibuStanceFromChar:         _kjG2DeriveLibuStanceFromChar,
      _kjG2PickLibuLeader:                   _kjG2PickLibuLeader,
      _kjG2NumToCn:                          _kjG2NumToCn
    };
  }
})();
