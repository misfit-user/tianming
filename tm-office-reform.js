/* tm-office-reform.js — 官制活化 Slice④ AI裁定式改制：抵抗分引擎(reform resistance)
 *
 * 灵魂：改制不免费即成·抵抗 ∝ 被夺权者的份量(品级×权力×忠诚)。机械算抵抗设地板(防 AI 放水鼓掌通过)，
 *   AI 在 band 约束下裁定 准/部分/拖/驳 + 演"谁怎么抵抗"。owner 拍：AI裁定+机械抵抗分护栏·拟制态两回合(④b)。
 * 代价=皇威(现成 capped 系统)。跨朝代：按抽象 power 与品级算，不认官署/官职专名。
 * band：margin = 抵抗 − authority(皇威皇权均) → <0 准 / <20 部分 / <40 拖 / ≥40 驳。
 * 状态：PoC·纯函数(authority/difficulty 由 opts 传入·④b 接真皇威与难度档)·未接线。
 */
(function (global) {
  'use strict';

  var POWER_KEYS = ['taxCollect', 'militaryCommand', 'appointment', 'impeach', 'supervise', 'yinBu', 'judicial', 'works', 'drafting'];
  var FORCE = {
    base: { add: 5, rename: 15, merge: 25, abolishPos: 35, abolishDept: 45, other: 20 },
    headHigh: 30, headMid: 15, perPower: 10,
    disloyalBelow: 40, disloyalAdd: 20, loyalAbove: 70, loyalSub: 10,
    mergeMul: 0.5,                                  // 合并比裁撤温和(职位转移非清退)
    difficultyMul: { narrative: 0.7, standard: 1.0, hardcore: 1.3 },
    passBelow: 0, partialBelow: 20, delayBelow: 40,
    costFactor: 0.12, costCap: 8
  };

  function _fn(n) { return (typeof global[n] === 'function') ? global[n] : null; }
  function _holderChar(GM, name) { if (!name) return null; var f = _fn('findCharByName'); if (f) return f(name); return (GM.chars || []).find(function (c) { return c && c.name === name; }) || null; }
  function _rankLvl(p) { var g = _fn('getRankLevel'); return g ? g(p.rank) : 99; }
  function _countPowers(p) { var n = 0, pw = p && p.powers; if (pw) POWER_KEYS.forEach(function (k) { if (pw[k]) n++; }); return n; }

  function _reformKind(reform) {
    var d = String((reform && reform.reformDetail) || (reform && reform.kind) || '');
    if (/增设|新设|增置|创设/.test(d)) return 'add';
    if (/裁撤|废除|罢省|省并|裁/.test(d)) return (reform && reform.position) ? 'abolishPos' : 'abolishDept';
    if (/改名|更名/.test(d)) return 'rename';
    if (/合并|并入/.test(d)) return 'merge';
    return 'other';
  }

  // 收集被夺权的在任官(裁撤/合并命中)
  function _affectedHolders(GM, reform, kind) {
    var out = [];
    if (!GM || !GM.officeTree) return out;
    function collectAll(nd) { (nd.positions || []).forEach(function (p) { if (p.holder) out.push({ dept: nd.name, p: p }); }); (nd.subs || []).forEach(collectAll); }
    (function walk(ns) {
      (ns || []).forEach(function (n) {
        if ((kind === 'abolishDept' || kind === 'merge') && n.name === reform.dept) collectAll(n);
        else if (kind === 'abolishPos' && n.name === reform.dept) (n.positions || []).forEach(function (p) { if (p.name === reform.position && p.holder) out.push({ dept: n.name, p: p }); });
        if (n.subs) walk(n.subs);
      });
    })(GM.officeTree);
    return out;
  }

  /**
   * @param {object} reform { reformDetail:'增设|裁撤|改名|合并', dept, position?, newDept? }
   * @param {object} [opts] { authority?:number=皇威皇权均, difficulty?:'narrative|standard|hardcore', force? }
   */
  function computeReformResistance(GM, reform, opts) {
    opts = opts || {}; var F = opts.force || FORCE;
    var authority = (opts.authority != null) ? opts.authority : 50;
    var kind = _reformKind(reform);
    var resistance = (F.base[kind] != null) ? F.base[kind] : F.base.other;
    var affected = [];
    if (kind === 'abolishPos' || kind === 'abolishDept' || kind === 'merge') {
      var mul = (kind === 'merge') ? F.mergeMul : 1;
      _affectedHolders(GM, reform, kind).forEach(function (it) {
        var p = it.p, ch = _holderChar(GM, p.holder), w = 0;
        var lvl = _rankLvl(p); if (lvl <= 3) w += F.headHigh; else if (lvl <= 6) w += F.headMid;
        w += _countPowers(p) * F.perPower;
        var loy = ch && ch.loyalty;
        if (loy != null && loy < F.disloyalBelow) w += F.disloyalAdd;
        else if (loy != null && loy > F.loyalAbove) w -= F.loyalSub;
        w = Math.round(w * mul);
        resistance += w;
        affected.push({ dept: it.dept, pos: p.name, holder: p.holder, weight: w });
      });
    }
    var diffMul = F.difficultyMul[opts.difficulty] || 1;
    resistance = Math.max(0, Math.round(resistance * diffMul));
    var margin = resistance - authority;
    var band = margin < F.passBelow ? '准' : margin < F.partialBelow ? '部分' : margin < F.delayBelow ? '拖' : '驳';
    var costHuangwei = Math.min(F.costCap, Math.round(resistance * F.costFactor));
    return {
      kind: kind, resistance: resistance, authority: authority, margin: margin, band: band,
      costHuangwei: costHuangwei, affected: affected,
      reason: '改制[' + kind + ']抵抗' + resistance + ' vs 威权' + authority + ' → ' + band + (affected.length ? '·触动' + affected.map(function (a) { return a.holder; }).join('、') : '')
    };
  }

  // ── 结构改树（裁定通过的改制走此落地·覆盖全部类型·绕开 tm-endturn-apply.js:3066 position 守卫对部门级的拦截）──
  function _vacateHolder(GM, dept, posName, holderName) {
    var find = _fn('findCharByName'); var ch = find ? find(holderName) : null;
    if (!ch) return;
    if (_fn('_offVacateCharFromSeat')) global._offVacateCharFromSeat(ch, dept, posName);
    else if (_fn('_offRemoveCharOfficeTitle')) global._offRemoveCharOfficeTitle(ch, posName);
    else { ch.officialTitle = ''; ch.title = ''; }
  }
  function _walkTree(ns, fn) { (ns || []).forEach(function (n) { fn(n); if (n.subs) _walkTree(n.subs, fn); }); }

  /**
   * 把一项改制落到 GM.officeTree（镜像 3340 的增设/裁撤/改名/合并·但全类型可达）。
   * @param {object} reform { reformDetail, dept, position?, newDept?, newRank?, reason? }
   * @returns {{applied:boolean, summary:string}}
   */
  function applyReformToTree(GM, reform) {
    if (!GM || !GM.officeTree) return { applied: false, summary: '无官制' };
    var kind = _reformKind(reform), tree = GM.officeTree, dept = reform.dept, pos = reform.position, newDept = reform.newDept;
    if (kind === 'add') {
      if (pos) {
        var added = false;
        _walkTree(tree, function (n) { if (n.name === dept) { if (!n.positions) n.positions = []; n.positions.push({ name: pos, rank: reform.newRank || '', holder: '', desc: reform.reason || '', headCount: 1, actualCount: 0, additionalHolders: [], establishedCount: 1, vacancyCount: 1, actualHolders: [] }); added = true; } });
        return { applied: added, summary: added ? (dept + '增设' + pos) : ('未找到部门' + dept) };
      }
      if (newDept) { var ok = false; _walkTree(tree, function (n) { if (n.name === dept) { if (!n.subs) n.subs = []; n.subs.push({ name: newDept, desc: reform.reason || '', positions: [], subs: [], functions: [] }); ok = true; } }); return { applied: ok, summary: ok ? (dept + '下增设' + newDept) : ('未找到部门' + dept) }; }
      tree.push({ name: dept || '新设部门', desc: reform.reason || '', positions: [], subs: [], functions: [] });
      return { applied: true, summary: '增设' + (dept || '新设部门') };
    }
    if (kind === 'abolishPos') {
      var removed = false;
      _walkTree(tree, function (n) { if (n.name === dept && n.positions) { n.positions.filter(function (p) { return p.name === pos && p.holder; }).forEach(function (p) { _vacateHolder(GM, dept, pos, p.holder); }); var before = n.positions.length; n.positions = n.positions.filter(function (p) { return p.name !== pos; }); if (n.positions.length < before) removed = true; } });
      return { applied: removed, summary: removed ? ('裁撤' + dept + pos) : ('未找到' + dept + pos) };
    }
    if (kind === 'abolishDept') {
      _walkTree(tree, function (n) { if (n.name === dept) (function collect(nd) { (nd.positions || []).forEach(function (p) { if (p.holder) _vacateHolder(GM, nd.name, p.name, p.holder); }); (nd.subs || []).forEach(collect); })(n); });
      GM.officeTree = tree.filter(function (d) { return d.name !== dept; });
      (function delSub(ns) { ns.forEach(function (n) { if (n.subs) { n.subs = n.subs.filter(function (s) { return s.name !== dept; }); delSub(n.subs); } }); })(GM.officeTree);
      return { applied: true, summary: '裁撤' + dept };
    }
    if (kind === 'rename') {
      var rn = false; _walkTree(tree, function (n) { if (n.name === dept && newDept) { n.name = newDept; rn = true; } });
      return { applied: rn, summary: rn ? (dept + '更名' + newDept) : ('未找到' + dept) };
    }
    if (kind === 'merge') {
      var src = null, dst = null; _walkTree(tree, function (n) { if (n.name === dept) src = n; if (n.name === newDept) dst = n; });
      if (src && dst && src !== dst) {
        if (!dst.positions) dst.positions = []; (src.positions || []).forEach(function (p) { dst.positions.push(p); });
        if (!dst.subs) dst.subs = []; (src.subs || []).forEach(function (s) { dst.subs.push(s); });
        GM.officeTree = tree.filter(function (d) { return d !== src; });
        (function delSub(ns) { ns.forEach(function (n) { if (n.subs) { n.subs = n.subs.filter(function (s) { return s !== src; }); delSub(n.subs); } }); })(GM.officeTree);
        return { applied: true, summary: dept + '并入' + newDept };
      }
      return { applied: false, summary: '合并未找到源/的部门' };
    }
    return { applied: false, summary: '未知改制类型·' + kind };
  }

  // ── 拟制态 queue + 裁定 pass（④b·两回合·机械护栏裁定·④b-2 再加 AI verdict 在 band 内/更严）──
  var DIFF_MAP = { narrative: 'narrative', standard: 'standard', hardcore: 'hardcore', '简单': 'narrative', '普通': 'standard', '中等': 'standard', '困难': 'hardcore', '地狱': 'hardcore' };
  function _authorityOf(GM) {
    var hw = (GM.huangwei && typeof GM.huangwei.index === 'number') ? GM.huangwei.index : 50;
    var hq = (GM.huangquan && typeof GM.huangquan.index === 'number') ? GM.huangquan.index : 50;
    return (hw + hq) / 2;
  }
  function _difficultyOf() { var P = global.P || {}; return DIFF_MAP[(P.conf && P.conf.difficulty) || ''] || 'standard'; }
  function _reformKey(oc) { return (oc.reformDetail || '') + '|' + (oc.dept || '') + '|' + (oc.position || '') + '|' + (oc.newDept || ''); }
  // AI verdict 护栏：机械 band 是地板·AI 只能更严(加阻)不能更宽(放水)。准0<部分1<拖2<驳3
  var _VRANK = { '准': 0, '部分': 1, '拖': 2, '驳': 3 };
  function _matchAiVerdict(list, item) {
    if (!Array.isArray(list)) return null;
    for (var i = 0; i < list.length; i++) { var v = list[i]; if (v && v.dept === item.dept && (v.position || '') === (item.position || '')) return v; }
    for (var j = 0; j < list.length; j++) { var v2 = list[j]; if (v2 && v2.dept === item.dept) return v2; }
    return null;
  }
  function _applyHuangweiCost(GM, cost) {
    cost = Math.round(cost || 0); if (!cost) return;
    // 2026-07-04 收口走写口(按源封顶+台账+phase 迁移)·改制代价记朝论反弹
    if (typeof AuthorityEngines !== 'undefined' && AuthorityEngines.adjustHuangwei) { AuthorityEngines.adjustHuangwei('memorialObjection', -cost, '改制之议·朝论汹汹'); return; }
    if (GM.huangwei && typeof GM.huangwei.index === 'number') GM.huangwei.index = Math.max(0, Math.min(100, GM.huangwei.index - cost)); // 沙箱回退
  }

  // 玩家改制诏入拟制态队列（去重·不即落）
  function enqueuePendingReform(GM, oc, turn) {
    if (!GM || !oc) return null;
    if (!Array.isArray(GM._pendingReforms)) GM._pendingReforms = [];
    var key = _reformKey(oc);
    if (GM._pendingReforms.some(function (r) { return r.status === '拟制中' && r._key === key; })) return null;
    var item = { _key: key, reformDetail: oc.reformDetail, dept: oc.dept, position: oc.position || '', newDept: oc.newDept || '', newRank: oc.newRank || '', reason: oc.reason || '', proposedTurn: (turn != null ? turn : (GM.turn || 0)), status: '拟制中', stalls: 0 };
    GM._pendingReforms.push(item);
    return item;
  }

  // 每回合：拟制满一回合(proposedTurn<turn)→机械护栏裁定·准/部分落树·拖留滞·驳消亡
  function adjudicatePendingReforms(GM, opts) {
    opts = opts || {};
    if (!GM || !Array.isArray(GM._pendingReforms) || !GM._pendingReforms.length) return [];
    var turn = (GM.turn != null) ? GM.turn : 0;
    var authority = (opts.authority != null) ? opts.authority : _authorityOf(GM);
    var difficulty = opts.difficulty || _difficultyOf();
    var addEB = (typeof global.addEB === 'function') ? global.addEB : null;
    var maxStalls = opts.maxStalls || 2;
    var results = [], keep = [];
    GM._pendingReforms.forEach(function (item) {
      if (item.status !== '拟制中') return;                         // 已决·丢弃
      if (item.proposedTurn >= turn) { keep.push(item); return; }   // 拟制未满一回合·留(两回合)
      var r = computeReformResistance(GM, item, { authority: authority, difficulty: difficulty });
      var band = r.band, aiNote = '';
      var av = opts.aiVerdicts ? _matchAiVerdict(opts.aiVerdicts, item) : null;
      if (av && _VRANK[av.verdict] != null) {
        if (_VRANK[av.verdict] > _VRANK[band]) { aiNote = '·廷议加阻(' + band + '→' + av.verdict + (av.reason ? '·' + String(av.reason).slice(0, 24) : '') + ')'; band = av.verdict; }   // AI 可更严
        else aiNote = '·廷议无异议';                                                                                                                                          // AI 更宽则被机械护栏吞(不放水)
      }
      var who = r.affected.map(function (a) { return a.holder; }).join('、');
      if (band === '准' || band === '部分') {
        var ap = applyReformToTree(GM, item); item.status = band;
        var cost = Math.round(r.costHuangwei * (band === '部分' ? 1.5 : 1));
        _applyHuangweiCost(GM, cost);
        if (addEB) addEB('官制改革', '改制' + (band === '准' ? '准行' : '勉强部分得行') + '·' + ap.summary + '（抵抗' + r.resistance + '·威权' + Math.round(authority) + '·耗皇威' + cost + (who ? '·' + who + (band === '部分' ? '力阻' : '终见裁') : '') + aiNote + '）');
        results.push({ item: item, band: band, applied: ap.applied, resistance: r.resistance });
      } else if (band === '拖') {
        item.stalls = (item.stalls || 0) + 1;
        if (item.stalls >= maxStalls) {
          item.status = '驳'; var c2 = Math.round(r.costHuangwei * 0.5); _applyHuangweiCost(GM, c2);
          if (addEB) addEB('官制改革', '改制久拖不行·' + item.dept + (item.position || '') + '之议遂寝（' + (who || '群僚') + '牵延·耗皇威' + c2 + aiNote + '）');
          results.push({ item: item, band: '驳', applied: false, resistance: r.resistance });
        } else {
          if (addEB) addEB('官制改革', '改制受阻·' + item.dept + (item.position || '') + '之议为' + (who || '群僚') + '牵延（拟制再延·抵抗' + r.resistance + aiNote + '）');
          keep.push(item); results.push({ item: item, band: '拖', applied: false, resistance: r.resistance });
        }
      } else { // 驳
        item.status = '驳'; var c3 = Math.round(r.costHuangwei * 0.5); _applyHuangweiCost(GM, c3);
        if (addEB) addEB('官制改革', '改制被驳·' + item.dept + (item.position || '') + '之议为' + (who || '廷臣') + '力沮而罢（抵抗' + r.resistance + '>威权' + Math.round(authority) + '·伤皇威' + c3 + aiNote + '）');
        results.push({ item: item, band: '驳', applied: false, resistance: r.resistance });
      }
    });
    GM._pendingReforms = keep;   // 保留拟制中(未满)+拖(未流产)·已决移除
    return results;
  }

  global.computeReformResistance = computeReformResistance;
  global.applyReformToTree = applyReformToTree;
  global.enqueuePendingReform = enqueuePendingReform;
  global.adjudicatePendingReforms = adjudicatePendingReforms;
  if (typeof module !== 'undefined' && module.exports) module.exports = { computeReformResistance: computeReformResistance, applyReformToTree: applyReformToTree, enqueuePendingReform: enqueuePendingReform, adjudicatePendingReforms: adjudicatePendingReforms, FORCE: FORCE };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
