#!/usr/bin/env node
'use strict';
// smoke-revolt-suppress — 民变重做·民2d-1 发兵剿（施工单民2d；minbian.md「民2d-1」）
//
// 一、起事即立一支军：民变落地（tm-revolt-rising.js land）军册里立「某某部」——归「民变」、首领领兵、驻本州、
//     兵数＝人数 × 本州丁口比、乌合；首领领着自己那一股不算「在任或领兵」（AI 再点他的名还是那一股）。
// 二、玩家发兵：不在那一州的走行军系统（MarchSystem.orderMarch），到了挂一场仗（编号认军、地形折成引擎键），
//     下次过回合真跑战斗引擎（BattleEngine.resolveAllBattles）结算；大胜即散，首领擒杀逃、平乱接皇威、军从军册撤，
//     打掉的能战之人记死（口数、丁数减），随之少的老弱记逃散，剩下的进逃户，从乱扣尽——人数前后对得上。
// 二b、开了地图而军驻地、州名对不上地图节点（天启地图是省一级的地块，地图寻路一律「无路可达」）：改走主推演调兵那套
//     「军队行军」（写 army.destination）；走军令回执的军照回执发令候复；两头都是地图节点而真被挡住的不派；驻地不明的军单列排最后。
// 三、军与人对账：军里少了的按比例折人；别处给它加的兵拉回；挪走的拉回本州。
// 四、战果各样：僵持接着打（再挂一场）、败北剿令作罢（军留原地，可再令）、小胜剩不到三成即散；仗丢了重挂；御驾亲征候指挥。
// 五、别处了结的善后：受抚、赈散的回籍，自散的进逃户；州里从乱多出在的各股的挪进逃户。
// 六、旧路拦住：调兵数镇压、危机回复里写「平乱」、民变干预「强力镇压」都不再直接判平新民变；旧式民变照旧。
// 七、主推演说「镇压」：认首领、认州、只说到省的挑那省人多的一股；点了军名用它，否则派最近的；本省无兵不剿；旧式民变不归这里。
// 八、战斗引擎认军先认编号（原先「军名或势力」一把抓）；地形折键（战斗共用件 MilitarySystems.battleTerrainKey）。
// 九、面板小件、接线（过回合 6.1455 在民变案判定之后、游击连带之前；index.html 紧跟游击连带装载；一致性补录、提示词、各面板）。
// 真跑 tm-utils.js、tm-military.js、tm-battle-contract.js（地形折键在此）、tm-battle-adapter.js、tm-revolt-cases.js、tm-revolt-rising.js、
// tm-revolt-suppress.js、tm-authority-complete.js、tm-prophecy.js。
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

const FILES = ['tm-utils.js', 'tm-military.js', 'tm-battle-contract.js', 'tm-battle-adapter.js', 'tm-command-authority.js',
  'tm-revolt-cases.js', 'tm-revolt-rising.js', 'tm-revolt-suppress.js', 'tm-authority-complete.js', 'tm-prophecy.js'];

function sandbox() {
  const events = [], hw = [];
  const c = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Map, Set, WeakMap,
    isFinite, isNaN, parseInt, parseFloat, Date, Infinity,
    addEB: (cat, text) => events.push(cat + '|' + text), toast() {},
    SettlementPipeline: { register() {} } };
  c.window = c; c.globalThis = c; c.global = c;
  c.TM = {};
  c.AuthorityEngines = { adjustHuangwei: (src, d, why) => { hw.push([src, d, why]); return { ok: true, delta: d }; } };
  vm.createContext(c);
  FILES.forEach((f) => vm.runInContext(read(f), c, { filename: f }));
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
// 过一回合：3.0 战斗 → 行军 → 回合推进 → 6.1455 剿
function endTurn(c, G) {
  c.BattleEngine.resolveAllBattles();
  c.MarchSystem.advanceAll();
  G.turn++;
  return c.TM.RevoltSuppress.tick(G, { turn: G.turn, monthRatio: 1 });
}

console.log('smoke-revolt-suppress — 民2d-1 发兵剿');

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
  // 过回合再补一遍不重立
  c.TM.RevoltSuppress.tick(G, { turn: G.turn });
  ok(G.armies.filter((x) => x._revoltBand).length === 1, '过回合不重立');
  // 剿破被擒下狱的首领，日后同州再起事不再挑他
  const c2 = sandbox(), G2 = world();
  c2.GM = G2; c2.P = P();
  G2.chars[0]._imprisoned = true;
  G2.chars.push({ id: 'c-gao', name: '高迎祥', alive: true, location: '延安府', age: 40, title: '贩马为业', origin: '贩马' });
  const r2 = rise(c2, G2, 'd-yanan', 3000);
  ok(r2.leaderName === '高迎祥', '在押的王二不当首领，改挑高迎祥（实得 ' + r2.leaderName + '）');
});

part('二·玩家发兵：行军、挂仗、战斗引擎真结算、大胜即散；人数前后对得上', () => {
  const { c, G, r, band } = setup();
  const RS = c.TM.RevoltSuppress;
  const cand = RS.candidates(G, r);
  ok(cand.length === 3 && cand[0].army.id === 'a-yansui' && cand[0].rank === 1 && cand[2].army.id === 'a-kf' && cand[2].rank === 2,
    '能调之军：本省的延绥镇军、西安卫，外省的河南兵；后金的、民变自己的不在内（实得 ' + JSON.stringify(cand.map((x) => [x.army.id, x.rank])) + '）');
  const res = RS.order(G, r.id, 'a-yansui', { by: 'player' });
  ok(res.ok && res.status === 'marching', '发兵：不在那一州，走行军（实得 ' + JSON.stringify(res) + '）');
  ok((G.marchOrders || []).length === 1 && G.marchOrders[0].to === '延安府' && G.marchOrders[0].armyId === 'a-yansui', '行军系统真立了一道行军令');
  ok(/赴延安府进剿/.test(RS.statusText(G, r)), '面板写「赴延安府进剿」（实得 ' + RS.statusText(G, r) + '）');
  ok(c.__events.some((e) => /调延绥镇军（杜文焕）剿王二一股，自榆林卫开拔/.test(e)), '事件流记发兵');
  endTurn(c, G);   // 到了，挂仗
  const yansui = G.armies.filter((a) => a.id === 'a-yansui')[0];
  ok(yansui.location === '延安府' && r.suppress.status === 'engaged', '行军到了延安府，剿令转交战');
  const bt = (G.activeBattles || [])[0];
  ok(bt && bt.attackerArmyId === 'a-yansui' && bt.defenderArmyId === band().id && bt.terrain === 'mountain' && bt.phase === 'engaged' && bt.revoltId === r.id,
    '挂一场仗：编号认军、山地折 mountain（实得 ' + JSON.stringify(bt && { a: bt.attackerArmyId, d: bt.defenderArmyId, t: bt.terrain }) + '）');
  const pd = leafOf(G, 'd-yanan').populationDetail;
  const before = { mouths: pd.mouths, ding: pd.ding, fug: pd.fugitives };
  endTurn(c, G);   // 战斗引擎结算 → 读战果
  const hist = (G.battleHistory || []).filter((h) => h.battleId === bt.id)[0];
  ok(hist && hist.verdict === '大胜' && hist.defenderLoss > 0, '战斗引擎真结算：大胜（实得 ' + JSON.stringify(hist && { v: hist.verdict, dl: hist.defenderLoss }) + '）');
  ok(r.status === 'suppressed' && r.endedBy === 'suppress' && ['captured', 'killed', 'escaped'].indexOf(r.leaderFate) >= 0, '这股剿破，首领 ' + r.leaderFate);
  ok(r.suppress.status === 'done' && r.suppress.end === 'broken' && r.suppress.battles.length === 1, '剿令记一仗、了结');
  ok(c.__hw.length === 1 && c.__hw[0][0] === 'suppressRevolt' && c.__hw[0][1] === 4, '平乱接皇威（2 级 +4，同旧规矩）');
  ok(!band(), '王二部从军册撤掉');
  ok(!(G.activeBattles || []).length, '没有剩下的仗');
  const dead = r.band.dead, scat = r.band.scattered, rest = r.settled.n;
  ok(dead === hist.defenderLoss, '打掉的能战之人记死＝战斗引擎给的伤亡 ' + hist.defenderLoss + '（实得 ' + dead + '）');
  ok(pd.mouths === before.mouths - dead && pd.ding === before.ding - dead, '本州口数、丁数各减死者');
  ok(pd.rebels === 0 && pd.fugitives === before.fug + scat + rest, '从乱扣尽，逃散的、剩下的都进逃户');
  ok(dead + scat + rest === 6000, '人数前后对得上：死 ' + dead + ' + 逃散 ' + scat + ' + 剩 ' + rest + ' = 6000');
  const ch = G.chars.filter((x) => x.id === 'c-wang')[0];
  if (r.leaderFate === 'killed') ok(ch.alive === false && /为延绥镇军所斩/.test(ch.deathReason), '首领伏诛记死因');
  if (r.leaderFate === 'captured') ok(ch._imprisoned === true && /为延绥镇军所擒/.test(ch._imprisonReason), '首领被擒下狱');
  if (r.leaderFate === 'escaped') ok(ch.alive !== false && !ch._imprisoned, '首领脱身');
  ok(!ch._revoltLeaderOf, '首领不再挂着这股');
  ok(c.__events.some((e) => /延绥镇军与王二部交战：大胜/.test(e)) && c.__events.some((e) => /剿破王二一股/.test(e)), '事件流记交战、剿破');
  // 同一局同一回合，首领去向可复现
  const again = setup();
  again.c.TM.RevoltSuppress.order(again.G, again.r.id, 'a-yansui', {});
  endTurn(again.c, again.G); endTurn(again.c, again.G);
  ok(again.r.leaderFate === r.leaderFate && again.r.band.dead === dead, '重跑一遍：首领去向、死者数相同（可复现）');
});

part('二b·开了地图而地名对不上地图节点：改走主推演调兵那套「军队行军」；回执军照回执发令；真被挡住的不派', () => {
  // 天启：地图是省一级的地块（ming-11＝陕西），军驻地写「榆林」，地图寻路一律「无路可达」
  let s = setup({ map: { enabled: true } });
  s.G.mapData = { adjacencyGraph: { 'ming-11': [], 'ming-09': [] } };
  s.c.findPath = () => null;
  const RS = s.c.TM.RevoltSuppress;
  let res = RS.order(s.G, s.r.id, 'a-yansui', {});
  const ys = s.G.armies.filter((a) => a.id === 'a-yansui')[0];
  ok(res.ok && res.status === 'marching' && s.r.suppress.via === 'destination', '认不出地名：改写去向（实得 ' + JSON.stringify(res) + '）');
  ok(ys.destination === '延安府' && !(s.G.marchOrders || []).length, '去向写到军上（军队行军按它走），行军系统不立令');
  ok(s.c.__events.some((e) => /行军\|延绥镇军接令调往延安府/.test(e)), '事件流记「接令调往」，与主推演调兵同一句');
  ok(/赴延安府进剿/.test(RS.statusText(s.G, s.r)) && RS.candidates(s.G, s.r).filter((x) => x.army.id === 'a-yansui')[0].rank === -1, '在途：面板写赴剿，选军框列为在途');
  // 军队行军到了（tm-feudal-warfare.js：location ← destination）
  ys.location = ys.destination; ys.garrison = ys.destination; ys.destination = '';
  s.G.turn = 7; RS.tick(s.G, { turn: 7 });
  ok(s.r.suppress.status === 'engaged' && (s.G.activeBattles || []).length === 1, '到了：挂仗');
  // 回执军（绍宋御营那类）：照回执发令候复，不直接写去向
  s = setup({ map: { enabled: true } });
  s.G.mapData = { adjacencyGraph: { 'ming-11': [] } };
  s.c.findPath = () => null;
  const ys2 = s.G.armies.filter((a) => a.id === 'a-yansui')[0];
  ys2.commandChain = { mode: 'receipt', custodians: [{ characterId: 'c-du' }], dispatchDays: 0 };
  res = s.c.TM.RevoltSuppress.order(s.G, s.r.id, 'a-yansui', {});
  ok(res.ok && res.status === 'awaiting' && s.r.suppress.via === 'receipt' && s.r.suppress.commandOrderId && !ys2.destination, '回执军：发令候军中回报（实得 ' + JSON.stringify(res) + '）');
  ok(/候军中回报/.test(s.c.TM.RevoltSuppress.statusText(s.G, s.r)), '面板写候军中回报');
  ys2.destination = '延安府';   // 军中回报奉行，主推演 army_changes 写去向
  s.G.turn = 7; s.c.TM.RevoltSuppress.tick(s.G, { turn: 7 });
  ok(s.r.suppress.status === 'marching', '奉行后在途');
  // 两头都是地图节点而真无路（敌境挡住）：不派
  s = setup({ map: { enabled: true } });
  s.G.armies.filter((a) => a.id === 'a-yansui')[0].location = 'ming-11';
  s.G.armies.filter((a) => a.id === 'a-yansui')[0].garrison = 'ming-11';
  s.G.mapData = { adjacencyGraph: { 'ming-11': [], '延安府': [] } };
  s.c.findPath = () => null;
  res = s.c.TM.RevoltSuppress.order(s.G, s.r.id, 'a-yansui', {});
  ok(!res.ok && /无路可达/.test(res.reason) && !s.r.suppress, '真被挡住：不派（实得 ' + JSON.stringify(res) + '）');
  // 驻地不明的军单列一档，主推演不派它
  const s3 = setup();
  s3.G.armies.push({ id: 'a-all', name: '全国卫所军·总览', faction: '明朝廷', soldiers: 1300000, location: '全国 329 卫+358 千户所', garrison: '全国 329 卫+358 千户所' });
  const c3 = s3.c.TM.RevoltSuppress.candidates(s3.G, s3.r);
  ok(c3[c3.length - 1].army.id === 'a-all' && c3[c3.length - 1].rank === 3 && /驻地不明/.test(c3[c3.length - 1].label), '驻地不明的排最后（实得 ' + JSON.stringify(c3.map((x) => [x.army.id, x.rank])) + '）');
});

part('三·军与人对账：少的按比例折人；加的拉回；挪走的拉回本州', () => {
  const { c, G, r, band } = setup();
  const a = band(), pd = leafOf(G, 'd-yanan').populationDetail;
  a.soldiers = 1404;   // 少一成
  G.turn = 7; c.TM.RevoltSuppress.tick(G, { turn: 7 });
  ok(r.followers === 5400 && r.scale === 5400, '军少一成，人少一成：5400（实得 ' + r.followers + '）');
  ok(r.band.dead === 156 && r.band.scattered === 444, '能战之人 156 记死，老弱 444 记逃散（实得 ' + r.band.dead + '/' + r.band.scattered + '）');
  ok(pd.mouths === 300000 - 156 && pd.ding === 78000 - 156 && pd.rebels === 5400 && pd.fugitives === 14000 + 444, '本州户口照记');
  a.soldiers = 9999; a.location = '西安府'; a.garrison = '西安府';
  G.turn = 8; c.TM.RevoltSuppress.tick(G, { turn: 8 });
  ok(a.soldiers === 1404 && a.size === 1404, '别处给它加的兵拉回人数折的兵（实得 ' + a.soldiers + '）');
  ok(a.location === '延安府' && a.garrison === '延安府', '挪走的拉回本州');
  ok(r.followers === 5400, '人数不跟着加');
});

part('四·战果各样：僵持再打、败北作罢可再令、小胜剩不到三成即散；仗丢了重挂；御驾亲征候指挥；同回合不重走', () => {
  const { c, G, r, band } = setup();
  const RS = c.TM.RevoltSuppress;
  G.armies.filter((a) => a.id === 'a-xian')[0].location = '延安府';
  const res = RS.order(G, r.id, 'a-xian', { by: 'player' });
  ok(res.ok && res.status === 'engaged' && G.activeBattles.length === 1, '本州之军就地进剿，当即挂仗（实得 ' + JSON.stringify(res) + '）');
  ok(/过回合接战/.test(RS.statusText(G, r)), '面板写「过回合接战」');
  function fake(verdict) {
    const id = r.suppress.battleId;
    G.activeBattles = G.activeBattles.filter((b) => b.id !== id);
    G.battleHistory = (G.battleHistory || []).concat([{ battleId: id, verdict: verdict, attackerLoss: 100, defenderLoss: 50, turn: G.turn }]);
    return id;
  }
  const id1 = fake('僵持');
  G.turn = 7; RS.tick(G, { turn: 7 });
  ok(r.status === 'ongoing' && r.suppress.status === 'engaged' && r.suppress.battleId && r.suppress.battleId !== id1 && G.activeBattles.length === 1, '僵持：接着打，再挂一场');
  ok(RS.tick(G, { turn: 7 }) === null && G.activeBattles.length === 1, '同一回合再走一遍：不重挂');
  // 御驾亲征交玩家指挥
  G.activeBattles[0].phase = 'awaiting-command';
  G.turn = 8; RS.tick(G, { turn: 8 });
  ok(r.suppress.status === 'awaiting-command' && /御驾亲征/.test(RS.statusText(G, r)), '仗候御驾亲征指挥：剿令等着');
  // 仗丢了（读档丢了、结算没跑）：重挂
  G.activeBattles = [];
  G.turn = 9; RS.tick(G, { turn: 9 });
  ok(G.activeBattles.length === 1 && r.suppress.status === 'engaged', '仗丢了又没战果：重挂一场');
  fake('败北');
  G.turn = 10; RS.tick(G, { turn: 10 });
  ok(r.status === 'ongoing' && r.suppress.status === 'done' && r.suppress.end === 'defeated' && !G.activeBattles.length, '败北：剿令作罢，没剩的仗');
  ok(G.armies.filter((a) => a.id === 'a-xian')[0].location === '延安府', '官军留在原地');
  ok(c.__events.some((e) => /西安卫进剿败北，剿令作罢/.test(e)), '事件流记败北');
  const re = RS.order(G, r.id, 'a-xian', {});
  ok(re.ok && re.status === 'engaged', '可再令（实得 ' + JSON.stringify(re) + '）');
  // 小胜：剩得多接着打，剩不到三成即散
  fake('小胜');
  G.turn = 11; RS.tick(G, { turn: 11 });
  ok(r.status === 'ongoing' && r.suppress.status === 'engaged', '小胜而剩得多：接着打');
  band().soldiers = Math.floor(1560 * 0.2);
  fake('小胜');
  G.turn = 12; RS.tick(G, { turn: 12 });
  ok(r.status === 'suppressed' && r.suppress.end === 'broken', '小胜而剩不到三成：散');
  // 打光了（推演给的战果、别处减的）：散
  const s2 = setup();
  s2.band().soldiers = 0;
  s2.c.TM.RevoltSuppress.tick(s2.G, { turn: 7 });
  ok(s2.r.status === 'suppressed' && s2.r.endedBy === 'collapse' && !s2.band(), '能打的没了：散（collapse），军撤');
});

part('四b·发兵的各种拦：外军、民变自己的军、已在剿别股的军、在途去别处的、剧本没开战斗结算', () => {
  const { c, G, r, band } = setup();
  const RS = c.TM.RevoltSuppress;
  ok(/非我王师/.test(RS.order(G, r.id, 'a-jin', {}).reason), '后金的军不受节制');
  ok(/查无此军/.test(RS.order(G, r.id, band().id, {}).reason), '民变自己的军不能调');
  const r2 = rise(c, G, 'd-xian', 3000);
  ok(RS.order(G, r2.id, 'a-xian', {}).ok, '西安卫就地剿西安府一股');
  ok(/正在剿西安府/.test(RS.order(G, r.id, 'a-xian', {}).reason || ''), '已在剿别股的军不能再调（实得 ' + JSON.stringify(RS.order(G, r.id, 'a-xian', {})) + '）');
  ok(!RS.candidates(G, r).some((x) => x.army.id === 'a-xian'), '选军框里也不列它');
  const kf = G.armies.filter((a) => a.id === 'a-kf')[0];
  kf.state = 'marching'; kf.destination = '西安府';
  ok(/已在途中/.test(RS.order(G, r.id, 'a-kf', {}).reason || ''), '在途去别处的不能调');
  const off = setup({ battleConfig: { enabled: false } });
  ok(/未开战斗结算/.test(off.c.TM.RevoltSuppress.order(off.G, off.r.id, 'a-yansui', {}).reason || ''), '剧本没开战斗结算：不派');
  ok(off.c.TM.RevoltSuppress.fromAI(off.G, { region: '延安府' }).handled === false, '剧本没开战斗结算：主推演说镇压照旧判平');
  ok(/调兵数镇压/.test(RS.order(G, 'old-1', 'a-kf', {}).reason || ''), '旧式民变不走这里');
});

part('五·别处了结的善后：受抚、赈散回籍，自散进逃户；从乱多出的挪进逃户', () => {
  const s = setup();
  const pd = leafOf(s.G, 'd-yanan').populationDetail;
  s.r.status = 'pacified';
  s.c.TM.RevoltSuppress.tick(s.G, { turn: 7 });
  ok(pd.rebels === 0 && pd.fugitives === 14000 && s.r.settled.to === 'registered' && !s.band(), '受抚：从乱扣掉回籍，逃户不加，军撤（实得 ' + JSON.stringify(s.r.settled) + '）');
  const d = setup();
  const pd2 = leafOf(d.G, 'd-yanan').populationDetail;
  d.r.status = 'dispersed';
  d.G.turn = 7; d.c.TM.RevoltSuppress.tick(d.G, { turn: 7 });
  ok(pd2.rebels === 0 && pd2.fugitives === 20000 && d.r.settled.to === 'fugitives', '自散：进逃户');
  d.G.turn = 8; d.c.TM.RevoltSuppress.tick(d.G, { turn: 8 });
  ok(pd2.fugitives === 20000, '一股只善后一次');
  const o = setup();
  const pdx = leafOf(o.G, 'd-xian').populationDetail;
  pdx.rebels = 500;
  o.c.TM.RevoltSuppress.tick(o.G, { turn: 7 });
  ok(pdx.rebels === 0 && pdx.fugitives === 30500, '西安府从乱 500 而无在的股：挪进逃户');
  ok(leafOf(o.G, 'd-yanan').populationDetail.rebels === 6000, '有在的股的州不动');
});

part('六·旧路拦住：调兵数、危机回复「平乱」、干预「强力镇压」不再直接判平新民变；赈散回籍；旧式照旧', () => {
  const { c, G, r } = setup();
  const AC = c.AuthorityComplete;
  const a1 = AC.suppressRevolt(r.id, 999999);
  ok(a1 && a1.ok === false && !r._suppressionOrder, '调兵数镇压：新民变不认（实得 ' + JSON.stringify(a1) + '）');
  ok(AC.suppressRevolt('old-1', 70000).ok === true, '旧式民变照旧');
  const cr = AC.handleCrisisAction({ type: 'revolt', action: 'suppress', revoltId: r.id, troops: 999999 });
  ok(r.status === 'ongoing' && !(cr && cr.ok), '危机回复写「平乱」：新民变不就此判平');
  const pv = c.PhaseD._interveneRevolt(r.id, 'suppress');
  ok(pv && pv.ok === false && r.status === 'ongoing', '民变干预「强力镇压」：要选军');
  const rl = c.PhaseD._interveneRevolt(r.id, 'relief');
  ok(rl && rl.ok && r.status === 'suppressed' && r.endedBy === 'relief', '赈济绥民：这股自散，记赈散');
  c.TM.RevoltSuppress.tick(G, { turn: 7 });
  const pd = leafOf(G, 'd-yanan').populationDetail;
  ok(pd.rebels === 0 && pd.fugitives === 14000 && r.settled.to === 'registered', '赈散的回籍');
  const src = read('tm-authority-complete.js');
  ok(/r\.source === 'revolt-cases' && r\._suppressionOrder\) delete r\._suppressionOrder/.test(src), '五级梯 tick 里新民变的旧镇压令删掉不认');
});

part('七·主推演说「镇压」：认首领、认州、只说到省；点了军名用它；本省无兵不剿；旧式不归这里', () => {
  let s = setup();
  let res = s.c.TM.RevoltSuppress.fromAI(s.G, { by: 'reconcile', region: '陕西', reason: '官军进剿' });
  ok(res.handled && res.ok && s.r.suppress && s.r.suppress.armyId === 'a-yansui' && s.r.suppress.by === 'reconcile', '只说到省：派本省兵多的延绥镇军（实得 ' + JSON.stringify(res) + '）');
  res = s.c.TM.RevoltSuppress.fromAI(s.G, { by: 'reconcile', region: '陕西' });
  ok(res.handled && res.already, '已在剿：不再派');
  s = setup();
  res = s.c.TM.RevoltSuppress.fromAI(s.G, { by: 'reconcile', region: '延安府', army: '西安卫' });
  ok(res.ok && s.r.suppress.armyId === 'a-xian', 'AI 点了西安卫：用它');
  s = setup();
  res = s.c.TM.RevoltSuppress.fromAI(s.G, { by: 'reconcile', region: '庆阳', leader: '王二' });
  ok(res.ok && res.revoltId === s.r.id, '给了首领名：认首领');
  s = setup();
  res = s.c.TM.RevoltSuppress.fromAI(s.G, { by: 'reconcile', region: '西安府' });
  ok(res.ok && res.revoltId === s.r.id, '说的那州没有股：在那一省里挑');
  s = setup();
  s.G.armies = s.G.armies.filter((a) => a.faction !== '明朝廷' || a.id === 'a-kf');
  res = s.c.TM.RevoltSuppress.fromAI(s.G, { by: 'reconcile', region: '延安府' });
  ok(res.handled && res.ok === false && !s.r.suppress && s.c.__events.some((e) => /剿议未行：本省无官军可调/.test(e)), '本省无兵：不剿，记一笔（外省河南兵不派）');
  s = setup();
  ok(s.c.TM.RevoltSuppress.fromAI(s.G, { by: 'reconcile', region: '开封府' }).handled === false, '开封府是旧式民变：不归这里');
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

part('九·面板小件与接线', () => {
  const { c, G, r } = setup();
  const RS = c.TM.RevoltSuppress;
  const html = RS.panelHtml(G, r, { idPrefix: '_x_', after: 'void 0;' });
  ok(/<select id="_x_rv-d-yanan-t6"/.test(html) && /延绥镇军 25000兵/.test(html) && !/正白旗|王二部/.test(html), '没在剿：选军框列可调之军（不列外军、民变的军）');
  ok(/TM\.RevoltSuppress\.orderFromUI\('rv-d-yanan-t6','_x_rv-d-yanan-t6'\);void 0;/.test(html) && />发兵剿</.test(html), '「发兵剿」钮调 orderFromUI，接面板自己的重绘');
  RS.order(G, r.id, 'a-yansui', {});
  const h2 = RS.panelHtml(G, r, {});
  ok(/赴延安府进剿/.test(h2) && !/<select/.test(h2), '在剿：只写进展');
  const idx = read('index.html');
  const iC = idx.indexOf('tm-revolt-cases.js'), iR = idx.indexOf('tm-revolt-rising.js'), iG = idx.indexOf('tm-revolt-guerrilla.js'), iS = idx.indexOf('tm-revolt-suppress.js');
  ok(iC > 0 && iC < iR && iR < iG && iG < iS, 'index.html：民变案、落地、游击连带之后装载剿');
  const sys = read('tm-endturn-systems.js');
  const tC = sys.indexOf('TM.RevoltCases.tick('), tS = sys.indexOf('TM.RevoltSuppress.tick('), tG = sys.indexOf('TM.RevoltGuerrilla.tick(');
  ok(tC > 0 && tC < tS && tS < tG, '过回合：民变案判定 → 剿 → 游击连带');
  const ap = read('tm-endturn-apply-stages.js');
  const aF = ap.indexOf('TM.RevoltSuppress.fromAI(GM, { by: \'reconcile\''), aO = ap.indexOf('var openR = GM.minxin.revolts.find');
  ok(aF > 0 && aF < aO && /army: r\.army\|\|''/.test(ap) && /if \(_supR && _supR\.handled\) return;/.test(ap), '一致性补录：说镇压先交 fromAI，带上军名');
  ok(/army: \{ type: 'string', description: '镇压时出兵的我方军队名/.test(read('tm-ai-schema.js')), '补录工具多一个可选的出兵军名');
  const tb = read('tm-topbar-vars.js');
  ok((tb.match(/TM\.RevoltSuppress\.panelHtml\(GM, r,/g) || []).length === 2, '顶栏两处民变面板接选军发兵');
  ok(/global\.TM\.RevoltSuppress\.statusText\(G, r\)/.test(read('tm-var-drawers.js')), '民心抽屉写进剿进展');
  ok(/global\.TM\.RevoltSuppress\.panelHtml\(G, revolt,/.test(read('tm-prophecy.js')), '民变干预面板：新民变给选军发兵');
  const br = read('tm-border-risk.js');
  ok((br.match(/!a\._revoltBand/g) || []).length === 2, '边患：民变的军不算本地守军，也不记军费');
  ok(/if \(a\._revoltBand\) return false;/.test(read('tm-revolt-rising.js')) && /TM\.RevoltSuppress\.ensureArmy\(G, revolt, L\)/.test(read('tm-revolt-rising.js')), '落地立军、首领领自己的股不算在任');
});

part('十·战报接皇威只算玩家这方的胜负：剿胜归平乱不另记、不当军败；我胜 +2（带 AI 量的取它）、我败扣、旁人的仗不碰', () => {
  // 原先战报没有「我方胜」一栏（b.win 从没人写），每一仗——不分胜负、连不关玩家的——都当军败扣皇威，剿胜一仗反扣 10
  const { c, G, r } = setup();
  G.huangwei = { index: 70 };
  c.TM.RevoltSuppress.order(G, r.id, 'a-yansui', {});
  endTurn(c, G); endTurn(c, G);   // 真跑战斗引擎：剿破
  const real = (G._turnBattleResults || []).filter((b) => b.defenderFaction === '民变')[0];
  ok(real && real.verdict === '大胜' && r.status === 'suppressed', '剿战真结算大胜、这股散了（实得 ' + JSON.stringify(real && real.verdict) + '）');
  c.__hw.length = 0;
  c.AuthorityComplete.autoDetectHuangwei({ turn: G.turn }, 1);
  ok(c.__hw.length === 0, '剿胜一仗：不记军败，也不另记军胜（平乱在那一股散时已记）（实得 ' + JSON.stringify(c.__hw) + '）');
  const eng = (v, a, d, extra) => Object.assign({}, real, { battleId: 'x-' + v + a + d, verdict: v, attackerFaction: a, defenderFaction: d, _hwChecked: false }, extra || {});
  G._turnBattleResults = [
    eng('大胜', '明朝廷', '后金'),                                                    // 我攻我胜：+2（P-5TK 保底）
    eng('败北', '明朝廷', '后金'),                                                    // 我攻我败：军败
    eng('小胜', '后金', '朝鲜'),                                                      // 旁人的仗：不碰
    eng('僵持', '明朝廷', '后金'),                                                    // 僵持：不碰
    { battleId: 's1', verdict: 'structured', winner: '明朝廷', loser: '后金', _applierAftermathDone: true },   // AI 报的、写回已加过：不再记
    { battleId: 's2', verdict: 'structured', winner: 'f-jin', loser: 'f-ming' },     // 结构化、按势力编号：我败
    { battleId: 's3', verdict: 'structured', winner: '明朝廷', loser: '后金', huangweiDelta: 12 },   // 带 AI 量：取它，封顶 8
    eng('败北', '明朝廷', '民变'),                                                    // 官军为民变所败：照军败扣
    eng('败北', '后金', '明朝廷')                                                     // 我守我胜：+2
  ];
  c.AuthorityComplete.autoDetectHuangwei({ turn: G.turn }, 1);
  const got = c.__hw.map((h) => h[0] + ':' + h[1]).join(',');
  ok(got === 'militaryVictory:2,militaryDefeat:-10,militaryDefeat:-10,militaryVictory:8,militaryDefeat:-10,militaryVictory:2', '各样战报按玩家胜负记（实得 ' + got + '）');
  c.AuthorityComplete.autoDetectHuangwei({ turn: G.turn }, 1);
  ok(c.__hw.length === 6, '同一批战报不重记');
});

console.log('\n[smoke-revolt-suppress] ' + (failed.length ? 'FAIL' : 'PASS') + ' — ' + checks + ' 项过' + (failed.length ? '；败 ' + failed.length + ' 段：' + failed.join('、') : ''));
process.exit(failed.length ? 1 : 0);
