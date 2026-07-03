/* tm-battle-resolve.js — 御驾亲征接入 · Phase 2「抽象带预测器(§13.2) + 战术result→battleResult 转换(§6 夹带/回填)」
 * 纯逻辑·不改 GM·不接管线(管线接入是后续 slice)。产出喂主游戏现有单一咽喉 MilitarySystems.applyBattleResult。
 *  ① predictBattleBand:双方军群 → 应得损失带 + 胜负把握度(decisive/swing)。与 calculateArmyStrength 一致。
 *  ② tacticalToBattleResult:战术 result(§13.6) → 主游戏 battleResult JSON,夹进带(decisive 不翻;swing 翻盘用战术实况)。
 */
(function () {
  'use strict';
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* 单军战力(优先用主游戏 calculateArmyStrength 保平衡一致·否则复刻基础公式·node 可测) */
  function armyStrength(a, GMref) {
    if (!a) return 0;
    if (typeof window !== 'undefined' && window.MilitarySystems && typeof window.MilitarySystems.calculateArmyStrength === 'function') {
      try { var v = window.MilitarySystems.calculateArmyStrength(a, {}); if (v != null && isFinite(v)) return v; } catch (e) {}
    }
    var s = Math.max(0, Math.round(a.soldiers || a.strength || a.size || 0)); if (!s) return 0;
    var morale = a.morale != null ? a.morale : 60, training = a.training != null ? a.training : 50, supply = a.supply != null ? a.supply : 75;
    var q = String(a.quality || ''); var qm = /精锐|百战|劲旅/.test(q) ? 1.3 : /精兵/.test(q) ? 1.15 : /新兵|新募|乌合|老弱|屯田/.test(q) ? 0.7 : 1.0;
    var cmd = 1, g = GMref || (typeof window !== 'undefined' && window.GM) || null;
    if (g && Array.isArray(g.chars) && a.commander) {
      for (var i = 0; i < g.chars.length; i++) { var c = g.chars[i]; if (c && (c.name === a.commander || c['姓名'] === a.commander)) { cmd = 1 + ((+c.military || 60) * 0.7 + (+c.intelligence || 55) * 0.3) / 200; break; } }
    }
    return s * (0.5 + morale / 200) * (0.5 + training / 200) * qm * cmd * (0.5 + supply / 100 * 0.7);
  }
  function sideStrength(armies, GMref) { var t = 0; (armies || []).forEach(function (a) { if (a) t += armyStrength(a, GMref); }); return t; }
  function sideSoldiers(armies) { var t = 0; (armies || []).forEach(function (a) { if (a) t += Math.max(0, Math.round(a.soldiers || a.strength || a.size || 0)); }); return t; }

  /* §13.2 抽象带预测器:双方 → {把握度·decisive/swing·双方损失带[占原兵力比]} */
  function predictBattleBand(playerArmies, enemyArmies, opts) {
    opts = opts || {}; var G = opts.GM || (typeof window !== 'undefined' && window.GM) || null;
    var strA = sideStrength(playerArmies, G), strB = sideStrength(enemyArmies, G);
    var tot = strA + strB || 1, r = strA / tot;                                  // 玩家战力占比
    var winProb = (r * r) / (r * r + (1 - r) * (1 - r));                          // 锐化:0.5→.5·0.6→.69·0.7→.84
    var decisive = winProb >= 0.7 || winProb <= 0.3;                             // §6:把握度≳70/30=决定性·余=swing均势
    var BASE = 0.22, k = opts.k != null ? opts.k : 0.25;                          // 基准伤亡·夹带宽 k(§12.5)
    var pLoss = clamp(BASE * (1 - r) * 2, 0.03, 0.9), eLoss = clamp(BASE * r * 2, 0.03, 0.9);   // 弱者损更重
    /* 方略(§12.5)拨带中点:主攻双方升·持重双方降·速决方差(此处仅拨期望) */
    var st = opts.strategy; if (st === 'aggressive') { pLoss *= 1.12; eLoss *= 1.15; } else if (st === 'cautious') { pLoss *= 0.85; eLoss *= 0.92; }
    function band(x) { return { expected: +x.toFixed(3), min: +clamp(x * (1 - k), 0.02, 0.95).toFixed(3), max: +clamp(x * (1 + k), 0.02, 0.95).toFixed(3) }; }
    return {
      strA: Math.round(strA), strB: Math.round(strB), winProb: +winProb.toFixed(3),
      winner: r >= 0.5 ? 'player' : 'enemy', decisive: decisive, swing: !decisive,
      playerLoss: band(pLoss), enemyLoss: band(eLoss), k: k,
      playerSoldiers: sideSoldiers(playerArmies), enemySoldiers: sideSoldiers(enemyArmies)
    };
  }

  var FATE = { safe: 'survived', fled: 'routed', killed: 'killed', captured: 'captured', wounded: 'wounded' };

  /* §6 战术 result(§13.6) → 主游戏 battleResult JSON。夹带:decisive 损失夹进带·不翻胜负;swing+flipped 用战术实况。 */
  function tacticalToBattleResult(tac, ctx) {
    ctx = ctx || {}; tac = tac || {};
    var band = ctx.band || {}, k = band.k != null ? band.k : 0.25;
    var pArmies = ctx.playerArmies || [], eArmies = ctx.enemyArmies || [];
    var origById = {}; [].concat(pArmies, eArmies).forEach(function (a) { if (a) origById[a.id] = Math.max(0, Math.round(a.soldiers || a.strength || a.size || 0)); });
    var pIds = {}; pArmies.forEach(function (a) { if (a) pIds[a.id] = true; });
    /* 战术幸存按 parentArmyId 汇总 */
    var survById = {}; (tac.units || []).forEach(function (u) { if (!u) return; var aid = u.parentArmyId; if (aid == null) return; survById[aid] = (survById[aid] || 0) + Math.max(0, Math.round(u.survivors || 0)); });
    /* 每军战术损失 + 分边汇总 */
    var armies = Object.keys(origById);
    var tacLoss = {}, sideTacLoss = { p: 0, e: 0 }, sideOrig = { p: 0, e: 0 };
    armies.forEach(function (aid) {
      var orig = origById[aid], surv = survById[aid] != null ? Math.min(orig, survById[aid]) : orig;
      var loss = Math.max(0, orig - surv); tacLoss[aid] = loss;
      if (pIds[aid]) { sideTacLoss.p += loss; sideOrig.p += orig; } else { sideTacLoss.e += loss; sideOrig.e += orig; }
    });
    /* 夹带:decisive→把每边总损夹进带×原兵力·按军比例缩放;swing+flipped→战术实况(翻盘越带) */
    var playerWonTac = (tac.outcome === 'win');
    var predictedPlayerWin = band.winner != null ? (band.winner === 'player') : null;
    /* flipped 自主判定(§6):原型恒回 flipped:false(其不知预测胜方)·须由带预测拿捏——swing 且战术胜负≠预测胜负 */
    var flipped = !!(band.swing && (predictedPlayerWin != null ? (playerWonTac !== predictedPlayerWin) : tac.flipped));
    /* 决定性仗胜负预定·不可翻(§6):战术只在带内拨惨胜/完胜·胜负方以预测为准 */
    var playerWon = (band.decisive && predictedPlayerWin != null) ? predictedPlayerWin : playerWonTac;
    function sideScale(side) {
      if (flipped) return 1;
      var lossBand = side === 'p' ? (band.playerLoss || { min: 0.03, max: 0.9 }) : (band.enemyLoss || { min: 0.03, max: 0.9 });
      var orig = sideOrig[side], tl = sideTacLoss[side]; if (!orig || !tl) return 1;
      var target = clamp(tl, (lossBand.min || 0.02) * orig, (lossBand.max || 0.95) * orig);
      return target / tl;
    }
    var scaleP = sideScale('p'), scaleE = sideScale('e');
    var affected = armies.map(function (aid) {
      var loss = Math.round(tacLoss[aid] * (pIds[aid] ? scaleP : scaleE));
      var orig = origById[aid], surv = Math.max(0, orig - loss);
      return { armyId: aid, loss: loss, state: surv <= 0 ? 'destroyed' : undefined };
    }).filter(function (x) { return x.loss > 0 || x.state; });
    /* 将领命运:每军主将 → 战术 commanders 按名取 fate */
    var fateByName = {}; (tac.commanders || []).forEach(function (c) { if (c && c.name) fateByName[c.name] = c.fate; });
    var commanderFates = [];
    [].concat(pArmies, eArmies).forEach(function (a) {
      if (a && a.commander && fateByName[a.commander]) {
        var out = FATE[fateByName[a.commander]] || 'survived';
        if (out !== 'survived') commanderFates.push({ name: a.commander, outcome: out, armyId: a.id });
      }
    });
    var out = {
      affectedArmies: affected,
      commanderFate: commanderFates[0] || null,        // 主咽喉吃单个·余 commanderFates 备多将
      commanderFates: commanderFates,
      winnerFactionId: playerWon ? (ctx.playerFactionName || null) : (ctx.enemyFactionName || null),
      loserFactionId: playerWon ? (ctx.enemyFactionName || null) : (ctx.playerFactionName || null),
      objectiveHolder: tac.objective && tac.objective.holder || null,
      emperorSafe: tac.emperorSafe !== false,
      flipped: flipped,
      tacticalOutcome: tac.outcome || null,            // 战术实际胜负(决定性不可翻时与 winner 可异·战报透明用)
      _fromTactical: true                              // 标:战术战果(回填时清 _battleResultTurn 防双扣·见 §13.3)
    };
    /* 抽象 br 战略字段透传(§5/§6 下游·ctx.abstractBr=AI step 原产 battleResult):
     * 身份字段恒承接;胜负相关字段(翻省 occupiedCityIds/战后效应/warScore 幅度)仅当抽象胜负方与战术落定一致时承接——
     * 翻盘则剥除(原胜方的占领不再发生·翻盘方的领土后果走下回合正常战略传导·O1)。 */
    var ab = ctx.abstractBr || null;
    if (ab && typeof ab === 'object') {
      var abBattleId = ab.battleId != null ? ab.battleId : ab.id;
      if (abBattleId != null) out.battleId = abBattleId;
      var atkId = ab.attackerArmyId || ab.attackerArmy || ab.attacker;
      var defId = ab.defenderArmyId || ab.defenderArmy || ab.defender;
      if (atkId != null) out.attackerArmyId = atkId;
      if (defId != null) out.defenderArmyId = defId;
      var abW = String(ab.winnerFactionId || ab.winnerFaction || ab.winner || '');
      var abL = String(ab.loserFactionId || ab.loserFaction || ab.loser || '');
      var pf = String(ctx.playerFactionName || '');
      var abPlayerWon = (pf && abW === pf) ? true : ((pf && abL === pf) ? false : null);
      if (abPlayerWon != null && abPlayerWon === playerWon) {
        if (Array.isArray(ab.occupiedCityIds) && ab.occupiedCityIds.length) out.occupiedCityIds = ab.occupiedCityIds.slice();
        if (Array.isArray(ab.postBattleEffects) && ab.postBattleEffects.length) out.postBattleEffects = ab.postBattleEffects.slice();
        var mag = Number(ab.warScoreDelta != null ? ab.warScoreDelta : ab.decisiveness);
        if (isFinite(mag) && mag > 0) out.warScoreDelta = mag;
      }
      /* casualties(攻守视角)·由战术缩放后分边损失映射(warScore 幅度派生/战报对账·须知攻方属哪边) */
      if (atkId != null && origById[atkId] != null) {
        var atkIsPlayer = !!pIds[atkId];
        out.casualties = {
          attacker: Math.round(sideTacLoss[atkIsPlayer ? 'p' : 'e'] * (atkIsPlayer ? scaleP : scaleE)),
          defender: Math.round(sideTacLoss[atkIsPlayer ? 'e' : 'p'] * (atkIsPlayer ? scaleE : scaleP))
        };
      }
    }
    return out;
  }

  var API = { predictBattleBand: predictBattleBand, tacticalToBattleResult: tacticalToBattleResult, armyStrength: armyStrength, sideStrength: sideStrength };
  if (typeof window !== 'undefined') window.TMBattleResolve = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
