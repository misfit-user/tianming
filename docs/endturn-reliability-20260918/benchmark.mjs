import fs from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
const dir = 'docs/endturn-reliability-20260918';
function fixture(prefix) {
  const timers = new Set();
  const c = { console: { log() {}, warn() {}, error() {} }, Date, Math, JSON, Promise, AbortController, Response, Headers, TextEncoder, TextDecoder, URL, performance,
    P: { ai: { key: 'fixture-only', url: 'https://fixture.invalid', model: 'fixture', maxConcurrent: 1, adaptiveMaxConcurrent: 0, minInterval: 1 }, conf: {} }, GM: { turn: 1 }, localStorage: { getItem() { return null; } },
    setTimeout(fn, ms) { const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms >= 1000 ? 500 : ms); timers.add(timer); return timer; },
    clearTimeout(timer) { clearTimeout(timer); timers.delete(timer); } };
  c.window = c; c.globalThis = c; vm.createContext(c);
  for (const file of ['tm-ai-infra-json.js','tm-ai-infra-retry.js','tm-ai-infra.js']) vm.runInContext(fs.readFileSync(prefix + '/web/' + file,'utf8'), c, { filename: file });
  const request = () => c._aiFetchWithRetry('https://fixture.invalid', { messages: [], max_tokens: 32 }, null, { maxRetries: 0, timeoutMs: 400 });
  return { c, request, dispose() { for (const timer of timers) clearTimeout(timer); } };
}
const results = {};
for (const [label, prefix] of [['before','.bak-endturn-reliability-20260918'],['after','.']]) {
  const f = fixture(prefix); let sent = 0;
  try {
    f.c.fetch = async () => { sent++; throw Error('injected network error'); };
    f.c.callAI = async () => f.request();
    try { await f.c.callAISmart('test', 32, { maxRetries: 3 }); } catch (_) {}
    results[label] = { failedTaskHttpAttempts: sent };
  } finally { f.dispose(); }
}
for (const [label, prefix] of [['before','.bak-endturn-reliability-20260918'],['after','.']]) {
  const f = fixture(prefix); let sent = 0;
  try {
    f.c.fetch = async () => { sent++; return new Promise(resolve => setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({ ok: true }) }), 120)); };
    const first = f.request(); await new Promise(resolve => setTimeout(resolve, 5));
    const ctrl = new AbortController(), start = performance.now();
    const second = f.c._aiFetchWithRetry('https://fixture.invalid', { messages: [], max_tokens: 32 }, ctrl.signal, { maxRetries: 0, timeoutMs: 400 });
    ctrl.abort(); try { await second; } catch (_) {}
    results[label].queuedCancellationMs = Number((performance.now() - start).toFixed(3));
    await first; results[label].cancellationFixtureHttpRequests = sent;
  } finally { f.dispose(); }
}
fs.writeFileSync(dir + '/benchmark.json', JSON.stringify({ description: 'Controlled synthetic failures; first request holds the queue for 120 ms. Not real API or overall turn latency.', results },null,2));
console.log(JSON.stringify(results,null,2));
