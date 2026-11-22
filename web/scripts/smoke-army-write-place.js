// smoke-army-write-place.js — AI 写口认地块（11-23 同志定：地块编号做根，文字只作说明）
//
// AI 写来的驻地、去处（army_changes / military_changes 的 location、garrison、destination）先认是舆图上哪块：
// 认出一块或几块（几块的由引擎取代表点）才落；一处也认不出的这一项退回，军留原地，记进未落地。
// 同一条里还有别的改动（兵数、换帅……）的，别的照落。新建的军认不出驻地不退，落主将所在或本家治所。
// 没有地块的剧本照旧放行。
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

const region = (id, name, x, y, owner, aliases) => ({ id, name, center: [x, y], owner, currentOwner: owner, aliases: aliases || [], neighbors: [] });
function context(withMap) {
  const ctx = {
    console, setTimeout, clearTimeout, Date, Math, JSON, Map, Set, WeakMap,
    GM: {
      turn: 3,
      facs: [{ id: 'f-ming', name: '明朝廷', capital: '北京' }],
      chars: [], allCharacters: [],
      armies: [
        { id: 'a1', name: '关宁军', soldiers: 40000, faction: '明朝廷', garrison: '山海关', location: '山海关' },
        { id: 'a2', name: '福建水师', soldiers: 5000, faction: '明朝廷', garrison: '泉州府', location: '泉州府' },
      ],
      mapData: withMap ? {
        locationBindingContract: { schema: 'source-text-location-v2', courtFactionId: 'f-ming', courtCharacterId: 'c-emperor', courtStartRegionId: 'r-bj', exactAreaPriority: true },
        regions: [
          region('r-bj', '顺天府', 0, 0, 'f-ming', ['京师', '北京']),
          region('r-shg', '山海关', 60, -20, 'f-ming'),
          region('r-ny', '宁远城', 100, -50, 'f-ming', ['宁远']),
          region('r-fz', '福州府', 0, 500, 'f-ming'),
          region('r-qz', '泉州府', -20, 540, 'f-ming'),
        ],
        locationAreas: [{ text: '福建沿海', regionIds: ['r-fz', 'r-qz'] }],
        locationAliases: [],
      } : { regions: [] },
      _turnReport: [],
    },
    P: {},
    addEB() {}, toast() {}, deepClone(v) { return JSON.parse(JSON.stringify(v)); }, invalidateCharIndex() {},
    TM: { errors: { capture() {}, captureSilent() {} }, FactionIndex: { rebuild() {} } },
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['tm-map-locations.js', 'tm-ai-change-pathutils.js', 'tm-ai-change-army.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  if (withMap) ctx.GM.armies.forEach((a) => ctx.TMMapLocations.sync(a, 'army', ctx.GM));
  return ctx;
}
const A = (ctx) => ctx.TM.AIChange.Army;
const byId = (ctx, id) => ctx.GM.armies.find((a) => a.id === id);

console.log('[1] 认得出的驻地照落，地块跟着改');
{
  const ctx = context(true);
  const r = A(ctx).applyAIArmyChange({ name: '关宁军', location: '宁远城', reason: '移镇宁远' }, { source: 'army_changes' });
  const a = byId(ctx, 'a1');
  assert(r.ok && r.changed && a.location === '宁远城' && a.garrisonRegionId === 'r-ny', '关宁军移驻宁远城（实得 ' + a.garrisonRegionId + '）');
  const r2 = A(ctx).applyAIArmyChange({ name: '关宁军', location: '福建沿海', reason: '南调' }, { source: 'army_changes' });
  assert(r2.ok && byId(ctx, 'a1').garrisonRegionId === 'r-fz', '写一片「福建沿海」也落得了，取离原驻地最近的福州府（实得 ' + byId(ctx, 'a1').garrisonRegionId + '）');
}

console.log('[2] 认不出的驻地退回：军留原地，记进未落地');
{
  const ctx = context(true);
  const failedList = [];
  const n = A(ctx).applyAIArmyChangeList([{ name: '关宁军', location: '辽东某处大营', reason: '移营' }], 'army_changes', { failed: failedList });
  const a = byId(ctx, 'a1');
  assert(n === 0 && a.location === '山海关' && a.garrisonRegionId === 'r-shg', '关宁军仍驻山海关（实得 ' + a.location + '／' + a.garrisonRegionId + '）');
  assert(failedList.length === 1 && /认不出/.test(failedList[0].reason) && /山海关/.test(failedList[0].reason), '未落地记一条，写明认不出、仍驻山海关：' + (failedList[0] && failedList[0].reason));
  const single = A(ctx).applyAIArmyChange({ name: '关宁军', garrison: '辽东某处大营' }, { source: 'army_changes' });
  assert(single.ok === false && /认不出/.test(single.reason), '单独调用时整条退回，给出缘由');
}

console.log('[3] 同一条还带别的改动：别的照落，调动这一项另记未落地');
{
  const ctx = context(true);
  const failedList = [];
  const n = A(ctx).applyAIArmyChangeList([{ name: '关宁军', soldiers_delta: -3000, location: '辽东某处大营', reason: '移营途中折损' }], 'army_changes', { failed: failedList });
  const a = byId(ctx, 'a1');
  assert(n === 1 && a.soldiers === 37000, '折损三千照落（实得 ' + a.soldiers + '）');
  assert(a.location === '山海关' && a.garrisonRegionId === 'r-shg', '驻地没动');
  assert(failedList.length === 1 && failedList[0].army_change.location === '辽东某处大营', '调动这一项记进未落地');
}

console.log('[4] 去处也先认：认不出不调，认得出才接令');
{
  const ctx = context(true);
  const failedList = [];
  A(ctx).applyAIArmyChangeList([{ name: '福建水师', destination: '东番外洋', reason: '出海' }], 'army_changes', { failed: failedList });
  const a = byId(ctx, 'a2');
  assert(!a.destination && failedList.length === 1 && /未调/.test(failedList[0].reason), '去处「东番外洋」认不出，没有接令：' + (failedList[0] && failedList[0].reason));
  const r = A(ctx).applyAIArmyChange({ name: '福建水师', destination: '福州府', reason: '回防' }, { source: 'army_changes' });
  assert(r.ok && a.destination === '福州府' && a.destinationRegionId === 'r-fz', '去处福州府认得出，接令调往');
}

console.log('[5] 新建的军认不出驻地不退：落本家治所');
{
  const ctx = context(true);
  const failedList = [];
  const n = A(ctx).applyAIArmyChangeList([{ name: '勤王新军', action: 'create', soldiers: 8000, faction: '明朝廷', location: '城外新营', reason: '募兵勤王' }], 'army_changes', { failed: failedList, authoritative: true });
  const a = ctx.GM.armies.find((x) => x.name === '勤王新军');
  assert(n === 1 && a && a.garrisonRegionId === 'r-bj', '建成，落本家治所顺天府（实得 ' + (a && a.garrisonRegionId) + '）');
  assert(failedList.length === 0, '不记未落地');
}

console.log('[6] 没有地块的剧本照旧放行');
{
  const ctx = context(false);
  const r = A(ctx).applyAIArmyChange({ name: '关宁军', location: '辽东某处大营', reason: '移营' }, { source: 'army_changes' });
  assert(r.ok && byId(ctx, 'a1').location === '辽东某处大营', '照写文字');
}

if (failed) { console.log('FAIL smoke-army-write-place: ' + failed + ' 项'); process.exit(1); }
console.log('PASS smoke-army-write-place');
