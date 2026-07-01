/*
 * smoke-s6-rank-override.js — S6 品级表跨朝代数据化（RANK_HIERARCHY 剧本可 override）
 *   getRankLevel/getRankInfo 改走 _activeRankHierarchy()：剧本可经 GM.rankHierarchy /
 *   P.engineConstants.rankHierarchy 提供本朝品阶(秦汉秩禄/宋寄禄官阶)。无 override → 明清默认(零回归)。
 *   ★测真代码：headless 加载 app → 调真 getRankLevel/getRankInfo/_activeRankHierarchy。
 * node scripts/smoke-s6-rank-override.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const HEADLESS = path.join(__dirname, 'headless-smoke.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

// ════════ 一·源契约 ════════
const src = fs.readFileSync(path.join(ROOT, 'tm-office-system.js'), 'utf8');
ok(/function _activeRankHierarchy\(\)/.test(src), '_activeRankHierarchy 已定义');
ok(/GM\.rankHierarchy/.test(src) && /P\.engineConstants && P\.engineConstants\.rankHierarchy/.test(src), 'override 源:GM.rankHierarchy / P.engineConstants.rankHierarchy');
ok(/return RANK_HIERARCHY;/.test(src), '无 override → 返默认 RANK_HIERARCHY(零回归)');
ok(/function getRankLevel[\s\S]{0,80}var H = _activeRankHierarchy\(\)/.test(src), 'getRankLevel 走 _activeRankHierarchy');
ok(/function getRankInfo[\s\S]{0,80}var H = _activeRankHierarchy\(\)/.test(src), 'getRankInfo 走 _activeRankHierarchy');

// ════════ 二·真代码 ════════
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();
const env = helpers.makeStubs();
const sandbox = vm.createContext(env.win);
const scripts = helpers.parseIndexHtmlScripts();
const cutoff = scripts.findIndex((s) => path.basename(s) === 'tm-test-harness.js');
(cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((s) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), sandbox, { filename: s, timeout: 20000 }); } catch (e) {} });

ok(vm.runInContext('typeof getRankLevel === "function" && typeof _activeRankHierarchy === "function"', sandbox), 'boot 后 getRankLevel/_activeRankHierarchy 可调');
function lvl(s) { return vm.runInContext('getRankLevel(' + JSON.stringify(s) + ')', sandbox); }
function info(s) { return vm.runInContext('var _r=getRankInfo(' + JSON.stringify(s) + ');_r?_r.level:null', sandbox); }
function setEnv(gm, p) { sandbox.GM = gm; sandbox.P = p || {}; }

// (a) 无 override → 明清默认(零回归)
setEnv({}, {});
ok(lvl('正三品') === 5 && lvl('从九品') === 18 && lvl('正一品') === 1, '真码:无 override → 明清九品十八级默认(正三品5/从九品18/正一品1)');
ok(lvl('不存在的品') === 99, '真码:未匹配 → 99');
ok(vm.runInContext('_activeRankHierarchy() === RANK_HIERARCHY', sandbox), '真码:无 override → _activeRankHierarchy 返默认表本体');

// (b) GM.rankHierarchy override(秦汉秩禄式) → 用本朝品阶
setEnv({ rankHierarchy: [{ label: '万石', level: 1 }, { label: '二千石', level: 3 }, { label: '比二千石', level: 4 }, { label: '六百石', level: 9 }] }, {});
ok(lvl('二千石') === 3 && lvl('六百石') === 9, '真码:GM.rankHierarchy override → 秩禄品阶(二千石3/六百石9)');
ok(info('万石') === 1, '真码:getRankInfo 亦走 override(万石 level1)');
ok(lvl('正三品') === 99, '真码:override 下明清品名不再命中(正三品→99·跨朝代隔离)');

// (c) P.engineConstants.rankHierarchy override
setEnv({}, { engineConstants: { rankHierarchy: [{ label: '丞相', level: 1 }, { label: '九卿', level: 4 }] } });
ok(lvl('丞相') === 1 && lvl('九卿') === 4, '真码:P.engineConstants.rankHierarchy override 生效');

// (d) 无效 override → 回退默认(健壮)
setEnv({ rankHierarchy: 'bad' }, {});
ok(lvl('正三品') === 5, '真码:override 非数组 → 回退明清默认');
setEnv({ rankHierarchy: [] }, {});
ok(lvl('正三品') === 5, '真码:override 空数组 → 回退默认');
setEnv({ rankHierarchy: [{ level: 1 }] }, {});
ok(lvl('正三品') === 5, '真码:override 缺 label → 回退默认(校验严)');

console.log('\nsmoke-s6-rank-override: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
