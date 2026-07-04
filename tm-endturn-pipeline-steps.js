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

  function _normalizeTurnChangesForRender() {
    try {
      if (typeof GM === 'undefined' || !GM) return;
      try { if (typeof ensureTurnChangesState === 'function') ensureTurnChangesState(); } catch(_) {}
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
    } catch(e) {
      try { console.warn('[pipeline.render-finalize] turnChanges normalize failed', e); } catch(_) {}
    }
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
    _scheduleNpcBehaviorPostRender(ctx);
    try {
      if (typeof window !== 'undefined' && window.TM && TM.FactionIndex && TM.FactionIndex.rebuild) {
        TM.FactionIndex.rebuild();
      }
    } catch(_fxE) { try { console.warn('[pipeline.render-finalize] _facIndex 重建失败', _fxE); } catch(_){} }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.FactionDerived && TM.FactionDerived.compute) {
        TM.FactionDerived.compute();
      }
    } catch(_dhE) { try { console.warn('[pipeline.render-finalize] derivedHealth 计算失败', _dhE); } catch(_){} }
    try {
      if (typeof window !== 'undefined' && window.TM) {
        if (TM.FactionDerivedEconomy && TM.FactionDerivedEconomy.compute) TM.FactionDerivedEconomy.compute();
        if (TM.FactionDerivedCohesion && TM.FactionDerivedCohesion.compute) TM.FactionDerivedCohesion.compute();
        if (TM.FactionDerivedStrength && TM.FactionDerivedStrength.compute) TM.FactionDerivedStrength.compute();
      }
    } catch(_dxE) { try { console.warn('[pipeline.render-finalize] derived B1-B3 失败', _dxE); } catch(_){} }
    _scheduleNpcBehaviorPostRender(ctx);
    try {
      if (typeof window !== 'undefined' && window.TM && TM.FactionNpcMemorial && TM.FactionNpcMemorial.generate) {
        TM.FactionNpcMemorial.generate();
      }
    } catch(_npcmE) { try { console.warn('[pipeline.render-finalize] NPC memorial 生成失败', _npcmE); } catch(_){} }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.FactionNpcEdict && TM.FactionNpcEdict.generate) {
        TM.FactionNpcEdict.generate();
      }
    } catch(_npceE) { try { console.warn('[pipeline.render-finalize] NPC edict 生成失败', _npceE); } catch(_){} }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.FactionNpcChaoyi && TM.FactionNpcChaoyi.generate) {
        TM.FactionNpcChaoyi.generate();
      }
    } catch(_npccyE) { try { console.warn('[pipeline.render-finalize] NPC chaoyi 失败', _npccyE); } catch(_){} }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.FactionNpcOffice && TM.FactionNpcOffice.generate) {
        TM.FactionNpcOffice.generate();
      }
    } catch(_npcoE) { try { console.warn('[pipeline.render-finalize] NPC office 失败', _npcoE); } catch(_){} }
    try {
      if (typeof window !== 'undefined' && window.TM && TM.FactionNpcGuoku && TM.FactionNpcGuoku.generate) {
        TM.FactionNpcGuoku.generate();
      }
    } catch(_npcgE) { try { console.warn('[pipeline.render-finalize] NPC guoku 失败', _npcgE); } catch(_){} }
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
          try { body(); ctx.input._completedPrepPhases.push(name); }
          catch(e) { try { console.warn('[pipeline.prep] ' + name + ' failed', e); } catch(_){} }
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
            ctx.input._completedPrepPhases.push('0-1');
          } catch(e) {
            try { console.warn('[pipeline.prep] 0-1 init+collect failed', e); } catch(_){}
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
      // failure 抛出·executor 按 onError='abort' 处理·legacy 兜底重跑(2x token·rare)
      fn: async function(ctx) {
        // 【模式 b · agent 模式 · S1 骨架 · 2026-06-20】分叉点(详设 docs/agent-mode-design.md)
        //   开关 agentModeEnabled 开 → 走 agent 循环(局内 Claude Code · 主动改存档+UI · 平行引擎)。
        //   S1:AgentMode.run 仅占位·返回 {fallback:true} → 此处继续走下方原 sc0-sc28·保回合完整。
        //   S4+ run 接管时返回 {ok:true,fallback:false} → 提前 return ctx·不走原管线。
        //   关(默认):整段 if 跳过 → 与原管线**字节级等同**(零回归)。
        if (typeof agentModeOn === 'function' && agentModeOn()
            && TM.Endturn && TM.Endturn.AgentMode && typeof TM.Endturn.AgentMode.run === 'function') {
          try {
            var _agentRes = await TM.Endturn.AgentMode.run(ctx);
            if (_agentRes && _agentRes.ok && !_agentRes.fallback) {
              if (_agentRes.aiResult !== undefined) ctx.results.aiResult = _agentRes.aiResult;
              ctx.input._aiInferRan = true;
              ctx.input._agentModeRan = true;
              return ctx;  // agent 模式接管本回合·不走原 LLM 管线
            }
            // fallback:true → 落到下方原管线(S1 恒如此)
          } catch (_agentErr) {
            try { console.warn('[pipeline.ai] agent-mode 异常·回落 LLM 管线', _agentErr); } catch (_) {}
          }
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
        ctx.results.aiResult = aiResult;
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
        try {
          if (typeof window !== 'undefined' && window.TMBattleTurn && typeof window.TMBattleTurn.runPending === 'function') {
            await window.TMBattleTurn.runPending(typeof GM !== 'undefined' ? GM : null);
          }
        } catch (e) { try { console.warn('[pipeline.post-ai-edict·yujia-qinzheng]', e); } catch(_){} }
        if (typeof applyEdictActions === 'function') {
          try {
            var ea = ctx.input.edictActions;
            if (ea && ((ea.appointments && ea.appointments.length) || (ea.dismissals && ea.dismissals.length) || (ea.deaths && ea.deaths.length) || (ea.armyBuilds && ea.armyBuilds.length) || (ea.rewards && ea.rewards.length) || (ea.payArrears && ea.payArrears.length))) {
              applyEdictActions(ea);
            }
          } catch(e) { try { console.warn('[pipeline.post-ai-edict] applyEdictActions failed', e); } catch(_){} }
        }
        // G2·step 0a·Path C·扫 ctx.input.edicts 文本·识别 enke keyword → 路由到 _kjG2OnEnkeApproved (或 pending queue)
        try {
          if (typeof _kjG2ScanCtxInputEdictsForEnke === 'function' && ctx.input && ctx.input.edicts) {
            var enkeActions = _kjG2ScanCtxInputEdictsForEnke(ctx.input.edicts);
            if (enkeActions && enkeActions.length && typeof _kjG2OnEnkeApprovedViaEdict === 'function') {
              for (var ei = 0; ei < enkeActions.length; ei++) {
                _kjG2OnEnkeApprovedViaEdict(enkeActions[ei]);
              }
            }
          }
        } catch(e) { try { console.warn('[pipeline.post-ai-edict] G2 enke scan', e); } catch(_){} }
        // G3·RAA·C1·扫 ctx.input.edicts 识别 wuju keyword (跟 G2 同 paradigm)
        try {
          if (typeof _kjG3ScanCtxInputEdictsForWuju === 'function' && ctx.input && ctx.input.edicts) {
            var wujuActions = _kjG3ScanCtxInputEdictsForWuju(ctx.input.edicts);
            if (wujuActions && wujuActions.length && typeof _kjG3OnWujuApprovedViaEdict === 'function') {
              for (var wi = 0; wi < wujuActions.length; wi++) {
                _kjG3OnWujuApprovedViaEdict(wujuActions[wi]);
              }
            }
          }
        } catch(e) { try { console.warn('[pipeline.post-ai-edict] G3 wuju scan', e); } catch(_){} }
        // G5·扫 tongzi keyword
        try {
          if (typeof _kjG5ScanCtxInputEdictsForTongzi === 'function' && ctx.input && ctx.input.edicts) {
            var tongziActions = _kjG5ScanCtxInputEdictsForTongzi(ctx.input.edicts);
            if (tongziActions && tongziActions.length && typeof _kjG5OnTongziApprovedViaEdict === 'function') {
              for (var ti = 0; ti < tongziActions.length; ti++) {
                _kjG5OnTongziApprovedViaEdict(tongziActions[ti]);
              }
            }
          }
        } catch(e) { try { console.warn('[pipeline.post-ai-edict] G5 tongzi scan', e); } catch(_){} }
        // F6·扫时政记 (AI 推演输出)·覆盖"诏书未明写但 AI 在叙事中体现开恩科"的情况
        // 复用 3 个 ScanCtxInputEdictsForX·passing string (parser 已加 negative gate 防"罢/未/搁置"误识别)
        try {
          var _ar = ctx.results && ctx.results.aiResult;
          if (_ar) {
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
        } catch(e) { try { console.warn('[pipeline.post-ai-edict] G2/G3/G5 shizhengji scan', e); } catch(_){} }
        if (typeof TyrantActivitySystem !== 'undefined' && TyrantActivitySystem && TyrantActivitySystem.applyEffects) {
          try {
            var ta = ctx.input.tyrantActivities || (typeof GM !== 'undefined' ? GM._turnTyrantActivities : null) || [];
            if (ta.length > 0) {
              ctx.results.tyrantResult = TyrantActivitySystem.applyEffects(ta);
            }
          } catch(e) { try { console.warn('[pipeline.post-ai-edict] tyrant applyEffects failed', e); } catch(_){} }
        }
        ctx.input._postAiEdictRan = true;
        return ctx;
      },
      onError: 'continue',
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
          if (typeof aiEdictEfficacyAudit === 'function' && typeof P !== 'undefined' && P.ai && P.ai.key) {
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
        //   纯增量·只加 GM.guoku.armory/materials·自带 try/catch 失败不阻断过回合
        try {
          if (typeof window !== 'undefined' && window.TMArmory && typeof window.TMArmory.runTurn === 'function' && typeof GM !== 'undefined' && GM) {
            window.TMArmory.runTurn(GM, {});
          }
        } catch (e) { try { console.warn('[pipeline.systems·armory-production]', e); } catch(_){} }
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
        _normalizeTurnChangesForRender();
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
        // 注：oldVars 在 ctx.input·edicts/xinglu 同
        // _renderArgs 17 字段顺序按 _endTurn_render 期望
        try {
          if (typeof window !== 'undefined' && window.TM && TM.SocialPoliticalSignals && typeof TM.SocialPoliticalSignals.recordTurnResult === 'function') {
            ctx.results.turnResultSocialSignals = TM.SocialPoliticalSignals.recordTurnResult(GM, ctx, {
              source: 'turn-result-ai',
              turn: GM && GM.turn
            });
            if (ctx.results.turnResultSocialSignals && ctx.results.turnResultSocialSignals.recorded > 0) {
              if (TM.PartyClassSignalBridge && typeof TM.PartyClassSignalBridge.applyPending === 'function') {
                ctx.results.turnResultSignalApply = TM.PartyClassSignalBridge.applyPending(GM, {
                  source: 'turn-result-ai',
                  turn: GM && GM.turn
                });
              } else if (typeof TM.SocialPoliticalSignals.applyPending === 'function') {
                ctx.results.turnResultSignalApply = TM.SocialPoliticalSignals.applyPending(GM, {
                  source: 'turn-result-ai',
                  turn: GM && GM.turn
                });
              }
            }
          }
        } catch(_turnResultSignalE) {
          ctx.results.turnResultSocialSignalError = _turnResultSignalE;
          try { console.warn('[pipeline.render-finalize] turn-result social signal failed', _turnResultSignalE); } catch(_) {}
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
        // [slice 6.5·2026-05-07] deferred 路径·shijiModal 后朝进行中
        // 暂存 payload + 用 ctx.deferredSteps 显式登记 phase5·替代闭包模式 (audit 决定 2)
        // 兼容性：仍 mirror 到 _pendingShijiModal.deferredPhase5·让 legacy 触发器继续工作
        if (typeof GM !== 'undefined' && GM._pendingShijiModal && GM._pendingShijiModal.courtDone === false) {
          GM._pendingShijiModal.aiReady = true;
          GM._pendingShijiModal.payload = _renderArgs;
          if (typeof _updatePostTurnCourtBanner === 'function') _updatePostTurnCourtBanner('aiReady');
          if (typeof hideLoading === 'function') hideLoading();
          // 4.5/4.6 仍跑·不延后 (legacy 也是这样)
          try { if (typeof _settleCourtMeter === 'function') _settleCourtMeter(); }
          catch(e) { try { console.warn('[pipeline.render-finalize·deferred] courtMeter', e); } catch(_){} }
          try { if (typeof advanceCharTravelByDays === 'function') advanceCharTravelByDays((typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : ((P.time && P.time.daysPerTurn) || 30)); }
          catch(e) { try { console.warn('[pipeline.render-finalize·deferred] char travel', e); } catch(_){} }
          // Phase 5·登记到 ctx.deferredSteps·用 'court-close' as when
          ctx.deferredSteps.push({
            name: 'phase5-after-hooks-keju',
            when: 'court-close',
            fn: async function(_dctx) {
              try { if (typeof EndTurnHooks !== 'undefined' && EndTurnHooks.execute) await EndTurnHooks.execute('after'); }
              catch(e) { try { console.warn('[deferred·phase5] after hooks', e); } catch(_){} }
              if (P.keju && (P.keju.currentExam || P.keju.currentEnke) && typeof advanceKejuByDays === 'function') {
                try { advanceKejuByDays((typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : ((P.time && P.time.daysPerTurn) || 30)); }
                catch(e) { try { console.warn('[deferred·phase5] keju advance', e); } catch(_){} }
              }
              if (P.keju && P.keju.enabled && !P.keju.currentExam && typeof checkKejuTrigger === 'function') {
                try { await checkKejuTrigger(); }
                catch(e) { try { console.warn('[deferred·phase5] keju trigger', e); } catch(_){} }
              }
              // v7.1·F2/F3/F4c·D1 长尾 endTurn hooks·flag gate by P.conf.useNewKejuD1
              if (typeof _kjCheckDiscipleMemorialTriggers === 'function') {
                try { _kjCheckDiscipleMemorialTriggers(); }
                catch(e) { try { console.warn('[deferred·phase5] F2 disciple memorial', e); } catch(_){} }
              }
              if (typeof _kjCheckCohortMeetTriggers === 'function') {
                try { _kjCheckCohortMeetTriggers(); }
                catch(e) { try { console.warn('[deferred·phase5] F3 cohort meet', e); } catch(_){} }
              }
              if (typeof _kjCheckYanguanQingyiTriggers === 'function') {
                try { _kjCheckYanguanQingyiTriggers(); }
                catch(e) { try { console.warn('[deferred·phase5] F4c yanguan qingyi', e); } catch(_){} }
              }
              // Phase L·L7·ramping reform state tick + reformLean decay + memorial trigger (flag gate by P.conf.useNewKejuL7)
              if (typeof _kjpL7TickRampingReform === 'function') {
                try { _kjpL7TickRampingReform(); }
                catch(e) { try { console.warn('[deferred·phase5] L7 ramping tick', e); } catch(_){} }
              }
              if (typeof _kjpL7TickReformLeanDecay === 'function') {
                try { _kjpL7TickReformLeanDecay((typeof GM !== 'undefined' && GM.turn) || 0); }
                catch(e) { try { console.warn('[deferred·phase5] L7 reformLean decay', e); } catch(_){} }
              }
              if (typeof _kjCheckReformMemorialTriggers === 'function') {
                try { _kjCheckReformMemorialTriggers(); }
                catch(e) { try { console.warn('[deferred·phase5] L7 reform memorial', e); } catch(_){} }
              }
              // Phase G·G2·step 0·event hook watchers (探 emperor 帝崩 + war_state 平乱·SET _lastReignChangeYear / _lastPlatformDisasterYear)
              if (typeof _kjEventCheckReignTransition === 'function') {
                try { _kjEventCheckReignTransition(); }
                catch(e) { try { console.warn('[deferred·phase5] G2 reign transition watch', e); } catch(_){} }
              }
              if (typeof _kjEventCheckWarStateRecovery === 'function') {
                try { _kjEventCheckWarStateRecovery(); }
                catch(e) { try { console.warn('[deferred·phase5] G2 war state recovery watch', e); } catch(_){} }
              }
              // Phase G·G1·特科 trigger check (flag gate by P.conf.useNewKejuD2 inside)
              // 注·watchers 先于 G1 check·让 G1 当 turn 即可读到 fresh _last*Year 字段
              if (typeof _kjCheckSpecialExamTriggers === 'function') {
                try { _kjCheckSpecialExamTriggers(); }
                catch(e) { try { console.warn('[deferred·phase5] G1 special exam trigger', e); } catch(_){} }
              }
              // Phase J·J4·科场弊案 trigger check (flag gate by P.conf.useNewKejuScandal inside)
              if (typeof _kjCheckScandalTriggers === 'function') {
                try { _kjCheckScandalTriggers(); }
                catch(e) { try { console.warn('[deferred·phase5] J4 scandal trigger', e); } catch(_){} }
              }
              // Phase L·L8·evolution tick (在 L7 tick 之后·状态推进先于 evolve·flag gate by P.conf.useNewKejuL8)
              if (typeof _kjpL8EvolveTick === 'function') {
                try { _kjpL8EvolveTick(); }
                catch(e) { try { console.warn('[deferred·phase5] L8 evolve tick', e); } catch(_){} }
              }
              // Phase L·L5·RBB·cleanup cooldown table (matured/rejected reform + dead NPC)
              if (typeof _kjpL5CleanupCooldown === 'function') {
                try { _kjpL5CleanupCooldown(); }
                catch(e) { try { console.warn('[deferred·phase5] L5 cooldown cleanup', e); } catch(_){} }
              }
            }
          });
          // 兼容 legacy 触发器·把 ctx.deferredSteps 'court-close' 登记的 fn 包装成单 closure (slice 7 时移除)
          GM._pendingShijiModal.deferredPhase5 = async function() {
            for (var i = 0; i < ctx.deferredSteps.length; i++) {
              var step = ctx.deferredSteps[i];
              if (step.when === 'court-close') {
                try { await step.fn(ctx); } catch(e) { try { console.warn('[deferred·legacy bridge] step ' + step.name + ' failed', e); } catch(_){} }
              }
            }
            await _runPostRenderTurnOpeners(ctx);
          };
          return ctx; // deferred 路径完成
        }

        // 非 deferred 路径·正常 render + 4.5 + 4.6 + 5
        // render 失败时弹 fallback，避免推演已完成但玩家停在 loading 遮罩。
        if (typeof _endTurn_render === 'function') {
          try {
            try { if (typeof showLoading === 'function') showLoading('生成史记弹窗', 97); } catch(_progressE) {}
            _endTurn_render.apply(null, _renderArgs);
          } catch(_renderE) {
            ctx.results.renderError = _renderE;
            try {
              if (typeof window !== 'undefined' && window.TM && TM.errors && TM.errors.capture) {
                TM.errors.capture(_renderE, 'pipeline.render-finalize] render failed');
              } else {
                console.error('[pipeline.render-finalize] render failed', _renderE);
              }
            } catch(_diagE) {
              try { console.error('[pipeline.render-finalize] render failure diagnostic failed', _diagE); } catch(_){}
            }
            try { if (typeof hideLoading === 'function') hideLoading(); } catch(_hideE) {
              try { console.warn('[pipeline.render-finalize] hideLoading after render failure failed', _hideE); } catch(_){}
            }
            try {
              if (typeof showTurnResult === 'function') {
                var _renderErrMsg = (_renderE && (_renderE.message || _renderE.toString())) || 'unknown render error';
                var _safeRenderErr = String(_renderErrMsg).replace(/[&<>"']/g, function(ch) {
                  return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
                });
                showTurnResult(
                  '<div style="padding:1rem;line-height:1.8;color:var(--txt);">' +
                  '<h3 style="color:var(--gold);margin:0 0 0.8rem;">史记弹窗渲染失败</h3>' +
                  '<p>本回合推演与数值结算已经完成，但结果弹窗在渲染时出错。游戏已解除等待状态，可继续操作；请把控制台诊断发给开发者。</p>' +
                  '<pre style="white-space:pre-wrap;color:var(--red,#c44);background:rgba(0,0,0,0.22);padding:0.75rem;border:1px solid rgba(200,80,70,0.35);">' + _safeRenderErr + '</pre>' +
                  '</div>'
                );
              }
            } catch(_fallbackE) {
              try { console.warn('[pipeline.render-finalize] fallback render failed', _fallbackE); } catch(_){}
            }
            try { if (typeof toast === 'function') toast('回合推演已完成，但史记弹窗渲染失败，请查看控制台诊断。'); } catch(_toastE) {}
          }
        }
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
        try { if (typeof _settleCourtMeter === 'function') _settleCourtMeter(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] courtMeter failed', e); } catch(_){} }

        // Phase 4.6·角色路程推进
        try { if (typeof advanceCharTravelByDays === 'function') advanceCharTravelByDays((typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : ((P.time && P.time.daysPerTurn) || 30)); }
        catch(e) { try { console.warn('[pipeline.render-finalize] char travel failed', e); } catch(_){} }

        // Phase 5·after hooks + keju·wrap 策略对齐 legacy
        // legacy 的 after-hooks 和 keju trigger 都未 wrap·pipeline 也不 wrap·error 同 propagate
        if (typeof EndTurnHooks !== 'undefined' && EndTurnHooks.execute) await EndTurnHooks.execute('after');
        if (P.keju && (P.keju.currentExam || P.keju.currentEnke) && typeof advanceKejuByDays === 'function') {
          try { advanceKejuByDays((typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : ((P.time && P.time.daysPerTurn) || 30)); }
          catch(e) { try { console.warn('[pipeline.render-finalize] keju advance failed', e); } catch(_){} }
        }
        if (P.keju && P.keju.enabled && !P.keju.currentExam && typeof checkKejuTrigger === 'function') {
          await checkKejuTrigger();
        }
        // v7.1·F2/F3/F4c·D1 长尾 endTurn hooks·flag gate by P.conf.useNewKejuD1
        try { if (typeof _kjCheckDiscipleMemorialTriggers === 'function') _kjCheckDiscipleMemorialTriggers(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] F2 disciple memorial', e); } catch(_){} }
        try { if (typeof _kjCheckCohortMeetTriggers === 'function') _kjCheckCohortMeetTriggers(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] F3 cohort meet', e); } catch(_){} }
        try { if (typeof _kjCheckYanguanQingyiTriggers === 'function') _kjCheckYanguanQingyiTriggers(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] F4c yanguan qingyi', e); } catch(_){} }
        // Phase L·L7·ramping reform state tick + reformLean decay + memorial trigger
        try { if (typeof _kjpL7TickRampingReform === 'function') _kjpL7TickRampingReform(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] L7 ramping tick', e); } catch(_){} }
        try { if (typeof _kjpL7TickReformLeanDecay === 'function') _kjpL7TickReformLeanDecay((typeof GM !== 'undefined' && GM.turn) || 0); }
        catch(e) { try { console.warn('[pipeline.render-finalize] L7 reformLean decay', e); } catch(_){} }
        try { if (typeof _kjCheckReformMemorialTriggers === 'function') _kjCheckReformMemorialTriggers(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] L7 reform memorial', e); } catch(_){} }
        // Phase G·G2·step 0·event hook watchers (先于 G1)·SET _last*Year 字段
        try { if (typeof _kjEventCheckReignTransition === 'function') _kjEventCheckReignTransition(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G2 reign transition', e); } catch(_){} }
        try { if (typeof _kjEventCheckWarStateRecovery === 'function') _kjEventCheckWarStateRecovery(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G2 war recovery', e); } catch(_){} }
        // G2·RBB·BB2/BB3·resume + drain hooks·BB9 prune·BB15 cross-scenario reset
        try { if (typeof _kjG2MaybeResetCrossScenarioFields === 'function') _kjG2MaybeResetCrossScenarioFields(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G2 cross-scenario reset', e); } catch(_){} }
        try { if (typeof _kjG2ResumeEnkeXieendaIfPending === 'function') _kjG2ResumeEnkeXieendaIfPending(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G2 xieenda resume', e); } catch(_){} }
        try { if (typeof _kjG2ConsumePendingEnkeFromEdict === 'function') _kjG2ConsumePendingEnkeFromEdict(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G2 pending edict drain', e); } catch(_){} }
        try { if (typeof _kjG2PruneDeadEnkePartyMembers === 'function') _kjG2PruneDeadEnkePartyMembers(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G2 enkeParty prune', e); } catch(_){} }
        try { if (typeof _kjG2PruneExpiredEnkeSuggestions === 'function') _kjG2PruneExpiredEnkeSuggestions(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G2 suggestion expire prune', e); } catch(_){} }
        try { if (typeof _kjG2NukeStaleEnkeWenduiContext === 'function') _kjG2NukeStaleEnkeWenduiContext(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G2 wendui ctx nuke', e); } catch(_){} }
        // G3·RBB·BB1·nuke stale wuju wendui context (跟 G2 同 paradigm)
        try { if (typeof _kjG3NukeStaleWujuWenduiContext === 'function') _kjG3NukeStaleWujuWenduiContext(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G3 wendui ctx nuke', e); } catch(_){} }
        // G3·step 0-L·wire G3 hooks
        try { if (typeof _kjG3ResumeWuJiaoyueDaIfPending === 'function') _kjG3ResumeWuJiaoyueDaIfPending(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G3 wujiaoyueda resume', e); } catch(_){} }
        try { if (typeof _kjG3WujinshiHealthTick === 'function') _kjG3WujinshiHealthTick(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G3 wujinshi health tick', e); } catch(_){} }
        try {
          if (typeof _kjG3MaybeAddBattleRecord === 'function' && Array.isArray(GM && GM.chars)) {
            // 武进士 chars 战功 tick·每 turn 每人按 prob
            GM.chars.forEach(function(ch) {
              if (ch && ch._origin === 'wuju' && ch.alive !== false) {
                _kjG3MaybeAddBattleRecord(ch);
              }
            });
          }
        } catch(e) { try { console.warn('[pipeline.render-finalize] G3 battle record', e); } catch(_){} }
        try { if (typeof _kjG3CheckWujuAbolitionTrigger === 'function') _kjG3CheckWujuAbolitionTrigger(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G3 wuju abolition trigger', e); } catch(_){} }
        // G5·wire tongzi hooks
        try { if (typeof _kjG5ResumeFumoCeremonyIfPending === 'function') _kjG5ResumeFumoCeremonyIfPending(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G5 tongzi fumo resume', e); } catch(_){} }
        try { if (typeof _kjG5TongziHealthTick === 'function') _kjG5TongziHealthTick(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G5 tongzi health tick', e); } catch(_){} }
        // G5 v2·annual tick (chronicle 长尾·每 5 年 1 行)
        try { if (typeof _kjG5TongziAnnualTick === 'function') _kjG5TongziAnnualTick(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G5 tongzi annual tick', e); } catch(_){} }
        try { if (typeof _kjG5MaybeResetCrossScenarioFields === 'function') _kjG5MaybeResetCrossScenarioFields(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G5 tongzi cross-scenario reset', e); } catch(_){} }
        // G3·RAA·M4·武勋世家 endTurn retrigger·世家成员战死 cleanup
        try { if (typeof _kjG3DetectMartialClan === 'function') _kjG3DetectMartialClan(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G3 detect martial clan', e); } catch(_){} }
        // Phase G·G1·特科 trigger check
        try { if (typeof _kjCheckSpecialExamTriggers === 'function') _kjCheckSpecialExamTriggers(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G1 special exam trigger', e); } catch(_){} }
        // Phase J·J4·科场弊案 keyi 拉起 (检测在 deferred·此处结算渲染后弹议政)
        try { if (typeof _kjMaybeRaiseScandalKeyi === 'function') _kjMaybeRaiseScandalKeyi(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] J4 scandal keyi', e); } catch(_){} }
        // Phase H·H0+H1·school network resume + tier check
        try { if (typeof _kjpResumeIfPending === 'function') _kjpResumeIfPending(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] H resume', e); } catch(_){} }
        // Phase H·H3·Path β·学说 weight 隐式 tick (绕 keyi·小幅漂)
        try { if (typeof _kjpHTickSubjectWeightDrift === 'function') _kjpHTickSubjectWeightDrift(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] H weight drift', e); } catch(_){} }
        // Phase H·H5·BB1-style nuke wendui ctx
        try { if (typeof _kjpHNukeStaleSchoolWenduiContext === 'function') _kjpHNukeStaleSchoolWenduiContext(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] H wendui nuke', e); } catch(_){} }
        // Phase H·H8·反馈循环 tick
        try { if (typeof _kjpHTickFeedbackLoop === 'function') _kjpHTickFeedbackLoop(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] H feedback loop', e); } catch(_){} }
        // Phase H·H9·watershed event check
        try { if (typeof _kjpHCheckWatershedEvents === 'function') _kjpHCheckWatershedEvents(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] H watershed', e); } catch(_){} }
        // Phase H·R1·M2 fix·讲会 endTurn 自动 trigger (每 5 年 + flourishing + 5% prob)
        try { if (typeof _kjpHMaybeAutoTriggerLecture === 'function') _kjpHMaybeAutoTriggerLecture(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] H auto lecture', e); } catch(_){} }
        // G3·RAA·C4·元朝 spawn stuck cleanup·F5·移到 G1 spawn 之后 (spawn-then-clean·避当 turn 漏)
        try { if (typeof _kjG3CleanupYuanStuckWujuSpawn === 'function') _kjG3CleanupYuanStuckWujuSpawn(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] G3 yuan cleanup', e); } catch(_){} }
        // Phase L·L8·evolution tick (在 L7 tick 之后)
        try { if (typeof _kjpL8EvolveTick === 'function') _kjpL8EvolveTick(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] L8 evolve tick', e); } catch(_){} }
        // Phase L·L5·RBB·cleanup cooldown table
        try { if (typeof _kjpL5CleanupCooldown === 'function') _kjpL5CleanupCooldown(); }
        catch(e) { try { console.warn('[pipeline.render-finalize] L5 cooldown cleanup', e); } catch(_){} }

        // Phase 5.3·AI memory compress·内部自检 P.ai.key·无 key 自动 noop·搬法 IIFE
        // 注：完整逻辑跨 50 行·此处 inline 简化版本·若 P.ai.key 缺则 noop (legacy 也是这逻辑)
        // 详细 legacy 还在 core.js·flag 守 legacy 跳过

        // 2026-05-10·Layer 2 势力反向索引·所有 system + render 完成后重建一次
        // 确保下回合 UI/AI 读到的 _facIndex 是当前 turn 的最新 snapshot
        try {
          if (typeof window !== 'undefined' && window.TM && TM.FactionIndex && TM.FactionIndex.rebuild) {
            TM.FactionIndex.rebuild();
          }
        } catch(_fxE) { try { console.warn('[pipeline.render-finalize] _facIndex 重建失败', _fxE); } catch(_){} }
        // 2026-05-10·Layer 3 派生健康度·必须在 rebuild 之后
        try {
          if (typeof window !== 'undefined' && window.TM && TM.FactionDerived && TM.FactionDerived.compute) {
            TM.FactionDerived.compute();
          }
        } catch(_dhE) { try { console.warn('[pipeline.render-finalize] derivedHealth 计算失败', _dhE); } catch(_){} }
        // 2026-05-10·Phase B1-B3·派生经济+凝聚+综合
        try {
          if (typeof window !== 'undefined' && window.TM) {
            if (TM.FactionDerivedEconomy && TM.FactionDerivedEconomy.compute) TM.FactionDerivedEconomy.compute();
            if (TM.FactionDerivedCohesion && TM.FactionDerivedCohesion.compute) TM.FactionDerivedCohesion.compute();
            if (TM.FactionDerivedStrength && TM.FactionDerivedStrength.compute) TM.FactionDerivedStrength.compute();
          }
        } catch(_dxE) { try { console.warn('[pipeline.render-finalize] derived B1-B3 失败', _dxE); } catch(_){} }
        _scheduleNpcBehaviorPostRender(ctx);
        // 2026-05-10·Phase C1·NPC memorial 生成+自决·每回合 1 轮
        try {
          if (typeof window !== 'undefined' && window.TM && TM.FactionNpcMemorial && TM.FactionNpcMemorial.generate) {
            TM.FactionNpcMemorial.generate();
          }
        } catch(_npcmE) { try { console.warn('[pipeline.render-finalize] NPC memorial 生成失败', _npcmE); } catch(_){} }
        // 2026-05-10·Phase C2·NPC edict 自动决策+应用·每回合 1 诏 per NPC fac
        try {
          if (typeof window !== 'undefined' && window.TM && TM.FactionNpcEdict && TM.FactionNpcEdict.generate) {
            TM.FactionNpcEdict.generate();
          }
        } catch(_npceE) { try { console.warn('[pipeline.render-finalize] NPC edict 生成失败', _npceE); } catch(_){} }
        // 2026-05-10·Phase C3·NPC chaoyi 派系互动 (单派/零派 noop)
        try {
          if (typeof window !== 'undefined' && window.TM && TM.FactionNpcChaoyi && TM.FactionNpcChaoyi.generate) {
            TM.FactionNpcChaoyi.generate();
          }
        } catch(_npccyE) { try { console.warn('[pipeline.render-finalize] NPC chaoyi 失败', _npccyE); } catch(_){} }
        // 2026-05-10·Phase C4·NPC office 人事任免
        try {
          if (typeof window !== 'undefined' && window.TM && TM.FactionNpcOffice && TM.FactionNpcOffice.generate) {
            TM.FactionNpcOffice.generate();
          }
        } catch(_npcoE) { try { console.warn('[pipeline.render-finalize] NPC office 失败', _npcoE); } catch(_){} }
        // 2026-05-10·Phase C5·NPC guoku 财政周期·收支应用到 fac.treasury
        try {
          if (typeof window !== 'undefined' && window.TM && TM.FactionNpcGuoku && TM.FactionNpcGuoku.generate) {
            TM.FactionNpcGuoku.generate();
          }
        } catch(_npcgE) { try { console.warn('[pipeline.render-finalize] NPC guoku 失败', _npcgE); } catch(_){} }
        // 2026-05-10·Phase G·NPC LLM 决策接管·若开关 on + eager mode·后台并发跑
        // 模板已先跑·LLM 决策会"覆盖"产出新 trajectory·不破坏 fallback
        try {
          if (typeof window !== 'undefined' && window.TM && TM.FactionNpcDispatchQueue && TM.FactionNpcDispatchQueue.scheduleTurnRuns) {
            TM.FactionNpcDispatchQueue.scheduleTurnRuns({ source: 'render-finalize' });
          }
        } catch(_npcdE) { try { console.warn('[pipeline.render-finalize] NPC LLM dispatch 调度失败', _npcdE); } catch(_){} }
        return ctx;
      },
      onError: 'continue',
      reads: ['ctx.results.aiResult', 'ctx.results.queueResult', 'ctx.results.tyrantResult', 'ctx.input.edicts', 'ctx.input.xinglu', 'ctx.input.oldVars', 'GM._pendingShijiModal'],
      writes: ['GM.shijiHistory', 'GM.eraName', 'GM._pendingToasts', 'GM._lastFixedExpense', 'GM._facIndex', 'GM.facs[*].derivedHealth', 'ctx.input._renderFinalizeRan']
    }
  ];

  TM.Endturn.PipelineSteps = { list: list };
})();
