/*
 * tm-world-digest.js — 本回合「天下牵动·因果综述」（W1a · 世界反应总线·可读性主攻）
 * ============================================================
 * 病根（调研实证）：推演 prompt 把各系统反应按【来源】平铺成互不关联的清单
 *   （PlayerActionSignals / SocialPoliticalSignals / ClassMinxin 各一块 + 跨回合报告
 *    又散在 prompt 另一处），AI 读到的是「割裂拼盘」，看不见 A 变了→B 反应 的因果链。
 * 本模块：把已有的反应数据（社政信号 + 跨系统联动 chronicle）按【因果域】重组成
 *   一块连贯的「天下牵动」综述，注入推演——让 AI 顺因果叙事，而非各表一摊。
 *
 * 纯读现有 GM 数据（_socialPoliticalSignals.items + _chronicle），只增不改、不碰管线时序、
 *   不触 Math.random（确定性）。是 W1 的基座与探针；W1b 归并跨回合报告、W1c 串因果链。
 *
 * 公开：window.WorldDigest（collect / promptBlock）
 * 依赖：GM（只读 _socialPoliticalSignals / _chronicle）。
 */
(function () {
  'use strict';

  function _gm() { return (typeof GM !== 'undefined' && GM) ? GM : null; }
  function _curTurn() { var g = _gm(); return (g && typeof g.turn === 'number') ? g.turn : 0; }
  function _compact(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  // sourceSystem（信号来源）→ 中文因果域。chronicle 的 type 本就是中文（军事↔势力…），直接用。
  var _DOMAIN_RULES = [
    { re: /huji|户籍|户口|population|人口/i, d: '户口' },
    { re: /minxin|民心|uprising|民变/i,      d: '民心' },
    { re: /corrupt|腐败|吏治/i,              d: '吏治' },
    { re: /fiscal|guoku|帑廪|财政|currency|货币/i, d: '财政' },
    { re: /authority|huangwei|huangquan|皇威|皇权|权臣/i, d: '皇权' },
    { re: /army|military|军|war|战|mutiny|兵变/i, d: '军事' },
    { re: /party|党/i,                       d: '党争' },
    { re: /class|阶层|绅|缙/i,               d: '阶层' },
    { re: /build|营造|风气|globalrule|实学/i, d: '风气' },
    { re: /tinyi|chaoyi|廷议|朝议|court|朝局/i, d: '朝局' },
    { re: /player|玩家|edict|诏|君/i,        d: '君上之政' }
  ];
  function _domainOf(src) {
    var s = String(src || '');
    for (var i = 0; i < _DOMAIN_RULES.length; i++) { if (_DOMAIN_RULES[i].re.test(s)) return _DOMAIN_RULES[i].d; }
    return '时局';
  }

  // ── 收集最近 turnsBack 回合内的「跨系统反应」→ 归一 {turn, domain, line, weight} ──
  function collect(GM, opts) {
    GM = GM || _gm(); if (!GM) return [];
    opts = opts || {};
    var back = (opts.turnsBack != null) ? opts.turnsBack : 1;
    var cur = _curTurn();
    var out = [];

    // 1) 跨系统联动 chronicle（军事↔势力 / 势力↔党派 等·tags 含「联动」或 type 含 ↔/→）——
    //    这是当前唯一明确标注「A→B 反应」的数据，却没有专属 prompt 块，前景化即纯新增价值。
    var chron = Array.isArray(GM._chronicle) ? GM._chronicle : [];
    for (var i = 0; i < chron.length; i++) {
      var e = chron[i];
      if (!e || e.turn == null || (cur - e.turn) > back) continue;
      var isLink = (Array.isArray(e.tags) && e.tags.indexOf('联动') >= 0) || (e.type && /[↔→]/.test(String(e.type)));
      if (!isLink) continue;
      out.push({ turn: e.turn, domain: String(e.type || '联动'), line: _compact(e.text, 140), weight: 3 });
    }

    // 2) 社政信号（按 |intensity| 取要者）→「因 → 牵动谁」行
    var sp = (GM._socialPoliticalSignals && Array.isArray(GM._socialPoliticalSignals.items)) ? GM._socialPoliticalSignals.items : [];
    var spRecent = [];
    for (var j = 0; j < sp.length; j++) {
      var s = sp[j];
      if (!s || s.turn == null || (cur - s.turn) > back) continue;
      spRecent.push(s);
    }
    spRecent.sort(function (a, b) { return Math.abs(b.intensity || 0) - Math.abs(a.intensity || 0); });
    var spLimit = (opts.spLimit != null) ? opts.spLimit : 8;
    for (var k = 0; k < spRecent.length && k < spLimit; k++) {
      var sig = spRecent[k];
      var who = []
        .concat((sig.affectedClasses || []).map(function (x) { return x && x.name; }))
        .concat((sig.affectedParties || []).map(function (x) { return x && x.name; }))
        .filter(Boolean);
      var whoStr = who.slice(0, 4).join('、');
      var effect = sig.reason ? _compact(sig.reason, 90) : String(sig.kind || '');   // 此信号本身（果）
      if (!effect && !whoStr) continue;
      // W1c·真因果链：信号带上游因（cause）则前置成「因 →致 果」，再「→ 牵动谁」，串成 A→B→C 而非孤立一果
      var head = sig.cause ? (_compact(sig.cause, 60) + ' →致 ' + effect) : effect;
      var line = head + (whoStr ? ' → 牵动 ' + whoStr : '');
      out.push({ turn: sig.turn, domain: _domainOf(sig.sourceSystem), line: line, weight: Math.min(2, 1 + Math.abs(sig.intensity || 0)) });
    }

    // 去重（同域同文）
    var seen = {}, dedup = [];
    for (var m = 0; m < out.length; m++) {
      var key = out[m].domain + '|' + out[m].line;
      if (seen[key]) continue;
      seen[key] = 1; dedup.push(out[m]);
    }
    return dedup;
  }

  // ── W1b·剧本状态耦合规则触发（_couplingReport·剧本 couplingRules 的「因→建议果」跨系统因果）──
  // 取其核心（剥去【状态联动参考】前缀与「以上仅为参考」尾注），折进综述，不再单独注入 sysP。
  function _couplingLine(GM) {
    var r = GM && GM._couplingReport;
    if (!r || typeof r !== 'string') return '';
    return r.replace(/^【[^】]*】/, '').replace(/。\s*以上仅为参考[\s\S]*$/, '').trim();
  }

  // ── 注入推演的「天下牵动·因果综述」块 ──
  function promptBlock(GM, opts) {
    GM = GM || _gm(); if (!GM) return '';
    opts = opts || {};
    var items = collect(GM, opts);
    var coupling = _couplingLine(GM);
    if (!items.length && !coupling) return '';
    var byDomain = {};
    items.forEach(function (it) { (byDomain[it.domain] = byDomain[it.domain] || []).push(it.line); });
    var perDomain = (opts.perDomain != null) ? opts.perDomain : 4;
    var s = '\n【本回合天下牵动·因果综述】（各系统如何彼此牵动；叙事时顺此因果脉络贯通，勿各表一摊）\n';
    Object.keys(byDomain).forEach(function (d) {
      s += '· [' + d + '] ' + byDomain[d].slice(0, perDomain).join('；') + '\n';
    });
    if (coupling) s += '· [时局联动] ' + coupling + '（仅供参考·实际幅度 AI 据局势定）\n';
    return s;
  }

  // ── W4·趋势预演（前瞻·"若不干预将如何牵动"·逆天改命主轴的轻量闭环）──
  // promptBlock 回望（上回合已牵动）；本块前瞻——扫当前各 metric「濒临阈值」态，把"君上本回合若不出手、
  //   势将如此牵动"的默认命运轨迹摆给 AI（与玩家），让玩家「逆之即改命」。**不翻管线时序**（仍只是 prompt
  //   前置的一块·读现有 GM 态/phase·确定性无 random），只在真·危机边缘触发，否则返空不污染。
  function _num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
  function previewBlock(GM, opts) {
    GM = GM || _gm(); if (!GM) return '';
    opts = opts || {};
    var warns = [];   // {sev, domain, line}

    // 1·阶层濒危（满意度低→离心/事变）
    var classes = Array.isArray(GM.classes) ? GM.classes : (Array.isArray(GM.socialClasses) ? GM.socialClasses : []);
    classes.forEach(function (c) {
      var sat = c && _num(c.satisfaction);
      if (sat != null && sat <= 22) warns.push({ sev: 100 - sat, domain: '阶层', line: (c.name || '某阶层') + ' 满意 ' + Math.round(sat) + '·已濒离心，再受激恐生事变' });
    });

    // 2·民心濒沸（trueIndex 低=不稳）
    var mx = GM.minxin && _num(GM.minxin.trueIndex);
    if (mx != null && mx <= 30) warns.push({ sev: 90 + (30 - mx), domain: '民心', line: '民心 ' + Math.round(mx) + '·已近沸点，若无安抚恐燃民变' });

    // 3·国库将竭（破产态/赤字下行）
    var gk = GM.guoku || {};
    if (gk.bankruptcy && gk.bankruptcy.active) warns.push({ sev: 96, domain: '财政', line: '帑廪已破产，再不开源节流，欠饷赈断、连锁难止' });
    else if (_num(gk.balance) != null && gk.balance < 0 && gk.trend === 'down') warns.push({ sev: 72, domain: '财政', line: '国库赤字且仍在下行，照此势恐旬月内告罄' });

    // 4·吏治痼疾（trueIndex 高=污浊）
    var corr = GM.corruption && _num(GM.corruption.trueIndex);
    if (corr != null && corr >= 72) warns.push({ sev: corr, domain: '吏治', line: '吏治污浊 ' + Math.round(corr) + '·已成蔓延之势，若不澄汰恐积重难返' });

    // 5·君威衰/权臣坐大
    var hw = GM.huangwei && _num(GM.huangwei.index);
    if (hw != null && hw <= 30) warns.push({ sev: 80 + (30 - hw), domain: '皇权', line: '君威 ' + Math.round(hw) + '·已衰，号令恐难行，权臣阴谋易乘隙' });
    var pm = GM.huangquan && GM.huangquan.powerMinister;
    var pmName = pm && (typeof pm === 'string' ? pm : pm.name);
    if (pmName) warns.push({ sev: 78, domain: '皇权', line: '权臣 ' + pmName + ' 坐大，若不制衡恐架空君权' });

    // 6·阴谋将发（ripe·与 aiContextBlock 互见·此处纳入统一威胁前瞻）
    var plots = Array.isArray(GM._activePlots) ? GM._activePlots.filter(function (p) { return p && p.stage === 'ripe'; }) : [];
    plots.slice(0, 2).forEach(function (p) { warns.push({ sev: 88, domain: '阴谋', line: (p.ringleader || '某人') + ' 之谋将发，若不查办，本回合恐酿大变' }); });

    if (!warns.length) return '';
    warns.sort(function (a, b) { return b.sev - a.sev; });
    var top = warns.slice(0, (opts.limit != null ? opts.limit : 4));
    var s = '\n【天下气运·若不干预之趋势】（按当前态势前瞻：君上本回合若不出手，势将如此牵动；逆之即「改命」。仅前瞻参考·实际由本回合作为与推演定）\n';
    top.forEach(function (w) { s += '· [' + w.domain + '] ' + w.line + '\n'; });
    return s;
  }

  var api = { collect: collect, promptBlock: promptBlock, previewBlock: previewBlock, _domainOf: _domainOf };
  if (typeof window !== 'undefined') window.WorldDigest = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
