// @ts-check
// ═══════════════════════════════════════════════════════════════════════
//  tm-ai-change-applier-validators.js — AI 变化「一致性校验器」分片
//  （巨石拆分第二十二拆·20260706·自 tm-ai-change-applier.js 行 2094-3252 迁出）
//  内容：20 个 _validate*Consistency 一致性校验器 + _maybeReconcileWithAI 复核 + 4 私有文本助手。共 25 个成员。
//  【装载序·硬约束】须在 tm-ai-change-applier.js（origin）【之后】装载（index.html 紧随其后）：
//    origin 装载期已向 bucket TM.__acaParts 导出本片捕获的 origin 成员（下方 var 捕获行）；
//    本片把校验器回填 bucket 供 origin 委托 shim 调用期解析。错序=捕获 undefined 立崩。契约见 lint-split-contracts。
// ═══════════════════════════════════════════════════════════════════════
(function(global) {
  'use strict';
  var __acaP = (function(){ var t = global.TM = global.TM || {}; return t.__acaParts = t.__acaParts || {}; })();
  // ── reverse 捕获：origin 成员（origin 装载期已 __acaP.X=X 导出；本地名与迁出体一致·体内 0 改字节）──
  var _alreadyResolvedState = __acaP._alreadyResolvedState, _readFiscalStock = __acaP._readFiscalStock, _writeFiscalStock = __acaP._writeFiscalStock, onAppointment = __acaP.onAppointment, onDismissal = __acaP.onDismissal;
  //>>ACA-SPLIT22-VALIDATORS-BODY-START
  // ═══════════════════════════════════════════════════════════════════
  //  财务一致性校验器
  //  扫描 shilu_text/shizhengji/events 中提及金额，比对 fiscal_adjustments 总量
  // ═══════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════
  //  人事一致性校验器·Wave 1a (2026-04-27)
  //  解决: AI narrative 提『某某下狱/赐死/抄家/流放』但不写 personnel_changes·数据不变
  //  做法: 扫所有 narrative 字段·用动词关键字 + 人名 regex 抓·与结构化数据对比·直接补调 onDismissal
  // ═══════════════════════════════════════════════════════════════════

  // ── 刀9·无源史实幻觉死亡反向闸·源头判据(2026-07-19) ───────────────────────────
  //  背景(owner 亲报平行历史存档污染)：裸自戕/裸伏诛/纯自然死是 AI「按真实历史幻觉」的高发形态——
  //  本局玩家没杀魏忠贤·AI 却按史实在自由叙事写「魏忠贤伏诛/薨逝」·旧兜底把幻觉当真落库成永久死亡。
  //  判据：narrative 死亡是否有「本回合可追溯的源头」。★宽判(宁可判据宽少拦·别把合法处决拦了)：任一信号即有源。
  //    有源 → 照旧补录(现行为零变化)；无任何源头 → 疑幻觉·不落库·转弱自查纸条留痕。
  //  仅对 deathKind==='bare'(裸自戕 reI / 纯自然死 reN-plain)生效；主动致死/暴力殉难(deathKind==='active')不经此判据。
  // 最长实体匹配：text 是否「真提及」nm——先按在册全名长度降序占位消解·nm 命中区间若被更长在册名覆盖则不算·
  //   防人名裸子串误命中(如玩家诏令「起复王安石」不该算作对「王安」的处决意图)。
  function _textMentionsName(text, nm, allNames) {
    if (!nm) return false;
    var s = String(text == null ? '' : text);
    if (s.indexOf(nm) < 0) return false;
    // 只需消解「比 nm 更长且含 nm 为子串」的在册名(其余名不影响判定)·长者优先
    var longer = (allNames || []).filter(function(n){ return n && n.length > nm.length && n.indexOf(nm) >= 0; })
                                 .sort(function(a, b){ return b.length - a.length; });
    for (var i = 0; i < longer.length; i++) {
      var L = longer[i], idx;
      while ((idx = s.indexOf(L)) >= 0) { s = s.slice(0, idx) + ' '.repeat(L.length) + s.slice(idx + L.length); }
    }
    return s.indexOf(nm) >= 0;
  }

  function _narrativeDeathSourced(G, aiOutput, ch, opts) {
    if (!ch || !ch.name) return true;   // 无实体信息·不拦(实体存在性另由下游闸把)
    var nm = ch.name;
    // ① 玩家角色：死亡恒经玩家之死裁决器(合法继统/终局门自处理)·绝不拦(如城破崇祯自缢)
    if (ch.isPlayer === true) return true;
    // ② 已在司法/危难态(下狱/流放/在逃/抄家)：死亡有明确前置·有源
    if (ch._imprisoned || ch._exiled || ch._fled || ch._confiscated) return true;
    if (!aiOutput) aiOutput = {};
    // ③ AI 本回合在任一结构化字段点名操纵该人(死亡意图/人事/任免/NPC 行动)：非凭空叙事·有源。
    //    character_deaths：主链 SC1 stage 现已随主叙事同传标准键(见 tm-endturn-apply-stages)·主链结构化死者进 handled/识源正常。
    function _named(arr, keys) {
      if (!Array.isArray(arr)) return false;
      for (var i = 0; i < arr.length; i++) {
        var x = arr[i]; if (!x) continue;
        for (var k = 0; k < keys.length; k++) { if (x[keys[k]] === nm) return true; }
      }
      return false;
    }
    // 刀C·扩面复用(2026-07-19)：opts.excludeStructuredKey 排除「本键自证」——校验某结构化键自身合法性时不得拿该键自证
    //   (C1 死条查 character_deaths 不算自身自证 / C2 司法查 personnel_changes 不算自身自证)。未传则全键计入(刀9 原行为·零变)。
    // ★返工issue4(2026-07-19)：excludeStructuredKey 支持单键(字符串·向后兼容)或 excludeStructuredKeys 多键(数组)。死亡经
    //   office_assignments/personnel 通道路由时·该通道键本身不得自证(否则『office dismiss 病故』自己给自己当源→漏杀)。
    var _exSet = {};
    if (opts && opts.excludeStructuredKey) _exSet[opts.excludeStructuredKey] = true;
    if (opts && Array.isArray(opts.excludeStructuredKeys)) opts.excludeStructuredKeys.forEach(function(k){ _exSet[k] = true; });
    if (!_exSet['character_deaths'] && _named(aiOutput.character_deaths, ['name'])) return true;
    if (!_exSet['personnel_changes'] && _named(aiOutput.personnel_changes, ['name'])) return true;
    if (!_exSet['char_updates'] && _named(aiOutput.char_updates, ['name'])) return true;
    if (!_exSet['office_assignments'] && _named(aiOutput.office_assignments, ['name'])) return true;
    if (_named(aiOutput.npc_actions, ['name', 'actor', 'target'])) return true;
    // ④ 玩家诏令/裁决提及该人：玩家意志有源(最长实体匹配·防「起复王安石」误命中「王安」)
    var allNames = (G && Array.isArray(G.chars)) ? G.chars.map(function(c){ return c && c.name; }).filter(Boolean) : [];
    function _dirHit(text) { return _textMentionsName(text, nm, allNames); }
    // 问天持久规则库(rule/correction·content)
    var dirs = (G && Array.isArray(G._playerDirectives)) ? G._playerDirectives : [];
    for (var d = 0; d < dirs.length; d++) { if (dirs[d] && _dirHit(dirs[d].content)) return true; }
    // 本回合已执行并移除的一次性纠正指令：闸前被 _applyDirectiveCompliance 删除·其文本快照存于此暂存(见 reconcile 侧)
    var appliedDirs = (G && Array.isArray(G._directivesAppliedThisTurn)) ? G._directivesAppliedThisTurn : [];
    for (var a = 0; a < appliedDirs.length; a++) { if (appliedDirs[a] && _dirHit(appliedDirs[a].content)) return true; }
    // 近回合诏书/行止(agent 模式·真实 schema={turn,edicts:[字符串..],xinglu}·兼容 content/text/note)
    var recent = (G && Array.isArray(G._agentRecentDirectives)) ? G._agentRecentDirectives : [];
    for (var r = 0; r < recent.length; r++) {
      var rd = recent[r]; if (!rd) continue;
      if (Array.isArray(rd.edicts)) { for (var e = 0; e < rd.edicts.length; e++) { if (_dirHit(rd.edicts[e])) return true; } }
      if (_dirHit(rd.xinglu) || _dirHit(rd.content) || _dirHit(rd.text) || _dirHit(rd.note)) return true;
    }
    return false;
  }

  // ── 刀C·C1(2026-07-19)·结构化 character_deaths 死因语义分类(bare/active)·镜像刀9 _scanExecutions 词表语义 ──
  //   active=主动致死/暴力殉难/含本局具体事由(被斩/赐死/处决/战殁/阵亡/殉国/遇害/城破/奉旨/明正典刑…)——有本回合致因·照常落库；
  //   bare=裸自戕/裸伏诛/纯自然死(伏诛/弃市/自尽/自缢/病故/薨逝/寿终/暴卒/无疾而终…)——无本回合致因·AI 史实幻觉高发·须外部源头。
  //   ★宁漏勿误杀：先判强 active(本回合外部事件/玩家意志) → 再判 bare(裸词) → 再判处决动词 active → 无法归类一律 active(放行)。
  //   顺序要害：强 active/bare 先于「斩/诛」处决动词·免「伏诛」被裸「诛」误升 active 漏杀了本该 gate 的裸伏诛(owner 亲报病灶)。
  function _classifyStructuredDeathKind(reason) {
    var s = String(reason == null ? '' : reason);
    if (!s) return 'active';   // 无死因·不判幻觉·放行
    // ① 强 active：本回合外部致死事件 / 玩家意志明标(战殁/殉难/城破/遇害/兵败/民变/奉旨/明正典刑/被斩…)·优先
    if (/战殁|战死|阵亡|阵殁|阵前|殉国|殉难|殉城|殉职|捐躯|城破|城陷|遇害|遇难|遭难|罹难|殒命|毙命|兵败|兵变|民变|乱兵|流寇|奉旨|奉诏|明正典刑|就地正法|被斩|被诛|被杀|被害|被处死/.test(s)) return 'active';
    // ② bare：裸伏诛/裸自戕/纯自然死(无本回合致因·AI 史实幻觉高发)·镜像刀9 KILL_INTRANS + KILL_NATURAL_PLAIN
    if (/伏诛|伏法|弃市|就戮|授首|自尽|自缢|自刎|自裁|自杀|溘然长逝|病故|病逝|病殁|病卒|病亡|病笃|寝疾|亡故|暴毙|暴卒|暴亡|猝死|物故|身故|薨逝|薨|溘逝|寿终|谢世|辞世|弃世|长逝|无疾而终/.test(s)) return 'bare';
    // ③ 主动处决动词(斩/诛/赐死/处决/凌迟…·有施死主体)·active
    if (/斩|诛|赐死|赐自尽|处决|处斩|处死|正法|凌迟|腰斩|枭首|枭示|问斩|绞|戮|磔/.test(s)) return 'active';
    return 'active';   // 无法归类·宁漏勿误杀·放行
  }

  // ── 刀C·C2/C3(2026-07-19)·写端动作来源判据(结构化人事/敏感字段共用) ──
  //   复用刀9四路(isPlayer/司法危难态/结构化互证[opts.excludeStructuredKey 排自证键]/玩家诏令三源)·
  //   再扩「本回合游戏态输入面」(opts.scanInputs=true)：弹劾奏疏(GM.memorials)/朝议要务(GM.currentIssues)点名此人→有源。
  //   ★宁漏勿误杀：任一路命中即放行·输入面扫描只加源不减源。
  // ── 刀C·返工二轮(2026-07-19·Codex复审)·来源扫描面按回合记忆化(perf)+朝议裁决回合边界(镜像 tm-endturn-prompt._getCurrentChangchaoDecisions) ──
  //   allNames(花名册)与朝议拼接文本每回合只重建一次(turn 变 / court 记录数变才失效)·避免每动作重构在真实剧本(数百角色+长转录)下拖垮 endturn。
  // 读档代际(镜像 npc-decision:483/mechanics-memory:466)·并入缓存键→读同 turn 旧档不串用(全 _wg*Cache 亦入存档 SKIP·派生不落档)。
  function _wgLoadGen(G) { return (typeof global !== 'undefined' && global._tmLoadGen) || (G && G._tmLoadGen) || 0; }
  function _wgFp(x, n) { return String(x == null ? '' : x).slice(0, n || 10); }
  // ★返工三轮issue1(2026-07-19)·allNames 缓存签名=turn|loadGen|len|首名|末名——同回合 addChar(push·len 变·tm-indices:1197)/
  //   整组替换(首末名变)/首末改名均自然失效·治『王安建缓存后加王安石·最长实体消歧失效致对王安无源写误放』。
  function _wgAllNamesSig(G) {
    var chars = (G && Array.isArray(G.chars)) ? G.chars : [];
    var n = chars.length;
    return ((G && G.turn) || 0) + '|' + _wgLoadGen(G) + '|' + n + '|' + _wgFp(n ? (chars[0] && chars[0].name) : '', 12) + '|' + _wgFp(n ? (chars[n - 1] && chars[n - 1].name) : '', 12);
  }
  function _wgCachedAllNames(G) {
    if (!G) return [];
    var sig = _wgAllNamesSig(G);
    if (G._wgAllNamesCache && G._wgAllNamesSigVal === sig) return G._wgAllNamesCache;
    var names = Array.isArray(G.chars) ? G.chars.map(function(c){ return c && c.name; }).filter(Boolean) : [];
    G._wgAllNamesCache = names; G._wgAllNamesSigVal = sig;   // arch-ok(派生记忆化缓存·入档 SKIP·非游戏态)
    return names;
  }
  // 常朝『上回合圣意』的目标回合(镜像 prompt:44·Meta.targetTurn 优先·_lastChangchaoDecisionsTargetTurn 兜底)
  function _wgLccTargetTurn(G) {
    var meta = G && G._lastChangchaoDecisionMeta;
    if (meta && meta.targetTurn != null && meta.targetTurn !== '') return Number(meta.targetTurn);
    if (G && G._lastChangchaoDecisionsTargetTurn != null && G._lastChangchaoDecisionsTargetTurn !== '') return Number(G._lastChangchaoDecisionsTargetTurn);
    return null;
  }
  function _wgStringifyDecision(d) {
    if (d == null) return '';
    if (typeof d !== 'object') return ' ' + String(d);
    var s = '';
    ['direction', 'custom', 'text', 'line', 'mode', 'action', 'title', 'detail', 'content'].forEach(function(k){ if (d[k] != null && typeof d[k] !== 'object') s += ' ' + d[k]; });
    return s;
  }
  // 本回合朝议裁决拼接文本(记忆化·turn+记录数为键)：★回合边界(issue2·镜像 prompt:38)=targetTurn 为准·turn 仅无 targetTurn 时兜底·
  //   两者不做 OR(避 targetTurn 过期旧裁决永久自证 / post-turn 裁决提前放行)。★形状(issue3)=覆盖常朝 decisions[]/transcript[]
  //   与廷议/御前单数 topic+decision(tm-chaoyi-tinyi:1155 / yuqian:461)两种真实落点。
  // ★返工三轮issue2(2026-07-19)·court 缓存签名=turn|loadGen + 记录/裁决数组的(len+首末条廉价指纹)——真实生产者封顶8条 push+shift
  //   (changchao-flows:273/tinyi:1155/yuqian:461)净 len 恒8·整组替换 _lastChangchaoDecisions 可能 len 不变·旧 len-only 键刷不进新裁决→误拦。
  //   指纹让『push+shift 末条变 / 整组替换首末变 / 增长 len 变』三真实路径全失效。
  function _wgRecFp(rec) { return rec ? ((rec.turn == null ? '' : rec.turn) + '_' + (rec.targetTurn == null ? '' : rec.targetTurn) + '_' + _wgFp(rec.topic || (rec.decision && rec.decision.direction) || (Array.isArray(rec.decisions) && rec.decisions[0] && rec.decisions[0].title) || '', 10)) : ''; }
  function _wgDecFp(dd) { return dd ? _wgFp((dd.title || '') + '/' + (dd.extra || ''), 14) : ''; }
  function _wgCourtTextSig(G) {
    var crs = (G && Array.isArray(G._courtRecords)) ? G._courtRecords : [];
    var lcc = (G && Array.isArray(G._lastChangchaoDecisions)) ? G._lastChangchaoDecisions : [];
    var cn = crs.length, ln = lcc.length;
    return ((G && G.turn) || 0) + '|' + _wgLoadGen(G) + '|c' + cn + ':' + _wgRecFp(cn ? crs[0] : null) + ':' + _wgRecFp(cn ? crs[cn - 1] : null) +
           '|l' + ln + ':' + _wgDecFp(ln ? lcc[0] : null) + ':' + _wgDecFp(ln ? lcc[ln - 1] : null) +
           '|lt:' + ((G && G._lastChangchaoDecisionsTargetTurn) == null ? '' : G._lastChangchaoDecisionsTargetTurn) + ':' + ((G && G._lastChangchaoDecisionMeta && G._lastChangchaoDecisionMeta.targetTurn) == null ? '' : G._lastChangchaoDecisionMeta.targetTurn);
  }
  function _wgCachedCourtText(G) {
    if (!G) return '';
    var t = G.turn || 0;
    var crs = Array.isArray(G._courtRecords) ? G._courtRecords : [];
    var sig = _wgCourtTextSig(G);
    if (G._wgCourtTextCache != null && G._wgCourtTextSigVal === sig) return G._wgCourtTextCache;
    var txt = '';
    if (_wgLccTargetTurn(G) === t && Array.isArray(G._lastChangchaoDecisions)) {
      G._lastChangchaoDecisions.forEach(function(dd){ if (dd) txt += ' ' + (dd.title || '') + ' ' + (dd.extra || '') + ' ' + (dd.dept || ''); });
    }
    for (var c = 0; c < crs.length; c++) {
      var rec = crs[c]; if (!rec) continue;
      var rt = Number((rec.targetTurn != null && rec.targetTurn !== '') ? rec.targetTurn : rec.turn);
      if (!isFinite(rt) || rt !== t) continue;
      txt += ' ' + (rec.topic || '') + _wgStringifyDecision(rec.decision);
      var decs = Array.isArray(rec.decisions) ? rec.decisions : [];
      for (var di = 0; di < decs.length; di++) { var de = decs[di]; if (de) txt += ' ' + (de.title || '') + ' ' + (de.detail || '') + ' ' + (de.content || '') + ' ' + (de.presenter || '') + ' ' + (de.dept || ''); }
      var tr = Array.isArray(rec.transcript) ? rec.transcript : [];
      for (var ti = 0; ti < tr.length; ti++) { var te = tr[ti]; if (te) txt += ' ' + (te.text || '') + ' ' + (te.speaker || ''); }
    }
    G._wgCourtTextCache = txt; G._wgCourtTextSigVal = sig;   // arch-ok(派生记忆化缓存·入档 SKIP)
    return txt;
  }

  function _writeActionSourced(G, aiOutput, ch, opts) {
    opts = opts || {};
    if (_narrativeDeathSourced(G, aiOutput, ch, opts)) return true;
    if (opts.scanInputs && ch && ch.name) {
      var nm = ch.name;
      var allNames = _wgCachedAllNames(G);   // 记忆化·按回合(issue5)
      var _hit = function(t) { return _textMentionsName(t, nm, allNames); };
      var mems = (G && Array.isArray(G.memorials)) ? G.memorials : [];
      for (var i = 0; i < mems.length; i++) {
        var m = mems[i]; if (!m) continue;
        if (_hit(m.title) || _hit(m.text) || _hit(m.content) || _hit(m.from) || _hit(m.target) || _hit(m.subject) || _hit(m.about)) return true;
      }
      var iss = (G && Array.isArray(G.currentIssues)) ? G.currentIssues : [];
      for (var j = 0; j < iss.length; j++) {
        var q = iss[j]; if (!q) continue;
        if (_hit(q.title) || _hit(q.description) || _hit(q.desc)) return true;
      }
      // 朝议/常朝/廷议/御前裁决面(记忆化拼接文本·回合边界 issue2 + 两种真实形状 issue3·详见 _wgCachedCourtText)：本回合裁决点名此人→有源。
      var _courtTxt = _wgCachedCourtText(G);
      if (_courtTxt && _hit(_courtTxt)) return true;
    }
    return false;
  }

  // ── 刀C·C2(2026-07-19)·司法类人事动作来源判据(applier.personnel_changes 兜底段调用) ──
  //   司法类(下狱/抄家/流放/斩/杖/拿问/夺职拿问)落库前过同款判据(_writeActionSourced：玩家诏令/司法态/结构化互证[排 personnel_changes
  //   自证]/本回合弹劾朝议输入)。无源→不执行·拒写降级=弱自查纸条+console 留痕+入 failed 可见。普通任免(升/调/致仕/罢黜)不入闸。
  //   返回 true=已拦(调用方应 return 跳过该条)·false=有源或非司法·照常落。★宁漏勿误杀。
  function _gateJudicialPersonnelChange(G, aiOutput, pc, changeText, applied) {
    if (!G || !pc || !pc.name) return false;
    // ★返工issue4(2026-07-19)：并入裸/自然死词表(暴毙/病故/薨/自尽/伏诛/卒…)——personnel 解析器(applier:1614)把这些映射进死亡管线·
    //   C2 旧司法词表漏之→personnel『魏忠贤暴毙』零提示落死。与 onDismissal:554 死亡面对齐·统一过同款来源判据。
    var judicial = /下狱|入狱|系狱|收押|收监|关押|囚禁|捉拿|逮捕|抓捕|缉拿|锁拿|拿问|逮治|械系|下诏狱|抄家|抄没|籍没|查抄|没官|流放|发配|戍边|充军|斩|诛|处决|处斩|处死|正法|凌迟|枭首|问斩|赐死|杖毙|廷杖|杖责|夺职拿问|暴毙|暴卒|暴亡|猝死|病故|病逝|病殁|病卒|病亡|亡故|物故|身故|溘逝|薨逝|薨|寿终|自尽|自缢|自刎|自裁|服毒|伏诛|伏法|弃市|殒命|毙命/.test(String(changeText || ''));
    if (!judicial) return false;
    var ch = (typeof _findEntity === 'function') ? _findEntity(G, 'char', pc.name) : (Array.isArray(G.chars) ? G.chars.filter(function(c){ return c && c.name === pc.name; })[0] : null);
    if (!ch) return false;   // 查无此人·实体存在性另由既有 onDismissal 兜底·此闸只管来源
    if (_writeActionSourced(G, aiOutput, ch, { excludeStructuredKey: 'personnel_changes', scanInputs: true })) return false;
    console.warn('[personnel/C2] 无源司法类人事动作·不执行(疑 AI 史实幻觉·转弱自查纸条留痕): ' + pc.name + ' ← 「' + String(changeText || '') + '」');
    if (!G._aiWeakWriteHints) G._aiWeakWriteHints = [];   // arch-ok
    G._aiWeakWriteHints.push({ label: '无源司法人事', reason: '司法类人事动作本回合无任一源头(玩家诏令/司法态/结构化互证/弹劾朝议输入)·疑史实幻觉·摘要「' + String(changeText || '').slice(0, 20) + '」', itemName: pc.name, source: 'personnel-c2-no-source', active: null, turn: G.turn || 0 });   // arch-ok
    if (G._aiWeakWriteHints.length > 20) G._aiWeakWriteHints = G._aiWeakWriteHints.slice(-20);   // arch-ok
    try { if (typeof global.recordAIDiagnostic === 'function') global.recordAIDiagnostic('write_hint', { label: '无源司法人事', itemName: pc.name, raw: String(changeText || '') }); } catch(_c2e) {}
    if (applied && Array.isArray(applied.failed)) applied.failed.push({ personnel_change: { name: pc.name, change: pc.change }, reason: '无源司法类人事动作·未落库(疑史实幻觉·转弱自查纸条)' });
    return true;
  }

  // ── 刀C·C3(2026-07-19)·char_update 敏感字段来源判据(narrative._mergeUpdatesToEntity 调用) ──
  //   过 _writeActionSourced 同款判据·有源返 true(调用方照常落该字段)；无源返 false 并就地留痕(弱自查纸条·此文件已是 _aiWeakWriteHints
  //   既有 arch-ok 写手·集中在此免 narrative 闯入子树)+console.warn+诊断。★宁漏勿误杀。
  function _sensitiveCharFieldSourced(G, aiOutput, entity, realKey, entityName) {
    if (!G || !entity) return true;
    if (_writeActionSourced(G, aiOutput, entity, { excludeStructuredKey: 'char_updates', scanInputs: true })) return true;
    if (!G._aiWeakWriteHints) G._aiWeakWriteHints = [];   // arch-ok
    G._aiWeakWriteHints.push({ label: '无源敏感字段', reason: 'char.' + realKey + ' 更新本回合无任一源头(玩家诏令/司法态/结构化互证/弹劾朝议输入)·疑 AI 史实幻觉失势向量', itemName: entityName || entity.name || entity.id, source: 'char-update-c3-no-source', active: null, turn: G.turn || 0 });   // arch-ok
    if (G._aiWeakWriteHints.length > 20) G._aiWeakWriteHints = G._aiWeakWriteHints.slice(-20);   // arch-ok
    try { console.warn('[char_update/C3] 无源敏感字段·跳过·不落库(转弱自查纸条): ' + (entityName || '') + '.' + realKey); } catch(_c3w){}
    try { if (typeof global.recordAIDiagnostic === 'function') global.recordAIDiagnostic('write_hint', { label: '无源敏感字段', itemName: entityName || '', field: realKey }); } catch(_c3d){}
    return false;
  }

  // ── 刀C·C4(2026-07-19)·events 键时点闸(applier events 段调用) ──
  //   AI 可把「己巳之变/甲申国难」等未来史实当既成事件播报污染。确定性时点闸(保守·宁漏勿误杀)：
  //   ① 硬闸·event 带明确年份/日期字段且晚于当前游戏年→拒(未来事件当既发)+弱提示；
  //   ② 软闸·GM.rigidHistoryEvents 里未到 triggerTurn 的既定史实名在 event 文本出现→只弱提示不硬拒(防同名议论误杀)。
  //   返 true=硬拦(调用方 return 跳过)·false=放行(软提示已就地留痕)。
  function _extractEventYear(e) {
    var cands = [e.year, e.eventYear, e.triggerYear, e.happenedYear, e.gYear, e.date, e.time];
    for (var i = 0; i < cands.length; i++) {
      var v = cands[i]; if (v == null) continue;
      if (typeof v === 'number' && isFinite(v) && v > 0) return Math.floor(v);
      var m = String(v).match(/(?:^|[^0-9])((?:1[0-9]|20)[0-9]{2})(?:\s*年|[^0-9]|$)/);   // 仅认公元四位年(1000-2099)·避免误解干支/年号/斩获数字
      if (m) return parseInt(m[1], 10);
    }
    return 0;
  }
  function _gateEventTimepoint(G, e, applied) {
    if (!G || !e || typeof e !== 'object') return false;
    function _pushHint(label, reason) {
      if (!G._aiWeakWriteHints) G._aiWeakWriteHints = [];   // arch-ok
      G._aiWeakWriteHints.push({ label: label, reason: reason, itemName: e.title || e.name || e.category || '', source: 'events-c4-timepoint', active: null, turn: G.turn || 0 });   // arch-ok
      if (G._aiWeakWriteHints.length > 20) G._aiWeakWriteHints = G._aiWeakWriteHints.slice(-20);   // arch-ok
      try { if (typeof global.recordAIDiagnostic === 'function') global.recordAIDiagnostic('write_hint', { label: label, itemName: e.title || e.name || '' }); } catch(_ge){}
    }
    // 当前游戏年·权威=calcDateFromTurn(tm-ai-infra·读 P.time.year 真开局年·手工历法·无 new Date(1,..)→1901 两位年毒值)；
    //   ★返工(2026-07-19)：旧用 TimeUtils.turnToDate 读 P.time.startYear(缺→1→new Date→1901毒值)误判时点。回落 G.year/currentYear。
    //   ★异常年值(非公元 1000-2099·如 0/1901毒值/公元前朝代)一律视为『无从确定』→curYear=0→不硬拦(宁漏勿误杀)。
    var curYear = 0;
    try { if (typeof global.calcDateFromTurn === 'function' && G.turn != null) { var _cd = global.calcDateFromTurn(G.turn); curYear = Number(_cd && _cd.adYear) || 0; } } catch(_te){}
    if (!(curYear >= 1000 && curYear <= 2099)) curYear = Number(G.year) || Number(G.currentYear) || 0;
    if (!(curYear >= 1000 && curYear <= 2099)) curYear = 0;   // 仍异常→无从确定·不拦
    // ① 硬闸：明确未来年份
    var evYear = _extractEventYear(e);
    if (curYear && evYear && evYear > curYear) {
      try { console.warn('[events/C4] 未来时点事件·拒(当既成播报未来史实): 「' + String(e.title || e.text || e.name || '').slice(0, 30) + '」·事件年 ' + evYear + ' > 当前 ' + curYear); } catch(_cw){}
      _pushHint('未来时点事件', '事件标注年份 ' + evYear + ' 晚于当前游戏年 ' + curYear + '·疑把未来史实当既成事件播报·拒落库');
      if (applied && Array.isArray(applied.failed)) applied.failed.push({ event: e.title || e.name || '', reason: 'future-timepoint: ' + evYear + ' > ' + curYear });
      return true;
    }
    // ② 软闸：未到 triggerTurn 的既定史实名出现在 event 文本→弱提示(不硬拒·防同名议论误杀)
    var rig = (Array.isArray(G.rigidHistoryEvents) && G.rigidHistoryEvents) ||
              (global.P && Array.isArray(global.P.rigidHistoryEvents) && global.P.rigidHistoryEvents) || null;
    if (rig && rig.length) {
      var txt = String((e.text || '') + ' ' + (e.title || '') + ' ' + (e.desc || '') + ' ' + (e.name || '') + ' ' + (e.category || ''));
      for (var r = 0; r < rig.length; r++) {
        var rev = rig[r]; if (!rev || !rev.name) continue;
        var tt = Number(rev.triggerTurn);
        if (isFinite(tt) && tt > (G.turn || 0) && String(rev.name).length >= 2 && txt.indexOf(String(rev.name)) >= 0) {
          try { console.warn('[events/C4] 未到期既定史实名现于事件文本·软提示(不拒): 「' + rev.name + '」 triggerTurn=' + tt + ' > 当前回合 ' + (G.turn || 0)); } catch(_cw2){}
          _pushHint('未到期史实事件', '事件文本提及未到 triggerTurn(' + tt + ') 的既定史实「' + rev.name + '」·疑既成播报未来·软提示(不硬拒)');
          break;
        }
      }
    }
    return false;
  }

  // ── 刀C·返工issue5(2026-07-19)·allegiance_changes 改 canonical faction 补来源判据(applier 叛降段调用) ──
  //   叛降/归附本是带因事件：reason 含具体军政诱因(战败/围城/策反/反正/归降/俘/胁迫/拥立)或经 _writeActionSourced
  //   (玩家诏令/朝议裁决/结构化互证)有源→放行；纯凭史实幻觉的裸改换门庭(无诱因无来源)→拒+弱提示。返 true=已拦。★宁漏勿误杀。
  function _gateAllegianceSource(G, aiOutput, charRef, newName, reason, applied) {
    if (!G || !charRef) return false;
    var ch = (typeof _findEntity === 'function') ? _findEntity(G, 'char', charRef) : (Array.isArray(G.chars) ? G.chars.filter(function(c){ return c && (c.name === charRef || c.id === charRef); })[0] : null);
    if (!ch) return false;   // 查无此人·另由 applyAllegianceChange 兜底
    if (/战败|兵败|大败|溃败|败绩|围城|城破|城陷|陷城|破城|策反|反正|反水|归降|归附|来降|来附|投诚|投降|纳降|请降|乞降|招抚|招降|抚定|胁迫|挟持|俘获|被俘|就擒|拥立|劫盟|叛降|叛附|献城|献关|举城|哗变|倒戈/.test(String(reason || ''))) return false;
    if (_writeActionSourced(G, aiOutput, ch, { scanInputs: true })) return false;
    console.warn('[allegiance/返工] 无源改换门庭·不执行(疑史实幻觉·转弱自查纸条留痕): ' + (ch.name || charRef) + ' → ' + newName);
    if (!G._aiWeakWriteHints) G._aiWeakWriteHints = [];   // arch-ok
    G._aiWeakWriteHints.push({ label: '无源改换门庭', reason: '改换门庭本回合无军政诱因(战败/围城/策反)亦无玩家诏令/朝议来源·疑史实幻觉·目标势力「' + String(newName || '').slice(0, 20) + '」', itemName: ch.name || charRef, source: 'allegiance-no-source', active: null, turn: G.turn || 0 });   // arch-ok
    if (G._aiWeakWriteHints.length > 20) G._aiWeakWriteHints = G._aiWeakWriteHints.slice(-20);   // arch-ok
    try { if (typeof global.recordAIDiagnostic === 'function') global.recordAIDiagnostic('write_hint', { label: '无源改换门庭', itemName: ch.name || charRef }); } catch(_ae) {}
    if (applied && Array.isArray(applied.failed)) applied.failed.push({ field: 'allegiance_changes', text: (ch.name || charRef) + ' → ' + newName, reason: '无源改换门庭·未落库(疑史实幻觉)' });
    return true;
  }

  // ── 刀C·返工issue4(2026-07-19)·死亡动词经人事通道(appointments/office_assignments dismiss+reason)入死亡管线的收口闸 ──
  //   收口点=onDismissal 死亡分支前(单一位置)。凡 reason 映射进死亡管线(与 onDismissal:554 词表对齐)·且是 bare 裸死(病故/薨/暴毙/
  //   自尽/伏诛)·且本回合无源→拒路由死亡+弱提示。主动致死/暴力殉难/含本局事由=active→照常落。★只在 AI-apply 通道(aiOutput 传入)生效·
  //   玩家/迁移直调 onDismissal(无 aiOutput)不拦。玩家角色恒经裁决器·绝不拦。返 true=已拦(onDismissal 应返失败·不路由死亡)。
  function _gateDeathRoutingSource(G, ch, reasonText, aiOutput) {
    if (!G || !ch || !ch.name || !aiOutput) return false;
    if (ch.isPlayer === true) return false;
    var rs = String(reasonText || '');
    if (!/处决|处斩|处死|斩首|斩决|斩杀|戮杀|正法|明正典刑|诛杀|诛戮|诛九族|凌迟|腰斩|弃市|枭首|枭示|问斩|赐死|赐自尽|绞刑|绞死|伏诛|伏法|就戮|授首|自尽|自缢|自刎|自裁|自杀|服毒自尽|畏罪自尽|磔|死刑|身故|病故|病逝|病殁|病卒|病亡|亡故|暴毙|暴卒|暴亡|猝死|物故|殒命|毙命|殉国|殉难|殉城|殉职|罹难|遇害|遇难|遭难|薨逝|溘逝|寿终|城破身死/.test(rs)) return false;
    if (_classifyStructuredDeathKind(rs) !== 'bare') return false;
    if (_writeActionSourced(G, aiOutput, ch, { excludeStructuredKeys: ['character_deaths', 'office_assignments', 'personnel_changes'], scanInputs: true })) return false;
    console.warn('[death-route/返工] 无源裸死亡经人事通道入死亡管线·拦(疑史实幻觉·转弱自查纸条留痕): ' + ch.name + ' ← 「' + rs.slice(0, 30) + '」');
    if (!G._aiWeakWriteHints) G._aiWeakWriteHints = [];   // arch-ok
    G._aiWeakWriteHints.push({ label: '无源人事死亡', reason: '裸死亡经 personnel/appointments/office→onDismissal 死亡管线·本回合无任一源头·疑史实幻觉·死因「' + rs.slice(0, 20) + '」', itemName: ch.name, source: 'death-routing-no-source', active: null, turn: G.turn || 0 });   // arch-ok
    if (G._aiWeakWriteHints.length > 20) G._aiWeakWriteHints = G._aiWeakWriteHints.slice(-20);   // arch-ok
    try { if (typeof global.recordAIDiagnostic === 'function') global.recordAIDiagnostic('write_hint', { label: '无源人事死亡', itemName: ch.name }); } catch(_de) {}
    return true;
  }

  function _validatePersonnelConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrativeText = '';
    // ★主叙事字段：SC1 主链 stage 把主时政叙事传在 narrative 键(见 tm-endturn-apply-stages:84)·与其他 validator 用的
    //   _getNarrativeText 对齐(它已扫 narrative)·此前人事 validator 漏扫 narrative→主链裸死亡扫不到(Codex探针:narrative键→0/0)。
    if (aiOutput.narrative) narrativeText += String(aiOutput.narrative) + '\n';
    if (aiOutput.shilu_text) narrativeText += String(aiOutput.shilu_text) + '\n';
    if (aiOutput.shizhengji) narrativeText += String(aiOutput.shizhengji) + '\n';
    // zhengwen(邸报/政闻)也是真实 AI 叙事输出字段·此前漏扫→AI 只在 zhengwen 里写"某巡抚被杀"
    //   时兜底器看不到→死亡永不落库→下月名册照旧当活人喂 AI(玩家报"死人还在任")。与
    //   tm-ai-narrative-guards.js:_collectNarrative 同源字段对齐。(2026-07-04)
    if (aiOutput.zhengwen) narrativeText += String(aiOutput.zhengwen) + '\n';
    if (aiOutput.yupiHuiting) narrativeText += String(aiOutput.yupiHuiting) + '\n';
    if (aiOutput.qijuHistory) narrativeText += String(aiOutput.qijuHistory) + '\n';
    if (Array.isArray(aiOutput.events)) {
      aiOutput.events.forEach(function(e){ if (e && e.desc) narrativeText += String(e.desc) + '\n'; });
    }
    if (aiOutput.event && aiOutput.event.desc) narrativeText += String(aiOutput.event.desc) + '\n';
    // npc_actions 也扫
    if (Array.isArray(aiOutput.npc_actions)) {
      aiOutput.npc_actions.forEach(function(na){ if (na && na.desc) narrativeText += String(na.desc) + '\n'; });
    }
    if (!narrativeText) return;

    // 状态动词字典·区分动作类型
    // 注: execute(处决)已移出此通用循环·改由下方 _scanExecutions 受事锚定扫描器处理·
    //     因及物处决动词走"名前动词"通用匹配会误杀施事者(如"孙传庭斩获甚众"把孙传庭当被斩)·
    //     且"把X砍了"会被 {2,4} 贪婪捕获吞掉"把"字而漏抓。(2026-07-02)
    var statusVerbs = {
      imprison:   ['诏狱', '下诏狱', '入诏狱', '下狱', '入狱', '系狱', '收押', '收监', '关押', '囚禁', '拿问', '逮治', '槛车', '捉拿下狱', '逮捕下狱', '锁拿'],
      arrest:     ['捉拿', '逮捕', '抓捕', '缉拿', '锁拿'],   // 不一定下狱·区分对待
      exile:      ['流放', '发配', '戍边', '充军', '远谪', '贬谪边远'],
      retire:     ['致仕', '乞骸骨', '归田', '退休', '告老'],
      flee:       ['潜逃', '远遁', '逃匿', '隐遁'],
      confiscate: ['抄家', '抄没', '籍没', '查抄', '没官'],
      dismiss:    ['革职', '罢官', '罢免', '降职贬黜', '罢相', '罢免']
    };

    // 收集所有人名(2-4字·过滤明显非人名)
    var allChars = (G.chars || []).filter(function(c){ return c && c.name && c.alive !== false; });
    var charNameSet = {};
    allChars.forEach(function(c){
      charNameSet[c.name] = c;
      // 也收去前缀的『字』『号』·如『字'国之'』
      if (c.zi) charNameSet[c.zi] = c;
    });

    // 扫 narrative·匹配 "<人名> + <动作>" 或 "<动作> + <人名>" 模式
    var mentioned = [];
    Object.keys(statusVerbs).forEach(function(action) {
      statusVerbs[action].forEach(function(verb) {
        // 正向: "X 下狱"
        var pat1 = new RegExp('([\\u4e00-\\u9fff]{2,4})\\s*' + verb, 'g');
        // 反向: "下狱 X" / "命...将 X 下狱"
        var pat2 = new RegExp(verb + '[^\\u4e00-\\u9fff]{0,5}([\\u4e00-\\u9fff]{2,4})', 'g');
        [pat1, pat2].forEach(function(pat) {
          var m;
          while ((m = pat.exec(narrativeText)) !== null) {
            var name = m[1];
            if (!charNameSet[name]) continue;
            // 去重·同人同 action 只记一次
            var key = name + '_' + action;
            if (mentioned.find(function(x){return x.key===key;})) continue;
            mentioned.push({ key: key, name: name, action: action, verb: verb, raw: m[0] });
          }
        });
      });
    });

    // ── 处决/自尽·受事锚定专用扫描器 (2026-07-02) ──────────────────────
    //  处决类动词及物·"名前动词"(如"孙传庭斩获")会误杀施事者·故不走上面的通用 pat1/pat2·
    //  改为只在命名者明确为『受事』时判死:
    //    被动 X被斩/X为贼所杀 · 处置式 把X砍了 · 动宾 斩X/赐死X · 自戕类 X自尽(名前即受事)
    //  既能抓 LLM 口语"把胡廷晏砍了"·又不误杀"斩获甚众/杀敌三千"的将领
    (function _scanExecutions(){
      // 及物处决动词·命名者须为受事(被动/处置/动宾)·长词在前(正则择序·免"斩首"被"斩"抢先)
      var KILL_TRANS = ['明正典刑','就地正法','诛九族','斩杀','斩首','斩决','诛杀','诛戮','戮杀',
                        '处决','处斩','处死','正法','凌迟','腰斩','枭首','枭示','问斩','绞刑','绞死',
                        '赐死','赐自尽','斩','杀','砍','戮','诛'];
      // 不及物/自戕·命名者即受事(名前动词安全)
      var KILL_INTRANS = ['服毒自尽','畏罪自尽','畏罪自缢','阖门自尽','投缳自尽','伏诛','伏法','弃市',
                          '就戮','授首','自尽','自缢','自刎','自裁','自杀','磔'];
      // 自然/含糊死亡词·名前即受事(非处决非自戕)·治巡抚死于民变常被叙作"遇害/病故/城破身死"
      //   而非处决词→旧扫描器全漏(玩家报"死人下月还在任")。只收多字不歧义词·避开单字 卒/死/薨/殁。
      // ★刀9(2026-07-19)按「是否隐含本回合致死事件」二分(并集=原表·零漏词)：
      //   VIOLENT=暴力/殉难/城破——文义自带本回合外部致死事件(战乱/民变/城陷)·视为有源·照旧补录；
      //   PLAIN=纯病老/暴卒/薨逝——无本回合致因·是 AI「按真实历史幻觉」的高发形态(如「魏忠贤薨逝」)·须外部源头才落库。
      var KILL_NATURAL_VIOLENT = ['城破身死','城陷而死','以身殉国','为国捐躯','殉国','殉难','殉城','殉职','罹难','遇害','遇难','遭难','殒命','毙命'];
      var KILL_NATURAL_PLAIN  = ['溘然长逝','病故','病逝','病殁','病卒','病亡','亡故','暴毙','暴卒','暴亡','猝死','物故','身故','薨逝','溘逝','寿终','谢世','辞世','弃世','长逝'];
      var KILL_NATURAL = KILL_NATURAL_VIOLENT.concat(KILL_NATURAL_PLAIN);   // 并集=原自然死表(供他处沿用·此处不再整体用)
      function alt(list){ return list.slice().sort(function(a,b){return b.length-a.length;}).join('|'); }
      var transAlt = alt(KILL_TRANS), intransAlt = alt(KILL_INTRANS), natViolentAlt = alt(KILL_NATURAL_VIOLENT), natPlainAlt = alt(KILL_NATURAL_PLAIN);
      // 名与死亡词之间夹关系词→死的是亲属非本人(如"胡廷晏之子病故")·跳过防误杀
      var _relRe = /之|其|亲|眷|属|族|子|女|父|母|妻|夫|弟|兄|孙|侄|甥|婿|妾|嗣|叔|伯|舅|姑|姊|妹/;
      var NP = '[^。！？；;.!?，,、\\n]{0,6}';  // 同句内窗口·不跨标点
      function esc(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
      Object.keys(charNameSet).forEach(function(nm){
        if (!nm || nm.length < 2 || narrativeText.indexOf(nm) < 0) return;
        var e = esc(nm), m = null, hit = null;
        // 被动: X被处死 / X坐罪事发，被斩 / X为贼所杀
        //  允许同句内隔一分句·但『被/为』须紧接姓名或逗号后·
        //  这样"孙传庭破贼，贼首被斩"里"被"前是"贼首"(非逗号非姓名)→不误挂到孙传庭·
        //  ★"被"后接命/令/派/遣等受命词=施事者(如"孙传庭被命令斩杀叛军")→负向前瞻排除·免误杀施事者
        //  『被』分支只认 transAlt(含杀/斩/诛/戮/砍)·不加"害"——防"被陷害/被迫害/被诬害"(构陷≠死)误杀
        var reP = new RegExp(e + '(?:[^。！？；;.!?\\n]{0,12}[，,、])?(?:旋|竟|遂|已|终|卒)?被(?!命|令|饬|派|遣|敕|诏|委|差|使|着)' + NP + '(?:' + transAlt + ')');
        // 『为…所』被动分支·此结构无歧义(为乱兵所杀/所害/所弑/所戕=被杀)·补收"害/弑/戕"及前置副词
        var reW = new RegExp(e + '(?:[^。！？；;.!?\\n]{0,12}[，,、])?(?:旋|竟|遂|已|终|卒)?为' + NP + '所' + NP + '(?:' + transAlt + '|害|弑|戕|毙|殒)');
        // 处置式: 把X…砍了 (只认"把"·"将"歧义[将领/将要]不用·"命/令X…"是施事者故排除)
        var reB = new RegExp('把\\s*' + e + NP + '(?:' + transAlt + ')');
        // 动宾: 斩首X / 斩X / 赐死X / 斩杀叛将X (动词紧邻名前·名为受事·允许一个受害者身份词窗口)
        var _victimRole = '(?:叛将|叛臣|叛贼|逆贼|逆臣|逆首|逆酋|贼首|贼酋|反贼|首恶|元凶|巨魁|渠魁|巨寇|渠帅|奸党|逆党|逆犯|要犯|钦犯)?';
        var reV = new RegExp('(?:' + transAlt + ')(?:了|之|讫|于[^。！？；，、\\n]{0,4})?' + _victimRole + '\\s*' + e);
        // 自戕/受事名前: X自尽 / X伏诛
        var reI = new RegExp(e + '[^。！？；;，,、\\n]{0,4}(?:' + intransAlt + ')');
        // 自然/含糊死亡·名前即受事(病故/薨逝/遇害/城破身死…)·捕窗口·夹关系词则跳过·拆暴力/纯自然两条
        var reNv = new RegExp(e + '([^。！？；;，,、\\n]{0,4})(?:' + natViolentAlt + ')');
        var reNp = new RegExp(e + '([^。！？；;，,、\\n]{0,4})(?:' + natPlainAlt + ')');
        // deathKind: 'active'=主动致死/暴力殉难(隐含本回合致死事件·有源·照旧补录) · 'bare'=裸自戕/裸伏诛/纯自然死(疑史实幻觉·须刀9源头判据)
        var _vpref = '处决', _deathKind = 'active';
        if ((m = reP.exec(narrativeText))) hit = m[0];
        else if ((m = reW.exec(narrativeText))) hit = m[0];
        else if ((m = reB.exec(narrativeText))) hit = m[0];
        else if ((m = reV.exec(narrativeText))) hit = m[0];
        else if ((m = reI.exec(narrativeText))) { hit = m[0]; _deathKind = 'bare'; }   // 裸自戕/裸伏诛(伏诛/弃市/自缢/自尽)·历史命运回忆高发·刀9 须外部源
        else if ((m = reNv.exec(narrativeText)) && !_relRe.test(m[1] || '')) { hit = m[0]; _vpref = '身故'; }   // 暴力殉难(遇害/殉城/城破身死)·隐含本回合致死事件·视为有源
        else if ((m = reNp.exec(narrativeText)) && !_relRe.test(m[1] || '')) { hit = m[0]; _vpref = '身故'; _deathKind = 'bare'; }   // 纯自然死(病故/薨逝/寿终)·无本回合致因·刀9 须外部源
        if (!hit) return;
        var key = nm + '_execute';
        if (mentioned.find(function(x){return x.key===key;})) return;
        // reason 带『处决』(处决/自戕)或『身故』(自然死)令 onDismissal 置 alive=false·原文附死因便追溯·deathKind 供刀9 源头判据
        mentioned.push({ key: key, name: nm, action: 'execute', verb: _vpref + '·据叙事「' + hit + '」', raw: hit, deathKind: _deathKind });
      });
    })();

    if (!mentioned.length) return;

    // 已在结构化数据中处理的人·跳过
    var handled = {};
    (aiOutput.personnel_changes || []).forEach(function(pc) {
      if (pc && pc.name) handled[pc.name] = true;
    });
    (aiOutput.office_assignments || []).forEach(function(oa) {
      if (oa && oa.name && (oa.action === 'dismiss' || oa.action === 'transfer')) handled[oa.name] = true;
    });
    (aiOutput.char_updates || []).forEach(function(cu) {
      if (cu && cu.name && cu.updates) {
        var u = cu.updates;
        // AI 本回合动过任一状态字段(设或清·含释放_imprisoned:false)就交给它·校验器不再从叙事覆盖
        if (u.alive !== undefined || u._imprisoned !== undefined || u._exiled !== undefined ||
            u._retired !== undefined || u._fled !== undefined || u._confiscated !== undefined) handled[cu.name] = true;
      }
    });
    // AI 已正经填结构化死亡的·由 applyCharacterDeaths 落地·此处不再从叙事重复补录。
    //   主链 SC1 stage 现已随主叙事同传标准 character_deaths 键·主链结构化死者进 handled 直接跳过·免错记无源+吐垃圾弱提示。
    (aiOutput.character_deaths || []).forEach(function(cd) {
      if (cd && cd.name) handled[cd.name] = true;
    });

    var missing = mentioned.filter(function(m){
      if (handled[m.name]) return false;
      // 幂等·防叙事复述重复施加(放了又被关/抄两次/莫名重复)
      if (_alreadyResolvedState(charNameSet[m.name], m.action, G)) return false;
      return true;
    });
    if (!missing.length) return;

    // 补录·分两类落库(2026-07-16·落库契约硬化刀①)：
    //   ①死亡类(execute)：★不再 onDismissal 直写 ch.alive=false★——旧路径绕过「玩家之死裁决器」
    //     (adjudicatePlayerDeath·合法继统门)与死亡级联(军队摘帅/丁忧/势力首领/头衔/governor/后宫)：
    //     narrative 里「赐死玩家角色」经此会静默置死、既不路由继统也不触终局(尸政/无嗣不终局)。
    //     改为合成 character_deaths 同构条目投喂既有死亡管线 applyOneDeath(实体解析+玩家裁决器+全级联)·
    //     与 AI 正经填 character_deaths 落到的 sink 完全一致。极端沙箱(管线缺位)才回落 onDismissal 保「死者必落库」不丢兜底。
    //   ②非致死类(下狱/抄家/流放/致仕/逃亡/罢官)：保留 onDismissal 直写·但前置实体存在性(精确命中 GM.chars)
    //     + 死人防线(死人不下狱)·含糊/查无此人/已死者→不落账·入 skipped 留痕(原句摘录)供 playtest 排查。
    var patched = 0;
    var skipped = [];   // 不落账候选·留痕(实体缺失/死者/路由失败·非静默)
    function _routeDeathToPipeline(ch, reason) {
      // 投喂既有死亡管线·吃实体解析+已死早退+玩家之死裁决器(applyOneDeath→adjudicatePlayerDeath)·非 onDismissal 直写
      var cd = { name: ch.name, reason: reason };
      try {
        if (typeof global.applyOneDeath === 'function') { global.applyOneDeath(cd); return ch.alive === false; }
        if (typeof global.applyCharacterDeaths === 'function') { global.applyCharacterDeaths({ character_deaths: [cd] }); return ch.alive === false; }
      } catch(_de) {
        try { window.TM && TM.errors && TM.errors.captureSilent && TM.errors.captureSilent(_de, 'personnel-validator-death'); } catch(__){}
      }
      return false;
    }
    missing.forEach(function(m) {
      // 实体存在性·须精确命中 GM.chars(charNameSet 仅收 alive!==false 的正名/字)·含糊/多义匹配自然落空
      var ch = charNameSet[m.name];
      if (!ch) { skipped.push({ name: m.name, action: m.action, reason: 'entity-not-found', raw: m.raw }); return; }
      // 死人防线：非致死动作对已死者不落账(死人不下狱/不抄家)·致死动作已由 _alreadyResolvedState 幂等过滤
      if (m.action !== 'execute' && ch.alive === false) { skipped.push({ name: ch.name, action: m.action, reason: 'already-dead', raw: m.raw }); return; }
      try {
        if (m.action === 'execute') {
          // ── 刀9·无源史实幻觉死亡反向闸(2026-07-19) ─────────────────────────────
          //  裸自戕/裸伏诛(reI)与纯自然死(reN-plain·病故/薨逝/寿终)是 AI「按真实历史幻觉」的高发形态。
          //  若本回合无任何源头(玩家角色/司法态/结构化死亡意图/玩家诏令) → 判为孤立叙事幻觉·★不落库★·
          //  改投既有弱自查纸条 GM._aiWeakWriteHints(下回合轻喂 AI·可忽略)+console 留痕·避免污染存档。
          //  主动致死(被斩/把X砍/斩X/赐死X)与暴力殉难(遇害/殉城/城破身死)属 deathKind==='active'·不入本闸·零改动。
          if (m.deathKind === 'bare' && !_narrativeDeathSourced(G, aiOutput, ch)) {
            if (!G._aiWeakWriteHints) G._aiWeakWriteHints = [];   // arch-ok·弱自查纸条 sink·与 reconcile 侧 _tmPushAIWeakHint 同构
            G._aiWeakWriteHints.push({ label: '无源叙事死亡', reason: '孤立叙事死亡·本回合无死亡意图/玩家诏令/司法前置·疑 AI 史实幻觉', itemName: ch.name, source: 'personnel-validator-no-source', active: null, turn: G.turn || 0 });   // arch-ok
            if (G._aiWeakWriteHints.length > 20) G._aiWeakWriteHints = G._aiWeakWriteHints.slice(-20);   // arch-ok
            try { if (typeof global.recordAIDiagnostic === 'function') global.recordAIDiagnostic('write_hint', { label: '无源叙事死亡', itemName: ch.name, raw: m.raw }); } catch(_rhE) {}
            skipped.push({ name: ch.name, action: m.action, reason: 'no-source-isolated-death', raw: m.raw });
            console.warn('[PersonnelValidator] 无源孤立叙事死亡·不落库(转弱自查纸条留痕): ' + ch.name + ' ← 「' + m.raw + '」');
            return;
          }
          if (_routeDeathToPipeline(ch, m.verb)) {
            patched++;
            if (global.addEB) global.addEB('校验补录', '人事校验器·' + ch.name + '『' + m.verb + '』经死亡管线补录入库(原文: ' + m.raw + ')');
          } else {
            // 回落·环境无死亡管线(极端沙箱)→仍走 onDismissal 保死者落库·不丢兜底
            var rf = onDismissal(ch.name, m.verb);
            if (rf && rf.ok) {
              patched++;
              if (global.addEB) global.addEB('校验补录', '人事校验器·' + ch.name + '『' + m.verb + '』补录入库(回落·原文: ' + m.raw + ')');
            } else {
              skipped.push({ name: ch.name, action: m.action, reason: (rf && rf.reason) || 'death-route-failed', raw: m.raw });
            }
          }
        } else {
          // 非致死类·调 onDismissal·reason 用 verb 让函数内部 regex 命中状态分支
          var r = onDismissal(ch.name, m.verb);
          if (r && r.ok) {
            patched++;
            if (global.addEB) global.addEB('校验补录', '人事校验器·' + ch.name + '『' + m.verb + '』补录入库(原文: ' + m.raw + ')');
          } else {
            skipped.push({ name: ch.name, action: m.action, reason: (r && r.reason) || 'onDismissal-failed', raw: m.raw });
          }
        }
      } catch(_e) {
        try { window.TM && TM.errors && TM.errors.captureSilent && TM.errors.captureSilent(_e, 'personnel-validator'); } catch(__){}
      }
    });

    if (!G._personnelValidatorLog) G._personnelValidatorLog = [];
    G._personnelValidatorLog.push({ turn: G.turn || 0, missing: missing, patched: patched, skipped: skipped });
    if (G._personnelValidatorLog.length > 20) G._personnelValidatorLog = G._personnelValidatorLog.slice(-20);

    if (G._turnReport) {
      G._turnReport.push({ type: 'personnel_validation', missing: missing, patched: patched, skipped: skipped, turn: G.turn || 0 });
    }

    console.warn('[PersonnelValidator] 叙事提及但 AI 未填结构化的人物状态变化(已自动补录 ' + patched + '/' + missing.length + '):', missing);
    if (skipped.length) console.warn('[PersonnelValidator] 存疑未落账(实体缺失/死者/路由失败·已留痕):', skipped);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  通用 helper: 从 narrative 抓所有文本·供各领域 validator 用
  // ═══════════════════════════════════════════════════════════════════
  function _getNarrativeText(aiOutput) {
    var t = '';
    if (!aiOutput) return t;
    if (aiOutput.narrative)    t += String(aiOutput.narrative) + '\n';
    if (aiOutput.shilu_text)   t += String(aiOutput.shilu_text) + '\n';
    if (aiOutput.shizhengji)   t += String(aiOutput.shizhengji) + '\n';
    if (aiOutput.yupiHuiting)  t += String(aiOutput.yupiHuiting) + '\n';
    if (aiOutput.qijuHistory)  t += String(aiOutput.qijuHistory) + '\n';
    if (aiOutput.event && aiOutput.event.desc) t += String(aiOutput.event.desc) + '\n';
    if (Array.isArray(aiOutput.events)) {
      aiOutput.events.forEach(function(e){ if (e && e.desc) t += String(e.desc) + '\n'; });
    }
    if (Array.isArray(aiOutput.npc_actions)) {
      aiOutput.npc_actions.forEach(function(na){ if (na && na.desc) t += String(na.desc) + '\n'; });
    }
    return t;
  }

  function _firstNarrativeHit(text, keywords) {
    for (var i = 0; i < keywords.length; i++) {
      if (text.indexOf(keywords[i]) >= 0) return keywords[i];
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  军事一致性校验器·Wave 1b
  //  扫『扩军/募兵/裁汰 N 万兵』vs GM.armies / military_changes
  // ═══════════════════════════════════════════════════════════════════
  function _validateMilitaryConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return;

    // 数字解析(中阿混合)
    function parseNum(s, mult) {
      var cnMap = {'零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'百':100,'千':1000,'万':10000};
      var n = parseFloat(s);
      if (isNaN(n) || n <= 0) {
        n = 0; var prev = 0;
        for (var i = 0; i < s.length; i++) {
          var ch = s.charAt(i);
          if (cnMap[ch] != null) {
            if (ch === '十' || ch === '百' || ch === '千' || ch === '万') prev = (prev || 1) * cnMap[ch];
            else prev = prev * 10 + cnMap[ch];
          }
        }
        n = prev;
      }
      if (mult === '万') n *= 10000;
      else if (mult === '千') n *= 1000;
      return n;
    }

    // 增兵动词 + 减兵动词
    var addVerbs = '招募|募兵|招兵|增兵|扩军|新建|添募|添兵|增编|拨补|增添';
    var cutVerbs = '裁汰|裁军|裁撤|遣散|罢遣|裁革|削减|裁减';
    var lossVerbs = '阵亡|战死|溃散|逃亡|染瘟|染瘴';
    function _scan(verbs, kind) {
      var pat = new RegExp('(' + verbs + ')[^。；,\\s]{0,8}?([\\d一二三四五六七八九十百千万]+)\\s*(万|千)?\\s*(兵|人|卒|马|骑|众|甲)', 'g');
      var arr = [], m;
      while ((m = pat.exec(narrative)) !== null) {
        var n = parseNum(m[2], m[3] || '');
        if (n < 100) continue;
        arr.push({ kind: kind, verb: m[1], num: n, raw: m[0] });
      }
      return arr;
    }
    var mentioned = [].concat(_scan(addVerbs, 'add'), _scan(cutVerbs, 'cut'), _scan(lossVerbs, 'loss'));
    if (!mentioned.length) return;

    // 与 military_changes / npc_actions 中军事行动对比·结构化数据中是否有同等量变
    var structuredTotal = { add: 0, cut: 0, loss: 0 };
    if (Array.isArray(aiOutput.military_changes)) {
      aiOutput.military_changes.forEach(function(mc) {
        if (!mc) return;
        var n = Math.abs(parseInt(mc.delta) || 0);
        if (mc.delta > 0) structuredTotal.add += n;
        else if (mc.delta < 0) structuredTotal.cut += n;
      });
    }
    if (aiOutput.battleResult && aiOutput.battleResult.casualties) {
      var brLoss = aiOutput.battleResult.casualties;
      structuredTotal.loss += Math.max(0, Math.round(Number(brLoss.attacker || 0)));
      structuredTotal.loss += Math.max(0, Math.round(Number(brLoss.defender || 0)));
    }

    var mentTotal = { add: 0, cut: 0, loss: 0 };
    mentioned.forEach(function(x) { mentTotal[x.kind] += x.num; });

    var warnings = [];
    ['add','cut','loss'].forEach(function(k) {
      if (mentTotal[k] <= 1000) return;  // 千以下噪声
      if (structuredTotal[k] < mentTotal[k] * 0.5) {
        warnings.push({ kind: k, mentioned: mentTotal[k], structured: structuredTotal[k], shortfall: mentTotal[k] - structuredTotal[k] });
      }
    });

    if (!warnings.length) return;

    if (!G._militaryValidatorLog) G._militaryValidatorLog = [];
    G._militaryValidatorLog.push({ turn: G.turn || 0, warnings: warnings, samples: mentioned.slice(0, 5) });
    if (G._militaryValidatorLog.length > 20) G._militaryValidatorLog = G._militaryValidatorLog.slice(-20);

    if (G._turnReport) G._turnReport.push({ type: 'military_validation', warnings: warnings, samples: mentioned.slice(0, 5), turn: G.turn || 0 });
    console.warn('[MilitaryValidator] 叙事兵数与结构化 military_changes 偏差:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  民心/皇威/皇权一致性校验器·Wave 1b
  //  扫『民心大振/民怨沸腾/朝野失望/天下共愤』 vs turnChanges.variables 中民心/皇威/皇权 delta
  // ═══════════════════════════════════════════════════════════════════
  function _validateSentimentConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return;

    // 极性词典: 正向情绪(应升民心/皇威) vs 负向(应降)
    var positiveKW = /民心大振|百姓欢悦|歌颂圣明|海内归心|朝野振奋|众心翕然|万民欣戴|四海升平|拥护|赞颂|拊掌|颂扬/g;
    var negativeKW = /民怨沸腾|怨声载道|朝野失望|天下共愤|举国震骇|民不聊生|流离失所|冤死狼藉|弃捐道路|哀鸿遍野|怨望|愤激|忿恚|骚然/g;
    var posCount = (narrative.match(positiveKW) || []).length;
    var negCount = (narrative.match(negativeKW) || []).length;
    if (posCount === 0 && negCount === 0) return;

    // 检查 turnChanges 是否含 民心/皇威/皇权 delta
    var sentDelta = 0;
    var tc = (G.turnChanges && G.turnChanges.variables) || [];
    tc.forEach(function(v) {
      if (!v || !v.name) return;
      if (/民心|皇威|皇权|声望|威信|拥戴/.test(v.name)) {
        sentDelta += (v.delta || (v.newValue||0) - (v.oldValue||0));
      }
    });

    var warnings = [];
    // 强正向但 sentDelta 不正 → 警告
    if (posCount >= 2 && sentDelta <= 0) {
      warnings.push({ kind: 'positive_no_uplift', posCount: posCount, sentDelta: sentDelta });
    }
    // 强负向但 sentDelta 不负 → 警告
    if (negCount >= 2 && sentDelta >= 0) {
      warnings.push({ kind: 'negative_no_drop', negCount: negCount, sentDelta: sentDelta });
    }

    if (!warnings.length) return;

    if (!G._sentimentValidatorLog) G._sentimentValidatorLog = [];
    G._sentimentValidatorLog.push({ turn: G.turn || 0, posCount: posCount, negCount: negCount, sentDelta: sentDelta, warnings: warnings });
    if (G._sentimentValidatorLog.length > 20) G._sentimentValidatorLog = G._sentimentValidatorLog.slice(-20);

    if (G._turnReport) G._turnReport.push({ type: 'sentiment_validation', warnings: warnings, turn: G.turn || 0 });
    console.warn('[SentimentValidator] 叙事情绪与变量变动不一致·posKW=' + posCount + '·negKW=' + negCount + '·sentDelta=' + sentDelta + ':', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  户口一致性校验器·Wave 1b
  //  扫『饥荒死 N/逃户 M/迁徙 X』 vs GM.population.* 实际变动
  // ═══════════════════════════════════════════════════════════════════
  function _validatePopulationConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return;

    function _pn(s, mult) {
      var cnMap = {'零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'百':100,'千':1000,'万':10000};
      var n = parseFloat(s);
      if (isNaN(n) || n <= 0) {
        n = 0;
        for (var i = 0; i < s.length; i++) {
          var ch = s.charAt(i);
          if (cnMap[ch] != null) {
            if (ch === '十' || ch === '百' || ch === '千' || ch === '万') n = (n || 1) * cnMap[ch];
            else n = n * 10 + cnMap[ch];
          }
        }
      }
      if (mult === '万') n *= 10000;
      return n;
    }

    var deathVerbs = '饿死|冻死|疫死|战死|灾亡|溺死|染瘟|疫亡|流亡|罹难|罹疫';
    var fleeVerbs = '逃亡|逃难|流离|迁徙|迁移|流民';
    function _scan(verbs, kind) {
      var pat = new RegExp('(' + verbs + ')[^。；,\\s]{0,10}?([\\d一二三四五六七八九十百千万]+)\\s*(万|千)?\\s*(口|户|人|众)', 'g');
      var arr = [], m;
      while ((m = pat.exec(narrative)) !== null) {
        var n = _pn(m[2], m[3] || '');
        if (n < 100) continue;
        arr.push({ kind: kind, verb: m[1], num: n, raw: m[0] });
      }
      return arr;
    }
    var mentioned = [].concat(_scan(deathVerbs, 'death'), _scan(fleeVerbs, 'flee'));
    if (!mentioned.length) return;

    // 与 turnChanges.variables 中户口 delta 对比
    var popDelta = { death: 0, flee: 0 };
    var tc = (G.turnChanges && G.turnChanges.variables) || [];
    tc.forEach(function(v) {
      if (!v || !v.name) return;
      var d = (v.delta || (v.newValue||0) - (v.oldValue||0));
      if (/口|人口|mouths|总口|户籍|户口/.test(v.name)) {
        if (d < 0) popDelta.death += Math.abs(d);
      }
      if (/逃户|流民|fugitives/.test(v.name)) {
        if (d > 0) popDelta.flee += d;
      }
    });

    var mentTotal = { death: 0, flee: 0 };
    mentioned.forEach(function(x) { mentTotal[x.kind] += x.num; });

    var warnings = [];
    if (mentTotal.death > 1000 && popDelta.death < mentTotal.death * 0.3) {
      warnings.push({ kind: 'death', mentioned: mentTotal.death, structured: popDelta.death, shortfall: mentTotal.death - popDelta.death });
    }
    if (mentTotal.flee > 1000 && popDelta.flee < mentTotal.flee * 0.3) {
      warnings.push({ kind: 'flee', mentioned: mentTotal.flee, structured: popDelta.flee, shortfall: mentTotal.flee - popDelta.flee });
    }

    if (!warnings.length) return;

    if (!G._populationValidatorLog) G._populationValidatorLog = [];
    G._populationValidatorLog.push({ turn: G.turn || 0, warnings: warnings, samples: mentioned.slice(0, 5) });
    if (G._populationValidatorLog.length > 20) G._populationValidatorLog = G._populationValidatorLog.slice(-20);

    if (G._turnReport) G._turnReport.push({ type: 'population_validation', warnings: warnings, samples: mentioned.slice(0, 5), turn: G.turn || 0 });
    console.warn('[PopulationValidator] 叙事人口变动与结构化偏差:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  官职任免一致性校验器·Wave 1b
  //  扫『拜 X 为 Y / 擢 X 为 Y / 迁 X 为 Y / 命 X 为 Y』vs office_assignments
  // ═══════════════════════════════════════════════════════════════════
  function _validateOfficeConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return;

    var allChars = (G.chars || []).filter(function(c){return c && c.name && c.alive !== false;});
    var charNames = {};
    allChars.forEach(function(c){ charNames[c.name] = c; });

    // 任命动词 + 人名 + 为 + 官职
    var appointVerbs = '拜|擢|迁|转|命|授|任|升|进|起|起复|改任|擢任|超擢|兼任|兼职|加兼|兼领|兼署|兼管|兼摄';
    // 模式 1: 动词 X 为/任 Y
    var pat = new RegExp('(' + appointVerbs + ')\\s*([\\u4e00-\\u9fff]{2,4})\\s*(?:为|任)\\s*([\\u4e00-\\u9fff]{2,12})', 'g');

    var mentioned = [];
    var m;
    while ((m = pat.exec(narrative)) !== null) {
      var name = m[2];
      var post = m[3];
      if (!charNames[name]) continue;
      var key = name + '_' + post;
      if (mentioned.find(function(x){return x.key===key;})) continue;
      mentioned.push({ key: key, name: name, post: post, verb: m[1], raw: m[0] });
    }
    if (!mentioned.length) return;

    var handled = {};
    (aiOutput.office_assignments || []).forEach(function(oa) {
      if (oa && oa.name && (oa.action === 'appoint' || oa.action === 'transfer')) handled[oa.name] = true;
    });
    (aiOutput.personnel_changes || []).forEach(function(pc) {
      if (pc && pc.name) handled[pc.name] = true;
    });

    var missing = mentioned.filter(function(m){ return !handled[m.name]; });
    if (!missing.length) return;

    // 自动补录·调 onAppointment
    var patched = 0;
    missing.forEach(function(m) {
      try {
        if (typeof onAppointment === 'function') {
          var r = onAppointment(m.name, m.post, { concurrent: /兼任|兼职|加兼|兼领|兼署|兼管|兼摄/.test(m.raw), reason: m.raw });
          if (r && r.ok) {
            patched++;
            if (global.addEB) global.addEB('校验补录', '官职校验·' + m.name + '『' + m.verb + '为' + m.post + '』补录(原文: ' + m.raw + ')');
          }
        }
      } catch(_e) {
        try { window.TM && TM.errors && TM.errors.captureSilent && TM.errors.captureSilent(_e, 'office-validator'); } catch(__){}
      }
    });

    if (!G._officeValidatorLog) G._officeValidatorLog = [];
    G._officeValidatorLog.push({ turn: G.turn || 0, missing: missing, patched: patched });
    if (G._officeValidatorLog.length > 20) G._officeValidatorLog = G._officeValidatorLog.slice(-20);

    if (G._turnReport) G._turnReport.push({ type: 'office_validation', missing: missing, patched: patched, turn: G.turn || 0 });
    console.warn('[OfficeValidator] 叙事任命与 office_assignments 漏录(补 ' + patched + '/' + missing.length + '):', missing);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  保守版·14f-1·战争一致性校验
  //  扫描 narrative 中『起兵/北伐/讨伐/议和/罢兵/大败/陷落』·对照 GM.activeWars
  // ═══════════════════════════════════════════════════════════════════
  function _validateWarConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return;

    // 开战/扩战动词
    var warStartVerbs = ['起兵','兴师','讨伐','征伐','北伐','南征','东征','西征','进犯','入寇','犯境','寇边','兵临','出兵','开战','起衅','启衅','南下','北上'];
    // 议和/结束动词
    var warEndVerbs = ['议和','和谈','罢兵','讲和','纳贡','约和','盟约','停战','受降','献降','纳款','奉表','称臣'];
    // 战役结果动词
    var battleVerbs = ['大败','大捷','克复','陷落','失守','收复','破','突围','会战','激战','溃败','全军覆没','戍御','解围'];

    var startKw = _firstNarrativeHit(narrative, warStartVerbs);
    var endKw = _firstNarrativeHit(narrative, warEndVerbs);
    var battleKw = _firstNarrativeHit(narrative, battleVerbs);
    if (!startKw && !endKw && !battleKw) return;

    var warnings = [];
    var existingWars = Array.isArray(G.activeWars) ? G.activeWars : [];
    var beforeCount = (applied && typeof applied._warsBefore === 'number') ? applied._warsBefore : existingWars.length;
    // narrative 提到开战·但 activeWars 数量未增加
    if (startKw && existingWars.length <= beforeCount) {
      warnings.push({ kind: 'war_start_missing', keyword: startKw, snippet: _snippetAround(narrative, startKw, 30) });
    }
    // narrative 提到议和·但没有 war.status 变 ended/peaced
    if (endKw) {
      var hasPeaced = existingWars.some(function(w) { return w && (w.status === 'ended' || w.status === 'peace' || w.status === 'truce' || w.endedTurn); });
      if (!hasPeaced) warnings.push({ kind: 'war_end_missing', keyword: endKw, snippet: _snippetAround(narrative, endKw, 30) });
    }
    // narrative 提到具体战役·但 war.battles 都为空
    if (battleKw) {
      var hasBattle = existingWars.some(function(w) { return w && Array.isArray(w.battles) && w.battles.length > 0; });
      if (!hasBattle && existingWars.length > 0) {
        warnings.push({ kind: 'battle_missing', keyword: battleKw, snippet: _snippetAround(narrative, battleKw, 30) });
      }
    }
    if (!warnings.length) return;

    if (!G._warValidatorLog) G._warValidatorLog = [];
    G._warValidatorLog.push({ turn: G.turn || 0, warnings: warnings });
    if (G._warValidatorLog.length > 20) G._warValidatorLog = G._warValidatorLog.slice(-20);
    if (G._turnReport) G._turnReport.push({ type: 'war_validation', warnings: warnings, turn: G.turn || 0 });
    console.warn('[WarValidator] 战争一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  保守版·14f-2·民变一致性校验
  //  扫描 narrative 中『起事/聚众/作乱/平定/招抚』·对照 G.minxin.revolts
  // ═══════════════════════════════════════════════════════════════════
  function _validateRevoltConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return;

    var revoltStartVerbs = ['起事','起义','造反','反叛','暴动','聚众','啸聚','揭竿','作乱','民变','匪乱','盗起','贼起','倡乱','倡反','倡叛','流寇'];
    var revoltEndVerbs = ['镇压','平定','剿','扑灭','招抚','宣抚','讨平','戡定','平息','靖','勘平'];

    var startKw = _firstNarrativeHit(narrative, revoltStartVerbs);
    var endKw = _firstNarrativeHit(narrative, revoltEndVerbs);
    if (!startKw && !endKw) return;

    var warnings = [];
    var existingRevolts = (G.minxin && Array.isArray(G.minxin.revolts)) ? G.minxin.revolts : [];
    var beforeCount = (applied && typeof applied._revoltsBefore === 'number') ? applied._revoltsBefore : existingRevolts.length;
    if (startKw && existingRevolts.length <= beforeCount) {
      warnings.push({ kind: 'revolt_start_missing', keyword: startKw, snippet: _snippetAround(narrative, startKw, 30) });
    }
    if (endKw) {
      var hasEnded = existingRevolts.some(function(r) {
        return r && (r.status === 'suppressed' || r.status === 'appeased' || r.status === 'ended' || r.endedTurn);
      });
      var hasOngoingBefore = existingRevolts.some(function(r) { return r && r.status === 'ongoing'; });
      if (!hasEnded && hasOngoingBefore) {
        warnings.push({ kind: 'revolt_end_missing', keyword: endKw, snippet: _snippetAround(narrative, endKw, 30) });
      }
    }
    if (!warnings.length) return;

    if (!G._revoltValidatorLog) G._revoltValidatorLog = [];
    G._revoltValidatorLog.push({ turn: G.turn || 0, warnings: warnings });
    if (G._revoltValidatorLog.length > 20) G._revoltValidatorLog = G._revoltValidatorLog.slice(-20);
    if (G._turnReport) G._turnReport.push({ type: 'revolt_validation', warnings: warnings, turn: G.turn || 0 });
    console.warn('[RevoltValidator] 民变一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  保守版·14f-3·天灾一致性校验
  //  扫描 narrative 中『大旱/洪/蝗/瘟疫/地震』·对照 G.activeDisasters
  // ═══════════════════════════════════════════════════════════════════
  function _validateDisasterConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return;

    var disasterCategories = {
      drought: ['大旱','亢旱','赤地','久旱','久不雨','焦土','草木枯','禾稼焦'],
      flood: ['大水','洪水','决堤','江溢','河溢','暴雨','水患','溃决','汎滥','泛滥'],
      locust: ['蝗','飞蝗','蝻'],
      plague: ['大疫','瘟疫','疠疫','染疫','疫死','瘟','时疫','痘疹'],
      quake: ['地动','地震','地陷','山崩','山摇']
    };

    function _hitCat() {
      var hits = [];
      Object.keys(disasterCategories).forEach(function(cat) {
        for (var i = 0; i < disasterCategories[cat].length; i++) {
          if (narrative.indexOf(disasterCategories[cat][i]) >= 0) {
            hits.push({ category: cat, keyword: disasterCategories[cat][i] });
            break;
          }
        }
      });
      return hits;
    }
    var hitList = _hitCat();
    if (!hitList.length) return;

    var warnings = [];
    var existingDisasters = Array.isArray(G.activeDisasters) ? G.activeDisasters : [];
    var beforeCount = (applied && typeof applied._disastersBefore === 'number') ? applied._disastersBefore : existingDisasters.length;
    // 若 narrative 命中灾害关键词·但 activeDisasters 数量未增加·按命中类别报警
    if (existingDisasters.length <= beforeCount) {
      hitList.forEach(function(h) {
        warnings.push({ kind: 'disaster_missing', category: h.category, keyword: h.keyword, snippet: _snippetAround(narrative, h.keyword, 30) });
      });
    } else {
      // 数量增加了·但要核对类别匹配
      var existingCats = {};
      existingDisasters.forEach(function(d) {
        if (d && (d.type || d.category)) existingCats[d.type || d.category] = true;
      });
      hitList.forEach(function(h) {
        if (!existingCats[h.category] && !existingCats[h.keyword]) {
          warnings.push({ kind: 'disaster_category_mismatch', category: h.category, keyword: h.keyword, snippet: _snippetAround(narrative, h.keyword, 30) });
        }
      });
    }
    if (!warnings.length) return;

    if (!G._disasterValidatorLog) G._disasterValidatorLog = [];
    G._disasterValidatorLog.push({ turn: G.turn || 0, warnings: warnings });
    if (G._disasterValidatorLog.length > 20) G._disasterValidatorLog = G._disasterValidatorLog.slice(-20);
    if (G._turnReport) G._turnReport.push({ type: 'disaster_validation', warnings: warnings, turn: G.turn || 0 });
    console.warn('[DisasterValidator] 天灾一致性警告:', warnings);
  }

  // 辅助·取关键词附近文本
  function _snippetAround(text, keyword, span) {
    var idx = text.indexOf(keyword);
    if (idx < 0) return '';
    var start = Math.max(0, idx - span);
    var end = Math.min(text.length, idx + keyword.length + span);
    return text.substring(start, end);
  }
  // 辅助·命中关键词数组中的任一项
  function _firstHit(text, arr) {
    for (var i = 0; i < arr.length; i++) if (text.indexOf(arr[i]) >= 0) return arr[i];
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  激进版·14f-4·外交一致性校验
  //  扫『通使/朝贡/绝交/羁縻/抚夷』·对照 G.facs[].relations / attitude
  // ═══════════════════════════════════════════════════════════════════
  function _validateDiplomacyConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var startKw = _firstHit(narrative, ['通使','缔盟','和好','朝贡','纳款','纳贡','遣使','称臣','羁縻','抚夷','封贡']);
    var endKw = _firstHit(narrative, ['绝交','逐使','断绝','宣战','犯界','寇边','弃约','背盟']);
    if (!startKw && !endKw) return;
    // facs.attitude / relations 是否本回合有 update
    var fuArr = aiOutput.faction_updates || [];
    var hasRelationFallback = applied && applied.semantic && applied.semantic.faction_field_fallback > 0 &&
      (G._turnReport || []).some(function(r){ return r && r.turn === (G.turn || 0) && r.type === 'faction_update' && r.field === 'relation'; });
    var hasFactionUpdate = fuArr.length > 0 || hasRelationFallback || (G.turnChanges && (G.turnChanges.factions||[]).length > 0);
    if (hasFactionUpdate) return;
    var warnings = [];
    if (startKw) warnings.push({ kind: 'diplomacy_friendly_missing', keyword: startKw, snippet: _snippetAround(narrative, startKw, 30) });
    if (endKw) warnings.push({ kind: 'diplomacy_hostile_missing', keyword: endKw, snippet: _snippetAround(narrative, endKw, 30) });
    if (!warnings.length) return;
    if (!G._diplomacyValidatorLog) G._diplomacyValidatorLog = [];
    G._diplomacyValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._diplomacyValidatorLog.length > 20) G._diplomacyValidatorLog = G._diplomacyValidatorLog.slice(-20);
    console.warn('[DiplomacyValidator] 外交一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  激进版·14f-5·科举一致性校验
  //  扫『开科/会试/殿试/放榜/赐进士』·对照 P.keju
  // ═══════════════════════════════════════════════════════════════════
  function _validateKejuConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var kw = _firstHit(narrative, ['开科','会试','殿试','放榜','赐进士','钦点状元','钦定三甲','一甲及第','二甲赐进士','金榜','龙虎榜','春闱','秋闱','恩科','乡试','贡士']);
    if (!kw) return;
    var Pref = (typeof P !== 'undefined') ? P : null;
    var kejuActive = (Pref && Pref.keju && (Pref.keju.currentExam || (Pref.keju.history && Pref.keju.history.length)));
    if (kejuActive) return;
    var warnings = [{ kind: 'keju_missing', keyword: kw, snippet: _snippetAround(narrative, kw, 30) }];
    if (!G._kejuValidatorLog) G._kejuValidatorLog = [];
    G._kejuValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._kejuValidatorLog.length > 20) G._kejuValidatorLog = G._kejuValidatorLog.slice(-20);
    console.warn('[KejuValidator] 科举一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  激进版·14f-6·党派一致性校验
  //  扫『结党/立党/盟誓/解散/瓦解/弹劾』·对照 GM.parties[]
  // ═══════════════════════════════════════════════════════════════════
  function _validatePartyConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var formKw = _firstHit(narrative, ['结社','立党','结党','盟誓','倡党','倡议设','门户','朋党','立社']);
    var endKw = _firstHit(narrative, ['解散','瓦解','分裂','分崩','倾覆','清党','除党','禁社']);
    if (!formKw && !endKw) return;
    var existing = Array.isArray(G.parties) ? G.parties : [];
    var beforeCount = (applied && typeof applied._partiesBefore === 'number') ? applied._partiesBefore : existing.length;
    var hasUpdate = (aiOutput.party_updates || []).length > 0;
    if (hasUpdate) return;
    var warnings = [];
    if (formKw && existing.length <= beforeCount) warnings.push({ kind: 'party_form_missing', keyword: formKw, snippet: _snippetAround(narrative, formKw, 30) });
    if (endKw && existing.length >= beforeCount && existing.some(function(p){return p && p.status==='active';})) warnings.push({ kind: 'party_end_missing', keyword: endKw, snippet: _snippetAround(narrative, endKw, 30) });
    if (!warnings.length) return;
    if (!G._partyValidatorLog) G._partyValidatorLog = [];
    G._partyValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._partyValidatorLog.length > 20) G._partyValidatorLog = G._partyValidatorLog.slice(-20);
    console.warn('[PartyValidator] 党派一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  激进版·14f-7·法令效力一致性校验
  //  扫『颁诏/降旨/敕谕/废制/施行新政/罢...诏』·对照 GM.activeEdicts
  // ═══════════════════════════════════════════════════════════════════
  function _validateEdictEffectConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    // “下诏狱”中的“下诏”是司法动作，不是颁布诏令。先遮蔽这一固定词组，
    // 避免把“某人下诏狱”误判为新增 activeEdicts 缺失并回滚整笔 AI 写入。
    var edictNarrative = narrative.replace(/下诏狱/g, '下狱');
    var promulgateKw = _firstHit(edictNarrative, ['颁诏','降旨','敕谕','颁行','颁布','下诏','明诏','谕令','制曰','施行新政','开行...新法','申严']);
    var revokeKw = _firstHit(narrative, ['废诏','废制','停止施行','撤回','撤销','废止','废罢','收回成命']);
    if (!promulgateKw && !revokeKw) return;
    var existingEdicts = Array.isArray(G.activeEdicts) ? G.activeEdicts : [];
    var beforeCount = (applied && typeof applied._edictsBefore === 'number') ? applied._edictsBefore : existingEdicts.length;
    var warnings = [];
    if (promulgateKw && existingEdicts.length <= beforeCount) warnings.push({ kind: 'edict_promulgate_missing', keyword: promulgateKw, snippet: _snippetAround(narrative, promulgateKw, 30) });
    if (revokeKw && existingEdicts.length >= beforeCount) warnings.push({ kind: 'edict_revoke_missing', keyword: revokeKw, snippet: _snippetAround(narrative, revokeKw, 30) });
    if (!warnings.length) return;
    if (!G._edictEffectValidatorLog) G._edictEffectValidatorLog = [];
    G._edictEffectValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._edictEffectValidatorLog.length > 20) G._edictEffectValidatorLog = G._edictEffectValidatorLog.slice(-20);
    console.warn('[EdictEffectValidator] 法令效力一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  激进版·14f-8·朝廷礼仪一致性校验（含后宫）
  //  扫『迁都/晋爵/赠官/谥/追封/赐姓/册立...为后/晋...为妃/废后/出宫』
  // ═══════════════════════════════════════════════════════════════════
  function _validateCourtCeremonyConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var moveCapKw = _firstHit(narrative, ['迁都','移都','改都']);
    var titleKw = _firstHit(narrative, ['晋爵','晋封','加封','进爵','赐爵','削爵','夺爵','除爵','赠','追赠','追封','谥','赐姓','赐婚']);
    var haremKw = _firstHit(narrative, ['册立','册封','晋为妃','晋为贵妃','立为皇后','废后','废妃','降为','贬为','出宫','选秀','纳妃']);
    if (!moveCapKw && !titleKw && !haremKw) return;
    var charUpdates = aiOutput.char_updates || [];
    var hasCapitalMove = (G._turnReport || []).some(function(r){ return r && r.turn === (G.turn || 0) && r.type === 'faction_update' && r.field === 'capital'; }) ||
      (aiOutput.faction_updates || []).some(function(fu){ return fu && fu.updates && (fu.updates.capital || fu.updates.capitalName); });
    // 简单粗略：char_updates 中是否含 title/posthumous/spouse 修改
    var hasRelevantUpdate = charUpdates.some(function(c){
      if (!c || !c.changes) return false;
      var chKeys = Object.keys(c.changes||{});
      return chKeys.some(function(k){return /title|posthumous|spouse|wife|consort/i.test(k);});
    });
    var warnings = [];
    if (moveCapKw && !hasCapitalMove) warnings.push({ kind: 'capital_move_missing', keyword: moveCapKw, snippet: _snippetAround(narrative, moveCapKw, 30) });
    if (titleKw && !hasRelevantUpdate) warnings.push({ kind: 'title_change_missing', keyword: titleKw, snippet: _snippetAround(narrative, titleKw, 30) });
    if (haremKw && !hasRelevantUpdate) warnings.push({ kind: 'harem_change_missing', keyword: haremKw, snippet: _snippetAround(narrative, haremKw, 30) });
    if (!warnings.length) return;
    if (!G._courtCeremonyValidatorLog) G._courtCeremonyValidatorLog = [];
    G._courtCeremonyValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._courtCeremonyValidatorLog.length > 20) G._courtCeremonyValidatorLog = G._courtCeremonyValidatorLog.slice(-20);
    console.warn('[CourtCeremonyValidator] 朝廷礼仪一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  激进版·14f-9·工程·物品·建筑一致性校验
  //  扫『兴工/督造/敕造/竣工/烧毁/重建/铸钱/铸器/重修/...毁』
  // ═══════════════════════════════════════════════════════════════════
  function _validateConstructionConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var buildKw = _firstHit(narrative, ['兴工','督造','敕造','竣工','落成','营建','营造','重建','修缮','整修','修陵','治水','河工','堰塞','筑城','筑堡','铸钱','铸器','造船','试制']);
    var destroyKw = _firstHit(narrative, ['烧毁','毁','摧','颓','坍','圮','废墟','焚毁']);
    if (!buildKw && !destroyKw) return;
    // 检查 changes 中是否含 building / project / item 路径
    var hasRelevant = (aiOutput.changes || []).some(function(c){
      var p = (c && c.path) || '';
      return /building|project|construction|item|works|edifice/i.test(p);
    });
    var warnings = [];
    if (buildKw && !hasRelevant) warnings.push({ kind: 'construction_build_missing', keyword: buildKw, snippet: _snippetAround(narrative, buildKw, 30) });
    if (destroyKw && !hasRelevant) warnings.push({ kind: 'construction_destroy_missing', keyword: destroyKw, snippet: _snippetAround(narrative, destroyKw, 30) });
    if (!warnings.length) return;
    if (!G._constructionValidatorLog) G._constructionValidatorLog = [];
    G._constructionValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._constructionValidatorLog.length > 20) G._constructionValidatorLog = G._constructionValidatorLog.slice(-20);
    console.warn('[ConstructionValidator] 工程·物品一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  极致版·14f-11·婚姻·生育·继承一致性校验
  //  扫『嫁/娶/聘/纳/有娠/诞生/分娩/夭折/绝嗣/承嗣/即位』·对照 GM.harem / chars
  // ═══════════════════════════════════════════════════════════════════
  function _validateMarriageBirthConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var marryKw = _firstHit(narrative, ['嫁','娶','聘','纳采','纳征','成婚','结亲','缔婚','和亲','联姻','大婚']);
    var birthKw = _firstHit(narrative, ['有娠','怀孕','身娠','诞生','分娩','降生','弄璋','弄瓦','长公主','皇子','皇女','龙胎']);
    var deathHeirKw = _firstHit(narrative, ['夭折','早殇','薨于稚龄','婴卒','绝嗣','无嗣','断后']);
    var succKw = _firstHit(narrative, ['即位','登基','嗣位','继统','承祧','承嗣','袭爵','袭封','袭位']);
    if (!marryKw && !birthKw && !deathHeirKw && !succKw) return;
    var charUpdates = aiOutput.char_updates || [];
    var charDeaths = aiOutput.character_deaths || [];
    var hasUpdate = charUpdates.some(function(c){return c && c.changes && Object.keys(c.changes).some(function(k){return /spouse|wife|consort|children|heir|inherited|succeeded/i.test(k);});});
    var warnings = [];
    if (marryKw && !hasUpdate) warnings.push({ kind: 'marriage_missing', keyword: marryKw, snippet: _snippetAround(narrative, marryKw, 30) });
    if (deathHeirKw && charDeaths.length === 0) warnings.push({ kind: 'heir_death_missing', keyword: deathHeirKw, snippet: _snippetAround(narrative, deathHeirKw, 30) });
    if (succKw && !hasUpdate) warnings.push({ kind: 'succession_missing', keyword: succKw, snippet: _snippetAround(narrative, succKw, 30) });
    if (!warnings.length) return;
    if (!G._marriageBirthValidatorLog) G._marriageBirthValidatorLog = [];
    G._marriageBirthValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._marriageBirthValidatorLog.length > 20) G._marriageBirthValidatorLog = G._marriageBirthValidatorLog.slice(-20);
    console.warn('[MarriageBirthValidator] 婚姻·生育·继承一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  极致版·14f-12·谋反·政变·弑君一致性校验
  //  扫『谋反/谋逆/弑君/宫变/篡位/兵谏/逼宫/犯阙/兵围』·对照 GM._conspiracies
  // ═══════════════════════════════════════════════════════════════════
  function _validateConspiracyConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var plotKw = _firstHit(narrative, ['谋反','谋逆','谋叛','造逆','阴谋','蓄志','潜谋','怀异','私通','密议','结连','潜图']);
    var coupKw = _firstHit(narrative, ['弑君','宫变','政变','兵变','篡位','兵谏','逼宫','犯阙','兵围禁中','闯宫','劫驾']);
    if (!plotKw && !coupKw) return;
    // 检查 personnel_changes 是否有 reason 含『反/逆/篡』
    var pcArr = aiOutput.personnel_changes || [];
    var hasReason = pcArr.some(function(p){return p && p.reason && /反|逆|篡|谋|变|党/.test(p.reason);});
    var charDeaths = (aiOutput.character_deaths || []).some(function(d){return d && d.cause && /反|逆|弑|篡|刺|杀/.test(d.cause||d.reason||'');});
    var warnings = [];
    if (plotKw && !hasReason && !charDeaths) warnings.push({ kind: 'plot_missing', keyword: plotKw, snippet: _snippetAround(narrative, plotKw, 30) });
    if (coupKw && !hasReason && !charDeaths) warnings.push({ kind: 'coup_missing', keyword: coupKw, snippet: _snippetAround(narrative, coupKw, 30) });
    if (!warnings.length) return;
    if (!G._conspiracyValidatorLog) G._conspiracyValidatorLog = [];
    G._conspiracyValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._conspiracyValidatorLog.length > 20) G._conspiracyValidatorLog = G._conspiracyValidatorLog.slice(-20);
    console.warn('[ConspiracyValidator] 谋反·政变一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  极致版·14f-13·货币·币值·银荒一致性校验
  //  扫『银荒/钱荒/钞贱/通胀/铜贵/银贵/币改/换钞/铸大钱』·对照 GM.currency
  // ═══════════════════════════════════════════════════════════════════
  function _validateCurrencyConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var crisisKw = _firstHit(narrative, ['银荒','钱荒','钞贱','通胀','铜贵','银贵','物价腾贵','米价踊贵','货贵','钱贱']);
    var reformKw = _firstHit(narrative, ['币改','换钞','行钞','行银','铸大钱','改铸','禁银','禁铜','解禁','弛禁']);
    if (!crisisKw && !reformKw) return;
    // 检查 changes / fiscal_adjustments / global_state_delta 是否含 currency/silver/copper/inflation
    var hasUpdate = (aiOutput.changes || []).some(function(c){var p=(c&&c.path)||'';return /currenc|silver|copper|inflation|银价|物价/i.test(p);})
      || (aiOutput.global_state_delta && Object.keys(aiOutput.global_state_delta||{}).some(function(k){return /inflation|currency|priceIndex/i.test(k);}));
    var warnings = [];
    if (crisisKw && !hasUpdate) warnings.push({ kind: 'currency_crisis_missing', keyword: crisisKw, snippet: _snippetAround(narrative, crisisKw, 30) });
    if (reformKw && !hasUpdate) warnings.push({ kind: 'currency_reform_missing', keyword: reformKw, snippet: _snippetAround(narrative, reformKw, 30) });
    if (!warnings.length) return;
    if (!G._currencyValidatorLog) G._currencyValidatorLog = [];
    G._currencyValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._currencyValidatorLog.length > 20) G._currencyValidatorLog = G._currencyValidatorLog.slice(-20);
    console.warn('[CurrencyValidator] 货币·币值一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  极致版·14f-14·宗教·教派一致性校验
  //  扫『立教/兴佛/灭佛/传教/邪教/白莲/天主/教门/兴道/灭道/僧伽』·对照 GM.religions
  // ═══════════════════════════════════════════════════════════════════
  function _validateReligionConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var riseKw = _firstHit(narrative, ['立教','兴佛','兴道','传教','弘法','弘道','立寺','建观','开堂']);
    var fallKw = _firstHit(narrative, ['灭佛','灭道','禁教','毁寺','毁观','焚经','沙汰','逐僧','逐道']);
    var sectKw = _firstHit(narrative, ['白莲','弥勒','无生老母','闻香','天主','耶稣会','回回','袄教','摩尼','邪教','妖教','妖人']);
    if (!riseKw && !fallKw && !sectKw) return;
    var existingRel = Array.isArray(G.religions) ? G.religions : [];
    var beforeCount = (applied && typeof applied._religionsBefore === 'number') ? applied._religionsBefore : existingRel.length;
    var hasUpdate = (aiOutput.changes||[]).some(function(c){var p=(c&&c.path)||'';return /religion|sect|temple|monastic/i.test(p);});
    var warnings = [];
    if ((riseKw || fallKw) && !hasUpdate && existingRel.length === beforeCount) warnings.push({ kind: 'religion_change_missing', keyword: riseKw || fallKw, snippet: _snippetAround(narrative, riseKw || fallKw, 30) });
    if (sectKw && !hasUpdate) warnings.push({ kind: 'sect_event_missing', keyword: sectKw, snippet: _snippetAround(narrative, sectKw, 30) });
    if (!warnings.length) return;
    if (!G._religionValidatorLog) G._religionValidatorLog = [];
    G._religionValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._religionValidatorLog.length > 20) G._religionValidatorLog = G._religionValidatorLog.slice(-20);
    console.warn('[ReligionValidator] 宗教·教派一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  激进版·14f-10·异象·谶语一致性校验
  //  扫『彗见/星孛/日蚀/月蚀/血雨/虹贯/瑞兽/麒麟/凤凰/白虎/谶/谣/天象』
  // ═══════════════════════════════════════════════════════════════════
  function _validateOmenConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrative = _getNarrativeText(aiOutput); if (!narrative) return;
    var omenKw = _firstHit(narrative, ['彗见','彗星','星孛','日蚀','日食','月蚀','月食','血雨','虹贯','虹气','白虹','瑞兽','麒麟','凤凰','白虎','五星连珠','陨石','地龙','童谣','谶','妖言','灾异','祥瑞']);
    if (!omenKw) return;
    var existingOmens = Array.isArray(G.omens) ? G.omens : (G.events||[]).filter(function(e){return e && (e.type==='omen'||e.category==='omen');});
    var beforeCount = (applied && typeof applied._omensBefore === 'number') ? applied._omensBefore : existingOmens.length;
    if (existingOmens.length > beforeCount) return;
    var warnings = [{ kind: 'omen_missing', keyword: omenKw, snippet: _snippetAround(narrative, omenKw, 30) }];
    if (!G._omenValidatorLog) G._omenValidatorLog = [];
    G._omenValidatorLog.push({ turn: G.turn||0, warnings: warnings });
    if (G._omenValidatorLog.length > 20) G._omenValidatorLog = G._omenValidatorLog.slice(-20);
    console.warn('[OmenValidator] 异象一致性警告:', warnings);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  二次 AI 自审 reconciliation·Wave 1c
  //  仅当本回合 5 个 validator 累计警告 >= 3 时触发·让 AI 看自己的 narrative+JSON·查矛盾·返回补录
  //  返回的 reconciliation_patch 自动 apply 到 GM·token 成本约 +20%
  // ═══════════════════════════════════════════════════════════════════
  function _maybeReconcileWithAI(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    // 统计本回合各 validator 警告数·阈值 3
    var fiscalW = (G._fiscalValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var personW = (G._personnelValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.missing||[]).length;},0);
    var militaryW = (G._militaryValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var sentW = (G._sentimentValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var popW = (G._populationValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var officeW = (G._officeValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.missing||[]).length;},0);
    // 保守版·三类新 validator
    var warW = (G._warValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var revoltW = (G._revoltValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var disasterW = (G._disasterValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    // 激进版·七类新 validator
    var diplomacyW = (G._diplomacyValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var kejuW = (G._kejuValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var partyW = (G._partyValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var edictEffectW = (G._edictEffectValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var courtCeremonyW = (G._courtCeremonyValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var constructionW = (G._constructionValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var omenW = (G._omenValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    // 极致版·末四类
    var marriageBirthW = (G._marriageBirthValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var conspiracyW = (G._conspiracyValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var currencyW = (G._currencyValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var religionW = (G._religionValidatorLog||[]).filter(function(x){return x.turn===G.turn;}).reduce(function(s,x){return s+(x.warnings||[]).length;},0);
    var totalW = fiscalW + personW + militaryW + sentW + popW + officeW + warW + revoltW + disasterW + diplomacyW + kejuW + partyW + edictEffectW + courtCeremonyW + constructionW + omenW + marriageBirthW + conspiracyW + currencyW + religionW;

    if (!G._reconcileLog) G._reconcileLog = [];
    G._reconcileLog.push({ turn: G.turn || 0, fiscalW: fiscalW, personW: personW, militaryW: militaryW, sentW: sentW, popW: popW, officeW: officeW, warW: warW, revoltW: revoltW, disasterW: disasterW, diplomacyW: diplomacyW, kejuW: kejuW, partyW: partyW, edictEffectW: edictEffectW, courtCeremonyW: courtCeremonyW, constructionW: constructionW, omenW: omenW, marriageBirthW: marriageBirthW, conspiracyW: conspiracyW, currencyW: currencyW, religionW: religionW, total: totalW });
    if (G._reconcileLog.length > 20) G._reconcileLog = G._reconcileLog.slice(-20);

    if (totalW < 3) return;  // 未达阈值
    // ★ 不在 applier 同步触发 AI(applier 是同步函数)·标记需要 reconcile·让 endturn-ai-infer 异步处理
    G._needsReconcile = {
      turn: G.turn || 0,
      warnings: { fiscal: fiscalW, personnel: personW, military: militaryW, sentiment: sentW, population: popW, office: officeW, war: warW, revolt: revoltW, disaster: disasterW, diplomacy: diplomacyW, keju: kejuW, party: partyW, edictEffect: edictEffectW, courtCeremony: courtCeremonyW, construction: constructionW, omen: omenW, marriageBirth: marriageBirthW, conspiracy: conspiracyW, currency: currencyW, religion: religionW },
      narrativeSnapshot: _getNarrativeText(aiOutput).slice(0, 2000),  // 截断防止 prompt 过长
      structuredSnapshot: {
        personnel_changes: aiOutput.personnel_changes || [],
        office_assignments: aiOutput.office_assignments || [],
        fiscal_adjustments: aiOutput.fiscal_adjustments || [],
        military_changes: aiOutput.military_changes || [],
        activeWars: G.activeWars || [],
        revolts: (G.minxin && G.minxin.revolts) || [],
        activeDisasters: G.activeDisasters || [],
        facs: (G.facs||[]).slice(0,5),
        parties: G.parties || [],
        activeEdicts: G.activeEdicts || []
      }
    };
    console.warn('[ReconcileAI] 本回合校验器累计警告 ' + totalW + ' 条 >= 阈值·标记 GM._needsReconcile·待异步 AI 自审');
    if (G._turnReport) G._turnReport.push({ type: 'reconcile_pending', total: totalW, turn: G.turn || 0 });
  }

  function _validateFiscalConsistency(G, aiOutput, applied) {
    if (!G || !aiOutput) return;
    var narrativeText = '';
    if (aiOutput.shilu_text) narrativeText += String(aiOutput.shilu_text) + '\n';
    if (aiOutput.shizhengji) narrativeText += String(aiOutput.shizhengji) + '\n';
    if (Array.isArray(aiOutput.events)) {
      aiOutput.events.forEach(function(e){ if (e && e.desc) narrativeText += String(e.desc) + '\n'; });
    }
    if (aiOutput.event && aiOutput.event.desc) narrativeText += String(aiOutput.event.desc) + '\n';
    if (!narrativeText) return;

    // 中文/阿拉伯混合数字转阿拉伯数字
    function _parseNum(numStr, mult) {
      var cnMap = {'零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'两':2,'壹':1,'贰':2,'叁':3,'肆':4,'伍':5,'陆':6,'柒':7,'捌':8,'玖':9};
      var n = parseFloat(numStr);
      if (!isNaN(n) && n > 0) {
        // 阿拉伯前缀：检查尾部是否携带量级单位（如"30万"）
        if (/万$/.test(numStr)) n *= 10000;
        else if (/千$/.test(numStr)) n *= 1000;
        else if (/百$/.test(numStr)) n *= 100;
        else if (/十$/.test(numStr)) n *= 10;
      } else {
        // 纯中文数字解析
        n = 0;
        for (var i = 0; i < numStr.length; i++) {
          var ch = numStr.charAt(i);
          if (cnMap[ch] != null) n = n * 10 + cnMap[ch];
          else if (ch === '十') n = (n || 1) * 10;
          else if (ch === '百') n = (n || 1) * 100;
          else if (ch === '千') n = (n || 1) * 1000;
          else if (ch === '万') n = (n || 1) * 10000;
        }
      }
      if (mult === '万') n *= 10000;
      else if (mult === '千') n *= 1000;
      else if (mult === '百') n *= 100;
      else if (mult === '十') n *= 10;
      return n;
    }

    var mentioned = [];
    // ★ 双向匹配：支出动词(outflow) + 收入动词(inflow)·分别标记 kind
    // 之前正则只识别支出动词·导致 AI 叙述『获得三百万两白银』时校验器抓不到·数值不对账
    // 2026-04 扩充：补『籍没/抄没/查抄/划拨/支给/支应/赏银/赈银/拨款/专款』等诏令式动词
    var outflowVerbs = '赐|赏|发|拨|赈|征|没收|缴获|贡|赔|罚没|献|输|筹|济|捐|赠|颁|犒|赠送|耗费|花费|花|靡费|费' +
      '|拨付|拨给|拨入|拨内帑|拨内库|划拨|调拨|发付|发给|发支|出库|起解|起运|解送|解部|解到|报销|发还|分给|拨与|赏给|犒赏|犒军|赈济|赈灾|赈给|安抚|抚恤|抚慰' +
      '|支应|支给|支用|支放|支发|支领|动支|动用|提取|提用|划支|划归|经费|靡费|开支|开销|耗用';
    var inflowVerbs = '获得|获|收|入|进|得|得到|收到|进项|进帐|进账|收入|入账|入库|入帑|入内帑|纳入|抄获|抄到|没入|缴入|追缴|追讨|追回|罚入|查封充公|抄没入|没收入' +
      '|籍没|籍家|籍没家产|抄家|抄籍|抄没|查抄|抄入|查封|充公|没官|没充|没户' +
      '|入私库|入御府|入库银|起运入|解送至|划入|转入|调入|拨归|归入|纳款|捐输|报效' +
      '|追比|追征|追缴|追赔|籍录|籍其家|罚银|罚没';
    // 单位匹配（带单位）— 高置信度
    var patOut = new RegExp('(' + outflowVerbs + ')[^。；\\s,，]{0,8}?([\\d一二三四五六七八九十百千万亿两壹贰叁肆伍陆柒捌玖]+)\\s*(万|千|百|十)?\\s*(两|石|匹|斛|贯|缗|斗)', 'g');
    var patIn  = new RegExp('(' + inflowVerbs + ')[^。；\\s,，]{0,8}?([\\d一二三四五六七八九十百千万亿两壹贰叁肆伍陆柒捌玖]+)\\s*(万|千|百|十)?\\s*(两|石|匹|斛|贯|缗|斗)', 'g');
    function _scanPattern(pat, kind) {
      var m;
      while ((m = pat.exec(narrativeText)) !== null) {
        var action = m[1];
        var numStr = m[2];
        var mult = m[3] || '';
        var unit = m[4];
        var amt = _parseNum(numStr, mult);
        if (!amt || amt < 100) continue;
        var resType = (unit === '石' || unit === '斛' || unit === '斗') ? 'grain'
                    : (unit === '匹') ? 'cloth'
                    : 'money';
        mentioned.push({ action: action, amount: amt, resource: resType, kind: kind, raw: m[0] });
      }
    }
    _scanPattern(patOut, 'expense');
    _scanPattern(patIn,  'income');

    // ★ 兜底：无单位裸数额"N 万"——必须 narrative 段落含金钱语境关键词才视为 money
    // 这套补丁专杀玩家原档的"籍没X家产 +150万 / 京营赏银 -10万 / X查抄 +450万"等诏令式表达
    var moneyContextKw = /银|帑|库|帑廪|内帑|私库|内库|国库|库银|赏银|赈银|饷银|饷|赏|赈|犒|拨款|专款|经费|赔款|银两|帑库|公库/;
    var hasMoneyContext = moneyContextKw.test(narrativeText);
    if (hasMoneyContext) {
      // 模式：动词 + (人名/地名/事由)? + 数字 + 万 (无两/石/匹后缀)·宽松匹配
      // 允许空格·允许小数点（如 139.2万）·允许 +/- 前缀符号（modal 常用 "+150万"）
      var patOutLoose = new RegExp('(' + outflowVerbs + ')[^。；,，]{0,16}?([+\\-]?[\\d一二三四五六七八九十百千万亿壹贰叁肆伍陆柒捌玖]+(?:\\.\\d+)?)\\s*万(?!两|石|匹|斛|贯|缗|斗|文|众|户|口|人|亩|顷|名)', 'g');
      var patInLoose  = new RegExp('(' + inflowVerbs + ')[^。；,，]{0,16}?([+\\-]?[\\d一二三四五六七八九十百千万亿壹贰叁肆伍陆柒捌玖]+(?:\\.\\d+)?)\\s*万(?!两|石|匹|斛|贯|缗|斗|文|众|户|口|人|亩|顷|名)', 'g');
      function _scanLoose(pat, kind) {
        var m;
        while ((m = pat.exec(narrativeText)) !== null) {
          var raw = m[0];
          // 排重·已在严格匹配里命中过的整段不再 push
          if (mentioned.some(function(x){return x.raw === raw;})) continue;
          var amt = _parseNum(m[2], '万');
          if (!amt || amt < 1000) continue;  // 兜底匹配·阈值更高(1000+ 单位=两)·避免误抓"X 万人/X 万亩"
          mentioned.push({ action: m[1], amount: amt, resource: 'money', kind: kind, raw: raw, _loose: true });
        }
      }
      _scanLoose(patOutLoose, 'expense');
      _scanLoose(patInLoose, 'income');
    }
    if (!mentioned.length) return;

    // 比对 fiscal_adjustments 总量·分 income/expense 两边
    var adjTotal = { income: { money:0, grain:0, cloth:0 }, expense: { money:0, grain:0, cloth:0 } };
    (aiOutput.fiscal_adjustments || []).forEach(function(fa){
      if (!fa) return;
      var res = (fa.resource === 'grain' || fa.resource === 'cloth') ? fa.resource : 'money';
      var k = (fa.kind === 'income') ? 'income' : 'expense';
      adjTotal[k][res] += Math.abs(parseFloat(fa.amount) || 0);
    });
    var mentTotal = { income: { money:0, grain:0, cloth:0 }, expense: { money:0, grain:0, cloth:0 } };
    mentioned.forEach(function(x){ mentTotal[x.kind][x.resource] += x.amount; });

    var warnings = [];
    ['income','expense'].forEach(function(kind) {
      ['money','grain','cloth'].forEach(function(res){
        if (mentTotal[kind][res] <= 0) return;
        var ratio = adjTotal[kind][res] / mentTotal[kind][res];
        // 允许fiscal_adjustments总量 >= 50% of mentioned，低于此阈值视为严重脱节
        if (ratio < 0.5) {
          warnings.push({
            kind: kind,
            resource: res,
            mentioned: mentTotal[kind][res],
            adjusted: adjTotal[kind][res],
            shortfall: Math.round(mentTotal[kind][res] - adjTotal[kind][res]),
            ratio: Math.round(ratio * 100) / 100
          });
        }
      });
    });

    if (!warnings.length) return;

    if (!G._fiscalValidatorLog) G._fiscalValidatorLog = [];
    G._fiscalValidatorLog.push({ turn: G.turn || 0, warnings: warnings, samples: mentioned.slice(0, 8) });
    if (G._fiscalValidatorLog.length > 20) G._fiscalValidatorLog = G._fiscalValidatorLog.slice(-20);

    G._turnReport.push({ type: 'fiscal_validation', warnings: warnings, samples: mentioned.slice(0, 5), turn: G.turn || 0 });
    console.warn('[FiscalValidator] 叙事金额与 fiscal_adjustments 不符:', warnings);

    // 自动补录·分 income/expense 两边·按 kind 真正补录
    warnings.forEach(function(w){
      if (w.shortfall <= 0) return;
      if (!G.guoku) G.guoku = {};
      var containerKey = (w.kind === 'income') ? 'extraIncome' : 'extraExpense';
      if (!G.guoku[containerKey]) G.guoku[containerKey] = [];
      var patch = {
        id: 'fa_autopatch_' + (G.turn||0) + '_' + Math.random().toString(36).slice(2,5),
        name: '叙事脱节补录·' + (w.kind === 'income' ? '入' : '出'),
        category: '校验补录',
        resource: w.resource,
        amount: w.shortfall,
        kind: w.kind,
        reason: '财务校验器·叙事提及' + w.kind + (w.resource==='grain'?'粮':w.resource==='cloth'?'布':'银') + w.mentioned + '·fiscal_adjustments 仅 ' + w.adjusted + '·自动补录差额',
        recurring: false,
        addedTurn: G.turn || 0,
        stopAfterTurn: null,
        _autoPatched: true
      };
      G.guoku[containerKey].push(patch);
      // 立即作用：income 加库 / expense 扣库（不突破 0）
      var cur = _readFiscalStock(G.guoku, w.resource);
      var actual;
      if (w.kind === 'income') {
        // 入：直接加（可抹平负债）
        _writeFiscalStock(G.guoku, w.resource, cur + w.shortfall);
        actual = w.shortfall;
        patch.shortfall = 0;
      } else {
        // 出：拨到见底
        actual = Math.min(cur, w.shortfall);
        if (cur > 0) {
          _writeFiscalStock(G.guoku, w.resource, cur - actual);
        }
        patch.shortfall = w.shortfall - actual;
      }
      if (w.resource === 'money') G.guoku.balance = G.guoku.money;
      patch.applied = actual;
    });
  }

  //>>ACA-SPLIT22-VALIDATORS-BODY-END
  // ── forward 回填：本片校验器 → bucket（origin 委托 shim 调用期解析）──
  __acaP._validatePersonnelConsistency = _validatePersonnelConsistency; __acaP._validateMilitaryConsistency = _validateMilitaryConsistency; __acaP._validateSentimentConsistency = _validateSentimentConsistency; __acaP._validatePopulationConsistency = _validatePopulationConsistency; __acaP._validateOfficeConsistency = _validateOfficeConsistency; __acaP._validateWarConsistency = _validateWarConsistency;
  __acaP._validateRevoltConsistency = _validateRevoltConsistency; __acaP._validateDisasterConsistency = _validateDisasterConsistency; __acaP._validateDiplomacyConsistency = _validateDiplomacyConsistency; __acaP._validateKejuConsistency = _validateKejuConsistency; __acaP._validatePartyConsistency = _validatePartyConsistency; __acaP._validateEdictEffectConsistency = _validateEdictEffectConsistency;
  __acaP._validateCourtCeremonyConsistency = _validateCourtCeremonyConsistency; __acaP._validateConstructionConsistency = _validateConstructionConsistency; __acaP._validateMarriageBirthConsistency = _validateMarriageBirthConsistency; __acaP._validateConspiracyConsistency = _validateConspiracyConsistency; __acaP._validateCurrencyConsistency = _validateCurrencyConsistency; __acaP._validateReligionConsistency = _validateReligionConsistency;
  __acaP._validateOmenConsistency = _validateOmenConsistency; __acaP._validateFiscalConsistency = _validateFiscalConsistency; __acaP._maybeReconcileWithAI = _maybeReconcileWithAI;
  // 刀C·扩面共享判据(2026-07-19)：死亡/写端来源判据与死因分类器导出 bucket·供 reconcile(C1 preflight)/applier(C2/C3) 复用同款判据。
  __acaP._narrativeDeathSourced = _narrativeDeathSourced; __acaP._textMentionsName = _textMentionsName; __acaP._classifyStructuredDeathKind = _classifyStructuredDeathKind; __acaP._writeActionSourced = _writeActionSourced; __acaP._gateJudicialPersonnelChange = _gateJudicialPersonnelChange; __acaP._sensitiveCharFieldSourced = _sensitiveCharFieldSourced; __acaP._gateEventTimepoint = _gateEventTimepoint; __acaP._gateAllegianceSource = _gateAllegianceSource; __acaP._gateDeathRoutingSource = _gateDeathRoutingSource; __acaP._wgCachedAllNames = _wgCachedAllNames; __acaP._wgCachedCourtText = _wgCachedCourtText;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
