// smoke-office-charter.js — 设衙章程演绎层（设新衙门批一·2026-07-21）
//
// 不经真 AI：canned 章程原料直灌 _validateCharter 验宪法闸（品级须在表/职权⊆九权且≤3/
// 员额与俸禄夹取/首任只荐在档活人/重名回退玩家原名/开办费夹取），再走 adjudicatePendingReforms
// 验落树全结构（准=按章开衙·部分=打折·国库不支=改拖拖满则寝·荐单入诏书建议库只荐不任）。
// 双轨：无章程→裸壳落树(原行为)。tick 闸：flag 关/无 AI 不拟·幂等不重派·单官职增设不拟章。
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
  { id: 'z3', label: '正三品', level: 5, salary: 65 },
  { id: 'z5', label: '正五品', level: 9, salary: 38 },
  { id: 'z7', label: '正七品', level: 13, salary: 20 }
];

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
  sb._flags = { officeCharterEnabled: !!opts.charterOn };
  sb.officeFlagOn = function (n) { return !!sb._flags[n]; };
  if (opts.callAI) sb.callAI = opts.callAI;
  sb.GM = {
    turn: 10,
    huangwei: { index: 50 }, huangquan: { index: 50 },
    guoku: { balance: (opts.balance != null ? opts.balance : 100000), ledgers: { money: { stock: (opts.balance != null ? opts.balance : 100000) } } },
    officeTree: [
      { name: '户部', desc: '掌钱谷', positions: [{ name: '尚书', rank: '正三品', holder: '钱谷才', headCount: 1, actualCount: 1, additionalHolders: [], establishedCount: 1, vacancyCount: 0, actualHolders: [{ name: '钱谷才', generated: true }] }], subs: [], functions: [] }
    ],
    chars: [
      { name: '天子', isPlayer: true, alive: true },
      { name: '钱谷才', alive: true, loyalty: 80, administration: 85, officialTitle: '户部尚书' },
      { name: '干吏乙', alive: true, loyalty: 60, administration: 70 },
      { name: '已故者', alive: false, loyalty: 60, administration: 90 }
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

var RAW = {
  name: '市舶提举司',
  desc: '掌番舶抽解博买·通海贸之利以裕国用·兼稽奸私（此句超长部分应被截断到四十字以内）',
  positions: [
    { name: '提举', rank: '正五品', count: 20, powers: ['taxCollect', 'bogusPower', 'supervise', 'judicial', 'works'], authority: 'bogus', salary: 999, duties: '总司抽解博买' },
    { name: '副提举', rank: '正十三品', count: 1, powers: ['taxCollect'], salary: 30 },
    { name: 'X', rank: '正七品', count: 1 },
    { name: '吏目', rank: '正七品', count: 2, powers: [], authority: 'execution', salary: 10, duties: '掌文牍' }
  ],
  heads: [
    { position: '提举', name: '钱谷才', reason: '晓畅钱谷·可当此任' },
    { position: '不存在职', name: '干吏乙' },
    { position: '吏目', name: '已故者' },
    { position: '吏目', name: '天子' }
  ],
  setupCost: 999999
};

console.log('① _validateCharter 宪法闸');
var sb = freshSandbox();
var OC = sb.TM.OfficeCharter;
var item0 = { reformDetail: '增设', dept: '市舶司' };
var v = OC._validateCharter(sb.GM, JSON.parse(JSON.stringify(RAW)), item0);
assert(!!v, '合规章程通过验闸');
assert(v.name === '市舶提举司', '正名收下(不与现有衙门重名)');
assert(v.desc.length <= 40, '职掌截断≤40');
assert(v.positions.length === 2, '四职进两职：品级不在表(正十三品)与名过短(X)皆黜落');
var p0 = v.positions[0];
assert(p0.count === 8, '员额 20→夹取封顶 8');
assert(p0.salary === 76, '月俸 999→夹取品级俸×2(38×2=76)');
assert(p0.powers.length === 3 && p0.powers.indexOf('bogusPower') < 0, '职权滤野键·封顶3项');
assert(p0.authority === '', '非法 authority 置空');
assert(v.positions[1].salary === 10, '月俸 10=正七品俸(20)×0.5 下限·恰在 band 内不动');
assert(v.heads.length === 1 && v.heads[0].name === '钱谷才', '荐单只留在档活人非玩家且职位实存者');
assert(v.setupCost === 30000, '开办费 999999→夹取上限 30000');
var vDup = OC._validateCharter(sb.GM, Object.assign(JSON.parse(JSON.stringify(RAW)), { name: '户部' }), item0);
assert(vDup.name === '市舶司', '正名与现有衙门重名→回退玩家原名');
var vBad = OC._validateCharter(sb.GM, { name: '空衙', positions: [{ name: '妄职', rank: '正十三品', count: 1 }] }, item0);
assert(vBad === null, '全职位皆废→章程作废(裸壳双轨)');

console.log('② tick 派单闸');
var sbT = freshSandbox({ charterOn: false, callAI: function () { return Promise.resolve('{}'); } });
sbT.GM._pendingReforms.push({ _key: 'k1', reformDetail: '增设', dept: '市舶司', status: '拟制中', proposedTurn: 10 });
sbT.TM.OfficeCharter.tick(sbT.GM);
assert(sbT._jobs.length === 0 && sbT.GM._pendingReforms[0]._charterPending == null, 'flag 关→不拟章');
var sbT2 = freshSandbox({ charterOn: true });
sbT2.GM._pendingReforms.push({ _key: 'k1', reformDetail: '增设', dept: '市舶司', status: '拟制中', proposedTurn: 10 });
sbT2.TM.OfficeCharter.tick(sbT2.GM);
assert(sbT2._jobs.length === 0, '无 callAI→不拟章(裁定时裸壳兜底=双轨)');
var sbT3 = freshSandbox({ charterOn: true, callAI: function () { return Promise.resolve('{}'); } });
sbT3.GM._pendingReforms.push({ _key: 'k1', reformDetail: '增设', dept: '市舶司', status: '拟制中', proposedTurn: 10 });
sbT3.GM._pendingReforms.push({ _key: 'k2', reformDetail: '增设', dept: '户部', position: '主事', status: '拟制中', proposedTurn: 10 });
sbT3.GM._pendingReforms.push({ _key: 'k3', reformDetail: '裁撤', dept: '户部', status: '拟制中', proposedTurn: 10 });
sbT3.TM.OfficeCharter.tick(sbT3.GM);
assert(sbT3._jobs.length === 1 && sbT3._jobs[0].id === 'officeCharter_k1', '只为衙门级增设拟章(单官职增设/裁撤不拟)');
assert(sbT3.GM._pendingReforms[0]._charterPending === 10, '拟章戳落账');
sbT3.TM.OfficeCharter.tick(sbT3.GM);
assert(sbT3._jobs.length === 1, '幂等：已在拟不重派');

console.log('③ forgeCharter 子调用(mock AI)');
var sbF = freshSandbox({ charterOn: true, callAI: function (prompt) {
  sbF._prompt = prompt;
  return Promise.resolve({ text: JSON.stringify(RAW) });
} });
var itemF = { _key: 'kf', reformDetail: '增设', dept: '市舶司', reason: '通海贸', status: '拟制中', proposedTurn: 10, _charterPending: 10 };
sbF.GM._pendingReforms.push(itemF);
(async function () {
  var got = await sbF.TM.OfficeCharter.forgeCharter(sbF.GM, itemF);
  assert(!!got && itemF._charter && itemF._charter.name === '市舶提举司', '章程锻成落 item._charter');
  assert(itemF._charterPending === undefined, '拟章戳清除');
  assert(sbF._prompt.indexOf('taxCollect=征税') >= 0 && sbF._prompt.indexOf('正五品') >= 0, 'prompt 携九权词表与本朝品级表');
  assert(sbF._prompt.indexOf('户部') >= 0, 'prompt 携现有衙门(防重名与职掌相侵失察)');
  assert(sbF._ebs.some(function (e) { return e.indexOf('开衙章程已拟') >= 0; }), '章程既拟入起居注');

  console.log('④ 准 band·按章开衙落全结构');
  var sb4 = freshSandbox();
  var GM4 = sb4.GM;
  var it4 = { _key: 'k4', reformDetail: '增设', dept: '市舶司', status: '拟制中', proposedTurn: 8, stalls: 0, _charter: v };
  GM4._pendingReforms.push(it4);
  var res4 = sb4.adjudicatePendingReforms(GM4, { authority: 100 });
  assert(res4.length === 1 && res4[0].band === '准' && res4[0].applied === true, '威权碾压→准行落树');
  var node4 = GM4.officeTree.filter(function (n) { return n.name === '市舶提举司'; })[0];
  assert(!!node4, '正名落定：树上是章程正名(item.dept 同步改)且 it4.dept=' + it4.dept);
  assert(node4 && node4.positions.length === 2, '按章程落两职(非裸壳)');
  var np = node4 && node4.positions[0];
  assert(np && np.establishedCount === 8 && np.vacancyCount === 8 && np.holder === '' && Array.isArray(np.actualHolders), '双层编制模型字段齐全·虚位以待');
  assert(np && np.powers && np.powers.taxCollect === true && np.salary === 76 && np.perPersonSalary.indexOf('76') >= 0, '职权与月俸随章落树(职权舆图/官俸结算自动接手)');
  assert(GM4.guoku.balance === 100000 - 30000 && GM4.guoku.ledgers.money.stock === GM4.guoku.balance, '开办费国库真扣·账本同步');
  assert(Array.isArray(GM4._edictSuggestions) && GM4._edictSuggestions.length === 1 && GM4._edictSuggestions[0].content.indexOf('授钱谷才为') >= 0, '首任荐单入诏书建议库(只荐不任·下旨方成任命)');
  assert(sb4._ebs.some(function (e) { return e.indexOf('诏书建议库') >= 0; }), '荐单入起居注');

  console.log('⑤ 部分 band·打折开衙');
  var sb5 = freshSandbox();
  var ch5 = { name: '织造局', desc: '掌织造', setupCost: 1000, heads: [{ position: '大使', name: '干吏乙', reason: '' }, { position: '织丞', name: '钱谷才', reason: '' }], positions: [
    { name: '大使', rank: '正五品', count: 4, powers: ['works'], authority: 'execution', salary: 38, duties: '' },
    { name: '副使', rank: '正七品', count: 4, powers: [], authority: '', salary: 20, duties: '' },
    { name: '织丞', rank: '正七品', count: 4, powers: [], authority: '', salary: 20, duties: '' },
    { name: '库子', rank: '正七品', count: 4, powers: [], authority: '', salary: 20, duties: '' }
  ] };
  var it5 = { _key: 'k5', reformDetail: '增设', dept: '织造局', status: '拟制中', proposedTurn: 8, stalls: 0, _charter: ch5 };
  sb5.GM._pendingReforms.push(it5);
  var res5 = sb5.adjudicatePendingReforms(sb5.GM, { authority: 0 });
  assert(res5.length === 1 && res5[0].band === '部分' && res5[0].applied === true, '威权不足以碾压→勉强部分得行');
  var node5 = sb5.GM.officeTree.filter(function (n) { return n.name === '织造局'; })[0];
  assert(node5 && node5.positions.length === 2, '部分band：四职打折留两职(主官居首必留)');
  assert(node5 && node5.positions[0].establishedCount === 2, '员额减半 4→2');
  assert(sb5.GM._edictSuggestions && sb5.GM._edictSuggestions.length === 1 && sb5.GM._edictSuggestions[0].content.indexOf('干吏乙') >= 0, '被砍职位(织丞)之荐不入建议库·实落职位(大使)之荐仍入');

  console.log('⑥ 国库闸·帑廪不支改拖·拖满则寝');
  var sb6 = freshSandbox({ balance: 100 });
  var it6 = { _key: 'k6', reformDetail: '增设', dept: '市舶司', status: '拟制中', proposedTurn: 8, stalls: 0, _charter: JSON.parse(JSON.stringify(v)) };
  sb6.GM._pendingReforms.push(it6);
  var res6 = sb6.adjudicatePendingReforms(sb6.GM, { authority: 100 });
  assert(res6.length === 1 && res6[0].band === '拖' && res6[0].guokuShort === true, '裁定虽准·帑廪不支→改拖');
  assert(sb6.GM.officeTree.length === 1 && sb6.GM.guoku.balance === 100, '树不动·银不扣');
  assert(sb6.GM._pendingReforms.length === 1 && it6.stalls === 1, '议留拟制·记一拖');
  assert(sb6._ebs.some(function (e) { return e.indexOf('帑廪不支而缓') >= 0; }), '有司执奏入起居注');
  var res6b = sb6.adjudicatePendingReforms(sb6.GM, { authority: 100 });
  assert(res6b.length === 1 && res6b[0].band === '驳' && it6.status === '驳', '再拖满(2)→其议遂寝');
  assert(sb6.GM.officeTree.length === 1, '寝议不落树');
  var sb6c = freshSandbox({ balance: 100000 });
  var it6c = { _key: 'k6c', reformDetail: '增设', dept: '市舶司', status: '拟制中', proposedTurn: 8, stalls: 1, _charter: JSON.parse(JSON.stringify(v)) };
  sb6c.GM._pendingReforms.push(it6c);
  var res6c = sb6c.adjudicatePendingReforms(sb6c.GM, { authority: 100 });
  assert(res6c[0].band === '准' && sb6c.GM.guoku.balance === 70000, '府库充盈后再裁→照准·开办费实扣');

  console.log('⑦ 双轨·无章程=裸壳(原行为零回归)');
  var sb7 = freshSandbox();
  var it7 = { _key: 'k7', reformDetail: '增设', dept: '宣抚司', status: '拟制中', proposedTurn: 8, stalls: 0 };
  sb7.GM._pendingReforms.push(it7);
  var res7 = sb7.adjudicatePendingReforms(sb7.GM, { authority: 100 });
  var node7 = sb7.GM.officeTree.filter(function (n) { return n.name === '宣抚司'; })[0];
  assert(res7[0].band === '准' && node7 && node7.positions.length === 0, '无章程→裸壳落树(双轨)');
  assert(sb7.GM.guoku.balance === 100000 && !sb7.GM._edictSuggestions, '无章程→不扣开办费·无荐单');

  console.log('⑧ 静态契约·接线到位');
  var idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert(idx.indexOf('tm-office-charter.js') >= 0, 'index.html 装载 tm-office-charter.js');
  var flagsSrc = fs.readFileSync(path.join(ROOT, 'tm-office-flags.js'), 'utf8');
  assert(flagsSrc.indexOf("'officeCharterEnabled'") >= 0, 'officeCharterEnabled 入 OfficeFlags.LIST');
  var patches = fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8');
  assert(patches.indexOf("officeCharterEnabled") >= 0, '设置面板有设衙章程开关行');
  var prompt = fs.readFileSync(path.join(ROOT, 'tm-endturn-prompt.js'), 'utf8');
  assert(prompt.indexOf('_charter') >= 0, '廷议裁定段携章程供 AI 参酌');
  var drawers = fs.readFileSync(path.join(ROOT, 'tm-var-drawers.js'), 'utf8');
  assert(drawers.indexOf('_charter') >= 0, '拟制中抽屉可御览章程');

  console.log('');
  if (failures.length) {
    console.log('FAILURES (' + failures.length + '):');
    failures.forEach(function (f) { console.log('  - ' + f); });
    process.exit(1);
  }
  console.log('smoke-office-charter: ALL PASS');
})().catch(function (e) { console.error('SMOKE CRASH:', e); process.exit(1); });
