#!/usr/bin/env node
'use strict';
// smoke-revolt-legacy — 民变重做·删旧（同志 11-21「按你推荐来」）：旧档折算、谋叛改道
//
// 一、旧档折算（tm-revolt-band.js convertLegacy，读档后首个过回合折一次）：
//     旧式民变、旧账 GM._activeRevolts 里没结局的，按地方、首领名走民变案点名起事的口子折成新的一股——首领是那个人，
//     人数按本州户口算（不取旧的写死规模），军照常立；落不到州的、民族边疆起事的结掉，不生东西。
//     旧三件套的义军势力、旧账「建政」立的没有地盘的义军势力除档（军撤、成员退籍），首领照上面折成一股；
//     成势立的（带 _fromRevoltCase）与剧本自带的起义一类势力不动。旧账挂的战事撤掉；旧演绎层的招抚谈判作罢；
//     流寇池撤掉（人本就在各州逃户里，全国数不加）；民变表只留民变案的各股。同一局只折一次。
//     11-22 天启干跑查出、补的：有名有姓的先折，那一州已有一股的并进去当骨干（骨干不再被挑去别州另领一股）；
//     招抚谈判在除档之前作罢，问对里的使节求见一并撤掉；折出来的各股事件写「旧报民变核实」，不写「起事」。
// 二、谋叛·聚众（tm-conspiracy.js，同志 11-21 删旧第 3 问「甲」）：
//     不在任的主谋当一股民变起；在任官员、将帅在所在州据州自立（州和他的军随他走，朝廷宣战，官职出缺）；
//     在京的、所在落不到本朝州县的，事泄出奔。
// 三、主推演 faction_create 给的兵力是 0 就记 0（据州自立手里没兵的，不再按缺省一万记）。
// 真跑 tm-utils.js、tm-military.js、tm-battle-contract.js、tm-battle-adapter.js、tm-revolt-cases.js、tm-revolt-rising.js、
// tm-revolt-band.js、tm-authority-complete.js、tm-relations.js、tm-faction-membership.js、tm-negotiation.js、tm-capital-fall.js、tm-conspiracy.js。
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
  catch (e) { failed.push(name); console.log('  ✗ ' + name + '：' + String((e && e.stack) || e).slice(0, 500)); }
}

const FILES = ['tm-utils.js', 'tm-military.js', 'tm-battle-contract.js', 'tm-battle-adapter.js',
  'tm-revolt-cases.js', 'tm-revolt-rising.js', 'tm-revolt-band.js', 'tm-authority-complete.js',
  'tm-relations.js', 'tm-faction-membership.js', 'tm-negotiation.js', 'tm-capital-fall.js', 'tm-conspiracy.js'];

function sandbox(G) {
  const events = [], vacated = [];
  const c = { console: { log() {}, warn() {}, error() {}, info() {} }, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, TypeError, RangeError,
    Map, Set, WeakMap, Promise, Symbol, isFinite, isNaN, parseInt, parseFloat, Date, Infinity,
    setTimeout: () => 0, clearTimeout() {},
    addEB: (cat, text) => events.push(cat + '|' + text), toast() {},
    SettlementPipeline: { register() {} } };
  c.window = c; c.globalThis = c; c.global = c;
  c.TM = {};
  c.AuthorityEngines = { adjustHuangwei: (src, d) => ({ ok: true, delta: d }) };
  c.PostTransfer = { cascadeVacate: (name) => { vacated.push(name); return []; } };
  c.CasusBelliSystem = { declareWar(att, def, cb) { G.activeWars.push({ attacker: att, defender: def, casusBelli: cb }); return { success: true }; } };
  c.GM = G;
  c.P = { battleConfig: {}, conf: {}, map: { enabled: false }, playerInfo: { factionName: '明朝廷' }, time: { daysPerTurn: 30 } };
  vm.createContext(c);
  FILES.forEach((f) => vm.runInContext(read(f), c, { filename: f }));
  // 造人用替身（真入口 TM.Roster.createChar 在 tm-indices.js），同 smoke-revolt-rising
  let born = 0;
  c.TM.Roster = { createChar(data, opts) { const W = (opts && opts.world) || G; data.id = 'char_new_' + (++born); W.chars.push(data); return data; } };
  // 问对的使节求见清洗写口（真身 tm-wendui.js _wdCleansePendingAudiences）替身：同样只按谓词滤 GM._pendingAudiences
  c._wdCleansePendingAudiences = (keep) => { if (Array.isArray(G._pendingAudiences)) G._pendingAudiences = G._pendingAudiences.filter(keep); return G._pendingAudiences; };
  c.__events = events; c.__vacated = vacated;
  return c;
}

function leaf(id, name, mouths, ding, fugitives, extra) {
  return Object.assign({ id: id, name: name, minxin: 30, terrain: '山地', owner: '明朝廷',
    populationDetail: { mouths: mouths, ding: ding, fugitives: fugitives, hiddenCount: 0, rebels: 0 } }, extra || {});
}
function world() {
  return {
    turn: 6, _campaignId: 'camp-legacy', sid: 'camp-legacy', running: true, _capital: '西安府',
    playerInfo: { factionName: '明朝廷' },
    adminHierarchy: { player: { divisions: [
      { id: 'p-sx', name: '陕西布政使司', children: [
        leaf('d-yanan', '延安府', 300000, 78000, 20000),
        leaf('d-xian', '西安府', 1200000, 312000, 30000, { minxin: 40, terrain: '平原' }),
        leaf('d-yulin', '榆林卫', 200000, 52000, 10000, { minxin: 25 })] },
      { id: 'p-hn', name: '河南布政使司', children: [leaf('d-kf', '开封府', 900000, 234000, 5000, { minxin: 50, terrain: '平原' })] }
    ] } },
    facs: [{ id: 'f-ming', name: '明朝廷', isPlayer: true }, { id: 'f-jin', name: '后金' }],
    chars: [
      { id: 'c-emp', name: '朱由校', alive: true, isPlayer: true, faction: '明朝廷' },
      { id: 'c-li', name: '李三', alive: true, location: '西安府', age: 30, title: '盐枭', origin: '盐枭' },
      { id: 'c-du', name: '杜文焕', alive: true, age: 50, military: 70, faction: '明朝廷', location: '榆林卫', officialTitle: '延绥总兵' },
      { id: 'c-hu', name: '胡廷宴', alive: true, age: 55, faction: '明朝廷', location: '西安府', officialTitle: '陕西巡抚' },
      { id: 'c-zhao', name: '赵四', alive: true, age: 33, location: '辽东' }
    ],
    armies: [
      { id: 'a-yansui', name: '延绥镇军', faction: '明朝廷', soldiers: 25000, commander: '杜文焕', commanderId: 'c-du', location: '榆林卫', garrison: '榆林卫', state: 'garrison' },
      { id: 'a-xian', name: '西安卫', faction: '明朝廷', soldiers: 2500, commander: '胡廷宴', commanderId: 'c-hu', location: '西安府', garrison: '西安府', state: 'garrison' }
    ],
    activeWars: [{ attacker: '明朝廷', defender: '后金', casusBelli: 'border' }],
    minxin: { trueIndex: 30, revolts: [] },
    revoltCases: { v: 1, cases: [], lastTick: 6 },
    population: { byLegalStatus: { taoohu: { mouths: 1000 }, huangji: { mouths: 9000000 } } },
    guoku: { money: 300000 },
    _conspiracies: [], _activePlots: []
  };
}
function leafOf(G, id) {
  let hit = null;
  (function walk(ns) { (ns || []).forEach((n) => { if (n.id === id) hit = n; walk(n.children); }); })(G.adminHierarchy.player.divisions);
  return hit;
}
const char = (G, name) => G.chars.filter((x) => x.name === name)[0];
const band = (G, leader) => G.minxin.revolts.filter((r) => r && r.source === 'revolt-cases' && r.leaderName === leader && r.status === 'ongoing')[0];

// 旧档：旧三件套（「闯字营」：势力＋渠帅＋写死九千兵的军，挂着「进军京师」）、旧式民变一股、旧账三条（一条折得进、一条民族起事、一条建政立了势力）、
//   成势立的势力、剧本自带的起义一类势力、流寇池、旧演绎层开着的招抚谈判
function legacyWorld() {
  const G = world();
  G.facs.push(
    { id: 'fac_rev_old-2', name: '闯字营', type: '民变', isRevolt: true, sourceRevoltId: 'old-2', _revoltEntity: true, playerRelation: -85 },
    { id: 'faction_1', name: '大西', type: '起义军', leader: '张献忠', _fromRevolt: 'revolt_z', territory: '四川' },
    { id: 'faction_2', name: '大顺', type: '义军', leader: '王二', _fromRevolt: 'rv-d-yanan-t2', _fromRevoltCase: 'rc-1' },
    { id: 'f-shaanbei', name: '陕北饥民(将起)', type: '起义' },
    { id: 'faction_3', name: '混天王', type: '起义军', leader: '王自用', _fromRevolt: 'revolt_w', territory: '陕西' });
  G.chars.push(
    { id: 'c-gao', name: '高迎祥', alive: true, age: 40, faction: '闯字营', officialTitle: '义军渠帅', _revoltEntity: true, sourceRevoltId: 'old-2' },
    { id: 'c-zhang', name: '张献忠', alive: true, age: 30, faction: '大西' },
    { id: 'c-wang', name: '王二', alive: true, age: 35, faction: '大顺' },
    { id: 'c-wzy', name: '王自用', alive: true, age: 38, faction: '混天王', location: '陕西' });
  G.armies.push({ id: 'army_rev_old-2', name: '闯字营主力', faction: '闯字营', soldiers: 9000, location: '延安府', commander: '高迎祥', _revoltEntity: true, sourceRevoltId: 'old-2' });
  G.minxin.revolts.push(
    { id: 'old-1', region: '开封府', status: 'ongoing', level: 3, scale: 30000, cause: '民心' },
    { id: 'old-2', region: '延安府', status: 'ongoing', level: 5, scale: 200000, _identity: { banner: '闯字营', leaderName: '高迎祥' }, _entityLeaderName: '高迎祥', _breachMarch: { started: 3 } },
    { id: 'old-3', region: '辽东', status: 'ongoing', level: 3, scale: 30000 },
    { id: 'old-done', region: '开封府', status: 'suppressed', level: 3, scale: 30000 });
  G._activeRevolts = [
    { id: 'revolt_x', class: '饥民', region: '西安府', leaderName: '李三', phase: 'expansion', militaryStrength: 50000, territoryControl: ['西安府'], slogan: '均田免粮', history: [], outcome: null },
    { id: 'revolt_y', class: '苗民', region: '贵州', leaderName: '安邦彦', ideology: 'ethnic', history: [], outcome: null },
    { id: 'revolt_z', class: '饥民', region: '榆林卫', leaderName: '张献忠', history: [], outcome: 'seceded' },
    { id: 'revolt_w', class: '饥民', region: '延安府', leaderName: '王自用', history: [], outcome: 'seceded' },
    { id: 'revolt_old', class: '饥民', region: '开封府', leaderName: '某甲', history: [], outcome: 'suppressed' }];
  G.activeWars.push({ enemy: '饥民起义军', leader: '李三', revoltId: 'revolt_x' });
  G.rovingRebels = [{ id: 'rv1', name: '流寇', strength: 40000, regions: ['陕西'] }, { id: 'rv2', name: '流寇', strength: 9000, disbanded: true }];
  // 旧演绎层开招抚谈判时 initiator 记的是旗号（真旧代码如此），使节求见进问对队列
  G._negotiations = [
    { id: 'ng-1', topic: 'pacify', status: 'open', initiator: '闯字营', sourceRef: { kind: 'revolt', refId: 'old-2' }, offers: [{ by: 'them', terms: '索银十万', silver: 100000 }], round: 1, turn: 5 },
    { id: 'ng-2', topic: 'peace', status: 'open', sourceRef: { kind: 'invasion', refId: '后金' }, offers: [{ by: 'them', terms: '岁币' }], round: 1, turn: 5 }];
  G._pendingAudiences = [
    { name: '闯字营来使', isEnvoy: true, fromFaction: '闯字营', _negotiationId: 'ng-1' },
    { name: '后金来使', isEnvoy: true, fromFaction: '后金', _negotiationId: 'ng-2' }];
  return G;
}

console.log('smoke-revolt-legacy — 民变重做·删旧：旧档折算、谋叛改道');

part('一·旧档折算：旧式民变、旧账、旧三件套与建政立的势力折成民变案的各股；落不到的结掉；同一局只折一次', () => {
  const G = legacyWorld(), c = sandbox(G);
  const kf0 = leafOf(G, 'd-kf').populationDetail.fugitives;
  G.turn = 7;
  const st = c.TM.RevoltBand.tick(G, { turn: 7, monthRatio: 1 });
  const lg = st && st.legacy;
  ok(lg && lg.factions === 3 && lg.landed === 4 && lg.merged === 1 && lg.ended === 2 && lg.roving === 40000 && lg.talks === 1 && lg.wars === 1,
    '折算总账：除档三家、折成四股、并入一条、结掉两条、流寇四万散归、谈判一件作罢、战事一条（实得 ' + JSON.stringify(lg && { f: lg.factions, l: lg.landed, m: lg.merged, e: lg.ended, r: lg.roving, t: lg.talks, w: lg.wars }) + '）');
  // 旧三件套：势力除档、军撤掉，渠帅高迎祥领延安府那一股
  ok(!G.facs.some((f) => f.name === '闯字营') && !G.armies.some((a) => a.id === 'army_rev_old-2'), '旧三件套的势力除档、写死九千兵的军撤掉');
  const gao = band(G, '高迎祥');
  ok(gao && gao.region === '延安府' && gao.declaredBy === 'legacy' && char(G, '高迎祥').faction === '', '渠帅高迎祥退籍，领延安府那一股（实得 ' + JSON.stringify(gao && { r: gao.region, by: gao.declaredBy }) + '）');
  ok(gao.followers === 6000 && gao.followers !== 200000, '人数按本州户口算（延安府逃户两万的三成），不取旧的「号称二十万」（实得 ' + gao.followers + '）');
  ok(G.armies.some((a) => a && a._revoltBand && a.sourceRevoltId === gao.id && a.soldiers === 1560), '这股的军照常立（6000×丁口比 0.26）');
  // 旧账建政立的「混天王」（延安府）没有地盘：除档；首领王自用那一州已有高迎祥一股，并进去当骨干（不闲着被挑去别州另领一股）
  const wzy = char(G, '王自用');
  ok(!G.facs.some((f) => f.name === '混天王') && (gao.lieutenantNames || []).indexOf('王自用') >= 0 && (gao.lieutenantIds || []).indexOf('c-wzy') >= 0
    && wzy._revoltLieutenantOf === gao.id && wzy.location === '延安府' && wzy.faction === '' && !band(G, '王自用'),
    '王自用并进延安府高迎祥那一股当骨干，人到延安府（实得 ' + JSON.stringify({ lt: gao.lieutenantNames, of: wzy._revoltLieutenantOf, loc: wzy.location, fac: wzy.faction }) + '）');
  ok(lg.items.some((it) => it.leader === '王自用' && it.oldFaction === '混天王' && it.merged === true && it.joined === true && it.to === gao.id), '总账那条记并入、入伙');
  ok(c.__events.some((e) => e.indexOf('民变|【陕西布政使司·延安府】旧报民变核实：高迎祥为首，众约 6000 人') === 0) && !c.__events.some((e) => /人起事/.test(e)),
    '折出来的各股写「旧报民变核实」，不写「起事」（实得 ' + c.__events.filter((e) => /延安府/.test(e)).join(' ／ ') + '）');
  // 旧式民变：开封府那股折成一股（首领从档里挑不到就新生），人数照开封府逃户
  const kf = G.minxin.revolts.filter((r) => r && r.source === 'revolt-cases' && r.region === '开封府')[0];
  ok(kf && kf.status === 'ongoing' && kf.followers === Math.round(kf0 * 0.3) && kf.leaderName, '开封府旧式一股折成民变案的一股，众按本州逃户三成（实得 ' + JSON.stringify(kf && { f: kf.followers, l: kf.leaderName }) + '）');
  // 旧账：李三（西安府）折成一股；民族起事的安邦彦结掉；已结局的不动；旧账本身撤掉、挂的战事撤掉
  ok(band(G, '李三') && band(G, '李三').region === '西安府' && band(G, '李三').slogan === '均田免粮', '旧账李三一股折到西安府，口号留下');
  ok(!G.chars.some((x) => x.name === '安邦彦') && !band(G, '安邦彦'), '民族起事的旧账结掉：不造人、不生民变');
  ok(G._activeRevolts === undefined, '旧账整个撤掉');
  ok(G.activeWars.length === 1 && G.activeWars[0].defender === '后金', '旧账挂的战事撤掉，别的战事不动（实得 ' + JSON.stringify(G.activeWars) + '）');
  // 旧账「建政」立的没有地盘的势力：除档，首领张献忠领榆林卫那一股；成势立的「大顺」、剧本自带的不动
  ok(!G.facs.some((f) => f.name === '大西') && band(G, '张献忠') && band(G, '张献忠').region === '榆林卫', '建政立的「大西」没有地盘：除档，张献忠领榆林卫那一股');
  ok(G.facs.some((f) => f.name === '大顺') && char(G, '王二').faction === '大顺', '成势立的「大顺」不动（带 _fromRevoltCase）');
  ok(G.facs.some((f) => f.name === '陕北饥民(将起)'), '剧本自带的起义一类势力不动');
  // 辽东那股落不到州：结掉
  ok(!G.minxin.revolts.some((r) => r && r.region === '辽东'), '辽东落不到本朝州县：结掉');
  // 民变表只留民变案的各股；流寇池回逃户；招抚谈判作罢
  ok(G.minxin.revolts.every((r) => r.source === 'revolt-cases'), '民变表只留民变案的各股（旧式的都撤掉）');
  ok(G.rovingRebels === undefined && G.population.byLegalStatus.taoohu.mouths === 1000,
    '流寇池撤掉，四万众记进总账（散了的不算）；全国逃户数不加——人本就在各州逃户里，全国数每回合按各州重算（实得 ' + G.population.byLegalStatus.taoohu.mouths + '）');
  ok(!G._negotiations.some((x) => x.topic === 'pacify' && x.status === 'open') && G._negotiations.some((x) => x.id === 'ng-2' && x.status === 'open'), '旧演绎层的招抚谈判作罢，议和不动');
  ok(!G._pendingAudiences.some((q) => q._negotiationId === 'ng-1') && G._pendingAudiences.some((q) => q._negotiationId === 'ng-2'),
    '问对里那条「闯字营来使」撤掉（除档按势力删谈判管不到它），后金来使不动（实得 ' + JSON.stringify(G._pendingAudiences.map((q) => q.name)) + '）');
  ok(!G._capitalFallen, '挂着「进军京师」的旧式民变不自己破京');
  ok(c.__events.some((e) => e.indexOf('民变|核实各地旧报民变 7 起：并作 4 股，有首有众、落到州县；2 起查无实据、销案；没有城池的旧义军 3 家不再算势力，退为民变；流寇约 40000 众散归逃户') === 0),
    '事件栏一条总账（实得 ' + c.__events.filter((e) => e.indexOf('核实') >= 0) + '）');
  // 同一局只折一次
  const n = G.minxin.revolts.length;
  G.minxin.revolts.push({ id: 'old-late', region: '延安府', status: 'ongoing', level: 3, scale: 30000 });
  G.turn = 8;
  const st2 = c.TM.RevoltBand.tick(G, { turn: 8, monthRatio: 1 });
  ok(st2 && st2.legacy === null && G.minxin.revolts.length === n + 1, '第二回合不再折（实得 ' + JSON.stringify(st2 && st2.legacy) + '）');
});

part('一b·在一股还在的民变里当骨干的，代码挑首领时不挑他去别州另领一股；那一股了结了照常可挑；推演点名照旧认', () => {
  const G = world(), c = sandbox(G), RR = c.TM.RevoltRising;
  const kf = leafOf(G, 'd-kf'), L = { node: kf, chain: [kf, G.adminHierarchy.player.divisions[1]] };
  // 延安府一股的骨干刘大，人在开封府（盐枭，当得了首领）；开封府要挑首领
  G.chars.push({ id: 'c-liu', name: '刘大', alive: true, age: 30, location: '开封府', title: '盐枭', origin: '盐枭', faction: '', _revoltLieutenantOf: 'rv-x' });
  G.minxin.revolts.push({ id: 'rv-x', source: 'revolt-cases', status: 'ongoing', region: '延安府', leaderName: '某', lieutenantIds: ['c-liu'], lieutenantNames: ['刘大'] });
  ok(RR.pickLeader(G, L, 'seed-1') === null, '那一股还在：不挑骨干刘大（实得 ' + JSON.stringify(RR.pickLeader(G, L, 'seed-1') && RR.pickLeader(G, L, 'seed-1').name) + '）');
  const nl = RR.namedLeader(G, '刘大');
  ok(nl && nl.ch && nl.ch.name === '刘大' && !nl.leading && !nl.otherPath, '推演点名他另起一股照旧认');
  G.minxin.revolts[0].status = 'suppressed';
  const p = RR.pickLeader(G, L, 'seed-1');
  ok(p && p.name === '刘大', '那一股了结了：照常可挑（实得 ' + JSON.stringify(p && p.name) + '）');
});

part('一c·新开的局：没有旧东西，折算什么都不动，只记「已折」', () => {
  const G = world(), c = sandbox(G);
  G.turn = 7;
  const st = c.TM.RevoltBand.tick(G, { turn: 7, monthRatio: 1 });
  ok(st.legacy && st.legacy.landed === 0 && st.legacy.ended === 0 && st.legacy.factions === 0 && G.revoltCases.legacyConverted === 7, '空折：记已折（实得 ' + JSON.stringify(st.legacy) + '）');
  ok(!c.__events.some((e) => e.indexOf('核实') >= 0) && G.activeWars.length === 1 && G.population.byLegalStatus.taoohu.mouths === 1000, '不出事件、不动战事与逃户');
});

part('二·谋叛聚众：不在任的当一股民变起；在任将帅据州自立；在京的、落不到州的事泄出奔', () => {
  const CE = (c) => c.ConspiracyEngine;
  const plot = (who, id) => ({ id: id, ringleader: who, target: '朱由校', kind: 'coup', conspirators: [], momentum: 100, stage: 'ripe', _narrativePlan: '煽动流民聚众起事', reason: '聚众' });
  // A. 不在任的盐枭李三在西安府：当一股民变起，首领就是他
  {
    const G = world(), c = sandbox(G);
    CE(c)._resolveRipe(G, plot('李三', 'p-li'));
    const r = band(G, '李三');
    ok(r && r.region === '西安府' && r.declaredBy === 'conspiracy' && r.followers === 9000, '李三在西安府起一股，人数按本州逃户三成（实得 ' + JSON.stringify(r && { reg: r.region, by: r.declaredBy, f: r.followers }) + '）');
    const rec = G._conspiracies.slice(-1)[0];
    ok(rec && rec.action === 'uprising' && rec.outcome === 'succeeded' && !G.facs.some((f) => f.name === '李三'), '记「聚众起事」得逞，不立势力');
  }
  // B. 在任将帅杜文焕在榆林卫：据州自立——州、他的军随他走，朝廷宣战，官职出缺
  {
    const G = world(), c = sandbox(G);
    CE(c)._resolveRipe(G, plot('杜文焕', 'p-du'));
    const fac = G.facs.filter((f) => f.name === '杜文焕')[0];
    ok(fac && fac.type === '割据' && fac.leader === '杜文焕' && fac.capital === '榆林卫' && fac.militaryStrength === 25000, '立「杜文焕」割据，都榆林卫（实得 ' + JSON.stringify(fac && { t: fac.type, l: fac.leader, cap: fac.capital, ms: fac.militaryStrength }) + '）');
    ok(c.TM.FactionMembership.regionInfo('d-yulin').owner === '杜文焕', '榆林卫走易主写口归他');
    ok(G.armies.filter((a) => a.id === 'a-yansui')[0].faction === '杜文焕' && G.armies.filter((a) => a.id === 'a-xian')[0].faction === '明朝廷', '他领的延绥镇军随他走，别人的军不动');
    ok(G.activeWars.some((w) => w.attacker === '明朝廷' && w.defender === '杜文焕' && w.casusBelli === 'rebellion'), '朝廷以「平叛讨逆」宣战');
    ok(c.__vacated.indexOf('杜文焕') >= 0 && char(G, '杜文焕').faction === '杜文焕', '他在朝廷这边的官职出缺，人入籍新势力');
    ok(!band(G, '杜文焕'), '不当民变起');
    const rec = G._conspiracies.slice(-1)[0];
    ok(rec && rec.action === 'secession' && rec.outcome === 'succeeded', '记「据州自立」得逞（实得 ' + JSON.stringify(rec && { a: rec.action, o: rec.outcome }) + '）');
    ok(c.__events.some((e) => e.indexOf('叛乱|【榆林卫】杜文焕据州自立，号「杜文焕」，所部约 25000 人随之；朝廷以平叛讨逆宣战') === 0), '事件在状态落了之后写');
  }
  // C. 在京的胡廷宴（京城西安府，领着西安卫）：不能当场破京——事泄出奔
  {
    const G = world(), c = sandbox(G);
    CE(c)._resolveRipe(G, plot('胡廷宴', 'p-hu'));
    ok(!G.facs.some((f) => f.name === '胡廷宴') && c.TM.FactionMembership.regionInfo('d-xian').owner === '明朝廷' && !G._capitalFallen, '京城不易主、不立势力');
    ok(char(G, '胡廷宴')._fled === true && c.__vacated.length === 0, '事泄出奔（同兵变出奔：人走、记一笔）');
    const rec = G._conspiracies.slice(-1)[0];
    ok(rec && rec.action === 'uprising' && rec.outcome === 'failed' && /在京/.test(rec.reason), '记聚众事泄、写明在京（实得 ' + JSON.stringify(rec && rec.reason) + '）');
    ok(c.__events.some((e) => /胡廷宴 谋聚众为乱而事泄，身在京师无从举事/.test(e)), '事件写明身在京师');
  }
  // D. 所在落不到本朝州县的赵四（辽东）：事泄出奔，不生民变
  {
    const G = world(), c = sandbox(G);
    CE(c)._resolveRipe(G, plot('赵四', 'p-zhao'));
    ok(!band(G, '赵四') && char(G, '赵四')._fled === true && G._conspiracies.slice(-1)[0].outcome === 'failed', '辽东落不到州：出奔，不生民变');
    ok(!G.minxin.revolts.some((r) => r && r.source !== 'revolt-cases'), '不再往民变表里塞旧式一股');
  }
});

part('三·faction_create 给的兵力是 0 就记 0（缺省才按一万）', () => {
  const G = world(), c = sandbox(G), FM = c.TM.FactionMembership;
  const a = FM.createFaction({ name: '甲', militaryStrength: 0 }), b = FM.createFaction({ name: '乙' });
  ok(a.ok && a.faction.militaryStrength === 0 && b.ok && b.faction.militaryStrength === 10000, '给 0 记 0，没给记一万（实得 ' + (a.faction && a.faction.militaryStrength) + '/' + (b.faction && b.faction.militaryStrength) + '）');
});

part('四·旧的口子都不在了：五级梯、旧三件套、旧演绎层、流寇池', () => {
  const G = world(), c = sandbox(G);
  ok(typeof c.AuthorityComplete.tickRevoltUpgrade === 'undefined' && typeof c.AuthorityComplete.REVOLT_LEVELS === 'undefined', '五级梯不在了');
  ok(!c.TM.RevoltEntity && !c.TM.RevoltInference, '旧三件套、旧演绎层不在了');
  ok(!fs.existsSync(path.join(WEB, 'tm-revolt-entity.js')) && !fs.existsSync(path.join(WEB, 'tm-revolt-inference.js')), '两个旧模块的文件删了');
});

if (failed.length) {
  console.log('\n[smoke-revolt-legacy] FAIL — ' + checks + ' 项过；败 ' + failed.length + ' 段：' + failed.join('；'));
  process.exit(1);
}
console.log('\n[smoke-revolt-legacy] PASS — ' + checks + ' 项过');
