// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-faction-npc-chaoyi.js — NPC 朝议系统 (Phase C3·2026-05-10)
 *
 * NPC 内部派系每回合发生 1 次互动：协作 / 攻讦 / 妥协 / 内斗·影响 cohesion + partyImbalance + 涉及 chars loyalty
 * 单派 NPC 跳过 (无派可议)·零派也跳。
 *
 * 互动类型:
 *   协作 (cooperate)  — 两派联手议事·loyalty 双双升·partyImbalance 略平
 *   攻讦 (attack)     — A 派攻 B 派·B 派 loyalty 降·若 A 派远大则 B 受重创
 *   妥协 (compromise) — 双方各退一步·loyalty 维持·partyImbalance 平
 *   内斗 (infight)    — 同派内分歧·内部 loyalty 微降·partyImbalance 不变
 *
 * Schema (fac.npcChaoyi[i]):
 *   {
 *     id, turn, type, parties (involved), participants (char names),
 *     summary (action 文字), effects { partyImbalanceDelta, loyaltyDeltaByParty }
 *   }
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
  function _clampLoyalty(v) { return Math.max(0, Math.min(100, v)); }

  // 决策·按势力 derived 状态选互动类型
  function _decideType(fac, parties) {
    var dh = fac.derivedHealth || {};
    var dc = fac.derivedCohesion || {};
    var partyCount = parties.length;
    var imbalance = (fac.derivedHealth && fac.derivedHealth._source && fac.derivedHealth._source.partyImbalance) || 0;
    if (partyCount < 2) return null;  // 单派无朝议

    var cc = _safeNum(dh.courtCohesion);
    // 朝堂凝聚高·偏协作；低·偏攻讦
    var pAttack = cc < 50 ? 0.5 : 0.2;
    var pCooperate = cc >= 70 ? 0.4 : 0.2;
    var pCompromise = 0.2;
    var pInfight = 0.1;
    // imbalance 高·攻讦概率上升 (大派欺小派)
    if (imbalance > 0.5) pAttack += 0.1;

    var r = Math.random();
    if (r < pAttack) return 'attack';
    if (r < pAttack + pCooperate) return 'cooperate';
    if (r < pAttack + pCooperate + pCompromise) return 'compromise';
    return 'infight';
  }

  function _pickParticipants(party, alive, count) {
    var members = alive.filter(function(c){ return c.party === party; });
    members.sort(function(a, b){ return _safeNum(b.charisma) - _safeNum(a.charisma); });
    return members.slice(0, count).map(function(c){ return c.name; });
  }

  function _runInteraction(fac, type, parties, alive) {
    var partyKeys = Object.keys(parties);
    var summary = '';
    var effects = { partyImbalanceDelta: 0, loyaltyDeltaByParty: {} };
    var participants = [];

    if (type === 'cooperate') {
      var p1 = partyKeys[0], p2 = partyKeys[1] || partyKeys[0];
      participants = _pickParticipants(p1, alive, 2).concat(_pickParticipants(p2, alive, 2));
      summary = p1 + '·' + p2 + ' 联手议事·共陈方略·内阁称善。';
      effects.partyImbalanceDelta = -0.05;
      effects.loyaltyDeltaByParty[p1] = 2;
      effects.loyaltyDeltaByParty[p2] = 2;
    } else if (type === 'attack') {
      // 大派攻小派·按 memberCount 排
      var sorted = partyKeys.slice().sort(function(a, b){
        return parties[b].memberCount - parties[a].memberCount;
      });
      var attacker = sorted[0], defender = sorted[1] || sorted[0];
      participants = _pickParticipants(attacker, alive, 2).concat(_pickParticipants(defender, alive, 1));
      summary = attacker + ' 列条款攻讦 ' + defender + '·朝议震动。';
      effects.partyImbalanceDelta = 0.05;
      effects.loyaltyDeltaByParty[defender] = -5;
      effects.loyaltyDeltaByParty[attacker] = 1;
    } else if (type === 'compromise') {
      var pa = partyKeys[0], pb = partyKeys[1] || partyKeys[0];
      participants = _pickParticipants(pa, alive, 2).concat(_pickParticipants(pb, alive, 2));
      summary = pa + '·' + pb + ' 各让一步·议有所成。';
      effects.partyImbalanceDelta = -0.03;
      effects.loyaltyDeltaByParty[pa] = 0;
      effects.loyaltyDeltaByParty[pb] = 0;
    } else { // infight
      var p = partyKeys[Math.floor(Math.random() * partyKeys.length)];
      participants = _pickParticipants(p, alive, 3);
      summary = p + ' 内分歧·' + (participants[0] || '某人') + ' 与 ' + (participants[1] || '某人') + ' 立异。';
      effects.partyImbalanceDelta = 0;
      effects.loyaltyDeltaByParty[p] = -2;
    }

    // 应用 loyalty
    Object.keys(effects.loyaltyDeltaByParty).forEach(function(p){
      var delta = effects.loyaltyDeltaByParty[p];
      alive.forEach(function(c){
        if (c.party !== p) return;
        if (typeof c.loyalty !== 'number') c.loyalty = 50;
        c.loyalty = _clampLoyalty(c.loyalty + delta);
      });
    });

    // 应用 partyImbalance·写到 derivedHealth._source 和 metrics
    if (fac.derivedHealth && fac.derivedHealth._source) {
      var newImb = _safeNum(fac.derivedHealth._source.partyImbalance) + effects.partyImbalanceDelta;
      newImb = Math.max(0, Math.min(1, newImb));
      fac.derivedHealth._source.partyImbalance = Math.round(newImb * 100) / 100;
    }

    return { summary: summary, effects: effects, participants: participants };
  }

  function generateNpcChaoyi() {
    var boundary=global.TM&&TM.PoliticalActions;
    return boundary?boundary.localCandidates('court_alignment'):{actions:0,issued:0,run:0,generated:0,reason:'political_boundary_unavailable'};
  }

  function getNpcChaoyiFor(facName) {
    if (typeof global.GM === 'undefined') return [];
    if (!Array.isArray(global.GM.facs)) return [];
    var f = global.GM.facs.find(function(x){ return x && x.name === facName; });
    return (f && Array.isArray(f.npcChaoyi)) ? f.npcChaoyi.slice() : [];
  }

  global.TM = global.TM || {};
  global.TM.FactionNpcChaoyi = {
    generate: generateNpcChaoyi,
    getFor: getNpcChaoyiFor,
    _decideType: _decideType,
    _runInteraction: _runInteraction
  };
})(typeof window !== 'undefined' ? window : globalThis);
