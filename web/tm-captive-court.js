// ============================================================
//  tm-captive-court.js — 悬朝演绎层·北狩残局朝廷侧（批七·2026-07-21·AI 主导）
//
//  owner 三拍板：①立新君交回合演绎 AI(朝臣自行酝酿·玩家在贼营收到消息=失控才是北狩之痛)
//  ②新君立后玩家继续演太上皇(与裁决器「有储君继统」语义正交·夺门是翻盘牌)
//  ③夺门照范式：玩家复辟诏令即谋划(走诏令管线·无独立UI)·AI 权衡朝局定成败。
//
//  君上 _captured(批四破京 captured 态)期间·朝廷由本层当一等演员：每回合悬朝 subcall——
//  hold(观望·迎归/主战之争叙事)/regent(立监国)/proclaim_new(立新君·君上尊为太上皇)。
//  君上归(本文件放还写口 release：主推演 captive_release 赎还/放还/逃归/救回·执者那家灭了放回)而新君在位=一朝二主：
//  太上皇归来后所下诏令全数喂入 subcall(有无复辟之谋由 AI 判·不按字面筛，11-22 改)·AI 断 restoration(夺门成·太上皇复位)/crackdown(谋泄·蛰伏冷却)/hold。
//
//  宪法闸(只验不产)：人选须在档活人非俘非玩家·夺门须君已归+归后下过诏令+不在谋泄冷却·
//  复位真复位(称号账本双清)。双轨：AI 缺席=被虏 6 回合朝廷自立储君(resolveHeir)兜底·
//  兜底无监国无夺门(夺门之变非机械可断)。属于正式破京链。
//  本文件为 _regent/_rivalEmperor/称号迁转、解除被俘(_captured)的唯一写口(已登记 gm-writes owners)。
// ============================================================
(function (global) {
  'use strict';

  var FALLBACK_PROCLAIM_TURNS = 6;   // 兜底轨：被虏满 N 回合朝廷自立储君
  var CRACKDOWN_COOLDOWN = 4;        // 谋泄后 N 回合内不再断夺门

  function enabled() {
    return true; // 民变实体及其后果属于正式玩法。
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
  // 太上皇归来后所下的诏令（最近 8 道）：有无复辟之谋交悬朝那一幕的 AI 判，不按「复辟／夺门」几个字筛
  //   （同志 11-14 定诏令只许 AI 判；11-22「按你推荐来」改）。没记归来回合的（旧档、开局）按最近 8 道算
  function _recentEdicts(G, player) {
    var since = player && player._releasedTurn != null ? Number(player._releasedTurn) : null;
    return (Array.isArray(G._edictTracker) ? G._edictTracker : []).filter(function (e) {
      return e && !(since != null && Number(e.turn) < since);
    }).slice(-8).map(function (e) {
      return String(e.content || e.title || '').slice(0, 120);
    }).filter(Boolean);
  }

  // ── 被俘之人放还（同志 11-22「按你推荐来」甲）──────────────────────────────
  //   全游戏解除被俘（_captured）只走这里。被俘记在三处：破京被执（tm-capital-fall.js）、御驾亲征被俘（tm-military.js）、
  //   开局北狩（tm-patches-start.js）。回来两条路：
  //   ① 主推演 captive_release：推演按局势与执者其人判谁回来、怎么回来——ransom 赎还（赎银两数推演给，从国库出）、release 放还、
  //      escape 逃归、rescue 救回；这里只验此人确在俘、执者对得上、国库付得起，落不成的由调用方记写回落空。
  //   ② 执者那一家灭了（除档，或推演 faction_dissolve 记了亡）：它手里的人放回（releaseOrphans，每回合悬朝 tick 先跑）。
  //   回来了：解除被俘、经过记进 _captivityHistory、人到推演说的去处（没说回京城；京城陷着就去新君、监国所在）、
  //   开局按「北狩」记的在场状态改回在场；君上回来监国随之撤，新君在位就是一朝二主，夺门从此走得到；
  //   御驾亲征被俘时上御案的「乘舆蒙尘」时政随之了结。
  //   赎金（11-22 收尾）：银、粮、布都可（ransom 写一个数是银两，写 {money,grain,cloth} 是三样），从国库出，写 from:"neitang" 从内帑出，
  //   不够整笔不动；执者那一家在，赎金入它的库（fac.treasury，各家的库都记在这里），两头对得上账。
  //   档里没记执者的（绍宋开局北狩一行只记了在哪），按人所在之地认执者（inferCaptor）：开局与每回合悬朝 tick 先补记。
  var HOWS = { ransom: '赎还', release: '放还', escape: '逃归', rescue: '救回', captorGone: '得脱' };
  var CAPTIVE_TAG = /^(北狩|被俘|被掳|陷虏|没蕃)/;
  var RES = ['money', 'grain', 'cloth'];
  var RES_CN = { money: ['银', '两'], grain: ['粮', '石'], cloth: ['布', '匹'] };

  function _captureErr(e, where) {
    try { if (global.TM && global.TM.errors && typeof global.TM.errors.captureSilent === 'function') global.TM.errors.captureSilent(e, where); } catch (_) { /* 记错本身失败：只是少一条错误记录 */ }
  }
  function _ebCat(cat, msg) {
    try { if (typeof global.addEB === 'function') global.addEB(cat, msg, { credibility: 'high' }); } catch (_) { /* 事件流写不进只少一行字，状态已落 */ }
  }
  function _faction(G, name) {
    name = String(name || '').trim();
    if (!name) return null;
    return (G.facs || []).filter(function (f) { return f && (f.name === name || (f.id != null && String(f.id) === name)); })[0] || null;
  }
  function _sameCaptor(a, b) { return a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0; }

  // 赎金：写一个数是银两；写 {money,grain,cloth} 是三样；负数、不是数的当 0
  function _ransomOf(v) {
    var out = { money: 0, grain: 0, cloth: 0 };
    if (v == null || v === '') return out;
    if (typeof v !== 'object') { out.money = Math.max(0, Math.round(Number(v) || 0)); return out; }
    RES.forEach(function (k) { out[k] = Math.max(0, Math.round(Number(v[k]) || 0)); });
    return out;
  }
  function _ransomText(r) {
    return RES.filter(function (k) { return r[k] > 0; }).map(function (k) { return RES_CN[k][0] + ' ' + r[k] + ' ' + RES_CN[k][1]; }).join('、');
  }
  // 内帑存数：账本说了算的（统一记账）看账本，否则看镜像数（内帑出账前会按它对账）
  function _neitangStock(G, k) {
    var nt = G.neitang || {}, led = nt.ledgers && nt.ledgers[k];
    if (led && led._authoritativeStock && isFinite(Number(led.stock))) return Number(led.stock);
    var v = nt[k] != null ? nt[k] : (k === 'money' ? nt.balance : null);
    if (v != null && isFinite(Number(v))) return Number(v);
    return led && isFinite(Number(led.stock)) ? Number(led.stock) : 0;
  }
  // 付赎金：国库走 trySpendFromGuoku（不够整笔不动）；内帑先核存数够不够，够了才扣（spendFromNeitang 本身是有多少扣多少）。
  //   执者那一家在、不是本朝，赎金入它的库
  function _payRansom(G, ch, r, from, captor) {
    var FE = global.FiscalEngine, tag = '赎还·' + ch.name, paid = null;
    if (from === 'neitang') {
      if (!FE || typeof FE.spendFromNeitang !== 'function') return { ok: false, why: '内帑账本未加载，赎金无从出' };
      var short = RES.filter(function (k) { return r[k] > _neitangStock(G, k); });
      if (short.length) {
        return { ok: false, why: '内帑付不起赎金（要' + _ransomText(r) + '；内帑' + short.map(function (k) {
          return RES_CN[k][0] + '只有 ' + Math.floor(_neitangStock(G, k)) + ' ' + RES_CN[k][1];
        }).join('、') + '）' };
      }
      try { paid = FE.spendFromNeitang(r, tag); } catch (e) { _captureErr(e, 'CaptiveCourt.release.neitang'); paid = null; }
      if (!paid || !paid.ok) return { ok: false, why: '内帑扣赎金未成' };
    } else {
      if (!FE || typeof FE.trySpendFromGuoku !== 'function') return { ok: false, why: '财政账本未加载，赎金无从出' };
      try { paid = FE.trySpendFromGuoku({ amounts: r, sinkTag: tag, gameRef: G }); } catch (e) { _captureErr(e, 'CaptiveCourt.release.ransom'); paid = null; }
      if (!paid || !paid.ok) {
        var res = paid && RES_CN[paid.resource];
        return { ok: false, why: '国库付不起赎金（要' + _ransomText(r)
          + (res && paid.available != null ? '；库存' + res[0] + ' ' + Math.floor(Number(paid.available) || 0) + ' ' + res[1] : '') + '）' };
      }
    }
    var f = captor ? _faction(G, captor) : null;
    if (!f || f.isPlayer || f._dissolvedTurn != null || f.destroyed === true) return { ok: true, to: '' };
    if (!f.treasury || typeof f.treasury !== 'object') f.treasury = { money: 0, grain: 0, cloth: 0 };
    RES.forEach(function (k) { if (r[k] > 0) f.treasury[k] = (Number(f.treasury[k]) || 0) + r[k]; });
    return { ok: true, to: String(f.name) };
  }

  // 档里没记执者的，按人所在之地认执者：
  //   ① 那块地现归谁（FactionMembership.regionInfo，与易主写口同一套认法；认不出走 tm-map-locations 的地名解析，两可的不认）。
  //      整串认不出就逐段认，从细往粗（「金国·燕京」认燕京）；
  //   ② 地名头一段是某家国号（「金国·上京」：上京不在图上，「金国」去掉大、国、朝等字与「大金」相合，只合一家才认）。
  //   认出是本朝自己的、认不出、两可的都不记，交推演写 by
  function _bareName(s) { return String(s || '').trim().replace(/^大/, '').replace(/(国|朝)$/, ''); }
  function inferCaptor(G, ch) {
    if (!G || !ch) return '';
    var where = String(ch._capturedLocation || ch.location || '').replace(/[（(][^）)]*[）)]/g, '').trim();
    if (!where) return '';
    var own = String(ch.faction || ''), FM = global.TM && global.TM.FactionMembership, ML = global.TMMapLocations;
    function ownerOf(ref) {
      var info = null;
      try { info = FM && typeof FM.regionInfo === 'function' ? FM.regionInfo(ref) : null; } catch (e) { info = null; /* 地名两可时它会抛：当认不出 */ }
      if (!info && FM && ML && typeof ML.placeRegionIds === 'function') {
        var ids = [];
        try { ids = ML.placeRegionIds(ref, G) || []; } catch (e2) { ids = []; /* 地名解析出错：当认不出 */ }
        if (ids.length === 1) { try { info = FM.regionInfo(ids[0]); } catch (e3) { info = null; /* 同上 */ } }
      }
      return info && info.owner ? String(info.owner) : '';
    }
    var segs = where.split(/[·・]/).map(function (s) { return s.trim(); }).filter(Boolean);
    var tries = [where].concat(segs.length > 1 ? segs.slice().reverse() : []);
    for (var i = 0; i < tries.length; i++) {
      var o = ownerOf(tries[i]);
      if (o) return o === own ? '' : o;   // 那块地归本朝：不像被敌所执，不猜
    }
    var head = _bareName(segs[0]);
    if (!head) return '';
    var hits = (G.facs || []).filter(function (f) { return f && f.name && f.name !== own && _bareName(f.name) === head; });
    return hits.length === 1 ? String(hits[0].name) : '';
  }
  // 补记执者：档里没记执者的在俘之人，认得出就记上（另记 _captorInferred：是按所在之地认的）
  function fillCaptors(G) {
    var out = [];
    ((G && G.chars) || []).forEach(function (c) {
      if (!c || !c._captured || c.alive === false || c.dead === true || String(c._capturedBy || '').trim()) return;
      var by = inferCaptor(G, c);
      if (!by) return;
      c._capturedBy = by;
      c._captorInferred = true;
      out.push(c.name);
    });
    return out;
  }
  // 朝廷所在：京城没陷就是京城；陷着就去新君、监国那里
  function _courtSeat(G) {
    var cap = String(G._capital || G.capital || '');
    if (cap && !G._capitalFallen) return cap;
    function seatOf(nm) { var c = nm ? _findChar(G, nm) : null; return c && c.location ? String(c.location) : ''; }
    return seatOf(G._rivalEmperor && G._rivalEmperor.name) || seatOf(G._regent && G._regent.name) || cap;
  }

  function _releaseChar(G, ch, how, opts) {
    opts = opts || {};
    var turn = G.turn || 0, captor = String(ch._capturedBy || opts.by || '').trim();   // 档里没记执者也没认出的用推演说的
    var to = String(opts.to || '').trim() || _courtSeat(G);
    var ransom = opts.ransom || _ransomOf(0), paidText = _ransomText(ransom);
    if (!Array.isArray(ch._captivityHistory)) ch._captivityHistory = [];
    ch._captivityHistory.push({
      by: captor, place: String(ch._capturedLocation || ''), how: how, ransom: ransom, ransomFrom: paidText ? (opts.from || 'guoku') : '',
      ransomTo: opts.paidTo || '', toTurn: turn,
      fromTurn: ch._capturedTurn != null ? ch._capturedTurn : (ch._capturedSince != null ? ch._capturedSince : null)
    });
    delete ch._captured; delete ch._capturedBy; delete ch._capturedLocation; delete ch._capturedTurn; delete ch._capturedSince;
    delete ch._captorSeen; delete ch._captorInferred;
    ch._releasedTurn = turn;
    if (CAPTIVE_TAG.test(String(ch.presenceState || ''))) ch.presenceState = 'present';
    if (CAPTIVE_TAG.test(String(ch.status || ''))) delete ch.status;
    if (to) ch.location = to;
    if (G._playerCaptive && G._playerCaptive.name === ch.name) G._playerCaptive = null;  // arch-ok 御驾亲征被俘的全局信号随人回来撤
    var who = String(ch.name || ''), from = captor ? '「' + captor + '」' : '敌';
    var text = how === 'ransom' ? '朝廷' + (paidText ? (opts.from === 'neitang' ? '出内帑' : '以') + paidText : '') + '自' + from + '处赎还' + who
      : how === 'release' ? from + '放还' + who
      : how === 'escape' ? who + '自' + from + '处逃归'
      : how === 'rescue' ? '官军自' + from + '处救回' + who
      : from + '既亡，' + who + '得脱归来';
    if (ch.isPlayer) {
      var hadRegent = !!(G._regent && G._regent.name), rival = G._rivalEmperor && G._rivalEmperor.name;
      if (hadRegent) {
        var rg = _findChar(G, G._regent.name);
        if (rg) delete rg._regent;
        G._regent = null;  // arch-ok 悬朝唯一写口·君上归，监国撤
      }
      (Array.isArray(G.currentIssues) ? G.currentIssues : []).forEach(function (iss) {   // 「乘舆蒙尘」时政（tm-military.js 御驾亲征被俘时上的）了结
        if (iss && iss._captive && iss.status !== 'resolved') { iss.status = 'resolved'; iss.resolvedTurn = turn; iss.resolution = '乘舆还朝'; }
      });
      _ebCat('国变', '★乘舆还朝！' + text + (to ? '·归于' + to : '')
        + (rival ? '——新君' + rival + '在位，一朝二主之局自此始' : (hadRegent ? '·监国撤，君上复亲政' : '·君上复亲政')));
    } else {
      _ebCat('人事', text + (to ? '·归于' + to : ''));
    }
    if (opts.narrative) _chron(G, opts.narrative);
    try {
      if (typeof global.NpcMemorySystem !== 'undefined' && typeof global.NpcMemorySystem.addMemory === 'function') {
        global.NpcMemorySystem.addMemory(who, '陷于' + (captor || '敌') + '，' + HOWS[how] + '归来', 9, 'career');
      }
    } catch (e) { _captureErr(e, 'CaptiveCourt.release.memory'); }
    return { ok: true, name: who, how: how, to: to, ransom: ransom, from: opts.from || '', paidTo: opts.paidTo || '' };
  }

  // 主推演 captive_release 一条：{ name, how, by, ransom, from, to, narrative }；落不成返回 { ok:false, why }
  function release(G, decl) {
    G = G || global.GM;
    decl = decl || {};
    var how = String(decl.how || '').trim();
    if (!G || !HOWS[how] || how === 'captorGone') return { ok: false, why: '怎么回来不明（ransom 赎还／release 放还／escape 逃归／rescue 救回）' };
    var name = String(decl.name || '').trim();
    var hits = (G.chars || []).filter(function (c) { return c && c.name === name && c.alive !== false && c.dead !== true; });
    if (hits.length !== 1) return { ok: false, why: hits.length ? '同名在世的不止一人' : '档里没有这个在世的人' };
    var ch = hits[0];
    if (!ch._captured) return { ok: false, why: '此人并未被俘' };
    var captor = String(ch._capturedBy || '').trim(), by = String(decl.by || '').trim();
    if (by && captor && !_sameCaptor(by, captor)) return { ok: false, why: '执者对不上（档里是「' + captor + '」）' };
    var ransom = _ransomOf(how === 'ransom' ? decl.ransom : 0), from = String(decl.from || '').trim() === 'neitang' ? 'neitang' : 'guoku', paidTo = '';
    if (_ransomText(ransom)) {
      var paid = _payRansom(G, ch, ransom, from, captor || by);
      if (!paid.ok) return paid;
      paidTo = paid.to;
    }
    return _releaseChar(G, ch, how, { to: decl.to, by: by, ransom: ransom, from: from, paidTo: paidTo, narrative: decl.narrative });
  }

  // 执者那一家灭了，它手里的人放回。只认真在势力表里见过的执者（见过记 _captorSeen）；执者没记、或只是一句「敌军」的不动，交推演判
  function releaseOrphans(G) {
    var out = [];
    (G.chars || []).slice().forEach(function (c) {
      if (!c || !c._captured || c.alive === false || c.dead === true) return;
      var captor = String(c._capturedBy || '').trim();
      if (!captor) return;
      var f = _faction(G, captor);
      if (f && f._dissolvedTurn == null && f.destroyed !== true) { c._captorSeen = true; return; }
      if (!f && !c._captorSeen) return;
      var r = _releaseChar(G, c, 'captorGone', {});
      if (r.ok) out.push(r.name);
    });
    return out;
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
        if (!_recentEdicts(G, player).length) return { ok: false, why: '太上皇归来后未下一道诏令·谈不上复辟之谋' };
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
      var reds = _recentEdicts(G, player);
      if (reds.length) lines.push('【太上皇归来后所下诏令(其诏即其谋·有无复辟之意由你判，不必字面写着复辟)】' + reds.join('｜'));
      else lines.push('【太上皇归来后未下诏】朝局维持。');
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
    try { fillCaptors(G); } catch (e0) { _captureErr(e0, 'CaptiveCourt.fillCaptors'); }        // 档里没记执者的先按所在之地补记
    try { releaseOrphans(G); } catch (e) { _captureErr(e, 'CaptiveCourt.releaseOrphans'); }   // 执者那家灭了的先放回
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

  var API = { tick: tick, courtScene: courtScene, _applyCourtOutcome: _applyCourtOutcome, _heirCandidates: _heirCandidates, _recentEdicts: _recentEdicts,
    release: release, releaseOrphans: releaseOrphans, inferCaptor: inferCaptor, fillCaptors: fillCaptors, HOWS: HOWS,
    enabled: enabled, FALLBACK_PROCLAIM_TURNS: FALLBACK_PROCLAIM_TURNS, CRACKDOWN_COOLDOWN: CRACKDOWN_COOLDOWN };
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
