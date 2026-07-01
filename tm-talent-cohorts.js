/* tm-talent-cohorts.js — S1 人才范式渗透引擎（重建·2026-06-30）
 * 详设 institutional-building-talent-penetration-design-2026-06.md · 进度 talent-cohorts-PROGRESS-2026-06-30.md
 *
 * 核心抽象：数据驱动、运行时可由玩家描述 + AI 核议动态创建的「人才范式(paradigm)」。
 * 引擎绝不预设任何具体的「学」(实学/西学/格致/玩家自创一律平等)。每回合 tick 跑多瓶颈漏斗：
 *   招生 → 师资质量(没老师=水货) → 产业吸纳(没岗位=失业) → 历练数年 → 制度空间(旧势力压制)
 *   → 质量加权【有效渗透率】 → 因范式而异的全局软修正(influenceProfile·注入AI·非写死) + 双向阻力。
 * 三瓶颈输入「依赖倒置」：ctx 可注入 teacherCapacityFor/absorptionDemandFor/institutionalRoomFor，
 *   缺省则用引擎内置(师资=外聘基数+成熟人才回流自举)。真实接线见 tm-talent-bottlenecks.js。
 * flag P.conf.talentCohortEnabled 默认关 → tick no-op、不建状态 → 全系统零回归。跨朝代：无任何朝代专名。
 */
(function (root) {
  "use strict";
  var TM = root.TM || (root.TM = {});

  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function conf(P) { return (P && P.conf) || (root.P && root.P.conf) || {}; }
  function enabled(P) { return conf(P).talentCohortEnabled === true; }

  // ── 调参集中（真机可调·标注校准）──────────────────────────────
  var TUNING = {
    maturityTurns: 60,        // 毕业→成熟历练回合(≈数年·按粒度校准·范式可覆盖)
    decayRate: 0.015,         // 成熟存量世代自然致仕/凋零·每回合
    unemployedDecay: 0.06,    // 失业存量流失(改行/外流)·每回合
    studentsPerTeacher: 25,   // 生师比阈值：1 合格师资带 25 生而不掉质，超则质量断崖
    baseTeacherHire: 60,      // 无 ctx 注入时的外聘师资基数(贵·少)
    teacherReturnRatio: 0.04, // 成熟人才回流任教比例(自举：早期 stock≈0 → 师资极稀 = 第一道死结)
    qualityFloor: 0.0,        // 培养质量下限
    historyCap: 240,          // history 滚动上限
    // 渗透分档（每范式各算·design §2.6）
    tiers: [
      { min: 0.50, label: '主导' },
      { min: 0.30, label: '主流' },
      { min: 0.15, label: '可观' },
      { min: 0.05, label: '渐显' },
      { min: 0.00, label: '萌芽' }
    ]
  };

  // ── 状态容器 ─────────────────────────────────────────────────
  function ensure(GM) {
    if (!GM._talentCohorts) GM._talentCohorts = { paradigms: {}, seq: 0, history: [] };
    return GM._talentCohorts;
  }
  function init(GM, P) { return ensure(GM); }

  // ── 范式注册（空壳·内容涌现）─────────────────────────────────
  function registerParadigm(GM, spec) {
    var st = ensure(GM); spec = spec || {};
    var id = spec.id || ('pdg_' + (++st.seq));
    var iq = (spec.initialQuality == null) ? 1 : clamp(num(spec.initialQuality, 1), 0, 1);
    var stock0 = num(spec.stock, 0);
    var p = {
      id: id,
      label: spec.label || id,
      kind: (spec.kind === 'established') ? 'established' : 'emergent',
      stock: stock0,                                   // 成熟在岗人数
      qualityStock: stock0 * iq,                       // 质量加权成熟(Σ n×quality)
      trainingCohorts: [],                             // [{enteredTurn,n,quality}] 历练梯队(质量已烙印)
      unemployed: num(spec.unemployed, 0),             // 知识失业存量
      decayRate: (spec.decayRate != null) ? num(spec.decayRate, TUNING.decayRate) : TUNING.decayRate,
      maturityTurns: (spec.maturityTurns != null) ? Math.max(1, Math.round(num(spec.maturityTurns, TUNING.maturityTurns))) : TUNING.maturityTurns,
      influenceProfile: (spec.influenceProfile && typeof spec.influenceProfile === 'object') ? spec.influenceProfile : {},
      absorptionKind: (spec.absorptionKind && spec.absorptionKind.length) ? spec.absorptionKind.slice() : [],
      sources: {},                                     // { srcId: 年贡献人数 } 可逆溯源
      // —— 运行时派生（每 tick 刷新）——
      effectiveStock: stock0 * iq,                     // = qualityStock × institutionalRoom
      lastQuality: iq, lastIntake: 0, lastAbsorbRate: 1, lastRoom: 1
    };
    st.paradigms[id] = p;
    return p;
  }

  function findParadigm(GM, idOrLabel) {
    var st = GM && GM._talentCohorts; if (!st || idOrLabel == null) return null;
    if (st.paradigms[idOrLabel]) return st.paradigms[idOrLabel];
    var keys = Object.keys(st.paradigms);
    for (var i = 0; i < keys.length; i++) { if (st.paradigms[keys[i]].label === idOrLabel) return st.paradigms[keys[i]]; }
    return null;
  }

  function registerSource(GM, srcId, paradigmId, graduates) {
    var st = ensure(GM); var p = st.paradigms[paradigmId]; if (!p || srcId == null) return false;
    p.sources[srcId] = Math.max(0, num(graduates, 0)); return true;
  }
  function revokeSource(GM, srcId, paradigmId) {
    var st = GM && GM._talentCohorts; if (!st || srcId == null) return false;
    if (paradigmId && st.paradigms[paradigmId] && st.paradigms[paradigmId].sources[srcId] != null) {
      delete st.paradigms[paradigmId].sources[srcId]; return true;
    }
    var keys = Object.keys(st.paradigms);
    for (var i = 0; i < keys.length; i++) { if (st.paradigms[keys[i]].sources[srcId] != null) { delete st.paradigms[keys[i]].sources[srcId]; return true; } }
    return false;
  }

  // ── 三瓶颈输入（ctx 注入优先·缺省内置）──────────────────────
  function teacherCapacity(p, ctx) {
    if (ctx && typeof ctx.teacherCapacityFor === 'function') return Math.max(0, num(ctx.teacherCapacityFor(p), 0));
    return TUNING.baseTeacherHire + p.stock * TUNING.teacherReturnRatio;  // 外聘 + 成熟人才回流自举
  }
  function absorptionDemand(p, ctx) {
    if (ctx && typeof ctx.absorptionDemandFor === 'function') return Math.max(0, num(ctx.absorptionDemandFor(p), 0));
    return Infinity;  // 无 ctx → 不约束(纯引擎自测)
  }
  function institutionalRoom(p, ctx) {
    if (ctx && typeof ctx.institutionalRoomFor === 'function') return clamp(num(ctx.institutionalRoomFor(p), 1), 0, 1);
    return 1;
  }

  // ── 单范式漏斗 ───────────────────────────────────────────────
  function tickParadigm(GM, P, p, ctx, turn) {
    // 第0层·招生（学校 sources Σ → 年毕业基数）。招生 ≠ 成才。
    var intake = 0, sk = Object.keys(p.sources);
    for (var i = 0; i < sk.length; i++) intake += num(p.sources[sk[i]], 0);
    p.lastIntake = intake;

    if (intake > 0) {
      // 第1层·师资瓶颈：质量 = clamp(合格师资×生师比阈值 / 在学规模)。质量当回合烙印进 cohort。
      var tcap = teacherCapacity(p, ctx);
      var quality = clamp((tcap * TUNING.studentsPerTeacher) / intake, TUNING.qualityFloor, 1);
      p.lastQuality = quality;
      // 第2层·吸纳瓶颈：absorbRate = min(1, 岗位需求 / 合格供给)。供>需 → 溢出转失业。
      var demand = absorptionDemand(p, ctx);
      var absorbRate = (demand === Infinity) ? 1 : clamp(demand / intake, 0, 1);
      p.lastAbsorbRate = absorbRate;
      var absorbed = intake * absorbRate;
      p.unemployed += (intake - absorbed);
      // 第3层·历练滞后：被吸纳者进梯队(带质量)。
      if (absorbed > 0) p.trainingCohorts.push({ enteredTurn: turn, n: absorbed, quality: quality });
    }

    // 历练满期 → 转入成熟 stock（质量随之沉淀，历练只增熟练不改质量）
    if (p.trainingCohorts.length) {
      var keep = [];
      for (var c = 0; c < p.trainingCohorts.length; c++) {
        var co = p.trainingCohorts[c];
        if ((turn - co.enteredTurn) >= p.maturityTurns) { p.stock += co.n; p.qualityStock += co.n * co.quality; }
        else keep.push(co);
      }
      p.trainingCohorts = keep;
    }

    // 第5层·世代衰减
    if (p.decayRate > 0) { var kf = 1 - p.decayRate; p.stock *= kf; p.qualityStock *= kf; }
    if (p.unemployed > 0) p.unemployed *= (1 - TUNING.unemployedDecay);
    if (p.stock < 1e-6) p.stock = 0;
    if (p.qualityStock < 1e-6) p.qualityStock = 0;
    if (p.unemployed < 1e-6) p.unemployed = 0;

    // 第4层·制度空间 → 有效人才（design §2.5：有效 = 质量加权成熟 × institutionalRoom）
    var room = institutionalRoom(p, ctx); p.lastRoom = room;
    p.effectiveStock = p.qualityStock * room;
  }

  function tick(GM, P, ctx) {
    if (!enabled(P)) return { paradigms: 0 };
    var st = ensure(GM); var turn = num(GM && GM.turn, 0);
    var ids = Object.keys(st.paradigms);
    var totalIntake = 0, totalUnemployed = 0;
    for (var i = 0; i < ids.length; i++) {
      var p = st.paradigms[ids[i]];
      tickParadigm(GM, P, p, ctx, turn);
      totalIntake += p.lastIntake; totalUnemployed += p.unemployed;
    }
    var pen = penetration(GM, P, ctx);
    st.history.push({ turn: turn, byParadigm: pen.byParadigm });
    if (st.history.length > TUNING.historyCap) st.history.shift();
    return { paradigms: ids.length, intake: totalIntake, unemployed: totalUnemployed };
  }

  // ── 有效渗透率（非简单 stock 占比；质量加权 + 制度乘子）────────
  //   渗透率_i = 有效人才_i / ( Σ_emergent 有效人才 + Σ_established stock )
  function penetration(GM, P, ctx) {
    var st = GM && GM._talentCohorts; var out = { byParadigm: {}, denom: 0 };
    if (!st) return out;
    var ids = Object.keys(st.paradigms), denom = 0, eff = {};
    for (var i = 0; i < ids.length; i++) {
      var p = st.paradigms[ids[i]];
      var e = (p.kind === 'established') ? num(p.stock, 0) : num(p.effectiveStock, 0);
      eff[p.id] = e; denom += e;
    }
    out.denom = denom;
    for (var j = 0; j < ids.length; j++) { var id = ids[j]; out.byParadigm[id] = denom > 0 ? eff[id] / denom : 0; }
    return out;
  }

  function tierOf(rate) {
    for (var i = 0; i < TUNING.tiers.length; i++) { if (rate >= TUNING.tiers[i].min) return TUNING.tiers[i].label; }
    return '萌芽';
  }

  // ── 渗透格局 → 全局软修正（influenceProfile 加权·因范式而异·design §2.6）──
  function globalModifiers(GM, P, ctx) {
    var st = GM && GM._talentCohorts; var mods = {};
    if (!st) return mods;
    var pen = penetration(GM, P, ctx); var ids = Object.keys(st.paradigms);
    for (var i = 0; i < ids.length; i++) {
      var p = st.paradigms[ids[i]]; if (p.kind !== 'emergent') continue;
      var rate = pen.byParadigm[p.id] || 0; var prof = p.influenceProfile || {}; var dk = Object.keys(prof);
      for (var d = 0; d < dk.length; d++) { mods[dk[d]] = (mods[dk[d]] || 0) + rate * num(prof[dk[d]], 0); }
    }
    return mods;
  }

  // ── 双向全局阻力（design §2.7）──────────────────────────────
  //   右·旧势力反扑 = f(渗透上升速度, 旧式存量, 触动深度)；左·失业动荡 = f(失业占受教育人口比)
  function backlashSignals(GM, P, ctx) {
    var st = GM && GM._talentCohorts; var out = { backlash: 0, unrest: 0, unemployed: 0, byParadigm: {} };
    if (!st) return out;
    var pen = penetration(GM, P, ctx); var hist = st.history; var ids = Object.keys(st.paradigms);
    var establishedStock = 0;
    for (var k = 0; k < ids.length; k++) { if (st.paradigms[ids[k]].kind === 'established') establishedStock += num(st.paradigms[ids[k]].stock, 0); }
    var totalUnemployed = 0, eduPool = 0;
    for (var i = 0; i < ids.length; i++) {
      var p = st.paradigms[ids[i]];
      totalUnemployed += num(p.unemployed, 0);
      eduPool += num(p.stock, 0) + num(p.unemployed, 0);
      if (p.kind === 'emergent') {
        var rate = pen.byParadigm[p.id] || 0, prev = 0;
        if (hist && hist.length >= 2) { var h = hist[hist.length - 2]; prev = (h.byParadigm && h.byParadigm[p.id]) || 0; }
        var dRate = Math.max(0, rate - prev);
        out.byParadigm[p.id] = { penetration: rate, dRate: dRate, tier: tierOf(rate) };
        out.backlash += dRate * Math.log10(10 + establishedStock) * rate;  // 升越快 × 旧越庞大 × 触动越深
      }
    }
    out.unrest = eduPool > 0 ? clamp(totalUnemployed / eduPool, 0, 1) : 0;
    out.unemployed = totalUnemployed;
    return out;
  }

  // ── AI 推演注入段「人才与风气」（塑造裁决语境·非写死数值）────
  function pctStr(x) { return (x * 100).toFixed(1) + '%'; }
  function summarize(GM, P, ctx) {
    if (!enabled(P)) return '';
    var st = GM && GM._talentCohorts; if (!st) return '';
    var ids = Object.keys(st.paradigms); if (!ids.length) return '';
    var pen = penetration(GM, P, ctx);
    var lines = ['【人才与风气】（学校育才→历练→渗透的全局软态势；下列倾向为「成功率倾向」非「必成」）'];
    for (var i = 0; i < ids.length; i++) {
      var p = st.paradigms[ids[i]]; var rate = pen.byParadigm[p.id] || 0;
      var training = 0; for (var c = 0; c < p.trainingCohorts.length; c++) training += p.trainingCohorts[c].n;
      if (p.kind === 'emergent') {
        lines.push('· 新学「' + p.label + '」：渗透' + tierOf(rate) + '（' + pctStr(rate) + '）·有效人才约' + Math.round(p.effectiveStock) +
          '·成熟' + Math.round(p.stock) + '·在训' + Math.round(training) + '·失业' + Math.round(p.unemployed) +
          '·年招' + Math.round(p.lastIntake) + '·培养质量' + pctStr(p.lastQuality || 0));
      } else {
        lines.push('· 既有正统「' + p.label + '」：存量约' + Math.round(p.stock));
      }
    }
    var mods = globalModifiers(GM, P, ctx); var mk = Object.keys(mods); var parts = [];
    for (var m = 0; m < mk.length; m++) { if (mods[mk[m]] > 0.0001) parts.push(mk[m] + '+' + pctStr(mods[mk[m]])); }
    if (parts.length) lines.push('· 风气倾向（按各学性质加权）：' + parts.join('、'));
    var bs = backlashSignals(GM, P, ctx);
    if (bs.backlash > 0.001 || bs.unrest > 0.02) {
      lines.push('· 阻力：旧势力反扑' + (bs.backlash > 0.05 ? '强' : (bs.backlash > 0.01 ? '渐起' : '微')) +
        '·失业动荡' + (bs.unrest > 0.3 ? '高' : (bs.unrest > 0.1 ? '渐起' : '微')) + '（失业约' + Math.round(bs.unemployed) + '人）');
    }
    return lines.join('\n');
  }

  // ── 显示就绪数据（S6·面板渲染·标签词汇留逻辑层·UI 只渲染·仿 GlobalRules.cards）──
  function cards(GM, P, ctx) {
    if (!enabled(P)) return null;
    var st = GM && GM._talentCohorts; if (!st) return null;
    var ids = Object.keys(st.paradigms); if (!ids.length) return null;
    var pen = penetration(GM, P, ctx);
    var bs = backlashSignals(GM, P, ctx);
    var mods = globalModifiers(GM, P, ctx);
    var paradigms = ids.map(function (id) {
      var p = st.paradigms[id];
      var training = 0; for (var c = 0; c < p.trainingCohorts.length; c++) training += p.trainingCohorts[c].n;
      var rate = pen.byParadigm[id] || 0;
      return {
        id: id, label: p.label, kind: p.kind,
        penetration: rate, tier: tierOf(rate),
        effectiveStock: Math.round(num(p.effectiveStock)), stock: Math.round(num(p.stock)),
        training: Math.round(training), unemployed: Math.round(num(p.unemployed)),
        quality: num(p.lastQuality), intake: Math.round(num(p.lastIntake))
      };
    });
    var tendencies = Object.keys(mods).filter(function (k) { return mods[k] > 0.0001; }).map(function (k) { return { key: k, value: mods[k] }; });
    return {
      paradigms: paradigms, tendencies: tendencies,
      backlash: num(bs.backlash), unrest: num(bs.unrest), unemployed: Math.round(num(bs.unemployed))
    };
  }

  TM.TalentCohorts = {
    init: init,
    registerParadigm: registerParadigm, findParadigm: findParadigm,
    registerSource: registerSource, revokeSource: revokeSource,
    tick: tick, penetration: penetration,
    globalModifiers: globalModifiers, backlashSignals: backlashSignals,
    summarize: summarize, cards: cards, tierOf: tierOf,
    enabled: enabled, TUNING: TUNING, version: '0.3.0-S6-cards'
  };
  if (typeof module !== "undefined" && module.exports) module.exports = TM.TalentCohorts;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
