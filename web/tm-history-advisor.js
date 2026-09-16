// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-history-advisor.js — 史实顾问 agent（S1·核心模块·未接线）
//
// 替代写死的历史检查 `_doHistCheck`(tm-endturn-core.js 钩子9·post-turn job `hist_check`)。
// 现状(一手核实)：该 hook **已经**是「现实顾问」——已按 P.conf.gameMode 门控(yanyi 演义直接 return·仅 light_hist/strict_hist 跑)·
//   已识别玩家偏离史实逻辑+预测现实反噬·写 GM._historicalDeviations(ttl 1-3)→下回合 `historical-deviations` fragment 注入 sc1→AI 自然演出后果(闭环)。
// **唯一缺口**：反噬预测纯靠模型脑内知识·**不查史料、不引证**·可能编假"史实"当参照。
//
// 本 agent 给现有顾问加「查证+引证」：拉真实史料源(严格模式 P.conf.refText + 剧本时代/角色 + 本局已发生史记)·
//   逼每条偏离**引证真实先例(precedent)**再判后果·把"现实必然反噬"从 vibes 升级成有据可查。命门(见 [[tianming-top-level-vision]])硬核可信正中·平行宇宙=对照真实史轨。
//   诚实：严格模式能锚 refText(真料)；轻度模式仍靠模型知识(引证但难核验·仍胜过现状不要求引证)。
//
// 守铁律：后台(玩家不等·post-turn job)·单跳不自主循环·**仅 light_hist/strict_hist 模式**(owner 约束·复用现有门控)+开关默认关·hist_check 兜底零回归·跨朝代中立(读 sc.era/role·不写死单朝)。
// 向后兼容：仍写 GM._historicalDeviations(同形状·sourceTurn/playerAction/historicalContext/realisticConsequence/ttl)·precedent 折进 historicalContext 显示→现有 fragment 注入零改。
//
// 接线(S2·未做)：core.js `_doHistCheck` 在 shouldHandle(GM) 真时改调 TM.HistoryAdvisor.run(GM, snapshotCtx)。
// ============================================================

(function (global) {
  var TM = global.TM = global.TM || {};
  if (TM.HistoryAdvisor) return;

  var FAIL_THRESHOLD = 2, RETRY_EVERY = 5;

  function _dbg() { try { if (global.DebugLog && typeof global.DebugLog.log === 'function') global.DebugLog.log.apply(global.DebugLog, ['ai'].concat(Array.prototype.slice.call(arguments))); } catch (e) {} }
  function _now() { return (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0; }

  function _provenance(GM, type, turn, text, sourceItems) {
    try { if (TM.MemorySourceBound && typeof TM.MemorySourceBound.buildSummaryMetadata === 'function') return TM.MemorySourceBound.buildSummaryMetadata(GM, { type: type, turn: turn, turnRange: 'T' + turn, text: text || '', sourceItems: sourceItems || [], maxBasisRefs: 8 }) || {}; } catch (e) {}
    return {};
  }
  function _attachMeta(rec, meta) { if (!meta) return rec; ['id', 'sourceRefs', 'basisRefs', 'evidenceRefs', 'contentHash', 'authorityLevel', 'authorityRank', 'basisMaxAuthorityRank', 'factStatus', 'lane'].forEach(function (k) { if (meta[k] !== undefined) rec[k] = meta[k]; }); return rec; }
  function _logRun(GM, e) { try { if (!GM._historyAdvisorLog) GM._historyAdvisorLog = []; GM._historyAdvisorLog.push(e); if (GM._historyAdvisorLog.length > 20) GM._historyAdvisorLog = GM._historyAdvisorLog.slice(-20); } catch (x) {} }

  function _mode(GM) { var P = global.P || {}; return (P.conf && P.conf.gameMode) || 'yanyi'; }

  // 从 GM 兜底补全快照 ctx(snapshot 优先·call site 传入·避免后台 fire 时 shijiHistory 已改)
  function _ctxFrom(GM, ctx) {
    ctx = ctx || {};
    var P = global.P || {};
    var sc = null;
    try { if (typeof global.findScenarioById === 'function') sc = global.findScenarioById(GM.sid); } catch (e) {}
    var last = (GM.shijiHistory && GM.shijiHistory.length) ? GM.shijiHistory[GM.shijiHistory.length - 1] : null;
    var edictText = ctx.edictText;
    if (edictText == null && last && last.edicts) {
      var eL = []; var ed = last.edicts;
      ['decree', 'political', 'military', 'diplomatic', 'economic', 'other'].forEach(function (k) { if (ed[k]) eL.push(k + ':' + ed[k]); });
      edictText = eL.join('\n  ') || '（无明确诏令）';
    }
    return {
      edictText: edictText || '（无明确诏令）',
      narrative: ctx.narrative != null ? ctx.narrative : (last ? (last.zhengwen || last.shizhengji || '') : ''),
      turn: ctx.turn != null ? ctx.turn : ((GM.turn || 1) - 1),
      mode: ctx.mode || _mode(GM),
      refText: ctx.refText != null ? ctx.refText : ((P.conf && P.conf.refText) || ''),
      era: ctx.era != null ? ctx.era : (sc ? (sc.era || '') : ''),
      role: ctx.role != null ? ctx.role : (sc ? (sc.role || '') : '')
    };
  }

  // 本局已发生史记(给"对照真实史轨"做局内锚)·近 N 回合
  function _recentHistory(GM) {
    var sh = (GM && GM.shijiHistory) || [];
    return sh.slice(-4).map(function (s) { return 'T' + (s.turn || '?') + '：' + String(s.shizhengji || s.zhengwen || '').replace(/\s+/g, ' ').slice(0, 180); }).join('\n');
  }

  function buildRequest(GM, c) {
    var strict = c.mode === 'strict_hist';
    var sys = '你是史实顾问·剧本：' + (c.era || '') + '·' + (c.role || '') + '。识别玩家本回合诏令/行为里与该时代历史逻辑相悖之处·并预测现实必然的反噬。'
      + '【铁律】①不修改玩家任何决定(玩家有权选择)·你只供"下回合让 AI 自然演绎后果"·②**每条偏离必须引证一个真实历史先例(precedent)**——史上谁/何时类似之举、结果如何·据此判反噬·**严禁编造史实**·拿不准就说"史无明确先例"而非杜撰·'
      + (strict ? '③严格史实模式·尽量锚定下方【时代参考资料】·引证须与之相合·' : '③轻度史实模式·允许据通史常识引证·但仍须真实可考·')
      + '④反噬具体到主体(哪朝臣/党派/外族/阶层)与方式(弹劾/兵变/民变/叛盟/物议/经济失序/瘟疫)·现实合理>戏剧夸张·烈度匹配偏离程度。仅返回 JSON。';
    // historical-agency-v21
    var agency = global.TM && global.TM.HistoricalAgency;
    if (agency && agency.isPlayerDriven()) sys = agency.advisorInstruction();
    var u = '【T' + c.turn + ' 玩家诏令原文】\n  ' + c.edictText + '\n\n';
    if (c.narrative) u += '【本回合推演叙事节选】\n' + String(c.narrative).slice(0, 1600) + '\n\n';
    var rh = _recentHistory(GM);
    if (rh) u += '【本局已发生(供对照本局史轨偏离)】\n' + rh + '\n\n';
    if (strict && c.refText) u += '【时代参考资料(引证须合此)】\n' + String(c.refText).slice(0, 1500) + '\n\n';
    u += '返回 JSON·\n{"deviations":[{'
      + '"playerAction":"玩家具体哪条诏令/行为(原文摘录·30字)",'
      + '"historicalContext":"为何不合该时代逻辑(具体到制度/惯例/势力格局·40字)",'
      + '"precedent":"引证的真实历史先例(史上谁/何时类似之举→结果如何·50字·拿不准则\\"史无明确先例\\")",'
      + '"realisticConsequence":"现实中朝堂/民间/外族应如何反应·涉哪些具体主体·何种方式·烈度(50字)",'
      + '"manifestIn":1-3}]}·若完全合史 deviations 返回空数组[]·不硬找。';
    if (agency && agency.isPlayerDriven()) u = u.replace('若完全合史 deviations 返回空数组[]·不硬找。', '当前条件允许且无额外后果则返回空数组；不同于原史本身不是错误。');
    return { system: sys, user: u, turn: c.turn };
  }

  function applyDeviations(GM, parsed, turn) {
    GM = GM || global.GM;
    if (!GM || !parsed || !Array.isArray(parsed.deviations)) return { applied: 0 };
    if (!GM._historicalDeviations) GM._historicalDeviations = [];
    var added = 0, cited = 0;
    parsed.deviations.slice(0, 6).forEach(function (d) {
      if (!d || !d.playerAction || !d.realisticConsequence) return;
      var prec = String(d.precedent || '').slice(0, 90);
      var ctxText = String(d.historicalContext || '').slice(0, 100);
      // precedent 折进 historicalContext 显示→现有 fragment 注入零改即可见引证
      var hc = ctxText + (prec ? '·史载先例：' + prec : '');
      var rec = {
        sourceTurn: turn,
        playerAction: String(d.playerAction).slice(0, 80),
        historicalContext: hc.slice(0, 180),
        precedent: prec,
        realisticConsequence: String(d.realisticConsequence).slice(0, 150),
        ttl: Math.max(1, Math.min(3, parseInt(d.manifestIn, 10) || 2)),
        _grounded: true
      };
      _attachMeta(rec, _provenance(GM, 'historyAdvisor', turn, rec.playerAction + '·' + prec, []));
      GM._historicalDeviations.push(rec);
      added++; if (prec && prec.indexOf('史无明确先例') < 0) cited++;
    });
    if (GM._historicalDeviations.length > 12) GM._historicalDeviations = GM._historicalDeviations.slice(-12);
    return { applied: added, cited: cited };
  }

  function shouldHandle(GM) {
    GM = GM || global.GM;
    if (!GM) return false;
    if (_mode(GM) === 'yanyi') return false; // owner 约束：仅 light_hist/strict_hist
    var on = (typeof global.agentFlagOn === 'function') ? global.agentFlagOn('historyAdvisorEnabled') : !!((global.P && global.P.ai && global.P.ai.historyAdvisorEnabled) || (global.P && global.P.conf && global.P.conf.historyAdvisorEnabled));
    if (!(on && TM.HistoryAdvisor)) return false;
    var turn = GM.turn || 0;
    if (GM._historyAdvisorDecision && GM._historyAdvisorDecision.turn === turn) return GM._historyAdvisorDecision.active;
    var streak = GM._historyAdvisorFailStreak || 0;
    var active = (streak < FAIL_THRESHOLD) || (turn % RETRY_EVERY === 0);
    GM._historyAdvisorDecision = { turn: turn, active: active };
    return active;
  }

  async function run(GM, ctx) {
    GM = GM || global.GM;
    if (!GM) return { skipped: 'noGM' };
    var P = global.P || {};
    if (!P.ai || !P.ai.key) return { skipped: 'noKey' };
    if (_mode(GM) === 'yanyi') return { skipped: 'yanyiMode' };
    var c = _ctxFrom(GM, ctx);
    if (typeof global.callAIMessages !== 'function') return { skipped: 'noCaller' };
    var req = buildRequest(GM, c);
    _dbg('[HistoryAdvisor] run T' + req.turn + ' mode=' + c.mode);
    var raw;
    try {
      raw = await global.callAIMessages([{ role: 'system', content: req.system }, { role: 'user', content: req.user }], (ctx && ctx.maxTok) || 1800, (ctx && ctx.signal) || null, (ctx && ctx.tier) || 'primary', { priority: 'background', timeoutMs: (ctx && ctx.timeoutMs) || 60000, maxRetries: 1, id: 'history_advisor' });
    } catch (e) {
      GM._historyAdvisorFailStreak = (GM._historyAdvisorFailStreak || 0) + 1;
      _logRun(GM, { turn: req.turn, failed: true, reason: 'call', error: String(e && e.message || e), streak: GM._historyAdvisorFailStreak, ts: _now() });
      return { failed: true, error: String(e && e.message || e), streak: GM._historyAdvisorFailStreak };
    }
    var parsed = null;
    try { parsed = (typeof global.extractJSON === 'function') ? global.extractJSON(raw) : JSON.parse(raw); } catch (e) {}
    if (!parsed || !Array.isArray(parsed.deviations)) {
      GM._historyAdvisorFailStreak = (GM._historyAdvisorFailStreak || 0) + 1;
      _logRun(GM, { turn: req.turn, failed: true, reason: 'parse', streak: GM._historyAdvisorFailStreak, ts: _now() });
      return { failed: true, error: 'parse', streak: GM._historyAdvisorFailStreak };
    }
    GM._historyAdvisorFailStreak = 0;
    var res = applyDeviations(GM, parsed, c.turn);
    if (res.applied > 0 && typeof global.addEB === 'function') { try { global.addEB('史实预警', res.applied + ' 条偏离·' + res.cited + ' 条有据·后果将在 1-3 回合内显现'); } catch (x) {} }
    _logRun(GM, { turn: req.turn, mode: c.mode, deviations: res.applied, cited: res.cited, provenance: !!(TM.MemorySourceBound && TM.MemorySourceBound.buildSummaryMetadata), calls: 1, ts: _now() });
    _dbg('[HistoryAdvisor] deviations=' + res.applied + ' cited=' + res.cited);
    return { ok: true, turn: req.turn, deviations: res.applied, cited: res.cited };
  }

  function lastRun(GM) { GM = GM || global.GM; var l = GM && GM._historyAdvisorLog; return (l && l.length) ? l[l.length - 1] : null; }

  TM.HistoryAdvisor = {
    run: run, shouldHandle: shouldHandle, buildRequest: buildRequest, applyDeviations: applyDeviations,
    _ctxFrom: _ctxFrom, lastRun: lastRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
