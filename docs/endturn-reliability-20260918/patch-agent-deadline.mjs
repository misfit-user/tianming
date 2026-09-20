import { edit } from './patch-utils.mjs';
edit('web/tm-agent-kernel.js', (s, r) => {
  s = r(s, '    return run;\n  }', `    var deadlineTimer = null, parentAbort = null;
    run.dispose = function() { if (deadlineTimer != null) clearTimeout(deadlineTimer); deadlineTimer = null; if (opts.signal && parentAbort) opts.signal.removeEventListener('abort', parentAbort); };
    if (opts.signal) {
      parentAbort = function() { run.abort(opts.signal.reason || 'parent-aborted'); run.dispose(); };
      opts.signal.addEventListener('abort', parentAbort, { once: true });
      if (opts.signal.aborted) parentAbort();
    }
    if (opts.enforceDeadline === true && !signal.aborted) {
      var remaining = run.budget.snapshot().remaining.ms;
      if (Number.isFinite(remaining)) {
        deadlineTimer = setTimeout(function() { var e = new Error('Agent 回合总时限已到'); e.code = 'AI_REQUEST_DEADLINE'; e.name = 'TimeoutError'; run.abort(e); run.dispose(); }, Math.max(0, remaining));
        if (deadlineTimer && typeof deadlineTimer.unref === 'function') deadlineTimer.unref();
      }
    }
    return run;
  }`);
  return s;
});
edit('web/tm-endturn-agent-mode.js', (s, r) => {
  s = r(s, '  async function run(ctx) {', '  async function runInner(ctx) {');
  s = r(s, "        meta: { mode: 'agent', turn: gm.turn || 0 },", "        meta: { mode: 'agent', turn: gm.turn || 0 },\n        enforceDeadline: true, signal: ctx.signal || ctx.meta.signal || null,");
  s = r(s, '    function bail(reason) {', '    function bail(reason) {\n      var runtime = _agentRuntime(ctx); if (runtime && !runtime.signal.aborted) runtime.abort(reason);\n      if (root.GM && root.GM !== gm) return fail(reason, { rolledBack: false, stale: true });');
  s = r(s, "        if (!resp) { if (round === 1)", "        if (_agentSignal(ctx) && _agentSignal(ctx).aborted) return bail('Agent 任务已取消或到达总时限');\n        if (!resp) { if (round === 1)");
  s = r(s, '    var chk = _selfCheck(gm, {', "    if (_agentSignal(ctx) && _agentSignal(ctx).aborted) return bail('Agent 任务已取消或到达总时限，未提交');\n    var chk = _selfCheck(gm, {");
  s = r(s, '  TM.Endturn.AgentMode = {', "  async function run(ctx) {\n    ctx = ctx || {};\n    try { return await runInner(ctx); }\n    finally { var runtime = ctx.meta && ctx.meta.agentRuntime; if (runtime && runtime.dispose) runtime.dispose(); }\n  }\n  TM.Endturn.AgentMode = {");
  return s;
});
