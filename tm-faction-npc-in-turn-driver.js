// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-faction-npc-in-turn-driver.js — 回合内 NPC 自主推演 (Phase H3·2026-05-10)
 *
 * 不在过回合时调·而在玩家"思考"自己回合期间·后台调用 LLM 让 NPC 也"在动"。
 * 让游戏感觉活·而非"玩家暂停世界·NPC 全冻"。
 *
 * 触发:
 *   1. 每回合 endturn 后·setTimeout 30s 触发一次·让 player 喘口气先看 UI
 *   2. 选 1 个 NPC fac (按战略评分加权随机)·调 decideFor·apply + push 快报
 *   3. 一回合最多触发 inTurnMaxPerTurn (默认 8) 次·分批投到近事快报
 *   4. 标 fac._inTurnLlmRanTurns·记录已跑 fac·避免重复
 *
 * 不阻塞·完全后台。
 * 仅在 isAiPrecisionEnabled() = true 时启动。
 *
 * 取消触发:
 *   - 玩家点 endturn → setTimeout 自动失效 (新 turn 重置)
 *   - 切换剧本·切换存档·关闭设置 → cancelInTurnTimers()
 */
(function(global) {
  'use strict';

  function _safeNum(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function _arr(v) { return Array.isArray(v) ? v : []; }
  function _normFactionName(v) { return String(v == null ? '' : v).replace(/\s+/g, '').trim(); }
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
  function _isPlayerFaction(f, playerFactionNames) {
    if (!f) return false;
    if (_isMarkedPlayerFaction(f)) return true;
    var k = _normFactionName(f.name);
    return !!k && _arr(playerFactionNames).some(function(n){ return _normFactionName(n) === k; });
  }

  var DEFAULTS = {
    inTurnFirstDelayMs: 30000,    // 30s 后第一次
    inTurnRepeatDelayMs: 90000,   // 90s 后第二次
    inTurnMaxPerTurn: 8           // 默认不收回 API 次数：回合内最多 8 次自主推演
  };

  var _activeTimers = [];

  function cancelInTurnTimers() {
    _activeTimers.forEach(function(id){ try { clearTimeout(id); } catch(_){} });
    _activeTimers = [];
    if (global.TM && global.TM.FactionNpcDispatchQueue && typeof global.TM.FactionNpcDispatchQueue.cancelInTurnTimers === 'function') {
      try { global.TM.FactionNpcDispatchQueue.cancelInTurnTimers(); } catch(_){}
    }
  }

  function _isEnabled() {
    if (typeof global.window === 'undefined' && typeof global.GM === 'undefined') return false;
    if (!global.TM || !global.TM.FactionNpcSettings) return false;
    if (!global.TM.FactionNpcSettings.isAiPrecisionEnabled()) return false;
    if (!global.TM.FactionNpcLlmDecision) return false;
    return true;
  }

  function _getConf() {
    var P = global.P;
    var c = (P && P.conf) || {};
    return {
      inTurnFirstDelayMs: _safeNum(c.npcInTurnFirstDelayMs) || DEFAULTS.inTurnFirstDelayMs,
      inTurnRepeatDelayMs: _safeNum(c.npcInTurnRepeatDelayMs) || DEFAULTS.inTurnRepeatDelayMs,
      inTurnMaxPerTurn: _safeNum(c.npcInTurnMaxPerTurn) || DEFAULTS.inTurnMaxPerTurn
    };
  }

  function _countLedgerRuns(turn) {
    if (global.TM && global.TM.FactionNpcLlmDecision && typeof global.TM.FactionNpcLlmDecision.countRunsThisTurn === 'function') {
      return global.TM.FactionNpcLlmDecision.countRunsThisTurn(turn);
    }
    return 0;
  }

  // 选 1 个 NPC fac (按战略评分加权随机·已跑 fac 不重复)
  function _pickOneFac(turn) {
    if (!global.GM || !Array.isArray(global.GM.facs)) return null;
    var playerFacNames = _resolvePlayerFactionNames();
    var npcs = global.GM.facs.filter(function(f){
      if (!f || !f.name || _isPlayerFaction(f, playerFacNames)) return false;
      // 已在本回合 in-turn 跑过 → skip
      if (Array.isArray(f._inTurnLlmRanTurns) && f._inTurnLlmRanTurns.indexOf(turn) >= 0) return false;
      if (global.TM && global.TM.FactionNpcLlmDecision && typeof global.TM.FactionNpcLlmDecision.hasRunThisTurn === 'function'
          && global.TM.FactionNpcLlmDecision.hasRunThisTurn(f.name, turn)) return false;
      return true;
    });
    if (npcs.length === 0) return null;
    // 优先战争、财政危机、刚被玩家干预过的势力；没有 action engine 时退回强度权重。
    var engine = global.TM && global.TM.FactionActionEngine;
    var ranked = npcs.map(function(f){
      if (engine && typeof engine.scoreFactionCandidate === 'function') {
        var row = engine.scoreFactionCandidate(f, { turn: turn, playerFactionNames: playerFacNames });
        return { fac: f, score: Math.max(1, _safeNum(row && row.score) || 1), reasons: _arr(row && row.reasons) };
      }
      return { fac: f, score: Math.max(1, (f.derivedStrength && f.derivedStrength.value) || 50), reasons: ['strength-fallback'] };
    }).sort(function(a, b){ return b.score - a.score; });
    function hasReason(row, names) {
      var s = '|' + _arr(row && row.reasons).join('|') + '|';
      return names.some(function(n){ return s.indexOf('|' + n + '|') >= 0; });
    }
    var forced = ranked.filter(function(row) {
      return hasReason(row, ['sc16-directive','war','fiscal','intervention','recent-loss','empty-treasury']);
    });
    var hot = ranked.filter(function(row) {
      return hasReason(row, ['hotspot','story','player-relation','player-border','retry-pressure','intrigue','rebellion','long-idle']);
    });
    var poolName = forced.length ? 'forced' : (hot.length ? 'hot' : 'ranked');
    var pool = forced.length ? forced.slice(0, 4) : (hot.length ? hot.slice(0, 6) : ranked.slice(0, Math.min(8, ranked.length)));
    var weights = pool.map(function(row){ return Math.max(1, _safeNum(row.score) || 1); });
    var sum = weights.reduce(function(a, b){ return a + b; }, 0);
    var r = Math.random() * sum;
    var cum = 0;
    for (var i = 0; i < pool.length; i++) {
      cum += weights[i];
      if (r <= cum) {
        _recordPickLog(turn, poolName, pool, pool[i] && pool[i].fac);
        return pool[i] && pool[i].fac;
      }
    }
    _recordPickLog(turn, poolName, pool, pool[pool.length - 1] && pool[pool.length - 1].fac);
    return pool[pool.length - 1] && pool[pool.length - 1].fac;
  }

  function _recordPickLog(turn, poolName, pool, selected) {
    try {
      if (!global.GM) return;
      if (!Array.isArray(global.GM._npcFactionLlmPickLog)) global.GM._npcFactionLlmPickLog = [];
      global.GM._npcFactionLlmPickLog.push({
        turn: turn,
        pool: poolName || 'ranked',
        selected: selected && selected.name || '',
        candidates: _arr(pool).slice(0, 8).map(function(row) {
          return { faction: row.fac && row.fac.name || '', score: Math.round(_safeNum(row.score)), reasons: _arr(row.reasons).slice(0, 6) };
        })
      });
      if (global.GM._npcFactionLlmPickLog.length > 30) global.GM._npcFactionLlmPickLog = global.GM._npcFactionLlmPickLog.slice(-30);
    } catch(_){}
  }

  function _markRan(fac, turn) {
    if (!Array.isArray(fac._inTurnLlmRanTurns)) fac._inTurnLlmRanTurns = [];
    if (fac._inTurnLlmRanTurns.indexOf(turn) < 0) fac._inTurnLlmRanTurns.push(turn);
    if (fac._inTurnLlmRanTurns.length > 10) fac._inTurnLlmRanTurns = fac._inTurnLlmRanTurns.slice(-10);
  }

  // 后台调 LLM·apply·已 push 快报 (decision 内置 push)·额外 push 一行"风闻"标签
  async function _runOneInTurn(turn, attempt) {
    if (!_isEnabled()) return { skipped: true, reason: 'precision off' };
    var conf = _getConf();
    var maxRuns = Math.max(0, Math.floor(conf.inTurnMaxPerTurn));
    if (_countLedgerRuns(turn) >= maxRuns) return { skipped: true, reason: 'NPC LLM turn budget exhausted' };
    var fac = _pickOneFac(turn);
    if (!fac) return { skipped: true, reason: 'no NPC available' };

    var ret = await global.TM.FactionNpcLlmDecision.decideFor(fac.name, { source: 'in-turn', turn: turn });
    if (ret.applied) {
      _markRan(fac, turn);
      // 单行 "in-turn" 标签·告诉 player 这是回合内推演·不是过回合产物
      if (global.TM.FactionNpcNewsBridge) {
        try {
          if (!Array.isArray(global.GM.qijuHistory)) global.GM.qijuHistory = [];
          global.GM.qijuHistory.unshift({
            category: '鸿雁',
            content: '【' + fac.name + '】回合内推演·主君考量: ' + (ret.rationale || '').slice(0, 50),
            time: '回' + turn,
            turn: turn,
            _source: 'npc-in-turn-llm',
            _facName: fac.name
          });
          if (global.GM.qijuHistory.length > 200) global.GM.qijuHistory = global.GM.qijuHistory.slice(0, 200);
        } catch(_){}
      }
      try { console.log('[npc-in-turn] turn ' + turn + ' attempt ' + attempt + ' applied to ' + fac.name); } catch(_){}
    }
    return ret;
  }

  // 玩家进入新回合时调用·分批安排后台推演
  function scheduleInTurnRuns(opts) {
    opts = opts || {};
    if (!opts.internal && global.TM && global.TM.FactionNpcDispatchQueue && typeof global.TM.FactionNpcDispatchQueue.scheduleInTurnRuns === 'function') {
      return global.TM.FactionNpcDispatchQueue.scheduleInTurnRuns(opts);
    }
    cancelInTurnTimers();
    if (!_isEnabled()) return { scheduled: 0, reason: 'precision off' };
    if (typeof setTimeout === 'undefined') return { scheduled: 0, reason: 'no setTimeout' };
    var conf = _getConf();
    var turn = _safeNum(global.GM && global.GM.turn) || 1;

    var maxRuns = Math.max(0, Math.floor(conf.inTurnMaxPerTurn));
    var step = Math.max(1, conf.inTurnRepeatDelayMs - conf.inTurnFirstDelayMs);
    for (var i = 1; i <= maxRuns; i++) {
      (function(attempt) {
        var delay = attempt === 1 ? conf.inTurnFirstDelayMs : conf.inTurnRepeatDelayMs + (attempt - 2) * step;
        var t = setTimeout(function() {
          _runOneInTurn(turn, attempt).catch(function(e){
            try { console.warn('[npc-in-turn] attempt ' + attempt + ' failed', e); } catch(_){}
          });
        }, delay);
        _activeTimers.push(t);
      })(i);
    }

    return { scheduled: maxRuns, firstAt: conf.inTurnFirstDelayMs, repeatAt: conf.inTurnRepeatDelayMs };
  }

  // 手动触发·player 主动想看"现在 NPC 在干嘛" (UI 按钮)
  async function triggerNow() {
    if (!_isEnabled()) return { skipped: true, reason: 'precision off' };
    var turn = _safeNum(global.GM && global.GM.turn) || 1;
    return _runOneInTurn(turn, 'manual');
  }

  global.TM = global.TM || {};
  global.TM.FactionNpcInTurnDriver = {
    scheduleInTurnRuns: scheduleInTurnRuns,
    cancelInTurnTimers: cancelInTurnTimers,
    triggerNow: triggerNow,
    _runOneInTurn: _runOneInTurn,
    _pickOneFac: _pickOneFac,
    _resolvePlayerFactionNames: _resolvePlayerFactionNames,
    _isPlayerFaction: _isPlayerFaction,
    DEFAULTS: DEFAULTS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.TM.FactionNpcInTurnDriver;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
