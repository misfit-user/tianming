/*
 * smoke-s7-office-ai-feed.js — 官制新机制 AI 喂料补盲（tm-endturn-prompt.js·S7）
 *   考课/致仕/权限门早已注入 AI prompt；本轮补三处盲区：权臣坐大 / 京察黜陟 / 怀才不遇能臣。
 *   测法：从 tm-endturn-prompt.js 抽取真实的 S7 注入代码片段(非模拟)，包成函数在构造 GM 上 eval，
 *   断言注入文本按数据产生 + 数据恒空时零注入(flag 关→数据恒空→天然门控→零回归)。
 * node scripts/smoke-s7-office-ai-feed.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

const src = fs.readFileSync(path.join(ROOT, 'tm-endturn-prompt.js'), 'utf8');

// ── 抽取真实 S7 注入片段（从 S7 注释块 → N4 前）──
const START = '// ── S7·官制新机制 AI 喂料补盲';
const END = '// N4: 主角精力注入';
const si = src.indexOf(START);
const ei = src.indexOf(END, si);
ok(si >= 0 && ei > si, 'tm-endturn-prompt.js 含 S7 注入块（S7→N4 之间）');
const body = src.slice(si, ei);
// 源契约：三段都在，且读正确字段
ok(/GM\.huangquan\.powerMinister/.test(body) && /权臣坐大/.test(body), 'S7-1 权臣坐大：读 GM.huangquan.powerMinister');
ok(/GM\._jingchaResult/.test(body) && /京察大计/.test(body), 'S7-2 京察：读 GM._jingchaResult');
ok(/_seeksRemoval/.test(body) && /怀才不遇/.test(body), 'S7-3 怀才不遇：读 _seeksRemoval');
ok(/controlLevel|interceptions|counterEdicts/.test(body), 'S7-1 喂坐大程度/截留/假拟等状态');

// ── 抽片段 eval（真实注入代码·非模拟）──
let injectFn;
try { injectFn = new Function('GM', 'tp', body + '\nreturn tp;'); } catch (e) { ok(false, 'S7 片段可编译为函数: ' + e.message); }

if (injectFn) {
  // Case A: 权臣坐大
  const gmA = { turn: 100, huangquan: { index: 25, powerMinister: { name: '严嵩', controlLevel: 0.7, faction: ['赵文华', '鄢懋卿'], interceptions: 3, counterEdicts: 1 } }, chars: [{ name: '严嵩', officialTitle: '首辅', alive: true }] };
  const outA = injectFn(gmA, '');
  ok(/权臣坐大/.test(outA) && /严嵩/.test(outA) && /首辅/.test(outA), 'Case A：权臣→注入坐大警讯(含名+官职)');
  ok(/70%/.test(outA) && /截留奏疏3次/.test(outA) && /假拟诏命1次/.test(outA), 'Case A：注入坐大程度+截留+假拟次数');
  ok(/赵文华/.test(outA), 'Case A：注入党羽名单');

  // Case B: 京察黜陟（本届）
  const gmB = { turn: 36, _jingchaResult: { turn: 36, demoted: ['张三', '李四'], promoted: ['王五'] }, chars: [] };
  const outB = injectFn(gmB, '');
  ok(/京察大计/.test(outB) && /黜降庸劣：张三、李四/.test(outB) && /拔擢沉才：王五/.test(outB), 'Case B：京察→注入本届黜陟名单');
  // 陈旧京察（相隔>1回合）不注入
  const gmBold = { turn: 50, _jingchaResult: { turn: 36, demoted: ['张三'], promoted: [] }, chars: [] };
  ok(!/京察大计/.test(injectFn(gmBold, '')), 'Case B2：陈旧京察(隔>1回合)不注入(只报本届)');

  // Case C: 怀才不遇能臣
  const gmC = { turn: 20, chars: [{ name: '海瑞', officialTitle: '知县', alive: true, _seeksRemoval: true }, { name: '张居正', officialTitle: '编修', alive: true, _seeksRemoval: { reason: 'x' } }, { name: '路人', officialTitle: '主事', alive: true }] };
  const outC = injectFn(gmC, '');
  ok(/怀才不遇/.test(outC) && /海瑞/.test(outC) && /张居正/.test(outC) && !/路人/.test(outC), 'Case C：怀才不遇→只注入 _seeksRemoval 能臣(排除无标记者)');

  // Case D: 空数据(flag 关→数据恒空)→ 零注入(零回归)
  const outD = injectFn({ turn: 10, chars: [{ name: '普通官', officialTitle: '主事', alive: true }] }, '');
  ok(outD === '', 'Case D：无权臣/无京察/无怀才不遇 → 零注入(天然门控·零回归)');
  // 死去权臣（.name 缺失）不注入
  ok(injectFn({ turn: 10, huangquan: { powerMinister: null }, chars: [] }, '') === '', 'Case D2：powerMinister=null 不注入');
}

// 语法
const vm = require('vm');
let synOk = true;
try { new vm.Script(src); } catch (e) { synOk = false; }
ok(synOk, 'tm-endturn-prompt.js 语法有效');

console.log('\nsmoke-s7-office-ai-feed: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
