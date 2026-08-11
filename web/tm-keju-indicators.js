// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-keju-indicators.js — Stage 2·Phase J·Slice J1·科举三指针 F1/F2/F3 (确定性公式)
 *
 * 职责·把"科举健康度"派生为 3 个确定性指标·写 P.keju.indicators·
 *      供 K1 UI 双显 (科举弹窗 3 印石 + 民心面板 3 行) + J2 event 反馈循环消费。
 *      **不进 GM.vars 顶栏** (计划 §J1 / §K1 约束)·纯派生只读量。
 *
 * 三指标 (计划 §J1·全用中立量·零朝代专名)·
 *   F1·科举向心力  = 备考池 / 总士人池 ×500 + 私学冲击(H2)          ·clamp[0,100]
 *   F2·新血流动度  = 近 9 年新进士 / 总官员 ×400                    ·clamp[0,100]
 *   F3·公平广度    = (0.6×偏远进士占比 + 0.4×解额公平 + 0.2×门生网络多样) ×100 ·clamp[0,100]
 *
 * 分层设计·
 *   §1 三公式 = 纯函数·仅依 signals·零 IO·零朝代专名·可单测 (smoke 断言)
 *   §2 门生网络多样性 = 从 GM._discipleGraph 真接线 (1 - HHI)
 *   §3 signal 采集 = best-effort 读 GM/P·优先级 ctx > P.keju._indicatorSignals > reader > default
 *   §4 _kjUpdateIndicators = 采集→计算→写 P.keju.indicators (+ sparkline history)
 *
 * 暴露·_kjUpdateIndicators / _kjCalcF1 / _kjCalcF2 / _kjCalcF3
 *      _kjGatherIndicatorSignals / _kjIndicatorNetworkDiversity
 *      TM.Keju.Indicators.*
 *
 * red line·
 *   - 零朝代专名 (东厂/司礼监/内阁 等绝不入本文件)·degree/官衔正则仅用 keju 通用词
 *   - 不进 GM.vars 顶栏·只写 P.keju.indicators (keju 子系统自有 namespace)
 *   - 公式确定性·同输入同输出·无 Math.random·无 LLM
 *   - endTurn 挂钩 (_kjUpdateIndicators) 由《集成清单》登记·本文件不改管道
 *
 * reader 口径 (2026-07 真仓核实·已接真实数据模型·仍 fallback 安全值)·
 *   - 总官员·_cc3_isCourtOfficial (tm-chaoyi-changchao-adapter.js·运行时权威 global)·✅ 已坐实
 *   - 备考池 / 总士人池·真源 ch.resources.gongming (tm-gongming.js 功名系统·path/tier)·✅ 已坐实 (title 正则兜底)
 *   - 近9年新进士·真源 ch._cohortYear (登科年·recruit 恒写·runtime-keyi L1654/1803) + gongming/特科判定·✅ 已坐实 (history 兜底)
 *   - 解额公平度·真源 division.economyBase.kejuQuota (GM.adminHierarchy.player·同 paradigm _kjpGeoQuotaFromDivisions)·⚠ partial·
 *       该 helper 为 paradigm.js module-local 未 global 暴露 (实查 §11 无导出)·此处直读 adminHierarchy 算区划均匀度·
 *       南/北/中 地理分桶严格口径待 helper 暴露后接线
 *   - 偏远进士占比·真籍贯字段 ch.origin 已定·但 "偏远" 分类口径未定 (缺 region 远近表·跨剧本地名违零专名律)·⚠ 仍 provisional 0
 *   剧本/其它 slice 可注入 P.keju._indicatorSignals 精确量以跳过 reader (采集优先级见 §3)
 *
 * Schema·见 web/docs/keju-stage2-plan.md §J1 (约 :183)
 */
(function(global) {
  'use strict';

  // ════════════════════════════════════════════════════════════════
  // §0·数值 helper
  // ════════════════════════════════════════════════════════════════
  function _num(v, dflt) { v = Number(v); return isFinite(v) ? v : dflt; }
  function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function _round1(v) { return Math.round(v * 10) / 10; }
  function _ratio01(v) { return _clamp(_num(v, 0), 0, 1); }

  function _readGM() { try { return (typeof GM !== 'undefined' && GM) ? GM : null; } catch (_) { return null; } }
  function _readP()  { try { return (typeof P  !== 'undefined' && P)  ? P  : null; } catch (_) { return null; } }
  function _finiteYear(value) {
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return null;
    var n = Number(value);
    return isFinite(n) ? n : null;
  }
  function _readCurrentYear() {
    var G = _readGM();
    var Pp = _readP();
    try {
      if (Pp && Pp.time && global && typeof global.calcDateFromTurn === 'function') {
        var di = global.calcDateFromTurn((G && G.turn) || 1);
        var derivedYear = di && _finiteYear(di.adYear);
        if (derivedYear !== null) return derivedYear;
      }
    } catch (_) {}
    var legacyYear = G && _finiteYear(G.year);
    if (legacyYear !== null) return legacyYear;
    var configuredYear = Pp && Pp.time && _finiteYear(Pp.time.year);
    return configuredYear !== null ? configuredYear : 0;
  }

  // ════════════════════════════════════════════════════════════════
  // §1·三公式·纯函数 (仅依 signals·零朝代专名·零 IO)
  // ════════════════════════════════════════════════════════════════

  /**
   * F1·科举向心力 = 备考池 / 总士人池 ×500 + 私学冲击(H2)·clamp[0,100]
   * @param {object} sig - { prepPool, scholarPool, schoolImpact }
   */
  function _kjCalcF1(sig) {
    sig = sig || {};
    var prep = Math.max(0, _num(sig.prepPool, 0));
    var pool = Math.max(1, _num(sig.scholarPool, 0));    // div-guard·避免 /0 → Inf/NaN
    var schoolImpact = _num(sig.schoolImpact, 0);        // Slice H2·未建时 0
    var raw = (prep / pool) * 500 + schoolImpact;
    return _round1(_clamp(raw, 0, 100));
  }

  /**
   * F2·新血流动度 = 近 9 年新进士 / 总官员 ×400·clamp[0,100]
   * @param {object} sig - { newJinshi9y, totalOfficials }
   */
  function _kjCalcF2(sig) {
    sig = sig || {};
    var recent = Math.max(0, _num(sig.newJinshi9y, 0));
    var officials = Math.max(1, _num(sig.totalOfficials, 0));   // div-guard
    var raw = (recent / officials) * 400;
    return _round1(_clamp(raw, 0, 100));
  }

  /**
   * F3·公平广度 = (0.6×偏远进士占比 + 0.4×解额公平 + 0.2×门生网络多样) ×100·clamp[0,100]
   * 三子量均 ∈[0,1]·权重和 1.2 (依计划 §J1 原系数)·clamp 收溢出
   * @param {object} sig - { remoteJinshiRatio, quotaFairness, networkDiversity }
   */
  function _kjCalcF3(sig) {
    sig = sig || {};
    var remote  = _ratio01(sig.remoteJinshiRatio);
    var fair    = _ratio01(sig.quotaFairness);
    var diverse = _ratio01(sig.networkDiversity);
    var raw = (0.6 * remote + 0.4 * fair + 0.2 * diverse) * 100;
    return _round1(_clamp(raw, 0, 100));
  }

  // ════════════════════════════════════════════════════════════════
  // §2·门生网络多样性·从 GM._discipleGraph.byMentor 算 (1 - HHI)·真接线
  //    单一 mentor 独占 → 0·均匀分散多 mentor → →1
  // ════════════════════════════════════════════════════════════════
  function _kjIndicatorNetworkDiversity() {
    var G = _readGM();
    if (!G || !G._discipleGraph || !G._discipleGraph.byMentor) return 0;
    var byMentor = G._discipleGraph.byMentor;
    var counts = [];
    var total = 0;
    Object.keys(byMentor).forEach(function(m) {
      var rec = byMentor[m];
      var n = (rec && Array.isArray(rec.disciples)) ? rec.disciples.length : 0;
      if (n > 0) { counts.push(n); total += n; }
    });
    if (total <= 0 || counts.length <= 1) return 0;   // 0/1 个有效 mentor·无多样性
    // HHI = Σ share^2·diversity = 1 - HHI (∈[0,1))
    var hhi = 0;
    for (var i = 0; i < counts.length; i++) {
      var s = counts[i] / total;
      hhi += s * s;
    }
    return _clamp(1 - hhi, 0, 1);
  }

  // ════════════════════════════════════════════════════════════════
  // §3·signal 采集·优先级 ctx > P.keju._indicatorSignals > reader > default
  // ════════════════════════════════════════════════════════════════

  function _pick(ctx, sigOverride, field, reader, dflt) {
    if (ctx && isFinite(Number(ctx[field]))) return Number(ctx[field]);
    if (sigOverride && isFinite(Number(sigOverride[field]))) return Number(sigOverride[field]);
    try { var r = reader ? reader() : undefined; if (isFinite(Number(r))) return Number(r); } catch (_) {}
    return dflt;
  }

  // 中立 degree/官衔正则·keju 通用词 (跨朝代·零朝代专名)·对齐 tm-gongming.js TIER_KEYWORDS
  //   备考层 = 生员/秀才/举人/贡生/监生 等 sub-进士 civil 功名·进士层 = 进士 + 一甲荣衔 (状元/榜眼/探花/传胪)
  var _RE_PREP_TITLE   = /举人|贡生|贡士|岁贡|拔贡|恩贡|副贡|优贡|监生|太学|生员|秀才|庠生|廪生|增生|附生|诸生|孝廉/;
  var _RE_JINSHI_TITLE = /进士|状元|榜眼|探花|传胪/;
  var _RE_PURE_DEGREE  = /(进士|状元|榜眼|探花|传胪|举人|贡生|贡士|监生|生员|秀才|庠生|廪生|增生|附生|诸生|童生|布衣|平民|草民|庶人)$/;

  function _titleOf(c) { return String((c && (c.officialTitle || c.title || c._degree || '')) || ''); }

  // 真源·结构化出身 (tm-gongming.js·ch.resources.gongming)·只读·不触发 ensureGongming 的 memo 写·
  //   缺失时退纯函数 TMGongming.parseLearning(learning)·再退 null (交 title 正则代理)
  function _gongmingOf(c) {
    if (!c) return null;
    if (c.resources && c.resources.gongming && typeof c.resources.gongming === 'object') return c.resources.gongming;
    try {
      if (typeof TMGongming !== 'undefined' && TMGongming && typeof TMGongming.parseLearning === 'function') {
        var g = TMGongming.parseLearning(c.learning);
        if (g && (g.path || g.tier)) return g;
      }
    } catch (_) {}
    return null;
  }
  // 备考层·civil 科举功名 (path=keju·tier 非进士)·真源优先·title 正则兜底
  function _isPrepDegree(c) {
    var g = _gongmingOf(c);
    if (g && g.path) return g.path === 'keju' && !!g.tier && g.tier !== '进士';
    var t = _titleOf(c); return _RE_PREP_TITLE.test(t) && !_RE_JINSHI_TITLE.test(t);
  }
  // 士人层·任一 civil 科举功名 (备考 ∪ 进士)·真源优先·title 正则兜底
  function _isCivilScholar(c) {
    var g = _gongmingOf(c);
    if (g && g.path) return g.path === 'keju' && !!g.tier;
    var t = _titleOf(c); return _RE_PREP_TITLE.test(t) || _RE_JINSHI_TITLE.test(t);
  }
  // 进士 (含特科进士 + 武进士 + 一甲荣衔)·真源 gongming.tier / ch._specialExamType 优先·title 兜底
  function _isJinshi(c) {
    var g = _gongmingOf(c);
    if (g) {
      if (g.tier === '进士' || g.tier === '武进士') return true;
      if (Array.isArray(g.honors) && _RE_JINSHI_TITLE.test(g.honors.join(''))) return true;
    }
    if (c && c._specialExamType != null) return true;   // 恩科/武举/童子/翻译等特科进士 (真字段)
    return _RE_JINSHI_TITLE.test(_titleOf(c));
  }
  // 在朝官员·复用运行时权威 _cc3_isCourtOfficial (tm-chaoyi-changchao-adapter.js·global fn)
  function _isCourtOfficial(c) {
    if (typeof _cc3_isCourtOfficial === 'function') { try { return !!_cc3_isCourtOfficial(c); } catch (_) {} }
    // fallback (无 adapter·如 node)·有官衔且非纯功名/在野 (通用词·零朝代专名)
    var t = String((c && (c.officialTitle != null ? c.officialTitle : (c.title || ''))) || '');
    return !!t && !_RE_PURE_DEGREE.test(t);
  }

  function _countChars(pred) {
    var G = _readGM();
    if (!G || !Array.isArray(G.chars)) return null;   // 无 chars → null·交回 default
    var n = 0;
    for (var i = 0; i < G.chars.length; i++) {
      var c = G.chars[i];
      if (!c || c.alive === false) continue;
      if (pred(c)) n++;
    }
    return n;
  }

  // 均匀度 ∈[0,1]·全均分→1·全集中→0·广义化原 南/北/中 三桶 MAD (n 桶·系数 n/(n-1)·n=3→×1.5)·零地名
  function _quotaEvenness(vals) {
    if (!Array.isArray(vals)) return null;
    var n = vals.length, sum = 0, i;
    for (i = 0; i < n; i++) sum += Math.max(0, _num(vals[i], 0));
    if (n <= 1 || sum <= 0) return null;
    var mean = sum / n, dev = 0;
    for (i = 0; i < n; i++) dev += Math.abs(Math.max(0, _num(vals[i], 0)) - mean);
    var mad = dev / (2 * sum);            // ∈[0,(n-1)/n]
    return _clamp(1 - mad * (n / (n - 1)), 0, 1);
  }

  // ── reader·真源已坐实者去 provisional·未定者保 provisional + 注明候选字段 ──

  // 备考池·活人 sub-进士 civil 功名 且未入仕·真源 ch.resources.gongming (tm-gongming.js)
  function _readPrepPool() {
    var Pp = _readP();
    if (Pp && Pp.keju && isFinite(Number(Pp.keju.prepPool)))      return Number(Pp.keju.prepPool);
    if (Pp && Pp.keju && isFinite(Number(Pp.keju.candidatePool))) return Number(Pp.keju.candidatePool);
    return _countChars(function(c) { return _isPrepDegree(c) && !_isCourtOfficial(c); });
  }
  // 总士人池·活人任一 civil 科举功名 (备考 ∪ 进士·含已仕)·真源同上
  function _readScholarPool() {
    var Pp = _readP();
    if (Pp && Pp.keju && isFinite(Number(Pp.keju.scholarPool))) return Number(Pp.keju.scholarPool);
    return _countChars(_isCivilScholar);
  }
  // 总官员·真源 _cc3_isCourtOfficial (运行时权威·已坐实)·denominator 含文武 (与 F2 numerator 特科口径一致)
  function _readTotalOfficials() {
    return _countChars(_isCourtOfficial);
  }
  // 近 9 年新进士·真字段 ch._cohortYear (登科年·recruit 恒写) + 进士判定·char 优先·history 兜底
  function _readNewJinshi9y() {
    var curYear = _readCurrentYear();
    var cutoff = curYear - 9;
    var byChars = _countChars(function(c) {
      if (!_isJinshi(c)) return false;
      var cy = Number(c._cohortYear);          // 真字段·登科年
      if (!isFinite(cy)) return false;         // 无登科年·不能判新旧·保守不计 (F2=新血·宁缺毋滥)
      return !isFinite(curYear) || cy >= cutoff;
    });
    if (byChars != null) return byChars;
    // 兜底 (无 GM.chars 时)·P.keju.history·schema 跨 finishKeju({date,dianshiCount}) / _kejuArchiveExam({date,results}) 不一·
    //   date = exam.startDate = {year,month,day} (tm-keju-runtime L347)·gradPool 仅老 v5 exam 层
    var Pp = _readP();
    if (Pp && Pp.keju && Array.isArray(Pp.keju.history)) {
      var n = 0;
      Pp.keju.history.forEach(function(h) {
        if (!h) return;
        var hd = h.date;   // = exam.startDate·{year,month,day} 或老档裸 number
        var hy = Number((hd && typeof hd === 'object') ? hd.year : (hd != null ? hd : h.year));
        if (isFinite(curYear) && isFinite(hy) && hy < cutoff) return;   // 已知年且超窗·跳
        var arr = h.gradPool || h.results || h.dianshiResults;
        if (Array.isArray(arr)) n += arr.length;
        else n += _num(h.dianshiCount, _num(h.passedCount, 0));
      });
      return n;
    }
    return 0;
  }
  // 偏远进士占比·真籍贯字段 ch.origin 已定 (recruit: origin=candidate.origin·runtime-keyi L1631)·
  //   仍 provisional·"偏远/边远" 分类口径未定·候选两路皆未坐实·
  //     (a) 场景级 region 远近表·全仓未见 (grep 无 isRemote/regionTier/frontier-on-char)
  //     (b) ch.origin 串匹配 GM.adminHierarchy 边镇 division·但 origin 为自由串·legacy char 多缺 (仅 recruit/部分剧本填)
  //   且跨剧本地名不通用·place-name 正则违 "零朝代/地名专名" 跨朝代律·故留 provisional·
  //   → 由剧本/其它 slice 经 P.keju._indicatorSignals.remoteJinshiRatio 或 ctx 注入精确量 (采集优先级见 §3)
  function _readRemoteRatio() {
    return 0;   // NEEDS REAL-REPO VERIFY·籍贯字段 ch.origin 已定·remoteness 分类口径待真仓核
  }
  // 解额公平度·真源 division.economyBase.kejuQuota (GM.adminHierarchy.player·同 paradigm _kjpGeoQuotaFromDivisions 数据源)·
  //   该 helper 为 paradigm.js module-local 未 global 暴露 (实查 §11)·此处直读 adminHierarchy 算跨区划均匀度 (零地名·跨朝代安全)·
  //   注·paradigm 原口径按 南/北/中 地理分桶 (place-name)·此为区划无关均匀度代理·严格南北榜公平待 helper 暴露后接线
  function _readQuotaFairness() {
    // 路1·helper 若被暴露 (现未)·用其 南/北/中 三桶
    try {
      if (typeof _kjpGeoQuotaFromDivisions === 'function') {
        var q = _kjpGeoQuotaFromDivisions();
        if (q) { var f = _quotaEvenness([_num(q['南'], 0), _num(q['北'], 0), _num(q['中'], 0)]); if (f != null) return f; }
      }
    } catch (_) {}
    // 路2·真源·遍历 adminHierarchy.player 各顶层区划·累加叶 economyBase.kejuQuota (镜像 paradigm walk)
    try {
      var G = _readGM();
      var ahp = G && G.adminHierarchy && G.adminHierarchy.player;
      if (ahp && Array.isArray(ahp.divisions) && ahp.divisions.length) {
        var perTop = [];
        ahp.divisions.forEach(function(top) {
          var sum = 0;
          (function walk(d) {
            if (!d) return;
            var kids = d.children || d.divisions;
            if (kids && kids.length) { kids.forEach(walk); return; }
            var qv = Number(d.economyBase && d.economyBase.kejuQuota);
            if (isFinite(qv) && qv > 0) sum += qv;
          })(top);
          perTop.push(sum);
        });
        var f2 = _quotaEvenness(perTop);
        if (f2 != null) return f2;
      }
    } catch (_) {}
    return 0.5;   // 无解额数据·中性
  }
  function _readSchoolImpact() {
    // Slice H2 未建·默认 0·H2 完成后由私学网络派生 (GM._schoolNetwork)
    return 0;
  }

  /**
   * 采集全部 signals·返 normalized 对象 (供三公式)
   * @param {object} ctx - 可选·显式覆盖任意 signal 字段 (endTurn ctx / 测试用)
   */
  function _kjGatherIndicatorSignals(ctx) {
    ctx = ctx || {};
    var Pp = _readP();
    var sigOverride = (Pp && Pp.keju && Pp.keju._indicatorSignals) || null;   // 剧本/其它 slice 精确注入口
    return {
      prepPool:          _pick(ctx, sigOverride, 'prepPool',          _readPrepPool,                 0),
      scholarPool:       _pick(ctx, sigOverride, 'scholarPool',       _readScholarPool,              0),
      newJinshi9y:       _pick(ctx, sigOverride, 'newJinshi9y',       _readNewJinshi9y,              0),
      totalOfficials:    _pick(ctx, sigOverride, 'totalOfficials',    _readTotalOfficials,           0),
      remoteJinshiRatio: _pick(ctx, sigOverride, 'remoteJinshiRatio', _readRemoteRatio,              0),
      quotaFairness:     _pick(ctx, sigOverride, 'quotaFairness',     _readQuotaFairness,            0.5),
      networkDiversity:  _pick(ctx, sigOverride, 'networkDiversity',  _kjIndicatorNetworkDiversity,  0),
      schoolImpact:      _pick(ctx, sigOverride, 'schoolImpact',      _readSchoolImpact,             0)
    };
  }

  // ════════════════════════════════════════════════════════════════
  // §4·主入口·_kjUpdateIndicators·采集→计算→写 P.keju.indicators
  //    endTurn 每回合调 (挂钩见《集成清单》)·keju 未启用则安全 no-op
  // ════════════════════════════════════════════════════════════════
  function _kjUpdateIndicators(ctx) {
    ctx = ctx || {};
    var Pp = _readP();
    if (!Pp || !Pp.keju || !Pp.keju.enabled) return null;   // keju 未启用·跳过

    var sig = _kjGatherIndicatorSignals(ctx);
    var F1 = _kjCalcF1(sig), F2 = _kjCalcF2(sig), F3 = _kjCalcF3(sig);

    var explicitYear = ctx && _finiteYear(ctx.year);
    var year = explicitYear !== null ? explicitYear
             : _readCurrentYear();

    // 写 keju 子系统自有 namespace·不进 GM.vars 顶栏 (计划 §J1/§K1)·
    // 派生只读量·同现有 keju 直写惯例 (activation 写 P.keju.*·paradigm 写 GM._kejuParadigm·无 mutator)
    var ind = Pp.keju.indicators || {};
    ind.F1 = F1; ind.F2 = F2; ind.F3 = F3;
    ind._year = year;
    ind._signals = sig;   // 调试 / UI 提示用

    // sparkline 历史·环形·最多 24 点·同年覆盖·异年追加
    if (!Array.isArray(ind.history)) ind.history = [];
    var last = ind.history[ind.history.length - 1];
    if (!last || last.year !== year) {
      ind.history.push({ year: year, F1: F1, F2: F2, F3: F3 });
      if (ind.history.length > 24) ind.history.shift();
    } else {
      last.F1 = F1; last.F2 = F2; last.F3 = F3;
    }

    Pp.keju.indicators = ind;
    return { F1: F1, F2: F2, F3: F3, signals: sig, year: year };
  }

  // ════════════════════════════════════════════════════════════════
  // §5·暴露
  // ════════════════════════════════════════════════════════════════
  var _api = {
    updateIndicators: _kjUpdateIndicators,
    calcF1: _kjCalcF1,
    calcF2: _kjCalcF2,
    calcF3: _kjCalcF3,
    gatherSignals: _kjGatherIndicatorSignals,
    networkDiversity: _kjIndicatorNetworkDiversity
  };

  global.TM = global.TM || {};
  global.TM.Keju = global.TM.Keju || {};
  global.TM.Keju.Indicators = _api;

  // 全局 alias·endTurn / UI 直调
  global._kjUpdateIndicators           = _kjUpdateIndicators;
  global._kjCalcF1                     = _kjCalcF1;
  global._kjCalcF2                     = _kjCalcF2;
  global._kjCalcF3                     = _kjCalcF3;
  global._kjGatherIndicatorSignals     = _kjGatherIndicatorSignals;
  global._kjIndicatorNetworkDiversity  = _kjIndicatorNetworkDiversity;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = _api;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
