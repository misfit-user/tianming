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
    // TM840 v14 authoritative budget scope: old project aliases must not exclude a second country.
    // Applies only to the explicit population-ledger scenario family, not legacy official scenarios.
    var currentInfo = G.playerInfo || P0.playerInfo || {};
    var currentId = currentInfo.factionId || currentInfo.factionName;
    var currentFaction = _arr(G.facs).find(function(f) { return f && (f.id === currentId || f.name === currentId); });
    if (currentFaction && ((global.CascadeTax && global.CascadeTax.isUnified && global.CascadeTax.isUnified(G,currentFaction.id)) || (currentFaction.fiscalProfile && currentFaction.fiscalProfile.schema === 'tm-fiscal-profile/1'))) {
      return [String(currentFaction.name || currentFaction.id)];
    }
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


  function _runResourceFiscalCycle(fac,de) {
    var turn=(global.GM && global.GM.turn)||0;
    if(fac._lastScenarioFiscalTurn===turn) return null;
    var kinds=['money','grain','cloth'], ratio=_monthRatio(), resources={};
    var beforeStock=fac.treasury || {}, oldDebt=fac._scenarioFiscalDebt || {};
    var nextStock=Object.assign({},beforeStock), nextDebt=Object.assign({},oldDebt);
    var crisis=false;
    kinds.forEach(function(k){
      var income=Math.round(Math.max(0,_safeNum(de.annualRevenueResources[k]))/12*ratio);
      var expense=Math.round(Math.max(0,_safeNum(de.annualExpenseResources[k]))/12*ratio);
      var before=Math.max(0,_safeNum(beforeStock[k])), debt=Math.max(0,_safeNum(oldDebt[k]));
      var available=before+income-expense, added=Math.max(0,-available), repayment=0;
      available=Math.max(0,available);debt+=added;
      if(available>0 && debt>0){repayment=Math.min(available,debt);available-=repayment;debt-=repayment;}
      nextStock[k]=available;nextDebt[k]=debt;crisis=crisis||debt>0;
      resources[k]={income:income,expense:expense,before:before,after:available,net:income-expense,
        debtAdded:added,debtRepaid:repayment,debtAfter:debt};
    });
    // Commit stocks/debts/idempotence together after successful computation.
    fac.treasury=nextStock;fac._scenarioFiscalDebt=nextDebt;fac._fiscalDebt=nextDebt.money;
    fac._fiscalCrisis=crisis;fac._lastScenarioFiscalTurn=turn;
    var cash=resources.money;
    return {monthlyIncome:cash.income,monthlyExpense:cash.expense,periodIncome:cash.income,
      periodExpense:cash.expense,daysPerTurn:_daysPerTurn(),monthRatio:ratio,net:cash.net,
      treasuryBefore:cash.before,treasuryAfter:cash.after,crisis:crisis,debtAccumulated:nextDebt.money,
      resources:resources,model:'tm-fiscal-profile/1',noGrainClothConversion:true};
  }

  function _computeFiscalCycle(fac) {
    if (global.CascadeTax && global.CascadeTax.isUnified && global.CascadeTax.isUnified(global.GM,fac.id || fac.name)) return global.CascadeTax.settleFactionBudget({faction:fac.id || fac.name,turnDays:_daysPerTurn()});
    var de = fac.derivedEconomy;
    if (!de) return null;
    if (de._source && de._source.model === "tm-fiscal-profile/1") return _runResourceFiscalCycle(fac,de);
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

  // This remains world-process settlement, independent of political candidates.
  function _runFiscalCycle(fac) {
    var G=global.GM||{},period=String(G._campaignId||G.sid||'world')+':'+String(G.turn||0);
    if(fac._lastNpcFiscalPeriod===period)return null;
    var rec=_computeFiscalCycle(fac);
    if(rec)fac._lastNpcFiscalPeriod=period;
    return rec;
  }
  function generateNpcFiscalCycles() {
    if (typeof global.GM === 'undefined') return null;
    var GM = global.GM;
    if (global.TM && global.TM.NativeFiscal && global.TM.NativeFiscal.enabled(GM)) return global.TM.NativeFiscal.npc(GM, {turnDays:_daysPerTurn()});
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
      rec.id = 'npcfc_' + turn + '_' + encodeURIComponent(fac.id||fac.name);rec.sourceKind='world_process';
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

  // Accepted, one-off delivery to the current player. Treasury changes are conserved across both parties.
  function transferToPlayer(spec) {
    spec=spec||{};var B=global.TM&&TM.PoliticalActions,D=global.TM&&TM.FactionDiplomacy,g=global.GM;
    if(!B||!D)return {ok:false,reason:'political_boundary_unavailable'};
    var org=B.resolve('organization',{id:spec.factionId},g),p=D.get(spec.proposalId),o=p&&_arr(p.obligations).find(function(x){return x.id===spec.obligationId;});
    if(!org||!p||p.schemaVersion!==2||p.status!=='accepted'||!o||o.kind!=='public_transfer')return {ok:false,reason:'typed_accepted_obligation_required'};
    var accounts=TM.PublicTreasury,source=accounts&&accounts.getAccountView({game:g,ref:o.fromAccount}),playerAccount=accounts&&accounts.getFactionAccountRef({game:g});
    if(!source||!source.exists||source.factionId!==org.id||!playerAccount||o.toAccount!==playerAccount)return {ok:false,reason:'delivery_account_parties_mismatch'};
    if(spec.amounts&&B.signature(spec.amounts)!==B.signature(o.amounts))return {ok:false,reason:'obligation_amount_mismatch'};
    if(o.status==='fulfilled')return {ok:true,duplicate:true,proposalId:p.id,obligationId:o.id,operationRefs:o.operationRefs};
    if(!spec.binding||!B.valid(spec.binding))return {ok:false,reason:'actual_executor_decision_required',proposalId:p.id,obligationId:o.id};
    var r=B.submit(org,{type:'fiscal_policy',fromAccount:o.fromAccount,toAccount:o.toAccount,amounts:o.amounts,purpose:spec.reason||('协议义务 '+o.id),
      proposalId:p.id,proposalVersion:p.version,obligationId:o.id},{binding:spec.binding,index:'obligation:'+o.id});
    return {ok:r.outcome==='completed',outcome:r.outcome,reason:r.reason,receipt:r,proposalId:p.id,obligationId:o.id,amounts:r.outcome==='completed'?o.amounts:undefined};
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
    transferToPlayer: transferToPlayer,
    getFor: getNpcFiscalLedgerFor,
    _runFiscalCycle: _runFiscalCycle
  };
})(typeof window !== 'undefined' ? window : globalThis);
