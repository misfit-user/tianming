/* smoke-office-powermap.js — 官制活化 Slice① 职权舆图 + 接线 冒烟
 * 跑法：node web/scripts/smoke-office-powermap.js
 * 验：①过滤 ②衙门概览(主官加权) ③多才(阈值40·域才豁免) ④逐权标档(同档合并/异档逐标)
 *     ⑤履职/料理占位 ⑥relevanceText 上浮 ⑦开关组
 */
'use strict';
var path = require('path');
var mod = require(path.join(__dirname, '..', 'tm-office-powermap.js'));
var buildOfficePowerMap = mod.buildOfficePowerMap;

global.findCharByName = function (n) { return (GM.chars || []).find(function (c) { return c.name === n; }) || null; };
global.getRankLevel = function (r) {
  return ({ '正一品': 1, '正二品': 2, '从二品': 3, '正三品': 5, '正五品': 9, '从五品': 10 })[r] || 10;
};

var GM = {
  turn: 14,
  chars: [
    { name: '李某', administration: 82, intelligence: 70, military: 30, loyalty: 60, wuchang: { ren: 60, yi: 60, li: 60, zhi: 60, xin: 60 } }, // 军30<40 应被阈值滤·德60
    { name: '王某', military: 45, administration: 40, loyalty: 88, wuchang: { ren: 88, yi: 88, li: 88, zhi: 88, xin: 88 } },                   // 政40=40 应保留·德88
    { name: '赵某', administration: 55, intelligence: 60, loyalty: 70, wuchang: { ren: 70, yi: 70, li: 70, zhi: 70, xin: 70 } }                // 异档官·料理勉强(61)·德70
  ],
  officeTree: [
    {
      name: '户部',
      positions: [
        { name: '尚书', rank: '正二品', holder: '李某', powers: { taxCollect: true, appointment: true }, authority: 'decision' },
        { name: '员外郎', rank: '从五品', holder: '' } // 无权·非主官 → 应被过滤
      ],
      subs: [{ name: '度支司', positions: [{ name: '郎中', rank: '正五品', holder: '', powers: { taxCollect: true }, authority: 'execution' }] }]
    },
    { name: '兵部', positions: [{ name: '尚书', rank: '正二品', holder: '王某', powers: { militaryCommand: true }, authority: 'execution', _dutyState: { fulfillment: 71, trend: 'stable' } }] },
    { name: '都察院', positions: [{ name: '左都御史', rank: '正二品', holder: '', powers: { impeach: true, supervise: true }, authority: 'supervision' }] },
    // 异档官：judicial(默认决策) + impeach(默认纠察)·无 position.authority → 逐标
    { name: '大理寺', positions: [{ name: '卿', rank: '正三品', holder: '赵某', powers: { judicial: true, impeach: true } }] }
  ]
};

var out = buildOfficePowerMap(GM, { relevanceText: '整饬边备，命兵部调兵御虏' });
console.log('\n----- 输出 -----\n' + out + '\n----------------\n');

var fails = 0;
function ok(cond, msg) { if (!cond) { console.log('✗ ' + msg); fails++; } else { console.log('✓ ' + msg); } }

ok(out.indexOf('【职权舆图】') === 0, '有标题头');
ok(out.indexOf('员外郎') < 0, '①过滤：无权非主官的员外郎被剔除');
// ②衙门概览·主官加权
ok(out.indexOf('户部·弱') >= 0 && out.indexOf('户部·瘫') < 0, '②主官在任→户部弱(非瘫)');
ok(out.indexOf('都察院·瘫(主官缺)') >= 0, '②主官缺→都察院瘫');
ok(out.indexOf('兵部·健全') >= 0 && out.indexOf('大理寺·健全') >= 0, '②满员→健全');
// ③多才 + 阈值40（域才豁免）
ok(out.indexOf('李某(政82 智70 德60)') >= 0, '③阈值+德：李某 军30<40 被滤→政/智+德60(忠改德·履职看五常)');
ok(out.indexOf('王某(军45 政40 德88)') >= 0, '③阈值+德：王某 政40=40 保留·德88');
// ④逐权标档：同档合并 / 单权 / 异档逐标
ok(out.indexOf('权[征税|辟署]·决策') >= 0, '④同档合并：户部 征税|辟署·决策');
ok(out.indexOf('权[弹劾|监察]·纠察') >= 0, '④同档合并：都察院 弹劾|监察·纠察');
ok(out.indexOf('权[调兵·执行]') >= 0, '④单权：兵部 调兵·执行');
ok(out.indexOf('权[弹劾·纠察][刑狱·决策]') >= 0, '④异档逐标：大理寺 弹劾·纠察 + 刑狱·决策(按 POWER_LABEL 键序)');
// ⑤履职/料理
ok(out.indexOf('履职71') >= 0, '⑤真 _dutyState→履职71');
ok(out.indexOf('料理称职') >= 0, '⑤料理占位·称职(李某 73.2)');
ok(out.indexOf('料理勉强') >= 0, '⑤料理占位·勉强(赵某 61)');
// ⑥relevanceText 上浮
var idxBing = out.indexOf('兵部·尚书'), idxDu = out.indexOf('左都御史'), idxHu = out.indexOf('户部·尚书');
ok(idxBing >= 0 && idxDu >= 0 && idxHu >= 0, '三要职均在详情');
ok(idxBing < idxDu, '⑥relevanceText：圣旨提"兵部"→兵部上浮到都察院之前');
ok(idxBing < idxHu && idxDu < idxHu, '③异常/相关项排在户部之前');

// ⑦开关组
require(path.join(__dirname, '..', 'tm-office-flags.js'));
var officeFlagOn = global.officeFlagOn;
global.P = {};
ok(officeFlagOn('officePowerPerceptionEnabled') === true, '⑦①职权舆图默认开(纯增益·owner flip 2026-06-30)');
global.P = { conf: { officePowerPerceptionEnabled: false } };
ok(officeFlagOn('officePowerPerceptionEnabled') === false, '⑦①显式 false 才关(可关回)');
global.P = { conf: { officeDutyStateEnabled: false } };
ok(officeFlagOn('officeDutyStateEnabled') === false, '⑦②履职度仍默认关(有 balance)');
global.P = { conf: { officePowerPerceptionEnabled: true } };
ok(officeFlagOn('officePowerPerceptionEnabled') === true, '⑦独立开关开→true');
global.P = { conf: { officeActivationEnabled: true } };
ok(officeFlagOn('officeDutyStateEnabled') === true, '⑦组闸开→四刀全 on');
global.P = {};

// ── 官制 agent 化·queryOfficeDetail（query-aware + 返 duties 职责描述）──
var qod = mod.queryOfficeDetail;
var QGM = {
  chars: [{ name: '郭某', administration: 80, wuchang: { ren: 70, yi: 70, li: 70, zhi: 70, xin: 70 } }],
  officeTree: [
    { name: '户部', positions: [{ name: '尚书', rank: '正二品', holder: '郭某', powers: { taxCollect: true }, duties: '掌天下户口田赋之政令，理财赋、平准均输', _dutyState: { fulfillment: 60 } }] },
    { name: '兵部', positions: [{ name: '尚书', rank: '正二品', holder: '', powers: { militaryCommand: true }, duties: '掌天下武卫官军选授简练之政令' }] }
  ]
};
global.findCharByName = function (n) { return (QGM.chars || []).find(function (c) { return c.name === n; }) || null; }; // 指向 QGM
var q1 = qod(QGM, '户部');
ok(q1.indexOf('户部·尚书') >= 0 && q1.indexOf('郭某') >= 0 && q1.indexOf('职责:掌天下户口田赋') >= 0 && q1.indexOf('履职60') >= 0, '⑩query_office按名查→返在任者(才/德/履职)+duties职责描述(激活惰性字段)');
var q2 = qod(QGM, '征税');
ok(q2.indexOf('户部·尚书') >= 0 && q2.indexOf('兵部') < 0, '⑪按权力"征税"查→只返掌taxCollect的户部·不返兵部');
var q3 = qod(QGM, '调兵');
ok(q3.indexOf('兵部·尚书') >= 0 && q3.indexOf('出缺') >= 0, '⑫按权力"调兵"查→兵部尚书出缺');
ok(qod(QGM, '查无此衙').indexOf('未匹配') >= 0, '⑬无匹配→提示换 query');
ok(qod(QGM, '').indexOf('户部') >= 0 && qod(QGM, '').indexOf('兵部') >= 0, '⑭空query→全部(由cap控)');

// ── #2 势力工具集成：handle('query_office',{query},ctx) 经注入的 officeQuery formatter → queryOfficeDetail（async·收尾移进来）──
require(path.join(__dirname, '..', 'tm-faction-decision-tools.js'));
var fdt = global.TM && global.TM.FactionDecisionTools;
(async function () {
  ok(!!fdt && fdt.isToolName('query_office') === true, '⑮query_office 注册进势力工具 ROUTING(isToolName)');
  var ctx = { fac: {}, formatters: { officeQuery: function (query) { return qod(QGM, String(query || '')); } } };
  var r = await fdt.handle('query_office', { query: '户部' }, ctx);
  ok(r && r.ok && r.text.indexOf('户部·尚书') >= 0 && r.text.indexOf('郭某') >= 0 && r.text.indexOf('职责:') >= 0, '⑯势力 query_office→handle 经 officeQuery 取户部详情(才/德/履职+duties)');
  var r2 = await fdt.handle('query_office', { query: '查无此衙' }, ctx);
  ok(r2 && r2.ok && r2.text.indexOf('未匹配') >= 0, '⑰query 无匹配→handle 仍 ok·返提示(不报错)');

  console.log('\n' + (fails === 0 ? 'PASS — ' : 'FAIL — ') + fails + ' 处失败\n');
  process.exit(fails === 0 ? 0 : 1);
})();
