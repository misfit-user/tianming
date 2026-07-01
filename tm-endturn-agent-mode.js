// @ts-check
// ============================================================
// tm-endturn-agent-mode.js — 回合推演「模式 b · agent 模式」(局内 Claude Code)
//
// 天命第二条回合引擎。与现有 LLM 管线(模式 a · sc0-sc28)**完全平行**·开关门控·默认关。
// 定位:让 AI 按推演结果**主动**改存档任意内容 + 对应 UI 字段——读写都是全局·只多不少·
//       产出与应用焊死(报告=实际改动流水账)·根治「推演说要改、UI/状态没改」。
// 详设:docs/agent-mode-design.md
//
// 契约:接收只多不少(基线 + 按需 pull) / 运作方式全变(单纪律 agent 循环) /
//       产出只多不少(写 _turnReport 焊缝) / 甲案(引擎先) / 写引擎让步。
//
// ── 进度 ──
//   S1 骨架  S2 只读工具集  S3 守护写工具+校验闸  S4 agent 循环+覆盖脊柱
//   S5(本刀) **甲案 engine-first + 安全闭环**:
//     · 快照(回合前 deep-clone)→ **引擎先算硬核基线**(提前调 _endTurn_updateSystems·置 _systemsRan 让 systems 步幂等跳)
//       → agent 看真数再覆写 → 状态自检 → 过则提交·崩则回滚+回落 LLM。
//     · 引擎让步:agent 在引擎之后写·天然盖过(systems 步幂等不再 tick)·_agentOverrides 标为下游重算保险。
//   S6 设置 toggle + a/b 对拍验证
// ============================================================

(function (root) {
  'use strict';
  var TM = root.TM || (root.TM = {});
  TM.Endturn = TM.Endturn || {};

  function _GM(ctx) { return (ctx && ctx.GM) || root.GM || null; }
  function _brief(v, n) { try { var s = typeof v === 'string' ? v : JSON.stringify(v); n = n || 200; return s && s.length > n ? s.slice(0, n) + '…' : String(s); } catch (e) { return String(v); } }
  // 报拍(驱动电影化加载层 agent 拍表·标签须匹配 AGENT_BEATS 前缀)·缺 showLoading 静默
  function _show(msg, pct) { try { if (typeof root.showLoading === 'function') root.showLoading(msg, pct); } catch (e) {} }

  // ── 本回合时间上下文:明确告诉 agent 当前纪元年月 + 本回合历时(天/月)+ 时间相关后果如何据此推演 ──
  //   命门:agent 推演"十日内具册/赴任行程/换季农时/粮饷转输/战事推进"等时间相关后果·须知当前日期与本回合跨度·否则脱离时间凭空推。
  //   日期/天数读 getTSText/_getDaysPerTurn(与 LLM 管线同源·tm-endturn-prompt:295/_getDaysPerTurn)·缺失则降级只报回合数(不崩)。
  function _timeContext(gm, resolutionTurn) {
    try {
      if (!gm) return '';
      var rt = (resolutionTurn != null) ? resolutionTurn : (gm.turn || 0);
      var dpt = 30;
      try { if (typeof root._getDaysPerTurn === 'function') dpt = root._getDaysPerTurn() || 30; } catch (_d) {}
      var startD = '', endD = '';
      try { if (typeof root.getTSText === 'function') { startD = root.getTSText(rt) || ''; endD = root.getTSText(rt + 1) || ''; } } catch (_t) {}
      var span = (dpt >= 28) ? (Math.round(dpt / 30 * 10) / 10 + ' 个月') : (dpt + ' 天');
      var head = '【本回合时间】' + (gm.eraName ? (gm.eraName + '·') : '') + (startD || ('第' + rt + '回')) + (endD && endD !== startD ? ('→' + endD) : '') + ' · 本回合约历 ' + dpt + ' 天(' + span + ')';
      return head + '。\n  推演一切时间相关后果须据此真实历时:① 诏令期限(如"十日内具册"本回合内可成、"一月具狱/三月平乱"需跨回合渐次推进·勿当回合内全办妥) ② 赴任/行军行程(关山远近·' + dpt + ' 天内未必抵远地·远者仍在途) ③ 换季农时、粮饷转输、工程进度均按历时计 ④ 跨回合事势须接续推进(参跨回合记忆/编年·勿失忆重起)。';
    } catch (e) { return ''; }
  }

  // ── 切片1·自我反思·校准开关(agent 模式专属·P.conf 命名空间·与 LLM 升级 reflectionAgentEnabled 分开:后者在 agent 模式被互斥强关) ──
  function _agentSelfReflectOn(P) { P = P || root.P || {}; return !!(P.conf && P.conf.agentSelfReflectEnabled); }
  // ── 活世界·势力③ agent 决策开关(agent 模式专属·绕过 LLM 升级互斥·默认关) ──
  function _agentLiveWorldOn(P) { P = P || root.P || {}; return (typeof root.agentLiveWorldOn === 'function') ? root.agentLiveWorldOn() : !!(P.conf && P.conf.agentLiveWorldEnabled); }
  // ── 切片3·跨回合一致·诏令督查开关(agent 模式专属·P.conf) ──
  function _agentEdictOversightOn(P) { P = P || root.P || {}; return !!(P.conf && P.conf.agentEdictOversightEnabled); }

  // ── 切片3·诏令登记兜底:把本回合玩家诏令登记进 GM._edictTracker(不依赖 pipeline prep)·使诏令督查/在办诏令档有数可追 ──
  //   真游戏 prep(tm-endturn-prep.js:363)已登记→此处**去重跳过**(防重复);prep 未跑(如直调/某路径)则补登记。形状对齐 prep。gate 在 edict-oversight 开关下(其消费者)·关则不动。
  function _registerPlayerEdicts(gm, ctx, resolutionTurn) {
    try {
      var inp = (ctx && ctx.input) || {};
      var edicts = inp.edicts || [];
      if (!edicts.length) return 0;
      if (!Array.isArray(gm._edictTracker)) gm._edictTracker = [];
      var rt = (resolutionTurn != null) ? resolutionTurn : (gm.turn || 0);
      var added = 0;
      edicts.forEach(function (e) {
        var content = String((typeof e === 'string') ? e : ((e && (e.content || e.text)) || '')).trim();
        if (!content) return;
        var dup = gm._edictTracker.some(function (t) {   // 去重:本回合已有同源诏令(prep 登记的)→跳过
          if (!t || t.turn !== rt) return false;
          var tc = String(t.content || '');
          return tc === content || (tc.length > 12 && content.indexOf(tc.slice(0, 16)) >= 0) || (content.length > 12 && tc.indexOf(content.slice(0, 16)) >= 0);
        });
        if (dup) return;
        gm._edictTracker.push({ id: 'agent_e' + rt + '_' + added, content: content.slice(0, 400), category: '诏令', turn: rt, status: 'pending', assignee: '', feedback: '', progressPercent: 0, _agentRegistered: true });
        added++;
      });
      return added;
    } catch (e) { return 0; }
  }

  // ── 切片3·跨回合一致·诏令督查:把在办活诏令(跨回合·带进度/状态·复用 TM.EdictOversight.activeEdicts)+ 近期既定事实(已故)注入 basis ──
  //   命门:推演接续上回合而非失忆——颁布≠见效·须推演活诏令本回合真实推进/被架空;勿令已故者行动/复活。开关关/无活诏令则空。
  function _activeEdictsDossier(gm) {
    if (!gm) return '';
    var parts = [];
    try {
      var EO = TM.EdictOversight;
      if (EO && typeof EO.activeEdicts === 'function') {
        var act = EO.activeEdicts(gm) || [];
        if (act.length) parts.push('【在办诏令 · 跨回合追踪(颁布≠见效·须推演其本回合真实推进或被架空·勿当已完成/遗忘)】\n' + act.slice(0, 12).map(function (e) {
          return '· ' + (e.category ? '[' + e.category + ']' : '') + _brief(e.content, 60) + '｜下达 T' + e.issuedTurn + '(历 ' + e.age + ' 回)·进度' + e.progress + '%·' + e.status + (e.assignee ? '·承办' + e.assignee : '') + (e.lastFeedback ? '·前况:' + _brief(e.lastFeedback, 30) : '');
        }).join('\n'));
      }
    } catch (_eoE) {}
    try {
      var curT = gm.turn || 0;
      var dead = (gm.chars || []).filter(function (c) { return c && c.alive === false && c.deathTurn != null && (curT - c.deathTurn) <= 8; });
      if (dead.length) parts.push('【既定事实 · 近期已故(勿令其行动/复活·涉及只可追述)】' + dead.slice(0, 12).map(function (c) { return c.name + '(T' + c.deathTurn + '殁)'; }).join('、'));
    } catch (_dE) {}
    return parts.length ? parts.join('\n\n') : '';
  }

  // ── 切片2·内容质量闸开关(agent 模式专属·P.conf) ──
  function _agentQualityGateOn(P) { P = P || root.P || {}; return !!(P.conf && P.conf.agentQualityGateEnabled); }

  // ── 切片2·内容质量闸:成文后、提交前单发审查(因果合理/信史无错位/不与既定事实矛盾)·不过则一轮定向修补史记 ──
  //   类比 LLM sc27 叙事审查·agent 版聚焦"推演内容质量"·最多 1 轮修补(防循环)·只修成文不动数值(数值有写工具验证闸把关)。
  //   后台优先·任何失败降级提交原文(不阻断)。写 gm._agentQualityReport 供观测。
  async function _qualityGate(ctx, gm, state, narrative) {
    if (typeof root.callAIMessages !== 'function') return { narrative: narrative, skipped: 'noCaller' };
    var ch = gm._agentChronicle || {};
    var szj = ch.shizhengji || narrative || '';
    if (!szj || szj.length < 30) return { narrative: narrative, skipped: 'tooShort' };   // 内容太少不审(turn1/退化回合)
    var facts = [];
    try {
      var curT = gm.turn || 0;
      (gm.chars || []).filter(function (c) { return c && c.alive === false && c.deathTurn != null && (curT - c.deathTurn) <= 10; }).slice(0, 12).forEach(function (c) { facts.push(c.name + '(已殁)'); });
    } catch (_fe) {}
    var changes = (Array.isArray(gm._turnReport) ? gm._turnReport : []).filter(function (e) { return e && e.type === 'change'; }).slice(0, 16).map(function (e) { return (e.path || '') + (e.reason ? '(' + _brief(e.reason, 24) + ')' : ''); });
    var sys = '你是史官兼审读官·审查本回合推演成文的质量。三审:① 因果合理(后果是否从玩家举措+局势自然推出·有无无源突变) ② 信史(有无时代错乱/杜撰人名/反历史常识) ③ 既定事实一致(有无让已故者行动、无视已发生之事)。严格但不吹毛求疵·仅返回 JSON。';
    var u = '【本回合史记·时政记】\n' + String(szj).slice(0, 1400) + '\n'
      + (ch.shilu ? ('【实录】\n' + String(ch.shilu).slice(0, 600) + '\n') : '')
      + '\n【本回合关键改动】' + (changes.join('；') || '(无)') + '\n'
      + '【既定事实·近期已故】' + (facts.join('、') || '(无)') + '\n\n'
      + '返回 JSON:{"pass":true/false,"issues":[{"dim":"因果|信史|一致","problem":"具体问题(≤40字)","fix":"如何改(≤40字)"}]}·无问题 pass:true issues:[]·问题须具体可改·勿无病呻吟。';
    var raw;
    try { raw = await root.callAIMessages([{ role: 'system', content: sys }, { role: 'user', content: u }], 1200, null, 'primary', { priority: 'background', timeoutMs: 45000, maxRetries: 1, id: 'agent_quality_review' }); }
    catch (e) { return { narrative: narrative, skipped: 'reviewFail' }; }
    var rev = _safeJSON(raw);
    var issues = (rev && Array.isArray(rev.issues)) ? rev.issues.filter(function (i) { return i && i.problem; }) : [];
    gm._agentQualityReport = { turn: gm.turn || 0, pass: !!(rev && rev.pass) && !issues.length, issues: issues.slice(0, 6), repaired: false };
    if (!issues.length) return { narrative: narrative, pass: true };
    // 一轮定向修补:据 issues 重写史记(只改成文·不动状态/数值)
    var fixSys = '你是史官。据审读意见修订本回合史记·只修正被指出的问题(因果/信史/一致)·保持原有信息与文风·勿大改、勿新增杜撰。仅返回 JSON。';
    var fixU = '【原时政记】\n' + String(szj).slice(0, 1600) + '\n\n【审读意见(逐条修正)】\n' + issues.slice(0, 6).map(function (i) { return '· [' + (i.dim || '') + '] ' + i.problem + ' → ' + (i.fix || '修正'); }).join('\n') + '\n\n返回 JSON:{"shizhengji":"修订后时政记","shilu":"修订后实录(无改动则照原)","zhengwen":"修订后政文(无改动则照原)"}';
    var fixRaw;
    try { _show('⟨执政⟩据审读修订史记…', 88); fixRaw = await root.callAIMessages([{ role: 'system', content: fixSys }, { role: 'user', content: fixU }], 2000, null, 'primary', { priority: 'background', timeoutMs: 45000, maxRetries: 1, id: 'agent_quality_fix' }); }
    catch (e) { return { narrative: narrative, pass: false, issues: issues }; }
    var fixed = _safeJSON(fixRaw);
    var _fixedSzj = (fixed && fixed.shizhengji) ? fixed.shizhengji : '';
    // 健壮兜底(治"抓到问题却没修补":弱模型修补返回长 prose·内部换行/引号致 JSON.parse 失败→_safeJSON 空→修补静默落空)。
    //   正则抽 shizhengji 字段值(容转义引号与换行·镜像 deepen_narrative 的 houren 健壮抽取)·仍无且整段纯文本→直接用整段。
    if (!_fixedSzj && fixRaw) {
      var _fc = String((typeof fixRaw === 'string') ? fixRaw : ((fixRaw && (fixRaw.content || fixRaw.text)) || '')).replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      var _sm = _fc.match(/"shizhengji"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (_sm && _sm[1]) _fixedSzj = _sm[1].replace(/\\n/g, '\n').replace(/\\t/g, '  ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      else if (_fc && !/^[\[{]/.test(_fc) && _fc.length > 60) _fixedSzj = _fc;   // 整段纯文本修订稿(无 JSON 包装)
    }
    if (_fixedSzj) {
      gm._agentChronicle = gm._agentChronicle || {};
      gm._agentChronicle.shizhengji = _fixedSzj;
      if (fixed && fixed.shilu) gm._agentChronicle.shilu = fixed.shilu;
      if (fixed && fixed.zhengwen) gm._agentChronicle.zhengwen = fixed.zhengwen;
      gm._agentQualityReport.repaired = true;
      return { narrative: _fixedSzj, pass: false, repaired: true, issues: issues };
    }
    return { narrative: narrative, pass: false, issues: issues };
  }

  // ── 切片4·冷门动作深查开关(agent 模式专属·P.conf) ──
  function _agentAnomalyOn(P) { P = P || root.P || {}; return !!(P.conf && P.conf.agentAnomalyEnabled); }

  // ── 切片4·冷门动作深查:扫描玩家本回合举措是否非常规(突破常例/创造性/罕见)→ 若是返回深查指引(命门:硬核×自由交点) ──
  //   单发分类(玩家有举措才扫)·返回 {unusual, aspect, precedentQuery}·失败/无举措/寻常返回 null(不 nudge·不阻断)。
  async function _anomalyScan(ctx, gm) {
    if (typeof root.callAIMessages !== 'function') return null;
    var inp = (ctx && ctx.input) || {};
    var edicts = inp.edicts || [];
    var acts = [];
    edicts.slice(0, 10).forEach(function (e) { acts.push(_brief(e, 120)); });
    if (inp.xinglu) acts.push('行止:' + _brief(inp.xinglu, 160));
    if (!acts.length) return null;   // 玩家本回合无举措·无从扫
    var sys = '你是史识判官。判断君上本回合举措是否「非常规」——突破常规施政惯例、创造性、或历史上罕见之举(相对寻常的任免/赏罚/常规诏令而言)。只返回 JSON。';
    var u = '【君上本回合举措】\n' + acts.map(function (a) { return '· ' + a; }).join('\n') + '\n\n返回 JSON:{"unusual":true/false,"aspect":"非常规之处(≤30字·寻常则空)","precedentQuery":"可深查的史例检索词(≤20字·如『权臣夺兵权』『迁都』『裁撤冗官』)"}·寻常举措 unusual:false。';
    var raw;
    try { raw = await root.callAIMessages([{ role: 'system', content: sys }, { role: 'user', content: u }], 600, null, 'primary', { priority: 'normal', timeoutMs: 30000, maxRetries: 1, id: 'agent_anomaly_scan' }); }
    catch (e) { return null; }
    var p = _safeJSON(raw);
    if (!p || !p.unusual) return null;
    return { unusual: true, aspect: String(p.aspect || '').slice(0, 40), precedentQuery: String(p.precedentQuery || p.aspect || '').slice(0, 30) };
  }

  function _anomalyNudge(an) {
    if (!an || !an.unusual) return '';
    return '【⚠ 本回合君上举措非常规' + (an.aspect ? '：' + an.aspect : '') + '】此举突破常例·属君上之「自由」。命门铁律:君上可天马行空·但你推演的后果必须**硬核可信、有史可依**。\n'
      + '推演前务必先用 read_records / read_chronicle / get_dossier 深查' + (an.precedentQuery ? '【' + an.precedentQuery + '】相关的' : '') + '真实史例与先例·据先例推演其可信连锁后果(成败几率、阻力、各方反应、隐患)·切勿泛泛而谈或简单顺君上之意了事。';
  }

  // ── 覆盖脊柱:本回合必须逐项考虑的交付域(从产出契约/applier 字段导出)·保「只多不少」 ──
  var COVERAGE_SPINE = [
    { key: 'narrative',  label: '时政叙事与摘要', hint: '本回合发生了什么·君上举措的反响', kw: ['narrative', 'summary', '叙事', '摘要'] },
    { key: 'fiscal',     label: '财政',           hint: '国库/内帑/赋税随局势的变化',       kw: ['guoku', 'neitang', 'tax', 'fiscal', '财', '税', '库'] },
    { key: 'personnel',  label: '人事',           hint: '官员任免/迁转/赏罚',               kw: ['char', 'office', 'personnel', '官', '任', '黜', '迁', '赏', '罚'] },
    { key: 'faction',    label: '势力与外交',     hint: '各方势力的动向/邦交/战和',         kw: ['fac', 'faction', 'diplo', '盟', '势力', '邦交'] },
    { key: 'military',   label: '军事',           hint: '战事/军队/边防',                   kw: ['armies', 'war', 'battle', '军', '战', '兵', '边'] },
    { key: 'minsheng',   label: '民心民生',       hint: '民心/灾荒/民变',                   kw: ['minxin', 'population', '民', '灾', '荒'] },
    { key: 'events',     label: '事件',           hint: '新触发的事件/天象/异动',           kw: ['evtlog', 'events', 'event', '事件', '象'] },
    { key: 'memory',     label: '记忆与伏笔',     hint: '值得记下的伏笔/人物动机',           kw: ['memory', 'memo', '伏笔', '记'] }
  ];

  function _spineText() {
    var L = ['【覆盖脊柱·本回合必须逐项深推(每域用对应深化/读写工具深挖一遍;该域确无变化·也要在叙事里交代一句·勿静默遗漏=失深度)】'];
    COVERAGE_SPINE.forEach(function (s, i) { L.push((i + 1) + '. ' + s.label + '：' + s.hint); });
    L.push('脊柱是【地板】不是天花板:凡推演出的后果都可改(高自由度)。在本回合最吃紧的维度上要【多轮超深挖】(比固定管线更深)——这才是 agent 的本分。');
    return L.join('\n');
  }

  // 深化工具→脊柱维度映射(深化工具写 _turnReport·此映射让覆盖检测显式记功)
  var DEPTH_TOOL_DIM = { deepen_factions: 'faction', deepen_economy: 'fiscal', deepen_military: 'military', deepen_world: 'events', recall_consolidate: 'memory', deepen_narrative: 'narrative' };

  // 加载层工作流文案(owner:工作流轨迹显示在回合推演加载动画里)·让加载界面叙述 agent 在干什么·而非干瘪工具名
  var _WF_LABEL = { recall_consolidate: '固化记忆·理清脉络', deepen_factions: '深析势力动向', deepen_economy: '深析财政民生', deepen_military: '深析军事边防', deepen_npcs: '推演群臣内心', deepen_relations: '理清人物恩怨', deepen_world: '勾勒天下大势', deepen_narrative: '史官落笔成章' };
  var _WF_SKIP = { deepen_factions: '势力无异动·略过', deepen_economy: '财政平稳·略过', deepen_military: '本回合无战事·略过', deepen_relations: '人物无新恩怨·略过' };

  // 自适应深化:据本回合实际内容(引擎报告 + 玩家操作)判定哪些维度真有活动·空维度不跑深化(去填充噪音 + 省按次计费调用)
  //   命门:深度不丢——地板维度(记忆/NPC/世界/史记)永远跑;仅"势力/经济/军事/关系"这四个可能真的整回合零动静的维度才门控。空维度跑只会逼模型编填充。
  function _activeDims(gm, state) {
    var hay = '';
    try {
      (gm._turnReport || []).forEach(function (r) { if (r) hay += ' ' + (r.path || '') + ' ' + (r.reason || '') + ' ' + (r.type || '') + ' ' + (r.actor || '') + ' ' + (r.target || '') + ' ' + (typeof r.new === 'string' ? r.new : ''); });
      hay += ' ' + (gm._turnPlayerOps || '');
    } catch (_) {}
    var d = {};
    if (state && state.engineDims) Object.keys(state.engineDims).forEach(function (k) { if (state.engineDims[k]) d[k] = 1; });
    if (/财|赋|税|粮|银|帑|国库|内帑|盐|矿|商|贸|民生|灾|荒|赈|俸|饷|漕/.test(hay)) d.fiscal = 1;
    if (/兵|军|战|征|伐|围|攻|守|将|帅|边|寇|虏|营|饷|武|防|塞|镇|捷|溃/.test(hay)) d.military = 1;
    if (/势力|外交|盟|邦交|宣战|议和|和亲|遣使|朝贡|党|阉|东林|藩|夷|酋/.test(hay)) d.faction = 1;
    if (/弹劾|举荐|构陷|结党|背叛|和解|联姻|师徒|私访|对质|恩怨|交恶|问对|朝议|密信|党争/.test(hay)) d.relations = 1;  // ⚠ 勿用裸"举/劾"(会误中"举措"等表头)·只用复合词
    return d;
  }
  function _jsonLite(v) {
    try { return JSON.stringify(v); } catch (e) { try { return String(v); } catch (_) { return ''; } }
  }
  function _changed(before, after, key) {
    return _jsonLite(before && before[key]) !== _jsonLite(after && after[key]);
  }
  function _engineDiffDims(before, after) {
    var d = {};
    if (!before || !after) return d;
    ['guoku', 'neitang', 'huji', 'population', 'minxin'].forEach(function (k) { if (_changed(before, after, k)) d.fiscal = 1; });
    ['armies', 'activeWars'].forEach(function (k) { if (_changed(before, after, k)) { d.military = 1; d.faction = 1; } });
    ['facs', 'factions', 'factionRelations', 'relations', 'parties', 'classes'].forEach(function (k) { if (_changed(before, after, k)) d.faction = 1; });
    return d;
  }
  function _detectSpineGaps(gm, state) {
    var entries = (gm && Array.isArray(gm._agentWriteLog)) ? gm._agentWriteLog : [];
    var rep = (gm && Array.isArray(gm._turnReport)) ? gm._turnReport : [];
    // 写日志 + 回合报告(深化工具写这里·带 path/reason/_op)一并入覆盖检测 blob
    var blob = entries.concat(rep).map(function (e) { return String((e.path || '') + ' ' + (e.reason || '') + ' ' + (e._op || '')); }).join(' ').toLowerCase();
    var hasNarr = rep.some(function (e) { return e.type === 'narrative'; });
    var covered = {};
    if (state && state.depthTools) Object.keys(state.depthTools).forEach(function (t) { if (DEPTH_TOOL_DIM[t]) covered[DEPTH_TOOL_DIM[t]] = 1; });
    var gaps = [];
    var _Pg = root.P || {};
    var _adaptiveG = !(_Pg.conf && _Pg.conf.agentAdaptiveDeepen === false);
    var _actG = _adaptiveG ? _activeDims(gm, state) : null;   // 与刀1同源·判维度本回合是否真有活动
    COVERAGE_SPINE.forEach(function (s) {
      if (covered[s.key]) return;                                   // 对应深化工具已调=该维度已覆盖
      if (s.key === 'narrative') { if (!hasNarr) gaps.push(s.label); return; }
      var hit = s.kw.some(function (k) { return blob.indexOf(String(k).toLowerCase()) >= 0; });
      if (hit) return;
      // 自适应一致(与刀1同口径):门控维度(财政/军事/势力)本回合确无活动信号 → 合法空·非缺口·勿逼模型对死维度空转填充
      if (_actG && (s.key === 'fiscal' || s.key === 'military' || s.key === 'faction') && !_actG[s.key]) return;
      gaps.push(s.label);
    });
    return gaps;
  }

  // ── D1 深度门:逼 agent 走到足够深才许收尾(防偷懒草收=极浅推演=灾难)。默认开·可 agentModeDepthGate=false 关。 ──
  function _depthGate(gm, state) {
    var P = root.P || {};
    if (P.conf && P.conf.agentModeDepthGate === false) return { ok: true, reason: '', gaps: [] };
    var minRounds = (P.conf && P.conf.agentModeMinRounds) || 3;
    var gapTol = (P.conf && P.conf.agentModeSpineGapTol != null) ? P.conf.agentModeSpineGapTol : 2;
    var problems = [];
    if ((state.rounds || 0) < minRounds) problems.push('推演轮次不足(' + (state.rounds || 0) + '/' + minRounds + '·须多轮深推)');
    var gaps = _detectSpineGaps(gm, state);
    if (gaps.length > gapTol) problems.push('覆盖脊柱缺口:' + gaps.join('/') + '(逐项深推·无变化也要触及)');
    var dt = state.depthTools || {};
    if (!dt.recall_consolidate) problems.push('未固化记忆(收尾前须调 recall_consolidate·保跨回合连续)');
    if (!dt.deepen_narrative) problems.push('未成史记四体(收尾前须调 deepen_narrative·否则史记弹窗实录/政文空)');
    return { ok: problems.length === 0, reason: problems.join('；'), gaps: gaps };
  }

  // ── prompts ──
  function _buildSystemPrompt() {
    return [
      '你是天命·回合推演的「局内执政-史官」agent(实验·agent 模式)。',
      '【你的职责 = 推演后果·不是替玩家做操作】玩家(君上)本回合的决定——任免官员、颁诏、批奏疏、问对、朝会、书信——**已由玩家做出**(见下方依据·过回合前已定)。',
      '你的任务:**推演这些决定引发的后果 + 这一回合天下自走的一切**·并用守护写工具把推演出的后果落到存档。',
      '【铁律·职责分离】绝不替玩家做决定/操作:勿替玩家任命他没任命的人、勿替玩家颁他没下的诏。玩家任命了谁、下了什么诏·你只推演其**连锁反应**(到任后各方反应 / 诏令的执行与阻力 / 由此牵动的人事财政民心势力)。',
      '与旧法根本不同:你不是输出一份 JSON 让别人翻译·而是**亲自动手把推演出的后果改进存档**——想看什么用只读工具看·想改什么用守护写工具改·改即入回合报告。',
      '【重要】本回合的财政/人口/军事等**硬核数字·引擎已先算好基线**(国库/人口等已是结算后真值)·你在**真实数字**之上推演后果与覆写·勿凭空臆造数值。',
      '原则:',
      '· 先看后推:先 get_overview / 只读工具把握(引擎已结算的)真实局面与玩家已做的操作·再推演后果。',
      '· 想充分掌握某方面:优先用高阶聚合工具——get_dossier(一次抓全某维度:fiscal财政/military军事/diplomacy势力外交/personnel人事/court朝局党争/minsheng民生·或任意主题词)、read_chronicle(跨回合长期事势·须续接)、read_records(回顾往事·史记实录时政/君上往昔御批回听)。它们一次抓得多、省调用,胜过一堆零散 get_field。你愿深入到什么程度就调到什么程度。',
      '· 高效落地:一轮可同时调用多个工具(批量落地多笔后果)·尽量单轮多干、减少往返轮次(省时·亦省按次计费)。',
      '· 硬核可信:推演的后果须符合局势因果·数值合理(守护写有校验闸·非法会被拒·你会看到拒因·据此修正)。',
      '· 后果即落地:每推演出一项后果·立即用守护写工具改进存档(财政增减 / 民心民生 / 官员境遇 / 势力态度 / 触发事件)·不要只说不改。',
      '· 硬核账走专用工具:改国库总额用 adjust_treasury·增删调**收入支出流水项**(开税源/砍军费/设年例)用 adjust_fiscal_item·删数组项(部队覆灭/党派清洗/势力剪除)用 remove_field·增项用 push_field。软字段(心境/民心/关系/事件)用 set_field/adjust_field。',
      '· 治国语义工具(有引擎记账·裸改会落错或被覆盖·必须走它们):任免 appoint_official/dismiss_official · 军事 command_army(募兵/调动/改将/解散) · 外交 diplomatic_action(宣战/议和/设邦交) · 建筑 building_project(兴工/拆毁) · 行政区划 restructure_division(设府/废县/改隶/升降)。这些是你作为执政可主动施为的治国手段——按推演该动则动。',
      '· 舆地变迁工具:人物移动 move_character(赴任/出征/流放/还朝改所在地) · 迁都 relocate_capital(朝廷或势力迁治所) · 地块易主 change_region_owner(攻占/割让/归附→改地块归属并使地图变色) · 地块状态 adjust_region_state(某地民心/繁荣升降·兵燹灾荒善政致) · 地块建筑 building_project(兴工/拆毁)。推演出领土/人物/都城/地方状态/营造变动时用之·勿裸改地图字段。',
      '· 【人事=玩家的事·勿越俎代庖】玩家的任命已定·**勿重做、勿替玩家任命**。仅当你推演出**世界自走**需要人事变动时(如官员阵亡/叛逃需补缺、因你推演之事而问责黜落)·才用 appoint_official/dismiss_official——那是**后果**·不是替玩家做新任命。',
      '· 【深度是命门·别让世界在你这回合变薄】每个本回合有动静的维度(财政/军事/势力/民生/人事/事件/舆地)都要用守护写/语义工具把后果真落地——覆盖脊柱、该动的别漏;热点维度(战事/财政/夺权/灾荒)多落地几笔更细的后果。',
      '· 收尾综合(你自己调这两个):recall_consolidate(把本回合固化为记忆+状态盘+情节线索·保跨回合连续) + deepen_narrative(写成史记四体:实录/时政记/政文/后人戏说)。',
      '· 维度深化自动补全:势力暗流/经济军事深析/NPC 内心/人物关系/书信/御案时政与求见 等维度深化·会在你 finalize 后由系统按本回合实况**自动补齐**(仅补有动静的维度)——你**不必逐一调用那些 deepen_* 工具**(循环里也不再挂它们)·专注把后果落地 + 上面两个收尾综合即可。',
      '· 【禁草草收尾】finalize_turn 有深度门:轮次不足 / 脊柱缺口过多 / 未 recall_consolidate 固化 / 未 deepen_narrative 成史记 → 会被驳回。所以:把本回合各活动维度都落地 + recall_consolidate + deepen_narrative·再 finalize。',
      '· 收尾:深度达标后调 finalize_turn·给史记(narrative·建议先 deepen_narrative 打磨)与摘要(summary)·须忠实反映你**实际改了什么**。',
      _spineText()
    ].join('\n');
  }

  function _buildTurnPrompt(ctx, gm) {
    var L = [];
    L.push('【本回合】第 ' + ((gm && gm.turn) || '?') + ' 回合' + ((gm && gm.eraName) ? (' · ' + gm.eraName) : ''));
    var inp = (ctx && ctx.input) || {};
    var edicts = inp.edicts || [];
    if (edicts.length) { L.push('【君上诏令/举措】'); edicts.slice(0, 12).forEach(function (e) { L.push('· ' + _brief(e, 160)); }); }
    else L.push('【君上本回合无新诏令】');
    if (inp.xinglu) L.push('【君上行止】' + _brief(inp.xinglu, 300));
    if (gm) {
      var snap = [];
      if (gm.guoku != null) snap.push('国库' + _brief(gm.guoku, 40));
      ['chars', 'facs', 'armies', 'activeWars', 'memorials'].forEach(function (k) { if (Array.isArray(gm[k])) snap.push(k + '×' + gm[k].length); });
      if (snap.length) L.push('【速览·引擎已结算】' + snap.join(' · '));
    }
    L.push('');
    L.push('请开始推演本回合:先 get_overview 把握全局·再逐步用工具查证与落地·全部完成后调 finalize_turn。');
    return L.join('\n');
  }

  // 【S9 依据同源】复用 LLM 管线 prompt builder 的产出作依据基线 → LLM 加依据此处自动同步(契约「接收只多不少」)。
  //   sysP(含 appendPromptPolicyContext 运行时注入) + tp(回合数据) 同源全量·框住"忽略其中输出指令·只用工具落地"。
  //   build 不可用/失败/产出空 → 返 null(调用方回落薄 _buildTurnPrompt)。
  async function _basisDossier(ctx, gm) {
    try {
      var PB = TM.Endturn && TM.Endturn.AI && TM.Endturn.AI.prompt;
      if (!PB || typeof PB.build !== 'function' || !ctx) return null;
      if (!ctx.prompt) await PB.build(ctx);          // 与 LLM 同源·此刻 gm 已含引擎结算真数(engine-first 之后)
      var p = ctx.prompt || {};
      var basis = (String(p.sysP || '') + '\n' + String(p.tp || '')).trim();
      if (!basis) return null;
      return '【本回合完整局势依据 · 与 LLM 模式同源(LLM 那边任何依据更新此处自动同步)】\n'
        + '※ 下文凡「输出 JSON / 必须填写 XX 字段 / edict_lifecycle_update 等产出格式」类指令属 LLM 模式 · 你一律忽略——你不输出 JSON · 只用工具直接改存档落地。\n\n'
        + basis + '\n\n'
        + '请据以上依据**推演本回合的后果**:先 get_overview 把握全局(含玩家已做的任免/诏令)· 再用工具把后果落地(玩家的操作已定·你只推演其连锁反应 + 世界自走·勿替玩家重做任免/下诏)· 全部完成后调 finalize_turn。';
    } catch (e) {
      try { console.warn('[agent-mode] 复用 LLM 依据失败 · 回落薄 baseline', e); } catch (_) {}
      return null;
    }
  }

  // DA-Q3·跨回合记忆地板:把 LLM sc1 _sc1Prefix 同源的高价值跨回合记忆 push 进 agent baseline·
  //   命门「推演记忆不弱于 LLM」——baseline 是地板(默认就有)·读工具 get_field/recall_history 是其上实时超集(天花板)。
  //   纯 gm 直读(_stateBoard/_consolidatedMemory/_plotThreads/_foreshadows·均上回合 recall_consolidate/sc25 写)·全 guarded·turn1/缺失→空串。
  function _memoryDossier(gm) {
    if (!gm) return '';
    // ④ 模型能力档 agentMemoryDepth(默认3·owner 据模型能力上调·越大读越多过往:史记/御批/编年/压缩层)——「能读多少根据模型能力来」
    var Pm = root.P || {};
    var memDepth = Math.max(1, Math.round((Pm.conf && Pm.conf.agentMemoryDepth) || 6));
    var parts = [];
    // ④ 多回合综合脉络(recall_consolidate 滚动整合·非逐回合罗列)·置最前=贯穿至今的主线·须续接
    try { if (gm._sagaMemory && gm._sagaMemory.text) parts.push('【多回合综合脉络 · 贯穿至今的主线(综合而非罗列·你的推演须接此主线)】\n' + _brief(gm._sagaMemory.text, 700)); } catch (e) {}
    try { var sb = gm._stateBoard; if (sb) parts.push('【上回合状态盘 · 跨回合连续性】\n' + _brief(typeof sb === 'string' ? sb : JSON.stringify(sb), 3000)); } catch (e) {}
    try { var cm = gm._consolidatedMemory || gm._aiMemory; if (cm) { var cmStr; if (typeof cm === 'string') cmStr = cm; else if (Array.isArray(cm)) cmStr = cm.slice(-12).map(function (m) { return '第' + (m && m.turn != null ? m.turn : '?') + '回:' + ((m && (m.summary || m.text)) || (typeof m === 'string' ? m : JSON.stringify(m))); }).join('\n'); else cmStr = JSON.stringify(cm); parts.push('【跨回合固化记忆 · 近回合在后】\n' + _brief(cmStr, 4000)); } } catch (e) {}
    try { var pt = gm._plotThreads; if (Array.isArray(pt) && pt.length) parts.push('【情节线索】\n' + pt.slice(0, 20).map(function (t) { return '· ' + (typeof t === 'string' ? t : (t.title || t.desc || t.content || JSON.stringify(t))); }).join('\n')); } catch (e) {}
    try { var fs = gm._foreshadows; if (Array.isArray(fs) && fs.length) parts.push('【未回收伏笔】\n' + fs.slice(0, 20).map(function (f) { return '· ' + (typeof f === 'string' ? f : (f.content || f.text || JSON.stringify(f))); }).join('\n')); } catch (e) {}
    try { var cg = gm._causalGraph; if (cg && Array.isArray(cg.edges) && cg.edges.length) parts.push('【近期因果链 · 与 LLM 同源(ai.js:1952 推演读)】\n' + cg.edges.slice(-12).map(function (ed) { return '· ' + (ed.from || '') + '→' + (ed.to || '') + (ed.explanation ? '(' + ed.explanation + ')' : ''); }).join('\n')); } catch (e) {}
    // ④ 编年 · 进行中长期事势(跨回合大事:科举/诏令/工程/条约等·ChronicleTracker·须续接推进·勿当没发生)
    try { var ct = gm._chronicleTracks || gm.biannianItems; if (Array.isArray(ct) && ct.length) { var actCt = ct.filter(function (t) { return t && t.status !== 'completed' && t.status !== 'aborted' && !t.hidden; }); if (actCt.length) parts.push('【编年 · 进行中长期事势(跨回合·须续接推进)】\n' + actCt.slice(0, memDepth * 4).map(function (t) { return '· ' + (t.title || t.narrative || '') + (t.currentStage ? '(' + t.currentStage + ')' : '') + (t.progress != null ? ' 进度' + t.progress + '%' : '') + (t.narrative && t.title ? ':' + _brief(t.narrative, 50) : ''); }).join('\n')); } } catch (e) {}
    // ④ 前几回合史记 · 实录/时政(让推演接历史·非失忆)·读几回合按模型能力(memDepth)
    try { var sj = gm.shijiHistory; if (Array.isArray(sj) && sj.length) { var recSj = sj.slice(-memDepth); if (recSj.length) parts.push('【前几回合史记 · 实录/时政(续接历史·勿重起炉灶)】\n' + recSj.map(function (s) { return '〔第' + (s.turn != null ? s.turn : '?') + '回' + (s.szjTitle ? '·' + s.szjTitle : '') + '〕' + _brief(s.shilu || s.shiluText || s.shizhengji || s.szjSummary || '', 200) + (s.playerInner ? ' 〈君心:' + _brief(s.playerInner, 60) + '〉' : ''); }).join('\n')); } } catch (e) {}
    // 近回合诏书/行止(多回合·owner"诏书行止也应多回合读"·_agentRecentDirectives 滚动存·持久·**与 LLM 规则库 _playerDirectives 分开·避免 slice 逐出天意**)·君上历回意志连贯
    try { var pd = gm._agentRecentDirectives; if (Array.isArray(pd) && pd.length) parts.push('【近回合诏书/行止 · 君上历回举措(多回合·意志连贯须续行)】\n' + pd.slice(-memDepth).map(function (d) { return '第' + (d.turn != null ? d.turn : '?') + '回:' + (d.edicts && d.edicts.length ? '诏「' + d.edicts.join('；') + '」' : '(无新诏)') + (d.xinglu ? ' 行止:' + d.xinglu : ''); }).join('\n')); } catch (e) {}
    // ④ 御批回听 · 玩家对起居注的御批批注(GM.qijuHistory[]._annotation·_qijuAnnotate 写)·君上意志延续·读多少按模型能力
    try { var qj = gm.qijuHistory; if (Array.isArray(qj)) { var annot = qj.filter(function (r) { return r && r._annotation; }).slice(-(memDepth * 3)); if (annot.length) parts.push('【御批回听 · 君上对起居注的御批(意志延续·须体察续行)】\n' + annot.map(function (r) { return '· 第' + (r.turn || '?') + '回〔' + _brief(r.text || r.content || '', 40) + '〕御批:' + _brief(r._annotation, 70); }).join('\n')); } } catch (e) {}
    // ④ 远期压缩记忆(L2 5回合段/L3 30回合远·与压缩机制同源·memoryStewardEnabled 开则有;否则回落 _aiMemorySummaries)·读几层按能力
    try {
      var ml = gm._memoryLayers, comp = [];
      if (ml && (Array.isArray(ml.L3) || Array.isArray(ml.L2))) {
        if (Array.isArray(ml.L3) && ml.L3.length) comp = comp.concat(ml.L3.slice(-Math.ceil(memDepth / 2)).map(function (x) { return '〔远·' + (x.turnBucket || '') + '〕' + _brief(x.summary || '', 100); }));
        if (Array.isArray(ml.L2) && ml.L2.length) comp = comp.concat(ml.L2.slice(-memDepth).map(function (x) { return '〔段·' + (x.turnBucket || '') + '〕' + _brief(x.summary || '', 80); }));
      } else if (Array.isArray(gm._aiMemorySummaries) && gm._aiMemorySummaries.length) {
        comp = gm._aiMemorySummaries.slice(-memDepth).map(function (x) { return _brief(typeof x === 'string' ? x : (x.summary || x.text || ''), 100); }).filter(Boolean);
      }
      if (comp.length) parts.push('【远期压缩记忆 · 与压缩机制同源(段=5回合 远=30回合)】\n' + comp.join('\n'));
    } catch (e) {}
    if (!parts.length) return '';
    return '【跨回合记忆 · 与 LLM 模式同源 + 编年/史记/御批/压缩层(读多少随模型能力档 agentMemoryDepth)】\n' + parts.join('\n\n');
  }

  // ── 本回合玩家操作摘要(2026-06·命门:agent 据玩家操作推演·grounding)──
  //   收集本回合玩家实际做的事(诏令/朱批/朝会问对/鸿雁/行止)→ stash 到 gm._turnPlayerOps·
  //   既给 agentic 循环 ground·也供深化工具(_turnDigest 会纳入)ground——否则史记/NPC 推演脱离玩家实际所为(泛泛而谈)。
  function _playerOpsDigest(ctx, gm, playerTurn) {
    var inp = (ctx && ctx.input) || {};
    var curTurn = (gm && gm.turn) || 0;
    var pt = (playerTurn != null) ? playerTurn : curTurn;   // 玩家操作所在回合(engine-first 前的 resolutionTurn=N)
    // ⚠ 命门:engine-first 把 gm.turn 推到 N+1·而玩家操作(朝会/鸿雁/问对)盖的是 N 的章·须按两者都认·否则静默丢弃不进推演
    function _isThisTurn(t) { return t != null && (t === pt || t === curTurn); }
    var L = [];
    var edicts = inp.edicts || [];
    // 根治(2026-06-26)：ctx.input.edicts 在 prep 路径是对象 {political,military,diplomatic,economic,other,decree}(非数组)·
    // 旧码 edicts.length / edicts.slice 对对象失效 → agent「本回合玩家操作」摘要 + 历回 directives 一直取不到当回合诏令·
    // 只剩 memory 旧内容 =「agent 只读第一回合操作」。统一规整成可读行数组 _edArr。
    var _edArr = [];
    if (Array.isArray(edicts)) { _edArr = edicts.slice(); }
    else if (edicts && typeof edicts === 'object') {
      if (edicts.decree) _edArr.push('诏书:' + edicts.decree);
      var _edK = { political: '政', military: '军', diplomatic: '外', economic: '经', other: '他' };
      Object.keys(_edK).forEach(function (k) { if (edicts[k]) _edArr.push(_edK[k] + ':' + edicts[k]); });
    }
    if (_edArr.length) { L.push('▸ 诏令/举措:'); _edArr.slice(0, 12).forEach(function (e) { L.push('   · ' + _brief(e, 140)); }); }
    if (inp.xinglu) L.push('▸ 君上行止:' + _brief(inp.xinglu, 180));
    try {
      var mems = (gm && gm.memorials || []).filter(function (m) { return m && m.reply && (_isThisTurn(m.turn) || _isThisTurn(m._repliedTurn)); });
      if (mems.length) { L.push('▸ 奏疏朱批:'); mems.slice(0, 8).forEach(function (m) { L.push('   · 「' + _brief(m.title, 26) + '」(' + (m.from || '') + ')→' + (/reject|驳/.test(m.status || '') ? '驳:' : '批:') + _brief(m.reply, 70)); }); }
    } catch (e) {}
    try {
      var courts = (gm && gm._courtRecords || []).filter(function (c) { return c && (_isThisTurn(c.turn) || _isThisTurn(c.targetTurn)); });
      if (courts.length) { L.push('▸ 朝会问对:'); courts.slice(0, 3).forEach(function (c) { var tr = ((c.transcript || []).slice(0, 4).map(function (t) { return (t.speaker || '') + ':' + _brief(t.text, 40); }).join(' / ')); L.push('   · ' + _brief(c.topic, 34) + (c.decisions && c.decisions.length ? ('·决:' + c.decisions.map(function (d) { return d.label; }).join('/')) : '') + (tr ? ('〔' + tr + '〕') : '')); }); }
    } catch (e) {}
    try {
      var wh = gm && gm.wenduiHistory;
      if (wh && typeof wh === 'object') {
        var dlg = [];
        Object.keys(wh).forEach(function (nm) { var arr = wh[nm]; if (Array.isArray(arr)) arr.filter(function (e) { return e && _isThisTurn(e.turn); }).slice(-4).forEach(function (e) { dlg.push('   · 与' + nm + ':' + (e.role === 'player' || e.role === 'user' ? '君曰「' : (nm + '曰「')) + _brief(e.content || e.text || '', 70) + '」'); }); });
        if (dlg.length) { L.push('▸ 人物问对(君上召对):'); dlg.slice(0, 10).forEach(function (d) { L.push(d); }); }
      }
    } catch (e) {}
    try {
      var letters = (gm && gm.letters || []).filter(function (l) { return l && _isThisTurn(l.sentTurn); });
      if (letters.length) { L.push('▸ 鸿雁书信:'); letters.slice(0, 6).forEach(function (l) { L.push('   · 致' + (l.to || '') + ':' + _brief(l.content, 60)); }); }
    } catch (e) {}
    // 多回合诏书/行止:滚动存(owner"诏书行止也应多回合读")·按 pt 去重·cap 24·save-lifecycle 持久
    try {
      if ((_edArr.length || inp.xinglu) && pt) {
        if (!Array.isArray(gm._agentRecentDirectives)) gm._agentRecentDirectives = [];
        if (!gm._agentRecentDirectives.some(function (d) { return d && d.turn === pt; })) {
          gm._agentRecentDirectives.push({ turn: pt, edicts: _edArr.slice(0, 12).map(function (e) { return _brief(e, 120); }), xinglu: inp.xinglu ? _brief(inp.xinglu, 180) : '' });
          if (gm._agentRecentDirectives.length > 24) gm._agentRecentDirectives = gm._agentRecentDirectives.slice(-24);
        }
      }
    } catch (e) {}
    if (!L.length) return '';
    return '【本回合玩家操作 · 你的推演必须逐项落实其后果(推演紧扣玩家所为·勿泛泛而谈)】\n' + L.join('\n');
  }

  // ── 弱模型动作脚手架(2026-06·着重加强弱模型)──
  //   真机逮:弱模型(deepseek-v4-flash 等)tool-calling 多步驱动不出任何写(落地0·全程只读 get_overview/list)。
  //   破法:换用它的强项——单发结构化产出「动作清单」(像 LLM 管线每个 sc 都是一次聚焦调用)·
  //         再走正常 _dispatch(同六步验证闸/记账/引擎让步·安全模型不变)。只在 agentic 循环零落地时兜底·强模型自主写则不触发。
  function _safeJSON(raw) {
    if (raw == null) return null;
    if (typeof raw === 'object') return raw;
    var s = String(raw).trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try { return JSON.parse(s); } catch (e) {}
    var a = s.indexOf('{'), b = s.lastIndexOf('}');               // 容错:抓首 { 到末 }
    if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e2) {} }
    return null;
  }

  async function _scaffoldAction(ctx, gm, basis, state) {
    if (typeof root.callAIMessages !== 'function') return 0;
    var WT = TM.Endturn.AgentWriteTools, WT_NAMES = {};
    if (WT && WT.defs) WT.defs().forEach(function (d) { WT_NAMES[d.name] = true; });
    if (!Object.keys(WT_NAMES).length) return 0;                  // 写工具未加载·无从落地
    var p = (ctx && ctx.prompt) || {};
    var situation = (String(p.sysP || '') + '\n' + String(p.tp || '')).trim() || String(basis || '');
    if (!situation) return 0;
    // 系统提示用局势原料(非 agentic 的"勿输出 JSON"包装·此处恰要 JSON)
    //   ⚠ 命门职责分离:玩家做决定(任免/诏令/朱批·过回合前已定·见依据)·agent 只推演后果·绝不替玩家做新决定。
    var sys = '你是当朝宰相级的回合「推演」AI——只推演后果·不替玩家做决定。引擎已结算本回合基础局势(下方依据含真实数字)。玩家本回合的操作(任免/诏令/朱批/朝议/书信)已由玩家做出·见依据。你的任务:推演这些操作引发的**后果**与世界自走的连锁变化·按 JSON 落地为状态变更。\n\n' + situation;
    var user = [
      '请推演本回合的**后果与连锁反应**(玩家的任免/诏令已定·你不重做·只推演其引发的变化 + 各方应对 + 世界自走):',
      '· 财政增减(诏令耗费 / 查抄所得 / 赏赉) · 民心民生 · 关键变量(党争烈度 / 军务等) · 官员境遇(因事问责擢黜·非玩家的任命) · 势力态度。',
      '只输出 JSON(不要任何解释文字),格式:',
      '{"actions":[',
      '  {"tool":"adjust_treasury","delta":-100000,"currency":"money","reason":"后果缘由(负=支出·正=入账/查抄)"},',
      '  {"tool":"adjust_field","path":"minxin","delta":-5,"reason":"后果缘由"},',
      '  {"tool":"set_field","path":"chars.N.mood","value":"忧","reason":"后果缘由"},',
      '  {"tool":"appoint_official","name":"人物名","position":"官职","reason":"仅限因事补缺(顶替阵亡/罢黜者)·非玩家的任命"}',
      ']}',
      '要求:动作 3-8 个·**都是本回合的后果**(不是玩家的新决定)·人名 / path 用上方依据中真实出现的·改国库只用 adjust_treasury。'
    ].join('\n');
    var raw;
    try {
      _show('⟨执政⟩单发裁断·落地诏令…', 70);
      raw = await root.callAIMessages([{ role: 'system', content: sys }, { role: 'user', content: user }], 2800, null, 'primary');
    } catch (e) { try { console.warn('[agent-mode] 动作脚手架调用失败', e); } catch (_) {} return 0; }
    var parsed = _safeJSON(raw);
    var acts = (parsed && Array.isArray(parsed.actions)) ? parsed.actions : [];
    var done = 0;
    for (var i = 0; i < acts.length && i < 8; i++) {
      var a = acts[i] || {};
      if (!a.tool || typeof a.tool !== 'string' || !WT_NAMES[a.tool]) continue;  // 仅放行写工具(不让脚手架碰 finalize/深化·那是 loop 驱动)
      try { await _dispatch(a.tool, a, ctx, state); done++; } catch (_d) {}        // 复用 _dispatch:同验证闸 + _turnReport 记账
    }
    state.scaffoldActions = (state.scaffoldActions || 0) + done;
    state.scaffolded = true;
    return done;
  }

  // DA2·把 agent 的 _turnReport(扁平 path)确定性映射进 GM.turnChanges(Delta 面板桶结构)·
  //   LLM 模式靠 applyAITurnChanges 填 turnChanges→Delta 面板;mode B 走守护写只填 _turnReport→面板空(违反"产出只多不少")。
  //   保守:只映射能干净分类的(chars/facs/核心变量)·结构化账(guoku.* 等)跳过(由 fiscal/topbar 另 render·不污染)。
  //   additive merge(find-or-create·不 clobber 引擎已填的)·全 _agent 标。桶结构锚 tm-dynamic-systems.js:432 / render.js §6。
  function _mapReportToTurnChanges(gm) {
    if (!gm || !Array.isArray(gm._turnReport)) return;
    var tc = gm.turnChanges = gm.turnChanges || {};
    ['variables', 'characters', 'factions', 'parties', 'classes', 'military', 'map'].forEach(function (k) { if (!Array.isArray(tc[k])) tc[k] = []; });
    function _bucketPush(bucket, name, field, oldV, newV, reason) {
      var arr = tc[bucket], ent = null;
      for (var i = 0; i < arr.length; i++) { if (arr[i].name === name) { ent = arr[i]; break; } }
      if (!ent) { ent = { name: name, changes: [], _agent: true }; arr.push(ent); }
      if (!Array.isArray(ent.changes)) ent.changes = [];
      ent.changes.push({ field: field, oldValue: oldV, newValue: (newV !== undefined ? newV : ''), reason: reason || '', _agent: true });
    }
    gm._turnReport.forEach(function (e) {
      if (!e || e.type !== 'change' || !e._agent) return;
      var path = String(e.path || '');
      var mS = path.match(/^chars\/(.+)$/), mD = path.match(/^chars\.(\d+)(?:\.(.+))?$/);
      if (mS || mD) {
        var nm = mS ? mS[1] : ((gm.chars && gm.chars[+mD[1]] && gm.chars[+mD[1]].name) || ('#' + mD[1]));
        var fld = (mD && mD[2]) ? mD[2] : (e._op === 'appoint' ? 'officialTitle' : (e._op === 'dismiss' ? 'officialTitle' : 'state'));
        _bucketPush('characters', nm, fld, e.old, (e.new !== undefined ? e.new : (e._op === 'dismiss' ? '去职' : '')), e.reason);
        return;
      }
      var fS = path.match(/^facs\/(.+)$/), fDt = path.match(/^facs\.(\d+)(?:\.(.+))?$/);
      if (fS || fDt) {
        var fnm = fS ? fS[1] : ((gm.facs && gm.facs[+fDt[1]] && gm.facs[+fDt[1]].name) || ('#' + fDt[1]));
        _bucketPush('factions', fnm, (fDt && fDt[2]) ? fDt[2] : 'state', e.old, e.new, e.reason);
        return;
      }
      // 核心变量(GM.vars 有此 key)→ variables 桶(update-or-push:引擎已填同名则合并 旧值→agent 新值·不丢不重)
      var seg = path.split(/[.\/]/).filter(Boolean).pop();
      if (seg && gm.vars && gm.vars[seg] && e.new !== undefined) {
        var vEx = null;
        for (var vi = 0; vi < tc.variables.length; vi++) { if (tc.variables[vi].name === seg) { vEx = tc.variables[vi]; break; } }
        if (vEx) { vEx.newValue = e.new; if (typeof e.new === 'number' && typeof vEx.oldValue === 'number') vEx.delta = e.new - vEx.oldValue; vEx._agent = true; }
        else { tc.variables.push({ name: seg, oldValue: e.old, newValue: e.new, delta: (typeof e.new === 'number' && typeof e.old === 'number') ? (e.new - e.old) : undefined, _agent: true }); }
        return;
      }
      // 其它(guoku.*/neitang.* 等结构化账)→ 跳过·不污染 Delta(fiscal/topbar 另 render)
    });
  }

  // ── 工具集 + 派发 ──
  function _finalizeDef() {
    return { name: 'finalize_turn', description: '本回合推演与落地全部完成时调用·提交回合史记与摘要(必须忠实反映你实际改动)。', parameters: { type: 'object', properties: { narrative: { type: 'string', description: '本回合史记正文(叙事)' }, summary: { type: 'string', description: '一句话摘要' } }, required: ['summary'] } };
  }
  // 工具调用优化(2026-06-22):循环内只挂「收尾综合」两个深化工具(recall_consolidate 固化记忆 + deepen_narrative 成史记·深度门要的·模型可自调收尾)。
  //   其余 9 个维度/活态深化(factions/economy/military/world/npcs/relations/letters/court/cognition)是 **auto-suite 收尾兜底**的活——
  //   模型循环里几乎不自调·全挂徒增 ~9 工具 schema/轮(实测深化表 ~2376 字·占 allTools 1/5)。收尾照样全跑→零能力损失·纯省 token。
  var _LOOP_DEPTH = { recall_consolidate: 1, deepen_narrative: 1 };
  function _loopDepthDefs() {
    var DT = TM.Endturn.AgentDepthTools;
    if (!DT) return [];
    return DT.defs().filter(function (d) { return _LOOP_DEPTH[d.name]; });
  }
  function _allTools() {
    var RT = TM.Endturn.AgentReadTools, WT = TM.Endturn.AgentWriteTools;
    var defs = [];
    if (RT) defs = defs.concat(RT.defs());
    if (WT) defs = defs.concat(WT.defs());
    defs = defs.concat(_loopDepthDefs());    // 只 2 个收尾综合深化·维度深化交 auto-suite
    defs.push(_finalizeDef());
    return defs;
  }
  // DA-Q3·首轮"察看"工具集:只读工具 + finalize(写/深化工具定义 ~轮2 起再挂)·缩首轮 prompt 治超窗。
  //   首轮 ≈ LLM 输入大小(LLM sc1 本无工具定义);轮≥2 才挂全量。读工具仍是按需超集·不削能力。
  function _readToolsOnly() {
    var RT = TM.Endturn.AgentReadTools;
    var defs = [];
    if (RT) defs = defs.concat(RT.defs());
    defs.push(_finalizeDef());
    return defs;
  }
  // 防空转(2026-06)·连续只读不动手时降读工具·只挂写+深化+finalize·逼模型落地
  //   (真机验逮:弱模型 deepseek-v4-flash 每轮重复 get_overview 原地打转·12 轮空回合)
  function _actionToolsOnly() {
    var WT = TM.Endturn.AgentWriteTools;
    var defs = [];
    if (WT) defs = defs.concat(WT.defs());
    defs = defs.concat(_loopDepthDefs());    // 同 _allTools·只 2 个收尾综合深化(维度深化交 auto-suite)
    defs.push(_finalizeDef());
    return defs;
  }
  // 工作流程·动手阶段工具集:读 + 写 + finalize(不挂深化工具)·结构化"察看→落地→深化"·
  //   深化由 loop 的 auto-suite 兜底·故未动手前不必给深化工具(减杂讯+省 token·已动手后 _allTools 才挂深化)。
  function _actTools() {
    var RT = TM.Endturn.AgentReadTools, WT = TM.Endturn.AgentWriteTools;
    var defs = [];
    if (RT) defs = defs.concat(RT.defs());
    if (WT) defs = defs.concat(WT.defs());
    defs.push(_finalizeDef());
    return defs;
  }

  // T2·健壮参数:弱模型常把数字传成字符串、键名传变体——一处容错·减少工具调用失败/空转
  function _coerceArgs(input) {
    if (!input || typeof input !== 'object') return input || {};
    // 数字字段:纯数字字符串 → 数字(value 不碰·set_field 值可任意类型)
    ['delta', 'amount', 'soldiers', 'soldiersDelta', 'index', 'level', 'turns', 'cost', 'stopAfterTurn', 'count', 'limit', 'fromTurn', 'toTurn', 'days'].forEach(function (k) { var v = input[k]; if (typeof v === 'string' && v.trim() !== '' && isFinite(+v)) input[k] = +v; });
    // 常见键名别名(弱模型错传)
    if (input.path === undefined) { if (input.field !== undefined) input.path = input.field; else if (input.key !== undefined) input.path = input.key; }
    if (input.armyName === undefined && input.army !== undefined) input.armyName = input.army;
    if (input.dimension === undefined && (input.dim !== undefined || input.topic !== undefined)) input.dimension = input.dim || input.topic;
    if (input.name === undefined && input.person !== undefined) input.name = input.person;       // appoint:person→name
    if (input.position === undefined && input.office !== undefined) input.position = input.office; // appoint:office→position
    if (input.region === undefined && input.province !== undefined) input.region = input.province;
    return input;
  }

  async function _dispatch(name, input, ctx, state) {
    var RT = TM.Endturn.AgentReadTools, WT = TM.Endturn.AgentWriteTools, DT = TM.Endturn.AgentDepthTools;
    var gm = _GM(ctx);
    input = _coerceArgs(input || {});   // T2 健壮参数
    if (name === 'finalize_turn') {
      var gate = _depthGate(gm, state);
      var cap = (root.P && root.P.conf && root.P.conf.agentModeFinalizeRejectCap) || 4;
      if (!gate.ok && (state.finalizeRejects || 0) < cap) {
        state.finalizeRejects = (state.finalizeRejects || 0) + 1;
        return { ok: false, name: name, text: '【深度未达·暂不可收尾(' + state.finalizeRejects + '/' + cap + ')】' + gate.reason + '。请继续用相应深化/读写工具深推后再 finalize_turn。' };
      }
      state.finalized = true;
      if (gate.ok) state.depthOk = true; else state.depthIncomplete = gate.reason;
      if (input && input.summary) state.summary = input.summary;
      // ★2026-07-01·finalize 叙事在源头归一字面转义(AI 常把段落分隔写成字面 "\n\n"、或过度转义 \\n)。
      //   此 narrative 是「deepen_narrative 缺席时」渲染回落的时政记·也进 _turnReport/喂 AI 记忆·
      //   不归一则字面 \n\n 既直显、又成 few-shot 污染让 AI 下回合照抄。转真换行·纯文本清洗零结构改动。
      if (input && input.narrative) {
        state.narrative = String(input.narrative)
          .replace(/\\r\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\n/g, '\n')
          .replace(/\\t/g, '  ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
      return { ok: true, name: name, text: '(已收尾)' + (gate.ok ? '' : '·注:深度未尽(' + gate.reason + ')') };
    }
    if (RT && RT.isToolName(name)) return await RT.handle(name, input, ctx);
    if (WT && WT.isToolName(name)) { state.writeAttempts++; var r = await WT.handle(name, input, ctx); if (r && r.ok) state.writeOk++; return r; }
    if (DT && DT.isToolName(name)) {
      var d = await DT.handle(name, input, ctx);
      if (d && d.ok) {
        if (!state.depthTools) state.depthTools = {};
        state.depthTools[name] = (state.depthTools[name] || 0) + 1;
      } else {
        if (!state.depthFailed) state.depthFailed = [];
        if (state.depthFailed.indexOf(name) < 0) state.depthFailed.push(name);
      }
      return d;
    }  // 深化成功只记深度覆盖·不冒充守护写落地
    // T3·未知工具→列可用工具引导纠正(弱模型常拼错名)
    var _avail = []; try { if (RT) _avail = _avail.concat(RT.defs().map(function (t) { return t.name; })); if (WT) _avail = _avail.concat(WT.defs().map(function (t) { return t.name; })); _avail.push('finalize_turn'); } catch (e) {}
    return { ok: false, name: name, text: '✗ 未知工具「' + name + '」。可用工具:' + _avail.join(' / ') + '。请用其中之一。' };
  }

  function _synthNarrative(gm) {
    var log = (gm && Array.isArray(gm._agentWriteLog)) ? gm._agentWriteLog : [];
    if (!log.length) return '本回合无显著变化。';
    var bits = log.slice(0, 12).map(function (e) { return (e.reason || e.path); });
    return '本回合:' + bits.join('；') + '。';
  }

  // ── S5 安全闭环:快照 / 状态自检 / 回滚 ──
  function _snapshot(gm) {
    try {
      if (typeof root.deepClone === 'function') return root.deepClone(gm);
      return JSON.parse(JSON.stringify(gm));
    } catch (e) { try { console.warn('[agent-mode] 回合快照失败·回滚将不可用', e); } catch (_) {} return null; }
  }
  // ── S8 结算可重入·补全回滚:引擎结算除改 GM 外·还累加两个「活在 GM 之外的 module 级单例」——
  //   AccountingSystem.ledger(收支账本 push+=)与 StateCouplingSystem.previousValues(耦合基线)。
  //   deepClone(GM) 的快照/回滚盖不到它们·bail 后 LLM 模式重跑结算会二次累加(账本双记/耦合基线污染悄悄漂进已提交回合)。
  //   → 随 GM 快照一并快照这两个单例·回滚时一并还原·让「engine-first→rollback→LLM 重跑」真正干净。
  function _acctMod() { try { if (root && root.AccountingSystem) return root.AccountingSystem; } catch (_) {} try { if (typeof AccountingSystem !== 'undefined') return AccountingSystem; } catch (_) {} return null; }
  function _coupMod() { try { if (root && root.StateCouplingSystem) return root.StateCouplingSystem; } catch (_) {} try { if (typeof StateCouplingSystem !== 'undefined') return StateCouplingSystem; } catch (_) {} return null; }
  function _snapshotExternals() {
    var ext = {};
    try { var A = _acctMod(); if (A && typeof A.getLedger === 'function') ext.acct = A.getLedger(); } catch (_) {}
    try { var S = _coupMod(); if (S && typeof S.getPreviousValues === 'function') ext.coupling = S.getPreviousValues(); } catch (_) {}
    return ext;
  }
  function _restoreExternals(ext) {
    if (!ext) return;
    try { var A = _acctMod(); if (ext.acct && A && typeof A.restoreLedger === 'function') A.restoreLedger(ext.acct); } catch (_) {}
    try { var S = _coupMod(); if (ext.coupling && S && typeof S.restorePreviousValues === 'function') S.restorePreviousValues(ext.coupling); } catch (_) {}
  }
  // 原地还原(保 gm 引用不变·ctx.GM/root.GM 仍有效)·并清 _systemsRan 让 mode a 的 systems 步重新跑引擎·
  // 并还原 GM 外的 module 单例(extSnap·可选·旧 3 参调用向后兼容=不动单例)。
  function _rollback(gm, snapshot, ctx, extSnap) {
    if (!gm || !snapshot) return false;
    try {
      Object.keys(gm).forEach(function (k) { delete gm[k]; });
      Object.keys(snapshot).forEach(function (k) { gm[k] = snapshot[k]; });
      if (ctx && ctx.input) { delete ctx.input._systemsRan; }
      _restoreExternals(extSnap);   // S8·撤销引擎结算对账本/耦合基线单例的累加·补全回滚
      return true;
    } catch (e) { try { console.warn('[agent-mode] 回滚失败', e); } catch (_) {} return false; }
  }
  // 核心数值字段可能是「数字」(部分剧本)或「结构化对象」(fiscal-engine 形状·有 .balance)·只在真坏时判
  function _numFieldBad(v) {
    if (typeof v === 'number') return !isFinite(v);                                   // 数字形:NaN/Inf 即坏
    if (v && typeof v === 'object' && typeof v.balance === 'number') return !isFinite(v.balance); // 对象形:查 .balance
    return false;                                                                    // 其它(对象无 balance/缺失)→ 保守不判坏
  }
  function _selfCheck(gm) {
    var problems = [];
    if (!gm) return { ok: false, problems: ['无存档'] };
    if (typeof gm.turn !== 'number' || !isFinite(gm.turn)) problems.push('turn 非法');
    ['guoku', 'neitang'].forEach(function (k) { if (gm[k] != null && _numFieldBad(gm[k])) problems.push(k + ' 数值异常'); });
    ['chars', 'facs'].forEach(function (k) { if (gm[k] != null && !Array.isArray(gm[k])) problems.push(k + ' 被毁(非数组)'); });
    if (!Array.isArray(gm._turnReport) || gm._turnReport.length === 0) problems.push('_turnReport 空(无产出)');
    return { ok: problems.length === 0, problems: problems };
  }

  // ── 主循环 ──
  async function run(ctx) {
    var gm = _GM(ctx);
    var cawt = root.callAIWithTools;
    // 前置(快照前):能力缺失 → 回落 LLM(无须回滚)
    if (!gm) return { ok: false, fallback: true, reason: '无存档' };
    if (typeof cawt !== 'function') return { ok: false, fallback: true, reason: 'callAIWithTools 未加载·回落 LLM' };
    if (!TM.Endturn.AgentReadTools || !TM.Endturn.AgentWriteTools) return { ok: false, fallback: true, reason: '读/写工具未加载·回落 LLM' };

    var P = root.P || {};
    var resolutionTurn = gm.turn || 0;

    // ── S5 甲案:快照 → 引擎先算硬核基线 ──
    var snapshot = _snapshot(gm);
    var _extSnap = _snapshotExternals();   // S8·结算前一并快照 GM 外的 module 单例(账本/耦合基线)·供回滚补全
    var engineRan = false;
    var engineDims = {};
    // 回落兜底:engineRan 时先回滚再回落(让 mode a 在干净态重跑)
    function bail(reason) { if (engineRan && snapshot) _rollback(gm, snapshot, ctx, _extSnap); return { ok: false, fallback: true, reason: reason }; }

    if (snapshot && typeof root._endTurn_updateSystems === 'function') {
      try {
        _show('⟨执政⟩引擎结算·硬核基线…', 40);          // 加载层:agent-engine 拍
        var tr = (typeof root.getTimeRatio === 'function') ? root.getTimeRatio() : 0;
        var queueResult = await root._endTurn_updateSystems(tr, '');     // 引擎先算硬核基线(turn++ + 50 tick)
        if (ctx) { ctx.results = ctx.results || {}; ctx.results.queueResult = queueResult || null; }
        engineDims = _engineDiffDims(snapshot, gm);
        if (ctx && ctx.input) ctx.input._systemsRan = true;  // 让后续 systems 步幂等跳过引擎 tick(防双跑)
        engineRan = true;
      } catch (engErr) {
        // 引擎在 await 中抛错:engineRan 尚未置 true·但引擎可能已部分 mutate(turn++ + 账本/耦合单例累加)→显式回滚(含单例)
        if (snapshot) _rollback(gm, snapshot, ctx, _extSnap);
        return { ok: false, fallback: true, reason: '引擎基线(engine-first)失败·回滚回落 LLM:' + (engErr && engErr.message) };
      }
    }
    // (snapshot 失败 → 不跑 engine-first·退回 agent 在当前态推演·不致命·systems 步仍会正常跑引擎)

    // 玩家移动令确定性兜底(跨模式复用 LLM 同一 reconcile)·治"人事调动诏书人物原地不动"顽疾:
    //   prep 已 extractEdictMovements → GM._turnMoveCommands(确定性捕获"令X赴/移动到Y"·含 instant 标);
    //   agent 模式不走 applier(不调此 reconcile)→ 这里显式调一次·应用玩家移动令(即时令当回合即抵·否则补启行程)·不靠 agent 自觉调 move_character。
    try { if (typeof root._reconcilePlayerMovements === 'function') root._reconcilePlayerMovements(gm); } catch (_mvE) { try { console.warn('[agent-mode] 玩家移动对账失败(不阻断)', _mvE); } catch (_) {} }

    _show('⟨执政⟩察看局面…', 47);                       // 加载层:agent-perceive 拍
    var maxRounds = (P.conf && P.conf.agentModeMaxRounds) || 12;  // D1:上调容纳深度门逼出的多轮深推
    var perRoundCap = 6;
    // 【S9 依据同源】基线复用 LLM 管线的 prompt builder 产出(ctx.prompt.sysP+tp)→ LLM 那边任何依据更新此处自动同步
    //   (落地契约「接收只多不少」:LLM 全量依据=地板·读工具按需深查=超集)·build 不可用/失败→回落薄 baseline。
    var basis = (await _basisDossier(ctx, gm)) || _buildTurnPrompt(ctx, gm);
    // DA-Q3·跨回合记忆地板 push 进 transcript(命门「记忆不弱于 LLM」·读工具是其上超集)·空(turn1/缺失)则不占位
    var _memDossier = _memoryDossier(gm);
    // 玩家操作摘要:stash 到 gm 供深化工具 ground(命门:据玩家操作推演)·并置于 transcript 显要处
    gm._turnPlayerOps = _playerOpsDigest(ctx, gm, resolutionTurn);   // 传玩家回合 N(engine-first 后 gm.turn=N+1·玩家操作盖 N 章)
    // 诊断(2026-06-26)：确认 agent 每回合读到的玩家操作不再陈旧(修复后应逐回合变化·不再恒为第一回合)
    try { console.log('[agent操作诊断] 回合' + resolutionTurn + '(gm.turn=' + gm.turn + ') 玩家操作摘要前160:', (gm._turnPlayerOps ? String(gm._turnPlayerOps).slice(0, 160) : '(空)')); } catch (_dgE) {}
    // 切片1·自我反思:把滚动偏差画像(上回合末反思更新)注入 basis·让本回合推演时就校正系统性盲点(命门:越玩越可信)·开关关/无偏差则空
    var _biasInject = '';
    try { if (_agentSelfReflectOn(P) && TM.ReflectionAgent && typeof TM.ReflectionAgent.formatBiasForSc0 === 'function') _biasInject = TM.ReflectionAgent.formatBiasForSc0(gm) || ''; } catch (_biE) {}
    // 切片3·跨回合一致·诏令督查:把在办活诏令+近期既定事实注入 basis(推演接续上回合不失忆/不矛盾)·开关关/无活诏令则空
    var _edictDossier = '';
    try { if (_agentEdictOversightOn(P)) { _registerPlayerEdicts(gm, ctx, resolutionTurn); _edictDossier = _activeEdictsDossier(gm) || ''; } } catch (_edE) {}
    // 切片4·冷门动作深查:扫玩家本回合举措非常规性→注入深查指引(硬核×自由命门交点)·开关默认关·寻常/失败则空
    var _anomalyN = '';
    try { if (_agentAnomalyOn(P)) { var _anRes = await _anomalyScan(ctx, gm); if (_anRes) { _anomalyN = _anomalyNudge(_anRes); gm._agentAnomaly = _anRes; } } } catch (_anE) {}
    var _timeCtx = _timeContext(gm, resolutionTurn);   // 本回合时间(纪元年月+历时+时间相关后果指引)·显要处·让 agent 推演不脱离时间
    var baseTranscript = _buildSystemPrompt() + (_biasInject ? '\n' + _biasInject : '') + (_timeCtx ? '\n' + _timeCtx : '') + '\n\n' + (gm._turnPlayerOps ? gm._turnPlayerOps + '\n\n' : '') + (_anomalyN ? _anomalyN + '\n\n' : '') + (_memDossier ? _memDossier + '\n\n' : '') + (_edictDossier ? _edictDossier + '\n\n' : '') + basis; // 常量基线(系统词+偏差校正+本回合时间+玩家操作+冷门深查+跨回合记忆+在办诏令+依据)·不随轮数膨胀
    var state = { finalized: false, summary: '', narrative: '', writeAttempts: 0, writeOk: 0, rounds: 0, depthTools: {}, depthFailed: [], finalizeRejects: 0, engineDims: engineDims };
    var _stall = 0;  // 连续"只察看不动手"轮数·防空转(真机逮弱模型重复 get_overview 原地打转)
    var roundLog = [];  // 上下文瘦身:滚动存每轮工具结果·call 时只带最近 2 轮全文 + 更早轮 1 行摘要(token 不随轮数膨胀)
    var _kRecent = (P.conf && P.conf.agentTranscriptRecentRounds) || 2;  // 带全文的近轮数(可配)

    try {
      for (var round = 1; round <= maxRounds; round++) {
        state.rounds = round;
        // 工作流程·阶段化工具曝光:首轮察看(只读)→ 防空转停摆(写+深化逼落地)→ 未动手:动手阶段(读+写·不挂深化·聚焦落地)→ 已动手:全量(挂深化·进深化阶段)
        //   深化由 auto-suite 兜底·故未落地前不必给深化工具(减杂讯+省 token);深度门/能力不丢(已动手即给全)。
        var tools = (round === 1) ? _readToolsOnly()
          : (_stall >= 2 ? _actionToolsOnly()
            : (state.writeOk < 1 ? _actTools()
              : _allTools()));
        // 本轮催办(首轮纯察看不催·轮≥2 才催)·批量提示减往返(刀4)
        var _nudge = (round === 1) ? ''
          : ((_stall >= 1)
            ? '\n\n⚠ 你已多轮只察看未落地。**立刻停止重复 get_overview/查看**·本轮必须动手:set_field/adjust_field/adjust_treasury/appoint_official 落地玩家诏令与本回合之事·或 deepen_*/recall_consolidate 深化·或 finalize_turn 收尾。再空转将判失败回落 LLM。'
            : '\n\n你已览全局·勿重复 get_overview。**本轮可一次调用多个工具批量落地**(尽量单轮多干·减少往返):落地玩家诏令与本回合之事·再 deepen_*/recall_consolidate 深化·完成后 finalize_turn。');
        // 上下文瘦身(刀2):基线 + 最近 N 轮全文 + 更早轮 1 行摘要(勿重复已做)·token 不随轮数线性涨
        var _tail = '';
        if (roundLog.length) {
          var _older = (roundLog.length > _kRecent) ? ('【前 ' + (roundLog.length - _kRecent) + ' 轮已:落地 ' + state.writeOk + ' 笔·深化 ' + Object.keys(state.depthTools).length + ' 项·勿重复已做之事】\n\n') : '';
          var _recent = roundLog.slice(-_kRecent).map(function (rr) { return '【第' + rr.round + '轮·工具结果】\n' + rr.text; }).join('\n\n');
          _tail = '\n\n' + _older + _recent;
        }
        var callTranscript = baseTranscript + _tail + _nudge;
        // 加载层(刀3·owner:工作流轨迹显示在加载动画里)·须保「⟨执政⟩亲裁」前缀(progress 引擎据此匹配 agent-loop 拍)·阶段信息放后缀
        _show('⟨执政⟩亲裁·第' + round + '轮·' + (round === 1 ? '察看朝局' : (state.writeOk < 1 ? '落地诏令后果' : '深化推演')) + '…', 54 + Math.min(round / maxRounds, 0.97) * 30);
        var resp;
        try {
          resp = await cawt(callTranscript, tools, {
            maxTok: (P.conf && P.conf.agentModeMaxTok) || 2400,
            tier: 'primary', priority: 'normal', timeoutMs: 180000, maxRetries: 1, id: 'agent_turn:r' + round
          });
        } catch (e) {
          if (round === 1) return bail('agent 调用失败(首轮)·回落 LLM:' + (e && e.message));
          break;
        }
        if (!resp) { if (round === 1) return bail('agent 无响应(首轮)·回落 LLM'); break; }
        if (resp.text && !state.narrative) state.narrative = resp.text;
        var calls = Array.isArray(resp.toolCalls) ? resp.toolCalls.slice(0, perRoundCap) : [];
        if (!calls.length) break;
        var _wB = state.writeAttempts, _dB = Object.keys(state.depthTools || {}).length;
        var resultLines = [];
        for (var i = 0; i < calls.length; i++) {
          var c = calls[i] || {};
          if (!c.name) continue;
          var r = await _dispatch(c.name, c.input || {}, ctx, state);
          resultLines.push('· ' + c.name + '(' + _brief(c.input || {}, 80) + ') ⇒ ' + String((r && r.text) || '').slice(0, 500));
          if (state.finalized) break;
        }
        roundLog.push({ round: round, text: resultLines.join('\n') });  // 滚动日志(瘦身用·下轮只带最近 N)
        if (state.finalized) break;
        // 防空转:本轮有无实质动作(写/深化)·轮≥2 连续无动作 → 累加 _stall(达 2 上方降读工具逼落地)
        var _acted = (state.writeAttempts > _wB) || (Object.keys(state.depthTools || {}).length > _dB);
        if (round >= 2 && !_acted) _stall++; else _stall = 0;
        // 早退动作循环省钱:连续 3 轮停摆(无写无深化·_acted 会重置 _stall·有进展则不触发)→ 退出·转脚手架 + 自动收尾·不白烧 maxRounds(弱模型常态)
        if (_stall >= 3) break;
      }
    } catch (loopErr) {
      if (state.writeOk === 0 && Object.keys(state.depthTools || {}).length === 0) return bail('agent 循环异常且无实质落地·回落 LLM:' + (loopErr && loopErr.message));
    }

    // ── 弱模型动作脚手架兜底(2026-06·着重加强弱模型)──
    //   agentic 循环落地不足(弱模型常态·真机逮"落地0~1·全程只读/偶写1笔")→ 单发结构化补本回合动作(它的强项)·走正常 _dispatch(同验证闸)。
    //   给弱模型一个 productive 动作阶段(真 mechanical 决策·非仅靠下游 post-ai-edict + 深化叙述)·再走下方深化套件。
    //   阈值 agentScaffoldMinWrites(默认 2):写≥2 视为模型已engaging则跳过(强模型路径零影响);未收尾才补(已 finalize 尊重之)。
    var _scaffoldMin = (P.conf && P.conf.agentScaffoldMinWrites) || 2;
    if (!state.finalized && state.writeOk < _scaffoldMin && !state.scaffolded) {
      _show('⟨执政⟩拟定本回合举措·落地诏令后果…', 80);   // 可观测(刀3):脚手架阶段也报加载层
      try { await _scaffoldAction(ctx, gm, basis, state); } catch (_sfE) { try { console.warn('[agent-mode] 动作脚手架失败(不阻断)', _sfE); } catch (_) {} }
    }

    // ── 自动覆盖收尾·model-agnostic(2026-06·让弱模型也能正常用·非回落)──
    //   思路:loop 当编排者·模型只当内容生成器。弱模型弱在 agentic 多步编排(自决何时 deepen/finalize)·
    //   强在单发生成(像 LLM 管线每个 sc)。故只要 engine-first 跑过(世界已推进·下游 post-ai-edict 已落玩家诏令)·
    //   loop 就自动补齐深化套件(史记/记忆/势力/经济/军事/NPC·各一次单发·弱模型胜任)再收尾·保证完整富回合。
    //   模型已自调的不重复;agentic 强模型多走的额外动作是 bonus。
    var _depthN = Object.keys(state.depthTools || {}).length;
    // ⚠ 命门:循环已不挂维度深化工具(省 token)→ 维度深化补全必须**无论模型是否自收尾都跑**(否则模型自 finalize 后势力/经济/军事深析永不生成)。
    //   已做的(模型自调的 recall/narrative)不重复·自适应跳空维度。收尾(finalized/summary)另在下方·只在模型没自收尾时补。
    if (engineRan || state.writeOk > 0 || _depthN > 0) {
      var _DTac = TM.Endturn.AgentDepthTools;
      if (_DTac) {
        // 顺序:先记忆固化(状态盘供叙事)→ 各维度深析(势力/经济/军事/NPC/世界·覆盖脊柱)→ 最后史记(综合成文)
        var _suite = ['recall_consolidate', 'deepen_factions', 'deepen_economy', 'deepen_military', 'deepen_npcs', 'deepen_relations', 'deepen_letters', 'deepen_court', 'deepen_world', 'deepen_narrative'];
        // 自适应:地板工具(记忆/NPC/世界/史记/朝务)永远跑;维度专项(势力/经济/军事/关系/书信)仅本回合该维度真有活动才跑。agentAdaptiveDeepen=false 关回全跑。
        //   deepen_court(御案时政+求见)入地板——世界向案头汇聚的待决事务每回合都该演化(无则返回空·不强凑);deepen_letters 门控 relations(人际有动静才生书信)。
        var _floorDeepen = { recall_consolidate: 1, deepen_npcs: 1, deepen_world: 1, deepen_narrative: 1, deepen_court: 1 };
        var _gateDim = { deepen_factions: 'faction', deepen_economy: 'fiscal', deepen_military: 'military', deepen_relations: 'relations', deepen_letters: 'relations' };
        var _adaptiveDeepen = !(P.conf && P.conf.agentAdaptiveDeepen === false);
        var _activeD = _adaptiveDeepen ? _activeDims(gm, state) : null;
        state.deepenSkipped = [];
        // 工具调用优化(2026-06):auto-suite 三相——recall 先(记忆/状态盘供叙事)→ 中段独立维度深析**并行**(墙钟大降·AI 队列自限真并发)→ 史记后(综合 _turnReport 成文)。
        //   各深析写不同 gm 字段(_turnReport 为 append·JS 单线程·各 resolve 回调不交错→无竞态);每工具自带跳过+try/catch·一败不累及全批。只有 ok=true 才记 depthTools 覆盖，失败进 deepenFailed。
        function _runOneDeepen(_tn) {
          if (state.depthTools[_tn]) return Promise.resolve();
          if (_adaptiveDeepen && _gateDim[_tn] && !(_activeD && _activeD[_gateDim[_tn]])) {
            state.deepenSkipped.push(_tn);
            _show('⟨执政⟩' + (_WF_SKIP[_tn] || (_tn + '·略过')) + '…', 85);   // 可观测保留:加载层显示跳过文案(本回合该维度无动静)·并行化不丢工作流轨迹
            return Promise.resolve();
          }
          return Promise.resolve().then(function () { return _DTac.handle(_tn, {}, ctx); })
            .then(function (_dr) {
              if (_dr && _dr.ok) state.depthTools[_tn] = (state.depthTools[_tn] || 0) + 1;
              else if (state.depthFailed.indexOf(_tn) < 0) state.depthFailed.push(_tn);
            })
            .catch(function (_e1) {
              try { console.warn('[agent-mode] 自动深化失败(不阻断):' + _tn, _e1); } catch (_) {}
              if (state.depthFailed.indexOf(_tn) < 0) state.depthFailed.push(_tn);
            });
        }
        var _midParallel = _suite.filter(function (_tn) { return _tn !== 'recall_consolidate' && _tn !== 'deepen_narrative'; });
        _show('⟨执政⟩固化记忆·理清脉络…', 82);
        await _runOneDeepen('recall_consolidate');                               // 相一:记忆固化(状态盘供叙事·必须先于史记)
        var _parDo = _midParallel.filter(function (_tn) { return !state.depthTools[_tn] && !(_adaptiveDeepen && _gateDim[_tn] && !(_activeD && _activeD[_gateDim[_tn]])); });
        if (_parDo.length) _show('⟨执政⟩并行深析·' + _parDo.map(function (_tn) { return (_WF_LABEL[_tn] || _tn); }).join(' / ') + '…', 86);
        await Promise.all(_midParallel.map(_runOneDeepen));                      // 相二:中段独立维度并行(势力/经济/军事/群臣/关系/书信/朝务/天下)
        _show('⟨执政⟩史官落笔成章…', 92);
        await _runOneDeepen('deepen_narrative');                                 // 相三:史记综合成文(读全 _turnReport·必须最后)
      }
      // 收尾:模型没自收尾才补(尊重模型的 finalize_turn·其 summary/narrative 已设;模型自收尾时 autoClosed 留 false)
      if (!state.finalized) {
        state.finalized = true;
        state.autoClosed = true;  // 标记:loop 自动收尾(弱模型/模型未自主收尾)
        if (!state.summary) { var _ch0 = gm._agentChronicle || {}; state.summary = _ch0.szjSummary || _ch0.szjTitle || '本回合推演'; }
      }
      _depthN = Object.keys(state.depthTools || {}).length;
    }

    // 退化保护:连引擎都没跑(engine-first 失败)+ 模型零产出 → 无可叙述 → 回落 LLM(极少数·非弱模型常态)
    if (!state.finalized && state.writeOk === 0 && _depthN === 0) {
      return bail('agent 无实质产出且引擎未跑·无可叙述·回落 LLM');
    }

    _show('⟨执政⟩撰史定章…', 86);                       // 加载层:agent-narrate 拍
    // 叙述焊死:确保 _turnReport 有 narrative(优先 agent 的·否则从实际改动反推)
    if (!Array.isArray(gm._turnReport)) gm._turnReport = [];
    var hasNarr = gm._turnReport.some(function (e) { return e.type === 'narrative'; });
    var narrative = state.narrative || _synthNarrative(gm);
    if (!hasNarr && narrative) gm._turnReport.unshift({ type: 'narrative', text: narrative, turn: gm.turn || 0, _agent: true });
    if (state.summary) gm._turnReport.push({ type: 'summary', text: state.summary, turn: gm.turn || 0, _agent: true });

    // ── 切片2·内容质量闸(成文后·提交前审查因果/信史/一致·不过则一轮定向修补史记)·开关默认关·失败降级提交原文 ──
    if (_agentQualityGateOn(P)) {
      try { var _qg = await _qualityGate(ctx, gm, state, narrative); if (_qg && _qg.narrative) narrative = _qg.narrative; } catch (_qgE) { try { console.warn('[agent-mode] 质量闸失败(不阻断·降级提交原文)', _qgE); } catch (_) {} }
    }

    // ── S5 状态自检 → 过则提交·崩则回滚回落 LLM ──
    var chk = _selfCheck(gm);
    if (!chk.ok) {
      return bail('状态自检未过·回滚回落 LLM:' + chk.problems.join('；'));
    }

    // DA2·把守护写的 _turnReport 确定性映射进 GM.turnChanges → Delta 面板(人物/势力/变量变动)可见·与 LLM 同口径·失败不阻断
    try { _mapReportToTurnChanges(gm); } catch (e) { try { console.warn('[agent-mode] turnChanges 映射失败(不影响提交)', e); } catch (_) {} }

    // 覆盖脊柱 gap(观测·软)+ 回合元信息
    var gaps = _detectSpineGaps(gm, state);
    gm._agentSpineGaps = gaps;
    gm._agentResolutionTurn = resolutionTurn;
    gm._agentTurnMeta = { rounds: state.rounds, writeOk: state.writeOk, writeAttempts: state.writeAttempts, finalized: state.finalized, autoClosed: !!state.autoClosed, scaffolded: !!state.scaffolded, scaffoldActions: state.scaffoldActions || 0, engineFirst: engineRan, resolutionTurn: resolutionTurn, spineGaps: gaps, turn: gm.turn || 0, finalizeRejects: state.finalizeRejects || 0, depthTools: state.depthTools || {}, deepenSkipped: state.deepenSkipped || [], deepenFailed: state.depthFailed || [], engineDims: state.engineDims || {}, depthOk: !!state.depthOk, depthIncomplete: state.depthIncomplete || null };
    try { console.log('[agent-mode] 回合 ' + resolutionTurn + '→' + (gm.turn || 0) + ' 完成 · 引擎先=' + engineRan + ' · 轮' + state.rounds + ' · 落地' + state.writeOk + '/' + state.writeAttempts + ' · 脊柱缺口[' + gaps.join('、') + ']'); } catch (_) {}

    // ── D7 产出焊缝:把 agent 产出映射成史记弹窗渲染器(_endTurn_render)期望的富结构 ──
    //   渲染器读 aiResult.shizhengji/zhengwen/playerStatus/playerInner/szjTitle/szjSummary/turnSummary/shiluText/hourenXishuo/personnelChanges 等;
    //   不映射则弹窗主体+大半组成部分空(违反"产出只多不少")。有 deepen_narrative 产的 _agentChronicle 则用之·否则 narrative 兜底。
    var _ch = gm._agentChronicle || {};
    // ⚠ _op 实际值:语义写工具(write-tools)报 'appoint'/'dismiss'(非 'appoint_official')·兼容两形(集成测实测炸出·d7 此前预置数据掩盖)
    var _personnel = (Array.isArray(gm._turnReport) ? gm._turnReport : []).filter(function (e) { return e && (e._op === 'appoint' || e._op === 'dismiss' || e._op === 'appoint_official' || e._op === 'dismiss_official'); }).map(function (e) { var _dis = /dismiss/.test(e._op || ''); return { name: String(e.path || '').replace(/^chars[\/.]/, '').replace(/^人事·?/, ''), change: e.reason || '', action: _dis ? 'dismiss' : 'appoint', _agent: true }; });
    var aiResult = {
      agentMode: true,
      shizhengji: _ch.shizhengji || narrative || '',
      zhengwen: _ch.zhengwen || '',
      playerStatus: _ch.playerStatus || '',
      playerInner: _ch.playerInner || '',
      turnSummary: _ch.szjSummary || state.summary || '',
      szjTitle: _ch.szjTitle || '',
      szjSummary: _ch.szjSummary || state.summary || '',
      shiluText: _ch.shiluText || '',
      hourenXishuo: _ch.hourenXishuo || '',
      personnelChanges: _personnel,
      suggestions: _ch.suggestions || [],
      summary: state.summary, narrative: narrative, writeOk: state.writeOk, rounds: state.rounds, engineFirst: engineRan, spineGaps: gaps
    };

    // ── 切片1+3·回合末后台 agent **并行**(自我反思 + 诏令督查·互不依赖·写不同 gm 字段·并发省墙钟·均后台优先·失败不阻断提交·开关默认关)──
    //   反思:跨回合比对"上回合推演 vs 本回合实际(_turnReport)"→更新偏差画像供下回合 basis。督查:复用 TM.EdictOversight 跨回合真评估活诏令(无活诏令内部跳过不耗调用)。
    var _postJobs = [];
    if (_agentSelfReflectOn(P) && TM.ReflectionAgent && typeof TM.ReflectionAgent.run === 'function') {
      var _reflThinking = (narrative || '') + (state.summary ? ('\n摘要:' + state.summary) : '');   // 本回合推演叙事+摘要作"预测"基线;实际由 _actualStructured 回落读 _turnReport
      _postJobs.push(Promise.resolve().then(function () { return TM.ReflectionAgent.run(gm, { thinking: _reflThinking, tier: 'primary', maxTok: 1600, timeoutMs: 45000 }); }).catch(function (_reflE) { try { console.warn('[agent-mode] 自我反思失败(不阻断提交)', _reflE); } catch (_) {} }));
    }
    if (_agentEdictOversightOn(P) && TM.EdictOversight && typeof TM.EdictOversight.run === 'function') {
      var _eoEvidence = (_ch && _ch.shizhengji) || narrative || '';
      _postJobs.push(Promise.resolve().then(function () { return TM.EdictOversight.run(gm, { evidence: _eoEvidence, tier: 'primary', maxTok: 2400, timeoutMs: 60000 }); }).catch(function (_eoRunE) { try { console.warn('[agent-mode] 诏令督查失败(不阻断提交)', _eoRunE); } catch (_) {} }));
    }
    // ── 活世界(agent 模式专属·绕过 LLM 升级互斥)·势力③ 自主 agent 决策(后台·命门「活世界」) ──
    //   agent 模式下势力本不决策(endturn-systems 不跑 NPC·factionAgentEnabled 被互斥关)→世界静止。
    //   此处复用已验证的 _runOneInTurn(选派+decideFor+落地+鸿雁快报)·循环至预算尽/无派可跑(内置 inTurnMaxPerTurn=8 budget·driver _isEnabled 已认 agentLiveWorld)·开关默认关·失败不阻断提交。
    var _liveWorldQueued = false;
    if (_agentLiveWorldOn(P) && TM.FactionNpcInTurnDriver && typeof TM.FactionNpcInTurnDriver._runOneInTurn === 'function') {
      _liveWorldQueued = true;
      _postJobs.push(Promise.resolve().then(async function () {
        var _lwMax = (P.conf && P.conf.agentLiveWorldMaxRuns) || 5;
        var _lwRan = 0;
        for (var _lw = 0; _lw < _lwMax; _lw++) {
          var _lwR = await TM.FactionNpcInTurnDriver._runOneInTurn(gm.turn || 0, 'agent-lw-' + _lw);
          if (!_lwR || _lwR.skipped) break;            // 无派可跑 / 预算尽 / 未启用 → 停
          if (_lwR.applied) _lwRan++;
        }
        gm._agentLiveWorldRan = _lwRan;
        try { console.log('[agent-mode] 活世界·势力自主决策落地 ' + _lwRan + '/' + _lwMax); } catch (_) {}
      }).catch(function (_lwE) { try { console.warn('[agent-mode] 活世界失败(不阻断提交)', _lwE); } catch (_) {} }));
    }
    if (_postJobs.length) { _show('⟨执政⟩' + (_liveWorldQueued ? '势力推演 + ' : '') + '自省督查…', 93); await Promise.all(_postJobs); }

    return { ok: true, fallback: false, aiResult: aiResult };
  }

  TM.Endturn.AgentMode = {
    run: run,
    _stage: 'D-depth-guarantee',
    COVERAGE_SPINE: COVERAGE_SPINE,
    detectSpineGaps: _detectSpineGaps,
    depthGate: _depthGate,
    buildSystemPrompt: _buildSystemPrompt,
    buildTurnPrompt: _buildTurnPrompt,
    _basisDossier: _basisDossier,
    memoryDossier: _memoryDossier,   // DA-Q3·跨回合记忆地板(parity)
    agentSelfReflectOn: _agentSelfReflectOn,   // 切片1·自我反思开关(测试用)
    timeContext: _timeContext,   // 本回合时间上下文(测试用)
    registerPlayerEdicts: _registerPlayerEdicts,   // 诏令登记兜底(测试用)
    agentEdictOversightOn: _agentEdictOversightOn,   // 切片3·诏令督查开关(测试用)
    activeEdictsDossier: _activeEdictsDossier,   // 切片3·在办诏令档(测试用)
    agentQualityGateOn: _agentQualityGateOn,   // 切片2·质量闸开关(测试用)
    qualityGate: _qualityGate,   // 切片2·内容质量闸(测试用)
    agentAnomalyOn: _agentAnomalyOn,   // 切片4·冷门动作开关(测试用)
    anomalyScan: _anomalyScan,   // 切片4·冷门动作扫描(测试用)
    anomalyNudge: _anomalyNudge,   // 切片4·冷门动作深查指引(测试用)
    mapReportToTurnChanges: _mapReportToTurnChanges,   // DA2·_turnReport→Delta 面板桶
    allTools: _allTools,
    actTools: _actTools,             // 工作流·动手阶段工具集(读+写·无深化·测试用)
    activeDims: _activeDims,         // 自适应深化·维度活动判定(测试用)
    engineDiffDims: _engineDiffDims, // engine-first 状态差异→活动维度(测试用)
    coerceArgs: _coerceArgs,         // T2·健壮参数(测试用)
    playerOpsDigest: _playerOpsDigest,   // 玩家操作摘要(测试用·验 engine-first 回合错位)
    readToolsOnly: _readToolsOnly,   // DA-Q3·首轮只读工具集(治超窗)
    selfCheck: _selfCheck,
    snapshot: _snapshot,
    rollback: _rollback
  };
})(typeof window !== 'undefined' ? window : globalThis);
