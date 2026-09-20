import { edit } from './patch-utils.mjs';
edit('web/scripts/smoke-ai-abort-listener-cleanup.js', (source, replace) => {
  const anchor = '  const retrySignal = new TrackedSignal(false);';
  const observed = `  const retrySignal = new TrackedSignal(false);
  const retryWaits = [], actualRetryWait = ctx._aiBudgetedRetryWait;
  const getListeners = require('node:events').getEventListeners;
  ctx._aiBudgetedRetryWait = async function(ms, signal, budget) {
    const observation = { signal, before: getListeners(signal, 'abort').length };
    retryWaits.push(observation);
    try { return await actualRetryWait(ms, signal, budget); }
    finally { observation.after = getListeners(signal, 'abort').length; }
  };`;
  source = replace(source, anchor, observed);
  const old = "  assert(retrySignal.activeCount === 0 && retrySignal.addCount === 5 && retrySignal.removeCount === 5, 'three requests and two cancellable waits clean every external listener');";
  const next = "  assert(retrySignal.activeCount === 0 && retrySignal.addCount === 3 && retrySignal.removeCount === 3, 'three requests clean every external abort listener');\n"
    + "  assert(retryWaits.length === 2 && retryWaits.every(row => row.signal !== retrySignal && row.after === row.before), 'both cancellable retry waits clean their owned controller listeners');";
  return replace(source, old, next);
});
