/*
 * smoke-s1-power-minister-revival.js — S1a 权臣死锁修复（_tenureMonths 真递增 → 权臣系统复活）
 *   背景：原 `_tenureMonths` 全代码从不递增（只在 tm-prophecy:285 被设 0、被权臣候选≥24月/坐大drain>60月读取），
 *   故权臣候选恒空、截留/自拟/篡位形同虚设。新增 _tickOfficeTenure(flag 默认关) 让任职月数按月递增。
 *   ★测真代码：headless 加载整个 app → 调真导出 AuthorityComplete.tickOfficeTenure / detectPowerMinister。
 * node scripts/smoke-s1-power-minister-revival.js
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
const src = fs.readFileSync(path.join(ROOT, 'tm-authority-complete.js'), 'utf8');
ok(/function _tickOfficeTenure\(ctx, mr\)/.test(src), '_tickOfficeTenure 已定义');
ok(/function _powerMinisterEnabled\(\)/.test(src), '_powerMinisterEnabled 开关已定义');
ok(/powerMinisterEnabled/.test(src) && /P\.conf/.test(src), '开关读 P.conf/P.ai.powerMinisterEnabled');
ok(/_tenureMonths = \(c\._tenureMonths \|\| 0\) \+ step/.test(src), '在任按月递增 _tenureMonths');
ok(/_OFF_TENURE_RETIRE_RE/.test(src) && /致仕/.test(src), '致仕/守制 排除正则');
const tIdx = src.indexOf('_tickOfficeTenure(ctx, mr); } catch');
const dIdx = src.indexOf('_detectPowerMinister(ctx); _tickPowerMinister');
ok(tIdx > 0 && dIdx > tIdx, 'tick() 中 _tickOfficeTenure 在 _detectPowerMinister 之前（本回合任期当回合可见）');
ok(/tickOfficeTenure: _tickOfficeTenure/.test(src), '导出 tickOfficeTenure 供单测真代码');
ok(/isPowerMinisterEnabled: _powerMinisterEnabled/.test(src), '导出 isPowerMinisterEnabled');

// ════════ 二·真代码：headless 加载 app → 调真导出函数 ════════
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();
const env = helpers.makeStubs();
const sandbox = vm.createContext(env.win);
const scripts = helpers.parseIndexHtmlScripts();
const cutoff = scripts.findIndex((s) => path.basename(s) === 'tm-test-harness.js');
(cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((s) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), sandbox, { filename: s, timeout: 20000 }); } catch (e) {} });

ok(vm.runInContext('!!(typeof AuthorityComplete!=="undefined" && typeof AuthorityComplete.tickOfficeTenure==="function")', sandbox), 'boot 后真函数 AuthorityComplete.tickOfficeTenure 可调');

// 跑一次 tickOfficeTenure（chars 为 node 对象·vm 共享引用·原地 mutate 后 node 侧可读）
function tickTenure(chars, flagOn, mr) {
  sandbox.GM = { turn: 5, chars: chars, huangquan: { index: 50 }, evtLog: [] };
  sandbox.P = { conf: flagOn ? { powerMinisterEnabled: true } : {} };
  sandbox.__mr = mr;
  vm.runInContext('AuthorityComplete.tickOfficeTenure({ turn: 5, monthRatio: __mr }, __mr)', sandbox);
  return chars;
}
function detect(chars) {
  sandbox.GM = { turn: 5, chars: chars, huangquan: {}, evtLog: [] };
  sandbox.P = { conf: { powerMinisterEnabled: true } };
  return vm.runInContext('(function(){ var pm = AuthorityComplete.detectPowerMinister({ turn: 5 }); return pm ? pm.name : null; })()', sandbox);
}

// (a) flag 关 → 不递增（零回归）
let c1 = [{ name: 'A', alive: true, officialTitle: '内阁首辅' }];
tickTenure(c1, false, 1);
ok(!c1[0]._tenureMonths, '真码：flag 关 → 持官者 _tenureMonths 不递增（零回归）');

// (b) flag 开 → 在任按月累加
let c2 = [{ name: 'B', alive: true, officialTitle: '内阁首辅' }];
tickTenure(c2, true, 1);
ok(c2[0]._tenureMonths === 1, '真码：flag 开·mr=1 → _tenureMonths 0→1');
tickTenure(c2, true, 1);
ok(c2[0]._tenureMonths === 2, '真码：再跑一回合 → 1→2（持续累加）');

// (c) flag 开·mr=0.5（半月/回合）→ 按月比例累加
let c3 = [{ name: 'C', alive: true, officialTitle: '尚书' }];
tickTenure(c3, true, 0.5);
ok(c3[0]._tenureMonths === 0.5, '真码：mr=0.5 → 按月比例累加 0.5（认 daysPerTurn 刻度）');

// (d) flag 开·致仕 → 归零（重置权臣钟）
let c4 = [{ name: 'D', alive: true, officialTitle: '首辅·致仕', _tenureMonths: 30 }];
tickTenure(c4, true, 1);
ok(c4[0]._tenureMonths === 0, '真码：致仕者 → _tenureMonths 归零（失权重置）');

// (e) flag 开·无官 → 归零
let c5 = [{ name: 'E', alive: true, officialTitle: '', _tenureMonths: 10 }];
tickTenure(c5, true, 1);
ok(c5[0]._tenureMonths === 0, '真码：无官衔 → _tenureMonths 归零');

// (f) flag 开·已故 → 不动
let c6 = [{ name: 'F', alive: false, officialTitle: '内阁首辅', _tenureMonths: 50 }];
tickTenure(c6, true, 1);
ok(c6[0]._tenureMonths === 50, '真码：已故者跳过（不递增不归零）');

// (g) ★死锁修复闭环：满 24 月 + 高位 + 高野心 → detectPowerMinister 选出权臣
let cand = [{ name: '黄立极', alive: true, officialTitle: '内阁首辅', ambition: 80, _tenureMonths: 24 }];
ok(detect(cand) === '黄立极', '真码：满24月·首辅·野心80 → detectPowerMinister 选出权臣（死锁前恒 null）');

// (h) 任期不足 24 月 → 仍不被选（候选闸真生效）
let cand2 = [{ name: '某甲', alive: true, officialTitle: '内阁首辅', ambition: 80, _tenureMonths: 12 }];
ok(detect(cand2) === null, '真码：任期仅12月 → 不被选（≥24月闸真生效）');

// (i) 野心不足 → 不被选
let cand3 = [{ name: '某乙', alive: true, officialTitle: '内阁首辅', ambition: 50, _tenureMonths: 36 }];
ok(detect(cand3) === null, '真码：野心50<65 → 不被选（野心闸真生效）');

console.log('\nsmoke-s1-power-minister-revival: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);   // 强制退出：headless 加载的 app 有残留定时器会挂住事件循环
