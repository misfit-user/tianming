/*
 * smoke-globalrules-reback.js — B3c：硬核反噬皇威（走 AuthorityEngines.adjustHuangwei 正道）
 * node scripts/smoke-globalrules-reback.js
 */
global.window = global;

function mockAE() {
  return {
    calls: [], hw: { index: 65 },
    adjustHuangwei: function (source, delta, reason) {
      this.calls.push({ source: source, delta: delta, reason: reason });
      this.hw.index = Math.max(0, Math.min(100, this.hw.index + delta));
      return { ok: true, index: this.hw.index };
    }
  };
}
var GR = require('../tm-globalrules.js');

var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('  ✗ FAIL: ' + m); } }
function setup() { global.GM = { turn: 5, _chronicle: [] }; global.AuthorityEngines = mockAE(); }

// 1·fierce + nascent + 扎根浅 → 损皇威（memorialObjection 源·负 delta）
setup();
GR.register({ name: '骤行新政', tendencies: [{ key: 'reform', label: '骤改', mag: 'major' }],
  resistance: { from: ['士绅', '勋贵'], intensity: 'fierce' } });
GM.turn = 6; GR.tick();
ok(AuthorityEngines.calls.length === 1, 'fierce 浅根之制损皇威一次');
ok(AuthorityEngines.calls[0] && AuthorityEngines.calls[0].source === 'memorialObjection', '走 memorialObjection 抗疏源');
ok(AuthorityEngines.calls[0].delta < 0, '皇威 delta 为负（反噬）');
ok(AuthorityEngines.hw.index < 65, '皇威 index 实降 (now ' + AuthorityEngines.hw.index + ')');

// 2·扎根 ≥ 阈值（朝廷压得住）→ 不损皇威
setup();
GR.register({ name: '渐立之制', tendencies: [{ key: 'a', mag: 'minor' }], strength: 55,
  resistance: { from: ['士绅'], intensity: 'fierce' } });
GM.turn = 6; GR.tick();
ok(AuthorityEngines.calls.length === 0, '扎根≥40 之制不损皇威（朝廷得手）');

// 3·active（非最烈）→ 不损皇威（只走 B3a 阶层承压）
setup();
GR.register({ name: '温和之制', tendencies: [{ key: 'a', mag: 'minor' }],
  resistance: { from: ['士绅'], intensity: 'active' } });
GM.turn = 6; GR.tick();
ok(AuthorityEngines.calls.length === 0, 'active 阻力不损皇威（仅 fierce 触发硬核反噬）');

// 4·entrenched（成风）→ 不损皇威
setup();
GR.register({ name: '已成风', tendencies: [{ key: 'a', mag: 'minor' }], strength: 80,
  resistance: { from: ['士绅'], intensity: 'fierce' } });
GM.turn = 6; GR.tick();
ok(AuthorityEngines.calls.length === 0, 'entrenched 之制不损皇威');

// 5·可规避：扎根抬过阈值 → 反噬停 + 标记复位
setup();
var rr = GR.register({ name: '可救之制', tendencies: [{ key: 'a', mag: 'minor' }],
  resistance: { from: ['士绅'], intensity: 'fierce' } });
GM.turn = 6; GR.tick();
ok(AuthorityEngines.calls.length === 1 && rr._rebackedHw === true, '浅根时反噬中');
rr.strength = 50;   // 玩家加码（多建同类）抬扎根
GM.turn = 7; GR.tick();
ok(AuthorityEngines.calls.length === 1, '扎根抬过阈值后反噬停（可规避·非天降）');
ok(rr._rebackedHw === false, '反噬标记复位');

// 6·无 AuthorityEngines → 不报错
setup(); delete global.AuthorityEngines;
GR.register({ name: '无引擎', tendencies: [{ key: 'a', mag: 'minor' }], resistance: { from: ['士绅'], intensity: 'fierce' } });
GM.turn = 6;
var threw = false; try { GR.tick(); } catch (e) { threw = true; }
ok(!threw, '缺权制引擎 tick 不报错');

console.log('\nsmoke-globalrules-reback: PASS ' + pass + '/' + (pass + fail));
if (fail > 0) process.exit(1);
