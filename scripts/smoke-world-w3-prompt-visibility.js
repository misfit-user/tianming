#!/usr/bin/env node
/*
 * smoke-world-w3-prompt-visibility.js — 世界反应总线·W3 补盲区回归
 *   ①阴谋运行态数值进主推演（ConspiracyEngine.aiContextBlock 附 密谋/败露/同谋数/酝酿回合）
 *   ②腐败九源 breakdown 进主推演（tm-endturn-ai.js tp1·吏治·九源·因何而腐）
 * node scripts/smoke-world-w3-prompt-visibility.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

// ════════ ① 阴谋运行态数值（真加载 tm-conspiracy.js·调 aiContextBlock）════════
const ctx = { console, Math, JSON, RegExp, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite, GM: null, P: {} };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-conspiracy.js'), 'utf8'), ctx, { filename: 'tm-conspiracy.js' });
const CE = ctx.ConspiracyEngine;
ok(CE && typeof CE.aiContextBlock === 'function', 'tm-conspiracy.js 加载·暴露 aiContextBlock');

ctx.GM = {
  turn: 12,
  _activePlots: [
    { id: 'p1', ringleader: '魏国公', target: '崇祯', kind: 'coup', stage: 'brewing', momentum: 68, exposure: 41, secrecy: 60, conspirators: ['甲', '乙', '丙', '丁'], startTurn: 7, _knownToPlayer: false },
    { id: 'p2', ringleader: '温体仁', target: '钱谦益', kind: 'plot', stage: 'ripe', momentum: 112, exposure: 73, secrecy: 30, conspirators: ['周延儒'], startTurn: 9, _knownToPlayer: true }
  ]
};
const block = CE.aiContextBlock(ctx.GM);

// 图例（满100将发/满100就擒）进了 → 让 AI 据真值把握火候
ok(/密谋值满100将发/.test(block) && /败露满100则事泄就擒/.test(block), '头部图例：密谋满100将发·败露满100就擒');
// brew plot 附原始数值（此前只给「酝酿已深」桶·数值不可见）
ok(/魏国公[\s\S]*?密谋68[\s\S]*?败露41/.test(block), 'brew·附 密谋68·败露41 原始运行态数值');
ok(/魏国公[\s\S]*?同谋4人（甲、乙、丙等）/.test(block), 'brew·同谋人数4+前三名+等');
ok(/魏国公[\s\S]*?已酿5回合/.test(block), 'brew·已酝酿回合数（turn12-startTurn7=5）');
ok(/魏国公[\s\S]*?渐成气候/.test(block) && /魏国公[\s\S]*?尚隐秘/.test(block), 'brew·保留定性桶（momentum68→渐成气候）+尚隐秘');
// ripe plot 仍走 ★将发 + 党羽 + record 提示
ok(/★将发：温体仁[\s\S]*?密谋112·败露73/.test(block), 'ripe·★将发 附数值（密谋112·败露73）');
ok(/温体仁[\s\S]*?党羽1人/.test(block) && /record_conspiracy_events/.test(block), 'ripe·党羽数+record 提示');
// 空态不污染
ctx.GM._activePlots = [];
ok(CE.aiContextBlock(ctx.GM) === '', '无活跃阴谋 → 返空（不污染 prompt）');

// ════════ ② 腐败九源 breakdown（源契约 + 逻辑仿真）════════
const aiSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-ai.js'), 'utf8');
// 源契约：块存在、标题、紧邻 6 部门之后、九个中文标签齐全
ok(/吏治·九源（因何而腐）/.test(aiSrc), '源含「吏治·九源（因何而腐）」prompt 块');
ok(/lowSalary:'俸薄'[\s\S]*?lumpSumSpending:'巨支'/.test(aiSrc), '源含九源中文标签映射（俸薄…巨支）');
const nineLabels = ['俸薄', '监弛', '急征', '鬻官', '荐幸', '宠信', '冗员', '制弊', '巨支'];
ok(nineLabels.every(function (l) { return aiSrc.indexOf("'" + l + "'") >= 0; }), '九源标签全（俸薄/监弛/急征/鬻官/荐幸/宠信/冗员/制弊/巨支）');
ok(aiSrc.indexOf('吏治·九源') > aiSrc.indexOf('吏治·6部门'), '九源块在 6 部门块之后（腐败数据归一组）');

// 逻辑仿真：复刻 prompt 块的转换（降序取前6·中文标签·符号·四舍一位），验产出
const _corrSrcCN = { lowSalary:'俸薄', laxSupervision:'监弛', emergencyLevy:'急征', officeSelling:'鬻官', nepotism:'荐幸', innerCircle:'宠信', redundancy:'冗员', institutional:'制弊', lumpSumSpending:'巨支' };
function buildCorrSrc(_cs) {
  return Object.keys(_cs).filter(function(k){ return Math.abs(_cs[k]) > 0.5; })
    .sort(function(a,b){ return Math.abs(_cs[b]) - Math.abs(_cs[a]); })
    .slice(0,6).map(function(k){ var v=_cs[k]; return (_corrSrcCN[k]||k) + (v>=0?'+':'') + (Math.round(v*10)/10); }).join(' ');
}
const out = buildCorrSrc({ lowSalary: 8.2, laxSupervision: 0.3, emergencyLevy: 15.7, officeSelling: 12.1, nepotism: 4.4, innerCircle: 9.9, redundancy: 2.2, institutional: 6.0, lumpSumSpending: 0 });
ok(/^急征\+15\.7/.test(out), '九源按贡献降序：急征(15.7)居首');
ok(out.indexOf('鬻官+12.1') >= 0 && out.indexOf('宠信+9.9') >= 0, '含 鬻官/宠信 等主源');
ok(out.indexOf('监弛') < 0 && out.indexOf('巨支') < 0, '微弱源(<0.5)与零值被滤除');
ok(out.split(' ').length <= 6, '至多 6 源（不过载 prompt）');
ok(buildCorrSrc({}) === '', '无源 → 空串（不注入空块）');

console.log('\nsmoke-world-w3-prompt-visibility: PASS ' + pass + '/' + (pass + fail));
if (fail > 0) process.exit(1);
