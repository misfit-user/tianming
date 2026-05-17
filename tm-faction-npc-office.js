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

  function _applyAction(action, fac, ruler) {
    var c = action.target;
    var posBefore = c.position || c.role || c.title || '';
    var posAfter = posBefore;
    var loyaltyDelta = 0;
    var reason = '';

    if (action.kind === 'promote') {
      // Phase D3·按 paradigm 适配头衔·后金提"议政大臣" 蒙古"那颜" 朝鲜"判书" 等
      var paradigm = (global.TM && global.TM.FactionParadigm && global.TM.FactionParadigm.detect && fac && fac.name) ? global.TM.FactionParadigm.detect(fac.name, fac) : 'generic';
      var PROMO_BY_PARADIGM = {
        central_empire:    ['内阁参议', '翰林学士', '吏部侍郎', '都察院佥都御史', '通政司参议'],
        manchu_empire:     ['议政大臣', '内国史院学士', '内秘书院学士', '镶黄旗都统', '议政王'],
        mongol_tribe:      ['左翼那颜', '右翼那颜', '万户长', '千户长'],
        tributary_kingdom: ['领议政', '左议政', '右议政', '兵曹判书', '吏曹判书'],
        european_outpost:  ['Ouvidor (高级法官)', 'Capitão-mor (司令)', 'Vereador (议员)', 'Provedor (财务官)'],
        maritime_merchant: ['二爷', '把舵', '账房总管', '副帅'],
        native_chieftain:  ['副土司', '土目', '把总', '族长'],
        rebellion:         ['副元帅', '军师', '左丞相', '右丞相'],
        military_jiedushi: ['留后', '行军司马', '判官', '都虞候'],
        remnant_dynasty:   ['辅臣', '亲卫军统领', '宗正'],
        generic:           ['首席大臣', '副将']
      };
      var promotions = PROMO_BY_PARADIGM[paradigm] || PROMO_BY_PARADIGM.generic;
      var newTitle = promotions[Math.floor(Math.random() * promotions.length)];
      posAfter = newTitle;
      c.position = newTitle;
      loyaltyDelta = 5;
      reason = '勤勉可嘉·提拔为' + newTitle;
    } else if (action.kind === 'demote') {
      posAfter = '(罢免)';
      c.position = posAfter;
      loyaltyDelta = -10;
      reason = '不职·罢撤·' + (c.loyalty < 35 ? '失忠诚' : '异议甚多');
    }
    c.loyalty = _clamp(_safeNum(c.loyalty) + loyaltyDelta, 0, 100);

    return {
      action: action.kind,
      target: c.name,
      ruler: ruler.name,
      reason: reason,
      effect: { positionFrom: posBefore, positionTo: posAfter, loyaltyDelta: loyaltyDelta }
    };
  }

  function generateNpcOfficeActions() {
    if (typeof global.GM === 'undefined') return null;
    var GM = global.GM;
    if (!Array.isArray(GM.facs)) return null;
    var turn = _safeNum(GM.turn) || 1;
    var playerFacNames = _resolvePlayerFactionNames();

    var totalActions = 0;
    GM.facs.forEach(function(fac) {
      if (!fac || !fac.name) return;
      if (_isPlayerFaction(fac, playerFacNames)) return;
      var entry = GM._facIndex && GM._facIndex[fac.name];
      if (!entry) return;
      var alive = (entry.chars || []).filter(_isAlive);
      if (alive.length === 0) return;
      var ruler = alive.find(function(c){ return _classifyChar(c) === 'ruler'; });
      if (!ruler) ruler = alive[0];

      var actions = _decideActions(fac, alive, ruler);
      if (!Array.isArray(fac.npcOfficeActions)) fac.npcOfficeActions = [];
      if (fac.npcOfficeActions.length > 30) fac.npcOfficeActions = fac.npcOfficeActions.slice(-30);

      actions.forEach(function(a, idx){
        var rec = _applyAction(a, fac, ruler);
        rec.id = 'npco_' + turn + '_' + fac.name + '_' + idx;
        rec.turn = turn;
        fac.npcOfficeActions.push(rec);
        if (global.TM && global.TM.FactionActionEngine && typeof global.TM.FactionActionEngine.recordLocalAction === 'function') {
          try {
            global.TM.FactionActionEngine.recordLocalAction(fac, 'office_change', {
              kind: rec.action || a.kind,
              target: rec.target,
              oldPosition: rec.effect && rec.effect.positionFrom,
              newPosition: rec.effect && rec.effect.positionTo,
              loyaltyDelta: rec.effect && rec.effect.loyaltyDelta,
              reason: rec.reason
            }, rec);
          } catch(_){}
        }
        // Phase H2·人事变动入近事快报
        if (global.TM && global.TM.FactionNpcNewsBridge) {
          try { global.TM.FactionNpcNewsBridge.pushOffice(fac, rec); } catch(_){}
        }
        totalActions++;
      });
    });
    return { actions: totalActions };
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
