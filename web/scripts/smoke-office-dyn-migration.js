// smoke-office-dyn-migration.js — 旧账收口·dynamicInstitutions 一次性迁入官制树（批四·2026-07-21）
//
// owner 拍板分叉③：权设台账衙门(浅账·永长不成真衙)迁入 officeTree 著为定制。
// 验：flag 闸/正门落树(applyReformToTree)/挂靠 subordinateTo/同名并账不重立/废衙与
// _viaReform 不迁/岁支停走标记/旧掌其事荐正授/AI 补章程充实职官表(无 AI 留裸亦成体统)/幂等。
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var failures = [];
function assert(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); }
  else { failures.push(msg); console.log('  FAIL ' + msg); }
}

var RANKS = [
  { id: 'z5', label: '正五品', level: 9, salary: 38 },
  { id: 'z7', label: '正七品', level: 13, salary: 20 }
];
var CANNED = JSON.stringify({
  name: '别名衙', desc: '掌其事', setupCost: 3000,
  positions: [{ name: '主官', rank: '正五品', count: 1, powers: ['works'], authority: 'execution', salary: 38, duties: '掌其事' }],
  heads: [{ position: '主官', name: '干吏乙', reason: '干练' }]
});

function freshSandbox(opts) {
  opts = opts || {};
  var sb = { console: console };
  sb.window = sb; sb.global = sb;
  sb._ebs = [];
  sb.addEB = function (cat, msg) { sb._ebs.push(cat + '·' + msg); };
  sb._jobs = [];
  sb._enqueuePostTurnJob = function (id, fn) { sb._jobs.push({ id: id, fn: fn }); };
  sb.SettlementPipeline = { register: function () {} };
  sb._activeRankHierarchy = function () { return RANKS; };
  sb._flags = { officeDynMigrationEnabled: opts.migOn !== false };
  sb.officeFlagOn = function (n) { return !!sb._flags[n]; };
  if (opts.ai) sb.callAI = function () { return Promise.resolve(CANNED); };
  sb.GM = {
    turn: 20,
    huangwei: { index: 50 }, huangquan: { index: 50 },
    guoku: { balance: 100000, ledgers: { money: { stock: 100000 } } },
    officeTree: [{ name: '户部', desc: '掌钱谷', positions: [], subs: [], functions: [] }],
    chars: [
      { name: '天子', isPlayer: true, alive: true },
      { name: '老教头', alive: true, loyalty: 70, administration: 60 },
      { name: '干吏乙', alive: true, loyalty: 60, administration: 70 }
    ],
    dynamicInstitutions: [
      { name: '讲武堂', stage: 'running', duties: '练兵讲武', annualBudget: 5000, headOfficial: '老教头' },
      { name: '废衙', stage: 'abolished' },
      { name: '清吏司', stage: 'running', subordinateTo: '户部', duties: '稽核钱粮' },
      { name: '拟制衙', stage: 'pendingReform', _viaReform: true },
      { name: '户部', stage: 'running', duties: '与官制树同名' }
    ],
    _pendingReforms: []
  };
  sb.findCharByName = function (n) {
    for (var i = 0; i < sb.GM.chars.length; i++) if (sb.GM.chars[i].name === n) return sb.GM.chars[i];
    return null;
  };
  sb.P = { conf: {} };
  vm.createContext(sb);
  ['tm-office-reform.js', 'tm-office-charter.js'].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  });
  return sb;
}
function topNames(G) { return G.officeTree.map(function (n) { return n.name; }); }

console.log('① flag 闸');
var sb0 = freshSandbox({ migOn: false });
sb0.TM.OfficeCharter.migrateDynInstitutions(sb0.GM);
assert(topNames(sb0.GM).length === 1 && !sb0.GM.dynamicInstitutions[0]._migratedToTree, 'flag 关→分毫不动(零回归)');

console.log('② 迁移正门落树');
var sb1 = freshSandbox({});   // 无 AI
sb1.TM.OfficeCharter.migrateDynInstitutions(sb1.GM);
var G1 = sb1.GM;
assert(topNames(G1).indexOf('讲武堂') >= 0, '讲武堂落顶层真节点');
var hb = G1.officeTree.filter(function (n) { return n.name === '户部'; })[0];
assert(hb.subs.length === 1 && hb.subs[0].name === '清吏司', '清吏司挂靠 subordinateTo 落户部之下');
assert(G1.officeTree.filter(function (n) { return n.name === '户部'; }).length === 1, '同名(户部)并账不重立');
assert(G1.dynamicInstitutions[0].stage === 'migrated' && G1.dynamicInstitutions[0]._migratedToTree === true, '讲武堂旧账标 migrated(岁支停走)');
assert(G1.dynamicInstitutions[4]._migratedToTree === true, '同名并账者亦标停走');
assert(!G1.dynamicInstitutions[1]._migratedToTree && topNames(G1).indexOf('废衙') < 0, '废衙不迁');
assert(!G1.dynamicInstitutions[3]._migratedToTree && topNames(G1).indexOf('拟制衙') < 0, '_viaReform 拟制衙不迁(本就无实体)');
assert(sb1._ebs.some(function (e) { return e.indexOf('归入官制树') >= 0; }), '迁制入起居注');
assert(Array.isArray(G1._edictSuggestions) && G1._edictSuggestions.some(function (s) { return s.content.indexOf('老教头') >= 0 && s.content.indexOf('讲武堂') >= 0; }), '旧掌其事(老教头)荐正授入建议库');
assert(sb1._jobs.length === 0, '无 AI→不派补章job·裸节点亦成体统');

console.log('③ 幂等·再跑不重迁');
var nodesBefore = JSON.stringify(topNames(sb1.GM));
var sugBefore = sb1.GM._edictSuggestions.length;
sb1.TM.OfficeCharter.migrateDynInstitutions(sb1.GM);
assert(JSON.stringify(topNames(sb1.GM)) === nodesBefore && sb1.GM._edictSuggestions.length === sugBefore, '再跑零增量');

console.log('④ AI 补章程充实职官表');
var sb2 = freshSandbox({ ai: true });
sb2.TM.OfficeCharter.migrateDynInstitutions(sb2.GM);
assert(sb2._jobs.length === 2 && sb2._jobs.every(function (j) { return j.id.indexOf('officeDynMig_') === 0; }), '两新落节点各派一补章job(并账者不派)');
(async function () {
  for (var i = 0; i < sb2._jobs.length; i++) await sb2._jobs[i].fn();
  var jw = sb2.GM.officeTree.filter(function (n) { return n.name === '讲武堂'; })[0];
  assert(jw && jw.positions.length === 1 && jw.positions[0].rank === '正五品' && jw.positions[0].salary === 38, '补章落职官表(品级俸给循宪法闸)');
  assert(jw.positions[0].powers && jw.positions[0].powers.works === true && jw.positions[0].establishedCount === 1, '职权与编制字段齐(职权舆图/官俸自动接手)');
  assert(sb2._ebs.some(function (e) { return e.indexOf('迁制补章') >= 0; }), '补章入起居注');
  assert(sb2.GM._edictSuggestions.some(function (s) { return s.content.indexOf('干吏乙') >= 0; }), '补章荐单(干吏乙)入建议库');
  var qs = sb2.GM.officeTree.filter(function (n) { return n.name === '户部'; })[0].subs[0];
  assert(qs && qs.positions.length === 1, '挂靠节点(清吏司)亦获补章');

  console.log('⑤ 静态契约·接线到位');
  var parser = fs.readFileSync(path.join(ROOT, 'tm-edict-parser.js'), 'utf8');
  assert(parser.indexOf('_migratedToTree') >= 0, '岁支 tick 见 _migratedToTree 即跳(旧账停走)');
  var drawers = fs.readFileSync(path.join(ROOT, 'tm-var-drawers.js'), 'utf8');
  assert(drawers.indexOf('已归官制树') >= 0, '制度志抽屉标注已归树(留痕不隐)');
  var flagsSrc = fs.readFileSync(path.join(ROOT, 'tm-office-flags.js'), 'utf8');
  assert(flagsSrc.indexOf("'officeDynMigrationEnabled'") >= 0, 'officeDynMigrationEnabled 入 OfficeFlags.LIST');
  var patches = fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8');
  assert(patches.indexOf('officeDynMigrationEnabled') >= 0, '设置面板有旧衙归树开关行');

  console.log('');
  if (failures.length) {
    console.log('FAILURES (' + failures.length + '):');
    failures.forEach(function (f) { console.log('  - ' + f); });
    process.exit(1);
  }
  console.log('smoke-office-dyn-migration: ALL PASS');
})().catch(function (e) { console.error('SMOKE CRASH:', e); process.exit(1); });
