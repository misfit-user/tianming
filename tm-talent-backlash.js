/* tm-talent-backlash.js — S5 全局阻力：人才渗透的双向反弹 → 御案时政政治事件 + 临界非线性瓦解
 * 详设 institutional-building-talent-penetration-design-2026-06.md §2.7
 *
 * 读 TalentCohorts.backlashSignals（每回合·在引擎 tick 之后）：
 *   · 右·旧势力反扑 backlash（渗透升快 × 旧式庞大 × 触动深）→ currentIssue「旧学之党请罢新学」(有 choices·AI 当现行事件裁决)
 *   · 左·失业动荡 unrest（失业占受教育人口比）→ currentIssue「士子失业·学潮渐起」
 *   · 临界非线性瓦解：某新学渗透越临界 → 旧式正统加速边缘化（established 额外衰减·旧式反抗渐瓦解）
 * 并把 backlash 写入 GM._talentCohorts._lastBacklash 供 S5b 动态 institutionalRoom 读（旧势力反扑期·新人更难）。
 *
 * 架构（owner 拍板·互补分层）：阶层满意度/皇威之硬核齿轮归既有成熟的 GlobalRules.resistance；
 *   本模块只产 currentIssues（御案时政·GlobalRules 不做的）+ 叙事 EB + 临界瓦解，不重复造轮。
 * flag P.conf.talentCohortEnabled 默认关 → tick no-op。跨朝代：文案中立（新学/旧学/学堂/上疏/学潮/士子·
 *   范式名取剧本 label·无任何朝代专名）。去重：同类 pending 不重复 + 冷却回合防刷屏。
 */
(function (root) {
  "use strict";
  var TM = root.TM || (root.TM = {});
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }

  var TUNING = {
    backlashThreshold: 0.03,     // 旧势力反扑信号阈值（超 → 请罢新学之 issue）
    unrestThreshold: 0.25,       // 失业动荡阈值（失业占受教育人口比·超 → 学潮）
    cooldownTurns: 8,            // 同类政治事件冷却（防刷屏）
    collapseThreshold: 0.4,      // 渗透越此 → 旧式正统加速边缘化（非线性瓦解）
    collapseExtraDecayMax: 0.06  // 临界后旧式额外衰减/回合上限
  };

  function _eb(tag, text) { try { if (typeof root.addEB === 'function') root.addEB(tag, text); } catch (_) {} }
  function _ts(GM) { return (GM && GM._gameDate) || ''; }

  function _topEmergent(GM, pen) {
    var st = GM._talentCohorts, best = null;
    Object.keys(st.paradigms).forEach(function (id) {
      var p = st.paradigms[id]; if (!p || p.kind !== 'emergent') return;
      var r = pen.byParadigm[id] || 0; if (!best || r > best.pen) best = { p: p, pen: r };
    });
    return best;
  }
  function _topEstablished(GM) {
    var st = GM._talentCohorts, best = null;
    Object.keys(st.paradigms).forEach(function (id) {
      var p = st.paradigms[id]; if (!p || p.kind !== 'established') return;
      if (!best || p.stock > best.stock) best = p;
    });
    return best;
  }
  function _pending(GM, sourceType) {
    return Array.isArray(GM.currentIssues) && GM.currentIssues.some(function (i) { return i && i.status === 'pending' && i.sourceType === sourceType; });
  }
  function _cooldownOk(GM, key, turn) {
    var st = GM._talentCohorts; if (!st._backlashLast) st._backlashLast = {};
    var last = st._backlashLast[key];
    return (last == null) || (turn - last >= TUNING.cooldownTurns);
  }
  function _mark(GM, key, turn) { var st = GM._talentCohorts; if (!st._backlashLast) st._backlashLast = {}; st._backlashLast[key] = turn; }
  function _raiseIssue(GM, issue) {
    if (!Array.isArray(GM.currentIssues)) GM.currentIssues = [];
    GM.currentIssues.push(issue);
    _eb('要务', '御案新事：' + issue.title);
  }

  function tick(GM, P, ctx) {
    var TC = root.TM && root.TM.TalentCohorts;
    if (!TC || typeof TC.enabled !== 'function' || !TC.enabled(P)) return { raised: 0 };
    var st = GM && GM._talentCohorts; if (!st || !st.paradigms) return { raised: 0 };
    var turn = num(GM && GM.turn, 0);
    var pen = TC.penetration(GM, P, ctx);
    var bs = TC.backlashSignals(GM, P, ctx);
    st._lastBacklash = bs.backlash;   // 供 S5b 动态 institutionalRoom 读（政治阻力）
    var raised = 0;

    // ── S5a-右：旧势力反扑 → 请罢新学（有 choices·AI 裁决）──
    if (bs.backlash > TUNING.backlashThreshold && !_pending(GM, 'talent_backlash_right') && _cooldownOk(GM, 'right', turn)) {
      var te = _topEmergent(GM, pen), oe = _topEstablished(GM);
      if (te && te.pen > 0) {
        var tier = TC.tierOf(te.pen), estName = oe ? oe.label : '旧学';
        _raiseIssue(GM, {
          id: 'issue_talent_right_' + turn, sourceType: 'talent_backlash_right', sourceSystem: 'talent_cohorts',
          title: '旧学之党请罢新学',
          description: '新学「' + te.p.label + '」渐成气候（渗透' + tier + '，约' + (te.pen * 100).toFixed(1) + '%），' + estName + '之士交章上疏，斥其废祖宗成法、坏取士正途，请罢学堂、裁汰新进。',
          category: '关键决策', status: 'pending', raisedTurn: turn, raisedDate: _ts(GM),
          choices: [
            { text: '申饬言者·力挺新学', desc: '力排众议扶植新学', aiHint: '君上力挺新学：新学制度空间扩、渗透加速；然旧党离心、士绅满意度挫，或激更烈对抗' },
            { text: '抚慰旧党·暂抑新学', desc: '安抚士绅约束学堂', aiHint: '君上抚旧抑新：旧党气平、士绅安；然新学顿挫、人才向背存疑、改革派失望' },
            { text: '两可调和·徐图之', desc: '明抚暗持', aiHint: '君上调和：暂平物议而根本矛盾未解，双方观望，视后续手腕' }
          ]
        });
        _mark(GM, 'right', turn); raised++;
      }
    }

    // ── S5a-左：失业动荡 → 学潮（建太快太空所致）──
    if (bs.unrest > TUNING.unrestThreshold && !_pending(GM, 'talent_backlash_left') && _cooldownOk(GM, 'left', turn)) {
      _raiseIssue(GM, {
        id: 'issue_talent_left_' + turn, sourceType: 'talent_backlash_left', sourceSystem: 'talent_cohorts',
        title: '士子失业·学潮渐起',
        description: '新学毕业者众而无出路（失业约' + Math.round(bs.unemployed) + '人），失业士子聚众清议、激进思潮渐生。',
        category: '要事', status: 'pending', raisedTurn: turn, raisedDate: _ts(GM),
        choices: [
          { text: '兴实业/增官缺以纳之', desc: '为新学人才辟出路', aiHint: '君上辟出路：吸纳升、动荡平；然须财力与岗位实有，否则空言' },
          { text: '弹压学潮', desc: '强力镇抚', aiHint: '君上弹压：一时压下；然士子积怨、人才外流、士林离心' },
          { text: '放任自谋', desc: '不予理会', aiHint: '君上放任：失业积聚、激进蔓延、或酿更大动荡' }
        ]
      });
      _mark(GM, 'left', turn); raised++;
    }

    // ── S5c：临界非线性瓦解——某新学渗透越临界 → 旧式正统加速边缘化（旧式反抗渐瓦解）──
    var collapsed = 0, top = _topEmergent(GM, pen);
    if (top && top.pen > TUNING.collapseThreshold) {
      var over = (top.pen - TUNING.collapseThreshold) / (1 - TUNING.collapseThreshold);   // 0..1
      var extra = Math.min(TUNING.collapseExtraDecayMax, TUNING.collapseExtraDecayMax * over);
      if (extra > 0) {
        Object.keys(st.paradigms).forEach(function (id) {
          var p = st.paradigms[id];
          if (p && p.kind === 'established' && p.stock > 0) { p.stock *= (1 - extra); p.qualityStock *= (1 - extra); collapsed++; }
        });
        if (!st._collapseAnnounced) st._collapseAnnounced = {};
        if (!st._collapseAnnounced[top.p.id]) { st._collapseAnnounced[top.p.id] = turn; _eb('风气', '「' + top.p.label + '」蔚然成风，旧学正统日渐边缘，新进之士渐握事权'); }
      }
    }

    return { raised: raised, backlash: bs.backlash, unrest: bs.unrest, collapsed: collapsed };
  }

  TM.TalentBacklash = { tick: tick, TUNING: TUNING, _topEmergent: _topEmergent, _topEstablished: _topEstablished, version: '0.1.0-S5' };
  if (typeof module !== "undefined" && module.exports) module.exports = TM.TalentBacklash;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
