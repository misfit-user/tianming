// ============================================================
//  tm-captive-court.js — 悬朝演绎层·北狩残局朝廷侧（批七·2026-07-21·AI 主导）
//
//  owner 三拍板：①立新君交回合演绎 AI(朝臣自行酝酿·玩家在贼营收到消息=失控才是北狩之痛)
//  ②新君立后玩家继续演太上皇(与裁决器「有储君继统」语义正交·夺门是翻盘牌)
//  ③夺门照范式：玩家复辟诏令即谋划(走诏令管线·无独立UI)·AI 权衡朝局定成败。
//
//  君上 _captured(批四破京 captured 态)期间·朝廷由本层当一等演员：每回合悬朝 subcall——
//  hold(观望·迎归/主战之争叙事)/regent(立监国)/proclaim_new(立新君·君上尊为太上皇)。
//  君上归(赎驾链 release_captive)而新君在位=一朝二主：复辟旨(复辟/夺门/复位/正位关键词)
//  喂入 subcall·AI 断 restoration(夺门成·太上皇复位)/crackdown(谋泄·蛰伏冷却)/hold。
//
//  宪法闸(只验不产)：人选须在档活人非俘非玩家·夺门须君已归+真有复辟旨+不在谋泄冷却·
//  复位真复位(称号账本双清)。双轨：AI 缺席=被虏 6 回合朝廷自立储君(resolveHeir)兜底·
//  兜底无监国无夺门(夺门之变非机械可断)。随 revoltEntityEnabled(破京链同族)。
//  本文件为 _regent/_rivalEmperor/称号迁转的唯一写口(已登记 gm-writes owners)。
// ============================================================
(function (global) {
  'use strict';

  var FALLBACK_PROCLAIM_TURNS = 6;   // 兜底轨：被虏满 N 回合朝廷自立储君
  var CRACKDOWN_COOLDOWN = 4;        // 谋泄后 N 回合内不再断夺门

  function enabled() {
    try { return !!(global.P && global.P.conf && global.P.conf.revoltEntityEnabled === true); }
    catch (_) { return false; }
  }
  function _aiOn() {
    try { return typeof global.callAI === 'function'; } catch (_) { return false; }
  }
  function _eb(msg) {
    try { if (typeof global.addEB === 'function') global.addEB('国变', msg); } catch (_) {}
  }
  function _chron(G, text) {
    try {
      if (!Array.isArray(G._chronicle)) G._chronicle = [];
      G._chronicle.push({ turn: G.turn || 0, date: G._gameDate || '', type: '国变', text: String(text).slice(0, 160), tags: ['悬朝', 'AI演绎'] });
    } catch (_) {}
  }
  function _player(G) {
    for (var i = 0; i < (G.chars || []).length; i++) {
      var c = G.chars[i];
      if (c && c.isPlayer && c.alive !== false) return c;
    }
    return null;
  }
  function _findChar(G, name) {
    name = String(name || '').trim();
    if (!name) return null;
    for (var i = 0; i < (G.chars || []).length; i++) {
      var c = G.chars[i];
      if (c && String(c.name || '') === name) return c;
    }
    return null;
  }
  // 嗣位候选：储君(resolveHeir)优先·血胤/同族/高品阶补齐(供 prompt 与宪法验人)
  function _heirCandidates(G, player) {
    var out = [], seen = {};
    function push(c) {
      if (!c || !c.name || seen[c.name]) return;
      if (c.isPlayer || c.alive === false || c._captured) return;
      seen[c.name] = 1; out.push(c);
    }
    try { if (typeof global.resolveHeir === 'function') push(global.resolveHeir(player)); } catch (_) {}
    (G.chars || []).forEach(function (c) {
      if (out.length >= 4 || !c) return;
      if (player && Array.isArray(player.childrenIds) && (player.childrenIds.indexOf(c.name) >= 0 || player.childrenIds.indexOf(c.id) >= 0)) push(c);
    });
    (G.chars || []).forEach(function (c) {
      if (out.length >= 4 || !c) return;
      if (player && c.family && player.family && c.family === player.family) push(c);
    });
    return out.slice(0, 4);
  }
  function _recentRestorationEdicts(G) {
    var kw = ['复辟', '夺门', '复位', '正位', '反正'];
    return (Array.isArray(G._edictTracker) ? G._edictTracker.slice(-8) : []).map(function (e) {
      return String((e && (e.content || e.title)) || '');
    }).filter(function (t) {
      return t && kw.some(function (k) { return t.indexOf(k) >= 0; });
    }).map(function (t) { return t.slice(0, 120); });
  }

  // ── 宪法闸落账（独立导出·smoke 不经真 AI 直验）──────────────────────────────
  function _applyCourtOutcome(G, o) {
    o = o || {};
    var turn = G.turn || 0;
    var player = _player(G);
    var type = String(o.type || 'hold');
    if (o.narrative) _chron(G, o.narrative);
    switch (type) {
      case 'regent': {
        if (!player || !player._captured) return { ok: false, why: '君未蒙尘·无监国之设' };
        if (G._regent && G._regent.name) return { ok: false, why: '已有监国' };
        var rc = _findChar(G, o.name);
        if (!rc || rc.isPlayer || rc.alive === false || rc._captured) return { ok: false, why: '监国人选不在档/不可任' };
        G._regent = { name: rc.name, sinceTurn: turn };  // arch-ok 悬朝唯一写口·监国登记
        rc._regent = true;
        _eb('国不可一日无主·' + rc.name + '受命监国·摄行国政');
        return { ok: true };
      }
      case 'proclaim_new': {
        // 宪法：只在君上真被虏时可立·人选在档活人非俘非玩家
        if (!player || !player._captured) return { ok: false, why: '君上未陷·不得另立' };
        if (G._rivalEmperor && G._rivalEmperor.name) return { ok: false, why: '已立新君' };
        var nc = _findChar(G, o.name);
        if (!nc || nc.isPlayer || nc.alive === false || nc._captured) return { ok: false, why: '嗣君人选不在档/不可立' };
        G._rivalEmperor = { name: nc.name, sinceTurn: turn };  // arch-ok 悬朝唯一写口·新君登记
        nc._enthroned = true;
        player._preCaptureTitle = player.officialTitle || '';
        player.officialTitle = '太上皇';  // 拍板②：玩家继续演太上皇·遥尊虚号
        if (G._regent && G._regent.name === nc.name) G._regent = null;  // arch-ok 同上·监国转正清位
        _eb('★★社稷定策！朝廷奉 ' + nc.name + ' 践祚·遥尊蒙尘君上为太上皇——一朝二主·名分自此多事');
        _chron(G, nc.name + '受群臣拥立即皇帝位·尊陷虏之君为太上皇');
        try {
          if (typeof global.NpcMemorySystem !== 'undefined' && typeof global.NpcMemorySystem.addMemory === 'function') {
            global.NpcMemorySystem.addMemory(nc.name, '国难之际受群臣拥立践祚·旧主尚在敌营·此位得之非常', 10, 'career');
          }
        } catch (_) {}
        return { ok: true };
      }
      case 'restoration': {
        // 宪法三闸：君已归(非俘)+新君在位+真有复辟旨·且不在谋泄冷却
        if (!player || player._captured) return { ok: false, why: '君犹在虏营·夺门无从谈起' };
        if (!G._rivalEmperor || !G._rivalEmperor.name) return { ok: false, why: '并无新君·无门可夺' };
        if (!_recentRestorationEdicts(G).length) return { ok: false, why: '未见复辟之谋(须玩家真下旨谋划)' };
        if (G._restorationSetback && turn - (G._restorationSetback.turn || 0) < CRACKDOWN_COOLDOWN) return { ok: false, why: '谋泄未久·党羽星散·须蛰伏' };
        var re = _findChar(G, G._rivalEmperor.name);
        if (re) { re._enthroned = false; re._dethroned = true; re.officialTitle = String(o.demotedTitle || '逊位亲王').slice(0, 12); }
        G._rivalEmperor = null;  // arch-ok 悬朝唯一写口·夺门复辟清位
        G._restorationSetback = null;  // arch-ok 同上
        if (player._preCaptureTitle != null) { player.officialTitle = player._preCaptureTitle; delete player._preCaptureTitle; }
        _eb('★★夺门之变成！太上皇复即帝位·中外肃然·从龙者俱进·附新君者惴惴');
        _chron(G, '太上皇复辟·' + (re ? re.name + '逊位' : '新君逊位') + '·朝局翻覆');
        return { ok: true };
      }
      case 'crackdown': {
        if (!player || player._captured || !G._rivalEmperor) return { ok: false, why: '无谋可泄' };
        G._restorationSetback = { turn: turn };  // arch-ok 悬朝唯一写口·谋泄冷却
        _eb('复辟之谋事泄！党羽被逮·太上皇门庭冷落·唯忍辱待时');
        return { ok: true };
      }
      default:
        return { ok: true, hold: true };
    }
  }

  // ── 悬朝 subcall（AI 演朝廷）─────────────────────────────────────────────
  async function courtScene(G) {
    var player = _player(G);
    if (!player) return null;
    var captive = !!player._captured;
    var rival = (G._rivalEmperor && G._rivalEmperor.name) || '';
    var cands = _heirCandidates(G, player);
    var lines = ['你是天命推演引擎的悬朝演绎官。' + (G.eraName || '') + '·T' + (G.turn || 0) + '·社稷非常之局——你替满朝文武定本回合走向(宁稳勿滥·一回合一动)。'];
    if (captive) {
      lines.push('【局面】君上' + player.name + '陷于「' + (player._capturedBy || '敌') + '」(' + (player._capturedLocation || '敌营') + ')·皇威' + ((G.huangwei && G.huangwei.index) || '?')
        + (G._regent ? '·现监国=' + G._regent.name : '·尚无监国') + (rival ? '·已立新君=' + rival : '·未另立'));
      if (cands.length) lines.push('【嗣位候选】' + cands.map(function (c) { return c.name + '(' + (c.officialTitle || '宗室') + ')'; }).join('·'));
      lines.push('【可断】hold(观望·迎归论与另立论相争·narrative记之)·regent(name=立监国)·proclaim_new(name=立新君·尊君上为太上皇·主战派得势/虏势要挟日甚时之决)。');
    } else if (rival) {
      lines.push('【局面】太上皇' + player.name + '已归而新君' + rival + '在位——一朝二主·名分多事·皇威' + ((G.huangwei && G.huangwei.index) || '?'));
      var reds = _recentRestorationEdicts(G);
      if (reds.length) lines.push('【太上皇密谋(其诏即其谋)】' + reds.join('｜'));
      else lines.push('【太上皇未见有谋】无复辟旨意·朝局维持。');
      lines.push('【可断】hold(两宫相安或暗流·narrative记之)·restoration(夺门成·须太上皇真有其谋且朝中人心可用)·crackdown(谋泄被破·须真有其谋才谈得上泄)。');
    } else {
      return null;
    }
    lines.push('只返回 JSON：{"type":"hold|regent|proclaim_new|restoration|crackdown","name":"人选(regent/proclaim_new必填)","demotedTitle":"复辟后新君降号(restoration可选)","narrative":"本回合朝局一幕≤100字·史笔"}');
    try {
      var resp = await global.callAI(lines.join('\n'), 600, null, (typeof global._useSecondaryTier === 'function' && global._useSecondaryTier()) ? 'secondary' : undefined, { id: 'captive-court' });
      var text = (resp && typeof resp === 'object') ? (resp.text || resp.content || '') : String(resp || '');
      var j = (typeof global.robustParseJSON === 'function') ? global.robustParseJSON(text) : JSON.parse(text);
      if (j && j.type) return _applyCourtOutcome(G, j);
    } catch (_eC) {}
    return null;
  }

  // ── 每回合 tick（SettlementPipeline·AI 排 job·无 AI 走兜底轨）────────────────
  function tick(G) {
    if (!enabled()) return;
    G = G || global.GM;
    if (!G) return;
    var player = _player(G);
    if (!player) return;
    var captive = !!player._captured;
    var rival = !!(G._rivalEmperor && G._rivalEmperor.name);
    if (!captive && !rival) return;  // 常态朝局·本层不插手
    var turn = G.turn || 0;
    if (_aiOn()) {
      if (G._courtInferTurn === turn) return;
      G._courtInferTurn = turn;  // arch-ok 悬朝演绎回合戳·幂等(与 _wtAuditTurn 同范式)
      var job = function () { return courtScene(G); };
      if (typeof global._enqueuePostTurnJob === 'function') global._enqueuePostTurnJob('captiveCourt', job);
      else job();
      return;
    }
    // 兜底轨(双轨)：被虏满 N 回合·朝廷自立储君·此外不机械断(监国/夺门非机械可断)
    if (captive && !rival) {
      if (!player._capturedSince) player._capturedSince = turn;
      if (turn - player._capturedSince >= FALLBACK_PROCLAIM_TURNS) {
        var cands = _heirCandidates(G, player);
        if (cands.length) _applyCourtOutcome(G, { type: 'proclaim_new', name: cands[0].name, narrative: '君上陷虏日久·群臣定策立新君以安社稷' });
      }
    }
  }

  var API = { tick: tick, courtScene: courtScene, _applyCourtOutcome: _applyCourtOutcome, _heirCandidates: _heirCandidates, _recentRestorationEdicts: _recentRestorationEdicts, enabled: enabled, FALLBACK_PROCLAIM_TURNS: FALLBACK_PROCLAIM_TURNS, CRACKDOWN_COOLDOWN: CRACKDOWN_COOLDOWN };
  global.TM = global.TM || {};
  global.TM.CaptiveCourt = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  try {
    if (global.SettlementPipeline && typeof global.SettlementPipeline.register === 'function') {
      global.SettlementPipeline.register('captiveCourt', '悬朝演绎', function () {
        try { tick(global.GM); } catch (_eT) {}
      }, 92, 'perturn');
    }
  } catch (_eR) {}
})(typeof window !== 'undefined' ? window : globalThis);
