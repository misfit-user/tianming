#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.resolve(__dirname, '..');
const infraSource = (fs.readFileSync(path.join(WEB, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(WEB, 'tm-ai-infra.js'), 'utf8'));
const budgetSource = fs.readFileSync(path.join(WEB, 'tm-endturn-ai-sc1-budget.js'), 'utf8');
const endturnSource = fs.readFileSync(path.join(WEB, 'tm-endturn-ai.js'), 'utf8');

function jsonResponse(content) {
  return {
    ok: true,
    status: 200,
    headers: { get() { return 'application/json'; } },
    async json() { return { choices: [{ message: { content } }] }; },
    async text() { return JSON.stringify({ choices: [{ message: { content } }] }); }
  };
}

function contextErrorResponse() {
  return {
    ok: false,
    status: 400,
    headers: { get() { return 'application/json'; } },
    async json() { return { error: { message: 'maximum context length exceeded' } }; },
    async text() { return '{"error":{"message":"maximum context length exceeded"}}'; }
  };
}

async function main() {
  const sent = [];
  const perfCounters = Object.create(null);
  const runtime = {
    console: { log() {}, warn() {}, error() {} },
    Date,
    Math,
    JSON,
    Promise,
    Number,
    String,
    Object,
    Array,
    Error,
    AbortController,
    TextDecoder,
    setTimeout,
    clearTimeout,
    P: { ai: { key: 'test-key', url: 'https://example.invalid/v1', model: 'stream-model', temp: 0.33 } },
    GM: { _aiDispatchStats: {} },
    getCompressionParams() { return { scale: 3 }; },
    getPromptBudget() { return { contextK: 8, budget: 6144, warn80: 4915, warn95: 5836 }; },
    _getAITier() { return { key: 'test-key', url: 'https://example.invalid/v1', model: 'transport-model', tier: 'primary' }; },
    _buildAIUrlForTier() { return 'https://example.invalid/v1'; },
    _buildAIUrl() { return 'https://example.invalid/v1'; },
    _detectAIProvider() { return 'openai'; },
    TM: {
      Endturn: { AI: {} },
      perf: { count(name, delta) { perfCounters[name] = (perfCounters[name] || 0) + (delta == null ? 1 : delta); } }
    },
    window: null,
    fetch: async (_url, options) => {
      sent.push(JSON.parse(options.body));
      return jsonResponse('{"turn_summary":"ok"}');
    }
  };
  runtime.window = runtime;
  runtime.globalThis = runtime;
  vm.createContext(runtime);
  vm.runInContext(infraSource, runtime, { filename: 'tm-ai-infra.js' });
  vm.runInContext(budgetSource, runtime, { filename: 'tm-endturn-ai-sc1-budget.js' });

  const api = runtime.TM.Endturn.AI.subcalls;
  const body = {
    model: 'budgeted-model',
    messages: [
      { role: 'system', content: 'system truth '.repeat(220) },
      { role: 'user', content: '长期世界状态 '.repeat(1150)
        + '\n=== SC1_PRE_CONTEXT ===\n' + '持续法令 '.repeat(1000)
        + '\n=== sc1q 硬性要求 ===\n' + '必须完成行动 '.repeat(180)
        + '\n=== 非常规举措 ===\n' + '异常链路 '.repeat(200)
        + '\n=== 输出格式强约束 (FINAL RULE·不可违反) ===\nYOU MUST RETURN JSON ONLY.' }
    ],
    temperature: 0.41,
    max_tokens: 2048,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'sc1',
        strict: true,
        schema: { type: 'object', properties: { turn_summary: { type: 'string' } }, required: ['turn_summary'] }
      }
    },
    tools: [{ type: 'function', function: { name: 'ledger', parameters: { type: 'object' } } }],
    tool_choice: 'auto'
  };
  const finalized = api.finalizeSc1RequestBody(body, { contextTokens: 8192, completionTokens: 2048 });
  assert.strictEqual(perfCounters['sc1.finalBodyCloneCount'], 1,
    'final budgeter should own one detached finalized-body clone');
  assert(finalized.diagnostics.finalTotalTokens <= finalized.diagnostics.contextTokens,
    'finalized request must fit prompt + schema/tool overhead + completion');

  const text = await runtime.callAIBodyStream(finalized.body, { skipQueue: true, priority: 'critical' });
  assert.strictEqual(perfCounters['sc1.transportBodyCloneCount'], 1,
    'stream transport should create exactly one queued network body clone');
  assert.strictEqual(text, '{"turn_summary":"ok"}');
  assert.strictEqual(sent.length, 1);
  const physical = sent[0];
  assert.strictEqual(physical.max_tokens, finalized.body.max_tokens,
    'compression scale must not enlarge finalized max_tokens');
  assert.deepStrictEqual(physical.messages, JSON.parse(JSON.stringify(finalized.body.messages)));
  assert.strictEqual(physical.model, finalized.body.model);
  assert.strictEqual(physical.temperature, finalized.body.temperature);
  assert.deepStrictEqual(physical.response_format, JSON.parse(JSON.stringify(finalized.body.response_format)),
    'strict response_format must survive streaming transport');
  assert.deepStrictEqual(physical.tools, JSON.parse(JSON.stringify(finalized.body.tools)));
  assert.strictEqual(physical.tool_choice, finalized.body.tool_choice);
  assert.strictEqual(physical.stream, true);

  sent.length = 0;
  let requestNo = 0;
  runtime.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    sent.push(request);
    requestNo += 1;
    if (requestNo <= 2) return contextErrorResponse();
    return jsonResponse('{"turn_summary":"reduced"}');
  };
  let streamFailed = false;
  try {
    await runtime.callAIBodyStream(finalized.body, { skipQueue: true, priority: 'critical' });
  } catch (error) {
    streamFailed = /HTTP 400/.test(error.message);
  }
  assert(streamFailed, 'stream context failure enters controlled non-stream fallback');
  const reducer = api.createSc1ContextOverflowReducer({ contextTokens: 8192, completionTokens: 2048 });
  const fallback = await runtime._aiFetchWithRetryInner(
    'https://example.invalid/v1',
    finalized.body,
    null,
    { apiKey: 'test-key', maxRetries: 4, contextOverflowReducer: reducer }
  );
  assert.strictEqual(fallback.choices[0].message.content, '{"turn_summary":"reduced"}');
  assert.strictEqual(sent.length, 3,
    'stream failure is followed by one original fallback and exactly one emergency-reduced retry');
  assert(JSON.stringify(sent[2]).length < JSON.stringify(sent[1]).length,
    'the single emergency retry uses a smaller request');

  sent.length = 0;
  runtime.fetch = async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return jsonResponse('{"turn_summary":"plain"}');
  };
  await runtime._aiFetchWithRetryInner('https://example.invalid/v1', finalized.body, null, {
    apiKey: 'test-key', maxRetries: 0
  });
  assert.strictEqual(sent[0].stream, undefined, 'default non-stream path remains non-streaming');

  assert(endturnSource.includes('callAIBodyStream(_sc1Body, {'),
    'production SC1 branch calls the exact finalized-body transport');
  assert(!endturnSource.includes('extraBody: _modelFamily === \'openai\' ? { response_format: { type: \'json_object\' } }'),
    'production stream branch no longer downgrades strict schema');
  console.log('[smoke-sc1-stream-final-budget] PASS requests=' + sent.length);
}

main().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
