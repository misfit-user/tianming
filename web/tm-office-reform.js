/* tm-office-reform.js — 官制活化 Slice④ AI裁定式改制：抵抗分引擎(reform resistance)
 *
 * 灵魂：改制不免费即成·抵抗 ∝ 被夺权者的份量(品级×权力×忠诚)。机械算抵抗设地板(防 AI 放水鼓掌通过)，
 *   AI 在 band 约束下裁定 准/部分/拖/驳 + 演"谁怎么抵抗"。owner 拍：AI裁定+机械抵抗分护栏·拟制态两回合(④b)。
 * 代价=皇威(现成 capped 系统)。跨朝代：按抽象 power 与品级算，不认官署/官职专名。
 * band：margin = 抵抗 − authority(皇威皇权均) → <0 准 / <20 部分 / <40 拖 / ≥40 驳。
 * 状态：已接线（computeReformResistance/applyReformToTree 走裁定管线·flag officeReformAdjudicationEnabled·并为典章 abolishFriction 具名祖制源）。注释此前误标「未接线」·已正。
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

  // ── 典章·祖制 office 源 key（Wave5 slice-2）──
  // add：改制**创建**的机构 key（增设职位=部/职·增设子部=子部名·增设部=部名）；其余：改制**针对**的现有机构 key。
  // 供 recordOfficeReform（记种子）与 abolishFriction（改具名祖制阻力）共用同一命名 → 首尾一致对得上。
  function _officeKey(reform) {
    if (!reform) return '';
    var d = reform.dept || '', p = reform.position || '', nd = reform.newDept || '';
    if (_reformKind(reform) === 'add') { if (p) return d + '/' + p; if (nd) return nd; return d; }
    return d + (p ? '/' + p : '');
  }
  function _recordDz(GM, key, name) { try { if (key && global.TM && global.TM.Dianzhang && global.TM.Dianzhang.recordOfficeReform) global.TM.Dianzhang.recordOfficeReform(GM, key, name); } catch (e) {} }
  function _abolishDz(GM, key) { try { if (key && global.TM && global.TM.Dianzhang && global.TM.Dianzhang.onInstitutionAbolished) global.TM.Dianzhang.onInstitutionAbolished(GM, key); } catch (e) {} }

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
    // 典章·祖制副作用（Wave5 双刃·副作用侧·王朝越僵）：典章越厚→朝野守成·改制普遍阻力↑（count-based·封顶+20）。
    // 见 tm-dianzhang.rigidityFriction。加在 diffMul 前→难度亦放大守成之惰（愈难之局朝廷愈守旧）。典章空则为 0·不改现有行为。
    var dzRigid = 0;
    try { if (global.TM && global.TM.Dianzhang && typeof global.TM.Dianzhang.rigidityFriction === 'function') dzRigid = global.TM.Dianzhang.rigidityFriction(GM) || 0; } catch (e) {}
    resistance += dzRigid;
    // 典章·成宪难改（Wave5 slice-2·具名祖制）：改「已成祖制的衙门本身」(裁撤/改名/合并)额外阻力(成宪愈久愈僵·封顶40)。
    // 见 tm-dianzhang.abolishFriction·key 同 recordOfficeReform 命名。add(增设新机构)不触发(非改现有祖制)。
    var dzAbolish = 0;
    if (kind !== 'add') {
      try { if (global.TM && global.TM.Dianzhang && typeof global.TM.Dianzhang.abolishFriction === 'function') dzAbolish = global.TM.Dianzhang.abolishFriction(GM, 'office', _officeKey(reform)) || 0; } catch (e) {}
    }
    resistance += dzAbolish;
    var diffMul = F.difficultyMul[opts.difficulty] || 1;
    resistance = Math.max(0, Math.round(resistance * diffMul));
    var margin = resistance - authority;
    var band = margin < F.passBelow ? '准' : margin < F.partialBelow ? '部分' : margin < F.delayBelow ? '拖' : '驳';
    var costHuangwei = Math.min(F.costCap, Math.round(resistance * F.costFactor));
    return {
      kind: kind, resistance: resistance, authority: authority, margin: margin, band: band,
      costHuangwei: costHuangwei, affected: affected, dianzhangRigidity: dzRigid, dianzhangAbolish: dzAbolish,
      reason: '改制[' + kind + ']抵抗' + resistance + ' vs 威权' + authority + ' → ' + band + (dzAbolish ? '·触祖制成宪(+' + dzAbolish + ')' : '') + (affected.length ? '·触动' + affected.map(function (a) { return a.holder; }).join('、') : '')
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
  function _treeHasName(tree, name) { var hit = false; _walkTree(tree, function (n) { if (n.name === name) hit = true; }); return hit; }

  // ── 章程落树三件套（设衙门批一·演绎层 tm-office-charter 拟的全结构·宪法侧只搬运不再产）──
  // 开办费国库真扣（镜像 GuokuEngine.Actions.openGranary 范式：balance 直扣+money.stock 同步·不足=false）
  function _spendGuoku(GM, amount, label) {
    amount = Math.max(0, Math.round(Number(amount) || 0));
    if (!amount) return true;
    try { if (typeof global.GuokuEngine !== 'undefined' && typeof global.GuokuEngine.ensureModel === 'function') global.GuokuEngine.ensureModel(); } catch (e) {}
    var g = GM.guoku;
    if (!g || (Number(g.balance) || 0) < amount) return false;
    g.balance -= amount;   // arch-ok 开办费国库真扣·镜像 GuokuEngine.Actions.openGranary 支出范式(与 tm-revolt-inference._spendSilver 同款裁定)
    try { if (g.ledgers && g.ledgers.money) g.ledgers.money.stock = g.balance; } catch (e) {}   // arch-ok 同上·账本 stock 同步
    try { if (typeof global.addEB === 'function') global.addEB('朝代', label + '·帑出 ' + amount + ' 两'); } catch (e) {}
    return true;
  }
  // 章程官职表→officeTree position 形状（双层编制模型两套字段齐给·与 _offMigratePosition 约定对齐）。
  // discounted=「部分」band 打折：职数减半(主官居首必留)·员额减半(至少1)。
  function _charterPositions(charter, discounted) {
    var list = charter.positions || [];
    if (discounted && list.length > 1) list = list.slice(0, Math.ceil(list.length / 2));
    return list.map(function (cp) {
      var cnt = discounted ? Math.max(1, Math.floor(cp.count / 2)) : cp.count;
      var pos = { name: cp.name, rank: cp.rank, holder: '', desc: cp.duties || '', headCount: cnt, actualCount: 0, additionalHolders: [], establishedCount: cnt, vacancyCount: cnt, actualHolders: [], salary: cp.salary, perPersonSalary: '月俸 ' + cp.salary + ' 石' };
      if (cp.duties) pos.duties = cp.duties;
      if (cp.powers && cp.powers.length) {
        var pw = {}; cp.powers.forEach(function (k) { pw[k] = true; });
        pos.powers = pw;
        if (cp.authority) pos.authority = cp.authority;
      }
      return pos;
    });
  }

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
        if (added) _recordDz(GM, dept + '/' + pos, dept + '·' + pos);   // 增设职位→典章种子
        return { applied: added, summary: added ? (dept + '增设' + pos) : ('未找到部门' + dept) };
      }
      // 衙门级增设：有章程(演绎层已拟)→按章落全结构；无章程→裸壳(双轨零回归)
      var _ch = reform._charter || null;
      var _disc = !!(reform._charterDiscount && _ch);
      var _chPoss = _ch ? _charterPositions(_ch, _disc) : [];
      if (_ch) reform._charterLanded = _chPoss.map(function (p) { return p.name; });   // 荐单按实落职位过滤(部分band砍掉的职不荐)
      if (newDept) {
        var _lnS = newDept;
        if (_ch && _ch.name && _ch.name !== newDept && !_treeHasName(tree, _ch.name)) { _lnS = _ch.name; reform.newDept = _lnS; }   // 正名落定(重名回退玩家原名)
        var ok = false;
        _walkTree(tree, function (n) { if (n.name === dept) { if (!n.subs) n.subs = []; n.subs.push({ name: _lnS, desc: (_ch && _ch.desc) || reform.reason || '', positions: _chPoss, subs: [], functions: [] }); ok = true; } });
        if (ok) _recordDz(GM, _lnS, _lnS);
        return { applied: ok, summary: ok ? (dept + '下增设' + _lnS + (_ch ? ('·章程' + _chPoss.length + '职' + (_disc ? '(部分得行·打折开衙)' : '')) : '')) : ('未找到部门' + dept) };
      }
      var _lnT = dept || '新设部门';
      if (_ch && _ch.name && _ch.name !== _lnT && !_treeHasName(tree, _ch.name)) { _lnT = _ch.name; reform.dept = _lnT; }   // 正名落定
      tree.push({ name: _lnT, desc: (_ch && _ch.desc) || reform.reason || '', positions: _chPoss, subs: [], functions: [] });
      _recordDz(GM, _lnT, _lnT);   // 增设部门→典章种子
      return { applied: true, summary: '增设' + _lnT + (_ch ? ('·章程' + _chPoss.length + '职' + (_disc ? '(部分得行·打折开衙)' : '')) : '') };
    }
    if (kind === 'abolishPos') {
      var removed = false;
      _walkTree(tree, function (n) { if (n.name === dept && n.positions) { n.positions.filter(function (p) { return p.name === pos && p.holder; }).forEach(function (p) { _vacateHolder(GM, dept, pos, p.holder); }); var before = n.positions.length; n.positions = n.positions.filter(function (p) { return p.name !== pos; }); if (n.positions.length < before) removed = true; } });
      if (removed) _abolishDz(GM, dept + '/' + pos);   // 裁撤职位→清种子+祖制
      return { applied: removed, summary: removed ? ('裁撤' + dept + pos) : ('未找到' + dept + pos) };
    }
    if (kind === 'abolishDept') {
      _walkTree(tree, function (n) { if (n.name === dept) (function collect(nd) { (nd.positions || []).forEach(function (p) { if (p.holder) _vacateHolder(GM, nd.name, p.name, p.holder); }); (nd.subs || []).forEach(collect); })(n); });
      GM.officeTree = tree.filter(function (d) { return d.name !== dept; });
      (function delSub(ns) { ns.forEach(function (n) { if (n.subs) { n.subs = n.subs.filter(function (s) { return s.name !== dept; }); delSub(n.subs); } }); })(GM.officeTree);
      _abolishDz(GM, dept);   // 裁撤部门→清种子+祖制
      return { applied: true, summary: '裁撤' + dept };
    }
    if (kind === 'rename') {
      var rn = false; _walkTree(tree, function (n) { if (n.name === dept && newDept) { n.name = newDept; rn = true; } });
      if (rn) _abolishDz(GM, dept);   // 更名=改这条祖制本身·旧名机构之成宪消亡（新名须另历时间方成祖制）
      return { applied: rn, summary: rn ? (dept + '更名' + newDept) : ('未找到' + dept) };
    }
    if (kind === 'merge') {
      var src = null, dst = null; _walkTree(tree, function (n) { if (n.name === dept) src = n; if (n.name === newDept) dst = n; });
      if (src && dst && src !== dst) {
        if (!dst.positions) dst.positions = []; (src.positions || []).forEach(function (p) { dst.positions.push(p); });
        if (!dst.subs) dst.subs = []; (src.subs || []).forEach(function (s) { dst.subs.push(s); });
        GM.officeTree = tree.filter(function (d) { return d !== src; });
        (function delSub(ns) { ns.forEach(function (n) { if (n.subs) { n.subs = n.subs.filter(function (s) { return s !== src; }); delSub(n.subs); } }); })(GM.officeTree);
        _abolishDz(GM, dept);   // 源部并入他部→源部之成宪消亡
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
      // 章程开办费国库闸(设衙门批一)：裁定虽准·帑廪不支→按拖处置(有司执奏·拖满则寝)·树不动银不扣
      if ((band === '准' || band === '部分') && item._charter && item._charter.setupCost && !_spendGuoku(GM, item._charter.setupCost, '开衙·' + (item._charter.name || item.dept))) {
        item.stalls = (item.stalls || 0) + 1;
        if (item.stalls >= maxStalls) {
          item.status = '驳'; var cGk = Math.round(r.costHuangwei * 0.5); _applyHuangweiCost(GM, cGk);
          if (addEB) addEB('官制改革', '开衙之议因帑廪不支而寝·' + item.dept + '（开办约需' + item._charter.setupCost + '两·有司执奏·耗皇威' + cGk + '）');
          results.push({ item: item, band: '驳', applied: false, resistance: r.resistance, guokuShort: true });
        } else {
          if (addEB) addEB('官制改革', '开衙之议因帑廪不支而缓·' + item.dept + '（开办约需' + item._charter.setupCost + '两·有司执奏·俟府库稍充）');
          keep.push(item); results.push({ item: item, band: '拖', applied: false, resistance: r.resistance, guokuShort: true });
        }
        return;
      }
      if (band === '准' || band === '部分') {
        if (band === '部分' && item._charter) item._charterDiscount = true;   // 章程打折开衙(职减半·员额减半)
        var ap = applyReformToTree(GM, item); item.status = band;
        var cost = Math.round(r.costHuangwei * (band === '部分' ? 1.5 : 1));
        _applyHuangweiCost(GM, cost);
        if (addEB) addEB('官制改革', '改制' + (band === '准' ? '准行' : '勉强部分得行') + '·' + ap.summary + '（抵抗' + r.resistance + '·威权' + Math.round(authority) + '·耗皇威' + cost + (who ? '·' + who + (band === '部分' ? '力阻' : '终见裁') : '') + aiNote + '）');
        // 章程首任荐单→诏书建议库(玩家下旨才任命·守五渠道·部分band砍掉的职不荐)
        if (ap.applied && item._charter && Array.isArray(item._charter.heads) && item._charter.heads.length) {
          var _landed = item._charterLanded || [];
          var _pushed = [];
          if (!Array.isArray(GM._edictSuggestions)) GM._edictSuggestions = [];   // arch-ok 章程荐单入建议库·玩家操作仍走五渠道
          item._charter.heads.forEach(function (h) {
            if (_landed.length && _landed.indexOf(h.position) < 0) return;       // 部分band砍掉的职不荐
            GM._edictSuggestions.push({ source: '章程', from: '铨曹', content: '授' + h.name + '为' + (item.dept || '') + h.position + (h.reason ? '（' + h.reason + '）' : ''), turn: GM.turn, used: false });   // arch-ok 同上·荐单只荐不任
            _pushed.push(h.name);
          });
          if (addEB && _pushed.length) addEB('官制改革', '«' + (item.dept || '') + '»开衙·铨曹以章程所荐首任入诏书建议库（' + _pushed.join('、') + '）——下旨方成任命');
        }
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
  global._offCharterPositions = _charterPositions;   // 批四·旧账迁树充实职官表复用同一转换(章程→position 形状)
  global.enqueuePendingReform = enqueuePendingReform;
  global.adjudicatePendingReforms = adjudicatePendingReforms;
  if (typeof module !== 'undefined' && module.exports) module.exports = { computeReformResistance: computeReformResistance, applyReformToTree: applyReformToTree, enqueuePendingReform: enqueuePendingReform, adjudicatePendingReforms: adjudicatePendingReforms, FORCE: FORCE };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
