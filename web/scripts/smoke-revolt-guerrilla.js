#!/usr/bin/env node
'use strict';
// smoke-revolt-guerrilla — 民变重做·民2c 游击的连带（施工单民2c；minbian.md「新的样子」二）
//
// 一、民变案落地的民变（source 'revolt-cases'）在它那一州每回合落真账（tm-revolt-guerrilla.js）：
//     地块状态「某股盘踞」（风云，经济折＝征收打折，按人数占口数 5%～25%）；驿路阻断一州一条（带州编号）；
//     户口逃散（在籍挪进逃户，口数不变）；本州民心记一笔「某股盘踞」（治安）。同一回合只落一次；这股了结了，
//     下一回合状态撤、驿路复通，复通的留几回合再清。旧式民变不归这里。
// 二、驿路阻断认州（tm-hongyan-office.js _ltIsRouteBlocked）：人物所在地「陕西·延安」「陕西延安府·延绥镇军营」落到延安府就算；
//     只说到省的「陕北」不算；主推演写的阻断照旧按字面。
// 三、地名认州先遮省名（tm-revolt-cases.js placeLeaf）：「陕西安塞」不再认作西安府；括注是按语不认（「银川驿(学界或作甘州驿)」不是甘州卫）。
// 四、顺带的三处：从乱同逃户不纳粮（tm-field-pipelines.js fleeTaxPenalty）；复通的驿路不再当未了的事立案（tm-matters.js）；
//     「民变扰攘」不再套到民变案的民变上（tm-class-mobility.js）。
// 五、接线：过回合 6.146 在民变案判定之后调；index.html 紧跟 tm-revolt-rising.js 装载。
// 真跑 tm-region-status.js、tm-minxin-ledger.js、tm-revolt-cases.js、tm-revolt-rising.js、tm-revolt-guerrilla.js、tm-field-pipelines.js、
// tm-matters.js、tm-class-mobility.js；_ltIsRouteBlocked 从 tm-hongyan-office.js 原样抽出来跑。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(WEB, f), 'utf8');
let checks = 0;
const failed = [];
function ok(v, m) { if (!v) throw new Error(m); checks++; }
function part(name, fn) {
  try { fn(); console.log('  ✓ ' + name); }
  catch (e) { failed.push(name); console.log('  ✗ ' + name + '：' + String((e && e.message) || e).slice(0, 300)); }
}

function sandbox(files) {
  const events = [];
  const c = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set, WeakMap, isFinite, parseInt, parseFloat,
    addEB: (...a) => events.push(a) };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  files.forEach((f) => vm.runInContext(read(f), c, { filename: f }));
  c.__events = events;
  return c;
}
const CORE = ['tm-region-status.js', 'tm-minxin-ledger.js', 'tm-revolt-cases.js', 'tm-revolt-rising.js', 'tm-revolt-guerrilla.js'];

function leaf(id, name, mouths, fugitives, extra) {
  return Object.assign({ id: id, name: name, minxin: 30, populationDetail: { mouths: mouths, fugitives: fugitives, hiddenCount: 0, rebels: 0 } }, extra || {});
}
function band(extra) {
  return Object.assign({ id: 'rv-d-yanan-t5', turn: 5, region: '延安府', divisionId: 'd-yanan', province: '陕西布政使司', status: 'ongoing',
    level: 2, form: 'guerrilla', scale: 9000, followers: 9000, leaderId: 'c-wang', leaderName: '王二', caseId: 'rc-d-yanan-t5', source: 'revolt-cases' }, extra || {});
}
function world() {
  const yanan = leaf('d-yanan', '延安府', 300000, 20000);
  yanan.populationDetail.rebels = 9000;
  return {
    turn: 6, _campaignId: 'camp-2c',
    adminHierarchy: { player: { divisions: [
      { id: 'p-sx', name: '陕西布政使司', children: [yanan, leaf('d-xian', '西安府', 1200000, 30000, { minxin: 40 }), leaf('d-yulin', '榆林镇', 200000, 10000, { minxin: 25 })] },
      { id: 'p-hn', name: '河南布政使司', children: [leaf('d-kf', '开封府', 900000, 5000)] }
    ] } },
    minxin: { trueIndex: 30, sources: {}, revolts: [band(), { id: 'old-1', region: '开封府', status: 'ongoing', level: 3, scale: 30000 }] },
    revoltCases: { v: 1, cases: [{ id: 'rc-d-yanan-t5', divisionId: 'd-yanan', name: '延安府', status: 'risen', revoltId: 'rv-d-yanan-t5', history: [] }], lastTick: 6 },
    chars: [{ id: 'c-wang', name: '王二', alive: true, location: '延安府' }]
  };
}
function leafOf(G, id) {
  let hit = null;
  (function walk(ns) { (ns || []).forEach((n) => { if (n.id === id) hit = n; walk(n.children); }); })(G.adminHierarchy.player.divisions);
  return hit;
}
const holds = (L) => (L.statusEffects || []).filter((e) => e && e.source === 'revolt-hold');
const myRoutes = (G) => (G._routeDisruptions || []).filter((d) => d && d.source === 'revolt-hold');

console.log('smoke-revolt-guerrilla — 民2c 游击的连带');

// ── 一、民变案落地的民变在它那一州落真账 ──
part('一·盘踞、征收打折、驿路、逃散、本州民心按真数落；旧式民变不归这里', () => {
  const c = sandbox(CORE);
  const G = world(); c.GM = G;
  const r = c.TM.RevoltGuerrilla.tick(G, { turn: 6, monthRatio: 1 });
  ok(r && r.holds === 1, '一州盘踞（实得 ' + JSON.stringify(r) + '）');
  const L = leafOf(G, 'd-yanan');
  const h = holds(L);
  // 九千人占三十万口的 3%，到 5% 记满：分量 0.6 → 折 5% + 20%×0.6 = 17%
  ok(h.length === 1 && h[0].name === '王二一股盘踞' && h[0].kind === 'event', '地块状态「王二一股盘踞」（风云）：' + JSON.stringify(h));
  ok(Math.abs(h[0].econPct + 0.17) < 1e-9 && h[0].minxinPerTurn === 0, '经济折 −17%、状态本身不扣民心（民心走账本）：' + h[0].econPct);
  ok(/众约 9000/.test(h[0].desc) && /17%/.test(h[0].desc), '状态说明写着众数与折数：' + h[0].desc);
  ok(Math.abs(c.TM.RegionStatus.econMult(L) - 0.83) < 1e-9, '算税读的地块乘子 0.83：' + c.TM.RegionStatus.econMult(L));
  // 在籍＝口数−逃户−从乱−隐户＝271000；逃散＝min(9000×0.1, 271000×1%)＝900，挪进逃户，口数不变
  ok(L.populationDetail.fugitives === 20900 && L.populationDetail.mouths === 300000, '户口逃散 900 进逃户、口数不变：' + JSON.stringify(L.populationDetail));
  ok(L.minxin === 29.32, '本州民心 −(0.2+0.8×0.6)＝−0.68 → 29.32：' + L.minxin);
  ok(leafOf(G, 'd-xian').minxin === 40 && leafOf(G, 'd-kf').minxin === 30, '别州不动（邻州走「民变不宁」，不在这里）');
  const rd = myRoutes(G);
  ok(rd.length === 1 && rd[0].divisionId === 'd-yanan' && rd[0].route === '延安府驿路' && rd[0].resolved === false && /王二一股盘踞/.test(rd[0].reason), '驿路阻断一条、带州编号：' + JSON.stringify(rd));
  ok(c.__events.some((e) => e[0] === '传书' && /驿路阻断：延安府驿路/.test(e[1])), '邸报·驿路阻断（真记了一条才报）');
  const rv = G.minxin.revolts[0];
  ok(rv.guerrilla && rv.guerrilla.fled === 900 && rv.guerrilla.fledTotal === 900 && rv.guerrilla.cut === 0.17 && rv.guerrilla.minxin === -0.68, '这股记下这回合落了什么：' + JSON.stringify(rv.guerrilla));
  ok(holds(leafOf(G, 'd-kf')).length === 0 && !myRoutes(G).some((d) => d.divisionId === 'd-kf'), '旧式民变（开封府）不归这里');
  // 同一回合再跑：不重扣
  c.TM.RevoltGuerrilla.tick(G, { turn: 6, monthRatio: 1 });
  ok(L.populationDetail.fugitives === 20900 && L.minxin === 29.32 && myRoutes(G).length === 1 && holds(L).length === 1, '同一回合只落一次');
  // 下一回合：同名状态只改数、不重立；接着逃散
  G.turn = 7;
  c.TM.RevoltGuerrilla.tick(G, { turn: 7, monthRatio: 1 });
  ok(holds(L).length === 1 && holds(L)[0].expiresTurn === 9, '同名状态续期、不重立：' + JSON.stringify(holds(L)));
  ok(L.populationDetail.fugitives === 21800 && rv.guerrilla.fledTotal === 1800, '第二回合再逃 900：' + L.populationDetail.fugitives);
  ok(myRoutes(G).length === 1, '驿路阻断不重记');
  // 两月一回合：逃散、民心都按月数
  const G2 = world(); c.GM = G2;
  c.TM.RevoltGuerrilla.tick(G2, { turn: 6, monthRatio: 2 });
  ok(leafOf(G2, 'd-yanan').populationDetail.fugitives === 21800 && leafOf(G2, 'd-yanan').minxin === 28.64, '两月一回合：逃 1800、民心 −1.36');
});

part('一·这股了结：状态撤、驿路复通、复通的留六回合再清；换了首领撤旧立新；同州两股合记', () => {
  const c = sandbox(CORE);
  const G = world(); c.GM = G;
  c.TM.RevoltGuerrilla.tick(G, { turn: 6, monthRatio: 1 });
  const L = leafOf(G, 'd-yanan');
  // 换首领（民2d 首领被擒、骨干接手时会这样）：撤旧立新，只留一条
  G.minxin.revolts[0].leaderName = '种光道'; G.turn = 7;
  c.TM.RevoltGuerrilla.tick(G, { turn: 7, monthRatio: 1 });
  ok(holds(L).length === 1 && holds(L)[0].name === '种光道一股盘踞', '换了首领：撤旧立新：' + JSON.stringify(holds(L).map((e) => e.name)));
  // 同州又一股（旧档、重报）：合记
  G.minxin.revolts.push(band({ id: 'rv-x', leaderName: '高迎祥', followers: 6000, scale: 6000 })); G.turn = 8;
  c.TM.RevoltGuerrilla.tick(G, { turn: 8, monthRatio: 1 });
  ok(holds(L).length === 1 && holds(L)[0].name === '种光道等2股盘踞' && /众约 15000/.test(holds(L)[0].desc), '同州两股合记：' + JSON.stringify(holds(L)));
  ok(myRoutes(G).length === 1 && myRoutes(G)[0].revoltIds.length === 2, '驿路一州一条，记着两股');
  // 了结
  G.minxin.revolts.forEach((r) => { if (r.source === 'revolt-cases') r.status = 'suppressed'; }); G.turn = 9;
  const fug = L.populationDetail.fugitives, mx = L.minxin;
  c.TM.RevoltGuerrilla.tick(G, { turn: 9, monthRatio: 1 });
  ok(holds(L).length === 0, '了结：地块状态撤掉');
  ok(c.TM.RegionStatus.econMult(L) === 1, '了结：征收不再打折');
  const rd = myRoutes(G)[0];
  ok(rd && rd.resolved === true && rd.status === 'resolved' && rd.resolvedTurn === 9, '了结：驿路复通：' + JSON.stringify(rd));
  ok(c.__events.some((e) => e[0] === '传书' && /驿路复通：延安府驿路/.test(e[1])), '邸报·驿路复通');
  ok(L.populationDetail.fugitives === fug && L.minxin === mx, '了结：不再逃散、不再扣民心');
  G.turn = 15; c.TM.RevoltGuerrilla.tick(G, { turn: 15, monthRatio: 1 });
  ok(myRoutes(G).length === 1, '复通的留着（六回合内）');
  G.turn = 16; c.TM.RevoltGuerrilla.tick(G, { turn: 16, monthRatio: 1 });
  ok(myRoutes(G).length === 0, '复通满六回合清掉');
  // 主推演写的阻断不动
  const G3 = world(); c.GM = G3;
  G3._routeDisruptions = [{ route: '京师-宣府', from: '京师', to: '宣府', reason: '虏骑', resolved: false, turn: 2 }];
  c.TM.RevoltGuerrilla.tick(G3, { turn: 6, monthRatio: 1 });
  ok(G3._routeDisruptions.length === 2 && G3._routeDisruptions[0].route === '京师-宣府' && G3._routeDisruptions[0].resolved === false, '主推演写的阻断不动');
});

// ── 二、驿路阻断认州 ──
function extractFn(src, name) {
  const at = src.indexOf('function ' + name + '(');
  if (at < 0) throw new Error('抽不到 ' + name);
  let i = src.indexOf('{', at), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  throw new Error(name + ' 花括号不配');
}
part('二·书信、奏疏两头的所在地落到那一州就算阻断；只说到省的不算；主推演写的照旧按字面', () => {
  const c = sandbox(CORE);
  const G = world(); c.GM = G;
  const blocked = vm.runInContext(extractFn(read('tm-hongyan-office.js'), '_ltIsRouteBlocked') + '; _ltIsRouteBlocked', c);
  c.TM.RevoltGuerrilla.tick(G, { turn: 6, monthRatio: 1 });
  ok(blocked('京师·紫禁城·乾清宫', '陕西·延安') === true, '「陕西·延安」落到延安府：阻断');
  ok(blocked('陕西延安府·延绥镇军营', '北京') === true, '「陕西延安府·延绥镇军营」：阻断');
  ok(blocked('京师', '延安府') === true, '州名本身：阻断');
  ok(blocked('京师', '陕西·固原(三边总督驻地)') === false, '同省别州：不阻断');
  ok(blocked('京师', '陕北') === false, '只说到省的「陕北」：不算');
  ok(blocked('京师', '') === false && blocked('京师', undefined) === false, '没有所在地：不算');
  // 西安府有一股时，「陕西安塞」不能认成西安府（省名遮掉再认州）
  G.minxin.revolts[0].status = 'suppressed'; G.minxin.revolts.push(band({ id: 'rv-xa', divisionId: 'd-xian', region: '西安府', leaderName: '李甲' }));
  G.turn = 7; c.TM.RevoltGuerrilla.tick(G, { turn: 7, monthRatio: 1 });
  ok(blocked('京师', '西安') === true, '「西安」落到西安府：阻断');
  ok(blocked('京师', '陕西安塞') === false, '「陕西安塞」不是西安府：不阻断');
  ok(blocked('京师', '陕西·延安') === false, '延安那股了结、驿路复通：不阻断');
  // 主推演写的阻断照旧按字面
  G._routeDisruptions.push({ route: '京师-宣府', from: '京师', to: '宣府', reason: '虏骑', resolved: false, turn: 2 });
  ok(blocked('大同', '宣府') === true && blocked('大同', '宣府镇城') === false, '主推演写的：照旧按字面');
});

// ── 三、地名认州先遮省名 ──
part('三·「陕西安塞」不认作西安府；括注不认；点名到州的照认', () => {
  const c = sandbox(CORE);
  const G = world(); c.GM = G;
  const RC = c.TM.RevoltCases;
  ok(RC.placeLeaf(G, '陕西安塞') === null, '「陕西安塞」点不到州');
  ok(RC.placeLeaf(G, '陕西西安府').node.id === 'd-xian', '「陕西西安府」→西安府');
  ok(RC.placeLeaf(G, '陕西延安府澄城县').node.id === 'd-yanan', '「陕西延安府澄城县」→延安府');
  ok(RC.placeLeaf(G, '延绥·榆林').node.id === 'd-yulin', '「延绥·榆林」→榆林镇');
  ok(RC.placeLeaf(G, '陕北') === null, '「陕北」只说到省');
  // 括注是按语不是地名（天启档李自成所在地「陕西米脂·银川驿(学界或作甘州驿)」曾被认作甘州卫）
  ok(RC.placeLeaf(G, '陕西米脂·银川驿(学界或作榆林驿)') === null, '括注里的「榆林」不认：点不到州');
  ok(RC.placeLeaf(G, '延安府（今延安市）').node.id === 'd-yanan', '括注外的州名照认');
  // AI 宣布的起义落州（民2b 的 resolveLeaf）：「陕西安塞」落到陕西省里挑的一州，不是西安府（西安府民心最高，挑不到它）
  ok(RC.resolveLeaf(G, '陕西安塞').node.id !== 'd-xian', '「陕西安塞」不再落到西安府：' + RC.resolveLeaf(G, '陕西安塞').node.id);
  ok(RC.resolveLeaf(G, '陕北').node.id === 'd-yulin', '「陕北」照旧在陕西挑一州（民心最低的榆林镇）');
});

// ── 四、顺带的三处 ──
part('四·从乱同逃户不纳粮', () => {
  const c = sandbox(['tm-field-pipelines.js']);
  const FP = c.TM.FieldPipes;
  ok(FP.fleeTaxPenalty({ populationDetail: { mouths: 100000, fugitives: 5000, rebels: 9000, hiddenCount: 0 } }) === 0.14, '逃户 5000 + 从乱 9000 → 折 14%');
  ok(FP.fleeTaxPenalty({ populationDetail: { mouths: 100000, fugitives: 5000, hiddenCount: 1000 } }) === 0.06, '没有从乱的照旧：5000 + 1000×0.6 → 5.6% 记 0.06');
});

part('四·复通的驿路不再当未了的事立案', () => {
  const c = sandbox(['tm-matters.js']);
  const out = c.TM.Matters.adapters.unrest({ turn: 6, _routeDisruptions: [
    { id: 'a', route: '延安府驿路', reason: '王二一股盘踞，驿路不通', resolved: false },
    { id: 'b', route: '京师-宣府', reason: '虏骑', resolved: true },
    { id: 'c', route: '榆林镇驿路', reason: '复通', resolved: true, status: 'resolved' }
  ] }, { names: [] });
  const byRef = {};
  out.items.forEach((x) => { byRef[x.key] = x; });
  ok(byRef['routeDisruption:a'] && byRef['routeDisruption:a'].status === 'open', '不通的：未了');
  ok(byRef['routeDisruption:b'] && byRef['routeDisruption:b'].status === 'settled', '主推演记的复通（resolved:true、没写 status）：了结');
  ok(byRef['routeDisruption:c'] && byRef['routeDisruption:c'].status === 'settled', '民变盘踞记的复通：了结');
});

part('四·「民变扰攘」不再套到民变案的民变上（旧式的照旧，民2d 折算后删）', () => {
  const c = sandbox(['tm-engine-constants.js', 'tm-class-mobility.js']);
  const adds = [];
  c.TM.RegionStatus = { add(div, fx) { adds.push({ div: div.name, name: fx.name }); return fx; } };
  const divs = { 延安府: { id: 'd-yanan', name: '延安府' }, 开封府: { id: 'd-kf', name: '开封府' } };
  c.TM.AIChange = { PathUtils: { findDivisionByNameFuzzy: (G, n) => divs[n] || null } };
  c.GM = { turn: 6, population: { byLegalStatus: { taoohu: { mouths: 0 }, huangji: { mouths: 1000000 } } }, rovingRebels: [],
    minxin: { revolts: [band(), { id: 'old-1', region: '开封府', status: 'ongoing', level: 3, scale: 30000 }] } };
  c.PhaseF3._tickRovingPlunder({ turn: 6 }, 1);
  ok(adds.length === 1 && adds[0].div === '开封府' && adds[0].name === '民变扰攘', '只有旧式的开封府挂「民变扰攘」：' + JSON.stringify(adds));
});

// ── 五、接线 ──
part('五·过回合在民变案判定之后调；index.html 紧跟 tm-revolt-rising.js 装载', () => {
  const sys = read('tm-endturn-systems.js');
  const a = sys.indexOf('TM.RevoltCases.tick(GM'), b = sys.indexOf('TM.RevoltGuerrilla.tick(GM'), d = sys.indexOf('PhaseF3.tick(');
  ok(a > 0 && b > a && d > b, '6.146 在 6.145 民变案判定之后、阶层流动（流寇）之前');
  const html = read('index.html');
  const r = html.indexOf('src="tm-revolt-rising.js'), g = html.indexOf('src="tm-revolt-guerrilla.js');
  ok(r > 0 && g > r && html.slice(r, g).split('<script').length === 2, 'index.html 紧跟 tm-revolt-rising.js');
});

console.log('\n[smoke-revolt-guerrilla] ' + (failed.length ? 'FAIL' : 'PASS') + ' — ' + checks + ' 项过' + (failed.length ? '；败 ' + failed.length + ' 段：' + failed.join('｜') : ''));
process.exit(failed.length ? 1 : 0);
