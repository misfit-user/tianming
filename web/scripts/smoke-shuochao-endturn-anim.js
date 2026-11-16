#!/usr/bin/env node
// smoke-shuochao-endturn-anim.js
// 验证「开朔朝·退朝后推演未毕进过回合电影化动画(而非老 loading 弹窗)」:
//   机制=退朝补触发 core-start 拍'时移事去'激活电影化层·而旧'候有司推演……'不匹配任何拍点(故走老 origShow)。
// 手法:抽 tm-endturn-progress.js 真 BEATS+matchBeat 实跑 + tm-court-meter.js 源契约。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } }

const PROG = fs.readFileSync(path.join(ROOT, 'tm-endturn-progress.js'), 'utf8');
const COURT = fs.readFileSync(path.join(ROOT, 'tm-court-meter.js'), 'utf8');

// ── 抽真 BEATS + ALIAS_TO_STREAM + matchBeat ──
const beatsSeg = PROG.slice(PROG.indexOf('var BEATS = ['), PROG.indexOf('];', PROG.indexOf('var BEATS = [')) + 2);
const aliasSeg = PROG.slice(PROG.indexOf("var ALIAS_TO_STREAM ="), PROG.indexOf(';', PROG.indexOf("var ALIAS_TO_STREAM =")) + 1);
const mbStart = PROG.indexOf('function matchBeat(msg)');
let i = PROG.indexOf('{', mbStart), depth = 0, mbEnd = -1;
for (; i < PROG.length; i++) { const c = PROG[i]; if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { mbEnd = i + 1; break; } } }
const mbSeg = PROG.slice(mbStart, mbEnd);

const ctx = {};
vm.createContext(ctx);
// matchBeat 内部引用模块级 activeBeats(progress.js:84·agent 模式 beat 切换后引入)·抽取片段未含其声明→补上(非 agent 路径 activeBeats=BEATS)
vm.runInContext(beatsSeg + '\n' + aliasSeg + '\nvar activeBeats = BEATS;\n' + mbSeg + '\nthis.matchBeat = matchBeat; this.BEATS = BEATS;', ctx, { filename: 'beats.js' });
ok(typeof ctx.matchBeat === 'function' && Array.isArray(ctx.BEATS), '抽到真 BEATS + matchBeat');

const HORIZ = '…'; // 横排省略号(……)
// ── ① 新标签触发 core-start(=电影化层开闸) ──
var mCore = ctx.matchBeat('时移事去');
ok(mCore && mCore.beat.id === 'core-start' && mCore.index === 0, '① 修后标签「时移事去」→ core-start 拍(激活电影化动画)·实=' + (mCore && mCore.beat.id));

// ── ② ★旧标签「候有司推演……」不匹配任何拍点(bug 根源:电影化层不激活→落老 origShow 弹窗) ──
ok(ctx.matchBeat('候有司推演' + HORIZ + HORIZ) === null, '② ★旧「候有司推演……」不匹配任何拍点(=旧 bug:不进电影化动画·显老弹窗)');

// ── ③ 退朝后剩余 pipeline 拍点能驱动电影化层(只进不退到落幕) ──
ok(ctx.matchBeat('回合阶段 6/6').beat.id === 'step-6', '③ pipeline「回合阶段 6/6」→ step-6 拍(前缀匹配)');
ok(ctx.matchBeat('生成史记弹窗').beat.id === 'render-shiji', '③ pipeline「生成史记弹窗」→ render-shiji 末拍(落幕)');
ok(ctx.matchBeat('回合阶段 3/6').beat.id === 'step-3', '③ 「回合阶段 3/6」→ step-3');

// ── ④ tm-court-meter.js 源契约 ──
// '时移事去' = 时移事去
ok(COURT.indexOf("showLoading('\\u5019\\u6709\\u53F8\\u63A8\\u6F14\\u2026\\u2026', 50)") < 0, '④ 不再用老「候有司推演……」plain loading');
// 仍在 AI-未就绪分支(courtDone=true 之后·return 之前)
const branchIdx = COURT.indexOf('GM._pendingShijiModal.courtDone = true;');
const newCallIdx = COURT.indexOf("showLoading('\\u65F6\\u79FB\\u4E8B\\u53BB', 50)");
ok(branchIdx >= 0 && newCallIdx > branchIdx, '④ 新调用位于「置 courtDone=true」之后(朝会已退·不遮挡)');

console.log('[smoke-shuochao-endturn-anim] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);
