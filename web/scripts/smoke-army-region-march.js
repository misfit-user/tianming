// smoke-army-region-march.js — 逐块行军（11-23 同志定乙：地块编号做根，行军按地块一块一块走）
//
// 军令记在 GM.marchOrders，每回合按日数沿路走，走满一程落到下一块，走完全程抵达。
// 日行一舍（17 公里），骑兵占九成以上的加倍，带炮的减半，冬季与五万以上大军减速。
// 先前按目的地走的那套不看远近一回合送到、旧三系统界面掷 15~35 日——有地块的剧本都改走这里。
// 假舆图：甲城—乙城 255 公里、乙城—丙城 300、丙城—丁城 255；戊城不通路；「东路」是丙丁两块的片区。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('  PASS ' + msg);
  else { failed++; console.log('  FAIL ' + msg); }
}
const near = (a, b, eps) => Math.abs(a - b) <= (eps || 0.05);

const edge = (to, km) => ({ to, km });
const region = (id, name, lon, edges) => ({ id, name, center: [lon * 10, 0], geographicCenter: [100 + lon, 30], owner: 'f-ming', currentOwner: 'f-ming',
  routeEdges: edges, neighbors: edges.map((e) => e.to), aliases: [] });
const foot = (n) => [{ type: '步兵', count: n }];
function context(opts) {
  opts = opts || {};
  const ebs = [];
  const ctx = {
    console, Math, JSON, Date, Map, Set, WeakMap,
    GM: {
      turn: 5,
      facs: [{ id: 'f-ming', name: '明朝廷', capital: '甲城' }],
      chars: [], allCharacters: [], _turnReport: [],
      armies: [
        { id: 'a1', name: '步营', faction: '明朝廷', soldiers: 10000, composition: foot(10000), garrison: '甲城', location: '甲城' },
        { id: 'a2', name: '铁骑', faction: '明朝廷', soldiers: 5000, composition: [{ type: '骑兵', count: 5000 }], garrison: '甲城', location: '甲城' },
        { id: 'a3', name: '炮营', faction: '明朝廷', soldiers: 8500, composition: [{ type: '步兵', count: 8000 }, { type: '炮兵', count: 500 }], garrison: '甲城', location: '甲城' },
        { id: 'a4', name: '大军', faction: '明朝廷', soldiers: 60000, composition: foot(60000), garrison: '甲城', location: '甲城' },
        { id: 'a5', name: '卫所总览', faction: '明朝廷', soldiers: 90000, dispersed: true, garrison: '各地卫所', location: '各地卫所' },
      ],
      mapData: opts.noMap ? { regions: [] } : {
        regions: [
          region('r-a', '甲城', 0, [edge('r-b', 255)]),
          region('r-b', '乙城', 1, [edge('r-a', 255), edge('r-c', 300)]),
          region('r-c', '丙城', 2, [edge('r-b', 300), edge('r-d', 255)]),
          region('r-d', '丁城', 3, [edge('r-c', 255)]),
          region('r-e', '戊城', 9, []),
        ],
        locationAreas: [{ text: '东路', regionIds: ['r-c', 'r-d'] }],
        locationAliases: [],
      },
    },
    P: {},
    getTurnDays: () => 30,
    uid: (() => { let n = 0; return () => 'm' + (++n); })(),
    addEB: (cat, txt) => ebs.push(cat + '|' + txt),
    toast() {}, deepClone: (v) => JSON.parse(JSON.stringify(v)), invalidateCharIndex() {},
    TM: { errors: { capture() {}, captureSilent() {} }, FactionIndex: { rebuild() {} } },
  };
  if (opts.winter) ctx.BattleEngine = { _getSeason: () => '冬' };
  if (opts.steps) ctx.SettlementPipeline = { register(id, n, fn) { opts.steps[id] = fn; } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const files = ['tm-map-route-days.js', 'tm-map-locations.js', 'tm-army-march.js'].concat(opts.files || []);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  if (!opts.noMap) ctx.GM.armies.forEach((a) => ctx.TMMapLocations.sync(a, 'army', ctx.GM));
  ctx._ebs = ebs;
  return ctx;
}
const M = (ctx) => ctx.TM.ArmyMarch;
const army = (ctx, id) => ctx.GM.armies.find((a) => a.id === id);

console.log('[1] 快慢：日行一舍 17 公里，骑军加倍，带炮减半，五万以上与冬季减速');
{
  const ctx = context();
  assert(M(ctx).pace(army(ctx, 'a1')).kmPerDay === 17, '步营日行 17 公里');
  assert(M(ctx).pace(army(ctx, 'a2')).kmPerDay === 34 && M(ctx).pace(army(ctx, 'a2')).kind === 'cavalry', '全是骑兵的铁骑日行 34 公里');
  assert(M(ctx).pace(army(ctx, 'a3')).kmPerDay === 8.5 && M(ctx).pace(army(ctx, 'a3')).kind === 'siege', '带炮兵的炮营日行 8.5 公里');
  assert(M(ctx).pace(army(ctx, 'a4')).kmPerDay === 13.6, '六万大军 17×0.8＝13.6 公里（实得 ' + M(ctx).pace(army(ctx, 'a4')).kmPerDay + '）');
  const w = context({ winter: true });
  assert(M(w).pace(army(w, 'a1')).kmPerDay === 11.9, '冬季步营 17×0.7＝11.9 公里（实得 ' + M(w).pace(army(w, 'a1')).kmPerDay + '）');
  const odd = context();
  odd.MarchSystem = { _getConfig: () => ({ baseSpeeds: { infantry: 3, cavalry: 5, siege: 2 }, winterPenalty: 0.7, largeSizeThreshold: 50000, largeSizePenalty: 0.8 }) };
  assert(M(odd).pace(army(odd, 'a1')).kmPerDay === 17 && M(odd).pace(army(odd, 'a2')).kmPerDay === 34, '剧本写了旧公式的 baseSpeeds（晚唐 3/5/2）也不改倍数');
}

console.log('[2] 定路线：经哪几块、多少公里、约几回合；认不出、不通路、已在那里、散驻的都不成行');
{
  const ctx = context();
  const p = M(ctx).plan(army(ctx, 'a1'), '丁城', ctx.GM);
  assert(p.ok && p.route.path.join(',') === 'r-a,r-b,r-c,r-d', '甲城到丁城经乙城、丙城');
  assert(near(p.route.km, 810) && near(p.days, 47.65) && p.turns === 2, '810 公里，约 47.6 日，两回合（实得 ' + p.route.km + ' 公里 ' + p.days.toFixed(2) + ' 日 ' + p.turns + ' 回合）');
  assert(M(ctx).plan(army(ctx, 'a1'), '戊城', ctx.GM).reason === '无路可达戊城', '戊城不通路：无路可达');
  assert(/认不出/.test(M(ctx).plan(army(ctx, 'a1'), '海外仙山', ctx.GM).reason), '舆图上没有的地方：认不出');
  const here = M(ctx).plan(army(ctx, 'a1'), '甲城', ctx.GM);
  assert(here.ok === false && here.here === true && here.reason === '此军已驻甲城', '已在甲城：不必走');
  assert(/散驻/.test(M(ctx).plan(army(ctx, 'a5'), '丁城', ctx.GM).reason), '散驻各地的卫所总览不能整军调动');
  assert(M(ctx).plan(army(ctx, 'a1'), '东路', ctx.GM).toRegionId === 'r-c', '去「东路」片区，落离此军路程最近的丙城');
}

console.log('[3] 立令后逐块走：一回合走 30 日，走满一程落到下一块，走完全程抵达');
{
  const ctx = context();
  const a = army(ctx, 'a1');
  const r = M(ctx).start(a, '丁城', { source: 'smoke' });
  assert(r.ok && ctx.GM.marchOrders.length === 1 && r.order.regionPath.length === 4, '军令记进 GM.marchOrders，带地块路线');
  assert(a.destination === '丁城' && a.destinationRegionId === 'r-d' && a.state === 'marching' && a.location === '甲城', '此军转行军态，人还在甲城');
  assert(ctx._ebs.some((x) => /步营自甲城开拔，往丁城/.test(x)), '事件簿记开拔');
  M(ctx).advance(ctx.GM, 30);
  const o = ctx.GM.marchOrders[0];
  assert(a.garrisonRegionId === 'r-b' && a.location === '乙城' && a.mapLocationBinding.regionId === 'r-b', '第一回合走 510 公里：过了乙城（实得 ' + a.location + '）');
  assert(o && o.seg === 1 && near(o.segKm, 255) && o.totalTurns === 2, '乙城往丙城已走 255 公里，记在令上（实得 ' + (o && o.segKm) + '）');
  assert(ctx._ebs.some((x) => /步营经乙城，往丁城尚余约/.test(x)), '事件簿记行至何处');
  M(ctx).advance(ctx.GM, 30);
  assert(a.location === '丁城' && a.garrisonRegionId === 'r-d' && a.state === 'garrison' && a.destination === '', '第二回合抵达丁城，转驻防（实得 ' + a.location + '／' + a.state + '）');
  assert(ctx.GM.marchOrders.length === 0, '到了的令清掉');
  assert(near(a.supplyRatio, 1 - (47.647 / 1000) * 0.3, 0.001), '抵达照旧规按实走日数折粮秣（实得 ' + a.supplyRatio + '）');
  assert(ctx._ebs.some((x) => /步营已抵达丁城/.test(x)), '事件簿记抵达');
}

console.log('[4] 改令作废旧令；途中被挪动的从现所在重走');
{
  const ctx = context();
  const a = army(ctx, 'a2');
  M(ctx).start(a, '丁城');
  M(ctx).start(a, '丙城');
  assert(ctx.GM.marchOrders.length === 1 && ctx.GM.marchOrders[0].toRegionId === 'r-c', '同一支军只留新令（往丙城）');
  ctx.TMMapLocations.moveArmy(a, ctx.GM, 'r-c');
  M(ctx).advance(ctx.GM, 30);
  assert(a.state === 'garrison' && a.location === '丙城' && ctx.GM.marchOrders.length === 0, '被挪到了去处，当即算抵达');
  const b = army(ctx, 'a1');
  M(ctx).start(b, '丁城');
  ctx.TMMapLocations.moveArmy(b, ctx.GM, 'r-c');
  M(ctx).advance(ctx.GM, 30);
  assert(b.location === '丁城' && b.state === 'garrison', '途中被挪到丙城，从丙城重走 255 公里，当回合抵达（实得 ' + b.location + '）');
}

console.log('[5] 旧档的在途军改按地块走；去处认不出的作罢并记一笔');
{
  const ctx = context();
  ctx.GM.marchOrders = [{ id: 'old1', armyId: 'a3', armyName: '炮营', from: '甲城', to: '乙城', status: 'marching', progress: 0, totalTurns: 1 }];
  army(ctx, 'a4').destination = '丙城';
  army(ctx, 'a2').destination = '海外仙山'; army(ctx, 'a2').state = 'marching';
  M(ctx).advance(ctx.GM, 30);
  assert(army(ctx, 'a3').location === '乙城' && army(ctx, 'a3').state === 'garrison', '旧令：炮营日行 8.5 公里，255 公里恰一回合到乙城');
  const o4 = ctx.GM.marchOrders.find((o) => o.armyId === 'a4');
  assert(o4 && o4.regionPath && army(ctx, 'a4').location === '乙城' && near(o4.segKm, 153), '只写了去处的大军改立逐块令：日行 13.6 公里，过乙城再走 153 公里（实得 ' + (o4 && o4.segKm) + '）');
  assert(army(ctx, 'a2').destination === '' && army(ctx, 'a2').state === 'garrison' && army(ctx, 'a2').location === '甲城', '去处认不出的作罢，军留甲城');
  assert(ctx._ebs.some((x) => /铁骑调往「海外仙山」未成/.test(x)), '作罢的记一笔');
  assert(!ctx.GM.marchOrders.some((o) => o.id === 'old1'), '旧令换下');
}

console.log('[6] 没有地块的剧本不归这里管');
{
  const ctx = context({ noMap: true });
  const a = army(ctx, 'a1');
  a.destination = '丁城';
  assert(M(ctx).usable(ctx.GM) === false, '无地块：不逐块行军');
  assert(M(ctx).advance(ctx.GM, 30).length === 0 && a.destination === '丁城' && a.location === '甲城', '不动它，留给旧路子');
}

console.log('[7] AI 写去处：立行军令；无路可达的这一项退回；已在那里的不动');
{
  const ctx = context({ files: ['tm-ai-change-pathutils.js', 'tm-ai-change-army.js'] });
  const W = ctx.TM.AIChange.Army;
  const r = W.applyAIArmyChange({ name: '步营', destination: '丁城', reason: '东援' }, { source: 'army_changes' });
  const a = army(ctx, 'a1');
  assert(r.ok && r.changed && ctx.GM.marchOrders.length === 1 && ctx.GM.marchOrders[0].regionPath, '立了逐块行军令');
  assert(a.location === '甲城' && a.state === 'marching', '当下仍在甲城，等过回合沿路走');
  const failedList = [];
  const n = W.applyAIArmyChangeList([{ name: '铁骑', destination: '戊城', soldiers_delta: -500, reason: '远征' }], 'army_changes', { failed: failedList });
  assert(n === 1 && army(ctx, 'a2').soldiers === 4500, '同条的折损照落');
  assert(failedList.length === 1 && /调往「戊城」未成：无路可达戊城；此军仍在甲城/.test(failedList[0].reason), '调往戊城这一项退回，写明无路可达：' + (failedList[0] && failedList[0].reason));
  const same = W.applyAIArmyChange({ name: '炮营', destination: '甲城' }, { source: 'army_changes' });
  assert(same.ok && !same.placeRejected && !ctx.GM.marchOrders.some((o) => o.armyId === 'a3'), '已在甲城的不立令、不退回');
}

console.log('[8] 旧的两套行军让路：按目的地一步送到的、按天数倒计时送到的都不再动有地块的军');
{
  const steps = {};
  const ctx = context({ steps, files: ['tm-feudal-warfare.js', 'tm-three-systems-ext.js'] });
  const a = army(ctx, 'a1');
  a.destination = '丁城';
  steps.armyMarch();
  assert(a.location === '甲城' && a.destination === '丁城', '按目的地走的那套不再一步送到丁城');
  const b = army(ctx, 'a2');
  b.state = 'marching'; b.marchDaysLeft = 10; b.destination = '丙城';
  ctx.ThreeSystemsExt.updateMilitaryState();
  assert(b.location === '甲城', '按天数倒计时的那套不再送到丙城（实得 ' + b.location + '）');
  const legacySteps = {};
  const legacy = context({ noMap: true, steps: legacySteps, files: ['tm-feudal-warfare.js'] });
  army(legacy, 'a1').destination = '丁城';
  legacySteps.armyMarch();
  assert(army(legacy, 'a1').location === '丁城', '没有地块的剧本照旧（一回合到）');
}

console.log('[9] 旧三系统界面调兵：有地块的按路程立令，不再掷日数');
{
  const ctx = context({ files: ['tm-three-systems-ui.js'] });
  ctx.prompt = () => '丁城';   // 界面要弹窗问去处，这里直接答「丁城」
  ctx._tsTransferArmy('步营');
  const o = ctx.GM.marchOrders && ctx.GM.marchOrders.find((x) => x.armyId === 'a1');
  assert(o && o.regionPath && o.toRegionId === 'r-d', '立了逐块令，往丁城');
  assert(army(ctx, 'a1').marchDaysLeft === 0 && army(ctx, 'a1').location === '甲城', '没有掷出的日数，人还在甲城');
}

console.log('[10] AI 写驻地：本块或四邻当回合改驻；写到更远处的改走行军；不通路的退回');
{
  const ctx = context({ files: ['tm-ai-change-pathutils.js', 'tm-ai-change-army.js'] });
  const W = ctx.TM.AIChange.Army;
  const nearBy = W.applyAIArmyChange({ name: '步营', location: '乙城', reason: '移营' }, { source: 'army_changes' });
  assert(nearBy.ok && army(ctx, 'a1').location === '乙城' && army(ctx, 'a1').garrisonRegionId === 'r-b' && !(ctx.GM.marchOrders || []).length, '四邻乙城：当回合改驻，不立令');
  const far = W.applyAIArmyChange({ name: '铁骑', location: '丁城', reason: '移镇' }, { source: 'army_changes' });
  const o = (ctx.GM.marchOrders || []).find((x) => x.armyId === 'a2');
  assert(far.ok && o && o.toRegionId === 'r-d' && army(ctx, 'a2').location === '甲城', '远处丁城：不瞬移，改立行军令，人还在甲城');
  const failedList = [];
  W.applyAIArmyChangeList([{ name: '炮营', location: '戊城', morale_delta: 5, reason: '移镇' }], 'army_changes', { failed: failedList });
  assert(failedList.length === 1 && /移驻「戊城」未成：无路可达戊城；此军仍驻甲城/.test(failedList[0].reason), '戊城不通路：这一项退回 ' + (failedList[0] && failedList[0].reason));
}

console.log('[11] 提示词【行军状况】：往哪、现在哪块、余经哪几块、约几日到');
{
  const ctx = context();
  assert(M(ctx).promptText(ctx.GM) === '', '没有在途的不写');
  M(ctx).start(army(ctx, 'a1'), '丁城');
  M(ctx).advance(ctx.GM, 30);
  const text = M(ctx).promptText(ctx.GM);
  assert(/^【行军状况】逐块行军：日行一舍/.test(text) && /每回合 30 日/.test(text), '抬头写明日行一舍、每回合日数');
  assert(text.includes('步营：往丁城，现在乙城，余经丙城，约 18 日（1 回合）到'), '步营现在乙城，余 300 公里约 18 日：' + text.split('\n')[1]);
}

// 加一家后金、一支敌军；war 为真时明与后金交战
function withFoe(ctx, at, war) {
  ctx.GM.facs.push({ id: 'f-jin', name: '后金' });
  if (war) ctx.GM.factionRelations = [{ from: '明朝廷', to: '后金', type: 'war', value: -95 }];
  const foe = { id: 'j1', name: '两黄旗', faction: '后金', soldiers: 15000, composition: [{ type: '骑兵', count: 15000 }], garrison: at, location: at };
  ctx.GM.armies.push(foe);
  ctx.TMMapLocations.sync(foe, 'army', ctx.GM);
  return foe;
}

console.log('[12] 遇敌停步：下一程有交战之敌的军，停在前一块；敌走了接着走；不交战的、民变不反的不挡');
{
  const ctx = context();
  const foe = withFoe(ctx, '丙城', true);
  const a = army(ctx, 'a1');
  M(ctx).start(a, '丁城');
  M(ctx).advance(ctx.GM, 30);
  M(ctx).advance(ctx.GM, 30);
  const o = ctx.GM.marchOrders[0];
  assert(a.location === '乙城' && o && o.blocked && o.blocked.armyName === '两黄旗' && o.blocked.regionName === '丙城', '第二回合要进丙城，为两黄旗所阻，停在乙城（实得 ' + a.location + '）');
  assert(ctx._ebs.some((x) => /步营往丁城，行至乙城，为后金·两黄旗所阻（敌驻丙城），止步待命/.test(x)), '事件簿记受阻');
  const text = M(ctx).promptText(ctx.GM);
  assert(text.includes('步营：往丁城，现在乙城，为后金·两黄旗所阻（敌驻丙城，与此相邻），止步待命') && /打不打由推演定/.test(text), '【行军状况】写明受阻、打不打由推演定');
  ctx.TMMapLocations.moveArmy(foe, ctx.GM, 'r-e');
  M(ctx).advance(ctx.GM, 30);
  assert(a.location === '丁城' && a.state === 'garrison' && !ctx.GM.marchOrders.length, '两黄旗走了，接着走到丁城');
  const named = context();
  withFoe(named, '乙城', true).name = '后金·两黄旗';
  M(named).start(army(named, 'a1'), '丁城');
  M(named).advance(named.GM, 30);
  assert(/为后金·两黄旗所阻/.test(M(named).promptText(named.GM)) && !/后金·后金/.test(M(named).promptText(named.GM) + named._ebs.join('')), '军名已带势力名的不再冠一遍');
  const calm = context();
  withFoe(calm, '丙城', false);
  M(calm).start(army(calm, 'a1'), '丁城');
  M(calm).advance(calm.GM, 30); M(calm).advance(calm.GM, 30);
  assert(army(calm, 'a1').location === '丁城', '不交战的别家之军不挡');
  const song = context();
  song.GM.facs = [{ id: 'f-ming', name: '明朝廷', warState: { active: [{ enemy: '后金', since: '1626' }] } }];
  withFoe(song, '乙城', false);
  M(song).start(army(song, 'a1'), '丁城');
  M(song).advance(song.GM, 30);
  assert(army(song, 'a1').location === '甲城' && song.GM.marchOrders[0].blocked, 'warState 里写明的敌（绍宋那样记）也认：甲城就停住');
  const band = context();
  const rb = { id: 'b1', name: '王二部', faction: '民变', _revoltBand: true, soldiers: 3000, garrison: '乙城', location: '乙城' };
  band.GM.armies.push(rb); band.TMMapLocations.sync(rb, 'army', band.GM);
  M(band).start(army(band, 'a1'), '丁城');
  M(band).advance(band.GM, 30);
  assert(army(band, 'a1').location === '甲城' && band.GM.marchOrders[0].blocked && band.GM.marchOrders[0].blocked.armyName === '王二部', '在明朝廷地上起事的民变挡明军');
  const passer = withFoe(band, '甲城', false);
  M(band).start(passer, '丁城');
  M(band).advance(band.GM, 30);
  assert(passer.location !== '甲城' && !(band.GM.marchOrders.find((x) => x.armyId === 'j1') || {}).blocked, '民变不挡别家（后金）的军');
}

console.log('[13] 接战规矩：两边的军同块或相邻才落；隔得更远的退回，写明各在哪');
{
  const ctx = context({ files: [] });
  const applied = [];
  ctx.MilitarySystems = {
    findBattleArmy: (ref, G) => (G.armies || []).find((a) => a.id === ref || a.name === ref) || null,
    applyBattleResult: (br) => { applied.push(br.battleId); return { ok: true, result: { battleId: br.battleId, winner: br.winnerFactionId, loser: br.loserFactionId, affectedArmies: [] } }; },
  };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-battle-contract.js'), 'utf8'), ctx, { filename: 'tm-battle-contract.js' });
  const foe = withFoe(ctx, '丁城', true);
  const fight = (id, att) => ({ battleId: id, winnerFactionId: '明朝廷', loserFactionId: '后金', attackerArmyId: att, defenderArmyId: 'j1', casualties: { attacker: 100, defender: 300 } });
  const far = ctx.MilitarySystems.applyBattleResult(fight('bt-far', 'a1'), ctx.GM);
  assert(far.ok === false && far.apart && /两军不相接·「步营」在甲城，对面「两黄旗」在丁城/.test(far.reason) && applied.indexOf('bt-far') < 0, '甲城打丁城（隔两块）：不落，写明各在哪：' + far.reason);
  const v = ctx.MilitarySystems.validateBattleResult(fight('bt-far2', 'a1'), ctx.GM);
  assert(!v.ok && v.errors.some((e) => /两军不相接/.test(e)), '军事子调用走的校验也拦');
  ctx.TMMapLocations.moveArmy(foe, ctx.GM, 'r-b');
  const near = ctx.MilitarySystems.applyBattleResult(fight('bt-near', 'a1'), ctx.GM);
  assert(near.ok && applied.indexOf('bt-near') >= 0, '敌在相邻的乙城：照落');
  ctx.TMMapLocations.moveArmy(foe, ctx.GM, 'r-a');
  assert(ctx.MilitarySystems.applyBattleResult(fight('bt-same', 'a1'), ctx.GM).ok, '同在甲城：照落');
  const loose = ctx.MilitarySystems.applyBattleResult(fight('bt-disp', 'a5'), ctx.GM);
  assert(loose.ok, '散驻各地、认不出在哪块的军不判');
  const noMap = context({ noMap: true });
  noMap.MilitarySystems = { findBattleArmy: (ref, G) => (G.armies || []).find((a) => a.id === ref || a.name === ref) || null, applyBattleResult: () => ({ ok: true, result: {} }) };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-battle-contract.js'), 'utf8'), noMap, { filename: 'tm-battle-contract.js' });
  noMap.GM.facs.push({ id: 'f-jin', name: '后金' });
  noMap.GM.armies.push({ id: 'j1', name: '两黄旗', faction: '后金', soldiers: 15000, garrison: '丁城', location: '丁城' });
  assert(noMap.MilitarySystems.applyBattleResult(fight('bt-nomap', 'a1'), noMap.GM).ok, '没有地块的剧本不判');
}

if (failed) { console.log('FAIL smoke-army-region-march: ' + failed + ' 项'); process.exit(1); }
console.log('PASS smoke-army-region-march');
