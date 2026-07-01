/*
 * smoke-offtree-appoint-deterministic.js — 官制树任命确定性落地（根治反复掉职 bug）
 *   病理:官制树任命(_offPickerConfirm)即时写好 char.officialTitle+holder，但被塞进 AI 识别流
 *   (edictTracker pending + edict-pol)，过回合若 AI 漏识别/覆盖 char.officialTitle →
 *   _offSyncHoldersFromChars 从错误 char 重建 holder → 官职回滚(掉职)。
 *   修复(斩断依赖):①_offPickerConfirm 打 _offTreeAppoint 标记 ②tm-endturn-apply L3585 sync 前
 *   权威重申 char.officialTitle(压过 AI) ③tm-endturn-ai L2568 不把官制树任命交 AI 识别。
 *   测法:抽 tm-endturn-apply 真实重申片段 eval，模拟 AI 覆盖后验证官职恢复 + 源契约。
 * node scripts/smoke-offtree-appoint-deterministic.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

const applySrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
const panelSrc = fs.readFileSync(path.join(ROOT, 'tm-office-panel.js'), 'utf8');
const aiSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-ai.js'), 'utf8');

// ── 源契约:三处改动 ──
ok(/_offTreeAppoint:\s*true/.test(panelSrc), '① _offPickerConfirm edictTracker 打 _offTreeAppoint 标记');
ok(/_appointmentAction:\s*\{[^}]*mode:\s*mode/.test(panelSrc), '① _appointmentAction 带 mode(辞旧/兼任)');
ok(/!e\._offTreeAppoint/.test(aiSrc), '③ tm-endturn-ai L2568 pending filter 排除官制树任命(不交 AI)');
ok(/官制树确定性任命/.test(applySrc) && /_offApplied/.test(applySrc), '② tm-endturn-apply 含确定性重申块');
// 重申必须在 sync 之前(顺序:重申 → _offSyncHoldersFromChars)
ok(applySrc.indexOf('官制树确定性任命') < applySrc.indexOf('office_changes 处理后从人物 officialTitle 重建'), '② 重申块在 _offSyncHoldersFromChars 之前(先重申再重建 holder)');

// ── 抽真实重申片段 eval ──
const START = '// ── 官制树确定性任命·过回合权威落地';
const END = '// 单一真相源:office_changes 处理后从人物';
const si = applySrc.indexOf(START);
const ei = applySrc.indexOf(END, si);
ok(si >= 0 && ei > si, '可抽取重申片段');
const body = applySrc.slice(si, ei);
let reapply;
try { reapply = new Function('GM', body); } catch (e) { ok(false, '片段可编译: ' + e.message); }

if (reapply) {
  // Case A: 官制树任命 + 模拟 AI 覆盖 char.officialTitle → 重申恢复
  const gmA = {
    turn: 5,
    chars: [{ name: '张三', officialTitle: '' }, { name: '李四', officialTitle: '吏部尚书' }],  // 张三被 AI 漏识别清空·李四旧任
    _edictTracker: [{ _offTreeAppoint: true, _appointmentAction: { character: '张三', position: '吏部尚书', dept: '吏部', oldHolder: '李四', mode: 'resign' } }]
  };
  reapply(gmA);
  const zhang = gmA.chars[0], li = gmA.chars[1];
  ok(zhang.officialTitle === '吏部尚书', 'Case A:AI 覆盖后重申恢复新任官职(张三→吏部尚书)');
  ok(li.officialTitle === '', 'Case A:辞旧就新·旧任离座(李四→空)');
  ok(gmA._edictTracker[0]._offApplied === true && gmA._edictTracker[0].status === 'executed', 'Case A:标记已落地+status=executed');

  // Case B: 幂等·再跑不重复处理
  li.officialTitle = '吏部尚书';   // 人为再放个冲突·若重复处理会再清李四
  reapply(gmA);
  ok(li.officialTitle === '吏部尚书', 'Case B:_offApplied 后幂等·不再重复处理(李四未被二次清)');

  // Case C: 手打诏令(无 _offTreeAppoint)不被重申·仍走 AI 识别
  const gmC = { turn: 5, chars: [{ name: '王五', officialTitle: '' }], _edictTracker: [{ _appointmentAction: { character: '王五', position: '户部尚书' } }] };
  reapply(gmC);
  ok(gmC.chars[0].officialTitle === '', 'Case C:手打诏令(无标记)不被确定性重申(走 AI 识别·不变)');

  // Case D: 兼任模式·加兼衔不动主职
  const gmD = { turn: 5, chars: [{ name: '赵六', officialTitle: '礼部尚书', concurrentTitles: [] }], _edictTracker: [{ _offTreeAppoint: true, _appointmentAction: { character: '赵六', position: '翰林学士', mode: 'concurrent' } }] };
  reapply(gmD);
  ok(gmD.chars[0].concurrentTitles.indexOf('翰林学士') >= 0 && gmD.chars[0].officialTitle === '礼部尚书', 'Case D:兼任·加兼衔+主职不变');

  // Case E: 无 _edictTracker/空 → 不炸
  let safe = true; try { reapply({ turn: 1, chars: [] }); reapply({ turn: 1 }); } catch (e) { safe = false; }
  ok(safe, 'Case E:无 edictTracker/chars 不抛错');
}

// 语法
const vm = require('vm');
['tm-endturn-apply.js', 'tm-office-panel.js', 'tm-endturn-ai.js'].forEach(function (f) {
  let s = true; try { new vm.Script(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { s = false; }
  ok(s, f + ' 语法有效');
});

console.log('\nsmoke-offtree-appoint-deterministic: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
