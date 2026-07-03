// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-core.js — 回合结算入口 (R110 从 tm-endturn.js L12712-end 拆出)
// 职责: endTurn(入口)·_endTurnInternal·_endTurnCore (主管道·调 prep + ai-infer + 写回)
// 姊妹: tm-endturn-prep.js + tm-endturn-ai-infer.js
//
// Domain: 回合结算 / pipeline (主管道入口)
// Refactor notes:
//   Phase 3·rename → tm-endturn-pipeline.js (final §4.2)
//   Phase 5·namespace TM.Endturn.Pipeline
// 见 web/docs/architecture-map.md §1 行 5
// ============================================================

async function _runPreSubmitPartyClassCalibration() {
  try {
    var _pcSchedulerRan = false;
    try {
      if (typeof window !== 'undefined' && window.TM && TM.PartyClassActionScheduler && typeof TM.PartyClassActionScheduler.scheduleBeforeSubmit === 'function') {
        TM.PartyClassActionScheduler.scheduleBeforeSubmit(GM, {
          source: 'pre-submit-party-class-action-scheduler',
          turn: GM && GM.turn
        });
        _pcSchedulerRan = true;
      }
    } catch(_partyClassSchedulerE) {
      try { console.warn('[endTurn] pre-submit party/class action scheduler failed', _partyClassSchedulerE); } catch(_){}
    }
    if (!_pcSchedulerRan && typeof window !== 'undefined' && window.TM && TM.SocialPoliticalSignals) {
      try {
        if (typeof TM.SocialPoliticalSignals.decayAndResolve === 'function') {
          TM.SocialPoliticalSignals.decayAndResolve(GM, {
            source: 'pre-submit-signal-maintenance',
            turn: GM && GM.turn
          });
        }
        if (typeof TM.SocialPoliticalSignals.scanRuntimePressures === 'function') {
          TM.SocialPoliticalSignals.scanRuntimePressures(GM, {
            source: 'pre-submit-runtime-pressure',
            turn: GM && GM.turn
          });
        }
        if (TM.PartyClassSignalBridge && typeof TM.PartyClassSignalBridge.applyPending === 'function') {
          TM.PartyClassSignalBridge.applyPending(GM, {
            source: 'pre-submit-runtime-pressure',
            turn: GM && GM.turn
          });
        } else if (typeof TM.SocialPoliticalSignals.applyPending === 'function') {
          TM.SocialPoliticalSignals.applyPending(GM, {
            source: 'pre-submit-runtime-pressure',
            turn: GM && GM.turn
          });
        }
      } catch(_socialPoliticalE) {
        try { console.warn('[endTurn] pre-submit social/political signal bridge failed', _socialPoliticalE); } catch(_){}
      }
    }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.ClassCharacterRelations && typeof TM.ClassCharacterRelations.run === 'function') {
        TM.ClassCharacterRelations.run(GM, {
          source: 'pre-submit-class-character-relations',
          turn: GM && GM.turn
        });
      }
    } catch(_classCharacterRelationsE) {
      try { console.warn('[endTurn] pre-submit class/character relations failed', _classCharacterRelationsE); } catch(_){}
    }
    if (!_pcSchedulerRan) try {
      if (typeof window !== 'undefined' && window.TM && TM.PartyClassActors && typeof TM.PartyClassActors.run === 'function') {
        if (typeof TM.PartyClassActors.tick === 'function') {
          TM.PartyClassActors.tick(GM, {
            source: 'pre-submit-party-class-actor-maintenance',
            turn: GM && GM.turn
          });
        }
        TM.PartyClassActors.run(GM, {
          source: 'pre-submit-party-class-actors',
          turn: GM && GM.turn
        });
      }
    } catch(_partyClassActorsE) {
      try { console.warn('[endTurn] pre-submit party/class actors failed', _partyClassActorsE); } catch(_){}
    }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.ClassMinxinBridge && typeof TM.ClassMinxinBridge.maintain === 'function') {
        TM.ClassMinxinBridge.maintain(GM, {
          source: 'pre-submit-class-minxin-bridge',
          turn: GM && GM.turn
        });
      }
    } catch(_classMinxinMaintainE) {
      try { console.warn('[endTurn] pre-submit class/minxin bridge failed', _classMinxinMaintainE); } catch(_){}
    }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.MinxinLedger && typeof TM.MinxinLedger.maintain === 'function') {
        TM.MinxinLedger.maintain(GM, {
          source: 'pre-submit-minxin-ledger',
          turn: GM && GM.turn
        });
      }
    } catch(_minxinLedgerMaintainE) {
      try { console.warn('[endTurn] pre-submit minxin ledger failed', _minxinLedgerMaintainE); } catch(_){}
    }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.MinxinPressureActions && typeof TM.MinxinPressureActions.maintain === 'function') {
        TM.MinxinPressureActions.maintain(GM, {
          source: 'pre-submit-minxin-pressure-actions',
          turn: GM && GM.turn
        });
      }
    } catch(_minxinPressureActionsE) {
      try { console.warn('[endTurn] pre-submit minxin pressure actions failed', _minxinPressureActionsE); } catch(_){}
    }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.MinxinCommitmentTracker && typeof TM.MinxinCommitmentTracker.tick === 'function') {
        TM.MinxinCommitmentTracker.tick(GM, {
          source: 'pre-submit-minxin-commitments',
          turn: GM && GM.turn
        });
      }
    } catch(_minxinCommitmentsE) {
      try { console.warn('[endTurn] pre-submit minxin commitments failed', _minxinCommitmentsE); } catch(_){}
    }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.MinxinResponsibilityChain && typeof TM.MinxinResponsibilityChain.tick === 'function') {
        TM.MinxinResponsibilityChain.tick(GM, {
          source: 'pre-submit-minxin-responsibility',
          turn: GM && GM.turn
        });
      }
    } catch(_minxinResponsibilityE) {
      try { console.warn('[endTurn] pre-submit minxin responsibility failed', _minxinResponsibilityE); } catch(_){}
    }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.HujiGovernanceLoop && typeof TM.HujiGovernanceLoop.ingestPlayerSignals === 'function') {
        TM.HujiGovernanceLoop.ingestPlayerSignals(GM, {
          source: 'pre-submit-huji-governance',
          turn: GM && GM.turn
        });
        if (typeof TM.HujiGovernanceLoop.applyCourtFeedbacks === 'function') {
          TM.HujiGovernanceLoop.applyCourtFeedbacks(GM, {
            source: 'pre-submit-huji-governance-court-feedback',
            turn: GM && GM.turn
          });
        }
      }
    } catch(_hujiGovernanceE) {
      try { console.warn('[endTurn] pre-submit huji governance loop failed', _hujiGovernanceE); } catch(_){}
    }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.HujiRuntimeBridge && typeof TM.HujiRuntimeBridge.maintain === 'function') {
        TM.HujiRuntimeBridge.maintain(GM, {
          source: 'pre-submit-huji-runtime-bridge',
          turn: GM && GM.turn,
          includePlayerSignals: true
        });
      }
    } catch(_hujiRuntimeBridgeE) {
      try { console.warn('[endTurn] pre-submit huji runtime bridge failed', _hujiRuntimeBridgeE); } catch(_){}
    }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.MinxinHardLinks && typeof TM.MinxinHardLinks.tick === 'function') {
        TM.MinxinHardLinks.tick(GM, {
          source: 'pre-submit-minxin-hard-links',
          turn: GM && GM.turn
        });
      }
    } catch(_minxinHardLinksE) {
      try { console.warn('[endTurn] pre-submit minxin hard links failed', _minxinHardLinksE); } catch(_){}
    }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.MinxinHardLinkConsumers && typeof TM.MinxinHardLinkConsumers.consume === 'function') {
        TM.MinxinHardLinkConsumers.consume(GM, {
          source: 'pre-submit-minxin-hard-link-consumers',
          turn: GM && GM.turn
        });
      }
    } catch(_minxinHardLinkConsumersE) {
      try { console.warn('[endTurn] pre-submit minxin hard-link consumers failed', _minxinHardLinkConsumersE); } catch(_){}
    }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.HujiRuntimeBridge && typeof TM.HujiRuntimeBridge.maintain === 'function') {
        TM.HujiRuntimeBridge.maintain(GM, {
          source: 'pre-submit-huji-runtime-bridge-after-hard-links',
          turn: GM && GM.turn
        });
      }
    } catch(_hujiRuntimeBridgeAfterE) {
      try { console.warn('[endTurn] post-consumer huji runtime bridge failed', _hujiRuntimeBridgeAfterE); } catch(_){}
    }
    if (typeof window === 'undefined' || !window.TM || !TM.PartyClassLlmCalibrator || typeof TM.PartyClassLlmCalibrator.flushBeforeSubmit !== 'function') return;
    if (GM && GM._partyClassPreSubmitBusy) return;
    if (GM) GM._partyClassPreSubmitBusy = true;
    var _partyClassCalibration = await TM.PartyClassLlmCalibrator.flushBeforeSubmit({
      source: 'pre-submit-player-action',
      phase: 'pre-submit',
      turn: GM && GM.turn,
      priority: 'background',
      timeoutMs: (typeof P !== 'undefined' && P && P.conf && P.conf.partyClassLlmSubmitTimeoutMs) || 45000
    });
    try {
      var _pcApplied = _partyClassCalibration && _partyClassCalibration.applied;
      var _pcAppliedCount = 0;
      if (_pcApplied && typeof _pcApplied === 'object') {
        Object.keys(_pcApplied).forEach(function(k) {
          var n = Number(_pcApplied[k]);
          if (isFinite(n) && n > 0) _pcAppliedCount += n;
        });
      }
      if (_pcAppliedCount > 0 && TM.PartyClassActors && typeof TM.PartyClassActors.run === 'function') {
        if (TM.PartyClassActionScheduler && typeof TM.PartyClassActionScheduler.scheduleBeforeSubmit === 'function') {
          TM.PartyClassActionScheduler.scheduleBeforeSubmit(GM, {
            source: 'pre-submit-party-class-action-scheduler-calibrated',
            turn: GM && GM.turn,
            skipSignalMaintenance: true,
            skipRuntimeScan: true
          });
        } else {
          TM.PartyClassActors.run(GM, {
            source: 'pre-submit-party-class-actors-calibrated',
            turn: GM && GM.turn
          });
        }
      }
    } catch(_partyClassActorsAfterE) {
      try { console.warn('[endTurn] post-calibration party/class actors failed', _partyClassActorsAfterE); } catch(_){}
    }
  } catch(_partyClassLlmE) {
    try { console.warn('[endTurn] pre-submit party/class LLM calibration failed', _partyClassLlmE); } catch(_){}
  } finally {
    try { if (GM) GM._partyClassPreSubmitBusy = false; } catch(_){}
  }
}

async function _endTurnInternal() {
  try {
    if (typeof _cancelNpcIdleAutonomyLoop === 'function') _cancelNpcIdleAutonomyLoop('endturn_start');
  } catch(_idleCancelE) {
    try { console.warn('[endTurn] NPC idle autonomy cancel failed', _idleCancelE); } catch(_){}
  }
  // 原 endTurn 的完整内容移入此处，方便并发调用
  return await _endTurnCore();
}

async function endTurn(){
  // 入口：显示"是否例行朝会"弹窗
  if (GM.busy) return;
  // ★[无密钥前置守卫·2026-06-14] 天命以 AI 为引擎，未配 API 密钥则过回合纯空转——
  //   旧行为：深层 if(P.ai.key) 无 else，回合数照变而世界毫无反应，新玩家误判为「游戏坏了」。
  //   此处在入口处一次性拦下：明确告知非故障 + 一键前往配置，绝不静默空转。
  if (!P.ai || !P.ai.key || !String(P.ai.key).trim()) {
    try {
      if (typeof notifyUrgent === 'function') {
        notifyUrgent(
          '尚未配置 AI 密钥 · 无法推演',
          '天命以 AI 为引擎推演世界，没有 API 密钥便无从落子——这不是卡顿或故障。确认后将为你打开「设置」，在「API 连接」处填入 服务商 / Key / 地址 / 模型 即可开始。需要获取密钥的指引，可在主页「帮助」查看「如何配置 AI 密钥」。',
          function(){ try { if (typeof openSettings === 'function') openSettings(); } catch(_){} }
        );
      } else if (typeof alert === 'function') {
        alert('尚未配置 AI 密钥，无法过回合。请在「典章·游戏设置」的「API 连接」中填入密钥。');
      }
    } catch(_noKeyE){ try { console.warn('[endTurn] no-key notice failed', _noKeyE); } catch(_){} }
    return; // 中止过回合，不进入空转
  }
  try {
    if (typeof window !== 'undefined' && window.TM && TM.FactionNpcInTurnDriver && TM.FactionNpcInTurnDriver.cancelInTurnTimers) {
      TM.FactionNpcInTurnDriver.cancelInTurnTimers();
    }
  } catch(_npcInTurnCancelE) {
    try { console.warn('[endTurn] NPC in-turn timer cancel failed', _npcInTurnCancelE); } catch(_){}
  }
  await _runPreSubmitPartyClassCalibration();
  _showPostTurnCourtPromptAndStartEndTurn();
}

async function _endTurnCore(){
  // [slice 7c·2026-05-08] pipeline 是 endturn 唯一执行路径
  // P.flags.useNewPipeline 已废止·观察者 try/catch fallback 已删·step.onError 接管错误
  // pipeline.run 必须在 'await EndTurnHooks.execute(before)' 之后(slice 5 落地)
  //   原因：systems step 等需要看到 before-hooks 的 GM mutation (钩子 1 mutate officeTree·钩子 2 push jishiRecords)
  // 见 web/docs/endturn-data-flow.md
  var _obsCtx = null;
  try{
  // 兼容新旧UI：老诏令面板按钮是btn-end，新UI右侧按钮是btn-end-turn
  var btn=_$("btn-end")||_$("btn-end-turn");
  if(GM.busy)return;
  GM.busy=true;
  GM._endTurnBusy=true;
  if(btn){ btn.textContent="\u63A8\u6F14\u4E2D...";btn.style.opacity="0.6"; }
  // 后朝中不用 showLoading（会遮挡朝会）
  if (!(GM._pendingShijiModal && GM._pendingShijiModal.courtDone === false)) {
    showLoading("\u65F6\u79FB\u4E8B\u53BB",10);
  }

  // 上回合 post-turn 任务改到 AI prompt 构造前兜底等待。
  // 入口不硬等，让 prep / 存档快照 / plan-prefetch 与上回合后台债务重叠。

  // ★ 过回合前自动存档·防 AI 长推演崩溃丢失本回合操作(诏令/奏疏批复/对话/调动)
  // 写入独立 IDB key 'pre_endturn'·与正常 autosave/slot_0 分离·不污染案卷目录
  // 写入 localStorage 标记 tm_pre_endturn_mark·页面刷新后可检测
  // 异步·失败静默·不阻塞推演
  try {
    if (typeof TM_SaveDB !== 'undefined' && typeof _prepareGMForSave === 'function') {
      _prepareGMForSave();
      var _preState = { GM: deepClone(GM), P: _tmStripAiKeyInPlace(deepClone(P)) };
      var _scPre = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
      var _preMeta = {
        name: '过回合前·' + (typeof getTSText === 'function' ? getTSText(GM.turn) : 'T' + GM.turn),
        type: 'pre_endturn',
        turn: GM.turn,
        scenarioName: _scPre ? _scPre.name : '',
        eraName: GM.eraName || '',
        savedAt: Date.now()
      };
      // 先同步写 localStorage mark·再异步写 IDB·防止 IDB 在途崩溃丢失恢复信号
      // mark 存在但 IDB 缺失 → 恢复弹窗已有 fallback("过回合前快照已损坏·尝试加载常规自动存档")
      try {
        localStorage.setItem('tm_pre_endturn_mark', JSON.stringify({
          turn: GM.turn, timestamp: Date.now(),
          scenarioName: _preMeta.scenarioName,
          eraName: _preMeta.eraName,
          saveName: GM.saveName || ''
        }));
      } catch(_lsE){try{window.TM&&TM.errors&&TM.errors.captureSilent(_lsE,'pre_endturn ls mark');}catch(_){}}
      TM_SaveDB.save('pre_endturn', _preState, _preMeta).catch(function(e){
        (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'PreEndTurnSave]') : console.warn('[PreEndTurnSave]', e);
      });
    }
  } catch(_psE) {
    (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_psE, 'PreEndTurnSave outer') : console.warn('[PreEndTurnSave outer]', _psE);
  }

  await EndTurnHooks.execute('before');

  // [slice 7b·2026-05-08] pipeline 是 endturn 唯一执行路径·legacy 6 phase 块全删
  // 失败 throw 至外层 catch (line ~510)·toast 错误·清 busy
  // observer try/catch fallback 已删·原 catch 是 legacy 兜底·legacy 已不存在
  if (!(window.TM && TM.Endturn && TM.Endturn.Pipeline)) {
    throw new Error('[endTurn] TM.Endturn.Pipeline missing — boot order broken?');
  }
  _obsCtx = TM.Endturn.Pipeline.buildCtx();
  await TM.Endturn.Pipeline.run(_obsCtx);

  // [slice 7b·2026-05-08] 6 phase legacy 块全删·下游只剩 pipeline 不接的 5.3+ tail
  // pipeline 已完成: 0-A/0-0/0-0b/0-0c/0-0commit/0-1/1.7 (prep) + 1.75/1.8 (plan-prefetch) + 2 (ai)
  //                 + 2.5/2.6 (post-ai-edict) + 3/3.5 (systems) + 4/4.5/4.6/5 (render-and-finalize)
  // 失败 → executor 按 step.onError = abort 抛出 → 外 catch 接

  // Phase 5.3: 跨回合记忆摘要（1.3）——每5回合压缩近期事件为200字摘要
  (function _aiMemoryCompress() {
    var interval = 5; // 每5回合压缩一次
    if (GM.turn % interval !== 0 || !P.ai || !P.ai.key) return;
    if (!GM._aiMemorySummaries) GM._aiMemorySummaries = [];

    // 收集近5回合的关键事件
    var _recentEvents = (GM.evtLog || []).filter(function(e) {
      return e.turn > GM.turn - interval;
    }).slice(-30);
    if (_recentEvents.length < 3) return;

    var _evtText = _recentEvents.map(function(e) { return '[' + e.type + '] ' + e.text; }).join('\n');
    var _prevSummary = GM._aiMemorySummaries.length > 0 ? GM._aiMemorySummaries[GM._aiMemorySummaries.length - 1].summary : '';

    // 异步压缩（不阻塞）
    var _compressPrompt = '请将以下游戏事件压缩为200字以内的摘要，格式：「第X-Y回合概要：[关键事件]、[势力变动]、[未解决冲突]、[伏笔]」\n\n'
      + '回合范围：第' + (GM.turn - interval + 1) + '-' + GM.turn + '回合\n'
      + (_prevSummary ? '上一段摘要：' + _prevSummary.slice(-100) + '\n\n' : '')
      + '事件列表：\n' + _evtText + '\n\n请直接输出摘要正文：';

    // 使用callAI而非raw fetch——自动适配所有模型（OpenAI/Anthropic/本地）
    // 后台摘要不应抢占玩家正在等待的前台推演通道。
    if (typeof callAI === 'function') {
      callAI(_compressPrompt, 500, null, 'primary', {
        priority: 'background',
        timeoutMs: 45000,
        maxRetries: 1
      }).then(function(txt) {
        if (txt && txt.length > 30) {
          GM._aiMemorySummaries.push({ turn: GM.turn, summary: txt.substring(0, 400) });
          if (GM._aiMemorySummaries.length > 10) GM._aiMemorySummaries = GM._aiMemorySummaries.slice(-10);
          DebugLog.log('ai', '记忆摘要生成完成:', txt.length, '字');
        }
      }).catch(function(err) { DebugLog.warn('ai', '记忆摘要生成失败:', err.message); });
    }
  })();

  // 1.6: 记录回合token消耗·G4 预算检查
  if (typeof TokenUsageTracker !== 'undefined') {
    var _turnTokens = TokenUsageTracker.getTurnUsage();
    if (_turnTokens > 0) DebugLog.log('ai', '本回合token消耗:', _turnTokens);
    // G4·Token 预算预警：若玩家设了单回合预算且超支·给出建议
    if (P.conf.turnTokenBudget && P.conf.turnTokenBudget > 0 && _turnTokens > P.conf.turnTokenBudget) {
      var _ratio = (_turnTokens / P.conf.turnTokenBudget).toFixed(1);
      if (typeof toast === 'function') toast('⚠ 本回合用 ' + _turnTokens.toLocaleString() + ' tokens·超预算 ' + _ratio + '×·建议在设置启用降档模式或减少 NPC 数');
      if (typeof addEB === 'function') addEB('AI预算', '超支 ' + _ratio + '×·考虑压缩 prompt / 换便宜模型 / 减少 NPC');
    }
  }

  // Phase 5.4: 月度纪事异步生成（3.2）
  // 用 turnsForDuration('month') 判断月边界，大回合剧本(>30天/回合)跳过月度层
  (function _monthlyChronicle() {
    var _monthTurns = (typeof turnsForDuration === 'function') ? turnsForDuration('month') : 0;
    var _dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    // 月度层仅在一回合≤30天时有意义；大回合(季度/年度)跳过月度层直接走年度
    if (_monthTurns < 1 || _dpv >= 90 || !P.ai || !P.ai.key) return;
    if (GM.turn % _monthTurns !== 0) return;

    var _mCfg = (P.mechanicsConfig && P.mechanicsConfig.chronicleConfig) || {};
    // 【降本·2026-06-19】月度纪事为孤儿 LLM 调用——GM.monthlyChronicles 全代码库零消费端
    // (仅本函数自读续连贯 + save-lifecycle 存档·无 UI/无记忆/无 prompt 注入)·默认停发省每月一次后台调用·
    // 年度正史走 ChronicleSystem 独立链路(monthDrafts·非 LLM)不受影响·剧本可设 chronicleConfig.monthlyEnabled=true 显式恢复。
    if (!_mCfg.monthlyEnabled) return;
    var _wordLimit = _mCfg.monthlyWordLimit || 200;
    var _narrator = _mCfg.narratorRole || '史官';
    var _style = (P.conf && P.conf.style) || '';

    // 收集本月事件
    var _monthEvents = (GM.evtLog || []).filter(function(e) {
      return e.turn > GM.turn - _monthTurns && e.turn <= GM.turn;
    });
    if (_monthEvents.length === 0) return;

    var _monthSummary = _monthEvents.map(function(e) {
      return '[' + e.type + '] ' + e.text;
    }).join('\n');

    // 上月纪事（连贯性）
    var _prevMonthly = '';
    if (GM.monthlyChronicles && GM.monthlyChronicles.length > 0) {
      _prevMonthly = GM.monthlyChronicles[GM.monthlyChronicles.length - 1].text || '';
      _prevMonthly = _prevMonthly.slice(-100);
    }

    // 异步生成（不阻塞回合）
    var _mPrompt = '你是' + (P.dynasty || '') + _narrator + '。'
      + (_style ? '以' + _style + '风格，' : '')
      + '请根据以下本月事件，撰写' + _wordLimit + '字以内的月度纪事。\n\n'
      + '【本月事件】\n' + _monthSummary + '\n';
    if (_prevMonthly) _mPrompt += '\n【上月纪事末尾】' + _prevMonthly + '\n';
    _mPrompt += '\n请直接输出纪事正文（不要JSON包裹）：';

    // 异步调用，不await——不阻塞后续逻辑；必须走共享 AI 队列，避免绕过并发控制。
    if (typeof callAIMessages !== 'function') return;
    callAIMessages([
      { role: 'system', content: '你是' + (P.dynasty || '') + _narrator },
      { role: 'user', content: _mPrompt }
    ], Math.min(800, _wordLimit * 3), null, 'primary', {
      priority: 'background',
      timeoutMs: 45000,
      maxRetries: 1
    }).then(function(txt) {
      if (txt && txt.length > 20) {
        if (!GM.monthlyChronicles) GM.monthlyChronicles = [];
        GM.monthlyChronicles.push({
          turn: GM.turn,
          date: (typeof getTSText === 'function') ? getTSText(GM.turn) : 'T' + GM.turn,
          text: txt.substring(0, _wordLimit * 2),
          generatedAt: Date.now()
        });
        // 保留最近24个月
        if (GM.monthlyChronicles.length > 24) GM.monthlyChronicles = GM.monthlyChronicles.slice(-24);
        DebugLog.log('settlement', '月度纪事生成完成:', txt.length, '字');
      }
    }).catch(function(err) {
      // 失败fallback：用事件日志直接拼接
      DebugLog.warn('settlement', '月度纪事AI生成失败，使用事件拼接:', err.message);
      if (!GM.monthlyChronicles) GM.monthlyChronicles = [];
      var fallbackText = _monthEvents.map(function(e) { return e.text; }).join('\u3002') + '\u3002';
      GM.monthlyChronicles.push({
        turn: GM.turn,
        date: (typeof getTSText === 'function') ? getTSText(GM.turn) : 'T' + GM.turn,
        text: fallbackText.substring(0, _wordLimit),
        generatedAt: Date.now(),
        isFallback: true
      });
    });
  })();

  // Phase 5.5: 年度汇总（跨年时触发）——统一委托给 ChronicleSystem
  if (typeof isYearBoundary === 'function' && isYearBoundary()) {
    // 重置事件年度计数
    if (typeof EventConstraintSystem !== 'undefined') EventConstraintSystem.resetYearlyCounts();
    // 年度编年史由 ChronicleSystem._tryGenerateYearChronicle 异步生成（含6.1伏笔/6.5摘要整合）
    // 不在此处重复生成——ChronicleSystem.addMonthDraft 的跨年检测会自动触发
    _dbg('[Chronicle] \u8DE8\u5E74\u68C0\u6D4B\uFF0C\u5E74\u5EA6\u7F16\u5E74\u53F2\u7531ChronicleSystem\u5F02\u6B65\u751F\u6210');
  }

  // 清理回合临时上下文
  delete GM._turnContext;
  delete GM._turnTyrantActivities;
  if (!GM._postTurnJobs || !Array.isArray(GM._postTurnJobs.pending) || GM._postTurnJobs.pending.length === 0) {
    delete GM._turnAiResults;
  }

  // 玩家角色死亡 → 显示游戏结束画面
  if (GM._playerDead) {
    GM.busy = false;
    GM.running = false;
    var _pdName = P.playerInfo ? P.playerInfo.characterName : '玩家';
    var _pdReason = GM._playerDeathReason || '不明原因';
    var _pdHtml = '<div style="text-align:center;padding:3rem 2rem;">';
    _pdHtml += '<div style="font-size:2.5rem;color:var(--red,#c44);margin-bottom:1rem;">天命已尽</div>';
    _pdHtml += '<div style="font-size:1.1rem;color:var(--txt-s);margin-bottom:0.5rem;">' + escHtml(_pdName) + ' 薨逝</div>';
    _pdHtml += '<div style="font-size:0.9rem;color:var(--txt-d);margin-bottom:2rem;">' + escHtml(_pdReason) + '</div>';
    _pdHtml += '<div style="font-size:0.85rem;color:var(--txt-d);margin-bottom:2rem;">历经 ' + GM.turn + ' 回合 · ' + getTSText(GM.turn) + '</div>';
    _pdHtml += '<div style="display:flex;gap:1rem;justify-content:center;">';
    _pdHtml += '<button class="bt bp" onclick="doSaveGame()">保存存档</button>';
    _pdHtml += '<button class="bt bs" onclick="showMain()">返回主菜单</button>';
    _pdHtml += '</div></div>';
    showTurnResult(_pdHtml);
    delete GM._playerDead;
    delete GM._playerDeathReason;
    return;
  }

  // 建筑工役 tick（2026-06-12·确定性步·每回合恰一次）：在建递减→完工把效果写进 economyBase/fortLevel/民心叶子，
  // 维护费扣地方库银。须在 final aggregate 之前——完工改的叶子当回合即被聚合。
  try { if (window.TM && TM.BuildingWorks && typeof TM.BuildingWorks.tick === 'function') TM.BuildingWorks.tick(GM, P); } catch(_bwTickE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_bwTickE, 'endTurn] building works tick') : console.warn('[endTurn] building works tick', _bwTickE); }

  // S3a·人才范式渗透引擎 tick：须在 BuildingWorks.tick 之后（本回合完工的新式学校已注册人才源），多瓶颈漏斗推进一回合。
  // 瓶颈 ctx 由 tm-talent-bottlenecks 据全国真实 economyBase/政区/驻军实算（没产业=没岗位=毕业即失业）。flag talentCohortEnabled 默认关 → no-op。
  try {
    if (window.TM && TM.TalentCohorts && typeof TM.TalentCohorts.tick === 'function' && TM.TalentCohorts.enabled(P)) {
      var _talentCtx = (TM.TalentBottlenecks && typeof TM.TalentBottlenecks.buildCtx === 'function') ? TM.TalentBottlenecks.buildCtx(GM, P) : null;
      TM.TalentCohorts.tick(GM, P, _talentCtx);
      // S5·全局阻力：渗透反弹 → 御案时政政治事件(请罢新学/失业学潮) + 临界旧式瓦解 + 写 _lastBacklash 供动态 room
      if (TM.TalentBacklash && typeof TM.TalentBacklash.tick === 'function') TM.TalentBacklash.tick(GM, P, _talentCtx);
    }
  } catch(_tcTickE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_tcTickE, 'endTurn] talent cohorts tick') : console.warn('[endTurn] talent cohorts tick', _tcTickE); }

  // 地块状态 tick（2026-06-12·确定性步）：过期清除 + 状态民心摊叶 + 繁荣度缓变。
  // 须在 BuildingWorks.tick 之后（完工状态当回合生效）、final aggregate 之前。
  try { if (window.TM && TM.RegionStatus && typeof TM.RegionStatus.tick === 'function') TM.RegionStatus.tick(GM, P); } catch(_rsTickE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_rsTickE, 'endTurn] region status tick') : console.warn('[endTurn] region status tick', _rsTickE); }

  // 字段活化 tick（2026-06-12·S6·确定性步）：重税之地民心叶账缓跌（地板 25）+ _fieldLedger 近账。
  // 同样须在 final aggregate 之前——叶子变更当回合即被聚合。
  try { if (window.TM && TM.FieldPipes && typeof TM.FieldPipes.tick === 'function') TM.FieldPipes.tick(GM, P); } catch(_fpTickE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_fpTickE, 'endTurn] field pipelines tick') : console.warn('[endTurn] field pipelines tick', _fpTickE); }

  // 社会层地基 tick（2026-06-12·确定性步）：阶层结构基线缓变回归 + 议程引擎消长 + 党派双账合流。
  // 须在 RegionStatus/FieldPipes 之后（要读灾域/税负实况）、final aggregate 之前。
  try { if (window.TM && TM.SocialFoundation && typeof TM.SocialFoundation.tick === 'function') TM.SocialFoundation.tick(GM, P); } catch(_sfTickE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_sfTickE, 'endTurn] social foundation tick') : console.warn('[endTurn] social foundation tick', _sfTickE); }

  // 人力/徭役农政 tick（R2·2026-06-16·确定性步）：劳动力分流→双边际(在耕/地力)→粮产，写叶子 alloc + GM.renli 派生。
  // 须在 SocialFoundation 之后、final aggregate 之前。R2 只写 alloc/派生·不动 ding/mouths·暂无消费方读 alloc（良性休眠）。
  try { if (window.TM && TM.Renli && typeof TM.Renli.endturnTick === 'function') TM.Renli.endturnTick(GM, P); } catch(_rlTickE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_rlTickE, 'endTurn] renli tick') : console.warn('[endTurn] renli tick', _rlTickE); }
  // 官制占位·久悬补缺 tick(2026-06-18·确定性步)：冷门空占位挂太久→引擎铨选虚拟官员补上(flag useOfficeFallback·前12回合给AI office_spawn机会)。
  try { if (window.TM && TM.OfficeFallback && typeof TM.OfficeFallback.tick === 'function') TM.OfficeFallback.tick(GM, P); } catch(_ofTickE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_ofTickE, 'endTurn] office fallback tick') : console.warn('[endTurn] office fallback tick', _ofTickE); }

  // 回合结束前最后一次聚合：确保 七变量(national) 严格等于 各区划叶子之和
  // （因 AI 推演/各 engine.tick 都可能修改 division.population.mouths，需重新累计）
  try { if (typeof IntegrationBridge !== 'undefined' && typeof IntegrationBridge.aggregateRegionsToVariables === 'function') IntegrationBridge.aggregateRegionsToVariables(); } catch(_aggFinalE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_aggFinalE, 'endTurn] final aggregate') : console.warn('[endTurn] final aggregate', _aggFinalE); }

  // 回合末·按统帅死活校正各军主帅引用：摘掉挂着死人(赐死/AI死/战死各路)的帅、留空缺待补任。须在赐死(applyEdictActions)+AI死(applyCharacterDeaths)都跑完之后
  try { if (typeof TM !== 'undefined' && TM.AIChange && TM.AIChange.Army && typeof TM.AIChange.Army.reconcileArmyCommanders === 'function') TM.AIChange.Army.reconcileArmyCommanders(); } catch(_recACE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_recACE, 'endTurn] reconcileArmyCommanders') : console.warn('[endTurn] reconcileArmyCommanders', _recACE); }

  // 亡国终局（2026-07-02）：消费民变改朝/权臣篡位/起义颠覆的终局信号（此前只写不读）→「天命已绝」终局屏。
  // 软终局：置于全部结算 tick 之后不打断管线，关屏后可继续观史/存档。新鲜度护栏在 _consumeDynastyEndSignal 内。
  try {
    var _dynEnd = (typeof _consumeDynastyEndSignal === 'function') ? _consumeDynastyEndSignal() : null;
    if (_dynEnd && typeof _showEndgameScreen === 'function') setTimeout(function(){ _showEndgameScreen('defeat', _dynEnd); }, 600);
  } catch(_dynE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_dynE, 'endTurn] dynasty endgame') : console.warn('[endTurn] dynasty endgame', _dynE); }

  GM.busy=false;
  GM._endTurnBusy=false;
  } catch (error) {
    console.error('endTurn error:', error);
    // 失败态人话化（2026-07-02）：认得出的 AI 类故障给「哪坏了+去哪修」，认不出回退原文
    var _ehuman = (typeof _tmAiErrHuman === 'function') ? _tmAiErrHuman(error) : null;
    toast(_ehuman ? ('回合中断 · ' + _ehuman) : ('回合处理出错: ' + error.message));
    GM.busy = false;
    GM._endTurnBusy=false;
    var btn = _$("btn-end")||_$("btn-end-turn");
    if (btn) {
      btn.textContent = "\u9759\u5F85\u65F6\u53D8";
      btn.style.opacity = "1";
    }
    hideLoading();
  }
}

// ══════ 史记+起居注列表渲染已迁移到 tm-shiji-qiju-ui.js (R97) ══════
// - var _sjl*/_qiju* 状态变量
// - renderShijiList / _sjlExtractDeltas / _sjlExport / _sjlDownload
// - _qijuNormalize / _qijuCatClass / _qijuCatKey / _qijuHighlight
// - renderQiju / _qijuAnnotate / _qijuZoom / _qijuExport / _qijuDownload
// ═══════════════════════════════════════════════════════

// ============================================================
//  Part 3：高级系统
// ============================================================

// ══════ 侧栏面板 UI 已迁移到 tm-sidebar-ui.js (R99) ══════
// - enterGame:after hook 重渲染 renderSidePanels
// - renderGameTech / unlockTech / renderGameCivic / adoptCivic
// - openClassDetailPanel / openPartyDetailPanel / openMilitaryDetailPanel
// - renderSidePanels (侧栏主渲染)
// - openPalacePanel + 6 _palace* 辅助
// ═══════════════════════════════════════════════════════

// ============================================================
//  注册 endTurn 钩子（替代原有的包装链）
// ============================================================

// 钩子 1: 官制消耗（原 _origEndTurn）
EndTurnHooks.register('before', function() {
  if(P.officeConfig&&P.officeConfig.costVariables&&P.officeConfig.costVariables.length>0&&GM.officeTree){
    var td=0,to=0;
    function countOff(tree){tree.forEach(function(d){td++;to+=(d.positions||[]).filter(function(p){return p.holder;}).length;if(d.subs)countOff(d.subs);});}
    countOff(GM.officeTree);
    var shortfall=[];
    P.officeConfig.costVariables.forEach(function(cv){
      var cost=(cv.perDept||0)*td+(cv.perOfficial||0)*to;
      if(GM.vars[cv.variable]){
        GM.vars[cv.variable].value=clamp(GM.vars[cv.variable].value-cost,GM.vars[cv.variable].min,GM.vars[cv.variable].max);
        if(GM.vars[cv.variable].value<=GM.vars[cv.variable].min+5)shortfall.push(cv.variable);
      }
    });
    if(shortfall.length>0)addEB("官制危机",shortfall.join(",")+"不足");
  }
}, '官制消耗');

// 钩子 2: 奏议批复（原 _origEndTurn2）
EndTurnHooks.register('before', function() {
  if(GM.memorials&&GM.memorials.length>0){
    GM.memorials.forEach(function(m){
      var statusText=m.status==="approved"?"准奏":m.status==="rejected"?"驳回":"未批复";
      var exists=GM.jishiRecords.find(function(r){return r.turn===GM.turn&&r.char===m.from&&r.playerSaid&&r.playerSaid.indexOf("奏疏")>=0;});
      if(!exists)GM.jishiRecords.push({turn:GM.turn,char:m.from,playerSaid:"\u594F\u758F("+m.type+"): "+m.content,npcSaid:"\u6279\u590D: "+statusText+(m.reply?" | "+m.reply:""),mode:'memorial'});   // \u26052026-07-01 O2\u00B7\u6253 mode:memorial\u00B7\u4EE4 O1 \u95EE\u5BF9\u6BB5\u8FC7\u6EE4\u6321\u6389(\u594F\u758F\u5DF2\u6709:581\u4E13\u6BB5\u00B7\u53BB\u53CC\u6CE8\u5165)\u00B7\u5B9E\u5F55\u4ECD\u4FDD\u7559\u6B64\u6761
    });
    renderJishi();
  }
}, '奏议批复');

// 钩子 6.6: AI 上下文注入 - 玩家总结规则(summaryRule 唤醒)
// [slice 3b.3·2026-05-07 PoC] 迁 fragment·删 _origPromptSumRule before/after 配对
// 原 before mutate P.ai.prompt + after restore·新 fragment 仅返回 text·prompt-builder 显式 join
(function(){
  var root = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
  if (!root) return;
  root.TM = root.TM || {};
  var TMNS = root.TM;
  function _arr(v) { return Array.isArray(v) ? v : []; }
  function _txt(v, max) {
    if (v == null) return '';
    var s = (typeof v === 'string') ? v : (function(){ try { return JSON.stringify(v); } catch(_) { return String(v); } })();
    s = s.replace(/\s+/g, ' ').trim();
    return max && s.length > max ? s.slice(0, max) + '...' : s;
  }
  function _norm(v) {
    return _txt(v, 80).replace(/[（(].*?[）)]/g, '').replace(/\s+/g, '').toLowerCase();
  }
  function _aiKeys(f) {
    var keys = ['aiPersonality','aiDecisionWeights','aiConditionalBehaviors','aiImmersionHooks','aiStrategy','aiAggressionProfile','aiBehaviorHints','policyHooks','strategicPriorities','aggressionProfile','decisionWeights','conditionalBehaviors'];
    var out = {};
    keys.forEach(function(k){ if (f && f[k] != null && f[k] !== '') out[k] = f[k]; });
    return out;
  }
  function _stateKeys(f) {
    var keys = ['id','name','type','leader','goal','shortGoal','resources','culture','mainstream','territory','territories','controlledDivisions','strength','economy','militaryStrength','attitude','playerRelation','cohesion','relations','capital','color'];
    var out = {};
    keys.forEach(function(k){ if (f && f[k] != null && f[k] !== '') out[k] = f[k]; });
    return out;
  }
  function _playerNames(p) {
    var out = [];
    try {
      if (p && p.playerInfo) {
        ['factionName','faction','country','state'].forEach(function(k){ if (p.playerInfo[k]) out.push(String(p.playerInfo[k])); });
      }
    } catch(_) {}
    return out.map(_norm).filter(Boolean);
  }
  function _isPlayerFaction(f, p) {
    if (!f) return false;
    if (f.player || f.isPlayer || f.controlledByPlayer) return true;
    var names = _playerNames(p);
    var n = _norm(f.name || f.id || f.faction || f.title);
    return !!(n && names.indexOf(n) >= 0);
  }
  function _addFaction(map, raw, source, p, opts) {
    if (!raw || typeof raw !== 'object') return;
    if (opts && opts.excludePlayer !== false && _isPlayerFaction(raw, p)) return;
    var name = raw.name || raw.title || raw.faction || raw.id;
    if (!name) return;
    var idKey = _norm(raw.id);
    var nameKey = _norm(name);
    var key = idKey || nameKey;
    Object.keys(map).some(function(k) {
      var cur0 = map[k];
      if (!cur0) return false;
      var curId = _norm(cur0.id);
      var curName = _norm(cur0.name);
      if ((idKey && (curId === idKey || curName === idKey)) || (nameKey && (curName === nameKey || curId === nameKey))) {
        key = k;
        return true;
      }
      return false;
    });
    if (!key) return;
    var cur = map[key];
    if (!cur) {
      cur = { key: key, id: raw.id || '', name: String(name), sources: [], ai: {}, state: {}, rawRefs: [] };
      map[key] = cur;
    }
    cur.sources.push(source || 'unknown');
    cur.rawRefs.push(raw);
    Object.assign(cur.state, _stateKeys(raw));
    Object.assign(cur.ai, _aiKeys(raw));
    if (!cur.id && raw.id) cur.id = raw.id;
    if ((!cur.name || cur.name === cur.id) && name) cur.name = String(name);
  }
  function _scenarioRefs(gm, p) {
    var refs = [];
    [gm && gm.scenario, gm && gm.currentScenario, p && p.scenario, p && p.currentScenario, p && p.activeScenario].forEach(function(x){ if (x && typeof x === 'object') refs.push(x); });
    try {
      var sid = (gm && (gm.sid || gm.scenarioId)) || (p && (p.sid || p.scenarioId));
      if (sid && typeof root.findScenarioById === 'function') {
        var sc = root.findScenarioById(sid);
        if (sc) refs.push(sc);
      } else if (sid && typeof findScenarioById === 'function') {
        var sc2 = findScenarioById(sid);
        if (sc2) refs.push(sc2);
      }
    } catch(_) {}
    return refs;
  }
  function collectFactionContexts(gm, p, opts) {
    gm = gm || root.GM || {};
    p = p || root.P || {};
    opts = opts || {};
    var map = {};
    _arr(gm.facs).forEach(function(f){ _addFaction(map, f, 'GM.facs', p, opts); });
    _arr(gm.factions).forEach(function(f){ _addFaction(map, f, 'GM.factions', p, opts); });
    _arr(gm.externalForces).forEach(function(f){ _addFaction(map, f, 'GM.externalForces', p, opts); });
    _arr(gm.extForces).forEach(function(f){ _addFaction(map, f, 'GM.extForces', p, opts); });
    _arr(p.factions).forEach(function(f){ _addFaction(map, f, 'P.factions', p, opts); });
    _arr(p.externalForces).forEach(function(f){ _addFaction(map, f, 'P.externalForces', p, opts); });
    _scenarioRefs(gm, p).forEach(function(sc, i) {
      _arr(sc.factions).forEach(function(f){ _addFaction(map, f, 'scenario[' + i + '].factions', p, opts); });
      _arr(sc.externalForces).forEach(function(f){ _addFaction(map, f, 'scenario[' + i + '].externalForces', p, opts); });
      _arr(sc.extForces).forEach(function(f){ _addFaction(map, f, 'scenario[' + i + '].extForces', p, opts); });
    });
    var list = Object.keys(map).map(function(k){ return map[k]; });
    list.forEach(function(x){ x.hasAi = Object.keys(x.ai || {}).length > 0; x.sources = Array.from(new Set(x.sources)); });
    list.sort(function(a, b) {
      if (a.hasAi !== b.hasAi) return a.hasAi ? -1 : 1;
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN');
    });
    return opts.limit ? list.slice(0, opts.limit) : list;
  }
  function _fmtFaction(x) {
    return '- ' + (x.name || x.id || 'faction') + (x.id ? ' [' + x.id + ']' : '')
      + ' state=' + _txt(x.state, 420)
      + ' ai=' + _txt(x.ai, 700)
      + ' sources=' + x.sources.join('/');
  }
  function formatForPrompt(gm, p, opts) {
    opts = opts || {};
    var list = collectFactionContexts(gm, p, { limit: opts.limit || 12, excludePlayer: opts.excludePlayer !== false });
    var aiList = list.filter(function(x){ return x.hasAi; });
    if (!aiList.length) return null;
    var lines = [];
    lines.push('\n\n=== Faction AI Mainloop Bridge / 势力AI接入主推演 ===');
    lines.push('这些 aiPersonality / aiDecisionWeights / aiConditionalBehaviors / aiStrategy 不是平行设定。本回合 SC1、SC1c、SC16 必须把它们与当前国力、地盘、财政、军力、外交关系共同判断；若因此产生行动，必须落到正常结构化字段，而不是只写设定。');
    lines.push('落地字段优先级：faction_events、faction_interactions_advanced、faction_relation_changes、faction_changes、army_changes、fiscal_adjustments、population_adjustments、central_local_actions、province/admin/region 相关字段。');
    lines.push('另外输出 faction_ai_outcomes 数组，用作主循环桥账本。字段建议：{faction,factionId,intent,action,target,motive,result,publicSummary,posterityComment,recordTarget,structuralLinks}。recordTarget 可为 shizhengji/houren/both/none；公开政事写 publicSummary，适合场景的民间/士林/边报余波写 posterityComment。');
    lines.push('不得把势力AI写成孤立旁白：若金、西夏、蒙古、大越等势力因 AI 倾向行动，必须让主推演数值/关系/军政账本受到影响；若主推演局势改变，也必须反过来改变其 intent/action。');
    aiList.forEach(function(x){ lines.push(_fmtFaction(x)); });
    return lines.join('\n');
  }
  function normalizeOutcomes(result) {
    if (!result || typeof result !== 'object') return [];
    var raw = result.faction_ai_outcomes || result.factionAiOutcomes || result.faction_ai_results || result.factionAiResults || [];
    if (!Array.isArray(raw)) raw = raw ? [raw] : [];
    return raw.filter(function(x){ return x && typeof x === 'object'; }).map(function(x) {
      return {
        faction: x.faction || x.name || x.actor || x.from || '',
        factionId: x.factionId || x.id || '',
        intent: x.intent || x.priority || x.goal || '',
        action: x.action || x.move || x.event || '',
        target: x.target || x.to || '',
        motive: x.motive || x.reason || '',
        result: x.result || x.outcome || '',
        publicSummary: x.publicSummary || x.shizhengji || x.public || '',
        posterityComment: x.posterityComment || x.houren || x.houren_xishuo || x.sceneSeed || '',
        recordTarget: String(x.recordTarget || x.record || '').toLowerCase(),
        structuralLinks: Array.isArray(x.structuralLinks) ? x.structuralLinks : (x.structuralLink ? [x.structuralLink] : [])
      };
    }).filter(function(x){ return x.faction || x.intent || x.action || x.result || x.publicSummary || x.posterityComment; });
  }
  function _findFaction(gm, rec) {
    var idn = _norm(rec.factionId);
    var fn = _norm(rec.faction);
    var all = [].concat(_arr(gm && gm.facs), _arr(gm && gm.factions), _arr(gm && gm.externalForces), _arr(gm && gm.extForces));
    for (var i = 0; i < all.length; i++) {
      var f = all[i];
      if (!f) continue;
      if ((idn && _norm(f.id) === idn) || (fn && _norm(f.name || f.title || f.faction || f.id) === fn)) return f;
    }
    return null;
  }
  function applyTurnOutcomes(gm, result, opts) {
    gm = gm || root.GM || {};
    opts = opts || {};
    var outcomes = normalizeOutcomes(result);
    if (!outcomes.length) return { outcomes: [], shizhengjiAppend: '', hourenAppend: '' };
    if (!Array.isArray(gm._factionAiMainloopLedger)) gm._factionAiMainloopLedger = [];
    if (!Array.isArray(gm._factionUndercurrents)) gm._factionUndercurrents = [];
    if (!Array.isArray(gm._turnReport)) gm._turnReport = [];
    var turn = gm.turn || 0;
    var shizheng = [];
    var houren = [];
    outcomes.forEach(function(o) {
      var rec = Object.assign({ turn: turn, source: opts.source || 'faction-ai-mainloop' }, o);
      gm._factionAiMainloopLedger.push(rec);
      var fac = _findFaction(gm, rec);
      if (fac) {
        if (!Array.isArray(fac._aiMainloopHistory)) fac._aiMainloopHistory = [];
        fac._aiMainloopHistory.push(rec);
        if (fac._aiMainloopHistory.length > 24) fac._aiMainloopHistory = fac._aiMainloopHistory.slice(-24);
      }
      var summary = rec.publicSummary || rec.result || rec.action || rec.intent;
      if (summary) {
        gm._turnReport.push({ type: 'faction_ai', faction: rec.faction, factionId: rec.factionId, action: rec.action, target: rec.target, result: rec.result, text: summary, turn: turn, source: rec.source });
        gm._factionUndercurrents.push({ faction: rec.faction || rec.factionId || '势力', situation: summary, nextMove: rec.intent || rec.action || '', source: rec.source, turn: turn });
        try { if (typeof addEB === 'function') addEB('势力AI', (rec.faction ? rec.faction + '：' : '') + _txt(summary, 80)); } catch(_) {}
      }
      var rt = rec.recordTarget || '';
      if ((rt === 'shizhengji' || rt === 'both' || (!rt && rec.publicSummary)) && rec.publicSummary) shizheng.push(rec.publicSummary);
      if ((rt === 'houren' || rt === 'both' || (!rt && rec.posterityComment)) && rec.posterityComment) houren.push(rec.posterityComment);
      try {
        if (rec.publicSummary && root.PhaseD && typeof root.PhaseD.addFengwen === 'function') {
          root.PhaseD.addFengwen({ type: '势力', text: rec.publicSummary, actors: [rec.faction].filter(Boolean), source: '势力AI', credibility: 0.72, turn: turn });
        }
      } catch(_) {}
    });
    if (gm._factionAiMainloopLedger.length > 120) gm._factionAiMainloopLedger = gm._factionAiMainloopLedger.slice(-120);
    if (gm._factionUndercurrents.length > 80) gm._factionUndercurrents = gm._factionUndercurrents.slice(-80);
    return {
      outcomes: outcomes,
      shizhengjiAppend: shizheng.length ? '【势力AI回响】' + shizheng.join('；') : '',
      hourenAppend: houren.length ? '【势力余波】' + houren.join('；') : ''
    };
  }
  function formatRecentOutcomesForNarrative(gm, opts) {
    gm = gm || root.GM || {};
    opts = opts || {};
    var list = _arr(gm._factionAiMainloopLedger).slice(-(opts.limit || 8));
    if (!list.length) return '';
    var lines = ['\n【势力AI主循环回响·可入时政记/后人戏说】'];
    list.forEach(function(o) {
      lines.push('  - T' + (o.turn || '?') + ' ' + (o.faction || o.factionId || '势力') + '：' + _txt(o.publicSummary || o.result || o.action || o.intent, 140) + (o.posterityComment ? '；戏说线索：' + _txt(o.posterityComment, 120) : ''));
    });
    return lines.join('\n') + '\n';
  }
  TMNS.FactionAiMainloopBridge = {
    version: '2026-06-25',
    collectFactionContexts: collectFactionContexts,
    formatForPrompt: formatForPrompt,
    normalizeOutcomes: normalizeOutcomes,
    applyTurnOutcomes: applyTurnOutcomes,
    formatRecentOutcomesForNarrative: formatRecentOutcomesForNarrative
  };
})();

EndTurnHooks.registerFragment('faction-ai-mainloop-bridge', function(ctx) {
  try {
    if (!(P && P.ai && P.ai.key)) return null;
    if (typeof TM === 'undefined' || !TM.FactionAiMainloopBridge || typeof TM.FactionAiMainloopBridge.formatForPrompt !== 'function') return null;
    return TM.FactionAiMainloopBridge.formatForPrompt(GM, P, { limit: 12 });
  } catch (_) { return null; }
});

EndTurnHooks.registerFragment('summary-rule', function(ctx) {
  if (P.ai && P.ai.key && P.conf && P.conf.summaryRule && String(P.conf.summaryRule).trim()) {
    return "\n\n=== 玩家总结风格与特殊指令（优先级高） ===\n" + P.conf.summaryRule.trim() + "\n——按此风格/指令总结本回合shizhengji/zhengwen·不得违背。";
  }
  return null;
});

// 钩子 9: 历史检查（重设计 2026-04-30）
//   ★ 定位修正：不当语法警察纠正玩家·而当现实顾问预测后果
//   ★ 玩家诏令字面执行不变·AI 此处只识别"不合时代逻辑的行为"+预测"现实里应有的反噬"
//   ★ 输出写到 GM._historicalDeviations·下回合 before-hook 注入推演 prompt
//      让 AI 在 sc1 等推演里自然演绎这些反噬·而非修改玩家原意
EndTurnHooks.register('after', function() {
  var mode=P.conf.gameMode||"yanyi";
  if(mode==="yanyi"||!P.ai.key)return;

  var sc=findScenarioById(GM.sid);
  if(!sc)return;

  // 快照本回合史记最新条目 + 玩家诏令（避免后台 fire 时 shijiHistory 已被改写）
  var _histSnapshot = '';
  var _edictSnapshot = null;
  var _turnSnapshot = (GM.turn || 1) - 1;
  if (GM.shijiHistory && GM.shijiHistory.length > 0) {
    var _last = GM.shijiHistory[GM.shijiHistory.length-1];
    _histSnapshot = (_last.zhengwen || _last.shizhengji || '');
    _edictSnapshot = _last.edicts || null;
    _turnSnapshot = _last.turn || _turnSnapshot;
  }

  function _doHistCheck(){ return (async function(){
  try{
    // 收集本回合诏令原文
    var _edictText = '（无明确诏令）';
    if (_edictSnapshot) {
      var _eL = [];
      if (_edictSnapshot.decree) _eL.push('颁行诏书:' + _edictSnapshot.decree);
      if (_edictSnapshot.political) _eL.push('政:' + _edictSnapshot.political);
      if (_edictSnapshot.military) _eL.push('军:' + _edictSnapshot.military);
      if (_edictSnapshot.diplomatic) _eL.push('外:' + _edictSnapshot.diplomatic);
      if (_edictSnapshot.economic) _eL.push('经:' + _edictSnapshot.economic);
      if (_edictSnapshot.other) _eL.push('其他:' + _edictSnapshot.other);
      if (_eL.length) _edictText = _eL.join('\n  ');
    }
    // 【调用优化·Cut2·降本】玩家本回合无诏令 → 无「玩家诏令/行为」可查史实偏离(此检查专查玩家所为·非 AI 叙事)
    //   → 必返空 deviations·不注入·无大事记 → 跳过 LLM 与结果完全一致·省一次每回合背景调用(确定性安全)。
    var _hasEdictForHist = !!(_edictSnapshot && (_edictSnapshot.decree || _edictSnapshot.political || _edictSnapshot.military || _edictSnapshot.diplomatic || _edictSnapshot.economic || _edictSnapshot.other));
    if (!_hasEdictForHist) return;

    // 【史实顾问 agent·S2】开关开且未回落时·史实顾问 agent 接管(逼引证真实先例·替模型脑内臆测)·此写死 hist_check 跳；默认关/演义模式/连失回落 → 原 hist_check 原样跑零回归
    try {
      if (typeof window !== 'undefined' && window.TM && window.TM.HistoryAdvisor && window.TM.HistoryAdvisor.shouldHandle(GM)) {
        await window.TM.HistoryAdvisor.run(GM, { edictText: _edictText, narrative: _histSnapshot, turn: _turnSnapshot, mode: mode, refText: (mode === 'strict_hist' ? (P.conf && P.conf.refText) : ''), era: (sc && sc.era) || '', role: (sc && sc.role) || '' });
        return;
      }
    } catch (_haE) { try { console.warn('[史实顾问 agent] 失败·回落 hist_check:', _haE); } catch(_){} }
    var checkPrompt = '你是历史顾问 AI·剧本：' + (sc.era||'') + '·' + (sc.role||'') + '\n\n';
    checkPrompt += '【任务·识别玩家本回合诏令/行为里·与该时代历史逻辑相悖之处·并预测现实必然引起的反噬】\n';
    checkPrompt += '【铁律】\n';
    checkPrompt += '· 不修改玩家任何决定·玩家有权在剧本里行使任何选择\n';
    checkPrompt += '· 你的输出不会改写已下诏令·只用于"下回合让 AI 自然演绎其后果"\n';
    checkPrompt += '· 反噬要具体到主体（哪个朝臣/哪个党派/哪个外族/哪个阶层）和方式（弹劾/兵变/民变/叛盟/物议/经济失序/瘟疫等）\n';
    checkPrompt += '· 现实合理>戏剧化夸张·后果烈度要匹配偏离程度（小逾矩→朝议哗然·大违制→社稷动摇）\n\n';

    checkPrompt += '【T' + _turnSnapshot + '玩家诏令原文】\n  ' + _edictText + '\n\n';
    if (_histSnapshot) checkPrompt += '【本回合推演叙事节选】\n' + _histSnapshot.slice(0, 1800) + '\n\n';
    if(mode==="strict_hist" && P.conf.refText) checkPrompt += '【时代参考资料】\n' + P.conf.refText.slice(0, 1500) + '\n\n';

    checkPrompt += '【返回 JSON】\n';
    checkPrompt += '{\n';
    checkPrompt += '  "deviations": [\n';
    checkPrompt += '    {\n';
    checkPrompt += '      "playerAction": "玩家具体哪条诏令/行为(原文摘录·30字内)",\n';
    checkPrompt += '      "historicalContext": "为什么不合该时代逻辑(具体到制度/惯例/势力格局·40字)",\n';
    checkPrompt += '      "realisticConsequence": "现实中朝堂/民间/外族应当如何反应·涉及哪些具体主体·以何种方式·后果烈度(50字)",\n';
    checkPrompt += '      "manifestIn": 1-3 (后果应在多少回合内显现·1=立刻·2=本季·3=本年)\n';
    checkPrompt += '    }\n';
    checkPrompt += '  ]\n';
    checkPrompt += '}\n';
    checkPrompt += '若玩家诏令完全合史·deviations 返回空数组 []·不要硬找问题。';

    var resp = await callAISmart(checkPrompt, 1500, {
      temperature: 0.3, maxRetries: 2, priority: 'background', timeoutMs: 60000, fetchMaxRetries: 1,
      validator: function(c){ try{ var j=extractJSON(c); return j && Array.isArray(j.deviations); } catch(e){ return false; } }
    });
    var parsed = extractJSON(resp);
    if (!parsed || !Array.isArray(parsed.deviations)) return;
    if (parsed.deviations.length === 0) return; // 完全合史·无须注入

    // 持久化·下回合 before-hook 拾取
    if (!GM._historicalDeviations) GM._historicalDeviations = [];
    parsed.deviations.slice(0, 6).forEach(function(d){
      if (!d || !d.playerAction || !d.realisticConsequence) return;
      GM._historicalDeviations.push({
        sourceTurn: _turnSnapshot,
        playerAction: String(d.playerAction).slice(0, 80),
        historicalContext: String(d.historicalContext || '').slice(0, 100),
        realisticConsequence: String(d.realisticConsequence || '').slice(0, 150),
        ttl: Math.max(1, Math.min(3, parseInt(d.manifestIn, 10) || 2))
      });
    });
    // 上限：保留最近 12 条
    if (GM._historicalDeviations.length > 12) GM._historicalDeviations = GM._historicalDeviations.slice(-12);

    // 入大事记中性提醒（不批评·不修正）
    addEB('史实预警', parsed.deviations.length + ' 条偏离·后果将在 1-3 回合内自然显现');
  }catch(e){
    console.warn('历史检查失败:', e);
  }
  })(); }

  if (typeof _enqueuePostTurnJob === 'function') {
    _enqueuePostTurnJob('hist_check', _doHistCheck);
  } else {
    _doHistCheck();
  }
}, '历史检查');

EndTurnHooks.register('after', function() {
  // TTL 衰减·清理已耗尽条目
  if (Array.isArray(GM._historicalDeviations) && GM._historicalDeviations.length > 0) {
    GM._historicalDeviations.forEach(function(d){ if (d && typeof d.ttl === 'number') d.ttl--; });
    GM._historicalDeviations = GM._historicalDeviations.filter(function(d){ return d && d.ttl > 0; });
  }
}, '恢复prompt-史实偏离+TTL衰减');

// 钩子 10: 音效（原 _origEndTurn - 音频系统）
EndTurnHooks.register('after', function() {
  if(typeof AudioSystem !== 'undefined' && AudioSystem.playSfx) {
    AudioSystem.playSfx('turnEnd');
  }
}, '回合结束音效');

// ════════════════════════════════════════════════════════════
// [slice 3b.4 2026-05-07] Prompt-mutating before/after hook shells were removed.
// The fragment registrations below are the active prompt extension path.
// historical-deviations still keeps its after hook for TTL decay.
// ════════════════════════════════════════════════════════════

// fragment·剧本文风 (原 hook 3 _origPrompt)
EndTurnHooks.registerFragment('scenario-style', function(ctx) {
  if (!P.ai.key) return null;
  var sc = (typeof findScenarioById === 'function') ? findScenarioById(GM.sid) : null;
  var text = '';
  if (sc && sc.scnStyle) text += "\n本剧本文风: " + sc.scnStyle;
  if (sc && sc.scnStyleRule) text += "\n文风规则: " + sc.scnStyleRule;
  var _styleMap = {
    '文学化': '文辞优美，善用比喻和意象，情感充沛',
    '史书体': '仿《资治通鉴》纪事本末体，言简意赅，重事实轻渲染',
    '戏剧化': '矛盾冲突尖锐，人物对话生动，善用悬念和反转',
    '章回体': '仿《三国演义》章回体小说，每段开头可用对仗回目，文白夹杂',
    '纪传体': '仿《史记》纪传体，以人物为中心，"太史公曰"式评论',
    '白话文': '现代白话文风格，通俗易懂，节奏明快'
  };
  if (P.conf && P.conf.style && _styleMap[P.conf.style]) text += "\n叙事文风: " + _styleMap[P.conf.style];
  if (P.conf && P.conf.customStyle) text += "\n自定义文风: " + P.conf.customStyle;
  if (sc && sc.refText) text += "\n参考: " + sc.refText;
  if (P.conf && P.conf.refText) text += "\n全局参考: " + P.conf.refText;
  if (P.world && P.world.entries && P.world.entries.length > 0) {
    text += "\n\n=== 世界设定 ===";
    P.world.entries.forEach(function(e){
      if (e.category && e.title && e.content) text += "\n[" + e.category + "] " + e.title + ": " + e.content;
    });
  }
  return text || null;
});

// fragment·起居注 (原 hook 5 _origPrompt2)
EndTurnHooks.registerFragment('party-class-calibration', function(ctx) {
  if (typeof GM === 'undefined' || !GM) return null;
  var lines = [];
  var diag = null;
  try {
    if (typeof TM !== 'undefined' && TM.PartyClassLlmCalibrator && typeof TM.PartyClassLlmCalibrator.getDiagnostics === 'function') {
      diag = TM.PartyClassLlmCalibrator.getDiagnostics(GM);
    }
  } catch (_) { diag = null; }
  if (diag) {
    lines.push('turn=' + diag.turn + ' tier=' + diag.tier + ' seq=' + diag.actionSeq + ' calibrated=' + diag.lastCalibratedSeq);
    if (diag.lastResult) lines.push('lastCalibration=' + (diag.lastResult.source || '') + ' applied=' + JSON.stringify(diag.lastResult.applied || {}));
    if (diag.playerSignals && diag.playerSignals.policyTags && diag.playerSignals.policyTags.length) {
      lines.push('policyTags=' + diag.playerSignals.policyTags.slice(0, 8).join(','));
    }
  }
  try {
    var edges = GM.partyClassRelations && GM.partyClassRelations.edges;
    if (edges && typeof edges === 'object') {
      var relLines = Object.keys(edges).map(function(key) {
        var e = edges[key] || {};
        if (!e.className || !e.partyName) return '';
        var reason = e.lastReason ? ' reason=' + String(e.lastReason).slice(0, 60) : '';
        return e.className + '<->' + e.partyName + ' affinity=' + e.affinity + ' trust=' + e.trust + ' grievance=' + e.grievance + ' status=' + (e.status || '') + reason;
      }).filter(Boolean).slice(-8);
      if (relLines.length) lines.push('relations:\n' + relLines.map(function(x) { return '- ' + x; }).join('\n'));
    }
  } catch (_) {}
  try {
    // W1a·天下牵动因果综述：置于细节信号块之前，作 AI 的「因果导读」（把各系统反应连成一脉）
    if (typeof WorldDigest !== 'undefined' && typeof WorldDigest.promptBlock === 'function') {
      var _wdBlock = WorldDigest.promptBlock(GM, { turnsBack: 1 });
      if (_wdBlock) lines.push(_wdBlock);
    }
    // W4·趋势预演（前瞻·「若不干预将如何牵动」）：紧随回望综述之后，给 AI/玩家默认命运轨迹，立逆天改命之势
    if (typeof WorldDigest !== 'undefined' && typeof WorldDigest.previewBlock === 'function') {
      var _wpBlock = WorldDigest.previewBlock(GM, { limit: 4 });
      if (_wpBlock) lines.push(_wpBlock);
    }
  } catch (_wdE) {}
  try {
    if (typeof TM !== 'undefined' && TM.PlayerActionSignals && typeof TM.PlayerActionSignals.formatForPrompt === 'function') {
      var signals = TM.PlayerActionSignals.formatForPrompt(GM, { limit: 8 });
      if (signals) lines.push(signals);
    }
  } catch (_) {}
  try {
    if (typeof TM !== 'undefined' && TM.SocialPoliticalSignals && typeof TM.SocialPoliticalSignals.formatForPrompt === 'function') {
      var socialSignals = TM.SocialPoliticalSignals.formatForPrompt(GM, { limit: 10 });
      if (socialSignals) lines.push(socialSignals);
    }
  } catch (_) {}
  try {
    if (typeof TM !== 'undefined' && TM.ClassMinxinBridge && typeof TM.ClassMinxinBridge.formatForPrompt === 'function') {
      var classMinxin = TM.ClassMinxinBridge.formatForPrompt(GM, { limit: 8 });
      if (classMinxin) lines.push(classMinxin);
    }
  } catch (_) {}
  try {
    if (typeof TM !== 'undefined' && TM.MinxinLedger && typeof TM.MinxinLedger.formatForPrompt === 'function') {
      var minxinLedger = TM.MinxinLedger.formatForPrompt(GM, { limit: 10 });
      if (minxinLedger) lines.push(minxinLedger);
    }
  } catch (_) {}
  try {
    if (typeof TM !== 'undefined' && TM.MinxinPressureActions && typeof TM.MinxinPressureActions.formatForPrompt === 'function') {
      var minxinPressureActions = TM.MinxinPressureActions.formatForPrompt(GM, { limit: 10 });
      if (minxinPressureActions) lines.push(minxinPressureActions);
    }
  } catch (_) {}
  try {
    if (typeof TM !== 'undefined' && TM.MinxinCommitmentTracker && typeof TM.MinxinCommitmentTracker.formatForPrompt === 'function') {
      var minxinCommitments = TM.MinxinCommitmentTracker.formatForPrompt(GM, { limit: 10 });
      if (minxinCommitments) lines.push(minxinCommitments);
    }
  } catch (_) {}
  try {
    if (typeof TM !== 'undefined' && TM.MinxinResponsibilityChain && typeof TM.MinxinResponsibilityChain.formatForPrompt === 'function') {
      var minxinResponsibility = TM.MinxinResponsibilityChain.formatForPrompt(GM, { limit: 10 });
      if (minxinResponsibility) lines.push(minxinResponsibility);
    }
  } catch (_) {}
  try {
    if (typeof TM !== 'undefined' && TM.MinxinHardLinks && typeof TM.MinxinHardLinks.formatForPrompt === 'function') {
      var minxinHardLinks = TM.MinxinHardLinks.formatForPrompt(GM, { limit: 10 });
      if (minxinHardLinks) lines.push(minxinHardLinks);
    }
  } catch (_) {}
  try {
    if (typeof TM !== 'undefined' && TM.MinxinHardLinkConsumers && typeof TM.MinxinHardLinkConsumers.formatForPrompt === 'function') {
      var minxinHardLinkConsumers = TM.MinxinHardLinkConsumers.formatForPrompt(GM, { limit: 10 });
      if (minxinHardLinkConsumers) lines.push(minxinHardLinkConsumers);
    }
  } catch (_) {}
  try {
    if (typeof TM !== 'undefined' && TM.HujiRuntimeBridge && typeof TM.HujiRuntimeBridge.formatForPrompt === 'function') {
      var hujiRuntimeBridge = TM.HujiRuntimeBridge.formatForPrompt(GM, { limit: 10 });
      if (hujiRuntimeBridge) lines.push(hujiRuntimeBridge);
    }
  } catch (_) {}
  try {
    if (typeof TM !== 'undefined' && TM.HujiGovernanceLoop && typeof TM.HujiGovernanceLoop.formatForPrompt === 'function') {
      var hujiGovernanceLoop = TM.HujiGovernanceLoop.formatForPrompt(GM, { limit: 10 });
      if (hujiGovernanceLoop) lines.push(hujiGovernanceLoop);
    }
  } catch (_) {}
  try {
    if (typeof TM !== 'undefined' && TM.Renli && typeof TM.Renli.formatForPrompt === 'function') {
      var renliAgrarian = TM.Renli.formatForPrompt(GM, { limit: 10 }); // 刀D·役政农情真值（未推行役政→null·零注入）
      if (renliAgrarian) lines.push(renliAgrarian);
    }
  } catch (_) {}
  try {
    if (typeof TM !== 'undefined' && TM.Renli && typeof TM.Renli.formatReportedForPrompt === 'function') {
      var renliReported = TM.Renli.formatReportedForPrompt(GM, { limit: 8 }); // 刀C·官报vs实情之差（无粉饰/未激活→null）
      if (renliReported) lines.push(renliReported);
    }
  } catch (_) {}
  try {
    if (typeof TM !== 'undefined' && TM.PartyClassActionScheduler && typeof TM.PartyClassActionScheduler.formatForPrompt === 'function') {
      var actorActions = TM.PartyClassActionScheduler.formatForPrompt(GM, { limit: 10 });
      if (actorActions) lines.push(actorActions);
    }
  } catch (_) {}
  try {
    var issueLinks = Array.isArray(GM._partyClassCourtIssueLinks) ? GM._partyClassCourtIssueLinks.slice(-8) : [];
    if (issueLinks.length) {
      lines.push('courtIssueGoalLinks:\n' + issueLinks.map(function(x) {
        return '- ' + (x.topic || x.issueId || 'issue') + ' -> party=' + (x.party || '') + ' class=' + (x.className || '') + ' goal=' + String(x.goalText || '').slice(0, 120);
      }).join('\n'));
    }
  } catch (_) {}
  try {
    var calibratedIssues = Array.isArray(GM._partyClassCourtIssues) ? GM._partyClassCourtIssues.slice(-8) : [];
    if (calibratedIssues.length) {
      lines.push('calibratedCourtIssues:\n' + calibratedIssues.map(function(x) {
        return '- ' + (x.topic || x.title || x.id || 'issue') + ' status=' + (x.status || '') + ' party=' + (x.sourceParty || '') + ' class=' + (x.sourceClass || x.className || '');
      }).join('\n'));
    }
  } catch (_) {}
  try {
    var facLines = (Array.isArray(GM.facs) ? GM.facs : []).filter(function(f) {
      return f && Array.isArray(f._partyClassLlmHistory) && f._partyClassLlmHistory.length;
    }).slice(-8).map(function(f) {
      var last = f._partyClassLlmHistory[f._partyClassLlmHistory.length - 1] || {};
      var update = last.update || {};
      return '- ' + (f.name || f.id || 'faction') + ' attitude=' + (f.attitude || '') + ' shortGoal=' + String(f.shortGoal || update.shortGoal || '').slice(0, 100);
    });
    if (facLines.length) lines.push('calibratedFactions:\n' + facLines.join('\n'));
  } catch (_) {}
  if (!lines.length) return null;
  return '\n\n=== Party-Class-Faction-Court Calibration Snapshot ===\n'
    + 'Use this calibrated class/party/faction/court-issue state in the current turn simulation. Treat player signals as evidence, not as fixed permanent pairings.\n'
    + lines.join('\n');
});

EndTurnHooks.registerFragment('qiju-history', function(ctx) {
  if (!(P.ai.key && GM.conv && GM.conv.length > 0)) return null;
  var qijuLb = (P.conf && P.conf.qijuLookback) || 5;
  var recentQ = (GM.qijuHistory || []).slice(-qijuLb);
  if (recentQ.length === 0) return null;
  var qijuText = "\n\n=== 近" + qijuLb + "回合起居注 ===\n";
  recentQ.forEach(function(q){
    qijuText += "T" + q.turn + " " + q.time + ":\n";
    if (q.edicts) {
      if (q.edicts.decree) qijuText += "  颁行诏书: " + q.edicts.decree + "\n";
      if (q.edicts.political) qijuText += "  政: " + q.edicts.political + "\n";
      if (q.edicts.military) qijuText += "  军: " + q.edicts.military + "\n";
      if (q.edicts.diplomatic) qijuText += "  外: " + q.edicts.diplomatic + "\n";
      if (q.edicts.economic) qijuText += "  经: " + q.edicts.economic + "\n";
    }
    if (q.xinglu) qijuText += "  行: " + q.xinglu + "\n";
  });
  return qijuText;
});

// fragment·史记 N 回合 (原 hook 6.5 _origPromptShiji)
EndTurnHooks.registerFragment('shiji-history', function(ctx) {
  if (!(P.ai && P.ai.key && GM.shijiHistory && GM.shijiHistory.length > 0)) return null;
  var shijiLb = (P.conf && P.conf.shijiLookback) || 5;
  var recentS = GM.shijiHistory.slice(-shijiLb);
  if (recentS.length === 0) return null;
  var shijiText = "\n\n=== 近" + shijiLb + "回合史记·时政记/正文摘要 ===\n";
  recentS.forEach(function(s){
    shijiText += "T" + (s.turn || '?') + "·" + (s.time || '') + "\n";
    if (s.szjTitle) shijiText += "  题：" + s.szjTitle + "\n";
    if (s.shizhengji) shijiText += "  政：" + String(s.shizhengji).replace(/\s+/g, ' ').slice(0, 280) + "\n";
    if (s.turnSummary) shijiText += "  要：" + String(s.turnSummary).slice(0, 120) + "\n";
  });
  return shijiText;
});

// fragment·近期鸿雁传书 (原 hook 6.7 _origPromptLtr)
EndTurnHooks.registerFragment('letters-recent', function(ctx) {
  if (!(P.ai && P.ai.key && Array.isArray(GM.letters) && GM.letters.length > 0)) return null;
  var curT = GM.turn || 1;
  var recentLs = GM.letters.filter(function(l){
    return l && (curT - (l.sentTurn || l.deliveryTurn || 0)) <= 3;
  }).slice(-10);
  if (recentLs.length === 0) return null;
  var lettersText = "\n\n=== 近期鸿雁传书摘要（推演需延续其情·不可忘）===\n";
  recentLs.forEach(function(l){
    var dir = l._npcInitiated ? (l.from + '→皇帝') : ('皇帝→' + l.to);
    var typeL = (l.letterType || 'personal');
    var urg = l.urgency === 'extreme' ? '(八百里加急)' : l.urgency === 'urgent' ? '(加急)' : '';
    var sentAt = 'T' + (l.sentTurn || '?');
    lettersText += '[' + sentAt + '·' + dir + '·' + typeL + urg + '] ';
    if (l.subjectLine) lettersText += '《' + l.subjectLine.slice(0, 26) + '》';
    lettersText += ' 内容摘：' + String(l.content || '').replace(/\s+/g, ' ').slice(0, 140);
    if (l.reply && !l._npcInitiated) lettersText += '·[回：' + String(l.reply).slice(0, 80) + ']';
    if (l.suggestion) lettersText += '·建：' + String(l.suggestion).slice(0, 60);
    lettersText += '\n';
  });
  return lettersText;
});

// fragment·AI rules (原 hook 7 _origPrompt3)
EndTurnHooks.registerFragment('ai-rules', function(ctx) {
  if (!(P.ai.key && P.ai.rules)) return null;
  return "\n\n=== 规则 ===\n" + P.ai.rules;
});

// fragment·史实偏离演绎 (原 hook 9b _origPromptHist·TTL 衰减仍在 after hook)
EndTurnHooks.registerFragment('historical-deviations', function(ctx) {
  if (!P.ai || !P.ai.key) return null;
  if (!Array.isArray(GM._historicalDeviations) || GM._historicalDeviations.length === 0) return null;
  var pending = GM._historicalDeviations.filter(function(d){ return d && d.ttl > 0; });
  if (pending.length === 0) return null;
  var devText = '\n\n=== 史实偏离·待演绎自然后果（玩家诏令字面照旧执行·你只需让"现实必然反应"在本回合或后续自然显现）===\n';
  devText += '【铁律】不得改写玩家原诏；只在叙事/NPC行动/势力反应/民意/外族动向中演出后果\n';
  pending.forEach(function(d){
    devText += '· T' + d.sourceTurn + '玩家：' + d.playerAction + '\n';
    if (d.historicalContext) devText += '  时代背景：' + d.historicalContext + '\n';
    devText += '  应演后果：' + d.realisticConsequence + '（剩 ' + d.ttl + ' 回合内显现）\n';
  });
  return devText;
});

// fragment·游戏模式·PREFIX (原 hook 11 _origPrompt11)
// 注意 position='prefix'·prompt-builder 把它注入 sysP 之前·保留原 hook 的 modePrefix + origPrompt 语义
EndTurnHooks.registerFragment('game-mode', function(ctx) {
  var mode = (typeof P !== 'undefined' && P.conf && P.conf.gameMode) || 'yanyi';
  var modePrefix = '';
  if (mode === 'yanyi') {
    modePrefix = '【演义模式】请以演义小说风格推演，允许虚构情节和战征细节，强调戏剧冲突。';
  } else if (mode === 'light_hist') {
    modePrefix = '【轻度史实模式】请大体符合历史走向，允许适度演绎，主要人物和事件应有史实依据。';
  } else if (mode === 'strict_hist') {
    var refText = (P.conf && P.conf.refText) ? P.conf.refText : '';
    modePrefix = '【严格史实模式】请严格按正史推演，不得虚构人物或事件，请准确引用史书记载。' + (refText ? '参考资料：' + refText + '。' : '');
  }
  return modePrefix || null;
}, { position: 'prefix' });

// 钩子 13: 处理AI返回的高级系统变更（原 _origEndTurn 的 after 部分）
EndTurnHooks.register('after', function() {
  if(GM.conv.length>0){
    var lastMsg=GM.conv[GM.conv.length-1];
    if(lastMsg.role==="assistant"&&lastMsg.content){
      try{
            var parsed=extractJSON(lastMsg.content);
            if(parsed){

            // 阶层变化
            if(parsed.class_changes){Object.entries(parsed.class_changes).forEach(function(e){var cls=findClassByName(e[0]);if(cls&&typeof e[1]==="object"&&e[1].influence!=null)cls.influence=clamp(cls.influence+(e[1].influence||0),0,100);});}

            // 党派变化
            if(parsed.party_changes){Object.entries(parsed.party_changes).forEach(function(e){var party=findPartyByName(e[0]);if(party&&typeof e[1]==="object"){if(e[1].strength!=null)party.strength=clamp(party.strength+(e[1].strength||0),0,100);}});}

            // 角色更新
            if(parsed.char_updates){Object.entries(parsed.char_updates).forEach(function(e){var ch=findCharByName(e[0]);var upd=e[1];if(ch&&typeof upd==="object"){if(upd.loyalty_delta!=null){if(typeof adjustCharacterLoyalty==="function")adjustCharacterLoyalty(ch,clamp(parseInt(upd.loyalty_delta)||0,-20,20),upd.reason||"",{source:"legacy-core-char-updates",ai:true,defaultReason:"AI\u63A8\u6F14",maxAbs:20});else if(upd.reason){var oldLd=(typeof ch.loyalty==="number"&&isFinite(ch.loyalty))?ch.loyalty:50;ch.loyalty=clamp(oldLd+clamp(parseInt(upd.loyalty_delta)||0,-20,20),0,100);}}else if(upd.loyalty!=null){if(typeof setCharacterLoyalty==="function")setCharacterLoyalty(ch,upd.loyalty,upd.reason||"",{source:"legacy-core-char-updates",ai:true,defaultReason:"AI\u63A8\u6F14",maxJump:20});else if(upd.reason){var oldSet=parseInt(upd.loyalty);ch.loyalty=clamp(isNaN(oldSet)?50:oldSet,0,100);var ac0=(GM.allCharacters||[]).find(function(c){return c.name===e[0];});if(ac0){ac0.loyalty=ch.loyalty;ac0.relationValue=ch.loyalty;}}}if(upd.desc)ch.desc=upd.desc;}});}
          }
      }catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
    }
  }

  // 更新高级面板·renderGameState 内部已重渲 Tech/Civic/Renwu/LeftPanel/SidePanels·去冗余整树重建（性能）
  renderGameState();
}, '处理AI高级系统变更');

// 钩子 14: 播放回合结束音效
EndTurnHooks.register('before', function() {
  if(typeof AudioSystem !== 'undefined' && AudioSystem.playSfx) {
    AudioSystem.playSfx('turnEnd');
  }
}, '播放音效');

// ============================================================
//  旧的包装链（已废弃，保留用于向后兼容）
// ============================================================

// _origEndTurn* 包装链已全部删除（已迁移到 EndTurnHooks 系统）

// ============================================================
//  推演时打包所有高级系统数据
// ============================================================
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统
// 保留此注释用于标记原有代码位置

// ============================================================
//  史记中记录高级系统变化
// ============================================================
// 已在endTurn的史记HTML中包含基础数值变化
// 高级系统变化通过addEB写入大事记，间接记录到史记

// ============================================================
//  游戏模式标识
// ============================================================
// renderGameState 增强：游戏模式徽章 + 小地图（合并两次装饰，避免多层包装链）
GameHooks.on('renderGameState:after', function(){
  var gl=_$("gl");if(!gl)return;
  // 游戏模式徽章
  var mode=P.conf.gameMode||"yanyi";
  var label={yanyi:"\u6F14\u4E49",light_hist:"\u8F7B\u5EA6\u53F2\u5B9E",strict_hist:"\u4E25\u683C\u53F2\u5B9E"}[mode]||"\u6F14\u4E49";
  var color={yanyi:"var(--blue)",light_hist:"var(--gold)",strict_hist:"var(--red)"}[mode]||"var(--blue)";
  var existing=gl.querySelector("#mode-badge");
  if(!existing){
    var badge=document.createElement("div");badge.id="mode-badge";badge.style.cssText="text-align:center;margin-bottom:0.5rem;";
    badge.innerHTML="<span style=\"font-size:0.7rem;padding:0.15rem 0.5rem;border-radius:10px;background:rgba(0,0,0,0.3);color:"+color+";border:1px solid "+color+";\">"+label+"</span>";
    gl.insertBefore(badge,gl.firstChild);
  }
  // 小地图
  if(!_$("g-minimap")){
    var mapDiv=document.createElement("div");mapDiv.style.marginTop="0.8rem";
    mapDiv.innerHTML="<div class=\"pt\">\u5730\u56FE</div><div style=\"border:1px solid var(--bdr);border-radius:5px;overflow:hidden;\"><canvas id=\"g-minimap\" width=\"240\" height=\"160\"></canvas></div>";
    gl.appendChild(mapDiv);
  }
  drawMinimap();
});

// ============================================================
//  完成初始化
// ============================================================
// 所有代码加载完毕，显示启动界面
(function(){
  _$("launch").style.display="flex";
  var lt=_$("lt-title");
  if(lt&&P.conf&&P.conf.gameTitle)lt.textContent=P.conf.gameTitle;
})();

// 回复我获取Part 2（游戏引擎）
// ============================================================
