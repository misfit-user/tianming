// smoke-endturn-baseline-helpers.js — shared helpers for Phase 7 baseline smokes
//
// 用·所有 Phase 7 P7-β baseline smoke 共用·
//   - 读 tm-endturn-ai-infer.js 文件内容
//   - 提供 grep / pattern 检查 helper
// 不 export Node module·直接 require()·

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENDTURN_FILE = path.join(ROOT, 'tm-endturn-ai-infer.js');

// P7-γ+·拆分后·prompt / ai / apply / followup / record 各自一文件
// readSource() 默认 read all endturn-ai-* concat·smokes 不需关心文件位置
const ENDTURN_FAMILY = [
  'tm-endturn-ai-infer.js',     // 主入口·原始/拆分后均存
  'tm-endturn-prompt.js',       // P7-γ
  'tm-endturn-ai-sc1-budget.js', // Shared exact schema providers precede their consumers.
  'tm-endturn-ai.js',           // P7-δ
  'tm-endturn-apply.js',        // P7-ε
  'tm-endturn-apply-stages.js', // apply解构S2·AP-1/AP-6 stage 片(紧随 apply.js·writeBack 主体源码级消费须含之)
  'tm-endturn-followup-helpers.js', // 第十九拆·alias 范式·顶层纯 helper 族(载于 followup 之前)
  'tm-endturn-followup.js',     // P7-ζ
  'tm-endturn-record.js'        // P7-η
];

let _src = null;
function readSource() {
  if (_src === null) {
    const parts = [];
    ENDTURN_FAMILY.forEach(function(f) {
      const p = path.join(ROOT, f);
      if (fs.existsSync(p)) {
        parts.push('// ===== ' + f + ' =====');
        parts.push(fs.readFileSync(p, 'utf8'));
      }
    });
    _src = parts.join('\n');
  }
  return _src;
}

/** Read only ai-infer (for smokes that need section line locations) */
let _aiInferSrc = null;
function readAiInferSource() {
  if (_aiInferSrc === null) _aiInferSrc = fs.readFileSync(ENDTURN_FILE, 'utf8');
  return _aiInferSrc;
}

function getLines() {
  return readSource().split('\n');
}

/** 找 line·1-based·返 line text or null */
function getLine(n) {
  const lines = getLines();
  return n >= 1 && n <= lines.length ? lines[n - 1] : null;
}

/** 找 pattern 在指定行·返 line numbers (1-based) */
function findLines(regex) {
  const lines = getLines();
  const matches = [];
  lines.forEach(function(l, idx) {
    if (regex.test(l)) matches.push(idx + 1);
  });
  return matches;
}

/** count occurrences·src-wide */
function countMatches(regex) {
  const m = readSource().match(regex);
  return m ? m.length : 0;
}

/** assert helper·throw on fail·incre passed counter from caller */
function makeAssert(passedRef) {
  return function assert(cond, msg) {
    if (!cond) throw new Error('[assert] ' + msg);
    passedRef.value++;
  };
}

module.exports = {
  ROOT,
  ENDTURN_FILE,
  ENDTURN_FAMILY,
  readSource,
  readAiInferSource,
  getLines,
  getLine,
  findLines,
  countMatches,
  makeAssert
};
