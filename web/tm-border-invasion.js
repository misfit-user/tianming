// ============================================================
//  tm-border-invasion.js — 威胁→侵攻确定性接点（批二刀2·2026-07-21）
//
//  第七轮记债(2026-07-08)：威胁值/borderRisk 只涨不咬——敌强边虚多年·从不真出一支入侵军·
//  「威胁高→南侵」始终停在文案层。修法与民变实体镜像同范式：**确定性具象化·非随机**——
//  玩家领内 leaf.borderRisk ≥ 70 连续 3 回合(streak 记在 leaf 上·tm-border-risk 每回合重算 risk)
//  → 最强敌对势力(playerRelation<-50·排除 _revoltEntity 义军·民变走破京链不走边患链)具象化
//  一支入侵军入 GM.armies(faction=敌方·驻该 leaf)——军事系统/junqing/AI 推演自然看见并接战。
//  每势力同时至多一支·每回合至多新出一支(最险 leaf)·撤军=风险<40 连续2回合(饱掠而归)或
//  军被打散(soldiers≤0)·撤后该势力 6 回合冷却。战斗归既有军事系统·本层只管「出现/撤走」。
//  flag P.conf.borderInvasionEnabled === true(默认 OFF·设置可开)。
//  本文件是 _borderInvasion 军队的唯一写口(已登记 gm-writes owners)。
// ============================================================
(function (global) {
  'use strict';

  var RISK_HIGH = 70, STREAK_NEED = 3;   // 高压阈值·连续回合数→出兵
  var RISK_LOW = 40, LOW_STREAK = 2;     // 低压阈值·连续回合数→撤军
  var COOLDOWN_TURNS = 6;                // 撤军后该势力冷却
  var BASE_SOLDIERS = 20000, PER_STRENGTH = 800;  // 兵额 = 20000 + strength×800

  function enabled() {
    try { return !!(global.P && global.P.conf && global.P.conf.borderInvasionEnabled === true); }
    catch (_) { return false; }
  }

  function _eb(msg) {
    try { if (typeof global.addEB === 'function') global.addEB('边患', msg); } catch (_) {}
  }

  function _hostilesOf(G) {
    return (G.facs || []).filter(function (f) {
      if (!f || f._revoltEntity) return false;             // 义军走破京链·不走边患链
      return (Number(f.playerRelation) || 0) < -50;
    });
  }

  function _activeInvasionOf(G, facName) {
    return (G.armies || []).find(function (a) {
      return a && a._borderInvasion && !a.disbanded && a.sourceFacName === facName;
    }) || null;
  }

  function _withdraw(G, army, why) {
    army.disbanded = true; army.state = 'disbanded';
    var left = army.soldiers || 0;
    army.soldiers = 0; army.size = 0; army.strength = 0;
    var fac = (G.facs || []).find(function (f) { return f && f.name === army.sourceFacName; });
    if (fac) fac._invCooldownUntil = (G.turn || 0) + COOLDOWN_TURNS;
    _eb('「' + (army.name || '犯边之师') + '」' + (why === 'destroyed' ? '全军覆没·边尘暂息' : '饱掠而归·出塞而去') + (left > 0 && why !== 'destroyed' ? '' : ''));
  }

  function tick(G) {
    if (!enabled()) return;
    G = G || global.GM;
    if (!G || !G.adminHierarchy || !Array.isArray(G.armies)) return;
    var IB = global.IntegrationBridge;
    if (!IB || typeof IB.getLeafDivisions !== 'function') return;  // 无取叶能力·静默(镜像 tm-border-risk 约定)
    var turn = G.turn || 0;
    var leaves = IB.getLeafDivisions(G.adminHierarchy, 'player') || [];

    // ① streak 记账 + 找最险候选
    var worst = null;
    leaves.forEach(function (leaf) {
      if (!leaf) return;
      var risk = Number(leaf.borderRisk) || 0;
      if (risk >= RISK_HIGH) leaf._invRiskStreak = (leaf._invRiskStreak || 0) + 1;
      else leaf._invRiskStreak = 0;
      if (leaf._invRiskStreak >= STREAK_NEED && (!worst || risk > (Number(worst.borderRisk) || 0))) worst = leaf;
    });

    // ② 在场入侵军去留（风险回落/被打散）
    G.armies.forEach(function (a) {
      if (!a || !a._borderInvasion || a.disbanded) return;
      if ((a.soldiers || 0) <= 0) { _withdraw(G, a, 'destroyed'); return; }
      var leaf = leaves.find(function (l) { return l && (l.name === a.location || l.name === a.garrison); });
      var risk = leaf ? (Number(leaf.borderRisk) || 0) : 0;
      if (risk < RISK_LOW) {
        a._lowRiskStreak = (a._lowRiskStreak || 0) + 1;
        if (a._lowRiskStreak >= LOW_STREAK) _withdraw(G, a, 'retreat');
      } else {
        a._lowRiskStreak = 0;
      }
    });

    // ③ 出兵（每回合至多一支·最险 leaf·最强合格敌对势力）
    if (!worst) return;
    var attacker = null;
    _hostilesOf(G).forEach(function (f) {
      if (_activeInvasionOf(G, f.name)) return;                        // 每势力同时至多一支
      if ((f._invCooldownUntil || 0) > turn) return;                   // 冷却中
      if (!attacker || (Number(f.strength) || 0) > (Number(attacker.strength) || 0)) attacker = f;
    });
    if (!attacker) return;
    var soldiers = BASE_SOLDIERS + Math.round(Math.max(0, Math.min(100, Number(attacker.strength) || 50)) * PER_STRENGTH);
    G.armies.push({  // arch-ok 边患入侵军唯一写口(本文件已登记 owners)·形状镜像 ai-change-army 创建先例
      id: 'army_inv_' + (attacker.id || attacker.name) + '_' + turn,
      name: attacker.name + '犯边之师',
      faction: attacker.name,
      branch: '边军', type: '边军', armyType: '边军',
      soldiers: soldiers, size: soldiers, strength: soldiers,
      morale: 70, supply: 60, training: 65, loyalty: 85, control: 75, controlLevel: 75,
      location: worst.name || '', garrison: worst.name || '',
      commander: '',
      equipment: [], quality: '劲旅',
      composition: [{ type: '边军', count: soldiers }],
      state: 'field',
      source: 'border.invasion',
      sourceFacName: attacker.name, _borderInvasion: true, _createdTurn: turn
    });
    worst._invRiskStreak = 0;  // 出兵后重新计压
    _eb('边警告急！「' + attacker.name + '」大举犯边·兵锋直指' + (worst.name || '边地') + '·号称 ' + Math.round(soldiers / 10000) + ' 万之众');
  }

  var API = { tick: tick, enabled: enabled, RISK_HIGH: RISK_HIGH, STREAK_NEED: STREAK_NEED, RISK_LOW: RISK_LOW, COOLDOWN_TURNS: COOLDOWN_TURNS };
  global.TM = global.TM || {};
  global.TM.BorderInvasion = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  // 结算注册：序 18(紧随 borderRisk 17.5 之后·读的就是它刚算好的 risk)
  try {
    if (global.SettlementPipeline && typeof global.SettlementPipeline.register === 'function') {
      global.SettlementPipeline.register('borderInvasion', '边患侵攻接点', function () {
        try { tick(global.GM); } catch (_eT) {}
      }, 18, 'perturn');
    }
  } catch (_eR) {}
})(typeof window !== 'undefined' ? window : globalThis);
