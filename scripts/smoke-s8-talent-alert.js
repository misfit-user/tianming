/*
 * smoke-s8-talent-alert.js — 官制面板·人才流失预警（tm-office-runtime.js _renderOfficeSummary 预警条·S8）
 *   S7 让 AI 看见怀才不遇能臣；本轮让玩家看见——官制概览预警条加「人才流失预警」，
 *   列出才高位卑萌去意的能臣(_seeksRemoval·S1d 才不配位反哺产出)，玩家可针对性拔擢留贤。
 *   测法：从 tm-office-runtime.js 抽取真实的预警片段(非模拟)，eval 于构造 GM，断言按数据产生预警 +
 *   数据恒空时不预警(officeSatisfactionFeedbackEnabled 关→无 _seeksRemoval→无预警→零回归)。
 * node scripts/smoke-s8-talent-alert.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

const src = fs.readFileSync(path.join(ROOT, 'tm-office-runtime.js'), 'utf8');

// 源契约
ok(/人才流失预警/.test(src), 'tm-office-runtime.js 含「人才流失预警」');
ok(/_disaffElite[\s\S]{0,120}_seeksRemoval/.test(src), '读 _seeksRemoval（才不配位反哺产出）');
ok(/alerts\.push\(\{[^}]*人才流失预警/.test(src), '走既有 alerts.push 预警条范式');

// 抽取真实片段（// 人才流失预警 → // 职位空缺 前）
const START = '// 人才流失预警';
const END = '// 职位空缺';
const si = src.indexOf(START);
const ei = src.indexOf(END, si);
ok(si >= 0 && ei > si, '可抽取预警片段（人才流失预警→职位空缺 之间）');
const body = src.slice(si, ei);

const escHtml = (s) => String(s == null ? '' : s);
let fn;
try { fn = new Function('GM', 'alerts', 'escHtml', body + '\nreturn alerts;'); } catch (e) { ok(false, '片段可编译: ' + e.message); }

if (fn) {
  // Case A: 有怀才不遇能臣
  const outA = fn({ chars: [{ name: '海瑞', officialTitle: '知县', alive: true, _seeksRemoval: true }, { name: '路人', officialTitle: '主事', alive: true }] }, [], escHtml);
  ok(outA.length === 1 && outA[0].type === 'warn', 'Case A：有 _seeksRemoval → push 1 条 warn 预警');
  ok(/人才流失预警/.test(outA[0].lbl) && /海瑞/.test(outA[0].txt) && /知县/.test(outA[0].txt) && !/路人/.test(outA[0].txt), 'Case A：只列怀才不遇者(含名+官职·排除无标记者)');
  ok(/<strong>1<\/strong>/.test(outA[0].txt), 'Case A：注入人数');

  // Case B: 无怀才不遇 → 零预警（flag 关→数据恒空）
  const outB = fn({ chars: [{ name: '普通官', officialTitle: '主事', alive: true }] }, [], escHtml);
  ok(outB.length === 0, 'Case B：无 _seeksRemoval → 零预警(天然门控·零回归)');

  // Case C: >5 人 → 截断5 + 「等」+ 总数
  const many = []; for (let i = 0; i < 7; i++) many.push({ name: '能臣' + i, officialTitle: '主事', alive: true, _seeksRemoval: true });
  const outC = fn({ chars: many }, [], escHtml);
  ok(outC.length === 1 && /等/.test(outC[0].txt) && /<strong>7<\/strong>/.test(outC[0].txt), 'Case C：>5 人截断显示+「等」+总数7');

  // Case D: 死者排除
  const outD = fn({ chars: [{ name: '亡者', officialTitle: '主事', alive: false, _seeksRemoval: true }] }, [], escHtml);
  ok(outD.length === 0, 'Case D：已故能臣不预警(alive===false 排除)');

  // 不污染既有 alerts（append 语义）
  const seed = [{ type: 'danger', ic: '警', lbl: '权臣预警：', txt: 'x' }];
  const outE = fn({ chars: [{ name: '海瑞', officialTitle: '知县', alive: true, _seeksRemoval: true }] }, seed, escHtml);
  ok(outE.length === 2 && outE[0].lbl === '权臣预警：', 'Case E：append 于既有预警(权臣预警仍在首位)');
}

// 语法
const vm = require('vm');
let synOk = true;
try { new vm.Script(src); } catch (e) { synOk = false; }
ok(synOk, 'tm-office-runtime.js 语法有效');

console.log('\nsmoke-s8-talent-alert: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
