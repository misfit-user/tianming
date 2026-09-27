// tm-reported-view.js — 奏报失真层·核心引擎（S1·2026-07-11·设计稿 docs/design-reported-view-2026-07.md）
// 真值 vs 上报值：GM 永远是真值本账，确定性系统与 AI 推演零改动；失真只发生在「给玩家看」的最后一层。
// 上报值 = 视图层纯推导(真值 + 吏治面 + 经手人点 + 回合确定性种子)——不落库、不做第二本账。
// 只在 严格史实模式(P.conf.gameMode==='strict_hist') 且 设置开关 reportedViewEnabled 开启时激活。
// 揭真 = GM._reportedReveals 许可表（只存「哪键已掀·几回合内显实情」，不存数值·非第二本账）·ttl 过后重新蒙尘。
// 消费端(S2-S7 分波接入)：顶栏/抽屉/右rail/舆图 dossier 渲染处调 value() 取显示值·badge() 标「据奏」口径。
(function(global){
  'use strict';

  var CAP = 0.35;          // 偏移幅度封顶(占真值比例)·防荒诞
  var REVEAL_TTL = 6;      // 揭真默认有效回合数·情势推移后重新蒙尘

  function _gm(){ return (global.GM && typeof global.GM === 'object') ? global.GM : {}; }

  // FNV-1a 字符串 hash·确定性种子：同局同回合同键 = 同上报值(同回合数字恒定不乱跳)·回合推进才变
  function _hash(s){
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h >>> 0;
  }

  function active(P){
    var Pp = P || global.P || null;
    return !!(Pp && Pp.conf && Pp.conf.gameMode === 'strict_hist' && Pp.conf.reportedViewEnabled !== false);
  }

  // 吏治「面」因子 0..1(浊度越高粉饰越狠·共识：吏治管面·方向固定往粉饰偏)
  // dept 可选分部门(central/provincial/military/fiscal → GM.corruption.subDepts)
  function _corruptFactor(dept){
    var c = _gm().corruption || {};
    var idx = Number(c.trueIndex != null ? c.trueIndex : c.overall);
    if (dept && c.subDepts && c.subDepts[dept] && isFinite(Number(c.subDepts[dept].true))) idx = Number(c.subDepts[dept].true);
    if (!isFinite(idx)) return 0.3;   // 无吏治账按中档
    return Math.max(0, Math.min(1, idx / 100));
  }

  // 经手人「点」因子(共识：忠诚/性格管点)·直臣经手偏移减半·离心之臣加码歪曲
  function _handlerFactor(h){
    if (!h) return 0;
    var loy = Number(h.loyalty);
    if (!isFinite(loy)) return 0;
    if (loy >= 75) return -0.5;
    if (loy < 40) return 0.6;
    return 0;
  }

  // 上报值纯推导。ctx: { P, direction:'bad'|'good', dept, handler }
  //   direction：bad=坏消息(灾荒/欠饷/浊度)方向瞒减·good=好消息(岁入/兵额/垦田)方向虚增
  // 返回 { shown, distorted, basis, frac }——渲染处显 shown·distorted 时配 badge()。
  function value(domain, key, trueVal, ctx){
    ctx = ctx || {};
    if (trueVal == null || (typeof trueVal === 'string' && !trueVal.trim())) return { shown: trueVal, distorted: false, basis: 'non-numeric' };
    var t = Number(trueVal);
    if (!isFinite(t)) return { shown: trueVal, distorted: false, basis: 'non-numeric' };
    if (!active(ctx.P)) return { shown: t, distorted: false, basis: 'inactive' };
    if (revealed(domain, key)) return { shown: t, distorted: false, basis: 'revealed' };
    var g = _gm();
    var seed = _hash(String(g.sid || '') + '|' + String(g.turn || 0) + '|' + String(domain) + '|' + String(key));
    var face = _corruptFactor(ctx.dept);
    var point = _handlerFactor(ctx.handler);
    var mag = Math.max(0, Math.min(1, face * (1 + point)));
    var jitter = ((seed % 1000) / 1000 - 0.5) * 0.2;                    // ±10% 确定性抖动·防玩家心算还原固定比例
    var frac = Math.max(0, Math.min(CAP, mag * 0.3 * (1 + jitter)));
    var dir = ctx.direction === 'good' ? 1 : -1;
    var shown = t + dir * Math.abs(t) * frac;
    if (t === Math.round(t)) shown = Math.round(shown);                 // 整数真值出整数上报·贴口径形态
    return { shown: shown, distorted: frac > 0.0001 && shown !== t, basis: 'reported', frac: frac };
  }

  // 「据奏」口径徽(渲染处配在失真数字旁·铁律④：据奏值必须明确标注)
  function badge(r){
    if (!r || !r.distorted) return '';
    return '<span class="tm-reported-badge" title="据奏值·有司上报口径（吏治使然·或有粉饰）。厂卫密奏、诏狱推问、派员核查可掀见实情。" style="font-size:0.62rem;color:var(--txt-d,#8a7c62);border:1px solid rgba(184,154,83,0.3);border-radius:3px;padding:0 3px;margin-left:3px;vertical-align:middle;">据奏</span>';
  }

  function _reveals(){
    var g = _gm();
    if (!g._reportedReveals || typeof g._reportedReveals !== 'object') g._reportedReveals = {}; // arch-ok: 揭真许可表·只存许可不存数值(设计稿铁律·非第二本账)
    return g._reportedReveals;
  }

  function revealed(domain, key){
    var g = _gm();
    var rec = g._reportedReveals && g._reportedReveals[String(domain) + ':' + String(key)];
    if (!rec) return false;
    var turn = Number(g.turn) || 0;
    return (turn - (Number(rec.turn) || 0)) < (Number(rec.ttl) || REVEAL_TTL);
  }

  // 揭真登记(S6 各通道调：派员查案成/厂卫密奏/诏狱推问/门生密报)·ttl 回合内该键显实情
  function reveal(domain, key, source, ttl){
    var g = _gm();
    _reveals()[String(domain) + ':' + String(key)] = { turn: Number(g.turn) || 0, source: String(source || ''), ttl: Number(ttl) || REVEAL_TTL }; // arch-ok: 揭真许可表(同上)
    return true;
  }

  var API = { active: active, value: value, badge: badge, revealed: revealed, reveal: reveal, REVEAL_TTL: REVEAL_TTL, _hash: _hash };
  global.TM = global.TM || {};
  global.TM.ReportedView = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : this);
