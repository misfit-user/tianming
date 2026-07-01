#!/usr/bin/env node
'use strict';
/* smoke-onboarding-help — 上手门槛批次源契约(A1活化帮助/A2无key提示/A3首回合指引):
 * 4个openHelp*接到有效HelpSystem topic·F1绑定·无key查P.ai.key弹banner·首回合指引turn===1+localStorage门控·均挂enterGame:after。
 * DOM行为已真浏览器验证(buttons/F1/banner/guide全通)·此smoke守接线防腐(topic重命名/函数删除即红)。 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.resolve(__dirname, '..', 'tm-help-social.js'), 'utf8');
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-onboarding-help');

// 映射目标 topic 必须真存在于 HelpSystem.topics(否则 openHelp 渲染抛错)
['gameplay', 'overview', 'apikey', 'shortcuts'].forEach(function (t) {
  ok(new RegExp('\\n    ' + t + ':\\s*\\{').test(src), 'topic「' + t + '」存在于 HelpSystem.topics');
});

// A1·4 死按钮接到现有帮助 + 暴露 + F1
ok(/function openHelpNewbie\(\)\s*\{\s*openHelp\('gameplay'\)/.test(src), 'A1 openHelpNewbie→gameplay');
ok(/function openHelpPresets\(\)\s*\{\s*openHelp\('overview'\)/.test(src), 'A1 openHelpPresets→overview');
ok(/function openHelpAI\(\)\s*\{\s*openHelp\('apikey'\)/.test(src), 'A1 openHelpAI→apikey');
ok(/function openHelpHotkey\(\)\s*\{\s*openHelp\('shortcuts'\)/.test(src), 'A1 openHelpHotkey→shortcuts');
ok(/window\.openHelpNewbie\s*=\s*openHelpNewbie/.test(src), 'A1 openHelp* 暴露 window');
ok(/e\.key\s*!==\s*'F1'/.test(src) && /if \(typeof openHelp === 'function'\) openHelp\(\)/.test(src), 'A1 F1 keydown→openHelp()');

// A2·无 key 提示
ok(/function _tmCheckApiKeyOnStart/.test(src) && /_P && _P\.ai && _P\.ai\.key/.test(src), 'A2 查 P.ai.key(已配则不扰)');
ok(/tm-nokey-banner/.test(src) && /openHelp\('apikey'\)/.test(src), 'A2 弹 banner + 「如何配置」→apikey');

// A3·首回合指引
ok(/function _tmFirstTurnGuide/.test(src) && /\(_GM\.turn \|\| 1\) !== 1/.test(src), 'A3 仅开局首回合(turn===1)');
ok(/tm_seen_firstturn_guide/.test(src) && /localStorage\.setItem\(KEY/.test(src), 'A3 localStorage 一次性门控');
ok(/tm-firstturn-guide/.test(src) && /openHelp\('gameplay'\)/.test(src), 'A3 「完整玩法」→gameplay');

// A2+A3 都挂开局钩子
const hooks = (src.match(/GameHooks\.on\('enterGame:after'/g) || []).length;
ok(hooks >= 2, 'A2+A3 挂 enterGame:after (×' + hooks + ')');

console.log('\nsmoke-onboarding-help ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
