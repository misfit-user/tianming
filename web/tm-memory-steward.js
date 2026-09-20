// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-memory-steward.js — 记忆管家 agent（S1·核心模块·未接线）
//
// 目的：用「本地预扫工作清单 + 单次结构化固化调用」替代 6 个写死的记忆压缩 pass 中的 5 个：
//   compress_ai_memory / compress_foreshadows / compress_conversation（followup.js·阈值触发）
//   _scL2AIGenerate（每5回合）/ _scL3Condense（每30回合）（post-turn-jobs.js）
//   —— 不并入 _scReflect（元认知·非压缩·单列）；不动 _updateFactionArcs（纯确定性·无 LLM）。
//
// 为何 agent 化（守 [[tianming-top-level-vision]] 命门 + agent 化有界铁律）：
//   · 现状 5 个 pass 各自独立触发·互不知情·会各压一遍同源记忆（跨层重复）·且 compress×3 丢 provenance。
//   · 本模块本地预扫（确定性零 LLM）算出"本回合该压哪些"→ 一次 LLM 同时看全所有层 → 跨层去重 → 一次返回所有摘要。
//   · 重负载回合 5 次压缩调用 → 1 次。且每条摘要统一过 MemorySourceBound 带 provenance（补齐 compress×3 缺口·记忆可溯源=AI 可信地基）。
//   · 后台运行（玩家不等）·单跳不自主循环（不做多轮 tool-call agent·守延迟/确定性墙）。
//
// 跨朝代中立（守 [[tianming-engine-cross-dynasty]]）：层名/动作（aiMemory/foreshadows/conv/L2/L3·compress/rollup）皆通用词·无朝代专名。
//
// 依赖外部（均 window 全局·缺失静默降级）：GM / P / callAIMessages / extractJSON /
//   getCompressionParams(tm-utils.js) / TM.MemorySourceBound.buildSummaryMetadata / memoryEntryText / DebugLog
//
// 接线（S2·尚未做）：followup.js 压缩段 + post-turn-jobs L2/L3 在 P.ai.memoryStewardEnabled 开时跳过·改调 TM.MemorySteward.run(GM)。默认关=零回归。
// ============================================================

(function (global) {
  var TM = global.TM = global.TM || {};
  if (TM.MemorySteward) return; // 防重复加载

  // S4 鲁棒性：steward 是单次"全有全无"调用(失败则本回合不压缩)·连失 FAIL_THRESHOLD 回合→自动回落旧 5 pass·达阈后每 RETRY_EVERY 回合重试一次(防一次抖动永久禁用)。
  var FAIL_THRESHOLD = 2, RETRY_EVERY = 5;

  function _dbg() {
    try {
      if (global.DebugLog && typeof global.DebugLog.log === 'function') {
        var a = ['ai'].concat(Array.prototype.slice.call(arguments));
        global.DebugLog.log.apply(global.DebugLog, a);
      }
    } catch (e) {}
  }

  function _memText(entry) {
    try {
      if (typeof global.memoryEntryText === 'function') return global.memoryEntryText(entry);
    } catch (e) {}
    return String((entry && (entry.content || entry.text || entry.summary)) || '');
  }

  // 复用现有压缩参数（基于实际上下文窗口动态探测·缺失给保守默认）
  function _params() {
    try {
      if (typeof global.getCompressionParams === 'function') {
        var cp = global.getCompressionParams();
        if (cp && typeof cp === 'object') return cp;
      }
    } catch (e) {}
    return {
      memCompressThreshold: 40, foreCompressThreshold: 30, convCompressThreshold: 40,
      memKeepRecent: 20, foreKeepRecent: 15, summaryLen: 600, foreSummaryLen: 400,
      contextK: 32, scale: 1
    };
  }

  // 统一 provenance 包装（补齐 compress×3 缺口·与 L2/L3 同源）。缺 MemorySourceBound 则返回 {} 静默降级。
  function _provenance(GM, type, turn, turnRange, text, sourceItems, maxBasisRefs) {
    try {
      if (TM.MemorySourceBound && typeof TM.MemorySourceBound.buildSummaryMetadata === 'function') {
        var meta = TM.MemorySourceBound.buildSummaryMetadata(GM, {
          type: type, turn: turn, turnRange: turnRange, text: text || '',
          sourceItems: sourceItems || [], maxBasisRefs: maxBasisRefs || 24
        });
        return meta || {};
      }
    } catch (e) { _dbg('[MemorySteward] provenance fail:', e && e.message); }
    return {};
  }

  function _attachMeta(record, meta) {
    if (!meta) return record;
    ['id', 'sourceRefs', 'basisRefs', 'evidenceRefs', 'contentHash',
     'authorityLevel', 'authorityRank', 'basisMaxAuthorityRank', 'factStatus', 'lane'
    ].forEach(function (k) { if (meta[k] !== undefined) record[k] = meta[k]; });
    return record;
  }

  // ── 可观测（S3）：活通道=GM._memoryStewardLog(存档带走·控制台可查) + 控制台 _dbg；recordMemoryDiagnostic 当前休眠(全局未定义)·守卫调用为未来面板预留 ──
  function _diag(type, data) {
    try { if (typeof global.recordMemoryDiagnostic === 'function') global.recordMemoryDiagnostic(type, data); } catch (e) {}
  }
  function _snap(GM) {
    try { if (typeof global.buildMemoryDiagnosticSnapshot === 'function') return global.buildMemoryDiagnosticSnapshot(GM); } catch (e) {}
    return null;
  }
  function _logRun(GM, entry) {
    try {
      if (!GM._memoryStewardLog) GM._memoryStewardLog = [];
      GM._memoryStewardLog.push(entry);
      if (GM._memoryStewardLog.length > 20) GM._memoryStewardLog = GM._memoryStewardLog.slice(-20);
    } catch (e) {}
  }
  function _now() { return (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0; }

  // ── ① 本地预扫（确定性·零 LLM）→ 工作清单 ──
  // 触发条件逐一复用现有 5 pass 的原触发（阈值来自 getCompressionParams·L2/L3 用每5/30回合 cadence）·
  // 统一成一张清单·让单次调用跨层去重。
  function _stewardProfile(opts) {
    return TM.MemoryAdaptive ? TM.MemoryAdaptive.plan({ tier: opts && opts.tier || 'primary' }) : { consolidationTasks: 5, consolidationOutput: 8000, sourceChars: 60000, mode: 'legacy' };
  }
  function _sourceStamp(value) { try { return JSON.stringify(value); } catch (_) { return ''; } }
  function _prepareWork(GM, work, opts) {
    var profile = _stewardProfile(opts), remaining = profile.sourceChars, selected = [];
    work.tasks.slice(0, profile.consolidationTasks).forEach(function(task) {
      if (task.old) {
        var chosen = [], spent = 0;
        for (var i = 0; i < task.old.length; i++) {
          var cost = _sourceStamp(task.old[i]).length + 100;
          if (spent + cost > remaining) break;
          chosen.push(task.old[i]); spent += cost;
        }
        if (!chosen.length) return;
        task.old = chosen; task.keepFrom = chosen.length;
        task._sourceStamp = _sourceStamp(chosen); remaining -= spent;
      } else {
        var payload = [task.mems || [], task.shiji || [], task.l2s || []], length = _sourceStamp(payload).length;
        if (length > remaining) return;
        task._sourceStamp = _sourceStamp(payload); remaining -= length;
      }
      selected.push(task);
    });
    work.tasks = selected; work.profile = profile;
    return work;
  }
  function _workCurrent(GM, work) {
    if (!GM || !work || Number(work.turn) !== Number(GM.turn)) return false;
    return (work.tasks || []).every(function(task) {
      if (!task._sourceStamp) return true;
      if (task.old) {
        var source = task.layer === 'aiMemory' ? GM._aiMemory : task.layer === 'foreshadows' ? GM._foreshadows : GM.conv;
        return _sourceStamp((source || []).slice(0, task.old.length)) === task._sourceStamp;
      }
      return _sourceStamp([task.mems || [], task.shiji || [], task.l2s || []]) === task._sourceStamp;
    });
  }
  function _validConsolidation(work, parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    function validText(value) {
      if (typeof value !== 'string' || !value.trim() || value.length > 12000) return false;
      if (TM.MemoryWriteGate && TM.MemoryWriteGate.evaluateCandidate) {
        var check = TM.MemoryWriteGate.evaluateCandidate({ type: 'summary', authority: 'ai_summary', body: value, sourceRefs: [{ type: 'consolidation', id: 'validation-only' }] });
        if (check.status === 'quarantined') return false;
      }
      return true;
    }
    return (work.tasks || []).every(function(task) {
      if (task.layer === 'aiMemory') return validText(parsed.aiMemory_summary) && (!parsed.aiMemory_threads || validText(parsed.aiMemory_threads));
      if (task.layer === 'foreshadows') return validText(parsed.foreshadows_active) && (!parsed.foreshadows_resolved || validText(parsed.foreshadows_resolved));
      if (task.layer === 'conv') return validText(parsed.conv_summary);
      var layer = parsed[task.layer];
      return !!(layer && typeof layer === 'object' && !Array.isArray(layer) && validText(task.layer === 'L2' ? layer.summary : layer.theme));
    });
  }
  var _stewardFlights = new WeakMap();
  function _stewardLease(GM, tier) {
    var p = global.P, world = global.GM, turn = GM.turn, generation = global._tmLoadGen;
    var campaign = GM._campaignId, timeline = GM._timelineId;
    var identity = TM.MemoryAdaptive ? TM.MemoryAdaptive.identity(tier) : '';
    return function() { return global.P === p && (!world || global.GM === world) && GM.turn === turn && global._tmLoadGen === generation && GM._campaignId === campaign && GM._timelineId === timeline && (!TM.MemoryAdaptive || TM.MemoryAdaptive.identity(tier) === identity); };
  }
  function run(GM, opts) {
    GM = GM || global.GM; opts = opts || {};
    if (!GM) return Promise.resolve({ skipped: 'noGM' });
    var current = _stewardLease(GM, opts.tier || 'primary'), old = _stewardFlights.get(GM);
    if (old && old.current()) return old.promise;
    var job = { current: current, promise: null };
    job.promise = Promise.resolve().then(function() { return runInner(GM, Object.assign({}, opts, { leaseCurrent: current })); }).finally(function() { if (_stewardFlights.get(GM) === job) _stewardFlights.delete(GM); });
    _stewardFlights.set(GM, job);
    return job.promise;
  }

  function scan(GM, opts) {
    opts = opts || {};
    GM = GM || global.GM;
    var out = { turn: 0, tasks: [] };
    if (!GM) return out;
    var turn = GM.turn || 0;
    out.turn = turn;
    var cp = _params();

    // compress aiMemory（followup.js:3073 同条件）
    var aiMem = GM._aiMemory || [];
    if (aiMem.length > cp.memCompressThreshold) {
      var keepM = cp.memKeepRecent;
      out.tasks.push({
        layer: 'aiMemory', action: 'compress',
        old: aiMem.slice(0, aiMem.length - keepM), keepRecent: keepM, targetLen: cp.summaryLen
      });
    }
    // compress foreshadows（followup.js:3111 同条件）
    var fore = GM._foreshadows || [];
    if (fore.length > cp.foreCompressThreshold) {
      var keepF = cp.foreKeepRecent;
      out.tasks.push({
        layer: 'foreshadows', action: 'compress',
        old: fore.slice(0, fore.length - keepF), keepRecent: keepF, targetLen: cp.foreSummaryLen
      });
    }
    // compress conversation（followup.js:3147 同条件·双阈值）
    var conv = GM.conv || [];
    var P = global.P || {};
    var maxConv = (P.conf && P.conf.convKeep) || (((P.ai && P.ai.mem) || 20) * 2);
    if (conv.length > cp.convCompressThreshold && conv.length > maxConv * 0.7) {
      var half = Math.floor(conv.length / 2);
      out.tasks.push({ layer: 'conv', action: 'compress', old: conv.slice(0, half), keepFrom: half });
    }
    // L2 rollup（post-turn-jobs.js:71 每5回合·防重）
    if (turn > 0 && turn % 5 === 0) {
      var bStart = turn - 4;
      var ml = GM._memoryLayers || {};
      var doneL2 = (ml.L2 || []).some(function (x) { return x && x.turnBucket === turn && x.aiGenerated; });
      if (!doneL2) {
        var bMem = aiMem.filter(function (m) { return m && m.turn >= bStart && m.turn <= turn; });
        var bShiji = (GM.shijiHistory || []).filter(function (s) { return s && s.turn >= bStart && s.turn <= turn; });
        if (bMem.length || bShiji.length) {
          out.tasks.push({ layer: 'L2', action: 'rollup', range: bStart + '-' + turn, turnBucket: turn, mems: bMem, shiji: bShiji });
        }
      }
    }
    // L3 rollup（post-turn-jobs.js:170 每30回合·从 L2 升）
    if (turn > 0 && turn % 30 === 0) {
      var l3Start = turn - 29;
      var ml3 = GM._memoryLayers || {};
      var doneL3 = (ml3.L3 || []).some(function (x) { return x && x.turnBucket === turn && x.aiGenerated; });
      if (!doneL3) {
        var bL2 = (ml3.L2 || []).filter(function (x) { return x && x.turnBucket >= l3Start && x.turnBucket <= turn; });
        if (bL2.length) out.tasks.push({ layer: 'L3', action: 'rollup', range: l3Start + '-' + turn, turnBucket: turn, l2s: bL2 });
      }
    }
    return out;
  }

  // ── ② 构建单次结构化固化请求（只含清单内任务·让模型一次看全→跨层去重）──
  function buildConsolidationRequest(workList, GM) {
    var tasks = (workList && workList.tasks) || [];
    var turn = (workList && workList.turn) || (GM && GM.turn) || 0;
    var sys = '你是史官·记忆管家。一次性把下列各"记忆层"分别压缩为高密度摘要·保留关键因果链/人物动态/势力消长/伏笔线索·丢弃重复与琐碎。'
      + '【跨层去重铁律】你同时看到多个层·同一事件若在多层出现·只在最合适的层详写·其余层一笔带过·不要逐层重复堆砌。仅返回 JSON。';
    var u = '【回合】T' + turn + '·需固化的记忆层如下·按各层要求分别压缩：\n\n';
    var schema = {};

    tasks.forEach(function (t) {
      if (t.layer === 'aiMemory') {
        u += '<layer name="aiMemory" 说明="AI 远期背景记忆·共' + t.old.length + '条待压">\n';
        t.old.forEach(function (m) { u += 'T' + (m.turn || '?') + ': ' + _memText(m).slice(0, 200) + '\n'; });
        u += '</layer>\n\n';
        schema.aiMemory_summary = '将 aiMemory 全部压为一段连贯高密度摘要(' + t.targetLen + '字·保留所有关键因果链与人物动态)';
        schema.aiMemory_threads = '仍在发展中的关键线索(200字)';
      } else if (t.layer === 'foreshadows') {
        u += '<layer name="foreshadows" 说明="伏笔/暗线·共' + t.old.length + '条待整理">\n';
        t.old.forEach(function (f) { u += 'T' + (f.turn || '?') + ': ' + _memText(f).slice(0, 200) + '\n'; });
        u += '</layer>\n\n';
        schema.foreshadows_active = '仍活跃的伏笔汇总(' + t.targetLen + '字)';
        schema.foreshadows_resolved = '已回收(实现/失效)的伏笔简述(100字)';
      } else if (t.layer === 'conv') {
        u += '<layer name="conv" 说明="早期玩家-AI 对话·共' + t.old.length + '条待压">\n';
        t.old.forEach(function (c) { u += '[' + (c.role || '?') + '] ' + String(c.content || '').slice(0, 150) + '\n'; });
        u += '</layer>\n\n';
        schema.conv_summary = '对话历史压缩摘要(300-500字·保留玩家关键决策/AI 重要建议/双方共识/未解议题)';
      } else if (t.layer === 'L2') {
        u += '<layer name="L2" 说明="近5回合情景 rollup·T' + t.range + '">\n';
        (t.shiji || []).forEach(function (s) { u += '<时政 T' + s.turn + '>' + String(s.shizhengji || s.shilu_text || '').slice(0, 400) + '\n'; });
        (t.mems || []).forEach(function (m) { u += '<记忆 T' + m.turn + '>' + _memText(m).slice(0, 150) + '\n'; });
        u += '</layer>\n\n';
        schema.L2 = { summary: '情景摘要(200-300字·主要事件+人物关系演变+情绪氛围)', mood: '整体情感基调(30字)', keyCharacters: '[{name,role}]', themes: '[主题…]', turning_points: '[关键转折(30字)…]' };
      } else if (t.layer === 'L3') {
        u += '<layer name="L3" 说明="近30回合年代纲要·从 L2 升·T' + t.range + '">\n';
        (t.l2s || []).forEach(function (x) { u += '<情景 ' + x.turnRange + ' 基调=' + (x.mood || '') + '>' + String(x.summary || '').slice(0, 400) + '\n'; });
        u += '</layer>\n\n';
        schema.L3 = { theme: '年代核心主题(40字)', atmosphere: '年代总体氛围(30字)', highlights: '[高光时刻(T?·30字)×5]', mainThreads: '贯穿主线(80字)', causalSummary: '主要事件因果链(100字)', keyCharacters: '[{name,role,emotional_arc}]' };
      }
    });

    u += '【输出 JSON·只含上面出现的层对应的键】\n' + JSON.stringify(schema, null, 1);
    return { system: sys, user: u, expectedKeys: Object.keys(schema) };
  }

  // ── ③ 写回（每条摘要统一带 provenance·镜像各 pass 原 writeback 形状·行为等价 + 补溯源）──
  function applyConsolidation(GM, workList, parsed) {
    GM = GM || global.GM;
    if (!GM || !parsed) return { applied: [], deltas: [] };
    if (!_validConsolidation(workList, parsed)) return { applied: [], deltas: [], failed: true, reason: 'invalid_consolidation' };
    if (workList && workList.turn != null && !_workCurrent(GM, workList)) return { applied: [], deltas: [], failed: true, reason: 'source_changed' };
    if (TM.MemoryLongTerm && TM.MemoryLongTerm.harvest) TM.MemoryLongTerm.harvest(GM);
    var turn = GM.turn || 0;
    var applied = [];
    var _sz = function (layer) {
      if (layer === 'aiMemory') return (GM._aiMemory || []).length;
      if (layer === 'foreshadows') return (GM._foreshadows || []).length;
      if (layer === 'conv') return (GM.conv || []).length;
      if (layer === 'L2') return ((GM._memoryLayers && GM._memoryLayers.L2) || []).length;
      if (layer === 'L3') return ((GM._memoryLayers && GM._memoryLayers.L3) || []).length;
      return 0;
    };
    var before = { aiMemory: _sz('aiMemory'), foreshadows: _sz('foreshadows'), conv: _sz('conv'), L2: _sz('L2'), L3: _sz('L3') };
    (workList.tasks || []).forEach(function (t) {
      try {
        if (t.layer === 'aiMemory' && parsed.aiMemory_summary) {
          var keepMem = (GM._aiMemory || []).slice(t.old.length);
          var lastOldTurn = (t.old[t.old.length - 1] || {}).turn || '?';
          var content = '【历史记忆压缩摘要·T1-T' + lastOldTurn + '】' + parsed.aiMemory_summary + (parsed.aiMemory_threads ? '\n【活跃线索】' + parsed.aiMemory_threads : '');
          var rec = { turn: turn, content: content, type: 'compressed', priority: 'critical' };
          _attachMeta(rec, _provenance(GM, 'memoryCompress.aiMemory', turn, 'T1-T' + lastOldTurn, content, t.old, 24));
          GM._aiMemory = [rec].concat(keepMem);
          applied.push('aiMemory');
        } else if (t.layer === 'foreshadows' && parsed.foreshadows_active) {
          var keepFore = (GM._foreshadows || []).slice(t.old.length);
          var fcontent = '【伏笔压缩摘要】' + parsed.foreshadows_active + (parsed.foreshadows_resolved ? '\n【已回收】' + parsed.foreshadows_resolved : '');
          var frec = { turn: turn, content: fcontent, type: 'compressed', priority: 'high' };
          _attachMeta(frec, _provenance(GM, 'memoryCompress.foreshadows', turn, 'T' + turn, fcontent, t.old, 24));
          GM._foreshadows = [frec].concat(keepFore);
          applied.push('foreshadows');
        } else if (t.layer === 'conv' && parsed.conv_summary) {
          if (!GM._convArchive) GM._convArchive = [];
          Array.prototype.push.apply(GM._convArchive, t.old.map(function (c) {
            return { role: c.role, content: c.content, _turn: turn, _compressedBy: 'steward' };
          }));
          var keepConv = (GM.conv || []).slice(t.keepFrom);
          GM.conv = [{ role: 'system', content: '【早期对话压缩摘要】' + parsed.conv_summary }].concat(keepConv);
          applied.push('conv');
        } else if (t.layer === 'L2' && parsed.L2 && parsed.L2.summary) {
          if (!GM._memoryLayers) GM._memoryLayers = { L1: [], L2: [], L3: [] };
          GM._memoryLayers.L2 = (GM._memoryLayers.L2 || []).filter(function (x) { return x.turnBucket !== t.turnBucket || !x.aiGenerated; });
          var l2 = {
            turnBucket: t.turnBucket, turnRange: t.range, summary: parsed.L2.summary,
            mood: parsed.L2.mood || '', keyCharacters: parsed.L2.keyCharacters || [],
            themes: parsed.L2.themes || [], turning_points: parsed.L2.turning_points || [],
            aiGenerated: true, createdAt: turn
          };
          _attachMeta(l2, _provenance(GM, 'memoryLayerL2', t.turnBucket, t.range, parsed.L2.summary, (t.shiji || []).concat(t.mems || []), 24));
          GM._memoryLayers.L2.push(l2);
          if (GM._memoryLayers.L2.length > 12) GM._memoryLayers.L2 = GM._memoryLayers.L2.slice(-12);
          applied.push('L2');
        } else if (t.layer === 'L3' && parsed.L3 && parsed.L3.theme) {
          if (!GM._memoryLayers) GM._memoryLayers = { L1: [], L2: [], L3: [] };
          GM._memoryLayers.L3 = (GM._memoryLayers.L3 || []).filter(function (x) { return x.turnBucket !== t.turnBucket || !x.aiGenerated; });
          var txt = [parsed.L3.theme, parsed.L3.atmosphere, parsed.L3.mainThreads, parsed.L3.causalSummary].filter(Boolean).join(' ');
          var l3 = {
            turnBucket: t.turnBucket, turnRange: t.range, theme: parsed.L3.theme,
            atmosphere: parsed.L3.atmosphere || '', highlights: parsed.L3.highlights || [],
            mainThreads: parsed.L3.mainThreads || '', causalSummary: parsed.L3.causalSummary || '',
            keyCharacters: parsed.L3.keyCharacters || [], summary: parsed.L3.theme + '·' + (parsed.L3.atmosphere || ''),
            aiGenerated: true, createdAt: turn
          };
          _attachMeta(l3, _provenance(GM, 'memoryLayerL3', t.turnBucket, t.range, txt, t.l2s, 30));
          GM._memoryLayers.L3.push(l3);
          applied.push('L3');
        }
      } catch (e) { _dbg('[MemorySteward] apply ' + t.layer + ' fail:', e && e.message); }
    });
    var deltas = applied.map(function (layer) { return { layer: layer, before: before[layer], after: _sz(layer) }; });
    return { applied: applied, deltas: deltas };
  }

  // ── ④·表长字段压缩消费者（消费 MemTables 的 _compressQueue·补齐"有生产者无消费者"缺口）──
  // 背景：tm-memory-tables.js insertRow 对超 maxLen 的字段只 push {row,col,len} 进
  //   GM._memTables[sheet]._meta._compressQueue + 发"待 AI 压缩"提示·全库无消费者读它→长档字段无限膨胀。
  // 本消费者：确定性·零 LLM·把超长字段结构化截断到限内·全文留 provenance 存证（source-link·可 drill-down
  //   回原证据·守项目原则"摘要不得替代证据"）·压后清空队列（收敛核心）。LLM 语义摘要为后续增强（见集成清单）。
  // 跨朝代中立：只用表 key/列名/maxLen（皆剧本 schema 通用词）·零朝代专名。
  // 写口纪律：经 GM._memTables[key] 取局部引用 sheet 后变异（不新开 GM 子树别名·_memTables 写主仍是
  //   tm-memory-tables.js）。长期正解=在 MemTables 增 compressCell mutator 走正账·见集成清单。
  var _META_KEYS = { _sentinelLog: 1, _editorLocks: 1, _pendingDeletes: 1, _toastBudget: 1 };

  // 确定性结构化截断 + source-link 溯源标记。保证返回长度 <= maxLen（预算=maxLen−标记长；极端小 maxLen 兜底硬截）。
  function _compressFieldValue(original, maxLen, provId) {
    var s = String(original == null ? '' : original);
    if (!(maxLen > 0)) return '';
    var marker = '…〔压缩·溯源#' + provId + '〕';
    if (marker.length >= maxLen) return ('…#' + provId).slice(0, maxLen); // maxLen 太小·标记放不下→退化最小 id 标记
    var head = s.slice(0, maxLen - marker.length);
    var out = head + marker;
    return (out.length > maxLen) ? out.slice(0, maxLen) : out;
  }

  // 消费单表队列·返回本表统计（sheet 为 GM._memTables[key] 局部引用·变异不建 GM 子树别名）
  function _consumeSheetQueue(GM, key, def) {
    var sheet = GM._memTables[key];
    if (!sheet || !sheet._meta) return null;
    var q = sheet._meta._compressQueue;
    if (!Array.isArray(q) || !q.length) return null;
    var turn = (GM && GM.turn) || 0;
    if (!Array.isArray(sheet._meta._compressProvenance)) sheet._meta._compressProvenance = [];
    var prov = sheet._meta._compressProvenance;
    var stat = { sheet: key, queued: q.length, compressed: 0, skipped: 0, deltas: [] };

    q.forEach(function (item) {
      try {
        if (!item || typeof item.row !== 'number' || typeof item.col !== 'number') { stat.skipped++; return; }
        var colName = def.columns[item.col];
        var maxLen = (def.maxLen && colName) ? def.maxLen[colName] : 0;
        if (!maxLen) { stat.skipped++; return; }                                          // 该列无长度上限·丢弃
        var row = sheet.rows[item.row];
        if (!row) { stat.skipped++; return; }                                             // 行已越界/被删·丢弃
        var val = row[item.col];
        if (val == null || String(val).length <= maxLen) { stat.skipped++; return; }      // 已在限内(幂等)·丢弃
        var original = String(val);
        var provId = key + '#r' + item.row + 'c' + item.col + 't' + turn;
        var compressed = _compressFieldValue(original, maxLen, provId);
        // provenance 存证：全文留档·可 drill-down 回原证据（摘要不得替代证据）
        var rec = {
          id: provId, sheet: key, row: item.row, col: item.col, column: colName,
          turn: turn, origLen: original.length, compressedLen: compressed.length,
          maxLen: maxLen, original: original, method: 'deterministic-truncate',
          llmSummaryPending: true, ts: _now()
        };
        // 有 MemorySourceBound 时挂 source-bound 元数据（与 L2/L3 同源·source-linked）·缺失静默降级
        var srcMeta = _provenance(GM, 'memTableCompress.' + key, turn, 'T' + turn, compressed,
          [{ id: provId, turn: turn, content: original }], 8);
        if (srcMeta && (srcMeta.id || srcMeta.contentHash)) rec.sourceMeta = srcMeta;
        prov.push(rec);
        row[item.col] = compressed;                                                       // 经局部引用写回·压到限内
        stat.compressed++;
        stat.deltas.push({ col: item.col, column: colName, from: original.length, to: compressed.length });
      } catch (e) { _dbg('[MemorySteward] compress item fail:', e && e.message); stat.skipped++; }
    });
    if (prov.length > 200) sheet._meta._compressProvenance = prov.slice(-200); // 存证 LRU·防其自身膨胀
    sheet._meta._compressQueue = [];                                          // 清空队列·收敛核心
    return stat;
  }

  // 主入口：扫全表·消费各表 _compressQueue。确定性·零 LLM·可独立跑（不需 API key·不调模型）。
  function consumeCompressQueue(GM, opts) {
    opts = opts || {};
    GM = GM || global.GM;
    if (!GM || !GM._memTables) return { skipped: 'noTables', compressed: 0 };
    var MT = (global && global.MemTables) || null;
    if (!MT || !MT.SHEET_BY_KEY) return { skipped: 'noMemTables', compressed: 0 }; // 需 schema 取 maxLen/列名
    var turn = (GM && GM.turn) || 0;
    var out = { turn: turn, scannedSheets: 0, compressed: 0, skipped: 0, sheets: [], deltas: [] };
    Object.keys(GM._memTables).forEach(function (key) {
      if (_META_KEYS[key]) return;                                   // 跳过 _sentinelLog/_editorLocks 等元键
      var def = MT.SHEET_BY_KEY[key];
      if (!def || !def.maxLen) return;                               // 只处理声明了 maxLen 的表
      var stat = _consumeSheetQueue(GM, key, def);
      if (!stat) return;
      out.scannedSheets++;
      out.compressed += stat.compressed;
      out.skipped += stat.skipped;
      out.sheets.push({ sheet: key, queued: stat.queued, compressed: stat.compressed, skipped: stat.skipped });
      stat.deltas.forEach(function (d) { out.deltas.push({ sheet: key, col: d.col, column: d.column, from: d.from, to: d.to }); });
    });
    if (out.compressed) {
      _logRun(GM, { turn: turn, tableCompress: true, compressed: out.compressed, skipped: out.skipped, sheets: out.sheets, ts: _now() });
      _dbg('[MemorySteward] tableCompress compressed=' + out.compressed + ' skipped=' + out.skipped +
           ' sheets=' + out.sheets.map(function (s) { return s.sheet; }).join(','));
    }
    return out;
  }

  // ── S4·接管 or 回落 决策：每回合只算一次并缓存·保证 followup(compress×3) 与 post-turn-jobs(L2/L3) 两处读同一答案(否则 steward 中途改 streak 会致两处不一致) ──
  function shouldHandle(GM) {
    GM = GM || global.GM;
    if (!GM) return false;
    var P = global.P || {};
    if (!((typeof global.agentFlagOn==='function' ? global.agentFlagOn('memoryStewardEnabled') : (P.ai && P.ai.memoryStewardEnabled)) && TM.MemorySteward)) return false;
    var turn = GM.turn || 0;
    if (GM._memoryStewardDecision && GM._memoryStewardDecision.turn === turn) return GM._memoryStewardDecision.active;
    var streak = GM._memoryStewardFailStreak || 0;
    // 连失阈内→steward 接管；达阈→回落旧 pass·但每 RETRY_EVERY 回合重试一次
    var active = (streak < FAIL_THRESHOLD) || (turn % RETRY_EVERY === 0);
    GM._memoryStewardDecision = { turn: turn, active: active };
    return active;
  }

  // ── ④ 编排：扫→(有任务才)单次调用→写回。后台·单跳·不自主循环。 ──
  async function runInner(GM, opts) {
    opts = opts || {};
    GM = GM || global.GM;
    if (!GM) return { skipped: 'noGM' };
    var P = global.P || {};

    // ④ 表长字段压缩·确定性零 LLM·先跑（不依赖 key/tasks·独立于下方跨层 LLM 固化）。补齐 _compressQueue 消费者缺口。
    var tableCompress = consumeCompressQueue(GM, opts);

    if (!P.ai || !P.ai.key) return { skipped: 'noKey', tableCompress: tableCompress };

    if (opts.leaseCurrent && !opts.leaseCurrent()) return { skipped: "stale" };
    var workList = _prepareWork(GM, scan(GM, opts), opts);
    if (!workList.tasks.length) return { skipped: 'noTasks', turn: workList.turn, tableCompress: tableCompress };

    var req = buildConsolidationRequest(workList, GM);
    var outputBudget = Math.min(Number(opts.maxTok) > 0 ? Number(opts.maxTok) : workList.profile.consolidationOutput, workList.profile.consolidationOutput);
    var estimator = TM.ContextZones && TM.ContextZones.estimateTokens;
    var requestTokens = estimator ? estimator(req.system + req.user) : Math.ceil((req.system.length + req.user.length) * 1.3);
    if (workList.profile.contextK && requestTokens + outputBudget + 512 > workList.profile.contextK * 1024) return { skipped: 'context_budget', inputTokens: requestTokens, outputTokens: outputBudget };
    _dbg('[MemorySteward] run T' + workList.turn + ' tasks=' + workList.tasks.map(function (t) { return t.layer; }).join(','));

    if (typeof global.callAIMessages !== 'function') return { skipped: 'noCaller', tasks: workList.tasks.length };

    var raw;
    try {
      raw = await global.callAIMessages([
        { role: 'system', content: req.system },
        { role: 'user', content: req.user }
      ], outputBudget, opts.signal || null, opts.tier || 'primary', { priority: 'background', timeoutMs: opts.timeoutMs || 60000, maxRetries: 1, id: 'memory_steward' });
    } catch (e) {
      if (opts.leaseCurrent && !opts.leaseCurrent()) return { skipped: 'stale' };
      _dbg('[MemorySteward] call fail:', e && e.message);
      // 【S4】连失累加·达阈下回合 shouldHandle 回落旧 pass。【S3 可观测】失败记日志(让 owner 看得到失败连发)。
      GM._memoryStewardFailStreak = (GM._memoryStewardFailStreak || 0) + 1;
      _logRun(GM, { turn: workList.turn, failed: true, reason: 'call', error: String(e && e.message || e), requested: workList.tasks.map(function (t) { return t.layer; }), streak: GM._memoryStewardFailStreak, ts: _now() });
      return { failed: true, error: String(e && e.message || e), streak: GM._memoryStewardFailStreak, tasks: workList.tasks.length };
    }

    if ((opts.leaseCurrent && !opts.leaseCurrent()) || (opts.signal && opts.signal.aborted)) return { skipped: 'stale_or_cancelled' };
    var parsed = null;
    try { parsed = (typeof global.extractJSON === 'function') ? global.extractJSON(raw) : JSON.parse(raw); } catch (e) {}
    if (!_validConsolidation(workList, parsed)) {
      GM._memoryStewardFailStreak = (GM._memoryStewardFailStreak || 0) + 1;
      _logRun(GM, { turn: workList.turn, failed: true, reason: 'parse', requested: workList.tasks.map(function (t) { return t.layer; }), streak: GM._memoryStewardFailStreak, ts: _now() });
      return { failed: true, error: 'parse', streak: GM._memoryStewardFailStreak, tasks: workList.tasks.length };
    }

    if (!_workCurrent(GM, workList)) return { skipped: 'source_changed' };
    var res = applyConsolidation(GM, workList, parsed);
    if (res.failed || res.applied.length !== workList.tasks.length) return { failed: true, reason: res.reason || 'incomplete_consolidation', applied: res.applied };
    GM._memoryStewardFailStreak = 0; // 成功→连失清零·恢复 steward 接管
    var entry = {
      turn: workList.turn,
      requested: workList.tasks.map(function (t) { return t.layer; }),
      applied: res.applied, deltas: res.deltas,
      provenance: !!(TM.MemorySourceBound && TM.MemorySourceBound.buildSummaryMetadata),
      calls: 1, ts: _now()
    };
    _logRun(GM, entry);
    _diag('memory_steward', { status: 'ok', turn: workList.turn, requested: entry.requested, applied: res.applied, deltas: res.deltas, calls: 1, snapshot: _snap(GM) });
    _dbg('[MemorySteward] applied=' + res.applied.join(',') + ' deltas=' + JSON.stringify(res.deltas));
    return { ok: true, turn: workList.turn, requested: entry.requested, applied: res.applied, deltas: res.deltas, tableCompress: tableCompress };
  }

  function summarize(GM) {
    GM = GM || global.GM;
    var w = scan(GM, {});
    return { turn: w.turn, pendingTasks: w.tasks.map(function (t) { return t.layer + ':' + t.action; }) };
  }

  // 控制台观测：TM.MemorySteward.lastRun() 看上次固化了哪些层/前后条数·log() 看最近 20 次
  function lastRun(GM) { GM = GM || global.GM; var l = GM && GM._memoryStewardLog; return (l && l.length) ? l[l.length - 1] : null; }
  function log(GM) { GM = GM || global.GM; return (GM && GM._memoryStewardLog) || []; }

  TM.MemorySteward = {
    scan: scan,
    buildConsolidationRequest: buildConsolidationRequest,
    applyConsolidation: applyConsolidation,
    run: run,
    shouldHandle: shouldHandle,
    summarize: summarize,
    consumeCompressQueue: consumeCompressQueue,
    lastRun: lastRun,
    log: log,
    _provenance: _provenance
  };
})(typeof window !== 'undefined' ? window : globalThis);
