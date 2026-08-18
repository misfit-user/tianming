#!/usr/bin/env node
// smoke-json-repair-layers.js — Phase 1 C-1·锁 robustParseJSON Layer 1-2.6 修复能力
// 喂 5+ 种真实破损 JSON·验证每种都能抢救出 ≥ 关键字段

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(ROOT, 'tm-ai-infra-json.js'), 'utf8');

const sandbox = {
  console: console,
  window: {},
  document: {},
  TM: { errors: { captureSilent: function(){}, capture: function(){} } },
  location: { href: '' },
  navigator: { userAgent: '' },
  fetch: function(){}
};
sandbox.global = sandbox;
sandbox.self = sandbox;
sandbox.window.TM = sandbox.TM;

vm.runInNewContext(code, sandbox, { filename: 'tm-ai-infra-json.js' });

const rp = sandbox.robustParseJSON;
if (typeof rp !== 'function') {
  throw new Error('robustParseJSON not exported');
}

const TESTS = [
  {
    name: 'L1·markdown 包裹 + 干净 JSON',
    input: '```json\n{"a":1,"b":[1,2,3]}\n```',
    requires: ['a', 'b']
  },
  {
    name: 'L2b·尾逗号',
    input: '{"shilu_text":"abc","events":[1,2,],}',
    requires: ['shilu_text', 'events']
  },
  {
    name: 'L2c·中文智能引号',
    input: '{“shilu_text”:“abc”}',
    requires: ['shilu_text']
  },
  {
    name: '歧义闸·两个顶层 JSON 明确拒绝',
    input: '{"a":1,,"b":2}{"c":3}',
    reject: true,
    requires: []
  },
  {
    name: 'L2.5·max_tokens 截断·尾部不完整 (string 中)',
    input: '{"events":[{"type":"war","city":"Beijing"},{"type":"famine","city":"',
    requires: ['events']
  },
  {
    name: 'L2.6·完全没闭合·数组深嵌',
    input: '{"events":[{"type":"war"',
    requires: ['events']
  },
  {
    name: 'L2.6·结尾在 key 后无值',
    input: '{"a":1,"events":[{"type":"war"},{"type":',
    requires: ['events']
  },
  {
    name: 'L3·零结构化·命中关键字段 fallback',
    input: 'AI回复：shizhengji: "本回合大事..." 后面是别的废话',
    requires: ['shizhengji']
  }
];

let pass = 0, fail = 0;
TESTS.forEach(function(t) {
  let r = null;
  try { r = rp(t.input); } catch(e) {}
  const ok = t.reject ? r === null : r && t.requires.every(function(k) {
    if (!(k in r)) return false;
    const v = r[k];
    if (v == null) return false;
    if (Array.isArray(v)) return true;  // 空数组也算·至少 key 抢救出来
    if (typeof v === 'string') return true;
    if (typeof v === 'object') return true;
    return true;
  });
  if (ok) {
    pass++;
    console.log('  PASS · ' + t.name);
  } else {
    fail++;
    console.log('  FAIL · ' + t.name + ' => ' + JSON.stringify(r).slice(0, 140));
  }
});

console.log('[smoke-json-repair-layers] pass=' + pass + ' fail=' + fail);
if (fail > 0) {
  process.exit(1);
}
