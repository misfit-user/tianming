/* tm-memory-agent-tools.js · S1 — 按需取数工具层（agent recall tools）
 *
 * 用途：把现有的记忆检索 API 包成「LLM 可调用的工具」，供后续 agent 化的
 *       按需取数使用（S2 才接入 SC_RECALL，本刀纯新增、不接任何调用点）。
 *
 * 契约：
 *   TM.MemoryAgentTools.defs            → 工具 schema 数组（喂给 callAIWithTools 的 tools 参数）
 *   TM.MemoryAgentTools.exec(name,input,GM)
 *        → Promise<{ ok:boolean, hits:Hit[], meta:object, error?:string }>
 *        Hit = { source, turn, text, importance?, char?, status?, sim? }
 *
 * 零侵入：只读 GM，只调用现有
 *   - TM.MemoryRetrieval.collectPriorityHits
 *   - SemanticRecall.searchSyncSafe
 *   - ChronicleTracker.getAll
 *   - NpcMemorySystem.recallMemory
 * 任一下层缺失 → 该源静默跳过、绝不抛错（与现网各源 try/catch 范式一致）。
 *
 * 跨朝代红线（项目铁律）：工具名 / 参数 / 枚举一律用朝代中立通用词，
 *   kind 枚举只用 person/place/office/institution/event/faction，
 *   description 举例不得出现「内阁 / 东厂 / 票拟 / 司礼监」等单朝专名。
 *
 * 环境：浏览器（挂 window.TM）与 node（挂 globalThis.TM，供自测）双兼容。
 */
(function (root) {
  'use strict';
  root.TM = root.TM || {};
  var NS = root.TM.MemoryAgentTools = root.TM.MemoryAgentTools || {};

  // ───────── 工具 schema（跨朝代中立）─────────
  var TOOL_DEFS = [
    {
      name: 'recall_by_term',
      description: '按关键词从永久记忆档（人物记忆 / 长期事势 / 史记 / 语义索引）检索相关历史条目。当推演中出现你不确定来龙去脉的制度、事件、地名、术语时调用，用以取回可信的历史依据。',
      parameters: {
        type: 'object',
        properties: {
          terms: { type: 'array', items: { type: 'string' }, description: '1-6 个检索关键词（如某项制度名、事件名、地名）' },
          limit: { type: 'integer', description: '返回条数上限，默认 8，最大 20' }
        },
        required: ['terms']
      }
    },
    {
      name: 'recall_by_entity',
      description: '按某个具体实体（人物 / 地点 / 官职 / 制度 / 事件 / 势力）检索其相关历史记忆与当前状态。当需要某个对象的来历、关系、过往承诺时调用。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '实体名称' },
          kind: {
            type: 'string',
            enum: ['person', 'place', 'office', 'institution', 'event', 'faction'],
            description: '实体范畴（朝代中立通用范畴，请勿填具体朝代专名）'
          },
          limit: { type: 'integer', description: '返回条数上限，默认 8，最大 20' }
        },
        required: ['name', 'kind']
      }
    },
    {
      name: 'recall_by_turn',
      description: '检索某段回合区间内发生过的重要事件（按重要度排序）。当需要回顾「最近若干年 / 某段时期发生了什么」时调用。',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'integer', description: '起始回合（含）' },
          to: { type: 'integer', description: '结束回合（含）' },
          minImportance: { type: 'integer', description: '最低重要度过滤，0-10，默认 0' },
          limit: { type: 'integer', description: '返回条数上限，默认 12，最大 30' }
        },
        required: ['from', 'to']
      }
    }
  ];

  TOOL_DEFS.push(
    { name: 'read_memory', description: '按已返回的记忆 ID 展开原文片段和来源；摘要不足以判断时调用，不要编造 ID。', parameters: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, maxItems: 6 } }, required: ['ids'] } },
    { name: 'recall_related', description: '沿已知记忆的因果、延续、解决、替代或矛盾关系追查关联证据，一次仅扩展一跳。', parameters: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, maxItems: 6 }, limit: { type: 'integer' } }, required: ['ids'] } }
  );
  // ───────── 下层句柄（缺失即降级）─────────
  function _mr() { return root.TM && root.TM.MemoryRetrieval; }
  function _sem() { return root.SemanticRecall; }
  function _chron() { return root.ChronicleTracker; }
  function _npc() { return root.NpcMemorySystem; }

  // ───────── helpers ─────────
  function _cleanTerms(terms) {
    if (typeof terms === 'string') terms = [terms];
    if (!Array.isArray(terms)) return [];
    return terms.map(function (k) { return String(k || '').trim().slice(0, 40); })
      .filter(Boolean).slice(0, 6);
  }

  function _clampLimit(v, def, max) {
    var n = Number(v);
    if (!isFinite(n) || n <= 0) return def;
    return Math.min(Math.floor(n), max);
  }

  function _keywordRe(terms) {
    var ks = (terms || []).map(function (k) { return String(k || '').trim(); }).filter(Boolean);
    if (!ks.length) return null;
    try {
      return new RegExp(ks.map(function (k) {
        return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('|'), 'i');
    } catch (_) { return null; }
  }

  // 归一化为统一 Hit 结构；无正文则丢弃
  function _normHit(h) {
    if (!h) return null;
    var text = String(h.safeBody != null ? h.safeBody : (h.text || h.event || h.summary || '')).trim();
    if (!text) return null;
    var out = Object.assign({}, h, {
      source: h.source || 'unknown',
      turn: Number(h.turn || 0) || 0,
      text: text.slice(0, 1600), safeBody: text.slice(0, 1600)
    });
    delete out.body; delete out.vec;
    if (h.importance != null && isFinite(Number(h.importance))) out.importance = Number(h.importance);
    var who = h.char || (Array.isArray(h.entities) && h.entities[0]) || '';
    if (who) out.char = who;
    if (h.status) out.status = h.status;
    if (h.sim != null) out.sim = h.sim;
    return out;
  }

  function _dedupe(hits) {
    var seen = {}, out = [];
    hits.forEach(function (h) {
      if (!h) return;
      var key = (h.source || '') + '|' + (h.turn || 0) + '|' + String(h.text || '').slice(0, 40);
      if (seen[key]) return;
      seen[key] = 1;
      out.push(h);
    });
    return out;
  }

  // kind 软优先：把该范畴更可信的源排前面（不删，仅排序）
  function _prioritizeByKind(hits, kind) {
    var table = {
      person: ['hard_state', 'npc', 'commitment'],
      faction: ['faction', 'hard_state'],
      office: ['activeEdict', 'imperialEdict', 'issue'],
      institution: ['activeEdict', 'imperialEdict', 'chronicle'],
      place: ['chronicle', 'shiji'],
      event: ['chronicle', 'shiji', 'eventHistory']
    };
    var pref = table[kind] || [];
    if (!pref.length) return hits;
    return hits.slice().sort(function (a, b) {
      var ai = pref.indexOf(a.source); if (ai < 0) ai = 99;
      var bi = pref.indexOf(b.source); if (bi < 0) bi = 99;
      return ai - bi;
    });
  }

  // 源：ChronicleTracker（关键词过滤）—— 复用 SC_RECALL 同款逻辑
  function _scanChronicle(terms) {
    var out = [], chron = _chron();
    if (!chron || typeof chron.getAll !== 'function') return out;
    var re = _keywordRe(terms);
    if (!re) return out;
    try {
      (chron.getAll({}) || []).forEach(function (c) {
        if (!c) return;
        var cdesc = c.description || c.narrative || c.summary || '';
        var hay = (c.title || '') + ' ' + cdesc + ' ' + (c.result || '');
        if (!re.test(hay)) return;
        out.push({
          source: 'chronicle',
          turn: c.startTurn || c.completedTurn || 0,
          text: (c.title || '') + (cdesc ? '·' + String(cdesc).slice(0, 80) : ''),
          status: c.status
        });
      });
    } catch (_) {}
    return out;
  }

  // shiji 条目正文：真实字段见 tm-endturn-render.js:1362（无 text/importance）
  function _shijiText(sh) {
    return sh.shilu || sh.shizhengji || sh.zhengwen || sh.turnSummary || sh.szjSummary || sh.szjTitle || '';
  }
  // 源：shijiHistory（关键词过滤，近 40 条；可选 turnRange）
  function _scanShiji(GM, terms, turnRange) {
    var out = [];
    if (!GM || !Array.isArray(GM.shijiHistory)) return out;
    var re = _keywordRe(terms);
    if (!re) return out;
    GM.shijiHistory.slice(-40).forEach(function (sh) {
      if (!sh) return;
      if (Array.isArray(turnRange) && turnRange.length === 2) {
        if (sh.turn < turnRange[0] || sh.turn > turnRange[1]) return;
      }
      var hay = (sh.shizhengji || '') + ' ' + (sh.zhengwen || '') + ' ' + (sh.shilu || '') + ' ' + (sh.turnSummary || '');
      if (!re.test(hay)) return;
      var body = _shijiText(sh);
      if (body) out.push({ source: 'shiji', turn: sh.turn || 0, text: body });
    });
    return out;
  }

  // ───────── 工具实现 ─────────
  function _recallByTerm(input, GM) {
    if (root.TM.MemoryHybrid) return root.TM.MemoryHybrid.search(GM, _cleanTerms(input.terms).join(' '), { limit: input.limit }).then(function(r) { return { ok: true, hits: r.hits.map(_normHit).filter(Boolean), meta: { tool: 'recall_by_term', hybrid: r.diagnostics } }; });
    var terms = _cleanTerms(input.terms);
    var limit = _clampLimit(input.limit, 8, 20);
    if (!GM || !terms.length) return Promise.resolve({ ok: true, hits: [], meta: { tool: 'recall_by_term', count: 0 } });

    var hits = [];
    var mr = _mr();
    if (mr && typeof mr.collectPriorityHits === 'function') {
      try {
        var ph = mr.collectPriorityHits(GM, { keywords: terms, purpose: 'agent_recall_term' }, { turn: GM.turn || 0 }) || [];
        hits = hits.concat(ph);
      } catch (_) {}
    }
    hits = hits.concat(_scanChronicle(terms)).concat(_scanShiji(GM, terms, null));

    var sem = _sem();
    var vecP = (sem && typeof sem.searchSyncSafe === 'function')
      ? Promise.resolve().then(function () { return sem.searchSyncSafe(terms.join(' '), { topK: limit }); }).catch(function () { return []; })
      : Promise.resolve([]);

    return vecP.then(function (vhits) {
      (vhits || []).forEach(function (h) { hits.push(h); });
      var norm = _dedupe(hits.map(_normHit).filter(Boolean)).slice(0, limit);
      return { ok: true, hits: norm, meta: { tool: 'recall_by_term', terms: terms, count: norm.length } };
    });
  }

  function _recallByEntity(input, GM) {
    if (root.TM.MemoryHybrid) return root.TM.MemoryHybrid.search(GM, String(input.name || '').slice(0, 80), { limit: input.limit }).then(function(r) { return { ok: true, hits: r.hits.map(_normHit).filter(Boolean), meta: { tool: 'recall_by_entity', hybrid: r.diagnostics } }; });
    var name = String(input.name || '').trim().slice(0, 40);
    var kind = String(input.kind || '').trim();
    var limit = _clampLimit(input.limit, 8, 20);
    if (!GM || !name) return Promise.resolve({ ok: true, hits: [], meta: { tool: 'recall_by_entity', count: 0 } });

    var hits = [];
    var mr = _mr();
    if (mr && typeof mr.collectPriorityHits === 'function') {
      try {
        var ph = mr.collectPriorityHits(GM, { keywords: [name], participant: name, purpose: 'agent_recall_entity' }, { turn: GM.turn || 0 }) || [];
        hits = hits.concat(ph);
      } catch (_) {}
    }
    var npc = _npc();
    if (npc && typeof npc.recallMemory === 'function') {
      try {
        var nh = npc.recallMemory({ keywords: [name], participant: name }, { limit: limit }) || [];
        nh.forEach(function (h) { hits.push({ source: 'npc', char: h.char, turn: h.turn, text: h.event, importance: h.importance }); });
      } catch (_) {}
    }
    hits = hits.concat(_scanChronicle([name])).concat(_scanShiji(GM, [name], null));

    var sem = _sem();
    var vecP = (sem && typeof sem.searchSyncSafe === 'function')
      ? Promise.resolve().then(function () { return sem.searchSyncSafe(name, { topK: limit }); }).catch(function () { return []; })
      : Promise.resolve([]);

    return vecP.then(function (vhits) {
      (vhits || []).forEach(function (h) { hits.push(h); });
      var norm = _prioritizeByKind(_dedupe(hits.map(_normHit).filter(Boolean)), kind).slice(0, limit);
      return { ok: true, hits: norm, meta: { tool: 'recall_by_entity', name: name, kind: kind, count: norm.length } };
    });
  }

  function _recallByTurn(input, GM) {
    if (root.TM.MemoryHybrid && GM) {
      var lo = Number.isFinite(Number(input.from)) ? Number(input.from) : 0, hi = Number.isFinite(Number(input.to)) ? Number(input.to) : Number(GM.turn);
      if (lo > hi) { var swap = lo; lo = hi; hi = swap; }
      var scoped = root.TM.MemoryHybrid.collect(GM).filter(function(h) { return h.turn >= lo && h.turn <= hi && Number(h.importance || 0) >= Number(input.minImportance || 0); }).slice(0, _clampLimit(input.limit, 12, 30));
      return Promise.resolve({ ok: true, hits: scoped.map(_normHit).filter(Boolean), meta: { tool: 'recall_by_turn' } });
    }
    var from = Number(input.from), to = Number(input.to);
    if (!isFinite(from)) from = 0;
    if (!isFinite(to)) to = (GM && GM.turn) || 0;
    if (from > to) { var t = from; from = to; to = t; }
    var minImp = input.minImportance != null ? Number(input.minImportance) : 0;
    if (!isFinite(minImp)) minImp = 0;
    var limit = _clampLimit(input.limit, 12, 30);
    if (!GM) return Promise.resolve({ ok: true, hits: [], meta: { tool: 'recall_by_turn', count: 0 } });

    var hits = [];
    // shiji：无 importance 维度（叙事正文）→ 仅在未要求 minImportance 时纳入
    if (Array.isArray(GM.shijiHistory) && minImp <= 0) {
      GM.shijiHistory.forEach(function (sh) {
        if (!sh) return;
        var tn = Number(sh.turn || 0);
        if (tn < from || tn > to) return;
        var body = _shijiText(sh);
        if (body) hits.push({ source: 'shiji', turn: tn, text: body });
      });
    }
    // eventHistory：sheet 列数组 ['编码','回合','事件描述','权重',...]（tm-memory-tables.js:147）
    var et = GM._memTables && GM._memTables.eventHistory;
    var erows = (et && Array.isArray(et.rows)) ? et.rows : [];
    erows.forEach(function (r) {
      if (!r) return;
      var tn, desc, imp;
      if (Array.isArray(r)) {              // 实证结构：列数组（全字符串）
        tn = Number(r[1] || 0);
        desc = String(r[2] || '');
        imp = Number(r[3] || 0) * 10;      // 权重 0-1 → 0-10
      } else if (typeof r === 'object') {  // 兜底：对象行
        tn = Number(r.turn || r.createdTurn || 0);
        desc = String(r.text || r.title || r.content || r['事件描述'] || '');
        imp = Number(r.importance != null ? r.importance : (r.weight != null ? r.weight * 10 : 0));
      } else { return; }
      if (tn < from || tn > to) return;
      if (imp < minImp) return;
      if (!desc) return;
      hits.push({ source: 'eventHistory', turn: tn, text: desc, importance: imp });
    });
    var chron = _chron();
    if (chron && typeof chron.getAll === 'function') {
      try {
        (chron.getAll({}) || []).forEach(function (c) {
          if (!c) return;
          var tn = Number(c.startTurn || c.completedTurn || 0);
          if (tn < from || tn > to) return;
          var cimp = Number(c.importance || 0);
          if (cimp < minImp) return;
          hits.push({ source: 'chronicle', turn: tn, text: (c.title || '') + (c.description ? '·' + String(c.description).slice(0, 80) : ''), status: c.status, importance: c.importance });
        });
      } catch (_) {}
    }

    var norm = _dedupe(hits.map(_normHit).filter(Boolean));
    norm.sort(function (a, b) { return (b.importance || 0) - (a.importance || 0) || (b.turn - a.turn); });
    norm = norm.slice(0, limit);
    return Promise.resolve({ ok: true, hits: norm, meta: { tool: 'recall_by_turn', from: from, to: to, minImportance: minImp, count: norm.length } });
  }

  // ───────── 分发入口 ─────────
  function exec(name, input, GM) {
    GM = GM || root.GM;
    input = input || {};
    try {
      switch (name) {
        case 'read_memory': return Promise.resolve({ ok: true, hits: root.TM.MemoryHybrid ? root.TM.MemoryHybrid.read(GM, input.ids).map(_normHit).filter(Boolean) : [], meta: { tool: name } });
        case 'recall_related': return Promise.resolve({ ok: true, hits: root.TM.MemoryHybrid ? root.TM.MemoryHybrid.related(GM, input.ids, input).map(_normHit).filter(Boolean) : [], meta: { tool: name } });
        case 'recall_by_term': return _recallByTerm(input, GM);
        case 'recall_by_entity': return _recallByEntity(input, GM);
        case 'recall_by_turn': return _recallByTurn(input, GM);
        default: return Promise.resolve({ ok: false, error: 'unknown tool: ' + name, hits: [], meta: { tool: String(name) } });
      }
    } catch (e) {
      return Promise.resolve({ ok: false, error: String((e && e.message) || e), hits: [], meta: { tool: String(name) } });
    }
  }

  // ── S2: agent 按需取数编排（单轮多工具·延迟友好·不做自主多轮）──
  function _buildRecallPrompt(ctx) {
    ctx = ctx || {};
    var lines = [];
    lines.push('你是历史推演的检索助手。下面是本回合局势分析要点与待查线索。');
    lines.push('请判断推演这一回合，你需要从永久记忆档查证哪些历史依据（某项制度的沿革、某个人物的过往、某段时期发生的事）。');
    lines.push('用提供的工具发起检索（可一次发起多个）；只查真正影响本回合判断的，不为查而查；若无需查证，可不调用任何工具。');
    if (Array.isArray(ctx.baseQueries) && ctx.baseQueries.length) {
      lines.push('');
      lines.push('【待查线索】');
      ctx.baseQueries.slice(0, 6).forEach(function (q) {
        var s = (typeof q === 'string') ? q : (q && (q.query || (Array.isArray(q.keywords) ? q.keywords.join('/') : '')));
        if (s) lines.push('- ' + String(s).slice(0, 100));
      });
    }
    var think = String(ctx.aiThinking || '').replace(/\s+/g, ' ').slice(0, 1500);
    if (think) { lines.push(''); lines.push('【局势分析摘要】'); lines.push(think); }
    return lines.join('\n');
  }

  // 单轮多工具：发一次 callAIWithTools，执行返回的全部工具调用（护栏 ≤4），
  // 组装成与固定检索同构的 results（{query, hits, _scoring}）供 _recallResults 复用。
  // 失败 / 无能力 / 无结果 → 返回空 results（上层据此落回固定检索）。
  async function _requestRecallPlan(plan, prompt, definitions, options) {
    if (plan.plannerMode !== 'json') return root.callAIWithTools(prompt, definitions, options);
    if (typeof root.callAIMessages !== 'function') throw new Error('json_recall_planner_unavailable');
    var raw = await root.callAIMessages([{ role: 'system', content: 'Choose evidence retrieval tools. Return only strict JSON {"calls":[{"name":"tool_name","input":{}}]}. Do not fabricate evidence or return more than six calls. Tool definitions: ' + JSON.stringify(definitions) }, { role: 'user', content: prompt }], options.maxTok, options.signal || null, options.tier, options);
    var parsed = root.TM.MemoryAdaptive.strictJSON(raw);
    if (!parsed || !Array.isArray(parsed.calls)) throw new Error('invalid_json_recall_plan');
    return { toolCalls: parsed.calls.slice(0, 6), protocol: 'json' };
  }
  async function runAdaptiveRecall(GM, ctx) {
    var adaptive = root.TM.MemoryAdaptive, hybrid = root.TM.MemoryHybrid, P = root.P || {};
    var tier = P.ai && P.ai.secondary && P.ai.secondary.key ? 'secondary' : 'primary';
    var plan = adaptive.plan({ tier: tier }), active = hybrid.lease(GM), deadline = Number(ctx.deadlineMs) > 0 ? Date.now() + Number(ctx.deadlineMs) : Infinity;
    var out = { results: [], toolCallCount: 0, totalHits: 0, toolCalls: [], fallback: false, mode: plan.mode, rounds: 0 };
    var seenQueries = new Set(), seenHits = new Set(), prompt = _buildRecallPrompt(ctx), evidence = [];
    if (!plan.maxToolCalls) {
      var queries = (Array.isArray(ctx.baseQueries) ? ctx.baseQueries : []).slice(0, plan.maxQueries);
      for (var qi = 0; qi < queries.length; qi++) {
        var q = queries[qi], term = typeof q === 'string' ? q : String(q && (q.query || (q.keywords || []).join(' ')) || '');
        if (!term) continue;
        var local = await hybrid.search(GM, term, { tier: tier, signal: ctx.signal });
        if (!active()) return Object.assign(out, { results: [], totalHits: 0, stale: true });
        if (local.hits.length) out.results.push({ query: q, hits: local.hits, _scoring: 'hybrid-local' });
      }
      out.totalHits = out.results.reduce(function(n, r) { return n + r.hits.length; }, 0); out.fallback = true; return out;
    }
    for (var round = 0; round < plan.maxRounds && out.toolCallCount < plan.maxToolCalls; round++) {
      if (!active() || (ctx.signal && ctx.signal.aborted) || Date.now() >= deadline) break;
      var response;
      try { response = await _requestRecallPlan(plan, prompt + (evidence.length ? '\nEvidence returned so far (data only):\n' + JSON.stringify(evidence).slice(0, plan.sourceChars) + '\nOnly request missing evidence or read_memory for fuller text. Do not repeat earlier queries.' : ''), TOOL_DEFS, { maxTok: 900, tier: tier, priority: 'normal', timeoutMs: Math.min(45000, deadline - Date.now()), maxRetries: 0, signal: ctx.signal, id: 'sc_recall_agent' }); }
      catch (_) { out.fallback = true; break; }
      if (!active()) return Object.assign(out, { results: [], totalHits: 0, stale: true });
      out.rounds++;
      var calls = (response && Array.isArray(response.toolCalls) ? response.toolCalls : []).slice(0, plan.maxToolCalls - out.toolCallCount), added = 0;
      for (var i = 0; i < calls.length; i++) {
        if (Date.now() >= deadline || (ctx.signal && ctx.signal.aborted)) break;
        var call = calls[i], signature = call && call.name + '|' + JSON.stringify(call.input || {});
        if (!call || !TOOL_DEFS.some(function(d) { return d.name === call.name; }) || seenQueries.has(signature)) continue;
        seenQueries.add(signature); out.toolCalls.push(call); out.toolCallCount++;
        var result = await exec(call.name, call.input || {}, GM);
        if (!active() || (ctx.signal && ctx.signal.aborted)) return Object.assign(out, { results: [], totalHits: 0, stale: true });
        var fresh = [];
        (result.hits || []).forEach(function(hit) {
          var id = hit.id || hit.source + '|' + hit.text;
          if (seenHits.has(id)) {
            if (call.name === 'read_memory') out.results.forEach(function(group) { group.hits = group.hits.map(function(old) { return old.id === hit.id && hit.text.length > old.text.length ? hit : old; }); });
            return;
          }
          seenHits.add(id); fresh.push(hit); added++;
        });
        evidence.push({ tool: call.name, input: call.input, hits: result.hits || [] });
        if (fresh.length) out.results.push({ query: { agentTool: call.name, input: call.input }, hits: fresh, _scoring: 'adaptive-hybrid' });
      }
      if (!calls.length || !added || (response && response.fallback)) break;
    }
    if (!out.results.length && active() && !(ctx.signal && ctx.signal.aborted)) {
      var q0 = ctx.baseQueries && ctx.baseQueries[0];
      var term0 = typeof q0 === 'string' ? q0 : q0 && (q0.query || (q0.keywords || []).join(' '));
      if (term0) { var fallback = await hybrid.search(GM, term0, { tier: tier, signal: ctx.signal }); if (active() && fallback.hits.length) out.results.push({ query: q0, hits: fallback.hits, _scoring: 'hybrid-fallback' }); }
      out.fallback = true;
    }
    out.totalHits = out.results.reduce(function(n, r) { return n + r.hits.length; }, 0);
    return out;
  }

  async function runRecall(GM, ctx) {
    ctx = ctx || {};
    GM = GM || root.GM;
    if (GM && root.TM.MemoryAdaptive && root.TM.MemoryHybrid) return runAdaptiveRecall(GM, ctx);
    var out = { results: [], toolCallCount: 0, totalHits: 0, toolCalls: [], fallback: false };
    if (!GM) return out;
    var cawt = root.callAIWithTools;
    if (typeof cawt !== 'function') return out;
    var P = root.P || {};
    var maxTok = (P.conf && P.conf.agentRecallMaxTok) || 800;
    var resp;
    try {
      resp = await cawt(_buildRecallPrompt(ctx), TOOL_DEFS, {
        maxTok: maxTok, tier: 'secondary', priority: 'normal',
        timeoutMs: 45000, maxRetries: 1, id: 'sc_recall_agent'
      });
    } catch (e) { return out; }
    if (!resp) return out;
    out.fallback = !!resp.fallback;
    var calls = (Array.isArray(resp.toolCalls) ? resp.toolCalls : []).slice(0, 4); // 护栏：≤4 工具调用
    out.toolCalls = calls;
    out.toolCallCount = calls.length;
    for (var i = 0; i < calls.length; i++) {
      var c = calls[i] || {};
      if (!c.name) continue;
      var r;
      try { r = await exec(c.name, c.input || {}, GM); } catch (_e) { continue; }
      if (r && r.ok && Array.isArray(r.hits) && r.hits.length) {
        out.results.push({ query: { agentTool: c.name, input: c.input || {} }, hits: r.hits.slice(0, 12), _scoring: 'agent' });
        out.totalHits += Math.min(r.hits.length, 12);
      }
    }
    return out;
  }

  NS.defs = TOOL_DEFS;
  NS.exec = exec;
  NS.runRecall = runRecall;
  NS.version = '0.2.0-s2';
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
