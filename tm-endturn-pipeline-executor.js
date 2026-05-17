// @ts-check
/// <reference path="tm-endturn-pipeline-types.js" />
// ============================================================
// tm-endturn-pipeline-executor.js — endTurn 管道执行器
// 创建：slice 1·2026-05-07·additive·不动旧 endturn 代码
// 职责：吃 steps[] 顺序跑·逐 step 计时+日志·按 onError 处理失败
// 现状：仅顺序+onError·parallel/deferred/dryRun-with-mock 留 TODO 给 slice 2-6
// 见 web/docs/endturn-data-flow.md §4 §7
// ============================================================

(function(){
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};
  TM.Endturn = TM.Endturn || {};

  /** @type {StepLogEntry[]} */
  var _lastRunLog = [];

  /**
   * 创建空 ctx·实际字段填充由各 step 完成
   * @returns {EndturnCtx}
   */
  function buildCtx() {
    return {
      input: {},
      snapshots: {},
      prompt: {},
      subcalls: {},
      results: {},
      apply: {},
      followup: {},
      record: {},
      crossTurn: {},
      deferredSteps: [],
      meta: {
        turn: (typeof GM !== 'undefined' && GM.turn) ? GM.turn : 0,
        startTime: Date.now(),
        stepLog: []
      }
    };
  }

  function _now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  /**
   * 单 step 执行·处理 onError 策略
   * @param {PipelineStep} step
   * @param {EndturnCtx} ctx
   * @returns {Promise<StepLogEntry>}
   */
  async function _runStep(step, ctx) {
    var t0 = _now();
    /** @type {StepLogEntry} */
    var entry = { step: step.name, ms: 0, ok: false };
    var policy = step.onError || 'abort';
    try {
      await step.fn(ctx);
      entry.ms = _now() - t0;
      entry.ok = true;
      return entry;
    } catch (e) {
      entry.error = e;
      entry.ms = _now() - t0;
      if (policy === 'retry') {
        try {
          await step.fn(ctx);
          entry.ms = _now() - t0;
          entry.ok = true;
          entry.retried = true;
          delete entry.error;
          return entry;
        } catch (e2) {
          entry.error = e2;
          entry.retried = true;
          return entry;
        }
      }
      return entry;
    }
  }

  /**
   * 顺序跑 steps[]·按 onError 决定 abort/continue/retry
   * @param {EndturnCtx} ctx
   * @param {Object} [opts]
   * @returns {Promise<EndturnCtx>}
   */
  async function run(ctx, opts) {
    opts = opts || {};
    var steps = (TM.Endturn.PipelineSteps && TM.Endturn.PipelineSteps.list) || [];
    /** @type {StepLogEntry[]} */
    var log = [];
    ctx.meta.stepLog = log;
    if (TM.Endturn.Timing && typeof TM.Endturn.Timing.startLedger === 'function') {
      TM.Endturn.Timing.startLedger(ctx, { source: 'pipeline', stepCount: steps.length });
    }

    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      var entry = await _runStep(step, ctx);
      log.push(entry);
      if (TM.Endturn.Timing && typeof TM.Endturn.Timing.mark === 'function') {
        TM.Endturn.Timing.mark(ctx, 'step', {
          step: step.name,
          index: i + 1,
          total: steps.length,
          ok: !!entry.ok,
          retried: !!entry.retried,
          ms: entry.ms || 0,
          onError: step.onError || 'abort',
          error: entry.error ? String(entry.error && (entry.error.message || entry.error) || '') : ''
        });
      }
      var statusTag = entry.ok ? 'ok' : 'fail';
      if (entry.retried) statusTag += '(retried)';
      try {
        console.log('[pipeline] step ' + (i+1) + '/' + steps.length + ' ' + step.name + ' ' + statusTag + ' ' + Math.round(entry.ms) + 'ms');
      } catch(_){}

      if (!entry.ok) {
        var policy = step.onError || 'abort';
        if (policy === 'abort') {
          ctx.meta.lastRun = log.slice();
          _lastRunLog = log.slice();
          if (TM.Endturn.Timing && typeof TM.Endturn.Timing.finishLedger === 'function') {
            TM.Endturn.Timing.finishLedger(ctx, 'failed', { failedStep: step.name });
          }
          throw entry.error;
        }
        // 'continue'·继续下一步
      }
    }

    // slice 6 启用 deferredSteps 触发逻辑·slice 1 仅记录数量
    if (ctx.deferredSteps && ctx.deferredSteps.length > 0) {
      try { console.log('[pipeline] deferred steps registered: ' + ctx.deferredSteps.length); } catch(_){}
    }

    ctx.meta.lastRun = log.slice();
    _lastRunLog = log.slice();
    if (TM.Endturn.Timing && typeof TM.Endturn.Timing.finishLedger === 'function') {
      TM.Endturn.Timing.finishLedger(ctx, 'done');
    }
    return ctx;
  }

  /**
   * 不执行 fn·只列出会跑哪些 step + 声明的 reads/writes
   * @returns {Object[]}
   */
  function dryRun() {
    var steps = (TM.Endturn.PipelineSteps && TM.Endturn.PipelineSteps.list) || [];
    return steps.map(function(s){
      return {
        name: s.name,
        onError: s.onError || 'abort',
        reads: s.reads || [],
        writes: s.writes || [],
        parallel: s.parallel || []
      };
    });
  }

  /** @returns {StepLogEntry[]} */
  function lastRun() { return _lastRunLog.slice(); }

  TM.Endturn.Pipeline = {
    run: run,
    dryRun: dryRun,
    lastRun: lastRun,
    buildCtx: buildCtx
  };
})();
