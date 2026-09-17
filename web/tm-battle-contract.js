/* tm-battle-contract.js — shared battle references, receipts and final accounting.
 * Runtime extensions of MilitarySystems; loaded immediately after its canonical writer.
 * These helpers are new campaign code, not a second battle engine. */
(function(global) {
  'use strict';
  var ms = global.MilitarySystems; if (!ms || ms._battleContractInstalled) return;
  ms._battleContractInstalled = true;
  var sequence = 0;
  var _findArmy = ms.findBattleArmy;
  function _root() { return global.GM || {}; }
  function ensureBattleId(br, G) {
    if (!br || typeof br !== 'object') return null;
    if (!br.battleId && !br.id) {
      var owner = (G && G.activeBattles || []).find(function(b) { return b && (b.battleResult === br || b.structuredResult === br || b.structuredVerdict === br); });
      br.battleId = owner && owner.id || (typeof global.uid === 'function' ? global.uid() : 'battle-' + Date.now().toString(36) + '-' + (++sequence));
    }
    return br.battleId || br.id;
  }
  function battleFactionName(ref, G) {
    var key = String(ref || '').trim();
    var facs = (G && (G.facs || G.factions)) || [];
    var found = Array.isArray(facs) && facs.find(function(f) { return f && (String(f.id || '') === key || String(f.name || '') === key); });
    return (found && (found.name || found.id)) || key;
  }
  function battlePlayerFaction(G) {
    var p = global.P || {};
    return battleFactionName((p.playerInfo && (p.playerInfo.factionName || p.playerInfo.factionId)) || (G && (G.playerFactionName || G.playerFaction || G.playerFactionId)), G);
  }
  function battleArmyRef(entry) {
    return entry && (entry.armyId || entry.id || entry.army || entry.name || entry.ref || entry.armyRef || entry.target || entry.commander) || '';
  }
  // 同一解析口供SC18校验、亲征入队、原战果写回使用；不按整势力凭空补军。
  function battleParticipants(br, G) {
    br = br || {}; G = G || _root();
    var list = [], seen = [];
    function add(ref, entry, side) {
      var army = _findArmy(ref, G);
      if (!army || seen.indexOf(army) >= 0) return;
      seen.push(army); list.push({ army: army, entry: entry || {}, side: side || '' });
    }
    (Array.isArray(br.affectedArmies) ? br.affectedArmies : []).forEach(function(entry) { if (entry) add(battleArmyRef(entry), entry, entry.side); });
    add(br.attackerArmyId || br.attackerArmy || br.attacker, { loss: br.casualties && br.casualties.attacker }, 'attacker');
    add(br.defenderArmyId || br.defenderArmy || br.defender, { loss: br.casualties && br.casualties.defender }, 'defender');
    return list;
  }
  function validateBattleResult(br, G) {
    var errors = []; br = br || {}; G = G || _root();
    var winner = br.winnerFactionId || br.winnerFaction || br.winner, loser = br.loserFactionId || br.loserFaction || br.loser;
    if (!winner || !loser || battleFactionName(winner, G) === battleFactionName(loser, G)) errors.push('战果须有不同的胜败双方');
    [winner, loser].forEach(function(ref) { if (ref && Array.isArray(G.facs) && G.facs.length && !G.facs.some(function(f) { return f && (f.id === ref || f.name === ref); })) errors.push('势力不存在·' + ref); });
    ['attacker','defender'].forEach(function(side) {
      var loss = Number(br.casualties && br.casualties[side] || 0), ref = br[side + 'ArmyId'] || br[side + 'Army'] || br[side];
      if (!isFinite(loss) || loss < 0 || loss > 5000000) errors.push('casualties 不合理·' + side);
      if (ref && !_findArmy(ref, G)) errors.push('军队不存在·' + ref);
    });
    (Array.isArray(br.affectedArmies) ? br.affectedArmies : []).forEach(function(entry) {
      if (!entry) return;
      var a = _findArmy(battleArmyRef(entry), G), loss = Number(entry.loss || 0);
      if (!a) errors.push('参战军队不存在·' + battleArmyRef(entry));
      if (!isFinite(loss) || loss < 0 || (a && loss > Number(a.soldiers || a.strength || 0) * 1.2)) errors.push('参战军队伤亡不合理·' + battleArmyRef(entry));
    });
    var fate = br.commanderFate;
    if (fate && fate.name) {
      var ch = (G.chars || []).find(function(c) { return c && c.name === fate.name; });
      if (!ch || ch.alive === false || ch.dead) errors.push('主将不存在或已故·' + fate.name);
    }
    if (!battleParticipants(br, G).length) errors.push('未识别任何参战军队');
    return { ok: !errors.length, errors: errors };
  }
  function findSettledBattle(br, G) {
    var id = br && (br.battleId || br.id);
    return id && ((G && G.battleHistory) || []).find(function(r) { return r && String(r.battleId) === String(id) && Number(r.turn || 0) === Number(G.turn || 0); });
  }
  function turnBattleCasualties(G) {
    var totals = {}, seen = {};
    ((G && G.battleHistory) || []).forEach(function(r, i) {
      if (!r || Number(r.turn || 0) !== Number(G.turn || 0)) return;
      var key = r.battleId || ('row-' + i); if (seen[key]) return; seen[key] = true;
      (r.affectedArmies || []).forEach(function(entry) {
        var a = _findArmy(battleArmyRef(entry), G), fac = battleFactionName(entry.faction || entry.owner || (a && a.faction), G);
        if (fac) totals[fac] = (totals[fac] || 0) + Math.max(0, Number(entry.loss) || 0);
      });
    });
    return totals;
  }

  function consumeBattleResults(payload, G) {
    var events = Array.isArray(payload.battleResults) ? payload.battleResults.slice() : [], seen = {}, accepted = [], rejected = [], totals = {};
    if (payload.battleResult && events.indexOf(payload.battleResult) < 0) events.unshift(payload.battleResult);
    events.forEach(function(br) {
      if (!br || typeof br !== 'object') return;
      var id = br.battleId || br.id;
      if (id && seen[id]) return; if (id) seen[id] = true;
      var valid = validateBattleResult(br, G);
      if (!valid.ok) { rejected.push({ battleId:id, errors:valid.errors }); if (payload.battleResult === br) payload.battleResult = null; return; }
      var receipt = ms.applyBattleResult(br, G);
      accepted.push({ battleId:id, receipt:receipt });
      var rows = receipt && receipt.deferred ? battleParticipants(br,G).map(function(p) { return { faction:p.army.faction, loss:p.entry.loss }; })
        : receipt && receipt.ok && receipt.result ? receipt.result.affectedArmies || [] : [];
      rows.forEach(function(row) { var fac = battleFactionName(row.faction || row.owner,G); if (fac) totals[fac] = (totals[fac] || 0) + Math.max(0,Number(row.loss)||0); });
    });
    if (rejected.length) { payload._battleResultRejected = true; payload._battleResultRejectReasons = rejected.map(function(r) { return r.errors.join('；'); }); }
    return { accepted:accepted, rejected:rejected, casualtyFactions:totals };
  }


  var original = ms.applyBattleResult;
  ms.applyBattleResult = function(br, G) {
    G = G || _root();
    if (!br || typeof br !== 'object') return original.call(ms, br, G);
    ensureBattleId(br,G);
    var prior = findSettledBattle(br, G);
    if (prior) return { ok: true, duplicate: true, result: prior, applied: prior.applied };
    var result = original.call(ms, br, G); // 保留原写口的ID/名称存储契约；归一化仅用于引用判定
    if (result && result.ok && global.GuokuEngine && global.GuokuEngine.syncBattleCasualtyBonus) global.GuokuEngine.syncBattleCasualtyBonus(G);
    if (result && result.ok && br._applierAftermathPending && !result.result._applierAftermathDone && typeof global._applyBattleResult === 'function') {
      result.result._applierAftermathDone = true;
      global._applyBattleResult(G, { battleResult: br }, null, result.result); // 真实结果对象作为内部凭据，JSON输入不能伪造身份
    }
    return result;
  };
  function dispatchComputedBattle(battle, result, attackerArmy, defenderArmy, G) {
    if (!(global.TMBattleTurn && global.TMBattleTurn.enabled && global.TMBattleTurn.enabled(G))) return false;
    var attackerWon = result.verdict !== '败北', draw = result.verdict === '僵持';
    var event = { battleId: battle.id || result.battleId, location: battle.location,
      winnerFactionId: draw ? '僵持' : attackerWon ? attackerArmy.faction : defenderArmy.faction,
      loserFactionId: draw ? '僵持' : attackerWon ? defenderArmy.faction : attackerArmy.faction,
      attackerArmyId: attackerArmy.id || attackerArmy.name, defenderArmyId: defenderArmy.id || defenderArmy.name,
      casualties: {attacker:result.attackerLoss,defender:result.defenderLoss},
      affectedArmies: [{armyId:attackerArmy.id||attackerArmy.name,side:'attacker',loss:result.attackerLoss},{armyId:defenderArmy.id||defenderArmy.name,side:'defender',loss:result.defenderLoss}] };
    battle.battleResult = event;
    var applied = ms.applyBattleResult(event,G);
    if (applied && applied.deferred) { battle.phase = 'awaiting-command'; return true; }
    if (applied && applied.ok) { battle.phase = 'resolved'; battle.result = applied.result; G._turnBattleResults.push(applied.result); return true; } // arch-ok: canonical battle dispatch mirrors one settled battle report
    return false;
  }
  Object.assign(ms, { battleParticipants:battleParticipants, battleFactionName:battleFactionName, battlePlayerFaction:battlePlayerFaction,
    validateBattleResult:validateBattleResult, ensureBattleId:ensureBattleId, findSettledBattle:findSettledBattle, turnBattleCasualties:turnBattleCasualties, consumeBattleResults:consumeBattleResults, dispatchComputedBattle:dispatchComputedBattle });
})(typeof window !== 'undefined' ? window : globalThis);

// Shared strength implementation; the public military function is a lazy forwarder.
(function(global) {
function calculateArmyStrength(army, context) {
  if (!army || army.destroyed) return 0;
  var ctx = context || {};

  var baseStrength = army.soldiers || army.strength || 1000;
  var moraleMod = 0.5 + _armyMorale(army) / 200;       // 0.5-1.0
  var trainingMod = 0.5 + (army.training || 50) / 200;    // 0.5-1.0
  var _qmStr = String(army.quality || ''); var qualityMod = /精锐|精兵|百战|劲旅/.test(_qmStr) ? 1.3 : /新兵|新募|老弱|疲|羸|乌合/.test(_qmStr) ? 0.7 : 1.0;

  // 将领加成（军事能力+智力综合）
  var commanderMod = 1.0, battleAdapter = typeof window !== 'undefined' && window.TMBattleAdapter;
  if (army.commander || army.commanderId) {
    var commander = battleAdapter ? battleAdapter.resolveCommander(army.commander, GM, army.commanderId || army.commanderCharacterId || army.generalId || army.leaderId).character : typeof findCharByName === 'function' ? findCharByName(army.commander) : null;
    if (commander && commander.alive !== false && !commander.capturedBy) {
      var military = battleAdapter ? battleAdapter.genFor(commander, GM).mil : (commander.military ?? commander.valor ?? 50);
      var intel = battleAdapter ? battleAdapter.genFor(commander, GM).int : (commander.intelligence ?? 50);
      commanderMod = 1 + (military * 0.7 + intel * 0.3) / 200; // 1.0-1.5
    }
  }

  // 补给加成（0.5无补给~1.2满补给）
  var supplyMod = 1.0;
  if (army.supplyRatio !== undefined) {
    supplyMod = 0.5 + (army.supplyRatio || 0) * 0.7; // 0.5-1.2
  } else if (army.supply != null) {
    // 字段分裂修：supplyRatio(0-1) 仅补给/行军系统启用时填；日常维护/UI/AI 用的是 supply(0-100)。
    // 无 supplyRatio 时按 supply 折算同一曲线，断粮军真正减战力（原先恒满补给=补给纯摆设）。
    supplyMod = 0.5 + (Math.max(0, Math.min(100, Number(army.supply) || 0)) / 100) * 0.7; // 0.5-1.2
  }

  // 地形加成（从P.battleConfig读取，防守方额外+10%）
  var terrainMod = 1.0;
  if (ctx.terrain && P.battleConfig && P.battleConfig.terrainModifiers) {
    var tMod = P.battleConfig.terrainModifiers[ctx.terrain];
    if (tMod) terrainMod = ctx.isDefender ? (tMod.defender || 1.0) : (tMod.attacker || 1.0);
  } else if (ctx.isDefender) {
    terrainMod = 1.1; // 默认防守方+10%
  }

  // 兵种克制（简化：从unitTypes配置读取）
  var unitMod = 1.0;
  if (army.type && ctx.enemyType && P.battleConfig && P.battleConfig.unitTypes) {
    var unitDef = P.battleConfig.unitTypes.find(function(u) { return u.id === army.type; });
    if (unitDef && unitDef.strong_against && unitDef.strong_against.indexOf(ctx.enemyType) >= 0) unitMod = 1.25;
    if (unitDef && unitDef.weak_against && unitDef.weak_against.indexOf(ctx.enemyType) >= 0) unitMod = 0.75;
  }

  var fortMod = 1.0;
  if (ctx.isDefender && army.fortification) fortMod = 1 + Math.min(0.3, (Number(army.fortification) || 0) / 100 * 0.3); // fortify accumulates; rewards defending

  // 装备加成（武库供械·军备简陋则战力降·接军工供应链 S6·equipmentCondition 由募兵从武库支取时定）
  var _eqc = String(army.equipmentCondition || army.equipmentStatus || army.equipmentLevel || '');
  var equipMod = /精良|优良|齐整|精整/.test(_eqc) ? 1.06 : /严重不足|匮乏|奇缺/.test(_eqc) ? 0.68 : /简陋|破败|朽钝/.test(_eqc) ? 0.82 : /不足|短缺/.test(_eqc) ? 0.9 : 1.0;

  return baseStrength * moraleMod * trainingMod * qualityMod * commanderMod * supplyMod * terrainMod * unitMod * fortMod * equipMod;
}

  global.TM = global.TM || {};
  global.TM.__militaryParts = global.TM.__militaryParts || {};
  global.TM.__militaryParts.calculateArmyStrength = calculateArmyStrength;
})(typeof window !== 'undefined' ? window : globalThis);
