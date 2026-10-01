#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'web/tm-ai-infra-model-detect.js'), 'utf8');

function fixture(response) {
  const calls = [];
  const c = {
    AbortSignal,
    console: { log() {}, warn() {}, error() {} },
    _CTX_DETECTION_VERSION: 2,
    P: { conf: {}, ai: { key: 'test-key', url: 'https://api.example/v1', model: 'custom-model' } },
    _getAITier: () => c.P.ai,
    _buildAIUrlForTier: () => 'https://api.example/v1/chat/completions',
    _matchModelCtx: model => String(model).toLowerCase() === 'gpt-4o' ? 128 : 0,
    _matchModelOutput: () => 0,
    _persistProbeConf() {},
    _tmAIFetch: async (url, request) => {
      calls.push({ url, request });
      return response(url, request, calls.length);
    }
  };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(SOURCE, c, { filename: 'tm-ai-infra-model-detect.js' });
  return { c, calls };
}

async function run() {
  let passed = 0;
  async function test(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { console.error('FAIL ' + name + ': ' + error.message); process.exitCode = 1; }
  }

  await test('explicit context metadata wins over output max_tokens', async () => {
    const { c, calls } = fixture(async (_url, request) => ({
      ok: true, status: 200,
      json: async () => ({ id: 'custom-model', context_length: 1048576, max_tokens: 4096, max_completion_tokens: 4096 })
    }));
    const detected = await c.detectModelContextSize({ force: true });
    assert.equal(detected, 1024);
    assert.equal(c.P.conf._detectedContextK, 1024);
    assert.equal(c.P.conf._detectedMaxOutput, 4096);
    assert.equal(calls.length, 1);
  });

  await test('string and provider-specific input limits are parsed', async () => {
    const { c } = fixture(async () => ({
      ok: true, status: 200,
      json: async () => ({ id: 'custom-model', inputTokenLimit: '1M', outputTokenLimit: 8192 })
    }));
    const detected = await c.detectModelContextSize({ force: true });
    assert.equal(detected, 1024);
  });

  await test('model list uses declared context metadata for unknown model IDs', async () => {
    const { c } = fixture(async () => ({
      ok: true, status: 200,
      json: async () => ({ data: [{ id: 'custom-model', context_length: '131072' }] })
    }));
    const rows = await c.listAvailableModels({ tier: 'primary' });
    assert.equal(rows[0].contextK, 128);
    assert.equal(rows[0].contextSource, 'API元数据');
  });

  await test('a short successful probe is recorded only as a lower bound', async () => {
    const { c } = fixture(async (_url, request, n) => {
      if (request.method === 'GET') return { ok: false, status: 404, text: async () => 'not available' };
      if (n === 3) return { ok: true, status: 200, json: async () => ({}) };
      if (n === 4) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'unknown' } }] }) };
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'OK' } }] }) };
    });
    const detected = await c.detectModelContextSize({ force: true });
    assert.equal(detected, 256);
    assert.equal(c.P.conf._detectedContextK, 0);
    assert.match(c.P.conf._ctxDetectLayer, /仅证明/);
  });

  await test('old detector cache is not reused', async () => {
    const { c } = fixture(async () => ({ ok: false, status: 503, text: async () => 'offline' }));
    c.P.conf = { _detectedContextK: 4, _ctxCacheKey: 'custom-model@https://api.example/v1' };
    const detected = await c.detectModelContextSize({ force: false });
    assert.equal(detected, 256);
    assert.notEqual(c.P.conf._detectedContextK, 4);
  });

  console.log(JSON.stringify({ PASS: passed, FAIL: process.exitCode ? 1 : 0, SKIP: 0, WAIVED: 0 }));
}

run().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
