// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
//  tm-negotiation.js — 谈判多轮会话引擎（批己·2026-07-22）
//
//  病根：三处谈判生产者各自为政、玩家无还价权——①民变招抚讨价只 _eb 即弃零状态(还价死点)
//  ②外患议和 terms 只落事件簿(与 endWar 两线不连·议和名存实亡) ③势力外交是唯一全状态机·
//  但玩家侧只有准/驳/羁縻一次性终局·无 counter。本引擎把「谈判」抽象成一等会话对象·让三者
//  共用一套多轮回价状态机·玩家在问对里对使节「回价」续谈·AI/势力据台面 offer 继续演。
//
//  措辞朝代中立（会话/回价/条款/续谈皆通用词）——岁币/封贡/招抚等朝代专名只出现在数据 terms 里·
//  不硬编进引擎。本文件为 GM._negotiations / GM._negotiationSeq 的唯一写口(已登记 gm-writes owners
//  与 save-lifecycle explicit mirror·不加 mirror 跨存档丢)。
//
//  会话形状：{ id:'ng-'+turn+'-'+seq, parties:{initiator,responder:'player'}, topic:'pacify'|'peace'|
//    'diplomacy', sourceRef:{kind:'revolt'|'invasion'|'proposal', refId}, offers:[{by:'them'|'player',
//    terms(≤80字), silver?, office?, turn}], round, status:'open'|'accepted'|'rejected'|'lapsed',
//    turn, expireTurn(turn+4) }
//  flag negotiationSessionsEnabled 默认 ON(!(===false))·OFF=三生产者走旧行为(open 返 null·无会话无回价钮)。
// ============================================================
(function (global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  if (TM.Negotiation) return;

  var MAX_ROUND = 3;        // round≥3 后不再允许 counter（回价节流）
  var EXPIRE_TURNS = 4;     // 会话过期回合数（照势力外交 EXPIRE_TURNS 范式）
  var MAX_SESSIONS = 40;    // 会话账本封顶

  function _G() { return global.GM; }
  function enabled() {
    try { return !(global.P && global.P.conf && global.P.conf.negotiationSessionsEnabled === false); }
    catch (_) { return false; }
  }
  function _turn(G) { return (G && G.turn) || 0; }
  function _norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function _sameRef(a, b) {
    if (!a || !b) return false;
    return _norm(a.kind) === _norm(b.kind) && _norm(a.refId) === _norm(b.refId);
  }
  // 全局递增序号（GM 级·照 tm-faction-diplomacy._dipSeq 范式·防同回合多次 open 的本地 n 重置→id 碰撞）
  function _seq(G) {
    var v = Number(G._negotiationSeq);
    G._negotiationSeq = (isFinite(v) ? v : 0) + 1;   // arch-ok: 谈判会话全局递增序号(本文件写口·已登记 owners)
    return G._negotiationSeq;
  }
  function _list(G) {
    if (!Array.isArray(G._negotiations)) G._negotiations = [];   // arch-ok: 谈判会话宿主(本文件唯一写口·已登记 owners)
    return G._negotiations;
  }
  function _normOffer(o, turn) {
    if (!o) return null;
    var offer = {
      by: (o.by === 'player') ? 'player' : 'them',
      terms: String(o.terms || '').slice(0, 80),
      turn: (o.turn != null ? o.turn : turn)
    };
    var sv = Number(o.silver);
    if (isFinite(sv) && sv > 0) offer.silver = Math.round(sv);
    if (o.office) offer.office = String(o.office).slice(0, 16);
    return offer.terms || offer.silver || offer.office ? offer : null;
  }

  // ── open(spec)：同 sourceRef 已有 open 会话则复用追加 offer 不重开 ──
  function open(spec) {
    spec = spec || {};
    var G = _G();
    if (!G || !enabled()) return null;
    var turn = _turn(G);
    var ref = spec.sourceRef || {};
    var list = _list(G);
    var existing = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].status === 'open' && _sameRef(list[i].sourceRef, ref)) { existing = list[i]; break; }
    }
    var off = _normOffer(spec.offer, turn);
    if (existing) {
      if (off) { existing.offers.push(off); existing.expireTurn = turn + EXPIRE_TURNS; }   // 复用：追加 offer·续命·不重开
      return existing;
    }
    var ng = {
      id: 'ng-' + turn + '-' + _seq(G),
      parties: { initiator: String(spec.initiator || ref.refId || '').slice(0, 40), responder: 'player' },
      topic: spec.topic || 'diplomacy',
      sourceRef: { kind: String(ref.kind || ''), refId: String(ref.refId || '') },
      offers: off ? [off] : [],
      round: 1,
      status: 'open',
      turn: turn,
      expireTurn: turn + EXPIRE_TURNS
    };
    list.push(ng);
    if (list.length > MAX_SESSIONS) G._negotiations = list.slice(-MAX_SESSIONS);   // arch-ok: 会话账本封顶(本文件写口·owners)
    return ng;
  }

  // ── get(id) fail-closed：带 id 未命中返 null（绝不模糊猜） ──
  function get(id) {
    var G = _G();
    if (!G || id == null) return null;
    var list = Array.isArray(G._negotiations) ? G._negotiations : [];
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].id === id) return list[i];
    return null;
  }
  function findOpenByRef(kind, refId) {
    var G = _G();
    if (!G) return null;
    var list = Array.isArray(G._negotiations) ? G._negotiations : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].status === 'open' && _sameRef(list[i].sourceRef, { kind: kind, refId: refId })) return list[i];
    }
    return null;
  }

  // ── playerCounter(id, terms, silver?)：追 offer by:'player'·round++·round≥3 不再允许·刷新 expireTurn ──
  function playerCounter(id, terms, silver) {
    var G = _G();
    if (!G || !enabled()) return null;
    var ng = get(id);
    if (!ng || ng.status !== 'open') return null;   // fail-closed·未命中/已决→不回价
    if (ng.round >= MAX_ROUND) return null;         // round≥3 后不再允许 counter
    var off = _normOffer({ by: 'player', terms: terms, silver: silver }, _turn(G));
    if (!off) return null;
    ng.offers.push(off);
    ng.round++;
    ng.expireTurn = _turn(G) + EXPIRE_TURNS;
    return ng;
  }

  // ── resolve(id, status)：置终局态（accepted/rejected/lapsed） ──
  function resolve(id, status) {
    var ng = get(id);
    if (!ng || ng.status !== 'open') return null;
    if (status === 'accepted' || status === 'rejected' || status === 'lapsed') ng.status = status;
    return ng;
  }

  function currentOffer(ng) {
    if (!ng || !Array.isArray(ng.offers) || !ng.offers.length) return null;
    return ng.offers[ng.offers.length - 1];   // 当前台面 offer=最后一条(可能是玩家刚递的回价)
  }
  // 结算台面 = 最后一条 by:'them' 的 offer（玩家自己的回价永不可直接结算·须待对方回应形成新 them-offer）
  function settleableOffer(ng) {
    if (!ng || !Array.isArray(ng.offers)) return null;
    for (var i = ng.offers.length - 1; i >= 0; i--) {
      if (ng.offers[i] && ng.offers[i].by === 'them') return ng.offers[i];
    }
    return null;
  }

  // ── surfaceEnvoy：把会话 surface 成「使节求见」进 GM._pendingAudiences（复用问对既有 envoy audience 通道）──
  //   同一会话僵尸使节去重（只留最新）·唯一清洗写口走 _wdCleansePendingAudiences（在场时）否则谓词兜底。
  function surfaceEnvoy(spec) {
    var G = _G();
    if (!G || !spec || spec.negotiationId == null) return null;
    if (!Array.isArray(G._pendingAudiences)) G._pendingAudiences = [];   // arch-ok: 求见队列(本文件写口·owners)·下游删除侧走 _wdRemovePendingAudience 收口
    var ngId = spec.negotiationId;
    var keep = function (a) { return !(a && a._negotiationId === ngId); };
    if (typeof global._wdCleansePendingAudiences === 'function' && global.GM === G) global._wdCleansePendingAudiences(keep);
    else G._pendingAudiences = G._pendingAudiences.filter(keep);   // arch-ok: 同会话僵尸使节去重(本文件写口·owners)
    var q = {
      name: String(spec.fromName || '外藩') + '来使',
      reason: String(spec.reason || '').slice(0, 80),
      turn: spec.turn != null ? spec.turn : _turn(G),
      isEnvoy: true,
      fromFaction: String(spec.fromName || ''),
      _negotiationId: ngId
    };
    if (spec.interactionType) q.interactionType = spec.interactionType;
    G._pendingAudiences.push(q);   // arch-ok: 使节求见入队(本文件写口·owners)
    if (typeof global._wdCapPendingAudiences === 'function' && global.GM === G) global._wdCapPendingAudiences(20);
    else if (G._pendingAudiences.length > 20) G._pendingAudiences = G._pendingAudiences.slice(-20);   // arch-ok: 求见队列去顶(本文件写口·owners)
    return q;
  }

  // ── tickExpiry：过期置 lapsed + 清 _pendingAudiences 里对应 _negotiationId 僵尸使节（照腐败案 expireOldCases 范式）──
  function tickExpiry(G) {
    G = G || _G();
    if (!G) return { lapsed: 0 };
    var list = Array.isArray(G._negotiations) ? G._negotiations : [];
    var turn = _turn(G);
    var lapsedIds = [];
    list.forEach(function (ng) {
      if (ng && ng.status === 'open' && ng.expireTurn && turn > ng.expireTurn) {
        ng.status = 'lapsed';
        lapsedIds.push(ng.id);
      }
    });
    if (lapsedIds.length && Array.isArray(G._pendingAudiences)) {
      var idset = {};
      lapsedIds.forEach(function (x) { idset[x] = 1; });
      var keep = function (a) { return !(a && a._negotiationId && idset[a._negotiationId]); };
      if (typeof global._wdCleansePendingAudiences === 'function' && global.GM === G) global._wdCleansePendingAudiences(keep);
      else G._pendingAudiences = G._pendingAudiences.filter(keep);   // arch-ok: 僵尸使节清洗(本文件写口·owners)
    }
    return { lapsed: lapsedIds.length };
  }

  function summarize(G) {
    G = G || _G();
    var list = (G && G._negotiations) || [];
    var by = { open: 0, accepted: 0, rejected: 0, lapsed: 0 };
    list.forEach(function (n) { if (n && by[n.status] != null) by[n.status]++; });
    return { total: list.length, byStatus: by };
  }

  TM.Negotiation = {
    open: open,
    get: get,
    findOpenByRef: findOpenByRef,
    playerCounter: playerCounter,
    resolve: resolve,
    currentOffer: currentOffer,
    settleableOffer: settleableOffer,
    surfaceEnvoy: surfaceEnvoy,
    tickExpiry: tickExpiry,
    summarize: summarize,
    enabled: enabled,
    MAX_ROUND: MAX_ROUND,
    EXPIRE_TURNS: EXPIRE_TURNS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = TM.Negotiation;

  // 结算注册：序 90·perturn（过期清理·晚于各生产者本回合落账）
  try {
    if (global.SettlementPipeline && typeof global.SettlementPipeline.register === 'function') {
      global.SettlementPipeline.register('negotiationExpiry', '谈判会话过期清理', function () {
        try { tickExpiry(global.GM); } catch (_e) {}
      }, 90, 'perturn');
    }
  } catch (_eR) {}
})(typeof window !== 'undefined' ? window : globalThis);
