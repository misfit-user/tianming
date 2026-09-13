#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const zoneSource = fs.readFileSync(path.join(ROOT, 'tm-context-zones.js'), 'utf8');
const compilerSource = fs.readFileSync(path.join(ROOT, 'tm-memory-context-compiler.js'), 'utf8');
const infraSource = (fs.readFileSync(path.join(ROOT, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8'));
const coreSource = fs.readFileSync(path.join(ROOT, 'tm-endturn-core.js'), 'utf8');
const endturnAiSource = fs.readFileSync(path.join(ROOT, 'tm-endturn-ai.js'), 'utf8');

function sliceFunction(source, marker) {
  const start = source.indexOf(marker);
  assert(start >= 0, 'production function exists: ' + marker);
  let cursor = source.indexOf('{', start);
  let depth = 0;
  for (; cursor < source.length; cursor++) {
    if (source[cursor] === '{') depth++;
    if (source[cursor] === '}' && --depth === 0) return source.slice(start, cursor + 1);
  }
  throw new Error('unterminated production function: ' + marker);
}

function contextWithCompiler() {
  const context = { console, Date, Math, JSON };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(zoneSource, context, { filename: 'tm-context-zones.js' });
  vm.runInContext(compilerSource, context, { filename: 'tm-memory-context-compiler.js' });
  return context;
}

const context = contextWithCompiler();
const CZ = context.TM.ContextZones;
const MC = context.TM.MemoryContextCompiler;

assert.strictEqual(CZ.finiteNonNegative('12', 9), 12);
assert.strictEqual(CZ.finiteNonNegative('bad', 9), 9);
assert.strictEqual(CZ.finiteNonNegative(Infinity, 9), 9);
assert.strictEqual(CZ.finiteNonNegative(NaN, 9), 9);

const mandatory = CZ.packZones([
  { id: 'law-a', lane: 'L2_active_law_commitment', text: '甲法令'.repeat(900), mustKeep: true },
  { id: 'law-b', lane: 'L2_active_law_commitment', text: '乙承诺'.repeat(900), mustKeep: true },
  { id: 'optional', lane: 'L8_narrative_threads', text: '旧叙事'.repeat(900) }
], { maxTokens: 180 });
assert.strictEqual(mandatory.ok, true, 'mandatory zones are compressed rather than force-added');
assert(mandatory.tokenEstimate <= 180, 'mustKeep aggregate obeys the hard final ceiling');
assert(mandatory.items.some((item) => item.id === 'law-a'));
assert(mandatory.items.some((item) => item.id === 'law-b'));
assert(mandatory.diagnostics.rawTokenEstimate > mandatory.diagnostics.compressedTokenEstimate);
assert(mandatory.diagnostics.compressed.length >= 2, 'compression diagnostics name reduced mandatory zones');

['bad', Infinity, NaN].forEach((badBudget) => {
  const packed = CZ.packZones([
    { id: 'invalid-budget', text: '必须事实'.repeat(10000), mustKeep: true }
  ], { maxTokens: badBudget });
  assert(Number.isFinite(packed.maxTokens), 'invalid configured maxTokens receives a finite fallback');
  assert(packed.maxTokens === CZ.DEFAULT_INVALID_MAX_TOKENS);
  assert(packed.tokenEstimate <= packed.maxTokens);
  assert.strictEqual(packed.diagnostics.invalidMaxTokens, true);
});

const ownCap = CZ.packZones([
  { id: 'one-large-law', text: '持续法令'.repeat(500), mustKeep: true, maxTokens: 45 }
], { maxTokens: 600 });
assert.strictEqual(ownCap.ok, true);
assert(ownCap.tokenEstimate <= 45, 'one mustKeep zone also obeys its own maxTokens');

const impossible = CZ.packZones([
  { id: 'atomic-contract', text: '不可拆分的结构契约'.repeat(100), mustKeep: true, atomic: true }
], { maxTokens: 20 });
assert.strictEqual(impossible.ok, false);
assert.strictEqual(impossible.reason, 'mandatory_context_overflow');
assert(impossible.tokenEstimate <= 20);
assert.throws(() => CZ.requirePacked(impossible, 'supervisor'), (error) => error && error.code === 'mandatory_context_overflow');

function compileLongCampaign(turn) {
  const hits = [];
  for (let i = 0; i < 420; i++) {
    hits.push({
      id: 'edict-' + i,
      source: 'activeEdict',
      lane: 'L2_active_law_commitment',
      authority: 'rule_validated',
      turn: Math.max(1, turn - i),
      importance: 10,
      text: '持续法令第' + i + '条：赈济、军粮、官员承诺与执行边界必须继续遵守。'.repeat(3)
    });
  }
  // Production data can retain duplicate projections; the compiler must remove them before packing.
  hits.push(Object.assign({}, hits[12]));
  return MC.compileRecall([{ query: { purpose: 'long-campaign turn context' }, hits }], {
    turn,
    maxTokens: 1800,
    perHitMaxChars: 180
  });
}

[500, 1000].forEach((turn) => {
  const compiled = compileLongCampaign(turn);
  assert.strictEqual(compiled.ok, true, 'long campaign mandatory context compiles safely at turn ' + turn);
  assert(compiled.tokenEstimate <= 1800, 'long campaign result obeys hard ceiling at turn ' + turn);
  assert(compiled.text.startsWith('<memory-context'));
  assert(compiled.text.endsWith('</memory-context>\n'));
  assert(compiled.suppressed.some((item) => item.reason === 'duplicate_memory_fact'));
  MC.requireCompiled(compiled, 'turn-' + turn);
});

// Real end-turn transaction snapshot/rollback functions: a mandatory overflow must restore mutations.
{
  const tx = {
    console,
    Date,
    Math,
    JSON,
    deepClone: (value) => JSON.parse(JSON.stringify(value)),
    GM: { turn: 77, _campaignId: 'campaign-a', _timelineId: 'timeline-a', guoku: { money: 500 }, population: { national: { mouths: 1000 } } },
    P: { conf: {} },
    buildIndices() {},
    renderGameState() {},
    closeTurnResult() {},
    _buildSaveState(options) {
      return { GM: JSON.parse(JSON.stringify(options.gm)), P: JSON.parse(JSON.stringify(options.p)) };
    },
    _tmAdoptCommittedWorldSnapshot() { return true; },
    _tmInvalidateCommittedWorldSnapshot() {},
    window: null
  };
  tx.window = tx;
  tx.globalThis = tx;
  vm.createContext(tx);
  vm.runInContext(zoneSource, tx, { filename: 'tm-context-zones.js' });
  [
    'function _tmCaptureEndTurnObject(',
    'function _tmRestoreEndTurnObject(',
    'function _tmCaptureEndTurnTransaction(',
    'function _tmEndTurnTransactionCurrent(',
    'function _tmReportEndTurnBoundaryError(',
    'function _tmRequestEndTurnDesktopAutoSaveFlush(',
    'function _tmRestoreCommittedBaselineAfterRollback(',
    'function _tmRollbackEndTurnTransaction('
  ].forEach((marker) => vm.runInContext(sliceFunction(coreSource, marker), tx));
  const before = JSON.parse(JSON.stringify(tx.GM));
  const transaction = tx._tmCaptureEndTurnTransaction();
  tx.GM.guoku.money = 1;
  tx.GM.population.national.mouths = 2;
  let overflowError;
  try {
    const packed = tx.TM.ContextZones.packZones([
      { id: 'atomic-world-truth', text: '完整世界真值'.repeat(100), mustKeep: true, atomic: true }
    ], { maxTokens: 5 });
    tx.TM.ContextZones.requirePacked(packed, 'SC1_PRE_CONTEXT');
  } catch (error) {
    overflowError = error;
  }
  assert(overflowError && overflowError.code === 'mandatory_context_overflow');
  assert.strictEqual(tx._tmRollbackEndTurnTransaction(transaction, overflowError), true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(tx.GM.guoku)), before.guoku, 'actual end-turn rollback restores treasury after mandatory overflow');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(tx.GM.population)), before.population, 'actual end-turn rollback restores population after mandatory overflow');
  assert.strictEqual(transaction.rolledBack, true);
  assert.strictEqual(transaction.committed, false);
}

// Execute the same final SC1 request constructor and production call options used by runMain.
const sc1Runtime = {
  console,
  Date,
  Math,
  JSON,
  Number,
  String,
  Object,
  Array,
  Error,
  estimateTokens(text) {
    const value = String(text || '');
    let cjk = 0;
    let other = 0;
    for (const char of value) {
      if (/[^\x00-\xff]/.test(char)) cjk++;
      else other++;
    }
    return Math.ceil(cjk * 1.3 + other * 0.25);
  },
  getPromptBudget() {
    return { contextK: 8, budget: 6144, warn80: 4915, warn95: 5836 };
  },
  TM: { Endturn: { AI: {} } },
  window: null
};
sc1Runtime.window = sc1Runtime;
sc1Runtime.globalThis = sc1Runtime;
vm.createContext(sc1Runtime);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-ai-sc1-budget.js'), 'utf8'), sc1Runtime,
  { filename: 'tm-endturn-ai-sc1-budget.js' });
vm.runInContext(endturnAiSource, sc1Runtime, { filename: 'tm-endturn-ai.js' });
const sc1Api = sc1Runtime.TM.Endturn.AI.subcalls;
const finalRule = '=== 输出格式强约束 (FINAL RULE·不可违反) === YOU MUST RETURN JSON ONLY.';
const assembledSc1Body = {
  model: 'test-model',
  messages: [
    { role: 'system', content: 'SC1 system truth '.repeat(220) },
    {
      role: 'user',
      content: '玩家输入与权威账本 '.repeat(900)
        + '\n=== SC1_PRE_CONTEXT ===\n' + '持续法令与记忆 '.repeat(900)
        + '\n=== sc1q 硬性要求 ===\n' + Array.from({ length: 5 }, (_, i) => (i + 1) + '. required action ' + '甲'.repeat(100)).join('\n')
        + '\n=== 非常规举措 ===\n' + '异常链路 '.repeat(300)
        + '\n' + finalRule
    }
  ],
  response_format: {
    type: 'json_schema',
    json_schema: { name: 'sc1', strict: true, schema: { type: 'object', properties: { turn_summary: { type: 'string' } } } }
  },
  max_tokens: 2048
};
const finalizedSc1 = sc1Api.finalizeSc1RequestBody(assembledSc1Body, {
  contextTokens: 8192,
  completionTokens: 2048
});
assert(finalizedSc1.diagnostics.rawInputTokens > finalizedSc1.diagnostics.finalInputTokens,
  'the real final SC1 constructor trims after memory/actions/anomaly/final rules are appended');
assert(finalizedSc1.diagnostics.finalInputTokens <= finalizedSc1.diagnostics.inputTokenLimit);
assert(finalizedSc1.diagnostics.finalTotalTokens <= finalizedSc1.diagnostics.contextTokens,
  'system + final user + schema overhead + completion reserve obey the physical context ceiling');
assert(finalizedSc1.body.messages[1].content.includes(finalRule), 'final JSON rule remains in the retained tail');
const productionSc1Options = sc1Api.sc1ProductionCallOptions('结构化数据',
  sc1Api.createSc1ContextOverflowReducer({ contextTokens: 8192, completionTokens: 2048 }));
assert.strictEqual(productionSc1Options.id, 'sc1');
assert.strictEqual(typeof productionSc1Options.contextOverflowReducer, 'function',
  'the production SC1 call carries the one-shot context reducer');

async function testContextLengthRetry() {
  const requests = [];
  const ai = {
    console: { warn() {}, log() {}, error() {} },
    Date,
    Math,
    JSON,
    Promise,
    setTimeout,
    clearTimeout,
    AbortController,
    P: { ai: { key: 'test-key', url: 'https://example.invalid/v1', model: 'test-model' } },
    window: null,
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);
      if (requests.length === 1) {
        return {
          ok: false,
          status: 400,
          headers: { get() { return null; } },
          async text() { return '{"error":{"message":"maximum context length exceeded"}}'; }
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get() { return null; } },
        async json() { return { choices: [{ message: { content: 'ok' } }] }; }
      };
    }
  };
  ai.window = ai;
  ai.globalThis = ai;
  vm.createContext(ai);
  vm.runInContext(infraSource, ai, { filename: 'tm-ai-infra.js' });
  const original = assembledSc1Body;
  const result = await ai._aiFetchWithRetryInner('https://example.invalid/v1', original, null, {
    apiKey: 'test-key',
    maxRetries: 3,
    contextOverflowReducer: productionSc1Options.contextOverflowReducer
  });
  assert.strictEqual(result.choices[0].message.content, 'ok');
  assert.strictEqual(requests.length, 2, 'context length 400 gets exactly one stricter emergency retry');
  assert(JSON.stringify(requests[1]).length < JSON.stringify(requests[0]).length);
  assert.strictEqual(requests[1].response_format.type, 'json_object',
    'SC1 emergency retry compacts strict schema overhead as well as user context');

  let failedRequests = 0;
  ai.fetch = async () => {
    failedRequests++;
    return {
      ok: false,
      status: 400,
      headers: { get() { return null; } },
      async text() { return 'prompt is too long for context window'; }
    };
  };
  await assert.rejects(
    ai._aiFetchWithRetryInner('https://example.invalid/v1', original, null, { apiKey: 'test-key', maxRetries: 5 }),
    (error) => error && error.code === 'context_length_exceeded'
  );
  assert.strictEqual(failedRequests, 1, 'unreduced context 400 is not blindly retried');
}

testContextLengthRetry().then(() => {
  console.log('smoke-context-hard-ceiling ok');
}).catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
