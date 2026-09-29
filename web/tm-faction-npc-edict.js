// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-faction-npc-edict.js — NPC 诏令系统 (Phase C2·2026-05-10)
 *
 * 与 npc-memorial 配对·共同构成 NPC 内部决策链。
 * NPC ruler 每回合按势力 derived 状态自动下 1 诏·立即应用 effect 到势力数据。
 *
 * 诏令 paradigm:
 *   财政危 (fiscalStress > 50) → 催征 / 减俸 (+tax -loyalty)
 *   军权弱 (militaryStability < 40) → 补饷 / 整军 (-treasury +mil loyalty)
 *   朝堂裂 (courtCohesion < 50) → 安抚 / 罢党争 (-stability +court loyalty)
 *   族群弱 (ethnic < 60) → 怀柔 (+ethnic -treasury)
 *   一切稳 → 赏赐 / 巡抚 / 经略 (+slight stability)
 *
 * Schema (fac.npcEdicts[i]):
 *   {
 *     id: 'npce_<turn>_<facName>',
 *     issuer: ruler.name,
 *     turn: GM.turn,
 *     type: '催征/补饷/安抚/赏赐/...',
 *     content: '诏曰: ...',
 *     trigger: '财政危/军权弱/...',  // 触发原因
 *     effects: { treasuryDelta, loyaltyDelta_<role>, fiscalStressDelta, ... },
 *     applied: true
 *   }
 *
 * 副作用:
 *   - 直接 mutate fac (treasury / 字段)
 *   - mutate chars (loyalty by role)
 *   - 推演用·下回合 derived recompute 看到变化
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
  function _clampLoyalty(v) { return Math.max(0, Math.min(100, v)); }

  // 诏令模板·每个 (type) 对应 trigger / 文 / effects
  var EDICT_TEMPLATES = {
    催征: {
      content: '诏曰：国库匮乏·四方有事·宜加派粮饷·州县不得推诿·限三月内解部。',
      effects: { treasuryDelta: 200000, loyaltyDelta_court: -3, loyaltyDelta_general: -2, fiscalStressDelta: -10 }
    },
    减俸: {
      content: '诏曰：国用艰难·百官俸饷暂减三成·待时局缓解再议。',
      effects: { treasuryDelta: 100000, loyaltyDelta_court: -8, loyaltyDelta_general: -5, fiscalStressDelta: -5 }
    },
    补饷: {
      content: '诏曰：边军欠饷·将士困苦·着户部速发库银·先济九边。',
      effects: { treasuryDelta: -300000, loyaltyDelta_general: 8, loyaltyDelta_court: -2, fiscalStressDelta: 5 }
    },
    整军: {
      content: '诏曰：军纪不振·私兵化盛·着兵部清查·将领家丁入伍·违者论罪。',
      effects: { treasuryDelta: -100000, loyaltyDelta_general: -3, fiscalStressDelta: 3 }
    },
    安抚: {
      content: '诏曰：朝堂多事·诸卿劳苦·特赐银两·冀同心戮力·共济时艰。',
      effects: { treasuryDelta: -150000, loyaltyDelta_court: 6, loyaltyDelta_clan: 4, fiscalStressDelta: 3 }
    },
    罢党争: {
      content: '诏曰：诸臣朋党之议甚嚣·宜屏言官私议·一以朝廷之事为重·违者罢黜。',
      effects: { loyaltyDelta_court: -5, fiscalStressDelta: 0 }
    },
    怀柔: {
      content: '诏曰：四夷归化·宜厚赐之·示朝廷怀远之意·稳藩属之心。',
      effects: { treasuryDelta: -200000, loyaltyDelta_clan: 5, fiscalStressDelta: 4 }
    },
    赏赐: {
      content: '诏曰：诸臣勤劳·特行赏赐·以彰圣意。',
      effects: { treasuryDelta: -100000, loyaltyDelta_court: 4, loyaltyDelta_general: 4, loyaltyDelta_clan: 3, fiscalStressDelta: 2 }
    },
    巡抚: {
      content: '诏曰：地方多事·遣大员巡抚·察访民疾·安辑流移。',
      effects: { treasuryDelta: -80000, loyaltyDelta_court: 2, fiscalStressDelta: 2 }
    },
    经略: {
      content: '诏曰：边事紧要·设经略大臣总督·调度兵马·以备不虞。',
      effects: { treasuryDelta: -150000, loyaltyDelta_general: 5, fiscalStressDelta: 4 }
    }
  };

  // 决策树·按 derived 状态选诏令 type·F1 加 ruler personality
  function _decideEdictType(fac, ruler) {
    var dh = fac.derivedHealth || {};
    var de = fac.derivedEconomy || {};
    var dc = fac.derivedCohesion || {};

    var fs = _safeNum(de.fiscalStress);
    var mc = _safeNum(dh.militaryStability);
    var cc = _safeNum(dh.courtCohesion);
    var eth = dc.ethnic ? _safeNum(dc.ethnic) : 80;

    // F1·ruler hints
    var rh = null;
    if (ruler && global.TM && global.TM.FactionPersonality && global.TM.FactionPersonality.hintsFor) {
      rh = global.TM.FactionPersonality.hintsFor(ruler);
    }

    // 优先级·最严重的先处理·personality 调具体选择
    if (fs > 60) {
      // 慷慨 ruler 偏减俸 (减俸自身)·吝啬 ruler 偏催征 (强加民间)
      if (rh && rh.generosity > 0.6) return '减俸';
      if (rh && rh.generosity < 0.4) return '催征';
      return Math.random() < 0.7 ? '催征' : '减俸';
    }
    if (mc < 35) {
      // 慷慨 → 补饷·猜疑/严厉 → 整军
      if (rh && rh.generosity > 0.6) return '补饷';
      if (rh && rh.suspicion > 0.65) return '整军';
      return Math.random() < 0.7 ? '补饷' : '整军';
    }
    if (cc < 45) {
      // 慷慨 → 安抚·猜疑 → 罢党争
      if (rh && rh.generosity > 0.6) return '安抚';
      if (rh && rh.suspicion > 0.65) return '罢党争';
      return Math.random() < 0.6 ? '安抚' : '罢党争';
    }
    if (fs > 40) return '催征';
    if (eth < 60) return '怀柔';
    if (mc < 55) return '经略';
    if (cc < 65) return '安抚';
    // 一切稳·按 personality 选
    if (rh && rh.aggressiveness > 0.6) return '经略';   // 进取 ruler 借太平整边
    if (rh && rh.generosity > 0.6) return '赏赐';        // 慷慨 ruler 多赏
    if (rh && rh.conservatism > 0.6) return '巡抚';       // 保守 ruler 多巡
    return ['赏赐', '巡抚', '巡抚'][Math.floor(Math.random() * 3)];
  }

  function _applyEffects(fac, edict, allCharsInFac) {
    var eff = edict.effects || {};
    // treasury
    if (eff.treasuryDelta && fac.treasury && typeof fac.treasury === 'object') {
      var newM = _safeNum(fac.treasury.money) + eff.treasuryDelta;
      fac.treasury.money = Math.max(0, newM);
    }
    // loyalty by role
    var roleKeys = ['court', 'general', 'clan', 'other', 'ruler'];
    roleKeys.forEach(function(r) {
      var key = 'loyaltyDelta_' + r;
      if (typeof eff[key] !== 'number') return;
      allCharsInFac.forEach(function(c) {
        var role = _classifyChar(c);
        if (role !== r) return;
        if (typeof c.loyalty !== 'number') c.loyalty = 50;
        c.loyalty = _clampLoyalty(c.loyalty + eff[key]);
      });
    });
    // fiscalStress·写到 fac._fiscalStressOverride·下 derived 重算时混
    // (实际 derived recompute 会重新算·此 override 仅为本回合 reflect)
    if (typeof eff.fiscalStressDelta === 'number' && fac.derivedEconomy) {
      fac.derivedEconomy.fiscalStress = Math.max(0, Math.min(100, _safeNum(fac.derivedEconomy.fiscalStress) - eff.fiscalStressDelta));
      fac.derivedEconomy.economyHealth = 100 - fac.derivedEconomy.fiscalStress;
    }
    edict.applied = true;
  }

  function _triggerLabel(type) {
    var map = { 催征: '财政危', 减俸: '财政危', 补饷: '军权弱', 整军: '军权弱',
      安抚: '朝堂裂', 罢党争: '朝堂裂', 怀柔: '族群弱',
      赏赐: '稳定·示恩', 巡抚: '稳定·察治', 经略: '边事紧' };
    return map[type] || '稳定·常仪';
  }

  function generateNpcEdicts() {
    var boundary=global.TM&&TM.PoliticalActions;
    return boundary?boundary.localCandidates('edict'):{actions:0,issued:0,run:0,generated:0,reason:'political_boundary_unavailable'};
  }

  function getNpcEdictsFor(facName) {
    if (typeof global.GM === 'undefined') return [];
    if (!Array.isArray(global.GM.facs)) return [];
    var f = global.GM.facs.find(function(x){ return x && x.name === facName; });
    return (f && Array.isArray(f.npcEdicts)) ? f.npcEdicts.slice() : [];
  }

  global.TM = global.TM || {};
  global.TM.FactionNpcEdict = {
    generate: generateNpcEdicts,
    getFor: getNpcEdictsFor,
    _decideType: _decideEdictType,
    _templates: EDICT_TEMPLATES,
    _triggerLabel: _triggerLabel
  };
})(typeof window !== 'undefined' ? window : globalThis);
