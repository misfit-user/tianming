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

async function _endTurnInternal() {
  // 原 endTurn 的完整内容移入此处，方便并发调用
  return await _endTurnCore();
}

async function endTurn(){
  // 入口：显示"是否例行朝会"弹窗
  if (GM.busy) return;
  try {
    if (typeof window !== 'undefined' && window.TM && TM.FactionNpcInTurnDriver && TM.FactionNpcInTurnDriver.cancelInTurnTimers) {
      TM.FactionNpcInTurnDriver.cancelInTurnTimers();
    }
  } catch(_npcInTurnCancelE) {
    try { console.warn('[endTurn] NPC in-turn timer cancel failed', _npcInTurnCancelE); } catch(_){}
  }
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
      var _preState = { GM: deepClone(GM), P: deepClone(P) };
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
        maxRetries: 0
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
      maxRetries: 0
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

  // 回合结束前最后一次聚合：确保 七变量(national) 严格等于 各区划叶子之和
  // （因 AI 推演/各 engine.tick 都可能修改 division.population.mouths，需重新累计）
  try { if (typeof IntegrationBridge !== 'undefined' && typeof IntegrationBridge.aggregateRegionsToVariables === 'function') IntegrationBridge.aggregateRegionsToVariables(); } catch(_aggFinalE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_aggFinalE, 'endTurn] final aggregate') : console.warn('[endTurn] final aggregate', _aggFinalE); }

  GM.busy=false;
  GM._endTurnBusy=false;
  } catch (error) {
    console.error('endTurn error:', error);
    toast('回合处理出错: ' + error.message);
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
      if(!exists)GM.jishiRecords.push({turn:GM.turn,char:m.from,playerSaid:"\u594F\u758F("+m.type+"): "+m.content,npcSaid:"\u6279\u590D: "+statusText+(m.reply?" | "+m.reply:"")});
    });
    renderJishi();
  }
}, '奏议批复');

// 钩子 3: AI上下文注入 - 剧本文风（原 _origEndTurn3）
EndTurnHooks.register('before', function() {
  return; // [slice 3b.4·2026-05-07] migrated to fragment 'scenario-style' (registered at hooks region tail)
  if(P.ai.key){
    GM._origPrompt=P.ai.prompt;
    var fullPrompt=P.ai.prompt||DEFAULT_PROMPT;
    var sc=findScenarioById(GM.sid);

    if(sc&&sc.scnStyle)fullPrompt+="\n本剧本文风: "+sc.scnStyle;
    if(sc&&sc.scnStyleRule)fullPrompt+="\n文风规则: "+sc.scnStyleRule;
    // 4.3b: 文风指令映射
    var _styleMap = {
      '文学化': '文辞优美，善用比喻和意象，情感充沛',
      '史书体': '仿《资治通鉴》纪事本末体，言简意赅，重事实轻渲染',
      '戏剧化': '矛盾冲突尖锐，人物对话生动，善用悬念和反转',
      '章回体': '仿《三国演义》章回体小说，每段开头可用对仗回目，文白夹杂',
      '纪传体': '仿《史记》纪传体，以人物为中心，"太史公曰"式评论',
      '白话文': '现代白话文风格，通俗易懂，节奏明快'
    };
    if(P.conf.style&&_styleMap[P.conf.style])fullPrompt+="\n叙事文风: "+_styleMap[P.conf.style];
    if(P.conf.customStyle)fullPrompt+="\n自定义文风: "+P.conf.customStyle;

    if(sc&&sc.refText)fullPrompt+="\n\u53C2\u8003: "+sc.refText;
    if(P.conf.refText)fullPrompt+="\n\u5168\u5C40\u53C2\u8003: "+P.conf.refText;

    if(P.world.entries&&P.world.entries.length>0){
      fullPrompt+="\n\n=== 世界设定 ===";
      P.world.entries.forEach(function(e){
        if(e.category&&e.title&&e.content)fullPrompt+="\n["+e.category+"] "+e.title+": "+e.content;
      });
    }

    P.ai.prompt=fullPrompt;
  }
}, 'AI上下文-剧本文风');

// 钩子 4: 恢复原始prompt
EndTurnHooks.register('after', function() {
  if(GM._origPrompt!==undefined){
    P.ai.prompt=GM._origPrompt;
    delete GM._origPrompt;
  }
}, '恢复原始prompt');

// 钩子 5: AI上下文注入 - 起居注（原 _origEndTurn5）
EndTurnHooks.register('before', function() {
  return; // [slice 3b.4·2026-05-07] migrated to fragment 'qiju-history'
  if(P.ai.key&&GM.conv.length>0){
    var qijuLb=P.conf.qijuLookback||5;
    var recentQ=GM.qijuHistory.slice(-qijuLb);
    if(recentQ.length>0){
      var qijuText="\n\n=== 近"+qijuLb+"回合起居注 ===\n";
      recentQ.forEach(function(q){
        qijuText+="T"+q.turn+" "+q.time+":\n";
        if(q.edicts){
          if(q.edicts.political)qijuText+="  政: "+q.edicts.political+"\n";
          if(q.edicts.military)qijuText+="  军: "+q.edicts.military+"\n";
          if(q.edicts.diplomatic)qijuText+="  外: "+q.edicts.diplomatic+"\n";
          if(q.edicts.economic)qijuText+="  经: "+q.edicts.economic+"\n";
        }
        if(q.xinglu)qijuText+="  行: "+q.xinglu+"\n";
      });
      if(!GM._origPrompt2)GM._origPrompt2=P.ai.prompt;
      P.ai.prompt=(P.ai.prompt||"")+qijuText;
    }
  }
}, 'AI上下文-起居注');

// 钩子 6: 恢复prompt
EndTurnHooks.register('after', function() {
  if(GM._origPrompt2!==undefined){
    P.ai.prompt=GM._origPrompt2;
    delete GM._origPrompt2;
  }
}, '恢复prompt-起居注');

// 钩子 6.5: AI 上下文注入 - 史记 N 回合(shijiLookback 唤醒)
EndTurnHooks.register('before', function() {
  return; // [slice 3b.4·2026-05-07] migrated to fragment 'shiji-history'
  if (P.ai && P.ai.key && GM.shijiHistory && GM.shijiHistory.length > 0) {
    var shijiLb = (P.conf && P.conf.shijiLookback) || 5;
    var recentS = GM.shijiHistory.slice(-shijiLb);
    if (recentS.length > 0) {
      var shijiText = "\n\n=== 近" + shijiLb + "回合史记·时政记/正文摘要 ===\n";
      recentS.forEach(function(s) {
        shijiText += "T" + (s.turn || '?') + "·" + (s.time || '') + "\n";
        if (s.szjTitle) shijiText += "  题：" + s.szjTitle + "\n";
        if (s.shizhengji) shijiText += "  政：" + String(s.shizhengji).replace(/\s+/g, ' ').slice(0, 280) + "\n";
        if (s.turnSummary) shijiText += "  要：" + String(s.turnSummary).slice(0, 120) + "\n";
      });
      if (!GM._origPromptShiji) GM._origPromptShiji = P.ai.prompt;
      P.ai.prompt = (P.ai.prompt || "") + shijiText;
    }
  }
}, 'AI上下文-史记');

EndTurnHooks.register('after', function() {
  if (GM._origPromptShiji !== undefined) {
    P.ai.prompt = GM._origPromptShiji;
    delete GM._origPromptShiji;
  }
}, '恢复prompt-史记');

// 钩子 6.6: AI 上下文注入 - 玩家总结规则(summaryRule 唤醒)
// [slice 3b.3·2026-05-07 PoC] 迁 fragment·删 _origPromptSumRule before/after 配对
// 原 before mutate P.ai.prompt + after restore·新 fragment 仅返回 text·prompt-builder 显式 join
EndTurnHooks.registerFragment('summary-rule', function(ctx) {
  if (P.ai && P.ai.key && P.conf && P.conf.summaryRule && String(P.conf.summaryRule).trim()) {
    return "\n\n=== 玩家总结风格与特殊指令（优先级高） ===\n" + P.conf.summaryRule.trim() + "\n——按此风格/指令总结本回合shizhengji/zhengwen·不得违背。";
  }
  return null;
});

// 钩子 6.7: AI 上下文注入 - 近期鸿雁传书摘要(letter 内容影响推演)
EndTurnHooks.register('before', function() {
  return; // [slice 3b.4·2026-05-07] migrated to fragment 'letters-recent'
  if (P.ai && P.ai.key && Array.isArray(GM.letters) && GM.letters.length > 0) {
    var curT = GM.turn || 1;
    // 近 3 回合往来信件·含玩家去信+NPC 来信
    var recentLs = GM.letters.filter(function(l) {
      return l && (curT - (l.sentTurn || l.deliveryTurn || 0)) <= 3;
    }).slice(-10);
    if (recentLs.length > 0) {
      var lettersText = "\n\n=== 近期鸿雁传书摘要（推演需延续其情·不可忘）===\n";
      recentLs.forEach(function(l) {
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
      if (!GM._origPromptLtr) GM._origPromptLtr = P.ai.prompt;
      P.ai.prompt = (P.ai.prompt || "") + lettersText;
    }
  }
}, 'AI上下文-鸿雁传书摘要');

EndTurnHooks.register('after', function() {
  if (GM._origPromptLtr !== undefined) {
    P.ai.prompt = GM._origPromptLtr;
    delete GM._origPromptLtr;
  }
}, '恢复prompt-鸿雁');

// 钩子 7: AI上下文注入 - 规则（原 _origEndTurn6）
EndTurnHooks.register('before', function() {
  return; // [slice 3b.4·2026-05-07] migrated to fragment 'ai-rules'
  if(P.ai.key&&P.ai.rules){
    if(!GM._origPrompt3)GM._origPrompt3=P.ai.prompt;
    P.ai.prompt=(P.ai.prompt||"")+"\n\n=== 规则 ===\n"+P.ai.rules;
  }
}, 'AI上下文-规则');

// 钩子 8: 恢复prompt
EndTurnHooks.register('after', function() {
  if(GM._origPrompt3!==undefined){
    P.ai.prompt=GM._origPrompt3;
    delete GM._origPrompt3;
  }
}, '恢复prompt-规则');

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
      if (_edictSnapshot.political) _eL.push('政:' + _edictSnapshot.political);
      if (_edictSnapshot.military) _eL.push('军:' + _edictSnapshot.military);
      if (_edictSnapshot.diplomatic) _eL.push('外:' + _edictSnapshot.diplomatic);
      if (_edictSnapshot.economic) _eL.push('经:' + _edictSnapshot.economic);
      if (_edictSnapshot.other) _eL.push('其他:' + _edictSnapshot.other);
      if (_eL.length) _edictText = _eL.join('\n  ');
    }

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
      temperature: 0.3, maxRetries: 2, priority: 'background', timeoutMs: 60000, fetchMaxRetries: 0,
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

// 钩子 9b: AI上下文注入 - 史实偏离待演绎（每回合 before·消费上回合 hist_check 产出）
EndTurnHooks.register('before', function() {
  return; // [slice 3b.4·2026-05-07] migrated to fragment 'historical-deviations' (TTL 衰减保留为后置 after hook)
  if (!P.ai || !P.ai.key) return;
  if (!Array.isArray(GM._historicalDeviations) || GM._historicalDeviations.length === 0) return;

  var pending = GM._historicalDeviations.filter(function(d){ return d && d.ttl > 0; });
  if (pending.length === 0) return;

  var devText = '\n\n=== 史实偏离·待演绎自然后果（玩家诏令字面照旧执行·你只需让"现实必然反应"在本回合或后续自然显现）===\n';
  devText += '【铁律】不得改写玩家原诏；只在叙事/NPC行动/势力反应/民意/外族动向中演出后果\n';
  pending.forEach(function(d){
    devText += '· T' + d.sourceTurn + '玩家：' + d.playerAction + '\n';
    if (d.historicalContext) devText += '  时代背景：' + d.historicalContext + '\n';
    devText += '  应演后果：' + d.realisticConsequence + '（剩 ' + d.ttl + ' 回合内显现）\n';
  });
  if (!GM._origPromptHist) GM._origPromptHist = P.ai.prompt;
  P.ai.prompt = (P.ai.prompt || '') + devText;
}, 'AI上下文-史实偏离演绎');

EndTurnHooks.register('after', function() {
  // 恢复 prompt
  if (GM._origPromptHist !== undefined) {
    P.ai.prompt = GM._origPromptHist;
    delete GM._origPromptHist;
  }
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

// 钩子 11: 游戏模式注入（原 _origEndTurn11）
EndTurnHooks.register('before', function() {
  return; // [slice 3b.4·2026-05-07] migrated to fragment 'game-mode' (PREFIX position)
  var mode = (typeof P !== 'undefined' && P.conf && P.conf.gameMode) || 'yanyi';
  var origPrompt = (typeof P !== 'undefined' && P.ai && P.ai.prompt != null) ? P.ai.prompt : null;

  if (origPrompt !== null) {
    GM._origPrompt11 = origPrompt;
    var modePrefix = '';
    if (mode === 'yanyi') {
      modePrefix = '【演义模式】请以演义小说风格推演，允许虚构情节和战征细节，强调戳剧冲突。';
    } else if (mode === 'light_hist') {
      modePrefix = '【轻度史实模式】请大体符合历史走向，允许适度演绎，主要人物和事件应有史实依据。';
    } else if (mode === 'strict_hist') {
      var refText = (P.conf && P.conf.refText) ? P.conf.refText : '';
      modePrefix = '\u3010\u4E25\u683C\u53F2\u5B9E\u6A21\u5F0F\u3011\u8BF7\u4E25\u683C\u6309\u6B63\u53F2\u63A8\u6F14\uFF0C\u4E0D\u5F97\u865A\u6784\u4EBA\u7269\u6216\u4E8B\u4EF6\uFF0C\u8BF7\u51C6\u786E\u5F15\u7528\u53F2\u4E66\u8BB0\u8F7D\u3002' + (refText ? '\u53C2\u8003\u8D44\u6599\uFF1A' + refText + '\u3002' : '');
    }
    if (modePrefix) {
      P.ai.prompt = modePrefix + origPrompt;
    }
  }
}, '游戏模式注入');

// 钩子 12: 恢复prompt
EndTurnHooks.register('after', function() {
  if(GM._origPrompt11!==undefined){
    P.ai.prompt=GM._origPrompt11;
    delete GM._origPrompt11;
  }
}, '恢复prompt-游戏模式');

// ════════════════════════════════════════════════════════════
// [slice 3b.4·2026-05-07] 6 个 prompt-mutating hook 批量迁 fragment paradigm
// 上方对应 6 个 before-hook 已加 `return;` 早退·after-hook 中的 if-restore 自动 no-op
// 见 web/docs/endturn-data-flow.md §5 obstacle #6
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
EndTurnHooks.registerFragment('qiju-history', function(ctx) {
  if (!(P.ai.key && GM.conv && GM.conv.length > 0)) return null;
  var qijuLb = (P.conf && P.conf.qijuLookback) || 5;
  var recentQ = (GM.qijuHistory || []).slice(-qijuLb);
  if (recentQ.length === 0) return null;
  var qijuText = "\n\n=== 近" + qijuLb + "回合起居注 ===\n";
  recentQ.forEach(function(q){
    qijuText += "T" + q.turn + " " + q.time + ":\n";
    if (q.edicts) {
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

  // 更新高级面板
  renderGameTech();renderGameCivic();renderRenwu();
  renderLeftPanel();renderGameState();renderSidePanels();
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
    badge.innerHTML="<span style=\"font-size:0.65rem;padding:0.15rem 0.5rem;border-radius:10px;background:rgba(0,0,0,0.3);color:"+color+";border:1px solid "+color+";\">"+label+"</span>";
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
