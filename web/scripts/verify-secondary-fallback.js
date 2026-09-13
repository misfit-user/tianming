// 验证 M3.1·次 API(secondary) 网络不可达 → 自动回退主 API(primary)
// 用 vm 真实加载 tm-ai-infra.js，mock fetch 模拟 secondary(8765) 连接拒绝 / 500 / 流式。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const retry = fs.readFileSync(path.join(__dirname, '..', 'tm-ai-infra-retry.js'), 'utf8');
const SRC = path.join(__dirname, '..', 'tm-ai-infra.js');
// 第二十三拆：getCompressionParams 等迁 tm-ai-infra-model-detect.js·vm 须载全家族(origin 先·契约随人走)以忠实真实装载序
const code = retry + '\n' + fs.readFileSync(SRC, 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '..', 'tm-ai-infra-model-detect.js'), 'utf8');

// ─── 真实 tier 解析（从 tm-utils.js 原样复制，确保测试忠实）───
function _getAITier(tier) {
  const _s = sandbox.P.ai && sandbox.P.ai.secondary;
  if (tier === 'secondary' && _s && _s.key && _s.url) {
    return { key: _s.key, url: _s.url, model: _s.model || sandbox.P.ai.model || 'gpt-4o-mini', tier: 'secondary' };
  }
  return { key: (sandbox.P.ai && sandbox.P.ai.key) || '', url: (sandbox.P.ai && sandbox.P.ai.url) || '', model: (sandbox.P.ai && sandbox.P.ai.model) || 'gpt-4o', tier: 'primary' };
}
function _buildAIUrlForTier(tier) {
  const cfg = _getAITier(tier);
  let u = (cfg.url || '').replace(/\/+$/, '');
  if (!u) return u;
  if (u.indexOf('/chat/completions') >= 0 || u.indexOf('/messages') >= 0) return u;
  return u + '/chat/completions';
}

// ─── mock fetch ───
let fetchLog = [];
let mode = 'refuse'; // 'refuse' | 'http500'
function makeJsonResp(obj) {
  return {
    ok: true, status: 200,
    headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => obj,
    text: async () => JSON.stringify(obj),
    body: null
  };
}
function mockFetch(url) {
  fetchLog.push(String(url));
  const isSecondary = String(url).indexOf('8765') >= 0;
  if (isSecondary) {
    if (mode === 'http500') {
      return Promise.resolve({
        ok: false, status: 500,
        headers: { get: () => 'text/plain' },
        json: async () => ({}), text: async () => 'boom', body: null
      });
    }
    // 连接拒绝：fetch 网络层失败典型形态
    return Promise.reject(new TypeError('Failed to fetch'));
  }
  // primary 正常返回
  return Promise.resolve(makeJsonResp({ choices: [{ message: { content: 'PRIMARY_OK' } }], usage: {} }));
}

// ─── localStorage / document 极简 stub ───
const memStore = {};
const localStorageStub = {
  getItem: (k) => (k in memStore ? memStore[k] : null),
  setItem: (k, v) => { memStore[k] = String(v); },
  removeItem: (k) => { delete memStore[k]; }
};
const documentStub = {
  createElement: () => ({ appendChild() {}, firstChild: {}, click() {} }),
  getElementById: () => null,
  body: { appendChild() {}, removeChild() {} }
};

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Promise, Date, Math, JSON, Object, Array, String, Number, Boolean,
  parseInt, parseFloat, isFinite, isNaN, encodeURIComponent, decodeURIComponent,
  AbortController, TextDecoder, TextEncoder,
  fetch: mockFetch,
  localStorage: localStorageStub,
  document: documentStub,
  _getAITier, _buildAIUrlForTier,
  P: null
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'tm-ai-infra.js' });

function freshP(opts) {
  opts = opts || {};
  const p = {
    ai: { key: 'pk', url: 'https://api-jp.example/v1', model: 'gpt-4o', temp: 0.8 },
    conf: { secondaryEnabled: opts.secondaryEnabled !== false }
  };
  if (opts.secondaryConfigured !== false) {
    p.ai.secondary = { key: 'sk', url: 'http://127.0.0.1:8765/v1', model: 'relay-model' };
  }
  return p;
}

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra ? '  ->  ' + extra : '')); } }

(async function run() {
  // ── 测试1：secondary 连接拒绝 → callAI 回退 primary ──
  console.log('[1] callAI secondary 连接拒绝 → 回退 primary');
  sandbox.P = freshP(); mode = 'refuse'; fetchLog = [];
  let r1;
  try { r1 = await sandbox.callAI('hi', 100, null, 'secondary', { maxRetries: 0 }); } catch (e) { r1 = 'THREW:' + e.message; }
  ok('返回 primary 内容', r1 === 'PRIMARY_OK', r1);
  ok('确实先打了 secondary(8765)', fetchLog.some(u => u.indexOf('8765') >= 0));
  ok('确实回退打了 primary', fetchLog.some(u => u.indexOf('api-jp.example') >= 0));

  // ── 测试2：secondary 返回 HTTP 500 → 不回退（rethrow），不打 primary ──
  console.log('[2] callAI secondary HTTP 500 → 不回退（rethrow）');
  sandbox.P = freshP(); mode = 'http500'; fetchLog = [];
  let r2;
  try { r2 = await sandbox.callAI('hi', 100, null, 'secondary', { maxRetries: 0 }); } catch (e) { r2 = 'THREW:' + e.message; }
  ok('抛错而非回退', typeof r2 === 'string' && r2.indexOf('THREW') === 0, r2);
  ok('未回退打 primary', !fetchLog.some(u => u.indexOf('api-jp.example') >= 0));

  // ── 测试3：secondary 未配 + tier=secondary → 直接走 primary（既有行为不被破坏）──
  console.log('[3] secondary 未配 + tier=secondary → 直接 primary');
  sandbox.P = freshP({ secondaryConfigured: false }); mode = 'refuse'; fetchLog = [];
  let r3;
  try { r3 = await sandbox.callAI('hi', 100, null, 'secondary', { maxRetries: 0 }); } catch (e) { r3 = 'THREW:' + e.message; }
  ok('返回 primary 内容', r3 === 'PRIMARY_OK', r3);
  ok('从不打 8765', !fetchLog.some(u => u.indexOf('8765') >= 0));

  // ── 测试4：callAIMessages secondary 连接拒绝 → 回退 primary（calibrator 路径）──
  console.log('[4] callAIMessages secondary 连接拒绝 → 回退 primary');
  sandbox.P = freshP(); mode = 'refuse'; fetchLog = [];
  let r4;
  try { r4 = await sandbox.callAIMessages([{ role: 'user', content: 'hi' }], 100, null, 'secondary', { maxRetries: 0 }); } catch (e) { r4 = 'THREW:' + e.message; }
  ok('返回 primary 内容', r4 === 'PRIMARY_OK', r4);
  ok('先打 secondary 再回退 primary', fetchLog.some(u => u.indexOf('8765') >= 0) && fetchLog.some(u => u.indexOf('api-jp.example') >= 0));

  // ── 测试5：_callAIMessagesStreamDirect secondary 连接拒绝 → 回退 primary（问对/常朝流式路径）──
  console.log('[5] 流式 secondary 连接拒绝 → 回退 primary');
  sandbox.P = freshP(); mode = 'refuse'; fetchLog = [];
  let r5, chunks = [];
  try { r5 = await sandbox._callAIMessagesStreamDirect([{ role: 'user', content: 'hi' }], 100, { tier: 'secondary', onChunk: (t) => chunks.push(t) }); } catch (e) { r5 = 'THREW:' + e.message; }
  ok('返回 primary 内容', r5 === 'PRIMARY_OK', r5);
  ok('先打 secondary 再回退 primary', fetchLog.some(u => u.indexOf('8765') >= 0) && fetchLog.some(u => u.indexOf('api-jp.example') >= 0));

  // ── 测试6：tier=primary 正常时不受影响 ──
  console.log('[6] tier=primary 正常 → 不触发回退逻辑');
  sandbox.P = freshP(); mode = 'refuse'; fetchLog = [];
  let r6;
  try { r6 = await sandbox.callAI('hi', 100, null, undefined, { maxRetries: 0 }); } catch (e) { r6 = 'THREW:' + e.message; }
  ok('返回 primary 内容', r6 === 'PRIMARY_OK', r6);
  ok('从不打 8765', !fetchLog.some(u => u.indexOf('8765') >= 0));

  console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})();
