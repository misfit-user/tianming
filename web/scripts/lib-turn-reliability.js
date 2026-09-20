'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
function load(c, file) { vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), c, { filename: file }); }
function transport() {
  const timers = new Set();
  const c = { console: { log() {}, warn() {}, error() {} }, AbortController, AbortSignal, TextDecoder, TextEncoder, Headers, Response, URL, performance, Date,
    P: { ai: { key: 'fixture-only', url: 'https://fixture.invalid/v1', model: 'fixture', maxConcurrent: 1, adaptiveMaxConcurrent: 0, minInterval: 1 }, conf: {} }, GM: { turn: 1, _campaignId: 'test', _timelineId: 'branch' },
    localStorage: { getItem() { return null; } },
    setTimeout(fn, ms) { const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms); timers.add(timer); return timer; },
    clearTimeout(timer) { timers.delete(timer); clearTimeout(timer); }
  };
  c.window = c; c.globalThis = c; vm.createContext(c);
  ['tm-ai-infra-json.js','tm-ai-infra-retry.js','tm-ai-infra.js','tm-endturn-reliability.js'].forEach(file => load(c, file));
  return { c, timers, dispose() { for (const timer of timers) clearTimeout(timer); timers.clear(); },
    request(opts = {}, signal) { return c._aiFetchWithRetry('https://fixture.invalid/v1', { messages: [{ role: 'user', content: 'fixture prompt, never a real request' }], max_tokens: 32 }, signal, { maxRetries: 0, timeoutMs: 200, id: 'fixture', ...opts }); } };
}
function memory(extra) {
  const c = require('./lib-memory-upgrade-r2').context(extra);
  ['tm-memory-turn-archive.js','tm-memory-turn-rollup.js','tm-agent-kernel.js','tm-memory-mode-bridge.js','tm-endturn-agent-read-tools.js','tm-endturn-agent-intent-plan.js','tm-endturn-agent-depth-tools.js'].forEach(file => load(c, file));
  return c;
}
const okay = data => ({ ok: true, status: 200, headers: { get() { return null; } }, json: async () => data });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
module.exports = { ROOT, load, transport, memory, okay, pause };
