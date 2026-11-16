#!/usr/bin/env node
// smoke-npc-goal-in-heart.js
// 验证「深度名额 NPC 的驱动目标注入 heart」——补齐 npc 决策上下文「他想要什么」。
// 手法:从 tm-endturn-prompt.js 抽**真** goal 片段包成 goalFor()·喂构造 personalGoals 实跑·非重新实现。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } }

const PROMPT = fs.readFileSync(path.join(ROOT, 'tm-endturn-prompt.js'), 'utf8');

// ── 抽真片段实跑 ──
const a = PROMPT.indexOf('// 驱动目标——该 NPC 当前所求');
const b = PROMPT.indexOf('var sorted = _cleanMem.slice().sort', a);
ok(a >= 0 && b > a, '能定位 goal 片段');
const snippet = PROMPT.slice(a, b).trimEnd();

const ctx = { Array: Array, Math: Math };
vm.createContext(ctx);
vm.runInContext('function goalFor(c, _xE, xmlLines) {\n' + snippet + '\n}', ctx, { filename: 'goalFor.js' });
ok(typeof ctx.goalFor === 'function', 'goalFor(真片段) 装载');

const _xE = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

// ① 多目标取最高优先级·带 priority/progress/type
(function () {
  const c = { name: '甲', personalGoals: [
    { longTerm: '入阁拜相', shortTerm: '结交首辅', progress: 30, priority: 9, type: 'power', context: '正谋兵部尚书缺' },
    { longTerm: '著书立说', priority: 4, type: 'legacy' }
  ] };
  const out = [];
  ctx.goalFor(c, _xE, out);
  ok(out.length === 1, '① 输出 1 行 <goal>·实=' + out.length);
  const line = out[0] || '';
  ok(/<goal /.test(line) && /<\/goal>/.test(line), '① 含 <goal></goal>');
  ok(line.indexOf('入阁拜相') >= 0 && line.indexOf('著书立说') < 0, '① 取最高优先级目标(priority9 而非 4)');
  ok(/priority="9"/.test(line) && /progress="30"/.test(line) && /type="power"/.test(line), '① 带出 priority/progress/type');
  ok(line.indexOf('近期：结交首辅') >= 0, '① 含近期短期目标');
  ok(line.indexOf('正谋兵部尚书缺') >= 0, '① 含 context');
})();

// ② 只有 longTerm·无 shortTerm/context/type
(function () {
  const c = { name: '乙', personalGoals: [{ longTerm: '保全身家', priority: 5, progress: 0 }] };
  const out = [];
  ctx.goalFor(c, _xE, out);
  ok(out.length === 1 && out[0].indexOf('保全身家') >= 0 && out[0].indexOf('近期') < 0, '② 只 longTerm 也输出·无近期段');
  ok(out[0].indexOf('type=') < 0, '② 无 type 则不带 type 属性');
})();

// ③ 无目标→不注入
(function () {
  const out1 = [], out2 = [], out3 = [];
  ctx.goalFor({ name: '丙' }, _xE, out1);                       // 无 personalGoals
  ctx.goalFor({ name: '丁', personalGoals: [] }, _xE, out2);    // 空数组
  ctx.goalFor({ name: '戊', personalGoals: [{ priority: 5 }] }, _xE, out3); // 有目标但无 longTerm/shortTerm
  ok(out1.length === 0 && out2.length === 0 && out3.length === 0, '③ 无目标/空目标/空文本→不注入 <goal>');
})();

// ④ 长文本截断 + XML 转义
(function () {
  const c = { name: '己', personalGoals: [{ longTerm: '甲'.repeat(200) + '<&>', priority: 5, progress: 0 }] };
  const out = [];
  ctx.goalFor(c, _xE, out);
  const inner = (out[0].match(/<goal[^>]*>([\s\S]*)<\/goal>/) || [])[1] || '';
  ok(inner.length <= 100, '④ 目标文本截断到 100 字内·实=' + inner.length);
})();
(function () {
  const c = { name: '庚', personalGoals: [{ longTerm: '扳倒<政敌>&党', priority: 5, progress: 0 }] };
  const out = [];
  ctx.goalFor(c, _xE, out);
  ok(out[0].indexOf('&lt;') >= 0 && out[0].indexOf('&amp;') >= 0, '④ 目标文本 XML 转义');
})();

console.log('[smoke-npc-goal-in-heart] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);
