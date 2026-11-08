// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-faction-npc-office.js — NPC 人事系统 (Phase C4·2026-05-10)
 *
 * NPC ruler 每回合按势力健康自动做 0-2 项人事决策:
 *   提拔 (promote) — 忠诚 >= 80 且 charisma 高 → 加 'court' 头衔
 *   罢撤 (demote)  — 忠诚 < 30 或异党 → 削头衔为 'other'
 *   征辟 (recruit) — 势力 charByRole.court 不足 → 召募新人 (mark _recruitedTurn)
 *
 * 不创建新 char (avoid scope creep)·只 mutate 已有 char.position / loyalty
 * 写到 fac.npcOfficeActions[]
 *
 * Schema:
 *   { id, turn, action ('promote'/'demote'/'recruit'/'noop'),
 *     target: charName, ruler: rulerName,
 *     reason, effect: { positionFrom, positionTo, loyaltyDelta } }
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
    _arr(G.chars).forEach(function(c){ if (c && (c.isPlayer || c.playerControlled || c.controlledBy === 'player')) push(c.faction || c.factionName || c.ownerFaction); });
    return names;
  }
  function _isPlayerFaction(f, playerFactionNames) {
    if (!f) return false;
    if (_isMarkedPlayerFaction(f)) return true;
    var k = _normFactionName(f.name);
    return !!k && _arr(playerFactionNames).some(function(n){ return _normFactionName(n) === k; });
  }
  function _isAlive(c) {
    if (!c) return false;
    if (c.alive === false) return false;
    if (c.dead === true) return false;
    return true;
  }
  function _classifyChar(c) {
    if (global.TM && global.TM.FactionNpcMemorial && global.TM.FactionNpcMemorial._classifyChar) {
      return global.TM.FactionNpcMemorial._classifyChar(c);
    }
    return 'other';
  }
  function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // 提拔候选·非 ruler·loyalty>=70·charisma>=60·当前 role 不是 ruler/court
  function _findPromoteTarget(alive, ruler) {
    return alive.filter(function(c){
      if (c === ruler) return false;
      var role = _classifyChar(c);
      if (role === 'ruler') return false;
      if (role === 'court') return false;  // 已经在朝中
      var loy = _safeNum(c.loyalty);
      var ch = _safeNum(c.charisma);
      return loy >= 70 && ch >= 60;
    }).sort(function(a, b){
      return (_safeNum(b.loyalty) + _safeNum(b.charisma)) - (_safeNum(a.loyalty) + _safeNum(a.charisma));
    })[0];
  }

  // 罢撤候选·非 ruler·loyalty<35 或党派与 ruler 完全相反
  function _findDemoteTarget(alive, ruler) {
    return alive.filter(function(c){
      if (c === ruler) return false;
      var role = _classifyChar(c);
      if (role === 'ruler') return false;
      var loy = _safeNum(c.loyalty);
      var diffParty = ruler.party && c.party && ruler.party !== c.party;
      return loy < 35 || (diffParty && loy < 50);
    }).sort(function(a, b){
      return _safeNum(a.loyalty) - _safeNum(b.loyalty);  // 最低忠诚先罢
    })[0];
  }

  function _decideActions(fac, alive, ruler) {
    var actions = [];
    var dh = fac.derivedHealth || {};
    var dc = fac.derivedCohesion || {};
    var entry = (typeof global.GM !== 'undefined') ? (global.GM._facIndex && global.GM._facIndex[fac.name]) : null;
    var courtCount = (entry && entry.metrics && entry.metrics.charByRole && entry.metrics.charByRole.court) || 0;

    // 提拔: 朝臣不足 (court < 5) 或 cohesion 低 → 提
    if (courtCount < 5 || (dh.courtCohesion && dh.courtCohesion < 50)) {
      var promote = _findPromoteTarget(alive, ruler);
      if (promote) {
        actions.push({ kind: 'promote', target: promote });
      }
    }
    // 罢撤: 任意势力·当 cohesion 极低 (<40) 或 personnelHealth 低
    if ((dh.courtCohesion && dh.courtCohesion < 50) || (dh.personnelHealth && dh.personnelHealth < 30)) {
      var demote = _findDemoteTarget(alive, ruler);
      if (demote) {
        actions.push({ kind: 'demote', target: demote });
      }
    }
    return actions;
  }

  function generateNpcOfficeActions() {
    var boundary=global.TM&&TM.PoliticalActions;
    return boundary?boundary.localCandidates('office_change'):{actions:0,issued:0,run:0,generated:0,reason:'political_boundary_unavailable'};
  }

  function getNpcOfficeActionsFor(facName) {
    if (typeof global.GM === 'undefined') return [];
    if (!Array.isArray(global.GM.facs)) return [];
    var f = global.GM.facs.find(function(x){ return x && x.name === facName; });
    return (f && Array.isArray(f.npcOfficeActions)) ? f.npcOfficeActions.slice() : [];
  }

  global.TM = global.TM || {};
  global.TM.FactionNpcOffice = {
    generate: generateNpcOfficeActions,
    getFor: getNpcOfficeActionsFor,
    _decideActions: _decideActions,
    _findPromoteTarget: _findPromoteTarget,
    _findDemoteTarget: _findDemoteTarget
  };
})(typeof window !== 'undefined' ? window : globalThis);
