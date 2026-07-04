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

  // agent 模式活世界:绕过"势力精算"开关·改由 agentLiveWorldOn 门控(仍需 P.ai.key·decideFor 走 LLM)。LLM 模式 agentModeOn=false → 此项 false → 原逻辑零回归。
  function _agentLiveWorldActive() {
    return typeof global.agentLiveWorldOn === 'function' && global.agentLiveWorldOn()
      && !!(global.P && global.P.ai && global.P.ai.key);
  }
  function _isEnabled() {
    if (typeof global.window === 'undefined' && typeof global.GM === 'undefined') return false;
    if (!global.TM || !global.TM.FactionNpcSettings) return false;
    if (!global.TM.FactionNpcSettings.isAiPrecisionEnabled() && !_agentLiveWorldActive()) return false;
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

  function _factionStrength(f) {
    if (f && f.derivedStrength && typeof f.derivedStrength.value === 'number') return f.derivedStrength.value;
    if (f && typeof f.strength === 'number') return f.strength;
    return 50;
  }
  // 非玩家最强 N 个势力名(排除已灭/0战力)·势力 agent 激活策略"3 固定最强"用
  function _topNStrongest(facs, playerNames, n) {
    if (!Array.isArray(facs)) return [];
    return facs.filter(function(f){
      if (!f || !f.name || _isPlayerFaction(f, playerNames)) return false;
      if (/destroyed|defeated|absorbed|gone|eliminated/i.test(String(f.status||''))) return false;
      return _factionStrength(f) > 0;
    }).sort(function(a, b){ return _factionStrength(b) - _factionStrength(a); }).slice(0, n).map(function(f){ return f.name; });
  }
  // 观测/调试：本回合激活名册(3 固定最强 + 5 动态相关度)
  function getActivationRoster(turn) {
    if (!global.GM || !Array.isArray(global.GM.facs)) return { fixed: [], note: 'no facs' };
    var pn = _resolvePlayerFactionNames();
    return { turn: turn, fixed: _topNStrongest(global.GM.facs, pn, 3), dynamicSlots: 5, policy: '3-fixed-strongest + 5-relevance',
      enabled: (typeof global.agentFlagOn === 'function') ? global.agentFlagOn('factionAgentEnabled') : false };
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
    // 【势力 agent 激活策略·2026-06-19·3 固定最强 + 5 动态相关度】开关 factionAgentEnabled·
    //   开时保证非玩家最强三个每回合优先思考(固定槽)·跑满后剩 5 槽落下方现有相关度评分(玩家互动/张力/危机/防饿死·纯运行时·自然随剧本变)。关时走原加权随机·零回归。
    if (typeof global.agentFlagOn === 'function' ? global.agentFlagOn('factionAgentEnabled') : !!(global.P && ((global.P.ai && global.P.ai.factionAgentEnabled) || (global.P.conf && global.P.conf.factionAgentEnabled)))) {
      var _top3 = _topNStrongest(global.GM.facs, playerFacNames, 3);
      var _top3unrun = npcs.filter(function(f){ return _top3.indexOf(f.name) >= 0; });
      if (_top3unrun.length) {
        _top3unrun.sort(function(a, b){ return _factionStrength(b) - _factionStrength(a); });
        _recordPickLog(turn, 'fixed-top3', _top3unrun.map(function(f){ return { fac: f, score: _factionStrength(f), reasons: ['fixed-top3-strongest'] }; }), _top3unrun[0]);
        return _top3unrun[0];
      }
      // 3 固定槽已跑满 → 落到下方相关度选(填动态 5 槽)
    }
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
      return hasReason(row, ['sc16-directive','sc16-priority','sc16-rank','war','fiscal','intervention','recent-loss','empty-treasury']);
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
          if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
            category: '鸿雁',
            content: '【' + fac.name + '】回合内推演·主君考量: ' + (ret.rationale || '').slice(0, 50),
            time: '回' + turn,
            turn: turn,
            _source: 'npc-in-turn-llm',
            _facName: fac.name
          });
          // cap 归 TM.Qiju.CAP 单一真相(2026-07-04 收口)·原地 200 trim 退役
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

  // 调速预设·debug / 手感测试用·写入 P.conf 影响 dispatcher 与 driver
  // 'dev'    1s/3s   开发期·几乎立刻看到 NPC 反应
  // 'fast'   5s/15s  快节奏·感觉 NPC 跟得上手
  // 'normal' 30s/90s 默认·桌面玩家长回合
  // 'slow'   60s/180s 慢·省 API
  var SPEED_PRESETS = {
    dev:    { first: 1000,  repeat: 3000  },
    fast:   { first: 5000,  repeat: 15000 },
    normal: { first: 30000, repeat: 90000 },
    slow:   { first: 60000, repeat: 180000 }
  };
  function setSpeed(name) {
    var preset = SPEED_PRESETS[String(name || '').toLowerCase()];
    if (!preset) return { ok: false, reason: 'unknown preset', available: Object.keys(SPEED_PRESETS) };
    if (!global.P) global.P = {};
    if (!global.P.conf) global.P.conf = {};
    global.P.conf.npcInTurnFirstDelayMs = preset.first;
    global.P.conf.npcInTurnRepeatDelayMs = preset.repeat;
    // 已经排好的旧 timer 没影响·下一回合 reschedule 用新值
    try { if (typeof global.saveP === 'function') global.saveP(); } catch (_e) {} // 写必随存(2026-07-04 p:conf 收口)
    return { ok: true, preset: name, first: preset.first, repeat: preset.repeat };
  }

  global.TM = global.TM || {};
  global.TM.FactionNpcInTurnDriver = {
    scheduleInTurnRuns: scheduleInTurnRuns,
    cancelInTurnTimers: cancelInTurnTimers,
    triggerNow: triggerNow,
    setSpeed: setSpeed,
    SPEED_PRESETS: SPEED_PRESETS,
    _runOneInTurn: _runOneInTurn,
    _pickOneFac: _pickOneFac,
    _topNStrongest: _topNStrongest,
    getActivationRoster: getActivationRoster,
    _resolvePlayerFactionNames: _resolvePlayerFactionNames,
    _isPlayerFaction: _isPlayerFaction,
    DEFAULTS: DEFAULTS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.TM.FactionNpcInTurnDriver;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
