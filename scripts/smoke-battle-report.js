#!/usr/bin/env node
'use strict';
/* smoke-battle-report — 会战战报小结(整编屏刀5·收口):
 * _collectReport 按战前快照算战损·effectiveVet 历练·主将命运挂首军·全歼标记。模态 showBattleReport headless 跳过(无 DOM)。 */
const path = require('path'), fs = require('fs');
global.window = global;
global.document = { addEventListener: function () {}, readyState: 'complete' };
global.MilitarySystems = { applyBattleResult: function () {} };
const AU = require(path.resolve(__dirname, '..', 'tm-army-units.js'));
const BT = require(path.resolve(__dirname, '..', 'tm-battle-turn.js'));
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-battle-report');

global.GM = {};
const a1 = { id: 'A1', name: '背嵬军', faction: '宋', quality: '精锐', veterancy: 10, soldiers: 700 };  // 战前1000→损300
const a2 = { id: 'A2', name: '踏白军', faction: '宋', quality: '普通', veterancy: 0, soldiers: 0 };    // 全歼
const item = { playerArmies: [a1, a2], battleResult: { commanderFate: { name: '岳飞', outcome: 'survived' } } };
const preS = { A1: 1000, A2: 800 };
const reports = [];
BT._collectReport(reports, item, preS, global.GM);

ok(reports.length === 2, '① 2 军各一条战报');
ok(reports[0].name === '背嵬军' && reports[0].loss === 300 && reports[0].soldiers === 700, '① A1 损300·余700');
ok(reports[0].vet === AU.effectiveVet(a1), '① A1 历练=effectiveVet(精锐55+veterancy10=' + reports[0].vet + ')');
ok(reports[0].destroyed === false, '① A1 未覆没');
ok(reports[1].destroyed === true && reports[1].loss === 800, '② A2 全军覆没·损800');
ok(reports[0].fate && reports[0].fate.name === '岳飞', '③ 主将命运挂首军(岳飞)');
ok(reports[1].fate === null, '③ 余军不重复挂主将命运');

let threw = false;
try { BT._collectReport([], null, {}, {}); BT._collectReport([], { playerArmies: [null] }, null, {}); } catch (e) { threw = true; }
ok(!threw, '④ null item / 空军 不崩');

const src = fs.readFileSync(path.resolve(__dirname, '..', 'tm-battle-turn.js'), 'utf8');
ok(/_collectReport\(reports, item, preS, GM\)/.test(src), '⑤ runPending 收尾调 _collectReport');
ok(/showBattleReport\(reports\)/.test(src), '⑤ runPending 末弹 showBattleReport(战报模态)');

console.log('\nsmoke-battle-report ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
