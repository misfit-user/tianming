// ============================================================
// 诏令效力 —— 一道诏令「办完了」不等于「不作数了」
//
// 诏令追踪表 GM._edictTracker 原本只记执行状态 status（pending/executing/completed…）。
// 「免江南新垦田赋三年」颁行办结后报 completed，就会从主推演、记忆检索、督办里一齐消失，
// 十几回合后 AI 便当它不存在。这里在同一条目上另记「效力」efficacy，与执行分开：
//   办结只改执行；效力由 AI 判定（常制 / 有期 / 一次性），撤销、替代也由新诏令触发。
//
// 本模块只做宪法栏的事：默认值、系统一次性条目的识别、期满时钟、保留规则和统一读口。
// 一道诏令算不算长期规则、期限多长、被哪道新诏废止，都是 AI 的演绎，不在这里写死。
// ============================================================
(function(root) {
  'use strict';
  var TM = root.TM = root.TM || {};

  var STATES = {
    unjudged: '未判定',   // AI 尚未判定：按现行对待，宁可多带，不可静默丢
    standing: '常制',
    term: '有期',
    one_off: '一次性',
    expired: '已到期',
    revoked: '已撤销',
    superseded: '被替代'
  };
  var CURRENT_STATES = { unjudged: true, standing: true, term: true };

  function list(v) { return Array.isArray(v) ? v : []; }

  function hash(text) {
    var h = 2166136261;
    for (var i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return (h >>> 0).toString(36);
  }

  // 系统按确定性流程生成的一次性条目：缺员通告、官制面板任命、弹劾。
  // 这些条目不会进入 AI 的诏令反馈，若按「未判定」处理，会永远挂在现行诏制里。
  function isSystemOneOff(e) {
    if (e._offTreeAppoint || e._vacancyFromSweep || e._impeach) return true;
    if (e.category === '官缺') return true;
    return /^(appoint_|impeach_|vacancy_)/.test(String(e.id || ''));
  }

  // 执行状态里表示「诏令本身作废」的几种：撤回、驳回、取消。它们优先于效力判定。
  var VOID_STATUS = { cancelled: true, revoked: true, rejected: true, aborted: true, withdrawn: true };

  function stateOf(e) {
    if (!e) return 'one_off';
    var state = e.efficacy && e.efficacy.state;
    if (state === 'expired' || state === 'superseded') return state;
    if (VOID_STATUS[String(e.status || '').toLowerCase()]) return 'revoked';
    if (state && STATES[state]) return state;
    if (e._reliefCaseId || isSystemOneOff(e)) return 'one_off';
    return 'unjudged';
  }

  // 有期诏令过了期限即不再现行；tick() 会把它正式记为已到期。
  function isPastTerm(e, turn) {
    if (stateOf(e) !== 'term') return false;
    var until = Number(e.efficacy && e.efficacy.untilTurn);
    return Number.isFinite(until) && until > 0 && Number(turn) > until;
  }

  function isCurrent(e, turn) {
    if (!e || !String(e.content || '').trim()) return false;
    return !!CURRENT_STATES[stateOf(e)] && !isPastTerm(e, turn);
  }

  // 追踪表清理：本回合的、仍在执行的、仍现行的一律保留；
  // 其余（办结、失败且已不再现行的）保留 keepTurns 回合后删除。
  var OPEN_STATUS = { executing: true, pending: true, partial: true, obstructed: true, pending_delivery: true };
  function prune(gm, keepTurns) {
    var turn = Number(gm.turn) || 0;
    gm._edictTracker = list(gm._edictTracker).filter(function(e) {
      if (!e) return false;
      if (e.turn === turn) return true;
      if (OPEN_STATUS[e.status]) return true;
      if (isCurrent(e, turn)) return true;
      return turn - e.turn < keepTurns;
    });
  }

  // 统一读口：当前仍作数的诏令，按下诏先后排列。
  function current(gm) {
    var turn = Number(gm && gm.turn) || 0;
    return list(gm && gm._edictTracker).filter(function(e) { return isCurrent(e, turn); });
  }

  // ── AI 判定（演绎栏的落账口）──────────────────────────────
  // 反馈里的写法：efficacy 用英文或中文均可；until 为期限（「三年」「十个月」「至T40」或回合数）；
  // digest 为要点；revokes / supersedes 为被本诏废止或取代的旧诏编号。
  var STATE_ALIASES = {
    standing: 'standing', '常制': 'standing', '长期': 'standing', permanent: 'standing',
    term: 'term', '有期': 'term', '限期': 'term', temporary: 'term',
    one_off: 'one_off', 'one-off': 'one_off', once: 'one_off', '一次性': 'one_off',
    expired: 'expired', '已到期': 'expired', '到期': 'expired'
  };
  var TERMINAL = { expired: true, revoked: true, superseded: true };
  var DIGEST_MAX = 200;   // 只防失控长文，正常要点远短于此

  var CN_DIGITS = { '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  function parseCount(text) {
    if (/^\d+$/.test(text)) return Number(text);
    if (text === '半') return 0.5;
    var tenAt = text.indexOf('十');
    if (tenAt < 0) return CN_DIGITS[text] != null && text.length === 1 ? CN_DIGITS[text] : NaN;
    var tens = tenAt === 0 ? 1 : CN_DIGITS[text.slice(0, tenAt)];
    var ones = tenAt === text.length - 1 ? 0 : CN_DIGITS[text.slice(tenAt + 1)];
    return (tens == null || ones == null) ? NaN : tens * 10 + ones;
  }
  function daysPerTurn() {
    try { if (typeof root._getDaysPerTurn === 'function') return Math.max(1, Number(root._getDaysPerTurn()) || 30); } catch (_) {}
    return 30;
  }
  // 期限换算成「最后一个仍有效的回合」；解析不了返回 null（保留原文，不自动到期）。
  function untilTurnOf(issueTurn, until) {
    if (until == null || until === '') return null;
    if (typeof until === 'number') return until > 0 ? issueTurn + Math.ceil(until) - 1 : null;
    var text = String(until).replace(/\s+/g, '');
    var absolute = text.match(/^(?:至|到)?(?:T|第)(\d+)(?:回合)?$/i);
    if (absolute) return Number(absolute[1]);
    var m = text.match(/^([0-9零〇一二两三四五六七八九十半]+)(个)?(年|季|月|旬|日|天|回合)(?:为期|内|之内)?$/);
    if (!m) return null;
    var n = parseCount(m[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (m[3] === '回合') return issueTurn + Math.ceil(n) - 1;
    var days = n * { '年': 360, '季': 90, '月': 30, '旬': 10, '日': 1, '天': 1 }[m[3]];
    return issueTurn + Math.max(1, Math.ceil(days / daysPerTurn())) - 1;
  }
  function idList(v) { return (Array.isArray(v) ? v : (v ? [v] : [])).map(String).filter(Boolean); }

  // 把一条诏令反馈里的效力判定落到对应诏令上。返回实际改动的说明，便于回执与测试。
  // 已到期、撤销、被替代的诏令不接受改判：要恢复只能另下新诏。
  function judge(gm, e, feedback) {
    var changes = [];
    if (!gm || !e || !feedback) return changes;
    var turn = Number(gm.turn) || 0, issue = Number(e.turn) || turn;
    var state = STATE_ALIASES[String(feedback.efficacy || '').trim().toLowerCase()] || STATE_ALIASES[String(feedback.efficacy || '').trim()];
    var digest = String(feedback.digest || '').trim().slice(0, DIGEST_MAX);
    if (state && !TERMINAL[stateOf(e)]) {
      if (state === 'expired' && stateOf(e) !== 'term') state = null;   // 只有有期诏令能由 AI 报到期
    } else {
      state = null;
    }
    if (state || (digest && !TERMINAL[stateOf(e)])) {
      var prev = e.efficacy || null;
      var next = Object.assign({}, prev, { judgedTurn: turn, judgedBy: 'ai' });
      if (state) next.state = state;
      if (state === 'term') {
        var untilTurn = untilTurnOf(issue, feedback.until);
        next.untilText = feedback.until == null ? '' : String(feedback.until);
        if (untilTurn != null) next.untilTurn = Math.max(issue, untilTurn); else delete next.untilTurn;
      }
      if (state === 'expired') { next.endedTurn = turn; next.endedReason = '期满（AI 判定）'; }
      if (digest) next.digest = digest;
      var history = list(prev && prev.history).slice(-9);
      if (prev && prev.state) history.push({ turn: turn, state: prev.state, untilTurn: prev.untilTurn, digest: prev.digest });
      next.history = history;
      e.efficacy = next;
      changes.push({ id: e.id, state: stateOf(e) });
    }
    // 撤销与替代只能由新下的诏令发起（本回合或上一回合登记，后者涵盖回合末朝议所下之诏），
    // 旧诏在追报进度时不能顺手废掉别的诏令；被废的须比它早（或同回合）且仍现行。
    if (issue < turn - 1) return changes;
    [['revokes', 'revoked'], ['supersedes', 'superseded']].forEach(function(pair) {
      idList(feedback[pair[0]]).forEach(function(targetId) {
        var target = list(gm._edictTracker).find(function(x) { return x && x.id === targetId; });
        if (!target || target === e || !isCurrent(target, turn)) return;
        if ((Number(target.turn) || 0) > issue) return;
        target.efficacy = Object.assign({}, target.efficacy, { state: pair[1], endedTurn: turn, endedBy: e.id, endedReason: pair[1] === 'revoked' ? '新诏废止' : '新诏取代' });
        changes.push({ id: target.id, state: pair[1], by: e.id });
      });
    });
    return changes;
  }

  function label(e) {
    var state = stateOf(e), until = e.efficacy && e.efficacy.untilTurn;
    if (state === 'term' && until) return '有期至T' + until;
    return STATES[state];
  }

  // 提示词段【现行诏制】。预算内给全文；超出预算的诏令只列要点（AI 写的 digest，没有则取开头），
  // 并注明未展开——宁可短，不可漏。opts.excludeTurn：本回合新诏已在「本回合诏令」段列出，不重复。
  var DEFAULT_MAX_CHARS = 6000;
  function promptSection(gm, opts) {
    opts = opts || {};
    var maxChars = Number(opts.maxChars) || DEFAULT_MAX_CHARS;
    var rows = current(gm).filter(function(e) { return opts.excludeTurn == null || e.turn !== opts.excludeTurn; });
    if (!rows.length) return '';
    var lines = [], compact = [], used = 0;
    rows.forEach(function(e) {
      var head = '  #id=' + e.id + ' 【' + label(e) + '·' + (e.category || '诏令') + '·T' + (e.turn || '?') + '下】';
      var digest = e.efficacy && e.efficacy.digest ? String(e.efficacy.digest) : '';
      var full = head + String(e.content).trim() + (digest ? '\n     要点：' + digest : '');
      if (used + full.length <= maxChars) {
        lines.push(full);
        used += full.length;
      } else {
        compact.push(head + (digest || String(e.content).trim().slice(0, 40) + '…'));
      }
    });
    var out = '\n【现行诏制——已颁行且至今仍作数的诏令（办结不等于废止）】\n';
    out += '  ※ 以下条文是本朝现行规则，推演须以此为准。NPC 可以阳奉阴违、执行走样乃至公然违抗，但须写明缘由与后果，不能当它不存在。\n';
    out += '  ※ 废止或修改须由玩家另下诏令；有期者到期自动失效。\n';
    out += lines.join('\n') + '\n';
    if (compact.length) {
      out += '  （另有 ' + compact.length + ' 道现行诏令篇幅所限未展开全文，只列要点；条文与要点冲突时以原诏为准）\n';
      out += compact.join('\n') + '\n';
    }
    return out;
  }

  // 提示词段：请 AI 判定效力。只在有待判定的诏令时输出。
  // 主推演在 edict_feedback 里一并判定；agent 模式传 opts.tool='judge_edict'，改为调用工具，
  // 并列出本回合新诏的编号（agent 只在玩家操作原文里见到新诏，没有追踪编号）。
  // opts.maxUnjudged：旧档初次接入时可能积压多道未判定的旧诏，每回合只点名最早的若干道，其余下回合再判。
  function feedbackGuide(gm, opts) {
    opts = opts || {};
    var turn = Number(gm && gm.turn) || 0;
    var fresh = list(gm && gm._edictTracker).filter(function(e) { return e && e.turn === turn && isCurrent(e, turn) && stateOf(e) === 'unjudged'; });
    var backlog = current(gm).filter(function(e) { return e.turn !== turn && stateOf(e) === 'unjudged'; });
    if (!fresh.length && !backlog.length) return '';
    var named = backlog.slice(0, Number(opts.maxUnjudged) || 8);
    var out = opts.tool ? '\n【诏令效力——用 ' + opts.tool + ' 工具判定】\n' : '\n【诏令效力——在 edict_feedback 中一并判定】\n';
    out += '  ※ 本回合新下的诏令' + (named.length ? '，以及以下尚未判定的旧诏（' + named.map(function(e) { return '#' + e.id; }).join('、') + '）' : '');
    out += opts.tool ? '，请逐道调用 ' + opts.tool + '（带 edictId），字段如下：\n' : '，请在对应 edict_feedback 条目中写明 edictId，并补这几个字段：\n';
    if (opts.tool && fresh.length) {
      out += fresh.map(function(e) { return '    本回合新诏 #id=' + e.id + ' 【' + (e.category || '诏令') + '】' + String(e.content).trim().slice(0, 40) + '…'; }).join('\n') + '\n';
    }
    out += '    efficacy：standing（常制，长期有效直至废止）/ term（有期）/ one_off（一次性，办完即了，如拨一笔款、召见一人、任免一人）\n';
    out += '    until：有期者填期限，如「三年」「十个月」「至T40」\n';
    out += '    digest：60 字内的要点，须保留数字、适用范围、例外与期限\n';
    out += '    revokes / supersedes：本诏明确废止或取代的旧诏 edictId（只可引用【现行诏制】中的编号；未明言废止的不要填）\n';
    out += '  ※ 执行状态 status 与效力是两回事：颁行办结照报 completed，常制与有期诏令仍然作数。\n';
    out += '  ※ 一道诏令兼有长期规则与一次性事务时，按其中的长期规则判定，要点只写长期部分。\n';
    return out;
  }

  // 每回合调用一次：
  //   1. 补齐缺失的编号（鸿雁登记的诏令没有 id，无法被反馈、判定或撤销引用）；
  //   2. 有期诏令期满转为已到期。
  function tick(gm) {
    var turn = Number(gm && gm.turn) || 0, changed = 0;
    list(gm && gm._edictTracker).forEach(function(e, i) {
      if (!e) return;
      if (!e.id) {
        e.id = 'edict_' + (Number(e.turn) || 0) + '_' + hash(String(e.content || '') + '|' + i);
        changed++;
      }
      if (isPastTerm(e, turn)) {
        e.efficacy = Object.assign({}, e.efficacy, { state: 'expired', endedTurn: turn, endedReason: '期满' });
        changed++;
      }
    });
    return changed;
  }

  TM.EdictEfficacy = {
    STATES: STATES,
    stateOf: stateOf,
    isCurrent: isCurrent,
    current: current,
    tick: tick,
    prune: prune,
    label: label,
    promptSection: promptSection,
    feedbackGuide: feedbackGuide,
    judge: judge,
    untilTurnOf: untilTurnOf,
    isSystemOneOff: isSystemOneOff
  };
})(typeof window !== 'undefined' ? window : globalThis);
