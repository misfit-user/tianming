#!/usr/bin/env node
'use strict';
// Actual selected worktree modules; only HTTP, timing and the DOM are controlled.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process'), assert = require('assert/strict');
const { functionSource } = require('./lib-perf-round1.js');
const root = path.resolve(__dirname, '../..'), argv = process.argv.slice(2);
const ref = argv.includes('--ref') ? argv[argv.indexOf('--ref') + 1] : null;
const read = file => ref ? cp.execFileSync('git', ['show', ref + ':web/' + file], { cwd: root, encoding: 'utf8', maxBuffer: 4000000 }) : fs.readFileSync(path.join(root, 'web', file), 'utf8');
const answer = (content, finish = 'stop', reasoning) => ({ choices: [{ finish_reason: finish, message: { content, ...(reasoning ? { reasoning_content: reasoning } : {}) } }] });
const http = data => ({ ok: true, status: 200, async json() { return data; } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
class Element {
  constructor(value = '') { this.value = value; this.style = {}; this.dataset = {}; this.disabled = false; this.isConnected = true; this.children = []; this._html = ''; this._text = ''; this.listeners = {}; this.classList = { add() {}, remove() {} }; }
  set innerHTML(s) { this._html = s; this._text = ''; this.children = []; }
  get innerHTML() { return this._html + this._text + this.children.map(e => e.innerHTML).join(''); }
  set textContent(s) { this._text = s; this._html = ''; this.children = []; }
  get textContent() { return this._text + this.children.map(e => e.textContent).join(''); }
  appendChild(e) { this.children.push(e); return e; }
  addEventListener(k, fn) { this.listeners[k] = fn; }
  scrollIntoView() {}
}
function harness(serve = () => http(answer('诏曰：清查田亩，抚恤流民。'))) {
  const elements = Object.fromEntries(['edict-pol', 'edict-mil', 'edict-dip', 'edict-eco', 'edict-oth', 'edict-polish-style', 'edict-polished'].map(id => [id, new Element()]));
  elements['edict-pol'].value = '清查田亩，抚恤流民。'; elements['edict-polish-style'].value = 'elegant';
  const button = new Element(), requests = [], notices = [];
  const ui = { querySelector: sel => elements[sel.slice(1)] || null, querySelectorAll: () => [button] };
  const c = { console: { log() {}, info() {}, warn() {}, error() {} }, AbortController, setTimeout, clearTimeout,
    localStorage: { getItem() { return null; }, setItem() {} }, document: { getElementById: id => id === 'tm-action-edict-overlay' ? ui : elements[id] || null, createElement: () => new Element() },
    toast: msg => notices.push(msg), getTSText: () => '二年春', findScenarioById: () => ({ era: '架空古代', dynasty: '测试' }),
    P: { ai: { key: 'fixture-primary-key', url: 'https://primary.invalid/v1', model: 'gpt-4o', secondary: { key: 'fixture-secondary-key', url: 'https://secondary.invalid/v1', model: 'deepseek-reasoner' } }, conf: {} },
    GM: { sid: 'fixture', turn: 2, _campaignId: 'fixture-c', _timelineId: 'fixture-t', edicts: [] } };
  c.window = c; c.globalThis = c; vm.createContext(c);
  for (const name of ['_getAITier', '_useSecondaryTier', '_buildAIUrlForTier', '_buildAIUrl']) vm.runInContext(functionSource(read('tm-utils.js'), name), c);
  for (const name of ['_tmCaptureWorldLease', '_tmWorldLeaseCurrent']) vm.runInContext(functionSource(read('tm-post-turn-jobs.js'), name), c);
  for (const file of ['tm-ai-infra-json.js', 'tm-ai-infra-retry.js', 'tm-ai-infra.js', 'tm-ai-infra-model-detect.js', 'tm-hongyan-edict-ui.js']) vm.runInContext(read(file), c, { filename: file });
  c.getCompressionParams = () => ({ scale: 1 });
  c.escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  c._aiQueue.enqueue = fn => fn();
  c.fetch = async (url, init) => { requests.push({ url, body: JSON.parse(init.body), signal: init.signal }); return serve(requests.at(-1), requests.length, c); };
  return { c, elements, button, requests, notices, panel: elements['edict-polished'], run: () => c._polishEdicts() };
}
let pass = 0, fail = 0;
async function check(name, fn) { try { await fn(); pass++; console.log('PASS', name); } catch (e) { fail++; console.error('FAIL', name, e.message); } }
async function main() {
  await check('normal polish preserves input/world and chosen secondary, requires explicit adoption', async () => {
    const h = harness(), before = JSON.stringify(h.c.GM); await h.run();
    assert(h.panel.innerHTML.includes('清查田亩，抚恤流民。')); assert.equal(h.elements['edict-pol'].value, '清查田亩，抚恤流民。');
    assert.equal(JSON.stringify(h.c.GM), before); assert.equal(h.requests.length, 1); assert(h.requests[0].url.startsWith('https://secondary.invalid/')); assert.equal(h.button.disabled, false);
  });
  await check('reasoning-only truncation retries once with larger bounded budget and same prompt/model', async () => {
    const h = harness(r => http(r.body.max_tokens <= 2000 ? answer(null, 'length', 'PRIVATE THOUGHT') : answer('诏曰：清查田亩，抚恤流民。'))); await h.run();
    assert.equal(h.requests.length, 2); assert(h.requests[1].body.max_tokens > h.requests[0].body.max_tokens && h.requests[1].body.max_tokens <= 8000);
    assert.deepEqual(h.requests[1].body.messages, h.requests[0].body.messages); assert.equal(h.requests[1].body.model, h.requests[0].body.model);
    assert(h.requests.every(r => !Object.hasOwn(r.body, 'thinking') && !Object.hasOwn(r.body, 'tools'))); assert(h.panel.innerHTML.includes('诏曰：')); assert(!h.panel.innerHTML.includes('PRIVATE THOUGHT'));
  });
  await check('repeated length cannot loop or expose incomplete draft as publishable', async () => {
    const h = harness(() => http(answer('未完成的半道诏书', 'length', 'PRIVATE THOUGHT'))); await h.run();
    assert.equal(h.requests.length, 2); assert.equal(h.panel.dataset.errorCode, 'ai-text-truncated'); assert(!h.panel.innerHTML.includes('edict-polished-text')); assert(!h.panel.innerHTML.includes('PRIVATE THOUGHT')); assert.equal(h.button.disabled, false);
  });
  for (const [name, data, code] of [
    ['empty content', answer(''), 'ai-text-empty'], ['whitespace', answer('  \n '), 'ai-text-empty'],
    ['reasoning without truncation', answer(null, 'stop', 'PRIVATE THOUGHT'), 'ai-text-reasoning-only'],
    ['content filtered', answer(null, 'content_filter'), 'ai-text-refused'],
    ['refusal', { choices: [{ message: { content: null, refusal: 'provider refusal' } }] }, 'ai-text-refused'],
    ['invalid content object', answer({ text: 'not a supported content part' }), 'ai-text-format']
  ]) await check(name + ' gets a specific error without pointless automatic retry', async () => {
    const h = harness(() => http(data)); await h.run(); assert.equal(h.requests.length, 1); assert.equal(h.panel.dataset.errorCode, code);
    assert(!h.panel.innerHTML.includes('edict-polished-text')); assert(!h.panel.innerHTML.includes('润色未返回内容')); assert.equal(h.button.disabled, false);
    const hasRetry = e => (e.textContent === '重试润色' && !!e.listeners.click) || e.children.some(hasRetry); assert(hasRetry(h.panel), 'retry remains available');
  });
  await check('content blocks extract text only, never hidden reasoning', async () => {
    const h = harness(() => http(answer([{ type: 'thinking', text: 'PRIVATE THOUGHT' }, { type: 'text', text: '诏曰：' }, { type: 'text', text: '抚恤流民。' }]))); await h.run();
    assert(h.panel.innerHTML.includes('诏曰：抚恤流民。')); assert(!h.panel.innerHTML.includes('PRIVATE THOUGHT')); assert(!h.panel.innerHTML.includes('[object Object]'));
  });
  await check('Anthropic text blocks remain compatible', async () => {
    const h = harness(() => http({ content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text: '制曰：抚恤。' }], stop_reason: 'end_turn' })); await h.run(); assert(h.panel.innerHTML.includes('制曰：抚恤。'));
  });
  await check('legacy callers keep their original return contract', async () => {
    const h = harness(() => http(answer(null, 'length', 'private'))); assert.equal(await h.c.callAI('control', 2000), null); assert.equal(h.requests.length, 1);
  });
  await check('HTTP 401 is not retried or mislabelled empty and does not display secret echo', async () => {
    const h = harness(() => ({ ok: false, status: 401, async text() { return 'Unauthorized fixture-secondary-key'; } })); await h.run();
    assert.equal(h.requests.length, 1); assert(h.panel.innerHTML.includes('401')); assert(!h.panel.innerHTML.includes('fixture-secondary-key')); assert(h.panel.innerHTML.includes('次')); assert.equal(h.button.disabled, false);
  });
  await check('manual retry after failure recovers', async () => {
    const h = harness((_r, n) => http(answer(n === 1 ? '' : '制曰：恢复正常。'))); await h.run(); await h.run(); assert(h.panel.innerHTML.includes('制曰：恢复正常。')); assert.equal(h.requests.length, 2);
  });
  await check('missing primary key still uses configured secondary', async () => {
    const h = harness(); h.c.P.ai.key = ''; await h.run(); assert.equal(h.requests.length, 1); assert(h.panel.innerHTML.includes('诏曰：'));
  });
  await check('no configured key retains offline draft merge without fake AI success', async () => {
    const h = harness(); h.c.P.ai.key = ''; h.c.P.ai.secondary.key = ''; await h.run(); assert.equal(h.requests.length, 0); assert(h.panel.innerHTML.includes('【政令】'));
  });
  await check('disabled secondary stays on primary', async () => {
    const h = harness(); h.c.P.conf.secondaryEnabled = false; await h.run(); assert(h.requests[0].url.startsWith('https://primary.invalid/'));
  });
  await check('duplicate clicks do not launch concurrent billable polish requests', async () => {
    const gate = deferred(), h = harness(async () => { await gate.promise; return http(answer('制曰：一份结果。')); });
    const a = h.run(), b = h.run(), count = h.requests.length, disabled = h.button.disabled; gate.resolve(); await Promise.all([a, b]);
    assert.equal(count, 1); assert.equal(disabled, true); assert.equal(h.button.disabled, false);
  });
  await check('hide cancels request and late completion cannot reopen panel', async () => {
    const gate = deferred(), h = harness(async () => { await gate.promise; return http(answer('制曰：过期。')); });
    const p = h.run(); h.c._hidePolishedEdict(); const aborted = h.requests[0].signal.aborted; gate.resolve(); await p; assert.equal(aborted, true); assert.equal(h.panel.style.display, 'none'); assert.equal(h.panel.innerHTML, '');
  });
  await check('same-turn world switch rejects old result and no retry enters new world', async () => {
    const gate = deferred(), h = harness(async () => { await gate.promise; return http(answer(null, 'length', 'private')); });
    const p = h.run(); h.c.GM = { ...h.c.GM, _timelineId: 'other' }; gate.resolve(); await p; assert.equal(h.requests.length, 1); assert(!h.panel.innerHTML.includes('edict-polished-text')); assert.equal(h.button.disabled, false);
  });
  await check('edited draft is not replaced by stale result', async () => {
    const gate = deferred(), h = harness(async () => { await gate.promise; return http(answer('制曰：旧文。')); });
    const p = h.run(); h.elements['edict-pol'].value = '新输入'; gate.resolve(); await p; assert.equal(h.elements['edict-pol'].value, '新输入'); assert(!h.panel.innerHTML.includes('edict-polished-text')); assert.equal(h.panel.dataset.errorCode, 'edict-draft-changed');
  });
  await check('late success from same-turn old world cannot replace current polish or release its button', async () => {
    const gates = [deferred(), deferred()], h = harness(async (_r, n) => { await gates[n - 1].promise; return http(answer(n === 1 ? '旧世界的诏书' : '新世界的诏书')); });
    const a = h.run(); h.c.GM = { ...h.c.GM, _timelineId: 'new-world' }; const b = h.run();
    gates[0].resolve(); await a; const disabled = h.button.disabled, oldVisible = h.panel.innerHTML.includes('旧世界的诏书'); gates[1].resolve(); await b;
    assert.equal(disabled, true); assert.equal(oldVisible, false); assert(h.panel.innerHTML.includes('新世界的诏书')); assert.equal(h.button.disabled, false);
  });
  await check('close and reopen ignores old response', async () => {
    const gate = deferred(), h = harness(async (_r, n) => { if (n === 1) await gate.promise; return http(answer(n === 1 ? '旧结果' : '新结果')); });
    const a = h.run(); h.c._hidePolishedEdict(); await h.run(); gate.resolve(); await a; assert(h.panel.innerHTML.includes('新结果')); assert(!h.panel.innerHTML.includes('旧结果'));
  });
  await check('compressed scaling cannot exceed retry output ceiling', async () => {
    const h = harness(() => http(answer(null, 'length'))); h.c.getCompressionParams = () => ({ scale: 5 }); await h.run(); assert(h.requests.every(r => r.body.max_tokens <= 8000)); assert(h.requests.length <= 2);
  });
  await check('untrusted answer remains escaped', async () => {
    const h = harness(() => http(answer('</textarea><img src=x onerror=window.__xss=1>'))); await h.run(); assert(!h.panel.innerHTML.includes('<img')); assert(h.panel.innerHTML.includes('&lt;img'));
  });
  console.log(JSON.stringify({ baseline: ref, pass, fail })); process.exitCode = fail ? 1 : 0;
}
main().catch(e => { console.error(e); process.exitCode = 1; });
