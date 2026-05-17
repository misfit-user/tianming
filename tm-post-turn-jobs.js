// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-post-turn-jobs.js — 回合后台任务（M3/M4/S2）
//
// R92 从 tm-endturn.js §A 抽出·原 L1909-2211 (303 行)
//
// 在 SC27 完成后异步启动·下回合开始前 await 完成
// 6 函数：_scL2AIGenerate（每5回合AI语义化摘要）
//        _scL3Condense（L3层压缩）
//        _scReflect（自省）
//        _updateFactionArcs（势力长期叙事）
//        _launchPostTurnJobs（启动后台任务）
//        _compressOldArchives（压缩旧档·被 tm-memory-anchors 调用）
//
// 外部调用：_compressOldArchives 被 tm-memory-anchors.js 调用·其他 0 外部
// 依赖外部：GM / P / callAI / extractJSON / _dbg（均 window 全局）
//
// 加载顺序：必须在 tm-endturn.js + tm-memory-anchors.js 之前
// ============================================================

// ════════════════════════════════════════════════════════════════════════
//  M3/M4/S2 后台任务函数（Post-turn jobs）
//  在 SC27 完成后异步启动·下回合开始前 await 完成
//  包含：SC_L2_AI / SC_L3_CONDENSE / SC_REFLECT / 更新势力弧 / 更新因果图元数据
// ════════════════════════════════════════════════════════════════════════

var _POST_TURN_NEXT_REQUIRED_IDS = {
  sc25: true,
  compress_ai_memory: true,
  compress_foreshadows: true,
  compress_conversation: true
};

var _POST_TURN_CRITICAL_IDS = _POST_TURN_NEXT_REQUIRED_IDS;

// npc_behavior 由 tm-endturn-pipeline-steps.js 入队；它允许在结果弹窗后后台运行，
// 不默认列入 next/save 必阻塞项，避免玩家过回合等待重新变长。
var _POST_TURN_SAVE_REQUIRED_IDS = {
  sc25: true
};

function _isCriticalPostTurnJob(job) {
  return !!(job && _POST_TURN_CRITICAL_IDS[job.id]);
}

function _isSaveRequiredPostTurnJob(job) {
  return !!(job && _POST_TURN_SAVE_REQUIRED_IDS[job.id]);
}

function _postTurnSaveRequiredIds() {
  return Object.keys(_POST_TURN_SAVE_REQUIRED_IDS);
}

function _snapshotTurnAiResultsForPostTurn() {
  try {
    if (typeof deepClone === 'function') return deepClone(GM._turnAiResults || {});
    return JSON.parse(JSON.stringify(GM._turnAiResults || {}));
  } catch(_) {
    return GM && GM._turnAiResults ? Object.assign({}, GM._turnAiResults) : {};
  }
}

/** 方向 8：SC_L2_AI·每 5 回合 AI 语义化情景摘要 */
async function _scL2AIGenerate(turnOverride) {
  if (!GM || !P || !P.ai || !P.ai.key) return;
  function _memText(entry) {
    return (typeof memoryEntryText === 'function') ? memoryEntryText(entry) : String((entry && (entry.content || entry.text || entry.summary)) || '');
  }
  var jobTurn = turnOverride || (GM._postTurnJobs && GM._postTurnJobs.turn) || GM.turn || 0;
  if (jobTurn % 5 !== 0) return;
  if (!GM._memoryLayers) GM._memoryLayers = { L1: [], L2: [], L3: [] };
  // 检查本 bucket 是否已生成（防重复）
  var existAI = (GM._memoryLayers.L2 || []).find(function(x){ return x.turnBucket === jobTurn && x.aiGenerated; });
  if (existAI) return;
  var bucketStart = jobTurn - 4;
  // 收集数据
  var bucketMems = (GM._aiMemory || []).filter(function(m){ return m && m.turn >= bucketStart && m.turn <= jobTurn; });
  var bucketShiji = (GM.shijiHistory || []).filter(function(s){ return s.turn >= bucketStart && s.turn <= jobTurn; });
  if (bucketMems.length === 0 && bucketShiji.length === 0) return;
  var tpL2 = '【任务·将过去5回合的事件语义化压缩为情景摘要】\n';
  tpL2 += '时间范围：T' + bucketStart + '-T' + jobTurn + '\n\n';
  if (bucketShiji.length) {
    tpL2 += '<shiji-history>\n';
    bucketShiji.forEach(function(s){
      tpL2 += '  <turn n="' + s.turn + '">' + ((s.shizhengji || s.shilu_text || '').substring(0, 500)) + '</turn>\n';
    });
    tpL2 += '</shiji-history>\n';
  }
  if (bucketMems.length) {
    tpL2 += '<memories>\n';
    bucketMems.forEach(function(m){
      tpL2 += '  <mem turn="' + m.turn + '">' + (_memText(m).substring(0, 150)) + '</mem>\n';
    });
    tpL2 += '</memories>\n';
  }
  tpL2 += '\n【输出 JSON】\n';
  tpL2 += '{\n';
  tpL2 += '  "summary": "情景摘要·200-300字·含主要事件+人物关系演变+情绪氛围",\n';
  tpL2 += '  "mood": "本5回合的整体情感基调·30字内",\n';
  tpL2 += '  "keyCharacters": [{"name":"角色名","role":"本期角色·30字"}],\n';
  tpL2 += '  "themes": ["本期主题1","主题2"],\n';
  tpL2 += '  "turning_points": ["关键转折点·30字内"]\n';
  tpL2 += '}\n';
  try {
    var respL2 = await callAIMessages([
      { role: 'system', content: '你是天命游戏的史官·专长将散乱事件压缩为精炼的情景纲要·保留因果与情绪而非堆砌细节。' },
      { role: 'user', content: tpL2 }
    ], 3000);
    var parsedL2 = extractJSON(respL2);
    if (parsedL2 && parsedL2.summary) {
      // 替换或新增
      GM._memoryLayers.L2 = (GM._memoryLayers.L2 || []).filter(function(x){ return x.turnBucket !== jobTurn || !x.aiGenerated; });
      GM._memoryLayers.L2.push({
        turnBucket: jobTurn,
        turnRange: bucketStart + '-' + jobTurn,
        summary: parsedL2.summary,
        mood: parsedL2.mood || '',
        keyCharacters: parsedL2.keyCharacters || [],
        themes: parsedL2.themes || [],
        turning_points: parsedL2.turning_points || [],
        aiGenerated: true,
        createdAt: jobTurn
      });
      if (GM._memoryLayers.L2.length > 12) GM._memoryLayers.L2 = GM._memoryLayers.L2.slice(-12);
      try {
        if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('post_turn_l2', { status: 'ok', range: bucketStart + '-' + jobTurn, memories: bucketMems.length, shiji: bucketShiji.length, snapshot: (typeof buildMemoryDiagnosticSnapshot === 'function' ? buildMemoryDiagnosticSnapshot(GM) : null) });
      } catch(_) {}
      _dbg('[SC_L2_AI] 生成 AI 情景摘要 T' + bucketStart + '-T' + jobTurn);
    }
  } catch(e) {
    try { if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('post_turn_l2', { status: 'fail', error: String(e && e.message || e) }); } catch(_) {}
    _dbg('[SC_L2_AI] 失败:', e);
  }
}

/** 方向 9：SC_L3_CONDENSE·每 30 回合 AI 年代纲要 */
async function _scL3Condense(turnOverride) {
  if (!GM || !P || !P.ai || !P.ai.key) return;
  var jobTurn = turnOverride || (GM._postTurnJobs && GM._postTurnJobs.turn) || GM.turn || 0;
  if (jobTurn % 30 !== 0) return;
  if (!GM._memoryLayers) GM._memoryLayers = { L1: [], L2: [], L3: [] };
  var existAI = (GM._memoryLayers.L3 || []).find(function(x){ return x.turnBucket === jobTurn && x.aiGenerated; });
  if (existAI) return;
  var l3Start = jobTurn - 29;
  var bucketL2 = (GM._memoryLayers.L2 || []).filter(function(x){ return x.turnBucket >= l3Start && x.turnBucket <= jobTurn; });
  if (bucketL2.length === 0) return;
  var tpL3 = '【任务·将过去30回合压缩为年代纲要·史书级压缩】\n';
  tpL3 += '时间范围：T' + l3Start + '-T' + jobTurn + '\n\n';
  tpL3 += '<scene-summaries>\n';
  bucketL2.forEach(function(x){
    tpL3 += '  <scene range="' + x.turnRange + '" mood="' + (x.mood||'') + '">' + (x.summary||'').substring(0, 400) + '</scene>\n';
  });
  tpL3 += '</scene-summaries>\n';
  tpL3 += '\n【输出 JSON】\n';
  tpL3 += '{\n';
  tpL3 += '  "theme": "本年代的核心主题·40字内·如「北境动荡·朝堂党争激化」",\n';
  tpL3 += '  "atmosphere": "年代总体氛围·30字内",\n';
  tpL3 += '  "highlights": ["高光时刻1（T?·30字）", "2", "3", "4", "5"],\n';
  tpL3 += '  "mainThreads": "贯穿30回合的几条主线·80字内",\n';
  tpL3 += '  "causalSummary": "主要事件间的因果链·100字内",\n';
  tpL3 += '  "keyCharacters": [{"name":"角色","role":"角色弧","emotional_arc":"情感轨迹"}]\n';
  tpL3 += '}\n';
  try {
    var respL3 = await callAIMessages([
      { role: 'system', content: '你是天命游戏的编年史官·写年代纲要如《资治通鉴》综述·提炼主题与因果·非流水记事。' },
      { role: 'user', content: tpL3 }
    ], 4000);
    var parsedL3 = extractJSON(respL3);
    if (parsedL3 && parsedL3.theme) {
      GM._memoryLayers.L3 = (GM._memoryLayers.L3 || []).filter(function(x){ return x.turnBucket !== jobTurn || !x.aiGenerated; });
      GM._memoryLayers.L3.push({
        turnBucket: jobTurn,
        turnRange: l3Start + '-' + jobTurn,
        theme: parsedL3.theme,
        atmosphere: parsedL3.atmosphere || '',
        highlights: parsedL3.highlights || [],
        mainThreads: parsedL3.mainThreads || '',
        causalSummary: parsedL3.causalSummary || '',
        keyCharacters: parsedL3.keyCharacters || [],
        summary: parsedL3.theme + '·' + (parsedL3.atmosphere || ''),  // 向后兼容字段
        aiGenerated: true,
        createdAt: jobTurn
      });
      try {
        if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('post_turn_l3', { status: 'ok', range: l3Start + '-' + jobTurn, scenes: bucketL2.length, snapshot: (typeof buildMemoryDiagnosticSnapshot === 'function' ? buildMemoryDiagnosticSnapshot(GM) : null) });
      } catch(_) {}
      _dbg('[SC_L3_CONDENSE] 生成 AI 年代纲要 T' + l3Start + '-T' + GM.turn);
    }
  } catch(e) {
    try { if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('post_turn_l3', { status: 'fail', error: String(e && e.message || e) }); } catch(_) {}
    _dbg('[SC_L3_CONDENSE] 失败:', e);
  }
}

/** 方向 12：SC_REFLECT·对比上回合预测 vs 本回合实际·生成反省记录 */
async function _scReflect(turnOverride, turnResultsOverride) {
  if (!GM || !P || !P.ai || !P.ai.key) return;
  var jobTurn = turnOverride || (GM._postTurnJobs && GM._postTurnJobs.turn) || GM.turn || 0;
  var _turnResults = turnResultsOverride || GM._turnAiResults || {};
  if (!_turnResults || !_turnResults.thinking) return;
  // 需要上回合存下的 predictions（来自 SC25 的 predictions 字段·新增）
  var lastPredictions = GM._lastTurnPredictions;
  if (!lastPredictions) {
    // 首次·保存本回合 thinking 为下次对比基准
    GM._lastTurnPredictions = {
      turn: jobTurn,
      thinking: (_turnResults.thinking || '').substring(0, 1500)
    };
    return;
  }
  var tpR = '【任务·对比上回合预测与本回合实际·提炼经验教训】\n\n';
  tpR += '<last-turn-predictions turn="' + lastPredictions.turn + '">\n' + lastPredictions.thinking + '\n</last-turn-predictions>\n\n';
  tpR += '<this-turn-actual turn="' + jobTurn + '">\n';
  tpR += ((_turnResults && _turnResults.subcall25 && _turnResults.subcall25.memory) || '').substring(0, 1500) + '\n';
  tpR += '</this-turn-actual>\n\n';
  tpR += '【输出 JSON】\n';
  tpR += '{\n';
  tpR += '  "predictedLast": "上回合我预测的主要走向·60字",\n';
  tpR += '  "actualThis": "本回合实际发生的·60字",\n';
  tpR += '  "divergence": "high/mid/low·偏离程度",\n';
  tpR += '  "lesson": "下回合应如何修正思路·60字",\n';
  tpR += '  "confidence_calibration": -1.0 到 1.0·负数代表我过于自信需降调\n';
  tpR += '}\n';
  try {
    var respR = await callAIMessages([
      { role: 'system', content: '你是一个自省的 AI·客观比较预测与实际·提炼教训·不避讳自己的错误。' },
      { role: 'user', content: tpR }
    ], 1500);
    var parsedR = extractJSON(respR);
    if (parsedR && parsedR.lesson) {
      if (!GM._aiReflections) GM._aiReflections = [];
      GM._aiReflections.push({
        turn: jobTurn,
        predictedLast: parsedR.predictedLast || '',
        actualThis: parsedR.actualThis || '',
        divergence: parsedR.divergence || 'mid',
        lesson: parsedR.lesson,
        confidence_calibration: parseFloat(parsedR.confidence_calibration) || 0
      });
      if (GM._aiReflections.length > 30) GM._aiReflections = GM._aiReflections.slice(-30);
      _dbg('[SC_REFLECT] 反省：', parsedR.lesson.substring(0, 60));
    }
    // 保存本回合为下次对比基准
    GM._lastTurnPredictions = {
      turn: jobTurn,
      thinking: (_turnResults.thinking || '').substring(0, 1500)
    };
  } catch(e) { _dbg('[SC_REFLECT] 失败:', e); }
}

/** 方向 10：_factionArcs·势力长期叙事线更新 */
function _updateFactionArcs() {
  if (!GM) return;
  if (!GM._factionArcs) GM._factionArcs = {};
  var p1 = (GM._turnAiResults && GM._turnAiResults.subcall1) || {};
  // 从 faction_changes (SC1 schema 实际字段) + faction_events 推断阶段
  var factions = {};
  (p1.faction_changes || []).forEach(function(fc) {
    if (!fc || !fc.name) return;
    if (!factions[fc.name]) factions[fc.name] = { events: [], deltas: {} };
    // faction_changes schema: {name, strength_delta, economy_delta, playerRelation_delta, reason}
    if (fc.strength_delta != null) factions[fc.name].deltas.strength_delta = (factions[fc.name].deltas.strength_delta||0) + fc.strength_delta;
    if (fc.economy_delta != null) factions[fc.name].deltas.economy_delta = (factions[fc.name].deltas.economy_delta||0) + fc.economy_delta;
    if (fc.reason) factions[fc.name].events.push(fc.reason.substring(0, 40));
  });
  (p1.faction_events || []).forEach(function(fe) {
    if (!fe || !fe.actor) return;
    if (!factions[fe.actor]) factions[fe.actor] = { events: [], deltas: {} };
    factions[fe.actor].events.push((fe.action || '') + (fe.result ? '→' + fe.result : ''));
    if (fe.strength_effect != null) factions[fe.actor].deltas.strength_delta = (factions[fe.actor].deltas.strength_delta||0) + fe.strength_effect;
  });
  Object.keys(factions).forEach(function(fn) {
    if (!GM._factionArcs[fn]) {
      GM._factionArcs[fn] = {
        currentPhase: 'stable',
        phaseHistory: [],
        cumulativeInfluence: 50,
        keyMoments: []
      };
    }
    var arc = GM._factionArcs[fn];
    var info = factions[fn];
    // 推断阶段：按 deltas
    var strengthDelta = (info.deltas.strength || info.deltas.strength_delta || 0);
    var newPhase = arc.currentPhase;
    if (strengthDelta > 10) newPhase = 'rising';
    else if (strengthDelta > 3) newPhase = 'consolidating';
    else if (strengthDelta < -10) newPhase = 'declining';
    else if (strengthDelta < -3) newPhase = 'strained';
    // 累积影响力
    arc.cumulativeInfluence = Math.max(0, Math.min(100, arc.cumulativeInfluence + strengthDelta * 0.5));
    // 阶段记录
    if (info.events.length > 0 || newPhase !== arc.currentPhase) {
      arc.phaseHistory.push({
        turn: GM.turn,
        phase: newPhase,
        event: info.events.slice(0, 2).join('；').substring(0, 80),
        strengthDelta: strengthDelta,
        influence: arc.cumulativeInfluence
      });
      if (arc.phaseHistory.length > 40) arc.phaseHistory = arc.phaseHistory.slice(-40);
    }
    arc.currentPhase = newPhase;
    // 关键时刻（绝对 delta 超 8 的事件）
    if (Math.abs(strengthDelta) > 8) {
      arc.keyMoments.push({
        turn: GM.turn,
        event: info.events[0] || '重大变动',
        phase: newPhase
      });
      if (arc.keyMoments.length > 20) arc.keyMoments = arc.keyMoments.slice(-20);
    }
  });
}

/**
 * 启动 post-turn 异步任务·不 await·玩家看结果时后台运行
 * 下回合开始前由 _ensureMemoryFreshness 先 await 所有 pending
 */
function _ensurePostTurnJobQueue() {
  if (!GM) return;
  if (!GM._postTurnJobs || !Array.isArray(GM._postTurnJobs.pending)) {
    GM._postTurnJobs = { pending: [], launchedAt: Date.now(), turn: GM.turn || 0, results: {} };
  }
  return GM._postTurnJobs;
}

function _enqueuePostTurnJob(id, fn) {
  var q = _ensurePostTurnJobQueue();
  if (!q || typeof fn !== 'function') return null;
  var p = Promise.resolve().then(fn).catch(function(e){
    try { if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('post_turn_job', { id: id, status: 'fail', error: String(e && e.message || e) }); } catch(_) {}
    _dbg('[PostTurn]' + id + ' failed:', e);
  });
  q.pending.push({ id: id, promise: p });
  return p;
}

async function _awaitPostTurnJobsById(ids) {
  if (!GM || !GM._postTurnJobs || !Array.isArray(GM._postTurnJobs.pending)) return;
  if (!Array.isArray(ids) || !ids.length) return;
  var waiting = GM._postTurnJobs.pending.filter(function(job) {
    return job && ids.indexOf(job.id) >= 0;
  });
  if (!waiting.length) return;
  await Promise.all(waiting.map(function(job) { return job.promise; }));
}

function _launchPostTurnJobs() {
  if (!GM) return;
  var q = _ensurePostTurnJobQueue();
  var jobTurn = q.turn || GM.turn || 0;
  var turnResultsSnapshot = q.turnResultsSnapshot || _snapshotTurnAiResultsForPostTurn();
  q.turnResultsSnapshot = turnResultsSnapshot;
  var jobs = [];
  // 同步任务（不涉及 AI 调用）
  try { _updateFactionArcs(); } catch(e) { _dbg('[PostTurn] factionArcs:', e); }
  // 异步 AI 任务
  if (jobTurn % 5 === 0) jobs.push({ id: 'l2_ai', fn: async function() {
    await _awaitPostTurnJobsById(['sc25', 'sc28']);
    return _scL2AIGenerate(jobTurn);
  } });
  if (jobTurn % 30 === 0) jobs.push({ id: 'l3_condense', fn: async function() {
    await _awaitPostTurnJobsById(['l2_ai']);
    return _scL3Condense(jobTurn);
  } });
  jobs.push({ id: 'reflect', fn: async function() {
    await _awaitPostTurnJobsById(['sc25']);
    return _scReflect(jobTurn, turnResultsSnapshot);
  } });
  jobs.forEach(function(j) { _enqueuePostTurnJob(j.id, j.fn); });
  try {
    if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('post_turn_launch', { jobs: jobs.map(function(j){ return j.id; }), turn: jobTurn, snapshot: (typeof buildMemoryDiagnosticSnapshot === 'function' ? buildMemoryDiagnosticSnapshot(GM) : null) });
  } catch(_) {}
  _dbg('[PostTurn] launch', jobs.length, 'jobs; pending=', q.pending.length);
}

/** 等待所有 post-turn jobs 完成（下回合开始时调用） */
async function _awaitPostTurnJobs() {
  if (!GM || !GM._postTurnJobs || !GM._postTurnJobs.pending) return;
  var pending = GM._postTurnJobs.pending;
  if (pending.length === 0) return;
  _dbg('[PostTurn] 等待', pending.length, '个任务·已运行', Math.round((Date.now() - GM._postTurnJobs.launchedAt)/1000), 's');
  try {
    await Promise.all(pending.map(function(p) { return p.promise; }));
  } catch(_e) { /* 已被单任务 catch */ }
  try {
    if (typeof recordMemoryDiagnostic === 'function') recordMemoryDiagnostic('post_turn_await', { status: 'done', count: pending.length, snapshot: (typeof buildMemoryDiagnosticSnapshot === 'function' ? buildMemoryDiagnosticSnapshot(GM) : null) });
  } catch(_) {}
  GM._postTurnJobs = null;
  delete GM._turnAiResults;
}

/** 压缩最旧的归档为一条综合总纲（超出上限时调用） */
async function _awaitPostTurnJobsForSave(ids) {
  if (!GM || !GM._postTurnJobs || !Array.isArray(GM._postTurnJobs.pending)) return;
  var wanted = GM._postTurnJobs.pending.slice();
  if (Array.isArray(ids) && ids.length) {
    wanted = wanted.filter(function(job) { return job && ids.indexOf(job.id) >= 0; });
  }
  if (!wanted.length) return;
  _dbg('[PostTurn] wait before save:', wanted.map(function(job) { return job.id || '?'; }).join(','));
  await Promise.all(wanted.map(function(job) { return job.promise; }));
}

function _detachRemainingPostTurnJobs(remaining, sourceTurn) {
  if (!remaining || !remaining.length) return;
  if (!Array.isArray(GM._postTurnDetachedJobs)) GM._postTurnDetachedJobs = [];
  remaining.forEach(function(job) {
    if (!job) return;
    job.detached = true;
    job.sourceTurn = sourceTurn || job.sourceTurn || 0;
    GM._postTurnDetachedJobs.push(job);
  });
  if (GM._postTurnDetachedJobs.length > 40) {
    GM._postTurnDetachedJobs = GM._postTurnDetachedJobs.slice(-40);
  }
}

async function _awaitPostTurnJobs(opts) {
  opts = opts || {};
  if (!GM || !GM._postTurnJobs || !Array.isArray(GM._postTurnJobs.pending)) return;
  var pending = GM._postTurnJobs.pending;
  if (!pending.length) return;
  var criticalOnly = opts.criticalOnly !== false;
  var waiting = criticalOnly ? pending.filter(_isCriticalPostTurnJob) : pending.slice();
  var remaining = criticalOnly ? pending.filter(function(job) { return !_isCriticalPostTurnJob(job); }) : [];
  _dbg('[PostTurn] wait', waiting.length, criticalOnly ? 'critical jobs' : 'jobs', 'detach', remaining.length);
  try {
    if (waiting.length) await Promise.all(waiting.map(function(job) { return job.promise; }));
  } catch(_e) {}
  try {
    if (typeof recordMemoryDiagnostic === 'function') {
      recordMemoryDiagnostic('post_turn_await', {
        status: 'done',
        count: waiting.length,
        criticalOnly: criticalOnly,
        detached: remaining.length,
        snapshot: (typeof buildMemoryDiagnosticSnapshot === 'function' ? buildMemoryDiagnosticSnapshot(GM) : null)
      });
    }
  } catch(_) {}
  if (criticalOnly) _detachRemainingPostTurnJobs(remaining, GM._postTurnJobs.turn || GM.turn || 0);
  GM._postTurnJobs = null;
  delete GM._turnAiResults;
}

async function _awaitPostTurnJobsForSave(ids) {
  if (!GM) return;
  var wanted = [];
  if (GM._postTurnJobs && Array.isArray(GM._postTurnJobs.pending)) wanted = wanted.concat(GM._postTurnJobs.pending);
  if (Array.isArray(GM._postTurnDetachedJobs)) wanted = wanted.concat(GM._postTurnDetachedJobs);
  if (Array.isArray(ids) && ids.length) {
    wanted = wanted.filter(function(job) { return job && ids.indexOf(job.id) >= 0; });
  } else {
    wanted = wanted.filter(_isSaveRequiredPostTurnJob);
  }
  if (!wanted.length) return;
  _dbg('[PostTurn] wait before save:', wanted.map(function(job) { return job.id || '?'; }).join(','));
  await Promise.all(wanted.map(function(job) { return job.promise; }));
  if (!Array.isArray(ids) || !ids.length) {
    var saveIds = _postTurnSaveRequiredIds();
    if (Array.isArray(GM._postTurnDetachedJobs)) {
      GM._postTurnDetachedJobs = GM._postTurnDetachedJobs.filter(function(job) {
        return job && saveIds.indexOf(job.id) < 0;
      });
    }
  }
}

function _compressOldArchives(limit) {
  if (!GM.memoryArchive || GM.memoryArchive.length <= limit) return;
  // 将超出部分合并为一条"远古纪要"
  var overflow = GM.memoryArchive.splice(0, GM.memoryArchive.length - limit + 1);
  var yearRange = overflow[0].year + '-' + overflow[overflow.length-1].year;
  var combined = {
    type: 'archive',
    title: yearRange + '年综述',
    content: overflow.map(function(a){ return a.title + ':' + (a.content||'').substring(0,30); }).join('；').substring(0, 300),
    turn: overflow[0].turn,
    year: overflow[0].year,
    importance: 80,
    eventCount: overflow.reduce(function(s,a){ return s + (a.eventCount||1); }, 0),
    compressed: true
  };
  GM.memoryArchive.unshift(combined);

  // 异步 AI 压缩（不阻塞游戏，后台生成更好的摘要替换）
  if (P.ai.key) {
    var prompt = '请将以下历史纪要压缩为一段100字以内的综述：\n' + overflow.map(function(a){ return a.content; }).join('\n');
    callAI(prompt, 300).then(function(result) {
      if (result && GM.memoryArchive[0] && GM.memoryArchive[0].compressed) {
        GM.memoryArchive[0].content = result.substring(0, 200);
        GM.memoryArchive[0].aiCompressed = true;
        _dbg('[Memory] AI 压缩归档完成: ' + yearRange);
      }
    }).catch(function(e) { _dbg('[Memory] AI 压缩失败，保留原始摘要'); });
  }
}
