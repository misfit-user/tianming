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

    // ② 覆没恒常清账（宪法：被打散=真散·与 AI/兜底轨无关）+ 兜底轨的风险回落退兵
    G.armies.forEach(function (a) {
      if (!a || !a._borderInvasion || a.disbanded) return;
      if ((a.soldiers || 0) <= 0) { _withdraw(G, a, 'destroyed'); return; }
      if (_aiOn()) return;  // AI 轨：去留归敌国 AI 决断(批四)
      var leaf = leaves.find(function (l) { return l && (l.name === a.location || l.name === a.garrison); });
      var risk = leaf ? (Number(leaf.borderRisk) || 0) : 0;
      if (risk < RISK_LOW) {
        a._lowRiskStreak = (a._lowRiskStreak || 0) + 1;
        if (a._lowRiskStreak >= LOW_STREAK) _withdraw(G, a, 'retreat');
      } else {
        a._lowRiskStreak = 0;
      }
    });

    // ③ AI 轨（批四·owner范式「入不入寇交敌国AI」）：有敌有压才排演绎·每回合一次·post-turn job
    if (_aiOn()) {
      if (G._invInferTurn === turn) return;
      var hostiles0 = _hostilesOf(G);
      var hasActive0 = G.armies.some(function (a) { return a && a._borderInvasion && !a.disbanded; });
      var anyPressure0 = leaves.some(function (l) { return l && (Number(l.borderRisk) || 0) >= RISK_LOW; });
      if (!hostiles0.length || (!hasActive0 && !anyPressure0)) return;  // 无敌无压·不空转调用
      G._invInferTurn = turn;  // arch-ok 边患演绎回合戳·幂等(与 _wtAuditTurn 同范式)
      var _aiJob = function () { return tickAI(G); };
      if (typeof global._enqueuePostTurnJob === 'function') global._enqueuePostTurnJob('borderInvasionAI', _aiJob);
      else _aiJob();
      return;
    }

    // ④ 兜底轨出兵（AI 缺席·确定性 spawner=双轨·每回合至多一支·最险 leaf·最强合格敌对势力）
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

  // ═══ 批四·外患演绎层（AI 主导·owner重批落地「入不入寇交敌国AI」·阈值 spawner 降兜底）═══
  function _aiOn() {
    try { return typeof global.callAI === 'function'; } catch (_) { return false; }
  }
  function _relevantEdicts(G, hostiles) {
    var names = hostiles.map(function (f) { return f.name; });
    var kw = ['和议', '岁币', '封贡', '互市', '纳贡', '议和'];
    return (Array.isArray(G._edictTracker) ? G._edictTracker.slice(-8) : []).map(function (e) {
      return String((e && (e.content || e.title)) || '');
    }).filter(function (t) {
      if (!t) return false;
      return names.some(function (n) { return t.indexOf(n) >= 0; }) || kw.some(function (k) { return t.indexOf(k) >= 0; });
    }).map(function (t) { return t.slice(0, 100); });
  }
  // 动作落账（独立导出·smoke 不经真 AI 直验宪法闸）
  function _applyInvasionActions(G, parsed) {
    if (!parsed || !Array.isArray(parsed.moves)) return { applied: 0, blocked: 0 };
    var turn = G.turn || 0, applied = 0, blocked = 0;
    var IB = global.IntegrationBridge;
    var leaves = (IB && typeof IB.getLeafDivisions === 'function' && G.adminHierarchy) ? (IB.getLeafDivisions(G.adminHierarchy, 'player') || []) : [];
    function leafByName(n) {
      n = String(n || '').trim();
      if (!n) return null;
      return leaves.find(function (l) { return l && (l.name === n || String(l.name).indexOf(n) >= 0 || n.indexOf(String(l.name)) >= 0); }) || null;
    }
    parsed.moves.slice(0, 6).forEach(function (mv) {
      if (!mv || !mv.type) return;
      try {
        var fac = (G.facs || []).find(function (f) { return f && f.name === mv.fac && !f._revoltEntity; });
        switch (String(mv.type)) {
          case 'invade': {
            if (!fac || (Number(fac.playerRelation) || 0) >= -50) { blocked++; return; }  // 宪法：非敌对不得入寇
            if (_activeInvasionOf(G, fac.name)) { blocked++; return; }                     // 一国一军
            if ((fac._invCooldownUntil || 0) > turn) { blocked++; return; }                // 冷却
            var leaf = leafByName(mv.target);
            if (!leaf || (Number(leaf.borderRisk) || 0) < RISK_LOW) { blocked++; return; } // 宪法：无真边压不得凭空入寇
            var cap = BASE_SOLDIERS + Math.round(Math.max(0, Math.min(100, Number(fac.strength) || 50)) * PER_STRENGTH);
            var soldiers = Math.max(5000, Math.min(cap, Math.round(Number(mv.soldiers) || cap)));
            G.armies.push({  // arch-ok 边患入侵军唯一写口(owners)·AI 轨与兜底轨同形状
              id: 'army_inv_' + (fac.id || fac.name) + '_' + turn,
              name: fac.name + '犯边之师',
              faction: fac.name,
              branch: '边军', type: '边军', armyType: '边军',
              soldiers: soldiers, size: soldiers, strength: soldiers,
              morale: 70, supply: 60, training: 65, loyalty: 85, control: 75, controlLevel: 75,
              location: leaf.name || '', garrison: leaf.name || '',
              commander: String(mv.commander || '').slice(0, 12),
              equipment: [], quality: '劲旅',
              composition: [{ type: '边军', count: soldiers }],
              state: 'field',
              source: 'border.invasion.ai',
              sourceFacName: fac.name, _borderInvasion: true, _createdTurn: turn
            });
            _eb('边警告急！「' + fac.name + '」' + (mv.pretext ? '以「' + String(mv.pretext).slice(0, 24) + '」为名·' : '') + '大举犯边·兵锋直指' + leaf.name + '·号称 ' + Math.round(soldiers / 10000) + ' 万之众');
            applied++; return;
          }
          case 'press': {
            var a2 = fac && _activeInvasionOf(G, fac.name);
            if (!a2) { blocked++; return; }
            var lf2 = leafByName(mv.target);
            if (!lf2) { blocked++; return; }
            a2.location = lf2.name; a2.garrison = lf2.name;
            _eb('「' + fac.name + '」铁骑深入·进逼' + lf2.name); applied++; return;
          }
          case 'withdraw': {
            var a3 = fac && _activeInvasionOf(G, fac.name);
            if (!a3) { blocked++; return; }
            _withdraw(G, a3, 'retreat');
            if (mv.reason) _eb('「' + fac.name + '」退兵·' + String(mv.reason).slice(0, 30));
            applied++; return;
          }
          case 'demand': {
            if (!fac) { blocked++; return; }
            _eb('「' + fac.name + '」遣使要挟：' + String(mv.terms || '').slice(0, 50) + '·和战之权在庙堂');
            try {
              if (!Array.isArray(G._chronicle)) G._chronicle = [];
              G._chronicle.push({ turn: turn, date: G._gameDate || '', type: '边患', text: '「' + fac.name + '」要挟：' + String(mv.terms || '').slice(0, 60), tags: ['边患', 'AI演绎'] });
            } catch (_eC) {}
            applied++; return;
          }
          default: blocked++;
        }
      } catch (_eM) { blocked++; }
    });
    return { applied: applied, blocked: blocked };
  }
  async function tickAI(G) {
    if (!_aiOn() || !G) return null;
    var IB = global.IntegrationBridge;
    var leaves = (IB && typeof IB.getLeafDivisions === 'function' && G.adminHierarchy) ? (IB.getLeafDivisions(G.adminHierarchy, 'player') || []) : [];
    var hostiles = _hostilesOf(G);
    if (!hostiles.length) return null;
    var hot = leaves.filter(function (l) { return l && (Number(l.borderRisk) || 0) > 0; })
      .sort(function (a, b) { return (b.borderRisk || 0) - (a.borderRisk || 0); }).slice(0, 5);
    var lines = ['你是天命推演引擎的外患演绎官。以下敌国各有心思——你为每国决断本回合边事(可按兵不动·宁少勿滥)。',
      '【朝廷】' + (G.eraName || '') + '·T' + (G.turn || 0) + '·皇威' + ((G.huangwei && G.huangwei.index) || '?')];
    hostiles.forEach(function (f) {
      var act = _activeInvasionOf(G, f.name);
      lines.push('【' + f.name + '】强' + (f.strength || '?') + '·与朝廷关系' + (f.playerRelation || '?')
        + ((f._invCooldownUntil || 0) > (G.turn || 0) ? '·新败方归(冷却)' : '')
        + (act ? ('·已有犯边之师驻' + act.location + '(兵' + act.soldiers + ')') : ''));
    });
    lines.push('【边地虚实】' + (hot.length ? hot.map(function (l) { return l.name + '(警' + l.borderRisk + ')'; }).join('·') : '边备尚固'));
    var eds = _relevantEdicts(G, hostiles);
    if (eds.length) lines.push('【朝廷近旨(涉边/涉和议·可据以定和战)】' + eds.join('｜'));
    lines.push('【可用动作】invade(fac/target=边警之府/soldiers/pretext=名义)·press(fac/target=深入之府)·withdraw(fac/reason)·demand(fac/terms=要挟条款)。');
    lines.push('【铁则】边备无警不得凭空入寇(引擎验)·兵额有顶·一国同时一军·师老无功或朝廷许以厚利可退可挟。');
    lines.push('只返回 JSON：{"moves":[{"type":"...","fac":"","target":"","soldiers":0,"pretext":"","reason":"","terms":""}]}');
    try {
      var resp = await global.callAI(lines.join('\n'), 900, null, (typeof global._useSecondaryTier === 'function' && global._useSecondaryTier()) ? 'secondary' : undefined, { id: 'border-invasion-ai' });
      var text = (resp && typeof resp === 'object') ? (resp.text || resp.content || '') : String(resp || '');
      var j = (typeof global.robustParseJSON === 'function') ? global.robustParseJSON(text) : JSON.parse(text);
      return _applyInvasionActions(G, j);
    } catch (_eT2) { return null; }
  }

  var API = { tick: tick, tickAI: tickAI, _applyInvasionActions: _applyInvasionActions, enabled: enabled, RISK_HIGH: RISK_HIGH, STREAK_NEED: STREAK_NEED, RISK_LOW: RISK_LOW, COOLDOWN_TURNS: COOLDOWN_TURNS };
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
