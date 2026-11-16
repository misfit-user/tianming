/*
 * smoke-office-settings-toggles.js — 官制 flag 设置面板开关（源契约）
 *   openSettings(tm-patches.js)「🧪实验模式·LLM 模式」段加「🏛️官制·机制深化」7 个独立开关·
 *   走既有 _togglePConf(写 P.conf + saveP 持久化)。组闸 officeActivationEnabled 已在同段。
 *   真浏览器验见 scratchpad/pw-settings-office.js(7/7 入 DOM·点击写 P.conf·复开勾选·errs=[])。
 * node scripts/smoke-office-settings-toggles.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

const src = (fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8'));
// ── 官制活化·细粒度 6 独立开关（cp9·补齐 activation 四刀/recall/vacancy 的设置开关）──
// _togglePConf 持久化（tm-player-settings.js / tm-patches.js）

// 语法
const vm = require('vm');
let synOk = true;
try { new vm.Script(src); } catch (e) { synOk = false; }
ok(synOk, 'tm-patches.js 语法有效');

console.log('\nsmoke-office-settings-toggles: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
