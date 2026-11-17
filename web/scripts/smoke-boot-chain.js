#!/usr/bin/env node
// 原名 boot-smoke.js，只登记在已撤掉的 verify-all.js 里；2026-11-17 改名进 run-smokes 的自动发现。
// Lightweight boot gate: load the index.html script chain up to tm-test-harness.js
// and assert the core boot entrypoints exist. The full TM.test suite remains in
// headless-smoke.js.

'use strict';

if (!process.argv.includes('--boot-only')) {
  process.argv.push('--boot-only');
}

require('./headless-smoke.js');
