// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-edict-oversight.js — 诏令执行督查 agent（S1·核心模块·未接线）
//
// 替代写死的 `aiEdictEfficacyAudit`(tm-endturn-ai-helpers.js)。现状两块：
//   · aiEdictEfficacyAudit：每回合审一次·但**只审本回合新下的诏令**(rich：status/oppositionFaced/costPaid/efficacyByDimension…·已抓 ignored/delayed)。
//   · 旧诏(往回合下的·仍在 _edictTracker)：靠 `_guessEdictProgress`(tm-chronicle-tracker.js)**按经过时间猜进度**·非真评估。
// 缺口：一道 N 回合前的诏令正被持续架空·系统只会"按时间猜它该完成 X%"·没人真去看它是否被推翻。
//
// 本 agent 把"颁布≠见效"从**一回合快照**升级成**跨回合的持续摩擦**：每回合追踪**所有活诏令**·按结构化势力态
//   (执行者能力/反对派强度/贪腐)真评估每道活诏是在推进还是被架空·更新 _edictTracker(progress/status/_chainEffects/feedback)·
//   替掉时间猜。命门(见 [[tianming-top-level-vision]])"硬核可信"正中——政令有摩擦·下达很久后仍可能被悄悄推翻。
//
// 守铁律：后台(玩家不等·post-turn)·单跳不自主循环·开关默认关·aiEdictEfficacyAudit 兜底零回归·跨朝代中立(维度/分类皆通用词)。
// 向后兼容：仍写 GM._edictEfficacyReport(同形状·reports/efficacyByDimension/courtReaction/…)·故 buildEdictEfficacyFollowUp + sc1 御批回听注入零改仍工作。
//
// 接线(S2·已接·2026-07)：endturn(tm-endturn-pipeline-steps.js:504-508)已在 agentFlagOn('edictOversightEnabled') 真且 shouldHandle 时改调 TM.EdictOversight.run(GM)·否则回落 aiEdictEfficacyAudit(零回归)。开关现仅 LLM 升级总闸覆盖·无独立设置项。
// ============================================================

(function (global) {
  var TM = global.TM = global.TM || {};
  if (TM.EdictOversight) return;

  var FAIL_THRESHOLD = 2, RETRY_EVERY = 5;
  var DONE_STATUS = { executed: 1, done: 1, terminated: 1, failed: 1, abandoned: 1, completed: 1 };
  var _inflight = new WeakMap();

  function _dbg() { try { if (global.DebugLog && typeof global.DebugLog.log === 'function') global.DebugLog.log.apply(global.DebugLog, ['ai'].concat(Array.prototype.slice.call(arguments))); } catch (e) {} }
  function _now() { return (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0; }

  function _provenance(GM, type, turn, text, sourceItems) {
    try { if (TM.MemorySourceBound && typeof TM.MemorySourceBound.buildSummaryMetadata === 'function') return TM.MemorySourceBound.buildSummaryMetadata(GM, { type: type, turn: turn, turnRange: 'T' + turn, text: text || '', sourceItems: sourceItems || [], maxBasisRefs: 12 }) || {}; } catch (e) {}
    return {};
  }
  function _attachMeta(rec, meta) { if (!meta) return rec; ['id', 'sourceRefs', 'basisRefs', 'evidenceRefs', 'contentHash', 'authorityLevel', 'authorityRank', 'basisMaxAuthorityRank', 'factStatus', 'lane'].forEach(function (k) { if (meta[k] !== undefined) rec[k] = meta[k]; }); return rec; }
  function _logRun(GM, e) { try { if (!GM._edictOversightLog) GM._edictOversightLog = []; GM._edictOversightLog.push(e); if (GM._edictOversightLog.length > 20) GM._edictOversightLog = GM._edictOversightLog.slice(-20); } catch (x) {} }

  // ── 活诏令：从 _edictTracker 收所有未了结的(跨回合)·cap 防 prompt 膨胀 ──
  function activeEdicts(GM) {
    GM = GM || global.GM;
    var tracker = (GM && GM._edictTracker) || [];
    var turn = (GM && GM.turn) || 0;
    var out = [];
    tracker.forEach(function (e, i) {
      if (!e || !e.content) return;
      if (e._reliefCaseId && TM.ReliefGovernance) {
        var rv = TM.ReliefGovernance.view(GM, e._reliefCaseId);
        if (rv && rv.status !== 'completed' && rv.status !== 'cancelled' && TM.ReliefGovernance.enabled(GM)) {
          out.push({ oid: e.id, _idx: i, category: '赈务', content: String(e.content).slice(0, 120),
            issuedTurn: e.turn || 0, age: turn - (e.turn || 0), status: rv.status, progress: 0,
            assignee: rv.assigneeName, relief: TM.ReliefGovernance.capture(GM, e._reliefCaseId) });
        }
        return;
      }
      var st = String(e.status || 'pending').toLowerCase();
      if (DONE_STATUS[st]) return;                       // 已了结的不追
      if ((e.progressPercent || 0) >= 100) return;
      if (e.turn && turn - e.turn > 24) return;          // 太老的(>24回合)弃追·防无限累积
      out.push({
        oid: 'e' + i, _idx: i, category: e.category || '', content: String(e.content).slice(0, 120),
        issuedTurn: e.turn || 0, age: e.turn ? (turn - e.turn) : 0, status: st,
        progress: e.progressPercent || 0, assignee: e.assignee || '',
        lastFeedback: String(e.feedback || '').slice(0, 80),
        chainTail: (Array.isArray(e._chainEffects) ? e._chainEffects.slice(-2).map(function (c) { return (c && (c.effect || c)) || ''; }).join('；') : '')
      });
    });
    var relief = out.filter(function(a) { return !!a.relief; }).sort(function(a,b) {
      return (a.relief.view.lastAssessedTurn || -1) - (b.relief.view.lastAssessedTurn || -1);
    }).slice(0, 3);
    return relief.concat(out.filter(function(a) { return !a.relief; }).slice(0, 15 - relief.length));
  }

  // ── 结构化摩擦态(ground truth)：势力强度/对玩家关系 + 贪腐·让 agent 据真态判架空·而非凭叙事 ──
  function _frictionContext(GM) {
    var lines = [];
    var facs = (GM && GM.facs) || [];
    facs.slice(0, 12).forEach(function (f) {
      if (!f || !f.name) return;
      var s = f.name + '·力' + (f.strength != null ? f.strength : '?');
      if (f.playerRelation != null) s += '·对君' + f.playerRelation;
      lines.push(s);
    });
    var corr = null;
    try { if (GM.vars && GM.vars.corruption != null) corr = Math.round(GM.vars.corruption.value != null ? GM.vars.corruption.value : GM.vars.corruption); } catch (e) {}
    return { factions: lines, corruption: corr };
  }

  function buildRequest(GM, active, opts) {
    var turn = (GM && GM.turn) || 0;
    var p1 = (GM._turnAiResults && GM._turnAiResults.subcall1) || {};
    var fc = _frictionContext(GM);
    var prev = (Array.isArray(GM._edictEfficacyHistory) && GM._edictEfficacyHistory.length) ? GM._edictEfficacyHistory[GM._edictEfficacyHistory.length - 1] : null;
    // 本回合执行证据
    var ev = '';
    if (p1.shizhengji) ev += '时政记：' + String(p1.shizhengji).slice(0, 900) + '\n';
    if (Array.isArray(p1.faction_events) && p1.faction_events.length) ev += '势力动作：' + p1.faction_events.slice(0, 8).map(function (e) { return (e.actor || '') + (e.action || '') + (e.result ? '→' + e.result : ''); }).join('；') + '\n';
    if (Array.isArray(p1.var_changes) && p1.var_changes.length) ev += '数值变动：' + p1.var_changes.slice(0, 15).map(function (v) { return (v.name || v.path || '?') + (v.delta != null ? (v.delta > 0 ? '+' : '') + v.delta : ''); }).join('·') + '\n';
    if (Array.isArray(p1.personnel_changes || p1.personnelChanges)) { var pc = p1.personnel_changes || p1.personnelChanges; if (pc.length) ev += '人事：' + pc.slice(0, 10).map(function (p) { return (p.name || p.char || '?') + (p.action || p.change || ''); }).join('；') + '\n'; }
    if (!ev && opts && opts.evidence) ev = String(opts.evidence).slice(0, 1200);  // agent 模式无 subcall1·用本回合推演实绩(史记/守护写流水)作执行证据(LLM 模式有 p1·此回落不触发·零影响)

    var sys = '你是御前督查·代陛下核查诏令的**跨回合执行**。不只看本回合新诏·更要盯**往回合下达、仍在执行中的旧诏**是否在推进、还是被悄悄架空/拖延。'
      + '据「结构化势力态」(势力强度/对君关系/贪腐)判断真实摩擦·而非只凭叙事。诚实·政令本就有阻力·"颁布≠见效"。仅返回 JSON。';
    var u = '【回合】T' + turn + '\n\n【在办诏令(含旧诏·按 oid 列)】\n';
    active.forEach(function (a) {
      u += '· ' + a.oid + '｜' + (a.category ? '[' + a.category + ']' : '') + a.content + '｜下达 T' + a.issuedTurn + '(已 ' + a.age + ' 回合)·当前进度' + a.progress + '%·状态' + a.status + (a.assignee ? '·承办:' + a.assignee : '') + (a.lastFeedback ? '·前况:' + a.lastFeedback : '') + (a.chainTail ? '·近况:' + a.chainTail : '') + '\n';
      if (a.relief) u += '【赈务真态】' + TM.ReliefGovernance.prompt(GM, a.relief.issueId) + '\n';
    });
    u += '\n【本回合执行证据(主推演)】\n' + (ev || '(无显著)') + '\n';
    u += '【结构化势力态】' + (fc.factions.join(' / ') || '(无)') + (fc.corruption != null ? '·贪腐' + fc.corruption : '') + '\n';
    if (prev) u += '【上回合整体效力】' + (prev.overallEfficacy != null ? prev.overallEfficacy + '%' : '?') + '\n';
    u += '\n返回 JSON·\n{'
      + '"reports":[{"oid":"在办诏令 oid","executionLevel":0-100(累计进度·据本回合真实推进更新·被架空则下调或停滞),"progressDelta":本回合变化(+/-数字),'
      + '"status":"executing|partial|stalled|sabotaged|ignored|done","sabotageBy":"若停滞/被架空·指出具体阻力主体(某势力/承办者怠政/贪腐)·否则空",'
      + '"evidence":"引用证据(叙事/势力动作/数值)","reason":"为何这样(阁阻/能力不足/前提缺/贪腐/时机)","chainEffect":"本回合这道诏令的一句生命周期事件(进 _chainEffects)","nextAdvice":"下回合玩家应如何催办"}],'
      + '"efficacyByDimension":{"military":0-100,"fiscal":0-100,"personnel":0-100,"diplomatic":0-100,"popular":0-100,"authority":0-100},'
      + '"courtReaction":{"clearFaction":"清流派评价(30字)","eunuchFaction":"当权派评价(30字)","neutralFaction":"观望派评价(30字)"},'
      + '"popularReaction":"民间回响(40字)","strategicInsight":"长期战略洞见+隐忧/机会(60字)","overallEfficacy":0-100,"topPriority":"下回合优先催办 1-2 件"}\n'
      + '准则：oid 必来自上面在办列表·sabotageBy 指具体主体非"有人"·executionLevel 据本回合真实推进更新(被架空可下调)·只输出 JSON。';
    if (active.some(function(a) { return !!a.relief; })) {
      u += '\n【赈务试点·独占执行权】这些赈务的钱款已由正式账本筹集，其他推演不得再次扣款或奖励民心。'
        + '对标有赈务真态的 oid，忽略通用进度百分比，必须在该 report 附 relief 对象：'
        + '{"caseId":"原案号","revision":原修订号,"action":"wait|blocked|disburse|complete","amount":本次发放数字,'
        + '"minxinDelta":本次民心变化(-5至5，须有实效或逾期失信依据),"reason":"基于人物、灾情、已执行记录的裁决依据",'
        + '"officialReport":"承办人呈报(不是独立核验事实)","nextAdvice":"下一步可做什么","findings":"若被要求核查，说明依据和不确定性","consequence":"后续影响"}。'
        + 'AI负责推演承办行动与政治后果，不是固定随机成功率；钱款发放须有正数 elapsedDays、在世承办人、真实灾地，amount 不超过 remaining。'
        + '资金不足时等待/请求追加或分期；wait/blocked 不得发放钱款。正向民心须有本次发放或结案，累计奖励上限=5×累计发放/预算，扣除rewardApplied；'
        + '逾期失信或结案实效不佳可提议负向民心，累计惩罚上限5，扣除penaltyApplied；没有根据时填0。'
        + 'complete 仅在累计发放达到已批准预算时使用；不得修改预算、灾地、承办人或已有付款。'
        + '核查信息不足应说明不足，不得把通信或技术错误编作官员欺瞒。理由、建议各不超过100字。';
    }
    return { system: sys, user: u, turn: turn };
  }

  // ── 写回：更新 _edictTracker 每道活诏(跨回合) + _edictEfficacyReport(兼容形状) + 历史 + provenance ──
  function applyOversight(GM, active, parsed, opts) {
    GM = GM || global.GM;
    if (!GM || !parsed) return { applied: false };
    var turn = GM.turn || 0;
    var byOid = {}; active.forEach(function (a) { byOid[a.oid] = a; });
    var updated = 0, sabotaged = 0;
    var reports = Array.isArray(parsed.reports) ? parsed.reports.slice(0, 20) : [];
    reports.forEach(function (r) {
      if (!r || !r.oid) return;
      var a = byOid[r.oid]; if (!a) return;
      if (a.relief) {
        var proposal = r.relief;
        var result = proposal && proposal.caseId === a.relief.issueId && proposal.revision === a.relief.revision
          ? TM.ReliefGovernance.applyAssessment(GM, a.relief, proposal, { ownedTurn: !!(opts && opts.ownedTurn) }) : { ok: false, code: 'relief-response-identity-invalid' };
        r._reliefAccepted = result.ok === true;
        r._reliefError = result.ok === true ? '' : result.code;
        if (result.ok) {
          updated++;
          var appliedView = TM.ReliefGovernance.view(GM, a.relief.issueId);
          r.status = appliedView.status === 'completed' ? 'done' : appliedView.status;
          r.executionLevel = appliedView.budget ? appliedView.disbursed / appliedView.budget * 100 : 0;
          r.reason = appliedView.lastReason;
        } else {
          TM.ReliefGovernance.noteFailure(GM, a.relief, '本次执行回应未通过校验：' + result.code);
          r.status = 'validation_failed'; r.executionLevel = 0;
          r.reason = '本次回应未落地：' + result.code;
        }
        r.sabotageBy = ''; // Unsupported generic accusations are not case execution facts.
        return;
      }
      var entry = GM._edictTracker && GM._edictTracker[a._idx]; if (!entry) return;
      // 更新跨回合生命周期(真评估·替时间猜)
      if (typeof r.executionLevel === 'number') entry.progressPercent = Math.max(0, Math.min(100, r.executionLevel));
      if (r.status) entry.status = String(r.status);
      if (r.reason || r.evidence) entry.feedback = String(r.reason || r.evidence || '').slice(0, 120);
      if (r.chainEffect) { if (!Array.isArray(entry._chainEffects)) entry._chainEffects = []; entry._chainEffects.push({ turn: turn, effect: String(r.chainEffect).slice(0, 100), by: r.sabotageBy || '' }); if (entry._chainEffects.length > 12) entry._chainEffects = entry._chainEffects.slice(-12); }
      if ((entry.progressPercent || 0) >= 100 && !DONE_STATUS[String(entry.status).toLowerCase()]) entry.status = 'executed';
      if (r.sabotageBy && (r.status === 'stalled' || r.status === 'sabotaged')) sabotaged++;
      updated++;
    });
    active.forEach(function(a) {
      if (a.relief && !reports.some(function(r) { return r && r.oid === a.oid; })) {
        TM.ReliefGovernance.noteFailure(GM, a.relief, '本次执行核查回应遗漏本案');
      }
    });
    // 兼容形状的效力报告(沿用 aiEdictEfficacyAudit 字段·现有 buildEdictEfficacyFollowUp/御批回听 零改可读)
    var rep = {
      turn: turn, total: active.length, reports: reports,
      overallEfficacy: typeof parsed.overallEfficacy === 'number' ? parsed.overallEfficacy : 50,
      efficacyByDimension: (parsed.efficacyByDimension && typeof parsed.efficacyByDimension === 'object') ? parsed.efficacyByDimension : null,
      courtReaction: (parsed.courtReaction && typeof parsed.courtReaction === 'object') ? parsed.courtReaction : null,
      popularReaction: parsed.popularReaction || '', strategicInsight: parsed.strategicInsight || '',
      topPriority: parsed.topPriority || '', sabotagedCount: sabotaged, _crossTurn: true, generatedAt: _now()
    };
    _attachMeta(rep, _provenance(GM, 'edictOversight', turn, parsed.strategicInsight || parsed.topPriority || '', active.map(function (a) { return { sourceType: '_edictTracker', turn: a.issuedTurn, content: a.content }; })));
    GM._edictEfficacyReport = rep;
    if (!GM._edictEfficacyHistory) GM._edictEfficacyHistory = [];
    GM._edictEfficacyHistory.push({ turn: turn, overallEfficacy: rep.overallEfficacy, efficacyByDimension: rep.efficacyByDimension, sabotagedCount: sabotaged });
    if (GM._edictEfficacyHistory.length > 20) GM._edictEfficacyHistory = GM._edictEfficacyHistory.slice(-20);
    return { applied: true, updated: updated, sabotaged: sabotaged };
  }

  function shouldHandle(GM) {
    GM = GM || global.GM;
    if (!GM) return false;
    var on = (typeof global.agentFlagOn === 'function') ? global.agentFlagOn('edictOversightEnabled') : !!((global.P && global.P.ai && global.P.ai.edictOversightEnabled) || (global.P && global.P.conf && global.P.conf.edictOversightEnabled));
    if (!(on && TM.EdictOversight) && !(TM.ReliefGovernance && TM.ReliefGovernance.active(GM).length)) return false;
    var turn = GM.turn || 0;
    if (GM._edictOversightDecision && GM._edictOversightDecision.turn === turn) return GM._edictOversightDecision.active;
    var streak = GM._edictOversightFailStreak || 0;
    var active = (streak < FAIL_THRESHOLD) || (turn % RETRY_EVERY === 0);
    GM._edictOversightDecision = { turn: turn, active: active };
    return active;
  }

  async function runOnce(GM, opts) {
    opts = opts || {};
    GM = GM || global.GM;
    if (!GM) return { skipped: 'noGM' };
    var P = global.P || {};
    if (!P.ai || !P.ai.key) return { skipped: 'noKey' };
    var active = activeEdicts(GM);
    var reliefRun = active.some(function(a) { return !!a.relief; });
    var lease = typeof global._tmCaptureWorldLease === 'function' ? global._tmCaptureWorldLease() : null;
    var identity = { p: global.P, campaign: GM._campaignId, timeline: GM._timelineId, loadGen: global._tmLoadGen || 0, turn: GM.turn };
    function isCurrent() {
      return !reliefRun || (!(opts.signal && opts.signal.aborted) && global.GM === GM && global.P === identity.p && GM._campaignId === identity.campaign &&
        GM._timelineId === identity.timeline && (global._tmLoadGen || 0) === identity.loadGen && GM.turn === identity.turn &&
        (!lease || global._tmWorldLeaseCurrent(lease)));
    }
    function reliefFailure(reason) {
      active.forEach(function(a) { if (a.relief) TM.ReliefGovernance.noteFailure(GM, a.relief, reason); });
    }
    if (!active.length) { GM._edictEfficacyReport = { turn: GM.turn || 0, total: 0, skipped: true }; return { skipped: 'noActiveEdicts', turn: GM.turn || 0 }; }
    if (typeof global.callAIMessages !== 'function') return { skipped: 'noCaller' };
    var req = buildRequest(GM, active, opts);
    _dbg('[EdictOversight] run T' + req.turn + ' active=' + active.length);
    var raw;
    try {
      raw = await global.callAIMessages([{ role: 'system', content: req.system }, { role: 'user', content: req.user }], opts.maxTok || 3000, opts.signal || null, opts.tier || 'primary', { priority: 'background', timeoutMs: opts.timeoutMs || 60000, maxRetries: 1, id: 'edict_oversight' });
    } catch (e) {
      if (!isCurrent()) return { stale: true };
      reliefFailure('执行核查请求未完成');
      GM._edictOversightFailStreak = (GM._edictOversightFailStreak || 0) + 1;
      _logRun(GM, { turn: req.turn, failed: true, reason: 'call', error: String(e && e.message || e), streak: GM._edictOversightFailStreak, ts: _now() });
      return { failed: true, error: String(e && e.message || e), streak: GM._edictOversightFailStreak };
    }
    if (!isCurrent()) return { stale: true };
    var parsed = null;
    try { parsed = (typeof global.extractJSON === 'function') ? global.extractJSON(raw) : JSON.parse(raw); } catch (e) {}
    if (!parsed || !Array.isArray(parsed.reports)) {
      reliefFailure('执行核查回应格式无效');
      GM._edictOversightFailStreak = (GM._edictOversightFailStreak || 0) + 1;
      _logRun(GM, { turn: req.turn, failed: true, reason: 'parse', streak: GM._edictOversightFailStreak, ts: _now() });
      return { failed: true, error: 'parse', streak: GM._edictOversightFailStreak };
    }
    GM._edictOversightFailStreak = 0;
    var res = applyOversight(GM, active, parsed, opts);
    if (reliefRun && res.updated && typeof global.requestBackgroundAutosave === 'function') {
      global.requestBackgroundAutosave({ reason: 'relief-adjudication', expectedWorldLease: lease || undefined });
    }
    var entry = { turn: req.turn, active: active.length, updated: res.updated, sabotaged: res.sabotaged, overallEfficacy: GM._edictEfficacyReport.overallEfficacy, provenance: !!(TM.MemorySourceBound && TM.MemorySourceBound.buildSummaryMetadata), calls: 1, ts: _now() };
    _logRun(GM, entry);
    _dbg('[EdictOversight] updated=' + res.updated + ' sabotaged=' + res.sabotaged + ' eff=' + GM._edictEfficacyReport.overallEfficacy);
    return { ok: true, turn: req.turn, active: active.length, updated: res.updated, sabotaged: res.sabotaged };
  }

  function lastRun(GM) { GM = GM || global.GM; var l = GM && GM._edictOversightLog; return (l && l.length) ? l[l.length - 1] : null; }

  function run(GM, opts) {
    GM = GM || global.GM;
    if (!GM) return Promise.resolve({ skipped: 'noGM' });
    if (_inflight.has(GM)) return _inflight.get(GM);
    var promise = runOnce(GM, opts).finally(function() { if (_inflight.get(GM) === promise) _inflight.delete(GM); });
    _inflight.set(GM, promise);
    return promise;
  }

  TM.EdictOversight = {
    run: run, shouldHandle: shouldHandle, activeEdicts: activeEdicts,
    buildRequest: buildRequest, applyOversight: applyOversight, lastRun: lastRun
  };
})(typeof window !== 'undefined' ? window : globalThis);
