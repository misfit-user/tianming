#!/usr/bin/env node
'use strict';
/* smoke-imageapi-url — 生图 API 端点归一化防腐线（2026-07-10 治「测试 404」）。
 * §A ImageAPI.normalizeUrl/getConfig（行为·vm 切片）：基址补全 /v1/images/generations·
 *    完整端点原样用·Key 留空复用主 API Key（设置页承诺·此前 URL 被无视落主API推断→404）。
 * §B 国师 generateImage 镜像契约（静态）：同规归一化 + Key 回退。 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var P0 = 0, F0 = 0;
function ok(c, m) { if (c) { P0++; console.log('  ✓ ' + m); } else { F0++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
console.log('smoke-imageapi-url');

/* ── §A ImageAPI 行为 ─────────────────────────────────────────── */
console.log('— §A · ImageAPI.normalizeUrl / getConfig —');
(function () {
  var src = (read('tm-ai-infra-retry.js') + '\n' + read('tm-ai-infra.js'));
  var start = src.indexOf('var ImageAPI = {');
  var end = src.indexOf('\n};', start);
  ok(start >= 0 && end > start, 'ImageAPI 切片边界在');
  var store = {};
  var ctx = {
    console: console,
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); }
    },
    fetch: function () { throw new Error('smoke 不应发真请求'); }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src.slice(start, end + 3), ctx, { filename: 'imageapi-block.js' });
  var API = ctx.ImageAPI;
  ok(API && typeof API.normalizeUrl === 'function', 'normalizeUrl 已导出');

  ok(API.normalizeUrl('https://api.x.com') === 'https://api.x.com/v1/images/generations', '裸基址 → 补 /v1/images/generations');
  ok(API.normalizeUrl('https://api.x.com/v1/') === 'https://api.x.com/v1/images/generations', '/v1 基址(带尾斜杠) → 只补 /images/generations 不双拼');
  ok(API.normalizeUrl('https://api.x.com/v1beta') === 'https://api.x.com/v1beta/images/generations', 'v1beta 基址亦识别');
  ok(API.normalizeUrl('https://api.openai.com/v1/images/generations') === 'https://api.openai.com/v1/images/generations', '完整端点原样用(不双拼)');
  ok(API.normalizeUrl('') === '', '空串原样返回');

  // Key 留空复用主 API Key（此前 imgCfg.key 为空时整个 URL 被无视 → 落主API推断 → 404）
  store['tm_api_image'] = JSON.stringify({ url: 'https://img.example.com', model: 'gemini-2.5-flash-image' });
  store['tm_api'] = JSON.stringify({ key: 'sk-main', url: 'https://api.example.com/v1' });
  var cfg1 = API.getConfig();
  ok(cfg1.supported === true && cfg1.key === 'sk-main', 'Key 留空 → 复用主 API Key');
  ok(cfg1.url === 'https://img.example.com/v1/images/generations', 'Key 留空时生图 URL 仍以用户所填为准(归一化)');
  ok(cfg1.keyInherited === true && cfg1.model === 'gemini-2.5-flash-image', 'keyInherited 标注 + 模型透传');

  // 自带 Key + 完整端点
  store['tm_api_image'] = JSON.stringify({ key: 'sk-img', url: 'https://img2.example.com/v1/images/generations' });
  var cfg2 = API.getConfig();
  ok(cfg2.supported === true && cfg2.key === 'sk-img' && cfg2.url === 'https://img2.example.com/v1/images/generations', '自带 Key·完整端点原样用');

  // 无生图配置 → 主 API openai 推断
  delete store['tm_api_image'];
  var cfg3 = API.getConfig();
  ok(cfg3.supported === true && cfg3.inferred === true && /\/v1\/images\/generations$/.test(cfg3.url), '无生图配置 → 主 API 推断兜底仍在');
})();

/* ── §B 国师镜像契约 ─────────────────────────────────────────── */
console.log('— §B · 国师 generateImage 镜像 —');
(function () {
  var agent = read('editor-authoring-agent.js');
  ok(agent.indexOf('generations|edits|variations') >= 0, '国师侧同规归一化正则在(完整端点不双拼)');
  ok(/_loadImageApiConfig/.test(agent) && /loadEditorApiConfig\(\)\.key/.test(agent), '国师侧 Key 留空回退主 API Key');
  var infra = (read('tm-ai-infra-retry.js') + '\n' + read('tm-ai-infra.js'));
  ok(/normalizeUrl/.test(infra) && /editor-authoring-agent\.js generateImage 有同规镜像/.test(infra), '两侧镜像互注防漂移');
})();

console.log('\nsmoke-imageapi-url ' + (F0 === 0 ? 'PASS' : 'FAIL') + ' ' + P0 + '/' + (P0 + F0));
process.exit(F0 === 0 ? 0 : 1);
