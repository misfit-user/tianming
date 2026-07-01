/*
 * smoke-globalrules-build.js — B2：有司核议→准奏即登记全局之制（绕开 AI 直测落库通道）
 * node scripts/smoke-globalrules-build.js
 */
global.window = global;
var GR = require('../tm-globalrules.js');
global.GlobalRules = GR;                 // approveBuild 走 root.GlobalRules（root=globalThis）
var CBA = require('../tm-custom-build-agent.js');

var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }

function freshDiv() { return { name: '应天', buildings: [] }; }
function setup() { global.GM = { turn: 7, _chronicle: [] }; global.P = {}; }

// 1·准奏一座「实学馆」（带 globalRule）→ GM._globalRules 立制 + 建筑挂名
setup();
var div = freshDiv();
var appraisal = {
  feasibility: '合理', costActual: 8000, timeActual: 3,
  effectsStructured: null,
  globalRule: {
    name: '实学之制',
    tendencies: [
      { key: 'reform_success', label: '改革推行', mag: 'moderate' },
      { key: 'tech_promotion', label: '实学推广', mag: 'moderate' },
      { key: 'shixue_recognition', label: '实学为世所重', mag: 'minor' }
    ],
    resistance: { from: ['士绅', '旧学官'], intensity: 'active', label: '别立旁门物议沸然' }
  }
};
var req = { name: '应天实学馆', category: 'cultural', description: '教算学格物火器医农政' };
var res = CBA.approveBuild('应天', appraisal, req, { div: div, P: P, GM: GM });
ok(res.ok === true, 'approveBuild 成功');
ok(div.buildings.length === 1 && div.buildings[0].status === 'building', '建筑落库 status=building');
var rule = GR.find('实学之制');
ok(!!rule, '全局之制已登记到 GM._globalRules');
ok(rule && rule.source === 'building' && rule.sourceRef && rule.sourceRef.div === '应天', '规则溯源到建筑/辖区');
ok(rule && rule.tendencies.length === 3, '三倾向保留');
ok(rule && rule.resistance && rule.resistance.intensity === 'active', '阻力烈度登记');
ok(div.buildings[0]._globalRule === '实学之制', '建筑挂规则名以备溯源');

// 2·寻常工役（无 globalRule）→ 不立任何全局规则
setup();
var div2 = freshDiv();
var res2 = CBA.approveBuild('应天', { feasibility: '合理', costActual: 2000, timeActual: 2 },
  { name: '常平仓', category: 'economic', description: '储粮平籴' }, { div: div2, P: P, GM: GM });
ok(res2.ok === true && div2.buildings.length === 1, '寻常工役照常落库');
ok((GM._globalRules || []).length === 0, '寻常工役不立全局规则');

// 3·globalRule 倾向超配额 → register 内裁档（3×major → 1 major + 2 moderate）
setup();
var div3 = freshDiv();
CBA.approveBuild('应天', { feasibility: '合理', costActual: 20000, timeActual: 4,
  globalRule: { name: '通商之制', tendencies: [
    { key: 'a', label: 'A', mag: 'major' }, { key: 'b', label: 'B', mag: 'major' }, { key: 'c', label: 'C', mag: 'major' }
  ], resistance: { from: ['海禁旧党'], intensity: 'fierce' } } },
  { name: '市舶通商局', category: 'economic', description: '开海通商' }, { div: div3, P: P, GM: GM });
var r3 = GR.find('通商之制');
var majors = r3 ? r3.tendencies.filter(function (t) { return t.mag === 'major'; }).length : -1;
ok(majors === 1, '准奏登记仍走配额硬门（至多 1 major）');

// 4·不合理工役 → 不开工、不立制
setup();
var div4 = freshDiv();
var res4 = CBA.approveBuild('应天', { feasibility: '不合理', costActual: 5000, timeActual: 3,
  globalRule: { name: '海市之制', tendencies: [{ key: 'x', label: 'X', mag: 'minor' }] } },
  { name: '内陆海港', category: 'economic', description: '内陆建海港' }, { div: div4, P: P, GM: GM });
ok(res4.ok === false && res4.reason === 'infeasible', '不合理工役被拒');
ok(div4.buildings.length === 0 && !GR.find('海市之制'), '不合理工役不落库不立制');

// 5·APPRAISAL_TOOL schema 含 globalRule 属性（供 AI 输出）
ok(CBA.APPRAISAL_TOOL && CBA.APPRAISAL_TOOL.parameters.properties.globalRule, 'schema 暴露 globalRule 属性');
ok(CBA.APPRAISAL_TOOL.parameters.required.indexOf('globalRule') < 0, 'globalRule 为选填（不在 required）');

console.log('\nsmoke-globalrules-build: PASS ' + pass + '/' + (pass + fail));
if (fail > 0) process.exit(1);
