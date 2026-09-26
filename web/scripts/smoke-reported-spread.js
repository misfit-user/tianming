#!/usr/bin/env node
'use strict';
/* smoke-reported-spread — 失真层S3b-S7铺面契约：
 * S3b 舆图(mood民心good/office浊度bad/owner-tip同键)+纲纪满意度三处同键·
 * S4 顶栏户口national.*全bad+方志户口志hover收严/役政志翻转·
 * S5 军额soldiers据奏(military分部门+统帅handler)·
 * S6 揭真三通道(核饷hexiang/查案audit/密报mishu)·
 * S7 奏疏AI据奏口径(税压bad/危机省据奏过滤/口径指令)。 */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-reported-spread');

const map = fs.readFileSync(path.join(ROOT, 'phase8-formal-map.js'), 'utf8');
const dossier = fs.readFileSync(path.join(ROOT, 'phase8-formal-map-dossier.js'), 'utf8');
const rail = fs.readFileSync(path.join(ROOT, 'phase8-formal-rightrail.js'), 'utf8');   // 家族契约序：rightrail 先于 -social(lint-smoke-family-order)
const social = fs.readFileSync(path.join(ROOT, 'phase8-formal-rightrail-social.js'), 'utf8');
const topbar = fs.readFileSync(path.join(ROOT, 'tm-topbar-vars.js'), 'utf8');
const audit = fs.readFileSync(path.join(ROOT, 'tm-audit.js'), 'utf8');
const renli = fs.readFileSync(path.join(ROOT, 'tm-renli.js'), 'utf8');
const memorials = fs.readFileSync(path.join(ROOT, 'tm-memorials.js'), 'utf8');

// ── S3b 舆图 ──
ok(/function mapReported\(/.test(map) && /RV\.active/.test(map.match(/function mapReported\([\s\S]{0,400}/)[0]), 'S3b① 舆图 mapReported 接引擎·inactive直通');
ok(/base = mapReported\('minxin', r, base, 'good'\)/.test(map), 'S3b② mood热力 base民心据奏good(民变/战区扣分不失真)');
ok(/corr = mapReported\('corruption', r, corr, 'bad'\)/.test(map), 'S3b③ office热力 浊度据奏bad(瞒减显清明)');
// 签注（tip）在通志一期 S3 迁入 phase8-formal-map-dossier.js
ok(/_tipRow\('民心', mapReported\('minxin', r,/.test(dossier), 'S3b④ 势力tip民心行同键包裹(与热力不穿帮)');
// ── S3b 纲纪 ──
ok(/function rightSocSatReported\(/.test(social) && /'class\.' \+ rightSocialName\(c\)/.test(social), 'S3b⑤ 阶层满意度据奏·键=class.+阶层名');
ok((social.match(/rightSocSatReported\(c, rightSocNum\(/g) || []).length >= 3, 'S3b⑥ head/detail/均值三处全走同一helper');

// ── S4 户口/役政 ──
["national.mouths", "national.households", "national.ding", "national.fugitives", "national.hidden"].forEach(function (k) {
  ok(new RegExp("'" + k.replace('.', '\\.') + "'[^\\n]*'bad', 'renli'").test(topbar), 'S4① 顶栏户口 ' + k + ' 据奏bad(黄册历来少报)');
});
ok(/黄册所载皆有司之奏/.test(topbar), 'S4② 顶栏户口失真时注明口径');
ok(/_veiled[\s\S]{0,200}真丁口须遣员核查/.test(dossier), 'S4③ 户口志hover收严：未揭不泄真丁口与瞒报%');
ok(/_veiledY[\s\S]{0,260}诸数皆有司口径/.test(dossier) && /瞒报~/.test(dossier), 'S4④ 役政志翻转：未揭升主口径不泄瞒报%·已揭照旧对照');

// ── S5 军额 ──
const soldiersFn = rail.match(/function rightArmySoldiers\(a\)\{[\s\S]{0,900}?\n  \}/)[0];
ok(/'soldiers\.' \+ String/.test(soldiersFn) && /direction: 'good'/.test(soldiersFn) && /dept: 'military'/.test(soldiersFn), 'S5① 名册据奏名员=虚增·军队分部门吏治面');
ok(/handler = findCharByName\(cn\)/.test(soldiersFn), 'S5② 统帅忠诚点因子(拍板③·直臣治军虚额少)');
ok(/RV\.active\(window\.P \|\| null\)\) return t;/.test(soldiersFn), 'S5③ 未开失真层=真值直通');

// ── S6 揭真通道 ──
ok(/reveal\('army', 'soldiers\.'[^\n]*'hexiang'\)/.test(rail) && /cmd === 'pay'/.test(rail), 'S6① 核饷=点验揭该军实额');
ok(/reveal\('corruption', 'index', 'audit'\)/.test(audit) && /reveal\('renli', 'region\.' \+ audit\.region/.test(audit), 'S6② 查案成功掀吏治/民情/当地据奏');
ok(/reveal\('renli', 'region\.' \+ c\.rid, 'mishu'\)/.test(renli) && /reveal\('minxin', 'region\.' \+ c\.rid, 'mishu'\)/.test(renli), 'S6③ 门生密报掀该地役政/民情');

// ── S7 奏疏AI口径 ──
ok(/_s7on = !!\(_rvS7 && _rvS7\.active\(P\)\)/.test(memorials), 'S7① 奏疏侧 gate 同双闸');
ok(/'fiscal', 'taxPressure'[^\n]*direction: 'bad'/.test(memorials), 'S7② 税压据奏bad');
ok(/_s7\(e\[0\] \+ '\.unrest', e\[1\]\.unrest, 'bad'\)/.test(memorials) && /\.filter\(function\(e\)\{return e\[1\]\.unrest>40/.test(memorials), 'S7③ 危机省先据奏再过阈值(粉饰致该奏不奏·揭真可破)');
ok(/【奏报口径】/.test(memorials) && /不得道出官账之外的实情/.test(memorials), 'S7④ 口径指令入prompt');

// ── 行为抽验：军额 handler 点因子端到端(引擎真跑) ──
global.window = global;
global.GM = { sid: 's', turn: 3, corruption: { trueIndex: 50, subDepts: { military: { true: 80 } } } };
global.P = { conf: { gameMode: 'strict_hist', reportedViewEnabled: true } };
const RV = require('../tm-reported-view.js');
const loyal = RV.value('army', 'soldiers.京营', 60000, { direction: 'good', dept: 'military', handler: { loyalty: 90 } });
const traitor = RV.value('army', 'soldiers.京营', 60000, { direction: 'good', dept: 'military', handler: { loyalty: 20 } });
ok(loyal.shown >= 60000 && traitor.shown > loyal.shown, '行为① 名员虚增·离心将领吃饷狠于直臣(' + loyal.shown + '<' + traitor.shown + ')');
RV.reveal('army', 'soldiers.京营', 'hexiang');
ok(RV.value('army', 'soldiers.京营', 60000, { direction: 'good', dept: 'military' }).shown === 60000, '行为② 核饷揭后显实额');

console.log('\nsmoke-reported-spread ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
