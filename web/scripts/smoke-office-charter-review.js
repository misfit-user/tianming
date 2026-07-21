// smoke-office-charter-review.js — 设衙章程批红修改（批二·2026-07-21）
//
// owner 拍板：AI 拟好的章程·进廷议裁定前玩家可批红修改（品级/编制/职权）。
// 批红走 _applyCharterRevision → 整章重过 _validateCharter=同一宪法闸：换品级则月俸随新品级俸
// band 重夹取·员额照夹·职权照滤野键·品级出表的职黜落·荐单过滤到幸存职位·开办费照旧案不可改。
// 已决之议不可批·全职皆废不收(原章程保全)。批红后落树=改定后的结构。
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

function freshSandbox() {
  var sb = { console: console };
  sb.window = sb; sb.global = sb;
  sb._ebs = [];
  sb.addEB = function (cat, msg) { sb._ebs.push(cat + '·' + msg); };
  sb.SettlementPipeline = { register: function () {} };
  sb._activeRankHierarchy = function () { return RANKS; };
  sb.officeFlagOn = function () { return true; };
  sb.GM = {
    turn: 10,
    huangwei: { index: 50 }, huangquan: { index: 50 },
    guoku: { balance: 100000, ledgers: { money: { stock: 100000 } } },
    officeTree: [{ name: '户部', desc: '掌钱谷', positions: [], subs: [], functions: [] }],
    chars: [
      { name: '天子', isPlayer: true, alive: true },
      { name: '钱谷才', alive: true, loyalty: 80, administration: 85 },
      { name: '干吏乙', alive: true, loyalty: 60, administration: 70 }
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

function mkCharter() {
  return {
    name: '市舶提举司', desc: '掌番舶抽解', setupCost: 8000,
    positions: [
      { name: '提举', rank: '正五品', count: 8, powers: ['taxCollect', 'supervise'], authority: 'decision', salary: 76, duties: '总司抽解' },
      { name: '吏目', rank: '正七品', count: 2, powers: [], authority: 'execution', salary: 20, duties: '掌文牍' }
    ],
    heads: [
      { position: '提举', name: '钱谷才', reason: '晓畅钱谷' },
      { position: '吏目', name: '干吏乙', reason: '干练' }
    ]
  };
}
function mkItem(ch) {
  return { _key: 'kR', reformDetail: '增设', dept: '市舶司', status: '拟制中', proposedTurn: 8, stalls: 0, _charter: ch };
}

console.log('① 批红改品级·月俸随新品自正');
var sb = freshSandbox();
var OC = sb.TM.OfficeCharter;
var it = mkItem(mkCharter());
sb.GM._pendingReforms.push(it);
var r1 = OC._applyCharterRevision(sb.GM, it, { positions: [{ name: '提举', rank: '正七品', count: 3, powers: ['taxCollect', 'bogus'] }] });
assert(r1.ok === true, '批红收下');
var p1 = it._charter.positions[0];
assert(p1.rank === '正七品', '品级改定 正五品→正七品');
assert(p1.salary === 40, '月俸 76 越新品级(20)band→重夹取到 40(=20×2)');
assert(p1.count === 3, '员额改定 8→3');
assert(p1.powers.length === 1 && p1.powers[0] === 'taxCollect', '职权照滤野键');
assert(it._charter.positions[1].rank === '正七品' && it._charter.positions[1].count === 2, '未批之职(吏目)原样保全');
assert(it._charterRevised === true, '御笔批红旗竖起');
assert(it._charter.setupCost === 8000, '开办费照旧案(批红不改钱)');
assert(sb._ebs.some(function (e) { return e.indexOf('御笔批红改定') >= 0; }), '批红入起居注');

console.log('② 批红把职改出品级表·该职黜落·荐单随之过滤');
var sb2 = freshSandbox();
var it2 = mkItem(mkCharter());
sb2.GM._pendingReforms.push(it2);
var r2 = OC2ap(sb2, it2, { positions: [{ name: '吏目', rank: '正十三品', count: 2, powers: [] }] });
function OC2ap(s, i, e) { return s.TM.OfficeCharter._applyCharterRevision(s.GM, i, e); }
assert(r2.ok === true && it2._charter.positions.length === 1, '出表之职(吏目)黜落·余职存');
assert(it2._charter.heads.length === 1 && it2._charter.heads[0].name === '钱谷才', '被黜之职的荐单(干吏乙)随之过滤');

console.log('③ 全职皆废不收·原章程保全');
var sb3 = freshSandbox();
var ch3 = mkCharter(); ch3.positions = [ch3.positions[0]];
var it3 = mkItem(ch3);
sb3.GM._pendingReforms.push(it3);
var r3 = sb3.TM.OfficeCharter._applyCharterRevision(sb3.GM, it3, { positions: [{ name: '提举', rank: '正十三品', count: 1, powers: [] }] });
assert(r3.ok === false, '批红后无一职合式→不收');
assert(it3._charter.positions[0].rank === '正五品' && !it3._charterRevised, '原章程保全·批红旗不竖');

console.log('④ 已决之议不可批·无章程不可批');
var sb4 = freshSandbox();
var it4 = mkItem(mkCharter()); it4.status = '准';
assert(sb4.TM.OfficeCharter._applyCharterRevision(sb4.GM, it4, { positions: [] }).ok === false, '已决之议→拒批');
var it4b = { _key: 'x', status: '拟制中' };
assert(sb4.TM.OfficeCharter._applyCharterRevision(sb4.GM, it4b, { positions: [] }).ok === false, '无章程→拒批');

console.log('⑤ 批红后落树=改定结构(全链)');
var sb5 = freshSandbox();
var it5 = mkItem(mkCharter());
sb5.GM._pendingReforms.push(it5);
sb5.TM.OfficeCharter._applyCharterRevision(sb5.GM, it5, { positions: [{ name: '提举', rank: '正三品', count: 1, powers: ['taxCollect', 'supervise', 'judicial'] }] });
var res5 = sb5.adjudicatePendingReforms(sb5.GM, { authority: 100 });
var node5 = sb5.GM.officeTree.filter(function (n) { return n.name === '市舶提举司'; })[0];
assert(res5[0].band === '准' && node5 && node5.positions.length === 2, '批红改定后照准落树');
assert(node5.positions[0].rank === '正三品' && node5.positions[0].establishedCount === 1, '落的是御笔改定之品级与员额');
assert(node5.positions[0].powers && node5.positions[0].powers.judicial === true, '批红增补之职权随树落地');
assert(sb5.GM.guoku.balance === 92000, '开办费仍按旧案 8000 实扣');

console.log('⑥ 陌生职名之批·忽略不炸');
var sb6 = freshSandbox();
var it6 = mkItem(mkCharter());
sb6.GM._pendingReforms.push(it6);
var r6 = sb6.TM.OfficeCharter._applyCharterRevision(sb6.GM, it6, { positions: [{ name: '不存在之职', rank: '正三品', count: 1, powers: [] }] });
assert(r6.ok === true && it6._charter.positions.length === 2 && it6._charter.positions[0].rank === '正五品', '陌生职名忽略·原职原样');

console.log('⑦ 静态契约·接线到位');
var drawers = fs.readFileSync(path.join(ROOT, 'tm-var-drawers.js'), 'utf8');
assert(drawers.indexOf('_charterReviewOpen') >= 0 && drawers.indexOf('批红修改') >= 0, '拟制中抽屉有批红修改钮');
var prompt = fs.readFileSync(path.join(ROOT, 'tm-endturn-prompt.js'), 'utf8');
assert(prompt.indexOf('_charterRevised') >= 0, '廷议裁定段标注御笔批红改定');
var charterSrc = fs.readFileSync(path.join(ROOT, 'tm-office-charter.js'), 'utf8');
assert(charterSrc.indexOf('_applyCharterRevision') >= 0 && charterSrc.indexOf('_charterReviewOpen') >= 0, '批红逻辑与弹窗俱在演绎层模块');

console.log('');
if (failures.length) {
  console.log('FAILURES (' + failures.length + '):');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('smoke-office-charter-review: ALL PASS');
