#!/usr/bin/env node
'use strict';
// smoke-capital-fall — 京师陷落（破京）：京城所在的地块归了朝廷以外的势力，就走破京裁决，谁攻下的都一样（民变重做·成势，11-18）
//
// 一、守着时不判，只记「守着」；易主给别家（民变成的势力、外敌都算）→ 破京：落旗、记谁打下的、定命；只破一次。
//     京城名不是地块名的（天启写「北京」）：现行地图走地名解析，旧档旧图按别称认区划。
// 二、没见朝廷守过的不判（开局就不在手里）；京城名认不出不判、不抛错。
// 三、定命交 AI：AI 在就排一幕，演出 captured 就被执、不叫裁决器；演不出（回的不是三择其一）按殉国走裁决器。
// 四、定命三择其一落账：被执续玩、出走续玩、殉国只走玩家之死裁决器（继统续玩）、菜单外按殉国；裁决器缺席回落经典终局信号。
// （原第五段「旧梯第 5 级的破京三拍删了」11-21 删旧时随五级梯、旧三件套一起去掉，旧档折算见 smoke-revolt-legacy。）
// 真跑 tm-faction-membership.js（易主写口、认地块）、tm-capital-fall.js、tm-utils.js（别称表）、tm-map-locations.js（地名解析）。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.resolve(__dirname, '..');
let checks = 0;
const failed = [];
function ok(v, m) { if (!v) throw new Error(m); checks++; }
async function part(name, fn) {
  try { await fn(); console.log('  ✓ ' + name); }
  catch (e) { failed.push(name); console.log('  ✗ ' + name + '：' + String((e && e.stack) || e).slice(0, 400)); }
}

function world() {
  return {
    turn: 30, _capital: '顺天府', eraName: '崇祯十七年',
    playerInfo: { factionName: '大明' },
    adminHierarchy: { player: { divisions: [{ id: 'p-bz', name: '北直隶', children: [
      { id: 'd-shuntian', name: '顺天府', owner: '大明' },
      { id: 'd-baoding', name: '保定府', owner: '大明' }
    ] }] } },
    facs: [{ id: 'f-ming', name: '大明', isPlayer: true }, { id: 'f-dashun', name: '大顺', leader: '李自成' }, { id: 'f-jin', name: '后金', leader: '皇太极' }],
    chars: [{ id: 'c-emp', name: '朱由检', isPlayer: true, alive: true }, { id: 'c-li', name: '李自成', alive: true, faction: '大顺' }],
    armies: [], _chronicle: []
  };
}
function sandbox(opts) {
  opts = opts || {};
  const events = [], adj = [];
  const c = { console: { log() {}, warn() {}, error() {}, info() {} }, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, TypeError,
    Map, Set, WeakMap, Promise, Symbol, isFinite, isNaN, parseInt, parseFloat, Date, Infinity,
    addEB: (cat, text) => events.push(cat + '|' + text) };
  c.window = c; c.globalThis = c; c.global = c;
  c.TM = {};
  if (opts.adjudicate) c.adjudicatePlayerDeath = (ch, cause, o) => { adj.push({ name: ch.name, cause, kind: o && o.kind }); return opts.adjudicate; };
  if (opts.ai) c.callAI = async () => opts.ai;
  vm.createContext(c);
  ['tm-faction-membership.js', 'tm-capital-fall.js'].concat(opts.extra || []).forEach((f) => vm.runInContext(fs.readFileSync(path.join(WEB, f), 'utf8'), c, { filename: f }));
  c.GM = opts.G || world();
  c.__events = events; c.__adj = adj;
  return c;
}
function take(c, regionId, facId) {
  c.TM.FactionMembership.applyProvinceTransfers([{ regionRef: regionId, newOwner: facId, reason: '攻城' }], { reason: '攻城' });
}
const flush = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  console.log('smoke-capital-fall — 京师陷落：京城所在的地块归了朝廷以外的势力就破京（11-18）');

  await part('一·守着时不判；易主给民变成的势力 → 破京：落旗、记谁打下的、定命（AI 不在当场按殉国，走裁决器继统）；只破一次', () => {
    const c = sandbox({ adjudicate: { outcome: 'succession', heir: '太子' } }), G = c.GM, CF = c.TM.CapitalFall;
    ok(CF.check(G) === null && !G._capitalFallen && G._capitalHeld && G._capitalHeld.regionId === 'd-shuntian', '京城还在朝廷手里：不判，记下守着');
    take(c, 'd-baoding', 'f-dashun');
    ok(CF.check(G) === null && !G._capitalFallen, '丢的是保定府不是京城：不判');
    take(c, 'd-shuntian', 'f-dashun');
    ok(c.TM.FactionMembership.regionInfo('顺天府').owner === '大顺', '前提：顺天府走易主写口归了大顺');
    const res = CF.check(G);
    ok(G._capitalFallen === true && G._capitalFall.by === '大顺' && G._capitalFall.regionId === 'd-shuntian' && G._capitalFall.capital === '顺天府', '破京：落旗、记下大顺打下的顺天府（实得 ' + JSON.stringify(G._capitalFall) + '）');
    ok(c.__events.some((e) => e === '国变|京师陷落！「大顺」入据顺天府·社稷倾覆在即'), '事件在落旗之后写');
    ok(c.__adj.length === 1 && c.__adj[0].name === '朱由检' && c.__adj[0].kind === 'regicide' && res && res.outcome === 'succession', 'AI 不在：当场按殉国，只走玩家之死裁决器（实得 ' + JSON.stringify(c.__adj) + '）');
    ok(G._dynastyFallInfo && G._dynastyFallInfo.facName === '大顺' && G._dynastyFallInfo.leader === '李自成' && G._dynastyFallInfo.fate === 'succession' && !G._gameOver, '继统续玩、不终局；终局信息记入城的一方与为首者');
    ok(c.__events.some((e) => e.indexOf('嗣君于乱军之外继统') >= 0), '继统落起居注');
    ok(CF.check(G) === null && c.__adj.length === 1, '只破一次');
  });

  await part('一b·外敌打下京城也算（同志 11-18 定「甲」：朝廷以外的任何势力都算）', () => {
    const c = sandbox({ adjudicate: { outcome: 'gameover' } }), G = c.GM, CF = c.TM.CapitalFall;
    CF.check(G);
    take(c, 'd-shuntian', 'f-jin');
    CF.check(G);
    ok(G._capitalFallen === true && G._capitalFall.by === '后金' && c.__adj.length === 1 && !G._gameOver, '后金破京；裁决器定终局时不另写终局信号（实得 ' + JSON.stringify(G._capitalFall) + '）');
  });

  await part('一c·京城名不是地块名（天启写「北京」，那块地叫顺天府）：现行地图走全游戏的地名解析，旧档旧图按别称认区划（11-18 天启干跑查出）', () => {
    const extra = ['tm-utils.js', 'tm-map-locations.js'];
    const G = world(); G._capital = '北京';
    const c = sandbox({ G, adjudicate: { outcome: 'gameover' }, extra }), CF = c.TM.CapitalFall;
    const info = CF.capitalInfo(G);
    ok(info && info.id === 'd-shuntian' && info.owner === '大明', '旧图上没有这块地：「北京」按别称认到顺天府这个区划（实得 ' + JSON.stringify(info && { id: info.id, owner: info.owner }) + '）');
    CF.check(G); take(c, 'd-shuntian', 'f-dashun'); CF.check(G);
    ok(G._capitalFallen === true && G._capitalFall.by === '大顺' && G._capitalFall.regionName === '顺天府' && G._capitalFall.capital === '北京', '顺天府归了大顺：破京（实得 ' + JSON.stringify(G._capitalFall) + '）');
    const G2 = world(); G2._capital = '北京';
    G2.mapData = { regions: [{ id: 'r-shuntian', name: '顺天府', adminBinding: 'd-shuntian' }, { id: 'r-baoding', name: '保定府', adminBinding: 'd-baoding' }] };
    const c2 = sandbox({ G: G2, adjudicate: { outcome: 'gameover' }, extra }), CF2 = c2.TM.CapitalFall;
    const info2 = CF2.capitalInfo(G2);
    ok(info2 && info2.id === 'r-shuntian' && info2.owner === '大明', '现行地图：「北京」走地名解析认到顺天府那块地（实得 ' + JSON.stringify(info2 && { id: info2.id, owner: info2.owner }) + '）');
    CF2.check(G2); take(c2, 'r-shuntian', 'f-dashun'); CF2.check(G2);
    ok(G2._capitalFallen === true && G2._capitalFall.regionId === 'r-shuntian' && G2._capitalFall.by === '大顺', '那块地归了大顺：破京');
  });

  await part('二·没见朝廷守过的不判；京城名认不出不判、不抛错', () => {
    const G = world();
    G.adminHierarchy.player.divisions[0].children[0].owner = '后金';
    const c = sandbox({ G, adjudicate: { outcome: 'gameover' } });
    ok(c.TM.CapitalFall.check(G) === null && !G._capitalFallen && c.__adj.length === 0, '开局京城就不在朝廷手里：不判');
    const G2 = world(); G2._capital = '没有这个地方';
    const c2 = sandbox({ G: G2, adjudicate: { outcome: 'gameover' } });
    ok(c2.TM.CapitalFall.check(G2) === null && !G2._capitalFallen, '京城名认不出：不判');
  });

  await part('三·定命交 AI：演出被执就被执、不叫裁决器；回的不是三择其一按殉国', async () => {
    const c = sandbox({ adjudicate: { outcome: 'gameover' }, ai: '{"fate":"captured","scene":"闯军突入大内·君上为贼所执·幽于偏殿"}' }), G = c.GM, CF = c.TM.CapitalFall;
    CF.check(G); take(c, 'd-shuntian', 'f-dashun');
    const res = CF.check(G);
    ok(res && res.scheduled === true && G._capitalFallen === true && G._capitalFall.scenePending === 30, 'AI 在：排一幕定命，落旗照常');
    await flush();
    const emp = G.chars[0];
    ok(emp._captured === true && emp._capturedBy === '大顺' && emp._capturedLocation === '大顺军中' && c.__adj.length === 0, '被执续玩：不叫裁决器（实得 ' + JSON.stringify({ cap: emp._captured, by: emp._capturedBy, adj: c.__adj.length }) + '）');
    ok(G._chronicle.some((x) => x.type === '国变' && x.text.indexOf('幽于偏殿') >= 0) && G._capitalFall.fate === 'captured', 'AI 演的一幕入史');
    const c2 = sandbox({ adjudicate: { outcome: 'gameover' }, ai: '{"fate":"登仙","scene":"白日飞升"}' }), G2 = c2.GM;
    c2.TM.CapitalFall.check(G2); take(c2, 'd-shuntian', 'f-dashun'); c2.TM.CapitalFall.check(G2);
    await flush();
    ok(c2.__adj.length === 1 && !G2.chars[0]._captured && !G2._chronicle.length, '回的不是三择其一：按殉国走裁决器，不入史');
  });

  await part('四·定命三择其一落账：出走续玩；菜单外按殉国；裁决器缺席回落经典终局信号', () => {
    const c = sandbox({ adjudicate: { outcome: 'gameover' } }), G = c.GM, CF = c.TM.CapitalFall;
    const r1 = CF.applyOutcome(G, { by: '大顺', regionName: '顺天府' }, { fate: 'escaped' });
    ok(r1.fate === 'escaped' && !G.chars[0]._captured && c.__adj.length === 0 && G._dynastyFallInfo.fate === 'escaped', '出走：自由身续玩');
    ok(c.__events.some((e) => e.indexOf('诏天下兵马勤王') >= 0), '出走落起居注');
    CF.applyOutcome(G, { by: '大顺' }, { fate: '登仙' });
    ok(c.__adj.length === 1, '菜单外的按殉国走裁决器（禁玄幻）');
    const c2 = sandbox({}), G2 = c2.GM;
    const r2 = c2.TM.CapitalFall.applyOutcome(G2, { by: '大顺', regionName: '顺天府' }, { fate: 'death' });
    ok(r2.outcome === 'game-over' && G2._gameOver && G2._gameOver.type === 'dynasty_change' && G2._gameOver.breach === true && G2._gameOver.leader === '李自成' && G2._gameOver.region === '顺天府',
      '裁决器缺席：回落经典终局信号，字段照旧契约（实得 ' + JSON.stringify(G2._gameOver) + '）');
  });

  // 原第五段（旧梯第 5 级的「进军京师」不再自己破京）11-21 随删旧去掉：五级梯与旧三件套整个删了，
  //   旧档里挂着「进军京师」的旧式民变读档后折成民变案的一股（smoke-revolt-legacy 测）。

  if (failed.length) {
    console.log('\n[smoke-capital-fall] FAIL — ' + checks + ' 项过；败 ' + failed.length + ' 段：' + failed.join('；'));
    process.exit(1);
  }
  console.log('\n[smoke-capital-fall] PASS — ' + checks + ' 项过');
})();
