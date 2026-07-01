/*
 * smoke-globalrules.js — 全局持续规则册（国是·风气）B1 回归
 * node scripts/smoke-globalrules.js
 * 锁死契约：登记/配额裁档/无倾向拒绝/阻力衰减至suppressed/无阻力扎根/
 *          再建提根/promptContext注入/mod按扎根折算/dismiss/entrenched。
 */
global.window = global;
var GR = require('../tm-globalrules.js');

var pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL: ' + msg); } }
function reset(turn) { global.GM = { turn: turn || 5, _chronicle: [] }; }

// 1·基础登记
reset();
var r1 = GR.register({ name: '通商局之制',
  tendencies: [{ key: 'commerce_open', label: '通商', mag: 'moderate' }],
  resistance: { from: ['海禁旧党'], intensity: 'simmering' } });
ok(r1 && r1.name === '通商局之制', '基础登记返回规则');
ok(r1.status === 'nascent' && r1.strength === 12, '初始 nascent / strength=12');

// 2·配额裁档：3×major → 1 major + 2 moderate
reset();
var r2 = GR.register({ name: '实学馆之制',
  tendencies: [
    { key: 'reform_success', mag: 'major' },
    { key: 'tech_promotion', mag: 'major' },
    { key: 'shixue_recognition', mag: 'major' }
  ], resistance: { from: ['士绅'], intensity: 'active' } });
var mags = r2.tendencies.map(function (t) { return t.mag; });
ok(mags.filter(function (m) { return m === 'major'; }).length === 1, '至多 1 条 major');
ok(mags.filter(function (m) { return m === 'moderate'; }).length === 2, '余 major 降为 moderate');

// 2b·TEND_MAX：超 4 条只留 4
reset();
var r2b = GR.register({ name: '多倾向之制', tendencies: [
  { key: 'a', mag: 'minor' }, { key: 'b', mag: 'minor' }, { key: 'c', mag: 'minor' },
  { key: 'd', mag: 'minor' }, { key: 'e', mag: 'minor' }, { key: 'f', mag: 'minor' }
] });
ok(r2b.tendencies.length === 4, '倾向数封顶 4 条');

// 3·无倾向 = 不成规则
reset();
var r3 = GR.register({ name: '空制', tendencies: [] });
ok(r3 === null, '无倾向规则被拒（返回 null）');

// 4·active 阻力净衰减至 suppressed（drag5 > gain3）
reset();
GR.register({ name: 'X', tendencies: [{ key: 'a', mag: 'minor' }], resistance: { from: ['s'], intensity: 'active' } });
var rx = GR.find('X');
for (var i = 0; i < 7; i++) { GM.turn = 6 + i; GR.tick(); }
ok(rx.strength === 0 && rx.status === 'suppressed', 'active 阻力 7 回合后 suppressed');

// 5·无阻力自然扎根（gain3）
reset();
GR.register({ name: 'Y', tendencies: [{ key: 'b', mag: 'minor' }] });
var ry = GR.find('Y'); var y0 = ry.strength;
GM.turn = 6; GR.tick();
ok(ry.strength === y0 + 3, '无阻力规则每回合 +3 扎根');

// 5b·entrenched 阶段（strength >= 70）
reset();
GR.register({ name: 'Z', tendencies: [{ key: 'c', mag: 'minor' }], strength: 66 });
var rz = GR.find('Z'); GM.turn = 6; GR.tick(); // 66+3=69 仍 established
GM.turn = 7; GR.tick(); // 72 → entrenched
ok(rz.status === 'entrenched', 'strength≥70 进 entrenched');

// 6·再建同类提扎根 +8、不重复立
reset();
GR.register({ name: 'W', tendencies: [{ key: 'd', mag: 'minor' }] });
var before = GR.find('W').strength;
GR.register({ name: 'W', tendencies: [{ key: 'd', mag: 'minor' }] });
ok(GR.list().filter(function (r) { return r.name === 'W'; }).length === 1, '同名不重复立');
ok(GR.find('W').strength === before + 8, '再建同类 +8 扎根');

// 7·promptContext 含规则+阻力，排除 suppressed
reset();
GR.register({ name: '实学馆之制', tendencies: [{ key: 'reform_success', label: '改革推行', mag: 'moderate' }], resistance: { from: ['士绅'], intensity: 'active' } });
var ctx = GR.promptContext();
ok(ctx.indexOf('实学馆之制') >= 0 && ctx.indexOf('改革推行') >= 0, 'promptContext 含规则与倾向');
ok(ctx.indexOf('士绅') >= 0, 'promptContext 含阻力来源');
reset();
GR.register({ name: 'S', tendencies: [{ key: 'a', mag: 'minor' }], resistance: { from: ['t'], intensity: 'active' } });
for (var j = 0; j < 7; j++) { GM.turn = 6 + j; GR.tick(); }
ok(GR.promptContext().indexOf('S（') < 0, 'suppressed 规则不再注入推演');

// 8·mod 按扎根折算、suppressed 排除
reset();
GR.register({ name: 'M', tendencies: [{ key: 'reform_success', label: '改革', mag: 'moderate' }] });
ok(GR.mod('reform_success') > 0, 'mod 返回正值');
ok(GR.mod('nonexistent_key') === 0, '无匹配倾向 mod=0');

// 9·dismiss 移除
reset();
GR.register({ name: 'D', tendencies: [{ key: 'a', mag: 'minor' }] });
ok(GR.dismiss('D') === true && GR.find('D') == null, 'dismiss 移除规则');
ok(GR.dismiss('不存在') === false, 'dismiss 不存在返回 false');

console.log('\nsmoke-globalrules: PASS ' + pass + '/' + (pass + fail));
if (fail > 0) process.exit(1);
