// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-faction-npc-guoku.js — NPC 财政周期 (Phase C5·2026-05-10)
 *
 * 与 C2 edict (突发财政诏) 不同·C5 是 NPC 每回合的"常规财政周期":
 *   - 按 derivedEconomy.annualTaxIncome / 12 入账 (月入)
 *   - 按 derivedEconomy.annualMilitaryCost / 12 出账 (月支)
 *   - net 应用到 fac.treasury.money
 *   - 若 treasury 负 → 标 _fiscalCrisis 触发下回合诏令偏向"催征/减俸"
 *
 * 写到 fac.npcFiscalLedger[]·账本 (last 30 turn)
 *
 * Schema (fac.npcFiscalLedger[i]):
 *   { id, turn, monthlyIncome, monthlyExpense, net, treasuryAfter, crisis }
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

  function _daysPerTurn() {
    var n = 0;
    try {
      if (typeof global._getDaysPerTurn === 'function') n = Number(global._getDaysPerTurn()) || n;
    } catch(_){}
    if (!(n > 0) && global.P && P.time && Number(P.time.daysPerTurn) > 0) n = Number(P.time.daysPerTurn);
    if (!(n > 0) && global.GM && GM.time && Number(GM.time.daysPerTurn) > 0) n = Number(GM.time.daysPerTurn);
    return Math.max(0.001, n || 30);
  }

  function _monthRatio() {
    return _daysPerTurn() / 30;
  }

  function _runFiscalCycle(fac) {
    var de = fac.derivedEconomy;
    if (!de) return null;
    var daysPerTurn = _daysPerTurn();
    var monthRatio = _monthRatio();
    var monthlyIncomeBase = _safeNum(de.annualTaxIncome) / 12;
    var monthlyExpenseBase = _safeNum(de.annualMilitaryCost) / 12;
    var monthlyIncome = Math.round(monthlyIncomeBase * monthRatio);
    var monthlyExpense = Math.round(monthlyExpenseBase * monthRatio);
    var net = monthlyIncome - monthlyExpense;

    if (!fac.treasury || typeof fac.treasury !== 'object') {
      fac.treasury = { money: 0, grain: 0, cloth: 0 };
    }
    var before = _safeNum(fac.treasury.money);
    var after = before + net;
    if (after < 0) {
      fac._fiscalCrisis = true;
      // 不允许 treasury 负·clamp 0·赤字记到 fac._fiscalDebt 累加
      fac._fiscalDebt = (_safeNum(fac._fiscalDebt) || 0) + (-after);
      after = 0;
    } else {
      fac._fiscalCrisis = false;
    }
    fac.treasury.money = after;

    return {
      monthlyIncome: monthlyIncome,
      monthlyExpense: monthlyExpense,
      periodIncome: monthlyIncome,
      periodExpense: monthlyExpense,
      daysPerTurn: daysPerTurn,
      monthRatio: monthRatio,
      net: net,
      treasuryBefore: before,
      treasuryAfter: after,
      crisis: !!fac._fiscalCrisis,
      debtAccumulated: _safeNum(fac._fiscalDebt)
    };
  }

  function generateNpcFiscalCycles() {
    if (typeof global.GM === 'undefined') return null;
    var GM = global.GM;
    if (!Array.isArray(GM.facs)) return null;
    var turn = _safeNum(GM.turn) || 1;
    var playerFacNames = _resolvePlayerFactionNames();

    var totalRun = 0;
    GM.facs.forEach(function(fac) {
      if (!fac || !fac.name) return;
      if (_isPlayerFaction(fac, playerFacNames)) return;
      if (!fac.derivedEconomy) return;

      var rec = _runFiscalCycle(fac);
      if (!rec) return;
      rec.id = 'npcfc_' + turn + '_' + fac.name;
      rec.turn = turn;

      if (!Array.isArray(fac.npcFiscalLedger)) fac.npcFiscalLedger = [];
      if (fac.npcFiscalLedger.length > 30) fac.npcFiscalLedger = fac.npcFiscalLedger.slice(-30);
      fac.npcFiscalLedger.push(rec);
      if (global.TM && global.TM.FactionActionEngine && typeof global.TM.FactionActionEngine.recordLocalAction === 'function') {
        try {
          global.TM.FactionActionEngine.recordLocalAction(fac, 'fiscal_policy', {
            resource: 'money',
            before: rec.treasuryBefore,
            after: rec.treasuryAfter,
            delta: rec.net,
            monthlyIncome: rec.monthlyIncome,
            monthlyExpense: rec.monthlyExpense,
            daysPerTurn: rec.daysPerTurn,
            monthRatio: rec.monthRatio,
            crisis: rec.crisis
          }, rec);
        } catch(_){}
      }
      // Phase H2·crisis 转折入近事快报
      if (global.TM && global.TM.FactionNpcNewsBridge) {
        try { global.TM.FactionNpcNewsBridge.pushFiscalCrisis(fac, rec); } catch(_){}
      }
      totalRun++;
    });
    return { run: totalRun };
  }

  function getNpcFiscalLedgerFor(facName) {
    if (typeof global.GM === 'undefined') return [];
    if (!Array.isArray(global.GM.facs)) return [];
    var f = global.GM.facs.find(function(x){ return x && x.name === facName; });
    return (f && Array.isArray(f.npcFiscalLedger)) ? f.npcFiscalLedger.slice() : [];
  }

  global.TM = global.TM || {};
  global.TM.FactionNpcGuoku = {
    generate: generateNpcFiscalCycles,
    getFor: getNpcFiscalLedgerFor,
    _runFiscalCycle: _runFiscalCycle
  };
})(typeof window !== 'undefined' ? window : globalThis);
