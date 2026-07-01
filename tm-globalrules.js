/*
 * tm-globalrules.js — 全局持续规则册（国是·风气）· B1 基座
 * ============================================================
 * 承载「不能被数据量化的间接全局效果」：一座建筑/一桩事件可确立一条
 * 持续生效的全局规则（如「实学馆之制」→ 改革推行↑ / 实学推广↑ / 实学认可↑），
 * 并必招致既得群体的全局阻力（传统士绅清议、旧学官非之）。
 *
 * 设计铁律（承项目 P-QAM）：判断当场自由（有司核议判定产生何规则/多大阻力），
 *   落账走硬门（规则只走结构化档位 + 配额，不进数值白名单、不走费效封顶）。
 * 生效（B1·纯软通道）：promptContext() 注入回合推演 → AI 据此让改革类诏令更易成、
 *   实学/技术人才类事件更易出、传统势力发起清议/上疏。阻力的结构化反噬留 B3。
 *
 * 跨朝代通用：规则名/倾向皆用中立古词（实学/经世/格致/通商/营造），专名归剧本。
 *
 * 数据：GM._globalRules = [rule]，单条 rule 结构见 _normalizeRule。
 * 公开：window.GlobalRules（register/promptContext/mod/list/find/dismiss）
 *      window.GlobalRulesEngine（tick·供 endturn-systems 调）
 * 依赖：GM（mutate _globalRules / _chronicle）；可选 addEB / GameEventBus。
 */
(function () {
  'use strict';

  // ── 倾向档位：强度涨幅 + 软通道叙事强度 ──────────────────────
  // mag 不是精确数值，是「档」。mod() 返回的数供 B5 硬通道按档读取。
  var MAG = {
    minor:    { rank: 1, label: '渐', growth: 4,  modVal: 0.05 },
    moderate: { rank: 2, label: '颇', growth: 7,  modVal: 0.10 },
    major:    { rank: 3, label: '大', growth: 11, modVal: 0.18 }
  };
  // 倾向配额（防玄幻：一座建筑可有多个温和倾向，但不可全 major 包打天下）
  var TEND_MAX = 4;          // 至多 4 条倾向
  var MAJOR_QUOTA = 1;       // 至多 1 条 major（多的降 moderate）
  var MODERATE_QUOTA = 2;    // 至多 2 条 moderate（多的降 minor）

  // ── 阻力烈度：扎根度承压 + 叙事烈度词 ────────────────────────
  var RESIST = {
    simmering: { drag: 2, label: '微' },   // 私议
    active:    { drag: 5, label: '炽' },   // 清议、上疏
    fierce:    { drag: 9, label: '沸' }    // 结党、请罢
  };

  // ── 阻力→既得阶层承压（B3a·走 TM.ClassEngine.gateSatisfaction 正道总闸·绝不直写）──
  // 烈度 → 每回合每匹配阶层满意度净降（小幅·由 ±14 总闸夹·留余地给其余信号）
  var RESIST_SAT_DRAIN = { simmering: 0.8, active: 2.0, fierce: 3.5 };
  // 抵制群体（AI 自由措辞）→ 真实阶层名匹配（archetype 正则·仿 edict-lifecycle._EDICT_CLASS_MATCH）
  var _RESIST_CLASS_MATCH = [
    { tag: /士|绅|缙|儒|学|文|翰|生员|清流|旧党/, cls: /士|绅|缙|儒|文|官|翰|生员|林/ },
    { tag: /勋|贵|戚|世家|豪强|豪/,             cls: /勋|贵|戚|豪|世家/ },
    { tag: /宗|藩|皇族/,                         cls: /宗|藩|皇族/ },
    { tag: /商|贾|海禁/,                         cls: /商|贾/ },
    { tag: /军|武|将/,                           cls: /军|武/ }
  ];
  function _matchResistClasses(fromTerms) {
    var g = _gm();
    if (!g || !Array.isArray(g.classes) || !g.classes.length) return [];
    var terms = Array.isArray(fromTerms) ? fromTerms : [];
    var hit = [];
    terms.forEach(function (term) {
      term = String(term || '');
      var re = null;
      for (var i = 0; i < _RESIST_CLASS_MATCH.length; i++) {
        if (_RESIST_CLASS_MATCH[i].tag.test(term)) { re = _RESIST_CLASS_MATCH[i].cls; break; }
      }
      g.classes.forEach(function (cls) {
        if (!cls || typeof cls !== 'object') return;
        var nm = String(cls.name || '');
        var matched = re ? re.test(nm) : (nm && term.length >= 2 && (nm.indexOf(term) >= 0 || term.indexOf(nm) >= 0));
        if (matched && hit.indexOf(cls) < 0) hit.push(cls);
      });
    });
    return hit;
  }
  // 对一条「活而未成风」之制施加阻力承压（entrenched=新序已立不再压·suppressed=已罢）
  function _applyResistancePressure(r, turn, acc) {
    if (!r || !r.resistance || !r.resistance.from || !r.resistance.from.length) return;
    if (r.status !== 'nascent' && r.status !== 'established') return;
    var CE = (typeof TM !== 'undefined' && TM.ClassEngine && typeof TM.ClassEngine.gateSatisfaction === 'function') ? TM.ClassEngine : null;
    if (!CE) return;   // 无总闸则不施（守纪律·绝不绕闸直写满意度）
    var g = _gm(); if (!g) return;
    var drain = RESIST_SAT_DRAIN[r.resistance.intensity] || 0; if (!drain) return;
    var classes = _matchResistClasses(r.resistance.from);
    classes.forEach(function (cls) {
      try {
        var res = CE.gateSatisfaction(g, cls, -drain, { turn: turn, source: 'globalrule-resist', reason: '「' + r.name + '」之制触既得·' + (r.resistance.label || '物议') });
        if (res && res.approved < 0 && acc) acc[cls.name] = (acc[cls.name] || 0) + res.approved;
      } catch (_) {}
    });
  }

  // ── 硬核反噬·皇威（B3c·owner 拍板硬核档）──────────────────────
  // 仅最烈（fierce·结党请罢）+ 未成风（nascent/established）+ 扎根尚浅（< 阈值·朝廷压不住）之制，
  // 方走 AuthorityEngines.adjustHuangwei 正道（memorialObjection 源·引擎按源封顶·总量有底·不直写 index）。
  // 守「有据/可预见/可规避/渐进」：玩家加码（多建同类抬扎根）或退让（撤案/任其成风）→ 反噬即停，非天降惩罚。
  var HARD_REBACK_STRENGTH = 40;   // 扎根 < 此·fierce 之制损皇威；越此则朝廷渐得手·不再损
  var HUANGWEI_REBACK = 1.2;       // 每回合皇威扣分（adjustHuangwei 按源封顶·总量有底）
  function _applyAuthorityReback(r) {
    var hit = r && r.resistance && r.resistance.intensity === 'fierce' &&
              (r.status === 'nascent' || r.status === 'established') &&
              r.strength < HARD_REBACK_STRENGTH;
    if (!hit) { if (r) r._rebackedHw = false; return false; }
    var AE = (typeof AuthorityEngines !== 'undefined') ? AuthorityEngines :
             ((typeof window !== 'undefined' && window.AuthorityEngines) ? window.AuthorityEngines : null);
    if (!AE || typeof AE.adjustHuangwei !== 'function') return false;
    try {
      var res = AE.adjustHuangwei('memorialObjection', -HUANGWEI_REBACK, '「' + r.name + '」之制物议沸然·群臣交章请罢');
      if (res && res.ok !== false) {
        if (!r._rebackedHw) { r._rebackedHw = true; _eb('风气', '「' + r.name + '」之制群臣交章请罢，朝议汹汹，皇威为之挫'); }
        return true;
      }
    } catch (_) {}
    return false;
  }

  // ── 成风之赏·皇威（B5·与 B3c 反噬对称）──────────────────────
  // 一条之制顶住阻力、终成一时之尚 → 改制有成·君威巩固。走 adjustHuangwei 正道
  // （structuralReform 源·引擎按源封顶 +12·一制一次·须久历投入方至 entrenched·不可刷）。
  var ENTRENCH_HW_BOOST = 4;
  function _grantEntrenchReward(r) {
    if (!r || r._entrenchRewarded) return;
    var AE = (typeof AuthorityEngines !== 'undefined') ? AuthorityEngines :
             ((typeof window !== 'undefined' && window.AuthorityEngines) ? window.AuthorityEngines : null);
    if (!AE || typeof AE.adjustHuangwei !== 'function') return;
    try {
      AE.adjustHuangwei('structuralReform', ENTRENCH_HW_BOOST, '「' + r.name + '」之制蔚然成风·改制有成·朝纲为之新');
      r._entrenchRewarded = true;
    } catch (_) {}
  }

  // ── 扎根度 → 阶段 ───────────────────────────────────────────
  function _statusFor(strength) {
    if (strength <= 0)  return 'suppressed';   // 被传统势力扑灭
    if (strength < 30)  return 'nascent';      // 初创·根浅
    if (strength < 70)  return 'established';   // 立稳
    return 'entrenched';                        // 成风气·催生新群体（B5 接 schoolNetwork）
  }
  var STATUS_LABEL = {
    suppressed: '已罢', nascent: '初行', established: '渐立', entrenched: '成风'
  };

  function _gm() { return (typeof GM !== 'undefined' && GM) ? GM : null; }
  function _curTurn() { var g = _gm(); return (g && typeof g.turn === 'number') ? g.turn : 0; }

  function _ensure() {
    var g = _gm(); if (!g) return null;
    if (!Array.isArray(g._globalRules)) g._globalRules = [];
    return g._globalRules;
  }

  function _uid() {
    // 不依赖 Math.random 的弱唯一（turn + 序号），避免破坏确定性回归
    var g = _gm(); var n = (g && g._globalRulesSeq) ? g._globalRulesSeq : 0;
    if (g) g._globalRulesSeq = n + 1;
    return 'gr_' + _curTurn() + '_' + n;
  }

  function _clampTendencies(tends) {
    var out = [];
    if (!Array.isArray(tends)) return out;
    var majors = 0, moderates = 0;
    for (var i = 0; i < tends.length && out.length < TEND_MAX; i++) {
      var t = tends[i]; if (!t || !t.key) continue;
      var mag = MAG[t.mag] ? t.mag : 'minor';
      // 配额降档：major 超额 → moderate；moderate（含降下来的）超额 → minor
      if (mag === 'major') {
        if (majors >= MAJOR_QUOTA) mag = 'moderate'; else majors++;
      }
      if (mag === 'moderate') {
        if (moderates >= MODERATE_QUOTA) mag = 'minor'; else moderates++;
      }
      out.push({ key: String(t.key), label: t.label ? String(t.label) : String(t.key), mag: mag });
    }
    return out;
  }

  function _normalizeResistance(r) {
    if (!r) return null;
    var intensity = RESIST[r.intensity] ? r.intensity : 'simmering';
    var from = Array.isArray(r.from) ? r.from.map(String).slice(0, 6) : [];
    return { from: from, intensity: intensity, label: r.label ? String(r.label) : '' };
  }

  function _normalizeRule(raw) {
    if (!raw || !raw.name) return null;
    var tends = _clampTendencies(raw.tendencies);
    if (!tends.length) return null; // 无任何倾向 = 不成其为全局规则
    var _str = (typeof raw.strength === 'number') ? Math.max(1, Math.min(100, raw.strength)) : 12;
    return {
      id: raw.id || _uid(),
      name: String(raw.name),
      source: raw.source || 'building',          // building | edict | event | policy
      sourceRef: raw.sourceRef || null,          // {div, bld} 等溯源
      enactedTurn: _curTurn(),
      tendencies: tends,
      resistance: _normalizeResistance(raw.resistance),
      strength: _str,
      status: _statusFor(_str),                   // 初始阶段由扎根度派生（预置高强度之制可起步即 established/entrenched）
      _lastTick: _curTurn()
    };
  }

  // ── 登记一条全局规则（建筑核议准奏 / 事件调用）──────────────
  // 同名规则不重复立；若同名已在，则视为「再建同类」给既有规则提扎根度。
  function register(raw) {
    var list = _ensure(); if (!list) return null;
    var rule = _normalizeRule(raw);
    if (!rule) return null;
    var exist = list.find(function (r) { return r.name === rule.name && r.status !== 'suppressed'; });
    if (exist) {
      // 再建同类：扎根 +8，刷新阻力（取较烈者）
      exist.strength = Math.min(100, exist.strength + 8);
      if (rule.resistance && (!exist.resistance ||
          RESIST[rule.resistance.intensity].drag > RESIST[exist.resistance.intensity].drag)) {
        exist.resistance = rule.resistance;
      }
      exist.status = _statusFor(exist.strength);
      _chron('风气', '「' + exist.name + '」之制再获兴造，根基益固（' + STATUS_LABEL[exist.status] + '）');
      return exist;
    }
    list.push(rule);
    if (list.length > 40) list.splice(0, list.length - 40);
    _eb('风气', '确立全局之制：' + rule.name + '（' + _tendBrief(rule) + '）');
    _chron('风气', '确立「' + rule.name + '」之制：' + _tendBrief(rule) +
      (rule.resistance && rule.resistance.from.length ? '；然 ' + rule.resistance.from.join('、') + ' 非之' : ''));
    _emit('globalrule:enacted', { id: rule.id, name: rule.name });
    return rule;
  }

  function _tendBrief(rule) {
    return rule.tendencies.map(function (t) { return t.label + '·' + MAG[t.mag].label; }).join('，');
  }

  // ── 每回合演进（GlobalRulesEngine.tick·endturn-systems 调）──
  // strength 随在位自然扎根，遭阻力承压；不用 Math.random，确定性。
  function tick() {
    var list = _ensure(); if (!list || !list.length) return;
    var turn = _curTurn();
    var acc = {};   // B3a·本回合阻力承压聚合（阶层名→净降·汇总一条 EB 不刷屏）
    for (var i = list.length - 1; i >= 0; i--) {
      var r = list[i];
      if (r._lastTick === turn) continue; // 同回合不重复 tick
      r._lastTick = turn;
      if (r.status === 'suppressed') continue;

      var gain = 3; // 基础自然扎根（推行既久，渐成习惯）
      var drag = (r.resistance && RESIST[r.resistance.intensity]) ? RESIST[r.resistance.intensity].drag : 0;
      r.strength = Math.max(0, Math.min(100, r.strength + gain - drag));
      var newStatus = _statusFor(r.strength);

      // B3a·阻力反作用于既得阶层满意度（走 gateSatisfaction 总闸·仅 nascent/established 之制施压）
      _applyResistancePressure(r, turn, acc);
      // B3c·硬核反噬：最烈且压不住之制损皇威（走 adjustHuangwei 正道·可加码/退让规避）
      _applyAuthorityReback(r);

      if (newStatus !== r.status) {
        var old = r.status; r.status = newStatus;
        if (newStatus === 'suppressed') {
          _eb('风气', '「' + r.name + '」之制为物议所夺，渐次废弛');
          _chron('风气', '「' + r.name + '」之制终为传统所夺，名存实亡');
          _emit('globalrule:suppressed', { id: r.id, name: r.name });
        } else if (newStatus === 'entrenched') {
          _eb('风气', '「' + r.name + '」蔚然成风，新进之士渐握事权');
          _chron('风气', '「' + r.name + '」蔚然成风，渐成一时之尚');
          _emit('globalrule:entrenched', { id: r.id, name: r.name });
          _grantEntrenchReward(r);   // B5·成风之赏·皇威巩固（改制有成）
        } else {
          _chron('风气', '「' + r.name + '」之制' + STATUS_LABEL[old] + ' → ' + STATUS_LABEL[newStatus]);
        }
      }
    }
    var _losers = Object.keys(acc);
    if (_losers.length) _eb('风气', '新制触既得，' + _losers.join('、') + ' 颇有怨望');
  }

  // ── 软通道：注入回合推演 prompt（仿 getCustomPolicyContext）──
  function promptContext() {
    var list = _ensure(); if (!list || !list.length) return '';
    var live = list.filter(function (r) { return r.status !== 'suppressed'; });
    if (!live.length) return '';
    var s = '\n【国是·风气（持续之制）】\n';
    live.forEach(function (r) {
      s += '  · ' + r.name + '（' + STATUS_LABEL[r.status] + '）：' + _tendBrief(r);
      if (r.resistance && r.resistance.from.length) {
        s += '；然 ' + r.resistance.from.join('、') + ' ' + RESIST[r.resistance.intensity].label + '议非之';
      }
      s += '\n';
    });
    s += '  ※ 以上为持续生效之制：推演时令其潜移默化——倾向所及之事（改革、实学、通商等）更易推行、相关人才与新群体渐出；\n';
    s += '    然既得群体之阻力亦须如实体现（清议、上疏、结党、请罢）。扎根愈深则势愈成，物议愈炽则根愈摇。\n';
    return s;
  }

  // ── mod：读取某倾向当前全局合计档值（B5 硬通道 / 调试用）─────
  // 返回所有「未被压制」规则在该 key 上的 modVal 之和，按扎根度打折。
  function mod(key) {
    var list = _ensure(); if (!list) return 0;
    var total = 0;
    list.forEach(function (r) {
      if (r.status === 'suppressed') return;
      var rootFactor = Math.max(0.2, Math.min(1, r.strength / 70)); // 根浅则效弱
      r.tendencies.forEach(function (t) {
        if (t.key === key) total += MAG[t.mag].modVal * rootFactor;
      });
    });
    return Math.round(total * 1000) / 1000;
  }

  function list() { var l = _ensure(); return l ? l.slice() : []; }
  function find(name) { var l = _ensure(); return l ? l.find(function (r) { return r.name === name; }) : null; }

  // ── 显示就绪数据（B4·标签词汇留逻辑层单一来源·UI 只渲染）──────
  function cards() {
    var l = _ensure(); if (!l) return [];
    return l.map(function (r) {
      return {
        name: r.name,
        status: r.status,
        statusLabel: STATUS_LABEL[r.status] || r.status,
        strength: Math.round(r.strength),
        source: r.source,
        sourceRef: r.sourceRef,
        tends: r.tendencies.map(function (t) { return { key: t.key, label: t.label, mag: t.mag, magLabel: (MAG[t.mag] ? MAG[t.mag].label : '') }; }),
        resist: r.resistance ? {
          from: r.resistance.from.slice(),
          intensity: r.resistance.intensity,
          intensityLabel: (RESIST[r.resistance.intensity] ? RESIST[r.resistance.intensity].label : ''),
          label: r.resistance.label
        } : null
      };
    });
  }
  function dismiss(name, reason) {
    var l = _ensure(); if (!l) return false;
    var idx = l.findIndex(function (r) { return r.name === name; });
    if (idx < 0) return false;
    var r = l[idx];
    _eb('风气', '废罢「' + r.name + '」之制' + (reason ? '（' + reason + '）' : ''));
    l.splice(idx, 1);
    _emit('globalrule:dismissed', { name: name, reason: reason });
    return true;
  }

  // ── 容错小工具 ──────────────────────────────────────────────
  function _eb(tag, text) { try { if (typeof addEB === 'function') addEB(tag, text); } catch (_) {} }
  function _emit(ev, payload) { try { if (typeof GameEventBus !== 'undefined' && GameEventBus.emit) GameEventBus.emit(ev, payload); } catch (_) {} }
  function _chron(tag, text) {
    try {
      var g = _gm(); if (!g) return;
      if (!Array.isArray(g._chronicle)) return; // 不擅自造 chronicle，存在才写
      g._chronicle.push({ turn: _curTurn(), tag: tag, text: text });
    } catch (_) {}
  }

  // ── 导出 ────────────────────────────────────────────────────
  var api = { register: register, promptContext: promptContext, mod: mod,
              list: list, find: find, dismiss: dismiss, cards: cards, MAG: MAG, RESIST: RESIST,
              _normalizeRule: _normalizeRule, _statusFor: _statusFor };
  if (typeof window !== 'undefined') {
    window.GlobalRules = api;
    window.GlobalRulesEngine = { tick: tick };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; api.tick = tick;
  }
})();
