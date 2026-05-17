// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-faction-npc-llm-decision.js — LLM 接管 NPC 决策 (Phase G·2026-05-10)
 *
 * 替代 F4 enrich (cosmetic 润色) — LLM 真做决策·代码 apply 副作用。
 *
 * 流程:
 *   1. buildPrompt(fac, state)·拼上下文 (派生数据 + chars + 派系 + 近事)
 *   2. callLLM·返回 structured JSON (NpcTurnDecision)
 *   3. validateDecision·schema 检查·失败丢弃 → fallback 模板
 *   4. applyDecision(fac, decision)·按 schema 应用副作用·写 trajectory
 *
 * Decision schema (LLM 输出):
 * {
 *   "rationale": "ruler 此回合考量 (50-150 字·解释为什么这么决策)",
 *   "memorials": [
 *     { "from": "char.name", "type": "军务/政务/民生/经济/人事/密奏",
 *       "content": "奏疏内容 (60-120 字·古文)",
 *       "rulerDecision": "approved/rejected/annotated/referred",
 *       "ruling": "朱批 (10-30 字)",
 *       "loyaltyDelta": -5..+5 }
 *   ],
 *   "edict": {
 *     "type": "催征/补饷/安抚/赏赐/巡抚/经略/...",
 *     "content": "诏令 (60-120 字·古文)",
 *     "trigger": "财政危/军权弱/...",
 *     "treasuryDelta": -500000..+500000,
 *     "loyaltyDeltas": { "court": -10..+10, "general": ..., "clan": ... }
 *   },
 *   "chaoyi": {
 *     "type": "cooperate/attack/compromise/infight/null",
 *     "summary": "朝议简述 (20-50 字)",
 *     "partyImbalanceDelta": -0.2..+0.2,
 *     "loyaltyDeltaByParty": { "partyA": -5..+5, ... }
 *   },
 *   "office": [
 *     { "kind": "promote/demote", "target": "char.name", "newPosition": "...",
 *       "loyaltyDelta": -10..+10, "reason": "..." }
 *   ]
 * }
 *
 * 与 F4 区别·F4 是 cosmetic·G 是 mechanic。
 * G 启用时·F4 自动失效 (G 决策已含 content)。
 */
(function(global) {
  'use strict';

  function _safeNum(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function _isEnabled() {
    if (!global.TM || !global.TM.FactionNpcSettings) return false;
    return global.TM.FactionNpcSettings.isAiPrecisionEnabled();
  }

  function _actionEngine() {
    return (global.TM && global.TM.FactionActionEngine) || null;
  }

  function _classifyChar(c) {
    if (global.TM && global.TM.FactionNpcMemorial && global.TM.FactionNpcMemorial._classifyChar) {
      return global.TM.FactionNpcMemorial._classifyChar(c);
    }
    return 'other';
  }

  function _txt(v, max) {
    if (v == null) return '';
    var s = '';
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') s = String(v);
    else if (typeof v === 'object') s = String(v.content || v.text || v.summary || v.event || v.desc || v.description || v.name || JSON.stringify(v));
    s = s.replace(/\s+/g, ' ').trim();
    if (max && s.length > max) return s.slice(0, max) + '...';
    return s;
  }

  function _arr(v) { return Array.isArray(v) ? v : []; }
  function _tail(a, n) { a = _arr(a); return a.slice(Math.max(0, a.length - n)); }
  function _head(a, n) { a = _arr(a); return a.slice(0, n); }

  function _normFactionName(v) {
    return String(v == null ? '' : v).replace(/\s+/g, '').trim();
  }

  function _isMarkedPlayerFaction(f) {
    return !!(f && (f.isPlayer || f.playerControlled || f.controlledBy === 'player' || f.controller === 'player' || f.controlType === 'player'));
  }

  function _resolvePlayerFactionNames() {
    var G = global.GM || {};
    var P0 = global.P || {};
    var names = [];
    function push(v) {
      var s = String(v == null ? '' : v).trim();
      var k = _normFactionName(s);
      if (s && names.map(_normFactionName).indexOf(k) < 0) names.push(s);
    }
    var pi = P0.playerInfo || {};
    push(pi.factionName);
    push(P0.playerFactionName);
    push(P0.playerFaction);
    push(G.playerFactionName);
    push(G.playerFaction);
    if (G.playerInfo) push(G.playerInfo.factionName);
    _arr(G.facs).forEach(function(f){ if (_isMarkedPlayerFaction(f)) push(f.name); });
    _arr(G.chars).forEach(function(c){
      if (c && (c.isPlayer || c.playerControlled || c.controlledBy === 'player')) push(c.faction || c.factionName || c.ownerFaction);
    });
    return names;
  }

  function _isPlayerFactionName(name, playerFactionNames) {
    var k = _normFactionName(name);
    if (!k) return false;
    return _arr(playerFactionNames).some(function(n){ return _normFactionName(n) === k; });
  }

  function _isPlayerFaction(f, playerFactionNames) {
    return !!(f && (_isMarkedPlayerFaction(f) || _isPlayerFactionName(f.name, playerFactionNames)));
  }

  function _pushSection(lines, title, bodyLines) {
    bodyLines = _arr(bodyLines).filter(function(x){ return !!x; });
    if (bodyLines.length > 0) {
      lines.push('\n[' + title + ']');
      bodyLines.forEach(function(x){ lines.push(x); });
    }
  }

  function _fmtTurn(o) {
    return 'T' + ((o && o.turn != null) ? o.turn : ((global.GM && global.GM.turn) || '?'));
  }

  function _currentTurn() {
    return _safeNum(global.GM && global.GM.turn) || 1;
  }

  function _ledgerEnabled(opts) {
    return !!(opts && (opts.source === 'eager' || opts.source === 'in-turn' || opts.source === 'manual'));
  }

  function _ensureFactionAiTurnLedger(turn) {
    if (!global.GM) return null;
    turn = _safeNum(turn) || _currentTurn();
    if (!global.GM._npcFactionAiTurnLedger || global.GM._npcFactionAiTurnLedger.turn !== turn) {
      global.GM._npcFactionAiTurnLedger = {
        turn: turn,
        createdAt: turn,
        sc16: global.GM._sc16FactionDirectives || null,
        dispatch: global.GM._npcFactionLlmDispatchLedger || null,
        runs: {},
        actions: [],
        candidateRanks: [],
        notes: [],
        stats: {}
      };
    }
    if (!global.GM._npcFactionAiTurnLedger.stats) global.GM._npcFactionAiTurnLedger.stats = {};
    if (!Array.isArray(global.GM._npcFactionAiTurnLedger.actions)) global.GM._npcFactionAiTurnLedger.actions = [];
    if (!Array.isArray(global.GM._npcFactionAiTurnLedger.candidateRanks)) global.GM._npcFactionAiTurnLedger.candidateRanks = [];
    if (!Array.isArray(global.GM._npcFactionAiTurnLedger.notes)) global.GM._npcFactionAiTurnLedger.notes = [];
    return global.GM._npcFactionAiTurnLedger;
  }

  function _ensureLedger(turn) {
    if (!global.GM) return null;
    turn = _safeNum(turn) || _currentTurn();
    if (!global.GM._npcFactionLlmLedger || global.GM._npcFactionLlmLedger.turn !== turn) {
      global.GM._npcFactionLlmLedger = { turn: turn, runs: {}, order: [] };
    }
    if (!global.GM._npcFactionLlmLedger.runs) global.GM._npcFactionLlmLedger.runs = {};
    if (!Array.isArray(global.GM._npcFactionLlmLedger.order)) global.GM._npcFactionLlmLedger.order = [];
    var turnLedger = _ensureFactionAiTurnLedger(turn);
    if (turnLedger) turnLedger.runs = global.GM._npcFactionLlmLedger.runs;
    return global.GM._npcFactionLlmLedger;
  }

  function _readLedger(turn) {
    if (!global.GM || !global.GM._npcFactionLlmLedger) return null;
    turn = _safeNum(turn) || _currentTurn();
    return global.GM._npcFactionLlmLedger.turn === turn ? global.GM._npcFactionLlmLedger : null;
  }

  function hasRunThisTurn(facName, turn) {
    var ledger = _readLedger(turn);
    if (!ledger || !ledger.runs || !ledger.runs[facName]) return false;
    var row = ledger.runs[facName];
    return row.status === 'pending' || row.status === 'applied' || row.status === 'failed' || row.status === 'skipped';
  }

  function countRunsThisTurn(turn) {
    var ledger = _readLedger(turn);
    if (!ledger || !ledger.runs) return 0;
    return Object.keys(ledger.runs).filter(function(name){
      var row = ledger.runs[name];
      return row && (row.status === 'pending' || row.status === 'applied' || row.status === 'failed' || row.status === 'skipped');
    }).length;
  }

  function _beginLedgerRun(facName, opts) {
    if (!_ledgerEnabled(opts)) return { ok: true, token: null };
    var runTurn = _safeNum(opts.turn) || _currentTurn();
    var nowTurn = _currentTurn();
    if (runTurn !== nowTurn) {
      return { ok: false, reason: 'stale turn', turn: runTurn, currentTurn: nowTurn };
    }
    if (hasRunThisTurn(facName, runTurn)) {
      return { ok: false, reason: 'already run this turn', turn: runTurn };
    }
    var ledger = _ensureLedger(runTurn);
    var token = {
      id: facName + ':' + runTurn + ':' + (opts.source || 'auto') + ':' + Date.now(),
      fac: facName,
      turn: runTurn,
      source: opts.source || 'auto'
    };
    ledger.runs[facName] = {
      fac: facName,
      turn: runTurn,
      source: token.source,
      status: 'pending',
      startedAt: Date.now(),
      token: token.id
    };
    ledger.order.push(facName);
    return { ok: true, token: token };
  }

  function _isLedgerTokenStale(token) {
    return !!(token && token.turn !== _currentTurn());
  }

  function _finishLedgerRun(token, status, reason, diagnostics) {
    if (!token) return;
    var ledger = _readLedger(token.turn);
    if (!ledger || !ledger.runs || !ledger.runs[token.fac]) return;
    var row = ledger.runs[token.fac];
    if (row.token !== token.id) return;
    row.status = status || row.status || 'skipped';
    row.finishedAt = Date.now();
    if (reason) row.reason = reason;
    if (diagnostics && typeof diagnostics === 'object') {
      if (row.status === 'failed') {
        row.failure = {
          kind: diagnostics.kind || 'unknown',
          error: diagnostics.error || diagnostics.reason || reason || '',
          rawPreview: diagnostics.rawPreview || '',
          attempts: diagnostics.attempts || 0,
          maxTokens: diagnostics.maxTokens || 0
        };
      }
      row.diagnostics = diagnostics;
    }
    var turnLedger = _ensureFactionAiTurnLedger(token.turn);
    if (turnLedger) turnLedger.runs = ledger.runs;
  }

  function _formatRecentWorld(facName) {
    var lines = [];
    var G = global.GM || {};
    _tail(G.shijiHistory, 4).forEach(function(s){
      var parts = [];
      if (s.szjTitle) parts.push(_txt(s.szjTitle, 40));
      if (s.turnSummary) parts.push(_txt(s.turnSummary, 100));
      if (s.shizhengji) parts.push('政:' + _txt(s.shizhengji, 180));
      if (s.zhengwen) parts.push('文:' + _txt(s.zhengwen, 160));
      if (parts.length) lines.push('  ' + _fmtTurn(s) + ' ' + parts.join(' / '));
    });
    _head(G.qijuHistory, 8).forEach(function(q){
      var txt = _txt(q.content || q.text || q.zhengwen || q.xinglu || q, 160);
      if (!txt) return;
      var related = !facName || txt.indexOf(facName) >= 0 || lines.length < 4;
      if (related) lines.push('  ' + _fmtTurn(q) + ' 近事:' + txt);
    });
    var ai = G._turnAiResults || G._lastAiResult || G._lastAIResult || null;
    if (ai) {
      var aiTxt = _txt(ai.turnSummary || ai.shizhengji || ai.zhengwen || ai, 240);
      if (aiTxt) lines.push('  当前主推演残影:' + aiTxt);
    }
    var endturnCtx = G._lastEndturnAiContext || null;
    if (endturnCtx && endturnCtx.aiResult) {
      var ar = endturnCtx.aiResult;
      var arTxt = _txt(ar.turnSummary || ar.shizhengji || ar.zhengwen || ar.shiluText || ar, 260);
      if (arTxt) lines.push('  本回合主AI推演:' + arTxt);
    }
    return lines;
  }

  function _formatPlayerRecent() {
    var lines = [];
    var G = global.GM || {};
    var latest = _tail(G.shijiHistory, 1)[0] || {};
    var endturnCtx = G._lastEndturnAiContext || null;
    if (endturnCtx) {
      if (Array.isArray(endturnCtx.edicts)) {
        endturnCtx.edicts.slice(0, 8).forEach(function(e, i){ lines.push('  本回合诏' + (i + 1) + ': ' + _txt(e, 180)); });
      } else if (endturnCtx.edicts) {
        lines.push('  本回合诏: ' + _txt(endturnCtx.edicts, 240));
      }
      if (endturnCtx.xinglu) lines.push('  本回合行录: ' + _txt(endturnCtx.xinglu, 180));
    }
    var edicts = latest.edicts || latest.edict || latest.playerEdicts || null;
    if (Array.isArray(edicts)) {
      edicts.slice(0, 6).forEach(function(e, i){ lines.push('  诏' + (i + 1) + ': ' + _txt(e, 160)); });
    } else if (edicts) {
      lines.push('  诏: ' + _txt(edicts, 220));
    }
    if (latest.xinglu) lines.push('  行止: ' + _txt(latest.xinglu, 180));
    _tail(G.edicts, 5).forEach(function(e){
      var txt = _txt(e.text || e.content || e, 160);
      if (txt) lines.push('  御批记录: ' + txt);
    });
    _head(G.qijuHistory, 8).forEach(function(q){
      if (q && q.xinglu) lines.push('  近行: ' + _txt(q.xinglu, 140));
    });
    return lines;
  }

  function _formatFactionTrajectory(fac) {
    var lines = [];
    _tail(fac.npcMemorials, 4).forEach(function(m){
      lines.push('  奏疏 ' + _fmtTurn(m) + ' [' + (m.type || '?') + '/' + (m.status || '?') + '] ' + (m.from || '') + ': ' + _txt(m.content, 140));
    });
    _tail(fac.npcEdicts, 4).forEach(function(e){
      lines.push('  诏令 ' + _fmtTurn(e) + ' [' + (e.type || '?') + '/' + (e.trigger || '?') + '] ' + _txt(e.content, 140));
    });
    _tail(fac.npcChaoyi, 4).forEach(function(c){
      lines.push('  朝议 ' + _fmtTurn(c) + ' [' + (c.type || '?') + '] ' + _txt(c.summary, 120));
    });
    _tail(fac.npcOfficeActions, 4).forEach(function(o){
      lines.push('  官事 ' + _fmtTurn(o) + ' ' + (o.action || o.kind || '?') + ' ' + (o.target || '') + ' ' + _txt(o.reason, 100));
    });
    _tail(fac.npcFiscalLedger, 4).forEach(function(l){
      lines.push('  财计 ' + _fmtTurn(l) + (l.crisis ? ' 危机' : '') + ' 压力' + (l.stress != null ? l.stress : (l.fiscalStress != null ? l.fiscalStress : '?')) + ' ' + _txt(l.summary || l.note, 100));
    });
    _tail(fac.npcMilitaryActions, 4).forEach(function(a){
      lines.push('  军务 ' + _fmtTurn(a) + ' ' + _txt(a.army || a.target || a.action, 80) + ' ' + _txt(a.reason, 100) + ' ' + _txt(a.effect, 140));
    });
    _tail(fac.npcDiplomacyActions, 4).forEach(function(a){
      lines.push('  外交 ' + _fmtTurn(a) + ' ->' + _txt(a.to || a.target || '', 60) + ' ' + _txt(a.reason, 100) + ' ' + _txt(a.effect, 140));
    });
    _tail(fac.npcProvincePolicies, 4).forEach(function(a){
      lines.push('  地政 ' + _fmtTurn(a) + ' ' + _txt(a.province || a.target || a.action, 80) + ' ' + _txt(a.reason, 100) + ' ' + _txt(a.effect, 140));
    });
    _tail(fac.npcFiscalActions, 4).forEach(function(a){
      lines.push('  财策 ' + _fmtTurn(a) + ' ' + _txt(a.resource || a.action, 60) + ' ' + _txt(a.amount, 40) + ' ' + _txt(a.reason, 100) + ' ' + _txt(a.effect, 140));
    });
    _tail(fac.npcIntrigueActions, 4).forEach(function(a){
      lines.push('  间谍 ' + _fmtTurn(a) + ' ->' + _txt(a.targetFaction || a.target || '', 60) + ' ' + _txt(a.intrigue || a.policy || a.action, 80) + ' ' + _txt(a.reason, 100));
    });
    _tail(fac.npcRebellionPolicies, 4).forEach(function(a){
      lines.push('  叛乱 ' + _fmtTurn(a) + ' ->' + _txt(a.targetFaction || a.target || '', 60) + ' ' + _txt(a.policy || a.action, 80) + ' ' + _txt(a.reason, 100));
    });
    if (fac._lastLlmRationale && fac._lastLlmRationale.text) {
      lines.push('  上次君主考量: ' + _txt(fac._lastLlmRationale.text, 180));
    }
    return lines;
  }

  function _mentionsFac(obj, facName) {
    if (!facName) return false;
    return _txt(obj, 900).indexOf(facName) >= 0;
  }

  function _formatSc16DirectiveForFac(fac) {
    var lines = [];
    var G = global.GM || {};
    var sc16 = G._turnAiResults && G._turnAiResults.subcall16;
    if (!fac || !fac.name) return lines;

    var ledger = G._sc16FactionDirectives || null;
    var directive = (ledger && ledger.byFaction && ledger.byFaction[fac.name]) || fac._sc16Directive || null;
    if (directive) {
      lines.push('  sc16-ledger turn=' + (directive.turn || (ledger && ledger.turn) || '?') + ' source=' + (directive.source || 'sc16') + (directive.hasDirectContent ? ' direct=1' : ' direct=0'));
      if (directive.powerBalanceShift) lines.push('  sc16 world balance: ' + _txt(directive.powerBalanceShift, 180));
      if (directive.territorialChanges) lines.push('  sc16 territory: ' + _txt(directive.territorialChanges, 160));
      _arr(directive.directives).slice(0, 4).forEach(function(d) {
        lines.push('  sc16 directive: ' + _txt(d.strategic_intent || d.intent || d.goal || d.must_follow || d.reason || d, 180)
          + (d.must_follow ? ' | must:' + _txt(d.must_follow, 120) : '')
          + (Array.isArray(d.preferred_actions) ? ' | preferred:' + d.preferred_actions.slice(0, 4).map(function(x){ return _txt(x, 50); }).join('/') : '')
          + (d.red_lines ? ' | red_lines:' + _txt(d.red_lines, 100) : ''));
      });
      _arr(directive.actions).slice(0, 6).forEach(function(a) {
        var who = a.faction || a.actor || a.from || fac.name;
        var target = a.target || a.targetFaction || a.to || '';
        lines.push('  sc16 action: ' + who + (target ? '->' + target : '') + ' ' + _txt(a.action || a.move || a.intent, 160)
          + (a.motive ? ' | motive:' + _txt(a.motive, 90) : '')
          + (a.impact ? ' | impact:' + _txt(a.impact, 90) : ''));
      });
      _arr(directive.diplomacy).slice(0, 6).forEach(function(d) {
        lines.push('  sc16 diplomacy: ' + (d.from || '?') + '->' + (d.to || '?') + ' '
          + _txt(d.old_relation || '', 40) + '=>' + _txt(d.new_relation || d.type || '', 60)
          + (d.reason ? ' | reason:' + _txt(d.reason, 100) : ''));
      });
      if (lines.length > 1) {
        lines.push('  operational rule: turn sc16 directives into concrete actions[] where possible; if impossible, explain the contradiction in rationale instead of silently ignoring it.');
      }
      return lines;
    }

    if (!sc16 || !fac || !fac.name) return lines;

    if (sc16.power_balance_shift) lines.push('  sc16 world balance: ' + _txt(sc16.power_balance_shift, 180));
    if (sc16.territorial_changes) lines.push('  sc16 territory: ' + _txt(sc16.territorial_changes, 160));

    _arr(sc16.faction_actions).filter(function(a) {
      return a && (
        a.faction === fac.name || a.actor === fac.name || a.from === fac.name ||
        a.target === fac.name || a.targetFaction === fac.name || _mentionsFac(a, fac.name)
      );
    }).slice(0, 6).forEach(function(a) {
      var who = a.faction || a.actor || a.from || fac.name;
      var target = a.target || a.targetFaction || a.to || '';
      lines.push('  sc16 action: ' + who + (target ? '->' + target : '') + ' ' + _txt(a.action || a.move || a.intent, 160)
        + (a.motive ? ' | motive:' + _txt(a.motive, 90) : '')
        + (a.impact ? ' | impact:' + _txt(a.impact, 90) : ''));
    });

    _arr(sc16.diplomatic_shifts).filter(function(d) {
      return d && (d.from === fac.name || d.to === fac.name || _mentionsFac(d, fac.name));
    }).slice(0, 6).forEach(function(d) {
      lines.push('  sc16 diplomacy: ' + (d.from || '?') + '->' + (d.to || '?') + ' '
        + _txt(d.old_relation || '', 40) + '=>' + _txt(d.new_relation || d.type || '', 60)
        + (d.reason ? ' | reason:' + _txt(d.reason, 100) : ''));
    });

    if (lines.length > 0) {
      lines.push('  sc16 continuity rule: sc16 is the current-turn world-level directive; faction precision may refine, explain, or add local details, but should not reverse it without a clear sudden cause in rationale.');
    }
    return lines;
  }

  function _formatFactionProfile(fac) {
    if (!fac) return [];
    var lines = [];
    var profile = fac.aiProfile || {};
    if (fac.goal) lines.push('  goal: ' + _txt(fac.goal, 140));
    if (fac.strategy) lines.push('  strategy: ' + _txt(fac.strategy, 240));
    if (fac.longTermStrategy) lines.push('  longTerm: ' + _txt(fac.longTermStrategy, 220));
    if (fac.personality) lines.push('  factionPersonality: ' + _txt(fac.personality, 140));
    if (profile.posture) lines.push('  posture: ' + _txt(profile.posture, 180));
    if (profile.decisionStyle) lines.push('  decisionStyle: ' + _txt(profile.decisionStyle, 200));
    if (profile.riskTolerance) lines.push('  riskTolerance: ' + _txt(profile.riskTolerance, 120));
    if (profile.playerVisibleTheme) lines.push('  visibleTheme: ' + _txt(profile.playerVisibleTheme, 160));
    if (Array.isArray(fac.strategicPriorities) && fac.strategicPriorities.length) {
      lines.push('  priorities: ' + fac.strategicPriorities.slice(0, 6).map(function(x){ return _txt(x, 70); }).join(' / '));
    }
    if (Array.isArray(fac.decisionHints) && fac.decisionHints.length) {
      lines.push('  decisionHints: ' + fac.decisionHints.slice(0, 6).map(function(x){ return _txt(x, 90); }).join(' / '));
    }
    if (Array.isArray(fac.openingProblems) && fac.openingProblems.length) {
      lines.push('  openingProblems: ' + fac.openingProblems.slice(0, 5).map(function(x){ return _txt(x, 90); }).join(' / '));
    }
    if (Array.isArray(fac.tabooMoves) && fac.tabooMoves.length) {
      lines.push('  tabooMoves: ' + fac.tabooMoves.slice(0, 4).map(function(x){ return _txt(x, 80); }).join(' / '));
    }
    if (Array.isArray(fac.strengths) && fac.strengths.length) lines.push('  strengths: ' + fac.strengths.slice(0, 6).join(' / '));
    if (Array.isArray(fac.weaknesses) && fac.weaknesses.length) lines.push('  weaknesses: ' + fac.weaknesses.slice(0, 6).join(' / '));
    if (fac.warState) lines.push('  warState: ' + _txt(fac.warState, 220));
    if (fac.economicPolicy) lines.push('  economicPolicy: ' + _txt(fac.economicPolicy, 180));
    if (fac.leaderInfo) lines.push('  leaderInfo: ' + _txt(fac.leaderInfo, 180));
    return lines;
  }

  function _formatPrecisionNewsForFac(fac, limit) {
    var G = global.GM || {};
    var lines = [];
    _arr(G.qijuHistory).filter(function(q) {
      if (!q) return false;
      var src = q._source || '';
      var isPrecision = src === 'npc-in-turn-llm' || src === 'npc-bridge' || src === 'faction-npc-llm';
      if (!isPrecision) return false;
      if (q._facName && q._facName !== fac.name) return false;
      return q._facName === fac.name || _mentionsFac(q, fac.name);
    }).slice(0, limit || 6).forEach(function(q) {
      lines.push('    qiju ' + _fmtTurn(q) + ' source=' + (q._source || '?') + ' ' + _txt(q.content || q.text || q.zhengwen || q, 180));
    });
    return lines;
  }

  function buildRecentTrajectoryContextForSc16(opts) {
    opts = opts || {};
    var G = global.GM || {};
    var playerFacNames = _resolvePlayerFactionNames();
    var maxFactions = Math.max(1, opts.maxFactions || 12);
    var maxChars = Math.max(1000, opts.maxChars || 6000);
    var rows = _arr(G.facs).filter(function(f){ return f && f.name && !_isPlayerFaction(f, playerFacNames); }).map(function(f) {
      var traj = _formatFactionTrajectory(f);
      var news = _formatPrecisionNewsForFac(f, 5);
      var strength = (f.derivedStrength && f.derivedStrength.value) || f.strength || 0;
      return { fac: f, traj: traj, news: news, score: traj.length * 10 + news.length * 12 + strength / 20 };
    }).filter(function(r){ return r.traj.length > 0 || r.news.length > 0; }).sort(function(a, b){ return b.score - a.score; }).slice(0, maxFactions);

    if (rows.length === 0) return '';
    var lines = [];
    lines.push('\n[FACTION_PRECISION_HISTORY]');
    lines.push('  These are previous faction precision simulations: endturn batch records, post-endturn news bridge entries, and in-turn precision news. sc16 should treat them as established faction trajectories unless a new global reason forces a turn.');
    rows.forEach(function(r) {
      lines.push('  faction: ' + r.fac.name);
      r.traj.slice(-8).forEach(function(x){ lines.push('  ' + x); });
      r.news.forEach(function(x){ lines.push('  ' + x); });
    });
    var out = lines.join('\n');
    if (out.length > maxChars) out = out.slice(0, maxChars) + '\n  ...[FACTION_PRECISION_HISTORY_TRUNCATED]';
    return out;
  }

  function _adminHierarchySources() {
    var G = global.GM || {};
    var P0 = global.P || {};
    var out = [];
    if (G.adminHierarchy && typeof G.adminHierarchy === 'object') out.push({ name: 'GM.adminHierarchy', data: G.adminHierarchy });
    if (P0.adminHierarchy && typeof P0.adminHierarchy === 'object') out.push({ name: 'P.adminHierarchy', data: P0.adminHierarchy });
    return out;
  }

  function _facKeys(fac) {
    return [fac && fac.name, fac && fac.id, fac && fac.factionId, fac && fac.key].filter(function(x){ return x != null && String(x).trim(); }).map(function(x){ return String(x); });
  }

  function _matchesAny(v, keys) {
    if (v == null) return false;
    return keys.indexOf(String(v)) >= 0;
  }

  function _divisionOwnerValue(d) {
    if (!d || typeof d !== 'object') return null;
    var fields = ['currentFaction', 'currentOwner', 'controllerFaction', 'controller', 'ownerFactionName', 'ownerFaction', 'dejureOwner', 'factionName', 'factionId', 'faction', 'owner', 'heldBy'];
    for (var i = 0; i < fields.length; i++) {
      if (d[fields[i]] != null && d[fields[i]] !== '') return d[fields[i]];
    }
    return null;
  }

  function _walkDivisions(divs, cb) {
    _arr(divs).forEach(function(d) {
      if (!d || typeof d !== 'object') return;
      cb(d);
      if (Array.isArray(d.children) && d.children.length) _walkDivisions(d.children, cb);
    });
  }

  function _collectOwnedDivisions(ah, fac) {
    var keys = _facKeys(fac);
    var owned = [];
    if (!ah || !keys.length) return owned;
    Object.keys(ah).forEach(function(k) {
      var tree = ah[k] || {};
      _walkDivisions(tree.divisions, function(d) {
        var ov = _divisionOwnerValue(d);
        if (_matchesAny(ov, keys)) owned.push(d);
      });
    });
    return owned;
  }

  function _mergeDivisions(a, b) {
    var out = [];
    var seen = {};
    function keyOf(d) { return String((d && (d.id || d.name)) || Math.random()); }
    _arr(a).concat(_arr(b)).forEach(function(d) {
      if (!d) return;
      var k = keyOf(d);
      if (seen[k]) return;
      seen[k] = true;
      out.push(d);
    });
    return out;
  }

  function _treeMatchesFac(tree, key, fac) {
    var keys = _facKeys(fac);
    return _matchesAny(key, keys)
      || _matchesAny(tree && tree.factionName, keys)
      || _matchesAny(tree && tree.factionId, keys)
      || _matchesAny(tree && tree.name, keys);
  }

  function _findAdminTreeForFac(fac) {
    var sources = _adminHierarchySources();
    for (var si = 0; si < sources.length; si++) {
      var src = sources[si];
      var ah = src.data;
      var owned = _collectOwnedDivisions(ah, fac);
      var keys = Object.keys(ah || {});
      var matched = null;
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var tree = ah[k] || {};
        if (!_treeMatchesFac(tree, k, fac)) continue;
        var facKeys = _facKeys(fac);
        var divs = _arr(tree.divisions).filter(function(d) {
          var ov = _divisionOwnerValue(d);
          return ov == null || _matchesAny(ov, facKeys);
        });
        matched = { source: src.name, key: k, tree: Object.assign({}, tree, { divisions: divs }) };
        break;
      }
      if (owned.length > 0) {
        var merged = matched ? _mergeDivisions(matched.tree.divisions, owned) : owned;
        return { source: src.name, key: matched ? matched.key + '+owned-runtime' : 'owned-runtime', tree: Object.assign({}, matched ? matched.tree : { factionName: fac && fac.name }, { divisions: merged }) };
      }
      if (matched) return matched;
    }
    return null;
  }

  function _fmtAmount(n) {
    n = Number(n || 0);
    if (!isFinite(n) || n === 0) return '0';
    if (Math.abs(n) >= 100000000) return Math.round(n / 10000000) / 10 + '亿';
    if (Math.abs(n) >= 10000) return Math.round(n / 1000) / 10 + '万';
    return String(Math.round(n));
  }

  function _pickNum() {
    for (var i = 0; i < arguments.length; i++) {
      var n = Number(arguments[i]);
      if (isFinite(n) && n !== 0) return n;
    }
    return 0;
  }

  function _stock(obj, key) {
    if (!obj) return 0;
    if (typeof obj[key] === 'number') return obj[key];
    if (obj[key] && typeof obj[key].stock === 'number') return obj[key].stock;
    return 0;
  }

  function _truthyKeys(obj, max) {
    if (!obj || typeof obj !== 'object') return [];
    return Object.keys(obj).filter(function(k){ return !!obj[k]; }).slice(0, max || 6);
  }

  function _formatAdminDivisionLine(d, idx) {
    var pop = d.populationDetail || {};
    var popMouths = _pickNum(pop.mouths, d.population && d.population.mouths, typeof d.population === 'number' ? d.population : 0, d.mouths);
    var households = _pickNum(pop.households, d.households);
    var fugitives = _pickNum(pop.fugitives, d.fugitives);
    var fiscal = d.fiscalDetail || d.fiscal || {};
    var treasury = d.publicTreasury || d.publicTreasuryInit || {};
    var parts = [];
    parts.push((idx != null ? (idx + 1) + '. ' : '') + _txt(d.name || d.id || '未命名区划', 48));
    if (d.level || d.regionType) parts.push('level=' + _txt([d.level, d.regionType].filter(Boolean).join('/'), 28));
    if (d.officialPosition || d.governor) parts.push('office=' + _txt([d.officialPosition, d.governor].filter(Boolean).join('/'), 42));
    if (d.terrain) parts.push('terrain=' + _txt(d.terrain, 30));
    if (d.specialResources) parts.push('res=' + _txt(d.specialResources, 54));
    if (popMouths || households || fugitives) {
      parts.push('pop=口' + _fmtAmount(popMouths) + (households ? '/户' + _fmtAmount(households) : '') + (fugitives ? '/流亡' + _fmtAmount(fugitives) : ''));
    }
    var money = _pickNum(_stock(treasury, 'money'), treasury.money);
    var grain = _pickNum(_stock(treasury, 'grain'), treasury.grain);
    var cloth = _pickNum(_stock(treasury, 'cloth'), treasury.cloth);
    if (money || grain || cloth) parts.push('treasury=银' + _fmtAmount(money) + '/粮' + _fmtAmount(grain) + '/布' + _fmtAmount(cloth));
    if (fiscal.actualRevenue || fiscal.remittedToCenter || fiscal.retainedBudget || fiscal.claimedRevenue) {
      parts.push('fiscal=应' + _fmtAmount(fiscal.claimedRevenue) + '/实' + _fmtAmount(fiscal.actualRevenue) + '/上解' + _fmtAmount(fiscal.remittedToCenter) + '/留' + _fmtAmount(fiscal.retainedBudget));
    }
    if (d.minxinLocal != null || d.minxin != null) parts.push('minxin=' + (d.minxinLocal != null ? d.minxinLocal : d.minxin));
    if (d.corruptionLocal != null || d.corruption != null) parts.push('corruption=' + (d.corruptionLocal != null ? d.corruptionLocal : d.corruption));
    var tags = _truthyKeys(d.tags, 5);
    if (tags.length) parts.push('tags=' + tags.join('/'));
    if (Array.isArray(d.tradeRoutes) && d.tradeRoutes.length) parts.push('routes=' + d.tradeRoutes.slice(0, 3).map(function(x){ return _txt(x, 22); }).join('/'));
    if (Array.isArray(d.threats) && d.threats.length) parts.push('threats=' + d.threats.slice(0, 3).map(function(x){ return _txt(x, 24); }).join('/'));
    if (d.description) parts.push('desc=' + _txt(d.description, 92));
    return '  ' + parts.join(' | ');
  }

  function _formatOwnAdminHierarchy(fac, opts) {
    opts = opts || {};
    var found = _findAdminTreeForFac(fac);
    if (!found || !found.tree || !_arr(found.tree.divisions).length) return [];
    var maxDivisions = Math.max(1, opts.maxDivisions || 8);
    var divs = _arr(found.tree.divisions).slice(0, maxDivisions);
    var lines = [];
    lines.push('  Current own province-level territory ledger, source=' + found.source + '/' + found.key + '. Must treat it as current map state; if later turns changed territory, this runtime ledger overrides opening scenario land.');
    lines.push('  faction=' + (fac && fac.name || found.tree.factionName || '?') + ' provinceCount=' + _arr(found.tree.divisions).length);
    divs.forEach(function(d, i){ lines.push(_formatAdminDivisionLine(d, i)); });
    if (_arr(found.tree.divisions).length > divs.length) lines.push('  ... ' + (_arr(found.tree.divisions).length - divs.length) + ' more divisions omitted');
    return lines;
  }

  function buildFactionAdminSummaryForSc16(opts) {
    opts = opts || {};
    var G = global.GM || {};
    var playerFacNames = _resolvePlayerFactionNames();
    var maxFactions = Math.max(1, opts.maxFactions || 16);
    var maxChars = Math.max(1000, opts.maxChars || 8000);
    var rows = _arr(G.facs).filter(function(f){ return f && f.name && !_isPlayerFaction(f, playerFacNames); }).slice(0, maxFactions);
    var lines = [];
    lines.push('\n[FACTION_ADMIN_HIERARCHY]');
    lines.push('  Current runtime province-level territory ledger for non-player factions. Use this as the map board when reasoning about expansion, defense, logistics, tax base, and diplomacy. If territory changed this turn, trust GM.adminHierarchy over scenario opening data.');
    rows.forEach(function(f) {
      var own = _formatOwnAdminHierarchy(f, { maxDivisions: opts.maxDivisions || 4 });
      if (!own.length) return;
      lines.push('  faction: ' + f.name);
      own.slice(1).forEach(function(x){ lines.push('  ' + x); });
    });
    if (lines.length <= 2) return '';
    var out = lines.join('\n');
    if (out.length > maxChars) out = out.slice(0, maxChars) + '\n  ...[FACTION_ADMIN_HIERARCHY_TRUNCATED]';
    return out;
  }

  function _formatRelationsAndWars(fac) {
    var lines = [];
    var G = global.GM || {};
    _arr(G.factionRelations).filter(function(r){
      return r && (r.from === fac.name || r.to === fac.name);
    }).slice(0, 10).forEach(function(r){
      lines.push('  关系 ' + r.from + '→' + r.to + ' ' + (r.type || '') + '(' + (r.value != null ? r.value : 0) + ') ' + _txt(r.desc, 120));
    });
    _arr(G.activeWars).filter(function(w){
      var t = _txt(w, 300);
      var sides = _arr(w.sides).join('|');
      return t.indexOf(fac.name) >= 0 || sides.indexOf(fac.name) >= 0;
    }).slice(0, 5).forEach(function(w){
      lines.push('  战事 ' + _txt(w.name || w.title || '未名战事', 60) + ' ' + _txt(w.status || w.phase || w, 160));
    });
    _arr(G.treaties).filter(function(t){ return _txt(t, 260).indexOf(fac.name) >= 0; }).slice(0, 4).forEach(function(t){
      lines.push('  条约 ' + _txt(t, 180));
    });
    _arr(G.battleHistory).slice(-4).forEach(function(b){
      var txt = _txt(b, 200);
      if (txt.indexOf(fac.name) >= 0) lines.push('  近战 ' + txt);
    });
    return lines;
  }

  function _formatMilitaryContext(fac) {
    var G = global.GM || {};
    var names = [fac.name, fac.id, fac.factionId].filter(function(x){ return !!x; });
    var lines = [];
    _arr(G.armies).filter(function(a){
      var owner = a.faction || a.ownerFaction || a.owner || a.factionName || a.side || '';
      return names.indexOf(owner) >= 0 || _txt(a, 260).indexOf(fac.name) >= 0;
    }).slice(0, 8).forEach(function(a){
      lines.push('  军 ' + _txt(a.name || a.id || '无名军', 50)
        + ' 兵' + (a.soldiers || a.troops || a.count || a.size || '?')
        + ((a.location || a.garrison) ? ' 地:' + (a.location || a.garrison) : '')
        + (a.morale != null ? ' 气:' + a.morale : ''));
    });
    if (fac.militaryBreakdown) lines.push('  军制: ' + _txt(fac.militaryBreakdown, 220));
    if (fac.militaryStrength) lines.push('  标称军力: ' + _txt(fac.militaryStrength, 80));
    return lines;
  }

  function _charDecisionScore(c) {
    var role = _classifyChar(c);
    var score = 0;
    if (role === 'ruler') score += 100;
    else if (role === 'general') score += 82;
    else if (role === 'court') score += 72;
    else if (role === 'clan') score += 62;
    var loyalty = c && c.loyalty != null ? _safeNum(c.loyalty) : 50;
    if (loyalty <= 35) score += 28;
    if (loyalty >= 75) score += 14;
    if (c && (c.position || c.title || c.officialTitle || c.office)) score += 8;
    if (c && c.party) score += 6;
    if (c && (c.isImportant || c.keyFigure || c.featured)) score += 20;
    return score;
  }

  function _selectActionCandidateChars(fac, alive, limit) {
    var G = global.GM || {};
    var list = _arr(alive).slice();
    if (!list.length && fac && fac.name) {
      list = _arr(G.chars).filter(function(c){
        return c && c.alive !== false && (c.faction === fac.name || c.factionName === fac.name || c.ownerFaction === fac.name);
      });
    }
    var seen = {};
    return list.filter(function(c){
      var name = c && (c.name || c.id);
      if (!name || seen[name]) return false;
      seen[name] = true;
      return true;
    }).sort(function(a, b){
      return _charDecisionScore(b) - _charDecisionScore(a);
    }).slice(0, limit || 18);
  }

  function _formatActionCandidates(fac, alive) {
    var G = global.GM || {};
    var lines = [];
    var chars = _selectActionCandidateChars(fac, alive, 18);
    if (chars.length) {
      lines.push('  valid char targets: ' + chars.map(function(c) {
        return c.name + '(' + _classifyChar(c)
          + (c.party ? '/' + c.party : '')
          + (c.position || c.officialTitle || c.title ? '/' + _txt(c.position || c.officialTitle || c.title, 24) : '')
          + '/loyalty=' + (c.loyalty != null ? c.loyalty : '?') + ')';
      }).join('; '));
    }
    var facNames = [fac && fac.name, fac && fac.id, fac && fac.factionId].filter(function(x){ return !!x; });
    var armies = _arr(G.armies).filter(function(a) {
      var owner = a && (a.faction || a.ownerFaction || a.owner || a.factionName || a.side || '');
      return facNames.indexOf(owner) >= 0 || _txt(a, 260).indexOf(fac.name) >= 0;
    }).slice(0, 12);
    if (armies.length) {
      lines.push('  valid army targets: ' + armies.map(function(a){
        return _txt(a.name || a.id || 'unnamed', 40)
          + '(soldiers=' + (a.soldiers || a.troops || a.count || a.size || '?')
          + (a.commander ? ',cmd=' + _txt(a.commander, 24) : '')
          + (a.location || a.garrison ? ',loc=' + _txt(a.location || a.garrison, 30) : '') + ')';
      }).join('; '));
    }
    var provinces = [];
    try {
      if (typeof global.getFactionProvinces === 'function') provinces = global.getFactionProvinces(fac.name) || [];
    } catch(_){}
    if (!provinces.length) {
      provinces = _arr(fac && (fac.territories || fac.provinceIds || fac.provinces || fac.territory));
      if (typeof (fac && fac.territory) === 'string') provinces = [fac.territory];
    }
    if (provinces.length) lines.push('  valid province targets: ' + provinces.slice(0, 18).map(function(p){ return _txt(p, 40); }).join('; '));
    var relTargets = [];
    _arr(G.factionRelations).forEach(function(r) {
      if (!r) return;
      if (r.from === fac.name && r.to) relTargets.push(r.to + '(' + (r.type || '?') + '/' + (r.value != null ? r.value : 0) + ')');
      if (r.to === fac.name && r.from) relTargets.push(r.from + '(' + (r.type || '?') + '/' + (r.value != null ? r.value : 0) + ')');
    });
    _arr(G.facs).forEach(function(f) {
      if (!f || !f.name || f.name === fac.name) return;
      if (_isPlayerFaction(f, _resolvePlayerFactionNames())) return;
      if (relTargets.join('|').indexOf(f.name + '(') < 0) relTargets.push(f.name + '(power=' + ((f.derivedStrength && f.derivedStrength.value) || f.strength || '?') + ')');
    });
    if (relTargets.length) lines.push('  valid faction targets: ' + relTargets.slice(0, 14).join('; '));
    lines.push('  target discipline: use these exact names for char/army/province/faction fields; if sc16 asks for an action outside these candidates, choose the closest valid target and explain in rationale.');
    return lines;
  }

  function _formatCharacterMemory(alive) {
    var lines = [];
    alive.slice(0, 12).forEach(function(c){
      var parts = [];
      if (Array.isArray(c._memory) && c._memory.length) {
        parts.push('记:' + c._memory.slice(-2).map(function(m){ return _txt(m.event || m, 70); }).join('；'));
      }
      if (Array.isArray(c._scars) && c._scars.length) {
        parts.push('伤:' + c._scars.slice(-1).map(function(s){ return _txt(s.event || s, 70); }).join('；'));
      }
      if (c._impressions) {
        var imps = [];
        Object.keys(c._impressions).slice(0, 4).forEach(function(k){
          var imp = c._impressions[k] || {};
          var favor = (typeof imp === 'number') ? imp : imp.favor;
          if (favor != null && Math.abs(favor) >= 10) imps.push(k + ':' + favor);
        });
        if (imps.length) parts.push('人情:' + imps.join('/'));
      }
      if (parts.length) lines.push('  ' + c.name + '(' + _classifyChar(c) + '): ' + parts.join(' | '));
    });
    return lines;
  }

  function _formatWorldStatus(fac) {
    var lines = [];
    var G = global.GM || {};
    var provinces = (typeof global.getFactionProvinces === 'function') ? global.getFactionProvinces(fac.name) : [];
    if (provinces && provinces.length) lines.push('  治地: ' + provinces.slice(0, 12).join('、'));
    _arr(G.currentIssues).slice(0, 6).forEach(function(i){ lines.push('  时局问题: ' + _txt(i.title || i.name || i, 120)); });
    _arr(G.factionEvents).slice(-5).forEach(function(e){
      var txt = _txt(e, 160);
      if (!fac.name || txt.indexOf(fac.name) >= 0) lines.push('  势力事件: ' + txt);
    });
    if (G.eraState) lines.push('  天下态势: ' + _txt(G.eraState.contextDescription || G.eraState, 220));
    return lines;
  }

  function _formatLocalTemplatePreplan(fac) {
    var turn = _currentTurn();
    var rows = _arr(fac && fac._npcLlmActionLedger).filter(function(r) {
      if (!r) return false;
      var source = String(r.source || '').toLowerCase();
      var engine = String(r.engine || '').toLowerCase();
      return turn - _safeNum(r.turn) <= 1
        && (source === 'local' || source === 'local-template' || engine.indexOf('local-template') >= 0);
    }).slice(-10);
    if (!rows.length) return [];
    var lines = [];
    lines.push('  Local template actions are already applied this turn; avoid duplicates unless you upgrade them with a new consequence.');
    rows.forEach(function(r) {
      var detail = r.detail || {};
      var parts = [];
      if (detail.reason) parts.push('reason=' + _txt(detail.reason, 80));
      if (detail.resource) parts.push('resource=' + _txt(detail.resource, 30));
      if (detail.delta != null) parts.push('delta=' + detail.delta);
      if (detail.target || detail.targetFaction) parts.push('target=' + _txt(detail.target || detail.targetFaction, 50));
      if (detail.province) parts.push('province=' + _txt(detail.province, 50));
      lines.push('  T' + (r.turn || turn) + ' ' + (r.type || '?') + ' status=' + (r.status || '?') + ' ' + parts.join(' | '));
    });
    return lines;
  }

  // ──────────────────────────────────────────────────────────
  // Build prompt — 拼 fac state·让 LLM 全面理解再决策
  // ──────────────────────────────────────────────────────────
  function _buildPrompt(fac) {
    var paradigm = (global.TM && global.TM.FactionParadigm) ? global.TM.FactionParadigm.detect(fac.name, fac) : 'generic';
    var era = (global.P && (global.P.scenarioName || (global.P.playerInfo && global.P.playerInfo.era))) || '';
    var turn = (global.GM && global.GM.turn) || 1;
    var entry = (global.GM && global.GM._facIndex && global.GM._facIndex[fac.name]) || null;
    var alive = (entry && entry.chars) ? entry.chars.filter(function(c){ return c.alive !== false; }) : [];
    var ruler = alive.find(function(c){ return _classifyChar(c) === 'ruler'; }) || alive[0] || { name: '?' };
    var candidateChars = _selectActionCandidateChars(fac, alive, 12);

    var dh = fac.derivedHealth || {};
    var de = fac.derivedEconomy || {};
    var dc = fac.derivedCohesion || {};
    var ds = fac.derivedStrength || {};

    var sys = '你是历史推演大师。模拟 NPC 势力一回合内政决策。';
    sys += '\n背景: ' + era + '·第 ' + turn + ' 回合';
    sys += '\n势力: ' + fac.name + ' (paradigm·' + paradigm + ')·主君·' + ruler.name + (ruler.position ? ' (' + ruler.position + ')' : '');
    if (ruler.personality) sys += '\n主君人格: ' + ruler.personality;
    if (ruler.behaviorMode) sys += '·行为·' + ruler.behaviorMode;
    if (ruler.aiPersonaText) sys += '\n主君简介: ' + String(ruler.aiPersonaText).slice(0, 200);

    sys += '\n\n势力派生状态:';
    sys += '\n  实力 ' + (ds.value || 50) + '/' + (ds.label || '?');
    sys += ' 健康 ' + (dh.overall || 50) + '/' + ((dh.labels && dh.labels.overall) || '?');
    sys += ' 凝聚 ' + (dc.overall || 50) + '/' + ((dc.labels && dc.labels.overall) || '?');
    sys += ' 财政压 ' + (de.fiscalStress || 0);
    sys += '\n  4 健康分项: 朝堂 ' + (dh.courtCohesion || 50) + ' 军权 ' + (dh.militaryControl || 50) + ' 人事 ' + (dh.personnelHealth || 50) + ' 兵权 ' + (dh.militaryStability || 50);
    if (de.netFlow != null) sys += '\n  财政: 年税 ' + (de.annualTaxIncome || 0) + ' 军费 ' + (de.annualMilitaryCost || 0) + ' 净 ' + de.netFlow;

    var parties = (entry && entry.parties) ? Object.keys(entry.parties) : [];
    if (parties.length > 0) sys += '\n  派系: ' + parties.join('·') + ' (主导·' + ((entry.metrics && entry.metrics.partyDominantName) || '?') + ' 失衡·' + ((entry.metrics && entry.metrics.partyImbalance) || 0) + ')';

    sys += '\n  治下 chars (action target candidates): ' + candidateChars.map(function(c){
      return c.name + '(' + _classifyChar(c) + (c.party ? '·' + c.party : '') + '·忠' + (c.loyalty || 50) + ')';
    }).join('·');

    var recentEdict = (Array.isArray(fac.npcEdicts) && fac.npcEdicts.length > 0) ? fac.npcEdicts[fac.npcEdicts.length - 1] : null;
    if (recentEdict) sys += '\n  上回合诏: [' + recentEdict.type + '/' + recentEdict.trigger + ']';

    var user = '请输出本回合该势力的内政决策·strict JSON·无 markdown·无注释。schema:\n';
    var extra = [];
    _pushSection(extra, 'RECENT_WORLD', _formatRecentWorld(fac.name));
    _pushSection(extra, 'PLAYER_RECENT', _formatPlayerRecent());
    _pushSection(extra, 'SCENARIO_FACTION_PROFILE', _formatFactionProfile(fac));
    _pushSection(extra, 'OWN_ADMIN_HIERARCHY', _formatOwnAdminHierarchy(fac));
    _pushSection(extra, 'SC16_WORLD_DIRECTIVE', _formatSc16DirectiveForFac(fac));
    _pushSection(extra, 'ACTION_CANDIDATES', _formatActionCandidates(fac, alive));
    _pushSection(extra, 'LOCAL_TEMPLATE_PREPLAN', _formatLocalTemplatePreplan(fac));
    try {
      if (global.TM && TM.FactionActionEngine && typeof TM.FactionActionEngine.formatActionContractForPrompt === 'function') {
        _pushSection(extra, 'ACTION_CONTRACT', String(TM.FactionActionEngine.formatActionContractForPrompt({ maxChars: 1800 })).split('\n'));
      }
    } catch(_){}
    _pushSection(extra, 'FACTION_TRAJECTORY', _formatFactionTrajectory(fac));
    _pushSection(extra, 'RELATIONS_AND_WARS', _formatRelationsAndWars(fac));
    _pushSection(extra, 'MILITARY_CONTEXT', _formatMilitaryContext(fac));
    _pushSection(extra, 'CHAR_MEMORY', _formatCharacterMemory(alive));
    _pushSection(extra, 'WORLD_STATUS', _formatWorldStatus(fac));
    if (extra.length > 0) {
      sys += '\n\nAI_DECISION_CONTEXT:';
      sys += extra.join('\n');
      sys += '\n以上情报均为势力本回合决策依据：优先尊重近事、史记、玩家诏令、势力旧账、战事关系与人物记忆；不要只按当前数值面板机械出招。';
    }

    user += '{\n';
    user += '  "rationale": "主君考量·50-150 字",\n';
    user += '  "memorials": [{"from":"char.name","type":"军务|政务|民生|经济|人事|密奏","content":"奏疏 60-120 字","rulerDecision":"approved|rejected|annotated|referred","ruling":"朱批 10-30 字","loyaltyDelta":-5至5}, ...0-3 条],\n';
    user += '  "edict": {"type":"催征|减俸|补饷|整军|安抚|罢党争|怀柔|赏赐|巡抚|经略","content":"诏令 60-120 字","trigger":"财政危|军权弱|朝堂裂|稳定·示恩|...","treasuryDelta":-500000至500000,"loyaltyDeltas":{"court":-10至10,"general":0,"clan":0}},\n';
    user += '  "chaoyi": {"type":"cooperate|attack|compromise|infight|null (单派则 null)","summary":"20-50 字","partyImbalanceDelta":-0.2至0.2,"loyaltyDeltaByParty":{"partyA":-5至5}},\n';
    user += '  "office": [{"kind":"promote|demote","target":"char.name","newPosition":"按 paradigm 头衔","loyaltyDelta":-10至10,"reason":"..."}, ...0-1 条],\n';
    user += '  "actions": [{"type":"office_change|fiscal_policy|military_order|diplomacy|province_policy|spy_or_intrigue|rebellion_policy","target":"char.name","newPosition":"官职","resource":"money|grain|cloth","treasuryDelta":0,"incomeDelta":0,"expenseDelta":0,"army":"army.name","commander":"char.name","soldiersDelta":0,"moraleDelta":0,"trainingDelta":0,"targetFaction":"faction.name","relationDelta":-20,"treaty":"条约名","province":"province.name","ownerFaction":"faction.name","minxinDelta":0,"corruptionDelta":0,"unrestDelta":0,"taxDelta":0,"intrigue":"spread_rumor|bribe|sabotage","policy":"incite|pacify|sponsor","support":1,"reason":"20-60 chars"}, ...0-8]\n';
    user += '}\n';
    user += 'actions 可选但优先用于真实外部动作: office_change 字段 {target,newPosition,kind:"promote|demote|appoint",loyaltyDelta,reason}; fiscal_policy 字段 {resource:"money|grain|cloth",treasuryDelta,incomeDelta,expenseDelta,reason}; military_order 字段 {army, order:"change_commander|move|reinforce|train", commander, destination, soldiersDelta, moraleDelta, trainingDelta}; diplomacy 字段 {targetFaction, relationDelta:-100至100, relationType, treaty, durationTurns, reason}; province_policy 字段 {province, policy:"transfer_owner|pacify|extract|reform", ownerFaction, minxinDelta, corruptionDelta, unrestDelta, taxDelta, reason}; spy_or_intrigue 字段 {targetFaction,intrigue:"spread_rumor|bribe|sabotage",relationDelta,pressure,reason}; rebellion_policy 字段 {targetFaction,policy:"incite|sponsor|pacify",support,reason}。';
    user += '\n约束: type/decision/kind 必须是给定 enum·content 必须中文古文风·目标 char 必须在治下 chars 列表中·军队/地块/势力名必须来自上下文·所有数值必须在区间内。';
    user += '\nTARGET RULE: char/army/province/faction names must come from ACTION_CANDIDATES or the visible context above. Prefer concrete actions[] that operationalize SC16_WORLD_DIRECTIVE; do not invent invisible characters or armies.';

    return { system: sys, user: user };
  }

  function _extractJsonText(raw) {
    raw = String(raw || '').replace(/```json/gi, '```').replace(/```/g, '').trim();
    var jsonStart = raw.indexOf('{');
    var jsonEnd = raw.lastIndexOf('}');
    if (jsonStart < 0 || jsonEnd <= jsonStart) return '';
    return raw.slice(jsonStart, jsonEnd + 1)
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'");
  }

  function _parseDecisionJson(raw) {
    var jsonStr = _extractJsonText(raw);
    if (!jsonStr) return null;
    return JSON.parse(jsonStr);
  }

  function _withTimeout(promise, ms) {
    if (!ms || typeof global.setTimeout !== 'function' || typeof global.clearTimeout !== 'function') return promise;
    return new Promise(function(resolve, reject) {
      var done = false;
      var timer = global.setTimeout(function(){
        if (done) return;
        done = true;
        reject(new Error('LLM timeout'));
      }, ms);
      promise.then(function(v){
        if (done) return;
        done = true;
        global.clearTimeout(timer);
        resolve(v);
      }, function(e){
        if (done) return;
        done = true;
        global.clearTimeout(timer);
        reject(e);
      });
    });
  }

  function _precisionMaxTokens(opts) {
    opts = opts || {};
    var conf = (global.P && P.conf) || {};
    var raw = opts.maxTokens != null ? opts.maxTokens : conf.npcAiPrecisionMaxTokens;
    var n = _safeNum(raw);
    if (!n) n = 3000;
    return Math.max(1200, Math.min(12000, Math.floor(n)));
  }

  async function _callLLMDecision(prompts, opts) {
    opts = opts || {};
    if (typeof global.callAI !== 'function') {
      return { parsed:null, diagnostics:{ kind:'missing_callAI', error:'callAI is not available', rawPreview:'', attempts:0, maxTokens:0 } };
    }
    var attempts = Math.max(1, _safeNum(opts.maxAttempts) || ((global.P && P.conf && P.conf.npcAiPrecisionRetryAttempts) || 2));
    var timeoutMs = _safeNum(opts.timeoutMs || (global.P && P.conf && P.conf.npcAiPrecisionTimeoutMs)) || 0;
    var maxTokens = _precisionMaxTokens(opts);
    var combined = prompts.system + '\n\n' + prompts.user;
    var lastError = '';
    var lastRawPreview = '';
    var failureKind = 'parse';
    for (var i = 0; i < attempts; i++) {
      try {
        var promptText = combined;
        if (i > 0) promptText += '\n\nFORMAT_ERROR_RETRY: 上次输出无法解析为 strict JSON。请只返回一个 JSON object，不要 markdown，不要解释。错误: ' + lastError;
        var raw = await _withTimeout(global.callAI(promptText, maxTokens, null, 'secondary'), timeoutMs);
        lastRawPreview = String(raw || '').slice(0, 600);
        if (!raw) { lastError = 'empty response'; failureKind = 'empty'; continue; }
        var parsed = _parseDecisionJson(raw);
        if (parsed) return { parsed:parsed, diagnostics:{ kind:'ok', attempts:i + 1, maxTokens:maxTokens } };
        lastError = 'no JSON object in response';
        failureKind = 'parse';
      } catch (e) {
        lastError = (e && e.message) || String(e || 'parse failed');
        failureKind = /timeout/i.test(lastError) ? 'timeout' : 'call_or_parse';
        try { console.warn('[npc-llm-decision] parse/call failed attempt ' + (i + 1), lastError); } catch(_){}
      }
    }
    return { parsed:null, diagnostics:{ kind:failureKind, error:lastError, rawPreview:lastRawPreview, attempts:attempts, maxTokens:maxTokens } };
  }

  var VALID_MEM_TYPES = ['军务','政务','民生','经济','人事','密奏'];
  var VALID_DECISIONS = ['approved','rejected','annotated','referred'];
  var VALID_EDICT_TYPES = ['催征','减俸','补饷','整军','安抚','罢党争','怀柔','赏赐','巡抚','经略'];
  var VALID_CHAOYI_TYPES = ['cooperate','attack','compromise','infight'];
  var VALID_OFFICE_KINDS = ['promote','demote'];
  var CANONICAL_ACTION_TYPES = ['memorial','edict','court_alignment','office_change','fiscal_policy','military_order','diplomacy','province_policy','rebellion_policy','spy_or_intrigue'];

  function _validateDecision(d) {
    var engine = _actionEngine();
    if (engine && typeof engine.validateDecision === 'function') {
      return engine.validateDecision(d);
    }
    if (!d || typeof d !== 'object') return null;
    if (typeof d.rationale !== 'string') d.rationale = '';
    if (!Array.isArray(d.memorials)) d.memorials = [];
    d.memorials = d.memorials.filter(function(m){
      return m && typeof m === 'object'
        && typeof m.from === 'string'
        && VALID_MEM_TYPES.indexOf(m.type) >= 0
        && VALID_DECISIONS.indexOf(m.rulerDecision) >= 0
        && typeof m.content === 'string';
    }).slice(0, 3);  // max 3
    if (d.edict && typeof d.edict === 'object'
        && VALID_EDICT_TYPES.indexOf(d.edict.type) >= 0
        && typeof d.edict.content === 'string') {
      // OK
    } else {
      d.edict = null;
    }
    if (d.chaoyi && typeof d.chaoyi === 'object') {
      if (VALID_CHAOYI_TYPES.indexOf(d.chaoyi.type) < 0) d.chaoyi = null;
    } else {
      d.chaoyi = null;
    }
    if (!Array.isArray(d.office)) d.office = [];
    d.office = d.office.filter(function(o){
      return o && VALID_OFFICE_KINDS.indexOf(o.kind) >= 0
        && typeof o.target === 'string';
    }).slice(0, 2);
    if (!Array.isArray(d.actions)) d.actions = [];
    d.actions = d.actions.filter(function(a) {
      return a && typeof a === 'object' && CANONICAL_ACTION_TYPES.indexOf(a.type || a.actionType) >= 0;
    }).slice(0, 6);
    return d;
  }

  function _slugId(v) {
    return String(v == null ? '' : v).replace(/[^\w\u4e00-\u9fa5-]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
  }

  function _makeDecisionId(fac, turn) {
    return 'npc_llm_' + (turn || _currentTurn()) + '_' + _slugId(fac && fac.name);
  }

  function _makeAction(decisionId, turn, fac, type, idx, payload, source) {
    return {
      decisionId: decisionId,
      actionId: decisionId + '_' + type + '_' + idx,
      type: type,
      turn: turn,
      faction: fac && fac.name || '',
      source: source || 'legacy',
      payload: payload || {}
    };
  }

  function _nativeActionPayload(a) {
    var payload = {};
    if (a && a.payload && typeof a.payload === 'object') {
      Object.keys(a.payload).forEach(function(k){ payload[k] = a.payload[k]; });
    }
    Object.keys(a || {}).forEach(function(k) {
      if (k === 'type' || k === 'actionType' || k === 'decisionId' || k === 'actionId' || k === 'payload' || k === 'source') return;
      payload[k] = a[k];
    });
    return payload;
  }

  function _normalizeDecisionActions(fac, decision, opts) {
    var engine = _actionEngine();
    if (engine && typeof engine.normalizeDecisionActions === 'function') {
      return engine.normalizeDecisionActions(fac, decision, opts);
    }
    opts = opts || {};
    var turn = _safeNum(opts.turn) || ((global.GM && global.GM.turn) || 1);
    var d = _validateDecision(decision);
    if (!d) return [];
    var decisionId = opts.decisionId || d.decisionId || _makeDecisionId(fac, turn);
    var actions = [];
    d.memorials.forEach(function(m, idx) {
      actions.push(_makeAction(decisionId, turn, fac, 'memorial', idx, m, 'legacy'));
    });
    if (d.edict) {
      actions.push(_makeAction(decisionId, turn, fac, 'edict', 0, d.edict, 'legacy'));
    }
    if (d.chaoyi) {
      actions.push(_makeAction(decisionId, turn, fac, 'court_alignment', 0, d.chaoyi, 'legacy'));
    }
    d.office.forEach(function(o, idx) {
      actions.push(_makeAction(decisionId, turn, fac, 'office_change', idx, o, 'legacy'));
    });
    d.actions.forEach(function(a, idx) {
      var type = a.type || a.actionType;
      actions.push(_makeAction(decisionId, turn, fac, type, idx, _nativeActionPayload(a), 'native'));
    });
    return actions.filter(function(a){ return CANONICAL_ACTION_TYPES.indexOf(a.type) >= 0; });
  }

  function _bucketActions(actions) {
    var buckets = {};
    _arr(actions).forEach(function(a) {
      if (!a || !a.type) return;
      if (!buckets[a.type]) buckets[a.type] = [];
      buckets[a.type].push(a);
    });
    return buckets;
  }

  function _trimLedger(fac) {
    if (fac && Array.isArray(fac._npcLlmActionLedger) && fac._npcLlmActionLedger.length > 80) {
      fac._npcLlmActionLedger = fac._npcLlmActionLedger.slice(-80);
    }
  }

  function _pushFacTrajectory(fac, key, rec) {
    if (!fac || !key || !rec) return;
    if (!Array.isArray(fac[key])) fac[key] = [];
    fac[key].push(rec);
    if (fac[key].length > 30) fac[key] = fac[key].slice(-30);
  }

  function _findArmy(name) {
    var G = global.GM || {};
    var key = String(name || '').trim();
    if (!key || !Array.isArray(G.armies)) return null;
    return G.armies.find(function(a) {
      if (!a) return false;
      return [a.name, a.armyName, a.id, a.unitName, a.title].some(function(v){ return String(v || '').trim() === key; });
    }) || null;
  }

  function _armyCommander(army) {
    if (!army) return '';
    return String(army.commander || army.commanderName || army.general || army.leader || '').trim();
  }

  function _syncArmyCommanderAliases(army, commander) {
    if (!army) return false;
    commander = String(commander || '').trim();
    var changed = false;
    ['commander','commanderName','commanderDisplayName','commander_name','general','generalName','leader','leaderName','chiefCommander','chiefGeneral','mainGeneral'].forEach(function(k) {
      if (army[k] !== commander) {
        army[k] = commander;
        changed = true;
      }
    });
    return changed;
  }

  function _applyMilitaryOrder(fac, action, turn) {
    var p = action.payload || {};
    var armyName = p.army || p.armyName || p.name || p.unitName || p.unit || '';
    var commander = p.commander || p.commanderName || p.general || p.leader || p.newCommander || p.newGeneral || '';
    var reason = p.reason || p.rationale || '';
    var army = _findArmy(armyName);
    if (!army) return { ok: false, reason: 'army not found', army: armyName };
    var oldCommander = _armyCommander(army);
    var usedGlobal = false;
    if (typeof global.applyAIArmyChange === 'function') {
      try {
        var res = global.applyAIArmyChange({
          name: armyName,
          commander: commander,
          destination: p.destination,
          location: p.location,
          garrison: p.garrison,
          reason: reason
        }, { source: 'faction-npc-llm-action' });
        usedGlobal = !!(res && res.ok);
      } catch(_){}
    }
    if (!usedGlobal && commander) _syncArmyCommanderAliases(army, commander);
    if (!usedGlobal) {
      if (p.destination) army.destination = p.destination;
      if (p.location || p.garrison) {
        army.location = p.location || p.garrison;
        army.garrison = p.garrison || p.location;
      }
    }
    var rec = {
      id: action.actionId,
      turn: turn,
      action: p.order || p.kind || 'military_order',
      army: army.name || armyName,
      commanderFrom: oldCommander,
      commanderTo: commander || _armyCommander(army),
      reason: reason,
      _generatedByLlm: true,
      _decisionId: action.decisionId,
      _actionId: action.actionId,
      _actionType: action.type
    };
    _pushFacTrajectory(fac, 'npcMilitaryActions', rec);
    return { ok: true, detail: { army: rec.army, commanderFrom: oldCommander, commanderTo: rec.commanderTo } };
  }

  function _findRelationRecord(from, to) {
    var G = global.GM || {};
    var list = Array.isArray(G.factionRelations) ? G.factionRelations : [];
    return list.find(function(r){ return r && r.from === from && r.to === to; }) || null;
  }

  function _upsertRelationRecord(from, to, patch) {
    var G = global.GM || {};
    if (!Array.isArray(G.factionRelations)) G.factionRelations = [];
    var rec = _findRelationRecord(from, to);
    if (!rec) {
      rec = { from: from, to: to, type: 'neutral', value: 0, desc: '' };
      G.factionRelations.push(rec);
    }
    if (patch.type != null) rec.type = patch.type;
    if (patch.value != null) rec.value = _clamp(_safeNum(patch.value), -100, 100);
    if (patch.desc != null) rec.desc = patch.desc;
    return rec;
  }

  function _applyDiplomacy(fac, action, turn) {
    var p = action.payload || {};
    var from = p.fromFaction || p.actorFaction || action.faction || (fac && fac.name) || '';
    var to = p.targetFaction || p.toFaction || p.target || p.to || '';
    if (!from || !to || from === to) return { ok: false, reason: 'missing faction target' };
    var delta = _safeNum(p.relationDelta != null ? p.relationDelta : p.delta);
    var oldRec = _findRelationRecord(from, to) || _findRelationRecord(to, from);
    var oldValue = oldRec && oldRec.value != null ? _safeNum(oldRec.value) : 0;
    var nextValue = (p.value != null) ? _clamp(_safeNum(p.value), -100, 100) : _clamp(oldValue + delta, -100, 100);
    var relType = p.relationType || p.newType || p.status || (oldRec && oldRec.type) || 'neutral';
    var desc = p.reason || p.event || p.desc || '';
    if (typeof global.setFactionRelation === 'function') {
      try { global.setFactionRelation(from, to, { value: nextValue, type: relType, desc: desc }, { mirror: true }); } catch(_){}
    } else {
      _upsertRelationRecord(from, to, { value: nextValue, type: relType, desc: desc });
      _upsertRelationRecord(to, from, { value: nextValue, type: relType, desc: desc });
    }
    var rec = {
      id: action.actionId,
      turn: turn,
      from: from,
      to: to,
      relationFrom: oldValue,
      relationTo: nextValue,
      relationType: relType,
      reason: desc,
      _generatedByLlm: true,
      _decisionId: action.decisionId,
      _actionId: action.actionId,
      _actionType: action.type
    };
    _pushFacTrajectory(fac, 'npcDiplomacyActions', rec);
    return { ok: true, detail: { from: from, to: to, relationFrom: oldValue, relationTo: nextValue } };
  }

  function _applyProvincePolicy(fac, action, turn) {
    var p = action.payload || {};
    var province = p.province || p.region || p.division || p.name || '';
    var owner = p.ownerFaction || p.newOwner || p.targetFaction || p.faction || p.toFaction || '';
    var reason = p.reason || p.rationale || '';
    if (!province || !owner) return { ok: false, reason: 'missing province/owner', province: province };
    var G = global.GM || {};
    var oldOwner = (G._provinceToFaction && G._provinceToFaction[province])
      || (G.provinceStats && G.provinceStats[province] && G.provinceStats[province].owner)
      || '';
    var changed = false;
    if (global.TM && global.TM.FactionMembership && typeof global.TM.FactionMembership.assignProvince === 'function') {
      try { changed = global.TM.FactionMembership.assignProvince(province, owner, { reason: reason || '势力精细推演', silent: true }); } catch(_){}
    }
    if (!changed) {
      if (!G._provinceToFaction) G._provinceToFaction = {};
      G._provinceToFaction[province] = owner;
      if (!G.provinceStats) G.provinceStats = {};
      if (!G.provinceStats[province]) G.provinceStats[province] = {};
      G.provinceStats[province].owner = owner;
      if (Array.isArray(G.facs)) {
        G.facs.forEach(function(f) {
          if (!f || !f.name) return;
          if (Array.isArray(f.territories)) f.territories = f.territories.filter(function(x){ return x !== province; });
          if (Array.isArray(f.provinceIds)) f.provinceIds = f.provinceIds.filter(function(x){ return x !== province; });
          if (f.name === owner) {
            if (!Array.isArray(f.territories)) f.territories = [];
            if (!Array.isArray(f.provinceIds)) f.provinceIds = [];
            if (f.territories.indexOf(province) < 0) f.territories.push(province);
            if (f.provinceIds.indexOf(province) < 0) f.provinceIds.push(province);
          }
        });
      }
      changed = oldOwner !== owner;
    }
    var rec = {
      id: action.actionId,
      turn: turn,
      province: province,
      policy: p.policy || 'transfer_owner',
      ownerFrom: oldOwner,
      ownerTo: owner,
      reason: reason,
      changed: changed,
      _generatedByLlm: true,
      _decisionId: action.decisionId,
      _actionId: action.actionId,
      _actionType: action.type
    };
    _pushFacTrajectory(fac, 'npcProvincePolicies', rec);
    return { ok: true, detail: { province: province, ownerFrom: oldOwner, ownerTo: owner } };
  }

  function _applyFiscalPolicy(fac, action, turn) {
    var p = action.payload || {};
    var resource = String(p.resource || p.kind || 'money').trim();
    if (['money','grain','cloth'].indexOf(resource) < 0) resource = 'money';
    var delta = p.treasuryDelta != null ? _safeNum(p.treasuryDelta)
      : p.delta != null ? _safeNum(p.delta)
      : p.amount != null ? _safeNum(p.amount)
      : 0;
    if (!delta || !fac || !fac.treasury || typeof fac.treasury !== 'object') {
      return { ok: false, reason: 'missing treasury/delta' };
    }
    var before = _safeNum(fac.treasury[resource]);
    fac.treasury[resource] = Math.max(0, before + delta);
    var rec = {
      id: action.actionId,
      turn: turn,
      resource: resource,
      delta: delta,
      from: before,
      to: fac.treasury[resource],
      reason: p.reason || p.rationale || '',
      _generatedByLlm: true,
      _decisionId: action.decisionId,
      _actionId: action.actionId,
      _actionType: action.type
    };
    _pushFacTrajectory(fac, 'npcFiscalActions', rec);
    return { ok: true, detail: { resource: resource, from: before, to: fac.treasury[resource], delta: delta } };
  }

  // ──────────────────────────────────────────────────────────
  // Apply decision·按 schema 改 fac/chars 数据
  // ──────────────────────────────────────────────────────────
  function _applyDecision(fac, decision) {
    var engine = _actionEngine();
    if (engine && typeof engine.applyDecision === 'function') {
      return engine.applyDecision(fac, decision);
    }
    var turn = (global.GM && global.GM.turn) || 1;
    var entry = (global.GM && global.GM._facIndex && global.GM._facIndex[fac.name]) || null;
    var alive = (entry && entry.chars) ? entry.chars.filter(function(c){ return c.alive !== false; }) : [];
    var ruler = alive.find(function(c){ return _classifyChar(c) === 'ruler'; }) || alive[0];

    var normalizedActions = _normalizeDecisionActions(fac, decision, { turn: turn });
    var actionBuckets = _bucketActions(normalizedActions);
    var summary = { memorials: 0, edicts: 0, chaoyi: 0, office: 0, actions: 0, skippedActions: 0 };
    function nextAction(type) {
      var list = actionBuckets[type] || [];
      return list.shift() || _makeAction(_makeDecisionId(fac, turn), turn, fac, type, summary.actions + summary.skippedActions, {});
    }
    function recordAction(action, status, detail) {
      if (!action) return;
      if (!Array.isArray(fac._npcLlmActionLedger)) fac._npcLlmActionLedger = [];
      fac._npcLlmActionLedger.push({
        decisionId: action.decisionId,
        actionId: action.actionId,
        type: action.type,
        turn: turn,
        status: status || 'applied',
        detail: detail || null
      });
      if (status === 'applied') summary.actions++;
      else summary.skippedActions++;
      _trimLedger(fac);
    }

    // 1. memorials
    decision.memorials.forEach(function(m, idx){
      var action = nextAction('memorial');
      var char = alive.find(function(c){ return c.name === m.from; });
      if (!char) { recordAction(action, 'skipped', { reason: 'char not found', target: m.from }); return; }  // LLM hallucinated char·skip
      var loyaltyDelta = _clamp(_safeNum(m.loyaltyDelta), -10, 10);
      char.loyalty = _clamp(_safeNum(char.loyalty) + loyaltyDelta, 0, 100);
      if (!Array.isArray(char._memorialMemory)) char._memorialMemory = [];
      char._memorialMemory.push(turn + ': ' + m.type + '·' + m.rulerDecision);
      if (char._memorialMemory.length > 10) char._memorialMemory = char._memorialMemory.slice(-10);

      var rec = {
        id: 'npcm_llm_' + turn + '_' + fac.name + '_' + idx,
        from: m.from,
        fromRole: _classifyChar(char),
        to: ruler ? ruler.name : '',
        type: m.type,
        subtype: m.type === '密奏' ? '密折' : '上疏',
        content: m.content,
        status: m.rulerDecision,
        ruling: m.ruling || '',
        turn: turn,
        resolvedTurn: turn,
        impact: { loyaltyDelta: loyaltyDelta, memoryNote: turn + ': ' + m.type + '·' + m.rulerDecision },
        _generatedByLlm: true,
        _decisionId: action.decisionId,
        _actionId: action.actionId,
        _actionType: action.type
      };
      if (!Array.isArray(fac.npcMemorials)) fac.npcMemorials = [];
      if (fac.npcMemorials.length > 30) fac.npcMemorials = fac.npcMemorials.slice(-30);
      fac.npcMemorials.push(rec);
      // Phase H2·LLM 决策也入近事快报
      if (global.TM && global.TM.FactionNpcNewsBridge) {
        try { global.TM.FactionNpcNewsBridge.pushMemorial(fac, rec); } catch(_){}
      }
      summary.memorials++;
      recordAction(action, 'applied', { from: m.from, type: m.type });
    });

    // 2. edict
    if (decision.edict) {
      var edictAction = nextAction('edict');
      var ed = decision.edict;
      var treasuryDelta = _clamp(_safeNum(ed.treasuryDelta), -1000000, 1000000);
      if (fac.treasury && typeof fac.treasury === 'object') {
        fac.treasury.money = Math.max(0, _safeNum(fac.treasury.money) + treasuryDelta);
      }
      var loyDeltas = ed.loyaltyDeltas || {};
      ['court', 'general', 'clan'].forEach(function(role){
        var d = _clamp(_safeNum(loyDeltas[role]), -15, 15);
        if (!d) return;
        alive.forEach(function(c){
          if (_classifyChar(c) !== role) return;
          c.loyalty = _clamp(_safeNum(c.loyalty) + d, 0, 100);
        });
      });
      var edictRec = {
        id: 'npce_llm_' + turn + '_' + fac.name,
        issuer: ruler ? ruler.name : '',
        turn: turn,
        type: ed.type,
        content: ed.content,
        trigger: ed.trigger || '',
        effects: { treasuryDelta: treasuryDelta, loyaltyDeltas: loyDeltas },
        applied: true,
        _generatedByLlm: true,
        _decisionId: edictAction.decisionId,
        _actionId: edictAction.actionId,
        _actionType: edictAction.type
      };
      if (!Array.isArray(fac.npcEdicts)) fac.npcEdicts = [];
      if (fac.npcEdicts.length > 30) fac.npcEdicts = fac.npcEdicts.slice(-30);
      fac.npcEdicts.push(edictRec);
      if (global.TM && global.TM.FactionNpcNewsBridge) {
        try { global.TM.FactionNpcNewsBridge.pushEdict(fac, edictRec); } catch(_){}
      }
      summary.edicts++;
      recordAction(edictAction, 'applied', { type: ed.type, treasuryDelta: treasuryDelta });
    }

    // 3. chaoyi
    if (decision.chaoyi) {
      var chaoyiAction = nextAction('court_alignment');
      var cy = decision.chaoyi;
      var pid = _clamp(_safeNum(cy.partyImbalanceDelta), -0.3, 0.3);
      if (fac.derivedHealth && fac.derivedHealth._source) {
        fac.derivedHealth._source.partyImbalance = _clamp(_safeNum(fac.derivedHealth._source.partyImbalance) + pid, 0, 1);
      }
      var lByP = cy.loyaltyDeltaByParty || {};
      Object.keys(lByP).forEach(function(p){
        var d = _clamp(_safeNum(lByP[p]), -10, 10);
        alive.forEach(function(c){
          if (c.party !== p) return;
          c.loyalty = _clamp(_safeNum(c.loyalty) + d, 0, 100);
        });
      });
      var cyRec = {
        id: 'npccy_llm_' + turn + '_' + fac.name,
        turn: turn,
        type: cy.type,
        parties: Object.keys(lByP),
        participants: [],  // LLM 没指明·留空
        summary: cy.summary || '',
        effects: { partyImbalanceDelta: pid, loyaltyDeltaByParty: lByP },
        _generatedByLlm: true,
        _decisionId: chaoyiAction.decisionId,
        _actionId: chaoyiAction.actionId,
        _actionType: chaoyiAction.type
      };
      if (!Array.isArray(fac.npcChaoyi)) fac.npcChaoyi = [];
      if (fac.npcChaoyi.length > 30) fac.npcChaoyi = fac.npcChaoyi.slice(-30);
      fac.npcChaoyi.push(cyRec);
      if (global.TM && global.TM.FactionNpcNewsBridge) {
        try { global.TM.FactionNpcNewsBridge.pushChaoyi(fac, cyRec); } catch(_){}
      }
      summary.chaoyi++;
      recordAction(chaoyiAction, 'applied', { type: cy.type, partyImbalanceDelta: pid });
    }

    // 4. office
    decision.office.forEach(function(o, idx){
      var officeAction = nextAction('office_change');
      var char = alive.find(function(c){ return c.name === o.target; });
      if (!char) { recordAction(officeAction, 'skipped', { reason: 'char not found', target: o.target }); return; }
      var d = _clamp(_safeNum(o.loyaltyDelta), -15, 15);
      var posBefore = char.position || char.officialTitle || char.role || char.title || '';
      var hookResult = null;
      var appointHook = (typeof global.onAppointment === 'function')
        ? global.onAppointment
        : ((global.AIChangeApplier && typeof global.AIChangeApplier.onAppointment === 'function') ? global.AIChangeApplier.onAppointment : null);
      if (appointHook && o.newPosition) {
        try { hookResult = appointHook(o.target, o.newPosition, { dept: o.dept || o.deptHint || '' }); } catch(_){}
      }
      char.position = o.newPosition || char.officialTitle || posBefore;
      if (o.newPosition && !char.officialTitle) char.officialTitle = o.newPosition;
      char.loyalty = _clamp(_safeNum(char.loyalty) + d, 0, 100);

      var rec = {
        id: 'npco_llm_' + turn + '_' + fac.name + '_' + idx,
        action: o.kind,
        target: o.target,
        ruler: ruler ? ruler.name : '',
        reason: o.reason || '',
        effect: { positionFrom: posBefore, positionTo: char.position, loyaltyDelta: d, appointmentHook: !!(hookResult && hookResult.ok), treeUpdated: !!(hookResult && hookResult.treeUpdated) },
        turn: turn,
        _generatedByLlm: true,
        _decisionId: officeAction.decisionId,
        _actionId: officeAction.actionId,
        _actionType: officeAction.type
      };
      if (!Array.isArray(fac.npcOfficeActions)) fac.npcOfficeActions = [];
      if (fac.npcOfficeActions.length > 30) fac.npcOfficeActions = fac.npcOfficeActions.slice(-30);
      fac.npcOfficeActions.push(rec);
      if (global.TM && global.TM.FactionNpcNewsBridge) {
        try { global.TM.FactionNpcNewsBridge.pushOffice(fac, rec); } catch(_){}
      }
      summary.office++;
      recordAction(officeAction, 'applied', { target: o.target, kind: o.kind, positionTo: char.position });
    });

    function applyNativeOfficeChange(localFac, action, localTurn) {
      var o = action.payload || {};
      var target = o.target || o.char || o.name || '';
      var char = alive.find(function(c){ return c.name === target; });
      if (!char) return { ok: false, reason: 'char not found', target: target };
      var d = _clamp(_safeNum(o.loyaltyDelta != null ? o.loyaltyDelta : o.loyalty_delta), -15, 15);
      var posBefore = char.position || char.officialTitle || char.role || char.title || '';
      var newPosition = o.newPosition || o.position || o.post || o.title || posBefore;
      var hookResult = null;
      var appointHook = (typeof global.onAppointment === 'function')
        ? global.onAppointment
        : ((global.AIChangeApplier && typeof global.AIChangeApplier.onAppointment === 'function') ? global.AIChangeApplier.onAppointment : null);
      if (appointHook && newPosition) {
        try { hookResult = appointHook(target, newPosition, { dept: o.dept || o.deptHint || '' }); } catch(_){}
      }
      char.position = newPosition || char.officialTitle || posBefore;
      if (newPosition && !char.officialTitle) char.officialTitle = newPosition;
      char.loyalty = _clamp(_safeNum(char.loyalty) + d, 0, 100);
      var rec = {
        id: action.actionId,
        action: o.kind || o.action || 'appoint',
        target: target,
        ruler: ruler ? ruler.name : '',
        reason: o.reason || '',
        effect: { positionFrom: posBefore, positionTo: char.position, loyaltyDelta: d, appointmentHook: !!(hookResult && hookResult.ok), treeUpdated: !!(hookResult && hookResult.treeUpdated) },
        turn: localTurn,
        _generatedByLlm: true,
        _decisionId: action.decisionId,
        _actionId: action.actionId,
        _actionType: action.type
      };
      _pushFacTrajectory(localFac, 'npcOfficeActions', rec);
      return { ok: true, detail: { target: target, positionTo: char.position } };
    }

    function applyNativeBucket(type, summaryKey, applier) {
      var list = actionBuckets[type] || [];
      list.forEach(function(action) {
        var res = applier(fac, action, turn);
        if (res && res.ok) {
          summary[summaryKey] = (summary[summaryKey] || 0) + 1;
          recordAction(action, 'applied', res.detail || null);
        } else {
          recordAction(action, 'skipped', { reason: (res && res.reason) || 'apply failed' });
        }
      });
      actionBuckets[type] = [];
    }

    // 5. native expanded actions·统一 actions[] 写回
    applyNativeBucket('office_change', 'office', applyNativeOfficeChange);
    applyNativeBucket('fiscal_policy', 'fiscalPolicy', _applyFiscalPolicy);
    applyNativeBucket('military_order', 'military', _applyMilitaryOrder);
    applyNativeBucket('diplomacy', 'diplomacy', _applyDiplomacy);
    applyNativeBucket('province_policy', 'provincePolicy', _applyProvincePolicy);

    // 5. rationale·写到 fac._lastLlmRationale
    if (decision.rationale) fac._lastLlmRationale = { turn: turn, text: decision.rationale };

    return summary;
  }

  // ──────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────

  // 单 fac LLM 决策·async·返回 summary
  async function decideFor(facName, opts) {
    opts = opts || {};
    if (!_isEnabled()) return { skipped: true, reason: 'LLM mode off' };
    if (typeof global.GM === 'undefined') return { skipped: true, reason: 'no GM' };
    var fac = global.GM.facs.find(function(x){ return x && x.name === facName; });
    if (!fac) return { skipped: true, reason: 'fac not found' };
    var playerFacNames = _resolvePlayerFactionNames();
    if (_isPlayerFaction(fac, playerFacNames)) return { skipped: true, reason: 'player faction' };
    var ledgerRun = _beginLedgerRun(fac.name, opts);
    if (!ledgerRun.ok) return { skipped: true, reason: ledgerRun.reason, turn: ledgerRun.turn, currentTurn: ledgerRun.currentTurn };
    var ledgerToken = ledgerRun.token;

    var prompts = _buildPrompt(fac);
    var callResult = await _callLLMDecision(prompts, opts);
    var raw = callResult && callResult.parsed;
    var callDiagnostics = (callResult && callResult.diagnostics) || null;
    if (_isLedgerTokenStale(ledgerToken)) {
      return { skipped: true, reason: 'stale turn', turn: ledgerToken.turn, currentTurn: _currentTurn() };
    }
    if (!raw) {
      _finishLedgerRun(ledgerToken, 'failed', 'LLM call/parse failed', callDiagnostics || { kind:'parse', error:'empty parsed decision' });
      return { skipped: true, reason: 'LLM call/parse failed', fallbackToTemplate: true, diagnostics: callDiagnostics };
    }
    var decision = _validateDecision(raw);
    if (_isLedgerTokenStale(ledgerToken)) {
      return { skipped: true, reason: 'stale turn', turn: ledgerToken.turn, currentTurn: _currentTurn() };
    }
    if (!decision) {
      _finishLedgerRun(ledgerToken, 'failed', 'decision invalid', { kind:'schema', error:'decision invalid', rawPreview:'' });
      return { skipped: true, reason: 'decision invalid', fallbackToTemplate: true };
    }
    var summary = _applyDecision(fac, decision);
    _finishLedgerRun(ledgerToken, 'applied');
    return { applied: true, summary: summary, rationale: decision.rationale };
  }

  // 多 fac 并发·用 action engine 评分优先处理战争/财政/干预后的活跃势力
  function _precisionConcurrency() {
    var conf = (global.P && P.conf) || {};
    var n = _safeNum(conf.npcAiPrecisionConcurrency);
    return Math.max(1, Math.min(4, n || 2));
  }

  async function _mapLimit(list, limit, worker) {
    list = _arr(list);
    limit = Math.max(1, _safeNum(limit) || 1);
    var results = new Array(list.length);
    var next = 0;
    async function runOne() {
      while (next < list.length) {
        var idx = next++;
        results[idx] = await worker(list[idx], idx);
      }
    }
    var runners = [];
    for (var i = 0; i < Math.min(limit, list.length); i++) runners.push(runOne());
    await Promise.all(runners);
    return results;
  }

  function _sc16HardPriorityNames(turn) {
    var G = global.GM || {};
    var ledger = G._sc16FactionDirectives || null;
    if (!ledger) return [];
    var names = [];
    function push(v) {
      var s = String(v == null ? '' : v).trim();
      if (s && names.indexOf(s) < 0) names.push(s);
    }
    _arr(ledger.priorityQueue).sort(function(a, b) {
      var ap = _safeNum(a && (a.priority || a.priorityScore || a.score));
      var bp = _safeNum(b && (b.priority || b.priorityScore || b.score));
      var ar = _safeNum(a && a.priorityRank);
      var br = _safeNum(b && b.priorityRank);
      if (ar || br) return (ar || 999) - (br || 999);
      return bp - ap;
    }).forEach(function(row) {
      push(row && (row.faction || row.name || row.fac));
    });
    var by = ledger.byFaction || {};
    Object.keys(by).map(function(name) {
      var row = by[name] || {};
      return { name:name, rank:_safeNum(row.priorityRank), score:_safeNum(row.priorityScore || row.priority || (row.raw && row.raw.priority)) };
    }).filter(function(row) {
      return row.rank > 0 || row.score > 0;
    }).sort(function(a, b) {
      if (a.rank || b.rank) return (a.rank || 999) - (b.rank || 999);
      return b.score - a.score;
    }).forEach(function(row) { push(row.name); });
    return names;
  }

  function _applySc16HardPriorityRows(rows, turn) {
    rows = _arr(rows).slice();
    var names = _sc16HardPriorityNames(turn);
    if (!names.length) return rows;
    var used = {};
    var ordered = [];
    names.forEach(function(name, idx) {
      var row = rows.find(function(r){ return r && r.fac && r.fac.name === name; });
      if (!row || used[name]) return;
      used[name] = true;
      row.hardPriority = idx + 1;
      if (_arr(row.reasons).indexOf('sc16-hard-priority') < 0) {
        if (!Array.isArray(row.reasons)) row.reasons = [];
        row.reasons.unshift('sc16-hard-priority');
      }
      ordered.push(row);
    });
    rows.forEach(function(row) {
      var name = row && row.fac && row.fac.name;
      if (name && used[name]) return;
      ordered.push(row);
    });
    return ordered;
  }

  async function decideAll(opts) {
    opts = opts || {};
    if (!_isEnabled()) return { skipped: true, reason: 'LLM mode off' };
    if (typeof global.GM === 'undefined') return { skipped: true, reason: 'no GM' };
    var batchTurn = _safeNum(opts.turn) || _currentTurn();
    var source = opts.source || 'eager';
    var maxPerTurn = (global.TM.FactionNpcSettings && global.TM.FactionNpcSettings.maxPerTurn()) || 8;
    var playerFacNames = _resolvePlayerFactionNames();
    var candidates = global.GM.facs
      .filter(function(f){ return f && f.name && !_isPlayerFaction(f, playerFacNames); })
      .filter(function(f){ return !hasRunThisTurn(f.name, batchTurn); });
    var engine = _actionEngine();
    var npcs = [];
    var rankedRows = [];
    if (engine && typeof engine.rankFactionCandidates === 'function') {
      rankedRows = engine.rankFactionCandidates(candidates, { turn: batchTurn, playerFactionNames: playerFacNames });
      rankedRows = _applySc16HardPriorityRows(rankedRows, batchTurn);
      npcs = rankedRows.map(function(row){ return row.fac; }).slice(0, maxPerTurn);
    } else {
      rankedRows = candidates.sort(function(a, b){
        var sa = (a.derivedStrength && a.derivedStrength.value) || 0;
        var sb = (b.derivedStrength && b.derivedStrength.value) || 0;
        return sb - sa;
      }).map(function(f){ return { fac:f, score:(f.derivedStrength && f.derivedStrength.value) || 0, reasons:['strength-fallback'] }; });
      rankedRows = _applySc16HardPriorityRows(rankedRows, batchTurn);
      npcs = rankedRows.map(function(row){ return row.fac; }).slice(0, maxPerTurn);
    }
    try {
      global.GM._npcFactionLlmCandidateRanks = {
        turn: batchTurn,
        source: source,
        maxPerTurn: maxPerTurn,
        rows: rankedRows.slice(0, 16).map(function(row) {
          return { faction: row.fac && row.fac.name || '', score: Math.round(_safeNum(row.score)), reasons: _arr(row.reasons).slice(0, 8) };
        })
      };
      var turnLedger = _ensureFactionAiTurnLedger(batchTurn);
      if (turnLedger) turnLedger.candidateRanks = global.GM._npcFactionLlmCandidateRanks.rows.slice();
    } catch(_){}

    var results = await _mapLimit(npcs, _precisionConcurrency(), function(f){
      return decideFor(f.name, { source: source, turn: batchTurn }).then(function(r){ return { fac: f.name, result: r }; });
    });
    var applied = results.filter(function(r){ return r.result.applied; }).length;
    return { applied: applied, attempted: npcs.length, results: results };
  }

  function _diagText(obj) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    try { return JSON.stringify(obj); } catch(_) { return String(obj || ''); }
  }

  function buildFactionAiDiagnostics(facName) {
    var G = global.GM || {};
    var fac = null;
    if (facName && Array.isArray(G.facs)) {
      fac = G.facs.find(function(x){ return x && x.name === facName; }) || null;
    }
    if (!fac && facName && typeof facName === 'object') {
      fac = facName;
      facName = fac.name;
    }
    if (!facName && fac) facName = fac.name;
    var run = (G._npcFactionLlmLedger && G._npcFactionLlmLedger.runs && G._npcFactionLlmLedger.runs[facName]) || null;
    var directive = (G._sc16FactionDirectives && G._sc16FactionDirectives.byFaction && G._sc16FactionDirectives.byFaction[facName])
      || (fac && fac._sc16Directive)
      || null;
    var candidateRank = null;
    var ranks = G._npcFactionLlmCandidateRanks && G._npcFactionLlmCandidateRanks.rows;
    if (Array.isArray(ranks)) {
      candidateRank = ranks.find(function(row){ return row && row.faction === facName; }) || null;
    }
    var qijuWrites = _arr(G.qijuHistory).filter(function(q) {
      if (!q) return false;
      var src = q._source || '';
      if (['npc-in-turn-llm','npc-bridge','faction-npc-llm'].indexOf(src) < 0) return false;
      return q._facName === facName || _diagText(q).indexOf(facName) >= 0;
    });
    var settings = {};
    try {
      if (global.TM && TM.FactionNpcSettings && typeof TM.FactionNpcSettings.getStatus === 'function') {
        settings = TM.FactionNpcSettings.getStatus() || {};
      }
    } catch(_){}
    var dispatch = G._npcFactionLlmDispatchLedger || null;
    var turn = _safeNum(G.turn) || _currentTurn();
    var turnLedger = (G._npcFactionAiTurnLedger && G._npcFactionAiTurnLedger.turn === turn)
      ? G._npcFactionAiTurnLedger
      : null;
    if (!turnLedger && (G._npcFactionLlmLedger || dispatch || G._npcFactionLlmCandidateRanks || G._sc16FactionDirectives)) {
      turnLedger = {
        turn: turn,
        sc16: G._sc16FactionDirectives || null,
        dispatch: dispatch,
        runs: (G._npcFactionLlmLedger && G._npcFactionLlmLedger.runs) || {},
        actions: _arr(fac && fac._npcLlmActionLedger).slice(),
        candidateRanks: _arr(G._npcFactionLlmCandidateRanks && G._npcFactionLlmCandidateRanks.rows).slice(),
        notes: [],
        stats: dispatch && dispatch.stats ? { dispatch: dispatch.stats } : {}
      };
    }
    return {
      turn: turn,
      faction: facName || '',
      exists: !!fac,
      settings: settings,
      run: run,
      sc16Directive: directive,
      candidateRank: candidateRank,
      dispatch: dispatch,
      turnLedger: turnLedger,
      actionLedger: _arr(fac && fac._npcLlmActionLedger).slice(),
      lastRationale: fac && fac._lastLlmRationale || null,
      lastApplySummary: fac && fac._lastLlmApplySummary || null,
      qijuWrites: qijuWrites.slice(-12)
    };
  }

  global.TM = global.TM || {};
  global.TM.FactionNpcLlmDecision = {
    decideFor: decideFor,
    decideAll: decideAll,
    _buildPrompt: _buildPrompt,
    buildRecentTrajectoryContextForSc16: buildRecentTrajectoryContextForSc16,
    buildFactionAdminSummaryForSc16: buildFactionAdminSummaryForSc16,
    _formatOwnAdminHierarchy: _formatOwnAdminHierarchy,
    hasRunThisTurn: hasRunThisTurn,
    countRunsThisTurn: countRunsThisTurn,
    buildFactionAiDiagnostics: buildFactionAiDiagnostics,
    _resolvePlayerFactionNames: _resolvePlayerFactionNames,
    _isPlayerFaction: _isPlayerFaction,
    _validateDecision: _validateDecision,
    _normalizeDecisionActions: _normalizeDecisionActions,
    _applyDecision: _applyDecision,
    _isEnabled: _isEnabled
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { decideFor: decideFor, decideAll: decideAll, hasRunThisTurn: hasRunThisTurn, countRunsThisTurn: countRunsThisTurn, buildRecentTrajectoryContextForSc16: buildRecentTrajectoryContextForSc16, buildFactionAdminSummaryForSc16: buildFactionAdminSummaryForSc16, buildFactionAiDiagnostics: buildFactionAiDiagnostics, _resolvePlayerFactionNames: _resolvePlayerFactionNames, _isPlayerFaction: _isPlayerFaction, _normalizeDecisionActions: _normalizeDecisionActions };
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
