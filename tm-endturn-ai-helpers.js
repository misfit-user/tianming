// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-ai-helpers.js — endTurn AI 预演辅助
//
// R94 从 tm-endturn.js §A 抽出·原 L1492-1900 (409 行)
// 4 函数：
//   aiPlanFirstTurnEvents (async) — 首回合候选事件预生成·外部 1 处调用
//   aiDigestLongTermActions (async) — 长期行动摘要生成
//   aiEdictEfficacyAudit (async) — 御批回听/诏令问责
//   buildEdictEfficacyFollowUp — 诏令执行追踪上下文
//
// 外部调用：aiPlanFirstTurnEvents → tm-patches.js 1 处(typeof 防御)·其他 0
// 依赖外部：GM / P / callAI / extractJSON / addEB / _dbg（均 window 全局）
//
// 加载顺序：必须在 tm-endturn.js 之前
// ============================================================

// ============================================================

function _tmMessageContentText(content) {
  if (Array.isArray(content)) return content.map(function(part){ return typeof part === 'string' ? part : (part && typeof part === 'object' ? String(part.text || part.content || '') : ''); }).join('\n');
  return String(content == null ? '' : content);
}

function _tmTrimMiddleText(text, maxChars) {
  text = String(text == null ? '' : text);
  maxChars = Math.max(200, Number(maxChars) || 2000);
  if (text.length <= maxChars) return text;
  var marker = '\n……（此段过长，已保留首尾并裁去中段 ' + (text.length - maxChars) + ' 字）……\n';
  var head = Math.max(80, Math.floor((maxChars - marker.length) * 0.62));
  var tail = Math.max(80, maxChars - marker.length - head);
  return text.slice(0, head) + marker + text.slice(-tail);
}

function _tmLimitPromptSection(label, text, maxChars) {
  text = String(text == null ? '' : text);
  return (!text || text.length <= maxChars) ? text : ('\n【' + label + '·过长裁剪】\n' + _tmTrimMiddleText(text, maxChars) + '\n');
}

function _tmBuildCompactConversationForSubcall(conv, opts) {
  opts = opts || {};
  var maxChars = Math.max(2000, Number(opts.maxChars) || 10000), perUser = Math.max(600, Number(opts.perUser) || 1800), perAssistant = Math.max(800, Number(opts.perAssistant) || 2600);
  var out = [], used = 0, skippedHugeUser = 0;
  if (!Array.isArray(conv) || !conv.length) return out;
  for (var i = conv.length - 1; i >= 0; i--) {
    var msg = conv[i]; if (!msg) continue;
    var role = msg.role === 'assistant' ? 'assistant' : 'user';
    var content = _tmMessageContentText(msg.content); if (!content.trim()) continue;
    if (role === 'user' && content.length > 12000) { skippedHugeUser++; continue; }
    var compact = _tmTrimMiddleText(content, role === 'assistant' ? perAssistant : perUser);
    if (used + compact.length > maxChars) { if (out.length === 0) compact = _tmTrimMiddleText(compact, Math.max(500, maxChars - used)); else break; }
    out.unshift({ role: role, content: compact }); used += compact.length;
  }
  if (skippedHugeUser > 0) out.unshift({ role: 'user', content: '【对话历史压缩】已跳过 ' + skippedHugeUser + ' 条巨型回合推演输入；本回合事实以结构化摘要、世界快照、记忆表为准。' });
  return out;
}

function _tmPrepareSc2Messages(sysP, conv, userPrompt, maybeCacheSys) {
  function build(maxChars, perUser, perAssistant, uText) {
    var c = _tmBuildCompactConversationForSubcall(conv, { maxChars: maxChars, perUser: perUser, perAssistant: perAssistant });
    return { conv: c, messages: [{ role: 'system', content: (typeof maybeCacheSys === 'function' ? maybeCacheSys(sysP) : sysP) }].concat(c).concat([{ role: 'user', content: uText }]) };
  }
  var prep = build(10000, 1600, 2400, userPrompt);
  try {
    if (typeof checkPromptTokenBudget === 'function') {
      var r = checkPromptTokenBudget(prep.messages.map(function(m){ return _tmMessageContentText(m && m.content); }).join('\n'), function(status, tokens){ if (typeof toast === 'function') toast('[SC2] prompt ' + status + '·' + tokens + ' tokens'); });
      window.TM = window.TM || {}; window.TM.lastPromptTokens = window.TM.lastPromptTokens || {};
      window.TM.lastPromptTokens.sc2 = { tokens: r.tokens, status: r.status, budget: r.budget && r.budget.budget, convMessages: prep.conv.length, ts: Date.now() };
      if (r.status === 'critical' && String(userPrompt || '').length > 14000) {
        prep = build(4000, 900, 1200, _tmTrimMiddleText(userPrompt, 14000));
        var rr = checkPromptTokenBudget(prep.messages.map(function(m){ return _tmMessageContentText(m && m.content); }).join('\n'));
        window.TM.lastPromptTokens.sc2.tokensAfter = rr.tokens; window.TM.lastPromptTokens.sc2.statusAfter = rr.status;
        if (typeof recordAIDiagnostic === 'function') recordAIDiagnostic('prompt_trimmed', { id: 'sc2', before: r.tokens, after: rr.tokens });
      }
    }
  } catch(_) {}
  return prep.messages;
}

// ============================================================
// 启动首回合候选事件 aiPlanFirstTurnEvents
// 1 次 AI 调用·生成 5-8 条首 3 回合可能触发的事件候选
// generateMemorials 优先从此池抽取·保证首回合剧情契合剧本开局
// ============================================================
async function aiPlanFirstTurnEvents() {
  if (!P.ai || !P.ai.key) return;
  if (GM._candidateEvents && GM._candidateEvents.length > 0) return;
  if (GM.turn > 1) return;

  var sc = findScenarioById(GM.sid);
  if (!sc) return;
  if (sc.skipInferencePlanning === true) return;

  var pi = P.playerInfo || {};
  var overview = (sc.overview || '').slice(0, 500);
  var opening = (sc.openingText || '').slice(0, 400);
  var contradictText = '';
  if (pi.coreContradictions && pi.coreContradictions.length > 0) {
    contradictText = pi.coreContradictions.map(function(c) {
      return '[' + c.dimension + ']' + c.title + (c.description ? '：' + c.description.slice(0, 60) : '');
    }).join('；');
  }

  // 关键 NPC 列表（用于做 presenter 候选）
  var keyNpcs = (GM.chars || []).filter(function(c) {
    if (!c || c.alive === false || c.isPlayer) return false;
    return c.officialTitle || c.isHistorical || c.importance >= 60;
  }).slice(0, 30).map(function(c) {
    return c.name + (c.officialTitle ? '(' + c.officialTitle + ')' : '');
  }).join('、');

  var prompt = '你是' + (sc.era || sc.dynasty || '') + '剧本导演。基于剧本生成首 3 回合可能触发的候选事件池。\n\n';
  prompt += '【剧本总述】' + overview + '\n';
  if (opening) prompt += '【开场白】' + opening + '\n';
  if (contradictText) prompt += '【显著矛盾】' + contradictText + '\n';
  if (pi.factionGoal) prompt += '【玩家目标】' + pi.factionGoal + '\n';
  if (keyNpcs) prompt += '【关键 NPC】' + keyNpcs + '\n';

  prompt += '\n返回 JSON：\n';
  prompt += '{\n';
  prompt += '  "candidateEvents": [\n';
  prompt += '    {\n';
  prompt += '      "id":"slug_id",\n';
  prompt += '      "title":"事件标题(10-20字·紧扣剧本矛盾)",\n';
  prompt += '      "type":"audience|memorial|urgent_memorial|letter|chaoyi_topic|anomaly",\n';
  prompt += '      "presenter":"发起人(NPC 姓名·须来自关键 NPC 列表)",\n';
  prompt += '      "triggerCondition":"触发条件(如 T1 自动/T2-3 若玩家未做 X/陕西未赈灾)",\n';
  prompt += '      "payload":"事件内容(60-120字·半文言·体现 presenter 立场与隐藏意图)",\n';
  prompt += '      "rationale":"导演说明·为何此时此事(30字)"\n';
  prompt += '    },\n';
  prompt += '    ...（5-8 条·覆盖朝局/军情/民变/阉党/外交等多维度）\n';
  prompt += '  ],\n';
  prompt += '  "sequencing":"建议触发顺序(60字)",\n';
  prompt += '  "branchingLogic":"分支逻辑(玩家做 A 则触发 B·不做则触发 C·80字)"\n';
  prompt += '}\n只输出 JSON。';

  try {
    if (typeof showLoading === 'function') showLoading('规划首回合候选事件…', 70);
    var raw = await callAISmart(prompt, 2500, {
      maxRetries: 2,
      minLength: 400,
      timeoutMs: 60000,
      fetchMaxRetries: 1
    });
    var parsed = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (!parsed || !Array.isArray(parsed.candidateEvents)) { console.warn('[aiFTE] 解析失败'); return; }
    GM._candidateEvents = parsed.candidateEvents.map(function(e) {
      return {
        id: e.id || ('evt_' + Math.random().toString(36).slice(2, 8)),
        title: String(e.title || '').slice(0, 40),
        type: e.type || 'memorial',
        presenter: String(e.presenter || '').slice(0, 20),
        triggerCondition: String(e.triggerCondition || 'T1').slice(0, 60),
        payload: String(e.payload || '').slice(0, 300),
        rationale: String(e.rationale || '').slice(0, 60),
        _fired: false,
        _createdTurn: GM.turn || 1
      };
    });
    GM._candidateEventMeta = {
      sequencing: String(parsed.sequencing || '').slice(0, 200),
      branchingLogic: String(parsed.branchingLogic || '').slice(0, 300),
      generatedAt: GM.turn || 1
    };
    console.log('[aiFTE] 候选事件 ' + GM._candidateEvents.length + ' 条');
  } catch(e) {
    console.warn('[aiFTE] 失败:', e && e.message);
  } finally {
    if (typeof hideLoading === 'function') hideLoading();
  }
}

// ============================================================
// 长期行动摘要 aiDigestLongTermActions
// endturn 前读取所有长期诏书+进行中编年+在途旅程+长期政策
// 输出简洁摘要·注入推演 sysP·避免 AI 遗漏跨回合长期项
// 每回合重新跑·不复用（信息随回合变化）
// ============================================================
async function aiDigestLongTermActions() {
  if (!P.ai || !P.ai.key) return;
  if (typeof _buildLongTermActionsDigest !== 'function') return;
  var rawDigest = _buildLongTermActionsDigest();
  if (!rawDigest || rawDigest.length < 30) {
    GM._longTermDigest = { text: '（本回合无长期进行项）', generatedAt: GM.turn, turn: GM.turn };
    return;
  }
  // 若长期项不多·可直接存原文·省 AI 调用
  if (rawDigest.length < 500) {
    GM._longTermDigest = { text: rawDigest, generatedAt: GM.turn, turn: GM.turn, _fromRaw: true };
    return;
  }
  // 长期项多·让 AI 总结为要点+效果预测
  var prompt = '你是' + ((typeof findScenarioById==='function' && GM.sid) ? ((findScenarioById(GM.sid)||{}).era||'') : '') + '政务参谋。' +
    '请将以下皇帝历次诏书+进行中大事+在途旅程，整理为本回合 AI 推演所需的简明摘要。\n\n' +
    rawDigest + '\n\n' +
    '要求：\n' +
    '1. 按类分组（政令/军事/民生/外交/吏治/人事旅程/编年大事）\n' +
    '2. 每项标注：已持续几回合/当前进度/本回合预期效果(正面+负面两面)\n' +
    '3. 尤其关注效果曲线——是否该出现"前期好后期坏"或"初阵痛后收益"的拐点\n' +
    '4. 总字数 400-700 字·半文言·简洁凝练\n\n' +
    '直接输出摘要·不要 JSON 不要前言。';
  try {
    var raw = await callAISmart(prompt, 1500, {
      maxRetries: 1,
      minLength: 300,
      priority: 'background',
      timeoutMs: 60000,
      fetchMaxRetries: 1
    });
    if (raw && raw.length > 100) {
      GM._longTermDigest = { text: raw.trim(), generatedAt: GM.turn, turn: GM.turn, _fromAI: true };
      console.log('[longTerm] 摘要生成 · ' + raw.length + ' 字 @ T' + GM.turn);
    } else {
      // AI 失败·降级为原文
      GM._longTermDigest = { text: rawDigest, generatedAt: GM.turn, turn: GM.turn, _fromRaw: true };
    }
  } catch(e) {
    console.warn('[longTerm] AI 摘要失败·降原文:', e && e.message);
    GM._longTermDigest = { text: rawDigest, generatedAt: GM.turn, turn: GM.turn, _fromRaw: true };
  }
}

// ============================================================
// 御批回听·post-inference·对玩家诏令的执行问责
// ============================================================
async function aiEdictEfficacyAudit(aiResult, edicts) {
  if (!P.ai || !P.ai.key) return;
  if (!aiResult || typeof aiResult !== 'object') return;

  // 收集本回合玩家诏令(按分类汇总)
  var edictLines = [];
  if (edicts && typeof edicts === 'object') {
    Object.keys(edicts).forEach(function(cat) {
      var v = edicts[cat];
      if (typeof v === 'string' && v.trim()) {
        v.split(/[\n；;]+/).map(function(s){return s.trim();}).filter(Boolean).forEach(function(line, i) {
          edictLines.push({ id: cat + '-' + (i+1), category: cat, content: line });
        });
      } else if (Array.isArray(v)) {
        v.forEach(function(line, i) {
          var s = typeof line === 'string' ? line : (line.content || JSON.stringify(line));
          if (s.trim()) edictLines.push({ id: cat + '-' + (i+1), category: cat, content: s.trim() });
        });
      }
    });
  }
  if (edictLines.length === 0) {
    // 玩家本回合无诏令·跳过审查
    GM._edictEfficacyReport = { turn: GM.turn - 1, total: 0, skipped: true };
    return;
  }

  // 准备审查输入·只取关键字段
  var varChangesSummary = [];
  if (Array.isArray(aiResult.var_changes)) {
    varChangesSummary = aiResult.var_changes.slice(0, 20).map(function(v) {
      return (v.name || v.path || '?') + ': ' + (v.delta !== undefined ? (v.delta > 0 ? '+' : '') + v.delta : (v.set !== undefined ? '=' + v.set : ''));
    });
  }
  var personnelSummary = [];
  if (Array.isArray(aiResult.personnelChanges)) {
    personnelSummary = aiResult.personnelChanges.slice(0, 15).map(function(p) {
      return (p.name || p.char || '?') + ' · ' + (p.action || p.change || '') + (p.target ? ' → ' + p.target : '');
    });
  }

  // 上回合效能趋势对比基线
  var prevEfficacy = (GM._edictEfficacyHistory && GM._edictEfficacyHistory.length > 0)
    ? GM._edictEfficacyHistory[GM._edictEfficacyHistory.length - 1]
    : null;

  var input = {
    edicts: edictLines,
    mainNarrative: (aiResult.shizhengji || '').slice(0, 1200),
    supplementaryNarrative: (aiResult.zhengwen || '').slice(0, 600),
    varChanges: varChangesSummary,
    personnelChanges: personnelSummary,
    prevOverallEfficacy: prevEfficacy ? prevEfficacy.overallEfficacy : null
  };

  var prompt = '你是御前侍读·职责是代陛下核查本回合所下诏令是否被 AI 推演真实执行·并对朝局做多维度体检。\n\n' +
    '【本回合玩家诏令·按条列出】\n' + JSON.stringify(input.edicts, null, 2) +
    '\n\n【主推演叙事·时政记】\n' + input.mainNarrative +
    (input.supplementaryNarrative ? '\n\n【辅助叙事·政文】\n' + input.supplementaryNarrative : '') +
    '\n\n【数值变化】\n' + (input.varChanges.length ? input.varChanges.join('\n') : '（无）') +
    '\n\n【人事变动】\n' + (input.personnelChanges.length ? input.personnelChanges.join('\n') : '（无）') +
    (input.prevOverallEfficacy !== null ? '\n\n【上回合代理强度】' + input.prevOverallEfficacy + '% (供趋势对比)' : '') +
    '\n\n【任务】输出 JSON：\n' +
    '{\n' +
    '  "reports": [\n' +
    '    {\n' +
    '      "id": "诏令 id",\n' +
    '      "content": "诏令原文简述",\n' +
    '      "executionLevel": 0-100,\n' +
    '      "status": "executed/partial/delayed/ignored",\n' +
    '      "evidence": "引用推演具体证据",\n' +
    '      "missed": "未落实部分(若全部执行则空)",\n' +
    '      "reason": "AI 为何这样处理(阁阻/时机/前提/冲突 等)",\n' +
    '      "outcomeShortTerm": "本回合立刻看到的效果(含正负)",\n' +
    '      "outcomeLongTerm": "预期未来 3-5 回合的延伸效应",\n' +
    '      "affectedEntities": ["具体影响到的角色/势力/党派/省份名"],\n' +
    '      "costPaid": "付出的代价(国库/民心/合法性/威望)",\n' +
    '      "oppositionFaced": "遇到的阻力来源(某阁臣/某党派/某势力)",\n' +
    '      "linkedEdicts": ["与本回合其他诏令协同 id 或冲突 id"],\n' +
    '      "nextAdvice": "下回合玩家应如何催办/调整"\n' +
    '    }\n' +
    '  ],\n' +
    '  "unexpectedEvents": [\n' +
    '    {\n' +
    '      "title": "事件短题",\n' +
    '      "category": "天灾/人祸/边报/党争/朝议/民变/异象/外交/经济",\n' +
    '      "severity": "轻/中/重/危",\n' +
    '      "triggeredBy": "玩家某诏令副作用 / 长期诏书累积 / NPC 自主 / 外部势力",\n' +
    '      "detail": "40 字内细节",\n' +
    '      "playerCouldHavePrevented": "可否预防+如何预防·若不可预防则为空"\n' +
    '    }\n' +
    '  ],\n' +
    '  "efficacyByDimension": {\n' +
    '    "military": 0-100, "fiscal": 0-100, "personnel": 0-100,\n' +
    '    "diplomatic": 0-100, "popular": 0-100, "authority": 0-100\n' +
    '  },\n' +
    '  "efficacyTrend": "+N / -N (相比上回合·若无上回合则 0)",\n' +
    '  "courtReaction": {\n' +
    '    "clearFaction": "清流/东林的评价(30字)",\n' +
    '    "eunuchFaction": "阉党/当权派的评价(30字)",\n' +
    '    "neutralFaction": "中立/观望派的评价(30字)"\n' +
    '  },\n' +
    '  "popularReaction": "民间/士林/市井的回响(40字)",\n' +
    '  "strategicInsight": "站在皇帝长期战略角度的洞见+提醒(60字·可带隐忧/机会)",\n' +
    '  "overallEfficacy": 0-100,\n' +
    '  "topPriority": "下回合优先催办的 1-2 件事"\n' +
    '}\n\n' +
    '【核查准则】\n' +
    '1. status: 有对应动作即 executed/partial·"阁议未决/旨延宕"为 delayed·完全无痕为 ignored\n' +
    '2. evidence 必须精确引用叙事/var_changes/personnelChanges·不得凭空\n' +
    '3. affectedEntities 列具体名字·不要笼统"朝廷"\n' +
    '4. oppositionFaced 指出阻力的具体主体·而非"有人反对"\n' +
    '5. linkedEdicts 分析协同/冲突·id 必须来自本回合诏令 id 列表\n' +
    '6. unexpectedEvents 只列本回合推演中自发(非玩家诏令直接触发)的重要事件·不赘述诏令结果\n' +
    '7. efficacyByDimension 按维度 0-100·各维度独立评估·不平均化\n' +
    '8. courtReaction 各派评价要体现派系真实立场(清流偏恤民·阉党偏敛财·浙齐偏观望)\n' +
    '9. strategicInsight 指出隐忧或机会·带具体建议\n' +
    '10. 只输出 JSON·无其他文字';

  try {
    var raw = await callAISmart(prompt, 2000, {
      maxRetries: 2,
      timeoutMs: 60000,
      fetchMaxRetries: 1
    });
    if (!raw) return;
    var parsed;
    try {
      var m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : JSON.parse(raw);
    } catch(e) {
      console.warn('[御批回听] JSON 解析失败', e);
      return;
    }
    if (!parsed || !Array.isArray(parsed.reports)) return;

    // 规范化 unexpectedEvents·兼容旧字符串格式与新对象格式
    var normalizedUnexpected = [];
    if (Array.isArray(parsed.unexpectedEvents)) {
      parsed.unexpectedEvents.slice(0, 6).forEach(function(u) {
        if (typeof u === 'string') {
          normalizedUnexpected.push({ title: u.slice(0, 40), detail: u, category: '', severity: '', triggeredBy: '', playerCouldHavePrevented: '' });
        } else if (u && typeof u === 'object') {
          normalizedUnexpected.push({
            title: (u.title || '').slice(0, 50),
            category: u.category || '',
            severity: u.severity || '',
            triggeredBy: u.triggeredBy || '',
            detail: (u.detail || '').slice(0, 150),
            playerCouldHavePrevented: u.playerCouldHavePrevented || ''
          });
        }
      });
    }

    GM._edictEfficacyReport = {
      turn: GM.turn - 1,
      total: edictLines.length,
      reports: parsed.reports.slice(0, 20),
      unexpectedEvents: normalizedUnexpected,
      overallEfficacy: typeof parsed.overallEfficacy === 'number' ? parsed.overallEfficacy : 50,
      efficacyByDimension: (parsed.efficacyByDimension && typeof parsed.efficacyByDimension === 'object') ? parsed.efficacyByDimension : null,
      efficacyTrend: parsed.efficacyTrend || '',
      courtReaction: (parsed.courtReaction && typeof parsed.courtReaction === 'object') ? parsed.courtReaction : null,
      popularReaction: parsed.popularReaction || '',
      strategicInsight: parsed.strategicInsight || '',
      topPriority: parsed.topPriority || '',
      generatedAt: Date.now()
    };

    // 历史快照·供趋势对比(最多存 20 回合)
    if (!GM._edictEfficacyHistory) GM._edictEfficacyHistory = [];
    GM._edictEfficacyHistory.push({
      turn: GM.turn - 1,
      overallEfficacy: GM._edictEfficacyReport.overallEfficacy,
      efficacyByDimension: GM._edictEfficacyReport.efficacyByDimension,
      total: edictLines.length
    });
    if (GM._edictEfficacyHistory.length > 20) GM._edictEfficacyHistory = GM._edictEfficacyHistory.slice(-20);

    // 统计·为下回合 sysP 注入被忽略/延宕的诏令+各派反应+战略洞见
    var ignoredList = parsed.reports.filter(function(r){ return r.status === 'ignored' || r.status === 'delayed'; });
    if (ignoredList.length > 0) {
      GM._edictEfficacyReport.ignoredOrDelayed = ignoredList.map(function(r) {
        return { id: r.id, content: r.content, status: r.status, reason: r.reason, nextAdvice: r.nextAdvice };
      });
    }
    // 收集所有诏令的 oppositionFaced·去重汇总
    var oppositionSet = {};
    parsed.reports.forEach(function(r) {
      if (r.oppositionFaced && typeof r.oppositionFaced === 'string') {
        var key = r.oppositionFaced.trim();
        if (key && key !== '无') oppositionSet[key] = (oppositionSet[key] || 0) + 1;
      }
    });
    GM._edictEfficacyReport.oppositionSummary = Object.keys(oppositionSet)
      .sort(function(a,b){return oppositionSet[b]-oppositionSet[a];})
      .slice(0, 5);

    // 写编年
    if (!GM._chronicle) GM._chronicle = [];
    var ex = parsed.reports.filter(function(r){return r.status==='executed';}).length;
    var pa = parsed.reports.filter(function(r){return r.status==='partial';}).length;
    var dl = parsed.reports.filter(function(r){return r.status==='delayed';}).length;
    var ig = parsed.reports.filter(function(r){return r.status==='ignored';}).length;
    GM._chronicle.push({
      turn: GM.turn - 1, date: GM._gameDate || '',
      type: '御批回听',
      text: '本回合 ' + edictLines.length + ' 条诏令·完全执行 ' + ex + '·部分 ' + pa + '·延宕 ' + dl + '·忽略 ' + ig + '·效能 ' + (parsed.overallEfficacy || 0) + '%',
      tags: ['御批', '诏令', '问责']
    });
    console.log('[御批回听] 已生成·' + edictLines.length + ' 条诏令审查·效能 ' + parsed.overallEfficacy + '%');
  } catch(e) {
    console.warn('[御批回听] 失败', e);
  }
}

// 构建下回合 sysP 注入·让 AI 读取上回合御批回听的完整内容并持续推进
function buildEdictEfficacyFollowUp() {
  if (!GM._edictEfficacyReport || GM._edictEfficacyReport.skipped) return '';
  var ef = GM._edictEfficacyReport;
  var out = '';

  // 1. 上回合效能概览·AI 需感知朝政大势
  out += '\n\n【上回合御批回听·本朝局势概览(AI 必读并延续)】';
  if (typeof ef.overallEfficacy === 'number') {
    out += '\n总代理强度：' + ef.overallEfficacy + '%';
    if (ef.efficacyTrend) out += '·趋势 ' + ef.efficacyTrend;
  }
  if (ef.efficacyByDimension) {
    var dimLabels = { military: '军事', fiscal: '财政', personnel: '人事', diplomatic: '外交', popular: '民心', authority: '皇权' };
    var dimLine = [];
    Object.keys(dimLabels).forEach(function(k) {
      if (typeof ef.efficacyByDimension[k] === 'number') {
        dimLine.push(dimLabels[k] + ' ' + ef.efficacyByDimension[k]);
      }
    });
    if (dimLine.length) out += '\n六维：' + dimLine.join('·');
  }

  // 2. 朝野反应·AI 应让 NPC 延续情绪
  if (ef.courtReaction) {
    var cr = ef.courtReaction;
    var crLines = [];
    if (cr.clearFaction) crLines.push('清流:' + cr.clearFaction);
    if (cr.eunuchFaction) crLines.push('阉党:' + cr.eunuchFaction);
    if (cr.neutralFaction) crLines.push('中立:' + cr.neutralFaction);
    if (crLines.length) out += '\n朝野反响·' + crLines.join('·').slice(0, 200);
  }
  if (ef.popularReaction) out += '\n民间回响:' + String(ef.popularReaction).slice(0, 100);

  // 3. 持续阻力·AI 推演时须体现这些力量继续作梗
  if (Array.isArray(ef.oppositionSummary) && ef.oppositionSummary.length > 0) {
    out += '\n持续阻力：' + ef.oppositionSummary.slice(0, 5).join('·');
  }

  // 4. 战略洞见·给 AI 推演大方向提示
  if (ef.strategicInsight) out += '\n御前战略提示：' + String(ef.strategicInsight).slice(0, 150);

  // 5. 未落实诏令·必须给交代
  if (Array.isArray(ef.ignoredOrDelayed) && ef.ignoredOrDelayed.length > 0) {
    out += '\n\n【上回合未落实诏令·AI 推演需补偿或明确拒绝】';
    ef.ignoredOrDelayed.forEach(function(r) {
      out += '\n  · [' + (r.status === 'ignored' ? '被忽略' : '延宕中') + '] ' + (r.content || '').slice(0, 80) + '·缘由:' + (r.reason || '').slice(0, 60);
    });
  }

  // 6. 下回合首要
  if (ef.topPriority) out += '\n\n【玩家御前首要关切】' + String(ef.topPriority).slice(0, 100);

  // 7. 推演规则
  out += '\n\n★ 御批回听规则(AI 推演必遵):';
  out += '\n  1. 上回合未落实的诏令必须在本回合 shizhengji 中给出交代·继续推进或说明阻力';
  out += '\n  2. 持续阻力方(上述)本回合应继续发挥影响·非突然消失';
  out += '\n  3. 朝野反响的情绪延续到本回合 NPC 发言/行动基调';
  out += '\n  4. 若玩家本回合有应对战略提示的诏令·优先展开其效果';
  return out;
}
