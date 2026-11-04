// smoke-same-region.js — 同地按最小地块判
//
// 规则（同志定）：人物绑定到最小地块，同一地块才能问对、朝会，不同地块只能写信；京城和行在也落到地块。
// 粗区（「江淮」）不算同地；对不上地图的、没有地图的剧本退回比文字。
// 先前比的是地名文字：「蓟州·三屯营」和「京师」分属两个字面却同一地块，算不同地；
// 日本的「京」遇到「京兆府」，因为字面包含，反倒算同地。
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
vm.createContext(sandbox);

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
for (const rel of ['tm-utils.js', 'tm-map-route-days.js', 'tm-map-locations.js']) {
  vm.runInContext(read(rel), sandbox, { filename: rel });
}
const extract = (rel, name) => {
  const hit = read(rel).match(new RegExp('function ' + name + '\\(ch?\\) \\{[\\s\\S]*?\\r?\\n\\}|function ' + name + '\\(\\) \\{[\\s\\S]*?\\r?\\n\\}'));
  assert(!!hit, '取到内核 ' + name);
  vm.runInContext(hit[0], sandbox);
};
extract('tm-chaoyi.js', '_getPlayerLocation');
extract('tm-chaoyi.js', '_isAtCapital');
extract('tm-wendui.js', '_wdIsAtCapital');

const same = (a, b) => sandbox._isSameLocation(a, b);
const ids = (t) => sandbox.TMMapLocations.placeRegionIds(t, sandbox.GM);

const contractMap = () => ({
  locationBindingContract: { schema: 'source-text-location-v2', courtCharacterId: 'c1', courtFactionId: 'f-ming', courtStartRegionId: 'r-bj', exactAreaPriority: true },
  regions: [
    { id: 'r-bj', name: '顺天府', aliases: ['通州', '北直隶·通州', '蓟州', '北直隶·蓟州'], neighbors: ['r-bd'] },
    { id: 'r-bd', name: '保定府', neighbors: ['r-bj', 'r-xa'] },
    { id: 'r-xa', name: '京兆府', neighbors: ['r-bd', 'r-sy'] },
    { id: 'r-sy', name: '沈阳', neighbors: ['r-xa', 'r-ly'] },
    { id: 'r-ly', name: '辽阳', neighbors: ['r-sy', 'r-nj'] },
    { id: 'r-nj', name: '应天府', aliases: ['南京'], neighbors: ['r-ly', 'r-kf'] },
    { id: 'r-kf', name: '开封府', neighbors: ['r-nj'] },
  ],
  locationAreas: [{ text: '江淮', regionIds: ['r-nj', 'r-kf'] }],
  locationAliases: [{ text: '京', regionId: 'r-kf', factionId: 'f-ja' }],
});
const ming = (map) => ({
  _capital: '北京',
  mapData: map || contractMap(),
  facs: [{ id: 'f-ming', name: '明' }, { id: 'f-ja', name: '日本' }],
  chars: [
    { id: 'c1', name: '天子', isPlayer: true, alive: true, location: '京师·紫禁城·乾清宫', factionId: 'f-ming' },
    { id: 'c2', name: '上皇', alive: true, location: '京', factionId: 'f-ja' },
  ],
});

console.log('一、同一地块才同地');
sandbox.GM = ming();
assert(same('顺天府', '北直隶·通州'), '同一地块的两处');
assert(same('京师·文渊阁', '蓟州·三屯营'), '京师和蓟州同在顺天府这一块');
assert(same('京师·紫禁城·乾清宫', '京师·文渊阁'), '宫里各处同地');
assert(!same('顺天府', '保定府'), '不同地块不同地');
assert(!same('沈阳', '辽阳'), '文字表把沈阳辽阳并成一组，地图上是两块，不同地');
assert(!same('京', '京兆府'), '日本的「京」字面在「京兆府」里，也不同地');
assert(same('京', '开封府'), '「京」带上写它的人认到它那一块');
assert(same('南京', '应天府'), '别名和正名同地');

console.log('二、京城和行在都落到地块');
assert(same('北京', '顺天府') && same('北京', '通州'), '京城写「北京」，落到顺天府这一块');
sandbox.GM._capital = '南京';
assert(same('京师', '应天府') && !same('京师', '顺天府'), '迁都南京后，京师跟到应天府');
sandbox.GM = ming();
sandbox.GM.chars[0].location = '开封府';
assert(same('行在', '开封府') && !same('行在', '顺天府'), '行在是天子此刻所在');
sandbox.GM.chars[0].location = '保定府';
assert(same('行在', '保定府') && !same('行在', '开封府'), '天子走了，行在跟着走');
assert(same('随驾', '保定府'), '随驾也跟着天子');
assert(same('行在·应天府', '南京') && !same('行在·应天府', '保定府'), '「行在·应天府」写了实地，以实地为准');

console.log('三、边界');
sandbox.GM = ming();
assert(ids('江淮').length === 2, '粗区有多个候选');
assert(!same('江淮', '应天府'), '粗区不算同地，哪怕范围里含这一块');
assert(same('江淮', '江淮'), '写法一字不差的还算同地');
assert(ids('太行山·忠义寨').length === 0, '地图上没有的地方');
assert(same('太行山·忠义寨', '太行山·忠义寨'), '对不上地图：写法相同算同地');
assert(same('太行山', '太行山·忠义寨'), '对不上地图：退回文字比');
assert(!same('太行山·忠义寨', '顺天府'), '对不上地图的不会和地图上的地方算同地');
sandbox.GM = { _capital: '北京', chars: [] };
assert(same('京师', '紫禁城·乾清宫') && same('顺天府', '北京'), '没有地图的剧本照旧比文字');
assert(same('沈阳', '辽阳'), '没有地图的剧本，老的别名表照旧');
sandbox.GM = { _capital: '北京', mapData: { regions: [] } };
assert(same('京师', '顺天府'), '空地图照旧比文字');
sandbox.GM = { _capital: '北京', mapData: { get regions() { throw new Error('坏档'); } } };
let threw = false;
let badResult = false;
try { badResult = same('京师', '顺天府'); } catch (_) { threw = true; }
assert(!threw && badResult, '坏地图不外抛，退回比文字');
sandbox.GM = { _capital: '北京', mapData: { regions: [{ id: 'a', name: '甲' }] } };
assert(same('甲', '甲') && !same('', '甲') && same('', ''), '缺地名的老规矩不变');

console.log('四、问对、朝会的门');
sandbox.GM = ming();
const c = (location, extra) => Object.assign({ name: 'x', alive: true, location }, extra);
for (const [name, gate] of [['朝会', '_isAtCapital'], ['问对', '_wdIsAtCapital']]) {
  assert(sandbox[gate](c('蓟州·三屯营')), name + '：同一地块的能来');
  assert(!sandbox[gate](c('保定府')), name + '：别的地块来不了，只能写信');
  assert(!sandbox[gate](c('江淮')), name + '：写粗区的来不了');
  assert(!sandbox[gate](c('蓟州', { _travelTo: '保定府' })), name + '：正在路上的来不了');
  assert(!sandbox[gate](c('蓟州', { alive: false })), name + '：死者来不了');
}
sandbox.GM.chars[0].location = '保定府';
assert(sandbox._isAtCapital(c('保定府')) && !sandbox._isAtCapital(c('京师')), '天子不在京：身边的能来，京里的来不了');

console.log('五、没写地名契约的地图也绑定（晚唐这样）');
const tangMap = () => ({
  regions: [
    { id: '京兆府·长安', name: '京兆府·长安', title: '京兆府·长安', neighbors: ['同州'] },
    { id: '同州', name: '同州', title: '同州', neighbors: ['京兆府·长安', '魏州'] },
    { id: '魏州', name: '魏州', title: '魏州', neighbors: ['同州'] },
  ],
});
const tangChars = () => [
  { id: 't1', name: '李瀍', isPlayer: true, alive: true, location: '京兆府·长安' },
  { id: 't2', name: '李德裕', alive: true, location: '长安' },
  { id: 't3', name: '何重顺', alive: true, location: '魏博·魏州' },
  { id: 't4', name: '慧日', alive: true, location: '清海镇' },
];
sandbox.GM = { _capital: '京兆府·长安', mapData: tangMap(), chars: tangChars() };
const L = sandbox.TMMapLocations;
assert(L.enabled(sandbox.GM.mapData), '有地块就绑定');
L.syncWorld(sandbox.GM);
const tang = (n) => sandbox.GM.chars.find((x) => x.name === n);
assert(tang('李瀍').regionId === '京兆府·长安' && tang('李瀍').mapRegionId === '京兆府·长安', '全名绑上');
assert(tang('李德裕').regionId === '京兆府·长安', '拆开的一段也绑上');
assert(tang('何重顺').regionId === '魏州', '带镇名的绑到州');
assert(!tang('慧日').regionId && !!tang('慧日').mapLocationBinding, '对不上的不绑地块');
assert(same('京师', '长安') && same('宫中', '京兆府') && !same('京师', '魏州'), '通称落到长安这块');
assert(L.placeRegionIds('行在', sandbox.GM)[0] === '京兆府·长安', '行在落到天子那块');
tang('何重顺').location = '同州';
L.sync(tang('何重顺'), 'character', sandbox.GM);
assert(tang('何重顺').regionId === '同州', '挪地方绑定跟着走');
tang('何重顺').location = '京师';
L.sync(tang('何重顺'), 'character', sandbox.GM);
assert(tang('何重顺').regionId === '京兆府·长安', '写通称也绑到京城那块');
tang('何重顺').location = '行在';
assert(L.syncCharacters(sandbox.GM) === 4 && tang('何重顺').regionId === '京兆府·长安', '每回合对齐：写行在的绑到天子那块');
tang('何重顺').location = '同州';
L.sync(tang('何重顺'), 'character', sandbox.GM);
const reading = L.read(tang('李德裕'), 'character', sandbox.GM);
assert(reading.status === 'resolved' && reading.precision === 'region', '日常活动读得到精确地块');
assert(L.resolveText('魏州（节度使驻地）', sandbox.GM.mapData, null, 'character', sandbox.GM).regionId === '魏州', '括注不碍事');
assert(L.resolveText('魏州节度使府', sandbox.GM.mapData, null, 'character', sandbox.GM).regionId === '魏州', '整句里带着地名也认得');

console.log('六、写了契约的地图不拆段，免得误认');
sandbox.GM = ming();
assert(ids('北直隶').length === 0, '别名的一段不算地名');
const before = contractMap();
sandbox.GM.mapData = before;
L.syncWorld(sandbox.GM);
assert(sandbox.GM.chars[0].regionId === 'r-bj', '写「京师」的绑到京城那一块');
assert(sandbox.GM.chars[1].regionId === 'r-kf', '势力专属别名绑到它那一块');
assert(!Object.keys(before).some((k) => /places|cache/i.test(k)), '不往地图上写东西');

console.log('七、老档读进来绑一次');
assert(/'map location binding'[\s\S]{0,120}TMMapLocations\.syncWorld\(GM\)/.test(read('tm-save-lifecycle.js')), '读档绑定且出错不拖垮读档');

if (failed) {
  console.log('FAIL smoke-same-region: ' + failed + ' 处失败');
  process.exit(1);
}
console.log('PASS smoke-same-region');
