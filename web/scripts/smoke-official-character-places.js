// smoke-official-character-places.js — 官方剧本每个活人都得有落点
//
// 同志定：人物绑定到具体地块，移动也在最小地块之间。写「罢闲」「行伍」「北上路上」「往来…」的人
// 没有地块，AI 判断不了他在哪，信程只能退回粗档，所以数据里不许再出现。
// 粗区（「江淮」）算有地域区间，可以留着，但信程要说得过去，不能按区内最近的一块算成一日到。
// 查的是仓库真源 scenarios/，派生的 bundled-scenarios 由 verify-official-scenario-parity 对齐。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.join(__dirname, '..');
const SCENARIOS = path.join(WEB, '..', 'scenarios');
let failed = 0;
function assert(cond, msg) {
  if (cond) console.log('  PASS ' + msg);
  else { failed++; console.log('  FAIL ' + msg); }
}

function world(fileName, capital) {
  const scenario = JSON.parse(fs.readFileSync(path.join(SCENARIOS, fileName), 'utf8'));
  const sandbox = {
    console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, TM: {}, P: {}, GM: {}, Map, Set, WeakMap,
    document: { getElementById: () => null, createElement: () => ({ style: {} }), addEventListener() {}, body: {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    toast() {}, escHtml: (s) => String(s == null ? '' : s), getTSText: () => 'T', uid: () => 'id',
    getCurrentGameDay: () => 100, _getDaysPerTurn: () => 30, SettlementPipeline: { register() {} },
    findCharByName: () => null,
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const rel of ['tm-utils.js', 'tm-map-route-days.js', 'tm-map-locations.js', 'tm-hongyan-office.js']) {
    vm.runInContext(fs.readFileSync(path.join(WEB, rel), 'utf8'), sandbox, { filename: rel });
  }
  const chars = (scenario.characters || []).filter((c) => c && c.name);
  sandbox.GM = { mapData: scenario.map || scenario.mapData, _capital: capital, chars, facs: scenario.factions || [], playerInfo: scenario.playerInfo || {} };
  return {
    chars,
    ids: (text) => Array.from(sandbox.TMMapLocations.placeRegionIds(text, sandbox.GM)),
    days: (a, b) => sandbox.calcLetterDays(a, b, 'normal'),
    who: (name) => chars.find((c) => c.name === name),
  };
}

const OFFICIAL = [['天启七年·九月（官方）.json', '北京'], ['晚唐·开成五年（官方）.json', '京兆府·长安'], ['绍宋·建炎元年八月（官方）.json', '应天府']];
for (const [fileName, capital] of OFFICIAL) {
  console.log(fileName);
  const w = world(fileName, capital);
  const live = w.chars.filter((c) => c.alive !== false && c.location);
  const lost = live.filter((c) => w.ids(c.location).length === 0);
  assert(live.length > 100, `活人 ${live.length} 个都查到了`);
  assert(lost.length === 0, `每个人都有落点${lost.length ? '：' + lost.slice(0, 8).map((c) => `${c.name}@${c.location}`).join('、') : ''}`);
  const moving = live.filter((c) => c._travelTo);
  for (const c of moving) {
    assert(w.ids(c.location).length === 1, `${c.name}在路上也有实地：${c.location}`);
    assert(w.ids(c._travelTo).length === 1, `${c.name}要去的地方在地图上：${c._travelTo}`);
    assert(c._travelRemainingDays === w.days(c.location, c._travelTo), `${c.name}剩下的天数就是地图上的路程`);
  }
}

console.log('绍宋：几个史实落点');
{
  const w = world('绍宋·建炎元年八月（官方）.json', '应天府');
  const yue = w.who('岳飞');
  assert(yue._travelTo === '卫州' && yue.location === '开封府', '岳飞在北上投张所的路上');
  assert(w.ids(w.who('张所').location).join() === w.ids(yue._travelTo).join(), '岳飞去的就是张所驻的地方');
  assert(w.ids(w.who('耿南仲').location).join() === w.ids('临江军').join(), '耿南仲：临江军居住（宋史卷352）');
  assert(w.ids(w.who('吕好问').location).join() === w.ids('宣州').join(), '吕好问：知宣州（宋史卷362）');
  assert(w.ids(w.who('赵伯琮').location).join() === w.ids('秀州').join(), '赵伯琮：秀州青杉闸官舍（宋史卷33）');
  assert(w.ids('河北·五马山').join() === w.ids('五马山寨').join(), '写了五马山的不算河北粗区');
  assert(w.ids('京东·梁山泊').join() !== w.ids('梁山军').join(), '梁山泊不是夔州路的梁山军');
  assert(w.ids('庆州').length === 1, '「庆州」是宋的庆州，不和别名叫庆州的契丹庆州两可');
  console.log('粗区的信程');
  assert(w.ids('江淮').length > 20, '江淮还是粗区');
  assert(w.days('应天府', '江淮') > 1, `应天到江淮不是一日：${w.days('应天府', '江淮')} 日`);
  assert(w.days('应天府', '京东') > 1, `应天就在京东路上，给京东的人写信也不是一日：${w.days('应天府', '京东')} 日`);
}

if (failed) {
  console.log('FAIL smoke-official-character-places: ' + failed + ' 处失败');
  process.exit(1);
}
console.log('PASS smoke-official-character-places');
