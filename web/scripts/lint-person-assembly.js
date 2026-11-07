#!/usr/bin/env node
// scripts/lint-person-assembly.js — 人物实体棘轮守卫（人1·2026-11-07）
//
// 背景：同一个人被拆成好几个——问对、常朝、廷议、奏疏、书信、NPC 自主、势力调度、主推演专精，
//   各拼各的「人格」（docs/guanben-roleplay-20260930/tuiyan.md 7.2 节）。新规矩：一个人只有一份「他是谁」，
//   凡是 AI 要以这个人说话、行事，都走 TM.Person（tm-person.js）。
// 规则：运行时代码里逐文件数「直接读人格字段」的行——.personality / .traitIds / .aiPersonaText /
//   .speechStyle / .diction / getCharacterPersonalityBrief(——基线只减不增。tm-person.js 自身豁免。
//   新拼人格请改走 TM.Person.brief / core / frag；确属非提示词用途（界面显示、编辑器、数值机制）的，
//   在该行加 person-ok 注释。各机制改走 TM.Person 后（人2）跑 --update 收紧基线。
// 用法：
//   node scripts/lint-person-assembly.js           # 对比基线
//   node scripts/lint-person-assembly.js --update  # 重写基线
'use strict';
const path = require('path');
const fs = require('fs');
const lib = require('./lib-arch-guard.js');

const WEB = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(__dirname, 'arch-baselines', 'person-assembly.json');
const UPDATE = process.argv.includes('--update');
const EXEMPT = new Set(['tm-person.js']);
const FIELD_RE = /\.(personality|traitIds|aiPersonaText|speechStyle|diction)\b|getCharacterPersonalityBrief\s*\(/;

function countFile(abs) {
  let n = 0;
  fs.readFileSync(abs, 'utf8').split(/\r?\n/).forEach((raw) => {
    if (lib.isCommentLine(raw)) return;
    if (raw.indexOf('person-ok') !== -1) return;
    if (FIELD_RE.test(lib.stripLineComment(raw))) n++;
  });
  return n;
}

const current = {};
lib.runtimeCodeFiles(path.join(WEB, 'index.html')).forEach((file) => {
  if (EXEMPT.has(file.src)) return;
  const n = countFile(file.abs);
  if (n) current[file.src] = n;
});
const total = Object.keys(current).reduce((s, k) => s + current[k], 0);
console.log('[lint-person-assembly] 运行时代码直接读人格字段 ' + total + ' 行 / ' + Object.keys(current).length + ' 个文件（tm-person.js 豁免）');

if (UPDATE) {
  lib.saveJSON(BASELINE_FILE, { generatedAt: new Date().toISOString(), note: '各文件直接读人格字段的行数；只减不增。新拼人格改走 TM.Person（tm-person.js）。', files: current });
  console.log('[lint-person-assembly] 基线已重写 → ' + lib.rel(BASELINE_FILE));
  process.exit(0);
}

const baseline = lib.loadJSON(BASELINE_FILE, null);
if (!baseline || !baseline.files) {
  console.error('[lint-person-assembly] FAIL — 没有基线文件 ' + lib.rel(BASELINE_FILE) + '（首次请跑 --update）');
  process.exit(1);
}
const violations = [], repaid = [];
Object.keys(current).forEach((src) => {
  const was = baseline.files[src] || 0;
  if (current[src] > was) violations.push(src + '：直接读人格字段 ' + was + ' → ' + current[src] + '（+' + (current[src] - was) + '）');
});
Object.keys(baseline.files).forEach((src) => { if ((current[src] || 0) < baseline.files[src]) repaid.push(src); });

if (violations.length) {
  console.error('[lint-person-assembly] FAIL — ' + violations.length + ' 处超基线（一个人只有一份「他是谁」）：');
  violations.forEach((v) => console.error('  ' + v));
  console.error('处置：① 改走 TM.Person.brief / core / frag（tm-person.js）② 确属非提示词用途（界面显示、编辑器、数值机制）→ 该行加 // person-ok 注释。');
  process.exit(1);
}
console.log('[lint-person-assembly] PASS' + (repaid.length ? '（' + repaid.length + ' 个文件还了账，可跑 --update 收紧基线）' : ''));
