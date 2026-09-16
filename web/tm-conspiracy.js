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
    exposeThreshold: 100,     // 败露度≥此·事泄被擒(不变·保玩家查案+48仍有效)
    // —— 密探常侦(S4·2026-07-02·flag agencyWatchEnabled 默认关) ——
    agencyBase: 6,            // 单个满效密探机构每回合基础侦缉强度(远弱于具名查办48/人工泛缉18)
    agencyCap: 16,            // 多机构叠加封顶·常侦不强过陛下亲自下诏泛缉
    agencyIndepMax: 30        // 机构独立性≤此才算「直属天子之密探」·台谏(独立性高)不做暗侦
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
  // 内廷近侍(宦官/内官)判定——供刀丁3/4 palace_coup 分流(内竖劫主)。
  function _isInnerCourt(ch) {
    return !!(ch && /宦|内官|内侍|中官|太监|内廷|司礼|掌印|秉笔/.test(String(ch.role || ch.officialTitle || ch.title || ch.faction || '')));
  }

  // ─── 刀丁3/4/5 总闸：逆案裁断·阴谋真发动(flag conspiracyResolutionEnabled·默认 ON) ───
  //   ON  → 叙事阴谋播种机械 plot(seedFromNarrative)·ripe 到期走五级发动出口(_resolveRipe)·suppressed 结局同谋连坐。
  //   OFF → seedFromNarrative no-op·ripe 到期回旧「自破兜底」·_settle 只拿主谋 = 旧行为等价(零回归)。
  function _resolutionOn() {
    try { var P = global.P || {}; var conf = P.conf || {}; return !(conf.conspiracyResolutionEnabled === false); } catch (e) { return true; }
  }
  // 社稷类词(播种为机械阴谋的门槛)/ 民变类词(五级发动出口的民变 modifier)。
  var SEED_PLAN_RE = /弑|篡|逆|政变|兵变|废立|清君侧|挟(?:天子|君|主|上|持)/;
  var SEED_UPRISING_RE = /民变|义军|流民|流寇|揭竿|起义|乱民|聚众/;
  // 解析叙事 allies 字符串(顿号/逗号分隔)→ 在册活人非玩家名单(≤5)。
  function _parseAllies(G, alliesStr, ringleader) {
    var out = [];
    if (!alliesStr) return out;
    String(alliesStr).split(/[、,，;；\s]+/).forEach(function (nm) {
      nm = (nm || '').trim();
      if (!nm || nm === ringleader || out.length >= 5 || out.indexOf(nm) >= 0) return;
      var ch = _findChar(G, nm);
      if (ch && !ch.isPlayer && _alive(ch)) out.push(nm);
    });
    return out;
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

  // ─── 落库(纯史录·不下狱·供得逞/流亡类结局用) ───
  function _recordConspiracy(G, plot, action, outcome, reason, qamGated) {
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
    if (!G.turnChanges) G.turnChanges = {};
    if (!Array.isArray(G.turnChanges.variables)) G.turnChanges.variables = [];
    G.turnChanges.variables.push({ path: '_conspiracies', label: '谋逆·' + plot.ringleader + '·' + action + '/' + outcome, delta: 1, reason: reason || '阴谋推演' });
  }
  // ─── 落库 + 下狱(复用既有结构/护栏) ───
  function _settle(G, plot, action, outcome, reason, qamGated) {
    _recordConspiracy(G, plot, action, outcome, reason, qamGated);
    var inst = _findChar(G, plot.ringleader);
    if (inst && (outcome === 'suppressed' || outcome === 'failed')) {
      inst._imprisoned = true;
      inst._conspiracyConvicted = true;
      inst._imprisonedTurn = G.turn || 0;
      inst._imprisonReason = '谋逆事发·下诏狱待勘';
      // 刀丁5·同谋牵连羁押(flag ON)：suppressed 族结局·同谋随主谋下狱(在册活人·非玩家·≤5·主谋 convicted 照旧)。
      if (_resolutionOn()) {
        var _coCnt = 0;
        (plot.conspirators || []).forEach(function (nm) {
          if (_coCnt >= 5) return;
          var co = _findChar(G, nm);
          if (!co || co === inst || co.isPlayer || !_alive(co)) return;
          co._imprisoned = true;
          co._imprisonedTurn = G.turn || 0;
          co._imprisonReason = '逆案连坐';
          _coCnt++;
          try { if (typeof global.NpcMemorySystem !== 'undefined' && global.NpcMemorySystem.remember) global.NpcMemorySystem.remember(nm, '因' + plot.ringleader + '逆案牵连下狱', '惧', 6, plot.ringleader); } catch (_) {}
        });
      }
    }
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
  function _institutionalPalacePlot(G,plot) {
    if(!plot||plot.kind!=='palace_coup')return false;
    var pm=G&&G.huangquan&&G.huangquan.powerMinister;
    return !!(pm&&pm.mode==='institutional')||!!(global.AuthorityEngines&&global.AuthorityEngines.powerMinisterMode&&global.AuthorityEngines.powerMinisterMode(G)==='institutional');
  }
  function _deferPalaceResolution(G,plot,reason) {
    reason=reason||'宫中动向尚须具实查核，废立与拿问不得仅凭疑势定案';
    if(!plot._resolutionPending)plot._resolutionPending={turn:G.turn||0,reason:reason};
    return {ok:false,applied:false,requiresResolution:true,reason:reason};
  }

  function _resolve(G, plot) {
    if(_institutionalPalacePlot(G,plot)&&(plot._resolutionPending||plot.momentum>=CFG.ripeThreshold||plot.exposure>=CFG.exposeThreshold)){_deferPalaceResolution(G,plot);return false;}
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
        if (_resolutionOn()) { var result=_resolveRipe(G,plot);return !(result&&result.requiresResolution); }   // 刀丁4·五级发动出口(引擎定判)；flag OFF 落下方旧自破兜底(零回归)
        _settle(G, plot, crimeFail, 'failed', '事机不密·迁延败露', false);
        _eb('谋反', plot.ringleader + ' 谋事迁延，机泄事败，终就缚。');
        return true;
      }
      return false;
    }

    plot.stage = 'brewing';
    return false;
  }

  // ─── 刀丁3·叙事→机械桥(单向+去重) ───
  //   sc15/sc1c 落 activeSchemes 时·对「即将发动」且 plan 含社稷类词的条目·播种为机械 plot(_activePlots)：
  //     同主谋已有活跃 plot → 只强化 momentum(+10 封顶)不重开；无则开新 plot(momentum 起 60·conspirators=allies 在册活人≤5)。
  //   回标 scheme._seededPlotId(供 prompt 注入去重 R-3：机械账 aiContextBlock 已注入·不双喂)。flag OFF → 整体 no-op(零回归)。
  function seedFromNarrative(scheme, G) {
    G = G || _G();
    if (!G || !scheme || !_resolutionOn()) return null;
    ensure(G);
    var plan = String(scheme.plan || '');
    if (String(scheme.progress || '') !== '即将发动') return null;
    if (!SEED_PLAN_RE.test(plan) && !SEED_UPRISING_RE.test(plan)) return null;
    var schemer = scheme.schemer;
    if (!schemer) return null;
    var lead = _findChar(G, schemer);
    if (!lead || lead.isPlayer || !_alive(lead)) return null;
    // 去重：同主谋已有活跃 plot → 只强化不重开
    var existing = null;
    for (var i = 0; i < G._activePlots.length; i++) {
      if (G._activePlots[i] && G._activePlots[i].ringleader === schemer) { existing = G._activePlots[i]; break; }
    }
    if (existing) {
      if (existing._seedReinforcedTurn !== (G.turn || 0)) {
        existing.momentum = clamp(existing.momentum + 10, 0, 140);
        existing._seedReinforcedTurn = G.turn || 0;
      }
      if (existing._narrativePlan == null) existing._narrativePlan = plan;
      scheme._seededPlotId = existing.id;
      return existing;
    }
    if (G._activePlots.length >= CFG.maxActivePlots) return null;
    // kind 判定(R-7)：拥兵→mutiny·内廷近侍→palace_coup·其余→coup(民变 modifier 在 _resolveRipe 按 plan 分流)。
    var playerNm = _playerName(G);
    var kind = _hasMilitary(lead) ? 'mutiny' : (_isInnerCourt(lead) ? 'palace_coup' : 'coup');
    var plot = {
      id: 'plot_seed_' + (G.turn || 0) + '_' + _hash(schemer + '|' + (G.turn || 0)).toString(36),
      ringleader: schemer,
      target: playerNm || scheme.target || '社稷',
      kind: kind,
      conspirators: _parseAllies(G, scheme.allies, schemer),
      momentum: 60,
      secrecy: CFG.secrecyStart,
      exposure: 0,
      stage: 'brewing',
      startTurn: G.turn || 0,
      _ripeSince: null,
      _knownToPlayer: false,
      reason: plan.slice(0, 40) || '叙事阴谋播种',
      _fromNarrative: true,
      _narrativePlan: plan,
      _seedReinforcedTurn: G.turn || 0
    };
    G._activePlots.push(plot);
    scheme._seededPlotId = plot.id;
    _eb('暗流', schemer + ' 的密谋已成气候，机杼暗转。');
    return plot;
  }

  // ─── 刀丁4·统一发动出口(引擎定判·AI 描红)·flag conspiracyResolutionEnabled(默认 ON) ───
  //   ripe 到期(交 AI 两回合无人收束)改走确定性五级选择器：先过 P-QAM 硬门(君威盛→未遂下狱·镜像
  //   tm-endturn-apply-stages.js:604·勿开第二得逞路)·过门后按 kind 分流。全部结局落 GM._conspiracies 带 _fromEngine(R-5)。
  function _isUprisingPlan(plot) {
    return SEED_UPRISING_RE.test(String(plot._narrativePlan || plot.reason || ''));
  }
  function _resolveRipe(G, plot) {
    if(_institutionalPalacePlot(G,plot))return _deferPalaceResolution(G,plot);
    // 民变 modifier 优先(plan 含 民/义军/流)→ 交 revolt 实体系统
    if (_isUprisingPlan(plot)) return _resolveUprising(G, plot);
    var kind = plot.kind;
    // 构陷政敌(非社稷之谋)→ 目标构陷入狱·无 P-QAM 门
    if (kind === 'plot') return _resolvePlotFrame(G, plot);
    // 社稷之谋：先过 P-QAM 硬门(君威盛→未遂下狱)
    if (_throneStrong(G)) {
      var hq = (G.huangquan && typeof G.huangquan.index === 'number') ? Math.round(G.huangquan.index) : 50;
      var hw = (G.huangwei && typeof G.huangwei.index === 'number') ? Math.round(G.huangwei.index) : 50;
      _settle(G, plot, 'coup_failed', 'suppressed', '皇权 ' + hq + '·皇威 ' + hw + ' 正盛·事败就擒（护栏·未遂·引擎发动）', true);
      _eb('谋反', plot.ringleader + ' 谋逆至期，然君威正盛，事败就擒（确定性护栏·未遂）。');
      return;
    }
    if (kind === 'mutiny') return _resolveMutiny(G, plot);
    if (kind === 'palace_coup') return _resolvePalaceCoup(G, plot);
    return _resolveCoupOnPlayer(G, plot);   // kind === 'coup'·目标=玩家
  }
  // 构陷政敌得逞：目标构陷下狱(主谋不下狱)。
  function _resolvePlotFrame(G, plot) {
    var target = _findChar(G, plot.target);
    if (target && !target.isPlayer && _alive(target)) {
      target._imprisoned = true;
      target._imprisonedTurn = G.turn || 0;
      target._imprisonReason = '为' + plot.ringleader + '构陷·下狱待勘';
      _eb('构陷', plot.ringleader + ' 构陷 ' + plot.target + ' 得逞，' + plot.target + ' 被诬下狱。');
      try {
        if (typeof global.NpcMemorySystem !== 'undefined' && global.NpcMemorySystem.remember) {
          global.NpcMemorySystem.remember(plot.target, '为' + plot.ringleader + '构陷下狱', '恨', 8, plot.ringleader);
          global.NpcMemorySystem.remember(plot.ringleader, '构陷' + plot.target + '得逞', '喜', 5, plot.target);
        }
      } catch (_) {}
    }
    _recordConspiracy(G, plot, 'plot_succeeded', 'succeeded', '构陷' + plot.target + '得逞', false);
  }
  // 拥兵者兵变：emit army:mutinyRisk(前瞻·当前无监听)+主谋军队 morale 冲击+主谋流亡(_fled)。
  function _resolveMutiny(G, plot) {
    var lead = _findChar(G, plot.ringleader);
    try {
      var army = (G.armies || []).find(function (a) { return a && (a._commander === plot.ringleader || a.leader === plot.ringleader || a.commander === plot.ringleader); });
      if (army) {
        if (typeof army.morale === 'number') army.morale = Math.max(0, army.morale - 25);
        if (typeof global.GameEventBus !== 'undefined' && global.GameEventBus.emit) global.GameEventBus.emit('army:mutinyRisk', { army: army.name, risk: 90, owner: army.faction || (lead && lead.faction) || '' });
      }
    } catch (_) {}
    if (lead) { lead._fled = true; lead._missing = true; lead._fledTurn = G.turn || 0; lead._fledReason = '兵变事泄·畏罪出奔'; }
    _eb('兵变', plot.ringleader + ' 举兵而事不果，军心离散，遂拥众出奔，亡命江湖。');
    try { if (typeof global.NpcMemorySystem !== 'undefined' && global.NpcMemorySystem.remember) global.NpcMemorySystem.remember(plot.ringleader, '举兵败露·流亡', '惧', 8, ''); } catch (_) {}
    _recordConspiracy(G, plot, 'mutiny', 'failed', '兵变事泄·主谋流亡', false);
  }
  // 内廷近侍宫变：仅君威严重衰微(镜像 authority-complete:247 controlLevel>0.9 语境)方成废帝·不足降级未遂下狱。
  function _resolvePalaceCoup(G, plot) {
    var lead = _findChar(G, plot.ringleader);
    var hw = (G.huangwei && typeof G.huangwei.index === 'number') ? G.huangwei.index : 50;
    var hq = (G.huangquan && typeof G.huangquan.index === 'number') ? G.huangquan.index : 50;
    var authC = global.AuthorityComplete;
    if (hw < 30 && hq < 40 && authC && typeof authC.powerMinisterEndgame === 'function') {
      // 复用 R1d 废帝(_powerMinisterEndgame·非终局·玩家角色不死则续玩)·勿在此另起弑君终局。
      var result=authC.powerMinisterEndgame({ name: plot.ringleader, innerCourt: _isInnerCourt(lead) }, 'usurpation', { turn: G.turn || 0 });
      if(result&&result.requiresResolution)return _deferPalaceResolution(G,plot,result.reason);
      _recordConspiracy(G, plot, 'palace_coup', 'succeeded', '宫变废立·' + (_isInnerCourt(lead) ? '挟主' : '禅代') + '得逞', false);
      _eb('国变', plot.ringleader + ' 宫变得逞，废立之局成。');
    } else {
      _settle(G, plot, 'coup_failed', 'suppressed', '宫变将发·君威未至倾覆·事败就擒（未遂·引擎发动）', false);
      _eb('宫变', plot.ringleader + ' 谋宫变，然事机不熟，反为所擒，下诏狱。');
    }
  }
  // 图谋社稷·目标=玩家：构造 record_conspiracy_events 同形事件·走 apply-stages 同一 sink(P-QAM 门+regicide→adjudicatePlayerDeath)·带 _fromEngine。
  function _resolveCoupOnPlayer(G, plot) {
    var playerNm = _playerName(G);
    var ev = {
      action: 'regicide', outcome: 'succeeded',
      instigator: plot.ringleader, target: playerNm || plot.target || '',
      conspirators: (plot.conspirators || []).slice(),
      reason: String(plot._narrativePlan || plot.reason || '逆谋弑君').slice(0, 60)
    };
    var sink = global.TM && global.TM.Endturn && global.TM.Endturn.AI && global.TM.Endturn.AI.apply;
    if (sink && typeof sink._applyOneConspiracyEvent === 'function') {
      sink._applyOneConspiracyEvent(ev, { fromEngine: true });   // 抽公共函数两处调·君威盛→未遂下狱·君威衰→裁决器定生死
    } else {
      _settle(G, plot, 'coup_failed', 'suppressed', 'sink 缺失兜底·未遂下狱', true);
    }
    _eb('谋反', plot.ringleader + ' 谋逆至期，图穷匕见（引擎发动·交裁决器定生死）。');
  }
  // 涉民变：ClassMinxinBridge 播种候选 + 主谋交 revolt 实体系统当渠帅候选(revoltEntityEnabled 默认 ON·身份行为交 AI 演绎)。
  function _resolveUprising(G, plot) {
    var lead = _findChar(G, plot.ringleader);
    try {
      var bridge = global.TM && global.TM.ClassMinxinBridge;
      if (bridge && typeof bridge.spawnUprisingCandidates === 'function') bridge.spawnUprisingCandidates(G, { turn: G.turn || 0, source: 'conspiracy_' + plot.ringleader });
    } catch (_) {}
    try {
      var _r2On = !(global.P && global.P.conf && global.P.conf.revoltEntityEnabled === false);
      if (_r2On && G.minxin) {
        if (!Array.isArray(G.minxin.revolts)) G.minxin.revolts = [];
        var region = (lead && lead.location) || '畿辅';
        G.minxin.revolts.push({ id: 'revolt_consp_' + (G.turn || 0) + '_' + _hash(plot.ringleader + '|' + (G.turn || 0)).toString(36), turn: G.turn || 0, region: region, scale: 'medium', level: 3, status: 'ongoing', leader: plot.ringleader, _fromConspiracy: true });
        if (G.minxin.revolts.length > 30) G.minxin.revolts = G.minxin.revolts.slice(-30);
        if (lead) { lead._joinedRevolt = true; lead._revoltLeaderCandidate = true; }
        _eb('民变', plot.ringleader + ' 揭竿聚众，啸聚为乱，自号渠帅。');
      } else {
        _eb('民变', plot.ringleader + ' 煽动流民，乱象已萌。');
      }
    } catch (_) {}
    try { if (typeof global.NpcMemorySystem !== 'undefined' && global.NpcMemorySystem.remember) global.NpcMemorySystem.remember(plot.ringleader, '举义聚众为乱', '平', 7, ''); } catch (_) {}
    _recordConspiracy(G, plot, 'uprising', 'succeeded', '聚众举义·入民变渠帅候选', false);
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

    // 1.5) 密探常侦(S4·flag 默认关·零回归): 常设直属天子的密探机构暗中侦缉·确定性推高在酿阴谋败露
    _agencyWatch(G);

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

  function _kindCN(k) { return ({ coup: '图谋社稷', regicide: '弑君', palace_coup: '宫变', mutiny: '兵变', plot: '构陷政敌' })[k] || '阴谋'; }
  function _heatCN(p) {
    if(p._resolutionPending)return '尚待查实';
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
    var pending=plots.filter(function(p){return p._resolutionPending;}),brew = plots.filter(function (p) { return !p._resolutionPending&&p.stage !== 'ripe'; });
    var ripe = plots.filter(function (p) { return !p._resolutionPending&&p.stage === 'ripe'; });
    var s = '【密谋·暗流】朝中暗流涌动（机械引擎逐回合推演·密谋值满100将发、败露满100则事泄就擒·请据火候在叙事中呼应·勿凭空另起重复阴谋）：\n';
    if(pending.length)s='【宫中动向与查核】疑势与确证须分，以下未有处分及承办回报者，不得先叙为废立得逞或已被拿问。\n';
    pending.forEach(function(p){s+='  '+p.ringleader+'所涉宫中动向：'+p._resolutionPending.reason+'。\n';});
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

  // ─── 密探常侦(S4·2026-07-02) ───
  // 常设的直属天子密探机构(读 GM.corruption.supervision.institutions·独立性≤agencyIndepMax 者)逐回合暗中侦缉·
  //   确定性推高全部在酿阴谋败露(纯加法不触 rng·flag 关返 0 = 零回归·同 _officeConspiracyBonus 范式)。
  //   效力=覆达radius×(1-腐败×0.7)×(1-缺员)·机构烂了侦缉自然打折;特务坐大反噬由腐败引擎既有累加器制衡。
  //   不置 _knownToPlayer(常侦静默积累·非向玩家亮牌)·不落事件簿——密探事泄被擒时自会显形。
  //   启用:P.conf.agencyWatchEnabled = true(设置面板「玩法机制·深化」有开关)。
  function _agencyWatchOn() {
    try {
      var P = global.P || {};
      var ai = P.ai || {}, conf = P.conf || {};
      return !!(ai.agencyWatchEnabled || conf.agencyWatchEnabled);
    } catch (e) { return false; }
  }
  function _agencyWatch(G) {
    G = G || _G(); if (!G || !_agencyWatchOn()) return 0;
    var sup = G.corruption && G.corruption.supervision;
    var insts = sup && sup.institutions;
    if (!Array.isArray(insts) || !insts.length) return 0;
    var eff = 0;
    insts.forEach(function (i) {
      if (!i || typeof i !== 'object') return;
      if ((i.independence == null ? 100 : i.independence) > CFG.agencyIndepMax) return;
      var reach = clamp((i.radius == null ? 60 : i.radius), 0, 100) / 100;
      var rot = clamp(i.corruption || 0, 0, 100) / 100;
      var vac = clamp(i.vacancies || 0, 0, 1);
      eff += reach * (1 - rot * 0.7) * (1 - vac);
    });
    if (eff <= 0) return 0;
    var intensity = Math.min(CFG.agencyCap, Math.round(CFG.agencyBase * eff));
    if (intensity <= 0) return 0;
    activePlots(G).forEach(function (p) { p.exposure = clamp(p.exposure + intensity, 0, 130); });
    // S2·密探回禀：衙门既已在职常侦·凡露端倪(_knownToPlayer·过55亮牌线或经查办)之在酿阴谋·
    //   递密报入御案时政(每谋一报·plot._agencyReported 防重)·玩家可循报下诏查办(走既有反制扫描)。
    //   措辞留白(渐炽/将发)不给真值——密探只报行迹·真相要玩家自己穷治。
    activePlots(G).forEach(function (p) {
      if (!p || !p._knownToPlayer || p._agencyReported) return;
      p._agencyReported = true;
      if (!Array.isArray(G.currentIssues)) return;
      var vague = p.momentum >= 70 ? '事似将发·不可不察' : (p.momentum >= 35 ? '其谋渐炽' : '尚在酝酿');
      G.currentIssues.push({
        id: 'iss_spy_' + (p.id || p.ringleader),
        title: '密探回禀 · ' + p.ringleader + ' 行迹诡秘',
        description: '密探侦得：' + p.ringleader + ((p.conspirators && p.conspirators.length) ? ' 与 ' + p.conspirators.length + ' 人过从诡秘' : ' 近来行迹诡秘') + '，' + vague + '。若欲穷治，可下诏命有司查办其人。',
        category: '朝局', status: 'pending', raisedTurn: G.turn || 0, _info: true, _spyReport: true
      });
    });
    // ─── S3·暗流风闻(2026-07-06·方向五谍报线收官) ───
    //   常侦不止侦阴谋——推演暗流(sc15 hidden_moves·followup 落 GM._recentHiddenMoves 缓冲)亦入密探耳目。
    //   门槛 intensity>=6(至少一座满效衙门·弱衙门捕不到暗流)·每回合至多2报·同人同类8回合窗内不重报
    //   (GM._agencyMoveReported)·措辞留白只报风闻类别不给原文——真相要玩家自己穷治(与S2密报同则)。
    (function _agencyCovertMoves() {
      if (intensity < 6) return;
      var buf = G._recentHiddenMoves;
      if (!buf || !Array.isArray(buf.moves) || !buf.moves.length) return;
      if (typeof buf.turn === 'number' && buf.turn < (G.turn || 0) - 2) return;   // 陈年缓冲不报
      if (!Array.isArray(G.currentIssues)) return;
      if (!Array.isArray(G._agencyMoveReported)) G._agencyMoveReported = [];
      var seen = G._agencyMoveReported;
      function _mvCat(text) {
        if (/通敌|外藩|敌国|私通北|私通external/.test(text)) return '疑通外镇';
        if (/结党|串联|密会|过从|朋党|联络/.test(text)) return '暗结朋党';
        if (/贿|银|贪|私相授受|财/.test(text)) return '贿门私通';
        if (/兵|军|卫|甲|武/.test(text)) return '私涉兵事';
        return '别有图谋';
      }
      var reported = 0;
      buf.moves.forEach(function (m) {
        if (reported >= 2 || !m || !m.actor || !m.text) return;
        var known = false;
        for (var ci = 0; ci < (G.chars || []).length; ci++) {
          var cc = G.chars[ci];
          if (cc && cc.name === m.actor && cc.alive !== false && !cc.isPlayer) { known = true; break; }
        }
        if (!known) return;   // 查无此人/已故/陛下本人——不报
        var c = _mvCat(String(m.text));
        var k = m.actor + '·' + c;
        var dupe = false;
        for (var ri = 0; ri < seen.length; ri++) {
          var r = seen[ri];
          if (r && r.k === k && ((G.turn || 0) - (r.turn || 0)) < 8) { dupe = true; break; }
        }
        if (dupe) return;
        seen.push({ k: k, turn: G.turn || 0 });
        if (seen.length > 24) seen.splice(0, seen.length - 24);
        G.currentIssues.push({
          id: 'iss_spy_move_' + (G.turn || 0) + '_' + m.actor,
          title: '密探风闻 · ' + m.actor + ' 私下有所动作',
          description: '密探风闻：' + m.actor + ' 近日行事多避耳目，迹类「' + c + '」，未得实据。若欲穷治，可下诏命有司查办其人。',
          category: '朝局', status: 'pending', raisedTurn: G.turn || 0, _info: true, _spyReport: true
        });
        reported++;
      });
    })();
    return intensity;
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
    seedFromNarrative: seedFromNarrative,
    // 测试 / 内部
    _spawn: _spawn,
    _advance: _advance,
    _resolve: _resolve,
    _resolveRipe: _resolveRipe,
    _settle: _settle,
    _recordConspiracy: _recordConspiracy,
    _resolutionOn: _resolutionOn,
    _isInnerCourt: _isInnerCourt,
    _makeRng: _makeRng,
    _eligibleRingleader: _eligibleRingleader,
    _throneStrong: _throneStrong,
    _cap: _cap,
    _officeConspiracyBonus: _officeConspiracyBonus,
    _officeConspiracyOn: _officeConspiracyOn,
    _agencyWatch: _agencyWatch,
    _agencyWatchOn: _agencyWatchOn,
    ensure: ensure
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.ConspiracyEngine;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
