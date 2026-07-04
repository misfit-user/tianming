// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-ai.js - endturn AI sub-call infra + main subcalls
//
// Phase 7 P7-delta (2026-05-05, Codex).
// Extracted from tm-endturn-ai-infer.js section 2+3.
// Refactor-only: preserves API call count, prompt text, order, and side effects.
// Exports: TM.Endturn.AI.subcalls.setupInfra(ctx), runMain(ctx, afterSc1).
// ============================================================
// ── 章节导航（§ 锚点；跳转请 grep 小节标题，行号会随改动漂移）──
//   入口  setupInfra(ctx) 装配子调用基建；runMain(ctx, afterSc1) 跑主推演链
//   §1 预处理     等待上回合 post-turn 任务 + 同步本地记忆保鲜
//   §2 sc0 / sc1q 并行：sc0 局势分析 · sc1q 对话承诺推演（6 GM 字段 7 渠道，max 8s wall-clock）
//   §3 SC_RECALL  按 sc0 生成的 memoryQueries 从永久档检索 → 注入后续 prompt
//   §4 sc0.5      深度记忆回顾
//   §5 sc1 主推演 结构化数据（时政记/数值变化/事件/角色状态）[always]
//        内含：七变量+深化字段 · 民心分阶层/分区域 · 腐败 6 部门 · 14 源累积 · 行政区划深化 · 输出格式
//   §6 sc1 派发   5 字段 concat 合并 · npc_schemes/hidden_moves 内联 · fengwen_snippets 入风闻录事+actors 心绪
// ============================================================
(function(global) {
  if (typeof global.TM === "undefined") global.TM = {};
  if (typeof global.TM.Endturn === "undefined") global.TM.Endturn = {};
  if (typeof global.TM.Endturn.AI === "undefined") global.TM.Endturn.AI = {};
  if (typeof global.TM.Endturn.AI.subcalls === "undefined") global.TM.Endturn.AI.subcalls = {};

  var ns = global.TM.Endturn.AI.subcalls;

  function ensureGroups(ctx) {
    ctx.input = ctx.input || {};
    ctx.prompt = ctx.prompt || {};
    ctx.subcalls = ctx.subcalls || {};
    ctx.results = ctx.results || {};
    ctx.apply = ctx.apply || {};
    ctx.followup = ctx.followup || {};
    ctx.record = ctx.record || {};
    ctx.meta = ctx.meta || { errors: [], warnings: [], timing: {}, retries: {} };
    ctx.meta.timing = ctx.meta.timing || {};
    return ctx;
  }

  function _turnsForMonthsLocal(months) {
    if (typeof global.turnsForMonths === "function") return global.turnsForMonths(months);
    var dpv = (typeof global._getDaysPerTurn === "function") ? global._getDaysPerTurn() : 30;
    return Math.max(1, Math.ceil((months * 30) / Math.max(1, dpv)));
  }

  ns.setupInfra = function(ctx) {
    ensureGroups(ctx);
    var url = P.ai.url;
    if (url.indexOf("/chat/completions") < 0) url = url.replace(/\/+$/, "") + "/chat/completions";

    var _tokCp = (typeof getCompressionParams === "function") ? getCompressionParams() : { scale: 1.0, contextK: 32 };
    function _getEffectiveOutputLimit() {
      if (P.conf.maxOutputTokens && P.conf.maxOutputTokens > 0) return P.conf.maxOutputTokens;
      if (P.conf._detectedMaxOutput && P.conf._detectedMaxOutput > 0) return P.conf._detectedMaxOutput;
      if (typeof _matchModelOutput === "function") {
        var wl = _matchModelOutput(P.ai.model || "");
        if (wl > 0) return wl * 1024;
      }
      return Math.max(4096, Math.round(_tokCp.contextK * 1024 / 8));
    }
    var _effectiveOutCap = _getEffectiveOutputLimit();
    function _tok(baseTok) {
      if (P.conf.maxOutputTokens && P.conf.maxOutputTokens > 0) {
        return Math.max(500, Math.min(baseTok, P.conf.maxOutputTokens));
      }
      return undefined;
    }
    function _buildFetchBody(model, messages, temperature, baseTok, extra) {
      var body = {model:model, messages:messages, temperature:temperature};
      var mt = _tok(baseTok);
      if (mt !== undefined) body.max_tokens = mt;
      if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) body[k] = extra[k];
      return body;
    }
    // Phase 1 H4\u00B7_truncatedOnce \u2192 _truncatedCount\u00B7>3 \u6B21\u518D toast (\u5355\u6B21\u622A\u65AD\u4E0D\u518D spam\u00B7\u53EA\u5728\u7CFB\u7EDF\u6027 max_tokens \u4E0D\u8DB3\u65F6\u63D0\u793A)
    var _truncatedCount = Number(ctx.subcalls._truncatedCount) || 0;
    function _checkTruncated(data, label) {
      if (!data || !data.choices || !data.choices[0]) return;
      var fr = data.choices[0].finish_reason || data.choices[0].stop_reason;
      if (fr === "length" || fr === "max_tokens") {
        _truncatedCount++;
        ctx.subcalls._truncatedCount = _truncatedCount;
        _dbg("[Truncated]", label, "finish_reason=", fr, "count=", _truncatedCount);
        // \u4EC5\u5F53\u672C\u56DE\u5408\u622A\u65AD\u7D2F\u8BA1 \u22654 \u6B21\u624D toast (\u5355\u6B21\u6216\u5076\u53D1\u4E0D\u6253\u6270)
        if (_truncatedCount === 4 && typeof toast === "function") {
          toast("\u26A0 AI \u8F93\u51FA\u591A\u6B21\u88AB\u622A\u65AD\uFF08" + label + "\uFF09\uFF0C\u8003\u8651\u8C03\u9AD8 AI \u8F93\u51FA\u4E0A\u9650");
        }
      }
    }
    function _jsonFinishReason(data) {
      if (!data || !data.choices || !data.choices[0]) return "";
      return data.choices[0].finish_reason || data.choices[0].stop_reason || "";
    }
    function _looksJsonUnclosed(text) {
      text = String(text || "").trim();
      if (!text) return false;
      var start = text.indexOf("{");
      var arr = text.indexOf("[");
      if (start < 0 || (arr >= 0 && arr < start)) start = arr;
      if (start < 0) return false;
      var open = text[start], close = open === "{" ? "}" : "]";
      var depth = 0, inStr = false, esc = false;
      for (var i = start; i < text.length; i++) {
        var c = text[i];
        if (esc) { esc = false; continue; }
        if (c === "\\") { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === open) depth++;
        else if (c === close) depth--;
      }
      return depth > 0 || inStr;
    }
    function _hasExpectedJsonKey(parsed, expectedKeys) {
      if (!parsed || typeof parsed !== "object") return false;
      if (!expectedKeys || expectedKeys.length === 0) return true;
      for (var i = 0; i < expectedKeys.length; i++) {
        var k = expectedKeys[i];
        if (Object.prototype.hasOwnProperty.call(parsed, k)) return true;
      }
      return false;
    }
    function _normalizeParsedJsonForExpected(parsed, expectedKeys) {
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
      var keys = expectedKeys || [];
      var obj = parsed;
      if (!_hasExpectedJsonKey(obj, keys)) {
        ['result','data','output','response','json'].some(function(k) {
          if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) { obj = obj[k]; return true; }
          return false;
        });
      }
      var changed = obj !== parsed;
      function copy(to, froms) {
        if (Object.prototype.hasOwnProperty.call(obj, to)) return;
        for (var i = 0; i < froms.length; i++) {
          var k = froms[i];
          if (Object.prototype.hasOwnProperty.call(obj, k)) { obj[to] = obj[k]; changed = true; return; }
        }
      }
      // Phase 1 H6·补全 50+ 字段中英文 + 中文别名·覆盖 sc1/sc1b/sc1c/sc1d/sc15/sc16/sc25/sc27 全主要字段
      // 叙事核心
      copy('shizhengji', ['shizheng','szj','shizhengji_text','political_record','chronicle','时政记','时政','史记','本回合时政']);
      copy('shilu_text', ['shilu','record','annals','imperial_record','实录','起居注','实录正文']);
      copy('szj_title', ['shizhengji_title','political_record_title','title','时政记标题','时政标题']);
      copy('szj_summary', ['shizhengji_summary','political_record_summary','summary','时政记总结','时政总结']);
      copy('zhengwen', ['text','content','narrative','story','houren','houren_xishuo','hourenXishuo','正文','叙事正文','后人戏说']);
      copy('turn_summary', ['summary_brief','回合总结','本回合总结','本回合摘要']);
      copy('shizhengji_basis', ['shizhengji_facts','政记依据','时政记依据','时政依据']);
      copy('player_status', ['playerStatus','emperor_status','君主状态','玩家状态','上意']);
      copy('player_inner', ['playerInner','emperor_inner','内心独白','心中独白','心声']);
      // 事件/账本
      copy('events', ['event_list','eventLog','eventLogs','事件','事件列表','事件清单']);
      copy('resource_changes', ['resourceChanges','resources','stat_changes','资源变化','数值变化','国库变动']);
      copy('variable_changes', ['variableChanges','七变','变量变化','七变变化']);
      copy('changes', ['delta','变化','本回合变化','变更']);
      copy('fiscal_adjustments', ['fiscalAdjustments','财政调整','财政变化']);
      copy('currency_adjustments', ['currencyAdjustments','currency_actions','currencyActions','货币调整','货币政策','币制动作']);
      copy('population_adjustments', ['populationAdjustments','huji_actions','hujiActions','户口调整','户籍调整','户口政策']);
      copy('central_local_actions', ['centralLocalActions','central_local_adjustments','centralLocalAdjustments','央地财政动作','央地财政调整','央地动作']);
      copy('environment_actions', ['environmentActions','environment_adjustments','environmentAdjustments','环境动作','环境政策','环境承载调整']);
      copy('institution_changes', ['institutionChanges','institution_actions','institutionActions','制度变化','制度动作','官制动作']);
      copy('table_updates', ['tableUpdates','表格更新','表更新']);
      copy('suggestions', ['advice','tips','建议','谋议']);
      // 人物/任免
      copy('char_updates', ['character_updates','characters','npc_updates','人物变化','角色变化','人物更新']);
      copy('character_deaths', ['deaths','character_death','人物身殁','人物死亡','卒']);
      copy('personnel_changes', ['personnelChanges','人事变动','人事调动']);
      copy('office_changes', ['officeChanges','官职变动','官制变动']);
      copy('office_assignments', ['officeAssignments','appointments','任命','任职']);
      copy('office_dismissals', ['officeDismissals','dismissals','罢免','革职']);
      copy('npc_actions', ['npcActions','npc_act','NPC行动','NPC动向']);
      copy('npc_interactions', ['npcInteractions','NPC互动','NPC往来']);
      copy('npc_letters', ['npcLetters','npc_mail','NPC来信','NPC书信']);
      copy('npc_correspondence', ['npcCorrespondence','NPC通信','NPC密信','NPC往来书信']);
      copy('npc_schemes', ['npcSchemes','NPC阴谋','NPC谋划']);
      copy('cultural_works', ['culturalWorks','文苑','文学作品','文苑作品']);
      // 势力/外交
      copy('faction_changes', ['factionChanges','势力变化','势力变动']);
      copy('faction_events', ['factionEvents','势力事件','势力间事件']);
      copy('faction_ai_outcomes', ['factionAiOutcomes','faction_ai_results','factionAiResults','势力AI结果','势力AI推演结果']);
      copy('faction_relation_changes', ['factionRelationChanges','势力关系变化','势力关系变动']);
      copy('faction_relation_shift', ['factionRelationShift','势力关系流转','势力关系变迁']);
      copy('faction_interactions_advanced', ['factionInteractionsAdvanced','势力深度互动']);
      copy('faction_create', ['factionCreate','势力创建','新势力']);
      copy('faction_dissolve', ['factionDissolve','势力覆灭','势力解体']);
      copy('faction_succession', ['factionSuccession','势力传承','势力继承']);
      copy('party_changes', ['partyChanges','党派变化']);
      copy('party_updates', ['partyUpdates','党派更新']);
      copy('party_create', ['partyCreate','党派创建','党派新建']);
      copy('party_dissolve', ['partyDissolve','党派覆灭','党派解散']);
      copy('hidden_moves', ['hiddenMoves','暗中动向','暗流','幕后动向']);
      copy('scheme_actions', ['schemeActions','阴谋行动','谋划行动']);
      // 军事/地理
      copy('army_changes', ['armyChanges','军队变化','军备变化','兵力变化']);
      copy('province_changes', ['provinceChanges','行省变化','州县变化']);
      copy('region_updates', ['regionUpdates','地区更新','区域更新']);
      // 诏令/反馈
      copy('edict_feedback', ['edictFeedback','诏令反馈','诏令执行','政令反馈']);
      copy('edict_relations', ['edictRelations','诏令关系']);
      copy('edict_lifecycle_update', ['edictLifecycleUpdate','诏令生命周期','诏令推进']);
      copy('commitment_update', ['commitmentUpdate','承诺进展','承诺更新']);
      // 阶层/起义
      copy('class_changes', ['classChanges','阶层变化','阶级变化']);
      copy('class_updates', ['classUpdates','阶层更新','阶级更新']);
      copy('revolt_update', ['revoltUpdate','起义更新','起义推进']);
      copy('regent_decisions', ['regentDecisions','摄政决断','辅政决断']);
      // 信息流·sc1c
      copy('fengwen_snippets', ['fengwenSnippets','风闻','风闻片段']);
      copy('faction_undercurrents', ['factionUndercurrents','势力暗流','势力潜流']);
      copy('mood_shifts', ['moodShifts','情绪变化','情绪流转']);
      copy('relationship_changes', ['relationshipChanges','关系变化']);

      if (obj.event && !obj.events) { obj.events = [obj.event]; changed = true; }
      if (changed) {
        obj._formatNormalized = true;
        try {
          if (!GM._turnAiResults) GM._turnAiResults = {};
          if (!Array.isArray(GM._turnAiResults._jsonNormalizations)) GM._turnAiResults._jsonNormalizations = [];
          GM._turnAiResults._jsonNormalizations.push({ keys: Object.keys(obj).slice(0, 12), expected: keys.slice(0), at: Date.now() });
          if (GM._turnAiResults._jsonNormalizations.length > 20) GM._turnAiResults._jsonNormalizations.shift();
        } catch(_) {}
      }
      return obj;
    }
    function _trimRepairText(text, maxLen) {
      text = String(text || "");
      maxLen = maxLen || 9000;
      if (text.length <= maxLen) return text;
      var head = Math.floor(maxLen * 0.65);
      var tail = maxLen - head;
      return text.slice(0, head) + "\n...[truncated middle for JSON repair]...\n" + text.slice(-tail);
    }
    function _formatAIError(err) {
      var msg = (err && err.message) ? String(err.message) : String(err || "unknown error");
      var status = (err && (err.status || err.statusCode)) || "";
      var snippet = "";
      if (/aborted without reason|aborterror|signal is aborted|the operation was aborted/i.test(msg)) {
        msg = "AI请求超时或被浏览器中断";
        status = status || "ABORT";
      }
      if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
        msg = "AI请求网络失败（浏览器未能连接到API，或被代理/CORS/页面缓存中断）";
        status = status || "NETWORK";
      }
      try {
        var raw = err && err.lastRaw;
        if (raw) {
          if (!status && raw.status) status = raw.status;
          var resp = raw.response;
          if (resp !== undefined && resp !== null) {
            snippet = (typeof resp === "string") ? resp : JSON.stringify(resp);
          }
        }
      } catch(_) {}
      return {
        message: msg,
        status: status || "",
        snippet: String(snippet || "").slice(0, 300)
      };
    }
    async function _parseOrRepairJsonResult(raw, data, label, opts) {
      opts = opts || {};
      var expectedKeys = opts.expectedKeys || [];
      var parsed = (typeof extractJSON === "function") ? extractJSON(raw) : null;
      parsed = _normalizeParsedJsonForExpected(parsed, expectedKeys);
      var finishReason = _jsonFinishReason(data);
      var truncated = finishReason === "length" || finishReason === "max_tokens" || _looksJsonUnclosed(raw);
      var valid = _hasExpectedJsonKey(parsed, expectedKeys);
      // valid 即用本地解析：extractJSON 已把截断 JSON 尽量补全·9000 字符头尾窗口的修复产物只会更糟(中段账目蒸发·2026-07-04 审查定罪)
      if (valid) return { parsed: parsed, raw: raw, repaired: false, truncated: truncated };
      if (opts.repair === false || !opts.url || !opts.key || !opts.body) {
        return { parsed: valid ? parsed : null, raw: raw, repaired: false, truncated: truncated, failed: !valid };
      }
      try {
        var originalBody = opts.body || {};
        // Phase 1 H3·schemaHint 改 expectedKeys 显式列表 + field 示例 (而非塞原 prompt 尾巴)
        //   旧·schemaHint = lastMsg.content.slice(-3500)·往往是诏令/历史叙述等无关上下文·模型修复时跑偏
        //   新·明确告诉修复 LLM·只输出哪几个字段·每个字段什么形状 (array/object/string)
        var schemaHint = "";
        if (expectedKeys.length) {
          var _fieldDesc = [];
          // 命中已知 schema 的字段类型·从 tm-ai-schema 推断 (若可用)·否则 fallback 启发式
          // 修死引用·TM.AISchema 从不存在(tm-ai-schema.js 真实导出是 window.TM_AI_SCHEMA.raw)·此前恒 null 静默走 fallback 启发式
          var _schemaTbl = (typeof window !== 'undefined' && window.TM_AI_SCHEMA && window.TM_AI_SCHEMA.raw) || null;
          expectedKeys.forEach(function(k) {
            var def = _schemaTbl && _schemaTbl[k];
            var ty = def && def.type ? def.type : (
              /list$|s$|events|changes|updates|actions|letters|works|deaths|interactions|adjustments|assignments|dismissals/.test(k) ? 'array' :
              /text$|summary$|title$|status$|inner$|basis$/.test(k) ? 'string' :
              'object_or_string'
            );
            var hint = '  "' + k + '": ' + (ty === 'array' ? '[]·允许空数组' : ty === 'string' ? '""·允许空字符串' : ty === 'object' ? '{}·允许空对象' : 'value');
            if (def && def.desc) hint += '  // ' + String(def.desc).slice(0, 60);
            _fieldDesc.push(hint);
          });
          schemaHint = 'Required fields (must appear at top level·空值也要给出 key):\n{\n' + _fieldDesc.join(',\n') + '\n}';
        }
        var repairPrompt =
          "Repair this end-turn JSON result. Return only one complete JSON object. NO markdown, NO prose.\n" +
          "Rules: preserve existing facts, names, text, and numeric values; do not invent new deaths, resource changes, battles, or stat changes; if the tail is missing, close the structure or use empty strings/arrays for missing tail fields.\n" +
          (expectedKeys.length ? "Required top-level keys: " + expectedKeys.join(", ") + "\n" : "") +
          "\n[Target schema·使用此结构填充·缺失字段给空数组/空字符串]\n" + schemaHint +
          "\n\n[Broken JSON to repair]\n" + _trimRepairText(raw, 9000);
        var repairBody = {
          model: originalBody.model || (P.ai && P.ai.model) || "gpt-4o",
          messages: [
            { role: "system", content: "You repair invalid or truncated JSON. Return JSON only." },
            { role: "user", content: repairPrompt }
          ],
          temperature: 0,
          max_tokens: _tok(opts.repairTokens || 6000)
        };
        if (originalBody.response_format) repairBody.response_format = originalBody.response_format;
        if (typeof _aiFetchWithRetry !== "function") throw new Error("AI queue unavailable for JSON repair");
        var repairData = await _aiFetchWithRetry(opts.url, repairBody, opts.signal || null, {
          apiKey: opts.key,
          priority: opts.repairPriority || opts.priority || "normal",
          timeoutMs: opts.repairTimeoutMs || 45000,
          maxRetries: opts.repairMaxRetries != null ? opts.repairMaxRetries : 1
        });
        _checkTruncated(repairData, (label || "JSON") + " repair");
        if (repairData.usage && typeof TokenUsageTracker !== "undefined") TokenUsageTracker.record(repairData.usage, ((opts && opts.id) || (label && (label + ':repair'))) || 'repair');
        var repairRaw = "";
        if (repairData.choices && repairData.choices[0] && repairData.choices[0].message) repairRaw = repairData.choices[0].message.content || "";
        var repairParsed = (typeof extractJSON === "function") ? extractJSON(repairRaw) : null;
        repairParsed = _normalizeParsedJsonForExpected(repairParsed, expectedKeys);
        var repairValid = _hasExpectedJsonKey(repairParsed, expectedKeys);
        if (repairValid) {
          if (!GM._turnAiResults) GM._turnAiResults = {};
          if (!Array.isArray(GM._turnAiResults._jsonRepairs)) GM._turnAiResults._jsonRepairs = [];
          GM._turnAiResults._jsonRepairs.push({ label: label || "", finish_reason: finishReason || "", raw_len: String(raw || "").length, repair_len: repairRaw.length });
          _dbg("[JSON Repair]", label, "finish_reason=", finishReason || "parse", "raw_len=", String(raw || "").length);
          return { parsed: repairParsed, raw: repairRaw, repaired: true, truncated: truncated };
        }
        throw new Error("repair parse failed");
      } catch (e) {
        if (!GM._turnAiResults) GM._turnAiResults = {};
        if (!Array.isArray(GM._turnAiResults._jsonRepairFailures)) GM._turnAiResults._jsonRepairFailures = [];
        GM._turnAiResults._jsonRepairFailures.push({ label: label || "", finish_reason: finishReason || "", error: e.message || String(e), raw_len: String(raw || "").length });
        console.warn("[JSON Repair] failed:", label, e);
        return { parsed: valid ? parsed : null, raw: raw, repaired: false, truncated: truncated, failed: true };
      }
    }

    function _recordMemoryTraceSubcall(body, opts, raw, data, started, ok, errorInfo) {
      try {
        if (!global.TM || !global.TM.MemoryTrace || typeof global.TM.MemoryTrace.recordSubcall !== 'function') return;
        global.TM.MemoryTrace.recordSubcall(GM, {
          id: opts && opts.id || '',
          label: opts && opts.label || 'endturn',
          body: body,
          response: raw || '',
          usage: data && data.usage,
          latencyMs: Date.now() - started,
          ok: ok !== false,
          error: errorInfo && errorInfo.message,
          status: errorInfo && errorInfo.status,
          model: body && body.model || '',
          finishReason: data && data.choices && data.choices[0] && data.choices[0].finish_reason || ''
        });
      } catch(_) {}
    }

    async function _callEndturnAI(body, opts) {
      opts = _mergeCallPolicy(opts && opts.id, opts || {});
      var callUrl = opts.url || url;
      var key = opts.key || (P.ai && P.ai.key);
      var label = opts.label || 'endturn';
      var started = Date.now();
      var data = null;
      var raw = '';
      try {
        if (typeof _aiFetchWithRetry === 'function') {
          data = await _aiFetchWithRetry(callUrl, body, opts.signal || null, {
            apiKey: key,
            priority: opts.priority || 'normal',
            timeoutMs: opts.timeoutMs,
            maxRetries: opts.maxRetries
          });
        } else {
          var resp = await fetch(callUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
            body: JSON.stringify(body),
            signal: opts.signal
          });
          if (!resp.ok) {
            var httpErr = new Error('HTTP ' + resp.status);
            httpErr.status = resp.status;
            try {
              httpErr.lastRaw = { status: resp.status, response: await resp.text() };
            } catch(_) {}
            throw httpErr;
          }
          data = await resp.json();
        }
        _checkTruncated(data, label);
        if (data && data.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(data.usage, (opts && opts.id) || 'endturn:unknown');
        // §6.5 R2·标准化 _aiDispatchStats·补 successCount + totalTokens
        try {
          if (GM && GM._aiDispatchStats) {
            GM._aiDispatchStats.successCount = (GM._aiDispatchStats.successCount || 0) + 1;
            if (data && data.usage) {
              var tt = (data.usage.prompt_tokens || 0) + (data.usage.completion_tokens || 0);
              GM._aiDispatchStats.totalTokens = (GM._aiDispatchStats.totalTokens || 0) + tt;
            }
          }
        } catch(_dStatsE) {}
        if (data && data.choices && data.choices[0] && data.choices[0].message) raw = data.choices[0].message.content || '';
        // 2026-06-07·超大响应源头封顶(防御纵深·配合 robustParseJSON 护栏)。
        // 第三方中转/模型复读可吐回数 MB~数十 MB 的垃圾响应;回合「深度推演」阶段众多子调用拿它去解析/入账,
        // 内存峰值叠加可把 Electron 渲染进程撑爆 → 深推时突然黑屏、必须重启。合法子调用 ≤8000 tokens(数十 KB)。
        // 超过上限一律视为失控:丢弃内容·让此子调用按"空响应"优雅失败·绝不让超大串向下游(解析/MemoryTrace/turnAiResults)传播。
        try {
          // 2026-06-11·安卓 WebView 小堆·上限比桌面更狠(合法子调用仅几十 KB·384KB 仍远超之)·更早丢弃失控中转响应防累积。
          var _capIsCap = (function(){ try { if (window.TM && TM.platform && TM.platform.kind) return TM.platform.kind === 'capacitor'; return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch(_) { return false; } })();
          var _RAW_CAP = _capIsCap ? 393216 : 1000000; // 安卓~384KB·桌面~1MB·均远超任何合法子调用·远低于致 OOM 量级
          if (raw && raw.length > _RAW_CAP) {
            var _oversize = raw.length;
            _dbg('[_callEndturnAI] ' + label + ' 响应过大 ' + _oversize + ' 字符·丢弃防 OOM(深推渲染器崩溃护栏)');
            try { if (data && data.choices && data.choices[0] && data.choices[0].message) data.choices[0].message.content = ''; } catch(_clrE) {}
            raw = '';
            try {
              if (!GM._turnAiResults) GM._turnAiResults = {};
              if (!Array.isArray(GM._turnAiResults._oversizedResponses)) GM._turnAiResults._oversizedResponses = [];
              GM._turnAiResults._oversizedResponses.push({ id: opts.id || '', label: label, len: _oversize, turn: GM.turn });
              if (GM._turnAiResults._oversizedResponses.length > 20) GM._turnAiResults._oversizedResponses.shift();
              // 安卓端实时告知玩家(本回合首次即弹·不刷屏):既确认「确实在收到超大中转响应」·又解释为何拦截。
              if (_capIsCap && GM._turnAiResults._oversizedResponses.length === 1 && typeof toast === 'function') {
                toast('⚠ 第三方中转返回超大响应 ' + Math.round(_oversize / 1024) + 'KB·已拦截防闪退;若反复出现请换稳定中转或改用官方 API');
              }
            } catch(_recE) {}
          }
        } catch(_capE) {}
        _recordMemoryTraceSubcall(body, opts, raw, data, started, true, null);
        if (typeof recordAIDiagnostic === 'function') {
          recordAIDiagnostic('call', { id: opts.id || '', label: label, ok: true, ms: Date.now() - started });
        }
        if (opts.expectedKeys) {
          var parsed = await _parseOrRepairJsonResult(raw, data, label, {
            url: callUrl,
            key: key,
            body: body,
            expectedKeys: opts.expectedKeys,
            repair: opts.repair,
            repairTokens: opts.repairTokens,
            priority: opts.priority || 'normal',
            repairPriority: opts.repairPriority,
            repairTimeoutMs: opts.repairTimeoutMs,
            repairMaxRetries: opts.repairMaxRetries
          });
          if (parsed && parsed.repaired && typeof recordAIDiagnostic === 'function') {
            recordAIDiagnostic('json_repair', { id: opts.id || '', label: label, raw_len: String(raw || '').length });
          }
          return { data: data, raw: parsed && parsed.raw ? parsed.raw : raw, parsed: parsed ? parsed.parsed : null, parse: parsed };
        }
        return { data: data, raw: raw, parsed: null, parse: null };
      } catch(e) {
        var errInfo = _formatAIError(e);
        _recordMemoryTraceSubcall(body, opts, '', data, started, false, errInfo);
        if (typeof recordAIDiagnostic === 'function') {
          recordAIDiagnostic('call_failed', {
            id: opts.id || '',
            label: label,
            error: errInfo.message,
            status: errInfo.status,
            snippet: errInfo.snippet,
            ms: Date.now() - started,
            model: body && body.model || ''
          });
        }
        try {
          if (!GM._turnAiResults) GM._turnAiResults = {};
          if (!Array.isArray(GM._turnAiResults._callFailures)) GM._turnAiResults._callFailures = [];
          GM._turnAiResults._callFailures.push({
            id: opts.id || '',
            label: label,
            error: errInfo.message,
            status: errInfo.status,
            snippet: errInfo.snippet,
            ms: Date.now() - started,
            model: body && body.model || ''
          });
          if (GM._turnAiResults._callFailures.length > 20) GM._turnAiResults._callFailures.shift();
        } catch(_) {}
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[EndturnAI] call failed:', opts.id || '', label, errInfo.message, errInfo.status || '');
        }
        throw e;
      }
    }

    ctx.subcalls.url = url;
    ctx.subcalls._tokCp = _tokCp;
    ctx.subcalls._effectiveOutCap = _effectiveOutCap;
    ctx.subcalls._tok = _tok;
    ctx.subcalls._buildFetchBody = _buildFetchBody;
    ctx.subcalls._truncatedCount = _truncatedCount;
    ctx.subcalls._checkTruncated = _checkTruncated;
    ctx.subcalls._parseOrRepairJsonResult = _parseOrRepairJsonResult;
    ctx.subcalls._callEndturnAI = _callEndturnAI;
    ctx.subcalls._formatAIError = _formatAIError;
    ctx.subcalls._getCallPolicy = ns.getCallPolicy;
    ctx.subcalls._modelTemp = P.ai.temp || (typeof ModelAdapter !== "undefined" ? ModelAdapter.getDefaultTemp() : 0.8);
    ctx.subcalls._modelFamily = (typeof ModelAdapter !== "undefined") ? ModelAdapter.detectFamily(P.ai.model) : "openai";
    _dbg("[TokenLimit] effective output cap:", _effectiveOutCap, "tokens | manual:", P.conf.maxOutputTokens || 0, "detected:", P.conf._detectedMaxOutput || 0);
    return ctx;
  };

  ns.runMain = async function(ctx, afterSc1) {
    ensureGroups(ctx);
    ns.setupInfra(ctx);

    var edicts = ctx.input.edicts;
    var xinglu = ctx.input.xinglu;
    var memRes = ctx.input.memRes;
    var oldVars = ctx.input.oldVars;
    var timeRatio = ctx.input.timeRatio;
    var sysP = ctx.prompt.sysP;
    // [1C·sysBlocks·2026-06-02] sysPFor(scId)：按 profile 取精简 sysP；取不到则回退整条 sysP(安全)。
    var sysPFor = (ctx.prompt && ctx.prompt.sysPFor) ? ctx.prompt.sysPFor : function(){ return sysP; };
    var tp = ctx.prompt.tp || "";
    var sc = ctx.prompt.sc;
    var _shiluR = ctx.prompt._shiluR, _shiluMin = ctx.prompt._shiluMin, _shiluMax = ctx.prompt._shiluMax;
    var _szjR = ctx.prompt._szjR, _szjMin = ctx.prompt._szjMin, _szjMax = ctx.prompt._szjMax;
    var _hourenR = ctx.prompt._hourenR, _hourenMin = ctx.prompt._hourenMin, _hourenMax = ctx.prompt._hourenMax;
    var _zwR = ctx.prompt._zwR, _zwMin = ctx.prompt._zwMin, _zwMax = ctx.prompt._zwMax;
    var _commentR = ctx.prompt._commentR;
    var url = ctx.subcalls.url;
    var _tok = ctx.subcalls._tok;
    var _buildFetchBody = ctx.subcalls._buildFetchBody;
    var _checkTruncated = ctx.subcalls._checkTruncated;
    var _parseOrRepairJsonResult = ctx.subcalls._parseOrRepairJsonResult;
    var _callEndturnAI = ctx.subcalls._callEndturnAI;
    var _formatAIError = ctx.subcalls._formatAIError || function(e) {
      return { message: (e && e.message) ? String(e.message) : String(e || "unknown error"), status: "", snippet: "" };
    };
    var _effectiveOutCap = ctx.subcalls._effectiveOutCap;
    var _modelTemp = ctx.subcalls._modelTemp;
    var _modelFamily = ctx.subcalls._modelFamily;

    // §2 Sub-call 注册化基础设施（_runSubcall + 共享变量声明）
    // ═══════════════════════════════════════════════════════════
      // 3.3: Sub-call注册化——共享变量前置声明 + 管线描述 + 执行包装器
      var _aiDepth = (P.conf && P.conf.aiCallDepth) || 'full';
      var aiThinking = '';
      var memoryReview = '';
      var p1 = null;
      var p2 = null;
      var p1Summary = '';
      GM._turnAiResults = {}; // 收集所有Sub-call的原始返回值
      try {
        if (global.TM && global.TM.MemoryTrace && typeof global.TM.MemoryTrace.ensureTurnTrace === 'function') {
          global.TM.MemoryTrace.ensureTurnTrace(GM, { source: 'endturn.runMain' });
        }
      } catch(_) {}
      GM._subcallTimings = {}; // 收集每个Sub-call的耗时
      if (typeof ensureAIDiagnostics === 'function') ensureAIDiagnostics(GM.turn || 0);
      if (typeof setAIBranchDiagnostic === 'function') setAIBranchDiagnostic('main', 'running', 'sc1 family pending');

      // 3.3: Sub-call管线描述（用于调试/监控/未来完整迁移）
      var _subcallMeta = [
        {id:'sc0', name:'AI深度思考', minDepth:'standard', order:0},
        {id:'sc1q', name:'对话承诺推演', minDepth:'lite', order:2},
        {id:'sc05', name:'记忆回顾', minDepth:'standard', order:5},
        {id:'sc1', name:'结构化数据', minDepth:'lite', order:100},
        {id:'sc1b', name:'文事鸿雁人际', minDepth:'lite', order:110},
        {id:'sc1c', name:'势力外交·NPC阴谋', minDepth:'lite', order:120},
        {id:'sc1d', name:'实录时政', minDepth:'lite', order:130},
        {id:'sc15', name:'NPC深度', minDepth:'standard', order:150},
        {id:'sc15n', name:'NPC合成·3tier', minDepth:'lite', order:148},
        {id:'sc_memwrite', name:'NPC记忆回写', minDepth:'lite', order:155},
        {id:'sc16', name:'势力推演', minDepth:'full', order:160},
        {id:'sc17', name:'经济财政', minDepth:'full', order:170},
        {id:'sc18', name:'军事态势', minDepth:'full', order:180},
        {id:'sc_audit', name:'数据一致性审核', minDepth:'lite', order:185},
        {id:'sc2', name:'叙事正文', minDepth:'lite', order:200},
        {id:'sc2_outline', name:'叙事大纲', minDepth:'lite', order:202},
        {id:'sc27_review', name:'大纲审查', minDepth:'standard', order:204},
        {id:'sc2_prose', name:'叙事成文', minDepth:'lite', order:206},
        {id:'sc25', name:'伏笔记忆', minDepth:'lite', order:250},
        {id:'sc25c', name:'记忆合成·双调用', minDepth:'lite', order:245},
        {id:'sc27', name:'叙事审查', minDepth:'standard', order:270},
        {id:'sc07', name:'NPC认知整合', minDepth:'lite', order:275},
        {id:'sc28', name:'世界快照', minDepth:'full', order:280}
      ];

      // ★ 静默 loading 辅助（2026-04-30）：post-turn 队列触发的子调用·不再弹 loading 蒙层
      // post-turn 任务运行时玩家已在看史记/操作下回合·此时若 showLoading 会错误打断 UI
      // GM._postTurnJobs 由 _ensurePostTurnJobQueue 创建·flush 后保持到下回合开始 await
      function _quietLoad(label, pct) {
        if (GM && GM._postTurnJobs) return; // 后台静默
        if (typeof showLoading === 'function') showLoading(label, pct);
      }

      // ★ Prompt cache 统一辅助（2026-04-30）：双重门控·只为原生 Anthropic 启用 cache_control
      // 兼容性：OpenAI/GPT/Gemini/DeepSeek/OpenRouter/国内中转站等所有走 /chat/completions 的接口
      //         一律返回原字符串·完全 no-op·因为 (1) provider 不是 anthropic 或 (2) URL 不是 api.anthropic.com
      // 使用：messages:[{role:"system",content:_maybeCacheSys(sysP)},{role:"user",content:tpX}]
      // Phase 2 A1·SC1_SCHEMA_TIERS·真 3 层 dispatcher·by modelCap·必含 10 / 高频 10 / 可选 5
      var SC1_SCHEMA_TIERS = {
        // tier 1·必含·任何 model cap 都包含·核心账本与叙事 (10 字段)
        core: ['turn_summary', 'shizhengji_basis', 'shilu_text', 'szj_title', 'shizhengji', 'szj_summary', 'player_status', 'events', 'char_updates', 'edict_feedback'],
        // tier 2·高频·standard+·常用业务字段 (10 字段)
        common: ['fiscal_adjustments', 'currency_adjustments', 'population_adjustments', 'central_local_actions', 'environment_actions', 'institution_changes', 'personnel_changes', 'office_changes', 'faction_relation_changes', 'faction_relation_shift', 'army_changes', 'armory_procurement', 'province_changes', 'character_deaths', 'npc_actions', 'edict_lifecycle_update', 'character_memory_updates'],
        // tier 3·可选·full·高级业务 (5 字段)
        extended: ['party_changes', 'class_changes', 'class_alert_responses', 'economic_advice', 'table_updates']
      };
      // _buildSc1Schema(tier, modelCap)·按 modelCap 决定 tier·返回 SC1 schema 字段子集
      function _buildSc1Schema(tier, modelCap) {
        if (!tier) {
          // 推断 tier·按 modelCap (effective output cap K)
          var capK = (typeof modelCap === 'number' && modelCap > 0) ? Math.round(modelCap / 1024) : 16;
          if (capK <= 4) tier = 'core';
          else if (capK <= 8) tier = 'common';
          else tier = 'extended';
        }
        var fields = SC1_SCHEMA_TIERS.core.slice();
        if (tier === 'common' || tier === 'extended') fields = fields.concat(SC1_SCHEMA_TIERS.common);
        if (tier === 'extended') fields = fields.concat(SC1_SCHEMA_TIERS.extended);
        return { tier: tier, fields: fields };
      }
      // 暴露 tier 配置·smoke 可锁·调试可调
      if (ns) {
        ns.SC1_SCHEMA_TIERS = SC1_SCHEMA_TIERS;
        ns.buildSc1Schema = _buildSc1Schema;
      }

      // Phase 6 Q1·OpenAI strict json_schema builder·sc1 / sc1b / sc1c / sc1q 各一份·宽松字段长度·nullable 可选·enum 列全
      // 开关·P.ai.openaiStrict===true 才走 strict·失败 fallback to json_object (见 Q1-3)
      function _buildSc1JsonSchema() {
        return {
          name: 'sc1_main',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: true,
            properties: {
              turn_summary: { type: 'string' },
              shizhengji_basis: { type: 'string' },
              shilu_text: { type: 'string' },
              szj_title: { type: 'string' },
              shizhengji: { type: 'string' },
              szj_summary: { type: 'string' },
              player_status: { type: 'string' },
              player_inner: { type: 'string' },
              events: { type: 'array', items: { type: 'object', additionalProperties: true } },
              resource_changes: { type: 'object', additionalProperties: true },
              variable_changes: { type: 'object', additionalProperties: true },
              char_updates: { type: 'array', items: { type: 'object', additionalProperties: true } },
              character_deaths: { type: 'array', items: { type: 'object', additionalProperties: true } },
              npc_actions: { type: 'array', items: { type: 'object', additionalProperties: true } },
              character_memory_updates: { type: 'array', items: { type: 'object', additionalProperties: true } },
              edict_feedback: { type: 'array', items: { type: 'object', additionalProperties: true } },
              dialogue_commitment_feedback: { type: 'array', items: { type: 'object', additionalProperties: true } },
              court_resolution_feedback: { type: 'array', items: { type: 'object', additionalProperties: true } },
              fiscal_adjustments: { type: 'array', items: { type: 'object', additionalProperties: true } },
              currency_adjustments: { type: 'array', items: { type: 'object', additionalProperties: true } },
              population_adjustments: { type: 'array', items: { type: 'object', additionalProperties: true } },
              central_local_actions: { type: 'array', items: { type: 'object', additionalProperties: true } },
              environment_actions: { type: 'array', items: { type: 'object', additionalProperties: true } },
              institution_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
              personnel_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
              office_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
              faction_ai_outcomes: { type: 'array', items: { type: 'object', additionalProperties: true } },
              faction_relation_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
              faction_relation_shift: { type: 'array', items: { type: 'object', additionalProperties: true } },
              party_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
              army_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
              armory_procurement: { type: 'array', items: { type: 'object', additionalProperties: true } },
              province_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
              economic_advice: { type: 'string' },
              table_updates: { type: 'array', items: { type: 'object', additionalProperties: true } },
              suggestions: { type: 'array', items: { type: 'string' } }
            },
            required: ['turn_summary']
          }
        };
      }
      function _buildSc1bJsonSchema() {
        return {
          name: 'sc1b_letters',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: true,
            properties: {
              cultural_works: { type: 'array', items: { type: 'object', additionalProperties: true } },
              npc_letters: { type: 'array', items: { type: 'object', additionalProperties: true } },
              npc_correspondence: { type: 'array', items: { type: 'object', additionalProperties: true } },
              npc_interactions: { type: 'array', items: { type: 'object', additionalProperties: true } }
            },
            required: []
          }
        };
      }
      function _buildSc1cJsonSchema() {
        return {
          name: 'sc1c_factions',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: true,
            properties: {
              faction_events: { type: 'array', items: { type: 'object', additionalProperties: true } },
              faction_ai_outcomes: { type: 'array', items: { type: 'object', additionalProperties: true } },
              faction_interactions_advanced: { type: 'array', items: { type: 'object', additionalProperties: true } },
              faction_relation_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
              faction_succession: { type: 'array', items: { type: 'object', additionalProperties: true } },
              npc_schemes: { type: 'array', items: { type: 'object', additionalProperties: true } },
              hidden_moves: { type: 'array', items: { type: 'string' } },
              scheme_actions: { type: 'array', items: { type: 'object', additionalProperties: true } },
              fengwen_snippets: { type: 'array', items: { type: 'object', additionalProperties: true } }
            },
            required: []
          }
        };
      }
      function _buildSc1qJsonSchema() {
        return {
          name: 'sc1q_dialogue',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: true,
            properties: {
              dialogue_commitments: { type: 'array', items: { type: 'object', additionalProperties: true } },
              collective_resolutions: { type: 'array', items: { type: 'object', additionalProperties: true } },
              npc_dialogue_intent: { type: 'array', items: { type: 'object', additionalProperties: true } },
              required_sc1_actions: { type: 'array', items: { type: 'string' } }
            },
            required: []
          }
        };
      }
      // Phase 6 Q1-4·扩 11 个子调用 schema·sc1d/sc15/sc15n/sc16/sc17/sc18/sc2/sc25/sc25c/sc27/sc28
      function _buildGenericArrayObjectSchema(name, fieldNames) {
        var props = {};
        fieldNames.forEach(function(f) { props[f] = { type: 'array', items: { type: 'object', additionalProperties: true } }; });
        return { name: name, strict: true, schema: { type: 'object', additionalProperties: true, properties: props, required: [] } };
      }
      function _buildSc1dJsonSchema() {
        return { name: 'sc1d_record', strict: true, schema: { type: 'object', additionalProperties: true, properties: {
          shilu_text: { type: 'string' }, szj_title: { type: 'string' }, shizhengji: { type: 'string' }, szj_summary: { type: 'string' },
          basis_refs: { type: 'array', items: { type: 'object', additionalProperties: true } }
        }, required: [] } };
      }
      function _buildSc15JsonSchema() {
        return { name: 'sc15_npc_deep', strict: true, schema: { type: 'object', additionalProperties: true, properties: {
          hidden_moves: { type: 'array', items: { type: 'string' } },
          mood_shifts: { type: 'array', items: { type: 'object', additionalProperties: true } },
          relationship_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          faction_undercurrents: { type: 'array', items: { type: 'object', additionalProperties: true } },
          npc_schemes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          rumors: { type: 'string' }, contradiction_shift: { type: 'string' }
        }, required: [] } };
      }
      function _buildSc15nJsonSchema() {
        return { name: 'sc15n_3tier', strict: true, schema: { type: 'object', additionalProperties: true, properties: {
          mood_shifts: { type: 'array', items: { type: 'object', additionalProperties: true } },
          relationship_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          hidden_moves: { type: 'array', items: { type: 'string' } },
          faction_undercurrents: { type: 'array', items: { type: 'object', additionalProperties: true } },
          npc_schemes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          rumors: { type: 'string' },
          npc_cognition: { type: 'array', items: { type: 'object', additionalProperties: true } }
        }, required: [] } };
      }
      function _buildSc16JsonSchema() {
        return _buildGenericArrayObjectSchema('sc16_faction', ['faction_priorities', 'faction_actions', 'faction_directives', 'diplomatic_shifts']);
      }
      function _buildSc17JsonSchema() {
        return { name: 'sc17_fiscal', strict: true, schema: { type: 'object', additionalProperties: true, properties: {
          fiscal_analysis: { type: 'string' }, trade_dynamics: { type: 'string' }, inflation_pressure: { type: 'string' },
          resource_forecast: { type: 'string' }, economic_advice: { type: 'string' },
          supplementary_resource_changes: { type: 'object', additionalProperties: true }
        }, required: [] } };
      }
      function _buildSc18JsonSchema() {
        return { name: 'sc18_military', strict: true, schema: { type: 'object', additionalProperties: true, properties: {
          military_situation: { type: 'string' }, war_probability: { type: 'array', items: { type: 'object', additionalProperties: true } },
          supplementary_army_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          faction_military_actions: { type: 'array', items: { type: 'object', additionalProperties: true } },
          battleResult: { type: 'object', additionalProperties: true }, power_balance_shift: { type: 'string' }
        }, required: [] } };
      }
      function _buildSc2JsonSchema() {
        return { name: 'sc2_narrative', strict: true, schema: { type: 'object', additionalProperties: true, properties: {
          zhengwen: { type: 'string' }, houren_xishuo: { type: 'string' }
        }, required: [] } };
      }
      function _buildSc25JsonSchema() {
        return _buildGenericArrayObjectSchema('sc25_foreshadow', ['immediate_foreshadow', 'turn_memory', 'imperial_candidates']);
      }
      function _buildSc25cJsonSchema() {
        return { name: 'sc25c_synth', strict: true, schema: { type: 'object', additionalProperties: true, properties: {
          immediate_foreshadow: { type: 'array', items: { type: 'object', additionalProperties: true } },
          turn_memory: { type: 'array', items: { type: 'object', additionalProperties: true } },
          state_board: { type: 'object', additionalProperties: true },
          consolidated: { type: 'string' },
          key_threads: { type: 'array', items: { type: 'object', additionalProperties: true } },
          npc_trajectories: { type: 'array', items: { type: 'object', additionalProperties: true } },
          faction_vectors: { type: 'array', items: { type: 'object', additionalProperties: true } },
          unresolved_tensions: { type: 'array', items: { type: 'string' } },
          player_reputation_drift: { type: 'array', items: { type: 'object', additionalProperties: true } },
          next_turn_focus: { type: 'array', items: { type: 'string' } }
        }, required: [] } };
      }
      function _buildSc27JsonSchema() {
        return { name: 'sc27_review', strict: true, schema: { type: 'object', additionalProperties: true, properties: {
          anachronisms: { type: 'array', items: { type: 'string' } },
          name_errors: { type: 'array', items: { type: 'string' } },
          missing_beats: { type: 'array', items: { type: 'string' } },
          tone_guidance: { type: 'string' },
          rewritten_passages: { type: 'string' },
          added_details: { type: 'string' }
        }, required: [] } };
      }
      function _buildSc28JsonSchema() {
        return { name: 'sc28_world', strict: true, schema: { type: 'object', additionalProperties: true, properties: {
          world_snapshot: { type: 'string' }, next_turn_seeds: { type: 'string' }, tension_level: { type: 'string' }
        }, required: [] } };
      }
      // 选 response_format·strict (json_schema) 优先·失败 fallback json_object
      function _selectResponseFormat(modelFamily, schemaBuilder) {
        if (modelFamily !== 'openai') return null;
        var _useStrict = !!(P.ai && P.ai.openaiStrict === true);
        if (_useStrict && typeof schemaBuilder === 'function') {
          try { return { type: 'json_schema', json_schema: schemaBuilder() }; } catch(_) {}
        }
        return { type: 'json_object' };
      }

      function _maybeCacheSys(sysContent) {
        try {
          var _provider = (typeof _detectAIProvider === 'function') ? _detectAIProvider() : '';
          var _native = (P.ai && P.ai.url && /api\.anthropic\.com/i.test(P.ai.url));
          var _len = (typeof sysContent === 'string') ? sysContent.length : 0;
          // Phase 0 P2·双路缓存策略·
          //   Anthropic（含走中转的 Claude·_detectAIProvider 按 model 名也判 anthropic）·显式 cache_control: ephemeral 标记 (sys ≥1500 字)
          //   OpenAI 官方 (api.openai.com)·prefix caching 自动·≥1024 tokens (≈1500 字) 即触发·此处 no-op 让 SDK 自动命中
          //   2026-06-16·不再死卡 api.anthropic.com 原生域名——走中转的 Claude 一样吃缓存；
          //   个别代理不认 cache_control 会回 400 → _aiFetchWithRetryInner 脱字段重试并置 _aiCacheCtrlDisabled 本会话停用（自愈）。
          var _ccDisabled = (typeof _aiCacheCtrlDisabled !== 'undefined' && _aiCacheCtrlDisabled);
          var _useAnthropicCache = (_provider === 'anthropic' && _len > 1500 && !_ccDisabled);
          var _openaiNative = (P.ai && P.ai.url && /api\.openai\.com/i.test(P.ai.url));
          var _openaiAuto = (_provider === 'openai' && _openaiNative && _len > 1500);
          // diagnostic·让 Phase 7 cost panel 能区分 cache_provider
          if (GM && (_useAnthropicCache || _openaiAuto)) {
            GM._sysCacheMode = _useAnthropicCache ? 'anthropic-explicit' : 'openai-auto';
            GM._sysCacheLen = _len;
          } else if (GM) {
            GM._sysCacheMode = 'none';
          }
          if (_useAnthropicCache) {
            return [{ type: 'text', text: sysContent, cache_control: { type: 'ephemeral' } }];
          }
          // OpenAI / 其他·保持 string·SDK 走 prefix caching 自动路径
        } catch(_mcsE) {}
        return sysContent;
      }

      // 3.3: Sub-call执行包装器——统一计时/错误处理/重试 + AI调度统计
      // §6.5 R2·_aiDispatchStats 标准化结构·{totalCalls, successCount, totalTime, totalTokens, errors, byId, errorLog}
      if (!GM._aiDispatchStats) GM._aiDispatchStats = { totalCalls:0, successCount:0, totalTime:0, totalTokens:0, errors:0, byId:{}, errorLog:[] };
      if (!GM._aiDispatchStats.byId || typeof GM._aiDispatchStats.byId !== 'object') GM._aiDispatchStats.byId = {};
      if (!Array.isArray(GM._aiDispatchStats.errorLog)) GM._aiDispatchStats.errorLog = [];
      GM._aiDispatchStats.totalCalls = Number(GM._aiDispatchStats.totalCalls) || 0;
      GM._aiDispatchStats.successCount = Number(GM._aiDispatchStats.successCount) || 0;
      GM._aiDispatchStats.totalTime = Number(GM._aiDispatchStats.totalTime) || 0;
      GM._aiDispatchStats.totalTokens = Number(GM._aiDispatchStats.totalTokens) || 0;
      GM._aiDispatchStats.errors = Number(GM._aiDispatchStats.errors) || 0;
      async function _runSubcall(id, name, minDepth, fn) {
        var _depthOrder = {lite:0, standard:1, full:2};
        if (_depthOrder[_aiDepth] < _depthOrder[minDepth]) {
          _dbg('[' + id + '] 跳过(depth=' + _aiDepth + '<' + minDepth + ')');
          if (typeof setAIBranchDiagnostic === 'function') setAIBranchDiagnostic(id, 'skipped', 'depth=' + _aiDepth + '<' + minDepth);
          return;
        }
        var _start = Date.now();
        // 2026-06-07·深推渲染器崩溃诊断·每个子调用进出记 JS 堆水位。
        // 若渲染器在某子调用内 OOM 崩溃·崩溃日志会停在该 sc 的「▶进入」行而无「■退出」行 → 断尾直接指认元凶 sc·并能看堆是否逼近 jsHeapSizeLimit。
        try {
          if (typeof performance !== 'undefined' && performance.memory) {
            _dbg('[heap] ▶ ' + id + ' used=' + Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB / limit=' + Math.round(performance.memory.jsHeapSizeLimit / 1048576) + 'MB');
          }
        } catch(_heapEnterE) {}
        // Per-call fetch timeouts already bound retry cost. Keep wrapper retries explicit
        // so one slow optional pass cannot hold the whole end-turn flow for 10+ minutes.
        // Contract note: policy table now controls all wrapper retry counts.
        var _policy = ns.getCallPolicy(id);
        var _retries = (_policy && _policy.subcallRetries != null) ? _policy.subcallRetries : 1;
        var _stats = GM._aiDispatchStats;
        if (!_stats.byId[id]) _stats.byId[id] = { name:name, calls:0, totalTime:0, errors:0 };
        _stats.totalCalls++;
        _stats.byId[id].calls++;
        for (var _attempt = 0; _attempt <= _retries; _attempt++) {
          try {
            await fn();
            var _elapsed = Date.now() - _start;
            GM._subcallTimings[id] = _elapsed;
            _stats.totalTime += _elapsed;
            _stats.byId[id].totalTime += _elapsed;
            try {
              if (typeof performance !== 'undefined' && performance.memory) {
                _dbg('[heap] ■ ' + id + ' ' + _elapsed + 'ms used=' + Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB');
              }
            } catch(_heapExitE) {}
            try {
              if (window.TM && TM.Endturn && TM.Endturn.Timing && typeof TM.Endturn.Timing.mark === 'function') {
                TM.Endturn.Timing.mark(ctx, 'subcall', { id: id, label: name, ok: true, attempts: _attempt + 1, ms: _elapsed });
              }
            } catch(_timingOkErr) { try { console.warn('[EndturnTiming] mark ok failed:', _timingOkErr); } catch(_) {} }
            try {
              if (typeof setAIBranchDiagnostic === 'function') setAIBranchDiagnostic(id, 'ok', name + ' ' + _elapsed + 'ms');
            } catch(_diagOkErr) { try { console.warn('[AIDiagnostic] branch ok failed:', _diagOkErr); } catch(_) {} }
            return;
          } catch(_scErr) {
            var _errInfo = _formatAIError(_scErr);
            _dbg('[' + name + '] 第' + (_attempt+1) + '次执行失败:', _scErr.message);
            if (_attempt >= _retries) {
              var _elapsed = Date.now() - _start;
              GM._subcallTimings[id] = _elapsed;
              _stats.totalTime += _elapsed;
              _stats.byId[id].totalTime += _elapsed;
              _stats.errors++;
              _stats.byId[id].errors++;
              try {
                if (window.TM && TM.Endturn && TM.Endturn.Timing && typeof TM.Endturn.Timing.mark === 'function') {
                  TM.Endturn.Timing.mark(ctx, 'subcall', { id: id, label: name, ok: false, attempts: _attempt + 1, ms: _elapsed, error: _errInfo.message, status: _errInfo.status });
                }
              } catch(_timingFailErr) { try { console.warn('[EndturnTiming] mark fail failed:', _timingFailErr); } catch(_) {} }
              _stats.errorLog = Array.isArray(_stats.errorLog) ? _stats.errorLog : [];
              _stats.errorLog.push({ id:id, name:name, turn:GM.turn, msg:_errInfo.message, status:_errInfo.status, snippet:_errInfo.snippet, time:new Date().toLocaleTimeString() });
              if (_stats.errorLog.length > 20) _stats.errorLog.shift();
              try {
                if (typeof recordAIDiagnostic === 'function') {
                  recordAIDiagnostic('subcall_failed', {
                    id: id,
                    label: name,
                    error: _errInfo.message,
                    status: _errInfo.status,
                    snippet: _errInfo.snippet,
                    attempts: _retries + 1,
                    ms: _elapsed
                  });
                }
              } catch(_diagFailErr) { try { console.warn('[AIDiagnostic] subcall_failed failed:', _diagFailErr); } catch(_) {} }
              console.warn('[EndturnSubcall] failed after retries:', id, name, _errInfo.message, _errInfo.status || '');
              if (typeof toast === 'function') {
                var _brief = _errInfo.status ? ('HTTP ' + _errInfo.status + ' ' + _errInfo.message) : _errInfo.message;
                toast('\u26A0 ' + name + '失败：' + String(_brief || '').slice(0, 80) + '；本回合会继续，详见AI诊断');
              }
              console.warn('[' + name + '] 重试' + _retries + '次后仍失败');
              try {
                if (typeof setAIBranchDiagnostic === 'function') setAIBranchDiagnostic(id, 'failed', _errInfo.message);
              } catch(_branchFailErr) { try { console.warn('[AIDiagnostic] branch failed failed:', _branchFailErr); } catch(_) {} }
            }
          }
        }
      }

      async function _runSubcallBatch(label, tasks, limit) {
        if (!Array.isArray(tasks) || tasks.length === 0) return;
        var _confLimit = parseInt(P.conf && P.conf.aiSubcallConcurrency, 10);
        // 2026-06-11·安卓过回合闪退护栏。安卓 WebView 内存天花板远低于桌面 Electron;
        // 第三方中转(无 CORS)的 AI 调用必走 CapacitorHttp 原生路·整段响应在原生侧完整 materialize 再跨桥拷贝进 JS,
        // 多个子调用并发 = 多份数 MB 响应同时压在小堆上 → 渲染进程 OOM·App 闪退(玩家报「几乎每回合都崩·仅第三方中转」)。
        // 默认在安卓串行(并发 1)·峰值≈÷并发数;玩家显式设 P.conf.aiSubcallConcurrency 则尊重其选择(可自行调高)。
        var _isCap = (function(){ try { if (window.TM && TM.platform && TM.platform.kind) return TM.platform.kind === 'capacitor'; return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch(_) { return false; } })();
        var _limit = _confLimit > 0 ? _confLimit : (_isCap ? 1 : (limit || 3));
        _limit = Math.max(1, Math.min(_limit, tasks.length));
        var _cursor = 0;
        var _started = Date.now();
        async function _worker() {
          while (_cursor < tasks.length) {
            var _idx = _cursor++;
            var _task = tasks[_idx];
            if (typeof _task === 'function') await _task();
          }
        }
        var _workers = [];
        for (var _i = 0; _i < _limit; _i++) _workers.push(_worker());
        await Promise.all(_workers);
        _dbg('[SubcallBatch] ' + label + ' finished ' + tasks.length + ' tasks in ' + ((Date.now() - _started) / 1000).toFixed(1) + 's, concurrency=' + _limit);
      }

      function _buildSc1EmergencyFallback(reason) {
        var _turn = (GM && GM.turn) || 1;
        var _dateText = ''; try { _dateText = (typeof getTSText === 'function') ? getTSText(_turn) : ''; } catch(_) {}
        var _why = reason && (reason.message || String(reason)) || 'SC1 returned no usable structured JSON';
        var _brief = (_dateText ? (_dateText + '，') : '') + '朝廷诸务照常，所颁诏令俱已分发有司奉行，一时未有大变上闻，余事俟后报。';
        var _p = { shizhengji:_brief, zhengwen:_brief, shilu_text:_brief, szj_title:'时移事去', szj_summary:'主推演结构化结果暂缺，系统采用保守降级账本。', turn_summary:'SC1 emergency fallback: no synthetic gameplay deltas applied.', player_status:'朝局暂按既有状态延续。', player_inner:'', events:[{ type:'AI降级', title:'主推演结构化结果暂缺', text:_brief, turn:_turn }], _g2Fallback:true, _emergencyFallback:true, _fallbackReason:String(_why).slice(0, 200) };
        ['changes','resource_changes','variable_changes','char_updates','character_deaths','npc_actions','npc_interactions','npc_letters','npc_correspondence','cultural_works','faction_changes','faction_events','faction_ai_outcomes','faction_relation_changes','faction_interactions','fiscal_adjustments','currency_adjustments','population_adjustments','central_local_actions','environment_actions','institution_changes','office_assignments','office_dismissals','personnel_changes','army_changes','province_changes','table_updates','suggestions'].forEach(function(k){ _p[k] = []; });
        try {
          if (!GM._turnAiResults) GM._turnAiResults = {};
          if (!Array.isArray(GM._turnAiResults._fallbacks)) GM._turnAiResults._fallbacks = [];
          GM._turnAiResults._fallbacks.push({ id:'sc1', type:'emergency', reason:_p._fallbackReason, turn:_turn, at:Date.now() });
          if (GM._turnAiResults._fallbacks.length > 20) GM._turnAiResults._fallbacks.shift();
        } catch(_) {}
        return _p;
      }

      function _hasSc1StructuredResult(obj) {
        // Phase 1 C-2 + 2026-06 hardcore fix: require >=3 fields AND at least one "heavy" field
        // (one carrying real entity references / deltas), so a partial JSON of only shallow text
        // summaries (turn_summary / player_status) can no longer masquerade as a usable result.
        if (!obj || typeof obj !== 'object') return false;
        var heavyKeys = ['events','resource_changes','variable_changes','char_updates','fiscal_adjustments','changes','personnel_changes','office_assignments','office_dismissals','army_changes','province_changes'];
        var lightKeys = ['edict_feedback','table_updates','turn_summary','shizhengji_basis','player_status','playerStatus'];
        function _nonEmpty(v) {
          if (Array.isArray(v)) return v.length > 0;
          if (v && typeof v === 'object') return Object.keys(v).length > 0;
          return typeof v === 'string' && v.trim().length > 0;
        }
        var _heavy = 0, _hit = 0, i;
        for (i = 0; i < heavyKeys.length; i++) { if (_nonEmpty(obj[heavyKeys[i]])) { _heavy++; _hit++; } }
        for (i = 0; i < lightKeys.length; i++) { if (_nonEmpty(obj[lightKeys[i]])) { _hit++; } }
        // heavy field present -> 3 total is enough; pure shallow text -> demand 4 to reject thin partials
        return (_heavy >= 1 && _hit >= 3) || (_hit >= 4);
      }

      // Phase 7 Q4·SC1 增量 retry·只重生成缺失字段·只 retry 一次
      function _findMissingSc1Fields(p1) {
        if (!p1 || typeof p1 !== 'object') return ['turn_summary', 'shizhengji_basis', 'events', 'char_updates'];
        var coreFields = ['turn_summary', 'shizhengji_basis', 'shilu_text', 'shizhengji', 'player_status'];
        var arrFields = ['events', 'char_updates', 'edict_feedback', 'fiscal_adjustments', 'personnel_changes'];
        var missing = [];
        coreFields.forEach(function(k) {
          var v = p1[k];
          if (!v || (typeof v === 'string' && !v.trim())) missing.push(k);
        });
        arrFields.forEach(function(k) {
          var v = p1[k];
          if (!Array.isArray(v)) missing.push(k);
        });
        return missing;
      }
      // Phase 0 D-3 (doc 字面)·SC1 重试用 simpler schema·与增量 retry 互补
      // 调用时机·SC1 第一次完全失败·走 _trySc1Rescue 之前
      // 区别·_trySc1Rescue 走 sc1_rescue subcall 用极简硬编码 schema·此函数 retry SC1 主调用但用 core tier
      async function _trySc1RetryWithSimplerSchema(reason) {
        if (GM && GM._turnAiResults && GM._turnAiResults._sc1SimpleRetried) return null;
        if (GM && GM._turnAiResults) GM._turnAiResults._sc1SimpleRetried = true;
        try {
          var tier = _buildSc1Schema('core');  // Phase 2 A1·core tier
          _dbg('[SC1 D-3] retry with simpler core schema·' + tier.fields.length + ' fields');
          if (typeof recordSubcallError === 'function') recordSubcallError('sc1', 'simpler_schema_retry', new Error('retry with core schema'));
          // 重用 _trySc1Rescue·它内部用极简 schema (字段集是 core 的超集)·达到 D-3 效果
          var rescue = await _trySc1Rescue(reason);
          return rescue;
        } catch(_d3Err) { _dbg('[SC1 D-3] simpler schema retry fail:', _d3Err); return null; }
      }
      async function _runIncrementalSc1Retry(p1, missingFields) {
        // Phase 7 Q4·应对 R-B 误判循环·只在 missing >3 才 retry·一次性
        if (!Array.isArray(missingFields) || missingFields.length <= 3) {
          _dbg('[SC1 Inc Retry] missing<=3·skip retry·count=' + (missingFields||[]).length);
          return null;
        }
        if (GM && GM._turnAiResults && GM._turnAiResults._sc1IncrementalRetried) {
          _dbg('[SC1 Inc Retry] already retried this turn·skip');
          return null;
        }
        if (GM && GM._turnAiResults) GM._turnAiResults._sc1IncrementalRetried = true;
        try {
          _dbg('[SC1 Inc Retry] retry for ' + missingFields.length + ' missing fields');
          var _knownContext = '';
          try { _knownContext = JSON.stringify({ turn_summary: p1.turn_summary, shizhengji_basis: p1.shizhengji_basis, events: (p1.events||[]).slice(0,4) }).slice(0, 1500); } catch(_) {}
          var prompt = '【SC1 增量 retry·补齐缺失字段】\n'
            + '上次推演只返回部分字段·缺少·' + missingFields.join(', ') + '\n'
            + '已有上下文 (R-A·应对语义矛盾·不要与此冲突)·' + _knownContext + '\n'
            + '请只返回 JSON·只含 缺失字段·**与上文逻辑一致**·不可重写已有字段。'
            + '\nJSON 结构·{' + missingFields.map(function(k){ return '"' + k + '":' + (k === 'events' || /changes$|feedback$|adjustments$/.test(k) ? '[]' : '""'); }).join(',') + '}';
          var body = { model: P.ai.model || 'gpt-4o', messages: [{role:'system',content:'Return strict JSON·only missing fields·conservative.'},{role:'user',content:prompt}], temperature: 0.25, max_tokens: _tok(2500) };
          if (_modelFamily === 'openai') body.response_format = { type: 'json_object' };
          var call = await _callEndturnAI(body, { id: 'sc1_inc_retry', label: 'SC1 增量补齐', expectedKeys: missingFields.slice(0, 3), priority: 'critical', timeoutMs: 45000, maxRetries: 0, repairTimeoutMs: 20000 });
          var parsed = (call && call.parse) ? call.parse.parsed : null;
          if (parsed && typeof parsed === 'object') {
            missingFields.forEach(function(k) {
              if (parsed[k] != null) p1[k] = parsed[k];
            });
            p1._sc1IncrementalFilled = missingFields;
            _dbg('[SC1 Inc Retry] filled ' + missingFields.length + ' fields');
            return p1;
          }
        } catch(_incErr) { _dbg('[SC1 Inc Retry] fail:', _incErr); }
        return null;
      }
      async function _trySc1Rescue(reason) {
        var started = Date.now(), ok = false;
        function _clip(v, n) { var s = ''; try { s = typeof v === 'string' ? v : JSON.stringify(v || null); } catch(_) { s = String(v || ''); } return s.slice(0, n || 1200); }
        try {
          var turn = (GM && GM.turn) || 1;
          var dateText = ''; try { dateText = (typeof getTSText === 'function') ? getTSText(turn) : ''; } catch(_) {}
          var vars = ''; try { vars = Object.keys(GM.vars || {}).slice(0, 16).map(function(k){ var v = GM.vars[k]; return k + '=' + (v && typeof v === 'object' ? v.value : v); }).join('；'); } catch(_) {}
          var prompt = '【SC1结构化救援】主结构化调用失败或格式不可用。你只做最低限度结构化账本，不写长文。Return ONLY strict JSON.\n'
            + '本回合:T' + turn + (dateText ? '·' + dateText : '') + '\n'
            + '当前七变/资源:' + vars + '\n'
            + '玩家诏令/奏疏/操作:' + _clip(edicts, 2600) + '\n'
            + '玩家行止:' + _clip(xinglu, 1200) + '\n'
            + '局势分析:' + _clip(aiThinking, 1000) + '\n'
            + '记忆回顾:' + _clip(memoryReview, 1000) + '\n'
            + '失败原因:' + _clip(reason && (reason.message || reason), 500) + '\n'
            + '规则: 不确定就留空；不得编造死亡、大战、巨额资源变化；每个实际数值变化必须写reason；所有数组可为空。\n'
            + 'JSON字段: {"turn_summary":"","shizhengji_basis":"","events":[],"edict_feedback":[],"resource_changes":{},"char_updates":[],"fiscal_adjustments":[],"changes":[],"player_status":"","player_inner":""}';
          var body = { model:P.ai.model || 'gpt-4o', messages:[{role:'system', content:'Return strict JSON only. You are a conservative structured ledger rescue pass.'},{role:'user', content:prompt}], temperature:0.25, max_tokens:_tok(Math.min(_effectiveOutCap || 3500, 3500)) };
          if (_modelFamily === 'openai') body.response_format = { type:'json_object' };
          var call = await _callEndturnAI(body, { id:'sc1_rescue', label:'结构化数据救援', expectedKeys:['turn_summary','shizhengji_basis','events','resource_changes','char_updates','edict_feedback','fiscal_adjustments','changes'], priority:'critical', timeoutMs:60000, maxRetries:0, repairTimeoutMs:30000, repairMaxRetries:0, repairTokens:3000 });
          var parsed = (call && call.parse) ? call.parse.parsed : call && call.parsed;
          if (!parsed || !_hasSc1StructuredResult(parsed)) throw new Error('SC1 rescue returned no usable structured data');
          parsed._sc1Rescue = true;
          parsed._fallbackReason = String(reason && (reason.message || reason) || 'sc1 failed').slice(0, 200);
          if (!GM._turnAiResults) GM._turnAiResults = {};
          GM._turnAiResults.subcall1_rescue_raw = call.raw || '';
          GM._turnAiResults.subcall1_rescue = parsed;
          ok = true;
          return { parsed:parsed, raw:call.raw || JSON.stringify(parsed), data:call.data };
        } catch(e) {
          try {
            if (!GM._turnAiResults) GM._turnAiResults = {};
            if (!Array.isArray(GM._turnAiResults._fallbacks)) GM._turnAiResults._fallbacks = [];
            GM._turnAiResults._fallbacks.push({ id:'sc1_rescue', type:'rescue_failed', reason:String(e && (e.message || e) || '').slice(0, 200), turn:(GM && GM.turn) || 1, at:Date.now() });
          } catch(_) {}
          console.warn('[SC1 rescue] failed:', e && (e.message || e));
          return null;
        } finally {
          var ms = Date.now() - started;
          GM._subcallTimings.sc1_rescue = ms;
          try { if (window.TM && TM.Endturn && TM.Endturn.Timing && typeof TM.Endturn.Timing.mark === 'function') TM.Endturn.Timing.mark(ctx, 'subcall', { id:'sc1_rescue', label:'结构化数据救援', ok:ok, attempts:1, ms:ms }); } catch(_) {}
        }
      }

      function _seedRecordFromP1ForApplyFailure(targetCtx, src) {
        if (!targetCtx || !src || typeof src !== 'object') return;
        targetCtx.record = targetCtx.record || {};
        targetCtx.record.shizhengji = targetCtx.record.shizhengji || src.shizhengji || src.shizhengji_basis || src.turn_summary || '';
        targetCtx.record.zhengwen = targetCtx.record.zhengwen || src.zhengwen || src.shizhengji || src.shizhengji_basis || '';
        targetCtx.record.turnSummary = targetCtx.record.turnSummary || src.turn_summary || src.shizhengji_basis || '';
        targetCtx.record.shiluText = targetCtx.record.shiluText || src.shilu_text || '';
        targetCtx.record.szjTitle = targetCtx.record.szjTitle || src.szj_title || '';
        targetCtx.record.szjSummary = targetCtx.record.szjSummary || src.szj_summary || '';
        targetCtx.record.playerStatus = targetCtx.record.playerStatus || src.player_status || src.playerStatus || '';
        targetCtx.record.playerInner = targetCtx.record.playerInner || src.player_inner || src.playerInner || '';
      }

      function _attachSc1RecordFallback(base, reason) {
        if (!base || typeof base !== 'object') return base;
        var _turn = (GM && GM.turn) || 1;
        var _dateText = ''; try { _dateText = (typeof getTSText === 'function') ? getTSText(_turn) : ''; } catch(_) {}
        function _txt(v) {
          if (v == null) return '';
          if (typeof v === 'string') return v;
          try { return JSON.stringify(v); } catch(_) { return String(v); }
        }
        function _takeList(arr, n) {
          return (Array.isArray(arr) ? arr : []).slice(0, n || 5).map(function(x) {
            if (typeof x === 'string') return x;
            return _txt(x && (x.title || x.summary || x.text || x.reason || x.action || x.type || x.name) || x);
          }).filter(Boolean);
        }
        var facts = [];
        if (base.turn_summary) facts.push(_txt(base.turn_summary));
        if (base.shizhengji_basis) facts.push(_txt(base.shizhengji_basis));
        facts = facts.concat(_takeList(base.edict_feedback, 5), _takeList(base.events, 5), _takeList(base.fiscal_adjustments, 4), _takeList(base.personnel_changes, 4), _takeList(base.army_changes, 4), _takeList(base.province_changes, 4));
        var brief = facts.join('；').replace(/\s+/g, ' ').slice(0, 900);
        if (!brief) brief = '本回合结构化账本已生成，但史官成文子调用未返回可用正文，系统暂以保守摘要占位。';
        if (!base.shilu_text) base.shilu_text = (_dateText ? (_dateText + '，') : '') + '是回，' + brief;
        if (!base.szj_title) base.szj_title = '事归案牍，政入时编';
        if (!base.shizhengji) base.shizhengji = brief;
        if (!base.szj_summary) base.szj_summary = brief.slice(0, 140);
        if (!base.zhengwen) base.zhengwen = base.shizhengji;
        base._sc1dFallback = true;
        base._sc1dFallbackReason = String(reason && (reason.message || reason) || 'sc1d missing').slice(0, 200);
        try {
          if (!GM._turnAiResults) GM._turnAiResults = {};
          if (!Array.isArray(GM._turnAiResults._fallbacks)) GM._turnAiResults._fallbacks = [];
          GM._turnAiResults._fallbacks.push({ id:'sc1d', type:'record_fallback', reason:base._sc1dFallbackReason, turn:_turn, at:Date.now() });
          if (GM._turnAiResults._fallbacks.length > 20) GM._turnAiResults._fallbacks.shift();
        } catch(_) {}
        return base;
      }

      var _queuedPostTurnSubcalls = [];
      function _queuePostTurnSubcall(id, fn) {
        _queuedPostTurnSubcalls.push({ id: id, fn: fn });
      }
      function _flushQueuedPostTurnSubcalls() {
        if (!_queuedPostTurnSubcalls.length) return;
        var _q = _queuedPostTurnSubcalls.slice();
        _queuedPostTurnSubcalls.length = 0;
        _q.forEach(function(job) {
          if (typeof _enqueuePostTurnJob === 'function') return _enqueuePostTurnJob(job.id, job.fn);
          _enqueueLocalPostTurnJob(job.id, job.fn);
        });
      }
      function _enqueueLocalPostTurnJob(id, fn) {
        if (!GM._postTurnJobs || !Array.isArray(GM._postTurnJobs.pending)) GM._postTurnJobs = { pending: [], launchedAt: Date.now(), results: {} };
        var p = Promise.resolve().then(fn).catch(function(e){ _dbg('[PostTurn]' + id + ' failed:', e); });
        GM._postTurnJobs.pending.push({ id: id, promise: p });
        return p;
      }
      async function _awaitQueuedPostTurnSubcallsById(ids) {
        if (!Array.isArray(ids) || ids.length === 0) return;
        if (typeof _awaitPostTurnJobsById === 'function') {
          await _awaitPostTurnJobsById(ids);
          return;
        }
        if (!GM || !GM._postTurnJobs || !Array.isArray(GM._postTurnJobs.pending)) return;
        var waiting = GM._postTurnJobs.pending.filter(function(job) {
          return job && ids.indexOf(job.id) >= 0 && job.promise;
        });
        if (waiting.length) await Promise.all(waiting.map(function(job) { return job.promise; }));
      }

      // --- 预处理：等待上回合 post-turn 任务 + 同步本地记忆保鲜 ---
      try {
        if (typeof _awaitPostTurnJobs === 'function') await _awaitPostTurnJobs();
        if (typeof _ensureMemoryFreshness === 'function') _ensureMemoryFreshness(GM);
        if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('turn_start', { stage: 'after_post_turn_jobs', snapshot: (typeof buildMemoryDiagnosticSnapshot === 'function' ? buildMemoryDiagnosticSnapshot(GM) : null) });
      } catch(_emfE) { _dbg('[MemoryFresh] 预处理失败:', _emfE); }

      // ═══════════════════════════════════════════════════════════
      // §3 Sub-calls sc0/sc05/sc1/sc1b/sc1c（深度思考·记忆·主推演·文事·势力）
      // ═══════════════════════════════════════════════════════════

      // Phase 4 F·SC15→SC_MEMWRITE 同步链拆开·下回合 sc1 prep 等 sc_memwrite 完成
      // 旧·sc_memwrite 写完后 sc1 才知道 NPC 最新记忆·若 sc_memwrite 还在 post-turn 队列没完·sc1 读旧记忆
      // 新·sc1 入口先 await sc_memwrite·确保 NPC 记忆已写入·sc1 prompt 注入有最新记忆
      try {
        if (typeof _awaitPostTurnJobsById === 'function') {
          await _awaitPostTurnJobsById(['sc_memwrite']);
          _dbg('[Phase 4 F] sc1 prep·await sc_memwrite 完成·NPC 记忆已最新');
        }
      } catch(_mwAwaitE) { _dbg('[Phase 4 F] await sc_memwrite fail (continue):', _mwAwaitE); }

      // --- Sub-call 0 + 1q: 并行 (Phase 2.5)·sc0 局势分析·sc1q 对话承诺推演·max 8s wall-clock ---
      var _sc0P = _runSubcall('sc0', 'AI深度思考', 'standard', async function() {
      showLoading("AI\u6DF1\u5EA6\u601D\u8003",42);
      var tp0 = tp + '\n\u8BF7\u6781\u5176\u6DF1\u5165\u5730\u5206\u6790\u5F53\u524D\u5C40\u52BF\uFF0C\u8FD4\u56DEJSON\uFF1A\n' +
        '{"tensions":"\u5F53\u524D5\u4E2A\u6700\u5927\u77DB\u76FE/\u5371\u673A\u53CA\u5176\u4E25\u91CD\u7A0B\u5EA6(150\u5B57)","consequences":"\u73A9\u5BB6\u672C\u56DE\u5408\u6BCF\u4E2A\u884C\u52A8\u7684\u8BE6\u7EC6\u540E\u679C\u5206\u6790(150\u5B57)","npc_spotlight":"\u672C\u56DE\u5408\u6700\u53EF\u80FD\u6709\u52A8\u4F5C\u76845\u4E2ANPC\u53CA\u5176\u52A8\u673A\u548C\u884C\u52A8\u65B9\u5F0F(200\u5B57)","faction_dynamics":"\u975E\u73A9\u5BB6\u52BF\u529B\u672C\u56DE\u5408\u7684\u81EA\u4E3B\u884C\u52A8\u8BE6\u7EC6\u63A8\u6F14(200\u5B57)","family_dynamics":"\u5BB6\u65CF/\u540E\u5BAB/\u5A5A\u59FB\u5C42\u9762\u7684\u6F5C\u5728\u53D8\u5316(100\u5B57)","class_unrest":"\u5404\u9636\u5C42\u7684\u4E0D\u6EE1\u60C5\u7EEA\u548C\u53EF\u80FD\u7684\u6C11\u53D8(100\u5B57)","economic_pressure":"\u8D22\u653F\u538B\u529B\u548C\u7ECF\u6D4E\u8D70\u5411(80\u5B57)","foreshadow":"\u5E94\u57CB\u4E0B\u76843\u4E2A\u4F0F\u7B14\u53CA\u5176\u5C06\u5728\u4F55\u65F6\u5F15\u7206(100\u5B57)","mood":"\u672C\u56DE\u5408\u53D9\u4E8B\u5E94\u8425\u9020\u7684\u60C5\u611F\u57FA\u8C03(50\u5B57)","memoryQueries":[{"keywords":["关键词1","关键词2"],"turnRange":[起始回合,结束回合],"participant":"相关人物名(可空)","minImportance":5,"purpose":"为何要检索"}]}\n' +
        '\u8FD9\u662F\u4F60\u7684\u6DF1\u5EA6\u601D\u8003\u8FC7\u7A0B\uFF0C\u4E0D\u663E\u793A\u7ED9\u73A9\u5BB6\u3002\u8BF7\u5145\u5206\u601D\u8003\uFF0C\u4E0D\u8981\u5401\u60DC\u5B57\u6570\u3002\n' +
        '【memoryQueries】如需要回忆更早的具体事件·在此列出 1-4 条检索查询·系统将从四源永久档案中检索并注入后续推演·否则留空数组。\n' +
        '  · 四个检索源：(1) NPC 个人记忆 (2) 长期事势(ChronicleTracker) (3) 史记本传(shijiHistory) (4) 已埋伏笔(_foreshadows)\n' +
        '  · 适合查询的场景：「此人是否真在那回合背叛过」「某改革当年具体推进到哪里」「玩家曾埋下何种伏笔」「某事件距今多少回合」\n' +
        '  · keywords 用具体名词(角色名/事件关键词/政策名)·turnRange 可选(若不填则全档案)·participant 仅 NPC 记忆源使用·minImportance 仅 NPC 记忆源使用';
      // ①-S1 非常规举措识别（开关 P.conf.anomalyRoutingEnabled·默认关·关=sc0 prompt 逐字节等同现状）
      if ((typeof agentFlagOn==='function' ? agentFlagOn('anomalyRoutingEnabled') : (P.conf && P.conf.anomalyRoutingEnabled))) {
        tp0 += '\n【额外·非常规举措识别】在上述 JSON 中再补一个字段 "anomaly":{"detected":true/false,"moves":[{"what":"玩家本回合越出常规/罕见/可能引发非常规连锁的举措(如复活失传制度·罕见手段·越界操作)","why_uncommon":"为何罕见或越界","needs":"需深查的历史先例关键词·或需特别考量的连锁"}]}。仅当玩家确有非常规举措时 detected=true(moves 最多 3 项)·常规回合留 detected=false、moves=[]。';
      }
      // 【自我反思 agent·S2】sc0 预测阶段注入滚动偏差画像→让 AI 在预测时就校正自己的系统性盲点(agent 核心价值·而非 sc1 事后)。默认关=空串·逐字节零回归。
      try { if ((typeof agentFlagOn==='function' ? agentFlagOn('reflectionAgentEnabled') : (P.ai && P.ai.reflectionAgentEnabled)) && window.TM && window.TM.ReflectionAgent) { var _biasInj = window.TM.ReflectionAgent.formatBiasForSc0(GM); if (_biasInj) tp0 += _biasInj; } } catch(_biasE){}
      var _sc0Body = {model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysPFor('sc0'))},{role:"user",content:tp0}], temperature:0.6, max_tokens:_tok(12000)};
      if (_modelFamily === 'openai') _sc0Body.response_format = { type: 'json_object' };
      var _sc0Call = await _callEndturnAI(_sc0Body, { id: 'sc0', label: '局势分析', priority: 'normal' });
      {
        var data0 = _sc0Call.data;
        _checkTruncated(data0, '局势分析');
        if (_sc0Call.raw) {
          aiThinking = _sc0Call.raw;
          var _sc0Parsed = await _parseOrRepairJsonResult(aiThinking, data0, '局势分析', { url: url, key: P.ai.key, body: _sc0Body, expectedKeys: ['tensions', 'consequences', 'memoryQueries'], priority: 'normal' });
          if (_sc0Parsed && _sc0Parsed.repaired) aiThinking = _sc0Parsed.raw;
          GM._turnAiResults.thinking = aiThinking;
          // ①-S1 读 anomaly 信号·存 GM._turnAiResults.anomaly 供后续响应（开关控制·S2 消费）
          if ((typeof agentFlagOn==='function' ? agentFlagOn('anomalyRoutingEnabled') : (P.conf && P.conf.anomalyRoutingEnabled))) {
            try {
              var _think0 = extractJSON(aiThinking);
              var _anom = _think0 && _think0.anomaly;
              if (_anom && _anom.detected && Array.isArray(_anom.moves) && _anom.moves.length) {
                GM._turnAiResults.anomaly = { detected: true, moves: _anom.moves.slice(0, 3), turn: GM.turn || 0 };
                _dbg('[anomaly] 非常规举措 ' + _anom.moves.length + ' 项·' + _anom.moves.map(function(m){ return (m && m.what) || ''; }).join('; ').slice(0, 120));
              } else {
                GM._turnAiResults.anomaly = { detected: false, moves: [] };
              }
            } catch (_anomE) { GM._turnAiResults.anomaly = { detected: false, moves: [] }; }
          }
          _dbg('[AI Think]', aiThinking.substring(0, 200));
        }
      }
      }); // end Sub-call 0 _runSubcall (Promise·未 await·并行)

      // --- Sub-call 1q: 对话承诺推演 (Phase 2.5·新增·并行 sc0)·6 GM 字段 7 渠道 ---
      var _sc1qP = _runSubcall('sc1q', '对话承诺推演', 'lite', async function() {
        try {
          var _curTurn = GM.turn || 1;
          var _recallTurns = (P.conf && P.conf.dialogueRecallTurns) || 3;
          // 6 输入字段·按 doc §2.5.1 真实字段名 (Round 2 已 grep 核实)
          var _jishi = Array.isArray(GM.jishiRecords) ? GM.jishiRecords.filter(function(r){ return r && r.turn >= _curTurn - _recallTurns; }).slice(-50) : [];
          var _court = Array.isArray(GM._courtRecords) ? GM._courtRecords.filter(function(r){ return r && r.turn >= _curTurn - 1; }).slice(-3) : [];
          var _secret = Array.isArray(GM._secretMeetings) ? GM._secretMeetings.filter(function(m){ return m && m.turn === _curTurn; }).slice(-5) : [];
          // _npcCommitments 是 dict {npcName: [commit,...]}·flatten
          var _flatCommits = [];
          if (GM._npcCommitments && typeof GM._npcCommitments === 'object') {
            Object.keys(GM._npcCommitments).forEach(function(npcName) {
              var arr = GM._npcCommitments[npcName];
              if (!Array.isArray(arr)) return;
              arr.filter(function(c){ return c && (c.status === 'pending' || c.status === 'executing' || c.status === 'delayed'); }).slice(0, 5).forEach(function(c) {
                _flatCommits.push({ npc: npcName, task: c.task, assignedTurn: c.assignedTurn, deadline: c.deadline, status: c.status, progress: c.progress, willingness: c.willingness });
              });
            });
          }
          _flatCommits = _flatCommits.slice(0, 30);
          // 鸿雁出 (玩家发出私信·本回合)
          var _outLetters = Array.isArray(GM.letters) ? GM.letters.filter(function(l){ return l && l.from === '玩家' && l.sentTurn === _curTurn; }).slice(0, 10) : [];
          // 奏疏朱批中的命令
          var _approvedReplies = Array.isArray(GM._approvedMemorials) ? GM._approvedMemorials.filter(function(m){ return m && m.turn === _curTurn && m.reply && String(m.reply).length > 3; }).slice(0, 10) : [];

          // skip 条件·6 输入全空·sc1q 无素材·避免空调用浪费
          if (_jishi.length === 0 && _court.length === 0 && _secret.length === 0 && _flatCommits.length === 0 && _outLetters.length === 0 && _approvedReplies.length === 0) {
            _dbg('[sc1q] skip·all 6 inputs empty');
            ctx.results = ctx.results || {};
            ctx.results.sc1q = { dialogue_commitments: [], collective_resolutions: [], npc_dialogue_intent: [], required_sc1_actions: [], _skipped: 'no_input' };
            return;
          }

          // 【sc1q 升级·Q3】给 sc1q 喂涉事 NPC 的认知快照(sc07 _npcCognition·所求/朝局判断/恩怨)·让 mood/subtext/willingness 有据·非纯凭答话语气猜。
          var _q3Cue = '';
          try {
            if (typeof getNpcCognitionSnippet === 'function') {
              var _q3Names = {};
              _jishi.forEach(function(r){ if (r && r.char) _q3Names[r.char] = 1; });
              _flatCommits.forEach(function(c){ if (c && c.npc) _q3Names[c.npc] = 1; });
              Object.keys(_q3Names).slice(0, 10).forEach(function(nm){
                var s = ''; try { s = getNpcCognitionSnippet(nm) || ''; } catch(_) {}
                if (s) _q3Cue += '· ' + nm + '：' + String(s).replace(/\s+/g, ' ').slice(0, 180) + '\n';
              });
            }
          } catch(_q3E) {}
          function _packQ(v, max) { try { return JSON.stringify(v||null).slice(0, max||1500); } catch(_) { return ''; } }
          var tp1q = '【对话承诺推演·sc1q】\n本回合 T' + _curTurn + '·从 7 渠道 (问对/朝议/常朝/廷议/御前/鸿雁/朱批) 提取对话型决策·让 SC1 主推演视它们为"和诏书等同的输入"。\n\n'
            + '【输入 1·问对/常朝/御前公开 (jishiRecords·近 ' + _recallTurns + ' 回合)】' + _packQ(_jishi.map(function(r){return {t:r.turn, char:r.char, mode:r.mode, said:String(r.playerSaid||'').slice(0,200), npcSaid:String(r.npcSaid||'').slice(0,200), loyDelta:r.loyaltyDelta};}), 4000) + '\n\n'
            + '【输入 2·朝议+常朝+廷议 决议 (_courtRecords·近 2 回合)】' + _packQ(_court.map(function(r){return {t:r.turn, topic:r.topic, decisions:r.decisions, adopted:r.adopted};}), 2500) + '\n\n'
            + '【输入 3·御前密议 (_secretMeetings·本回合)】' + _packQ(_secret.map(function(m){return {t:m.turn, topic:m.topic, advisors:m.advisors, decision:m.decision};}), 1500) + '\n\n'
            + '【输入 4·跨回合未完承诺 (_npcCommitments)】' + _packQ(_flatCommits, 2500) + '\n\n'
            + '【输入 5·玩家发出私信 (letters from=玩家·本回合)】' + _packQ(_outLetters.map(function(l){return {to:l.to, content:String(l.content||'').slice(0,200)};}), 2000) + '\n\n'
            + '【输入 6·奏疏朱批 (approvedMemorials·本回合·reply 含具体命令)】' + _packQ(_approvedReplies.map(function(m){return {from:m.from, summary:m.summary, reply:String(m.reply||'').slice(0,200)};}), 2000) + '\n\n'
            + (_q3Cue ? '【涉事 NPC 认知底细 (sc07·据此推断 mood/willingness/subtext·勿凭空臆测语气)】\n' + _q3Cue + '\n' : '')
            + '【输出严格 JSON·只包含 4 字段】\n'
            + '{\n'
            + '  "dialogue_commitments":[{"npc":"承诺NPC名","task":"具体动作 (40字内·必须有动词+对象·禁泛泛表态)","category":"query/finance/intel/dispatch/diplomacy/write/other 之一 (查办肃贪=query·财赋征税=finance·侦查密探=intel·出兵调度=dispatch·外交邦交=diplomacy·撰拟文书=write·其余=other·据 task 性质定·决定履成后的结构化后果)","deadline":"3回合内/秋季前等","source_type":"问对/朝议/常朝/廷议/御前/鸿雁/朱批 之一","source_conv_id":"jishiRecords[i] 的 turn-char-mode 联合标识·或 courtRecords[i].turn","willingness":0.5,"player_emphasis":"明命/暗示/试探","required_npc_action":"NPC 在 SC1 npc_actions 中必须出现的行动 (30字内)"}],\n'
            + '  "collective_resolutions":[{"topic":"议题","forum":"朝议/常朝/廷议","decision":"决议内容","adopted_by_emperor":true,"required_actions":["承办者必做的 1-3 项"],"source_court_id":"courtRecords[i].turn"}],\n'
            + '  "npc_dialogue_intent":[{"npc":"NPC名","mood":"unenthused/eager/resentful/sincere/sycophant","subtext":"潜台词 (40字)","next_likely_move":"下一步可能动作 (40字)"}],\n'
            + '  "required_sc1_actions":["SC1 必须在 npc_actions/edict_feedback/char_updates 中出现的硬性条目 (每条 40字内·≤5 条)"]\n'
            + '}\n\n'
            + '★ 严格约束·\n'
            + '  · 宁可不写不可编造·只算"具体动作+时限+目标"·客套话 ("臣愿效死力""敢不奉诏") 不算\n'
            + '  · 不可凭空生成新人物·只能引用 jishiRecords/courtRecords 中真出现的 NPC 名\n'
            + '  · source_type/source_conv_id 必填·apply 时按此 dedup\n'
            + '  · willingness∈[0,1]·根据 NPC 答话语气推断·拒绝/敷衍 < 0.4·热情 > 0.7';

          var _sc1qBody = { model: P.ai.model || 'gpt-4o', messages: [{role:'system', content:_maybeCacheSys(sysPFor('sc1q'))}, {role:'user', content:tp1q}], temperature: 0.3, max_tokens: _tok(3500) };
          // Phase 6 Q1·sc1q strict json_schema (P.ai.openaiStrict=true)·否则 json_object
          var _sc1qRf = _selectResponseFormat(_modelFamily, _buildSc1qJsonSchema);
          if (_sc1qRf) _sc1qBody.response_format = _sc1qRf;
          var _sc1qCall = await _callEndturnAI(_sc1qBody, { id: 'sc1q', label: '对话承诺推演', priority: 'normal' });
          if (_sc1qCall && _sc1qCall.data) _checkTruncated(_sc1qCall.data, '对话承诺推演');
          var _sc1qParse = (_sc1qCall && _sc1qCall.parse) || await _parseOrRepairJsonResult((_sc1qCall && _sc1qCall.raw) || '', _sc1qCall && _sc1qCall.data, '对话承诺推演', { url: url, key: P.ai.key, body: _sc1qBody, expectedKeys: ['dialogue_commitments', 'collective_resolutions', 'npc_dialogue_intent', 'required_sc1_actions'], priority: 'normal' });
          var pq = (_sc1qParse && _sc1qParse.parsed) || null;
          if (pq) {
            ctx.results = ctx.results || {};
            ctx.results.sc1q = pq;
            GM._turnAiResults.subcall1q = pq;
            _dbg('[sc1q] commitments=' + (pq.dialogue_commitments||[]).length + ' resolutions=' + (pq.collective_resolutions||[]).length + ' intents=' + (pq.npc_dialogue_intent||[]).length);
          }
        } catch(_sc1qErr) {
          // R-B·sc1q 失败 = 增量 missed·SC1 仍读旧路径·非 critical
          _dbg('[sc1q] 失败 (SC1 仍可走 _npcCommitments 原路径):', _sc1qErr && _sc1qErr.message);
          if (typeof recordSubcallError === 'function') recordSubcallError('sc1q', 'execute', _sc1qErr);
          ctx.results = ctx.results || {};
          if (!ctx.results.sc1q) ctx.results.sc1q = { dialogue_commitments: [], collective_resolutions: [], npc_dialogue_intent: [], required_sc1_actions: [], _failed: true };
        }
      });

      // Phase 2.5·Promise.all·sc0 + sc1q 并行·max 8s wall-clock
      await Promise.all([_sc0P, _sc1qP]);

      // --- SC_RECALL: 按 SC0 生成的 memoryQueries 从永久档检索·注入到后续 prompt ---
      // 方向 6：RAG 式按需检索（2026-04-30 扩展：四源——NPC记忆/Chronicle/史记/伏笔）+ Phase 2.2 第 5 源向量
      // P10.4A：KokoroMemo 范式·Retrieval Gate 节流——非必要回合跳过·节省 API/CPU 开销 40-60%
      var _recallResults = [];
      var _gateDecision = { shouldRecall: true, reason: 'gate 未加载' };
      try {
        if (typeof RecallGate !== 'undefined' && RecallGate.shouldRecall) {
          _gateDecision = RecallGate.shouldRecall({
            aiThinking: aiThinking,
            currentEdicts: edicts
          });
          RecallGate.record(_gateDecision);
          if (!_gateDecision.shouldRecall) {
            _dbg('[RecallGate] 跳过 SC_RECALL·reason:', _gateDecision.reason);
          } else {
            _dbg('[RecallGate] 触发 SC_RECALL·reason:', _gateDecision.reason);
          }
        }
      } catch(_gateE) { _dbg('[RecallGate] fail·默认跑 SC_RECALL:', _gateE); }

      try {
        if (!_gateDecision.shouldRecall) {
          // gate 节流·跳过整段 SC_RECALL·_recallResults 保持空数组
          throw '__SKIP_RECALL__';
        }
        var _traceSuppressed = [];
        var _think = aiThinking || '';
        var _thinkJson = extractJSON(_think);
        var _baseMemoryQueries = (_thinkJson && Array.isArray(_thinkJson.memoryQueries)) ? _thinkJson.memoryQueries : [];
        // ①-S2 anomaly 深查：把非常规举措的 needs 转成检索查询·进 _baseMemoryQueries → 复用②agent recall / 固定 SC_RECALL 查历史先例（开关控制）
        if ((typeof agentFlagOn==='function' ? agentFlagOn('anomalyRoutingEnabled') : (P.conf && P.conf.anomalyRoutingEnabled)) && GM._turnAiResults && GM._turnAiResults.anomaly && GM._turnAiResults.anomaly.detected) {
          (GM._turnAiResults.anomaly.moves || []).forEach(function(m) {
            if (!m) return;
            var _kw = String(m.needs || m.what || '').trim();
            if (_kw) _baseMemoryQueries.push({ keywords: [_kw.slice(0, 40)], purpose: 'anomaly_precedent:' + String(m.what || '').slice(0, 30) });
          });
        }
        var _mqList = _baseMemoryQueries.slice(0, 4);
        // ── S2 按需取数 agent 分支：开关 P.conf.agentRecallEnabled（默认关）。
        //    成功 → 填 _recallResults 并置 _agentRecallDone，跳过下方固定检索 for-loop；
        //    失败 / 无结果 / 开关关 → _agentRecallDone=false，固定检索照常跑（逐字节等同现状）。
        //    packForInjection 与 MemoryTrace（下方 if(_recallResults>0) 段）对两条路径统一复用。──
        var _agentRecallDone = false;
        if (P && (typeof agentFlagOn==='function' ? agentFlagOn('agentRecallEnabled') : (P.conf && P.conf.agentRecallEnabled)) && global.TM && global.TM.MemoryAgentTools && typeof global.TM.MemoryAgentTools.runRecall === 'function') {
          try {
            var _agentRecall = await global.TM.MemoryAgentTools.runRecall(GM, { aiThinking: _think, baseQueries: _baseMemoryQueries, edicts: edicts, curT: (GM && GM.turn) || 1 });
            if (_agentRecall && _agentRecall.results && _agentRecall.results.length) {
              _recallResults = _agentRecall.results;
              _agentRecallDone = true;
              _dbg('[SC_RECALL/agent] ' + _agentRecall.toolCallCount + ' 工具·' + _agentRecall.totalHits + ' 命中·fallback=' + _agentRecall.fallback);
            } else {
              _dbg('[SC_RECALL/agent] 无结果·落回固定检索');
            }
          } catch (_agentRecallE) {
            _dbg('[SC_RECALL/agent] 异常·落回固定检索:', (_agentRecallE && _agentRecallE.message) || _agentRecallE);
          }
        }
        if (global.TM && global.TM.MemoryRetrieval && typeof global.TM.MemoryRetrieval.buildRecallQueries === 'function') {
          try {
            _mqList = global.TM.MemoryRetrieval.buildRecallQueries(GM, _baseMemoryQueries, {
              turn: GM && GM.turn || 0,
              sc1q: ctx && ctx.results && ctx.results.sc1q,
              maxQueries: 6
            });
          } catch(_buildMqE) {
            _mqList = _baseMemoryQueries.slice(0, 4);
          }
        }
        if (_mqList.length > 0) {
          // S2: agent 已取数则跳过固定检索 for-loop（内部逻辑整体不变·仅外套一层开关·未重排缩进以保最小 diff）
          if (!_agentRecallDone) {
          for (var _mqI = 0; _mqI < _mqList.length; _mqI++) {
            var q = _mqList[_mqI];
            if (!q || typeof q !== 'object') continue;
            var allHits = [];
            var keywords = Array.isArray(q.keywords) ? q.keywords : (q.keywords ? [q.keywords] : []);
            keywords = keywords.map(function(k) { return String(k || '').trim().slice(0, 40); }).filter(Boolean).slice(0, 6);
            var keywordRe = keywords.length > 0 ? new RegExp(keywords.map(function(k){return String(k).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|'), 'i') : null;

            // 源 1: NpcMemorySystem 人物记忆（精准）
            if (global.TM && global.TM.MemoryRetrieval && typeof global.TM.MemoryRetrieval.collectPriorityHits === 'function') {
              try {
                var priorityHits = global.TM.MemoryRetrieval.collectPriorityHits(GM, q, {
                  turn: GM && GM.turn || 0,
                  sc1q: ctx && ctx.results && ctx.results.sc1q
                });
                if (priorityHits && priorityHits.length) allHits = allHits.concat(priorityHits);
              } catch(_e0) {}
            }

            if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.recallMemory) {
              try {
                var npcHits = NpcMemorySystem.recallMemory({
                  keywords: keywords,
                  turnRange: q.turnRange,
                  participant: q.participant,
                  minImportance: q.minImportance
                }, { limit: 6 });
                if (npcHits && npcHits.length > 0) {
                  npcHits.forEach(function(h) {
                    allHits.push({ source: 'npc', char: h.char, turn: h.turn, text: h.event, importance: h.importance });
                  });
                }
              } catch(_e1) {}
            }

            // 源 2: ChronicleTracker 长期事势（关键词过滤）
            if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAll && keywordRe) {
              try {
                var chronAll = ChronicleTracker.getAll({}) || [];
                var chronHits = chronAll.filter(function(c) {
                  if (!c) return false;
                  var hay = (c.title || '') + ' ' + (c.description || c.summary || '') + ' ' + (c.result || '');
                  return keywordRe.test(hay);
                }).slice(0, 4);
                chronHits.forEach(function(c) {
                  allHits.push({ source: 'chronicle', turn: c.startTurn || c.completedTurn || 0, text: (c.title || '') + (c.description ? '·' + String(c.description).slice(0, 80) : ''), status: c.status });
                });
              } catch(_e2) {}
            }

            // 源 3: shijiHistory 史记（关键词过滤·近 30 回合）
            if (Array.isArray(GM.shijiHistory) && keywordRe) {
              try {
                var sjLook = GM.shijiHistory.slice(-30);
                // 若 turnRange 限制，进一步过滤
                if (Array.isArray(q.turnRange) && q.turnRange.length === 2) {
                  sjLook = sjLook.filter(function(sh) { return sh.turn >= q.turnRange[0] && sh.turn <= q.turnRange[1]; });
                }
                var sjHits = sjLook.filter(function(sh) {
                  if (!sh) return false;
                  var hay = (sh.shizhengji || '') + ' ' + (sh.zhengwen || '') + ' ' + (sh.shilu || '');
                  return keywordRe.test(hay);
                }).slice(-4); // 取最近 4 条
                sjHits.forEach(function(sh) {
                  // 提取包含关键词的句子
                  var combined = (sh.shilu || sh.shizhengji || '').replace(/\s+/g, ' ');
                  var sentences = combined.split(/[。！？]/).filter(function(s) { return s && keywordRe.test(s); });
                  var snippet = sentences.slice(0, 2).join('。').slice(0, 120);
                  allHits.push({ source: 'shiji', turn: sh.turn, text: snippet || combined.slice(0, 100) });
                });
              } catch(_e3) {}
            }

            // 源 4: _foreshadows 伏笔（关键词过滤）
            if (Array.isArray(GM._foreshadows) && keywordRe) {
              try {
                var foreHits = GM._foreshadows.filter(function(f) {
                  if (!f) return false;
                  var hay = (f.content || f.text || '') + (f.context || '');
                  return keywordRe.test(hay);
                }).slice(-3);
                foreHits.forEach(function(f) {
                  allHits.push({ source: 'foreshadow', turn: f.turn || 0, text: String(f.content || f.text || '').slice(0, 100) });
                });
              } catch(_e4) {}
            }

            // 源 5: 语义向量检索（bge-small-zh）·若模型未就绪/未启用·静默跳过
            if (typeof SemanticRecall !== 'undefined' && SemanticRecall.searchSyncSafe && SemanticRecall.status && SemanticRecall.status().modelReady) {
              try {
                var qText = (q.query || '') + ' ' + keywords.join(' ');
                if (qText.trim()) {
                  var vecHits = await SemanticRecall.searchSyncSafe(qText.trim(), { topK: 4, threshold: (typeof P !== 'undefined' && P && P.conf && P.conf.semanticRecallThreshold != null) ? P.conf.semanticRecallThreshold : 0.45 });
                  if (vecHits && vecHits.length) {
                    vecHits.forEach(function(v) {
                      // S6(2026-06-03): 带上 origin 稳定 id + sourceRef(指回 shiji/chronicle/foreshadow/eventHistory 源)，令向量 hit 可被 dedup/supersedes/contradicts lineage 治理。
                      allHits.push({ source: 'vector', sub: v.sub, id: v.id, turn: v.turn, text: v.text, sim: v.sim, sourceRefs: v.id ? [{ type: v.sub || 'vector', id: v.id }] : [] });
                    });
                  }
                }
              } catch(_e5) {}
            }

            if (allHits.length > 0) {
              // P12.3 5 维加权打分（KokoroMemo card_retriever.py:163-169 范式·本地化为天命语境）
              // score = vector*0.45 + importance*0.20 + recency*0.15 + source_priority*0.15 + dim_weight*0.05
              var _curT = (typeof GM !== 'undefined' && GM && GM.turn) || 1;
              var _sourcePriority = { 'imperialEdict': 1.0, 'pinned': 1.0, 'chronicle': 0.8, 'shiji': 0.7, 'foreshadow': 0.65, 'vector': 0.6, 'npc': 0.5, 'unknown': 0.4 };
              var _scoreHit = function(h) {
                // (1) vector 相似度·已归一化 0-1·非 vector 源用 0.6 默认（关键词匹配视为中等相似）
                var vs = (typeof h.sim === 'number') ? h.sim : 0.6;
                // (2) importance·NPC 记忆/Chronicle 自带 0-10 → 归一·shiji/foreshadow 默认 0.5
                var imp = 0.5;
                if (typeof h.importance === 'number') imp = Math.max(0, Math.min(1, h.importance / 10));
                // (3) recency·按 turn 距动态衰减（≤1 = 1.0·≤5 = 0.85·≤15 = 0.65·≤50 = 0.45·更远 = 0.30）
                var dt = _curT - (h.turn || 0);
                var rec = (dt <= 1) ? 1.0 : (dt <= 5) ? 0.85 : (dt <= 15) ? 0.65 : (dt <= 50) ? 0.45 : 0.30;
                // (4) source_priority·按源类型固定权重
                var sp = _sourcePriority[h.source] || _sourcePriority.unknown;
                // (5) dim_weight·若是 vector 或 eventHistory 命中且带 affects_future·加分
                var dw = 0.5;
                if (h.affects_future === true || h.affects_future === 'true') dw = 1.0;
                else if (h.source === 'vector') dw = 0.7;
                // 加权总分
                return vs * 0.45 + imp * 0.20 + rec * 0.15 + sp * 0.15 + dw * 0.05;
              };
              // S1(2026-06-03): 与 compileFromGM 一致——对命中本回合焦点实体的记忆做 relevance 加成(Gen-Agents)，活召回路也享同等提升。
              if (global.TM && global.TM.MemoryRetrieval && typeof global.TM.MemoryRetrieval.applyFocusRelevance === 'function' && typeof global.TM.MemoryRetrieval.turnFocusTerms === 'function') {
                try { global.TM.MemoryRetrieval.applyFocusRelevance(allHits, global.TM.MemoryRetrieval.turnFocusTerms(GM, {})); } catch (_focusRecallE) {}
              }
              if (global.TM && global.TM.MemoryRetrieval && typeof global.TM.MemoryRetrieval.rankHitsDetailed === 'function') {
                var _rankedRecall = global.TM.MemoryRetrieval.rankHitsDetailed(allHits, { turn: _curT, GM: GM });
                allHits = _rankedRecall.ranked || [];
                if (_rankedRecall.suppressed && _rankedRecall.suppressed.length) {
                  _traceSuppressed = _traceSuppressed.concat(_rankedRecall.suppressed);
                }
              } else if (global.TM && global.TM.MemoryRetrieval && typeof global.TM.MemoryRetrieval.rankHits === 'function') {
                allHits = global.TM.MemoryRetrieval.rankHits(allHits, { turn: _curT, GM: GM });
              } else {
                allHits.forEach(function(h) { h._score = _scoreHit(h); });
                allHits.sort(function(a, b) { return (b._score||0) - (a._score||0); });
              }
              _recallResults.push({
                query: q,
                hits: allHits.slice(0, 12),  // 单查询 top-12 命中（按加权总分降序·KokoroMemo 范式）
                _scoring: '5dim-weighted'
              });
            }
          }
          } // end if(!_agentRecallDone) — S2 固定检索 for-loop 开关包裹

          if (_recallResults.length > 0) {
            var _recallBudget = null;
            try {
              if (global.TM && global.TM.MemoryRetrieval && typeof global.TM.MemoryRetrieval.packForInjection === 'function') {
                var _maxRecallTokens = (P && P.conf && P.conf.memoryRecallTokenBudget) || 1200;
                var _packedRecall = global.TM.MemoryRetrieval.packForInjection(_recallResults, {
                  maxTokens: _maxRecallTokens,
                  perHitMaxChars: 100
                });
                _recallResults = _packedRecall.recallResults || _recallResults;
                _recallBudget = { maxTokens: _packedRecall.maxTokens || _maxRecallTokens, tokenEstimate: _packedRecall.tokenEstimate || 0, diagnostics: _packedRecall.diagnostics || null };
                if (_packedRecall.suppressed && _packedRecall.suppressed.length) {
                  // budget_exceeded diagnostics are persisted through MemoryTrace.
                  _traceSuppressed = _traceSuppressed.concat(_packedRecall.suppressed);
                }
              }
            } catch(_packRecallE) {}
            GM._turnAiResults.recallResults = _recallResults;
            var _totalHits = _recallResults.reduce(function(s,r){return s+r.hits.length;},0);
            // 按源分类计数
            var _bySrc = {};
            _recallResults.forEach(function(r) {
              r.hits.forEach(function(h) { _bySrc[h.source] = (_bySrc[h.source]||0) + 1; });
            });
            var _srcSummary = Object.keys(_bySrc).map(function(k){return k+':'+_bySrc[k];}).join(' ');
            try {
              if (global.TM && global.TM.MemoryTrace && typeof global.TM.MemoryTrace.recordRetrieval === 'function') {
                var _traceHits = [];
                _recallResults.forEach(function(r) {
                  (r.hits || []).forEach(function(h) { _traceHits.push(h); });
                });
                global.TM.MemoryTrace.recordRetrieval(GM, {
                  id: 'SC_RECALL',
                  status: 'hit',
                  query: (_agentRecallDone && _agentRecall && _agentRecall.toolCalls && _agentRecall.toolCalls.length) ? _agentRecall.toolCalls : _mqList,
                  gate: _gateDecision,
                  sources: _bySrc,
                  hits: _traceHits,
                  suppressed: _traceSuppressed,
                  budget: _recallBudget,
                  agent: (_agentRecallDone && _agentRecall) ? { toolCallCount: _agentRecall.toolCallCount, totalHits: _agentRecall.totalHits, fallback: _agentRecall.fallback, toolCalls: _agentRecall.toolCalls } : null,
                  anomaly: ((typeof agentFlagOn==='function' ? agentFlagOn('anomalyRoutingEnabled') : (P.conf && P.conf.anomalyRoutingEnabled)) && GM._turnAiResults && GM._turnAiResults.anomaly && GM._turnAiResults.anomaly.detected) ? GM._turnAiResults.anomaly : null
                });
              }
            } catch(_) {}
            try {
              if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('recall', { status: 'hit', mode: _agentRecallDone ? 'agent' : 'fixed', queries: _mqList.length, hits: _totalHits, bySource: _bySrc, gate: _gateDecision, agent: (_agentRecallDone && _agentRecall) ? { toolCallCount: _agentRecall.toolCallCount, totalHits: _agentRecall.totalHits, fallback: _agentRecall.fallback } : null, snapshot: (typeof buildMemoryDiagnosticSnapshot === 'function' ? buildMemoryDiagnosticSnapshot(GM) : null) });
            } catch(_) {}
            _dbg('[SC_RECALL]', _agentRecallDone ? 'agent检索' : '固定4源检索', _agentRecallDone && _agentRecall ? (_agentRecall.toolCalls || []).map(function (c) { return c.name; }).join(',') : (_mqList.length + '查询'), '·总命中', _totalHits, '·分布', _srcSummary);
          }
        }
      } catch(_rcE) {
        if (_rcE === '__SKIP_RECALL__') {
          try { if (global.TM && global.TM.MemoryTrace && typeof global.TM.MemoryTrace.recordRetrieval === 'function') global.TM.MemoryTrace.recordRetrieval(GM, { id: 'SC_RECALL', status: 'skipped', gate: _gateDecision, hits: [] }); } catch(_) {}
          // P10.4A gate 决定跳过·非错误·静默
          try { if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('recall', { status: 'skipped', gate: _gateDecision, snapshot: (typeof buildMemoryDiagnosticSnapshot === 'function' ? buildMemoryDiagnosticSnapshot(GM) : null) }); } catch(_) {}
        } else {
          try { if (global.TM && global.TM.MemoryTrace && typeof global.TM.MemoryTrace.recordRetrieval === 'function') global.TM.MemoryTrace.recordRetrieval(GM, { id: 'SC_RECALL', status: 'fail', gate: _gateDecision, hits: [] }); } catch(_) {}
          try { if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('recall', { status: 'fail', error: String(_rcE && _rcE.message || _rcE), gate: _gateDecision }); } catch(_) {}
          _dbg('[SC_RECALL] 失败:', _rcE);
          // Phase 0 H8·失败 push ctx.meta.errors·诊断面板可见
          try {
            if (ctx && ctx.meta) {
              ctx.meta.errors = ctx.meta.errors || [];
              ctx.meta.errors.push({ subcall: 'sc_recall', phase: 'memoryQuery', err: (_rcE && _rcE.message) || String(_rcE), turn: GM && GM.turn });
            }
            // Phase 1 Q2·同步 push 到诊断面板
            if (typeof recordSubcallError === 'function') recordSubcallError('sc_recall', 'memoryQuery', _rcE);
          } catch(_pushE) {}
        }
      }

      // --- 官制活化 #1·office-recall 子调用（按需取数·走次要 API·gated officeRecallAgentEnabled·关则 GM._officeRecallResult=null·主推演落回静态职权舆图·零回归）---
      // 不脱节：此处在玩家本回合操作落 GM 之后跑·查当前 officeTree(含玩家任免/_pendingReforms)·输出经 GM._officeRecallResult 喂进主推演 prompt 职权舆图槽。
      try {
        if (typeof officeFlagOn === 'function' && officeFlagOn('officeRecallAgentEnabled') && global.TM && global.TM.OfficeRecallAgent && typeof global.TM.OfficeRecallAgent.runOfficeRecall === 'function') {
          var _ofFocus = (typeof _think !== 'undefined' && _think) ? String(_think).replace(/\s+/g, ' ').slice(0, 300) : '';
          var _ofRes = await global.TM.OfficeRecallAgent.runOfficeRecall(GM, { focus: _ofFocus });
          GM._officeRecallResult = (_ofRes && _ofRes.text) ? { text: _ofRes.text, turn: GM.turn, toolCallCount: _ofRes.toolCallCount, fallback: _ofRes.fallback } : null;
          _dbg('[SC_OFFICE_RECALL]', GM._officeRecallResult ? (_ofRes.toolCallCount + ' 官署细查·fallback=' + _ofRes.fallback) : '无结果·落回静态舆图');
        } else {
          GM._officeRecallResult = null;
        }
      } catch (_ofE) { GM._officeRecallResult = null; _dbg('[SC_OFFICE_RECALL] 异常·落回静态舆图:', (_ofE && _ofE.message) || _ofE); }

      // --- Sub-call 0.5: 深度记忆回顾 ---
      await _runSubcall('sc05', '记忆回顾', 'standard', async function() {
      showLoading("\u6DF1\u5EA6\u56DE\u987E",48);
      try {
        // P6.6 分层全读：近 5 回合完整不截断·5-12 回合 400 字摘要·12+ 回合靠 _aiMemory 压缩层
        // 用户需求："时政记应该不止四百字·要完整读取·超出读取回合范围的自动纳入压缩之中"
        var _recentHistory = '';
        if (GM.shijiHistory && GM.shijiHistory.length > 0) {
          // 动态调整近端窗口（按 token 预算·若上下文紧张可减·若宽裕可增）
          var _injCpRH = (typeof getCompressionParams === 'function') ? getCompressionParams() : { fullReadTurns: 5, briefReadTurns: 12 };
          var _fullN = _injCpRH.fullReadTurns || 5;
          var _briefN = _injCpRH.briefReadTurns || 12;
          var _allHistory = GM.shijiHistory;
          var _fullSlice = _allHistory.slice(-_fullN);
          var _briefSlice = _allHistory.slice(-_briefN, -_fullN); // 5-12 回合段
          // 近端·完整全文（时政记+实录+正文+人事+诏令）
          if (_fullSlice.length > 0) {
            _recentHistory += '\n=== 近 ' + _fullSlice.length + ' 回合·完整记录（不截断） ===\n';
            _fullSlice.forEach(function(sh) {
              _recentHistory += '\n────── T' + sh.turn + (sh.time ? '·' + sh.time : '') + ' ──────\n';
              if (sh.shizhengji) _recentHistory += '【时政记】\n' + sh.shizhengji + '\n';
              if (sh.shilu) _recentHistory += '【实录】\n' + sh.shilu + '\n';
              if (sh.zhengwen) _recentHistory += '【正文/后人戏说】\n' + sh.zhengwen + '\n';
              // 玩家诏令完整列出
              if (sh.edicts && typeof sh.edicts === 'object') {
                var _ed = [];
                Object.keys(sh.edicts).forEach(function(cat) {
                  var v = sh.edicts[cat];
                  if (typeof v === 'string' && v.trim()) {
                    v.split(/[\n；;]+/).map(function(s){return s.trim();}).filter(Boolean).forEach(function(line) {
                      _ed.push('[' + cat + '] ' + line);
                    });
                  }
                });
                if (_ed.length > 0) _recentHistory += '【玩家诏令】\n' + _ed.join('\n') + '\n';
              }
              if (sh.personnel && Array.isArray(sh.personnel) && sh.personnel.length > 0) {
                _recentHistory += '【人事变动】\n' + sh.personnel.map(function(p) {
                  return '· ' + (p.name || '?') + (p.former ? '(原' + p.former + ')' : '') + '·' + (p.change || '') + (p.reason ? ' ←' + p.reason : '');
                }).join('\n') + '\n';
              }
              if (sh.playerStatus) _recentHistory += '【政局摘要】' + sh.playerStatus + '\n';
              if (sh.playerInner) _recentHistory += '【内省】' + sh.playerInner + '\n';
            });
            _recentHistory += '\n=== 近端完整记录结束 ===\n\n';
          }
          // 中端·400 字摘要（5-12 回合）
          if (_briefSlice.length > 0) {
            _recentHistory += '=== ' + (_fullN+1) + '-' + (_fullN+_briefSlice.length) + ' 回合前·摘要回顾 ===\n';
            _briefSlice.forEach(function(sh) {
              _recentHistory += 'T' + sh.turn + ' [时政] ' + (sh.shizhengji || '').substring(0, 400) + '\n';
              if (sh.shilu) _recentHistory += '       [实录] ' + (sh.shilu || '').substring(0, 150) + '\n';
              if (sh.edicts && typeof sh.edicts === 'object') {
                var _eSum = [];
                Object.keys(sh.edicts).forEach(function(cat) {
                  var v = sh.edicts[cat];
                  if (typeof v === 'string' && v.trim()) _eSum.push('[' + cat + ']' + v.split(/[\n；;]/)[0].slice(0, 40));
                });
                if (_eSum.length > 0) _recentHistory += '       [玩家诏] ' + _eSum.join(' · ') + '\n';
              }
            });
            _recentHistory += '\n';
          }
          // 12+ 回合：靠下方注入的 _aiMemory 压缩段（已自动 sc25 后台触发）+ _memoryLayers L2/L3·此处不重复
        }
        if (GM.evtLog && GM.evtLog.length > 0) {
          // B2：过滤已死角色的过往事件（epitaph 已摘要·避免死人复活）
          var _keyEvts = GM.evtLog.slice(-30).filter(function(e){ return !e._charDied; }).map(function(e) { return 'T' + e.turn + ' [' + e.type + '] ' + e.text; }).join('\n');
          _recentHistory += '\n' + _keyEvts;
        }
        // B2：注入墓志铭（死者在本章节之外不得出现）
        if (Array.isArray(GM._epitaphs) && GM._epitaphs.length > 0) {
          var _epitaphSection = '\n【历代人物墓志铭（死者在当前回合推演中不得行动）】\n';
          GM._epitaphs.slice(-8).forEach(function(ep){
            _epitaphSection += '  · ' + ep.char + '（殁于T' + ep.diedTurn + (ep.diedAt?'·'+ep.diedAt:'') + '·' + (ep.reason||'') + '）' + (ep.positionAtDeath?'卒时任'+ep.positionAtDeath:'') + '\n';
          });
          _recentHistory += _epitaphSection;
        }
        // 加入伏笔和AI记忆
        if (GM._foreshadows && GM._foreshadows.length > 0) {
          var _compressedFore = GM._foreshadows.filter(function(f){return f.type==='compressed';});
          var _activeFore = GM._foreshadows.filter(function(f){return f.type!=='compressed';}).slice(-15);
          _recentHistory += '\n【已埋伏笔】\n';
          if (_compressedFore.length > 0) _recentHistory += _compressedFore.map(function(f){return (typeof memoryEntryText === 'function') ? memoryEntryText(f) : (f.content||f.text||f);}).join('\n') + '\n';
          _recentHistory += _activeFore.map(function(f){return 'T'+(f.turn||'?')+': '+((typeof memoryEntryText === 'function') ? memoryEntryText(f) : (f.content||f.text||f));}).join('\n');
        }
        if (GM._aiMemory && GM._aiMemory.length > 0) {
          // 使用动态探测的上下文参数决定注入量
          var _injCp = getCompressionParams();
          var _memInjectCount = _injCp.memInjectCount;
          // 优先注入压缩摘要（type=compressed），再注入最近记忆
          var _compressedMem = GM._aiMemory.filter(function(m){return m.type==='compressed';});
          var _recentMem = GM._aiMemory.filter(function(m){return m.type!=='compressed';}).slice(-_memInjectCount);
          _recentHistory += '\n【AI记忆】\n';
          if (_compressedMem.length > 0) _recentHistory += _compressedMem.map(function(m){return (typeof memoryEntryText === 'function') ? memoryEntryText(m) : (m.content||m.text||m);}).join('\n') + '\n';
          _recentHistory += _recentMem.map(function(m){return 'T'+(m.turn||'?')+': '+((typeof memoryEntryText === 'function') ? memoryEntryText(m) : (m.content||m.text||m));}).join('\n');
        }
        // —— A1 三层记忆金字塔：L3 年代纲要 + L2 情景摘要（XML 结构化·永不丢失的历史根）——
        if (GM._memoryLayers) {
          var _ML = GM._memoryLayers;
          // XML 转义辅助（统一防注入）
          var _xE2 = (typeof _escXML === 'function') ? _escXML : function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); };
          if (Array.isArray(_ML.L3) && _ML.L3.length > 0) {
            _recentHistory += '\n<era-outline>\n';
            _ML.L3.slice(-4).forEach(function(x){
              if (x.aiGenerated) {
                _recentHistory += '  <era range="' + _xE2(x.turnRange) + '" theme="' + _xE2(x.theme||'') + '" atmosphere="' + _xE2(x.atmosphere||'') + '">\n';
                if (x.mainThreads) _recentHistory += '    <threads>' + _xE2(x.mainThreads) + '</threads>\n';
                if (x.causalSummary) _recentHistory += '    <causal>' + _xE2(x.causalSummary) + '</causal>\n';
                if (Array.isArray(x.highlights)) _recentHistory += '    <highlights>' + _xE2(x.highlights.join('｜')) + '</highlights>\n';
                _recentHistory += '  </era>\n';
              } else {
                _recentHistory += '  <era range="' + _xE2(x.turnRange) + '">' + _xE2(x.summary) + '</era>\n';
              }
            });
            _recentHistory += '</era-outline>\n';
          }
          if (Array.isArray(_ML.L2) && _ML.L2.length > 0) {
            _recentHistory += '\n<scene-summaries>\n';
            _ML.L2.slice(-6).forEach(function(x){
              if (x.aiGenerated) {
                _recentHistory += '  <scene range="' + _xE2(x.turnRange) + '" mood="' + _xE2(x.mood||'') + '">' + _xE2(x.summary) + '</scene>\n';
              } else {
                _recentHistory += '  <scene range="' + _xE2(x.turnRange) + '">' + _xE2(x.summary) + '</scene>\n';
              }
            });
            _recentHistory += '</scene-summaries>\n';
          }
        }
        // —— SC_RECALL 检索结果注入（XML 格式·转义·支持多源 hit 格式：npc/chronicle/shiji/foreshadow/vector）——
        if (_recallResults && _recallResults.length > 0) {
          var _compiledRecall = null;
          try {
            if (global.TM && global.TM.MemoryContextCompiler && typeof global.TM.MemoryContextCompiler.compileRecall === 'function') {
              _compiledRecall = global.TM.MemoryContextCompiler.compileRecall(_recallResults, {
                turn: GM && GM.turn,
                maxTokens: (P && P.conf && (P.conf.memoryRecallZoneTokenBudget || P.conf.memoryRecallTokenBudget)) || 1200,
                perHitMaxChars: 100,
                suppressed: _traceSuppressed
              });
            }
          } catch(_compileRecallE) {
            _compiledRecall = null;
          }
          if (_compiledRecall && _compiledRecall.text) {
            var _compiledRecallStart = _recentHistory.length;
            _recentHistory += '\n<recall-disclaimer>以下 memory-context 来自历史档案·已按权威、时间、范围与预算编排·若与当前回合硬状态冲突，以当前回合推演为准。</recall-disclaimer>\n';
            _recentHistory += _compiledRecall.text;
            try {
              if (global.TM && global.TM.MemoryTrace && typeof global.TM.MemoryTrace.recordInjection === 'function') {
                global.TM.MemoryTrace.recordInjection(GM, {
                  lane: 'memory_context_compiler',
                  stage: 'sc05-recall-compiler',
                  text: _recentHistory.slice(_compiledRecallStart),
                  items: (_compiledRecall.hits || []).map(function(hit) {
                    return {
                      id: hit.id || '',
                      source: hit.source || '',
                      reason: 'MemoryContextCompiler',
                      lane: hit.lane || 'L6_retrieved_evidence',
                      authority: hit.authority || '',
                      authorityRank: hit.authorityRank,
                      factStatus: hit.factStatus || '',
                      confidence: hit.confidence,
                      sourceRefs: Array.isArray(hit.sourceRefs) ? hit.sourceRefs : [],
                      basisRefs: Array.isArray(hit.basisRefs) ? hit.basisRefs : []
                    };
                  }),
                  suppressed: _compiledRecall.suppressed || [],
                  tokenEstimate: _compiledRecall.tokenEstimate || ((typeof _tok === 'function') ? _tok(_compiledRecall.text) : 0)
                });
              }
            } catch(_) {}
          } else {
          var _recallTraceStart = _recentHistory.length;
          var _recallTraceItems = [];
          var _recallZones = [];
          var _recallZoneOrder = 10;
          var _xE3 = (typeof _escXML === 'function') ? _escXML : function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); };
          var _recallRefList = function(list) {
            return (Array.isArray(list) ? list : []).slice(0, 4).map(function(ref) {
              if (!ref) return '';
              var t = String(ref.type || '').replace(/\s+/g, '_').slice(0, 40);
              var id = String(ref.id || '').replace(/\s+/g, '_').slice(0, 80);
              return (t && id) ? (t + ':' + id) : '';
            }).filter(Boolean).join('|');
          };
          // P10.4D 护栏（KokoroMemo injector.py 范式）：明确告知 AI 这些是历史记忆·可能不完整或过期
          _recentHistory += '\n<recall-disclaimer>以下 recalled-memories 来自历史档案·可能不完整或过期·不能覆盖本回合刚发生的事实·若有冲突以当前回合推演为准。</recall-disclaimer>\n';
          _recentHistory += '\n<recalled-memories>\n';
          var _recallHeaderText = _recentHistory.slice(_recallTraceStart);
          var _recallFooterText = '</recalled-memories>\n';
          _recallResults.forEach(function(rr) {
            var _recallGroupStart = _recentHistory.length;
            var _recallGroupMeta = { score: 0, sourceRefs: [], basisRefs: [], authority: '', authorityRank: null, visibility: '', factStatus: '', source: 'SC_RECALL' };
            _recentHistory += '  <recall purpose="' + _xE3((rr.query.purpose||'').substring(0,40)) + '">\n';
            rr.hits.slice(0, 8).forEach(function(hit) {
              // 兼容两种 hit 格式：旧 (char/event/importance) + 新多源 (source/text/turn[/char][/importance])
              var _hitText = hit.text || hit.event || '';
              var _hitChar = hit.char || '';
              var _hitSource = hit.source || (hit.char ? 'npc' : 'unknown');
              var _hitImportance = Math.round(hit.importance || 5);
              var _hitStatus = hit.status || '';
              var _hitSourceRefs = _recallRefList(hit.sourceRefs);
              var _hitBasisRefs = _recallRefList(hit.basisRefs);
              if (!_recallGroupMeta.source || _recallGroupMeta.source === 'SC_RECALL') _recallGroupMeta.source = _hitSource;
              if (!_recallGroupMeta.sourceRefs.length && Array.isArray(hit.sourceRefs)) _recallGroupMeta.sourceRefs = hit.sourceRefs;
              if (!_recallGroupMeta.basisRefs.length && Array.isArray(hit.basisRefs)) _recallGroupMeta.basisRefs = hit.basisRefs;
              if (!_recallGroupMeta.authority && hit.authority) _recallGroupMeta.authority = hit.authority;
              if (_recallGroupMeta.authorityRank == null && hit.authorityRank != null) _recallGroupMeta.authorityRank = hit.authorityRank;
              if (!_recallGroupMeta.visibility && hit.visibility) _recallGroupMeta.visibility = hit.visibility;
              if (!_recallGroupMeta.factStatus && hit.factStatus) _recallGroupMeta.factStatus = hit.factStatus;
              _recallGroupMeta.score = Math.max(_recallGroupMeta.score, typeof hit._score === 'number' ? hit._score : (typeof hit.relevance === 'number' ? hit.relevance : 0.5));
              _recentHistory += '    <hit source="' + _xE3(_hitSource) + '"';
              if (_hitChar) _recentHistory += ' char="' + _xE3(_hitChar) + '"';
              _recentHistory += ' turn="' + (hit.turn||0) + '" importance="' + _hitImportance + '"';
              if (_hitStatus) _recentHistory += ' status="' + _xE3(_hitStatus) + '"';
              if (hit.authority) _recentHistory += ' authority="' + _xE3(hit.authority) + '"';
              if (hit.authorityRank != null) _recentHistory += ' authority-rank="' + _xE3(hit.authorityRank) + '"';
              if (hit.factStatus) _recentHistory += ' fact-status="' + _xE3(hit.factStatus) + '"';
              if (hit.lane) _recentHistory += ' lane="' + _xE3(hit.lane) + '"';
              if (_hitSourceRefs) _recentHistory += ' source-refs="' + _xE3(_hitSourceRefs) + '"';
              if (_hitBasisRefs) _recentHistory += ' basis-refs="' + _xE3(_hitBasisRefs) + '"';
              // P12.3 显示 5 维加权总分（如有）·让 AI 知道哪些命中更可信
              if (typeof hit._score === 'number') _recentHistory += ' score="' + Math.round(hit._score * 100) / 100 + '"';
              _recentHistory += '>' + _xE3(String(_hitText).substring(0, 100)) + '</hit>\n';
              _recallTraceItems.push({
                id: hit.id || '',
                source: _hitSource,
                reason: 'SC_RECALL',
                lane: hit.lane || 'L6_retrieved_evidence',
                authority: hit.authority || '',
                authorityRank: hit.authorityRank,
                factStatus: hit.factStatus || '',
                confidence: hit.confidence,
                sourceRefs: Array.isArray(hit.sourceRefs) ? hit.sourceRefs : [],
                basisRefs: Array.isArray(hit.basisRefs) ? hit.basisRefs : []
              });
            });
            _recentHistory += '  </recall>\n';
            _recallZones.push({
              id: 'recall-group-' + (_recallZones.length + 1),
              lane:'L6_retrieved_evidence',
              text: _recentHistory.slice(_recallGroupStart),
              order: _recallZoneOrder++,
              score: _recallGroupMeta.score,
              source: _recallGroupMeta.source,
              reason: 'SC_RECALL',
              authority: _recallGroupMeta.authority,
              authorityRank: _recallGroupMeta.authorityRank,
              visibility: _recallGroupMeta.visibility,
              factStatus: _recallGroupMeta.factStatus,
              sourceRefs: _recallGroupMeta.sourceRefs,
              basisRefs: _recallGroupMeta.basisRefs
            });
          });
          _recentHistory += '</recalled-memories>\n';
          var _recallPackedZones = null;
          if (_recallZones.length && global.TM && global.TM.ContextZones && typeof global.TM.ContextZones.packZones === 'function') {
            var _recallZoneBudget = (P && P.conf && (P.conf.memoryRecallZoneTokenBudget || P.conf.memoryRecallTokenBudget)) || 1200;
            _recallPackedZones = global.TM.ContextZones.packZones([
              { id:'recall-header', lane:'L6_retrieved_evidence', text:_recallHeaderText, mustKeep:true, order:0, source:'SC_RECALL', reason:'recall header' }
            ].concat(_recallZones).concat([
              { id:'recall-footer', lane:'L6_retrieved_evidence', text:_recallFooterText, mustKeep:true, order:999999, source:'SC_RECALL', reason:'recall footer' }
            ]), { maxTokens:_recallZoneBudget });
            _recentHistory = _recentHistory.slice(0, _recallTraceStart) + (_recallPackedZones.text || '');
          }
          try {
            if (global.TM && global.TM.MemoryTrace && typeof global.TM.MemoryTrace.recordInjection === 'function') {
              var _recallInjectedText = _recentHistory.slice(_recallTraceStart);
              if (_recallPackedZones && global.TM.ContextZones && typeof global.TM.ContextZones.recordZoneInjection === 'function') {
                global.TM.ContextZones.recordZoneInjection(GM, _recallPackedZones, { stage:'sc05-recall' });
              } else {
                global.TM.MemoryTrace.recordInjection(GM, {
                lane: 'L6_retrieved_evidence',
                stage: 'sc05',
                text: _recallInjectedText,
                items: _recallTraceItems,
                tokenEstimate: (typeof _tok === 'function') ? _tok(_recallInjectedText) : 0
                });
              }
            }
          } catch(_) {}
          }
        }
        // —— 因果图近期边（转义）——
        if (GM._causalGraph && Array.isArray(GM._causalGraph.edges) && GM._causalGraph.edges.length > 0) {
          var _xE4 = (typeof _escXML === 'function') ? _escXML : function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); };
          var _recentEdges = GM._causalGraph.edges.slice(-15);
          _recentHistory += '\n<causal-graph recent-edges="' + _recentEdges.length + '">\n';
          _recentEdges.forEach(function(e) {
            _recentHistory += '  <edge from="' + _xE4((e.from||'').substring(0,30)) + '" to="' + _xE4((e.to||'').substring(0,30)) + '" type="' + _xE4(e.type||'') + '" strength="' + (e.strength||0.5) + '">' + _xE4((e.explanation||'').substring(0,60)) + '</edge>\n';
          });
          _recentHistory += '</causal-graph>\n';
        }
        // —— 势力弧（转义）——
        if (GM._factionArcs && Object.keys(GM._factionArcs).length > 0) {
          var _xE5 = (typeof _escXML === 'function') ? _escXML : function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); };
          _recentHistory += '\n<faction-arcs>\n';
          Object.keys(GM._factionArcs).slice(0, 6).forEach(function(fn) {
            var fa = GM._factionArcs[fn];
            if (!fa || !fa.phaseHistory) return;
            _recentHistory += '  <arc faction="' + _xE5(fn) + '" phase="' + _xE5(fa.currentPhase||'') + '" influence="' + (fa.cumulativeInfluence||0) + '">\n';
            (fa.phaseHistory || []).slice(-4).forEach(function(ph) {
              _recentHistory += '    <phase turn="' + (ph.turn||0) + '" stage="' + _xE5(ph.phase||'') + '">' + _xE5((ph.event||'').substring(0,50)) + '</phase>\n';
            });
            _recentHistory += '  </arc>\n';
          });
          _recentHistory += '</faction-arcs>\n';
        }
        // —— 自我反省（转义）——
        if (GM._aiReflections && GM._aiReflections.length > 0) {
          var _xE6 = (typeof _escXML === 'function') ? _escXML : function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); };
          _recentHistory += '\n<self-reflections>\n';
          GM._aiReflections.slice(-3).forEach(function(r) {
            _recentHistory += '  <reflection turn="' + (r.turn||0) + '" divergence="' + _xE6(r.divergence||'') + '">\n';
            _recentHistory += '    <predicted>' + _xE6((r.predictedLast||'').substring(0,80)) + '</predicted>\n';
            _recentHistory += '    <actual>' + _xE6((r.actualThis||'').substring(0,80)) + '</actual>\n';
            _recentHistory += '    <lesson>' + _xE6((r.lesson||'').substring(0,80)) + '</lesson>\n';
            _recentHistory += '  </reflection>\n';
          });
          _recentHistory += '</self-reflections>\n';
        }
        // 加入玩家决策记录
        if (GM.playerDecisions && GM.playerDecisions.length > 0) {
          _recentHistory += '\n\u3010\u73A9\u5BB6\u51B3\u7B56\u3011\n' + GM.playerDecisions.slice(-8).map(function(d){return 'T'+(d.turn||'?')+' '+d.type+': '+(d.content||d.description||'');}).join('\n');
        }
        // 决策回响（让AI追踪延迟后果）
        if (GM._decisionEchoes && GM._decisionEchoes.length > 0) {
          _recentHistory += '\n【决策回响——延迟后果】\n';
          GM._decisionEchoes.slice(-5).forEach(function(de) { _recentHistory += 'T' + de.turn + ': ' + de.content + '→预期回响:' + (de.echoDesc||'') + '（' + (de.delayTurns||3) + '回合后）\n'; });
        }
        // 考课历史摘要
        if (GM._annualReviewHistory && GM._annualReviewHistory.length > 0) {
          var _lr = GM._annualReviewHistory[GM._annualReviewHistory.length - 1];
          _recentHistory += '\n【最近考课T' + _lr.turn + '】优等' + _lr.excellent + '人 劣等' + _lr.poor + '人';
          if (_lr.promotions.length) _recentHistory += ' 建议擢升:' + _lr.promotions.join('、');
          if (_lr.demotions.length) _recentHistory += ' 建议左迁:' + _lr.demotions.join('、');
          _recentHistory += '\n';
        }
        // 情节线索
        if (GM._plotThreads && GM._plotThreads.length > 0) {
          _recentHistory += '\n【活跃情节线索】\n';
          GM._plotThreads.filter(function(t){return t.status==='active';}).slice(-5).forEach(function(t) { _recentHistory += '  · ' + t.title + '(' + t.type + ') P' + t.priority + '\n'; });
        }
        if (_recentHistory.length > 50) {
          try {
            if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('inject', { stage: 'sc05', chars: _recentHistory.length, recallHits: (_recallResults || []).reduce(function(s, r){ return s + ((r && Array.isArray(r.hits)) ? r.hits.length : 0); }, 0), snapshot: (typeof buildMemoryDiagnosticSnapshot === 'function' ? buildMemoryDiagnosticSnapshot(GM) : null) });
          } catch(_) {}
          var tp05 = '\u4EE5\u4E0B\u662F\u8FD1\u671F\u7684\u5B8C\u6574\u4E8B\u4EF6\u8BB0\u5F55\u3001\u5DF2\u57CB\u4F0F\u7B14\u3001AI\u8BB0\u5FC6\u548C\u73A9\u5BB6\u51B3\u7B56\uFF1A\n' + _recentHistory + '\n\n';
          tp05 += '\u8BF7\u8FD4\u56DEJSON\uFF1A\n{"causal_chains":"\u8FD1\u671F\u4E8B\u4EF6\u4E4B\u95F4\u7684\u5B8C\u6574\u56E0\u679C\u5173\u7CFB\u94FE(200\u5B57)","unresolved":"\u5C1A\u672A\u89E3\u51B3\u7684\u7EBF\u7D22\u548C\u60AC\u5FF5\u2014\u2014\u54EA\u4E9B\u4F0F\u7B14\u5E94\u8BE5\u5F15\u7206(150\u5B57)","patterns":"\u53CD\u590D\u51FA\u73B0\u7684\u6A21\u5F0F\u548C\u52A0\u901F\u7684\u8D8B\u52BF(100\u5B57)","player_impact":"\u73A9\u5BB6\u8FD1\u671F\u51B3\u7B56\u7684\u7D2F\u79EF\u5F71\u54CD\u2014\u2014\u54EA\u4E9B\u540E\u679C\u5373\u5C06\u663E\u73B0(150\u5B57)","npc_memories":"\u5404NPC\u5BF9\u8FD1\u671F\u4E8B\u4EF6\u7684\u8BB0\u5FC6\u548C\u60C5\u7EEA\u53D8\u5316(100\u5B57)","momentum":"\u5F53\u524D\u4E16\u754C\u7684\u60EF\u6027\u65B9\u5411\u2014\u2014\u5982\u679C\u6CA1\u6709\u5E72\u9884\uFF0C\u4E8B\u60C5\u4F1A\u5F80\u54EA\u4E2A\u65B9\u5411\u53D1\u5C55(80\u5B57)"}\n';
          tp05 += '\u8FD9\u662F\u4F60\u7684\u6DF1\u5EA6\u5185\u90E8\u5206\u6790\u3002\u8BF7\u5145\u5206\u601D\u8003\u6BCF\u4E00\u6761\u56E0\u679C\u94FE\u3002';
          var _sc05Body = {model:P.ai.model||"gpt-4o", messages:[{role:"system",content:_maybeCacheSys(sysPFor('sc05'))},{role:"user",content:tp05}], temperature:0.5, max_tokens:_tok(5000)};
          var _sc05Call = await _callEndturnAI(_sc05Body, { id: 'sc05', label: '因果合成', priority: 'normal' });
          {
            var data05 = _sc05Call.data;
            _checkTruncated(data05, '因果合成');
            if (_sc05Call.raw) {
              memoryReview = _sc05Call.raw;
              GM._turnAiResults.memoryReview = memoryReview;
              _dbg('[Memory Review]', memoryReview.substring(0, 150));
            }
          }
        }
      } catch(e05) {
        // Phase 0 H1\u00B7\u6539 fallback \u4E0D\u629B\u00B7SC05 \u5931\u8D25\u4E0D\u5E94\u963B\u585E SC1\u00B7memoryReview \u7559\u7A7A\u00B7ctx.meta.errors \u7559\u75D5
        _dbg('[Memory Review] \u5931\u8D25 (fallback to empty):', e05);
        memoryReview = '';
        try {
          if (ctx && ctx.meta) {
            ctx.meta.errors = ctx.meta.errors || [];
            ctx.meta.errors.push({ subcall: 'sc05', phase: 'memoryReview', err: (e05 && e05.message) || String(e05), turn: GM && GM.turn });
          }
          // Phase 1 Q2\u00B7\u540C\u6B65 push \u5230\u8BCA\u65AD\u9762\u677F
          if (typeof recordSubcallError === 'function') recordSubcallError('sc05', 'memoryReview', e05);
        } catch(_pushE) {}
      }
      }); // end Sub-call 0.5 _runSubcall

      // --- Sub-call 1: 结构化数据 (时政记/数值变化/事件/角色状态) --- [always runs]
      await _runSubcall('sc1', '结构化数据', 'lite', async function() {
      var _preAnalysis = '';
      if (aiThinking) _preAnalysis += '\n\u3010AI\u5C40\u52BF\u5206\u6790\u3011\n' + aiThinking + '\n';
      if (memoryReview) _preAnalysis += '\u3010\u8DE8\u56DE\u5408\u56E0\u679C\u94FE\u3011\n' + memoryReview + '\n';
      if (_preAnalysis) _preAnalysis += '\u8BF7\u57FA\u4E8E\u4EE5\u4E0A\u5206\u6790\u63A8\u6F14\uFF0C\u786E\u4FDD\u524D\u56DE\u5408\u7684\u60AC\u5FF5\u5F97\u5230\u56DE\u5E94\uFF0C\u56E0\u679C\u94FE\u5F97\u5230\u5EF6\u7EED\u3002\n';
      // Phase 2 Slice 1·_hardConstraints 静态规则 ①③④⑤⑥ 已抽到 sysP (composer.buildHardConstraints)
      // 这里只留动态死亡/诈死名单·每回合变·必须在 user prompt
      var _hardConstraints = '';
      try {
        var _deadList = [];
        var _fakeList = [];
        (GM.chars || []).forEach(function(c){
          if (!c) return;
          if (c._fakeDeath) { _fakeList.push(c.name); return; }
          if (c.alive === false) _deadList.push(c.name);
        });
        _hardConstraints += '\n═══【本回合死亡名单·遵 sysP 硬约束 ②】═══\n';
        _hardConstraints += '已死(禁动)：' + (_deadList.length ? _deadList.join('、') : '（无）') + '\n';
        if (_fakeList.length) {
          _hardConstraints += '诈死(明面死实则藏匿·仅允许极隐秘活动·需剧情合理)：' + _fakeList.join('、') + '\n';
        }
        _hardConstraints += '═════════════════════════════════════════════\n';
      } catch(_hcE) { _dbg('[HardConstraints] build failed', _hcE); }

      // ★ 世界状态快照注入（2026-04-30 记忆增强）：把"事实"以结构化卡片形式置于 prompt 顶部
      // 让 AI 一眼看到客观局势（玩家/国势/要职/死者/进行中诏令/NPC 当下状态），降低叙事漂移
      var _wsSnap = '';
      try { if (typeof _buildAllSnapshots === 'function') _wsSnap = _buildAllSnapshots() || ''; } catch(_wsE){ _dbg('[WorldSnap sc1] fail:', _wsE); }
      // ★ 12 表结构化记忆注入（2026-04-30 Phase 1）：sc1 前先同步 GM 状态到表·再把表序列化注入
      var _memTblInj = '', _memTblRule = '';
      try {
        if (window.MemTables && MemTables.ensureInit && MemTables.ensureInit()) {
          MemTables.syncFromGM({});
          _memTblInj = MemTables.buildTablesInjection({}) || '';
          _memTblRule = MemTables.buildTableRulePostscript() || '';
        }
      } catch(_mtE){ _dbg('[MemTables sc1] fail:', _mtE); }
      // ★ 时间参考块（Phase 4.1 Horae 风格）·防 AI 把"3 天前"说成"昨天"
      var _timeRef = '';
      try { if (typeof _buildTimeRef === 'function') _timeRef = _buildTimeRef() || ''; } catch(_tr){}
      // ★ 长期约束（Phase 4.2 ReNovel-AI affects_future 范式）
      var _futureC = '';
      try { if (typeof _mtBuildFuture === 'function') _futureC = _mtBuildFuture() || ''; } catch(_fc){}
      // ★ P11.2C-full 审核收件箱·必须在 sc1 注入前完成，否则 rejected 推测会多漏进一回合
      function _reviewConsolidatedInboxForSc1() {
        try {
          if (!Array.isArray(GM._consolidatedMemory) || GM._consolidatedMemory.length === 0) return;
          var _curTurnReview = (GM.turn || 1);
          var _recentShijiText = '';
          if (Array.isArray(GM.shijiHistory)) {
            GM.shijiHistory.slice(-3).forEach(function(sh) {
              _recentShijiText += (sh.shizhengji || '') + ' ' + (sh.shilu || '') + ' ' + (sh.zhengwen || '');
            });
          }
          var _approvedCnt = 0, _rejectedCnt = 0;
          GM._consolidatedMemory.forEach(function(cm) {
            if (!cm || !cm._pendingTurn) cm._pendingTurn = cm.turn;
            var age = _curTurnReview - cm.turn;
            if (age < 2) return; // 不足 2 回合·继续 pending
            (cm.key_threads || []).forEach(function(th) {
              if (th._status !== 'pending') return;
              var threadText = (th.thread || '') + ' ' + (th.actors || '');
              var keywords = threadText.split(/[·、，,。\s]/).filter(function(s){ return s.length >= 2; }).slice(0, 3);
              var hit = keywords.some(function(k) { return _recentShijiText.indexOf(k) >= 0; });
              th._status = hit ? 'approved' : 'rejected';
              th._reviewedTurn = _curTurnReview;
              if (hit) _approvedCnt++; else _rejectedCnt++;
            });
            (cm.unresolved_tensions || []).forEach(function(t) {
              if (typeof t !== 'object' || t._status !== 'pending') return;
              var tText = t.text || '';
              var tWords = tText.split(/[·、，,。\s]/).filter(function(s){ return s.length >= 2; }).slice(0, 3);
              var hit = tWords.some(function(k) { return _recentShijiText.indexOf(k) >= 0; });
              t._status = hit ? 'approved' : 'rejected';
              t._reviewedTurn = _curTurnReview;
              if (hit) _approvedCnt++; else _rejectedCnt++;
            });
            (cm.next_turn_focus || []).forEach(function(f) {
              if (typeof f !== 'object' || f._status !== 'pending') return;
              var fText = f.text || '';
              var fWords = fText.split(/[·、，,。\s]/).filter(function(s){ return s.length >= 2; }).slice(0, 3);
              var hit = fWords.some(function(k) { return _recentShijiText.indexOf(k) >= 0; });
              f._status = hit ? 'approved' : 'rejected';
              f._reviewedTurn = _curTurnReview;
              if (hit) _approvedCnt++; else _rejectedCnt++;
            });
          });
          if (_approvedCnt + _rejectedCnt > 0) {
            _dbg('[InboxReview:pre-sc1] approved=' + _approvedCnt + ' rejected=' + _rejectedCnt);
          }
        } catch(_invE) { _dbg('[InboxReview:pre-sc1] fail:', _invE); }
      }
      _reviewConsolidatedInboxForSc1();
      // ★ P12.1 state_board 注入（KokoroMemo state_renderer 范式·按 priority 排序·~1200 字预算）
      // 4 类轻量会话状态——朝堂氛围/未解线索/近期摘要/待闭环事项
      // 优先级：mood（最即时） > unfulfilled_promises（待兑现决策） > open_loops（待推进） > recent_summary（背景）
      // Phase 4·sc28 snapshot 注入 sc1 prompt 头部·上回合世界快照让 sc1 上下文连续 (G1 schema 精简时此段优先保留)
      var _sc28Inject = '';
      try {
        if (GM._lastSc28Snapshot && GM._lastSc28Snapshot.turn === (GM.turn || 1) - 1) {
          var snap = GM._lastSc28Snapshot;
          _sc28Inject += '\n=== 上回合 sc28 世界快照 (Phase 4·下回合 sc1 必读) ===\n';
          if (snap.world_snapshot) _sc28Inject += '【世界状态】' + String(snap.world_snapshot).slice(0, 800) + '\n';
          if (snap.next_turn_seeds) _sc28Inject += '【应酝酿种子】' + String(snap.next_turn_seeds).slice(0, 400) + '\n';
          if (snap.tension_level) _sc28Inject += '【紧张度】' + String(snap.tension_level).slice(0, 100) + '\n';
          _sc28Inject += '=== sc28 快照结束 ===\n\n';
        }
      } catch(_sc28InjE) { _dbg('[sc28 inject] fail:', _sc28InjE); }
      var _stateBoard = '';
      try {
        if (GM._stateBoard && typeof GM._stateBoard === 'object' && GM._stateBoard.turn === (GM.turn || 1) - 1) {
          var sb = GM._stateBoard;
          var sbLines = [];
          sbLines.push('=== 上回合 state_board（朝堂状态板·下回合主推演必读·按重要度排序） ===');
          if (sb.mood) sbLines.push('【朝堂氛围】' + sb.mood);
          if (Array.isArray(sb.unfulfilled_promises) && sb.unfulfilled_promises.length > 0) {
            sbLines.push('【待兑现决策/拟议未颁诏令·下回合应推进】');
            sb.unfulfilled_promises.forEach(function(p) { sbLines.push('  · ' + p); });
          }
          if (Array.isArray(sb.open_loops) && sb.open_loops.length > 0) {
            sbLines.push('【悬而未决线索·应在叙事中推进或回收】');
            sb.open_loops.forEach(function(l) { sbLines.push('  · ' + l); });
          }
          if (sb.recent_summary) sbLines.push('【近期摘要】' + sb.recent_summary);
          sbLines.push('=== state_board 结束 ===\n');
          _stateBoard = sbLines.join('\n') + '\n';
        }
      } catch(_sbE){ _dbg('[StateBoard inject] fail:', _sbE); }
      // ★ 上回合记忆固化（Phase 7 sc_consolidate 后台输出·密度最高·应排在最前）
      var _consolidated = '';
      try {
        if (Array.isArray(GM._consolidatedMemory) && GM._consolidatedMemory.length > 0) {
          var _lastC = GM._consolidatedMemory[GM._consolidatedMemory.length - 1];
          if (_lastC && _lastC.turn === (GM.turn || 1) - 1) {
            // 仅当上回合刚刚整合·才注入（避免重复读老条目）
            _consolidated = '\n=== 上回合记忆固化（sc_consolidate 后台输出·下回合主推演必读） ===\n';
            if (_lastC.consolidated) _consolidated += '【整合摘要】\n' + _lastC.consolidated + '\n\n';
            if (Array.isArray(_lastC.key_threads) && _lastC.key_threads.length > 0) {
              // P10.4C + P11.2C-full：rejected 不展示·approved 普通展示·pending 带 ⚠ 待验证
              var _vthreads = _lastC.key_threads.filter(function(t) { return t._status !== 'rejected'; });
              if (_vthreads.length > 0) {
                _consolidated += '【关键线索】\n' + _vthreads.map(function(t) {
                  var statusMark = '';
                  if (t._status === 'pending') statusMark = '⚠[待验证] ';
                  else if (t._status === 'approved') statusMark = '✓ ';
                  return '· ' + statusMark + '[' + (t.status||'?') + '·张力' + (t.tension||'?') + '/10] ' + (t.thread||'') + '·参与:' + (t.actors||'?') + '·下一步:' + (t.next||'?');
                }).join('\n') + '\n\n';
              }
            }
            if (Array.isArray(_lastC.npc_trajectories) && _lastC.npc_trajectories.length > 0) {
              _consolidated += '【NPC 轨迹】\n' + _lastC.npc_trajectories.map(function(n) {
                return '· ' + (n.name||'?') + '·心境:' + (n.mood||'?') + '·' + (n.arc||'') + '·对玩家:' + (n.commitment||'');
              }).join('\n') + '\n\n';
            }
            if (Array.isArray(_lastC.faction_vectors) && _lastC.faction_vectors.length > 0) {
              _consolidated += '【势力走向】\n' + _lastC.faction_vectors.map(function(f) {
                return '· ' + (f.faction||'?') + '·' + (f.trajectory||'稳定') + '·驱动:' + (f.driver||'?') + '·风险:' + (f.risk||'');
              }).join('\n') + '\n\n';
            }
            if (Array.isArray(_lastC.unresolved_tensions) && _lastC.unresolved_tensions.length > 0) {
              // P11.2C-full：rejected 不展示·approved/pending 区分标记
              var _vtensions = _lastC.unresolved_tensions.filter(function(t) {
                return typeof t === 'string' || t._status !== 'rejected';
              });
              if (_vtensions.length > 0) {
                _consolidated += '【未解张力（下回合可能引爆）】\n' + _vtensions.map(function(t) {
                  if (typeof t === 'string') return '· ' + t;
                  var sm = '';
                  if (t._status === 'pending') sm = '⚠[待验证] ';
                  else if (t._status === 'approved') sm = '✓ ';
                  return '· ' + sm + (t.text || '');
                }).join('\n') + '\n\n';
              }
            }
            if (Array.isArray(_lastC.player_reputation_drift) && _lastC.player_reputation_drift.length > 0) {
              _consolidated += '【玩家声望漂移】\n' + _lastC.player_reputation_drift.map(function(p) {
                return '· ' + (p.group||'?') + '·' + (p.direction||'稳定') + '·当前印象:' + (p.perception||'?') + '·主因:' + (p.cause||'');
              }).join('\n') + '\n\n';
            }
            if (Array.isArray(_lastC.next_turn_focus) && _lastC.next_turn_focus.length > 0) {
              // P11.2C-full：rejected 不展示·approved/pending 区分（focus 默认全部建议级）
              var _vfocus = _lastC.next_turn_focus.filter(function(f) {
                return typeof f === 'string' || f._status !== 'rejected';
              });
              if (_vfocus.length > 0) {
                _consolidated += '【下回合演绎建议（参考·非命令）】\n' + _vfocus.map(function(f) {
                  if (typeof f === 'string') return '· ' + f;
                  var sm = (f._status === 'approved') ? '✓ ' : '⚠[建议] ';
                  return '· ' + sm + (f.text || '');
                }).join('\n') + '\n';
              }
            }
            _consolidated += '=== 记忆固化结束·此段是下回合 sc1 推演的最高优先级输入 ===\n\n';
          }
        }
      } catch(_consE){ _dbg('[sc1 consolidate inject] fail:', _consE); }
      if (ctx.apply) ctx.apply._hardConstraints = _hardConstraints;
      var _sc1Prefix = _sc28Inject + _stateBoard + _consolidated + _timeRef + _futureC + _wsSnap + _memTblInj;
      try {
        if (window.TM && TM.ContextZones && typeof TM.ContextZones.packZones === 'function') {
          var _sc1ZonePacked = TM.ContextZones.packZones([
            { id:'sc28_snapshot', lane:'L3_long_term_affair', text:_sc28Inject, mustKeep:true, order:10, source:'sc28', reason:'last turn world snapshot' },
            { id:'state_board', lane:'L3_long_term_affair', text:_stateBoard, mustKeep:true, order:20, source:'state_board', reason:'last turn state board' },
            { id:'consolidated_memory', lane:'L5_advisory_context', text:_consolidated, order:30, score:0.8, source:'consolidated', reason:'last turn consolidation' },
            { id:'time_reference', lane:'L1_world_truth', text:_timeRef, mustKeep:true, order:40, source:'time_ref', reason:'turn chronology' },
            { id:'future_constraints', lane:'L2_active_law_commitment', text:_futureC, mustKeep:true, order:50, source:'future_constraints', reason:'affects future constraints' },
            { id:'world_snapshot', lane:'L1_world_truth', text:_wsSnap, mustKeep:true, order:60, source:'world_snapshot', reason:'current world truth' },
            { id:'memory_tables', lane:'L2_active_law_commitment', text:_memTblInj, mustKeep:true, order:70, source:'mem_tables', reason:'structured memory tables' }
          ], {
            maxTokens: (P && P.conf && P.conf.sc1PrefixTokenBudget) || 0,
            defaultMaxTokens: 0
          });
          _sc1Prefix = _sc1ZonePacked.text || _sc1Prefix;
          if (TM.ContextZones.recordZoneInjection) TM.ContextZones.recordZoneInjection(GM, _sc1ZonePacked, { stage:'sc1-prefix' });
        }
      } catch(_czE) { _dbg('[ContextZones sc1-prefix] fail:', _czE); }
      // DA-Q2·史记创作字段(总括/实录/时政记副标题正文总结/玩家状态)提示词改由共享 recordSpecs(ctx) 出·
      // 与 agent deepen_narrative 同源零 drift·输出须字节级不变(见 scripts/verify-recordspecs-byte-identical.js)
      var _rsSpec = TM.Endturn.AI.prompt.recordSpecs(ctx);
      var tp1 = _sc1Prefix + tp + _preAnalysis + _hardConstraints + "\n请仅返回绝JSON，包含:\n"+
        "{\"turn_summary\":\""+_rsSpec.turnSummary+"\","+
        // 实录：纯文言史官体，仿资治通鉴/历代实录
        "\"shilu_text\":\""+_rsSpec.shilu+"\","+
        // 时政记：朝政纪要体（副标题+总括+分领域因果链+总结）
        "\"szj_title\":\""+_rsSpec.szjTitle+"\","+
        "\"shizhengji\":\""+_rsSpec.shizhengji+"\","+
        "\"szj_summary\":\""+_rsSpec.szjSummary+"\","+
        // 玩家角色状态——保留(供NPC记忆系统与昏君叙事基调使用；同时会在后人戏说中自然展现)
        "\"player_status\":\""+_rsSpec.playerStatus+"\",\"player_inner\":\""+_rsSpec.playerInner+"\","+
        // 人事变动：从office_changes/title_changes/character_deaths聚合后的可读列表
        "\"personnel_changes\":[{\"name\":\"姓名\",\"former\":\"原职或原身份\",\"change\":\"变动描述\",\"reason\":\"原因(可选)\"}],"+
        "\"resource_changes\":{\"\u8D44\u6E90\u540D\":\u53D8\u5316\u91CF},\"relation_changes\":{\"\u5173\u7CFB\u540D\":\u53D8\u5316\u91CF},"+
        "\"event\":{\"title\":\"...\",\"type\":\"...\"}\u6216null,"+
        "\"npc_actions\":[{\"name\":\"\u89D2\u8272\u540D\",\"action\":\"\u505A\u4E86\u4EC0\u4E48(30\u5B57)\",\"target\":\"\u5BF9\u8C01\",\"result\":\"\u7ED3\u679C\",\"behaviorType\":\"\u884C\u4E3A\u7C7B\u578B\",\"publicReason\":\"\u5BF9\u5916\u8BF4\u8F9E\",\"privateMotiv\":\"\u771F\u5B9E\u52A8\u673A\",\"new_location\":\"\u56E0\u884C\u52A8\u8F6C\u79FB\u5230\u4F55\u5904(\u53EF\u9009)\"}],"+
        "\"affinity_changes\":[{\"a\":\"\u89D2\u8272A\",\"b\":\"\u89D2\u8272B\",\"delta\":\u53D8\u5316\u91CF,\"reason\":\"\u539F\u56E0\",\"relType\":\"blood/marriage/mentor/sworn/rival/benefactor/enemy(\u53EF\u9009\uFF0C\u65B0\u589E\u6216\u5F3A\u5316\u5173\u7CFB\u7C7B\u578B)\"}],"+
        "\"goal_updates\":[{\"name\":\"\u89D2\u8272\u540D\",\"goalId\":\"goal_1\",\"action\":\"update/add/complete/replace\",\"longTerm\":\"\u957F\u671F\u76EE\u6807(add/replace\u65F6\u5FC5\u586B)\",\"shortTerm\":\"\u5F53\u524D\u77ED\u671F\u76EE\u6807\",\"progress\":\"0-100\",\"context\":\"\u5F53\u524D\u884C\u52A8\u65B9\u5411(1\u53E5)\",\"type\":\"power/wealth/revenge/protect/knowledge/faith(add\u65F6\u5FC5\u586B)\",\"priority\":\"1-10\"}],\"character_deaths\":[{\"name\":\"角色名\",\"reason\":\"死因描述\"}],\"char_updates\":[{\"name\":\"角色名\",\"loyalty_delta\":0,\"ambition_delta\":0,\"stress_delta\":0,\"intelligence_delta\":0,\"valor_delta\":0,\"military_delta\":0,\"administration_delta\":0,\"management_delta\":0,\"charisma_delta\":0,\"diplomacy_delta\":0,\"benevolence_delta\":0,\"legitimacy_delta\":0,\"add_traits\":[\"新获得的特质id\"],\"remove_traits\":[\"失去的特质id\"],\"new_location\":\"新所在地(可选,如被贬/外派/召回)\",\"new_stance\":\"新立场(可选)\",\"new_party\":\"新党派(可选)\",\"action_type\":\"行为类型(punish/reward/betray/mercy/declare_war/reform等)\",\"reason\":\"原因\"}],\"faction_changes\":[{\"name\":\"\u52BF\u529B\u540D\",\"strength_delta\":0,\"economy_delta\":0,\"playerRelation_delta\":0,\"reason\":\"\u539F\u56E0\"}],\"party_changes\":[{\"name\":\"\u515A\u6D3E\u540D\",\"influence_delta\":0,\"new_status\":\"\u6D3B\u8DC3/\u5F0F\u5FAE/\u88AB\u538B\u5236/\u5DF2\u89E3\u6563(\u53EF\u9009)\",\"new_leader\":\"\u65B0\u9996\u9886(\u53EF\u9009)\",\"new_agenda\":\"\u65B0\u8BAE\u7A0B(\u53EF\u9009)\",\"new_shortGoal\":\"\u65B0\u77ED\u671F\u76EE\u6807(\u53EF\u9009)\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"faction_events\":[{\"actor\":\"\u52BF\u529BA\",\"target\":\"\u52BF\u529BB\u6216\u7A7A(\u5185\u653F\u4E8B\u4EF6\u53EF\u4E0D\u586Btarget)\",\"action\":\"\u5177\u4F53\u884C\u4E3A\u63CF\u8FF0(30\u5B57)\",\"actionType\":\"\u5916\u4EA4/\u5185\u653F/\u519B\u4E8B/\u7ECF\u6D4E\",\"result\":\"\u7ED3\u679C(30\u5B57)\",\"strength_effect\":0,\"geoData\":{\"routeKm\":0,\"terrainDifficulty\":0.5,\"hasOfficialRoad\":true,\"routeDescription\":\"\u7ECF\u2026\u2026\",\"passesAndBarriers\":[],\"fortLevel\":0,\"garrison\":0}}],"+
        "\"faction_ai_outcomes\":[{\"faction\":\"势力名\",\"factionId\":\"可选\",\"intent\":\"势力AI本回合意图\",\"action\":\"实际推动的行动\",\"target\":\"目标势力/地区/人物\",\"motive\":\"依据aiPersonality/aiDecisionWeights/aiConditionalBehaviors和当前局势的动机\",\"result\":\"结果\",\"publicSummary\":\"可进时政记的公开摘要\",\"posterityComment\":\"可进后人戏说的场景线索\",\"recordTarget\":\"shizhengji|houren|both|none\",\"structuralLinks\":[\"faction_events[0]\"]}],"+
        "\"faction_relation_changes\":[{\"from\":\"\u52BF\u529BA\",\"to\":\"\u52BF\u529BB\",\"type\":\"\u65B0\u5173\u7CFB\",\"delta\":\u53D8\u5316\u91CF,\"reason\":\"\u539F\u56E0\"}],"+
        "\"class_changes\":[{\"name\":\"\u9636\u5C42\u540D\",\"satisfaction_delta\":0,\"influence_delta\":0,\"new_demands\":\"\u65B0\u8BC9\u6C42(\u53EF\u9009)\",\"new_status\":\"\u65B0\u5730\u4F4D(\u53EF\u9009)\",\"partyOutcomeRef\":[{\"partyName\":\"\u515A\u6D3E\u540D\",\"outcome\":\"win/lose/blocked\"}],\"reason\":\"\u539F\u56E0\"}],"+
        "\"class_alert_responses\":[{\"alertId\":\"class:\u9636\u5C42\u540D\",\"action\":\"address/defer/partial\",\"reason\":\"\u4E3A\u4F55\u5904\u7406\u3001\u6401\u7F6E\u6216\u90E8\u5206\u5904\u7406\"}],"+
        "\"regent_decisions\":[{\"subject\":\"\u5e1d\u4f4d/\u53d7\u6444\u8005\",\"regentName\":\"\u6444\u653f\u4eba\u9009\",\"action\":\"confirm/appoint/defer/revoke/stabilize\",\"hardCeiling\":true,\"reason\":\"\u5e7c\u4e3b\u6216\u5e74\u9f84/\u5065\u5eb7\u89e6\u53d1\u6444\u653f\"}],"+
        "\"reissue_topics\":[{\"topic\":\"\u7559\u4e2d\u8bae\u9898\u539f\u6587\",\"reason\":\"\u4e3a\u4f55\u5f62\u52bf\u5df2\u53d8\u3001\u5e94\u8d77\u590d\u518d\u8bae\"}],"+
        "\"army_changes\":[{\"name\":\"\u90E8\u961F\u540D\",\"soldiers_delta\":\u5175\u529B\u53D8\u5316,\"morale_delta\":\u58EB\u6C14\u53D8\u5316,\"training_delta\":\u8BAD\u7EC3\u53D8\u5316,\"destination\":\"\u8C03\u5175\u76EE\u7684\u5730(\u53EF\u9009)\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"item_changes\":[{\"name\":\"\u7269\u54C1\u540D\",\"acquired\":true,\"owner\":\"\u65B0\u6301\u6709\u8005\",\"reason\":\"\u83B7\u5F97/\u5931\u53BB\u539F\u56E0\"}],"+
        "\"era_state_delta\":{\"socialStability_delta\":0,\"economicProsperity_delta\":0,\"centralControl_delta\":0,\"militaryProfessionalism_delta\":0},"+
        "\"global_state_delta\":{\"taxPressure_delta\":0},"+
        "\"office_changes\":[{\"dept\":\"\u90E8\u95E8\",\"position\":\"\u5B98\u804C\",\"action\":\"appoint/dismiss/promote/demote/transfer/evaluate/reform\",\"person\":\"\u4EBA\u540D\",\"reason\":\"\u539F\u56E0\",\"newDept\":\"\u65B0\u90E8\u95E8(transfer\u65F6)\",\"newPosition\":\"\u65B0\u5B98\u804C(transfer/promote\u65F6)\",\"newRank\":\"\u65B0\u54C1\u7EA7(promote/demote\u65F6)\",\"evaluator\":\"\u8003\u8BC4\u8005NPC\u540D(evaluate\u65F6\u5FC5\u586B)\",\"grade\":\"\u5353\u8D8A/\u79F0\u804C/\u5E73\u5EB8/\u5931\u804C(evaluate\u65F6)\",\"comment\":\"\u8003\u8BC4\u8BC4\u8BED(evaluate\u65F6)\",\"reformDetail\":\"\u6539\u9769\u5185\u5BB9(reform\u65F6\uFF1A\u589E\u8BBE/\u88C1\u6492/\u5408\u5E76/\u6539\u540D)\"}],"+
        "\"office_aggregate\":[{\"dept\":\"\u90E8\u95E8\u540D\",\"actualCount_delta\":\"\u5B9E\u6709\u4EBA\u6570\u53D8\u5316(+N\u9012\u8865/-N\u79BB\u804C)\",\"evaluation_summary\":{\"excellent\":0,\"good\":0,\"average\":0,\"poor\":0,\"named_excellent\":[\"\u5177\u8C61\u89D2\u8272\"],\"named_good\":[\"\u5177\u8C61\u89D2\u8272\"]},\"corruption_found\":0,\"named_corrupt\":[\"\u5177\u8C61\u8D2A\u8150\u8005\"],\"narrative\":\"\u6DF7\u5408\u53D9\u8FF0\u2014\u2014\u5177\u8C61\u89D2\u8272\u70B9\u540D+\u5176\u4F59\u7528\u6570\u5B57\"}],"+
        // 官制占位实体化——当推演涉及编辑器留的 generated:false 占位时，AI 按史料风格生成对应任职者
        "\"office_spawn\":[{\"dept\":\"部门名(与officeTree中的node.name精确匹配)\",\"position\":\"官职名(与positions[].name精确匹配)\",\"holderName\":\"按本朝代命名习惯起的真实姓名(不得重复现有角色)\",\"age\":35,\"abilities\":{\"intelligence\":60,\"administration\":65,\"military\":40,\"valor\":35,\"charisma\":55,\"diplomacy\":50,\"benevolence\":55},\"personality\":\"性格简述\",\"stance\":\"中立/君党/太子党/外戚党等\",\"loyalty\":55,\"reason\":\"为何在本回合被实体化(如'玩家下诏涉及此官''推演提及此官员')\"}],"+
        // 党派议程演进——AI 每 3-5 回合评估，基于时局变化输出
        "\"party_agenda_shift\":[{\"party\":\"党派名\",\"newAgenda\":\"新议程\",\"oldAgenda\":\"旧议程\",\"reason\":\"变化原因\",\"influence_delta\":0}],"+
        // 党派分裂——凝聚力过低或议程分歧严重时
        "\"party_splinter\":[{\"parent\":\"原党派名\",\"newName\":\"分裂出的新党派名\",\"newLeader\":\"新党派领袖\",\"members\":[\"带走的成员\"],\"ideology\":\"新派立场\",\"reason\":\"分裂原因\"}],"+
        // 党派合流——势力均衡或大势所迫
        "\"party_merge\":[{\"absorber\":\"吸收方党派\",\"absorbed\":\"被吸收党派\",\"reason\":\"合流原因\"}],"+
        // 势力继承事件——首脑死亡后触发
        "\"faction_succession\":[{\"faction\":\"势力名\",\"oldLeader\":\"旧首脑\",\"newLeader\":\"新首脑\",\"legitimacy\":70,\"stability_delta\":-10,\"disputeType\":\"正常继承/争位/篡位/内战/外戚专政\",\"narrative\":\"继承叙事\"}],"+
        // 起义前兆——酝酿期状态（流民聚集/密谋/谶语流传），不一定爆发起义
        "\"revolt_precursor\":[{\"class\":\"蓄势阶层\",\"region\":\"发生地\",\"indicator\":\"famine饥荒/landConcentration土地兼并/heavyTax苛税/corvee繁役/officialCorruption吏治腐败/propheticOmen谶纬异象/secretSociety教门密谋\",\"severity\":\"mild/severe/critical\",\"detail\":\"具体表现(如'青州连续三年旱，流民十万涌入徐州')\",\"couldLeadTo\":\"可能导致的起义类型\"}],"+
        // 阶层起义爆发——进入长周期生命周期，AI 每回合通过 revolt_update 推进
        "\"class_revolt\":[{"+
          "\"revoltId\":\"本次起义的唯一ID(如revolt_huangjin/revolt_1886)\","+
          "\"class\":\"起义阶层\","+
          "\"region\":\"起义地区(须与行政区划匹配)\","+
          "\"leaderName\":\"起义领袖姓名(按朝代命名，如张角、黄巢、李自成风格)\","+
          "\"secondaryLeaders\":[\"副将/兄弟/军师\"],"+
          "\"ideology\":\"religious宗教/dynastic光复/ethnic民族/populist民生/nobleClaim宗室分支/warlord军阀/tributary边疆\","+
          "\"organizationType\":\"flowingBandit流寇/baseArea根据地/builtState建制/secretSociety教门/militaryMutiny军变\","+
          "\"slogan\":\"口号(如'苍天已死黄天当立'、'均田免粮'、'驱除鞑虏')\","+
          "\"religiousSect\":\"宗教派别(ideology=religious时必填，如太平道/白莲教)\","+
          "\"historicalArchetype\":\"参考的历史原型(如'黄巾之乱''黄巢之乱''红巾军')\","+
          "\"scale\":\"小/中/大/滔天\","+
          "\"militaryStrength\":5000,"+
          "\"composition\":\"兵员组成(如'流民为主、饥卒为辅、少数武装乡民')\","+
          "\"supplyStatus\":50,"+
          "\"phase\":\"brewing酝酿/uprising首义/expansion扩张/stalemate相持/turning转折/decline衰落/establishment建政/ending结局\","+
          "\"demands\":[\"起义诉求\"],"+
          "\"grievances\":[\"积怨(连续三年旱灾/徭役过重/官员贪索/土地兼并)\"],"+
          "\"spreadPattern\":\"mobile流动作战/baseDefense根据地/urbanSiege攻城/cascade多点齐发\","+
          "\"reason\":\"起义导火索\""+
        "}],"+
        // 起义进展更新——AI 每回合推进阶段（类似诏令生命周期）
        "\"revolt_update\":[{"+
          "\"revoltId\":\"匹配现有 revolt 的 id\","+
          "\"newPhase\":\"新阶段(brewing→uprising→expansion→stalemate→turning→decline/establishment→ending)\","+
          "\"territoryGained\":[\"本回合占领的城/州\"],"+
          "\"territoryLost\":[\"本回合失去的\"],"+
          "\"strength_delta\":1000,"+
          "\"supplyStatus_delta\":-5,"+
          "\"absorbedForces\":[\"本回合收编的势力/降将(如'归附了张某三千人'、'收编某都尉降卒')\"],"+
          "\"externalSupport\":[\"外援(如'受契丹暗中接济粮草')\"],"+
          "\"defectedOfficials\":[\"归附的朝廷官员(他们会自动转投起义军)\"],"+
          "\"counterForces\":[\"对抗力量(如'某乡勇首领某某纠集千人抗拒')\"],"+
          "\"narrative\":\"30-120 字阶段叙事——体现历史真实感\","+
          "\"keyEvent\":\"本回合关键事件(如'攻陷长安'、'领袖受伤')\","+
          "\"leaderCasualty\":\"领袖伤亡情况(可空；如'领袖中箭负伤'、'副将战死')\""+
        "}],"+
        // 起义镇压行动——朝廷派兵/士绅乡勇/外援等对抗
        "\"revolt_suppress\":[{"+
          "\"revoltId\":\"目标起义\","+
          "\"suppressor\":\"镇压主力(官军将领/乡勇首领/异族援军)\","+
          "\"suppressorForce\":20000,"+
          "\"tactic\":\"围剿/坚壁清野/分化瓦解/利诱降服/借异族/迁徙裹挟\","+
          "\"outcome\":\"victory彻底剿灭/partial部分镇压/stalemate相持/defeat反被击溃\","+
          "\"casualties\":{\"rebel\":5000,\"official\":1500,\"civilian\":3000},"+
          "\"narrative\":\"战况叙事\""+
        "}],"+
        // 起义招安——朝廷给条件换取归顺
        "\"revolt_amnesty\":[{"+
          "\"revoltId\":\"目标起义\","+
          "\"envoy\":\"招安使节NPC\","+
          "\"terms\":\"招安条件(如'封某节度使，残部编入禁军')\","+
          "\"outcome\":\"accepted接受/rejected拒绝/split分化(部分接受部分拒绝)\","+
          "\"acceptedLeaders\":[\"接受招安的领袖\"],"+
          "\"rejectedLeaders\":[\"拒绝的顽固派\"],"+
          "\"fateOfAccepted\":\"归顺后安置(如'宋江等一十八人封武节大夫')\","+
          "\"narrative\":\"招安过程\""+
        "}],"+
        // 问对承诺进展更新——NPC 对玩家承诺任务的执行报告
        "\"commitment_update\":[{\"id\":\"承诺id(匹配GM._npcCommitments)\",\"npcName\":\"承诺者\",\"progress_delta\":10,\"status\":\"executing/completed/failed/delayed\",\"feedback\":\"执行情况叙事(30-80字，具体描述做了什么、遇到什么)\",\"consequenceType\":\"success/partial/obstructed/abandoned\",\"failReason\":\"若status=failed/delayed·为何未成:推诿/无能/被掣肘/阳奉阴违/客观受阻(不填=未知·据承办人忠诚才干心绪判)\"}],"+
        // 起义转化——建政/割据/融入他派/彻底消散
        "\"revolt_transform\":[{"+
          "\"revoltId\":\"目标起义\","+
          "\"transformType\":\"toFaction升级为独立势力/merged融入他派/coopted被招安编入/dissolved自行消散/dynastyReplaced建立新朝(玩家GAMEOVER)\","+
          "\"newFactionName\":\"新势力名(toFaction时必填)\","+
          "\"mergedInto\":\"被并入的势力名(merged时必填)\","+
          "\"finalTerritory\":\"最终控制区(toFaction时)\","+
          "\"narrative\":\"转化叙事\""+
        "}],"+
        // 势力关系动态变化
        "\"faction_relation_shift\":[{\"from\":\"势力A\",\"to\":\"势力B\",\"relation_delta\":-10,\"new_type\":\"敌对/联盟/交战/朝贡/通婚\",\"event\":\"变化事件\",\"reason\":\"原因\"}],"+
        // 党派新建——当局势催生新政治集团（非分裂自既有）
        "\"party_create\":[{\"name\":\"新党派名\",\"ideology\":\"立场\",\"leader\":\"党魁(须已存在或同时在char_updates创建)\",\"influence\":20,\"socialBase\":[{\"class\":\"阶层名\",\"affinity\":0.6}],\"currentAgenda\":\"当前议程\",\"status\":\"活跃\",\"memberCount\":15,\"cohesion\":70,\"crossFaction\":false,\"trigger\":\"触发因素(诏令/事件/人物聚集)\",\"reason\":\"崛起原因\"}],"+
        // 党派覆灭——被查禁/首领被杀/成员风流云散
        "\"party_dissolve\":[{\"name\":\"被解散党派名\",\"cause\":\"banned(查禁)/liquidated(肃清)/faded(自然消亡)/leaderKilled(领袖被杀)/absorbed(吞并他党)\",\"perpetrator\":\"主使者(可空)\",\"fatePerMember\":\"流放/下狱/归隐/转投别党\",\"reason\":\"原因\"}],"+
        // 势力新建——独立/割据/称帝/复国
        "\"faction_create\":[{\"name\":\"新势力名\",\"type\":\"主权国/藩镇/番属/起义军/宗教势力\",\"leader\":\"首脑\",\"territory\":\"控制地区\",\"parentFaction\":\"脱离自的原势力(可空)\",\"strength\":30,\"militaryStrength\":20000,\"economy\":40,\"attitude\":\"敌对\",\"playerRelation\":-30,\"cohesion\":{\"political\":50,\"military\":60,\"economic\":40,\"cultural\":50,\"ethnic\":60,\"loyalty\":50},\"triggerEvent\":\"触发事件(如:安史之乱/黄巾起义/五代更迭)\",\"reason\":\"新建原因\"}],"+
        // 势力覆灭——被灭国/吞并/解体
        "\"faction_dissolve\":[{\"name\":\"被灭势力名\",\"cause\":\"conquered(征服)/absorbed(并入)/collapsed(内部崩解)/seceded_all(分崩离析)/replaced(被取而代之)\",\"conqueror\":\"征服者势力(conquered/absorbed时必填)\",\"territoryFate\":\"territory归属(如:并入某势力/独立成多国/设郡县)\",\"leaderFate\":\"首脑下场(降/死/逃亡)\",\"refugees\":[\"出逃核心人物\"],\"reason\":\"原因\"}],"+
        // 阶层兴起——新的社会阶层出现
        "\"class_emerge\":[{\"name\":\"新阶层名\",\"size\":\"约5%\",\"mobility\":\"中\",\"economicRole\":\"商贸/军事/手工/治理\",\"status\":\"良民\",\"privileges\":\"\",\"obligations\":\"\",\"satisfaction\":50,\"influence\":15,\"demands\":\"诉求\",\"origin\":\"从哪演化来(如:军功地主自均田崩坏中兴起/士商自科举资格放开中兴起)\",\"unrestThreshold\":30,\"descriptor\":{\"stratum\":\"上/中/下\",\"fiscalStatus\":\"优免/编户/受饷/法外\",\"unrestArchetype\":\"暴烈/撤离/不合作/哗变\"},\"reason\":\"兴起原因\"}],"+
        // 阶层消亡——传统阶层衰落/被废除
        "\"class_dissolve\":[{\"name\":\"消亡阶层名\",\"cause\":\"abolished(法令废除)/assimilated(被吸收)/extincted(衰落消亡)/replaced(被新阶层取代)\",\"successorClass\":\"后继阶层(可空)\",\"membersFate\":\"成员去向(如:编入平民/降为贱籍/融入士绅)\",\"reason\":\"原因\"}],"+
        "\"vassal_changes\":[{\"action\":\"establish/break/change_tribute\",\"vassal\":\"\u5C01\u81E3\u52BF\u529B\u540D\",\"liege\":\"\u5B97\u4E3B\u52BF\u529B\u540D\",\"tributeRate\":0.3,\"reason\":\"\u539F\u56E0\"}],"+
        "\"title_changes\":[{\"action\":\"grant/revoke/inherit/promote\",\"character\":\"\u89D2\u8272\u540D\",\"titleName\":\"\u7235\u4F4D\u540D\u79F0\",\"titleLevel\":3,\"hereditary\":true,\"from\":\"\u7EE7\u627F\u6765\u6E90\u89D2\u8272(inherit\u65F6\u5FC5\u586B)\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"building_changes\":[{\"action\":\"build/upgrade/destroy/custom_build\",\"territory\":\"行政区划名\",\"type\":\"建筑名称(对应剧本buildingTypes中的name;custom_build时可为自定义名)\",\"isCustom\":false,\"description\":\"自定义建筑时必填——描述作用(AI自判合理性)\",\"level\":1,\"faction\":\"势力名\",\"costActual\":\"实际花费(两)\",\"timeActual\":\"实际工期(回合)\",\"feasibility\":\"合理/勉强/不合理\",\"judgedEffects\":\"AI判定的效果描述——写入推演叙事(如'每月增收银五百两、田亩增一成；建造期民力消耗较大，需徭役若干')\",\"reason\":\"建造原因\"}],"+
        "\"admin_changes\":[{\"action\":\"appoint_governor/remove_governor/adjust\",\"division\":\"\u884C\u653F\u533A\u540D\",\"person\":\"\u4EBA\u540D\",\"prosperity_delta\":0,\"population_delta\":0,\"corruption_delta\":0,\"stability_delta\":0,\"unrest_delta\":0,\"reason\":\"\u5730\u65B9\u5B98\u6CBB\u7406\u884C\u4E3A\u63CF\u8FF0\"}],"+
        // 中国化管辖变更：封建/削藩/改土归流/册封等历史制度动作
        "\"autonomy_changes\":[{\"action\":\"enfeoff_prince/enfeoff_duke/enfeoff_tusi/invest_tributary/establish_fanzhen/grace_edict/abolish_fief/tusi_to_liuguan/conquer_as_prefecture\",\"division\":\"行政区划名\",\"holder\":\"持爵者(enfeoff类必填)\",\"titleName\":\"爵名(如亲王/国公/宣慰使)\",\"subtype\":\"real(实封)/nominal(虚封)\",\"loyalty\":60,\"tributeRate\":0.3,\"risk\":\"rebellion/secession/stable\",\"reason\":\"原因——须与中国历史事件命名对应(推恩令/削藩/改土归流/册封/设郡等)\"}],"+
        "\"admin_division_updates\":[{\"action\":\"add/remove/rename/merge/split/reform/territory_gain/territory_loss\",\"parentDivision\":\"\u4E0A\u7EA7\u884C\u653F\u533A\u540D(add\u65F6\u5FC5\u586B)\",\"division\":\"\u884C\u653F\u533A\u540D\",\"newName\":\"\u65B0\u540D(rename\u65F6)\",\"level\":\"\u884C\u653F\u5C42\u7EA7\",\"population\":0,\"prosperity\":0,\"terrain\":\"\",\"specialResources\":\"\",\"taxLevel\":\"\u4E2D\",\"officialPosition\":\"\u4E3B\u5B98\u804C\u4F4D\",\"governor\":\"\u4E3B\u5B98\u540D\",\"description\":\"\u63CF\u8FF0\",\"mergeInto\":\"\u5408\u5E76\u76EE\u6807(merge\u65F6)\",\"splitResult\":[\"\u62C6\u5206\u540E\u540D\u79F0\u5217\u8868(split\u65F6)\"],\"lostTo\":\"\u5931\u53BB\u7ED9\u54EA\u4E2A\u52BF\u529B(territory_loss\u65F6)\",\"gainedFrom\":\"\u4ECE\u54EA\u4E2A\u52BF\u529B\u83B7\u5F97(territory_gain\u65F6)\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"harem_events\":[{\"type\":\"pregnancy/birth/death/rank_change/favor_change/scandal\",\"character\":\"\u5983\u5B50\u540D\",\"detail\":\"\u63CF\u8FF0\",\"newRank\":\"\u65B0\u4F4D\u5206id(rank_change\u65F6)\",\"favor_delta\":\"\u5BA0\u7231\u53D8\u5316\u6570\u503C(favor_change\u65F6)\"}],"+
        // 皇城宫殿变更
        "\"palace_changes\":[{\"action\":\"build/renovate/assign/ruined/abandon\",\"palace\":\"宫殿名\",\"subHall\":\"殿名(assign时必填)\",\"occupant\":\"居住者(assign时必填)\",\"previousOccupant\":\"原居者(assign/移居时)\",\"newPalace\":\"新宫殿名(build时)\",\"palaceType\":\"main_hall/imperial_residence/consort_residence/dowager/crown_prince/ceremonial/garden/office/offering(build时)\",\"costActual\":\"花费(两)\",\"timeActual\":\"工期(回合)\",\"feasibility\":\"合理/勉强/不合理\",\"judgedEffects\":\"AI判定效果(对威望/国库/民力的影响)\",\"reason\":\"原因\"}],"+
        // NPC 互动（人物间多样化关系演进）
        "\"npc_interactions\":[{"+
          "\"type\":\"recommend举荐/impeach弹劾/petition_jointly联名上书/form_clique结党/private_visit私访/invite_banquet宴请/gift_present馈赠/correspond_secret密信/confront对质/mediate调和/frame_up构陷/expose_secret揭发/marriage_alliance联姻/master_disciple师徒缔结/duel_poetry诗文切磋/share_intelligence通风报信/betray背叛/reconcile和解/mourn_together共哀/rival_compete竞争/guarantee担保/slander诽谤\","+
          "\"actor\":\"发起者角色名\","+
          "\"target\":\"对象角色名\","+
          "\"involvedOthers\":[\"涉及的第三方角色\"],"+
          "\"description\":\"具体行为描述(20-60字)\","+
          "\"publicKnown\":true,"+
          "\"evidence\":\"书信/当庭/密会/宴饮/私室/朝堂/书院\","+
          "\"reason\":\"动机\""+
        "}],"+
        // 势力深度互动（中国政治史典型）
        "\"faction_interactions_advanced\":[{"+
          "\"type\":\"military_aid军援/trade_embargo禁运/open_market互市/send_envoy遣使/demand_tribute索贡/pay_tribute献贡/royal_marriage和亲/send_hostage质子/cultural_exchange文化交流/religious_mission宗教使节/proxy_war代理战争/incite_rebellion煽动叛乱/spy_infiltration派细作/assassin_dispatch派刺客/border_clash边境冲突/declare_war宣战/sue_for_peace请和/annex_vassal并吞/recognize_independence承认独立/form_confederation结盟/break_confederation毁约/gift_treasure赠宝/pay_indemnity赔款\","+
          "\"from\":\"势力A\","+
          "\"to\":\"势力B\","+
          "\"viaProxy\":\"第三方代理势力(proxy_war时填)\","+
          "\"terms\":\"具体条款\","+
          "\"tributeItems\":\"贡物清单(tribute时)\","+
          "\"marriageDetails\":\"XX公主嫁YY王(marriage时)\","+
          "\"hostageDetails\":\"XX子入质(hostage时)\","+
          "\"treatyType\":\"条约类型(盟好/称臣/停战/互不侵犯)\","+
          "\"description\":\"完整描述\","+
          "\"durationTurns\":10,"+
          "\"reason\":\"政治/经济/军事动因\""+
        "}],"+
        // 文事作品（诗词文赋画等，AI按触发源+境遇+人物条件判断是否生成）
        "\"cultural_works\":[{"+
          "\"author\":\"作者角色名\","+
          "\"turn\":" + GM.turn + ","+
          "\"date\":\"具体日期/时节(如'元丰五年七月')\","+
          "\"location\":\"创作地点(如'黄州赤壁'/'京师翰林院'/'岭南谪所')\","+
          "\"triggerCategory\":\"career/adversity/social/duty/travel/private/times/mood (8大类)\","+
          "\"trigger\":\"具体触发源(如seeking_official干谒/pass_exam登科/demoted_exile被贬/mourning_parent丁忧/farewell_friend送别/banquet宴饮/imperial_order应制/visit_temple访寺/travel_scenery游山/war_outing出征/disaster_famine灾荒/casual_mood闲情等)\","+
          "\"motivation\":\"spontaneous自发/commissioned受命/flattery干谒/response酬答/mourning哀悼/critique讽谕/celebration颂扬/farewell送别/memorial纪念/ghostwrite代笔/duty应制/self_express自抒\","+
          "\"lifeStage\":\"early_seeking/young_official/mid_career/exiled/mourning/retired/elder\","+
          "\"genre\":\"shi诗/ci词/fu赋/qu曲/ge歌行/wen散文/apply应用文(表书檄露布)/ji记叙文(游记楼记笔记)/ritual祭文碑铭/paratext序跋\","+
          "\"subtype\":\"具体体式(如'七言绝句'/'念奴娇'/'前出师表'/'岳阳楼记'/'干谒投赠诗')\","+
          "\"title\":\"作品题目\","+
          "\"content\":\"【必须全文真实生成】绝句20/绝28字/律诗40/56字/词按词牌字数/赋300-800/文200-600字。严格匹配作者性格+学识+境遇+地点+时代文风，古文忌现代词汇，格律诗尽力平仄对仗\","+
          "\"mood\":\"豪放/悲怆/闲适/讽刺/追思/感怀/咏物/绮丽/清雅/凄苦/豁达 等\","+
          "\"theme\":\"山水纪行/怀古咏史/送别/应制/讽谕/咏物/羁旅/闺怨/田园/边塞/悼亡/求仕干谒/言志抒怀 等\","+
          "\"elegance\":\"refined雅/vernacular俗/mixed兼融\","+
          "\"dedicatedTo\":[\"赠答对象角色名数组(可空)\"],"+
          "\"inspiredBy\":\"次韵或酬答的源作id(可空)\","+
          "\"commissionedBy\":\"委托人角色名(motivation=ghostwrite/commissioned时必填)\","+
          "\"praiseTarget\":\"颂扬对象(若有)\","+
          "\"satireTarget\":\"讽刺对象(若有;讽谕政治时务必填)\","+
          "\"quality\":\"0-100综合质量(AI据作者智慧学识+心境+主题相性自判)\","+
          "\"politicalImplication\":\"政治暗讽/隐含立场描述(可空;讽谏时必填)\","+
          "\"politicalRisk\":\"low/medium/high（高者易招诗狱）\","+
          "\"narrativeContext\":\"30-80字创作背景叙述——让玩家明白此作因何而作\","+
          "\"preservationPotential\":\"low/medium/high(能否传世,视质量/题材/境遇)\""+
        "}],"+
        "\"tech_civic_unlocks\":[{\"name\":\"\u79D1\u6280\u6216\u653F\u7B56\u540D\",\"type\":\"tech/civic\",\"reason\":\"\u89E3\u9501\u539F\u56E0\"}],"+
        "\"policy_changes\":[{\"action\":\"add/remove\",\"name\":\"\u56FD\u7B56\u540D\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"scheme_actions\":[{\"schemer\":\"\u53D1\u8D77\u8005\u540D\",\"action\":\"advance/disrupt/abort/expose\",\"reason\":\"\u539F\u56E0\"}],"+
        "\"timeline_triggers\":[{\"name\":\"\u65F6\u95F4\u7EBF\u4E8B\u4EF6\u540D\",\"result\":\"\u5B9E\u9645\u53D1\u751F\u60C5\u51B5\"}],"+
        "\"edict_feedback\":[{\"content\":\"\u8BCF\u4EE4\u5185\u5BB9\u6458\u8981\",\"assignee\":\"\u8D1F\u8D23\u6267\u884C\u7684\u5B98\u5458\u540D(\u5FC5\u586B)\",\"status\":\"executing/completed/obstructed/partial/pending_delivery(\u4FE1\u4F7F\u5728\u9014\u5C1A\u672A\u9001\u8FBE)\",\"feedback\":\"\u6267\u884C\u60C5\u51B5\u8BE6\u7EC6\u63CF\u8FF0\u2014\u2014\u8C01\u505A\u4E86\u4EC0\u4E48\u3001\u8FDB\u5C55\u5982\u4F55\u3001\u906D\u9047\u4EC0\u4E48\u963B\u529B\u3001\u4E3A\u4EC0\u4E48\u53D7\u963B\",\"progressPercent\":50}],"+
        // 诏令生命周期更新——AI每回合推进诏令的阶段状态，按中国施政真实模型
        "\"edict_lifecycle_update\":[{"+
          "\"edictId\":\"诏令ID——本回合新诏令必须取自上方【本回合诏令】列表中的tracker.id；延续推演的诏令必须用上方【生命周期推演中的诏令】列表中的已有id，不得凭空生成新id\","+
          "\"edictType\":\"amnesty大赦/reward封赏/personnel人事/tax_reduction减赋/tax_increase加征/admin_reform行政改革/economic_reform经济改革/military_mobilize军事动员/diplomacy对外/imperial_ritual巡幸祭祀/criminal_justice刑狱/education_culture文教\","+
          "\"stage\":\"drafting草拟/review审议/promulgation颁布/transmission传达/interpretation地方解读/execution执行/feedback反馈/adjustment调整/sedimentation沉淀\","+
          "\"reformPhase\":\"pilot试点/expand局部推广/national全国推广/backlash反扑/outcome定局(改革类必填)\","+
          "\"stageProgress\":0.5,"+
          "\"executor\":\"督办者角色名\","+
          "\"executorEffectiveness\":0.85,"+
          "\"classesAffected\":{\"士绅\":{\"impact\":-10,\"resistance\":70},\"农民\":{\"impact\":+8,\"resistance\":10}},"+
          "\"factionsAffected\":{\"契丹\":{\"relation_delta\":-5,\"attitude_shift\":\"hostile\",\"reason\":\"对此诏令的反应\"}},"+
          "\"partiesAffected\":{\"东林党\":{\"influence_delta\":-8,\"agenda_impact\":\"反对/支持/不关心\",\"reason\":\"态度依据\"}},"+
          "\"resistanceDescription\":\"阻力来源与形态描述(如'江南士绅联名抗税，地方胥吏怠工截留')\","+
          "\"currentEffects\":{\"stateTreasury\":-50000,\"民心_江南\":-5},"+
          "\"unintendedConsequences\":\"意外后果(如'户部对账发现库银实际仅入库一半，其余被胥吏截留')\","+
          "\"pilotRegion\":\"试点地名(改革类必填)\","+
          "\"expansionRegions\":[\"已推广地区\"],"+
          "\"oppositionLeaders\":[\"反对派核心人物\"],"+
          "\"supporters\":[\"核心支持者\"],"+
          "\"nextStageETA\":2,"+
          "\"canPlayerIntervene\":true,"+
          "\"interventionOptions\":[\"加派干吏督办\",\"暂缓一州\",\"放弃\",\"更严苛执行\"],"+
          "\"narrativeSnippet\":\"30-80字本阶段叙事——体现程序感和阻力感\""+
        "}],"+
        "\"npc_letters\":[{\"from\":\"\u89D2\u8272\u540D(\u5FC5\u987B\u662F\u4E0D\u5728\u4EAC\u57CE\u7684NPC)\",\"type\":\"report/plea/warning/personal/intelligence\",\"urgency\":\"normal/urgent/extreme\",\"content\":\"\u4FE1\u4EF6\u5185\u5BB9(100-200\u5B57\u53E4\u5178\u4E2D\u6587)\",\"suggestion\":\"\u53EF\u64CD\u4F5C\u7684\u5EFA\u8BAE\u6458\u8981(1-2\u53E5\u2014\u2014\u5982'\u8BF7\u6C42\u589E\u63F4\u4E09\u5343\u5175\u9A6C'\u3001'\u5EFA\u8BAE\u51CF\u514D\u6CB3\u5317\u8D4B\u7A0E'\u2014\u2014\u53EF\u9009\uFF0Cpersonal\u7C7B\u578B\u53EF\u4E0D\u586B)\",\"replyExpected\":true}],"+
        "\"npc_correspondence\":[{\"from\":\"\u53D1\u4FE1NPC\",\"to\":\"\u6536\u4FE1NPC\",\"content\":\"\u4FE1\u4EF6\u5185\u5BB9(50-150\u5B57)\",\"summary\":\"\u4E00\u53E5\u8BDD\u6982\u62EC\",\"implication\":\"\u5BF9\u5C40\u52BF\u7684\u6F5C\u5728\u5F71\u54CD\",\"type\":\"secret/alliance/conspiracy/routine\"}],"+
        "\"route_disruptions\":[{\"route\":\"\u8D77\u70B9-\u7EC8\u70B9\",\"reason\":\"\u963B\u65AD\u539F\u56E0(\u6218\u4E71/\u6D2A\u6C34/\u53DB\u519B\u5360\u636E)\",\"resolved\":false}],"+
        "\"foreshadowing\":[{\"action\":\"plant/resolve\",\"content\":\"\u4F0F\u7B14\u5185\u5BB9\",\"type\":\"threat/opportunity/mystery/romance\",\"resolveCondition\":\"\u56DE\u6536\u6761\u4EF6(plant\u65F6\u586B)\"}],"+
        "\"current_issues_update\":[{\"action\":\"add/resolve/update\",\"title\":\"\u65F6\u653F\u8BAE\u9898\u6807\u9898(\u5982:\u6CB3\u5317\u5175\u997F\u62D6\u6B20\u3001\u6C34\u5229\u5E74\u4E45\u5931\u4FEE\u3001\u67D0\u5DDE\u523A\u53F2\u8D2A\u8150\u88AB\u52BE)\",\"category\":\"\u519B\u653F/\u8D22\u8D4B/\u6C34\u5229/\u5409\u51F6/\u8FB9\u9632/\u5F62\u52BF/\u4EBA\u4E8B/\u6C11\u751F\",\"description\":\"\u534A\u6587\u8A00200-500\u5B57\uFF0C\u7ED3\u5408\u63A8\u6F14\u5B9E\u9645\u7EC6\u5316\u63CF\u8FF0\u5177\u4F53\u65F6\u653F\u95EE\u9898\u7684\u6765\u7531\u3001\u6D89\u53CA\u4EBA\u7269\u3001\u5F53\u524D\u6001\u52BF\",\"id\":\"\u66F4\u65B0/\u89E3\u51B3\u65F6\u586B\u5DF2\u6709\u8981\u52A1id\"}],"+
        "\"character_memory_updates\":[{\"actor\":\"NPC name\",\"memory_type\":\"commitment/belief/relationship/preference/grudge/favor/fear/intention/reputation\",\"memory\":\"one concrete actor-scoped memory; no hard_state\",\"private\":false,\"confidence\":0.7,\"source_refs\":[{\"type\":\"jishiRecords/courtRecords/events/edictTracker\",\"id\":\"source id\"}]}],"+
        "\"map_changes\":{\"ownership_changes\":[],\"development_changes\":[]},"+
        // ═══ AI 至高权力·v2 新增语义通道（可选·按需使用）═══
        // char_updates 条目可混搭传统 delta 字段 + 以下扩展字段：
        "\"char_updates\":[{\"name\":\"角色名(必填)\",\"loyalty_delta\":0,\"ambition_delta\":0,\"new_location\":\"简单改位置\",\"updates\":{\"officialTitle\":\"新官职\",\"title\":\"新头衔\",\"age\":45,\"任何字段\":\"任何值\"},\"careerEvent\":{\"title\":\"新职\",\"dept\":\"部门\",\"action\":\"appoint/dismiss/transfer\",\"reason\":\"原因\",\"summary\":\"仕途概要(会附加到 ch.careerHistory)\"},\"travelTo\":{\"toLocation\":\"目的地\",\"estimatedDays\":30,\"reason\":\"赴任/召回/出使\",\"assignPost\":\"到达后就任的官职(可选)\"}}],"+
        // 任命+走位（若 toLocation ≠ ch.location 会自动启动走位·到期自动就任）
        "\"office_assignments\":[{\"name\":\"角色名\",\"post\":\"职位\",\"dept\":\"部门\",\"action\":\"appoint/dismiss/transfer\",\"concurrent\":false,\"fromLocation\":\"原地(可选)\",\"toLocation\":\"任职地(不同于原地则走位)\",\"estimatedDays\":30,\"reason\":\"原因；若为兼职/兼任/加兼须写明并置 concurrent:true\"}],"+
        // 岁入岁出动态增删（派人经商、大工程、新税目等）
        "\"fiscal_adjustments\":[{\"action\":\"add/update/stop/remove\",\"target\":\"guoku/neitang/province:某省\",\"kind\":\"income/expense\",\"resource\":\"money/grain/cloth\",\"category\":\"商贸/工程/赈济/军饷/杂税\",\"name\":\"项目名(如:派郑和下西洋商队)\",\"amount\":50000,\"reason\":\"依据/推演得出\",\"recurring\":true,\"stopAfterTurn\":null}],"+
        // 专题政策动作：只记录 AI 明确推出的硬政策，applier 会经 EdictParser 复用诏令政务桥落账
        "\"currency_adjustments\":[{\"action\":\"ban_private_mint/issue_paper/abolish_paper/debase_coin\",\"paperName\":\"会子/宝钞(可选)\",\"coinType\":\"copper/silver/iron/gold(可选)\",\"amount\":1000000,\"reserveRatio\":0.3,\"reason\":\"依据\"}],"+
        "\"population_adjustments\":[{\"action\":\"purge_hidden/resettle_refugees/baojia_setup/recount\",\"region\":\"地区(可选)\",\"amount\":0,\"reason\":\"依据\"}],"+
        "\"central_local_actions\":[{\"action\":\"transfer_to_region/force_levy/dispatch_censor/set_region_allocation\",\"region\":\"地区\",\"amount\":50000,\"qiyunRatio\":0.7,\"cunliuRatio\":0.3,\"purpose\":\"disaster_relief/military_funding/regional_support\",\"reason\":\"依据\"}],"+
        "\"environment_actions\":[{\"action\":\"ban_logging/dredge/reclaim/fallow/open_waste\",\"region\":\"地区\",\"policyId\":\"可选\",\"reason\":\"依据\"}],"+
        "\"institution_changes\":[{\"action\":\"create/abolish\",\"name\":\"制度或官司名\",\"rank\":5,\"duties\":\"职责\",\"reason\":\"依据\"}],"+
        // 问天 directive 合规回报（若有 directive 则必填，逐条回报）
        "\"directive_compliance\":[{\"id\":\"dir_xxx\",\"status\":\"followed|partial|ignored\",\"reason\":\"若非 followed 说明原因\",\"evidence\":\"引用 zhengwen/events/npc_actions 中体现遵守的具体片段 30-80 字\"}],"+
        // 势力/党派/阶层/区划任意字段修改（补充既有 xxx_changes 的不足）
        "\"faction_updates\":[{\"name\":\"势力名\",\"updates\":{\"任何字段\":\"任何值\"}}],"+
        "\"party_updates\":[{\"name\":\"党派名\",\"updates\":{\"任何字段\":\"任何值\"}}],"+
        "\"class_updates\":[{\"name\":\"阶层名\",\"updates\":{\"任何字段\":\"任何值\"}}],"+
        "\"region_updates\":[{\"id或name\":\"行政区划\",\"updates\":{\"任何字段\":\"任何值\"}}],"+
        // 长期工程/商队/学堂·跨回合追踪
        "\"project_updates\":[{\"name\":\"工程名\",\"type\":\"工程/商队/学堂/道路/造船\",\"status\":\"planning/active/completed/abandoned\",\"cost\":10000,\"progress\":30,\"leader\":\"负责人\",\"region\":\"地点\",\"description\":\"概述\",\"endTurn\":50}],"+
        // 兜底·可用 dotted.path 改任意字段（除禁区：P.ai P.conf GM.saveName turn/year/month/day/sid _开头）
        "\"anyPathChanges\":[{\"path\":\"GM.任意嵌套路径\",\"op\":\"set/push/delta/merge/delete\",\"value\":\"值\",\"reason\":\"原因\"}]," +
        // ★ 12 表结构化记忆增量更新（Phase 5.3 修 OpenAI response_format='json_object' 屏蔽 <tableEdit> 的致命 bug）
        "\"table_updates\":[{\"sheet\":\"courtNpc/charProfile/edictsActive/specialMeans/importantItems/organizations/importantPlaces/relationNet/curStatus 之一\",\"op\":\"insert/update/delete\",\"rowIdx\":\"update/delete 时填行号\",\"values\":{\"colIdx数字\":\"值\"}}]," +
        // ★ P11.2B 诏令冲突链（KokoroMemo graph.py 范式·8 边类型缩为 4 种）
        "\"edict_relations\":[{\"from\":\"诏令编码或简称(如 T15-E03 / 盐法)\",\"to\":\"另一诏令编码或简称\",\"type\":\"supersedes/contradicts/continues/elaborates\",\"reason\":\"为何这样关联(40字)\"}]" +
        "}";
      // SC1 只负责结构化账本；实录/时政记交给 sc1d 专项成文，避免主推演同时承载长文本。
      try {
        tp1 = tp1.replace(/"turn_summary":"[^"]*",\s*"shilu_text":"[\s\S]*?",\s*"szj_title":"[\s\S]*?",\s*"shizhengji":"[\s\S]*?",\s*"szj_summary":"[\s\S]*?",/,
          '"turn_summary":"一句话概括本回合最重要的结构化变化(30-80字)","shizhengji_basis":"供史官成文的事实底稿(80-180字)：只列玩家诏令、奏疏批复、问对朝议、财政军政人事地块势力变化，不写长篇时政记",');
      } catch(_sc1NarrativeSplitE) {}
      // 注入待追踪诏令（让AI知道本回合有哪些诏令需要反馈）
      if (GM._edictTracker) {
        // Phase 2.5·sc1q 对话承诺紧贴 edicts·平级注入
        try {
          var _sc1qOut = (ctx && ctx.results && ctx.results.sc1q) || null;
          if (_sc1qOut && Array.isArray(_sc1qOut.dialogue_commitments) && _sc1qOut.dialogue_commitments.length > 0) {
            tp1 += '\n\n【本回合对话承诺·sc1q 推演输出·与诏令同等权重·必须推演】\n';
            tp1 += '  ※ 这些是玩家通过对话/朝议/常朝/廷议/御前/鸿雁/朱批下达的命令·NPC 当面承诺·必须在本回合 npc_actions / char_updates / events 中体现\n';
            tp1 += '  ※ 反馈时(dialogue_commitment_feedback)务必回带该承诺的 source_conv_id 与 category 原值·供落地按类归结构化后果(查办降腐/理财提征/密查入情报)\n';
            _sc1qOut.dialogue_commitments.slice(0, 12).forEach(function(dc) {
              if (!dc || !dc.npc) return;
              tp1 += '  · [' + (dc.source_type || '?') + '] ' + dc.npc + '·允诺：' + String(dc.task||'').slice(0, 80);
              if (dc.deadline) tp1 += '·限：' + dc.deadline;
              tp1 += '·意愿' + (Math.round((dc.willingness || 0.5) * 100)) + '%';
              if (dc.category) tp1 += '·类别:' + dc.category;
              if (dc.source_conv_id) tp1 += '·convId:' + dc.source_conv_id;
              if (dc.required_npc_action) tp1 += '·必须出现的行动：' + String(dc.required_npc_action).slice(0, 60);
              tp1 += '\n';
            });
          }
          if (_sc1qOut && Array.isArray(_sc1qOut.collective_resolutions) && _sc1qOut.collective_resolutions.length > 0) {
            tp1 += '\n【本回合朝议/常朝/廷议 决议·sc1q 推演输出】\n';
            _sc1qOut.collective_resolutions.slice(0, 8).forEach(function(cr) {
              if (!cr || !cr.topic) return;
              tp1 += '  · [' + (cr.forum || '?') + '] ' + cr.topic + ' → ' + String(cr.decision||'').slice(0, 80);
              if (cr.adopted_by_emperor) tp1 += '·已采纳';
              if (Array.isArray(cr.required_actions) && cr.required_actions.length) tp1 += '·承办：' + cr.required_actions.slice(0,3).join('；');
              tp1 += '\n';
            });
          }
          // 【Q2 闭环·注入】往期未结朝议决议喂回 SC1·让决议不止本回合一次性·须承接跟进(否则决而不行)。
          try {
            if (Array.isArray(GM._courtResolutions) && GM._courtResolutions.length) {
              var _curTcr = GM.turn || 1;
              var _pendCR = GM._courtResolutions.filter(function(r){ return r && (r.status === 'pending' || r.status === 'stalled') && r.turn < _curTcr; }).slice(-6);
              if (_pendCR.length) {
                tp1 += '\n【往期未结朝议决议·须承接跟进】\n';
                tp1 += '  ※ 若本回合已落实请在 court_resolution_feedback:[{"id":"决议id","status":"resolved","note":"如何落实(30字)"}] 标 resolved·仍受阻则 status:"stalled"+note 说明梗阻·勿凭空\n';
                _pendCR.forEach(function(r){
                  tp1 += '  · [id=' + (r.id || '?') + '·T' + r.turn + '·' + (r.forum || '?') + '] ' + String(r.topic || '').slice(0, 40) + ' → ' + String(r.decision || '').slice(0, 60);
                  if (Array.isArray(r.requiredActions) && r.requiredActions.length) tp1 += '·承办：' + r.requiredActions.slice(0, 3).join('；');
                  if (r.status === 'stalled') tp1 += '（前报梗阻）';
                  tp1 += '\n';
                });
              }
            }
          } catch(_crInjE) {}
          // 第一刀·补注入 sc1q 语气层(mood/subtext)——替代被摘要化的问对全文·保推演与叙事的语气依据
          if (_sc1qOut && Array.isArray(_sc1qOut.npc_dialogue_intent) && _sc1qOut.npc_dialogue_intent.length > 0) {
            tp1 += '\n【本回合 NPC 对话语气·sc1q 推演输出·供推演与叙事还原语气】\n';
            _sc1qOut.npc_dialogue_intent.slice(0, 12).forEach(function(di) {
              if (!di || !di.npc) return;
              tp1 += '  · ' + di.npc;
              if (di.mood) tp1 += '·情绪：' + di.mood;
              if (di.subtext) tp1 += '·潜台词：' + String(di.subtext).slice(0, 50);
              if (di.next_likely_move) tp1 += '·下一步：' + String(di.next_likely_move).slice(0, 40);
              tp1 += '\n';
            });
          }
        } catch(_sc1qInjE) { _dbg('[sc1q inject] fail', _sc1qInjE); }
        var _pendingEdicts = GM._edictTracker.filter(function(e) { return e.turn === GM.turn && e.status === 'pending' && !e._offTreeAppoint; });   // 官制树 UI 任命不交 AI 识别(确定性落地·见 tm-endturn-apply)·仅手打诏令走 AI·2026-07-01
        if (_pendingEdicts.length > 0) {
          // 按内政/外交分类注入
          var _domesticEdicts = _pendingEdicts.filter(function(e){ return !e._crossFaction; });
          var _diplomaticEdicts = _pendingEdicts.filter(function(e){ return e._crossFaction; });
          if (_domesticEdicts.length > 0) {
            tp1 += '\n\n【本回合内政诏令——每条必须在edict_feedback中逐条报告执行情况，填写assignee和feedback】\n';
            _domesticEdicts.forEach(function(e) {
              tp1 += '  【' + e.category + '】' + e.content;
              if (e._deliveryStatus === 'sending' && e._remoteTargets) {
                tp1 += ' ⚠信使在途→' + e._remoteTargets.join('、') + '（远方NPC尚未收到，status应为pending_delivery）';
              }
              tp1 += '\n';
            });
          }
          // 前议追责·涵盖常朝/廷议/御前所有玩家正式裁决·三回合后到期复盘
          // 让 AI 据 outcome + venue 自主演绎(narrative + NPC actions + 角色/党派 deltas)
          if (Array.isArray(GM._ty3_pendingReviewForPrompt) && GM._ty3_pendingReviewForPrompt.length > 0) {
            tp1 += '\n\n【前议追责·三回合前诏命到期——必须在 narrative + npc_actions 中演绎·并自主裁量数值反馈·不写死】\n';
            tp1 += '  ※ 涵盖范围：\n';
            tp1 += '    廷议诏令 → 朝野公开议论·派系格局变动·政敌/同党反应明显\n';
            tp1 += '    常朝诏令 → 寻常政务回响·有司奉行/抵制·言官跟疏\n';
            tp1 += '    亲诏(常朝玩家口述) → 比常朝更显君威·失败时损耗皇权更大\n';
            tp1 += '    御前密议 → 反响隐晦·走密室路线·泄密则成大案\n';
            tp1 += '  ※ 此为叙事种子·outcome 已系统判定·朝野反响与具体数值变化由你(AI)裁量：\n';
            tp1 += '    1·narrative 中铺陈反响：颂德/弹劾/民议/党狱/异象 等·依 outcome 烈度而定\n';
            tp1 += '    2·char_updates 给 主奏者/党首/承办者 发 prestige/loyalty/stress/favor 增减(必须有合理 reason)\n';
            tp1 += '    3·party_* 给 主奏党 发 cohesion/influence 调整(若 fulfilled 可+·若 backfire 可大-)\n';
            tp1 += '    4·event 段可补「颂德立祠」「言官追疏」「民间立碑」「党狱兴起」等\n';
            tp1 += '    5·npc_actions 中相关党派党首/政敌/承办者应有反应行动\n';
            tp1 += '  ※ 量级参考(可上下浮动·按党派 influence/角色 prestige 体量)：\n';
            tp1 += '    准奏果验(fulfilled) → 主奏者+5~8 prestige·主奏党 cohesion+3~6·政敌党 cohesion-2~5\n';
            tp1 += '    行而未尽(partial) → 中性·或 ±1~2 微调·可不动\n';
            tp1 += '    奉行不力(unfulfilled) → 主奏者-5~10 prestige·主奏党 cohesion-5~10·言官追疏\n';
            tp1 += '    适得其反(backfire) → 主奏者-10~20 prestige·-5~15 favor·主奏党 cohesion-10~20 影响-3~8·民心-·可能下狱/贬谪\n';
            tp1 += '  ※ 不可仅写 narrative 而无 deltas·亦不可硬套量级·须按当事人能力/党派强弱酌情\n';
            GM._ty3_pendingReviewForPrompt.forEach(function(rv) {
              var line = '  · ' + (rv.venueType ? '['+rv.venueType+']' : '') + '「' + (rv.content||'').slice(0, 50) + '」·';
              if (rv.proposerParty) line += rv.proposerParty + '所主·';
              if (rv.assigneeName) line += '承办：' + rv.assigneeName + '·';
              if (rv.leaderName) line += '党首：' + rv.leaderName + '·';
              line += '此回合议结：【' + (rv.histLabel || rv.label) + '】(' + rv.outcome + ')';
              tp1 += line + '\n';
            });
            tp1 += '\n';
          }
          if (_diplomaticEdicts.length > 0) {
            tp1 += '\n\n【本回合外交文书·对他势力——此非内政诏令·对方非本朝臣属·未必奉诏】\n';
            tp1 += '  ※ 对方势力有独立的君主/国策/宗教/敌友关系·可能：(1) 接受但变通执行 (2) 敷衍推诿 (3) 明确拒绝 (4) 反唇相讥甚至兴兵 (5) 暂缓答复以观望\n';
            tp1 += '  ※ 依势力对本朝 relation/attitude/militaryStrength 与议题内容择合理回应·不可如内政般"执行→反馈"·应按外交逻辑回报\n';
            tp1 += '  ※ edict_feedback 的 status 用 executing/partial/obstructed 映射外交层级（受理/半允/拒绝）·feedback 写对方朝堂/酋长/酋使的实际回应态度\n';
            tp1 += '  ※ 连带反映到 faction_updates（relation_delta/attitude_shift 等）·必要时触发 factionsAffected/revolt_update/map_changes\n';
            _diplomaticEdicts.forEach(function(e) {
              tp1 += '  【' + e.category + '】致' + (e._targetFactions||[]).join('·') + '：' + e.content;
              if (e._targetNpcs && e._targetNpcs.length) tp1 += ' (目标人物: ' + e._targetNpcs.join('、') + ')';
              if (e._deliveryStatus === 'sending' && e._remoteTargets) {
                tp1 += ' ⚠使节在途→' + e._remoteTargets.join('、') + '（尚未送达·status应为pending_delivery）';
              }
              tp1 += '\n';
            });
          }
        }
        // ═══ 长期诏令连带·跨回合·AI 须交代进展 ═══
        // 包括：前回合未完成(executing/partial/obstructed)、本回合刚下延续(pending_delivery)的诏令
        // 要求 AI 在 edict_feedback 中对这些"旧诏"也给出进展或连锁效应
        var _longLivingEdicts = GM._edictTracker.filter(function(e) {
          if (e.turn >= GM.turn) return false;
          if (!e.status) return true;
          return e.status === 'executing' || e.status === 'partial' || e.status === 'obstructed' || e.status === 'pending_delivery';
        });
        if (_longLivingEdicts.length > 0) {
          tp1 += '\n【跨回合持续诏令——前回合下的诏令尚未收束，本回合必须在 edict_feedback 中追报进展+连锁效应】\n';
          _longLivingEdicts.slice(0, 12).forEach(function(e) {
            var age = GM.turn - e.turn;
            tp1 += '  #id=' + e.id + ' 【' + e.category + ' · ' + age + '回合前】' + e.content.slice(0, 80);
            tp1 += ' / 上次状态:' + (e.status || 'pending');
            if (e.assignee) tp1 += ' / 执行者:' + e.assignee;
            if (e.progressPercent) tp1 += ' / 进度:' + e.progressPercent + '%';
            if (e.feedback) tp1 += '\n     上回反馈：' + e.feedback.slice(0, 120);
            if (e._chainEffects && e._chainEffects.length) {
              tp1 += '\n     已记连锁：' + e._chainEffects.slice(-3).map(function(ce){return ce.effect;}).join('；');
            }
            tp1 += '\n';
          });
          tp1 += '  ※ edict_feedback 里对旧诏令须给出：当下进展 / 新增连锁效应（NPC 反应 / 财政余波 / 民心涟漪）/ 下一步动向\n';
          tp1 += '  ※ 连锁效应示例："辽饷加派"三回合后——民心持续下降·陕北流民骤增·边军哗饷已歇；"免除江南赋税"——地方士绅感恩·中央税入骤降·其他州县请援\n';
          tp1 += '  ※ 连锁效应必须同步反映到 数值变化（fiscal_adjustments/class_updates/region_updates 等）·不能只是文字\n';
        }
        // 往期在途诏令——信使已送达的，提醒AI该NPC现在知道了
        var _priorRemote = (GM._edictTracker||[]).filter(function(e) {
          return e.turn < GM.turn && e._letterIds && e._letterIds.length > 0;
        });
        if (_priorRemote.length > 0) {
          var _deliveredThisTurn = [];
          var _stillTransit = [];
          _priorRemote.forEach(function(e) {
            (e._letterIds||[]).forEach(function(lid) {
              var lt = (GM.letters||[]).find(function(l){ return l.id === lid; });
              if (!lt) return;
              if (lt.status === 'delivered' || lt.status === 'returned' || lt.status === 'replying') {
                _deliveredThisTurn.push({ edict: e, letter: lt });
              } else if (lt.status === 'traveling') {
                _stillTransit.push({ edict: e, letter: lt });
              } else if (lt.status === 'intercepted') {
                _stillTransit.push({ edict: e, letter: lt, lost: true });
              }
            });
          });
          if (_deliveredThisTurn.length > 0) {
            tp1 += '\n【往期诏令已送达——以下NPC已收到命令，应在本回合开始执行】\n';
            _deliveredThisTurn.forEach(function(d) {
              tp1 += '  ' + d.letter.to + '已收到：【' + d.edict.category + '】' + d.edict.content.slice(0,60) + '\n';
            });
          }
          if (_stillTransit.length > 0) {
            tp1 += '\n【往期诏令仍在途——以下NPC仍未收到命令】\n';
            _stillTransit.forEach(function(d) {
              tp1 += '  ' + d.letter.to + '：' + (d.lost ? '⚠信使失踪' : '信使在途') + '——' + d.edict.content.slice(0,40) + '\n';
            });
          }
        }
      }
      // 注入生命周期进行中的诏令（让AI记住上回合到哪阶段、反对派是谁、已积累效果）
      if (GM._edictLifecycle && GM._edictLifecycle.length > 0) {
        var _ongoing = GM._edictLifecycle.filter(function(e) { return !e.isCompleted; });
        if (_ongoing.length > 0) {
          tp1 += '\n\n【生命周期推演中的诏令——必须在 edict_lifecycle_update 中继续推进，不得重置回 drafting】\n';
          _ongoing.forEach(function(e) {
            var lastStage = e.stages && e.stages.length > 0 ? e.stages[e.stages.length - 1] : null;
            var typeLabel = (typeof EDICT_TYPES !== 'undefined' && EDICT_TYPES[e.edictType]) ? EDICT_TYPES[e.edictType].label : (e.edictType || '');
            var phaseLabel = '';
            if (e.reformPhase && typeof REFORM_PHASES !== 'undefined' && REFORM_PHASES[e.reformPhase]) {
              phaseLabel = '·' + REFORM_PHASES[e.reformPhase].label;
            }
            var stageLabel = lastStage && typeof EDICT_STAGES !== 'undefined' && EDICT_STAGES[lastStage.stage] ? EDICT_STAGES[lastStage.stage].label : (lastStage ? lastStage.stage : '');
            var elapsed = GM.turn - (e.startTurn || GM.turn);
            tp1 += '  [id=' + e.edictId + '] ' + typeLabel + phaseLabel + ' 已推进' + elapsed + '回合，上回合→' + stageLabel;
            if (lastStage && lastStage.executor) tp1 += '（' + lastStage.executor + '督办）';
            if (e.oppositionLeaders && e.oppositionLeaders.length > 0) tp1 += '；反对派：' + e.oppositionLeaders.slice(0, 3).join('、');
            if (e.supporters && e.supporters.length > 0) tp1 += '；支持者：' + e.supporters.slice(0, 3).join('、');
            if (e.pilotRegion) tp1 += '；试点：' + e.pilotRegion;
            if (e.expansionRegions && e.expansionRegions.length > 0) tp1 += '；已推广：' + e.expansionRegions.slice(0, 3).join('、');
            // 累计效果（告诉AI已经花了多少国库、造成多大民心波动）
            var effectKeys = Object.keys(e.totalEffects || {});
            if (effectKeys.length > 0) {
              var effParts = effectKeys.slice(0, 4).map(function(k) { return k + (e.totalEffects[k] >= 0 ? '+' : '') + e.totalEffects[k]; });
              tp1 += '；累计效果：' + effParts.join('、');
            }
            if (lastStage && lastStage.resistanceDescription) tp1 += '；阻力：' + lastStage.resistanceDescription.slice(0, 50);
            tp1 += '\n';
          });
          tp1 += '  ※ 本回合继续推进（下一阶段或细化当前阶段），不得从草拟重起；改革类逐步推进 pilot→expand→national→backlash→outcome\n';
        }
      }
      // 注入起义前兆——最近 3 回合累积
      if (Array.isArray(GM._revoltPrecursors) && GM._revoltPrecursors.length > 0) {
        var _recentPrec = GM._revoltPrecursors.filter(function(pc){return GM.turn - pc.turn <= _turnsForMonthsLocal(5);});
        if (_recentPrec.length > 0) {
          tp1 += '\n\n【起义前兆——最近 5 回合累积】\n';
          _recentPrec.forEach(function(pc) {
            tp1 += '  T' + pc.turn + '·[' + (pc.region||'?') + '] ' + pc.class + '：' + pc.indicator + '(' + pc.severity + ')';
            if (pc.detail) tp1 += '——' + pc.detail.slice(0, 60);
            if (pc.couldLeadTo) tp1 += '；或演变为：' + pc.couldLeadTo;
            tp1 += '\n';
          });
          tp1 += '  ※ 前兆累积超 3 条且 severity=critical → 下回合应考虑 class_revolt 爆发\n';
        }
      }
      // 注入进行中起义——AI 必须继续推进每一起
      if (Array.isArray(GM._activeRevolts)) {
        var _ongoingRev = GM._activeRevolts.filter(function(r){return !r.outcome;});
        if (_ongoingRev.length > 0) {
          tp1 += '\n\n【进行中的起义——每起必须在 revolt_update 中推进；满足条件应 suppress/amnesty/transform】\n';
          _ongoingRev.forEach(function(r) {
            var elapsed = GM.turn - r.startTurn;
            tp1 += '  [id=' + r.id + '] ' + r.leaderName + '·' + r.class + '起义 已' + elapsed + '回合\n';
            tp1 += '    意识形态:' + r.ideology + ' 组织:' + r.organizationType + ' 阶段:' + r.phase + ' 规模:' + r.scale + '\n';
            if (r.historicalArchetype) tp1 += '    原型:' + r.historicalArchetype + '\n';
            if (r.slogan) tp1 += '    口号「' + r.slogan + '」\n';
            if (r.religiousSect) tp1 += '    教派:' + r.religiousSect + '\n';
            tp1 += '    兵' + r.militaryStrength + ' 粮' + r.supplyStatus + '/100 控制:[' + r.territoryControl.join('、') + ']\n';
            if (r.absorbedForces.length) tp1 += '    已收编:' + r.absorbedForces.slice(0,3).join('、') + '\n';
            if (r.defectedOfficials.length) tp1 += '    叛投官员:' + r.defectedOfficials.slice(0,3).join('、') + '\n';
            if (r.secondaryLeaders.length) tp1 += '    副将:' + r.secondaryLeaders.slice(0,3).join('、') + '\n';
            if (r.history.length > 0) {
              var _recH = r.history.slice(-3).map(function(h){return 'T'+h.turn+':'+(h.event||'').slice(0,30);}).join(' → ');
              tp1 += '    近事:' + _recH + '\n';
            }
            if (r._needTransform) tp1 += '    ⚠已达建政阈值，本回合必须 revolt_transform type=toFaction 升级为独立势力\n';
            if (r.phase === 'stalemate' && elapsed > _turnsForMonthsLocal(5)) tp1 += '    ⚠相持过久，考虑招安(revolt_amnesty)或加强剿灭(revolt_suppress)\n';
            if (r.supplyStatus < 20) tp1 += '    ⚠粮草枯竭，可能自行 decline 或内讧\n';
          });
        }
      }
      // 注入问对承诺——NPC 应按应诺去做（或按性格推诿/拖延）
      if (GM._npcCommitments && Object.keys(GM._npcCommitments).length > 0) {
        var _pendingCmt = [];
        Object.keys(GM._npcCommitments).forEach(function(nm) {
          (GM._npcCommitments[nm]||[]).forEach(function(c) {
            if (c.status === 'pending' || c.status === 'executing' || c.status === 'delayed') _pendingCmt.push({ name: nm, c: c });
          });
        });
        if (_pendingCmt.length > 0) {
          // ★codex-fix W2b:承诺清单封顶16·防积压随回合线性膨胀主 prompt(按逾期>意愿排序取前16·sc1q 有 _packQ 上限·此处原无)
          if (_pendingCmt.length > 16) {
            _pendingCmt.sort(function(a,b){
              var _oa = ((GM.turn - a.c.assignedTurn) > (a.c.deadline||3)) ? 1 : 0;
              var _ob = ((GM.turn - b.c.assignedTurn) > (b.c.deadline||3)) ? 1 : 0;
              if (_oa !== _ob) return _ob - _oa;
              return (b.c.willingness||0.5) - (a.c.willingness||0.5);
            });
            _pendingCmt = _pendingCmt.slice(0, 16);
          }
          tp1 += '\n\n【问对承诺——NPC 应按此行动（AI 推演时体现；可通过 npc_actions 或 commitment_update 报告进展）】\n';
          _pendingCmt.forEach(function(x) {
            var elapsed = GM.turn - x.c.assignedTurn;
            tp1 += '  [id=' + x.c.id + '] ' + x.name + ' 允' + elapsed + '回合前：' + x.c.task + '（意愿' + Math.round((x.c.willingness||0.5)*100) + '%，限' + x.c.deadline + '回合，状态' + x.c.status + ' 进展' + x.c.progress + '%）\n';
            if (x.c.npcPromise) tp1 += '    原诺："' + x.c.npcPromise + '"\n';
            // ★2026-07-01 W2b·让记忆/属性真正影响办事质量:注入承办人的忠诚/才干/心绪(此前只给 willingness)·
            //   令 AI 的进展/成败因人而异而非一视同仁。心绪走零调用的 getMood(点亮死API·记忆派生)·把记忆接进办事结果。
            var _cch = (typeof findCharByName === 'function') ? findCharByName(x.name) : null;
            if (_cch) {
              var _loy = (typeof _cch.loyalty === 'number') ? _cch.loyalty : 50;
              var _abil = [_cch.ability, _cch.talent, _cch.administration, _cch.governance, _cch.management, _cch.intelligence, _cch.diplomacy].find(function(v){ return Number.isFinite(v); });   // ★codex-fix W2b:只取数值型能力(排除 learning 文本「进士/秀才」·且不把 0 当缺失)
              var _mood = (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.getMood) ? NpcMemorySystem.getMood(x.name) : '';
              tp1 += '    ·承办人：忠诚' + _loy + (_abil != null ? '·才干' + _abil : '') + (_mood ? '·心绪「' + _mood + '」' : '') + '（据此定其办事快慢/尽力/成败）\n';
            }
          });
          tp1 += '  ※ 办事质量应因人而异：忠诚高+心绪佳+才干强者办得快而妥；忠诚低/心绪恶(怒/恨/惧)/才干弱者易拖延、敷衍、办砸或阳奉阴违。请据上列承办人属性让进展合理分层；可在 npc_actions 中体现行动，或在 p1 中新增 commitment_update:[{id,progress,status,feedback}]\n';
        }
      }
      // 注入御前密谋（activeSchemes 中 source=yuqian2 的）——提醒 AI 暗中推进
      if (Array.isArray(GM.activeSchemes)) {
        var _secretYuq = GM.activeSchemes.filter(function(s){ return s.source === 'yuqian2' && (!s.progress || s.progress !== '完成'); });
        if (_secretYuq.length > 0) {
          tp1 += '\n\n【御前密议遗策——暗中推进】\n';
          _secretYuq.forEach(function(s) {
            tp1 += '  T' + s.startTurn + '·' + (s.schemer||'皇帝') + '：' + (s.plan||'').slice(0, 80) + '（进度:' + (s.progress||'酝酿') + '，同谋:' + (s.allies||'') + '）\n';
          });
          tp1 += '  ※ 密谋推进应合乎逻辑——需行动者、需时机、需风险；可能暴露或成败\n';
        }
        // P6.3 修：注入 NPC 阴谋（非御前密议·sc1c 之外的全部）·主 sc1 应知朝中暗流
        var _npcSchemes = GM.activeSchemes.filter(function(s){ return s.source !== 'yuqian2' && (!s.progress || s.progress !== '完成'); });
        if (_npcSchemes.length > 0) {
          tp1 += '\n\n【朝中阴谋·非公开（仅 AI 知晓·影响 hidden_moves 演绎）】\n';
          _npcSchemes.slice(-10).forEach(function(s) {
            tp1 += '  T' + (s.startTurn||'?') + '·' + (s.schemer||'?') + '→' + (s.target||'?') + '：' + String(s.plan||'').slice(0, 60) + '（' + (s.progress||'酝酿中') + '·同谋' + (s.allies||'独行') + '）\n';
          });
          tp1 += '  ※ 这些阴谋当前对玩家不公开·但 NPC/势力会按此推进。叙事中应自然呈现端倪而非直白·让玩家从风闻/暗示中察觉\n';
        }
      }
      // P6.3 修：注入势力暗流（_factionUndercurrents·上回合 sc15 输出）
      if (Array.isArray(GM._factionUndercurrents) && GM._factionUndercurrents.length > 0) {
        tp1 += '\n\n【势力内部暗流·上回合 NPC 推演结论·本回合应延续】\n';
        GM._factionUndercurrents.slice(0, 8).forEach(function(u) {
          tp1 += '  ' + (u.faction||'?') + '：' + (u.situation||'') + '（趋势 ' + (u.trend||'稳定') + '·' + (u.nextMove||'') + '）\n';
        });
      }
      // P11.2B + P13.2：注入诏令冲突链 + supersedes 抑制（被废诏令折叠展示）
      if (Array.isArray(GM._edictRelations) && GM._edictRelations.length > 0) {
        var _recentRels = GM._edictRelations.slice(-15);
        if (_recentRels.length > 0) {
          // P13.2 supersedes 抑制：识别已被覆盖的旧诏·折叠展示
          var _supersededSet = {};
          _recentRels.forEach(function(r) {
            if (r.type === 'supersedes') _supersededSet[r.to] = r.from;  // r.to 被 r.from 覆盖
          });

          tp1 += '\n\n【诏令关系图（KokoroMemo 范式·近 15 条·须维持因果连贯）】\n';
          _recentRels.forEach(function(r) {
            var typeLabel = { supersedes: '覆盖', contradicts: '冲突', continues: '接续', elaborates: '细则' }[r.type] || r.type;
            // P13.2：若 src 也已被进一步覆盖·标记 [二级覆盖]
            var dblMark = _supersededSet[r.from] ? '[二级覆盖] ' : '';
            tp1 += '  · ' + dblMark + 'T' + (r.turn||'?') + ' [' + r.from + '] →[' + typeLabel + ']→ [' + r.to + ']' + (r.reason ? ' ←' + r.reason : '') + '\n';
          });
          // P13.2：被覆盖的旧诏列表（AI 不应再叙述其当前生效）
          var _supersededList = Object.keys(_supersededSet);
          if (_supersededList.length > 0) {
            tp1 += '  ※ 已被覆盖·当前已无效的旧诏（AI 不得描述其在执行）：' + _supersededList.join('·') + '\n';
          }
          tp1 += '  ※ supersedes(覆盖)：新政废旧政·旧政效力终止·须明叙取代经过\n';
          tp1 += '  ※ contradicts(冲突)：两道诏令逻辑矛盾·至少一道无法完全执行·须呈现执行困境\n';
          tp1 += '  ※ continues(接续)：本诏推进前诏未竟之业·须延续叙事而非另起炉灶\n';
          tp1 += '  ※ elaborates(细则)：本诏细化前诏·实施层面·须呼应原诏精神\n';
          tp1 += '  本回合若颁新政与上述任一构成新关系·须在 edict_relations 输出补充·不得回滚或忽视已有关系。\n';
        }
      }

      // P6.3 修：注入御批回听（_edictEfficacyHistory·上 5 回合诏令成败结果·让 AI 不重蹈覆辙）
      if (Array.isArray(GM._edictEfficacyHistory) && GM._edictEfficacyHistory.length > 0) {
        var _recentEfficacy = GM._edictEfficacyHistory.slice(-5);
        tp1 += '\n\n【御批回听·过去 5 回合诏令落实情况（AI 应据此调整本回合诏令兑现节奏）】\n';
        _recentEfficacy.forEach(function(eh) {
          var efficacy = (eh.overallEfficacy != null ? eh.overallEfficacy + '%' : '?');
          tp1 += '  T' + (eh.turn||'?') + ' 整体兑现率 ' + efficacy;
          if (eh.efficacyByDimension) {
            var dims = Object.keys(eh.efficacyByDimension).map(function(k){ return k + ':' + eh.efficacyByDimension[k] + '%'; }).join('·');
            if (dims) tp1 += '（' + dims + '）';
          }
          tp1 += '\n';
        });
        // 当前回合 _edictEfficacyReport 的具体未落实条目（更细粒度·上回合产生）
        var _lastEf = GM._edictEfficacyReport;
        if (_lastEf && Array.isArray(_lastEf.ignoredOrDelayed) && _lastEf.ignoredOrDelayed.length > 0) {
          tp1 += '【上回合未落实/搁置/失败诏令·下回合应明确处理（继续/废止/换臣推动/认错改弦）】\n';
          _lastEf.ignoredOrDelayed.slice(0, 10).forEach(function(r) {
            tp1 += '  · 「' + String(r.content || '').slice(0, 50) + '」 status:' + (r.status||'?') + '·原因:' + String(r.reason||'').slice(0, 40) + '\n';
          });
        }
      }
      // 方案融入：推演前先①税收级联自然结算 ②区划→七变量聚合 ③注入深化上下文
      try {
        // ①地方按税制征收 → 分账 → 损耗 → 上解中央（所有税种钱粮布走三账）
        if (typeof CascadeTax !== 'undefined' && typeof CascadeTax.collect === 'function') {
          try { CascadeTax.collect(); } catch(_ctE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_ctE, 'endTurn] CascadeTax.collect') : console.warn('[endTurn] CascadeTax.collect', _ctE); }
        }
        // ①.5 固定支出（俸禄/军饷/宫廷）—— 三账扣减
        if (typeof FixedExpense !== 'undefined' && typeof FixedExpense.collect === 'function') {
          try { FixedExpense.collect(); } catch(_feE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_feE, 'endTurn] FixedExpense.collect') : console.warn('[endTurn] FixedExpense.collect', _feE); }
        }
        // ①.6 军事双 schema 同步·GM.armies → GM.population.military.types(派生)·防止后续 _tickMilitarySupply 用陈旧数据
        if (typeof syncMilitarySources === 'function') {
          try { syncMilitarySources(GM); } catch(_smE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_smE, 'endTurn] syncMilitarySources') : console.warn('[endTurn] syncMilitarySources', _smE); }
        }
        // ②区划 → 七变量聚合（户口/民心/腐败/财政 等）
        if (typeof IntegrationBridge !== 'undefined' && typeof IntegrationBridge.aggregateRegionsToVariables === 'function') {
          try { IntegrationBridge.aggregateRegionsToVariables(); } catch(_aggE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_aggE, 'endTurn] aggregate pre-AI') : console.warn('[endTurn] aggregate pre-AI', _aggE); }
        }
        // v3：NpcMemorials 不再硬扫事件，只构造朝堂场景上下文
        if (typeof buildNpcSceneContext === 'function') {
          var _sceneCtx = buildNpcSceneContext();
          if (_sceneCtx) tp1 += '\n\n' + _sceneCtx;
        }
        // 长期事势追踪·注入（含 hidden 条目，AI 全见，玩家不见 hidden）
        if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAIContextString) {
          var _chronCtx = ChronicleTracker.getAIContextString();
          if (_chronCtx) {
            tp1 += '\n\n' + _chronCtx;
            // 硬约束·让长期工程穿透到所有输出通道
            tp1 += '\n\n【★ 长期工程穿透指令·必须遵守】\n';
            tp1 += '  · shizhengji/zhengwen(时政记)：凡涉以上「长期事势」的回合·必须在叙事中点出"陛下 X 月前所颁某诏·至今进展 Y%·主奏者某某奏报近况"·不可只写本回合孤立事件。\n';
            tp1 += '  · resource_changes(数值变化)：进度 ≥70% 时·相关方向数值应显著正向(如治河工程进 70% → 该地 unrest -3·prosperity +2)·≥95% 接近完成时·应大幅正向(unrest -5·prestige +5)·主奏者 prestige/favor +5~10。逾期或滞涩(<20% 历 3 回合+) 时·相关方向数值负向(主奏者 prestige -3·相关 region 民心 -2)。\n';
            tp1 += '  · events(事件)：进度满 95% 应 spawn"X 工竣报"事件·含主奏者奏报、地方反响、朝堂庆贺。逾期应 spawn"X 督查不力"事件·含言官弹劾。\n';
            tp1 += '  · char_updates(人物变动)：主奏者随工程推进/失败·prestige/loyalty/favor 自然变化。stakeholder NPC(关联部门长官、相关 region 大员)亦同。\n';
            tp1 += '  · npc_actions(NPC 行动)：相关 NPC 应有奏报本工程进展的奏疏 OR 私下行动(如盐法将成则盐商党首派人贿赂；治河将竣则河漕总督奏请封赏)。\n';
            tp1 += '  · 不可只字不提进行中的长期工程·这是史官最严苛的考核·真朝廷绝无可能 N 年大工程在某月一字未提的情况。\n';
          }
        }
        // 后妃请见生成器——每回合按冷落/性格/宫心决定概率
        try { _generateConsortAudiences(); } catch(_caE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_caE, 'consortAudience') : console.warn('[consortAudience]', _caE); }
        // 后妃文苑参与生成——高学识/智力后妃有概率作文投稿
        try { _generateConsortLiterary(); } catch(_clE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_clE, 'consortLit') : console.warn('[consortLit]', _clE); }
        // 后妃文苑作品待 AI 补完题名正文
        if (Array.isArray(GM.culturalWorks)) {
          // R88-fix: era 在本函数从未声明·原 pre-existing ReferenceError
          var era = '';
          try {
            var _scEra = (typeof findScenarioById === 'function') ? findScenarioById(GM.sid) : null;
            if (_scEra) era = _scEra.era || _scEra.dynasty || '';
          } catch(_) {}
          var _pendingLit = GM.culturalWorks.filter(function(w){return w && w.authorIsSpouse && w._pendingAIComplete && w.turn === GM.turn - 1;});
          if (_pendingLit.length > 0) {
            tp1 += '\n\n【★ 后妃新作·文苑待补 ★】请在 char_updates/culturalWorks_updates 里补 title 和 preview：';
            _pendingLit.forEach(function(w){
              var chw = (GM.chars||[]).find(function(c){return c&&c.name===w.author;});
              tp1 += '\n  · ' + w.author + '（' + (chw&&chw.spouseRank||'') + '）作《' + w.genre + '》·动机【' + w.motive + '】·风格【' + w.mood + '】';
              if (chw && chw.learning) tp1 += '·学识' + chw.learning;
            });
            tp1 += '\n  ★ 要求：题名典雅·正文(preview)16-40 字·符合动机与风格·贴合' + (era||'此时') + '风貌';
            tp1 += '\n  ★ 补完方式：anyPathChanges 数组里 path="culturalWorks[i]" op:"merge" value:{title:"...",preview:"..."}（i 对应 turn 和 author 定位）·或 char_updates 该妃 +culturalContribution 记叙';
          }
          // 已送到皇帝面前的作品
          if (Array.isArray(GM._consortPendingLiteraryForEmperor) && GM._consortPendingLiteraryForEmperor.length > 0) {
            var _sent = GM._consortPendingLiteraryForEmperor.filter(function(p){return p && p.turn === GM.turn - 1;});
            if (_sent.length > 0) {
              tp1 += '\n【★ 后妃呈作 ★】以下妃嫔将作品呈于陛下御览，houren_xishuo 中应有反应：';
              _sent.forEach(function(p){ tp1 += '\n  · ' + p.name + '【' + p.motive + '】'; });
              tp1 += '\n  ★ 规劝类作品 → 帝或喜或怒视性格；邀宠类 → 可能导致帝召幸（加 _pendingOvernight）；寄意类 → 帝黯然或动容';
              GM._consortPendingLiteraryForEmperor = GM._consortPendingLiteraryForEmperor.filter(function(p){return p && p.turn !== GM.turn - 1;});
            }
          }
        }
        // 朝堂问对后妃事件——触发外臣警觉"后宫干政"
        if (Array.isArray(GM._consortFormalAudiences) && GM._consortFormalAudiences.length > 0) {
          var _cfa = GM._consortFormalAudiences.filter(function(c){return c && !c.processed && c.turn === GM.turn - 1;});
          if (_cfa.length > 0) {
            tp1 += '\n\n【★ 后宫干政警报 ★】上回合陛下在朝堂问对后妃：';
            _cfa.forEach(function(c){
              tp1 += '\n  · ' + c.name + '（' + (c.spouseRank||'') + '）' + (c.motherClan?'·母族'+c.motherClan:'');
            });
            tp1 += '\n  ★ 本回合 AI 应生成外臣反应：';
            tp1 += '\n      - 御史/谏官/礼部上奏疏：memorials.push {type:"谏疏",title:"谏后宫干政疏",content:"妇人无外事·古训也·陛下亲幸朝堂问后妃·恐启妇言乱政之渐"...}';
            tp1 += '\n      - 部分清流大臣可能 npc_actions 请见规劝（type:"advise"/"remonstrate"）';
            tp1 += '\n      - 若该妃母族强势（' + _cfa.filter(function(c){return c.motherClan;}).length + ' 人有母族）→ 他派大臣可能联名弹劾外戚';
            tp1 += '\n      - 视朝代开明度 + 妃身份：朝代若偏崇礼教（宋明清前期）反应尤烈；胡族/唐/辽反应较轻';
            tp1 += '\n      - 妃子本人的 opinion 对此可能矛盾：若她爱干政则暗喜；若矜持则懊悔（记入 NPC 记忆）';
            tp1 += '\n      - 皇威 -2~-5（视反响规模），民心略降';
            GM._consortFormalAudiences.forEach(function(c){ if (c.turn === GM.turn - 1) c.processed = true; });
            // 清理已处理+超过 5 回合的
            GM._consortFormalAudiences = GM._consortFormalAudiences.filter(function(c){ return c && !c.processed; });
          }
        }
        // 若玩家上回合应允了留宿，注入 AI prompt 让推演体现
        if (Array.isArray(GM._pendingOvernight) && GM._pendingOvernight.length > 0) {
          var _on = GM._pendingOvernight.filter(function(o){return o && o.status==='accepted' && o.turn === GM.turn - 1;});
          if (_on.length > 0) {
            tp1 += '\n\n【★ 后宫·帝幸 ★】本回合推演应体现：';
            _on.forEach(function(o){
              var ch_sp = (GM.chars||[]).find(function(c){return c && c.name===o.name;});
              var spRank = ch_sp && ch_sp.spouseRank;
              var palName = ch_sp && ch_sp.residence || '';
              tp1 += '\n  · 帝幸' + o.name + '（' + (spRank||'妻室') + '·' + (palName||'某宫') + '）';
              if (ch_sp && ch_sp.motherClan) tp1 += '·母族'+ch_sp.motherClan;
            });
            tp1 += '\n  houren_xishuo 中须细写帝幸场景（行礼/叙话/旧情/枕席/次日辞朝），后妃之母族/子女可借此被提及';
            tp1 += '\n  对该后妃 loyalty/opinion 有提升，stress 下降；若有怀孕可能，npc_interactions 中加一条内廷暧昧暗示';
            tp1 += '\n  此次留宿可能引发其他后妃嫉妒/暗生怨气（npc_actions 中可体现）';
            // 清理已消费的标记
            GM._pendingOvernight = GM._pendingOvernight.filter(function(o){return !(o && o.turn === GM.turn - 1 && o.status==='accepted');});
          }
        }
        // 财政赤字状态注入——当前任一库为负 → AI 必须严厉叙事
        var _defItems = [];
        ['money','grain','cloth'].forEach(function(r){
          if (GM.guoku && (Number(GM.guoku[r])||0) < 0) _defItems.push({t:'guoku',r:r,v:GM.guoku[r]});
          if (GM.neitang && (Number(GM.neitang[r])||0) < 0) _defItems.push({t:'neitang',r:r,v:GM.neitang[r]});
        });
        if (_defItems.length > 0) {
          var _streak = GM._fiscalDeficitStreak || 1;
          tp1 += '\n\n【★★ 财政赤字·持续 ' + _streak + ' 回合 ★★】';
          _defItems.forEach(function(d){
            var tg = d.t==='guoku'?'帑廪':'内帑', rl = d.r==='money'?'银':d.r==='grain'?'粮':'布';
            tp1 += '\n  · ' + tg + '(' + rl + ')：' + d.v + '（负值表示赤字借贷）';
          });
          tp1 += '\n※ 赤字期必须在叙事中体现严重后果：';
          tp1 += '\n    - 银亏：俸禄拖欠→百官怨怼/告病离朝、军饷失发→兵变/逃亡、商贾不敢赊借、民间挤兑';
          tp1 += '\n    - 粮亏：饥荒蔓延、米价腾贵、流民暴动、军队哗变、漕运停滞';
          tp1 += '\n    - 布亏：军装不继、工匠罢织、宫廷缩减供给';
          tp1 += '\n    - 持续 ' + _streak + ' 回合赤字：权臣借机坐大、地方观望、异族窥伺、天象示警（若朝代迷信）';
          tp1 += '\n※ edict_feedback 中需将相关诏令标 obstructed（执行停滞），并在 feedback 中明言"库已空虚/某军哗变/某地起义"';
          tp1 += '\n※ npc_actions 可让臣子主动上奏请"借贷于商贾/加税/抄豪强/开捐纳/发内帑"等筹款手段，但每种手段都有副作用';
          if (_streak >= 3) tp1 += '\n※ 持续 3+ 回合·AI 须生成至少 1 条 major 事件：某军哗变/某地民变/某大臣请辞/某豪强抗税/外族借机入侵';
        }
        // 财政亏欠注入——上回合库不足导致的未付款项，AI 本回合必须叙事处置
        if (Array.isArray(GM._fiscalShortfalls) && GM._fiscalShortfalls.length > 0) {
          var _unresolved = GM._fiscalShortfalls.filter(function(s){return s && !s.resolved;});
          if (_unresolved.length > 0) {
            tp1 += '\n\n【★ 财政亏欠·上回合库不足未付】';
            _unresolved.slice(0, 12).forEach(function(s){
              var _tg = s.target === 'guoku' ? '帑廪' : s.target === 'neitang' ? '内帑' : s.target;
              var _rl = s.resource === 'grain' ? '粮' : s.resource === 'cloth' ? '布' : '银';
              tp1 += '\n  · T' + s.turn + ' ' + _tg + '(' + _rl + ')【' + (s.name||'') + '】请 ' + s.requested + ' · 仅拨 ' + s.applied + ' · 亏欠 ' + s.shortfall + (s.reason?'（'+s.reason+'）':'');
            });
            tp1 += '\n  ※ 本回合 AI 必须就以上亏欠给出后果：';
            tp1 += '\n      - 赏赐亏欠 → 受赏者/势力不满或失望，npc_actions/关系下滑，可能 loyalty -5~-15';
            tp1 += '\n      - 军饷亏欠 → 军队哗变/逃亡/将领怨怼，edict_feedback 标 obstructed，民心-2 皇威-3';
            tp1 += '\n      - 赈济亏欠 → 饥荒扩散/民变概率↑，地方 region 民心下滑，新增 pendingCrisis';
            tp1 += '\n      - 工程/专款亏欠 → 工期停滞，project_updates 标 halted，工匠罢工';
            tp1 += '\n      - 外交赔款亏欠 → 敌方 faction 恼怒，可能宣战或报复，边境 hostility↑';
            tp1 += '\n      - 如本回合已补齐（通过新的 fiscal_adjustments），标 _fiscalShortfalls[i].resolved=true（通过 anyPathChanges）';
            tp1 += '\n      - 玩家可能下诏筹款（加税/借贷/抄家/鬻爵），AI 须判定执行阻力';
          }
        }
        if (typeof buildFullAIContext === 'function') {
          var _fCtx = buildFullAIContext();
          // ── 七变量 + 深化字段（详细）──
          if (_fCtx.variables) {
            tp1 += '\n\n【七大变量·推演必读（深化数据）】';
            var _v = _fCtx.variables;
            if (_v.huangwei)  tp1 += '\n  皇威：真 ' + Math.round((_v.huangwei.index||0)) + ' / 视 ' + Math.round(_v.huangwei.perceivedIndex||_v.huangwei.index||0) + ' · ' + (_v.huangwei.phase||'') + (_v.huangwei.tyrantSyndrome?' · 暴君症候活':'') + (_v.huangwei.lostCrisis?' · 失威危机活':'');
            if (_v.huangquan) tp1 += '\n  皇权：' + Math.round((_v.huangquan.index||0)) + ' · ' + (_v.huangquan.phase||'') + (_v.huangquan.powerMinister?' · 权臣 '+ _v.huangquan.powerMinister.name:'');
            if (_v.minxin) {
              var _mxTrue = (_v.minxin.trueIndex != null) ? _v.minxin.trueIndex : ((_v.minxin.index != null) ? _v.minxin.index : (_v.minxin.value || 0));
              tp1 += '\n  民心：真 ' + Math.round(_mxTrue) + ' / 视 ' + Math.round(_v.minxin.perceivedIndex||_mxTrue||0) + ' · ' + (_v.minxin.phase||'');
            }
            if (_v.corruption) {
              var _corrTrue = (_v.corruption.trueIndex != null) ? _v.corruption.trueIndex : ((_v.corruption.overall != null) ? _v.corruption.overall : ((_v.corruption.index != null) ? _v.corruption.index : (_v.corruption.value || 0)));
              tp1 += '\n  吏治：真 ' + Math.round(_corrTrue) + ' / 视 ' + Math.round(_v.corruption.perceivedIndex||_corrTrue||0);
            }
            if (_v.guoku)     tp1 += '\n  帑廪：钱 ' + Math.round((_v.guoku.money||0)/10000) + ' 万两 · 粮 ' + Math.round((_v.guoku.grain||0)/10000) + ' 万石 · 布 ' + Math.round((_v.guoku.cloth||0)/10000) + ' 万匹 · 月入 ' + Math.round((GM.guoku && GM.guoku.monthlyIncome||0)/10000) + ' 万';
            if (_v.neitang)   tp1 += '\n  内帑：钱 ' + Math.round((_v.neitang.money||0)/10000) + ' 万两 · 粮 ' + Math.round((GM.neitang && GM.neitang.grain||0)/10000) + ' 万石 · 布 ' + Math.round((GM.neitang && GM.neitang.cloth||0)/10000) + ' 万匹 · 皇庄 ' + Math.round(_v.neitang.huangzhuangAcres||0) + ' 亩';
            // 本回合税收级联摘要（帮助 AI 了解自然结算已完成什么）
            try {
              if (_v.fiscalDynamic && Array.isArray(_v.fiscalDynamic.active) && _v.fiscalDynamic.active.length > 0) {
                var _fd = _v.fiscalDynamic;
                var _fdRes = { money:'银', grain:'粮', cloth:'布' };
                var _fdKind = { income:'入', expense:'出' };
                var _fdTarget = { guoku:'帑廪', neitang:'内帑' };
                var _fdMr = Number(_fd.monthRatio || 1);
                tp1 += '\n  长期财政年例（按本剧本 ' + Math.round(_fd.turnDays || 30) + ' 日/回合折算，月比 ' + _fdMr.toFixed(2) + '）：';
                _fd.active.slice(0, 12).forEach(function(item) {
                  var tgt = _fdTarget[item.target] || item.target || '?';
                  var res = _fdRes[item.resource] || item.resource || '银';
                  var kind = _fdKind[item.kind] || item.kind || '';
                  var annual = Math.round((item.annualAmount || item.amount || 0) / 10000);
                  var turnAmt = Math.round((item.turnAmount || 0) / 10000);
                  tp1 += '\n    · ' + tgt + kind + res + '《' + (item.name || item.category || '未名条目') + '》岁额约' + annual + '万，本回合约' + turnAmt + '万';
                  if (item.stopAfterTurn) tp1 += '，止于T' + item.stopAfterTurn;
                  if (item.reason) tp1 += '；因：' + item.reason;
                  if (item.shortfall > 0) tp1 += '；上次亏欠' + Math.round(item.shortfall/10000) + '万';
                });
                tp1 += '\n    ※ 以上条目已进入财政结算，AI 推演时必须把它们视为持续财政压力/收入来源，而不是一次性旧闻；若玩家本回合扩大、裁撤或替换这些项目，必须用 fiscal_adjustments 的 action:update/stop/remove 改账；新增多个来源时输出多条 action:add recurring:true。';
              }
            } catch(_fdE){}
            if (GM._lastCascadeSummary) {
              var cs = GM._lastCascadeSummary;
              tp1 += '\n  本回合自然税收已结算：上解中央 钱 ' + Math.round(cs.central.money/10000) + '万/粮 ' + Math.round(cs.central.grain/10000) + '万/布 ' + Math.round(cs.central.cloth/10000) + '万';
              tp1 += '；地方留存 钱 ' + Math.round(cs.localRetain.money/10000) + '万/粮 ' + Math.round(cs.localRetain.grain/10000) + '万';
              tp1 += '；被贪 钱 ' + Math.round(cs.skimmed.money/10000) + '万/粮 ' + Math.round(cs.skimmed.grain/10000) + '万；路途损耗 钱 ' + Math.round(cs.lostTransit.money/10000) + '万';
            }

            // ★ 帑廪 收源 subItems · 让 AI 看 8 大类下细目（如田赋·正赋 X 万 + 附加 Y 万）
            try {
              if (GM.guoku && GM.guoku.sourcesDetail) {
                var _gkSrcCats = ['tianfu','dingshui','caoliang','yanlizhuan','shipaiShui','quanShui','mining','fishingTax','juanNa','qita'];
                var _gkSrcCatNames = {tianfu:'田赋',dingshui:'丁税',caoliang:'漕粮',yanlizhuan:'盐铁茶',shipaiShui:'市舶',quanShui:'榷税',mining:'矿冶',fishingTax:'渔课',juanNa:'捐纳',qita:'其他'};
                var _gkSrcArr = [];
                _gkSrcCats.forEach(function(cat) {
                  var items = GM.guoku.sourcesDetail[cat] || [];
                  if (!Array.isArray(items) || items.length === 0) return;
                  var _sum = items.reduce(function(s, it){ return s + (it.amount||0); }, 0);
                  if (_sum < 1000) return; // 过滤 < 0.1 万的零碎
                  var parts = items.slice(0, 3).map(function(it){
                    return (it.name||it.id||'?') + Math.round((it.amount||0)/10000) + '万';
                  });
                  _gkSrcArr.push((_gkSrcCatNames[cat]||cat) + '[' + parts.join('+') + ']');
                });
                if (_gkSrcArr.length > 0) tp1 += '\n  帑廪·收源细目：' + _gkSrcArr.join('；');
              }
            } catch(_e){}

            // ★ 帑廪 支用 subItems · 让 AI 看 8 大类下细目
            try {
              if (GM.guoku && GM.guoku.expensesDetail) {
                var _gkExpCats = ['fenglu','junxiang','zhenzi','gongcheng','jisi','shangci','neiting','qita'];
                var _gkExpCatNames = {fenglu:'俸禄',junxiang:'军饷',zhenzi:'赈济',gongcheng:'工程',jisi:'祭祀',shangci:'赏赐',neiting:'内廷转运',qita:'其他'};
                var _gkExpArr = [];
                _gkExpCats.forEach(function(cat) {
                  var items = GM.guoku.expensesDetail[cat] || [];
                  if (!Array.isArray(items) || items.length === 0) return;
                  var _sum = items.reduce(function(s, it){ return s + (it.amount||0); }, 0);
                  if (_sum < 1000) return;
                  var parts = items.slice(0, 3).map(function(it){
                    return (it.name||it.id||'?') + Math.round((it.amount||0)/10000) + '万';
                  });
                  _gkExpArr.push((_gkExpCatNames[cat]||cat) + '[' + parts.join('+') + ']');
                });
                if (_gkExpArr.length > 0) tp1 += '\n  帑廪·支用细目：' + _gkExpArr.join('；');
              }
            } catch(_e){}

            // ★ 内帑 收/支 subItems
            try {
              if (GM.neitang && GM.neitang.sourcesDetail) {
                var _ntSrcCats = ['huangzhuang','huangchan','specialTax','confiscation','tribute','guokuTransfer'];
                var _ntSrcNames = {huangzhuang:'皇庄',huangchan:'皇产',specialTax:'特税',confiscation:'抄家',tribute:'朝贡',guokuTransfer:'帑廪转运'};
                var _ntSrcArr = [];
                _ntSrcCats.forEach(function(cat) {
                  var items = GM.neitang.sourcesDetail[cat] || [];
                  if (!Array.isArray(items) || items.length === 0) return;
                  var _sum = items.reduce(function(s, it){ return s + (it.amount||0); }, 0);
                  if (_sum < 500) return;
                  var parts = items.slice(0, 2).map(function(it){
                    return (it.name||it.id||'?') + Math.round((it.amount||0)/10000) + '万';
                  });
                  _ntSrcArr.push((_ntSrcNames[cat]||cat) + '[' + parts.join('+') + ']');
                });
                if (_ntSrcArr.length > 0) tp1 += '\n  内帑·收源细目：' + _ntSrcArr.join('；');
              }
              if (GM.neitang && GM.neitang.expensesDetail) {
                var _ntExpCats = ['gongting','dadian','shangci','houGongLingQin','guokuRescue'];
                var _ntExpNames = {gongting:'宫廷',dadian:'大典',shangci:'赏赐',houGongLingQin:'后宫陵寝',guokuRescue:'援帑廪'};
                var _ntExpArr = [];
                _ntExpCats.forEach(function(cat) {
                  var items = GM.neitang.expensesDetail[cat] || [];
                  if (!Array.isArray(items) || items.length === 0) return;
                  var _sum = items.reduce(function(s, it){ return s + (it.amount||0); }, 0);
                  if (_sum < 500) return;
                  var parts = items.slice(0, 2).map(function(it){
                    return (it.name||it.id||'?') + Math.round((it.amount||0)/10000) + '万';
                  });
                  _ntExpArr.push((_ntExpNames[cat]||cat) + '[' + parts.join('+') + ']');
                });
                if (_ntExpArr.length > 0) tp1 += '\n  内帑·支用细目：' + _ntExpArr.join('；');
              }
            } catch(_e){}

            // ★ 各税种地方贡献 top·央地财政透明溯源
            try {
              if (typeof CascadeTax !== 'undefined' && typeof CascadeTax.getTopContributors === 'function' && GM.guoku && GM.guoku._sourceContributors) {
                var _topRows = [];
                var _topNameMap = {tianfu:'田赋',dingshui:'丁',caoliang:'漕',yanke:'盐',yanlizhuan:'盐铁',shipo:'市舶',shipaiShui:'市舶',mining:'矿',quanShui:'榷',fishingTax:'渔',juanNa:'捐'};
                Object.keys(GM.guoku._sourceContributors).slice(0, 6).forEach(function(cat) {
                  var tops = CascadeTax.getTopContributors(cat, 3);
                  if (!tops || tops.length === 0) return;
                  var topStr = tops.map(function(t){ return t.name + t.pct.toFixed(0) + '%'; }).join('|');
                  _topRows.push((_topNameMap[cat]||cat) + '⊳' + topStr);
                });
                if (_topRows.length > 0) tp1 += '\n  地方贡献占比·主税种：' + _topRows.join('；');
              }
            } catch(_e){}
            if (_v.population && _v.population.national) tp1 += '\n  户口：户 ' + Math.round((_v.population.national.households||0)/10000) + ' 万 · 口 ' + Math.round((_v.population.national.mouths||0)/10000) + ' 万 · 丁 ' + Math.round((_v.population.national.ding||0)/10000) + ' 万 · 逃户 ' + (_v.population.fugitives||0) + ' · 隐户 ' + (_v.population.hiddenCount||0);
          }
          // ── 民心分阶层/分区域 ──
          try {
            if (GM.minxin && GM.minxin.byClass) {
              var classKeys = Object.keys(GM.minxin.byClass);
              if (classKeys.length > 0) {
                var cls = classKeys.slice(0,9).map(function(k){
                  var v = GM.minxin.byClass[k];
                  var idx = (typeof v === 'object' && v !== null) ? (v.index || v.true || 60) : v;
                  return k + Math.round(idx||60);
                }).join('·');
                tp1 += '\n  民心·分阶层：' + cls;
              }
            }
          } catch(_e){}
          // ── 腐败 6 部门 ──
          try {
            if (GM.corruption && (GM.corruption.byDept || GM.corruption.subDepts)) {
              var deptSource = GM.corruption.byDept || GM.corruption.subDepts || {};
              var dp = Object.keys(deptSource).map(function(d){
                var v = deptSource[d];
                if (typeof v === 'object') v = v.true || v.overall;
                return d + Math.round(v||0);
              }).join('·');
              if (dp) tp1 += '\n  吏治·6部门：' + dp;
            }
          } catch(_e){}
          // ── 腐败九源 breakdown（因何而腐·W3 补盲区）──
          //   此前 GM.corruption.sources 只喂 UI 抽屉，prompt 仅给标量+6部门→AI 盲于「成因」；
          //   与民心 sources（下方）对称补上，让推演知道腐败由俸薄/急征/鬻官/宠信…何源而起。
          try {
            if (GM.corruption && GM.corruption.sources) {
              var _corrSrcCN = { lowSalary:'俸薄', laxSupervision:'监弛', emergencyLevy:'急征', officeSelling:'鬻官', nepotism:'荐幸', innerCircle:'宠信', redundancy:'冗员', institutional:'制弊', lumpSumSpending:'巨支' };
              var _cs = GM.corruption.sources;
              var corrSrc = Object.keys(_cs).filter(function(k){ return Math.abs(_cs[k]) > 0.5; })
                .sort(function(a,b){ return Math.abs(_cs[b]) - Math.abs(_cs[a]); })
                .slice(0,6).map(function(k){ var v=_cs[k]; return (_corrSrcCN[k]||k) + (v>=0?'+':'') + (Math.round(v*10)/10); }).join(' ');
              if (corrSrc) tp1 += '\n  吏治·九源（因何而腐）：' + corrSrc;
            }
          } catch(_e){}
          // ── 14源累积（民心驱动因素）──
          try {
            if (GM.minxin && GM.minxin.sources) {
              var src = Object.keys(GM.minxin.sources).filter(function(k){return Math.abs(GM.minxin.sources[k])>0.5;})
                .slice(0,8).map(function(k){var v=GM.minxin.sources[k];return k+(v>=0?'+':'')+v.toFixed(1);}).join(' ');
              if (src) tp1 += '\n  民心·主要驱动：' + src;
            }
          } catch(_e){}

          // ── 行政区划深化（每顶级）──
          try {
            if (GM.adminHierarchy) {
              var divTxt = [];
              Object.keys(GM.adminHierarchy).slice(0,3).forEach(function(fk){
                var divs = GM.adminHierarchy[fk] && GM.adminHierarchy[fk].divisions || [];
                divs.slice(0,8).forEach(function(d){
                  var line = '  ' + (d.name||d.id) + '(' + (d.level||'') + ')';
                  if (d.governor) line += ' 官:' + d.governor;
                  if (d.population && typeof d.population === 'object') {
                    if (d.population.mouths) line += ' 口' + Math.round(d.population.mouths/10000) + '万';
                    if (d.population.fugitives) line += ' 逃' + d.population.fugitives;
                  }
                  if (typeof d.minxin === 'number') line += ' 民心' + Math.round(d.minxin);
                  if (typeof d.corruption === 'number') line += ' 腐' + Math.round(d.corruption);
                  if (d.fiscal && d.fiscal.actualRevenue) {
                    line += ' 赋' + Math.round(d.fiscal.actualRevenue/10000) + '万';
                    // ★ 各税种贡献细目（top 3）
                    if (d.fiscal.contributionsByCategory) {
                      var _catKeys = Object.keys(d.fiscal.contributionsByCategory)
                        .filter(function(c){ return d.fiscal.contributionsByCategory[c] > 1000; })
                        .sort(function(a,b){ return d.fiscal.contributionsByCategory[b] - d.fiscal.contributionsByCategory[a]; })
                        .slice(0, 3);
                      if (_catKeys.length > 0) {
                        var _catNameMap = {tianfu:'田',dingshui:'丁',caoliang:'漕',yanke:'盐',yanlizhuan:'盐',shipo:'舶',shipaiShui:'舶',mining:'矿',quanShui:'榷',fishingTax:'渔',juanNa:'捐'};
                        line += '[' + _catKeys.map(function(c){ return (_catNameMap[c]||c) + Math.round(d.fiscal.contributionsByCategory[c]/10000) + 'w'; }).join(',') + ']';
                      }
                    }
                  }
                  if (d.publicTreasury && d.publicTreasury.money && d.publicTreasury.money.deficit>0) line += ' 亏' + Math.round(d.publicTreasury.money.deficit/10000) + '万';
                  if (d.regionType && d.regionType !== 'normal') line += ' [' + d.regionType + ']';
                  if (d.environment && d.environment.currentLoad > 0.9) line += ' 过载';
                  // ★ 田亩流转·本回合
                  if (d._thisTurnLandFlow) {
                    var _lf = d._thisTurnLandFlow;
                    var _lfP = [];
                    if (_lf.annexed > 0) _lfP.push('兼并' + Math.round(_lf.annexed/10000) + 'w');
                    if (_lf.reclaimed > 0) _lfP.push('开垦' + Math.round(_lf.reclaimed/10000) + 'w');
                    if (_lf.surveyed > 0) _lfP.push('清丈' + Math.round(_lf.surveyed/10000) + 'w');
                    if (_lfP.length) line += ' 田流(' + _lfP.join('|') + ')';
                  }
                  // ★ 经济基础 tags（让 AI 知道此区有何特殊属性·从而推演策略）
                  if (d.tags) {
                    var _tagP = [];
                    if (d.tags.hasPort) _tagP.push('港');
                    if (d.tags.saltRegion) _tagP.push('盐');
                    if (d.tags.mineralRegion) _tagP.push('矿');
                    if (d.tags.horseRegion) _tagP.push('马');
                    if (d.tags.fishingRegion) _tagP.push('渔');
                    if (d.tags.imperialDomain) _tagP.push('辖');
                    if (_tagP.length) line += ' [' + _tagP.join('') + ']';
                  }
                  // ★ 累计兼并 — 提示 AI 是否需要清丈
                  if (d.economyBase && d.economyBase.landsAnnexed > 100000) {
                    line += ' 兼并累' + Math.round(d.economyBase.landsAnnexed/10000) + 'w';
                  }
                  divTxt.push(line);
                });
              });
              if (divTxt.length) tp1 += '\n\n【行政区划·深化】（你可改 adminHierarchy.{fac}.divisions.{id或name}.{field}）\n' + divTxt.join('\n');
            }
          } catch(_e){}

          // ── 输出格式 ──
          tp1 += '\n\n【推演产出要求】';
          tp1 += '\n推演产生的任何变化请通过以下 JSON 字段输出：';
          tp1 += '\n  · changes: [{path, delta|value, reason}]  （path 支持 by-name：如 "chars.张三.loyalty" / "adminHierarchy.player.divisions.冀州.population.mouths"）';
          tp1 += '\n  · appointments: [{action:"appoint|dismiss|transfer", charName, position, binding}]';
          tp1 += '\n  · institutions: [{action:"create|abolish", type, id, name, annualBudget}]';
          tp1 += '\n  · regions: [{action:"reclassify", id, newType, reason}]';
          tp1 += '\n  · events: [{category, text, credibility}]';
          tp1 += '\n  · npc_interactions: [{actor, target, type:"impeach|slander|recommend|frame_up|betray|private_visit|correspond_secret|mediate|expose_secret|duel_poetry|master_disciple|reconcile|guarantee|..", description, involvedOthers?, publicKnown?}] —— 系统自动路由到 奏疏/问对/鸿雁/起居注/风闻，且按 type 自动涨/跌 actor 的 fame(名望 -100..+100)与 virtueMerit(贤能 累积)——譬如 recommend/mediate 提贤能，frame_up/betray/slander 损名望，expose_secret/impeach 对被揭者 fame 大跌。请按人物性格/立场/与目标关系选择合适的 type，避免机械化';
          tp1 += '\n  · localActions: [{region, type:"disaster_relief|public_works_water|public_works_road|education|granary_stockpile|military_prep|charity_local|illicit", amount, reason, proposer}] —— 地方官自主治理（按 region.fiscal 情况决定，amount < 3% 地方留存为常规，10-30% 为应急。illicit 为贪墨挪用，进入主官私产）';
          tp1 += '\n';
          tp1 += '\n【财政与田亩流转·新机制·可用 path】';
          tp1 += '\n  · 各 division.economyBase 字段可读·田赋/盐课/矿/海贸 = farmland × landTaxRate / saltProduction × saltTaxRate / mineralProduction × mineralTaxRate / maritimeTradeVolume × maritimeRate';
          tp1 += '\n  · 兼并自动结算：corruption > 50 时按 (corr-50)/100×4%/年 farmland 流入 landsAnnexed（豪强吞并）';
          tp1 += '\n  · 开垦自动结算：currentLoad < 0.7 时按 (1-load)×1.5%/年 增 farmland，劝农政策×2.5（path: "policies.encourageFarming" = true 启动）';
          tp1 += '\n  · 清丈触发：path "adminHierarchy.{fac}.divisions.{name}._surveyTrigger" = true 单次触发·下回合按 30-60% 从 landsAnnexed 回 farmland（民心高 → 比例高）';
          tp1 += '\n  · 道路质量 economyBase.roadQuality 影响驿递成本与商旅·可由地方治理「修路」localAction 缓慢提升';
          tp1 += '\n  · 帑廪/内帑 subItems 已展示·推演时引用具体细目（如「田赋·正赋下降 X 万因兼并」）而非空洞「岁入下降」';
          tp1 += '\n';
          tp1 += '\n【重要原则】';
          tp1 += '\n · 必读以上七变量+深化字段，推演要体现数据（而非空洞叙事）';
          tp1 += '\n · 不受历史约束——剧本仅作参考，只要合理即可（架空策略、反史实均允许）';
          tp1 += '\n · NPC 行为不要按职位套模板（御史必谏/将军必请战是工具人思维）';
          tp1 += '\n · 突发事件（灾/疫/异象/权臣/民变）通过 npc_interactions 让大臣/官员上奏或求见告知玩家，不要另起弹窗';
        }
      } catch(_fctxErr) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_fctxErr, 'endturn] fullCtx inject:') : console.warn('[endturn] fullCtx inject:', _fctxErr); }

      // 1.2+1.8+S1：ModelAdapter温度 + OpenAI原生JSON模式 + 流式感知进度
      // 动态 max_tokens：取模型单次最大输出（_MODEL_CTX_MAP）与业务需要 16K 的较小值·避免小模型被要求超限、大模型被限制过保守
      var _sc1BaseTok = Math.min(_effectiveOutCap || 16384, 16384);
      // Phase 2 A1 真接入·按 SC1_SCHEMA_TIERS·按 modelCap 自动删 extended/common 字段段 (low-tier model)
      try {
        var _capK_A1 = _effectiveOutCap ? Math.round(_effectiveOutCap / 1024) : 16;
        var _tierOverride_A1 = P.conf && P.conf.modelTier;
        if (_tierOverride_A1 === 'low') _capK_A1 = 4;
        else if (_tierOverride_A1 === 'medium') _capK_A1 = 8;
        else if (_tierOverride_A1 === 'high') _capK_A1 = 32;
        var _tierA1 = (_capK_A1 <= 4) ? 'core' : (_capK_A1 <= 8 ? 'common' : 'extended');
        if (_tierA1 !== 'extended') {
          // tier=core·删 extended 段·tier=common·删 extended 段
          // SC1_SCHEMA_TIERS.extended 字段·删它们在 schema 中的定义
          var _extFields = ['party_changes', 'class_changes', 'class_alert_responses', 'table_updates'];
          if (_tierA1 === 'core') _extFields = _extFields.concat(['party_changes', 'class_changes', 'fiscal_adjustments', 'personnel_changes', 'office_changes']);
          var _a1Pruned = 0;
          _extFields.forEach(function(fname) {
            var rx = new RegExp('"' + fname + '":\\[\\{?[\\s\\S]*?\\}?\\],', 'g');
            var before = tp1.length;
            tp1 = tp1.replace(rx, '');
            if (tp1.length < before) _a1Pruned += (before - tp1.length);
          });
          if (_a1Pruned > 0) {
            tp1 += '\n\n【SC1 schema tier=' + _tierA1 + ' (Phase 2 A1·按 modelCap)】扩展字段已删·共省 ' + _a1Pruned + ' 字符·请仅返回核心字段。';
            _dbg('[Phase 2 A1] tier=' + _tierA1 + ' pruned ' + _a1Pruned + ' chars');
          }
        }
      } catch(_a1E) { _dbg('[Phase 2 A1] tier prune fail:', _a1E); }

      // Phase 2 Slice 2+3+4·SC1 schema 拆分·删 sc1b/sc1c-domain 字段
      // sc1b 专管·cultural_works/npc_letters/npc_correspondence/npc_interactions·concat L2914-2917
      // sc1c 专管·faction_events/npc_schemes/hidden_moves/faction_interactions_advanced/fengwen_snippets·concat L3285-3322
      // 旧·sc1 + sc1b/sc1c 双管·AI 同时输出·apply 拼接·token 浪费 + 质量不一致
      // 新·sc1 不生成 sc1b/sc1c-domain·各自专项独占·节约 ~3-4K tokens / SC1 prompt
      // 回滚·P.ai.sc1OwnedBySc1b=false / P.ai.sc1OwnedBySc1c=false
      try {
        var _sc1bOwn = !(P.ai && P.ai.sc1OwnedBySc1b === false);
        var _sc1cOwn = !(P.ai && P.ai.sc1OwnedBySc1c === false);
        var _sc1bFields = ['npc_interactions','cultural_works','npc_letters','npc_correspondence'];
        var _sc1cFields = ['faction_events','faction_ai_outcomes','npc_schemes','hidden_moves','faction_interactions_advanced','fengwen_snippets'];
        var _toPrune = [];
        if (_sc1bOwn) _toPrune = _toPrune.concat(_sc1bFields);
        if (_sc1cOwn) _toPrune = _toPrune.concat(_sc1cFields);
        var _totalPruned = 0;
        _toPrune.forEach(function(fname) {
          // 匹配 "fname":[...]·([\s\S]*?) 容多行·终止于 `}],"<next_field>"` 或 `}],\n` 或 `}]}`
          var rx = new RegExp('"' + fname + '":\\[\\{?[\\s\\S]*?\\}?\\],', 'g');
          var before = tp1.length;
          tp1 = tp1.replace(rx, '');
          if (tp1.length < before) {
            var saved = before - tp1.length;
            _totalPruned += saved;
            _dbg('[SC1 Slice 3/4] removed schema field:', fname, '(-' + saved + ' chars)');
          }
        });
        // append 单条边界 note·告诉 AI 哪些字段不要输出
        var _noteParts = [];
        if (_sc1bOwn) _noteParts.push('cultural_works/npc_letters/npc_correspondence/npc_interactions (由 SC1b 专管)');
        if (_sc1cOwn) _noteParts.push('faction_events/faction_ai_outcomes/npc_schemes/hidden_moves/faction_interactions_advanced/fengwen_snippets (由 SC1c 专管)');
        if (_noteParts.length) {
          tp1 += '\n\n【SC1 字段边界·重要】本回合 sc1 不输出以下字段·\n  · ' + _noteParts.join('\n  · ') + '\n即使本 prompt 上方残留提及·sc1 也只返回除上列字段外的其他字段。';
        }
        if (_totalPruned > 0) {
          _dbg('[SC1 Slice 3/4] total schema bytes saved:', _totalPruned);
        }
      } catch(_sliceE) { _dbg('[SC1 Slice 3/4] schema prune fail', _sliceE); }
      // G1+G5·Schema 裁剪：按模型输出能力自动裁剪·玩家可通过 P.conf.modelTier 手动覆写档位（low/medium/high）
      try {
        var _outCapK_G1 = _effectiveOutCap ? Math.round(_effectiveOutCap / 1024) : 16;
        // G5 手动覆写：low→当 4K 处理；medium→当 8K；high→不裁剪
        var _tierOverride = P.conf && P.conf.modelTier;
        if (_tierOverride === 'low') _outCapK_G1 = 4;
        else if (_tierOverride === 'medium') _outCapK_G1 = 8;
        else if (_tierOverride === 'high') _outCapK_G1 = 32;
        if (_outCapK_G1 <= 4) {
          tp1 += '\n\n【★模型能力降级·SC1 schema 精简】\n';
          tp1 += '  · 检测到单次输出 ≤ 4K tokens·请尽量压缩 schema\n';
          tp1 += '  · 必填核心字段：turn_summary/shizhengji_basis/playerStatus/playerInner + edict_feedback 数组\n';
          tp1 += '  · 可缩或留空：cultural_works/npc_letters/npc_correspondence/npc_interactions/faction_interactions_advanced/faction_events/faction_ai_outcomes/npc_schemes/hidden_moves/fengwen_snippets（这些由 SC1b/SC1c 补充·此处可 []）\n';
          tp1 += '  · 人物/势力/阶层 updates 只给最要紧 3 条·不要凑数\n';
          tp1 += '  · shizhengji_basis 控制在 200 字内·不要长篇铺陈\n';
        } else if (_outCapK_G1 <= 8) {
          tp1 += '\n\n【模型能力中等·SC1 schema 中度精简】\n';
          tp1 += '  · 检测到单次输出 ≤ 8K tokens\n';
          tp1 += '  · cultural_works/npc_correspondence/fengwen_snippets 可 []（由 SC1b/SC1c 补充）\n';
          tp1 += '  · 核心字段 turn_summary/shizhengji_basis/edict_feedback/char_updates 必填\n';
        }
      } catch(_g1E) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_g1E, 'G1 schema prune') : console.warn('[G1 schema prune]', _g1E); }
      // G3·温度按子调用类型分：SC1 主推演叙事·保持 _modelTemp（常 0.8）
      var _sc1Temp = _modelTemp;
      // ★ Token 预算监控·SC1 prompt 接近 / 超出 context window 时报警 + 自动裁剪
      try {
        if (typeof checkPromptTokenBudget === 'function') {
          var _sc1FullPrompt = (sysP || '') + '\n' + (tp1 || '');
          var _sc1TokRes = checkPromptTokenBudget(_sc1FullPrompt, function(status, tokens, bg) {
            var msg = '[SC1] prompt ' + status + '·estimated ' + tokens + ' tokens·budget ' + bg.budget + ' (' + bg.contextK + 'K context)';
            if (typeof toast === 'function') toast(msg);
            if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(new Error(msg), 'SC1.tokenBudget');
          });
          if (typeof window !== 'undefined') {
            window.TM = window.TM || {}; window.TM.lastPromptTokens = window.TM.lastPromptTokens || {};
            window.TM.lastPromptTokens.sc1 = { tokens: _sc1TokRes.tokens, status: _sc1TokRes.status, budget: _sc1TokRes.budget.budget, trimmed: false, ts: Date.now() };
          }
          // critical → 双调用策略：Call A 压缩长段·Call B(SC1) 用压缩结果·保证质量不截断
          if (_sc1TokRes.status === 'critical' && tp1.length > 8000) {
            var _longSections = [
              { rx: /\n  帑廪·收源细目：[\s\S]*?(?=\n  帑廪·支用|\n  内帑·|\n  地方贡献|\n  户口|\n  民心|\n\n【|$)/, label: '帑廪收源' },
              { rx: /\n  帑廪·支用细目：[\s\S]*?(?=\n  内帑·|\n  地方贡献|\n  户口|\n  民心|\n\n【|$)/, label: '帑廪支用' },
              { rx: /\n  内帑·收源细目：[\s\S]*?(?=\n  内帑·支用|\n  地方贡献|\n  户口|\n  民心|\n\n【|$)/, label: '内帑收源' },
              { rx: /\n  内帑·支用细目：[\s\S]*?(?=\n  地方贡献|\n  户口|\n  民心|\n\n【|$)/, label: '内帑支用' },
              { rx: /\n  地方贡献占比·主税种：[\s\S]*?(?=\n  户口|\n  民心|\n\n【|$)/, label: '地方贡献' },
              { rx: /\n  民心·主要驱动：[\s\S]*?(?=\n\n【|$)/, label: '民心 14 源' },
              { rx: /\n  腐败·6部门：[\s\S]*?(?=\n  民心·|\n  14|\n\n【|$)/, label: '腐败 6 部门' },
              { rx: /\n  民心·分阶层：[\s\S]*?(?=\n  腐败·|\n\n【|$)/, label: '民心分阶层' },
              { rx: /【门阀家族】[\s\S]*?(?=\n【|\n\n【|$)/, label: '门阀家族' },
              { rx: /【近期NPC动向】[\s\S]*?(?=\n【|\n\n【|$)/, label: '近期NPC动向' }
            ];
            var _extracted = '';
            var _extractedLabels = [];
            _longSections.forEach(function(sect) {
              var match = tp1.match(sect.rx);
              if (match) {
                _extracted += '\n[' + sect.label + ']' + match[0];
                _extractedLabels.push(sect.label);
                tp1 = tp1.replace(sect.rx, '');
              }
            });
            // 仅当抽取出 > 1.5KB 内容时启动 Call A 压缩
            if (_extracted.length > 1500 && typeof callAIMessages === 'function') {
              var _callASys = '你是天命游戏的「财政民心摘要史官」·阅读以下原始数据·压缩为 ≤ 700 字的「关键观察清单」·要求：(1) 保留具体数字（如「田赋88万·盐课168万」）(2) 标注异常（如「四川田赋仅 6 万远低预期」）(3) 标注 top 1-2 个支柱地区 (4) 用 · 分隔条目·不写解释性废话';
              var _callAUser = _extracted;
              try {
                if (typeof toast === 'function') toast('[SC1] critical·启动 Call A 压缩长段...');
                var _callABody = {
                  model: P.ai.model || 'gpt-4o',
                  messages: [{ role: 'system', content: _callASys }, { role: 'user', content: _callAUser }],
                  temperature: 0.3,
                  max_tokens: _tok(1200)
                };
                var _callARaw = await callAIMessages(_callABody.messages, _callABody.max_tokens !== undefined ? _callABody.max_tokens : 1200, undefined, 'tier-low', { priority: 'critical' });
                var _summary = (typeof _callARaw === 'string')
                  ? _callARaw
                  : ((_callARaw && _callARaw.choices && _callARaw.choices[0] && _callARaw.choices[0].message && _callARaw.choices[0].message.content) || '');
                if (_summary.length > 100) {
                  // 把压缩结果嵌回 tp1 — 紧接七变量段后
                  var _injection = '\n\n【财政民心·压缩观察(原数据 ' + _extractedLabels.length + ' 段·共 ' + _extracted.length + ' 字 → 压缩 ' + _summary.length + ' 字)】\n' + _summary.trim() + '\n';
                  // 找一个合适注入点：「【行政区划·深化】」之前·或在 tp1 末尾增量
                  if (tp1.indexOf('\n\n【行政区划') >= 0) {
                    tp1 = tp1.replace(/\n\n【行政区划/, _injection + '\n\n【行政区划');
                  } else {
                    tp1 += _injection;
                  }
                  // 记录
                  window.TM.lastPromptTokens.sc1.compressed = {
                    sections: _extractedLabels,
                    rawChars: _extracted.length,
                    summaryChars: _summary.length,
                    callAModel: _callABody.model
                  };
                  if (typeof toast === 'function') toast('[SC1] Call A 压缩成功·' + _extracted.length + '字 → ' + _summary.length + '字');
                  // 重新检测 SC1 token
                  var _retok = checkPromptTokenBudget((sysP||'') + '\n' + tp1);
                  window.TM.lastPromptTokens.sc1.tokensAfter = _retok.tokens;
                  window.TM.lastPromptTokens.sc1.statusAfter = _retok.status;
                } else {
                  // Call A 失败·把抽取的内容贴回去（保证不丢）
                  tp1 += _extracted;
                  if (typeof toast === 'function') toast('[SC1] Call A 返回为空·已贴回原内容');
                }
              } catch(_callAErr) {
                // Call A 抛错·把抽取内容贴回去
                tp1 += _extracted;
                if (typeof toast === 'function') toast('[SC1] Call A 失败·已贴回原内容: ' + (_callAErr && _callAErr.message || ''));
                if (window.TM && TM.errors && TM.errors.captureSilent) TM.errors.captureSilent(_callAErr, 'SC1.callA');
              }
            } else if (_extracted.length > 0) {
              // 抽取到内容但太少·或 callAIMessages 不可用·贴回去
              tp1 += _extracted;
            }
            // ★ 硬截兜底(2026-06-21)：Call A 压缩后(或不可用时)仍超预算 → 按比例截 tp1 中段·
            //   保头(玩家圣旨/早期指令)保尾(输出约束/JSON 说明)·确保落入上下文窗口·免被服务端截断或报错。
            //   结构化输出由 API schema 参数强制·不依赖此文本·故截中段不破坏 JSON 结构。
            try {
              var _ht = checkPromptTokenBudget((sysP || '') + '\n' + tp1);
              var _htTarget = (_ht.budget && _ht.budget.warn80) ? _ht.budget.warn80 : Math.floor(((_ht.budget && _ht.budget.budget) || _ht.tokens) * 0.8);
              if (_ht.status === 'critical' && _ht.tokens > _htTarget && tp1.length > 4000) {
                var _htKeepRatio = Math.max(0.2, Math.min(0.95, _htTarget / _ht.tokens));
                var _htKeep = Math.floor(tp1.length * _htKeepRatio);
                var _htHead = Math.floor(_htKeep * 0.5);
                var _htTail = _htKeep - _htHead;
                if (_htHead > 300 && _htTail > 300 && (_htHead + _htTail) < tp1.length) {
                  var _htOmit = tp1.length - _htHead - _htTail;
                  tp1 = tp1.slice(0, _htHead)
                    + '\n\n【⚠ 上下文窗口不足·已硬截中段约 ' + _htOmit + ' 字以保关键首尾(玩家诏令/输出约束)·请据现有信息推演·缺失处勿臆造】\n\n'
                    + tp1.slice(tp1.length - _htTail);
                  if (typeof toast === 'function') toast('[SC1] 仍超预算·硬截中段 ' + _htOmit + ' 字保窗口');
                  if (window.TM && window.TM.lastPromptTokens && window.TM.lastPromptTokens.sc1) {
                    var _htAfter = checkPromptTokenBudget((sysP || '') + '\n' + tp1);
                    window.TM.lastPromptTokens.sc1.hardTrimmed = { omittedChars: _htOmit, tokensAfter: _htAfter.tokens, statusAfter: _htAfter.status };
                  }
                }
              }
            } catch (_htErr) {}
          }
        }
      } catch(_tokE) {}
      // ★ 后置强调（depth=0 等价物·LSR 范式）：把表操作规则投到 user prompt 末尾·克服长上下文头部衰减
      if (_memTblRule) tp1 += '\n\n' + _memTblRule;
      tp1 += '\n\n[Memory output contract]\n';
      tp1 += 'Optional field character_memory_updates must be an array. Each item must include actor, memory_type, memory, confidence, source_refs. ';
      tp1 += 'Use it only for durable actor-scoped memory: commitments, beliefs, grudges, favors, intentions, reputation, relationship changes. ';
      tp1 += 'Do not write hard_state here; deaths, offices, locations, resources, laws, and facts already owned by engine fields must stay in their proper schema fields. ';
      tp1 += 'memory_type must be one of commitment/belief/relationship/preference/grudge/favor/fear/intention/reputation; confidence is 0-1; source_refs must point to jishiRecords/courtRecords/events/edictTracker or another concrete source.\n';
      // Phase 3 A10·SC1 加 economic_advice 字段·SC17 让位·SC1 直接出经济分析
      // 旧·SC17 单独 LLM 调用产 fiscal_analysis/economic_advice·~$0.02/turn
      // 新·SC1 同 prompt 顺便出 economic_advice·SC17 skip·_specialtySummary.sc17 从 SC1.economic_advice 派生
      tp1 += '\n\n【新增字段·economic_advice (Phase 3 A10·SC17 已让位)】\n';
      tp1 += '  SC1 输出 JSON 需包含 "economic_advice"·string·100-200 字·内容·当前财政完整分析(收入来源/支出压力/盈亏)·通胀压力·下回合资源预测·应该做什么/不应该做什么·\n';
      tp1 += '  无突出经济变化也必须给出·至少给一句"国库平稳·税入正常"\n';

      // Memory Phase·SC1_PRE_CONTEXT：真实主推演前编译 Envelope/rollup 上下文，并写入 trace 供审计。
      try {
        if (global.TM && global.TM.MemoryContextCompiler && typeof global.TM.MemoryContextCompiler.compileFromGM === 'function') {
          var _sc1MemBudgetRaw = (P && P.conf && P.conf.memorySc1ContextTokenBudget != null)
            ? P.conf.memorySc1ContextTokenBudget
            : (P && P.conf && P.conf.memoryTurnContextTokenBudget);
          var _sc1MemBudget = Number(_sc1MemBudgetRaw == null ? 1800 : _sc1MemBudgetRaw);
          if (_sc1MemBudget > 0) {
            if (_sc1MemBudget < 300) _sc1MemBudget = 300;
            var _sc1MemCompileOpts = {
              turn: GM && GM.turn,
              audience: 'system',
              actorScope: 'system',
              intent: 'turn_inference',
              maxTokens: _sc1MemBudget,
              sc1q: (ctx && ctx.results && ctx.results.sc1q) || null
            };
            var _sc1CompiledContext = global.TM.MemoryContextCompiler.compileFromGM(GM, _sc1MemCompileOpts);
            if (_sc1CompiledContext && _sc1CompiledContext.text) {
              var _sc1MemoryBlock = '<memory-context-disclaimer>以下 SC1_PRE_CONTEXT 来自结构化记忆档案、编年/时政/人物 rollup 与权威账本投影；用于推演依据，不得覆盖本回合硬状态、死亡、任免、资源与显式诏令。</memory-context-disclaimer>\n' + _sc1CompiledContext.text;
              tp1 += '\n\n=== SC1_PRE_CONTEXT·structured memory context ===\n' + _sc1MemoryBlock;
              try {
                var _MT = global.TM && global.TM.MemoryTrace;
                if (_MT && typeof _MT.recordCompiledContext === 'function') {
                  _MT.recordCompiledContext(GM, {
                    id: 'SC1_PRE_CONTEXT',
                    stage: 'sc1-pre-inference',
                    lane: 'memory_context_compiler',
                    compiled: _sc1CompiledContext,
                    text: _sc1MemoryBlock,
                    intent: 'turn_inference',
                    audience: 'system',
                    actorScope: 'system',
                    maxTokens: _sc1MemBudget,
                    compileOpts: _sc1MemCompileOpts
                  });
                }
                if (_MT && typeof _MT.recordInjection === 'function') {
                  _MT.recordInjection(GM, {
                    lane: 'memory_context_compiler',
                    stage: 'sc1-pre-inference',
                    text: _sc1MemoryBlock,
                    items: _sc1CompiledContext.hits || [],
                    suppressed: _sc1CompiledContext.suppressed || [],
                    tokenEstimate: _sc1CompiledContext.tokenEstimate || 0
                  });
                }
              } catch(_sc1MemTraceE) { _dbg('[SC1_PRE_CONTEXT] trace fail:', _sc1MemTraceE); }
            }
          }
        }
      } catch(_sc1MemCtxE) {
        _dbg('[SC1_PRE_CONTEXT] compile fail:', _sc1MemCtxE);
        try { if (typeof recordSubcallError === 'function') recordSubcallError('sc1', 'memory_context_compile', _sc1MemCtxE); } catch(_) {}
      }

      // Phase 2.5·sc1q.required_sc1_actions LSR·prompt 末尾压住·让 SC1 必须 cover sc1q 给的硬性条目
      try {
        var _sc1qOutLsr = (ctx && ctx.results && ctx.results.sc1q) || null;
        if (_sc1qOutLsr && Array.isArray(_sc1qOutLsr.required_sc1_actions) && _sc1qOutLsr.required_sc1_actions.length > 0) {
          tp1 += '\n\n=== sc1q 硬性要求 (FINAL·不可遗漏) ===\n';
          tp1 += 'SC1 必须在 npc_actions / edict_feedback / char_updates / events 等字段中实现以下条目·缺一条都视为推演失败·\n';
          _sc1qOutLsr.required_sc1_actions.slice(0, 5).forEach(function(act, i) {
            tp1 += (i + 1) + '. ' + String(act).slice(0, 100) + '\n';
          });
        }
      } catch(_sc1qLsrE) {}
      // ①-S2 anomaly 强化：玩家有非常规举措时·要求 sc1 特别推演（开关 + 检出·放在格式约束前·属内容指令）
      if ((typeof agentFlagOn==='function' ? agentFlagOn('anomalyRoutingEnabled') : (P.conf && P.conf.anomalyRoutingEnabled)) && GM._turnAiResults && GM._turnAiResults.anomaly && GM._turnAiResults.anomaly.detected) {
        try {
          var _anomMv = GM._turnAiResults.anomaly.moves || [];
          var _anomTxt = _anomMv.map(function(m){ return '「' + ((m && m.what) || '') + '」(' + ((m && m.why_uncommon) || '') + ')'; }).join('·');
          if (_anomTxt) {
            tp1 += '\n\n=== 非常规举措·特别推演要求 (玩家自由动作·须硬核可信) ===\n'
                 + '玩家本回合有越出常规的举措：' + _anomTxt + '。\n'
                 + '务必：(1) 严肃考量其历史先例与现实可行性·不可套路化或敷衍；(2) 推演其可能引发的非常规连锁反应(制度/人心/势力/财政)；(3) 若 SC_RECALL 注入了相关历史先例·参照其成败据实推演；(4) 不因其罕见而回避后果·也不夸大到失真。';
          }
        } catch(_anomInjE) {}
      }
      // Phase 0 D-2·SC1 JSON-only 强约束 LSR·prompt 末尾压住 (大上下文衰减时模型最易丢 JSON 格式)
      tp1 += '\n\n=== 输出格式强约束 (FINAL RULE·不可违反) ===\n'
           + 'YOU MUST RETURN JSON ONLY. 不要包裹 markdown 代码块·不要前言·不要解释·不要附加任何 prose。\n'
           + '第一个字符必须是 `{`·最后一个字符必须是 `}`。任何非 JSON 字符都会导致整回合推演失败·后续 sc1b/sc1c/sc1d/sc2 等子调用会全部降级。\n'
           + '若某段叙事字段超出长度·宁可截短不要省略 JSON 结构。';
      var _sc1Body = {model:P.ai.model||"gpt-4o",messages:[{role:"system",content:_maybeCacheSys(sysPFor('sc1'))},{role:"user",content:tp1}],temperature:_sc1Temp,max_tokens:_tok(_sc1BaseTok)};
      // Phase 6 Q1·strict json_schema 优先 (P.ai.openaiStrict=true)·否则 json_object
      var _sc1Rf = _selectResponseFormat(_modelFamily, _buildSc1JsonSchema);
      if (_sc1Rf) _sc1Body.response_format = _sc1Rf;
      var _streamSC1 = !!(P.ai && P.ai.stream_sc1 === true);  // Phase 0 D-1·默认关·需 P.ai.stream_sc1=true 显式开 (stream 用于进度条不打 JSON 抢救)
      var c1 = "";
      var data1 = null;
      var _sc1Call = null;
      var _sc1CriticalError = null;
      if (_streamSC1) {
        // 流式·边接收边更新进度条（不尝试 partial JSON parse·避免数据损坏）
        _sc1Body.stream = true;
        try {
          var _sc1PolicyForStream = ns.getCallPolicy('sc1');
          c1 = await callAIMessagesStream(_sc1Body.messages, _sc1Body.max_tokens !== undefined ? _sc1Body.max_tokens : _sc1BaseTok, {
            priority: 'critical',
            timeoutMs: _sc1PolicyForStream.timeoutMs,
            temperature: _sc1Temp,
            extraBody: _modelFamily === 'openai' ? { response_format: { type: 'json_object' } } : undefined,
            onChunk: function(text) {
              // 按字数大致估算进度：5K字约 55%·10K约 60%·15K约 65%
              var _approx = 50 + Math.min(15, Math.floor(text.length / 1500));
              showLoading('AI\u63A8\u6F14\u4E2D\u00B7\u5DF2\u751F\u6210' + Math.round(text.length/100)/10 + 'k\u5B57', _approx);
            }
          });
          data1 = { choices: [{ message: { content: c1 } }] };
          // 流式模式无 usage·不记 token
        } catch(_se) {
          _dbg('[SC1 stream] failed·fallback to fetch:', _se);
          _sc1CriticalError = _se;
          _streamSC1 = false;
        }
      }
      if (!_streamSC1) {
        delete _sc1Body.stream;  // 确保 fallback 不发 stream:true
        try {
          _sc1Call = await _callEndturnAI(_sc1Body, {
            id: 'sc1',
            label: '结构化数据',
            expectedKeys: ['turn_summary', 'shizhengji_basis', 'events', 'resource_changes', 'char_updates', 'edict_feedback', 'fiscal_adjustments', 'changes'],
            priority: 'critical'
          });
          data1 = _sc1Call.data;
          c1 = _sc1Call.raw || '';
        } catch(_sc1FetchErr) {
          // Phase 6 Q1-3·strict json_schema 失败 → 自动 fallback to json_object 重试一次
          var _isStrictErr = (_sc1Body.response_format && _sc1Body.response_format.type === 'json_schema');
          if (_isStrictErr) {
            console.warn('[SC1] strict json_schema 失败·fallback to json_object:', _sc1FetchErr && _sc1FetchErr.message);
            if (typeof recordSubcallError === 'function') recordSubcallError('sc1', 'strict_schema_fallback', _sc1FetchErr);
            _sc1Body.response_format = { type: 'json_object' };
            try {
              _sc1Call = await _callEndturnAI(_sc1Body, {
                id: 'sc1', label: '结构化数据·fallback',
                expectedKeys: ['turn_summary', 'shizhengji_basis', 'events', 'resource_changes', 'char_updates', 'edict_feedback', 'fiscal_adjustments', 'changes'],
                priority: 'critical'
              });
              data1 = _sc1Call.data;
              c1 = _sc1Call.raw || '';
              if (GM && GM._turnAiResults) GM._turnAiResults._sc1StrictFallback = true;
            } catch(_sc1Retry) {
              _sc1CriticalError = _sc1Retry;
              data1 = null;
              c1 = c1 || '';
              console.warn('[SC1] strict fallback also failed:', _sc1Retry && _sc1Retry.message);
            }
          } else {
            _sc1CriticalError = _sc1FetchErr;
            data1 = null;
            c1 = c1 || '';
            console.warn('[SC1] critical call failed·will continue to fallback chain:', _sc1FetchErr && (_sc1FetchErr.message || _sc1FetchErr));
          }
        }
      }
      p1=null; // 赋值到外层声明的p1
      try {
        if (data1) _checkTruncated(data1, '结构化数据');
        var _p1Parse = (_sc1Call && _sc1Call.parse) || await _parseOrRepairJsonResult(c1, data1, '结构化数据', { url: url, key: P.ai.key, body: _sc1Body, expectedKeys: ['turn_summary', 'shizhengji_basis', 'events', 'resource_changes', 'char_updates', 'edict_feedback', 'fiscal_adjustments', 'changes'], priority: 'critical' });
        if (_p1Parse && _p1Parse.raw) c1 = _p1Parse.raw;
        p1 = _p1Parse ? _p1Parse.parsed : null;
      } catch(_sc1ParseErr) {
        _sc1CriticalError = _sc1ParseErr;
        p1 = null;
        console.warn('[SC1] parse/repair failed·will continue to fallback chain:', _sc1ParseErr && (_sc1ParseErr.message || _sc1ParseErr));
      }
      // Phase 7 Q4·SC1 增量 retry·若 p1 有但缺关键字段·先 incremental retry·再 rescue
      if (p1 && typeof p1 === 'object' && !_hasSc1StructuredResult(p1)) {
        var _missing = _findMissingSc1Fields(p1);
        if (_missing.length > 3) {
          var _incFilled = await _runIncrementalSc1Retry(p1, _missing);
          if (_incFilled && _hasSc1StructuredResult(_incFilled)) {
            p1 = _incFilled;
            _dbg('[SC1 Q4] incremental retry 成功·跳过 rescue');
          }
        }
      }
      if (!p1 || !_hasSc1StructuredResult(p1)) {
        var _rescuedSc1 = await _trySc1Rescue(_sc1CriticalError || 'primary SC1 empty');
        if (_rescuedSc1 && _rescuedSc1.parsed) {
          p1 = _rescuedSc1.parsed;
          c1 = _rescuedSc1.raw || c1 || JSON.stringify(p1);
          data1 = _rescuedSc1.data || data1;
          _sc1CriticalError = null;
          if (typeof toast === 'function') toast('⚠ SC1主结构化不稳定·已用轻量结构化救援账本继续');
        }
      }
      GM._turnAiResults.subcall1_raw = c1;
      GM._turnAiResults.subcall1 = p1;

      // Phase 2.5 (2.5.5)·sc1q 覆盖率检查·SC1 是否 cover 了所有 sc1q.dialogue_commitments 的 NPC
      // 漏掉的 commit 标到 GM._sc1qMissedLastTurn·下回合 sc1q prompt 优先强调
      try {
        var _sc1qOut = (ctx && ctx.results && ctx.results.sc1q) || (GM._turnAiResults && GM._turnAiResults.subcall1q) || null;
        if (_sc1qOut && Array.isArray(_sc1qOut.dialogue_commitments) && _sc1qOut.dialogue_commitments.length > 0) {
          var _covered = new Set();
          // sc1 cover 来源·npc_actions·char_updates·dialogue_commitment_feedback·commitment_update·event.title 含 NPC
          (p1.npc_actions || []).forEach(function(a) { if (a && a.name) _covered.add(a.name); });
          (p1.char_updates || []).forEach(function(c) { if (c && c.name) _covered.add(c.name); });
          (p1.dialogue_commitment_feedback || []).forEach(function(d) { if (d && d.npc) _covered.add(d.npc); });
          (p1.commitment_update || []).forEach(function(cu) {
            // commitment_update 用 id·从 GM._npcCommitments 反查 NPC 名
            if (!cu || !cu.id || !GM._npcCommitments) return;
            Object.keys(GM._npcCommitments).forEach(function(nm) {
              var arr = GM._npcCommitments[nm] || [];
              if (arr.some(function(c){ return c && c.id === cu.id; })) _covered.add(nm);
            });
          });
          var _missed = [];
          _sc1qOut.dialogue_commitments.forEach(function(dc) {
            if (!dc || !dc.npc) return;
            if (!_covered.has(dc.npc)) _missed.push({ npc: dc.npc, task: dc.task, source_type: dc.source_type, source_conv_id: dc.source_conv_id });
          });
          if (_missed.length > 0) {
            GM._sc1qMissedLastTurn = _missed.slice(0, 10);
            if (ctx && ctx.meta) {
              ctx.meta.warnings = ctx.meta.warnings || [];
              ctx.meta.warnings.push({ kind: 'sc1q_coverage', missed: _missed.length, sample: _missed.slice(0, 3) });
            }
            _dbg('[sc1q coverage] missed ' + _missed.length + ' commitments·will emphasize next turn');
          } else {
            GM._sc1qMissedLastTurn = [];
          }
        }
      } catch(_covE) { _dbg('[sc1q coverage] check fail', _covE); }

      // ★ P11.2B 诏令冲突链消费端（KokoroMemo graph.py 范式）
      try {
        if (p1 && Array.isArray(p1.edict_relations) && p1.edict_relations.length > 0) {
          if (!Array.isArray(GM._edictRelations)) GM._edictRelations = [];
          var _curT = GM.turn || 1;
          p1.edict_relations.forEach(function(er) {
            if (!er || !er.from || !er.to || !er.type) return;
            var validTypes = ['supersedes', 'contradicts', 'continues', 'elaborates'];
            if (validTypes.indexOf(er.type) < 0) return;
            GM._edictRelations.push({
              from: String(er.from).slice(0, 40),
              to: String(er.to).slice(0, 40),
              type: er.type,
              reason: String(er.reason || '').slice(0, 80),
              turn: _curT
            });
          });
          // LRU 100 条
          if (GM._edictRelations.length > 100) GM._edictRelations = GM._edictRelations.slice(-100);
          _dbg('[EdictRelations] 本回合新增', p1.edict_relations.length, '条·总计', GM._edictRelations.length);
        }
      } catch(_erE) { _dbg('[EdictRelations] 解析失败:', _erE); }

      // ★ 应用 12 表更新·三通道兼容（Phase 5.3 修 OpenAI response_format='json_object' 屏蔽 <tableEdit> 的致命 bug）
      try {
        if (window.MemTables) {
          function _stableMemTableValue(value) {
            if (value == null) return '';
            if (typeof value !== 'object') return String(value);
            if (Array.isArray(value)) return '[' + value.map(_stableMemTableValue).join(',') + ']';
            return '{' + Object.keys(value).sort().map(function(k) {
              return k + ':' + _stableMemTableValue(value[k]);
            }).join(',') + '}';
          }
          function _dedupeMemTableOps(ops) {
            var seen = {};
            var out = [];
            (Array.isArray(ops) ? ops : []).forEach(function(op) {
              if (!op) return;
              var key = [
                String(op.cmd || ''),
                String(op.tableIdx != null ? op.tableIdx : ''),
                String(op.rowIdx != null ? op.rowIdx : ''),
                _stableMemTableValue(op.values || {})
              ].join('|');
              if (seen[key]) return;
              seen[key] = true;
              out.push(op);
            });
            return out;
          }
          var _mtTotalOps = [];
          // 通道 A：sc1 JSON 字段 p1.table_updates 数组（OpenAI 强制 json_object 时唯一可走通道·结构化最稳）
          if (p1 && Array.isArray(p1.table_updates) && p1.table_updates.length > 0) {
            p1.table_updates.forEach(function(d) {
              if (!d || !d.sheet) return;
              var def = MemTables.SHEET_BY_KEY[d.sheet] || MemTables.SHEET_BY_IDX[d.sheet];
              if (!def) return;
              var cmd = (d.op || d.cmd || 'insert').toLowerCase();
              var rowIdx = (typeof d.rowIdx === 'number') ? d.rowIdx : parseInt(d.rowIdx, 10);
              if ((cmd === 'update' || cmd === 'delete') && (isNaN(rowIdx) || rowIdx < 0)) return;
              _mtTotalOps.push({
                cmd: cmd,
                tableIdx: def.idx,
                rowIdx: isNaN(rowIdx) ? null : rowIdx,
                values: d.values || {}
              });
            });
          }
          // 通道 B：p1.tableEdit 字符串（AI 输出 JSON 中带 tableEdit 字段）
          // 通道 C：c1 文本中嵌入 <tableEdit> 块（Anthropic/Gemini 无 response_format 限制时可走）
          var _mtEditText = (p1 && typeof p1.tableEdit === 'string') ? p1.tableEdit : c1;
          if (_mtEditText && (_mtEditText.indexOf('<tableEdit>') >= 0 || _mtEditText.indexOf('insertRow(') >= 0)) {
            var _mtParsed = MemTables.parseTableEdit(_mtEditText);
            if (_mtParsed && _mtParsed.ops && _mtParsed.ops.length > 0) {
              _mtTotalOps = _mtTotalOps.concat(_mtParsed.ops);
            }
          }
          if (_mtTotalOps.length > 0) {
            _mtTotalOps = _dedupeMemTableOps(_mtTotalOps);
            var _mtStats = MemTables.applyAIOps(_mtTotalOps, { actor: 'ai' });
            _dbg('[MemTables sc1] applied:', _mtStats,
                 '·channels: json=' + ((p1 && p1.table_updates) ? p1.table_updates.length : 0) +
                 ' xml=' + ((_mtEditText && _mtEditText.indexOf('<tableEdit>') >= 0) ? 'y' : 'n'));
          }
          // 一致性哨兵·sc1 之后扫一遍
          if (MemTables.runConsistencySentinel) {
            var _mtWarns = MemTables.runConsistencySentinel((typeof GM !== 'undefined' && GM && GM.turn) || 1);
            if (_mtWarns && _mtWarns.length) _dbg('[MemTables sentinel]', _mtWarns.length, 'warnings');
          }
        }
      } catch(_mtAE) { _dbg('[MemTables sc1 apply] fail:', _mtAE); }
      // 校验 AI 输出结构（非阻断）
      try { if (window.TM && TM.validateAIOutput) TM.validateAIOutput(p1, 'subcall1'); } catch(_ve){}

      // ═══ Sub-call 1b + 1c + 1d · 并行执行（S3 优化）════════════════════════
      // 三者无交集字段，通过 async IIFE 并行启动，Promise.all 等待
      var _sc1dP = (async function() {
      // Sub-call 1d · 实录/时政记专项：SC1 只判账本，此处把账本改写为史官文本。
      try {
        // Phase 0 Q3·_seedFromBasicFacts·SC1 失败时不再早 return·从 edicts/player_status 兜底成文
        // 让玩家即使 SC1 大塌也能看到一段史官文字·而非空白回合
        if (!p1 || typeof p1 !== 'object') {
          p1 = {
            turn_summary: '',
            shizhengji_basis: '',
            player_status: (typeof xinglu === 'string' ? xinglu : ''),
            edict_feedback: Array.isArray(edicts && edicts.list) ? edicts.list.map(function(e){ return { content:(e && e.content) || '', status:'pending', feedback:'SC1 失败·兜底叙述' }; }).slice(0, 12) : [],
            events: [], resource_changes: {}, fiscal_adjustments: [],
            currency_adjustments: [], population_adjustments: [], central_local_actions: [], environment_actions: [], institution_changes: [],
            char_updates: [], personnel_changes: [], office_changes: [],
            office_assignments: [], faction_events: [], faction_changes: [],
            army_changes: [], province_changes: [],
            _sc1dSeedFallback: true
          };
        }
        var _sc1dStart = Date.now();
        showLoading('史官成文', 57);
        function _packSc1d(v, max) {
          var s = '';
          try { s = JSON.stringify(v || null); } catch(_) { s = String(v || ''); }
          return s.slice(0, max || 6000);
        }
        var _facts1d = {
          turn_summary: p1.turn_summary || '',
          shizhengji_basis: p1.shizhengji_basis || '',
          player_status: p1.player_status || p1.playerStatus || '',
          edict_feedback: Array.isArray(p1.edict_feedback) ? p1.edict_feedback.slice(0, 16) : [],
          events: Array.isArray(p1.events) ? p1.events.slice(0, 16) : [],
          resource_changes: p1.resource_changes || {},
          fiscal_adjustments: Array.isArray(p1.fiscal_adjustments) ? p1.fiscal_adjustments.slice(0, 16) : [],
          currency_adjustments: Array.isArray(p1.currency_adjustments) ? p1.currency_adjustments.slice(0, 16) : [],
          population_adjustments: Array.isArray(p1.population_adjustments) ? p1.population_adjustments.slice(0, 16) : [],
          central_local_actions: Array.isArray(p1.central_local_actions) ? p1.central_local_actions.slice(0, 16) : [],
          environment_actions: Array.isArray(p1.environment_actions) ? p1.environment_actions.slice(0, 16) : [],
          institution_changes: Array.isArray(p1.institution_changes) ? p1.institution_changes.slice(0, 16) : [],
          char_updates: Array.isArray(p1.char_updates) ? p1.char_updates.slice(0, 16) : [],
          personnel_changes: Array.isArray(p1.personnel_changes) ? p1.personnel_changes.slice(0, 12) : [],
          office_changes: Array.isArray(p1.office_changes) ? p1.office_changes.slice(0, 12) : [],
          office_assignments: Array.isArray(p1.office_assignments) ? p1.office_assignments.slice(0, 12) : [],
          faction_events: Array.isArray(p1.faction_events) ? p1.faction_events.slice(0, 12) : [],
          faction_changes: Array.isArray(p1.faction_changes) ? p1.faction_changes.slice(0, 12) : [],
          army_changes: Array.isArray(p1.army_changes) ? p1.army_changes.slice(0, 12) : [],
          province_changes: Array.isArray(p1.province_changes) ? p1.province_changes.slice(0, 12) : []
        };
        // Phase 2 Slice 5·SC1d 全面解耦·p1 字段缺失/空时·从 edicts/GM 补·让 SC1d 永远有素材成文
        // 旧·完全依赖 p1·p1 部分缺失则 SC1d prompt 干瘪·容易写空泛
        // 新·三层兜底·p1.field || edicts/GM 派生 || ''·sysP 已说"只改写不创造"·SC1d 仍守约束·只是有更丰满素材
        try {
          if (!_facts1d.edict_feedback.length && edicts) {
            var _eList = (edicts && edicts.list) || (Array.isArray(edicts) ? edicts : []);
            if (Array.isArray(_eList) && _eList.length) {
              _facts1d.edict_feedback = _eList.slice(0, 16).map(function(e) {
                return { content: (e && (e.content || e.text)) || '', assignee: (e && e.assignee) || '', status: 'pending', feedback: '本回合开始执行·SC1 未给出明确反馈·按"在途"叙述', progressPercent: 0 };
              });
              _facts1d._edictsSupplemented = true;
            }
          }
          if (!_facts1d.player_status && P && P.playerInfo) {
            _facts1d.player_status = (P.playerInfo.characterName ? P.playerInfo.characterName + ' ' : '') + '在朝·' + (GM._capital || P.playerInfo.capital || '京城') + '·维持现有政局';
          }
          if (!_facts1d.turn_summary && _facts1d._edictsSupplemented) {
            _facts1d.turn_summary = '本回合主要处理玩家颁布的 ' + _facts1d.edict_feedback.length + ' 条诏令，余者朝局照常。';
            _facts1d._fallbackNote = 'SC1 main inference unstable; SC1d composed from edicts (debug-only, not player-facing)';
          }
        } catch(_supplE) { _dbg('[SC1d Slice 5] supplement fail', _supplE); }
        var _dateText1d = ''; try { _dateText1d = (typeof getTSText === 'function') ? getTSText(GM.turn || 1) : ''; } catch(_) {}
        var tp1d = '【实录·时政记专项】\n';
        tp1d += '你只负责把 SC1 已判定的结构化账本改写为史官文本，不得新增任何事实、数值、死亡、任免、战事或地块变化。\n';
        tp1d += '本回合：T' + (GM.turn || 1) + (_dateText1d ? (' · ' + _dateText1d) : '') + '\n';
        tp1d += '玩家诏令/行止原始摘要：' + _packSc1d({ edicts: edicts || {}, xinglu: xinglu || '' }, 2500) + '\n';
        tp1d += 'SC1结构化账本：' + _packSc1d(_facts1d, 12000) + '\n\n';
        // 【sc1d 升级·D1】给时政记喂涉事 NPC 的认知/关系线索(所求/势/视上/睦/隙)——兄弟 sc1b/sc1c 都吃·时政记要写"谁办的·遇何阻力"却看不到 → 复用 _cogRelCueSC。
        try {
          var _d1Names = {};
          if (p1 && Array.isArray(p1.npc_actions)) p1.npc_actions.forEach(function(a){ var n = a && (a.npc || a.name); if (n) _d1Names[n] = 1; });
          if (p1 && Array.isArray(p1.char_updates)) p1.char_updates.forEach(function(u){ var n = u && (u.name || u.npc); if (n) _d1Names[n] = 1; });
          if (p1 && Array.isArray(p1.dialogue_commitment_feedback)) p1.dialogue_commitment_feedback.forEach(function(d){ if (d && d.npc) _d1Names[d.npc] = 1; });
          var _d1Cue = '';
          Object.keys(_d1Names).slice(0, 12).forEach(function(nm){
            var _ch = (typeof findCharByName === 'function') ? findCharByName(nm) : null;
            if (!_ch) return;
            var cue = _cogRelCueSC(_ch);
            if (cue) _d1Cue += '  · ' + nm + cue + '\n';
          });
          if (_d1Cue) tp1d += '涉事人物底细(所求/势/视上/睦/隙·据此写执行者动机与阻力·勿凭空)：\n' + _d1Cue + '\n';
        } catch(_d1E) {}
        // 【sc1d 升级·D2】往期未结朝议决议喂给时政记(它须逐条复述朝议·却从没见过 _courtResolutions)。
        try {
          if (Array.isArray(GM._courtResolutions) && GM._courtResolutions.length) {
            var _curTd = GM.turn || 1;
            var _pendCRd = GM._courtResolutions.filter(function(r){ return r && (r.status === 'pending' || r.status === 'stalled') && r.turn < _curTd; }).slice(-6);
            if (_pendCRd.length) {
              tp1d += '往期未结朝议决议(须在时政记中交代其进展/搁置)：\n';
              _pendCRd.forEach(function(r){ tp1d += '  · [T' + r.turn + '·' + (r.forum||'?') + '·' + r.status + '] ' + String(r.topic||'').slice(0,40) + ' → ' + String(r.decision||'').slice(0,60) + '\n'; });
              tp1d += '\n';
            }
          }
        } catch(_d2E) {}
        tp1d += '请返回严格 JSON，只包含以下字段：\n';
        tp1d += '{"shilu_text":"实录' + _shiluMin + '-' + _shiluMax + '字。纯文言史官体，仿《资治通鉴》《明实录》，以月日/是月/上命为句式，只记可验证事实，不评论。","szj_title":"时政记副标题，七字对仗两句，用顿号或逗号分隔。","shizhengji":"时政记正文' + _szjMin + '-' + _szjMax + '字。仿朝政纪要体，分3-5段，逐条复述玩家诏令/奏疏批复/问对朝议，并写执行者、执行过程、阻力、实际效果、遗留隐患。不得编造 SC1 账本没有的变化。","szj_summary":"时政记总结一句话，概括局势与隐患。"}';
        tp1d += '\n可选字段 basis_refs：数组，列出 shilu_text/shizhengji 所依据的 SC1 字段、诏令、问对或奏疏摘要；不得把 basis_refs 当作新增事实。';
        tp1d += '\n可选字段 zhengwen：一段独立的"史臣曰/朝野时评"(80-160字·带立场的短评论断·区别于时政记的纪实体·不新增事实)；若无从评则留空。';
        var _sc1dBaseTok = Math.min(_effectiveOutCap || 7000, 7000);
        var _sc1dBody = {model:P.ai.model||'gpt-4o', messages:[{role:'system', content:_maybeCacheSys(sysPFor('sc1d'))}, {role:'user', content:tp1d}], temperature:Math.max(0.35, Math.min(0.75, _modelTemp || 0.6)), max_tokens:_tok(_sc1dBaseTok)};
        if (_modelFamily === 'openai') _sc1dBody.response_format = { type:'json_object' };
        var _sc1dCall = await _callEndturnAI(_sc1dBody, {
          id: 'sc1d',
          label: '实录时政',
          expectedKeys: ['shilu_text', 'shizhengji', 'szj_title', 'szj_summary'],
          priority: 'high'
        });
        if (_sc1dCall && _sc1dCall.data) _checkTruncated(_sc1dCall.data, '实录时政');
        var c1d = (_sc1dCall && _sc1dCall.raw) || '';
        var p1d = (_sc1dCall && _sc1dCall.parse) ? _sc1dCall.parse.parsed : null;
        if (p1d) {
          GM._turnAiResults.subcall1d_raw = c1d;
          GM._turnAiResults.subcall1d = p1d;
          p1.shilu_text = p1d.shilu_text || p1d.shilu || p1.shilu_text || '';
          p1.szj_title = p1d.szj_title || p1d.shizhengji_title || p1d.title || p1.szj_title || '';
          p1.shizhengji = p1d.shizhengji || p1d.shizheng || p1d.szj || p1.shizhengji || '';
          p1.szj_summary = p1d.szj_summary || p1d.shizhengji_summary || p1d.summary || p1.szj_summary || '';
          if (Array.isArray(p1d.basis_refs)) p1.basis_refs = p1d.basis_refs.slice(0, 16);
          if (p1d.zhengwen && String(p1d.zhengwen).trim()) p1.zhengwen = String(p1d.zhengwen);   // 【sc1d·D3】优先用 sc1d 独立时评(治 zhengwen 逐字拷贝 shizhengji 的 degenerate)
          else if (!p1.zhengwen) p1.zhengwen = p1.shizhengji;   // 无独立时评仍回退拷贝·不空政文面板
          GM._turnAiResults.subcall1 = p1;
          ctx.results.sc1d = p1d;
          // 【sc1d 升级·D4】账本空洞(SC1 兜底/字段全空)时标记叙述·让下游(起居注/史记/records UI)知其"无实据成文"·勿当权威史实。
          try {
            var _hlw = !!(p1 && p1._sc1dSeedFallback);
            if (!_hlw) {
              var _ht = (_facts1d.turn_summary && _facts1d.turn_summary.length > 4) || (_facts1d.shizhengji_basis && _facts1d.shizhengji_basis.length > 4);
              var _hr = ['edict_feedback','events','fiscal_adjustments','char_updates','personnel_changes','office_changes','faction_events','faction_changes','army_changes','central_local_actions','institution_changes'].some(function(k){ return Array.isArray(_facts1d[k]) && _facts1d[k].length > 0; });
              _hlw = !_ht && !_hr;
            }
            if (_hlw) { p1._shiluHollow = true; p1d._hollowLedger = true; GM._turnAiResults._sc1dHollow = true; _dbg('[sc1d·D4] 账本空洞·叙述标 _shiluHollow(下游勿当权威史实)'); }
          } catch(_d4E) {}
        }
        GM._subcallTimings.sc1d = Date.now() - _sc1dStart;
      } catch(_sc1dErr) {
        console.warn('[sc1d] 失败（不影响主流程）:', _sc1dErr.message || _sc1dErr);
        p1 = _attachSc1RecordFallback(p1, _sc1dErr);
        if (GM && GM._turnAiResults) GM._turnAiResults.subcall1 = p1;
      }
      })();

      // 【sc1b/sc1c 升级·C2/B1】共享:把 sc07 的 _npcCognition(所求/朝局判断/视上)+ NPC 间关系(睦/隙)压成紧凑线索——
      //   让书信/阴谋/结盟不再无视「谁想要什么·谁信谁·谁恨谁」这两大既有富数据源(此前 sc1b/sc1c 只看对玩家亲和)。
      function _cogRelCueSC(c) {
        if (!c || !c.name) return '';
        var bits = [];
        var cg = (typeof GM !== 'undefined' && GM._npcCognition && GM._npcCognition[c.name]);
        if (cg) {
          if (cg.agenda) bits.push('求:' + String(cg.agenda).slice(0, 16));
          if (cg.situationRead) bits.push('势:' + String(cg.situationRead).slice(0, 16));
          if (cg.attitudeTowardsPlayer) bits.push('视上:' + String(cg.attitudeTowardsPlayer).slice(0, 12));
        }
        if (c.relations && typeof c.relations === 'object') {
          var rel = Object.keys(c.relations).map(function(rn){ var r = c.relations[rn] || {}; var _af = Number(r.affinity); return { n: rn, aff: isFinite(_af) ? _af : 50, host: Number(r.hostility) || 0 }; });   /* Codex 审查修·F3:affinity:0(死敌)勿被 ||50 当中性 */
          var close = rel.filter(function(r){ return r.aff >= 65; }).sort(function(a, b){ return b.aff - a.aff; }).slice(0, 2);
          var foe = rel.filter(function(r){ return r.host >= 25 || r.aff <= 30; }).sort(function(a, b){ return (b.host - b.aff) - (a.host - a.aff); }).slice(0, 2);
          if (close.length) bits.push('睦:' + close.map(function(r){ return r.n; }).join('/'));
          if (foe.length) bits.push('隙:' + foe.map(function(r){ return r.n; }).join('/'));
        }
        return bits.length ? (' ⟨' + bits.join('·') + '⟩') : '';
      }

      var _sc1bP = (async function() {
      // ═══ Sub-call 1b · 文事鸿雁人际专项（独立预算 8k，避免文事/鸿雁/互动被 sc1 庞大 schema 挤出）═══
      try {
        var _sc1bStart = Date.now();
        showLoading('\u6587\u4E8B\u00B7\u52BF\u529B\u00B7\u5E76\u884C\u63A8\u6F14', 58);

        var _charsBriefB = '';
        try {
          var _liveCharsB = (GM.chars||[]).filter(function(c){return c && c.alive!==false;});
          _liveCharsB.sort(function(a,b){return (a.rank||99)-(b.rank||99);});
          var _briefListB = _liveCharsB.slice(0,24).map(function(c){
            var _p = c.name;
            if (c.officialTitle) _p += '\u00B7' + c.officialTitle;
            if (c.location) _p += '@' + c.location;
            if (c.faction) _p += '[' + c.faction + ']';
            _p += ' \u5FE0' + (c.loyalty||50) + '\u00B7\u667A' + (c.intelligence||50) + '\u00B7\u5B66' + (c.scholarship||c.intelligence||50);
            var _favA = (typeof AffinityMap !== 'undefined' && AffinityMap.get) ? (AffinityMap.get(c.name, (P.playerInfo && P.playerInfo.characterName) || '') || 0) : 0;
            if (_favA) _p += (_favA > 0 ? '\u00B7\u53D7\u6069' : '\u00B7\u79EF\u6028') + Math.abs(_favA);
            if (Array.isArray(c.traits) && c.traits.length) _p += ' \u7279{' + c.traits.slice(0,3).join(',') + '}';
            _p += _cogRelCueSC(c);   // 【B1】写信人认知(所求/口吻由认知带)+ 与他人交情(睦/隙·谁给谁写信)
            return _p;
          });
          _charsBriefB = _briefListB.join('\n');
        } catch(_cbE){}

        var _capB = (GM._capital) || (P.playerInfo && P.playerInfo.capital) || '\u4EAC\u57CE';
        var _pNameB = (P.playerInfo && P.playerInfo.characterName) || '';
        var _recentSZJ = (p1 && (p1.shizhengji || p1.shizhengji_basis || p1.turn_summary)) ? String(p1.shizhengji || p1.shizhengji_basis || p1.turn_summary).slice(0,1500) : '';

        var tp1b = '\u3010\u6587\u4E8B\u00B7\u9E3F\u96C1\u00B7\u4EBA\u9645\u4E92\u52A8\u00B7\u4E13\u9879\u63A8\u6F14\u3011\n';
        tp1b += '\u672C\u56DE\u5408\uFF1A' + (GM.turn||1) + ' \u00B7 ' + (typeof getTSText==='function'?getTSText(GM.turn):'') + ' \u00B7 \u9996\u90FD\uFF1A' + _capB + '\n';
        if (_pNameB) tp1b += '\u73A9\u5BB6\u89D2\u8272\uFF1A' + _pNameB + '\uFF08\u4E0D\u5F97\u4F5C\u4E3A npc_interactions.actor\uFF0C\u4E0D\u5F97 autonomous \u4F5C cultural_works\uFF09\n';
        if (_recentSZJ) tp1b += '\n\u3010\u672C\u56DE\u5408\u5DF2\u8BB0\u65F6\u653F\u3011\n' + _recentSZJ + '\n';
        if (_charsBriefB) tp1b += '\n\u3010\u4E3B\u8981\u4EBA\u7269\uFF08\u542B\u4F4D\u7F6E/\u5B98\u804C/\u6D3E\u7CFB/\u7279\u8D28\uFF09\u3011\n' + _charsBriefB + '\n';
        // 长期事势注入·让后人戏说/鸿雁/密信能涉及多年未竣的工程
        if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAIContextString) {
          var _chronCtxB = ChronicleTracker.getAIContextString();
          if (_chronCtxB) {
            tp1b += '\n' + _chronCtxB + '\n';
            tp1b += '\n\u3010\u2605 \u957F\u671F\u4E8B\u52BF\u7A7F\u900F\u5230\u6587\u4E8B/\u9E3F\u96C1/\u5BC6\u4FE1\u3011\n';
            tp1b += '  \u00B7 cultural_works(\u540E\u4EBA\u620F\u8BF4/\u6587\u82D1\u4F5C\u54C1)\uFF1A\u8FDB\u5EA6 \u226570% \u5DE5\u7A0B\u00B7\u76F8\u5173 NPC \u5F53\u4F5C\u300C\u9882\u529F\u8BD7\u8D4B/\u54CF\u53F9\u5DE5\u827A\u300D\u00B7\u8FDB\u5EA6 <20% \u5386\u591A\u56DE\u5408\u00B7\u5F53\u4F5C\u300C\u8BBD\u523A\u8BD7/\u5F39\u52BE\u6587/\u6C11\u8C23\u8BAF\u4E4B\u300D\u3002\n';
            tp1b += '  \u00B7 npc_letters(\u9E3F\u96C1\u4F20\u4E66)\uFF1A\u53C2\u4E0E\u8BE5\u5DE5\u7A0B\u7684\u5730\u65B9\u5B98\u5E94\u6709\u594F\u62A5\u672C\u5DE5\u7A0B\u8FDB\u5C55\u7684\u4E66\u4FE1(\u5982\u6CBB\u6CB3 60% \u2192 \u6CB3\u9053\u603B\u7763\u594F\u300C\u6CB3\u5DE5\u73B0\u72B6\u00B7\u5824\u5DF2\u6210\u516B\u4E5D\u00B7\u5C1A\u9700\u2026\u2026\u300D)\u3002\n';
            tp1b += '  \u00B7 npc_correspondence(\u5BC6\u4FE1)\uFF1A\u957F\u671F\u5DE5\u7A0B\u4E2D\u5931\u610F/\u53CD\u5BF9\u65B9 NPC \u5E94\u6709\u79C1\u4E0B\u62B1\u6028/\u4E32\u8054(\u5982\u53D8\u6CD5\u5C06\u6210 \u2192 \u53CD\u5BF9\u515A\u515A\u9B41\u4E0E\u95E8\u751F\u5BC6\u8BAE\u300C\u6B64\u6CD5\u96BE\u4E45\u00B7\u5F53\u5F85\u65F6\u7FFB\u6848\u300D)\u3002\n';
            tp1b += '  \u00B7 npc_interactions(NPC \u4E92\u52A8)\uFF1A\u957F\u671F\u5DE5\u7A0B\u4E3B\u594F\u8005\u4E0E stakeholder \u4E4B\u95F4\u5E94\u6709\u534F\u8C03\u4E92\u52A8\u3002\n';
            tp1b += '  \u00B7 \u8FD9\u4E9B\u5185\u5BB9\u987B\u5207\u5B9E\u547C\u5E94\u300C\u957F\u671F\u4E8B\u52BF\u300D\u4E2D\u7684\u5177\u4F53\u6761\u76EE\u00B7\u4E0D\u53EF\u53EA\u5199\u672C\u56DE\u5408\u5B64\u7ACB\u4E8B\u00B7\u8BA9\u73A9\u5BB6\u611F\u5230\u300C\u6709\u51E0\u4E2A\u4E09\u4E94\u5E74\u5927\u4E8B\u5728\u80CC\u666F\u6301\u7EED\u63A8\u8FDB\u300D\u3002\n';
          }
        }

        // 已有内容提示（避免重复）
        var _existCW = (p1 && Array.isArray(p1.cultural_works)) ? p1.cultural_works.length : 0;
        var _existNL = (p1 && Array.isArray(p1.npc_letters)) ? p1.npc_letters.length : 0;
        var _existNC = (p1 && Array.isArray(p1.npc_correspondence)) ? p1.npc_correspondence.length : 0;
        var _existNI = (p1 && Array.isArray(p1.npc_interactions)) ? p1.npc_interactions.length : 0;
        if (_existCW || _existNL || _existNC || _existNI) {
          tp1b += '\n\u3010\u4E0A\u4E00\u5B50\u8C03\u7528\u5DF2\u751F\u6210\u3011\u6587\u4E8B ' + _existCW + ' \u7BC7\uFF0C\u9E3F\u96C1 ' + _existNL + ' \u5C01\uFF0C\u5BC6\u4FE1 ' + _existNC + ' \u6761\uFF0C\u4E92\u52A8 ' + _existNI + ' \u6B21\u3002\u8BF7\u8865\u5145\u751F\u6210\u66F4\u591A\u4E0D\u540C\u5185\u5BB9\uFF0C\u4E0D\u8981\u91CD\u590D\u3002\n';
        }

        tp1b += '\n\u3010\u4EFB\u52A1\u3011\u751F\u6210\u4EE5\u4E0B\u56DB\u7C7B\u5185\u5BB9\uFF0C\u8FD4\u56DE\u4E25\u683C JSON\uFF08\u4EC5\u5305\u542B\u8FD9\u56DB\u4E2A\u5B57\u6BB5\uFF09\uFF1A\n\n';

        tp1b += '\u25C6 cultural_works\uFF08\u6587\u82D1\u4F5C\u54C1\u00B7\u5E38\u6001 3-6 \u7BC7\uFF0C\u91CD\u5927\u4E8B\u4EF6\u65F6 5-10 \u7BC7\uFF09\u2014\u2014\n';
        tp1b += '  \u6309\u89E6\u53D1\u6E90\uFF08A\u79D1\u4E3E\u5BA6\u9014/B\u9006\u5883\u8D2C\u8C2A/C\u793E\u4EA4\u916C\u9162/D\u4EFB\u4E0A\u65BD\u653F/E\u6E38\u5386\u5C71\u6C34/F\u5BB6\u4E8B\u79C1\u60C5/G\u65F6\u5C40\u5929\u4E0B/H\u60C5\u611F\u5FC3\u5883\uFF09\u9009\u6709\u8D44\u683C\u7684 NPC \u751F\u6210\u5176\u4F5C\u54C1\u3002\n';
        tp1b += '  \u2605 content \u5FC5\u987B\u5168\u6587\u771F\u5B9E\u751F\u6210\uFF1A\u7EDD\u53E5 20/\u5F8B\u8BD7 40\u621656/\u8BCD\u6309\u8BCD\u724C\u5B57\u6570/\u8D4B 300-800/\u6587 200-600\uFF1B\u53E4\u6587\u5FCC\u73B0\u4EE3\u8BCD\u6C47\uFF1B\u683C\u5F8B\u8BD7\u5C3D\u529B\u8BB2\u5E73\u4EC4\u5BF9\u4ED7\u3002\u4E0D\u5F97\u5199\u5360\u4F4D\u7B26\u5982"(\u6B64\u5904\u8BD7)"\u3002\n';
        tp1b += '  \u5B57\u6BB5\uFF1A{author, turn:' + (GM.turn||1) + ', date, location, triggerCategory, trigger, motivation, lifeStage, genre, subtype, title, content, mood, theme, elegance, dedicatedTo[], inspiredBy, commissionedBy, praiseTarget, satireTarget, quality, politicalImplication, politicalRisk, narrativeContext, preservationPotential}\n';
        tp1b += '  motivation\uFF1Aspontaneous\u81EA\u53D1/commissioned\u53D7\u547D/flattery\u5E72\u8C12/response\u916C\u7B54/mourning\u54C0\u60BC/critique\u8BBD\u8C15/celebration\u9882\u626C/farewell\u9001\u522B/memorial\u7EAA\u5FF5/ghostwrite\u4EE3\u7B14/duty\u5E94\u5236/self_express\u81EA\u62D2\n';
        tp1b += '  genre\uFF1Ashi\u8BD7/ci\u8BCD/fu\u8D4B/qu\u66F2/ge\u6B4C\u884C/wen\u6563\u6587/apply\u5E94\u7528\u6587/ji\u8BB0\u53D9\u6587/ritual\u796D\u6587\u7891\u94ED/paratext\u5E8F\u8DCB\n';
        tp1b += '  politicalRisk\uFF1A\u8BBD\u8C15/critique \u7C7B\u9AD8\uFF0C\u5E73\u548C\u7C7B\u4F4E\u3002preservationPotential \u8D28\u91CF\u8D8A\u9AD8/\u9898\u6750\u8D8A\u91CD\u8D8A\u5BB9\u6613\u4F20\u4E16\u3002\n';
        tp1b += '  \u89E6\u53D1\u6761\u4EF6\uFF1A\u667A\u529B\u226570 + scholar/theologian/eccentric/pensive/curious \u7279\u8D28 \u2192 \u9AD8\u6743\u91CD\uFF1B\u9047\u8D2C/\u4E01\u5FE7/\u81F4\u4ED5/\u6218\u80DC/\u593A\u804C/\u4E54\u8FC1/\u5BFF\u8FB0 \u2192 \u5F3A\u89E6\u53D1\uFF1Bstress>60 \u501F\u6587\u53D1\u6CC4\u3002lazy/craven \u964D\u6743\u3002\n\n';

        tp1b += '\u25C6 npc_letters\uFF08\u9E3F\u96C1\u4F20\u4E66\u00B7\u6BCF\u56DE\u5408 2-5 \u5C01\uFF09\u2014\u2014\n';
        tp1b += '  \u4E0D\u5728 ' + _capB + ' \u7684 NPC \u9047\u91CD\u5927\u4E8B\u4EF6\u4E3B\u52A8\u5199\u4FE1\u7ED9\u7687\u5E1D\u3002from \u5FC5\u987B\u662F\u4E0D\u5728\u9996\u90FD\u7684 NPC\u3002\n';
        tp1b += '  \u5B57\u6BB5\uFF1A{from, type:"report\u5954\u544A/plea\u6C42\u63F4/warning\u8B66\u62A5/personal\u79C1\u60C5/intelligence\u60C5\u62A5", urgency:"normal/urgent/extreme", content(100-200\u5B57\u53E4\u5178\u4E2D\u6587), suggestion(1-2\u53E5\u53EF\u7701), subjectLine:"\u4FE1\u51FD\u9898\u540D\u00B75-12\u5B57\u5982\u300A\u8FBD\u4E1C\u544A\u6025\u758F\u300B", replyExpected:true}\n';
        tp1b += '  \u53C2\u8003\u4FE1\u4EF6\u6A21\u5F0F\uFF1A\u8FB9\u5C06\u544A\u6025\u00B7\u5730\u65B9\u5B98\u8BF7\u547D\u00B7\u6D41\u5B98\u8FF0\u60C5\u00B7\u51FA\u4F7F\u56DE\u62A5\u00B7\u79BB\u4EAC\u65E7\u81E3\u6000\u60F3\u00B7\u5BC6\u63A2\u5BC6\u62A5\u3002\n\n';

        tp1b += '\u25C6 npc_correspondence\uFF08NPC \u4E4B\u95F4\u5BC6\u4FE1\u00B72-5 \u6761\uFF09\u2014\u2014\n';
        tp1b += '  NPC \u95F4\u79D8\u5BC6\u4E66\u4FE1/\u7ED3\u76DF\u7EA6\u5B9A/\u60C5\u62A5\u4EA4\u6362/\u5BC6\u8C0B\u3002\n';
        tp1b += '  \u5B57\u6BB5\uFF1A{from, to, content(50-150\u5B57), summary(\u4E00\u53E5\u8BDD), implication(\u5BF9\u5C40\u52BF\u6F5C\u5728\u5F71\u54CD), type:"secret/alliance/conspiracy/routine"}\n\n';

        tp1b += '\u25C6 npc_interactions\uFF08NPC \u4E92\u52A8\u00B75-12 \u6761\uFF09\u2014\u2014\n';
        tp1b += '  \u7CFB\u7EDF\u81EA\u52A8\u8DEF\u7531\uFF1Aimpeach/slander/expose_secret \u2192 \u594F\u758F\u5F39\u7AE0\uFF1Brecommend/guarantee/petition_jointly \u2192 \u8350\u8868\uFF1B\n';
        tp1b += '  private_visit/invite_banquet/duel_poetry \u2192 \u95EE\u5BF9\u6C42\u89C1\uFF1Bgift_present \u2192 \u9E3F\u96C1\u9644\u793C\uFF1Bcorrespond_secret/share_intelligence \u2192 \u9E3F\u96C1\u5BC6\u4FE1\uFF1B\n';
        tp1b += '  frame_up/betray/mediate/reconcile \u2192 \u98CE\u95FB\uFF1Bmaster_disciple \u2192 \u8D77\u5C45\u6CE8\u3002\n';
        tp1b += '  \u5B57\u6BB5\uFF1A{actor, target, type, description(30-60\u5B57), involvedOthers?, publicKnown?(true/false)}\n';
        tp1b += '  \u6309\u4EBA\u7269\u6027\u683C/\u6D3E\u7CFB/\u5173\u7CFB\u9009\u5408\u9002\u7684 type\uFF0C\u907F\u514D"\u5FA1\u53F2\u5FC5\u8C0F/\u5C06\u519B\u5FC5\u8BF7\u6218"\u5DE5\u5177\u4EBA\u6A21\u677F\u3002\n';
        tp1b += '  \u7279\u522B\u6CE8\u610F\uFF1A\u5305\u542B\u5F39\u52BE/\u8350\u4E3E/\u5BC6\u5BFF/\u8FAD\u7E41/\u5F92\u5F92\u4F20\u9053\u7B49\u53E4\u5178\u653F\u6CBB\u884C\u4E3A\uFF0C\u4E00\u90E8\u5206 publicKnown=true \u8FDB\u98CE\u95FB\uFF0C\u4E00\u90E8\u5206 false \u79C1\u4E0B\u3002\n\n';

        tp1b += '\u3010\u786C\u89C4\u5219\u3011\n';
        tp1b += '  \u00B7 \u53EA\u8FD4\u56DE\u4E0A\u8FF0\u56DB\u4E2A\u5B57\u6BB5\u7684 JSON\uFF08\u65E0\u5176\u4ED6\u5B57\u6BB5\uFF09\n';
        tp1b += '  \u00B7 \u4EBA\u540D\u5FC5\u987B\u662F\u73B0\u6709\u89D2\u8272\uFF08\u5DF2\u5217\u5728\u4E0A\u65B9\u4EBA\u7269\u8868\u4E2D\uFF09\n';
        tp1b += '  \u00B7 \u5185\u5BB9\u8981\u4E30\u5BCC\u3001\u6709\u753B\u9762\u611F\u3001\u4E0D\u673A\u68B0\u5316\n';
        tp1b += '  \u00B7 \u73A9\u5BB6 ' + _pNameB + ' \u4E0D\u5F97\u4F5C npc_interactions.actor\uFF1B\u4E0D\u5F97 autonomous \u4F5C cultural_works\n';
        tp1b += '  \u00B7 \u9AD8\u8D28\u91CF\uFF1A\u8BD7\u8981\u6709\u5883\uFF0C\u6587\u8981\u6709\u56E0\uFF0C\u4FE1\u8981\u6709\u9690\uFF0C\u4E92\u52A8\u8981\u6709\u65B9\n';
        tp1b += '\n\u8FD4\u56DE\u683C\u5F0F\uFF1A\n';
        tp1b += '{\n  "cultural_works":[{...}],\n  "npc_letters":[{...}],\n  "npc_correspondence":[{...}],\n  "npc_interactions":[{...}]\n}';

        // 动态 max_tokens：取模型输出上限与业务 8K 的较小值
        var _sc1bBaseTok = Math.min(_effectiveOutCap || 8192, 8192);
        // G3·SC1b 文事创意类·温度调高促生诗文情志的发散
        var _sc1bTemp = Math.min(1.0, _modelTemp + 0.15);
        // 缓存·走统一 _maybeCacheSys（与 sc0/sc1/sc1d 同闸：含走中转 Claude 扩展 + 400 自愈停用）
        // [sysP分级·2026-07-02] 补漏斗：此前硬拿整条 sysP 绕过 sysPFor·profile 表对 sc1b 无效（默认FULL=字节恒等）
        var _sc1bSys = sysPFor('sc1b');
        var _sc1bMsgs = [{role:'system',content:_maybeCacheSys(_sc1bSys)},{role:'user',content:tp1b}];
        // ★ Token 预算监控·SC1b
        try {
          if (typeof checkPromptTokenBudget === 'function') {
            var _sc1bFullPrompt = (_sc1bSys || '') + '\n' + (tp1b || '');
            var _sc1bTokRes = checkPromptTokenBudget(_sc1bFullPrompt, function(status, tokens, bg) {
              if (typeof toast === 'function') toast('[SC1b] prompt ' + status + '·' + tokens + ' tokens');
            });
            if (typeof window !== 'undefined') {
              window.TM = window.TM || {}; window.TM.lastPromptTokens = window.TM.lastPromptTokens || {};
              window.TM.lastPromptTokens.sc1b = { tokens: _sc1bTokRes.tokens, status: _sc1bTokRes.status, ts: Date.now() };
            }
          }
        } catch(_tokE) {}
        var _sc1bBody = {model:P.ai.model||'gpt-4o', messages:_sc1bMsgs, temperature:_sc1bTemp, max_tokens:_tok(_sc1bBaseTok)};
        // Phase 6 Q1·sc1b strict json_schema (P.ai.openaiStrict=true)
        var _sc1bRf = _selectResponseFormat(_modelFamily, _buildSc1bJsonSchema);
        if (_sc1bRf) _sc1bBody.response_format = _sc1bRf;

        var _sc1bCall = await _callEndturnAI(_sc1bBody, {
          id: 'sc1b',
          label: '\u6587\u4E8B\u9E3F\u96C1\u4EBA\u9645',
          expectedKeys: ['cultural_works', 'npc_letters', 'npc_correspondence', 'npc_interactions'],   // 【sc1b 升级·B2】修过期 keys:原列 hongyan_letters/fengwen_snippets 是 sc1c 的·sc1b 实产 npc_letters/npc_correspondence(错的 repair/validation 提示)
          priority: 'high'
        });
        if (_sc1bCall && _sc1bCall.data) {
          var data1b = _sc1bCall.data;
          var c1b = _sc1bCall.raw || '';
          var _p1bParse = _sc1bCall.parse;
          if (_p1bParse && _p1bParse.raw) c1b = _p1bParse.raw;
          var p1b = _p1bParse ? _p1bParse.parsed : null;
          GM._turnAiResults.subcall1b_raw = c1b;
          GM._turnAiResults.subcall1b = p1b;
          try { if (window.TM && TM.validateAIOutput) TM.validateAIOutput(p1b, 'subcall1b'); } catch(_vbe){}

          if (p1b && p1) {
            if (Array.isArray(p1b.cultural_works)) p1.cultural_works = (Array.isArray(p1.cultural_works) ? p1.cultural_works : []).concat(p1b.cultural_works);
            if (Array.isArray(p1b.npc_letters)) p1.npc_letters = (Array.isArray(p1.npc_letters) ? p1.npc_letters : []).concat(p1b.npc_letters);
            if (Array.isArray(p1b.npc_correspondence)) p1.npc_correspondence = (Array.isArray(p1.npc_correspondence) ? p1.npc_correspondence : []).concat(p1b.npc_correspondence);
            if (Array.isArray(p1b.npc_interactions)) p1.npc_interactions = (Array.isArray(p1.npc_interactions) ? p1.npc_interactions : []).concat(p1b.npc_interactions);
            _dbg('[sc1b] \u5408\u5E76: \u6587\u4E8B+' + (p1b.cultural_works||[]).length + ' \u9E3F\u96C1+' + (p1b.npc_letters||[]).length + ' \u5BC6\u4FE1+' + (p1b.npc_correspondence||[]).length + ' \u4E92\u52A8+' + (p1b.npc_interactions||[]).length);
          }
          GM._subcallTimings.sc1b = Date.now() - _sc1bStart;
        } else {
          // dead-code path·_callEndturnAI 要么 throw 要么 return {data}·此处 fallback log·不读 stale resp1b
          console.warn('[sc1b] empty call result (unexpected)·_sc1bCall=', _sc1bCall);
        }
      } catch(_sc1bErr) {
        console.warn('[sc1b] \u5931\u8D25\uFF08\u4E0D\u5F71\u54CD\u4E3B\u6D41\u7A0B\uFF09:', _sc1bErr.message || _sc1bErr);
        // Phase 1 H5\u00B7\u9519\u8BEF\u66B4\u9732\u7ED9\u8BCA\u65AD\u9762\u677F
        try {
          if (ctx && ctx.meta) {
            ctx.meta.errors = ctx.meta.errors || [];
            ctx.meta.errors.push({ subcall: 'sc1b', phase: 'execute', err: (_sc1bErr && _sc1bErr.message) || String(_sc1bErr), turn: GM && GM.turn });
          }
          if (typeof recordSubcallError === 'function') recordSubcallError('sc1b', 'execute', _sc1bErr);
        } catch(_pushE) {}
      }
      })();  // end SC1b IIFE

      var _sc1cP = (async function() {
      // ═══ Sub-call 1c · 势力 & NPC 自主博弈专项（独立预算 8k，丰富势力外交+NPC 阴谋）═══
      try {
        var _sc1cStart = Date.now();

        var _facsBriefC = '';
        try {
          var _liveFacsC = (GM.facs||[]).filter(function(f){return f && !f.isPlayer;});
          _facsBriefC = _liveFacsC.slice(0,14).map(function(f){
            var _p = f.name + ' \u5B9E' + (f.strength||50);
            if (f.leader) _p += ' \u9996:' + f.leader;
            if (f.attitude) _p += ' \u6001:' + f.attitude;
            if (f.goal) _p += ' \u76EE:' + String(f.goal).slice(0,30);
            if (f.culture) _p += ' [' + f.culture + ']';
            if (f.mainstream) _p += '\u00B7' + f.mainstream;
            if (f.type) _p += '\u00B7' + f.type;
            return _p;
          }).join('\n');
        } catch(_e){}

        var _relsBriefC = '';
        try {
          if (Array.isArray(GM.factionRelations)) {
            _relsBriefC = GM.factionRelations.slice(0,18).map(function(r){
              var s = r.from + '\u2192' + r.to + ' ' + (r.type||'?');
              if (r.value !== undefined) s += '(' + r.value + ')';
              if (r.trust !== undefined) s += ' \u4FE1' + r.trust;
              if (r.hostility !== undefined) s += ' \u654C' + r.hostility;
              if (r.economicTies !== undefined) s += ' \u7ECF' + r.economicTies;
              if (r.kinshipTies !== undefined) s += ' \u4EB2' + r.kinshipTies;
              return s;
            }).join('\n');
          }
        } catch(_e){}

        var _npcsBriefC = '';
        try {
          var _liveNpcsC = (GM.chars||[]).filter(function(c){return c && c.alive!==false && !c.isPlayer;});
          _liveNpcsC.sort(function(a,b){return (a.rank||99)-(b.rank||99);});
          _npcsBriefC = _liveNpcsC.slice(0,20).map(function(c){
            var _p = c.name;
            if (c.officialTitle) _p += '\u00B7' + c.officialTitle;
            if (c.faction) _p += '[' + c.faction + ']';
            if (c.party) _p += '{' + c.party + '}';
            _p += ' \u5FE0' + (c.loyalty||50) + '\u00B7\u5FD7' + (c.ambition||50) + '\u00B7\u5EC9' + (c.integrity||50);
            var _favC = (typeof AffinityMap !== 'undefined' && AffinityMap.get) ? (AffinityMap.get(c.name, (P.playerInfo && P.playerInfo.characterName) || '') || 0) : 0;
            if (_favC) _p += (_favC > 0 ? '\u00B7\u53D7\u6069' : '\u00B7\u79EF\u6028') + Math.abs(_favC);
            if (Array.isArray(c.traits) && c.traits.length) _p += ' \u7279{' + c.traits.slice(0,2).join(',') + '}';
            _p += _cogRelCueSC(c);   // 【C2】谋者认知(所求/朝局判断)+ 与他人交情(睦/隙·谁与谁结党、谋算谁)
            return _p;
          }).join('\n');
        } catch(_e){}

        var _undercurrentsC = '';
        if (Array.isArray(GM._factionUndercurrents) && GM._factionUndercurrents.length > 0) {
          _undercurrentsC = GM._factionUndercurrents.slice(0,8).map(function(u){
            return (u.faction||'?') + ': ' + (u.situation||'') + (u.nextMove?' (\u53EF\u80FD:'+u.nextMove+')':'');
          }).join('\n');
        }

        var _activeSchemesC = '';
        if (Array.isArray(GM.activeSchemes) && GM.activeSchemes.length > 0) {
          _activeSchemesC = GM.activeSchemes.slice(-8).map(function(s){
            return (s.schemer||'?') + ' \u9488\u5BF9 ' + (s.target||'?') + ': ' + String(s.plan||'').slice(0,40) + ' [' + (s.progress||'') + ']';
          }).join('\n');
        }

        // 【sc1c 升级·C3】近期暗流(GM._hiddenMoves·近 2 回合)喂回 sc1c·让它承接前番埋下的暗流而非每回合另起。
        var _hiddenMovesC = (Array.isArray(GM._hiddenMoves) && GM._hiddenMoves.length) ? GM._hiddenMoves.filter(function(h){ return h && (Number(h.turn) || 0) >= (GM.turn || 0) - 2; }).slice(-10).map(function(h){ return '· ' + h.text; }).join('\n') : '';
        var _recentSZJC = (p1 && (p1.shizhengji || p1.shizhengji_basis || p1.turn_summary)) ? String(p1.shizhengji || p1.shizhengji_basis || p1.turn_summary).slice(0,1200) : '';
        var _pNameC = (P.playerInfo && P.playerInfo.characterName) || '';

        var tp1c = '\u3010\u52BF\u529B\u5916\u4EA4\u00B7NPC\u9634\u8C0B\u00B7\u4E13\u9879\u63A8\u6F14\u3011\n';
        tp1c += '\u672C\u56DE\u5408\uFF1A' + (GM.turn||1) + ' \u00B7 ' + (typeof getTSText==='function'?getTSText(GM.turn):'') + '\n';
        if (_recentSZJC) tp1c += '\n\u3010\u672C\u56DE\u5408\u65F6\u653F\u3011\n' + _recentSZJC + '\n';
        if (_facsBriefC) tp1c += '\n\u3010\u975E\u73A9\u5BB6\u52BF\u529B\u3011\n' + _facsBriefC + '\n';
        if (_relsBriefC) tp1c += '\n\u3010\u52BF\u529B\u5173\u7CFB\u5FEB\u7167\u3011\n' + _relsBriefC + '\n';
        if (_undercurrentsC) tp1c += '\n\u3010\u4E0A\u56DE\u5408\u52BF\u529B\u6697\u6D41\uFF08\u5E94\u6709\u540E\u7EED\uFF09\u3011\n' + _undercurrentsC + '\n';
        if (_activeSchemesC) tp1c += '\n\u3010\u8FDB\u884C\u4E2D\u9634\u8C0B\uFF08\u901A\u8FC7 scheme_actions \u63A8\u8FDB\uFF0C\u4E0D\u8981\u5728 npc_schemes \u91CD\u590D\uFF09\u3011\n' + _activeSchemesC + '\n';
        if (_hiddenMovesC) tp1c += '\n【近期暗流（前番已埋·可承接推进/收束·勿凭空另起）】\n' + _hiddenMovesC + '\n';
        // 长期事势·含 hidden 条目（AI 全见，用于构思本回合该推进/完成哪些）
        if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAIContextString) {
          var _chronCtxC = ChronicleTracker.getAIContextString();
          if (_chronCtxC) tp1c += '\n' + _chronCtxC + '\n';
        }
        if (_npcsBriefC) tp1c += '\n\u3010\u4E3B\u8981 NPC\uFF08\u542B\u5B98\u804C/\u6D3E\u7CFB/\u5FE0\u5FD7\u5EC9/\u7279\u8D28\uFF09\u3011\n' + _npcsBriefC + '\n';

        tp1c += '\n\u3010\u4EFB\u52A1\u3011\u751F\u6210\u4EE5\u4E0B\u4E5D\u7C7B\u5185\u5BB9\uFF0C\u8FD4\u56DE\u4E25\u683C JSON\uFF08\u4EC5\u5305\u542B\u8FD9\u4E9B\u5B57\u6BB5\uFF09\uFF1A\n\n';

        tp1c += '\u25C6 faction_interactions_advanced\uFF08\u52BF\u529B\u6DF1\u5EA6\u4E92\u52A8\u00B7\u5E38\u6001 3-6 \u6761\uFF0C\u5916\u4EA4\u6D3B\u8DC3\u671F 6-10 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  23 \u79CD type\uFF1A\n';
        tp1c += '    \u6218\u4E89\uFF1Adeclare_war\u5BA3\u6218/border_clash\u8FB9\u5883\u51B2\u7A81/sue_for_peace\u8BF7\u548C/annex_vassal\u5E76\u541E\n';
        tp1c += '    \u548C\u5E73\uFF1Asend_envoy\u9063\u4F7F/form_confederation\u7ED3\u76DF/break_confederation\u6BC1\u7EA6/recognize_independence\u627F\u8BA4\u72EC\u7ACB\n';
        tp1c += '    \u85E9\u5C5E\uFF1Ademand_tribute\u7D22\u8D21/pay_tribute\u732E\u8D21/royal_marriage\u548C\u4EB2/send_hostage\u8D28\u5B50/gift_treasure\u8D60\u5B9D\n';
        tp1c += '    \u7ECF\u6D4E\uFF1Aopen_market\u4E92\u5E02/trade_embargo\u8D38\u6613\u7981\u8FD0/pay_indemnity\u8D54\u6B3E\n';
        tp1c += '    \u6587\u5316\uFF1Acultural_exchange\u6587\u5316\u4EA4\u6D41/religious_mission\u5B97\u6559\u4F7F\u8282\n';
        tp1c += '    \u519B\u4E8B\uFF1Amilitary_aid\u519B\u63F4/proxy_war\u4EE3\u7406\u6218\u4E89/incite_rebellion\u7172\u52A8\u53DB\u4E71\n';
        tp1c += '    \u60C5\u62A5\uFF1Aspy_infiltration\u7EC6\u4F5C/assassin_dispatch\u523A\u5BA2\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{from, to, type, viaProxy?(proxy_war\u65F6), terms, tributeItems?(tribute\u65F6), marriageDetails?(marriage\u65F6\u2014\u2014"XX\u516C\u4E3B\u5AC1YY\u738B"), hostageDetails?(hostage\u65F6\u2014\u2014"XX\u5B50\u5165\u8D28"), treatyType?(\u76DF\u597D/\u79F0\u81E3/\u505C\u6218/\u4E92\u4E0D\u4FB5\u72AF), description, durationTurns, reason}\n';
        tp1c += '  \u5386\u53F2\u53C2\u8003\uFF1A\u662D\u541B\u51FA\u585E/\u6587\u6210\u516C\u4E3B\u5165\u85CF(kinshipTies+/hostility-)\uFF1B\u6E05\u521D\u8D28\u5B50(trust+)\uFF1B\u695A\u6C49\u7528\u8BF8\u4FAF\u4EE3\u7406\u6218\u4E89(trust-)\uFF1B\u5BCB\u6E0A\u5C81\u5E01/\u660E\u518C\u5C01\u671D\u9C9C\u7434\u7409\u7403\uFF1B\u5B8B\u8FBD\u6982\u573A/\u660E\u8499\u9A6C\u5E02(economicTies+)\n';
        tp1c += '  \u4E00\u81F4\u6027\u5F0F\uFF1A\u80CC\u76DF/\u6BC1\u7EA6/\u523A\u6740\u5F71\u54CD\u6DF1\u8FDC\u4E0D\u53EF\u8F7B\u6613"\u548C\u597D"\uFF1B\u548C\u4EB2/\u8D28\u5B50\u8981\u5177\u4F53\u4EBA\u540D\n\n';

        tp1c += '\u25C6 faction_events\uFF08\u52BF\u529B\u95F4/\u5185\u90E8\u4E8B\u4EF6\u00B7\u5E38\u6001 3-6 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{actor, target?(\u5185\u653F\u4E8B\u4EF6\u53EF\u7701), action(30\u5B57), actionType:"\u5916\u4EA4/\u5185\u653F/\u519B\u4E8B/\u7ECF\u6D4E", result(30\u5B57), strength_effect:0, geoData?:{routeKm, terrainDifficulty:0.5, hasOfficialRoad, routeDescription("\u7ECF\u2026\u2026"), passesAndBarriers[], fortLevel, garrison}}\n';
        tp1c += '  \u519B\u4E8B\u7C7B geoData \u5FC5\u586B\uFF0C\u5176\u4ED6\u7C7B\u53EF\u7701\n\n';

        tp1c += '\u25C6 faction_ai_outcomes\uFF08\u52BF\u529BAI\u4E3B\u5FAA\u73AF\u6865\u8D26\u672C\u00B72-6 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  \u8FD9\u4E0D\u662F\u65C1\u8DEF\u8BBE\u5B9A\uFF1A\u5FC5\u987B\u628A aiPersonality/aiDecisionWeights/aiConditionalBehaviors \u4E0E\u5F53\u524D\u519B\u653F\u8D22\u5730\u76D8\u5173\u7CFB\u8054\u52A8\uFF0C\u5E76\u901A\u8FC7 faction_events/faction_interactions_advanced/faction_relation_changes/\u519B\u653F\u8D22\u5B57\u6BB5\u843D\u5730\u3002\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{faction, factionId?, intent, action, target?, motive, result, publicSummary, posterityComment, recordTarget:"shizhengji|houren|both|none", structuralLinks:["faction_events[0]"]}\n';
        tp1c += '  publicSummary \u4F9B\u65F6\u653F\u8BB0\u8FFD\u52A0\uFF0CposterityComment \u4F9B\u540E\u4EBA\u620F\u8BF4/\u8336\u8086/\u8FB9\u62A5/\u58EB\u6797\u8BAE\u8BBA\u4F7F\u7528\u3002\n\n';

        tp1c += '\u25C6 faction_relation_changes\uFF08\u52BF\u529B\u5173\u7CFB\u53D8\u5316\u00B72-5 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{from, to, type, delta, reason}\n';
        tp1c += '  \u5173\u7CFB\u516D\u7EF4\uFF1Atrust\u4FE1\u4EFB/hostility\u654C\u610F/economicTies\u7ECF\u6D4E/culturalAffinity\u6587\u5316/kinshipTies\u59FB\u4EB2/territorialDispute\u9886\u571F\uFF1B\u6309\u4E92\u52A8\u5BFC\u81F4\u7684\u7EF4\u5EA6\u66F4\u65B0\n\n';

        tp1c += '\u25C6 faction_succession\uFF08\u52BF\u529B\u7EE7\u627F\u00B7\u4EC5\u5F53\u9996\u9886\u6B7B\u4EA1/\u5931\u5FC3/\u6C11\u53D8\u65F6\u89E6\u53D1\uFF09\u2014\u2014\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{faction, oldLeader, newLeader, legitimacy:70, stability_delta:-10, disputeType:"\u6B63\u5E38\u7EE7\u627F/\u4E89\u4F4D/\u7BE1\u4F4D/\u5185\u6218/\u5916\u621A\u4E13\u653F/\u91CD\u81E3\u63A8\u8F7D", narrative(40\u5B57)}\n\n';

        tp1c += '\u25C6 npc_schemes\uFF08NPC \u9634\u8C0B\u00B7\u65B0\u589E\u9634\u8C0B\u3002\u5E38\u6001 2-4 \u6761\uFF0C\u5F20\u529B\u671F 4-8 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  \u8DE8\u56DE\u5408\u9634\u8C0B\u2014\u2014\u6743\u81E3\u6392\u6324\u5BF9\u624B\u3001\u5C06\u519B\u6697\u8054\u5916\u90E8\u3001\u6536\u96C6\u53CD\u5BF9\u6D3E\u7F6A\u8BC1\u3001\u6B3E\u586B\u4E00\u8D1D\u3001\u4EA4\u5851\u540E\u5BAB\u3001\u6D41\u8A00\u9020\u52BF\u3001\u540E\u9752\u52FE\u7ED3\u7B49\u957F\u671F\u5E03\u5C40\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{schemer, target, plan(40\u5B57\u63CF\u8FF0), progress:"\u915D\u917F\u4E2D/\u5373\u5C06\u53D1\u52A8/\u957F\u671F\u5E03\u5C40", allies:"\u540C\u8C0B\u8005\uFF08\u4EBA\u540D\u9017\u53F7\u5206\u9694\uFF09", motive:"\u52A8\u673A\u00B7\u636E\u5176\u6240\u6C42/\u6069\u6028(20\u5B57\u00B7\u5982\u300C\u6068\u674E\u67D0\u6784\u9677\u3001\u6B32\u62A5\u6B64\u4EC7\u300D)", method:"\u624B\u6BB5\u00B71\u8BCD\u5982\u8BEC\u9677/\u7ED3\u515A/\u8D3F\u8D42/\u6784\u9677/\u5BC6\u594F/\u8054\u59FB/\u6563\u8C23", secrecy:"\u9690\u79D8\u5EA6\u00B7\u6781\u9690/\u534A\u516C\u5F00/\u5F20\u626C", winCondition:"\u4F55\u4E3A\u5F97\u624B\u00B720\u5B57"}\n\n';

        tp1c += '\u25C6 scheme_actions\uFF08\u5DF2\u6709\u9634\u8C0B\u63A8\u8FDB\u00B71-3 \u6761\uFF0C\u5BF9\u5E94\u4E0A\u4E00\u56DE\u5408\u9634\u8C0B\uFF09\u2014\u2014\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{schemer, action:"advance\u63A8\u8FDB/disrupt\u7834\u574F/abort\u4E2D\u6B62/expose\u88AB\u63ED\u53D1", reason(30\u5B57)}\n\n';

        tp1c += '\u25C6 hidden_moves\uFF08NPC \u6697\u4E2D\u884C\u52A8\u00B7\u81F3\u5C11 8 \u6761\uFF0C\u5B57\u7B26\u4E32\u6570\u7EC4\uFF09\u2014\u2014\n';
        tp1c += '  \u6BCF\u6761\u683C\u5F0F\uFF1A"\u67D0\u89D2\u8272\uFF1A\u56E0\u4E3A\u4EC0\u4E48\u2192\u6697\u4E2D\u505A\u4E86\u4EC0\u4E48\u2192\u76EE\u7684\u662F\u4EC0\u4E48"\uFF0830-60\u5B57\uFF09\n';
        tp1c += '  \u5FC5\u5305\u542B\uFF1A\u2265 3 \u6761 NPC\u5BF9NPC\u6697\u884C\uFF1B\u2265 1 \u6761 \u52BF\u529B\u5185\u90E8\u6697\u6D41\uFF1B\u2265 1 \u6761 \u5C0F\u4EBA\u7269\u52A8\u4F5C\uFF08\u5C0F\u540F\u8D2A\u5893/\u5546\u4EBA\u56E4\u8D27/\u63A2\u5B50\u4F20\u4FE1/\u6D41\u6C11\u805A\u96C6\uFF09\n\n';

        tp1c += '\u25C6 fengwen_snippets\uFF08\u98CE\u95FB\u5F55\u4E8B\u00B7\u5E38\u6001 12-20 \u6761\uFF09\u2014\u2014\n';
        tp1c += '  \u4EBA\u7269\u548C\u52BF\u529B\u7684\u6D3B\u52A8\u98CE\u95FB\u2014\u2014\u6E90\u81EA\u5751\u95F4\u8033\u76EE\u3001\u671D\u5802\u98CE\u8BEE\u3001\u5F80\u6765\u5BC6\u51FD\u7B49\uFF0C\u901A\u8FC7\u8D77\u5C45\u6CE8/\u8033\u62A5/\u5857\u62A5/\u574A\u95F4\u4F20\u95FB\u62A5\u5165\u3002\n';
        tp1c += '  \u5B57\u6BB5\uFF1A{type, text(30-60\u5B57\u53E4\u5178\u4E2D\u6587\u98CE), credibility(0.3-0.95), actors:["\u4EBA\u540D\u6216\u52BF\u529B\u540D"], source:"\u574A\u95F4/\u671D\u5802/\u8033\u76EE/\u5857\u62A5/\u5BC6\u672D/\u8FB9\u5173", mood?:"\u5FE7/\u559C/\u6012/\u6050/\u4EB2/\u4EC7(\u4F20\u9012\u7ED9 actors \u8BB0\u5FC6\u7684\u4E3B\u5BFC\u60C5\u7EEA)"}\n';
        tp1c += '  type \u5206\u7C7B\uFF1A\u5F39\u52BE/\u8350\u4E3E/\u594F\u8BAE/\u7ED3\u515A/\u9020\u8C23/\u79C1\u8BBF/\u5BB4\u996E/\u6E38\u5BB4/\u8BD7\u793E/\u5B66\u8BBA/\u6C42\u5A5A/\u6BCD\u796D/\u4E39\u9053/\u85AC\u91CA/\u5DE1\u89C6/\u5DE1\u8005/\u8D51\u635C/\u53F8\u6CD5/\u6838\u67E5/\u6350\u4FF8/\u8D22\u884C/\u5BB6\u4E8B/\u7F6E\u4EA7/\u5C45\u7740/\u96C5\u793A/\u5BC6\u8054/\u6218\u62A5/\u8FB9\u62A5/\u548C\u4EB2/\u8D28\u5B50/\u671D\u8D21/\u4E92\u5E02/\u76DF\u7EA6/\u9063\u4F7F/\u63ED\u79C1\n';
        tp1c += '  \u4F8B\uFF1A{type:"\u8BD7\u793E", text:"\u897F\u6E56\u4E09\u96C5\u96C6\u4E8E\u5317\u5C71\uFF0C\u67D0\u7532\u8D4B\u300A\u79CB\u6C34\u300B\uFF0C\u67D0\u4E59\u6B21\u97F5\uFF0C\u67D0\u4E19\u7ACB\u5212\u70B9\u65AD\u53E5\u3002", credibility:0.75, actors:["\u67D0\u7532","\u67D0\u4E59"], source:"\u574A\u95F4", mood:"\u559C"}\n';
        tp1c += '  \u3010\u786C\u89C4\u5219\u00B7\u98CE\u95FB\u8986\u76D6\u8981\u6C42\u3011\n';
        tp1c += '    \u00B7 \u4E0A\u8FF0\u65B0\u83DC\u5355\u6240\u6709\u7C7B\u578B\u4E3B\u52A8\u884C\u4E3A\uFF08\u540D\u671B\u5EFA\u6784/\u5730\u65B9\u6CBB\u7406/\u4E2D\u592E\u5C65\u804C/\u79C1\u4EA7\u7ECF\u8425/\u516C\u5E93\u62C5\u5F53/\u653F\u6597\u535A\u5F08/\u4EBA\u6C11\u4E92\u52A8\u793E\u4EA4/\u79C1\u4EBA\u751F\u6D3B\uFF09\u5F53\u5C06\u751F\u6210 1+ \u6761\u98CE\u95FB\n';
        tp1c += '    \u00B7 \u52BF\u529B\u7684\u516C\u5F00\u4E92\u52A8\u4E5F\u4F1A\u81EA\u52A8\u8FDB\u98CE\u95FB\uFF08\u5DF2\u7CFB\u7EDF\u81EA\u52A8\u5904\u7406\uFF0C\u4F60\u4E0D\u9700\u91CD\u590D\uFF09\n';
        tp1c += '    \u00B7 \u65AD\u8BAE\u7ED3\u679C/\u94A5\u5B66\u4FEE\u9C81\u7B49\u79C1\u4EBA\u884C\u4E3A\u4F1A\u5728\u5750\u95F4\u52AD\u7EEC\u50E3\u6709\u81C0\u5854\u4E39\u9038\u4E0B\u906E\n';
        tp1c += '    \u26A0 \u3010\u9634\u8C0B npc_schemes \u4E0D\u5F97\u8FDB\u98CE\u95FB_snippets\uFF01\u3011\u2014\u2014\u9634\u8C0B\u9ED8\u8BA4\u9690\u85CF\uFF0C\u53EA\u6709\u5728 scheme_actions.expose \u65F6\u7531\u7CFB\u7EDF\u81EA\u52A8\u751F\u6210\u300C\u63ED\u79C1\u300D\u98CE\u95FB\u3002\n';
        tp1c += '    \u00B7 \u4F53\u73B0\u5F53\u4E8B\u4EBA\u5FC3\u7EEA\uFF1Afengwen \u7684 mood \u5B57\u6BB5\u4F1A\u4F20\u9012\u7ED9 actors \u7684\u8BB0\u5FC6\u2014\u2014\u5F39\u52BE/\u63ED\u79C1 \u2192 \u6012\uFF1B\u8350\u4E3E/\u9054\u706E \u2192 \u559C\uFF1B\u4E0A\u7F8E\u4E0B\u9700 \u2192 \u4EB2\uFF1B\u5956\u5F0F\u80B2\u5169 \u2192 \u559C\uFF1B\u8D22\u5343\u9020\u8C23 \u2192 \u4EC7\u3002\n\n';

        tp1c += '\u3010\u6D3B\u52A8\u5185\u5BB9\u65B9\u5411\uFF08AI \u63A8\u7406\u53C2\u8003\uFF09\u3011\n';
        tp1c += '  \u65E0\u9700\u6BCF\u79CD\u90FD\u7528\uFF0C\u6309 NPC/\u52BF\u529B\u6027\u683C\u3001\u5F53\u524D\u5C40\u52BF\u3001\u79C1\u5FC3\u81EA\u7531\u9009\u62E9\u2014\u2014\u8BE5\u5206\u7C7B\u4EC5\u4F9B\u6269\u5C55\u601D\u8DEF\uFF0C\u907F\u514D\u5355\u8C03\u91CD\u590D\u3002\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u653F\u6597\u671D\u5802\u535A\u5F08\u3011\n';
        tp1c += '    \u00B7 \u4E0A\u758F\u4E89\u8FA9\uFF08\u4E3A\u67D0\u653F\u7B56\u5386\u4E0B\u53CD\u590D\u529B\u4E89\uFF09\n';
        tp1c += '    \u00B7 \u5F39\u52BE\u53CD\u5F39\u8FDE\u73AF\uFF08\u5F39\u8005\u53CD\u88AB\u53CD\u8BD8\u7275\u8FDE\uFF09\n';
        tp1c += '    \u00B7 \u7ED3\u515A\u00B7\u8054\u540D\u5954\u8FF0\uFF08\u7ACB\u573A\u76F8\u8FD1\u8005\u5171\u540C\u4E0A\u8868\uFF09\n';
        tp1c += '    \u00B7 \u79C1\u4E0B\u6E38\u8BF4\u4E2D\u7ACB\u6D3E\uFF08\u5BB4\u8BF7\u00B7\u8BB8\u4EE5\u597D\u5904\u6216\u5A01\u80C1\uFF09\n';
        tp1c += '    \u00B7 \u501F\u5929\u8C61/\u707E\u5F02\u8FDB\u8A00\uFF08\u9644\u4F1A\u9634\u9633\u00B7\u6258\u8A00\u5929\u8B66\uFF09\n';
        tp1c += '    \u00B7 \u8BA9\u65C1\u4EBA\u4F5C\u66FF\u8EAB\u2014\u2014\u907F\u76F4\u63A5\u51B2\u7A81\uFF08\u501F\u5FA1\u53F2\u53F0/\u501F\u8BD7\u6587\u5F71\u5C04/\u501F\u5F1F\u5B50\u9677\u9635\uFF09\n';
        tp1c += '    \u00B7 \u6536\u96C6\u5BF9\u624B\u628A\u67C4/\u4F3A\u673A\u53D1\u96BE\uFF08\u8D26\u76EE\u00B7\u79C1\u4EA4\u00B7\u5BB6\u4EBA\u8FC7\u5931\uFF09\n';
        tp1c += '    \u00B7 \u5236\u9020\u8206\u8BBA\u00B7\u6563\u5E03\u6D41\u8A00\uFF08\u501F\u7AE5\u8C23\u00B7\u8C36\u8BED\u00B7\u79C1\u8BE9\uFF09\n';
        tp1c += '    \u00B7 \u6258\u5BA6\u5B98/\u5916\u621A/\u540E\u5983\u8FDB\u8A00\uFF08\u8D70\u5185\u7EBF\u00B7\u7ED5\u5F00\u524D\u671D\uFF09\n';
        tp1c += '    \u00B7 \u62D2\u4E0D\u8868\u6001\u00B7\u660E\u54F2\u4FDD\u8EAB\uFF08\u7ACB\u573A\u4E0D\u660E\u00B7\u6301\u9EBB\u4F7F\u524D\uFF09\n';
        tp1c += '    \u00B7 \u79BB\u673A\u8C0B\u4F4D\u00B7\u4E0A\u7591\u5DE5\u5F85\u52BF\uFF08\u5C0F\u4EBA\u4E4B\u9A9A\u6269\u5927/\u770B\u98CE\u4F7F\u8235\uFF09\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u6CBB\u7406\u516C\u52A1\u5904\u7F6E\u3011\n';
        tp1c += '    \u00B7 \u6279\u9605\u6587\u4E66/\u79EF\u538B\u6848\u724D\uFF08\u8BE5\u5B98\u7C7B\u578B\u6027\u663E\uFF09\n';
        tp1c += '    \u00B7 \u53EC\u96C6\u50DA\u5C5E\u8BAE\u4E8B/\u5802\u6742\u00B7\u4F1A\u516C\u5546\u4E8B\n';
        tp1c += '    \u00B7 \u5DE1\u89C6\u8F96\u533A\u00B7\u5DE1\u6D4E\u4EB2\u770B\uFF08\u6C34\u5229/\u5175\u9632/\u72F1\u8BBC/\u519C\u65F6\uFF09\n';
        tp1c += '    \u00B7 \u5FAE\u670D\u8BBF\u6C11\u60C5\u00B7\u767E\u59D3\u6B8A\u547C\n';
        tp1c += '    \u00B7 \u6574\u985D\u98CE\u7EAA\u00B7\u60E9\u8D2A\u9501\u5BB3\uFF08\u67E5\u5C5E\u90E8\u00B7\u6838\u7269\u5238\uFF09\n';
        tp1c += '    \u00B7 \u67E5\u9605\u6237\u7C4D\u00B7\u4E08\u91CF\u7530\u4EA9\u00B7\u6CBB\u7406\u9690\u6237\n';
        tp1c += '    \u00B7 \u4FEE\u8BA2\u5730\u65B9\u89C4\u7AE0\u00B7\u4FBF\u5B9C\u884C\u4E8B\n';
        tp1c += '    \u00B7 \u8350\u4E3E\u90E8\u5C5E\u00B7\u8003\u8BFE\u9EDC\u9677\uFF08\u4E0A\u9650\u5355/\u8003\u8BE6\u5355\uFF09\n';
        tp1c += '    \u00B7 \u5BA1\u7406\u7591\u96BE\u6848\u4EF6\u00B7\u5BB9\u6781\u51A4\u72F1\n';
        tp1c += '    \u00B7 \u629A\u6170\u6D41\u6C11/\u53D1\u4ED3\u8D48\u6D4E/\u8D44\u9063\u8FD4\u4E61\n';
        tp1c += '    \u00B7 \u7B79\u63AA\u519B\u9700/\u6574\u5907\u9632\u52A1/\u589E\u5385\u5C11\u961F\n';
        tp1c += '    \u00B7 \u62DB\u629A\u76D7\u8D3C/\u8BAE\u548C\u8FB9\u6C11\n';
        tp1c += '    \u00B7 \u7B79\u5EFA\u5DE5\u7A0B\uFF08\u6865\u6881/\u5824\u575D/\u9A7F\u9053/\u5B66\u5BAB/\u7985\u9662\uFF09\n';
        tp1c += '    \u00B7 \u5904\u7406\u4E0A\u7EA7\u578B\u6307\u4EE4\u00B7\u52A0\u76D6\u8F6C\u53D1\u4E0B\u53F8\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u5F7C\u6B64\u4E92\u52A8\u793E\u4EA4\u96C5\u4E8B\u3011\n';
        tp1c += '    \u00B7 \u540C\u50DA\u5BB4\u996E\u00B7\u8BD7\u9152\u5531\u548C\n';
        tp1c += '    \u00B7 \u5B66\u672F\u5207\u78CB\u00B7\u8BBA\u5B66\u8FA9\u96BE\u00B7\u8BB2\u4F1A\n';
        tp1c += '    \u00B7 \u8BBF\u53CB\u95EE\u5B66\u00B7\u8BF7\u6559\u524D\u8F88\u00B7\u8868\u62A5\u5E08\u95E8\n';
        tp1c += '    \u00B7 \u8054\u59FB\u6C42\u4EB2\u00B7\u4EA4\u6362\u5A5A\u8BFA\u00B7\u5408\u5C01\u5C54\u5973\n';
        tp1c += '    \u00B7 \u5E08\u5F92\u4F20\u9053\u00B7\u6536\u5F92\u7ACB\u6D3E\u00B7\u9616\u5B8B\u4F20\u7ECF\n';
        tp1c += '    \u00B7 \u79C1\u4E0B\u8C03\u505C\u53CC\u65B9\u7EA0\u7EB7\u00B7\u8BB0\u6069\u4E0E\u6068\n';
        tp1c += '    \u00B7 \u5546\u8BAE\u5171\u540C\u4E0A\u758F\u00B7\u8054\u540D\u5448\u8BF7\n';
        tp1c += '    \u00B7 \u8F6C\u6C42\u540C\u95E8/\u540C\u4E61\u63F4\u5F15\n';
        tp1c += '    \u00B7 \u5199\u4FE1\u6170\u95EE\u75C5\u8005\u00B7\u540A\u5510\u4E27\u8005\u00B7\u8D53\u793C\u7230\u5BD7\n';
        tp1c += '    \u00B7 \u540C\u89C2\u4E66\u753B\u00B7\u5171\u8D4F\u53E4\u73A9\u00B7\u6B23\u8D4F\u82B1\u6728\n';
        tp1c += '    \u00B7 \u7ED3\u793E\u96C5\u96C6\uFF08\u8BD7\u793E/\u6587\u793E/\u4E49\u793E/\u4E91\u7845\u4F1A\uFF09\n';
        tp1c += '    \u00B7 \u65C5\u884C\u540C\u6E38\u00B7\u8BBF\u53E4\u5BFB\u80DC\u00B7\u5BFC\u6E38\u516C\u4E8B\n';
        tp1c += '    \u00B7 \u8D60\u7B54\u6587\u5B57\u00B7\u6B21\u97F5\u552F\u92F3\u7B54\u7B54\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u4E3B\u52A8\u5EFA\u6784\u540D\u671B\u8D24\u80FD\u884C\u4E3A\uFF08\u5FC3\u6709\u91CE\u671B/\u91CD\u89C6\u540D\u8282\u7684 NPC \u5E94\u4E3B\u52A8\u4E3A\u4E4B\uFF09\u3011\n';
        tp1c += '    \u00B7 \u6551\u6D4E\u707E\u6C11\u00B7\u65BD\u7CA5\u6296\u8863\uFF08\u540D\u671B+ \u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u6350\u8D44\u5174\u5B66\u00B7\u5EFA\u4E66\u9662\u00B7\u7F62\u5B66\u8D4F\u4E8B\uFF08\u540D\u671B+\uFF09\n';
        tp1c += '    \u00B7 \u8BB2\u5B66\u00B7\u7ACB\u8A00\u00B7\u8457\u4E66\u7ACB\u5B66\u6D3E\uFF08\u6587\u540D+\uFF09\n';
        tp1c += '    \u00B7 \u5956\u638E\u540E\u8FDB\u00B7\u8350\u62D4\u8D24\u624D\u00B7\u63D0\u643A\u4E0B\u58EB\uFF08\u8D24\u80FD++\uFF09\n';
        tp1c += '    \u00B7 \u4FEE\u5FD7\u7F16\u53F2\u00B7\u96C6\u8D24\u8BEF\u7279\u7AD9\uFF08\u6587\u5316\u8D21\u732E\u00B7\u540D\u671B+\uFF09\n';
        tp1c += '    \u00B7 \u5174\u4FEE\u6C34\u5229\u00B7\u5EFA\u8DEF\u7B51\u6865\u00B7\u60E0\u6C11\u5DE5\u7A0B\uFF08\u540D\u671B+ \u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u6E05\u5EC9\u81EA\u5B88\u00B7\u62D2\u8D3F\u4E0D\u62DC\u00B7\u5404\u6D01\u8EAB\u4EE5\u98DF\uFF08\u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u629A\u6070\u5B64\u5BA1\u00B7\u65BD\u60E0\u8001\u5F31\u00B7\u89E3\u56F0\u5982\u4EB2\uFF08\u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u5E73\u53CD\u51A4\u72F1\u00B7\u56F4\u590D\u540D\u6D41\u00B7\u6B63\u6C89\u53D7\u5C48\uFF08\u540D\u671B++ \u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u4E3B\u6301\u4E61\u796D\u00B7\u8C03\u505C\u5B97\u65CF\u7EA0\u7EB7\uFF08\u5730\u65B9\u540D\u671B+\uFF09\n';
        tp1c += '    \u00B7 \u66FF\u4EBA\u62C5\u4FDD\u00B7\u8DF5\u8BFA\u5B88\u4FE1\u00B7\u4E49\u8D48\u6025\u96BE\uFF08\u4FE1\u4E49+ \u8D24\u80FD+\uFF09\n';
        tp1c += '    \u00B7 \u4E3A\u56FD\u732E\u7B56\u00B7\u72AF\u9A6C\u76F4\u8C0F\u00B7\u62A5\u56FD\u5C4E\u8EAB\uFF08\u5FE0\u540D+\uFF09\n';
        tp1c += '    \u00B7 \u6784\u7C50\u8BD7\u6587\u00B7\u9898\u8DCB\u540D\u54C1\u00B7\u9700\u987B\u96B6\u5B66\uFF08\u6587\u540D+\uFF09\n';
        tp1c += '    \u00B7 \u7F6E\u4E49\u7530\u4E49\u58AE\u00B7\u4EA4\u4E8B\u5BD7\u65CF\u4EBA\uFF08\u65CF\u671B+ \u8D24\u80FD+\uFF09\n';
        tp1c += '    \u2605 \u9700\u6839\u636E NPC \u6027\u683C\u4E0E\u91CE\u5FC3\u9009\u62E9\uFF1A\u6E05\u6D41\u58EB\u5927\u592B\u504F\u5411\u6587\u5316\u00B7\u8BB2\u5B66\u00B7\u7F6E\u4E49\u7530\uFF0C\n';
        tp1c += '      \u529F\u5229\u578B\u504F\u5411\u6350\u8D44\u5174\u6559\u00B7\u8350\u62D4\u00B7\u60E0\u6C11\u5DE5\u7A0B\uFF0C\u5FE0\u81EA\u578B\u504F\u5411\u76F4\u8C0F\u00B7\u5CD7\u8074\u00B7\u62A5\u56FD\uFF0C\u4EC1\u5FB7\u578B\u504F\u5411\u5E73\u51A4\u00B7\u5B88\u4FE1\u00B7\u629A\u6070\u3002\n';
        tp1c += '    \u2605 \u4EE5\u4E0A\u884C\u4E3A\u53EF\u901A\u8FC7 npc_interactions \u8F93\u51FA\uFF08type \u53EF\u4EE3\u5165 mediate/recommend/guarantee/petition_jointly\u7B49\uFF09\uFF0C\n';
        tp1c += '      \u6216\u901A\u8FC7 fengwen_snippets \u98CE\u95FB\u6761\u5230\u6620\u5728\u73A9\u5BB6\u76F8\u5173\u9762\u677F\u3002\n\n';

        tp1c += '  \u3010\u5730\u65B9\u5B98\u00B7\u8F96\u533A\u6CBB\u7406\u884C\u4E3A\uFF08\u5728\u5730\u65B9\u4EFB\u804C\u7684 NPC \u5E94\u4E3A\u672C\u8F96\u4E4B\u653F\uFF09\u3011\n';
        tp1c += '    \u00B7 \u52DD\u8BFE\u519C\u6851\u00B7\u7763\u7A3B\u5782\u6E9E\uFF08\u6625\u8015\u79CB\u6536\u65F6\u8282\uFF09\n';
        tp1c += '    \u00B7 \u5174\u4FEE\u6C34\u5229\u00B7\u7591\u5824\u758F\u6CB3\u00B7\u62A4\u5821\u7B51\u9655\n';
        tp1c += '    \u00B7 \u6E05\u4E08\u7530\u4EA9\u00B7\u6838\u9AA8\u6237\u53E3\u00B7\u8FFD\u8FFD\u9690\u6237\u00B7\u6536\u62DB\u6D41\u6C11\n';
        tp1c += '    \u00B7 \u5BA1\u7406\u523B\u72F1\u00B7\u5A87\u96F7\u51A4\u72F1\u00B7\u907F\u796D\u6B24\u9F50\u7AED\n';
        tp1c += '    \u00B7 \u6574\u987F\u9A7F\u4F20\u00B7\u5DE1\u4F50\u5173\u5361\u00B7\u6682\u6CC4\u76D7\u532A\u00B7\u7ACB\u7AAD\u5802\u6A50\n';
        tp1c += '    \u00B7 \u5174\u529E\u5B66\u5BAB\u00B7\u9009\u62D4\u8D21\u751F\u00B7\u8BAE\u4E0A\u4E61\u5B66\u00B7\u9080\u6743\u8BB2\u5B66\n';
        tp1c += '    \u00B7 \u5907\u8352\u4ED3\u5EEA\u00B7\u5E73\u7C74\u5E73\u7C75\u00B7\u8D48\u707E\u6296\u60E0\n';
        tp1c += '    \u00B7 \u6574\u6CBB\u80E5\u540F\u00B7\u60E9\u8BAE\u7EB9\u5C24\u00B7\u63AD\u9664\u5347\u6597\u6301\u6237\n';
        tp1c += '    \u00B7 \u7981\u6BC1\u6DEB\u7960\u00B7\u79FB\u98CE\u6613\u4FD7\u00B7\u65BD\u8005\u6E05\u81D5\u9664\u75B0\n';
        tp1c += '    \u00B7 \u7AC0\u8BA7\u7269\u4EF7\u00B7\u7763\u67E5\u5E02\u6728\u00B7\u62B1\u514B\u632A\u66FF\u00B7\u7F6E\u55BD\u53AA\u5BBF\n';
        tp1c += '    \u00B7 \u6309\u5BDF\u6B66\u4E61\u00B7\u56E0\u4E8B\u8BF7\u5D1C\u6C11\u529B\u00B7\u5BD2\u4E8B\u5385\u6EEA\n';
        tp1c += '    \u2605 \u6210\u4EE3\u5B9E\u65BD\u53EF\u63D2 localActions (region/type/amount/reason/proposer)\uFF0C\u4EA6\u53EF\u5165 fengwen_snippets\u3002\n\n';

        tp1c += '  \u3010\u4E2D\u592E\u5B98\u5458\u00B7\u90E8\u5236\u5C65\u804C\u00B7\u9673\u66FF\u884C\u4E3A\uFF08\u4EAC\u4E2D\u4EFB\u804C\u7684 NPC \u5E94\u4E3A\u5C5E\u7CFB\u4E4B\u4E8B\uFF09\u3011\n';
        tp1c += '    \u00B7 \u6279\u9605\u79EF\u538B\u6587\u4E66\u00B7\u4F1A\u5BA1\u5357\u5317\u9707\u58AC\u00B7\u5904\u7F6E\u5076\u6298\u5F52\u5B98\n';
        tp1c += '    \u00B7 \u5802\u53F8\u4F1A\u516C\u00B7\u96F2\u4F7F\u548C\u8BAE\u00B7\u53EC\u96C6\u8FDE\u4E95\u00B7\u4F1A\u4F1A\u503E\u5CE7\u8868\n';
        tp1c += '    \u00B7 \u4E3B\u6301\u90E8\u52A1\u4F1A\u8BAE\u00B7\u4E0B\u8BB0\u90E8\u5C5E\u00B7\u8003\u5BDF\u8D4E\u9EDC\u9676\n';
        tp1c += '    \u00B7 \u5949\u65E8\u67E5\u6838\u67D0\u4E8B\u00B7\u8F9F\u9B42\u8C03\u9605\u6863\u6848\u00B7\u8C03\u5BFB\u7B25\u58AB\u53B2\u5171\n';
        tp1c += '    \u00B7 \u5E9C\u540E\u805D\u4E0B\u90E8\u5C5E\u00B7\u7763\u8B3C\u6EE1\u8F93\u597A\u6210\u90E8\u00B7\u8003\u57CE\u51E1\u6240\u636F\n';
        tp1c += '    \u00B7 \u6D1D\u5C06\u6C97\u76EE\u00B7\u4F7F\u5B98\u4F53\u7B25\u7B49\u900F\u00B7\u5B66\u80FD\u6025\u89C4\n';
        tp1c += '    \u00B7 \u4E3B\u6301\u5927\u793C\u00B7\u8FD8\u9882\u793E\u7A37\u00B7\u53EC\u5F00\u796D\u6BBF\u00B7\u66FF\u7687\u4E0B\u6388\u8BC4\n';
        tp1c += '    \u00B7 \u63A5\u5F85\u5916\u4F7F\u00B7\u5C5E\u56FD\u671D\u8D21\u00B7\u4F1A\u8C08\u5916\u4F7F\u00B7\u8BB0\u6C88\u5916\u4E0B\n';
        tp1c += '    \u00B7 \u7B79\u5212\u672C\u90E8\u6539\u9769\u00B7\u8BAE\u5E76\u5E9C\u5C40\u00B7\u5351\u963B\u51FA\u5C5E\u5B5D\u5FC6\u8ACB\u7684\n';
        tp1c += '    \u00B7 \u540C\u4E8B\u4F1A\u8BAE\u3001\u8054\u540D\u4E0A\u7983\u00B7\u4F1A\u540C\u4E0D\u540C\u90E8\u95E8\u5E9C\u5177\u5171\u4EE4\n';
        tp1c += '    \u2605 \u90E8\u5185\u884C\u4E3A\u53EF\u7528 npc_interactions (type:mediate/petition_jointly/recommend) \u6216 fengwen_snippets(type:\u594F\u8BAE/\u594F\u8BEE/\u8BAE\u793A)\u3002\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u79C1\u4EA7\u7ECF\u8425\u884C\u4E3A\uFF08\u51E0\u4E4E\u6240\u6709 NPC \u90FD\u4F1A\u8003\u8651\u5BB6\u5E9F\uFF09\u3011\n';
        tp1c += '    \u00B7 \u8D2D\u7F6E\u7530\u4EA9\u00B7\u540A\u7F6E\u5B85\u9662\u00B7\u628A\u58F0\u540C\u4EA7\u00B7\u4FEE\u7F6E\u5E84\u56ED\n';
        tp1c += '    \u00B7 \u79C1\u4E0B\u7ECF\u5546\u00B7\u5F00\u8BBE\u5178\u5F53\u00B7\u653E\u8D37\u53D6\u606F\u00B7\u6295\u81D3\u7980\u5385\u4E1A\n';
        tp1c += '    \u00B7 \u6536\u53D7\u793C\u91D1\u00B7\u4E0B\u5C5E\u5B5D\u656C\u00B7\u5916\u585E\u6C14\u541F\u793C\u00B7\u4E92\u79FB\u8D35\u91CD\u8D60\u4E86\n';
        tp1c += '    \u00B7 \u5C06\u4E2A\u4EBA\u8D22\u4EA7\u8F6C\u79FB\u6216\u863E\u533F\u00B7\u79C1\u4E0B\u884C\u4E50\n';
        tp1c += '    \u00B7 \u5957\u7528\u516C\u5B34\u00B7\u6D6A\u8D39\u516C\u6B3E\u00B7\u4F53\u5F52\u6578\u8D22\u00B7\u8C15\u8106\u5173\u6BBF\n';
        tp1c += '    \u00B7 \u878D\u8D44\u65CF\u4EA7\u00B7\u5BB6\u5B5F\u6E4F\u6E34\u00B7\u517B\u95E8\u5BA2\u6216\u96C7\u7528\u4EBA\n';
        tp1c += '    \u00B7 \u538B\u4EAC\u4FE1\u00B7\u8D44\u52A9\u4ECE\u7BE5\u4EB2\u53CB\u00B7\u5B8C\u6210\u4E3B\u7537\u5973\u5A5A\u5B50\u5C00\n';
        tp1c += '    \u00B7 \u8D2A\u6E9A\u6311\u62DB\u00B7\u8D37\u9057\u79C1\u4EBA\u50A8\u91D1\u00B7\u7528\u4E8E\u7529\u961F\u9886\u8A00\u6280\u5DE7\u7B49\n';
        tp1c += '    \u2605 \u901A\u8FC7 char_updates.updates.resources.private.money (delta) \u4F53\u73B0\u79C1\u4EA7\u53D8\u5316\uFF1B\n';
        tp1c += '      \u6216 fengwen_snippets (type:\u8D22\u884C/\u5BB6\u4E8B/\u7F6E\u4EA7) \u98CE\u95FB\u4F20\u3002\n';
        tp1c += '    \u26A0 \u4FB5\u5E05\u7C7B\u884C\u4E3A (\u5957\u7528\u516C\u5B34/\u53D7\u8D3F) \u4F1A\u4F7F\u540D\u671B\u7F29\u51CF\uFF1B\u8907\u9ED1\u7684\u4F1A\u88AB\u8BAE\u79C1\u4E0B\u4F20\u6B66\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u516C\u5E93\u5173\u5207\u62C5\u5F53\u884C\u4E3A\uFF08\u4EC5\u6709\u80FD\u529B/\u5FD7\u5411/\u4E94\u5E38\u4EC1\u4E49+ \u7684 NPC \u624D\u4F1A\u4E3A\u4E4B\uFF09\u3011\n';
        tp1c += '    \u00B7 \u6350\u4FF8\u8865\u516C\u5E93\u4E8F\u7A7A\u00B7\u8DDF\u4E0D\u53D7\u63D0\u996E\u00B7\u4EE5\u79C1\u8D27\u57AB\u529E\u516C\u4E8B\n';
        tp1c += '    \u00B7 \u51FB\u76D8\u4FDD\u5F92\u00B7\u4E3B\u52A8\u6838\u67E5\u8D26\u76EE\u00B7\u67E5\u63ED\u8D2A\u5F0A\u00B7\u9A71\u9010\u8D2A\u5414\n';
        tp1c += '    \u00B7 \u7BC0\u6D41\u7701\u8D39\u00B7\u5F01\u5E9F\u79C1\u8D39\u00B7\u8DDF\u683C\u5F15\u7BC0\u516C\u9A7F\u6F14\n';
        tp1c += '    \u00B7 \u4E0A\u7687\u8BF7\u589E\u62E8\u6B3E\u00B7\u79E6\u8BF7\u6BEA\u52A8\u516C\u5E93\u00B7\u8BF7\u8C03\u9971\u6D88\u5206\u5F01\n';
        tp1c += '    \u00B7 \u5F39\u52BE\u632A\u6324\u516C\u5E93\u8005\u00B7\u6770\u7D22\u56DE\u8086\u53D1\u6263\u6B3E\n';
        tp1c += '    \u00B7 \u4E88\u4EE5\u4EFB\u4E00\u884C\u4E3A\u4E2D\u8D44\u8D28\u4E8E\u5751\u516C\u4EBA\u4EFB\u7684\u7269\u4EF7\u76D2\u5FAA\u5229\u751F\u4F1A\u8FE3\u4E4B\n';
        tp1c += '    \u2605 \u8D24\u80FD+\u5EC9 \u2265 65 \u4E14 \u4ED6 \u8D1F\u8D23\u4E86\u67D0\u516C\u5E93 \u2192 \u9AD8\u6982\u7387\u8003\u8651\u4E3A\u4E4B\uFF1B\n';
        tp1c += '      \u79C1\u5FC3\u91CD/\u5EC9<40 \u2192 \u5C11\u6709\u5173\u5207\uFF0C\u4E00\u5207\u79C1\u4E3A\u5148\u3002\n';
        tp1c += '    \u2605 \u884C\u4E3A\u6279\u5230 npc_interactions (type:expose_secret/impeach/guarantee) \u6216 char_updates\u8C03\u516C\u5E93\uFF1B\n';
        tp1c += '      fengwen_snippets (type:\u53F8\u6CD5/\u6838\u67E5/\u6350\u4FF8) \u4F20\u98CE\u95FB\u3002\n\n';

        tp1c += '  \u3010\u4EBA\u7269\u00B7\u79C1\u4EBA\u751F\u6D3B\u65E5\u5E38\u3011\n';
        tp1c += '    \u00B7 \u5BB6\u4E8B\u5904\u7406\uFF08\u796D\u7956/\u5A5A\u5A36/\u4E27\u846C/\u8BAD\u5B50/\u5206\u5BB6\uFF09\n';
        tp1c += '    \u00B7 \u5B97\u6559\u4FE1\u4EF0\uFF08\u8FDB\u5E99/\u793C\u4F5B/\u6C42\u9053/\u9F4B\u6212/\u7167\u706B\u7586\u75AB\uFF09\n';
        tp1c += '    \u00B7 \u517B\u751F\u4FDD\u5065\uFF08\u670D\u836F/\u9759\u5750/\u5BFC\u5F15/\u4E94\u79BD\u620F\uFF09\n';
        tp1c += '    \u00B7 \u6587\u623F\u96C5\u4E8B\uFF08\u6536\u85CF\u91D1\u77F3/\u9898\u8DCB\u4E27\u672C/\u4E34\u5E16/\u523B\u5370\uFF09\n';
        tp1c += '    \u00B7 \u56ED\u6797\u6E38\u61A9\uFF08\u8D4F\u82B1/\u542C\u7434/\u9493\u9C7C/\u5F02\u745E\u552F\u548C\uFF09\n';
        tp1c += '    \u00B7 \u7814\u7A76\u8457\u8FF0\uFF08\u6821\u52D8\u7ECF\u7C4D/\u64B0\u53F2/\u6CE8\u758F/\u4FEE\u65B9\u5FD7\uFF09\n';
        tp1c += '    \u00B7 \u5904\u7406\u75BE\u75C5\u00B7\u4E27\u670D\u5B88\u5236\n';
        tp1c += '    \u00B7 \u4E91\u6E38\u53E4\u8FF9\u00B7\u65E0\u65E0\u5C81\u6708\u00B7\u6E29\u8F66\u6253\u5149\n\n';

        tp1c += '  \u3010\u52BF\u529B\u00B7\u5185\u653F\u6D3B\u52A8\u3011\n';
        tp1c += '    \u00B7 \u6574\u987F\u5F8B\u6CD5\u00B7\u9881\u5E03\u65B0\u4EE4\n';
        tp1c += '    \u00B7 \u6E05\u67E5\u6237\u53E3\u00B7\u4E08\u91CF\u7530\u4EA9\n';
        tp1c += '    \u00B7 \u6539\u5143\u00B7\u66F4\u5B9A\u5E74\u53F7\u00B7\u6539\u5236\u5189\u5B98\n';
        tp1c += '    \u00B7 \u5BAB\u5EF7\u4EBA\u4E8B\u6574\u987F\u00B7\u7F62\u9769\u5B66\u5E9C/\u56FD\u5B50\u76D1\n';
        tp1c += '    \u00B7 \u7F62\u9769\u5BA6\u5B98\u00B7\u6574\u9970\u5185\u5BAB\n\n';

        tp1c += '  \u3010\u52BF\u529B\u00B7\u519B\u4E8B\u6D3B\u52A8\u3011\n';
        tp1c += '    \u00B7 \u7B79\u5EFA\u65B0\u519B\u00B7\u6574\u7F16\u65E7\u90E8\n';
        tp1c += '    \u00B7 \u4FEE\u7B51\u57CE\u9632\u00B7\u589E\u8BBE\u8FB9\u585E/\u5821\u91D1\n';
        tp1c += '    \u00B7 \u8C03\u52A8\u9A7B\u519B\u00B7\u66F4\u6362\u5C06\u9886\n';
        tp1c += '    \u00B7 \u50A8\u5907\u7CAE\u8349\u00B7\u8C03\u8FD0\u519B\u9700\n';
        tp1c += '    \u00B7 \u5F81\u52DF\u5175\u6E90\u00B7\u7EC3\u5175\u8BB2\u6B66\n';
        tp1c += '    \u00B7 \u519B\u5C6F\u519B\u7530\u6539\u5236\n\n';

        tp1c += '  \u3010\u52BF\u529B\u00B7\u7ECF\u6D4E\u6C11\u751F\u6D3B\u52A8\u3011\n';
        tp1c += '    \u00B7 \u5F00\u5E02\u901A\u5546\u00B7\u6574\u8083\u5E02\u6988\n';
        tp1c += '    \u00B7 \u53EC\u52DF\u6D41\u6C11\u5C6F\u57A6\n';
        tp1c += '    \u00B7 \u63A8\u884C\u5E73\u7C74/\u5E73\u7C75\n';
        tp1c += '    \u00B7 \u6539\u94F8\u94B1\u5E01\u00B7\u6574\u7406\u76D0\u94C1\n';
        tp1c += '    \u00B7 \u5174\u529E\u77FF\u51B6\u00B7\u7B79\u5EFA\u6F15\u8FD0\n';
        tp1c += '    \u00B7 \u8BBE\u7ACB\u4ED3\u50A8\u00B7\u8D48\u707E\u6D4E\u6C11\n\n';

        tp1c += '  \u3010\u52BF\u529B\u00B7\u6587\u5316\u5B97\u6559\u5916\u4EA4\u6D3B\u52A8\u3011\n';
        tp1c += '    \u00B7 \u4E3E\u529E\u79D1\u4E3E/\u796D\u5929/\u5C01\u7985\n';
        tp1c += '    \u00B7 \u5174\u5EFA\u5BFA\u89C2\u00B7\u656C\u4E8B\u795E\u7948\n';
        tp1c += '    \u00B7 \u6574\u7406\u5178\u7C4D\u00B7\u7F16\u7EAE\u56FD\u53F2\n';
        tp1c += '    \u00B7 \u63A8\u5E7F\u672C\u65CF\u6587\u5316/\u6587\u5B57\n';
        tp1c += '    \u00B7 \u6291\u5236\u5F02\u7AEF\u00B7\u7981\u6BC1\u90AA\u8BF4\n';
        tp1c += '    \u00B7 \u6D3E\u9063\u4F7F\u8005/\u63A5\u7EB3\u6D41\u4EA1\n';
        tp1c += '    \u00B7 \u53EC\u96C6\u90E8\u843D\u5927\u4F1A/\u8BF8\u4FAF\u76DF\u4F1A\n\n';

        tp1c += '\u3010\u786C\u89C4\u5219\u3011\n';
        tp1c += '  \u00B7 \u4EC5\u8FD4\u56DE\u4E0A\u8FF0 9 \u4E2A\u5B57\u6BB5\u7684 JSON\uFF0C\u4E0D\u8981\u4EFB\u4F55\u5176\u4ED6\u5B57\u6BB5\n';
        tp1c += '  \u00B7 \u4EBA\u540D/\u52BF\u529B\u540D\u5FC5\u987B\u4F7F\u7528\u4E0A\u65B9\u5217\u51FA\u7684\u540D\u79F0\n';
        tp1c += '  \u00B7 \u9632\u6B62"\u5FA1\u53F2\u5FC5\u8C0F\u00B7\u5C06\u519B\u5FC5\u6218\u00B7\u6E05\u6D41\u5FC5\u52BE\u5BA6\u5B98"\u5DE5\u5177\u4EBA\u6A21\u677F\u2014\u2014\u6309 NPC \u6027\u683C/\u6D3E\u7CFB/\u4E0E\u76EE\u6807\u5173\u7CFB/\u5FE0\u5FD7\u5EC9\u9009\u884C\u4E3A\n';
        tp1c += '  \u00B7 \u591A\u6570\u4EBA\u89C2\u671B/\u660E\u54F2\u4FDD\u8EAB\uFF0C\u5C11\u6570\u4EBA\u4ECB\u5165\n';
        tp1c += '  \u00B7 \u73A9\u5BB6 ' + _pNameC + ' \u4E0D\u5F97\u4F5C\u4EFB\u4F55\u5B57\u6BB5\u4E2D\u7684 actor/schemer\n';
        tp1c += '  \u00B7 \u5386\u53F2\u8D26\u672C\u4E00\u81F4\u6027\u2014\u2014\u767E\u5E74\u524D\u7684\u4EE4\u6068/\u6069\u60E0\u4ECA\u4ECD\u6709\u4F59\u6CE2\uFF1B\u4E0D\u53EF\u8F7B\u6613\u201C\u548C\u597D\u201D\u4E4B\u524D\u7684\u5C60\u57CE/\u80CC\u76DF\u4EC7\u6577\n';

        tp1c += '\n\u8FD4\u56DE\u683C\u5F0F\u793A\u4F8B\uFF1A\n';
        tp1c += '{\n  "faction_interactions_advanced":[{...}],\n  "faction_events":[{...}],\n  "faction_ai_outcomes":[{...}],\n  "faction_relation_changes":[{...}],\n  "faction_succession":[{...}],\n  "npc_schemes":[{...}],\n  "scheme_actions":[{...}],\n  "hidden_moves":["..."],\n  "fengwen_snippets":[{...}]\n}';

        // 动态 max_tokens：取模型输出上限与业务 8K 的较小值
        var _sc1cBaseTok = Math.min(_effectiveOutCap || 8192, 8192);
        // G3·SC1c 势力博弈·温度略降·求稳不求怪
        var _sc1cTemp = Math.max(0.3, _modelTemp - 0.15);
        // M4·Anthropic 原生 API 且 sys 长·加 cache_control
        // [sysP分级·2026-07-02] 补漏斗：走 sysPFor 纳入 profile 表（默认FULL=字节恒等）·缓存包装沿用原生判定
        var _sc1cSys = sysPFor('sc1c');
        var _sc1cMsgs = [{role:'system',content:_sc1cSys},{role:'user',content:tp1c}];
        try {
          var _isNativeAnth1c = (P.ai && P.ai.url && /api\.anthropic\.com/i.test(P.ai.url));
          if (_modelFamily === 'anthropic' && _isNativeAnth1c && _sc1cSys.length > 1500) {
            _sc1cMsgs = [{role:'system', content:[{type:'text', text:_sc1cSys, cache_control:{type:'ephemeral'}}]}, {role:'user',content:tp1c}];
          }
        } catch(_){}
        // ★ Token 预算监控·SC1c
        try {
          if (typeof checkPromptTokenBudget === 'function') {
            var _sc1cFullPrompt = (_sc1cSys || '') + '\n' + (tp1c || '');
            var _sc1cTokRes = checkPromptTokenBudget(_sc1cFullPrompt, function(status, tokens, bg) {
              if (typeof toast === 'function') toast('[SC1c] prompt ' + status + '·' + tokens + ' tokens');
            });
            if (typeof window !== 'undefined') {
              window.TM = window.TM || {}; window.TM.lastPromptTokens = window.TM.lastPromptTokens || {};
              window.TM.lastPromptTokens.sc1c = { tokens: _sc1cTokRes.tokens, status: _sc1cTokRes.status, ts: Date.now() };
            }
          }
        } catch(_tokE) {}
        var _sc1cBody = {model:P.ai.model||'gpt-4o', messages:_sc1cMsgs, temperature:_sc1cTemp, max_tokens:_tok(_sc1cBaseTok)};
        // Phase 6 Q1·sc1c strict json_schema (P.ai.openaiStrict=true)
        var _sc1cRf = _selectResponseFormat(_modelFamily, _buildSc1cJsonSchema);
        if (_sc1cRf) _sc1cBody.response_format = _sc1cRf;

        var _sc1cCall = await _callEndturnAI(_sc1cBody, {
          id: 'sc1c',
          label: '\u52BF\u529B\u9634\u8C0B',
          expectedKeys: ['faction_events', 'faction_ai_outcomes', 'faction_interactions_advanced', 'npc_schemes', 'scheme_actions'],
          priority: 'high'
        });
        if (_sc1cCall && _sc1cCall.data) {
          var data1c = _sc1cCall.data;
          var c1c = _sc1cCall.raw || '';
          var _p1cParse = _sc1cCall.parse;
          if (_p1cParse && _p1cParse.raw) c1c = _p1cParse.raw;
          var p1c = _p1cParse ? _p1cParse.parsed : null;
          GM._turnAiResults.subcall1c_raw = c1c;
          GM._turnAiResults.subcall1c = p1c;
          try { if (window.TM && TM.validateAIOutput) TM.validateAIOutput(p1c, 'subcall1c'); } catch(_vce){}

          if (p1c && p1) {
            // ── sc1 自动派发的 5 字段：concat 合并即可 ──
            if (Array.isArray(p1c.faction_interactions_advanced)) p1.faction_interactions_advanced = (Array.isArray(p1.faction_interactions_advanced) ? p1.faction_interactions_advanced : []).concat(p1c.faction_interactions_advanced);
            if (Array.isArray(p1c.faction_events)) p1.faction_events = (Array.isArray(p1.faction_events) ? p1.faction_events : []).concat(p1c.faction_events);
            if (Array.isArray(p1c.faction_ai_outcomes)) p1.faction_ai_outcomes = (Array.isArray(p1.faction_ai_outcomes) ? p1.faction_ai_outcomes : []).concat(p1c.faction_ai_outcomes);
            if (Array.isArray(p1c.faction_relation_changes)) p1.faction_relation_changes = (Array.isArray(p1.faction_relation_changes) ? p1.faction_relation_changes : []).concat(p1c.faction_relation_changes);
            if (Array.isArray(p1c.faction_succession)) p1.faction_succession = (Array.isArray(p1.faction_succession) ? p1.faction_succession : []).concat(p1c.faction_succession);
            if (Array.isArray(p1c.scheme_actions)) p1.scheme_actions = (Array.isArray(p1.scheme_actions) ? p1.scheme_actions : []).concat(p1c.scheme_actions);

            // ── npc_schemes / hidden_moves：sc1 不派发，内联处理 ──
            if (Array.isArray(p1c.npc_schemes)) {
              if (!GM.activeSchemes) GM.activeSchemes = [];
              p1c.npc_schemes.forEach(function(s){
                if (!s || !s.schemer || !s.target || !s.plan) return;
                GM.activeSchemes.push({
                  id: 'scheme_T' + GM.turn + '_' + Math.random().toString(36).slice(2,6),
                  schemer: s.schemer, target: s.target,
                  plan: s.plan, progress: s.progress || '\u915D\u917F\u4E2D',
                  // \u3010sc1c \u5347\u7EA7\u00B7C1\u3011\u8865\u9F50 scheme_actions \u6D88\u8D39\u65B9(apply.js:5431)\u6240\u9700\u5F62\u72B6:status/\u6570\u503C progressPct/typeName\u2014\u2014
                  //   \u539F\u7F3A\u6B64\u4E09\u8005\u81F4 sc1c \u81EA\u4EA7\u9634\u8C0B\u7684 advance/disrupt/expose \u751F\u547D\u5468\u671F\u6C38\u8FDC\u5339\u914D\u4E0D\u4E0A\u00B7\u540D\u5B58\u5B9E\u4EA1\u3002progress \u5B57\u7B26\u4E32\u4FDD\u7559\u7ED9 ChronicleTracker\u3002
                  status: 'active',
                  progressPct: ({ '\u957F\u671F\u5E03\u5C40':15, '\u915D\u917F\u4E2D':35, '\u5373\u5C06\u53D1\u52A8':70, '\u5DF2\u53D1':90 })[s.progress || '酝酿中'] || 20,   /* Codex 审查修·F4:progressPct 从与 progress 同一默认阶段算·免 20/35 不一致 */
                  typeName: String(s.typeName || s.type || '\u5BC6\u8C0B').slice(0, 12),
                  // \u3010sc1c \u5347\u7EA7\u00B7C4\u3011\u9634\u8C0B\u6DF1\u5316\u5B57\u6BB5:\u52A8\u673A/\u624B\u6BB5/\u9690\u79D8\u5EA6/\u5F97\u624B\u6761\u4EF6\u2014\u2014\u4F9B\u53D9\u4E8B\u4E0E\u540E\u7EED\u63A8\u8FDB\u66F4\u7ACB\u4F53(\u636E\u8C0B\u8005 agenda/\u6069\u6028)\u3002
                  motive: String(s.motive || '').slice(0, 60),
                  method: String(s.method || '').slice(0, 20),
                  secrecy: String(s.secrecy || '').slice(0, 12),
                  winCondition: String(s.winCondition || '').slice(0, 60),
                  allies: s.allies || '',
                  startTurn: GM.turn
                });
                addEB('\u9634\u8C0B', s.schemer + ' \u9488\u5BF9 ' + s.target + '\uFF1A' + String(s.plan).slice(0,40) + ' [' + (s.progress||'\u915D\u917F\u4E2D') + ']');
              });
            }
            if (Array.isArray(p1c.hidden_moves)) {
              // \u3010sc1c \u5347\u7EA7\u00B7C3\u3011\u6697\u6D41\u4E0D\u518D\u53EA addEB \u65E5\u5FD7(\u8FD1\u4E4E\u6B7B\u8F93\u51FA:\u6BCF\u56DE\u5408\u4EA7 \u22658 \u6761\u5374\u65E0\u5B58\u7EED)\u00B7\u6EDA\u52A8\u5B58 GM._hiddenMoves \u4F9B\u4E0B\u56DE\u5408 sc1c \u627F\u63A5(\u591A\u56DE\u5408\u6697\u6D41\u8FDE\u7EED\u6027)\u3002
              if (!Array.isArray(GM._hiddenMoves)) GM._hiddenMoves = [];
              p1c.hidden_moves.forEach(function(hm){
                if (typeof hm === 'string' && hm) { addEB('\u6697\u6D41', hm); GM._hiddenMoves.push({ text: String(hm).slice(0, 80), turn: GM.turn }); }
              });
              if (GM._hiddenMoves.length > 40) GM._hiddenMoves = GM._hiddenMoves.slice(-40);
            }

            // ── fengwen_snippets：直接入风闻录事 + actors 记忆心绪联动 ──
            if (Array.isArray(p1c.fengwen_snippets) && typeof PhaseD !== 'undefined' && PhaseD.addFengwen) {
              // type → 默认 mood 映射（若 AI 未显式给 mood）
              var _fwMoodMap = {
                '\u5F39\u52BE':'\u6012','\u6784\u9677':'\u6012','\u9020\u8C23':'\u6012','\u8BBD\u523A':'\u6012','\u63ED\u79C1':'\u6012',
                '\u8350\u4E3E':'\u559C','\u6350\u4FF8':'\u559C','\u5BB4\u996E':'\u559C','\u6E38\u5BB4':'\u559C','\u8BD7\u793E':'\u559C','\u5956\u5F0F':'\u559C','\u96C5\u793A':'\u559C','\u6C42\u5A5A':'\u559C','\u4E92\u5E02':'\u559C','\u76DF\u7EA6':'\u559C',
                '\u7ED3\u515A':'\u5E73','\u79C1\u8BBF':'\u5E73','\u5B66\u8BBA':'\u5E73','\u8D22\u884C':'\u5E73','\u7F6E\u4EA7':'\u5E73','\u5C45\u7740':'\u5E73','\u8FB9\u62A5':'\u5E73','\u671D\u8D21':'\u5E73','\u9063\u4F7F':'\u5E73',
                '\u6BCD\u796D':'\u5FE7','\u4E27\u796D':'\u5FE7','\u6218\u62A5':'\u5FE7','\u4E39\u9053':'\u5FE7','\u85AC\u91CA':'\u5FE7','\u5BB6\u4E8B':'\u5FE7',
                '\u5BC6\u8054':'\u5FE7','\u5DE1\u89C6':'\u5E73','\u5DE1\u8005':'\u5E73','\u8D51\u635C':'\u6050','\u53F8\u6CD5':'\u5FE7','\u6838\u67E5':'\u5FE7','\u548C\u4EB2':'\u559C','\u8D28\u5B50':'\u5FE7'
              };
              p1c.fengwen_snippets.forEach(function(fw){
                if (!fw || !fw.text) return;
                var _fwActors = Array.isArray(fw.actors) ? fw.actors : [];
                PhaseD.addFengwen({
                  type: fw.type || '\u98CE\u8BAE',
                  text: String(fw.text).slice(0, 120),
                  credibility: (typeof fw.credibility === 'number') ? Math.max(0.3, Math.min(0.95, fw.credibility)) : 0.7,
                  source: fw.source || 'ai_sc1c',
                  actors: _fwActors,
                  turn: GM.turn
                });
                // 当事 actors → NpcMemorySystem 记忆（含心绪传递）
                if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
                  var _mood = fw.mood || _fwMoodMap[fw.type] || '\u5E73';
                  var _importance = (typeof fw.credibility === 'number' && fw.credibility > 0.8) ? 5 : 3;
                  _fwActors.forEach(function(actorName){
                    if (!actorName) return;
                    // 只为 NPC 人物写记忆（不给势力）——快速判断：有同名角色
                    if (typeof findCharByName === 'function') {
                      var _ch = findCharByName(actorName);
                      if (!_ch) return;
                      NpcMemorySystem.remember(actorName, '[' + (fw.type||'\u98CE\u95FB') + '] ' + String(fw.text).slice(0, 60), _mood, _importance);
                    }
                  });
                }
              });
            }

            _dbg('[sc1c] \u5408\u5E76: \u52BF\u4E92\u52A8+' + (p1c.faction_interactions_advanced||[]).length + ' \u52BF\u4E8B\u4EF6+' + (p1c.faction_events||[]).length + ' \u52BFAI+' + (p1c.faction_ai_outcomes||[]).length + ' \u5173\u7CFB+' + (p1c.faction_relation_changes||[]).length + ' \u7EE7\u627F+' + (p1c.faction_succession||[]).length + ' \u63A8\u8FDB+' + (p1c.scheme_actions||[]).length + ' \u65B0\u9634\u8C0B+' + (p1c.npc_schemes||[]).length + ' \u6697\u6D41+' + (p1c.hidden_moves||[]).length + ' \u98CE\u95FB+' + (p1c.fengwen_snippets||[]).length);
          }
          GM._subcallTimings.sc1c = Date.now() - _sc1cStart;
        } else {
          // dead-code path·_callEndturnAI 要么 throw 要么 return {data}·此处 fallback log·不读 stale resp1c
          console.warn('[sc1c] empty call result (unexpected)·_sc1cCall=', _sc1cCall);
        }
      } catch(_sc1cErr) {
        console.warn('[sc1c] \u5931\u8D25\uFF08\u4E0D\u5F71\u54CD\u4E3B\u6D41\u7A0B\uFF09:', _sc1cErr.message || _sc1cErr);
        // Phase 1 H5\u00B7\u9519\u8BEF\u66B4\u9732\u7ED9\u8BCA\u65AD\u9762\u677F
        try {
          if (ctx && ctx.meta) {
            ctx.meta.errors = ctx.meta.errors || [];
            ctx.meta.errors.push({ subcall: 'sc1c', phase: 'execute', err: (_sc1cErr && _sc1cErr.message) || String(_sc1cErr), turn: GM && GM.turn });
          }
          if (typeof recordSubcallError === 'function') recordSubcallError('sc1c', 'execute', _sc1cErr);
        } catch(_pushE) {}
      }
      })();  // end SC1c IIFE

      // 并行等待 SC1b + SC1c + SC1d 完成（互不争用写入字段）
      try { await Promise.all([_sc1bP, _sc1cP, _sc1dP]); } catch(_sc1bcErr) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_sc1bcErr, 'sc1b+1c+1d parallel') : console.warn('[sc1b+1c+1d parallel]', _sc1bcErr); }

      // G2·失败降级链：若 SC1 主推演 JSON 失败或空·从 SC1b/SC1c 合成最小可用 p1·避免整回合卡死
      if (!p1 || !_hasSc1StructuredResult(p1)) {
        var _p1bG2 = GM._turnAiResults && GM._turnAiResults.subcall1b;
        var _p1cG2 = GM._turnAiResults && GM._turnAiResults.subcall1c;
        if (_p1bG2 || _p1cG2) {
          console.warn('[G2·降级] SC1 无有效数据·从 SC1b/SC1c 合成 fallback shizhengji');
          var _fbParts = [];
          if (_p1cG2 && Array.isArray(_p1cG2.faction_events) && _p1cG2.faction_events.length) {
            _p1cG2.faction_events.slice(0,3).forEach(function(fe){
              _fbParts.push((fe.actor||'') + (fe.target?('·'+fe.target):'') + '·' + (fe.action||'') + (fe.result?('。'+fe.result):'。'));
            });
          }
          if (_p1bG2 && Array.isArray(_p1bG2.npc_interactions) && _p1bG2.npc_interactions.length) {
            _p1bG2.npc_interactions.slice(0,3).forEach(function(ni){
              _fbParts.push((ni.actor||'') + (ni.target?('·'+ni.target):'') + '·' + (ni.description||''));
            });
          }
          var _fallbackShizhengji = _fbParts.length ? ('（AI主推演缺数·从文事势力片段合成）' + _fbParts.join('；')) : ('（AI推演暂无·天下暂无大事）');
          p1 = p1 || {};
          p1.shizhengji = p1.shizhengji || _fallbackShizhengji;
          p1.zhengwen = p1.zhengwen || _fallbackShizhengji;
          p1.turn_summary = p1.turn_summary || _fallbackShizhengji.slice(0, 120);
          p1.shizhengji_basis = p1.shizhengji_basis || _fallbackShizhengji.slice(0, 240);
          if (!Array.isArray(p1.events) || !p1.events.length) p1.events = [{ type:'AI降级', title:'子调用合成账本', text:_fallbackShizhengji.slice(0, 180), turn:GM.turn || 1 }];
          p1._g2Fallback = true;
          if (typeof toast === 'function') toast('⚠ AI主推演未返回有效数据·已从子调用合成最小史记·建议检查模型输出能力');
        }
        if (!p1 || !_hasSc1StructuredResult(p1)) {
          console.warn('[G2·降级] SC1/SC1b/SC1c 均无有效数据·启用保守应急账本');
          p1 = _buildSc1EmergencyFallback(_sc1CriticalError);
          if (typeof toast === 'function') toast('⚠ AI主推演未返回有效结构·已启用保守应急账本，本回合会继续；详见AI诊断');
        }
        GM._turnAiResults.subcall1 = p1;
      }
      if (p1 && (!p1.shizhengji || !p1.shilu_text)) {
        p1 = _attachSc1RecordFallback(p1, 'sc1d missing record text');
        GM._turnAiResults.subcall1 = p1;
      }

      // ═══════════════════════════════════════════════════════════

      ctx.subcalls._aiDepth = _aiDepth;
      ctx.subcalls._subcallMeta = _subcallMeta;
      ctx.subcalls._quietLoad = _quietLoad;
      ctx.subcalls._maybeCacheSys = _maybeCacheSys;
      ctx.subcalls._runSubcall = _runSubcall;
      ctx.subcalls._runSubcallBatch = _runSubcallBatch;
      ctx.subcalls._queuePostTurnSubcall = _queuePostTurnSubcall;
      ctx.subcalls._flushQueuedPostTurnSubcalls = _flushQueuedPostTurnSubcalls;
      ctx.subcalls._awaitQueuedPostTurnSubcallsById = _awaitQueuedPostTurnSubcallsById;
      ctx.results.sc0 = aiThinking || (GM._turnAiResults && GM._turnAiResults.thinking) || null;
      ctx.results.sc05 = memoryReview || (GM._turnAiResults && GM._turnAiResults.memoryReview) || null;
      ctx.results.sc1 = p1 || (GM._turnAiResults && GM._turnAiResults.subcall1) || null;
      ctx.results.sc1b = (GM._turnAiResults && GM._turnAiResults.subcall1b) || ctx.results.sc1b || null;
      ctx.results.sc1c = (GM._turnAiResults && GM._turnAiResults.subcall1c) || ctx.results.sc1c || null;
      ctx.results.sc1d = (GM._turnAiResults && GM._turnAiResults.subcall1d) || ctx.results.sc1d || null;
      ctx.followup.p1Summary = p1Summary || "";
      if (typeof afterSc1 === "function") {
        var _applyStarted = Date.now();
        try {
          await afterSc1(ctx);
        } catch(_applyCbErr) {
          var _applyMs = Date.now() - _applyStarted;
          var _applyInfo = _formatAIError(_applyCbErr);
          ctx.meta.errors = Array.isArray(ctx.meta.errors) ? ctx.meta.errors : [];
          ctx.meta.errors.push({ id:'sc1_apply', message:_applyInfo.message, status:_applyInfo.status, ms:_applyMs });
          try {
            if (!GM._turnAiResults) GM._turnAiResults = {};
            if (!Array.isArray(GM._turnAiResults._applyFailures)) GM._turnAiResults._applyFailures = [];
            GM._turnAiResults._applyFailures.push({ id:'sc1_apply', error:_applyInfo.message, status:_applyInfo.status, ms:_applyMs, at:Date.now() });
            if (GM._turnAiResults._applyFailures.length > 20) GM._turnAiResults._applyFailures.shift();
          } catch(_) {}
          try { if (window.TM && TM.Endturn && TM.Endturn.Timing && typeof TM.Endturn.Timing.mark === 'function') TM.Endturn.Timing.mark(ctx, 'subcall', { id:'sc1_apply', label:'结构化应用', ok:false, attempts:1, ms:_applyMs, error:_applyInfo.message, status:_applyInfo.status }); } catch(_) {}
          try { if (typeof recordAIDiagnostic === 'function') recordAIDiagnostic('subcall_failed', { id:'sc1_apply', label:'结构化应用', error:_applyInfo.message, status:_applyInfo.status, ms:_applyMs }); } catch(_) {}
          _seedRecordFromP1ForApplyFailure(ctx, p1);
          if (typeof toast === 'function') toast('⚠ 结构化数据已生成，但应用变更失败；本回合继续，详见AI诊断');
          console.warn('[SC1 apply] failed after structured result:', _applyCbErr);
        }
      }
      }); // end Sub-call 1 _runSubcall

    // 外层保险：_runSubcall 会吞掉最终异常并继续流程；若 sc1 包装层失败，仍要给后续写回/弹窗一个可用账本。
    if (!p1 || !_hasSc1StructuredResult(p1)) {
      p1 = _buildSc1EmergencyFallback('sc1 wrapper failed before producing structured result');
      if (!GM._turnAiResults) GM._turnAiResults = {};
      GM._turnAiResults.subcall1 = p1;
      GM._turnAiResults.subcall1_raw = GM._turnAiResults.subcall1_raw || JSON.stringify(p1);
    }
    if (p1 && (!p1.shizhengji || !p1.shilu_text)) {
      p1 = _attachSc1RecordFallback(p1, 'post-sc1 outer guard missing record text');
      if (!GM._turnAiResults) GM._turnAiResults = {};
      GM._turnAiResults.subcall1 = p1;
    }

    ctx.subcalls._aiDepth = _aiDepth;
    ctx.subcalls._subcallMeta = _subcallMeta;
    ctx.subcalls._quietLoad = _quietLoad;
    ctx.subcalls._maybeCacheSys = _maybeCacheSys;
    ctx.subcalls._runSubcall = _runSubcall;
    ctx.subcalls._runSubcallBatch = _runSubcallBatch;
    ctx.subcalls._queuePostTurnSubcall = _queuePostTurnSubcall;
    ctx.subcalls._flushQueuedPostTurnSubcalls = _flushQueuedPostTurnSubcalls;
    ctx.subcalls._awaitQueuedPostTurnSubcallsById = _awaitQueuedPostTurnSubcallsById;
    ctx.results.sc0 = aiThinking || (GM._turnAiResults && GM._turnAiResults.thinking) || null;
    ctx.results.sc05 = memoryReview || (GM._turnAiResults && GM._turnAiResults.memoryReview) || null;
    ctx.results.sc1 = p1 || (GM._turnAiResults && GM._turnAiResults.subcall1) || null;
    ctx.results.sc1b = (GM._turnAiResults && GM._turnAiResults.subcall1b) || ctx.results.sc1b || null;
    ctx.results.sc1c = (GM._turnAiResults && GM._turnAiResults.subcall1c) || ctx.results.sc1c || null;
    ctx.results.sc1d = (GM._turnAiResults && GM._turnAiResults.subcall1d) || ctx.results.sc1d || null;
    ctx.followup.p1Summary = p1Summary || "";
    if (GM && GM._subcallTimings) {
      for (var _tmK in GM._subcallTimings) if (GM._subcallTimings.hasOwnProperty(_tmK)) ctx.meta.timing[_tmK] = GM._subcallTimings[_tmK];
    }
    return ctx;
  };

  var SAFE_CALL_DEFAULT = { priority:'normal', timeoutMs:90000, maxRetries:1, repairTimeoutMs:45000, repairMaxRetries:1, subcallRetries:1 };
  function _p(priority, timeoutMs, repairTimeoutMs, maxRetries, subcallRetries) { return { priority:priority, timeoutMs:timeoutMs, maxRetries:maxRetries == null ? 1 : maxRetries, repairTimeoutMs:repairTimeoutMs || 45000, repairMaxRetries:1, subcallRetries:subcallRetries == null ? 1 : subcallRetries }; }
  var CALL_POLICIES = {
    // Phase 0 D-3·sc1 maxRetries 1→2·失败时多一次 repair·schema 简化留 Phase 2 (SC1 重构)
    // Phase 2.5·sc1q 对话承诺·temp=0.3 严格·timeout 短 (并行 sc0·8s 内完成)·失败 = 增量 missed·非 critical
    // Phase 4 A5·sc25c 双调用合一 (替 sc25 + sc_consolidate)·两 LLM call Promise.allSettled
    // Phase 4 A6·sc15n 3-tier 合一 (替 sc15 + sc07)·按 modelCap 决定 tier
    sc0:_p('normal',90000), sc1q:_p('normal',60000,30000,1,0), sc05:_p('normal',75000), sc1:_p('critical',150000,60000,2,0), sc1_rescue:_p('critical',60000,30000,0,0), sc1b:_p('high',90000), sc1c:_p('high',90000), sc1d:_p('high',90000,45000),
    sc15:_p('normal',90000), sc15n:_p('normal',90000), sc_memwrite:_p('low',45000,30000), sc16:_p('normal',90000), sc17:_p('normal',90000), sc18:_p('normal',90000),
    sc_audit:_p('normal',60000), sc19:_p('background',45000,30000), sc2:_p('normal',120000,60000), sc25:_p('high',75000), sc25c:_p('high',75000),
    sc27:_p('high',60000), sc07:_p('normal',90000), sc28:_p('low',45000,30000), sc_consolidate:_p('low',45000,30000),
    // Phase 5·sc2 三段管线·sc2_outline / sc27_review / sc2_prose
    sc2_outline:_p('normal',60000,30000), sc27_review:_p('high',60000,30000), sc2_prose:_p('high',90000,45000),
    compress_ai_memory:_p('low',45000,30000), compress_foreshadows:_p('low',45000,30000), compress_conversation:_p('low',45000,30000),
    history_check:_p('critical',45000,30000)
  };
  ns.getCallPolicy = function(id) {
    var policy = CALL_POLICIES[id] || {}, out = {};
    Object.keys(SAFE_CALL_DEFAULT).forEach(function(k) { out[k] = SAFE_CALL_DEFAULT[k]; });
    Object.keys(policy).forEach(function(k) { out[k] = policy[k]; });
    return out;
  };
  function _mergeCallPolicy(id, opts) {
    opts = opts || {};
    var policy = ns.getCallPolicy(id || opts.id || ''), out = {};
    Object.keys(opts).forEach(function(k) { out[k] = opts[k]; });
    ['priority', 'timeoutMs', 'maxRetries', 'repairTimeoutMs', 'repairMaxRetries', 'repairPriority'].forEach(function(k) { if (out[k] == null && policy[k] != null) out[k] = policy[k]; });
    if (out.repairPriority == null && policy.priority != null) out.repairPriority = policy.priority;
    out._callPolicy = policy;
    return out;
  }

})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));
