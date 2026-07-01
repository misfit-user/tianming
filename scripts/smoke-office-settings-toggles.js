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

const src = fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8');
ok(/官制·机制深化/.test(src), 'openSettings 含「官制·机制深化」开关区');
const FLAGS = ['powerMinisterEnabled', 'officeReviewLandingEnabled', 'officeConspiracyEnabled', 'officeSatisfactionFeedbackEnabled', 'officeSalaryHeadcountEnabled', 'officePersonnelTurnoverEnabled', 'officeJingchaEnabled'];
FLAGS.forEach(function (f) {
  ok(src.indexOf("'" + f + "'") >= 0, '开关含 flag ' + f);
});
ok(/_togglePConf\(\\?'\\?'\s*\+\s*_it\[0\]/.test(src) || /onchange="_togglePConf\(\\'' \+ _it\[0\]/.test(src) || /_togglePConf\('"\s*\+\s*_it\[0\]/.test(src) || /_togglePConf\(\\'/.test(src), '开关走 _togglePConf(写 P.conf 持久化)');
ok(/officeActivationEnabled/.test(src), '组闸 officeActivationEnabled 在设置面板(活化四刀)');
// ── 官制活化·细粒度 6 独立开关（cp9·补齐 activation 四刀/recall/vacancy 的设置开关）──
ok(/官制活化·细粒度/.test(src), '设置含「官制活化·细粒度」段（活化四刀独立开关）');
['officePowerPerceptionEnabled', 'officeDutyStateEnabled', 'officeAuthorityGateEnabled', 'officeReformAdjudicationEnabled', 'officeRecallAgentEnabled', 'officeVacancyEnabled'].forEach(function (f) {
  ok(src.indexOf("'" + f + "'") >= 0, '细粒度开关含 flag ' + f);
});
ok(/P\.conf\[_ac\[0\]\] === false/.test(src), '默认开 flag(职权舆图/出缺补员)用 !==false 语义(勾选态反映默认开·可主动关)');
ok(/onchange="_togglePConf\(\\'' \+ _ac\[0\]/.test(src), '细粒度开关走 _togglePConf(写 P.conf 持久化)');
// _togglePConf 持久化（tm-player-settings.js / tm-patches.js）
const ps = fs.existsSync(path.join(ROOT, 'tm-player-settings.js')) ? fs.readFileSync(path.join(ROOT, 'tm-player-settings.js'), 'utf8') : '';
ok(/P\.conf\[confKey\] = !!on/.test(ps) && /saveP\(\)/.test(ps), '_togglePConf 写 P.conf[key] + saveP() 持久化');

// 语法
const vm = require('vm');
let synOk = true;
try { new vm.Script(src); } catch (e) { synOk = false; }
ok(synOk, 'tm-patches.js 语法有效');

console.log('\nsmoke-office-settings-toggles: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
