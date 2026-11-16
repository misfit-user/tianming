#!/usr/bin/env node
'use strict';
// smoke-revolt-band — 民变的军与账（民变重做·民2d-1 起事立军；11-15「收口」：剿抚交推演判，代码记账；minbian.md「施工路线」收口）
//
// 一、起事即立一支军：民变落地（tm-revolt-rising.js land）军册里立「某某部」——归「民变」、首领领兵、驻本州、
//     兵数＝人数 × 本州丁口比、乌合；首领领着自己那一股不算「在任或领兵」（AI 再点他的名还是那一股）。
// 二、推演报战果认民变的军：校验放行「民变」（参战的有民变的军才认）；战果写口照记伤亡；这股的军溃散、打没了即了结——
//     首领去向取战果的 commanderFate，平乱接皇威，军从军册撤；打掉的能战之人记死，随之少的老弱记逃散，剩下的进逃户——人数前后对得上；
//     胜仗主将在战果写口当场记功（大小跟推演给的皇威量走）。
// 二b、民变打赢写了占城：先不落城（成势那刀接），城留在战报上；这股照旧在；民变首领不记功。
// 三、军与人对账：少的按比例折人；加的拉回；挪走的拉回本州；军被别处减没了、撤了（查不到哪一仗）按自散，不记死、不给平乱皇威。
// 四、推演判了结（revolt_suppress / revolt_amnesty / revolt_transform 按编号；一致性补录按首领、州、省）：剿平（首领下场照给的）、
//     受抚回籍、自散进逃户；旧账编号、旧式民变不归这里。
// 五、别处了结的善后（受抚、旧五级梯自散）；从乱多出的挪进逃户；民2d-1 剿令旧档挂的仗、剿令撤掉。
// 六、专用的拆了：民变干预面板（四策）、调兵数镇压、危机回复认字眼「平乱」、选军框「发兵剿」都没了。
// 七、给推演看的各股实情：首领、人数、州、能战、军名、本州主官、附近官军（只列本州本省玩家一方的军）。
// 八、战斗引擎认军先认编号；地形折键。
// 九、接线（过回合 6.1455 在民变案判定之后、游击连带之前；index.html 紧跟游击连带装载；补录、主推演三字段、提示词、顶栏只看）。
// 十、战报接皇威只算玩家这方的胜负（剿民变的胜仗与别的仗一样记军胜）。
// 十一、胜仗主将记功：引擎结的按大小胜；推演报的在战果写口记，皇威量 6 以上按大胜；同一仗不重记。
// 真跑 tm-utils.js、tm-military.js、tm-battle-contract.js、tm-battle-adapter.js、tm-revolt-cases.js、tm-revolt-rising.js、
// tm-revolt-band.js、tm-authority-complete.js、tm-prophecy.js、tm-char-economy-engine.js。
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
  catch (e) { failed.push(name); console.log('  ✗ ' + name + '：' + String((e && e.stack) || e).slice(0, 400)); }
}

const FILES = ['tm-utils.js', 'tm-military.js', 'tm-battle-contract.js', 'tm-battle-adapter.js',
  'tm-revolt-cases.js', 'tm-revolt-rising.js', 'tm-revolt-band.js', 'tm-authority-complete.js', 'tm-prophecy.js', 'tm-char-economy-engine.js'];

// 主推演写回的应用器（预检、落账、军胜皇威）——二c 走整条用
const APPLIER = ['tm-ai-change-pathutils.js', 'tm-ai-change-army.js', 'tm-ai-change-narrative.js', 'generated/tm-ai-change-applier.bundle.js'];

function sandbox(extraFiles) {
  const events = [], hw = [];
  const c = { console: { log() {}, warn() {}, error() {}, info() {} }, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, TypeError, RangeError,
    Map, Set, WeakMap, Promise, Symbol, isFinite, isNaN, parseInt, parseFloat, Date, Infinity,
    setTimeout: () => 0, clearTimeout() {},
    addEB: (cat, text) => events.push(cat + '|' + text), toast() {},
    SettlementPipeline: { register() {} } };
  c.window = c; c.globalThis = c; c.global = c;
  c.TM = {};
  c.AuthorityEngines = { adjustHuangwei: (src, d, why) => { hw.push([src, d, why]); return { ok: true, delta: d }; } };
  vm.createContext(c);
  FILES.concat(extraFiles || []).forEach((f) => vm.runInContext(read(f), c, { filename: f }));
  c.__events = events; c.__hw = hw;
  return c;
}

function leaf(id, name, mouths, ding, fugitives, extra) {
  return Object.assign({ id: id, name: name, minxin: 30, terrain: '山地',
    populationDetail: { mouths: mouths, ding: ding, fugitives: fugitives, hiddenCount: 0, rebels: 0 } }, extra || {});
}
function world() {
  return {
    turn: 6, _campaignId: 'camp-2d', sid: 'camp-2d', running: true,
    adminHierarchy: { player: { divisions: [
      { id: 'p-sx', name: '陕西布政使司', children: [
        leaf('d-yanan', '延安府', 300000, 78000, 20000),
        leaf('d-xian', '西安府', 1200000, 312000, 30000, { minxin: 40, terrain: '平原' }),
        leaf('d-yulin', '榆林卫', 200000, 52000, 10000, { minxin: 25 })] },
      { id: 'p-hn', name: '河南布政使司', children: [leaf('d-kf', '开封府', 900000, 234000, 5000, { minxin: 50, terrain: '平原' })] }
    ] } },
    facs: [{ id: 'f-ming', name: '明朝廷' }, { id: 'f-jin', name: '后金' }],
    chars: [
      { id: 'c-wang', name: '王二', alive: true, location: '延安府', age: 35, title: '饥民魁首', origin: '饥民' },
      { id: 'c-li', name: '李三', alive: true, location: '西安府', age: 30, title: '盐枭', origin: '盐枭' },
      { id: 'c-du', name: '杜文焕', alive: true, military: 70, intelligence: 60, faction: '明朝廷' },
      { id: 'c-emp', name: '朱由校', alive: true, isPlayer: true, faction: '明朝廷' }
    ],
    armies: [
      { id: 'a-yansui', name: '延绥镇军', faction: '明朝廷', soldiers: 25000, morale: 60, training: 60, supply: 70, commander: '杜文焕', commanderId: 'c-du', location: '榆林卫', garrison: '榆林卫', state: 'garrison' },
      { id: 'a-xian', name: '西安卫', faction: '明朝廷', soldiers: 2500, morale: 50, training: 45, supply: 60, location: '西安府', garrison: '西安府', state: 'garrison' },
      { id: 'a-kf', name: '河南兵', faction: '明朝廷', soldiers: 8000, morale: 50, training: 50, supply: 60, location: '开封府', garrison: '开封府', state: 'garrison' },
      { id: 'a-jin', name: '正白旗', faction: '后金', soldiers: 20000, morale: 70, training: 70, location: '延安府', garrison: '延安府', state: 'garrison' }
    ],
    minxin: { trueIndex: 30, revolts: [{ id: 'old-1', region: '开封府', status: 'ongoing', level: 3, scale: 30000 }] },
    revoltCases: { v: 1, cases: [], lastTick: 6 },
    guoku: { money: 300000 }
  };
}
function P(extra) {
  return Object.assign({ battleConfig: {}, conf: { marchSystemEnabled: true }, map: { enabled: false }, playerInfo: { factionName: '明朝廷' }, time: { daysPerTurn: 30 } }, extra || {});
}
function leafOf(G, id) {
  let hit = null;
  (function walk(ns) { (ns || []).forEach((n) => { if (n.id === id) hit = n; walk(n.children); }); })(G.adminHierarchy.player.divisions);
  return hit;
}
const J = (n) => ({ followers: n, famine: { score: 0.3, disaster: '大旱' }, levy: { score: 0.1 }, refugee: { score: 0.1 }, official: { kind: 'ordinary' } });

// 起一股：走真的落地（首领挑档里的人、人数从逃户拨、立军）
function rise(c, G, divId, n) {
  const RC = c.TM.RevoltCases;
  const L = RC.realmLeaves(G).filter((x) => x.node.id === divId)[0];
  const cs = { id: 'rc-' + divId + '-t' + G.turn, divisionId: divId, name: L.node.name, province: L.chain[L.chain.length - 1].name, status: 'brewing', history: [] };
  G.revoltCases.cases.push(cs);
  const r = c.TM.RevoltRising.land(G, cs, L, J(n));
  cs.status = 'risen';
  return r;
}
function setup(pExtra) {
  const c = sandbox(), G = world();
  c.GM = G; c.P = P(pExtra);
  const r = rise(c, G, 'd-yanan', 6000);
  return { c, G, r, band: () => G.armies.filter((a) => a && a._revoltBand && a.sourceRevoltId === r.id)[0] };
}
// 过回合：推演的战果在推进回合之前落账，民变的军与账在推进之后（6.1455）
function nextTurn(c, G) {
  G.turn++;
  return c.TM.RevoltBand.tick(G, { turn: G.turn, monthRatio: 1 });
}
const char = (G, id) => G.chars.filter((x) => x.id === id)[0];

console.log('smoke-revolt-band — 民变的军与账（民2d-1 起事立军 · 11-15 收口）');

part('一·起事即立一支军：兵数按丁口比、首领领兵、驻本州；首领领着自己那一股不算在任', () => {
  const { c, G, r, band } = setup();
  const a = band();
  ok(r && r.status === 'ongoing' && r.leaderName === '王二' && r.followers === 6000, '落地一股王二，众 6000（实得 ' + JSON.stringify(r && { l: r.leaderName, f: r.followers }) + '）');
  ok(a && a.id === 'army_band_' + r.id && a.name === '王二部' && a.faction === '民变', '军册立「王二部」归民变（实得 ' + JSON.stringify(a && { id: a.id, n: a.name, f: a.faction }) + '）');
  ok(a.soldiers === 1560 && a.size === 1560 && a.composition[0].count === 1560, '兵数＝6000×丁口比 0.26＝1560（实得 ' + a.soldiers + '）');
  ok(a.commander === '王二' && a.commanderId === 'c-wang' && a.location === '延安府' && a.garrison === '延安府', '首领领兵、驻延安府');
  ok(a.quality === '乌合' && a.morale === 55 && a.training === 35 && a.supply === 45 && a.state === 'field', '三件套照旧式流民军');
  ok(r.band && r.band.armyId === a.id && r.band.peak === 1560 && r.band.rate === 0.26, 'r.band 记军编号、最多兵数、折兵比');
  const pd = leafOf(G, 'd-yanan').populationDetail;
  ok(pd.rebels === 6000 && pd.fugitives === 14000, '人数从逃户拨进从乱（落地本来的账）');
  const nl = c.TM.RevoltRising.namedLeader(G, '王二');
  ok(nl && nl.leading === true && !nl.otherPath, 'AI 再点王二的名：还是那一股，不当「在任或领兵」（实得 ' + JSON.stringify(nl && { leading: nl.leading, why: nl.why }) + '）');
  c.TM.RevoltBand.tick(G, { turn: G.turn });
  ok(G.armies.filter((x) => x._revoltBand).length === 1, '过回合不重立');
  // 剿平被擒下狱的首领，日后同州再起事不再挑他
  const c2 = sandbox(), G2 = world();
  c2.GM = G2; c2.P = P();
  G2.chars[0]._imprisoned = true;
  G2.chars.push({ id: 'c-gao', name: '高迎祥', alive: true, location: '延安府', age: 40, title: '贩马为业', origin: '贩马' });
  const r2 = rise(c2, G2, 'd-yanan', 3000);
  ok(r2.leaderName === '高迎祥', '在押的王二不当首领，改挑高迎祥（实得 ' + r2.leaderName + '）');
});

part('二·推演报战果认民变的军：照记伤亡，这股的军溃散即了结，首领去向取战果的；人数前后对得上；主将当场记功', () => {
  const { c, G, r, band } = setup();
  const MS = c.MilitarySystems, bandId = band().id;
  const br = { battleId: 'ai-b1', winnerFactionId: '明朝廷', loserFactionId: '民变', attackerArmyId: 'a-yansui', defenderArmyId: bandId,
    casualties: { attacker: 300, defender: 1200 }, huangweiDelta: 4,
    affectedArmies: [{ armyId: 'a-yansui', side: 'attacker', loss: 300 },
      { armyId: bandId, side: 'defender', loss: 1200, state: 'routed', commanderFate: { name: '王二', outcome: 'captured' } }] };
  ok(MS.validateBattleResult(br, G).ok, '校验：一方势力写「民变」、参战的有民变的军，放行（实得 ' + JSON.stringify(MS.validateBattleResult(br, G)) + '）');
  const bad = MS.validateBattleResult({ winnerFactionId: '明朝廷', loserFactionId: '民变', attackerArmyId: 'a-yansui', defenderArmyId: 'a-kf' }, G);
  ok(!bad.ok && bad.errors.some((e) => /势力不存在·民变/.test(e)), '没有民变的军参战而写「民变」：照旧拒（实得 ' + JSON.stringify(bad.errors) + '）');
  const du = char(G, 'c-du');
  c.CharEconEngine.ensureCharResources(du);
  const f0 = du.resources.fame || 0, m0 = du.resources.virtueMerit || 0;
  const pd = leafOf(G, 'd-yanan').populationDetail;
  const before = { mouths: pd.mouths, ding: pd.ding, fug: pd.fugitives };
  const rec = MS.applyBattleResult(br, G);
  ok(rec && rec.ok && band().soldiers === 360 && band().state === 'routed', '战果写口照记：王二部损 1200 余 360、溃散（实得 ' + JSON.stringify(rec && rec.ok) + '/' + band().soldiers + '/' + band().state + '）');
  ok(char(G, 'c-wang').capturedBy === '明朝廷', '首领下场照战果落在人身上');
  ok(du.resources.fame - f0 === 4 && du.resources.virtueMerit - m0 === 60, '杜文焕当场记功：皇威量 4 按小胜——名望 +4（平乱减半）、贤能 +60（实得 ' + (du.resources.fame - f0) + '/' + (du.resources.virtueMerit - m0) + '）');
  ok(c.__events.some((e) => e === '功名|杜文焕（延绥镇军）小胜王二部，记军功：名望 +4，贤能 +60'), '事件流记我方主将军功');
  c.__hw.length = 0;
  const st = nextTurn(c, G);
  ok(r.status === 'suppressed' && r.endedBy === 'battle' && r.leaderFate === 'captured', '这股的军溃散：剿平，首领被擒（实得 ' + JSON.stringify({ s: r.status, e: r.endedBy, f: r.leaderFate }) + '）');
  const wang = char(G, 'c-wang');
  ok(wang._imprisoned === true && /为延绥镇军所擒/.test(wang._imprisonReason) && !wang._revoltLeaderOf, '首领下狱候勘，不再挂着这股');
  ok(c.__hw.length === 1 && c.__hw[0][0] === 'suppressRevolt' && c.__hw[0][1] === 4, '平乱接皇威（2 级 +4，同旧规矩）');
  ok(!band() && st.broken === 1 && st.settled === 1, '王二部从军册撤掉');
  const dead = r.band.dead, scat = r.band.scattered, rest = r.settled.n;
  ok(dead === 1200 && scat === 3415 && rest === 1385, '打掉的能战之人 1200 记死，随之少的老弱 3415 记逃散，余 1385（实得 ' + [dead, scat, rest].join('/') + '）');
  ok(pd.mouths === before.mouths - dead && pd.ding === before.ding - dead, '本州口数、丁数各减死者');
  ok(pd.rebels === 0 && pd.fugitives === before.fug + scat + rest, '从乱扣尽，逃散的、剩下的都进逃户');
  ok(dead + scat + rest === 6000, '人数前后对得上：死 ' + dead + ' + 逃散 ' + scat + ' + 剩 ' + rest + ' = 6000');
  ok(c.__events.some((e) => e === '民变|【陕西布政使司·延安府】延绥镇军剿平王二一股，首领王二被擒，余众约 1385 人四散'), '事件流记剿平');
  // 阵亡的首领：战果写口只落 alive=false，了结时补齐死因
  const k = setup(), kb = k.band().id;
  k.c.MilitarySystems.applyBattleResult({ battleId: 'ai-k', winnerFactionId: '明朝廷', loserFactionId: '民变', attackerArmyId: 'a-yansui', defenderArmyId: kb,
    affectedArmies: [{ armyId: 'a-yansui', side: 'attacker', loss: 100 }, { armyId: kb, side: 'defender', loss: 1560, commanderFate: { name: '王二', outcome: 'killed' } }] }, k.G);
  nextTurn(k.c, k.G);
  const kw = char(k.G, 'c-wang');
  ok(k.r.status === 'suppressed' && k.r.leaderFate === 'killed' && kw.dead === true && /为延绥镇军所斩/.test(kw.deathReason), '这股打光、首领阵亡：剿平，死因记上（实得 ' + JSON.stringify({ f: k.r.leaderFate, d: kw.deathReason }) + '）');
  // 没给首领下场：当脱身
  const e = setup(), eb = e.band().id;
  e.c.MilitarySystems.applyBattleResult({ battleId: 'ai-e', winnerFactionId: '明朝廷', loserFactionId: '民变', attackerArmyId: 'a-yansui', defenderArmyId: eb,
    affectedArmies: [{ armyId: 'a-yansui', side: 'attacker', loss: 100 }, { armyId: eb, side: 'defender', loss: 800, state: 'routed' }] }, e.G);
  nextTurn(e.c, e.G);
  ok(e.r.status === 'suppressed' && e.r.leaderFate === 'escaped' && char(e.G, 'c-wang').alive !== false && !char(e.G, 'c-wang')._imprisoned, '没给首领下场：脱身');
  // 小败未溃：这股照旧在，人数照记
  const s = setup(), sb = s.band().id;
  s.c.MilitarySystems.applyBattleResult({ battleId: 'ai-s', winnerFactionId: '明朝廷', loserFactionId: '民变', attackerArmyId: 'a-yansui', defenderArmyId: sb,
    affectedArmies: [{ armyId: 'a-yansui', side: 'attacker', loss: 100 }, { armyId: sb, side: 'defender', loss: 156 }] }, s.G);
  nextTurn(s.c, s.G);
  ok(s.r.status === 'ongoing' && s.r.followers === 5400 && s.band().soldiers === 1404, '小败未溃：照旧在，人少一成（实得 ' + s.r.status + '/' + s.r.followers + '）');
});

part('二b·民变打赢写了占城：先不落城，城留在战报上；这股照旧在；民变首领不记功', () => {
  const { c, G, r, band } = setup();
  G.cities = [{ id: 'city-yanan', name: '延安城', owner: '明朝廷', faction: '明朝廷' }];
  const bid = band().id;
  const br = { battleId: 'ai-w', winnerFactionId: '民变', loserFactionId: '明朝廷', attackerArmyId: bid, defenderArmyId: 'a-xian',
    casualties: { attacker: 100, defender: 800 }, occupiedCityIds: ['city-yanan'] };
  ok(c.MilitarySystems.validateBattleResult(br, G).ok, '民变胜：校验放行');
  const rec = c.MilitarySystems.applyBattleResult(br, G);
  ok(rec.ok && G.cities[0].owner === '明朝廷' && G.cities[0].faction === '明朝廷', '城不落给「民变」（实得 ' + G.cities[0].owner + '）');
  ok(br.occupiedCityIds.length === 0 && br._bandOccupiedCityIds[0] === 'city-yanan', '占城留在战报上（成势那刀接）');
  ok(G.armies.filter((a) => a.id === 'a-xian')[0].soldiers === 1700, '官军照记伤亡');
  const wang = char(G, 'c-wang');
  ok(!(wang.resources && wang.resources.fame), '民变首领不记功');
  nextTurn(c, G);
  ok(r.status === 'ongoing' && r.followers === 6000 - 385, '这股照旧在，伤亡照折人（实得 ' + r.status + '/' + r.followers + '）');
});

part('二c·主推演报的仗走主写回整条：预检认「民变」一方 → 应用器落账 → 我方胜照 P-5TK 记军胜；军事子调用换编号再报同一仗不重记', () => {
  const c = sandbox(APPLIER), G = world();
  G.facs[0].isPlayer = true;                     // 开局给玩家势力打的标（tm-patches-start），P-5TK 认它
  c.GM = G; c.P = P();
  const r = rise(c, G, 'd-yanan', 6000);
  const a = G.armies.filter((x) => x._revoltBand && x.sourceRevoltId === r.id)[0];
  const mk = (id, def, extra) => Object.assign({ battleId: id, winnerFactionId: '明朝廷', loserFactionId: '民变', attackerArmyId: 'a-yansui', defenderArmyId: def,
    casualties: { attacker: 200, defender: 900 },
    affectedArmies: [{ armyId: 'a-yansui', side: 'attacker', loss: 200 },
      { armyId: def, side: 'defender', loss: 900, state: 'routed', commanderFate: { name: '王二', outcome: 'captured' } }] }, extra || {});
  const pre = c.validateAIWriteBackBatch({ battleResult: mk('ai-m0', a.id) }, { source: 'smoke' });
  ok(pre.ok && pre.output.battleResult.loserFactionId === '民变' && pre.output.battleResult.winnerFactionId === 'f-ming',
    '预检：民变一方认参战的军，官军一方照旧换成势力编号（实得 ' + JSON.stringify(pre.ok ? pre.output.battleResult.winnerFactionId + '/' + pre.output.battleResult.loserFactionId : pre.failures) + '）');
  const ghost = c.validateAIWriteBackBatch({ battleResult: mk('ai-m9', 'a-kf') }, { source: 'smoke' });
  ok(!ghost.ok && ghost.failures.some((f) => f.field === 'battleResult'), '没有民变的军参战而写「民变」：预检照旧不认');
  const res = c.applyAITurnChanges({ _strictValidation: true, _commitMode: 'per-item', battleResult: mk('ai-m1', a.id, { huangweiDelta: 6 }) });
  ok(res && res.ok === true, '主写回落账（实得 ' + JSON.stringify(res && (res.ok === true || res.applied)) + '）');
  ok((G.battleHistory || []).some((x) => x.battleId === 'ai-m1') && a.state === 'routed' && a.soldiers === 660, '王二部损 900、溃散（实得 ' + a.state + '/' + a.soldiers + '）');
  ok(char(G, 'c-wang').capturedBy, '首领被擒落在人身上');
  ok(c.__hw.some((h) => h[0] === 'militaryVictory' && h[1] === 6), '我方胜照 P-5TK 记军胜，量取推演给的 6（实得 ' + JSON.stringify(c.__hw) + '）');
  // 军事子调用换个编号再报同一仗：攻守两军都在本回合那一仗里，认作那一仗，不再结算；伤亡记作已扣（免得它的势力军事动作再扣一遍）
  const s18 = c.MilitarySystems.consumeBattleResults({ battleResult: mk('sc18-dup', a.id) }, G);
  ok(s18.accepted.length === 1 && s18.accepted[0].receipt.duplicate === true && a.soldiers === 660 && !G.battleHistory.some((x) => x.battleId === 'sc18-dup'),
    '同一仗不重记（实得 ' + a.soldiers + '）');
  ok(s18.casualtyFactions['民变'] === 900, '记作已扣的伤亡（实得 ' + JSON.stringify(s18.casualtyFactions) + '）');
  const other = c.MilitarySystems.consumeBattleResults({ battleResult: { battleId: 'sc18-other', winnerFactionId: '明朝廷', loserFactionId: '后金', attackerArmyId: 'a-yansui', defenderArmyId: 'a-jin',
    casualties: { attacker: 10, defender: 50 }, affectedArmies: [{ armyId: 'a-yansui', side: 'attacker', loss: 10 }, { armyId: 'a-jin', side: 'defender', loss: 50 }] } }, G);
  ok(other.accepted.length === 1 && !other.accepted[0].receipt.duplicate && G.armies.filter((x) => x.id === 'a-jin')[0].soldiers === 19950, '换了对手的另一仗照常结算');
  nextTurn(c, G);
  ok(r.status === 'suppressed' && r.endedBy === 'battle' && r.leaderFate === 'captured', '过回合：这股剿平，首领被擒（实得 ' + JSON.stringify({ s: r.status, e: r.endedBy, f: r.leaderFate }) + '）');
});

part('三·军与人对账：少的按比例折人；加的拉回；挪走的拉回本州；军被别处减没了按自散', () => {
  const { c, G, r, band } = setup();
  const a = band(), pd = leafOf(G, 'd-yanan').populationDetail;
  a.soldiers = 1404;   // 少一成
  G.turn = 7; c.TM.RevoltBand.tick(G, { turn: 7 });
  ok(r.followers === 5400 && r.scale === 5400, '军少一成，人少一成：5400（实得 ' + r.followers + '）');
  ok(r.band.dead === 156 && r.band.scattered === 444, '能战之人 156 记死，老弱 444 记逃散（实得 ' + r.band.dead + '/' + r.band.scattered + '）');
  ok(pd.mouths === 300000 - 156 && pd.ding === 78000 - 156 && pd.rebels === 5400 && pd.fugitives === 14000 + 444, '本州户口照记');
  a.soldiers = 9999; a.location = '西安府'; a.garrison = '西安府';
  G.turn = 8; c.TM.RevoltBand.tick(G, { turn: 8 });
  ok(a.soldiers === 1404 && a.size === 1404, '别处给它加的兵拉回人数折的兵（实得 ' + a.soldiers + '）');
  ok(a.location === '延安府' && a.garrison === '延安府', '挪走的拉回本州');
  ok(r.followers === 5400, '人数不跟着加');
  ok(c.TM.RevoltBand.tick(G, { turn: 8 }) === null, '同一回合再走一遍：不重扣');
  // 军被别处减没了（查不到哪一仗）：自散，不给平乱皇威
  const z = setup();
  z.band().soldiers = 0;
  z.c.__hw.length = 0;
  z.G.turn = 7; z.c.TM.RevoltBand.tick(z.G, { turn: 7 });
  ok(z.r.status === 'dispersed' && z.r.endedBy === 'collapse' && !z.band() && z.c.__hw.length === 0, '能打的没了又查不到哪一仗：自散，军撤，不记平乱');
  // 军整个从军册没了：人记逃散不记死，不复立
  const m = setup();
  const pdm = leafOf(m.G, 'd-yanan').populationDetail;
  m.G.armies = m.G.armies.filter((x) => !x._revoltBand);
  m.G.turn = 7; m.c.TM.RevoltBand.tick(m.G, { turn: 7 });
  ok(m.r.status === 'dispersed' && m.r.band.dead === 0 && pdm.mouths === 300000 && pdm.fugitives === 20000 && pdm.rebels === 0, '军被撤了：不复立，人都记逃散（实得 ' + JSON.stringify({ s: m.r.status, d: m.r.band.dead, f: pdm.fugitives }) + '）');
  ok(!m.G.armies.some((x) => x._revoltBand), '不复立军');
});

part('四·推演判了结：剿平（首领下场照给的）、受抚回籍、自散进逃户；认编号、首领、州、省；旧式不归这里', () => {
  let s = setup();
  const RB = s.c.TM.RevoltBand;
  s.c.__hw.length = 0;
  let res = RB.conclude(s.G, { revoltId: s.r.id, status: 'suppressed', leaderFate: 'killed', by: '杜文焕', endedBy: 'ai' });
  const wang = char(s.G, 'c-wang');
  ok(res.handled && res.ok && res.revoltId === s.r.id && res.leaderName === '王二' && s.r.status === 'suppressed' && s.r.endedBy === 'ai', '按编号剿平（实得 ' + JSON.stringify(res) + '）');
  ok(s.r.leaderFate === 'killed' && wang.dead === true && /为杜文焕所斩/.test(wang.deathReason), '首领伏诛照推演给的');
  ok(s.c.__hw.length === 1 && s.c.__hw[0][0] === 'suppressRevolt', '剿平接皇威（平乱）');
  ok(s.c.__events.some((e) => e === '民变|【陕西布政使司·延安府】杜文焕剿平王二一股，首领王二伏诛，余众约 6000 人四散'), '事件流记剿平');
  nextTurn(s.c, s.G);
  const pd = leafOf(s.G, 'd-yanan').populationDetail;
  ok(pd.rebels === 0 && pd.fugitives === 20000 && !s.band() && s.r.settled.to === 'fugitives', '过回合善后：余众进逃户，军撤');
  ok(RB.conclude(s.G, { revoltId: s.r.id, status: 'suppressed' }).handled === false, '了结了的不再认');
  // 受抚
  s = setup();
  s.c.__hw.length = 0;
  res = s.c.TM.RevoltBand.conclude(s.G, { revoltId: s.r.id, status: 'appeased', by: '洪承畴' });
  ok(res.handled && s.r.status === 'appeased' && s.r.leaderFate === 'appeased' && s.c.__hw.length === 0, '受抚：不记平乱皇威');
  ok(s.c.__events.some((e) => e === '民变|【陕西布政使司·延安府】王二一股受抚，众约 6000 人各归原籍'), '事件流记受抚');
  nextTurn(s.c, s.G);
  const pd2 = leafOf(s.G, 'd-yanan').populationDetail;
  ok(pd2.rebels === 0 && pd2.fugitives === 14000 && s.r.settled.to === 'registered' && !s.band(), '受抚的回籍：从乱扣掉，逃户不加，军撤');
  ok(char(s.G, 'c-wang').alive !== false && !char(s.G, 'c-wang')._revoltLeaderOf, '首领在，不再挂着这股');
  // 受过抚的：日后同州再起事，代码不再挑他当首领（天启干跑里受抚的高迎祥两回合后被挑去领西安府那一股）；推演点名照旧认得
  const Lya = s.c.TM.RevoltCases.realmLeaves(s.G).filter((x) => x.node.id === 'd-yanan')[0];
  const pick = s.c.TM.RevoltRising.pickLeader(s.G, Lya, 'smoke-appeased');
  ok(!pick || pick.id !== 'c-wang', '本州只有受过抚的王二：代码不再挑他（实得 ' + (pick && pick.name) + '）');
  const nl2 = s.c.TM.RevoltRising.namedLeader(s.G, '王二');
  ok(nl2 && nl2.ch && nl2.ch.id === 'c-wang' && !nl2.otherPath, '推演点名王二复叛：照旧认他（实得 ' + JSON.stringify(nl2 && { why: nl2.why, other: nl2.otherPath }) + '）');
  // 自散
  s = setup();
  res = s.c.TM.RevoltBand.conclude(s.G, { revoltId: s.r.id, status: 'dispersed' });
  nextTurn(s.c, s.G);
  ok(res.handled && s.r.status === 'dispersed' && leafOf(s.G, 'd-yanan').populationDetail.fugitives === 20000, '自散：进逃户');
  // 认编号：旧账（GM._activeRevolts）、旧式民变的编号不归这里
  s = setup();
  ok(s.c.TM.RevoltBand.conclude(s.G, { revoltId: 'old-1', status: 'suppressed' }).handled === false, '旧式民变的编号：不归这里');
  ok(s.c.TM.RevoltBand.conclude(s.G, { revoltId: 'revolt_huangjin', status: 'suppressed' }).handled === false && s.r.status === 'ongoing', '旧账编号：不归这里，这股不动');
  // 一致性补录：认首领、认州、只说到省（挑人多的）
  s = setup();
  res = s.c.TM.RevoltBand.conclude(s.G, { region: '庆阳', leader: '王二', status: 'suppressed' });
  ok(res.handled && res.revoltId === s.r.id, '给了首领名：认首领');
  s = setup();
  res = s.c.TM.RevoltBand.conclude(s.G, { region: '西安府', status: 'suppressed' });
  ok(res.handled && res.revoltId === s.r.id, '说的那州没有股：在那一省里挑');
  s = setup();
  const r2 = rise(s.c, s.G, 'd-xian', 3000);
  res = s.c.TM.RevoltBand.conclude(s.G, { region: '陕西', status: 'suppressed' });
  ok(res.handled && res.revoltId === s.r.id && r2.status === 'ongoing', '只说到省：挑那省人多的一股（王二 6000，李三 3000）');
  res = s.c.TM.RevoltBand.conclude(s.G, { region: '西安府', status: 'appeased' });
  ok(res.handled && res.revoltId === r2.id && r2.status === 'appeased', '说的那州有股：就是那一股');
  s = setup();
  ok(s.c.TM.RevoltBand.conclude(s.G, { region: '开封府', status: 'suppressed' }).handled === false, '开封府是旧式民变：不归这里');
});

part('五·别处了结的善后；从乱多出的挪进逃户；民2d-1 剿令旧档挂的仗、剿令撤掉', () => {
  const s = setup();
  const pd = leafOf(s.G, 'd-yanan').populationDetail;
  s.r.status = 'pacified';
  s.c.TM.RevoltBand.tick(s.G, { turn: 7 });
  ok(pd.rebels === 0 && pd.fugitives === 14000 && s.r.settled.to === 'registered' && !s.band(), '受抚（旧写法 pacified）：从乱扣掉回籍，逃户不加，军撤（实得 ' + JSON.stringify(s.r.settled) + '）');
  const d = setup();
  const pd2 = leafOf(d.G, 'd-yanan').populationDetail;
  d.r.status = 'dispersed';
  d.G.turn = 7; d.c.TM.RevoltBand.tick(d.G, { turn: 7 });
  ok(pd2.rebels === 0 && pd2.fugitives === 20000 && d.r.settled.to === 'fugitives', '旧五级梯自散：进逃户');
  d.G.turn = 8; d.c.TM.RevoltBand.tick(d.G, { turn: 8 });
  ok(pd2.fugitives === 20000, '一股只善后一次');
  const o = setup();
  const pdx = leafOf(o.G, 'd-xian').populationDetail;
  pdx.rebels = 500;
  o.c.TM.RevoltBand.tick(o.G, { turn: 7 });
  ok(pdx.rebels === 0 && pdx.fugitives === 30500, '西安府从乱 500 而无在的股：挪进逃户');
  ok(leafOf(o.G, 'd-yanan').populationDetail.rebels === 6000, '有在的股的州不动');
  // 旧档：民2d-1 的剿令（r.suppress）与它挂进 GM.activeBattles 的仗
  const L = setup();
  L.G.activeBattles = [{ id: 'sup-x', source: 'revolt-suppress', revoltId: L.r.id, phase: 'engaged' }, { id: 'other', source: 'x', phase: 'engaged' }];
  L.r.suppress = { status: 'marching', armyId: 'a-yansui', battles: [] };
  L.G.turn = 7; L.c.TM.RevoltBand.tick(L.G, { turn: 7 });
  ok(L.G.activeBattles.length === 1 && L.G.activeBattles[0].id === 'other', '剿令挂的仗撤掉，别的仗不动');
  ok(L.r.suppress.status === 'done' && L.r.suppress.end === 'retired' && L.r.status === 'ongoing', '剿令作罢，这股照旧在');
});

part('六·专用的拆了：民变干预面板、调兵数镇压、危机回复认字眼「平乱」、选军框「发兵剿」', () => {
  const { c, G, r } = setup();
  const AC = c.AuthorityComplete;
  ok(typeof AC.suppressRevolt === 'undefined', '调兵数镇压的写口没了');
  ok(typeof c.PhaseD.openRevoltInterventionPanel === 'undefined' && typeof c.PhaseD._interveneRevolt === 'undefined', '民变干预面板（四策）没了');
  const cr = AC.handleCrisisAction({ type: 'revolt', action: 'suppress', revoltId: r.id, troops: 999999 });
  ok(!(cr && cr.ok) && r.status === 'ongoing', '危机处置不再有「民变」一类（实得 ' + JSON.stringify(cr) + '）');
  const old = G.minxin.revolts.filter((x) => x.id === 'old-1')[0];
  const sf = AC.handleCrisisSurfaceResponse({ channel: 'hongyan', revoltId: 'old-1', troops: 999999, text: '鸿雁密令：发兵陕西平乱，勿使民变蔓延。' });
  ok(sf && sf.skipped && old.status === 'ongoing' && !old._suppressionOrder, '鸿雁里写「发兵平乱」：不再按字眼判平（实得 ' + JSON.stringify(sf) + '）');
  ok(AC.inferCrisisActionFromSurface({ text: '廷议：民变四起，宜速发兵镇压讨贼进剿' }) === null, '廷议文字里有民变字眼：不认作危机处置');
  const keys = Object.keys(c.TM.RevoltBand).sort().join(',');
  ok(keys === 'CFG,SOURCE,bandArmy,conclude,ensureArmy,findBand,promptBlock,settle,tick', '民变模块只剩军与账（实得 ' + keys + '）');
  const tb = read('tm-topbar-vars.js');
  ok(!/调兵镇压|_revTroops_|_revT_|panelHtml|RevoltSuppress/.test(tb), '顶栏两处民变清单只留看：没有调兵框、发兵钮');
  ok(!/民变干预/.test(read('tm-player-tools.js')), '圣裁议题里没有「民变干预」');
  ok(!/openRevoltInterventionPanel/.test(read('tm-authority-ui.js')) && !/openRevoltInterventionPanel|RevoltSuppress/.test(read('tm-var-drawers.js')), '民心面板、抽屉没有「干预」入口');
  ok(!/REVOLT_INTERVENTION_WEIGHTS|computeRevoltInterventionOutcome/.test(read('tm-authority-deep.js')), '干预四策按等级算成败的表没了');
  ok(!/openRevoltInterventionPanel|interveneRevolt/.test(read('tm-prophecy.js')), '干预面板代码没了');
  ok(!fs.existsSync(path.join(WEB, 'tm-revolt-suppress.js')), '剿令模块改名 tm-revolt-band.js');
});

part('七·给推演看的各股实情：首领、人数、州、能战、军名、本州主官、附近官军', () => {
  const { c, G, r } = setup();
  const sx = leafOf(G, 'p-sx');
  sx.governor = '胡廷宴'; sx.officialPosition = '陕西巡抚';
  G.chars.push({ id: 'c-hu', name: '胡廷宴', alive: true, faction: '明朝廷' });
  const txt = c.TM.RevoltBand.promptBlock(G);
  ok(/【各地民变——民变案起事的各股/.test(txt), '有标题');
  ok(txt.includes('[id=' + r.id + '] 王二·陕西布政使司·延安府·起于第6回合·众约 6000 人，能战 1560（军「王二部」，势力「民变」，士气 55）'), '首领、州、人数、能战、军名、势力（实得 ' + txt.split('\n')[3] + '）');
  ok(/本州主官：陕西巡抚胡廷宴/.test(txt), '本州主官（州里不设，往上找到巡抚）');
  ok(/附近官军：延绥镇军 25000（帅杜文焕）驻榆林卫·本省；西安卫 2500驻西安府·本省/.test(txt), '附近官军：本省两支，人多的在前');
  ok(!/正白旗|河南兵/.test(txt), '外军、外省的不列');
  ok(/battleResult/.test(txt) && /势力填「民变」/.test(txt) && /revolt_suppress/.test(txt) && /leaderFate/.test(txt) && /revolt_amnesty/.test(txt) && /dissolved/.test(txt), '告诉推演怎么报：交战、剿平、受抚、自散');
  G.armies.filter((a) => a.id === 'a-xian')[0].location = '延安府';
  ok(/附近官军：西安卫 2500驻延安府·本州；延绥镇军/.test(c.TM.RevoltBand.promptBlock(G)), '本州的排在本省的前头');
  r.status = 'suppressed';
  ok(c.TM.RevoltBand.promptBlock(G) === '', '没有在的股：不出这段');
});

part('八·战斗引擎认军先认编号；地形折键', () => {
  const c = sandbox(), G = world();
  c.GM = G; c.P = P();
  G.armies = [
    { id: 'm1', name: '甲营', faction: '明朝廷', soldiers: 10000, morale: 60, training: 60 },
    { id: 'm2', name: '乙营', faction: '明朝廷', soldiers: 10000, morale: 60, training: 60 },
    { id: 'j1', name: '镶蓝旗', faction: '后金', soldiers: 8000, morale: 60, training: 60 }
  ];
  G.activeBattles = [{ id: 'b1', attackerArmyId: 'm2', attackerArmy: '乙营', attackerFaction: '明朝廷', defenderArmyId: 'j1', defenderArmy: '镶蓝旗', defenderFaction: '后金', terrain: 'plains', phase: 'engaged' }];
  c.BattleEngine.resolveAllBattles();
  ok(G.armies[0].soldiers === 10000 && G.armies[1].soldiers < 10000, '编号认到乙营，甲营不动（原先按势力抓到甲营）');
  const tk = c.MilitarySystems.battleTerrainKey;   // 战斗共用件（tm-battle-contract.js）
  ok(tk('山地') === 'mountain' && tk('丘陵') === 'hills' && tk('平原') === 'plains' && tk('林地') === 'forest' && tk('沼泽') === 'swamp' && tk('沙漠') === 'desert' && tk('河流') === 'river', '编辑器七样中文名折键');
  ok(tk('山地丘陵') === 'mountain' && tk('mountain') === 'mountain' && tk('') === 'plains' && tk('不知') === 'plains', '几样取最利守的；英文键原样；认不出当平原');
});

part('九·接线：补录工具认首领下场；旧名、旧写法都不在了（按什么顺序装、过回合在哪步调，由启动清单测试与实跑核）', () => {
  // 补录工具：把 tm-ai-schema.js 装起来，看 record_revolt_events 的参数
  const sc = { window: {}, console: { log() {}, warn() {}, error() {} } };
  sc.window.window = sc.window;
  vm.createContext(sc);
  vm.runInContext(read('tm-ai-schema.js'), sc, { filename: 'tm-ai-schema.js' });
  const tool = (sc.window.TM_AI_SCHEMA.reconcileTools || []).filter((t) => t && t.name === 'record_revolt_events')[0];
  const props = tool && tool.parameters.properties.events.items.properties;
  ok(props && props.leaderFate && props.leaderFate.enum.join(',') === 'captured,killed,escaped', '补录工具多一个首领下场（被擒、伏诛、脱身）');
  ok(props && !props.army && props.action.enum.join(',') === 'start,suppress,appease', '补录工具去掉出兵军名，动作照旧三样');
  // 旧名、旧写法：否定式
  ok(!read('index.html').includes('tm-revolt-suppress.js'), 'index.html 不再装剿令模块');
  ['tm-endturn-systems.js', 'tm-endturn-apply.js', 'tm-endturn-apply-stages.js', 'tm-revolt-rising.js', 'tm-authority-complete.js', 'tm-endturn-ai.js'].forEach((f) => {
    ok(!read(f).includes('RevoltSuppress'), f + ' 不再调剿令模块');
  });
  ok(!/Array\.isArray\(p1\.revolt_(suppress|amnesty|transform)\) && GM\._activeRevolts\)/.test(read('tm-endturn-apply.js')), '主推演剿平、受抚、自散三段不再要求有旧账（GM._activeRevolts）');
  ok(!/army: r\.army/.test(read('tm-endturn-apply-stages.js')), '一致性补录不再带出兵军名');
  ok(!/RevoltBand|RevoltSuppress/.test(read('tm-battle-contract.js')), '战斗共用件不挂民变模块（编辑器也装它）');
});

part('十·战报接皇威只算玩家这方的胜负：剿民变的胜仗与别的仗一样记军胜；我方大胜 +5、小胜 +2（带 AI 量的取它）、我败扣、旁人的仗不碰', () => {
  const { c, G } = setup();
  G.huangwei = { index: 70 };
  const eng = (v, a, d, extra) => Object.assign({ battleId: 'x-' + v + a + d, turn: G.turn, verdict: v, attackerFaction: a, defenderFaction: d, _hwChecked: false }, extra || {});
  G._turnBattleResults = [
    eng('大胜', '明朝廷', '后金'),                                                    // 我攻大胜：+5
    eng('败北', '明朝廷', '后金'),                                                    // 我攻我败：军败
    eng('小胜', '后金', '朝鲜'),                                                      // 旁人的仗：不碰
    eng('僵持', '明朝廷', '后金'),                                                    // 僵持：不碰
    { battleId: 's1', verdict: 'structured', winner: '明朝廷', loser: '后金', _applierAftermathDone: true },   // AI 报的、写回已加过：不再记
    { battleId: 's2', verdict: 'structured', winner: 'f-jin', loser: 'f-ming' },     // 结构化、按势力编号：我败
    { battleId: 's3', verdict: 'structured', winner: '明朝廷', loser: '后金', huangweiDelta: 12 },   // 带 AI 量：取它，封顶 8
    eng('败北', '明朝廷', '民变'),                                                    // 官军为民变所败：照军败扣
    eng('大胜', '明朝廷', '民变'),                                                    // 剿民变大胜：照军胜记（收口后与别的仗一样）
    eng('败北', '后金', '明朝廷')                                                     // 我守我胜：+2
  ];
  c.AuthorityComplete.autoDetectHuangwei({ turn: G.turn }, 1);
  const got = c.__hw.map((h) => h[0] + ':' + h[1]).join(',');
  ok(got === 'militaryVictory:5,militaryDefeat:-10,militaryDefeat:-10,militaryVictory:8,militaryDefeat:-10,militaryVictory:5,militaryVictory:2', '各样战报按玩家胜负记（实得 ' + got + '）');
  c.AuthorityComplete.autoDetectHuangwei({ turn: G.turn }, 1);
  ok(c.__hw.length === 7, '同一批战报不重记');
});

part('十一·胜仗主将记功：引擎结的按大小胜；推演报的在战果写口记，皇威量 6 以上按大胜；民变的军、玩家本人不记；同一仗不重记', () => {
  const { c, G, band } = setup();
  const CE = c.CharEconEngine, MS = c.MilitarySystems;
  const du = char(G, 'c-du');
  CE.ensureCharResources(du);
  const f0 = du.resources.fame || 0, m0 = du.resources.virtueMerit || 0;
  // 推演报的剿胜，皇威量 7：按大胜
  const bid = band().id;
  const br = { battleId: 'ai-h1', winnerFactionId: '明朝廷', loserFactionId: '民变', attackerArmyId: 'a-yansui', defenderArmyId: bid,
    casualties: { attacker: 200, defender: 900 }, huangweiDelta: 7 };
  MS.applyBattleResult(br, G);
  ok(du.resources.fame - f0 === 8 && du.resources.virtueMerit - m0 === 150, '杜文焕：名望 +8（平乱）、贤能 +150（大胜 10×15）（实得 ' + (du.resources.fame - f0) + '/' + (du.resources.virtueMerit - m0) + '）');
  ok(du._fameHistory.slice(-1)[0].reason === 'suppress_revolt' && du._meritLog.slice(-1)[0].reason === '军功·大胜王二部' && G._meritLedger.slice(-1)[0].name === '杜文焕', '名望记「平乱」、功名近账记「军功·大胜王二部」');
  ok(c.__events.some((e) => e === '功名|杜文焕（延绥镇军）大胜王二部，记军功：名望 +8，贤能 +150'), '事件流记我方主将军功');
  const again = MS.applyBattleResult(br, G);
  ok(again.duplicate && du.resources.fame - f0 === 8, '同一仗再报：不重记');
  ok(MS.honorBattleScale({ huangweiDelta: 6 }) === '大胜' && MS.honorBattleScale({ huangweiDelta: 5 }) === '小胜' && MS.honorBattleScale({}) === '小胜' && MS.honorBattleScale({ engineVerdict: '大胜' }) === '大胜', '大小：皇威量 6 以上大胜，其余与没给的小胜；引擎的大胜照认');
  // 引擎结的各样战报（过回合 3.0 后 honorBattleVictors）
  G.chars.push({ id: 'c-zuo', name: '左良玉', alive: true, faction: '明朝廷' }, { id: 'c-dai', name: '代善', alive: true, faction: '后金' });
  G.armies.push({ id: 'a-band2', name: '李三部', faction: '民变', _revoltBand: true, soldiers: 2000, commander: '李三', commanderId: 'c-li', location: '西安府' },
    { id: 'a-emp', name: '亲军', faction: '明朝廷', soldiers: 5000, commander: '朱由校', commanderId: 'c-emp', location: '西安府' });
  const kf = G.armies.filter((a) => a.id === 'a-kf')[0], jin = G.armies.filter((a) => a.id === 'a-jin')[0];
  Object.assign(kf, { commander: '左良玉', commanderId: 'c-zuo' }); Object.assign(jin, { commander: '代善', commanderId: 'c-dai' });
  const eng = (v, a, d) => { const A = G.armies.filter((x) => x.id === a)[0], D = G.armies.filter((x) => x.id === d)[0];
    return { battleId: 'h-' + v + a + d, verdict: v, attackerArmyId: a, defenderArmyId: d, attacker: A.name, defender: D.name, attackerFaction: A.faction, defenderFaction: D.faction }; };
  c.__events.length = 0;
  G._turnBattleResults = [
    eng('小胜', 'a-kf', 'a-jin'),                     // 我方左良玉小胜：名望 +4、贤能 +60
    eng('大胜', 'a-jin', 'a-xian'),                   // 后金代善大胜：照记（不进我方事件流）
    eng('败北', 'a-jin', 'a-kf'),                     // 后金攻、左良玉守住：按小胜记
    eng('大胜', 'a-band2', 'a-xian'),                 // 民变的军胜：不记
    eng('大胜', 'a-emp', 'a-jin'),                    // 玩家本人领兵：不记（皇帝的威在皇威）
    eng('僵持', 'a-kf', 'a-jin'),                     // 僵持：不记
    { battleId: 's-ai', verdict: 'structured', winner: '明朝廷', loser: '后金', _applierAftermathDone: true,
      affectedArmies: [{ armyId: 'a-kf', side: 'attacker', faction: '明朝廷' }] },          // 推演报的、走过写口：这里不再记
    { battleId: 's-qz', verdict: 'structured', winner: 'f-ming', loser: 'f-jin',
      affectedArmies: [{ armyId: 'a-kf', side: 'attacker', faction: '明朝廷' }, { armyId: 'a-jin', side: 'defender', faction: '后金' }] }   // 亲征结的、没走写口：按小胜记
  ];
  const got = MS.honorBattleVictors(G).map((h) => h.name + ':' + h.key + ':' + h.fame + '/' + h.merit).join(',');
  ok(got === '左良玉:military_victory:4/60,代善:military_victory:8/150,左良玉:military_victory:4/60,左良玉:military_victory:4/60', '各样战报记功（实得 ' + got + '）');
  const zuo = char(G, 'c-zuo'), emp = char(G, 'c-emp'), li = char(G, 'c-li');
  ok(zuo.resources.fame === 12 && zuo.resources.virtueMerit === 180, '左良玉三胜：名望 12、贤能 180');
  ok(!(emp.resources && emp.resources.fame) && !(li.resources && li.resources.fame), '玩家本人、民变首领不记');
  ok(c.__events.filter((e) => /^功名\|左良玉/.test(e)).length === 3 && !c.__events.some((e) => /代善/.test(e)), '我方主将进事件流，后金的不进');
  ok(MS.honorBattleVictors(G).length === 0, '同一批不重记');
  // 推演报的对外胜仗，没给皇威量：按小胜
  MS.applyBattleResult({ battleId: 'ai-h2', winnerFactionId: '明朝廷', loserFactionId: '后金', attackerArmyId: 'a-kf', defenderArmyId: 'a-jin', casualties: { attacker: 300, defender: 500 } }, G);
  ok(zuo.resources.fame === 16 && zuo.resources.virtueMerit === 240, '推演报的胜仗没给量：左良玉按小胜记（名望 16、贤能 240）（实得 ' + zuo.resources.fame + '/' + zuo.resources.virtueMerit + '）');
});

console.log('\n[smoke-revolt-band] ' + (failed.length ? 'FAIL' : 'PASS') + ' — ' + checks + ' 项过' + (failed.length ? '；败 ' + failed.length + ' 段：' + failed.join('、') : ''));
process.exit(failed.length ? 1 : 0);
