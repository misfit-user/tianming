'use strict';
const assert = require('assert/strict');
const { transport, load } = require('./lib-turn-reliability');
const { extracted } = require('./lib-player-error-regression');
const tests = [], test = (name, fn) => tests.push({ name, fn });
const bad = status => ({ ok: false, status, headers: { get() { return null; } }, text: async () => 'temporary fixture failure' });
const good = (content, toolCalls) => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ choices: [{ message: { content, tool_calls: toolCalls }, finish_reason: 'stop' }] }) });
const toolCalls = [{ id: 'fixture', type: 'function', function: { name: 'read_world', arguments: '{}' } }];
const prompts = { system: '系统测试上下文', user: '完整模型请求' };
function fixture(retries) {
  const f = transport(), c = f.c; c.global = c; c._dbg = () => {};
  c.P.conf.aiSecondaryRetryCount = retries;
  c.P.ai.secondary = { key: 'fixture-secondary', url: 'https://secondary.invalid/v1', model: 'fixture-secondary' };
  c._getAITier = tier => Object.assign({}, tier === 'secondary' ? c.P.ai.secondary : c.P.ai, { tier: tier === 'secondary' ? 'secondary' : 'primary' });
  c._buildAIUrlForTier = tier => c._getAITier(tier).url + '/chat/completions'; c._buildAIUrl = () => c.P.ai.url; c._aiRetryDelay = () => 1;
  load(c, 'tm-call-retry-policy.js');
  c._buildPrompt = c._buildPromptCore = () => prompts; c._factionToolCtx = () => ({}); c._recordFacToolStat = () => {};
  f.handles = 0; c.TM.FactionDecisionTools = { defs: () => [{ name: 'read_world', parameters: { type: 'object' } }], handle: async () => { f.handles++; return { text: '世界数据' }; } };
  extracted(c, 'tm-faction-npc-llm-decision.js', ['_safeNum', '_extractJsonText', '_parseDecisionJson', '_withTimeout', '_precisionMaxTokens', '_looksLikeTruncatedLlmOutput',  '_callLLMDecision', '_decideViaTools']);
  Object.assign(c.GM, { year: 1628, chars: [], facs: [], factions: {}, parties: {}, _indices: { charByName: new Map() } });
  c.P.time = { year: 1628 }; c.P.playerInfo = { characterName: '测试君主' };
  load(c, 'tm-indices.js'); load(c, 'tm-char-autogen.js');
  f.requests = []; f.respond = responder => { c.fetch = async (url, opts) => { const row = { url, body: JSON.parse(opts.body) }; f.requests.push(row); return responder(row, f.requests.length); }; };
  return f;
}
for (const retries of [0, 1]) {
  test('NPC ordinary transport exhaustion uses ' + (retries + 1) + ' sends, without restarting format retries', async () => {
    const f = fixture(retries); try { f.respond(() => bad(503)); const result = await f.c._callLLMDecision(prompts, { maxAttempts: 3 }); assert.equal(result.parsed, null); assert.equal(result.diagnostics.attempts, 1); assert.equal(f.requests.length, retries + 1); } finally { f.dispose(); }
  });
  test('NPC failed tool request does not fall back to another ordinary model task: ' + retries, async () => {
    const f = fixture(retries); try { f.respond(() => bad(503)); const result = await f.c._decideViaTools({ name: '测试势力' }, {}); assert.equal(result.parsed, null); assert.equal(f.requests.length, retries + 1); assert(f.requests.every(row => row.body.tools)); assert.equal(f.handles, 0); } finally { f.dispose(); }
  });
  test('NPC second model round exhaustion does not repeat completed tool calls: ' + retries, async () => {
    const f = fixture(retries); try { f.respond((_row, n) => n === 1 ? good('', toolCalls) : bad(503)); const result = await f.c._decideViaTools({ name: '测试势力' }, {}); assert.equal(result.parsed, null); assert.equal(f.requests.length, retries + 2); assert.equal(f.handles, 1); } finally { f.dispose(); }
  });
  test('character generation stops after ' + (retries + 1) + ' sends and preserves its template fallback', async () => {
    const f = fixture(retries); try { f.respond(() => bad(503)); const result = await f.c.aiGenerateCompleteCharacter('赵测试', { tier: 'secondary', reason: '策名测试' }); assert.equal(f.requests.length, retries + 1); assert.equal(result._autoTemplateFallback, true); assert.equal(f.c.GM.chars.length, 1); assert(!f.c.GM._generatingChars['赵测试']); } finally { f.dispose(); }
  });
}
test('NPC completed response with invalid JSON still gets its format repair request', async () => {
  const f = fixture(0); try { f.respond((_row, n) => good(n === 1 ? '这不是JSON' : '{"rationale":"格式修复完成"}')); const result = await f.c._callLLMDecision(prompts, {}); assert.equal(result.parsed.rationale, '格式修复完成'); assert.equal(f.requests.length, 2); assert(f.requests[1].body.messages[0].content.includes('FORMAT_ERROR_RETRY')); } finally { f.dispose(); }
});
test('NPC tool response with bad format retains ordinary format fallback', async () => {
  const f = fixture(0); try { f.respond((_row, n) => good(n === 1 ? '这不是JSON' : '{"rationale":"格式修复完成"}')); const result = await f.c._decideViaTools({ name: '测试势力' }, {}); assert.equal(result.parsed.rationale, '格式修复完成'); assert.equal(f.requests.length, 2); assert(f.requests[0].body.tools); assert(!f.requests[1].body.tools); } finally { f.dispose(); }
});
test('character JSON format repair remains available with transport retries disabled', async () => {
  const f = fixture(0); try {
    f.respond((_row, n) => good(n === 1 ? '这不是JSON' : '{"name":"赵测试","isHistorical":false,"bio":"正常生成正文","age":34,"gender":"男"}'));
    const result = await f.c.aiGenerateCompleteCharacter('赵测试', { tier: 'secondary' }); assert.equal(f.requests.length, 2); assert(!result._autoTemplateFallback); assert.equal(f.c.GM.chars.length, 1);
  } finally { f.dispose(); }
});
test('character repeated JSON format failures still use the existing template fallback', async () => {
  const f = fixture(0); try { f.respond(() => good('这不是JSON')); const result = await f.c.aiGenerateCompleteCharacter('赵测试', { tier: 'secondary' }); assert.equal(f.requests.length, 3); assert.equal(result._autoTemplateFallback, true); assert(!f.c.GM._generatingChars['赵测试']); } finally { f.dispose(); }
});
for (const route of ['ordinary', 'tools']) test('cancelled NPC ' + route + ' model request does not create another model task', async () => {
  const f = fixture(1); try {
    f.respond(() => { setTimeout(() => f.c._aiCancelPendingWaits(), 5); return new Promise(() => {}); });
    const result = route === 'ordinary' ? await f.c._callLLMDecision(prompts, {}) : await f.c._decideViaTools({ name: '测试势力' }, {});
    assert.equal(result.parsed, null); assert.equal(f.requests.length, 1); assert.equal(f.handles, 0);
  } finally { f.dispose(); }
});
test('cancelled character generation releases the lock without generating a template', async () => {
  const f = fixture(1); try {
    f.respond(() => { setTimeout(() => f.c._aiCancelPendingWaits(), 5); return new Promise(() => {}); });
    await assert.rejects(f.c.aiGenerateCompleteCharacter('赵测试', { tier: 'secondary' }), e => e.code === 'AI_ABORTED');
    assert.equal(f.requests.length, 1); assert.equal(f.c.GM.chars.length, 0); assert(!f.c.GM._generatingChars['赵测试']);
  } finally { f.dispose(); }
});
test('a replaced world clears the original character lock and creates no new character', async () => {
  const f = fixture(1), owner = f.c.GM; try {
    f.respond(() => { f.c.GM = Object.assign({}, owner, { turn: 2, chars: [], _generatingChars: {} }); return good('{"name":"赵测试","bio":"旧世界结果"}'); });
    await assert.rejects(f.c.aiGenerateCompleteCharacter('赵测试', { tier: 'secondary' }), e => e.code === 'AI_STALE_WORLD');
    assert.equal(f.requests.length, 1); assert.equal(f.c.GM.chars.length, 0); assert(!owner._generatingChars['赵测试']);
  } finally { f.dispose(); }
});
test('character hard response deadline stops generation without a template or retry', async () => {
  const f = fixture(1); try {
    f.c.P.ai.secondary.totalResponseTimeoutMs = 50; f.respond(() => new Promise(() => {}));
    await assert.rejects(f.c.aiGenerateCompleteCharacter('赵测试', { tier: 'secondary' }), e => /^(AI_REQUEST_DEADLINE|AI_RETRY_BUDGET)$/.test(e.code));
    assert.equal(f.requests.length, 1); assert.equal(f.c.GM.chars.length, 0); assert(!f.c.GM._generatingChars['赵测试']);
  } finally { f.dispose(); }
});
(async () => { let pass = 0, fail = 0; for (const t of tests) { try { await t.fn(); pass++; console.log('PASS ' + t.name); } catch (e) { fail++; console.error('FAIL ' + t.name + '\n' + e.stack); } } console.log(JSON.stringify({ pass, fail, total: tests.length })); if (fail) process.exitCode = 1; })();
