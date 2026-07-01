/*
 * tm-world-reactors.js — 世界反应总线·跨系统 reactor（W2·补「A 变了→B 自动反应」的缺口）
 * ============================================================
 * 调研实证：军事/财政/皇威 之间没有「A 变了 B 自动反应」的确定性通路，全靠 AI 叙事兜。
 * 本模块补这些 reactor，反应同时：①落确定性数值 ②写「X↔Y·已结算」chronicle → 进 W1
 *   因果综述（digest 即告知 AI 的通道，省去再动 prompt）③record 进社政账本（享既有传导）。
 *
 * ★安全：每个 reactor 默认 flag 关（worldReactorBattleEnabled 等·默认 false）——接进结算点亦
 *   完全 no-op，直到 owner 在真机启用。因这类反应会动既有平衡（如战败实力损耗本由 AI 叙事驱动），
 *   须真机会战验证不双算后才默认开。启用时 chronicle 标「军务已结算·叙事勿重复扣」防双算。
 *
 * 公开：window.WorldReactors（Military）。依赖：GM；可选 TM.SocialPoliticalSignals。
 */
(function () {
  'use strict';

  function _gm() { return (typeof GM !== 'undefined' && GM) ? GM : null; }
  function _conf() { return (typeof P !== 'undefined' && P && P.conf) ? P.conf : {}; }
  function _battleOn() { return _conf().worldReactorBattleEnabled === true; }   // 默认 false·安全
  // 注：财政→民心/阶层 reactor（W2b）不在本模块——它走已活的 scanRuntimePressures（tm-social-political-signals.js）
  //   新增 treasury-strain emitter，复用其去重/applyPending/inferClassImpacts 通路。军事→势力走本模块因其无活路径。

  function _findFac(G, name) {
    if (!G || !Array.isArray(G.facs) || !name) return null;
    name = String(name);
    for (var i = 0; i < G.facs.length; i++) {
      var f = G.facs[i]; if (!f) continue;
      if (f.name === name || f.id === name || f.factionId === name) return f;
    }
    return null;
  }
  function _chron(G, type, text, tags) {
    try {
      if (!Array.isArray(G._chronicle)) G._chronicle = [];
      G._chronicle.push({ turn: G.turn || 0, date: G._gameDate || '', type: type, text: text, tags: tags || [] });
    } catch (_) {}
  }
  function _recordSignal(G, sig) {
    try { if (typeof TM !== 'undefined' && TM.SocialPoliticalSignals && TM.SocialPoliticalSignals.record) TM.SocialPoliticalSignals.record(G, sig); } catch (_) {}
  }

  // ── 军事 → 势力（战败方实力损·战胜方升·确定性·与既有死 hook 设计同值）──
  var MIL = {
    LOSER: { strength: -5, legitimacy: -3, morale: -8 },
    WINNER: { strength: 5, legitimacy: 2 },
    // info: { winner, loser }（势力名/ID）
    onBattleResolved: function (G, info) {
      G = G || _gm();
      if (!G || !info) return { applied: false, reason: 'no-ctx' };
      if (!_battleOn()) return { applied: false, reason: 'disabled' };   // flag 关 → no-op
      var winner = String(info.winner || ''), loser = String(info.loser || '');
      if (!winner || !loser || winner === loser) return { applied: false, reason: 'no-wl' };
      var lf = _findFac(G, loser), wf = _findFac(G, winner);
      var out = { applied: false, winner: winner, loser: loser, loserDelta: null };
      if (lf) {
        lf.strength = Math.max(0, (lf.strength || 0) + MIL.LOSER.strength);
        lf.legitimacy = Math.max(0, (lf.legitimacy || 0) + MIL.LOSER.legitimacy);
        lf.morale = Math.max(0, (lf.morale || 0) + MIL.LOSER.morale);
        out.applied = true; out.loserDelta = { strength: MIL.LOSER.strength, legitimacy: MIL.LOSER.legitimacy, morale: MIL.LOSER.morale };
      }
      if (wf) {
        wf.strength = Math.min(100, (wf.strength || 0) + MIL.WINNER.strength);
        wf.legitimacy = Math.min(100, (wf.legitimacy || 0) + MIL.WINNER.legitimacy);
        out.applied = true;
      }
      if (out.applied) {
        _chron(G, '军事↔势力',
          loser + ' 战败于 ' + winner + '·' + loser + ' 实力' + MIL.LOSER.strength + '·合法性' + MIL.LOSER.legitimacy + '·士气' + MIL.LOSER.morale +
          '（军务已结算·叙事勿重复扣实力）', ['联动', '军事', '势力']);
        // 双算护栏标记：①软防—chronicle 进 digest 告知 AI「已结算·勿重复扣」②硬防—tm-endturn-apply.js
        //   faction_changes applier 读本表，对本回合已结算 loser 的负向 strength_delta 硬置 0（W2a 硬护栏）
        if (!Array.isArray(G._battleSettledFactions)) G._battleSettledFactions = [];
        G._battleSettledFactions.push({ faction: loser, turn: G.turn || 0, strengthDelta: MIL.LOSER.strength });
        if (G._battleSettledFactions.length > 20) G._battleSettledFactions = G._battleSettledFactions.slice(-20);
        // 进社政账本（享既有传导 + 自动进 digest 的 items 源）
        _recordSignal(G, {
          sourceSystem: 'military', kind: 'battle_outcome', turn: G.turn || 0,
          reason: loser + ' 战败于 ' + winner + '，实力受损', evidence: ['军务结算·战败'],
          affectedClasses: [], affectedParties: [], relationAdjustments: []
        });
      }
      return out;
    }
  };

  var api = { Military: MIL, _findFac: _findFac, _battleOn: _battleOn };
  if (typeof window !== 'undefined') window.WorldReactors = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
