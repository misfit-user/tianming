#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const jsonSource = fs.readFileSync(path.join(ROOT, 'tm-ai-infra-json.js'), 'utf8');
const source = (fs.readFileSync(path.join(ROOT, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8'));
let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error('[smoke-ai-abort-listener-cleanup] ' + message);
  passed++;
}

class TrackedSignal {
  constructor(aborted) {
    this.aborted = !!aborted;
    this.listeners = new Set();
    this.addCount = 0;
    this.removeCount = 0;
  }
  addEventListener(type, listener) {
    if (type !== 'abort') return;
    this.addCount++;
    this.listeners.add(listener);
  }
  removeEventListener(type, listener) {
    if (type !== 'abort') return;
    this.removeCount++;
    this.listeners.delete(listener);
  }
  abort() {
    if (this.aborted) return;
    this.aborted = true;
    Array.from(this.listeners).forEach((listener) => listener());
  }
  get activeCount() { return this.listeners.size; }
}

function okResponse(content) {
  return {
    ok: true,
    status: 200,
    headers: { get(name) { return String(name).toLowerCase() === 'content-type' ? 'application/json' : null; } },
    async json() { return { choices: [{ message: { content: content || 'ok', tool_calls: [] } }] }; }
  };
}

async function main() {
  const nativeSetTimeout = setTimeout;
  const ctx = {
    console: { log() {}, info() {}, warn() {}, error() {} },
    Date, Math, JSON, Promise, Number, String, Object, Array, Error, RegExp, Map, Set,
    AbortController, TextDecoder, isFinite, isNaN, parseInt, parseFloat,
    setTimeout(fn, ms) { return nativeSetTimeout(fn, ms === 1000 || ms === 2000 ? 0 : ms); },
    clearTimeout,
    P: { ai: { key: 'test-key', url: 'https://example.invalid/v1', model: 'test-model', temp: 0.2 }, conf: {} },
    GM: { turn: 1 },
    _buildAIUrl() { return 'https://example.invalid/v1/chat/completions'; },
    _buildAIUrlForTier() { return 'https://example.invalid/v1/chat/completions'; },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    fetch: async () => okResponse('ok')
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(jsonSource, ctx, { filename: 'tm-ai-infra-json.js' });
  vm.runInContext(source, ctx, { filename: 'tm-ai-infra.js' });
  if (ctx._aiQueue && typeof ctx._aiQueue.enqueue === 'function') ctx._aiQueue.enqueue = (fn) => fn();

  const longLived = new TrackedSignal(false);
  for (let i = 0; i < 20; i++) {
    await ctx._aiFetchWithRetryInner('https://example.invalid/v1', { model: 'm', messages: [], max_tokens: 10 }, longLived, { apiKey: 'k', maxRetries: 0, timeoutMs: 5000 });
    assert(longLived.activeCount === 0, 'normal request ' + i + ' removes its external abort listener');
  }
  assert(longLived.addCount === 20 && longLived.removeCount === 20, 'a long-lived signal has balanced add/remove counts');

  let attempts = 0;
  ctx.fetch = async () => { attempts++; throw new Error('network down'); };
  const retrySignal = new TrackedSignal(false);
  let retryError = null;
  try {
    await ctx._aiFetchWithRetryInner('https://example.invalid/v1', { max_tokens: 10 }, retrySignal, { apiKey: 'k', maxRetries: 2, timeoutMs: 5000 });
  } catch (error) { retryError = error; }
  assert(retryError && attempts === 3, 'network errors exercise every configured retry attempt');
  assert(retrySignal.activeCount === 0 && retrySignal.addCount === 5 && retrySignal.removeCount === 5, 'three requests and two cancellable waits clean every external listener');

  ctx.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('request aborted')), { once: true });
  });
  const timeoutSignal = new TrackedSignal(false);
  let timeoutError = null;
  try {
    await ctx._aiFetchWithRetryInner('https://example.invalid/v1', { max_tokens: 10 }, timeoutSignal, { apiKey: 'k', maxRetries: 0, timeoutMs: 5 });
  } catch (error) { timeoutError = error; }
  assert(timeoutError && timeoutSignal.activeCount === 0 && timeoutSignal.addCount === timeoutSignal.removeCount, 'timeout path removes the listener');

  const cancelSignal = new TrackedSignal(false);
  const cancelled = ctx._aiFetchWithRetryInner('https://example.invalid/v1', { max_tokens: 10 }, cancelSignal, { apiKey: 'k', maxRetries: 3, timeoutMs: 5000 });
  await Promise.resolve();
  cancelSignal.abort();
  let cancelError = null;
  try { await cancelled; } catch (error) { cancelError = error; }
  assert(cancelError && cancelSignal.activeCount === 0 && cancelSignal.addCount === cancelSignal.removeCount, 'user cancellation removes the listener and does not leak into retries');

  const alreadyAborted = new TrackedSignal(true);
  let alreadyError = null;
  try { await ctx._aiFetchWithRetryInner('https://example.invalid/v1', { max_tokens: 10 }, alreadyAborted, { apiKey: 'k', maxRetries: 0, timeoutMs: 5000 }); }
  catch (error) { alreadyError = error; }
  assert(alreadyError && alreadyAborted.addCount === 0 && alreadyAborted.activeCount === 0, 'already-aborted signals fail before registering a listener');

  ctx.fetch = async () => okResponse('stream-json');
  const streamSignal = new TrackedSignal(false);
  const streamText = await ctx._callAIMessagesStreamDirect([{ role: 'user', content: 'x' }], 10, { signal: streamSignal, skipQueue: true, timeoutMs: 5000 });
  assert(streamText === 'stream-json' && streamSignal.activeCount === 0 && streamSignal.addCount === streamSignal.removeCount, 'stream transport cleans its external listener on normal completion');

  ctx.fetch = async () => ({
    ok: true, status: 200,
    async json() { return { choices: [{ message: { content: '', tool_calls: [{ function: { name: 'probe', arguments: '{}' } }] } }] }; }
  });
  const toolSignal = new TrackedSignal(false);
  await ctx.callAIWithTools('probe', [{ name: 'probe', parameters: { type: 'object', properties: {} } }], { signal: toolSignal, maxTok: 20, timeoutMs: 5000 });
  assert(toolSignal.activeCount === 0 && toolSignal.addCount === toolSignal.removeCount, 'tool transport cleans its external listener on normal completion');

  console.log('[smoke-ai-abort-listener-cleanup] pass assertions=' + passed);
}

main().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
