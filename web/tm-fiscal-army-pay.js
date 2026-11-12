// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-fiscal-army-pay.js — 军饷按户头出太仓（tm-fiscal-engine.js 分片）
// 巨石拆分第二十八拆（2026-11-12）：自 tm-fiscal-engine.js 迁出 FixedExpense 固定支出里「军饷按军、按户头出账」三件，函数体逐字未改：
//   _payArmiesByAccount    各军按户头（辽饷、年例、京营……）同比例发，短发的按军记欠
//   _recordArmyPayArrears  按军记欠到帑廪欠项「军饷」类（写明哪一军）
//   _payEarmarkedArmies    专款户头（剧本 fixedExpense.earmarkedArmyAccounts）先由指定税入支给，不够的按军记欠
// 【装载序·硬约束】须紧随 tm-fiscal-engine.js（origin）之后装载（index.html 中紧挨其后·两片共用一个 ?v= 戳）：
//   origin 装载期把 deductFromLedger / safeNumber / fiscalRound 放进 bucket TM.__fiscalParts，本片装载时捕获，
//   再回填 payArmiesByAccount / payEarmarkedArmies / recordArmyPayArrears；origin 的两个转发到 fixedCollect 调用时才取。
//   错序 = bucket 未就位 → 本片装载即抛错。装载序契约见 scripts/lint-split-contracts.js。
// ============================================================
(function(global) {
  'use strict';
  var parts = global.TM && global.TM.__fiscalParts;
  if (!parts || typeof parts.deductFromLedger !== 'function') throw new Error('tm-fiscal-army-pay.js 须紧随 tm-fiscal-engine.js 之后装载（TM.__fiscalParts 未就位）');
  var deductFromLedger = parts.deductFromLedger, safeNumber = parts.safeNumber, fiscalRound = parts.fiscalRound;

  // 写明出饷户头的各军（11-11）：都记在帑廪册「军饷」一项，细目按户头（辽饷、年例、京营……）列；库里不够时各军按应得同比例少发，
  //   短发的按军记成欠饷（帑廪欠项「军饷」类，写明哪一军），各军欠饷月数由此按实欠算（TM.MilitaryArrears），
  //   欠饷扣军心那条线（applyPayArrearsPressure）才接上真账。原先短发只记一笔不分军的总欠，各军欠饷月数从不随实欠涨。
  function _payArmiesByAccount(G, ledgers, items) {
    var out = {};
    ['money', 'grain', 'cloth'].forEach(function(kind) {
      var led = ledgers[kind], need = 0, paid = 0, owed = 0, byAccount = {};
      items.forEach(function(it) { need += Math.max(0, safeNumber(it[kind], 0)); });
      if (!led || !(need > 0)) { out[kind] = { deducted: 0, deficit: 0 }; return; }
      var ratio = Math.max(0, Math.min(1, safeNumber(led.stock, 0) / need));
      items.forEach(function(it) {
        var amt = Math.max(0, safeNumber(it[kind], 0));
        if (!amt) return;
        var account = it.account || '军饷';
        byAccount[account] = safeNumber(byAccount[account], 0) + amt * ratio;
        var short = amt * (1 - ratio);
        if (short > 0.0001) { _recordArmyPayArrears(G, led, it, short); owed += short; }
      });
      Object.keys(byAccount).forEach(function(account) {
        var got = deductFromLedger(led, Math.min(byAccount[account], Math.max(0, safeNumber(led.stock, 0))), '军饷', true).deducted;
        paid += got;
        if (got > 0 && global.FiscalStatement && global.FiscalStatement.recordFlow) global.FiscalStatement.recordFlow(led, 'central', 'out', '军饷', 'army-account:' + account, account, got);
      });
      out[kind] = { deducted: paid, deficit: owed };
    });
    return out;
  }
  function _recordArmyPayArrears(G, led, it, amount) {
    led.deficit = safeNumber(led.deficit, 0) + amount;
    if (!led.sinks) led.sinks = {};
    led.sinks['军饷_欠'] = safeNumber(led.sinks['军饷_欠'], 0) + amount; // 破产「军饷断裂」与册页都认这一项
    if (!led.deficitDetails) led.deficitDetails = {};
    var rows = led.deficitDetails.junxiang || (led.deficitDetails.junxiang = []);
    var id = 'army-pay:' + String(G.sid || '') + ':' + String(it.armyId || it.name), row = null;
    for (var i = 0; i < rows.length; i++) { if (rows[i] && rows[i].id === id) { row = rows[i]; break; } }
    if (!row) { row = { id: id, name: it.name + '欠饷', amount: 0, armyId: it.armyId, subject: { kind: 'army', id: it.armyId }, incurredTurn: G.turn || 0 }; rows.push(row); }
    row.amount = fiscalRound(safeNumber(row.amount, 0) + amount);
  }
  // 专款户头（11-12 同志「按推荐来」）：剧本在 fixedExpense.earmarkedArmyAccounts 写明某户头只由哪几项税入支给
  //   （天启：辽饷户头只出辽饷加派——新饷另册收支，专供辽东诸部）。本期这几项税入进了太仓多少，先发该户头各军，
  //   排在俸禄之前，不挪作他用；不够的按军记欠，不从旧饷挪补（要挪由玩家下诏补饷）。税入多出该户头所需的留在太仓公用。
  //   只认本回合已征收入账的税入（cascade 本回合跑过）；没写的剧本、存档里没有这一键的旧档，照旧各户头同比例。
  //   返回专款各军已付银两与所欠，和去掉专款各军银两后的余下各军（交 _payArmiesByAccount 照旧同比例）。
  function _payEarmarkedArmies(G, ledgers, items, earmarks) {
    var led = ledgers.money;
    if (!led || !earmarks || typeof earmarks !== 'object') return null;
    if (G._lastCascadeTaxTurn == null || G._lastCascadeTaxTurn !== (G.turn || 0)) return null;
    var out = { deducted: 0, deficit: 0, accounts: {}, rest: items };
    var settled = {};
    Object.keys(earmarks).forEach(function(account) {
      var rule = earmarks[account] || {};
      var taxes = Array.isArray(rule.fromTaxes) ? rule.fromTaxes : [];
      var group = items.filter(function(it) { return it && it.account === account && safeNumber(it.money, 0) > 0; });
      if (!group.length || !taxes.length) return;
      var need = group.reduce(function(s, it) { return s + safeNumber(it.money, 0); }, 0);
      var income = taxes.reduce(function(s, tag) { return s + Math.max(0, safeNumber(led.sources && led.sources[tag], 0)); }, 0);
      var pay = Math.max(0, Math.min(need, income, safeNumber(led.stock, 0)));
      var got = pay > 0 ? deductFromLedger(led, pay, '军饷', true).deducted : 0;
      if (got > 0 && global.FiscalStatement && global.FiscalStatement.recordFlow) global.FiscalStatement.recordFlow(led, 'central', 'out', '军饷', 'army-account:' + account, account, got);
      var ratio = need > 0 ? got / need : 0;
      group.forEach(function(it) {
        var short = safeNumber(it.money, 0) * (1 - ratio);
        if (short > 0.0001) { _recordArmyPayArrears(G, led, it, short); out.deficit += short; }
      });
      out.deducted += got;
      out.accounts[account] = { need: fiscalRound(need), income: fiscalRound(income), paid: fiscalRound(got) };
      settled[account] = true;
    });
    out.rest = items.map(function(it) { return it && settled[it.account] ? Object.assign({}, it, { money: 0 }) : it; });
    return out;
  }

  parts.payArmiesByAccount = _payArmiesByAccount;
  parts.payEarmarkedArmies = _payEarmarkedArmies;
  parts.recordArmyPayArrears = _recordArmyPayArrears;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
