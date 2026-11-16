/* smoke-renli-weather-disaster.js — 刀一·天时→粮产直连（激活灾害触发粮荒）
 * 验：① RegionStatus 灾异(econPct 负)→ r.weather 下降 ② carryingCapacity.climate 小冰期→下降 ③ 全国 disasterLevel→下降
 *   ④ 低 weather→粮产更低(端到端·灾害真减收成→喂刀A/刀B 粮荒链) ⑤ 无灾→weather 恒 1.0(inert) ⑥ clamp[0.3,1.3]
 *   ⑦ 门控种子省(未种子不写) ⑧ 装配(tick 前填天时)/导出 ⑨ 中立
 * 跑：node scripts/smoke-renli-weather-disaster.js
 */
'use strict';
var pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.error('  ✗ ' + m); } }
function near(a, b, e) { return Math.abs(Number(a) - Number(b)) <= (e == null ? 0.01 : e); }

global.TM = global.TM || {};
global.TM.ClassEngine = { gateSatisfaction: function (r, c, raw) { var d = Math.max(-14, Math.min(14, raw)); c.satisfaction += d; return { approved: d }; } };
var R = require('../tm-renli.js');

function build(opts) {
  opts = opts || {};
  var leaf = { id: 'div_xa', name: '西安府', renliSeed: { soilBase: 65, waterworks: 50, doubleCropping: 1.0, laborMarketDepth: 0.2 },
    economyBase: { farmland: 2000000 }, populationDetail: { mouths: 3000000, households: 600000, ding: 600000, registeredDing: 600000 } };
  if (opts.climate != null) leaf.carryingCapacity = { climate: opts.climate };
  if (opts.disasterEconPct != null) leaf.statusEffects = [{ kind: 'disaster', name: '大旱', econPct: opts.disasterEconPct }];
  var P = { adminHierarchy: { player: { divisions: [leaf] } } };
  var GM = { turn: 3, sid: 's', classes: [{ name: '农户', economicRole: '生产', satisfaction: 60, regionalVariants: [] }], renli: { byRegion: {}, reported: {} } };
  if (opts.disasterLevel != null) GM.vars = { disasterLevel: opts.disasterLevel };
  global.P = P; R.ensureDefaults(GM, P);
  return { P: P, GM: GM, leaf: leaf };
}

// ── T1 本地灾异→weather 下降 ──
var a = build({ disasterEconPct: -0.2 });
R.refreshWeather(a.GM, a.P);
// disasterDrag=-0.2*1.5=-0.3 → weather=1-0.3=0.70
ok(near(R.getRegion(a.GM, 'div_xa').weather, 0.70), '1·大旱(econPct-0.2)→r.weather 0.70(合设计§4.3 大旱档)·实得 ' + R.getRegion(a.GM, 'div_xa').weather);

// ── T2 小冰期 climate→下降 ──
var b = build({ climate: 0.78 });
R.refreshWeather(b.GM, b.P);
// climateAdj=(0.78-1)*0.3=-0.066 → weather=0.93
ok(near(R.getRegion(b.GM, 'div_xa').weather, 0.93), '2·小冰期(climate0.78)→weather 0.93(慢拖累)·实得 ' + R.getRegion(b.GM, 'div_xa').weather);

// ── T3 全国 disasterLevel→下降 ──
var c = build({ disasterLevel: 0.5 });
R.refreshWeather(c.GM, c.P);
// natDrag=-clamp(0.5*0.2)=-0.1 → weather=0.90
ok(near(R.getRegion(c.GM, 'div_xa').weather, 0.90), '3·国难 disasterLevel0.5→weather 0.90·实得 ' + R.getRegion(c.GM, 'div_xa').weather);

// ── T4 三源叠加 + clamp 下限 ──
var d = build({ disasterEconPct: -0.25, climate: 0.45, disasterLevel: 1.0 });
R.refreshWeather(d.GM, d.P);
// -0.25*1.5=-0.375 ; (0.45-1)*0.3=-0.165 clamp→-0.165 ; -0.2 ; sum=1-0.375-0.165-0.2=0.26 → clamp 0.3
ok(near(R.getRegion(d.GM, 'div_xa').weather, 0.30), '4·极灾叠加→weather 夹下限 0.30(不破)·实得 ' + R.getRegion(d.GM, 'div_xa').weather);

// ── T5 无灾→weather 1.0(inert·行为不变) ──
var e = build({});
R.refreshWeather(e.GM, e.P);
ok(near(R.getRegion(e.GM, 'div_xa').weather, 1.0), '5·无灾无小冰期无国难→weather 1.0(inert)·实得 ' + R.getRegion(e.GM, 'div_xa').weather);

// ── T6 端到端：灾害真减粮产（喂刀A/刀B 粮荒链）──
var dis = build({ disasterEconPct: -0.2 }); R.endturnTick(dis.GM, dis.P);
var nrm = build({}); R.endturnTick(nrm.GM, nrm.P);
var gd = R.getRegion(dis.GM, 'div_xa').grainOutput, gn = R.getRegion(nrm.GM, 'div_xa').grainOutput;
ok(gd > 0 && gn > 0 && gd < gn, '6·大旱省粮产 < 常年省(' + gd + ' < ' + gn + ')·灾害真减收成');
ok(near(gd / gn, 0.70, 0.05), '6·粮产比≈weather比0.70(天时因子线性入粮产公式)·实得 ' + (gd / gn).toFixed(3));
ok(R.getRegion(dis.GM, 'div_xa').foodDeficit >= R.getRegion(nrm.GM, 'div_xa').foodDeficit, '6·大旱→缺粮≥常年(粮荒链被灾害点燃)');

// ── T7 门控种子省（未种子叶不写 weather）──
var f = build({ disasterEconPct: -0.2 }); delete f.leaf.renliSeed; R.ensureDefaults(f.GM, f.P);
var rf = R.getRegion(f.GM, 'div_xa');
R.refreshWeather(f.GM, f.P);
ok(!rf || rf.weather == null || rf.weather === undefined, '7·未种子省→refreshWeather 不写其 weather(inert)');

// ── T8 装配/导出 + T9 中立 ──
var fs = require('fs'), path = require('path');
ok(typeof R.refreshWeather === 'function', '8·导出 refreshWeather');
var src = fs.readFileSync(path.join(__dirname, '..', 'tm-renli.js'), 'utf8');
var body = src.slice(src.indexOf('function refreshWeather'), src.indexOf('function refreshWeather') + 1200);
ok(!/天启|陕西|西安|sc-tianqi/.test(body), '9·refreshWeather 无朝代/地名硬编（中立）');

console.log('\n[smoke-renli-weather-disaster] ' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) { console.error('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
