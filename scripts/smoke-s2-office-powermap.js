/*
 * smoke-s2-office-powermap.js — S2① 职权舆图(officePowerPerceptionEnabled)验证 flag-on 真能产出
 *   官制活化四刀早已写好+接线但默认全关。此刀①=纯 prompt 增益(给 AI「谁掌什么权·才德·履职/出缺」)·零 balance。
 *   ★测真代码：headless 加载 app → 调真 buildOfficePowerMap / queryOfficeDetail + 四 flag 接线源契约。
 * node scripts/smoke-s2-office-powermap.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const HEADLESS = path.join(__dirname, 'headless-smoke.js');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

// ════════ 一·四刀接线源契约（tm-endturn-prompt.js 四 flag 全 officeFlagOn 门控·默认关零回归）════════
const promptSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-prompt.js'), 'utf8');
ok(/officeFlagOn\('officePowerPerceptionEnabled'\) && typeof buildOfficePowerMap/.test(promptSrc), '①职权舆图 officePowerPerceptionEnabled 门控接 buildOfficePowerMap');
ok(/officeFlagOn\('officeAuthorityGateEnabled'\)/.test(promptSrc), '③权限门·执行力 officeAuthorityGateEnabled 门控');
ok(/officeFlagOn\('officeReformAdjudicationEnabled'\)/.test(promptSrc), '④改制裁定 officeReformAdjudicationEnabled 门控');
const flagsSrc = fs.readFileSync(path.join(ROOT, 'tm-office-flags.js'), 'utf8');
ok(/officeDutyStateEnabled/.test(flagsSrc) && /officeAuthorityGateEnabled/.test(flagsSrc), '②履职度/③权限门 flag 在 OfficeFlags LIST');

// ════════ 二·真代码：headless 加载 → 调真 buildOfficePowerMap ════════
function loadHeadlessHelpers() { const s = fs.readFileSync(HEADLESS, 'utf8').replace(/^#![^\n]*\n/, '').replace(/\nmain\(\);\s*$/, '\nreturn { makeStubs, parseIndexHtmlScripts };'); return (new Function('require', 'process', '__dirname', '__filename', 'module', 'exports', s))(require, process, __dirname, HEADLESS, { exports: {} }, {}); }
const helpers = loadHeadlessHelpers();
const env = helpers.makeStubs();
const sandbox = vm.createContext(env.win);
const scripts = helpers.parseIndexHtmlScripts();
const cutoff = scripts.findIndex((s) => path.basename(s) === 'tm-test-harness.js');
(cutoff >= 0 ? scripts.slice(0, cutoff) : scripts).forEach((s) => { try { vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), sandbox, { filename: s, timeout: 20000 }); } catch (e) {} });

ok(vm.runInContext('typeof buildOfficePowerMap === "function" && typeof queryOfficeDetail === "function"', sandbox), 'boot 后 buildOfficePowerMap / queryOfficeDetail 可调');
ok(vm.runInContext('typeof officeFlagOn === "function"', sandbox), 'officeFlagOn 可调');

// flag 行为：①职权舆图默认开(纯增益·owner flip 2026-06-30)·显式 false 才关；②③④仍默认关
sandbox.P = { conf: {} };
ok(vm.runInContext('officeFlagOn("officePowerPerceptionEnabled") === true', sandbox), '①职权舆图默认开（纯增益·flip 后 officeFlagOn 返 true）');
ok(vm.runInContext('officeFlagOn("officeDutyStateEnabled") === false && officeFlagOn("officeAuthorityGateEnabled") === false', sandbox), '②③仍默认关（有 balance·待 playtest flip）');
sandbox.P = { conf: { officePowerPerceptionEnabled: false } };
ok(vm.runInContext('officeFlagOn("officePowerPerceptionEnabled") === false', sandbox), '①显式 false 才关（可关回）');
sandbox.P = { conf: { officeActivationEnabled: true } };
ok(vm.runInContext('officeFlagOn("officePowerPerceptionEnabled") === true && officeFlagOn("officeDutyStateEnabled") === true', sandbox), '组闸 officeActivationEnabled → 四刀全开');

// 真造 officeTree + chars，调 buildOfficePowerMap
sandbox.GM = {
  turn: 5,
  chars: [
    { name: '王某', intelligence: 50, administration: 40, military: 80, management: 45, valor: 60, loyalty: 70, wuchang: { yi: 75, xin: 70, li: 65, ren: 60, zhi: 55 } },
    { name: '李某', intelligence: 75, administration: 70, military: 30, charisma: 60, loyalty: 80, wuchang: { yi: 80, xin: 75, li: 70, ren: 65, zhi: 70 } }
  ],
  officeTree: [
    { name: '兵部', positions: [{ name: '尚书', rank: '正二品', holder: '王某', powers: { militaryCommand: true, appointment: true }, authority: 'decision' }] },
    { name: '都察院', positions: [
      { name: '左都御史', rank: '正二品', holder: '李某', powers: { supervise: true, impeach: true } },
      { name: '监察御史', rank: '正七品', holder: null, powers: { supervise: true } }
    ] }
  ]
};
const map = vm.runInContext('buildOfficePowerMap(GM, { cap: 12 })', sandbox);
ok(typeof map === 'string' && map.length > 0, 'buildOfficePowerMap 产出非空');
ok(map.indexOf('【职权舆图】') === 0, '以【职权舆图】开头');
ok(map.indexOf('〔衙门概览〕') >= 0 && map.indexOf('〔掌权要职〕') >= 0, '含 衙门概览 + 掌权要职 两段');
ok(map.indexOf('兵部') >= 0 && map.indexOf('王某') >= 0, '含部门名 + 在任者');
ok(map.indexOf('调兵') >= 0 && map.indexOf('辟署') >= 0, '权力中文标签：调兵(militaryCommand)+辟署(appointment)');
ok(map.indexOf('监察') >= 0 && map.indexOf('弹劾') >= 0, '都察院权力：监察(supervise)+弹劾(impeach)');
ok(map.indexOf('出缺') >= 0, '空缺职位标 出缺（监察御史 holder=null）');
ok(/德\d/.test(map), '含 德NN 五常评分');
ok(/军80/.test(map), '王某 域才 军80 显示（domain talent）');
ok(map.indexOf('决策') >= 0, '权力档 决策(decision authority)');

// queryOfficeDetail 按需取数
const q1 = vm.runInContext('queryOfficeDetail(GM, "调兵")', sandbox);
ok(typeof q1 === 'string' && q1.indexOf('兵部') >= 0 && q1.indexOf('王某') >= 0, 'queryOfficeDetail("调兵") 命中兵部尚书');
const q2 = vm.runInContext('queryOfficeDetail(GM, "御史")', sandbox);
ok(typeof q2 === 'string' && q2.indexOf('都察院') >= 0, 'queryOfficeDetail("御史") 命中都察院');
const q3 = vm.runInContext('queryOfficeDetail(GM, "不存在的衙门XYZ")', sandbox);
ok(typeof q3 === 'string' && q3.indexOf('未匹配') >= 0, 'queryOfficeDetail 未命中 → 友好提示');

console.log('\nsmoke-s2-office-powermap: ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
process.exit(fail > 0 ? 1 : 0);
