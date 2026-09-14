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
