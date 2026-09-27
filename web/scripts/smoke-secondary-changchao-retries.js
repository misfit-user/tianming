'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), acorn = require('acorn');
const { transport, load } = require('./lib-turn-reliability');
const source = fs.readFileSync(path.join(__dirname, '../tm-chaoyi-changchao-adapter.js'), 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest' });
const tests = [], test = (name, fn) => tests.push({ name, fn });
const text = JSON.stringify({ stance: 'support', line: '臣谨奏，请先核实民情再作裁定。' });
const bad = status => ({ ok: false, status, headers: { get: () => null }, text: async () => 'fixture error' });
const good = () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ choices: [{ message: { content: text }, finish_reason: 'stop' }] }) });
function fixture(retries = 1) {
  const f = transport(), c = f.c;
  load(c, 'tm-call-retry-policy.js');
  c.P.conf.aiSecondaryRetryCount = retries;
  c.P.ai.secondary = { key: 'fixture-secondary', url: 'https://secondary.fixture.invalid/v1', model: 'fixture-secondary' };
  c._getAITier = tier => Object.assign({}, tier === 'secondary' ? c.P.ai.secondary : c.P.ai, { tier: tier || 'primary' });
  c._buildAIUrlForTier = tier => c._getAITier(tier).url + '/chat/completions';
  c._buildAIUrl = () => c._buildAIUrlForTier('primary');
  c._aiRetryDelay = () => 1;
  c.CHARS = { '臣甲': { title: '官员' } }; c.CY = { abortCtrl: new AbortController() };
  c._cc3_makeMessagesWithSystem = prompt => [{ role: 'user', content: prompt }];
  for (const name of ['_cc3_aiGenReact', '_cc3_callAI']) {
    const node = ast.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === name);
    assert(node, name); vm.runInContext(source.slice(node.start, node.end), c, { filename: 'tm-chaoyi-changchao-adapter.js' });
  }
  f.requests = 0; f.chunks = [];
  f.respond = responder => { c.fetch = async (...args) => { f.requests++; return responder(...args); }; };
  return f;
}
const routes = {
  react: f => f.c._cc3_aiGenReact('臣甲', { title: '赈济', presenter: '臣乙' }, 'self', chunk => f.chunks.push(chunk)),
  dialogue: f => f.c._cc3_callAI('请奏赈济之议', chunk => f.chunks.push(chunk))
};
async function failed(run, f) {
  try { assert.equal(await run(f), null); }
  catch (e) { if (e.code === 'ERR_ASSERTION') throw e; }
}
for (const [name, run] of Object.entries(routes)) {
  for (const count of [0, 1]) test(name + ' exhausted retry count ' + count + ' cannot start a second non-streaming generation', async () => {
    const f = fixture(count);
    try { f.respond(() => bad(503)); await failed(run, f); assert.equal(f.requests, count + 1); }
    finally { f.dispose(); }
  });
  test(name + ' partial stream failure never sends the request again', async () => {
    const f = fixture(5);
    try {
      f.respond(() => { let reads = 0; return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, body: { getReader: () => ({
        read: async () => { if (reads++ === 0) return { done: false, value: new TextEncoder().encode('data: ' + JSON.stringify({ choices: [{ delta: { content: '{"line":"臣已开始奏对' } }] }) + '\n\n') }; throw new TypeError('network interrupted'); },
        cancel: async () => {}, releaseLock() {}
      }) } }; });
      await failed(run, f); assert.equal(f.requests, 1); assert(f.chunks.length > 0);
    } finally { f.dispose(); }
  });
  test(name + ' protects partial output even from a legacy stream caller without terminal markers', async () => {
    const f = fixture(); let plain = 0;
    try {
      f.c.callAIMessagesStream = async (_m, _t, opts) => { opts.onChunk('{"line":"臣已开始奏对'); throw new TypeError('legacy stream failed'); };
      f.c.callAIMessages = async () => { plain++; return text; };
      await failed(run, f); assert.equal(plain, 0); assert(f.chunks.length > 0);
    } finally { f.dispose(); }
  });
  test(name + ' cancellation does not fall back or send a request', async () => {
    const f = fixture();
    try { f.respond(good); f.c.CY.abortCtrl.abort(); await failed(run, f); assert.equal(f.requests, 0); }
    finally { f.dispose(); }
  });
  test(name + ' auth errors remain one request', async () => {
    const f = fixture(5);
    try { f.respond(() => bad(401)); await failed(run, f); assert.equal(f.requests, 1); }
    finally { f.dispose(); }
  });
  test(name + ' a server returning complete JSON for streaming preserves its single successful response', async () => {
    const f = fixture();
    try { f.respond(good); const result = await run(f); assert(result); assert.equal(name === 'react' ? result.line : result, name === 'react' ? JSON.parse(text).line : text); assert.equal(f.requests, 1); }
    finally { f.dispose(); }
  });
  test(name + ' an unmarked unsupported legacy stream still falls back once before any output', async () => {
    const f = fixture(); let plain = 0;
    try {
      f.c.callAIMessagesStream = async () => { throw new Error('stream reader unsupported'); };
      f.c.callAIMessages = async () => { plain++; return text; };
      const result = await run(f); assert(result); assert.equal(plain, 1);
    } finally { f.dispose(); }
  });
}
(async () => { let pass = 0, fail = 0; for (const t of tests) try { await t.fn(); pass++; console.log('PASS ' + t.name); } catch (e) { fail++; console.error('FAIL ' + t.name + '\n' + e.stack); } console.log(JSON.stringify({ pass, fail, total: tests.length })); if (fail) process.exitCode = 1; })();
