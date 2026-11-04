// smoke-letter-route-days.js — 信程按地图真实路程算
//
// 病根：calcLetterDays 只有同处、同省、其余三档，修好京城后天启 176 个收信人 175 个都是二十日。
// 修法：地名落到地图地块，沿邻接走出公里数，折成里再除驿速；走不通的按直线加绕行；
// 地图缺或地名对不上的退回老的粗估；全程出错不外抛，不拖垮写信和过回合。
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

const sandbox = { console, setTimeout, clearTimeout, TM: {}, P: {}, GM: {}, Map, Set, WeakMap };
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.document = { getElementById: () => null, createElement: () => ({ style: {} }), addEventListener() {}, body: {} };
sandbox.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
sandbox.toast = () => {};
sandbox.escHtml = (s) => String(s == null ? '' : s);
sandbox.getTSText = () => 'T';
sandbox.uid = () => 'id' + Math.random().toString(36).slice(2, 8);
sandbox.getCurrentGameDay = () => 100;
sandbox._getDaysPerTurn = () => 30;
sandbox.SettlementPipeline = { register() {} };
sandbox.findCharByName = (n) => (sandbox.GM.chars || []).find((c) => c && c.name === n) || null;
vm.createContext(sandbox);

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
for (const rel of ['tm-utils.js', 'tm-map-route-days.js', 'tm-map-locations.js']) {
  vm.runInContext(read(rel), sandbox, { filename: rel });
}
sandbox._$ = () => null;
const located = read('tm-chaoyi.js').match(/function _getPlayerLocation\(\) \{[\s\S]*?\r?\n\}/);
vm.runInContext(located[0], sandbox);
vm.runInContext(read('tm-hongyan-office.js'), sandbox, { filename: 'tm-hongyan-office.js' });
sandbox.renderLetterPanel = () => {};

const days = (a, b, u) => sandbox.calcLetterDays(a, b, u || 'normal');
const km = (a, b) => sandbox._ltRouteKm(a, b);
const greatCircle = (p, q) => sandbox._ltGreatCircleKm(p, q);
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1);

// 写了地名契约的地图（天启、绍宋这样）
const PLACES = {
  bj: [116.4, 39.9], bd: [115.47, 38.87], kf: [114.3, 34.8], nj: [118.78, 32.06], gz: [113.26, 23.13], tw: [121, 24],
};
const contractMap = () => ({
  locationBindingContract: { schema: 'source-text-location-v2', courtCharacterId: 'c1', courtFactionId: 'f-ming', courtStartRegionId: 'r-bj', exactAreaPriority: true },
  regions: [
    { id: 'r-bj', name: '顺天府', aliases: ['北直隶·通州'], geographicCenter: PLACES.bj, neighbors: ['r-bd'] },
    { id: 'r-bd', name: '保定府', geographicCenter: PLACES.bd, neighbors: ['r-bj', 'r-kf'] },
    { id: 'r-kf', name: '开封府', geographicCenter: PLACES.kf, neighbors: ['r-bd', 'r-nj'] },
    { id: 'r-nj', name: '应天府', aliases: ['南京'], geographicCenter: PLACES.nj, neighbors: ['r-kf', 'r-gz'] },
    { id: 'r-gz', name: '广州府', geographicCenter: PLACES.gz, neighbors: ['r-nj'] },
    { id: 'r-tw', name: '台湾', geographicCenter: PLACES.tw, neighbors: [] },
  ],
  locationAreas: [{ text: '东南', regionIds: ['r-nj', 'r-gz'] }],
  locationAliases: [{ text: '京', regionId: 'r-gz', factionId: 'f-ja' }],
});
const ming = (map) => ({
  _capital: '北京',
  mapData: map || contractMap(),
  facs: [{ id: 'f-ming', name: '明' }, { id: 'f-ja', name: '日本' }],
  chars: [
    { id: 'c1', name: '朱由检', isPlayer: true, alive: true, location: '京师·紫禁城', factionId: 'f-ming' },
    { id: 'c2', name: '上皇', alive: true, location: '京', factionId: 'f-ja' },
  ],
});

console.log('一、沿地图走出来的路程');
sandbox.GM = ming();
const edge = greatCircle(PLACES.bj, PLACES.bd);
assert(near(km('顺天府', '保定府'), edge), '相邻两地就是一段的路程');
const road = greatCircle(PLACES.bj, PLACES.bd) + greatCircle(PLACES.bd, PLACES.kf) + greatCircle(PLACES.kf, PLACES.nj);
assert(near(km('顺天府', '应天府'), road), '隔着几块就一段段加起来');
assert(km('顺天府', '应天府') > greatCircle(PLACES.bj, PLACES.nj), '路程比直线长');
assert(days('顺天府', '保定府') === Math.ceil(edge * 1.8 / 100), '公里折里除驿速');
assert(days('顺天府', '广州府') > days('顺天府', '应天府') && days('顺天府', '应天府') > days('顺天府', '保定府'), '越远越久');
assert(days('顺天府', '广州府') > days('顺天府', '广州府', 'urgent') && days('顺天府', '广州府', 'urgent') > days('顺天府', '广州府', 'extreme'), '加急快于驿递，八百里又快于加急');
assert(days('顺天府', '广州府', '瞎写') === days('顺天府', '广州府', 'normal'), '不认识的缓急按驿递');
assert(days('广州府', '顺天府') === days('顺天府', '广州府'), '来回一样远');

console.log('二、通称跟着世界走');
assert(near(km('北京', '保定府'), edge), '京城写「北京」，地图上这块叫顺天府');
assert(near(km('京师·文渊阁', '保定府'), edge), '京师是当朝京城');
sandbox.GM._capital = '南京';
assert(near(km('京师', '保定府'), greatCircle(PLACES.nj, PLACES.kf) + greatCircle(PLACES.kf, PLACES.bd)), '迁都南京后，京师跟到南京');
sandbox.GM = ming();
sandbox.GM.chars[0].location = '开封府';
assert(km('行在', '开封府') === 0, '行在是天子此刻所在');
sandbox.GM.chars[0].location = '广州府';
assert(km('行在', '广州府') === 0 && km('行在', '开封府') > 0, '天子走了，行在跟着走，不留旧值');
assert(near(km('行在·保定府', '顺天府'), edge), '「行在·保定府」写了实地，以实地为准');

console.log('三、粗区、两可、势力专属的别名');
sandbox.GM = ming();
assert(near(km('顺天府', '东南'), (km('顺天府', '应天府') + km('顺天府', '广州府')) / 2), '粗区说不准在哪一块：取中位数');
assert(km('顺天府', '东南') > km('顺天府', '应天府'), '不按最近的一块算，信不会凭空快');
assert(days('应天府', '东南') > 1, '人在区内，给区里的人写信也不是一日到');
assert(days('东南', '东南') === 1, '写法一字不差的还是一日');
assert(km('上皇所在', '顺天府') == null, '没人写这个地名：对不上');
assert(km('京', '广州府') === 0, '日本的「京」带上写它的人才认得，不算北京');
sandbox.GM.chars[1].location = '别处';
sandbox.GM.mapData = contractMap();
assert(km('京', '广州府') == null, '世上没人写「京」：不瞎猜');

console.log('四、走不通的两地');
sandbox.GM = ming();
assert(near(km('顺天府', '台湾'), greatCircle(PLACES.bj, PLACES.tw) * 1.3), '隔海：直线加三成绕行');
assert(days('顺天府', '台湾') >= 1, '隔海也算得出日数');

console.log('五、对不上的退回老的粗估');
sandbox.GM = ming();
assert(km('顺天府', '漠北汗帐') == null, '地图上没有的地方：对不上');
assert(days('顺天府', '漠北汗帐') === 20, '跨省二十日');
assert(days('顺天府', '漠北汗帐', 'urgent') === 4 && days('顺天府', '漠北汗帐', 'extreme') === 2, '加急四日、八百里二日照旧');
sandbox.GM = { _capital: '北京', adminHierarchy: { player: { divisions: [
  { name: '北直隶', children: [{ name: '顺天府' }, { name: '保定府' }] },
  { name: '南直隶', children: [{ name: '应天府' }, { name: '苏州府' }] },
] } } };
assert(days('顺天府', '保定府') === 4 && days('顺天府', '苏州府') === 20, '没有地图：同省四日、跨省二十日照旧');
sandbox.GM = { _capital: '北京', mapData: { regions: [] } };
assert(days('甲', '乙') === 20, '空地图照旧');
sandbox.GM = { _capital: '北京', mapData: { regions: [{ id: 'a', name: '甲', neighbors: ['b'] }, { id: 'b', name: '乙', neighbors: ['a'] }] } };
assert(days('甲', '乙') === 20, '地图没坐标照旧');
sandbox.GM = { _capital: '北京', mapData: { get regions() { throw new Error('坏档'); } } };
let threw = false;
try { assert(days('甲', '乙') === 20, '坏地图也照旧给日数'); } catch (_) { threw = true; }
assert(!threw, '坏地图不外抛，不拖垮写信和过回合');

console.log('六、没写地名契约的地图（晚唐这样）');
const tangMap = () => ({
  regions: [
    { id: '京兆府·长安', name: '京兆府·长安', title: '京兆府·长安', geographicCenter: [108.94, 34.27], neighbors: ['同州'] },
    { id: '同州', name: '同州', title: '同州', geographicCenter: [109.94, 34.8], neighbors: ['京兆府·长安', '魏州'] },
    { id: '魏州', name: '魏州', title: '魏州', geographicCenter: [115.2, 36.3], neighbors: ['同州'] },
  ],
});
sandbox.GM = { _capital: '京兆府·长安', mapData: tangMap(), chars: [] };
const tangEdge = greatCircle([108.94, 34.27], [109.94, 34.8]);
assert(near(km('京兆府·长安', '同州'), tangEdge), '全名认得');
assert(near(km('长安', '同州'), tangEdge) && near(km('京兆府', '同州'), tangEdge), '拆开的每一段都认得');
assert(near(km('京师', '同州'), tangEdge) && near(km('宫中', '同州'), tangEdge), '通称跟着当朝京城');
assert(near(km('魏博·魏州', '魏州'), 0) && near(km('魏州（节度使驻地）', '魏州'), 0), '带镇名、带括注都认得');
assert(near(km('魏州节度使府', '魏州'), 0), '整句里带着地名也认得');
assert(km('清海镇', '魏州') == null && days('清海镇', '魏州') === 20, '地图上没有的退回粗估');

console.log('七、同地');
sandbox.GM = ming();
assert(days('顺天府', '顺天府') === 1 && days('', '顺天府') === 1 && days('顺天府', '') === 1, '同名或缺地名一日');
assert(days('顺天府', '北直隶·通州') === 1, '同一地块的两处一日');
assert(days('顺天府', '北直隶·通州', 'extreme') === 1, '加急也不会算出零日');

console.log('八、只为玩家这一头算一次路');
sandbox.GM = ming();
const route = sandbox.TM.MapRouteDays;
const realRouteDays = route.routeDays;
let runs = 0;
route.routeDays = function (map, from, opts) { runs++; return realRouteDays(map, from, opts); };
sandbox._ltRouteKm('顺天府', '保定府');
const sources = new Set();
route.routeDays = function (map, from, opts) { sources.add(String(from)); return realRouteDays(map, from, opts); };
for (let i = 0; i < 50; i++) {
  days('顺天府', '开封府');
  days('广州府', '顺天府');
  days('应天府', '顺天府');
}
route.routeDays = realRouteDays;
assert(runs === 1 && sources.size <= 1 && !sources.has('r-gz') && !sources.has('r-nj'), '收信人再多也从玩家这一头算');
sandbox.GM = ming();
const otherMap = contractMap();
otherMap.regions[1].geographicCenter = [100, 30];
sandbox.GM.mapData = otherMap;
assert(!near(km('顺天府', '保定府'), edge, 10), '读档换了地图：不沿用旧路程');

console.log('九、写信真用上了这个日数');
const send = (content, targets) => {
  sandbox.GM._ltMultiMode = true;
  sandbox.GM._ltMultiTargets = targets.slice();
  sandbox._$ = (id) => (id === 'letter-textarea' ? { value: content } : null);
  sandbox.sendLetter();
  sandbox._$ = () => null;
};
sandbox.P = { playerInfo: { characterName: '朱由检' } };
sandbox.GM = Object.assign(ming(), { turn: 3, letters: [], items: [] });
sandbox.GM.chars.push({ name: '巡抚', alive: true, location: '广州府' }, { name: '知府', alive: true, location: '保定府' });
send('卿听旨', ['巡抚', '知府']);
const sent = {};
for (const l of sandbox.GM.letters) sent[l.to] = l;
const gzDays = days('北京', '广州府');
assert(sent['巡抚'] && sent['巡抚']._travelDays === gzDays, '到广州的信走这么多日');
assert(sent['巡抚'] && sent['巡抚']._deliveryDay === 100 + gzDays, '送达日按它算');
assert(sent['巡抚'] && sent['巡抚']._replyDay === 100 + gzDays * 2 + 3, '回书日按它算');
assert(sent['知府'] && sent['知府']._travelDays < sent['巡抚']._travelDays, '近的信比远的先到');

if (failed) {
  console.log('FAIL smoke-letter-route-days: ' + failed + ' 处失败');
  process.exit(1);
}
console.log('PASS smoke-letter-route-days');
