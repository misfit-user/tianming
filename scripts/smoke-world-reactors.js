/*
 * smoke-world-reactors.js — 世界反应总线·军事→势力 reactor（W2a）回归
 * node scripts/smoke-world-reactors.js
 */
global.window = global;
var sigLog = [];
global.TM = { SocialPoliticalSignals: { record: function (root, sig) { sigLog.push(sig); return sig; } } };
var WR = require('../tm-world-reactors.js');

var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }
function facs() { return [
  { name: '大明', strength: 60, legitimacy: 70, morale: 55 },
  { name: '后金', strength: 50, legitimacy: 40, morale: 65 }
]; }
function setup(flag) {
  global.GM = { turn: 12, _chronicle: [], facs: facs() };
  global.P = { conf: { worldReactorBattleEnabled: flag === true } };
  sigLog = [];
}

// 1·flag 关（默认）→ 完全 no-op
setup(false);
var r1 = WR.Military.onBattleResolved(GM, { winner: '后金', loser: '大明' });
ok(r1.applied === false && r1.reason === 'disabled', 'flag 关 → disabled no-op');
ok(GM.facs[0].strength === 60 && GM._chronicle.length === 0 && sigLog.length === 0, 'flag 关 → 零副作用');

// 2·flag 开 → 战败方实力损、战胜方升
setup(true);
var r2 = WR.Military.onBattleResolved(GM, { winner: '后金', loser: '大明' });
ok(r2.applied === true, 'flag 开 → applied');
var ming = GM.facs[0], jin = GM.facs[1];
ok(ming.strength === 55 && ming.legitimacy === 67 && ming.morale === 47, '战败方 大明 实力-5/合法-3/士气-8');
ok(jin.strength === 55 && jin.legitimacy === 42, '战胜方 后金 实力+5/合法+2');

// 3·chronicle 联动条目（含「已结算」防双算）→ 进 W1 digest
ok(GM._chronicle.length === 1 && /军事↔势力/.test(GM._chronicle[0].type) && /已结算/.test(GM._chronicle[0].text), 'chronicle 联动条目+已结算标注');
ok(GM._chronicle[0].tags.indexOf('联动') >= 0, 'chronicle 标 联动 tag（被 WorldDigest 收）');

// 4·双算护栏标记
ok(Array.isArray(GM._battleSettledFactions) && GM._battleSettledFactions[0].faction === '大明' && GM._battleSettledFactions[0].strengthDelta === -5, '_battleSettledFactions 标记供 prompt 防双算');

// 5·社政账本 signal
ok(sigLog.length === 1 && sigLog[0].sourceSystem === 'military' && /大明 战败于 后金/.test(sigLog[0].reason), 'record 进社政账本（自动进 digest items）');

// 6·边界：winner===loser / 缺方 → no-wl
setup(true);
ok(WR.Military.onBattleResolved(GM, { winner: '大明', loser: '大明' }).reason === 'no-wl', 'winner===loser 拒');
ok(WR.Military.onBattleResolved(GM, { winner: '后金' }).reason === 'no-wl', '缺 loser 拒');

// 7·实力夹底（不破 0）
setup(true);
GM.facs[0].strength = 2; GM.facs[0].morale = 3;
WR.Military.onBattleResolved(GM, { winner: '后金', loser: '大明' });
ok(GM.facs[0].strength === 0 && GM.facs[0].morale === 0, '战败损耗夹底不破 0');

// 8·找不到势力对象也不报错（只缺方不 applied）
setup(true);
var r8 = WR.Military.onBattleResolved(GM, { winner: '不存在A', loser: '不存在B' });
ok(r8.applied === false, '势力对象不存在 → 不 applied 不报错');

console.log('\nsmoke-world-reactors: PASS ' + pass + '/' + (pass + fail));
if (fail > 0) process.exit(1);
