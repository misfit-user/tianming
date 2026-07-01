// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-conspiracy.js — 人物阴谋系统 · 确定性引擎 (Slice 1)
// Domain: 阴谋酝酿 / 多回合弧 / 密谋值·保密·败露 / NPC 野心落地
// Owner: TM 团队 · 2026-06-21
// ------------------------------------------------------------
//  设计:
//   · 把原「一回合定生死的原子事件」补成多回合阴谋弧:
//        酝酿(brewing) → 将发(ripe) → 事泄被擒 / 交 AI 叙事爆发。
//   · 活跃阴谋存 GM._activePlots[](进行中)·已了结落 GM._conspiracies[](史录·与旧通道同构)。
//   · 数据源: NPC 自主「暗中串联」意图(GM._pendingNpcConspiracies) + 野心/忠诚属性。
//   · 确定性: 自带子种子 RNG(按回合播种)·不消耗主 RNG 序列·存档重放可复现。
//   · 安全边界(关键): 引擎只「确定性地破获/下狱」阴谋(复用既有 _imprisoned/护栏)·
//        绝不擅自弑君或凭空坐实政变得逞——君威衰微时将发的阴谋「交 AI 叙事」(Slice 2)·
//        留超时自破兜底·避免悬而不决。得逞情节仍由 AI 走 record_conspiracy_events 旧路。
//
//  接线: tm-endturn-systems.js 系统阶段(自然死亡之后)调 ConspiracyEngine.tick()。
//  加载顺序: 须在 tm-endturn-systems.js 之前(运行时调用·load 期仅定义)。
//  Test: scripts/smoke-conspiracy-engine.js
// ============================================================

(function (global) {
  'use strict';

  // ─── 可调参数(owner 可改) ───
  var CFG = {
    // —— 萌发 ——
    ambitionSpawn: 72,        // 野心≥此·单独即可能起意
    disloyalLoyalty: 45,      // 忠诚<此 且 野心≥disloyalAmbition·亦起意
    disloyalAmbition: 58,
    spawnChanceBase: 0.30,    // 每名合格者每回合起意基率(×monthRatio×野心因子)
    spawnChanceIntent: 0.85,  // 本回合确有「暗中串联」意图者·起意基率拉高
    maxActivePlots: 8,        // 并发活跃阴谋上限(性能+合理性)
    // —— 密谋值(酝酿进度) ——
    momentumStartLo: 8,
    momentumStartHi: 20,
    momentumBase: 6,          // 每月基础酝酿增量(调慢:9→6·酝酿更久才将发)
    momentumPerAlly: 2,       // 每名同谋附加(3→2)
    capPivot: 60,             // 主谋能臣度因子轴(智/勇加权)
    ripeThreshold: 100,       // 密谋值≥此·将发
    ripeTimeout: 2,           // 将发后无人收束·超此回合数引擎自破兜底
    // —— 招募 ——
    recruitChanceBase: 0.45,
    maxConspirators: 6,
    // —— 保密 / 败露 ——
    secrecyStart: 72,
    secrecyDecayPerAlly: 1.5, // 人越多越难保密(2.5→1.5·更难走漏)
    exposureBase: 3,          // 每月基础败露增量(调难:6→3·阴谋更隐秘·更久不被发现)
    exposurePerAlly: 2.5,     // 每名同谋附加泄露面(4→2.5)
    exposeThreshold: 100      // 败露度≥此·事泄被擒(不变·保玩家查案+48仍有效)
  };

  // ─── 工具 ───
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // 自带确定性 RNG(FNV-1a 播种 + xorshift32)·不触主 _rngState
  function _hash(str) {
    var h = 2166136261 >>> 0;
    str = String(str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function _makeRng(seedStr) {
    var s = _hash(seedStr) || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  }

  function _G() { return global.GM || (typeof GM !== 'undefined' ? GM : null); }
  function _eb(cat, msg) { try { if (typeof global.addEB === 'function') global.addEB(cat, msg); } catch (_) {} }
  function _monthRatioOf(opts) {
    var m = opts && (opts.monthRatio != null ? opts.monthRatio : opts._monthRatio);
    return (typeof m === 'number' && isFinite(m) && m > 0) ? m : 1;
  }

  function ensure(G) {
    if (!Array.isArray(G._activePlots)) G._activePlots = [];
    if (!Array.isArray(G._conspiracies)) G._conspiracies = [];
  }

  function _alive(c) { return c && c.alive !== false && !c._imprisoned && !c._exiled && !c._fled && !c._dead && !c.dead; }
  function _liveChars(G) { return (G.chars || []).filter(function (c) { return c && !c.isPlayer && _alive(c); }); }
  function _findChar(G, name) { return (G.chars || []).find(function (c) { return c && c.name === name; }) || null; }
  function _playerName(G) {
    var p = (G.chars || []).find(function (c) { return c && c.isPlayer; });
    return p ? p.name : ((global.P && P.playerInfo && P.playerInfo.characterName) || '');
  }

  // S1c·官位→谋逆能量开关(默认关)。原阴谋酝酿/招募全不读官位(只 _hasMilitary 读军职定 coup/plot)。
  //   开 → 品级越高(权位=资源/门生故吏/隐蔽手段)谋逆能量越大·喂 _cap(动量+保密)与 _recruit(拉拢半径)。
  //   关 → _officeConspiracyBonus 返 0 = 零回归(确定性 rng 序列字节不变)。启用：P.conf.officeConspiracyEnabled = true。
  function _officeConspiracyOn() {
    try {
      var P = global.P || {};
      var ai = P.ai || {}, conf = P.conf || {};
      return !!(ai.officeConspiracyEnabled || conf.officeConspiracyEnabled);
    } catch (e) { return false; }
  }
  // 官位谋逆能量加成：品级越高(level 越小)→ 加成越大。仅在任官(有 officialTitle)受用·散阶无实权不算。
  function _officeConspiracyBonus(ch, G) {
    if (!ch || !ch.officialTitle || !_officeConspiracyOn()) return 0;
    var lv = (global.TMPromotion && typeof TMPromotion.resolveRankLevel === 'function')
      ? TMPromotion.resolveRankLevel(ch, G || global.GM) : (ch.rankLevel || 0);
    if (!(lv > 0)) return 0;
    return clamp((13 - lv) * 2.5, 0, 30);   // lv1(正一品)→+30·lv5→+20·lv9(正五品)→+10·lv≥13→0
  }

  // 能臣度代理(智为主·辅以勇/军)·用于酝酿速率与保密。S1c：叠加官位谋逆能量(flag 关=0·零回归)。
  function _cap(ch, G) {
    if (!ch) return 50;
    var intel = ch.intelligence || 50;
    var force = ch.valor || ch.military || 50;
    return intel * 0.6 + force * 0.4 + _officeConspiracyBonus(ch, G);
  }
  function _hasMilitary(ch) {
    return !!(ch && ((typeof ch.troops === 'number' && ch.troops > 0) || ch._commandsArmy || /将|帅|都督|总兵|提督|总兵官|参将|游击|宗室|藩王|郡王|亲王/.test(String(ch.role || ch.officialTitle || ch.title || ''))));
  }

  // 是否符合起意条件(野心/忠诚)
  function _eligibleRingleader(ch) {
    if (!_alive(ch) || ch.isPlayer) return false;
    var amb = ch.ambition || 50, loy = ch.loyalty || 50;
    return amb >= CFG.ambitionSpawn || (loy < CFG.disloyalLoyalty && amb >= CFG.disloyalAmbition);
  }

  // QAM 难度阈值(与 tm-endturn-apply.js 同步·读 P.conf.difficulty)
  function _qamThreshold() {
    var diff = (global.P && P.conf && P.conf.difficulty) || '';
    var key = ({ narrative: 'narrative', standard: 'standard', hardcore: 'hardcore', '简单': 'narrative', '普通': 'standard', '中等': 'standard', '困难': 'hardcore', '地狱': 'hardcore' })[diff] || 'standard';
    return key === 'narrative' ? 45 : (key === 'hardcore' ? 75 : 60);
  }
  function _throneStrong(G) {
    var hq = (G.huangquan && typeof G.huangquan.index === 'number') ? G.huangquan.index : 50;
    var hw = (G.huangwei && typeof G.huangwei.index === 'number') ? G.huangwei.index : 50;
    var thr = _qamThreshold();
    return hq >= thr || hw >= thr;
  }

  function _isThronePlot(plot) {
    return plot && (plot.kind === 'coup' || plot.kind === 'regicide' || plot.kind === 'palace_coup');
  }

  // ─── 落库 + 下狱(复用既有结构/护栏) ───
  function _settle(G, plot, action, outcome, reason, qamGated) {
    G._conspiracies.push({
      turn: G.turn || 0,
      action: action,
      instigator: plot.ringleader,
      target: plot.target || '',
      outcome: outcome,
      conspirators: (plot.conspirators || []).slice(),
      reason: reason || plot.reason || '',
      _fromEngine: true,
      _qamGated: qamGated || undefined
    });
    var inst = _findChar(G, plot.ringleader);
    if (inst && (outcome === 'suppressed' || outcome === 'failed')) {
      inst._imprisoned = true;
      inst._conspiracyConvicted = true;
      inst._imprisonedTurn = G.turn || 0;
      inst._imprisonReason = '谋逆事发·下诏狱待勘';
    }
    if (!G.turnChanges) G.turnChanges = {};
    if (!Array.isArray(G.turnChanges.variables)) G.turnChanges.variables = [];
    G.turnChanges.variables.push({ path: '_conspiracies', label: '谋逆·' + plot.ringleader + '·' + action + '/' + outcome, delta: 1, reason: reason || '阴谋推演' });
  }

  // ─── 萌发新阴谋 ───
  function _spawn(G, rng, monthRatio) {
    if (G._activePlots.length >= CFG.maxActivePlots) return;
    var playerNm = _playerName(G);
    var leading = {};
    G._activePlots.forEach(function (p) { leading[p.ringleader] = true; });

    // 本回合 NPC 自主「暗中串联」意图(未被引擎消费的)→ 强信号
    var intents = Array.isArray(G._pendingNpcConspiracies) ? G._pendingNpcConspiracies : [];
    var intentByName = {};
    intents.forEach(function (it) {
      if (!it || it._engineConsumed) return;
      it._engineConsumed = true;
      if (it.from) intentByName[it.from] = it;
    });

    var pool = _liveChars(G).filter(function (ch) { return !leading[ch.name] && _eligibleRingleader(ch); });
    // 先 NPC 意图者·再纯属性者·稳定排序(确定性)
    pool.sort(function (a, b) {
      var ai = intentByName[a.name] ? 1 : 0, bi = intentByName[b.name] ? 1 : 0;
      if (ai !== bi) return bi - ai;
      return (b.ambition || 50) - (a.ambition || 50) || String(a.name).localeCompare(String(b.name));
    });

    for (var i = 0; i < pool.length; i++) {
      if (G._activePlots.length >= CFG.maxActivePlots) break;
      var ch = pool[i];
      var hasIntent = !!intentByName[ch.name];
      var ambFactor = clamp((ch.ambition || 50) / 70, 0.6, 1.4);
      var base = (hasIntent ? CFG.spawnChanceIntent : CFG.spawnChanceBase) * monthRatio * ambFactor;
      if (rng() >= clamp(base, 0, 0.95)) continue;

      // 目标 + 类型判定
      var intentTarget = hasIntent ? (intentByName[ch.name].target || '') : '';
      var target, kind, reason;
      if (_hasMilitary(ch) || (ch.loyalty || 50) < 30) {
        // 拥兵/极不忠 → 图谋社稷
        target = playerNm || '社稷';
        kind = 'coup';
        reason = ((ch.loyalty || 50) < 30 ? '怀异志' : '拥兵自重') + '·阴蓄逆谋';
      } else if (intentTarget && intentTarget !== ch.name && intentTarget !== '同党' && intentTarget !== '朝廷') {
        // 针对政敌的构陷/排挤
        target = intentTarget;
        kind = 'plot';
        reason = '阴图倾陷' + intentTarget;
      } else {
        target = playerNm || '朝廷';
        kind = 'coup';
        reason = '志大而怨望·潜结死党';
      }

      G._activePlots.push({
        id: 'plot_' + (G.turn || 0) + '_' + _hash(ch.name + '|' + (G.turn || 0)).toString(36),
        ringleader: ch.name,
        target: target,
        kind: kind,
        conspirators: [],
        momentum: Math.round(CFG.momentumStartLo + rng() * (CFG.momentumStartHi - CFG.momentumStartLo)),
        secrecy: CFG.secrecyStart,
        exposure: 0,
        stage: 'brewing',
        startTurn: G.turn || 0,
        _ripeSince: null,
        _knownToPlayer: false,
        reason: reason
      });
      _eb('暗流', ch.name + '心怀叵测，似有所图。');
    }
  }

  // ─── 招募同谋 ───
  function _recruit(G, plot, rng, monthRatio) {
    if ((plot.conspirators || []).length >= CFG.maxConspirators) return;
    var lead = _findChar(G, plot.ringleader);
    // S1c·官位→门生故吏拉拢半径(flag 关 → _reach=1·阈值字节不变·rng 序列不变·零回归)
    var _reach = 1 + _officeConspiracyBonus(lead, G) / 60;
    if (rng() >= clamp(CFG.recruitChanceBase * monthRatio * _reach, 0, 0.9)) return;
    var taken = {};
    taken[plot.ringleader] = true;
    (plot.conspirators || []).forEach(function (n) { taken[n] = true; });
    var cands = _liveChars(G).filter(function (ch) {
      if (taken[ch.name] || ch.name === plot.target) return false;
      var amb = ch.ambition || 50, loy = ch.loyalty || 50;
      return amb >= 55 || loy < 50;
    });
    if (!cands.length) return;
    // 同派/同地/同党更易拉拢(确定性打分)
    cands.forEach(function (ch) {
      var s = (ch.ambition || 50) - (ch.loyalty || 50) * 0.5;
      if (lead) {
        if (ch.faction && ch.faction === lead.faction) s += 25;
        if (ch.party && ch.party === lead.party) s += 30;
        if (ch.location && ch.location === lead.location) s += 10;
      }
      ch._cScore = s;
    });
    cands.sort(function (a, b) { return (b._cScore - a._cScore) || String(a.name).localeCompare(String(b.name)); });
    var pick = cands[Math.floor(rng() * Math.min(3, cands.length))];
    if (pick) {
      plot.conspirators.push(pick.name);
      plot.secrecy = clamp(plot.secrecy - CFG.secrecyDecayPerAlly, 0, 100);
    }
  }

  // ─── 推进单条阴谋(密谋值/败露/招募) ───
  function _advance(G, plot, rng, monthRatio) {
    _recruit(G, plot, rng, monthRatio);
    var lead = _findChar(G, plot.ringleader);
    var capFactor = clamp(_cap(lead, G) / CFG.capPivot, 0.5, 1.6);
    var allies = (plot.conspirators || []).length;

    var dM = (CFG.momentumBase + allies * CFG.momentumPerAlly) * capFactor * monthRatio * (0.7 + rng() * 0.6);
    plot.momentum = clamp(plot.momentum + dM, 0, 140);

    // 败露: 人越多越漏·保密度越低越快·主谋越精明越能压(智高减泄)
    var hideFactor = clamp(1.4 - _cap(lead, G) / 120, 0.6, 1.4);
    var leakFromSecrecy = 1 + (CFG.secrecyStart - plot.secrecy) / 100;
    var dE = (CFG.exposureBase + allies * CFG.exposurePerAlly) * monthRatio * hideFactor * leakFromSecrecy * (0.6 + rng() * 0.8);
    plot.exposure = clamp(plot.exposure + dE, 0, 130);
    if (plot.exposure >= 55) plot._knownToPlayer = true;
  }

  // ─── 结算单条阴谋·返回 true 表示已了结(从活跃表移除) ───
  function _resolve(G, plot) {
    var throne = _isThronePlot(plot);
    var crimeFail = throne ? 'coup_failed' : 'plot_failed';
    var crimeUncover = throne ? 'coup_failed' : 'plot_uncovered';

    // 1) 事泄被擒(酝酿中败露)
    if (plot.exposure >= CFG.exposeThreshold) {
      _settle(G, plot, crimeUncover, 'suppressed', '事机不密·谋泄就擒', false);
      _eb('谋反', plot.ringleader + ' 阴谋败露，事泄就擒，下诏狱勘问。');
      return true;
    }

    // 2) 密谋值满·将发
    if (plot.momentum >= CFG.ripeThreshold) {
      if (throne && _throneStrong(G)) {
        // 君威正盛 → 确定性护栏·未遂下狱(与 P-QAM 同philosophy)
        var hq = (G.huangquan && typeof G.huangquan.index === 'number') ? Math.round(G.huangquan.index) : 50;
        var hw = (G.huangwei && typeof G.huangwei.index === 'number') ? Math.round(G.huangwei.index) : 50;
        _settle(G, plot, 'coup_failed', 'suppressed', '皇权 ' + hq + '·皇威 ' + hw + ' 正盛·事败就擒（护栏·未遂）', true);
        _eb('谋反', plot.ringleader + ' 谋逆将发，然君威正盛，事败就擒（确定性护栏·未遂）。');
        return true;
      }
      // 君威衰微 / 非社稷之谋 → 标「将发」交 AI 叙事爆发(Slice 2)·超时则自破兜底
      if (plot._ripeSince == null) {
        plot._ripeSince = G.turn || 0;
        plot.stage = 'ripe';
        plot._knownToPlayer = true;
        _eb('谋反', plot.ringleader + ' 谋逆将发，朝野汹汹，山雨欲来。');
        return false;
      }
      if ((G.turn || 0) - plot._ripeSince >= CFG.ripeTimeout) {
        _settle(G, plot, crimeFail, 'failed', '事机不密·迁延败露', false);
        _eb('谋反', plot.ringleader + ' 谋事迁延，机泄事败，终就缚。');
        return true;
      }
      return false;
    }

    plot.stage = 'brewing';
    return false;
  }

  // ─── 主入口:每回合 tick ───
  function tick(opts) {
    var G = _G();
    if (!G) return;
    ensure(G);
    if (G._conspiracyDisabled) return;

    var monthRatio = _monthRatioOf(opts);
    var turn = (opts && typeof opts.turn === 'number') ? opts.turn : (G.turn || 0);
    var rng = _makeRng('conspiracy_T' + turn);

    // 0) 剪枝: 主谋已亡/已下狱/已外放·或已被 AI 走旧路坐实(record_conspiracy_events) → 移除活跃条目
    //    AI 在叙事中收束某阴谋(成败皆然)·会落非引擎来源的 _conspiracies·据主谋名近回合去重·避免引擎重复推演。
    var aiResolved = {};
    (G._conspiracies || []).forEach(function (c) {
      if (c && !c._fromEngine && c.instigator && ((G.turn || 0) - (c.turn || 0)) <= 2) aiResolved[c.instigator] = true;
    });
    G._activePlots = G._activePlots.filter(function (plot) {
      var lead = _findChar(G, plot.ringleader);
      if (!lead || !_alive(lead) || lead._conspiracyConvicted) return false;
      if (aiResolved[plot.ringleader]) return false;
      return true;
    });

    // 1) 玩家反制(读既有通道原文·推高目标败露·先于本回合结算)
    applyPlayerCounterIntel(G);

    // 2) 萌发
    _spawn(G, rng, monthRatio);

    // 3) 推进 + 4) 结算
    var survivors = [];
    for (var i = 0; i < G._activePlots.length; i++) {
      var plot = G._activePlots[i];
      _advance(G, plot, rng, monthRatio);
      var done = _resolve(G, plot);
      if (!done) survivors.push(plot);
    }
    G._activePlots = survivors;
  }

  // ─── 只读视图(给 UI / AI 上下文用·Slice 2/3) ───
  function activePlots(G) {
    G = G || _G();
    return (G && Array.isArray(G._activePlots)) ? G._activePlots : [];
  }
  // 玩家可侦知的阴谋(已露端倪)
  function knownPlots(G) {
    return activePlots(G).filter(function (p) { return p._knownToPlayer; });
  }

  function _kindCN(k) { return ({ coup: '图谋社稷', regicide: '弑君', palace_coup: '宫变', plot: '构陷政敌' })[k] || '阴谋'; }
  function _heatCN(p) {
    if (p.stage === 'ripe') return '将发';
    if (p.momentum >= 70) return '酝酿已深';
    if (p.momentum >= 40) return '渐成气候';
    return '初萌';
  }
  // AI 叙事上下文块(喂进 endturn prompt·让叙事者知道谁在密谋·将发者交其决成败)
  // W3·补盲区：除定性热度桶外，附原始运行态数值（密谋值/败露度/同谋数/酝酿回合），让叙事者据真值把握火候，
  //   而非只见「酝酿已深」这类粗桶（此前 momentum/exposure 数值对 AI 不可见，是世界反应总线 W3 盲区之一）。
  function _plotRuntime(G, p, rosterWord) {
    var nowT = (G && G.turn) || 0;
    var aged = Math.max(0, nowT - (p.startTurn || 0));
    var roster = (p.conspirators && p.conspirators.length)
      ? ('·' + (rosterWord || '同谋') + p.conspirators.length + '人（' + p.conspirators.slice(0, 3).join('、') + (p.conspirators.length > 3 ? '等' : '') + '）')
      : '';
    return '·密谋' + Math.round(p.momentum || 0) + '·败露' + Math.round(p.exposure || 0) + roster + (aged ? ('·已酿' + aged + '回合') : '');
  }
  function aiContextBlock(G) {
    G = G || _G();
    var plots = activePlots(G);
    if (!plots.length) return '';
    var brew = plots.filter(function (p) { return p.stage !== 'ripe'; });
    var ripe = plots.filter(function (p) { return p.stage === 'ripe'; });
    var s = '【密谋·暗流】朝中暗流涌动（机械引擎逐回合推演·密谋值满100将发、败露满100则事泄就擒·请据火候在叙事中呼应·勿凭空另起重复阴谋）：\n';
    brew.forEach(function (p) {
      s += '  ' + p.ringleader + ' 暗中' + _kindCN(p.kind) + (p.target ? ('（指 ' + p.target + '）') : '') + '·' + _heatCN(p)
        + _plotRuntime(G, p, '同谋')
        + (p._knownToPlayer ? '·已露端倪' : '·尚隐秘') + '\n';
    });
    ripe.forEach(function (p) {
      s += '  ★将发：' + p.ringleader + ' ' + _kindCN(p.kind) + (p.target ? ('（指 ' + p.target + '）') : '')
        + _plotRuntime(G, p, '党羽')
        + ' — 君威已衰·蓄势待发；你可据剧情决其成败，若坐实务必 record_conspiracy_events 记录。\n';
    });
    s += '  ※ 已了结者(下狱/伏诛)勿重复另立；引擎会自行酝酿与败露。\n';
    return s;
  }

  // ─── 玩家反制(走既有通道·零新 UI) ───
  //   玩家在 诏书/奏疏朱批/问对·朝议/鸿雁传书 里下达查办意图 → 引擎读这些通道在 GM 上的原文·
  //   推高目标阴谋的败露度(并挫其密谋值)·使其更易被本回合 _resolve 破获就擒。
  var CI_VERB = /查办|查抄|查处|查究|查察|查勘|查实|严查|彻查|密查|追查|查捕|缉拿|缉捕|缉获|侦缉|侦知|侦察|搜捕|搜拿|锁拿|拿问|拿办|勘问|鞫问|讯鞫|按问|究治|根究|穷治|查禁|查拿/;
  var CI_AGENCY = /锦衣卫|东厂|西厂|内厂|厂卫|缇骑|镇抚司|诏狱/;
  var CI_PLOT = /谋逆|谋反|逆党|逆谋|阴谋|异志|逆迹|逆案|图谋不轨|心怀叵测|蓄谋|私党|结党营私/;

  // 解析玩家通道原文 → {targets:[主谋名], general:是否泛缉}
  function scanCounterIntel(text, G) {
    text = String(text || '');
    if (!text) return { targets: [], general: false };
    var hasVerb = CI_VERB.test(text), hasAgency = CI_AGENCY.test(text), hasPlot = CI_PLOT.test(text);
    if (!hasVerb && !hasAgency) return { targets: [], general: false };
    var targets = [];
    activePlots(G).forEach(function (p) {
      var names = [p.ringleader].concat(p.conspirators || []);
      for (var i = 0; i < names.length; i++) {
        if (names[i] && text.indexOf(names[i]) >= 0) { if (targets.indexOf(p.ringleader) < 0) targets.push(p.ringleader); break; }
      }
    });
    var general = hasPlot && (hasVerb || hasAgency) && targets.length === 0;
    return { targets: targets, general: general };
  }

  // 对某人相关的阴谋施查(推高败露·挫密谋)·返回命中阴谋数
  function investigate(G, target, opts) {
    G = G || _G(); if (!G || !target) return 0;
    opts = opts || {};
    var intensity = opts.intensity != null ? opts.intensity : 45;
    var hit = 0;
    activePlots(G).forEach(function (p) {
      var involved = p.ringleader === target || (p.conspirators || []).indexOf(target) >= 0;
      if (!involved) return;
      p.exposure = clamp(p.exposure + intensity, 0, 130);
      p.momentum = clamp(p.momentum - intensity * 0.4, 0, 140);
      p._knownToPlayer = true;
      p._investigatedTurn = G.turn || 0;
      hit++;
    });
    return hit;
  }

  // 泛缉(无具名·整肃厂卫密查逆谋)→ 全阴谋败露度小涨
  function _sweep(G, intensity) {
    var hit = 0;
    activePlots(G).forEach(function (p) { p.exposure = clamp(p.exposure + intensity, 0, 130); p._knownToPlayer = true; hit++; });
    return hit;
  }

  // 汇集刚结束的玩家回合在各既有通道留下的原文(诏书/朱批/朝议问对/鸿雁)
  function _gatherPlayerTurnText(G) {
    var turn = (G.turn || 0) - 1;   // tick 在 GM.turn++ 之后·玩家回合 = 当前-1
    var player = _playerName(G);
    var parts = [];
    (G._edictTracker || []).forEach(function (e) { if (e && e.turn === turn && e.content) parts.push(String(e.content)); });
    (G.memorials || []).forEach(function (m) { if (m && m.reply && (m._repliedTurn === turn || m.turn === turn)) parts.push(String(m.reply)); });
    (G._courtRecords || []).forEach(function (c) {
      if (!c || (c.turn !== turn && c.targetTurn !== turn)) return;
      if (c.topic) parts.push(String(c.topic));
      (c.decisions || []).forEach(function (d) { if (d && d.label) parts.push(String(d.label)); });
      (c.transcript || []).forEach(function (t) { if (t && t.text && (t.speaker === player || /陛下|君上|朕|皇帝|主上|圣/.test(String(t.speaker || '')))) parts.push(String(t.text)); });
    });
    (G.letters || []).forEach(function (l) { if (l && l.sentTurn === turn && l.content && (l.from === '玩家' || l.from === player)) parts.push(String(l.content)); });
    return parts.join('\n');
  }

  // 玩家反制总入口(tick 内调·每回合一次)
  function applyPlayerCounterIntel(G) {
    G = G || _G(); if (!G) return { targeted: 0, swept: 0 };
    if (G._conspiracyLastScanTurn === G.turn) return { targeted: 0, swept: 0 };
    G._conspiracyLastScanTurn = G.turn;
    var text = _gatherPlayerTurnText(G);
    if (!text) return { targeted: 0, swept: 0 };
    var scan = scanCounterIntel(text, G);
    var targeted = 0, swept = 0;
    scan.targets.forEach(function (t) { if (investigate(G, t, { intensity: 48 }) > 0) { targeted++; _eb('厂卫', '奉旨查办 ' + t + '·缇骑四出·阴事渐彰。'); } });
    if (scan.general) { swept = _sweep(G, 18); if (swept) _eb('厂卫', '厂卫奉旨密缉逆谋·风声鹤唳·诸隐谋人人自危。'); }
    return { targeted: targeted, swept: swept };
  }

  global.ConspiracyEngine = {
    CFG: CFG,
    tick: tick,
    activePlots: activePlots,
    knownPlots: knownPlots,
    aiContextBlock: aiContextBlock,
    scanCounterIntel: scanCounterIntel,
    investigate: investigate,
    applyPlayerCounterIntel: applyPlayerCounterIntel,
    // 测试 / 内部
    _spawn: _spawn,
    _advance: _advance,
    _resolve: _resolve,
    _makeRng: _makeRng,
    _eligibleRingleader: _eligibleRingleader,
    _throneStrong: _throneStrong,
    _cap: _cap,
    _officeConspiracyBonus: _officeConspiracyBonus,
    _officeConspiracyOn: _officeConspiracyOn,
    ensure: ensure
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ConspiracyEngine;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
