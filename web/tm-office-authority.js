/* tm-office-authority.js — 官制活化 Slice③ 权限门：执行力乘子(execution authority)
 *
 * 灵魂：颁布权 ≠ 执行力。canPerformAction 管"谁能颁/发起"(皇帝/领袖/掌权者)；
 *   本模块 resolveOfficeAuthority 管"执行得如何"——乘子来自掌该 power 的【在职主官】的履职度
 *   (无 _dutyState 则退回 才忠 capacity·故不硬依赖 Slice②)，再按忠诚叠乘(异己阳奉阴违)。
 * v1 标杆：taxCollect。落点在 ③b——fiscal_adjustments 税类 income × effectiveness，漏额→腐败(中饱私囊)。
 * 力度(owner 默认·可调)：出缺/无设 ×0.25 · 在职失职<35 ×0.55 · 中庸 ×0.85 · 称职>70 ×1.0 · 异己(忠<40)×0.7 叠乘。
 * 跨朝代：纯按抽象 power 反查掌权者，不认官署/官职专名（弱化 canPerformAction 里的名字正则技术债）。
 * 状态：已接线（resolveOfficeAuthority 挂 tm-ai-change-applier.js·税类 income×effectiveness·漏额→腐败）。注释此前误标「未接线」·已正。
 */
(function (global) {
  'use strict';

  var POWER_DOMAIN_ATTR = { taxCollect: 'administration', militaryCommand: 'military', appointment: 'administration', impeach: 'administration', supervise: 'administration', yinBu: 'administration', judicial: 'administration', works: 'management', drafting: 'intelligence' };
  var FORCE = { vacant: 0.25, low: 0.55, mid: 0.85, high: 1.0, disloyalMul: 0.7, disloyalBelow: 40, loBand: 35, hiBand: 70, min: 0.2, max: 1.05 };
  var HS = (global.TM && global.TM.OfficeHolderState) || (typeof require === 'function' ? require('./tm-office-holder-state.js') : null);

  function _fn(n) { return (typeof global[n] === 'function') ? global[n] : null; }
  function _rankLvl(p) { var g = _fn('getRankLevel'); return g ? g(p.rank) : 99; }
  function _clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // 找掌该 power 的【在职主官】(最高品·有 holder)；返回 {pos,dept,holder} 或 null
  function _findPowerHolder(GM, power) {
    var best = null, bestLvl = 99999;
    (function walk(ns) {
      (ns || []).forEach(function (n) {
        (n.positions || []).forEach(function (p) {
          var state = HS && HS.read(GM,p);
          if (p && p.powers && p.powers[power] && state && state.occupied) { var lvl = _rankLvl(p); if (lvl < bestLvl) { bestLvl = lvl; best = { pos: p, dept: n.name || '', holder: state.label, state:state }; } }
        });
        if (n.subs) walk(n.subs);
      });
    })(GM && GM.officeTree);
    return best;
  }
  // 该 power 是否在官制里"有设"(不论在缺)——区分"出缺"vs"根本无此职"
  function _powerExists(GM, power) {
    var found = false;
    (function walk(ns) { (ns || []).forEach(function (n) { if (found) return; (n.positions || []).forEach(function (p) { if (p && p.powers && p.powers[power]) found = true; }); if (n.subs) walk(n.subs); }); })(GM && GM.officeTree);
    return found;
  }
  // 五常评分(0-100)·履职看德性非忠君(owner 2026-06-20)：义.28信.28礼.20仁.16智.08·镜像 tmfRenwuWuchangValue 兜底读法
  var _WC_ALIAS = { ren: ['仁', 'ren', 'benevolence'], yi: ['义', 'yi', 'righteousness'], li: ['礼', 'li', 'propriety'], zhi: ['智', 'zhi', 'wisdom'], xin: ['信', 'xin', 'honesty', 'trust'] };
  function _wcVal(ch, k) { var src = (ch && (ch.wuchang || ch.wuchangOverride || ch.fiveConstants || ch.morals)) || {}; var al = _WC_ALIAS[k]; for (var i = 0; i < al.length; i++) { var v = src[al[i]]; if (v != null && !isNaN(Number(v))) return Number(v); } return 50; }
  function _wuchangScore(ch) { return _wcVal(ch, 'yi') * 0.28 + _wcVal(ch, 'xin') * 0.28 + _wcVal(ch, 'li') * 0.20 + _wcVal(ch, 'ren') * 0.16 + _wcVal(ch, 'zhi') * 0.08; }
  // 履职=域才0.6 + 五常0.4（德性·非忠君·owner 2026-06-20）
  function _capacity(ch, power) { var k = POWER_DOMAIN_ATTR[power] || 'administration'; var dv = (ch[k] != null) ? ch[k] : 50; return dv * 0.6 + _wuchangScore(ch) * 0.4; }

  /**
   * 解析某 power 的执行力。
   * @returns {{effectiveness:number, band:string, holder:?string, fulfillment:?number, disloyal:boolean, reason:string}}
   */
  function resolveOfficeAuthority(GM, power, opts) {
    opts = opts || {};
    var F = Object.assign({}, FORCE, opts.force || {});
    if (!GM || !GM.officeTree) return { effectiveness: F.vacant, band: 'vacant', holder: null, fulfillment: null, disloyal: false, reason: '无官制' };
    var hit = _findPowerHolder(GM, power);
    if (!hit) {
      var exists = _powerExists(GM, power);
      return { effectiveness: F.vacant, band: 'vacant', holder: null, fulfillment: null, disloyal: false, reason: exists ? ('掌' + power + '之职出缺·无人主持') : ('官制无掌' + power + '之职') };
    }
    var ch = hit.state.primary;
    var ds = hit.pos._dutyState;
    var availability = HS.availability(GM,ch,hit.pos);
    var f = ds && ds.byPower && typeof ds.byPower[power] === 'number' ? ds.byPower[power] : (ds && typeof ds.fulfillment === 'number') ? ds.fulfillment : (availability.char ? _capacity(availability.char, power)*availability.capacity : 50);
    var band = f < F.loBand ? 'low' : f > F.hiBand ? 'high' : 'mid';
    var base = band === 'low' ? F.low : band === 'high' ? F.high : F.mid;
    // 忠退出官制机制(owner 2026-06-20)：执行不可靠经 信→五常→履职 自然兜住·不再单设忠×0.7
    return {
      effectiveness: _clamp(base, F.min, F.max), band: band, holder: hit.holder, dept: hit.dept, pos: hit.pos.name,
      fulfillment: Math.round(f), occupancyStatus:hit.state.status, disloyal:false,
      reason: hit.dept + '·' + hit.pos.name + '(' + hit.holder + ')·履职' + Math.round(f)
    };
  }

  global.resolveOfficeAuthority = resolveOfficeAuthority;
  if (typeof module !== 'undefined' && module.exports) module.exports = { resolveOfficeAuthority: resolveOfficeAuthority, FORCE: FORCE };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
