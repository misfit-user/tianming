// smoke-office-reform-add-overlap.js — 增设抵抗重构·职权重叠具名（批三·2026-07-21）
//
// 此前增设的抵抗=死基础分5——设西厂分走监察权·都察院毫无反应。本批：新衙章程所掌之权
// 与在任官旧掌重叠→旧掌其权者具名入 affected 抵抗(品级份量+重叠权数×perPower+忠诚增减·
// ×addOverlapMul 0.6 摊薄系数·总加成封顶 addOverlapCap 60)。出缺之位无人可抵。
// 双轨：无章程/章程无权→仍是基础分=字节级零回归。
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

var LVL = { '正二品': 3, '正三品': 5, '正七品': 13 };

function freshSandbox() {
  var sb = { console: console };
  sb.window = sb; sb.global = sb;
  sb._ebs = [];
  sb.addEB = function (cat, msg) { sb._ebs.push(cat + '·' + msg); };
  sb.getRankLevel = function (r) { return LVL[r] || 99; };
  sb.GM = {
    turn: 10,
    huangwei: { index: 50 }, huangquan: { index: 50 },
    guoku: { balance: 100000, ledgers: { money: { stock: 100000 } } },
    officeTree: [
      { name: '户部', positions: [
        { name: '尚书', rank: '正三品', holder: '钱谷才', powers: { taxCollect: true, works: true } },
        { name: '主事', rank: '正七品', holder: '小吏', powers: { taxCollect: true } }
      ], subs: [], functions: [] },
      { name: '都察院', positions: [
        { name: '都御史', rank: '正二品', holder: '铁面公', powers: { supervise: true, impeach: true } }
      ], subs: [], functions: [] },
      { name: '刑部', positions: [
        { name: '侍郎', rank: '正三品', holder: '', powers: { judicial: true } }
      ], subs: [], functions: [] }
    ],
    chars: [
      { name: '钱谷才', alive: true, loyalty: 80 },
      { name: '小吏', alive: true, loyalty: 50 },
      { name: '铁面公', alive: true, loyalty: 30 }
    ],
    _pendingReforms: []
  };
  sb.findCharByName = function (n) {
    for (var i = 0; i < sb.GM.chars.length; i++) if (sb.GM.chars[i].name === n) return sb.GM.chars[i];
    return null;
  };
  sb.P = { conf: {} };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-office-reform.js'), 'utf8'), sb, { filename: 'tm-office-reform.js' });
  return sb;
}
function charterWith(powersLists) {
  return { name: '新衙', desc: '', setupCost: 0, heads: [], positions: powersLists.map(function (pw, i) {
    return { name: '职' + i, rank: '正五品', count: 1, powers: pw, authority: '', salary: 38, duties: '' };
  }) };
}

console.log('① 夺征税之权·户部具名抵抗(都察院无涉)');
var sb = freshSandbox();
var rA = sb.computeReformResistance(sb.GM, { reformDetail: '增设', dept: '税课司', _charter: charterWith([['taxCollect']]) }, { authority: 0 });
// 尚书(headMid15+1权10−忠高10=15→×0.6=9) + 主事(0+10=10→6) = +15 → 5+15=20
assert(rA.resistance === 20, '抵抗=基础5+尚书9+主事6=20 (实得' + rA.resistance + ')');
assert(rA.affected.length === 2 && rA.affected.every(function (a) { return a.holder === '钱谷才' || a.holder === '小吏'; }), '具名=旧掌征税者二人·都御史无涉');
assert(rA.affected[0].powersTaken && rA.affected[0].powersTaken.indexOf('taxCollect') >= 0, '记明所夺何权');
assert(rA.band === '拖', 'margin 20·恰入拖档(威权0)');

console.log('② 夺监察之权·怨望重臣抵抗尤烈');
var rB = sb.computeReformResistance(sb.GM, { reformDetail: '增设', dept: '西缉事厂', _charter: charterWith([['supervise']]) }, { authority: 0 });
// 都御史(headHigh30+10+怨望20=60→×0.6=36) → 5+36=41
assert(rB.resistance === 41, '正二品怨望都御史力抵→41 (实得' + rB.resistance + ')');
assert(rB.affected.length === 1 && rB.affected[0].holder === '铁面公', '具名=铁面公一人');
assert(rB.band === '驳', 'margin 41≥40→驳(威权0设西厂难如登天)');

console.log('③ 多权并夺·抵抗累计');
var rC = sb.computeReformResistance(sb.GM, { reformDetail: '增设', dept: '总宪司', _charter: charterWith([['taxCollect', 'supervise'], ['judicial']]) }, { authority: 0 });
// 尚书9+主事6+都御史36=51(judicial 旧掌出缺无人抵) → 56
assert(rC.resistance === 56, '三家并抵=56·出缺之权(刑狱)无人可抵 (实得' + rC.resistance + ')');

console.log('④ 重叠加成封顶(addOverlapCap 60)');
var sb4 = freshSandbox();
for (var x = 0; x < 4; x++) {
  sb4.GM.officeTree[1].positions.push({ name: '佥都御史' + x, rank: '正三品', holder: '怨官' + x, powers: { supervise: true } });
  sb4.GM.chars.push({ name: '怨官' + x, alive: true, loyalty: 20 });
}
var rD = sb4.computeReformResistance(sb4.GM, { reformDetail: '增设', dept: '西缉事厂', _charter: charterWith([['supervise']]) }, { authority: 0 });
// 都御史36+4×(15+10+20=45→27)=144 → 封顶60 → 65
assert(rD.resistance === 65, '满朝御史皆抵仍封顶=5+60 (实得' + rD.resistance + ')');
assert(rD.affected.length === 5, '具名仍全列(封顶只封分不封名)');

console.log('⑤ 双轨零回归');
var rE = sb.computeReformResistance(sb.GM, { reformDetail: '增设', dept: '无章衙门' }, { authority: 0 });
assert(rE.resistance === 5 && rE.affected.length === 0, '无章程→死基础分5(原行为)');
var rF = sb.computeReformResistance(sb.GM, { reformDetail: '增设', dept: '清水衙门', _charter: charterWith([[]]) }, { authority: 0 });
assert(rF.resistance === 5 && rF.affected.length === 0, '章程无权→亦基础分5(不扰民者不遭抵)');

console.log('⑥ 全链·裁定文案具名');
var sb6 = freshSandbox();
var it6 = { _key: 'k', reformDetail: '增设', dept: '西缉事厂', status: '拟制中', proposedTurn: 8, stalls: 0, _charter: charterWith([['supervise']]) };
sb6.GM._pendingReforms.push(it6);
var res6 = sb6.adjudicatePendingReforms(sb6.GM, { authority: 100 });
assert(res6[0].band === '准' && res6[0].applied === true, '威权碾压(100)仍可强行开厂');
assert(sb6._ebs.some(function (e) { return e.indexOf('铁面公') >= 0; }), '裁定起居注具名铁面公(终见裁)');
var sb6b = freshSandbox();
var it6b = { _key: 'k', reformDetail: '增设', dept: '西缉事厂', status: '拟制中', proposedTurn: 8, stalls: 0, _charter: charterWith([['supervise']]) };
sb6b.GM._pendingReforms.push(it6b);
var res6b = sb6b.adjudicatePendingReforms(sb6b.GM, { authority: 10 });
assert(res6b[0].band === '拖' && it6b.status === '拟制中' && it6b.stalls === 1, '威权10→margin 31→拖(为群僚牵延·议留拟制)');
assert(sb6b._ebs.some(function (e) { return e.indexOf('铁面公') >= 0; }), '受阻起居注亦具名铁面公');

console.log('');
if (failures.length) {
  console.log('FAILURES (' + failures.length + '):');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('smoke-office-reform-add-overlap: ALL PASS');
