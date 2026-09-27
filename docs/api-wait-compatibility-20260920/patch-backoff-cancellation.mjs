import {edit} from './patch-utils.mjs';
edit('web/tm-ai-infra.js',(s,r)=>{
 const start=s.indexOf('async function _aiFetchWithRetryInner('),end=s.indexOf('\n// ===',start)+1;let fn=s.slice(start,end);
 fn=fn.replaceAll('_aiBudgetedRetryWait(delay429, signal,','_aiBudgetedRetryWait(delay429, ctrl.signal,').replaceAll('_aiBudgetedRetryWait(_aiRetryDelay(null, attempt), signal,','_aiBudgetedRetryWait(_aiRetryDelay(null, attempt), ctrl.signal,').replaceAll('_aiBudgetedRetryWait(delayRetry, signal,','_aiBudgetedRetryWait(delayRetry, ctrl.signal,');
 s=r(s,s.slice(start,end),fn);
 return r(s,'_aiBudgetedRetryWait(_aiRetryDelay(resp, transportRetries++), opts.signal, opts.retryBudget)','_aiBudgetedRetryWait(_aiRetryDelay(resp, transportRetries++), ctrl.signal, opts.retryBudget)');
});
