#!/usr/bin/env node
// smoke-semantic-cache-scheme-gate.js
// 验证「语义模型 useBrowserCache 按协议门控」——file://（桌面）下不再用 Cache API·
// 修过回合动画被 transformers 反复 cache.put('file' scheme unsupported) 拖住主线程而冻结的 bug。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } }

const RECALL = fs.readFileSync(path.join(ROOT, 'tm-semantic-recall.js'), 'utf8');
const WORKER = fs.readFileSync(path.join(ROOT, 'tm-semantic-worker.js'), 'utf8');

// ── 源契约:两处都改成按协议门控·不再无条件 true ──
ok(!/transformers\.env\.useBrowserCache = true;/.test(RECALL), '契约:recall 不再无条件 useBrowserCache=true');
ok(!/transformers\.env\.useBrowserCache = true;/.test(WORKER), '契约:worker 不再无条件 useBrowserCache=true');

// ── 抽真表达式实跑:不同协议下的门控结果 ──
const m = RECALL.match(/var _tmCacheOk = (\([\s\S]*?\));\s*\n\s*transformers\.env\.useBrowserCache = _tmCacheOk;/);
ok(!!m, '能抽出 _tmCacheOk 表达式');
const expr = m ? m[1] : 'false';

function evalUnder(proto) {
  // proto=null 模拟 location 未定义(worker 某些环境)
  const location = proto == null ? undefined : { protocol: proto };
  // eslint-disable-next-line no-new-func
  return Function('location', 'return ' + expr + ';')(location);
}

ok(evalUnder('http:') === true, '① http: → 启用浏览器缓存');
ok(evalUnder('https:') === true, '① https: → 启用浏览器缓存');
ok(evalUnder('file:') === false, '② ★file:（桌面 Electron）→ 禁用浏览器缓存(根治 cache.put 报错+主线程冻结)');
ok(evalUnder('capacitor:') === false, '② capacitor:（安卓）→ 禁用');
ok(!evalUnder(null), '② location 未定义 → 禁用(不抛错)');

console.log('[smoke-semantic-cache-scheme-gate] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);
