#!/usr/bin/env node
'use strict';
// smoke-revolt-rising — 民变重做·民2a 起事落地（minbian.md 定案第 4 条、「新的样子」二；施工单民2a）
//
// 案掷中即起一股真民变：首领先在档里挑（起义一类势力的人与不在任的草莽，所在点到本州的先，同省其次，「陕北」也算陕西；
// 年满十六、活着、不在任、不领兵、没领着别的民变），挑不到按出身新生；人数从本州逃户拨三成进「从乱」，口数不变；
// 定级 2（聚啸＝游击），实体三件套、起旗号只认三级以上。旧的两处生民变（民心链、各州民心低于 25 随机点燃）删掉。
// 真跑 tm-traits-data.js、tm-person.js、tm-office-holder-state.js、tm-circuit-governance.js、tm-revolt-cases.js、tm-revolt-rising.js、
// tm-minxin-ledger.js；造人用替身（真入口 TM.Roster.createChar 在 tm-indices.js，实验台真档另验）。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const WEB = path.resolve(__dirname, '..');
let checks = 0;
const ok = (v, m) => { assert(v, m); checks++; };
const read = (f) => fs.readFileSync(path.join(WEB, f), 'utf8');

function sandbox() {
  const events = [];
  const c = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set, isFinite,
    addEB: (...a) => events.push(a), P: { traitDefinitions: [] } };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  ['tm-traits-data.js', 'tm-person.js', 'tm-office-holder-state.js', 'tm-circuit-governance.js', 'tm-revolt-cases.js', 'tm-revolt-rising.js']
    .forEach((f) => vm.runInContext(read(f), c, { filename: f }));
  let n = 0;
  c.TM.Roster = { createChar(data, opts) { const G = opts.world; data.id = 'char_new_' + (++n); G.chars.push(data); return data; } };
  c.__events = events;
  return c;
}

function leaf(id, name, extra) {
  return Object.assign({ id: id, name: name, minxin: 11, carryingCapacity: { currentLoad: 1.32 },
    fiscal: { skimmingRate: 0.18, overstatement: 0.08 }, populationDetail: { mouths: 450000, fugitives: 32700 } }, extra || {});
}
function ch(id, name, loc, extra) {
  return Object.assign({ id: id, name: name, alive: true, age: 30, location: loc, faction: '陕北饥民(将起)', traitIds: ['brave'] }, extra || {});
}
function world() {
  return {
    turn: 4, _campaignId: 'camp-9',
    adminHierarchy: { player: { divisions: [
      { id: 'p-sx', name: '陕西布政使司', governorId: 'c-hu', officialPosition: '陕西巡抚',
        disaster: { active: true, type: '大饥荒', severity: 95, affectedSubDivisions: ['延安府', '榆林卫'] },
        children: [leaf('d-yanan', '延安府'), leaf('d-yulin', '榆林镇'), leaf('d-xian', '西安府'), leaf('d-pl', '平凉府', { populationDetail: { mouths: 300000, fugitives: 0 } })] },
      { id: 'p-hn', name: '河南布政使司', children: [leaf('d-kf', '开封府')] }
    ] } },
    chars: [
      { id: 'c-hu', name: '胡廷宴', alive: true, integrity: 32, traitIds: ['patient', 'callous'] },
      ch('c-wjy', '王嘉胤', '陕西府谷'),
      ch('c-zxz', '张献忠', '陕西延安府·延绥镇军营'),
      ch('c-ldg', '李定国', '陕西·榆林', { age: 6 }),
      ch('c-wzy', '王自用', '陕北'),
      ch('c-dead', '死人', '陕西延安府', { alive: false }),
      { id: 'c-off', name: '某参将', alive: true, age: 40, location: '延安府', title: '延绥游击', officialTitle: '延绥游击·军卒出身' }
    ],
    facs: [{ name: '明朝廷' }, { name: '陕北饥民(将起)', type: '起义军', territory: '陕西延安府·榆林·米脂·府谷' }],
    officeTree: [{ name: '延绥镇', positions: [{ id: 'pos-yj', name: '延绥游击', holder: '某参将', holderId: 'c-off' }] }],
    guoku: {}, renli: { byRegion: {} }, currency: { market: { grainPrice: 95 } }, activeDisasters: [],
    minxin: { revolts: [] }
  };
}

const c = sandbox();
const RR = c.TM.RevoltRising, RC = c.TM.RevoltCases;
ok(RR && typeof RR.land === 'function', '装载出 TM.RevoltRising');
const leafOf = (G, name) => RC.realmLeaves(G).find((l) => l.node.name === name);
const judgeOf = (G, name) => RC.judge(G, leafOf(G, name), { months: 1 });

// ── 首领：在档的草莽，所在点到本州的先 ──
let G = world();
ok(RR.pickLeader(G, leafOf(G, '延安府'), 's1').name === '张献忠', '延安府起事：所在写着延安府的张献忠先（王嘉胤只点到陕西）');
ok(RR.placeScore('陕北', leafOf(G, '西安府')) === 1 && RR.placeScore('陕西府谷', leafOf(G, '西安府')) === 1, '同省：省名或「陕北」这类省简称加方位都算');
const yl = RR.pickLeader(G, leafOf(G, '榆林镇'), 's2');
ok(yl && yl.name !== '李定国' && ['王嘉胤', '张献忠', '王自用'].indexOf(yl.name) >= 0, '榆林：李定国才六岁不当首领，落到同省的人（实为 ' + (yl && yl.name) + '）');
ok(RR.pickLeader(G, leafOf(G, '延安府'), 's1').name !== '某参将', '在任的延绥游击（官制树上有职）不当民变首领');
G.minxin.revolts.push({ id: 'rv-x', status: 'ongoing', leaderId: 'c-zxz', leaderName: '张献忠' });
ok(RR.pickLeader(G, leafOf(G, '延安府'), 's1').name !== '张献忠', '已领着一股民变的不再领第二股');
ok(RR.pickLeader(G, leafOf(G, '开封府'), 's3') === null, '河南开封：档里没有沾边的草莽');

// ── 挑不到按出身新生 ──
G = world();
let r = RR.land(G, { id: 'rc-kf', province: '河南布政使司' }, leafOf(G, '开封府'), judgeOf(G, '开封府'));
const born = G.chars.find((x) => x.id === r.leaderId);
ok(r.leaderBorn === true && born && born._spawnedFromRevolt && born.location === '开封府', '开封无人可挑：按出身新生一人，所在开封府');
ok(born.origin === '佃农' && born.traitIds.join() === 'stubborn,brave', '开封无灾、非边镇：作佃农，特质照出身配');
ok(G.chars.filter((x) => x.name === born.name).length === 1, '新生的名字不与档里重名');
const G2 = world();
const r2 = RR.land(G2, { id: 'rc-kf' }, leafOf(G2, '开封府'), judgeOf(G2, '开封府'));
ok(r2.leaderName === r.leaderName, '同一局同一回合同一州：新生的人名一样（种子可复现）');
const Gb = world();
Gb.chars = Gb.chars.filter((x) => x.faction !== '陕北饥民(将起)');
const rb = RR.land(Gb, { id: 'rc-yl' }, leafOf(Gb, '榆林镇'), judgeOf(Gb, '榆林镇'));
ok(Gb.chars.find((x) => x.id === rb.leaderId).origin === '边兵', '榆林镇（卫所边镇）新生的作边兵');

// ── 人数出自户口 ──
G = world();
const L = leafOf(G, '延安府');
r = RR.land(G, { id: 'rc-ya', province: '陕西布政使司' }, L, judgeOf(G, '延安府'));
ok(r.followers === Math.round(32700 * 0.3) && r.followersFrom === 'fugitives', '人数＝本州逃户三成（9810）');
ok(L.node.populationDetail.fugitives === 32700 - 9810 && L.node.populationDetail.rebels === 9810 && L.node.populationDetail.mouths === 450000, '逃户挪进从乱，口数不变');
const Lp = leafOf(G, '平凉府');
const rp = RR.land(G, { id: 'rc-pl' }, Lp, judgeOf(G, '平凉府'));
ok(rp.followers === 300 && rp.followersFrom === 'mouths' && Lp.node.populationDetail.fugitives === 0, '没有逃户：取口数千分之一（300），逃户不动');

// ── 民变本身：游击、挂在案上，旧读者读得到 ──
ok(r.status === 'ongoing' && r.level === 2 && r.form === 'guerrilla' && r.region === '延安府' && r.scale === r.followers, '定级 2（聚啸＝游击），规模就是真人数');
ok(r.leaderName === '张献忠' && G.chars.find((x) => x.id === 'c-zxz')._revoltLeaderOf === r.id, '首领记在民变上，人身上也记着');
ok(G.minxin.revolts.indexOf(r) >= 0 && c.__events.some((e) => e[0] === '民变' && /张献忠聚众约 9810 人起事/.test(e[1])), '写进 GM.minxin.revolts，出一条有名有数的事件');
ok(/\(r\.level \|\| 0\) < 3\) return;/.test(read('tm-revolt-entity.js')), '实体三件套只认三级以上：游击的民变不会被套上写死兵数的流民军');

// ── 接进判定：掷中即落地；民1 的 dryRun 重判；民变了结后结案、本州歇几回合 ──
G = world();
RC.CFG.scale = 50;   // 让延安必中
const st = RC.tick(G, { monthRatio: 1 });
RC.CFG.scale = 0.1;
const ya = st.cases.find((x) => x.name === '延安府');
ok(ya.status === 'risen' && ya.revoltId && G.minxin.revolts.some((x) => x.id === ya.revoltId && x.leaderName === '张献忠'), '判定掷中：案转「已起」，落成张献忠那股');
const Gd = world();
Gd.revoltCases = { v: 1, lastTick: 3, grainBase: 95, cases: [{ id: 'rc-old', divisionId: 'd-xian', name: '西安府', province: '陕西布政使司', openedTurn: 2, status: 'risen', risenTurn: 2, dryRun: true, history: [] }] };
RC.tick(Gd, { monthRatio: 1 });
const old = Gd.revoltCases.cases.find((x) => x.id === 'rc-old');
ok(old.rejudgedTurn === 4 && !old.dryRun && (old.status === 'brewing' || (old.status === 'risen' && old.revoltId)), '民1 只记了「当起」没生民变的案：重判一次');
const Ge = world();
RC.CFG.scale = 50;
RC.tick(Ge, { monthRatio: 1 });
RC.CFG.scale = 0.1;
const ce = Ge.revoltCases.cases.find((x) => x.name === '延安府');
Ge.minxin.revolts.find((x) => x.id === ce.revoltId).status = 'suppressed';
Ge.turn = 5; RC.tick(Ge, { monthRatio: 1 });
ok(ce.status === 'closed' && ce.endedAs === 'suppressed', '民变剿平：案结掉，记下怎么了结的');
ok(!Ge.revoltCases.cases.some((x) => x.name === '延安府' && x.status !== 'closed'), '刚剿平：本州民心仍低也先不重新立案');
Ge.turn = 11; RC.tick(Ge, { monthRatio: 1 });
ok(Ge.revoltCases.cases.some((x) => x.name === '延安府' && x.status !== 'closed' && x.openedTurn === 11), '歇满六回合：民心还低就重新立案');

// ── 旧的两处生民变删了 ──
const cl = { console: { log() {}, warn() {}, error() {} }, Math, JSON, String, Number, Array, Object, RegExp, parseInt, parseFloat, isFinite, isNaN, Date: { now: () => 0 } };
cl.window = cl; cl.globalThis = cl;
vm.createContext(cl);
vm.runInContext(read('tm-minxin-ledger.js'), cl, { filename: 'tm-minxin-ledger.js' });
const gm = { turn: 9, minxin: { trueIndex: 20, perceivedIndex: 20, byClass: {}, sources: {}, revolts: [], uprisingCandidates: [],
  byRegion: { a: { true: 5, regionName: '延安府' }, b: { true: 10, regionName: '西安府' } } } };
cl.TM.MinxinLedger.advanceUprisingChain(gm, { turn: 9 });
ok(gm.minxin.uprisingChain.some((x) => x.level >= 3) && gm.minxin.revolts.length === 0, '民心链照旧记酝酿（到三级以上），但不再直接生民变');
const ae = read('tm-authority-engines.js');
ok(!/P_REVOLT_MX|function _triggerRevolt/.test(ae), '各州民心低于 25 随机点燃的那一路删了');

// ── 接线 ──
const html = read('index.html');
ok(html.indexOf('tm-revolt-rising.js') > html.indexOf('tm-revolt-cases.js') && html.indexOf('tm-revolt-cases.js') > 0, 'index.html 装载 tm-revolt-rising.js（在判定之后）');

console.log('PASS smoke-revolt-rising ' + checks + '/' + checks);
