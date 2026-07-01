// @ts-check
/// <reference path="types.d.ts" />
// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   LLM 接管 NPC 势力决策（Phase G·替代 F4 enrich·暴露 TM.FactionNpcLlmDecision）
//   §1 buildPrompt   拼 fac state（派生数据 + chars + 派系 + 近事），让 LLM 全面理解再决策
//   §2 callLLM       返回 structured JSON（NpcTurnDecision）
//   §3 Apply         按 schema 改 fac/chars 数据（代码 apply 副作用）
//   §4 Public API    单 fac LLM 决策（async·返回 summary）· 账本 GM._npcFactionLlmLedger
// ─────────────────────────────────────────────
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

  // 【A·按需取数 S2】prompt 构建模式·默认 'full'(原路径字节不变·零回归)·仅 _buildPromptCore 临时设 'core' 时按核心段过滤(其余 18 段走工具按需取)
  var _promptBuildMode = 'full';
  var _CORE_SECTIONS = { OWN_STRATEGIC_MEMORY: 1, ACTIVE_GOALS: 1, ACTION_CANDIDATES: 1, ACTION_CONTRACT: 1, RELATIONS_AND_WARS: 1, FISCAL_CONTEXT: 1, RULER_PSYCHE: 1, WORLD_STATUS: 1, INCOMING_PROPOSALS: 1, PLAYER_PROPOSAL_OUTCOMES: 1 };
  function _pushSection(lines, title, bodyLines) {
    if (_promptBuildMode === 'core' && !_CORE_SECTIONS[title]) return;  // core 模式只放核心段·full 模式(默认)恒不过滤=零回归
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
          rawLength: diagnostics.rawLength || 0,
          possibleTruncation: diagnostics.possibleTruncation === true,
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
    // 喂 AI 读 div 真值源优先(div.minxin/div.corruption)·*Local 仅兜底：聚合/民变/面板/财政都认 div.minxin，
    //   势力行动改真值后不碰 *Local，若仍 *Local 优先则 AI 推演读到没更新的旧账(E.B「AI 不认数值」根)。
    if (d.minxin != null || d.minxinLocal != null) parts.push('minxin=' + (d.minxin != null ? d.minxin : d.minxinLocal));
    if (d.corruption != null || d.corruptionLocal != null) parts.push('corruption=' + (d.corruption != null ? d.corruption : d.corruptionLocal));
    var tags = _truthyKeys(d.tags, 5);
    if (tags.length) parts.push('tags=' + tags.join('/'));
    if (Array.isArray(d.tradeRoutes) && d.tradeRoutes.length) parts.push('routes=' + d.tradeRoutes.slice(0, 3).map(function(x){ return _txt(x, 22); }).join('/'));
    if (Array.isArray(d.threats) && d.threats.length) parts.push('threats=' + d.threats.slice(0, 3).map(function(x){ return _txt(x, 24); }).join('/'));
    if (d.strategicValue != null && d.strategicValue !== '') parts.push('战略价值=' + _txt(d.strategicValue, 24));  // P1-A4·入 LLM 攻守感知·剧本标了才显示(零回归)·高价值宜守/宜夺
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
      var sides = _arr(w.sides).concat([w.attacker, w.defender].filter(Boolean)).join('|');
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

  function _collectLeafDivs(tree) {
    var out = [];
    (function w(list){ _arr(list).forEach(function(n){
      if (!n) return;
      var k = n.divisions || n.children;
      if (k && k.length) w(k); else out.push(n);
    }); })(tree && tree.divisions);
    return out;
  }

  // A1b·边境军情：让 LLM 出征/防守决策看见 borderRisk(A1a 叶级算)·补「AI 开战对地块边境盲视」。
  //   我方叶 borderRisk 高=本地驻军空虚易被攻(宜守)·敌对 faction 叶 borderRisk 高=其空虚(可攻软肋)。
  //   开关 borderRiskEnabled 守卫(A1a 没开则无活值·返空·_pushSection 不注入=零回归)。
  function _formatBorderIntel(fac) {
    if (global.P && global.P.conf && global.P.conf.borderRiskEnabled === false) return [];   // 默认开·显式 false 才关(owner 拍板)
    if (!fac || !fac.name) return [];
    var lines = [];
    function riskyLeaves(tree, limit) {
      return _collectLeafDivs(tree)
        .filter(function(l){ return l && typeof l.borderRisk === 'number' && l.borderRisk > 0; })
        .sort(function(a,b){ return b.borderRisk - a.borderRisk; })
        .slice(0, limit || 5);
    }
    // 我方边镇险情(本 faction 叶 borderRisk 高)
    var own = _findAdminTreeForFac(fac);
    var myRisky = own && own.tree ? riskyLeaves(own.tree, 5) : [];
    if (myRisky.length) {
      lines.push('  我方边镇险情(边警高=本地驻军空虚·易被攻破·宜增兵固守)：');
      myRisky.forEach(function(l){ lines.push('    ' + _txt(l.name || l.id || '?', 40) + ' 边警' + l.borderRisk); });
    }
    // 敌方软肋(敌对 faction 叶 borderRisk 高)
    var hostiles = (global.BorderRisk && global.BorderRisk._hostileFactionsOf)
      ? global.BorderRisk._hostileFactionsOf(fac.name, (_resolvePlayerFactionNames()[0] || 'player')) : [];
    var enemySoft = [];
    _arr(hostiles).forEach(function(h){
      var t = _findAdminTreeForFac(h);
      if (!t || !t.tree) return;
      riskyLeaves(t.tree, 5).forEach(function(l){
        enemySoft.push({ name: l.name || l.id || '?', risk: l.borderRisk, fac: h.name, sv: l.strategicValue });
      });
    });
    enemySoft.sort(function(a,b){ return b.risk - a.risk; });
    enemySoft.slice(0, 5).forEach(function(e, i){
      if (i === 0) lines.push('  敌方软肋(敌境边警高=其驻军空虚·若与之开战宜优先攻取)：');
      lines.push('    ' + _txt(e.fac, 24) + '·' + _txt(e.name, 36) + ' 边警' + e.risk + ((e.sv != null && e.sv !== '') ? ' 战略价值' + _txt(e.sv, 16) : ''));  // P1-A4·高价值软肋优先夺
    });
    return lines;
  }

  // S5·营建机宜：本派各地建筑之需(NPC 势力 LLM 自主营建用·借 A4 活字段——边警高宜筑防/官缺重宜兴学/田邑可垦)。
  //   仅本派叶·降序取需最急者·无需则返空(_pushSection 不注入·零回归)。开关 factionAgentEnabled(势力 agent 总闸)。
  function _formatBuildOpportunities(fac) {
    if (!(global.P && (typeof agentFlagOn === 'function' ? agentFlagOn('factionAgentEnabled') : (global.P.conf && global.P.conf.factionAgentEnabled)))) return [];
    if (!fac || !fac.name) return [];
    var own = _findAdminTreeForFac(fac);
    if (!own || !own.tree) return [];
    var leaves = _collectLeafDivs(own.tree);
    if (!leaves.length) return [];
    var lines = [];
    var risky = leaves.filter(function(l){ return l && _safeNum(l.borderRisk) >= 50; }).sort(function(a,b){ return _safeNum(b.borderRisk) - _safeNum(a.borderRisk); }).slice(0, 4);
    if (risky.length) {
      lines.push('  边镇险情(边警高·宜筑堡台/巡检/烽燧 给 defenseBonus 固防)：');
      risky.forEach(function(l){ lines.push('    ' + _txt(l.name || l.id || '?', 36) + ' 边警' + _safeNum(l.borderRisk)); });
    }
    var vac = leaves.filter(function(l){ return l && _safeNum(l.officeVacancy) >= 2; }).sort(function(a,b){ return _safeNum(b.officeVacancy) - _safeNum(a.officeVacancy); }).slice(0, 3);
    if (vac.length) {
      lines.push('  官缺待补(宜兴书院/府学 给 officialSupply 储官)：');
      vac.forEach(function(l){ lines.push('    ' + _txt(l.name || l.id || '?', 36) + ' 官缺' + _safeNum(l.officeVacancy) + ' 员'); });
    }
    var fertile = leaves.filter(function(l){ var eb = l && l.economyBase; return eb && _safeNum(eb.farmland) > 0; }).sort(function(a,b){ return _safeNum(b.economyBase.farmland) - _safeNum(a.economyBase.farmland); }).slice(0, 2);
    if (fertile.length && lines.length < 6) {
      lines.push('  农本可兴(田邑·宜垦田/水利增 economyBase.farmland)：');
      fertile.forEach(function(l){ lines.push('    ' + _txt(l.name || l.id || '?', 36) + ' 田亩约' + _safeNum(l.economyBase.farmland)); });
    }
    if (lines.length && fac.treasury && typeof fac.treasury.money === 'number') {
      var _muF = (typeof CurrencyUnit !== 'undefined' && CurrencyUnit.unitOf) ? (CurrencyUnit.unitOf('money') || '两') : '两';
      lines.push('  本派库藏约 ' + _fmtAmount(_safeNum(fac.treasury.money)) + ' ' + _muF + '·量入为出，勿拟力所不及之大役。');   // 完善·财力门槛(扣本派库银·不继不建)
    }
    if (!lines.length) return [];
    return ['(本派可营建之机·据需自主兴造·非必每回合)'].concat(lines);
  }

  // S5·NPC 自主营建落地：本派 LLM 决策的 builds → 本派叶 division.buildings[](过既有工期 tick 完工入账)。
  //   只许在本派真实地块建·effectsStructured 过硬门 sanitizeStructuredFx·防重复同名·护栏 ≤3/回合·标 _viaFactionAgent。
  //   完善(2026-06-21)：①经济约束——扣本派库银 fac.treasury.money·不继则不建(硬核·穷国受限)·无 treasury 的派经济抽象不约束；
  //                     ②可观测——addEB 谍报让玩家见敌国营建(活世界)。返回落地清单或 null。
  function _landFactionBuilds(fac, builds) {
    if (!fac || !Array.isArray(builds) || !builds.length) return null;
    var own = _findAdminTreeForFac(fac);
    if (!own || !own.tree) return null;
    var leaves = _collectLeafDivs(own.tree);
    if (!leaves.length) return null;
    var BW = global.TM && global.TM.BuildingWorks;
    var hasTreasury = !!(fac.treasury && typeof fac.treasury === 'object' && typeof fac.treasury.money === 'number');
    var purse = hasTreasury ? _safeNum(fac.treasury.money) : Infinity;     // 完善·无 treasury 的派经济抽象不约束
    var landed = [];
    builds.slice(0, 3).forEach(function(b){
      if (!b || !b.territory || !b.name) return;
      if (b.feasibility === '不合理') return;
      var div = null;
      for (var i = 0; i < leaves.length; i++) { if (leaves[i] && leaves[i].name === b.territory) { div = leaves[i]; break; } }
      if (!div) return;                                                       // 只许在本派真实地块建
      if (!Array.isArray(div.buildings)) div.buildings = [];
      if (div.buildings.some(function(x){ return x && x.name === b.name; })) return;  // 防重复同名
      var cost = _safeNum(b.costActual);
      if (cost > 0 && purse < cost) return;                                   // 完善·库银不继则不建(硬核·穷国受限)
      var rawFx = (b.effectsStructured && typeof b.effectsStructured === 'object') ? b.effectsStructured : null;
      var sane = (BW && rawFx && typeof BW.sanitizeStructuredFx === 'function') ? BW.sanitizeStructuredFx(rawFx, cost) : rawFx;
      var rt = Math.max(1, _safeNum(b.timeActual));
      div.buildings.push({
        name: String(b.name).slice(0, 40), level: 1, isCustom: true,
        description: String(b.description || '').slice(0, 200),
        judgedEffects: String(b.judgedEffects || '').slice(0, 200),
        effectsStructured: sane,
        costActual: cost || null, timeActual: _safeNum(b.timeActual) || rt,
        status: 'building', remainingTurns: rt, startTurn: _currentTurn(),
        _viaFactionAgent: fac.name                                           // 可观测：NPC 势力自主营建(非玩家自拟·非主推演)
      });
      if (cost > 0 && hasTreasury) { fac.treasury.money = Math.max(0, _safeNum(fac.treasury.money) - cost); purse -= cost; }  // 完善·扣本派库银(硬核·受财力约束)
      _ebFactionBuild(fac, b.territory, b.name, b);                           // 完善·谍报可观测(玩家见敌国营建·活世界)
      landed.push({ territory: b.territory, name: b.name, cost: cost });
    });
    return landed.length ? landed : null;
  }

  // 完善·可观测：邸报/谍报让玩家见敌国营建(活世界·major 工程可知)。category→动词。
  function _ebFactionBuild(fac, territory, name, b) {
    if (typeof global.addEB !== 'function') return;
    var cat = b && b.category;
    var verb = (cat === 'military') ? '筑' : (cat === 'cultural' ? '兴' : (cat === 'administrative' ? '设' : '营'));
    try { global.addEB('谍报', (fac && fac.name || '某势力') + '于' + territory + verb + '「' + name + '」' + (b && b.judgedEffects ? '·' + String(b.judgedEffects).slice(0, 18) : '')); } catch (e) {}
  }

  // 完善·NPC 自修半损建筑(闭 S6 损坏循环)：本派 damaged 建筑·库银可支半费(造价 30%)则走 BuildingWorks.repairBuilding 复效用·扣 fac.treasury.money·谍报可观测。
  function _repairFactionBuildings(fac) {
    if (!fac || !(fac.treasury && typeof fac.treasury.money === 'number')) return null;   // 无库银不修
    var BW = global.TM && global.TM.BuildingWorks;
    if (!BW || typeof BW.repairBuilding !== 'function') return null;
    var own = _findAdminTreeForFac(fac);
    if (!own || !own.tree) return null;
    var leaves = _collectLeafDivs(own.tree);
    var repaired = [];
    for (var i = 0; i < leaves.length; i++) {
      var div = leaves[i];
      if (!div || !Array.isArray(div.buildings)) continue;
      for (var j = 0; j < div.buildings.length; j++) {
        var bld = div.buildings[j];
        if (!bld || bld.status !== 'damaged') continue;
        var rcost = Math.max(20, Math.round(_safeNum(bld.costActual) * 0.3));
        if (_safeNum(fac.treasury.money) < rcost) continue;
        fac.treasury.money = Math.max(0, _safeNum(fac.treasury.money) - rcost);
        BW.repairBuilding(div, bld);
        repaired.push({ territory: div.name, name: bld.name });
        if (typeof global.addEB === 'function') { try { global.addEB('谍报', (fac.name || '某势力') + '葺治' + (div.name || '') + '「' + bld.name + '」'); } catch (e) {} }
      }
    }
    return repaired.length ? repaired : null;
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
    var list = _arr(alive).filter(function(c){ return c && !c._captured; });   // 被俘者(北狩/陷虏)排出本势力可用班底
    if (!list.length && fac && fac.name) {
      list = _arr(G.chars).filter(function(c){
        return c && c.alive !== false && !c._captured && (c.faction === fac.name || c.factionName === fac.name || c.ownerFaction === fac.name);
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
  // G1·Tier 1 智力反喂·2026-05-22·把已存的 ledger 反喂 prompt·让 LLM 看见自己的过去
  // ──────────────────────────────────────────────────────────

  // B方案 S2·跨场景：格式化近期廷议朝堂博弈摘要(GM._chaoyiMemory·廷议 S1 写入)·供势力决策感知朝堂权力消长
  function _formatCourtDebateMemory() {
    var mem = (typeof GM !== 'undefined' && Array.isArray(GM._chaoyiMemory)) ? GM._chaoyiMemory : [];
    if (!mem.length) return [];
    var turn = _currentTurn();
    var lines = [];
    mem.slice(-3).forEach(function(m) {
      if (!m) return;
      var staleness = turn - _safeNum(m.turn);
      var pa = m.partyAlignment || {};
      var paStr = Object.keys(pa).map(function(p) {
        return p + ':' + ({ support: '主允', oppose: '主驳', neutral: '中立' }[pa[p]] || pa[p]);
      }).slice(0, 6).join('·');
      lines.push('  T' + _safeNum(m.turn) + (staleness > 0 ? '(' + staleness + '回合前)' : '') + '·廷议「' + _txt(m.topic, 30) + '」→裁决:' + _txt(m.decision, 20) + (paStr ? '·党派立场:' + paStr : ''));
    });
    if (!lines.length) return [];
    lines.unshift('  近期朝堂廷议博弈(判断朝堂权力消长/党派动向·若与你的外交内政相关则纳入考量):');
    return lines;
  }

  // 段 1·自己的长期战略记忆·读 fac.aiStrategy (action-engine.ensureStrategyV2 写)
  function _formatOwnStrategicMemory(fac) {
    var s = fac && fac.aiStrategy;
    if (!s || typeof s !== 'object') return [];
    var lines = [];
    var turn = _currentTurn();
    var staleness = turn - _safeNum(s.lastUpdatedTurn);
    lines.push('  Your own strategic memory (across turns). Use to maintain continuity·avoid contradicting your own past objectives without reason.');
    if (s.posture) lines.push('  posture·' + _txt(s.posture, 30));
    if (s.currentPlan) lines.push('  currentPlan·' + _txt(s.currentPlan, 140));
    if (s.lastDecision && s.lastDecision.turn) {
      var ld = s.lastDecision;
      lines.push('  lastDecision·T' + ld.turn + ' (' + (staleness === 0 ? 'this turn' : staleness + ' turns ago') + ')·types=[' + _arr(ld.actionTypes).slice(0, 8).join(',') + ']·rationale=' + _txt(ld.rationale, 140));
    }
    var listFmt = function(label, list, max, fn) {
      list = _arr(list);
      if (!list.length) return;
      var items = list.slice(-max).map(fn || function(x){ return _txt(x, 50); });
      lines.push('  ' + label + '·' + items.join(' / '));
    };
    listFmt('objectives', s.objectives, 6);
    listFmt('threats', s.threats, 4);
    listFmt('alliances', s.alliances, 4);
    listFmt('claims', s.claims, 4);
    listFmt('grudges', s.grudges, 4);
    listFmt('militaryPlans', s.militaryPlans, 3);
    listFmt('treaties', s.treaties, 3);
    if (s.cooldowns && typeof s.cooldowns === 'object') {
      var cdEntries = Object.keys(s.cooldowns).map(function(k) {
        var t = _safeNum(s.cooldowns[k]);
        return { type: k, turn: t, gap: turn - t };
      }).filter(function(c){ return c.gap >= 0 && c.gap <= 3; }).sort(function(a, b){ return a.gap - b.gap; }).slice(0, 5);
      if (cdEntries.length) {
        lines.push('  recentActionTypes (cooldown hint·不必每回合都重复)·' + cdEntries.map(function(c){ return c.type + '(T' + c.turn + ',' + c.gap + 'ago)'; }).join(' / '));
      }
    }
    return lines.length > 1 ? lines : [];
  }

  // 段 2·上回合失败动作·读 fac._lastLlmApplySummary (action-engine.applyDecision 写)
  function _formatLastTurnFailures(fac) {
    var summary = fac && fac._lastLlmApplySummary;
    if (!summary || typeof summary !== 'object') return [];
    var turn = _currentTurn();
    var staleness = turn - _safeNum(summary.turn);
    if (staleness <= 0 || staleness > 2) return [];  // 仅近 2 回合·避免陈旧
    var skipped = _arr(summary.skippedDetails);
    var merged = _arr(summary.mergedDetails);
    if (!skipped.length && !merged.length) return [];
    var lines = [];
    lines.push('  Last turn (' + staleness + 'T ago) failures. Avoid repeating the same mistake·correct target names / preflight conditions.');
    skipped.slice(0, 6).forEach(function(d) {
      var parts = [d.type || '?'];
      if (d.reason) parts.push('reason=' + _txt(d.reason, 60));
      if (d.target) parts.push('target=' + _txt(d.target, 40));
      lines.push('  SKIP·' + parts.join(' | '));
    });
    merged.slice(0, 3).forEach(function(d) {
      var parts = [d.type || '?'];
      if (d.reason) parts.push('reason=' + _txt(d.reason, 60));
      if (d.firstSource && d.dupSource) parts.push('dup·' + d.firstSource + '+' + d.dupSource);
      lines.push('  MERGE·' + parts.join(' | '));
    });
    return lines;
  }

  // G2-A·敌情心智模型·读对手势力的 aiStrategy·top 3 by threat·让 LLM 预测对手下一步
  function _formatOpponentMindModel(fac) {
    var G = global.GM || {};
    if (!fac || !fac.name || !Array.isArray(G.facs)) return [];
    var myName = fac.name;
    var playerNames = _resolvePlayerFactionNames();
    var candidates = [];
    var myThreats = (fac.aiStrategy && Array.isArray(fac.aiStrategy.threats)) ? fac.aiStrategy.threats : [];
    G.facs.forEach(function(other) {
      if (!other || !other.name || other.name === myName) return;
      if (_isPlayerFaction(other, playerNames)) return;  // 玩家 = 单独的 PLAYER_RECENT 段·不入对手模型
      var score = 0;
      var reasons = [];
      var rel = _arr(G.factionRelations).find(function(r){ return r && r.from === myName && r.to === other.name; });
      if (rel) {
        var v = _safeNum(rel.value);
        if (v <= -50) { score += 80; reasons.push('hostile'); }
        else if (v <= -30) { score += 50; reasons.push('cold'); }
      }
      var inWar = _arr(G.activeWars).some(function(w) {
        var t = _txt(w, 300);
        var sides = _arr(w.sides).concat([w.attacker, w.defender].filter(Boolean)).join('|');
        return (t.indexOf(myName) >= 0 && t.indexOf(other.name) >= 0) || (sides.indexOf(myName) >= 0 && sides.indexOf(other.name) >= 0);
      });
      if (inWar) { score += 100; reasons.push('war'); }
      if (myThreats.indexOf(other.name) >= 0) { score += 60; reasons.push('my-threat'); }
      var theirStrategy = other.aiStrategy;
      if (theirStrategy && Array.isArray(theirStrategy.threats) && theirStrategy.threats.indexOf(myName) >= 0) {
        score += 50; reasons.push('they-threat-me');
      }
      if (theirStrategy && Array.isArray(theirStrategy.objectives)) {
        var attackingMe = theirStrategy.objectives.some(function(o){ return String(o).indexOf(myName) >= 0; });
        if (attackingMe) { score += 40; reasons.push('targeting-me'); }
      }
      if (score >= 30) candidates.push({ fac: other, score: score, reasons: reasons });
    });
    candidates.sort(function(a, b){ return b.score - a.score; });
    candidates = candidates.slice(0, 3);
    if (!candidates.length) return [];
    var lines = [];
    lines.push('  Top opponents (≤3)·mind-model·use to predict their next move and time your own actions / defense.');
    candidates.forEach(function(c, i) {
      var o = c.fac;
      var s = o.aiStrategy || {};
      var head = '  #' + (i + 1) + ' ' + o.name + ' [' + c.reasons.join('+') + ' / score=' + c.score + ']';
      if (s.posture) head += ' posture=' + _txt(s.posture, 20);
      if (s.lastDecision && s.lastDecision.turn) head += ' lastT=' + s.lastDecision.turn;
      if (s.lastDecision && s.lastDecision.rationale) head += ' rationale="' + _txt(s.lastDecision.rationale, 70) + '"';
      lines.push(head);
      if (Array.isArray(s.objectives) && s.objectives.length) {
        lines.push('     objectives·' + _arr(s.objectives).slice(-5).map(function(x){ return _txt(x, 40); }).join(' / '));
      }
      if (Array.isArray(s.threats) && s.threats.length) {
        lines.push('     theirThreats·' + _arr(s.threats).slice(-4).join(' / '));
      }
      if (Array.isArray(s.militaryPlans) && s.militaryPlans.length) {
        lines.push('     militaryPlans·' + _arr(s.militaryPlans).slice(-3).map(function(x){ return _txt(x, 30); }).join(' / '));
      }
      if (Array.isArray(s.alliances) && s.alliances.length) {
        lines.push('     theirAllies·' + _arr(s.alliances).slice(-3).join(' / '));
      }
    });
    lines.push('  ► 用法·若对手 objectives 含本势力名 → 备防或先制·若对手 alliances 含本势力之敌 → 平衡外交·若对手赤字/虚弱 → 趁机施压。');
    return lines;
  }

  // G3-B·盟友心智模型·G2-A 的对称版·top 2-3 盟友·让 LLM 与盟友协调而非独立决策
  function _formatAllyMindModel(fac) {
    var G = global.GM || {};
    if (!fac || !fac.name || !Array.isArray(G.facs)) return [];
    var myName = fac.name;
    var playerNames = _resolvePlayerFactionNames();
    var myAllies = (fac.aiStrategy && Array.isArray(fac.aiStrategy.alliances)) ? fac.aiStrategy.alliances : [];
    var candidates = [];
    G.facs.forEach(function(other) {
      if (!other || !other.name || other.name === myName) return;
      if (_isPlayerFaction(other, playerNames)) return;
      var score = 0;
      var reasons = [];
      var rel = _arr(G.factionRelations).find(function(r){ return r && r.from === myName && r.to === other.name; });
      if (rel) {
        var v = _safeNum(rel.value);
        if (v >= 50) { score += 80; reasons.push('friendly'); }
        else if (v >= 30) { score += 40; reasons.push('warm'); }
      }
      if (myAllies.indexOf(other.name) >= 0) { score += 70; reasons.push('declared-ally'); }
      var theirStrategy = other.aiStrategy;
      if (theirStrategy && Array.isArray(theirStrategy.alliances) && theirStrategy.alliances.indexOf(myName) >= 0) {
        score += 50; reasons.push('they-ally-me');
      }
      // 同敌·共有 threats·算 partial ally
      if (fac.aiStrategy && theirStrategy && Array.isArray(fac.aiStrategy.threats) && Array.isArray(theirStrategy.threats)) {
        var sharedThreats = fac.aiStrategy.threats.filter(function(t){ return theirStrategy.threats.indexOf(t) >= 0; });
        if (sharedThreats.length) { score += 30 + sharedThreats.length * 10; reasons.push('shared-threats:' + sharedThreats.slice(0, 2).join(',')); }
      }
      if (score >= 30) candidates.push({ fac: other, score: score, reasons: reasons });
    });
    candidates.sort(function(a, b){ return b.score - a.score; });
    candidates = candidates.slice(0, 3);
    if (!candidates.length) return [];
    var lines = [];
    lines.push('  Top allies (≤3)·use to coordinate (don\'t duplicate their effort·don\'t act against shared interest).');
    candidates.forEach(function(c, i) {
      var o = c.fac;
      var s = o.aiStrategy || {};
      var head = '  #' + (i + 1) + ' ' + o.name + ' [' + c.reasons.join('+') + ' / score=' + c.score + ']';
      if (s.posture) head += ' posture=' + _txt(s.posture, 20);
      if (s.lastDecision && s.lastDecision.turn) head += ' lastT=' + s.lastDecision.turn;
      if (s.lastDecision && s.lastDecision.rationale) head += ' rationale="' + _txt(s.lastDecision.rationale, 70) + '"';
      lines.push(head);
      if (Array.isArray(s.objectives) && s.objectives.length) {
        lines.push('     theirObjectives·' + _arr(s.objectives).slice(-4).map(function(x){ return _txt(x, 40); }).join(' / '));
      }
      if (Array.isArray(s.threats) && s.threats.length) {
        lines.push('     theirThreats·' + _arr(s.threats).slice(-4).join(' / '));
      }
      if (Array.isArray(s.militaryPlans) && s.militaryPlans.length) {
        lines.push('     theirMilitaryPlans·' + _arr(s.militaryPlans).slice(-3).map(function(x){ return _txt(x, 30); }).join(' / '));
      }
    });
    lines.push('  ► 用法·若盟友已在打共敌·你可包抄 / 钳形·不必正面重叠。若盟友已 fortify·你可放心扩张。若盟友 lastDecision 与本势力相反·应外交沟通·或调整自己。');
    return lines;
  }

  // G3-C·决策风格趋势·读 fac.aiStyleTrajectory·近 5 回合·算趋势 rising/falling/stable·提示 LLM 保持/纠偏
  function _formatDecisionStyleTrend(fac) {
    var traj = fac && fac.aiStyleTrajectory;
    if (!Array.isArray(traj) || traj.length < 2) return [];
    var lines = [];
    var last = traj[traj.length - 1];
    var first = traj[0];
    function trendLabel(prev, cur) {
      var d = cur - prev;
      if (Math.abs(d) < 10) return 'stable';
      return d > 0 ? 'rising' : 'falling';
    }
    function classify(score, dims) {
      // dims·["aggressiveness","passive"]·return label by threshold
      if (score >= 70) return dims[0] + '-extreme';
      if (score >= 50) return dims[0];
      if (score >= 30) return 'mixed';
      return dims[1];
    }
    lines.push('  Your decision style over last ' + traj.length + ' turns (T' + first.turn + '→T' + last.turn + ')·use to detect inconsistency·不要 today 鹰派 / tomorrow 鸽派。');
    lines.push('  aggressiveness·当前 ' + last.aggressiveness + '·' + trendLabel(first.aggressiveness, last.aggressiveness) + ' (' + classify(last.aggressiveness, ['鹰派', '鸽派']) + ')');
    lines.push('  riskTaking·当前 ' + last.riskTaking + '·' + trendLabel(first.riskTaking, last.riskTaking) + ' (' + classify(last.riskTaking, ['冒险', '保守']) + ')');
    lines.push('  fiscalDiscipline·当前 ' + last.fiscalDiscipline + '·' + trendLabel(first.fiscalDiscipline, last.fiscalDiscipline) + ' (' + classify(last.fiscalDiscipline, ['紧缩', '放任']) + ')');
    lines.push('  expansionism·当前 ' + last.expansionism + '·' + trendLabel(first.expansionism, last.expansionism) + ' (' + classify(last.expansionism, ['扩张', '守成']) + ')');
    // 一致性检查·近 3 回合方差超 30 = inconsistent
    if (traj.length >= 3) {
      var aggs = traj.slice(-3).map(function(r){ return r.aggressiveness; });
      var aggMax = Math.max.apply(null, aggs), aggMin = Math.min.apply(null, aggs);
      if (aggMax - aggMin > 30) {
        lines.push('  ⚠ aggressiveness 近 3 回合波动 ' + (aggMax - aggMin) + ' 分·风格不一致·本回合宜延续上回合方向 (除非有明确局势触发)。');
      }
    }
    return lines;
  }

  // G2-B·财政成本对齐·让 LLM 把"100k 银的购买力"列入考量
  function _formatFiscalContext(fac) {
    if (!fac) return [];
    var t = fac.treasury || {};
    var de = fac.derivedEconomy || {};
    var monthlyMil = _safeNum(de.annualMilitaryCost) / 12;
    var annualTax = _safeNum(de.annualTaxIncome);
    var net = _safeNum(de.netFlow);
    var money = _safeNum(t.money);
    if (!annualTax && !monthlyMil && !money) return [];
    var lines = [];
    lines.push('  Cost-awareness·算几个比率·决策时把"现在花 X 万贵不贵"列入考量·禁穷势力大赏 / 富势力欠饷。');
    if (money && monthlyMil > 0) {
      var months = Math.round(money / monthlyMil * 10) / 10;
      lines.push('  treasury_runway·国库 ' + Math.round(money / 1000) + 'k 银·按月军费 ' + Math.round(monthlyMil / 1000) + 'k 算·可支 ' + months + ' 月');
    }
    if (annualTax && monthlyMil > 0) {
      var mil_pct = Math.round(monthlyMil * 12 / annualTax * 100);
      lines.push('  military_burden·年军费 ' + mil_pct + '% 年税·' + (mil_pct >= 100 ? '入不敷出·不可持续' : (mil_pct >= 70 ? '吃紧' : '可控')));
    }
    if (annualTax > 0) {
      var rwd10 = Math.round(100000 / annualTax * 1000) / 10;
      var rwd100 = Math.round(1000000 / annualTax * 100);
      lines.push('  reward_cost_hint·一次赏 10万 = 年税 ' + rwd10 + '%·100万 = ' + rwd100 + '%·决策前估算 treasuryDelta 占年税比');
    }
    if (net !== 0 && annualTax > 0) {
      var sev = Math.round(Math.abs(net) / annualTax * 100);
      lines.push('  deficit_status·' + (net < 0 ? '赤字 ' + sev + '%·须紧缩' : '盈余 ' + sev + '%·可投资'));
    }
    var warnings = [];
    if (money && monthlyMil > 0 && money / monthlyMil < 6) {
      warnings.push('runway < 6 月·本回合优先 fiscal_policy 增收 (减俸 / 加税)·或 diplomacy 求和·避免 大赏 / 大兴');
    }
    if (net < 0 && annualTax > 0 && Math.abs(net) > annualTax * 0.2) {
      warnings.push('赤字 > 20% 年税·禁 reward_distribution / 加禄·应 减俸 / 紧缩支出·或加税 (代价民心 -)');
    }
    if (money > 0 && net > 0 && annualTax > 0 && net > annualTax * 0.3) {
      warnings.push('盈余 > 30%·可用于 military 加饷 (士气 +) / fortifications (防御 +) / 民生 (民心 +)·与其闲置不如投资');
    }
    warnings.forEach(function(w){ lines.push('  ⚠ ' + w); });
    return lines;
  }

  // G2-C·主君内核·读 ruler 的 coreMotivations/redLines/personalGrudges·剧本未定义则 skip
  function _formatRulerPsyche(fac, ruler) {
    if (!ruler) return [];
    var lines = [];
    var has = false;
    function push(label, val, max) {
      if (val == null) return;
      if (Array.isArray(val) && val.length) {
        has = true;
        lines.push('  ' + label + '·' + val.slice(0, 3).map(function(x){ return _txt(x, 100); }).join(' / '));
      } else if (typeof val === 'string' && val.trim()) {
        has = true;
        lines.push('  ' + label + '·' + _txt(val, max || 200));
      }
    }
    push('coreMotivations·核心动机 (决策内核·所有 action 应一致)', ruler.coreMotivations, 200);
    push('redLines·红线 (任何 action 都不可触·包括 SC16 directive 要求时)', ruler.redLines, 200);
    push('personalGrudges·个人恩怨 (针对 char / fac·影响 office_change / diplomacy 偏向)', ruler.personalGrudges, 200);
    if (!has) return [];
    lines.unshift('  Ruler psyche·主君不可逾越的内核·若 SC16 / 局势要求违反 redLines·rationale 须说明权衡 (通常·应拒绝)。');
    return lines;
  }

  // 段 3·上回合 SC16 采纳率·读 fac._lastLlmApplySummary.sc16Compliance (F2 写)
  function _formatLastTurnCompliance(fac) {
    var summary = fac && fac._lastLlmApplySummary;
    if (!summary || !summary.sc16Compliance) return [];
    var c = summary.sc16Compliance;
    if (!c.hasDirectContent) return [];  // 仅当上回合 SC16 给过实质指令
    var turn = _currentTurn();
    var staleness = turn - _safeNum(summary.turn);
    if (staleness <= 0 || staleness > 1) return [];  // 仅紧邻上回合
    var lines = [];
    lines.push('  Last turn SC16 directive compliance. Review what you ignored — SC16 directives reflect strategic intent·repeated 忽视会被 cooldown 降优先级。');
    lines.push('  score·' + (c.complianceScore || 0) + '%·' + (c.adoptedCount || 0) + '/' + (c.directiveCount || 0) + ' adopted');
    _arr(c.ignoredItems).slice(0, 4).forEach(function(it) {
      lines.push('  IGNORED·[' + (it.type || '?') + '] ' + _txt(it.summary, 70) + (it.target ? ' (target=' + _txt(it.target, 30) + ')' : ''));
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
    // G1·2026-05-22·智力反喂 3 段·必须在世界态势 / SC16 / 候选目标之前·让 LLM 先看见"自己的过去"再读"当前局面"
    _pushSection(extra, 'OWN_STRATEGIC_MEMORY', _formatOwnStrategicMemory(fac));
    // ③-S2 前瞻式目标栈（开关 P.conf.factionGoalStackEnabled·默认关·关=本段不注入·prompt 等同现状）
    if (global.P && (typeof agentFlagOn==='function' ? agentFlagOn('factionGoalStackEnabled') : (P.conf && P.conf.factionGoalStackEnabled)) && global.TM && global.TM.FactionGoalStack && typeof global.TM.FactionGoalStack.formatForPrompt === 'function') {
      try {
        var _goalTxt = global.TM.FactionGoalStack.formatForPrompt(fac);
        if (_goalTxt) _pushSection(extra, 'ACTIVE_GOALS', String(_goalTxt).split('\n').filter(function(x){ return x && x.trim(); }));
      } catch(_goalE) {}
    }
    // B方案 S2·跨场景：注入近期廷议朝堂博弈·让势力决策感知朝堂权力消长(开关 courtDebateEnabled·默认关·打通"廷议博弈→势力决策"链路)
    if (global.P && (typeof agentFlagOn==='function' ? agentFlagOn('courtDebateEnabled') : (P.conf && P.conf.courtDebateEnabled)) && typeof _formatCourtDebateMemory === 'function') {
      _pushSection(extra, 'COURT_DEBATE_RECENT', _formatCourtDebateMemory());
    }
    // 【势力 agent 社会·双向外交 S1】注入其他势力向本派提出的外交动议·让其按自己目标/宿怨/姿态回应(开关 factionAgentEnabled·默认关)
    if (global.P && (typeof agentFlagOn==='function' ? agentFlagOn('factionAgentEnabled') : (P.conf && P.conf.factionAgentEnabled)) && global.TM && global.TM.FactionDiplomacy) {
      _pushSection(extra, 'INCOMING_PROPOSALS', global.TM.FactionDiplomacy.formatIncomingProposals(fac, _currentTurn()));
      // 【S3】注入君上(玩家)对本派近期递交之议的答复(已纳/见拒)·让势力据真实结果调整对君策·非仅邦交 delta 间接推
      if (typeof global.TM.FactionDiplomacy.formatPlayerProposalOutcomes === 'function') {
        _pushSection(extra, 'PLAYER_PROPOSAL_OUTCOMES', global.TM.FactionDiplomacy.formatPlayerProposalOutcomes(fac, _currentTurn()));
      }
    }
    // G3-C·决策风格趋势·紧跟 strategic memory·一组成"自我感知"
    _pushSection(extra, 'DECISION_STYLE_TREND', _formatDecisionStyleTrend(fac));
    _pushSection(extra, 'LAST_TURN_FAILURES', _formatLastTurnFailures(fac));
    _pushSection(extra, 'LAST_TURN_COMPLIANCE', _formatLastTurnCompliance(fac));
    // G2·2026-05-22·智力 Tier 2 加深 3 段·敌情心智 + 财政成本 + 主君内核
    _pushSection(extra, 'RULER_PSYCHE', _formatRulerPsyche(fac, ruler));
    _pushSection(extra, 'OPPONENT_MIND_MODEL', _formatOpponentMindModel(fac));
    // G3-B·盟友心智·紧跟 OPPONENT·让 LLM 一组成"外部关系网"
    _pushSection(extra, 'ALLY_MIND_MODEL', _formatAllyMindModel(fac));
    _pushSection(extra, 'FISCAL_CONTEXT', _formatFiscalContext(fac));
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
    _pushSection(extra, 'BORDER_INTEL', _formatBorderIntel(fac));
    _pushSection(extra, 'BUILD_OPPORTUNITIES', _formatBuildOpportunities(fac));   // S5·NPC 自主营建机宜(本派各地建筑之需)
    _pushSection(extra, 'CHAR_MEMORY', _formatCharacterMemory(alive));
    _pushSection(extra, 'WORLD_STATUS', _formatWorldStatus(fac));
    // 官制活化 Slice①：职权舆图（势力决策侧感知·开 officePowerPerceptionEnabled 时注入·关则零回归·非核心段·core/工具模式走按需取）
    try {
      if (typeof officeFlagOn === 'function' && officeFlagOn('officePowerPerceptionEnabled') && typeof buildOfficePowerMap === 'function') {
        var _opmFac = buildOfficePowerMap(global.GM, { cap: 10 });
        if (_opmFac) _pushSection(extra, 'OFFICE_POWER_MAP', String(_opmFac).split('\n'));
      }
    } catch (_opmErr) {}
    if (extra.length > 0) {
      sys += '\n\nAI_DECISION_CONTEXT:';
      sys += extra.join('\n');
      sys += '\n以上情报均为势力本回合决策依据：优先尊重近事、史记、玩家诏令、势力旧账、战事关系与人物记忆；不要只按当前数值面板机械出招。';
      sys += '\n**特别注意**·若有 OWN_STRATEGIC_MEMORY 段·你的决策须维持战略连续性·勿凭空换主线 (除非世界态势剧变·需在 rationale 说明)。若有 LAST_TURN_FAILURES 段·必须修正其中的错误目标 / 名称·勿重复同一失败。若有 LAST_TURN_COMPLIANCE 段·权衡上回合无视的 SC16 指令·若仍认为不该执行·应在 rationale 给理由·否则本回合宜采纳。';
      sys += '\n**Tier 2**·若有 RULER_PSYCHE 段·redLines 不可碰·coreMotivations 决定主线方向·personalGrudges 影响 office / diplomacy 倾向。若有 OPPONENT_MIND_MODEL 段·应预测对手下一步并提前部署 (rationale 提及对手意图)。若有 FISCAL_CONTEXT 段·所有 fiscal/reward action 须考虑 runway / deficit·穷势力禁大赏·盈余势力应投资。';
      sys += '\n**Tier 3**·若有 DECISION_STYLE_TREND 段·须 (a) 保持当前 style 一致性 (除非世界态势剧变·rationale 说明转向理由)·(b) 若 ⚠ 波动警告触发·本回合应延续上回合方向。若有 ALLY_MIND_MODEL 段·应与盟友协调·不重复其 effort·共敌时分工 (e.g., 盟友主攻则本势力侧翼或后勤)。rationale 必须按 Phase 1/2/(3) 写·每 phase 含 cause·shopping list 式罗列动作视为不合格。';
    }

    // F1·2026-05-22·单轨 actions[]·删 legacy memorials/edict/chaoyi/office 字段·所有动作走 actions[]
    // G3-A·2026-05-22·rationale 升级为 phase 计划结构·shopping list → 因果叙事
    user += '{\n';
    user += '  "rationale": "主君考量·80-250 字·须含因果链·格式·Phase 1·X (cause: 何故而做)。Phase 2·Y (因 X 后果·或对 X 失败的补救)。Phase 3·Z (后续预防 / 长期承接·可选)。每 phase 必明 action_type + target·若只有一 phase 则只写 Phase 1·不可省略 cause 描述。",\n';
    user += '  "actions": [ ...本回合所有动作·0-8 条·每条按下表填字段 ]';
    if (global.P && (typeof agentFlagOn==='function' ? agentFlagOn('factionGoalStackEnabled') : (P.conf && P.conf.factionGoalStackEnabled))) {
      user += ',\n  "goalUpdates": { "advance":[{"id":"<ACTIVE_GOALS 中的目标 id>","stepDone":true,"note":"<本回合进展>"}], "resolve":[{"id":"<目标 id>","status":"achieved|failed|abandoned"}], "newGoals":[{"desc":"<新目标·勿与现有重复>","horizon":"long|short","steps":[{"desc":"<分步>"}],"priority":0}] }';
    }
    if (global.P && (typeof agentFlagOn==='function' ? agentFlagOn('factionAgentEnabled') : (P.conf && P.conf.factionAgentEnabled))) {
      user += ',\n  "posture": "本势力当前战略姿态(2-6字·如 扩张/守成/隐忍/结盟/孤立/复仇/观望/决战/称霸)·应随局势演进·若较上回合转变须在 rationale 说明因由"';
      user += ',\n  "proposals": [ {"toFaction":"<目标势力名·可含玩家方>","type":"alliance|nonaggression|deal|joint_action|ultimatum|peace","terms":"<条款·40字>","rationale":"<为何向其提此议·30字>"} ]·0-3 条·仅当确有外交意图主动向他派(或玩家)提议·不必每回合都提';
      user += ',\n  "proposalResponses": [ {"from":"<INCOMING_PROPOSALS 中提议来源势力名>","decision":"accept|reject|counter","reason":"<按你自己目标/宿怨/姿态权衡·30字>","counterTerms":"<若 counter 才填·还价条款·40字>"} ]·逐条回应 INCOMING_PROPOSALS 段中收到的提议·无收到则空数组';
      user += ',\n  "builds": [ {"territory":"<本派地块名·须 BUILD_OPPORTUNITIES 或 OWN_ADMIN_HIERARCHY 中真实地块>","name":"<工役名·如 镇边堡/府学/屯田所>","category":"military|economic|cultural|administrative","feasibility":"合理|勉强","costActual":<两>,"timeActual":<回合>,"effectsStructured":{"abs":{"defenseBonus":1}},"judgedEffects":"<效用>","reason":"<为何此地建此>"} ]·0-2 条·仅当本派某地确有营建之需(BUILD_OPPORTUNITIES 所列·边警高筑防/官缺重兴学/田邑垦田)·效果只许白名单字段(defenseBonus/officialSupply/economyBase.*/fortLevel 等)·勿每回合都建';   // S5·NPC 自主营建
    }
    user += '\n}\n';
    user += '\n动作字段速查 (10 种 type·完整 required/optional 见 ACTION_CONTRACT 段):';
    user += '\n  type ∈ {memorial|edict|court_alignment|office_change|fiscal_policy|military_order|diplomacy|province_policy|spy_or_intrigue|rebellion_policy}';
    user += '\n  memorial         {from, type:"军务|政务|民生|经济|人事|密奏", content(60-120 字古文), rulerDecision:"approved|rejected|annotated|referred", ruling(10-30 字), loyaltyDelta:-5至5}';
    user += '\n  edict            {type:"催征|减俸|补饷|整军|安抚|罢党争|怀柔|赏赐|巡抚|经略", content(60-120 字古文), trigger, treasuryDelta:-500000至500000, loyaltyDeltas:{court,general,clan}:-15至15}';
    user += '\n  court_alignment  {type:"cooperate|attack|compromise|infight", summary(20-50 字), partyImbalanceDelta:-0.2至0.2, loyaltyDeltaByParty:{partyName:-5至5}}';
    user += '\n  office_change    {kind:"promote|demote|appoint", target, newPosition(paradigm 头衔), loyaltyDelta:-10至10, reason}';
    user += '\n  fiscal_policy    {resource:"money|grain|cloth", treasuryDelta, incomeDelta, expenseDelta, reason}';
    user += '\n  military_order   {army, order:"change_commander|move|reinforce|train", commander, destination, soldiersDelta, moraleDelta, trainingDelta, reason}';
    user += '\n  diplomacy        {targetFaction, relationDelta:-100至100, relationType, treaty, durationTurns, reason}';
    user += '\n  province_policy  {province, policy:"transfer_owner|pacify|extract|reform", ownerFaction, minxinDelta, corruptionDelta, unrestDelta, taxDelta, reason}';
    user += '\n  spy_or_intrigue  {targetFaction, intrigue:"spread_rumor|bribe|sabotage", relationDelta, pressure, reason}';
    user += '\n  rebellion_policy {targetFaction, policy:"incite|sponsor|pacify", support, reason}';
    user += '\n约束: 单轨 actions[]·不要再用 memorials/edict/chaoyi/office 顶层字段 (已废)·所有动作放 actions[]。type/enum 必须用给定值·content 必须中文古文风。';
    user += '\nTARGET RULE: char/army/province/faction names must come from ACTION_CANDIDATES or the visible context above. Prefer concrete actions[] that operationalize SC16_WORLD_DIRECTIVE; do not invent invisible characters or armies.';
    user += '\nLIMITS: actions[] 长度 0-8·宁少勿多·空数组也允许。';
    if (global.P && (typeof agentFlagOn==='function' ? agentFlagOn('factionGoalStackEnabled') : (P.conf && P.conf.factionGoalStackEnabled))) {
      user += '\nGOALS: 见 ACTIVE_GOALS 段·连贯推进既有目标(每回合通常 advance 一步)·达成则 resolve·世界剧变才 newGoals(≤1/回合)·goalUpdates.id 必须用 ACTIVE_GOALS 中真实 id·与 actions/rationale 保持一致。';
    }

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
    if (!n) n = 6000;
    return Math.max(1200, Math.min(12000, Math.floor(n)));
  }

  function _looksLikeTruncatedLlmOutput(raw, maxTokens) {
    var s = String(raw || '');
    if (!s) return false;
    var trimmed = s.replace(/\s+$/g, '');
    var open = (trimmed.match(/\{/g) || []).length;
    var close = (trimmed.match(/\}/g) || []).length;
    if (open > close) return true;
    if (/[:,\["]$/.test(trimmed)) return true;
    if (trimmed.charAt(0) === '{' && trimmed.charAt(trimmed.length - 1) !== '}') return true;
    return trimmed.length > Math.max(900, Math.floor((maxTokens || 1200) * 0.75)) && close === 0;
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
    var lastRawLength = 0;
    var lastPossibleTruncation = false;
    var failureKind = 'parse';
    for (var i = 0; i < attempts; i++) {
      try {
        var promptText = combined;
        if (i > 0) promptText += '\n\nFORMAT_ERROR_RETRY: 上次输出无法解析为 strict JSON。请只返回一个 JSON object，不要 markdown，不要解释。错误: ' + lastError;
        if (i > 0 && lastPossibleTruncation) promptText += '\nTRUNCATION_RETRY: previous output looked cut off. Return a shorter but complete JSON object; trim narrative/summary/reason fields first.';
        var raw = await _withTimeout(global.callAI(promptText, maxTokens, null, 'secondary', {
          priority: 'background',
          timeoutMs: timeoutMs || undefined,
          maxRetries: 1
        }), timeoutMs);
        lastRawPreview = String(raw || '').slice(0, 1200);
        lastRawLength = String(raw || '').length;
        lastPossibleTruncation = _looksLikeTruncatedLlmOutput(raw, maxTokens);
        if (!raw) { lastError = 'empty response'; failureKind = 'empty'; continue; }
        var parsed = _parseDecisionJson(raw);
        if (parsed) return { parsed:parsed, diagnostics:{ kind:'ok', attempts:i + 1, maxTokens:maxTokens } };
        lastError = 'no JSON object in response';
        failureKind = lastPossibleTruncation ? 'truncated_json' : 'parse';
      } catch (e) {
        lastError = (e && e.message) || String(e || 'parse failed');
        failureKind = lastPossibleTruncation ? 'truncated_json' : (/timeout/i.test(lastError) ? 'timeout' : 'call_or_parse');
        try { console.warn('[npc-llm-decision] parse/call failed attempt ' + (i + 1), lastError); } catch(_){}
      }
    }
    return { parsed:null, diagnostics:{ kind:failureKind, error:lastError, rawPreview:lastRawPreview, rawLength:lastRawLength, possibleTruncation:lastPossibleTruncation, attempts:attempts, maxTokens:maxTokens } };
  }

  // ─── 【A·按需取数 S2】tool-calling 决策路径(开关 factionToolDecisionEnabled·默认关·关时本段完全不执行) ───
  // 核心 prompt(8 核心段+2 外交段)+ 6 工具 → 势力按需查 → 第二轮出决策·返回与 _callLLMDecision **同形** {parsed,diagnostics}(drop-in)·任何缺件/异常/解析失败一律回落原单发(保决策不丢)
  function _buildPromptCore(fac) {
    _promptBuildMode = 'core';
    var p;
    try { p = _buildPrompt(fac); } finally { _promptBuildMode = 'full'; }  // 同步无 await·set→build→reset 原子·并发安全
    p.system += '\n\nTOOLS_USAGE: 上面 AI_DECISION_CONTEXT 只含核心情报(战略记忆/目标/可选行动/邦交战事/财政/君主/世界态势)。其余情报(对手心智·朝堂博弈·我方往绩·世界细况·我方家底·历史先例)未给·你可调用工具按需补取。先调你这回合真正需要的工具(最多 4 个·不需要则一个都不调·直接出决策)·拿到后再输出决策 JSON。勿重复查 AI_DECISION_CONTEXT 已有的。';
    return p;
  }

  function _factionToolCtx(fac) {
    var entry = (global.GM && global.GM._facIndex && global.GM._facIndex[fac.name]) || null;
    var alive = (entry && entry.chars) ? entry.chars.filter(function (c) { return c.alive !== false; }) : [];
    function _safe(fn) { return function () { try { return fn.apply(null, arguments); } catch (e) { return ''; } }; }
    return {
      fac: fac, alive: alive,
      formatters: {
        opponentMindModel: _safe(function (f) { return _formatOpponentMindModel(f); }),
        allyMindModel: _safe(function (f) { return _formatAllyMindModel(f); }),
        courtDebate: _safe(function () { return (typeof _formatCourtDebateMemory === 'function') ? _formatCourtDebateMemory() : ''; }),
        worldDirective: _safe(function (f) { return _formatSc16DirectiveForFac(f); }),
        lastTurnFailures: _safe(function (f) { return _formatLastTurnFailures(f); }),
        lastTurnCompliance: _safe(function (f) { return _formatLastTurnCompliance(f); }),
        decisionStyleTrend: _safe(function (f) { return _formatDecisionStyleTrend(f); }),
        factionTrajectory: _safe(function (f) { return _formatFactionTrajectory(f); }),
        recentWorld: _safe(function (f) { return _formatRecentWorld(f.name); }),
        playerRecent: _safe(function () { return _formatPlayerRecent(); }),
        worldStatus: _safe(function (f) { return _formatWorldStatus(f); }),
        ownAdminHierarchy: _safe(function (f) { return _formatOwnAdminHierarchy(f); }),
        militaryContext: _safe(function (f) { return _formatMilitaryContext(f); }),
        fiscalContext: _safe(function (f) { return _formatFiscalContext(f); }),
        // 官制 agent 化·query_office 按需取数(返 duties 职责描述·复用 queryOfficeDetail·query 签名同 recall·查当前 GM.officeTree 含玩家本回合任免/拟制改制·不脱节)
        officeQuery: function (query) {
          var qod = global.queryOfficeDetail;
          return (typeof qod === 'function') ? qod(global.GM, String(query || '').trim()) : '';
        },
        // 【S3】query-aware·复用②(TM.MemoryAgentTools.exec 'recall_by_term')做真检索·无②/无命中/异常→回落人物记忆(返回 Promise·handle 已 await)
        recall: function (query, c) {
          var q = String(query || '').trim();
          var mat = global.TM && global.TM.MemoryAgentTools;
          var _fallback = function () { return (typeof _formatCharacterMemory === 'function') ? _formatCharacterMemory(c && c.alive) : ''; };
          if (!q || !mat || typeof mat.exec !== 'function') return _fallback();
          return Promise.resolve(mat.exec('recall_by_term', { terms: [q], limit: 6 }, global.GM)).then(function (r) {
            if (r && r.ok && Array.isArray(r.hits) && r.hits.length) {
              return r.hits.slice(0, 6).map(function (h) {
                var t = (h && (h.text || h.summary || h.title || h.content || h.desc)) || '';
                return '· ' + String(t).slice(0, 120) + (h && h.turn ? ' (T' + h.turn + ')' : '');
              }).join('\n');
            }
            return _fallback();
          }).catch(_fallback);
        }
      }
    };
  }

  // 【S3·观测】滚动记录工具路径每次决策的轮数/查询数/工具名(供真机看 A 的实际行为与成本·cap 40)
  function _recordFacToolStat(facName, rounds, toolCalls, toolNames) {
    try {
      var GM = global.GM; if (!GM) return;
      if (!Array.isArray(GM._factionToolStats)) GM._factionToolStats = [];
      GM._factionToolStats.push({ turn: _currentTurn(), fac: facName, rounds: rounds, toolCalls: toolCalls, tools: toolNames || [] });
      if (GM._factionToolStats.length > 40) GM._factionToolStats = GM._factionToolStats.slice(-40);
    } catch (e) {}
  }

  async function _decideViaTools(fac, opts) {
    opts = opts || {};
    // 缺件兜底：工具基础设施未就绪 → 回落原单发(不因缺件而崩)
    if (typeof global.callAIWithTools !== 'function' || !(global.TM && global.TM.FactionDecisionTools)) {
      return _callLLMDecision(_buildPrompt(fac), opts);
    }
    var maxTokens = _precisionMaxTokens(opts);
    var timeoutMs = _safeNum(opts.timeoutMs || (global.P && P.conf && P.conf.npcAiPrecisionTimeoutMs)) || 0;
    try {
      var core = _buildPromptCore(fac);
      var combined = core.system + '\n\n' + core.user;
      var defs = global.TM.FactionDecisionTools.defs();
      var ctx = _factionToolCtx(fac);
      // 第一轮：核心 prompt + 工具(势力自取所需)·【S3】id 供 TokenUsageTracker 按 id 记账
      var r1 = await _withTimeout(global.callAIWithTools(combined, defs, {
        maxTok: maxTokens, tier: 'secondary', priority: 'background', maxRetries: 1, timeoutMs: timeoutMs || undefined, allowText: true, id: 'faction_tool:r1'
      }), timeoutMs);
      var toolCalls = (r1 && Array.isArray(r1.toolCalls)) ? r1.toolCalls.slice(0, 4) : [];  // 护栏 ≤4/势力
      if (!toolCalls.length) {
        // 未查工具 → r1.text 即决策 JSON(简单回合·1 轮即出·更省)
        var p0 = _parseDecisionJson((r1 && r1.text) || '');
        if (p0) { _recordFacToolStat(fac.name, 1, 0, []); return { parsed: p0, diagnostics: { kind: 'ok', via: 'tools', rounds: 1, toolCalls: 0, maxTokens: maxTokens } }; }
        return _callLLMDecision(_buildPrompt(fac), opts);  // 既没查也没给 JSON → 回落原单发
      }
      // 执行工具·收集结果(handle 已 async·须 await·注入真 _format*/②recall)
      var toolResultText = '', _toolNames = [];
      for (var _ti = 0; _ti < toolCalls.length; _ti++) {
        var _tc = toolCalls[_ti] || {};
        if (!_tc.name) continue;
        var _res = await global.TM.FactionDecisionTools.handle(_tc.name, _tc.input || {}, ctx);
        toolResultText += '\n\n【工具·' + _tc.name + '】\n' + ((_res && _res.text) || '(无)');
        _toolNames.push(_tc.name);
      }
      // 第二轮：核心 + 工具结果 → 出决策(单发·复用 callAI)·【S3】id 记账
      var round2 = combined + '\n\n你已按需查得以下补充情报：' + toolResultText + '\n\n现综合全部情报·只返回决策 JSON(格式如上·不要 markdown 不要解释)。';
      var raw2 = await _withTimeout(global.callAI(round2, maxTokens, null, 'secondary', {
        priority: 'background', maxRetries: 1, timeoutMs: timeoutMs || undefined, id: 'faction_tool:r2'
      }), timeoutMs);
      var p2 = _parseDecisionJson(raw2);
      if (p2) { _recordFacToolStat(fac.name, 2, _toolNames.length, _toolNames); return { parsed: p2, diagnostics: { kind: 'ok', via: 'tools', rounds: 2, toolCalls: _toolNames.length, maxTokens: maxTokens } }; }
      return _callLLMDecision(_buildPrompt(fac), opts);  // 第二轮没解析出 → 回落原单发(保决策不丢)
    } catch (e) {
      try { console.warn('[npc-llm-decision·tools] fallback to single-shot:', (e && e.message) || e); } catch (_) {}
      return _callLLMDecision(_buildPrompt(fac), opts);  // 任何异常 → 回落原单发
    }
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
    // F0·2026-05-22·fallback path 应已死 (action-engine 在 index.html 中先于 decision 加载)·warn 一次以便回收
    try { console.warn('[npc-llm-decision] _validateDecision fallback fired·FactionActionEngine missing — please report'); } catch(_){}
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
    // F0·2026-05-22·fallback path 应已死 (action-engine 在 index.html 中先于 decision 加载)·warn 一次以便回收
    try { console.warn('[npc-llm-decision] _normalizeDecisionActions fallback fired·FactionActionEngine missing — please report'); } catch(_){}
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
    // F0·2026-05-22·~260 行 fallback 应已死 (action-engine 在 index.html 中先于 decision 加载)·warn 一次以便回收·下个 sprint 评估删除
    try { console.warn('[npc-llm-decision] _applyDecision fallback fired·FactionActionEngine missing — please report'); } catch(_){}
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

    // 【A·按需取数 S2】开关开→工具路径(势力按需取数·2轮)·关→原单发(下两行字节不变·零回归)
    var callResult;
    if (global.P && (typeof agentFlagOn === 'function' ? agentFlagOn('factionToolDecisionEnabled') : (P.conf && P.conf.factionToolDecisionEnabled))) {
      callResult = await _decideViaTools(fac, opts);
    } else {
      var prompts = _buildPrompt(fac);
      callResult = await _callLLMDecision(prompts, opts);
    }
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
    // ③-S3 闭环：消费 LLM 报告的 goalUpdates·更新前瞻式目标栈（开关 P.conf.factionGoalStackEnabled·默认关）
    if (global.P && (typeof agentFlagOn==='function' ? agentFlagOn('factionGoalStackEnabled') : (P.conf && P.conf.factionGoalStackEnabled)) && global.TM && global.TM.FactionGoalStack && decision && decision.goalUpdates) {
      try {
        var _gu = global.TM.FactionGoalStack.applyUpdates(fac, decision.goalUpdates, _currentTurn());
        if (summary && typeof summary === 'object') summary.goalUpdates = _gu;
      } catch (_guE) {}
    }
    // 【势力 agent 社会·双向外交 S1】先回应收到的提议(结盟/结怨/还价)·再发起本派新提议(存目标派·跨回合)·开关 factionAgentEnabled·默认关·零额外调用(骑本次决策)
    if (global.P && (typeof agentFlagOn==='function' ? agentFlagOn('factionAgentEnabled') : (P.conf && P.conf.factionAgentEnabled)) && global.TM && global.TM.FactionDiplomacy && decision) {
      try {
        if (Array.isArray(decision.proposalResponses) && decision.proposalResponses.length) global.TM.FactionDiplomacy.applyResponses(fac, decision.proposalResponses, _currentTurn());
        if (Array.isArray(decision.proposals) && decision.proposals.length) {
          var _dp = global.TM.FactionDiplomacy.recordProposals(fac.name, decision.proposals, _currentTurn());
          if (summary && typeof summary === 'object') summary.diplomacy = _dp;
        }
      } catch (_dpE) {}
    }
    // S5·NPC 自主营建（+完善）：本派据地方之需自主兴造 + 自修半损建筑(骑本次决策·零额外调用·开关 factionAgentEnabled·默认关)。
    //   新建读 raw.builds(未校验·绕开 validateDecision·同 proposals/goalUpdates)·落本派叶过既有工期 tick·扣本派库银·谍报可观测。
    if (global.P && (typeof agentFlagOn==='function' ? agentFlagOn('factionAgentEnabled') : (P.conf && P.conf.factionAgentEnabled))) {
      try {
        if (raw && Array.isArray(raw.builds) && raw.builds.length) {
          var _lb = _landFactionBuilds(fac, raw.builds);
          if (_lb && summary && typeof summary === 'object') summary.builds = _lb;
        }
        var _rp = _repairFactionBuildings(fac);                              // 完善·自修半损建筑(闭 S6 损坏循环·独立于本回合是否新建)
        if (_rp && summary && typeof summary === 'object') summary.repaired = _rp;
      } catch (_lbE) {}
    }
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
      goalStack: (fac && fac.aiStrategy && Array.isArray(fac.aiStrategy.goals)) ? fac.aiStrategy.goals.slice() : [],
      lastRationale: fac && fac._lastLlmRationale || null,
      lastApplySummary: fac && fac._lastLlmApplySummary || null,
      qijuWrites: qijuWrites.slice(-12)
    };
  }

  // F3·2026-05-22·全局 NPC LLM 状态聚合·跨势力总览·诊断面板用
  function getGlobalNpcLlmStatus() {
    var G = global.GM || {};
    var turn = _safeNum(G.turn) || _currentTurn();
    var settings = {};
    try {
      if (global.TM && TM.FactionNpcSettings && typeof TM.FactionNpcSettings.getStatus === 'function') {
        settings = TM.FactionNpcSettings.getStatus() || {};
      }
    } catch(_){}
    var dispatch = G._npcFactionLlmDispatchLedger || null;
    var dispatchStats = (dispatch && dispatch.stats) ? Object.assign({}, dispatch.stats) : { scheduled:0, running:0, applied:0, partial:0, noAction:0, skipped:0, failed:0, canceled:0 };
    var allJobs = _arr(dispatch && dispatch.jobs);
    var runs = (G._npcFactionLlmLedger && G._npcFactionLlmLedger.runs) || {};
    var pickLog = _arr(G._npcFactionLlmPickLog).slice(-10).reverse();
    var candRows = _arr(G._npcFactionLlmCandidateRanks && G._npcFactionLlmCandidateRanks.rows).slice(0, 8);
    var playerFacNames = _resolvePlayerFactionNames();

    // perFacStatus·每个 NPC 势力的 last apply summary + run status
    var perFacStatus = [];
    _arr(G.facs).forEach(function(f) {
      if (!f || !f.name || _isPlayerFaction(f, playerFacNames)) return;
      var run = runs[f.name] || null;
      var statusLabel = 'idle';
      if (run) {
        if (run.status === 'applied') statusLabel = 'applied';
        else if (run.status === 'failed') statusLabel = 'failed';
        else if (run.status === 'running') statusLabel = 'running';
        else if (run.status === 'skipped') statusLabel = 'skipped';
      }
      var sc = (f._lastLlmApplySummary && f._lastLlmApplySummary.sc16Compliance) || null;
      perFacStatus.push({
        faction: f.name,
        status: statusLabel,
        lastTurn: run ? (run.turn || run.lastTurn || 0) : 0,
        appliedActions: (f._lastLlmApplySummary && f._lastLlmApplySummary.appliedActions) || 0,
        skippedActions: (f._lastLlmApplySummary && f._lastLlmApplySummary.skippedActions) || 0,
        mergedActions: (f._lastLlmApplySummary && f._lastLlmApplySummary.mergedActions) || 0,
        sc16ComplianceScore: sc ? sc.complianceScore : null,  // F2·null = 无 directive·0 = 完全忽视
        sc16DirectiveCount: sc ? sc.directiveCount : 0,
        rationale: (f._lastLlmRationale && f._lastLlmRationale.text) ? String(f._lastLlmRationale.text).slice(0, 60) : '',
        goals: (global.TM && TM.FactionGoalStack && typeof TM.FactionGoalStack.summarize === 'function') ? TM.FactionGoalStack.summarize(f) : null
      });
    });

    // recentApplications·跨势力·按 turn desc·取近 10
    var recentApplications = [];
    _arr(G.facs).forEach(function(f) {
      if (!f || _isPlayerFaction(f, playerFacNames)) return;
      _arr(f._npcLlmActionLedger).filter(function(r){ return r && r.status === 'applied'; }).slice(-6).forEach(function(r) {
        recentApplications.push({
          turn: r.turn || 0,
          faction: f.name,
          type: r.type,
          source: r.source || ''
        });
      });
    });
    recentApplications.sort(function(a, b){ return (b.turn || 0) - (a.turn || 0); });
    recentApplications = recentApplications.slice(0, 10);

    // recentFailures·跨势力·失败 run + dispatch failed
    var recentFailures = [];
    Object.keys(runs).forEach(function(name) {
      var r = runs[name];
      if (!r || r.status !== 'failed') return;
      recentFailures.push({
        turn: r.turn || r.lastTurn || 0,
        faction: name,
        kind: (r.failure && r.failure.kind) || 'unknown',
        error: (r.failure && r.failure.error) || '',
        rawPreview: (r.failure && r.failure.rawPreview) ? String(r.failure.rawPreview).slice(0, 180) : ''
      });
    });
    allJobs.filter(function(j){ return j && j.status === 'failed'; }).slice(-5).forEach(function(j) {
      recentFailures.push({
        turn: j.turn || 0,
        faction: '',
        kind: 'dispatch',
        error: j.error || '',
        rawPreview: ''
      });
    });
    recentFailures.sort(function(a, b){ return (b.turn || 0) - (a.turn || 0); });
    recentFailures = recentFailures.slice(0, 5);

    // 简易 cost 估算·按 dispatch.applied · 6000 maxTokens (per run prompt + output 估算)
    var estimatedTokensThisTurn = 0;
    try {
      var maxTok = _safeNum(settings.maxTokens) || 6000;
      var appliedThisTurn = _safeNum(dispatchStats.applied) + _safeNum(dispatchStats.partial);
      // 假定每 run 平均 input ~3000 tok·output ~maxTok·rough estimate
      estimatedTokensThisTurn = appliedThisTurn * (3000 + maxTok);
    } catch(_){}

    return {
      turn: turn,
      enabled: !!settings.enabled,
      effectivelyOn: !!settings.effectivelyOn,
      hasKey: !!settings.hasKey,
      settings: settings,
      dispatchStats: dispatchStats,
      candidates: candRows,
      pickLog: pickLog,
      perFacStatus: perFacStatus,
      recentApplications: recentApplications,
      recentFailures: recentFailures,
      estimatedTokensThisTurn: estimatedTokensThisTurn,
      facCount: perFacStatus.length,
      activeJobs: _safeNum(dispatchStats.running) + _safeNum(dispatchStats.scheduled)
    };
  }

  global.TM = global.TM || {};
  global.TM.FactionNpcLlmDecision = {
    decideFor: decideFor,
    decideAll: decideAll,
    getGlobalNpcLlmStatus: getGlobalNpcLlmStatus,
    _buildPrompt: _buildPrompt,
    _buildPromptCore: _buildPromptCore,   // 【A·S2】测试/观测用·core 模式 prompt(只核心段+工具说明)
    _decideViaTools: _decideViaTools,     // 【A·S2】测试用·工具决策路径
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
    _formatBuildOpportunities: _formatBuildOpportunities,   // S5·测试/观测用
    _landFactionBuilds: _landFactionBuilds,                 // S5·测试/观测用
    _repairFactionBuildings: _repairFactionBuildings,       // S5 完善·NPC 自修(测试/观测用)
    _isEnabled: _isEnabled
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { decideFor: decideFor, decideAll: decideAll, hasRunThisTurn: hasRunThisTurn, countRunsThisTurn: countRunsThisTurn, buildRecentTrajectoryContextForSc16: buildRecentTrajectoryContextForSc16, buildFactionAdminSummaryForSc16: buildFactionAdminSummaryForSc16, buildFactionAiDiagnostics: buildFactionAiDiagnostics, getGlobalNpcLlmStatus: getGlobalNpcLlmStatus, _resolvePlayerFactionNames: _resolvePlayerFactionNames, _isPlayerFaction: _isPlayerFaction, _normalizeDecisionActions: _normalizeDecisionActions, _formatBuildOpportunities: _formatBuildOpportunities, _landFactionBuilds: _landFactionBuilds, _repairFactionBuildings: _repairFactionBuildings };
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
