#!/usr/bin/env node
'use strict';
// smoke-revolt-ai-merge — 民变重做·民2b 并掉其余口子（施工单民2b；minbian.md「漏列的一套」同志 11-14 定）
//
// 一、AI 宣布的起义（主推演 class_revolt）、一致性补录的民变并进民变案（TM.RevoltCases.riseFromAI）：
//     落到本朝一州——该州有案就当「起」，没案就立案并当起；首领、骨干按 AI 给的名字先在档里找，找不到用这名字按出身新生；
//     人数按户口算，不取 AI 报的兵数。该州已有一股、或点名的首领已领着一股：就是那一股，不另起。
//     落不到本朝州县、在任官员领头、民族边疆宗室起事：不并（另一条路），调用方照旧。
// 二、省的简称只认通行简称：「江南」不是江西，「山东」不是山西，「广西」不是广东（民2a 拿省名头一个字当简称）。
// 三、三处直接生民变的口子删掉：徭役惨烈（「某地」五千）、强征（财政区划编号上一万）、破产第六步（「某地」五千）。
// 四、主推演 class_revolt 与一致性补录两处真代码（花括号、标记之间原样抽出）接上 riseFromAI；落不到的照旧。
// 真跑 tm-traits-data.js、tm-person.js、tm-office-holder-state.js、tm-circuit-governance.js、tm-revolt-cases.js、tm-revolt-rising.js、
// tm-region-enrich.js、tm-fiscal-ui.js、tm-event-bus.js；造人用替身（真入口 TM.Roster.createChar 在 tm-indices.js，实验台真档另验）。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const WEB = path.resolve(__dirname, '..');
let checks = 0;
const ok = (v, m) => { assert(v, m); checks++; };
const read = (f) => fs.readFileSync(path.join(WEB, f), 'utf8');

function sandbox(extraFiles) {
  const events = [];
  const c = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set, isFinite,
    addEB: (...a) => events.push(a), P: { traitDefinitions: [] } };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  ['tm-traits-data.js', 'tm-person.js', 'tm-office-holder-state.js', 'tm-circuit-governance.js', 'tm-revolt-cases.js', 'tm-revolt-rising.js']
    .concat(extraFiles || []).forEach((f) => vm.runInContext(read(f), c, { filename: f }));
  let n = 0;
  c.TM.Roster = { createChar(data, opts) { const G = opts.world; data.id = 'char_new_' + (++n); G.chars.push(data); return data; } };
  c.__events = events;
  return c;
}

function leaf(id, name, extra) {
  return Object.assign({ id: id, name: name, minxin: 30, carryingCapacity: { currentLoad: 1.1 },
    fiscal: { skimmingRate: 0.1, overstatement: 0.05 }, populationDetail: { mouths: 450000, fugitives: 32700 } }, extra || {});
}
function world() {
  return {
    turn: 7, _campaignId: 'camp-2b',
    playerInfo: { factionName: '明朝廷', characterName: '朱由检' },
    adminHierarchy: { player: { divisions: [
      { id: 'p-sx', name: '陕西布政使司', children: [
        leaf('d-yanan', '延安府', { minxin: 20 }), leaf('d-yulin', '榆林镇', { minxin: 26 }),
        leaf('d-xian', '西安府', { minxin: 33 }), leaf('d-pl', '平凉府', { minxin: 18, populationDetail: { mouths: 300000, fugitives: 0 } })] },
      { id: 'p-hn', name: '河南布政使司', children: [leaf('d-kf', '开封府', { minxin: 60 })] },
      { id: 'p-shx', name: '山西布政使司', children: [leaf('d-ty', '太原府', { minxin: 55 })] },
      { id: 'p-jx', name: '江西布政使司', children: [leaf('d-nc', '南昌府', { minxin: 70 })] },
      { id: 'p-gd', name: '广东布政使司', children: [leaf('d-gz', '广州府', { minxin: 70 })] }
    ] } },
    chars: [
      { id: 'c-emp', name: '朱由检', alive: true, age: 17, isPlayer: true },
      { id: 'c-wjy', name: '王嘉胤', alive: true, age: 40, location: '陕西府谷', faction: '陕北饥民(将起)' },
      { id: 'c-zxz', name: '张献忠', alive: true, age: 21, location: '陕西延安府', faction: '' },
      { id: 'c-dead', name: '死人', alive: false, age: 50, location: '延安府' },
      { id: 'c-off', name: '某参将', alive: true, age: 40, location: '延安府', title: '延绥游击', officialTitle: '延绥游击' },
      { id: 'c-hj', name: '皇太极', alive: true, age: 35, location: '沈阳', faction: '后金' },
      { id: 'c-wang', name: '福王', alive: true, age: 40, location: '洛阳', title: '福王·亲王' },
      { id: 'c-mg', name: '满桂', alive: true, age: 45, location: '宁远', faction: '明朝廷' }
    ],
    // 天启真档：王嘉胤领着起义一路自己的兵（他就是那一路的头领）；满桂领着官军（另一条路）
    armies: [
      { id: 'a-1', name: '陕北饥民(将起)·主力', faction: '陕北饥民(将起)', commander: '王嘉胤', commanderId: 'c-wjy', soldiers: 14000 },
      { id: 'a-2', name: '宁远军', faction: '明朝廷', commander: '满桂', commanderId: 'c-mg', soldiers: 20000 }
    ],
    facs: [{ name: '明朝廷' }, { name: '后金' }, { name: '陕北饥民(将起)', type: '起义军', territory: '陕西延安府·榆林·米脂·府谷' }],
    officeTree: [{ name: '延绥镇', positions: [{ id: 'pos-yj', name: '延绥游击', holder: '某参将', holderId: 'c-off' }] }],
    guoku: {}, renli: { byRegion: {} }, currency: { market: { grainPrice: 95 } }, activeDisasters: [],
    minxin: { revolts: [] }
  };
}

const c = sandbox();
const RR = c.TM.RevoltRising, RC = c.TM.RevoltCases;
ok(RC && typeof RC.riseFromAI === 'function' && typeof RC.resolveLeaf === 'function', '装载出 TM.RevoltCases.riseFromAI / resolveLeaf');
const leafOf = (G, name) => RC.realmLeaves(G).find((l) => l.node.name === name);
const nameOf = (L) => L && L.node.name;

// ── 二、地名落到哪一州；省的简称只认通行简称 ──
let G = world();
ok(nameOf(RC.resolveLeaf(G, '延安府')) === '延安府' && nameOf(RC.resolveLeaf(G, 'd-xian')) === '西安府', '点名到州：全名、编号都认');
ok(nameOf(RC.resolveLeaf(G, '陕西延安府澄城县')) === '延安府', '地名里带着州名：认那州');
ok(nameOf(RC.resolveLeaf(G, '榆林、延安一带')) === '榆林镇', '带着几个州名：取最先说到的');
ok(nameOf(RC.resolveLeaf(G, '陕北')) === '平凉府', '只说到省（简称加方位）：没案时挑民心最低的一州');
ok(nameOf(RC.resolveLeaf(G, '晋北')) === '太原府' && nameOf(RC.resolveLeaf(G, '豫东')) === '开封府', '通行简称：晋＝山西，豫＝河南');
ok(RC.resolveLeaf(G, '江南') === null && RC.resolveLeaf(G, '山东') === null && RC.resolveLeaf(G, '广西') === null,
  '「江南」不认作江西，「山东」不认作山西，「广西」不认作广东（省名头一个字不当简称）');
ok(RC.resolveLeaf(G, '辽东') === null && RC.resolveLeaf(G, '') === null, '本朝州县里没有的地方：落不到');
ok(RR.placeScore('山东济南', leafOf(G, '太原府')) === 0 && RR.placeScore('陕北', leafOf(G, '西安府')) === 1,
  '挑首领的「同省」同一认法：山东的人不算山西同省，陕北仍算陕西');
G.revoltCases = { v: 1, cases: [{ id: 'rc-x', divisionId: 'd-xian', status: 'brewing', last: { j: { perTurn: 0.2 } }, history: [] }] };
ok(nameOf(RC.resolveLeaf(G, '陕西')) === '西安府', '只说到省：有案未起的州先（西安府民心不是最低，但有案）');

// ── 一、AI 宣布的起义并进案 ──
G = world();
let res = RC.riseFromAI(G, { by: 'class_revolt', region: '陕西延安府', leaderName: '王二', className: '饥民', slogan: '均田免粮',
  demands: ['开仓', '免粮'], reason: '旱荒催科', militaryStrength: 300000 });
ok(res.landed === true && res.region === '延安府', 'AI 宣布延安起义：落到延安府');
let r = G.minxin.revolts.find((x) => x.id === res.revoltId);
let leader = G.chars.find((x) => x.id === r.leaderId);
ok(r.leaderName === '王二' && r.leaderBorn === true && leader && leader.name === '王二', '档里没有王二：用 AI 给的名字新生');
ok(leader.origin === '饥民' && leader._spawnedFromRevolt.by === 'class_revolt' && leader.location === '延安府', '出身照 AI 说的（饥民），记着谁宣布的');
ok(r.followers === Math.round(32700 * 0.3) && r.followersFrom === 'fugitives', '人数按户口：本州逃户三成（9810），不取 AI 报的三十万');
const pd = leafOf(G, '延安府').node.populationDetail;
ok(pd.mouths === 450000 && pd.fugitives === 32700 - r.followers && pd.rebels === r.followers, '从逃户挪进「从乱」，口数不变');
ok(r.level === 2 && r.form === 'guerrilla' && r.source === 'revolt-cases' && r.declaredBy === 'class_revolt', '定级 2（游击），来源仍是民变案，记着是主推演宣布的');
ok(r.slogan === '均田免粮' && r.demands.join() === '开仓,免粮' && r.className === '饥民' && r.cause === '旱荒催科', '口号、诉求、阶层、导火索当文字留下');
let cs = G.revoltCases.cases.find((x) => x.divisionId === 'd-yanan');
ok(cs && cs.status === 'risen' && cs.openedBy === 'class_revolt' && cs.risenBy === 'class_revolt' && cs.revoltId === r.id, '延安府没案：立案并当起');
const ev = c.__events.filter((e) => e[0] === '民变').pop();
ok(ev && /王二/.test(ev[1]) && /均田免粮/.test(ev[1]) && /9810/.test(ev[1]), '出一条有名有数的事件（谁、在哪、多少人、口号）');

const before = G.minxin.revolts.length;
res = RC.riseFromAI(G, { by: 'class_revolt', region: '延安府', leaderName: '王二' });
ok(res.already === true && G.minxin.revolts.length === before, '再宣布一次（同一首领）：就是那一股，不另起');
res = RC.riseFromAI(G, { by: 'class_revolt', region: '延安府', leaderName: '李三' });
ok(res.already === true && G.minxin.revolts.length === before && !G.chars.some((x) => x.name === '李三'), '同一州已有一股在：不另起，也不另造人');

res = RC.riseFromAI(G, { by: 'class_revolt', region: '榆林镇', leaderName: '王嘉胤', secondaryLeaders: ['李过', '张献忠', '某参将', '王嘉胤'] });
r = G.minxin.revolts.find((x) => x.id === res.revoltId);
ok(res.landed && r.leaderId === 'c-wjy' && r.leaderBorn === false, '点名档里的王嘉胤（起义一类势力的人，领着那一路自己的兵）：就是他');
ok(r.lieutenantNames.join() === '李过,张献忠', '骨干：李过档里没有就新生，张献忠档里有就用；在任的参将、首领本人不当骨干');
const lg = G.chars.find((x) => x.name === '李过');
ok(lg && lg._spawnedFromRevolt.role === 'lieutenant' && /骨干/.test(lg.title) && lg._revoltLieutenantOf === r.id, '新生的骨干记着是骨干、属哪一股');
res = RC.riseFromAI(G, { by: 'class_revolt', region: '西安府', leaderName: '王嘉胤' });
ok(res.already === true && res.revoltId === r.id, '王嘉胤已领着榆林那一股：AI 在西安又点他，就是那一股');

res = RC.riseFromAI(G, { by: 'class_revolt', region: '西安府', leaderName: '某参将' });
ok(res.otherPath === true && /在任/.test(res.why), '在任官员领头：兵变、割据，另一条路，不并');
ok(RC.riseFromAI(G, { by: 'class_revolt', region: '西安府', leaderName: '满桂' }).otherPath === true, '领着官军的将帅领头：兵变，另一条路，不并');
ok(RR.pickLeader(world(), leafOf(world(), '榆林镇'), 'p') !== null, '挑首领时，领着起义一路自己兵的人照样挑得上');
ok(RC.riseFromAI(G, { by: 'class_revolt', region: '西安府', leaderName: '皇太极' }).otherPath === true, '别家势力的人领头：不并');
ok(RC.riseFromAI(G, { by: 'class_revolt', region: '西安府', leaderName: '福王' }).otherPath === true, '宗室领头：不并');
ok(RC.riseFromAI(G, { by: 'class_revolt', region: '西安府', leaderName: '朱由检' }).otherPath === true, '玩家本人：不并');
ok(RC.riseFromAI(G, { by: 'class_revolt', region: '西安府', ideology: 'ethnic' }).otherPath === true, 'AI 说是民族起事：土司叛乱，另一条路');
ok(RC.riseFromAI(G, { by: 'class_revolt', region: '辽东', leaderName: '赵四' }).otherPath === true && !G.chars.some((x) => x.name === '赵四'),
  '落不到本朝州县：不并，也不造人');

res = RC.riseFromAI(G, { by: 'class_revolt', region: '平凉府', leaderName: '徐鸿儒', ideology: 'religious', religiousSect: '闻香教' });
r = G.minxin.revolts.find((x) => x.id === res.revoltId);
leader = G.chars.find((x) => x.id === r.leaderId);
ok(res.landed && leader.origin === '教首' && leader.traitIds.join() === 'zealous,gregarious' && r.religiousSect === '闻香教', '教门起事：新生的首领作教首');
ok(r.followersFrom === 'mouths' && r.followers === 300, '平凉没有逃户：从口数里取千分之一');

res = RC.riseFromAI(G, { by: 'class_revolt', region: '开封府', leaderName: '死人' });
r = G.minxin.revolts.find((x) => x.id === res.revoltId);
ok(res.landed && r.leaderName !== '死人' && /已故/.test(r.leaderNote), 'AI 点名的人已故：照常挑或新生，记一笔');

// dryRun 案（民1 期间只记「当起」）、有案未起：AI 宣布即当起，用的是同一件案
G = world();
G.revoltCases = { v: 1, cases: [{ id: 'rc-d-xian-t3', divisionId: 'd-xian', name: '西安府', status: 'brewing', openedTurn: 3, history: [], last: null }] };
res = RC.riseFromAI(G, { by: 'reconcile', region: '西安府', leaderName: '' });
cs = G.revoltCases.cases.find((x) => x.divisionId === 'd-xian');
ok(res.landed && G.revoltCases.cases.length === 1 && cs.id === 'rc-d-xian-t3' && cs.status === 'risen' && cs.risenBy === 'reconcile', '该州有案：就用那件案当起，不另立');
r = G.minxin.revolts[0];
ok(r.declaredBy === 'reconcile' && r.leaderId && !r.leaderNote, '补录没给首领名：照常在档里挑或新生');

// 案了结后：AI 再宣布同州起事，旧案结掉、另立新案
G.minxin.revolts[0].status = 'suppressed';
G.turn = 9;
res = RC.riseFromAI(G, { by: 'class_revolt', region: '西安府', leaderName: '孙五' });
ok(res.landed && cs.status === 'closed' && cs.endedAs === 'suppressed' && G.revoltCases.cases.length === 2, '那一股已剿平：旧案结掉，另立新案当起');

// ── 三、三处直接生民变的口子删掉 ──
{
  const d = sandbox(['tm-region-enrich.js', 'tm-fiscal-ui.js', 'tm-event-bus.js']);
  const adj = [];
  d._adjAuthority = (k, v) => adj.push([k, v]);
  d.GM = { turn: 5, minxin: { revolts: [] }, landAnnexation: { concentration: 0.7 }, guoku: { annualIncome: 1e7, money: 0 },
    population: { national: { mouths: 1e7 }, corvee: { recentDeaths: 20000, commutationRate: 0.3 } } };
  const out = d.PhaseB.checkCorveeRebellionTrigger({ turn: 5 });
  ok(out.triggered === true && d.GM.minxin.revolts.length === 0, '徭役惨烈照旧触发，但不再在「某地」生民变');
  ok(adj.some((a) => a[0] === 'minxin' && a[1] === -8) && d.__events.some((e) => /徭役惨烈/.test(e[1]) && !/民变/.test(e[1])), '民心 −8 留；事件如实写，不说起了民变');

  d.Math = Object.create(Math); d.Math.random = () => 0;
  d.PhaseA = { checkForcedLevyCooldown: () => ({ penaltyMult: 2 }) };
  d.GM.fiscal = { regions: { 'fr-1': { claimedRevenue: 1000, unrest: 30 } } };
  vm.runInContext('this.__fl = PhaseG4.processForcedLevy("fr-1", 999999, "test");', d);
  ok(d.__fl.ok === true && d.GM.minxin.revolts.length === 0 && d.GM.fiscal.regions['fr-1'].unrest === 60, '强征超额五成：地方不宁 +30 留，不再在财政区划编号上生民变');

  const step6 = d.PhaseF2.BANKRUPTCY_STEPS[5];
  adj.length = 0;
  step6.effect(d.GM);
  ok(step6.name === '民不堪命' && d.GM.minxin.revolts.length === 0 && adj.some((a) => a[0] === 'minxin' && a[1] === -10), '破产第六步：民心 −10 留，不再在「某地」生民变，改叫「民不堪命」');
}

// ── 四、主推演 class_revolt、一致性补录两处真代码接上 ──
function between(file, from, to) {
  const s = read(file), a = s.indexOf(from), b = s.indexOf(to, a + 1);
  assert(a >= 0 && b > a, file + '：找不到标记 ' + from + ' … ' + to);
  return s.slice(a, b);
}
const CLASS_BLOCK = between('tm-endturn-apply.js', '// ── 阶层起义爆发——长周期生命周期起点 ──', '// 拒抚反消失闸');
const RECON_BLOCK = between('tm-endturn-apply-stages.js', '// 民变补录', '// 天灾补录');
ok(/riseFromAI\(GM, \{\s*by: 'class_revolt'/.test(CLASS_BLOCK) && /riseFromAI\(GM, \{ by: 'reconcile'/.test(RECON_BLOCK), '两处都走 riseFromAI');

function runClassRevolt(G, p1) {
  const e = sandbox();
  e.GM = G;
  e.findCharByName = (n) => G.chars.find((x) => x.name === n) || null;
  e.createRuntimeCharacter = (o) => { o.id = 'rt_' + G.chars.length; G.chars.push(o); return o; };
  vm.runInContext('this.__run = function (p1) {\n' + CLASS_BLOCK + '\n};', e);
  e.__run(p1);
  return e;
}
G = world();
G.classes = [{ name: '饥民', leaders: [] }];
G._revoltPrecursors = [{ class: '饥民', region: '延安府', indicator: 'famine' }, { class: '佃农', region: '开封府' }];
runClassRevolt(G, { class_revolt: [
  { class: '饥民', region: '延安府', leaderName: '王二', militaryStrength: 200000, slogan: '均田免粮' },
  { class: '饥民', region: '辽东', leaderName: '赵四', militaryStrength: 8000 }
] });
const mine = G.minxin.revolts.filter((x) => x.source === 'revolt-cases');
ok(mine.length === 1 && mine[0].leaderName === '王二' && mine[0].followers === 9810, '主推演宣布延安起义：进民变案，人数按户口');
ok(G._activeRevolts.length === 1 && G._activeRevolts[0].leaderName === '赵四' && G._activeRevolts[0].militaryStrength === 8000,
  '辽东落不到本朝州县：照旧记进旧账（另一条路），不丢');
ok(!(G.activeWars || []).some((w) => w.leader === '王二') && (G.activeWars || []).some((w) => w.leader === '赵四'), '并进民变案的游击不挂战事；旧账那股照旧挂');
ok(G.classes[0].leaders.indexOf('王二') >= 0 && G._revoltPrecursors.length === 1 && G._revoltPrecursors[0].class === '佃农', '阶层领袖照旧记上；该阶层该地的前兆照旧清掉');

function runRecon(G, events, difficulty) {
  const e = sandbox();
  e.GM = G;
  e.P = { conf: { difficulty: difficulty || 'standard' } };
  // 护栏认地名的替身（真入口 TM.AIChange.PathUtils 在 modules/ai-change-applier）：按名字找区划
  e.TM.AIChange = { PathUtils: { findDivisionByNameFuzzy: (GM, n) => { const L = leafOf(GM, n); return L ? L.node : null; } } };
  vm.runInContext('this.__run = function (_patch) {\n' + RECON_BLOCK + '\n};', e);
  e.__run({ revolt_events: events });
  return e;
}
G = world();
G.turnChanges = { variables: [] };
G.minxin.trueIndex = 40;
runRecon(G, [
  { action: 'start', region: '平凉府', leader: '刘六', scale: 90000, reason: '饥民抢粮' },
  { action: 'start', region: '江南', leader: '', scale: 3000, reason: '织工罢市' },
  { action: 'suppress', region: '不存在的地方' }
]);
const pl = G.minxin.revolts.find((x) => x.region === '平凉府');
ok(pl && pl.source === 'revolt-cases' && pl.leaderName === '刘六' && pl.followers === 300 && pl.declaredBy === 'reconcile', '补录平凉起事：进民变案，人数按户口（不取叙事报的九万）');
ok(G.minxin.revolts.some((x) => x.region === '江南' && x._autoFromReconcile), '「江南」落不到一州：照旧补一股（旧式）');
ok(G.turnChanges.variables.length === 2, '本回合变量只记真有变动的两条（镇压找不到那股不记）');
G = world();
G.turnChanges = { variables: [] };
runRecon(G, [{ action: 'start', region: '开封府', leader: '李四' }]);
ok(G.minxin.revolts.length === 0 && G.turnChanges.variables.length === 0 && !G.chars.some((x) => x.name === '李四'),
  '开封民心 60 尚安：护栏照旧拦下，不起、不造人、不记变量');

console.log('smoke-revolt-ai-merge: ' + checks + ' 项全过');
