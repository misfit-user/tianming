#!/usr/bin/env node
/* eslint-env node */
// smoke-map-view-scores.js — 四视图计分公式断言（2026-06-12）
// 不起浏览器：从 phase8-formal-map.js 源码抽出纯函数段（parseLevelWord/ratio01/gradeOf/GRADE_BANDS），
// vm 实算边界值；公式主体(moodViewScore 等)依赖 regionBundle 闭包，由 smoke-phase8-map-live-panels
// 的 live 断言覆盖——此处验「档位表/解析器/警示判定」三件纯逻辑 + 源码契约。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'phase8-formal-map.js'), 'utf8');

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  PASS', msg); }
  else { failed += 1; console.error('  FAIL', msg); }
}

// ── 源码契约：四公式与渲染管线接线齐全（防回退成死函数） ──
ok(/function moodViewScore\(/.test(SRC), '源码含 moodViewScore');
ok(/function armyViewScore\(/.test(SRC), '源码含 armyViewScore');
ok(/function officeViewScore\(/.test(SRC), '源码含 officeViewScore');
ok(/function taxViewScore\(/.test(SRC), '源码含 taxViewScore');
ok(/function yizhengViewScore\(/.test(SRC), '源码含 yizhengViewScore（R7-a 役政视图）');
ok(/mode === 'yizheng'/.test(SRC), '役政 mode 接入 regionColor/modeScore dispatcher');
ok(/modeScore\(r, _sentinelMode\)/.test(SRC), '哨牌值进 dirty 签名（防档内变分不重渲）');
ok(/tmf-sentinel-layer/.test(SRC), '哨牌层挂进 renderFormalMap');
ok(/mapTipHtml\(r\)/.test(SRC), '签注接 hover tick');
ok(/tip-verdict/.test(SRC), '签注含判语');
ok(/tmf-grade-bar/.test(SRC), '图例五档条接线');
ok(/function bkYingzao\(/.test(SRC) && /data-bk-build/.test(SRC), '营造志+兴造按钮接线');
ok(/_dfBuildModal/.test(SRC), '兴造按钮复活 _dfBuildModal（孤儿入葬→还阳）');
ok(!/function heatColor\(/.test(SRC), '旧 heatColor 三档插值已删（不留死函数）');
ok(!/function ppRegionGridV2\(/.test(SRC) && !/function factionTabDetail\(/.test(SRC), '旧 codex 渲染链已删');

// ── 抽出纯函数段 vm 实算 ──
ok(/getTerritoryBuildingsCompat/.test(SRC) && /pushBuildCard/.test(SRC), 'building panel reads compat division.buildings after approval');
ok(/tm-yingzao-submitted', function\(e\)/.test(SRC) && /detail\.divName/.test(SRC), 'building submit event can refresh panel by division name');

function extract(name) {
  const m = SRC.match(new RegExp('  (function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n  \\})'));
  if (m) return m[1];
  const v = SRC.match(new RegExp('  (var ' + name + ' = \\{[\\s\\S]*?\\n  \\};)'));
  return v ? v[1] : null;
}
const parts = ['parseLevelWord', 'ratio01', 'GRADE_BANDS', 'gradeOf', 'gradeIsWarn'].map(extract);
ok(parts.every(Boolean), '纯函数段全部可抽出（parseLevelWord/ratio01/GRADE_BANDS/gradeOf/gradeIsWarn）');

const ctx = vm.createContext({});
vm.runInContext(parts.join('\n'), ctx);
const run = (expr) => vm.runInContext(expr, ctx);

// parseLevelWord：文本档位词与数值归一
ok(run("parseLevelWord('极', 0)") === 90, "parseLevelWord('极') = 90");
ok(run("parseLevelWord('高', 0)") === 72, "parseLevelWord('高') = 72");
ok(run("parseLevelWord('中', 0)") === 45, "parseLevelWord('中') = 45");
ok(run("parseLevelWord('低', 0)") === 20, "parseLevelWord('低') = 20");
ok(run("parseLevelWord(0.8, 0)") === 80, 'parseLevelWord(0.8 比率) = 80');
ok(run("parseLevelWord(65, 0)") === 65, 'parseLevelWord(65) = 65');
ok(run("parseLevelWord(250, 0)") === 100, 'parseLevelWord(250) 封顶 100（旧版兵数当分数之病不再）');
ok(run("parseLevelWord('', 33)") === 33, '空值回退 fallback');

// ratio01：0-1 与 0-100 双口径归一
ok(run('ratio01(0.64)') === 0.64, 'ratio01(0.64) = 0.64');
ok(run('ratio01(64)') === 0.64, 'ratio01(64) = 0.64（百分制归一）');
ok(run("ratio01('abc')") === null, 'ratio01 非数 = null');

// gradeOf：五档色板与档字
ok(run("gradeOf('mood', 28).mark") === '危', 'mood 28 → 危');
ok(run("gradeOf('mood', 46).mark") === '忧', 'mood 46 → 忧');
ok(run("gradeOf('mood', 82).mark") === '乐', 'mood 82 → 乐');
ok(run("gradeOf('tax', 64).mark") === '薄', 'tax 64 → 薄');
ok(run("gradeOf('tax', null).mark") === '免', 'tax null → 免（军镇免科）');
ok(run("gradeOf('army', 95).mark") === '急', 'army 95 → 急');
ok(run("gradeOf('office', 74).mark") === '浊', 'office 74 → 浊');
ok(run("gradeOf('office', 86).color") === '#7a2018', 'office 86 → 蠹色');
ok(run("gradeOf('yizheng', 12).mark") === '轻', 'yizheng 12 → 轻（轻徭）');
ok(run("gradeOf('yizheng', 30).mark") === '中', 'yizheng 30 → 中');
ok(run("gradeOf('yizheng', 45).mark") === '重', 'yizheng 45 → 重');
ok(run("gradeOf('yizheng', 70).mark") === '苛', 'yizheng 70 → 苛（苛役）');

// gradeIsWarn：反向(民情/财赋)低档警·正向(军务/官守)高档警
ok(run("gradeIsWarn('mood', gradeOf('mood', 46))") === true, 'mood 46 忧档 → 警');
ok(run("gradeIsWarn('mood', gradeOf('mood', 70))") === false, 'mood 70 安档 → 不警');
ok(run("gradeIsWarn('army', gradeOf('army', 72))") === true, 'army 72 警档 → 警');
ok(run("gradeIsWarn('army', gradeOf('army', 30))") === false, 'army 30 靖档 → 不警');
ok(run("gradeIsWarn('tax', gradeOf('tax', null))") === false, 'tax 免科 → 不警');
ok(run("gradeIsWarn('yizheng', gradeOf('yizheng', 45))") === true, 'yizheng 45 重档 → 警（正向·高档警）');
ok(run("gradeIsWarn('yizheng', gradeOf('yizheng', 12))") === false, 'yizheng 12 轻档 → 不警');

console.log('\n[smoke-map-view-scores] ' + (failed === 0 ? 'PASS' : 'FAIL') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
