// @ts-check
/// <reference path="tm-endturn-pipeline-types.js" />
// ============================================================
// tm-endturn-pipeline-steps.js — endTurn 管道 6 step 骨架
// 创建：slice 1·2026-05-07·additive·所有 fn 是 noop
// 职责：登记 6 step 切分·业务实现由 slice 2-6 逐个迁移
// 切分依据：web/docs/endturn-data-flow.md §4
// onError 策略来源：§7 决定 3
// ============================================================

(function(){
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};
  TM.Endturn = TM.Endturn || {};

  function _rethrowCriticalFinalizeFailure(label, error, completionContext) {
    var err = error instanceof Error ? error : new Error(String(error || label || 'end-turn finalizer failed'));
    try { if (!err.endTurnSystem) err.endTurnSystem = label || 'state-finalize'; } catch (_) {}
    if(TM.Endturn.Validity&&TM.Endturn.Validity.canDefer(completionContext,err)){TM.Endturn.Validity.defer(completionContext,label,err);return;}
    try {
      if (window.TM && TM.errors && typeof TM.errors.capture === 'function') {
        TM.errors.capture(err, '[endTurn] critical finalizer ' + (label || 'unknown'));
      } else {
        console.error('[pipeline.state-finalize] ' + (label || 'unknown'), err);
      }
    } catch (_) {}
    throw err;
  }

  function _normalizeTurnChangesForRender(ctx) {
    try {
      if (typeof GM === 'undefined' || !GM) return;
      if (typeof ensureTurnChangesState === 'function') ensureTurnChangesState();
      var tc = GM.turnChanges;
      if (!tc || typeof tc !== 'object' || Array.isArray(tc)) tc = GM.turnChanges = {};
      var buckets = ['variables', 'characters', 'factions', 'parties', 'classes', 'military', 'map'];
      buckets.forEach(function(key) {
        if (!Array.isArray(tc[key])) tc[key] = [];
      });
      function isNum(v) { return typeof v === 'number' && isFinite(v); }
      function num(v, fallback) {
        var n = Number(v);
        return isFinite(n) ? n : fallback;
      }
      tc.variables = tc.variables.map(function(v) {
        if (!v || typeof v !== 'object') v = { name: String(v || '变量') };
        if (!v.name) v.name = v.label || v.path || '变量';
        var delta = num(v.delta, 0);
        if (!Array.isArray(v.reasons)) {
          var reasonText = v.reason || v.desc || v.description || '';
          v.reasons = reasonText ? [{ type: v.type || '变动', amount: delta, desc: reasonText }] : [];
        }
        if (!isNum(v.oldValue) || !isNum(v.newValue)) {
          var current = null;
          if (GM.vars && GM.vars[v.name] && isNum(GM.vars[v.name].value)) current = GM.vars[v.name].value;
          else if (isNum(GM[v.name])) current = GM[v.name];
          else if (isNum(v.newValue)) current = v.newValue;
          else current = delta;
          if (!isNum(v.newValue)) v.newValue = current;
          if (!isNum(v.oldValue)) v.oldValue = current - delta;
        }
        if (!isNum(v.delta)) v.delta = num(v.newValue, 0) - num(v.oldValue, 0);
        return v;
      });
      ['characters', 'factions', 'parties', 'classes', 'military', 'map'].forEach(function(key) {
        tc[key] = tc[key].map(function(item) {
          if (!item || typeof item !== 'object') item = { name: String(item || key), changes: [] };
          if (!item.name) item.name = item.label || item.id || key;
          if (!Array.isArray(item.changes)) item.changes = [];
          item.changes = item.changes.map(function(ch) {
            if (!ch || typeof ch !== 'object') ch = { field: String(ch || 'value') };
            if (!ch.field) ch.field = ch.label || ch.path || 'value';
            if (!('oldValue' in ch)) ch.oldValue = 0;
            if (!('newValue' in ch)) ch.newValue = ch.delta || 0;
            if (!ch.reason) ch.reason = ch.desc || ch.description || '';
            return ch;
          });
          return item;
        });
      });
    } catch(e) { _rethrowCriticalFinalizeFailure('turnChanges-normalize', e, ctx); }
  }

  function _scheduleNpcBehaviorPostRender(ctx) {
    try {
      if (typeof P === 'undefined' || !P || !P.ai || !P.ai.key) return;
      if (typeof executeNpcBehaviors !== 'function') return;
      if (typeof GM === 'undefined' || !GM) return;
      var queuedTurn = GM.turn || 0;
      if (GM._npcBehaviorPostTurnQueued === queuedTurn) return;
      GM._npcBehaviorPostTurnQueued = queuedTurn;
      var runner = async function() {
        var _t0 = Date.now();
        try {
          if (TM.Endturn && TM.Endturn.Timing && typeof TM.Endturn.Timing.mark === 'function') {
            TM.Endturn.Timing.mark(ctx, 'background', { id: 'npc_behavior', phase: 'start', turn: queuedTurn });
          }
          await executeNpcBehaviors();
          if (typeof _scheduleNpcIdleAutonomyLoop === 'function') {
            _scheduleNpcIdleAutonomyLoop({ source: 'post_render_npc_behavior' });
          }
          if (TM.Endturn && TM.Endturn.Timing && typeof TM.Endturn.Timing.mark === 'function') {
            TM.Endturn.Timing.mark(ctx, 'background', { id: 'npc_behavior', phase: 'done', turn: queuedTurn, ok: true, ms: Date.now() - _t0 });
          }
        } catch(e) {
          if (TM.Endturn && TM.Endturn.Timing && typeof TM.Endturn.Timing.mark === 'function') {
            TM.Endturn.Timing.mark(ctx, 'background', { id: 'npc_behavior', phase: 'done', turn: queuedTurn, ok: false, ms: Date.now() - _t0, error: String(e && (e.message || e) || '') });
          }
          throw e;
        }
      };
      if (typeof _enqueuePostTurnJob === 'function') _enqueuePostTurnJob('npc_behavior', runner);
      else setTimeout(function(){ runner().catch(function(e){ try { console.warn('[pipeline.render-finalize] npc_behavior failed', e); } catch(_){} }); }, 0);
    } catch(_npcbE) { try { console.warn('[pipeline.render-finalize] NPC behavior schedule failed', _npcbE); } catch(_){} }
  }

  function _scheduleEndturnIdleBackground(label, fn) {
    return new Promise(function(resolve) {
      var attempts = 0;
      function runWhenIdle() {
        attempts++;
        try {
          if (typeof GM === 'undefined' || !GM || !GM.busy || attempts >= 240) {
            Promise.resolve()
              .then(fn)
              .then(function(v) { resolve(v); })
              .catch(function(e) {
                try {
                  if (window.TM && TM.errors && TM.errors.capture) TM.errors.capture(e, label || 'endturn idle background');
                  else console.warn('[pipeline.plan-prefetch] ' + (label || 'background') + ' failed', e);
                } catch(_) {}
                resolve(null);
              });
            return;
          }
        } catch(_) {}
        setTimeout(runWhenIdle, 1000);
      }
      setTimeout(runWhenIdle, 1000);
    });
  }

  async function _runPostRenderTurnOpeners(ctx) {
    try {
      if (typeof window !== 'undefined' && window.TM && TM.FactionIndex && TM.FactionIndex.rebuild) {
        await Promise.resolve(TM.FactionIndex.rebuild());
      }
    } catch(_fxE) { _rethrowCriticalFinalizeFailure('faction-index', _fxE, ctx); }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.FactionDerived && TM.FactionDerived.compute) {
        await Promise.resolve(TM.FactionDerived.compute());
      }
    } catch(_dhE) { _rethrowCriticalFinalizeFailure('faction-derived-health', _dhE, ctx); }
    try {
      if (typeof window !== 'undefined' && window.TM) {
        if (TM.FactionDerivedEconomy && TM.FactionDerivedEconomy.compute) await Promise.resolve(TM.FactionDerivedEconomy.compute());
        if (TM.FactionDerivedCohesion && TM.FactionDerivedCohesion.compute) await Promise.resolve(TM.FactionDerivedCohesion.compute());
        if (TM.FactionDerivedStrength && TM.FactionDerivedStrength.compute) await Promise.resolve(TM.FactionDerivedStrength.compute());
      }
    } catch(_dxE) { _rethrowCriticalFinalizeFailure('faction-derived-ledgers', _dxE, ctx); }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.FactionNpcMemorial && TM.FactionNpcMemorial.generate) {
        await Promise.resolve(TM.FactionNpcMemorial.generate());
      }
    } catch(_npcmE) { _rethrowCriticalFinalizeFailure('npc-memorial', _npcmE, ctx); }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.FactionNpcEdict && TM.FactionNpcEdict.generate) {
        await Promise.resolve(TM.FactionNpcEdict.generate());
      }
    } catch(_npceE) { _rethrowCriticalFinalizeFailure('npc-edict', _npceE, ctx); }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.FactionNpcChaoyi && TM.FactionNpcChaoyi.generate) {
        await Promise.resolve(TM.FactionNpcChaoyi.generate());
      }
    } catch(_npccyE) { _rethrowCriticalFinalizeFailure('npc-chaoyi', _npccyE, ctx); }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.FactionNpcOffice && TM.FactionNpcOffice.generate) {
        await Promise.resolve(TM.FactionNpcOffice.generate());
      }
    } catch(_npcoE) { _rethrowCriticalFinalizeFailure('npc-office', _npcoE, ctx); }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.FactionNpcGuoku && TM.FactionNpcGuoku.generate) {
        await Promise.resolve(TM.FactionNpcGuoku.generate());
      }
    } catch(_npcgE) { _rethrowCriticalFinalizeFailure('npc-guoku', _npcgE, ctx); }
    _scheduleNpcBehaviorPostRender(ctx);
    try {
      if (typeof window !== 'undefined' && window.TM && TM.FactionNpcDispatchQueue && TM.FactionNpcDispatchQueue.scheduleTurnRuns) {
        TM.FactionNpcDispatchQueue.scheduleTurnRuns({ source: 'render-finalize' });
      }
    } catch(_npcdE) { try { console.warn('[pipeline.render-finalize] NPC LLM dispatch 调度失败', _npcdE); } catch(_){} }
    return ctx;
  }

  /** @type {PipelineStep[]} */
  var list = [
    {
      name: 'prep',
      // slice 2 + 2.5·2026-05-07·迁 6 个 prep phase
      // 0-A 情节弧兜底·0-0a 清待下诏书·0-0b ghost sweep·0-0c npc auto-appoint·0-0commit memorial decisions·0-1 init+collect·1.7 三系统更新
      // 容错：每 phase 独立 try·失败仅 warn 不抛·完成的写入 ctx.input._completedPrepPhases·legacy 按 set 跳过已完成
      // 不含 before-hooks(_origPrompt*·obstacle #6)和 plan-prefetch(scThreeSystemsAI/aiDigestLongTermActions·slice 2.6)
      fn: async function(ctx) {
        ctx.input._completedPrepPhases = ctx.input._completedPrepPhases || [];
        function _runPhase(name, body) {
          body();
          ctx.input._completedPrepPhases.push(name);
        }

        _runPhase('0-A', function(){
          if (typeof ensureCharArcsBeforeEndturn === 'function') ensureCharArcsBeforeEndturn();
        });

        _runPhase('0-0a', function(){
          (function _clearPE(nodes){
            (nodes||[]).forEach(function(n){
              (n.positions||[]).forEach(function(p){ if (p && p._pendingEdict) { try { delete p._pendingEdict; } catch(_){} } });
              if (n.subs) _clearPE(n.subs);
            });
          })((typeof GM !== 'undefined' && GM.officeTree) || []);
        });

        _runPhase('0-0b', function(){
          if (typeof _offSweepGhostHolders !== 'function') return;
          var _swR = _offSweepGhostHolders();
          if (_swR && _swR.swept && _swR.swept.length > 0) {
            if (!GM._edictTracker) GM._edictTracker = [];
            _swR.swept.forEach(function(g){
              GM._edictTracker.push({
                id: 'vacancy_sweep_' + Date.now() + '_' + g.name + '_' + g.pos,
                content: g.dept + '·' + g.pos + '·' + g.name + ' 已非在世·职位自动缺员。',
                category: '官缺', turn: GM.turn || 0, status: 'pending',
                _vacancyFromSweep: g
              });
            });
          }
        });

        _runPhase('0-0c', function(){
          if (typeof _npcAutoAppointVacancies !== 'function') return;
          var _napR = _npcAutoAppointVacancies();
          if (_napR && _napR.appointed && _napR.appointed.length > 0) {
            if (!GM._chronicle) GM._chronicle = [];
            _napR.appointed.forEach(function(a){
              if (typeof TM !== 'undefined' && TM.Chronicle) TM.Chronicle.record({
                turn: GM.turn || 0, date: GM._gameDate || '',
                type: 'NPC任命',
                text: a.faction + ' 内部任命：' + a.dept + '·' + a.pos + ' 以 ' + a.charName + ' 充。',
                tags: ['官职','NPC','任命']
              });
            });
          }
        });

        _runPhase('0-0commit', function(){
          if (typeof _commitMemorialDecisions === 'function') _commitMemorialDecisions();
        });

        // 0-1 init+collect·必须成功才能填 ctx.input·失败则不 mark
        if (typeof _endTurn_init === 'function' && typeof _endTurn_collectInput === 'function') {
          try {
            var npcContext = _endTurn_init();
            var input = _endTurn_collectInput();
            if (input && typeof input === 'object') {
              Object.keys(input).forEach(function(k){ ctx.input[k] = input[k]; });
            }
            ctx.input.npcContext = npcContext;
            ctx.snapshots.prevGuoku = GM._prevGuoku;
            ctx.snapshots.prevNeitang = GM._prevNeitang;
            ctx.snapshots.prevPopulation = GM._prevPopulation;
            // [slice 7b·2026-05-08] 镜像到 GM._turnTyrantActivities·prompt.js / render.js 读 GM 兜底
            // 原 legacy 在 core.js line 191 set·删 legacy 后由 pipeline prep 接管
            if (typeof GM !== 'undefined') {
              GM._turnTyrantActivities = input.tyrantActivities || [];
            }
            if (TM.RecoveryEdict) {
              var recoveryReceipts = await TM.RecoveryEdict.flush({signal:ctx.signal||ctx.meta&&ctx.meta.signal});
              ctx.input.emergencyReceipts = recoveryReceipts;
              if (typeof _recordEdictRecoveryResults === 'function') _recordEdictRecoveryResults(recoveryReceipts);
            }
            ctx.input._completedPrepPhases.push('0-1');
          } catch(e) {
            try { console.warn('[pipeline.prep] 0-1 init+collect failed', e); } catch(_){}
            throw e;
          }
        }

        _runPhase('1.7', function(){
          if (typeof updateThreeSystemsOnEndTurn === 'function') updateThreeSystemsOnEndTurn();
        });

        return ctx;
      },
      onError: 'abort',
      reads: ['GM.guoku', 'GM.neitang', 'GM.population', 'GM.chars', 'GM.memorials', 'GM.edicts', 'GM.officeTree', 'GM.facs', 'GM.partyState', 'GM.armies'],
      writes: ['GM._prevGuoku', 'GM._prevNeitang', 'GM._prevPopulation', 'GM._edictTracker', 'GM._chronicle', 'GM.officeTree', 'GM.facs', 'GM.partyState', 'GM.armies', 'ctx.input.*', 'ctx.snapshots.*', 'ctx.input._completedPrepPhases']
    },
    {
      name: 'plan-prefetch',
      // slice 2.6·2026-05-07·迁 scThreeSystemsAI(1.75) + aiDigestLongTermActions(1.8) 两个 prefetch promise 启动
      // before-hooks 暂不动·留 slice 2.7 (audit 障碍 #6·_origPrompt* 命名约定 paradigm 重构)
      // 启动后立刻返回·promise 在后台跑·legacy 通过 ctx.subcalls.preXxxP 拿到这两个 promise·Phase 2 时 await
      // 跟 prep 一样·flag _planPrefetchKickedOff=true 让 legacy 跳过双 kickoff·防 token 双烧
      fn: async function(ctx) {
        // 正式 Agent 与 LLM 是入口互斥的平行模式。两个 prefetch 都是 LLM 支路的
        // 提示词缓存，Agent 只复用确定性 prompt builder 的局势依据，不应暗中启动
        // 另一模式的模型调用。标成 kicked-off 是为了阻止任何 legacy 路径补启动。
        var _mc = TM.Endturn && TM.Endturn.ModeContract;
        var _selectedMode = (_mc && typeof _mc.selectedMode === 'function')
          ? _mc.selectedMode(typeof P !== 'undefined' ? P : null)
          : ((typeof agentModeOn === 'function' && agentModeOn()) ? 'agent' : 'llm');
        if (_selectedMode === 'agent') {
          ctx.meta = ctx.meta || {};
          ctx.meta.aiMode = 'agent';
          ctx.input._agentPlanPrefetchSkipped = true;
          ctx.input._planPrefetchKickedOff = true;
          return ctx;
        }
        ctx.subcalls = ctx.subcalls || {};
        try {
          if (typeof scThreeSystemsAI === 'function') {
            ctx.subcalls.preThreeSystemsP = _scheduleEndturnIdleBackground('endTurn] pre three systems AI', function() {
              return scThreeSystemsAI();
            }).catch(function(e){
              try { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] pre three systems AI') : console.warn('[endTurn] pre three systems AI failed', e); } catch(_){}
            });
          }
        } catch(_nDE) { try { console.warn('[pipeline.plan-prefetch] 1.75 scThreeSystemsAI kickoff failed', _nDE); } catch(_){} }
        try {
          if (typeof aiDigestLongTermActions === 'function' && typeof P !== 'undefined' && P.ai && P.ai.key) {
            try {
              if (typeof _buildLongTermActionsDigest === 'function' && typeof GM !== 'undefined') {
                var _rawLt = _buildLongTermActionsDigest();
                if (_rawLt && _rawLt.length >= 30 && (!GM._longTermDigest || GM._longTermDigest.turn !== GM.turn)) {
                  GM._longTermDigest = { text: _rawLt, generatedAt: GM.turn, turn: GM.turn, _fromRaw: true, _prefetchFallback: true };
                }
              }
            } catch(_rawLtE) { try { console.warn('[pipeline.plan-prefetch] long-term raw fallback failed', _rawLtE); } catch(_){} }
            ctx.subcalls.preLongTermP = _scheduleEndturnIdleBackground('endTurn] long-term digest', function() {
              return aiDigestLongTermActions();
            }).catch(function(e){
              try { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] long-term digest') : console.warn('[endTurn] long-term digest failed', e); } catch(_){}
            });
          }
        } catch(_ltdE) { try { console.warn('[pipeline.plan-prefetch] 1.8 aiDigestLongTermActions kickoff failed', _ltdE); } catch(_){} }
        ctx.input._planPrefetchKickedOff = true;
        return ctx;
      },
      onError: 'continue',  // 预热失败不阻断主管道
      parallel: ['scThreeSystemsAI', 'aiDigestLongTermActions'],
      reads: ['GM.facs', 'GM.partyState', 'GM.armies', 'GM.edicts', 'GM._chronicle', 'P.ai.key'],
      writes: ['ctx.subcalls.preThreeSystemsP', 'ctx.subcalls.preLongTermP', 'ctx.input._planPrefetchKickedOff']
    },
    {
      name: 'ai',
      // slice 3a·2026-05-07·先调现存的 _endTurn_aiInfer 整体捕获到 ctx.results.aiResult
      // _endTurn_aiInfer 内部已经在用 ctx (ai-infer.js L43)·slice 3b/3c 再把内部 ctx 跟管道 ctx 合一·消除 _turnAiResults GM 中介
      // 同时 await plan-prefetch 启动的两个 promise·确保 AI 推演前数据齐全
      // failure 抛出·executor 按 onError='abort' 处理；已选模式本回合终止，不跨模式兜底重跑。
      fn: async function(ctx) {
        // 正式 LLM/Agent 是入口互斥的平行模式：选中 Agent 后，本回合绝不静默穿越到 LLM 主流程。
        // 两条支路只在共同 aiResult 契约处汇合；Agent 失败由其快照回滚后向外抛，本回合中止并让玩家重试/切模式。
        var _mc = TM.Endturn && TM.Endturn.ModeContract;
        var _selectedMode = (_mc && typeof _mc.selectedMode === 'function')
          ? _mc.selectedMode(typeof P !== 'undefined' ? P : null)
          : ((typeof agentModeOn === 'function' && agentModeOn()) ? 'agent' : 'llm');
        ctx.meta = ctx.meta || {};
        ctx.meta.aiMode = _selectedMode;
        if (_selectedMode === 'agent') {
          ctx.input._agentModeSelected = true;
          if (!(TM.Endturn && TM.Endturn.AgentMode && typeof TM.Endturn.AgentMode.run === 'function')) {
            if (_mc && _mc.ModeExecutionError) throw new _mc.ModeExecutionError('agent', 'agent-module-missing', 'Agent 模式模块未加载');
            throw new Error('Agent 模式模块未加载');
          }
          var _agentRes = await TM.Endturn.AgentMode.run(ctx);
          if (!_agentRes || !_agentRes.ok || _agentRes.fallback) {
            var _agentReason = (_agentRes && _agentRes.reason) || 'Agent 模式未形成可提交结果';
            if (_mc && _mc.ModeExecutionError) throw new _mc.ModeExecutionError('agent', 'agent-run-failed', _agentReason, _agentRes || {});
            throw new Error(_agentReason);
          }
          var _agentResult = _agentRes.aiResult;
          if (_mc && typeof _mc.normalizeResult === 'function') _agentResult = _mc.normalizeResult(_agentResult, 'agent');
          if (_mc && typeof _mc.validateResult === 'function') {
            var _agentContract = _mc.validateResult(_agentResult, 'agent');
            ctx.meta.aiModeContract = _agentContract;
            if (!_agentContract.ok) throw new _mc.ModeExecutionError('agent', 'agent-result-invalid', _agentContract.problems.join('；'), _agentContract);
          }
          if (TM.RecoveryReview) _agentResult = TM.RecoveryReview.reviewAgentResult(ctx,_agentResult);
          else ctx.meta.emergencyReview={status:'pending',nonBlocking:true,reason:'复核模块尚未加载'};
          if (TM.MemoryModeBridge) TM.MemoryModeBridge.archive(typeof GM !== "undefined" ? GM : ctx.GM, _agentResult, ctx);
          ctx.results.aiResult = _agentResult;
          ctx.input._aiInferRan = true;
          ctx.input._agentModeRan = true;
          return ctx;
        }
        if (typeof _endTurn_aiInfer !== 'function') return ctx;
        // await plan-prefetch 启动的 promise·legacy Phase 2 同样 await·此处仅确保 ai 调用前数据齐
        // plan-prefetch is intentionally not awaited here. If it finishes before prompt
        // construction, its cache is used; otherwise current-turn deterministic fallbacks
        // stay in GM and the AI summary updates later.
        // [slice 3c.1·2026-05-07] 把 ctx 作为 5th arg·_endTurn_aiInfer 在 finalize 前 copy 内部 ctx 字段过来
        // 这样 pipeline ctx.results 看得到全部 sc0-sc28·不只是最终 aiResult
        var aiResult = await _endTurn_aiInfer(
          ctx.input.edicts || [],
          ctx.input.xinglu,
          ctx.input.memRes,
          ctx.input.oldVars,
          ctx
        );
        if (_mc && typeof _mc.normalizeResult === 'function') aiResult = _mc.normalizeResult(aiResult, 'llm');
        ctx.results.aiResult = aiResult;
        if (_mc && typeof _mc.validateResult === 'function') ctx.meta.aiModeContract = _mc.validateResult(aiResult, 'llm');
        if (TM.Endturn && TM.Endturn.Validity && typeof TM.Endturn.Validity.validateBeforeCommit === 'function') {
          var validity = TM.Endturn.Validity.validateBeforeCommit(ctx);
          ctx.meta.endturnValidity = validity;
          try { if (typeof GM !== 'undefined') GM._lastEndturnValidity = validity; } catch(_) {}
          if (validity && validity.status === 'failed') {
            try { if (typeof hideLoading === 'function') hideLoading(); } catch(_) {}
            try { if (typeof toast === 'function') toast('本回合 AI 推演失败，未推进回合；请重试或检查 AI 诊断。'); } catch(_) {}
            if (TM.Endturn.Validity.EndturnInvalidResultError) {
              throw new TM.Endturn.Validity.EndturnInvalidResultError(validity);
            }
            throw new Error('本回合 AI 推演未形成可提交结果');
          }
        }
        ctx.input._aiInferRan = true;
        return ctx;
      },
      onError: 'abort',  // AI 失败核心 step·直接停管道·防 GM 写半截
      reads: ['GM.chars', 'GM.facs', 'GM.officeTree', 'GM._capital', 'GM._aiMemory', 'GM._consolidatedMemory', 'GM._edictTracker', 'ctx.subcalls.preThreeSystemsP', 'ctx.subcalls.preLongTermP'],
      writes: ['ctx.results.aiResult', 'GM._turnAiResults (兜底镜像)', 'GM._postTurnJobs', 'GM._aiMemory', 'GM._epitaphs', 'ctx.input._aiInferRan']
    },
    {
      name: 'post-ai-edict',
      // slice 4·2026-05-07·迁 Phase 2.5 (applyEdictActions) + Phase 2.6 (TyrantActivitySystem.applyEffects)
      // 不含 Phase 3.5 (aiEdictEfficacyAudit·已后台化·依赖 aiResult+edicts·留 slice 5/7 一并)
      // tyrantResult 存 ctx.results.tyrantResult·legacy render 通过 ctx 读
      // ★御驾亲征(原 goujia-qinzheng 顶层 step·2026-06 折回本 step 头部·守 audit §4 六段规范)·
      //   会战阶段:AI 推演已解算·涉玩家势力军的战斗被咽喉拦截入延后队列·此处亲征/委之·严格保位(先于诏令应用)·
      //   flag GM._yujiaQinzheng 默认 OFF → pending 恒空 → runPending no-op → 零行为变更·自带 try/catch 不外抛
      fn: async function(ctx) {
        if (typeof window !== 'undefined' && window.TMBattleTurn && typeof window.TMBattleTurn.runPending === 'function') {
          await window.TMBattleTurn.runPending(typeof GM !== 'undefined' ? GM : null);
        }
        if (!ctx.input._agentEdictActionsApplied && typeof applyEdictActions === 'function') {
          var ea = ctx.input.edictActions;
          if (ea && ((ea.appointments && ea.appointments.length) || (ea.dismissals && ea.dismissals.length) || (ea.deaths && ea.deaths.length) || (ea.armyBuilds && ea.armyBuilds.length) || (ea.rewards && ea.rewards.length) || (ea.payArrears && ea.payArrears.length))) {
            applyEdictActions(ea);
          }
        }
        // G2·step 0a·Path C·扫 ctx.input.edicts 文本·识别 enke keyword → 路由到 _kjG2OnEnkeApproved (或 pending queue)
        if (!ctx.input._agentEdictKeywordActionsApplied) {
          if (typeof _kjG2ScanCtxInputEdictsForEnke === 'function' && ctx.input && ctx.input.edicts) {
            var enkeActions = _kjG2ScanCtxInputEdictsForEnke(ctx.input.edicts);
            if (enkeActions && enkeActions.length && typeof _kjG2OnEnkeApprovedViaEdict === 'function') {
              for (var ei = 0; ei < enkeActions.length; ei++) {
                _kjG2OnEnkeApprovedViaEdict(enkeActions[ei]);
              }
            }
          }
        }
        // G3·RAA·C1·扫 ctx.input.edicts 识别 wuju keyword (跟 G2 同 paradigm)
        if (!ctx.input._agentEdictKeywordActionsApplied) {
          if (typeof _kjG3ScanCtxInputEdictsForWuju === 'function' && ctx.input && ctx.input.edicts) {
            var wujuActions = _kjG3ScanCtxInputEdictsForWuju(ctx.input.edicts);
            if (wujuActions && wujuActions.length && typeof _kjG3OnWujuApprovedViaEdict === 'function') {
              for (var wi = 0; wi < wujuActions.length; wi++) {
                _kjG3OnWujuApprovedViaEdict(wujuActions[wi]);
              }
            }
          }
        }
        // G5·扫 tongzi keyword
        if (!ctx.input._agentEdictKeywordActionsApplied) {
          if (typeof _kjG5ScanCtxInputEdictsForTongzi === 'function' && ctx.input && ctx.input.edicts) {
            var tongziActions = _kjG5ScanCtxInputEdictsForTongzi(ctx.input.edicts);
            if (tongziActions && tongziActions.length && typeof _kjG5OnTongziApprovedViaEdict === 'function') {
              for (var ti = 0; ti < tongziActions.length; ti++) {
                _kjG5OnTongziApprovedViaEdict(tongziActions[ti]);
              }
            }
          }
        }
        // F6·扫时政记 (AI 推演输出)·覆盖"诏书未明写但 AI 在叙事中体现开恩科"的情况
        // 复用 3 个 ScanCtxInputEdictsForX·passing string (parser 已加 negative gate 防"罢/未/搁置"误识别)
        var _ar = ctx.results && ctx.results.aiResult;
        if (_ar && !ctx.input._agentModeRan) {
            var _shizhengTxt = [_ar.shizhengji || '', _ar.zhengwen || '', _ar.shilu || ''].join('\n');
            if (_shizhengTxt.trim()) {
              if (typeof _kjG2ScanCtxInputEdictsForEnke === 'function' && typeof _kjG2OnEnkeApprovedViaEdict === 'function') {
                var sjEnke = _kjG2ScanCtxInputEdictsForEnke(_shizhengTxt);
                for (var sei = 0; sei < (sjEnke && sjEnke.length || 0); sei++) {
                  sjEnke[sei]._sourceCategory = 'shizhengji';
                  _kjG2OnEnkeApprovedViaEdict(sjEnke[sei]);
                }
              }
              if (typeof _kjG3ScanCtxInputEdictsForWuju === 'function' && typeof _kjG3OnWujuApprovedViaEdict === 'function') {
                var sjWuju = _kjG3ScanCtxInputEdictsForWuju(_shizhengTxt);
                for (var swi = 0; swi < (sjWuju && sjWuju.length || 0); swi++) {
                  sjWuju[swi]._sourceCategory = 'shizhengji';
                  _kjG3OnWujuApprovedViaEdict(sjWuju[swi]);
                }
              }
              if (typeof _kjG5ScanCtxInputEdictsForTongzi === 'function' && typeof _kjG5OnTongziApprovedViaEdict === 'function') {
                var sjTongzi = _kjG5ScanCtxInputEdictsForTongzi(_shizhengTxt);
                for (var sti = 0; sti < (sjTongzi && sjTongzi.length || 0); sti++) {
                  sjTongzi[sti]._sourceCategory = 'shizhengji';
                  _kjG5OnTongziApprovedViaEdict(sjTongzi[sti]);
                }
              }
            }
        }
        if (!ctx.input._agentTyrantActivitiesApplied && typeof TyrantActivitySystem !== 'undefined' && TyrantActivitySystem && TyrantActivitySystem.applyEffects) {
          var ta = ctx.input.tyrantActivities || (typeof GM !== 'undefined' ? GM._turnTyrantActivities : null) || [];
          if (ta.length > 0) {
            ctx.results.tyrantResult = TyrantActivitySystem.applyEffects(ta);
          }
        }
        ctx.input._postAiEdictRan = true;
        return ctx;
      },
      onError: 'abort',
      reads: ['ctx.input.edictActions', 'ctx.input.tyrantActivities', 'GM.officeTree', 'GM.armies', 'ctx.results.aiResult'],
      writes: ['GM.officeTree', 'GM._tyrantHistory', 'GM._tyrantDecadence', 'ctx.results.tyrantResult', 'ctx.input._postAiEdictRan', 'GM.armies (御驾亲征战果回填)']
    },
    {
      name: 'systems',
      // slice 5·2026-05-07·迁 Phase 3 (_endTurn_updateSystems·50+ engine.tick·唯一 GM.turn++) + Phase 3.5 (aiEdictEfficacyAudit 后台 enqueue)
      // queueResult 存 ctx.results.queueResult·legacy render 通过 ctx 读
      fn: async function(ctx) {
        var ar = ctx.results.aiResult || {};
        var timeRatio = (ar.timeRatio != null) ? ar.timeRatio : (typeof getTimeRatio === 'function' ? getTimeRatio() : 0);
        var zhengwen = ar.zhengwen || '';
        // 【模式 b · S5 甲案 engine-first】agent 分支可能已在 agent 之前提前跑过引擎(给硬核基线)并置 ctx.input._systemsRan·
        //   此处**幂等跳过引擎 tick**(防 _endTurn_updateSystems 的 GM.turn++ 与 50 tick 双跑)。
        //   mode a:_systemsRan 恒 undefined → 正常跑引擎(零回归)。下方御批回听审计照常(不受幂等影响)。
        if (!ctx.input._systemsRan && typeof _endTurn_updateSystems === 'function') {
          ctx.results.queueResult = await _endTurn_updateSystems(timeRatio, zhengwen);
        }
        // Phase 3.5·御批回听 enqueue 后台 job·依赖 aiResult+edicts·两者都已在 ctx
        try {
          // Agent 模式拥有自己的诏令监察；平行模式不得再混入 LLM 的 efficacy audit。
          if (!ctx.input._agentModeRan && typeof aiEdictEfficacyAudit === 'function' && typeof P !== 'undefined' && P.ai && P.ai.key) {
            // 【诏令执行督查 agent·S2】开关开且未回落时·督查 agent 接管(追所有活诏令跨回合生命周期)·此写死审计跳；默认关/连失回落 → aiEdictEfficacyAudit 原样跑零回归
            var _gmEO = (typeof GM !== 'undefined') ? GM : (typeof window !== 'undefined' ? window.GM : null);
            var _runEdictAudit = function(){
              try { if (typeof window !== 'undefined' && window.TM && window.TM.EdictOversight && _gmEO && window.TM.EdictOversight.shouldHandle(_gmEO)) return window.TM.EdictOversight.run(_gmEO); } catch(_eoE){}
              return aiEdictEfficacyAudit(ar, ctx.input.edicts || []);
            };
            if (typeof _enqueuePostTurnJob === 'function') {
              _enqueuePostTurnJob('edict_efficacy', function(){
                return Promise.resolve(_runEdictAudit()).catch(function(e){ try { console.warn('[pipeline.systems] 御批回听后台失败', e); } catch(_){} });
              });
            } else {
              await _runEdictAudit();
            }
          }
        } catch(_efE) { try { console.warn('[pipeline.systems] 御批回听失败', _efE); } catch(_){} }
        // ★军工供应链(原 armory-production 顶层 step·2026-06 折回 systems 尾部·守 audit §4 六段规范:
        //   systems 含全部子系统 tick·军工亦是其一·不另起顶层 step)·地块矿冶产原料→军工建筑耗料产军备 + 战马走马政·
        //   纯增量·只加 GM.guoku.armory/materials；属于资源账本，失败必须中止并回滚整回合。
        try {
          if (typeof window !== 'undefined' && window.TMArmory && typeof window.TMArmory.runTurn === 'function' && typeof GM !== 'undefined' && GM) {
            await Promise.resolve(window.TMArmory.runTurn(GM, {}));
          }
        } catch (e) { _rethrowCriticalFinalizeFailure('armory-production', e, ctx); }
        ctx.input._systemsRan = true;
        return ctx;
      },
      onError: 'abort',  // 子系统推进失败防 GM 写半截
      reads: ['GM.turn', 'GM.chars', 'GM.culturalWorks', 'GM._energy', 'GM.facs', 'ctx.results.aiResult', 'ctx.input.edicts', 'GM.adminHierarchy'],
      writes: ['GM.turn (++)', 'GM.guoku', 'GM.neitang', 'GM.huji', 'GM.environment', 'GM._forgottenWorks', 'GM._postTurnJobs', 'ctx.results.queueResult', 'ctx.input._systemsRan', 'GM.guoku.armory', 'GM.guoku.materials']
    },
    {
      name: 'render-and-finalize',
      // slice 6·2026-05-07·迁 Phase 4 (render) + 4.5 (court meter) + 4.6 (char travel) + 5 (after hooks + keju) + 5.3 (AI memory)
      // 仅常见路径 (shijiModal courtDone !== false)·deferred 路径 (后朝进行中) 留 slice 6.5 改 ctx.deferredSteps paradigm
      fn: async function(ctx) {
        // 早设 flag·若 render 抛错也防止 legacy 重跑同一段·两次 push 灾难
        ctx.input._renderFinalizeRan = true;
        var ar = ctx.results.aiResult || {};
        _normalizeTurnChangesForRender(ctx);
        var changeReportHtml = '';
        try {
          if (typeof generateChangeReport === 'function' && typeof _renderUnifiedChanges !== 'function') {
            changeReportHtml = generateChangeReport() || '';
          }
        } catch(_changeReportE) {
          ctx.results.changeReportError = _changeReportE;
          try {
            if (typeof window !== 'undefined' && window.TM && TM.errors && TM.errors.capture) {
              TM.errors.capture(_changeReportE, 'pipeline.render-finalize] legacy change report failed');
            } else {
              console.warn('[pipeline.render-finalize] legacy change report failed', _changeReportE);
            }
          } catch(_) {}
        }
        // 注：oldVars 在 ctx.input·edicts/xinglu 同；记录最终化在 core 的 commit barrier 前统一执行。
        try {
          if (typeof window !== 'undefined' && window.TM && TM.SocialPoliticalSignals && typeof TM.SocialPoliticalSignals.recordTurnResult === 'function') {
            ctx.results.turnResultSocialSignals = await Promise.resolve(TM.SocialPoliticalSignals.recordTurnResult(GM, ctx, {
              source: 'turn-result-ai',
              turn: GM && GM.turn
            }));
            if (ctx.results.turnResultSocialSignals && ctx.results.turnResultSocialSignals.recorded > 0) {
              if (TM.PartyClassSignalBridge && typeof TM.PartyClassSignalBridge.applyPending === 'function') {
                ctx.results.turnResultSignalApply = await Promise.resolve(TM.PartyClassSignalBridge.applyPending(GM, {
                  source: 'turn-result-ai',
                  turn: GM && GM.turn
                }));
              } else if (typeof TM.SocialPoliticalSignals.applyPending === 'function') {
                ctx.results.turnResultSignalApply = await Promise.resolve(TM.SocialPoliticalSignals.applyPending(GM, {
                  source: 'turn-result-ai',
                  turn: GM && GM.turn
                }));
              }
            }
          }
        } catch(_turnResultSignalE) {
          ctx.results.turnResultSocialSignalError = _turnResultSignalE;
          _rethrowCriticalFinalizeFailure('turn-result-social-signals', _turnResultSignalE, ctx);
        }
        var _renderArgs = [
          ar.shizhengji || '',
          ar.zhengwen || '',
          ar.playerStatus || '',
          ar.playerInner || '',
          ctx.input.edicts || [],
          ctx.input.xinglu,
          ctx.input.oldVars,
          changeReportHtml,
          ctx.results.queueResult || null,
          (ar.suggestions || []),
          ctx.results.tyrantResult || null,
          ar.turnSummary || '',
          ar.shiluText || '',
          ar.szjTitle || '',
          ar.szjSummary || '',
          ar.personnelChanges || [],
          ar.hourenXishuo || '',
          {
            basis_refs: ar.basis_refs || ar.basisRefs || [],
            source: 'sc1d'
          }
        ];
        ctx.meta.turnRenderArgs = _renderArgs;
        // [slice 6.5·2026-05-07] deferred 路径·shijiModal 后朝进行中
        // 暂存 payload + 用 ctx.deferredSteps 显式登记 phase5·替代闭包模式 (audit 决定 2)
        // 兼容性：仍 mirror 到 _pendingShijiModal.deferredPhase5·让 legacy 触发器继续工作
        if (typeof GM !== 'undefined' && GM._pendingShijiModal && GM._pendingShijiModal.courtDone === false) {
          ctx.meta.deferEndTurnSave = true;
          GM._pendingShijiModal.aiReady = true;
          GM._pendingShijiModal.payload = _renderArgs;
          if (typeof _updatePostTurnCourtBanner === 'function') _updatePostTurnCourtBanner('aiReady');
          if (typeof hideLoading === 'function') hideLoading();
          // 4.5/4.6 仍跑·不延后 (legacy 也是这样)
          try { if (typeof _settleCourtMeter === 'function') await Promise.resolve(_settleCourtMeter()); }
          catch(e) { _rethrowCriticalFinalizeFailure('court-meter-deferred', e, ctx); }
          try { if (typeof advanceCharTravelByDays === 'function') await Promise.resolve(advanceCharTravelByDays((typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : ((P.time && P.time.daysPerTurn) || 30))); }
          catch(e) { _rethrowCriticalFinalizeFailure('character-travel-deferred', e, ctx); }
          // Phase 5·登记到 ctx.deferredSteps·用 'court-close' as when
          ctx.deferredSteps.push({
            name: 'phase5-after-hooks-keju',
            when: 'court-close',
            fn: async function(_dctx) {
              try { if (typeof EndTurnHooks !== 'undefined' && EndTurnHooks.execute) await EndTurnHooks.execute('after'); }
              catch(e) { _rethrowCriticalFinalizeFailure('after-hooks-deferred', e, ctx); }
              if (P.keju && (P.keju.currentExam || P.keju.currentEnke) && typeof advanceKejuByDays === 'function') {
                try { await Promise.resolve(advanceKejuByDays((typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : ((P.time && P.time.daysPerTurn) || 30))); }
                catch(e) { _rethrowCriticalFinalizeFailure('keju-advance-deferred', e, ctx); }
              }
              if (P.keju && P.keju.enabled && !P.keju.currentExam && typeof checkKejuTrigger === 'function') {
                try { await checkKejuTrigger(); }
                catch(e) { _rethrowCriticalFinalizeFailure('keju-trigger-deferred', e, ctx); }
              }
              try { if (typeof _kjUpdateIndicators === 'function') _kjUpdateIndicators(_dctx || ctx); }
              catch(e) { _rethrowCriticalFinalizeFailure('keju-indicators-deferred', e, ctx); }
              // v7.1·F2/F3/F4c·D1 长尾 endTurn hooks·flag gate by P.conf.useNewKejuD1
              if (typeof _kjCheckDiscipleMemorialTriggers === 'function') {
                try { _kjCheckDiscipleMemorialTriggers(); }
                catch(e) { _rethrowCriticalFinalizeFailure('keju-disciple-memorial-deferred', e, ctx); }
              }
              if (typeof _kjCheckCohortMeetTriggers === 'function') {
                try { _kjCheckCohortMeetTriggers(); }
                catch(e) { _rethrowCriticalFinalizeFailure('keju-cohort-meet-deferred', e, ctx); }
              }
              if (typeof _kjCheckYanguanQingyiTriggers === 'function') {
                try { _kjCheckYanguanQingyiTriggers(); }
                catch(e) { _rethrowCriticalFinalizeFailure('keju-yanguan-qingyi-deferred', e, ctx); }
              }
              // Phase L·L7·ramping reform state tick + reformLean decay + memorial trigger (flag gate by P.conf.useNewKejuL7)
              if (typeof _kjpL7TickRampingReform === 'function') {
                try { _kjpL7TickRampingReform(); }
                catch(e) { _rethrowCriticalFinalizeFailure('keju-ramping-reform-deferred', e, ctx); }
              }
              if (typeof _kjpL7TickReformLeanDecay === 'function') {
                try { _kjpL7TickReformLeanDecay((typeof GM !== 'undefined' && GM.turn) || 0); }
                catch(e) { _rethrowCriticalFinalizeFailure('keju-reform-lean-deferred', e, ctx); }
              }
              if (typeof _kjCheckReformMemorialTriggers === 'function') {
                try { _kjCheckReformMemorialTriggers(); }
                catch(e) { _rethrowCriticalFinalizeFailure('keju-reform-memorial-deferred', e, ctx); }
              }
              // Phase G·G2·step 0·event hook watchers (探 emperor 帝崩 + war_state 平乱·SET _lastReignChangeYear / _lastPlatformDisasterYear)
              if (typeof _kjEventCheckReignTransition === 'function') {
                try { _kjEventCheckReignTransition(); }
                catch(e) { _rethrowCriticalFinalizeFailure('keju-reign-transition-deferred', e, ctx); }
              }
              if (typeof _kjEventCheckWarStateRecovery === 'function') {
                try { _kjEventCheckWarStateRecovery(); }
                catch(e) { _rethrowCriticalFinalizeFailure('keju-war-recovery-deferred', e, ctx); }
              }
              // Phase G·G1·特科 trigger check (flag gate by P.conf.useNewKejuD2 inside)
              // 注·watchers 先于 G1 check·让 G1 当 turn 即可读到 fresh _last*Year 字段
              if (typeof _kjCheckSpecialExamTriggers === 'function') {
                try { _kjCheckSpecialExamTriggers(); }
                catch(e) { _rethrowCriticalFinalizeFailure('keju-special-exam-deferred', e, ctx); }
              }
              // Phase J·J4·科场弊案 trigger check (flag gate by P.conf.useNewKejuScandal inside)
              if (typeof _kjCheckScandalTriggers === 'function') {
                try { _kjCheckScandalTriggers(); }
                catch(e) { _rethrowCriticalFinalizeFailure('keju-scandal-deferred', e, ctx); }
              }
              // Phase L·L8·evolution tick (在 L7 tick 之后·状态推进先于 evolve·flag gate by P.conf.useNewKejuL8)
              if (typeof _kjpL8EvolveTick === 'function') {
                try { _kjpL8EvolveTick(); }
                catch(e) { _rethrowCriticalFinalizeFailure('keju-evolution-deferred', e, ctx); }
              }
              // Phase L·L5·RBB·cleanup cooldown table (matured/rejected reform + dead NPC)
              if (typeof _kjpL5CleanupCooldown === 'function') {
                try { _kjpL5CleanupCooldown(); }
                catch(e) { _rethrowCriticalFinalizeFailure('keju-cooldown-deferred', e, ctx); }
              }
            }
          });
          // 兼容 legacy 触发器·把 ctx.deferredSteps 'court-close' 登记的 fn 包装成单 closure (slice 7 时移除)
          GM._pendingShijiModal.deferredPhase5 = async function() {
            try {
              for (var i = 0; i < ctx.deferredSteps.length; i++) {
                var step = ctx.deferredSteps[i];
                if (step.when === 'court-close') {
                  await step.fn(ctx);
                }
              }
              await _runPostRenderTurnOpeners(ctx);
              ctx.meta.deferEndTurnSave = false;
              if (typeof _finishPostTurnCourtState === 'function') _finishPostTurnCourtState();
              if (typeof _tmFinalizeEndTurnTransaction !== 'function') throw new Error('朝会收官事务入口缺失');
              await _tmFinalizeEndTurnTransaction(ctx, ctx.meta.transaction);
            } catch (e) {
              try { if (typeof _tmRollbackEndTurnTransaction === 'function') _tmRollbackEndTurnTransaction(ctx.meta.transaction, e); } catch (_) {}
              throw e;
            }
          };
          return ctx; // deferred 路径完成
        }

        // 所有 GM/P 记录落账由 core 的 finalizeTurnRecords 关键阶段执行；纯 DOM 渲染只在 commit 后运行。
        if (GM._pendingShijiModal) { GM._pendingShijiModal.aiReady = false; GM._pendingShijiModal.payload = null; }
        if (typeof GM !== 'undefined') {
          GM._lastEndturnAiContext = {
            turn: GM.turn || 0,
            edicts: ctx.input.edicts || [],
            xinglu: ctx.input.xinglu || '',
            aiResult: {
              shizhengji: ar.shizhengji || '',
              zhengwen: ar.zhengwen || '',
              turnSummary: ar.turnSummary || '',
              shiluText: ar.shiluText || '',
              playerStatus: ar.playerStatus || ''
            }
          };
        }

        // Phase 4.5·勤政 streak
        try { if (typeof _settleCourtMeter === 'function') await Promise.resolve(_settleCourtMeter()); }
        catch(e) { _rethrowCriticalFinalizeFailure('court-meter', e, ctx); }

        // Phase 4.6·角色路程推进
        try { if (typeof advanceCharTravelByDays === 'function') await Promise.resolve(advanceCharTravelByDays((typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : ((P.time && P.time.daysPerTurn) || 30))); }
        catch(e) { _rethrowCriticalFinalizeFailure('character-travel', e, ctx); }

        // Phase 5·after hooks + keju·wrap 策略对齐 legacy
        // legacy 的 after-hooks 和 keju trigger 都未 wrap·pipeline 也不 wrap·error 同 propagate
        if (typeof EndTurnHooks !== 'undefined' && EndTurnHooks.execute) await EndTurnHooks.execute('after');
        if (P.keju && (P.keju.currentExam || P.keju.currentEnke) && typeof advanceKejuByDays === 'function') {
          try { await Promise.resolve(advanceKejuByDays((typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : ((P.time && P.time.daysPerTurn) || 30))); }
          catch(e) { _rethrowCriticalFinalizeFailure('keju-advance', e, ctx); }
        }
        if (P.keju && P.keju.enabled && !P.keju.currentExam && typeof checkKejuTrigger === 'function') {
          await checkKejuTrigger();
        }
        try { if (typeof _kjUpdateIndicators === 'function') _kjUpdateIndicators(ctx); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-indicators', e, ctx); }
        // v7.1·F2/F3/F4c·D1 长尾 endTurn hooks·flag gate by P.conf.useNewKejuD1
        try { if (typeof _kjCheckDiscipleMemorialTriggers === 'function') _kjCheckDiscipleMemorialTriggers(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-disciple-memorial', e, ctx); }
        try { if (typeof _kjCheckCohortMeetTriggers === 'function') _kjCheckCohortMeetTriggers(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-cohort-meet', e, ctx); }
        try { if (typeof _kjCheckYanguanQingyiTriggers === 'function') _kjCheckYanguanQingyiTriggers(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-yanguan-qingyi', e, ctx); }
        // Phase L·L7·ramping reform state tick + reformLean decay + memorial trigger
        try { if (typeof _kjpL7TickRampingReform === 'function') _kjpL7TickRampingReform(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-ramping-reform', e, ctx); }
        try { if (typeof _kjpL7TickReformLeanDecay === 'function') _kjpL7TickReformLeanDecay((typeof GM !== 'undefined' && GM.turn) || 0); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-reform-lean', e, ctx); }
        try { if (typeof _kjCheckReformMemorialTriggers === 'function') _kjCheckReformMemorialTriggers(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-reform-memorial', e, ctx); }
        // Phase G·G2·step 0·event hook watchers (先于 G1)·SET _last*Year 字段
        try { if (typeof _kjEventCheckReignTransition === 'function') _kjEventCheckReignTransition(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-reign-transition', e, ctx); }
        try { if (typeof _kjEventCheckWarStateRecovery === 'function') _kjEventCheckWarStateRecovery(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-war-recovery', e, ctx); }
        // G2·RBB·BB2/BB3·resume + drain hooks·BB9 prune·BB15 cross-scenario reset
        try { if (typeof _kjG2MaybeResetCrossScenarioFields === 'function') _kjG2MaybeResetCrossScenarioFields(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-cross-scenario-reset', e, ctx); }
        try { if (typeof _kjG2ResumeEnkeXieendaIfPending === 'function') _kjG2ResumeEnkeXieendaIfPending(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-xieenda-resume', e, ctx); }
        try { if (typeof _kjG2ConsumePendingEnkeFromEdict === 'function') _kjG2ConsumePendingEnkeFromEdict(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-pending-edict', e, ctx); }
        try { if (typeof _kjG2PruneDeadEnkePartyMembers === 'function') _kjG2PruneDeadEnkePartyMembers(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-enke-party-prune', e, ctx); }
        try { if (typeof _kjG2PruneExpiredEnkeSuggestions === 'function') _kjG2PruneExpiredEnkeSuggestions(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-suggestion-prune', e, ctx); }
        try { if (typeof _kjG2NukeStaleEnkeWenduiContext === 'function') _kjG2NukeStaleEnkeWenduiContext(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-wendui-cleanup', e, ctx); }
        // G3·RBB·BB1·nuke stale wuju wendui context (跟 G2 同 paradigm)
        try { if (typeof _kjG3NukeStaleWujuWenduiContext === 'function') _kjG3NukeStaleWujuWenduiContext(); }
        catch(e) { _rethrowCriticalFinalizeFailure('wuju-wendui-cleanup', e, ctx); }
        // G3·step 0-L·wire G3 hooks
        try { if (typeof _kjG3ResumeWuJiaoyueDaIfPending === 'function') _kjG3ResumeWuJiaoyueDaIfPending(); }
        catch(e) { _rethrowCriticalFinalizeFailure('wuju-resume', e, ctx); }
        try { if (typeof _kjG3WujinshiHealthTick === 'function') _kjG3WujinshiHealthTick(); }
        catch(e) { _rethrowCriticalFinalizeFailure('wuju-health', e, ctx); }
        try {
          if (typeof _kjG3MaybeAddBattleRecord === 'function' && Array.isArray(GM && GM.chars)) {
            // 武进士 chars 战功 tick·每 turn 每人按 prob
            GM.chars.forEach(function(ch) {
              if (ch && ch._origin === 'wuju' && ch.alive !== false) {
                _kjG3MaybeAddBattleRecord(ch);
              }
            });
          }
        } catch(e) { _rethrowCriticalFinalizeFailure('wuju-battle-record', e, ctx); }
        try { if (typeof _kjG3CheckWujuAbolitionTrigger === 'function') _kjG3CheckWujuAbolitionTrigger(); }
        catch(e) { _rethrowCriticalFinalizeFailure('wuju-abolition', e, ctx); }
        // G5·wire tongzi hooks
        try { if (typeof _kjG5ResumeFumoCeremonyIfPending === 'function') _kjG5ResumeFumoCeremonyIfPending(); }
        catch(e) { _rethrowCriticalFinalizeFailure('tongzi-fumo-resume', e, ctx); }
        try { if (typeof _kjG5TongziHealthTick === 'function') _kjG5TongziHealthTick(); }
        catch(e) { _rethrowCriticalFinalizeFailure('tongzi-health', e, ctx); }
        // G5 v2·annual tick (chronicle 长尾·每 5 年 1 行)
        try { if (typeof _kjG5TongziAnnualTick === 'function') _kjG5TongziAnnualTick(); }
        catch(e) { _rethrowCriticalFinalizeFailure('tongzi-annual', e, ctx); }
        try { if (typeof _kjG5MaybeResetCrossScenarioFields === 'function') _kjG5MaybeResetCrossScenarioFields(); }
        catch(e) { _rethrowCriticalFinalizeFailure('tongzi-cross-scenario-reset', e, ctx); }
        // G3·RAA·M4·武勋世家 endTurn retrigger·世家成员战死 cleanup
        try { if (typeof _kjG3DetectMartialClan === 'function') _kjG3DetectMartialClan(); }
        catch(e) { _rethrowCriticalFinalizeFailure('wuju-martial-clan', e, ctx); }
        // Phase G·G1·特科 trigger check
        try { if (typeof _kjCheckSpecialExamTriggers === 'function') _kjCheckSpecialExamTriggers(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-special-exam', e, ctx); }
        // Phase J·J4·科场弊案 keyi 拉起 (检测在 deferred·此处结算渲染后弹议政)
        try { if (typeof _kjMaybeRaiseScandalKeyi === 'function') _kjMaybeRaiseScandalKeyi(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-scandal', e, ctx); }
        // Phase H·H0+H1·school network resume + tier check
        try { if (typeof _kjpResumeIfPending === 'function') _kjpResumeIfPending(); }
        catch(e) { _rethrowCriticalFinalizeFailure('school-network-resume', e, ctx); }
        // Phase H·H3·Path β·学说 weight 隐式 tick (绕 keyi·小幅漂)
        try { if (typeof _kjpHTickSubjectWeightDrift === 'function') _kjpHTickSubjectWeightDrift(); }
        catch(e) { _rethrowCriticalFinalizeFailure('school-weight-drift', e, ctx); }
        // Phase H·H5·BB1-style nuke wendui ctx
        try { if (typeof _kjpHNukeStaleSchoolWenduiContext === 'function') _kjpHNukeStaleSchoolWenduiContext(); }
        catch(e) { _rethrowCriticalFinalizeFailure('school-wendui-cleanup', e, ctx); }
        // Phase H·H8·反馈循环 tick
        try { if (typeof _kjpHTickFeedbackLoop === 'function') _kjpHTickFeedbackLoop(); }
        catch(e) { _rethrowCriticalFinalizeFailure('school-feedback-loop', e, ctx); }
        // Phase H·H9·watershed event check
        try { if (typeof _kjpHCheckWatershedEvents === 'function') _kjpHCheckWatershedEvents(); }
        catch(e) { _rethrowCriticalFinalizeFailure('school-watershed', e, ctx); }
        // Phase H·R1·M2 fix·讲会 endTurn 自动 trigger (每 5 年 + flourishing + 5% prob)
        try { if (typeof _kjpHMaybeAutoTriggerLecture === 'function') _kjpHMaybeAutoTriggerLecture(); }
        catch(e) { _rethrowCriticalFinalizeFailure('school-auto-lecture', e, ctx); }
        // G3·RAA·C4·元朝 spawn stuck cleanup·F5·移到 G1 spawn 之后 (spawn-then-clean·避当 turn 漏)
        try { if (typeof _kjG3CleanupYuanStuckWujuSpawn === 'function') _kjG3CleanupYuanStuckWujuSpawn(); }
        catch(e) { _rethrowCriticalFinalizeFailure('wuju-yuan-cleanup', e, ctx); }
        // Phase L·L8·evolution tick (在 L7 tick 之后)
        try { if (typeof _kjpL8EvolveTick === 'function') _kjpL8EvolveTick(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-evolution', e, ctx); }
        // Phase L·L5·RBB·cleanup cooldown table
        try { if (typeof _kjpL5CleanupCooldown === 'function') _kjpL5CleanupCooldown(); }
        catch(e) { _rethrowCriticalFinalizeFailure('keju-cooldown', e, ctx); }

        // Phase 5.3·AI memory compress·内部自检 P.ai.key·无 key 自动 noop·搬法 IIFE
        // 注：完整逻辑跨 50 行·此处 inline 简化版本·若 P.ai.key 缺则 noop (legacy 也是这逻辑)
        // 详细 legacy 还在 core.js·flag 守 legacy 跳过

        // 势力派生、NPC 奏疏/诏令/朝议/人事/财政均会写入世界状态；统一等待并失败即回滚。
        await _runPostRenderTurnOpeners(ctx);
        return ctx;
      },
      // 本 step 仅准备记录参数并执行剩余状态结算；纯 UI 渲染已移到 canonical commit 之后。
      onError: 'abort',
      reads: ['ctx.results.aiResult', 'ctx.results.queueResult', 'ctx.results.tyrantResult', 'ctx.input.edicts', 'ctx.input.xinglu', 'ctx.input.oldVars', 'GM._pendingShijiModal'],
      writes: ['GM._lastFixedExpense', 'GM._facIndex', 'GM.facs[*].derivedHealth', 'ctx.input._renderFinalizeRan', 'ctx.meta.turnRenderArgs']
    },
    {
      name: 'prepare-commit-barrier',
      fn: function(ctx) {
        // 真正存档必须晚于 core 的全部 5.3+ tail；这里只声明必须经过 commit barrier。
        ctx.meta.finalSaveRequired = true;
        return ctx;
      },
      onError: 'abort',
      reads: ['ctx.meta.deferEndTurnSave', 'GM.turn', 'GM.sid'],
      writes: ['ctx.meta.finalSaveRequired']
    }
  ];

  TM.Endturn.PipelineSteps = { list: list };
})();
