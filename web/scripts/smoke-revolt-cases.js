#!/usr/bin/env node
'use strict';
// smoke-revolt-cases — 民变重做·民1 立案与起事判定（docs/guanben-roleplay-20260930/minbian.md 定案第 2 条；施工单民1）
//
// 州民心跌破 35 立「苗头」案；每月起事机会＝饥荒（≤0.40）＋赋役（≤0.30）＋流民（≤0.20）＋邻州已起事（≤0.10），
// 乘地方官（贪酷 1.5、庸常 1、清能且在赈 0.5、缺官 1.2）。本片只判只记：掷中记「当起」，不生民变、不出事件、不碰
// GM._revoltPrecursors（AI 写的起义前兆，会回灌主推演）与旧民变表。真跑 tm-person.js、tm-traits-data.js、tm-revolt-cases.js，
// 地方官认谁真跑官制读口 tm-office-holder-state.js、tm-circuit-governance.js。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const WEB = path.resolve(__dirname, '..');
let checks = 0;
const ok = (v, m) => { assert(v, m); checks++; };
// 沙箱里造的数组、对象属另一运行域，原型不同，deepEqual 前两边先过一道 JSON
const plain = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));
const eq = (a, b, m) => { assert.deepEqual(plain(a), plain(b), m); checks++; };
const near = (a, b, m) => { assert(Math.abs(a - b) < 1e-3, m + '（实为 ' + a + '，应为 ' + b + '）'); checks++; };
const read = (f) => fs.readFileSync(path.join(WEB, f), 'utf8');

function leaf(id, name, minxin, extra) {
  return Object.assign({ id: id, name: name, minxin: minxin, carryingCapacity: { currentLoad: 1.32 },
    fiscal: { skimmingRate: 0.18, overstatement: 0.08 }, populationDetail: { mouths: 450000, fugitives: 32700 } }, extra || {});
}

function world() {
  return {
    turn: 2, _campaignId: 'camp-1',
    adminHierarchy: { player: { divisions: [
      { id: 'p-sx', name: '陕西布政使司', mapRegionId: 'm-11', governorId: 'c-hu', officialPosition: '陕西巡抚',
        disaster: { active: true, type: '大饥荒', severity: 95, affectedSubDivisions: ['延安府', '榆林卫'] },
        children: [leaf('d-yanan', '延安府', 11.16), leaf('d-yulin', '榆林镇', 11.16), leaf('d-pingliang', '平凉府', 30)] },
      { id: 'p-shx', name: '山西布政使司', mapRegionId: 'm-10', governorId: 'c-qing',
        children: [leaf('d-taiyuan', '太原府', 50), leaf('d-pingyang', '平阳府', 20)] },
      { id: 'p-hn', name: '河南布政使司', mapRegionId: 'm-12',
        children: [leaf('d-kaifeng', '开封府', 25)] }
    ] }, laterJin: { divisions: [{ id: 'j-1', name: '辽东', children: [leaf('j-11', '辽阳', 5)] }] } },
    mapData: { adjacencyGraph: { 'm-11': [{ target: 'm-10' }], 'm-10': [{ target: 'm-11' }], 'm-12': [] } },
    chars: [
      { id: 'c-hu', name: '胡廷宴', alive: true, integrity: 32, traitIds: ['patient', 'callous'] },
      { id: 'c-qing', name: '某清官', alive: true, integrity: 70, traitIds: ['honest', 'diligent'] }
    ],
    facs: [{ name: '明朝廷' }, { name: '陕北饥民(将起)', type: '起义军', territory: '陕西延安府·榆林·米脂·府谷' }],
    guoku: { _customTaxMeta: { liaoxiang: { name: '辽饷加派', nominalRate: 0.009, effectiveRate: 0.009 } } },
    renli: { byRegion: { 'd-yanan': { corveeRate: 0.206, levyPolicy: { strength: 'normal', remitTurns: 0 } } } },
    currency: { market: { grainPrice: 95 } },
    activeDisasters: [],
    _revoltPrecursors: [{ turn: 1, class: '饥民', region: '陕西', indicator: 'AI 写的' }],
    minxin: { revolts: [] }
  };
}

function sandbox() {
  const events = [];
  const c = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set, isFinite,
    addEB: (...a) => events.push(a), P: { traitDefinitions: [{ id: 'oddTrait', name: '怪癖', dims: { compassion: -0.5, greed: 0.3 } }] } };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  ['tm-traits-data.js', 'tm-person.js', 'tm-office-holder-state.js', 'tm-circuit-governance.js', 'tm-revolt-cases.js'].forEach((f) => vm.runInContext(read(f), c, { filename: f }));
  c.__events = events;
  return c;
}

const c = sandbox();
const RC = c.TM.RevoltCases;
ok(RC && typeof RC.tick === 'function' && typeof RC.judge === 'function', '装载出 TM.RevoltCases');

// ── TM.Person.disposition：按特质库相加，另带廉忠野 ──
const dHu = c.TM.Person.disposition(world().chars[0]);
ok(dHu.compassion === -200 && dHu.honor === -35 && dHu.integrity === 32, '胡廷宴（冷酷、廉 32）：同情 −200、荣誉 −35');
const dOdd = c.TM.Person.disposition({ traitIds: ['oddTrait'] });
ok(dOdd.compassion === -50 && dOdd.greed === 30 && dOdd.integrity === 50, '特质库没有的特质按剧本 dims ×100 折算；廉缺省 50');

// ── 立案：只管玩家一方，民心 < 35 ──
const G = world();
const before = JSON.stringify({ p: G._revoltPrecursors, r: G.minxin.revolts, f: G.facs });
const st = RC.tick(G, { monthRatio: 1 });
eq(st.cases.map((x) => x.name).sort(), ['平凉府', '平阳府', '延安府', '开封府', '榆林镇'].sort(), '民心 < 35 的玩家州立案；太原府（50）不立；后金辽阳（别家）不立');
ok(st.cases.every((x) => x.openedTurn === 2 && x.history.length === 1), '立案当回合就判一次');

// ── 四项与乘数 ──
const J = (name) => st.cases.find((x) => x.name === name).last.j;
const yan = J('延安府'), ping = J('平凉府'), yang = J('平阳府'), kai = J('开封府');
near(yan.famine.score, 0.4 * (0.35 * 0.64 + 0.5 * 0.95), '饥荒：负荷 1.32、省里大饥荒 95 点到延安府');
near(J('榆林镇').famine.score, yan.famine.score, '灾情名单写「榆林卫」，区划叫「榆林镇」，按去后缀的地名认');
near(ping.famine.score, 0.4 * 0.35 * 0.64, '平凉府不在受灾名单：只算承载');
near(yan.levy.score, 0.3 * (0.4 * 0.65 + 0.3 * 0.36 + 0.3 * 0.53), '赋役：浮收 0.26、辽饷 9 厘、役率 0.206');
near(ping.levy.score, 0.3 * (0.4 * 0.65 + 0.3 * 0.36), '没有人力账的州不算徭役');
near(yan.refugee.score, 0.2 * (0.6 * (32700 / 450000 / 0.1) + 0.4), '流民：逃户 7.3%，且陕北饥民的地盘写着延安');
ok(!ping.refugee.roving && yan.refugee.followers === Math.round(32700 * 0.3), '平凉不在流寇地盘；裹挟规模＝逃户三成');
ok(yan.official.kind === 'cruel' && yan.official.mult === 1.5 && yan.official.name === '胡廷宴', '府里没主官，落到巡抚胡廷宴：廉 32、冷酷 → 贪酷 ×1.5');
ok(yang.official.kind === 'ordinary' && /清能/.test(yang.official.label), '山西某清官不在赈：作庸常 ×1');
ok(kai.official.kind === 'vacant' && kai.official.mult === 1.2, '河南一路没人：缺官 ×1.2');
near(yan.monthly, Math.min(0.95, (yan.famine.score + yan.levy.score + yan.refugee.score) * 1.5), '每月机会＝四项相加 × 地方官 × 总系数（封顶 0.95）');

// ── 地方官认谁：官制树上的在任者，其次区划上的主官名字（任免改它），governorId 只在没有名字时认 ──
const offOf = (Gx, name) => RC.judge(Gx, RC.realmLeaves(Gx).find((l) => l.node.name === name), { months: 1 }).official;
const Ga = world();
Ga.adminHierarchy.player.divisions[0].governor = '某清官';
ok(offOf(Ga, '延安府').name === '某清官', '撤胡廷宴、改授某清官（任免只改名字，governorId 还是旧的）：认名字');
const Gb = world();
Gb.adminHierarchy.player.divisions[2].governor = '郭增光';
const ob = offOf(Gb, '开封府');
ok(ob.kind === 'ordinary' && ob.mult === 1 && ob.name === '郭增光', '区划上写了巡抚名字、档里没这个人：作庸常，不算缺官');
const Gc = world();
Gc.officeTree = [{ name: '地方督抚', positions: [{ id: 'pos-sx', name: '陕西巡抚', holder: '某清官', holderId: 'c-qing' }] }];
ok(offOf(Gc, '延安府').name === '某清官', '官制树上陕西巡抚在任的是某清官：先认它，不认区划上旧的 governorId');
Gc.officeTree[0].positions[0] = { id: 'pos-sx', name: '陕西巡抚', holder: '', holderId: '', actualCount: 0 };
ok(offOf(Gc, '延安府').kind === 'vacant', '官制树上这一职出缺：缺官 ×1.2');
Gc.officeTree[0].positions[0] = { id: 'pos-sx', name: '陕西巡抚', holder: '某清官', holderId: 'c-qing' };
Object.assign(Gc.chars[1], { _travelTo: '西安府', _travelRemainingDays: 20 });
const oc = offOf(Gc, '延安府');
ok(oc.kind === 'vacant' && /赴任/.test(oc.label), '新官赴任未到：缺官');
const Gd = world();
Gd.adminHierarchy.player.divisions[1].governor = '某清官';
Gd.chars[1].alive = false;
ok(offOf(Gd, '平阳府').kind === 'vacant', '区划上写的主官已死：缺官');

// ── 校准用的两个数：门槛与总系数（默认 0 与 1＝照定案原样） ──
ok(RC.CFG.floor === 0 && RC.CFG.scale === 1, '默认门槛 0、总系数 1：照定案原样相加');
const cF = sandbox();
cF.TM.RevoltCases.CFG.floor = 0.3;
cF.TM.RevoltCases.CFG.scale = 0.5;
const stF = cF.TM.RevoltCases.tick(world(), { monthRatio: 1 });
const yF = stF.cases.find((x) => x.name === '延安府').last.j, pF = stF.cases.find((x) => x.name === '平凉府').last.j;
near(yF.monthly, Math.max(0, yF.sum - 0.3) * 1.5 * 0.5, '每月机会＝max(0, 四项和−门槛) × 地方官 × 总系数');
ok(pF.sum < 0.3 + 1e-9 ? pF.monthly === 0 : pF.monthly > 0, '四项和不过门槛的州，每月机会为 0');

// ── 在赈：清能 ×0.5；赈后灾的分量打三折 ──
const G2 = world();
G2.activeDisasters = [{ region: '平阳府', type: '旱', severity: 80, _relieved: true, _reliefTurn: 2 }];
const st2 = RC.tick(G2, { monthRatio: 1 });
const yang2 = st2.cases.find((x) => x.name === '平阳府').last.j;
ok(yang2.official.kind === 'upright' && yang2.official.mult === 0.5, '平阳府有灾且已赈：清官作「清能且在赈」×0.5');
near(yang2.famine.score, 0.4 * (0.35 * 0.64 + 0.5 * 0.8 * 0.3), '赈过的灾，灾的分量打三折');

// ── 掷骰可复现；同回合不重掷 ──
ok(RC.seededRoll('camp-1|2|d-yanan') === RC.seededRoll('camp-1|2|d-yanan') && RC.seededRoll('a') !== RC.seededRoll('b'), '掷骰按局、回合、州定，可复现');
const G3 = world();
RC.tick(G3, { monthRatio: 1 });
const once = JSON.stringify(G3.revoltCases);
RC.tick(G3, { monthRatio: 1 });
ok(JSON.stringify(G3.revoltCases) === once, '同一回合再调一次不重判、不重掷');
const G4 = world();
RC.tick(G4, { monthRatio: 1 });
eq(G4.revoltCases.cases.map((x) => [x.name, x.status, x.last.roll]), G3.revoltCases.cases.map((x) => [x.name, x.status, x.last.roll]), '另一份同样的档，结果逐项相同');

// ── 回合长短：两月一回合，本回合机会＝1−(1−月)² ──
const G5 = world();
const st5 = RC.tick(G5, { monthRatio: 2 });
const y5 = st5.cases.find((x) => x.name === '延安府').last.j;
near(y5.perTurn, 1 - Math.pow(1 - y5.monthly, 2), '两月一回合：本回合机会按月复合');

// ── 邻州：同省已起的满两股封顶，邻省折半；只认上回合以前起的 ──
const G6 = world();
RC.tick(G6, { monthRatio: 1 });
G6.revoltCases.cases.forEach((x) => { x.status = x.name === '延安府' || x.name === '平阳府' ? 'risen' : 'brewing'; });
G6.turn = 3;
RC.tick(G6, { monthRatio: 1 });
const nb = (name) => G6.revoltCases.cases.find((x) => x.name === name).last.j.neighbor;
eq([nb('榆林镇').sameProvince, nb('榆林镇').adjacentProvince], [1, 1], '榆林镇：同省延安起了一股，邻省（山西）平阳起了一股');
near(nb('榆林镇').score, 0.1 * (1 + 0.5) / 2, '邻州分＝0.1 ×（同省 1 ＋ 邻省 0.5）/ 2');
eq([nb('开封府').sameProvince, nb('开封府').adjacentProvince], [0, 0], '河南与陕西、山西地图上不相邻');
ok(['延安府', '平阳府'].every((n) => G6.revoltCases.cases.find((x) => x.name === n).history.length === 1), '已起的案不再掷骰');

// ── 结案：回升过 45 稳住三回合 ──
const G7 = world();
RC.tick(G7, { monthRatio: 1 });
G7.revoltCases.cases.forEach((x) => { x.status = 'brewing'; });
const pl = G7.adminHierarchy.player.divisions[0].children[2];
pl.minxin = 50;
[3, 4].forEach((t) => { G7.turn = t; RC.tick(G7, { monthRatio: 1 }); });
ok(G7.revoltCases.cases.find((x) => x.name === '平凉府').status === 'brewing', '回升才两回合，案还在');
G7.turn = 5; RC.tick(G7, { monthRatio: 1 });
ok(G7.revoltCases.cases.find((x) => x.name === '平凉府').status === 'closed', '回升过 45 稳住三回合，结案');

// ── 只判只记：不生民变、不出事件、不碰 AI 写的前兆、不改势力 ──
eq(JSON.stringify({ p: G._revoltPrecursors, r: G.minxin.revolts, f: G.facs }), before, '起义前兆、旧民变表、势力一样没动');
ok(c.__events.length === 0, '不出事件');
const G8 = world();
RC.tick(G8, { monthRatio: 1 });
const snap8 = JSON.stringify(G8);
const L8 = RC.realmLeaves(G8).find((l) => l.node.name === '延安府');
RC.judge(G8, L8, { months: 1 });
ok(JSON.stringify(G8) === snap8, 'judge 只算不改档');

// ── 接线 ──
const sys = read('tm-endturn-systems.js');
const iAC = sys.indexOf('AuthorityComplete.tick({'), iRC = sys.indexOf('TM.RevoltCases.tick(GM');
ok(iAC > 0 && iRC > iAC && sys.indexOf('GM.turn++') < iAC, '过回合：回合数加一之后、AuthorityComplete 之后判');
ok(!/RevoltCases\.tick 失败:', e\); throw e;/.test(sys), '判错不拦过回合');
const html = read('index.html');
ok(html.indexOf('tm-revolt-cases.js') > html.indexOf('tm-revolt-inference.js') && html.indexOf('tm-person.js') < html.indexOf('tm-revolt-cases.js'), 'index.html 装载 tm-revolt-cases.js');

console.log('PASS smoke-revolt-cases ' + checks + '/' + checks);
