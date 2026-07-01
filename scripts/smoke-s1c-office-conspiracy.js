/*
 * smoke-s1c-office-conspiracy.js — S1c 官位接入阴谋（品级越高→谋逆能量越大·喂 _cap 动量/保密 + _recruit 拉拢半径）
 *   背景：原阴谋酝酿/招募全不读官位(只 _hasMilitary 读军职定 coup/plot)。新增 flag officeConspiracyEnabled(默认关)：
 *   在任高官(品级越高)谋逆酝酿更快、更隐秘、门生故吏更易拉拢。
 *   ★测真代码：headless 加载 app → 调真 ConspiracyEngine._officeConspiracyBonus / _cap。
 *   ★确定性：flag 关时 _cap 加 0、_recruit 乘 1·rng 序列字节不变（既有 smoke-conspiracy-engine 守）。
 * node scripts/smoke-s1c-office-conspiracy.js
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
const src = fs.readFileSync(path.join(ROOT, 'tm-conspiracy.js'), 'utf8');
ok(/function _officeConspiracyOn\(\)/.test(src), '_officeConspiracyOn 开关已定义');
ok(/officeConspiracyEnabled/.test(src), '开关读 officeConspiracyEnabled');
ok(/function _officeConspiracyBonus\(ch, G\)/.test(src), '_officeConspiracyBonus 已定义');
ok(/!ch\.officialTitle/.test(src), '仅在任官(有 officialTitle)受用·散阶无实权不算');
ok(/return intel \* 0\.6 \+ force \* 0\.4 \+ _officeConspiracyBonus\(ch, G\)/.test(src), '_cap 叠加官位谋逆能量');
ok(/_cap\(lead, G\) \/ CFG\.capPivot/.test(src), '动量 capFactor 走 _cap(lead, G)');
ok(/1\.4 - _cap\(lead, G\) \/ 120/.test(src), '保密 hideFactor 走 _cap(lead, G)');
ok(/_reach = 1 \+ _officeConspiracyBonus\(lead, G\) \/ 60/.test(src), '_recruit 拉拢半径按官位放大');
ok(/CFG\.recruitChanceBase \* monthRatio \* _reach, 0, 0\.9/.test(src), '招募阈值上界仍 0.9(flag 关字节不变)');
ok(/_officeConspiracyBonus: _officeConspiracyBonus/.test(src), '导出 _officeConspiracyBonus 供单测');

// ════════ 二·真代码：headless 加载 → 调真函数 ════════
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();
const env = helpers.makeStubs();
const sandbox = vm.createContext(env.win);
const scripts = helpers.parseIndexHtmlScripts();
const cutoff = scripts.findIndex((s) => path.basename(s) === 'tm-test-harness.js');
(cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((s) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), sandbox, { filename: s, timeout: 20000 }); } catch (e) {} });

ok(vm.runInContext('!!(typeof ConspiracyEngine!=="undefined" && typeof ConspiracyEngine._officeConspiracyBonus==="function")', sandbox), 'boot 后 ConspiracyEngine._officeConspiracyBonus 可调');

function setEnv(ch, flagOn) {
  sandbox.GM = { turn: 5, officeTree: [], chars: [ch] };
  sandbox.P = { conf: flagOn ? { officeConspiracyEnabled: true } : {} };
  sandbox.__ch = ch;
}
function bonus(ch, flagOn) { setEnv(ch, flagOn); return vm.runInContext('ConspiracyEngine._officeConspiracyBonus(__ch, GM)', sandbox); }
function capOf(ch, flagOn) { setEnv(ch, flagOn); return vm.runInContext('ConspiracyEngine._cap(__ch, GM)', sandbox); }

const high = { name: '首辅', officialTitle: '内阁首辅·建极殿大学士', rankLevel: 1, intelligence: 70, valor: 40 };
const mid = { name: '知府', officialTitle: '知府', rankLevel: 9, intelligence: 70, valor: 40 };
const noOffice = { name: '布衣', officialTitle: '', rankLevel: 1, intelligence: 70, valor: 40 };

// (a) flag 关 → 加成恒 0（零回归）
ok(bonus(high, false) === 0, '真码：flag 关 → 首辅谋逆加成 0（零回归）');
// (b) flag 开 → 在任高官加成 > 0 且 ≤ 30
const bh = bonus(high, true);
ok(bh > 0 && bh <= 30, '真码：flag 开 → 首辅谋逆加成 ' + bh + ' ∈(0,30]');
// (c) flag 开 → 高品 ≥ 中品（官越高谋逆能量越大）
const bm = bonus(mid, true);
ok(bh >= bm, '真码：首辅加成(' + bh + ') ≥ 知府加成(' + bm + ')（品级单调）');
// (d) flag 开 → 无官衔(布衣)加成 0（散阶/无实权不算）
ok(bonus(noOffice, true) === 0, '真码：无官衔者加成 0（仅在任官受用）');
// (e) _cap：flag 关 → 在任官与布衣同(均无加成)
ok(capOf(high, false) === capOf(noOffice, false), '真码：flag 关 → _cap(首辅)=_cap(布衣)（同属性·无官位差）');
// (f) _cap：flag 开 → 在任高官 > 同属性布衣（官位放大谋逆能量）
ok(capOf(high, true) > capOf(noOffice, true), '真码：flag 开 → _cap(首辅) > _cap(布衣)（官位喂动量/保密）');
// (g) _cap 基线不破（首辅 base=70*.6+40*.4=58·关时恰 58）
ok(capOf(high, false) === 58, '真码：_cap 基线 = 58（intel*0.6+force*0.4·flag 关无加成）');

console.log('\nsmoke-s1c-office-conspiracy: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
