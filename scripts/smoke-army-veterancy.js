#!/usr/bin/env node
'use strict';
/* smoke-army-veterancy — 战后历练持久化 + 增长/稀释(§12.3·御驾亲征整编屏地基)
 * units[] 历练 = vetFromQuality(quality) 基线 + army.veterancy(累计·持久·封顶90)·纳入 compSig 自愈。
 * 纯逻辑·未活线接入(veterancy 默认0→零行为变更)。 */
const path = require('path');
global.window = {};
const AU = require(path.resolve(__dirname, '..', 'tm-army-units.js'));
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-army-veterancy');

/* ① effectiveVet:基线 + veterancy·封顶90 */
ok(AU.effectiveVet({ quality: '普通' }) === 25, '① 普通·无veterancy→25(基线)');
ok(AU.effectiveVet({ quality: '精锐' }) === 55, '① 精锐→55');
ok(AU.effectiveVet({ quality: '普通', veterancy: 20 }) === 45, '① 普通+veterancy20→45');
ok(AU.effectiveVet({ quality: '精锐', veterancy: 80 }) === 90, '① 精锐+80→封顶90(非135)');

/* ② deriveArmyUnits:veterancy=0→历练=基线(零行为变更)·>0→基线+累计 */
const u0 = AU.deriveArmyUnits({ quality: '普通', composition: [{ type: '长枪兵', count: 1000 }] });
ok(u0[0] && u0[0].历练 === 25, '② veterancy未设→units历练=基线25(★零行为变更)');
const u1 = AU.deriveArmyUnits({ quality: '普通', veterancy: 30, composition: [{ type: '长枪兵', count: 1000 }] });
ok(u1[0] && u1[0].历练 === 55, '② veterancy30→units历练=55(基线+累计)');

/* ③ gainBattleVeterancy:烈度分级 + 递减 + 封顶 + 标脏 */
const easy = { quality: '普通', veterancy: 0 };
const dEasy = AU.gainBattleVeterancy(easy, 0.05);
ok(dEasy >= 2 && dEasy <= 4 && easy.veterancy === dEasy, '③ 轻松仗(减员5%)→小幅增长(~3)·写入veterancy');
ok(easy._unitsStale === true, '③ 增长后标脏(_unitsStale→下次重派)');
const blood = { quality: '普通', veterancy: 0 };
const dBlood = AU.gainBattleVeterancy(blood, 0.6);
ok(dBlood > dEasy, '③ 血战(减员60%)增长 > 轻松仗(烈度+血战加成)');
const vet = { quality: '精锐', veterancy: 30 };   // cur≈85
const dVet = AU.gainBattleVeterancy(vet, 0.6);
const green = { quality: '新募', veterancy: 0 };  // cur=15
const dGreen = AU.gainBattleVeterancy(green, 0.6);
ok(dVet < dGreen, '③ 递减:精锐(历练85)同仗增长 < 新兵(15)·精锐稀有');
const capped = { quality: '精锐', veterancy: 35 }; // effective已90
AU.gainBattleVeterancy(capped, 1);
ok(AU.effectiveVet(capped) === 90, '③ effective历练封顶90·不溢出');

/* ④ diluteVeterancy:新兵稀释老兵(加权平均·老兵金贵) */
const dil = { quality: '精锐', veterancy: 20 };   // oldEff=75
const after = AU.diluteVeterancy(dil, 700, 300);   // (700×75+300×15)/1000=57
ok(after >= 55 && after <= 59, '④ 700老兵(75)+300新兵(15)→稀释到~57');
ok(AU.effectiveVet(dil) < 75, '④ 稀释后有效历练下降(新兵摊薄老兵)');
ok(AU.diluteVeterancy({ quality: '普通', veterancy: 30 }, 1000, 0) === 55, '④ 无新兵→不稀释(返原有效历练55)');

/* ⑤ compSig:veterancy 纳入签名(变则重派·签名自愈) */
const base = { quality: '普通', composition: [{ type: '兵', count: 1000 }] };
const s1 = AU.compSig(Object.assign({}, base, { veterancy: 0 }));
const s2 = AU.compSig(Object.assign({}, base, { veterancy: 10 }));
ok(s1 !== s2, '⑤ veterancy 变→compSig 变→ensure 自动重派');

/* ⑥ 永不崩 */
ok(typeof AU.effectiveVet(null) === 'number', '⑥ effectiveVet(null)不崩');
ok(AU.gainBattleVeterancy(null, 0.5) === 0, '⑥ gainBattleVeterancy(null)→0不崩');
ok(typeof AU.diluteVeterancy(null, 1, 1) === 'number', '⑥ diluteVeterancy(null)不崩');

console.log('\nsmoke-army-veterancy ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
