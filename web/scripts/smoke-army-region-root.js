// smoke-army-region-root.js — 一支军总在一块地上（11-23 同志定：地块编号做根，文字只作说明）
//
// 先前驻地文字一认不出，引擎就把这支军的地块删了，军从舆图上消失；认出两处（「宁远-锦州」）、
// 一片（「福建沿海」）的也不落地。现在：认出几处就取一块当代表点（原来在其中的不动，原来在别处的取最近的，
// 开局取文字里先写的那处、粗区取首府）；一处也认不出就留在原驻地；开局就没有落点的，落主将所在、本家治所、
// 本家疆域当中那块。写明散驻各地的总账不落地块。人物的认法不变。
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

const sandbox = { console, Map, Set, WeakMap };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-map-locations.js'), 'utf8'), sandbox, { filename: 'tm-map-locations.js' });
const L = sandbox.TMMapLocations;

const region = (id, name, x, y, owner, aliases) => ({ id, name, center: [x, y], owner, currentOwner: owner, aliases: aliases || [], neighbors: [] });
const world = () => ({
  turn: 1,
  facs: [
    { id: 'f-ming', name: '明朝廷', capital: '北京·紫禁城' },
    { id: 'f-jin', name: '后金', capital: '沈阳（盛京·自辽阳迁都）' },
    { id: 'f-wl', name: '瓦剌诸部', capital: '(无)' },
  ],
  chars: [
    { id: 'c-qin', name: '秦良玉', location: '重庆府', alive: true },
    { id: 'c-dead', name: '亡将', location: '泉州府', alive: false },
  ],
  mapData: {
    locationBindingContract: { schema: 'source-text-location-v2', courtFactionId: 'f-ming', courtCharacterId: 'c-emperor', courtStartRegionId: 'r-bj', exactAreaPriority: true },
    regions: [
      region('r-bj', '顺天府', 0, 0, 'f-ming', ['京师', '北京']),
      region('r-ny', '宁远城', 100, -50, 'f-ming', ['宁远']),
      region('r-jz', '锦州城', 130, -70, 'f-ming', ['锦州']),
      region('r-shg', '山海关', 60, -20, 'f-ming'),
      region('r-fz', '福州府', 0, 500, 'f-ming'),
      region('r-qz', '泉州府', -20, 540, 'f-ming'),
      region('r-zz', '漳州府', -50, 570, 'f-ming'),
      region('r-cq', '重庆府', -300, 300, 'f-ming'),
      region('r-sy', '沈阳', 200, -150, 'f-jin'),
      region('r-ly', '辽阳', 190, -120, 'f-jin'),
      region('r-e', '漠北东', 500, -400, 'f-wl'),
      region('r-m', '漠北中', 450, -420, 'f-wl'),
      region('r-w', '漠北西', 400, -430, 'f-wl'),
    ],
    locationAreas: [{ text: '福建沿海', regionIds: ['r-fz', 'r-qz', 'r-zz'] }, { text: '辽东', regionIds: ['r-sy', 'r-ly'] }],
    locationAliases: [],
  },
});
const army = (over) => Object.assign({ name: '某军', faction: '明朝廷', soldiers: 5000 }, over);

console.log('[1] 开局认出几处：取文字里先写的那处，记作代表点');
{
  const G = world();
  const a = army({ name: '关宁军主力', garrison: '宁远-锦州', location: '宁远-锦州' });
  const out = L.sync(a, 'army', G);
  assert(a.garrisonRegionId === 'r-ny' && a.regionId === 'r-ny', '「宁远-锦州」落宁远城（实得 ' + a.garrisonRegionId + '）');
  assert(out.precision === 'representative' && a.mapLocationBinding.precision === 'representative', '记作代表点，不冒充确址');
  const b = army({ name: '锦州守军', garrison: '锦州·宁远', location: '锦州·宁远' });
  L.sync(b, 'army', G);
  assert(b.garrisonRegionId === 'r-jz', '「锦州·宁远」落锦州城（实得 ' + b.garrisonRegionId + '）');
  const c = army({ name: '福建水师', garrison: '福建沿海', location: '福建沿海' });
  L.sync(c, 'army', G);
  assert(c.garrisonRegionId === 'r-fz', '粗区「福建沿海」落剧本列的头一块福州府（实得 ' + c.garrisonRegionId + '）');
  L.sync(a, 'army', G); L.sync(c, 'army', G);
  assert(a.garrisonRegionId === 'r-ny' && c.garrisonRegionId === 'r-fz', '同一段文字再对一遍，落处不变');
}

console.log('[2] 改驻到一片：原来就在其中的不动，原来在别处的取离原驻地最近的那块');
{
  const G = world();
  const a = army({ garrison: '泉州府', location: '泉州府' });
  L.sync(a, 'army', G);
  assert(a.garrisonRegionId === 'r-qz' && a.mapLocationBinding.precision === 'region', '先驻泉州府，确址');
  L.sync(a, 'army', G, '福建沿海');
  assert(a.garrisonRegionId === 'r-qz', '改写「福建沿海」仍在泉州府（实得 ' + a.garrisonRegionId + '）');
  const b = army({ garrison: '京师', location: '京师' });
  L.sync(b, 'army', G);
  assert(b.garrisonRegionId === 'r-bj', '先驻京师');
  L.sync(b, 'army', G, '福建沿海');
  assert(b.garrisonRegionId === 'r-fz', '从京师改驻「福建沿海」，落离京师最近的福州府（实得 ' + b.garrisonRegionId + '）');
}

console.log('[3] 新驻地一处也认不出：留在原驻地，不从图上消失');
{
  const G = world();
  const a = army({ garrison: '山海关', location: '山海关' });
  L.sync(a, 'army', G);
  L.sync(a, 'army', G, '某处密林');
  assert(a.garrisonRegionId === 'r-shg' && a.regionId === 'r-shg' && a.garrisonRegionName === '山海关', '仍在山海关（实得 ' + a.garrisonRegionId + '）');
  assert(a.mapLocationBinding.unreadText === '某处密林' && a.mapLocationBinding.status === 'kept', '记下认不出的那段文字');
  L.sync(a, 'army', G, '宁远城');
  assert(a.garrisonRegionId === 'r-ny' && !a.mapLocationBinding.unreadText, '再写认得出的地名就移过去，认不出的记录清掉');
}

console.log('[4] 开局就认不出、也没有原驻地：主将所在→本家治所→本家疆域当中那块');
{
  const G = world();
  const a = army({ name: '四川白杆兵', garrison: '四川石柱', location: '四川石柱', commander: '秦良玉' });
  L.sync(a, 'army', G);
  assert(a.garrisonRegionId === 'r-cq' && a.mapLocationBinding.method === 'commander-region', '落主将秦良玉所在重庆府（实得 ' + a.garrisonRegionId + '）');
  const b = army({ name: '女真归附部', faction: '后金', garrison: '辽西诸卫', location: '辽西诸卫', commander: '亡将' });
  L.sync(b, 'army', G);
  assert(b.garrisonRegionId === 'r-sy' && b.mapLocationBinding.method === 'faction-seat', '主将已殁，落后金治所沈阳（实得 ' + b.garrisonRegionId + '）');
  const c = army({ name: '瓦剌主力', faction: '瓦剌诸部', garrison: '游牧诸营', location: '游牧诸营' });
  L.sync(c, 'army', G);
  assert(c.garrisonRegionId === 'r-m' && c.mapLocationBinding.method === 'faction-territory', '没有治所，落本家疆域当中的漠北中（实得 ' + c.garrisonRegionId + '）');
  const before = b.mapLocationBinding.method;
  L.sync(b, 'army', G); L.sync(c, 'army', G);
  assert(b.garrisonRegionId === 'r-sy' && c.garrisonRegionId === 'r-m' && b.mapLocationBinding.method === before, '文字没变，再对一遍落处与来由都不变');
  const d = army({ name: '新募营', faction: '明朝廷' });
  L.sync(d, 'army', G);
  assert(d.garrisonRegionId === 'r-bj', '没写驻地的新军落本家治所顺天府（实得 ' + d.garrisonRegionId + '）');
}

console.log('[5] 写明散驻各地的总账不落地块');
{
  const G = world();
  const a = army({ name: '全国卫所军·总览', garrison: '全国 329 卫', location: '全国 329 卫', dispersed: true, regionId: 'r-bj', garrisonRegionId: 'r-bj' });
  const out = L.sync(a, 'army', G);
  assert(!out.regionId && out.status === 'dispersed', '读出来是散驻，没有地块');
  assert(!a.regionId && !a.garrisonRegionId && !a.mapRegionId, '剧本带的旧地块号清掉');
}

console.log('[6] 写口判断：认得出一块或几块才算落得了地');
{
  const G = world();
  const a = army({ garrison: '京师', location: '京师' });
  assert(L.readable('宁远-锦州', a, 'army', G) === true, '「宁远-锦州」落得了');
  assert(L.readable('福建沿海', a, 'army', G) === true, '「福建沿海」落得了');
  assert(L.readable('某处密林', a, 'army', G) === false, '「某处密林」落不了');
  assert(L.readable('', a, 'army', G) === false, '空文字落不了');
  assert(L.readable('随便哪里', a, 'army', { mapData: { regions: [] } }) === true, '没有地块的剧本一概放行');
}

console.log('[7] 人物照旧只认唯一一块');
{
  const G = world();
  const ch = { id: 'c-x', name: '某官', location: '宁远-锦州' };
  const out = L.sync(ch, 'character', G);
  assert(!out.regionId && !ch.regionId, '人写两处不取代表点');
}

if (failed) { console.log('FAIL smoke-army-region-root: ' + failed + ' 项'); process.exit(1); }
console.log('PASS smoke-army-region-root');
