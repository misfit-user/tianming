// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-followup.js - endturn AI follow-up subcalls
//
// Phase 7 P7-zeta (2026-05-05, Codex).
// Extracted from tm-endturn-ai-infer.js section 5.
// Refactor-only: preserves subcall prompts, queue order, and branch topology.
// Exports: TM.Endturn.AI.followup.run(ctx).
// ============================================================
(function(global) {
  if (typeof global.TM === "undefined") global.TM = {};
  if (typeof global.TM.Endturn === "undefined") global.TM.Endturn = {};
  if (typeof global.TM.Endturn.AI === "undefined") global.TM.Endturn.AI = {};
  if (typeof global.TM.Endturn.AI.followup === "undefined") global.TM.Endturn.AI.followup = {};

  var ns = global.TM.Endturn.AI.followup;

  function ensureGroups(ctx) {
    ctx.input = ctx.input || {};
    ctx.prompt = ctx.prompt || {};
    ctx.subcalls = ctx.subcalls || {};
    ctx.results = ctx.results || {};
    ctx.apply = ctx.apply || {};
    ctx.apply.applied = ctx.apply.applied || { chars: null, factions: null, offices: null, fiscal: null, admin: null, events: null, harem: null };
    ctx.followup = ctx.followup || {};
    ctx.followup._changeSummary = Array.isArray(ctx.followup._changeSummary) ? ctx.followup._changeSummary : [];
    ctx.record = ctx.record || {};
    ctx.meta = ctx.meta || { errors: [], warnings: [], timing: {}, retries: {} };
    ctx.meta.timing = ctx.meta.timing || {};
    return ctx;
  }

  function _tmFirstText() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  }

  function _tmPickHouren(p2, raw) {
    var text = "";
    if (p2 && typeof p2 === "object") {
      text = _tmFirstText(
        p2.houren_xishuo,
        p2.hourenXishuo,
        p2.houren,
        p2.zhengwen,
        p2.text,
        p2.content,
        p2.narrative,
        p2.story
      );
      if (text) return text;
    }
    text = _tmFirstText(raw);
    if (!text) return "";
    if (p2 && /^\s*[\{\[]/.test(text)) return "";
    return text;
  }

  function _tmXmlText(v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function _tmHiddenMoveForMemory(h) {
    var actor = "";
    var text = "";
    if (typeof h === "string") {
      text = h.trim();
      var m = text.match(/^([^:：]{1,16})[:：]/);
      actor = m ? m[1].trim() : "";
    } else if (h && typeof h === "object") {
      actor = _tmFirstText(h.char, h.name, h.actor, h.schemer);
      text = _tmFirstText(h.action, h.move, h.text, h.content, h.plan, h.summary);
    }
    return { actor: actor, text: text };
  }

  function _tmNormFactionName(v) {
    return String(v == null ? "" : v).replace(/\s+/g, "").trim();
  }

  function _tmPlayerFactionNameList(v) {
    var raw = Array.isArray(v) ? v : [v];
    var out = [];
    raw.forEach(function(x) {
      var s = String(x == null ? "" : x).trim();
      var k = _tmNormFactionName(s);
      if (s && out.map(_tmNormFactionName).indexOf(k) < 0) out.push(s);
    });
    return out;
  }

  function _tmIsMarkedPlayerFaction(f) {
    return !!(f && (f.isPlayer || f.playerControlled || f.controlledBy === "player" || f.controller === "player" || f.controlType === "player"));
  }

  function _tmResolvePlayerFactionNamesForAi(G, P0) {
    G = G || global.GM || {};
    P0 = P0 || global.P || {};
    var names = [];
    function push(v) {
      var s = String(v == null ? "" : v).trim();
      var k = _tmNormFactionName(s);
      if (s && names.map(_tmNormFactionName).indexOf(k) < 0) names.push(s);
    }
    var pi = P0.playerInfo || {};
    push(pi.factionName);
    push(P0.playerFactionName);
    push(P0.playerFaction);
    push(G.playerFactionName);
    push(G.playerFaction);
    if (G.playerInfo) push(G.playerInfo.factionName);
    (Array.isArray(G.facs) ? G.facs : []).forEach(function(f) {
      if (_tmIsMarkedPlayerFaction(f)) push(f.name);
    });
    (Array.isArray(G.chars) ? G.chars : []).forEach(function(c) {
      if (c && (c.isPlayer || c.playerControlled || c.controlledBy === "player")) push(c.faction || c.factionName || c.ownerFaction);
    });
    return names;
  }

  function _tmResolvePlayerFactionNameForAi(G, P0) {
    return _tmResolvePlayerFactionNamesForAi(G, P0)[0] || "";
  }

  function _tmIsPlayerFactionNameForAi(name, playerFactionName) {
    var k = _tmNormFactionName(name);
    if (!k) return false;
    return _tmPlayerFactionNameList(playerFactionName).some(function(n) { return _tmNormFactionName(n) === k; });
  }

  function _tmIsPlayerFactionForAi(f, playerFactionName) {
    return !!(f && (_tmIsMarkedPlayerFaction(f) || _tmIsPlayerFactionNameForAi(f.name, playerFactionName)));
  }

  function _tmFilterSc16PlayerOutputs(p16, playerFactionName) {
    if (!p16 || typeof p16 !== "object") return p16;
    var names = _tmPlayerFactionNameList(playerFactionName);
    if (!names.length) return p16;
    var removedActions = 0;
    var removedDiplomacy = 0;
    if (Array.isArray(p16.faction_actions)) {
      p16.faction_actions = p16.faction_actions.filter(function(fa) {
        var actor = _tmFirstText(fa && fa.faction, fa && fa.name, fa && fa.actor, fa && fa.from, fa && fa.source, fa && fa.initiator);
        if (_tmIsPlayerFactionNameForAi(actor, names)) { removedActions++; return false; }
        return true;
      });
    }
    if (Array.isArray(p16.diplomatic_shifts)) {
      p16.diplomatic_shifts = p16.diplomatic_shifts.filter(function(ds) {
        var actor = _tmFirstText(ds && ds.from, ds && ds.actor, ds && ds.faction, ds && ds.source, ds && ds.initiator);
        if (_tmIsPlayerFactionNameForAi(actor, names)) { removedDiplomacy++; return false; }
        return true;
      });
    }
    p16._playerFactionGuard = {
      playerFactionName: names[0],
      playerFactionNames: names,
      removedFactionActions: removedActions,
      removedDiplomaticShifts: removedDiplomacy
    };
    return p16;
  }

  function _tmSc16TextBlob(obj) { if (obj == null) return ""; if (typeof obj === "string") return obj; try { return JSON.stringify(obj); } catch(_) { return String(obj); } }
  function _tmMentionsFactionForAi(obj, facName) { var k = _tmNormFactionName(facName); return !!k && _tmNormFactionName(_tmSc16TextBlob(obj)).indexOf(k) >= 0; }
  function _tmSc16ActorOf(obj) { return _tmFirstText(obj && obj.faction, obj && obj.name, obj && obj.actor, obj && obj.from, obj && obj.source, obj && obj.initiator); }
  function _tmSc16MatchesFac(obj, facName) {
    if (!obj || !facName) return false;
    var k = _tmNormFactionName(facName);
    return _tmNormFactionName(_tmSc16ActorOf(obj)) === k
      || _tmNormFactionName(_tmFirstText(obj.target, obj.targetFaction, obj.to, obj.receiver, obj.object)) === k
      || _tmMentionsFactionForAi(obj, facName);
  }
  function _tmSc16HasDirectContent(row) { return !!(row && ((Array.isArray(row.actions) && row.actions.length) || (Array.isArray(row.diplomacy) && row.diplomacy.length) || (Array.isArray(row.directives) && row.directives.length))); }
  function _tmSc16PriorityValue(row) { var v = row && (row.priority != null ? row.priority : (row.score != null ? row.score : row.weight)); v = Number(v); return isFinite(v) ? v : 0; }
  function _tmBuildSc16PriorityQueue(p16, playerNames) {
    var raw = Array.isArray(p16.faction_priorities) ? p16.faction_priorities : (Array.isArray(p16.factionPriorities) ? p16.factionPriorities : []);
    return raw.map(function(row) {
      var fac = _tmFirstText(row && row.faction, row && row.name, row && row.targetFaction);
      return { faction: fac, priorityScore: _tmSc16PriorityValue(row), urgency: _tmFirstText(row && row.urgency, row && row.level), priorityReason: _tmFirstText(row && row.reason, row && row.rationale, row && row.motive), raw: row || {} };
    }).filter(function(row) { return row.faction && !_tmIsPlayerFactionNameForAi(row.faction, playerNames); }).sort(function(a, b) { return (b.priorityScore || 0) - (a.priorityScore || 0); });
  }
  function _tmBuildSc16DirectiveLedger(p16, G, playerFactionName) {
    G = G || global.GM || {};
    p16 = p16 || {};
    var playerNames = _tmPlayerFactionNameList(playerFactionName);
    var ledger = { turn: G.turn || 1, source: "sc16", byFaction: {}, order: [], directCount: 0, priorityQueue: [] };
    ledger.priorityQueue = _tmBuildSc16PriorityQueue(p16, playerNames);
    var priorityByFaction = {};
    ledger.priorityQueue.forEach(function(row) {
      priorityByFaction[_tmNormFactionName(row.faction)] = row;
    });
    (Array.isArray(G.facs) ? G.facs : []).forEach(function(fac) {
      if (!fac || !fac.name) return;
      if (_tmIsPlayerFactionForAi(fac, playerNames)) return;
      var row = { faction: fac.name, turn: ledger.turn, source: "sc16", actions: [], diplomacy: [], directives: [],
        territorialChanges: _tmFirstText(p16.territorial_changes, p16.territorialChanges),
        powerBalanceShift: _tmFirstText(p16.power_balance_shift, p16.powerBalanceShift) };
      var priority = priorityByFaction[_tmNormFactionName(fac.name)] || null;
      row.priorityScore = priority ? priority.priorityScore : 0;
      row.priorityUrgency = priority ? priority.urgency : "";
      row.priorityReason = priority ? priority.priorityReason : "";
      if (Array.isArray(p16.faction_actions)) row.actions = p16.faction_actions.filter(function(a) { return _tmSc16MatchesFac(a, fac.name); }).slice(0, 8);
      if (Array.isArray(p16.diplomatic_shifts)) {
        row.diplomacy = p16.diplomatic_shifts.filter(function(d) {
          var k = _tmNormFactionName(fac.name);
          return d && (_tmNormFactionName(d.from) === k || _tmNormFactionName(d.to) === k || _tmMentionsFactionForAi(d, fac.name));
        }).slice(0, 8);
      }
      if (Array.isArray(p16.faction_directives)) row.directives = p16.faction_directives.filter(function(d) { return _tmSc16MatchesFac(d, fac.name); }).slice(0, 4);
      row.hasDirectContent = _tmSc16HasDirectContent(row);
      if (!row.priorityScore && row.hasDirectContent) row.priorityScore = 65;
      if (!row.priorityReason && row.hasDirectContent) row.priorityReason = "sc16-directive";
      row.actionBudgetHint = row.priorityScore >= 80 ? "precision-soon" : (row.priorityScore >= 55 ? "precision-normal" : "watch");
      ledger.byFaction[fac.name] = row;
      if (!priority) ledger.priorityQueue.push({ faction: fac.name, priorityScore: row.priorityScore, urgency: row.priorityUrgency, priorityReason: row.priorityReason, raw: null });
      if (row.hasDirectContent) ledger.directCount++;
    });
    ledger.priorityQueue.sort(function(a, b) { return (b.priorityScore || 0) - (a.priorityScore || 0); });
    ledger.priorityQueue.forEach(function(item, idx) { if (ledger.byFaction[item.faction]) ledger.byFaction[item.faction].priorityRank = idx + 1; });
    ledger.order = ledger.priorityQueue.map(function(x) { return x.faction; });
    return ledger;
  }

  function _tmStoreSc16DirectiveLedger(p16, G, playerFactionName) {
    if (!p16 || typeof p16 !== "object") return null;
    G = G || global.GM || {};
    var ledger = _tmBuildSc16DirectiveLedger(p16, G, playerFactionName);
    G._sc16FactionDirectives = ledger;
    (Array.isArray(G.facs) ? G.facs : []).forEach(function(fac) {
      if (!fac || !fac.name) return;
      var row = ledger.byFaction[fac.name];
      if (!row) return;
      fac._sc16Directive = row;
      if (row.hasDirectContent) {
        if (!Array.isArray(fac._sc16DirectiveHistory)) fac._sc16DirectiveHistory = [];
        fac._sc16DirectiveHistory.push(row);
        if (fac._sc16DirectiveHistory.length > 8) fac._sc16DirectiveHistory = fac._sc16DirectiveHistory.slice(-8);
      }
    });
    p16._factionDirectiveLedger = { turn: ledger.turn, source: ledger.source, count: ledger.order.length, directCount: ledger.directCount, factions: ledger.order.slice(), priorityQueue: ledger.priorityQueue.slice() };
    if (!G._npcFactionAiTurnLedger || G._npcFactionAiTurnLedger.turn !== ledger.turn) {
      G._npcFactionAiTurnLedger = { turn: ledger.turn, createdAt: ledger.turn, sc16: null, dispatch: G._npcFactionLlmDispatchLedger || null, runs: (G._npcFactionLlmLedger && G._npcFactionLlmLedger.runs) || {}, actions: [], candidateRanks: [], notes: [], stats: {} };
    }
    G._npcFactionAiTurnLedger.sc16 = ledger;
    return ledger;
  }

  function _tmDetectModelFamily(model, fallbackFamily) {
    if (model && typeof ModelAdapter !== "undefined" && ModelAdapter.detectFamily) {
      try { return ModelAdapter.detectFamily(model); } catch(_) {}
    }
    return fallbackFamily || "";
  }

  function copyResultsFromTurnState(ctx, p2) {
    var r = (global.GM && GM._turnAiResults) ? GM._turnAiResults : {};
    ctx.results.sc15 = r.subcall15 || ctx.results.sc15 || null;
    ctx.results.sc_memwrite = r.subcallMemwrite || ctx.results.sc_memwrite || null;
    ctx.results.sc16 = r.subcall16 || ctx.results.sc16 || null;
    ctx.results.sc17 = r.subcall17 || ctx.results.sc17 || null;
    ctx.results.sc18 = r.subcall18 || ctx.results.sc18 || null;
    ctx.results.sc_audit = r.subcallAudit || ctx.results.sc_audit || null;
    ctx.results.sc2 = p2 || r.subcall2 || ctx.results.sc2 || null;
    ctx.results.sc25 = r.subcall25 || ctx.results.sc25 || null;
    ctx.results.sc27 = r.subcall27 || ctx.results.sc27 || null;
    ctx.results.sc07 = r.subcall07 || ctx.results.sc07 || null;
    ctx.results.sc28 = r.subcall28 || ctx.results.sc28 || null;
    ctx.results.sc_consolidate = r.subcallConsolidate || ctx.results.sc_consolidate || null;
    return ctx.results;
  }

  ns._resolvePlayerFactionNamesForAi = _tmResolvePlayerFactionNamesForAi;
  ns._resolvePlayerFactionNameForAi = _tmResolvePlayerFactionNameForAi;
  ns._isPlayerFactionForAi = _tmIsPlayerFactionForAi;
  ns._filterSc16PlayerOutputs = _tmFilterSc16PlayerOutputs;
  ns._buildSc16DirectiveLedger = _tmBuildSc16DirectiveLedger;
  ns._storeSc16DirectiveLedger = _tmStoreSc16DirectiveLedger;

  ns.run = async function(ctx) {
    ensureGroups(ctx);
    var _followupStart = Date.now();
    var edicts = ctx.input.edicts || {};
    var xinglu = ctx.input.xinglu || "";
    var memRes = ctx.input.memRes || [];
    var oldVars = ctx.input.oldVars || null;
    var timeRatio = ctx.input.timeRatio;
    var sysP = ctx.prompt.sysP || "";
    var tp = ctx.prompt.tp || "";
    var sc = ctx.prompt.sc || null;
    var _shiluR = ctx.prompt._shiluR, _shiluMin = ctx.prompt._shiluMin || 0, _shiluMax = ctx.prompt._shiluMax || 0;
    var _szjR = ctx.prompt._szjR, _szjMin = ctx.prompt._szjMin || 0, _szjMax = ctx.prompt._szjMax || 0;
    var _hourenR = ctx.prompt._hourenR, _hourenMin = ctx.prompt._hourenMin || 0, _hourenMax = ctx.prompt._hourenMax || 0;
    var _zwR = ctx.prompt._zwR, _zwMin = ctx.prompt._zwMin || 0, _zwMax = ctx.prompt._zwMax || 0;
    var _commentR = ctx.prompt._commentR;
    var url = ctx.subcalls.url;
    var _tok = ctx.subcalls._tok;
    var _buildFetchBody = ctx.subcalls._buildFetchBody;
    var _checkTruncated = ctx.subcalls._checkTruncated;
    var _parseOrRepairJsonResult = ctx.subcalls._parseOrRepairJsonResult || async function(raw) { return { parsed: (typeof extractJSON === "function" ? extractJSON(raw) : null), raw: raw, repaired: false }; };
    var _callEndturnAI = ctx.subcalls._callEndturnAI || null;
    function _requireAIResponseOk(resp, label) {
      if (!resp || !resp.ok) {
        var err = new Error((label || 'AI') + ' HTTP ' + (resp ? resp.status : 'no response'));
        err.status = resp ? resp.status : '';
        throw err;
      }
    }
    async function _callFollowupAI(body, opts) {
      opts = opts || {};
      var callUrl = opts.url || url;
      var key = opts.key || (P.ai && P.ai.key);
      var label = opts.label || opts.id || 'endturn-followup';
      try {
        if (typeof _callEndturnAI === 'function') {
          var routed = await _callEndturnAI(body, {
            id: opts.id || '',
            label: label,
            url: callUrl,
            key: key,
            priority: opts.priority || 'normal',
            timeoutMs: opts.timeoutMs,
            maxRetries: opts.maxRetries
          });
          if (opts.soft) routed.ok = true;
          return routed;
        }
        var resp = await fetch(callUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify(body)
        });
        _requireAIResponseOk(resp, label);
        var data = await resp.json();
        _checkTruncated(data, label);
        var raw = '';
        if (data && data.choices && data.choices[0] && data.choices[0].message) raw = data.choices[0].message.content || '';
        return { ok: true, data: data, raw: raw, parsed: null, parse: null };
      } catch(e) {
        if (opts.soft) return { ok: false, error: e, data: null, raw: '', parsed: null, parse: null };
        throw e;
      }
    }
    var _effectiveOutCap = ctx.subcalls._effectiveOutCap;
    var _modelTemp = ctx.subcalls._modelTemp;
    var _modelFamily = ctx.subcalls._modelFamily;
    var _subcallMeta = ctx.subcalls._subcallMeta || [];
    var _quietLoad = ctx.subcalls._quietLoad || function(msg, pct) { if (typeof showLoading === "function") showLoading(msg, pct); };
    var _maybeCacheSys = ctx.subcalls._maybeCacheSys || function(s) { return s; };
    var _runSubcall = ctx.subcalls._runSubcall;
    var _runSubcallBatch = ctx.subcalls._runSubcallBatch;
    var _queuePostTurnSubcall = ctx.subcalls._queuePostTurnSubcall;
    var _flushQueuedPostTurnSubcalls = ctx.subcalls._flushQueuedPostTurnSubcalls;
    var _awaitQueuedPostTurnSubcallsById = ctx.subcalls._awaitQueuedPostTurnSubcallsById;
    var aiThinking = ctx.results.sc0 || "";
    var memoryReview = ctx.results.sc05 || "";
    var p1 = ctx.results.sc1 || null;
    var p2 = ctx.results.sc2 || null;
    var p1Summary = (ctx.followup && ctx.followup.p1Summary) || "";
    var _specialtySummary = { sc15: "", sc16: "", sc17: "", sc18: "" };
    var shizhengji = ctx.record.shizhengji || "";
    var zhengwen = ctx.record.zhengwen || "";
    var playerStatus = ctx.record.playerStatus || "";
    var playerInner = ctx.record.playerInner || "";
    var turnSummary = ctx.record.turnSummary || "";
    var shiluText = ctx.record.shiluText || "";
    var szjTitle = ctx.record.szjTitle || "";
    var szjSummary = ctx.record.szjSummary || "";
    var personnelChanges = Array.isArray(ctx.record.personnelChanges) ? ctx.record.personnelChanges : [];
    var hourenXishuo = ctx.record.hourenXishuo || "";
    function _buildLateSpecialtySummary() {
      return [
        _specialtySummary.sc15,
        _specialtySummary.sc16,
        _specialtySummary.sc17,
        _specialtySummary.sc18
      ].filter(Boolean).join('');
    }
      // §5 sc15-sc27 后续子调用 + 收尾（NPC 深度·势力·财政·军事·审计·丰化·叙事）
      // ★ 并行优化（2026-04-30）：sc1 完成后扇出三路并行
      //   Branch A: sc15 → sc_memwrite（memwrite 消费 sc15 的 hidden_moves）
      //   Branch B: sc16/17/18 batch（已是 _runSubcallBatch 内部并发=3）
      //   Branch C: sc2 → sc27（sc27 修饰 sc2 的 zhengwen）
      //   三路无交集字段·下游消费者均通过 GM/p1 全局，立即可见
      // ═══════════════════════════════════════════════════════════

      // ── Branch A · NPC 深度推演 ──（P8.1: sc_memwrite 已移到 post-turn）
      var _branchA = (async function() {
      // --- Sub-call 1.5: NPC全面深度推演 --- [standard+full]
      await _runSubcall('sc15', 'NPC深度推演', 'standard', async function() {
      showLoading("NPC\u5168\u9762\u63A8\u6F14",60);
      try {
        // \u2605 \u4E16\u754C\u72B6\u6001\u5FEB\u7167\u6CE8\u5165\uFF08sc15 \u91CD\u70B9\uFF1A\u9632\u6B7B\u8005\u590D\u6D3B\u00B7\u63D0\u793A\u8FDB\u884C\u4E2D\u8BCF\u4EE4\u00B7\u5173\u7CFB\u7A81\u53D8\u00B7\u5DF2\u786E\u7ACB\u4E8B\u5B9E\uFF09
        var _ws15 = '';
        try {
          if (typeof _buildDeadPin === 'function') _ws15 += _buildDeadPin();
          if (typeof _buildCanonicalFacts === 'function') _ws15 += _buildCanonicalFacts();
          if (typeof _buildEdictProgressCards === 'function') _ws15 += _buildEdictProgressCards();
          if (typeof _buildRelationDeltas === 'function') _ws15 += _buildRelationDeltas();
        } catch(_wse15){ _dbg('[WorldSnap sc15] fail:', _wse15); }
        // 12 \u8868\u6CE8\u5165\uFF08\u4EC5\u4E8B\u5B9E\u5C42\u00B7courtNpc/charProfile/relationNet/imperialEdict\u00B7\u8FC7\u6EE4 secret \u7684\u5929\u673A\u6761\u76EE\uFF09
        var _mt15 = '';
        try {
          if (window.MemTables && MemTables.buildTablesInjection) {
            _mt15 = MemTables.buildTablesInjection({ include: ['courtNpc', 'charProfile', 'relationNet', 'imperialEdict', 'edictsActive'], hideSecret: true }) || '';
          }
        } catch(_mt15E){ _dbg('[MemTables sc15] fail:', _mt15E); }
        // \u65F6\u95F4\u53C2\u8003\uFF08Phase 4.1\uFF09
        var _tr15 = '';
        try { if (typeof _buildTimeRef === 'function') _tr15 = _buildTimeRef() || ''; } catch(_e){}
        var tp15 = _tr15 + _ws15 + _mt15 + '\u57FA\u4E8E\u672C\u56DE\u5408\u53D1\u751F\u7684\u4E8B\u4EF6\uFF1A\n';
        if (shizhengji) tp15 += '\u65F6\u653F\u8BB0\uFF1A' + shizhengji + '\n'; // 完整不截断
        if (p1 && p1.npc_actions && p1.npc_actions.length > 0) {
          tp15 += '\u5DF2\u77E5NPC\u884C\u52A8\uFF1A' + p1.npc_actions.map(function(a) { return a.name + ':' + a.action + (a.result?'\u2192'+a.result:''); }).join('\uFF1B') + '\n';
        }
        if (p1 && p1.faction_events && p1.faction_events.length > 0) {
          tp15 += '\u52BF\u529B\u4E8B\u4EF6\uFF1A' + p1.faction_events.map(function(fe){return (fe.actor||'')+fe.action;}).join('\uFF1B') + '\n';
        }
        // 全部存活角色完整状态（不限制数量）
        tp15 += '\n\u5168\u90E8\u5B58\u6D3B\u89D2\u8272\u5F53\u524D\u72B6\u6001\uFF1A\n';
        (GM.chars || []).filter(function(c) { return c.alive !== false; }).forEach(function(c) {
          var parts = [c.name];
          if (c.title) parts.push(c.title);
          if (c.faction) parts.push('\u52BF:' + c.faction);
          if (c.party) parts.push('\u515A:' + c.party);
          if (c.officialTitle && c.officialTitle !== '\u65E0') parts.push('\u5B98:' + c.officialTitle);
          parts.push('\u5FE0' + (c.loyalty || 50) + ' \u91CE' + (c.ambition || 50) + ' \u667A' + (c.intelligence || 50) + ' \u6B66\u52C7' + (c.valor || 50) + ' \u519B\u4E8B' + (c.military || 50) + ' \u653F' + (c.administration || 50) + ' \u7BA1' + (c.management || 50) + ' \u9B45' + (c.charisma || 50) + ' \u4EA4' + (c.diplomacy || 50) + ' \u4EC1' + (c.benevolence || 50));
          if (c.traits && c.traits.length > 0 && typeof getTraitBehaviorSummary === 'function') {
            parts.push('\u7279:' + c.traits.slice(0, 6).map(function(tid) {
              var t = (typeof TRAIT_LIBRARY !== 'undefined' && TRAIT_LIBRARY[tid]) ? TRAIT_LIBRARY[tid].name : tid;
              return t;
            }).join('\u3001'));
          }
          if ((c.stress || 0) > 20) parts.push('\u538B\u529B' + c.stress);
          if (c._mood && c._mood !== '\u5E73') parts.push('\u60C5:' + c._mood);
          if (c.personality) parts.push('\u6027:' + c.personality);
          if (c.spouse) parts.push('[\u540E\u5BAB]');
          if (c.personalGoal) parts.push('\u6C42:' + c.personalGoal.substring(0, 30));
          // 伤疤/勋章——永久影响此人行为的刻骨经历
          if (c._scars && c._scars.length > 0) {
            parts.push('\u4F24:' + c._scars.slice(-3).map(function(s) { return s.event + '[' + s.emotion + ']'; }).join(';'));
          }
          if (c.isPlayer) parts.push('\u2605\u73A9\u5BB6');
          tp15 += '  ' + parts.join(' ') + '\n';
        });
        // 加入显著矛盾（NPC行为应受矛盾驱动）
        if (P.playerInfo && P.playerInfo.coreContradictions && P.playerInfo.coreContradictions.length > 0) {
          tp15 += '\n\u3010\u663E\u8457\u77DB\u76FE\u2014\u2014NPC\u884C\u4E3A\u5E94\u53D7\u6B64\u9A71\u52A8\u3011\n';
          P.playerInfo.coreContradictions.forEach(function(c) { tp15 += '  [' + c.dimension + '] ' + c.title + (c.parties?'('+c.parties+')':'') + '\n'; });
        }
        // 省份状况（影响地方官行为）
        if (GM.provinceStats) {
          var _critProv = Object.entries(GM.provinceStats).filter(function(e){return e[1].unrest>50||e[1].corruption>60;});
          if (_critProv.length > 0) {
            tp15 += '\n\u3010\u5371\u673A\u7701\u4EFD\u3011' + _critProv.map(function(e){return e[0]+' \u6C11\u53D8'+Math.round(e[1].unrest)+' \u8150'+Math.round(e[1].corruption);}).join('\uFF1B') + '\n';
          }
        }
        // 列出本回合的资源变化（让AI思考级联影响）
        if (p1 && p1.resource_changes) {
          tp15 += '\n\u672C\u56DE\u5408\u8D44\u6E90\u53D8\u5316\uFF1A';
          Object.entries(p1.resource_changes).forEach(function(e) { tp15 += e[0] + (parseFloat(e[1]) > 0 ? '+' : '') + e[1] + ' '; });
          tp15 += '\n';
        }
        tp15 += '\n请返回JSON。这是"水面下的冰山"——玩家看不到这些，但它们决定了未来走向：\n';
        tp15 += '{\n';
        tp15 += '  "hidden_moves":["某角色：因为什么→暗中做了什么→目的是什么(40字每条，至少7条)"],\n';
        tp15 += '  "mood_shifts":[{"name":"","loyalty_delta":0,"stress_delta":0,"mood":"新情绪","reason":"(30字)"}],\n';
        tp15 += '  "relationship_changes":[{"a":"角色A","b":"角色B","delta":0,"reason":"关系变化原因"}],\n';
        tp15 += '  "cascade_effects":{"变量名":变化量},\n';
        tp15 += '  "province_impacts":[{"name":"省份","unrest_delta":0,"prosperity_delta":0,"reason":""}],\n';
        tp15 += '  "class_reactions":[{"class":"阶层","satisfaction_delta":0,"reason":""}],\n';
        tp15 += '  "party_maneuvers":[{"party":"党派","action":"动作","target":"对谁"}],\n';
        tp15 += '  "faction_undercurrents":[{"faction":"势力名","situation":"内部局势(40字)","trend":"上升/稳定/动荡/衰落","nextMove":"下一步可能行动(30字)"}],\n';
        tp15 += '  "npc_schemes":[{"schemer":"谁","target":"针对谁","plan":"什么阴谋(40字)","progress":"酝酿中/即将发动/长期布局","allies":"同谋者"}],\n';
        tp15 += '  "rumors":"朝堂/军营/民间/后宫传闻各一条(100字)",\n';
        tp15 += '  "contradiction_shift":"矛盾演化方向(60字)"\n';
        tp15 += '}\n';
        tp15 += '\n■ hidden_moves要求：\n';
        tp15 += '  至少7条（角色越多越需要更多暗流）。必须包含：\n';
        tp15 += '  - 至少3条NPC对NPC的暗中行动（权臣排挤对手、将军暗中联络、谋士居中调停）\n';
        tp15 += '  - 至少1条势力内部暗流（某势力重臣暗中联络他国/谋划政变/收集首领罪证）\n';
        tp15 += '  - 至少1条小人物的小动作（小吏贪墨、商人囤货、探子传信、流民聚集）\n';
        tp15 += '  - 每条必须有"动机链"：因为什么→做了什么→想达到什么目的\n';
        tp15 += '  - 如前几回合有伏笔/暗流，应在此回收或推进\n';
        tp15 += '\n■ faction_undercurrents：每个非玩家势力一条——它们的内部在发生什么？\n';
        tp15 += '  situation写当前内部局势（如"权臣与太子争权白热化""改革派占上风""粮荒导致军心不稳"）\n';
        tp15 += '  trend写趋势方向；nextMove写这个势力下一步可能采取的行动\n';
        tp15 += '\n■ npc_schemes：正在酝酿中的阴谋——可能跨多回合。至少2条。\n';
        tp15 += '  progress:"酝酿中"的阴谋不会本回合发动，但会在future turns逐步推进\n';
        tp15 += '  progress:"即将发动"的阴谋会在下1-2回合爆发\n';
        tp15 += '\n■ mood_shifts: 每个受本回合事件影响的角色都应有心态变化。\n';
        tp15 += '■ relationship_changes: NPC之间的关系变动（不只是NPC与玩家的关系）。';

        var _sc15Body = {model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp15}], temperature:P.ai.temp||0.8, max_tokens:_tok(12000)};
        if (_modelFamily === 'openai') _sc15Body.response_format = { type: 'json_object' };
        var _sc15Call = await _callFollowupAI(_sc15Body, { id: 'sc15', label: '人物关系', priority: 'normal' });
        {
          var data15 = _sc15Call.data;
          _checkTruncated(data15, '人物关系');
          var c15 = _sc15Call.raw || '';
          var _p15Parse = await _parseOrRepairJsonResult(c15, data15, '人物关系', { url: url, key: P.ai.key, body: _sc15Body, expectedKeys: ['mood_shifts', 'relationship_changes', 'hidden_moves', 'faction_undercurrents'], priority: 'normal' });
          if (_p15Parse && _p15Parse.raw) c15 = _p15Parse.raw;
          var p15 = _p15Parse ? _p15Parse.parsed : null;
          if (p15) {
            // 应用心态变化
            if (p15.mood_shifts && Array.isArray(p15.mood_shifts)) {
              p15.mood_shifts.forEach(function(ms) {
                if (!ms.name) return;
                var msCh = findCharByName(ms.name);
                if (!msCh) return;
                if (ms.loyalty_delta) {
                  var _msLoyaltyDelta = clamp(parseInt(ms.loyalty_delta) || 0, -10, 10);
                  if (typeof adjustCharacterLoyalty === 'function') {
                    adjustCharacterLoyalty(msCh, _msLoyaltyDelta, ms.reason || '', { source:'npc-deep-mood-shift', ai:true, defaultReason:'AI\u63A8\u6F14' });
                  } else {
                    var _msOldL = (typeof msCh.loyalty === 'number' && isFinite(msCh.loyalty)) ? msCh.loyalty : 50;
                    if (ms.reason) msCh.loyalty = clamp(_msOldL + _msLoyaltyDelta, 0, 100);
                  }
                }
                if (ms.stress_delta) msCh.stress = clamp((msCh.stress || 0) + clamp(parseInt(ms.stress_delta) || 0, -10, 10), 0, 100);
                if (typeof ms.mood === "string" && ms.mood.trim()) {
                  var _oldMood = msCh._mood || "平";
                  msCh._mood = ms.mood.trim().slice(0, 20);
                  if (_oldMood !== msCh._mood && typeof recordChange === "function") {
                    recordChange("characters", msCh.name || ms.name, "mood", _oldMood, msCh._mood, ms.reason || "AI推演");
                  }
                }
              });
            }
            // 应用隐藏关系变化
            if (p15.relationship_changes && Array.isArray(p15.relationship_changes)) {
              p15.relationship_changes.forEach(function(rc) {
                if (!rc.a || !rc.b || !rc.delta) return;
                if (typeof AffinityMap !== 'undefined') AffinityMap.add(rc.a, rc.b, clamp(parseInt(rc.delta) || 0, -15, 15), rc.reason || '\u6697\u6D41');
              });
            }
            // 隐藏行动记入事件日志
            if (p15.hidden_moves && Array.isArray(p15.hidden_moves)) {
              p15.hidden_moves.forEach(function(hm) { addEB('\u6697\u6D41', hm); });
            }
            // 应用级联变量效果（AI补充的连锁影响）
            if (p15.cascade_effects && typeof p15.cascade_effects === 'object') {
              Object.entries(p15.cascade_effects).forEach(function(ce) {
                var varName = ce[0], delta = parseFloat(ce[1]);
                if (isNaN(delta) || !GM.vars[varName]) return;
                // 级联变化幅度限制（防止AI过度调整）
                delta = clamp(delta, -GM.vars[varName].max * 0.05, GM.vars[varName].max * 0.05);
                if (Math.abs(delta) >= 0.1) {
                  GM.vars[varName].value = clamp(GM.vars[varName].value + delta, GM.vars[varName].min, GM.vars[varName].max);
                  _dbg('[Cascade] ' + varName + ': ' + (delta > 0 ? '+' : '') + delta.toFixed(1));
                }
              });
            }
            // 应用省份影响
            if (p15.province_impacts && Array.isArray(p15.province_impacts)) {
              p15.province_impacts.forEach(function(pi) {
                if (!pi.name || !GM.provinceStats || !GM.provinceStats[pi.name]) return;
                var ps = GM.provinceStats[pi.name];
                if (pi.unrest_delta) ps.unrest = clamp((ps.unrest||10) + clamp(parseInt(pi.unrest_delta)||0, -10, 10), 0, 100);
                if (pi.prosperity_delta) ps.wealth = clamp((ps.wealth||50) + clamp(parseInt(pi.prosperity_delta)||0, -8, 8), 0, 100);
              });
            }
            // 应用阶层反应
            if (p15.class_reactions && Array.isArray(p15.class_reactions) && GM.classes) {
              p15.class_reactions.forEach(function(cr) {
                if (!cr.class) return;
                var cls = GM.classes.find(function(c){return c.name===cr.class;});
                if (cls && cr.satisfaction_delta) {
                  var _classReactionOldSat = parseInt(cls.satisfaction||50) || 50;
                  cls.satisfaction = clamp(_classReactionOldSat + clamp(parseInt(cr.satisfaction_delta)||0, -8, 8), 0, 100);
                  if (TM && TM.ClassEngine && typeof TM.ClassEngine.applyClassPartyCoupling === 'function') {
                    try {
                      TM.ClassEngine.applyClassPartyCoupling(GM, cls, cls.satisfaction - _classReactionOldSat, { turn: GM.turn, source: 'endturn-ai-infer', reason: cr.reason || '' });
                    } catch(_classCoupleReactionE) {
                      (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_classCoupleReactionE, 'endturn] class reaction coupling:') : console.warn('[endturn] class reaction coupling:', _classCoupleReactionE);
                    }
                  }
                }
              });
            }
            // 应用党派动作到事件日志
            if (p15.party_maneuvers && Array.isArray(p15.party_maneuvers)) {
              p15.party_maneuvers.forEach(function(pm) { if (pm.party && pm.action) addEB('\u515A\u4E89', pm.party + '：' + pm.action + (pm.target ? '(\u9488\u5BF9' + pm.target + ')' : '')); });
            }
            // 矛盾演化记入事件
            if (p15.contradiction_shift) addEB('\u77DB\u76FE', p15.contradiction_shift);
            // 流言用于Sub-call 2叙事
            if (p15.rumors) _specialtySummary.sc15 = '\u3010\u6D41\u8A00\u3011' + p15.rumors + '\n';

            // 势力内部暗流——保留历史（最近3回合的暗流，供AI看到趋势演变）
            if (p15.faction_undercurrents && Array.isArray(p15.faction_undercurrents)) {
              if (!GM._factionUndercurrents) GM._factionUndercurrents = [];
              if (!GM._factionUndercurrentsHistory) GM._factionUndercurrentsHistory = [];
              // 存档当前轮暗流到历史
              if (GM._factionUndercurrents.length > 0) {
                GM._factionUndercurrentsHistory.push({ turn: GM.turn, data: GM._factionUndercurrents });
                if (GM._factionUndercurrentsHistory.length > 3) GM._factionUndercurrentsHistory.shift();
              }
              GM._factionUndercurrents = p15.faction_undercurrents;
              p15.faction_undercurrents.forEach(function(fu) {
                if (fu.faction && fu.situation) {
                  addEB('势力·内幕', fu.faction + '：' + fu.situation + (fu.trend ? '（' + fu.trend + '）' : ''));
                  // 动荡/衰落的势力扣strength
                  if (fu.trend === '动荡' || fu.trend === '衰落') {
                    var _uFac = findFacByName(fu.faction);
                    if (_uFac) _uFac.strength = Math.max(1, (_uFac.strength||50) - (fu.trend === '衰落' ? 2 : 1));
                  }
                }
              });
            }

            // NPC阴谋——存入GM，跨回合持续推进
            if (p15.npc_schemes && Array.isArray(p15.npc_schemes)) {
              if (!GM.activeSchemes) GM.activeSchemes = [];
              p15.npc_schemes.forEach(function(sc2) {
                if (!sc2.schemer || !sc2.plan) return;
                // 查找是否有已存在的同一阴谋
                var existing = GM.activeSchemes.find(function(s) { return s.schemer === sc2.schemer && s.target === sc2.target; });
                if (existing) {
                  // 更新进度
                  existing.plan = sc2.plan;
                  existing.progress = sc2.progress || existing.progress;
                  existing.allies = sc2.allies || existing.allies;
                  existing.lastTurn = GM.turn;
                } else {
                  GM.activeSchemes.push({ schemer: sc2.schemer, target: sc2.target || '', plan: sc2.plan, progress: sc2.progress || '酝酿中', allies: sc2.allies || '', startTurn: GM.turn, lastTurn: GM.turn });
                }
                // 记入阴谋者记忆
                if (typeof NpcMemorySystem !== 'undefined') {
                  NpcMemorySystem.remember(sc2.schemer, '\u6697\u4E2D\u8C0B\u5212\uFF1A' + sc2.plan, '\u5E73', 4, sc2.target || '');
                }
                addEB('暗流', sc2.schemer + '密谋' + (sc2.target ? '针对' + sc2.target : '') + '（' + (sc2.progress || '') + '）');
              });
              // 清理过期阴谋（超过5回合未更新的视为放弃）
              GM.activeSchemes = GM.activeSchemes.filter(function(s) {
                var keepTurns = (typeof turnsForMonths === 'function') ? turnsForMonths(5) : 5;
                return GM.turn - s.lastTurn < keepTurns;
              });
            }

            GM._turnAiResults.subcall15 = p15;
            _dbg('[NPC Deep] hidden:', (p15.hidden_moves||[]).length, 'mood:', (p15.mood_shifts||[]).length, 'undercurrents:', (p15.faction_undercurrents||[]).length, 'schemes:', (p15.npc_schemes||[]).length);
          }
        }
      } catch(e15) { _dbg('[NPC Deep] \u5931\u8D25:', e15); throw e15; }
      }); // end Sub-call 1.5 _runSubcall
      })(); // ── end Branch A IIFE (P8.1: 仅含 sc15·sc_memwrite 已移到 post-turn 队列) ──

      // --- Sub-call SC_MEMWRITE: NPC 记忆自动回写 (P8.1 移到 post-turn·消费方仅是下回合 NPC 记忆系统) ---
      _queuePostTurnSubcall('sc_memwrite', function(){ return _runSubcall('sc_memwrite', 'NPC记忆回写', 'lite', async function() {
      showLoading("NPC\u8BB0\u5FC6\u56DE\u5199", 67);
      try {
        var _p15 = (GM._turnAiResults && GM._turnAiResults.subcall15) || {};
        // 收集输入
        var tpMW = '【任务·从本回合叙事中为每个涉事 NPC 提取结构化记忆条目】\n\n';
        tpMW += '<shizhengji>' + ((p1 && p1.shizhengji) || '').substring(0, 3000) + '</shizhengji>\n';
        tpMW += '<shilu>' + ((p1 && p1.shilu_text) || '').substring(0, 2000) + '</shilu>\n';
        if (p1 && p1.npc_actions && p1.npc_actions.length) {
          tpMW += '<npc-actions>\n';
          p1.npc_actions.slice(0, 30).forEach(function(a) {
            tpMW += '  <action char="' + (a.name||'') + '" target="' + (a.target||'') + '">' + (a.action||'') + ' → ' + (a.result||'') + '</action>\n';
          });
          tpMW += '</npc-actions>\n';
        }
        if (_p15.hidden_moves && _p15.hidden_moves.length) {
          tpMW += '<hidden-moves>\n';
          _p15.hidden_moves.slice(0, 20).forEach(function(h) {
            var _hm = _tmHiddenMoveForMemory(h);
            if (_hm.text) tpMW += '  <move char="' + _tmXmlText(_hm.actor) + '">' + _tmXmlText(_hm.text) + '</move>\n';
          });
          tpMW += '</hidden-moves>\n';
        }
        if (p1 && Array.isArray(p1.faction_events)) {
          tpMW += '<faction-events>\n';
          p1.faction_events.slice(0, 15).forEach(function(fe) {
            tpMW += '  <event actor="' + (fe.actor||'') + '" target="' + (fe.target||'') + '">' + (fe.action||'') + '</event>\n';
          });
          tpMW += '</faction-events>\n';
        }

        tpMW += '\n【输出 JSON 严格 schema】\n';
        tpMW += '{\n';
        tpMW += '  "memory_writes": [\n';
        tpMW += '    {\n';
        tpMW += '      "char": "记忆归属的角色名（必须是 GM.chars 中存在的）",\n';
        tpMW += '      "event": "第三人称叙事·20-60字·含具体动作/对象/结果",\n';
        tpMW += '      "emotion": "喜/怒/忧/惧/恨/敬/平/察/警/强/谦 之一",\n';
        tpMW += '      "importance": 1-10 数值·依事件对此角色的震撼度·日常琐事1-3·重大事件7-10,\n';
        tpMW += '      "relatedPerson": "本事件中与 char 最相关的另一方（可空）",\n';
        tpMW += '      "participants": ["在场所有参与者姓名·含 char 与 relatedPerson"],\n';
        tpMW += '      "source": "witnessed（亲历）/reported（他人转述）/rumor（风闻）/intuition（直觉）",\n';
        tpMW += '      "credibility": 0-100 整数·witnessed=90+·reported=60-80·rumor=30-50,\n';
        tpMW += '      "location": "发生地点·如未提及则留空",\n';
        tpMW += '      "witnesses": ["在场但非参与的目击者·如未提及则空数组"],\n';
        tpMW += '      "type": "betrayal/kindness/humiliation/promotion/loss/marriage/military/dialogue/scheme/general",\n';
        tpMW += '      "arcId": "归属 arc 的 id·格式「arc_{turn}_{slug}」·若为新 arc·须与 arc_updates 中同 arc 的 id 字段完全一致（同一 id 出现两处：arc_updates.id 和 memory_writes.arcId）"\n';
        tpMW += '    }\n';
        tpMW += '  ],\n';
        tpMW += '  "arc_updates": [\n';
        tpMW += '    {\n';
        tpMW += '      "char": "arc 归属角色",\n';
        tpMW += '      "id": "arc 现有id或留空",\n';
        tpMW += '      "title": "剧情弧标题·如「北伐之议」",\n';
        tpMW += '      "type": "political/military/personal/economic/succession/foreign/romance/revenge",\n';
        tpMW += '      "phase": "brewing/rising/climax/resolving/resolved",\n';
        tpMW += '      "participants": ["参与者"],\n';
        tpMW += '      "emotionalTrajectory": "情感轨迹描述·如「期待→怀疑→失望」",\n';
        tpMW += '      "unresolved": "尚未解决的核心问题"\n';
        tpMW += '    }\n';
        tpMW += '  ],\n';
        tpMW += '  "causal_edges": [\n';
        tpMW += '    {\n';
        tpMW += '      "from": "原因事件id或描述",\n';
        tpMW += '      "to": "结果事件id或描述",\n';
        tpMW += '      "type": "triggered/enabled/prevented/accelerated",\n';
        tpMW += '      "strength": 0-1 小数,\n';
        tpMW += '      "explanation": "因果关系说明·30字内"\n';
        tpMW += '    }\n';
        tpMW += '  ]\n';
        tpMW += '}\n\n';
        tpMW += '【原则】\n';
        tpMW += '· 宁多勿漏：叙事中每个有名有姓涉事者都应获得至少一条 memory_write\n';
        tpMW += '· 镜像互感：A 羞辱 B·不需要写两条（B 那条由系统自动镜像）·但要为"在场的 C"也写一条 source=witnessed\n';
        tpMW += '· 感官具体：能填 location/witnesses 就填·这是质感的关键\n';
        tpMW += '· 可信度严谨：仅"在场目击"=witnessed；转述=reported；坊间=rumor\n';
        tpMW += '· arc 延续：同一主题跨回合的事件·尽量关联到已有 arc_id（若 char._arcs 已有同主题）\n';
        tpMW += '· 因果要节制：causal_edges 只写强逻辑关系·不追求多\n';

        var _cpMW = (typeof getCompressionParams === 'function') ? getCompressionParams() : { scale: 1.0 };
        var _mwBudget = Math.round(8000 * Math.max(1.0, _cpMW.scale));
        var _mwBody = {
          model: P.ai.model || "gpt-4o",
          messages: [{ role: "system", content: _maybeCacheSys(sysP) }, { role: "user", content: tpMW }],
          temperature: 0.5,
          max_tokens: _mwBudget
        };
        if (_modelFamily === 'openai') _mwBody.response_format = { type: 'json_object' };
        var _mwCall = await _callFollowupAI(_mwBody, { id: 'sc_memwrite', label: 'NPC记忆回写', priority: 'low' });
        {
          var dataMW = _mwCall.data;
          _checkTruncated(dataMW, 'NPC记忆回写');
          var cMW = _mwCall.raw || '';
          var _pMWParse = await _parseOrRepairJsonResult(cMW, dataMW, 'NPC记忆回写', { url: url, key: P.ai.key, body: _mwBody, expectedKeys: ['memory_writes', 'arc_updates', 'relationship_notes'], priority: 'low' });
          if (_pMWParse && _pMWParse.raw) cMW = _pMWParse.raw;
          var pMW = _pMWParse ? _pMWParse.parsed : null;
          if (pMW) {
            if (GM._turnAiResults) GM._turnAiResults.subcallMemwrite = pMW;
            // 应用 arc_updates（先做·让 memory_writes 能引用 arcId）
            if (Array.isArray(pMW.arc_updates)) {
              pMW.arc_updates.forEach(function(au) {
                if (!au || !au.char || !au.title) return;
                if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.upsertArc) {
                  NpcMemorySystem.upsertArc(au.char, au);
                }
              });
            }
            // 应用 memory_writes
            var _mwCount = 0;
            if (Array.isArray(pMW.memory_writes)) {
              pMW.memory_writes.forEach(function(mw) {
                if (!mw || !mw.char || !mw.event) return;
                if (typeof NpcMemorySystem === 'undefined' || !NpcMemorySystem.remember) return;
                try {
                  NpcMemorySystem.remember(
                    mw.char,
                    mw.event,
                    mw.emotion || '平',
                    mw.importance || 5,
                    mw.relatedPerson || '',
                    {
                      type: mw.type,
                      source: mw.source,
                      credibility: mw.credibility,
                      location: mw.location,
                      witnesses: mw.witnesses,
                      participants: mw.participants,
                      arcId: mw.arcId
                    }
                  );
                  _mwCount++;
                } catch(_mwE) { _dbg('[MemWrite] remember failed for', mw.char, _mwE); }
              });
            }
            // 应用 causal_edges
            if (Array.isArray(pMW.causal_edges) && pMW.causal_edges.length > 0) {
              if (!GM._causalGraph) GM._causalGraph = { nodes: [], edges: [] };
              pMW.causal_edges.forEach(function(ce) {
                if (!ce || !ce.from || !ce.to) return;
                GM._causalGraph.edges.push({
                  id: 'e_' + (GM.turn||0) + '_' + Math.random().toString(36).slice(2,5),
                  from: ce.from, to: ce.to,
                  type: ce.type || 'triggered',
                  strength: Math.max(0, Math.min(1, parseFloat(ce.strength) || 0.5)),
                  explanation: (ce.explanation || '').substring(0, 80),
                  turn: GM.turn || 0
                });
              });
              // 限制总量（保留最近 300 条边）
              if (GM._causalGraph.edges.length > 300) GM._causalGraph.edges = GM._causalGraph.edges.slice(-300);
            }
            _dbg('[MemWrite] 回写', _mwCount, '条 NPC 记忆·', (pMW.arc_updates||[]).length, '个 arc 更新·', (pMW.causal_edges||[]).length, '条因果');
          }
        }
      } catch(eMW) { _dbg('[MemWrite] 失败:', eMW); /* P8.1 post-turn·静默失败不抛 */ }
      }); }); // end SC_MEMWRITE (queued post-turn)

      // ── Branch B · 势力·经济·军事专项（_runSubcallBatch 已内部 concurrency=3）──
      // --- Sub-call 1.6/1.7/1.8 batch --- [full only]
      var _branchB = _runSubcallBatch('full-specialty', [
      function(){ return _runSubcall('sc16', '势力推演', 'full', async function() {
      showLoading("\u52BF\u529B\u81EA\u4E3B\u63A8\u6F14",63);
      try {
        var _playerFacNames16 = _tmResolvePlayerFactionNamesForAi(GM, P);
        var tp16 = '\u57FA\u4E8E\u672C\u56DE\u5408\u5C40\u52BF\uFF0C\u751F\u6210\u975E\u73A9\u5BB6\u52BF\u529B\u7684\u6218\u7565\u65B9\u5411\u4E0E\u7CBE\u7EC6\u5316\u63A8\u6F14\u4F18\u5148\u7EA7\uFF1A\n';
        tp16 += '\u65F6\u653F\u8BB0\uFF1A' + (shizhengji||'').substring(0,500) + '\n';
        (GM.facs||[]).forEach(function(f) {
          if (_tmIsPlayerFactionForAi(f, _playerFacNames16)) return;
          tp16 += f.name + ' \u5B9E\u529B' + (f.strength||50) + (f.leader?' \u9996\u9886:'+f.leader:'') + (f.goal?' \u76EE\u6807:'+f.goal:'') + (f.attitude?' \u6001\u5EA6:'+f.attitude:'') + '\n';
        });
        if (_playerFacNames16.length) {
          tp16 += '\n【玩家势力控制边界】' + _playerFacNames16.join('、') + '由玩家亲自控制；玩家势力不得作为行动发起方，不要为它生成 faction_actions，也不要以它作为 diplomatic_shifts.from。NPC 可以把玩家势力作为 target/to。\n';
        }
        if (GM.factionRelations && GM.factionRelations.length > 0) {
          tp16 += '\u52BF\u529B\u5173\u7CFB\uFF1A' + GM.factionRelations.map(function(r){return r.from+'\u2192'+r.to+' '+r.type+'('+r.value+')';}).join('\uFF1B') + '\n';
        }
        try {
          var _adminHierarchy16 = (typeof TM !== 'undefined' && TM.FactionNpcLlmDecision && typeof TM.FactionNpcLlmDecision.buildFactionAdminSummaryForSc16 === 'function')
            ? TM.FactionNpcLlmDecision.buildFactionAdminSummaryForSc16({ maxFactions: 16, maxDivisions: 4, maxChars: 8000 })
            : '';
          if (_adminHierarchy16) {
            tp16 += '\n' + _adminHierarchy16 + '\n';
            tp16 += '\u3010\u52BF\u529B\u5730\u76D8\u5224\u65AD\u8981\u6C42\u3011\u4EE5\u4E0A\u662F\u5F53\u524D\u8FD0\u884C\u65F6\u5404\u52BF\u529B\u7701\u7EA7\u5730\u76D8\u8D26\u518C\uFF1B\u82E5\u672C\u56DE\u5408\u6216\u5148\u524D\u56DE\u5408\u5DF2\u53D1\u751F\u9886\u571F\u53D8\u52A8\uFF0C\u5E94\u4EE5\u8FD9\u4EFD\u5F53\u524D\u533A\u5212\u4E3A\u51C6\uFF0C\u4E0D\u8981\u53EA\u6309\u5F00\u5C40\u65E7\u5730\u63A8\u6F14\uFF1B\u6BCF\u4E2A\u52BF\u529B\u7684\u6269\u5F20\u3001\u9632\u5B88\u3001\u8865\u7ED9\u3001\u8D22\u653F\u4E0E\u5916\u4EA4\u90FD\u8981\u5148\u770B\u81EA\u5BB6\u5F53\u524D\u5730\u76D8\u3002\n';
          }
        } catch(_adminHierarchy16Err) { try { _dbg('[sc16 admin hierarchy] fail:', _adminHierarchy16Err); } catch(_){} }
        // 势力暗流（连续性——上回合行动应有后续）
        if (GM._factionUndercurrents && GM._factionUndercurrents.length > 0) {
          tp16 += '\n【势力暗流——上回合行动应有后续进展】\n';
          GM._factionUndercurrents.forEach(function(fu) {
            tp16 += '  ' + fu.faction + '：' + fu.situation + (fu.nextMove ? ' 可能行动:' + fu.nextMove : '') + '\n';
          });
        }
        // 势力叙事（记忆上文）
        if (GM._factionNarratives) {
          var _fnKeys = Object.keys(GM._factionNarratives);
          if (_fnKeys.length > 0) {
            tp16 += '【势力发展记忆】\n';
            _fnKeys.forEach(function(k) { tp16 += '  ' + k + '\uFF1A' + (GM._factionNarratives[k]||'') + '\n'; });
          }
        }
        try {
          var _npcPrecision16 = (typeof TM !== 'undefined' && TM.FactionNpcLlmDecision && typeof TM.FactionNpcLlmDecision.buildRecentTrajectoryContextForSc16 === 'function')
            ? TM.FactionNpcLlmDecision.buildRecentTrajectoryContextForSc16({ maxFactions: 12, maxChars: 6000 })
            : '';
          if (_npcPrecision16) {
            tp16 += '\n' + _npcPrecision16 + '\n';
            tp16 += '\u3010\u7CBE\u7EC6\u5316\u52BF\u529B\u63A8\u6F14\u627F\u63A5\u8981\u6C42\u3011\u4EE5\u4E0A\u662F\u5148\u524D\u56DE\u5408\u7684\u52BF\u529B\u7CBE\u7EC6\u5316\u63A8\u6F14\u8BB0\u5F55\uFF0C\u5305\u62EC\u8FC7\u56DE\u5408\u65F6\u6279\u91CF\u52BF\u529B\u63A8\u6F14\u5199\u5165\u7684\u52BF\u529B\u65E7\u8D26\u3001\u8FC7\u56DE\u5408\u540E\u8FD1\u4E8B\u5FEB\u62A5\u5199\u5165\u3001\u4EE5\u53CA\u56DE\u5408\u5185\u7CBE\u7EC6\u5316\u52BF\u529B\u63A8\u6F14\u3002sc16\u5FC5\u987B\u628A\u5B83\u4EEC\u5F53\u4F5C\u5404\u52BF\u529B\u5DF2\u5F62\u6210\u7684\u8DEF\u7EBF\u548C\u8BB0\u5FC6\uFF1B\u4E0D\u5F97\u65E0\u6545\u53CD\u5411\u63A8\u7FFB\u3002\u5982\u9700\u8F6C\u5411\uFF0C\u5FC5\u987B\u5728motive/reason\u4E2D\u8BF4\u660E\u65B0\u53D8\u6545\u3002\n';
          }
        } catch(_npcPrecision16Err) { try { _dbg('[sc16 precision history] fail:', _npcPrecision16Err); } catch(_){} }
        tp16 += '\n\u8BF7\u8FD4\u56DEJSON\uFF1A{"faction_priorities":[{"faction":"\u52BF\u529B\u540D","priority":0,"urgency":"high|normal|low","reason":"\u4E3A\u4EC0\u4E48\u8FD9\u4E2A\u52BF\u529B\u5E94\u4F18\u5148\u4EA4\u7ED9\u7CBE\u7EC6\u5316LLM"}],"faction_actions":[{"faction":"\u52BF\u529B\u540D","action":"\u5177\u4F53\u884C\u52A8(50\u5B57)","target":"\u5BF9\u8C01","motive":"\u52A8\u673A","impact":"\u5F71\u54CD"}],"faction_directives":[{"faction":"\u52BF\u529B\u540D","strategic_intent":"\u672C\u56DE\u5408\u603B\u76EE\u6807(30-80\u5B57)","must_follow":"\u7CBE\u7EC6\u5316\u52BF\u529BLLM\u5FC5\u987B\u627F\u63A5\u7684\u65B9\u5411","preferred_actions":["\u5EFA\u8BAE\u843D\u5730\u52A8\u4F5C"],"red_lines":"\u4E0D\u5E94\u53CD\u5411\u63A8\u7FFB\u7684\u8FB9\u754C","reason":"\u4F9D\u636E"}],"diplomatic_shifts":[{"from":"","to":"","old_relation":"","new_relation":"","reason":""}],"territorial_changes":"\u9886\u571F\u53D8\u5316\u63CF\u8FF0(100\u5B57)","power_balance_shift":"\u529B\u91CF\u5BF9\u6BD4\u53D8\u5316(100\u5B57)"}\n';
        tp16 += 'SC16 是势力层的战略指令账本与优先级队列；faction_priorities 决定后续精细化 LLM 优先处理谁，faction_actions/faction_directives 只提供战略方向。真正的人物、军队、财政、地块等落地由后续势力精细化 LLM 执行。只为上述非玩家势力生成方向；玩家势力不得作为行动发起方。不要为了凑满全部势力而制造低价值行动，优先标出最该行动、最可能行动、最危险的势力。包括战争、联盟、贸易、内部整合、扩张、防御等。';
        var _sc16Body = {model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp16}], temperature:P.ai.temp||0.8, max_tokens:_tok(8000)};
        if (_modelFamily === 'openai') _sc16Body.response_format = { type: 'json_object' };
        var _sc16Call = await _callFollowupAI(_sc16Body, { id: 'sc16', label: '势力行动', priority: 'normal' });
        {
          var j16 = _sc16Call.data; _checkTruncated(j16, '势力行动'); var c16 = _sc16Call.raw || '';
          var _p16Parse = await _parseOrRepairJsonResult(c16, j16, '势力行动', { url: url, key: P.ai.key, body: _sc16Body, expectedKeys: ['faction_priorities', 'faction_actions', 'faction_directives', 'diplomatic_shifts', 'power_balance_shift'], priority: 'normal' });
          if (_p16Parse && _p16Parse.raw) c16 = _p16Parse.raw;
          var p16 = _p16Parse ? _p16Parse.parsed : null;
          if (p16) {
            p16 = _tmFilterSc16PlayerOutputs(p16, _playerFacNames16);
            _tmStoreSc16DirectiveLedger(p16, GM, _playerFacNames16);
            if (p16.faction_actions && Array.isArray(p16.faction_actions)) {
              p16.faction_actions.forEach(function(fa) { if (fa.faction && fa.action) addEB('\u52BF\u529B\u52A8\u6001', fa.faction + '：' + fa.action); });
            }
            if (p16.diplomatic_shifts && Array.isArray(p16.diplomatic_shifts)) {
              p16.diplomatic_shifts.forEach(function(ds) {
                if (ds.from && ds.to && ds.new_relation) {
                  addEB('\u5916\u4EA4\u98CE\u5411', ds.from+'\u2192'+ds.to+' \u915D\u917F '+ds.new_relation);
                }
              });
            }
            _specialtySummary.sc16 = '\u3010\u52BF\u529B\u52A8\u6001\u3011' + (p16.power_balance_shift||'') + '\n';
            GM._turnAiResults.subcall16 = p16;
          }
        }
      } catch(e16) { _dbg('[Faction Auto] fail:', e16); throw e16; }
      }); }, // end Sub-call 1.6 _runSubcall

      // --- Sub-call 1.7: 经济财政专项推演 --- [full only]
      function(){ return _runSubcall('sc17', '经济财政', 'full', async function() {
      showLoading("\u7ECF\u6D4E\u8D22\u653F\u63A8\u6F14",65);
      try {
        var tp17 = '\u672C\u56DE\u5408\u7ECF\u6D4E\u8D22\u653F\u72B6\u51B5\uFF1A\n';
        Object.entries(GM.vars||{}).forEach(function(e) { tp17 += '  ' + e[0] + '=' + Math.round(e[1].value) + (e[1].unit||'') + '\n'; });
        if (GM.provinceStats) {
          tp17 += '\u5730\u65B9\u533A\u5212\uFF1A\n';
          Object.entries(GM.provinceStats).forEach(function(e) { var ps=e[1]; tp17 += '  ' + e[0] + ' \u7A0E'+ps.taxRevenue+' \u8D22'+ps.wealth+' \u6C11\u53D8'+Math.round(ps.unrest)+' \u8150'+Math.round(ps.corruption)+'\n'; });
        }
        if (p1 && p1.resource_changes) tp17 += '\u672C\u56DE\u5408\u8D44\u6E90\u53D8\u5316\uFF1A' + JSON.stringify(p1.resource_changes) + '\n';
        tp17 += '\n\u8BF7\u8FD4\u56DEJSON\uFF1A{"fiscal_analysis":"\u8D22\u653F\u5B8C\u6574\u5206\u6790\u2014\u2014\u6536\u5165\u6765\u6E90\u3001\u652F\u51FA\u538B\u529B\u3001\u76C8\u4E8F\u72B6\u51B5(200\u5B57)","trade_dynamics":"\u8D38\u6613\u548C\u5546\u4E1A\u52A8\u6001(100\u5B57)","inflation_pressure":"\u901A\u80C0/\u7269\u4EF7\u538B\u529B(80\u5B57)","resource_forecast":"\u4E0B\u56DE\u5408\u8D44\u6E90\u9884\u6D4B(100\u5B57)","economic_advice":"\u7ECF\u6D4E\u5EFA\u8BAE\u2014\u2014\u5E94\u8BE5\u505A\u4EC0\u4E48\u4E0D\u5E94\u8BE5\u505A\u4EC0\u4E48(100\u5B57)","supplementary_resource_changes":{"\u53D8\u91CF\u540D":\u8865\u5145\u53D8\u5316\u91CF}}';
        var _sc17Body = {model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp17}], temperature:0.6, max_tokens:_tok(12000)};
        if (_modelFamily === 'openai') _sc17Body.response_format = { type: 'json_object' };
        var _sc17Call = await _callFollowupAI(_sc17Body, { id: 'sc17', label: '资源变动', priority: 'normal' });
        {
          var j17 = _sc17Call.data; _checkTruncated(j17, '资源变动'); var c17 = _sc17Call.raw || '';
          var _p17Parse = await _parseOrRepairJsonResult(c17, j17, '资源变动', { url: url, key: P.ai.key, body: _sc17Body, expectedKeys: ['fiscal_analysis', 'supplementary_resource_changes', 'economic_advice'], priority: 'normal' });
          if (_p17Parse && _p17Parse.raw) c17 = _p17Parse.raw;
          var p17 = _p17Parse ? _p17Parse.parsed : null;
          if (p17) {
            if (p17.supplementary_resource_changes && typeof p17.supplementary_resource_changes === 'object') {
              Object.entries(p17.supplementary_resource_changes).forEach(function(e) {
                var d = parseFloat(e[1]); if (isNaN(d) || !GM.vars[e[0]]) return;
                d = clamp(d, -GM.vars[e[0]].max*0.03, GM.vars[e[0]].max*0.03);
                if (Math.abs(d) >= 0.1) GM.vars[e[0]].value = clamp(GM.vars[e[0]].value+d, GM.vars[e[0]].min, GM.vars[e[0]].max);
              });
            }
            _specialtySummary.sc17 = '\u3010\u8D22\u653F\u3011' + (p17.fiscal_analysis||'').substring(0,100) + '\n';
            GM._turnAiResults.subcall17 = p17;
          }
        }
      } catch(e17) { _dbg('[Econ] fail:', e17); throw e17; }
      }); }, // end Sub-call 1.7 _runSubcall

      // --- Sub-call 1.8: 军事态势专项推演 --- [full only]
      function(){ return _runSubcall('sc18', '军事态势', 'full', async function() {
      showLoading("\u519B\u4E8B\u6001\u52BF\u63A8\u6F14",67);
      try {
        var tp18 = '\u672C\u56DE\u5408\u519B\u4E8B\u6001\u52BF\uFF1A\n';
        // 找出玩家势力
        var _playerFac = '';
        try { var _pcM = (GM.chars||[]).find(function(c){return c&&c.isPlayer;}); if (_pcM) _playerFac = _pcM.faction || ''; } catch(_){}
        // 按势力分组列兵·清晰显示"我方/敌方/中立"
        var _armyByFac = {};
        (GM.armies||[]).forEach(function(a) {
          if (a.destroyed) return;
          var fac = a.faction || '无势力';
          if (!_armyByFac[fac]) _armyByFac[fac] = [];
          _armyByFac[fac].push(a);
        });
        Object.keys(_armyByFac).forEach(function(fac) {
          var marker = fac === _playerFac ? '【我方·'+fac+'】' : ('【'+fac+'·敌/中】');
          tp18 += '\n' + marker + '\n';
          _armyByFac[fac].forEach(function(a) {
            tp18 += '  ' + a.name + ' 兵' + (a.soldiers||0) + ' 士气' + (a.morale||50) + ' 训' + (a.training||50) + (a.commander?' 帅:'+a.commander:'') + (a.garrison?' 驻:'+a.garrison:'') + '\n';
          });
        });
        if (p1 && p1.army_changes && p1.army_changes.length > 0) tp18 += '\u672C\u56DE\u5408\u519B\u4E8B\u53D8\u52A8\uFF1A' + p1.army_changes.map(function(a){return a.name+' \u5175'+a.soldiers_delta;}).join('\uFF1B') + '\n';
        try {
          var _phase5Systems = (typeof MilitarySystems !== 'undefined' && MilitarySystems.getMilitarySystems) ? MilitarySystems.getMilitarySystems(GM) : null;
          if (_phase5Systems && _phase5Systems.length) {
            tp18 += '\n\u3010\u672c\u671d\u5175\u5236\u53c2\u8003\u3011\n';
            _phase5Systems.slice(0, 8).forEach(function(ms) {
              tp18 += '  - ' + ms.id + '\u00b7' + ms.name + '\u00b7recruitment=' + ms.recruitmentType + '\u00b7salary=' + ms.salaryType + '\u00b7loyalty=' + ms.loyaltyAttribution + '\n';
            });
          }
        } catch(_phase5SysE) {}

        tp18 += '\n【铁律·势力军事自主】\n';
        tp18 += '· 非玩家势力（后金/察哈尔/朝鲜/郑氏/流民/外族等）的军队·由你自主推演其军事行动：扩张/掠袭/征服/防御/内争/联盟/背叛\n';
        tp18 += '· 各势力按其性格+战略+资源自主决策——后金必图辽西·皇太极可能绕蒙古入塞；察哈尔被后金逼西迁；朝鲜夹缝求存；郑氏海商谋台海\n';
        tp18 += '· 敌方势力兵力·玩家不可直接调动·但可通过外交/册封/招抚/挑衅影响其行动\n';
        tp18 += '· 两势力交锋·按双方兵力/士气/装备/补给/训练/统帅能力综合推演·给出具体伤亡与结果\n';
        tp18 += '· 每个非玩家势力本回合应至少 1 条 faction_military_actions 条目（兵力调动/作战/备战/征募等）\n';
        tp18 += '\n请返回JSON：{"military_situation":"全局军事态势分析(200字)","border_threats":"边境威胁评估(150字)","army_morale_analysis":"各军士气分析和风险(100字)","supplementary_army_changes":[{"name":"部队","faction":"所属","soldiers_delta":0,"morale_delta":0,"reason":""}],"faction_military_actions":[{"faction":"势力名","action":"军事行动30字","targetFaction":"目标势力可空","casualties":0,"outcome":"结果30字","rationale":"动机30字"}],"war_probability":"下回合爆发战争的概率和方向(80字)"}';
        tp18 += '\n\u82e5\u672c\u56de\u5408\u660e\u786e\u53d1\u751f\u4e00\u573a\u53ef\u843d\u5730\u6218\u6597/\u5360\u57ce\uff0c\u8fd8\u5fc5\u987b\u8fd4\u56de battleResult:{winnerFactionId,loserFactionId,occupiedCityIds,casualties:{attacker,defender},affectedArmies:[{armyId,side,loss,moraleDelta,loyaltyDelta,state,commanderFate}],attackerArmyId,defenderArmyId,commanderFate:{name,outcome},postBattleEffects[]}.\u82e5\u591a\u573a\u6218\u6597\uff0c\u9009\u6700\u91cd\u5927\u4e00\u573a\u5199 battleResult\uff0c\u5176\u4f59\u7559\u5728 faction_military_actions\u3002';
        var _sc18Body = {model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp18}], temperature:0.7, max_tokens:_tok(12000)};
        if (_modelFamily === 'openai') _sc18Body.response_format = { type: 'json_object' };
        var _sc18Call = await _callFollowupAI(_sc18Body, { id: 'sc18', label: '军事变动', priority: 'normal' });
        {
          var j18 = _sc18Call.data; _checkTruncated(j18, '军事变动'); var c18 = _sc18Call.raw || '';
          var _p18Parse = await _parseOrRepairJsonResult(c18, j18, '军事变动', { url: url, key: P.ai.key, body: _sc18Body, expectedKeys: ['military_situation', 'supplementary_army_changes', 'faction_military_actions', 'battleResult'], priority: 'normal' });
          if (_p18Parse && _p18Parse.raw) c18 = _p18Parse.raw;
          var p18 = _p18Parse ? _p18Parse.parsed : null;
          if (p18) {
            var _battleResultCasualtyFactions = {};
            if (p18.battleResult && typeof MilitarySystems !== 'undefined' && MilitarySystems.applyBattleResult) {
              var _phase5Battle = MilitarySystems.applyBattleResult(p18.battleResult, GM);
              if (_phase5Battle && _phase5Battle.ok && typeof addEB === 'function') {
                addEB('\u519b\u4e8b', '\u6218\u62a5\u7ed3\u6784\u5316\u843d\u5730\uff1a' + (_phase5Battle.result.winner || '') + '\u80dc' + (_phase5Battle.result.loser || ''));
              }
              if (_phase5Battle && _phase5Battle.ok && _phase5Battle.result) {
                (_phase5Battle.result.affectedArmies || []).forEach(function(ba) {
                  var bf = ba && (ba.faction || ba.owner || '');
                  var bl = Math.max(0, parseInt(ba && ba.loss) || 0);
                  if (bf && bl > 0) _battleResultCasualtyFactions[bf] = (_battleResultCasualtyFactions[bf] || 0) + bl;
                });
                if (Object.keys(_battleResultCasualtyFactions).length === 0 && p18.battleResult.casualties) {
                  var _brCas = p18.battleResult.casualties || {};
                  var _brWinner = p18.battleResult.winnerFactionId || p18.battleResult.winnerFaction || p18.battleResult.winner || '';
                  var _brLoser = p18.battleResult.loserFactionId || p18.battleResult.loserFaction || p18.battleResult.loser || '';
                  if (_brWinner && ((parseInt(_brCas.attacker) || 0) > 0)) _battleResultCasualtyFactions[_brWinner] = parseInt(_brCas.attacker) || 0;
                  if (_brLoser && ((parseInt(_brCas.defender) || 0) > 0)) _battleResultCasualtyFactions[_brLoser] = parseInt(_brCas.defender) || 0;
                }
              }
            }
            if (p18.supplementary_army_changes && Array.isArray(p18.supplementary_army_changes)) {
              p18.supplementary_army_changes.forEach(function(ac) {
                if (!ac.name) return;
                if (typeof global.applyAIArmyChange === 'function') {
                  global.applyAIArmyChange(ac, { source: 'sc18.supplementary_army_changes' });
                  return;
                }
                var army = (GM.armies||[]).find(function(a){return a.name===ac.name;});
                if (army) {
                  if (ac.soldiers_delta) army.soldiers = Math.max(0, (army.soldiers||0) + clamp(parseInt(ac.soldiers_delta)||0, -2000, 2000));
                  if (ac.morale_delta) army.morale = clamp((army.morale||50) + clamp(parseInt(ac.morale_delta)||0, -15, 15), 0, 100);
                  if (ac.reason) addEB('\u519B\u4E8B', army.name + '：' + ac.reason);
                }
              });
            }
            // 各势力军事行动
            if (Array.isArray(p18.faction_military_actions) && p18.faction_military_actions.length > 0) {
              if (!GM._factionMilitaryLog) GM._factionMilitaryLog = [];
              p18.faction_military_actions.forEach(function(fa) {
                if (!fa || !fa.faction) return;
                GM._factionMilitaryLog.push({
                  turn: GM.turn, faction: fa.faction, target: fa.targetFaction||'',
                  action: (fa.action||'').substring(0, 60),
                  casualties: parseInt(fa.casualties)||0,
                  outcome: (fa.outcome||'').substring(0, 60),
                  rationale: (fa.rationale||'').substring(0, 60)
                });
                if (typeof addEB==='function') addEB('势力军事', fa.faction + (fa.targetFaction?'→'+fa.targetFaction:'') + '：' + (fa.action||'').substring(0,40) + (fa.casualties?'·伤亡'+fa.casualties:''));
                // 若伤亡·自动给该势力所属军兵力扣减
                if (fa.casualties > 0) {
                  var _alreadyAppliedCasualties = _battleResultCasualtyFactions[fa.faction] || 0;
                  var _skipCasualtyWriteback = _alreadyAppliedCasualties >= (parseInt(fa.casualties) || 0);
                  var _extraCasualties = _skipCasualtyWriteback ? 0 : Math.max(0, (parseInt(fa.casualties) || 0) - _alreadyAppliedCasualties);
                  var facArmies = (GM.armies||[]).filter(function(a){return a && a.faction===fa.faction;});
                  if (!_skipCasualtyWriteback && _extraCasualties > 0 && facArmies.length > 0) {
                    var perArmy = Math.floor(_extraCasualties / facArmies.length);
                    facArmies.forEach(function(aa){ aa.soldiers = Math.max(0, (aa.soldiers||0) - perArmy); });
                  }
                }
              });
              // 上限保持最近 200 条
              if (GM._factionMilitaryLog.length > 200) GM._factionMilitaryLog = GM._factionMilitaryLog.slice(-200);
            }
            _specialtySummary.sc18 = '\u3010\u519B\u4E8B\u3011' + (p18.military_situation||'').substring(0,100) + '\n';
            GM._turnAiResults.subcall18 = p18;
          }
        }
      } catch(e18) { _dbg('[Military] fail:', e18); throw e18; }
      }); } // end Sub-call 1.8 _runSubcall
      ], 3);

      // --- SC_CONSISTENCY_AUDIT: 深化数据一致性审核（方向7扩展·S3） ---
      // 扫描 SC16/17/18 彼此的输出是否冲突·auto-patch 或 rerun
      // 保持前台收束：审计可能修正 _turnAiResults 中被 sc2 摘要读取的对象引用。
      var _runConsistencyAudit = async function(){ return _runSubcall('sc_audit', '数据一致性审核', 'lite', async function() {
      _quietLoad("\u6570\u636E\u4E00\u81F4\u6027\u5BA1\u6838", 66);
      try {
        var _tres = GM._turnAiResults || {};
        var tpAu = '【任务·跨 sub-call 数据一致性审核】\n\n';
        tpAu += '<subcall-1-core>\n';
        if (_tres.subcall1) {
          tpAu += '  <faction-events>' + JSON.stringify((_tres.subcall1.faction_events||[]).slice(0,20)) + '</faction-events>\n';
          tpAu += '  <fiscal>' + JSON.stringify((_tres.subcall1.fiscal_adjustments||[]).slice(0,20)) + '</fiscal>\n';
          tpAu += '  <army>' + JSON.stringify((_tres.subcall1.army_changes||[]).slice(0,20)) + '</army>\n';
        }
        tpAu += '</subcall-1-core>\n';
        tpAu += '<subcall-16-faction>' + JSON.stringify((_tres.subcall16||{})).substring(0,2000) + '</subcall-16-faction>\n';
        tpAu += '<subcall-17-economy>' + JSON.stringify((_tres.subcall17||{})).substring(0,2000) + '</subcall-17-economy>\n';
        tpAu += '<subcall-18-military>' + JSON.stringify((_tres.subcall18||{})).substring(0,2000) + '</subcall-18-military>\n\n';
        tpAu += '【检查项】\n';
        tpAu += '1. 势力 strength 变化 vs 兵力变化是否矛盾（大增兵却势力减·反之）\n';
        tpAu += '2. fiscal_adjustments 金额 vs 军费/赈济/赏赐叙事是否一致\n';
        tpAu += '3. 同一势力/角色在不同 sub-call 中状态是否矛盾\n';
        tpAu += '4. 因果是否倒置（结果在原因之前）\n\n';
        tpAu += '【输出 JSON】\n';
        tpAu += '{\n';
        tpAu += '  "conflicts": [\n';
        tpAu += '    {\n';
        tpAu += '      "field_a": "sc16.faction.东林党.strength:+5",\n';
        tpAu += '      "field_b": "sc18.army_changes.东林党.soldiers:-2000",\n';
        tpAu += '      "nature": "势力增强但兵力骤减·逻辑矛盾",\n';
        tpAu += '      "severity": "high/mid/low",\n';
        tpAu += '      "resolution": "以 sc18 为准·下调 sc16 strength_delta 到 -3"\n';
        tpAu += '    }\n';
        tpAu += '  ],\n';
        tpAu += '  "auto_patches": [{"path":"subcall1.faction_events[0].strength_effect","op":"set","value":-3,"reason":"..."}],\n';
        tpAu += '  "needs_rerun": ["sc16"]\n';
        tpAu += '}\n';
        tpAu += '如无冲突·全部字段返回空数组 []。';

        // Phase 5.1 三模型解耦：sc_audit (Reviewer 角色) 优先用次要 API·没配则回退主要
        var _auTier = (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : 'primary';
        var _auCfg = (typeof _getAITier === 'function') ? _getAITier(_auTier) : { key: P.ai.key, url: url, model: P.ai.model || 'gpt-4o' };
        var _auUrl = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(_auTier) : url;
        _dbg('[sc_audit] using tier:', _auCfg.tier || _auTier, 'model:', _auCfg.model);
        var _auditBody = {
          model: _auCfg.model,
          messages: [{ role: "system", content: "You are a strict data consistency auditor. Return JSON only." }, { role: "user", content: tpAu }],
          temperature: 0.2,
          max_tokens: _tok(3000)
        };
        if (_tmDetectModelFamily(_auCfg.model, _modelFamily) === 'openai') _auditBody.response_format = { type: 'json_object' };
        var _auditCall = await _callFollowupAI(_auditBody, { id: 'sc_audit', label: '数据一致性审核', url: _auUrl, key: _auCfg.key, priority: 'normal' });
        {
          var dataAu = _auditCall.data;
          var cAu = _auditCall.raw || '';
          var _pAuParse = await _parseOrRepairJsonResult(cAu, dataAu, '数据一致性审核', { url: _auUrl, key: _auCfg.key, body: _auditBody, expectedKeys: ['conflicts', 'auto_patches', 'needs_rerun'], priority: 'normal' });
          if (_pAuParse && _pAuParse.raw) cAu = _pAuParse.raw;
          var pAu = _pAuParse ? _pAuParse.parsed : null;
          if (pAu) {
            GM._turnAiResults.subcallAudit = pAu;
            var conflictCount = (pAu.conflicts || []).length;
            if (conflictCount > 0) {
              _dbg('[Consistency Audit] 发现', conflictCount, '项冲突');
              // 应用 auto_patches（支持数组索引 foo[0].bar 路径）
              if (Array.isArray(pAu.auto_patches)) {
                pAu.auto_patches.forEach(function(ap) {
                  if (!ap || !ap.path) return;
                  try {
                    // 拆分路径 · 处理形如 subcall1.faction_events[0].strength_effect
                    var tokens = [];
                    ap.path.split('.').forEach(function(seg) {
                      var m = /^([^\[]+)((?:\[\d+\])+)?$/.exec(seg);
                      if (!m) { tokens.push(seg); return; }
                      tokens.push(m[1]);
                      var rest = m[2] || '';
                      var idxM;
                      var idxRe = /\[(\d+)\]/g;
                      while ((idxM = idxRe.exec(rest)) !== null) {
                        tokens.push(parseInt(idxM[1], 10));
                      }
                    });
                    var obj = GM._turnAiResults;
                    for (var i = 0; i < tokens.length - 1; i++) {
                      if (obj == null) return;
                      obj = obj[tokens[i]];
                    }
                    if (obj == null) return;
                    if (ap.op === 'set') obj[tokens[tokens.length-1]] = ap.value;
                    else if (ap.op === 'delta' && typeof obj[tokens[tokens.length-1]] === 'number') obj[tokens[tokens.length-1]] += (parseFloat(ap.value) || 0);
                    _dbg('[Audit] 自动修正:', ap.path, '=', ap.value);
                  } catch(_ape) { _dbg('[Audit] 修正失败:', ap.path, _ape); }
                });
              }
              // 严重冲突入 turnReport 让玩家看到
              if (!GM._turnReport) GM._turnReport = [];
              GM._turnReport.push({
                type: 'consistency_audit',
                conflicts: pAu.conflicts.slice(0, 10),
                turn: GM.turn || 0
              });
            }
          }
        }
      } catch(eAu) { _dbg('[Consistency Audit] fail:', eAu); }
      }); }; // end SC_CONSISTENCY_AUDIT

      // --- Sub-call 1.9: 新实体丰化（复用编辑器 AI 级 schema，填充骨架） ---
      // ★ 后台化（2026-04-30）：丰化仅填充 GM.facs/classes/parties/chars 已存在骨架的空字段；
      //   不影响当回合叙事；_RETRY_WINDOW=3 回合保护未完成情况
      _queuePostTurnSubcall('sc19', function(){ return _runSubcall('sc19', '新实体丰化', 'lite', async function() {
        try {
          var _RETRY_WINDOW = 3; // 失败后 3 回合内可重试
          var _playerFacNames19 = _tmResolvePlayerFactionNamesForAi(GM, P);
          var _sparseFacs = (GM.facs||[]).filter(function(f) {
            return f._createdTurn != null && (GM.turn - f._createdTurn) <= _RETRY_WINDOW && !f._enriched && !_tmIsPlayerFactionForAi(f, _playerFacNames19);
          });
          var _sparseClasses = (GM.classes||[]).filter(function(c) {
            return c._emergeTurn != null && (GM.turn - c._emergeTurn) <= _RETRY_WINDOW && !c._enriched;
          });
          var _sparseParties = (GM.parties||[]).filter(function(p) {
            return p._createdTurn != null && (GM.turn - p._createdTurn) <= _RETRY_WINDOW && !p._enriched;
          });
          var _sparseChars = (GM.chars||[]).filter(function(c) {
            var _turn = (c._spawnedFromOffice && c._spawnedFromOffice.turn)
              || (c._spawnedFromRevolt && c._spawnedFromRevolt.turn)
              || c._createdTurn;
            return _turn != null && (GM.turn - _turn) <= _RETRY_WINDOW && !c._enriched;
          });

          var _totalSparse = _sparseFacs.length + _sparseClasses.length + _sparseParties.length + _sparseChars.length;
          if (_totalSparse === 0) return; // 无新实体，跳过

          _quietLoad('AI 丰化新实体（' + _totalSparse + '项）', 68);
          _dbg('[Enrich] 丰化 ' + _totalSparse + ' 项：facs' + _sparseFacs.length + ' classes' + _sparseClasses.length + ' parties' + _sparseParties.length + ' chars' + _sparseChars.length);

          var dynasty = sc.dynasty || sc.era || '';
          var startY = sc.startYear || (sc.gameSettings && sc.gameSettings.startYear) || '';
          var _existingClassNames = (GM.classes||[]).map(function(c){return c.name;}).join('、');
          var _existingCharNames = (GM.chars||[]).filter(function(c){return c.alive!==false;}).slice(0, 60).map(function(c){return c.name;}).join('、');

          var enrichP = '你是' + dynasty + '历史学家。当前是公元' + startY + '年+' + GM.turn + '回合。以下新出现的实体只有骨架，请按史实风格补齐完整字段。\n\n';
          enrichP += '【数值基准——必须遵守】\n';
          enrichP += '· 角色能力按档：顶级92-98/优秀80-91/中等60-79/平庸40-59/拙劣<40\n';
          enrichP += '  武将：valor/military 高；文臣：administration/intelligence 高；管理者：management 高；后妃：charisma 高\n';
          enrichP += '  武勇(个人武力)≠军事(统兵)：吕布 valor99 military70；诸葛亮 military95 valor25\n';
          enrichP += '  治政(行政)≠管理(理财)：王安石 administration88 management92；桑弘羊 management98 administration75\n';
          enrichP += '· 五常(仁义礼智信)按性格定位：compassionate→仁高；just/zealous→义高；humble→礼高；intelligence 约等于 智；honest→信高\n';
          enrichP += '· 起义领袖：charisma 75-90 valor 60-80 benevolence 40-70 loyalty 5-20（对旧朝）\n';
          enrichP += '· 官制占位实体化：品级与能力不强绑——高品可有恩荫庸才(adm40)，低品可有潜龙大才(adm90)；\n';
          enrichP += '  主官通常能力中上(主维度 60-85)，佐官 50-75，小吏 40-65；但特殊情况皆可（贬谪/恩荫/潜龙）\n';
          enrichP += '· 每人数值必须不同，不得雷同！\n\n';

          if (_sparseFacs.length > 0) {
            enrichP += '【待丰化·势力】\n';
            _sparseFacs.forEach(function(f) {
              enrichP += '  ' + f.name + ' 类型:' + (f.type||'?') + ' 首脑:' + (f.leader||'?') + ' 领地:' + (f.territory||'?') + '\n';
              if (f.parentFaction) enrichP += '    脱离自:' + f.parentFaction + '\n';
              if (f.description) enrichP += '    背景:' + f.description + '\n';
            });
            enrichP += '  每个势力须返回:\n';
            enrichP += '    leaderInfo:{name,age,gender,personality(30字),belief,learning,ethnicity,bio(80字)}\n';
            enrichP += '    heirInfo(可null)、resources(主要资源)、mainstream(主体民族/信仰)、culture(文化特征)\n';
            enrichP += '    goal(战略目标 20字)、militaryBreakdown(若缺则按 militaryStrength 分解)\n';
            enrichP += '    description(100-150字 补全历史背景、政治特点、与玩家关系)\n';
          }

          if (_sparseClasses.length > 0) {
            enrichP += '\n【待丰化·阶层】\n';
            _sparseClasses.forEach(function(c) {
              enrichP += '  ' + c.name + (c._origin?' 源于:'+c._origin:'') + (c.description?' 描述:'+c.description.slice(0,80):'') + '\n';
            });
            enrichP += '  参考现有阶层名:' + _existingClassNames + '（勿重复）\n';
            enrichP += '  参考现有角色:' + _existingCharNames + '\n';
            enrichP += '  每个阶层须返回:\n';
            enrichP += '    representativeNpcs:[从上列角色中挑选 2-4 个]\n';
            enrichP += '    leaders:[领袖 1-3 人，可与代表重合]\n';
            enrichP += '    supportingParties:[{class:"倾向支持的党派",affinity:0.5-1}]\n';
            enrichP += '    regionalVariants:[2-4 个地域变体 {region,satisfaction,distinguishing}]\n';
            enrichP += '    internalFaction:[1-2 个内部分化 {name,size,stance}]\n';
            enrichP += '    privileges、obligations、demands 补全\n';
          }

          if (_sparseParties.length > 0) {
            enrichP += '\n【待丰化·党派】\n';
            _sparseParties.forEach(function(p) {
              enrichP += '  ' + p.name + ' 立场:' + (p.ideology||'?') + ' 首领:' + (p.leader||'?') + ' 议程:' + (p.currentAgenda||'?') + '\n';
            });
            enrichP += '  参考现有角色:' + _existingCharNames + '\n';
            enrichP += '  参考现有阶层:' + _existingClassNames + '\n';
            enrichP += '  每个党派须返回:\n';
            enrichP += '    shortGoal、longGoal、description(100字)\n';
            enrichP += '    members(主要成员，逗号分隔，从现有角色中选 3-6 人)\n';
            enrichP += '    base(支持群体如"士绅/寒门/军功贵族")\n';
            enrichP += '    policyStance(政策立场标签 3-5 个)\n';
            enrichP += '    socialBase:[{class,affinity:-1~1}]（补全与阶层关联）\n';
            enrichP += '    agenda_history:[{turn:负数回溯,agenda,outcome}]（回溯 1-2 条历史）\n';
            enrichP += '    focal_disputes:[{topic,rival,stakes}]\n';
          }

          if (_sparseChars.length > 0) {
            enrichP += '\n【待丰化·角色】\n';
            _sparseChars.forEach(function(c) {
              var _origin = c._spawnedFromRevolt ? ('起义领袖：'+c._spawnedFromRevolt.class)
                : c._spawnedFromOffice ? ('官制实体化：'+c._spawnedFromOffice.dept+c._spawnedFromOffice.position)
                : '新出场';
              enrichP += '  ' + c.name + (c.title?'('+c.title+')':'') + ' ' + _origin + '\n';
              if (c.age) enrichP += '    年' + c.age + ' 忠' + (c.loyalty||50) + ' 政' + (c.administration||50) + ' 武' + (c.valor||50) + '\n';
            });
            enrichP += '  每个角色须返回:\n';
            enrichP += '    family(家族)、birthplace(籍贯)、ethnicity(民族)、culture(文化背景)\n';
            enrichP += '    learning(学识如"经学/律学/兵法")、faith(信仰)\n';
            enrichP += '    speechStyle(说话风格 20字)、personalGoal(心中所求 30字)\n';
            enrichP += '    personality(性格 40字)、bio(生平 80-120字)\n';
            enrichP += '    appearance(外貌 30字)\n';
            enrichP += '    traits:[特质标签 3-5 个，如"刚直/狡诈/仁厚/多疑"]\n';
          }

          enrichP += '\n返回 JSON：{\n';
          if (_sparseFacs.length) enrichP += '"factions_enriched":[{"name":"原势力名(锚点)","leaderInfo":{...},"heirInfo":{...}或null,"resources":"","mainstream":"","culture":"","goal":"","description":""}],\n';
          if (_sparseClasses.length) enrichP += '"classes_enriched":[{"name":"","representativeNpcs":[],"leaders":[],"supportingParties":[{"class":"","affinity":0.5}],"regionalVariants":[],"internalFaction":[],"privileges":"","obligations":"","demands":""}],\n';
          if (_sparseParties.length) enrichP += '"parties_enriched":[{"name":"","shortGoal":"","longGoal":"","description":"","members":"","base":"","policyStance":[],"socialBase":[],"agenda_history":[],"focal_disputes":[]}],\n';
          if (_sparseChars.length) enrichP += '"characters_enriched":[{"name":"","family":"","birthplace":"","ethnicity":"","culture":"","learning":"","faith":"","speechStyle":"","personalGoal":"","personality":"","bio":"","appearance":"","traits":[]}]\n';
          enrichP += '}\n请严格按史实生成；name 必须精确对应上方骨架名。';

          var _enrichBody = {
            model: P.ai.model || 'gpt-4o',
            messages: [{ role: 'user', content: enrichP }],
            temperature: 0.7,
            max_tokens: _tok(3000)
          };
          if (_modelFamily === 'openai') _enrichBody.response_format = { type: 'json_object' };
          var _enrichCall = null;
          try {
            _enrichCall = await _callFollowupAI(_enrichBody, { id: 'sc19', label: '角色势力细节补全', priority: 'background', timeoutMs: 45000, maxRetries: 0 });
          } catch(_enrichHttpE) {
            _dbg('[Enrich] call failed', _enrichHttpE && _enrichHttpE.message || _enrichHttpE);
            return;
          }
          var dataE = _enrichCall.data;
          var cE = _enrichCall.raw || '';
          var _enrichExpectedKeys = [];
          if (_sparseFacs.length) _enrichExpectedKeys.push('factions_enriched');
          if (_sparseClasses.length) _enrichExpectedKeys.push('classes_enriched');
          if (_sparseParties.length) _enrichExpectedKeys.push('parties_enriched');
          if (_sparseChars.length) _enrichExpectedKeys.push('characters_enriched');
          var _pEParse = await _parseOrRepairJsonResult(cE, dataE, '角色势力细节补全', { url: url, key: P.ai.key, body: _enrichBody, expectedKeys: _enrichExpectedKeys, priority: 'background', repair: false });
          if (_pEParse && _pEParse.raw) cE = _pEParse.raw;
          var pE = _pEParse ? _pEParse.parsed : null;
          if (!pE) { _dbg('[Enrich] JSON 解析失败'); return; }

          // 合并回 GM——只覆盖空字段，保留 AI 已生成的内容
          function _mergeIfEmpty(target, src, keys) {
            keys.forEach(function(k) {
              var v = src[k];
              if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return;
              var tv = target[k];
              var isEmpty = tv === undefined || tv === null || tv === '' || (Array.isArray(tv) && tv.length === 0) || (typeof tv === 'object' && !Array.isArray(tv) && Object.keys(tv||{}).length === 0);
              if (isEmpty) target[k] = v;
            });
          }

          if (Array.isArray(pE.factions_enriched)) {
            pE.factions_enriched.forEach(function(ef) {
              if (!ef || !ef.name) return;
              var tgt = GM.facs.find(function(f){return f.name === ef.name;});
              if (!tgt) return;
              _mergeIfEmpty(tgt, ef, ['leaderInfo','heirInfo','resources','mainstream','culture','goal']);
              if (ef.description && (!tgt.description || tgt.description.length < 80)) tgt.description = ef.description;
              if (ef.militaryBreakdown && tgt.militaryBreakdown) _mergeIfEmpty(tgt.militaryBreakdown, ef.militaryBreakdown, ['standingArmy','militia','elite','fleet']);
              tgt._enriched = true;
              _dbg('[Enrich] faction done: ' + ef.name);
            });
          }
          if (Array.isArray(pE.classes_enriched)) {
            pE.classes_enriched.forEach(function(ec) {
              if (!ec || !ec.name) return;
              var tgt = GM.classes.find(function(c){return c.name === ec.name;});
              if (!tgt) return;
              _mergeIfEmpty(tgt, ec, ['representativeNpcs','leaders','supportingParties','regionalVariants','internalFaction','privileges','obligations','demands']);
              tgt._enriched = true;
              _dbg('[Enrich] class done: ' + ec.name);
            });
          }
          if (Array.isArray(pE.parties_enriched)) {
            pE.parties_enriched.forEach(function(ep) {
              if (!ep || !ep.name) return;
              var tgt = GM.parties.find(function(p){return p.name === ep.name;});
              if (!tgt) return;
              _mergeIfEmpty(tgt, ep, ['shortGoal','longGoal','description','members','base','policyStance','socialBase','agenda_history','focal_disputes']);
              tgt._enriched = true;
              _dbg('[Enrich] party done: ' + ep.name);
            });
          }
          if (Array.isArray(pE.characters_enriched)) {
            pE.characters_enriched.forEach(function(ech) {
              if (!ech || !ech.name) return;
              var tgt = findCharByName(ech.name);
              if (!tgt) return;
              _mergeIfEmpty(tgt, ech, ['family','birthplace','ethnicity','culture','learning','faith','speechStyle','personalGoal','personality','bio','appearance','traits']);
              tgt._enriched = true;
              // 写入 NPC 记忆：初始身世记忆
              if (typeof NpcMemorySystem !== 'undefined' && ech.bio) {
                NpcMemorySystem.remember(ech.name, '身世：' + ech.bio.slice(0, 60), '平', 5);
              }
              _dbg('[Enrich] char done: ' + ech.name);
            });
          }

          if (GM._turnAiResults) GM._turnAiResults.subcall19 = pE;
          addEB('\u4E30\u5316', '\u672C\u56DE\u5408\u4E30\u5316\u65B0\u5B9E\u4F53 ' + _totalSparse + ' \u9879');
          _dbg('[Enrich] 完成 ' + _totalSparse + ' 项丰化');
        } catch (eE) { _dbg('[Enrich] fail:', eE); }
      }); }); // end Sub-call 1.9 (queued post-turn)

      // ── Branch C · 后人戏说 → 叙事审查 ──
      // 会读取 GM/p1 当前世界状态，必须等 sc16/17/18 的补充变动和一致性审计收束后再跑。
      var _runBranchC = async function() {
      // --- Sub-call 2: 后人戏说（场景叙事，完整生活进程） --- [always runs]
      await _runSubcall('sc2', '后人戏说', 'lite', async function() {
      showLoading("AI撰写后人戏说",70);
      // 将Sub-call 1的决策摘要传给Sub-call 2，确保叙事与数据一致
      p1Summary = '';
      if (p1) {
        if (shizhengji) p1Summary += '【时政记(摘要)】' + shizhengji.substring(0, 400) + '\n';
        if (shiluText) p1Summary += '【实录】' + shiluText + '\n';
        if (p1.npc_actions && p1.npc_actions.length > 0) {
          p1Summary += '【NPC行动】' + p1.npc_actions.map(function(a) { return a.name + ':' + a.action; }).join('；') + '\n';
        }
        if (p1.character_deaths && p1.character_deaths.length > 0) {
          p1Summary += '【死亡】' + p1.character_deaths.map(function(d) { return d.name + ':' + d.reason; }).join('；') + '\n';
        }
        if (p1.event && p1.event.title) p1Summary += '【事件】' + p1.event.title + '\n';
        if (personnelChanges && personnelChanges.length > 0) {
          p1Summary += '【人事】' + personnelChanges.map(function(p){return p.name+'→'+p.change;}).join('；') + '\n';
        }
        // 额外上下文
        if (GM._energy !== undefined && GM._energy < 40) p1Summary += '【君主疲态】精力' + Math.round(GM._energy) + '%——应暗示倦容\n';
        if (GM._successionEvent) p1Summary += '【帝位更迭】' + GM._successionEvent.from + '→' + GM._successionEvent.to + '（重点描写）\n';
        if (GM._kejuPendingAssignment && GM._kejuPendingAssignment.length > 0) p1Summary += '【待铨】' + GM._kejuPendingAssignment.length + '名进士等待授官\n';
      }
      // 附加：玩家本回合推演依据（让AI明白哪些要体现在场景中）
      var _branchSpecialtySummary = _buildLateSpecialtySummary();
      if (_branchSpecialtySummary) p1Summary += _branchSpecialtySummary;
      var _basisBrief = '';
      // 名望/贤能显著变动的 NPC（供后人戏说穿插议论）
      try {
        var _fvMovers = (GM.chars || []).filter(function(c){
          return c && c.alive!==false && !c.isPlayer && c._fameHistory &&
                 c._fameHistory.some(function(h){return h.turn === GM.turn;});
        }).slice(0, 5);
        if (_fvMovers.length > 0) {
          _basisBrief += '【本回合名望/贤能显著变动的 NPC(可在后人戏说里穿插议论/清议/书院学子的评论)】\n';
          _fvMovers.forEach(function(c){
            var _thisTurn = (c._fameHistory||[]).filter(function(h){return h.turn===GM.turn;});
            var _totalD = _thisTurn.reduce(function(s,h){return s+(h.delta||0);},0);
            var _reasons = _thisTurn.map(function(h){return h.reason||'';}).filter(Boolean).slice(0,2).join('/');
            _basisBrief += '  · ' + c.name + ' 名望' + (_totalD>0?'+':'') + _totalD.toFixed(0) + '（' + _reasons + '）\n';
          });
        }
      } catch(_mvE){}
      if (edicts) {
        var _eL = [];
        if (edicts.political) _eL.push('政令:' + edicts.political.substring(0,60));
        if (edicts.military) _eL.push('军令:' + edicts.military.substring(0,60));
        if (edicts.diplomatic) _eL.push('外交:' + edicts.diplomatic.substring(0,60));
        if (edicts.economic) _eL.push('经济:' + edicts.economic.substring(0,60));
        if (edicts.other) _eL.push('其他:' + edicts.other.substring(0,60));
        if (_eL.length) _basisBrief += '\n【玩家诏令(须在场景中具体展开执行过程)】\n  ' + _eL.join('\n  ') + '\n';
      }
      if (xinglu) _basisBrief += '【主角私人行止(须作为主角日常生活片段呈现)】\n  ' + xinglu + '\n';
      if (memRes && memRes.length) {
        var _appMem = memRes.filter(function(m){return m.status==='approved'||m.status==='rejected';}).slice(0,5);
        if (_appMem.length) {
          _basisBrief += '【本回合奏疏批复(至少一份要在场景中被具体展开)】\n';
          _appMem.forEach(function(m){ _basisBrief += '  '+m.from+'('+m.type+')——'+(m.status==='approved'?'准':'驳')+(m.reply?' 批:'+m.reply.substring(0,30):'')+'\n'; });
        }
      }
      if (GM._courtRecords) {
        var _thisCourt = GM._courtRecords.filter(function(r){return (r.targetTurn||r.turn)===GM.turn;});
        if (_thisCourt.length) {
          _basisBrief += '【本回合朝议/问对(作为场景展现)】\n';
          _thisCourt.slice(-3).forEach(function(r){ _basisBrief += '  '+(r.topic||r.mode||'议事')+'\n'; });
        }
      }
      // 前议追责回响·涵盖常朝/廷议/御前·三回合到期·让后人戏说自然引及朝野余响(非数值修改·叙事种子)
      if (Array.isArray(GM._ty3_pendingReviewForPrompt) && GM._ty3_pendingReviewForPrompt.length > 0) {
        _basisBrief += '【前议追责·三回合前诏命到期(后人戏说应自然嵌入·非主线但可作议论/茶肆传闻/书院清议/家书提及)】\n';
        _basisBrief += '  ※ 按场所性质演绎反响位置：\n';
        _basisBrief += '    [廷议] → 茶肆/书院/官员私第议论·士论翕然或汹汹\n';
        _basisBrief += '    [常朝] → 衙门内外回响·部曹奉行或推诿\n';
        _basisBrief += '    [亲诏] → 民间惊议·近臣窃语·有司战兢\n';
        _basisBrief += '    [御前] → 不可明言·只能借密报/侍从私下流露·若泄则成大事\n';
        _basisBrief += '  ※ 据 outcome 体现：\n';
        _basisBrief += '    准奏果验 → 民间立祠/士子赋诗/茶肆称颂/政敌暗议\n';
        _basisBrief += '    行而未尽 → 朝野观望/书院叹息/老臣摇头/言路疑议\n';
        _basisBrief += '    奉行不力 → 言官追疏/政敌得势/承办者低首/家书诉冤\n';
        _basisBrief += '    适得其反 → 民间嗟叹/异象传闻/党狱兴起/旧友远遁\n';
        GM._ty3_pendingReviewForPrompt.forEach(function(rv) {
          _basisBrief += '  · ' + (rv.venueType ? '['+rv.venueType+']' : '') + '「' + (rv.content||'').slice(0, 40) + '」·' +
            (rv.proposerParty ? rv.proposerParty + '所主·' : '') +
            '此回合议结：【' + (rv.histLabel || rv.label) + '】\n';
        });
      }

      // 长期事势注入·sub-call 2 后人戏说·让多年工程在场景中折射
      var _chronCtx2 = '';
      if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAIContextString) {
        var _cc2raw = ChronicleTracker.getAIContextString();
        if (_cc2raw) {
          _chronCtx2 = '\n' + _cc2raw + '\n';
          _chronCtx2 += '【★ 长期事势穿透到《后人戏说》场景叙事】\n';
          _chronCtx2 += '  · 进度 ≥70% 工程·相关大臣应在某时辰汇报近况(如治河近成→河漕总督来朝奏报；盐法将就→盐运使呈报新法收效)。\n';
          _chronCtx2 += '  · 进度 <20% 历多回合·应有人在场景中提及搁置(如"那道清查户口的诏，已两年余了，至今……")。\n';
          _chronCtx2 += '  · 100% 接近完成·主角应有内心独白回想当年颁诏情景·或与近侍提起。\n';
          _chronCtx2 += '  · 工程涉及的地方·若主角"巡视"或"接见"该地官员·必须自然引及其进展。\n';
          _chronCtx2 += '  · 这些不是主线·但要让玩家感到"陛下治国数年·真有几桩大事在背景持续推进"。\n';
        }
      }

      // ★ 世界状态快照注入（sc2 重点：叙事接地·防身份漂移与死者复活·前情提要）
      var _ws2 = '';
      try {
        if (typeof _buildWorldStateSnapshot === 'function') _ws2 += _buildWorldStateSnapshot();
        if (typeof _buildDeadPin === 'function') _ws2 += _buildDeadPin();
        if (typeof _buildPriorTurnBrief === 'function') _ws2 += _buildPriorTurnBrief();
      } catch(_wse2){ _dbg('[WorldSnap sc2] fail:', _wse2); }
      // 12 表注入·sc2 仅看公开皇命·不看天机
      var _mt2 = '';
      try {
        if (window.MemTables && MemTables.buildTablesInjection) {
          _mt2 = MemTables.buildTablesInjection({ include: ['imperialEdict', 'curStatus'], hideSecret: true }) || '';
        }
      } catch(_e){}
      // 时间参考块（Phase 4.1）
      var _tr2 = '';
      try { if (typeof _buildTimeRef === 'function') _tr2 = _buildTimeRef() || ''; } catch(_e){}
      var tp2 = _tr2 + _ws2 + _mt2 + p1Summary + _basisBrief + _chronCtx2
        + (aiThinking ? '【AI分析】' + aiThinking.substring(0, 200) + '\n' : '')
        + "\n基于上述全部资料，撰写《后人戏说》——这是玩家角色本回合的完整生活进程，核心目的是**完整、立体地呈现玩家角色的日常生活**，让玩家看见自己的角色如何度过这一段时光。\n"
        + "【核心要义——叙事性第一】\n"
        + "  这不是战报、不是史书、不是摘要，而是一段可读的故事。让玩家'跟着角色过完这段日子'。\n"
        + "  要有人物的具体动作、神态、对话、内心活动；要有场景的具体环境、时间、氛围。\n"
        + "  玩家角色不是一个抽象的决策符号，是一个有血有肉的人——他吃饭、他疲倦、他忧虑、他动怒、他思念、他沉默。\n"
        + "【结构骨架——按时辰顺序自然展开】\n"
        + "  晨(卯时)：主角起身——批阅奏折/晨起盥洗/与近侍对话/晨食\n"
        + "  上午(辰时-巳时)：正式政务——朝会/殿见大臣/军务讨论/外交接见\n"
        + "  午后(未时-申时)：续政务/接见/巡视/或私事(若本回合有帝王私行/内眷互动)\n"
        + "  傍晚(酉时-戌时)：私人时间——家人/帝后对话/内省/私下思考；也可继续政务\n"
        + "  深夜/就寝：只在本回合有特别事件时写\n"
        + "  日与日之间用空行或'……'切换；若本回合跨多日请分日叙述\n"
        + "  注：时辰只是顺序参考，具体节奏看本回合实际内容——不必强行每个时段都写\n"
        + "【文风——重在叙事，而非特定标点】\n"
        + "  · **标点自由**：可用句号/逗号/冒号/引号正常组织句子；破折号可用可不用，不强制；顿号、分号也可用\n"
        + "  · 以叙事流畅为首要目标——避免电报体、避免列清单、避免句句破折\n"
        + "  · 对话自然融入场景；可带'说道''答道''低声道'等叙事动词，也可不带(上下文能识别即可)\n"
        + "  · 每个人物说话方式要贴合其性格(忠臣的直/佞臣的滑/老臣的稳/年少者的急/亲眷的柔)\n"
        + "  · 数据融入场景——不要列'国库-20万'，而写成对话或动作(如'户部侍郎垂首奏报：库银减了二十万两，赈灾拨了十五……')\n"
        + "  · 穿插生活碎片：饮食、天气、季节、家人互动(子女成长、帝后闲谈、妃嫔往来)\n"
        + "  · 内心独白可直接写角色所想，不必隐藏——如'他想，今日这事，父皇当年怕是也难办吧。'\n"
        + "  · 幽默感来自人物智慧与情境，不来自吐槽\n"
        + "【着重呈现(推演依据必须场景化)】\n"
        + "  · 玩家诏令：至少一条要在具体场景中被某个大臣收到/讨论/执行——让玩家看见令下之后谁去做、怎么做\n"
        + "  · 玩家行止：作为主角的日常生活片段自然出现\n"
        + "  · 本回合批复的奏疏：至少一份在场景中展开(谁呈上、何时、皇帝的反应)\n"
        + "  · 问对/朝议结果：作为对话场景再现(若本回合有)\n"
        + "  · NPC自主行动：至少出现2-3个NPC的日常片段或私下对话\n"
        + "  · 势力/阴谋伏笔：暗线自然融入\n"
        + "  · 本回合最戏剧性的一幕必须展开写足\n"
        + "【禁止】\n"
        + "  · 不用emoji\n"
        + "  · 不用日式轻小说元素(不出现'诶''嘛''啦'等语气词)\n"
        + "  · 不用全知叙述者评论('这一天注定不平凡'之类)\n"
        + "  · 不是时政记的复述——时政记是摘要报告，后人戏说是把同一事件还原为可感知的生活\n"
        + "  · 少用'陛下圣明''微臣该死'之类套话，让对话贴近真实人际交流\n"
        + "【字数】" + _hourenMin + "-" + _hourenMax + "字。字数应花在场景细节和人物互动上，不要注水。\n"
        + "【情绪基调】若主角勤政——写出'做好事真难'(阻力、孤独、疲惫)；若主角享乐——写出'享乐真好'(感官、轻快、奉承)，但不说教。\n"
        + "\n返回纯JSON：\n"
        + "{\"houren_xishuo\":\"...(场景叙事正文)\",\"new_activities\":[{\"name\":\"...\",\"duration\":3,\"desc\":\"...\",\"effect\":{}}]}";
      // R104·给 AI 完整对话（GM.conv 已由 P.conf.convKeep 设置截断过，用户在设置里改 convKeep 即控制总量）
      var msgs2=[{role:"system",content:_maybeCacheSys(sysP)}].concat(GM.conv);
      msgs2.push({role:"user",content:tp2});
      var _sc2Body = {model:P.ai.model||"gpt-4o",messages:msgs2,temperature:P.ai.temp||0.8,max_tokens:_tok(16000)};
      if (_modelFamily === 'openai') _sc2Body.response_format = { type: 'json_object' };
      var _sc2Call = await _callFollowupAI(_sc2Body, { id: 'sc2', label: '后人戏说', priority: 'normal' });
      var data2 = _sc2Call.data;
      _checkTruncated(data2, '后人戏说');
      var c2 = _sc2Call.raw || "";
      var _p2Parse = await _parseOrRepairJsonResult(c2, data2, '后人戏说', { url: url, key: P.ai.key, body: _sc2Body, expectedKeys: ['houren_xishuo', 'hourenXishuo', 'houren', 'zhengwen', 'new_activities'], priority: 'normal' });
      if (_p2Parse && _p2Parse.raw) c2 = _p2Parse.raw;
      p2 = _p2Parse ? _p2Parse.parsed : null;
      GM._turnAiResults.subcall2_raw = c2;
      GM._turnAiResults.subcall2 = p2;

      if(p2){
        // 优先读取新字段houren_xishuo；兼容旧zhengwen字段
        hourenXishuo = _tmPickHouren(p2, c2);
        if (hourenXishuo) zhengwen = hourenXishuo; // 兼容现有调用
        if(p2.new_activities)p2.new_activities.forEach(function(a){if(a.name)GM.biannianItems.push({name:a.name,startTurn:GM.turn+1,duration:a.duration||3,desc:a.desc||"",effect:a.effect||{}});});
        // 清理过期的biannianItems
        if(GM.biannianItems&&GM.biannianItems.length>50)GM.biannianItems=GM.biannianItems.filter(function(b){return b.startTurn+b.duration>=GM.turn;});
      }

      // 建议不足时自动补全（借鉴 ChongzhenSim fallback choices）
      if (!p2 || !p2.suggestions || p2.suggestions.length < 2) {
        // 动态生成建议——忠臣的建议故意写得冗长、说教（让玩家感受忠言逆耳）
        var _dynSugg = [];
        _dynSugg.push('巩固民心，推行惠政（然此非一朝一夕之功，须持之以恒，不可半途而废）');
        _dynSugg.push('臣以为当整饬吏治、选贤任能，此乃治国之本。然贤愚难辨，望陛下明察秋毫');
        if (GM.eraState && GM.eraState.militaryProfessionalism < 0.4) _dynSugg.push('军备松弛久矣，臣以为宜操练兵马、加强边防。然此事费银甚巨、耗时良久，朝中恐有异议');
        if (_dynSugg.length < 3) _dynSugg.push('臣以为当修文德以来远人，虽见效缓慢，然为万世之基业');
        // 当荒淫值较高时，混入佞臣式的"好建议"
        if (GM._tyrantDecadence && GM._tyrantDecadence > 25) {
          var _badSugg = [
            '近来操劳过度，宜宴饮群臣，以慰圣心',
            '方士进献灵丹，服之可延年益寿，何不一试',
            '天子当享天下之福，何必自苦？宜大赦天下、普天同庆',
            '某处风景绝佳，可建行宫一座，以备避暑',
            '后宫虚设，宜选天下淑女以充掖庭',
            '边功卓著，何不御驾亲征、扬威四海？',
            '近臣某某忠心可嘉，宜委以重任（注：此人谄媚之辈）'
          ];
          _dynSugg.push(_badSugg[Math.floor(random() * _badSugg.length)]);
        }
        if (!p2) p2 = {};
        p2.suggestions = (p2.suggestions || []).concat(_dynSugg).slice(0, 4);
      }

      if(!hourenXishuo){
        hourenXishuo = _tmFirstText(_tmPickHouren(p2, c2), zhengwen, shizhengji, "时光流逝");
      }
      if(!zhengwen){
        zhengwen = hourenXishuo;
      }
      if (p2 && !p2.houren_xishuo) p2.houren_xishuo = hourenXishuo;
      GM._turnAiResults.subcall2 = p2;
      // 【防止对话历史被后人戏说撑爆】——将过长叙事截断为摘要入conv；完整版已在shijiHistory
      // 标准策略：>1500字时只保留开头600+结尾400作为上下文线索；其余用"……(中略)……"代替
      var _convContent = zhengwen || '';
      if (_convContent.length > 1500) {
        _convContent = _convContent.substring(0, 600) + '\n……（后人戏说正文过长，此处略去中段；完整版见史记）……\n' + _convContent.substring(_convContent.length - 400);
      }
      GM.conv.push({role:"assistant",content:_convContent});
      }); // end Sub-call 2 _runSubcall

      // --- Sub-call 2.5: 深度伏笔种植 + 回合记忆压缩 + NPC情绪快照 ---
      _queuePostTurnSubcall('sc25', function(){ return _runSubcall('sc25', '伏笔记忆', 'lite', async function() {
      _dbg('[PostTurn] sc25 start');
      try {
        var _ptQueue25 = GM._postTurnJobs || null;
        var _ptTurn25 = (_ptQueue25 && _ptQueue25.turn) || GM.turn || 0;
        var _turnSummary = '\u672C\u56DE\u5408\u5B8C\u6574\u6458\u8981\uFF1A\n';
        _turnSummary += '\u65F6\u653F\u8BB0\uFF1A' + (shizhengji || '') + '\n';
        _turnSummary += '\u6B63\u6587\uFF1A' + (zhengwen || '').substring(0, 600) + '\n';
        if (playerStatus) _turnSummary += '\u653F\u5C40\uFF1A' + playerStatus + '\n';
        if (playerInner) _turnSummary += '\u5185\u7701\uFF1A' + playerInner + '\n';
        // 完整变动记录
        var _changeSummary = [];
        if (p1 && p1.npc_actions) p1.npc_actions.forEach(function(a) { _changeSummary.push(a.name + ':' + a.action + (a.result?'→'+a.result:'')); });
        if (p1 && p1.character_deaths) p1.character_deaths.forEach(function(d) { _changeSummary.push(d.name + '\u6B7B:' + d.reason); });
        if (p1 && p1.faction_events) p1.faction_events.forEach(function(fe) { _changeSummary.push((fe.actor||'') + (fe.action||'')); });
        if (p1 && p1.faction_changes) p1.faction_changes.forEach(function(fc) { _changeSummary.push(fc.name + '\u5B9E\u529B' + (fc.strength_delta>0?'+':'')+fc.strength_delta); });
        if (_changeSummary.length > 0) _turnSummary += '\u5168\u90E8\u53D8\u52A8\uFF1A' + _changeSummary.join('\uFF1B') + '\n';
        ctx.followup._changeSummary = _changeSummary.slice();
        // 玩家本回合决策
        if (GM.playerDecisions && GM.playerDecisions.length > 0) {
          var _lastDecs = GM.playerDecisions.filter(function(d){return d.turn===_ptTurn25;});
          if (_lastDecs.length) _turnSummary += '\u73A9\u5BB6\u51B3\u7B56\uFF1A' + _lastDecs.map(function(d){return d.type+':'+d.content;}).join('\uFF1B') + '\n';
        }

        // 注入已有情节线索（让AI延续而非重造）
        if (GM._plotThreads && GM._plotThreads.length > 0) {
          var _activeThreads = GM._plotThreads.filter(function(t){ return t.status !== 'resolved'; });
          if (_activeThreads.length > 0) {
            _turnSummary += '\n【活跃情节线索——应在plot_updates中更新进展】\n';
            _activeThreads.forEach(function(t) { _turnSummary += '  · [' + t.id + '] ' + t.title + ' (' + t.type + ') 状态:' + t.status + '\n'; });
          }
        }
        var tp25 = _turnSummary + '\n\u8BF7\u8FD4\u56DEJSON\uFF1A\n';
        tp25 += '{"foreshadow":["\u4F0F\u7B141\u2014\u201440\u5B57\u2014\u2014\u5305\u542B\u4F55\u4EBA\u4F55\u4E8B\u4F55\u65F6\u5F15\u7206","\u4F0F\u7B142","\u4F0F\u7B143","\u4F0F\u7B144","\u4F0F\u7B145"],';
        tp25 += '"plot_updates":[{"threadId":"\u5DF2\u6709\u7EBFID\u6216null","title":"\u5267\u60C5\u7EBF\u540D","threadType":"political/military/personal/economic/succession/foreign","update":"\u672C\u56DE\u5408\u8FDB\u5C55(30\u5B57)","status":"brewing/active/climax/resolved","newThread":false}],';
        tp25 += '"decision_echoes":[{"content":"\u54EA\u6761\u8BCF\u4EE4/\u51B3\u7B56","echoType":"positive/negative/mixed","echoDesc":"\u5EF6\u65F6\u540E\u679C\u63CF\u8FF0(30\u5B57)","delayTurns":0}],';
        tp25 += '"faction_narrative":{"\u52BF\u529B\u540D":"\u8FD1\u671F\u53D1\u5C55\u4E00\u53E5\u8BDD\u603B\u7ED3(30\u5B57)"},';
        tp25 += '"memory":"\u672C\u56DE\u5408\u7684\u9AD8\u5BC6\u5EA6\u538B\u7F29\u8BB0\u5F55\u2014\u2014\u5305\u542B\u6240\u6709\u5173\u952E\u4EBA\u540D\u3001\u4E8B\u4EF6\u3001\u53D8\u5316\u3001\u73A9\u5BB6\u51B3\u7B56\u53CA\u5176\u540E\u679C(200\u5B57)","trend":"\u5F53\u524D\u5927\u52BF\u8D70\u5411\u548C\u52A0\u901F\u65B9\u5411(50\u5B57)","npc_mood_snapshot":"\u5404\u4E3B\u8981NPC\u672C\u56DE\u5408\u540E\u7684\u60C5\u7EEA\u72B6\u6001(100\u5B57)","contradiction_evolution":"\u5404\u77DB\u76FE\u672C\u56DE\u5408\u7684\u6F14\u5316\u65B9\u5411\u2014\u2014\u52A0\u5267/\u7F13\u548C/\u8F6C\u5316(80\u5B57)",';
        // P12.1 state_board 4 \u5B57\u6BB5\uFF08KokoroMemo state_schema 14 \u7C7B\u5BF9\u7167\u00B7\u8865\u5929\u547D\u7F3A\u5931\u7684\u8F7B\u91CF\u4F1A\u8BDD\u72B6\u6001\uFF09
        tp25 += '"state_board":{';
        tp25 += '"mood":"\u671D\u5802\u5F53\u524D\u6C1B\u56F4\u57FA\u8C03\u4E00\u53E5\u8BDD(40\u5B57\u00B7\u5982"\u767E\u5B98\u89C2\u671B\u00B7\u7687\u5E1D\u5A01\u91CD\u00B7\u6050\u60E7\u5927\u4E8E\u5E0C\u671B")",';
        tp25 += '"open_loops":["\u60AC\u800C\u672A\u51B3\u4F46\u5E94\u63A8\u8FDB\u7684\u5267\u60C5\u7EBF 1(35\u5B57)","\u7EBF 2","\u7EBF 3"],';
        tp25 += '"recent_summary":"\u672C\u56DE\u5408\u6700\u538B\u7F29\u7684\u6458\u8981(150\u5B57\u00B7\u8986\u76D6\u6240\u6709\u5173\u952E\u53D8\u52A8\u00B7\u4E0B\u56DE\u5408 sc1 \u4F18\u5148\u8BFB)",';
        tp25 += '"unfulfilled_promises":["\u73A9\u5BB6\u672A\u5151\u73B0\u7684\u627F\u8BFA/\u62DF\u8BAE\u4F46\u672A\u9881\u7684\u8BCF\u4EE4 1(35\u5B57)","2","3"]';
        tp25 += '},';
        // P13.4 imperialEdict \u5019\u9009\uFF08KokoroMemo review_policy \u8303\u5F0F\uFF09
        // AI \u63A8\u65AD\u672C\u56DE\u5408\u5E94\u6709\u7684"\u7687\u547D\u7EA7\u9489\u5B50\u6761\u76EE"\u2014\u2014\u6BD4\u5982\u73A9\u5BB6\u9881\u5E03"\u7956\u8BAD"\u6216\u4E8B\u4EF6\u786E\u7ACB\u4E86\u4E00\u4E2A\u4E0D\u53EF\u53D8\u89C4\u5219
        tp25 += '"imperial_candidates":[{"content":"\u5019\u9009\u7687\u547D\u5185\u5BB9(60\u5B57)","priority":1,"condition":"\u751F\u6548\u6761\u4EF6","importance":0.5,"confidence":0.5}],';
        // 10 \u7EF4\u4E8B\u4EF6\u8BC4\u5206\uFF08\u53C2\u8003\u5168\u81EA\u52A8\u603B\u7ED3 v4 \u51DB\u503E\u534F\u8BAE\u00B7\u672C\u5730\u5316\u4E3A\u5929\u547D\u8BED\u5883\uFF09+ affects_future \u4E8C\u5143\u6807\u8BB0\uFF08Phase 4.2 ReNovel-AI \u8303\u5F0F\uFF09
        tp25 += '"event_weights":[{"event":"\u4E8B\u4EF6\u63CF\u8FF050\u5B57\u4EE5\u5185","weight":0.65,"dims":["d1","d3"],"affects_future":true}]}\n';
        tp25 += '\n\u3010event_weights \u8BC4\u5206\u89C4\u5219\u3011\u5BF9\u672C\u56DE\u5408\u4E0A\u62A5 5-10 \u4EF6\u4E8B\u4EF6\u00B7\u9010\u4EF6\u6309 10 \u4E2A\u7EF4\u5EA6\u5404\u6253 0.05-0.15 \u7D2F\u52A0\u5C01\u9876 1.0\uFF1A\n';
        tp25 += '  d1 \u541B\u4E3B\u884C\u52A8/\u5F71\u54CD(\u4E0A\u9650 0.15) | d2 \u4E09\u516C\u4E5D\u537F\u53C2\u4E0E(0.10) | d3 \u91CD\u5927\u51B3\u7B56/\u8F6C\u6298(0.15) | d4 \u4E3B\u8981\u51B2\u7A81\u8FDB\u5C55(0.15) | d5 \u6838\u5FC3\u4FE1\u606F\u63ED\u9732(0.15) | d6 \u5236\u5EA6/\u7586\u57DF\u9610\u91CA(0.10) | d7 \u65B0\u52BF\u529B/\u65B0\u4EBA\u7269(0.15) | d8 NPC\u6210\u957F/\u5173\u7CFB\u53D8\u52A8(0.15) | d9 \u60C5\u611F\u5CF0\u503C/\u5371\u673A\u65F6\u523B(0.15) | d10 \u4E3B\u7EBF\u63A8\u8FDB(0.15)\n';
        tp25 += '\u8F93\u51FA\u7684 event \u63CF\u8FF0\u9700\u4E0E [\u4E8B\u4EF6\u5386\u53F2] \u8868\u4E2D\u5DF2\u5B58\u5728\u7684\u63CF\u8FF0\u504F\u8FD1\u00B7dims \u5C42\u9762\u53EA\u9700\u4E2D\u9AD8\u8D21\u732E\u7EF4\u5EA6\u00B7\u4E0D\u8981\u8F93\u51FA\u6BCF\u4E2A\u7EF4\u5EA6\u7684\u5206\u6570\u3002\n';
        tp25 += '\n\u3010affects_future \u4E8C\u5143\u6807\u8BB0\u3011\u5BF9\u6BCF\u6761\u4E8B\u4EF6\u5355\u72EC\u8BC4\u4F30\uFF1A\n';
        tp25 += '  affects_future=true\uFF1A\u6B64\u4E8B\u4EF6\u5BF9 5+ \u56DE\u5408\u540E\u4ECD\u6709\u7EA6\u675F\u529B\uFF08\u5982\uFF1A\u67D0\u91CD\u81E3\u83B7\u5175\u6743\u00B7\u67D0\u6761\u7EA6\u7B7E\u8BA2\u00B7\u67D0\u6539\u9769\u843D\u5730\u00B7\u67D0\u5173\u952E\u4EBA\u7269\u8EAB\u4EFD\u53D8\u5316\u00B7\u67D0\u5730\u5931\u5B88\uFF09\n';
        tp25 += '  affects_future=false\uFF1A\u672C\u56DE\u5408\u4E00\u6B21\u6027\u7EC6\u8282\uFF08\u5982\uFF1A\u67D0\u6B21\u53EC\u5BF9\u00B7\u67D0\u6B21\u5C0F\u578B\u9A9A\u4E71\u00B7\u4E00\u6B21\u6027\u7684\u6069\u8D4F\uFF09\n';
        tp25 += '  \u6807\u8BB0 true \u7684\u4E8B\u4EF6\u4F1A\u8FDB\u5165"\u957F\u671F\u7EA6\u675F"\u6BB5\u00B7\u4E0B\u56DE\u5408 sc1 \u63A8\u6F14\u65F6 AI \u5FC5\u987B\u9075\u5FAA\u00B7\u4E0D\u5F97\u8FDD\u53CD\u6216\u9057\u5FD8\u3002\n';
        tp25 += '\u4F0F\u7B14\u8981\u5177\u4F53\uFF1A\u5305\u542B\u201C\u8C01\u201D\u201C\u505A\u4EC0\u4E48\u201D\u201C\u5728\u54EA\u91CC\u201D\u201C\u51E0\u56DE\u5408\u540E\u5F15\u7206\u201D\u3002\u4E0D\u8981\u6A21\u7CCA\u3002\n';
        tp25 += 'memory\u5FC5\u987B\u5305\u542B\u6240\u6709\u5173\u952E\u53D8\u5316\uFF0C\u8FD9\u662F\u4E0B\u56DE\u5408AI\u7684\u552F\u4E00\u56DE\u5FC6\u6765\u6E90\u3002';

        // Phase 5.1 三模型解耦：sc25 (Analyzer 角色) 优先用次要 API·没配则回退主要
        var _t25 = (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : 'primary';
        var _c25 = (typeof _getAITier === 'function') ? _getAITier(_t25) : { key: P.ai.key, url: url, model: P.ai.model || 'gpt-4o' };
        var _u25 = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(_t25) : url;
        _dbg('[sc25] using tier:', _c25.tier || _t25, 'model:', _c25.model);
        var _sc25Body = {model:_c25.model, messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp25}], temperature:0.7, max_tokens:_tok(12000)};
        if (_tmDetectModelFamily(_c25.model, _modelFamily) === 'openai') _sc25Body.response_format = { type: 'json_object' };
        var _sc25Call = await _callFollowupAI(_sc25Body, { id: 'sc25', label: '伏笔记忆', url: _u25, key: _c25.key, priority: 'high' });
        {
          var data25 = _sc25Call.data;
          _checkTruncated(data25, '伏笔记忆');
          var c25 = _sc25Call.raw || '';
          var _p25Parse = await _parseOrRepairJsonResult(c25, data25, '伏笔记忆', { url: _u25, key: _c25.key, body: _sc25Body, expectedKeys: ['foreshadow', 'memory', 'state_board', 'event_weights'], priority: 'high' });
          if (_p25Parse && _p25Parse.raw) c25 = _p25Parse.raw;
          var p25 = _p25Parse ? _p25Parse.parsed : null;
          if (p25) {
            // 存储伏笔（供下回合AI使用）
            if (p25.foreshadow && Array.isArray(p25.foreshadow)) {
              if (!GM._foreshadows) GM._foreshadows = [];
              p25.foreshadow.forEach(function(f) {
                if (f) GM._foreshadows.push({ turn: _ptTurn25, text: f });
              });
              // 硬上限保护（正常由压缩系统管理，此为兜底；上限随模型动态调整）
              var _foreHardLim = getCompressionParams().foreHardLimit || 60;
              if (GM._foreshadows.length > _foreHardLim) {
                var _foreBeforeCap = GM._foreshadows.length;
                GM._foreshadows = GM._foreshadows.slice(-Math.round(_foreHardLim * 0.8));
                try { if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('hard_cap', { bucket: 'foreshadows', before: _foreBeforeCap, after: GM._foreshadows.length }); } catch(_) {}
              }
            }
            // 存储AI压缩记忆
            if (p25.memory) {
              if (!GM._aiMemory) GM._aiMemory = [];
              GM._aiMemory.push({ turn: _ptTurn25, text: p25.memory });
              // 硬上限保护（正常由压缩系统管理，此为兜底；上限随模型动态调整）
              var _memHardLim = getCompressionParams().memHardLimit || 100;
              if (GM._aiMemory.length > _memHardLim) {
                var _memBeforeCap = GM._aiMemory.length;
                GM._aiMemory = GM._aiMemory.slice(-Math.round(_memHardLim * 0.8));
                try { if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('hard_cap', { bucket: 'aiMemory', before: _memBeforeCap, after: GM._aiMemory.length }); } catch(_) {}
              }
            }
            // 存储趋势
            if (p25.trend) GM._currentTrend = p25.trend;
            // P12.1 state_board 4 字段
            if (p25.state_board && typeof p25.state_board === 'object') {
              GM._stateBoard = {
                turn: _ptTurn25,
                ts: Date.now(),
                mood: String(p25.state_board.mood || '').slice(0, 80),
                open_loops: Array.isArray(p25.state_board.open_loops) ? p25.state_board.open_loops.slice(0, 5).map(function(s){ return String(s).slice(0, 60); }) : [],
                recent_summary: String(p25.state_board.recent_summary || '').slice(0, 250),
                unfulfilled_promises: Array.isArray(p25.state_board.unfulfilled_promises) ? p25.state_board.unfulfilled_promises.slice(0, 5).map(function(s){ return String(s).slice(0, 60); }) : []
              };
            }
            // P13.4 imperialEdict 候选 auto_review（KokoroMemo review_policy.py 范式·纯规则·零 LLM）
            if (Array.isArray(p25.imperial_candidates) && p25.imperial_candidates.length > 0) {
              if (!Array.isArray(GM._imperialCandidates)) GM._imperialCandidates = [];
              var _autoApprovedCnt = 0, _pendingCnt = 0, _rejectedCnt = 0;
              p25.imperial_candidates.forEach(function(ic) {
                if (!ic || !ic.content) return;
                var imp = parseFloat(ic.importance);
                var conf = parseFloat(ic.confidence);
                if (isNaN(imp)) imp = 0.5;
                if (isNaN(conf)) conf = 0.5;
                imp = Math.max(0, Math.min(1, imp));
                conf = Math.max(0, Math.min(1, conf));
                // KokoroMemo review_policy 规则：
                //   importance >= 0.8 && confidence >= 0.85 → auto-approve（自动入 imperialEdict 表）
                //   importance < 0.3 → auto-reject（明显不重要·丢弃）
                //   其余 → pending（玩家审批）
                var verdict;
                if (imp >= 0.8 && conf >= 0.85) verdict = 'auto-approve';
                else if (imp < 0.3) verdict = 'auto-reject';
                else verdict = 'pending';

                if (verdict === 'auto-approve' && window.MemTables && MemTables.editorWrite) {
                  // 直接走 editor 硬接口·绕过 readonly 限制
                  MemTables.editorWrite('imperialEdict', 'insert', {
                    values: {
                      0: String(ic.priority || 5),
                      1: String(ic.content),
                      2: String(ic.condition || '永久生效'),
                      3: String(_ptTurn25),
                      4: '' // 非天机
                    }
                  });
                  _autoApprovedCnt++;
                } else if (verdict === 'pending') {
                  GM._imperialCandidates.push({
                    content: String(ic.content).slice(0, 80),
                    priority: ic.priority || 5,
                    condition: String(ic.condition || '永久生效').slice(0, 40),
                    importance: imp,
                    confidence: conf,
                    proposedTurn: _ptTurn25,
                    status: 'pending'
                  });
                  _pendingCnt++;
                } else {
                  _rejectedCnt++; // 静默丢弃
                }
              });
              if (GM._imperialCandidates.length > 30) GM._imperialCandidates = GM._imperialCandidates.slice(-30);
              _dbg('[ImperialReview] auto-approve:', _autoApprovedCnt, '·pending:', _pendingCnt, '·auto-reject:', _rejectedCnt);
            }

            // 2.1: 处理剧情线更新
            if (p25.plot_updates && Array.isArray(p25.plot_updates)) {
              if (!GM._plotThreads) GM._plotThreads = [];
              p25.plot_updates.forEach(function(pu) {
                if (!pu.title) return;
                if (pu.newThread || !pu.threadId) {
                  // 创建新线
                  var existing = GM._plotThreads.find(function(t) { return t.title === pu.title; });
                  if (!existing) {
                    GM._plotThreads.push({
                      id: uid(), title: pu.title, description: pu.update || '',
                      participants: [], startTurn: _ptTurn25, lastUpdateTurn: _ptTurn25,
                      status: pu.status || 'active', priority: 3,
                      threadType: pu.threadType || 'political',
                      updates: [{ turn: _ptTurn25, text: pu.update || '' }]
                    });
                  }
                } else {
                  // 更新已有线
                  var thread = GM._plotThreads.find(function(t) { return t.id === pu.threadId || t.title === pu.title; });
                  if (thread) {
                    thread.lastUpdateTurn = _ptTurn25;
                    if (pu.status) thread.status = pu.status;
                    if (pu.update) thread.updates.push({ turn: _ptTurn25, text: pu.update });
                    if (thread.updates.length > 20) thread.updates = thread.updates.slice(-20);
                  }
                }
              });
              // 清理已完结超过5回合的线
              GM._plotThreads = GM._plotThreads.filter(function(t) {
                return t.status !== 'resolved' || _ptTurn25 - t.lastUpdateTurn < 5;
              });
              // 上限15条
              if (GM._plotThreads.length > 15) GM._plotThreads = GM._plotThreads.slice(-15);
            }

            // N1: 处理决策延时后果生成
            if (p25.decision_echoes && Array.isArray(p25.decision_echoes)) {
              if (!GM._decisionEchoes) GM._decisionEchoes = [];
              p25.decision_echoes.forEach(function(de) {
                if (!de.content || !de.echoDesc) return;
                var delay = parseInt(de.delayTurns) || ((typeof turnsForDuration === 'function') ? turnsForDuration('year') : 12);
                GM._decisionEchoes.push({
                  id: uid(), content: de.content, turn: _ptTurn25,
                  echoTurn: _ptTurn25 + delay, echoType: de.echoType || 'mixed',
                  echoDesc: de.echoDesc, applied: false
                });
              });
              // 清理已应用的和过期的
              GM._decisionEchoes = GM._decisionEchoes.filter(function(e) { return !e.applied || _ptTurn25 - e.echoTurn < 3; });
              if (GM._decisionEchoes.length > 20) GM._decisionEchoes = GM._decisionEchoes.slice(-20);
            }

            // 标记到期的决策回声为已应用
            if (GM._decisionEchoes) {
              GM._decisionEchoes.forEach(function(e) {
                if (!e.applied && e.echoTurn <= _ptTurn25) e.applied = true;
              });
            }

            // 3.3: 势力发展叙事存储
            if (p25.faction_narrative && typeof p25.faction_narrative === 'object') {
              GM._factionNarrative = p25.faction_narrative;
            }

            // 10 维事件评分回写到 eventHistory 表（Phase 2.3）
            if (p25.event_weights && Array.isArray(p25.event_weights) && window.MemTables) {
              try {
                var _eh = MemTables.getSheet('eventHistory');
                if (_eh && _eh.rows && _eh.rows.length) {
                  p25.event_weights.forEach(function(ew) {
                    if (!ew || !ew.event) return;
                    var w = parseFloat(ew.weight);
                    if (isNaN(w) || w < 0) w = 0; if (w > 1) w = 1;
                    var dims = Array.isArray(ew.dims) ? ew.dims.join(',') : (ew.dims || '');
                    var aff = (ew.affects_future === true || ew.affects_future === 'true' || ew.affects_future === 1) ? 'true' : '';
                    // 模糊匹配·查找最近回合中描述包含该事件关键字的行
                    var hits = _eh.rows.filter(function(r) {
                      var rTurn = parseInt(r[1], 10) || 0;
                      return rTurn >= _ptTurn25 - 1 && rTurn <= _ptTurn25 && r[2] && r[2].indexOf(String(ew.event).slice(0, 8)) >= 0;
                    });
                    if (hits.length === 0 && _eh.rows.length > 0) {
                      // 兜底：取本回合最后一行
                      hits = [_eh.rows[_eh.rows.length - 1]];
                    }
                    hits.forEach(function(r) { r[3] = String(w); if (dims) r[4] = dims; if (aff) r[6] = aff; });
                  });
                  _dbg('[EventWeights] 已为 ' + p25.event_weights.length + ' 件事件写回权重');
                }
              } catch(_ewE){ _dbg('[EventWeights] fail:', _ewE); }
            }
            if (_ptQueue25) {
              _ptQueue25.results = _ptQueue25.results || {};
              _ptQueue25.results.sc25 = p25;
            }
            if (GM._turnAiResults) GM._turnAiResults.subcall25 = p25;
            _dbg('[Foreshadow]', (p25.foreshadow || []).length, 'hooks. Threads:', (GM._plotThreads||[]).length, 'Echoes:', (GM._decisionEchoes||[]).length);
          }
        }
      } catch(e25) { _dbg('[Foreshadow] \u5931\u8D25:', e25); throw e25; }
      }); }); // end Sub-call 2.5 _runSubcall (queued post-turn)

      if (typeof _branchCSc27ReadyP !== 'undefined' && _branchCSc27ReadyP) await _branchCSc27ReadyP;

      // --- Sub-call 2.7: 叙事质量审查与增强 --- [standard+full]
      await _runSubcall('sc27', '叙事审查', 'standard', async function() {
      showLoading("\u53D9\u4E8B\u8D28\u91CF\u5BA1\u67E5",85);
      try {
        var _reviewText27 = String(zhengwen || '');
        if (_reviewText27.length > 7000) {
          _reviewText27 = _reviewText27.slice(0, 4200) + '\n\n【中略：正文过长，仅抽审首尾与关键段；不可据中略编造新事实】\n\n' + _reviewText27.slice(-2600);
        }
        var tp27 = '请审查以下叙事正文的质量：\n' + _reviewText27 + '\n\n';
        var _lateSpecialtyFor27 = _buildLateSpecialtySummary();
        if (_lateSpecialtyFor27) {
          tp27 += '\n【专项推演补充】以下是并行专项推演刚收束的事实与趋势。若正文未体现，请只以增补细节方式补入，不要推翻玩家诏令或已落地数据：\n' + _lateSpecialtyFor27.substring(0, 1800) + '\n';
        }
        tp27 += '【铁律】玩家诏令引起的任何字面执行描述（即使荒唐/时代错乱）·你都不得改写。若玩家在唐代诏"赏银"/令"刑部管科举"等·相关叙事必须原样保留。你只能增补环境/情绪/感官细节·或重写"纯 AI 虚构的、与玩家无关的段落"。\n';
        // 注入史料知识供审查参考
        if (GM._aiScenarioDigest) {
          if (GM._aiScenarioDigest.periodVocabulary) tp27 += '\u65F6\u4EE3\u7528\u8BED\uFF1A' + GM._aiScenarioDigest.periodVocabulary.substring(0,200) + '\n';
          if (GM._aiScenarioDigest.etiquetteNorms) tp27 += '\u793C\u4EEA\u89C4\u8303\uFF1A' + GM._aiScenarioDigest.etiquetteNorms.substring(0,200) + '\n';
          if (GM._aiScenarioDigest.sensoryDetails) tp27 += '\u611F\u5B98\u7EC6\u8282\uFF1A' + GM._aiScenarioDigest.sensoryDetails.substring(0,200) + '\n';
        }
        // 注入角色名单供一致性检查
        var _charNames27 = (GM.chars||[]).filter(function(c){return c.alive!==false;}).map(function(c){return c.name;});
        if (_charNames27.length > 0) tp27 += '\u3010\u5728\u4E16\u89D2\u8272\u540D\u5355\uFF08\u6B63\u6587\u4E2D\u63D0\u5230\u7684\u4EBA\u540D\u5FC5\u987B\u5728\u6B64\u5217\u8868\u4E2D\uFF09\u3011' + _charNames27.join('\u3001') + '\n';
        tp27 += '\u8BF7\u8FD4\u56DEJSON\uFF1A{"anachronisms":"\u53D1\u73B0\u7684\u65F6\u4EE3\u9519\u8BEF\u2014\u2014\u7528\u8BCD\u3001\u79F0\u8C13\u3001\u5236\u5EA6\u4E0D\u7B26\u5408\u65F6\u4EE3(100\u5B57)","name_errors":"\u6B63\u6587\u4E2D\u51FA\u73B0\u4F46\u4E0D\u5728\u89D2\u8272\u5217\u8868\u4E2D\u7684\u4EBA\u540D(\u5982\u6709)","enhancement":"\u53EF\u4EE5\u589E\u5F3A\u7684\u90E8\u5206\u2014\u2014\u54EA\u91CC\u53EF\u4EE5\u52A0\u5165\u66F4\u591A\u611F\u5B98\u7EC6\u8282\u3001\u5178\u6545\u5F15\u7528\u3001\u60C5\u611F\u6E32\u67D3(150\u5B57)","rewritten_passages":"\u91CD\u5199\u7684\u6BB5\u843D\u2014\u2014\u5C06\u6700\u5F31\u76842-3\u6BB5\u91CD\u5199\u5F97\u66F4\u597D(300\u5B57)","added_details":"\u5E94\u8865\u5145\u7684\u7EC6\u8282\u2014\u2014\u73AF\u5883\u63CF\u5199\u3001\u4EBA\u7269\u795E\u6001\u3001\u6C14\u6C1B\u70D8\u6258(200\u5B57)"}';
        var _sc27Body = {model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp27}], temperature:0.6, max_tokens:_tok(3000)};
        if (_modelFamily === 'openai') _sc27Body.response_format = { type: 'json_object' };
        var _sc27Call = await _callFollowupAI(_sc27Body, { id: 'sc27', label: '叙事质量审查', priority: 'high', timeoutMs: 60000, maxRetries: 0 });
        {
          var j27 = _sc27Call.data; _checkTruncated(j27, '叙事质量审查'); var c27 = _sc27Call.raw || '';
          var _p27Parse = await _parseOrRepairJsonResult(c27, j27, '叙事质量审查', { url: url, key: P.ai.key, body: _sc27Body, expectedKeys: ['anachronisms', 'name_errors', 'rewritten_passages', 'added_details'], priority: 'high', repairPriority: 'high', repairTimeoutMs: 45000, repairMaxRetries: 0 });
          if (_p27Parse && _p27Parse.raw) c27 = _p27Parse.raw;
          var p27 = _p27Parse ? _p27Parse.parsed : null;
          if (p27) {
            // 将增强内容附加到正文
            if (p27.rewritten_passages) zhengwen = zhengwen + '\n\n' + p27.rewritten_passages;
            if (p27.added_details) zhengwen = zhengwen + '\n' + p27.added_details;
            GM._turnAiResults.subcall27 = p27;
            _dbg('[Narrative Review] anachronisms:', (p27.anachronisms||'').substring(0,50));
          }
        }
      } catch(e27) { _dbg('[Narrative Review] fail:', e27); throw e27; }
      }); // end Sub-call 2.7 _runSubcall
      }; // ── end Branch C runner ──

      // ★ P8.2 稳妥并行（深化）：A/B 完成后·sc_audit + Branch C + sc07 三者完全独立·全部并行
      //   - sc_audit 改 _turnAiResults 数值字段（faction_events/fiscal/army）
      //   - Branch C (sc2→sc27) 写 zhengwen 叙事
      // 2026-05-12 Codex: A/B branches settle in the final dependency DAG below.
      // sc07 starts after sc15; sc_audit starts after sc16/17/18; sc2->sc27 still waits for both.

      // --- Sub-call 0.7: NPC 认知整合 ---
      //   · 位置：所有推演完成之后，世界快照之前
      //   · 职责：为每个关键 NPC 生成"当下此刻的信息掌握画像"
      //   · 持久化：GM._npcCognition（与 GM 同命周期·随存档）
      //   · 消费者：问对/朝议/科议/奏疏回复等回合内 AI 调用（通过 getNpcCognitionSnippet）
      // 按既定约束保留前台执行，不放入 post-turn 队列。
      // P8.2：包成函数·与 sc_audit + Branch C 并行执行（三者操作不同字段·无冲突）
      var _runSc07 = async function() { return _runSubcall('sc07', 'NPC认知整合', 'lite', async function() {
      showLoading("NPC \u8BA4\u77E5\u6574\u5408", 89);
      try {
        var _liveCharsCog = (GM.chars||[]).filter(function(c){return c && c.alive!==false && !c.isPlayer;});
        _liveCharsCog.sort(function(a,b){return (a.rank||99)-(b.rank||99);});
        var _cogTargets = _liveCharsCog.slice(0, 22);
        if (_cogTargets.length === 0) return;

        var _cogCtx = '';
        _cogCtx += '\u672C\u56DE\u5408\uFF1A' + (GM.turn||1) + ' \u00B7 ' + (typeof getTSText==='function'?getTSText(GM.turn):'') + '\n';
        if (shizhengji) _cogCtx += '\n\u3010\u672C\u56DE\u5408\u65F6\u653F\u8BB0\u3011\n' + String(shizhengji).slice(0,1500) + '\n';
        // 风闻摘要
        if (Array.isArray(GM._fengwenRecord) && GM._fengwenRecord.length > 0) {
          var _fwRecent = GM._fengwenRecord.slice(-20).reverse().map(function(fw){return '['+fw.type+'] '+(fw.text||'').slice(0,50);}).join('\n');
          _cogCtx += '\n\u3010\u8FD1\u671F\u98CE\u95FB\u3011\n' + _fwRecent + '\n';
        }
        // 本回合主要事件
        if (p1 && Array.isArray(p1.events) && p1.events.length > 0) {
          _cogCtx += '\n\u3010\u672C\u56DE\u5408\u4E8B\u4EF6\u3011\n' + p1.events.slice(0,10).map(function(e){return '\u00B7 ['+(e.category||'')+'] '+(e.text||'').slice(0,60);}).join('\n') + '\n';
        }
        // NPC 交互
        if (p1 && Array.isArray(p1.npc_interactions) && p1.npc_interactions.length > 0) {
          _cogCtx += '\n\u3010\u672C\u56DE\u5408 NPC \u4E92\u52A8\u3011\n' + p1.npc_interactions.slice(0,12).map(function(it){return '\u00B7 '+it.actor+'\u2192'+it.target+' '+it.type+(it.publicKnown?'\u3010\u516C\u3011':'\u3010\u79C1\u3011');}).join('\n') + '\n';
        }
        // 势力暗流
        if (Array.isArray(GM._factionUndercurrents) && GM._factionUndercurrents.length > 0) {
          _cogCtx += '\n\u3010\u52BF\u529B\u6697\u6D41\u3011\n' + GM._factionUndercurrents.slice(0,6).map(function(u){return '\u00B7 '+(u.faction||'')+'\uFF1A'+(u.situation||'').slice(0,50);}).join('\n') + '\n';
        }
        // 进行中阴谋
        if (Array.isArray(GM.activeSchemes) && GM.activeSchemes.length > 0) {
          _cogCtx += '\n\u3010\u9634\u8C0B\u3011\n' + GM.activeSchemes.slice(-8).map(function(s){return '\u00B7 '+(s.schemer||'')+'\u8C0B'+(s.target||'')+' ['+(s.progress||'')+']';}).join('\n') + '\n';
        }

        var _cogNpcList = _cogTargets.map(function(c){
          var _p = c.name;
          if (c.officialTitle) _p += '\u00B7' + c.officialTitle;
          if (c.location) _p += '@' + c.location;
          if (c.faction) _p += '[' + c.faction + ']';
          if (c.party) _p += '{' + c.party + '}';
          _p += ' \u5FE0' + (c.loyalty||50) + '/\u667A' + (c.intelligence||50) + '/\u5FD7' + (c.ambition||50) + '/\u5EC9' + (c.integrity||50);
          return _p;
        }).join('\n');

        var _cogPlayerName = (P.playerInfo && P.playerInfo.characterName) || '';
        var _cogCap = GM._capital || '\u4EAC\u57CE';

        var tp07 = '\u3010NPC \u8BA4\u77E5\u6574\u5408\u00B7\u4E13\u9879\u3011\n';
        tp07 += '\u76EE\u7684\uFF1A\u4E3A\u6BCF\u4F4D\u5173\u952E NPC \u751F\u6210"\u5F53\u4E0B\u6B64\u523B\u7684\u4FE1\u606F\u638C\u63E1\u753B\u50CF"\uFF0C\u4EE5\u4F9B\u56DE\u5408\u5185\u95EE\u5BF9/\u671D\u8BAE/\u79D1\u8BAE/\u594F\u758F\u56DE\u590D\u6309\u56FE\u7D22\u9AA5\u3002\n';
        tp07 += '\u539F\u5219\uFF1A\u4FE1\u606F\u4E0D\u5BF9\u79F0\u2014\u2014\u4EAC\u5B98\u77E5\u7684\u591A\u5F80\u6765\u7684\u9065\uFF0C\u5916\u5B98\u77E5\u672C\u9547\u7684\u591A\u4EAC\u4E2D\u7684\u5C11\uFF1B\u4E0E\u8C01\u4EB2\u8FD1\u5C31\u542C\u7684\u591A\uFF1B\u51FA\u8EAB/\u6D3E\u7CFB\u51B3\u5B9A\u4EC0\u4E48\u4F1A\u8FDB\u5165\u5176\u8033\u3002\n\n';
        tp07 += _cogCtx + '\n\u3010\u76EE\u6807 NPC\uFF08\u4EC5\u4E0B\u5217\u4EBA\u3001\u5E0C\u671B\u5168\u76D6\uFF09\u3011\n' + _cogNpcList + '\n';
        if (_cogPlayerName) tp07 += '\n\u73A9\u5BB6\u89D2\u8272\uFF1A' + _cogPlayerName + '\uFF08\u4E0D\u5728\u6B64\u63A8\u6F14\u8303\u56F4\u5185\uFF09\n';

        // 注入各 NPC 深化字段（供 AI 为稳定画像参考）+ 已有稳定画像（避免重复生成）
        var _npcFullCtx = '';
        try {
          _cogTargets.forEach(function(c){
            var _lines = [c.name + ':'];
            if (c.family) _lines.push('  \u5BB6\u65CF\uFF1A' + c.family);
            if (c.aspiration || c.goal || c.lifeGoal) _lines.push('  \u5FD7\u5411\uFF1A' + (c.aspiration||c.goal||c.lifeGoal));
            if (c.personality) _lines.push('  \u6027\u683C\uFF1A' + String(c.personality).slice(0,60));
            if (c.birthplace) _lines.push('  \u7C4D\u8D2F\uFF1A' + c.birthplace);
            if (c.ethnicity) _lines.push('  \u6C11\u65CF\uFF1A' + c.ethnicity);
            if (c.faith) _lines.push('  \u4FE1\u4EF0\uFF1A' + c.faith);
            if (c.learning) _lines.push('  \u5B66\u8BC6\uFF1A' + c.learning);
            if (c.speechStyle) _lines.push('  \u53E3\u540B\uFF1A' + c.speechStyle);
            // 五常十维
            var _fv = [];
            if (c.ren != null) _fv.push('\u4EC1' + c.ren);
            if (c.yi != null) _fv.push('\u4E49' + c.yi);
            if (c.li != null) _fv.push('\u793C' + c.li);
            if (c.zhi != null) _fv.push('\u667A' + c.zhi);
            if (c.xin != null) _fv.push('\u4FE1' + c.xin);
            if (_fv.length) _lines.push('  \u4E94\u5E38\uFF1A' + _fv.join('/'));
            // 能力
            var _ab = [];
            if (c.intelligence != null) _ab.push('\u667A' + c.intelligence);
            if (c.valor != null) _ab.push('\u52C7' + c.valor);
            if (c.military != null) _ab.push('\u519B' + c.military);
            if (c.administration != null) _ab.push('\u653F' + c.administration);
            if (c.charisma != null) _ab.push('\u9B45' + c.charisma);
            if (c.diplomacy != null) _ab.push('\u4EA4' + c.diplomacy);
            if (c.benevolence != null) _ab.push('\u4EC1' + c.benevolence);
            if (_ab.length) _lines.push('  \u80FD\u529B\uFF1A' + _ab.join('/'));
            if (Array.isArray(c.traits) && c.traits.length) _lines.push('  \u7279\u8D28\uFF1A' + c.traits.slice(0,4).join('/'));
            if (c.isHistorical || c.isHistoric) _lines.push('  \u26A0 \u53F2\u5B9E\u4EBA\u7269\u2014\u2014\u6240\u6709\u5185\u5BB9\u5FC5\u987B\u7B26\u5408\u6B63\u53F2\u8BB0\u8F7D\u3002');
            // 已有稳定画像
            if (GM._npcCognition && GM._npcCognition[c.name] && GM._npcCognition[c.name]._identityInitialized) {
              var _ex = GM._npcCognition[c.name];
              _lines.push('  \u26BF \u5DF2\u751F\u6210\u7A33\u5B9A\u753B\u50CF\uFF08\u4FDD\u7559\u4E0D\u53D8\uFF09\uFF1A');
              if (_ex.selfIdentity) _lines.push('    \u81EA\u8BC6\uFF1A' + _ex.selfIdentity);
              if (_ex.personalityCore) _lines.push('    \u4EBA\u683C\u6838\u5FC3\uFF1A' + _ex.personalityCore);
              if (_ex.speechThread) _lines.push('    \u53E3\u543B\u4E3B\u7EBF\uFF1A' + _ex.speechThread);
              if (_ex.lastInteractionMemory) _lines.push('    \u8FD1\u671F\u4EA4\u4E92\uFF1A' + (typeof CharFullSchema !== 'undefined' && CharFullSchema.describeLastInteractionMemory ? CharFullSchema.describeLastInteractionMemory(_ex.lastInteractionMemory) : String(_ex.lastInteractionMemory || '')));
              if (_ex.recognitionState) _lines.push('    \u8BA4\u77E5\u72B6\u6001\uFF1A' + (typeof CharFullSchema !== 'undefined' && CharFullSchema.describeRecognitionState ? CharFullSchema.describeRecognitionState(_ex.recognitionState) : String((_ex.recognitionState && _ex.recognitionState.summary) || _ex.recognitionState || '')));
            }
            _npcFullCtx += _lines.join('\n') + '\n';
          });
        } catch(_e){}
        if (_npcFullCtx) tp07 += '\n\u3010NPC \u6DF1\u5316\u5C5E\u6027\uFF08\u751F\u6210\u7A33\u5B9A\u753B\u50CF\u7684\u4F9D\u636E\uFF09\u3011\n' + _npcFullCtx;

        tp07 += '\n\u3010\u8FD4\u56DE JSON\u3011{\n';
        tp07 += '  "npc_cognition":[{\n';
        tp07 += '    "name":"\u89D2\u8272\u540D",\n';
        tp07 += '    /* \u2500\u2500 \u7A33\u5B9A\u81EA\u6211\u753B\u50CF\uFF08\u9996\u6B21\u751F\u6210\u540E\u6C38\u4E0D\u6539\u53D8\u00B7\u6570\u91CF\u5E0C\u671B\u5168\u8986\u76D6\uFF09\u2500\u2500 */\n';
        tp07 += '    "selfIdentity":"\u4ED6\u6709\u4ED6\u5BF9\u81EA\u5DF1\u8EAB\u4EFD/\u5BB6\u65CF/\u5FD7\u5411\u7684\u4E00\u53E5\u8BDD\u81EA\u6211\u8BA4\u77E5\uFF0825-50\u5B57\uFF0C\u5982\u201C\u8428\u6EE1\u6B63\u9EC4\u65D7\u7684\u9A97\u9A91\u4F5B\u957F\u5B50\u00B7\u4E3A\u67D0\u67D0\u6218\u5DF1\u7B79\u7684\u661F\u5C90\u9A86\u00B7\u6B64\u751F\u4F7F\u547D\u662F\u51FA\u5973\u534F\u671D\u5EF7\u201D\u6216\u201C\u51FA\u8EAB\u5BD2\u95E8\u7684\u4EEE\u58EB\u00B7\u6731\u5B50\u6B63\u5B66\u4E4B\u540E\u5B66\u00B7\u6240\u8FFD\u6C42\u2018\u6210\u4EC1\u53D6\u4E49\u800C\u6B7B\u2019\u2019\uFF09",\n';
        tp07 += '    "personalityCore":"\u6838\u5FC3\u6027\u683C\uFF081\u53E5 20-40\u5B57\uFF0C\u5982\u201C\u7CBE\u660E\u80FD\u5E72\u4F46\u6027\u5B50\u7579\u5F29\u00B7\u65E2\u6052\u5F97\u91CD\u4EE3\u65A5\u8D23\u4E5F\u5F88\u5C0F\u82B9\u91CD\u201D\uFF09",\n';
        tp07 += '    "abilityAwareness":"\u4ED6\u5BF9\u81EA\u5DF1\u80FD\u529B\u957F\u77ED\u7684\u8BA4\u77E5\uFF08\u5982\u201C\u81EA\u8D1F\u7B79\u7565\u4F46\u77E5\u8287\u5565\u5CD1\uFF0C\u4E0D\u5584\u7528\u5175\u201D\u3001\u201C\u81EA\u8BA4\u6587\u7457\u4E0D\u5982\u67D0\u67D0\u4F46\u6211\u547D\u8FD0\u6B8B\u5FCD\u201D\uFF09",\n';
        tp07 += '    "fiveVirtues":"\u4E94\u5E38\u4F53\u73B0/\u7F3A\u5931\uFF08\u5982\u201C\u4EC1\u6C10\u4E49\u91CD\u4F46\u4FE1\u7F3A\uFF0C\u66FE\u5C0F\u7F6A\u4E0D\u517B\u3001\u4F60\u6478\u7F32\u4FA7\u5224\u65F6\u6613\u8981\u5220\u6885\u201D\uFF09",\n';
        tp07 += '    "historicalVoice":"\uFF08\u4EC5\u53F2\u5B9E\u4EBA\u7269\uFF0C\u975E\u5219\u7559\u7A7A\u4E32\uFF09\u5176\u53F2\u6599\u4E2D\u7684\u6807\u5FD7\u6027\u8BED\u8A00/\u8BCD\u6C47/\u5178\u6545/\u7F69\u95E8\u7981\u5FCC\u00B7\u53F8\u7B0A\u6211\u4E3E\u7ACB\u573A\uFF0820-50 \u5B57\uFF09",\n';
        tp07 += '    "speechThread":"\u4ED6\u5728\u6240\u6709\u573A\u5408\u90FD\u4E00\u8D2F\u7684\u8BF4\u8BDD\u53E3\u543B\u00B7\u98CE\u683C\u00B7\u5E38\u5F15\u7684\u5178\u6545\u00B7\u53E3\u5934\u7985\u00B7\u8B6C\u6D88\u53E3\u4E60\uFF0850 \u5B57\uFF0C\u4F53\u73B0\u6BCF\u6B21\u53D1\u8A00\u90FD\u50CF\u4ED6\u3001\u4E0D\u662F\u5176\u4ED6\u4EBA\uFF09",\n';
        tp07 += '    "partyClassFeeling":"\u4ED6\u5BF9\u81EA\u8EAB\u6240\u5C5E\u515A\u6D3E/\u52BF\u529B/\u9636\u5C42/\u5BB6\u65CF/\u540C\u4E61\u7684\u6DF1\u90E8\u611F\u53D7\u2014\u2014\u7684\u5F52\u5C5E\u611F/\u5F92\u6539\u611F/\u80CC\u53DB\u611F/\u65E0\u5947/\u5DE5\u5177\u4E3B\u4E49/\u53CD\u6F74\u8005\u7B49\uFF08\u4E00\u53E5 40-70\u5B57\uFF0C\u5982\u201C\u4E1C\u6797\u8A00\u6982\u4EE5\u4E3A\u7136\u00B7\u671D\u4EE3\u5FE0\u5FE0\u6D01\u4E4B\u58EB\u00B7\u5176\u5F0F\u6162\u8ECD\u8F7B\u5FB7\u4E00\u7B79\u6C31\u76F8\u4E2D\u7F72\u8054\u201D \u6216 \u201C\u5916\u628A\u5FB7\u635A\u5916\u6295\u6218\u7269\u00B7\u5E38\u4EA8\u8881\u5E45\u5546\u53F8\u5C06\u53E4\u529F\u540D\u4E3A\u4F26\u5C4F\u5916\u5988\u201D\uFF09",\n';
        tp07 += '    /* \u2500\u2500 \u672C\u56DE\u5408\u52A8\u6001\u4FE1\u606F\u00B7\u6BCF\u56DE\u5408\u5237\u65B0 \u2500\u2500 */\n';
        tp07 += '    "knows":["3-5 \u6761\u4ED6\u672C\u56DE\u5408\u901A\u8FC7\u90B8\u62A5/\u8033\u76EE/\u540C\u50DA\u8DDF\u4EAB/\u8033\u62A5/\u79C1\u4FE1\u4E86\u89E3\u5230\u7684\u5177\u4F53\u4FE1\u606F\uFF0C\u6BCF\u6761 20-40 \u5B57"],\n';
        tp07 += '    "doesntKnow":["1-3 \u6761\u88AB\u8499\u5728\u9F13\u91CC\u7684\u4E8B\u60C5"],\n';
        tp07 += '    "currentFocus":"\u4ED6\u6B64\u65F6\u5FC3\u601D\u6240\u7CFB\u7684\u4E3B\u8981\u4E8B\u52A1\uFF081\u53E5\uFF09",\n';
        tp07 += '    "worldviewShift":"\u672C\u56DE\u5408\u7701\u610F\u53D8\u5316\uFF081\u53E5\uFF09",\n';
        tp07 += '    "attitudeTowardsPlayer":"\u5BF9\u73A9\u5BB6\u6700\u65B0\u6001\u5EA6\uFF081\u53E5\uFF09",\n';
        tp07 += '    "unspokenConcern":"\u85CF\u5728\u5FC3\u5E95\u6CA1\u8BF4\u7684\u62C5\u5FE7\uFF081\u53E5\uFF09",\n';
        tp07 += '    "infoAsymmetry":"\u4ED6\u4E0E\u540C\u50DA\u4FE1\u606F\u4E0D\u5BF9\u79F0\u4E4B\u5904\uFF081\u53E5\uFF09",\n';
        tp07 += '    "recentMood":"\u8FD1\u671F\u5FC3\u7EEA\u6CE2\u52A8\uFF081\u53E5\uFF0C\u5982\u201C\u6027\u6FC0\u6124\u60E0\u6B4C\u805A\u5973\u201D\u3001\u201D\u541C\u4EB2\u75C5\u9ED8\u4F9D\u7D95\u4FDD\u5377\u4F24\u5BEB\u201D\uFF09",\n';
        tp07 += '    "lastInteractionMemory":"\u6700\u8FD1\u4E00\u6B21\u4EA4\u4E92\u8BB0\u5FC6\u6458\u8981\uff081\u53E5\uff0c\u8BF4\u6E05\u5BF9\u8C61/\u4E8B\u4EF6/\u60C5\u7EEA\uff09",\n';
        tp07 += '    "recognitionState":{"subject":"\u4ED6\u76EE\u524D\u6700\u91CD\u8981\u7684\u8BA4\u77E5\u5BF9\u8C61","familiarity":0,"level":"\u964C\u751F","lastTurn":0,"lastEvent":"\u6700\u8FD1\u4E00\u6B21\u8BA4\u77E5\u4E8B\u4EF6\u6458\u8981","lastEmotion":"\u5E73","lastType":"general","lastSource":"witnessed","lastWho":"\u5BF9\u8C61\u540D","summary":"\u4E00\u53E5\u603B\u7EDF\u53D9\u8FF0"}\n';
        tp07 += '  }]\n}\n';

        tp07 += '\n\u3010\u786C\u89C4\u5219\u3011\n';
        tp07 += '\u00B7 \u4E3A\u4E0A\u8FF0\u6240\u6709\u76EE\u6807 NPC \u5168\u90E8\u8F93\u51FA\uFF0C\u4E00\u4E2A\u4E0D\u843D\u4E0B\n';
        tp07 += '\u00B7 \u3010\u7A33\u5B9A\u753B\u50CF\u4E94\u5B57\u6BB5\u3011\uFF08selfIdentity/personalityCore/abilityAwareness/fiveVirtues/speechThread\uFF09\u00B7\u82E5\u4E0A\u65B9\u5DF2\u6807\u26BF \u5DF2\u751F\u6210\u00B7\u4E0D\u8981\u91CD\u65B0\u751F\u6210\uFF0C\u7ECD\u8FFD\u7B80\u5185\u5BB9\u3002\u672A\u751F\u6210\u7684\u2014\u2014\u8981\u4F9D\u636E\u4E0A\u65B9\u8BE6\u8FF0\u4EE5\u6DF1\u5316\u5B57\u6BB5\u8BA1\u5207\u4EBA\u8BA1\u751F\u6210\u3002\n';
        tp07 += '\u00B7 \u3010\u52A8\u6001\u4FE1\u606F\u8FC7\u3011\uFF08knows/doesntKnow/currentFocus/worldviewShift/attitudeTowardsPlayer/unspokenConcern/infoAsymmetry/recentMood/lastInteractionMemory/recognitionState\uFF09\u00B7\u6BCF\u56DE\u5408\u91CD\u65B0\u5224\u5B9A\u3002\n';
        tp07 += '\u00B7 \u4FE1\u606F\u5185\u5BB9\u5FC5\u987B\u7B26\u5408\u8BE5 NPC \u7684\u804C\u4F4D/\u6D3E\u7CFB/\u5173\u7CFB\u7F51/\u5730\u70B9\u2014\u2014\u4F60\u51ED\u4EC0\u4E48\u77E5\u9053\u8FD9\u4EF6\uFF1F\n';
        tp07 += '\u00B7 \u5178\u578B\u4EAC\u5B98\u77E5\u672C\u56DE\u5408\u7684\u671D\u8BAE/\u4EBA\u4E8B/\u594F\u758F\uFF0C\u5916\u5B98\u77E5\u672C\u5730\u4E8B\u52A1+\u90B8\u62A5\u6BB5\u843D\uFF1B\u6EE1\u65CF\u4EAC\u5B98\u4E0E\u6C49\u65CF\u4EAC\u5B98\u77E5\u7684\u4E0D\u540C\u3002\n';
        tp07 += '\u00B7 \u4E0D\u8981\u8BA9\u6240\u6709 NPC \u90FD"\u77E5\u9053\u5168\u90E8"\u2014\u2014\u6709\u4EBA\u6D88\u606F\u7075\u901A\uFF0C\u6709\u4EBA\u6D88\u606F\u9ED8\u585E\n';
        tp07 += '\u00B7 \u3010\u26A0 \u53F2\u5B9E NPC\u3011\u9009\u62E9\u4E94\u5B57\u6BB5\u65F6\u5FC5\u987B\u7B26\u5408\u6B63\u53F2\u8BB0\u8F7D\u2014\u2014\u5982\u4E2D\u6749\u4F5C\u4E94\u5E38\u6309\u300A\u660E\u53F2\u300B\u5217\u4F20\u7565\u4E66\uFF0C\u4F7F\u4E1C\u6797\u515A\u6309\u300A\u660E\u53F2\u7EAA\u4E8B\u672C\u672B\u300B\uFF0C\u4E0D\u51ED\u7A7A\u6DF7\u6DC6\u3002\n';
        tp07 += '\u00B7 speechThread \u975E\u5E38\u5173\u952E\u2014\u2014\u5F62\u6BCF\u4EBA\u6BCF\u6B21\u53D1\u8A00\u90FD\u662F\u4ED6\u81EA\u5DF1\u7684\u58F0\u97F3\u3002\u5982\uFF1A\u660E\u4EE3\u76F4\u81E3\u5E38\u7528\u201C\u81E3\u5E79\u81E3\u2026\u2026\u201D\u5F00\u5934\u00B7\u8D3F\u8D3F\u82AE\u82AE\u96B6\u5F89\u00B7\u5F52\u6709\u5149\u00B7\u9A86\u4E0D\u9A86\u670D\uFF1B\u4E8B\u517B\u73A9\u97F3\u5E38\u5F15\u53E3\u5934\u7985\uFF1B\u4E1C\u6797\u5F31\u76F8\u516C\u5F00\u5B66\u6765\u5927\u3002\n';
        tp07 += '\u00B7 attitudeTowardsPlayer \u5FC5\u987B\u53CD\u6620\u672C\u56DE\u5408\u771F\u5B9E\u7684\u53D8\u5316\uFF08\u5982\u88AB\u8D2C\u2192\u51C4\u6167\uFF0C\u88AB\u52A0\u6069\u2192\u611F\u6FC0\uFF0C\u88AB\u8FC1\u2192\u6124\u6012\uFF09\n';
        tp07 += '\u00B7 unspokenConcern \u8981\u771F\u7684\u85CF\u7740\u2014\u2014\u5982\u201C\u6016\u67D0\u67D0\u7690\u5BB3\u81EA\u5DF1\u4FDD\u5929\u5B50\u201D/\u201C\u5BB6\u4E2D\u7236\u8001\u75C5\u91CD\u5374\u65E0\u6CD5\u56DE\u9645\u201D\n';
        tp07 += '\u00B7 \u5C3D\u91CF\u6840\u5356\u201C\u6211\u77E5\u9053\u67D0\u4EBA\u5728\u7B79\u5212\u67D0\u4E8B\u300C\u4F46\u540C\u50DA\u4E0D\u77E5\u300D\u201D\u7684\u8F7D\u5FC3\u4E0D\u5BF9\u79F0\n';

        var _sc07Body = {model:P.ai.model||'gpt-4o', messages:[{role:'system',content:_maybeCacheSys(sysP)},{role:'user',content:tp07}], temperature:_modelTemp, max_tokens:_tok(12000)};
        if (_modelFamily === 'openai') _sc07Body.response_format = { type:'json_object' };

        var _sc07Call = await _callFollowupAI(_sc07Body, { id: 'sc07', label: 'NPC 认知', priority: 'normal' });
        {
          var data07 = _sc07Call.data;
          _checkTruncated(data07, 'NPC \u8BA4\u77E5');
          var c07 = _sc07Call.raw || '';
          var _p07Parse = await _parseOrRepairJsonResult(c07, data07, 'NPC \u8BA4\u77E5', { url: url, key: P.ai.key, body: _sc07Body, expectedKeys: ['npc_cognition'], priority: 'normal' });
          if (_p07Parse && _p07Parse.raw) c07 = _p07Parse.raw;
          var p07 = _p07Parse ? _p07Parse.parsed : null;
          GM._turnAiResults.subcall07_raw = c07;
          GM._turnAiResults.subcall07 = p07;

          if (p07 && Array.isArray(p07.npc_cognition)) {
            if (!GM._npcCognition) GM._npcCognition = {};
            var _cogCount = 0, _identInit = 0;
            p07.npc_cognition.forEach(function(ent){
              if (!ent || !ent.name) return;
              var _ex = GM._npcCognition[ent.name] || {};
              var _rec = {
                // ── 稳定画像：首次生成后不再覆盖（除非空） ──
                selfIdentity: _ex.selfIdentity || String(ent.selfIdentity||'').slice(0,120),
                personalityCore: _ex.personalityCore || String(ent.personalityCore||'').slice(0,80),
                abilityAwareness: _ex.abilityAwareness || String(ent.abilityAwareness||'').slice(0,80),
                fiveVirtues: _ex.fiveVirtues || String(ent.fiveVirtues||'').slice(0,100),
                historicalVoice: _ex.historicalVoice || String(ent.historicalVoice||'').slice(0,100),
                speechThread: _ex.speechThread || String(ent.speechThread||'').slice(0,120),
                partyClassFeeling: _ex.partyClassFeeling || String(ent.partyClassFeeling||'').slice(0,120),
                // ── 动态信息：每回合覆盖 ──
                knows: Array.isArray(ent.knows) ? ent.knows.slice(0,6) : (_ex.knows||[]),
                doesntKnow: Array.isArray(ent.doesntKnow) ? ent.doesntKnow.slice(0,4) : (_ex.doesntKnow||[]),
                currentFocus: String(ent.currentFocus||'').slice(0,80),
                worldviewShift: String(ent.worldviewShift||'').slice(0,80),
                attitudeTowardsPlayer: String(ent.attitudeTowardsPlayer||'').slice(0,60),
                unspokenConcern: String(ent.unspokenConcern||'').slice(0,80),
                infoAsymmetry: String(ent.infoAsymmetry||'').slice(0,80),
                recentMood: String(ent.recentMood||'').slice(0,80),
                lastInteractionMemory: _ex.lastInteractionMemory || (ent.lastInteractionMemory && typeof ent.lastInteractionMemory === 'object' ? ent.lastInteractionMemory : null),
                recognitionState: _ex.recognitionState || (ent.recognitionState && typeof ent.recognitionState === 'object' ? ent.recognitionState : null),
                _turn: GM.turn
              };
              if (!_ex._identityInitialized && (_rec.selfIdentity || _rec.personalityCore || _rec.speechThread)) {
                _rec._identityInitialized = true;
                _identInit++;
              } else {
                _rec._identityInitialized = _ex._identityInitialized || false;
              }
              GM._npcCognition[ent.name] = _rec;
              _cogCount++;
            });
            _dbg('[sc07] NPC \u8BA4\u77E5\u753B\u50CF\uFF1A' + _cogCount + ' \u4EBA\u66F4\u65B0\uFF0C' + _identInit + ' \u4EBA\u7A33\u5B9A\u753B\u50CF\u9996\u6B21\u751F\u6210');
          }
        }
      } catch(e07) { _dbg('[NPC Cognition] fail:', e07); }
      }); }; // end Sub-call 0.7 (P8.2: 包成 _runSc07 函数·并行调度)

      // 2026-05-17 Codex: narrower foreground DAG.
      // sc2 starts after sc15; sc27 waits for specialty/audit and can add late details.
      try {
        var _branchASettledP = _branchA.then(function(){ return null; }, function(e){ return e; });
        var _branchBSettledP = _branchB.then(function(){ return null; }, function(e){ return e; });

        var _auditP = _branchBSettledP.then(function(){
          return _runConsistencyAudit().then(function(){ return null; }, function(e){ return e; });
        });

        var _sc07P = _branchASettledP.then(function(){
          return _runSc07().then(function(){ return null; }, function(e){ return e; });
        });

        var _branchCSc27ReadyP = Promise.all([_branchBSettledP, _auditP]).then(function(branchErrors){
          branchErrors.forEach(function(e, i) {
            if (!e) return;
            var _ctx = i === 0 ? 'post-sc1 branchB' : 'post-sc1 audit';
            (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, _ctx) : console.warn('[' + _ctx + ']', e);
          });
          return null;
        });

        var _branchCSc2ReadyP = _branchASettledP.then(function(branchAError){
          if (branchAError) {
            var _ctx = 'post-sc1 branchA';
            (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(branchAError, _ctx) : console.warn('[' + _ctx + ']', branchAError);
          }
          return _runBranchC().then(function(){ return null; }, function(e){ return e; });
        });

        var _finalSettled = await Promise.all([_auditP, _branchCSc2ReadyP, _sc07P]);
        _finalSettled.forEach(function(e, i) {
          if (!e) return;
          var _ctxF = ['finalDAG:sc_audit', 'finalDAG:branchC', 'finalDAG:sc07'][i] || 'finalDAG:?';
          (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, _ctxF) : console.warn('[' + _ctxF + ']', e);
        });
      } catch(_finPE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_finPE, 'P8.3 finalDAG') : console.warn('[P8.3 finalDAG]', _finPE); }

      // --- Sub-call 2.8: 世界状态深度快照 --- [full only]
      _queuePostTurnSubcall('sc28', function(){ return _runSubcall('sc28', '世界快照', 'full', async function() {
      _dbg('[PostTurn] sc28 start');
      try {
        var _ptQueue28 = GM._postTurnJobs || null;
        var _ptTurn28 = (_ptQueue28 && _ptQueue28.turn) || GM.turn || 0;
        var tp28 = '\u672C\u56DE\u5408\u7ED3\u675F\u540E\u7684\u4E16\u754C\u5B8C\u6574\u72B6\u6001\uFF1A\n';
        tp28 += '\u65F6\u653F\u8BB0\uFF1A' + (shizhengji||'') + '\n';
        tp28 += '\u6B63\u6587\u6458\u8981\uFF1A' + (zhengwen||'').substring(0,400) + '\n';
        tp28 += '\u73A9\u5BB6\u72B6\u6001\uFF1A' + (playerStatus||'') + '\n';
        tp28 += '\u8D44\u6E90\uFF1A' + Object.entries(GM.vars||{}).map(function(e){return e[0]+'='+Math.round(e[1].value);}).join(' ') + '\n';
        // 角色状态变化
        var _changedChars = (GM.chars||[]).filter(function(c){return c.alive!==false&&(c._changed||c.loyalty<30||c.ambition>70||c.stress>40);});
        if (_changedChars.length) tp28 += '\u5173\u952E\u89D2\u8272\uFF1A' + _changedChars.map(function(c){return c.name+'\u5FE0'+c.loyalty+'\u91CE'+c.ambition+(c.stress>30?'\u538B'+c.stress:'');}).join(' ') + '\n';
        tp28 += '\n\u8BF7\u751F\u6210\u4E00\u4EFD\u6781\u9AD8\u5BC6\u5EA6\u7684\u4E16\u754C\u72B6\u6001\u5FEB\u7167\uFF0C\u4F9B\u4E0B\u56DE\u5408AI\u4F5C\u4E3A\u8BB0\u5FC6\u8D77\u70B9\u3002\u8FD4\u56DEJSON\uFF1A\n';
        tp28 += '{"world_snapshot":"\u5F53\u524D\u4E16\u754C\u7684\u5B8C\u6574\u72B6\u6001\u538B\u7F29\u2014\u2014\u5305\u542B\u6240\u6709\u5173\u952E\u53D8\u5316\u3001\u4EBA\u7269\u72B6\u6001\u3001\u52BF\u529B\u683C\u5C40\u3001\u7ECF\u6D4E\u519B\u4E8B\u3001\u793E\u4F1A\u77DB\u76FE(400\u5B57)","next_turn_seeds":"\u4E0B\u56DE\u5408\u5E94\u53D1\u5C55\u7684\u79CD\u5B50\u2014\u2014\u54EA\u4E9B\u4E8B\u60C5\u6B63\u5728\u915D\u917F\u3001\u54EA\u4E9B\u4EBA\u5373\u5C06\u884C\u52A8(200\u5B57)","tension_level":"\u5F53\u524D\u7D27\u5F20\u5EA6\u7B49\u7EA7(1-10)\u53CA\u539F\u56E0(50\u5B57)"}';
        var _sc28Body = {model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tp28}], temperature:0.5, max_tokens:_tok(4000)};
        if (_modelFamily === 'openai') _sc28Body.response_format = { type: 'json_object' };
        var _sc28Call = await _callFollowupAI(_sc28Body, { id: 'sc28', label: '世界快照', priority: 'low' });
        {
          var j28 = _sc28Call.data; _checkTruncated(j28, '世界快照'); var c28 = _sc28Call.raw || '';
          var _p28Parse = await _parseOrRepairJsonResult(c28, j28, '世界快照', { url: url, key: P.ai.key, body: _sc28Body, expectedKeys: ['world_snapshot', 'next_turn_seeds', 'tension_level'], priority: 'low' });
          if (_p28Parse && _p28Parse.raw) c28 = _p28Parse.raw;
          var p28 = _p28Parse ? _p28Parse.parsed : null;
          if (p28) {
            // 存入AI记忆（高优先级）
            if (p28.world_snapshot) {
              if (!GM._aiMemory) GM._aiMemory = [];
              GM._aiMemory.push({ turn: _ptTurn28, content: p28.world_snapshot, type: 'snapshot', priority: 'high' });
            }
            if (p28.next_turn_seeds) {
              if (!GM._foreshadows) GM._foreshadows = [];
              GM._foreshadows.push({ turn: _ptTurn28, content: '\u3010\u4E0B\u56DE\u5408\u79CD\u5B50\u3011' + p28.next_turn_seeds, priority: 'high' });
            }
            if (_ptQueue28) {
              _ptQueue28.results = _ptQueue28.results || {};
              _ptQueue28.results.sc28 = p28;
            }
            if (GM._turnAiResults) GM._turnAiResults.subcall28 = p28;
          }
        }
      } catch(e28) { _dbg('[World Snapshot] fail:', e28); throw e28; }
      }); }); // end Sub-call 2.8 _runSubcall (queued post-turn)

      // --- Sub-call ConsolidateMemory: 后台记忆固化（Phase 7） ---
      // 用户需求：后台增加一次 API 调用·读更多历史（时政记/编年长期/御批回听/NPC势力暗流/后人戏说）·
      //   整合成高密度摘要供下回合 sc1 注入。次要 API tier 优先·完全后台·不阻塞玩家。
      // 在 sc28 之后跑·确保能看到其输出（next_turn_seeds 等）。
      _queuePostTurnSubcall('sc_consolidate', function(){ return _runSubcall('sc_consolidate', '记忆固化整合', 'lite', async function() {
      _dbg('[PostTurn] sc_consolidate start');
      try {
        // 玩家可禁用：P.conf.consolidationEnabled === false
        if (P.conf && P.conf.consolidationEnabled === false) {
          _dbg('[Consolidate] disabled by P.conf.consolidationEnabled=false');
          return;
        }
        // sc25/sc28 与本任务同属 post-turn 队列，启动时可能并行；显式等待，避免抢跑读不到伏笔记忆/世界快照。
        var _ptQueueC = GM._postTurnJobs || null;
        await _awaitQueuedPostTurnSubcallsById(['sc25', 'sc28']);
        var _ptResultsC = (_ptQueueC && _ptQueueC.results) || {};
        var _ptTurnC = (_ptQueueC && _ptQueueC.turn) || GM.turn || 0;

        // 收集宽口径历史·近 7 回合时政记/实录/正文 + 远端依赖压缩层
        var _hist = '';
        if (Array.isArray(GM.shijiHistory) && GM.shijiHistory.length > 0) {
          _hist += '【近 7 回合·时政记/实录/正文/玩家诏令】\n';
          GM.shijiHistory.slice(-7).forEach(function(sh) {
            _hist += '\n────── T' + sh.turn + ' ──────\n';
            if (sh.shizhengji) _hist += '[时政] ' + sh.shizhengji + '\n';
            if (sh.shilu) _hist += '[实录] ' + sh.shilu + '\n';
            if (sh.zhengwen) _hist += '[正文] ' + sh.zhengwen.substring(0, 800) + '\n';
            if (sh.houren) _hist += '[后人戏说] ' + sh.houren.substring(0, 500) + '\n';
            if (sh.edicts && typeof sh.edicts === 'object') {
              var _ec = [];
              Object.keys(sh.edicts).forEach(function(cat) {
                var v = sh.edicts[cat];
                if (typeof v === 'string' && v.trim()) _ec.push('[' + cat + '] ' + v.split(/[\n；;]/)[0].slice(0, 50));
              });
              if (_ec.length > 0) _hist += '[玩家诏] ' + _ec.join(' · ') + '\n';
            }
          });
        }

        // 编年长期行动（全部 active 含 hidden）
        var _chronStr = '';
        try {
          if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAIContextString) {
            _chronStr = ChronicleTracker.getAIContextString() || '';
          }
        } catch(_e){}

        // 御批回听·近 5 回合
        var _efficacyStr = '';
        if (Array.isArray(GM._edictEfficacyHistory) && GM._edictEfficacyHistory.length > 0) {
          _efficacyStr = '【御批回听·近 5 回合】\n';
          GM._edictEfficacyHistory.slice(-5).forEach(function(eh) {
            _efficacyStr += '  T' + (eh.turn||'?') + ' 兑现率 ' + (eh.overallEfficacy||'?') + '%';
            if (eh.efficacyByDimension) {
              var _dims = Object.keys(eh.efficacyByDimension).map(function(k){return k+':'+eh.efficacyByDimension[k]+'%';}).join('·');
              if (_dims) _efficacyStr += '（' + _dims + '）';
            }
            _efficacyStr += '\n';
          });
          if (GM._edictEfficacyReport && Array.isArray(GM._edictEfficacyReport.ignoredOrDelayed)) {
            _efficacyStr += '【上回合未落实诏令】\n';
            GM._edictEfficacyReport.ignoredOrDelayed.slice(0, 8).forEach(function(r) {
              _efficacyStr += '  · 「' + String(r.content||'').slice(0, 60) + '」 ' + (r.status||'?') + '·' + String(r.reason||'').slice(0, 40) + '\n';
            });
          }
        }

        // NPC 阴谋（含玩家不可见的）
        var _schemesStr = '';
        if (Array.isArray(GM.activeSchemes) && GM.activeSchemes.length > 0) {
          _schemesStr = '【活跃阴谋（含玩家不可见）】\n';
          GM.activeSchemes.slice(-15).forEach(function(s) {
            _schemesStr += '  T' + (s.startTurn||'?') + ' ' + (s.schemer||'?') + '→' + (s.target||'?') + '：' + String(s.plan||'').slice(0, 60) + '（' + (s.progress||'酝酿') + '·' + (s.allies||'独行') + '）\n';
          });
        }

        // 势力暗流（上回合 sc15 输出）
        var _underStr = '';
        if (Array.isArray(GM._factionUndercurrents) && GM._factionUndercurrents.length > 0) {
          _underStr = '【势力内部暗流】\n';
          GM._factionUndercurrents.slice(0, 10).forEach(function(u) {
            _underStr += '  ' + (u.faction||'?') + '：' + (u.situation||'') + '（趋势 ' + (u.trend||'稳定') + '·下一步:' + (u.nextMove||'') + '）\n';
          });
        }

        // 上回合 sc25 输出（伏笔/趋势/NPC 情绪）
        var _sc25Str = '';
        var _p25 = _ptResultsC.sc25 || (GM._turnAiResults && GM._turnAiResults.subcall25);
        if (_p25) {
          if (_p25.trend) _sc25Str += '【sc25 趋势】' + _p25.trend + '\n';
          if (_p25.npc_mood_snapshot) _sc25Str += '【sc25 NPC 情绪】' + _p25.npc_mood_snapshot + '\n';
          if (_p25.contradiction_evolution) _sc25Str += '【sc25 矛盾演化】' + _p25.contradiction_evolution + '\n';
        }

        // 上回合 sc28 输出（世界快照）
        var _sc28Str = '';
        var _p28 = _ptResultsC.sc28 || (GM._turnAiResults && GM._turnAiResults.subcall28);
        if (_p28) {
          if (_p28.world_snapshot) _sc28Str += '【sc28 世界快照】' + _p28.world_snapshot + '\n';
          if (_p28.next_turn_seeds) _sc28Str += '【sc28 种子】' + _p28.next_turn_seeds + '\n';
        }

        // 玩家本回合决策
        var _decStr = '';
        if (Array.isArray(GM.playerDecisions)) {
          var _curDec = GM.playerDecisions.filter(function(d){return d && d.turn === _ptTurnC;});
          if (_curDec.length > 0) {
            _decStr = '【本回合玩家决策】\n' + _curDec.map(function(d){return '  ' + d.type + ': ' + (d.content||'').slice(0, 80);}).join('\n') + '\n';
          }
        }

        var tpC = '【任务·本回合记忆固化整合】你是史官+军机大臣的合体·任务是把本回合海量原始信息·浓缩成下回合主推演 AI 必须先读的"高密度记忆固化报告"。\n\n';
        tpC += _hist + '\n\n' + _chronStr + '\n\n' + _efficacyStr + '\n\n' + _schemesStr + '\n\n' + _underStr + '\n\n' + _sc25Str + '\n\n' + _sc28Str + '\n\n' + _decStr + '\n\n';
        tpC += '\n请输出严格 JSON：\n';
        tpC += '{\n';
        tpC += '  "consolidated":"800-1500 字超高密度整合摘要——把本回合的核心剧情、关键转折、玩家决策意图、NPC 主要行动、势力变化、未解张力·浓缩为可读叙事段落（含 T<turn> 锚点·便于追溯）",\n';
        tpC += '  "key_threads":[{"thread":"线索名","status":"酝酿/推进/高潮/濒解/已解","actors":"参与者","tension":1-10,"next":"预期下一步发展(40字)"}],\n';
        tpC += '  "npc_trajectories":[{"name":"NPC名","arc":"近期弧线轨迹(60字)","mood":"心境","commitment":"对玩家的承诺/抵抗(30字)"}],\n';
        tpC += '  "faction_vectors":[{"faction":"势力名","trajectory":"上升/稳定/动荡/衰落","driver":"驱动力","risk":"主要风险(40字)"}],\n';
        tpC += '  "unresolved_tensions":["未解决的张力 1(50字·必须含潜在引爆点)","张力2","张力3"],\n';
        tpC += '  "player_reputation_drift":[{"group":"群体名(党派/阶层/民间/边军/宗室等)","perception":"当前印象(40字)","direction":"上升/下降/稳定","cause":"主因(30字)"}],\n';
        tpC += '  "next_turn_focus":["下回合 AI 应重点演绎的 1·建议(50字)","建议2","建议3"]\n';
        tpC += '}\n';
        tpC += '\n要求：\n';
        tpC += '  · consolidated 必须涵盖时政记叙事核心 + 实录关键事件 + 御批回听结论 + 关键 NPC 动作 + 势力暗流·密度极高·下回合 sc1 看此一段就能进入故事流。\n';
        tpC += '  · key_threads 应识别活跃的多线叙事（5-10 条），不要重复 ChronicleTracker 已有的，要找叙事级线索。\n';
        tpC += '  · npc_trajectories 只列重要的（5-15 个），按近期变化幅度排序。\n';
        tpC += '  · faction_vectors 每个非玩家势力一条·覆盖全部势力。\n';
        tpC += '  · unresolved_tensions 找出 3-5 条最危险的悬而未决·下回合可能引爆。\n';
        tpC += '  · player_reputation_drift 列出对玩家有显著观感变化的 4-8 个群体。\n';
        tpC += '  · next_turn_focus 是建议而非命令·下回合 AI 可参考可不采纳。\n';

        // 次要 API tier 优先·没配则回退主要
        var _tCons = (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : 'primary';
        var _cCons = (typeof _getAITier === 'function') ? _getAITier(_tCons) : { key: P.ai.key, url: url, model: P.ai.model || 'gpt-4o' };
        var _uCons = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(_tCons) : url;
        _dbg('[sc_consolidate] using tier:', _cCons.tier || _tCons, 'model:', _cCons.model);

        var _consolidateBody = {model:_cCons.model, messages:[
          {role:"system",content:"You are the memory consolidation engine for Tianming. Return JSON only."},
          {role:"user",content:tpC}
        ], temperature:0.5, max_tokens:_tok(8000)};
        if (_tmDetectModelFamily(_cCons.model, _modelFamily) === 'openai') _consolidateBody.response_format = { type: 'json_object' };
        var _consCall = await _callFollowupAI(_consolidateBody, { id: 'sc_consolidate', label: '记忆固化', url: _uCons, key: _cCons.key, priority: 'low' });
        {
          var dataC = _consCall.data;
          _checkTruncated(dataC, '记忆固化');
          var cC = _consCall.raw || '';
          var _pCParse = await _parseOrRepairJsonResult(cC, dataC, '记忆固化', { url: _uCons, key: _cCons.key, body: _consolidateBody, expectedKeys: ['consolidated', 'key_threads', 'next_turn_focus'], priority: 'low' });
          if (_pCParse && _pCParse.raw) cC = _pCParse.raw;
          var pC = _pCParse ? _pCParse.parsed : null;
          if (pC && (pC.consolidated || pC.key_threads || pC.next_turn_focus)) {
            if (!Array.isArray(GM._consolidatedMemory)) GM._consolidatedMemory = [];
            // P10.4C 审核收件箱（KokoroMemo review_policy 范式）：自动 risk-tag 高风险条目
            // 用 keyword heuristic 判断"推断/猜测"vs"明确事实"
            var _riskTag = function(text) {
              if (!text || typeof text !== 'string') return 'low';
              var t = text;
              // 高风险关键词：表示推测/不确定
              var hi = ['可能', '或许', '也许', '推测', '怀疑', '疑似', '据传', '传闻', '据说', '据报', '若', '若是', '估计', '潜在', '预期', '料想'];
              for (var i = 0; i < hi.length; i++) if (t.indexOf(hi[i]) >= 0) return 'high';
              return 'low';
            };
            // P11.2C-full：高风险条目走 pending → 下回合 sc1 时验证 → approved/rejected
            // 低风险（明确事实）直接 approved
            var _statusFromRisk = function(risk) { return risk === 'high' ? 'pending' : 'approved'; };
            var _taggedThreads = (pC.key_threads || []).map(function(th) {
              var combined = (th.thread || '') + ' ' + (th.next || '');
              var r = _riskTag(combined);
              return Object.assign({}, th, { _risk: r, _status: _statusFromRisk(r), _pendingTurn: _ptTurnC });
            });
            var _taggedTensions = (pC.unresolved_tensions || []).map(function(s) {
              var r = _riskTag(s);
              return { text: s, _risk: r, _status: _statusFromRisk(r), _pendingTurn: _ptTurnC };
            });
            var _taggedFocus = (pC.next_turn_focus || []).map(function(s) {
              // next_turn_focus 默认全部 high·因为是建议而非事实·下回合 sc1 应自行判断
              return { text: s, _risk: 'high', _status: 'pending', _pendingTurn: _ptTurnC };
            });
            GM._consolidatedMemory.push({
              turn: _ptTurnC,
              ts: Date.now(),
              consolidated: pC.consolidated || '',
              key_threads: _taggedThreads,
              npc_trajectories: pC.npc_trajectories || [],
              faction_vectors: pC.faction_vectors || [],
              unresolved_tensions: _taggedTensions,
              player_reputation_drift: pC.player_reputation_drift || [],
              next_turn_focus: _taggedFocus
            });
            // 保留最近 50 条
            if (GM._consolidatedMemory.length > 50) {
              GM._consolidatedMemory = GM._consolidatedMemory.slice(-50);
            }
            if (_ptQueueC) {
              _ptQueueC.results = _ptQueueC.results || {};
              _ptQueueC.results.sc_consolidate = pC;
            }
            if (GM._turnAiResults) GM._turnAiResults.subcallConsolidate = pC;
            _dbg('[sc_consolidate] 完成·threads:', (pC.key_threads||[]).length, '·tensions:', (pC.unresolved_tensions||[]).length);
          }
        }
      } catch(eC) { _dbg('[sc_consolidate] 失败:', eC); /* 不抛·后台静默失败 */ }
      }); }); // end sc_consolidate


      // --- 记忆压缩系统：根据模型上下文窗口自适应压缩（动态探测，无写死） ---
      try {
        // 使用 getCompressionParams() 获取基于实际上下文窗口的压缩参数
        var _cp = getCompressionParams(); // 定义在 tm-utils.js
        var _memCompressThreshold = _cp.memCompressThreshold;
        var _foreCompressThreshold = _cp.foreCompressThreshold;
        var _convCompressThreshold = _cp.convCompressThreshold;
        var _memKeepRecent = _cp.memKeepRecent;
        var _foreKeepRecent = _cp.foreKeepRecent;
        var _compressSummaryLen = _cp.summaryLen;
        var _compressForeSummaryLen = _cp.foreSummaryLen;

        _dbg('[Compress] ctxK:', _cp.contextK, 'scale:', _cp.scale.toFixed(2),
             'memThresh:', _memCompressThreshold, 'foreThresh:', _foreCompressThreshold,
             'convThresh:', _convCompressThreshold);

        var _needCompress = false;
        var _compressPrompt = '你是记忆压缩AI。请将以下旧记忆压缩为高密度摘要，保留所有关键信息（人物关系变化、重大事件、势力消长、伏笔线索、因果链），丢弃重复和琐碎内容。\n\n';

        // 压缩AI记忆
        if (GM._aiMemory && GM._aiMemory.length > _memCompressThreshold) {
          _queuePostTurnSubcall('compress_ai_memory', function(){ return _runSubcall('compress_ai_memory', '压缩AI记忆', 'lite', async function() {
          await _awaitQueuedPostTurnSubcallsById(['sc25', 'sc28', 'sc_consolidate']);
          if (!GM._aiMemory || GM._aiMemory.length <= _memCompressThreshold) return;
          _needCompress = true;
          var _oldMem = GM._aiMemory.slice(0, GM._aiMemory.length - _memKeepRecent);
          var _keepMem = GM._aiMemory.slice(-_memKeepRecent);
          var _oldMemText = _oldMem.map(function(m){ return 'T'+(m.turn||'?')+': '+((typeof memoryEntryText === 'function') ? memoryEntryText(m) : (m.content||m.text||m)); }).join('\n');
          var _compP1 = _compressPrompt + '【AI记忆条目（共'+_oldMem.length+'条）】\n' + _oldMemText + '\n\n';
          _compP1 += '请返回JSON：{"compressed_memory":"将以上全部记忆压缩为一段连贯的高密度摘要('+_compressSummaryLen+'字，保留所有关键因果链和人物动态)","key_threads":"仍在发展中的关键线索(200字)"}';
          _quietLoad("压缩AI记忆",89);
          var _comp1Body = {model:P.ai.model||"gpt-4o", messages:[{role:"system",content:"You are a memory compression specialist. Return JSON only."},{role:"user",content:_compP1}], temperature:0.3, max_tokens:_tok(6000)};
          if (_modelFamily === 'openai') _comp1Body.response_format = { type: 'json_object' };
          var _compCall1 = await _callFollowupAI(_comp1Body, { id: 'compress_ai_memory', label: 'compress_ai_memory', priority: 'low', soft: true });
          if (_compCall1.ok) {
            var _compJ1 = _compCall1.data;
            _checkTruncated(_compJ1, '压缩AI记忆');
            var _compC1 = _compJ1.choices&&_compJ1.choices[0]?_compJ1.choices[0].message.content:'';
            var _compP1Parsed = await _parseOrRepairJsonResult(_compC1, _compJ1, '压缩AI记忆', { url: url, key: P.ai.key, body: _comp1Body, expectedKeys: ['compressed_memory', 'key_threads'], priority: 'low' });
            if (_compP1Parsed && _compP1Parsed.raw) _compC1 = _compP1Parsed.raw;
            var _compP1r = _compP1Parsed ? _compP1Parsed.parsed : null;
            if (_compP1r && _compP1r.compressed_memory) {
              // 用压缩摘要替换旧记忆，保留最近20条
              GM._aiMemory = [
                { turn: GM.turn, content: '【历史记忆压缩摘要·T1-T'+((_oldMem[_oldMem.length-1]||{}).turn||'?')+'】' + _compP1r.compressed_memory + (_compP1r.key_threads ? '\n【活跃线索】' + _compP1r.key_threads : ''), type: 'compressed', priority: 'critical' }
              ].concat(_keepMem);
              try {
                if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('compress', { bucket: 'aiMemory', status: 'ok', old: _oldMem.length, kept: _keepMem.length, after: GM._aiMemory.length, snapshot: (typeof buildMemoryDiagnosticSnapshot === 'function' ? buildMemoryDiagnosticSnapshot(GM) : null) });
              } catch(_) {}
              _dbg('[Memory Compress] AI记忆从', _oldMem.length+_keepMem.length, '条压缩为', GM._aiMemory.length, '条');
            }
          } else {
            try { if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('compress', { bucket: 'aiMemory', status: 'http_fail', statusCode: (_compCall1.error && (_compCall1.error.status || _compCall1.error.statusCode)) || 0, error: String(_compCall1.error && _compCall1.error.message || _compCall1.error || '') }); } catch(_) {}
          }
          }); });
        }

        // 压缩伏笔
        if (GM._foreshadows && GM._foreshadows.length > _foreCompressThreshold) {
          _queuePostTurnSubcall('compress_foreshadows', function(){ return _runSubcall('compress_foreshadows', '整理伏笔', 'lite', async function() {
          await _awaitQueuedPostTurnSubcallsById(['sc25', 'sc28', 'sc_consolidate']);
          if (!GM._foreshadows || GM._foreshadows.length <= _foreCompressThreshold) return;
          var _oldFore = GM._foreshadows.slice(0, GM._foreshadows.length - _foreKeepRecent);
          var _keepFore = GM._foreshadows.slice(-_foreKeepRecent);
          var _oldForeText = _oldFore.map(function(f){ return 'T'+(f.turn||'?')+': '+((typeof memoryEntryText === 'function') ? memoryEntryText(f) : (f.content||f.text||f)); }).join('\n');
          var _compP2 = _compressPrompt + '【伏笔条目（共'+_oldFore.length+'条）】\n' + _oldForeText + '\n\n';
          _compP2 += '请判断哪些伏笔已被回收（已实现/已失效），哪些仍然活跃。返回JSON：{"active_foreshadows":"仍然活跃的伏笔汇总('+_compressForeSummaryLen+'字)","resolved":"已回收的伏笔简述(100字)","still_pending_count":数字}';
          _quietLoad("整理伏笔",90);
          var _comp2Body = {model:P.ai.model||"gpt-4o", messages:[{role:"system",content:"You are a narrative continuity reviewer. Return JSON only."},{role:"user",content:_compP2}], temperature:0.3, max_tokens:_tok(4000)};
          if (_modelFamily === 'openai') _comp2Body.response_format = { type: 'json_object' };
          var _compCall2 = await _callFollowupAI(_comp2Body, { id: 'compress_foreshadows', label: 'compress_foreshadows', priority: 'low', soft: true });
          if (_compCall2.ok) {
            var _compJ2 = _compCall2.data;
            _checkTruncated(_compJ2, '整理伏笔');
            var _compC2 = _compJ2.choices&&_compJ2.choices[0]?_compJ2.choices[0].message.content:'';
            var _compP2Parsed = await _parseOrRepairJsonResult(_compC2, _compJ2, '整理伏笔', { url: url, key: P.ai.key, body: _comp2Body, expectedKeys: ['active_foreshadows', 'resolved', 'still_pending_count'], priority: 'low' });
            if (_compP2Parsed && _compP2Parsed.raw) _compC2 = _compP2Parsed.raw;
            var _compP2r = _compP2Parsed ? _compP2Parsed.parsed : null;
            if (_compP2r && _compP2r.active_foreshadows) {
              GM._foreshadows = [
                { turn: GM.turn, content: '【伏笔压缩摘要】' + _compP2r.active_foreshadows + (_compP2r.resolved ? '\n【已回收】' + _compP2r.resolved : ''), type: 'compressed', priority: 'high' }
              ].concat(_keepFore);
              try {
                if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('compress', { bucket: 'foreshadows', status: 'ok', old: _oldFore.length, kept: _keepFore.length, after: GM._foreshadows.length, snapshot: (typeof buildMemoryDiagnosticSnapshot === 'function' ? buildMemoryDiagnosticSnapshot(GM) : null) });
              } catch(_) {}
              _dbg('[Foreshadow Compress]', _oldFore.length, '条旧伏笔压缩为摘要');
            }
          } else {
            try { if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('compress', { bucket: 'foreshadows', status: 'http_fail', statusCode: (_compCall2.error && (_compCall2.error.status || _compCall2.error.statusCode)) || 0, error: String(_compCall2.error && _compCall2.error.message || _compCall2.error || '') }); } catch(_) {}
          }
          }); });
        }

        // 压缩对话历史
        var _maxConvForCompress = (P.conf && P.conf.convKeep) || ((P.ai.mem || 20) * 2);
        if (GM.conv && GM.conv.length > _convCompressThreshold && GM.conv.length > _maxConvForCompress * 0.7) {
          _queuePostTurnSubcall('compress_conversation', function(){ return _runSubcall('compress_conversation', '压缩对话', 'lite', async function() {
          if (!GM.conv || GM.conv.length <= _convCompressThreshold || GM.conv.length <= _maxConvForCompress * 0.7) return;
          var _halfConv = Math.floor(GM.conv.length / 2);
          var _oldConv = GM.conv.slice(0, _halfConv);
          var _keepConv = GM.conv.slice(_halfConv);
          var _oldConvText = _oldConv.map(function(c){
            var role = c.role || 'unknown';
            var content = (c.content || '').substring(0, 150);
            return '[' + role + '] ' + content;
          }).join('\n');
          var _compP3 = '以下是早期的对话历史（玩家与AI的交互记录）：\n' + _oldConvText + '\n\n';
          _compP3 += '请压缩为一段摘要，保留：玩家的关键决策、AI给出的重要建议、双方达成的共识、未解决的议题。\n';
          _compP3 += '返回JSON：{"conversation_summary":"对话历史压缩摘要(300-500字)"}';
          _quietLoad("压缩对话",91);
          var _comp3Body = {model:P.ai.model||"gpt-4o", messages:[{role:"system",content:"You are a conversation compression specialist. Return JSON only."},{role:"user",content:_compP3}], temperature:0.3, max_tokens:_tok(4000)};
          if (_modelFamily === 'openai') _comp3Body.response_format = { type: 'json_object' };
          var _compCall3 = await _callFollowupAI(_comp3Body, { id: 'compress_conversation', label: 'compress_conversation', priority: 'low', soft: true });
          if (_compCall3.ok) {
            var _compJ3 = _compCall3.data;
            _checkTruncated(_compJ3, '压缩对话');
            var _compC3 = _compJ3.choices&&_compJ3.choices[0]?_compJ3.choices[0].message.content:'';
            var _compP3Parsed = await _parseOrRepairJsonResult(_compC3, _compJ3, '压缩对话', { url: url, key: P.ai.key, body: _comp3Body, expectedKeys: ['conversation_summary'], priority: 'low' });
            if (_compP3Parsed && _compP3Parsed.raw) _compC3 = _compP3Parsed.raw;
            var _compP3r = _compP3Parsed ? _compP3Parsed.parsed : null;
            if (_compP3r && _compP3r.conversation_summary) {
              // R103·归档被压缩的老对话原文到 GM._convArchive（存档带走）
              if (!GM._convArchive) GM._convArchive = [];
              Array.prototype.push.apply(GM._convArchive, _oldConv.map(function(c){
                return { role: c.role, content: c.content, _turn: GM.turn, _compressedAt: Date.now() };
              }));
              // 用摘要消息替换旧对话，保留后半段原样
              GM.conv = [
                { role: 'system', content: '【早期对话压缩摘要】' + _compP3r.conversation_summary }
              ].concat(_keepConv);
              _dbg('[Conv Compress]', _oldConv.length, '条旧对话压缩为摘要·原文已归档');
            }
          }
          }); });
        }
      } catch(_compErr) {
        try { if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('compress', { status: 'fail', error: String(_compErr && _compErr.message || _compErr) }); } catch(_) {}
        _dbg('[Memory Compress] 失败:', _compErr);
      }

      // 存储叙事摘要供下回合使用
      if (zhengwen && zhengwen.length > 10) {
        if (!GM.chronicleAfterwords) GM.chronicleAfterwords = [];
        var sentences = zhengwen.split(/[。！？]/).filter(function(s) { return s.trim().length > 5; });
        var lastTwo = sentences.slice(-2).join('。') + '。';
        GM.chronicleAfterwords.push({ turn: GM.turn, summary: lastTwo.substring(0, 200) });
        var chrLimit = (P.conf && P.conf.chronicleKeep) || 10;
        if (GM.chronicleAfterwords.length > chrLimit) {
          // 超限时压缩最老半数为归档条目，不永久丢失
          var _keepN = Math.max(1, chrLimit - 1);
          var _old = GM.chronicleAfterwords.slice(0, GM.chronicleAfterwords.length - _keepN);
          var _keep = GM.chronicleAfterwords.slice(-_keepN);
          var _existChr = (_old[0] && _old[0]._isArchive) ? _old[0] : null;
          var _archChr;
          if (_existChr) {
            _archChr = _existChr;
            var _toM = _old.slice(1);
            _archChr.summary = ('早期叙事摘要·' + (_archChr.summary||'').replace(/^早期叙事摘要·/, '') + '｜' +
              _toM.map(function(c){return 'T'+(c.turn||0)+':'+((c.summary||'').slice(0, 40));}).join('｜')).slice(0, 800);
            _archChr.eventCount = (_archChr.eventCount||1) + _toM.length;
            _archChr.turn = _archChr.firstTurn || _old[0].turn;
            _archChr.lastTurn = Math.max(_archChr.lastTurn||0, (_toM[_toM.length-1]||{}).turn || 0);
          } else {
            _archChr = {
              _isArchive: true,
              turn: _old[0].turn,
              firstTurn: _old[0].turn,
              lastTurn: _old[_old.length-1].turn,
              eventCount: _old.length,
              summary: '早期叙事摘要·' + _old.map(function(c){return 'T'+(c.turn||0)+':'+((c.summary||'').slice(0, 40));}).join('｜').slice(0, 720)
            };
          }
          GM.chronicleAfterwords = [_archChr].concat(_keep);
        }
      }

      // 防止对话历史无限增长：使用玩家配置的对话保留数
      var maxConv = (P.conf && P.conf.convKeep) || ((P.ai.mem || 20) * 2);
      if (GM.conv.length > maxConv) {
        // R103·归档被截断的老对话原文到 GM._convArchive（存档带走）
        if (!GM._convArchive) GM._convArchive = [];
        var _dropping = GM.conv.slice(0, GM.conv.length - maxConv);
        Array.prototype.push.apply(GM._convArchive, _dropping.map(function(c){
          return { role: c.role, content: c.content, _turn: GM.turn, _truncatedAt: Date.now() };
        }));
        GM.conv = GM.conv.slice(-maxConv);
      }

      // 历史检查环节（轻度和严格史实模式）
      //   ★ 核心原则：此检查只"标注"AI 自生的时代错乱（如唐代 shizhengji 中出现"火枪"）
      //   ★ 绝对不触碰玩家诏令引发的任何字面执行（玩家诏"赏银万两"在唐代·按原文记录·不修正）
      //   ★ 只能追加"史官按"注释·不得重写 shizhengji/zhengwen 原文
      // Start queued memory/snapshot jobs after foreground memory compression is done.
      // In historical modes, history_check is still on the player's wait path, so
      // it must not be queued behind background sc25/sc28/sc_consolidate work.
      var _needsForegroundHistoryCheck = (P.conf.gameMode === 'light_hist' || P.conf.gameMode === 'strict_hist');
      if (!_needsForegroundHistoryCheck) {
        try { _flushQueuedPostTurnSubcalls(); } catch(_qptEarlyE) { _dbg('[PostTurn] early queued subcall launch failed:', _qptEarlyE); }
      }

      if(_needsForegroundHistoryCheck) {
        showLoading("历史检查",85);
        try {
          var _edictText = '';
          try {
            // 收集本回合玩家诏令原文·让历史审查者知道哪些不可动
            var _eVals = [edicts.political, edicts.military, edicts.diplomatic, edicts.economic, edicts.other].filter(Boolean);
            _edictText = _eVals.join('\n · ');
          } catch(_eE) {}

          var histCheckPrompt = "你是历史顾问 AI。剧本背景：" + (sc ? sc.dynasty : "") + "，" + (sc ? sc.emperor : "") + "皇帝时期。\n\n";
          histCheckPrompt += "【不可改的部分·玩家诏令原文】\n · " + (_edictText || '（无明确诏令）') + "\n";
          // 策名豁免名单（玩家亲自策名的人物，含跨时代）
          var _cemingExempt = '';
          try {
            if (window.TM && TM.ceming && typeof TM.ceming.buildHistCheckExemption === 'function') {
              _cemingExempt = TM.ceming.buildHistCheckExemption();
            }
          } catch(_ce) {}
          if (_cemingExempt) histCheckPrompt += _cemingExempt + '\n';
          histCheckPrompt += '【铁律一】玩家诏令字面执行是最高原则。即使诏令本身时代错乱（如唐代用白银、刑部管科举），你绝不得将其改回「历史正确版本」——那是玩家的选择·以混乱/阻力形式体现。与玩家诏令相关的叙事文字原样保留。\n';
          histCheckPrompt += '【铁律二】纯 AI 自生的时代错乱（如 AI 凭空写出 火枪/蒸汽船/拿破仑/共和国/未出生的历史人物 等超时代元素）必须修正。此为你的核心职责。\n';
          histCheckPrompt += '【铁律三】玩家通过策名系统纳入的人物（上方豁免名单·若有）一律视为合法角色·与玩家诏令字面同等保护·任何叙事提及不得改写。\n\n';
          histCheckPrompt += "【检查并修正】下方时政记/正文：\n";
          histCheckPrompt += "时政记：" + shizhengji + "\n";
          histCheckPrompt += "正文：" + zhengwen.substring(0, 500) + "\n\n";
          histCheckPrompt += "返回 JSON：\n";
          histCheckPrompt += '{\n';
          histCheckPrompt += '  "has_ai_hallucination": true/false,\n';
          histCheckPrompt += '  "ai_errors": ["AI 自虚构的错误描述·列举具体错误点"],\n';
          histCheckPrompt += '  "corrected_shizhengji": "修正后的时政记全文·仅替换 AI 自生错误的词句·玩家诏令引起的内容原样保留",\n';
          histCheckPrompt += '  "corrected_zhengwen": "修正后的正文全文·同规则",\n';
          histCheckPrompt += '  "note": "一段 30-60 字的「史官按」注释·文言体·说明 AI 幻觉已被修正"\n';
          histCheckPrompt += '}\n';
          histCheckPrompt += "★ 修正原则：只换 AI 错的词句·不删不增玩家内容·不改叙事框架。\n";
          histCheckPrompt += "★ 若全部是玩家诏令引起（即便荒唐）·返回 has_ai_hallucination:false·其他字段留空。";

          var _histBody = {
            model:P.ai.model||"gpt-4o",
            messages:[{role:"system",content:"You are a historical consultant. Check only AI hallucinations and return JSON only."},{role:"user",content:histCheckPrompt}],
            temperature:0.2,
            max_tokens:_tok(1500)
          };
          if (_modelFamily === 'openai') _histBody.response_format = { type: 'json_object' };
          var _histCall = await _callFollowupAI(_histBody, { id: 'history_check', label: '历史检查', priority: 'critical' });
          var histData = _histCall.data;
          _checkTruncated(histData, '历史检查');
          var histContent = _histCall.raw || "";

          try {
            var _histParsed = await _parseOrRepairJsonResult(histContent, histData, '历史检查', { url: url, key: P.ai.key, body: _histBody, expectedKeys: ['has_ai_hallucination', 'ai_errors', 'corrected_shizhengji', 'corrected_zhengwen'], priority: 'critical' });
            if (_histParsed && _histParsed.raw) histContent = _histParsed.raw;
            var histJson = _histParsed ? _histParsed.parsed : null;
            if(histJson && histJson.has_ai_hallucination) {
              _dbg('[历史检查] AI 幻觉:', histJson.ai_errors);
              // 替换 AI 自生的错误·玩家诏令引起的内容由 AI 保留
              if (histJson.corrected_shizhengji) shizhengji = histJson.corrected_shizhengji;
              if (histJson.corrected_zhengwen) zhengwen = histJson.corrected_zhengwen;
              // 追加史官按注释
              if (histJson.note) {
                shizhengji = (shizhengji || '') + '\n\n【史官按】' + histJson.note;
              }
              if(histJson.ai_errors && histJson.ai_errors.length > 0) {
                console.warn('[历史检查] AI 幻觉已修正:', histJson.ai_errors.join('; '));
              }
            } else {
              _dbg('[历史检查] 未发现 AI 幻觉');
            }
          } catch(histParseErr) {
            console.warn('[历史检查] 解析结果失败:', histParseErr);
          }
        } catch(histErr) {
          console.warn('[历史检查] 检查失败:', histErr);
        }
      }

      // E13: 逻辑一致性自检（轻量、不调用API）
      (function _logicSelfCheck() {
        var _lcIssues = [];
        // 检查：死人出现在行动中
        var _deadNames = (GM.chars || []).filter(function(c){ return c.alive === false; }).map(function(c){ return c.name; });
        if (p1 && p1.npc_actions && Array.isArray(p1.npc_actions)) {
          p1.npc_actions.forEach(function(a) {
            var actor = a.actor || a.name || '';
            if (_deadNames.indexOf(actor) >= 0) {
              _lcIssues.push('已故人物"' + actor + '"仍在执行行动，已移除');
            }
          });
          // 移除死人行动
          p1.npc_actions = p1.npc_actions.filter(function(a) {
            return _deadNames.indexOf(a.actor || a.name || '') < 0;
          });
        }
        // 检查：已故人物的属性变化
        if (p1 && p1.char_updates && Array.isArray(p1.char_updates)) {
          p1.char_updates = p1.char_updates.filter(function(u) {
            if (_deadNames.indexOf(u.name || '') >= 0) {
              _lcIssues.push('已故人物"' + (u.name||'') + '"的属性更新已忽略');
              return false;
            }
            return true;
          });
        }
        if (_lcIssues.length > 0) {
          _dbg('[E13 逻辑自检] 修正' + _lcIssues.length + '项：', _lcIssues);
        }
      })();

      showLoading("\u89E3\u6790",90);

      // 3.3: Sub-call管线计时汇总
      if (GM._subcallTimings && Object.keys(GM._subcallTimings).length > 0) {
        var _timingParts = [];
        Object.keys(GM._subcallTimings).forEach(function(k) {
          var _meta = _subcallMeta.filter(function(m){return m.id===k;})[0];
          _timingParts.push((_meta ? _meta.name : k) + ':' + (GM._subcallTimings[k]/1000).toFixed(1) + 's');
        });
        _dbg('[3.3 Pipeline] ' + _timingParts.join(' | '));
      }

      // Start queued next-turn memory/snapshot jobs only after foreground cleanup
      // has finished, so compression cannot overwrite their late writes.
      try { _flushQueuedPostTurnSubcalls(); } catch(_qptE) { _dbg('[PostTurn] queued subcall launch failed:', _qptE); }

      // S2：启动 post-turn 异步任务（L2_AI/L3_CONDENSE/REFLECT/factionArcs）
      //   不 await·让玩家看结果时后台运行·下回合开始前 _awaitPostTurnJobs 会等齐
      try { if (typeof _launchPostTurnJobs === 'function') _launchPostTurnJobs(); } catch(_ptE) { _dbg('[PostTurn] launch failed:', _ptE); }    ctx.results.sc1 = p1 || ctx.results.sc1 || null;
    copyResultsFromTurnState(ctx, p2);
    ctx.followup.p1Summary = p1Summary || "";
    ctx.followup.npcDeep = { sc15: ctx.results.sc15, sc_memwrite: ctx.results.sc_memwrite };
    ctx.followup.fiscalMil = { sc16: ctx.results.sc16, sc17: ctx.results.sc17, sc18: ctx.results.sc18, sc_audit: ctx.results.sc_audit };
    ctx.followup.narrative = { sc2: ctx.results.sc2, sc25: ctx.results.sc25, sc27: ctx.results.sc27, sc07: ctx.results.sc07, sc28: ctx.results.sc28, sc_consolidate: ctx.results.sc_consolidate };
    ctx.record.shizhengji = shizhengji || "";
    ctx.record.zhengwen = zhengwen || "";
    ctx.record.playerStatus = playerStatus || "";
    ctx.record.playerInner = playerInner || "";
    ctx.record.turnSummary = turnSummary || "";
    ctx.record.shiluText = shiluText || "";
    ctx.record.szjTitle = szjTitle || "";
    ctx.record.szjSummary = szjSummary || "";
    ctx.record.personnelChanges = Array.isArray(personnelChanges) ? personnelChanges : [];
    ctx.record.hourenXishuo = hourenXishuo || "";
    ctx.record.suggestions = (ctx.results.sc2 && Array.isArray(ctx.results.sc2.suggestions)) ? ctx.results.sc2.suggestions : (Array.isArray(ctx.record.suggestions) ? ctx.record.suggestions : []);
    ctx.meta.timing.followup = Date.now() - _followupStart;
    return ctx;
  };

})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));
