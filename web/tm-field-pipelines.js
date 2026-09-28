/* ============================================================
 * tm-field-pipelines.js — 字段活化第一批读管线（S6 · 2026-06-12）
 *
 * 设计案 web/docs/region-panel-buildings-fields-design-2026-06.md §三/§四。
 * 五条读管线（全是「消费已有字段」的单点接入，不新增写渠道）：
 *   ① policyExecution / postRelays / roadQuality / officeVacancy / governor
 *      → policyExecRate(div)：凡诏令落本地的效果按执行率打折
 *        （消费点：tm-endturn-apply admin_changes 的 *_delta）。
 *   ② fugitives / hiddenCount → fleeTaxPenalty(div)：逃隐户不纳粮，税基折减
 *        （消费点：tm-fiscal-engine computeTaxAmount——cascade 权威税路）。
 *   ③ militaryDetail.availableRecruits（tm-minxin-hard-links 每回合算的兵源池）
 *      → capRecruitDelta()：募兵硬上限，越限强征立扣民心叶
 *        （消费点：tm-ai-change-army 募兵类正向扩编）。
 *   ④ taxLevel/taxRate（重税之地）→ tick()：民心叶账缓跌（地板 25 防确定性死亡螺旋）
 *        （挂 endturn-core·BuildingWorks.tick 旁·每回合恰一次）。
 *   ⑤ 以上每笔确定性变更记 div._fieldLedger 环形近账（每字段 8 条·S7 因果签消费）。
 *
 * 铁律：只改源头叶子（minxin/militaryDetail.availableRecruits），
 *       聚合值由回合末 aggregate 自然算；无数据的字段一律不动（零数据=零行为变更）。
 * ============================================================ */
(function () {
  'use strict';

  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d === undefined ? 0 : d); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function round2(n) { return Math.round(num(n) * 100) / 100; }

  // ── S7 字段近账：环形 8 条/字段（与 MinxinLedger 同范式·轻量版） ──
  function ledgerPush(div, field, delta, why, GM) {
    if (!div) return;
    if (!div._fieldLedger || typeof div._fieldLedger !== 'object') div._fieldLedger = {};
    if (!Array.isArray(div._fieldLedger[field])) div._fieldLedger[field] = [];
    var ring = div._fieldLedger[field];
    ring.push({ turn: (GM && num(GM.turn, 0)) || 0, delta: round2(delta), why: String(why || '').slice(0, 60) });
    while (ring.length > 8) ring.shift();
  }

  // ── ① 政令执行率：底数取硬链引擎算的 localExecutionRate（无则 0.85），
  //      再扣官缺/无主官/驿路时滞——postRelays 的活账就在这条折扣里 ──
  function policyExecRate(div) {
    if (!div) return { rate: 1, parts: [] };
    var parts = [];
    var base = num(div.localExecutionRate, num(div.executionRate, NaN));
    if (isFinite(base)) {
      base = base > 1 ? base / 100 : base;
      parts.push('政令执行底数 ' + Math.round(base * 100) + '%（民心/贪腐/隐户折算）');
    } else {
      base = num(div.policyExecution, NaN);
      if (isFinite(base)) { base = base > 1 ? base / 100 : base; parts.push('剧本执行率 ' + Math.round(base * 100) + '%'); }
      else base = 0.85;
    }
    var rate = base;
    var vac = num(div.officeVacancy, 0);
    if (vac > 0) {
      var dv = Math.min(0.24, vac * 0.08);
      rate -= dv;
      parts.push('官缺 ' + vac + ' 员 −' + Math.round(dv * 100) + '%');
    }
    if (div.governor !== undefined && !String(div.governor || '').trim()) {
      rate -= 0.05;
      parts.push('主官出缺 −5%');
    }
    var eb = div.economyBase || {};
    var lag = 0;
    var post = num(eb.postRelays, NaN);
    var road = num(eb.roadQuality, NaN);
    if (isFinite(post) && post < 5) lag += 0.05;
    if (isFinite(road) && road < 30) lag += 0.05;
    if (lag > 0) {
      rate -= lag;
      parts.push('驿路阻滞 −' + Math.round(lag * 100) + '%（驿站 ' + (isFinite(post) ? post : '—') + ' · 道路 ' + (isFinite(road) ? road : '—') + '）');
    }
    // 省道履职单列上官修正，不覆写地方原有执行率底数。
    var effects = typeof window !== 'undefined' && window.TM && window.TM.CircuitGovernorEffects;
    var governor = typeof GM !== 'undefined' && GM && GM.circuitGovernance && GM.circuitGovernance.byLeaf[div.id];
    if (effects && effects.enabled() && governor && Number.isFinite(governor.exec)) {
      rate += governor.exec;
      parts.push('上官修正 ' + (governor.exec >= 0 ? '+' : '−') + Math.abs(governor.exec * 100).toFixed(1) + '%（' + (governor.holder || '出缺') + '·距驻地 ' + governor.days + ' 日' + (governor.estimated ? '·估程' : '') + '）');
    }
    rate = clamp(rate, 0.3, 1);
    return { rate: round2(rate), parts: parts };
  }

  // ── ② 逃隐户税基折减：逃户全免、隐户六成不纳（荫庇下仍有些许浮收），封顶 35% ──
  function fleeTaxPenalty(div) {
    if (!div) return 0;
    var pd = div.populationDetail || {};
    var mouths = num(pd.mouths, num(typeof div.population === 'number' ? div.population : 0, 0));
    if (mouths <= 0) return 0;
    var fled = Math.max(0, num(pd.fugitives, 0)) + Math.max(0, num(pd.hiddenCount, 0)) * 0.6;
    if (fled <= 0) return 0;
    return round2(Math.min(0.35, fled / mouths));
  }

  // ── 税负档：镜像 tm-minxin-hard-links 的 taxFactor（其未导出·六行原样·改动须两处同步） ──
  function taxBurdenFactor(div) {
    var raw = String(div && (div.taxLevel || div.tax || div.taxPolicy || div.fiscalPolicy) || '').toLowerCase();
    if (/heavy|high|severe|harsh|重|高|苛|酷/.test(raw)) return 1.18;
    if (/light|low|reduced|relief|轻|低|减|免/.test(raw)) return 0.84;
    var n = num(div && (div.taxRate || div.taxPressure), NaN);
    if (isFinite(n) && n > 0) return clamp(n > 2 ? n / 100 : n, 0.7, 1.35);
    return 1;
  }

  // ── ③ 募兵硬上限：按驻地兵源池（硬链引擎 md.availableRecruits）封顶；
  //      池缺数据时回退 丁口×12%×七折；全无数据返回 null（不可归因则不拦） ──
  function findDivisionByName(P, name) {
    if (!P || !P.adminHierarchy || !name) return null;
    var key = String(name).trim();
    if (!key) return null;
    var hit = null;
    Object.keys(P.adminHierarchy).forEach(function (fk) {
      var fh = P.adminHierarchy[fk];
      if (!fh || !fh.divisions) return;
      (function walk(ds) {
        ds.forEach(function (d) {
          if (!d || hit) return;
          var dn = String(d.name || '').trim();
          if (dn && (dn === key || dn.indexOf(key) >= 0 || key.indexOf(dn) >= 0)) hit = d;
          var kids = d.children || d.divisions;
          if (kids && kids.length && !hit) walk(kids);
        });
      })(fh.divisions);
    });
    return hit;
  }
  function recruitCap(div) {
    if (!div) return null;
    var md = div.militaryDetail || {};
    var pool = num(md.availableRecruits, NaN);
    if (isFinite(pool)) return Math.max(0, Math.round(pool));
    var pd = div.populationDetail || {};
    var ding = num(pd.ding, NaN);
    if (isFinite(ding) && ding > 0) return Math.max(0, Math.round(ding * 0.12 * 0.7));
    return null;
  }
  function capRecruitDelta(GM, P, locationName, delta) {
    delta = Math.round(num(delta, 0));
    if (delta <= 0) return null;
    var div = findDivisionByName(P, locationName);
    if (!div) return null;
    var cap = recruitCap(div);
    if (cap === null) return null;
    // 征兵效率（民心派生·realm-wide）真影响募兵池上限：民心崩则丁壮逃役、募不满额——
    //   让「征兵效率」从空显示变成真后果（2026-06-15·#6 假数字治理）。clamp 0.3~1.3 与显示口径一致。
    var _cEff = (GM && typeof GM._conscriptEffMult === 'number' && isFinite(GM._conscriptEffMult)) ? Math.max(0.3, Math.min(1.3, GM._conscriptEffMult)) : 1;
    var effCap = Math.max(0, Math.round(cap * _cEff));
    var approved = Math.min(delta, effCap);
    var overdraft = delta - approved;
    if (overdraft > 0) {
      // 强征越限：民心叶账立扣（地板 20·非玄幻——抽丁过池即扰民）
      if (div.minxin !== undefined || div.minxinLocal !== undefined) {
        var cur = num(div.minxin, num(div.minxinLocal, 60));
        var next = Math.max(20, cur - 1);
        if (div.minxin !== undefined) div.minxin = next;
        if (div.minxinLocal !== undefined) div.minxinLocal = next;
        ledgerPush(div, 'minxin', next - cur, '强征过池（募 ' + delta + ' 超兵源 ' + cap + '）', GM);
      }
    }
    // 池内扣减：同回合多笔募兵共享兵源
    if (div.militaryDetail && isFinite(num(div.militaryDetail.availableRecruits, NaN))) {
      div.militaryDetail.availableRecruits = Math.max(0, Math.round(num(div.militaryDetail.availableRecruits) - approved));
      ledgerPush(div, 'recruits', -approved, '募兵成军', GM);
    }
    return { div: div, cap: effCap, rawCap: cap, conscriptEff: _cEff, approved: approved, overdraft: overdraft };
  }

  // ── ④ 每回合确定性步：重税之地民心叶账缓跌（挂 endturn-core·aggregate 之前） ──
  function tick(GM, P) {
    var stat = { taxedRegions: 0, minxinDeducted: 0 };
    if (!GM || !P || !P.adminHierarchy) return stat;
    Object.keys(P.adminHierarchy).forEach(function (fk) {
      var fh = P.adminHierarchy[fk];
      if (!fh || !fh.divisions) return;
      (function walk(ds) {
        ds.forEach(function (div) {
          if (!div) return;
          var kids = div.children || div.divisions;
          var isLeaf = !(kids && kids.length);
          if (isLeaf) {
            var factor = taxBurdenFactor(div);
            if (factor >= 1.18 && (div.minxin !== undefined || div.minxinLocal !== undefined)) {
              var dec = factor >= 1.3 ? 1 : 0.5;
              var cur = num(div.minxin, num(div.minxinLocal, 60));
              if (cur > 25) {
                var next = round2(Math.max(25, cur - dec));
                if (div.minxin !== undefined) div.minxin = next;
                if (div.minxinLocal !== undefined) div.minxinLocal = next;
                ledgerPush(div, 'minxin', next - cur, '重税苛敛（税则 ' + round2(factor) + '）', GM);
                stat.taxedRegions += 1;
                stat.minxinDeducted += cur - next;
              }
            }
          }
          if (kids && kids.length) walk(kids);
        });
      })(fh.divisions);
    });
    return stat;
  }

  var api = {
    policyExecRate: policyExecRate,
    fleeTaxPenalty: fleeTaxPenalty,
    taxBurdenFactor: taxBurdenFactor,
    recruitCap: recruitCap,
    capRecruitDelta: capRecruitDelta,
    findDivisionByName: findDivisionByName,
    ledgerPush: ledgerPush,
    tick: tick
  };

  if (typeof window !== 'undefined') {
    window.TM = window.TM || {};
    window.TM.FieldPipes = api;
  } else if (typeof globalThis !== 'undefined') {
    globalThis.TM = globalThis.TM || {};
    globalThis.TM.FieldPipes = api;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
