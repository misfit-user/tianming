#!/usr/bin/env node
'use strict';

// 剧本工坊回归线：官制实体别名 + preview/ 子目录源码读取。
// 不调用真实 API/网络；用最小 fetch/IPC mock 锁住 renderer 的两条读取通道。
const fs = require('fs');
const path = require('path');
const AA = require(path.join(__dirname, '..', 'editor-authoring-agent.js'));

let pass = 0;
function ok(condition, message) {
  if (!condition) throw new Error('FAIL: ' + message);
  pass++;
  console.log('  ✓ ' + message);
}
function response(body, status) {
  status = status == null ? 200 : status;
  return {
    ok: status >= 200 && status < 300,
    status: status,
    text: () => Promise.resolve(String(body || '')),
    json: () => Promise.resolve(JSON.parse(String(body || '')))
  };
}

(async function main() {
  console.log('smoke-authoring-agent-office-source');

  console.log('— 官制实体形状与别名 —');
  const office = AA.dispatchTool({}, 'describeSchema', { kind: 'office' }, []);
  ok(office.ok && office.canonicalKind === 'office', 'describeSchema(kind=office) 返回官制部门形状');
  ok(office.template.positions && office.template.subs, 'office 形状含 positions[] 与 subs[]');
  const officeTree = AA.dispatchTool({}, 'describeSchema', { kind: 'officeTree' }, []);
  ok(officeTree.ok && officeTree.canonicalKind === 'office', 'describeSchema(kind=officeTree) 兼容别名');
  const cnOffice = AA.dispatchTool({}, 'describeSchema', { kind: '官职图' }, []);
  ok(cnOffice.ok && cnOffice.canonicalKind === 'office', 'describeSchema(kind=官职图) 兼容中文别名');
  const position = AA.dispatchTool({}, 'describeSchema', { kind: '官职' }, []);
  ok(position.ok && position.canonicalKind === 'officePosition', 'describeSchema(kind=官职) 返回 positions[] 条目形状');
  const officialPath = path.join(__dirname, '..', '..', 'scenarios', '天启七年·九月（官方）.json');
  const official = JSON.parse(fs.readFileSync(officialPath, 'utf8'));
  const officialDeptKeys = new Set();
  const officialPositionKeys = new Set();
  (official.officeTree || []).forEach(function (dept) {
    Object.keys(dept || {}).forEach(function (key) { officialDeptKeys.add(key); });
    (dept && dept.positions || []).forEach(function (pos) {
      Object.keys(pos || {}).forEach(function (key) { officialPositionKeys.add(key); });
    });
  });
  const templatePosition = office.template.positions[0];
  Array.from(officialDeptKeys).forEach(function (key) {
    ok(Object.prototype.hasOwnProperty.call(office.template, key), 'office 模板保留官方部门字段 ' + key);
  });
  Array.from(officialPositionKeys).forEach(function (key) {
    ok(Object.prototype.hasOwnProperty.call(templatePosition, key), 'officePosition 模板保留官方官职字段 ' + key);
  });
  const contract = AA.dispatchTool({}, 'fieldContract', { field: 'office' }, [{ field: 'officeTree', title: '官职树' }]);
  ok(contract.ok && contract.inContract && contract.canonicalField === 'officeTree', 'fieldContract(field=office) 归一到权威 officeTree');
  const oldFetch = global.fetch;
  try {
    global.fetch = undefined;
    const noChannelRef = await AA.dispatchTool({}, 'genReference', { part: 'officeTree' }, []);
    ok(noChannelRef && noChannelRef.ok === false && noChannelRef.reason && noChannelRef.errorCode === 'TM_SOURCE_UNAVAILABLE', 'genReference 无源码通道返回可渲染的结构化错误');
  } finally {
    global.fetch = oldFetch;
  }

  console.log('— HTTP(S) preview/ 子目录回退到 web 根 —');
  global.document = { baseURI: 'https://example.test/tianming/preview/scenario-editor-reset-preview.html' };
  global.window = {};
  const urls = [];
  global.fetch = function (url) {
    const u = String(url);
    urls.push(u);
    if (u === 'https://example.test/tianming/source-manifest.json') {
      return Promise.resolve(response(JSON.stringify({ files: ['index.html', 'tools/debug-officetree.js', 'tm-office-system.js', 'editor-office-deep.js'] })));
    }
    if (u === 'https://example.test/tianming/index.html') return Promise.resolve(response('<html>\nROOT\n</html>'));
    if (u === 'https://example.test/tianming/tm-office-system.js') return Promise.resolve(response('const officeTree = [];\nGM.officeTree = officeTree;'));
    if (u === 'https://example.test/tianming/editor-office-deep.js') return Promise.resolve(response('function renderOfficeTree() { return GM.officeTree; }'));
    return Promise.resolve(response('', 404));
  };
  const listed = await AA.dispatchTool({}, 'listSource', { filter: 'office' }, []);
  ok(listed.ok && listed.matched === 3 && listed.files.indexOf('tm-office-system.js') >= 0, 'listSource 在 preview/ 页面找到 web/source-manifest.json');
  ok(urls[0] === 'https://example.test/tianming/source-manifest.json' && urls.indexOf('https://example.test/tianming/preview/source-manifest.json') < 0, 'preview/ 页面优先读取 web 根源码清单');
  const read = await AA.dispatchTool({}, 'readSource', { path: 'index.html', limit: 2 }, []);
  ok(read.ok && /ROOT/.test(read.content), 'readSource 使用已探测的 web 根读取文件');
  const grep = await AA.dispatchTool({}, 'grepSource', { query: 'officeTree', maxFiles: 2 }, []);
  ok(grep.ok && grep.hits.length >= 1 && grep.scannedFiles >= 1, 'grepSource 优先扫描官制相关源码并返回命中');
  ok(!grep.failedFiles || grep.failedFiles.length === 0, 'grepSource 不把旧 dev-tools 路径计入本次有效扫描');

  console.log('— 桌面 IPC 优先 + 旧 preload 失败可回退 —');
  global.document = { baseURI: 'file:///C:/Tianming/web/preview/scenario-editor-reset-preview.html' };
  let fetchCalls = 0;
  global.fetch = function () { fetchCalls++; return Promise.reject(new TypeError('Failed to fetch')); };
  global.window = { tianming: { readWebFile: function (rel) {
    if (rel === 'source-manifest.json') return Promise.resolve({ success: true, text: JSON.stringify({ files: ['editor-fullgen.js'] }) });
    return Promise.resolve({ success: true, text: "{ key:'officeTree', label:'官制部门' }" });
  } } };
  const ipcList = await AA.dispatchTool({}, 'listSource', {}, []);
  ok(ipcList.ok && ipcList.files[0] === 'editor-fullgen.js', '桌面 readWebFile 存在时不依赖 fetch');
  ok(fetchCalls === 0, 'IPC 成功时浏览器 fetch 不被调用');

  global.window.tianming.readWebFile = function () { return Promise.reject(new Error('No handler registered')); };
  global.document = { baseURI: 'https://example.test/tianming/preview/scenario-editor-reset-preview.html' };
  global.fetch = function (url) {
    const u = String(url);
    if (u === 'https://example.test/tianming/source-manifest.json') return Promise.resolve(response(JSON.stringify({ files: [] })));
    return Promise.resolve(response('', 404));
  };
  const fallback = await AA.dispatchTool({}, 'listSource', {}, []);
  ok(fallback.ok && fallback.total === 0, '旧 preload IPC 失败时仍可回退 HTTP 通道');

  console.log('\nsmoke-authoring-agent-office-source PASS ' + pass);
})().catch(function (error) {
  console.error('smoke-authoring-agent-office-source FAIL ' + (error && error.stack || error));
  process.exit(1);
});
